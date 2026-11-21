// Deterministic level generator for Aqua Conduit.
// Writes ../../packages/games/aqua-conduit/js/levels.js after verifying every
// level: the canonical rotation state solves, the scrambled start does not,
// and the authored optimal click count fits inside the level budget.
import fs from 'node:fs';
import path from 'node:path';
import {
  DR, DC, OPP, BIT, ALL, rotMask, maskAt, solveFlow, optimalMoves,
  canonicalRotations, initialRotations, countMechanics,
} from '../../../packages/games/aqua-conduit/js/flow.js';

const OUT = path.resolve('../../../packages/games/aqua-conduit/js/levels.js');

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffle(rng, arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = (rng() * (i + 1)) | 0;
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}
const key = (r, c) => r + ',' + c;
const inB = (s, r, c) => r >= 0 && r < s.rows && c >= 0 && c < s.cols;

function turnsOf(path) {
  let t = 0, pd = -1;
  for (let i = 1; i < path.length; i++) {
    const d = dirBetween(path[i - 1], path[i]);
    if (pd >= 0 && d !== pd) t++;
    pd = d;
  }
  return t;
}
function dirBetween(a, b) {
  const dr = b.r - a.r, dc = b.c - a.c;
  if (dr === -1) return 0;      // north
  if (dc === 1) return 1;       // east
  if (dr === 1) return 2;       // south
  return 3;                      // west
}
function dirTo(a, b) { return dirBetween(a, b); }

// A self-avoiding walk from column 0 to the last column. Weighted random steps
// with a hard budget keep generation fast; failed walks simply retry with a new
// start row.
function genPath(rng, spec, blocked, minLen, maxLen) {
  const cols = spec.cols, rows = spec.rows;
  for (let attempt = 0; attempt < 400; attempt++) {
    const startRow = (rng() * rows) | 0;
    const start = { r: startRow, c: 0 };
    if (blocked.has(key(start.r, start.c))) continue;
    const visited = new Set([key(start.r, start.c)]);
    const path = [start];
    for (let step = 0; step < maxLen * 6 && path.length <= maxLen; step++) {
      if (path[path.length - 1].c === cols - 1 && path.length >= minLen && turnsOf(path) >= 2) return path;
      if (path.length >= maxLen) break;
      const r = path[path.length - 1].r, c = path[path.length - 1].c;
      const cand = [];
      for (const d of [1, 0, 2, 3]) {
        const nr = r + DR[d], nc = c + DC[d];
        if (!inB(spec, nr, nc)) continue;
        if (blocked.has(key(nr, nc))) continue;
        if (visited.has(key(nr, nc))) continue;
        // East is favoured, vertical wandering makes turns, west gives
        // switchbacks only when there is room.
        const w = d === 1 ? 1.9 : d === 3 ? 0.55 : 2.1;
        cand.push({ nr, nc, p: rng() / w });
      }
      if (!cand.length) break;
      cand.sort((a, b) => a.p - b.p);
      const o = cand[0];
      visited.add(key(o.nr, o.nc));
      path.push({ r: o.nr, c: o.nc });
    }
    if (path[path.length - 1].c === cols - 1 && path.length >= minLen && turnsOf(path) >= 2) return path;
  }
  return null;
}

function pickCells(rng, arr, n) { return shuffle(rng, arr).slice(0, Math.max(0, n)); }

