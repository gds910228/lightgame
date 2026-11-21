// Silkline Swing 丝线荡跃 — main loop, input, level flow, site bridge,
// G debug hooks and the ?autotest=1 verification suite.
import { P, makePlayer, stepPlayer, respawn, chooseAnchor, anchorPos,
  probeStep, probeControl, probeRoute } from './physics.js';
import { LEVELS, LEVEL_COUNT, instantiateLevel, ratingFor } from './levels.js';
import { makeRenderer, W } from './render.js';
import { makeAudio } from './audio.js';
import { makeUI } from './ui.js';

const DT = 1 / 60;
const SLS = 'sls2.';
const STORE = { stars: SLS + 'stars', unlocked: SLS + 'unlocked', best: SLS + 'best', total: SLS + 'total', mute: SLS + 'mute' };
const AUTOTEST = new URLSearchParams(location.search).has('autotest');
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// ==================== state ====================
let mode = 'title';            // title | play | end
let paused = false, noAuto = false, testMode = false;
let levelN = 1;
let level, pl;
let lives = 3, shards = 0, levelTime = 0;
let deathT = 0, levelDone = false, completeDelay = 0;
let respawnPoint = { x: 0, y: 0 }, lastCheckpoint = -1;
let camX = 0, camY = 0;
let visualT = 0, hitstop = 0, shakeT = 0, shakeAmp = 0;
let particles = [], floats = [], trail = [];
let starsByLevel = {}, unlocked = 1, totalStars = 0, best = 0, muted = false;
let reportTarget = null;
const reports = [];
let lastProgressT = -99;
let lastFrame = 0, acc = 0;
let simGrab = false, simDir = 0, simReel = 0;
let mouseDown = false;
let autoGrabT = 0;
const keys = new Set(), pressed = new Set();

// DOM / systems
const canvas = document.getElementById('gl');
const renderer = makeRenderer(canvas);
const audio = makeAudio();
const ui = makeUI({
  onStart: () => startFromTitle(),
  onLevel: (n) => { if (n <= unlocked) startLevel(n); },
  onRetry: () => startLevel(levelN),
  onNext: () => { if (levelN < LEVEL_COUNT) startLevel(levelN + 1); else toTitle(); },
  onHome: () => toTitle(),
  onMute: () => toggleMute(),
  onPause: () => togglePause(),
  onRestart: () => restartLevel(),
});

function bootAudio() {
  if (AUTOTEST) return;
  try {
    if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
  } catch (e) { }
  audio.ensure();
}

// ==================== storage ====================
function loadProgress() {
  starsByLevel = {};
  try {
    const raw = JSON.parse(localStorage.getItem(STORE.stars) || '{}');
    for (let i = 1; i <= LEVEL_COUNT; i++) {
      const v = Number(raw && raw[i]);
      if (Number.isInteger(v) && v >= 0 && v <= 3) starsByLevel[i] = v;
    }
  } catch (e) { }
  try { unlocked = clamp(parseInt(localStorage.getItem(STORE.unlocked) || '1', 10) || 1, 1, LEVEL_COUNT); } catch (e) { unlocked = 1; }
  recalcTotal();
  try { best = Math.max(totalStars, parseInt(localStorage.getItem(STORE.best) || '0', 10) || 0); } catch (e) { best = totalStars; }
  try { muted = localStorage.getItem(STORE.mute) === '1'; } catch (e) { muted = false; }
}
function recalcTotal() {
  totalStars = 0;
  for (let i = 1; i <= LEVEL_COUNT; i++) totalStars += starsByLevel[i] || 0;
}
function saveProgress() {
  try {
    localStorage.setItem(STORE.stars, JSON.stringify(starsByLevel));
    localStorage.setItem(STORE.unlocked, String(unlocked));
    localStorage.setItem(STORE.best, String(best));
    localStorage.setItem(STORE.total, String(totalStars));
  } catch (e) { }
}
function storageSnapshot() {
  const o = {};
  for (const k of Object.values(STORE)) { try { o[k] = localStorage.getItem(k); } catch (e) { o[k] = null; } }
  return o;
}
function restoreStorage(snap) {
  for (const k of Object.values(STORE)) {
    try {
      if (!snap || snap[k] == null) localStorage.removeItem(k);
      else localStorage.setItem(k, snap[k]);
    } catch (e) { }
  }
  loadProgress();
  ui.setMute(muted);
  audio.setMuted(muted);
  if (mode === 'title') ui.showTitle(true, progressSnapshot(), clamp(unlocked, 1, LEVEL_COUNT));
}
loadProgress();
audio.setMuted(muted);
ui.setMute(muted);

// ==================== protocol bridge ====================
function toWireReport(frame) {
  const score = Number.isFinite(frame.score) ? Math.round(frame.score) : undefined;
  if (frame.kind === 'progress') return { kind: 'progress', data: { ...frame } };
  if (frame.kind === 'event') return { kind: 'event', event: String(frame.event || frame.tag || 'event'), data: { ...frame } };
  if (frame.kind === 'gameOver') return {
    kind: 'gameOver', score,
    progress: (frame.progress && typeof frame.progress === 'object') ? frame.progress : { value: frame.progress },
    data: { ...frame },
  };
  if (frame.kind === 'complete') return { kind: 'complete', score };
  return frame;
}
function report(kind, payload = {}) {
  const frame = { kind, ...payload };
  reports.push(frame);
  try {
    if (reportTarget) reportTarget(frame);
    else if (window.parent !== window) {
      window.parent.postMessage({ source: 'lightgame', type: 'lightgame:report', payload: toWireReport(frame) }, '*');
      if (frame.kind === 'ready') {
        window.parent.postMessage({ source: 'lightgame', type: 'lightgame:ready', gameId: 'silkline-swing', v: 1 }, '*');
      }
    }
  } catch (e) { }
}
report('ready', { game: 'silkline-swing', version: '1.0.0' });

// ==================== scoring ====================
function scoreNow() {
  return Math.round(totalStars * 100 + unlocked * 10 + levelN * 3 + shards);
}

