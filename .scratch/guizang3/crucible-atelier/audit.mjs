import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire('/tmp/pw/node_modules/');
const { chromium } = require('playwright');

const PORT = process.env.PORT || 8628;
const BASE = `http://localhost:${PORT}/crucible-atelier/`;
const OUT = '/mnt/tos/workspace/.scratch/guizang3/crucible-atelier';
const report = { rounds: [], direct: null, input: null, touch: null, extAll: [], shots: [] };

const browser = await chromium.launch({
  headless: true,
  executablePath: '/usr/local/bin/chromium',
  args: ['--no-sandbox', '--use-gl=swiftshader'],
});

function attach(p) {
  const errs = [], warns = [], perrs = [], reqs = [], cons = [];
  p.on('console', m => {
    cons.push(`${m.type()}: ${m.text()}`);
    if (m.type() === 'error') errs.push(m.text());
    if (m.type() === 'warning') warns.push(m.text());
  });
  p.on('pageerror', e => perrs.push(String(e && e.stack || e)));
  p.on('request', r => reqs.push(r.url()));
  return { errs, warns, perrs, reqs, cons };
}

// ---------- two consecutive autotest rounds ----------
for (let round = 1; round <= 2; round++) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const p = await ctx.newPage();
  const a = attach(p);
  await p.goto(BASE + '?autotest=1', { waitUntil: 'load' });
  await p.waitForFunction('window.__TEST && window.__TEST.done', { timeout: 180000 });
  const t = await p.evaluate('window.__TEST');
  const external = a.reqs.filter(u => !u.includes('localhost'));
  report.rounds.push({
    round, pass: t.pass, fail: t.fail, total: t.total, done: t.done,
    failed: t.results.filter(r => !r.ok).map(r => `${r.id}:${r.name}`),
    consoleErrors: a.errs, consoleWarnings: a.warns, pageErrors: a.perrs,
    external, net: await p.evaluate('window.__NET'),
    booterr: await p.evaluate('window.__BOOTERR'),
  });
  report.extAll.push(...external);
  await ctx.close();
}

// ---------- direct load, no query parameters ----------
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const p = await ctx.newPage();
  const a = attach(p);
  await p.goto(BASE, { waitUntil: 'load' });
  await p.waitForTimeout(1200);
  const st = await p.evaluate('window.G && window.G.state ? window.G.state() : null');
  const external = a.reqs.filter(u => !u.includes('localhost'));
  report.direct = {
    mode: st && st.mode, booterr: await p.evaluate('window.__BOOTERR'),
    consoleErrors: a.errs, consoleWarnings: a.warns, pageErrors: a.perrs,
    external, net: await p.evaluate('window.__NET'),
    globalFns: await p.evaluate(`({goHome:typeof goHome,clickMore:typeof clickMore,dp_share:typeof dp_share,play68_submitScore:typeof play68_submitScore})`),
  };
  report.extAll.push(...external);
  await ctx.close();
}

