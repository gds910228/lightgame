// Deep-debug the games that still fail: capture error sources (file:line), full failed URLs, nav target.
import { chromium } from 'file:///C:/Users/Administrator/AppData/Roaming/npm/node_modules/playwright/index.mjs';
import fs from 'node:fs';

const smoke = JSON.parse(fs.readFileSync('D:/WorkProjects/AI/Lightgame/.scratch/station-upgrade/smoke.json', 'utf8'));
const ids = smoke.filter(r => !r.ok).map(r => r.id);
const browser = await chromium.launch({ headless: true });
const out = [];

for (const id of ids) {
  const r = { id, consoleMsgs: [], pageErrors: [], failed: [], navTo: null, audioAfterClick: null };
  const page = await browser.newPage({ viewport: { width: 800, height: 1040 } });
  page.setDefaultTimeout(12000);
  page.on('console', m => {
    if (m.type() === 'error') {
      const loc = m.location() ? `${m.location().url.split('/').pop()}:${m.location().lineNumber}` : '';
      r.consoleMsgs.push(`${m.text().slice(0, 120)} @ ${loc}`);
    }
  });
  page.on('pageerror', e => r.pageErrors.push(String(e).slice(0, 300)));
  page.on('requestfailed', req => { if (!req.url().startsWith('data:')) r.failed.push(req.url().slice(0, 140)); });
  page.on('response', resp => { if (resp.status() >= 400) r.failed.push(`HTTP${resp.status()} ${resp.url().slice(0, 140)}`); });
  page.on('dialog', d => d.dismiss().catch(() => {}));
  try {
    await page.goto(`http://127.0.0.1:8123/${id}/index.html`, { waitUntil: 'load', timeout: 20000 });
    await page.waitForTimeout(2500);
    await page.mouse.click(400, 520).catch(() => {});
    await page.waitForTimeout(1500);
    if (!page.url().includes(`/${id}/`)) r.navTo = page.url().slice(0, 140);
    r.audioAfterClick = await page.evaluate(() => {
      const a = window.lgAudio || window.gmAudio;
      return a ? a.debug() : null;
    }).catch(() => null);
  } catch (e) {
    r.fatal = String(e).slice(0, 200);
  }
  await page.close().catch(() => {});
  out.push(r);
  console.log(`done ${id}`);
}
await browser.close();
fs.writeFileSync('D:/WorkProjects/AI/Lightgame/.scratch/station-upgrade/debug-failures.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 1).slice(0, 6000));
