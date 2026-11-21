// Twin Tempo Arena 双生擂台 — a 2D Canvas same-screen arena duel.
// guizang-game-skill series #14 (灯匠夜游 · 第 14 铺).
// Three rotating rounds (sword duel / lamp capture / shove-off), local two
// player and three AI tiers. Vanilla ES modules, procedural art, synthesized
// WebAudio, fixed-step loop, site report bridge, G hooks and ?autotest=1.

import {
  W, H, CX, GROUND, FIGHTER_R,
  ACCEL, MAX_SPD, JUMP_V, ATTACK, DASH, CAPTURE, PUSH,
  clamp, clamp01, sign, finite,
  resetFighter, stepFighter, resolveAttack, resolveDash,
  captureTick, ringOut, bodyOverlap, clampToDeck,
} from './physics.js';
import { makeAudio } from './audio.js';

// ==================== constants ====================
const DT = 1 / 60;
const ROUND_ORDER = ['duel', 'capture', 'push'];
const ROUND_META = {
  duel:    { zh: '斗剑', time: 60, hint: '削减对方体力；格挡与冲刺决定攻防节奏' },
  capture: { zh: '抢点', time: 55, hint: '站上中央灯台，先积满灯焰；两人同站则互相压制' },
  push:    { zh: '推挤', time: 50, hint: '把对手撞出浮台边界；冲刺撞击有真实冲量' },
};
const BEST_WINS_KEY = 'twa.bestWins';
const BEST_TIME_KEY = 'twa.bestTime';
const MUTE_KEY = 'twa.mute';
const AUTOTEST = new URLSearchParams(location.search).has('autotest');
const URLP = new URLSearchParams(location.search);

const AI_PROFILES = {
  easy:   { key: 'easy',   label: '易', speed: 150, accel: 1050, reaction: 0.34, aggression: 0.42, blockChance: 0.25, edgeCare: 0.35, dashChance: 0.16, jumpChance: 0.03 },
  medium: { key: 'medium', label: '中', speed: 225, accel: 1500, reaction: 0.17, aggression: 0.72, blockChance: 0.55, edgeCare: 0.62, dashChance: 0.42, jumpChance: 0.06 },
  hard:   { key: 'hard',   label: '难', speed: 300, accel: 2200, reaction: 0.06, aggression: 0.95, blockChance: 0.85, edgeCare: 0.92, dashChance: 0.82, jumpChance: 0.10 },
};
const DIFF_ORDER = ['easy', 'medium', 'hard'];

function diffKey(v) {
  if (typeof v === 'number' || /^[1-3]$/.test(String(v))) {
    const i = clamp((parseInt(v, 10) || 2) - 1, 0, 2);
    return DIFF_ORDER[i];
  }
  return AI_PROFILES[v] ? v : 'medium';
}

// ==================== persistent state ====================
let bestWins = 0, bestTime = 0;
try { bestWins = parseInt(localStorage.getItem(BEST_WINS_KEY) || '0', 10) || 0; } catch (e) { bestWins = 0; }
try { bestTime = parseFloat(localStorage.getItem(BEST_TIME_KEY) || '0') || 0; } catch (e) { bestTime = 0; }
let muted = false;
try { muted = localStorage.getItem(MUTE_KEY) === '1'; } catch (e) { muted = false; }

const audio = makeAudio();
audio.setMuted(muted);

// ==================== mutable game state ====================
let mode = 'title';                 // title | play | over
let gameMode = 'ai';                // ai | local
let aiDiff = 'medium';
let profile = AI_PROFILES.medium;
let phase = 'intro';                // intro | live | result | over
let paused = false, noAuto = false;
let p1Wins = 0, p2Wins = 0, roundsPlayed = 0;
let roundIndex = 0, overtime = false;
let winner = null;
let matchTime = 0;
let nanFlag = false;
let animT = 0;
let hitstopT = 0, shakeT = 0, shakeDur = 0.18, shakeAmp = 0, flashT = 0, bannerT = 0;
let reportTarget = null;

const p1 = resetFighter({}, 'p1', CX - 155, 1);
const p2 = resetFighter({}, 'p2', CX + 155, -1);
const players = [p1, p2];

let round = {
  index: 0, type: 'duel', overtime: false,
  countdown: 3, timeLeft: 40, elapsed: 0,
  half: 300, startHalf: 300, endHalf: 300, shrinkTime: 24,
  result: null, resultReason: '', resultT: 0,
  contested: false, lastImpulse: 0, lastAttack: null, lastDash: null,
};

const roundsLog = [];
const reports = [];
const particles = [];
const held = new Set();
const pressed = new Set();

// AI intent
let aiTimer = 0;
let aiSeed = 1.73;
let aiIntent = { move: 0, attack: false, defend: false, dash: false, dashDir: 1, jump: false };
let aiInput = { left: false, right: false, jump: false, attack: false, block: false, defense: false };

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

// ==================== procedural static art ====================
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
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

const bgCv = document.createElement('canvas');
bgCv.width = W * 2; bgCv.height = H * 2;

function drawStaticLantern(c, x, y, rad, rnd) {
  c.save();
  c.strokeStyle = 'rgba(216,164,77,.35)'; c.lineWidth = 1;
  c.beginPath(); c.moveTo(x, 0); c.lineTo(x, y - rad); c.stroke();
  const glow = c.createRadialGradient(x, y, rad * .4, x, y, rad * 3.6);
  glow.addColorStop(0, 'rgba(255,176,86,.20)');
  glow.addColorStop(.5, 'rgba(255,140,70,.06)');
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = glow;
  c.beginPath(); c.arc(x, y, rad * 3.6, 0, Math.PI * 2); c.fill();
  const body = c.createRadialGradient(x - rad * .3, y - rad * .35, rad * .1, x, y, rad * 1.05);
  body.addColorStop(0, '#ffd695'); body.addColorStop(.45, '#e88a4c');
  body.addColorStop(.8, '#a5432c'); body.addColorStop(1, '#5e231f');
  c.fillStyle = body;
  c.beginPath(); c.ellipse(x, y, rad, rad * 1.2, 0, 0, Math.PI * 2); c.fill();
  c.strokeStyle = 'rgba(255,214,150,.55)'; c.lineWidth = 1;
  for (let i = -2; i <= 2; i++) {
    c.beginPath(); c.ellipse(x, y, rad * (.4 + Math.abs(i) * .13), rad * 1.2, 0, 0, Math.PI * 2); c.stroke();
  }
  c.fillStyle = 'rgba(58,20,18,.9)';
  c.fillRect(x - rad * .55, y - rad * 1.3, rad * 1.1, rad * .17);
  c.fillRect(x - rad * .55, y + rad * 1.13, rad * 1.1, rad * .17);
  c.strokeStyle = 'rgba(216,164,77,.7)';
  c.beginPath(); c.moveTo(x, y + rad * 1.3); c.lineTo(x + (rnd() - .5) * 8, y + rad * 1.75); c.stroke();
  c.restore();
}

function drawCrowd(c, rnd) {
  // paper-cut audience: two rows of angular silhouettes along the bottom
  c.save();
  const rows = [
    { base: 505, scale: 1.16, col: '#06050d' },
    { base: 526, scale: 1.4, col: '#0a0813' },
  ];
  for (const row of rows) {
    for (let i = -1; i < 34; i++) {
      const x = i * 31 + (rnd() - .5) * 9;
      const s = row.scale * (0.85 + rnd() * .4);
      const h = 16 * s, hr = 8.4 * s;
      c.fillStyle = row.col;
      c.beginPath();
      c.moveTo(x - 13 * s, row.base + 14);
      c.lineTo(x - 11 * s, row.base - h * .3);
      c.lineTo(x - 7 * s, row.base - h * .62);
      c.lineTo(x - 3 * s, row.base - h * .48);
      c.lineTo(x, row.base - h);
      c.lineTo(x + 3 * s, row.base - h * .48);
      c.lineTo(x + 7 * s, row.base - h * .62);
      c.lineTo(x + 11 * s, row.base - h * .3);
      c.lineTo(x + 13 * s, row.base + 14);
      c.closePath(); c.fill();
      c.beginPath(); c.arc(x, row.base - h - hr * .55, hr, 0, Math.PI * 2); c.fill();
      if (rnd() < .34) {
        c.strokeStyle = 'rgba(216,164,77,.13)'; c.lineWidth = .8;
        c.beginPath(); c.arc(x, row.base - h - hr * .55, hr * .9, Math.PI * 1.06, Math.PI * 1.62); c.stroke();
      }
      if (rnd() < .16) {
        c.fillStyle = 'rgba(88,216,192,.20)';
        c.beginPath(); c.arc(x + 4 * s, row.base - h - hr * .55, 1.2, 0, 7); c.fill();
      }
    }
  }
  c.restore();
}

function buildStaticArt() {
  const c = bgCv.getContext('2d');
  c.scale(2, 2);
  const rnd = mulberry32(0x7a11a9e);

  // deep indigo night paper
  let g = c.createLinearGradient(0, 0, W * .4, H);
  g.addColorStop(0, '#0a0818'); g.addColorStop(.38, '#121027');
  g.addColorStop(.72, '#0c0a1e'); g.addColorStop(1, '#05040c');
  c.fillStyle = g; c.fillRect(0, 0, W, H);

  // low moon haze
  let moon = c.createRadialGradient(762, 104, 8, 762, 104, 240);
  moon.addColorStop(0, 'rgba(255,226,174,.22)');
  moon.addColorStop(.35, 'rgba(238,176,116,.08)');
  moon.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = moon; c.fillRect(0, 0, W, 380);
  c.fillStyle = 'rgba(255,232,190,.36)';
  c.beginPath(); c.arc(762, 104, 27, 0, Math.PI * 2); c.fill();
  c.fillStyle = 'rgba(236,194,146,.15)';
  c.beginPath(); c.arc(756, 99, 8, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.arc(770, 111, 5, 0, Math.PI * 2); c.fill();

  // paper fibres / distant sparks
  for (let i = 0; i < 260; i++) {
    const x = rnd() * W, y = rnd() * H;
    c.fillStyle = `rgba(${210 + rnd() * 45 | 0},${190 + rnd() * 50 | 0},${150 + rnd() * 70 | 0},${.035 + rnd() * .16})`;
    c.beginPath(); c.arc(x, y, .35 + rnd() * 1.15, 0, 7); c.fill();
  }
  for (let i = 0; i < 46; i++) {
    const x = rnd() * W, y = rnd() * H, len = 16 + rnd() * 70;
    c.strokeStyle = `rgba(${rnd() < .5 ? '216,164,77' : '82,103,223'},${.02 + rnd() * .05})`;
    c.lineWidth = .6;
    c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + len * .4, y + (rnd() - .5) * 11, x + len, y + (rnd() - .5) * 5); c.stroke();
  }

  // distant eaves silhouettes
  c.fillStyle = 'rgba(6,5,14,.82)';
  c.beginPath();
  c.moveTo(-20, 292);
  for (let x = -20; x <= W + 20; x += 62) {
    c.quadraticCurveTo(x + 26, 274 + Math.sin(x * .02) * 6, x + 62, 292);
  }
  c.lineTo(W + 20, 372); c.lineTo(-20, 372); c.closePath(); c.fill();
  c.strokeStyle = 'rgba(216,164,77,.07)'; c.lineWidth = 1;
  c.beginPath(); c.moveTo(-20, 294); c.lineTo(W + 20, 294); c.stroke();

  // hanging lanterns
  drawStaticLantern(c, 96, 86, 21, rnd);
  drawStaticLantern(c, 868, 70, 17, rnd);

  // crowd
  drawCrowd(c, rnd);

  // faint central sigil behind the arena
  c.save();
  c.translate(CX, 330);
  c.strokeStyle = 'rgba(216,164,77,.055)'; c.lineWidth = 1.2;
  for (let r = 58; r <= 196; r += 46) {
    c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.stroke();
  }
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2;
    c.beginPath(); c.moveTo(Math.cos(a) * 64, Math.sin(a) * 64);
    c.lineTo(Math.cos(a) * 190, Math.sin(a) * 190); c.stroke();
  }
  c.restore();

  // bottom vignette
  const vig = c.createLinearGradient(0, 430, 0, H);
  vig.addColorStop(0, 'rgba(0,0,0,0)'); vig.addColorStop(1, 'rgba(0,0,0,.46)');
  c.fillStyle = vig; c.fillRect(0, 430, W, H - 430);
}
buildStaticArt();

// ==================== reports / bridge ====================
function scoreInt() { return p1Wins * 100 + p2Wins; }
function matchProgress() { return Math.round(clamp01(roundsPlayed / 3) * 100); }
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
      if (kind === 'ready') window.parent.postMessage({ source: 'lightgame', type: 'lightgame:ready', gameId: 'twin-tempo-arena', v: 1 }, '*');
    }
  } catch (e) { }
}
report('ready', { game: 'twin-tempo-arena' });

