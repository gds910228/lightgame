// Frostpuck Arena — pure 2D air-hockey geometry and collision math.
// All coordinates are logical pixels on a 900 × 540 canvas.

export const W = 900;
export const H = 540;

export const TABLE = { x: 54, y: 78, w: 792, h: 404 };
export const MID_Y = TABLE.y + TABLE.h / 2;
export const GOAL_W = 160;
export const GOAL_L = W / 2 - GOAL_W / 2;
export const GOAL_R = W / 2 + GOAL_W / 2;

export const PUCK_R = 14;
export const PAD_R = 29;
export const PUCK_MASS = 1;
export const PAD_MASS = 7;
export const PUCK_PAD_E = 0.97;
export const WALL_E = 0.92;
export const MAX_PUCK_SPEED = 1380;
export const AIR_DRAG = 0.43;
export const ROLL_FRICTION = 9;

export const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;
export const clamp01 = (v) => clamp(v, 0, 1);

export function finite(x, fallback = 0) {
  return Number.isFinite(x) ? x : fallback;
}

export function speedOf(v) {
  return Math.hypot(v.vx || 0, v.vy || 0);
}

export function clampPuckSpeed(p, max = MAX_PUCK_SPEED) {
  const s = speedOf(p);
  if (!Number.isFinite(s)) { p.vx = 0; p.vy = 0; return 0; }
  if (s > max && s > 0) { const k = max / s; p.vx *= k; p.vy *= k; return max; }
  return s;
}

// Clamp a paddle to its own half of the rink.
export function clampPaddle(p, side) {
  p.r = PAD_R;
  p.x = clamp(finite(p.x, W / 2), TABLE.x + p.r, TABLE.x + TABLE.w - p.r);
  if (side === 'top') p.y = clamp(finite(p.y, TABLE.y + 100), TABLE.y + p.r, MID_Y - p.r);
  else p.y = clamp(finite(p.y, TABLE.y + TABLE.h - 100), MID_Y + p.r, TABLE.y + TABLE.h - p.r);
  p.vx = finite(p.vx);
  p.vy = finite(p.vy);
  return p;
}

// Reflect a predicted x coordinate across the rink side walls.
export function reflectX(x, lo, hi) {
  if (!Number.isFinite(x)) return W / 2;
  if (hi <= lo) return (lo + hi) / 2;
  const span = hi - lo;
  let t = (x - lo) % (span * 2);
  if (t < 0) t += span * 2;
  return t <= span ? lo + t : lo + (span * 2 - t);
}

export function predictX(x, vx, seconds, lo = TABLE.x + PUCK_R, hi = TABLE.x + TABLE.w - PUCK_R) {
  return reflectX(x + (finite(vx) * finite(seconds)), lo, hi);
}

// Resolve a puck/paddle overlap. Paddle is kinematic; impulse still uses mass.
export function collidePuckPaddle(puck, pad, hooks = {}) {
  let dx = puck.x - pad.x, dy = puck.y - pad.y;
  let d = Math.hypot(dx, dy);
  const rsum = puck.r + pad.r;
  if (!Number.isFinite(d) || d > rsum) return false;
  if (d < 1e-6) {
    dx = 0; dy = puck.y >= pad.y ? 1 : -1; d = 1;
  }
  const nx = dx / d, ny = dy / d;
  const pen = rsum - d;
  puck.x += nx * (pen + 0.12);
  puck.y += ny * (pen + 0.12);

  const pvx = clamp(finite(pad.vx), -1250, 1250);
  const pvy = clamp(finite(pad.vy), -1250, 1250);
  let rvx = finite(puck.vx) - pvx;
  let rvy = finite(puck.vy) - pvy;
  const vn = rvx * nx + rvy * ny;
  if (vn < 0) {
    const invP = 1 / PUCK_MASS, invPad = 1 / PAD_MASS;
    const j = -(1 + PUCK_PAD_E) * vn / (invP + invPad);
    puck.vx += nx * j * invP;
    puck.vy += ny * j * invP;
    // a whisper of tangential friction makes glancing hits feel physical
    const tx = -ny, ty = nx;
    const vt = rvx * tx + rvy * ty;
    puck.vx -= tx * vt * 0.045;
    puck.vy -= ty * vt * 0.045;
    if (hooks.onHit) hooks.onHit(pad, Math.abs(vn), nx, ny);
  }
  clampPuckSpeed(puck);
  return true;
}

