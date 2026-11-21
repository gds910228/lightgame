import { createRequire } from 'module';
const require = createRequire('/tmp/pw/node_modules/');
const { chromium } = require('playwright');
const b = await chromium.launch({executablePath:'/usr/local/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--mute-audio']});
const p = await b.newPage({viewport:{width:1280,height:720}});
p.on('console',m=>console.log('CON',m.type(),m.text()));
await p.goto('http://localhost:8614/frostpuck-arena/',{waitUntil:'load'});
const out = await p.evaluate(()=>{
 const G=window.__G; const log=[];
 G.setNoAuto(true);
 G.startMatch('ai',1); G.startRally();
 G.setPaddle('p2',750,120); G.setPaddle('p1',450,390); G.setPuck(450,365,0,0);
 // stationary overlap
 for(let i=0;i<4;i++){ G.upd(1); log.push({i,phase:G.state().phase,puck:{...G.state().puck},p1:{...G.state().p1}}); }
 // moving paddle
 G.startMatch('ai',1); G.startRally();
 G.setPaddle('p2',750,120); G.setPaddle('p1',450,430); G.setPuck(450,365,0,0);
 G.press('KeyW');
 for(let i=0;i<10;i++){ G.upd(1); if(i<4) log.push({m:i,puck:{...G.state().puck},p1:{...G.state().p1}}); }
 G.release('KeyW');
 // full match
 G.startMatch('ai',3); G.startRally(); G.setScore(0,0);
 for(let i=0;i<7;i++){
   G.startRally(); G.setPaddle('p1',750,440); G.setPaddle('p2',300,130); G.setPuck(450,78+14+4,0,-720); G.upd(4);
   log.push({goalIter:i,phase:G.state().phase,score:G.state().scores,puck:{...G.state().puck},auto:G.state().noAuto});
 }
 G.setNoAuto(false); G.upd(120); G.setNoAuto(true);
 log.push({afterAll:G.state()});
 // mute test in mode state
 const m0=G.state().muted;
 G.press('KeyM'); G.upd(1); G.release('KeyM');
 const m1=G.state().muted;
 G.press('KeyM'); G.upd(1); G.release('KeyM');
 const m2=G.state().muted;
 log.push({m0,m1,m2, mode:G.state().mode, phase:G.state().phase});
 return log;
});
console.log(JSON.stringify(out,null,2));
await b.close();
