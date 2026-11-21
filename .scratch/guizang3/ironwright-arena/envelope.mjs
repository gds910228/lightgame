import { createRequire } from 'module';
const require = createRequire('/tmp/pw/node_modules/');
const { chromium } = require('playwright');
const b = await chromium.launch({headless:true,executablePath:'/usr/local/bin/chromium',args:['--no-sandbox','--use-gl=swiftshader']});
const p = await b.newPage({viewport:{width:1200,height:800}});
const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.setContent(`<!doctype html><html><body><script>
window.__msgs=[];
addEventListener('message',e=>{ if(e.data && e.data.source==='lightgame') window.__msgs.push(e.data); });
</script><iframe src="http://localhost:8626/ironwright-arena/" style="width:1100px;height:700px"></iframe></body></html>`);
await p.waitForTimeout(1500);
const frame = p.frames().find(f=>f.url().includes('ironwright-arena'));
await frame.waitForFunction('window.G');
await frame.evaluate(()=>{ G.setNoAuto(true); G.startRun(); G.confirmLoadout(); G.forceWin(); });
await p.waitForTimeout(300);
const afterBoss = await p.evaluate(()=>window.__msgs.slice());
// failure envelope on a fresh run
await frame.evaluate(()=>{ G.startRun(); G.confirmLoadout(); G.forceFail(); });
await p.waitForTimeout(300);
const afterFail = await p.evaluate(()=>window.__msgs.slice());
// complete envelope
await frame.evaluate(()=>{ G.setNoAuto(true); G.startRun(); G.confirmLoadout(); G.forceWin(); G.confirmLoadout(); G.forceWin(); G.confirmLoadout(); G.forceWin(); });
await p.waitForTimeout(300);
const all = await p.evaluate(()=>window.__msgs.slice());
const pick = (arr,type)=>arr.filter(m=>m.type==='lightgame:report'&&m.payload&&m.payload.kind===type);
console.log(JSON.stringify({
 ready:all.filter(m=>m.type==='lightgame:ready'),
 progress:pick(afterBoss,'progress')[0],
 event:pick(afterBoss,'event')[0],
 gameOver:pick(afterFail,'gameOver')[0],
 complete:pick(all,'complete')[0],
 counts:all.reduce((o,m)=>{const k=m.type+':'+(m.payload&&m.payload.kind||'');o[k]=(o[k]||0)+1;return o;},{}),
 errors:errs
},null,2));
await b.close();
