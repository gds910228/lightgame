// track.js — three hand-tuned star-ring circuits, all geometry & textures procedural.
import * as THREE from '../vendor/three.module.min.js';

export const TRACKS = [
  {
    id: 'reef', name: '星港环礁', en: 'ORBITAL REEF', width: 15,
    tag: '青铜舷灯 · 长弯接短弯', accent: '#65c6b3', accent2: '#e8b463',
    skyTop: '#051522', skyBottom: '#173f48', fog: '#081722', ground: '#07131c',
    road: '#14263a', rail: '#65c6b3', dust: '#8fe9dc',
    shape: { rx: 226, rz: 158, h: [[3, .10, .4], [2, .055, 1.2], [5, .028, 2.1]], yAmp: 2.8, yFreq: 2 },
    grid: ['#2d6a68', '#18383c']
  },
  {
    id: 'forge', name: '熔炉峡谷', en: 'CINDER CANYON', width: 14,
    tag: '余烬逆风 · 落差急弯', accent: '#ff8a4c', accent2: '#ffd08a',
    skyTop: '#170b12', skyBottom: '#59251d', fog: '#1d0b0d', ground: '#170b0c',
    road: '#2a1a19', rail: '#ff8a4c', dust: '#ffc07a',
    shape: { rx: 212, rz: 224, h: [[2, .15, .8], [3, .06, 2.1], [4, .035, .1]], yAmp: 7.5, yFreq: 3 },
    grid: ['#6b3024', '#351711']
  },
  {
    id: 'relay', name: '云上中继', en: 'CLOUD RELAY', width: 16,
    tag: '紫电高架 · 连续S弯', accent: '#cf9bff', accent2: '#ffe0a2',
    skyTop: '#0d0b20', skyBottom: '#473763', fog: '#171229', ground: '#0d0b18',
    road: '#20213a', rail: '#cf9bff', dust: '#f0d4ff',
    shape: { rx: 252, rz: 176, h: [[1, .10, 2.2], [3, .075, .7], [4, .035, 1.6]], yAmp: 10, yFreq: 2 },
    grid: ['#5a4a7d', '#2a2341']
  }
];

function rng(seed) {
  let t = seed >>> 0;
  return function () {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function controlPoints(shape) {
  const pts = [];
  const N = 18;
  for (let i = 0; i < N; i++) {
    const a = i / N * Math.PI * 2;
    let rr = 1;
    for (const [k, amp, ph] of shape.h) rr += amp * Math.sin(k * a + ph);
    const x = Math.cos(a) * shape.rx * rr;
    const z = Math.sin(a) * shape.rz * rr;
    const y = 5 + shape.yAmp * Math.sin(shape.yFreq * a + 0.7);
    pts.push(new THREE.Vector3(x, y, z));
  }
  return pts;
}

function canvasTex(w, h, draw, repeatX = 1, repeatY = 1) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatX, repeatY);
  t.anisotropy = 4;
  return t;
}

function roadTexture(theme) {
  return canvasTex(128, 512, (g, w, h) => {
    g.fillStyle = theme.road; g.fillRect(0, 0, w, h);
    const r = rng(917 + theme.id.length * 31);
    for (let i = 0; i < 900; i++) {
      const x = r() * w, y = r() * h;
      g.fillStyle = r() > .5 ? 'rgba(255,255,255,.018)' : 'rgba(0,0,0,.08)';
      g.fillRect(x, y, 1 + r() * 3, 1 + r() * 2);
    }
    // edge lines
    g.fillStyle = 'rgba(255,239,207,.44)';
    g.fillRect(7, 0, 4, h); g.fillRect(w - 11, 0, 4, h);
    // centre dashes
    g.fillStyle = 'rgba(255,232,186,.66)';
    for (let y = 0; y < h; y += 64) g.fillRect(w / 2 - 4, y, 8, 36);
  }, 1, 5);
}

function gridTexture(theme) {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = theme.grid[1]; g.fillRect(0, 0, w, h);
    g.strokeStyle = theme.grid[0]; g.globalAlpha = .26; g.lineWidth = 2;
    for (let i = 0; i <= 256; i += 32) {
      g.beginPath(); g.moveTo(i, 0); g.lineTo(i, h); g.stroke();
      g.beginPath(); g.moveTo(0, i); g.lineTo(w, i); g.stroke();
    }
    for (let i = 0; i < 90; i++) {
      const r = rng(i * 37 + 8);
      g.globalAlpha = .05 + r() * .08;
      g.fillStyle = i % 2 ? '#fff' : '#000';
      g.fillRect(r() * w, r() * h, 1 + r() * 8, 1 + r() * 5);
    }
  }, 20, 20);
}

