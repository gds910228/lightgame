import { createRequire } from 'module';
const require = createRequire('/tmp/pw/node_modules/');
const { chromium } = require('playwright');

const PORT = 8627;
const BASE = `http://localhost:${PORT}/echo-hour/`;
const OUT = '/mnt/tos/workspace/.scratch/guizang3/echo-hour';

const browser = await chromium.launch({
  headless: true,
  executablePath: '/usr/local/bin/chromium',
  args: ['--no-sandbox', '--use-gl=swiftshader'],
});

async function newPage(w = 1280, h = 720) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  const errors = [], warnings = [], pageerrors = [], requests = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
    if (m.type() === 'warning') warnings.push(m.text());
  });
  page.on('pageerror', (e) => pageerrors.push(String(e)));
  page.on('request', (r) => requests.push(r.url()));
  return { page, errors, warnings, pageerrors, requests };
}

const report = { rounds: [], direct: null, input: null, screenshots: [] };

for (let round = 1; round <= 2; round++) {
  const t = await newPage();
  await t.page.goto(BASE + '?autotest=1', { waitUntil: 'load' });
  await t.page.waitForFunction('window.__TEST && window.__TEST.done === true', { timeout: 180000 });
  const test = await t.page.evaluate('window.__TEST');
  const audit = await t.page.evaluate('window.__AUDIT || null');
  await t.page.waitForTimeout(500);
  const external = t.requests.filter((u) => !u.includes('localhost') && !u.startsWith('data:'));
  report.rounds.push({
    round,
    pass: test.pass,
    fail: test.fail,
    total: test.total,
    done: test.done,
    failing: test.results.filter((r) => !r.ok),
    errors: t.errors,
    warnings: t.warnings,
    pageerrors: t.pageerrors,
    external,
    audit,
  });
  await t.page.close();
}

// direct open, no params
{
  const t = await newPage();
  await t.page.goto(BASE, { waitUntil: 'load' });
  await t.page.waitForTimeout(1200);
  const st = await t.page.evaluate(() => ({
    hasG: !!window.G,
    mode: window.G && window.G.state().mode,
    bootErr: window.__BOOTERR.length,
    err: window.G ? window.G.err.length : -1,
    titleVisible: !document.getElementById('title').classList.contains('hidden'),
  }));
  report.direct = {
    ...st,
    errors: t.errors, warnings: t.warnings, pageerrors: t.pageerrors,
    external: t.requests.filter((u) => !u.includes('localhost') && !u.startsWith('data:')),
  };
  // title screenshot
  await t.page.screenshot({ path: `${OUT}/shot-title.png` });
  report.screenshots.push(`${OUT}/shot-title.png`);

  // real keyboard + mouse smoke on the same page
  await t.page.keyboard.press('Enter');
  await t.page.waitForTimeout(300);
  const before = await t.page.evaluate(() => window.G.state());
  await t.page.keyboard.down('KeyD');
  await t.page.waitForTimeout(500);
  await t.page.keyboard.up('KeyD');
  const afterMove = await t.page.evaluate(() => window.G.state());
  await t.page.keyboard.press('Space');
  await t.page.waitForTimeout(180);
  const afterJump = await t.page.evaluate(() => window.G.state());
  await t.page.keyboard.press('KeyE');
  await t.page.waitForTimeout(150);
  const afterRec = await t.page.evaluate(() => window.G.state());
  await t.page.waitForTimeout(450);
  await t.page.keyboard.press('KeyE');
  await t.page.waitForTimeout(150);
  const afterEcho = await t.page.evaluate(() => window.G.state());
  // pointer smoke: show touch controls and click record button
  await t.page.evaluate(() => window.G.ui.showTouch(true));
  await t.page.waitForTimeout(100);
  const recBefore = await t.page.evaluate(() => window.G.state().recording);
  await t.page.click('#trec');
  await t.page.waitForTimeout(150);
  const recAfter = await t.page.evaluate(() => window.G.state().recording);
  report.input = {
    modeBefore: before.mode,
    xBefore: before.player.x, xAfter: afterMove.player.x,
    yStand: afterMove.player.y, yAfterJump: afterJump.player.y,
    recordingAfterE: afterRec.recording,
    echoAfterSecondE: afterEcho.echoActive,
    echoFrames: afterEcho.echoFrames,
    touchRecordBefore: recBefore, touchRecordAfter: recAfter,
    errors: t.errors, pageerrors: t.pageerrors,
  };
  await t.page.close();
}

// gameplay screenshot at 640x360
{
  const t = await newPage(640, 360);
  await t.page.goto(BASE + '?autostart=1', { waitUntil: 'load' });
  await t.page.waitForTimeout(1400);
  await t.page.screenshot({ path: `${OUT}/shot-play.png` });
  await t.page.screenshot({ path: '/mnt/tos/workspace/packages/games/echo-hour/thumbnail.jpg', type: 'jpeg', quality: 92 });
  report.screenshots.push(`${OUT}/shot-play.png`);
  report.goalErrors = { errors: t.errors, warnings: t.warnings, pageerrors: t.pageerrors };
  await t.page.close();
}

await browser.close();
console.log(JSON.stringify(report, null, 2));
