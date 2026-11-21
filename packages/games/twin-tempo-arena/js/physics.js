// Twin Tempo Arena — pure 2D fighter / lamp / shove math.
// Logical arena is 960 × 540. Fighters stand on a floating platform whose
// top surface sits at GROUND; x is horizontal, z is height above the deck.
// Everything here is deterministic and free of DOM / rendering concerns.

export const W = 960;
export const H = 540;
export const CX = 480;
export const GROUND = 424;

export const FIGHTER_R = 20;
export const FIGHTER_H = 66;

export const ACCEL = 1550;         // ground acceleration px/s²
export const AIR_ACCEL = 820;
export const FRICTION = 5.7;       // exponential ground damping
export const AIR_DRAG = 2.2;
export const MAX_SPD = 280;        // human run cap
export const JUMP_V = 470;
export const GRAVITY = 1300;

export const ATTACK = Object.freeze({
  range: 64,
  zRange: 64,
  damage: 13,
  chip: 3,
  kb: 370,
  chipKb: 130,
  cd: 0.42,
  anim: 0.18,
});

export const DASH = Object.freeze({
  speed: 790,
  dur: 0.18,
  cd: 0.95,
  invuln: 0.16,
});

export const CAPTURE = Object.freeze({
  zone: 76,
  rate: 24,
  goal: 100,
});

export const PUSH = Object.freeze({
  attackKb: 500,
  dashBase: 360,
  dashMomentum: 0.5,
});

export const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;
export const clamp01 = (v) => clamp(v, 0, 1);
export const sign = (v) => v < 0 ? -1 : v > 0 ? 1 : 0;

export function finite(x, fallback = 0) {
  return Number.isFinite(x) ? x : fallback;
}

export function resetFighter(f, side, x, facing = 1) {
  f.side = side;
  f.x = finite(x, CX);
  f.z = 0;
  f.vx = 0;
  f.vz = 0;
  f.facing = facing;
  f.hp = 100;
  f.progress = 0;
  f.onGround = true;
  f.blocking = false;
  f.atkCd = 0;
  f.atkAnim = 0;
  f.stunT = 0;
  f.dashT = 0;
  f.dashCd = 0;
  f.dashHit = false;
  f.invulnT = 0;
  f.fallen = false;
  f.fallT = 0;
  f.flashT = 0;
  f.maxSpd = MAX_SPD;
  f.accel = ACCEL;
  f.lastHit = null;
  f.walkPhase = 0;
  return f;
}

// One fixed-step fighter advance: input acceleration, exponential friction,
// jump / gravity, block pose and cooldown timers. Attacks and body collisions
// are resolved by the caller after both fighters have moved.
export function stepFighter(f, inp, dt) {
  if (!f || !Number.isFinite(dt) || dt <= 0) return f;
  inp = inp || {};

  f.atkCd = Math.max(0, (f.atkCd || 0) - dt);
  f.atkAnim = Math.max(0, (f.atkAnim || 0) - dt);
  f.stunT = Math.max(0, (f.stunT || 0) - dt);
  f.dashT = Math.max(0, (f.dashT || 0) - dt);
  f.dashCd = Math.max(0, (f.dashCd || 0) - dt);
  f.invulnT = Math.max(0, (f.invulnT || 0) - dt);
  f.flashT = Math.max(0, (f.flashT || 0) - dt);

  if (f.fallen) {
    f.fallT = (f.fallT || 0) + dt;
    f.z -= 420 * dt;
    f.x += finite(f.vx) * dt;
    f.vx *= Math.max(0, 1 - 1.6 * dt);
    return f;
  }

  const dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
  if (f.stunT <= 0 && dir !== 0) {
    const a = f.onGround ? (f.accel || ACCEL) : AIR_ACCEL;
    f.vx += dir * a * dt;
    f.facing = dir;
    const cap = f.maxSpd || MAX_SPD;
    // knockback may exceed the run cap; only clamp input-driven speed
    if (sign(f.vx) === dir && Math.abs(f.vx) > cap) f.vx = dir * cap;
  }

  f.vx *= Math.exp(-(f.onGround ? FRICTION : AIR_DRAG) * dt);
  if (Math.abs(f.vx) < 2.5) f.vx = 0;
  f.x += finite(f.vx) * dt;

  if (inp.jump && f.onGround && f.stunT <= 0 && f.z <= 0) {
    f.vz = JUMP_V;
    f.onGround = false;
    f.jumped = true;
  }

  if (!f.onGround) {
    f.vz -= GRAVITY * dt;
    f.z += f.vz * dt;
    if (f.z <= 0) {
      f.z = 0;
      f.vz = 0;
      f.onGround = true;
      f.justLanded = true;
    }
  } else {
    f.z = 0;
    f.vz = 0;
  }

  f.blocking = !!inp.block && f.onGround && f.z < 2 && f.stunT <= 0 && f.dashT <= 0;
  const sp = Math.abs(f.vx);
  f.walkPhase = (f.walkPhase || 0) + (sp * 0.013 + (f.onGround ? 0 : 4)) * dt * 60;
  return f;
}

