// Probe failing autotest scenarios with step-by-step state dumps.
import { createRequire } from 'module';
const require2 = createRequire('C:/Users/Administrator/.agents/skills/playwright-skill/node_modules/');
const { chromium } = require2('playwright');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1000, height: 640 } });
page.on('pageerror', e => console.log('PAGEERROR:', String(e)));
page.on('console', m => { if (m.type() === 'error') console.log('CONSOLE-ERR:', m.text()); });
await page.goto('http://localhost:8611/abyss-reaper/', { waitUntil: 'load' });
await page.waitForFunction('window.__G', { timeout: 15000 });

const out = await page.evaluate(() => {
  const G = window.__G;
  const res = {};

  // ---- T36 scenario: fresh run, crawler at +80, step, dump every 20 frames
  G.clearKeys(); G.startGame(); G.setNoAuto(true);
  const s0 = G.state();
  const ek = G.spawn('crawler', s0.px + 80, s0.py);
  const log = [];
  for (let i = 0; i < 240 && !ek.dead; i++) {
    G.upd(1);
    if (i % 20 === 0 || ek.dead) {
      const s = G.state();
      log.push({ i, mode: s.mode, pend: s.pending, px: s.px, py: s.py, ekx: +ek.x.toFixed(0), eky: +ek.y.toFixed(0), ekhp: +ek.hp.toFixed(1), ekSpd: +ek.spd?.toFixed?.(1), stun: +ek.stunT?.toFixed?.(2), kills: s.kills, gems: s.gems, xp: s.xp, w: s.weapons.map(w => w.id + w.lv).join(','), blades: G.fx ? undefined : undefined });
    }
  }
  res.T36 = { dead: ek.dead, hp: +ek.hp.toFixed(2), kills: G.state().kills, gems: G.gems.length, xp: G.state().xp, parts: G.fx().parts, log };

  // ---- T6 scenario: fresh, ghostfire vs shell at +200
  G.clearKeys(); G.startGame(); G.setNoAuto(true);
  const s1 = G.state();
  const e2 = G.spawn('shell', s1.px + 200, s1.py);
  const hp2 = e2.hp;
  G.giveWeapon('ghostfire');
  const log6 = [];
  for (let i = 0; i < 150; i++) {
    G.upd(1);
    if (i % 15 === 0) {
      log6.push({ i, e2hp: +e2.hp.toFixed(1), proj: G.fx().proj, e2x: +e2.x.toFixed(0), e2y: +e2.y.toFixed(0) });
    }
  }
  res.T6 = { hp0: hp2, hpEnd: +e2.hp.toFixed(1), dead: e2.dead, log: log6 };

  // ---- T30 scenario: magnet
  G.clearKeys(); G.startGame(); G.setNoAuto(true);
  const s2 = G.state();
  for (let i = 0; i < 8; i++) G.giveDrop('gem', s2.px + (i % 2 ? 300 : -300), s2.py + (i < 4 ? 200 : -200));
  const g0 = G.gems.length, xpM0 = G.state().xp;
  G.giveDrop('magnet', s2.px + 10, s2.py);
  const log30 = [];
  for (let i = 0; i < 260; i++) {
    if (G.state().pending) G.choose(0);
    if (G.state().mode !== 'play') break;
    G.upd(1);
    if (i % 30 === 0) log30.push({ i, gems: G.gems.length, drops: G.drops.length, xp: G.state().xp, pend: G.state().pending, magnetAll: G.state().magnetAll });
  }
  res.T30 = { g0, xpM0, gemsEnd: G.gems.length, xpEnd: G.state().xp, need: G.state().xpNeed, level: G.state().level, log: log30 };

  return res;
});
console.log(JSON.stringify(out, null, 1));
await browser.close();
