// Emberpin 余烬弹珠台 — 灯匠夜游 · 第 10 铺.
// A hand-authored 2D Canvas pinball table: plunger launch, two real rotating
// flippers, pop bumpers, glowing scoring rings, and three groups of drop
// targets that raise the multiplier. Three balls, multiball and extra balls.
// Vanilla ES modules, fixed-step 60 Hz loop, procedural art, synthesized
// WebAudio, site report bridge, G debug hooks and the ?autotest=1 suite.

import {
  VW, VH, TABLE, BALL_R, GRAVITY, MAX_SPEED, DRAIN_Y,
  FLIP_LEN, FLIP_RAD, FLIP_REST, FLIP_ACTIVE, FLIP_SPEED_UP, FLIP_SPEED_DOWN,
  TARGET_SCORE, MULT_CAP, COMBO_TIME, COMBO_CAP,
  WALLS, LANE_FLOOR, BUMPERS, RINGS, POSTS, SLINGS, TARGET_GROUPS, FLIP_PIVOTS, LANE_BALL,
  clamp, finite, hyp, collideSegment, collideCircle, collideCapsule, collideBalls,
  dampen, clampSpeed, makeBall, inLane,
} from './physics.js';
import { createRenderer } from './render.js';
import { makeAudio } from './audio.js';

const DT = 1 / 60;
const CHARGE_TIME = 0.92;
const BEST_KEY = 'emp.best';
const MUTE_KEY = 'emp.mute';
const NAP_TEST = new URLSearchParams(location.search);
const AUTOTEST = NAP_TEST.has('autotest');
const AUTOSTART = NAP_TEST.get('autostart') === '1';

// ---------------------------------------------------------------- state
let mode = 'title';                 // title | play | over | complete
let paused = false, noAuto = false;
let score = 0, best = 0, multiplier = 1;
let combo = 0, comboT = 0, tasksDone = 0;
let ballsLeft = 3;
let charge = 0, charging = false, touchCharge = false;
let servePending = false, serveT = 0, autoLaunchT = 0;
let time = 0, playT = 0, lastProgressT = -99;
let hitstopT = 0, shakeT = 0, shakeAmp = 0, flashT = 0;
let newBest = false, nanFlag = false;
let muted = false;

try { best = parseInt(localStorage.getItem(BEST_KEY) || '0', 10) || 0; } catch (e) { best = 0; }
try { muted = localStorage.getItem(MUTE_KEY) === '1'; } catch (e) { muted = false; }

const audio = makeAudio();
audio.setMuted(muted);

let balls = [];
let particles = [];
let floats = [];
let groups = [];
let bumpers = [];
let rings = [];
let slings = [];
const flippers = [
  { x: FLIP_PIVOTS[0].x, y: FLIP_PIVOTS[0].y, side: 'left', angle: FLIP_REST, pressed: false, omega: 0, down: false },
  { x: FLIP_PIVOTS[1].x, y: FLIP_PIVOTS[1].y, side: 'right', angle: Math.PI - FLIP_REST, pressed: false, omega: 0, down: false },
];

const held = new Set();
const pressedQ = new Set();
let touchL = false, touchR = false;
let reportTarget = null;
const reports = [];
let uiBestDirty = false;

// ---------------------------------------------------------------- DOM
const cv = document.getElementById('gl');
const renderer = createRenderer(cv);
const titleEl = document.getElementById('title');
const endEl = document.getElementById('end');
const endhEl = document.getElementById('endh');
const enddEl = document.getElementById('endd');
const titleBestEl = document.getElementById('titlebest');
const muteBtn = document.getElementById('mutebtn');
const pauseBtn = document.getElementById('pausebtn');
const toastEl = document.getElementById('toast');
const tflipL = document.getElementById('tflipL');
const tflipR = document.getElementById('tflipR');
const tlaunch = document.getElementById('tlaunch');

function syncBestDom() {
  const s = `最高分 ${best.toLocaleString('en-US')}`;
  if (titleBestEl) titleBestEl.textContent = s;
}
function toast(msg, ms = 1500) {
  if (!toastEl) return;
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastEl._t);
  toastEl._t = setTimeout(() => toastEl.classList.remove('show'), ms);
}
function setMuted(v) {
  muted = !!v;
  audio.setMuted(muted);
  if (muteBtn) { muteBtn.textContent = muted ? '🔇' : '🔊'; muteBtn.classList.toggle('on', muted); }
  try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch (e) { }
}
function toggleMute() { setMuted(!muted); audio.play('ui'); }

// ---------------------------------------------------------------- protocol
function sendParent(payload) {
  try {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ source: 'lightgame', type: 'lightgame:report', payload }, '*');
    }
  } catch (e) { }
}
function report(kind, payload = {}) {
  const frame = { kind, ...payload };
  reports.push(frame);
  if (reportTarget) {
    try { reportTarget(frame); } catch (e) { }
    return;
  }
  let env;
  if (kind === 'progress') env = { kind: 'progress', data: { ...frame } };
  else if (kind === 'event') env = { kind: 'event', event: frame.event || frame.tag, data: { ...frame } };
  else if (kind === 'gameOver') env = { kind: 'gameOver', score: frame.score | 0, progress: { value: frame.progress }, data: { ...frame } };
  else if (kind === 'complete') env = { kind: 'complete', score: frame.score | 0 };
  else env = { ...frame };
  sendParent(env);
}
const progressPct = () => Math.max(0, Math.min(99, Math.floor(score / TARGET_SCORE * 100)));
report('ready', { game: 'emberpin', target: TARGET_SCORE });
try {
  if (window.parent && window.parent !== window) {
    window.parent.postMessage({ source: 'lightgame', type: 'lightgame:ready', gameId: 'emberpin', v: 1 }, '*');
  }
} catch (e) { }

function saveBest() {
  if (score > best) {
    best = score; newBest = true; uiBestDirty = true;
    try { localStorage.setItem(BEST_KEY, String(best)); } catch (e) { }
  }
  syncBestDom();
}

// ---------------------------------------------------------------- model setup
function makeGroups() {
  return TARGET_GROUPS.map((g, gi) => ({
    label: g.label, color: g.color,
    targets: g.targets.map((s, ti) => ({ x1: s[0], y1: s[1], x2: s[2], y2: s[3], lit: false, pulse: 0, gi, ti })),
    done: false,
  }));
}
function resetTableObjects() {
  groups = makeGroups();
  bumpers = BUMPERS.map(b => ({ ...b, pulse: 0, cd: 0 }));
  rings = RINGS.map(r => ({ ...r, pulse: 0, cd: 0 }));
  slings = SLINGS.map(s => ({ ...s, pulse: 0, cd: 0 }));
}
resetTableObjects();

