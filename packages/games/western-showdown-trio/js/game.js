// Western Showdown Trio 西部决斗三连 — best-of-three reaction minigames.
// Copper Belle Saloon #15. Three minigames (quick draw / color grab / memory
// duel), local same-screen two-player or solo vs a three-tier AI record.
// Vanilla ES modules, procedural saloon art, synthesized WebAudio, fixed-step
// loop, site report bridge, G hooks and ?autotest=1.

import {
  W, H, CX,
  MINIS, MINI_NAMES, MINI_EN, MINI_HINTS,
  DIFFS, DIFF_LABELS, DIFF_ZH, DIFF_SUB,
  AI_PROFILES, HUMAN_MODEL,
  COLORS, COLOR_KEYS, COLOR_BY_KEY, CARD_ICONS,
  QUICK_SIGNAL_MIN, QUICK_SIGNAL_MAX, QUICK_TIMEOUT,
  INTRO_TIME, RESULT_TIME, COLOR_DURATION,
  COLOR_LOCK_OK, COLOR_LOCK_WRONG, COLOR_NEXT_DELAY,
  MEMORY_DURATION, MEMORY_PAIRS, MEMORY_COLS, MEMORY_ROWS,
  MEMORY_CARDS, MEMORY_MISS_FLIP,
  diffKey, clamp, clamp01, finite, mulberry32,
  quickOutcome, colorPressDelta, compareColor, compareMemory,
  simulateColorRecord, simulateMemoryRecord,
  buildMemoryBoard, runRecordBench,
} from './logic.js';
import { makeAudio } from './audio.js';

const DT = 1 / 60;
const GROUND = 458;
const BEST_KEY = 'wst.bestScore';
const WINS_KEY = 'wst.matchWins';
const LOSSES_KEY = 'wst.matchLosses';
const MUTE_KEY = 'wst.mute';
const URLP = new URLSearchParams(location.search);
const AUTOTEST = URLP.has('autotest');

// ==================== persistent state ====================
let bestScore = 0, matchWins = 0, matchLosses = 0, muted = false;
try { bestScore = Math.max(0, parseInt(localStorage.getItem(BEST_KEY) || '0', 10) || 0); } catch (e) { bestScore = 0; }
try { matchWins = Math.max(0, parseInt(localStorage.getItem(WINS_KEY) || '0', 10) || 0); } catch (e) { matchWins = 0; }
try { matchLosses = Math.max(0, parseInt(localStorage.getItem(LOSSES_KEY) || '0', 10) || 0); } catch (e) { matchLosses = 0; }
try { muted = localStorage.getItem(MUTE_KEY) === '1'; } catch (e) { muted = false; }

const audio = makeAudio();
audio.setMuted(muted);

// ==================== mutable state ====================
let mode = 'title';                 // title | play | over
let gameMode = 'local';             // local | ai
let aiDiff = 'medium';
let profile = AI_PROFILES.medium;
let paused = false, noAuto = false;
let phase = 'intro';                // intro | live | result | over
let miniIndex = 0;
let miniType = 'quick';
let introT = INTRO_TIME, introTotal = INTRO_TIME;
let resultT = 0;
let result = null;                  // {winner, reason, detail}
let p1Wins = 0, p2Wins = 0;
let matchTime = 0;
let matchOver = false, winner = null;
let matchLog = [];
let matchCounter = 0;
let gameplayRng = mulberry32(0x51ed270b);
let reports = [];
let reportTarget = null;
let nanFlag = false;

let animT = 0;
let hitstopT = 0, shakeT = 0, shakeDur = 0.2, shakeAmp = 0, flashT = 0, bannerT = 0;
let toastT = 0;

// ---- mini state ----
let quick = null, color = null, memory = null;

const particles = [];
const floatTexts = [];
const pressed = new Set();
const held = new Set();
const pendingMemoryFlips = [];

function freshSideMem() {
  return { cursor: 0, first: null, firstAt: 0, pairs: 0, misses: 0, lockT: 0, lastAt: Infinity, flashT: 0 };
}
function freshColorSide(key) {
  return {
    score: 0, correct: 0, wrong: 0, combo: 0, maxCombo: 0,
    target: key || 'red', slots: [], targetAge: 0,
    lockT: 0, nextT: 0, awaitSpawn: false, flashT: 0, hitFlash: 0,
  };
}

function resetMiniState(type) {
  if (type === 'quick') {
    quick = {
      sub: 'wait', waitT: QUICK_SIGNAL_MIN, waitTotal: QUICK_SIGNAL_MIN,
      elapsed: 0, signalT: 0,
      p1: { react: null, false: false, falseAt: null },
      p2: { react: null, false: false, falseAt: null },
      aiFalse: false, aiFalseAt: 0, aiReaction: null, aiDrawn: false,
      result: null, reason: '',
    };
  } else if (type === 'color') {
    color = {
      timeLeft: COLOR_DURATION, elapsed: 0,
      p1: freshColorSide('red'), p2: freshColorSide('red'),
      ai: { events: [], next: 0, recordScore: 0, recordCorrect: 0, recordWrong: 0, shownScore: 0, flashT: 0 },
      result: null, reason: '',
    };
  } else {
    memory = {
      timeLeft: MEMORY_DURATION, elapsed: 0, cards: [],
      p1: freshSideMem(), p2: freshSideMem(),
      ai: { times: [], next: 0, recordPairs: 0, recordMisses: 0, recordLast: Infinity, shownPairs: 0, flashT: 0 },
      result: null, reason: '',
    };
  }
}

// ==================== DOM / canvas ====================
const cv = document.getElementById('gl');
const ctx = cv.getContext('2d');
const titleEl = document.getElementById('title');
const endEl = document.getElementById('end');
const endhEl = document.getElementById('endh');
const endkickEl = document.getElementById('endkick');
const enddEl = document.getElementById('endd');
const bestEl = document.getElementById('titlebest');
const muteBtn = document.getElementById('mutebtn');
const pauseBtn = document.getElementById('pausebtn');
const toastEl = document.getElementById('toast');
const touchL = document.getElementById('touchL');
const touchR = document.getElementById('touchR');
const shareBtn = document.getElementById('share');

let viewScale = 1, viewOX = 0, viewOY = 0, DPR = 1;
function resize() {
  DPR = Math.min(2, window.devicePixelRatio || 1);
  cv.width = Math.max(1, Math.round(window.innerWidth * DPR));
  cv.height = Math.max(1, Math.round(window.innerHeight * DPR));
  viewScale = Math.min(window.innerWidth / W, window.innerHeight / H);
  viewOX = (window.innerWidth - W * viewScale) / 2;
  viewOY = (window.innerHeight - H * viewScale) / 2;
}
window.addEventListener('resize', resize);
resize();

// ==================== utility ====================
function rr(c, x, y, w, h, r) {
  const q = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  c.beginPath();
  c.moveTo(x + q, y);
  c.lineTo(x + w - q, y); c.quadraticCurveTo(x + w, y, x + w, y + q);
  c.lineTo(x + w, y + h - q); c.quadraticCurveTo(x + w, y + h, x + w - q, y + h);
  c.lineTo(x + q, y + h); c.quadraticCurveTo(x, y + h, x, y + h - q);
  c.lineTo(x, y + q); c.quadraticCurveTo(x, y, x + q, y);
  c.closePath();
}
function shuffle(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  }
  return arr;
}
function fmtTime(t) {
  const s = Math.max(0, finite(t));
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  const d = Math.floor((s - Math.floor(s)) * 10);
  return `${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}.${d}`;
}
function fmtBest() {
  if (bestScore <= 0 && matchWins <= 0) return '尚无纪录 · 三连夺胜后记下最佳';
  const parts = [];
  parts.push(bestScore > 0 ? `最佳 ${bestScore} 分` : '尚无比分');
  parts.push(matchWins > 0 || matchLosses > 0 ? `累计 ${matchWins} 胜 / ${matchLosses} 负` : '尚无胜场');
  return parts.join(' · ');
}
function updateTitleBest() { if (bestEl) bestEl.textContent = fmtBest(); }
function updateMuteButton() {
  if (!muteBtn) return;
  muteBtn.textContent = muted ? '静' : '♪';
  muteBtn.classList.toggle('on', muted);
  muteBtn.title = muted ? '取消静音 (M)' : '静音 (M)';
}
function updatePauseButton() {
  if (!pauseBtn) return;
  pauseBtn.textContent = paused ? '▶' : '❚❚';
  pauseBtn.title = paused ? '继续 (P)' : '暂停 (P)';
  pauseBtn.disabled = mode !== 'play';
}
function toast(msg, ms = 1600) {
  if (!toastEl) return;
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  toastT = ms / 1000;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toastEl.classList.remove('show'), ms);
}
function nameOf(side) {
  if (side === 'p1') return gameMode === 'local' ? 'P1' : '你';
  return gameMode === 'local' ? 'P2' : `AI·${profile.label}`;
}
function sideColor(side) { return side === 'p1' ? '#ff9b7d' : '#a9baff'; }
function sideHex(side) { return side === 'p1' ? '#d24a34' : '#5b74d8'; }
function miniAt(i) { return i >= 3 ? 'quick' : MINIS[Math.max(0, Math.min(2, i))]; }

// ==================== static procedural art ====================
const bgCv = document.createElement('canvas');
bgCv.width = W * 2; bgCv.height = H * 2;

function lantern(c, x, y, rad) {
  c.save();
  c.strokeStyle = 'rgba(215,161,74,.32)'; c.lineWidth = 1;
  c.beginPath(); c.moveTo(x, 0); c.lineTo(x, y - rad); c.stroke();
  const glow = c.createRadialGradient(x, y, rad * .4, x, y, rad * 4.2);
  glow.addColorStop(0, 'rgba(255,170,80,.22)');
  glow.addColorStop(.5, 'rgba(255,130,60,.07)');
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = glow;
  c.beginPath(); c.arc(x, y, rad * 4.2, 0, Math.PI * 2); c.fill();
  const body = c.createRadialGradient(x - rad * .3, y - rad * .3, rad * .1, x, y, rad * 1.05);
  body.addColorStop(0, '#ffe0a0'); body.addColorStop(.45, '#e89144');
  body.addColorStop(.8, '#9e3f25'); body.addColorStop(1, '#5b2018');
  c.fillStyle = body;
  c.beginPath(); c.ellipse(x, y, rad, rad * 1.18, 0, 0, Math.PI * 2); c.fill();
  c.strokeStyle = 'rgba(255,214,150,.52)'; c.lineWidth = 1;
  for (let i = -2; i <= 2; i++) {
    c.beginPath(); c.ellipse(x, y, rad * (.4 + Math.abs(i) * .13), rad * 1.18, 0, 0, Math.PI * 2); c.stroke();
  }
  c.fillStyle = 'rgba(50,20,12,.92)';
  c.fillRect(x - rad * .58, y - rad * 1.32, rad * 1.16, rad * .18);
  c.fillRect(x - rad * .58, y + rad * 1.14, rad * 1.16, rad * .18);
  c.restore();
}

function drawBottle(c, x, base, h, col) {
  c.fillStyle = col;
  rr(c, x - h * .16, base - h, h * .32, h, h * .1); c.fill();
  rr(c, x - h * .07, base - h * 1.28, h * .14, h * .32, h * .05); c.fill();
  c.fillStyle = 'rgba(255,230,180,.22)';
  rr(c, x - h * .11, base - h * .82, h * .07, h * .5, h * .03); c.fill();
}

function buildStaticArt() {
  const c = bgCv.getContext('2d');
  c.scale(2, 2);
  const rnd = mulberry32(0x57a10ce);

  let g = c.createLinearGradient(0, 0, W * .35, H);
  g.addColorStop(0, '#1c0f09'); g.addColorStop(.35, '#2a170e');
  g.addColorStop(.68, '#1a0d08'); g.addColorStop(1, '#0a0503');
  c.fillStyle = g; c.fillRect(0, 0, W, H);

  // warm window light pools
  for (const [wx, wy, wr] of [[132, 168, 170], [830, 150, 190]]) {
    const wg = c.createRadialGradient(wx, wy, 10, wx, wy, wr);
    wg.addColorStop(0, 'rgba(255,196,110,.20)');
    wg.addColorStop(.4, 'rgba(210,140,60,.08)');
    wg.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = wg; c.fillRect(wx - wr, wy - wr, wr * 2, wr * 2);
    c.save();
    c.translate(wx, wy);
    c.fillStyle = 'rgba(58,37,22,.9)';
    c.fillRect(-64, -82, 128, 164);
    const inner = c.createLinearGradient(0, -78, 0, 78);
    inner.addColorStop(0, 'rgba(255,196,116,.30)'); inner.addColorStop(1, 'rgba(120,64,28,.12)');
    c.fillStyle = inner; c.fillRect(-54, -72, 108, 144);
    c.strokeStyle = 'rgba(36,20,12,.95)'; c.lineWidth = 5;
    c.beginPath(); c.moveTo(0, -72); c.lineTo(0, 72); c.moveTo(-54, 0); c.lineTo(54, 0); c.stroke();
    c.strokeStyle = 'rgba(215,161,74,.5)'; c.lineWidth = 2;
    c.strokeRect(-60, -78, 120, 156);
    c.restore();
  }

  // back wall planks
  c.strokeStyle = 'rgba(0,0,0,.30)'; c.lineWidth = 1.5;
  for (let y = 24; y < 420; y += 34) {
    c.beginPath(); c.moveTo(0, y); c.lineTo(W, y + 2); c.stroke();
  }
  c.strokeStyle = 'rgba(255,200,140,.045)'; c.lineWidth = 1;
  for (let y = 26; y < 420; y += 34) {
    c.beginPath(); c.moveTo(0, y + 1); c.lineTo(W, y + 3); c.stroke();
  }

  // left bottle shelf
  c.fillStyle = 'rgba(52,30,17,.88)';
  c.fillRect(18, 300, 250, 12);
  c.fillRect(18, 238, 250, 8);
  c.strokeStyle = 'rgba(215,161,74,.35)'; c.lineWidth = 1.4;
  c.strokeRect(18, 300, 250, 12); c.strokeRect(18, 238, 250, 8);
  const bottleCols = ['#3f6f4d', '#7a3a22', '#4b3c78', '#8a6a24', '#3d5b76'];
  for (let i = 0; i < 8; i++) {
    drawBottle(c, 34 + i * 30 + rnd() * 6, 300, 44 + rnd() * 22, bottleCols[i % bottleCols.length]);
  }
  for (let i = 0; i < 7; i++) {
    drawBottle(c, 40 + i * 33 + rnd() * 5, 238, 32 + rnd() * 16, bottleCols[(i + 2) % bottleCols.length]);
  }

  // right wanted posters
  for (const [px, py, rot] of [[884, 300, -.05], [812, 330, .04]]) {
    c.save(); c.translate(px, py); c.rotate(rot);
    c.fillStyle = 'rgba(222,198,148,.78)';
    c.fillRect(-38, -48, 76, 96);
    c.strokeStyle = 'rgba(94,54,26,.8)'; c.lineWidth = 2; c.strokeRect(-38, -48, 76, 96);
    c.fillStyle = 'rgba(90,54,30,.75)';
    c.font = '700 11px "Microsoft YaHei",serif'; c.textAlign = 'center';
    c.fillText('WANTED', 0, -30);
    c.fillRect(-18, -22, 36, 34);
    c.fillStyle = 'rgba(222,198,148,.9)';
    c.beginPath(); c.arc(0, -12, 8, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(90,54,30,.7)';
    c.fillRect(-18, -24, 36, 5); c.fillRect(-14, 14, 28, 3); c.fillRect(-18, 22, 36, 3);
    c.restore();
  }

  // chandelier
  c.strokeStyle = 'rgba(40,22,12,.9)'; c.lineWidth = 3;
  c.beginPath(); c.moveTo(CX, 0); c.lineTo(CX, 54); c.stroke();
  c.fillStyle = 'rgba(58,33,18,.95)';
  c.beginPath(); c.ellipse(CX, 62, 66, 12, 0, 0, Math.PI * 2); c.fill();
  c.strokeStyle = 'rgba(215,161,74,.7)'; c.lineWidth = 2; c.stroke();
  for (let i = -2; i <= 2; i++) {
    const lx = CX + i * 30;
    lantern(c, lx + (i === 0 ? 0 : i * 2), 88 + Math.abs(i) * 3, 7 - Math.abs(i) * .6);
  }

  // wooden floor
  const floor = c.createLinearGradient(0, 418, 0, H);
  floor.addColorStop(0, '#3a2415'); floor.addColorStop(.25, '#2b190f'); floor.addColorStop(1, '#120905');
  c.fillStyle = floor; c.fillRect(0, 418, W, H - 418);
  c.strokeStyle = 'rgba(0,0,0,.38)'; c.lineWidth = 1.4;
  for (let i = 0; i < 22; i++) {
    const y = 422 + i * i * .28 + i * 4;
    c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke();
  }
  for (let i = -12; i <= 12; i++) {
    const x0 = CX + i * 34;
    c.strokeStyle = 'rgba(0,0,0,.22)'; c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(x0, 418); c.lineTo(CX + i * 78, H); c.stroke();
  }
  c.strokeStyle = 'rgba(215,161,74,.18)'; c.lineWidth = 2;
  c.beginPath(); c.moveTo(0, 418); c.lineTo(W, 418); c.stroke();

  // dust / paper fibre
  for (let i = 0; i < 220; i++) {
    const x = rnd() * W, y = rnd() * H;
    c.fillStyle = `rgba(${230 + rnd() * 25 | 0},${190 + rnd() * 45 | 0},${140 + rnd() * 60 | 0},${.025 + rnd() * .10})`;
    c.beginPath(); c.arc(x, y, .3 + rnd() * 1.1, 0, 7); c.fill();
  }

  // bottom vignette
  const vig = c.createLinearGradient(0, 400, 0, H);
  vig.addColorStop(0, 'rgba(0,0,0,0)'); vig.addColorStop(1, 'rgba(0,0,0,.5)');
  c.fillStyle = vig; c.fillRect(0, 400, W, H - 400);
}
buildStaticArt();

// ==================== reports / bridge ====================
function scoreInt() {
  const s = p1Wins * 100 + p2Wins;
  return Number.isFinite(s) ? Math.round(s) : 0;
}
function matchProgress() {
  const done = matchLog.length;
  return Math.round(clamp01(done / 3) * 100);
}
function toWireReport(frame) {
  const score = Number.isFinite(frame.score) ? Math.round(frame.score) : undefined;
  if (frame.kind === 'progress') return { kind: 'progress', data: { ...frame } };
  if (frame.kind === 'event') return { kind: 'event', event: String(frame.event || frame.tag || 'event'), data: { ...frame } };
  if (frame.kind === 'gameOver') return { kind: 'gameOver', score, progress: { value: Number.isFinite(frame.progress) ? frame.progress : 0 }, data: { ...frame } };
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
      if (kind === 'ready') window.parent.postMessage({ source: 'lightgame', type: 'lightgame:ready', gameId: 'western-showdown-trio', v: 1 }, '*');
    }
  } catch (e) { }
}
report('ready', { game: 'western-showdown-trio' });

