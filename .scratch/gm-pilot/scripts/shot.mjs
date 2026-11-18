// Gold-miner pilot: smoke test + screenshots (before/after share one script).
// Usage: node shot.mjs before|after
import { chromium } from 'file:///C:/Users/Administrator/AppData/Roaming/npm/node_modules/playwright/index.mjs';

const tag = process.argv[2] || 'before';
const base = process.env.GM_BASE || 'http://127.0.0.1:8123/gold-miner/index.html';
const outDir = 'D:/WorkProjects/AI/Lightgame/.scratch/gm-pilot/shots';

const errors = [];
const failedReq = [];
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 800, height: 1040 } });

page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push(String(e)));
page.on('requestfailed', r => failedReq.push(r.url()));

await page.goto(base, { waitUntil: 'load', timeout: 30000 });
await page.waitForTimeout(3500); // splash fade ~1s + load buffer
await page.screenshot({ path: `${outDir}/${tag}-1-splash-title.png` });

// Enter the game: the title's start button sits at ~(400,840) in an 800x1040 viewport.
await page.mouse.click(400, 840);
await page.waitForTimeout(2500);
await page.screenshot({ path: `${outDir}/${tag}-2-after-click.png` });
const urlAfterClick = page.url();

// Multiple launches while the hook swings — try to actually catch items
let scoreNow = () => page.evaluate(() => (document.getElementById('s1') || {}).innerText || '').catch(() => '?');
const before = await scoreNow();
const xs = [400, 300, 500, 250, 550, 350, 450, 300];
for (let i = 0; i < xs.length; i++) {
  await page.mouse.click(xs[i], 640 + (i % 3) * 60);
  await page.waitForTimeout(1700);
}
await page.screenshot({ path: `${outDir}/${tag}-3-in-game.png` });
let after = await scoreNow();
// If no real catch happened, verify the coin-observer wiring by calling the engine's
// score function directly (documented as wiring test, NOT gameplay verification).
let wiringTest = null;
if (after === before) {
  wiringTest = await page.evaluate(() => { try { window.cP(100); return 'cP(100) called'; } catch (e) { return 'cP failed: ' + e; } });
  await page.waitForTimeout(500);
  after = await scoreNow();
}
const score = `before=${before} after=${after} wiring=${wiringTest || 'real-catch'}`;
const urlFinal = page.url();

// Audio layer presence check (after-integration only)
const audioInfo = await page.evaluate(() => {
  const w = window;
  return {
    hasGmAudio: !!w.gmAudio,
    bgmState: w.gmAudio ? w.gmAudio.debug() : null,
  };
}).catch(e => ({ err: String(e) }));

console.log(JSON.stringify({
  tag,
  urlAfterClick, urlFinal,
  scoreText: score,
  consoleErrors: errors,
  failedRequests: failedReq,
  audioInfo,
}, null, 2));

await browser.close();
