// Articulated low-poly rigs: joints solved in character space (+Z forward, +Y up, right hand at -X),
// limbs rendered as boxes between joint points, arms/legs via analytic two-bone IK to hand/foot targets.
// Per skill characters-animation.md: poses specify hand targets & sword direction, never raw joint angles.
import * as THREE from '../vendor/three.module.min.js';

export const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const lerp = (a, b, w) => a + (b - a) * w;
const arrLerp = (a, b, w) => [lerp(a[0], b[0], w), lerp(a[1], b[1], w), lerp(a[2], b[2], w)];
function slerpDir(a, b, w) {
  const A = V(...a).normalize(), B = V(...b).normalize();
  let out;
  if (A.dot(B) > .999) out = A.clone().lerp(B, w).normalize();
  else { const q = new THREE.Quaternion().setFromUnitVectors(A, B), qi = new THREE.Quaternion().identity().slerp(q, w); out = A.clone().applyQuaternion(qi); }
  return [out.x, out.y, out.z];   // poses keep every field as a plain array
}

function solve2(S, T, u, f, hint, outE) {
  // two-bone IK: elbow/knee point (outE), clamped to reach
  const D = T.clone().sub(S); let d = D.length();
  const min = Math.abs(u - f) + .02, max = u + f - .02;
  d = Math.max(min, Math.min(max, d)); if (D.length() > 1e-6) D.setLength(d); else D.set(0, 0, d);
  const cosS = Math.max(-1, Math.min(1, (u * u + d * d - f * f) / (2 * u * d)));
  const sinS = Math.sqrt(Math.max(0, 1 - cosS * cosS));
  const dir = D.clone().normalize();
  let h = hint.clone().sub(dir.clone().multiplyScalar(hint.dot(dir)));
  if (h.lengthSq() < 1e-6) h.set(0, 0, -1);
  h.normalize();
  outE.copy(S).addScaledVector(dir, cosS * u).addScaledVector(h, sinS * u);
  return outE;
}

// place a limb box between two joint points
function place(so, A, B) {
  const mid = A.clone().add(B).multiplyScalar(.5), d = B.clone().sub(A), L = Math.max(.02, d.length());
  so.mesh.position.copy(mid);
  so.mesh.quaternion.setFromUnitVectors(V(0, 0, 1), d.clone().normalize());
  so.mesh.scale.set(1, 1, L);
}

