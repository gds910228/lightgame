import { createRequire } from 'module';
const require = createRequire('/tmp/pw/node_modules/');
const { chromium } = require('playwright');
const b = await chromium.launch({ headless: true, executablePath: '/usr/local/bin/chromium', args: ['--no-sandbox','--use-gl=swiftshader'] });
const p = await b.newPage({ viewport: { width: 430, height: 820 }, isMobile: true, hasTouch: true });
const logs=[]; p.on('console',m=>{if(m.type()==='error'||m.type()==='warning')logs.push(m.type()+': '+m.text())}); p.on('pageerror',e=>logs.push('ERR '+e));
await p.goto('http://localhost:8621/silkline-swing/', { waitUntil:'load' });
await p.waitForTimeout(400);
await p.screenshot({ path:'/mnt/tos/workspace/.scratch/guizang3/silkline-swing/mobile-title.png' });
await p.tap('#startbtn');
await p.waitForTimeout(200);
const touchVisible = await p.evaluate("document.getElementById('touch').classList.contains('on')");
await p.tap('#tgrab');
// hold via dispatch
await p.evaluate(() => document.getElementById('tgrab').dispatchEvent(new PointerEvent('pointerdown', {bubbles:true, pointerType:'touch'})));
await p.waitForTimeout(500);
const grabbed = await p.evaluate('G.state().player.anchor');
await p.evaluate(() => document.getElementById('tright').dispatchEvent(new PointerEvent('pointerdown', {bubbles:true, pointerType:'touch'})));
await p.waitForTimeout(400);
const vx = await p.evaluate('G.state().player.vx');
await p.evaluate(() => {
  document.getElementById('tright').dispatchEvent(new PointerEvent('pointerup', {bubbles:true, pointerType:'touch'}));
  document.getElementById('tgrab').dispatchEvent(new PointerEvent('pointerup', {bubbles:true, pointerType:'touch'}));
});
await p.waitForTimeout(120);
const released = await p.evaluate('G.state().player.anchor');
await p.screenshot({ path:'/mnt/tos/workspace/.scratch/guizang3/silkline-swing/mobile-play.png' });
console.log(JSON.stringify({ touchVisible, grabbed, vx, released, logs }, null, 2));
await b.close();
