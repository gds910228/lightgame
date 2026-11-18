// Autotest runner for deep-catch-saga (guizang3 series).
// Usage: node test.mjs deep-catch-saga 8612 --shot
// - loads http://localhost:<port>/deep-catch-saga/?autotest=1
// - waits for window.__TEST.done, prints summary, console errors, external requests
// - --shot: title / mid-fishing / dex panel screenshots into this directory
import { createRequire } from 'module';
const require2 = createRequire('C:/Users/Administrator/.agents/skills/playwright-skill/node_modules/');
const { chromium } = require2('playwright');

const [gameId, port = '8600', wantShot] = process.argv.slice(2);
const base = `http://localhost:${port}`;
const errors = [], requests = [];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 1100 } });
page.on('console', m => {
  const txt = m.text();
  if (m.type() === 'warning' && /AudioContext was not allowed|GPU stall due to ReadPixels/i.test(txt)) return;  // environmental
  if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + txt);
});
page.on('pageerror', e => errors.push('pageerror: ' + String(e)));
page.on('request', r => requests.push(r.url()));

await page.goto(`${base}/${gameId}/?autotest=1`, { waitUntil: 'load' });
try {
  await page.waitForFunction('window.__TEST && window.__TEST.done', { timeout: 180000 });
} catch (e) {
  console.log('TIMEOUT waiting for __TEST.done');
  const bootErr = await page.evaluate('window.__BOOTERR || []').catch(() => []);
  console.log('BOOTERR:', JSON.stringify(bootErr));
  console.log('console/page errors so far:', errors.length ? errors : 'NONE');
  await page.screenshot({ path: `D:/WorkProjects/AI/Lightgame/.scratch/guizang3/${gameId}/timeout.png` });
  await browser.close();
  process.exit(2);
}
const t = await page.evaluate('window.__TEST');
const fails = (t.results || []).filter(r => !r.ok);
console.log(JSON.stringify({ pass: t.pass, fail: t.fail, total: t.total, failed: fails.map(f => `T${f.id} ${f.name}`) }, null, 1));
console.log('console/page errors:', errors.length ? errors : 'NONE');
const external = requests.filter(u => !u.includes(`localhost:${port}`));
console.log('external requests:', external.length ? external : 'NONE');

if (wantShot) {
  const dir = `D:/WorkProjects/AI/Lightgame/.scratch/guizang3/${gameId}`;
  await page.screenshot({ path: `${dir}/shot-after-test.png` });
  // title (dock) screen, clean load
  await page.goto(`${base}/${gameId}/`, { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${dir}/shot-title.png` });
  // mid-fishing: sink stage around 30m with obstacles visible
  await page.evaluate('(() => { const G = window.__G; G.startGame(); G.cast(1); G.upd(60); })()');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${dir}/shot-play.png` });
  // reel stage close-up (tension bar visible)
  await page.evaluate('(() => { const G = window.__G; G.forceBite(4); })()');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${dir}/shot-reel.png` });
  // dex panel with some catches registered
  await page.evaluate('(() => { const G = window.__G; for (let l = 0; l < 3; l++) for (let q = 0; q < 7; q++) G.forceCatch(l, q, 3.5); G.openPanel("dex"); })()');
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${dir}/shot-dex.png` });
}
await browser.close();
