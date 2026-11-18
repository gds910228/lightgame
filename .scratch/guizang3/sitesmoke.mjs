// Site-level smoke: serve the BUILT public/games copies, load each game page
// like the site iframe would, drive it into gameplay, assert zero console
// errors and liveness. Usage: node sitesmoke.mjs <port> [gameId...]
import { createRequire } from 'module';
import { execSync, spawn } from 'child_process';
const require2 = createRequire('C:/Users/Administrator/.agents/skills/playwright-skill/node_modules/');
const { chromium } = require2('playwright');

const port = process.argv[2] || '8700';
const games = process.argv.slice(3);
if (!games.length) { console.error('usage: node sitesmoke.mjs <port> <gameId...>'); process.exit(1); }

// start static server on packages/app/public
const server = spawn('python', ['-m', 'http.server', port], {
  cwd: 'D:/WorkProjects/AI/Lightgame/packages/app/public', stdio: 'ignore',
});
await new Promise(r => setTimeout(r, 1200));

const browser = await chromium.launch();
const results = [];
for (const id of games) {
  const errors = [];
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(String(e)));
  let status = 'ok';
  try {
    const resp = await page.goto(`http://localhost:${port}/games/${id}/`, { waitUntil: 'load', timeout: 30000 });
    if (!resp.ok()) status = 'http ' + resp.status();
    await page.waitForTimeout(1200);
    // click the start button if present (each game uses #startbtn per conventions)
    const hasStart = await page.$('#startbtn');
    if (hasStart) await page.click('#startbtn').catch(() => {});
    await page.waitForTimeout(2000);
    const alive = await page.evaluate(() => !!window.__G).catch(() => false);
    if (!alive) status = 'no __G';
    const bootErr = await page.evaluate('window.__BOOTERR || []').catch(() => []);
    if (bootErr.length) { errors.push('BOOTERR: ' + bootErr.join('; ')); }
    if (errors.length) status = 'errors: ' + errors.slice(0, 3).join(' | ');
  } catch (e) { status = 'FAIL ' + e.message.slice(0, 120); }
  results.push(`${id}: ${status}`);
  await page.close();
}
await browser.close();
server.kill();
console.log(results.join('\n'));
