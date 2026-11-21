import { createRequire } from 'module';
const require = createRequire('/tmp/pw/node_modules/');
const { chromium } = require('playwright');
const OUT = '/mnt/tos/workspace/.scratch/guizang3/silkline-swing/';
const BASE = 'http://localhost:8621/silkline-swing/';
const browser = await chromium.launch({ headless: true, executablePath: '/usr/local/bin/chromium', args: ['--no-sandbox', '--use-gl=swiftshader'] });
const isLocal = (u) => u.startsWith('http://localhost:8621') || u.startsWith('data:') || u.startsWith('blob:');
const results = { rounds: [] };

// ---------- two rounds of the in-page suite ----------
for (let round = 1; round <= 2; round++) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  const errors = [], warnings = [], pageerrors = [], requests = [];
  page.on('console', m => {
    if (m.type() === 'error') errors.push(m.text());
    if (m.type() === 'warning') warnings.push(m.text());
  });
  page.on('pageerror', e => pageerrors.push(String(e)));
  page.on('request', r => requests.push(r.url()));
  await page.goto(BASE + '?autotest=1', { waitUntil: 'load' });
  await page.waitForFunction('window.__TEST && window.__TEST.done', { timeout: 180000 });
  const t = await page.evaluate('window.__TEST');
  const st = await page.evaluate('window.G.state()');
  const external = requests.filter(u => !isLocal(u));
  await page.screenshot({ path: OUT + `autotest-round${round}.png` });
  results.rounds.push({
    round, pass: t.pass, fail: t.fail, total: t.total, done: t.done,
    failed: (t.results || []).filter(r => !r.ok),
    errors, warnings, pageerrors, external, finalMode: st.mode, nan: st.nan,
    storageRestored: await page.evaluate(() => ({ stars: localStorage.getItem('sls2.stars'), unlocked: localStorage.getItem('sls2.unlocked'), best: localStorage.getItem('sls2.best') })),
  });
  await ctx.close();
}

// ---------- direct load, no parameters ----------
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  const errors = [], warnings = [], pageerrors = [], requests = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); if (m.type() === 'warning') warnings.push(m.text()); });
  page.on('pageerror', e => pageerrors.push(String(e)));
  page.on('request', r => requests.push(r.url()));
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForTimeout(900);
  const st = await page.evaluate('window.G.state()');
  const titleVisible = await page.evaluate("!document.getElementById('title').classList.contains('hidden')");
  await page.screenshot({ path: OUT + 'title-final.png' });
  results.direct = {
    mode: st.mode, titleVisible, errors, warnings, pageerrors,
    external: requests.filter(u => !isLocal(u)),
    net: st.net, bootErr: await page.evaluate('window.__BOOTERR.length'),
  };
  await ctx.close();
}

// ---------- real keyboard + mouse smoke ----------
{
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  const page = await ctx.newPage();
  const errors = [], warnings = [], pageerrors = [], requests = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); if (m.type() === 'warning') warnings.push(m.text()); });
  page.on('pageerror', e => pageerrors.push(String(e)));
  page.on('request', r => requests.push(r.url()));
  await page.goto(BASE, { waitUntil: 'load' });
  await page.click('#startbtn');
  await page.waitForTimeout(180);
  const s0 = await page.evaluate('G.state()');
  await page.keyboard.down('Space');
  await page.waitForTimeout(450);
  const s1 = await page.evaluate('G.state()');
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(500);
  const s2 = await page.evaluate('G.state()');
  await page.keyboard.up('KeyD');
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(320);
  const s3 = await page.evaluate('G.state()');
  await page.keyboard.up('KeyW');
  await page.keyboard.up('Space');
  await page.waitForTimeout(140);
  const s4 = await page.evaluate('G.state()');
  await page.keyboard.press('KeyP');
  await page.waitForTimeout(80);
  const p0 = await page.evaluate('G.state()');
  await page.waitForTimeout(380);
  const p1 = await page.evaluate('G.state()');
  await page.keyboard.press('KeyP');
  await page.keyboard.press('KeyR');
  await page.waitForTimeout(120);
  const sr = await page.evaluate('G.state()');
  await page.keyboard.press('KeyM');
  await page.waitForTimeout(90);
  const sm = await page.evaluate('G.state()');
  await page.mouse.move(620, 380);
  await page.mouse.down();
  await page.waitForTimeout(320);
  const mm = await page.evaluate('G.state()');
  await page.mouse.up();
  await page.waitForTimeout(100);
  const mm2 = await page.evaluate('G.state()');
  await page.screenshot({ path: OUT + 'desktop-input.png' });
  results.input = {
    start: { mode: s0.mode, audioCtx: s0.audioCtx },
    grab: { anchor: s1.player.anchor, L: s1.player.L },
    pump: { vx: s2.player.vx, speed: s2.player.speed },
    reel: { L: s3.player.L },
    release: { anchor: s4.player.anchor },
    pause: { paused: p0.paused, frozen: p0.player.x === p1.player.x && p0.player.y === p1.player.y && p0.time === p1.time },
    restart: { mode: sr.mode, time: sr.time, lives: sr.lives, shards: sr.shards },
    mute: sm.muted,
    mouse: { anchor: mm.player.anchor, after: mm2.player.anchor },
    errors, warnings, pageerrors, external: requests.filter(u => !isLocal(u)),
  };
  await ctx.close();
}

