import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire('/tmp/pw/node_modules/');
const { chromium } = require('/tmp/pw/node_modules/playwright');

const PORT = 8613;
const ID = 'whisper-heist';
const BASE = `http://localhost:${PORT}/${ID}/`;
const OUT = '/mnt/tos/workspace/.scratch/guizang3/whisper-heist';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: '/usr/local/bin/chromium',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

const allErrors = [];
const allExternal = [];
const rounds = [];

for (let round = 1; round <= 2; round++) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  const errors = [], requests = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`); });
  page.on('pageerror', e => errors.push(`[pageerror] ${String(e)}`));
  page.on('request', r => requests.push(r.url()));
  page.on('requestfailed', r => errors.push(`[requestfailed] ${r.url()} ${r.failure()?.errorText}`));

  await page.goto(BASE + '?autotest=1', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction('window.__TEST && window.__TEST.done', null, { timeout: 120000 });
  const result = await page.evaluate('window.__TEST');
  const booterr = await page.evaluate('window.__BOOTERR.slice()');
  const external = requests.filter(u => u.startsWith('http') && !u.startsWith(`http://localhost:${PORT}`));

  // sanity: every required category is covered and passing
  // 1 boot / 7 NaN / 2-4 core math / 8 input / 13+21 economy / 22-24 failure
  // 27 victory / 28 report order / 30 best persistence
  const mandatory = [1, 7, 2, 3, 4, 8, 13, 21, 22, 23, 24, 27, 28, 30];
  const byId = new Map(result.results.map(r => [r.id, r]));
  const mandatoryOk = mandatory.every(id => byId.get(id) && byId.get(id).ok);

  if (round === 1) await page.screenshot({ path: `${OUT}/shot-title.png` });

  rounds.push({
    round, pass: result.pass, fail: result.fail, total: result.total,
    mandatoryOk, crashed: !!result.crashed,
    booterr, errors: [...errors], external: [...external],
  });
  allErrors.push(...errors);
  allExternal.push(...external);
  await context.close();
}

// ---------- real gameplay screenshots (title / in-game) ----------
const gctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const gp = await gctx.newPage();
const gerr = [], greq = [];
gp.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') gerr.push(`[${m.type()}] ${m.text()}`); });
gp.on('pageerror', e => gerr.push(`[pageerror] ${String(e)}`));
gp.on('request', r => greq.push(r.url()));
await gp.goto(BASE + '?autostart=1&level=4', { waitUntil: 'domcontentloaded' });
await gp.waitForFunction('window.G && window.G.state && window.G.state().mode === "play"', null, { timeout: 15000 });
await gp.evaluate(() => {
  G.teleport(300, 250);
  G.step(24);
  G.press('KeyD');
  G.step(18);
  G.release('KeyD');
  G.step(6);
  G.ui.hideBanner();
  G.ui.hideToast();
});
await gp.waitForTimeout(400);
await gp.screenshot({ path: `${OUT}/shot-game.png` });
await gctx.close();

// ---------- 640×360 in-game thumbnail ----------
const tctx = await browser.newContext({ viewport: { width: 640, height: 360 } });
const tp = await tctx.newPage();
const terr = [];
tp.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') terr.push(`[${m.type()}] ${m.text()}`); });
tp.on('pageerror', e => terr.push(`[pageerror] ${String(e)}`));
await tp.goto(BASE + '?autostart=1&level=12', { waitUntil: 'domcontentloaded' });
await tp.waitForFunction('window.G && window.G.state && window.G.state().mode === "play"', null, { timeout: 15000 });
await tp.evaluate(() => {
  // stand in the middle of the final vault, with guards, cones, relics and HUD visible
  G.teleport(390, 240);
  G.setScore(1460);
  G.setBest(1460);
  G.step(40);
  G.press('KeyW');
  G.step(10);
  G.release('KeyW');
  G.step(3);
  G.ui.hideBanner();
  G.ui.hideToast();
});
await tp.waitForTimeout(400);
await tp.screenshot({ path: '/mnt/tos/workspace/packages/games/whisper-heist/thumbnail.jpg', type: 'jpeg', quality: 90 });
await tp.screenshot({ path: `${OUT}/shot-thumb-raw.png` });
await tctx.close();

const externalGame = [
  ...greq.filter(u => u.startsWith('http') && !u.startsWith(`http://localhost:${PORT}`)),
];
allErrors.push(...gerr, ...terr);
allExternal.push(...externalGame);

await browser.close();

const report = {
  rounds,
  gameplayConsole: { errors: gerr, external: externalGame },
  thumbnailConsole: terr,
  allConsoleErrors: allErrors,
  allExternal,
  thumbnailPath: '/mnt/tos/workspace/packages/games/whisper-heist/thumbnail.jpg',
  thumbnailSize: (() => { try { const s = fs.statSync('/mnt/tos/workspace/packages/games/whisper-heist/thumbnail.jpg'); return s.size; } catch (e) { return 0; } })(),
};
console.log(JSON.stringify(report, null, 2));

const ok = rounds.every(r => r.fail === 0 && r.pass >= 26 && r.mandatoryOk && !r.crashed && r.errors.length === 0 && r.external.length === 0)
  && gerr.length === 0 && terr.length === 0 && externalGame.length === 0;
if (!ok) { console.error('TEST FAILED'); process.exit(1); }
console.log('ALL ROUNDS PASSED');