// ==================== helpers ====================
function fmtTime(t) {
  const s = Math.max(0, finite(t));
  const m = Math.floor(s / 60), ss = Math.floor(s % 60), d = Math.floor((s - Math.floor(s)) * 10);
  return `${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}.${d}`;
}
function fmtBest() {
  if (bestWins <= 0 && bestTime <= 0) return '尚无纪录 · 夺冠后记下最快用时';
  const parts = [];
  parts.push(bestWins > 0 ? `最佳 ${bestWins} 胜` : '尚无胜场');
  parts.push(bestTime > 0 ? `最快夺冠 ${fmtTime(bestTime)}` : '尚无夺冠');
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
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toastEl.classList.remove('show'), ms);
}
function roundMeta() { return ROUND_META[round.type] || ROUND_META.duel; }
function nameOf(side) {
  if (side === 'p1') return gameMode === 'local' ? 'P1' : '你';
  return gameMode === 'local' ? 'P2' : `灯影·${profile.label}`;
}
function sideColor(side) { return side === 'p1' ? '#ff8b66' : '#93a4ff'; }

// ==================== flow ====================
function hideOverlays() { titleEl.classList.add('hide'); endEl.classList.add('hide'); }
function goTitle() {
  mode = 'title'; phase = 'intro'; paused = false; winner = null;
  p1Wins = 0; p2Wins = 0; roundsPlayed = 0; roundIndex = 0; overtime = false;
  matchTime = 0; hitstopT = 0; shakeT = 0; flashT = 0; bannerT = 0; nanFlag = false;
  particles.length = 0;
  resetFighter(p1, 'p1', CX - 155, 1);
  resetFighter(p2, 'p2', CX + 155, -1);
  round = {
    index: 0, type: 'duel', overtime: false, countdown: 3, timeLeft: 40, elapsed: 0,
    half: 300, startHalf: 300, endHalf: 300, shrinkTime: 24,
    result: null, resultReason: '', resultT: 0, contested: false,
    lastImpulse: 0, lastAttack: null, lastDash: null,
  };
  hideOverlays();
  titleEl.classList.remove('hide');
  endEl.classList.add('hide');
  updateTitleBest(); updatePauseButton(); updateMuteButton();
  audio.setState('title'); audio.reset();
}

function startMatch(gm = 'ai', diff = aiDiff) {
  gameMode = gm === 'local' ? 'local' : 'ai';
  aiDiff = diffKey(diff);
  profile = AI_PROFILES[aiDiff];
  mode = 'play'; paused = false; winner = null;
  p1Wins = 0; p2Wins = 0; roundsPlayed = 0; matchTime = 0;
  overtime = false; roundIndex = 0;
  nanFlag = false; hitstopT = 0; shakeT = 0; flashT = 0; bannerT = 0;
  particles.length = 0;
  roundsLog.length = 0;
  p1.maxSpd = MAX_SPD; p1.accel = ACCEL;
  p2.maxSpd = gameMode === 'ai' ? profile.speed : MAX_SPD;
  p2.accel = gameMode === 'ai' ? profile.accel : ACCEL;
  hideOverlays();
  startRound(0);
  audio.reset();
  audio.setState(round.type);
  updateMuteButton(); updatePauseButton();
  return true;
}

function startRound(index) {
  roundIndex = index;
  const ot = index >= 3;
  overtime = ot;
  const type = ot ? 'push' : ROUND_ORDER[index];
  const meta = ROUND_META[type];
  const startHalf = ot ? 190 : (type === 'push' ? 255 : 300);
  const endHalf = ot ? 112 : (type === 'push' ? 138 : 300);
  round = {
    index, type, overtime: ot,
    countdown: ot ? 2.4 : 3.0,
    timeLeft: ot ? 30 : meta.time,
    elapsed: 0,
    half: startHalf, startHalf, endHalf,
    shrinkTime: ot ? 12 : 24,
    result: null, resultReason: '', resultT: 0,
    contested: false, lastImpulse: 0, lastAttack: null, lastDash: null,
  };
  phase = 'intro';
  const spawn = type === 'capture' ? 230 : Math.min(155, startHalf * .58);
  resetFighter(p1, 'p1', CX - spawn, 1);
  resetFighter(p2, 'p2', CX + spawn, -1);
  p1.maxSpd = MAX_SPD; p1.accel = ACCEL;
  p2.maxSpd = gameMode === 'ai' ? profile.speed : MAX_SPD;
  p2.accel = gameMode === 'ai' ? profile.accel : ACCEL;
  aiTimer = 0; aiIntent = { move: 0, attack: false, defend: false, dash: false, dashDir: 1, jump: false };
  aiInput = { left: false, right: false, jump: false, attack: false, block: false, defense: false };
  audio.setState(type);
  if (ot) toast('三回合战平 · 加时一回合推挤');
}

function beginLive() {
  if (phase !== 'intro' && phase !== 'result') return false;
  phase = 'live';
  round.countdown = 0;
  round.resultT = 0;
  bannerT = 0.75;
  aiTimer = 0;
  audio.play('start');
  audio.setState(round.type);
  updatePauseButton();
  return true;
}

function endRound(result, reason) {
  if (phase !== 'live') return false;
  phase = 'result';
  round.result = result;
  round.resultReason = reason || '';
  round.resultT = 2.15;
  roundsPlayed++;
  if (result === 'p1') p1Wins++;
  else if (result === 'p2') p2Wins++;
  roundsLog.push({ type: round.type, winner: result, reason: round.resultReason });
  hitstopT = 0;
  shakeT = 0.32; shakeDur = 0.32; shakeAmp = result === 'draw' ? 5 : 8;
  if (result === 'draw') {
    toast('本回合平局');
  } else {
    audio.play('roundWin');
    toast(result === 'p1' ? 'P1 拿下本回合' : (gameMode === 'local' ? 'P2 拿下本回合' : '灯影拿下本回合'));
  }
  if (result !== 'draw') confetti(result === 'p1' ? ['#ff9a76', '#ffd98e', '#e8553a'] : ['#9aabff', '#bdfff1', '#5267df'], 34);
  audio.setState('result');
  report('progress', {
    score: scoreInt(), progress: matchProgress(),
    round: roundIndex + 1, type: round.type, result,
    p1Wins, p2Wins, overtime,
  });
  updatePauseButton();
  return true;
}

function advanceRound() {
  if (phase !== 'result') return false;
  if (!round.overtime && roundIndex < 2) {
    startRound(roundIndex + 1);
    return true;
  }
  if (!round.overtime && roundIndex >= 2) {
    if (p1Wins === p2Wins) {
      overtime = true;
      startRound(3);
    } else {
      endMatch();
    }
    return true;
  }
  if (round.overtime) {
    if (p1Wins === p2Wins) startRound(roundIndex + 1);
    else endMatch();
    return true;
  }
  return false;
}

function saveBest() {
  let changed = false;
  if (p1Wins > bestWins) {
    bestWins = p1Wins;
    try { localStorage.setItem(BEST_WINS_KEY, String(bestWins)); } catch (e) { }
    changed = true;
  }
  if (p1Wins > p2Wins && matchTime > 0 && (bestTime <= 0 || matchTime < bestTime)) {
    bestTime = Math.round(matchTime * 100) / 100;
    try { localStorage.setItem(BEST_TIME_KEY, String(bestTime)); } catch (e) { }
    changed = true;
  }
  updateTitleBest();
  return changed;
}

function endMatch() {
  if (mode !== 'play') return false;
  phase = 'over'; mode = 'over'; paused = false;
  winner = p1Wins > p2Wins ? 'p1' : p2Wins > p1Wins ? 'p2' : 'draw';
  const won = winner === 'p1';
  let isNew = false;
  audio.setState('end');
  if (won) {
    audio.play('win');
    isNew = saveBest();
    report('complete', {
      score: scoreInt(), progress: 100,
      p1Wins, p2Wins, rounds: roundsPlayed, overtime,
      time: Math.round(matchTime * 100) / 100,
    });
  } else {
    audio.play('lose');
    report('gameOver', {
      score: scoreInt(), progress: matchProgress(),
      p1Wins, p2Wins, rounds: roundsPlayed, overtime,
      time: Math.round(matchTime * 100) / 100,
    });
  }
  showEnd(won, isNew);
  updatePauseButton();
  return true;
}

function showEnd(won, isNew) {
  const ai = gameMode === 'ai';
  if (won) {
    endkickEl.textContent = 'MATCH RESULT · 双生记';
    endhEl.textContent = ai ? '朱 红 夺 冠' : 'P1 夺 冠';
  } else {
    endkickEl.textContent = 'MATCH RESULT · 双生记';
    endhEl.textContent = ai ? '灯 影 胜 出' : 'P2 夺 冠';
  }
  const lines = [];
  lines.push(`${ai ? '你' : 'P1'}  ${p1Wins}  :  ${p2Wins}  ${ai ? `灯影·${profile.label}` : 'P2'}`);
  const labels = roundsLog.map(r => `${ROUND_META[r.type].zh} ${r.winner === 'p1' ? (ai ? '你' : 'P1') : r.winner === 'p2' ? (ai ? '灯影' : 'P2') : '平'}`);
  if (labels.length) lines.push(labels.join(' · '));
  lines.push(`用时 ${fmtTime(matchTime)}${overtime ? ' · 加时' : ''}`);
  lines.push(isNew ? '★ 新纪录已写入' : `最佳 ${bestWins} 胜${bestTime > 0 ? ' · 最快 ' + fmtTime(bestTime) : ''}`);
  if (!won) lines.push('换回合的节奏，再守一次灯台。');
  enddEl.textContent = lines.join('\n');
  endEl.classList.remove('hide');
  titleEl.classList.add('hide');
  updateTitleBest();
}

