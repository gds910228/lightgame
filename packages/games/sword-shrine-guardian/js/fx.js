// VFX: sweep shader arcs, shockwave rings, striped telegraphs (never plain rects/circles), sparks, glow columns, orbs, dmg numbers, ambient ash.
// Skill rules: grids follow swing path, scrolling noise, erosion over time; bloom peak colors <= ~2.3.
import * as THREE from '../vendor/three.module.min.js';
import { glowTex, streakTex, noiseTex } from './assets.js';
import { V } from './rig.js';

const NOISE = noiseTex();
const uni = (o) => Object.assign({ uTime: { value: 0 }, uLife: { value: 0 } }, o);
const addMat = (vsh, fsh, uniforms) => new THREE.ShaderMaterial({
  uniforms, vertexShader: vsh, fragmentShader: fsh, transparent: true, depthWrite: false,
  blending: THREE.AdditiveBlending, side: THREE.DoubleSide
});
const FLAT_VS = `varying vec2 vUV;
  void main(){ vUV = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`;

// annular sector geometry with arc (u) / radius (v) uv coordinates; base direction +Z (yaw = facing drives it)
function sectorGeo(rIn, rOut, span, segA = 26, segR = 4) {
  const pos = [], uv = [], idx = [];
  for (let j = 0; j <= segR; j++) for (let i = 0; i <= segA; i++) {
    const u = i / segA, v = j / segR, a = -span / 2 + span * u, r = rIn + (rOut - rIn) * v;
    pos.push(Math.sin(a) * r, 0, Math.cos(a) * r);
    uv.push(u, v);
  }
  for (let j = 0; j < segR; j++) for (let i = 0; i < segA; i++) {
    const a = j * (segA + 1) + i, b = a + segA + 1;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); return g;
}
// tapered strip in XZ extending toward local +Z (far end +Z), width tapers toward the tip
function taperedStrip(w, len, seg = 8) {
  const pos = [], uv = [], idx = [];
  for (let j = 0; j <= seg; j++) for (let i = 0; i <= 1; i++) {
    const t = j / seg, x = (i - .5) * w * (1 - t * .8);
    pos.push(x, 0, t * len); uv.push(i, t);
  }
  for (let j = 0; j < seg; j++) {
    const a = j * 2 + 0, b = j * 2 + 1, c = j * 2 + 2, d = j * 2 + 3;
    idx.push(a, c, b, b, c, d);
  }
  const g2 = new THREE.BufferGeometry();
  g2.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g2.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g2.setIndex(idx);
  return g2;
}

const SWEEP_FS = `uniform float uTime; uniform float uLife; uniform vec3 uColor; uniform float uSign; uniform sampler2D uNoiseT; varying vec2 vUV;
  void main(){
    float prog = uLife;                              // elapsed -> sweep head along arc
    float head = uSign > 0. ? prog : 1.0 - prog;
    float vis = smoothstep(head - .5, head - .05, vUV.x) * (1.0 - step(head, vUV.x));
    float erode = texture2D(uNoiseT, vec2(vUV.x * 2.2 + uTime * .15, vUV.y * 1.6 + uTime * .3)).r;
    if (erode < prog * .7) discard;                  // erosion eats the tail
    float blade = mix(.12, 1.0, pow(vUV.y, 1.6)) + smoothstep(.72, 1.0, vUV.y) * .9;
    float taper = sin(vUV.x * 3.14159);
    float i = blade * taper * vis;
    gl_FragColor = vec4(uColor * i * 2.1, i);
  }`;

const RING_FS = `uniform float uTime; uniform float uLife; uniform vec3 uColor; varying vec2 vUV;
  void main(){
    float band = smoothstep(0., .55, vUV.y) * smoothstep(1., .75, vUV.y);
    float i = band * uLife * (.55 + .45 * sin(vUV.x * 24. + uTime * 8.));
    gl_FragColor = vec4(uColor * i * 2.0, i);
  }`;

