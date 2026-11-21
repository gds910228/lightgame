import { createRequire } from 'module';
const require = createRequire('/tmp/pw/node_modules/');
const { chromium } = require('playwright');
const fs = require('fs');

const PORT = 8626;
const ID = 'ironwright-arena';
const BASE = `http://localhost:${PORT}/${ID}/`;
const OUT = '/mnt/tos/workspace/.scratch/guizang3/ironwright-arena';
const browser = await chromium.launch({
  headless: true,
  executablePath: '/usr/local/bin/chromium',
  args: ['--no-sandbox', '--use-gl=swiftshader'],
});

function hook(page) {
  const audit = { errors: [], warnings: [], pageerrors: [], external: [], localRequests: 0 };
  page.on('console', m => {
    if (m.type() === 'error') audit.errors.push(m.text());
    if (m.type() === 'warning') audit.warnings.push(m.text());
  });
  page.on('pageerror', e => audit.pageerrors.push(String(e)));
  page.on('request', r => {
    if (r.url().includes(`localhost:${PORT}`)) audit.localRequests++;
    else audit.external.push(r.url());
  });
  return audit;
}

const rounds = [];
for (let i = 1; i <= 2; i++) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const audit = hook(page);
  await page.goto(`${BASE}?autotest=1`, { waitUntil: 'load' });
  await page.waitForFunction('window.__TEST && window.__TEST.done === true', { timeout: 120000 });
  const test = await page.evaluate('window.__TEST');
  const extra = await page.evaluate(() => ({
    booterr: window.__BOOTERR || [],
    net: window.__NET || null,
    reportCount: window.G ? window.G.reportLog().length : -1,
  }));
  rounds.push({
    round: i,
    pass: test.pass, fail: test.fail, total: test.total, done: test.done,
    failures: test.results.filter(r => !r.ok),
    results: test.results,
    audit, extra,
  });
  await page.screenshot({ path: `${OUT}/autotest-round${i}-title.png` });
  await page.close();
}

// real input smoke + direct no-parameter page audit
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const audit = hook(page);
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForFunction('window.G && window.G.state');
await page.waitForTimeout(700);
const booterr = await page.evaluate(() => window.__BOOTERR || []);
const globals = await page.evaluate(() => ({
  goHome: typeof window.goHome, clickMore: typeof window.clickMore,
  dp_share: typeof window.dp_share, play68_submitScore: typeof window.play68_submitScore,
  handleParentShare: true,
}));
await page.screenshot({ path: `${OUT}/title-1280x720.png` });

// real click through title -> forge -> combat
await page.click('#startbtn');
await page.waitForTimeout(600);
const forgeVisible = await page.evaluate(() => !document.getElementById('forge').classList.contains('hide'));
await page.screenshot({ path: `${OUT}/forge-1280x720.png` });
await page.click('#confirmBtn');
await page.waitForTimeout(900);
const startState = await page.evaluate(() => G.state());
const x0 = startState.player.x;
await page.keyboard.down('KeyD');
await page.waitForTimeout(450);
await page.keyboard.up('KeyD');
const afterMove = await page.evaluate(() => G.state());
const bossScreen = await page.evaluate(() => {
  const s = G.state();
  return { x: s.boss.x, y: s.boss.y, hp: s.boss.hp };
});
await page.mouse.move(bossScreen.x, bossScreen.y);
await page.mouse.down();
await page.waitForTimeout(800);
await page.mouse.up();
const afterFire = await page.evaluate(() => G.state());
await page.keyboard.press('KeyK');
await page.waitForTimeout(250);
const afterDash = await page.evaluate(() => G.state());
await page.evaluate(() => G.setCore(100));
await page.keyboard.press('KeyE');
await page.waitForTimeout(120);
const afterBarrier = await page.evaluate(() => G.state());
await page.keyboard.press('KeyP');
await page.waitForTimeout(200);
const pausedState = await page.evaluate(() => G.state());
const pa = await page.evaluate(() => ({ x: G.state().player.x, boss: G.state().boss.x }));
await page.waitForTimeout(350);
const pb = await page.evaluate(() => ({ x: G.state().player.x, boss: G.state().boss.x }));
await page.keyboard.press('KeyP');
await page.waitForTimeout(100);
const afterPause = await page.evaluate(() => G.state());
const muteBefore = afterPause.muted;
await page.keyboard.press('KeyM');
await page.waitForTimeout(100);
const muteOn = await page.evaluate(() => G.state().muted);
await page.keyboard.press('KeyM');
await page.waitForTimeout(100);
const muteOff = await page.evaluate(() => G.state().muted);
await page.keyboard.press('KeyR');
await page.waitForTimeout(250);
const afterRestart = await page.evaluate(() => G.state());
await page.click('#confirmBtn');
await page.waitForTimeout(2800);

// 1280 gameplay representative shot, then 640x360
await page.evaluate(() => {
  G.setAimAtBoss();
  G.forceBossAttack('radial');
  G.setBossHp(1400);
});
await page.waitForTimeout(750);
await page.screenshot({ path: `${OUT}/gameplay-1280x720.png` });
await page.setViewportSize({ width: 640, height: 360 });
await page.waitForTimeout(450);
await page.evaluate(() => { G.setAimAtBoss(); G.forceBossAttack('radial'); });
await page.waitForTimeout(550);
await page.screenshot({ path: `${OUT}/gameplay-640x360.png` });

const smoke = {
  booterr, globals, forgeVisible,
  startMode: startState.mode, startBoss: startState.bossId,
  moved: afterMove.player.x > x0 + 4, x0, x1: afterMove.player.x,
  fired: afterFire.boss.hp < bossScreen.hp, bossHpBefore: bossScreen.hp, bossHpAfter: afterFire.boss.hp,
  dash: afterDash.player.dashCd > 0 || afterDash.player.dashT > 0,
  barrier: afterBarrier.player.barrierT > 0,
  paused: pausedState.paused, freeze: pa.x === pb.x && pa.boss === pb.boss,
  resumed: !afterPause.paused,
  muteBefore, muteOn, muteOff,
  restarted: afterRestart.mode === 'forge' && afterRestart.bossIndex === 0,
  audit,
};
const pageErrors = {
  errors: audit.errors, warnings: audit.warnings, pageerrors: audit.pageerrors,
  external: audit.external,
};
await page.close();
await browser.close();

const report = { rounds, smoke, pageErrors };
fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify({
  rounds: rounds.map(r => ({ round: r.round, pass: r.pass, fail: r.fail, total: r.total, done: r.done, failures: r.failures, console: r.audit, booterr: r.extra.booterr, net: r.extra.net })),
  smoke,
  pageErrors,
}, null, 2));
