// Swarms: player + AI snakes on a shared path-following body model.
// One InstancedMesh renders every segment (capacity 1600) with per-instance
// colors; heads are individual meshes with eyes. Segments follow a stored
// head-path with fixed arc spacing.

import * as THREE from '../vendor/three.module.min.js';

const SEG_GAP = .62;          // arc distance between segments
export const HEAD_R = .85;    // head radius (scale grows with length)
const BASE_SPEED = 9.5, BOOST_SPEED = 17.5;
const TURN_RATE = 3.4;        // rad/s
const BOOST_DRAIN = 2.2;      // segments per second

let uid = 0;

export function makeSnakePool(scene, matStd) {
  const CAP = 1600;
  const inst = new THREE.InstancedMesh(
    new THREE.SphereGeometry(.55, 10, 8),
    new THREE.MeshStandardMaterial({ roughness: .55, metalness: .05 }),
    CAP);
  inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  inst.count = 0;
  inst.castShadow = false;
  scene.add(inst);
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();

  const snakes = [];          // active snakes
  const headProto = () => {
    const g = new THREE.Group();
    const head = new THREE.Mesh(new THREE.SphereGeometry(HEAD_R, 12, 10), matStd(0xffffff, { rough: .4 }));
    const eye1 = new THREE.Mesh(new THREE.SphereGeometry(.22, 8, 6), matStd(0x111111));
    const eye2 = eye1.clone();
    eye1.position.set(-.34, .3, -.62); eye2.position.set(.34, .3, -.62);
    const crown = new THREE.Mesh(new THREE.ConeGeometry(.3, .5, 6), matStd(0xffd166, { emissive: 0xd9a018, ei: .9 }));
    crown.position.y = .95;
    g.add(head, eye1, eye2, crown);
    return g;
  };

  function spawn({ x, z, angle, color: col, isPlayer = false, name = 'bot', personality = 'glutton', length = 3 }) {
    const head = headProto();
    head.children[0].material.color.set(col);
    if (!isPlayer) head.children[3].visible = false;
    scene.add(head);
    const s = {
      id: uid++, isPlayer, name, personality, col: new THREE.Color(col),
      x, z, angle, targetAngle: angle,
      len: length, growth: 0,                 // pending segments (fractional)
      speed: BASE_SPEED, boosting: false,
      path: [],                               // recent head positions [{x,z}]
      alive: true, protT: isPlayer ? 3 : 0,   // spawn protection
      head, kills: 0, stings: 0,
      aiT: 0, aiTarget: { x, z },
    };
    for (let i = 0; i < length; i++) s.path.push({ x: x - Math.cos(angle) * i * SEG_GAP, z: z - Math.sin(angle) * i * SEG_GAP });
    snakes.push(s);
    return s;
  }

  function remove(s) {
    s.alive = false;
    scene.remove(s.head);
    const i = snakes.indexOf(s);
    if (i >= 0) snakes.splice(i, 1);
  }

  function updateSnake(s, dt, time) {
    // turn toward target angle with rate limit
    let da = s.targetAngle - s.angle;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    const maxTurn = TURN_RATE * dt * (s.boosting ? .82 : 1);
    s.angle += Math.max(-maxTurn, Math.min(maxTurn, da));
    // speed
    s.speed = s.boosting ? BOOST_SPEED : BASE_SPEED;
    if (s.boosting) {
      s.growth -= BOOST_DRAIN * dt;
      while (s.growth <= -1 && s.len > 2) { s.growth += 1; s.len--; if (s.dropOrb) s.dropOrb(s); }
      if (s.len <= 2) s.boosting = false;
    }
    s.x += Math.cos(s.angle) * s.speed * dt;
    s.z += Math.sin(s.angle) * s.speed * dt;
    // path history (front of array = head)
    const dx = s.x - s.path[0].x, dz = s.z - s.path[0].z;
    if (dx * dx + dz * dz >= SEG_GAP * SEG_GAP) {
      s.path.unshift({ x: s.x, z: s.z });
      const need = s.len;
      while (s.path.length > need + 30) s.path.pop();
    }
    if (s.protT > 0) s.protT = Math.max(0, s.protT - dt);
    // head visuals
    const scale = 1 + Math.min(1.6, (s.len - 3) * .012);
    s.head.position.set(s.x, HEAD_R * scale, s.z);
    s.head.rotation.y = -s.angle;
    s.head.scale.setScalar(scale);
    if (!s.isPlayer) s.head.children[3].visible = false;
    s.head.children[0].material.emissiveIntensity = s.protT > 0 ? .8 : .05;
    // blink while protected
    s.head.visible = s.protT > 0 ? (Math.sin(time * 14) > -.4) : true;
  }

  function renderInstances(time) {
    let n = 0;
    for (const s of snakes) {
      const scale = 1 + Math.min(1.6, (s.len - 3) * .012);
      for (let i = 0; i < s.path.length && n < CAP; i++) {
        const p = s.path[i];
        dummy.position.set(p.x, HEAD_R * scale * .82, p.z);
        const r = .55 * scale * (1 - Math.min(.4, i / (s.len * 1.4)));
        dummy.scale.setScalar(r / .55);
        dummy.updateMatrix();
        inst.setMatrixAt(n, dummy.matrix);
        color.copy(s.col).offsetHSL(0, 0, -(i % 2) * .08);
        inst.setColorAt(n, color);
        n++;
      }
    }
    inst.count = n;
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
  }

  return { snakes, spawn, remove, updateSnake, renderInstances, CAP, SEG_GAP };
}
