// Player: lane runner — lane lerp, variable jump (hold to soar), slide,
// one-layer shield with 2s invulnerability blink, AABB hitbox.
import * as THREE from '../vendor/three.module.min.js';

const GRAV = -30, JUMP_V = 13, HOLD_G = .45;   // hold gravity scale while rising & held
const LANE_LERP = 12;                           // x approach rate (exp)
const SLIDE_T = .62, INVULN_T = 2;

export function makePlayer(scene, matStd) {
  const root = new THREE.Group();
  // body: sleek capsule-ish runner
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(.42, .7, 6, 12), matStd(0x8af0c8, { emissive: 0x2ab888, ei: .9, rough: .35, metal: .3 }));
  body.position.y = .95;
  const visor = new THREE.Mesh(new THREE.BoxGeometry(.5, .22, .3), matStd(0x0b0820, { emissive: 0x7af0ff, ei: 1.6 }));
  visor.position.set(0, .32, -.34); body.add(visor);
  const shieldMesh = new THREE.Mesh(new THREE.SphereGeometry(.85, 14, 12),
    new THREE.MeshBasicMaterial({ color: 0x6fe8d8, transparent: true, opacity: .16 }));
  shieldMesh.position.y = .95; shieldMesh.visible = true;
  root.add(body, shieldMesh);
  // glow trail
  const trailGeo = new THREE.ConeGeometry(.3, 2.6, 8);
  trailGeo.rotateX(Math.PI / 2);
  const trail = new THREE.Mesh(trailGeo, new THREE.MeshBasicMaterial({ color: 0x4ad8c8, transparent: true, opacity: .4 }));
  trail.position.set(0, .95, 1.9); trail.rotation.x = Math.PI;
  root.add(trail);
  scene.add(root);

  const P = {
    lane: 1, x: 0, y: 0, vy: 0,
    jumping: false, holding: false,
    sliding: false, slideT: 0,
    shield: true, invulnT: 0,
    alive: true,
    z: 0,
  };

  function reset() {
    P.lane = 1; P.x = 0; P.y = 0; P.vy = 0; P.jumping = false; P.holding = false;
    P.sliding = false; P.slideT = 0; P.shield = true; P.invulnT = 0; P.alive = true;
  }

  function moveLane(dir) {
    const nl = Math.max(0, Math.min(2, P.lane + dir));
    if (nl !== P.lane) { P.lane = nl; return true; }
    return false;
  }
  function jump() {
    if (P.y > 0 || P.sliding) return false;
    P.vy = JUMP_V; P.jumping = true; P.holding = true; P.sliding = false; P.slideT = 0;
    return true;
  }
  function slide() {
    if (P.y > 0) return false;              // no air-slide
    P.sliding = true; P.slideT = SLIDE_T;
    return true;
  }

  function hitbox() {
    const h = P.sliding ? .9 : 1.8;
    const top = P.y + h, bottom = P.y;
    return { x: P.x, halfW: .55, bottom, top, z: P.z, halfD: .5 };
  }

  function update(dt, speed) {
    // lane lerp
    const targetX = [-3, 0, 3][P.lane];
    P.x += (targetX - P.x) * Math.min(1, LANE_LERP * dt);
    if (Math.abs(targetX - P.x) < .02) P.x = targetX;
    // jump physics (variable: low gravity while rising & held)
    if (P.y > 0 || P.vy > 0) {
      const g = (P.holding && P.vy > 0) ? GRAV * HOLD_G : GRAV;
      P.vy += g * dt; P.y += P.vy * dt;
      if (P.y <= 0) { P.y = 0; P.vy = 0; P.jumping = false; P.holding = false; }
    }
    // slide timer
    if (P.sliding) { P.slideT -= dt; if (P.slideT <= 0) P.sliding = false; }
    // invuln timer
    if (P.invulnT > 0) P.invulnT = Math.max(0, P.invulnT - dt);
    // visuals
    root.position.set(P.x, P.y, P.z);
    const tilt = (targetX - P.x) * -.12;
    body.rotation.z = tilt;
    body.scale.y = P.sliding ? .55 : 1;
    body.position.y = P.sliding ? .5 : .95;
    trail.visible = !P.sliding;
    trail.scale.set(1 + Math.min(1.4, speed / 40), 1, 1);
    shieldMesh.visible = P.shield;
    shieldMesh.material.opacity = P.invulnT > 0 ? .1 + Math.abs(Math.sin(performance.now() / 60)) * .3 : .16;
    // invuln blink on body
    body.material.transparent = true;
    body.material.opacity = P.invulnT > 0 ? .45 + Math.abs(Math.sin(performance.now() / 70)) * .55 : 1;
  }

  return { P, root, body, reset, moveLane, jump, slide, hitbox, update,
    releaseHold() { P.holding = false; },
    loseShield() { P.shield = false; P.invulnT = INVULN_T; },
    giveShield() { P.shield = true; } };
}
