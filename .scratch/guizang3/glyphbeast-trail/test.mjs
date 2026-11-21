import { createRequire } from 'module';
const require = createRequire('/tmp/pw/node_modules/');
const { chromium } = require('playwright');
const BASE='http://localhost:8624/glyphbeast-trail/';
const OUT='/mnt/tos/workspace/.scratch/guizang3/glyphbeast-trail/';
const browser=await chromium.launch({headless:true,executablePath:'/usr/local/bin/chromium',args:['--no-sandbox','--use-gl=swiftshader']});
const rounds=[];
for(let round=1;round<=2;round++){
  const page=await browser.newPage({viewport:{width:1280,height:720}});
  const errors=[],warnings=[],reqs=[];
  page.on('console',m=>{ if(m.type()==='error') errors.push(m.text()); if(m.type()==='warning') warnings.push(m.text()); });
  page.on('pageerror',e=>errors.push('pageerror:'+String(e)));
  page.on('request',r=>reqs.push(r.url()));
  await page.goto(BASE+'?autotest=1',{waitUntil:'load'});
  await page.waitForFunction('window.__TEST && window.__TEST.done',{timeout:180000});
  const t=await page.evaluate(()=>window.__TEST);
  const st=await page.evaluate(()=>window.G.state());
  const external=reqs.filter(u=>!u.startsWith('http://localhost:8624')&&!u.startsWith('data:')&&!u.startsWith('blob:'));
  await page.screenshot({path:OUT+`autotest-round${round}.png`});
  rounds.push({round,pass:t.pass,fail:t.fail,total:t.total,crash:t.crash||null,failed:(t.results||[]).filter(r=>!r.ok),errors,warnings,external,finalMode:st.mode,muted:st.muted,nan:st.nan});
  await page.close();
}
// clean title screenshot
const titlePage=await browser.newPage({viewport:{width:1280,height:720}});
const titleErr=[];
titlePage.on('console',m=>{if(['error','warning'].includes(m.type()))titleErr.push(m.type()+': '+m.text())});
titlePage.on('pageerror',e=>titleErr.push('pageerror:'+String(e)));
await titlePage.goto(BASE,{waitUntil:'load'});
await titlePage.waitForTimeout(900);
await titlePage.screenshot({path:OUT+'title-1280x720.png'});
await titlePage.close();
// gameplay screenshots at 640x360
const play=await browser.newPage({viewport:{width:640,height:360}});
const playErr=[];
play.on('console',m=>{if(['error','warning'].includes(m.type()))playErr.push(m.type()+': '+m.text())});
play.on('pageerror',e=>playErr.push('pageerror:'+String(e)));
await play.goto(BASE+'?autostart=1',{waitUntil:'load'});
await play.waitForTimeout(500);
await play.screenshot({path:OUT+'gameplay-explore-640x360.png'});
await play.evaluate(()=>{G.setPlayerPos(600,850);G.step(2);});
await play.waitForTimeout(300);
await play.screenshot({path:OUT+'gameplay-grass-640x360.png'});
await play.close();
// battle thumbnail source at 1280x720 (then downscaled)
const thumb=await browser.newPage({viewport:{width:1280,height:720}});
const thumbErr=[];
thumb.on('console',m=>{if(['error','warning'].includes(m.type()))thumbErr.push(m.type()+': '+m.text())});
thumb.on('pageerror',e=>thumbErr.push('pageerror:'+String(e)));
await thumb.goto(BASE+'?scene=battle',{waitUntil:'load'});
await thumb.waitForTimeout(700);
await thumb.screenshot({path:OUT+'thumb-source-1280.png'});
await thumb.evaluate(()=>{G.useSkill(0);G.upd(20);G.step(1);});
await thumb.waitForTimeout(200);
await thumb.screenshot({path:OUT+'thumb-action-1280.png'});
await thumb.close();
console.log(JSON.stringify({rounds,titleErr,playErr,thumbErr},null,2));
await browser.close();
