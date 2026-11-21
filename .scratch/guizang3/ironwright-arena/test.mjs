import { createRequire } from 'module';
const require = createRequire('/tmp/pw/node_modules/');
const { chromium } = require('playwright');

const PORT = 8626;
const ID = 'ironwright-arena';
const URL = `http://localhost:${PORT}/${ID}/?autotest=1`;
const OUT = '/mnt/tos/workspace/.scratch/guizang3/ironwright-arena';

const browser = await chromium.launch({
  headless: true,
  executablePath: '/usr/local/bin/chromium',
  args: ['--no-sandbox', '--use-gl=swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [], warnings = [], pageerrors = [], requests = [];
page.on('console', m => {
  if (m.type() === 'error') errors.push(m.text());
  if (m.type() === 'warning') warnings.push(m.text());
});
page.on('pageerror', e => pageerrors.push(String(e)));
page.on('request', r => requests.push(r.url()));
await page.goto(URL, { waitUntil: 'load' });
await page.waitForFunction('window.__TEST && window.__TEST.done === true', { timeout: 120000 });
const results = await page.evaluate('window.__TEST');
const extra = await page.evaluate(() => ({
  booterr: window.__BOOTERR || [],
  net: window.__NET || null,
  reports: window.G && window.G.reportLog ? window.G.reportLog() : null,
  state: window.G ? window.G.state() : null,
}));
await page.screenshot({ path: `${OUT}/after-autotest-title.png` });
console.log(JSON.stringify({ results, extra, errors, warnings, pageerrors, external: requests.filter(u => !u.includes(`localhost:${PORT}`)) }, null, 2));
await browser.close();
