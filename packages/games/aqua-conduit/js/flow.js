// Aqua Conduit — pure pipe rotation + water-flow model.
// Directions: 0 = north, 1 = east, 2 = south, 3 = west.
// A cell's openings are stored as a 4-bit mask at rotation 0; rotating the
// piece by q quarter-turns rotates the mask by q. Water is a directional BFS so
// one-way valves, rotary gate valves, cross channels and two-colour mixing all
// live in the same solver the game and the level audit use.

export const DIR = { N: 0, E: 1, S: 2, W: 3 };
export const DR = [-1, 0, 1, 0], DC = [0, 1, 0, -1];
export const OPP = [2, 3, 0, 1];
export const BIT = (d) => 1 << d;
export const ALL = 15;

export const FIXED_TYPES = new Set(['source', 'target', 'decor', 'empty']);
export const MOVABLE_TYPES = new Set(['straight', 'elbow', 'tee', 'cross', 'valve', 'oneway']);

export function rotMask(mask, q) {
  q = ((q % 4) + 4) % 4;
  if (!q) return mask;
  let out = 0;
  for (let d = 0; d < 4; d++) if (mask & BIT(d)) out |= BIT((d + q) & 3);
  return out;
}

export function dirsOf(mask) {
  const out = [];
  for (let d = 0; d < 4; d++) if (mask & BIT(d)) out.push(d);
  return out;
}

export function maskAt(cell, rot) {
  if (!cell) return 0;
  if (FIXED_TYPES.has(cell.t)) return cell.m0 || 0;
  return rotMask(cell.m0 || 0, rot === undefined ? cell.rot : rot);
}

export function isMovable(cell) {
  return !!cell && MOVABLE_TYPES.has(cell.t) && !cell.locked;
}

export function keyOf(r, c) { return r + ',' + c; }

// Build (and cache) a lookup table for a level.
export function levelIndex(level) {
  if (level.__idx) return level.__idx;
  const cells = level.cells || [];
  const at = new Map();
  for (let i = 0; i < cells.length; i++) at.set(keyOf(cells[i].r, cells[i].c), i);
  const sources = (level.sources || []).map(s => ({ ...s, i: at.get(keyOf(s.r, s.c)) }));
  const targets = (level.targets || []).map(t => ({ ...t, i: at.get(keyOf(t.r, t.c)) }));
  const idx = { at, sources, targets, cells };
  level.__idx = idx;
  return idx;
}

export function cellAt(level, r, c) {
  const ix = levelIndex(level);
  const i = ix.at.get(keyOf(r, c));
  return i === undefined ? null : ix.cells[i];
}

export function indexAt(level, r, c) {
  return levelIndex(level).at.get(keyOf(r, c));
}

function rotGetter(level, rotations) {
  if (typeof rotations === 'function') return rotations;
  if (rotations instanceof Map) return (cell, i) => (rotations.has(i) ? rotations.get(i) : cell.rot);
  if (rotations && typeof rotations === 'object') return (cell, i) => (rotations[i] !== undefined ? rotations[i] : cell.rot);
  return (cell) => cell.rot;
}

// One colour's directional flood. `blocked` cells are walls (used to resolve
// two-colour contamination). Returns cell index set, colour set and traversed
// edges (for the water animation).
function bfsColor(level, color, blocked, rotOf) {
  const ix = levelIndex(level);
  const cells = ix.cells;
  const reached = new Set();
  const seen = new Set();
  const cellOrder = [];
  const edges = [];
  const q = [];
  for (const s of ix.sources) {
    if (s.color !== color) continue;
    reached.add(s.i); seen.add(s.i);
    cellOrder.push(s.i);
    q.push({ i: s.i, entry: -1 });
  }
  let guard = 0;
  while (q.length && guard++ < 4096) {
    const { i, entry } = q.shift();
    const cell = cells[i];
    if (!cell) continue;
    const rot = rotOf(cell, i);
    let outs = [];
    if (cell.t === 'source') {
      outs = dirsOf(maskAt(cell, rot));
    } else if (cell.t === 'target' || cell.t === 'decor' || cell.t === 'empty') {
      outs = [];
    } else if (cell.t === 'valve') {
      if (rot === cell.sol) outs = dirsOf(maskAt(cell, rot));
    } else if (cell.t === 'oneway') {
      const en = (cell.e0 + rot - cell.sol + 8) & 3;
      const ex = (cell.x0 + rot - cell.sol + 8) & 3;
      if (entry === -1 || entry === en) outs = [ex];
    } else if (cell.t === 'cross') {
      if (entry === -1) outs = dirsOf(maskAt(cell, rot));
      else outs = [OPP[entry]];
    } else {
      outs = dirsOf(maskAt(cell, rot));
    }
    for (const d of outs) {
      const nr = cell.r + DR[d], nc = cell.c + DC[d];
      const ni = levelIndex(level).at.get(keyOf(nr, nc));
      if (ni === undefined) continue;
      if (blocked && blocked.has(ni)) continue;
      const ncell = cells[ni];
      if (!ncell) continue;
      const nrot = rotOf(ncell, ni);
      const nm = maskAt(ncell, nrot);
      if (!(nm & BIT(OPP[d]))) continue;
      const needEntry = ncell.t === 'oneway' || ncell.t === 'cross';
      const visitKey = needEntry ? ni + '|' + OPP[d] : String(ni);
      if (seen.has(visitKey)) continue;
      seen.add(visitKey);
      if (!reached.has(ni)) { reached.add(ni); cellOrder.push(ni); }
      q.push({ i: ni, entry: OPP[d] });
      edges.push({ a: i, b: ni, d, color });
    }
  }
  return { reached, edges, cellOrder };
}

