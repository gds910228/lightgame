// Actors: player state machine (attack snap, hitstop, i-frames, input buffer), walker/caster AI
// (one melee attacker at a time), two-phase boss with posture/stagger, loot drops.
import * as THREE from '../vendor/three.module.min.js';
import { V, makeRig, basePose, applyPose, clip, samplePose, blendPose, walkPose, POSE_KEYS } from './rig.js';
import { resolveCollisions } from './assets.js';

const TAU = Math.PI * 2;
const angDiff = (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
const turnTo = (cur, tgt, maxStep) => { const d = angDiff(cur, tgt); return cur + Math.max(-maxStep, Math.min(maxStep, d)); };
const copyPose = (src, out) => { for (const k of POSE_KEYS) out[k] = src[k].slice(); out.liftL = src.liftL; out.liftR = src.liftR; out.hipYaw = src.hipYaw; out.swordDir = src.swordDir.slice(); return out; };

const P = (s, over) => Object.assign(basePose(s), over || {});
const stanceOf = (s) => basePose(s);

function makeHurt(s, dur = .35) {
  const b = stanceOf(s);
  return clip([
    { t: 0, p: P(s, { hip: [.06 * s, .88 * s, -.12 * s], neck: [0, .48 * s, -.08 * s], handR: [-.5 * s, -.28 * s, .05 * s], handL: [.5 * s, -.3 * s, .08 * s] }) },
    { t: dur, p: b }
  ], dur);
}
function makeDead(s) {
  const b = stanceOf(s);
  return clip([
    { t: 0, p: b },
    { t: .22, p: P(s, { hip: [.03 * s, .5 * s, -.1 * s], neck: [0, .38 * s, -.28 * s] }) },
    { t: .8, p: P(s, { hip: [0, .24 * s, 0], neck: [0, .18 * s, -.4 * s], head: [0, .08 * s, 0], handR: [-.62 * s, -.15 * s, -.2 * s], handL: [.62 * s, -.18 * s, -.22 * s], footL: [.5 * s, .4 * s], footR: [-.4 * s, .34 * s], swordDir: [-.5, .4, -.7] }) }
  ], .9);
}

let UID = 0;
export class Actor {
  constructor(ctx, cfg) {
    this.ctx = ctx; this.id = ++UID;
    this.pos = V(); this.vel = V(); this.facing = 0;
    this.radius = cfg.radius; this.hp = cfg.hp; this.maxHp = cfg.hp;
    this.team = cfg.team; this.alive = true; this.speed = cfg.speed || 3;
    this.dmgScale = 1;                       // endless-mode damage multiplier (waves scale it)
    this.hitstopT = 0; this.invulnT = 0; this.flashV = 1;
    this.anim = { type: 'idle' }; this.clipT = 0; this.fade = 0;
    this.pose = basePose(cfg.scale); this.snap = basePose(cfg.scale); this.tmp = basePose(cfg.scale);
    this.rig = makeRig(cfg.rigCfg); ctx.scene.add(this.rig.grp);
    this.scale = cfg.scale; this.dead = false; this.deadT = 0;
  }
  setClip(c) { copyPose(this.pose, this.snap); this.clip = c; this.clipT = 0; this.fade = .12; this.anim = { type: 'clip' }; }
  setWalk() { if (this.anim.type !== 'walk') { copyPose(this.pose, this.snap); this.fade = .12; this.anim = { type: 'walk' }; } }
  setIdle() { if (this.anim.type !== 'idle') { copyPose(this.pose, this.snap); this.fade = .12; this.anim = { type: 'idle' }; } }
  setFrozenPose(c) { this.clip = c; this.clipT = c.dur; this.anim = { type: 'clip' }; }
  poseStep(dt, speed) {
    const t = this.anim.type;
    if (t === 'walk') { walkPose(this.walkPhase || 0, speed, null, this.tmp, this.scale); }
    else if (t === 'idle') {
      const b = stanceOf(this.scale);
      copyPose(b, this.tmp);
      this.tmp.hip[1] += Math.sin((this.ctx.time || 0) * 2 + this.id) * .012 * this.scale;  // breathing bob
    } else {
      samplePose(this.clip, Math.min(this.clipT, this.clip.dur), this.tmp);
      if (this.clipT >= this.clip.dur && !this.clip.loop) this.anim = { type: 'hold', hold: this.clip };
    }
    if (this.fade > 0) {
      this.fade = Math.max(0, this.fade - dt);
      blendPose(this.snap, this.tmp, 1 - this.fade / .12, this.pose);
    } else copyPose(this.tmp, this.pose);
    applyPose(this.rig, this.pose, this.pos, this.facing, dt);
    if (this.hitstopT > 0) {  // victim jitters while frozen (skill: 受击方加抖动)
      this.rig.grp.position.x = (Math.random() - .5) * .06; this.rig.grp.position.z = (Math.random() - .5) * .06;
    } else this.rig.grp.position.set(0, 0, 0);
  }
  freeze(t) { this.hitstopT = Math.max(this.hitstopT, t); }
  takeHit(info) {
    if (!this.alive) return;
    const { dmg, dir, heavy } = info;
    this.hp -= dmg;
    this.rig.flash(heavy ? 1 : .7);
    this.freeze(heavy ? .11 : .07);
    this.ctx.fx.dmgNum(this.pos, Math.round(dmg), !!heavy);
    const contact = this.pos.clone().sub(dir.clone().multiplyScalar(this.radius * .6)); contact.y = 1.1;
    this.ctx.fx.sparks(contact, dir, { n: heavy ? 12 : 7, color: heavy ? 0xffe2b0 : 0xffd2a0, speed: heavy ? 8 : 6 });
    if (this.hp <= 0) { this.die(); return; }
    // knockback tiers (skill: 击退和硬直分级)
    const kb = heavy ? 5 : info.knock ?? 2.2;
    this.vel.addScaledVector(dir, kb);
    if (this.onHurt) this.onHurt(heavy);   // interrupts AI (skill: 打断)
  }
  die() {
    this.alive = false; this.dead = true; this.deadT = 0;
    this.setClip(makeDead(this.scale));
    this.ctx.onDeath && this.ctx.onDeath(this);
  }
  moveStep(dt, cols) {
    if (this.hitstopT > 0) { this.hitstopT -= dt; return; }
    this.pos.addScaledVector(this.vel, dt);
    this.vel.multiplyScalar(Math.max(0, 1 - dt * 8));
    resolveCollisions(this.pos, this.radius, cols);
  }
  update(dt) { this.clipT += dt; this.moveStep(dt, this.ctx.colliders); this.poseStep(dt, this.speed); }
}

// ---------------------------------------------------------------- player
export class Player extends Actor {
  constructor(ctx) {
    super(ctx, { radius: .42, hp: 130, speed: 5.2, scale: 1, team: 'player',
      rigCfg: { scale: 1, colors: { cloth: 0x2e3a52, trim: 0x8a94ad, skin: 0xc8a888 }, weapon: 'sword', thick: .1 } });
    this.stamina = 100; this.maxStamina = 100; this.staminaDelay = 0;
    this.state = 'idle'; this.stateT = 0;
    this.buf = null; this.bufT = 0;
    this.parryT = 0; this.guardHeld = false;
    this.counterT = 0; this.counterTarget = null;
    this.comboIdx = 0; this.comboT = 0; this.swingHits = null;
    this.dashDir = V(); this.dashIframes = false;
    this.reach = 1.95; this.arc = 1.0;
    this.hitstopCount = 0; this.execDmg = 0; this.parriedFlag = false;
    this.stepTimer = 0; this.walkPhase = 0;
    this.dashCdT = 0; this._ghost = this.hp;
    // upgrade modifiers (see UPGRADES pool in game.js); resetProgress() restores defaults
    this.mods = { dmg: 1, heavy: 1, speed: 1, lifesteal: 0, dmgTaken: 1, dashCd: 1, dashCost: 22, parryWin: 0, counterWin: 0, swordWave: 0, waveDmg: 18, stamRegen: 1, waveSkillDmg: 28, waveCdMult: 1, rainHitDmg: 12, rainMult: 1, rainR: 3.5 };
    this.upgradeCounts = {}; this.waveSpawned = false;
    this.waveCdT = 0; this.rainCdT = 0; this.castKind = null; this.castDone = false; this.rainStrikes = null;
  }
  get busy() { return ['attack', 'dash', 'exec', 'hurt'].includes(this.state) || this.hitstopT > 0; }
  press(action) {
    if (!this.alive) return;
    if (this.hitstopT > 0 || ['attack', 'exec'].includes(this.state)) { this.buf = action; this.bufT = .28; return; }  // input buffer during freeze/attack
    this.startAction(action);
  }
  startAction(action) {
    if (action === 'attack') { this.startAttack(); return; }
    if (action === 'dash') {
      const cost = this.mods.dashCost - (this.ctx.tideT > 0 ? 8 : 0);   // 灵潮: 闪避消耗 -8
      if (this.stamina < cost || this.state === 'dash') return;
      this.stamina -= cost; this.staminaDelay = .6;
      this.state = 'dash'; this.stateT = 0; this.setClip(this.dashClip()); this.dashCdT = .45 * this.mods.dashCd;
      const d = this.ctx.moveDir; this.dashDir.copy(d.lengthSq() > .01 ? d : V(Math.sin(this.facing), 0, Math.cos(this.facing)));
      this.ctx.audio.S.dash(); this.ctx.fx.dust(this.pos, { n: 4, color: 0x7f8ba0 });
      return;
    }
    if (action === 'parry') {
      if (this.state === 'dash') return;
      this.state = 'parry'; this.stateT = 0; this.parryT = .24 + this.mods.parryWin; this.guardHeld = true;
      this.setClip(this.parryClip());
      return;
    }
    if (action === 'wave') {
      if (this.waveCdT > 0 || this.state === 'dash') return;
      this.waveCdT = 5 * this.mods.waveCdMult;
      this.state = 'cast'; this.castKind = 'wave'; this.castDone = false; this.stateT = 0;
      this.setClip(this.waveCastClip());
      this.ctx.audio.S.waveCast();
      return;
    }
    if (action === 'rain') {
      if (this.rainCdT > 0 || this.state === 'dash') return;
      this.rainCdT = 9;
      this.state = 'cast'; this.castKind = 'rain'; this.castDone = false; this.rainStrikes = null; this.stateT = 0;
      this.setClip(this.rainCastClip());
      this.ctx.audio.S.rainCast();
    }
  }
  startAttack() {
    if (this.counterT > 0 && this.counterTarget && this.counterTarget.alive) { this.startExec(); return; }
    if (this.stamina < 8) return;
    this.stamina = Math.max(0, this.stamina - 8); this.staminaDelay = .5;
    // attack snap: nearest enemy by dist+angle weight (skill combat-feel)
    const E = this.ctx.enemies.filter(e => e.alive);
    let best = null, bestScore = 1e9;
    for (const e of E) {
      const to = e.pos.clone().sub(this.pos); const d = to.length();
      if (d > 5.2) continue;
      const ang = Math.abs(angDiff(this.facing, Math.atan2(to.x, to.z)));
      if (ang > 1.4) continue;
      const score = d + ang * 2;
      if (score < bestScore) { bestScore = score; best = e; }
    }
    this.snapTarget = best;
    if (best) this.facing = Math.atan2(best.pos.x - this.pos.x, best.pos.z - this.pos.z);
    // combo chain: advances only while the chain window is open, resets otherwise
    this.comboIdx = this.comboT > 0 ? (this.comboIdx + 1) % 3 : 0;
    this.comboT = 0;
    this.state = 'attack'; this.stateT = 0;
    this.curClip = this.atkClips[this.comboIdx];
    this.setClip(this.curClip);
    this.swingHits = new Set(); this.waveSpawned = false;
    this.ctx.audio.S.swing(this.comboIdx === 2);
    this.ctx.fx.slash(this.pos, this.facing, this.comboIdx === 2
      ? { span: 1.5, rOut: 2.6, rIn: .6, color: 0xcfe8ff, dur: .3, vertical: 1.25 }
      : { span: this.comboIdx === 0 ? 2.0 : 2.2, rOut: 2.3, rIn: .7, color: 0xaee6ff, dur: .22, sign: this.comboIdx === 0 ? 1 : -1 });
  }
  startExec() {
    const t = this.counterTarget;
    this.state = 'exec'; this.stateT = 0;
    this.curClip = this.execClip();
    this.setClip(this.curClip);
    if (t) t._counterMark = false;
    this.execTarget = t; this.execDone = false;
    this.facing = Math.atan2(t.pos.x - this.pos.x, t.pos.z - this.pos.z);
    this.ctx.audio.S.exec();
    this.counterT = 0; this.counterTarget = null;
  }
  receiveMelee(info) {
    // priority: dodge i-frames > invuln > parry > block > hurt (skill: 闪避优先级最高)
    if (!this.alive || this.invulnT > 0) return 'miss';
    const dashEvade = this.state === 'dash' && this.stateT > .04 && this.stateT < .28;
    if (dashEvade) { this.ctx.slowmo(.4, .25); this.stamina = Math.min(this.maxStamina, this.stamina + 12); return 'dodged'; }
    const to = info.from.pos ? info.from.pos.clone().sub(this.pos) : V(1, 0, 0);
    const ang = Math.abs(angDiff(this.facing, Math.atan2(to.x, to.z)));
    if (this.parryT > 0 && info.blockable && ang < 1.15) {
      this.parriedFlag = true;
      this.parryT = 0; this.counterT = .85 + this.mods.counterWin; this.counterTarget = info.from;
      info.from._counterMark = true;
      this.ctx.fx.counterRing(info.from);
      this.ctx.fx.burst(this.pos.clone().add(V(Math.sin(this.facing) * 1.2, 1.2, Math.cos(this.facing) * 1.2)), 0xffe9b8, { n: 12, size: 1.2, speed: 6 });
      this.ctx.audio.S.parry();
      info.from.onParried && info.from.onParried(this);
      return 'parried';
    }
    if (this.guardHeld && this.state === 'parry' && info.blockable && this.stamina > 0 && ang < 1.15) {
      const chip = info.dmg * .2 * this.mods.dmgTaken;
      this.hp -= chip; this.stamina -= info.dmg * .7; this.staminaDelay = .8;
      this.ctx.fx.sparks(this.pos.clone().add(V(Math.sin(this.facing) * 1.1, 1.1, Math.cos(this.facing) * 1.1)), info.dir, { n: 5, color: 0xbfd4ff, speed: 5 });
      this.ctx.audio.S.click();
      if (this.stamina <= 0) { this.stamina = 0; this.state = 'hurt'; this.stateT = 0; this.setClip(makeHurt(1)); this.ctx.audio.S.guardBreak(); this.ctx.ui.toast('破防'); }
      if (this.hp <= 0) this.dieP();
      return 'blocked';
    }
    // hurt
    this.hp -= info.dmg * this.mods.dmgTaken;
    this.rig.flash(1);
    this.invulnT = .8; this.state = 'hurt'; this.stateT = 0; this.setClip(makeHurt(1));
    this.parryT = 0; this.counterT = 0;
    this.vel.addScaledVector(info.dir, info.heavy ? 4.5 : 2.8);
    this.ctx.audio.S.hurt(); this.ctx.ui.hurt(); this.ctx.shake(info.heavy ? .35 : .2);
    this.ctx.fx.dmgNum(this.pos, Math.round(info.dmg));
    if (this.hp <= 0) this.dieP();
    return 'hit';
  }
  receiveProj(orb) {
    if (!this.alive || this.invulnT > 0) return false;
    if (this.state === 'dash' && this.stateT > .04 && this.stateT < .28) {
      this.ctx.slowmo(.4, .22); this.stamina = Math.min(this.maxStamina, this.stamina + 10);
      return false;
    }
    this.hp -= orb.dmg * this.mods.dmgTaken; this.rig.flash(1);
    this.invulnT = .8; this.state = 'hurt'; this.stateT = 0; this.setClip(makeHurt(1));
    this.vel.addScaledVector(orb.vel.clone().setY(0).normalize(), 2.4);
    this.ctx.audio.S.hurt(); this.ctx.ui.hurt(); this.ctx.shake(.2);
    if (this.hp <= 0) this.dieP();
    return true;
  }
  receiveShockwave() { return this.receiveProj({ dmg: 22, vel: this.pos.clone().multiplyScalar(2).normalize() }); }
  dieP() { if (!this.alive) return; this.hp = 0; this.alive = false; this.state = 'dead'; this.setClip(makeDead(1)); this.ctx.onPlayerDeath && this.ctx.onPlayerDeath(); }
  resetProgress() {  // fresh run: clear all upgrade modifiers
    this.mods = { dmg: 1, heavy: 1, speed: 1, lifesteal: 0, dmgTaken: 1, dashCd: 1, dashCost: 22, parryWin: 0, counterWin: 0, swordWave: 0, waveDmg: 18, stamRegen: 1, waveSkillDmg: 28, waveCdMult: 1, rainHitDmg: 12, rainMult: 1, rainR: 3.5 };
    this.upgradeCounts = {};
    this.waveCdT = 0; this.rainCdT = 0;
    this.maxHp = 130; this.hp = 130; this._ghost = 130;
    this.maxStamina = 100; this.stamina = 100;
  }
  dashClip() { const s = 1; return clip([{ t: 0, p: P(s, { hip: [0, .6 * s, 0], neck: [0, .34 * s, .12 * s], handR: [-.3 * s, -.3 * s, .3 * s], handL: [.3 * s, -.32 * s, .3 * s], footL: [.5 * s, -.22 * s], footR: [-.5 * s, .2 * s] }) }], .34); }
  parryClip() { const s = 1; return clip([{ t: 0, p: P(s, { hip: [-.02 * s, .86 * s, -.08 * s], handR: [-.26 * s, -.1 * s, .26 * s], swordDir: [-.25, .92, .3], handL: [-.08 * s, -.3 * s, .3 * s], footR: [-.26 * s, .08 * s] }) }], .6, { loop: true }); }
  execClip() {
    const s = 1, b = stanceOf(s);
    return clip([
      { t: 0, p: P(s, { hip: [0, .76 * s, -.06 * s], handR: [-.42 * s, -.3 * s, -.2 * s], swordDir: [-.8, -.2, -.3], hipYaw: -.3 }) },
      { t: .18, p: P(s, { hip: [.2 * s, .84 * s, .4 * s], handR: [.5 * s, -.45 * s, .55 * s], swordDir: [.75, -.5, .85], hipYaw: .55 }) },
      { t: .32, p: P(s, { hip: [.18 * s, .86 * s, .42 * s], handR: [.55 * s, -.4 * s, .5 * s], swordDir: [.8, -.45, .8], hipYaw: .58 }) },
      { t: .55, p: b }
    ], .55);
  }
  waveCastClip() {   // sword thrust straight ahead
    const s = 1, b = stanceOf(s);
    return clip([
      { t: 0, p: P(s, { hip: [0, .88 * s, -.04 * s], handR: [-.5 * s, -.35 * s, -.1 * s], swordDir: [-.9, .2, -.3], hipYaw: -.2 }) },
      { t: .12, p: P(s, { hip: [.05 * s, .86 * s, .2 * s], handR: [.05 * s, -.3 * s, .6 * s], swordDir: [.05, .15, 1], hipYaw: .25 }) },
      { t: .3, p: b }
    ], .3);
  }
  rainCastClip() {   // both arms raised to call the blades down
    const s = 1, b = stanceOf(s);
    return clip([
      { t: 0, p: b },
      { t: .15, p: P(s, { hip: [0, 1.0 * s, 0], handR: [-.45 * s, .4 * s, -.15 * s], handL: [.4 * s, .42 * s, -.15 * s], swordDir: [-.2, 1, -.2], hintR: [-1, -.2, 0], hintL: [1, -.2, 0] }) },
      { t: .4, p: b }
    ], .4);
  }
  get atkClips() {
    const s = 1, b = stanceOf(s);
    if (!this._atk) {
      this._atk = [
        clip([
          { t: 0, p: P(s, { handR: [-.5 * s, -.35 * s, -.15 * s], swordDir: [-.9, .25, -.35], hipYaw: -.18, hip: [0, .9 * s, 0] }) },
          { t: .14, p: P(s, { handR: [-.62 * s, -.42 * s, -.2 * s], swordDir: [-1, .15, -.5], hipYaw: -.28, hip: [0, .86 * s, -.02 * s] }) },
          { t: .26, p: P(s, { handR: [.18 * s, -.28 * s, .5 * s], swordDir: [.15, .55, 1], hipYaw: .4, hip: [.06 * s, .84 * s, .18 * s] }) },
          { t: .38, p: P(s, { handR: [.45 * s, -.22 * s, .42 * s], swordDir: [.55, .6, .55], hipYaw: .5, hip: [.05 * s, .86 * s, .2 * s] }) },
          { t: .62, p: b }
        ], .62, { hitFrom: .22, hitTo: .34 }),
        clip([
          { t: 0, p: P(s, { handR: [.5 * s, -.35 * s, -.15 * s], swordDir: [.9, .25, -.35], hipYaw: .18, hip: [0, .9 * s, 0] }) },
          { t: .14, p: P(s, { handR: [.62 * s, -.42 * s, -.2 * s], swordDir: [1, .15, -.5], hipYaw: .28, hip: [0, .86 * s, -.02 * s] }) },
          { t: .26, p: P(s, { handR: [-.15 * s, -.3 * s, .52 * s], swordDir: [-.2, .5, 1], hipYaw: -.42, hip: [.06 * s, .84 * s, .18 * s] }) },
          { t: .38, p: P(s, { handR: [-.45 * s, -.22 * s, .42 * s], swordDir: [-.55, .6, .55], hipYaw: -.5, hip: [.05 * s, .86 * s, .2 * s] }) },
          { t: .6, p: b }
        ], .6, { hitFrom: .22, hitTo: .34 }),
        clip([
          { t: 0, p: P(s, { handR: [-.25 * s, .25 * s, -.25 * s], swordDir: [-.15, 1, -.3], hip: [0, .92 * s, -.02 * s] }) },
          { t: .28, p: P(s, { handR: [-.3 * s, .42 * s, -.4 * s], swordDir: [.05, 1, -.45], hip: [0, .95 * s, -.06 * s], hipYaw: -.2 }) },
          { t: .44, p: P(s, { handR: [-.12 * s, -.62 * s, .42 * s], swordDir: [0, -.95, .85], hip: [.1 * s, .8 * s, .3 * s], hipYaw: .15 }) },
          { t: .56, p: P(s, { handR: [-.05 * s, -.7 * s, .38 * s], swordDir: [0, -1, .6], hip: [.1 * s, .78 * s, .32 * s] }) },
          { t: .95, p: b }
        ], .95, { hitFrom: .4, hitTo: .52 })
      ];
    }
    return this._atk;
  }
  update(dt) {
    this.stateT += dt; this.clipT += dt;
    if (this.invulnT > 0) this.invulnT -= dt;
    if (this.comboT > 0) this.comboT -= dt;
    if (this.waveCdT > 0) this.waveCdT -= dt;
    if (this.rainCdT > 0) this.rainCdT -= dt;
    if (this.bufT > 0) { this.bufT -= dt; if (this.bufT <= 0) this.buf = null; }
    if (this.hitstopT > 0) { this.hitstopT -= dt; this.hitstopCount++; this.poseStep(dt, 0); return; }
    // stamina regen (delayed); 灵潮 doubles it
    if (this.staminaDelay > 0) this.staminaDelay -= dt;
    else this.stamina = Math.min(this.maxStamina, this.stamina + 24 * dt * this.mods.stamRegen * (this.ctx.tideT > 0 ? 2 : 1));
    // timed states
    if (this.parryT > 0) this.parryT -= dt;
    if (this.counterT > 0) {
      this.counterT -= dt;
      if (this.counterT <= 0 && this.counterTarget) { this.counterTarget._counterMark = false; this.counterTarget = null; }
    }
    if (this.guardHeld && this.state === 'parry') {
      this.stamina = Math.max(0, this.stamina - 8 * dt);
      this.staminaDelay = Math.max(this.staminaDelay, .3);
      if (this.stamina <= 0) { this.state = 'idle'; this.guardHeld = false; this.ctx.audio.S.guardBreak(); this.ctx.ui.toast('破防'); }
      if (!this.ctx.parryHeld) { this.guardHeld = false; if (this.state === 'parry') { this.state = 'idle'; } }
    }
    switch (this.state) {
      case 'idle': {
        // consume buffered action
        if (this.buf) { const a = this.buf; this.buf = null; this.startAction(a); break; }
        if (this.ctx.parryHeld) { this.startAction('parry'); break; }
        const d = this.ctx.moveDir;
        if (d.lengthSq() > .01) {
          const tgtFacing = Math.atan2(d.x, d.z);
          this.facing = turnTo(this.facing, tgtFacing, 14 * dt);
          const sp = this.speed * this.mods.speed * (this.ctx.tideT > 0 ? 1.12 : 1);   // 灵潮: +12% 移速
          this.pos.addScaledVector(d, sp * dt);
          this.walkPhase += dt * sp * 1.9;
          this.setWalk();
          this.stepTimer -= dt;
          if (this.stepTimer <= 0) { this.stepTimer = .34; this.ctx.audio.S.step(); this.ctx.fx.dust(this.pos, { n: 1, size: .5 }); }
        } else this.setIdle();
        break;
      }
      case 'parry': {
        if (!this.ctx.parryHeld && this.parryT <= 0) { this.state = 'idle'; this.guardHeld = false; }
        break;
      }
      case 'dash': {
        const T = this.stateT;
        this.pos.addScaledVector(this.dashDir, 10.5 * dt);
        if (T >= .34) { this.state = 'idle'; this.setIdle(); }
        break;
      }
      case 'attack': {
        const c = this.curClip, T = this.stateT;
        // snap slide: approach target during windup, never overshoot (skill: 攻击吸附)
        if (this.snapTarget && this.snapTarget.alive && T < c.hitFrom) {
          const to = this.snapTarget.pos.clone().sub(this.pos); to.y = 0;
          const d = to.length(), want = this.snapTarget.radius + this.radius + (this.comboIdx === 2 ? 1.15 : .95);
          if (d > want) {
            const step = Math.min((d - want), 6 * dt);
            to.normalize(); this.pos.addScaledVector(to, step);
          }
          this.facing = turnTo(this.facing, Math.atan2(to.x, to.z), 8 * dt);
        }
        // hit window
        if (T >= c.hitFrom && T <= c.hitTo && this.swingHits) {
          // sword-wave projectile rides the heavy swing (upgrade)
          if (this.comboIdx === 2 && this.mods.swordWave > 0 && !this.waveSpawned) {
            this.waveSpawned = true;
            const fd = V(Math.sin(this.facing), 0, Math.cos(this.facing));
            const orb = this.ctx.fx.orb(this.pos.clone().add(V(fd.x * .8, 1.2, fd.z * .8)), fd.multiplyScalar(13), 0x9fd8ff, { r: .26 });
            orb.dmg = this.mods.waveDmg * this.mods.dmg; orb.team = 'player';
            this.ctx.projectiles.push(orb);
            this.ctx.audio.S.swing(true);
          }
          for (const e of this.ctx.enemies) {
            if (!e.alive || this.swingHits.has(e.id)) continue;
            const to = e.pos.clone().sub(this.pos); to.y = 0;
            const d = to.length();
            if (d < this.reach + (this.comboIdx === 2 ? .35 : 0) + e.radius && Math.abs(angDiff(this.facing, Math.atan2(to.x, to.z))) < this.arc + (this.comboIdx === 2 ? .25 : 0)) {
              this.swingHits.add(e.id);
              const heavy = this.comboIdx === 2;
              const base = heavy ? 34 : (this.comboIdx === 0 ? 14 : 16);
              e.takeHit({ dmg: base * this.mods.dmg * (heavy ? this.mods.heavy : 1), dir: to.normalize(), heavy, from: this });
              this.freeze(heavy ? .11 : .07); this.hitstopCount++;
              this.ctx.shake(heavy ? .3 : .12);
              if (e.posture !== undefined) { e.posture += heavy ? 14 : 8; }
              if (this.mods.lifesteal > 0) this.hp = Math.min(this.maxHp, this.hp + this.mods.lifesteal);
            }
          }
          // slash destroys enemy projectiles (skill: 弹幕可以被砍掉)
          for (const o of this.ctx.projectiles) {
            if (!o.alive || o.team === 'player') continue;
            const to = o.pos.clone().sub(this.pos); to.y = 0;
            const d = to.length();
            if (d < 2.3 && Math.abs(angDiff(this.facing, Math.atan2(to.x, to.z))) < 1.1) {
              o.kill(); o.destroyedBySlash = true;
              this.ctx.fx.burst(o.pos, 0xaef0dc, { n: 8, size: .9, speed: 4 });
              this.ctx.audio.S.orbBreak();
            }
          }
        }
        if (T >= c.dur) {
          this.state = 'idle'; this.comboT = .9; this.setIdle();
          if (this.buf) { const a = this.buf; this.buf = null; this.startAction(a); }
        }
        break;
      }
      case 'exec': {
        const T = this.stateT, c = this.curClip;
        // lunge to counter target
        if (T < .18) {
          const tgt = this.execTarget;
          if (tgt && tgt.alive) {
            const to = tgt.pos.clone().sub(this.pos); to.y = 0;
            const d = to.length();
            if (d > 1.5) this.pos.addScaledVector(to.normalize(), Math.min(d - 1.4, 11 * dt));
          }
        }
        if (T >= .16 && T <= .3 && this.execTarget && this.execTarget.alive && !this.execDone) {
          this.execDone = true;
          this.execTarget.takeHit({ dmg: 45, dir: this.execTarget.pos.clone().sub(this.pos).setY(0).normalize(), heavy: true, from: this, knock: 3 });
          if (this.execTarget.posture !== undefined) this.execTarget.posture += 40;
          this.ctx.slowmo(.3, .22);
          this.ctx.fx.slash(this.pos, this.facing, { span: 2.4, rOut: 3.2, rIn: .6, color: 0xffe2a8, dur: .35 });
          this.ctx.shake(.4);
        }
        if (T >= c.dur) { this.state = 'idle'; this.execDone = false; this.setIdle(); }
        break;
      }
      case 'hurt': {
        if (this.stateT >= .35) { this.state = 'idle'; this.setIdle(); }
        break;
      }
      case 'cast': {
        // L 剑气斩: release a flying wave; U 剑雨: schedule smart strikes around the player
        if (this.castKind === 'wave' && !this.castDone && this.stateT >= .12) {
          this.castDone = true;
          const fd = V(Math.sin(this.facing), 0, Math.cos(this.facing));
          const orb = this.ctx.fx.orb(this.pos.clone().add(V(fd.x * .9, 1.2, fd.z * .9)), fd.multiplyScalar(14), 0xbfe8ff, { r: .34 });
          orb.dmg = this.mods.waveSkillDmg * this.mods.dmg; orb.team = 'player';
          this.ctx.projectiles.push(orb);
          this.ctx.fx.slash(this.pos, this.facing, { span: 1.2, rOut: 1.7, rIn: .5, color: 0xcfe8ff, dur: .18 });
        }
        if (this.castKind === 'rain') {
          if (!this.castDone && this.stateT >= .15) {
            this.castDone = true;
            this.rainStrikes = [];
            const targets = this.ctx.enemies.filter(e => e.alive && e.pos.distanceTo(this.pos) < this.mods.rainR + 1.5)
              .sort((a, b) => a.pos.distanceTo(this.pos) - b.pos.distanceTo(this.pos));
            for (let i = 0; i < 6; i++) {
              let spot;
              if (i < targets.length) spot = targets[i].pos.clone().add(V((Math.random() - .5) * .6, 0, (Math.random() - .5) * .6));
              else { const a = Math.random() * 6.28, r = Math.sqrt(Math.random()) * this.mods.rainR; spot = this.pos.clone().add(V(Math.cos(a) * r, 0, Math.sin(a) * r)); }
              this.rainStrikes.push({ t: this.stateT + .12 + i * .11, pos: spot, done: false });
            }
            this.ctx.fx.teleCircle(this.pos, { r: this.mods.rainR, dur: .85, color: 0x9fd8ff });
          }
          for (const st of this.rainStrikes || []) {
            if (!st.done && this.stateT >= st.t) {
              st.done = true;
              this.ctx.fx.fallBlade(st.pos);
              this.ctx.audio.S.rainHit();
              for (const e of this.ctx.enemies) {
                if (!e.alive) continue;
                if (e.pos.distanceTo(st.pos) < 1.15 + e.radius) {
                  e.takeHit({ dmg: this.mods.rainHitDmg * this.mods.dmg * this.mods.rainMult, dir: V(Math.sin(this.facing), 0, Math.cos(this.facing)), heavy: false, from: this });
                  if (e.posture !== undefined) e.posture += 4;
                }
              }
            }
          }
        }
        if (this.stateT >= (this.castKind === 'wave' ? .3 : .4)) {
          this.state = 'idle'; this.castKind = null; this.setIdle();
          if (this.buf) { const a = this.buf; this.buf = null; this.startAction(a); }
        }
        break;
      }
      case 'dead': break;
    }
    // buffered attack during hitstop end handled by buf
    this.moveStep(dt, this.ctx.colliders);
    const moving = this.state === 'idle' && this.ctx.moveDir.lengthSq() > .01;
    this.poseStep(dt, moving ? this.speed : 0);
    this.hp = Math.max(0, Math.min(this.maxHp, this.hp));
    this.stamina = Math.max(0, Math.min(this.maxStamina, this.stamina));
  }
}

// ---------------------------------------------------------------- walker (melee minion)
export class Walker extends Actor {
  constructor(ctx, pos) {
    super(ctx, { radius: .45, hp: 46, speed: 3.5, scale: .95, team: 'enemy',
      rigCfg: { scale: .95, colors: { cloth: 0x4a3428, trim: 0x6e4434, skin: 0x8f7a66 }, weapon: 'cleaver', thick: .1 } });
    this.pos.copy(pos);
    this.state = 'chase'; this.stateT = 0;
    this.strafeDir = Math.random() < .5 ? 1 : -1;
    this.strafeT = rand2(1, 2.2);
    this.comboNext = false;
  }
  onHurt(heavy) {
    if (this.ctx.meleeToken === this) this.ctx.meleeToken = null;
    this.state = 'hitstun'; this.stateT = 0;
    this.setClip(makeHurt(this.scale, heavy ? .55 : .3));
    this.stunDur = heavy ? .55 : .3;
  }
  onParried() { this.state = 'stagger'; this.stateT = 0; this.setClip(makeHurt(this.scale, 1.2)); this.ctx.meleeToken = null; }
  update(dt) {
    this.stateT += dt; this.clipT += dt;
    if (!this.alive) { this.deadT += dt; this.poseStep(dt, 0); return; }
    if (this.hitstopT > 0) { this.hitstopT -= dt; this.poseStep(dt, 0); return; }
    const pl = this.ctx.player;
    const to = pl.pos.clone().sub(this.pos); to.y = 0;
    const dist = to.length();
    const toAng = Math.atan2(to.x, to.z);
    switch (this.state) {
      case 'chase': {
        if (!pl.alive) { this.setIdle(); break; }
        this.facing = turnTo(this.facing, toAng, 10 * dt);
        if (dist > 2.5) {
          this.pos.addScaledVector(to.normalize(), this.speed * dt);
          this.walkPhase += dt * this.speed * 1.9; this.setWalk();
        } else {
          // ask for the melee token: only one attacker at a time (skill: 同一时间只有一个近战出手)
          if (!this.ctx.meleeToken) {
            this.ctx.meleeToken = this;
            this.state = 'telegraph'; this.stateT = 0;
            this.facing = toAng;
            this.comboNext = Math.random() < .4;
            this.ctx.fx.teleSector(this.pos, toAng, { span: 1.7, r: 2.9, dur: .7 });
            this.ctx.audio.S.tele();
          } else { this.state = 'strafe'; this.stateT = 0; }
        }
        break;
      }
      case 'strafe': {
        if (this.passive) {   // 宝箱怪: flee from the player, never fights
          this.facing = turnTo(this.facing, toAng + Math.PI, 8 * dt);
          this.pos.addScaledVector(to.clone().normalize().multiplyScalar(-1), 4.6 * dt);
          this.walkPhase += dt * 6.4; this.setWalk();
          break;
        }
        this.facing = turnTo(this.facing, toAng, 10 * dt);
        this.strafeT -= dt;
        const side = V(Math.cos(this.facing), 0, -Math.sin(this.facing)).multiplyScalar(this.strafeDir);
        const radial = to.clone().normalize().multiplyScalar(dist > 3.4 ? .8 : -.4);
        const mv = side.multiplyScalar(1.6).add(radial).clampLength(0, 2.4);
        this.pos.addScaledVector(mv, dt);
        this.walkPhase += dt * 3.2; this.setWalk();
        if (!this.passive && !this.ctx.meleeToken && dist < 3.2) { this.ctx.meleeToken = this; this.state = 'telegraph'; this.stateT = 0; this.ctx.fx.teleSector(this.pos, toAng, { span: 1.7, r: 2.9, dur: .7 }); this.ctx.audio.S.tele(); }
        else if (this.strafeT <= 0) { this.strafeT = rand2(1, 2.2); this.strafeDir *= -1; if (dist > 4.5) this.state = 'chase'; }
        break;
      }
      case 'telegraph': {
        this.facing = turnTo(this.facing, toAng, 4 * dt);
        this.setIdle();
        if (this.stateT >= .7) {
          this.state = 'strike'; this.stateT = 0;
          this.setClip(this.atkClip);
          this.ctx.audio.S.swing(false);
          this.ctx.fx.slash(this.pos, this.facing, { span: 1.6, rOut: 2.2, rIn: .5, color: 0xffb28a, dur: .2 });
          this.hitDone = false;
        }
        break;
      }
      case 'strike': {
        const c = this.atkClip;
        if (!this.hitDone && this.stateT >= c.hitFrom && this.stateT <= c.hitTo) {
          if (dist < 2.6) {
            this.hitDone = true;
            const res = pl.receiveMelee({ dmg: 9 * this.dmgScale, dir: to.clone().normalize(), heavy: false, from: this, blockable: true });
            if (res === 'hit') this.ctx.shake(.12);
          }
        }
        if (this.stateT >= c.dur * .8) {
          if (this.comboNext) { this.comboNext = false; this.state = 'strike2'; this.stateT = 0; this.setClip(this.atk2Clip); this.ctx.audio.S.swing(false); this.hitDone = false; }
          else { this.state = 'recover'; this.stateT = 0; }
        }
        break;
      }
      case 'strike2': {
        const c = this.atk2Clip;
        if (!this.hitDone && this.stateT >= c.hitFrom && this.stateT <= c.hitTo) {
          if (dist < 2.6) {
            this.hitDone = true;
            pl.receiveMelee({ dmg: 7 * this.dmgScale, dir: to.clone().normalize(), heavy: false, from: this, blockable: true });
          }
        }
        if (this.stateT >= c.dur * .85) { this.state = 'recover'; this.stateT = 0; }
        break;
      }
      case 'recover': {
        this.setIdle();
        if (this.stateT >= .5) { if (this.ctx.meleeToken === this) this.ctx.meleeToken = null; this.state = 'chase'; }
        break;
      }
      case 'stagger': {
        if (this.stateT >= 1.25) { this.state = 'chase'; if (this.ctx.meleeToken === this) this.ctx.meleeToken = null; }
        break;
      }
      case 'hitstun': {
        if (this.stateT >= this.stunDur) { this.state = 'chase'; }
        break;
      }
    }
    this.moveStep(dt, this.ctx.colliders);
    this.poseStep(dt, this.state === 'chase' || this.state === 'strafe' ? this.speed : 0);
  }
  get atkClip() {
    if (!this._a1) {
      const s = this.scale;
      this._a1 = clip([
        { t: 0, p: P(s, { handR: [-.4 * s, .2 * s, -.15 * s], swordDir: [-.3, 1, -.3], hip: [0, .92 * s, 0] }) },
        { t: .3, p: P(s, { handR: [-.45 * s, .35 * s, -.25 * s], swordDir: [0, 1, -.4], hip: [0, .94 * s, -.04 * s] }) },
        { t: .44, p: P(s, { handR: [-.15 * s, -.5 * s, .4 * s], swordDir: [0, -.85, .8], hip: [.08 * s, .8 * s, .25 * s] }) },
        { t: .56, p: P(s, { handR: [-.1 * s, -.55 * s, .35 * s], swordDir: [0, -.9, .7], hip: [.08 * s, .82 * s, .27 * s] }) },
        { t: .8, p: stanceOf(s) }
      ], .8, { hitFrom: .42, hitTo: .52 });
      this._a2 = clip([
        { t: 0, p: P(s, { handR: [.5 * s, -.05 * s, -.1 * s], swordDir: [.9, .1, -.2], hipYaw: .25 }) },
        { t: .24, p: P(s, { handR: [.6 * s, -.1 * s, -.15 * s], swordDir: [1, .1, -.3], hipYaw: .35 }) },
        { t: .36, p: P(s, { handR: [-.2 * s, -.35 * s, .45 * s], swordDir: [-.3, -.2, 1], hipYaw: -.45, hip: [.07 * s, .82 * s, .2 * s] }) },
        { t: .5, p: P(s, { handR: [-.4 * s, -.3 * s, .4 * s], swordDir: [-.6, -.2, .8], hipYaw: -.5 }) },
        { t: .7, p: stanceOf(s) }
      ], .7, { hitFrom: .34, hitTo: .44 });
    }
    return this._a1;
  }
  get atk2Clip() { this.atkClip; return this._a2; }
}
const rand2 = (a, b) => a + Math.random() * (b - a);

// ---------------------------------------------------------------- caster (ranged minion)
export class Caster extends Actor {
  constructor(ctx, pos) {
    super(ctx, { radius: .45, hp: 30, speed: 3.0, scale: .9, team: 'enemy',
      rigCfg: { scale: .9, colors: { cloth: 0x274236, trim: 0x3c6e56, skin: 0x9c8873 }, weapon: 'staff', thick: .1 } });
    this.pos.copy(pos);
    this.state = 'chase'; this.stateT = 0;
    this.castCd = 1.2; this.nextIsAoe = false;
    this.orbFired = false; this.aoeDone = false;
    this.strafeDir = Math.random() < .5 ? 1 : -1; this.strafeT = rand2(1.4, 2.6);
  }
  update(dt) {
    this.stateT += dt; this.clipT += dt;
    if (!this.alive) { this.deadT += dt; this.poseStep(dt, 0); return; }
    if (this.hitstopT > 0) { this.hitstopT -= dt; this.poseStep(dt, 0); return; }
    const pl = this.ctx.player;
    const to = pl.pos.clone().sub(this.pos); to.y = 0;
    const dist = to.length(), toAng = Math.atan2(to.x, to.z);
    this.castCd -= dt;
    switch (this.state) {
      case 'chase': {
        if (!pl.alive) { this.setIdle(); break; }
        this.facing = turnTo(this.facing, toAng, 9 * dt);
        let mv = V();
        if (dist < 5) mv = to.clone().normalize().multiplyScalar(-1);           // retreat
        else if (dist > 11) mv = to.clone().normalize();
        else { this.state = 'strafe'; this.stateT = 0; break; }
        this.pos.addScaledVector(mv, this.speed * dt);
        this.walkPhase += dt * this.speed * 1.9; this.setWalk();
        if (this.castCd <= 0 && dist > 4.5 && dist < 14) {
          this.state = 'cast'; this.stateT = 0; this.orbFired = false; this.aoeDone = false;
          this.setClip(this.castClip());
          this.ctx.audio.S.cast();
        }
        break;
      }
      case 'strafe': {
        this.facing = turnTo(this.facing, toAng, 9 * dt);
        this.strafeT -= dt;
        const side = V(Math.cos(this.facing), 0, -Math.sin(this.facing)).multiplyScalar(this.strafeDir);
        this.pos.addScaledVector(side, 1.8 * dt);
        this.walkPhase += dt * 2.6; this.setWalk();
        if (dist < 4.5 || this.strafeT <= 0) { this.strafeT = rand2(1.4, 2.6); this.strafeDir *= -1; this.state = 'chase'; }
        if (this.castCd <= 0 && dist > 4.5 && dist < 15) {
          this.state = 'cast'; this.stateT = 0; this.orbFired = false; this.aoeDone = false;
          this.setClip(this.castClip());
          this.ctx.audio.S.cast();
        }
        break;
      }
      case 'cast': {
        this.facing = turnTo(this.facing, toAng, 3 * dt);
        if (!this.nextIsAoe) {
          if (!this.orbFired && this.stateT >= .95) {
            this.orbFired = true;
            const dir = to.clone().normalize();
            const orb = this.ctx.fx.orb(this.pos.clone().add(V(Math.sin(this.facing) * .6, 1.35, Math.cos(this.facing) * .6)), dir.multiplyScalar(8.5), 0x7fe0c8);
            orb.dmg = 10 * this.dmgScale; orb.team = 'enemy';
            this.ctx.projectiles.push(orb);
          }
          if (this.stateT >= 1.15) { this.state = 'strafe'; this.stateT = 0; this.castCd = rand2(2.4, 3.4); this.nextIsAoe = !this.nextIsAoe; }
        } else {
          if (!this.aoeDone && this.stateT >= .1) {
            this.aoeDone = true;
            const target = pl.pos.clone();
            this.ctx.fx.teleCircle(target, { r: 2.3, dur: 1.15 });
            this.aoeTarget = target; this.aoeT = 0;
            this.state = 'aoe'; this.stateT = 0;
            this.ctx.audio.S.tele();
          }
          if (this.stateT >= 1.0) { this.state = 'strafe'; this.stateT = 0; this.castCd = rand2(2.6, 3.6); this.nextIsAoe = !this.nextIsAoe; }
        }
        break;
      }
      case 'aoe': {
        this.aoeT = (this.aoeT || 0) + dt;
          if (this.aoeT >= 1.15) {
          const d = pl.pos.distanceTo(this.aoeTarget);
          if (d < 2.4 && pl.alive) pl.receiveProj({ dmg: 12 * this.dmgScale, vel: pl.pos.clone().sub(this.aoeTarget).setY(0).normalize() });
          this.ctx.fx.ring(this.aoeTarget, { r0: .4, r1: 2.6, color: 0xffa06a, dur: .4 });
          this.ctx.fx.burst(this.aoeTarget.clone().add(V(0, .5, 0)), 0xffb070, { n: 10, size: 1, speed: 5 });
          this.ctx.audio.S.slam();
          if (pl.pos.distanceTo(this.aoeTarget) < 3.2) this.ctx.shake(.25);
          this.aoeT = -99; // done
        }
        if (this.stateT >= 1.3) { this.state = 'strafe'; this.stateT = 0; this.castCd = rand2(2.6, 3.6); this.nextIsAoe = !this.nextIsAoe; }
        break;
      }
      case 'stagger': {
        if (this.stateT >= 1.25) { this.state = 'chase'; }
        break;
      }
      case 'hitstun': {
        if (this.stateT >= this.stunDur) { this.state = 'chase'; }
        break;
      }
    }
    this.moveStep(dt, this.ctx.colliders);
    this.poseStep(dt, this.state === 'chase' || this.state === 'strafe' ? this.speed : 0);
    // orb glow pulse during cast
    if (this.state === 'cast' && this.rig.wpn.userData.orb) {
      this.rig.wpn.userData.orb.material.emissiveIntensity = 2.4 + Math.sin(this.stateT * 14) * 1.2;
    }
  }
  castClip() {
    const s = this.scale, b = stanceOf(s);
    return clip([
      { t: 0, p: b },
      { t: .3, p: P(s, { hip: [0, .98 * s, 0], handR: [-.15 * s, .12 * s, -.05 * s], swordDir: [0, 1, 0] }) },
      { t: .85, p: P(s, { hip: [0, 1.0 * s, 0], handR: [-.1 * s, .2 * s, 0], swordDir: [0, 1, .1] }) },
      { t: 1.15, p: b }
    ], 1.15);
  }
  onParried() { this.state = 'stagger'; this.stateT = 0; this.setClip(makeHurt(this.scale, 1.2)); }
  onHurt(heavy) {
    this.state = 'hitstun'; this.stateT = 0;
    this.setClip(makeHurt(this.scale, heavy ? .55 : .3));
    this.stunDur = heavy ? .55 : .3;
  }
}

// ---------------------------------------------------------------- boss: stone shrine guardian
export class Boss extends Actor {
  constructor(ctx, pos) {
    super(ctx, { radius: 1.05, hp: 380, speed: 2.7, scale: 2.2, team: 'enemy',
      rigCfg: { scale: 2.2, colors: { cloth: 0x565e6e, trim: 0x3d4452, skin: 0x6e7889 }, weapon: null, thick: .16 } });
    this.pos.copy(pos);
    this.state = 'idle'; this.stateT = 0;
    this.phase = 1; this.posture = 0; this.maxPosture = 100;
    this.thinkT = 1.2; this.comboStep = 0;
    this.ringR = -1; this.ringHitDone = false;
    this.lines = null; this.roared = false;
    this.decayT = 0;
  }
  spd() { return this.phase === 2 ? .72 : 1; }   // phase 2: faster windups
  onParried() {
    this.posture += 35;
    this.state = 'stumble'; this.stateT = 0; this.setClip(makeHurt(this.scale, .8));
  }
  update(dt) {
    this.stateT += dt; this.clipT += dt;
    if (!this.alive) { this.deadT += dt; this.poseStep(dt, 0); return; }
    if (this.hitstopT > 0) { this.hitstopT -= dt; this.poseStep(dt, 0); return; }
    const pl = this.ctx.player;
    const to = pl.pos.clone().sub(this.pos); to.y = 0;
    const dist = to.length(), toAng = Math.atan2(to.x, to.z);
    // posture decay
    this.decayT += dt;
    if (this.decayT > 1.4 && this.state !== 'stagger') this.posture = Math.max(0, this.posture - 7 * dt);
    // phase transition at 50%
    if (this.phase === 1 && this.hp <= this.maxHp * .5 && this.alive) {
      this.phase = 2; this.state = 'roar'; this.stateT = 0;
      this.setClip(this.roarClip());
      this.ctx.audio.S.roar(); this.ctx.shake(.5);
      this.ctx.ui.boss(true, undefined, undefined, this.posture / this.maxPosture);
      this.ctx.onBossPhase2 && this.ctx.onBossPhase2();
      this.speed = 3.3;
    }
    // posture stagger
    if (this.posture >= 100 && this.state !== 'stagger' && this.alive) {
      this.posture = 0; this.state = 'stagger'; this.stateT = 0;
      this.setClip(this.staggerClip());
      this.ctx.audio.S.guardBreak();
      this.ctx.fx.burst(this.pos.clone().add(V(0, 2.5, 0)), 0xffe9b8, { n: 14, size: 1.6, speed: 6 });
      this.ctx.ui.toast('守卫破势');
      this.ctx.meleeToken = null;
    }
    switch (this.state) {
      case 'idle': {
        this.facing = turnTo(this.facing, toAng, 5 * dt);
        this.setIdle();
        this.thinkT -= dt;
        if (this.thinkT <= 0 && pl.alive) {
          if (dist > 3.6) { this.state = 'chase'; this.stateT = 0; }
          else this.pickAttack();
        }
        break;
      }
      case 'chase': {
        this.facing = turnTo(this.facing, toAng, 6 * dt);
        if (dist > 3.3) {
          this.pos.addScaledVector(to.clone().normalize(), this.speed * dt);
          this.walkPhase += dt * this.speed * 1.4; this.setWalk();
        } else { this.setIdle(); this.thinkT = .35; this.state = 'idle'; }
        if (this.stateT > 4.5 && dist < 6) { this.state = 'idle'; this.thinkT = .1; }
        break;
      }
      case 'combo': {
        this.facing = turnTo(this.facing, toAng, 2.5 * dt);
        const c = this.curSwing;
        if (!this.hitDone && this.stateT >= c.hitFrom && this.stateT <= c.hitTo) {
          this.hitDone = true;
          const reach = 3.6;
          if (dist < reach && Math.abs(angDiff(this.facing, toAng)) < 1.2) {
            pl.receiveMelee({ dmg: 14 * this.dmgScale, dir: to.clone().normalize(), heavy: true, from: this, blockable: true });
          }
        }
        if (this.stateT >= c.dur * this.spd()) {
          this.comboStep++;
          if (this.comboStep < 3 && dist < 4.4) {
            this.curSwing = this.comboStep % 2 ? this.swingL() : this.swingR();
            this.setClip(this.curSwing); this.stateT = 0; this.hitDone = false;
            this.ctx.audio.S.swing(true);
          } else { this.state = 'idle'; this.thinkT = this.phase === 2 ? .7 : 1.1; this.comboStep = 0; }
        }
        break;
      }
      case 'slam': {
        const T = this.stateT / this.spd();
        if (!this.slamStarted && T >= 1.05) {
          this.slamStarted = true;
          this.ctx.audio.S.slam(); this.ctx.shake(.55);
          this.ctx.fx.ring(this.pos, { r0: 1.2, r1: 7.5, color: 0xffc9a0, dur: .55, w: .2 });
          this.ctx.fx.burst(this.pos.clone().add(V(0, .6, 0)), 0xffcf9e, { n: 12, size: 1.8, speed: 7 });
          this.ctx.fx.dust(this.pos, { n: 6, size: 2.2 });
          this.ringR = 1.2; this.ringHitDone = false;
        }
        if (this.ringR > 0) {
          this.ringR += 11.5 * dt;
          const d = pl.pos.distanceTo(this.pos);
          if (!this.ringHitDone && Math.abs(d - this.ringR) < .75 && this.ringR > 1.6) {
            this.ringHitDone = true;
            pl.receiveProj({ dmg: 16 * this.dmgScale, vel: pl.pos.clone().sub(this.pos).setY(0).normalize() });
          }
          if (this.ringR > 8) this.ringR = -1;
        }
        if (T >= 1.9) { this.slamStarted = false; this.ringR = -1; this.state = 'idle'; this.thinkT = this.phase === 2 ? .8 : 1.2; }
        break;
      }
      case 'roar': {
        if (this.stateT >= 1.5 / this.spd()) { this.state = 'idle'; this.thinkT = .6; }
        break;
      }
      case 'ring': {
        if (!this.ringFired && this.stateT >= .6) {
          this.ringFired = true;
          for (let i = 0; i < 12; i++) {
            const a = i / 12 * TAU;
            const orb = this.ctx.fx.orb(this.pos.clone().add(V(Math.sin(a) * 1.4, 1.6, Math.cos(a) * 1.4)), V(Math.sin(a), 0, Math.cos(a)).multiplyScalar(7), 0xffb28a, { r: .2 });
            orb.dmg = 9 * this.dmgScale; orb.team = 'enemy';
            this.ctx.projectiles.push(orb);
          }
          this.ctx.audio.S.cast();
        }
        if (this.stateT >= 1.2) { this.ringFired = false; this.state = 'idle'; this.thinkT = 1.0; }
        break;
      }
      case 'eruption': {
        if (!this.lines && this.stateT >= .15) {
          this.lines = [];
          const base = toAng;
          for (let i = -1; i <= 1; i++) {
            const a = base + i * .45;
            const dir = V(Math.sin(a), 0, Math.cos(a));
            this.ctx.fx.teleLine(this.pos, a, { w: 1.7, len: 15, dur: 1.0 * this.spd() });
            this.lines.push({ dir, born: 1.0 * this.spd() });
          }
          this.ctx.audio.S.tele();
        }
        if (this.lines) {
          for (const L of this.lines) {
            if (!L.done && this.stateT >= L.born + .15) {
              L.done = true;
              this.ctx.audio.S.slam();
              this.ctx.fx.ring(this.pos.clone().addScaledVector(L.dir, 6), { r0: .3, r1: 2.2, color: 0xffb24d, dur: .35 });
              this.ctx.fx.dust(this.pos.clone().addScaledVector(L.dir, 6), { n: 4, size: 1.6 });
              // corridor damage check: distance from player to the line ray
              const rel = pl.pos.clone().sub(this.pos);
              const along = rel.dot(L.dir);
              const perp = rel.clone().addScaledVector(L.dir, -along).length();
              if (along > 0 && along < 15 && perp < 1.1 && pl.alive) pl.receiveProj({ dmg: 15 * this.dmgScale, vel: L.dir.clone() });
            }
          }
        }
        if (this.stateT >= 1.6) { this.lines = null; this.state = 'idle'; this.thinkT = .9; }
        break;
      }
      case 'stumble': {
        if (this.stateT >= .85) { this.state = 'idle'; this.thinkT = .5; }
        break;
      }
      case 'stagger': {
        if (this.stateT >= 3.4) { this.state = 'idle'; this.thinkT = .6; }
        break;
      }
    }
    this.moveStep(dt, this.ctx.colliders);
    this.poseStep(dt, this.state === 'chase' ? this.speed : 0);
  }
  pickAttack() {
    const pl = this.ctx.player;
    const roll = Math.random();
    this.stateT = 0;
    if (this.phase === 1) {
      if (roll < .55 || !this._slamOk()) {
        this.comboStep = 0; this.curSwing = this.swingR(); this.setClip(this.curSwing);
        this.state = 'combo'; this.hitDone = false;
        this.ctx.audio.S.swing(true);
      } else {
        this.state = 'slam'; this.slamStarted = false; this.setClip(this.slamClip());
        this.ctx.fx.teleSector(this.pos, this.facing, { span: Math.PI * 2, r: 8, dur: 1.05 * this.spd(), color: 0xff9d5c });
        this.ctx.audio.S.tele();
      }
    } else {
      if (roll < .4) {
        this.comboStep = 0; this.curSwing = this.swingR(); this.setClip(this.curSwing);
        this.state = 'combo'; this.hitDone = false;
        this.ctx.audio.S.swing(true);
      } else if (roll < .62) {
        this.state = 'slam'; this.slamStarted = false; this.setClip(this.slamClip());
        this.ctx.fx.teleSector(this.pos, this.facing, { span: Math.PI * 2, r: 8, dur: 1.05 * this.spd(), color: 0xff9d5c });
        this.ctx.audio.S.tele();
      } else if (roll < .8) {
        this.state = 'ring'; this.ringFired = false; this.setClip(this.roarClip());
        this.ctx.audio.S.tele();
      } else {
        this.state = 'eruption'; this.lines = null; this.setClip(this.castClip());
      }
    }
    void pl;
  }
  _slamOk() { const pl = this.ctx.player; return pl.pos.distanceTo(this.pos) < 8.5; }
  swingR() {
    if (!this._sr) {
      const s = this.scale, b = stanceOf(s);
      this._sr = clip([
        { t: 0, p: P(s, { handR: [-.7 * s, .1 * s, -.4 * s], swordDir: [-1, 0, -.3], hipYaw: -.3 }) },
        { t: .3 * s, p: P(s, { handR: [-.85 * s, .15 * s, -.5 * s], swordDir: [-1, 0, -.4], hipYaw: -.4 }) },
        { t: .46 * s, p: P(s, { handR: [.5 * s, -.2 * s, .5 * s], swordDir: [1, 0, .6], hipYaw: .5, hip: [.15 * s, 1.0 * s, .3 * s] }) },
        { t: .6 * s, p: P(s, { handR: [.6 * s, -.15 * s, .45 * s], swordDir: [1, 0, .5], hipYaw: .55 }) },
        { t: .85 * s, p: b }
      ], .85 * s, { hitFrom: .44 * s, hitTo: .56 * s });
      this._sl = clip([
        { t: 0, p: P(s, { handR: [.7 * s, .1 * s, -.4 * s], swordDir: [1, 0, -.3], hipYaw: .3 }) },
        { t: .3 * s, p: P(s, { handR: [.85 * s, .15 * s, -.5 * s], swordDir: [1, 0, -.4], hipYaw: .4 }) },
        { t: .46 * s, p: P(s, { handR: [-.5 * s, -.2 * s, .5 * s], swordDir: [-1, 0, .6], hipYaw: -.5, hip: [.15 * s, 1.0 * s, .3 * s] }) },
        { t: .6 * s, p: P(s, { handR: [-.6 * s, -.15 * s, .45 * s], swordDir: [-1, 0, .5], hipYaw: -.55 }) },
        { t: .85 * s, p: b }
      ], .85 * s, { hitFrom: .44 * s, hitTo: .56 * s });
    }
    return this._sr;
  }
  swingL() { this.swingR(); return this._sl; }
  slamClip() {
    if (!this._slam) {
      const s = this.scale, b = stanceOf(s);
      this._slam = clip([
        { t: 0, p: P(s, { handR: [-.5 * s, .7 * s, -.2 * s], handL: [.5 * s, .7 * s, -.2 * s], swordDir: [-.4, 1, -.2], hip: [0, 1.15 * s, -.1 * s] }) },
        { t: .6, p: P(s, { handR: [-.55 * s, .85 * s, -.25 * s], handL: [.55 * s, .85 * s, -.25 * s], swordDir: [-.3, 1, -.3], hip: [0, 1.2 * s, -.15 * s] }) },
        { t: 1.05, p: P(s, { handR: [-.3 * s, -.5 * s, .4 * s], handL: [.3 * s, -.5 * s, .4 * s], swordDir: [0, -1, .5], hip: [.1 * s, 1.0 * s, .35 * s] }) },
        { t: 1.35, p: P(s, { handR: [-.28 * s, -.55 * s, .38 * s], handL: [.28 * s, -.55 * s, .38 * s], swordDir: [0, -1, .5], hip: [.1 * s, .98 * s, .37 * s] }) },
        { t: 1.9, p: b }
      ], 1.9);
    }
    return this._slam;
  }
  roarClip() {
    if (!this._roar) {
      const s = this.scale, b = stanceOf(s);
      this._roar = clip([
        { t: 0, p: b },
        { t: .35, p: P(s, { handR: [-.9 * s, .5 * s, -.1 * s], handL: [.9 * s, .5 * s, -.1 * s], swordDir: [-1, .5, -.1], head: [0, .3 * s, -.1 * s], hip: [0, 1.1 * s, 0] }) },
        { t: 1.1, p: P(s, { handR: [-.95 * s, .55 * s, -.1 * s], handL: [.95 * s, .55 * s, -.1 * s], swordDir: [-1, .6, -.1], head: [0, .32 * s, -.12 * s], hip: [0, 1.12 * s, 0] }) },
        { t: 1.5, p: b }
      ], 1.5);
    }
    return this._roar;
  }
  castClip() {
    if (!this._cast) {
      const s = this.scale, b = stanceOf(s);
      this._cast = clip([
        { t: 0, p: b },
        { t: .3, p: P(s, { handR: [-.6 * s, .3 * s, -.3 * s], handL: [.6 * s, .3 * s, -.3 * s], hip: [0, 1.1 * s, 0] }) },
        { t: 1.0, p: b }
      ], 1.0);
    }
    return this._cast;
  }
  staggerClip() {
    if (!this._stg) {
      const s = this.scale, b = stanceOf(s);
      this._stg = clip([
        { t: 0, p: b },
        { t: .4, p: P(s, { hip: [0, .5 * s, 0], neck: [0, .42 * s, .15 * s], head: [0, .16 * s, .1 * s], handR: [-.5 * s, -.42 * s, .5 * s], handL: [.5 * s, -.42 * s, .5 * s], swordDir: [0, -1, .4], footL: [.6 * s, -.3 * s], footR: [-.6 * s, .3 * s] }) }
      ], .4, { loop: true });
    }
    return this._stg;
  }
  takeHit(info) {
    const mult = this.state === 'stagger' ? 1.5 : 1;
    super.takeHit({ ...info, dmg: info.dmg * mult });
    if (!this.alive) { this.ctx.onBossDeath && this.ctx.onBossDeath(); }
  }
  die() {
    super.die();
    this.setClip(this.deadClip());
  }
  deadClip() {
    if (!this._dc) {
      const s = this.scale, b = stanceOf(s);
      this._dc = clip([
        { t: 0, p: b },
        { t: .5, p: P(s, { hip: [0, .55 * s, 0], neck: [0, .3 * s, .2 * s] }) },
        { t: 1.2, p: P(s, { hip: [0, .3 * s, .1 * s], neck: [0, .18 * s, .4 * s], head: [0, .1 * s, .1 * s], handR: [-.5 * s, -.3 * s, .5 * s], handL: [.5 * s, -.3 * s, .5 * s], swordDir: [0, -1, .5] }) }
      ], 1.3);
    }
    return this._dc;
  }
}

// ---------------------------------------------------------------- loot
export class Loot {
  constructor(ctx, pos, kind, tier = 0) {
    this.ctx = ctx; this.kind = kind; this.tier = tier;
    this.pos = pos.clone(); this.vel = V(rand2(-1.6, 1.6), 5.5, rand2(-1.6, 1.6));
    this.r = .34; this.alive = true; this.flying = false; this.t = 0;
    const geo = new THREE.OctahedronGeometry(tier ? .3 : .2, 0);
    const mat = new THREE.MeshStandardMaterial({ color: kind === 'heal' ? 0xe05548 : 0x6fd8b8, emissive: kind === 'heal' ? 0xb03028 : 0x2aa888, emissiveIntensity: 1.6, roughness: .3, flatShading: true });
    this.mesh = new THREE.Mesh(geo, mat); this.mesh.castShadow = true;
    ctx.scene.add(this.mesh);
    this.col = ctx.fx.lootCol(() => this.pos, tier);
  }
  update(dt) {
    this.t += dt;
    const pl = this.ctx.player;
    if (this.flying) {
      // arc into the player
      this.pos.lerp(pl.pos.clone().add(V(0, 1, 0)), Math.min(1, dt * 9));
      if (this.pos.distanceTo(pl.pos.clone().add(V(0, 1, 0))) < .5) this.apply();
    } else {
      this.vel.y -= 16 * dt;
      this.pos.addScaledVector(this.vel, dt);
      if (this.pos.y < .35) { this.pos.y = .35; this.vel.y *= -.45; this.vel.x *= .7; this.vel.z *= .7; if (Math.abs(this.vel.y) < 1.2) this.vel.set(0, 0, 0); if (this.vel.length() > 2) this.ctx.audio.S.step(); }
      const d = pl.pos.distanceTo(this.pos);
      if (d < 2.8 && pl.alive) { this.flying = true; this.ctx.audio.S.drop(this.tier); }
    }
    this.mesh.position.copy(this.pos); this.mesh.rotation.y += dt * 3;
    if (this.t > 20) this.apply();
  }
  apply() {
    if (!this.alive) return;
    this.alive = false;
    const pl = this.ctx.player;
    if (this.kind === 'heal') { pl.hp = Math.min(pl.maxHp, pl.hp + 22); this.ctx.ui.toast('伤药 +22'); this.ctx.audio.S.heal(); }
    else { pl.stamina = Math.min(pl.maxStamina, pl.stamina + 40); pl.hp = Math.min(pl.maxHp, pl.hp + 6); this.ctx.ui.toast('灵珠 +40 体力'); this.ctx.audio.S.drop(1); }
    this.ctx.fx.burst(this.pos, this.kind === 'heal' ? 0xff9080 : 0x8ff0d0, { n: 8, size: .8, speed: 4 });
    this.ctx.scene.remove(this.mesh); this.col.kill();
  }
}

export { angDiff, turnTo };