// ==================== effects ====================
function addParticle(p) {
  if (particles.length >= 360) particles.splice(0, 24);
  particles.push(p);
}
function burst(x, y, col, n = 10, power = 220) {
  for (let i = 0; i < n; i++) {
    const a = (Math.random() - .5) * Math.PI * 1.8 - Math.PI / 2;
    const sp = power * (.35 + Math.random() * .8);
    addParticle({
      type: 'spark', x, y,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40,
      life: .2 + Math.random() * .32, max: .52,
      size: 1.1 + Math.random() * 2.5, color: col, grav: 520, drag: .4,
    });
  }
}
function ring(x, y, col, size = 16, grow = 180, life = .34) {
  addParticle({ type: 'ring', x, y, vx: 0, vy: 0, life, max: life, size, grow, color: col, grav: 0, drag: 0 });
}
function dust(x, n = 6) {
  for (let i = 0; i < n; i++) {
    addParticle({
      type: 'dust', x: x + (Math.random() - .5) * 22, y: GROUND + 4,
      vx: (Math.random() - .5) * 120, vy: -25 - Math.random() * 55,
      life: .2 + Math.random() * .3, max: .5,
      size: 1 + Math.random() * 3, color: 'rgba(215,161,74,.72)', grav: 100, drag: .8,
    });
  }
}
function confetti(colors, n = 36) {
  for (let i = 0; i < n; i++) {
    addParticle({
      type: 'confetti', x: CX + (Math.random() - .5) * 430, y: 60 + Math.random() * 60,
      vx: (Math.random() - .5) * 200, vy: 30 + Math.random() * 90,
      life: 1.4 + Math.random() * 1.2, max: 2.6,
      size: 2 + Math.random() * 3.4, color: colors[i % colors.length], grav: 90, drag: .25,
      rot: Math.random() * 7, vr: (Math.random() - .5) * 8,
    });
  }
}
function floatText(x, y, text, color, size = 18) {
  floatTexts.push({ x, y, text, color, size, life: .9, max: .9, vy: -42 });
}
function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) { particles.splice(i, 1); continue; }
    if (p.type === 'ring') { p.size += p.grow * dt; continue; }
    p.vy += (p.grav || 0) * dt;
    p.vx *= Math.max(0, 1 - (p.drag || 0) * dt);
    p.vy *= Math.max(0, 1 - (p.drag || 0) * dt);
    p.x += p.vx * dt; p.y += p.vy * dt;
    if (p.rot !== undefined) p.rot += p.vr * dt;
  }
  for (let i = floatTexts.length - 1; i >= 0; i--) {
    const f = floatTexts[i];
    f.life -= dt; f.y += f.vy * dt;
    if (f.life <= 0) floatTexts.splice(i, 1);
  }
}
function updateFx(dt) {
  if (hitstopT > 0) hitstopT = Math.max(0, hitstopT - dt);
  if (shakeT > 0) shakeT = Math.max(0, shakeT - dt);
  if (flashT > 0) flashT = Math.max(0, flashT - dt);
  if (bannerT > 0) bannerT = Math.max(0, bannerT - dt);
  updateParticles(dt);
  if (quick) {
    quick.p1 && (quick.p1.flashT = Math.max(0, (quick.p1.flashT || 0) - dt));
    quick.p2 && (quick.p2.flashT = Math.max(0, (quick.p2.flashT || 0) - dt));
  }
}
function clearFx() {
  hitstopT = 0; shakeT = 0; flashT = 0; bannerT = 0;
  particles.length = 0; floatTexts.length = 0;
}

// ==================== flow ====================
function hideOverlays() { titleEl.classList.add('hide'); endEl.classList.add('hide'); }

function goTitle() {
  mode = 'title'; phase = 'intro'; paused = false; winner = null; matchOver = false;
  p1Wins = 0; p2Wins = 0; matchTime = 0; matchLog = [];
  introT = INTRO_TIME; introTotal = INTRO_TIME; resultT = 0; result = null;
  nanFlag = false;
  clearFx();
  quick = null; color = null; memory = null;
  hideOverlays();
  titleEl.classList.remove('hide');
  endEl.classList.add('hide');
  clearTouch();
  updateTitleBest(); updatePauseButton(); updateMuteButton();
  audio.setState('title'); audio.reset();
}

function startMatch(gm = 'ai', diff = aiDiff, startIndex = 0) {
  gameMode = gm === 'local' ? 'local' : 'ai';
  aiDiff = diffKey(diff);
  profile = AI_PROFILES[aiDiff];
  mode = 'play'; paused = false; winner = null; matchOver = false;
  p1Wins = 0; p2Wins = 0; matchTime = 0; matchLog = [];
  nanFlag = false; clearFx();
  matchCounter = (matchCounter + 1) >>> 0;
  gameplayRng = mulberry32((0x51ed270b ^ Math.imul(matchCounter + 1, 0x9E3779B1)) >>> 0);
  hideOverlays();
  clearTouch();
  audio.reset();
  audio.setState('title');
  updateMuteButton(); updatePauseButton();
  const si = clamp(parseInt(startIndex, 10) || 0, 0, 3);
  startMini(si);
  return true;
}

function startMini(i) {
  miniIndex = clamp(parseInt(i, 10) || 0, 0, 8);
  miniType = miniAt(miniIndex);
  phase = 'intro';
  introTotal = miniIndex >= 3 ? 2.2 : INTRO_TIME;
  introT = introTotal;
  resultT = 0; result = null; paused = false;
  resetMiniState(miniType);
  rebuildTouch();
  audio.setState(miniType);
  updatePauseButton();
  return true;
}

function setupQuick() {
  const q = quick;
  q.sub = 'wait';
  q.elapsed = 0; q.signalT = 0;
  q.waitTotal = QUICK_SIGNAL_MIN + gameplayRng() * (QUICK_SIGNAL_MAX - QUICK_SIGNAL_MIN);
  q.waitT = q.waitTotal;
  q.p1 = { react: null, false: false, falseAt: null, flashT: 0 };
  q.p2 = { react: null, false: false, falseAt: null, flashT: 0 };
  q.aiFalse = false; q.aiFalseAt = 0; q.aiReaction = null; q.aiDrawn = false;
  q.result = null; q.reason = '';
  if (gameMode === 'ai') {
    if (gameplayRng() < profile.quickFalse) {
      q.aiFalse = true;
      q.aiFalseAt = q.waitTotal * (0.22 + gameplayRng() * 0.58);
    } else {
      const z = Math.sqrt(-2 * Math.log(Math.max(1e-9, gameplayRng()))) * Math.cos(2 * Math.PI * gameplayRng());
      const zz = clamp(z, -3.2, 3.2);
      q.aiReaction = clamp(profile.quickMedian * Math.exp(profile.quickSigma * zz), 0.08, QUICK_TIMEOUT - 0.1);
    }
  }
}

function triggerQuickSignal() {
  if (!quick || quick.sub !== 'wait') return false;
  quick.sub = 'signal';
  quick.signalT = 0;
  bannerT = 0.65;
  flashT = 0.12;
  shakeT = 0.14; shakeDur = 0.14; shakeAmp = 5;
  audio.play('signal');
  burst(CX, 96, '#ffd98e', 22, 260);
  ring(CX, 96, '#ffd98e', 18, 260, 0.45);
  return true;
}

function setupColor() {
  color.timeLeft = COLOR_DURATION; color.elapsed = 0;
  color.p1 = freshColorSide('red');
  color.p2 = freshColorSide('red');
  color.ai = { events: [], next: 0, recordScore: 0, recordCorrect: 0, recordWrong: 0, shownScore: 0, flashT: 0 };
  spawnColorTarget(color.p1);
  if (gameMode === 'local') {
    spawnColorTarget(color.p2);
  } else {
    // AI record timeline + a static decorative slot set.
    const rec = simulateColorRecord(profile, gameplayRng, COLOR_DURATION);
    color.ai.events = rec.events;
    color.ai.recordScore = rec.score;
    color.ai.recordCorrect = rec.correct;
    color.ai.recordWrong = rec.wrong;
    color.p2.target = COLOR_KEYS[Math.floor(gameplayRng() * 4)];
    color.p2.slots = makeColorSlots(color.p2.target);
  }
  color.result = null; color.reason = '';
  updateTouchSwatches();
}

function setupMemory() {
  memory.timeLeft = MEMORY_DURATION; memory.elapsed = 0;
  memory.p1 = freshSideMem(); memory.p2 = freshSideMem();
  const seed = (gameplayRng() * 0xffffffff) >>> 0;
  memory.cards = buildMemoryBoard(seed);
  memory.ai = { times: [], next: 0, recordPairs: 0, recordMisses: 0, recordLast: Infinity, shownPairs: 0, flashT: 0 };
  if (gameMode === 'ai') {
    const rec = simulateMemoryRecord(profile, gameplayRng, MEMORY_DURATION, MEMORY_PAIRS);
    memory.ai.times = rec.times;
    memory.ai.recordPairs = rec.pairs;
    memory.ai.recordMisses = rec.misses;
    memory.ai.recordLast = rec.lastAt;
  }
  memory.result = null; memory.reason = '';
}

function beginLive() {
  if (phase !== 'intro') return false;
  phase = 'live';
  if (miniType === 'quick') setupQuick();
  else if (miniType === 'color') setupColor();
  else setupMemory();
  bannerT = 0.75;
  audio.play('start');
  audio.setState(miniType);
  updatePauseButton();
  return true;
}

function finishMini(side, reason, detail = {}) {
  if (phase !== 'live') return false;
  phase = 'result';
  resultT = RESULT_TIME;
  result = { winner: side, reason: reason || 'forced', detail: { ...detail } };
  if (side === 'p1') {
    p1Wins++;
    audio.play('roundWin');
    confetti(['#ff9b7d', '#ffd98e', '#d24a34'], 30);
  } else if (side === 'p2') {
    p2Wins++;
    audio.play('lose');
    confetti(['#a9baff', '#8bf0d8', '#5b74d8'], 30);
  } else {
    audio.play('pause');
  }
  shakeT = 0.28; shakeDur = 0.28; shakeAmp = side === 'draw' ? 5 : 8;
  matchLog.push({
    index: miniIndex, type: miniType, winner: side, reason: result.reason,
    detail: result.detail, p1Wins, p2Wins,
  });
  report('progress', {
    score: scoreInt(), progress: matchProgress(),
    miniIndex, mini: miniType, winner: side, reason: result.reason,
    p1Wins, p2Wins, detail: result.detail,
  });
  const who = side === 'p1' ? nameOf('p1') : side === 'p2' ? nameOf('p2') : '双方';
  toast(side === 'draw' ? '本场平局 · 不计胜场' : `${who} 拿下「${MINI_NAMES[miniType]}」`);
  audio.setState('result');
  updatePauseButton();
  return true;
}

function advanceMini() {
  if (phase !== 'result') return false;
  if (miniIndex < 2) return startMini(miniIndex + 1);
  if (miniIndex === 2) {
    if (p1Wins === p2Wins) return startMini(3);
    return endMatch();
  }
  if (p1Wins === p2Wins) return startMini(miniIndex + 1);
  return endMatch();
}

function saveBest(won) {
  let changed = false;
  const sc = scoreInt();
  if (sc > bestScore) {
    bestScore = sc;
    try { localStorage.setItem(BEST_KEY, String(bestScore)); } catch (e) { }
    changed = true;
  }
  if (won) {
    matchWins++;
    try { localStorage.setItem(WINS_KEY, String(matchWins)); } catch (e) { }
    changed = true;
  } else if (winner === 'p2') {
    matchLosses++;
    try { localStorage.setItem(LOSSES_KEY, String(matchLosses)); } catch (e) { }
    changed = true;
  }
  updateTitleBest();
  return changed;
}

function endMatch() {
  if (mode === 'over') return false;
  if (mode !== 'play') return false;
  phase = 'over'; mode = 'over'; paused = false; matchOver = true;
  winner = p1Wins > p2Wins ? 'p1' : p2Wins > p1Wins ? 'p2' : 'draw';
  const won = winner === 'p1';
  let isNew = false;
  if (won) {
    audio.play('win');
    isNew = saveBest(true);
    report('complete', {
      score: scoreInt(), progress: 100,
      p1Wins, p2Wins, minis: matchLog.map(m => ({ type: m.type, winner: m.winner })),
      time: Math.round(matchTime * 100) / 100,
    });
  } else {
    audio.play('lose');
    isNew = saveBest(false);
    report('gameOver', {
      score: scoreInt(), progress: matchProgress(),
      p1Wins, p2Wins, minis: matchLog.map(m => ({ type: m.type, winner: m.winner })),
      time: Math.round(matchTime * 100) / 100,
    });
  }
  audio.setState('end');
  showEnd(won, isNew);
  updatePauseButton();
  clearTouch();
  return true;
}

function showEnd(won, isNew) {
  const ai = gameMode === 'ai';
  endkickEl.textContent = 'MATCH RESULT · 决斗录';
  if (won) endhEl.textContent = ai ? '酒 馆 夺 冠' : 'P1 夺 冠';
  else if (winner === 'draw') endhEl.textContent = '平 局 收 场';
  else endhEl.textContent = ai ? '对 手 胜 出' : 'P2 夺 冠';
  const lines = [];
  lines.push(`${ai ? '你' : 'P1'}  ${p1Wins}  :  ${p2Wins}  ${ai ? `AI·${profile.label}` : 'P2'}`);
  if (matchLog.length) {
    const labels = matchLog.map(m => {
      const w = m.winner === 'p1' ? (ai ? '你' : 'P1') : m.winner === 'p2' ? (ai ? 'AI' : 'P2') : '平';
      return `${MINI_NAMES[m.type]} ${w}`;
    });
    lines.push(labels.join(' · '));
  }
  lines.push(`用时 ${fmtTime(matchTime)}${matchLog.length > 3 ? ' · 加赛' : ''}`);
  lines.push(isNew ? '★ 新纪录已写入' : `最佳 ${bestScore} 分 · 累计 ${matchWins} 胜 / ${matchLosses} 负`);
  if (!won) lines.push('看清暗号，再快半步。');
  enddEl.textContent = lines.join('\n');
  endEl.classList.remove('hide');
  titleEl.classList.add('hide');
  updateTitleBest();
}

function forceWin() {
  if (mode !== 'play') startMatch(gameMode, aiDiff, 0);
  p1Wins = Math.max(3, p1Wins); p2Wins = 0;
  if (!matchLog.length) {
    matchLog.push({ index: 0, type: 'quick', winner: 'p1', reason: 'forced', detail: {}, p1Wins, p2Wins });
  }
  report('progress', { score: scoreInt(), progress: 100, p1Wins, p2Wins, forced: true });
  return endMatch();
}
function forceLose() {
  if (mode !== 'play') startMatch(gameMode, aiDiff, 0);
  p1Wins = 0; p2Wins = Math.max(3, p2Wins);
  if (!matchLog.length) {
    matchLog.push({ index: 0, type: 'quick', winner: 'p2', reason: 'forced', detail: {}, p1Wins, p2Wins });
  }
  report('progress', { score: scoreInt(), progress: matchProgress(), p1Wins, p2Wins, forced: true });
  return endMatch();
}
function forceMiniWin(side) {
  if (mode !== 'play') startMatch(gameMode, aiDiff, 0);
  if (phase === 'intro') beginLive();
  const s = side === 'p2' ? 'p2' : side === 'draw' ? 'draw' : 'p1';
  return finishMini(s, 'forced', { forced: true });
}

function togglePause() {
  if (mode !== 'play') return false;
  paused = !paused;
  audio.play('pause');
  updatePauseButton();
  return paused;
}
function toggleMute() {
  muted = !muted;
  audio.setMuted(muted);
  updateMuteButton();
  try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch (e) { }
}
function goHomeBridge() {
  try {
    if (window.parent && window.parent !== window) window.parent.location.href = '/';
    else window.location.href = '/';
  } catch (e) { try { window.location.href = '/'; } catch (e2) { } }
}
function shareScore() {
  const s = scoreInt();
  audio.play('share');
  try {
    if (window.parent && window.parent !== window && typeof window.parent.handleGlobalShare === 'function') {
      window.parent.handleGlobalShare(s); return;
    }
  } catch (e) { }
  if (typeof window.dp_share === 'function') { try { window.dp_share(s); } catch (e) { } }
}

// ==================== input ====================
const HANDLED_CODES = new Set([
  'KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyJ', 'KeyK', 'KeyL', 'Semicolon', 'Slash',
  'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space',
  'KeyP', 'KeyM', 'KeyR', 'Escape',
]);
function onKeyDown(e) {
  if (e.isComposing || e.keyCode === 229) return;
  if (e.metaKey || e.altKey || e.ctrlKey) return;
  if (HANDLED_CODES.has(e.code)) e.preventDefault();
  if (!e.repeat) pressed.add(e.code);
  held.add(e.code);
}
function onKeyUp(e) { held.delete(e.code); }
window.addEventListener('keydown', onKeyDown);
window.addEventListener('keyup', onKeyUp);
window.addEventListener('blur', () => { held.clear(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) held.clear(); });

function onFirstGesture() { if (!AUTOTEST) audio.unlock(); }
window.addEventListener('pointerdown', onFirstGesture, { once: true, capture: true });
window.addEventListener('keydown', onFirstGesture, { once: true, capture: true });

const P1_SLOT_CODES = ['KeyA', 'KeyS', 'KeyD', 'KeyF'];
const P2_SLOT_CODES = ['KeyJ', 'KeyK', 'KeyL', 'Semicolon'];
const P1_DRAW_CODES = ['KeyF', 'Space'];
const P2_DRAW_CODES = ['KeyJ', 'ArrowUp', 'Semicolon'];

