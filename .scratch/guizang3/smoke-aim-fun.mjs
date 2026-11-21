// Real-input smoke for the two playtest-feedback fixes:
// - ironwright-arena: auto-aim (idle 1.2s -> lock) + auto-fire toggle + HUD/keyboard toggles
// - bridgewright: real mouse/keyboard build + test flow still works (fun-pass regression)
// Usage: node smoke-aim-fun.mjs <port>
import { createRequire } from 'module';
const require2 = createRequire('C:/Users/Administrator/.agents/skills/playwright-skill/node_modules/');
const { chromium } = require2('playwright');

const PORT = process.argv[2] || '8612';
const BASE = `http://localhost:${PORT}`;
const browser = await chromium.launch();
const out = { ironwright: {}, bridgewright: {} };

function audit(page, port, errs, external) {
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push(String(e)));
  page.on('request', r => { if (!r.url().includes(`localhost:${port}`)) external.push(r.url()); });
}

// ---------------- ironwright-arena ----------------
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [], external = [];
  audit(page, PORT, errs, external);
  await page.goto(`${BASE}/ironwright-arena/`, { waitUntil: 'load' });
  await page.waitForFunction('window.G && window.G.state');
  await page.click('#startbtn');
  await page.waitForTimeout(500);
  await page.click('#confirmBtn');
  await page.waitForTimeout(2600); // banner; no mouse movement at all after combat start
  const lock = await page.evaluate(() => {
    const s = G.state();
    const ba = Math.atan2(s.boss.y - s.player.y, s.boss.x - s.player.x);
    return {
      diff: Math.abs(s.player.aim - ba), autoAim: s.autoAim, autoFire: s.autoFire,
      aimBtn: document.getElementById('aimbtn').textContent,
      fireBtn: document.getElementById('firebtn').textContent,
    };
  });
  // real click on 射·手动 -> autoFire on, weapon fires with zero other input
  await page.click('#firebtn');
  await page.waitForTimeout(300);
  const f1 = await page.evaluate('G.state().autoFire');
  const shots0 = await page.evaluate('G.state().shotsFired');
  await page.waitForTimeout(900);
  const shots1 = await page.evaluate('G.state().shotsFired');
  // real click on 瞄·自动 -> manual: mouse aims, idle does NOT re-lock
  await page.click('#aimbtn');
  await page.waitForTimeout(120);
  const manualAim = await page.evaluate('G.state().autoAim');
  await page.mouse.move(200, 300);
  await page.waitForTimeout(150);
  const aimManual = await page.evaluate('G.state().player.aim');
  await page.waitForTimeout(2000);
  const sIdle = await page.evaluate(() => {
    const s = G.state();
    const ba = Math.atan2(s.boss.y - s.player.y, s.boss.x - s.player.x);
    return { aim: s.player.aim, diff: Math.abs(s.player.aim - ba) };
  });
  // keyboard toggles restore defaults + persistence
  await page.keyboard.press('KeyG');
  await page.waitForTimeout(120);
  await page.keyboard.press('KeyF');
  await page.waitForTimeout(120);
  const toggles = await page.evaluate(() => ({
    autoAim: G.state().autoAim, autoFire: G.state().autoFire,
    ls: [localStorage.getItem('irw.autoaim'), localStorage.getItem('irw.autofire')],
  }));
  out.ironwright = {
    lockNoInput: lock.diff < .1 && lock.autoAim === true,
    hudBtnTexts: `${lock.aimBtn}/${lock.fireBtn}`,
    autoFireToggled: f1 === true,
    autoFireShotIncrease: shots1 > shots0, shots0, shots1,
    aimBtnToManual: manualAim === false,
    manualAimFollowsMouse: Math.abs(aimManual - sIdle.aim) < .01,
    idleStaysManual: sIdle.diff > .2,
    keyTogglesRestore: toggles.autoAim === true && toggles.autoFire === false,
    persisted: toggles.ls[0] === '1' && toggles.ls[1] === '0',
    errs, external,
  };
  await page.close();
}

// ---------------- bridgewright ----------------
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errs = [], external = [];
  audit(page, PORT, errs, external);
  await page.goto(`${BASE}/bridgewright/`, { waitUntil: 'load' });
  await page.waitForFunction('window.G && window.G.state');
  await page.click('#startbtn');
  await page.waitForTimeout(400);
  const modeBuild = await page.evaluate('G.state().mode === "build"');
  // real mouse: click node A then node B -> one member built
  const a = await page.evaluate('G.nodeScreen(1)');
  const b = await page.evaluate('G.nodeScreen(2)');
  await page.mouse.click(a.x, a.y);
  await page.waitForTimeout(150);
  await page.mouse.click(b.x, b.y);
  await page.waitForTimeout(150);
  const members1 = await page.evaluate('G.state().members');
  // real keyboard: Z undoes it
  await page.keyboard.press('KeyZ');
  await page.waitForTimeout(150);
  const members0 = await page.evaluate('G.state().members');
  // complete the bridge, then real Enter starts the stress test
  await page.evaluate('G.buildSolution(1)');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  const modeTest = await page.evaluate('G.state().mode === "test"');
  const car0 = await page.evaluate('G.state().car.x');
  await page.waitForTimeout(1200);
  const car1 = await page.evaluate('G.state().car.x');
  // real P pause freezes, resume, R resets
  await page.keyboard.press('KeyP');
  await page.waitForTimeout(150);
  const paused = await page.evaluate('G.state().paused');
  const px1 = await page.evaluate('G.state().car.x');
  await page.waitForTimeout(400);
  const px2 = await page.evaluate('G.state().car.x');
  await page.keyboard.press('KeyP');
  await page.waitForTimeout(100);
  await page.keyboard.press('KeyR');
  await page.waitForTimeout(200);
  const afterR = await page.evaluate('G.state().mode + "/" + G.state().members');
  out.bridgewright = {
    buildViaMouseClick: modeBuild && members1 === 1,
    undoViaKeyZ: members0 === 0,
    enterStartsTest: modeTest,
    carMoves: car1 > car0 + 5, car0, car1,
    pauseFreezes: paused && px1 === px2,
    resetWorks: afterR.startsWith('build/0'),
    errs, external,
  };
  await page.close();
}

await browser.close();
console.log(JSON.stringify(out, null, 1));
