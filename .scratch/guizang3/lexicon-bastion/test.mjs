import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire('/tmp/pw/node_modules/');
const { chromium } = require('playwright');

const BASE = 'http://localhost:8622/lexicon-bastion/';
const OUT = '/mnt/tos/workspace/.scratch/guizang3/lexicon-bastion/';
const browser = await chromium.launch({ executablePath: '/usr/local/bin/chromium', args: ['--no-sandbox', '--use-gl=swiftshader'] });
const rounds = [];

function collect(page) {
  const errors = [], requests = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push({ type: m.type(), text: m.text() }); });
  page.on('pageerror', e => errors.push({ type: 'pageerror', text: String(e) }));
  page.on('request', r => requests.push(r.url()));
  return { errors, requests };
}
const externalOf = reqs => reqs.filter(u => !u.startsWith('http://localhost:8622') && !u.startsWith('data:') && !u.startsWith('blob:'));

// ---- two autotest rounds ----
for (let round = 1; round <= 2; round++) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const { errors, requests } = collect(page);
  await page.goto(BASE + '?autotest=1', { waitUntil: 'load' });
  await page.waitForFunction('window.__TEST && window.__TEST.done', { timeout: 180000 });
  const test = await page.evaluate('window.__TEST');
  const state = await page.evaluate('window.__G.state()');
  const external = externalOf(requests);
  await page.screenshot({ path: OUT + `autotest-round${round}.png` });
  const failed = (test.results || []).filter(r => !r.ok);
  rounds.push({
    round, pass: test.pass, fail: test.fail, total: test.total, done: test.done, crash: test.crash || null,
    failed, errors, external, finalMode: state.mode, muted: state.muted, nan: state.nan,
  });
  await page.close();
}

// ---- direct load without query params ----
const direct = await browser.newPage({ viewport: { width: 1024, height: 768 } });
const dc = collect(direct);
await direct.goto(BASE, { waitUntil: 'load' });
await direct.waitForTimeout(700);
const directState = await direct.evaluate(`({ boot: (window.__BOOTERR||[]).length, hasG: !!window.G, title: !document.getElementById('title').classList.contains('hide'), mode: window.G && window.G.state().mode })`);
const directExternal = externalOf(dc.requests);
await direct.close();

// ---- real desktop keyboard / pointer smoke ----
const desk = await browser.newPage({ viewport: { width: 1024, height: 768 } });
const dk = collect(desk);
await desk.goto(BASE, { waitUntil: 'load' });
await desk.click('#startbtn');
await desk.waitForTimeout(250);
// pause with a real key before enemies spawn
await desk.keyboard.press('KeyP');
await desk.waitForTimeout(150);
const pausedByKey = await desk.evaluate('window.G.state().paused');
await desk.waitForTimeout(250);
const frozenY = await desk.evaluate('window.G.state().enemyCount');
await desk.keyboard.press('KeyP');
await desk.waitForTimeout(150);
const resumedByKey = await desk.evaluate('window.G.state().paused');
// wait for an enemy then type its word with real keystrokes
await desk.waitForFunction('window.G.enemies().some(e => e.alive && e.y > 90)', { timeout: 9000 });
const target = await desk.evaluate(`(() => {
  const es = window.G.enemies().filter(e => e.alive && e.y > 90);
  es.sort((a,b)=>b.y-a.y);
  const e = es[0];
  return e ? { id: e.id, word: e.word, pos: window.G.screenPos(e.id) } : null;
})()`);
const targetWord = target.word;
// real pointer: click the on-canvas enemy to lock it
await desk.mouse.click(target.pos.x, target.pos.y);
await desk.waitForTimeout(130);
const lockedByPointer = await desk.evaluate('window.G.state().lockId');
await desk.keyboard.type(targetWord, { delay: 22 });
await desk.waitForTimeout(350);
const afterType = await desk.evaluate('window.G.state()');
// mute with a real M key while the field is quiet
await desk.evaluate('window.G.wipeEnemies()');
await desk.keyboard.press('KeyM');
await desk.waitForTimeout(120);
const mutedByKey = await desk.evaluate('window.G.state().muted');
await desk.keyboard.press('KeyM');
// restart with a real R key
await desk.keyboard.press('KeyR');
await desk.waitForTimeout(200);
const afterRestart = await desk.evaluate('window.G.state()');
// pause button
await desk.click('#btnPause');
await desk.waitForTimeout(100);
const pausedByBtn = await desk.evaluate('window.G.state().paused');
await desk.click('#pauseResume');
await desk.waitForTimeout(80);
const resumedByBtn = await desk.evaluate('window.G.state().paused');
await desk.screenshot({ path: OUT + 'desktop-input.png' });
const deskExternal = externalOf(dk.requests);
const desktop = {
  targetWord, lockedByPointer, targetId: target.id, pausedByKey, resumedByKey, frozenEnemyCount: frozenY,
  afterType: { kills: afterType.kills, wordsDone: afterType.wordsDone, score: afterType.score, combo: afterType.maxCombo, accuracy: afterType.accuracy, wpm: afterType.wpm },
  mutedByKey, afterRestart: { wave: afterRestart.wave, score: afterRestart.score, hp: afterRestart.hp, mode: afterRestart.mode },
  pausedByBtn, resumedByBtn, errors: dk.errors, external: deskExternal,
};
await desk.close();

