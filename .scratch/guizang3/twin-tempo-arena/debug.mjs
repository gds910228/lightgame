import { createRequire } from 'module';
const require = createRequire('/tmp/pw/node_modules/');
const { chromium } = require('playwright');

const PORT = 8629;
const ID = 'twin-tempo-arena';
const BASE = `http://127.0.0.1:${PORT}/${ID}/`;

const browser = await chromium.launch({
  headless: true,
  executablePath: '/usr/local/bin/chromium',
  args: ['--no-sandbox', '--use-gl=swiftshader', '--disable-dev-shm-usage'],
});

const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [], warnings = [], reqs = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); if (m.type() === 'warning') warnings.push(m.text()); });
page.on('pageerror', e => errors.push(String(e)));
page.on('request', r => reqs.push(r.url()));
page.on('requestfailed', r => errors.push('requestfailed ' + r.url() + ' ' + (r.failure() && r.failure().errorText)));
await page.goto(BASE + '?autotest=1', { waitUntil: 'domcontentloaded' });
let state = 'loaded';
try {
  await page.waitForFunction('window.__TEST && window.__TEST.done', null, { timeout: 120000 });
  state = 'done';
} catch (e) {
  state = 'timeout';
}
const result = await page.evaluate(() => window.__TEST || null);
const booterr = await page.evaluate(() => window.__BOOTERR ? window.__BOOTERR.slice() : []);
console.log(JSON.stringify({
  state,
  test: result,
  failed: result ? result.results.filter(r => !r.ok) : null,
  booterr,
  errors,
  warnings,
  external: reqs.filter(u => !u.startsWith(BASE)),
}, null, 2));
await page.screenshot({ path: '/mnt/tos/workspace/.scratch/guizang3/twin-tempo-arena/debug-title.png' });
await browser.close();
