// Auto-solver: greedy per-level shot search. node solver.mjs <port> [levels...]
// For each level: repeatedly try candidate shots (angle × power × available kinds)
// from the CURRENT state (snapshot/restore per trial), commit the best, until clear.
import { createRequire } from 'module';
const require2 = createRequire('C:/Users/Administrator/.agents/skills/playwright-skill/node_modules/');
const { chromium } = require2('playwright');
const port = process.argv[2] || '8600';
const levels = process.argv.slice(3).map(Number);
const ANGS = [6, 10, 14, 18, 22, 26, 30, 35, 40, 45];
const POWS = [.7, .8, .9, .95, 1];
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 960, height: 540 } });
p.on('pageerror', e => console.log('PAGEERR', String(e).slice(0, 120)));
await p.goto(`http://localhost:${port}/sling-siege/?autotest=1`, { waitUntil: 'load' });
await p.waitForFunction('window.__TEST && window.__TEST.done', { timeout: 300000 }).catch(() => {});
const out = await p.evaluate(async (levels) => {
  const G = window.__G;
  const ANGS = [6, 10, 14, 18, 22, 26, 30, 35, 40, 45];
  const POWS = [.7, .8, .9, .95, 1];
  const results = {};
  G.setNoAuto(true);
  for (const li of levels) {
    G.startGame(li);
    const shots = [];
    let guard = 8;
    while (G.state().enemiesLeft > 0 && guard-- > 0) {
      const snapshot = JSON.stringify(G.bodies.map(x => ({ ...x })));
      const snapshotMoves = G.state().movesUsed;
      const ammoLeft = G.state().ammoLeft;
      const LEVELS = (await import('/sling-siege/js/levels.js')).LEVELS;
      const slotKind = LEVELS[li].ammo[shots.length];
      if (slotKind === undefined) break;            // out of ammo
      const cand = [];
      for (const a of ANGS) for (const pw of POWS) cand.push([a, pw, slotKind]);
      let best = null;
      for (const [a, pw, kind] of cand) {
        // restore
        const live = JSON.parse(snapshot);
        G.bodies.length = 0;
        for (const x of live) G.bodies.push(x);
        // restore ammo counter by refiring? state.movesUsed is internal — use G.loadLevel then replay committed shots:
        // simpler: fire attempts only mutate counters — restore by re-loading level and replaying shots[]
        G.loadLevel(li);
        for (const s2 of shots) G.fire(s2[0], s2[1], s2[2]);
        G.upd(40);
        const before = G.state().enemiesLeft;
        G.fire(a, pw, kind);
        G.upd(220);
        const after = G.state().enemiesLeft;
        if (!best || after < best.after) best = { a, pw, kind, after };
        if (best.after === 0) break;
      }
      if (!best || best.after >= G.state().enemiesLeft && best.after === undefined) break;
      // commit best: reload + replay committed + fire best
      G.loadLevel(li);
      for (const s2 of shots) G.fire(s2[0], s2[1], s2[2]);
      G.fire(best.a, best.pw, best.kind);
      G.upd(220);
      shots.push([best.a, best.pw, best.kind]);
      if (G.state().enemiesLeft === 0) break;
    }
    G.upd(200);
    results[li] = { shots, enemiesLeft: G.state().enemiesLeft, win: G.state().enemiesLeft === 0 };
  }
  return JSON.stringify(results);
}, levels);
console.log(out);
await b.close();