// ---------------------------------------------------------------- effects
function emit(x, y, n, color, power = 1, grav = 1) {
  for (let i = 0; i < n; i++) {
    if (particles.length > 240) particles.shift();
    const a = Math.random() * Math.PI * 2, sp = (60 + Math.random() * 210) * power;
    particles.push({
      x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60 * power,
      life: 0.35 + Math.random() * 0.45, max: 0.8, color,
      size: 1.4 + Math.random() * 3.2, grav: 620 * grav,
    });
  }
}
function addFloat(x, y, text, color = '#ffe9c2', size = 13, life = 1.1) {
  if (floats.length > 18) floats.shift();
  floats.push({ x, y, text, life, max: life, color, size });
}
function kickShake(t, amp) { shakeT = Math.max(shakeT, t); shakeAmp = Math.max(shakeAmp, amp); }

// ---------------------------------------------------------------- scoring
function checkWin() {
  if (mode === 'play' && tasksDone >= 3 && score >= TARGET_SCORE) completeGame();
}
function scoreHit(base, label, x, y) {
  combo = Math.min(COMBO_CAP, combo + 1);
  comboT = COMBO_TIME;
  const cm = 1 + Math.min(combo, 10) * 0.2;
  const gain = Math.round(base * multiplier * cm);
  score += gain;
  addFloat(x, y, `${label} +${gain}`, combo > 1 ? '#ffd27a' : '#ffe9c2', combo > 1 ? 14 : 12);
  checkWin();
  return gain;
}
function awardFlat(n, x, y, label, color = '#ffd27a') {
  const gain = Math.round(n);
  score += gain;
  addFloat(x, y, `${label} +${gain}`, color, 16, 1.5);
  checkWin();
  return gain;
}

function onBumper(i) {
  const bm = bumpers[i];
  if (!bm || bm.cd > 0) return;
  bm.cd = 0.16; bm.pulse = 1;
  scoreHit(120, '保险杠', bm.x, bm.y - bm.r - 8);
  audio.play('bumper', bm.key);
  emit(bm.x, bm.y, 9, '#ffb066', 1.1);
  kickShake(0.12, 0.35);
}
function onRing(i) {
  const r = rings[i];
  if (!r || r.cd > 0) return;
  r.cd = 0.7; r.pulse = 1;
  scoreHit(500, '得分环', r.x, r.y - r.r - 10);
  audio.play('ring');
  emit(r.x, r.y, 14, '#7fe8d8', 1.2);
  kickShake(0.14, 0.42);
}
function onSling(i) {
  const s = slings[i];
  if (!s || s.cd > 0) return;
  s.cd = 0.22; s.pulse = 1;
  scoreHit(60, '弹弓', (s.x1 + s.x2) / 2, (s.y1 + s.y2) / 2 - 12);
  audio.play('sling');
  emit((s.x1 + s.x2) / 2, (s.y1 + s.y2) / 2, 6, '#ff9a6a', 0.8);
}
function hitTarget(gi, ti) {
  const g = groups[gi];
  if (!g) return false;
  const t = g.targets[ti];
  if (!t || t.lit) return false;
  t.lit = true; t.pulse = 1;
  scoreHit(800, '任务靶', (t.x1 + t.x2) / 2, t.y1 - 16);
  audio.play('target', ti + gi * 3);
  emit((t.x1 + t.x2) / 2, t.y1, 12, g.color, 1.2);
  if (g.targets.every(x => x.lit) && !g.done) completeGroup(gi);
  checkWin();
  return true;
}
function completeGroup(gi) {
  const g = groups[gi];
  if (!g || g.done) return;
  g.done = true;
  tasksDone = groups.filter(x => x.done).length;
  const oldMult = multiplier;
  const bonus = 5000 * oldMult;
  score += bonus;
  addFloat(244, 470, `任务完成 +${bonus}`, g.color, 18, 1.8);
  multiplier = Math.min(MULT_CAP, multiplier + 1);
  flashT = Math.max(flashT, 0.34);
  kickShake(0.5, 1);
  hitstopT = Math.max(hitstopT, 0.07);
  audio.play('group');
  for (const t of g.targets) emit((t.x1 + t.x2) / 2, t.y1, 10, '#ffd27a', 1.5);
  report('event', { event: 'task_complete', group: gi, tasks: tasksDone, multiplier, score });
  toast(`任务「${g.label}」完成 · 倍率 ×${multiplier}`);
  if (tasksDone === 1) spawnMultiball(1, '双球奖励');
  else if (tasksDone === 2) grantExtraBall();
  else spawnMultiball(2, '终局三球');
  lastProgressT = playT; report('progress', { score, progress: progressPct(), tasks: tasksDone });
  checkWin();
}
function spawnMultiball(n, label = '多球奖励') {
  const spots = [[244, 132], [192, 118], [296, 118], [150, 130], [338, 130]];
  let made = 0;
  for (let i = 0; i < n; i++) {
    const sp = spots[(balls.length + i) % spots.length];
    const b = makeBall(sp[0], sp[1], (i % 2 === 0 ? 1 : -1) * (110 + i * 26), 95 + i * 24);
    balls.push(b);
    made++;
  }
  if (made) {
    audio.play('multiball');
    toast(label + ' · 场上 ' + balls.length + ' 球');
    emit(244, 140, 20, '#ffb066', 1.6);
    kickShake(0.35, 0.8);
    report('event', { event: 'multiball', balls: balls.length });
  }
  return made;
}
function grantExtraBall() {
  ballsLeft = Math.min(6, ballsLeft + 1);
  audio.play('extra');
  toast('额外球 +1 · 剩余球 ' + ballsLeft);
  addFloat(496, 760, '额外球 +1', '#56c9b4', 16, 1.6);
  report('event', { event: 'extra_ball', ballsLeft });
}

