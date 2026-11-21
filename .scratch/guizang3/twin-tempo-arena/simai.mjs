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
  for(const d of [1,2,3]){
    G.startMatch('ai',d);
    G.setNoAuto(false);
    const t0=performance.now();
    for(let i=0;i<60*260 && G.state().mode!=='over';i++) G.upd(1);
    const s=G.state();
    out.push({d,mode:s.mode,phase:s.phase,winner:s.winner,p1Wins:s.p1Wins,p2Wins:s.p2Wins,roundsPlayed:s.roundsPlayed,overtime:s.overtime,nan:s.nan,matchTime:+s.matchTime.toFixed(1),ms:Math.round(performance.now()-t0),hp:[+s.p1.hp.toFixed(1),+s.p2.hp.toFixed(1)],prog:[+s.p1.progress.toFixed(1),+s.p2.progress.toFixed(1)],round:s.roundType});
    G.goTitle();
  }
  return out;
});
console.log(JSON.stringify({res,errs},null,2));
await b.close();
