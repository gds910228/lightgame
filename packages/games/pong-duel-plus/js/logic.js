// Pong Duel Plus 乒乓对决 — pure gameplay math.
// Ball / paddle / AI / power-up rules live here so the interactive game, the
// headless self-play benchmark and the autotest suite all share one engine.
// No DOM, no rendering, no audio, no random except the seeded RNG carried by
// the world object. Everything is deterministic for a given seed.

export const W = 960;
export const H = 540;
export const WALL_TOP = 46;
export const WALL_BOTTOM = H - 46;      // 494
export const BALL_R = 9;

export const PADDLE_W = 14;
export const PADDLE_H = 84;
export const PADDLE_LONG = 140;
export const PADDLE_X1 = 54;            // left paddle centre
export const PADDLE_X2 = W - 54;        // right paddle centre

export const HUMAN_SPEED = 560;         // px/s keyboard paddle speed
export const TOUCH_SPEED = 1500;        // px/s drag-follow speed
export const WIN_SCORE = 11;
export const SERVE_TIME = 1.35;         // short countdown after each point

export const BASE_SPEED = 640;
export const MIN_BALL = 420;
export const MAX_BALL = 3000;
export const SLOW_CAP = 1200;
export const HIT_ACCEL = 1.13;
export const HIT_SPEED = 36;
export const MAX_BOUNCE = 1.05;         // ±60° from paddle-hit offset
export const WALL_E = 0.98;

export const SPIN_GAIN = 0.85;
export const SPIN_MAX = 460;
export const SPIN_DECAY = 1.2;
export const SLOW_FACTOR = 0.58;

export const POW_SPAWN_MIN = 3.5;
export const POW_SPAWN_MAX = 6.5;
export const POW_RAD = 17;
export const POW_COLLECT_R = POW_RAD + BALL_R;

export const POWERUPS = Object.freeze({
  extend:  { key: 'extend',  zh: '长拍', dur: 8.0, color: '#58d8c0' },
  slow:    { key: 'slow',    zh: '慢球', dur: 7.0, color: '#8fd8ff' },
  phantom: { key: 'phantom', zh: '幻影', dur: 6.0, color: '#c59aff' },
});
export const POWER_ORDER = ['extend', 'slow', 'phantom'];

export const AI_PROFILES = {
  easy: {
    key: 'easy', label: '易', zh: '轻拍',
    speed: 190, reaction: 0.36, predict: 0.03, error: 86,
    edge: 0, spinRead: false, phantomError: 52,
  },
  medium: {
    key: 'medium', label: '中', zh: '稳拍',
    speed: 285, reaction: 0.16, predict: 0.72, error: 38,
    edge: 0.35, spinRead: false, phantomError: 22,
  },
  hard: {
    key: 'hard', label: '难', zh: '杀拍',
    speed: 360, reaction: 0.10, predict: 0.94, error: 12,
    edge: 1.0, spinRead: true, phantomError: 6,
  },
};
export const DIFF_ORDER = ['easy', 'medium', 'hard'];

export function diffKey(v) {
  if (typeof v === 'number' || /^[1-3]$/.test(String(v))) {
    const i = clamp((parseInt(v, 10) || 2) - 1, 0, 2);
    return DIFF_ORDER[i];
  }
  return AI_PROFILES[v] ? v : 'medium';
}

export const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;
export const clamp01 = (v) => clamp(v, 0, 1);
export const sign = (v) => v < 0 ? -1 : v > 0 ? 1 : 0;
export function finite(x, fallback = 0) {
  return Number.isFinite(x) ? x : fallback;
}

