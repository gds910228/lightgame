// Real-input verification: keyboard/mouse events via Playwright (NOT G hooks)
// must produce observable state changes. node verify-input.mjs <port> [game...]
import { createRequire } from 'module';
const require2 = createRequire('C:/Users/Administrator/.agents/skills/playwright-skill/node_modules/');
const { chromium } = require2('playwright');
const port = process.argv[2] || '8600';
const only = process.argv.slice(3);

const CHECKS = {
  'nebula-run': async (page) => {
    await page.click('#startbtn'); await page.waitForTimeout(400);
    const l0 = await page.evaluate('window.__G.state().lane');
    await page.keyboard.down('ArrowLeft'); await page.waitForTimeout(450); await page.keyboard.up('ArrowLeft');
    const lane = await page.evaluate('window.__G.state().lane');
    await page.keyboard.down('Space'); await page.waitForTimeout(160);
    const py = await page.evaluate('window.__G.state().py');
    await page.keyboard.up('Space');
    return `lane ${l0}->${lane} py=${py}`, lane === 0 && py > 0.2;
  },
  'orchard-fusion': async (page) => {
    await page.click('#startbtn'); await page.waitForTimeout(300);
    const s0 = await page.evaluate('window.__G.state().swapped');
    await page.keyboard.press('KeyX'); await page.waitForTimeout(150);
    const swapped = await page.evaluate('window.__G.state().swapped');
    await page.keyboard.press('KeyP'); await page.waitForTimeout(150);
    const paused = await page.evaluate('window.__G.state().paused');
    await page.keyboard.press('KeyP'); await page.waitForTimeout(120);
    const resumed = await page.evaluate('window.__G.state().paused');
    return swapped === !s0 && paused === true && resumed === false;
  },
  'hive-io': async (page) => {
    await page.click('#startbtn'); await page.waitForTimeout(300);
    await page.keyboard.down('Space'); await page.waitForTimeout(320);
    const boosting = await page.evaluate('window.__G.state().player.boosting');
    await page.keyboard.up('Space');
    const a0 = await page.evaluate('window.__G.state().player.angle');
    await page.keyboard.press('ArrowLeft'); await page.waitForTimeout(150);
    const a1 = await page.evaluate('window.__G.state().player.angle');
    return boosting === true && a1 !== a0;
  },
  'pearl-pop-cascade': async (page) => {
    await page.click('#startbtn'); await page.waitForTimeout(400);
    await page.keyboard.press('Space'); await page.waitForTimeout(250);
    const hasBall = await page.evaluate('window.__G.state().hasBall');
    return hasBall === true;
  },
  'danmaku-shrine': async (page) => {
    await page.click('#startbtn'); await page.waitForTimeout(400);
    const px0 = await page.evaluate('window.__G.state().px');
    await page.keyboard.down('ArrowLeft'); await page.waitForTimeout(500); await page.keyboard.up('ArrowLeft');
    const px1 = await page.evaluate('window.__G.state().px');
    await page.keyboard.press('KeyX'); await page.waitForTimeout(150);
    const bombs = await page.evaluate('window.__G.state().bombs');
    return px1 < px0 - 30 && bombs < 3;
  },
  'prism-paths': async (page) => {
    await page.click('#startbtn'); await page.waitForTimeout(400);
    await page.evaluate('window.__G.loadLevel(1)'); await page.waitForTimeout(200);
    await page.keyboard.press('KeyP'); await page.waitForTimeout(120);
    const paused = await page.evaluate('window.__G.state().paused');
    await page.keyboard.press('KeyP'); await page.waitForTimeout(120);
    // pointer rotate (mouse is real input too)
    const cv = await page.$('#gl'); const box = await cv.boundingBox();
    const pos = await page.evaluate(`(function(){const W=600,H=520,CELL=58,BX=36,BY=64;const s=Math.min(innerWidth/W,innerHeight/H);const ox=(innerWidth-W*s)/2,oy=(innerHeight-H*s)/2;return {x:ox+(BX+5*CELL+CELL/2)*s,y:oy+(BY+1*CELL+CELL/2)*s};})()`);
    await page.mouse.click(pos.x, pos.y); await page.waitForTimeout(200);
    const moves = await page.evaluate('window.__G.state().moves');
    await page.keyboard.press('KeyZ'); await page.waitForTimeout(150);
    const movesAfterUndo = await page.evaluate('window.__G.state().moves');
    return paused === true && moves === 1 && movesAfterUndo === 0;
  },
  'deep-catch-saga': async (page) => {
    await page.click('#startbtn').catch(() => {});
    await page.waitForTimeout(600);
    await page.keyboard.press('KeyP'); await page.waitForTimeout(150);
    const paused = await page.evaluate('window.__G.state().paused');
    await page.keyboard.press('KeyP'); await page.waitForTimeout(120);
    return paused === true;
  },
  'sling-siege': async (page) => {
    await page.click('#startbtn').catch(() => {});
    await page.waitForTimeout(400);
    await page.evaluate('window.__G.startGame(0)');
    await page.waitForTimeout(3200);
    const a0 = await page.evaluate('window.__G.state().shotsUsed');
    // pointer drag fire (mouse = real input)
    await page.mouse.move(115, 352); await page.mouse.down();
    await page.mouse.move(30, 430, { steps: 6 }); await page.mouse.up();
    await page.waitForTimeout(300);
    const a1 = await page.evaluate('window.__G.state().shotsUsed');
    await page.keyboard.press('KeyP'); await page.waitForTimeout(120);
    const paused = await page.evaluate('window.__G.state().paused');
    await page.keyboard.press('KeyP');
    return a1 === a0 + 1 && paused === true;
  },
  'rhythm-starlane': async (page) => {
    await page.click('#startbtn').catch(() => {});
    await page.waitForTimeout(600);
    await page.keyboard.press('Enter').catch(() => {});
    await page.waitForTimeout(500);
    const paused0 = await page.evaluate('window.__G.state().paused');
    await page.keyboard.press('KeyP'); await page.waitForTimeout(150);
    const paused = await page.evaluate('window.__G.state().paused');
    await page.keyboard.press('KeyP'); await page.waitForTimeout(120);
    return paused0 === false && paused === true;
  },
};

const browser = await chromium.launch();
for (const id of (only.length ? only : Object.keys(CHECKS))) {
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  let ok = false, detail = '';
  try {
    await page.goto(`http://localhost:${port}/${id}/`, { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(900);
    ok = await CHECKS[id](page);
    if (ok === undefined) ok = false;
  } catch (e) { detail = e.message.slice(0, 100); }
  console.log(`${id}: ${ok ? 'INPUT-OK' : 'INPUT-FAIL'} ${detail}`);
  await page.close();
}
await browser.close();
