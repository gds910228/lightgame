// Projectiles (homing bolt/shard, ballistic mortar shell, prism beam, totem chain
// lightning), impact rings, sparks, meteors, leak flashes. All pooled-per-call,
// removed on completion. peak colors kept ≤2.5 for the two-pass bloom.
import * as THREE from '../vendor/three.module.min.js';
import { glowTex, streakTex, rngSeed } from './assets.js';

export function makeFX(scene) {
  const glowT = glowTex(), streakT = streakTex(), R = rngSeed(97);
  const projs = [], zaps = [], rings = [], sparks = [], meteors = [], flashes = [];
  const beams = new Map();
  const group = new THREE.Group(); scene.add(group);

  const streakMat = (color, op = 1) => new THREE.MeshBasicMaterial({ map: streakT, color, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false });
  const glowSprite = (color, s, op) => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowT, color, transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending }));
    sp.scale.set(s, s, 1); return sp;
  };

  function bolt(from, target, color, speed, onHit) {
    const g = new THREE.Group();
    const m = new THREE.Mesh(new THREE.BoxGeometry(.85, .07, .07), streakMat(color));
    g.add(m);
    g.add(glowSprite(color, .5, .9));
    g.position.copy(from);
    group.add(g);
    projs.push({ kind: 'homing', mesh: g, from: from.clone(), target, color, speed, t: 0, onHit });
  }

  function shard(from, target, color, speed, onHit) {
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(.17, 0), new THREE.MeshBasicMaterial({ color }));
    m.position.copy(from); group.add(m);
    const tr = glowSprite(color, .8, .7); m.add(tr);
    projs.push({ kind: 'homing', mesh: m, from: from.clone(), target, color, speed, t: 0, onHit });
  }

  function shell(from, to, color, flight, onLand) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(.2, 8, 6), new THREE.MeshBasicMaterial({ color }));
    m.position.copy(from); group.add(m);
    m.add(glowSprite(color, .9, .8));
    projs.push({ kind: 'ballistic', mesh: m, from: from.clone(), to: to.clone(), t: 0, dur: flight, h: 2.6, onLand, color });
  }

  function zap(points, color) {
    const pos = [];
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i], b = points[i + 1], seg = 6;
      for (let k = 0; k <= seg; k++) {
        const f = k / seg;
        const j = k === 0 || k === seg ? 0 : (R() - .5) * .5;
        const nx = (b.z - a.z), nz = -(b.x - a.x); const L = Math.hypot(nx, nz) || 1;
        pos.push(a.x + (b.x - a.x) * f + nx / L * j, a.y + (b.y - a.y) * f + j, a.z + (b.z - a.z) * f + nz / L * j);
      }
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false }));
    group.add(line);
    zaps.push({ line, life: .16 });
  }

  function beam(id, from, to, color) {
    let b = beams.get(id);
    if (!b) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(1, .1, .1), streakMat(color, .85));
      const g = new THREE.Group(); g.add(m); g.add(glowSprite(color, .8, .9));
      group.add(g); b = { g, m }; beams.set(id, b);
    }
    const mid = new THREE.Vector3().lerpVectors(from, to, .5);
    b.g.position.copy(mid);
    const d = new THREE.Vector3().subVectors(to, from), len = Math.max(.01, d.length());
    b.m.scale.set(len, 1, 1);
    b.m.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), d.normalize());
    b.m.material.opacity = .6 + Math.sin(performance.now() * .04) * .2;
    b.on = true;
  }
  function beamEnd(id) {
    const b = beams.get(id);
    if (b) { group.remove(b.g); b.m.material.dispose(); beams.delete(id); }
  }

  function ring(pos, color, r1 = 2, life = .45, axis = 'y') {
    const m = new THREE.Mesh(new THREE.RingGeometry(.85, 1, 28), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .9, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.position.copy(pos); m.position.y += .06;
    if (axis !== 'y') m.rotation.set(axis === 'x' ? Math.PI / 2 : 0, 0, axis === 'z' ? Math.PI / 2 : 0);
    else m.rotation.x = -Math.PI / 2;
    group.add(m);
    rings.push({ m, t: 0, life, r1, y: pos.y });
  }

  function burst(pos, color, n = 14, spread = 2.6, up = 1.6) {
    const g = new THREE.BufferGeometry(), posA = [], vel = [];
    for (let i = 0; i < n; i++) {
      posA.push(pos.x, pos.y, pos.z);
      const a = R() * Math.PI * 2, e = R() * Math.PI - Math.PI / 2, s = spread * (.4 + R() * .6);
      vel.push(Math.cos(a) * Math.cos(e) * s, Math.abs(Math.sin(e)) * s * up * .8 + .5, Math.sin(a) * Math.cos(e) * s);
    }
    g.setAttribute('position', new THREE.Float32BufferAttribute(posA, 3));
    const pts = new THREE.Points(g, new THREE.PointsMaterial({ color, size: .12, map: glowT, transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending }));
    group.add(pts);
    sparks.push({ pts, vel, t: 0, life: .5 });
  }

  function flash(pos, color, s0 = .3, s1 = 2.2, life = .3) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .8, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.position.copy(pos); m.scale.setScalar(s0);
    group.add(m); flashes.push({ m, t: 0, life, s0, s1 });
  }

  function meteor(to, onLand) {
    const from = new THREE.Vector3(to.x + 6, 11, to.z + 5);
    const m = new THREE.Mesh(new THREE.BoxGeometry(2.2, .18, .18), streakMat(0xffc878));
    m.position.copy(from);
    const d = new THREE.Vector3().subVectors(to, from).normalize();
    m.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), d);
    group.add(m); m.add(glowSprite(0xffa050, 1.4, .95));
    meteors.push({ mesh: m, from, to: to.clone(), t: 0, dur: .75, onLand });
  }

  function update(dt) {
    for (let i = projs.length - 1; i >= 0; i--) {
      const p = projs[i];
      if (p.kind === 'homing') {
        const alive = p.target && p.target.alive;
        const dest = alive ? p.target.pos(true) : p.last || p.from;
        if (alive) p.last = p.target.pos(true).clone();
        const d = new THREE.Vector3().subVectors(dest, p.mesh.position);
        const step = p.speed * dt;
        if (d.length() <= step + .22) {
          if (p.onHit && alive) p.onHit(p.target, dest);
          group.remove(p.mesh); projs.splice(i, 1); continue;
        }
        d.normalize(); p.mesh.position.addScaledVector(d, step);
        p.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), d);
      } else {
        p.t += dt / p.dur;
        if (p.t >= 1) {
          if (p.onLand) p.onLand(p.to);
          group.remove(p.mesh); projs.splice(i, 1); continue;
        }
        p.mesh.position.lerpVectors(p.from, p.to, p.t);
        p.mesh.position.y += Math.sin(p.t * Math.PI) * p.h;
      }
    }
    for (let i = zaps.length - 1; i >= 0; i--) {
      const z = zaps[i]; z.life -= dt; z.line.material.opacity = Math.max(0, z.life / .16);
      if (z.life <= 0) { group.remove(z.line); z.line.geometry.dispose(); zaps.splice(i, 1); }
    }
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i]; r.t += dt / r.life;
      const f = r.t;
      r.m.scale.setScalar(.3 + f * r.r1);
      r.m.material.opacity = .9 * (1 - f);
      if (f >= 1) { group.remove(r.m); r.m.geometry.dispose(); rings.splice(i, 1); }
    }
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i]; s.t += dt / s.life;
      const pa = s.pts.geometry.attributes.position;
      for (let k = 0; k < s.vel.length / 3; k++) {
        s.vel[k * 3 + 1] -= 6 * dt;
        pa.setXYZ(k, pa.getX(k) + s.vel[k * 3] * dt, Math.max(.05, pa.getY(k) + s.vel[k * 3 + 1] * dt), pa.getZ(k) + s.vel[k * 3 + 2] * dt);
      }
      pa.needsUpdate = true;
      s.pts.material.opacity = 1 - s.t;
      if (s.t >= 1) { group.remove(s.pts); s.pts.geometry.dispose(); sparks.splice(i, 1); }
    }
    for (let i = flashes.length - 1; i >= 0; i--) {
      const f = flashes[i]; f.t += dt / f.life;
      f.m.scale.setScalar(f.s0 + (f.s1 - f.s0) * f.t);
      f.m.material.opacity = .8 * (1 - f.t);
      if (f.t >= 1) { group.remove(f.m); f.m.geometry.dispose(); flashes.splice(i, 1); }
    }
    for (let i = meteors.length - 1; i >= 0; i--) {
      const m = meteors[i]; m.t += dt / m.dur;
      if (m.t >= 1) {
        if (m.onLand) m.onLand(m.to);
        group.remove(m.mesh); meteors.splice(i, 1); continue;
      }
      m.mesh.position.lerpVectors(m.from, m.to, m.t);
    }
    // hide beams flagged off this frame
    for (const [id, b] of beams) if (!b.on) beamEnd(id); else b.on = false;
  }

  function clear() {
    for (const p of projs) group.remove(p.mesh);
    for (const z of zaps) { group.remove(z.line); z.line.geometry.dispose(); }
    for (const r of rings) { group.remove(r.m); r.m.geometry.dispose(); }
    for (const s of sparks) { group.remove(s.pts); s.pts.geometry.dispose(); }
    for (const f of flashes) { group.remove(f.m); f.m.geometry.dispose(); }
    for (const m of meteors) group.remove(m.mesh);
    for (const id of [...beams.keys()]) beamEnd(id);
    projs.length = zaps.length = rings.length = sparks.length = flashes.length = meteors.length = 0;
  }

  return { bolt, shard, shell, zap, beam, beamEnd, ring, burst, flash, meteor, update, clear, count: () => projs.length + zaps.length + rings.length + sparks.length + flashes.length + meteors.length + beams.size };
}