// ==================== level flow ====================
function startFromTitle() {
  bootAudio();
  audio.sfx.ui();
  const n = clamp(unlocked, 1, LEVEL_COUNT);
  startLevel(n);
}
function startLevel(n) {
  bootAudio();
  levelN = clamp(n | 0, 1, LEVEL_COUNT);
  level = instantiateLevel(levelN);
  pl = makePlayer(level);
  lives = 3; shards = 0; levelTime = 0;
  deathT = 0; levelDone = false; completeDelay = 0;
  hitstop = 0; shakeT = 0; shakeAmp = 0; autoGrabT = 0;
  respawnPoint = { x: level.start.x, y: level.start.y };
  lastCheckpoint = -1;
  particles = []; floats = []; trail = [];
  camX = clamp(pl.x - W * 0.4, 0, Math.max(0, level.worldW - W));
  camY = 0;
  mode = 'play'; paused = false;
  simGrab = false; simDir = 0; simReel = 0; mouseDown = false;
  keys.clear(); pressed.clear();
  ui.showTitle(false); ui.showEnd(false); ui.showHud(true); ui.setPause(false);
  ui.showTouch(ui.isTouch()); ui.setPause(false);
  ui.el.guide.style.display = '';
  ui.hideBanner();
  ui.setHud({ chapter: `第${['一', '二', '三'][level.chapter - 1]}章 · ${level.chapterName}`, name: level.name, level: levelN, shards: 0, lives: 3, time: 0, totalStars });
  ui.banner(`第 ${levelN} 关 · ${level.name}`, `收齐 3 颗星屑 · 穿过星门`, 1900);
  audio.state('play');
  report('event', { event: 'levelStart', level: levelN, score: scoreNow() });
}
function toTitle() {
  mode = 'title'; paused = false; deathT = 0; levelDone = false;
  keys.clear(); pressed.clear(); simGrab = false; mouseDown = false;
  ui.showTitle(true, progressSnapshot(), clamp(unlocked, 1, LEVEL_COUNT));
  ui.showEnd(false);
  hidePlayChrome();
  ui.setPause(false);
  audio.state('calm');
  if (!level) { level = instantiateLevel(1); pl = makePlayer(level); }
}
function hidePlayChrome() {
  ui.showHud(false);
  ui.hideBanner();
  ui.showTouch(false);
  ui.el.guide.style.display = 'none';
  ui.el.toast.classList.remove('show');
}
function progressSnapshot() {
  recalcTotal();
  return { starsByLevel: { ...starsByLevel }, unlocked, totalStars, best };
}
function restartLevel() {
  if (mode === 'title') return;
  audio.sfx.ui();
  ui.toast('重开本关');
  startLevel(levelN);
}
function nextLevelAfterEnd() {
  if (levelN < LEVEL_COUNT) startLevel(levelN + 1);
  else toTitle();
}

function completeLevel() {
  if (mode !== 'play' || levelDone) return;
  levelDone = true; mode = 'end';
  const stars = ratingFor(level, shards, levelTime);
  const prev = starsByLevel[levelN] || 0;
  if (stars > prev) starsByLevel[levelN] = stars;
  unlocked = Math.max(unlocked, Math.min(LEVEL_COUNT, levelN + 1));
  recalcTotal();
  if (totalStars > best) best = totalStars;
  saveProgress();
  const sc = scoreNow();
  report('progress', { score: sc, progress: levelN, level: levelN, stars, shards, time: +levelTime.toFixed(1) });
  report('event', { event: 'levelClear', level: levelN, stars, score: sc });
  let allClear = true;
  for (let i = 1; i <= LEVEL_COUNT; i++) if (!(starsByLevel[i] >= 1)) { allClear = false; break; }
  if (levelN === LEVEL_COUNT || allClear) report('complete', { score: sc });
  audio.sfx.gate(); audio.state('win');
  addShake(10, 0.5);
  burst(pl.x, pl.y, 36, '#ffd08a', 320, 1.0);
  burst(level.gate.x, level.gate.y, 26, '#b6ffe8', 220, 0.9);
  hidePlayChrome();
  ui.setPause(false);
  ui.endPanel({
    kick: levelN === LEVEL_COUNT ? 'JOURNEY COMPLETE' : 'LEVEL CLEAR',
    heading: levelN === LEVEL_COUNT ? '灯河已渡' : '星门已渡',
    reason: `${level.name} · 收集 ${shards}/3 星屑 · 用时 ${levelTime.toFixed(1)}s`,
    stars, shards, time: levelTime, totalStars,
    canNext: levelN < LEVEL_COUNT,
    nextLabel: '下一关',
  });
}
function failLevel(reason) {
  if (mode !== 'play' || levelDone) return;
  levelDone = true; mode = 'end'; deathT = 0;
  audio.sfx.fail(); audio.state('calm');
  const sc = scoreNow();
  report('gameOver', { score: sc, progress: levelN, level: levelN, shards, time: +levelTime.toFixed(1), reason: reason || 'life' });
  hidePlayChrome();
  ui.setPause(false);
  ui.endPanel({
    kick: 'SILK BROKEN',
    heading: '丝线断了',
    reason: `${level.name} · ${reasonText(reason)} · 已收 ${shards}/3 星屑`,
    stars: 0, shards, time: levelTime, totalStars, canNext: false,
  });
}
function reasonText(r) {
  return r === 'spike' ? '被尖刺割断' : r === 'abyss' ? '坠入深渊' : r === 'frail' ? '脆丝崩断' : '生命耗尽';
}

// ==================== effects ====================
function addShake(amp, dur) { shakeAmp = Math.max(shakeAmp, amp); shakeT = Math.max(shakeT, dur || 0.25); }
function burst(x, y, n, color, spd = 180, life = 0.7, kind = 'dot') {
  if (particles.length > 260) return;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, v = spd * (0.3 + Math.random() * 0.8);
    particles.push({
      x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - spd * 0.15,
      life: life * (0.6 + Math.random() * 0.6), maxLife: life,
      size: 1 + Math.random() * (kind === 'line' ? 2.2 : 2.6), color, kind,
    });
  }
  if (particles.length > 260) particles.splice(0, particles.length - 260);
}
function floatText(x, y, text, color = '#b6ffe8', size = 16) {
  floats.push({ x, y, text, color, size, life: 1.0, maxLife: 1.0 });
  if (floats.length > 20) floats.shift();
}
function updateFX(dt) {
  for (const p of particles) {
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vy += 260 * dt; p.vx *= (1 - 1.6 * dt);
    p.life -= dt;
  }
  particles = particles.filter(p => p.life > 0);
  for (const f of floats) { f.y -= 28 * dt; f.life -= dt; }
  floats = floats.filter(f => f.life > 0);
  if (shakeT > 0) { shakeT = Math.max(0, shakeT - dt); if (shakeT <= 0) shakeAmp = 0; }
}
function getShake() {
  if (shakeT <= 0) return 0;
  return shakeAmp * Math.min(1, shakeT / 0.28);
}