function buildBase(spec, seed, id) {
  const rng = mulberry32(seed);
  for (let attempt = 0; attempt < 120; attempt++) {
    const two = spec.colors === 2;
    const minLen = spec.minLen, maxLen = spec.maxLen;
    const pathA = genPath(rng, spec, new Set(), minLen, maxLen);
    if (!pathA) continue;
    let pathB = null;
    if (two) {
      const blocked = new Set(pathA.map(p => key(p.r, p.c)));
      pathB = genPath(rng, spec, blocked, minLen, maxLen);
      if (!pathB) continue;
    }
    const paths = two ? [pathA, pathB] : [pathA];
    const pathKeys = new Set();
    for (const path of paths) for (const p of path) pathKeys.add(key(p.r, p.c));
    // per-cell path directions
    const info = new Map();
    for (const path of paths) {
      for (let k = 1; k < path.length - 1; k++) {
        const p = path[k], prev = path[k - 1], next = path[k + 1];
        info.set(key(p.r, p.c), { r: p.r, c: p.c, din: dirTo(p, prev), dout: dirTo(p, next), path });
      }
    }
    const interiors = [...info.values()];
    const straight = interiors.filter(o => OPP[o.din] === o.dout);
    // Not enough straight segments for cross pieces -> retry.
    if (straight.length < (spec.crosses || 0)) continue;
    // Choose mechanisms.
    const used = new Set();
    const pick = (pool, n, allow) => {
      const out = [];
      for (const o of shuffle(rng, pool)) {
        if (out.length >= n) break;
        const k = key(o.r, o.c);
        if (used.has(k)) continue;
        if (allow && !allow(o)) continue;
        used.add(k); out.push(o);
      }
      return out;
    };
    const valves = pick(interiors, spec.valves || 0);
    const oneways = pick(interiors, spec.oneways || 0);
    const crosses = pick(straight, spec.crosses || 0, o => !used.has(key(o.r, o.c)));
    const tees = pick(interiors, spec.tees || 0, o => {
      const k = key(o.r, o.c);
      if (used.has(k)) return false;
      // needs a perpendicular free neighbour for the branch (not another path cell)
      return [0, 1, 2, 3].some(d => d !== o.din && d !== o.dout
        && inB(spec, o.r + DR[d], o.c + DC[d])
        && !pathKeys.has(key(o.r + DR[d], o.c + DC[d])));
    });
    if (valves.length < (spec.valves || 0) || oneways.length < (spec.oneways || 0)
      || crosses.length < (spec.crosses || 0) || tees.length < (spec.tees || 0)) continue;
    const valveSet = new Set(valves.map(o => key(o.r, o.c)));
    const onewaySet = new Set(oneways.map(o => key(o.r, o.c)));
    const crossSet = new Set(crosses.map(o => key(o.r, o.c)));
    const teeSet = new Set(tees.map(o => key(o.r, o.c)));

    const cells = [];
    const put = (o) => { cells.push(o); return o; };
    const sources = [], targets = [];
    for (let pi = 0; pi < paths.length; pi++) {
      const path = paths[pi];
      const color = two ? (pi === 0 ? 'jade' : 'azure') : 'jade';
      for (let k = 0; k < path.length; k++) {
        const p = path[k];
        const kk = key(p.r, p.c);
        if (k === 0 || k === path.length - 1) {
          const isSrc = k === 0;
          const other = isSrc ? path[1] : path[path.length - 2];
          const d = dirTo(p, other);
          const cell = put({
            r: p.r, c: p.c, t: isSrc ? 'source' : 'target',
            m0: BIT(d), rot: 0, sol: 0, onPath: true, color,
          });
          if (isSrc) sources.push({ r: p.r, c: p.c, color });
          else targets.push({ r: p.r, c: p.c, color, style: spec.targetStyle || (id % 2 ? 'fountain' : 'wheel') });
          continue;
        }
        const o = info.get(kk);
        let t = OPP[o.din] === o.dout ? 'straight' : 'elbow';
        let mask = BIT(o.din) | BIT(o.dout);
        let e0 = o.din, x0 = o.dout;
        if (crossSet.has(kk)) {
          t = 'cross'; mask = ALL;
        } else if (valveSet.has(kk)) {
          t = 'valve';
        } else if (onewaySet.has(kk)) {
          t = 'oneway';
        } else if (teeSet.has(kk)) {
          t = 'tee';
          const perp = [0, 1, 2, 3].filter(d => d !== o.din && d !== o.dout);
          const options = shuffle(rng, perp).filter(d => {
            const nr = o.r + DR[d], nc = o.c + DC[d];
            return inB(spec, nr, nc) && !pathKeys.has(key(nr, nc));
          });
          if (options.length) mask |= BIT(options[0]);
          else t = OPP[o.din] === o.dout ? 'straight' : 'elbow';
        }
        const sol = t === 'cross' ? 0 : (rng() * 4) | 0;
        const m0 = t === 'cross' ? ALL : rotMask(mask, (4 - sol) & 3);
        put({
          r: o.r, c: o.c, t, m0, rot: 0, sol, onPath: true,
          ...(t === 'oneway' ? { e0, x0 } : {}),
        });
      }
    }

    // Decorative/distractor pipes for single-colour levels. Two-colour levels
    // stay quiet so the two water networks read clearly.
    if (!two) {
      for (let r = 0; r < spec.rows; r++) for (let c = 0; c < spec.cols; c++) {
        if (info.has(key(r, c)) || sources.some(s => s.r === r && s.c === c) || targets.some(s => s.r === r && s.c === c)) continue;
        if (rng() < 0.62) {
          const t = shuffle(rng, ['straight', 'elbow', 'tee', 'straight', 'elbow', 'cross'])[0];
          const sol = (rng() * 4) | 0;
          const m0 = t === 'cross' ? ALL : rotMask(t === 'straight' ? (rng() < .5 ? BIT(0) | BIT(2) : BIT(1) | BIT(3))
            : t === 'elbow' ? (BIT(0) | BIT(1)) : (BIT(0) | BIT(1) | BIT(2)), 0);
          put({ r, c, t, m0, rot: t === 'cross' ? 0 : ((rng() * 4) | 0), sol, onPath: false });
        }
      }
    }

    const lvl = {
      id, chapter: spec.chapter, name: spec.name, subtitle: spec.subtitle,
      cols: spec.cols, rows: spec.rows, mech: spec.mech,
      cells, sources, targets,
      targetStyle: spec.targetStyle || (id % 2 ? 'fountain' : 'wheel'),
    };
    return { lvl, rng, pathA, pathB, info, spec };
  }
  return null;
}

