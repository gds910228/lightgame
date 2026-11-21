import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';

const require = createRequire('/tmp/pw/node_modules/');
const { chromium } = require('playwright');
const OUT = '/mnt/tos/workspace/.scratch/guizang3/shadowspire-ninja';
const BASE = 'http://localhost:8611/shadowspire-ninja/';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  executablePath: '/usr/local/bin/chromium',
  args: ['--no-sandbox'],
});

async function stageGameplay(page) {
  await page.goto(BASE + '?autostart=1', { waitUntil: 'load' });
  await page.waitForTimeout(250);
  await page.evaluate(() => {
    const G = window.G;
    G.setNoAuto(true);
    G.startGame();
    const safe = G.level.platforms.filter(p =>
      p.route && p.y > 872 && p.y < 898 &&
      !G.level.hazards.some(h => Math.abs(h.y - p.y) < 2.4 && h.x < p.x + p.w && h.x + h.w > p.x)
    ).sort((a, b) => a.y - b.y);
    const p = safe[Math.floor(safe.length / 2)] || safe[0] || G.level.platforms[100];
    G.setBest(420);
    G.setPos(p.x + p.w * 0.5, p.y + 0.03);
    G.setLives(2);
    G.setDust(9);
    G.setChi(72);
    G.setScore(1680);
    G.upd(2);
  });
  // Let the checkpoint banner and opening tutorial toast retire.
  await page.waitForTimeout(5100);
  await page.evaluate(() => {
    const G = window.G;
    G.setChi(72);
    G.setDust(9);
    G.setScore(1884);
    G.press('KeyD'); G.upd(12); G.release('KeyD');
    G.render();
  });
  await page.waitForTimeout(70);
  return page.evaluate(() => {
    const s = window.G.state();
    const cv = document.getElementById('cv').getBoundingClientRect();
    const py = cv.top + (960 - (s.y - s.cameraY) * 18) / 960 * cv.height;
    return { state: s, py, stage: cv.toJSON() };
  });
}

// Title at the requested 1280x720 review size.
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', m => { if (['error', 'warning'].includes(m.type())) errs.push(m.text()); });
  page.on('pageerror', e => errs.push(String(e)));
  await page.goto(BASE, { waitUntil: 'load' });
  await page.evaluate(() => localStorage.setItem('ssn.best', '420'));
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(OUT, 'title-1280x720.png') });
  console.log('title errors:', errs);
  await ctx.close();
}

// 640x1138 play frame, cropped to a true 640x360 gameplay window.
{
  const ctx = await browser.newContext({ viewport: { width: 640, height: 1138 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', m => { if (['error', 'warning'].includes(m.type())) errs.push(m.text()); });
  page.on('pageerror', e => errs.push(String(e)));
  const info = await stageGameplay(page);
  const clipY = Math.max(0, Math.min(1138 - 360, Math.round(info.py - 278)));
  await page.screenshot({ path: path.join(OUT, 'game-in-640x360.png'), clip: { x: 0, y: clipY, width: 640, height: 360 } });
  await page.screenshot({ path: path.join(OUT, 'game-full-640x1138.png') });
  console.log('game info:', JSON.stringify({ height: info.state.height.toFixed(1), x: info.state.x.toFixed(1), zone: info.state.zone, score: info.state.score, dust: info.state.dust, chi: info.state.chi, py: info.py, clipY, errs }));
  await ctx.close();
}

// Full-page gameplay frame at 1280x720 for visual review.
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await stageGameplay(page);
  await page.screenshot({ path: path.join(OUT, 'game-1280x720.png') });
  await ctx.close();
}

await browser.close();
