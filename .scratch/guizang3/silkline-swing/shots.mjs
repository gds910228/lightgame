import { createRequire } from 'module';
const require = createRequire('/tmp/pw/node_modules/');
const { chromium } = require('playwright');
const b = await chromium.launch({ headless: true, executablePath: '/usr/local/bin/chromium', args: ['--no-sandbox','--use-gl=swiftshader'] });
for (const [name, url] of [
  ['auto-l1', '?autostart=1&level=1'],
  ['auto-l8', '?autostart=1&level=8'],
  ['auto-gate14', '?autostart=1&level=14&shot=gate'],
]) {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const logs=[]; p.on('console',m=>{if(m.type()==='error'||m.type()==='warning')logs.push(m.type()+': '+m.text())}); p.on('pageerror',e=>logs.push('ERR '+e));
  await p.goto('http://localhost:8621/silkline-swing/'+url, { waitUntil:'load' });
  await p.waitForTimeout(700);
  await p.screenshot({ path: `/mnt/tos/workspace/.scratch/guizang3/silkline-swing/${name}.png` });
  console.log(name, JSON.stringify(await p.evaluate('window.G.state().player')), 'logs', logs);
  await p.close();
}
await b.close();