const TEL_FS = `uniform float uTime; uniform float uLife; uniform vec3 uColor; uniform float uMode; varying vec2 vUV;
  void main(){
    float i;
    if (uMode < .5) {                                // sector: stripes along sweep axis + progress line + tapered ends
      float stripes = .5 + .5 * sin(vUV.x * 11. - uTime * 3.6);
      i = (.2 + .5 * stripes) * (.3 + .7 * uLife);
      i += smoothstep(.035, .0, abs(vUV.x - uLife * .96)) * .85;
      i *= sin(vUV.x * 3.14159) * .9 + .1;
    } else if (uMode < 1.5) {                        // circle: fill grows from center, rune rim
      float stripes = .5 + .5 * sin(vUV.y * 9. + uTime * 4.2);
      float disc = smoothstep(uLife * 1.12, uLife * 1.12 - .2, vUV.y);
      i = (.13 + .45 * stripes) * disc + smoothstep(.93, 1., vUV.y) * .65;
      i *= (.3 + .7 * uLife);
    } else {                                         // line: stripes along length, progress toward far end
      float stripes = .5 + .5 * sin(vUV.y * 10. - uTime * 3.2);
      i = (.2 + .5 * stripes) * (.3 + .7 * uLife);
      i += smoothstep(.05, .0, abs(vUV.y - uLife)) * .9;
      i *= sin(vUV.x * 3.14159);
    }
    gl_FragColor = vec4(uColor * i * 1.9, i);
  }`;

const COL_FS = `uniform float uTime; uniform float uLife; uniform vec3 uColor; varying vec2 vUV;
  void main(){
    float scroll = .5 + .5 * sin(vUV.y * 7. - uTime * 5. + vUV.x * 3.);
    float i = (0.32 + 0.5 * scroll) * uLife * smoothstep(1., .2, vUV.y);
    gl_FragColor = vec4(uColor * i * 1.6, i);
  }`;