function scramble(lvl, rng) {
  for (const c of lvl.cells) {
    if (!c.onPath || c.t === 'cross' || c.t === 'source' || c.t === 'target') continue;
    if (rng() < 0.16) { c.rot = c.sol; continue; }
    let delta = rng() < 0.84 ? (rng() < 0.5 ? 1 : 3) : 2;
    if (delta === 2) {
      const m1 = rotMask(c.m0, c.sol), m2 = rotMask(c.m0, (c.sol + 2) & 3);
      if (m1 === m2 && c.t !== 'valve' && c.t !== 'oneway') delta = 1;
    }
    c.rot = (c.sol + delta) & 3;
  }
}
function randomizeDecoys(lvl, rng) {
  for (const c of lvl.cells) {
    if (c.onPath || c.t === 'cross') continue;
    const t = shuffle(rng, ['straight', 'elbow', 'tee', 'straight', 'elbow', 'cross'])[0];
    c.t = t;
    c.sol = 0;
    c.m0 = t === 'cross' ? ALL : rotMask(t === 'straight' ? (rng() < .5 ? BIT(0) | BIT(2) : BIT(1) | BIT(3))
      : t === 'elbow' ? (BIT(0) | BIT(1)) : (BIT(0) | BIT(1) | BIT(2)), 0);
    c.rot = t === 'cross' ? 0 : ((rng() * 4) | 0);
  }
}

