import { createRequire } from 'module';
const require = createRequire('/tmp/pw/node_modules/');
const { chromium } = require('playwright');

const BASE = 'http://localhost:8623/aqua-conduit/';
const OUT = '/mnt/tos/workspace/.scratch/guizang3/aqua-conduit/';
const browser = await chromium.launch({ executablePath: '/usr/local/bin/chromium', args: ['--no-sandbox', '--use-gl=swiftshader'] });
const rounds = [];

for (let round = 1; round <= 2; round++) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [], requests = [];
  page.on('console', m => { if (['error', 'warning'].includes(m.type())) errors.push({ type: m.type(), text: m.text() }); });
  page.on('pageerror', e => errors.push({ type: 'pageerror', text: String(e) }));
  page.on('request', r => requests.push(r.url()));
  await page.goto(BASE + '?autotest=1', { waitUntil: 'load' });
  await page.waitForFunction('window.__TEST && window.__TEST.done', { timeout: 180000 });
  const test = await page.evaluate('window.__TEST');
  const state = await page.evaluate('window.G.state()');
  const external = requests.filter(u => !u.startsWith('http://localhost:8623') && !u.startsWith('data:') && !u.startsWith('blob:'));
  await page.screenshot({ path: OUT + `autotest-round${round}.png` });
  rounds.push({ round, pass: test.pass, fail: test.fail, total: test.total, crash: test.crash || null, failed: (test.results || []).filter(r => !r.ok), errors, external, finalMode: state.mode, nan: state.nan, net: state.net });
  await page.close();
}

// real keyboard + mouse
const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
const inputErrors = [], inputRequests = [];
page.on('console', m => { if (['error', 'warning'].includes(m.type())) inputErrors.push({ type: m.type(), text: m.text() }); });
page.on('pageerror', e => inputErrors.push({ type: 'pageerror', text: String(e) }));
page.on('request', r => inputRequests.push(r.url()));
await page.goto(BASE, { waitUntil: 'load' });
await page.waitForTimeout(400);
await page.click('#startbtn');
await page.waitForTimeout(250);
const s0 = await page.evaluate('window.G.state()');
const cellPos = await page.evaluate(() => {
  const c = window.G.levelInfo(window.G.state().level).cells.find(c => c.onPath && !['source', 'target', 'cross'].includes(c.t));
  return { ...window.G.cellScreen(c.r, c.c), r: c.r, c: c.c, rot: window.G.cellInfo(c.r, c.c).rot };
});
await page.mouse.click(cellPos.x, cellPos.y);
await page.waitForTimeout(150);
const s1 = await page.evaluate('window.G.state()');
const rotAfterMouse = await page.evaluate(([r, c]) => window.G.cellInfo(r, c).rot, [cellPos.r, cellPos.c]);
await page.keyboard.press('ArrowRight');
await page.keyboard.press('Space');
await page.waitForTimeout(150);
const s2 = await page.evaluate('window.G.state()');
await page.keyboard.press('KeyP');
await page.waitForTimeout(100);
const paused = await page.evaluate('window.G.state().paused');
await page.keyboard.press('KeyP');
await page.keyboard.press('KeyM');
await page.waitForTimeout(100);
const muted = await page.evaluate('window.G.muted()');
await page.keyboard.press('KeyR');
await page.waitForTimeout(150);
const s3 = await page.evaluate('window.G.state()');
const globals = await page.evaluate(() => ['goHome', 'clickMore', 'dp_share', 'play68_submitScore'].map(k => typeof window[k]));
const inputExternal = inputRequests.filter(u => !u.startsWith('http://localhost:8623') && !u.startsWith('data:') && !u.startsWith('blob:'));
await page.screenshot({ path: OUT + 'input-desktop.png' });
await page.close();

// real touch
const mobile = await browser.newPage({ viewport: { width: 430, height: 820 }, isMobile: true, hasTouch: true });
const mobileErrors = [];
mobile.on('console', m => { if (['error', 'warning'].includes(m.type())) mobileErrors.push({ type: m.type(), text: m.text() }); });
mobile.on('pageerror', e => mobileErrors.push({ type: 'pageerror', text: String(e) }));
await mobile.goto(BASE, { waitUntil: 'load' });
await mobile.waitForTimeout(400);
await mobile.tap('#startbtn');
await mobile.waitForTimeout(250);
const tPos = await mobile.evaluate(() => {
  const c = window.G.levelInfo(window.G.state().level).cells.find(c => c.onPath && !['source', 'target', 'cross'].includes(c.t));
  return { ...window.G.cellScreen(c.r, c.c), r: c.r, c: c.c, used: window.G.state().used };
});
await mobile.touchscreen.tap(tPos.x, tPos.y);
await mobile.waitForTimeout(200);
const touchState = await mobile.evaluate(([r, c]) => ({ used: window.G.state().used, rot: window.G.cellInfo(r, c).rot, sol: window.G.cellInfo(r, c).sol }), [tPos.r, tPos.c]);
await mobile.screenshot({ path: OUT + 'input-mobile.png' });
await mobile.close();

// direct open, no params
const direct = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const directErrors = [], directRequests = [];
direct.on('console', m => { if (['error', 'warning'].includes(m.type())) directErrors.push({ type: m.type(), text: m.text() }); });
direct.on('pageerror', e => directErrors.push({ type: 'pageerror', text: String(e) }));
direct.on('request', r => directRequests.push(r.url()));
await direct.goto(BASE, { waitUntil: 'load' });
await direct.waitForTimeout(1000);
const directState = await direct.evaluate('window.G.state()');
await direct.close();

const input = {
  startMoves: s0.movesLeft,
  mouse: { movesBefore: s0.movesLeft, movesAfter: s1.movesLeft, rotBefore: cellPos.rot, rotAfter: rotAfterMouse },
  keyboard: { movesAfter: s2.movesLeft, used: s2.used, cursor: s2.cursor },
  paused,
  muted,
  restart: { mode: s3.mode, used: s3.used, movesLeft: s3.movesLeft, budget: s3.budget },
  globals,
  touch: { usedBefore: tPos.used, usedAfter: touchState.used, rot: touchState.rot, sol: touchState.sol },
  errors: inputErrors,
  external: inputExternal,
  mobileErrors,
};
const directInfo = {
  mode: directState.mode,
  errors: directErrors,
  external: directRequests.filter(u => !u.startsWith('http://localhost:8623') && !u.startsWith('data:') && !u.startsWith('blob:')),
};

console.log(JSON.stringify({ rounds, input, directInfo }, null, 2));
await browser.close();
