import { createRequire } from 'module';
const require = createRequire('/tmp/pw/node_modules/');
const { chromium } = require('playwright');
const b = await chromium.launch({headless:true,executablePath:'/usr/local/bin/chromium',args:['--no-sandbox','--use-gl=swiftshader']});
const p = await b.newPage({viewport:{width:1280,height:720}});
const errs=[]; p.on('pageerror',e=>errs.push(String(e))); p.on('console',m=>{if(['error','warning'].includes(m.type()))errs.push(m.type()+':'+m.text())});
await p.goto('http://localhost:8626/ironwright-arena/'); await p.waitForFunction('window.G');
await p.click('#startbtn'); await p.waitForTimeout(300);
// candidate A: heavy cleaver close assault
await p.evaluate(()=>{ G.selectPart('weapon','cleaver'); G.selectPart('armor','heavy'); G.selectPart('thruster','turbo'); });
await p.click('#confirmBtn'); await p.waitForTimeout(500);
await p.keyboard.down('KeyW'); await p.waitForTimeout(700); await p.keyboard.up('KeyW');
await p.evaluate(()=>{G.setAimAtBoss(); G.setBossHp(1450); G.forceBossAttack('radial');});
await p.keyboard.down('KeyJ'); await p.waitForTimeout(750);
await p.screenshot({path:'thumb-A.png'});
await p.keyboard.up('KeyJ');
// candidate B: colossus, aegis/aegis shield heavy with sweep? go through fights
await p.evaluate(()=>{G.forceWin();}); await p.waitForTimeout(200);
await p.evaluate(()=>{G.confirmLoadout(); G.setAimAtBoss(); G.forceBossAttack('sweep');}); // boss2
await p.waitForTimeout(900);
await p.screenshot({path:'thumb-B.png'});
await p.evaluate(()=>{G.forceWin();}); await p.waitForTimeout(200);
await p.evaluate(()=>{G.confirmLoadout(); G.selectPart('weapon','aegis'); G.setAimAtBoss(); G.setBossHp(2600); G.forceBossAttack('nova');});
await p.keyboard.down('KeyJ'); await p.waitForTimeout(900); await p.keyboard.up('KeyJ');
await p.screenshot({path:'thumb-C.png'});
console.log('errors',errs);
await b.close();