// ---------- real keyboard / mouse exercise + screenshots ----------
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const p = await ctx.newPage();
  const a = attach(p);
  await p.goto(BASE, { waitUntil: 'load' });
  await p.waitForTimeout(700);
  await p.screenshot({ path: `${OUT}/title-1280x720.png` });
  report.shots.push(`${OUT}/title-1280x720.png`);

  await p.click('#startbtn');
  await p.waitForTimeout(350);
  const started = await p.evaluate('G.state()');

  // real keys: line selection
  await p.keyboard.press('2');
  await p.waitForTimeout(60);
  const line2 = await p.evaluate('G.state().selectedLine');
  await p.keyboard.press('1');
  await p.waitForTimeout(60);
  const line1 = await p.evaluate('G.state().selectedLine');

  // real pointer on gather button
  const w0 = await p.evaluate('G.itemCount("water")');
  await p.click('#gatherbtn');
  await p.waitForTimeout(120);
  const afterGather = await p.evaluate('({w:G.itemCount("water"),a:G.itemCount("ash"),mat:G.state().mat})');

  // real pointer on recipe cards
  await p.click('.rcard[data-id="mist"]');
  await p.waitForTimeout(120);
  await p.click('.rcard[data-id="mire"]');
  await p.waitForTimeout(120);
  await p.click('.rcard[data-id="soot"]');
  await p.waitForTimeout(160);
  const afterCards = await p.evaluate('({crafts:G.state().totalCrafts, gold:G.state().gold, discovered:G.state().discoveredCount})');

  // real quick-craft keys
  const c0 = await p.evaluate('G.state().totalCrafts');
  await p.keyboard.press('q');
  await p.waitForTimeout(80);
  await p.keyboard.press('w');
  await p.waitForTimeout(80);
  await p.keyboard.press('e');
  await p.waitForTimeout(120);
  const cQuick = await p.evaluate('G.state().totalCrafts');

  // real pause / resume
  await p.keyboard.press('p');
  await p.waitForTimeout(100);
  const paused = await p.evaluate('G.state()');
  await p.keyboard.press('p');
  await p.waitForTimeout(100);
  const resumed = await p.evaluate('G.state()');

  // real mute / unmute
  const mutedBefore = await p.evaluate('G.state().mute');
  await p.keyboard.press('m');
  await p.waitForTimeout(80);
  const mutedAfter = await p.evaluate('G.state().mute');
  await p.keyboard.press('m');
  await p.waitForTimeout(80);

  // real click on upgrade card
  const lv0 = await p.evaluate('G.state().levels[0]');
  await p.click('.lcard[data-i="0"]');
  await p.waitForTimeout(140);
  const lv1 = await p.evaluate('G.state().levels[0]');

  // real mouse click on the crucible (canvas gather)
  const sc = await p.evaluate('({x:G.renderer.scene.cx,y:G.renderer.scene.cy,s:G.renderer.scene.s})');
  const w1 = await p.evaluate('G.itemCount("water")');
  await p.mouse.click(sc.x, sc.y + 20 * sc.s);
  await p.waitForTimeout(140);
  const w2 = await p.evaluate('G.itemCount("water")');

  // demo state for representative screenshots
  await p.evaluate(`(() => {
    const G = window.G;
    G.setNoAuto(true);
    G.startGame(true);
    G.setPrestige(2);
    G.setLineLevel(0,6); G.setLineLevel(1,5); G.setLineLevel(2,4); G.setLineLevel(3,3);
    G.setRes({mat: 3680, gold: 12400, ess: 860});
    G.setDiscovered(['mist','mire','soot','dew','ember','lichen','vapor','mudcake','lye','sprout','charcoal','salt','clay','fog','tincture','lime','alkali','resin','glass','broth','pigment','oil']);
    ['water','ash','mist','mire','dew','ember','lichen','vapor','lye','sprout','charcoal','salt','clay','fog','tincture','glass','broth','pigment','oil','resin'].forEach(id=>G.grantItem(id, 6));
    G.setPressure(34);
    G.selectRecipe('resin');
    G.step(70);
    G.craft('resin');
    G.step(12);
    G.setPressure(34);
    const t = document.getElementById('toast'); if (t) t.classList.remove('show');
  })()`);
  await p.waitForTimeout(300);
  await p.screenshot({ path: `${OUT}/play-1280x720-demo.png` });
  report.shots.push(`${OUT}/play-1280x720-demo.png`);

  // 640×360 representative gameplay
  await p.setViewportSize({ width: 640, height: 360 });
  await p.waitForTimeout(400);
  await p.evaluate(`(() => {
    const G = window.G;
    G.setNoAuto(true);
    G.startGame(true);
    G.setPrestige(2);
    G.setLineLevel(0,6); G.setLineLevel(1,5); G.setLineLevel(2,4); G.setLineLevel(3,3);
    G.setRes({mat: 3680, gold: 12400, ess: 860});
    G.setDiscovered(['mist','mire','soot','dew','ember','lichen','vapor','mudcake','lye','sprout','charcoal','salt','clay','fog','tincture','lime','alkali','resin','glass','broth','pigment','oil']);
    ['water','ash','mist','mire','dew','ember','lichen','vapor','lye','sprout','charcoal','salt','clay','fog','tincture','glass','broth','pigment','oil','resin'].forEach(id=>G.grantItem(id, 6));
    G.setPressure(34);
    G.selectRecipe('resin');
    G.step(90);
    G.craft('resin');
    G.step(10);
    G.setPressure(34);
    const t = document.getElementById('toast'); if (t) t.classList.remove('show');
  })()`);
  await p.waitForTimeout(300);
  await p.screenshot({ path: `${OUT}/play-640x360.png` });
  await p.screenshot({ path: `${OUT}/play-640x360.jpg`, type: 'jpeg', quality: 92 });
  report.shots.push(`${OUT}/play-640x360.png`, `${OUT}/play-640x360.jpg`);

  const external = a.reqs.filter(u => !u.includes('localhost'));
  report.input = {
    startedMode: started.mode,
    lineSwitch: { after2: line2, after1: line1 },
    gather: { waterBefore: w0, ...afterGather },
    cards: afterCards,
    quickCraft: { before: c0, after: cQuick },
    paused: paused.paused, resumed: !resumed.paused,
    muteBefore: mutedBefore, muteAfter: mutedAfter,
    upgrade: { from: lv0, to: lv1 },
    canvasGather: { before: w1, after: w2 },
    external, consoleErrors: a.errs, consoleWarnings: a.warns, pageErrors: a.perrs,
  };
  report.extAll.push(...external);
  await ctx.close();
}

// ---------- real touch (hasTouch context) ----------
{
  const ctx = await browser.newContext({ viewport: { width: 640, height: 360 }, hasTouch: true });
  const p = await ctx.newPage();
  const a = attach(p);
  await p.goto(BASE, { waitUntil: 'load' });
  await p.waitForTimeout(600);
  await p.tap('#startbtn');
  await p.waitForTimeout(250);
  const tw0 = await p.evaluate('G.itemCount("water")');
  await p.tap('#gatherbtn');
  await p.waitForTimeout(140);
  const tw1 = await p.evaluate('G.itemCount("water")');
  const tc0 = await p.evaluate('G.state().totalCrafts');
  await p.tap('.rcard[data-id="mist"]');
  await p.waitForTimeout(160);
  const tc1 = await p.evaluate('G.state().totalCrafts');
  const external = a.reqs.filter(u => !u.includes('localhost'));
  report.touch = {
    started: await p.evaluate('G.state().mode'),
    waterTouch: { before: tw0, after: tw1 },
    cardTouch: { before: tc0, after: tc1 },
    external, consoleErrors: a.errs, consoleWarnings: a.warns, pageErrors: a.perrs,
  };
  report.extAll.push(...external);
  await ctx.close();
}

await browser.close();
report.extAll = [...new Set(report.extAll)];
fs.writeFileSync(`${OUT}/audit.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
