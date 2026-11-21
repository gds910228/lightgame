import { createRequire } from 'module';
const require = createRequire('/tmp/pw/node_modules/');
const { chromium } = require('playwright');
const b = await chromium.launch({ headless: true, executablePath: '/usr/local/bin/chromium', args: ['--no-sandbox','--use-gl=swiftshader'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs=[]; p.on('pageerror',e=>errs.push(String(e))); p.on('console',m=>{if(m.type()==='error'||m.type()==='warning')errs.push(m.text())});
await p.goto('http://127.0.0.1:8629/twin-tempo-arena/');
await p.waitForFunction('window.G && window.G.state');
const res = await p.evaluate(() => {
  const G=window.G; const out=[];
  for(const d of [1,2,3]) for(let rep=0;rep<2;rep++){
    G.startMatch('ai',d); G.setNoAuto(false);
    let heldDir=0, frames=0;
    for(let i=0;i<60*240 && G.state().mode!=='over';i++){
      const s=G.state();
      if(s.phase==='live'){
        frames++;
        const dx=s.p2.x-s.p1.x;
        const want=Math.abs(dx)>50?Math.sign(dx):0;
        if(want!==heldDir){ if(heldDir>0)G.release('KeyD'); if(heldDir<0)G.release('KeyA'); if(want>0)G.press('KeyD'); if(want<0)G.press('KeyA'); heldDir=want; }
        if(frames%22===0) G.press('KeyF');
        if(frames%53===0) G.press('KeyG');
      }
      G.upd(1);
    }
    if(heldDir>0)G.release('KeyD'); if(heldDir<0)G.release('KeyA');
    const s=G.state();
    out.push({d,rep,mode:s.mode,winner:s.winner,p1Wins:s.p1Wins,p2Wins:s.p2Wins,roundsPlayed:s.roundsPlayed,overtime:s.overtime,nan:s.nan,matchTime:+s.matchTime.toFixed(1),hp:[+s.p1.hp.toFixed(1),+s.p2.hp.toFixed(1)],round:s.roundType});
    G.goTitle();
  }
  return out;
});
console.log(JSON.stringify({res,errs},null,2));
await b.close();