// ---------------------------------------------------------------- flow
function resetFlippers() {
  flippers[0].angle = FLIP_REST; flippers[0].pressed = false; flippers[0].omega = 0;
  flippers[1].angle = Math.PI - FLIP_REST; flippers[1].pressed = false; flippers[1].omega = 0;
}
function spawnLaneBall() {
  if (balls.some(inLane)) return false;
  balls.push(makeBall(LANE_BALL.x, LANE_BALL.y));
  return true;
}
function startGame() {
  mode = 'play'; paused = false;
  score = 0; multiplier = 1; combo = 0; comboT = 0; tasksDone = 0; ballsLeft = 3;
  balls = []; particles = []; floats = [];
  charge = 0; charging = false; touchCharge = false;
  servePending = false; serveT = 0; autoLaunchT = AUTOSTART ? 0.7 : 0;
  hitstopT = 0; shakeT = 0; shakeAmp = 0; flashT = 0;
  newBest = false; nanFlag = false; playT = 0; lastProgressT = -99;
  resetTableObjects(); resetFlippers();
  spawnLaneBall();
  hideOverlays();
  syncPauseBtn();
  setMuted(muted);
  audio.setState('play');
  audio.play('ui');
  addFloat(244, 452, '按住空格蓄力', '#ffd27a', 17, 2.4);
  addFloat(244, 478, '松开弹射 · 点亮三组任务靶', 'rgba(235,210,175,.9)', 12, 2.8);
  syncBestDom();
}
function goTitle() {
  mode = 'title'; paused = false; charging = false; touchCharge = false;
  balls = []; particles = []; floats = []; servePending = false;
  syncPauseBtn();
  showTitle(true); showEnd(false);
  audio.setState('title');
  syncBestDom();
}
function hideOverlays() { showTitle(false); showEnd(false); }
function showTitle(v) { if (titleEl) titleEl.classList.toggle('hide', !v); }
function showEnd(v) { if (endEl) endEl.classList.toggle('hide', !v); }
function syncPauseBtn() {
  if (pauseBtn) { pauseBtn.textContent = paused ? '▶' : '❚❚'; pauseBtn.classList.toggle('on', paused); }
}
function togglePause() {
  if (mode !== 'play') return;
  paused = !paused;
  charging = false; charge = 0;
  syncPauseBtn();
  audio.play('ui');
}
function completeGame() {
  if (mode !== 'play') return;
  mode = 'complete'; charging = false; paused = false; saveBest();
  audio.play('win'); audio.setState('end');
  report('complete', { score, progress: 100, tasks: tasksDone, multiplier });
  showEnd(true);
  if (endhEl) endhEl.textContent = '熔 金 通 关';
  if (enddEl) enddEl.innerHTML =
    `<div class="bigscore">${score.toLocaleString('en-US')}</div>` +
    `<div>三组任务全部点亮 · 倍率 ×${multiplier}</div>` +
    `<div class="rec">${newBest ? '★ 新纪录' : `最高分 ${best.toLocaleString('en-US')}`}</div>`;
  syncBestDom();
}
function loseGame() {
  if (mode !== 'play') return;
  mode = 'over'; charging = false; paused = false; saveBest();
  audio.play('lose'); audio.setState('end');
  report('gameOver', { score, progress: progressPct(), tasks: tasksDone, multiplier });
  showEnd(true);
  if (endhEl) endhEl.textContent = '余 烬 熄 灭';
  if (enddEl) enddEl.innerHTML =
    `<div class="bigscore">${score.toLocaleString('en-US')}</div>` +
    `<div>任务 ${tasksDone}/3 · 倍率 ×${multiplier} · 目标 ${TARGET_SCORE.toLocaleString('en-US')}</div>` +
    `<div class="rec">${newBest ? '★ 新纪录' : `最高分 ${best.toLocaleString('en-US')}`}</div>`;
  syncBestDom();
}

// ---------------------------------------------------------------- charge / launch
function anyLaneBall() { return balls.find(inLane) || null; }
function beginCharge() {
  if (mode !== 'play' || paused) return false;
  if (!anyLaneBall()) return false;
  charging = true;
  charge = Math.max(charge, 0.16);
  return true;
}
function releaseCharge() {
  if (!charging) return false;
  const p = Math.max(0.18, charge);
  charging = false; charge = 0;
  return launchBall(p);
}
function launchBall(power = 1) {
  const b = anyLaneBall();
  if (!b || mode !== 'play') { charging = false; charge = 0; return false; }
  const p = clamp(power, 0, 1);
  b.vx = -24;
  b.vy = -(900 + 1200 * p);
  b.inLane = false;
  b.age = 0;
  audio.play('launch', p);
  emit(b.x, b.y, 8, '#ffb066', 0.9);
  kickShake(0.1, 0.3);
  addFloat(496, 800, p > 0.92 ? '满 力 弹 射' : '弹 射', '#ffd27a', 12, 0.9);
  return true;
}

// ---------------------------------------------------------------- drain / serve
function scheduleServe() {
  servePending = true;
  serveT = 0.85;
}
function onDrain(b) {
  audio.play('drain');
  emit(Math.max(40, Math.min(500, b.x)), Math.min(856, b.y), 12, '#e85a3e', 1.2);
  combo = 0; comboT = 0;
  if (mode !== 'play') return;
  if (balls.length === 0) {
    ballsLeft--;
    if (ballsLeft <= 0) {
      ballsLeft = 0;
      loseGame();
    } else {
      scheduleServe();
      toast('落球 · 剩余 ' + ballsLeft + ' 球');
    }
  }
}

// ---------------------------------------------------------------- input
function halfPressed() {
  return {
    left: held.has('KeyA') || held.has('ArrowLeft') || touchL,
    right: held.has('KeyD') || held.has('ArrowRight') || touchR,
  };
}
function handleInput() {
  const q = [...pressedQ]; pressedQ.clear();
  for (const code of q) {
    if (code === 'KeyM') toggleMute();
    else if (code === 'KeyP') togglePause();
    else if (code === 'KeyR') { if (mode !== 'title') startGame(); }
    else if (code === 'Enter') {
      if (mode === 'title') startGame();
      else if (mode === 'over' || mode === 'complete') startGame();
    } else if (code === 'Space') {
      if (mode === 'title') startGame();
      else if (mode === 'over' || mode === 'complete') startGame();
      else if (mode === 'play' && !paused) beginCharge();
    }
  }
  const p = halfPressed();
  for (const f of flippers) {
    const down = f.side === 'left' ? p.left : p.right;
    if (down && !f.pressed) audio.play('flip', f.side);
    f.pressed = down;
  }
  if (charging && !held.has('Space') && !touchCharge) releaseCharge();
}

