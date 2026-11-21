import { createRequire } from 'module';
const require = createRequire('/tmp/pw/node_modules/');
const { chromium } = require('playwright');
const b = await chromium.launch({headless:true,executablePath:'/usr/local/bin/chromium',args:['--no-sandbox','--use-gl=swiftshader']});
const p = await b.newPage({viewport:{width:1280,height:720}});
await p.goto('http://localhost:8626/ironwright-arena/');
await p.waitForFunction('window.G');
await p.click('#startbtn'); await p.waitForTimeout(400); await p.click('#confirmBtn'); await p.waitForTimeout(600);
console.log(await p.evaluate(()=>{
 const ids=['hud','status','bossbar','tr','mutebtn'];
 const out={}; for(const id of ids){const el=document.getElementById(id); const r=el.getBoundingClientRect(); out[id]={x:r.x,y:r.y,w:r.width,h:r.height,disp:getComputedStyle(el).display,pos:getComputedStyle(el).position,top:getComputedStyle(el).top};}
 return out;
}));
await b.close();
