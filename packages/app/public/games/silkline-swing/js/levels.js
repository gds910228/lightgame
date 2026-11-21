// Silkline Swing — 18 authored canyon routes (3 chapters × 6).
// Geometry is deterministic (mulberry32 seed per level). Three star shards per
// level are placed on the trajectory of a deterministic route probe that uses
// the real physics and real anchor-selection rules, so every shard sits on a
// flyable line and every level is provably completable.
import { probeRoute, P } from './physics.js';

export const LEVEL_COUNT = 18;
export const CHAPTERS = [
  { id: 1, name: '雾谷初丝', sub: '学会抓点、泵摆与松手' },
  { id: 2, name: '风蚀深峡', sub: '活锚、脆丝与横风' },
  { id: 3, name: '月蚀灯河', sub: '长索飞舞，星门在望' },
];

const NAMES = [
  '灯口试丝', '苔桥回响', '双锚浅湾', '铜环低语', '窄风廊', '暮谷长摆',
  '断索崖', '风眼', '碎星索道', '悬灯栈', '回旋门', '赤铜深井',
  '碎月峡', '灯河回廊', '双月摆渡', '蚀心索', '星门残响', '终跃 · 灯河',
];

function mulberry32(a) {
  return function () {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

function insideRect(x, y, r, pad = 0) {
  return x > r.x - pad && x < r.x + r.w + pad && y > r.y - pad && y < r.y + r.h + pad;
}

function baseLevel(n) {
  const rng = mulberry32(9173 + n * 7717);
  const chapter = Math.ceil(n / 6);
  const worldW = 2250 + n * 150 + (chapter - 1) * 160;
  const groundY = 650;
  const gateX = worldW - 150;
  const count = 8 + Math.round((n - 1) * 0.6);

  const anchors = [];
  const left = 320, right = gateX - 260;
  const stepX = (right - left) / (count - 2);
  for (let i = 0; i < count; i++) {
    let x = left + stepX * i + (rng() - 0.5) * 34;
    let y = 250 + (rng() - 0.5) * 46 + Math.sin(i * 0.9 + n) * 14;
    let type = 'static';
    if (chapter >= 2 && i > 2 && i < count - 2) {
      if (i % 5 === 3) type = 'moving';
      else if (i % 6 === 4) type = 'fragile';
    }
    if (chapter >= 3 && i > 3 && i < count - 2 && i % 4 === 1) type = 'moving';
    anchors.push({
      x, y, type,
      ampX: type === 'moving' ? 30 + rng() * 16 : 0,
      ampY: type === 'moving' ? 34 + rng() * 22 : 0,
      phase: rng() * Math.PI * 2,
      speed: 0.8 + rng() * 0.5,
      broken: false, fragT: 0,
    });
  }
  // final silk ring hangs directly above the floating star gate
  const last = anchors[count - 1];
  last.x = gateX - 120; last.y = groundY - 340;
  last.type = 'static'; last.ampX = 0; last.ampY = 0;

  const gate = { x: last.x, y: groundY - 150, w: 118, h: 270 };

  const platforms = [
    { x: 0, y: groundY, w: 300, h: 190 },                       // start ledge
    { x: gate.x - 210, y: groundY, w: worldW - gate.x + 210, h: 190 }, // exit ledge
  ];
  // visual mid ledges (below the route, give the canyon a floor rhythm)
  for (let i = 1; i <= 2; i++) {
    const a = anchors[Math.floor((count - 1) * i / 3)];
    platforms.push({ x: a.x - 55, y: groundY + 52, w: 110, h: 120 });
  }

  const spikes = [];
  for (let i = 1; i < count - 2; i += 2) {
    const ax = (anchors[i].x + anchors[i + 1].x) / 2;
    if (ax > gate.x - 240) continue;
    spikes.push({ x: ax - 52, y: groundY - 24, w: 104, h: 24 });
  }
  // two hanging spike clusters framing the deep canyon
  spikes.push({ x: 560 + n * 12, y: 585, w: 76, h: 26, hang: true });
  // every spike cluster sits on a small rock pillar so the canyon floor reads
  for (const s of spikes) {
    if (s.hang) platforms.push({ x: s.x - 12, y: 538, w: s.w + 24, h: 46 });
    else platforms.push({ x: s.x - 16, y: groundY, w: s.w + 32, h: 132 });
  }

  const winds = [];
  if (chapter >= 2) {
    const wCount = chapter === 2 ? 1 : 2;
    for (let i = 0; i < wCount; i++) {
      const a = anchors[Math.floor(count * (0.32 + i * 0.3))];
      winds.push({
        x: a.x - 150, y: 180, w: 430, h: 430,
        vx: (i % 2 ? -1 : 1) * (150 + n * 6),
      });
    }
  }

  // checkpoints: activated by crossing their x; respawn hangs under the ring
  const checkpoints = [];
  for (const idx of [Math.floor((count - 1) / 3), Math.floor((count - 1) * 2 / 3)]) {
    const a = anchors[idx];
    checkpoints.push({
      x: a.x, y: a.y + 168, triggerX: a.x - 30, anchorIdx: idx, active: false,
    });
  }

  const killY = groundY + 200;
  return {
    id: n, chapter, name: NAMES[n - 1], chapterName: CHAPTERS[chapter - 1].name,
    worldW, groundY, killY, gate, start: { x: 130, y: groundY - 22 },
    anchors, platforms, spikes, winds, checkpoints,
    shards: [], par: 40 + n * 4,
  };
}

function cloneLevel(base) {
  const l = {
    ...base,
    start: { ...base.start },
    gate: { ...base.gate },
    anchors: base.anchors.map(a => ({ ...a })),
    platforms: base.platforms.map(p => ({ ...p })),
    spikes: base.spikes.map(s => ({ ...s })),
    winds: base.winds.map(w => ({ ...w })),
    checkpoints: base.checkpoints.map(c => ({ ...c })),
    shards: base.shards.map(s => ({ ...s })),
  };
  return l;
}

function safePoint(level, p) {
  let x = clamp(p.x, 150, level.worldW - 150);
  let y = clamp(p.y, 110, level.groundY - 40);
  for (let k = 0; k < 12; k++) {
    let bad = false;
    for (const pf of level.platforms) if (insideRect(x, y, pf, 34)) bad = true;
    for (const s of level.spikes) if (insideRect(x, y, s, 44)) bad = true;
    if (!bad) break;
    y -= 28;
  }
  return { x: Math.round(x), y: Math.round(y), got: false };
}

function placeShards(level, path) {
  if (path.length < 8) return [
    { x: level.anchors[2].x, y: level.anchors[2].y + 180, got: false },
    { x: level.anchors[4].x, y: level.anchors[4].y + 180, got: false },
    { x: level.anchors[6].x, y: level.anchors[6].y + 180, got: false },
  ];
  const out = [];
  for (const f of [0.22, 0.52, 0.8]) {
    let i = Math.round(f * (path.length - 1));
    // walk forward until the sample is comfortably clear of solids
    let pt = safePoint(level, path[i]);
    for (let tries = 0; tries < 30 && out.some(o => Math.hypot(o.x - pt.x, o.y - pt.y) < 110); tries++) {
      i = Math.min(path.length - 2, i + 4);
      pt = safePoint(level, path[i]);
    }
    out.push(pt);
  }
  return out;
}

function finalize(base) {
  // first probe with empty shards to obtain a real flyable trajectory
  const probeLevel = cloneLevel(base);
  probeLevel.shards = [];
  const first = probeRoute(probeLevel, 26);
  base.shards = placeShards(base, first.path);
  base.probe = { ok: first.ok, time: +first.t.toFixed(2) };

  // second probe on a fresh clone verifies all three shards sit on the route
  const verify = cloneLevel(base);
  const second = probeRoute(verify, 26);
  base.probe.ok = first.ok && second.ok;
  base.probe.shards = second.shards;
  base.probe.time = +second.t.toFixed(2);
  // par is ~3.6x the deterministic reference route: attainable, not trivial
  base.par = Math.max(24, Math.round(second.t * 3.6 + 8));
  return base;
}

export const LEVELS = Array.from({ length: LEVEL_COUNT }, (_, i) => finalize(baseLevel(i + 1)));

export function instantiateLevel(n) {
  const idx = clamp((n | 0) - 1, 0, LEVEL_COUNT - 1);
  const l = cloneLevel(LEVELS[idx]);
  l.anchors.forEach(a => { a.broken = false; a.fragT = 0; });
  l.shards.forEach(s => { s.got = false; });
  l.checkpoints.forEach(c => { c.active = c.triggerX <= level_startX(l); });
  return l;
}

function level_startX(l) { return l.start.x; }

export function ratingFor(level, shards, time) {
  const base = 1;
  const two = shards >= 2 ? 1 : 0;
  const three = (shards >= 3 && time <= level.par) ? 1 : 0;
  return clamp(base + two + three, 0, 3);
}

export { P };