// ---- portrait touch smoke ----
const mob = await browser.newPage({ viewport: { width: 430, height: 820 }, isMobile: true, hasTouch: true });
const mk = collect(mob);
await mob.goto(BASE, { waitUntil: 'load' });
await mob.tap('#startbtn');
await mob.waitForFunction('window.G.state().enemyCount > 0', { timeout: 9000 });
const mobileWord = await mob.evaluate(`(() => {
  const es = window.G.enemies().filter(e => e.alive);
  es.sort((a,b)=>b.y-a.y);
  return es[0] ? es[0].word : null;
})()`);
await mob.tap('#vkToggle');
await mob.waitForTimeout(120);
const vkbVisible = await mob.evaluate(`document.getElementById('vkb').classList.contains('show')`);
await mob.tap(`#vkb .vkbtn[data-ch="${mobileWord[0]}"]`);
await mob.waitForTimeout(180);
const afterVK = await mob.evaluate(`(() => { const s = window.G.state(); const e = s.lockId ? window.G.enemyInfo(s.lockId) : null; return { typed: e ? e.typed : 0, lockId: s.lockId, wordsDone: s.wordsDone }; })()`);
// in-page input field drives the system-keyboard path
await mob.tap('#typefield');
await mob.keyboard.type(mobileWord[1] || 'a');
await mob.waitForTimeout(180);
const afterField = await mob.evaluate(`(() => { const s = window.G.state(); const e = s.lockId ? window.G.enemyInfo(s.lockId) : null; return { typed: e ? e.typed : 0, lockId: s.lockId }; })()`);
await mob.tap('#tPause');
await mob.waitForTimeout(120);
const pausedByTouch = await mob.evaluate('window.G.state().paused');
await mob.tap('#pauseResume');
await mob.waitForTimeout(100);
await mob.tap('#tMute');
await mob.waitForTimeout(120);
const mutedByTouch = await mob.evaluate('window.G.state().muted');
await mob.tap('#tRestart');
await mob.waitForTimeout(300);
const afterTouchRestart = await mob.evaluate('window.G.state()');
await mob.screenshot({ path: OUT + 'mobile-input.png' });
const mobile = {
  mobileWord, vkbVisible, afterVK, afterField, pausedByTouch, mutedByTouch,
  afterTouchRestart: { wave: afterTouchRestart.wave, score: afterTouchRestart.score, hp: afterTouchRestart.hp,
    mode: afterTouchRestart.mode, accuracy: afterTouchRestart.accuracy, wpm: afterTouchRestart.wpm, muted: afterTouchRestart.muted },
  errors: mk.errors, external: externalOf(mk.requests),
};
await mob.close();

const report = { rounds, direct: { state: directState, errors: dc.errors, external: directExternal }, desktop, mobile };
fs.writeFileSync(OUT + 'audit.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await browser.close();
