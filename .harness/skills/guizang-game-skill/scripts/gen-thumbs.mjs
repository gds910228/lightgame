// Generate 640x360 in-game thumbnails for guizang3 series games.
// Usage: node gen-thumbs.mjs <gameId> [port]
// Loads the game, drives it into a representative gameplay state via window.__G,
// screenshots at 960x540, converts to packages/games/<id>/thumbnail.jpg via ffmpeg.
import { createRequire } from 'module';
import { execSync } from 'child_process';
import fs from 'fs';
const require2 = createRequire('C:/Users/Administrator/.agents/skills/playwright-skill/node_modules/');
const { chromium } = require2('playwright');

const [gameId, port = '8600'] = process.argv.slice(2);
const ROOT = 'D:/WorkProjects/AI/Lightgame';
const tmp = `${ROOT}/.scratch/guizang3/${gameId}/thumb-raw.png`;

// per-game driver: bring the game into a juicy gameplay state
const DRIVERS = {
  'orchard-fusion': async (page) => {
    await page.click('#startbtn');
    await page.waitForTimeout(300);
    for (const x of [270, 340, 300, 380]) {
      await page.mouse.move(x, 200); await page.mouse.down(); await page.mouse.up();
      await page.waitForTimeout(620);
    }
    await page.waitForTimeout(900);
  },
  'nebula-run': async (page) => {
    await page.click('#startbtn');
    await page.waitForTimeout(2600);
    await page.keyboard.press('Space');
    await page.waitForTimeout(700);
  },
  'hive-io': async (page) => {
    await page.click('#startbtn');
    await page.mouse.move(650, 320);
    await page.waitForTimeout(1500);
    await page.mouse.down();
    await page.waitForTimeout(900);
    await page.mouse.up();
    await page.waitForTimeout(300);
  },
  'pearl-pop-cascade': async (page) => {
    await page.click('#startbtn');
    await page.waitForTimeout(400);
    await page.mouse.move(520, 200); await page.mouse.click(520, 200);
    await page.waitForTimeout(1500);
    await page.mouse.move(380, 200); await page.mouse.click(380, 200);
    await page.waitForTimeout(1200);
  },
  'danmaku-shrine': async (page) => {
    await page.click('#startbtn');
    await page.waitForTimeout(3200);
    await page.keyboard.down('ArrowRight');
    await page.waitForTimeout(600);
    await page.keyboard.up('ArrowRight');
    await page.waitForTimeout(400);
  },
  'prism-paths': async (page) => {
    await page.click('#startbtn');
    await page.waitForTimeout(1200);
    // jump to a beam-rich level via G and rotate for visible lasers
    await page.evaluate('window.__G.loadLevel(14)');
    await page.waitForTimeout(300);
    await page.evaluate('window.__G.rotate(3,5)');
    await page.waitForTimeout(400);
  },
  'rhythm-starlane': async (page) => {
    await page.click('#startbtn').catch(() => {});
    await page.waitForTimeout(700);
    await page.keyboard.press('Enter').catch(() => {});
    await page.waitForTimeout(4200);
  },
  'sling-siege': async (page) => {
    await page.evaluate('window.__G.startGame(15)');   // jump to a visually rich fort level
    await page.waitForTimeout(3300);                   // wait out level banner
    await page.evaluate('window.__G.fire(28, .85, "bomb")');
    await page.waitForTimeout(1150);                   // capture mid-flight / impact
  },
  'deep-catch-saga': async (page) => {
    await page.click('#startbtn').catch(() => {});
    await page.waitForTimeout(600);
    // cast then sink for a bit
    await page.keyboard.press('Space').catch(() => {});
    await page.waitForTimeout(2600);
  },
  'abyss-reaper': async (page) => {
    await page.click('#startbtn').catch(() => {});
    await page.waitForTimeout(6500);
  },
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
await page.goto(`http://localhost:${port}/${gameId}/`, { waitUntil: 'load' });
await page.waitForTimeout(900);
const driver = DRIVERS[gameId];
if (!driver) { console.error('no driver for', gameId); process.exit(1); }
await driver(page);
await page.screenshot({ path: tmp });
await browser.close();

const out = `${ROOT}/packages/games/${gameId}/thumbnail.jpg`;
execSync(`ffmpeg -y -i "${tmp}" -vf scale=640:360 -q:v 4 "${out}"`, { stdio: 'pipe' });
const kb = Math.round(fs.statSync(out).size / 1024);
console.log(`${gameId}: thumbnail.jpg ${kb}KB`);
