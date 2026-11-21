import { createRequire } from 'module';
const require = createRequire('/tmp/pw/node_modules/');
const { chromium } = require('playwright');
const OUT = '/mnt/tos/workspace/.scratch/guizang3/ironwright-arena';
const b = await chromium.launch({headless:true,executablePath:'/usr/local/bin/chromium',args:['--no-sandbox','--use-gl=swiftshader']});
const p = await b.newPage({viewport:{width:1280,height:720}, deviceScaleFactor:1});
const errors=[], warnings=[], pageerrors=[], reqs=[];
p.on('console',m=>{if(m.type()==='error')errors.push(m.text()); if(m.type()==='warning')warnings.push(m.text());});
p.on('pageerror',e=>pageerrors.push(String(e)));
p.on('request',r=>reqs.push(r.url()));
await p.goto('http://localhost:8626/ironwright-arena/', {waitUntil:'networkidle'});
await p.waitForFunction('window.G && window.G.state');
await p.waitForTimeout(600);
await p.screenshot({path:`${OUT}/title-1280x720.png`});
// forge
await p.click('#startbtn');
await p.waitForTimeout(900);
await p.screenshot({path:`${OUT}/forge-1280x720.png`});
// battle
await p.click('#confirmBtn');
await p.waitForTimeout(2200);
// arrange a visually rich frame
await p.evaluate(() => {
  G.setAimAtBoss();
  G.setPlayerHp(88);
  G.setHeat(64);
  G.setCore(82);
  G.setEnergy(72);
  G.setBossHp(760);
  G.forceBossAttack('radial');
});
await p.waitForTimeout(650);
await p.keyboard.down('KeyJ');
await p.mouse.move(800, 330);
await p.waitForTimeout(550);
await p.screenshot({path:`${OUT}/game-1280x720.png`});
await p.screenshot({path:`${OUT}/game-640x360.png`});
await p.keyboard.up('KeyJ');
const st = await p.evaluate(() => ({state:G.state(), reports:G.reportLog()}));
console.log(JSON.stringify({st, errors, warnings, pageerrors, external:reqs.filter(u=>!u.includes('localhost:8626'))}, null, 2));
await b.close();
