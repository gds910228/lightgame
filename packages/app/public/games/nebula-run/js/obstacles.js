// Obstacles, coins and multiplier gates — pooled, world moves +z past the
// fixed player. Types: rock (jump/switch), beam (slide), wall (must switch),
// coin patterns, tri-color multiplier gates.
import * as THREE from '../vendor/three.module.min.js';

const SPAWN_Z = -95, RECYCLE_Z = 14;

export function makeObstacles(scene, matStd) {
  const pool = { rock: [], beam: [], wall: [], coin: [], gate: [] };
  const active = { rock: [], beam: [], wall: [], coin: [], gate: [] };

  function makeMesh(kind) {
    if (kind === 'rock') {
      const m = new THREE.Mesh(new THREE.DodecahedronGeometry(1.05, 0), matStd(0x4a4470, { rough: .85, flat: true }));
      const glow = new THREE.Mesh(new THREE.DodecahedronGeometry(.55, 0), matStd(0xff8a5c, { emissive: 0xe8704a, ei: 1.3 }));
      glow.position.y = .3; m.add(glow);
      return m;
    }
    if (kind === 'beam') {
      const g = new THREE.Group();
      const bar = new THREE.Mesh(new THREE.BoxGeometry(2.6, .5, .5), matStd(0xe84a6c, { emissive: 0xe8406c, ei: 1.4 }));
      bar.position.y = 1.7;
      const post1 = new THREE.Mesh(new THREE.BoxGeometry(.22, 1.75, .22), matStd(0x3a3360));
      post1.position.set(-1.25, .87, 0);
      const post2 = post1.clone(); post2.position.x = 1.25;
      const warn = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.15, .12),
        new THREE.MeshBasicMaterial({ color: 0xe8406c, transparent: true, opacity: .12 }));
      warn.position.set(0, 1.15, 0);
      g.add(bar, post1, post2, warn);
      return g;
    }
    if (kind === 'wall') {
      const g = new THREE.Group();
      const w = new THREE.Mesh(new THREE.BoxGeometry(2.9, 3.2, .6), matStd(0x5a3070, { rough: .6 }));
      w.position.y = 1.6;
      const strip = new THREE.Mesh(new THREE.BoxGeometry(2.9, .3, .66), matStd(0xff4040, { emissive: 0xff3030, ei: 2 }));
      strip.position.y = 3.05;
      const warn = new THREE.Mesh(new THREE.BoxGeometry(2.9, 3.2, .1),
        new THREE.MeshBasicMaterial({ color: 0xff4040, transparent: true, opacity: .18 }));
      warn.position.set(0, 1.6, -.36);
      g.add(w, strip, warn);
      return g;
    }
    if (kind === 'coin') {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(.42, .42, .1, 14), matStd(0xffd166, { emissive: 0xffb830, ei: 1.6, metal: .5, rough: .3 }));
      m.rotation.x = Math.PI / 2;
      return m;
    }
    // gate: tri-lane rings
    const g = new THREE.Group();
    const colors = [0x4a9af0, 0xffc830, 0xb060ff];      // ×2 blue, ×3 gold, ×5 purple
    const vals = [2, 3, 5];
    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.25, .16, 8, 22), matStd(colors[i], { emissive: colors[i], ei: 1.8 }));
      ring.position.set([-3, 0, 3][i], 1.5, 0);
      g.add(ring);
    }
    g.userData.vals = vals; g.userData.rings = g.children;
    return g;
  }

  function get(kind) {
    let m = pool[kind].pop();
    if (!m) m = makeMesh(kind);
    scene.add(m);
    active[kind].push(m);
    return m;
  }

  function spawnRock(z, lane, wide = false) {
    const m = get('rock');
    m.position.set([-3, 0, 3][lane], .95, z);
    m.rotation.set(Math.random() * 3, Math.random() * 3, 0);
    m.scale.set(wide ? 1.5 : 1, wide ? .85 : 1, 1);
    m.userData = { kind: 'rock', lane, wide, crossed: false, halfW: wide ? 1.45 : .85, y0: .1, y1: 1.95, halfD: .9 };
    return m;
  }
  function spawnBeam(z, lane) {
    const m = get('beam');
    m.position.set([-3, 0, 3][lane], 0, z);
    m.userData = { kind: 'beam', lane, crossed: false, halfW: 1.5, y0: 1.15, y1: 2.4, halfD: .45 };
    return m;
  }
  function spawnWall(z, lane) {
    const m = get('wall');
    m.position.set([-3, 0, 3][lane], 0, z);
    m.userData = { kind: 'wall', lane, crossed: false, halfW: 1.5, y0: 0, y1: 3.2, halfD: .4, warned: false };
    return m;
  }
  function spawnCoin(z, lane, y = 1.1) {
    const m = get('coin');
    m.position.set([-3, 0, 3][lane], y, z);
    m.userData = { kind: 'coin', lane, taken: false, baseY: y, ph: Math.random() * 6 };
    return m;
  }
  function spawnGate(z) {
    const m = get('gate');
    m.position.set(0, 0, z);
    m.userData = { kind: 'gate', crossed: false };
    return m;
  }

  // pattern helpers
  function coinLine(z, lane, n = 6, gap = 2.2) {
    for (let i = 0; i < n; i++) spawnCoin(z - i * gap, lane);
  }
  function coinArc(z, lane, n = 7) {
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      spawnCoin(z - t * 9, lane, 1.1 + Math.sin(t * Math.PI) * 2.4);
    }
  }
  function coinZig(z, n = 8) {
    for (let i = 0; i < n; i++) spawnCoin(z - i * 2.6, [0, 1, 2][i % 3], 1.1);
  }

  function update(dt, speed, time) {
    for (const kind of Object.keys(active)) {
      const arr = active[kind];
      for (let i = arr.length - 1; i >= 0; i--) {
        const m = arr[i];
        m.position.z += speed * dt;
        if (kind === 'coin') {
          m.rotation.z += dt * 4;
          m.position.y = m.userData.baseY + Math.sin(time * 3 + m.userData.ph) * .12;
        }
        if (kind === 'rock') m.rotation.y += dt * .8;
        if (m.position.z > RECYCLE_Z) {
          scene.remove(m);
          arr.splice(i, 1);
          pool[kind].push(m);
        }
      }
    }
  }

  function clearAll() {
    for (const kind of Object.keys(active)) {
      for (const m of active[kind]) { scene.remove(m); pool[kind].push(m); }
      active[kind].length = 0;
    }
  }

  return { active, pool, spawnRock, spawnBeam, spawnWall, spawnCoin, spawnGate, coinLine, coinArc, coinZig, update, clearAll, SPAWN_Z, RECYCLE_Z };
}
