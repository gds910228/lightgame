import { createRequire } from 'module';
const require = createRequire('/tmp/pw/node_modules/');
const { chromium } = require('playwright');
const OUT='/mnt/tos/workspace/.scratch/guizang3/lexicon-bastion/';
const BASE='http://localhost:8622/lexicon-bastion/';
const b = await chromium.launch({ executablePath: '/usr/local/bin/chromium', args: ['--no-sandbox','--use-gl=swiftshader'] });
const errs=[];
// title 1280x720
let p = await b.newPage({ viewport:{width:1280,height:720} });
p.on('console',m=>{if(['error','warning'].includes(m.type()))errs.push(m.type()+': '+m.text())});
p.on('pageerror',e=>errs.push('pageerror: '+e));
await p.goto(BASE,{waitUntil:'load'});
await p.waitForTimeout(900);
await p.screenshot({path:OUT+'title-1280.png'});
await p.close();
// gameplay 640x360
p = await b.newPage({ viewport:{width:640,height:360}, deviceScaleFactor:2 });
p.on('console',m=>{if(['error','warning'].includes(m.type()))errs.push(m.type()+': '+m.text())});
p.on('pageerror',e=>errs.push('pageerror: '+e));
await p.goto(BASE+'?autostart=1&demo=1',{waitUntil:'load'});
await p.waitForTimeout(700);
await p.screenshot({path:OUT+'play-640.png'});
await p.close();
// portrait mobile
p = await b.newPage({ viewport:{width:430,height:820}, isMobile:true, hasTouch:true });
p.on('console',m=>{if(['error','warning'].includes(m.type()))errs.push(m.type()+': '+m.text())});
p.on('pageerror',e=>errs.push('pageerror: '+e));
await p.goto(BASE,{waitUntil:'load'});
await p.waitForTimeout(700);
await p.screenshot({path:OUT+'mobile-title.png'});
await p.tap('#startbtn');
await p.waitForTimeout(800);
await p.screenshot({path:OUT+'mobile-play.png'});
await p.close();
console.log('ERRORS', JSON.stringify(errs));
await b.close();
