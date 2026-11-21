import { createRequire } from 'module';
const require = createRequire('/tmp/pw/node_modules/');
const { chromium } = require('playwright');
const b = await chromium.launch({executablePath:'/usr/local/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--mute-audio']});
const p = await b.newPage({viewport:{width:1280,height:720}});
const errs=[]; p.on('console',m=>{if(['error','warning'].includes(m.type()))errs.push(m.text())}); p.on('pageerror',e=>errs.push(String(e)));
await p.goto('http://localhost:8614/frostpuck-arena/',{waitUntil:'load'});
const state = await p.evaluate(()=>{
 const G=window.__G;
 G.setNoAuto(true); G.startMatch('ai',2); G.startRally();
 G.setScore(3,2); G.setPaddle('p1',450,430); G.setPaddle('p2',300,130);
 G.setPuck(450,96,0,-720); G.upd(4); G.upd(18); G.step(1);
 return G.state();
});
await p.waitForTimeout(70);
await p.screenshot({path:'.scratch/guizang3/frostpuck-arena/goal.png'});
console.log(JSON.stringify({phase:state.phase,scores:state.scores,particles:state.particles,errs}));
await b.close();
