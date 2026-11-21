import { createRequire } from 'module';
const require = createRequire('/tmp/pw/node_modules/');
const { chromium } = require('playwright');
const B='http://localhost:8624/glyphbeast-trail/';
const O='/mnt/tos/workspace/.scratch/guizang3/glyphbeast-trail/';
const b=await chromium.launch({headless:true,executablePath:'/usr/local/bin/chromium',args:['--no-sandbox','--use-gl=swiftshader']});
const p=await b.newPage({viewport:{width:1280,height:720}});
const errs=[]; p.on('console',m=>{if(['error','warning'].includes(m.type()))errs.push(m.type()+': '+m.text())}); p.on('pageerror',e=>errs.push('pageerror '+e));
await p.goto(B+'?autostart=1');
await p.waitForTimeout(700);
await p.screenshot({path:O+'explore-start.png'});
await p.evaluate(()=>{ G.setPlayerPos(660,860); G.step(2); });
await p.waitForTimeout(300);
await p.screenshot({path:O+'explore-grass.png'});
// enter camp and shop
await p.evaluate(()=>{ G.setPlayerPos(430,690); G.step(2); });
await p.keyboard.press('KeyE');
await p.waitForTimeout(300);
await p.screenshot({path:O+'shop.png'});
await p.evaluate(()=>G.closeShop());
// battle scene query
const p2=await b.newPage({viewport:{width:1280,height:720}});
p2.on('console',m=>{if(['error','warning'].includes(m.type()))errs.push('b '+m.type()+': '+m.text())}); p2.on('pageerror',e=>errs.push('pageerror '+e));
await p2.goto(B+'?scene=battle');
await p2.waitForTimeout(900);
await p2.screenshot({path:O+'battle-scene.png'});
await p2.evaluate(()=>{ G.useSkill(0); G.upd(30); });
await p2.waitForTimeout(300);
await p2.screenshot({path:O+'battle-action.png'});
// battle submenu
await p2.evaluate(()=>{ G.upd(300); });
await p2.evaluate(()=>{ const g=G.state(); if(g.battle&&g.battle.phase==='menu') G.chooseMain(0); });
await p2.waitForTimeout(200);
await p2.screenshot({path:O+'battle-skills.png'});
// boss battle
await p2.evaluate(()=>{ G.clearBattle(); G.setBosses(0); G.setParty([{id:'emberbadger',lvl:9},{id:'tideotter',lvl:8}]); G.startBoss(0); G.upd(80); G.step(1); });
await p2.waitForTimeout(300);
await p2.screenshot({path:O+'battle-boss.png'});
// codex
await p2.evaluate(()=>{ G.clearBattle(); G.setPlayerPos(330,760); G.toggleCodex(); G.step(1); });
await p2.waitForTimeout(200);
await p2.screenshot({path:O+'codex.png'});
console.log('errors',errs);
await b.close();
