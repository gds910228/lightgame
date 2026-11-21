import { createRequire } from 'module';
const require = createRequire('/tmp/pw/node_modules/');
const { chromium } = require('playwright');
const b = await chromium.launch({headless:true,executablePath:'/usr/local/bin/chromium',args:['--no-sandbox','--use-gl=swiftshader']});
const p = await b.newPage({viewport:{width:1280,height:720}});
p.on('pageerror',e=>console.log('PAGEERR',String(e)));
await p.goto('http://localhost:8625/emberpin/',{waitUntil:'load'});
await p.waitForTimeout(500);
const probe = await p.evaluate(`(() => {
  const G=window.G; const out={};
  // A: no flipper input at full launch — expect drains and eventually gameOver
  G.startGame(); G.forceLaunch(1);
  let maxY=0, scoreA=0, frames=0, drains=0, prevBalls=G.state().liveBalls;
  for(let i=0;i<7200 && G.state().mode==='play';i++){
    G.step(1); frames++;
    const s=G.state();
    for(const bb of s.balls) maxY=Math.max(maxY,bb.y);
    if(s.liveBalls<prevBalls){drains++;} prevBalls=s.liveBalls;
    if(s.liveBalls===1 && s.balls[0] && s.balls[0].inLane && s.servePending===false) G.forceLaunch(1);
  }
  out.idle={mode:G.state().mode,frames,score:G.state().score,ballsLeft:G.state().ballsLeft,drains,maxY:Math.round(maxY)};
  // B: 60s with flipper taps and relaunch
  G.startGame(); G.forceLaunch(1);
  let flips=0;
  for(let i=0;i<3600 && G.state().mode==='play';i++){
    if(i%17===0){G.press('KeyA');}
    if(i%17===4){G.release('KeyA');}
    if(i%23===0){G.press('KeyD');}
    if(i%23===6){G.release('KeyD');}
    if(i%120===0){const s=G.state(); if(s.balls.some(x=>x.inLane)) G.forceLaunch(0.9);}
    G.step(1); flips++;
  }
  const s=G.state();
  out.play={mode:s.mode,score:s.score,ballsLeft:s.ballsLeft,tasksDone:s.tasksDone,multiplier:s.multiplier,live:s.liveBalls,frames:flips,targetsLit:s.targetsLit,combo:s.combo,progress:s.progress};
  return out;
})()`);
console.log(JSON.stringify(probe,null,2));
await b.close();
