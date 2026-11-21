import { createRequire } from 'module';
const require = createRequire('/tmp/pw/node_modules/');
const { chromium } = require('playwright');
import { spawnSync } from 'child_process';
const b = await chromium.launch({executablePath:'/usr/local/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--mute-audio']});
const p = await b.newPage({viewport:{width:1280,height:720}});
await p.goto('http://localhost:8614/frostpuck-arena/?autostart=1&difficulty=2',{waitUntil:'load'});
async function shot(name, fn){
 await p.evaluate(fn);
 await p.waitForTimeout(40);
 const full=`.scratch/guizang3/frostpuck-arena/${name}-full.png`;
 await p.screenshot({path:full});
 spawnSync('convert',[full,'-resize','640x360!','-strip','-quality','90',`.scratch/guizang3/frostpuck-arena/${name}.jpg`]);
}
await p.evaluate(()=>{ const G=window.__G; G.setNoAuto(true); G.startMatch('ai',2); G.startRally(); G.upd(40); });
await shot('thumb-action',()=>{ const G=window.__G; G.setScore(5,3); G.setPaddle('p1',410,446); G.setPaddle('p2',566,146); G.setPuck(410,398,0,0); G.press('KeyW'); G.upd(3); G.release('KeyW'); G.setPuck(470,250,700,-300); G.upd(5); G.step(1); });
await shot('thumb-goal',()=>{ const G=window.__G; G.startMatch('ai',2); G.startRally(); G.setScore(4,2); G.setPaddle('p1',450,430); G.setPaddle('p2',300,130); G.setPuck(450,96,0,-720); G.upd(4); G.upd(18); G.step(1); });
await b.close();
