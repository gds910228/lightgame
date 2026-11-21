import { createRequire } from 'module';
const require = createRequire('/tmp/pw/node_modules/');
const { chromium } = require('playwright');
const b = await chromium.launch({ headless: true, executablePath: '/usr/local/bin/chromium', args: ['--no-sandbox','--use-gl=swiftshader'] });
const p = await b.newPage({ viewport: { width: 1024, height: 768 } });
const logs=[], reqs=[];
p.on('console', m => { if (m.type()==='error'||m.type()==='warning') logs.push(m.type()+': '+m.text()); });
p.on('pageerror', e => logs.push('PAGEERROR '+String(e)));
p.on('request', r => reqs.push(r.url()));
await p.goto('http://localhost:8621/silkline-swing/', { waitUntil: 'load' });
await p.waitForTimeout(300);
await p.click('#startbtn');
await p.waitForTimeout(200);
const s0 = await p.evaluate('G.state()');
// keyboard hold grab
await p.keyboard.down('Space');
await p.waitForTimeout(450);
const s1 = await p.evaluate('G.state()');
// pump right
await p.keyboard.down('KeyD');
await p.waitForTimeout(500);
const s2 = await p.evaluate('G.state()');
await p.keyboard.up('KeyD');
// reel in
await p.keyboard.down('KeyW');
await p.waitForTimeout(300);
const s3 = await p.evaluate('G.state()');
await p.keyboard.up('KeyW');
// release
await p.keyboard.up('Space');
await p.waitForTimeout(120);
const s4 = await p.evaluate('G.state()');
// pause freeze
await p.keyboard.press('KeyP');
await p.waitForTimeout(60);
const sp0 = await p.evaluate('G.state()');
await p.waitForTimeout(400);
const sp1 = await p.evaluate('G.state()');
await p.keyboard.press('KeyP');
// restart
await p.keyboard.press('KeyR');
await p.waitForTimeout(100);
const sr = await p.evaluate('G.state()');
// mute
await p.keyboard.press('KeyM');
const sm = await p.evaluate('G.state()');
// mouse grab
await p.mouse.move(620, 380);
await p.mouse.down();
await p.waitForTimeout(350);
const mm = await p.evaluate('G.state()');
await p.mouse.up();
await p.waitForTimeout(80);
const mm2 = await p.evaluate('G.state()');
await p.screenshot({ path: '/mnt/tos/workspace/.scratch/guizang3/silkline-swing/input-shot.png' });
console.log(JSON.stringify({
  start:{mode:s0.mode, level:s0.level, audioCtx:s0.audioCtx},
  grab:{anchor:s1.player.anchor, L:s1.player.L, speed:s1.player.speed},
  pump:{vx:s2.player.vx, speed:s2.player.speed, anchor:s2.player.anchor},
  reel:{L:s3.player.L, anchor:s3.player.anchor},
  release:{anchor:s4.player.anchor, speed:s4.player.speed},
  pause:{paused:sp0.paused, frozen: sp0.player.x===sp1.player.x && sp0.time===sp1.time, spy:sp1.player.y},
  restart:{time:sr.time, shards:sr.shards, lives:sr.lives, mode:sr.mode},
  mute:{muted:sm.muted},
  mouse:{anchor:mm.player.anchor, after:mm2.player.anchor},
  logs, external: reqs.filter(u=>!u.startsWith('http://localhost:8621')&&!u.startsWith('data:')),
}, null, 2));
await b.close();
