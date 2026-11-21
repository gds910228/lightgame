import { createRequire } from 'module';
const require = createRequire('/tmp/pw/node_modules/');
const { chromium } = require('playwright');
const b = await chromium.launch({ executablePath: '/usr/local/bin/chromium', args: ['--no-sandbox','--use-gl=swiftshader'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
p.on('console', m => logs.push({type:m.type(), text:m.text()}));
p.on('pageerror', e => logs.push({type:'pageerror', text:String(e)}));
await p.goto('http://localhost:8622/lexicon-bastion/?autotest=1', { waitUntil: 'load' });
try {
  await p.waitForFunction('window.__TEST && window.__TEST.done', { timeout: 120000 });
} catch (e) {
  console.log('WAIT_FAIL', String(e));
}
const t = await p.evaluate('window.__TEST || null');
const st = await p.evaluate('window.__G ? window.__G.state() : null');
console.log(JSON.stringify({ t, st, logs }, null, 2));
await b.close();