function finalize(spec, seed, id) {
  let noBuild = 0, noCan = 0, noIni = 0, noOpt = 0;
  for (let outer = 0; outer < 80; outer++) {
    const built = buildBase(spec, seed + outer * 131, id);
    if (!built) { noBuild++; continue; }
    const { lvl, rng } = built;
    scramble(lvl, rng);
    // verify canonical first
    const can = solveFlow(lvl, canonicalRotations(lvl));
    if (!can.solved) { noCan++; if (id === 1 && noCan < 3) console.log('noCan', lvl.pathA, lvl.cells.filter(c=>c.onPath).map(c=>({r:c.r,c:c.c,t:c.t,m0:c.m0,rot:c.rot,sol:c.sol,e:c.e0,x:c.x0})), can.targets); continue; }
    // scramble decoys / re-scramble path until the start is genuinely unsolved
    let ok = false;
    for (let k = 0; k < 70; k++) {
      if (spec.colors !== 2) randomizeDecoys(lvl, rng);
      const ini = solveFlow(lvl, initialRotations(lvl));
      if (!ini.solved) { ok = true; break; }
      // Break an accidental shortcut by nudging a movable path piece.
      const movable = lvl.cells.filter(c => c.onPath && c.t !== 'cross' && c.t !== 'source' && c.t !== 'target');
      if (movable.length) {
        const p = movable[(rng() * movable.length) | 0];
        p.rot = (p.rot + 1) & 3;
      }
    }
    if (!ok) { noIni++; continue; }
    const optimal = optimalMoves(lvl);
    if (optimal < 1) { noOpt++; continue; }
    const budget = optimal + spec.slack;
    lvl.optimal = optimal;
    lvl.slack = spec.slack;
    lvl.budget = budget;
    lvl.par = Math.round(14 + lvl.cells.filter(c => c.onPath).length * 2.1 + (spec.colors === 2 ? 8 : 0));
    lvl.pathA = built.pathA.map(p => [p.r, p.c]);
    lvl.pathB = built.pathB ? built.pathB.map(p => [p.r, p.c]) : null;
    lvl.mechCounts = countMechanics(lvl);
    return lvl;
  }
  if (id === 1 || id === 19) console.log('finalize debug', { noBuild, noCan, noIni, noOpt });
  return null;
}

