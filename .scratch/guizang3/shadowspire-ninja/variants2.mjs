import { createRequire } from 'module';
const require = createRequire('/tmp/pw/node_modules/');
const { chromium } = require('playwright');
const OUT = '/mnt/tos/workspace/.scratch/guizang3/shadowspire-ninja';
const BASE = 'http://localhost:8611/shadowspire-ninja/';
const browser = await chromium.launch({ headless: true, executablePath: '/usr/local/bin/chromium', args: ['--no-sandbox'] });

async function setup(page) {
  await page.goto(BASE + '?autostart=1', { waitUntil: 'load' });
  await page.waitForTimeout(250);
  await page.evaluate(() => {
    const G = window.G;
    G.setNoAuto(true); G.startGame();
    const safe = G.level.platforms.filter(p => p.route && p.y > 872 && p.y < 898 &&
      !G.level.hazards.some(h => Math.abs(h.y - p.y) < 2.4 && h.x < p.x + p.w && h.x + h.w > p.x)
    ).sort((a,b)=>a.y-b.y);
    const p = safe[Math.floor(safe.length/2)] || safe[0];
    G.setBest(420); G.setPos(p.x + p.w*0.5, p.y + 0.03);
    G.setLives(2); G.setDust(9); G.setChi(72); G.setScore(1884);
    G.upd(2);
  });
  await page.waitForTimeout(5100);
}

async function shot(name, action, offset) {
  const ctx = await browser.newContext({ viewport: { width: 640, height: 1138 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await setup(page);
  await page.evaluate((a) => {
    const G = window.G;
    if (a === 'jump') {
      G.press('KeyD'); G.upd(4); G.release('KeyD');
      G.press('Space'); G.upd(7); G.release('Space');
    } else if (a === 'dash') {
      G.press('KeyA'); G.upd(7); G.release('KeyA');
      G.press('Space'); G.upd(6);
      G.press('ShiftLeft'); G.upd(2); G.release('Space','ShiftLeft');
    } else if (a === 'run') {
      G.press('KeyD'); G.upd(12); G.release('KeyD');
    } else if (a === 'wall') {
      G.setPos(2.0, 878); G.upd(1);
      G.press('KeyA'); G.upd(10); G.release('KeyA');
      G.press('Space'); G.upd(5); G.release('Space');
    }
    G.render();
  }, action);
  await page.waitForTimeout(70);
  const info = await page.evaluate(() => {
    const s = window.G.state();
    const cv = document.getElementById('cv').getBoundingClientRect();
    const py = cv.top + (960 - (s.y - s.cameraY) * 18) / 960 * cv.height;
    return { s, py };
  });
  const y = Math.max(0, Math.min(1138-360, Math.round(info.py - offset)));
  await page.screenshot({ path: `${OUT}/${name}.png`, clip: { x:0, y, width:640, height:360 } });
  console.log(name, info.s.y.toFixed(1), info.s.x.toFixed(1), 'clip', y);
  await ctx.close();
}
await shot('variant-jump', 'jump', 190);
await shot('variant-dash-hi', 'dash', 235);
await shot("variant-run-wide", "run", 278);
await shot('variant-wall', 'wall', 200);
await browser.close();
