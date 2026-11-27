// Steel Frontier — pure 2D tank-duel simulation.
// No DOM, canvas or audio here: the same code drives the renderer and the
// headless AI self-play balance bench.

export const W = 960;
export const H = 540;
export const ARENA = { x: 26, y: 96, w: 908, h: 424 };
export const CENTER = { x: ARENA.x + ARENA.w / 2, y: ARENA.y + ARENA.h / 2 };
export const TANK_R = 17;
export const ROUND_TIME = 75;
export const ROUND_INTRO = 2.2;
export const ROUND_RESULT = 2.4;
export const WIN_SCORE = 3;
export const MAX_ROUNDS = 5;
export const MAP_SEQUENCE = [0, 1, 2, 1, 0];

export const WEAPONS = [
  { id: 'cannon',  name: '普通弹', en: 'Cannon',  short: '炮', color: '#ffd166', cooldown: 0.42, ammo: Infinity, damage: 12, speed: 520, ttl: 1.7, desc: '无限弹药 · 稳定直线弹' },
  { id: 'spread',  name: '散射',   en: 'Spread',  short: '散', color: '#ff9f43', cooldown: 1.15, ammo: 6,      damage: 6,  speed: 440, ttl: 1.05, pellets: 5, spread: 0.22, desc: '五连扇形 · 近身压制' },
  { id: 'laser',   name: '激光',   en: 'Laser',   short: '光', color: '#6ef3ff', cooldown: 1.6,  ammo: 4,      damage: 20, speed: 0,   ttl: 0,    range: 620, desc: '瞬时射线 · 掩体可挡' },
  { id: 'missile', name: '导弹',   en: 'Missile', short: '导', color: '#ff6b81', cooldown: 1.9,  ammo: 5,      damage: 22, speed: 238, ttl: 4.0,  homing: 2.7, splash: 10, blast: 58, desc: '缓慢追踪 · 爆炸溅射' },
  { id: 'mine',    name: '地雷',   en: 'Mine',    short: '雷', color: '#b8ff6e', cooldown: 2.2,  ammo: 3,      damage: 30, speed: 0,   ttl: 0,    arm: 0.65, blast: 62, desc: '布下陷阱 · 敌人触发' },
];

export const AI_PROFILES = {
  easy: {
    key: 'easy', label: '新兵', en: 'Rookie', num: 1,
    speed: 106, turret: 2.6, interval: 0.42, lead: 0.0, jitter: 0.16,
    fireTol: 0.22, range: 640, dodge: 0, cover: 0.05, mine: 0.04,
    aggression: 0.38, reaction: 0.45,
    desc: '巡逻为主 · 直线瞄准 · 偶尔开火',
  },
  medium: {
    key: 'medium', label: '老练', en: 'Veteran', num: 2,
    speed: 145, turret: 4.2, interval: 0.19, lead: 0.32, jitter: 0.065,
    fireTol: 0.14, range: 720, dodge: 0.28, cover: 0.35, mine: 0.18,
    aggression: 0.68, reaction: 0.2,
    desc: '截击走位 · 短前瞻 · 会避弹',
  },
  hard: {
    key: 'hard', label: '王牌', en: 'Ace', num: 3,
    speed: 168, turret: 6.4, interval: 0.085, lead: 0.44, jitter: 0.018,
    fireTol: 0.11, range: 800, dodge: 0.88, cover: 0.9, mine: 0.35,
    aggression: 0.92, reaction: 0.06,
    desc: '全图预判 · 掩体博弈 · 武器克制',
  },
};
export const DIFF_ORDER = ['easy', 'medium', 'hard'];
export const DIFF_LABEL = { easy: '新兵', medium: '老练', hard: '王牌' };

export const KEY_HINTS = {
  p1: 'WASD 移动 · F 开火 · 1-5 选武器 · Q/E 切换',
  p2: '方向键移动 · J 开火 · 6-0 选武器 · U/O 切换',
};

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const TAU = Math.PI * 2;
export function normAngle(a) {
  a = a % TAU;
  return a < -Math.PI ? a + TAU : a > Math.PI ? a - TAU : a;
}
export function angleDiff(a, b) { return normAngle(a - b); }

