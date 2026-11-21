import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

const require = createRequire('/tmp/pw/node_modules/');
const { chromium } = require('playwright');

const PORT = 8614;
const URL_BASE = `http://localhost:${PORT}/frostpuck-arena/`;
const OUT = '/mnt/tos/workspace/.scratch/guizang3/frostpuck-arena';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: '/usr/local/bin/chromium',
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--mute-audio'],
});
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const audit = [];
const smoke = [];

for (let round = 1; round <= 2; round++) {
  const page = await context.newPage();
  const errors = [], warnings = [], pageErrors = [], external = [], requests = [];
  page.setDefaultTimeout(120000);
  page.on('console', m => {
    if (m.type() === 'error') errors.push(m.text());
    else if (m.type() === 'warning') warnings.push(m.text());
  });
  page.on('pageerror', e => pageErrors.push(String(e)));
  page.on('request', r => {
    const u = r.url();
    requests.push(u);
    if (!u.startsWith(`http://localhost:${PORT}/`) && !u.startsWith('data:') && !u.startsWith('blob:')) external.push(u);
  });
  page.on('requestfailed', r => {
    const u = r.url();
    if (!u.startsWith(`http://localhost:${PORT}/`) && !u.startsWith('data:') && !u.startsWith('blob:')) external.push(`${u} (failed)`);
  });

  await page.goto(`${URL_BASE}?autotest=1`, { waitUntil: 'load' });
  await page.waitForFunction('window.__TEST && window.__TEST.done', null, { timeout: 120000 });
  const test = await page.evaluate(() => window.__TEST);
  const testErr = await page.evaluate(() => window.__TEST_ERR || null);

  await page.screenshot({ path: path.join(OUT, `title-round${round}.png`) });

  // deterministic in-match snapshot
  await page.evaluate(() => {
    const G = window.__G;
    G.startMatch('ai', 2);
    G.setNoAuto(true);
    G.startRally();
    G.upd(40);
    G.setScore(3, 2);
    G.setPaddle('p1', 410, 446);
    G.setPaddle('p2', 566, 162);
    G.setPuck(410, 398, 0, 0);
    G.press('KeyW');
    G.upd(3);
    G.release('KeyW');
    G.step(1);
  });
  await page.waitForTimeout(60);
  await page.screenshot({ path: path.join(OUT, `game-round${round}.png`) });

  // real mouse drag smoke (outside the assertion suite, local mode = no AI goals)
  await page.evaluate(() => {
    const G = window.__G;
    G.startMatch('local');
    G.setNoAuto(true);
    G.startRally();
    G.setPaddle('p1', 450, 430);
  });
  const view = await page.evaluate(() => window.__G.view());
  const beforeX = await page.evaluate(() => window.__G.state().p1.x);
  const ax = view.ox + 470 * view.scale, ay = view.oy + 420 * view.scale;
  const bx = view.ox + 240 * view.scale, by = view.oy + 430 * view.scale;
  await page.mouse.move(ax, ay);
  await page.mouse.down();
  await page.mouse.move(bx, by, { steps: 10 });
  await page.waitForTimeout(120);
  await page.mouse.up();
  const afterX = await page.evaluate(() => window.__G.state().p1.x);
  smoke.push({ round, beforeX: +beforeX.toFixed(1), afterX: +afterX.toFixed(1), moved: afterX < beforeX - 80 });

  const failed = test.results.filter(r => !r.ok);
  audit.push({
    round,
    pass: test.pass,
    fail: test.fail,
    total: test.total ?? test.results.length,
    done: !!test.done,
    crashed: !!test.crashed,
    testErr,
    failed,
    consoleErrors: errors,
    consoleWarnings: warnings,
    pageErrors,
    external,
    requestCount: requests.length,
  });
  console.log(`ROUND ${round}: ${test.pass}/${test.total ?? test.results.length} pass, ${test.fail} fail; errors=${errors.length} warnings=${warnings.length} pageErrors=${pageErrors.length} external=${external.length}; smoke=${afterX < beforeX - 80}`);
  if (failed.length) console.log('FAILED:', JSON.stringify(failed, null, 2));
  if (errors.length || warnings.length || pageErrors.length) {
    console.log('CONSOLE:', JSON.stringify({ errors, warnings, pageErrors }, null, 2));
  }
  await page.close();
}

// 640×360 in-game thumbnail from a real match frame
const thumbPage = await context.newPage();
await thumbPage.setViewportSize({ width: 1280, height: 720 });
await thumbPage.goto(`${URL_BASE}?autostart=1&difficulty=2`, { waitUntil: 'load' });
await thumbPage.waitForFunction('window.__G && window.__G.state().mode === "play"');
await thumbPage.evaluate(() => {
  const G = window.__G;
  G.setNoAuto(true);
  G.startMatch('ai', 2);
  G.startRally();
  G.upd(40);
  G.setScore(5, 3);
  G.setPaddle('p1', 410, 446);
  G.setPaddle('p2', 566, 146);
  G.setPuck(410, 398, 0, 0);
  G.press('KeyW');
  G.upd(3);
  G.release('KeyW');
  G.setPuck(470, 250, 700, -300);
  G.upd(5);
  G.step(1);
});
await thumbPage.waitForTimeout(40);
const fullShot = path.join(OUT, 'thumbnail-full.png');
await thumbPage.screenshot({ path: fullShot });
const thumbPath = '/mnt/tos/workspace/packages/games/frostpuck-arena/thumbnail.jpg';
const cres = spawnSync('convert', [fullShot, '-resize', '640x360!', '-strip', '-quality', '90', thumbPath], { encoding: 'utf8' });
if (cres.status !== 0) console.error('convert failed', cres.stderr);
const ident = spawnSync('identify', ['-format', '%wx%h', thumbPath], { encoding: 'utf8' });
console.log('THUMB', ident.stdout, fs.statSync(thumbPath).size, 'bytes');
await thumbPage.close();

const summary = {
  audit,
  smoke,
  thumbnail: { path: thumbPath, size: fs.statSync(thumbPath).size, dimensions: ident.stdout },
  ok: audit.length === 2 && audit.every(a => a.done && a.fail === 0 && a.pass >= 24 && a.total >= 24 &&
    a.consoleErrors.length === 0 && a.consoleWarnings.length === 0 && a.pageErrors.length === 0 && a.external.length === 0) &&
    smoke.every(s => s.moved),
};
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(summary, null, 2));
console.log('SUMMARY', JSON.stringify({ ok: summary.ok, rounds: audit.map(a => ({ pass: a.pass, fail: a.fail, total: a.total, errors: a.consoleErrors.length, warnings: a.consoleWarnings.length, external: a.external.length })), smoke: summary.smoke }, null, 2));

await browser.close();
process.exit(summary.ok ? 0 : 1);
