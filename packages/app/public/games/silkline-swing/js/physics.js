// Silkline Swing — deterministic swing physics.
// A rigid silk line: the player is kept exactly on a circle of radius L around
// the grabbed anchor; only tangential velocity survives. A/D pump with a
// horizontal acceleration while attached, W/S reel the line in/out, and
// releasing keeps the current (tangential) velocity for an inertia launch.
// All maths are pure and frame-rate independent (fixed 60 Hz step).

export const P = {
  G: 1300,          // gravity px/s²
  PUMP: 900,        // horizontal pump acceleration while on the line
  AIR: 300,         // air-control horizontal acceleration while free
  MAXV: 1650,       // velocity clamp px/s
  GRAB: 500,        // silk reach px
  LMIN: 90,         // shortest line px
  LMAX: 430,        // longest line px
  REEL: 330,        // reel speed px/s
  RAD: 11,          // player radius px
  DT: 1 / 60,
};

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export function distance(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }

// --- deterministic noise-free level generation RNG (levels.js uses mulberry32) ---

export function anchorPos(a, t) {
  if (a.type !== 'moving' || a.broken) return { x: a.x, y: a.y };
  return {
    x: a.x + Math.sin(t * a.speed + a.phase) * a.ampX,
    y: a.y + Math.sin(t * a.speed * 1.3 + a.phase) * a.ampY,
  };
}

/**
 * Pick the best reachable anchor. Forward anchors win over behind anchors;
 * among forward anchors the nearest one is chosen. A just-released anchor is
 * ignored briefly so release + re-grab cannot stick to the same ring.
 */
export function chooseAnchor(pl, level, t, forward) {
  let bestF = -1, dF = 1e9, bestB = -1, dB = 1e9;
  for (let i = 0; i < level.anchors.length; i++) {
    const a = level.anchors[i];
    if (a.broken) continue;
    if (pl.ignore === i && pl.ignoreT > 0) continue;
    const ap = anchorPos(a, t);
    const d = distance(pl.x, pl.y, ap.x, ap.y);
    if (d > P.GRAB || d < 28) continue;
    if ((ap.x - pl.x) * forward >= -24) {
      if (d < dF) { dF = d; bestF = i; }
    } else if (d < dB) { dB = d; bestB = i; }
  }
  return bestF >= 0 ? bestF : bestB;
}

export function makePlayer(level, x = level.start.x, y = level.start.y) {
  return {
    x, y, vx: 0, vy: 0, anchor: -1, L: 0, facing: 1, t: 0,
    ignore: -1, ignoreT: 0, grounded: false, alive: true,
    grabT: 0, deathReason: '',
  };
}

export function respawn(pl, x, y) {
  pl.x = x; pl.y = y; pl.vx = 0; pl.vy = 0; pl.anchor = -1; pl.L = 0;
  pl.ignore = -1; pl.ignoreT = 0; pl.grounded = false; pl.alive = true;
  pl.grabT = 0; pl.deathReason = '';
}

/**
 * Advance one fixed step.
 * input: { grab:boolean, dir:-1|0|1, reel:-1|0|1 }
 *   reel = -1 shortens the line (W), +1 lengthens it (S)
 * ev: optional callbacks { grab, release, break, shard, gate, death }
 */
