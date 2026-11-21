import { createRequire } from 'module';
const require = createRequire('/tmp/pw/node_modules/');
const { chromium } = require('playwright');
const b = await chromium.launch({headless:true,executablePath:'/usr/local/bin/chromium',args:['--no-sandbox','--use-gl=swiftshader']});
async function run(scenario){
  const p = await b.newPage({viewport:{width:1280,height:720}});
  p.on('pageerror',e=>console.log('PAGEERR',scenario,e));
  await p.goto('http://localhost:8626/ironwright-arena/'); await p.waitForFunction('window.G');
  const out = await p.evaluate((scenario) => {
    G.setNoAuto(true); G.startRun();
    if (scenario==='heavy') G.selectPart('armor','heavy');
    if (scenario==='cryo') G.selectPart('armor','cryo');
    G.confirmLoadout(); G.press('KeyJ');
    const rows=[]; let dir='KeyD';
    for (let bossNo=0; bossNo<3; bossNo++) {
      let frames=0, dead=false;
      if (bossNo>0) { G.repair(); if (scenario==='heavy') G.selectPart('armor','heavy'); G.confirmLoadout(); G.press('KeyJ'); }
      while (frames<12000) {
        G.setAimAtBoss();
        if (frames%60===0) {
          G.release('KeyW','KeyA','KeyS','KeyD');
          const dirs=['KeyW','KeyD','KeyS','KeyA'];
          dir=dirs[(frames/60|0)%4]; G.press(dir);
        }
        if (frames%120===0) G.triggerDash();
        if (frames%55===0) G.triggerBarrier();
        G.upd(1); frames++;
        const s=G.state();
        if (s.mode==='gameover'){dead=true;break;}
        if (s.mode==='forge'||s.mode==='complete') break;
      }
      const s=G.state();
      rows.push({boss:bossNo+1, sec:+(frames/60).toFixed(1), dead, mode:s.mode, hp:+s.player.hp.toFixed(1), armor:s.stats.armor, bossHp:s.boss?+s.boss.hp.toFixed(1):null});
      if (dead) break;
    }
    G.release('KeyW','KeyA','KeyS','KeyD','KeyJ');
    return rows;
  }, scenario);
  await p.close();
  return out;
}
for (const sc of ['default','heavy','cryo']) console.log(sc, JSON.stringify(await run(sc)));
await b.close();
