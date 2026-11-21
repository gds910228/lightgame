import { createRequire } from 'module';
const require = createRequire('/tmp/pw/node_modules/');
const { chromium } = require('playwright');

const PORT = process.env.PORT || 8628;
const URL = `http://localhost:${PORT}/crucible-atelier/?autotest=1`;
const b = await chromium.launch({
  headless: true,
  executablePath: '/usr/local/bin/chromium',
  args: ['--no-sandbox', '--use-gl=swiftshader'],
});
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [], warnings = [], pageerrors = [], requests = [];
p.on('console', m => {
  if (m.type() === 'error') errors.push(m.text());
  if (m.type() === 'warning') warnings.push(m.text());
});
p.on('pageerror', e => pageerrors.push(String(e && e.stack || e)));
p.on('request', r => requests.push(r.url()));
await p.goto(URL, { waitUntil: 'load' });
try {
  await p.waitForFunction('window.__TEST && window.__TEST.done', { timeout: 180000 });
} catch (e) {
  console.log('WAIT FAILED', String(e));
  console.log('booterr', JSON.stringify(await p.evaluate('window.__BOOTERR')));
  console.log('testerr', await p.evaluate('window.__TEST_ERR || null'));
}
const test = await p.evaluate('window.__TEST || null');
const net = await p.evaluate('window.__NET || null');
console.log(JSON.stringify(test, null, 1));
console.log('CONSOLE_ERRORS', JSON.stringify(errors));
console.log('CONSOLE_WARNINGS', JSON.stringify(warnings));
console.log('PAGEERRORS', JSON.stringify(pageerrors));
console.log('EXTERNAL', JSON.stringify(requests.filter(u => !u.includes('localhost'))));
console.log('NET', JSON.stringify(net));
await b.close();
