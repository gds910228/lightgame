import { createRequire } from 'module';
const require = createRequire('/tmp/pw/node_modules/');
const { chromium } = require('playwright');
const b = await chromium.launch({ headless: true, executablePath: '/usr/local/bin/chromium', args: ['--no-sandbox','--use-gl=swiftshader'] });
const p = await b.newPage();
await p.goto('http://localhost:8621/silkline-swing/', { waitUntil:'load' });
const r = await p.evaluate(() => { G.testMode(true); return G.autoRun(1, 30); });
console.log(JSON.stringify(r));
await b.close();