// ---------- deterministic RNG ----------
export function makeRng(seed) {
  let s = (seed >>> 0) || 1;
  return function () {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
function rand(t) {
  t.aiSeed = (Math.imul(t.aiSeed, 1664525) + 1013904223) >>> 0;
  return t.aiSeed / 4294967296;
}

// ---------- maps ----------
function mirrorRect(r) {
  return { x: 960 - r.x - r.w, y: 616 - r.y - r.h, w: r.w, h: r.h };
}
function sym(base) {
  const out = [];
  const seen = new Set();
  for (const r of base) {
    for (const q of [r, mirrorRect(r)]) {
      const key = `${q.x.toFixed(0)},${q.y.toFixed(0)},${q.w.toFixed(0)},${q.h.toFixed(0)}`;
      if (!seen.has(key)) { seen.add(key); out.push({ ...q }); }
    }
  }
  return out;
}

export const MAPS = [
  {
    id: 'foundry', name: '熔炉工厂', en: 'FOUNDRY', theme: 'steel',
    blurb: '对称货箱与中央双柱，短兵相接。',
    walls: sym([
      { x: 240, y: 160, w: 90, h: 24 },
      { x: 240, y: 184, w: 24, h: 90 },
      { x: 440, y: 240, w: 46, h: 46 },
      { x: 340, y: 296, w: 82, h: 18 },
    ]),
    spawns: [{ x: 140, y: 470 }, { x: 820, y: 146 }],
  },
  {
    id: 'dune', name: '沙丘遗迹', en: 'DUNE RELICS', theme: 'sand',
    blurb: '断墙长廊与斜向石柱，远程武器更有舞台。',
    walls: sym([
      { x: 190, y: 140, w: 120, h: 22 },
      { x: 190, y: 162, w: 22, h: 100 },
      { x: 340, y: 260, w: 22, h: 120 },
      { x: 460, y: 200, w: 42, h: 42 },
      { x: 300, y: 420, w: 110, h: 22 },
    ]),
    spawns: [{ x: 140, y: 470 }, { x: 820, y: 146 }],
  },
  {
    id: 'neon', name: '霓虹工厂', en: 'NEON WORKS', theme: 'neon',
    blurb: '中央断环制造视线死角，绕环抢位是关键。',
    walls: sym([
      { x: 420, y: 236, w: 120, h: 18 },
      { x: 384, y: 266, w: 18, h: 84 },
      { x: 210, y: 160, w: 110, h: 18 },
      { x: 760, y: 190, w: 18, h: 100 },
      { x: 250, y: 300, w: 80, h: 18 },
    ]),
    spawns: [{ x: 140, y: 470 }, { x: 820, y: 146 }],
  },
];

// ---------- geometry ----------
export function rectContains(r, x, y) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

export function circleRectHit(cx, cy, cr, r) {
  const nx = clamp(cx, r.x, r.x + r.w);
  const ny = clamp(cy, r.y, r.y + r.h);
  const dx = cx - nx, dy = cy - ny;
  return dx * dx + dy * dy < cr * cr;
}

export function pointBlocked(map, x, y, pad = 0) {
  if (x < ARENA.x + pad || x > ARENA.x + ARENA.w - pad || y < ARENA.y + pad || y > ARENA.y + ARENA.h - pad) return true;
  for (const r of map.walls) {
    if (x >= r.x - pad && x <= r.x + r.w + pad && y >= r.y - pad && y <= r.y + r.h + pad) return true;
  }
  return false;
}

export function circleBlocked(map, x, y, rad = TANK_R, pad = 0) {
  if (x - rad < ARENA.x + pad || x + rad > ARENA.x + ARENA.w - pad || y - rad < ARENA.y + pad || y + rad > ARENA.y + ARENA.h - pad) return true;
  for (const r of map.walls) if (circleRectHit(x, y, rad, r)) return true;
  return false;
}

// Liang-Barsky segment/rect intersection.
export function segRectHit(x1, y1, x2, y2, r) {
  let t0 = 0, t1 = 1;
  const dx = x2 - x1, dy = y2 - y1;
  const p = [-dx, dx, -dy, dy];
  const q = [x1 - r.x, r.x + r.w - x1, y1 - r.y, r.y + r.h - y1];
  for (let i = 0; i < 4; i++) {
    if (Math.abs(p[i]) < 1e-9) { if (q[i] < 0) return false; }
    else {
      const t = q[i] / p[i];
      if (p[i] < 0) { if (t > t1) return false; if (t > t0) t0 = t; }
      else { if (t < t0) return false; if (t < t1) t1 = t; }
    }
  }
  return t0 <= t1;
}

export function lineOfSight(map, x1, y1, x2, y2) {
  for (const r of map.walls) if (segRectHit(x1, y1, x2, y2, r)) return false;
  return true;
}

export function segmentCircleHit(x1, y1, x2, y2, cx, cy, rad) {
  const dx = x2 - x1, dy = y2 - y1;
  const l2 = dx * dx + dy * dy;
  let t = l2 > 0 ? ((cx - x1) * dx + (cy - y1) * dy) / l2 : 0;
  t = clamp(t, 0, 1);
  const px = x1 + dx * t, py = y1 + dy * t;
  const ex = cx - px, ey = cy - py;
  return ex * ex + ey * ey <= rad * rad;
}

function rayWallDist(map, x, y, ang, maxDist) {
  const ex = x + Math.cos(ang) * maxDist;
  const ey = y + Math.sin(ang) * maxDist;
  let best = maxDist;
  for (const r of map.walls) {
    // sample analytically via segment march: check endpoints then refine
    if (!segRectHit(x, y, ex, ey, r)) continue;
    let lo = 0, hi = 1;
    for (let i = 0; i < 22; i++) {
      const mid = (lo + hi) / 2;
      if (segRectHit(x, y, x + (ex - x) * mid, y + (ey - y) * mid, r)) hi = mid;
      else lo = mid;
    }
    best = Math.min(best, maxDist * hi);
  }
  const dx = x + Math.cos(ang) * best;
  const dy = y + Math.sin(ang) * best;
  if (dx < ARENA.x || dx > ARENA.x + ARENA.w) best = Math.min(best, Math.abs((dx < ARENA.x ? ARENA.x : ARENA.x + ARENA.w) - x) / Math.max(0.01, Math.abs(Math.cos(ang))));
  if (dy < ARENA.y || dy > ARENA.y + ARENA.h) best = Math.min(best, Math.abs((dy < ARENA.y ? ARENA.y : ARENA.y + ARENA.h) - y) / Math.max(0.01, Math.abs(Math.sin(ang))));
  return Math.max(0, best);
}

// ---------- match / tanks ----------
function armFor(diff) {
  const p = AI_PROFILES[diff] || AI_PROFILES.medium;
  return p;
}

export function makeTank(side, x, y, opts = {}) {
  const aiDiff = opts.aiDiff || null;
  const prof = aiDiff ? armFor(aiDiff) : null;
  const angle = Math.atan2(CENTER.y - y, CENTER.x - x);
  return {
    side, x, y, vx: 0, vy: 0, r: TANK_R,
    angle, bodyAngle: angle, turret: angle,
    hp: 100, maxHp: 100, alive: true,
    weapon: 0, ammo: WEAPONS.map(w => w.ammo),
    cooldown: WEAPONS.map(() => 0),
    maxSpeed: prof ? prof.speed : 166,
    turretSpeed: prof ? prof.turret : 7.0,
    aiDiff, profile: prof,
    aiSeed: (opts.seed || 1) + (side === 0 ? 0x9e3779b9 : 0x85ebca6b),
    aiTimer: 0, aiState: 'patrol', waypoint: null, waypointT: 0,
    control: { dx: 0, dy: 0, fire: false, switchTo: -1, cycle: 0, aimPoint: null },
    fireFlash: 0, hitFlash: 0, muzzle: angle,
    damage: 0, shots: 0, hits: 0, mines: 0,
    weaponShots: WEAPONS.map(() => 0), weaponHits: WEAPONS.map(() => 0),
  };
}

export function createBattle(mapIndex, opts = {}) {
  const map = MAPS[mapIndex % MAPS.length];
  const seed = opts.seed || 1;
  const ai0 = opts.ai0 || null;
  const ai1 = opts.ai1 || null;
  const t0 = makeTank(0, map.spawns[0].x, map.spawns[0].y, { aiDiff: ai0, seed });
  const t1 = makeTank(1, map.spawns[1].x, map.spawns[1].y, { aiDiff: ai1, seed: seed + 101 });
  t0.angle = Math.atan2(t1.y - t0.y, t1.x - t0.x);
  t1.angle = Math.atan2(t0.y - t1.y, t0.x - t1.x);
  t0.bodyAngle = t0.angle; t1.bodyAngle = t1.angle;
  t0.turret = t0.angle; t1.turret = t1.angle;
  return {
    mapIndex: mapIndex % MAPS.length, map, tanks: [t0, t1],
    projectiles: [], mines: [], beams: [], events: [],
    timeLeft: ROUND_TIME, elapsed: 0,
    phase: opts.phase || 'intro', countdown: ROUND_INTRO,
    winner: null, loser: null, reason: '', resultT: ROUND_RESULT,
    seed, freeze: false, noAuto: false,
    overtime: false,
  };
}

export function addEvent(b, type, data = {}) {
  const ev = { type, t: b.elapsed, ...data };
  b.events.push(ev);
  if (b.events.length > 120) b.events.splice(0, b.events.length - 120);
  return ev;
}

export function snapTank(t) {
  return {
    side: t.side, x: t.x, y: t.y, vx: t.vx, vy: t.vy, hp: t.hp, maxHp: t.maxHp,
    alive: t.alive, angle: t.angle, bodyAngle: t.bodyAngle, turret: t.turret,
    weapon: t.weapon, ammo: t.ammo.map(a => a === Infinity ? -1 : a),
    cooldown: t.cooldown.slice(), maxSpeed: t.maxSpeed, turretSpeed: t.turretSpeed,
    aiDiff: t.aiDiff, aiState: t.aiState, damage: t.damage, shots: t.shots, hits: t.hits,
    aiSeed: t.aiSeed, fireFlash: t.fireFlash, hitFlash: t.hitFlash,
  };
}

export function snapBattle(b) {
  return {
    mapIndex: b.mapIndex, mapId: b.map.id, phase: b.phase, timeLeft: b.timeLeft,
    elapsed: b.elapsed, countdown: b.countdown, winner: b.winner, reason: b.reason,
    resultT: b.resultT, freeze: b.freeze,
    p1: snapTank(b.tanks[0]), p2: snapTank(b.tanks[1]),
    projectiles: b.projectiles.map(p => ({ type: p.type, x: p.x, y: p.y, vx: p.vx, vy: p.vy, owner: p.owner, ttl: p.ttl })),
    mines: b.mines.map(m => ({ x: m.x, y: m.y, owner: m.owner, arm: m.arm, ttl: m.ttl })),
    beams: b.beams.map(x => ({ ...x })),
    events: b.events.slice(-20),
  };
}

// ---------- combat ----------
function damageTank(b, target, amount, source, kind) {
  if (!target.alive) return 0;
  const dealt = Math.min(target.hp, Math.max(0, amount));
  target.hp = Math.max(0, target.hp - amount);
  target.hitFlash = 0.16;
  if (source) { source.damage += dealt; source.hits++; const wk = WEAPONS.findIndex(w => w.id === kind); if (wk >= 0) source.weaponHits[wk]++; }
  addEvent(b, 'hit', { side: target.side, x: target.x, y: target.y, amount: dealt, kind, source: source ? source.side : -1 });
  if (target.hp <= 0) {
    target.alive = false;
    target.vx = target.vy = 0;
    addEvent(b, 'kill', { side: target.side, source: source ? source.side : -1 });
  }
  return dealt;
}

export function fireWeapon(b, tank, weaponIndex, target) {
  const wi = clamp(weaponIndex | 0, 0, WEAPONS.length - 1);
  const w = WEAPONS[wi];
  if (!tank.alive || tank.cooldown[wi] > 0 || tank.ammo[wi] <= 0) return false;
  tank.weapon = wi;
  tank.cooldown[wi] = w.cooldown;
  if (tank.ammo[wi] !== Infinity) tank.ammo[wi]--;
  tank.shots++;
  tank.weaponShots[wi]++;
  tank.fireFlash = 0.1;
  const a = tank.turret;
  const mx = tank.x + Math.cos(a) * (tank.r + 10);
  const my = tank.y + Math.sin(a) * (tank.r + 10);
  tank.muzzle = a;
  addEvent(b, 'fire', { side: tank.side, x: mx, y: my, angle: a, weapon: wi });

  if (w.id === 'laser') {
    let dist = rayWallDist(b.map, mx, my, a, w.range);
    let hitTarget = null;
    if (target && target.alive) {
      const d = Math.hypot(target.x - mx, target.y - my);
      if (d < dist && segmentCircleHit(mx, my, mx + Math.cos(a) * dist, my + Math.sin(a) * dist, target.x, target.y, target.r + 4)) {
        dist = d; hitTarget = target;
      }
    }
    const ex = mx + Math.cos(a) * dist, ey = my + Math.sin(a) * dist;
    b.beams.push({ x1: mx, y1: my, x2: ex, y2: ey, owner: tank.side, life: 0.2, color: w.color });
    if (hitTarget) damageTank(b, hitTarget, w.damage, tank, 'laser');
    addEvent(b, 'laser', { side: tank.side, x1: mx, y1: my, x2: ex, y2: ey, hit: !!hitTarget });
    return true;
  }
  if (w.id === 'mine') {
    const mx2 = tank.x - Math.cos(a) * 28, my2 = tank.y - Math.sin(a) * 28;
    b.mines.push({ x: clamp(mx2, ARENA.x + 10, ARENA.x + ARENA.w - 10), y: clamp(my2, ARENA.y + 10, ARENA.y + ARENA.h - 10), owner: tank.side, arm: w.arm, ttl: 30, damage: w.damage, blast: w.blast });
    addEvent(b, 'mineDrop', { side: tank.side, x: mx2, y: my2 });
    return true;
  }
  const n = w.pellets || 1;
  for (let i = 0; i < n; i++) {
    const off = n === 1 ? 0 : (i / (n - 1) - 0.5) * w.spread * 2;
    const aa = a + off + (rand(tank) - 0.5) * 0.018;
    b.projectiles.push({
      type: w.id, owner: tank.side, x: mx, y: my,
      vx: Math.cos(aa) * w.speed, vy: Math.sin(aa) * w.speed,
      r: w.id === 'missile' ? 5.5 : 4, damage: w.damage,
      ttl: w.ttl, homing: w.homing || 0, splash: w.splash || 0, blast: w.blast || 0,
      age: 0, trail: [],
    });
  }
  return true;
}

function explode(b, x, y, ownerSide, damage, blast, sourceTank, kind = 'explode') {
  let hit = false;
  for (const t of b.tanks) {
    if (!t.alive || t.side === ownerSide) continue;
    const d = Math.hypot(t.x - x, t.y - y);
    if (d <= blast + t.r) {
      const fall = 1 - Math.min(1, d / (blast + t.r)) * 0.35;
      damageTank(b, t, Math.round(damage * fall), sourceTank, kind);
      hit = true;
    }
  }
  addEvent(b, 'explode', { x, y, side: ownerSide, radius: blast, kind, hit });
}

function updateProjectiles(b, dt) {
  const out = [];
  for (const p of b.projectiles) {
    p.ttl -= dt; p.age += dt;
    if (p.ttl <= 0) continue;
    if (p.trail) {
      p.trail.push({ x: p.x, y: p.y });
      if (p.trail.length > 7) p.trail.shift();
    }
    if (p.homing) {
      const enemy = b.tanks[1 - p.owner];
      if (enemy && enemy.alive) {
        const desired = Math.atan2(enemy.y - p.y, enemy.x - p.x);
        const cur = Math.atan2(p.vy, p.vx);
        let d = angleDiff(desired, cur);
        d = clamp(d, -p.homing * dt, p.homing * dt);
        const na = cur + d;
        const spd = Math.hypot(p.vx, p.vy);
        p.vx = Math.cos(na) * spd; p.vy = Math.sin(na) * spd;
      }
    }
    // substep to avoid tunnelling at 60 Hz
    const steps = Math.max(1, Math.ceil(Math.hypot(p.vx, p.vy) * dt / 7));
    let dead = false;
    for (let s = 0; s < steps && !dead; s++) {
      const nx = p.x + (p.vx * dt) / steps;
      const ny = p.y + (p.vy * dt) / steps;
      for (const r of b.map.walls) {
        if (segRectHit(p.x, p.y, nx, ny, r)) {
          if (p.type === 'missile') explode(b, p.x, p.y, p.owner, p.damage + p.splash, p.blast, b.tanks[p.owner], 'missile');
          else addEvent(b, 'spark', { x: p.x, y: p.y, side: p.owner });
          dead = true; break;
        }
      }
      if (dead) break;
      if (nx < ARENA.x || nx > ARENA.x + ARENA.w || ny < ARENA.y || ny > ARENA.y + ARENA.h) {
        addEvent(b, 'spark', { x: nx, y: ny, side: p.owner }); dead = true; break;
      }
      const enemy = b.tanks[1 - p.owner];
      if (enemy && enemy.alive && segmentCircleHit(p.x, p.y, nx, ny, enemy.x, enemy.y, enemy.r + p.r)) {
        if (p.type === 'missile') {
          damageTank(b, enemy, p.damage, b.tanks[p.owner], 'missile');
          explode(b, nx, ny, p.owner, p.splash, p.blast, b.tanks[p.owner], 'missile');
        } else {
          damageTank(b, enemy, p.damage, b.tanks[p.owner], p.type);
        }
        dead = true; break;
      }
      p.x = nx; p.y = ny;
    }
    if (!dead) out.push(p);
  }
  b.projectiles = out;
}

function updateMines(b, dt) {
  const out = [];
  for (const m of b.mines) {
    m.arm -= dt; m.ttl -= dt;
    if (m.ttl <= 0) continue;
    let boom = false;
    if (m.arm <= 0) {
      for (const t of b.tanks) {
        if (!t.alive || t.side === m.owner) continue;
        if (Math.hypot(t.x - m.x, t.y - m.y) < t.r + 12) { boom = true; break; }
      }
    }
    if (boom) {
      explode(b, m.x, m.y, m.owner, m.damage, m.blast, b.tanks[m.owner], 'mine');
      continue;
    }
    out.push(m);
  }
  b.mines = out;
}

// ---------- movement ----------
function resolveMove(b, tank, dx, dy) {
  const nx = tank.x + dx;
  if (!circleBlocked(b.map, nx, tank.y, tank.r)) tank.x = nx; else tank.vx = 0;
  const ny = tank.y + dy;
  if (!circleBlocked(b.map, tank.x, ny, tank.r)) tank.y = ny; else tank.vy = 0;
}

function moveTank(b, tank, dt, ctl) {
  let dx = ctl.dx || 0, dy = ctl.dy || 0;
  if (ctl.moveAngle !== undefined && ctl.moveAngle !== null) {
    dx = Math.cos(ctl.moveAngle); dy = Math.sin(ctl.moveAngle);
  }
  const len = Math.hypot(dx, dy);
  if (len > 0.01) { dx /= len; dy /= len; }
  const tx = dx * tank.maxSpeed, ty = dy * tank.maxSpeed;
  const k = Math.min(1, 12 * dt);
  tank.vx = lerp(tank.vx, tx, k);
  tank.vy = lerp(tank.vy, ty, k);
  const ox = tank.x, oy = tank.y;
  resolveMove(b, tank, tank.vx * dt, tank.vy * dt);
  const moved = Math.hypot(tank.x - ox, tank.y - oy);
  if (moved > 0.15) tank.bodyAngle = Math.atan2(tank.y - oy, tank.x - ox);
}

function updateTurrets(b, dt) {
  for (const t of b.tanks) {
    if (!t.alive) continue;
    const enemy = b.tanks[1 - t.side];
    let desired;
    if (t.control.aimPoint) desired = Math.atan2(t.control.aimPoint.y - t.y, t.control.aimPoint.x - t.x);
    else if (enemy && enemy.alive) desired = Math.atan2(enemy.y - t.y, enemy.x - t.x);
    else desired = t.bodyAngle;
    const d = angleDiff(desired, t.turret);
    const step = t.turretSpeed * dt;
    t.turret = normAngle(t.turret + clamp(d, -step, step));
    t.fireFlash = Math.max(0, t.fireFlash - dt);
    t.hitFlash = Math.max(0, t.hitFlash - dt);
    for (let i = 0; i < t.cooldown.length; i++) t.cooldown[i] = Math.max(0, t.cooldown[i] - dt);
  }
}

// ---------- AI ----------
function canSee(b, a, t) { return lineOfSight(b.map, a.x, a.y, t.x, t.y); }

function chooseWaypoint(b, t) {
  for (let i = 0; i < 20; i++) {
    const x = ARENA.x + 60 + rand(t) * (ARENA.w - 120);
    const y = ARENA.y + 60 + rand(t) * (ARENA.h - 120);
    if (!circleBlocked(b.map, x, y, t.r + 8)) return { x, y };
  }
  return { x: CENTER.x, y: CENTER.y };
}

function steer(b, t, desiredX, desiredY) {
  const base = Math.atan2(desiredY - t.y, desiredX - t.x);
  const offsets = [0, 0.35, -0.35, 0.7, -0.7, 1.05, -1.05, 1.45, -1.45, 1.9, -1.9, 2.4, -2.4, Math.PI];
  let bestA = base, bestScore = -Infinity;
  for (const off of offsets) {
    const a = base + off;
    const px = t.x + Math.cos(a) * 46, py = t.y + Math.sin(a) * 46;
    if (circleBlocked(b.map, px, py, t.r + 2)) continue;
    const score = Math.cos(off) * 1.2 - Math.abs(off) * 0.1;
    if (score > bestScore) { bestScore = score; bestA = a; }
  }
  return bestA;
}

function projectileThreat(b, t) {
  let threat = null, minT = 99;
  for (const p of b.projectiles) {
    if (p.owner === t.side) continue;
    const d = Math.hypot(p.x - t.x, p.y - t.y);
    if (d > 190) continue;
    const ang = Math.atan2(p.y - t.y, p.x - t.x);
    const pAng = Math.atan2(p.vy, p.vx);
    if (Math.abs(angleDiff(ang, pAng)) < 0.45) {
      const tt = d / Math.max(80, Math.hypot(p.vx, p.vy));
      if (tt < minT) { minT = tt; threat = p; }
    }
  }
  return threat;
}

function bestWeaponFor(b, t, enemy, dist, los) {
  const ammo = t.ammo;
  const prof = t.profile;
  if (prof.key === 'easy') {
    if (dist < 170 && ammo[1] > 0 && rand(t) < 0.45) return 1;
    if (dist < 120 && ammo[4] > 0 && rand(t) < 0.10) return 4;
    return 0;
  }
  if (prof.key === 'medium') {
    if (los && dist < 520 && ammo[2] > 0 && rand(t) < 0.55) return 2;
    if (!los && dist > 150 && dist < 540 && ammo[3] > 0) return 3;
    if (dist < 220 && ammo[1] > 0) return 1;
    if (dist < 105 && ammo[4] > 0 && rand(t) < 0.45) return 4;
    return 0;
  }
  // ace: line-of-sight laser, else homing missile, spread at knife range
  if (los && dist < 600 && ammo[2] > 0 && t.cooldown[2] <= 0.02) return 2;
  if (dist < 245 && ammo[1] > 0 && t.cooldown[1] <= 0.03) return 1;
  if (!los && dist < 560 && ammo[3] > 0) return 3;
  if (dist < 125 && ammo[4] > 0 && t.cooldown[4] <= 0.05) return 4;
  return 0;
}

function aiThink(b, t, dt) {
  const enemy = b.tanks[1 - t.side];
  const prof = t.profile;
  if (!prof || !t.alive || !enemy || !enemy.alive) {
    t.control = { dx: 0, dy: 0, fire: false, switchTo: -1, cycle: 0, aimPoint: null };
    return;
  }
  t.aiTimer -= dt;
  if (t.aiTimer > 0) return;
  t.aiTimer = prof.interval * (0.85 + rand(t) * 0.3);
  const dx = enemy.x - t.x, dy = enemy.y - t.y;
  const dist = Math.hypot(dx, dy);
  const los = canSee(b, t, enemy);
  const ctl = { dx: 0, dy: 0, fire: false, switchTo: -1, cycle: 0, aimPoint: null };

  // predictive aim point
  const lead = prof.lead;
  const aimX = enemy.x + enemy.vx * lead;
  const aimY = enemy.y + enemy.vy * lead;
  const jitter = (rand(t) - 0.5) * 2 * prof.jitter;
  const aa = Math.atan2(aimY - t.y, aimX - t.x) + jitter;
  ctl.aimPoint = { x: t.x + Math.cos(aa) * 1000, y: t.y + Math.sin(aa) * 1000 };

  // state machine: patrol -> intercept -> engage/retreat
  if (t.aiState === 'retreat' && (t.hp > 48 || !prof.cover)) t.aiState = 'engage';
  if (t.aiState === 'patrol') {
    t.waypointT -= prof.interval;
    if (!t.waypoint || t.waypointT <= 0 || Math.hypot(t.waypoint.x - t.x, t.waypoint.y - t.y) < 32) {
      t.waypoint = chooseWaypoint(b, t); t.waypointT = 2.6 + rand(t) * 2.2;
    }
    const wp = t.waypoint;
    const a = steer(b, t, wp.x, wp.y);
    ctl.moveAngle = a;
    if (los && dist < 470) t.aiState = 'intercept';
  } else if (t.aiState === 'intercept') {
    if (los && dist < 380) t.aiState = 'engage';
    const tx = los ? aimX : enemy.x;
    const ty = los ? aimY : enemy.y;
    const a = steer(b, t, tx, ty);
    ctl.moveAngle = a;
    if (prof.key === 'easy' && rand(t) < 0.01) t.aiState = 'patrol';
  } else if (t.aiState === 'engage') {
    if (!los || dist > 520) t.aiState = 'intercept';
    if (prof.cover > 0.3 && t.hp < 32 && rand(t) < prof.cover * 0.4) t.aiState = 'retreat';
    const strafe = Math.atan2(dy, dx) + Math.PI / 2 * (rand(t) < 0.5 ? 1 : -1);
    let ang;
    if (dist > 270) ang = steer(b, t, enemy.x, enemy.y);
    else if (dist < 150) ang = steer(b, t, t.x - dx, t.y - dy);
    else ang = steer(b, t, t.x + Math.cos(strafe) * 80, t.y + Math.sin(strafe) * 80);
    ctl.moveAngle = ang;
  } else if (t.aiState === 'retreat') {
    const a = steer(b, t, t.x - dx, t.y - dy);
    ctl.moveAngle = a;
    if (dist > 430) t.aiState = 'intercept';
  }
  if (!t.aiState) t.aiState = 'patrol';

  // dodge incoming shells
  if (prof.dodge > 0) {
    const threat = projectileThreat(b, t);
    if (threat && rand(t) < prof.dodge) {
      const dangerA = Math.atan2(t.y - threat.y, t.x - threat.x);
      ctl.moveAngle = dangerA + (rand(t) < 0.5 ? 1 : -1) * Math.PI / 2;
      t.aiState = 'engage';
    }
  }

  // weapon choice + trigger
  if (dist < prof.range && (los || prof.key !== 'easy')) {
    const wi = bestWeaponFor(b, t, enemy, dist, los);
    if (wi !== t.weapon && (t.ammo[wi] > 0 || wi === 0)) ctl.switchTo = wi;
    const w = WEAPONS[wi];
    const targetAngle = Math.atan2(aimY - t.y, aimX - t.x);
    const aimErr = Math.abs(angleDiff(targetAngle, t.turret));
    const fireChance = prof.key === 'easy' ? 0.62 : prof.key === 'medium' ? 0.9 : 0.99;
    if (aimErr < prof.fireTol + (prof.key === 'easy' ? 0.1 : 0) && rand(t) < fireChance) {
      if (w.id === 'mine') { if (dist < 180) ctl.fire = true; }
      else if (w.id !== 'laser' || los) ctl.fire = true;
    }
  }
  t.control = ctl;
}

// ---------- main round update ----------
export function updateBattle(b, dt, playerInputs = null, opts = {}) {
  const freeze = opts.freeze !== undefined ? opts.freeze : b.freeze;
  b.freeze = !!freeze;
  b.events.length = 0;
  if (b.phase === 'intro') {
    if (!freeze) {
      b.countdown -= dt;
      if (b.countdown <= 0) { b.phase = 'live'; b.countdown = 0; addEvent(b, 'roundStart'); }
    }
    return b;
  }
  if (b.phase === 'result') {
    if (!freeze) b.resultT -= dt;
    return b;
  }
  if (b.phase !== 'live') return b;

  b.elapsed += dt;
  if (!freeze) b.timeLeft = Math.max(0, b.timeLeft - dt);

  // AI control (per-side)
  for (const t of b.tanks) {
    if (!t.alive) { t.control = { dx: 0, dy: 0, fire: false, switchTo: -1, cycle: 0, aimPoint: null }; continue; }
    if (t.aiDiff) {
      aiThink(b, t, dt);
    } else if (playerInputs && playerInputs[t.side]) {
      const inp = playerInputs[t.side];
      t.control = {
        dx: inp.dx || 0, dy: inp.dy || 0, fire: !!inp.fire,
        switchTo: Number.isInteger(inp.switchTo) ? inp.switchTo : -1,
        cycle: inp.cycle || 0, aimPoint: null,
      };
    } else {
      t.control = { dx: 0, dy: 0, fire: false, switchTo: -1, cycle: 0, aimPoint: null };
    }
  }

  // movement + turrets
  for (const t of b.tanks) {
    if (!t.alive) continue;
    if (t.control.switchTo >= 0 && t.control.switchTo < WEAPONS.length) t.weapon = t.control.switchTo;
    else if (t.control.cycle) t.weapon = (t.weapon + t.control.cycle + WEAPONS.length) % WEAPONS.length;
    moveTank(b, t, dt, t.control);
  }
  updateTurrets(b, dt);
  for (const t of b.tanks) {
    if (!t.alive) continue;
    const enemy = b.tanks[1 - t.side];
    if (t.control.fire && enemy && enemy.alive) {
      const wi = t.weapon;
      const targetAngle = Math.atan2(enemy.y - t.y, enemy.x - t.x);
      const tol = t.aiDiff ? AI_PROFILES[t.aiDiff].fireTol + 0.06 : 0.23;
      if (Math.abs(angleDiff(targetAngle, t.turret)) < tol) fireWeapon(b, t, wi, enemy);
    }
  }

  updateProjectiles(b, dt);
  updateMines(b, dt);
  for (const beam of b.beams) beam.life -= dt;
  b.beams = b.beams.filter(x => x.life > 0);

  // end checks
  const [a, c] = b.tanks;
  if (!a.alive || !c.alive) {
    let winner, reason;
    if (!a.alive && !c.alive) { winner = tiebreak(b); reason = 'mutual'; }
    else { winner = a.alive ? 0 : 1; reason = 'ko'; }
    finishRound(b, winner, reason);
  } else if (b.timeLeft <= 0) {
    let winner;
    if (a.hp !== c.hp) winner = a.hp > c.hp ? 0 : 1;
    else winner = tiebreak(b);
    finishRound(b, winner, 'timeout');
  }
  return b;
}

function tiebreak(b) {
  const [a, c] = b.tanks;
  if (a.damage !== c.damage) return a.damage > c.damage ? 0 : 1;
  const da = Math.hypot(a.x - CENTER.x, a.y - CENTER.y);
  const dc = Math.hypot(c.x - CENTER.x, c.y - CENTER.y);
  if (Math.abs(da - dc) > 1) return da < dc ? 0 : 1;
  // fully symmetric stalemate: deterministic, seed-balanced coin
  const r = makeRng(b.seed + b.elapsed * 1000 + b.mapIndex * 17)();
  return r < 0.5 ? 0 : 1;
}

export function finishRound(b, winner, reason) {
  if (b.phase !== 'live') return;
  b.phase = 'result';
  b.winner = winner;
  b.loser = 1 - winner;
  b.reason = reason;
  b.resultT = ROUND_RESULT;
  const loser = b.tanks[1 - winner];
  if (loser && loser.alive && reason !== 'timeout') { loser.alive = false; loser.hp = 0; }
  addEvent(b, 'roundWin', { side: winner, reason });
}

// ---------- full round simulation for the balance bench ----------
export function simulateRound(diffA, diffB, seed, mapIndex = 0) {
  const b = createBattle(mapIndex, { ai0: diffA, ai1: diffB, seed, phase: 'live' });
  b.countdown = 0;
  let guard = 0;
  while (b.phase === 'live' && guard < 60 * (ROUND_TIME + 4)) {
    updateBattle(b, 1 / 60, null, { freeze: false });
    guard++;
    if (b.phase === 'result') break;
  }
  if (b.phase !== 'result') finishRound(b, tiebreak(b), 'guard');
  return {
    winner: b.winner, reason: b.reason, time: b.elapsed,
    hp: [b.tanks[0].hp, b.tanks[1].hp], damage: [b.tanks[0].damage, b.tanks[1].damage],
    mapIndex: b.mapIndex,
  };
}

export function simulateMatch(diffA, diffB, seed, opts = {}) {
  let w0 = 0, w1 = 0;
  const rounds = [];
  const mapSeq = opts.mapSequence || MAP_SEQUENCE;
  for (let r = 0; r < MAX_ROUNDS; r++) {
    const rr = simulateRound(diffA, diffB, seed + r * 7919, mapSeq[r % mapSeq.length]);
    rounds.push(rr);
    if (rr.winner === 0) w0++; else w1++;
    if (w0 >= WIN_SCORE || w1 >= WIN_SCORE) break;
  }
  return {
    winner: w0 >= WIN_SCORE ? 0 : w1 >= WIN_SCORE ? 1 : (w0 > w1 ? 0 : 1),
    score: [w0, w1], rounds, seed,
  };
}

export function runSelfplay(n, diffA, diffB = diffA, seedBase = 12345) {
  n = Math.max(1, Math.min(2000, n | 0));
  const out = {
    n, diffA, diffB, p1Wins: 0, p2Wins: 0, rounds: 0,
    byMap: MAPS.map(() => 0), reasons: {}, totalTime: 0, durations: [],
  };
  for (let i = 0; i < n; i++) {
    const m = simulateMatch(diffA, diffB, seedBase + i * 104729, {});
    if (m.winner === 0) out.p1Wins++; else out.p2Wins++;
    out.rounds += m.rounds.length;
    for (const r of m.rounds) {
      out.byMap[r.mapIndex] = (out.byMap[r.mapIndex] || 0) + 1;
      out.reasons[r.reason] = (out.reasons[r.reason] || 0) + 1;
      out.totalTime += r.time;
    }
  }
  out.p1Rate = out.p1Wins / n;
  out.p2Rate = out.p2Wins / n;
  out.avgRounds = out.rounds / n;
  out.avgSeconds = out.totalTime / Math.max(1, out.rounds);
  return out;
}

export function runDifficultyBench(n, seedBase = 777) {
  // Adjacent-tier comparison against the fixed middle-tier opponent.
  // "medium-vs-easy" and "hard-vs-medium" isolate one tier step each.
  const a = runSelfplay(n, 'medium', 'easy', seedBase);
  const b = runSelfplay(n, 'hard', 'medium', seedBase + 50000);
  return {
    mediumVsEasy: { mediumWin: a.p1Rate, easyWin: a.p2Rate, n },
    hardVsMedium: { hardWin: b.p1Rate, mediumWin: b.p2Rate, n },
  };
}
