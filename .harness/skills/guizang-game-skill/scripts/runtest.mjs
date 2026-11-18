// Reusable autotest runner for guizang3 series games.
// Usage: node runtest.mjs <gameId> <port> [--shot]
// - loads http://localhost:<port>/<gameId>/?autotest=1
// - waits for window.__TEST.done, prints JSON summary, console errors, external requests
// - optional screenshots (title + mid-Game via ?auto path if supported)
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
  // title screen shot: reload without autotest
  await page.goto(`${base}/${gameId}/`, { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${dir}/shot-title.png` });
  // start a play session via the start button
  await page.click('#startbtn').catch(() => { });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${dir}/shot-play.png` });
}
await browser.close();