export function stepPlayer(pl, level, input, dt, ev = {}) {
  pl.t += dt;
  if (pl.ignoreT > 0) pl.ignoreT = Math.max(0, pl.ignoreT - dt);

  // fragile silk degrades while held
  if (pl.anchor >= 0) {
    const held = level.anchors[pl.anchor];
    if (held && held.type === 'fragile') {
      held.fragT -= dt;
      if (held.fragT <= 0) {
        held.broken = true;
        pl.anchor = -1;
        pl.ignore = -1;
        if (ev.break) ev.break(held);
      }
    }
    if (pl.anchor >= 0) pl.grabT += dt;
  }

  // let go
  if (pl.anchor >= 0 && !input.grab) {
    pl.ignore = pl.anchor;
    pl.ignoreT = 0.8;
    pl.anchor = -1;
    if (ev.release) ev.release();
  }

  // grab
  if (pl.anchor < 0 && input.grab) {
    const idx = chooseAnchor(pl, level, pl.t, pl.facing);
    if (idx >= 0) {
      const ap = anchorPos(level.anchors[idx], pl.t);
      const d = distance(pl.x, pl.y, ap.x, ap.y);
      pl.anchor = idx;
      // the silk is paid out, then the keeper pulls in the slack on contact
      pl.L = clamp(d * 0.8, 120, 330);
      pl.grabT = 0;
      const a = level.anchors[idx];
      if (a.type === 'fragile' && a.fragT <= 0) a.fragT = 2.6;
      if (ev.grab) ev.grab(a, idx);
    }
  }

  if (input.dir) pl.facing = input.dir > 0 ? 1 : -1;

  if (pl.anchor >= 0) {
    const a = level.anchors[pl.anchor];
    const ap = anchorPos(a, pl.t);
    if (input.reel) pl.L = clamp(pl.L + input.reel * P.REEL * dt, P.LMIN, P.LMAX);
    pl.vx += input.dir * P.PUMP * dt;
    pl.vy += P.G * dt;
    pl.x += pl.vx * dt;
    pl.y += pl.vy * dt;
    // rigid line: project back onto the circle and kill radial velocity
    let dx = pl.x - ap.x, dy = pl.y - ap.y, d = Math.hypot(dx, dy);
    if (d < 1e-6) { dx = 0; dy = pl.L; d = pl.L; }
    const nx = dx / d, ny = dy / d;
    pl.x = ap.x + nx * pl.L;
    pl.y = ap.y + ny * pl.L;
    const vr = pl.vx * nx + pl.vy * ny;
    pl.vx -= vr * nx;
    pl.vy -= vr * ny;
  } else {
    pl.vx += input.dir * P.AIR * dt;
    pl.vy += P.G * dt;
    pl.x += pl.vx * dt;
    pl.y += pl.vy * dt;
  }

  // clamp speed
  const sp = Math.hypot(pl.vx, pl.vy);
  if (sp > P.MAXV) { pl.vx *= P.MAXV / sp; pl.vy *= P.MAXV / sp; }

  // wind zones push horizontally
  for (const w of level.winds) {
    if (pl.x > w.x && pl.x < w.x + w.w && pl.y > w.y && pl.y < w.y + w.h) {
      pl.vx += (w.vx || 0) * dt;
      pl.vy += (w.vy || 0) * dt;
    }
  }

  // platform collision (circle vs rect, resolve along smallest push)
  pl.grounded = false;
  for (const p of level.platforms) {
    const cx = clamp(pl.x, p.x, p.x + p.w), cy = clamp(pl.y, p.y, p.y + p.h);
    let dx = pl.x - cx, dy = pl.y - cy, d = Math.hypot(dx, dy);
    if (d >= P.RAD) continue;
    if (d < 1e-6) { dx = 0; dy = -1; d = 1; }
    const ux = dx / d, uy = dy / d;
    pl.x = cx + ux * P.RAD;
    pl.y = cy + uy * P.RAD;
    const vr = pl.vx * ux + pl.vy * uy;
    if (vr < 0) { pl.vx -= vr * ux; pl.vy -= vr * uy; }
    if (uy < -0.55) pl.grounded = true;
  }

  // spikes
  for (const s of level.spikes) {
    if (pl.x + P.RAD > s.x && pl.x - P.RAD < s.x + s.w &&
        pl.y + P.RAD > s.y && pl.y - P.RAD < s.y + s.h) {
      pl.alive = false; pl.deathReason = 'spike';
      if (ev.death) ev.death('spike');
      return;
    }
  }
  // abyss
  if (pl.y > level.killY) {
    pl.alive = false; pl.deathReason = 'abyss';
    if (ev.death) ev.death('abyss');
    return;
  }

  // star shards
  for (const sh of level.shards) {
    if (!sh.got && distance(pl.x, pl.y, sh.x, sh.y) < 64) {
      sh.got = true;
      if (ev.shard) ev.shard(sh);
    }
  }

  // star gate
  const g = level.gate;
  if (Math.abs(pl.x - g.x) < g.w / 2 + P.RAD && Math.abs(pl.y - g.y) < g.h / 2 + P.RAD) {
    if (ev.gate) ev.gate();
  }
}

// ==================== route probe / autopilot ====================
// A deterministic bot that plays with the exact same physics + anchor choice.
// Used at build time to place the three shards on a genuinely flyable route,
// and by the test suite to prove every level has a feasible route.

export function makeProbe(level) {
  return {
    pl: makePlayer(level),
    hold: 0, free: 0, target: 0,
    input: { grab: true, dir: 0, reel: 0 },
  };
}

export function probeControl(bot, level, dt) {
  const pl = bot.pl;
  const inp = bot.input;
  inp.grab = true; inp.dir = 0; inp.reel = 0;
  if (pl.anchor >= 0) {
    bot.hold += dt; bot.free = 0;
    bot.target = pl.anchor + 1;
    inp.dir = Math.sign(pl.vx) || 1;
    const next = level.anchors[bot.target];
    if (next && !next.broken) {
      const ap = anchorPos(next, pl.t);
      const d = distance(pl.x, pl.y, ap.x, ap.y);
      if (d < P.GRAB * 0.62 && bot.hold > 0.35 && pl.vx > -60) {
        inp.grab = false; bot.hold = 0; bot.free = 4;
      }
    }
  } else {
    if (bot.free > 0) { bot.free--; inp.grab = false; }
    const tgt = level.anchors[Math.min(bot.target, level.anchors.length - 1)];
    inp.dir = Math.sign((tgt ? tgt.x : level.gate.x) - pl.x) || 1;
  }
  return inp;
}

export function probeStep(bot, level, dt, ev = {}) {
  const inp = probeControl(bot, level, dt);
  stepPlayer(bot.pl, level, inp, dt, ev);
  return inp;
}

// Run the probe on a *runtime* level (anchors already cloned). Returns the
// trajectory and completion info; used by levels.js for shard placement.
export function probeRoute(level, maxT = 26) {
  const bot = makeProbe(level);
  const path = [];
  let gate = false;
  let deaths = 0;
  const ev = {
    gate: () => { gate = true; },
    death: () => { deaths++; },
  };
  const frames = Math.round(maxT / P.DT);
  for (let i = 0; i < frames; i++) {
    if (gate) break;
    probeStep(bot, level, P.DT, ev);
    const pl = bot.pl;
    if (!pl.alive) break;
    if (i % 5 === 0) path.push({ x: pl.x, y: pl.y });
  }
  return { ok: gate, t: bot.pl.t, path, shards: level.shards.filter(s => s.got).length, deaths };
}