// keyboard
addEventListener('keydown', (e) => {
  if (e.isComposing || e.keyCode === 229) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
  if (!AUTOTEST) audio.unlock();       // AudioContext must be born inside a real gesture
  if (!e.repeat) { held.add(e.code); pressedQ.add(e.code); }
}, { passive: false });
addEventListener('keyup', (e) => {
  held.delete(e.code);
  if (e.code === 'Space') releaseCharge();
});
addEventListener('blur', () => {
  held.clear(); touchL = touchR = false; touchCharge = false;
  charging = false; charge = 0;
});

// mouse / touch on the playfield: tap left/right half flips, tap launches
function canvasPoint(e) {
  const r = cv.getBoundingClientRect();
  return { x: (e.clientX - r.left), y: (e.clientY - r.top) };
}
cv.addEventListener('pointerdown', (e) => {
  if (mode !== 'play') return;
  if (!AUTOTEST) audio.unlock();
  const p = canvasPoint(e);
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  if (e.pointerType === 'mouse') {
    // mouse users click to flip as a convenience, but the keyboard is primary
    if (p.x < innerWidth / 2) touchL = true; else touchR = true;
    return;
  }
  if (p.x < innerWidth / 2) touchL = true; else touchR = true;
  if (anyLaneBall() && !charging) { touchCharge = true; beginCharge(); }
  e.preventDefault();
}, { passive: false });
function endPointer(e) {
  touchL = touchR = false;
  if (touchCharge) { touchCharge = false; releaseCharge(); }
}
cv.addEventListener('pointerup', endPointer);
cv.addEventListener('pointercancel', endPointer);
addEventListener('pointerup', endPointer);

// touch buttons (also exercised by the autotest)
function bindHold(el, on, off) {
  if (!el) return;
  el.addEventListener('pointerdown', (e) => { e.preventDefault(); if (!AUTOTEST) audio.unlock(); on(); });
  el.addEventListener('pointerup', (e) => { e.preventDefault(); off(); });
  el.addEventListener('pointercancel', (e) => { off(); });
  el.addEventListener('pointerleave', () => off());
}
bindHold(tflipL, () => { touchL = true; }, () => { touchL = false; });
bindHold(tflipR, () => { touchR = true; }, () => { touchR = false; });
bindHold(tlaunch, () => { touchCharge = true; beginCharge(); }, () => { touchCharge = false; releaseCharge(); });

document.getElementById('startbtn').addEventListener('click', () => { audio.unlock(); startGame(); });
document.getElementById('retrybtn').addEventListener('click', () => { audio.unlock(); startGame(); });
document.getElementById('homebtn').addEventListener('click', () => { audio.play('ui'); goTitle(); });
if (muteBtn) muteBtn.addEventListener('click', () => { audio.unlock(); toggleMute(); });
if (pauseBtn) pauseBtn.addEventListener('click', () => togglePause());
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { held.clear(); touchL = touchR = false; touchCharge = false; charging = false; charge = 0; }
});

// ---------------------------------------------------------------- flippers
function updateFlippers(dt) {
  const p = halfPressed();
  for (const f of flippers) {
    const down = f.side === 'left' ? p.left : p.right;
    f.pressed = down;
    const target = f.side === 'left'
      ? (down ? FLIP_ACTIVE : FLIP_REST)
      : (down ? Math.PI - FLIP_ACTIVE : Math.PI - FLIP_REST);
    const sp = down ? FLIP_SPEED_UP : FLIP_SPEED_DOWN;
    const prev = f.angle;
    if (f.angle < target) f.angle = Math.min(target, f.angle + sp * dt);
    else f.angle = Math.max(target, f.angle - sp * dt);
    f.omega = (f.angle - prev) / dt;
  }
}
function flipperTip(f) {
  return { x: f.x + Math.cos(f.angle) * FLIP_LEN, y: f.y + Math.sin(f.angle) * FLIP_LEN };
}

// ---------------------------------------------------------------- collisions
function collideBall(b) {
  // flippers first: a sweeping bat is the most important hit in pinball
  for (const f of flippers) {
    const tip = flipperTip(f);
    const hit = collideCapsule(b, f.x, f.y, tip.x, tip.y, FLIP_RAD, 0.55, f.omega, f.pressed ? 150 : 0);
    if (hit) {
      // A real flipper volley: while the bat is actively swinging upward and
      // the ball is on the playfield side, guarantee a crisp upward launch.
      // (The capsule impulse alone can flip normal direction halfway through
      // the sweep and knock a resting ball down.)
      const swingingUp = f.side === 'left' ? f.omega < -3 : f.omega > 3;
      if (f.pressed && swingingUp && b.y < f.y + 34) {
        const lift = Math.max(520, Math.abs(f.omega) * 30);
        if (b.vy > -lift) b.vy = -lift;
        b.vx += f.side === 'left' ? 70 : -70;
        emit(hit.x, hit.y, 5, '#ffcf8a', 0.8);
      } else if (hit.impact > 260) {
        emit(hit.x, hit.y, 3, '#ffcf8a', 0.6);
      }
    }
  }
  // outer rails
  for (const s of WALLS) {
    const h = collideSegment(b, s[0], s[1], s[2], s[3], 0.54);
    if (h && h.impact > 420) audio.play('wall', h.impact);
  }
  collideSegment(b, LANE_FLOOR[0], LANE_FLOOR[1], LANE_FLOOR[2], LANE_FLOOR[3], 0.18);
  // slingshots
  for (let i = 0; i < slings.length; i++) {
    const s = slings[i];
    const live = s.cd <= 0;
    const h = collideSegment(b, s.x1, s.y1, s.x2, s.y2, live ? 0.62 : 0.4, live ? 540 : 0);
    if (h) {
      s.pulse = Math.max(s.pulse, 0.9);
      if (live) onSling(i);
    }
  }
  // pop bumpers
  for (let i = 0; i < bumpers.length; i++) {
    const bm = bumpers[i];
    const h = collideCircle(b, bm.x, bm.y, bm.r, 0.45, 620);
    if (h) { bm.pulse = Math.max(bm.pulse, 1); onBumper(i); }
  }
  // scoring rings
  for (let i = 0; i < rings.length; i++) {
    const r = rings[i];
    const h = collideCircle(b, r.x, r.y, r.r, 0.72, 0);
    if (h) { r.pulse = Math.max(r.pulse, 0.9); onRing(i); }
  }
  // posts
  for (const p of POSTS) collideCircle(b, p.x, p.y, p.r, 0.72, 0);
  // drop targets
  for (const g of groups) {
    for (const t of g.targets) {
      if (t.lit) continue;
      const h = collideSegment(b, t.x1, t.y1, t.x2, t.y2, 0.15, 0, 5);
      if (h) hitTarget(t.gi, t.ti);
    }
  }
}