// ==================== update ====================
function handleOneShots() {
  if (pressed.has('KeyP')) { pressed.delete('KeyP'); togglePause(); }
  if (pressed.has('KeyM')) { pressed.delete('KeyM'); toggleMute(); }
  if (pressed.has('KeyR')) { pressed.delete('KeyR'); if (mode === 'play' || mode === 'end') restartLevel(); }
  if (pressed.has('Enter')) {
    pressed.delete('Enter');
    if (mode === 'title') startFromTitle();
    else if (mode === 'end') { if (levelDone && lives <= 0) startLevel(levelN); else nextLevelAfterEnd(); }
  }
  if (pressed.has('Escape')) { pressed.delete('Escape'); if (mode === 'play') togglePause(); }
}

function gatherInput() {
  const ts = ui.touchState();
  let grab = simGrab || mouseDown || keys.has('Space') || ts.grab || autoGrabT > 0;
  let dir = simDir;
  if (keys.has('KeyA') || keys.has('ArrowLeft') || ts.left) dir -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight') || ts.right) dir += 1;
  dir = clamp(dir, -1, 1);
  let reel = simReel;
  if (keys.has('KeyW') || keys.has('ArrowUp') || ts.in) reel -= 1;
  if (keys.has('KeyS') || keys.has('ArrowDown') || ts.out) reel += 1;
  reel = clamp(reel, -1, 1);
  return { grab, dir, reel };
}

function update(dt) {
  visualT += dt;
  audio.tick(dt);
  handleOneShots();
  if (mode !== 'play') { updateFX(dt); return; }
  if (paused) return;
  if (hitstop > 0) { hitstop -= dt; updateFX(dt); return; }
  if (deathT > 0) {
    deathT -= dt;
    updateFX(dt);
    if (deathT <= 0) doRespawn();
    return;
  }
  if (completeDelay > 0) { completeDelay -= dt; updateFX(dt); return; }
  if (autoGrabT > 0) autoGrabT = Math.max(0, autoGrabT - dt);

  levelTime += dt;
  const input = gatherInput();
  const ev = {
    grab: (a, i) => {
      audio.sfx.grab();
      const ap = anchorPos(a, pl.t);
      burst(ap.x, ap.y, 8, '#ffd08a', 120, 0.4);
      addShake(2.2, 0.16);
      trail.length = 0;
    },
    release: () => {
      audio.sfx.release();
      burst(pl.x, pl.y, 7, '#9ff5dc', 130, 0.35);
    },
    break: (a) => {
      audio.sfx.frail();
      const ap = anchorPos(a, pl.t);
      burst(ap.x, ap.y, 20, '#b6ffe8', 220, 0.7);
      burst(ap.x, ap.y, 10, '#e35d4c', 160, 0.5);
      addShake(12, 0.4); hitstop = 0.07;
      ui.toast('脆丝崩断');
    },
    shard: (sh) => {
      shards++;
      audio.sfx.shard();
      burst(sh.x, sh.y, 18, '#b6ffe8', 200, 0.7);
      burst(sh.x, sh.y, 8, '#ffd99a', 150, 0.6);
      floatText(sh.x, sh.y - 18, shards >= 3 ? '星屑集齐' : `星屑 ${shards}/3`);
      hitstop = 0.05; addShake(4, 0.2);
      ui.toast(shards >= 3 ? '三颗星屑已收齐，去星门！' : `星屑 ${shards}/3`);
    },
    gate: () => completeLevel(),
    death: (reason) => onDeath(reason),
  };
  stepPlayer(pl, level, input, dt, ev);
  if (mode !== 'play') { updateFX(dt); return; }

  // trail
  if (Math.hypot(pl.vx, pl.vy) > 120 || pl.anchor >= 0) {
    trail.push({ x: pl.x, y: pl.y });
    if (trail.length > 18) trail.shift();
  }

  // checkpoints
  for (const cp of level.checkpoints) {
    if (!cp.active && pl.x >= cp.triggerX && pl.alive) {
      cp.active = true;
      lastCheckpoint = level.checkpoints.indexOf(cp);
      respawnPoint = { x: cp.x, y: cp.y };
      audio.sfx.shard();
      burst(cp.x, cp.y, 14, '#6fe3c4', 150, 0.7);
      floatText(cp.x, cp.y - 20, '检查点', '#b6ffe8', 14);
      ui.toast('丝结已记 · 检查点');
    }
  }

  // camera smoothing
  const targetX = clamp(pl.x - W * 0.4 + pl.vx * 0.06, 0, Math.max(0, level.worldW - W));
  camX += (targetX - camX) * Math.min(1, dt * 5.5);

  updateFX(dt);

  if (mode === 'play' && Math.floor(levelTime * 10) !== lastProgressT) {
    lastProgressT = Math.floor(levelTime * 10);
    ui.setHud({
      chapter: `第${['一', '二', '三'][level.chapter - 1]}章 · ${level.chapterName}`,
      name: level.name, level: levelN, shards, lives, time: levelTime, totalStars,
    });
  }
}

function onDeath(reason) {
  if (mode !== 'play' || levelDone) return;
  lives--;
  audio.sfx.death();
  ui.flash(true);
  addShake(18, 0.55); hitstop = 0.09;
  burst(pl.x, pl.y, 30, '#e35d4c', 300, 0.9);
  burst(pl.x, pl.y, 14, '#ffd99a', 200, 0.7);
  floatText(pl.x, pl.y - 24, lives > 0 ? '丝断' : '生命耗尽', '#ff9a78', 18);
  if (lives <= 0) {
    deathT = 0;
    failLevel(reason);
    return;
  }
  deathT = noAuto ? 0.0001 : 0.55;
}
function doRespawn() {
  if (mode !== 'play') return;
  respawn(pl, respawnPoint.x, respawnPoint.y);
  if (lastCheckpoint >= 0) {
    const cp = level.checkpoints[lastCheckpoint];
    const a = level.anchors[cp.anchorIdx];
    if (a && !a.broken) {
      pl.anchor = cp.anchorIdx;
      const ap = anchorPos(a, pl.t);
      pl.L = clamp(Math.hypot(pl.x - ap.x, pl.y - ap.y), 120, 260);
      autoGrabT = 0.6;
    }
  }
  camX = clamp(pl.x - W * 0.4, 0, Math.max(0, level.worldW - W));
  trail.length = 0;
  audio.sfx.ui();
  ui.toast('回到检查点');
}

// ==================== UI actions ====================
function togglePause() {
  if (mode !== 'play') return;
  paused = !paused;
  ui.setPause(paused);
  if (paused) ui.banner('已暂停', '按 P 或点「续」继续', 0);
  else { ui.hideBanner(); lastFrame = performance.now(); }
}
function toggleMute() {
  muted = !muted;
  audio.setMuted(muted);
  ui.setMute(muted);
  try { localStorage.setItem(STORE.mute, muted ? '1' : '0'); } catch (e) { }
  audio.sfx.ui();
}

