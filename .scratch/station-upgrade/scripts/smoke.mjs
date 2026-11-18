// Station-wide smoke test: load every game, catch errors, click once, detect navigation.
// Usage: node smoke.mjs [--only id,id2] [--port 8123]
import { chromium } from 'file:///C:/Users/Administrator/AppData/Roaming/npm/node_modules/playwright/index.mjs';
import fs from 'node:fs';

const PORT = 8123;
const onlyFlag = process.argv.indexOf('--only');
const only = onlyFlag > -1 ? process.argv[onlyFlag + 1].split(',') : null;
const audit = JSON.parse(fs.readFileSync('D:/WorkProjects/AI/Lightgame/.scratch/station-upgrade/audit.json', 'utf8'));
const games = only ? audit.filter(g => only.includes(g.id)) : audit;
const OUT = 'D:/WorkProjects/AI/Lightgame/.scratch/station-upgrade/smoke.json';

const results = [];
const browser = await chromium.launch({ headless: true });

async function testGame(g) {
  const r = { id: g.id, ok: false, consoleErrors: [], pageErrors: [], failedReq: [], navOnClick: false, clicked: false, imgs: 0, canvases: 0, shot: null };
  const page = await browser.newPage({ viewport: { width: 800, height: 1040 } });
  page.setDefaultTimeout(15000);
  page.on('console', m => { if (m.type() === 'error') r.consoleErrors.push(m.text().slice(0, 200)); });
  page.on('pageerror', e => r.pageErrors.push(String(e).slice(0, 200)));
  page.on('requestfailed', req => {
    const u = req.url();
    if (!u.startsWith('data:')) r.failedReq.push(u.slice(0, 150));
  });
  page.on('dialog', d => d.dismiss().catch(() => {}));
  try {
    const resp = await page.goto(`http://127.0.0.1:${PORT}/${g.id}/index.html`, { waitUntil: 'load', timeout: 20000 });
    r.httpStatus = resp ? resp.status() : null;
    await page.waitForTimeout(2500);
    r.imgs = await page.locator('img').count();
    r.canvases = await page.locator('canvas').count();
    r.divs = await page.locator('body div, body button').count().catch(() => 0);
    // audio layer state (lgAudio generic / gmAudio gold-miner)
    r.audio = await page.evaluate(() => {
      const a = window.lgAudio || window.gmAudio;
      return a ? a.debug() : null;
    }).catch(() => null);
    // one safe interaction: click center
    try {
      await page.mouse.click(400, 520);
      r.clicked = true;
      await page.waitForTimeout(1200);
      r.navOnClick = !page.url().includes(`/${g.id}/`);
      if (r.navOnClick) {
        r.navTarget = page.url();
        await page.goto(`http://127.0.0.1:${PORT}/${g.id}/index.html`, { waitUntil: 'load', timeout: 15000 });
        await page.waitForTimeout(1200);
      }
    } catch {}
    // audio layer state AFTER interaction (BGM starts on first gesture)
    await page.waitForTimeout(2200);
    r.audio = await page.evaluate(() => {
      const a = window.lgAudio || window.gmAudio;
      return a ? a.debug() : null;
    }).catch(() => null);
    const shotDir = 'D:/WorkProjects/AI/Lightgame/.scratch/station-upgrade/shots';
    fs.mkdirSync(shotDir, { recursive: true });
    r.shot = `${shotDir}/${g.id}.png`;
    await page.screenshot({ path: r.shot, timeout: 8000 });
    // only navigation AWAY from the station origin counts as failure ("home" buttons going to '/' are intended UI)
    r.navExternal = r.navOnClick && r.navTarget && !r.navTarget.startsWith('http://127.0.0.1:8123') ? r.navTarget : null;
    r.ok = r.pageErrors.length === 0 && r.consoleErrors.length === 0 && !r.navExternal && (r.imgs + r.canvases + r.divs) > 0;
  } catch (e) {
    r.fatal = String(e).slice(0, 200);
  }
  await page.close().catch(() => {});
  return r;
}

let done = 0;
for (const g of games) {
  results.push(await testGame(g));
  done++;
  if (done % 10 === 0) console.log(`... ${done}/${games.length}`);
}
await browser.close();
fs.writeFileSync(OUT, JSON.stringify(results, null, 2));

const bad = results.filter(r => !r.ok);
const audioOk = results.filter(r => r.audio && r.audio.bgmOn).length;
console.log(`\ntested: ${results.length}, ok: ${results.length - bad.length}, problems: ${bad.length}, audioLayerOn: ${audioOk}`);
for (const r of bad) {
  console.log(`- ${r.id}: ${r.fatal ? 'FATAL ' + r.fatal : ''}${r.navOnClick ? '[NAV-ON-CLICK]' : ''}${r.pageErrors.length ? ' pageErr:' + r.pageErrors[0] : ''}${r.consoleErrors.length ? ' consoleErr:' + r.consoleErrors[0] : ''}${(r.imgs + r.canvases) === 0 ? ' [NO RENDER SURFACE]' : ''}${r.failedReq.length ? ' failedReq:' + r.failedReq[0] : ''}`);
}
