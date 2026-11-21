import { createRequire } from 'module';
import fs from 'fs';

const require = createRequire('/tmp/pw/node_modules/');
const { chromium } = require('/tmp/pw/node_modules/playwright');

const PORT = 8629;
const ID = 'twin-tempo-arena';
const BASE = `http://127.0.0.1:${PORT}/${ID}/`;
const OUT = '/mnt/tos/workspace/.scratch/guizang3/twin-tempo-arena';
const GAME = '/mnt/tos/workspace/packages/games/twin-tempo-arena';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  executablePath: '/usr/local/bin/chromium',
  args: ['--no-sandbox', '--use-gl=swiftshader', '--disable-dev-shm-usage'],
});

const rounds = [];
const allErrors = [], allWarnings = [], allExternal = [];

for (let round = 1; round <= 2; round++) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  const errors = [], warnings = [], reqs = [];
  page.on('console', m => {
    if (m.type() === 'error') errors.push(`[error] ${m.text()}`);
    if (m.type() === 'warning') warnings.push(`[warning] ${m.text()}`);
  });
  page.on('pageerror', e => errors.push(`[pageerror] ${String(e)}`));
  page.on('request', r => reqs.push(r.url()));
  page.on('requestfailed', r => errors.push(`[requestfailed] ${r.url()} ${r.failure()?.errorText}`));

  await page.goto(BASE + '?autotest=1', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction('window.__TEST && window.__TEST.done', null, { timeout: 180000 });
  const result = await page.evaluate('window.__TEST');
  const booterr = await page.evaluate('window.__BOOTERR.slice()');
  const external = reqs.filter(u => u.startsWith('http') && !u.startsWith(`http://127.0.0.1:${PORT}`));
  const failed = result.results.filter(r => !r.ok).map(r => `${r.id}: ${r.name}`);
  const mand = [1, 2, 3, 4, 4.1, 4.2, 5, 6, 7, 8, 11, 12, 16, 17, 18, 19, 20, 21, 22, 23];
  const byId = new Map(result.results.map(r => [r.id, r]));
  const mandatoryOk = mand.every(id => byId.get(id)?.ok);

  if (round === 1) await page.screenshot({ path: `${OUT}/shot-autotest-end.png` });
  rounds.push({
    round, pass: result.pass, fail: result.fail, total: result.total,
    mandatoryOk, failed, booterr, errors: [...errors], warnings: [...warnings],
    external: [...external], done: result.done,
  });
  allErrors.push(...errors); allWarnings.push(...warnings); allExternal.push(...external);
  await context.close();
}