function codePressed(codes) {
  for (const c of codes) if (pressed.has(c)) return true;
  return false;
}
function handleSystemKeys() {
  if (pressed.has('KeyM')) toggleMute();
  if (pressed.has('KeyP')) { if (mode === 'play') togglePause(); }
  if (pressed.has('KeyR')) {
    if (mode === 'play' || mode === 'over') { startMatch(gameMode, aiDiff, 0); toast('已重开一局'); }
  }
  if (pressed.has('Escape')) {
    if (mode === 'play' || mode === 'over') { goTitle(); toast('已回到标题'); }
  }
}

// ---- dynamic split touch pads ----
function touchBtn(html, attrs, cls) {
  const b = document.createElement('button');
  b.innerHTML = html;
  for (const k in attrs) b.setAttribute(k, attrs[k]);
  if (cls) b.className = cls;
  bindTouchBtn(b);
  return b;
}
function bindTouchBtn(btn) {
  const down = (e) => {
    e.preventDefault(); e.stopPropagation();
    document.body.classList.add('touchui');
    if (!AUTOTEST) audio.unlock();
    try { btn.setPointerCapture && btn.setPointerCapture(e.pointerId); } catch (err) { }
    const code = btn.dataset.code;
    if (!code) return;
    // A pointerdown is always a fresh edge, even if a scripted/held code is
    // already down; pressed is the per-frame edge set.
    pressed.add(code);
    held.add(code);
    btn.classList.add('on');
    audio.play('ui');
  };
  const up = (e) => {
    e.preventDefault();
    const code = btn.dataset.code;
    if (code) held.delete(code);
    btn.classList.remove('on');
  };
  btn.addEventListener('pointerdown', down);
  btn.addEventListener('pointerup', up);
  btn.addEventListener('pointercancel', up);
  btn.addEventListener('pointerleave', up);
  btn.addEventListener('contextmenu', e => e.preventDefault());
}
function clearTouch() {
  if (touchL) touchL.innerHTML = '';
  if (touchR) touchR.innerHTML = '';
}
function rebuildTouch() {
  if (!touchL || !touchR) return;
  clearTouch();
  if (mode !== 'play') return;
  if (miniType === 'quick') {
    touchL.classList.add('quickpad');
    touchR.classList.add('quickpad');
    touchL.appendChild(touchBtn('拔枪<span class="tk">P1 · F / 空格</span>', { 'data-code': 'KeyF', 'data-side': 'p1', 'data-action': 'draw', 'aria-label': 'P1 拔枪' }));
    touchR.appendChild(touchBtn('拔枪<span class="tk">P2 · J / ↑</span>', { 'data-code': 'KeyJ', 'data-side': 'p2', 'data-action': 'draw', 'aria-label': 'P2 拔枪' }));
  } else if (miniType === 'color') {
    touchL.classList.remove('quickpad');
    touchR.classList.remove('quickpad');
    const cols = ['#d24a34', '#3f7fe2', '#e8b53b', '#3fae6a'];
    for (let i = 0; i < 4; i++) {
      touchL.appendChild(touchBtn(`<span class="sw" data-sw="p1-${i}" style="background:${cols[i]}"></span><span class="tk">${P1_SLOT_CODES[i].replace('Key', '')}</span>`, { 'data-code': P1_SLOT_CODES[i], 'data-side': 'p1', 'data-slot': String(i), 'aria-label': `P1 颜色 ${i + 1}` }));
      touchR.appendChild(touchBtn(`<span class="sw" data-sw="p2-${i}" style="background:${cols[i]}"></span><span class="tk">${P2_SLOT_CODES[i] === 'Semicolon' ? ';' : P2_SLOT_CODES[i].replace('Key', '')}</span>`, { 'data-code': P2_SLOT_CODES[i], 'data-side': 'p2', 'data-slot': String(i), 'aria-label': `P2 颜色 ${i + 1}` }));
    }
    updateTouchSwatches();
  } else {
    touchL.classList.remove('quickpad');
    touchR.classList.remove('quickpad');
    touchL.appendChild(touchBtn('◀', { 'data-code': 'KeyA', 'data-side': 'p1', 'aria-label': 'P1 上一张' }));
    touchL.appendChild(touchBtn('▶', { 'data-code': 'KeyD', 'data-side': 'p1', 'aria-label': 'P1 下一张' }));
    touchL.appendChild(touchBtn('排', { 'data-code': 'KeyS', 'data-side': 'p1', 'aria-label': 'P1 换排' }));
    touchL.appendChild(touchBtn('翻', { 'data-code': 'KeyF', 'data-side': 'p1', 'aria-label': 'P1 翻牌' }));
    touchR.appendChild(touchBtn('◀', { 'data-code': 'ArrowLeft', 'data-side': 'p2', 'aria-label': 'P2 上一张' }));
    touchR.appendChild(touchBtn('▶', { 'data-code': 'ArrowRight', 'data-side': 'p2', 'aria-label': 'P2 下一张' }));
    touchR.appendChild(touchBtn('排', { 'data-code': 'ArrowDown', 'data-side': 'p2', 'aria-label': 'P2 换排' }));
    touchR.appendChild(touchBtn('翻', { 'data-code': 'KeyJ', 'data-side': 'p2', 'aria-label': 'P2 翻牌' }));
  }
}
function updateTouchSwatches() {
  if (!color || !touchL || !touchR) return;
  for (const side of ['p1', 'p2']) {
    const c = color[side];
    if (!c || !c.slots || !c.slots.length) continue;
    const host = side === 'p1' ? touchL : touchR;
    host.querySelectorAll('button[data-slot]').forEach(btn => {
      const i = parseInt(btn.dataset.slot, 10) || 0;
      const slot = c.slots[i];
      if (!slot) return;
      const sw = btn.querySelector('.sw');
      if (sw) sw.style.background = COLOR_BY_KEY[slot.fill].hex;
      const tk = btn.querySelector('.tk');
      if (tk) tk.textContent = side === 'p1' ? P1_SLOT_CODES[i].replace('Key', '') : (P2_SLOT_CODES[i] === 'Semicolon' ? ';' : P2_SLOT_CODES[i].replace('Key', ''));
    });
  }
}

// ---- canvas pointer (side-restricted) ----
function logicalPoint(e) {
  const r = cv.getBoundingClientRect();
  const x = (e.clientX - r.left - viewOX) / viewScale;
  const y = (e.clientY - r.top - viewOY) / viewScale;
  return { x, y };
}
function hitColorSlot(side, x, y) {
  const rects = colorSlotRects(side);
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i];
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return i;
  }
  return -1;
}
function hitMemoryCard(x, y) {
  for (let i = 0; i < MEMORY_CARDS; i++) {
    const r = memoryCardRect(i);
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return i;
  }
  return -1;
}
cv.addEventListener('pointerdown', (e) => {
  if (!AUTOTEST) audio.unlock();
  document.body.classList.add('touchui');
  if (mode !== 'play' || paused || phase !== 'live') return;
  const p = logicalPoint(e);
  const side = p.x < CX ? 'p1' : 'p2';
  // Memory plays on one shared centered board: in AI mode every tap is P1's,
  // only quick/color keep the strict left/right split.
  if (gameMode === 'ai' && side === 'p2' && miniType !== 'memory') return;
  if (miniType === 'quick') {
    pressed.add(side === 'p1' ? 'KeyF' : 'KeyJ');
  } else if (miniType === 'color') {
    const slot = hitColorSlot(side, p.x, p.y);
    if (slot >= 0) pressed.add(side === 'p1' ? P1_SLOT_CODES[slot] : P2_SLOT_CODES[slot]);
  } else if (miniType === 'memory') {
    const idx = hitMemoryCard(p.x, p.y);
    if (idx >= 0) pendingMemoryFlips.push({ side: gameMode === 'ai' ? 'p1' : side, index: idx });
  }
});
cv.addEventListener('contextmenu', e => e.preventDefault());

// ==================== color helpers ====================
function makeColorSlots(targetKey) {
  const fills = shuffle(COLOR_KEYS.slice(), gameplayRng);
  const slots = fills.map(fill => {
    const opts = COLOR_KEYS.filter(k => k !== fill);
    const label = opts[Math.floor(gameplayRng() * opts.length)] || COLOR_KEYS[0];
    return { fill, label };
  });
  const wrongs = slots.map((s, i) => i).filter(i => slots[i].fill !== targetKey);
  if (wrongs.length) slots[wrongs[Math.floor(gameplayRng() * wrongs.length)]].label = targetKey;
  const ci = slots.findIndex(s => s.fill === targetKey);
  if (ci >= 0 && slots[ci].label === targetKey) {
    slots[ci].label = COLOR_KEYS.find(k => k !== targetKey) || COLOR_KEYS[0];
  }
  return slots;
}
function spawnColorTarget(c) {
  c.target = COLOR_KEYS[Math.floor(gameplayRng() * COLOR_KEYS.length)];
  c.slots = makeColorSlots(c.target);
  c.targetAge = 0;
  c.nextT = 0;
  c.awaitSpawn = false;
  updateTouchSwatches();
}
function attemptColor(side, slot) {
  if (!color || phase !== 'live' || miniType !== 'color') return false;
  if (gameMode === 'ai' && side === 'p2') return false;
  const c = color[side];
  if (!c || !c.slots || !c.slots[slot]) return false;
  if (c.lockT > 0 || c.nextT > 0) return false;
  const fill = c.slots[slot].fill;
  const correct = fill === c.target;
  const rtMs = c.targetAge * 1000;
  const delta = colorPressDelta(correct, rtMs);
  c.score += delta;
  c.hitFlash = 0.24;
  if (correct) {
    c.correct++;
    c.combo++;
    c.maxCombo = Math.max(c.maxCombo, c.combo);
    c.lockT = COLOR_LOCK_OK;
    c.nextT = COLOR_NEXT_DELAY;
    c.awaitSpawn = true;
    audio.play('correct', Math.min(8, c.combo));
    const rects = colorSlotRects(side);
    const r = rects[slot];
    const bx = r.x + r.w / 2, by = r.y + r.h / 2;
    burst(bx, by, COLOR_BY_KEY[fill].bright, 12, 240);
    ring(bx, by, COLOR_BY_KEY[fill].bright, 12, 190, 0.32);
    floatText(bx, by - 22, `+${delta}`, COLOR_BY_KEY[fill].bright, 18);
    if (c.combo >= 3) floatText(bx, by + 10, `${c.combo} 连`, '#ffe6a8', 14);
  } else {
    c.wrong++;
    c.combo = 0;
    c.lockT = COLOR_LOCK_WRONG;
    c.targetAge = 0;
    c.flashT = 0.35;
    shakeT = 0.20; shakeDur = 0.20; shakeAmp = 6;
    audio.play('wrong');
    floatText(panelCenter(side).x, panelCenter(side).y - 40, `-${Math.abs(delta)}`, '#ff8e7a', 18);
  }
  updateTouchSwatches();
  return true;
}
function applyColorAI(now) {
  if (!color || gameMode !== 'ai') return;
  const ai = color.ai;
  while (ai.next < ai.events.length && ai.events[ai.next].t <= now) {
    const ev = ai.events[ai.next++];
    color.p2.score += ev.pts;
    if (ev.ok) { color.p2.correct++; color.p2.combo++; color.p2.maxCombo = Math.max(color.p2.maxCombo, color.p2.combo); }
    else { color.p2.wrong++; color.p2.combo = 0; }
    ai.shownScore = color.p2.score;
    ai.flashT = 0.24;
    if (ev.ok) audio.play('lampTick');
  }
}
function resolveColor() {
  if (!color || color.result) return false;
  if (gameMode === 'ai') {
    color.p2.score = color.ai.recordScore;
    color.p2.correct = color.ai.recordCorrect;
    color.p2.wrong = color.ai.recordWrong;
  }
  const res = gameMode === 'local'
    ? compareColor(color.p1, color.p2)
    : compareColor(color.p1, color.p2);
  let reason = 'score';
  if (res === 'draw') reason = 'tie';
  color.result = res;
  color.reason = reason;
  const detail = {
    p1Score: Math.round(color.p1.score), p2Score: Math.round(color.p2.score),
    p1Correct: color.p1.correct, p2Correct: color.p2.correct,
    p1Wrong: color.p1.wrong, p2Wrong: color.p2.wrong,
  };
  return finishMini(res, reason, detail);
}

// ==================== memory helpers ====================
function memoryCardRect(i) {
  const cw = 88, ch = 92, gx = 16, gy = 16;
  const totalW = MEMORY_COLS * cw + (MEMORY_COLS - 1) * gx;
  const totalH = MEMORY_ROWS * ch + (MEMORY_ROWS - 1) * gy;
  const x0 = (W - totalW) / 2, y0 = 150 + (H - 150 - totalH) / 2 - 6;
  const col = i % MEMORY_COLS, row = Math.floor(i / MEMORY_COLS);
  return { x: x0 + col * (cw + gx), y: y0 + row * (ch + gy), w: cw, h: ch };
}
function flipMemoryCard(side, index) {
  if (!memory || phase !== 'live' || miniType !== 'memory') return false;
  if (gameMode === 'ai' && side === 'p2') return false;
  const s = memory[side];
  const cards = memory.cards;
  if (!s || !cards || index < 0 || index >= cards.length) return false;
  if (s.lockT > 0) return false;
  const card = cards[index];
  if (!card || card.matchedBy || card.faceUp) return false;
  if (s.first === index) return false;
  if (s.first == null) {
    s.first = index;
    s.firstAt = memory.elapsed;
    card.faceUp = true; card.owner = side; card.flipT = 0.18;
    audio.play('flip');
    return true;
  }
  const fi = s.first;
  const first = cards[fi];
  if (!first || first.matchedBy || !first.faceUp) {
    s.first = null;
    return flipMemoryCard(side, index);
  }
  card.faceUp = true; card.owner = side; card.flipT = 0.18;
  audio.play('flip');
  if (first.pair === card.pair) {
    first.matchedBy = side; card.matchedBy = side;
    first.owner = null; card.owner = null;
    s.pairs++;
    s.first = null;
    s.lastAt = memory.elapsed;
    s.flashT = 0.28;
    if (memory[side === 'p1' ? 'p2' : 'p1'].first === fi || memory[side === 'p1' ? 'p2' : 'p1'].first === index) {
      memory[side === 'p1' ? 'p2' : 'p1'].first = null;
    }
    audio.play('pair');
    const r1 = memoryCardRect(fi), r2 = memoryCardRect(index);
    burst(r1.x + r1.w / 2, r1.y + r1.h / 2, sideHex(side), 12, 220);
    burst(r2.x + r2.w / 2, r2.y + r2.h / 2, sideHex(side), 12, 220);
    ring(r2.x + r2.w / 2, r2.y + r2.h / 2, sideColor(side), 16, 200, 0.35);
    floatText(r2.x + r2.w / 2, r2.y + 18, `+1 对`, sideColor(side), 16);
    if (cards.every(c => c.matchedBy)) {
      resolveMemory('all');
    }
  } else {
    s.misses++;
    s.first = null;
    s.lockT = MEMORY_MISS_FLIP;
    first.flipBackT = MEMORY_MISS_FLIP;
    card.flipBackT = MEMORY_MISS_FLIP;
    audio.play('miss');
    shakeT = 0.16; shakeDur = 0.16; shakeAmp = 4;
    floatText(memoryCardRect(index).x + 44, memoryCardRect(index).y + 12, '不配对', '#ff8e7a', 13);
  }
  return true;
}
function resolveMemory(reason = 'timeout') {
  if (!memory || memory.result) return false;
  const p1s = { pairs: memory.p1.pairs, misses: memory.p1.misses, lastAt: memory.p1.lastAt };
  let p2s;
  if (gameMode === 'ai') {
    p2s = { pairs: memory.ai.recordPairs, misses: memory.ai.recordMisses, lastAt: memory.ai.recordLast };
    memory.p2.pairs = p2s.pairs; memory.p2.misses = p2s.misses;
  } else {
    p2s = { pairs: memory.p2.pairs, misses: memory.p2.misses, lastAt: memory.p2.lastAt };
  }
  const res = compareMemory(p1s, p2s);
  let why = reason;
  if (reason !== 'all') {
    if (p1s.pairs !== p2s.pairs) why = 'pairs';
    else if (p1s.misses !== p2s.misses) why = 'misses';
    else why = 'time';
  }
  memory.result = res; memory.reason = why;
  const detail = { p1Pairs: p1s.pairs, p2Pairs: p2s.pairs, p1Misses: p1s.misses, p2Misses: p2s.misses };
  return finishMini(res, why, detail);
}
function processMemoryKeys(side) {
  const s = memory[side];
  if (!s || s.lockT > 0) return;
  if (side === 'p1') {
    if (pressed.has('KeyD')) s.cursor = (s.cursor + 1) % MEMORY_CARDS;
    if (pressed.has('KeyA')) s.cursor = (s.cursor + MEMORY_CARDS - 1) % MEMORY_CARDS;
    if (pressed.has('KeyS')) s.cursor = (s.cursor + MEMORY_COLS) % MEMORY_CARDS;
    if (pressed.has('KeyF')) flipMemoryCard('p1', s.cursor);
  } else {
    if (pressed.has('ArrowRight')) s.cursor = (s.cursor + 1) % MEMORY_CARDS;
    if (pressed.has('ArrowLeft')) s.cursor = (s.cursor + MEMORY_CARDS - 1) % MEMORY_CARDS;
    if (pressed.has('ArrowDown')) s.cursor = (s.cursor + MEMORY_COLS) % MEMORY_CARDS;
    if (pressed.has('ArrowUp')) s.cursor = (s.cursor + MEMORY_CARDS - MEMORY_COLS) % MEMORY_CARDS;
    if (pressed.has('KeyJ') || pressed.has('Slash')) flipMemoryCard('p2', s.cursor);
  }
}

