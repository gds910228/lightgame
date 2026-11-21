import { createRequire } from 'module';
const require = createRequire('/tmp/pw/node_modules/');
const { chromium } = require('playwright');
const OUT='/mnt/tos/workspace/.scratch/guizang3/shadowspire-ninja';
const browser=await chromium.launch({headless:true,executablePath:'/usr/local/bin/chromium',args:['--no-sandbox']});
const ctx=await browser.newContext({viewport:{width:640,height:1138}});
const page=await ctx.newPage();
const errs=[]; page.on('console',m=>{if(['error','warning'].includes(m.type()))errs.push(m.text())}); page.on('pageerror',e=>errs.push(String(e)));
await page.goto('http://localhost:8611/shadowspire-ninja/?autostart=1',{waitUntil:'load'});
await page.waitForTimeout(250);
await page.evaluate(()=>{
  const G=window.G; G.setNoAuto(true); G.startGame();
  G.setBest(420); G.setLives(2); G.setDust(9); G.setChi(64); G.setScore(1884);
  G.setPos(15,900.03); G.upd(2);
});
await page.waitForTimeout(2400);
await page.evaluate(()=>{
  const G=window.G; G.setChi(64); G.setDust(9); G.setScore(1884);
  G.press('KeyD'); G.upd(5); G.release('KeyD'); G.render();
});
await page.waitForTimeout(70);
const info=await page.evaluate(()=>{const s=G.state();const cv=document.getElementById('cv').getBoundingClientRect();const py=cv.top+(960-(s.y-s.cameraY)*18)/960*cv.height;return {s,py};});
const clipY=Math.max(0,Math.min(1138-360,Math.round(info.py-274)));
await page.screenshot({path:OUT+'/thumb-checkpoint.png',clip:{x:0,y:clipY,width:640,height:360}});
await page.screenshot({path:OUT+'/thumb-checkpoint-full.png'});
console.log(JSON.stringify({y:info.s.y,x:info.s.x,checkpoint:info.s.checkpoint,py:info.py,clipY,errs}));
await browser.close();