// One fixed-step puck advance with sub-stepping, goal detection, wall bounce
// and paddle collision. Returns 'p1' / 'p2' when a goal was scored, else null.
export function stepPuck(puck, paddles, dt, hooks = {}) {
  if (!Number.isFinite(dt) || dt <= 0) return null;
  let s = speedOf(puck);
  if (!Number.isFinite(s)) { puck.vx = 0; puck.vy = 0; s = 0; }
  const sub = Math.max(1, Math.min(6, Math.ceil((s * dt) / 10)));
  const h = dt / sub;

  for (let k = 0; k < sub; k++) {
    // air drag + rolling friction
    const drag = Math.exp(-AIR_DRAG * h);
    puck.vx *= drag;
    puck.vy *= drag;
    const sp = speedOf(puck);
    if (sp > 0) {
      const dec = Math.min(sp, ROLL_FRICTION * h);
      puck.vx -= (puck.vx / sp) * dec;
      puck.vy -= (puck.vy / sp) * dec;
    }
    if (speedOf(puck) < 4) { puck.vx = 0; puck.vy = 0; }

    puck.x += finite(puck.vx) * h;
    puck.y += finite(puck.vy) * h;

    // Goal mouths: score as soon as the puck's leading edge crosses the line.
    const inMouth = puck.x >= GOAL_L && puck.x <= GOAL_R;
    if (inMouth && puck.y - puck.r <= TABLE.y) {
      puck.y = TABLE.y + 1;
      puck.vx = 0; puck.vy = 0;
      return 'p1';
    }
    if (inMouth && puck.y + puck.r >= TABLE.y + TABLE.h) {
      puck.y = TABLE.y + TABLE.h - 1;
      puck.vx = 0; puck.vy = 0;
      return 'p2';
    }

    // side walls
    if (puck.x - puck.r < TABLE.x) {
      puck.x = TABLE.x + puck.r;
      if (puck.vx < 0) { puck.vx = Math.abs(puck.vx) * WALL_E; if (hooks.onWall) hooks.onWall(-1, 0, Math.abs(puck.vx)); }
    } else if (puck.x + puck.r > TABLE.x + TABLE.w) {
      puck.x = TABLE.x + TABLE.w - puck.r;
      if (puck.vx > 0) { puck.vx = -Math.abs(puck.vx) * WALL_E; if (hooks.onWall) hooks.onWall(1, 0, Math.abs(puck.vx)); }
    }

    // top/bottom rails, except the goal mouths
    if (puck.y - puck.r < TABLE.y && !inMouth) {
      puck.y = TABLE.y + puck.r;
      if (puck.vy < 0) { puck.vy = Math.abs(puck.vy) * WALL_E; if (hooks.onWall) hooks.onWall(0, -1, Math.abs(puck.vy)); }
    } else if (puck.y + puck.r > TABLE.y + TABLE.h && !inMouth) {
      puck.y = TABLE.y + TABLE.h - puck.r;
      if (puck.vy > 0) { puck.vy = -Math.abs(puck.vy) * WALL_E; if (hooks.onWall) hooks.onWall(0, 1, Math.abs(puck.vy)); }
    }

    for (const pad of paddles) collidePuckPaddle(puck, pad, hooks);

    // last-resort containment: never let numerical edge cases escape the rink
    puck.x = clamp(finite(puck.x, W / 2), TABLE.x + puck.r, TABLE.x + TABLE.w - puck.r);
    puck.y = clamp(finite(puck.y, MID_Y), TABLE.y + puck.r, TABLE.y + TABLE.h - puck.r);
    clampPuckSpeed(puck);
  }
  return null;
}
