// Quick visual captures for the two updated games
import { createRequire } from 'module';
const require2 = createRequire('C:/Users/Administrator/.agents/skills/playwright-skill/node_modules/');
const { chromium } = require2('playwright');

const PORT = process.argv[2] || '8612';
const BASE = `http://localhost:${PORT}`;
const OUT = 'D:/WorkProjects/AI/Lightgame/.scratch/guizang3';
const browser = await chromium.launch();

// ironwright: combat with auto-aim lock visible
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(`${BASE}/ironwright-arena/`, { waitUntil: 'load' });
  await page.waitForFunction('window.G && window.G.state');
  await page.click('#startbtn');
  await page.waitForTimeout(400);
  await page.click('#confirmBtn');
  await page.waitForTimeout(3000);
  await page.evaluate('G.forceBossAttack("radial")');
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/ironwright-lock-1280x720.png` });
  await page.close();
}
// bridgewright: mid-test with driver + lantern (level 14 reference solution)
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
  await page.goto(`${BASE}/bridgewright/?autostart=1&level=14`, { waitUntil: 'load' });
  await page.waitForFunction('window.G && window.G.state');
  await page.waitForTimeout(4200);
  await page.screenshot({ path: `${OUT}/bridgewright-fun-1280x760.png` });
  await page.close();
}
await browser.close();
console.log('shots saved');
