import { createRequire } from 'module';
const require = createRequire('/tmp/pw/node_modules/');
const { chromium } = require('playwright');
const browser = await chromium.launch({ headless:true, executablePath:'/usr/local/bin/chromium', args:['--no-sandbox','--use-gl=swiftshader'] });
const page = await browser.newPage({ viewport:{width:1280,height:720} });
const errors=[], warnings=[], requests=[];
page.on('console', m => { if(m.type()==='error') errors.push(m.text()); if(m.type()==='warning') warnings.push(m.text()); });
page.on('pageerror', e => errors.push(String(e)));
page.on('request', r => requests.push(r.url()));
await page.goto('http://127.0.0.1:8620/orbit-kart-grand-prix/?autotest=1');
try { await page.waitForFunction('window.__TEST && window.__TEST.done', {timeout:180000}); } catch(e) { console.log('TIMEOUT'); }
const test = await page.evaluate(() => window.__TEST || {err:window.__TEST_ERR||null, boot:window.__BOOTERR});
console.log('RESULT', test.pass, '/', test.total, 'fail', test.fail);
console.log('FAILED', JSON.stringify((test.results||[]).filter(r=>!r.ok)));
console.log('ERRORS', errors);
console.log('WARNINGS', warnings.slice(0,10));
console.log('EXTERNAL', requests.filter(u=>!u.startsWith('http://127.0.0.1:8620')));
await browser.close();
