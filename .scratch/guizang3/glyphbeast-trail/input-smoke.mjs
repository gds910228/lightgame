import { createRequire } from 'module';
const require = createRequire('/tmp/pw/node_modules/');
const { chromium } = require('playwright');
const B='http://localhost:8624/glyphbeast-trail/';
const O='/mnt/tos/workspace/.scratch/guizang3/glyphbeast-trail/';
const b=await chromium.launch({headless:true,executablePath:'/usr/local/bin/chromium',args:['--no-sandbox','--use-gl=swiftshader']});
const p=await b.newPage({viewport:{width:1280,height:720}});
const errs=[], reqs=[];
p.on('console',m=>{ if(['error','warning'].includes(m.type())) errs.push(m.type()+': '+m.text()); });
p.on('pageerror',e=>errs.push('pageerror: '+e)); p.on('request',r=>reqs.push(r.url()));
await p.goto(B);
await p.waitForTimeout(400);
// real click title start at logical coords (scale 1 at 1280x720)
const sr=await p.evaluate(()=>G.uiRects().find(r=>r.id==='start'));
const sp=await p.evaluate(([x,y])=>G.screenPoint(x,y),[sr.x+sr.w/2,sr.y+sr.h/2]);
await p.mouse.click(sp.x, sp.y);
await p.waitForTimeout(500);
const started=await p.evaluate(()=>({mode:G.state().mode,party:G.state().party.length}));
// real arrow movement
const x0=await p.evaluate(()=>G.state().player.x);
await p.keyboard.down('ArrowRight'); await p.waitForTimeout(600); await p.keyboard.up('ArrowRight');
const x1=await p.evaluate(()=>G.state().player.x);
// walk into grass to trigger encounter, using teleport + real key movement
await p.evaluate(()=>G.setPlayerPos(600,850));
let battle=false;
for(let i=0;i<12 && !battle;i++){ await p.keyboard.down('ArrowRight'); await p.waitForTimeout(450); await p.keyboard.up('ArrowRight'); battle=await p.evaluate(()=>G.state().mode==='battle'); }
if(!battle){ await p.evaluate(()=>G.startWild('tideotter',5)); }
await p.waitForTimeout(300);
// real key 1 -> skills, 1 -> attack
await p.keyboard.press('Digit1'); await p.waitForTimeout(150);
const ph1=await p.evaluate(()=>G.state().battle.phase);
await p.keyboard.press('Digit1'); await p.waitForTimeout(300);
const ph2=await p.evaluate(()=>G.state().battle?G.state().battle.phase:'-');
await p.evaluate(()=>G.upd(300));
// pointer click on skill menu main after resolution
await p.evaluate(()=>{ if(G.state().battle&&G.state().battle.phase!=='menu') G.upd(300); });
let r=await p.evaluate(()=>G.uiRects().find(x=>x.id==='battle-main-0'));
if(r){ const q=await p.evaluate(([x,y])=>G.screenPoint(x,y),[r.x+r.w/2,r.y+r.h/2]); await p.mouse.click(q.x,q.y); await p.waitForTimeout(150); }
const afterClick=await p.evaluate(()=>G.state().battle?G.state().battle.phase:'-');
// pause with P
await p.keyboard.press('KeyP'); await p.waitForTimeout(150);
const paused=await p.evaluate(()=>G.state().paused);
await p.keyboard.press('KeyP'); await p.waitForTimeout(150);
const unpaused=await p.evaluate(()=>G.state().paused);
// mute and codex buttons real clicks
await p.click('#btn-mute'); await p.waitForTimeout(100);
const muted=await p.evaluate(()=>G.state().muted);
await p.click('#btn-mute'); await p.waitForTimeout(100);
// codex via button while in battle should toast, then exit to explore and open
await p.evaluate(()=>{ G.clearBattle(); G.setPlayerPos(330,760); G.upd(1); });
await p.click('#btn-codex'); await p.waitForTimeout(200);
const codex=await p.evaluate(()=>G.state().codexOpen);
await p.keyboard.press('KeyC'); await p.waitForTimeout(150);
const codex2=await p.evaluate(()=>G.state().codexOpen);
// shop via real interaction
await p.evaluate(()=>{ G.setPlayerPos(415,690); G.upd(1); });
await p.keyboard.press('KeyE'); await p.waitForTimeout(250);
const shopOpen=await p.evaluate(()=>G.state().mode);
const gold0=await p.evaluate(()=>G.state().gold);
await p.keyboard.press('Digit1'); await p.waitForTimeout(150);
const gold1=await p.evaluate(()=>G.state().gold);
await p.keyboard.press('Escape'); await p.waitForTimeout(150);
// screenshot
await p.screenshot({path:O+'desktop-input.png'});
console.log(JSON.stringify({started,move:{x0,x1},ph1,ph2,afterClick,paused,unpaused,muted,codex,codex2,shopOpen,gold0,gold1,errs,external:reqs.filter(u=>!u.includes('localhost'))},null,2));
await b.close();
