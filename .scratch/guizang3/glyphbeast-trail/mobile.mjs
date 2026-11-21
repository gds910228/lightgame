import { createRequire } from 'module';
const require = createRequire('/tmp/pw/node_modules/');
const { chromium } = require('playwright');
const B='http://localhost:8624/glyphbeast-trail/';
const O='/mnt/tos/workspace/.scratch/guizang3/glyphbeast-trail/';
const b=await chromium.launch({headless:true,executablePath:'/usr/local/bin/chromium',args:['--no-sandbox','--use-gl=swiftshader']});
for (const cfg of [{w:844,h:390,name:'land'},{w:430,h:820,name:'port'}]) {
  const p=await b.newPage({viewport:{width:cfg.w,height:cfg.h},isMobile:true,hasTouch:true});
  const errs=[]; p.on('console',m=>{if(['error','warning'].includes(m.type()))errs.push(m.type()+': '+m.text())}); p.on('pageerror',e=>errs.push('pageerror '+e));
  await p.goto(B);
  await p.waitForTimeout(500);
  await p.screenshot({path:O+'mobile-title-'+cfg.name+'.png'});
  const sr=await p.evaluate(()=>G.uiRects().find(r=>r.id==='start'));
  const sp=await p.evaluate(([x,y])=>G.screenPoint(x,y),[sr.x+sr.w/2,sr.y+sr.h/2]);
  await p.touchscreen.tap(sp.x, sp.y);
  await p.waitForTimeout(600);
  const started=await p.evaluate(()=>({mode:G.state().mode,touch:window.matchMedia('(pointer: coarse)').matches, rects:G.uiRects().map(r=>r.id)}));
  // tap world to move
  const wpt=await p.evaluate(()=>G.screenPoint(640,360));
  await p.touchscreen.tap(wpt.x,wpt.y);
  await p.waitForTimeout(500);
  const moved=await p.evaluate(()=>({x:G.state().player.x,y:G.state().player.y}));
  // force battle, tap a command
  await p.evaluate(()=>{ G.startWild('tideotter',5); G.upd(70); });
  const r=await p.evaluate(()=>G.uiRects().find(x=>x.id==='battle-main-0'));
  const q=await p.evaluate(([x,y])=>G.screenPoint(x,y),[r.x+r.w/2,r.y+r.h/2]);
  await p.touchscreen.tap(q.x,q.y);
  await p.waitForTimeout(300);
  const phase=await p.evaluate(()=>G.state().battle?G.state().battle.phase:'-');
  await p.screenshot({path:O+'mobile-battle-'+cfg.name+'.png'});
  console.log(cfg.name, JSON.stringify({started,moved,phase,errs}));
  await p.close();
}
await b.close();
