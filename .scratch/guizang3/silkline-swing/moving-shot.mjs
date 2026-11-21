import { createRequire } from 'module';
const require = createRequire('/tmp/pw/node_modules/');
const { chromium } = require('playwright');
const b = await chromium.launch({ headless: true, executablePath: '/usr/local/bin/chromium', args: ['--no-sandbox','--use-gl=swiftshader'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const logs=[]; p.on('console',m=>{if(m.type()==='error'||m.type()==='warning')logs.push(m.type()+': '+m.text())}); p.on('pageerror',e=>logs.push('ERR '+e));
await p.goto('http://localhost:8621/silkline-swing/?level=9', { waitUntil:'load' });
const setup = await p.evaluate(() => {
  localStorage.clear();
  G.testMode(true);
  G.startLevel(9);
  let idx=-1;
  for (let i=0;i<G.anchorCount();i++) if (G.anchorInfo(i).type==='moving') { idx=i; break; }
  const base = G.levels[8].anchors[idx];
  G.setPlayer(base.x, base.y+120);
  G.attachTo(idx);
  G.setGrab(true); G.setDir(1);
  G.upd(80);
  G.setGrab(false);
  G.pauseNow(true);
  return { idx, base:{x:base.x,y:base.y}, live:G.anchorInfo(idx), player:G.state().player, camX: G.state() };
});
await p.waitForTimeout(120);
await p.evaluate(() => { G.pauseNow(false); G.testMode(true); });
// one render happened via RAF; freeze without dim
await p.evaluate(() => { G.pauseNow(false); });
await p.waitForTimeout(120);
await p.screenshot({ path:'/mnt/tos/workspace/.scratch/guizang3/silkline-swing/moving-anchor.png' });
console.log(JSON.stringify({setup, logs}, null, 2));
await b.close();