// ---------------------------------------------------------------------------
const SPECS = [
  // Chapter I — 青石夜渠: straight + elbow, first tees appear late.
  { chapter: 1, name: '初引清泉', subtitle: '把第一股水从石缝引向喷泉', cols: 6, rows: 4, minLen: 5, maxLen: 7, slack: 6, tees: 0 },
  { chapter: 1, name: '转角回声', subtitle: '弯头很听话，只要你转对方向', cols: 6, rows: 4, minLen: 6, maxLen: 8, slack: 5, tees: 0 },
  { chapter: 1, name: '三重门', subtitle: '三道拐弯，一股清水', cols: 6, rows: 5, minLen: 7, maxLen: 9, slack: 5, tees: 1 },
  { chapter: 1, name: '石阶水痕', subtitle: '沿阶而上，别让水停在半路', cols: 7, rows: 5, minLen: 7, maxLen: 10, slack: 4, tees: 1, targetStyle: 'wheel' },
  { chapter: 1, name: '分叉小径', subtitle: '三通会分水，主线仍然只有一条', cols: 7, rows: 5, minLen: 8, maxLen: 11, slack: 4, tees: 2 },
  { chapter: 1, name: '夜渠尽头', subtitle: '章末长渠，水车在等你', cols: 7, rows: 5, minLen: 9, maxLen: 12, slack: 3, tees: 2, targetStyle: 'wheel' },

  // Chapter II — 铜闸暗流: rotary gate valves + tees.
  { chapter: 2, name: '铜闸初启', subtitle: '闸柄转到正确角度才会放水', cols: 7, rows: 5, minLen: 7, maxLen: 9, slack: 4, valves: 1, tees: 1 },
  { chapter: 2, name: '双闸合流', subtitle: '两道铜闸，缺一不可', cols: 7, rows: 5, minLen: 8, maxLen: 10, slack: 4, valves: 2, tees: 1, targetStyle: 'wheel' },
  { chapter: 2, name: '倒影回环', subtitle: '闸后分水，水影折回', cols: 7, rows: 6, minLen: 9, maxLen: 11, slack: 3, valves: 2, tees: 2 },
  { chapter: 2, name: '暗渠分流', subtitle: '三通引开视线，主路藏在深处', cols: 7, rows: 6, minLen: 9, maxLen: 12, slack: 3, valves: 2, tees: 2, targetStyle: 'wheel' },
  { chapter: 2, name: '锈阀谜阵', subtitle: '三道旧闸，逐一转开', cols: 8, rows: 6, minLen: 10, maxLen: 13, slack: 3, valves: 3, tees: 2 },
  { chapter: 2, name: '闸口明月', subtitle: '章末长闸，月亮照进水管', cols: 8, rows: 6, minLen: 11, maxLen: 14, slack: 2, valves: 3, tees: 2, targetStyle: 'wheel' },

  // Chapter III — 单向回廊: one-way valves + cross channels.
  { chapter: 3, name: '单向回廊', subtitle: '水只认箭头，逆着走不通', cols: 7, rows: 5, minLen: 8, maxLen: 10, slack: 3, oneways: 2, crosses: 1, tees: 1 },
  { chapter: 3, name: '逆流之壁', subtitle: '先看箭头，再动手', cols: 8, rows: 6, minLen: 9, maxLen: 11, slack: 3, oneways: 2, crosses: 1, tees: 2, targetStyle: 'wheel' },
  { chapter: 3, name: '十字水镜', subtitle: '十字桥只走直线，不拐弯', cols: 8, rows: 6, minLen: 10, maxLen: 12, slack: 2, oneways: 3, crosses: 1, tees: 1 },
  { chapter: 3, name: '铜钉急弯', subtitle: '弯多、箭多，一步都不能错', cols: 8, rows: 6, minLen: 10, maxLen: 13, slack: 2, oneways: 3, crosses: 2, tees: 2, targetStyle: 'wheel' },
  { chapter: 3, name: '逆水行舟', subtitle: '长渠上的四道单向闸', cols: 8, rows: 6, minLen: 11, maxLen: 14, slack: 2, oneways: 4, crosses: 1, tees: 2 },
  { chapter: 3, name: '回廊终章', subtitle: '穿过单向回廊，抵达水车', cols: 8, rows: 6, minLen: 12, maxLen: 15, slack: 1, oneways: 4, crosses: 2, tees: 2, targetStyle: 'wheel' },

  // Chapter IV — 双色泉眼: two coloured networks, no mixing.
  { chapter: 4, name: '双泉初会', subtitle: '碧水与蓝水，各有各的喷泉', cols: 8, rows: 5, minLen: 8, maxLen: 11, slack: 3, colors: 2, mech: 'color' },
  { chapter: 4, name: '碧与蓝', subtitle: '两条水路平行向前', cols: 8, rows: 6, minLen: 8, maxLen: 11, slack: 3, colors: 2, mech: 'color', targetStyle: 'wheel' },
  { chapter: 4, name: '平行水脉', subtitle: '别让两种颜色在同一根管里相遇', cols: 8, rows: 6, minLen: 8, maxLen: 12, slack: 2, colors: 2, mech: 'color' },
  { chapter: 4, name: '交错的影', subtitle: '看似交错，其实各走各路', cols: 8, rows: 6, minLen: 9, maxLen: 12, slack: 2, colors: 2, mech: 'color', targetStyle: 'wheel' },
  { chapter: 4, name: '双色回环', subtitle: '长渠双流，一步都不能浪费', cols: 8, rows: 6, minLen: 9, maxLen: 13, slack: 1, colors: 2, mech: 'color' },
  { chapter: 4, name: '双泉归海', subtitle: '把碧与蓝一同送到终点', cols: 8, rows: 6, minLen: 10, maxLen: 14, slack: 1, colors: 2, mech: 'color', targetStyle: 'wheel' },
];