export function makeFX(scene) {
  const list = [];
  const glows = { warm: glowTex('255,170,90'), cyan: glowTex('140,210,255'), gold: glowTex('255,205,120'), pale: glowTex('230,225,210') };
  const streak = streakTex();
  const e2 = { t: 0 };

  const fx = {
    list, count: () => list.length,
    update(dt) {
      for (let i = list.length - 1; i >= 0; i--) {
        const e = list[i]; e.t += dt;
        if (e.tick) e.tick(dt, Math.min(1, e.t / e.dur));
        if (e.t >= e.dur || (e.dead && e.dead())) {
          if (e.cleanup) e.cleanup();
          scene.remove(e.obj); list.splice(i, 1);
        }
      }
      e2.t += dt;
    },
    clear() { for (const e of list) { if (e.cleanup) e.cleanup(); scene.remove(e.obj); } list.length = 0; }
  };

  const put = (obj, dur, tick) => {
    scene.add(obj);
    const e = { obj, t: 0, dur, tick };
    e.kill = () => { e.t = e.dur; };
    list.push(e); return e;
  };

  // --- slash arc: sweeps along swing direction, noise erodes the tail ---
  fx.slash = (pos, facing, { span = 2.0, rOut = 2.4, rIn = .7, color = 0xaee6ff, dur = .22, vertical = 0, sign = 1 } = {}) => {
    const g = sectorGeo(rIn, rOut, span);
    const m = addMat(FLAT_VS, SWEEP_FS, uni({ uColor: { value: new THREE.Color(color) }, uSign: { value: sign }, uNoiseT: { value: NOISE } }));
    const mesh = new THREE.Mesh(g, m);
    mesh.rotation.order = 'YXZ';                     // pitch in local frame first, then yaw
    mesh.position.set(pos.x, .95, pos.z);
    mesh.rotation.y = facing; if (vertical) { mesh.rotation.x = -vertical; mesh.position.y = 1.2; }
    return put(mesh, dur, (dt, l) => { m.uniforms.uLife.value = l; m.uniforms.uTime.value += dt; });
  };
  // --- expanding shockwave ring on ground ---
  fx.ring = (pos, { r0 = .8, r1 = 6, color = 0xffc9a0, dur = .5, w = .16 } = {}) => {
    const g = sectorGeo(r0, r0 + Math.max(.35, r0 * w), Math.PI * 2, 48, 2);
    const m = addMat(FLAT_VS, RING_FS, uni({ uColor: { value: new THREE.Color(color) } }));
    const mesh = new THREE.Mesh(g, m);
    mesh.position.set(pos.x, .08, pos.z);
    return put(mesh, dur, (dt, l) => {
      const s = 1 + (r1 / r0 - 1) * l; mesh.scale.set(s, 1, s);
      m.uniforms.uLife.value = 1 - l; m.uniforms.uTime.value += dt;
    });
  };
  // --- telegraph sector (melee warns): amber flowing stripes + progress line ---
  fx.teleSector = (pos, facing, { span = 1.8, r = 3.4, color = 0xffb24d, dur = .55 } = {}) => {
    const g = sectorGeo(.3, r, span);
    const m = addMat(FLAT_VS, TEL_FS, uni({ uColor: { value: new THREE.Color(color) }, uMode: { value: 0 } }));
    const mesh = new THREE.Mesh(g, m);
    mesh.position.set(pos.x, .07, pos.z); mesh.rotation.y = facing;
    return put(mesh, dur, (dt, l) => { m.uniforms.uLife.value = l; m.uniforms.uTime.value += dt; });
  };
  // --- telegraph line (boss eruptions): tapered strip extending toward facing ---
  fx.teleLine = (pos, facing, { w = 1.6, len = 14, color = 0xffb24d, dur = 1.0 } = {}) => {
    const g = taperedStrip(w, len);
    const m = addMat(FLAT_VS, TEL_FS, uni({ uColor: { value: new THREE.Color(color) }, uMode: { value: 2 } }));
    const mesh = new THREE.Mesh(g, m);
    const hold = new THREE.Group();
    mesh.position.y = .07; hold.add(mesh);
    hold.position.set(pos.x, 0, pos.z); hold.rotation.y = facing;
    return put(hold, dur, (dt, l) => { m.uniforms.uLife.value = l; m.uniforms.uTime.value += dt; });
  };
  // --- telegraph circle (caster AoE) ---
  fx.teleCircle = (pos, { r = 2.2, color = 0xff9d5c, dur = 1.05 } = {}) => {
    const g = sectorGeo(.05, r, Math.PI * 2, 40, 3);
    const m = addMat(FLAT_VS, TEL_FS, uni({ uColor: { value: new THREE.Color(color) }, uMode: { value: 1 } }));
    const mesh = new THREE.Mesh(g, m); mesh.position.set(pos.x, .07, pos.z);
    return put(mesh, dur, (dt, l) => { m.uniforms.uLife.value = l; m.uniforms.uTime.value += dt; mesh.rotation.y += dt * 1.2; });
  };
  // --- sparks at contact point flying along swing direction ---
  fx.sparks = (pos, dir, { n = 9, color = 0xffdca8, speed = 7 } = {}) => {
    for (let i = 0; i < n; i++) {
      const mat = new THREE.SpriteMaterial({ map: streak, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, rotation: Math.atan2(dir.x, -dir.z) + Math.PI / 2 });
      const s = new THREE.Sprite(mat); s.scale.set(.55 + Math.random() * .5, .1, 1);
      s.position.set(pos.x, pos.y + .1, pos.z);
      const v = dir.clone().multiplyScalar(speed * (.5 + Math.random() * .8));
      v.x += (Math.random() - .5) * 3; v.y += Math.random() * 2.4; v.z += (Math.random() - .5) * 3;
      const dur = .28 + Math.random() * .22;
      put(s, dur, (dt, l) => { v.y -= 14 * dt; s.position.addScaledVector(v, dt); mat.opacity = 1 - l; });
    }
  };
  // --- dust puff ---
  fx.dust = (pos, { n = 3, color = 0x8d94a6, size = .9 } = {}) => {
    for (let i = 0; i < n; i++) {
      const mat = new THREE.SpriteMaterial({ map: glows.pale, color, transparent: true, opacity: .3, depthWrite: false });
      const s = new THREE.Sprite(mat);
      s.position.set(pos.x + (Math.random() - .5) * .5, .25, pos.z + (Math.random() - .5) * .5);
      s.scale.setScalar(size * (.6 + Math.random() * .7));
      const v = V((Math.random() - .5) * .8, .5, (Math.random() - .5) * .8);
      put(s, .5 + Math.random() * .3, (dt, l) => { s.position.addScaledVector(v, dt); s.scale.multiplyScalar(1 + dt * 1.6); mat.opacity = .3 * (1 - l); });
    }
  };
  // --- persistent counter-window ring at a target's feet (gold, pulsing) ---
  fx.counterRing = (owner) => {
    const g = sectorGeo(.85, 1.1, Math.PI * 2, 40, 2);
    const m = addMat(FLAT_VS, RING_FS, uni({ uColor: { value: new THREE.Color(0xffd98c) } }));
    const mesh = new THREE.Mesh(g, m); mesh.position.set(owner.pos.x, .1, owner.pos.z);
    const e = put(mesh, 30, (dt) => {
      mesh.position.set(owner.pos.x, .1, owner.pos.z);
      m.uniforms.uTime.value += dt;
      m.uniforms.uLife.value = .6 + .4 * Math.sin(e.t * 9);
    });
    e.dead = () => !owner._counterMark;
    return e;
  };
  // --- loot glow column: 3 nested additive shells (skill: at least 3 layers) ---
  fx.lootCol = (getPos, tier = 0) => {
    const cols = [[0x9fd8ff, .5], [0x9fd8ff, .85], [0xd8ecff, 1.2]];
    const h = tier === 0 ? 1.3 : 2.5, baseR = tier === 0 ? .24 : .42;
    const grp = new THREE.Group(); const shells = [];
    for (const [c, rf] of cols) {
      const g = new THREE.CylinderGeometry(baseR * rf * .55, baseR * rf, h, 8, 4, true);
      g.translate(0, h / 2, 0);
      const m = addMat(FLAT_VS, COL_FS, uni({ uColor: { value: new THREE.Color(c) } }));
      const mesh = new THREE.Mesh(g, m); grp.add(mesh);
      shells.push({ m, base: .35 + rf * .2 });
    }
    const e = put(grp, 60, (dt) => {
      const p = getPos(); grp.position.set(p.x, 0, p.z);
      for (const o of shells) { o.m.uniforms.uTime.value += dt; o.m.uniforms.uLife.value = o.base * (.75 + .25 * Math.sin(e.t * 4)); }
    });
    e.kill();
    e.t = 0;                                    // kill() sets t=dur for removal; reset — we call .kill() later on pickup
    return e;
  };
  // --- damage number (cached canvas sprite) ---
  const numCache = new Map();
  const numTex = (n, crit) => {
    const k = n + (crit ? 'c' : '');
    if (numCache.has(k)) return numCache.get(k);
    const c = document.createElement('canvas'); c.width = 96; c.height = 64;
    const g = c.getContext('2d');
    g.font = (crit ? 'bold 34px' : '28px') + ' Georgia, serif'; g.textAlign = 'center';
    g.fillStyle = crit ? '#ffd98c' : '#f2e6d8'; g.strokeStyle = 'rgba(0,0,0,.75)'; g.lineWidth = 4;
    g.strokeText(String(n), 48, 40); g.fillText(String(n), 48, 40);
    const t = new THREE.CanvasTexture(c); numCache.set(k, t); return t;
  };
  fx.dmgNum = (pos, n, crit = false) => {
    const mat = new THREE.SpriteMaterial({ map: numTex(n, crit), transparent: true, depthWrite: false });
    const s = new THREE.Sprite(mat);
    s.position.set(pos.x + (Math.random() - .5) * .4, pos.y + 1.7, pos.z);
    s.scale.set(1.1, .73, 1);
    put(s, .7, (dt, l) => { s.position.y += dt * 1.3; mat.opacity = 1 - l * l; });
  };
  // --- projectile orb with fading trail; kill() to destroy ---
  fx.orb = (pos, vel, color = 0x7fe0c8, { r = .22, onEnd } = {}) => {
    const grp = new THREE.Group();
    const core = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 2.6, roughness: .3 }));
    grp.add(core);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glows.cyan, color, transparent: true, opacity: .8, blending: THREE.AdditiveBlending, depthWrite: false }));
    halo.scale.setScalar(r * 6); grp.add(halo);
    grp.position.copy(pos);
    const trail = [];
    const e = put(grp, 6, (dt) => {
      grp.position.addScaledVector(vel, dt); core.rotation.y += dt * 6;
      trail.push(grp.position.clone()); if (trail.length > 6) trail.shift();
      for (let i = 0; i < trail.length; i++) {
        if (!trail[i].spr) {
          const sm = new THREE.Sprite(new THREE.SpriteMaterial({ map: glows.cyan, color, transparent: true, opacity: .25, blending: THREE.AdditiveBlending, depthWrite: false }));
          trail[i].spr = sm; scene.add(sm);
        }
        trail[i].spr.position.copy(trail[i]);
        trail[i].spr.scale.setScalar(r * 3.2 * (i / trail.length + .3));
        trail[i].spr.material.opacity = .22 * (i / trail.length);
      }
    });
    e.dead = () => e.killed; e.killed = false;
    e.alive = true;                                   // consumed by the slash-destroy and player-collision checks
    e.pos = grp.position; e.vel = vel;
    e.kill = () => { e.killed = true; e.alive = false; };
    e.cleanup = () => { for (const t of trail) if (t.spr) scene.remove(t.spr); if (onEnd) onEnd(grp.position); };
    return e;
  };
  // --- radial burst (parry flash / orb break / slam core) ---
  fx.burst = (pos, color = 0xdfefff, { n = 10, size = 1.4, speed = 5 } = {}) => {
    for (let i = 0; i < n; i++) {
      const mat = new THREE.SpriteMaterial({ map: glows.cyan, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
      const s = new THREE.Sprite(mat);
      s.position.set(pos.x, pos.y, pos.z); s.scale.setScalar(size * (.5 + Math.random()));
      const a = Math.random() * Math.PI * 2, v = V(Math.cos(a) * speed * (.4 + Math.random() * .6), (Math.random() - .2) * 2, Math.sin(a) * speed * (.4 + Math.random() * .6));
      put(s, .3 + Math.random() * .2, (dt, l) => { s.position.addScaledVector(v, dt); mat.opacity = 1 - l; s.scale.multiplyScalar(1 - dt * 1.4); });
    }
  };
  // --- falling sword for 剑雨: dives from above, bursts into a small ring on landing ---
  fx.fallBlade = (pos) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(.09, 1.3, .09),
      new THREE.MeshStandardMaterial({ color: 0xcfd6e4, emissive: 0x8fd8ff, emissiveIntensity: 1.7, roughness: .3, metalness: .6 }));
    m.position.set(pos.x + (Math.random() - .5) * .3, 5.4, pos.z + (Math.random() - .5) * .3);
    m.rotation.set(-.95 + Math.random() * .35, Math.random() * 6.28, .2);
    const e = put(m, 2, (dt) => {
      m.position.y -= 21 * dt;
      if (m.position.y <= .14) {
        fx.ring(pos, { r0: .15, r1: 1.3, color: 0xaee6ff, dur: .3 });
        fx.dust(pos, { n: 2, size: .7 });
        e.t = e.dur;
      }
    });
    return e;
  };
  // --- ambient ash drifting in a box that follows the camera ---
  fx.makeAsh = (cam) => {
    const N = 460, geo = new THREE.BufferGeometry();
    const P = new Float32Array(N * 3), Vv = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      P[i * 3] = (Math.random() - .5) * 44; P[i * 3 + 1] = Math.random() * 12; P[i * 3 + 2] = (Math.random() - .5) * 44;
      Vv[i] = .35 + Math.random() * .5;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(P, 3));
    const mat = new THREE.PointsMaterial({ map: glows.pale, color: 0xaab2c4, size: .16, transparent: true, opacity: .5, depthWrite: false, blending: THREE.AdditiveBlending });
    const pts = new THREE.Points(geo, mat); scene.add(pts);
    return { pts, update(dt) {
      const c = cam.position, arr = geo.attributes.position.array;
      for (let i = 0; i < N; i++) {
        arr[i * 3 + 1] -= Vv[i] * dt;
        arr[i * 3] += Math.sin(e2.t * .8 + i) * dt * .18;
        if (arr[i * 3 + 1] < 0) { arr[i * 3 + 1] = 10 + Math.random() * 3; arr[i * 3] = c.x + (Math.random() - .5) * 44; arr[i * 3 + 2] = c.z + (Math.random() - .5) * 44; }
        if (Math.abs(arr[i * 3] - c.x) > 24) arr[i * 3] = c.x + (Math.random() - .5) * 44;
        if (Math.abs(arr[i * 3 + 2] - c.z) > 24) arr[i * 3 + 2] = c.z + (Math.random() - .5) * 44;
      }
      geo.attributes.position.needsUpdate = true;
    } };
  };
  return fx;
}