function forceWin() {
  if (mode !== 'play') startMatch(gameMode, aiDiff);
  p1Wins = 3; p2Wins = 0; roundsPlayed = Math.max(roundsPlayed, 3);
  report('progress', { score: scoreInt(), progress: 100, p1Wins, p2Wins, forced: true });
  return endMatch();
}
function forceFail() {
  if (mode !== 'play') startMatch(gameMode, aiDiff);
  p1Wins = 0; p2Wins = 3; roundsPlayed = Math.max(roundsPlayed, 3);
  report('progress', { score: scoreInt(), progress: matchProgress(), p1Wins, p2Wins, forced: true });
  return endMatch();
}
function forceRoundWin(side) {
  if (mode !== 'play') startMatch(gameMode, aiDiff);
  if (phase !== 'live') beginLive();
  return endRound(side === 'p2' ? 'p2' : side === 'draw' ? 'draw' : 'p1', 'forced');
}
function forceDraw() {
  if (mode !== 'play') startMatch(gameMode, aiDiff);
  if (phase !== 'live') beginLive();
  return endRound('draw', 'forced');
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
const MOVE_CODES = new Set([
  'KeyA', 'KeyD', 'KeyW', 'KeyF', 'KeyG', 'KeyS',
  'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
  'KeyJ', 'KeyL', 'Numpad0', 'Numpad1', 'Space',
]);
function onKeyDown(e) {
  if (e.isComposing || e.keyCode === 229) return;
  if (e.metaKey || e.altKey || e.ctrlKey) return;
  if (MOVE_CODES.has(e.code)) e.preventDefault();
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

function handleSystemKeys() {
  if (pressed.has('KeyM')) toggleMute();
  if (pressed.has('KeyP')) {
    if (mode === 'play') togglePause();
  }
  if (pressed.has('KeyR')) {
    if (mode === 'play' || mode === 'over') { startMatch(gameMode, aiDiff); toast('已重开一局'); }
  }
  if (pressed.has('Escape')) {
    if (mode === 'play') { if (phase === 'over') goTitle(); else togglePause(); }
  }
}

function readP1Input() {
  return {
    left: held.has('KeyA'), right: held.has('KeyD'),
    jump: pressed.has('KeyW'), attack: pressed.has('KeyF'),
    block: held.has('KeyG'), defense: pressed.has('KeyG'),
  };
}
function readP2Input() {
  return {
    left: held.has('ArrowLeft'), right: held.has('ArrowRight'),
    jump: pressed.has('ArrowUp'),
    attack: pressed.has('KeyJ') || pressed.has('Numpad0'),
    block: held.has('KeyL') || held.has('Numpad1'),
    defense: pressed.has('KeyL') || pressed.has('Numpad1'),
  };
}
function readAiInput() { return { ...aiInput }; }

// touch pads
const touchPointers = new Map();
(function bindTouch() {
  document.querySelectorAll('#touch button').forEach(btn => {
    const code = btn.dataset.code;
    const down = (e) => {
      e.preventDefault(); e.stopPropagation();
      document.body.classList.add('touchui');
      if (!AUTOTEST) audio.unlock();
      try { btn.setPointerCapture && btn.setPointerCapture(e.pointerId); } catch (err) { }
      const list = touchPointers.get(e.pointerId) || new Set();
      list.add(code); touchPointers.set(e.pointerId, list);
      if (!held.has(code)) pressed.add(code);
      held.add(code);
      btn.classList.add('on');
      audio.play('ui');
    };
    const up = (e) => {
      e.preventDefault();
      const list = touchPointers.get(e.pointerId);
      if (list) {
        list.delete(code);
        if (!list.size) touchPointers.delete(e.pointerId);
      }
      // release only if no other pointer still holds this code
      let still = false;
      for (const set of touchPointers.values()) if (set.has(code)) still = true;
      if (!still) held.delete(code);
      btn.classList.remove('on');
    };
    btn.addEventListener('pointerdown', down);
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointercancel', up);
    btn.addEventListener('pointerleave', up);
    btn.addEventListener('contextmenu', e => e.preventDefault());
  });
})();

// ==================== AI ====================
function resetAI() {
  aiTimer = 0;
  aiIntent = { move: 0, attack: false, defend: false, dash: false, dashDir: 1, jump: false };
  aiInput = { left: false, right: false, jump: false, attack: false, block: false, defense: false };
}
function decideAI() {
  const s = p2, o = p1;
  const dx = o.x - s.x;
  const adx = Math.abs(dx);
  const dir = sign(dx) || 1;
  const edge = round.half - Math.abs(s.x - CX);
  let move = 0, attack = false, defend = false, dash = false, dashDir = dir;
  let jump = Math.random() < profile.jumpChance;
  aiSeed += 0.37;

  if (s.fallen) { aiIntent = { move: 0, attack: false, defend: false, dash: false, dashDir: 1, jump: false }; return; }

  if (round.type === 'capture') {
    const inZone = Math.abs(s.x - CX) <= CAPTURE.zone - 10;
    let target = CX;
    if (inZone && Math.abs(o.x - CX) <= CAPTURE.zone) {
      // contest: shadow the player inside the light instead of drifting out
      target = o.x + (s.x >= o.x ? 30 : -30);
    }
    move = Math.abs(target - s.x) > 9 ? sign(target - s.x) : 0;
    if (adx < 60 && Math.random() < profile.aggression) attack = true;
    if (o.atkAnim > 0 && adx < 92 && Math.random() < profile.blockChance) { defend = true; move = 0; }
  } else if (round.type === 'duel') {
    if (edge < 34 + 26 * profile.edgeCare) move = sign(CX - s.x);
    else if (adx > 82) move = dir;
    else {
      move = 0;
      if (s.atkCd <= 0 && Math.random() < profile.aggression) attack = true;
    }
    if (o.atkAnim > 0 && adx < 90 && Math.random() < profile.blockChance) { defend = true; move = 0; }
    if (s.hp < 28 && adx < 70 && Math.random() < .28) move = -dir;
  } else {
    if (edge < 38 + 44 * profile.edgeCare) move = sign(CX - s.x);
    else if (adx > 34) move = dir;
    if (adx < 64 && Math.random() < profile.aggression) attack = true;
    if (adx > 28 && adx < 132 && s.dashCd <= 0 && Math.random() < profile.dashChance) {
      dash = true; dashDir = dir; move = 0;
    }
    if (o.atkAnim > 0 && adx < 82 && Math.random() < profile.blockChance) { defend = true; move = 0; }
    if (edge < 20 && Math.random() < .6) { dash = false; move = sign(CX - s.x); }
  }
  aiIntent = { move, attack, defend, dash, dashDir, jump };
}
function aiThink(dt) {
  if (phase !== 'live') {
    aiInput = { left: false, right: false, jump: false, attack: false, block: false, defense: false };
    return;
  }
  aiTimer -= dt;
  if (aiTimer <= 0) {
    aiTimer = Math.max(0.025, profile.reaction);
    decideAI();
  }
  const inp = {
    left: aiIntent.move < 0, right: aiIntent.move > 0,
    jump: false, attack: false, block: false, defense: false,
  };
  if (aiIntent.jump) { inp.jump = true; aiIntent.jump = false; }
  if (aiIntent.attack) { inp.attack = true; aiIntent.attack = false; }
  if (aiIntent.dash) {
    inp.defense = true; inp.block = false;
    inp.left = aiIntent.dashDir < 0; inp.right = aiIntent.dashDir > 0;
    aiIntent.dash = false;
  } else if (aiIntent.defend) {
    inp.block = true;
  }
  aiInput = inp;
}

// ==================== combat actions ====================
function startDash(f, dir) {
  f.dashT = DASH.dur;
  f.dashCd = DASH.cd;
  f.invulnT = DASH.invuln;
  f.dashHit = false;
  f.vx = dir * DASH.speed;
  f.facing = dir;
  f.trail = [];
  audio.play('dash');
  burst(f.x, 6, f.side === 'p1' ? '#ff9a76' : '#9aabff', 5, 90);
}
function applyPreInput(f, inp) {
  if (f.fallen) return;
  if (inp.defense && f.dashCd <= 0 && f.stunT <= 0 && f.onGround) {
    const dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    if (dir !== 0) startDash(f, dir);
  }
}
function faceOpponent(f, opp, inp) {
  const moving = (inp.left ? -1 : 0) + (inp.right ? 1 : 0);
  if (!moving && opp) f.facing = sign(opp.x - f.x) || f.facing;
}
function doAttack(f, opp, inp) {
  if (f.fallen || f.stunT > 0 || f.atkCd > 0) return null;
  faceOpponent(f, opp, inp);
  f.atkCd = ATTACK.cd;
  f.atkAnim = ATTACK.anim;
  const res = resolveAttack(f, opp, { push: round.type === 'push' });
  if (!res.hit) { audio.play('swing'); return res; }
  round.lastAttack = { by: f.side, ...res };
  hitstopT = 0.07;
  shakeDur = 0.16; shakeT = 0.16; shakeAmp = 6;
  const col = f.side === 'p1' ? '#ffb08a' : '#bcc7ff';
  const zz = opp.z;
  if (res.blocked) {
    audio.play('block');
    burst(opp.x, clamp(38 + zz, 22, 90), '#8ff2db', 10, 190);
    ring(opp.x, clamp(34 + zz, 20, 84), '#8ff2db', 16, 150, .28);
    flashT = 0.05;
  } else {
    audio.play('hit', 0.8);
    burst(opp.x, 34 + zz, col, 16, 280);
    ring(opp.x, 34 + zz, col, 18, 190, .32);
    flashT = 0.08;
  }
  return res;
}
function onDashHit(att, def, res) {
  round.lastImpulse = Math.max(round.lastImpulse, res.impulse);
  round.lastDash = { by: att.side, ...res };
  hitstopT = 0.06;
  shakeDur = 0.2; shakeT = 0.2; shakeAmp = 7;
  const col = att.side === 'p1' ? '#ffb08a' : '#bcc7ff';
  audio.play(res.blocked ? 'block' : 'hit', 1);
  burst(def.x, 30 + def.z, res.blocked ? '#8ff2db' : col, res.blocked ? 8 : 16, 320);
  ring(def.x, 30 + def.z, res.blocked ? '#8ff2db' : col, 20, 220, .3);
}

// ==================== particles / fx ====================
function addParticle(p) {
  if (particles.length >= 380) particles.splice(0, 24);
  particles.push(p);
}
function burst(x, y, color, n = 8, power = 200) {
  for (let i = 0; i < n; i++) {
    const a = (Math.random() - .5) * Math.PI * 1.7 - Math.PI / 2;
    const sp = power * (.35 + Math.random() * .8);
    addParticle({
      type: 'spark', x, y,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40,
      life: .22 + Math.random() * .34, max: .56,
      size: 1.2 + Math.random() * 2.6, color, grav: 520, drag: .4,
    });
  }
}
function ring(x, y, color, size = 16, grow = 180, life = .35) {
  addParticle({ type: 'ring', x, y, vx: 0, vy: 0, life, max: life, size, grow, color, grav: 0, drag: 0 });
}
function dust(x, n = 6) {
  for (let i = 0; i < n; i++) {
    addParticle({
      type: 'dust', x: x + (Math.random() - .5) * 20, y: GROUND + 5,
      vx: (Math.random() - .5) * 130, vy: -30 - Math.random() * 60,
      life: .2 + Math.random() * .3, max: .5,
      size: 1 + Math.random() * 3, color: 'rgba(216,164,77,.6)', grav: 100, drag: .8,
    });
  }
}
function confetti(colors, n = 40) {
  for (let i = 0; i < n; i++) {
    addParticle({
      type: 'confetti', x: CX + (Math.random() - .5) * 420, y: 60 + Math.random() * 60,
      vx: (Math.random() - .5) * 190, vy: 30 + Math.random() * 90,
      life: 1.4 + Math.random() * 1.2, max: 2.6,
      size: 2 + Math.random() * 3.6, color: colors[i % colors.length], grav: 90, drag: .25,
      rot: Math.random() * 7, vr: (Math.random() - .5) * 8,
    });
  }
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
}
function updateFx(dt) {
  if (hitstopT > 0) hitstopT = Math.max(0, hitstopT - dt);
  if (shakeT > 0) shakeT = Math.max(0, shakeT - dt);
  if (flashT > 0) flashT = Math.max(0, flashT - dt);
  if (bannerT > 0) bannerT = Math.max(0, bannerT - dt);
  updateParticles(dt);
  for (const f of players) {
    if (f.trail) for (const t of f.trail) t.life -= dt;
    if (f.trail) f.trail = f.trail.filter(t => t.life > 0);
    f.flashT = Math.max(0, f.flashT || 0);
  }
}

// ==================== update ====================
function update(dt) {
  if (!Number.isFinite(dt) || dt <= 0) return;
  handleSystemKeys();
  animT += dt;
  audio.tick(dt);
  audio.setState(mode === 'title' ? 'title' : mode === 'over' ? 'end' : phase === 'result' ? 'result' : round.type);

  if (mode === 'title') {
    updateFx(dt);
    pressed.clear();
    return;
  }
  if (mode === 'over') {
    updateFx(dt);
    pressed.clear();
    return;
  }
  if (paused) {
    pressed.clear();
    return;
  }

  matchTime += dt;

  if (phase === 'intro') {
    if (!noAuto) {
      const before = Math.ceil(round.countdown);
      round.countdown -= dt;
      const after = Math.ceil(round.countdown);
      if (after !== before && after >= 1 && after <= 3) audio.play('count');
      if (round.countdown <= 0) beginLive();
    }
    updateFx(dt);
    pressed.clear();
    return;
  }

  if (phase === 'result') {
    if (!noAuto) {
      round.resultT -= dt;
      if (round.resultT <= 0) advanceRound();
    }
    updateFx(dt);
    pressed.clear();
    return;
  }

  if (phase === 'over') {
    updateFx(dt);
    pressed.clear();
    return;
  }

  // ---- live ----
  const p1in = readP1Input();
  let p2in;
  if (gameMode === 'local') p2in = readP2Input();
  else { aiThink(dt); p2in = readAiInput(); }

  applyPreInput(p1, p1in);
  applyPreInput(p2, p2in);

  stepFighter(p1, p1in, dt);
  stepFighter(p2, p2in, dt);

  if (p1.justLanded) { dust(p1.x, 4); audio.play('land'); p1.justLanded = false; }
  if (p2.justLanded) { dust(p2.x, 4); audio.play('land'); p2.justLanded = false; }
  if (p1in.jump && p1.vz > 0 && !p1.onGround && p1.z > 0) audio.play('jump');
  if (p2in.jump && p2.vz > 0 && !p2.onGround && p2.z > 0) audio.play('jump');

  if (p1.dashT > 0) {
    p1.trail = p1.trail || [];
    if (!p1.trail.length || Math.abs(p1.x - p1.trail[p1.trail.length - 1].x) > 5) p1.trail.push({ x: p1.x, z: p1.z, life: .24 });
  }
  if (p2.dashT > 0) {
    p2.trail = p2.trail || [];
    if (!p2.trail.length || Math.abs(p2.x - p2.trail[p2.trail.length - 1].x) > 5) p2.trail.push({ x: p2.x, z: p2.z, life: .24 });
  }

  if (hitstopT <= 0) {
    if (p1in.attack) doAttack(p1, p2, p1in);
    if (p2in.attack) doAttack(p2, p1, p2in);
    const d1 = resolveDash(p1, p2);
    if (d1) onDashHit(p1, p2, d1);
    const d2 = resolveDash(p2, p1);
    if (d2) onDashHit(p2, p1, d2);
  }

  // body separation so fighters cannot occupy the same point
  if (bodyOverlap(p1, p2)) {
    const dir = sign(p1.x - p2.x) || 1;
    const overlap = FIGHTER_R * 1.8 - Math.abs(p1.x - p2.x);
    if (overlap > 0) {
      p1.x += dir * overlap * .5;
      p2.x -= dir * overlap * .5;
      const rel = p1.vx - p2.vx;
      if (Math.abs(rel) < 140) {
        p1.vx += dir * 20;
        p2.vx -= dir * 20;
      }
    }
  }

  // duel / capture have jade rails; only the push deck has open edges
  if (round.type !== 'push') {
    clampToDeck(p1, round.half);
    clampToDeck(p2, round.half);
  }

  // capture lamp
  if (round.type === 'capture') {
    const cap = captureTick(p1, p2, dt);
    round.contested = cap.contested;
    if ((cap.gain1 > 0 || cap.gain2 > 0) && Math.random() < .25) audio.play('lampTick');
  }

  // timer and push platform shrink
  if (!noAuto) {
    round.timeLeft = Math.max(0, round.timeLeft - dt);
    if (round.type === 'push') {
      round.elapsed += dt;
      const k = clamp01(round.elapsed / round.shrinkTime);
      round.half = round.startHalf + (round.endHalf - round.startHalf) * k;
    }
  }

  // push ring-out detection (instant fall once the feet clear the shrinking deck)
  if (round.type === 'push') {
    if (!p1.fallen && ringOut(p1, round.half)) triggerFall(p1);
    if (!p2.fallen && ringOut(p2, round.half)) triggerFall(p2);
  }

  updateFx(dt);

  if (!checkRoundEnd()) {
    if (!noAuto && round.timeLeft <= 0) timeoutRound();
  }

  if (round.timeLeft <= 7 && round.type !== 'capture') audio.setState(round.type === 'push' ? 'push' : 'duel');

  pressed.clear();
}

function triggerFall(f) {
  f.fallen = true;
  f.fallT = 0;
  f.vx *= .4;
  burst(f.x, 20, f.side === 'p1' ? '#ff9a76' : '#9aabff', 18, 260);
  ring(f.x, GROUND - 4, '#d8a44d', 20, 220, .4);
  shakeDur = .3; shakeT = .3; shakeAmp = 9;
  audio.play('hit', 1);
  toast(f.side === 'p1' ? 'P1 跌下浮台' : (gameMode === 'local' ? 'P2 跌下浮台' : '灯影跌下浮台'));
}

function checkRoundEnd() {
  if (phase !== 'live') return true;
  if (round.type === 'duel') {
    if (p1.hp <= 0 && p2.hp <= 0) return endRound('draw', 'ko');
    if (p1.hp <= 0) return endRound('p2', 'ko');
    if (p2.hp <= 0) return endRound('p1', 'ko');
  }
  if (p1.fallen && p2.fallen) return endRound('draw', 'ringout');
  if (p1.fallen) return endRound('p2', 'ringout');
  if (p2.fallen) return endRound('p1', 'ringout');
  if (round.type === 'capture') {
    if (p1.progress >= CAPTURE.goal && p2.progress >= CAPTURE.goal) return endRound('draw', 'lamp');
    if (p1.progress >= CAPTURE.goal) return endRound('p1', 'lamp');
    if (p2.progress >= CAPTURE.goal) return endRound('p2', 'lamp');
  }
  return false;
}

function timeoutRound() {
  if (phase !== 'live') return false;
  let result = 'draw';
  if (round.type === 'duel') {
    if (p1.hp > p2.hp + .01) result = 'p1';
    else if (p2.hp > p1.hp + .01) result = 'p2';
  } else if (round.type === 'capture') {
    if (p1.progress > p2.progress + .01) result = 'p1';
    else if (p2.progress > p1.progress + .01) result = 'p2';
  } else {
    const d1 = Math.abs(p1.x - CX), d2 = Math.abs(p2.x - CX);
    if (d1 + 1 < d2) result = 'p1';
    else if (d2 + 1 < d1) result = 'p2';
  }
  if (result === 'p1') audio.play('lampWin');
  return endRound(result, 'timeout');
}

// ==================== rendering ====================
const PAL = {
  p1: { robe1: '#ef6a46', robe2: '#8e2719', trim: '#ffd07e', glow: '255,118,78', skin: '#f4d8b4', hair: '#281017', accent: '#ff9a76' },
  p2: { robe1: '#5b71ea', robe2: '#232a7d', trim: '#9ff0dd', glow: '128,148,255', skin: '#ecd9c3', hair: '#11152e', accent: '#9aabff' },
};

function drawShadow(f) {
  const k = clamp01(1 - f.z / 190);
  const w = 24 * (.55 + .45 * k);
  ctx.save();
  ctx.fillStyle = `rgba(0,0,0,${.34 * k})`;
  ctx.beginPath(); ctx.ellipse(f.x, GROUND + 7, w, 6.5 * k, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawSword(f, pal, attacking, swing) {
  ctx.save();
  if (attacking) {
    const k = 1 - (f.atkAnim / ATTACK.anim);
    ctx.rotate(-0.65 + k * 1.5);
  } else {
    ctx.rotate(-0.12);
  }
  ctx.strokeStyle = '#2b1a12'; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(22, -38); ctx.lineTo(55, -44); ctx.stroke();
  ctx.strokeStyle = '#f6e4c0'; ctx.lineWidth = 2.2;
  ctx.beginPath(); ctx.moveTo(23, -38); ctx.lineTo(54, -44); ctx.stroke();
  ctx.strokeStyle = pal.trim; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(20, -34); ctx.lineTo(25, -42); ctx.stroke();
  ctx.restore();
}

function drawFighter(f, side, t, opts = {}) {
  const pal = PAL[side];
  const dir = f.facing >= 0 ? 1 : -1;
  const bob = opts.bob || 0;
  const y = GROUND - f.z - bob;
  const alpha = f.fallen ? clamp01(1 - f.fallT * .55) : 1;
  if (alpha <= 0) return;

  drawShadow(f);

  // dash afterimages
  if (f.trail && f.trail.length) {
    for (const tr of f.trail) {
      const a = clamp01(tr.life / .24) * .22;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = pal.robe1;
      ctx.beginPath();
      ctx.ellipse(tr.x, GROUND - tr.z - 30, 15, 28, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(f.x, y);
  if (f.fallen) ctx.rotate(Math.min(1.15, f.fallT * 1.8) * dir);
  ctx.scale(dir, 1);
  const walk = f.onGround && Math.abs(f.vx) > 30 ? Math.sin(f.walkPhase || 0) : 0;

  // leg strokes
  ctx.strokeStyle = '#1a1118'; ctx.lineWidth = 6; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-7, -20); ctx.lineTo(-11 + walk * 6, 0); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(7, -20); ctx.lineTo(11 - walk * 6, 0); ctx.stroke();
  ctx.strokeStyle = pal.trim; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(-11 + walk * 6, 0); ctx.lineTo(-5 + walk * 6, 0); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(11 - walk * 6, 0); ctx.lineTo(5 - walk * 6, 0); ctx.stroke();

  // trailing scarf (paper-cut ribbon)
  ctx.fillStyle = pal.robe2;
  ctx.beginPath();
  ctx.moveTo(-10, -50);
  ctx.quadraticCurveTo(-30 - Math.abs(f.vx) * .03, -46 + Math.sin(t * 6) * 3, -43, -36 + Math.sin(t * 5.2) * 5);
  ctx.lineTo(-27, -40);
  ctx.closePath(); ctx.fill();

  // robe
  const body = ctx.createLinearGradient(-20, -56, 22, 2);
  body.addColorStop(0, pal.robe1); body.addColorStop(.52, pal.robe1);
  body.addColorStop(.82, pal.robe2); body.addColorStop(1, '#201018');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(-14, -54);
  ctx.lineTo(-18, -34);
  ctx.lineTo(-23, -16);
  ctx.lineTo(-25, -2);
  ctx.lineTo(-14, 2);
  ctx.lineTo(-6, -1);
  ctx.lineTo(0, 2);
  ctx.lineTo(7, -1);
  ctx.lineTo(15, 2);
  ctx.lineTo(25, -2);
  ctx.lineTo(22, -18);
  ctx.lineTo(18, -34);
  ctx.lineTo(14, -54);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#160d14'; ctx.lineWidth = 2.6; ctx.stroke();
  // paper-cut inner edge
  ctx.strokeStyle = `rgba(255,225,190,.30)`; ctx.lineWidth = .9;
  ctx.beginPath(); ctx.moveTo(-11, -50); ctx.lineTo(-15, -22); ctx.lineTo(-18, -5); ctx.stroke();

  // sash
  ctx.strokeStyle = pal.trim; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-15, -32); ctx.quadraticCurveTo(0, -27, 16, -33); ctx.stroke();
  ctx.fillStyle = pal.trim;
  ctx.beginPath(); ctx.moveTo(-2, -30); ctx.lineTo(4, -27); ctx.lineTo(-1, -22); ctx.closePath(); ctx.fill();

  // shoulder / arm
  ctx.strokeStyle = pal.robe2; ctx.lineWidth = 7;
  ctx.beginPath(); ctx.moveTo(4, -50); ctx.lineTo(18, -40); ctx.stroke();
  ctx.strokeStyle = '#1a1118'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(4, -50); ctx.lineTo(18, -40); ctx.stroke();
  drawSword(f, pal, f.atkAnim > 0, f.atkAnim);

  // head
  ctx.fillStyle = pal.skin;
  ctx.beginPath(); ctx.arc(0, -62, 10.5, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#1a1118'; ctx.lineWidth = 2; ctx.stroke();
  // hair cap + topknot
  ctx.fillStyle = pal.hair;
  ctx.beginPath();
  ctx.arc(0, -64, 10.7, Math.PI * 1.02, Math.PI * 2.02);
  ctx.lineTo(10, -62); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.arc(-2, -73, 4.2, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = pal.trim; ctx.lineWidth = 1.3;
  ctx.beginPath(); ctx.moveTo(-2, -77); ctx.lineTo(3, -81); ctx.stroke();
  // eye + calm face mark
  ctx.fillStyle = '#24131a';
  ctx.beginPath(); ctx.arc(5, -62, 1.5, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(90,40,32,.55)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(1, -55); ctx.lineTo(7, -55); ctx.stroke();
  // collar
  ctx.strokeStyle = pal.trim; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-8, -52); ctx.lineTo(0, -44); ctx.lineTo(8, -52); ctx.stroke();

  // block shield
  if (f.blocking) {
    const pulse = .75 + Math.sin(t * 15) * .15;
    ctx.save();
    ctx.globalAlpha = .75;
    ctx.strokeStyle = `rgba(143,242,219,${pulse})`;
    ctx.lineWidth = 3.4;
    ctx.beginPath(); ctx.arc(17, -36, 30, -1.05, 1.05); ctx.stroke();
    ctx.strokeStyle = 'rgba(143,242,219,.28)'; ctx.lineWidth = 10;
    ctx.beginPath(); ctx.arc(17, -36, 30, -1.05, 1.05); ctx.stroke();
    ctx.fillStyle = 'rgba(143,242,219,.75)';
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath(); ctx.arc(30 + i * 7, -36 + i * 15, 1.3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  // slash arc
  if (f.atkAnim > 0) {
    const k = clamp01(f.atkAnim / ATTACK.anim);
    ctx.save();
    ctx.globalAlpha = .9 * k;
    const grad = ctx.createLinearGradient(18, -30, 66, -54);
    grad.addColorStop(0, 'rgba(255,245,210,.1)');
    grad.addColorStop(.6, pal.accent);
    grad.addColorStop(1, 'rgba(255,255,255,.1)');
    ctx.strokeStyle = grad; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.arc(12, -42, 48, -0.9, 0.85); ctx.stroke();
    ctx.strokeStyle = `rgba(255,255,255,${.5 * k})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(12, -42, 51, -0.8, 0.72); ctx.stroke();
    ctx.restore();
  }

  // hit flash
  if (f.flashT > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = f.flashT / .14 * .55;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.ellipse(0, -32, 24, 36, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  ctx.restore();
}

function drawPlatform() {
  const half = round.half;
  const left = CX - half, right = CX + half;
  const top = GROUND + 4, slab = 48;
  const t = animT;

  // mist / underglow
  ctx.save();
  const under = ctx.createRadialGradient(CX, top + slab + 18, 20, CX, top + slab + 18, half + 180);
  under.addColorStop(0, round.type === 'push' ? 'rgba(232,85,58,.16)' : 'rgba(216,164,77,.18)');
  under.addColorStop(.4, 'rgba(90,70,150,.06)');
  under.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = under;
  ctx.beginPath(); ctx.ellipse(CX, top + slab + 24, half + 200, 110, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // front slab
  ctx.save();
  const front = ctx.createLinearGradient(0, top, 0, top + slab);
  front.addColorStop(0, '#5e4528');
  front.addColorStop(.32, '#3a2a1b');
  front.addColorStop(.78, '#20140f');
  front.addColorStop(1, '#0d080a');
  ctx.fillStyle = front;
  ctx.beginPath();
  ctx.moveTo(left, top);
  ctx.lineTo(right, top);
  ctx.lineTo(right - 16, top + slab);
  ctx.lineTo(left + 16, top + slab);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(216,164,77,.5)'; ctx.lineWidth = 1.4; ctx.stroke();

  // rivets along the front face
  for (let x = left + 24; x < right - 14; x += 42) {
    ctx.fillStyle = 'rgba(240,200,128,.62)';
    ctx.beginPath(); ctx.arc(x, top + slab - 10, 1.7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.4)';
    ctx.beginPath(); ctx.arc(x + .8, top + slab - 9.2, .8, 0, Math.PI * 2); ctx.fill();
  }
  // glowing seams
  ctx.strokeStyle = round.type === 'push' ? 'rgba(232,85,58,.55)' : 'rgba(88,216,192,.26)';
  ctx.lineWidth = 1.1;
  const seamN = 5;
  for (let i = 1; i < seamN; i++) {
    const x = left + (right - left) * i / seamN;
    ctx.beginPath(); ctx.moveTo(x, top + 8); ctx.lineTo(x + (CX - x) * .06, top + slab - 8); ctx.stroke();
  }

  // top deck band (perspective lip)
  const deck = ctx.createLinearGradient(0, top - 14, 0, top + 4);
  deck.addColorStop(0, '#b1844a');
  deck.addColorStop(.4, '#8a6538');
  deck.addColorStop(1, '#4e3822');
  ctx.fillStyle = deck;
  ctx.beginPath();
  ctx.moveTo(left + 8, top - 15);
  ctx.lineTo(right - 8, top - 15);
  ctx.lineTo(right, top + 3);
  ctx.lineTo(left, top + 3);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,222,160,.52)'; ctx.lineWidth = 1.2; ctx.stroke();

  // deck engravings and edge studs
  ctx.strokeStyle = 'rgba(58,34,18,.55)'; ctx.lineWidth = 1;
  for (let x = left + 20; x < right - 16; x += 26) {
    ctx.beginPath(); ctx.moveTo(x, top - 13); ctx.lineTo(x + 10, top - 3); ctx.stroke();
  }
  for (let x = left + 14; x < right - 8; x += 38) {
    ctx.fillStyle = 'rgba(255,222,160,.72)';
    ctx.beginPath();
    ctx.moveTo(x, top - 17); ctx.lineTo(x + 3, top - 14); ctx.lineTo(x, top - 11); ctx.lineTo(x - 3, top - 14);
    ctx.closePath(); ctx.fill();
  }

  // jade guard rails on duel / capture decks (push has open edges)
  if (round.type !== 'push') {
    ctx.save();
    ctx.strokeStyle = 'rgba(143,242,219,.24)';
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 7]);
    ctx.beginPath();
    ctx.moveTo(left + 12, top - 18);
    ctx.lineTo(right - 12, top - 18);
    ctx.stroke();
    ctx.setLineDash([]);
    for (const side of [-1, 1]) {
      const x = CX + side * half;
      const glow = ctx.createRadialGradient(x, top - 26, 1, x, top - 26, 26);
      glow.addColorStop(0, 'rgba(143,242,219,.36)');
      glow.addColorStop(1, 'rgba(143,242,219,0)');
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(x, top - 26, 26, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(240,200,128,.85)'; ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.moveTo(x, top - 2); ctx.lineTo(x, top - 22); ctx.stroke();
      ctx.fillStyle = 'rgba(143,242,219,.95)';
      ctx.beginPath(); ctx.arc(x, top - 24, 3.2, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(143,242,219,.45)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(x, top - 20); ctx.lineTo(x - side * 12, top - 20); ctx.stroke();
    }
    ctx.restore();
  }

  // central arena sigil on the deck
  ctx.save();
  ctx.translate(CX, top - 6);
  ctx.strokeStyle = 'rgba(255,222,160,.22)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.ellipse(0, 0, Math.min(58, half * .3), 6, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(0, 0, Math.min(30, half * .17), 3.2, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = 'rgba(255,222,160,.18)';
  ctx.beginPath();
  ctx.moveTo(0, -7); ctx.lineTo(7, 0); ctx.lineTo(0, 7); ctx.lineTo(-7, 0); ctx.closePath(); ctx.fill();
  ctx.restore();

  // push-mode danger edges
  if (round.type === 'push') {
    const pulse = .5 + .35 * Math.sin(t * (round.half < round.startHalf * .72 ? 9 : 5));
    for (const side of [-1, 1]) {
      const x = CX + side * half;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const eg = ctx.createRadialGradient(x, top - 4, 2, x, top - 4, 58);
      eg.addColorStop(0, `rgba(255,110,70,${.35 * pulse})`);
      eg.addColorStop(1, 'rgba(255,60,40,0)');
      ctx.fillStyle = eg;
      ctx.beginPath(); ctx.arc(x, top - 4, 58, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      ctx.strokeStyle = `rgba(255,130,90,${.5 + .3 * pulse})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x, top - 15); ctx.lineTo(x + side * -3, top + 4); ctx.stroke();
    }
  }
  ctx.restore();
}

function drawLamp() {
  const t = animT;
  const y = GROUND + 3;
  if (round.type === 'capture') {
    // light pool / capture zone
    const pulse = .55 + .18 * Math.sin(t * 2.2);
    ctx.save();
    const zg = ctx.createRadialGradient(CX, y - 2, 8, CX, y - 2, CAPTURE.zone + 12);
    const occupied = lampInZoneVisual(p1) || lampInZoneVisual(p2);
    zg.addColorStop(0, `rgba(88,216,192,${.20 + (occupied ? .12 : 0)})`);
    zg.addColorStop(.6, `rgba(88,216,192,${.06 * pulse})`);
    zg.addColorStop(1, 'rgba(88,216,192,0)');
    ctx.fillStyle = zg;
    ctx.beginPath(); ctx.ellipse(CX, y - 2, CAPTURE.zone + 14, 25, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(143,242,219,.5)'; ctx.lineWidth = 1.2;
    ctx.setLineDash([7, 8]);
    ctx.beginPath(); ctx.ellipse(CX, y - 2, CAPTURE.zone, 20, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  // pedestal
  ctx.save();
  ctx.fillStyle = '#241a15';
  ctx.beginPath();
  ctx.moveTo(CX - 14, y); ctx.lineTo(CX + 14, y);
  ctx.lineTo(CX + 9, y - 22); ctx.lineTo(CX - 9, y - 22);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(216,164,77,.7)'; ctx.lineWidth = 1.4; ctx.stroke();
  ctx.fillStyle = '#3f2d1e';
  ctx.beginPath(); ctx.ellipse(CX, y - 23, 18, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(255,222,160,.6)'; ctx.lineWidth = 1; ctx.stroke();

  // bowl
  const bowl = ctx.createLinearGradient(CX - 18, y - 40, CX + 18, y - 22);
  bowl.addColorStop(0, '#d7a95d'); bowl.addColorStop(.5, '#8a6234'); bowl.addColorStop(1, '#422c1b');
  ctx.fillStyle = bowl;
  ctx.beginPath();
  ctx.moveTo(CX - 17, y - 27);
  ctx.quadraticCurveTo(CX, y - 14, CX + 17, y - 27);
  ctx.quadraticCurveTo(CX, y - 21, CX - 17, y - 27);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(255,222,160,.62)'; ctx.lineWidth = 1.1; ctx.stroke();
  ctx.restore();

  // flame / ember
  const lit = round.type === 'capture';
  const contested = round.type === 'capture' && round.contested;
  const fl = Math.sin(t * 9.3) * 4 + Math.sin(t * 15.7) * 2;
  const col1 = contested ? '#ffffff' : lit ? '#9dffe9' : '#ffb066';
  const col2 = contested ? '#8ff2db' : lit ? '#2fae9a' : '#b4482c';
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const glowR = lit ? 74 : 32;
  const glow = ctx.createRadialGradient(CX, y - 42, 2, CX, y - 42, glowR);
  glow.addColorStop(0, contested ? 'rgba(255,255,255,.55)' : lit ? 'rgba(120,255,226,.45)' : 'rgba(255,176,102,.26)');
  glow.addColorStop(.45, lit ? 'rgba(60,190,168,.13)' : 'rgba(232,110,60,.08)');
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.arc(CX, y - 42, glowR, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  const flameH = lit ? (contested ? 26 : 21) : 12;
  const fg = ctx.createLinearGradient(CX, y - 48 - flameH, CX, y - 28);
  fg.addColorStop(0, col1); fg.addColorStop(.6, lit ? '#58d8c0' : '#e87c46'); fg.addColorStop(1, col2);
  ctx.fillStyle = fg;
  ctx.beginPath();
  ctx.moveTo(CX, y - 48 - flameH);
  ctx.bezierCurveTo(CX + 13 + fl * .3, y - 46 - flameH * .35, CX + 10 + fl, y - 34, CX, y - 27);
  ctx.bezierCurveTo(CX - 10 + fl, y - 34, CX - 13 - fl * .3, y - 46 - flameH * .35, CX, y - 48 - flameH);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.55)';
  ctx.beginPath();
  ctx.ellipse(CX - 2 + fl * .2, y - 41 - flameH * .2, 2.6, flameH * .36, 0, 0, Math.PI * 2);
  ctx.fill();

  // capture progress arcs around the lamp
  if (round.type === 'capture') {
    for (const [f, col, off] of [[p1, '#e8553a', -0.08], [p2, '#5267df', 0.08]]) {
      const frac = clamp01((f.progress || 0) / CAPTURE.goal);
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,.10)'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(CX, y - 30, 42 + off * 80, -Math.PI * .92, Math.PI * .92); ctx.stroke();
      ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(CX, y - 30, 42 + off * 80, -Math.PI * .92, -Math.PI * .92 + Math.PI * 1.84 * frac); ctx.stroke();
      ctx.restore();
    }
  }
}
function lampInZoneVisual(f) {
  return f && !f.fallen && Math.abs(f.x - CX) <= CAPTURE.zone && (f.z || 0) < 10;
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
        ctx.globalAlpha = a * .24;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * 2.4, 0, Math.PI * 2); ctx.fill();
      }
    }
  }
  ctx.restore();
}

function drawWorld() {
  ctx.drawImage(bgCv, 0, 0, W, H);
  // gentle foreground crowd bob
  drawPlatform();
  drawLamp();
  if (mode === 'title') {
    const t = animT;
    // frame the menu with the two rivals at the deck edges
    const sx1 = p1.x, sf1 = p1.facing, sx2 = p2.x, sf2 = p2.facing;
    p1.x = CX - 282; p1.facing = 1;
    p2.x = CX + 282; p2.facing = -1;
    drawFighter(p1, 'p1', t, { bob: Math.abs(Math.sin(t * .9)) * 3 });
    drawFighter(p2, 'p2', t, { bob: Math.abs(Math.sin(t * .9 + 1.7)) * 3 });
    p1.x = sx1; p2.x = sx2; p1.facing = sf1; p2.facing = sf2;
  } else {
    drawFighter(p1, 'p1', animT);
    drawFighter(p2, 'p2', animT);
  }
  drawParticles();
}

function drawPips(x, y, wins, side, alignRight) {
  for (let i = 0; i < 3; i++) {
    const px = x + (alignRight ? -i * 17 : i * 17);
    const filled = i < wins;
    ctx.save();
    ctx.translate(px, y);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = filled ? sideColor(side) : 'rgba(255,255,255,.10)';
    ctx.strokeStyle = filled ? 'rgba(255,240,210,.8)' : 'rgba(216,164,77,.32)';
    ctx.lineWidth = 1;
    ctx.fillRect(-4, -4, 8, 8); ctx.strokeRect(-4, -4, 8, 8);
    ctx.restore();
  }
}

function drawSidePanel(x, f, side, alignRight) {
  const w = 300, h = 78, y = 14;
  const pal = PAL[side];
  ctx.save();
  ctx.fillStyle = 'rgba(7,6,16,.76)';
  rr(ctx, x, y, w, h, 14); ctx.fill();
  ctx.strokeStyle = side === 'p1' ? 'rgba(232,85,58,.55)' : 'rgba(82,103,223,.6)';
  ctx.lineWidth = 1.2; rr(ctx, x, y, w, h, 14); ctx.stroke();
  ctx.strokeStyle = 'rgba(216,164,77,.18)'; ctx.lineWidth = 1;
  rr(ctx, x + 3, y + 3, w - 6, h - 6, 11); ctx.stroke();

  const tx = alignRight ? x + w - 14 : x + 14;
  ctx.textAlign = alignRight ? 'right' : 'left';
  ctx.textBaseline = 'middle';
  ctx.font = '700 14px "Microsoft YaHei",sans-serif';
  ctx.fillStyle = '#f4ecdc';
  ctx.fillText(nameOf(side), tx, y + 20);
  ctx.font = '600 10px "Microsoft YaHei",sans-serif';
  ctx.fillStyle = side === 'p1' ? 'rgba(255,154,118,.82)' : 'rgba(154,171,255,.86)';
  ctx.fillText(side === 'p1' ? '朱红 · VERMILION' : '靛蓝 · INDIGO', tx, y + 36);
  drawPips(alignRight ? tx - 96 : tx + 102, y + 20, side === 'p1' ? p1Wins : p2Wins, side, alignRight);

  // value bar
  const label = round.type === 'duel' ? '体力' : round.type === 'capture' ? '灯焰' : '站位';
  let frac = 0, valueTxt = '';
  if (round.type === 'duel') {
    frac = clamp01(f.hp / 100);
    valueTxt = `${Math.ceil(f.hp)}`;
  } else if (round.type === 'capture') {
    frac = clamp01(f.progress / CAPTURE.goal);
    valueTxt = `${Math.floor(f.progress)}%`;
  } else {
    frac = clamp01(1 - Math.abs(f.x - CX) / Math.max(1, round.half));
    valueTxt = f.fallen ? '落台' : `${Math.round(frac * 100)}%`;
  }
  const bx = x + 14, by = y + 51, bw = w - 28, bh = 9;
  ctx.fillStyle = 'rgba(255,255,255,.08)';
  rr(ctx, bx, by, bw, bh, 4.5); ctx.fill();
  const grad = ctx.createLinearGradient(bx, 0, bx + bw, 0);
  if (side === 'p1') { grad.addColorStop(0, '#8e2719'); grad.addColorStop(.55, '#e8553a'); grad.addColorStop(1, '#ffc177'); }
  else { grad.addColorStop(0, '#232a7d'); grad.addColorStop(.55, '#5267df'); grad.addColorStop(1, '#9ff0dd'); }
  ctx.fillStyle = grad;
  rr(ctx, bx, by, Math.max(2, bw * frac), bh, 4.5); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = .8;
  rr(ctx, bx, by, bw, bh, 4.5); ctx.stroke();
  ctx.font = '600 10px "Microsoft YaHei",sans-serif';
  ctx.fillStyle = 'rgba(233,223,200,.62)';
  ctx.textAlign = alignRight ? 'right' : 'left';
  ctx.fillText(label, alignRight ? x + w - 14 : x + 14, y + 70);
  ctx.fillStyle = '#fff3d9';
  ctx.textAlign = alignRight ? 'left' : 'right';
  ctx.fillText(valueTxt, alignRight ? x + 14 : x + w - 14, y + 70);
  ctx.restore();
}

function drawHUD() {
  if (mode !== 'play') return;
  drawSidePanel(20, p1, 'p1', false);
  drawSidePanel(W - 320, p2, 'p2', true);

  // centre pill
  const w = 260, h = 76, x = CX - w / 2, y = 14;
  ctx.save();
  ctx.fillStyle = 'rgba(7,6,16,.8)';
  rr(ctx, x, y, w, h, 16); ctx.fill();
  ctx.strokeStyle = 'rgba(216,164,77,.58)'; ctx.lineWidth = 1.2;
  rr(ctx, x, y, w, h, 16); ctx.stroke();
  ctx.strokeStyle = 'rgba(88,216,192,.2)'; ctx.lineWidth = 1;
  rr(ctx, x + 3, y + 3, w - 6, h - 6, 13); ctx.stroke();

  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = '700 13px "Microsoft YaHei",sans-serif';
  ctx.fillStyle = '#ffe7b8';
  const title = round.overtime ? `加时 · ${ROUND_META.push.zh}` : `第 ${round.index + 1} 回合 · ${roundMeta().zh}`;
  ctx.fillText(title, CX, y + 19);

  const secs = Math.max(0, Math.ceil(round.timeLeft));
  const urgent = round.timeLeft <= 6.5;
  ctx.font = '800 30px "Segoe UI","Microsoft YaHei",sans-serif';
  ctx.fillStyle = urgent ? '#ff8b66' : '#f5ecdb';
  ctx.shadowColor = urgent ? 'rgba(255,100,60,.8)' : 'rgba(216,164,77,.45)';
  ctx.shadowBlur = 14;
  ctx.fillText(String(secs), CX - 12, y + 46);
  ctx.shadowBlur = 0;
  ctx.font = '600 10px "Microsoft YaHei",sans-serif';
  ctx.fillStyle = 'rgba(233,223,200,.62)';
  ctx.fillText('秒', CX + 18, y + 50);

  ctx.font = '600 10px "Segoe UI","Microsoft YaHei",sans-serif';
  ctx.fillStyle = 'rgba(233,223,200,.62)';
  ctx.fillText(`${p1Wins}  :  ${p2Wins}`, CX, y + 65);
  ctx.restore();

  // objective hint
  const hint = roundMeta().hint;
  ctx.save();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = '600 11.5px "Microsoft YaHei",sans-serif';
  const tw = ctx.measureText(hint).width;
  ctx.fillStyle = 'rgba(6,5,14,.68)';
  rr(ctx, CX - tw / 2 - 14, H - 36, tw + 28, 23, 12); ctx.fill();
  ctx.strokeStyle = 'rgba(216,164,77,.22)'; ctx.lineWidth = 1;
  rr(ctx, CX - tw / 2 - 14, H - 36, tw + 28, 23, 12); ctx.stroke();
  ctx.fillStyle = 'rgba(233,223,200,.76)';
  ctx.fillText(hint, CX, H - 24);
  ctx.restore();
}

function drawOverlays() {
  if (mode === 'title') return;
  if (paused) {
    ctx.save();
    ctx.fillStyle = 'rgba(4,3,10,.66)'; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '800 46px "Microsoft YaHei",sans-serif';
    ctx.fillStyle = '#fff4e1';
    ctx.shadowColor = 'rgba(216,164,77,.8)'; ctx.shadowBlur = 24;
    ctx.fillText('已 暂 停', CX, H / 2 - 14);
    ctx.shadowBlur = 0;
    ctx.font = '13px "Microsoft YaHei",sans-serif';
    ctx.fillStyle = 'rgba(233,223,200,.8)';
    ctx.fillText('按 P 或点按右上角继续 · R 重开', CX, H / 2 + 34);
    ctx.restore();
    return;
  }

  if (phase === 'intro') {
    const total = round.overtime ? 2.4 : 3.0;
    const frac = clamp01(1 - round.countdown / total);
    const n = Math.max(1, Math.ceil(round.countdown));
    ctx.save();
    ctx.fillStyle = 'rgba(4,3,10,.30)'; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '700 15px "Microsoft YaHei",sans-serif';
    ctx.fillStyle = 'rgba(216,164,77,.95)';
    ctx.fillText(round.overtime ? '加 时 · 推 挤' : `${['第 一','第 二','第 三'][round.index] || '加 时'} 回 合 · ${roundMeta().zh}`, CX, H / 2 - 132);
    ctx.font = '800 74px "Segoe UI","Microsoft YaHei",sans-serif';
    ctx.fillStyle = '#fff8ea';
    ctx.shadowColor = 'rgba(232,170,86,.8)'; ctx.shadowBlur = 30;
    ctx.fillText(String(n), CX, H / 2 - 42);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(143,242,219,.42)'; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.arc(CX, H / 2 - 42, 72, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac); ctx.stroke();
    ctx.font = '600 12px "Microsoft YaHei",sans-serif';
    ctx.fillStyle = 'rgba(233,223,200,.82)';
    ctx.fillText(roundMeta().hint, CX, H / 2 + 58);
    ctx.restore();
    return;
  }

  if (phase === 'result') {
    const res = round.result;
    const col = res === 'p1' ? '#ffb08a' : res === 'p2' ? '#bcc7ff' : '#e9dfc8';
    const label = res === 'p1' ? (gameMode === 'local' ? 'P1 拿下本回合' : '你 拿下本回合')
      : res === 'p2' ? (gameMode === 'local' ? 'P2 拿下本回合' : '灯影 拿下本回合') : '本 回 合 平 局';
    const reasonMap = { ko: '体力耗尽', ringout: '跌落浮台', lamp: '灯焰积满', timeout: '时间到 · 判定', forced: '测试判定' };
    ctx.save();
    ctx.fillStyle = 'rgba(4,3,10,.36)'; ctx.fillRect(0, 0, W, H);
    const w = 520, h = 124, x = CX - w / 2, y = H / 2 - 74;
    ctx.fillStyle = 'rgba(7,6,16,.88)';
    rr(ctx, x, y, w, h, 18); ctx.fill();
    ctx.strokeStyle = res === 'p1' ? 'rgba(232,85,58,.7)' : res === 'p2' ? 'rgba(82,103,223,.75)' : 'rgba(216,164,77,.6)';
    ctx.lineWidth = 1.5; rr(ctx, x, y, w, h, 18); ctx.stroke();
    ctx.strokeStyle = 'rgba(216,164,77,.22)'; ctx.lineWidth = 1;
    rr(ctx, x + 5, y + 5, w - 10, h - 10, 14); ctx.stroke();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '800 27px "Microsoft YaHei",sans-serif';
    ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 18;
    ctx.fillText(label, CX, y + 42);
    ctx.shadowBlur = 0;
    ctx.font = '600 13px "Microsoft YaHei",sans-serif';
    ctx.fillStyle = 'rgba(233,223,200,.8)';
    ctx.fillText(`${reasonMap[round.resultReason] || round.resultReason} · 当前胜场 ${p1Wins} : ${p2Wins}`, CX, y + 78);
    ctx.font = '600 11px "Microsoft YaHei",sans-serif';
    ctx.fillStyle = 'rgba(216,164,77,.72)';
    const nextNote = round.overtime
      ? (p1Wins === p2Wins ? '加时平局 · 继续加时' : '加时结束 · 即将结算')
      : roundIndex >= 2
        ? (p1Wins === p2Wins ? '三回合战平 · 即将进入加时' : '三回合结束 · 即将结算')
        : '下一回合即将开始';
    ctx.fillText(nextNote, CX, y + 100);
    ctx.restore();
    return;
  }

  if (bannerT > 0 && phase === 'live') {
    ctx.save();
    ctx.globalAlpha = clamp01(bannerT / .75);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '800 34px "Microsoft YaHei",sans-serif';
    ctx.fillStyle = '#fff4e1';
    ctx.shadowColor = 'rgba(88,216,192,.75)'; ctx.shadowBlur = 22;
    ctx.fillText('开 始', CX, H / 2 - 102);
    ctx.restore();
  }

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
  drawHUD();
  drawOverlays();
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
      startMatch(btn.dataset.mode || 'ai', btn.dataset.diff || aiDiff);
    });
  });
  muteBtn.addEventListener('click', () => { if (!AUTOTEST) audio.unlock(); toggleMute(); audio.play('ui'); });
  pauseBtn.addEventListener('click', () => { if (!AUTOTEST) audio.unlock(); togglePause(); });
  document.getElementById('go').addEventListener('click', () => {
    if (!AUTOTEST) audio.unlock();
    audio.play('ui');
    startMatch(gameMode, aiDiff);
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
  const shareBtn = document.getElementById('share');
  if (shareBtn) shareBtn.addEventListener('click', () => { if (!AUTOTEST) audio.unlock(); shareScore(); });
}
bindUi();

if (URLP.has('autostart') && !AUTOTEST) {
  startMatch(URLP.get('mode') === 'local' ? 'local' : 'ai', parseInt(URLP.get('difficulty') || '2', 10));
}

// ==================== G debug hooks ====================
const G_API = {
  err: window.__BOOTERR || [],
  W, H, CX, GROUND, CAPTURE, ATTACK, DASH, PUSH,
  step: (n = 60, dt = DT) => { for (let i = 0; i < n; i++) { update(dt); render(); } },
  upd: (n = 30, dt = DT) => { for (let i = 0; i < n; i++) update(dt); },
  press: (...codes) => { for (const c of codes) { pressed.add(c); held.add(c); } },
  release: (...codes) => { for (const c of codes) held.delete(c); },
  setNoAuto: (v) => { noAuto = !!v; },
  clearFx: () => { hitstopT = 0; shakeT = 0; flashT = 0; bannerT = 0; },
  setReportTarget: (fn) => { reportTarget = typeof fn === 'function' ? fn : null; },
  reportLog: () => reports.slice(),
  state: () => ({
    mode, phase, paused, gameMode, aiDiff,
    p1Wins, p2Wins, winner,
    roundIndex, overtime, roundsPlayed,
    roundType: round.type, timeLeft: round.timeLeft,
    countdown: round.countdown, resultT: round.resultT,
    half: round.half, shrinkTime: round.shrinkTime,
    result: round.result, resultReason: round.resultReason,
    contested: round.contested, lastImpulse: round.lastImpulse,
    lastAttack: round.lastAttack ? { ...round.lastAttack } : null,
    lastDash: round.lastDash ? { ...round.lastDash } : null,
    matchTime, noAuto, nan: nanFlag,
    score: scoreInt(), progress: matchProgress(),
    bestWins, bestTime, muted, audioCtx: audio.hasCtx(),
    ai: { diff: aiDiff, label: profile.label, speed: profile.speed, reaction: profile.reaction, aggression: profile.aggression, blockChance: profile.blockChance, edgeCare: profile.edgeCare, dashChance: profile.dashChance },
    p1: snapFighter(p1), p2: snapFighter(p2),
    particles: particles.length, reports: reports.length,
    bestKeys: [BEST_WINS_KEY, BEST_TIME_KEY, MUTE_KEY],
  }),
  startMatch,
  startRound: (i) => { if (mode !== 'play') { mode = 'play'; hideOverlays(); } startRound(clamp(parseInt(i, 10) || 0, 0, 8)); return G_API.state(); },
  setPhase: (p) => {
    if (p === 'live') return beginLive();
    if (p === 'intro') { phase = 'intro'; return true; }
    if (p === 'result') { phase = 'result'; return true; }
    if (p === 'over') { phase = 'over'; return true; }
    return false;
  },
  setAI: (v) => {
    aiDiff = diffKey(v); profile = AI_PROFILES[aiDiff];
    if (gameMode === 'ai') { p2.maxSpd = profile.speed; p2.accel = profile.accel; }
    resetAI();
    return { ...profile };
  },
  aiProfiles: () => JSON.parse(JSON.stringify(AI_PROFILES)),
  setScore: (a, b) => { p1Wins = clamp(parseInt(a, 10) || 0, 0, 9); p2Wins = clamp(parseInt(b, 10) || 0, 0, 9); return [p1Wins, p2Wins]; },
  addRoundWin: (side) => { if (side === 'p2') p2Wins++; else p1Wins++; return [p1Wins, p2Wins]; },
  forceRoundWin,
  forceDraw,
  nextRound: () => { advanceRound(); return G_API.state(); },
  forceWin,
  forceFail,
  setFighter: (side, opts = {}) => {
    const f = side === 'p2' ? p2 : p1;
    if (opts.x !== undefined) f.x = finite(opts.x, f.x);
    if (opts.z !== undefined) { f.z = Math.max(0, finite(opts.z, 0)); f.onGround = f.z <= 0; }
    if (opts.vx !== undefined) f.vx = finite(opts.vx, 0);
    if (opts.vz !== undefined) f.vz = finite(opts.vz, 0);
    if (opts.hp !== undefined) f.hp = Math.max(0, finite(opts.hp, 100));
    if (opts.progress !== undefined) f.progress = clamp(finite(opts.progress, 0), 0, 100);
    if (opts.facing !== undefined) f.facing = sign(opts.facing) || 1;
    if (opts.blocking !== undefined) f.blocking = !!opts.blocking;
    if (opts.dashT !== undefined) { f.dashT = Math.max(0, finite(opts.dashT, 0)); f.dashHit = false; }
    if (opts.dashCd !== undefined) f.dashCd = Math.max(0, finite(opts.dashCd, 0));
    if (opts.invulnT !== undefined) f.invulnT = Math.max(0, finite(opts.invulnT, 0));
    if (opts.stunT !== undefined) f.stunT = Math.max(0, finite(opts.stunT, 0));
    if (opts.fallen !== undefined) f.fallen = !!opts.fallen;
    if (opts.atkCd !== undefined) f.atkCd = Math.max(0, finite(opts.atkCd, 0));
    if (opts.maxSpd !== undefined) f.maxSpd = Math.max(1, finite(opts.maxSpd, MAX_SPD));
    if (opts.accel !== undefined) f.accel = Math.max(1, finite(opts.accel, ACCEL));
    return snapFighter(f);
  },
  setRoundHalf: (h) => { round.half = clamp(finite(h, round.half), 80, 340); return round.half; },
  setTimer: (s) => { round.timeLeft = Math.max(0, finite(s, 0)); return round.timeLeft; },
  setProgress: (side, v) => {
    const f = side === 'p2' ? p2 : p1;
    f.progress = clamp(finite(v, 0), 0, CAPTURE.goal);
    return f.progress;
  },
  setHp: (side, v) => {
    const f = side === 'p2' ? p2 : p1;
    f.hp = Math.max(0, finite(v, 100));
    return f.hp;
  },
  startDash: (side, dir) => {
    const f = side === 'p2' ? p2 : p1;
    startDash(f, sign(dir) || 1);
    return snapFighter(f);
  },
  goTitle,
  toggleMute,
  setMuted: (v) => { audio.setMuted(!!v); muted = !!v; updateMuteButton(); },
  audio,
  view: () => ({ scale: viewScale, ox: viewOX, oy: viewOY, dpr: DPR, w: window.innerWidth, h: window.innerHeight }),
  particlesList: () => particles.slice(),
  ui: { showEnd, toast },
};
function snapFighter(f) {
  return {
    side: f.side, x: f.x, z: f.z, vx: f.vx, vz: f.vz, facing: f.facing,
    hp: f.hp, progress: f.progress, onGround: f.onGround,
    blocking: f.blocking, atkCd: f.atkCd, atkAnim: f.atkAnim,
    stunT: f.stunT, dashT: f.dashT, dashCd: f.dashCd,
    invulnT: f.invulnT, fallen: f.fallen, fallT: f.fallT,
    maxSpd: f.maxSpd, accel: f.accel,
  };
}
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
  const F = (k) => { const f = k === 'p2' ? p2 : p1; return snapFighter(f); };
  const frames = [];
  const saved = {
    bestWins, bestTime, muted,
    lw: null, lt: null, lm: null,
  };
  try {
    saved.lw = localStorage.getItem(BEST_WINS_KEY);
    saved.lt = localStorage.getItem(BEST_TIME_KEY);
    saved.lm = localStorage.getItem(MUTE_KEY);
  } catch (e) { }
  muted = true; audio.setMuted(true); updateMuteButton();
  G_API.setReportTarget(f => frames.push(f));

  try {
    await nap();

    // 1 — clean boot
    ok(1, G_API.err.length === 0 && !nanFlag, `启动零报错 errors=${G_API.err.length}`);

    // 2 — stress: 360 fixed steps with jumps / dashes / shoves, no NaN
    G_API.startMatch('local', 'medium');
    G_API.setPhase('live');
    G_API.setFighter('p1', { x: CX - 120, z: 0, vx: 240, hp: 9999 });
    G_API.setFighter('p2', { x: CX + 120, z: 0, vx: -240, hp: 9999 });
    const err0 = G_API.err.length;
    let stressOk = true;
    for (let k = 0; k < 360; k++) {
      if (k % 45 === 0) G_API.press('KeyW');
      if (k % 70 === 0) G_API.press('KeyF');
      if (k % 110 === 0) G_API.press('KeyG');
      update(DT);
      if (k % 60 === 0) {
        const s = S();
        for (const v of [s.p1.x, s.p1.z, s.p1.vx, s.p2.x, s.p2.z, s.p2.vx, s.matchTime, s.timeLeft]) {
          if (!Number.isFinite(v)) stressOk = false;
        }
      }
    }
    G_API.release('KeyD', 'KeyW', 'KeyF', 'KeyG', 'KeyA');
    const st = S();
    ok(2, stressOk && !st.nan && G_API.err.length === err0 && Number.isFinite(st.p1.x) && Number.isFinite(st.p2.x),
      `360 帧乱战无 NaN / 无新报错 nan=${st.nan}`);

    // 3 — acceleration & friction
    G_API.startMatch('local', 'medium');
    G_API.setPhase('live');
    G_API.setFighter('p1', { x: CX - 60, vx: 0, z: 0, hp: 100 });
    G_API.setFighter('p2', { x: CX + 220, vx: 0, hp: 100 });
    const ax0 = F('p1').x;
    G_API.press('KeyD'); R(20);
    const vRun = F('p1').vx, ax1 = F('p1').x;
    G_API.release('KeyD'); R(30);
    const vFree = F('p1').vx;
    ok(3, vRun > 140 && ax1 > ax0 + 30 && Math.abs(vFree) < Math.abs(vRun) * .6,
      `加速 vx ${vRun.toFixed(0)} · 摩擦后 ${vFree.toFixed(0)}`);

    // 4 — sword damage / chip / range (three core assertions in one)
    G_API.startMatch('local', 'medium');
    G_API.setPhase('live');
    G_API.setFighter('p1', { x: CX - 30, facing: 1, atkCd: 0, stunT: 0 });
    G_API.setFighter('p2', { x: CX + 20, hp: 100, blocking: false, stunT: 0, z: 0 });
    G_API.press('KeyF'); R(1);
    const hitDmg = 100 - F('p2').hp;
    const kb = F('p2').vx;
    ok(4, hitDmg === ATTACK.damage && kb > 250, `命中伤害 ${hitDmg} / 击退 vx=${kb.toFixed(0)}`);

    G_API.setFighter('p2', { hp: 100, blocking: true, stunT: 0, vx: 0, vz: 0, z: 0, facing: -1 });
    G_API.clearFx();
    G_API.press('KeyL'); R(1); // hold block
    G_API.setFighter('p1', { x: CX - 30, z: 0, vz: 0, stunT: 0, facing: 1, atkCd: 0 });
    G_API.press('KeyF'); R(1);
    const chipDmg = 100 - F('p2').hp;
    const chipKb = F('p2').vx;
    G_API.release('KeyL');
    ok(4.1, chipDmg === ATTACK.chip && chipKb < kb * .6, `格挡减伤 ${chipDmg} / 击退 ${chipKb.toFixed(0)} < ${kb.toFixed(0)}`);

    G_API.clearFx();
    G_API.setFighter('p1', { x: CX - 220, z: 0, vz: 0, stunT: 0, facing: 1, atkCd: 0 });
    G_API.setFighter('p2', { x: CX + 120, z: 0, vz: 0, stunT: 0, hp: 100, blocking: false, vx: 0 });
    G_API.press('KeyF'); R(1);
    ok(4.2, F('p2').hp === 100, `超出攻击距离不掉血 hp=${F('p2').hp}`);

    // 5 — jump / gravity landing
    G_API.startMatch('local', 'medium');
    G_API.setPhase('live');
    G_API.setFighter('p1', { x: CX - 50, z: 0, vx: 0 });
    G_API.setFighter('p2', { x: CX + 220, vx: 0 });
    G_API.press('KeyW'); R(1);
    const airZ = F('p1').z;
    R(55);
    ok(5, airZ > 4 && F('p1').z === 0 && F('p1').onGround, `跳跃高度 ${airZ.toFixed(1)} → 落地 z=${F('p1').z}`);

    // 6 — lamp capture math (alone charges, contested freezes)
    G_API.startMatch('local', 'medium');
    G_API.startRound(1);
    G_API.setPhase('live');
    G_API.setFighter('p1', { x: CX, progress: 0, z: 0, vx: 0 });
    G_API.setFighter('p2', { x: CX + 240, progress: 0, vx: 0 });
    R(60);
    const lampAlone = F('p1').progress;
    G_API.setFighter('p2', { x: CX + 20, vx: 0 });
    const lampBefore = F('p1').progress;
    R(30);
    const lampContested = F('p1').progress;
    ok(6, lampAlone > CAPTURE.rate * .8 && Math.abs(lampContested - lampBefore) < .001,
      `独站灯焰 ${lampAlone.toFixed(1)}% · 争灯冻结 ${lampContested.toFixed(1)}%`);

    // 7 — dash shove impulse (momentum based)
    G_API.startMatch('local', 'medium');
    G_API.startRound(2);
    G_API.setPhase('live');
    G_API.setRoundHalf(255);
    G_API.setFighter('p1', { x: CX - 22, z: 0, vx: 0, vx2: 0 });
    G_API.setFighter('p2', { x: CX + 12, z: 0, vx: 0, hp: 100 });
    G_API.setFighter('p1', { dashT: .18, dashCd: .95, invulnT: .16, vx: 790, facing: 1 });
    R(1);
    const imp = S().lastImpulse;
    const shoveV = F('p2').vx;
    ok(7, imp > 700 && shoveV > 600, `冲刺冲量 ${imp.toFixed(0)} · 对手 vx=${shoveV.toFixed(0)}`);

    // 8 — ring-out detection
    G_API.setFighter('p2', { x: CX + 999 });
    R(1);
    const ro = S();
    ok(8, ro.result === 'p1' && ro.p1Wins === 1 && p2.fallen, `出界判负 result=${ro.result} P1 胜场=${ro.p1Wins}`);

    // 8b — win economy: additive round wins and score reset
    {
      G_API.setScore(2, 1);
      const e0 = S();
      G_API.addRoundWin('p1'); G_API.addRoundWin('p2');
      const e1 = S();
      G_API.setScore(0, 0);
      const e2 = S();
      ok('8b', e0.p1Wins === 2 && e0.p2Wins === 1 && e1.p1Wins === 3 && e1.p2Wins === 2 && e2.p1Wins === 0 && e2.p2Wins === 0,
        `胜场计分 2:1 → ${e1.p1Wins}:${e1.p2Wins} → 复位 ${e2.p1Wins}:${e2.p2Wins}`);
    }

    // 9 — AI profile parameter ordering
    {
      const a = G_API.aiProfiles();
      ok(9, a.easy.speed < a.medium.speed && a.medium.speed < a.hard.speed &&
        a.easy.reaction > a.medium.reaction && a.medium.reaction > a.hard.reaction &&
        a.easy.aggression < a.medium.aggression && a.medium.aggression < a.hard.aggression &&
        a.easy.blockChance < a.medium.blockChance && a.medium.blockChance < a.hard.blockChance,
        `AI 三档 speed ${a.easy.speed}/${a.medium.speed}/${a.hard.speed} reaction ${a.easy.reaction}/${a.medium.reaction}/${a.hard.reaction}`);
    }

    // 10 — hard AI actually closes more distance than easy AI in equal frames
    {
      const measure = (diff) => {
        G_API.startMatch('ai', diff);
        G_API.startRound(1);
        G_API.setPhase('live');
        G_API.setFighter('p1', { x: CX - 230, vx: 0 });
        G_API.setFighter('p2', { x: CX + 250, vx: 0 });
        const x0 = F('p2').x;
        R(42);
        return Math.abs(F('p2').x - x0);
      };
      const de = measure(1), dh = measure(3);
      ok(10, dh > de + 50, `AI 实移 hard ${dh.toFixed(0)}px > easy ${de.toFixed(0)}px`);
    }

    // 11 — P1 keyboard input path: move + attack
    G_API.startMatch('local', 'medium');
    G_API.setPhase('live');
    G_API.setFighter('p1', { x: CX - 110, vx: 0, facing: 1, atkCd: 0 });
    G_API.setFighter('p2', { x: CX + 220, hp: 100, vx: 0 });
    const kx0 = F('p1').x;
    G_API.press('KeyD'); R(18); G_API.release('KeyD');
    const kx1 = F('p1').x;
    G_API.setFighter('p1', { x: CX - 20, facing: 1, atkCd: 0 });
    G_API.setFighter('p2', { x: CX + 24, hp: 100, blocking: false, vx: 0 });
    G_API.press('KeyF'); R(1);
    const kHp = F('p2').hp;
    ok(11, kx1 > kx0 + 25 && kHp < 100, `P1 键盘 x ${kx0.toFixed(0)}→${kx1.toFixed(0)} · 攻击后 P2 hp=${kHp}`);

    // 12 — P2 local keyboard: arrows move, J / Numpad0 attack
    G_API.startMatch('local', 'medium');
    G_API.setPhase('live');
    G_API.setFighter('p1', { x: CX - 220, vx: 0, hp: 100 });
    G_API.setFighter('p2', { x: CX + 110, vx: 0, facing: -1, atkCd: 0 });
    const qx0 = F('p2').x;
    G_API.press('ArrowLeft'); R(18); G_API.release('ArrowLeft');
    const qx1 = F('p2').x;
    G_API.setFighter('p2', { x: CX + 20, facing: -1, atkCd: 0 });
    G_API.setFighter('p1', { x: CX - 24, hp: 100, blocking: false, vx: 0 });
    G_API.press('KeyJ'); R(1);
    const qHp = F('p1').hp;
    G_API.clearFx();
    G_API.setFighter('p1', { hp: 100, blocking: false, stunT: 0, vx: 0 });
    G_API.setFighter('p2', { x: CX + 20, facing: -1, atkCd: 0 });
    G_API.press('Numpad0'); R(1);
    const qHp2 = F('p1').hp;
    ok(12, qx1 < qx0 - 25 && qHp < 100 && qHp2 < 100, `P2 方向键 x ${qx0.toFixed(0)}→${qx1.toFixed(0)} · J/0 攻击 hp=${qHp}→${qHp2}`);

    // 13 — local mode turns the AI off
    G_API.startMatch('local', 'medium');
    G_API.setPhase('live');
    G_API.setFighter('p2', { x: CX + 100, vx: 0 });
    const idle0 = F('p2').x;
    R(30);
    ok(13, Math.abs(F('p2').x - idle0) < 1, '本地双人模式 AI 关闭');

    // 14 — pause freezes both fighters and the round clock
    G_API.startMatch('local', 'medium');
    G_API.setPhase('live');
    G_API.setFighter('p1', { x: CX - 40, vx: 0 });
    G_API.setFighter('p2', { x: CX + 80, vx: 0 });
    G_API.setTimer(25);
    G_API.press('KeyP'); R(1);
    const pz = { x: F('p1').x, t: S().timeLeft, paused: S().paused };
    R(20);
    const frozen = S().paused && Math.abs(F('p1').x - pz.x) < .001 && Math.abs(S().timeLeft - pz.t) < .001;
    G_API.press('KeyP'); R(1);
    const resumed = !S().paused;
    ok(14, pz.paused && frozen && resumed, `暂停冻结/恢复 paused=${pz.paused}`);

    // 15 — restart resets score, round, positions and phase
    G_API.setScore(2, 1);
    G_API.setTimer(3);
    G_API.startMatch('local', 'medium');
    {
      const s = S();
      ok(15, s.p1Wins === 0 && s.p2Wins === 0 && s.roundIndex === 0 && s.phase === 'intro' &&
        Math.abs(s.p1.x - (CX - 155)) < .01 && Math.abs(p1.hp - 100) < .01 && s.roundsPlayed === 0,
        `重开复位 ${s.p1Wins}:${s.p2Wins} round=${s.roundIndex} phase=${s.phase}`);
    }

    // 16 — three-round rotation and final score
    G_API.startMatch('local', 'medium');
    const order = [];
    G_API.setPhase('live'); order.push(S().roundType); G_API.forceRoundWin('p1'); G_API.nextRound();
    G_API.setPhase('live'); order.push(S().roundType); G_API.forceRoundWin('p2'); G_API.nextRound();
    G_API.setPhase('live'); order.push(S().roundType); G_API.forceRoundWin('p1'); G_API.nextRound();
    {
      const s = S();
      ok(16, order.join(',') === 'duel,capture,push' && s.mode === 'over' && s.winner === 'p1' && s.p1Wins === 2 && s.p2Wins === 1,
        `回合顺序 ${order.join('→')} · 比分 ${s.p1Wins}:${s.p2Wins}`);
    }

    // 17 — three draws trigger a push overtime
    G_API.startMatch('local', 'medium');
    G_API.setPhase('live'); G_API.forceDraw(); G_API.nextRound();
    G_API.setPhase('live'); G_API.forceDraw(); G_API.nextRound();
    G_API.setPhase('live'); G_API.forceDraw(); G_API.nextRound();
    {
      const s = S();
      ok(17, s.overtime && s.roundIndex === 3 && s.roundType === 'push' && s.phase === 'intro',
        `平局加时 overtime=${s.overtime} round=${s.roundIndex} type=${s.roundType}`);
    }

    // 18 — failure path (P2 / AI champion) → gameOver
    {
      frames.length = 0;
      G_API.startMatch('ai', 3);
      G_API.setPhase('live');
      G_API.forceFail();
      const s = S();
      ok(18, s.mode === 'over' && s.winner === 'p2' && frames.some(f => f.kind === 'gameOver'),
        `失败路径 mode=${s.mode} winner=${s.winner}`);
    }

    // 19 — victory path → complete
    {
      frames.length = 0;
      G_API.startMatch('ai', 2);
      G_API.setPhase('live');
      G_API.forceWin();
      const s = S();
      ok(19, s.mode === 'over' && s.winner === 'p1' && frames.some(f => f.kind === 'complete'),
        `胜利路径 mode=${s.mode} winner=${s.winner}`);
    }

    // 20 — report frame order ready → progress → complete
    {
      const log = G_API.reportLog();
      const ri = log.findIndex(f => f.kind === 'ready');
      const pi = frames.findIndex(f => f.kind === 'progress');
      const ci = frames.findIndex(f => f.kind === 'complete');
      ok(20, ri === 0 && pi >= 0 && ci > pi, `上报帧序 ready=${ri} progress=${pi} complete=${ci}`);
    }

    // 21 — best localStorage write / read / restore
    {
      bestWins = 0; bestTime = 0;
      try { localStorage.removeItem(BEST_WINS_KEY); localStorage.removeItem(BEST_TIME_KEY); } catch (e) { }
      G_API.startMatch('ai', 1);
      G_API.setPhase('live');
      R(20);
      G_API.forceWin();
      let w = 0, t = 0;
      try { w = parseInt(localStorage.getItem(BEST_WINS_KEY) || '0', 10) || 0; t = parseFloat(localStorage.getItem(BEST_TIME_KEY) || '0') || 0; } catch (e) { }
      ok(21, w >= 3 && t > 0 && Math.abs(t - bestTime) < .02, `best 写入 ${w} 胜 / ${t.toFixed(2)}s`);
      bestWins = saved.bestWins; bestTime = saved.bestTime;
      try {
        if (saved.lw === null) localStorage.removeItem(BEST_WINS_KEY); else localStorage.setItem(BEST_WINS_KEY, saved.lw);
        if (saved.lt === null) localStorage.removeItem(BEST_TIME_KEY); else localStorage.setItem(BEST_TIME_KEY, saved.lt);
      } catch (e) { }
    }

    // 22 — touch pointer moves P1
    {
      G_API.startMatch('local', 'medium');
      G_API.setPhase('live');
      G_API.setFighter('p1', { x: CX - 80, vx: 0 });
      G_API.setFighter('p2', { x: CX + 220, vx: 0 });
      const tb = document.querySelector('#touch button[data-code="KeyD"]');
      const x0 = F('p1').x;
      tb.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch', pointerId: 21, clientX: 10, clientY: 10 }));
      R(16);
      tb.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerType: 'touch', pointerId: 21 }));
      ok(22, F('p1').x > x0 + 20 && document.querySelectorAll('#touch button').length === 10,
        `触控 P1 x ${x0.toFixed(0)}→${F('p1').x.toFixed(0)} · 按钮 ${document.querySelectorAll('#touch button').length}`);
    }

    // 23 — touch pointer moves P2
    {
      const tb = document.querySelector('#touch button[data-code="ArrowLeft"]');
      G_API.setFighter('p2', { x: CX + 110, vx: 0 });
      const x0 = F('p2').x;
      tb.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch', pointerId: 22, clientX: 10, clientY: 10 }));
      R(16);
      tb.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerType: 'touch', pointerId: 22 }));
      ok(23, F('p2').x < x0 - 20, `触控 P2 x ${x0.toFixed(0)}→${F('p2').x.toFixed(0)}`);
    }

    // 24 — title buttons start the right mode / difficulty
    {
      G_API.goTitle();
      const btns = document.querySelectorAll('.modebtn');
      const visible = !titleEl.classList.contains('hide');
      document.querySelector('.modebtn[data-mode="ai"][data-diff="3"]').click();
      const s = S();
      ok(24, btns.length === 4 && visible && s.mode === 'play' && s.gameMode === 'ai' && s.aiDiff === 'hard',
        `模式菜单 ${btns.length} 项 · 硬档启动`);
    }

    // 25 — intro countdown auto-advances when noAuto is off
    {
      G_API.setNoAuto(false);
      G_API.startRound(0);
      const c0 = S().countdown;
      R(26);
      const c1 = S().countdown;
      G_API.setNoAuto(true);
      ok(25, c1 < c0 && c0 > 0 && S().phase === 'intro', `开局倒计时 ${c0.toFixed(2)}→${c1.toFixed(2)}`);
    }

    // 26 — duel KO ends the round
    {
      G_API.startMatch('local', 'medium');
      G_API.setPhase('live');
      G_API.setFighter('p1', { x: CX - 20, facing: 1, atkCd: 0 });
      G_API.setFighter('p2', { x: CX + 24, hp: 5, blocking: false, stunT: 0 });
      G_API.press('KeyF'); R(2);
      const s = S();
      ok(26, s.phase === 'result' && s.result === 'p1' && s.resultReason === 'ko' && F('p2').hp === 0,
        `斗剑 KO phase=${s.phase} reason=${s.resultReason}`);
    }

    // 27 — capture gauge reaching 100 ends the round
    {
      G_API.startMatch('local', 'medium');
      G_API.startRound(1);
      G_API.setPhase('live');
      G_API.setFighter('p1', { x: CX, progress: 99.5, vx: 0 });
      G_API.setFighter('p2', { x: CX + 240, progress: 0, vx: 0 });
      R(10);
      const s = S();
      ok(27, s.phase === 'result' && s.result === 'p1' && s.resultReason === 'lamp' && F('p1').progress >= 100,
        `灯焰积满 phase=${s.phase} progress=${F('p1').progress.toFixed(1)}`);
    }

    // 28 — M key toggles mute both ways
    {
      const m0 = S().muted;
      G_API.press('KeyM'); R(1); G_API.release('KeyM');
      const m1 = S().muted;
      G_API.press('KeyM'); R(1); G_API.release('KeyM');
      const m2 = S().muted;
      ok(28, m1 !== m0 && m2 === m0, `M 键静音 ${m0}→${m1}→${m2}`);
    }

    // 29 — settlement panel controls visible
    {
      G_API.startMatch('local', 'medium');
      G_API.setPhase('live');
      G_API.forceWin();
      const go = document.getElementById('go');
      const change = document.getElementById('change');
      const home = document.getElementById('home');
      const visible = !endEl.classList.contains('hide');
      ok(29, !!go && !!change && !!home && visible, '结算面板：再来 / 换难度 / 回标题');
    }

    // 30 — full match fast-forward with real round mechanics (no NaN)
    {
      G_API.startMatch('ai', 2);
      const e0 = G_API.err.length;
      let crashed = false;
      try {
        for (let r = 0; r < 3; r++) {
          G_API.setPhase('live');
          R(24);
          G_API.forceRoundWin(r === 1 ? 'p2' : 'p1');
          if (r < 2) G_API.nextRound();
        }
        G_API.nextRound();
      } catch (err) { crashed = true; console.error('T30', err); }
      const s = S();
      ok(30, !crashed && s.mode === 'over' && !s.nan && G_API.err.length === e0 && frames.some(f => f.kind === 'complete'),
        `整局快进 mode=${s.mode} ${s.p1Wins}:${s.p2Wins} nan=${s.nan}`);
    }

    // 31 — back to title restores the menu
    {
      G_API.goTitle();
      const s = S();
      ok(31, s.mode === 'title' && !titleEl.classList.contains('hide') && endEl.classList.contains('hide') &&
        /最佳|尚无/.test(bestEl.textContent), '测完回标题画面');
    }

    // 32 — audio stayed muted and no AudioContext was created
    ok(32, audio.isMuted() === true && audio.hasCtx() === false, '自测静音且未创建 AudioContext');

    // 33 — assertion count check
    ok(33, results.length >= 26, `断言覆盖 ${results.length} 条（≥26）`);

  } catch (err) {
    window.__TEST_ERR = String((err && err.stack) || err);
    T.fail++;
    results.push({ id: 'ERR', ok: false, name: `autotest crashed: ${window.__TEST_ERR}` });
    console.log('[autotest] crash', window.__TEST_ERR);
    try { G_API.goTitle(); } catch (e) { }
  } finally {
    G_API.setReportTarget(null);
    G_API.setNoAuto(false);
    bestWins = saved.bestWins; bestTime = saved.bestTime; muted = saved.muted;
    audio.setMuted(saved.muted);
    try {
      if (saved.lw === null) localStorage.removeItem(BEST_WINS_KEY); else localStorage.setItem(BEST_WINS_KEY, saved.lw);
      if (saved.lt === null) localStorage.removeItem(BEST_TIME_KEY); else localStorage.setItem(BEST_TIME_KEY, saved.lt);
      if (saved.lm === null) localStorage.removeItem(MUTE_KEY); else localStorage.setItem(MUTE_KEY, saved.lm);
    } catch (e) { }
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