const levels = [];
const failures = [];
for (let i = 0; i < SPECS.length; i++) {
  const spec = SPECS[i];
  const id = i + 1;
  spec.mech = spec.mech || (spec.chapter === 1 ? 'basic' : spec.chapter === 2 ? 'valve' : spec.chapter === 3 ? 'oneway' : 'color');
  const lvl = finalize(spec, 8000 + id * 137, id);
  if (!lvl) { failures.push(id); continue; }
  levels.push(lvl);
}
if (failures.length) {
  console.error('FAILED LEVELS', failures);
  process.exit(1);
}

// Serialize compactly but readably.
const serial = levels.map(l => ({
  id: l.id, chapter: l.chapter, name: l.name, subtitle: l.subtitle,
  cols: l.cols, rows: l.rows, mech: l.mech, budget: l.budget, optimal: l.optimal,
  slack: l.slack, par: l.par, targetStyle: l.targetStyle,
  sources: l.sources, targets: l.targets,
  pathA: l.pathA, pathB: l.pathB,
  mechanisms: l.mechCounts,
  cells: l.cells.map(c => {
    const o = { r: c.r, c: c.c, t: c.t, m0: c.m0, rot: c.rot, sol: c.sol };
    if (c.onPath) o.onPath = 1;
    if (c.color) o.color = c.color;
    if (c.e0 !== undefined) o.e0 = c.e0;
    if (c.x0 !== undefined) o.x0 = c.x0;
    return o;
  }),
}));

const body = `// Aqua Conduit 水脉连环 — 24 generated + audited levels (4 chapters x 6).
// Generated by .scratch/guizang3/aqua-conduit/gen-levels.mjs. Every level keeps
// a real author solution in each cell's "sol" rotation; the scrambled "rot"
// state is guaranteed unsolved at load.
// Direction bits: 1=N, 2=E, 4=S, 8=W. Rotations are clockwise quarter turns.

export const CHAPTERS = [
  { id: 1, zh: '青石夜渠', en: 'BLUE-STONE NIGHT CHANNEL', range: [1, 6], tone: '在青石夜渠里认识直管与弯管。' },
  { id: 2, zh: '铜闸暗流', en: 'BRASS SLUICE UNDERTOW', range: [7, 12], tone: '铜闸转到正确角度才会放水。' },
  { id: 3, zh: '单向回廊', en: 'ONE-WAY CLOISTER', range: [13, 18], tone: '水只认箭头，十字桥只走直线。' },
  { id: 4, zh: '双色泉眼', en: 'TWIN-COLOUR SPRINGS', range: [19, 24], tone: '碧水与蓝水各走各路，切勿混流。' },
];

export const LEVELS = ${JSON.stringify(serial, null, 1)};

export const TOTAL_LEVELS = LEVELS.length;

export function levelByNumber(n) {
  return LEVELS.find(l => l.id === n) || LEVELS[0];
}

export function chapterFor(n) {
  return CHAPTERS.find(c => n >= c.range[0] && n <= c.range[1]) || CHAPTERS[0];
}

// The generator already audited these values; the runtime audit repeats the
// canonical/initial checks with the same pure solver.
export const LEVEL_STATS = LEVELS.map(l => ({
  id: l.id, chapter: l.chapter, budget: l.budget, optimal: l.optimal,
  cells: l.cells.length, pathLen: (l.pathA || []).length + (l.pathB ? l.pathB.length : 0),
  mechanisms: l.mechanisms,
}));
`;
fs.writeFileSync(OUT, body, 'utf8');
console.log('wrote', OUT, 'levels', levels.length);
for (const l of levels) {
  const can = solveFlow(l, canonicalRotations(l));
  const ini = solveFlow(l, initialRotations(l));
  console.log(`${String(l.id).padStart(2)} ch${l.chapter} ${l.name} ${l.cols}x${l.rows} path=${l.pathA.length}${l.pathB ? '+' + l.pathB.length : ''} opt=${l.optimal} budget=${l.budget} can=${can.solved} ini=${ini.solved} valves=${l.mechCounts.valve} oneway=${l.mechCounts.oneway} cross=${l.mechCounts.cross} tee=${l.mechCounts.tee}`);
}