// ==================== input wiring ====================
addEventListener('keydown', (e) => {
  if (e.isTrusted) bootAudio();
  if (['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
  if (!e.repeat) pressed.add(e.code);
  keys.add(e.code);
}, { passive: false });
addEventListener('keyup', (e) => { keys.delete(e.code); });
addEventListener('blur', () => { keys.clear(); mouseDown = false; simGrab = false; });
document.addEventListener('visibilitychange', () => {
  lastFrame = performance.now();
  if (document.hidden && mode === 'play' && !paused) { paused = true; ui.setPause(true); ui.banner('已暂停', '页面隐藏时自动暂停', 0); }
});

canvas.addEventListener('pointerdown', (e) => {
  if (e.isTrusted) bootAudio();
  if (mode !== 'play' || paused) return;
  e.preventDefault();
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  mouseDown = true;
  try { canvas.setPointerCapture(e.pointerId); } catch (err) { }
});
const releasePointer = (e) => { mouseDown = false; };
canvas.addEventListener('pointerup', releasePointer);
canvas.addEventListener('pointercancel', releasePointer);
canvas.addEventListener('pointerleave', releasePointer);
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

// ==================== render ====================
function render() {
  if (!level || !pl) return;
  const candidate = (mode === 'play' && pl.anchor < 0 && !paused)
    ? chooseAnchor(pl, level, pl.t, pl.facing) : -1;
  const danger = deathT > 0 ? 0.9 : (mode === 'play' && pl.y > level.killY - 170 ? 0.35 : 0);
  renderer.draw({
    level, player: pl, camX, camY, time: visualT,
    particles, floats, trail, shake: getShake(),
    candidate, danger, paused,
  });
}

// ==================== main loop ====================
function frame(now) {
  requestAnimationFrame(frame);
  if (!lastFrame) lastFrame = now;
  let dt = (now - lastFrame) / 1000;
  lastFrame = now;
  if (!isFinite(dt) || dt < 0) dt = 0;
  dt = Math.min(dt, 0.1);
  if (!testMode) {
    acc += dt;
    let steps = 0;
    while (acc >= DT && steps < 5) { update(DT); acc -= DT; steps++; }
    if (acc > DT * 5) acc = 0;
  }
  render();
}
requestAnimationFrame(frame);

addEventListener('resize', () => renderer.resize());
renderer.resize();

// ==================== boot scenes / URL params ====================
level = instantiateLevel(1);
pl = makePlayer(level);
respawnPoint = { x: level.start.x, y: level.start.y };
camX = 0;
ui.showTitle(true, progressSnapshot(), clamp(unlocked, 1, LEVEL_COUNT));
ui.showHud(false);
ui.el.guide.style.display = 'none';

const params = new URLSearchParams(location.search);
if (params.has('autostart')) {
  const n = clamp(parseInt(params.get('level') || '1', 10) || 1, 1, LEVEL_COUNT);
  startLevel(n);
  const wantGate = params.get('shot') === 'gate';
  const bot = { pl, hold: 0, free: 0, target: 0, input: { grab: true, dir: 0, reel: 0 } };
  let used = 0;
  for (let i = 0; i < 1600; i++) {
    if (wantGate && pl.anchor >= 0 && pl.x > level.gate.x - 620 && Math.hypot(pl.vx, pl.vy) > 320) break;
    if (!wantGate && i >= 120) break;
    probeStep(bot, level, DT);
    used = i;
    if (mode !== 'play') break;
  }
  levelTime = used / 60;
  shards = level.shards.filter(s => s.got).length;
  camX = clamp(pl.x - W * 0.4, 0, Math.max(0, level.worldW - W));
  ui.setHud({ chapter: `第${['一', '二', '三'][level.chapter - 1]}章 · ${level.chapterName}`, name: level.name, level: levelN, shards, lives, time: levelTime, totalStars });
  ui.hideBanner();
  ui.el.guide.style.display = '';
  testMode = true;            // hold the representative frame for screenshots
} else if (params.has('level') && !AUTOTEST) {
  const n = clamp(parseInt(params.get('level') || '1', 10) || 1, 1, LEVEL_COUNT);
  startLevel(n);
  ui.el.guide.style.display = '';
} else if (!AUTOTEST) {
  ui.el.guide.style.display = 'none';
}

// ==================== G debug hooks ====================
const G = {
  err: window.__BOOTERR,
  step: (n = 60, dt = DT) => { for (let i = 0; i < n; i++) { update(dt); } render(); },
  upd: (n = 30, dt = DT) => { for (let i = 0; i < n; i++) update(dt); },
  press: (...codes) => codes.forEach(c => { pressed.add(c); keys.add(c); }),
  up: (...codes) => codes.forEach(c => keys.delete(c)),
  setNoAuto: (v) => { noAuto = !!v; },
  setReportTarget: (fn) => { reportTarget = typeof fn === 'function' ? fn : null; },
  state: () => ({
    mode, paused, noAuto, testMode,
    level: levelN, levelName: level ? level.name : '', chapter: level ? level.chapter : 1,
    lives, shards, time: +levelTime.toFixed(3), completeDelay: +completeDelay.toFixed(3),
    player: pl ? {
      x: +pl.x.toFixed(3), y: +pl.y.toFixed(3), vx: +pl.vx.toFixed(3), vy: +pl.vy.toFixed(3),
      anchor: pl.anchor, L: +pl.L.toFixed(3), alive: pl.alive, grounded: pl.grounded,
      facing: pl.facing, speed: +Math.hypot(pl.vx, pl.vy).toFixed(3), deathReason: pl.deathReason,
    } : null,
    rope: ropeInfo(),
    stars: starsByLevel[levelN] || 0, totalStars, starsByLevel: { ...starsByLevel }, unlocked, best,
    muted: audio.isMuted(), audioCtx: audio.hasCtx(), audioState: audio.state(),
    reports: reports.length, net: window.__NET ? { ...window.__NET } : null,
    nan: !pl || ![pl.x, pl.y, pl.vx, pl.vy, pl.L, levelTime, camX].every(Number.isFinite),
  }),
  startLevel: (n) => { startLevel(n); return levelN; },
  restartLevel: () => restartLevel(),
  toTitle: () => toTitle(),
  nextLevel: () => nextLevelAfterEnd(),
  forceWin: () => { completeLevel(); },
  forceFail: (reason) => { lives = 0; failLevel(reason || 'debug'); },
  setLives: (v) => { lives = clamp(v | 0, 0, 9); },
  setShards: (v) => { shards = clamp(v | 0, 0, 3); },
  setTime: (v) => { levelTime = Math.max(0, +v || 0); },
  setGrab: (v) => { simGrab = !!v; },
  setDir: (v) => { simDir = clamp(Math.sign(+v || 0), -1, 1); },
  setReel: (v) => { simReel = clamp(Math.sign(+v || 0), -1, 1); },
  setPlayer: (x, y, vx = 0, vy = 0) => {
    if (!pl) return;
    pl.x = +x; pl.y = +y; pl.vx = +vx; pl.vy = +vy; pl.alive = true; pl.anchor = -1; pl.L = 0;
  },
  attachTo: (i) => {
    if (!pl || !level || !level.anchors[i]) return false;
    pl.anchor = i;
    const ap = anchorPos(level.anchors[i], pl.t);
    pl.L = clamp(Math.hypot(pl.x - ap.x, pl.y - ap.y) * 0.8, 120, 330);
    pl.ignore = -1; pl.ignoreT = 0;
    return true;
  },
  releaseSilk: () => {
    if (!pl || pl.anchor < 0) return false;
    pl.ignore = pl.anchor; pl.ignoreT = 0.8; pl.anchor = -1;
    return true;
  },
  ropeInfo: () => ropeInfo(),
  anchorInfo: (i) => {
    if (!level || !level.anchors[i]) return null;
    const a = level.anchors[i];
    const ap = anchorPos(a, pl.t);
    return { index: i, x: +ap.x.toFixed(2), y: +ap.y.toFixed(2), type: a.type, broken: a.broken, fragT: +a.fragT.toFixed(2) };
  },
  chooseNow: () => pl ? chooseAnchor(pl, level, pl.t, pl.facing) : -1,
  anchorCount: () => level ? level.anchors.length : 0,
  levelConfigs: () => LEVELS.map(l => ({
    id: l.id, chapter: l.chapter, name: l.name, worldW: l.worldW,
    anchors: l.anchors.length, shards: l.shards.length, par: l.par,
    probe: { ...l.probe },
  })),
  computeStars: (s, t) => ratingFor(level || LEVELS[0], s, t),
  resetCheckpoints: () => { if (level) level.checkpoints.forEach(c => { c.active = false; }); lastCheckpoint = -1; },
  checkpointState: () => level ? level.checkpoints.map(c => ({ x: c.x, y: c.y, triggerX: c.triggerX, active: c.active })) : [],
  probeLevel: (n, maxT = 30) => {
    const l = instantiateLevel(n);
    return probeRoute(l, maxT);
  },
  autoRun: (n = 1, maxT = 30) => {
    startLevel(n); testMode = true;
    const bot = { pl, hold: 0, free: 0, target: 0, input: { grab: true, dir: 0, reel: 0 } };
    const frames = Math.round(maxT * 60);
    let i = 0;
    for (; i < frames && mode === 'play'; i++) {
      const inp = probeControl(bot, level, DT);
      simGrab = inp.grab; simDir = inp.dir; simReel = inp.reel;
      update(DT);
      hitstop = 0;                 // fast-forward: skip cosmetic hit-stop, keep the exact physics
    }
    simGrab = false; simDir = 0; simReel = 0;
    return { mode, level: n, shards, stars: starsByLevel[n] || 0, time: +levelTime.toFixed(2), frames: i };
  },
  probeAllLevels: (maxT = 30) => {
    const out = [];
    for (let i = 1; i <= LEVEL_COUNT; i++) {
      const l = instantiateLevel(i);
      const r = probeRoute(l, maxT);
      let nan = false;
      for (const s of l.shards) if (!Number.isFinite(s.x + s.y)) nan = true;
      out.push({ level: i, ok: r.ok, shards: r.shards, t: +r.t.toFixed(2), nan });
    }
    return out;
  },
  storageSnapshot, restoreStorage,
  reports: () => reports.slice(),
  clearReports: () => { reports.length = 0; },
  levels: LEVELS,
  P,
  audio,
  ui,
  renderer,
  addParticle: (x, y, color) => burst(x, y, 10, color || '#6fe3c4', 160, 0.7),
  testMode: (v) => { testMode = !!v; if (!v) lastFrame = performance.now(); },
  pauseNow: (v) => { paused = !!v; ui.setPause(paused); },
};
window.G = G;
window.__G = G;
window.addEventListener('error', (e) => {
  const s = String(e.message || e);
  if (G.err && !G.err.includes(s)) G.err.push(s);
});

// ==================== ?autotest=1 ====================
if (AUTOTEST) autotest();

async function autotest() {
  const nap = () => new Promise(r => { const mc = new MessageChannel(); mc.port1.onmessage = () => r(); mc.port2.postMessage(0); });
  const T = window.__TEST = { pass: 0, fail: 0, total: 0, results: [], done: false };
  const ok = (id, cond, msg = '') => {
    T.results.push({ id, ok: !!cond, name: msg, msg });
    cond ? T.pass++ : T.fail++;
    if (!cond) console.warn(`[autotest] FAIL ${id}: ${msg}`);
  };
  const R = (n, dt = DT) => { for (let i = 0; i < n; i++) update(dt); };
  G.setNoAuto(true);
  const snap = storageSnapshot();
  G.testMode(true);
  audio.setMuted(true);
  const readyFirst = reports.length > 0 && reports[0].kind === 'ready';

  try {
    await nap();
    ok('T1', G.err.length === 0 && !window.__TEST_ERR, `bootErr=${G.err.length}`);

    // deterministic fresh level
    startLevel(1);
    G.setGrab(false); G.setDir(0); G.setReel(0);
    ok('T2', mode === 'play' && levelN === 1 && lives === 3 && shards === 0 && levelTime === 0, `mode=${mode} lvl=${levelN}`);

    // T3 core math: rope length constraint
    pl.x = level.anchors[0].x - 80; pl.y = level.anchors[0].y + 60; pl.vx = 120; pl.vy = -40;
    G.setGrab(true); R(1);
    ok('T3a', pl.anchor >= 0, `anchor=${pl.anchor}`);
    R(90);
    let ap = anchorPos(level.anchors[pl.anchor], pl.t);
    let dist = Math.hypot(pl.x - ap.x, pl.y - ap.y);
    ok('T3b', Math.abs(dist - pl.L) < 1e-6, `dist=${dist.toFixed(6)} L=${pl.L.toFixed(6)}`);
    // radial velocity must be zero on the taut silk
    const nx = (pl.x - ap.x) / dist, ny = (pl.y - ap.y) / dist;
    const radial = pl.vx * nx + pl.vy * ny;
    ok('T3c', Math.abs(radial) < 1e-6, `radial=${radial.toExponential(2)}`);

    // T4 pump increases tangential speed and changes angle
    const sp0 = Math.hypot(pl.vx, pl.vy);
    const ang0 = Math.atan2(pl.x - ap.x, -(pl.y - ap.y));
    G.setDir(Math.sign(ropeInfo().tangential) || 1);
    R(45);
    const ang1 = Math.atan2(pl.x - ap.x, -(pl.y - ap.y));
    const sp1 = Math.hypot(pl.vx, pl.vy);
    ok('T4', sp1 > sp0 + 20 && Math.abs(ang1 - ang0) > 0.08, `speed ${sp0.toFixed(1)}→${sp1.toFixed(1)} angle Δ=${(ang1 - ang0).toFixed(3)}`);

    // T5 reel in shortens the line and keeps the constraint
    G.setReel(1); R(30); G.setReel(0);
    const L0 = pl.L;
    G.setReel(-1); R(30); G.setReel(0);
    const ap5 = anchorPos(level.anchors[pl.anchor], pl.t);
    const d5 = Math.hypot(pl.x - ap5.x, pl.y - ap5.y);
    ok('T5', pl.L < L0 - 120 && Math.abs(d5 - pl.L) < 1e-6, `L ${L0.toFixed(1)}→${pl.L.toFixed(1)} dist=${d5.toFixed(3)}`);

    // T6 release keeps the tangential velocity (inertia launch)
    G.setDir(0); G.setReel(0);
    const vRel = { x: pl.vx, y: pl.vy };
    const spRel = Math.hypot(vRel.x, vRel.y);
    G.setGrab(false); R(1);
    ok('T6', pl.anchor < 0 && Math.abs(pl.vx - vRel.x) < 1e-6 && Math.abs(pl.vy - (vRel.y + P.G * DT)) < 2,
      `anchor=${pl.anchor} v0=(${vRel.x.toFixed(2)},${vRel.y.toFixed(2)}) v1=(${pl.vx.toFixed(2)},${pl.vy.toFixed(2)})`);

    // T7 forward anchor priority: put player between a closer rear and a farther forward ring
    {
      const l = instantiateLevel(1);
      pl = makePlayer(l, 600, 400);
      // use real rings: nearest is behind by x, next is forward
      const rear = l.anchors.reduce((b, a, i) => (a.x < 600 && Math.abs(a.x - 600) < Math.abs(b.x - 600) ? a : b), l.anchors[0]);
      const fwd = l.anchors.find(a => a.x > 640);
      pl.x = rear.x + 180; pl.y = rear.y + 120;
      pl.facing = 1;
      const chosen = chooseAnchor(pl, l, 0, 1);
      ok('T7', chosen >= 0 && l.anchors[chosen].x > pl.x, `chosen x=${chosen >= 0 ? l.anchors[chosen].x.toFixed(0) : '-'} player=${pl.x.toFixed(0)}`);
      pl = makePlayer(level);
    }

    // T8 reach rejection
    {
      const l = instantiateLevel(1);
      const p = makePlayer(l, 60, 1200);
      ok('T8', chooseAnchor(p, l, 0, 1) === -1, 'no anchor within reach');
    }

    // T9 shard economy
    startLevel(1); G.testMode(true);
    const sc0 = scoreNow();
    const sh = level.shards[0];
    pl.x = sh.x; pl.y = sh.y; pl.vx = 0; pl.vy = 0;
    G.setGrab(false); R(1);
    ok('T9', shards === 1 && scoreNow() > sc0, `shards=${shards} score ${sc0}→${scoreNow()}`);
    // and the shard cannot be collected twice
    const sc1 = scoreNow(); pl.x = sh.x; pl.y = sh.y; R(2);
    ok('T9b', shards === 1 && scoreNow() === sc1, `no double collect shards=${shards}`);

    // T10 air control + input simulation through the real key path
    startLevel(1); G.testMode(true);
    pl.x = 400; pl.y = 200; pl.vx = 0; pl.vy = 0; pl.anchor = -1;
    G.press('KeyD'); R(30); G.up('KeyD');
    ok('T10', pl.vx > 50, `vx=${pl.vx.toFixed(1)}`);
    // Space grabs through the real input path
    pl.x = level.anchors[0].x - 60; pl.y = level.anchors[0].y + 80; pl.vx = 0; pl.vy = 0; pl.anchor = -1;
    G.press('Space'); R(1);
    const grabbed = pl.anchor >= 0;
    G.up('Space'); R(1);
    ok('T10b', grabbed && pl.anchor < 0, `grabbed=${grabbed} afterRelease=${pl.anchor}`);

    // T11 pause freezes position, rope and clock
    startLevel(1); G.testMode(true);
    G.setGrab(true); R(40);
    const px = pl.x, py = pl.y, pt = levelTime;
    G.press('KeyP'); R(30);
    ok('T11', paused && pl.x === px && pl.y === py && levelTime === pt, `paused=${paused} dx=${(pl.x - px).toFixed(3)}`);
    G.press('KeyP'); R(1);
    ok('T11b', !paused, 'resumed');

    // T12 spike hazard costs a life and respawns at the checkpoint/start
    startLevel(1); G.testMode(true);
    G.press('Space'); R(20); G.up('Space'); G.setGrab(false); R(40);
    const sp = level.spikes[0];
    pl.x = sp.x + sp.w / 2; pl.y = sp.y + 4; pl.vx = 0; pl.vy = 0; pl.anchor = -1; pl.ignore = -1; pl.ignoreT = 0;
    R(2);
    ok('T12', lives === 2 && mode === 'play', `lives=${lives} mode=${mode}`);
    // fast-forward the respawn timer
    R(60);
    ok('T12b', pl.alive && Math.hypot(pl.x - level.start.x, pl.y - level.start.y) < 30, `respawn d=${Math.hypot(pl.x - level.start.x, pl.y - level.start.y).toFixed(0)}`);

    // T13 abyss hazard
    startLevel(1); G.testMode(true);
    pl.x = 400; pl.y = level.killY + 10; R(1);
    ok('T13', lives === 2, `abyss death lives=${lives}`);

    // T14 failure path: third death -> end + gameOver report
    startLevel(1); G.testMode(true);
    G.clearReports();
    for (let k = 0; k < 3; k++) {
      pl.x = level.spikes[0].x + 4; pl.y = level.spikes[0].y + 4; R(1);
      R(80);
    }
    ok('T14', mode === 'end' && lives === 0, `mode=${mode} lives=${lives}`);
    ok('T14b', reports.some(f => f.kind === 'gameOver'), `kinds=${reports.map(r => r.kind).join(',')}`);
    ok('T14c', document.getElementById('end').classList.contains('show'), 'end panel shown');

    // T15 rating maths
    {
      const l = LEVELS[0];
      ok('T15', ratingFor(l, 1, 10) === 1 && ratingFor(l, 2, 10) === 2 &&
        ratingFor(l, 3, 10) === 3 && ratingFor(l, 3, l.par + 30) === 2,
        `1/2/3 star thresholds`);
    }

    // T16 victory path + unlock + progress report
    startLevel(1); G.testMode(true); G.clearReports();
    G.setShards(3); G.setTime(12);
    G.forceWin();
    ok('T16', mode === 'end' && (starsByLevel[1] || 0) === 3 && unlocked >= 2, `stars=${starsByLevel[1]} unlocked=${unlocked}`);
    ok('T16b', reports.some(f => f.kind === 'progress' && f.level === 1), 'progress frame');
    ok('T16c', parseInt(localStorage.getItem(STORE.unlocked) || '0', 10) >= 2, 'unlocked persisted');
    // flying physically through the gate (stepPlayer event) also completes
    startLevel(2); G.testMode(true); G.clearReports();
    G.setPlayer(level.gate.x, level.gate.y);
    R(1);
    ok('T16d', mode === 'end' && reports.some(f => f.kind === 'progress' && f.level === 2), `gate event mode=${mode}`);

    // T17 moving anchor moves over time
    {
      const l = instantiateLevel(9);
      const mv = l.anchors.find(a => a.type === 'moving');
      let moved = false;
      if (mv) {
        const p0 = anchorPos(mv, 0), p1 = anchorPos(mv, 1.4);
        moved = Math.hypot(p0.x - p1.x, p0.y - p1.y) > 1;
      }
      ok('T17', !!mv && moved, `moving anchors exist=${!!mv}`);
    }

    // T18 fragile silk snaps after its life and releases the player
    {
      let found = null, fi = -1;
      for (let i = 1; i <= LEVEL_COUNT && fi < 0; i++) {
        const l = instantiateLevel(i);
        const k = l.anchors.findIndex(a => a.type === 'fragile');
        if (k >= 0) { found = l; fi = k; }
      }
      const l = found || instantiateLevel(10);
      if (fi < 0) fi = 2;
      level = l; pl = makePlayer(l); mode = 'play'; levelN = l.id;
      lives = 3; shards = 0; levelTime = 0; deathT = 0; levelDone = false;
      const a = l.anchors[fi];
      if (a.type !== 'fragile') a.type = 'fragile';
      a.fragT = 0; a.broken = false;
      pl.x = a.x; pl.y = a.y + 100;
      G.setDir(0); G.setReel(0);
      G.setGrab(true); R(1);
      const held = pl.anchor === fi;
      R(170);
      ok('T18', held && a.broken && pl.anchor !== fi, `held=${held} broken=${a.broken} anchor=${pl.anchor} fragile=${fi}`);
      G.setGrab(false); G.setDir(0); G.setReel(0);
    }

    // T19 wind zone pushes the player
    {
      const l = instantiateLevel(8);
      pl = makePlayer(l); level = l; mode = 'play'; levelN = 8; deathT = 0; levelDone = false; lives = 3;
      const w = l.winds[0];
      if (w) {
        G.setGrab(false); G.setDir(0); G.setReel(0);
        pl.x = w.x + 40; pl.y = w.y + 40; pl.vx = 0; pl.vy = 0; pl.anchor = -1;
        const v0 = pl.vx;
        G.upd(20);
        ok('T19', pl.vx !== v0 && Math.sign(pl.vx) === Math.sign(w.vx), `wind vx=${(w.vx).toFixed(0)} player vx=${pl.vx.toFixed(1)}`);
      } else ok('T19', false, 'wind zone missing');
    }

    // T20 touch grab button drives the real hold input
    startLevel(1); G.testMode(true);
    pl.x = level.anchors[0].x - 70; pl.y = level.anchors[0].y + 80; pl.vx = 0; pl.vy = 0; pl.anchor = -1;
    const tg = document.getElementById('tgrab');
    tg.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch' }));
    R(1);
    const tGrab = pl.anchor >= 0;
    tg.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerType: 'touch' }));
    R(1);
    ok('T20', tGrab && pl.anchor < 0, `touchGrab=${tGrab} after=${pl.anchor}`);
    // touch direction + reel buttons
    const tr = document.getElementById('tright');
    tr.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch' }));
    const vx0 = pl.vx; R(20);
    tr.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerType: 'touch' }));
    ok('T20b', pl.vx > vx0, `touch right Δvx=${(pl.vx - vx0).toFixed(1)}`);

    // T21 restart resets the attempt
    G.setGrab(false); G.setDir(0); G.setReel(0);
    G.setShards(2); levelTime = 30; pl.anchor = 0;
    restartLevel(); G.testMode(true);
    ok('T21', shards === 0 && levelTime === 0 && lives === 3 && pl.anchor < 0, `shards=${shards} time=${levelTime} lives=${lives}`);

    // T22 full-level fast forward: every level route completes with all 3 shards, no NaN
    {
      const res = G.probeAllLevels(30);
      const bad = res.filter(r => !r.ok || r.shards < 3 || r.nan);
      ok('T22', res.length === 18 && bad.length === 0, `ok=${res.filter(r => r.ok).length}/18, 3-shard=${res.filter(r => r.shards >= 3).length}/18`);
    }
    // T22b full level through the *game loop* (events, shards, gate, end panel)
    {
      const run = G.autoRun(1, 30);
      ok('T22b', run.mode === 'end' && run.shards === 3 && run.stars === 3 && run.time < 30,
        `mode=${run.mode} shards=${run.shards} stars=${run.stars} t=${run.time}`);
    }

    // T23 level structure: 18 levels, 3 chapters x 6, 3 shards, sane par
    {
      const cfgs = G.levelConfigs();
      let struct = cfgs.length === 18;
      let chap = [0, 0, 0];
      for (const c of cfgs) {
        if (c.shards !== 3 || c.anchors < 7 || !(c.par >= 20)) struct = false;
        chap[c.chapter - 1]++;
      }
      ok('T23', struct && chap.join(',') === '6,6,6', `chapters=${chap.join('/')} shards=${cfgs[0].shards}`);
    }

    // T24 protocol envelope + frame order
    {
      ok('T24', readyFirst, `first=${reports[0] && reports[0].kind}`);
      let got = [];
      G.setReportTarget(f => got.push(f));
      report('progress', { score: 321, progress: 3 });
      report('event', { event: 'unit', score: 321 });
      report('gameOver', { score: 321, progress: 3 });
      G.setReportTarget(null);
      ok('T24b', got[0].kind === 'progress' && got[1].kind === 'event' && got[2].kind === 'gameOver', got.map(g => g.kind).join(','));
      ok('T24c', got[0].score === 321 && got[1].event === 'unit', 'flat frames for autotest');
      // wire shape
      const w1 = toWireReport({ kind: 'progress', score: 9 });
      const w2 = toWireReport({ kind: 'event', event: 'x' });
      const w3 = toWireReport({ kind: 'gameOver', score: 9, progress: 3 });
      const w4 = toWireReport({ kind: 'complete', score: 9 });
      ok('T24d', w1.kind === 'progress' && w1.data.kind === 'progress' &&
        w2.event === 'x' && w3.progress.value === 3 && w4.score === 9, 'wire envelope');
    }

    // T25 best localStorage read/write + restore
    {
      const b0 = best;
      starsByLevel[2] = 3; unlocked = Math.max(unlocked, 3); recalcTotal(); best = totalStars; saveProgress();
      const read = parseInt(localStorage.getItem(STORE.best) || '0', 10);
      const rawStars = JSON.parse(localStorage.getItem(STORE.stars) || '{}');
      ok('T25', read === totalStars && rawStars['2'] === 3 && parseInt(localStorage.getItem(STORE.total) || '-1', 10) === totalStars,
        `best=${read} total=${totalStars}`);
      G.restoreStorage(snap);
      const expBest = parseInt(snap[STORE.best] || '0', 10) || 0;
      const expStars = (JSON.parse(snap[STORE.stars] || '{}')['2']) || 0;
      ok('T25b', best === expBest && (starsByLevel[2] || 0) === expStars, `restored best=${best}`);
    }

    // T26 audio state + mute
    {
      const m0 = audio.isMuted();
      toggleMute(); const m1 = audio.isMuted();
      toggleMute();
      ok('T26', m0 !== m1 && audio.isMuted() === m0, `mute ${m0}→${m1}→${audio.isMuted()}`);
      audio.setMuted(true);
      audio.state('danger'); const s1 = audio.state();
      audio.state('play'); const s2 = audio.state();
      ok('T26b', s1 === 'danger' && s2 === 'play', `states ${s1}/${s2}`);
    }

    // T27 checkpoint activation + respawn memory
    startLevel(1); G.testMode(true);
    {
      const cp = level.checkpoints[0];
      pl.x = cp.triggerX + 2; pl.y = 400; R(1);
      ok('T27', cp.active && lastCheckpoint === 0, `active=${cp.active}`);
      // die, respawn should be near the checkpoint knot
      pl.x = level.spikes[0].x + 4; pl.y = level.spikes[0].y + 4; R(1); R(60);
      ok('T27b', pl.alive && (pl.anchor === cp.anchorIdx || Math.hypot(pl.x - cp.x, pl.y - cp.y) < 280),
        `respawn anchor=${pl.anchor} dist=${Math.hypot(pl.x - cp.x, pl.y - cp.y).toFixed(0)}`);
    }

    // T28 no NaN after a long random-input session
    startLevel(1); G.testMode(true);
    let nan = false, crash = false;
    try {
      for (let i = 0; i < 720; i++) {
        if (i % 45 === 0) G.setGrab(Math.random() < 0.65);
        if (i % 31 === 0) G.setDir([-1, 0, 1][(Math.random() * 3) | 0]);
        if (i % 57 === 0) G.setReel([-1, 0, 1][(Math.random() * 3) | 0]);
        R(1);
        if (![pl.x, pl.y, pl.vx, pl.vy].every(Number.isFinite)) nan = true;
        if (mode !== 'play') { startLevel(1); G.testMode(true); }
      }
    } catch (e) { crash = true; }
    ok('T28', !nan && !crash && G.err.length === 0, `nan=${nan} crash=${crash} err=${G.err.length}`);

    // T29 long full-game fast-forward, all 18 routes, storage + NaN stays stable
    {
      let allOk = true, nan2 = false;
      for (let i = 1; i <= LEVEL_COUNT; i++) {
        const r = G.probeLevel(i, 30);
        if (!r.ok || r.shards < 3 || !Number.isFinite(r.t)) allOk = false;
        if (r.path.some(p => !Number.isFinite(p.x + p.y))) nan2 = true;
      }
      ok('T29', allOk && !nan2, `all 18 probe routes${nan2 ? ' NaN!' : ''}`);
    }

    // T30 complete report on the last level
    startLevel(LEVEL_COUNT); G.testMode(true); G.clearReports();
    G.setShards(3); G.setTime(20);
    G.forceWin();
    ok('T30', reports.some(f => f.kind === 'complete'), `kinds=${reports.map(r => r.kind).join(',')}`);

    // T31 returning to title after tests
    toTitle();
    await nap();
    ok('T31', mode === 'title' && !document.getElementById('title').classList.contains('hidden'), `mode=${mode}`);
    ok('T31b', G.err.length === 0 && G.state().nan === false, `err=${G.err.length} nan=${G.state().nan}`);

    // restore the player's real progress + mute
    G.restoreStorage(snap);
    audio.setMuted(true);
    ui.setMute(true);
    G.testMode(false);
    G.setNoAuto(false);
  } catch (err) {
    window.__TEST_ERR = String(err && err.stack || err);
    console.error('[autotest] crashed', window.__TEST_ERR);
    T.results.push({ id: 'CRASH', ok: false, name: window.__TEST_ERR, msg: window.__TEST_ERR });
    T.fail++;
  }

  T.total = T.results.length;
  T.done = true;
  console.log(`[silkline-swing autotest] ${T.pass}/${T.total} passed`);
  if (!AUTOTEST) return;
}

// expose rope snapshot used by G/state
function ropeInfo() {
  if (!pl) return null;
  if (pl.anchor < 0) return { attached: false, dist: null, L: pl.L, angle: null, radial: null, tangential: null };
  const a = level.anchors[pl.anchor];
  const ap = anchorPos(a, pl.t);
  const dx = pl.x - ap.x, dy = pl.y - ap.y;
  const d = Math.hypot(dx, dy) || 1e-9;
  const nx = dx / d, ny = dy / d;
  const radial = pl.vx * nx + pl.vy * ny;
  const tangential = pl.vx * -ny + pl.vy * nx;
  return {
    attached: true, anchor: pl.anchor, ax: ap.x, ay: ap.y,
    dist: d, L: pl.L, angle: Math.atan2(dx, -dy),
    radial, tangential, speed: Math.hypot(pl.vx, pl.vy),
    radialAbs: Math.abs(radial),
  };
}