function stepBallPhysics(b, dt) {
  const sp = hyp(b.vx, b.vy);
  const n = Math.min(7, Math.max(1, Math.ceil(sp * dt / 5)));
  const h = dt / n;
  for (let i = 0; i < n; i++) {
    b.vy += GRAVITY * h;
    dampen(b, h, 0.24);
    b.x += b.vx * h;
    b.y += b.vy * h;
    collideBall(b);
    clampSpeed(b, MAX_SPEED);
  }
  b.inLane = inLane(b);
  if (!finite(b.x) || !finite(b.y) || !finite(b.vx) || !finite(b.vy)) {
    nanFlag = true;
    b.x = 244; b.y = 300; b.vx = 0; b.vy = 0;
  }
  b.trail.push({ x: b.x, y: b.y });
  if (b.trail.length > 9) b.trail.shift();
}

// ---------------------------------------------------------------- update
function update(dt) {
  time += dt;
  if (mode === 'play') playT += dt;

  if (hitstopT > 0) { hitstopT -= dt; return; }

  // timers
  if (comboT > 0) { comboT -= dt; if (comboT <= 0) combo = 0; }
  if (shakeT > 0) shakeT = Math.max(0, shakeT - dt * 1.8);
  if (flashT > 0) flashT = Math.max(0, flashT - dt * 1.6);
  for (const bm of bumpers) { if (bm.cd > 0) bm.cd -= dt; bm.pulse = Math.max(0, bm.pulse - dt * 3.2); }
  for (const r of rings) { if (r.cd > 0) r.cd -= dt; r.pulse = Math.max(0, r.pulse - dt * 2.6); }
  for (const s of slings) { if (s.cd > 0) s.cd -= dt; s.pulse = Math.max(0, s.pulse - dt * 4); }
  for (const g of groups) for (const t of g.targets) t.pulse = Math.max(0, t.pulse - dt * 2.4);

  // charge / serve / autostart
  if (charging && mode === 'play' && !paused) {
    const prev = charge;
    charge = Math.min(1, charge + dt / CHARGE_TIME);
    if (Math.floor(charge * 6) !== Math.floor(prev * 6)) audio.play('charge', charge);
  }
  if (servePending) {
    serveT -= dt;
    if (serveT <= 0) { servePending = false; spawnLaneBall(); }
  }
  if (autoLaunchT > 0) {
    autoLaunchT -= dt;
    if (autoLaunchT <= 0 && anyLaneBall()) launchBall(1);
  }

  updateFlippers(dt);

  if (mode === 'play') {
    for (const b of balls) stepBallPhysics(b, dt);
    // multiball collisions
    for (let i = 0; i < balls.length; i++) {
      for (let j = i + 1; j < balls.length; j++) {
        const h = collideBalls(balls[i], balls[j], 0.7);
        if (h && h.impact > 320) emit((balls[i].x + balls[j].x) / 2, (balls[i].y + balls[j].y) / 2, 4, '#ffd27a', 0.7);
      }
    }
    // drains
    for (let i = balls.length - 1; i >= 0; i--) {
      const b = balls[i];
      if (b.y > DRAIN_Y || b.y > 920 || b.x < -30 || b.x > 570) {
        balls.splice(i, 1);
        onDrain(b);
      }
    }
    if (mode === 'play') {
      if (playT - lastProgressT > 4) {
        lastProgressT = playT;
        report('progress', { score, progress: progressPct(), tasks: tasksDone });
      }
      if (!Number.isFinite(score) || !Number.isFinite(multiplier) || !Number.isFinite(tasksDone)) nanFlag = true;
    }
  }

  // particles / floats
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) { particles.splice(i, 1); continue; }
    p.vy += p.grav * dt;
    p.x += p.vx * dt; p.y += p.vy * dt;
  }
  for (let i = floats.length - 1; i >= 0; i--) {
    const f = floats[i];
    f.life -= dt;
    f.y -= 28 * dt;
    if (f.life <= 0) floats.splice(i, 1);
  }

  // music tension near the end
  if (mode === 'play') audio.setState(ballsLeft <= 1 ? 'tension' : 'play');
  audio.tick();

  if (uiBestDirty) { uiBestDirty = false; syncBestDom(); }
}

// ---------------------------------------------------------------- view
function makeView() {
  return {
    mode, paused, time, playT, score, best, ballsLeft, multiplier, combo, comboT,
    targetScore: TARGET_SCORE,
    groups: groups.map(g => ({
      label: g.label, color: g.color, done: g.done,
      targets: g.targets.map(t => ({ x1: t.x1, y1: t.y1, x2: t.x2, y2: t.y2, lit: t.lit, pulse: t.pulse })),
    })),
    balls: balls.map(b => ({ x: b.x, y: b.y, vx: b.vx, vy: b.vy, r: b.r, trail: b.trail })),
    bumpers: bumpers.map(b => ({ x: b.x, y: b.y, r: b.r, key: b.key, pulse: b.pulse })),
    rings: rings.map(r => ({ x: r.x, y: r.y, r: r.r, pulse: r.pulse })),
    posts: POSTS,
    slings: slings.map(s => ({ x1: s.x1, y1: s.y1, x2: s.x2, y2: s.y2, pulse: s.pulse })),
    flippers: flippers.map(f => ({ x: f.x, y: f.y, angle: f.angle, pressed: f.pressed })),
    particles, floats, charge, charging,
    shakeT, shakeAmp, flashT,
    serve: servePending || balls.some(inLane),
  };
}

// ---------------------------------------------------------------- main loop
let last = performance.now(), acc = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const raw = (now - last) / 1000; last = now;
  if (document.hidden) { acc = 0; return; }
  const dt = Math.min(0.1, raw);
  handleInput();
  if (mode === 'play' && !paused) {
    acc += dt;
    let n = 0;
    while (acc >= DT && n < 5) { update(DT); acc -= DT; n++; }
  } else {
    acc = 0;
    if (mode === 'title') time += dt;
    audio.tick();
  }
  renderer.draw(makeView());
}
requestAnimationFrame(frame);
addEventListener('resize', () => renderer.resize());

// ---------------------------------------------------------------- boot UI
syncBestDom();
setMuted(muted);
showTitle(true);
showEnd(false);
resetFlippers();
audio.setState('title');
if (AUTOSTART) startGame();

