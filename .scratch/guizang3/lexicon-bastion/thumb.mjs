import { createRequire } from 'module';
const require = createRequire('/tmp/pw/node_modules/');
const { chromium } = require('playwright');
const OUT='/mnt/tos/workspace/.scratch/guizang3/lexicon-bastion/';
const BASE='http://localhost:8622/lexicon-bastion/';
const b = await chromium.launch({ executablePath: '/usr/local/bin/chromium', args: ['--no-sandbox','--use-gl=swiftshader'] });
const p = await b.newPage({ viewport:{width:640,height:360}, deviceScaleFactor:2 });
const errs=[]; p.on('console',m=>{if(['error','warning'].includes(m.type()))errs.push(m.text())}); p.on('pageerror',e=>errs.push(String(e)));
await p.goto(BASE+'?autostart=1&demo=1',{waitUntil:'load'});
await p.waitForTimeout(500);
await p.screenshot({ path: OUT+'thumb-2x.png' });
// draft overlay
await p.evaluate('window.G.fresh(3); window.G.setInk(120); window.G.clearWaveNow();');
await p.waitForTimeout(250);
await p.screenshot({ path: OUT+'draft.png' });
// milestone overlay
await p.evaluate('window.G.fresh(10); window.G.setScore(12640); window.G.setInk(210); window.G.setStats({correct:420,misses:18,activeT:180,maxCombo:37,kills:64}); window.G.forceMilestone();');
await p.waitForTimeout(250);
await p.screenshot({ path: OUT+'milestone.png' });
console.log('ERRORS', JSON.stringify(errs));
await b.close();