function isSinkOrSource(cell) {
  return cell && (cell.t === 'target' || cell.t === 'source');
}

/**
 * Solve the water network at a given rotation state.
 * rotations: undefined (cell.rot) | Map(index->rot) | object | function.
 * Returns a read-only description used by the renderer, the win test and the
 * autotest audit.
 */
export function solveFlow(level, rotations) {
  const ix = levelIndex(level);
  const cells = ix.cells;
  const rotOf = rotGetter(level, rotations);
  const colors = [...new Set(ix.sources.map(s => s.color || 'jade'))];
  if (!colors.length) return {
    solved: false, colors: [], targets: [], reached: new Set(), cellColors: new Map(),
    mixed: new Set(), edges: [], blocked: new Set(),
  };

  let blocked = new Set();
  let results = null;
  for (let iter = 0; iter < 16; iter++) {
    results = new Map();
    for (const c of colors) results.set(c, bfsColor(level, c, blocked, rotOf));
    const mixed = new Set();
    for (let i = 0; i < cells.length; i++) {
      if (isSinkOrSource(cells[i])) continue;
      let n = 0;
      for (const c of colors) if (results.get(c).reached.has(i)) n++;
      if (n > 1) mixed.add(i);
    }
    let added = false;
    for (const i of mixed) if (!blocked.has(i)) { blocked.add(i); added = true; }
    if (!added) break;
  }

  const reached = new Set();
  const cellColors = new Map();
  const edges = [];
  for (const c of colors) {
    const r = results.get(c);
    for (const i of r.reached) {
      reached.add(i);
      if (!cellColors.has(i)) cellColors.set(i, new Set());
      cellColors.get(i).add(c);
    }
    for (const e of r.edges) edges.push(e);
  }
  const targets = ix.targets.map(t => {
    const want = t.color || 'jade';
    const r = results.get(want);
    const ok = !!(r && r.reached.has(t.i));
    return { r: t.r, c: t.c, color: want, ok, i: t.i };
  });
  // Which open arms actually carry water (used by the renderer).
  const waterDirs = new Map();
  const addDir = (i, d) => {
    if (!waterDirs.has(i)) waterDirs.set(i, new Set());
    waterDirs.get(i).add(d);
  };
  for (const e of edges) { addDir(e.a, e.d); addDir(e.b, OPP[e.d]); }
  const solved = targets.length > 0 && targets.every(t => t.ok);
  return { solved, colors, targets, reached, cellColors, mixed: blocked, edges, blocked, results, waterDirs };
}

// Convenience rotation snapshots used by the audit and the app.
export function canonicalRotations(level) {
  const m = new Map();
  for (let i = 0; i < level.cells.length; i++) {
    const c = level.cells[i];
    m.set(i, c.onPath ? (c.sol || 0) : (c.rot || 0));
  }
  return m;
}

export function initialRotations(level) {
  const m = new Map();
  for (let i = 0; i < level.cells.length; i++) m.set(i, level.cells[i].rot || 0);
  return m;
}

export function optimalMoves(level) {
  let n = 0;
  for (const c of level.cells) {
    if (!c.onPath || !isMovable(c) || c.t === 'cross') continue;
    const d = (c.sol - c.rot + 4) & 3;
    n += Math.min(d, 4 - d);
  }
  return n;
}

// Minimal signed clicks for the authored solution: +1 clockwise, -1 reverse.
export function autoSolution(level) {
  const out = [];
  for (const c of level.cells) {
    if (!c.onPath || !isMovable(c) || c.t === 'cross') continue;
    let d = (c.sol - c.rot + 4) & 3;
    if (d === 0) continue;
    if (d === 1) out.push({ r: c.r, c: c.c, dir: 1 });
    else if (d === 2) out.push({ r: c.r, c: c.c, dir: 1 }, { r: c.r, c: c.c, dir: 1 });
    else out.push({ r: c.r, c: c.c, dir: -1 });
  }
  return out;
}

// Count mechanism usage for the level list / audit.
export function countMechanics(level) {
  const o = { straight: 0, elbow: 0, tee: 0, cross: 0, valve: 0, oneway: 0, source: 0, target: 0 };
  for (const c of level.cells) if (o[c.t] !== undefined) o[c.t]++;
  return o;
}