// ==================== G debug hooks ====================
const G = {
  err: window.__BOOTERR || (window.__BOOTERR = []),
  W: VW, H: VH, TABLE, TARGET_SCORE,
  step: (n = 60, dt = DT) => { for (let i = 0; i < n; i++) { handleInput(); if (mode === 'play' && !paused) update(dt); else if (mode === 'title') time += dt; renderer.draw(makeView()); } },
  upd: (n = 30, dt = DT) => { for (let i = 0; i < n; i++) { handleInput(); if (mode === 'play' && !paused) update(dt); else if (mode === 'title') time += dt; } },
  press: (...codes) => codes.forEach(c => { held.add(c); pressedQ.add(c); }),
  release: (...codes) => codes.forEach(c => { held.delete(c); if (c === 'Space') releaseCharge(); }),
  clearKeys: () => { held.clear(); pressedQ.clear(); touchL = touchR = false; },
  setNoAuto: (v) => { noAuto = !!v; if (noAuto) autoLaunchT = 0; },
  setReportTarget: (fn) => { reportTarget = fn; },
  startGame, goTitle, togglePause, toggleMute, setMuted,
  forceLaunch: (p = 1) => launchBall(p),
  setCharge: (v) => { charge = clamp(v, 0, 1); },
  setScore: (v) => { score = Math.max(0, Math.round(v) || 0); lastProgressT = playT; },
  addScore: (n) => { score = Math.max(0, score + Math.round(n)); checkWin(); return score; },
  setMultiplier: (v) => { multiplier = clamp(Math.round(v) || 1, 1, MULT_CAP); },
  setBalls: (v) => { ballsLeft = clamp(Math.round(v) || 0, 0, 9); },
  setCombo: (v) => { combo = clamp(Math.round(v) || 0, 0, COMBO_CAP); comboT = COMBO_TIME; },
  addBalls: (n) => spawnMultiball(n),
  placeBall: (x = 244, y = 300, vx = 0, vy = 0) => { const b = makeBall(x, y, vx, vy); balls.push(b); return b; },
  clearBalls: () => { balls = []; servePending = false; },
  spawnLane: () => spawnLaneBall(),
  drainAll: () => { for (const b of balls) { b.y = 910; } },
  hitTarget: (gi, ti) => hitTarget(gi, ti),
  completeGroup: (gi) => { groups[gi].targets.forEach((t, i) => hitTarget(gi, i)); return groups[gi].done; },
  completeAllTasks: () => { groups.forEach((g, gi) => g.targets.forEach((t, i) => hitTarget(gi, i))); tasksDone = groups.filter(g => g.done).length; checkWin(); },
  simulateBumper: (i = 0) => { bumpers[i].cd = 0; onBumper(i); },
  simulateRing: (i = 0) => { rings[i].cd = 0; onRing(i); },
  forceWin: () => { score = Math.max(score, TARGET_SCORE); groups.forEach((g, gi) => g.targets.forEach((t, i) => hitTarget(gi, i))); tasksDone = 3; checkWin(); },
  forceFail: () => { ballsLeft = 0; balls = []; loseGame(); },
  forceDrain: () => { for (const b of balls) b.y = 910; },
  reportProgress: () => { report('progress', { score, progress: progressPct(), tasks: tasksDone }); return progressPct(); },
  state: () => ({
    mode, paused, score, best, ballsLeft, liveBalls: balls.length,
    multiplier, combo, comboT: +comboT.toFixed(3), comboMult: +(1 + Math.min(combo, 10) * 0.2).toFixed(2),
    tasksDone, targetScore: TARGET_SCORE, charging, charge: +charge.toFixed(3),
    servePending, serveT: +serveT.toFixed(2), playT: +playT.toFixed(2),
    nan: nanFlag, muted, newBest,
    win: mode === 'complete', over: mode === 'over',
    groups: groups.map(g => ({ label: g.label, done: g.done, lit: g.targets.map(t => t.lit) })),
    targetsLit: groups.reduce((n, g) => n + g.targets.filter(t => t.lit).length, 0),
    flippers: { left: +flippers[0].angle.toFixed(3), right: +flippers[1].angle.toFixed(3), leftPressed: flippers[0].pressed, rightPressed: flippers[1].pressed },
    leftRest: FLIP_REST, leftActive: FLIP_ACTIVE,
    balls: balls.map(b => ({ x: +b.x.toFixed(2), y: +b.y.toFixed(2), vx: +b.vx.toFixed(1), vy: +b.vy.toFixed(1), inLane: !!inLane(b) })),
    progress: progressPct(), reports: reports.length,
  }),
  reportLog: () => reports.slice(),
  view: () => makeView(),
  audio, renderer,
  defs: { VW, VH, TABLE, TARGET_SCORE, WALLS, BUMPERS, RINGS, TARGET_GROUPS, FLIP_REST, FLIP_ACTIVE, FLIP_LEN },
};
window.__G = G;
window.G = G;
window.addEventListener('error', (e) => { if (G.err) G.err.push(String(e.message || e)); });

// ==================== autotest suite ====================
const nap = () => new Promise(r => { const mc = new MessageChannel(); mc.port1.onmessage = () => r(); mc.port2.postMessage(0); });

