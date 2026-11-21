import { createRequire } from 'module';
const require = createRequire('/tmp/pw/node_modules/');
const { chromium } = require('playwright');
import fs from 'fs';

const PORT = process.env.PORT || 8625;
const BASE = `http://localhost:${PORT}/emberpin/`;
const OUT = '/mnt/tos/workspace/.scratch/guizang3/emberpin';
const report = { rounds: [], direct: null, input: {}, extAll: [] };

const browser = await chromium.launch({
  headless: true,
  executablePath: '/usr/local/bin/chromium',
  args: ['--no-sandbox', '--use-gl=swiftshader'],
});

async function newPage(viewport = { width: 1280, height: 720 }) {
  const p = await browser.newPage({ viewport });
  const errs = [], warns = [], perrs = [], reqs = [], cons = [];
  p.on('console', m => {
    cons.push(`${m.type()}: ${m.text()}`);
    if (m.type() === 'error') errs.push(m.text());
    if (m.type() === 'warning') warns.push(m.text());
  });
  p.on('pageerror', e => perrs.push(String(e && e.stack || e)));
  p.on('request', r => reqs.push(r.url()));
  return { p, errs, warns, perrs, reqs, cons };
}

// ---------- two consecutive autotest rounds ----------
for (let round = 1; round <= 2; round++) {
  const { p, errs, warns, perrs, reqs } = await newPage();
  await p.goto(BASE + '?autotest=1', { waitUntil: 'load' });
  await p.waitForFunction('window.__TEST && window.__TEST.done', { timeout: 180000 });
  const t = await p.evaluate('window.__TEST');
  const net = await p.evaluate('window.__NET');
  const external = reqs.filter(u => !u.includes('localhost'));
  report.rounds.push({
    round, pass: t.pass, fail: t.fail, total: t.total, done: t.done,
    failed: t.results.filter(r => !r.ok).map(r => `${r.id}:${r.name}`),
    consoleErrors: errs, consoleWarnings: warns, pageErrors: perrs,
    external, net, booterr: await p.evaluate('window.__BOOTERR'),
  });
  report.extAll.push(...external);
  await p.close();
}

// ---------- direct load, no query parameters ----------
{
  const { p, errs, warns, perrs, reqs } = await newPage();
  await p.goto(BASE, { waitUntil: 'load' });
  await p.waitForTimeout(1200);
  const st = await p.evaluate('window.G && window.G.state ? window.G.state() : null');
  const boot = await p.evaluate('window.__BOOTERR');
  const external = reqs.filter(u => !u.includes('localhost'));
  report.direct = {
    mode: st && st.mode, booterr: boot, consoleErrors: errs, consoleWarnings: warns,
    pageErrors: perrs, external, net: await p.evaluate('window.__NET'),
    globalFns: await p.evaluate(`({goHome:typeof goHome,clickMore:typeof clickMore,dp_share:typeof dp_share,play68_submitScore:typeof play68_submitScore})`),
  };
  report.extAll.push(...external);
  await p.close();
}

// ---------- real keyboard / mouse exercise + screenshots ----------
{
  const { p, errs, warns, perrs, reqs } = await newPage({ width: 1280, height: 720 });
  await p.goto(BASE, { waitUntil: 'load' });
  await p.waitForTimeout(600);
  await p.screenshot({ path: `${OUT}/title-1280x720.png` });

  // real click on the start button
  await p.click('#startbtn');
  await p.waitForTimeout(250);
  const started = await p.evaluate('window.G.state()');

  // real keyboard: charge and launch
  await p.keyboard.down('Space');
  await p.waitForTimeout(700);
  const chargeState = await p.evaluate('window.G.state()');
  await p.keyboard.up('Space');
  await p.waitForTimeout(120);
  const launched = await p.evaluate('window.G.state()');

  // real keyboard: flippers
  await p.keyboard.down('a');
  await p.waitForTimeout(120);
  const leftDown = await p.evaluate('window.G.state().flippers');
  await p.keyboard.up('a');
  await p.keyboard.down('d');
  await p.waitForTimeout(120);
  const rightDown = await p.evaluate('window.G.state().flippers');
  await p.keyboard.up('d');

  // real keyboard: pause / resume
  await p.keyboard.press('p');
  await p.waitForTimeout(120);
  const paused = await p.evaluate('window.G.state()');
  await p.keyboard.press('p');
  await p.waitForTimeout(120);
  const resumed = await p.evaluate('window.G.state()');

  // real keyboard: mute toggle
  const mutedBefore = await p.evaluate('window.G.state().muted');
  await p.keyboard.press('m');
  await p.waitForTimeout(100);
  const mutedAfter = await p.evaluate('window.G.state().muted');
  await p.keyboard.press('m');

  // real mouse pointer on the left half of the canvas
  await p.mouse.move(120, 520);
  await p.mouse.down();
  await p.waitForTimeout(140);
  const mouseLeft = await p.evaluate('window.G.state().flippers.leftPressed');
  await p.mouse.up();

  // real keyboard restart
  await p.keyboard.press('r');
  await p.waitForTimeout(150);
  const restarted = await p.evaluate('window.G.state()');

  // make a lively representative frame for the 640×360 gameplay shot
  await p.evaluate(`(() => {
    const G = window.G;
    G.startGame();
    G.hitTarget(0,0); G.hitTarget(0,1); G.hitTarget(0,2);
    G.hitTarget(1,0); G.hitTarget(1,1);
    G.hitTarget(2,0);
    G.clearBalls();
    for (let i=0;i<170;i++) G.step(1);      // let intro floats and hit floats expire
    G.setScore(18760);
    G.clearBalls();
    G.placeBall(214, 300, 170, 130);
    G.placeBall(300, 250, -120, 90);
    G.placeBall(420, 470, -210, -40);
    G.step(10);
    G.press('a'); G.step(3); G.release('a');
    G.step(3);
    const t = document.getElementById('toast'); if (t) t.classList.remove('show');
  })()`);
  await p.waitForTimeout(120);
  await p.setViewportSize({ width: 640, height: 360 });
  await p.waitForTimeout(260);
  await p.evaluate(`(() => {
    G.step(2);
    const t = document.getElementById('toast'); if (t) t.classList.remove('show');
  })()`);
  await p.screenshot({ path: `${OUT}/play-640x360.png`, type: 'png' });
  await p.screenshot({ path: `${OUT}/play-640x360.jpg`, type: 'jpeg', quality: 92 });

  report.input = {
    startedMode: started.mode,
    chargeDuringHold: chargeState.charge,
    launchedVy: launched.balls[0] ? launched.balls[0].vy : null,
    leftFlipperPressed: leftDown.leftPressed,
    rightFlipperPressed: rightDown.rightPressed,
    paused: paused.paused,
    resumed: !resumed.paused,
    muteBefore: mutedBefore, muteAfter: mutedAfter,
    mouseLeftPressed: mouseLeft,
    restart: { mode: restarted.mode, score: restarted.score, ballsLeft: restarted.ballsLeft, lane: restarted.balls[0] && restarted.balls[0].inLane },
    external: reqs.filter(u => !u.includes('localhost')),
    consoleErrors: errs, consoleWarnings: warns, pageErrors: perrs,
  };
  report.extAll.push(...reqs.filter(u => !u.includes('localhost')));
  await p.close();
}

await browser.close();
report.extAll = [...new Set(report.extAll)];
fs.writeFileSync(`${OUT}/audit.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