// ---------- real keyboard / pointer smoke ----------
const smoke = { keyboard: null, pointer: null, errors: [], external: [] };
{
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  const reqs = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') smoke.errors.push(`[${m.type()}] ${m.text()}`); });
  page.on('pageerror', e => smoke.errors.push(`[pageerror] ${String(e)}`));
  page.on('request', r => reqs.push(r.url()));
  await page.goto(BASE + '?autostart=1&mode=local', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction('window.G && window.G.state && window.G.state().mode === "play"', null, { timeout: 15000 });
  await page.evaluate(() => { G.setNoAuto(true); G.setPhase('live'); G.setFighter('p1', { x: 380, vx: 0 }); });
  const x0 = await page.evaluate(() => G.state().p1.x);
  await page.keyboard.down('d');
  await page.waitForTimeout(320);
  await page.keyboard.up('d');
  await page.waitForTimeout(80);
  const x1 = await page.evaluate(() => G.state().p1.x);
  smoke.keyboard = { x0, x1, moved: x1 > x0 + 20 };
  await page.click('#pausebtn');
  await page.waitForTimeout(80);
  const paused = await page.evaluate(() => G.state().paused);
  smoke.pointer = { pauseClick: paused };
  smoke.external = reqs.filter(u => u.startsWith('http') && !u.startsWith(`http://127.0.0.1:${PORT}`));
  await page.screenshot({ path: `${OUT}/shot-real-input.png` });
  await context.close();
}
allErrors.push(...smoke.errors); allExternal.push(...smoke.external);

// ---------- real touch hold smoke (touchscreen / coarse pointer) ----------
const touch = { errors: [], external: [], moved: false };
{
  const context = await browser.newContext({ viewport: { width: 812, height: 375 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const reqs = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') touch.errors.push(`[${m.type()}] ${m.text()}`); });
  page.on('pageerror', e => touch.errors.push(`[pageerror] ${String(e)}`));
  page.on('request', r => reqs.push(r.url()));
  await page.goto(BASE + '?autostart=1&mode=local', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction('window.G && window.G.state && window.G.state().mode === "play"', null, { timeout: 15000 });
  await page.evaluate(() => {
    G.setNoAuto(true); G.startRound(2); G.setPhase('live');
    G.setFighter('p1', { x: 360, z: 0, vx: 0, facing: 1 });
    G.setFighter('p2', { x: 600, z: 0, vx: 0, facing: -1 });
    G.setRoundHalf(230);
    document.body.classList.add('touchui');
  });
  const btn = await page.$('#touch button[data-code="KeyD"]');
  const box = await btn.boundingBox();
  touch.x0 = await page.evaluate(() => G.state().p1.x);
  const cdp = await context.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2, id: 1 }] });
  await page.waitForTimeout(330);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(80);
  touch.x1 = await page.evaluate(() => G.state().p1.x);
  touch.moved = touch.x1 > touch.x0 + 25;
  touch.buttons = await page.evaluate(() => document.querySelectorAll('#touch button').length);
  await page.screenshot({ path: `${OUT}/shot-touch.png` });
  touch.external = reqs.filter(u => u.startsWith('http') && !u.startsWith(`http://127.0.0.1:${PORT}`));
  await context.close();
}
allErrors.push(...touch.errors); allExternal.push(...touch.external);

// ---------- direct open, no parameters ----------
const direct = { errors: [], warnings: [], titleVisible: false };
{
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  const reqs = [];
  page.on('console', m => {
    if (m.type() === 'error') direct.errors.push(`[error] ${m.text()}`);
    if (m.type() === 'warning') direct.warnings.push(`[warning] ${m.text()}`);
  });
  page.on('pageerror', e => direct.errors.push(`[pageerror] ${String(e)}`));
  page.on('request', r => reqs.push(r.url()));
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(900);
  direct.titleVisible = await page.evaluate(() => !document.getElementById('title').classList.contains('hide'));
  direct.booterr = await page.evaluate('window.__BOOTERR.slice()');
  direct.external = reqs.filter(u => u.startsWith('http') && !u.startsWith(`http://127.0.0.1:${PORT}`));
  await page.screenshot({ path: `${OUT}/shot-title.png` });
  await context.close();
}
allErrors.push(...direct.errors); allWarnings.push(...direct.warnings); allExternal.push(...direct.external);

// ---------- gameplay screenshot 640x360 + thumbnail ----------
const gameplay = { errors: [], external: [] };
{
  const context = await browser.newContext({ viewport: { width: 640, height: 360 } });
  const page = await context.newPage();
  const reqs = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') gameplay.errors.push(`[${m.type()}] ${m.text()}`); });
  page.on('pageerror', e => gameplay.errors.push(`[pageerror] ${String(e)}`));
  page.on('request', r => reqs.push(r.url()));
  await page.goto(BASE + '?autostart=1&mode=local', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction('window.G && window.G.state && window.G.state().mode === "play"', null, { timeout: 15000 });
  await page.evaluate(() => {
    G.setNoAuto(true);
    G.startRound(1);                 // 抢点 round, jade lamp lit
    G.setPhase('live');
    G.setFighter('p1', { x: 480 - 78, z: 0, vx: 0, facing: 1, hp: 64, progress: 63 });
    G.setFighter('p2', { x: 480 + 82, z: 0, vx: 0, facing: -1, hp: 88, progress: 41 });
    G.setTimer(18.4);
    G.clearFx();
    const toast = document.getElementById('toast'); if (toast) toast.classList.remove('show');
  });
  await page.waitForTimeout(240);
  await page.evaluate(() => {
    G.setFighter('p1', { x: 480 - 78, z: 0, vx: 0, facing: 1, progress: 63 });
    G.setFighter('p2', { x: 480 + 82, z: 0, vx: 0, facing: -1, progress: 41 });
    G.press('KeyF');
    G.upd(1);
    G.clearFx();
    G.setFighter('p1', { atkAnim: 0.17 });
  });
  await page.screenshot({ path: `${OUT}/shot-game.png` });
  await page.screenshot({ path: `${GAME}/thumbnail.jpg`, type: 'jpeg', quality: 92 });
  await page.screenshot({ path: `${OUT}/shot-thumb-raw.png` });
  gameplay.external = reqs.filter(u => u.startsWith('http') && !u.startsWith(`http://127.0.0.1:${PORT}`));
  await context.close();
}
allErrors.push(...gameplay.errors); allExternal.push(...gameplay.external);

await browser.close();

const thumbStat = (() => { try { return fs.statSync(`${GAME}/thumbnail.jpg`).size; } catch (e) { return 0; } })();
const report = {
  rounds,
  smoke,
  touch,
  direct,
  gameplay,
  allErrors,
  allWarnings,
  allExternal,
  thumbnail: { path: `${GAME}/thumbnail.jpg`, bytes: thumbStat },
};
console.log(JSON.stringify(report, null, 2));
fs.writeFileSync(`${OUT}/test-report.json`, JSON.stringify(report, null, 2));
