// Static audit for all 24 Aqua Conduit levels: bounds, uniqueness, target
// matching, canonical solvability, scrambled-start unsolvability, budget,
// authored click count and mechanism presence.
import fs from 'node:fs';
import { LEVELS, CHAPTERS, TOTAL_LEVELS } from '../../../packages/games/aqua-conduit/js/levels.js';
import {
  solveFlow, canonicalRotations, initialRotations, optimalMoves,
  autoSolution, isMovable, cellAt,
} from '../../../packages/games/aqua-conduit/js/flow.js';

const out = [];
let bad = 0;
for (const lv of LEVELS) {
  const issues = [];
  // bounds + uniqueness
  const seen = new Set();
  for (const c of lv.cells) {
    if (c.r < 0 || c.r >= lv.rows || c.c < 0 || c.c >= lv.cols) issues.push(`cell out of bounds ${c.r},${c.c}`);
    const k = c.r + ',' + c.c;
    if (seen.has(k)) issues.push(`duplicate cell ${k}`);
    seen.add(k);
  }
  // sources / targets
  if (!lv.sources.length) issues.push('no source');
  if (!lv.targets.length) issues.push('no target');
  const targetColors = new Set(lv.targets.map(t => t.color));
  for (const s of lv.sources) if (!targetColors.has(s.color)) issues.push(`source color ${s.color} has no target`);
  // path cells exist
  for (const p of [lv.pathA, lv.pathB].filter(Boolean)) {
    for (const [r, c] of p) if (!cellAt(lv, r, c)) issues.push(`path cell missing ${r},${c}`);
  }
  // canonical / initial
  const can = solveFlow(lv, canonicalRotations(lv));
  const ini = solveFlow(lv, initialRotations(lv));
  if (!can.solved) issues.push('canonical state not solved');
  if (ini.solved) issues.push('initial state already solved');
  if (lv.mech === 'color' && can.mixed.size) issues.push('canonical colour network mixes');
  if (lv.mech === 'color' && can.colors.length !== 2) issues.push('colour level does not have two colours');
  if (lv.mech === 'color' && can.targets.length !== 2) issues.push('colour level does not have two targets');
  // budget / authored click count
  const opt = optimalMoves(lv);
  if (opt !== lv.optimal) issues.push(`optimal mismatch stored=${lv.optimal} recomputed=${opt}`);
  if (lv.budget !== lv.optimal + lv.slack) issues.push(`budget !== optimal + slack`);
  if (lv.budget < lv.optimal) issues.push('budget below optimal');
  const sol = autoSolution(lv);
  if (sol.length !== lv.optimal) issues.push(`autoSolution length ${sol.length} !== optimal ${lv.optimal}`);
  // apply the authored solution to a clone
  const clone = {
    ...lv,
    cells: lv.cells.map(c => ({ ...c })),
    sources: lv.sources.map(s => ({ ...s })),
    targets: lv.targets.map(t => ({ ...t })),
  };
  delete clone.__idx;
  for (const step of sol) {
    const c = cellAt(clone, step.r, step.c);
    if (!c || !isMovable(c)) { issues.push(`solution step on non-movable ${step.r},${step.c}`); break; }
    c.rot = (c.rot + (step.dir < 0 ? 3 : 1)) & 3;
  }
  const solvedBySol = solveFlow(clone).solved;
  if (!solvedBySol) issues.push('authored solution does not solve');
  // mechanism presence
  const has = (t) => lv.cells.some(c => c.onPath && c.t === t);
  if (lv.chapter === 2 && !has('valve')) issues.push('chapter 2 level without an on-path valve');
  if (lv.chapter === 3 && !has('oneway')) issues.push('chapter 3 level without an on-path one-way valve');
  // slack trend
  const ok = issues.length === 0;
  if (!ok) bad++;
  out.push({
    id: lv.id, chapter: lv.chapter, name: lv.name, cols: lv.cols, rows: lv.rows,
    mech: lv.mech, pathLen: (lv.pathA || []).length + (lv.pathB ? lv.pathB.length : 0),
    optimal: lv.optimal, budget: lv.budget, slack: lv.slack, par: lv.par,
    mechanisms: lv.mechanisms || {},
    sources: lv.sources.map(s => s.color + '@' + s.r + ',' + s.c),
    targets: lv.targets.map(t => t.color + '@' + t.r + ',' + t.c),
    canonicalSolved: can.solved, initialSolved: ini.solved,
    solvedByAuthoredSolution: solvedBySol, issues, ok,
  });
  console.log(`${String(lv.id).padStart(2)} ${ok ? 'OK ' : 'BAD'} ${lv.name} opt=${lv.optimal} budget=${lv.budget} slack=${lv.slack} can=${can.solved} ini=${ini.solved} sol=${solvedBySol}${issues.length ? ' :: ' + issues.join(' | ') : ''}`);
}
const summary = {
  totalLevels: TOTAL_LEVELS,
  chapters: CHAPTERS.map(c => ({ id: c.id, zh: c.zh, range: c.range })),
  allOk: bad === 0,
  badLevels: out.filter(o => !o.ok).map(o => o.id),
  slackByChapter: CHAPTERS.map(c => ({ chapter: c.id, slacks: out.filter(o => o.chapter === c.id).map(o => o.slack) })),
  levels: out,
};
fs.writeFileSync('/mnt/tos/workspace/.scratch/guizang3/aqua-conduit/audit.json', JSON.stringify(summary, null, 2), 'utf8');
console.log(`\nAUDIT ${out.length - bad}/${out.length} levels OK; bad=${bad}`);
if (bad) process.exit(1);
