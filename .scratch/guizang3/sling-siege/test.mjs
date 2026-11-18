// Autotest runner for sling-siege (guizang3 series).
// Usage: node test.mjs sling-siege 8613 --shot
import { createRequire } from 'module';
const require2 = createRequire('C:/Users/Administrator/.agents/skills/playwright-skill/node_modules/');
const { chromium } = require2('playwright');

const [gameId, port = '8600', wantShot] = process.argv.slice(2);
const base = `http://localhost:${port}`;
const errors = [], requests = [];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
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
  const terr = await page.evaluate('window.__TEST_ERR || ""').catch(() => '');
  if (terr) console.log('TEST_ERR:', terr);
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
  // fresh session: title → level select → in-level play
  await page.goto(`${base}/${gameId}/`, { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${dir}/shot-title.png` });
  await page.click('#startbtn').catch(() => { });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${dir}/shot-select.png` });
  const okLvl = await page.evaluate(() => {
    const b = document.getElementById('lvl-1');
    if (b) { b.click(); return true; }
    return false;
  }).catch(() => false);
  await page.waitForTimeout(1200);
  if (okLvl) {
    // drag-aim via mouse to show the trajectory, then release-fire
    const box = await page.locator('#gl').boundingBox();
    if (box) {
      const sx = box.x + box.width * 0.22, sy = box.y + box.height * 0.62;
      await page.mouse.move(sx, sy);
      await page.mouse.down();
      await page.mouse.move(sx - 70, sy + 55, { steps: 8 });
      await page.waitForTimeout(250);
      await page.screenshot({ path: `${dir}/shot-aim.png` });
      await page.mouse.up();
    }
    await page.waitForTimeout(700);
  }
  await page.screenshot({ path: `${dir}/shot-play.png` });
}
await browser.close();
