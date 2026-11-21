// Echo Hour — fixed-step platformer physics and shared numeric helpers.
// All geometry is axis-aligned; no slopes, no external libraries.

export const P = {
  w: 22, h: 32,
  accel: 2800, friction: 3200, maxSpd: 250,
  gravity: 1900, maxFall: 900, jump: 590,
  coyote: 0.09, jumpBuf: 0.11,
};

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function playerRect(pl) {
  return { x: pl.x, y: pl.y, w: P.w, h: P.h };
}

export function bodyRectFromFrame(f) {
  return { x: f.x, y: f.y, w: P.w, h: P.h };
}

export function makePlayer(level, x, y) {
  return {
    x: x != null ? x : level.start.x,
    y: y != null ? y : level.start.y,
    vx: 0, vy: 0,
    onGround: true, facing: 1,
    coyote: 0, jumpBuf: 0,
    alive: true, stride: 0, scarf: 0,
  };
}

export function respawnPlayer(pl, level) {
  pl.x = level.start.x; pl.y = level.start.y;
  pl.vx = 0; pl.vy = 0; pl.onGround = true; pl.facing = 1;
  pl.coyote = 0; pl.jumpBuf = 0; pl.alive = true; pl.stride = 0; pl.scarf = 0;
}

function resolveX(pl, solids) {
  const r = playerRect(pl);
  for (const s of solids) {
    if (!overlaps(r, s)) continue;
    if (pl.vx > 0) { pl.x = s.x - P.w; pl.vx = 0; }
    else if (pl.vx < 0) { pl.x = s.x + s.w; pl.vx = 0; }
    r.x = pl.x;
  }
}

function resolveY(pl, solids) {
  const r = playerRect(pl);
  for (const s of solids) {
    if (!overlaps(r, s)) continue;
    if (pl.vy > 0) { pl.y = s.y - P.h; pl.vy = 0; pl.onGround = true; }
    else if (pl.vy < 0) { pl.y = s.y + s.h; pl.vy = 0; }
    r.y = pl.y;
  }
}

// input: { dir:-1|0|1, jumpHeld, jumpPressed, push }  (push = conveyor px/s)
export function stepPlayer(pl, input, dt, solids) {
  pl.coyote = pl.onGround ? P.coyote : Math.max(0, pl.coyote - dt);
  if (input.jumpPressed) pl.jumpBuf = P.jumpBuf;
  else pl.jumpBuf = Math.max(0, pl.jumpBuf - dt);

  if (pl.jumpBuf > 0 && pl.coyote > 0) {
    pl.vy = -P.jump;
    pl.onGround = false; pl.coyote = 0; pl.jumpBuf = 0;
  }
  // short hop: releasing the key early cuts the rising arc
  if (!input.jumpHeld && pl.vy < -140) pl.vy += P.gravity * 1.45 * dt;

  const dir = clamp(input.dir | 0, -1, 1);
  if (dir) {
    pl.vx += dir * P.accel * dt;
    pl.vx = clamp(pl.vx, -P.maxSpd, P.maxSpd);
    pl.facing = dir;
  } else {
    const f = P.friction * dt;
    if (Math.abs(pl.vx) <= f) pl.vx = 0;
    else pl.vx -= Math.sign(pl.vx) * f;
  }

  pl.vy = Math.min(P.maxFall, pl.vy + P.gravity * dt);

  // conveyor carry
  if (input.push) pl.x += input.push * dt;

  pl.x += pl.vx * dt;
  resolveX(pl, solids);

  pl.onGround = false;
  pl.y += pl.vy * dt;
  resolveY(pl, solids);

  pl.stride += Math.abs(pl.vx) * dt * 0.055;
  pl.scarf += dt * (1.2 + Math.abs(pl.vx) * 0.004);
  if (!Number.isFinite(pl.x) || !Number.isFinite(pl.y) ||
      !Number.isFinite(pl.vx) || !Number.isFinite(pl.vy)) {
    // hard safety: never let a bad integration poison a whole run
    pl.x = Number.isFinite(pl.x) ? pl.x : 0;
    pl.y = Number.isFinite(pl.y) ? pl.y : 0;
    pl.vx = 0; pl.vy = 0;
  }
  return pl;
}

// period helper: u in [0,1) from a monotonic mechanism clock
export function phaseU(mechT, m) {
  const p = Math.max(0.001, m.period || 1);
  const u = ((mechT / p + (m.phase || 0)) % 1 + 1) % 1;
  return u;
}

export function ratingFor(level, cleared, time, rewinds) {
  if (!cleared) return 0;
  let s = 1;
  if (time <= level.par) s++;
  if (rewinds <= level.rewindPar) s++;
  return clamp(s, 0, 3);
}

export function starsSum(map) {
  let n = 0;
  for (const k in map) n += map[k] | 0;
  return n;
}
