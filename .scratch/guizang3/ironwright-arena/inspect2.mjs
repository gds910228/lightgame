import { createRequire } from 'module';
const require = createRequire('/tmp/pw/node_modules/');
const { chromium } = require('playwright');
const b = await chromium.launch({headless:true,executablePath:'/usr/local/bin/chromium',args:['--no-sandbox','--use-gl=swiftshader']});
const p = await b.newPage({viewport:{width:1280,height:720}});
p.on('pageerror',e=>console.log('PAGEERR',e));
p.on('console',m=>{if(['error','warning'].includes(m.type()))console.log('CONSOLE',m.type(),m.text())});
await p.goto('http://localhost:8626/ironwright-arena/');
await p.waitForFunction('window.G');
await p.evaluate(()=>document.getElementById('title').classList.add('hide'));
await p.evaluate(()=>{ G.renderer.drawTitleScene(5); });
await p.waitForTimeout(100);
await p.screenshot({path:'title-scene-manual.png'});
console.log(await p.evaluate(()=>{
 const c=document.getElementById('gl'); const ctx=c.getContext('2d');
 const d=ctx.getImageData(0,0,c.width,c.height).data;
 let sum=0, n=0, max=0; for(let i=0;i<d.length;i+=4){ const v=d[i]+d[i+1]+d[i+2]; sum+=v; if(v>max)max=v; if(v>30)n++; }
 return {w:c.width,h:c.height,avg:sum/(d.length/4), max, bright:n};
}));
await b.close();