export function makeRig(cfg) {
  // cfg: {scale, colors:{cloth, trim, skin}, weapon:'sword'|'staff'|'cleaver'|null, thick}
  const s = cfg.scale || 1, th = (cfg.thick || .1) * s;
  const mat = (c, e = 0x000000, ei = 0) => {
    const m = new THREE.MeshStandardMaterial({ color: c, roughness: .8, flatShading: true, emissive: e, emissiveIntensity: ei, metalness: .12 });
    m.userData.baseE = e; m.userData.baseEI = ei; return m;
  };
  const mats = { cloth: mat(cfg.colors.cloth), trim: mat(cfg.colors.trim), skin: mat(cfg.colors.skin || 0x9c8873) };
  const grp = new THREE.Group();
  const seg = (w, m) => { const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, w, 1), m); mesh.castShadow = true; grp.add(mesh); return { mesh }; };
  const joint = (r, m) => { const j = new THREE.Mesh(new THREE.SphereGeometry(r, 6, 5), m); j.castShadow = true; grp.add(j); return j; };
  const torso = new THREE.Mesh(new THREE.BoxGeometry(th * 2.6, th * 3.4, th * 1.7), mats.cloth); torso.castShadow = true; grp.add(torso);
  const skirt = new THREE.Mesh(new THREE.ConeGeometry(th * 2.2, th * 2.8, 7), mats.trim); skirt.castShadow = true; grp.add(skirt);
  const head = new THREE.Mesh(new THREE.BoxGeometry(th * 1.5, th * 1.5, th * 1.5), mats.skin); head.castShadow = true; grp.add(head);
  const hat = new THREE.Mesh(new THREE.ConeGeometry(th * 1.55, th * 1.8, 7), mats.trim); hat.castShadow = true; grp.add(hat);
  const aU = seg(th * 1.5, mats.cloth), aF = seg(th * 1.25, mats.skin);
  const bU = seg(th * 1.5, mats.cloth), bF = seg(th * 1.25, mats.skin);
  const lU = seg(th * 1.7, mats.trim), lF = seg(th * 1.45, mats.trim);
  const rU = seg(th * 1.7, mats.trim), rF = seg(th * 1.45, mats.trim);
  const shL = joint(th * .8, mats.trim), shR = joint(th * .8, mats.trim);
  const handL = joint(th * .62, mats.skin), handR = joint(th * .62, mats.skin);
  const footL = joint(th * .62, mats.trim), footR = joint(th * .62, mats.trim);
  const wpn = new THREE.Group(); grp.add(wpn);
  const pulse = [];
  if (cfg.weapon === 'sword') {
    const bm = new THREE.MeshStandardMaterial({ color: 0xcfd6e4, roughness: .25, metalness: .85, flatShading: true, emissive: 0x8fd8ff, emissiveIntensity: .3 });
    bm.userData.baseE = 0x8fd8ff; bm.userData.baseEI = .3; pulse.push(bm);
    const bl = new THREE.Mesh(new THREE.BoxGeometry(th * .6, 1.05 * s, th * .18), bm); bl.position.y = .55 * s; bl.castShadow = true; wpn.add(bl);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(th * .32, .4 * s, 4), bm); tip.position.y = 1.22 * s; wpn.add(tip);
    const gu = new THREE.Mesh(new THREE.BoxGeometry(th * 1.7, th * .24, th * .34), mat(0x8a7448)); gu.position.y = 0; wpn.add(gu);
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(th * .15, th * .15, th * .9, 6), mat(0x2c2620)); grip.position.y = -th * .5; wpn.add(grip);
    const pom = new THREE.Mesh(new THREE.SphereGeometry(th * .22, 6, 5), mat(0x8a7448)); pom.position.y = -th * 1.0; wpn.add(pom);
  } else if (cfg.weapon === 'staff') {
    const st = new THREE.Mesh(new THREE.CylinderGeometry(th * .14, th * .18, 1.6 * s, 6), mat(0x4a3d30)); st.position.y = .5 * s; st.castShadow = true; wpn.add(st);
    const om = new THREE.MeshStandardMaterial({ color: 0x9fe8d8, emissive: 0x3fd8b8, emissiveIntensity: 2.4, roughness: .3 });
    om.userData.baseE = 0x3fd8b8; om.userData.baseEI = 2.4; pulse.push(om);
    const orb = new THREE.Mesh(new THREE.SphereGeometry(th * .5, 8, 6), om); orb.position.y = 1.45 * s; wpn.add(orb);
    wpn.userData.orb = orb;
  } else if (cfg.weapon === 'cleaver') {
    const bm = new THREE.MeshStandardMaterial({ color: 0x9aa2b2, roughness: .4, metalness: .7, flatShading: true });
    bm.userData.baseE = 0x000000; bm.userData.baseEI = 0; pulse.push(bm);
    const bl = new THREE.Mesh(new THREE.BoxGeometry(th * .2, .8 * s, th * 1.1), bm); bl.position.set(0, .45 * s, th * .4); bl.castShadow = true; wpn.add(bl);
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(th * .15, th * .15, th * 1.0, 6), mat(0x33291f)); wpn.add(grip);
  }
  return {
    grp, scale: s, th, cfg, mats, pulse,
    armLen: { u: .62 * s, f: .54 * s }, legLen: { u: .58 * s, f: .5 * s },
    segs: { torso, skirt, head, hat, aU, aF, bU, bF, lU, lF, rU, rF, shL, shR, handL, handR, footL, footR },
    wpn, flashT: 0, flashV: 0,
    flash(v = 1) { this.flashT = .12; this.flashV = v; },
    updateFlash(dt) {
      if (this.flashT > 0) {
        this.flashT -= dt;
        for (const m of Object.values(this.mats)) { m.emissive.setHex(0xff5040); m.emissiveIntensity = this.flashV * 1.8; }
        for (const m of this.pulse) { m.emissive.setHex(0xff5040); m.emissiveIntensity = this.flashV * 1.8; }
      } else {
        for (const m of Object.values(this.mats)) { m.emissive.setHex(m.userData.baseE); m.emissiveIntensity = m.userData.baseEI; }
        for (const m of this.pulse) { m.emissive.setHex(m.userData.baseE); m.emissiveIntensity = m.userData.baseEI; }
      }
    }
  };
}