function bannerTexture(text, sub, theme) {
  return canvasTex(1024, 192, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, 'rgba(12,16,30,.96)');
    grad.addColorStop(.5, 'rgba(30,28,38,.98)');
    grad.addColorStop(1, 'rgba(12,16,30,.96)');
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    g.strokeStyle = theme.accent; g.globalAlpha = .7; g.lineWidth = 4;
    g.strokeRect(9, 9, w - 18, h - 18);
    g.globalAlpha = 1;
    g.textAlign = 'center';
    g.fillStyle = '#f6ebd5';
    g.font = '700 66px "Noto Serif SC", "Songti SC", Georgia, serif';
    g.fillText(text, w / 2, 92);
    g.fillStyle = theme.accent;
    g.font = '500 24px Georgia, serif';
    g.fillText(sub, w / 2, 142);
    for (let i = 0; i < 14; i++) {
      g.fillStyle = i % 2 ? theme.accent : '#e8b463';
      g.globalAlpha = .5;
      g.fillRect(40 + i * 70, 22, 26, 4);
      g.fillRect(40 + i * 70, 166, 26, 4);
    }
  });
}

function makeSky(theme) {
  const geo = new THREE.SphereGeometry(760, 28, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      top: { value: new THREE.Color(theme.skyTop) },
      bottom: { value: new THREE.Color(theme.skyBottom) },
      accent: { value: new THREE.Color(theme.accent) }
    },
    vertexShader: `varying vec3 vP; void main(){vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader: `uniform vec3 top; uniform vec3 bottom; uniform vec3 accent; varying vec3 vP;
      void main(){
        vec3 d=normalize(vP); float h=clamp(d.y*.5+.5,0.,1.);
        vec3 c=mix(bottom,top,pow(h,.72));
        float glow=pow(max(0.,dot(d,normalize(vec3(-.55,.15,-.65)))),26.);
        float band=exp(-pow((d.y-.08)*12.,2.))* .11;
        c+=accent*glow*.65 + accent*band;
        gl_FragColor=vec4(c,1.);
      }`
  });
  return new THREE.Mesh(geo, mat);
}

function disposeGroup(group) {
  group.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) { if (m.map && !m.map.userData.shared) m.map.dispose(); m.dispose(); }
    }
  });
  if (group.parent) group.parent.remove(group);
}

export function buildWorld(scene, trackIndex) {
  const theme = TRACKS[trackIndex];
  const group = new THREE.Group();
  group.name = 'circuit-' + theme.id;
  scene.add(group);

  // -------- spline --------
  const curve = new THREE.CatmullRomCurve3(controlPoints(theme.shape), true, 'catmullrom', .42);
  curve.arcLengthDivisions = 1200;
  const length = curve.getLength();
  const N = 700;
  const samples = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    const p = curve.getPointAt(u);
    const tan = curve.getTangentAt(u).normalize();
    const right = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
    samples.push({ u, p, tan, right });
  }

  // -------- sky / fog / ground --------
  scene.fog = new THREE.Fog(theme.fog, 150, 560);
  scene.background = new THREE.Color(theme.skyTop);
  const sky = makeSky(theme);
  group.add(sky);

  const groundTex = gridTexture(theme);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(1800, 1800, 1, 1),
    new THREE.MeshStandardMaterial({ map: groundTex, color: theme.ground, roughness: .95, metalness: .1 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -14;
  group.add(ground);

  // -------- road ribbon --------
  const half = theme.width / 2;
  const rp = [], ruv = [], idx = [];
  for (let i = 0; i <= N; i++) {
    const s = samples[i];
    const a = s.p.clone().addScaledVector(s.right, -half);
    const b = s.p.clone().addScaledVector(s.right, half);
    rp.push(a.x, a.y + .04, a.z, b.x, b.y + .04, b.z);
    ruv.push(0, i / N, 1, i / N);
    if (i < N) {
      const k = i * 2;
      idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
    }
  }
  const rg = new THREE.BufferGeometry();
  rg.setAttribute('position', new THREE.Float32BufferAttribute(rp, 3));
  rg.setAttribute('uv', new THREE.Float32BufferAttribute(ruv, 2));
  rg.setIndex(idx); rg.computeVertexNormals();
  const road = new THREE.Mesh(rg, new THREE.MeshStandardMaterial({
    map: roadTexture(theme), roughness: .55, metalness: .18, color: 0xffffff,
    emissive: new THREE.Color(theme.road), emissiveIntensity: .42
  }));
  group.add(road);

  // painted lane dashes (real geometry so they survive camera perspective)
  {
    const dashGeo = new THREE.PlaneGeometry(.26, 3.2);
    const dashMat = new THREE.MeshBasicMaterial({ color: 0xffe8ba, transparent: true, opacity: .46, side: THREE.DoubleSide, depthWrite: false });
    const dashCount = Math.floor(length / 10);
    const inst = new THREE.InstancedMesh(dashGeo, dashMat, dashCount + 2);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(1, 1, 1);
    let di = 0;
    for (let sPos = 0; sPos < length && di < dashCount; sPos += 10) {
      const u = sPos / length;
      const p = curve.getPointAt(u), tan = curve.getTangentAt(u);
      const qYaw = Math.atan2(tan.x, tan.z);
      q.setFromEuler(new THREE.Euler(-Math.PI / 2, qYaw, 0, 'YXZ'));
      for (const lane of [-.16, .16]) {
        if (di >= dashCount) break;
        const right = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
        const pos = p.clone().addScaledVector(right, lane * theme.width);
        pos.y += .09;
        m.compose(pos, q, sc);
        inst.setMatrixAt(di++, m);
      }
    }
    inst.count = di;
    inst.instanceMatrix.needsUpdate = true;
    group.add(inst);
  }

  // glowing edge ribbons
  function edgeRibbon(side) {
    const p = [], ids = [];
    for (let i = 0; i <= N; i++) {
      const s = samples[i];
      const c = s.p.clone().addScaledVector(s.right, side * (half + .12));
      const w = .18;
      const a = c.clone().addScaledVector(s.right, -w), b = c.clone().addScaledVector(s.right, w);
      p.push(a.x, a.y + .07, a.z, b.x, b.y + .07, b.z);
      if (i < N) { const k = i * 2; ids.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    g.setIndex(ids); g.computeVertexNormals();
    return new THREE.Mesh(g, new THREE.MeshBasicMaterial({
      color: theme.rail, transparent: true, opacity: .82, side: THREE.DoubleSide
    }));
  }
  group.add(edgeRibbon(1), edgeRibbon(-1));

  // curbs — alternating short plates
  {
    const cg = new THREE.BoxGeometry(1.7, .13, .6);
    const warm = new THREE.MeshStandardMaterial({ color: 0xf0dfc2, roughness: .5, emissive: 0x2a2218 });
    const accent = new THREE.MeshStandardMaterial({ color: theme.rail, roughness: .42, emissive: theme.rail, emissiveIntensity: .25 });
    const inst = new THREE.InstancedMesh(cg, new THREE.MeshStandardMaterial({ vertexColors: false, color: 0xffffff, roughness: .5 }), 220);
    inst.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(220 * 3), 3);
    let n = 0;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(1, 1, 1);
    for (let i = 4; i < N - 4 && n < 220; i += 25) {
      const s = samples[i];
      for (const side of [-1, 1]) {
        if (n >= 220) break;
        const pos = s.p.clone().addScaledVector(s.right, side * (half - .9));
        pos.y += .1;
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(s.tan.x, s.tan.z));
        m.compose(pos, q, sc);
        inst.setMatrixAt(n, m);
        inst.setColorAt(n, (Math.floor(i / 25) % 2) ? new THREE.Color(theme.rail) : new THREE.Color(0xeadbbf));
        n++;
      }
    }
    inst.count = n;
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    group.add(inst);
  }

  // -------- start gate --------
  const start = samples[0];
  const gate = new THREE.Group();
  const postMat = new THREE.MeshStandardMaterial({ color: 0x302a2b, metalness: .7, roughness: .3, emissive: 0x181316 });
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(.55, 7.2, .55), postMat);
    post.position.copy(start.p).addScaledVector(start.right, side * (half + 1.4));
    post.position.y += 3.6;
    gate.add(post);
  }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(theme.width + 5.4, .75, .6), postMat);
  beam.position.copy(start.p); beam.position.y += 7.2;
  beam.rotation.y = Math.atan2(start.tan.x, start.tan.z);
  gate.add(beam);
  const banner = new THREE.Mesh(new THREE.PlaneGeometry(theme.width + 2.8, 1.65), new THREE.MeshBasicMaterial({
    map: bannerTexture('星环线 · START', theme.en, theme), side: THREE.DoubleSide, transparent: true
  }));
  banner.position.copy(start.p); banner.position.y += 6.2;
  banner.rotation.y = Math.atan2(start.tan.x, start.tan.z) + Math.PI / 2;
  gate.add(banner);
  const startLine = new THREE.Mesh(new THREE.PlaneGeometry(theme.width, 1.5), new THREE.MeshBasicMaterial({
    map: canvasTex(256, 32, (g, w, h) => {
      for (let x = 0; x < w; x += 16) for (let y = 0; y < h; y += 16) {
        g.fillStyle = ((x + y) / 16) % 2 ? '#eee5d2' : '#1b1b22'; g.fillRect(x, y, 16, 16);
      }
    }, 4, 1), transparent: false
  }));
  startLine.rotation.x = -Math.PI / 2;
  startLine.rotation.z = -Math.atan2(start.tan.x, start.tan.z);
  startLine.position.copy(start.p); startLine.position.y += .09;
  gate.add(startLine);
  group.add(gate);

  // -------- ring arches --------
  for (const frac of [.24, .49, .74]) {
    const s = curve.getPointAt(frac);
    const tan = curve.getTangentAt(frac);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(theme.width * .64, .22, 5, 40),
      new THREE.MeshBasicMaterial({ color: theme.accent2, transparent: true, opacity: .42 }));
    ring.position.copy(s); ring.position.y += theme.width * .64 + .6;
    ring.rotation.y = Math.atan2(tan.x, tan.z);
    group.add(ring);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: spriteTex(), color: theme.accent2, transparent: true, opacity: .22, blending: THREE.AdditiveBlending, depthWrite: false
    }));
    halo.scale.setScalar(theme.width * 1.8);
    halo.position.copy(ring.position);
    group.add(halo);
  }

  // -------- item box positions --------
  const itemBoxes = [];
  const itemSpecs = [
    [.09, -.24], [.09, .24], [.22, 0], [.35, -.25], [.35, .25],
    [.46, 0], [.57, -.22], [.57, .22], [.68, 0], [.80, -.24], [.80, .24], [.92, 0]
  ];
  const boxGeo = new THREE.BoxGeometry(1.0, 1.0, 1.0);
  for (const [frac, lane] of itemSpecs) {
    const u = frac;
    const p = curve.getPointAt(u), tan = curve.getTangentAt(u);
    const right = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
    const pos = p.clone().addScaledVector(right, lane * theme.width).add(new THREE.Vector3(0, 1.25, 0));
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffd98e, emissive: 0xe8a84f, emissiveIntensity: .55, transparent: true, opacity: .78,
      metalness: .5, roughness: .2
    });
    const mesh = new THREE.Mesh(boxGeo, mat);
    mesh.position.copy(pos);
    group.add(mesh);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: spriteTex(), color: 0xffcf7a, transparent: true, opacity: .5,
      blending: THREE.AdditiveBlending, depthWrite: false
    }));
    glow.scale.setScalar(3.2); glow.position.copy(pos); group.add(glow);
    itemBoxes.push({ u, lane, pos, mesh, glow, active: true, respawn: 0 });
  }

  // -------- scenery --------
  const prand = rng(1000 + trackIndex * 713);
  const rockMat = new THREE.MeshStandardMaterial({
    color: trackIndex === 1 ? 0x3b1e1a : trackIndex === 2 ? 0x403a5c : 0x1e4750,
    roughness: .82, metalness: .15, flatShading: true
  });
  const glowMat = new THREE.MeshBasicMaterial({ color: theme.rail, transparent: true, opacity: .72 });
  for (let i = 0; i < 54; i++) {
    const u = (i / 54 + prand() * .014) % 1;
    const p = curve.getPointAt(u), tan = curve.getTangentAt(u);
    const right = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
    const side = prand() > .5 ? 1 : -1;
    const off = half + 9 + prand() * 22;
    const pos = p.clone().addScaledVector(right, side * off);
    pos.y += prand() * 8 - 4;
    const g = new THREE.Group();
    if (prand() > .55) {
      const h = 3 + prand() * 12;
      const spike = new THREE.Mesh(new THREE.ConeGeometry(1.2 + prand() * 3.2, h, 5 + (prand() * 3 | 0)), rockMat);
      spike.position.y = h / 2;
      g.add(spike);
      if (prand() > .45) {
        const tip = new THREE.Mesh(new THREE.OctahedronGeometry(.34 + prand() * .35), glowMat);
        tip.position.y = h + .4; g.add(tip);
      }
    } else {
      const h = 2.6 + prand() * 7;
      const col = new THREE.Mesh(new THREE.CylinderGeometry(.6, 1.1, h, 5), rockMat);
      col.position.y = h / 2; g.add(col);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(1.1, 1.8, 5), rockMat);
      cap.position.y = h + .9; g.add(cap);
      const light = new THREE.Sprite(new THREE.SpriteMaterial({
        map: spriteTex(), color: theme.accent2, opacity: .4, transparent: true,
        blending: THREE.AdditiveBlending, depthWrite: false
      }));
      light.scale.setScalar(2.2); light.position.y = h * .55; g.add(light);
    }
    g.position.copy(pos);
    g.rotation.y = prand() * Math.PI * 2;
    group.add(g);
  }

  // floating rocks
  const floatMat = new THREE.MeshStandardMaterial({ color: theme.grid[0], roughness: .8, flatShading: true });
  for (let i = 0; i < 18; i++) {
    const u = prand();
    const p = curve.getPointAt(u), tan = curve.getTangentAt(u);
    const right = new THREE.Vector3(-tan.z, 0, tan.x);
    const side = prand() > .5 ? 1 : -1;
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(.8 + prand() * 2.4, 0), floatMat);
    rock.position.copy(p).addScaledVector(right, side * (half + 16 + prand() * 40));
    rock.position.y += 10 + prand() * 28;
    rock.rotation.set(prand() * 3, prand() * 3, prand() * 3);
    group.add(rock);
  }

  // distant planet + ring
  {
    const planet = new THREE.Mesh(new THREE.SphereGeometry(46, 24, 16),
      new THREE.MeshBasicMaterial({ color: trackIndex === 1 ? 0x6e2b22 : 0x2b5560, fog: false }));
    planet.position.set(-240, 115, -330);
    group.add(planet);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(78, 2.2, 5, 80),
      new THREE.MeshBasicMaterial({ color: theme.accent, transparent: true, opacity: .28, fog: false }));
    ring.position.copy(planet.position); ring.rotation.x = 1.12; ring.rotation.y = .4;
    group.add(ring);
  }

  // stars
  {
    const pos = new Float32Array(900 * 3);
    const rr = rng(77 + trackIndex);
    for (let i = 0; i < 900; i++) {
      const a = rr() * Math.PI * 2, h = 60 + rr() * 340;
      const rad = 390 + rr() * 240;
      pos[i * 3] = Math.cos(a) * rad;
      pos[i * 3 + 1] = h;
      pos[i * 3 + 2] = Math.sin(a) * rad;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const stars = new THREE.Points(g, new THREE.PointsMaterial({
      color: 0xfff0d0, size: 1.3, transparent: true, opacity: .7, depthWrite: false, fog: false
    }));
    group.add(stars);
  }

  const minimap = samples.filter((_, i) => i % 10 === 0).map(s => ({ x: s.p.x, z: s.p.z }));

  return {
    theme, group, curve, length, samples, itemBoxes, minimap,
    half, width: theme.width,
    pointAt(s) {
      let u = (s % length + length) % length / length;
      const p = curve.getPointAt(u);
      const tan = curve.getTangentAt(u).normalize();
      const right = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
      return { p, tan, right };
    },
    dispose() {
      group.traverse(o => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          for (const m of mats) { if (m.map && !m.map.userData.shared) m.map.dispose(); m.dispose(); }
        }
      });
      scene.remove(group);
    }
  };
}

let _sprite = null;
export function spriteTex() {
  if (_sprite) return _sprite;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(.18, 'rgba(255,245,215,.9)');
  grd.addColorStop(.55, 'rgba(255,220,150,.18)');
  grd.addColorStop(1, 'rgba(255,200,120,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  _sprite = new THREE.CanvasTexture(c);
  _sprite.colorSpace = THREE.SRGBColorSpace;
  _sprite.userData.shared = true;
  return _sprite;
}

export function disposeWorld(world) {
  if (!world) return;
  disposeGroup(world.group);
}
