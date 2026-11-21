import { createRequire } from 'module';
const require = createRequire('/tmp/pw/node_modules/');
const { chromium } = require('playwright');
const fs = await import('node:fs');
const browser = await chromium.launch({ executablePath: '/usr/local/bin/chromium', args: ['--no-sandbox', '--use-gl=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.setContent(`<title>host</title><script>
window.__MSGS = [];
addEventListener('message', e => { if (e.data && e.data.source === 'lightgame') window.__MSGS.push(e.data); });
</script><iframe id="f" src="http://localhost:8623/aqua-conduit/" style="width:1280px;height:720px;border:0"></iframe>`);
await page.waitForTimeout(1800);
// trigger reports inside the iframe
const frame = page.frames().find(f => f.url().includes('aqua-conduit'));
await frame.evaluate('window.G.setLevel(2); window.G.setMoves(0);');
await page.waitForTimeout(400);
await frame.evaluate('window.G.setLevel(3); window.G.autoSolve();');
await page.waitForTimeout(500);
const msgs = await page.evaluate(() => window.__MSGS);
console.log(JSON.stringify(msgs, null, 2));
fs.writeFileSync('/mnt/tos/workspace/.scratch/guizang3/aqua-conduit/bridge-test.json', JSON.stringify(msgs, null, 2));
await browser.close();
