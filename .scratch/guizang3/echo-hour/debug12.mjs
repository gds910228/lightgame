import { createRequire } from 'module';
const require = createRequire('/tmp/pw/node_modules/');
const { chromium } = require('playwright');
const b = await chromium.launch({ headless: true, executablePath: '/usr/local/bin/chromium', args: ['--no-sandbox','--use-gl=swiftshader'] });
const p = await b.newPage();
p.on('pageerror', e => console.log('PAGEERR', String(e)));
await p.goto('http://localhost:8627/echo-hour/', { waitUntil: 'load' });
const out = await p.evaluate(() => {
  const G = window.G;
  const n = 12;
  G.startLevel(n);
  G.testMode(true);
  const DT = 1/60;
  const lv = G.levels[n-1];
  const log = [];
  const snap = (label) => {
    const s = G.state();
    log.push({ label, x:+s.player.x.toFixed(1), y:+s.player.y.toFixed(1), lives:s.lives, t:+s.time.toFixed(2), mode:s.mode,
      echo:s.echoFrames, echoPos:s.echoPos, mech:s.mech, keys:s.keys, deaths:s.lives });
  };
  const step = () => G.upd(1);
  const waitFor = (pred, maxT) => { let t=0; while(t<maxT){ if(pred()) return true; step(); t+=DT; if(G.state().mode!=='play') return false; } return pred(); };
  for (const op of lv.solution) {
    snap('before '+JSON.stringify(op));
    if (op.a === 'record') { G.toggleRecord(); }
    else if (op.a === 'move') {
      let t=0; while(t<12){ const dx=op.x-G.state().player.x; if(Math.abs(dx)<=3)break; G.setSimDir(dx>0?1:-1); step(); t+=DT; if(G.state().mode!=='play')break; } G.setSimDir(0);
    } else if (op.a === 'wait') { for(let t=0;t<op.t;t+=DT){step(); if(G.state().mode!=='play')break;} }
    else if (op.a === 'rewind') { G.setSimRewind(true); let t=0; while(t<op.t){step(); t+=DT; if(!G.state().rewinding && t>0.05)break;} G.setSimRewind(false); step(); }
    else if (op.a === 'waitDoor') { waitFor(()=>G.state().mech.doors[op.i].open, 12); }
    else if (op.a === 'waitLaserOff') { waitFor(()=>{const l=G.state().mech.lasers[op.i]; return !l;}, 12); }
    else if (op.a === 'waitCrusherUp') { waitFor(()=>G.state().mech.crushers[op.i] <= lv.crushers[op.i].baseY+30, 12); }
    else if (op.a === 'waitConveyorFwd') { waitFor(()=>G.state().mech.conveyors[op.i] > 0, 12); }
    else if (op.a === 'waitMoverUp') { waitFor(()=>G.state().mech.movers[op.i] <= lv.movers[op.i].baseY+30, 12); }
    snap('after  '+JSON.stringify(op));
    if (G.state().mode !== 'play') break;
  }
  snap('final');
  return log;
});
for (const row of out) console.log(row.label, '| x', row.x, 'y', row.y, 'lives', row.lives, 't', row.t, 'mode', row.mode, 'echo', row.echo, 'keys', row.keys, 'lasers', row.mech.lasers, 'crushers', row.mech.crushers, 'doors', row.mech.doors.map(d=>d.open), 'movers', row.mech.movers, 'conv', row.mech.conveyors);
await b.close();
