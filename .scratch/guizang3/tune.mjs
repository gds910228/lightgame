// Tune one level's sol shots: node tune.mjs <levelIdx0> <port>
// Fires the recorded sol and reports enemy states after each shot.
import { createRequire } from 'module';
const require2 = createRequire('C:/Users/Administrator/.agents/skills/playwright-skill/node_modules/');
const { chromium } = require2('playwright');
const [lv, port = '8600'] = process.argv.slice(2);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 960, height: 540 } });
p.on('pageerror', e => console.log('PAGEERR', String(e).slice(0, 150)));
await p.goto(`http://localhost:${port}/sling-siege/?autotest=1`, { waitUntil: 'load' });
await p.waitForFunction('window.__TEST && window.__TEST.done', { timeout: 300000 }).catch(() => {});
const out = await p.evaluate(async (lv) => {
  const G = window.__G;
  G.setNoAuto(true); G.startGame(+lv);
  const LEVELS = (await import('/sling-siege/js/levels.js')).LEVELS;
  const shots = LEVELS[+lv].sol;
  const log = [];
  for (let i = 0; i < shots.length; i++) {
    const [ang, pow, kind] = shots[i];
    G.fire(ang, pow, kind);
    G.upd(200);
    const st = G.state();
    log.push({ shot: i, ang, pow, kind: kind || 'default', enemiesLeft: st.enemiesLeft, ammoLeft: st.ammoLeft });
  }
  G.upd(200);
  const st = G.state();
  const enemies = G.bodies.filter(b => b.kind === 'enemy').map(e => ({ x: Math.round(e.x), y: Math.round(e.y), hp: Math.round(e.hp), size: e.size }));
  return JSON.stringify({ log, final: { enemiesLeft: st.enemiesLeft, win: st.enemiesLeft === 0 }, enemies });
}, lv);
console.log(out);
await b.close();
