import { createRequire } from 'module';
const require = createRequire('/tmp/pw/node_modules/');
const { chromium } = require('playwright');
const BASE='http://localhost:8623/aqua-conduit/';
const OUT='/mnt/tos/workspace/.scratch/guizang3/aqua-conduit/';
const b=await chromium.launch({executablePath:'/usr/local/bin/chromium',args:['--no-sandbox','--use-gl=swiftshader']});
async function shot(name,url,w,h,wait=3200,type='png') {
 const p=await b.newPage({viewport:{width:w,height:h}});
 const errs=[];p.on('console',m=>{if(['error','warning'].includes(m.type()))errs.push(m.text())});p.on('pageerror',e=>errs.push(String(e)));
 await p.goto(BASE+url,{waitUntil:'load'}); await p.waitForTimeout(wait);
 await p.screenshot({path:OUT+name,type:type==='jpg'?'jpeg':'png',quality:type==='jpg'?93:undefined});
 const st=await p.evaluate('window.G ? ({mode:window.G.state().mode,used:window.G.state().used,left:window.G.state().movesLeft,solved:window.G.state().flowSolved}) : null');
 console.log(name,JSON.stringify(st),JSON.stringify(errs));
 await p.close();
}
await shot('title-final-1280.png','',1280,720,1400);
await shot('level08-valves.png','?autostart=1&level=8&demo=1',1280,720);
await shot('level14-oneway.png','?autostart=1&level=14&demo=1',1280,720);
await shot('level19-full.png','?autostart=1&level=19&demo=1',1280,720);
await shot('level24-full.png','?autostart=1&level=24&demo=1',1280,720);
await shot('gameplay-final-1280.png','?autostart=1&level=14&demo=1',1280,720);
await shot('mobile-portrait2.png','?autostart=1&level=19&demo=0.88',430,820);
await shot('mobile-landscape.png','?autostart=1&level=14&demo=0.9',820,430);
await shot('end-win.png','',1280,720,2000).catch(()=>{});
await b.close();