// pose: hip = hips center (char space abs); neck/head/handL/handR = offsets RELATIVE hip;
// footL/footR = [x,z] relative ROOT on ground; liftL/liftR = foot height; hint* = elbow bend dirs; hipYaw = torso twist.
export function basePose(scale = 1) {
  const s = scale;
  return {
    hip: [0, .95 * s, 0], neck: [0, .52 * s, .02], head: [0, .16 * s, .05],
    handR: [-.42 * s, -.48 * s, .3 * s], handL: [.3 * s, -.58 * s, .12 * s],
    hintR: [-.6, -1, -.3], hintL: [.6, -1, -.3],
    footL: [.34 * s, -.12 * s], footR: [-.3 * s, .14 * s], liftL: 0, liftR: 0,
    swordDir: [-.55, .75, .55], hipYaw: 0
  };
}
export const POSE_KEYS = ['hip', 'neck', 'head', 'handR', 'handL', 'hintR', 'hintL', 'footL', 'footR'];

export function applyPose(rig, pose, worldPos, facing, dt = 0) {
  const s = rig.scale;
  const rotY = (p, ang = facing) => V(p[0], p[1], p[2]).applyAxisAngle(V(0, 1, 0), ang);
  const hip = worldPos.clone().add(rotY(pose.hip));
  const neck = hip.clone().add(rotY(pose.neck, facing + (pose.hipYaw || 0)));
  const S = rig.segs, th = rig.th;
  S.torso.position.copy(hip.clone().lerp(neck, .55));
  S.torso.quaternion.setFromUnitVectors(V(0, 1, 0), neck.clone().sub(hip).normalize());
  S.skirt.position.copy(hip).add(V(0, -th * .5, 0));
  S.skirt.quaternion.copy(S.torso.quaternion); S.skirt.rotateX(Math.PI);
  const headP = neck.clone().add(rotY(pose.head, facing + (pose.hipYaw || 0)));
  S.head.position.copy(headP);
  S.hat.position.copy(headP).add(V(0, th * 1.05, 0)); S.hat.rotation.set(0, facing, 0);
  const side = V(Math.cos(facing), 0, -Math.sin(facing)); // char +X (left) in world
  const shLp = neck.clone().addScaledVector(side, th * 1.5);
  const shRp = neck.clone().addScaledVector(side, -th * 1.5);
  S.shL.position.copy(shLp); S.shR.position.copy(shRp);
  const tmpE = V();
  const tgtL = hip.clone().add(rotY(pose.handL)), tgtR = hip.clone().add(rotY(pose.handR));
  const hintL = rotY(pose.hintL), hintR = rotY(pose.hintR);
  solve2(shLp, tgtL, rig.armLen.u, rig.armLen.f, hintL, tmpE);
  place(S.aU, shLp, tmpE); place(S.aF, tmpE, tgtL); S.handL.position.copy(tgtL);
  solve2(shRp, tgtR, rig.armLen.u, rig.armLen.f, hintR, tmpE);
  place(S.bU, shRp, tmpE); place(S.bF, tmpE, tgtR); S.handR.position.copy(tgtR);
  const hipL = hip.clone().addScaledVector(side, th * .8).add(V(0, -th * .2, 0));
  const hipR = hip.clone().addScaledVector(side, -th * .8).add(V(0, -th * .2, 0));
  const fl = worldPos.clone().add(rotY([pose.footL[0], 0, pose.footL[1]])); fl.y = (pose.liftL || 0) * s;
  const fr = worldPos.clone().add(rotY([pose.footR[0], 0, pose.footR[1]])); fr.y = (pose.liftR || 0) * s;
  const kH = rotY([0, -1, .8]);
  solve2(hipL, fl, rig.legLen.u, rig.legLen.f, kH, tmpE);
  place(S.lU, hipL, tmpE); place(S.lF, tmpE, fl); S.footL.position.copy(fl);
  solve2(hipR, fr, rig.legLen.u, rig.legLen.f, kH, tmpE);
  place(S.rU, hipR, tmpE); place(S.rF, tmpE, fr); S.footR.position.copy(fr);
  if (rig.cfg.weapon === 'sword' || rig.cfg.weapon === 'staff' || rig.cfg.weapon === 'cleaver') {
    rig.wpn.position.copy(tgtR);
    const wd = rotY(pose.swordDir);
    rig.wpn.quaternion.setFromUnitVectors(V(0, 1, 0), wd.normalize());
  }
  if (dt) rig.updateFlash(dt);
}

