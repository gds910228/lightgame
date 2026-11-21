// Emberpin 余烬弹珠台 — pure 2D physics helpers and the hand-authored table
// geometry. Coordinates are table-local: 540 × 880. No DOM, no state, so the
// collision math can be unit-probed from the G hooks.

export const VW = 560, VH = 900;            // logical viewport (table + margins)
export const TABLE = { x: 10, y: 10, w: 540, h: 880 };
export const BALL_R = 11;
export const GRAVITY = 1400;
export const MAX_SPEED = 2400;
export const WALL_E = 0.54;
export const LANE_FLOOR_Y = 852;
export const LANE_X = 496;
export const DRAIN_Y = 872;
export const FLIP_LEN = 80;
export const FLIP_RAD = 9;
export const FLIP_REST = 0.38;              // left rest angle; right mirrors
export const FLIP_ACTIVE = -0.44;           // left pressed angle; right mirrors
export const FLIP_SPEED_UP = 21;            // rad/s
export const FLIP_SPEED_DOWN = 9;

export const TARGET_SCORE = 60000;
export const MULT_CAP = 5;
export const COMBO_TIME = 2.4;
export const COMBO_CAP = 11;

// ---------------------------------------------------------------- helpers
export const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
export const finite = (v) => typeof v === 'number' && Number.isFinite(v);
export const hyp = (x, y) => Math.sqrt(x * x + y * y);

export function closestOnSeg(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const l2 = dx * dx + dy * dy;
  if (l2 < 1e-9) return { x: x1, y: y1, t: 0 };
  let t = ((px - x1) * dx + (py - y1) * dy) / l2;
  t = clamp(t, 0, 1);
  return { x: x1 + dx * t, y: y1 + dy * t, t };
}

// Segment collision. `kick` adds a normal impulse (used by slingshots).
export function collideSegment(ball, x1, y1, x2, y2, e = WALL_E, kick = 0, rad = 0) {
  const cp = closestOnSeg(ball.x, ball.y, x1, y1, x2, y2);
  let nx = ball.x - cp.x, ny = ball.y - cp.y;
  let d = hyp(nx, ny);
  const min = ball.r + rad;
  if (d >= min) return null;
  if (d < 1e-4) { nx = 0; ny = -1; d = 1e-4; } else { nx /= d; ny /= d; }
  ball.x = cp.x + nx * min;
  ball.y = cp.y + ny * min;
  const vn = ball.vx * nx + ball.vy * ny;
  if (vn < 0) {
    ball.vx -= (1 + e) * vn * nx;
    ball.vy -= (1 + e) * vn * ny;
  }
  if (kick) { ball.vx += nx * kick; ball.vy += ny * kick; }
  return { nx, ny, x: cp.x, y: cp.y, t: cp.t, impact: Math.abs(vn) };
}

// Circle post / bumper. `pop` is an extra radial impulse.
export function collideCircle(ball, cx, cy, cr, e = 0.7, pop = 0) {
  let nx = ball.x - cx, ny = ball.y - cy;
  let d = hyp(nx, ny);
  const min = ball.r + cr;
  if (d >= min) return null;
  if (d < 1e-4) { nx = 0; ny = -1; d = 1e-4; } else { nx /= d; ny /= d; }
  ball.x = cx + nx * min;
  ball.y = cy + ny * min;
  const vn = ball.vx * nx + ball.vy * ny;
  if (vn < 0) {
    ball.vx -= (1 + e) * vn * nx;
    ball.vy -= (1 + e) * vn * ny;
  }
  if (pop) { ball.vx += nx * pop; ball.vy += ny * pop; }
  return { nx, ny, impact: Math.abs(vn) };
}

// Rotating capsule (a flipper). `omega` is d(theta)/dt; the surface speed at
// the contact point feeds the relative velocity, so a sweeping flipper really
// transfers momentum instead of just blocking the ball.
export function collideCapsule(ball, ax, ay, bx, by, rad, e, omega, extra = 0) {
  const sx = bx - ax, sy = by - ay;
  const l2 = sx * sx + sy * sy;
  let t = l2 > 1e-9 ? ((ball.x - ax) * sx + (ball.y - ay) * sy) / l2 : 0;
  t = clamp(t, 0, 1);
  const cx = ax + sx * t, cy = ay + sy * t;
  let nx = ball.x - cx, ny = ball.y - cy;
  let d = hyp(nx, ny);
  const min = ball.r + rad;
  if (d >= min) return null;
  if (d < 1e-4) { nx = 0; ny = -1; d = 1e-4; } else { nx /= d; ny /= d; }
  ball.x = cx + nx * min;
  ball.y = cy + ny * min;
  // surface velocity at the contact point: omega * (-sy, sx) * t
  const pvx = -omega * sy * t, pvy = omega * sx * t;
  const rvx = ball.vx - pvx, rvy = ball.vy - pvy;
  const vn = rvx * nx + rvy * ny;
  if (vn < 0) {
    ball.vx -= (1 + e) * vn * nx;
    ball.vy -= (1 + e) * vn * ny;
  }
  if (extra && vn < 0) { ball.vx += nx * extra; ball.vy += ny * extra; }
  return { nx, ny, x: cx, y: cy, t, impact: Math.abs(vn), surf: Math.abs(omega) * t };
}