export function mulberry32(a) {
  let s = (a >>> 0) || 0x9e3779b9;
  return function () {
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Reflect a coordinate across [lo, hi] — used to predict wall bounces.
export function foldY(y, lo, hi) {
  if (!Number.isFinite(y)) return (lo + hi) / 2;
  if (hi <= lo) return (lo + hi) / 2;
  const span = hi - lo;
  let t = (y - lo) % (span * 2);
  if (t < 0) t += span * 2;
  return t <= span ? lo + t : lo + (span * 2 - t);
}

export function paddleMinY(p, h) {
  const hh = (h || p.h) / 2;
  return WALL_TOP + hh;
}
export function paddleMaxY(p, h) {
  const hh = (h || p.h) / 2;
  return WALL_BOTTOM - hh;
}

export function makePaddle(side) {
  return {
    side,
    x: side === 'p1' ? PADDLE_X1 : PADDLE_X2,
    y: H / 2,
    vy: 0,
    h: PADDLE_H,
    extendT: 0,
    hitFlash: 0,
  };
}

export function resetBall(world) {
  world.ball.x = W / 2;
  world.ball.y = H / 2;
  world.ball.vx = 0;
  world.ball.vy = 0;
  world.ball.spin = 0;
  world.lastHitter = world.server;
}

export function makeWorld(seed = 0x5EED2026) {
  const s = (seed >>> 0) || 0x5EED2026;
  const world = {
    seed: s,
    rng: mulberry32(s),
    time: 0,
    ball: { x: W / 2, y: H / 2, vx: 0, vy: 0, spin: 0 },
    p1: makePaddle('p1'),
    p2: makePaddle('p2'),
    score1: 0,
    score2: 0,
    server: 'p1',
    phase: 'serve',            // serve | live | ended
    serveT: SERVE_TIME,
    rally: 0,
    bestRally: 0,
    lastHitter: 'p1',
    powField: null,
    powSpawnT: POW_SPAWN_MIN,
    slowT: 0,
    slowSide: null,
    phantomT: 0,
    phantomSide: null,
    ai: {
      p1: { timer: 0, target: H / 2 },
      p2: { timer: 0, target: H / 2 },
    },
    winner: null,
    noAuto: false,
    powerupsEnabled: true,
    silent: false,
  };
  resetBall(world);
  return world;
}

// Re-seed a world in place without replacing object identity.
export function reseedWorld(world, seed) {
  const s = (seed >>> 0) || 0x5EED2026;
  world.seed = s;
  world.rng = mulberry32(s);
  world.powSpawnT = POW_SPAWN_MIN;
  return world;
}

export function resetWorld(world, seed) {
  if (seed !== undefined) reseedWorld(world, seed);
  world.time = 0;
  world.ball = { x: W / 2, y: H / 2, vx: 0, vy: 0, spin: 0 };
  world.p1 = makePaddle('p1');
  world.p2 = makePaddle('p2');
  world.score1 = 0;
  world.score2 = 0;
  world.server = 'p1';
  world.phase = 'serve';
  world.serveT = SERVE_TIME;
  world.rally = 0;
  world.bestRally = 0;
  world.lastHitter = 'p1';
  world.powField = null;
  world.powSpawnT = POW_SPAWN_MIN;
  world.slowT = 0;
  world.slowSide = null;
  world.phantomT = 0;
  world.phantomSide = null;
  world.ai.p1.timer = 0; world.ai.p1.target = H / 2;
  world.ai.p2.timer = 0; world.ai.p2.target = H / 2;
  world.winner = null;
  return world;
}

// ------------------------- paddles -------------------------
function clampPaddle(p, dt) {
  const lo = paddleMinY(p), hi = paddleMaxY(p);
  const before = p.y;
  p.y = clamp(p.y, lo, hi);
  if (dt > 0 && p.y !== before) p.vy = (p.y - before) / dt;
  if ((p.y <= lo + 1e-6 && p.vy < 0) || (p.y >= hi - 1e-6 && p.vy > 0)) p.vy = 0;
}

function movePaddle(p, intent, dt) {
  if (!intent) {
    p.vy *= Math.max(0, 1 - 18 * dt);
    if (Math.abs(p.vy) < 2) p.vy = 0;
    clampPaddle(p, dt);
    return;
  }
  if (intent.type === 'target') {
    const speed = Math.max(1, finite(intent.speed, HUMAN_SPEED));
    const ty = finite(intent.y, p.y);
    let d = ty - p.y;
    const maxStep = speed * dt;
    if (Math.abs(d) <= maxStep) {
      p.y = ty;
      p.vy = dt > 0 ? d / dt : 0;
    } else {
      const step = sign(d) * maxStep;
      p.y += step;
      p.vy = step / dt;
    }
  } else {
    const dir = clamp(finite(intent.dir, 0), -1, 1);
    const speed = Math.max(1, finite(intent.speed, HUMAN_SPEED));
    p.vy = dir * speed;
    p.y += p.vy * dt;
  }
  clampPaddle(p, dt);
}

function tickPaddleTimers(world, dt) {
  for (const p of [world.p1, world.p2]) {
    if (p.extendT > 0) {
      p.extendT = Math.max(0, p.extendT - dt);
      if (p.extendT <= 0) p.h = PADDLE_H;
      else p.h = PADDLE_LONG;
      clampPaddle(p, 0);
    }
    if (p.hitFlash > 0) p.hitFlash = Math.max(0, p.hitFlash - dt);
  }
}

// ------------------------- power-ups -------------------------
export function spawnPowerup(world, type) {
  const r = world.rng;
  const t = type && POWERUPS[type] ? type : POWER_ORDER[Math.floor(r() * POWER_ORDER.length) % 3];
  const x = W * 0.30 + r() * W * 0.40;
  const y = WALL_TOP + 70 + r() * (WALL_BOTTOM - WALL_TOP - 140);
  world.powField = { type: t, x, y, born: world.time };
  world.powSpawnT = POW_SPAWN_MIN + r() * (POW_SPAWN_MAX - POW_SPAWN_MIN);
  return world.powField;
}

export function grantPowerup(world, side, type) {
  const s = side === 'p2' ? 'p2' : 'p1';
  if (!POWERUPS[type]) return null;
  const p = s === 'p1' ? world.p1 : world.p2;
  if (type === 'extend') {
    p.extendT = POWERUPS.extend.dur;
    p.h = PADDLE_LONG;
    clampPaddle(p, 0);
  } else if (type === 'slow') {
    world.slowT = POWERUPS.slow.dur;
    world.slowSide = s;
    const b = world.ball;
    const sp = Math.hypot(b.vx, b.vy);
    if (sp > MIN_BALL) {
      const k = Math.max(SLOW_FACTOR, MIN_BALL / sp);
      b.vx *= k; b.vy *= k;
    }
  } else {
    world.phantomT = POWERUPS.phantom.dur;
    world.phantomSide = s;
  }
  return { side: s, type, dur: POWERUPS[type].dur };
}

function collectPowerup(world, events) {
  const f = world.powField;
  if (!f) return;
  const owner = world.lastHitter === 'p2' ? 'p2' : 'p1';
  const res = grantPowerup(world, owner, f.type);
  world.powField = null;
  world.powSpawnT = POW_SPAWN_MIN + world.rng() * (POW_SPAWN_MAX - POW_SPAWN_MIN);
  pushEv(events, { type: 'collect', side: owner, pow: f.type, x: f.x, y: f.y, dur: res ? res.dur : 0 });
}

// ------------------------- combat math -------------------------
// Pure hit resolution shared by the live game, previews and tests.
export function hitMath(side, ballY, paddleY, paddleVy, inSpeed, paddleH = PADDLE_H, maxSpeed = MAX_BALL) {
  const half = paddleH / 2 + BALL_R;
  const rel = clamp((finite(ballY, paddleY) - finite(paddleY, H / 2)) / half, -1, 1);
  const pvy = clamp(finite(paddleVy), -900, 900);
  const dir = side === 'p2' ? -1 : 1;
  const speed = clamp(finite(inSpeed, BASE_SPEED) * HIT_ACCEL + HIT_SPEED + Math.abs(pvy) * 0.06, MIN_BALL, maxSpeed);
  const angle = rel * MAX_BOUNCE;
  let vx = dir * Math.cos(angle) * speed;
  let vy = Math.sin(angle) * speed + pvy * 0.16;
  const sp = Math.hypot(vx, vy) || 1;
  vx = (vx / sp) * speed;
  vy = (vy / sp) * speed;
  const spin = clamp(pvy * SPIN_GAIN + rel * 24, -SPIN_MAX, SPIN_MAX);
  return { rel, angle, speed, vx, vy, spin };
}

function collidePaddle(world, side, events) {
  const b = world.ball;
  const p = side === 'p1' ? world.p1 : world.p2;
  if (side === 'p1' && b.vx >= 0) return false;
  if (side === 'p2' && b.vx <= 0) return false;
  const left = p.x - PADDLE_W / 2, right = p.x + PADDLE_W / 2;
  const top = p.y - p.h / 2, bottom = p.y + p.h / 2;
  const cx = clamp(b.x, left, right);
  const cy = clamp(b.y, top, bottom);
  const dx = b.x - cx, dy = b.y - cy;
  if (dx * dx + dy * dy > BALL_R * BALL_R + 1e-6) return false;

  // push the ball to the outer face of the paddle so it cannot sink in
  if (side === 'p1') b.x = right + BALL_R + 0.02;
  else b.x = left - BALL_R - 0.02;

  const inSpeed = Math.hypot(b.vx, b.vy) || BASE_SPEED;
  const maxSpd = world.slowT > 0 ? SLOW_CAP : MAX_BALL;
  const res = hitMath(side, b.y, p.y, p.vy, inSpeed, p.h, maxSpd);
  b.vx = res.vx; b.vy = res.vy; b.spin = res.spin;
  world.lastHitter = side;
  world.rally++;
  p.hitFlash = 0.14;
  pushEv(events, {
    type: 'hit', side, x: b.x, y: b.y,
    rel: res.rel, angle: res.angle, speed: res.speed, spin: res.spin,
    vx: b.vx, vy: b.vy, rally: world.rally,
  });
  return true;
}

function pushEv(events, ev) {
  if (events) events.push(ev);
}

// ------------------------- ball -------------------------
function stepBall(world, dt, events) {
  const b = world.ball;
  const sp0 = Math.hypot(b.vx, b.vy);
  const sub = Math.max(1, Math.min(8, Math.ceil((sp0 * dt) / 6)));
  const h = dt / sub;
  const maxSpd = world.slowT > 0 ? SLOW_CAP : MAX_BALL;

  for (let k = 0; k < sub; k++) {
    // spin bends the trajectory: apply a lateral acceleration, then keep the
    // speed in the legal band so the ball curves instead of speeding away.
    if (b.spin !== 0) {
      b.vy += b.spin * h;
      b.spin *= Math.exp(-SPIN_DECAY * h);
      if (Math.abs(b.spin) < 0.5) b.spin = 0;
    }
    let sp = Math.hypot(b.vx, b.vy);
    if (!Number.isFinite(sp)) { b.vx = 0; b.vy = 0; sp = 0; }
    if (sp > maxSpd) { b.vx = (b.vx / sp) * maxSpd; b.vy = (b.vy / sp) * maxSpd; sp = maxSpd; }
    else if (sp > 0 && sp < MIN_BALL) { b.vx = (b.vx / sp) * MIN_BALL; b.vy = (b.vy / sp) * MIN_BALL; sp = MIN_BALL; }

    b.x += b.vx * h;
    b.y += b.vy * h;

    const lo = WALL_TOP + BALL_R, hi = WALL_BOTTOM - BALL_R;
    if (b.y < lo) {
      b.y = lo;
      if (b.vy < 0) {
        b.vy = Math.abs(b.vy) * WALL_E;
        b.spin *= -0.35;
        pushEv(events, { type: 'wall', which: 'top', x: b.x, y: b.y, speed: Math.abs(b.vy) });
      }
    } else if (b.y > hi) {
      b.y = hi;
      if (b.vy > 0) {
        b.vy = -Math.abs(b.vy) * WALL_E;
        b.spin *= -0.35;
        pushEv(events, { type: 'wall', which: 'bottom', x: b.x, y: b.y, speed: Math.abs(b.vy) });
      }
    }

    collidePaddle(world, 'p1', events);
    collidePaddle(world, 'p2', events);

    if (world.powField) {
      const f = world.powField;
      const ddx = b.x - f.x, ddy = b.y - f.y;
      if (ddx * ddx + ddy * ddy <= POW_COLLECT_R * POW_COLLECT_R) collectPowerup(world, events);
    }

    if (b.x < -BALL_R) { pushEv(events, forceScore(world, 'p2')); return; }
    if (b.x > W + BALL_R) { pushEv(events, forceScore(world, 'p1')); return; }
  }
}

// Apply a point in a rules-correct way. Returns an event; safe to call from
// tests through G.forcePoint(). Exactly first-to-11: no win-by-two.
export function forceScore(world, side) {
  if (world.phase === 'ended') return null;
  const scorer = side === 'p2' ? 'p2' : 'p1';
  const atX = world.ball.x, atY = world.ball.y;
  if (scorer === 'p1') world.score1 = Math.min(WIN_SCORE, world.score1 + 1);
  else world.score2 = Math.min(WIN_SCORE, world.score2 + 1);
  const rally = world.rally;
  if (rally > world.bestRally) world.bestRally = rally;
  world.rally = 0;

  const winner = world.score1 >= WIN_SCORE ? 'p1' : world.score2 >= WIN_SCORE ? 'p2' : null;
  const ev = {
    type: 'score', side: scorer, score1: world.score1, score2: world.score2,
    rally, bestRally: world.bestRally, winner, x: atX, y: atY,
  };

  if (winner) {
    world.winner = winner;
    world.phase = 'ended';
    world.ball.x = W / 2; world.ball.y = H / 2;
    world.ball.vx = 0; world.ball.vy = 0; world.ball.spin = 0;
    world.powField = null;
    ev.server = null;
    return ev;
  }

  // serve alternates every point — keeps first-server advantage tiny
  world.server = scorer === 'p1' ? 'p2' : 'p1';
  world.phase = 'serve';
  world.serveT = SERVE_TIME;
  world.powField = null;
  world.powSpawnT = POW_SPAWN_MIN + world.rng() * (POW_SPAWN_MAX - POW_SPAWN_MIN);
  world.ai.p1.timer = 0;
  world.ai.p2.timer = 0;
  resetBall(world);
  world.lastHitter = world.server;
  ev.server = world.server;
  return ev;
}

function launchServe(world, events) {
  const dir = world.server === 'p1' ? 1 : -1;
  const a = (world.rng() * 2 - 1) * 0.22;
  const y = H / 2 + (world.rng() * 2 - 1) * 34;
  world.ball.x = W / 2;
  world.ball.y = y;
  world.ball.vx = dir * Math.cos(a) * BASE_SPEED;
  world.ball.vy = Math.sin(a) * BASE_SPEED;
  world.ball.spin = 0;
  world.lastHitter = world.server;
  world.rally = 0;
  world.phase = 'live';
  world.serveT = 0;
  world.ai.p1.timer = 0;
  world.ai.p2.timer = 0;
  pushEv(events, { type: 'serve', server: world.server, x: world.ball.x, y: world.ball.y });
}

// One fixed-step world advance. intents = { p1, p2 } where each is
// {type:'dir', dir} or {type:'target', y, speed}, or null.
export function stepWorld(world, intents, dt) {
  const events = world.silent ? null : [];
  if (!Number.isFinite(dt) || dt <= 0) return events || [];

  world.time += dt;
  tickPaddleTimers(world, dt);
  if (world.slowT > 0) world.slowT = Math.max(0, world.slowT - dt);
  if (world.phantomT > 0) world.phantomT = Math.max(0, world.phantomT - dt);
  if (world.slowT === 0) world.slowSide = null;
  if (world.phantomT === 0) world.phantomSide = null;

  movePaddle(world.p1, intents && intents.p1, dt);
  movePaddle(world.p2, intents && intents.p2, dt);

  if (world.phase === 'serve') {
    if (!world.noAuto) {
      world.serveT -= dt;
      if (world.serveT <= 0) launchServe(world, events);
    }
    return events || [];
  }
  if (world.phase !== 'live') return events || [];

  if (world.powerupsEnabled && !world.powField && !world.noAuto) {
    world.powSpawnT -= dt;
    if (world.powSpawnT <= 0) {
      const f = spawnPowerup(world);
      pushEv(events, { type: 'spawn', pow: f.type, x: f.x, y: f.y });
    }
  }

  stepBall(world, dt, events);
  return events || [];
}

// ------------------------- AI -------------------------
function phantomConfusion(world, side, profile) {
  if (world.phantomT > 0 && world.phantomSide && world.phantomSide !== side) {
    return profile.phantomError * (0.55 + 0.45 * Math.sin(world.time * 4.3 + 1.7));
  }
  return 0;
}

export function chooseAiTarget(world, side, profile) {
  const b = world.ball;
  const self = side === 'p1' ? world.p1 : world.p2;
  const opp = side === 'p1' ? world.p2 : world.p1;
  const lo = WALL_TOP + BALL_R + 2;
  const hi = WALL_BOTTOM - BALL_R - 2;
  const towardMe = side === 'p1' ? b.vx < -8 : b.vx > 8;

  // Both sides use the same deterministic error phase. Pong is mirrored about
  // the vertical axis (x -> W-x, y stays y), so identical phases make the two
  // AIs exact mirrors of each other and remove any side bias.
  let target = H / 2 + Math.sin(world.time * 0.85 + 0.4) * profile.error * 0.3;

  if (towardMe && b.vx !== 0) {
    const t = (self.x - b.x) / b.vx;
    if (t > 0 && t < 3.2) {
      let spinTerm = profile.spinRead ? 0.5 * b.spin * t * t : 0;
      const full = foldY(b.y + b.vy * t + spinTerm, lo, hi);
      const predicted = b.y + (full - b.y) * clamp01(profile.predict);
      let err = profile.error * Math.sin(world.time * 1.9 + 0.9)
        + profile.error * 0.45 * Math.sin(world.time * 3.3 + 2.1);
      err += phantomConfusion(world, side, profile);
      target = predicted + err;

      if (profile.edge > 0.01) {
        // Aim with the paddle edge: choose the contact offset that sends the
        // ball toward whichever corner the opponent is furthest from.
        const aimCorner = opp.y > H / 2 ? (WALL_BOTTOM - BALL_R - 26) : (WALL_TOP + BALL_R + 26);
        const dist = Math.max(120, Math.abs(W - 2 * self.x));
        let desired = Math.atan2(aimCorner - predicted, dist);
        desired = clamp(desired, -MAX_BOUNCE * 0.86, MAX_BOUNCE * 0.86);
        const offset = (desired / MAX_BOUNCE) * profile.edge;
        target = predicted + err * 0.35 - offset * (self.h / 2 + BALL_R);
      }
    }
  } else if (b.y > 24 && b.y < H - 24 && Math.abs(b.vx) < 30) {
    target = H / 2;
  }

  const min = WALL_TOP + self.h / 2;
  const max = WALL_BOTTOM - self.h / 2;
  return clamp(target, min, max);
}

export function aiIntent(world, side, profile, dt) {
  const ai = world.ai[side === 'p2' ? 'p2' : 'p1'];
  ai.timer -= dt;
  if (ai.timer <= 0) {
    ai.timer = Math.max(0.016, profile.reaction);
    ai.target = chooseAiTarget(world, side, profile);
  }
  return { type: 'target', y: ai.target, speed: profile.speed };
}

export function humanIntent(dir, speed = HUMAN_SPEED) {
  const d = clamp(finite(dir, 0), -1, 1);
  return { type: 'dir', dir: d, speed };
}

// ------------------------- headless self-play -------------------------
// One full first-to-11 match using the exact interactive rules. Used for the
// balance benchmark and by G.runSelfplay in the autotest suite.
export function simulateGame(opts = {}) {
  const p1Diff = diffKey(opts.p1Diff || opts.diff || 'medium');
  const p2Diff = diffKey(opts.p2Diff || opts.diff || 'medium');
  const prof1 = AI_PROFILES[p1Diff];
  const prof2 = AI_PROFILES[p2Diff];
  const seed = (opts.seed === undefined ? 0xBEEF : opts.seed) >>> 0;
  const world = makeWorld(seed);
  world.silent = true;
  world.powerupsEnabled = opts.powerups !== false;
  world.server = opts.firstServer === 'p2' ? 'p2' : 'p1';
  world.lastHitter = world.server;
  world.phase = 'serve';
  world.serveT = opts.fastServe === false ? SERVE_TIME : 0.28;
  const dt = 1 / 60;
  const maxSteps = Math.ceil((opts.maxSeconds || 240) * 60);
  let steps = 0;
  let timedOut = false;

  while (world.phase !== 'ended' && steps < maxSteps) {
    const i1 = aiIntent(world, 'p1', prof1, dt);
    const i2 = aiIntent(world, 'p2', prof2, dt);
    stepWorld(world, { p1: i1, p2: i2 }, dt);
    steps++;
  }
  if (world.phase !== 'ended') {
    timedOut = true;
    world.winner = world.score1 > world.score2 ? 'p1'
      : world.score2 > world.score1 ? 'p2'
        : ((seed >>> 3) % 2 ? 'p1' : 'p2');
    world.phase = 'ended';
  }
  return {
    winner: world.winner,
    score1: world.score1,
    score2: world.score2,
    bestRally: world.bestRally,
    seconds: Math.round(world.time * 100) / 100,
    steps,
    timedOut,
    p1Diff,
    p2Diff,
    firstServer: opts.firstServer === 'p2' ? 'p2' : 'p1',
    seed,
  };
}

export function runSelfplay(n, diff = 'medium', opts = {}) {
  const games = Math.max(1, parseInt(n, 10) || 1);
  const server = opts.server === 'p2' ? 'p2' : 'p1';
  const baseSeed = (opts.seed === undefined ? 1234567 : opts.seed) >>> 0;
  let p1Wins = 0, p2Wins = 0, timeouts = 0, points1 = 0, points2 = 0, rallySum = 0;
  const p1Diff = opts.p1Diff || diff;
  const p2Diff = opts.p2Diff || diff;
  for (let i = 0; i < games; i++) {
    const r = simulateGame({
      p1Diff, p2Diff, seed: (baseSeed + i * 7919) >>> 0, firstServer: server,
      powerups: opts.powerups !== false, maxSeconds: opts.maxSeconds || 240,
    });
    if (r.winner === 'p1') p1Wins++; else p2Wins++;
    if (r.timedOut) timeouts++;
    points1 += r.score1; points2 += r.score2; rallySum += r.bestRally;
  }
  return {
    n: games,
    p1Diff: diffKey(p1Diff), p2Diff: diffKey(p2Diff), server,
    p1Wins, p2Wins,
    p1Rate: p1Wins / games,
    p2Rate: p2Wins / games,
    timeouts,
    avgScore1: points1 / games,
    avgScore2: points2 / games,
    avgBestRally: rallySum / games,
  };
}

export function makeSelfplaySummary(n, diff, opts = {}) {
  const a = runSelfplay(n, diff, { ...opts, server: 'p1' });
  const b = runSelfplay(n, diff, { ...opts, server: 'p2' });
  return { p1Server: a, p2Server: b };
}