// ---------- touch / portrait ----------
{
  const ctx = await browser.newContext({ viewport: { width: 430, height: 820 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errors = [], warnings = [], pageerrors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); if (m.type() === 'warning') warnings.push(m.text()); });
  page.on('pageerror', e => pageerrors.push(String(e)));
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForTimeout(400);
  await page.screenshot({ path: OUT + 'mobile-title.png' });
  await page.tap('#startbtn');
  await page.waitForTimeout(220);
  const touchVisible = await page.evaluate("document.getElementById('touch').classList.contains('on')");
  await page.evaluate(() => document.getElementById('tgrab').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch' })));
  await page.waitForTimeout(480);
  const grabbed = await page.evaluate('G.state().player.anchor');
  await page.evaluate(() => document.getElementById('tright').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch' })));
  await page.waitForTimeout(380);
  const vx = await page.evaluate('G.state().player.vx');
  await page.evaluate(() => {
    document.getElementById('tright').dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerType: 'touch' }));
    document.getElementById('tgrab').dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerType: 'touch' }));
  });
  await page.waitForTimeout(120);
  const released = await page.evaluate('G.state().player.anchor');
  await page.screenshot({ path: OUT + 'mobile-play.png' });
  results.mobile = { touchVisible, grabbed, vx, released, errors, warnings, pageerrors };
  await ctx.close();
}

// ---------- representative gameplay frame (thumbnail source) ----------
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  const errors = [], warnings = [], pageerrors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); if (m.type() === 'warning') warnings.push(m.text()); });
  page.on('pageerror', e => pageerrors.push(String(e)));
  await page.goto(BASE + '?autostart=1&level=14&shot=gate', { waitUntil: 'load' });
  await page.waitForTimeout(700);
  const st = await page.evaluate('G.state()');
  await page.screenshot({ path: OUT + 'gameplay-final.png' });
  results.gameplay = { level: st.level, mode: st.mode, anchor: st.player.anchor, speed: st.player.speed, shards: st.shards, errors, warnings, pageerrors };
  await ctx.close();
}

// ---------- site bridge / iframe envelope ----------
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const logs = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text()); });
  await page.setContent(`<!doctype html><html><body style="margin:0;background:#111"><iframe src="${BASE}?level=1" style="width:1000px;height:620px;border:0"></iframe><script>window.msgs=[];addEventListener('message',e=>window.msgs.push(e.data));</script></body></html>`);
  const frame = page.frames().find(f => f.url().includes('silkline-swing'));
  await frame.waitForFunction('window.G && window.G.state');
  await page.waitForTimeout(500);
  const bridges = await frame.evaluate(() => ({ goHome: typeof goHome, clickMore: typeof clickMore, dp_share: typeof dp_share, submit: typeof play68_submitScore, share: typeof show_share }));
  await frame.evaluate('G.setShards(3);G.setTime(18);G.forceWin();');
  await page.waitForTimeout(200);
  const progressFrame = (await page.evaluate('window.msgs')).find(m => m.payload && m.payload.kind === 'progress');
  await frame.evaluate('G.startLevel(1);G.forceFail("abyss");');
  await page.waitForTimeout(200);
  const overFrame = (await page.evaluate('window.msgs')).find(m => m.payload && m.payload.kind === 'gameOver');
  results.bridge = { bridges, progressFrame: progressFrame && progressFrame.payload, overFrame: overFrame && overFrame.payload, logs };
  await page.close();
}

console.log(JSON.stringify(results, null, 2));
await browser.close();