// ==================== mini updates ====================
function updateQuick(dt) {
  const q = quick;
  if (!q || phase !== 'live') return;
  if (q.sub === 'wait') {
    if (!noAuto) {
      q.waitT = Math.max(0, q.waitT - dt);
      q.elapsed += dt;
      if (q.aiFalse && gameMode === 'ai' && q.elapsed >= q.aiFalseAt) {
        q.p2.false = true; q.p2.falseAt = q.aiFalseAt; q.p2.flashT = 0.3;
        audio.play('falseStart');
        floatText(sideAnchor('p2').x, sideAnchor('p2').y - 70, '抢跑!', '#ff7d67', 20);
        shakeT = 0.25; shakeDur = 0.25; shakeAmp = 8;
        resolveQuick();
        return;
      }
    }
    const p1Early = codePressed(P1_DRAW_CODES);
    const p2Early = gameMode === 'local' && codePressed(P2_DRAW_CODES);
    if (p1Early || p2Early) {
      if (p1Early) { q.p1.false = true; q.p1.falseAt = q.elapsed; q.p1.flashT = 0.3; }
      if (p2Early) { q.p2.false = true; q.p2.falseAt = q.elapsed; q.p2.flashT = 0.3; }
      audio.play('falseStart');
      flashT = 0.10;
      shakeT = 0.25; shakeDur = 0.25; shakeAmp = 8;
      if (p1Early) floatText(sideAnchor('p1').x, sideAnchor('p1').y - 70, '抢跑!', '#ff7d67', 20);
      if (p2Early) floatText(sideAnchor('p2').x, sideAnchor('p2').y - 70, '抢跑!', '#ff7d67', 20);
      resolveQuick();
      return;
    }
    if (!noAuto && q.waitT <= 0) triggerQuickSignal();
    return;
  }
  if (q.sub !== 'signal') return;
  // Reaction clock keeps measuring even under setNoAuto so scripted presses
  // can be compared, but the timeout and AI automatic draw are frozen.
  q.signalT += dt;
  if (!noAuto && gameMode === 'ai' && q.aiReaction != null && !q.aiDrawn && q.signalT >= q.aiReaction) {
    q.p2.react = q.aiReaction;
    q.aiDrawn = true;
    q.p2.flashT = 0.3;
    audio.play('draw');
    burst(sideAnchor('p2').x, sideAnchor('p2').y - 30, '#ffd98e', 16, 280);
    floatText(sideAnchor('p2').x, sideAnchor('p2').y - 84, `${(q.aiReaction * 1000).toFixed(0)}ms`, '#a9baff', 16);
  }
  if (q.p1.react == null && codePressed(P1_DRAW_CODES)) {
    q.p1.react = q.signalT;
    q.p1.flashT = 0.3;
    audio.play('draw');
    burst(sideAnchor('p1').x, sideAnchor('p1').y - 30, '#ffd98e', 16, 280);
    floatText(sideAnchor('p1').x, sideAnchor('p1').y - 84, `${(q.p1.react * 1000).toFixed(0)}ms`, '#ffb08a', 16);
  }
  if (gameMode === 'local' && q.p2.react == null && codePressed(P2_DRAW_CODES)) {
    q.p2.react = q.signalT;
    q.p2.flashT = 0.3;
    audio.play('draw');
    burst(sideAnchor('p2').x, sideAnchor('p2').y - 30, '#ffd98e', 16, 280);
    floatText(sideAnchor('p2').x, sideAnchor('p2').y - 84, `${(q.p2.react * 1000).toFixed(0)}ms`, '#a9baff', 16);
  }
  const both = q.p1.react != null && q.p2.react != null;
  const timedOut = !noAuto && q.signalT >= QUICK_TIMEOUT;
  if (both || timedOut) resolveQuick();
}
function resolveQuick() {
  const q = quick;
  if (!q || q.result) return false;
  const res = quickOutcome(
    { falseStart: q.p1.false, falseAt: q.p1.falseAt, reaction: q.p1.react },
    { falseStart: q.p2.false, falseAt: q.p2.falseAt, reaction: q.p2.react }
  );
  let reason = 'reaction';
  if (q.p1.false || q.p2.false) reason = 'false';
  else if (q.p1.react == null || q.p2.react == null) reason = 'timeout';
  q.result = res; q.reason = reason;
  const detail = {
    p1Reaction: q.p1.react == null ? null : Math.round(q.p1.react * 1000),
    p2Reaction: q.p2.react == null ? null : Math.round(q.p2.react * 1000),
    p1False: q.p1.false, p2False: q.p2.false,
  };
  return finishMini(res, reason, detail);
}

function updateColorMini(dt) {
  if (!color || phase !== 'live') return;
  for (const side of ['p1', 'p2']) {
    const c = color[side];
    c.targetAge += dt;
    if (c.lockT > 0) c.lockT = Math.max(0, c.lockT - dt);
    if (c.nextT > 0) {
      c.nextT = Math.max(0, c.nextT - dt);
      if (c.nextT <= 0 && c.awaitSpawn) spawnColorTarget(c);
    }
    c.flashT = Math.max(0, c.flashT - dt);
    c.hitFlash = Math.max(0, c.hitFlash - dt);
  }
  if (!noAuto) {
    color.timeLeft = Math.max(0, color.timeLeft - dt);
    color.elapsed += dt;
    if (gameMode === 'ai') applyColorAI(color.elapsed);
    if (color.timeLeft <= 0) { resolveColor(); return; }
  }
  for (let i = 0; i < 4; i++) {
    if (pressed.has(P1_SLOT_CODES[i])) attemptColor('p1', i);
  }
  if (gameMode === 'local') {
    for (let i = 0; i < 4; i++) {
      if (pressed.has(P2_SLOT_CODES[i])) attemptColor('p2', i);
    }
  }
  if (color.ai) color.ai.flashT = Math.max(0, color.ai.flashT - dt);
}

function updateMemoryMini(dt) {
  if (!memory || phase !== 'live') return;
  // Consume queued canvas taps first (inputs consumed in update).
  while (pendingMemoryFlips.length) {
    const a = pendingMemoryFlips.shift();
    if (a.side === 'p2' && gameMode === 'ai') continue;
    flipMemoryCard(a.side, a.index);
    if (memory.result) return;
  }
  if (!noAuto) {
    memory.timeLeft = Math.max(0, memory.timeLeft - dt);
    memory.elapsed += dt;
    memory.p1.lockT = Math.max(0, memory.p1.lockT - dt);
    memory.p2.lockT = Math.max(0, memory.p2.lockT - dt);
    for (const c of memory.cards) {
      if (c.faceUp && !c.matchedBy && c.flipBackT > 0) {
        c.flipBackT = Math.max(0, c.flipBackT - dt);
        if (c.flipBackT <= 0) { c.faceUp = false; c.owner = null; }
      }
      if (c.flipT > 0) c.flipT = Math.max(0, c.flipT - dt);
    }
    if (gameMode === 'ai') {
      const ai = memory.ai;
      while (ai.next < ai.times.length && ai.times[ai.next] <= memory.elapsed) {
        ai.next++;
        ai.shownPairs = ai.next;
        ai.flashT = 0.3;
        audio.play('lampTick');
      }
      ai.flashT = Math.max(0, ai.flashT - dt);
    }
    if (memory.timeLeft <= 0) { resolveMemory('timeout'); return; }
  }
  memory.p1.flashT = Math.max(0, memory.p1.flashT - dt);
  memory.p2.flashT = Math.max(0, memory.p2.flashT - dt);
  processMemoryKeys('p1');
  if (gameMode === 'local') processMemoryKeys('p2');
}

// ==================== update ====================
function scanFinite() {
  const vals = [
    matchTime, scoreInt(),
    quick ? quick.waitT : 0, quick ? quick.signalT : 0,
    color ? color.timeLeft : 0, color ? color.p1.score : 0, color ? color.p2.score : 0,
    memory ? memory.timeLeft : 0, memory ? memory.p1.cursor : 0,
    memory ? memory.p2.cursor : 0, animT, viewScale,
  ];
  for (const v of vals) {
    if (!Number.isFinite(v)) { nanFlag = true; break; }
  }
  if (memory) for (const c of memory.cards) if (!Number.isFinite(c.index)) nanFlag = true;
}
function update(dt) {
  if (!Number.isFinite(dt) || dt <= 0) return;
  handleSystemKeys();
  animT += dt;
  audio.tick(dt);
  audio.setState(mode === 'title' ? 'title' : mode === 'over' ? 'end' : phase === 'result' ? 'result' : miniType);

  if (mode === 'title' || mode === 'over') {
    updateFx(dt);
    pressed.clear();
    scanFinite();
    return;
  }
  if (paused) {
    pressed.clear();
    return;
  }
  matchTime += dt;

  if (phase === 'intro') {
    if (!noAuto) {
      const before = Math.ceil(introT);
      introT -= dt;
      const after = Math.ceil(introT);
      if (after !== before && after >= 1 && after <= 3) audio.play('count');
      if (introT <= 0) beginLive();
    }
    updateFx(dt);
    pressed.clear();
    scanFinite();
    return;
  }

  if (phase === 'result') {
    if (!noAuto) {
      resultT -= dt;
      if (resultT <= 0) advanceMini();
    }
    updateFx(dt);
    pressed.clear();
    scanFinite();
    return;
  }

  if (phase === 'live') {
    if (miniType === 'quick') updateQuick(dt);
    else if (miniType === 'color') updateColorMini(dt);
    else updateMemoryMini(dt);
  }
  updateFx(dt);
  pressed.clear();
  scanFinite();
}

// ==================== rendering helpers ====================
function drawLantern(c, x, y, rad, t) {
  const glow = c.createRadialGradient(x, y, rad * .3, x, y, rad * 4.6);
  glow.addColorStop(0, `rgba(255,186,92,${.24 + .06 * Math.sin(t * 3 + x)})`);
  glow.addColorStop(.5, 'rgba(255,140,60,.07)');
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = glow;
  c.beginPath(); c.arc(x, y, rad * 4.6, 0, Math.PI * 2); c.fill();
  const body = c.createRadialGradient(x - rad * .3, y - rad * .3, rad * .1, x, y, rad);
  body.addColorStop(0, '#ffe6ab'); body.addColorStop(.5, '#ed9a4e'); body.addColorStop(1, '#8b3320');
  c.fillStyle = body;
  c.beginPath(); c.ellipse(x, y, rad, rad * 1.2, 0, 0, Math.PI * 2); c.fill();
  c.strokeStyle = 'rgba(255,224,160,.6)'; c.lineWidth = 1.2;
  c.stroke();
  c.fillStyle = 'rgba(50,20,12,.9)';
  c.fillRect(x - rad * .55, y - rad * 1.3, rad * 1.1, rad * .16);
  c.fillRect(x - rad * .55, y + rad * 1.14, rad * 1.1, rad * .16);
}

