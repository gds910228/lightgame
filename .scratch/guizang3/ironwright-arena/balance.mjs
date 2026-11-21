import { createRequire } from 'module';
const require = createRequire('/tmp/pw/node_modules/');
const { chromium } = require('playwright');
const b = await chromium.launch({headless:true,executablePath:'/usr/local/bin/chromium',args:['--no-sandbox','--use-gl=swiftshader']});
const p = await b.newPage({viewport:{width:1280,height:720}});
p.on('pageerror',e=>console.log('PAGEERR',e));
await p.goto('http://localhost:8626/ironwright-arena/');
await p.waitForFunction('window.G');
const out = await p.evaluate(() => {
  G.setNoAuto(true); G.startRun();
  const rows=[];
  G.confirmLoadout();
  G.press('KeyJ');
  let dir='KeyD';
  for (let bossNo=0; bossNo<3; bossNo++) {
    let frames=0, dead=false;
    while (frames<9000) {
      G.setAimAtBoss();
      if (frames%45===0) {
        G.release('KeyW','KeyA','KeyS','KeyD');
        const dirs=['KeyW','KeyD','KeyS','KeyA'];
        dir=dirs[(frames/45|0)%4];
        G.press(dir);
      }
      if (frames%150===0) G.triggerDash();
      if (frames%70===0) G.triggerBarrier();
      G.upd(1);
      frames++;
      const s=G.state();
      if (s.mode==='gameover'){dead=true;break;}
      if (s.mode==='forge') break;
    }
    const s=G.state();
    rows.push({boss:bossNo+1, sec:+(frames/60).toFixed(1), dead, mode:s.mode, hp:+s.player.hp.toFixed(1), heat:+s.player.heat.toFixed(1), bossHp:+s.boss?.hp.toFixed(1), coins:s.coins});
    if (dead) break;
    if (bossNo<2) { G.confirmLoadout(); }
  }
  G.release('KeyW','KeyA','KeyS','KeyD','KeyJ');
  return rows;
});
console.log(JSON.stringify(out,null,2));
await b.close();