// Sword strike. Direction comes from the attacker's facing; a defender facing
// the attacker and holding block takes chip damage and reduced knockback.
export function resolveAttack(att, def, opts = {}) {
  if (!att || !def || att.fallen || def.fallen) return { hit: false, reason: 'gone' };
  const dx = def.x - att.x;
  const dz = Math.abs((def.z || 0) - (att.z || 0));
  if (Math.abs(dx) > ATTACK.range) return { hit: false, reason: 'range', dx };
  if (dx * att.facing < -10) return { hit: false, reason: 'behind', dx };
  if (dz > ATTACK.zRange) return { hit: false, reason: 'height', dz };
  if ((def.invulnT || 0) > 0) return { hit: false, reason: 'invuln', dx };

  const incoming = (att.x - def.x) * def.facing > 0;
  const blocked = !!def.blocking && incoming;
  const pushing = !!opts.push;
  const damage = blocked ? ATTACK.chip : ATTACK.damage;
  const kb = blocked ? ATTACK.chipKb : (pushing ? PUSH.attackKb : ATTACK.kb);

  def.hp = Math.max(0, (def.hp || 0) - damage);
  def.vx = (def.vx || 0) * 0.25 + att.facing * kb;
  def.vz = Math.max(def.vz || 0, blocked ? 40 : 128);
  def.onGround = false;
  def.stunT = Math.max(def.stunT || 0, blocked ? 0.16 : 0.28);
  def.blocking = false;
  def.flashT = 0.12;
  def.lastHit = { by: att.side, blocked, damage, kb, kind: 'sword' };

  return { hit: true, blocked, damage, kb, dir: att.facing, dx, push: pushing };
}

// Dash body-check. Momentum based: faster dash + faster relative approach
// produces a larger impulse, so a running shove feels physical.
export function resolveDash(att, def) {
  if (!att || !def || att.fallen || def.fallen) return null;
  if ((att.dashT || 0) <= 0 || att.dashHit) return null;
  if ((def.invulnT || 0) > 0) return null;
  const dx = def.x - att.x;
  const dz = Math.abs((def.z || 0) - (att.z || 0));
  if (Math.abs(dx) > 42 || dz > 56) return null;

  const dir = sign(att.vx) || att.facing || 1;
  const incoming = (att.x - def.x) * def.facing > 0;
  const blocked = !!def.blocking && incoming;
  const rel = Math.abs((att.vx || 0) - (def.vx || 0));
  const raw = PUSH.dashBase + rel * PUSH.dashMomentum;
  const impulse = raw * (blocked ? 0.45 : 1);

  def.vx = (def.vx || 0) * 0.35 + dir * impulse;
  def.vz = Math.max(def.vz || 0, blocked ? 55 : 150);
  def.onGround = false;
  def.stunT = Math.max(def.stunT || 0, 0.3);
  def.blocking = false;
  def.flashT = 0.14;
  def.lastHit = { by: att.side, blocked, damage: 0, kb: impulse, kind: 'dash' };

  att.dashHit = true;
  att.vx *= 0.4;
  return { hit: true, impulse, raw, blocked, dir, rel };
}

export function lampInZone(f) {
  return !!f && !f.fallen && f.onGround && (f.z || 0) < 8 &&
    (f.stunT || 0) <= 0 && Math.abs(f.x - CX) <= CAPTURE.zone;
}

// Test the central lamp. Standing alone charges; both inside contest and
// freeze both gauges (the "争灯" rule).
export function captureTick(f1, f2, dt) {
  const a = lampInZone(f1);
  const b = lampInZone(f2);
  if (a && b) return { contested: true, a, b, gain1: 0, gain2: 0 };
  let gain1 = 0, gain2 = 0;
  if (a) {
    gain1 = CAPTURE.rate * dt;
    f1.progress = Math.min(CAPTURE.goal, (f1.progress || 0) + gain1);
  }
  if (b) {
    gain2 = CAPTURE.rate * dt;
    f2.progress = Math.min(CAPTURE.goal, (f2.progress || 0) + gain2);
  }
  return { contested: false, a, b, gain1, gain2 };
}

export function ringOut(f, half = 300) {
  return !!f && !f.fallen && Math.abs(f.x - CX) > half;
}

// Duel / capture rounds are railed: fighters bounce softly off the deck edge
// instead of falling. The push round deliberately has no rails.
export function clampToDeck(f, half, bounce = 0.28) {
  if (!f || f.fallen) return f;
  const lo = CX - half + FIGHTER_R * 0.8;
  const hi = CX + half - FIGHTER_R * 0.8;
  if (f.x < lo) {
    f.x = lo;
    if (f.vx < 0) f.vx = -f.vx * bounce;
  } else if (f.x > hi) {
    f.x = hi;
    if (f.vx > 0) f.vx = -f.vx * bounce;
  }
  return f;
}

export function bodyOverlap(a, b) {
  if (!a || !b || a.fallen || b.fallen) return false;
  if (Math.abs((a.z || 0) - (b.z || 0)) > 44) return false;
  return Math.abs(a.x - b.x) < FIGHTER_R * 1.8;
}
