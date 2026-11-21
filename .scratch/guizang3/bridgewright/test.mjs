import { createRequire } from 'module';
const require = createRequire('/tmp/pw/node_modules/');
const { chromium } = require('playwright');

const BASE = 'http://localhost:8612/bridgewright/';
const OUT = '/mnt/tos/workspace/.scratch/guizang3/bridgewright/';
const browser = await chromium.launch({ executablePath: '/usr/local/bin/chromium', args: ['--no-sandbox'] });
const rounds = [];

for (let round = 1; round <= 2; round++) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  const requests = [];
  page.on('console', m => {
    if (m.type() === 'error' || m.type() === 'warning') errors.push({ type: m.type(), text: m.text() });
  });
  page.on('pageerror', e => errors.push({ type: 'pageerror', text: String(e) }));
  page.on('request', r => requests.push(r.url()));

  await page.goto(BASE + '?autotest=1', { waitUntil: 'load' });
  await page.waitForFunction('window.__TEST && window.__TEST.done', { timeout: 180000 });
  const test = await page.evaluate('window.__TEST');
  const state = await page.evaluate('window.__G.state()');
  const external = requests.filter(u => !u.startsWith('http://localhost:8612') && !u.startsWith('data:') && !u.startsWith('blob:'));
  await page.screenshot({ path: OUT + `autotest-round${round}.png` });
  rounds.push({ round, pass: test.pass, fail: test.fail, total: test.total, done: test.done, crash: test.crash || null, failed: (test.results || []).filter(r => !r.ok), errors, external, finalMode: state.mode, nan: state.nan });
  await page.close();
}

// Real keyboard + mouse smoke test on the normal (non-autotest) page.
const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
const inputErrors = [];
const inputRequests = [];
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') inputErrors.push({ type: m.type(), text: m.text() }); });
page.on('pageerror', e => inputErrors.push({ type: 'pageerror', text: String(e) }));
page.on('request', r => inputRequests.push(r.url()));
await page.goto(BASE, { waitUntil: 'load' });
await page.click('#startbtn');
await page.keyboard.press('Digit2');
await page.waitForTimeout(120);
const cableByKey = await page.evaluate('window.G.state().material');
await page.click('#mat-beam');
const nodes = await page.evaluate('[0,1,2,3,4].map(i => window.G.nodeScreen(i))');
for (let i = 0; i < 4; i++) {
  await page.mouse.click(nodes[i].x, nodes[i].y);
  await page.mouse.click(nodes[i + 1].x, nodes[i + 1].y);
}
const built = await page.evaluate('window.G.state()');
await page.keyboard.press('Enter');
await page.waitForTimeout(200);
const started = await page.evaluate('window.G.state()');
await page.keyboard.press('KeyP');
await page.waitForTimeout(120);
const paused = await page.evaluate('window.G.state()');
await page.keyboard.press('KeyR');
await page.waitForTimeout(120);
const reset = await page.evaluate('window.G.state()');
const inputExternal = inputRequests.filter(u => !u.startsWith('http://localhost:8612') && !u.startsWith('data:') && !u.startsWith('blob:'));
await page.screenshot({ path: OUT + 'desktop-input.png' });
await page.close();

// Portrait touch smoke test.
const mobile = await browser.newPage({ viewport: { width: 430, height: 820 }, isMobile: true, hasTouch: true });
const mobileErrors = [];
mobile.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') mobileErrors.push({ type: m.type(), text: m.text() }); });
mobile.on('pageerror', e => mobileErrors.push({ type: 'pageerror', text: String(e) }));
await mobile.goto(BASE, { waitUntil: 'load' });
await mobile.screenshot({ path: OUT + 'mobile-title.png' });
await mobile.tap('#startbtn');
await mobile.waitForTimeout(250);
await mobile.evaluate('window.G.buildSolution(1); window.G.step(1);');
const n1 = await mobile.evaluate('window.G.nodeScreen(1)');
await mobile.touchscreen.tap(n1.x, n1.y);
await mobile.waitForTimeout(120);
const touchSelected = await mobile.evaluate('window.G.state().selectedNode');
await mobile.screenshot({ path: OUT + 'mobile-build.png' });
await mobile.close();

const input = {
  cableByKey,
  built: { mode: built.mode, members: built.members, spent: built.spent, deckConnected: built.deckConnected },
  started: { mode: started.mode, paused: started.paused },
  paused: { mode: paused.mode, paused: paused.paused },
  reset: { mode: reset.mode, members: reset.members, spent: reset.spent },
  touchSelected,
  errors: inputErrors,
  external: inputExternal,
  mobileErrors,
};

console.log(JSON.stringify({ rounds, input }, null, 2));
await browser.close();