async function autotest() {
  G.setNoAuto(true);
  const results = [];
  const T = window.__TEST = { pass: 0, fail: 0, total: 0, results, done: false };
  const ok = (id, cond, name) => {
    const good = !!cond;
    results.push({ id, ok: good, name });
    if (good) T.pass++; else T.fail++;
    if (!good) console.log(`[autotest] FAIL ${id}: ${name}`);
  };
  const S = () => G.state();
  const R = (n, dt = DT) => { for (let i = 0; i < n; i++) { handleInput(); if (mode === 'play' && !paused) update(dt); } };
  const F = (n, dt = DT) => { for (let i = 0; i < n; i++) { handleInput(); if (mode === 'play' && !paused) update(dt); renderer.draw(makeView()); } };
  const savedBest = best, savedMute = muted;
  setMuted(true);
  const frames = [];
  G.setReportTarget(f => frames.push(f));
  G.clearKeys();

  await nap();
  // 1 — boot clean
  ok(1, (window.__BOOTERR || []).length === 0 && G.err.length === 0, '启动零报错');

  // 2 — start state
  G.startGame(); G.setNoAuto(true);
  {
    const s = S();
    ok(2, s.mode === 'play' && s.score === 0 && s.ballsLeft === 3 && s.liveBalls === 1 &&
      s.multiplier === 1 && s.tasksDone === 0 && s.balls[0].inLane, '开局：3 球、1 球在发射轨、得分/倍率归零');
  }

  // 3 — gravity + no NaN
  G.clearBalls(); G.placeBall(244, 300, 0, 0);
  R(20);
  {
    const b = S().balls[0];
    ok(3, b && b.vy > 100 && b.y > 300 && !S().nan, '重力使球下落且数值有限');
  }

  // 4 — left wall bounce flips vx
  G.clearBalls(); G.placeBall(40, 550, -700, 0);
  R(10);
  {
    const b = S().balls[0];
    ok(4, !!b && b.vx > 0 && b.x >= 18, `撞左壁后 vx=${b ? b.vx : 'n/a'} 反弹回界内`);
  }

  // 5 — flipper really strikes the ball
  G.clearBalls(); G.placeBall(190, 784, 0, 0);
  G.press('KeyA'); R(10); G.release('KeyA');
  {
    const b = S().balls[0];
    const sp = b ? Math.hypot(b.vx, b.vy) : 0;
    ok(5, !!b && b.vy < -120 && sp > 300, `左翻板击球 vy=${b ? b.vy : 'n/a'} speed=${sp.toFixed(0)}`);
  }
  G.clearKeys();

  // 6 — pop bumper scores and kicks
  G.startGame(); G.clearBalls(); G.setScore(0); G.setCombo(0); G.setMultiplier(1);
  G.placeBall(244, 270, 0, -320);
  R(12);
  {
    const s = S();
    ok(6, s.score > 0 && s.balls[0] && s.balls[0].vy > 0, `保险杠反弹并得分 score=${s.score}`);
  }

  // 7 — scoring ring
  G.startGame(); G.clearBalls(); G.setScore(0); G.setCombo(0); G.setMultiplier(1);
  G.placeBall(80, 405, 0, 260);
  R(10);
  ok(7, S().score > 0, `得分环计分 score=${S().score}`);

  // 8 — target hit exact value (800 × mult × combo 1.2)
  G.startGame(); G.setScore(0); G.setCombo(0); G.setMultiplier(1);
  const hit8 = G.hitTarget(0, 0);
  {
    const s = S();
    ok(8, hit8 && s.groups[0].lit[0] && s.score === 960, `任务靶命中 800×1×1.2=960（实得 ${s.score}）`);
  }

  // 9 — group completion raises multiplier and spawns multiball
  G.hitTarget(0, 1); G.hitTarget(0, 2);
  {
    const s = S();
    ok(9, s.tasksDone === 1 && s.multiplier === 2, `一组点亮：任务1/3、倍率×${s.multiplier}`);
    ok(9.5, s.liveBalls >= 2, `任务奖励多球：场上 ${s.liveBalls} 球`);
  }

  // 10 — second group grants an extra ball
  const ballsBefore10 = S().ballsLeft;
  G.completeGroup(1);
  ok(10, S().ballsLeft === ballsBefore10 + 1 && S().tasksDone === 2, `第二组点亮：额外球 ${ballsBefore10}→${S().ballsLeft}`);

  // 11 — third group spawns two more, tasks complete
  const liveBefore11 = S().liveBalls;
  G.completeGroup(2);
  {
    const s = S();
    ok(11, s.tasksDone === 3 && s.liveBalls >= liveBefore11 + 2, `三组全亮：场上 ${liveBefore11}→${s.liveBalls} 球`);
  }

  // 12 — combo multiplier math
  G.startGame(); G.clearBalls(); G.setScore(0); G.setCombo(0); G.setMultiplier(1);
  G.simulateBumper(0);
  const gainCombo1 = S().score;
  G.startGame(); G.clearBalls(); G.setScore(0); G.setCombo(4); G.setMultiplier(1);
  G.simulateBumper(0);
  const gainCombo5 = S().score;
  ok(12, gainCombo1 === 144 && gainCombo5 === 240, `连击加成 1→${gainCombo1}，5→${gainCombo5}（120×倍率×连击系数）`);

  // 13 — combo decays after its window
  G.startGame(); G.setCombo(5); R(Math.ceil(COMBO_TIME * 60) + 8);
  ok(13, S().combo === 0, '连击窗口耗尽后归零');

  // 14 — multiplier multiplies target value
  G.startGame(); G.clearBalls(); G.setScore(0); G.setCombo(0); G.setMultiplier(3);
  G.hitTarget(0, 0);
  ok(14, S().score === 2880, `倍率×3 任务靶 800×3×1.2=2880（实得 ${S().score}）`);

  // 15 — multiball count + extra ball cap
  G.startGame(); G.clearBalls();
  const liveBefore15 = S().liveBalls;
  G.addBalls(2);
  G.setBalls(6); G.setBalls(9);
  ok(15, S().liveBalls === liveBefore15 + 2 && S().ballsLeft === 9, `多球 +2、额外球库存钳制（${S().liveBalls} 球 / ${S().ballsLeft}）`);

  // 16 — drain costs a ball, then serve returns
  G.startGame();
  const left16 = S().ballsLeft;
  G.drainAll(); R(70);
  {
    const s = S();
    ok(16, s.ballsLeft === left16 - 1 && s.liveBalls === 1 && s.balls[0].inLane, `落球扣 1（${left16}→${s.ballsLeft}）并补球到发射轨`);
  }

  // 17 — pause freezes physics
  G.startGame(); G.forceLaunch(1); R(12);
  G.press('KeyP'); R(2);
  const pausedNow = S().paused;
  const py = S().balls[0] ? S().balls[0].y : null;
  R(40);
  const py2 = S().balls[0] ? S().balls[0].y : null;
  G.press('KeyP'); R(2);
  const resumed = !S().paused;
  const py3 = S().balls[0] ? S().balls[0].y : null;
  R(10);
  const py4 = S().balls[0] ? S().balls[0].y : null;
  ok(17, pausedNow && py === py2 && resumed && py3 !== py4, `暂停冻结球（${py}→${py2}），恢复后继续（${py3}→${py4}）`);
  G.clearKeys();

  // 18 — keyboard flipper input simulation
  G.startGame();
  const restR = S().flippers.right;
  G.press('KeyD'); R(4);
  const downR = S().flippers.right;
  G.release('KeyD'); R(40);
  const backR = S().flippers.right;
  ok(18, Math.abs(downR - restR) > 0.15 && Math.abs(backR - restR) < 0.03, `D 键右翻板 ${restR}→${downR}→${backR}`);

  // 19 — Space charge & launch
  G.startGame();
  G.press('Space'); R(30);
  const charged = S().charge;
  G.release('Space'); R(8);
  {
    const s = S();
    ok(19, charged > 0.35 && s.balls[0] && s.balls[0].vy < -700 && !s.balls[0].inLane, `空格蓄力 ${charged} → 弹射 vy=${s.balls[0] ? s.balls[0].vy : 'n/a'}`);
  }

  // 20 — charge power affects launch speed
  G.startGame(); G.forceLaunch(0.2);
  const weakVy = S().balls[0] ? S().balls[0].vy : 0;
  G.startGame(); G.forceLaunch(1);
  const strongVy = S().balls[0] ? S().balls[0].vy : 0;
  ok(20, Math.abs(strongVy) > Math.abs(weakVy) + 500, `蓄力影响弹速 ${weakVy} vs ${strongVy}`);

  // 21 — touch buttons bind flippers and launch
  G.startGame();
  tflipL.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch', pointerId: 71 }));
  R(4);
  const touchLeft = S().flippers.leftPressed;
  tflipL.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerType: 'touch', pointerId: 71 }));
  R(2);
  tlaunch.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch', pointerId: 72 }));
  R(18);
  const touchChargeOn = S().charging;
  tlaunch.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerType: 'touch', pointerId: 72 }));
  R(10);
  const touchLaunched = S().balls[0] && !S().balls[0].inLane;
  ok(21, touchLeft && touchChargeOn && touchLaunched, `触屏按钮：左翻板=${touchLeft}、蓄力=${touchChargeOn}、发射=${touchLaunched}`);

  // 22 — canvas half-screen touch flips
  G.startGame();
  cv.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch', pointerId: 73, clientX: 40, clientY: 300 }));
  R(3);
  const halfLeft = S().flippers.leftPressed;
  cv.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerType: 'touch', pointerId: 73, clientX: 40, clientY: 300 }));
  R(3);
  ok(22, halfLeft && !S().flippers.leftPressed, '屏幕左半触控压下/松开左翻板');

  // 23 — three-ball exhaustion reaches gameOver
  best = 0; try { localStorage.setItem(BEST_KEY, '0'); } catch (e) { }
  G.startGame(); G.setScore(4321); frames.length = 0;
  for (let i = 0; i < 3 && mode === 'play'; i++) { G.drainAll(); R(80); }
  ok(23, S().mode === 'over' && S().ballsLeft === 0, `三球耗尽 gameOver（ballsLeft=${S().ballsLeft}）`);
  ok(23.5, frames.some(f => f.kind === 'gameOver'), '失败上报 gameOver 帧');

  // 24 — best score persisted
  {
    let stored = 0;
    try { stored = parseInt(localStorage.getItem(BEST_KEY) || '0', 10) || 0; } catch (e) { }
    ok(24, stored === 4321 && S().best === 4321, `best 写入 localStorage（${stored}）`);
  }

  // 25 — complete path + report
  G.startGame(); frames.length = 0;
  G.setScore(TARGET_SCORE);
  G.completeAllTasks();
  ok(25, S().mode === 'complete' && S().tasksDone === 3, '任务全亮 + 目标分 → complete');
  ok(25.5, frames.some(f => f.kind === 'complete'), '通关上报 complete 帧');

  // 26 — protocol frame order
  ok(26, reports.length > 0 && reports[0].kind === 'ready', 'ready 为首个上报帧');
  ok(26.5, frames.some(f => f.kind === 'event') && frames.some(f => f.kind === 'progress'), '任务 event 与 milestone progress 帧存在');

  // 27 — restart resets everything
  G.startGame();
  {
    const s = S();
    ok(27, s.mode === 'play' && s.score === 0 && s.multiplier === 1 && s.tasksDone === 0 &&
      s.ballsLeft === 3 && s.liveBalls === 1 && s.balls[0].inLane && !s.charging, '重开一局完整复位');
  }

  // 28 — R key restart
  G.forceLaunch(1); R(20); G.setScore(999);
  G.press('KeyR'); R(2); G.clearKeys();
  ok(28, S().score === 0 && S().mode === 'play' && S().balls[0] && S().balls[0].inLane, 'R 键重开并回到发射轨');

  // 29 — 1500-frame fast forward, no NaN / no escape
  G.startGame(); G.forceLaunch(1);
  let escaped = false, hadNaN = false;
  for (let i = 0; i < 1500; i++) {
    if (i % 44 === 0) G.press('KeyA');
    if (i % 44 === 6) G.release('KeyA');
    if (i % 67 === 0) G.press('KeyD');
    if (i % 67 === 8) G.release('KeyD');
    if (i % 150 === 0 && anyLaneBall()) G.forceLaunch(0.8);
    R(1);
    const s = S();
    if (s.nan) hadNaN = true;
    for (const b of s.balls) if (!Number.isFinite(b.x) || !Number.isFinite(b.y) || b.x < -60 || b.x > 600 || b.y > 960) escaped = true;
  }
  G.clearKeys();
  ok(29, !hadNaN && !escaped && G.err.length === 0, `1500 帧快进无 NaN、无逃逸、无新报错（live=${S().liveBalls}）`);

  // 30 — audio state / autotest silence (no AudioContext is created by tests)
  audio.setState('tension');
  ok(30, !audio.hasCtx() && audio.state() === 'tension' && audio.isMuted(), '自测不建 AudioContext、配乐状态可切换且保持静音');

  // 31 — DOM shell present
  ok(31, !!titleEl && !!endEl && !!document.getElementById('startbtn') && !!document.getElementById('retrybtn') &&
    !!document.getElementById('homebtn') && !!muteBtn && !!pauseBtn && !!tflipL && !!tflipR && !!tlaunch, '标题/结算/静音/暂停/触控 DOM 齐备');

  // 32 — back to title, restore best
  G.goTitle();
  ok(32, S().mode === 'title' && !titleEl.classList.contains('hide'), '测完回到标题画面');
  try { localStorage.setItem(BEST_KEY, String(savedBest)); } catch (e) { }
  best = savedBest; setMuted(savedMute); syncBestDom();

  const pass = results.filter(r => r.ok).length;
  T.pass = pass; T.fail = results.length - pass; T.total = results.length;
  T.done = true;
  console.log(`[autotest] ${pass}/${results.length} passed`);
}
if (AUTOTEST) autotest();