// --- clips: keyframed pose sequences. Strikes follow the 5-beat rule (windup -> antic hold -> strike(quad-out) -> overshoot -> return) ---
export function clip(keys, dur, opts = {}) { return { keys, dur, loop: !!opts.loop, hitFrom: opts.hitFrom ?? -1, hitTo: opts.hitTo ?? -1 }; }
function ease(w) { return w >= 1 ? 1 : 1 - (1 - w) * (1 - w); }
export function samplePose(cl, t, out) {
  const ks = cl.keys, n = ks.length;
  let a = ks[0], b = ks[n - 1];
  for (let i = 0; i < n - 1; i++) { if (t >= ks[i].t && t <= ks[i + 1].t) { a = ks[i]; b = ks[i + 1]; break; } }
  const w = Math.max(0, Math.min(1, b.t > a.t ? (t - a.t) / (b.t - a.t) : 1)), e = ease(w);
  const A = a.p, B = b.p;
  for (const k of POSE_KEYS) out[k] = arrLerp(A[k], B[k], e);
  out.liftL = lerp(A.liftL || 0, B.liftL || 0, e); out.liftR = lerp(A.liftR || 0, B.liftR || 0, e);
  out.hipYaw = lerp(A.hipYaw || 0, B.hipYaw || 0, e);
  out.swordDir = slerpDir(A.swordDir, B.swordDir, w);
  return out;
}
export function blendPose(A, B, w, out) {
  for (const k of POSE_KEYS) out[k] = arrLerp(A[k], B[k], w);
  out.liftL = lerp(A.liftL || 0, B.liftL || 0, w); out.liftR = lerp(A.liftR || 0, B.liftR || 0, w);
  out.hipYaw = lerp(A.hipYaw || 0, B.hipYaw || 0, w);
  out.swordDir = slerpDir(A.swordDir, B.swordDir, w);
  return out;
}

// walk cycle generator (procedural, not keyframed): phase 0..1
export function walkPose(phase, speed, bp, out, s) {
  const p2 = Math.PI * 2 * phase, sw = Math.sin(p2), cw = Math.cos(p2);
  const stride = .42 * s * Math.min(1, speed / 4);
  out.hip = [0, (.95 + Math.abs(cw) * .035) * s, 0];
  out.footL = [.34 * s + sw * stride, -.12 * s]; out.liftL = Math.max(0, sw) * .16;
  out.footR = [-.3 * s - sw * stride, .14 * s]; out.liftR = Math.max(0, -sw) * .16;
  out.handL = [.3 * s, -.55 * s - sw * .08 * s, .1 * s];
  out.hipYaw = sw * .12;
  return out;
}
