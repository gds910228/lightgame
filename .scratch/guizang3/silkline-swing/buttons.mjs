import { createRequire } from 'module';
const require = createRequire('/tmp/pw/node_modules/');
const { chromium } = require('playwright');
const b = await chromium.launch({ headless: true, executablePath: '/usr/local/bin/chromium', args: ['--no-sandbox','--use-gl=swiftshader'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const logs=[]; p.on('console',m=>{if(m.type()==='error'||m.type()==='warning')logs.push(m.type()+': '+m.text())}); p.on('pageerror',e=>logs.push('ERR '+e));
await p.goto('http://localhost:8621/silkline-swing/?level=1', { waitUntil:'load' });
await p.evaluate(()=>localStorage.clear());
// win -> next
await p.evaluate('G.setShards(3);G.setTime(15);G.forceWin()');
await p.waitForTimeout(100);
await p.click('#end-next');
await p.waitForTimeout(150);
const nextState = await p.evaluate('G.state()');
// fail -> retry
await p.evaluate('G.startLevel(1);G.forceFail("abyss")');
await p.waitForTimeout(100);
await p.click('#end-retry');
await p.waitForTimeout(150);
const retryState = await p.evaluate('G.state()');
// home
await p.click('#restartbtn'); // ensure play then home via fail
await p.evaluate('G.forceFail("abyss")');
await p.waitForTimeout(80);
await p.click('#end-home');
await p.waitForTimeout(120);
const homeState = await p.evaluate('G.state()');
await p.evaluate(()=>localStorage.clear());
console.log(JSON.stringify({next:{mode:nextState.mode, level:nextState.level}, retry:{mode:retryState.mode, level:retryState.level, lives:retryState.lives, shards:retryState.shards}, home:{mode:homeState.mode, title: !(await p.evaluate("document.getElementById('title').classList.contains('hidden')"))}, logs}, null, 2));
await b.close();