export function collideBalls(a, b, e = 0.72) {
  const dx = b.x - a.x, dy = b.y - a.y;
  let d = hyp(dx, dy);
  const min = a.r + b.r;
  if (d >= min || d < 1e-6) return null;
  const nx = dx / d, ny = dy / d;
  const push = (min - d) / 2;
  a.x -= nx * push; a.y -= ny * push;
  b.x += nx * push; b.y += ny * push;
  const rvx = b.vx - a.vx, rvy = b.vy - a.vy;
  const vn = rvx * nx + rvy * ny;
  if (vn < 0) {
    const j = -(1 + e) * vn / 2;
    a.vx -= j * nx; a.vy -= j * ny;
    b.vx += j * nx; b.vy += j * ny;
  }
  return { nx, ny, impact: Math.abs(vn) };
}

export function dampen(ball, dt, drag = 0.24) {
  const f = Math.exp(-drag * dt);
  ball.vx *= f; ball.vy *= f;
}

export function clampSpeed(ball, max = MAX_SPEED) {
  const sp = hyp(ball.vx, ball.vy);
  if (sp > max) { const k = max / sp; ball.vx *= k; ball.vy *= k; }
  return sp;
}

// ---------------------------------------------------------------- geometry
// Outer cabinet + rails, as segment pairs. The top is a 17-point hand-drawn
// arc so the launch lane feeds the ball into the upper playfield.
export const WALLS = [
  [18, 720, 18, 210],
  [18, 210, 20, 160], [20, 160, 32, 118], [32, 118, 54, 84], [54, 84, 86, 58],
  [86, 58, 124, 40], [124, 40, 166, 28], [166, 28, 210, 22], [210, 22, 270, 20],
  [270, 20, 330, 22], [330, 22, 374, 28], [374, 28, 416, 40], [416, 40, 454, 58],
  [454, 58, 486, 84], [486, 84, 508, 118], [508, 118, 520, 160], [520, 160, 522, 210],
  [522, 210, 522, 860],
  [470, 860, 470, 300],       // launch-lane divider
  [18, 720, 136, 806],        // left inlane guide
  [470, 720, 352, 806],       // right inlane guide
];

export const LANE_FLOOR = [470, LANE_FLOOR_Y, 522, LANE_FLOOR_Y];

export const BUMPERS = [
  { x: 140, y: 280, r: 28, key: 'left' },
  { x: 244, y: 218, r: 32, key: 'top' },
  { x: 348, y: 280, r: 28, key: 'right' },
];

export const RINGS = [
  { x: 80, y: 430, r: 20, key: 'left' },
  { x: 408, y: 430, r: 20, key: 'right' },
];

export const POSTS = [
  { x: 196, y: 484, r: 8 },
  { x: 292, y: 484, r: 8 },
];

// Slingshots: the hypotenuse is the live kicker face.
export const SLINGS = [
  { x1: 64, y1: 660, x2: 126, y2: 714, tri: [[64, 660], [64, 714], [126, 714]], key: 'left' },
  { x1: 424, y1: 660, x2: 362, y2: 714, tri: [[424, 660], [424, 714], [362, 714]], key: 'right' },
];

export const TARGET_GROUPS = [
  {
    label: '余火', color: '#e85a3e',
    targets: [
      [105, 350, 135, 350], [143, 350, 173, 350], [181, 350, 211, 350],
    ],
  },
  {
    label: '青焰', color: '#56c9b4',
    targets: [
      [277, 350, 307, 350], [315, 350, 345, 350], [353, 350, 383, 350],
    ],
  },
  {
    label: '金环', color: '#ffc76a',
    targets: [
      [196, 560, 226, 560], [234, 560, 264, 560], [272, 560, 302, 560],
    ],
  },
];

export const FLIP_PIVOTS = [
  { x: 150, y: 782, side: 'left' },
  { x: 338, y: 782, side: 'right' },
];

export const LANE_BALL = { x: LANE_X, y: 840 };

export function makeBall(x, y, vx = 0, vy = 0) {
  return { x, y, vx, vy, r: BALL_R, inLane: false, age: 0, trail: [] };
}

export function inLane(b) { return b.x > 476 && b.x < 524 && b.y > 780; }