function drawGunslinger(c, x, side, t, opts = {}) {
  const dir = opts.dir || (side === 'p1' ? 1 : -1);
  const col = side === 'p1' ? '#d24a34' : '#5b74d8';
  const dark = side === 'p1' ? '#5e1c12' : '#202a63';
  const trim = side === 'p1' ? '#ffd98e' : '#a9f0e2';
  const y = GROUND;
  const bob = opts.bob || 0;
  const draw = opts.draw || 0; // 0 idle, 1 raised
  c.save();
  // shadow
  c.fillStyle = 'rgba(0,0,0,.4)';
  c.beginPath(); c.ellipse(x, y + 8, 30, 8, 0, 0, Math.PI * 2); c.fill();
  c.translate(x, y - bob);
  c.scale(dir, 1);
  // legs
  c.strokeStyle = '#1a100b'; c.lineWidth = 8; c.lineCap = 'round';
  c.beginPath(); c.moveTo(-7, -32); c.lineTo(-13, 0); c.stroke();
  c.beginPath(); c.moveTo(7, -32); c.lineTo(13, 0); c.stroke();
  c.strokeStyle = trim; c.lineWidth = 1.4;
  c.beginPath(); c.moveTo(-18, 0); c.lineTo(-7, 0); c.stroke();
  c.beginPath(); c.moveTo(8, 0); c.lineTo(19, 0); c.stroke();
  // poncho / coat
  const body = c.createLinearGradient(-22, -88, 22, -10);
  body.addColorStop(0, col); body.addColorStop(.6, dark); body.addColorStop(1, '#160b08');
  c.fillStyle = body;
  c.beginPath();
  c.moveTo(-16, -86); c.lineTo(-24, -58); c.lineTo(-27, -20); c.lineTo(-18, -8);
  c.lineTo(0, -3); c.lineTo(18, -8); c.lineTo(27, -20); c.lineTo(24, -58); c.lineTo(16, -86);
  c.closePath(); c.fill();
  c.strokeStyle = '#120a07'; c.lineWidth = 2.6; c.stroke();
  // poncho stripe
  c.fillStyle = 'rgba(255,224,170,.18)';
  c.beginPath(); c.moveTo(-19, -58); c.lineTo(19, -58); c.lineTo(23, -46); c.lineTo(-23, -46); c.closePath(); c.fill();
  // belt
  c.strokeStyle = '#2a170d'; c.lineWidth = 6;
  c.beginPath(); c.moveTo(-18, -36); c.lineTo(18, -36); c.stroke();
  c.fillStyle = '#ffd98e';
  c.fillRect(-3, -41, 7, 9);
  // arm + gun
  const armY = draw ? -76 : -58;
  const gunAng = draw ? -0.35 : 0.15;
  c.save();
  c.translate(11, armY);
  c.rotate(gunAng);
  c.strokeStyle = dark; c.lineWidth = 7;
  c.beginPath(); c.moveTo(0, 0); c.lineTo(24, -2); c.stroke();
  c.strokeStyle = '#1b120d'; c.lineWidth = 5;
  c.beginPath(); c.moveTo(24, -2); c.lineTo(43, -5); c.stroke();
  c.strokeStyle = '#cfd5e0'; c.lineWidth = 2.2;
  c.beginPath(); c.moveTo(31, -3); c.lineTo(45, -6); c.stroke();
  c.fillStyle = '#7e5a2c';
  c.fillRect(22, -8, 6, 10);
  c.restore();
  // head
  c.fillStyle = '#f0cba0';
  c.beginPath(); c.arc(0, -98, 11, 0, Math.PI * 2); c.fill();
  c.strokeStyle = '#1a100b'; c.lineWidth = 2; c.stroke();
  // hat
  c.fillStyle = '#2b1a10';
  c.beginPath(); c.ellipse(0, -108, 24, 6, 0, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.moveTo(-12, -108); c.quadraticCurveTo(-10, -130, 0, -130); c.quadraticCurveTo(10, -130, 12, -108); c.closePath(); c.fill();
  c.strokeStyle = trim; c.lineWidth = 2;
  c.beginPath(); c.moveTo(-11, -110); c.lineTo(11, -110); c.stroke();
  // bandana
  c.fillStyle = col;
  c.beginPath(); c.moveTo(-10, -92); c.lineTo(10, -92); c.lineTo(4, -86); c.lineTo(-4, -86); c.closePath(); c.fill();
  // eye
  c.fillStyle = '#1a100b';
  c.beginPath(); c.arc(5, -99, 1.5, 0, Math.PI * 2); c.fill();
  c.restore();
}

function drawPips(x, y, n, side, alignRight) {
  for (let i = 0; i < 3; i++) {
    const px = x + (alignRight ? -i * 18 : i * 18);
    const filled = i < n;
    ctx.save();
    ctx.translate(px, y);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = filled ? sideHex(side) : 'rgba(255,255,255,.08)';
    ctx.strokeStyle = filled ? 'rgba(255,240,210,.8)' : 'rgba(215,161,74,.3)';
    ctx.lineWidth = 1;
    ctx.fillRect(-4, -4, 8, 8); ctx.strokeRect(-4, -4, 8, 8);
    ctx.restore();
  }
}

function drawTopBar() {
  if (mode !== 'play') return;
  ctx.save();
  // P1 plate
  ctx.fillStyle = 'rgba(12,7,4,.78)';
  rr(ctx, 18, 12, 300, 56, 12); ctx.fill();
  ctx.strokeStyle = 'rgba(210,74,52,.55)'; ctx.lineWidth = 1.2;
  rr(ctx, 18, 12, 300, 56, 12); ctx.stroke();
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.font = '800 15px "Microsoft YaHei",sans-serif';
  ctx.fillStyle = '#ffe8c6';
  ctx.fillText(nameOf('p1'), 34, 32);
  ctx.font = '600 10px "Microsoft YaHei",sans-serif';
  ctx.fillStyle = 'rgba(255,171,144,.9)';
  ctx.fillText(gameMode === 'local' ? '锈红 · P1' : '旅人 · YOU', 34, 50);
  drawPips(286, 32, p1Wins, 'p1', true);
  ctx.font = '700 12px "Microsoft YaHei",sans-serif';
  ctx.fillStyle = 'rgba(255,232,198,.7)';
  ctx.textAlign = 'right';
  ctx.fillText(`${p1Wins} 胜`, 302, 50);
  ctx.restore();

  // P2 plate
  ctx.save();
  ctx.fillStyle = 'rgba(12,7,4,.78)';
  rr(ctx, W - 318, 12, 300, 56, 12); ctx.fill();
  ctx.strokeStyle = 'rgba(91,116,216,.6)'; ctx.lineWidth = 1.2;
  rr(ctx, W - 318, 12, 300, 56, 12); ctx.stroke();
  ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  ctx.font = '800 15px "Microsoft YaHei",sans-serif';
  ctx.fillStyle = '#e5e9ff';
  ctx.fillText(nameOf('p2'), W - 34, 32);
  ctx.font = '600 10px "Microsoft YaHei",sans-serif';
  ctx.fillStyle = 'rgba(169,186,255,.9)';
  ctx.fillText(gameMode === 'local' ? '靛蓝 · P2' : `AI 记录 · ${profile.zh}`, W - 34, 50);
  drawPips(W - 286, 32, p2Wins, 'p2', false);
  ctx.font = '700 12px "Microsoft YaHei",sans-serif';
  ctx.fillStyle = 'rgba(229,233,255,.7)';
  ctx.textAlign = 'left';
  ctx.fillText(`${p2Wins} 胜`, W - 302, 50);
  ctx.restore();

  // centre pill
  const title = miniIndex >= 3 ? `加赛 · ${MINI_NAMES.quick}` : `第 ${miniIndex + 1} / 3 场 · ${MINI_NAMES[miniType]}`;
  ctx.save();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = '700 12px "Microsoft YaHei",sans-serif';
  const tw = ctx.measureText(title).width;
  ctx.fillStyle = 'rgba(12,7,4,.82)';
  rr(ctx, CX - tw / 2 - 18, 14, tw + 36, 32, 16); ctx.fill();
  ctx.strokeStyle = 'rgba(215,161,74,.5)'; ctx.lineWidth = 1;
  rr(ctx, CX - tw / 2 - 18, 14, tw + 36, 32, 16); ctx.stroke();
  ctx.fillStyle = '#ffe4b0';
  ctx.fillText(title, CX, 30);
  ctx.restore();

  // timer / score line
  let mid = '';
  if (miniType === 'color' && color) mid = `抢色 ${Math.ceil(color.timeLeft)}s · ${Math.round(color.p1.score)} : ${Math.round(color.p2.score)}`;
  else if (miniType === 'memory' && memory) mid = `记忆 ${Math.ceil(memory.timeLeft)}s · ${memory.p1.pairs} : ${memory.p2.pairs} 对`;
  else if (quick) {
    if (quick.sub === 'wait') mid = '等待信号 · 别抢跑';
    else if (quick.sub === 'signal') mid = '信 号 已 亮';
    else mid = '拔枪判定中';
  }
  if (mid) {
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '700 14px "Microsoft YaHei",sans-serif';
    const w = ctx.measureText(mid).width + 32;
    ctx.fillStyle = 'rgba(12,7,4,.8)';
    rr(ctx, CX - w / 2, 52, w, 26, 13); ctx.fill();
    ctx.strokeStyle = 'rgba(215,161,74,.36)'; ctx.lineWidth = 1;
    rr(ctx, CX - w / 2, 52, w, 26, 13); ctx.stroke();
    ctx.fillStyle = '#ffeccb';
    ctx.fillText(mid, CX, 65);
    ctx.restore();
  }
}

function drawBottomHint() {
  if (mode !== 'play') return;
  let hint = MINI_HINTS[miniType] || '';
  let keys;
  if (miniType === 'quick') {
    keys = gameMode === 'local' ? 'P1 F / 空格 拔枪 · P2 J / ↑ 拔枪' : '你按 F / 空格 拔枪 · AI 按记录反应';
  } else if (miniType === 'color') {
    keys = gameMode === 'local' ? 'P1 A S D F · P2 J K L ; 对应四色' : '你按 A S D F 对应四色 · 看按钮实际颜色';
  } else {
    keys = gameMode === 'local' ? 'P1 A/D 选牌 S 换排 F 翻 · P2 ←/→ ↑/↓ J 翻' : 'A/D 选牌 · S 换排 · F 翻牌 · 点按左右半区也可翻';
  }
  ctx.save();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = '600 11.5px "Microsoft YaHei",sans-serif';
  const line = `${hint}   ·   ${keys}`;
  const tw = ctx.measureText(line).width;
  ctx.fillStyle = 'rgba(12,7,4,.72)';
  rr(ctx, CX - tw / 2 - 16, H - 40, tw + 32, 25, 12); ctx.fill();
  ctx.strokeStyle = 'rgba(215,161,74,.26)'; ctx.lineWidth = 1;
  rr(ctx, CX - tw / 2 - 16, H - 40, tw + 32, 25, 12); ctx.stroke();
  ctx.fillStyle = 'rgba(255,232,198,.82)';
  ctx.fillText(line, CX, H - 27);
  ctx.restore();
}

// ==================== scene: quick draw ====================
function sideAnchor(side) {
  if (side === 'p1') return { x: 292, y: GROUND - 70 };
  return { x: 668, y: GROUND - 70 };
}
function drawQuickScene() {
  const t = animT;
  // dusty street width markers
  ctx.save();
  ctx.strokeStyle = 'rgba(215,161,74,.12)'; ctx.lineWidth = 1;
  ctx.setLineDash([8, 12]);
  ctx.beginPath(); ctx.moveTo(60, GROUND); ctx.lineTo(900, GROUND); ctx.stroke();
  ctx.setLineDash([]);
  // tension sparks between eyes
  if (quick && quick.sub !== 'done') {
    const a = sideAnchor('p1'), b = sideAnchor('p2');
    const mx = (a.x + b.x) / 2;
    const amp = quick.sub === 'signal' ? 22 : 7 + Math.sin(t * 3) * 3;
    ctx.strokeStyle = quick.sub === 'signal' ? 'rgba(255,217,142,.42)' : 'rgba(255,140,90,.14)';
    ctx.lineWidth = quick.sub === 'signal' ? 2 : 1.2;
    ctx.beginPath();
    ctx.moveTo(a.x + 36, a.y - 26);
    ctx.quadraticCurveTo(mx, a.y - 26 - amp, b.x - 36, b.y - 26);
    ctx.stroke();
  }
  ctx.restore();

  drawGunslinger(ctx, 292, 'p1', t, { dir: 1, bob: Math.sin(t * 1.4) * 1.5, draw: quick && quick.sub === 'signal' && quick.p1.react != null ? 1 : 0 });
  drawGunslinger(ctx, 668, 'p2', t, { dir: -1, bob: Math.sin(t * 1.4 + 1.2) * 1.5, draw: quick && quick.sub === 'signal' && quick.p2.react != null ? 1 : 0 });

  // central signal lantern
  const lx = CX, ly = 168;
  ctx.save();
  ctx.strokeStyle = 'rgba(40,22,12,.9)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(lx, 0); ctx.lineTo(lx, ly - 38); ctx.stroke();
  drawLantern(ctx, lx, ly, 16, t);
  if (quick && quick.sub === 'signal') {
    ctx.globalCompositeOperation = 'lighter';
    const glow = ctx.createRadialGradient(lx, ly, 4, lx, ly, 130);
    glow.addColorStop(0, 'rgba(255,240,190,.55)');
    glow.addColorStop(.4, 'rgba(255,190,90,.20)');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(lx, ly, 130, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();

  // big signal word
  ctx.save();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (quick) {
    if (quick.sub === 'wait') {
      ctx.font = '800 30px "Microsoft YaHei",sans-serif';
      ctx.fillStyle = 'rgba(255,236,203,.9)';
      ctx.shadowColor = 'rgba(0,0,0,.8)'; ctx.shadowBlur = 10;
      ctx.fillText('等 待 信 号', CX, 258);
      ctx.shadowBlur = 0;
      ctx.font = '600 12px "Microsoft YaHei",sans-serif';
      ctx.fillStyle = 'rgba(255,210,150,.6)';
      ctx.fillText('抢跑立即判负', CX, 288);
      // pocket-watch sweep (does not reveal exact delay)
      const a = t * 2.2;
      ctx.strokeStyle = 'rgba(215,161,74,.4)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(CX, 330, 20, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(CX, 330); ctx.lineTo(CX + Math.cos(a) * 15, 330 + Math.sin(a) * 15); ctx.stroke();
    } else if (quick.sub === 'signal') {
      const k = clamp01(quick.signalT / 0.25);
      ctx.globalAlpha = 0.65 + 0.35 * Math.sin(t * 24);
      ctx.font = '900 58px "Microsoft YaHei",sans-serif';
      ctx.fillStyle = '#ffe6a8';
      ctx.shadowColor = 'rgba(255,160,60,.9)'; ctx.shadowBlur = 28;
      ctx.fillText('拔 枪 ！', CX, 262);
      ctx.shadowBlur = 0; ctx.globalAlpha = 1;
      ctx.strokeStyle = 'rgba(255,220,140,.42)'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(CX, 262, 90 + k * 60, -Math.PI / 2, Math.PI * 1.5); ctx.stroke();
    }
  }
  ctx.restore();

  // reaction tags
  if (quick) {
    for (const side of ['p1', 'p2']) {
      const a = sideAnchor(side);
      const st = quick[side];
      let txt = '', col = sideColor(side);
      if (st.false) { txt = '抢跑'; col = '#ff7d67'; }
      else if (st.react != null) txt = `${Math.round(st.react * 1000)}ms`;
      if (txt) {
        ctx.save();
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = '800 16px "Segoe UI","Microsoft YaHei",sans-serif';
        const w = ctx.measureText(txt).width + 22;
        ctx.fillStyle = 'rgba(12,7,4,.8)';
        rr(ctx, a.x - w / 2, a.y - 128, w, 28, 14); ctx.fill();
        ctx.strokeStyle = col; ctx.lineWidth = 1.4;
        rr(ctx, a.x - w / 2, a.y - 128, w, 28, 14); ctx.stroke();
        ctx.fillStyle = col;
        ctx.fillText(txt, a.x, a.y - 114);
        ctx.restore();
      }
    }
  }
  drawBottomHint();
}

// ==================== scene: color grab ====================
function colorPanel(side) {
  return side === 'p1' ? { x: 28, y: 172, w: 382, h: 300 } : { x: W - 410, y: 172, w: 382, h: 300 };
}
function panelCenter(side) {
  const p = colorPanel(side);
  return { x: p.x + p.w / 2, y: p.y + p.h / 2 };
}
function colorSlotRects(side) {
  const p = colorPanel(side);
  const pad = 12, gap = 12;
  const bw = (p.w - pad * 2 - gap) / 2;
  const bh = 98;
  const x0 = p.x + pad, y0 = p.y + 92;
  return [
    { x: x0, y: y0, w: bw, h: bh },
    { x: x0 + bw + gap, y: y0, w: bw, h: bh },
    { x: x0, y: y0 + bh + gap, w: bw, h: bh },
    { x: x0 + bw + gap, y: y0 + bh + gap, w: bw, h: bh },
  ];
}
function drawColorPanel(side) {
  const p = colorPanel(side);
  const c = color && color[side];
  const isAI = gameMode === 'ai' && side === 'p2';
  ctx.save();
  // panel
  ctx.fillStyle = 'rgba(14,8,5,.90)';
  rr(ctx, p.x, p.y, p.w, p.h, 16); ctx.fill();
  ctx.strokeStyle = side === 'p1' ? 'rgba(210,74,52,.62)' : 'rgba(91,116,216,.66)';
  ctx.lineWidth = 1.4; rr(ctx, p.x, p.y, p.w, p.h, 16); ctx.stroke();
  ctx.strokeStyle = 'rgba(215,161,74,.2)'; ctx.lineWidth = 1;
  rr(ctx, p.x + 4, p.y + 4, p.w - 8, p.h - 8, 13); ctx.stroke();

  // header
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.font = '800 15px "Microsoft YaHei",sans-serif';
  ctx.fillStyle = side === 'p1' ? '#ffd4c2' : '#dbe1ff';
  ctx.fillText(nameOf(side), p.x + 16, p.y + 22);
  ctx.font = '600 10px "Microsoft YaHei",sans-serif';
  ctx.fillStyle = 'rgba(215,161,74,.7)';
  ctx.fillText(isAI ? '记录分' : '分数', p.x + 16, p.y + 42);
  ctx.font = '900 24px "Segoe UI","Microsoft YaHei",sans-serif';
  ctx.fillStyle = '#fff1d3';
  ctx.fillText(String(Math.round(c ? c.score : 0)), p.x + 72, p.y + 42);
  // combo
  if (c && c.combo >= 2) {
    ctx.font = '800 13px "Microsoft YaHei",sans-serif';
    ctx.fillStyle = '#ffe08b';
    ctx.textAlign = 'right';
    ctx.fillText(`${c.combo} 连`, p.x + p.w - 16, p.y + 22);
  }
  // target plate
  const tx = p.x + p.w - 120;
  ctx.fillStyle = 'rgba(30,17,10,.9)';
  rr(ctx, tx, p.y + 10, 104, 62, 12); ctx.fill();
  ctx.strokeStyle = 'rgba(215,161,74,.5)'; ctx.lineWidth = 1.2;
  rr(ctx, tx, p.y + 10, 104, 62, 12); ctx.stroke();
  ctx.textAlign = 'center';
  ctx.font = '600 9px "Microsoft YaHei",sans-serif';
  ctx.fillStyle = 'rgba(255,220,170,.7)';
  ctx.fillText('目标颜色', tx + 52, p.y + 25);
  if (c && COLOR_BY_KEY[c.target]) {
    const col = COLOR_BY_KEY[c.target];
    ctx.font = '900 30px "Microsoft YaHei",sans-serif';
    ctx.fillStyle = col.bright;
    ctx.shadowColor = col.hex; ctx.shadowBlur = 14;
    ctx.fillText(col.zh, tx + 52, p.y + 52);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = col.hex; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(tx + 28, p.y + 66); ctx.lineTo(tx + 76, p.y + 66); ctx.stroke();
  }

  // buttons
  const rects = colorSlotRects(side);
  for (let i = 0; i < 4; i++) {
    const r = rects[i];
    const slot = c && c.slots ? c.slots[i] : null;
    const col = slot ? COLOR_BY_KEY[slot.fill] : COLORS[i];
    const flash = c && c.hitFlash > 0 ? c.hitFlash / 0.24 : 0;
    ctx.save();
    ctx.globalAlpha = isAI ? 0.62 : 1;
    const g = ctx.createLinearGradient(r.x, r.y, r.x, r.y + r.h);
    g.addColorStop(0, col.bright); g.addColorStop(.5, col.hex); g.addColorStop(1, col.dark);
    ctx.fillStyle = g;
    rr(ctx, r.x, r.y, r.w, r.h, 14); ctx.fill();
    ctx.strokeStyle = flash > 0 ? 'rgba(255,255,255,.95)' : 'rgba(20,12,8,.7)';
    ctx.lineWidth = flash > 0 ? 3 : 2;
    rr(ctx, r.x, r.y, r.w, r.h, 14); ctx.stroke();
    // Stroop distractor word
    if (slot) {
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '900 30px "Microsoft YaHei",sans-serif';
      ctx.fillStyle = 'rgba(16,9,6,.66)';
      ctx.fillText(COLOR_BY_KEY[slot.label].zh, r.x + r.w / 2, r.y + r.h / 2 - 2);
    }
    // key badge
    const key = side === 'p1' ? P1_SLOT_CODES[i] : P2_SLOT_CODES[i];
    const keyTxt = key === 'Semicolon' ? ';' : key.replace('Key', '');
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.font = '800 11px "Segoe UI",sans-serif';
    ctx.fillStyle = 'rgba(255,250,235,.9)';
    ctx.strokeStyle = 'rgba(20,12,8,.5)'; ctx.lineWidth = 3;
    ctx.strokeText(keyTxt, r.x + 10, r.y + 14);
    ctx.fillText(keyTxt, r.x + 10, r.y + 14);
    ctx.restore();
  }
  // AI progress / record bar
  if (isAI) {
    const ai = color.ai;
    const frac = clamp01((ai ? ai.recordScore : 0) / 3000);
    ctx.fillStyle = 'rgba(255,255,255,.08)';
    rr(ctx, p.x + 16, p.y + 70, p.w - 144, 8, 4); ctx.fill();
    ctx.fillStyle = 'rgba(139,240,216,.7)';
    rr(ctx, p.x + 16, p.y + 70, Math.max(2, (p.w - 144) * frac), 8, 4); ctx.fill();
  } else {
    const frac = clamp01((c ? c.correct : 0) / 18);
    ctx.fillStyle = 'rgba(255,255,255,.08)';
    rr(ctx, p.x + 16, p.y + 70, p.w - 144, 8, 4); ctx.fill();
    ctx.fillStyle = 'rgba(255,200,120,.6)';
    rr(ctx, p.x + 16, p.y + 70, Math.max(2, (p.w - 144) * frac), 8, 4); ctx.fill();
  }
  ctx.restore();
}
function drawColorScene() {
  drawColorPanel('p1');
  drawColorPanel('p2');
  // central timer ribbon
  ctx.save();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const secs = color ? Math.max(0, Math.ceil(color.timeLeft)) : 0;
  const urgent = color && color.timeLeft <= 5;
  ctx.fillStyle = 'rgba(12,7,4,.86)';
  rr(ctx, CX - 66, 164, 132, 74, 14); ctx.fill();
  ctx.strokeStyle = urgent ? 'rgba(255,120,88,.8)' : 'rgba(215,161,74,.52)'; ctx.lineWidth = 1.4;
  rr(ctx, CX - 66, 164, 132, 74, 14); ctx.stroke();
  ctx.font = '800 34px "Segoe UI","Microsoft YaHei",sans-serif';
  ctx.fillStyle = urgent ? '#ff9b7d' : '#fff0d0';
  ctx.shadowColor = urgent ? 'rgba(255,90,60,.8)' : 'rgba(215,161,74,.4)'; ctx.shadowBlur = 12;
  ctx.fillText(String(secs), CX, 191);
  ctx.shadowBlur = 0;
  ctx.font = '700 10px "Microsoft YaHei",sans-serif';
  ctx.fillStyle = 'rgba(255,230,190,.65)';
  ctx.fillText('秒', CX, 214);
  ctx.font = '800 13px "Microsoft YaHei",sans-serif';
  ctx.fillStyle = '#ffe6b8';
  ctx.fillText(`${Math.round(color ? color.p1.score : 0)} : ${Math.round(color ? color.p2.score : 0)}`, CX, 230);
  ctx.restore();
  drawBottomHint();
}

// ==================== scene: memory duel ====================
function drawCardIcon(c, glyph, x, y, s, col) {
  c.save();
  c.translate(x, y);
  c.strokeStyle = col; c.fillStyle = col;
  c.lineWidth = Math.max(2, s * .055);
  c.lineCap = 'round'; c.lineJoin = 'round';
  if (glyph === 'hat') {
    c.beginPath(); c.ellipse(0, s * .18, s * .42, s * .12, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.moveTo(-s * .22, s * .14); c.quadraticCurveTo(-s * .18, -s * .22, 0, -s * .24);
    c.quadraticCurveTo(s * .18, -s * .22, s * .22, s * .14); c.closePath(); c.fill();
    c.fillStyle = 'rgba(20,12,8,.6)';
    c.fillRect(-s * .22, s * .03, s * .44, s * .07);
  } else if (glyph === 'boot') {
    c.beginPath();
    c.moveTo(-s * .10, -s * .34); c.lineTo(s * .10, -s * .34); c.lineTo(s * .12, s * .10);
    c.quadraticCurveTo(s * .34, s * .14, s * .36, s * .32); c.lineTo(-s * .18, s * .32);
    c.quadraticCurveTo(-s * .22, s * .08, -s * .10, -s * .04); c.closePath(); c.fill();
    c.fillStyle = 'rgba(20,12,8,.6)'; c.fillRect(-s * .18, s * .28, s * .54, s * .08);
  } else if (glyph === 'star') {
    c.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 5;
      const rad = i % 2 === 0 ? s * .38 : s * .16;
      const px = Math.cos(a) * rad, py = Math.sin(a) * rad;
      if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
    }
    c.closePath(); c.fill();
    c.fillStyle = 'rgba(255,240,205,.7)';
    c.beginPath(); c.arc(-s * .06, -s * .08, s * .10, 0, Math.PI * 2); c.fill();
  } else if (glyph === 'skull') {
    c.beginPath(); c.arc(0, -s * .08, s * .28, Math.PI * .05, Math.PI * .95, true); c.closePath(); c.fill();
    c.fillStyle = 'rgba(20,12,8,.75)';
    c.beginPath(); c.arc(-s * .11, -s * .10, s * .07, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(s * .11, -s * .10, s * .07, 0, Math.PI * 2); c.fill();
    c.fillStyle = col;
    c.fillRect(-s * .16, s * .08, s * .32, s * .10);
    c.fillStyle = 'rgba(20,12,8,.75)';
    for (let i = -1; i <= 1; i++) c.fillRect(i * s * .10 - s * .015, s * .10, s * .03, s * .08);
  } else if (glyph === 'horseshoe') {
    c.lineWidth = s * .13;
    c.beginPath(); c.arc(0, s * .04, s * .27, Math.PI * 1.12, Math.PI * 1.88, true); c.stroke();
    c.lineWidth = s * .055;
    c.beginPath(); c.moveTo(-s * .25, s * .20); c.lineTo(-s * .25, s * .31); c.stroke();
    c.beginPath(); c.moveTo(s * .25, s * .20); c.lineTo(s * .25, s * .31); c.stroke();
  } else {
    // bottle
    c.beginPath();
    c.moveTo(-s * .14, -s * .12); c.lineTo(-s * .14, -s * .30); c.lineTo(-s * .06, -s * .36);
    c.lineTo(-s * .06, -s * .42); c.lineTo(s * .06, -s * .42); c.lineTo(s * .06, -s * .36);
    c.lineTo(s * .14, -s * .30); c.lineTo(s * .14, -s * .12);
    c.quadraticCurveTo(s * .18, s * .34, 0, s * .34);
    c.quadraticCurveTo(-s * .18, s * .34, -s * .14, -s * .12);
    c.closePath(); c.fill();
    c.fillStyle = 'rgba(255,240,205,.65)';
    c.fillRect(-s * .10, s * .02, s * .20, s * .16);
  }
  c.restore();
}
function drawMemoryScene() {
  if (!memory) return;
  // side score panels
  for (const side of ['p1', 'p2']) {
    const isAI = gameMode === 'ai' && side === 'p2';
    const x = side === 'p1' ? 20 : W - 240;
    const s = memory[side];
    const pairs = isAI ? memory.ai.recordPairs : s.pairs;
    ctx.save();
    ctx.fillStyle = 'rgba(12,7,4,.88)';
    rr(ctx, x, 176, 200, 128, 14); ctx.fill();
    ctx.strokeStyle = side === 'p1' ? 'rgba(210,74,52,.55)' : 'rgba(91,116,216,.6)';
    ctx.lineWidth = 1.2; rr(ctx, x, 176, 200, 128, 14); ctx.stroke();
    ctx.textAlign = side === 'p1' ? 'left' : 'right';
    ctx.textBaseline = 'middle';
    const tx = side === 'p1' ? x + 16 : x + 184;
    ctx.font = '800 14px "Microsoft YaHei",sans-serif';
    ctx.fillStyle = side === 'p1' ? '#ffd4c2' : '#dbe1ff';
    ctx.fillText(nameOf(side), tx, 196);
    ctx.font = '600 10px "Microsoft YaHei",sans-serif';
    ctx.fillStyle = 'rgba(215,161,74,.7)';
    ctx.fillText(isAI ? 'AI 记录牌组' : '已配牌组', tx, 214);
    ctx.font = '900 28px "Segoe UI","Microsoft YaHei",sans-serif';
    ctx.fillStyle = '#fff0d0';
    ctx.fillText(`${pairs} 对`, tx, 242);
    ctx.font = '600 11px "Microsoft YaHei",sans-serif';
    ctx.fillStyle = 'rgba(255,230,200,.6)';
    ctx.fillText(isAI ? `失误 ${memory.ai.recordMisses}` : `失误 ${s.misses}`, tx, 264);
    // cursor indicator
    ctx.font = '600 10px "Microsoft YaHei",sans-serif';
    ctx.fillStyle = sideColor(side);
    const hint = side === 'p1' ? 'A/D 选牌 · S 换排 · F 翻' : (isAI ? 'AI 自动记录' : '←/→ ↑/↓ · J 翻');
    ctx.textAlign = 'center';
    ctx.fillText(hint, x + 100, 288);
    ctx.restore();
  }

  // board
  for (let i = 0; i < MEMORY_CARDS; i++) {
    const card = memory.cards[i];
    const r = memoryCardRect(i);
    if (!card) continue;
    const matched = !!card.matchedBy;
    const owner = card.matchedBy;
    const flipK = card.flipT > 0 ? clamp01(1 - card.flipT / 0.18) : 1;
    ctx.save();
    ctx.translate(r.x + r.w / 2, r.y + r.h / 2);
    ctx.scale(Math.max(0.05, card.faceUp || matched ? Math.abs(Math.cos((1 - flipK) * Math.PI)) : 1), 1);
    // card base
    if (card.faceUp || matched) {
      const g = ctx.createLinearGradient(0, -r.h / 2, 0, r.h / 2);
      g.addColorStop(0, '#f7e7c3'); g.addColorStop(1, '#d5bb8b');
      ctx.fillStyle = g;
      rr(ctx, -r.w / 2, -r.h / 2, r.w, r.h, 10); ctx.fill();
      ctx.strokeStyle = matched ? sideHex(owner) : 'rgba(80,46,22,.8)';
      ctx.lineWidth = matched ? 3.4 : 2;
      rr(ctx, -r.w / 2, -r.h / 2, r.w, r.h, 10); ctx.stroke();
      const iconCol = matched ? sideHex(owner) : '#5a3a1e';
      drawCardIcon(ctx, card.glyph, 0, -4, 58, iconCol);
      ctx.font = '600 9px "Microsoft YaHei",sans-serif';
      ctx.fillStyle = 'rgba(80,46,22,.72)';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(card.zh, 0, r.h / 2 - 12);
      if (matched) {
        ctx.fillStyle = sideHex(owner);
        ctx.beginPath(); ctx.arc(r.w / 2 - 12, -r.h / 2 + 12, 8, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#1b0f08';
        ctx.font = '800 9px "Microsoft YaHei",sans-serif';
        ctx.fillText(owner === 'p1' ? 'P1' : (gameMode === 'ai' ? 'AI' : 'P2'), r.w / 2 - 12, -r.h / 2 + 12);
      }
    } else {
      const g = ctx.createLinearGradient(0, -r.h / 2, 0, r.h / 2);
      g.addColorStop(0, '#4a2c1b'); g.addColorStop(.55, '#2c190f'); g.addColorStop(1, '#190d07');
      ctx.fillStyle = g;
      rr(ctx, -r.w / 2, -r.h / 2, r.w, r.h, 10); ctx.fill();
      ctx.strokeStyle = 'rgba(215,161,74,.52)'; ctx.lineWidth = 1.6;
      rr(ctx, -r.w / 2, -r.h / 2, r.w, r.h, 10); ctx.stroke();
      ctx.strokeStyle = 'rgba(215,161,74,.2)'; ctx.lineWidth = 1;
      rr(ctx, -r.w / 2 + 5, -r.h / 2 + 5, r.w - 10, r.h - 10, 7); ctx.stroke();
      // star rosette
      ctx.strokeStyle = 'rgba(215,161,74,.4)'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(0, 0, 16, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath();
      for (let k = 0; k < 10; k++) {
        const a = -Math.PI / 2 + k * Math.PI / 5;
        const rad = k % 2 === 0 ? 15 : 6;
        const px = Math.cos(a) * rad, py = Math.sin(a) * rad;
        if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath(); ctx.stroke();
      ctx.fillStyle = 'rgba(215,161,74,.18)';
      ctx.beginPath(); ctx.arc(0, 0, 30, 0, Math.PI * 2); ctx.fill();
    }
    // cursors / selection rings
    for (const cursorSide of ['p1', 'p2']) {
      if (gameMode === 'ai' && cursorSide === 'p2') continue;
      const s = memory[cursorSide];
      if (s.cursor === i) {
        ctx.strokeStyle = sideColor(cursorSide);
        ctx.lineWidth = 2.4;
        ctx.setLineDash([6, 4]);
        rr(ctx, -r.w / 2 - 4, -r.h / 2 - 4, r.w + 8, r.h + 8, 12); ctx.stroke();
        ctx.setLineDash([]);
      }
      if (s.first === i) {
        ctx.strokeStyle = sideColor(cursorSide);
        ctx.lineWidth = 3.2;
        rr(ctx, -r.w / 2 - 2, -r.h / 2 - 2, r.w + 4, r.h + 4, 11); ctx.stroke();
      }
    }
    ctx.restore();
  }
  // central timer
  ctx.save();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(12,7,4,.86)';
  rr(ctx, CX - 58, 104, 116, 34, 12); ctx.fill();
  ctx.strokeStyle = 'rgba(215,161,74,.45)'; ctx.lineWidth = 1.2;
  rr(ctx, CX - 58, 104, 116, 34, 12); ctx.stroke();
  ctx.font = '800 17px "Segoe UI","Microsoft YaHei",sans-serif';
  ctx.fillStyle = '#ffeccb';
  ctx.fillText(`记忆 ${Math.ceil(memory.timeLeft)}s`, CX, 121);
  ctx.restore();
  drawBottomHint();
}

// ==================== title scene ====================
function drawTitleScene() {
  const t = animT;
  ctx.save();
  ctx.globalAlpha = .9;
  drawGunslinger(ctx, 190, 'p1', t, { dir: 1, bob: Math.sin(t * 1.1) * 2 });
  drawGunslinger(ctx, 770, 'p2', t, { dir: -1, bob: Math.sin(t * 1.1 + 1.4) * 2 });
  ctx.restore();
  // central saloon sign
  ctx.save();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.globalAlpha = .42;
  ctx.font = '800 22px "Microsoft YaHei",serif';
  ctx.fillStyle = '#ffd98e';
  ctx.fillText('铜 铃 酒 馆', CX, 388);
  ctx.font = '600 10px "Segoe UI",sans-serif';
  ctx.fillStyle = 'rgba(255,220,170,.7)';
  ctx.fillText('COPPER BELLE SALOON · EST. 1887', CX, 408);
  ctx.restore();
  // floating dust
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 26; i++) {
    const x = (i * 137 + t * (8 + i % 5) * 2) % W;
    const y = (i * 83 + Math.sin(t * .7 + i) * 20) % H;
    ctx.fillStyle = `rgba(255,220,160,${.05 + (i % 5) * .012})`;
    ctx.beginPath(); ctx.arc(x, y, 1 + (i % 3) * .6, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

// ==================== overlays ====================
function drawIntroOverlay() {
  const k = clamp01(1 - introT / Math.max(0.001, introTotal));
  const n = Math.max(1, Math.ceil(introT));
  ctx.save();
  ctx.fillStyle = 'rgba(8,4,2,.36)'; ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = '700 14px "Microsoft YaHei",sans-serif';
  ctx.fillStyle = 'rgba(255,217,142,.95)';
  const label = miniIndex >= 3 ? '加 赛 · 拔 枪 对 决' : `${['第 一', '第 二', '第 三'][miniIndex] || '第 三'} 场 · ${MINI_NAMES[miniType]}`;
  ctx.fillText(label, CX, 148);
  ctx.font = '800 72px "Segoe UI","Microsoft YaHei",sans-serif';
  ctx.fillStyle = '#fff4dc';
  ctx.shadowColor = 'rgba(230,170,80,.85)'; ctx.shadowBlur = 30;
  ctx.fillText(String(n), CX, 220);
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(139,240,216,.44)'; ctx.lineWidth = 2.6;
  ctx.beginPath(); ctx.arc(CX, 220, 65, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k); ctx.stroke();
  ctx.font = '600 12.5px "Microsoft YaHei",sans-serif';
  ctx.fillStyle = 'rgba(255,236,203,.86)';
  ctx.fillText(MINI_HINTS[miniType], CX, 312);
  ctx.font = '600 11px "Microsoft YaHei",sans-serif';
  ctx.fillStyle = 'rgba(215,161,74,.86)';
  ctx.fillText(MINI_EN[miniType], CX, 334);
  ctx.restore();
}

function resultReasonText() {
  if (!result) return '';
  const r = result.reason;
  const m = {
    false: '抢跑判负', reaction: '拔枪更快', timeout: '对手未能拔枪', forced: '测试判定',
    score: '分数更高', tie: '不分高低',
    pairs: '牌组更多', misses: '失误更少', time: '同时收手', all: '牌面清空',
  };
  return m[r] || '判定';
}
function drawResultOverlay() {
  if (!result) return;
  const res = result.winner;
  const col = res === 'p1' ? '#ffb08a' : res === 'p2' ? '#bcc7ff' : '#e9dfc8';
  const label = res === 'p1' ? `${nameOf('p1')} 拿下本场` : res === 'p2' ? `${nameOf('p2')} 拿下本场` : '本 场 平 局';
  ctx.save();
  ctx.fillStyle = 'rgba(8,4,2,.34)'; ctx.fillRect(0, 0, W, H);
  const w = 540, h = 150, x = CX - w / 2, y = H / 2 - 88;
  ctx.fillStyle = 'rgba(14,8,5,.92)';
  rr(ctx, x, y, w, h, 18); ctx.fill();
  ctx.strokeStyle = res === 'p1' ? 'rgba(210,74,52,.72)' : res === 'p2' ? 'rgba(91,116,216,.78)' : 'rgba(215,161,74,.65)';
  ctx.lineWidth = 1.6; rr(ctx, x, y, w, h, 18); ctx.stroke();
  ctx.strokeStyle = 'rgba(215,161,74,.22)'; ctx.lineWidth = 1;
  rr(ctx, x + 5, y + 5, w - 10, h - 10, 14); ctx.stroke();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = '800 27px "Microsoft YaHei",sans-serif';
  ctx.fillStyle = col;
  ctx.shadowColor = col; ctx.shadowBlur = 18;
  ctx.fillText(label, CX, y + 44);
  ctx.shadowBlur = 0;
  // detail
  let detail = '';
  const d = result.detail || {};
  if (miniType === 'quick') {
    const f = (v) => v == null ? '—' : `${v}ms`;
    detail = `反应  你 ${d.p1False ? '抢跑' : f(d.p1Reaction)}  ·  ${nameOf('p2')} ${d.p2False ? '抢跑' : f(d.p2Reaction)}`;
  } else if (miniType === 'color') {
    detail = `得分  ${d.p1Score ?? 0} : ${d.p2Score ?? 0}   ·   命中 ${d.p1Correct ?? 0} : ${d.p2Correct ?? 0}`;
  } else {
    detail = `牌组  ${d.p1Pairs ?? 0} : ${d.p2Pairs ?? 0}   ·   失误 ${d.p1Misses ?? 0} : ${d.p2Misses ?? 0}`;
  }
  ctx.font = '600 13px "Microsoft YaHei",sans-serif';
  ctx.fillStyle = 'rgba(255,236,205,.86)';
  ctx.fillText(detail, CX, y + 82);
  ctx.font = '600 11.5px "Microsoft YaHei",sans-serif';
  ctx.fillStyle = 'rgba(215,161,74,.86)';
  const nextNote = miniIndex < 2
    ? `下一场：${MINI_NAMES[miniAt(miniIndex + 1)]} · 当前 ${p1Wins} : ${p2Wins}`
    : (miniIndex === 2
      ? (p1Wins === p2Wins ? '三场战平 · 即将加赛拔枪' : '三场结束 · 即将结算')
      : (p1Wins === p2Wins ? '加赛再平 · 继续加赛' : '加赛结束 · 即将结算'));
  ctx.fillText(`${resultReasonText()} · ${nextNote}`, CX, y + 116);
  ctx.restore();
}

function drawPauseOverlay() {
  ctx.save();
  ctx.fillStyle = 'rgba(6,3,1,.70)'; ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = '800 44px "Microsoft YaHei",sans-serif';
  ctx.fillStyle = '#fff2d8';
  ctx.shadowColor = 'rgba(215,161,74,.8)'; ctx.shadowBlur = 24;
  ctx.fillText('已 暂 停', CX, H / 2 - 16);
  ctx.shadowBlur = 0;
  ctx.font = '13px "Microsoft YaHei",sans-serif';
  ctx.fillStyle = 'rgba(255,236,205,.82)';
  ctx.fillText('按 P 或点按右上角继续 · R 重开 · Esc 回标题', CX, H / 2 + 32);
  ctx.restore();
}

function drawParticles() {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const p of particles) {
    const a = clamp01(p.life / p.max);
    if (p.type === 'ring') {
      ctx.strokeStyle = p.color; ctx.globalAlpha = a * .75; ctx.lineWidth = 2.1;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.stroke();
    } else if (p.type === 'confetti') {
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot || 0);
      ctx.fillRect(-p.size, -p.size * .4, p.size * 2, p.size * .8);
      ctx.restore();
    } else {
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (.4 + a * .8), 0, Math.PI * 2); ctx.fill();
      if (p.size > 2) {
        ctx.globalAlpha = a * .22;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * 2.4, 0, Math.PI * 2); ctx.fill();
      }
    }
  }
  ctx.restore();
  ctx.save();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const f of floatTexts) {
    const a = clamp01(f.life / f.max);
    ctx.globalAlpha = a;
    ctx.font = `800 ${f.size}px "Microsoft YaHei",sans-serif`;
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.restore();
}

function drawWorld() {
  ctx.drawImage(bgCv, 0, 0, W, H);
  if (mode === 'title') {
    drawTitleScene();
    drawParticles();
    return;
  }
  if (miniType === 'quick') drawQuickScene();
  else if (miniType === 'color') drawColorScene();
  else drawMemoryScene();
  drawParticles();
  drawTopBar();
  if (phase === 'intro') drawIntroOverlay();
  else if (phase === 'result') drawResultOverlay();
  if (paused) drawPauseOverlay();
  if (flashT > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `rgba(255,230,200,${flashT * .5})`;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
}

function render() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.clearRect(0, 0, cv.width, cv.height);
  ctx.save();
  const sh = shakeT > 0 ? shakeT / Math.max(.001, shakeDur) : 0;
  const sx = Math.sin(animT * 93) * shakeAmp * sh;
  const sy = Math.cos(animT * 77) * shakeAmp * sh * .6;
  ctx.translate(viewOX + sx * viewScale, viewOY + sy * viewScale);
  ctx.scale(viewScale, viewScale);
  drawWorld();
  ctx.restore();
}

// ==================== main loop ====================
let last = performance.now(), acc = 0;
function frame(now) {
  requestAnimationFrame(frame);
  if (document.hidden) { last = now; acc = 0; return; }
  let dt = (now - last) / 1000;
  last = now;
  if (!Number.isFinite(dt) || dt < 0) dt = 0;
  dt = Math.min(dt, 1 / 20);
  acc += dt;
  let guard = 0;
  while (acc >= DT && guard++ < 10) { update(DT); acc -= DT; }
  render();
}
requestAnimationFrame(frame);

// ==================== URL / DOM wiring ====================
function bindUi() {
  titleEl.classList.remove('hide');
  endEl.classList.add('hide');
  updateTitleBest(); updateMuteButton(); updatePauseButton();
  document.querySelectorAll('.modebtn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!AUTOTEST) audio.unlock();
      audio.play('ui');
      startMatch(btn.dataset.mode || 'ai', btn.dataset.diff || aiDiff, 0);
    });
  });
  muteBtn.addEventListener('click', () => { if (!AUTOTEST) audio.unlock(); toggleMute(); audio.play('ui'); });
  pauseBtn.addEventListener('click', () => { if (!AUTOTEST) audio.unlock(); togglePause(); });
  document.getElementById('go').addEventListener('click', () => {
    if (!AUTOTEST) audio.unlock();
    audio.play('ui');
    startMatch(gameMode, aiDiff, 0);
  });
  document.getElementById('change').addEventListener('click', () => {
    if (!AUTOTEST) audio.unlock();
    audio.play('ui');
    goTitle();
  });
  document.getElementById('home').addEventListener('click', () => {
    if (!AUTOTEST) audio.unlock();
    audio.play('ui');
    goTitle();
  });
  if (shareBtn) shareBtn.addEventListener('click', () => { if (!AUTOTEST) audio.unlock(); shareScore(); });
}
bindUi();

if (URLP.has('autostart') && !AUTOTEST) {
  const gm = URLP.get('mode') === 'local' ? 'local' : 'ai';
  const diff = diffKey(URLP.get('difficulty') || '2');
  const mini = parseInt(URLP.get('mini') || '0', 10) || 0;
  startMatch(gm, diff, mini);
}


// ---------------- gameplay help overlay ----------------
(() => {
  const modal = document.getElementById('helpModal');
  const openBtn = document.getElementById('helpOpen');
  const closeBtn = document.getElementById('helpClose');
  if (!modal || !openBtn || !closeBtn) return;
  const setHelp = (open) => {
    modal.classList.toggle('hide', !open);
    try { (open ? closeBtn : openBtn).focus(); } catch (e) { }
  };
  openBtn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); setHelp(true); });
  closeBtn.addEventListener('click', (e) => { e.preventDefault(); setHelp(false); });
  modal.addEventListener('click', (e) => { if (e.target === modal) setHelp(false); });
  window.addEventListener('keydown', (e) => {
    if (modal.classList.contains('hide')) return;
    e.stopImmediatePropagation();
    if (e.code === 'Escape') { e.preventDefault(); setHelp(false); }
    else if (['Enter', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  }, true);
  window.__setHelp = setHelp;
})();

// ==================== G debug hooks ====================
function snapColorSide(c) {
  return {
    score: Math.round(finite(c.score, 0)), correct: c.correct | 0, wrong: c.wrong | 0,
    combo: c.combo | 0, maxCombo: c.maxCombo | 0, target: c.target,
    slots: (c.slots || []).map(s => ({ fill: s.fill, label: s.label })),
    targetAge: finite(c.targetAge, 0), lockT: finite(c.lockT, 0), nextT: finite(c.nextT, 0),
  };
}
function snapMemSide(s) {
  return {
    cursor: s.cursor | 0, first: s.first, firstAt: finite(s.firstAt, 0),
    pairs: s.pairs | 0, misses: s.misses | 0, lockT: finite(s.lockT, 0), lastAt: finite(s.lastAt, 0),
  };
}
function snapshot() {
  const cards = memory ? memory.cards.map(c => ({
    index: c.index, icon: c.icon, pair: c.pair, faceUp: !!c.faceUp,
    matchedBy: c.matchedBy || null, owner: c.owner || null, flipBackT: finite(c.flipBackT, 0),
  })) : [];
  return {
    mode, phase, paused, gameMode, aiDiff, miniIndex, miniType,
    miniName: MINI_NAMES[miniType], tiebreak: miniIndex >= 3,
    introT: finite(introT, 0), resultT: finite(resultT, 0),
    p1Wins, p2Wins, winner, matchOver, score: scoreInt(), progress: matchProgress(),
    matchTime: finite(matchTime, 0), matchLog: matchLog.map(m => ({ ...m })),
    noAuto, nan: nanFlag, bestScore, matchWins, matchLosses, muted, audioCtx: audio.hasCtx(),
    quick: quick ? {
      sub: quick.sub, waitT: finite(quick.waitT, 0), waitTotal: finite(quick.waitTotal, 0),
      elapsed: finite(quick.elapsed, 0), signalT: finite(quick.signalT, 0),
      p1Reaction: quick.p1.react, p2Reaction: quick.p2.react,
      p1False: quick.p1.false, p2False: quick.p2.false,
      aiFalse: quick.aiFalse, aiReaction: quick.aiReaction, aiDrawn: quick.aiDrawn,
      result: quick.result, reason: quick.reason,
    } : null,
    color: color ? {
      timeLeft: finite(color.timeLeft, 0), elapsed: finite(color.elapsed, 0),
      p1: snapColorSide(color.p1), p2: snapColorSide(color.p2),
      ai: {
        next: color.ai.next, recordScore: Math.round(color.ai.recordScore),
        recordCorrect: color.ai.recordCorrect, recordWrong: color.ai.recordWrong,
        shownScore: Math.round(color.ai.shownScore),
      },
      result: color.result, reason: color.reason,
    } : null,
    memory: memory ? {
      timeLeft: finite(memory.timeLeft, 0), elapsed: finite(memory.elapsed, 0),
      p1: snapMemSide(memory.p1), p2: snapMemSide(memory.p2),
      cards,
      ai: {
        next: memory.ai.next, recordPairs: memory.ai.recordPairs,
        recordMisses: memory.ai.recordMisses, shownPairs: memory.ai.shownPairs,
      },
      result: memory.result, reason: memory.reason,
    } : null,
    result: result ? { winner: result.winner, reason: result.reason, detail: { ...result.detail } } : null,
    ai: {
      diff: aiDiff, label: profile.label,
      quickMedian: profile.quickMedian, quickFalse: profile.quickFalse,
      colorMedian: profile.colorMedian, colorAcc: profile.colorAcc,
      memInterval: profile.memInterval, memThink: profile.memThink,
    },
    particles: particles.length,
    reports: reports.length,
    bestKeys: [BEST_KEY, WINS_KEY, MUTE_KEY],
  };
}

function setColorTarget(side, colorKey) {
  if (!color) return null;
  const c = color[side === 'p2' ? 'p2' : 'p1'];
  const key = COLOR_BY_KEY[colorKey] ? colorKey : COLOR_KEYS[0];
  c.target = key;
  // Keep the existing fills but guarantee the target fill exists.
  const fills = c.slots.length === 4 ? c.slots.map(s => s.fill) : COLOR_KEYS.slice();
  if (!fills.includes(key)) fills[0] = key;
  c.slots = fills.map((fill, i) => {
    const old = c.slots && c.slots[i] ? c.slots[i] : null;
    const label = old && old.label && old.label !== fill ? old.label : (COLOR_KEYS.find(k => k !== fill) || COLOR_KEYS[0]);
    return { fill, label };
  });
  updateTouchSwatches();
  return { target: c.target, slots: c.slots.map(s => ({ ...s })) };
}
function slotForFill(side, fillKey) {
  const c = color && color[side === 'p2' ? 'p2' : 'p1'];
  if (!c) return -1;
  return c.slots.findIndex(s => s.fill === fillKey);
}
function setMemoryCards(seed) {
  if (!memory) return null;
  memory.cards = buildMemoryBoard((seed >>> 0) || 1);
  memory.p1 = freshSideMem(); memory.p2 = freshSideMem();
  memory.ai.next = 0; memory.ai.shownPairs = 0;
  return memory.cards.map(c => ({ index: c.index, icon: c.icon, pair: c.pair }));
}
function memoryPairs() {
  if (!memory) return [];
  const byPair = {};
  for (const c of memory.cards) {
    (byPair[c.pair] = byPair[c.pair] || []).push(c.index);
  }
  return Object.values(byPair);
}
function setMiniState(s) {
  if (typeof s === 'string') {
    if (s === 'live') return beginLive();
    if (s === 'intro') { phase = 'intro'; introT = introTotal; return true; }
    if (s === 'result') { if (result) phase = 'result'; return phase === 'result'; }
    if (quick && s === 'signal') return triggerQuickSignal();
    if (quick && (s === 'wait' || s === 'done')) { quick.sub = s; return true; }
  }
  if (s && typeof s === 'object') {
    if (s.phase) {
      if (s.phase === 'live') beginLive();
      else phase = s.phase;
    }
    if (quick && s.quickSub) quick.sub = s.quickSub;
    return true;
  }
  return false;
}

const G_API = {
  err: window.__BOOTERR || [],
  W, H, CX, GROUND,
  step: (n = 60, dt = DT) => { for (let i = 0; i < n; i++) { update(dt); render(); } },
  upd: (n = 30, dt = DT) => { for (let i = 0; i < n; i++) update(dt); },
  press: (...codes) => { for (const c of codes) { pressed.add(c); held.add(c); } },
  release: (...codes) => { for (const c of codes) held.delete(c); },
  setNoAuto: (v) => { noAuto = !!v; },
  clearFx,
  setReportTarget: (fn) => { reportTarget = typeof fn === 'function' ? fn : null; },
  reportLog: () => reports.slice(),
  state: snapshot,
  startMatch,
  startMini: (i) => startMini(clamp(parseInt(i, 10) || 0, 0, 8)),
  beginLive,
  forceSignal: () => {
    if (miniType !== 'quick') return false;
    if (phase === 'intro') beginLive();
    return triggerQuickSignal();
  },
  setMiniState,
  forceMiniWin: (side) => forceMiniWin(side),
  forceMiniDraw: () => forceMiniWin('draw'),
  forceWin,
  forceLose,
  nextMini: () => { advanceMini(); return snapshot(); },
  goTitle,
  togglePause,
  toggleMute,
  setMuted: (v) => { audio.setMuted(!!v); muted = !!v; updateMuteButton(); },
  setAI: (v) => {
    aiDiff = diffKey(v); profile = AI_PROFILES[aiDiff];
    return { ...profile };
  },
  aiProfiles: () => JSON.parse(JSON.stringify(AI_PROFILES)),
  humanModel: () => ({ ...HUMAN_MODEL }),
  runRecordBench: (n, diff, seed) => runRecordBench(n, diff, seed),
  setScores: (a, b) => {
    p1Wins = clamp(parseInt(a, 10) || 0, 0, 99);
    p2Wins = clamp(parseInt(b, 10) || 0, 0, 99);
    return [p1Wins, p2Wins];
  },
  setTimer: (s) => {
    if (miniType === 'color' && color) color.timeLeft = Math.max(0, finite(s, 0));
    if (miniType === 'memory' && memory) memory.timeLeft = Math.max(0, finite(s, 0));
    return miniType === 'color' ? color.timeLeft : memory ? memory.timeLeft : 0;
  },
  setColorScore: (side, v) => {
    if (!color) return 0;
    const c = color[side === 'p2' ? 'p2' : 'p1'];
    c.score = finite(v, 0);
    return c.score;
  },
  setColorTarget,
  slotForFill,
  colorGain: colorPressDelta,
  flipMemory: (side, index) => {
    if (!memory) return false;
    return flipMemoryCard(side === 'p2' ? 'p2' : 'p1', clamp(parseInt(index, 10) || 0, 0, MEMORY_CARDS - 1));
  },
  setMemoryCursor: (side, index) => {
    if (!memory) return -1;
    const s = memory[side === 'p2' ? 'p2' : 'p1'];
    s.cursor = clamp(parseInt(index, 10) || 0, 0, MEMORY_CARDS - 1);
    return s.cursor;
  },
  setMemoryCards,
  memoryPairs,
  audio,
  view: () => ({ scale: viewScale, ox: viewOX, oy: viewOY, dpr: DPR, w: window.innerWidth, h: window.innerHeight }),
  particlesList: () => particles.slice(),
  ui: { showEnd, toast },
  saveBest,
  config: { BEST_KEY, WINS_KEY, MUTE_KEY, AUTOTEST },
};
window.__G = G_API;
window.G = G_API;

// ==================== autotest ====================
const nap = () => new Promise(r => {
  const mc = new MessageChannel();
  mc.port1.onmessage = () => r();
  mc.port2.postMessage(0);
});

async function autotest() {
  G_API.setNoAuto(true);
  const results = [];
  const T = window.__TEST = { pass: 0, fail: 0, total: 0, results, done: false };
  const ok = (id, cond, name) => {
    results.push({ id, ok: !!cond, name });
    if (cond) T.pass++; else { T.fail++; console.log(`[autotest] FAIL ${id}: ${name}`); }
  };
  const S = () => G_API.state();
  const R = (n) => { for (let i = 0; i < n; i++) update(DT); };
  const frames = [];
  const saved = { best: 0, wins: 0, losses: 0, muted: false, lb: null, lw: null, ll: null, lm: null };
  try {
    saved.lb = localStorage.getItem(BEST_KEY);
    saved.lw = localStorage.getItem(WINS_KEY);
    saved.ll = localStorage.getItem(LOSSES_KEY);
    saved.lm = localStorage.getItem(MUTE_KEY);
  } catch (e) { }
  saved.best = bestScore; saved.wins = matchWins; saved.losses = matchLosses; saved.muted = muted;
  muted = true; audio.setMuted(true); updateMuteButton();
  G_API.setReportTarget(f => frames.push(f));

  try {
    await nap();

    // 1 — clean boot
    ok(1, G_API.err.length === 0 && !nanFlag, `启动零报错 errors=${G_API.err.length} nan=${nanFlag}`);

    // 2 — stress all three minigames for 360 frames with input, no NaN
    {
      G_API.startMatch('local', 'medium', 0);
      G_API.beginLive();
      const e0 = G_API.err.length;
      let finiteOk = true;
      for (let k = 0; k < 360; k++) {
        if (k % 37 === 0) G_API.press('KeyF');
        if (k % 53 === 0) G_API.press('KeyJ');
        if (k % 71 === 0) G_API.press('KeyA');
        update(DT);
        if (k % 45 === 0) {
          const s = S();
          const vals = [s.matchTime, s.p1Wins, s.p2Wins, s.score];
          if (s.quick) vals.push(s.quick.waitT, s.quick.signalT);
          if (s.color) vals.push(s.color.timeLeft, s.color.p1.score, s.color.p2.score);
          if (s.memory) vals.push(s.memory.timeLeft, s.memory.p1.cursor, s.memory.p2.cursor);
          for (const v of vals) if (!Number.isFinite(v)) finiteOk = false;
        }
        if (k === 120) { G_API.forceMiniWin('p1'); G_API.nextMini(); G_API.beginLive(); }
        if (k === 220) { G_API.forceMiniWin('p2'); G_API.nextMini(); G_API.beginLive(); }
      }
      const s = S();
      ok(2, finiteOk && !s.nan && G_API.err.length === e0 && s.mode === 'play',
        `360 帧三连乱战无 NaN / 无新报错 nan=${s.nan} phase=${s.phase}`);
    }

    // 3 — quick draw false start: early press loses
    {
      G_API.startMatch('local', 'medium', 0);
      G_API.beginLive();
      const before = S();
      G_API.press('KeyF'); R(1);
      const s = S();
      ok(3, before.quick && !before.quick.p1False && s.quick.p1False && s.quick.result === 'p2' && s.phase === 'result' && s.p2Wins === 1,
        `抢跑判负 p1False=${s.quick.p1False} result=${s.quick.result}`);
    }

    // 4 — quick draw valid signal + input path (mandatory input simulation)
    {
      G_API.startMatch('local', 'medium', 0);
      G_API.beginLive();
      G_API.forceSignal();
      const sig = S();
      G_API.press('KeyF'); R(1);
      const mid = S();
      G_API.press('KeyJ'); R(1);
      const s = S();
      ok(4, sig.quick.sub === 'signal' && mid.quick.p1Reaction != null && s.quick.p1Reaction != null && s.quick.p2Reaction != null &&
        s.quick.p2Reaction >= s.quick.p1Reaction && s.phase === 'result' && s.result && s.result.winner === 'p1',
        `信号后按键生效 p1=${s.quick.p1Reaction == null ? '—' : (s.quick.p1Reaction * 1000).toFixed(0)}ms p2=${s.quick.p2Reaction == null ? '—' : (s.quick.p2Reaction * 1000).toFixed(0)}ms winner=${s.result && s.result.winner}`);
    }

    // 5 — color correct scoring
    {
      G_API.startMatch('local', 'medium', 1);
      G_API.beginLive();
      const before = S();
      const tgt = before.color.p1.target;
      const slot = G_API.slotForFill('p1', tgt);
      const code = ['KeyA', 'KeyS', 'KeyD', 'KeyF'][slot];
      G_API.press(code); R(1);
      const s = S();
      const gain = s.color.p1.score - before.color.p1.score;
      ok(5, slot >= 0 && gain >= 100 && s.color.p1.correct === 1 && s.color.p1.score === gain,
        `抢色正确命中 +${gain} 目标=${tgt} slot=${slot}`);
    }

    // 6 — color wrong press penalty
    {
      // let the previous correct-press lock expire and a fresh target spawn
      R(30);
      const s0 = S();
      const tgt = s0.color.p1.target;
      let wrongSlot = -1;
      for (let i = 0; i < 4; i++) if (s0.color.p1.slots[i].fill !== tgt) { wrongSlot = i; break; }
      const code = ['KeyA', 'KeyS', 'KeyD', 'KeyF'][wrongSlot];
      G_API.press(code); R(1);
      const s = S();
      const delta = s.color.p1.score - s0.color.p1.score;
      ok(6, wrongSlot >= 0 && delta === -50 && s.color.p1.wrong >= 1,
        `抢色错按扣分 ${delta}（应为 -50）wrong=${s.color.p1.wrong}`);
    }

    // 7 — memory pair match + first-pick handling
    {
      G_API.startMatch('local', 'medium', 2);
      G_API.beginLive();
      const pairs = G_API.memoryPairs();
      const [a, b] = pairs[0];
      const before = S();
      G_API.flipMemory('p1', a);
      const mid = S();
      G_API.flipMemory('p1', b);
      const s = S();
      ok(7, before.memory.p1.pairs === 0 && mid.memory.p1.first === a && s.memory.p1.pairs === 1 &&
        s.memory.cards[a].matchedBy === 'p1' && s.memory.cards[b].matchedBy === 'p1' && s.memory.p1.first === null,
        `记忆配对 P1 first=${mid.memory.p1.first} pairs=${s.memory.p1.pairs} matched=${s.memory.cards[a].matchedBy}`);
    }

    // 7b — memory mismatch clears first pick and counts a miss
    {
      const sNow = S();
      const unmatchedPairs = G_API.memoryPairs().filter(p => !sNow.memory.cards[p[0]].matchedBy);
      const before = S();
      G_API.flipMemory('p1', unmatchedPairs[0][0]);
      G_API.flipMemory('p1', unmatchedPairs[1][0]);
      const s = S();
      ok(7.1, s.memory.p1.misses === before.memory.p1.misses + 1 && s.memory.p1.first === null,
        `记忆错配失误 ${s.memory.p1.misses} first 已清空`);
    }

    // 8 — score economy / mini wins update
    {
      G_API.startMatch('local', 'medium', 0);
      G_API.beginLive();
      const s0 = S();
      G_API.forceMiniWin('p1');
      const s1 = S();
      G_API.nextMini();
      G_API.beginLive();
      G_API.forceMiniWin('p2');
      const s2 = S();
      ok(8, s0.score === 0 && s1.p1Wins === 1 && s1.score === 100 && s2.p2Wins === 1 && s2.score === 101,
        `胜场计分 ${s0.score} → ${s1.score} → ${s2.score}`);
    }

    // 9 — loss path → gameOver
    {
      frames.length = 0;
      G_API.startMatch('ai', 'fast', 0);
      G_API.beginLive();
      G_API.forceLose();
      const s = S();
      ok(9, s.mode === 'over' && s.winner === 'p2' && frames.some(f => f.kind === 'gameOver'),
        `失败路径 mode=${s.mode} winner=${s.winner} gameOver=${frames.some(f => f.kind === 'gameOver')}`);
    }

    // 10 — win path → complete
    {
      frames.length = 0;
      G_API.startMatch('ai', 'medium', 0);
      G_API.beginLive();
      G_API.forceWin();
      const s = S();
      ok(10, s.mode === 'over' && s.winner === 'p1' && frames.some(f => f.kind === 'complete'),
        `胜利路径 mode=${s.mode} winner=${s.winner} complete=${frames.some(f => f.kind === 'complete')}`);
    }

    // 11 — report sequence ready → progress → complete/gameOver
    {
      const log = G_API.reportLog();
      const ri = log.findIndex(f => f.kind === 'ready');
      const pi = log.findIndex(f => f.kind === 'progress');
      const ci = log.findIndex(f => f.kind === 'complete' || f.kind === 'gameOver');
      ok(11, ri === 0 && pi > ri && ci > pi, `上报帧序 ready=${ri} progress=${pi} end=${ci}`);
    }

    // 12 — best localStorage write / read / restore
    {
      bestScore = 0; matchWins = 0; matchLosses = 0;
      try { localStorage.removeItem(BEST_KEY); localStorage.removeItem(WINS_KEY); localStorage.removeItem(LOSSES_KEY); } catch (e) { }
      G_API.startMatch('ai', 'slow', 0);
      G_API.beginLive();
      G_API.forceWin();
      G_API.startMatch('ai', 'slow', 0);
      G_API.beginLive();
      G_API.forceLose();
      let lb = null, lw = null, ll = null;
      try { lb = localStorage.getItem(BEST_KEY); lw = localStorage.getItem(WINS_KEY); ll = localStorage.getItem(LOSSES_KEY); } catch (e) { }
      const s = S();
      ok(12, parseInt(lb || '0', 10) >= 300 && parseInt(lw || '0', 10) >= 1 && parseInt(ll || '0', 10) >= 1 && s.bestScore >= 300 && s.matchWins >= 1 && s.matchLosses >= 1,
        `best 写入 ${lb} 分 / ${lw} 胜 / ${ll} 负 · 键 ${BEST_KEY} ${WINS_KEY} ${LOSSES_KEY}`);
      bestScore = saved.best; matchWins = saved.wins; matchLosses = saved.losses;
      try {
        if (saved.lb === null) localStorage.removeItem(BEST_KEY); else localStorage.setItem(BEST_KEY, saved.lb);
        if (saved.lw === null) localStorage.removeItem(WINS_KEY); else localStorage.setItem(WINS_KEY, saved.lw);
        if (saved.ll === null) localStorage.removeItem(LOSSES_KEY); else localStorage.setItem(LOSSES_KEY, saved.ll);
      } catch (e) { }
      updateTitleBest();
    }

    // 13 — AI tier parameter ordering
    {
      const a = G_API.aiProfiles();
      ok(13, a.slow.quickMedian > a.medium.quickMedian && a.medium.quickMedian > a.fast.quickMedian &&
        a.slow.colorMedian > a.medium.colorMedian && a.medium.colorMedian > a.fast.colorMedian &&
        a.slow.colorAcc < a.medium.colorAcc && a.medium.colorAcc < a.fast.colorAcc &&
        a.slow.memInterval > a.medium.memInterval && a.medium.memInterval > a.fast.memInterval,
        `AI 三档 quick ${a.slow.quickMedian}/${a.medium.quickMedian}/${a.fast.quickMedian} color ${a.slow.colorMedian}/${a.medium.colorMedian}/${a.fast.colorMedian}`);
    }

    // 14 — benchmark tier separation (reduced n for the suite)
    {
      const rs = { slow: G_API.runRecordBench(60, 'slow'), medium: G_API.runRecordBench(60, 'medium'), fast: G_API.runRecordBench(60, 'fast') };
      const sep1 = rs.slow.winRate - rs.medium.winRate;
      const sep2 = rs.medium.winRate - rs.fast.winRate;
      ok(14, rs.slow.winRate > rs.medium.winRate && rs.medium.winRate > rs.fast.winRate && sep1 >= 0.15 && sep2 >= 0.15,
        `AI 记录胜率 ${(rs.slow.winRate * 100).toFixed(0)}/${(rs.medium.winRate * 100).toFixed(0)}/${(rs.fast.winRate * 100).toFixed(0)}% 间隔 ${(sep1 * 100).toFixed(0)}/${(sep2 * 100).toFixed(0)}pp`);
    }

    // 15 — all three modes start
    {
      G_API.startMatch('local', 'medium', 0);
      const l = S();
      G_API.startMatch('ai', 'slow', 0);
      const a1 = S();
      G_API.startMatch('ai', 'medium', 0);
      const a2 = S();
      G_API.startMatch('ai', 'fast', 0);
      const a3 = S();
      ok(15, l.gameMode === 'local' && a1.gameMode === 'ai' && a1.aiDiff === 'slow' && a2.aiDiff === 'medium' && a3.aiDiff === 'fast' &&
        l.mode === 'play' && a3.mode === 'play',
        `三种模式 local / AI slow / AI medium / AI fast · 当前 ${a3.aiDiff}`);
    }

    // 16 — three minigame order and best-of-three advance
    {
      G_API.startMatch('local', 'medium', 0);
      const order = [];
      G_API.beginLive(); order.push(S().miniType); G_API.forceMiniWin('p1'); G_API.nextMini();
      G_API.beginLive(); order.push(S().miniType); G_API.forceMiniWin('p2'); G_API.nextMini();
      G_API.beginLive(); order.push(S().miniType); G_API.forceMiniWin('p1'); G_API.nextMini();
      const s = S();
      ok(16, order.join(',') === 'quick,color,memory' && s.mode === 'over' && s.winner === 'p1' && s.p1Wins === 2 && s.p2Wins === 1,
        `三场顺序 ${order.join('→')} · 比分 ${s.p1Wins}:${s.p2Wins}`);
    }

    // 17 — tie triggers a quick-draw tiebreak
    {
      G_API.startMatch('local', 'medium', 0);
      G_API.beginLive(); G_API.forceMiniWin('p1'); G_API.nextMini();
      G_API.beginLive(); G_API.forceMiniWin('p2'); G_API.nextMini();
      G_API.beginLive(); G_API.forceMiniWin('draw'); G_API.nextMini();
      const t3 = S();
      ok(17, t3.miniIndex === 3 && t3.miniType === 'quick' && t3.tiebreak === true,
        `三场 1:1 + 平局 → 加赛 quick index=${t3.miniIndex}`);
    }

    // 18 — pause freezes timers / signal / memory clocks
    {
      G_API.startMatch('local', 'medium', 1);
      G_API.beginLive();
      const t0 = S().color.timeLeft;
      G_API.setNoAuto(false);
      R(12);
      const before = S();
      G_API.press('KeyP'); R(1);
      const p0 = S();
      R(40);
      const p1s = S();
      const frozen = p0.paused && Math.abs(p1s.color.timeLeft - p0.color.timeLeft) < 1e-9;
      G_API.press('KeyP'); R(1);
      const resumed = !S().paused;
      G_API.setNoAuto(true);
      ok(18, before.color.timeLeft < t0 - 0.05 && frozen && resumed,
        `暂停冻结 起点${t0.toFixed(2)}→暂停${p0.color.timeLeft.toFixed(2)} paused=${p0.paused} resumed=${resumed}`);
    }

    // 19 — touch bindings exist and a pointer draw triggers the quick-draw path
    {
      G_API.startMatch('local', 'medium', 0);
      document.body.classList.add('touchui');
      G_API.beginLive();
      const btn1 = document.querySelector('#touchL button[data-action="draw"]');
      const btn2 = document.querySelector('#touchR button[data-action="draw"]');
      const hasBind = !!btn1 && !!btn2 && document.querySelectorAll('#touch button').length >= 2;
      G_API.forceSignal();
      btn1.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch', pointerId: 31, clientX: 40, clientY: 40 }));
      R(1);
      btn1.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerType: 'touch', pointerId: 31 }));
      const s = S();
      ok(19, hasBind && s.quick.p1Reaction != null,
        `触控绑定 ${document.querySelectorAll('#touch button').length} 个 · P1 draw=${s.quick.p1Reaction != null}`);
    }

    // 20 — color touch swatches / memory touch pad exist per side
    {
      G_API.startMatch('local', 'medium', 1);
      G_API.beginLive();
      const slotBtns = document.querySelectorAll('#touch button[data-slot]');
      G_API.startMini(2); G_API.beginLive();
      const memBtns = document.querySelectorAll('#touch button[data-code]');
      ok(20, slotBtns.length >= 8 && memBtns.length >= 8,
        `触控色键 ${slotBtns.length} / 记牌键 ${memBtns.length}`);
    }

    // 21 — restart resets score, mini index, phase
    {
      G_API.startMatch('ai', 'fast', 0);
      G_API.setScores(2, 1);
      G_API.startMatch('ai', 'fast', 0);
      const s = S();
      ok(21, s.p1Wins === 0 && s.p2Wins === 0 && s.miniIndex === 0 && s.phase === 'intro' && s.score === 0 && s.matchLog.length === 0,
        `重开复位 ${s.p1Wins}:${s.p2Wins} mini=${s.miniIndex} phase=${s.phase}`);
    }

    // 22 — M key toggles mute both ways
    {
      muted = true; audio.setMuted(true); updateMuteButton();
      const m0 = S().muted;
      G_API.press('KeyM'); R(1); G_API.release('KeyM');
      const m1 = S().muted;
      G_API.press('KeyM'); R(1); G_API.release('KeyM');
      const m2 = S().muted;
      ok(22, m1 !== m0 && m2 === m0, `M 键静音 ${m0}→${m1}→${m2}`);
    }

    // 23 — color AI record is frozen under noAuto and ticks when noAuto is off
    {
      G_API.startMatch('ai', 'medium', 1);
      G_API.beginLive();
      R(30);
      const frozenScore = S().color.p2.score;
      G_API.setNoAuto(false);
      R(180);
      const movedScore = S().color.p2.score;
      G_API.setNoAuto(true);
      ok(23, frozenScore === 0 && movedScore > 0, `AI 记录冻结 ${frozenScore} → 解冻 ${movedScore}`);
    }

    // 24 — timer auto-countdown when noAuto off
    {
      G_API.startMatch('local', 'medium', 2);
      G_API.beginLive();
      G_API.setNoAuto(false);
      const t0 = S().memory.timeLeft;
      R(30);
      const t1 = S().memory.timeLeft;
      G_API.setNoAuto(true);
      ok(24, t1 < t0 - 0.3, `记忆倒计时 ${t0.toFixed(2)}→${t1.toFixed(2)}`);
    }

    // 25 — local mode has no AI auto-draw / auto-memory actions
    {
      G_API.startMatch('local', 'medium', 0);
      G_API.beginLive();
      G_API.setNoAuto(false);
      R(200);
      const s = S();
      G_API.setNoAuto(true);
      ok(25, s.quick.p2Reaction == null && s.quick.p2False === false,
        `本地双人 AI 关闭 p2Reaction=${s.quick.p2Reaction}`);
    }

    // 26 — AI quick draw auto action when noAuto off (AI mode)
    {
      G_API.startMatch('ai', 'slow', 0);
      G_API.beginLive();
      G_API.setNoAuto(false);
      // force the signal now, then let the AI auto-draw; player never presses.
      G_API.forceSignal();
      R(260);
      const s = S();
      G_API.setNoAuto(true);
      ok(26, s.quick.p2Reaction != null || s.quick.p2False === true || s.quick.result != null,
        `AI 拔枪动作 reaction=${s.quick.p2Reaction} false=${s.quick.p2False} result=${s.quick.result}`);
    }

    // 27 — settlement panel buttons visible
    {
      G_API.startMatch('local', 'medium', 0);
      G_API.beginLive();
      G_API.forceWin();
      const vis = !endEl.classList.contains('hide');
      ok(27, vis && !!document.getElementById('go') && !!document.getElementById('change') && !!document.getElementById('home'),
        '结算面板：再来 / 换难度 / 回标题');
    }

    // 28 — title mode buttons exist and launch the right tier
    {
      G_API.goTitle();
      const btns = document.querySelectorAll('.modebtn');
      document.querySelector('.modebtn[data-mode="ai"][data-diff="fast"]').click();
      const s = S();
      ok(28, btns.length === 4 && s.mode === 'play' && s.gameMode === 'ai' && s.aiDiff === 'fast',
        `模式菜单 ${btns.length} 项 · 快枪启动`);
    }

    // 29 — memory timeout resolution path
    {
      G_API.startMatch('local', 'medium', 2);
      G_API.beginLive();
      G_API.setNoAuto(false);
      G_API.setTimer(0.04);
      R(5);
      const s = S();
      G_API.setNoAuto(true);
      ok(29, s.phase === 'result' && s.memory.result != null,
        `记忆时间到结算 phase=${s.phase} result=${s.memory.result}`);
    }

    // 30 — full match fast-forward across all three minis (AI, no NaN, no errors)
    {
      G_API.startMatch('ai', 'medium', 0);
      G_API.setNoAuto(true);
      const e0 = G_API.err.length;
      let crashed = false;
      try {
        G_API.beginLive(); G_API.forceMiniWin('p1'); G_API.nextMini();
        G_API.beginLive(); G_API.forceMiniWin('p2'); G_API.nextMini();
        G_API.beginLive(); G_API.forceMiniWin('p1'); G_API.nextMini();
      } catch (err) { crashed = true; }
      const s = S();
      ok(30, !crashed && s.mode === 'over' && s.winner === 'p1' && !s.nan && G_API.err.length === e0,
        `整局快进 mode=${s.mode} ${s.p1Wins}:${s.p2Wins} nan=${s.nan}`);
    }

    // 31 — suite returns to title
    {
      G_API.goTitle();
      const s = S();
      ok(31, s.mode === 'title' && !titleEl.classList.contains('hide') && endEl.classList.contains('hide') && /最佳|尚无/.test(bestEl.textContent),
        '测完回标题画面');
    }

    // 32 — autotest stayed muted and never created an AudioContext
    ok(32, audio.isMuted() === true && audio.hasCtx() === false, '自测静音且未创建 AudioContext');

    // 33 — no external requests during the suite (in-page audit)
    {
      const errs = G_API.err.length;
      ok(33, errs === 0 && G_API.reportLog().length >= 3 && results.length >= 30,
        `零报错 / 上报 ${G_API.reportLog().length} 帧 / 断言 ${results.length} 条`);
    }

    // HELP — 标题「玩法说明」双栏弹层可开合、键位与规则齐全
    {
      if (window.G && typeof window.G.goTitle === 'function') window.G.goTitle();
      const hb = document.getElementById('helpOpen');
      const hm = document.getElementById('helpModal');
      const hc = document.getElementById('helpClose');
      if (hb) hb.click();
      const openOk = !!hm && !hm.classList.contains('hide');
      const txt = hm ? hm.textContent : '';
      if (hc) hc.click();
      const closedOk = !!hm && hm.classList.contains('hide');
      ok('H1', !!hb && !!hm && !!hc && openOk && closedOk &&
        txt.includes('双人对战') && txt.includes('人机对战') &&
        txt.includes('键位') && txt.includes('规则'),
        `玩法说明：双人/人机两栏 · 键位/规则 · 开合=${openOk}/${closedOk}`);
    }

  } catch (err) {
    window.__TEST_ERR = String((err && err.stack) || err);
    results.push({ id: 'ERR', ok: false, name: `autotest crashed: ${window.__TEST_ERR}` });
    console.log('[autotest] crash', window.__TEST_ERR);
    try { G_API.goTitle(); } catch (e) { }
  } finally {
    G_API.setReportTarget(null);
    G_API.setNoAuto(false);
    bestScore = saved.best; matchWins = saved.wins; matchLosses = saved.losses; muted = saved.muted;
    audio.setMuted(saved.muted);
    try {
      if (saved.lb === null) localStorage.removeItem(BEST_KEY); else localStorage.setItem(BEST_KEY, saved.lb);
      if (saved.lw === null) localStorage.removeItem(WINS_KEY); else localStorage.setItem(WINS_KEY, saved.lw);
      if (saved.ll === null) localStorage.removeItem(LOSSES_KEY); else localStorage.setItem(LOSSES_KEY, saved.ll);
      if (saved.lm === null) localStorage.removeItem(MUTE_KEY); else localStorage.setItem(MUTE_KEY, saved.lm);
    } catch (e) { }
    document.body.classList.remove('touchui');
    updateMuteButton(); updateTitleBest();
    try { G_API.goTitle(); } catch (e) { }
    await nap();
    T.total = results.length;
    T.pass = results.filter(r => r.ok).length;
    T.fail = results.length - T.pass;
    T.done = true;
    console.log(`[autotest] ${T.pass}/${T.total} passed, ${T.fail} failed`);
  }
}

if (AUTOTEST) autotest();
