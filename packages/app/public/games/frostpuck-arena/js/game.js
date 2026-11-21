// Frostpuck Arena 霜锋冰球 — a 2D Canvas air-hockey arena.
// guizang-game-skill series #5 (灯匠夜游 · 第 5 铺).
// Vanilla ES modules, procedural art, synthesized WebAudio, fixed-step loop,
// site report bridge, G debug hooks and the ?autotest=1 suite.

import {
  W, H, TABLE, MID_Y, GOAL_L, GOAL_R, PUCK_R, PAD_R,
  clamp, finite, stepPuck, clampPaddle, reflectX,
} from './physics.js';
import { makeAudio } from './audio.js';

// ==================== constants ====================
const DT = 1 / 60;
const GOAL_SCORE = 7;
const PLAYER_SPEED = 660;
const PLAYER_TRACK = 1900;
const COUNTDOWN_START = 2.6;
const COUNTDOWN_GOAL = 1.8;
const GOAL_HOLD = 1.55;
const BEST_KEY = 'fpa.best';
const MUTE_KEY = 'fpa.mute';
const AUTOTEST = new URLSearchParams(location.search).has('autotest');
const URLP = new URLSearchParams(location.search);

const AI_PROFILES = {
  easy:   { key: 'easy',   label: '易', speed: 250, reaction: 0.34, predict: 0.12, error: 62, guard: 108, attack: 0.55 },
  medium: { key: 'medium', label: '中', speed: 402, reaction: 0.17, predict: 0.56, error: 24, guard: 100, attack: 0.8 },
  hard:   { key: 'hard',   label: '难', speed: 620, reaction: 0.055, predict: 0.94, error: 6, guard: 92, attack: 1 },
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
let best = 0;
try { best = parseFloat(localStorage.getItem(BEST_KEY) || '0') || 0; } catch (e) { best = 0; }
let muted = false;
try { muted = localStorage.getItem(MUTE_KEY) === '1'; } catch (e) { muted = false; }

const audio = makeAudio();
audio.setMuted(muted);

// ==================== mutable game state ====================
let mode = 'title';                 // title | play | over
let gameMode = 'ai';                // ai | local
let aiDiff = 'medium';
let profile = AI_PROFILES.medium;
let phase = 'faceoff';              // faceoff | live | goal | over
let paused = false, noAuto = false;
let playerScore = 0, aiScore = 0;
let matchTime = 0, countdown = 0, goalT = 0;
let winner = null, lastScorer = null, lastCountInt = 0;
let nanFlag = false;
let animT = 0, rallyBannerT = 0;
let hitstopT = 0, shakeT = 0, shakeDur = 0, shakeAmp = 0, flashT = 0, goalPulseT = 0;
let aiTimer = 0, aiTx = W / 2, aiTy = TABLE.y + 100, aiSeed = 1.7;
let pointerDown = false;

const puck = { x: W / 2, y: MID_Y, vx: 0, vy: 0, r: PUCK_R, rot: 0 };
const p1 = { x: W / 2, y: TABLE.y + TABLE.h - 82, vx: 0, vy: 0, tx: W / 2, ty: TABLE.y + TABLE.h - 82, r: PAD_R };
const p2 = { x: W / 2, y: TABLE.y + 82, vx: 0, vy: 0, tx: W / 2, ty: TABLE.y + 82, r: PAD_R };

const particles = [];
const trailPuck = [], trailP1 = [], trailP2 = [];
const held = new Set();
const pressed = new Set();
let reportTarget = null;
const reports = [];
const lastSfxAt = { wall: 0 };

const G = {
  err: window.__BOOTERR || (window.__BOOTERR = []),
};

// ==================== DOM / canvas ====================
const cv = document.getElementById('gl');
const ctx = cv.getContext('2d');
const titleEl = document.getElementById('title');
const endEl = document.getElementById('end');
const endhEl = document.getElementById('endh');
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

function buildStaticArt() {
  const c = bgCv.getContext('2d');
  c.scale(2, 2);
  const rnd = mulberry32(0x5f0a1ce);

  // deep indigo night
  let g = c.createLinearGradient(0, 0, W * 0.35, H);
  g.addColorStop(0, '#080d23'); g.addColorStop(.42, '#10162f');
  g.addColorStop(.76, '#0b1129'); g.addColorStop(1, '#050813');
  c.fillStyle = g; c.fillRect(0, 0, W, H);

  // distant stars / ice dust
  for (let i = 0; i < 150; i++) {
    const x = rnd() * W, y = rnd() * H, s = rnd() * 1.4 + .25;
    c.fillStyle = `rgba(${170 + rnd() * 70 | 0},${215 + rnd() * 40 | 0},255,${.12 + rnd() * .5})`;
    c.beginPath(); c.arc(x, y, s, 0, Math.PI * 2); c.fill();
  }

  // a low, still aurora base
  c.save();
  c.globalCompositeOperation = 'screen';
  for (let b = 0; b < 3; b++) {
    const ag = c.createLinearGradient(0, 20, 0, 200 + b * 50);
    ag.addColorStop(0, 'rgba(90,255,220,.0)');
    ag.addColorStop(.35, b === 1 ? 'rgba(130,180,255,.12)' : 'rgba(70,235,205,.10)');
    ag.addColorStop(.7, 'rgba(150,105,255,.06)');
    ag.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = ag;
    c.beginPath();
    c.moveTo(-50, 160 + b * 38);
    for (let x = -50; x <= W + 50; x += 70) {
      c.quadraticCurveTo(x + 35, 34 + b * 20 + Math.sin(x * .011 + b) * 30, x + 70, 150 + b * 38);
    }
    c.lineTo(W + 50, 0); c.lineTo(-50, 0); c.closePath(); c.fill();
  }
  c.restore();

  // rink drop shadow
  c.save();
  c.shadowColor = 'rgba(43,196,232,.42)';
  c.shadowBlur = 34;
  rr(c, TABLE.x - 10, TABLE.y - 10, TABLE.w + 20, TABLE.h + 20, 26);
  c.fillStyle = 'rgba(4,12,27,.95)'; c.fill();
  c.restore();

  // ice surface
  const ice = c.createLinearGradient(0, TABLE.y, 0, TABLE.y + TABLE.h);
  ice.addColorStop(0, '#83bcd0');
  ice.addColorStop(.26, '#b9dbe7');
  ice.addColorStop(.52, '#d6ecf4');
  ice.addColorStop(.74, '#b1d9e5');
  ice.addColorStop(1, '#8cc1d3');
  c.fillStyle = ice;
  rr(c, TABLE.x, TABLE.y, TABLE.w, TABLE.h, 18); c.fill();

  // a long, frosty glass sheen
  c.save();
  rr(c, TABLE.x, TABLE.y, TABLE.w, TABLE.h, 18); c.clip();
  const sheen = c.createLinearGradient(TABLE.x, TABLE.y, TABLE.x + TABLE.w, TABLE.y + TABLE.h);
  sheen.addColorStop(0, 'rgba(255,255,255,.20)');
  sheen.addColorStop(.28, 'rgba(208,247,255,.02)');
  sheen.addColorStop(.55, 'rgba(255,255,255,.13)');
  sheen.addColorStop(.78, 'rgba(104,178,204,.02)');
  sheen.addColorStop(1, 'rgba(255,255,255,.08)');
  c.fillStyle = sheen; c.fillRect(TABLE.x, TABLE.y, TABLE.w, TABLE.h);
  const vig = c.createRadialGradient(W / 2, MID_Y, 90, W / 2, MID_Y, 510);
  vig.addColorStop(0, 'rgba(6,22,44,0)');
  vig.addColorStop(.64, 'rgba(8,34,58,.015)');
  vig.addColorStop(1, 'rgba(4,17,37,.18)');
  c.fillStyle = vig; c.fillRect(TABLE.x, TABLE.y, TABLE.w, TABLE.h);
  c.restore();

  // side tints: violet at AI end, copper at player end
  const topTint = c.createLinearGradient(0, TABLE.y, 0, MID_Y);
  topTint.addColorStop(0, 'rgba(136,102,236,.18)'); topTint.addColorStop(1, 'rgba(136,102,236,0)');
  c.fillStyle = topTint; c.fillRect(TABLE.x, TABLE.y, TABLE.w, TABLE.h / 2);
  const botTint = c.createLinearGradient(0, MID_Y, 0, TABLE.y + TABLE.h);
  botTint.addColorStop(1, 'rgba(231,170,90,.16)'); botTint.addColorStop(0, 'rgba(231,170,90,0)');
  c.fillStyle = botTint; c.fillRect(TABLE.x, MID_Y, TABLE.w, TABLE.h / 2);

  // frost grain + skate scratches
  c.save();
  rr(c, TABLE.x + 2, TABLE.y + 2, TABLE.w - 4, TABLE.h - 4, 16); c.clip();
  for (let i = 0; i < 180; i++) {
    c.fillStyle = `rgba(255,255,255,${.03 + rnd() * .16})`;
    c.beginPath(); c.arc(TABLE.x + rnd() * TABLE.w, TABLE.y + rnd() * TABLE.h, .35 + rnd() * 2, 0, 7); c.fill();
  }
  for (let i = 0; i < 52; i++) {
    const x = TABLE.x + rnd() * TABLE.w, y = TABLE.y + rnd() * TABLE.h;
    const a = (rnd() - .5) * .9, l = 16 + rnd() * 95;
    c.strokeStyle = i % 3 === 0 ? 'rgba(255,255,255,.22)' : 'rgba(44,105,130,.10)';
    c.lineWidth = .45 + rnd() * .7;
    c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + Math.cos(a) * l * .5 + 6, y + Math.sin(a) * l * .5, x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke();
  }
  // faint frozen fern strokes in the corners
  for (const [cx, cy, sx, sy] of [[TABLE.x + 18, TABLE.y + 18, 1, 1], [TABLE.x + TABLE.w - 18, TABLE.y + 18, -1, 1], [TABLE.x + 18, TABLE.y + TABLE.h - 18, 1, -1], [TABLE.x + TABLE.w - 18, TABLE.y + TABLE.h - 18, -1, -1]]) {
    c.strokeStyle = 'rgba(255,255,255,.34)'; c.lineWidth = 1.1;
    for (let i = 0; i < 7; i++) {
      c.beginPath(); c.moveTo(cx, cy);
      c.quadraticCurveTo(cx + sx * (24 + i * 9), cy + sy * (10 + i * 3), cx + sx * (36 + i * 15), cy + sy * (44 + i * 8));
      c.stroke();
    }
  }
  c.restore();

  // rink markings
  c.save();
  c.strokeStyle = 'rgba(35,98,130,.28)'; c.lineWidth = 2;
  c.setLineDash([9, 10]);
  c.beginPath(); c.moveTo(TABLE.x + 4, MID_Y); c.lineTo(TABLE.x + TABLE.w - 4, MID_Y); c.stroke();
  c.setLineDash([]);
  c.strokeStyle = 'rgba(35,98,130,.34)'; c.lineWidth = 2;
  c.beginPath(); c.arc(W / 2, MID_Y, 78, 0, Math.PI * 2); c.stroke();
  c.strokeStyle = 'rgba(255,255,255,.6)'; c.lineWidth = 1;
  c.beginPath(); c.arc(W / 2, MID_Y, 79, 0, Math.PI * 2); c.stroke();
  c.fillStyle = 'rgba(49,124,154,.20)';
  c.beginPath(); c.arc(W / 2, MID_Y, 7, 0, Math.PI * 2); c.fill();
  for (const fx of [W / 2 - 190, W / 2 + 190]) {
    c.strokeStyle = 'rgba(35,98,130,.22)'; c.lineWidth = 1.5;
    c.beginPath(); c.arc(fx, MID_Y, 52, 0, Math.PI * 2); c.stroke();
    c.fillStyle = 'rgba(49,124,154,.18)';
    c.beginPath(); c.arc(fx, MID_Y, 5, 0, 7); c.fill();
  }
  // goal creases
  for (const [gy, dir] of [[TABLE.y, 1], [TABLE.y + TABLE.h, -1]]) {
    c.strokeStyle = dir === 1 ? 'rgba(126,93,220,.42)' : 'rgba(212,153,76,.48)';
    c.lineWidth = 2;
    c.beginPath(); c.arc(W / 2, gy, 120, dir === 1 ? 0 : Math.PI, dir === 1 ? Math.PI : Math.PI * 2); c.stroke();
    c.setLineDash([6, 7]);
    c.strokeStyle = 'rgba(255,255,255,.58)';
    c.beginPath(); c.arc(W / 2, gy, 122, dir === 1 ? 0 : Math.PI, dir === 1 ? Math.PI : Math.PI * 2); c.stroke();
    c.setLineDash([]);
  }
  c.fillStyle = 'rgba(255,255,255,.36)';
  c.font = '600 10px "Microsoft YaHei",sans-serif';
  c.textAlign = 'center';
  c.fillText('F R O S T P U C K   A R E N A', W / 2, MID_Y + 118);
  c.restore();

  // rink frame: copper outside + cyan light inside
  c.save();
  c.shadowColor = 'rgba(240,188,98,.55)'; c.shadowBlur = 12;
  rr(c, TABLE.x, TABLE.y, TABLE.w, TABLE.h, 18);
  c.strokeStyle = 'rgba(216,164,82,.88)'; c.lineWidth = 3; c.stroke();
  c.restore();
  c.strokeStyle = 'rgba(174,245,255,.68)'; c.lineWidth = 1.2;
  rr(c, TABLE.x + 3, TABLE.y + 3, TABLE.w - 6, TABLE.h - 6, 15); c.stroke();

  // goal mouths
  for (const [gy, dir, col] of [[TABLE.y, -1, 'rgba(156,118,255,'], [TABLE.y + TABLE.h, 1, 'rgba(255,190,102,']]) {
    c.save();
    c.beginPath(); c.rect(GOAL_L, gy + (dir < 0 ? -16 : 0), GOAL_R - GOAL_L, 16); c.clip();
    const gg = c.createLinearGradient(0, gy, 0, gy + (dir < 0 ? -16 : 16));
    gg.addColorStop(dir < 0 ? 0 : 1, '#090d18');
    gg.addColorStop(dir < 0 ? 1 : 0, col + '.45)');
    c.fillStyle = gg; c.fillRect(GOAL_L, gy - 16, GOAL_R - GOAL_L, 32);
    c.restore();
    c.fillStyle = col + '.22)';
    c.fillRect(GOAL_L, gy + (dir < 0 ? -2 : 0), GOAL_R - GOAL_L, 2);
    // posts
    c.fillStyle = 'rgba(250,220,156,.9)';
    c.fillRect(GOAL_L - 4, gy - 6, 4, 12);
    c.fillRect(GOAL_R, gy - 6, 4, 12);
    c.fillStyle = 'rgba(150,242,255,.7)';
    c.fillRect(GOAL_L - 1.5, gy + (dir < 0 ? -9 : 1), 1.5, 8);
    c.fillRect(GOAL_R, gy + (dir < 0 ? -9 : 1), 1.5, 8);
  }

  // corner copper bolts
  for (const [x, y] of [[TABLE.x + 12, TABLE.y + 12], [TABLE.x + TABLE.w - 12, TABLE.y + 12], [TABLE.x + 12, TABLE.y + TABLE.h - 12], [TABLE.x + TABLE.w - 12, TABLE.y + TABLE.h - 12]]) {
    c.fillStyle = 'rgba(245,199,117,.78)';
    c.beginPath(); c.arc(x, y, 2.3, 0, 7); c.fill();
  }
}
buildStaticArt();

// ==================== reports / bridge ====================
function toWireReport(frame) {
  const score = Number.isFinite(frame.score) ? Math.round(frame.score) : undefined;
  if (frame.kind === 'progress') return { kind: 'progress', data: { ...frame } };
  if (frame.kind === 'event') return { kind: 'event', event: String(frame.event || frame.tag || 'event'), data: { ...frame } };
  if (frame.kind === 'gameOver') return { kind: 'gameOver', score, progress: (frame.progress && typeof frame.progress === 'object') ? frame.progress : { value: frame.progress }, data: { ...frame } };
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
      if (frame.kind === 'ready') window.parent.postMessage({ source: 'lightgame', type: 'lightgame:ready', gameId: 'frostpuck-arena', v: 1 }, '*');
    }
  } catch (e) { }
}
report('ready', { game: 'frostpuck-arena' });

// ==================== helpers ====================
function fmtTime(t) {
  const s = Math.max(0, t || 0);
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  const d = Math.floor((s - Math.floor(s)) * 10);
  return `${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}.${d}`;
}
function fmtBest(t) {
  return t > 0 ? fmtTime(t) : '暂无胜绩';
}
function progressPercent() {
  return Math.round(Math.max(playerScore, aiScore) / GOAL_SCORE * 100);
}
function isPlayable() { return mode === 'play' && !paused && phase !== 'over'; }

function updateMuteButton() {
  if (muteBtn) {
    muteBtn.textContent = muted ? '静' : '♪';
    muteBtn.classList.toggle('on', muted);
    muteBtn.title = muted ? '取消静音 (M)' : '静音 (M)';
  }
}
function updatePauseButton() {
  if (pauseBtn) {
    pauseBtn.textContent = paused ? '▶' : '❚❚';
    pauseBtn.title = paused ? '继续 (P)' : '暂停 (P)';
    pauseBtn.disabled = mode !== 'play';
  }
}
function updateTitleBest() {
  if (!bestEl) return;
  bestEl.textContent = best > 0 ? `最快胜利 ${fmtBest(best)}` : '尚无胜绩 · 首胜将记下最快用时';
}
function toggleMute() {
  muted = !muted;
  audio.setMuted(muted);
  updateMuteButton();
  try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch (e) { }
}
function toast(msg, ms = 1500) {
  if (!toastEl) return;
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toastEl.classList.remove('show'), ms);
}

// ==================== flow ====================
function hideOverlays() {
  titleEl.classList.add('hide');
  endEl.classList.add('hide');
}
function goTitle() {
  mode = 'title'; phase = 'over'; paused = false; winner = null;
  pointerDown = false;
  particles.length = 0;
  puck.x = W / 2; puck.y = MID_Y; puck.vx = 0; puck.vy = 0;
  p1.x = p1.tx = W / 2; p1.y = p1.ty = TABLE.y + TABLE.h - 82;
  p2.x = p2.tx = W / 2; p2.y = p2.ty = TABLE.y + 82;
  trailPuck.length = 0; trailP1.length = 0; trailP2.length = 0;
  titleEl.classList.remove('hide');
  endEl.classList.add('hide');
  updateTitleBest(); updatePauseButton(); updateMuteButton();
  audio.setState('title');
  audio.reset();
}
function resetPaddles() {
  p1.x = p1.tx = W / 2; p1.y = p1.ty = TABLE.y + TABLE.h - 82;
  p1.vx = p1.vy = 0;
  p2.x = p2.tx = W / 2; p2.y = p2.ty = TABLE.y + 82;
  p2.vx = p2.vy = 0;
  trailP1.length = 0; trailP2.length = 0;
}
function resetPuck() {
  puck.x = W / 2; puck.y = MID_Y; puck.vx = 0; puck.vy = 0; puck.rot = 0;
  trailPuck.length = 0;
}
function setupFaceoff(cd = COUNTDOWN_GOAL) {
  phase = 'faceoff';
  countdown = cd;
  lastCountInt = Math.ceil(cd);
  goalT = 0;
  resetPuck();
  resetPaddles();
  aiTimer = profile.reaction;
  aiTx = W / 2; aiTy = TABLE.y + profile.guard;
  hitstopT = 0; rallyBannerT = 0;
  updatePauseButton();
}
function startRally() {
  phase = 'live';
  countdown = 0;
  goalT = 0;
  hitstopT = 0;
  resetPuck();
  aiTimer = profile.reaction;
  aiTx = W / 2; aiTy = TABLE.y + profile.guard;
  rallyBannerT = 0.55;
  updatePauseButton();
}
function startMatch(gm = 'ai', diff = aiDiff) {
  gameMode = gm === 'local' ? 'local' : 'ai';
  aiDiff = diffKey(diff);
  profile = AI_PROFILES[aiDiff];
  mode = 'play'; paused = false;
  playerScore = 0; aiScore = 0;
  matchTime = 0; winner = null; lastScorer = null;
  nanFlag = false;
  particles.length = 0;
  hitstopT = 0; shakeT = 0; flashT = 0; goalPulseT = 0;
  hideOverlays();
  setupFaceoff(COUNTDOWN_START);
  audio.reset();
  audio.setState('match');
  updateMuteButton(); updatePauseButton();
}
function saveBestIfNeeded(t) {
  if (!(t > 0)) return false;
  if (best <= 0 || t < best) {
    best = Math.round(t * 100) / 100;
    try { localStorage.setItem(BEST_KEY, String(best)); } catch (e) { }
    updateTitleBest();
    return true;
  }
  return false;
}

function awardPoint(side, realGoal = true) {
  if (mode !== 'play') return false;
  const scorer = side === 'p1' ? 'p1' : 'p2';
  if (scorer === 'p1') playerScore = Math.min(GOAL_SCORE, playerScore + 1);
  else aiScore = Math.min(GOAL_SCORE, aiScore + 1);
  lastScorer = scorer;
  phase = 'goal';
  goalT = GOAL_HOLD;
  goalPulseT = GOAL_HOLD;
  hitstopT = 0.08;
  shakeDur = .52; shakeT = .52; shakeAmp = 10;
  flashT = .38;
  puck.vx = 0; puck.vy = 0;
  if (realGoal) {
    audio.play('goal');
    spawnGoalBurst(scorer);
  } else {
    audio.play('start');
  }
  report('progress', { score: playerScore, progress: progressPercent() });
  return true;
}

function endMatch(side) {
  if (mode !== 'play') return;
  mode = 'over'; phase = 'over'; paused = false; winner = side;
  audio.setState('end');
  const won = side === 'p1';
  let isNew = false;
  if (won) {
    audio.play('win');
    isNew = saveBestIfNeeded(matchTime);
    report('complete', { score: playerScore, progress: 100, time: Math.round(matchTime * 100) / 100 });
  } else {
    audio.play('lose');
    report('gameOver', { score: playerScore, progress: progressPercent(), time: Math.round(matchTime * 100) / 100 });
  }
  showEnd(won, isNew);
  updatePauseButton();
}

function forceWin() {
  if (mode !== 'play') startMatch(gameMode, aiDiff);
  if (mode !== 'play') return false;
  playerScore = 6;
  phase = 'goal';
  awardPoint('p1', false);
  endMatch('p1');
  return true;
}
function forceFail() {
  if (mode !== 'play') startMatch(gameMode, aiDiff);
  if (mode !== 'play') return false;
  aiScore = 6;
  phase = 'goal';
  awardPoint('p2', false);
  endMatch('p2');
  return true;
}

function showEnd(won, isNew) {
  endhEl.textContent = won ? '冰 面 制 胜' : (gameMode === 'local' ? 'P2 胜 出' : '惜 败 一 着');
  const lines = [];
  if (gameMode === 'local') lines.push(`P1  ${playerScore}  :  ${aiScore}  P2`);
  else lines.push(`你  ${playerScore}  :  ${aiScore}  霜影 · ${profile.label}`);
  lines.push(`用时 ${fmtTime(matchTime)}`);
  lines.push(isNew ? '★ 新纪录 · 最快胜利' : `最快胜利 ${fmtBest(best)}`);
  if (!won) lines.push('调整拍面，再试一次。');
  enddEl.textContent = lines.join('\n');
  endEl.classList.remove('hide');
  titleEl.classList.add('hide');
  updateTitleBest();
}
function goHomeBridge() {
  try {
    if (window.parent && window.parent !== window) window.parent.location.href = '/';
    else window.location.href = '/';
  } catch (e) { try { window.location.href = '/'; } catch (e2) { } }
}

function togglePause() {
  if (mode !== 'play') return;
  paused = !paused;
  audio.play('pause');
  updatePauseButton();
}

function shareScore() {
  const score = Math.max(playerScore, aiScore);
  audio.play('share');
  try {
    if (window.parent && window.parent !== window && typeof window.parent.handleGlobalShare === 'function') {
      window.parent.handleGlobalShare(score);
      return;
    }
  } catch (e) { }
  if (typeof window.dp_share === 'function') { try { window.dp_share(score); } catch (e) { } }
  else if (navigator.share) {
    navigator.share({ title: '霜锋冰球 Frostpuck Arena', text: `我在霜锋冰球打到 ${playerScore} : ${aiScore}`, url: location.href }).catch(() => { });
  }
}

// ==================== input ====================
function setPointerTarget(clientX, clientY) {
  const lx = (clientX - viewOX) / viewScale;
  const ly = (clientY - viewOY) / viewScale;
  p1.tx = clamp(lx, TABLE.x + PAD_R, TABLE.x + TABLE.w - PAD_R);
  p1.ty = clamp(ly, MID_Y + PAD_R, TABLE.y + TABLE.h - PAD_R);
}
function dragTo(x, y) {
  p1.tx = clamp(finite(x, W / 2), TABLE.x + PAD_R, TABLE.x + TABLE.w - PAD_R);
  p1.ty = clamp(finite(y, TABLE.y + TABLE.h - 100), MID_Y + PAD_R, TABLE.y + TABLE.h - PAD_R);
  return { x: p1.tx, y: p1.ty };
}

cv.addEventListener('pointerdown', (e) => {
  if (mode !== 'play' || paused) return;
  pointerDown = true;
  setPointerTarget(e.clientX, e.clientY);
  try { if (cv.setPointerCapture) cv.setPointerCapture(e.pointerId); } catch (err) { }
  e.preventDefault();
});
cv.addEventListener('pointermove', (e) => {
  if (mode !== 'play' || paused) return;
  if (!pointerDown && e.pointerType !== 'mouse') return;
  setPointerTarget(e.clientX, e.clientY);
});
function endPointer(e) {
  pointerDown = false;
  if (mode === 'play' && e && Number.isFinite(e.clientX)) setPointerTarget(e.clientX, e.clientY);
}
cv.addEventListener('pointerup', endPointer);
cv.addEventListener('pointercancel', () => { pointerDown = false; });
cv.addEventListener('pointerleave', () => { pointerDown = false; });

const MOVE_CODES = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space']);
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
window.addEventListener('blur', () => { held.clear(); pointerDown = false; });
document.addEventListener('visibilitychange', () => { if (document.hidden) { held.clear(); pointerDown = false; } });

function onFirstGesture() {
  if (!AUTOTEST) audio.unlock();
}
window.addEventListener('pointerdown', onFirstGesture, { once: true, capture: true });
window.addEventListener('keydown', onFirstGesture, { once: true, capture: true });

function handlePressed() {
  for (const code of pressed) {
    if (code === 'KeyM') toggleMute();
    else if (code === 'KeyP') togglePause();
    else if (code === 'Escape') { if (mode === 'over') goTitle(); else if (mode === 'play') togglePause(); }
    else if (code === 'Enter' || code === 'Space' || code === 'KeyR') {
      if (mode === 'title') startMatch('ai', aiDiff);
      else if (mode === 'over') startMatch(gameMode, aiDiff);
    }
  }
  pressed.clear();
}

// ==================== controls / AI ====================
function moveTowardPaddle(p, tx, ty, maxSpeed, dt, side) {
  const ox = p.x, oy = p.y;
  let dx = finite(tx, p.x) - p.x, dy = finite(ty, p.y) - p.y;
  const d = Math.hypot(dx, dy);
  if (d > 1e-4) {
    const step = Math.min(d, maxSpeed * dt);
    p.x += (dx / d) * step;
    p.y += (dy / d) * step;
  }
  clampPaddle(p, side);
  p.vx = (p.x - ox) / Math.max(dt, 1e-5);
  p.vy = (p.y - oy) / Math.max(dt, 1e-5);
}
function moveDirect(p, dx, dy, side, dt) {
  const ox = p.x, oy = p.y;
  p.x += dx; p.y += dy;
  clampPaddle(p, side);
  p.vx = (p.x - ox) / Math.max(dt, 1e-5);
  p.vy = (p.y - oy) / Math.max(dt, 1e-5);
}
function keyAxis(codes, neg, pos) {
  return (codes.some(c => c === pos) ? 1 : 0) - (codes.some(c => c === neg) ? 1 : 0);
}
function updatePlayerControl(dt) {
  const kx = keyAxis([...held], 'KeyA', 'KeyD');
  const ky = keyAxis([...held], 'KeyW', 'KeyS');
  if (kx || ky) {
    const len = Math.hypot(kx, ky) || 1;
    moveDirect(p1, (kx / len) * PLAYER_SPEED * dt, (ky / len) * PLAYER_SPEED * dt, 'bottom', dt);
    p1.tx = p1.x; p1.ty = p1.y;
  } else {
    moveTowardPaddle(p1, p1.tx, p1.ty, PLAYER_TRACK, dt, 'bottom');
  }
}
function updateLocalP2(dt) {
  const kx = keyAxis([...held], 'ArrowLeft', 'ArrowRight');
  const ky = keyAxis([...held], 'ArrowUp', 'ArrowDown');
  if (kx || ky) {
    const len = Math.hypot(kx, ky) || 1;
    moveDirect(p2, (kx / len) * PLAYER_SPEED * dt, (ky / len) * PLAYER_SPEED * dt, 'top', dt);
    p2.tx = p2.x; p2.ty = p2.y;
  } else {
    moveTowardPaddle(p2, p2.tx, p2.ty, PLAYER_TRACK, dt, 'top');
  }
}
function computeAiTarget() {
  const guardY = TABLE.y + profile.guard;
  let tx = W / 2, ty = guardY;
  const p = puck;
  const towardAi = p.vy < -18 && p.y > TABLE.y + 20;
  if (towardAi) {
    const t = (guardY - p.y) / p.vy;
    if (t > 0 && t < 2.8) {
      const px = p.x + p.vx * t * profile.predict;
      tx = reflectX(px, TABLE.x + PUCK_R, TABLE.x + TABLE.w - PUCK_R);
    } else {
      tx = p.x + p.vx * 0.12 * profile.predict;
    }
    ty = guardY;
  } else if (p.y < MID_Y - 36 && Math.abs(p.vy) < 280) {
    // attack a loose puck in the AI half
    tx = p.x + p.vx * .12 * profile.predict;
    ty = Math.min(MID_Y - PAD_R, p.y + profile.attack * 42);
  } else {
    tx = W / 2 + Math.sin(animT * .7 + aiSeed) * (profile.error * .85);
    ty = guardY + Math.cos(animT * .9 + aiSeed) * 14;
  }
  tx += Math.sin(animT * 1.9 + aiSeed * 2.3) * profile.error;
  ty += Math.cos(animT * 1.3 + aiSeed) * profile.error * .16;
  aiTx = clamp(tx, TABLE.x + PAD_R, TABLE.x + TABLE.w - PAD_R);
  aiTy = clamp(ty, TABLE.y + PAD_R, MID_Y - PAD_R);
}
function updateAI(dt) {
  aiTimer -= dt;
  if (aiTimer <= 0) {
    aiTimer = Math.max(.018, profile.reaction);
    computeAiTarget();
  }
  moveTowardPaddle(p2, aiTx, aiTy, profile.speed, dt, 'top');
}

function updateControls(dt) {
  updatePlayerControl(dt);
  if (gameMode === 'local') updateLocalP2(dt);
  else if (phase === 'live') updateAI(dt);
  else { p2.vx = 0; p2.vy = 0; }
}

// ==================== effects ====================
function pushTrail(arr, x, y, max = 15) {
  const last = arr[arr.length - 1];
  if (!last || Math.hypot(x - last.x, y - last.y) > 2.2) arr.push({ x, y });
  if (arr.length > max) arr.shift();
}
function spawnSpark(x, y, color, n = 8, power = 240, spread = Math.PI * 2, dir = 0) {
  for (let i = 0; i < n; i++) {
    const a = dir + (Math.random() - .5) * spread;
    const sp = power * (.35 + Math.random() * .8);
    particles.push({
      x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      life: .22 + Math.random() * .36, max: .58, size: 1.2 + Math.random() * 2.8,
      color, grav: 55, drag: .12, type: 'spark',
    });
  }
}
function spawnRing(x, y, color, size = 18, grow = 220, life = .38) {
  particles.push({ x, y, vx: 0, vy: 0, life, max: life, size, grow, color, grav: 0, drag: 0, type: 'ring' });
}
function spawnGoalBurst(side) {
  const y = side === 'p1' ? TABLE.y + 8 : TABLE.y + TABLE.h - 8;
  const colors = side === 'p1'
    ? ['#8ff6ff', '#c9fbff', '#ffd27f', '#ffffff', '#9b8cff']
    : ['#ffb46b', '#ffd7a2', '#ff8fc8', '#ffffff', '#a9eaff'];
  for (let i = 0; i < 110; i++) {
    const a = -Math.PI / 2 + (Math.random() - .5) * 2.6;
    const sp = 140 + Math.random() * 520;
    particles.push({
      x: W / 2 + (Math.random() - .5) * 100, y,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp + (side === 'p1' ? 90 : -90),
      life: .7 + Math.random() * .95, max: 1.65,
      size: 2 + Math.random() * 4.6, color: colors[i % colors.length],
      grav: 300, drag: .06, type: 'spark',
    });
  }
  for (let i = 0; i < 4; i++) spawnRing(W / 2 + (i - 1.5) * 38, y, colors[i % colors.length], 14 + i * 6, 240 + i * 40, .55 + i * .12);
}
function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) { particles.splice(i, 1); continue; }
    if (p.type === 'ring') {
      p.size += p.grow * dt;
      continue;
    }
    p.vy += p.grav * dt;
    p.vx *= Math.max(0, 1 - p.drag * dt);
    p.vy *= Math.max(0, 1 - p.drag * dt);
    p.x += p.vx * dt; p.y += p.vy * dt;
  }
}
function updateFx(dt) {
  if (hitstopT > 0) hitstopT = Math.max(0, hitstopT - dt);
  if (shakeT > 0) shakeT = Math.max(0, shakeT - dt);
  if (shakeDur <= 0) shakeDur = .5;
  if (flashT > 0) flashT = Math.max(0, flashT - dt);
  if (goalPulseT > 0) goalPulseT = Math.max(0, goalPulseT - dt);
  if (rallyBannerT > 0) rallyBannerT = Math.max(0, rallyBannerT - dt);
  updateParticles(dt);
}
function kick(power) {
  if (power < 40) return;
  hitstopT = Math.max(hitstopT, .055);
  shakeDur = .14; shakeT = Math.max(shakeT, .14);
  shakeAmp = Math.min(7, 1.5 + power * .006);
}
function onPaddleHit(pad, impact) {
  const strong = clamp(impact / 620, .15, 1);
  audio.play('hit', strong);
  const col = pad === p1 ? '#c7fdff' : '#ffd3f1';
  spawnSpark(puck.x, puck.y, col, 8 + Math.round(strong * 10), 160 + strong * 300, Math.PI * 1.2, pad === p1 ? -Math.PI / 2 : Math.PI / 2);
  spawnRing(puck.x, puck.y, col, 10 + strong * 8, 135 + strong * 90, .3);
  kick(impact);
}
function onWallHit(nx, ny, impact) {
  if (impact > 60) {
    const color = '#d8fbff';
    spawnSpark(puck.x, puck.y, color, 4, 80 + impact * .18, Math.PI * .8, Math.atan2(ny, nx));
    if (impact > 160 && animT - lastSfxAt.wall > .06) {
      audio.play('wall', clamp(impact / 900, .1, 1));
      lastSfxAt.wall = animT;
    }
  }
}

// ==================== match update ====================
function update(dt) {
  if (!Number.isFinite(dt) || dt <= 0) return;
  handlePressed();
  animT += dt;

  if (mode === 'title') {
    updateParticles(dt);
    audio.tick(dt);
    return;
  }
  if (mode === 'over') {
    updateFx(dt);
    audio.tick(dt);
    return;
  }
  if (paused) {
    audio.tick(0);
    return;
  }

  matchTime += dt;
  const tense = playerScore >= 5 || aiScore >= 5;
  audio.setState(tense ? 'tension' : 'match');

  if (phase === 'faceoff') {
    updateControls(dt);
    if (!noAuto) {
      countdown -= dt;
      const ci = Math.ceil(countdown);
      if (ci !== lastCountInt && ci >= 1 && ci <= 3) audio.play('count');
      lastCountInt = ci;
      if (countdown <= 0) {
        phase = 'live'; countdown = 0;
        aiTimer = profile.reaction;
        audio.play('start');
        rallyBannerT = .5;
      }
    }
    updateFx(dt);
    audio.tick(dt);
    checkNaN();
    return;
  }

  if (phase === 'goal') {
    if (!noAuto) {
      goalT -= dt;
      if (goalT <= 0) {
        if (playerScore >= GOAL_SCORE || aiScore >= GOAL_SCORE) endMatch(playerScore >= GOAL_SCORE ? 'p1' : 'p2');
        else setupFaceoff(COUNTDOWN_GOAL);
      }
    }
    updateFx(dt);
    audio.tick(dt);
    checkNaN();
    return;
  }

  if (phase === 'live') {
    updateControls(dt);
    if (hitstopT <= 0) {
      const result = stepPuck(puck, [p1, p2], dt, { onHit: onPaddleHit, onWall: onWallHit });
      if (result) awardPoint(result, true);
    }
    if (hitstopT > 0) {
      // visual-only double time during the hit-stop, physics resumes next frame
    }
    const sp = Math.hypot(puck.vx, puck.vy);
    puck.rot += sp * dt * .012;
    pushTrail(trailPuck, puck.x, puck.y, 18);
    pushTrail(trailP1, p1.x, p1.y, 10);
    pushTrail(trailP2, p2.x, p2.y, 10);
    updateFx(dt);
    audio.tick(dt);
    checkNaN();
  }
}

function checkNaN() {
  const vals = [puck.x, puck.y, puck.vx, puck.vy, p1.x, p1.y, p1.vx, p1.vy, p2.x, p2.y, p2.vx, p2.vy, matchTime, countdown];
  for (const v of vals) if (!Number.isFinite(v)) { nanFlag = true; break; }
  if (!Number.isFinite(puck.x) || !Number.isFinite(puck.y)) { puck.x = W / 2; puck.y = MID_Y; puck.vx = 0; puck.vy = 0; }
}

// ==================== rendering ====================
function drawAurora(t) {
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (let b = 0; b < 3; b++) {
    const y0 = 10 + b * 22;
    ctx.beginPath();
    ctx.moveTo(-30, y0 + 80);
    for (let x = -30; x <= W + 30; x += 48) {
      const yy = y0 + 46 + Math.sin(x * .012 + t * (.24 + b * .06) + b * 1.7) * 24 + Math.sin(x * .027 - t * .17) * 7;
      ctx.quadraticCurveTo(x + 24, yy - 20, x + 48, yy);
    }
    ctx.strokeStyle = b === 0 ? 'rgba(74,245,205,.10)' : b === 1 ? 'rgba(137,159,255,.09)' : 'rgba(187,118,255,.07)';
    ctx.lineWidth = 18 - b * 4;
    ctx.stroke();
    ctx.strokeStyle = b === 1 ? 'rgba(215,247,255,.07)' : 'rgba(180,255,239,.055)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  const glow = ctx.createRadialGradient(W * .5, TABLE.y + 30, 10, W * .5, TABLE.y + 30, 360);
  glow.addColorStop(0, `rgba(114,238,255,${.09 + .03 * Math.sin(t * 1.3)})`);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow; ctx.fillRect(0, 0, W, 300);
  ctx.restore();
}

function drawTrails() {
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (const [arr, col, rad] of [[trailPuck, '120,240,255', 9], [trailP1, '107,232,255', 18], [trailP2, '255,155,220', 18]]) {
    for (let i = 0; i < arr.length; i++) {
      const k = (i + 1) / arr.length;
      ctx.fillStyle = `rgba(${col},${k * .09})`;
      ctx.beginPath(); ctx.arc(arr[i].x, arr[i].y, rad * k, 0, 7); ctx.fill();
    }
  }
  ctx.restore();
}

function drawGoalGlow(t) {
  for (const [side, color, y] of [['p1', '145,111,255', TABLE.y + 4], ['p2', '255,181,94', TABLE.y + TABLE.h - 4]]) {
    const active = lastScorer === side ? .25 + goalPulseT * .3 : .08 + .03 * Math.sin(t * 1.8 + (side === 'p1' ? 0 : 2));
    const g = ctx.createRadialGradient(W / 2, y, 4, W / 2, y, 135);
    g.addColorStop(0, `rgba(${color},${active})`);
    g.addColorStop(.45, `rgba(${color},${active * .3})`);
    g.addColorStop(1, `rgba(${color},0)`);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(W / 2, y, 150, 52, 0, 0, Math.PI * 2); ctx.fill();
  }
}

function drawPuck() {
  const { x, y, r } = puck;
  ctx.save();
  ctx.translate(x, y);
  ctx.shadowColor = 'rgba(110,244,255,.95)'; ctx.shadowBlur = 20;
  const g = ctx.createRadialGradient(-4, -5, 1, 0, 0, r);
  g.addColorStop(0, '#f8ffff'); g.addColorStop(.2, '#baf8ff');
  g.addColorStop(.55, '#2db7d7'); g.addColorStop(.82, '#0b5c7a'); g.addColorStop(1, '#082238');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(221,255,255,.9)'; ctx.lineWidth = 1.3;
  ctx.beginPath(); ctx.arc(0, 0, r - 1.4, 0, 7); ctx.stroke();
  ctx.rotate(puck.rot);
  ctx.strokeStyle = 'rgba(9,46,68,.7)'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.arc(0, 0, r * .56, .25, 2.2); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, r * .56, 3.4, 5.5); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.82)';
  ctx.beginPath(); ctx.arc(-4.5, -5, 2, 0, 7); ctx.fill();
  ctx.restore();
}

function drawPaddle(p, side, isLocalP2) {
  const col = side === 'top' ? (isLocalP2 ? '#ff9bd6' : '#c39bff') : '#77eaff';
  const col2 = side === 'top' ? (isLocalP2 ? '#ffd0e9' : '#eadcff') : '#ddffff';
  const accent = side === 'top' ? '#ffbd78' : '#f2c778';
  ctx.save();
  ctx.translate(p.x, p.y + 4);
  ctx.fillStyle = 'rgba(8,28,42,.22)';
  ctx.beginPath(); ctx.ellipse(0, 8, p.r * .98, p.r * .62, 0, 0, 7); ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(p.x, p.y);
  const glow = ctx.createRadialGradient(0, 0, p.r * .2, 0, 0, p.r * 1.9);
  glow.addColorStop(0, side === 'top' ? 'rgba(193,140,255,.22)' : 'rgba(91,235,255,.24)');
  glow.addColorStop(.55, side === 'top' ? 'rgba(193,140,255,.08)' : 'rgba(91,235,255,.09)');
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.arc(0, 0, p.r * 1.9, 0, 7); ctx.fill();

  const rim = ctx.createLinearGradient(-p.r, -p.r, p.r, p.r);
  rim.addColorStop(0, accent); rim.addColorStop(.37, '#fff3c4');
  rim.addColorStop(.62, side === 'top' ? '#8b6ab8' : '#5fa6a7'); rim.addColorStop(1, '#1b2a36');
  ctx.shadowColor = side === 'top' ? 'rgba(195,140,255,.85)' : 'rgba(100,240,255,.9)';
  ctx.shadowBlur = 15;
  ctx.fillStyle = rim;
  ctx.beginPath(); ctx.arc(0, 0, p.r, 0, 7); ctx.fill();
  ctx.shadowBlur = 0;

  const inner = ctx.createRadialGradient(-9, -10, 2, 0, 0, p.r * .86);
  inner.addColorStop(0, col2); inner.addColorStop(.35, col);
  inner.addColorStop(.78, side === 'top' ? '#56307f' : '#08657a');
  inner.addColorStop(1, side === 'top' ? '#201436' : '#073342');
  ctx.fillStyle = inner;
  ctx.beginPath(); ctx.arc(0, 0, p.r * .78, 0, 7); ctx.fill();

  ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(0, 0, p.r * .66, 0, 7); ctx.stroke();
  ctx.strokeStyle = 'rgba(9,20,30,.48)'; ctx.lineWidth = 2;
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + Math.PI / 4;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * p.r * .2, Math.sin(a) * p.r * .2);
    ctx.lineTo(Math.cos(a) * p.r * .55, Math.sin(a) * p.r * .55);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,255,255,.72)';
  ctx.beginPath(); ctx.arc(-p.r * .3, -p.r * .32, p.r * .16, 0, 7); ctx.fill();
  ctx.fillStyle = side === 'top' ? 'rgba(255,220,244,.9)' : 'rgba(235,255,255,.95)';
  ctx.font = `700 ${side === 'top' ? 9 : 9}px "Microsoft YaHei",sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(side === 'top' ? (isLocalP2 ? 'P2' : 'AI') : 'P1', 0, 1);
  ctx.restore();
}

function drawParticles() {
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (const p of particles) {
    const a = clamp(p.life / p.max, 0, 1);
    if (p.type === 'ring') {
      ctx.strokeStyle = p.color; ctx.globalAlpha = a * .8;
      ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, 7); ctx.stroke();
    } else {
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (.4 + a * .8), 0, 7); ctx.fill();
      if (p.size > 2.3) {
        ctx.globalAlpha = a * .3;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * 2.2, 0, 7); ctx.fill();
      }
    }
  }
  ctx.restore();
}

function drawTopHUD() {
  if (mode === 'title') return;
  const pName = gameMode === 'local' ? 'P1' : '你';
  const aName = gameMode === 'local' ? 'P2' : `霜影 · ${profile.label}`;
  ctx.save();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  // pill
  ctx.fillStyle = 'rgba(6,12,29,.78)';
  rr(ctx, 304, 9, 292, 58, 18); ctx.fill();
  ctx.strokeStyle = 'rgba(223,176,99,.55)'; ctx.lineWidth = 1.2;
  rr(ctx, 304, 9, 292, 58, 18); ctx.stroke();
  ctx.strokeStyle = 'rgba(143,238,255,.23)'; ctx.lineWidth = 1;
  rr(ctx, 307, 12, 286, 52, 15); ctx.stroke();

  ctx.font = '600 11px "Microsoft YaHei",sans-serif';
  ctx.fillStyle = 'rgba(178,241,255,.85)';
  ctx.fillText(pName, 363, 23);
  ctx.fillStyle = 'rgba(224,196,255,.82)';
  ctx.fillText(aName, 537, 23);
  ctx.font = '700 30px "Segoe UI","Microsoft YaHei",sans-serif';
  ctx.fillStyle = '#a9f7ff';
  ctx.shadowColor = 'rgba(84,220,255,.8)'; ctx.shadowBlur = 12;
  ctx.fillText(String(playerScore), 363, 45);
  ctx.fillStyle = '#e3c5ff';
  ctx.shadowColor = 'rgba(190,130,255,.7)';
  ctx.fillText(String(aiScore), 537, 45);
  ctx.shadowBlur = 0;
  ctx.font = '600 12px "Segoe UI",sans-serif';
  ctx.fillStyle = 'rgba(238,218,178,.6)';
  ctx.fillText(':', 450, 45);
  ctx.font = '600 10px "Microsoft YaHei",sans-serif';
  ctx.fillStyle = 'rgba(220,210,190,.62)';
  ctx.fillText(fmtTime(matchTime), 450, 25);
  ctx.fillText('先到 7 分', 450, 55);

  ctx.textAlign = 'left';
  ctx.font = '700 14px "Microsoft YaHei",sans-serif';
  ctx.fillStyle = 'rgba(224,244,255,.9)';
  ctx.fillText('霜锋冰球', 54, 25);
  ctx.font = '600 8px "Segoe UI",sans-serif';
  ctx.fillStyle = 'rgba(152,215,231,.55)';
  ctx.fillText('FROSTPUCK ARENA', 55, 40);
  ctx.font = '10px "Microsoft YaHei",sans-serif';
  ctx.fillStyle = 'rgba(221,185,116,.7)';
  ctx.fillText(gameMode === 'local' ? '本地双人' : `单人 · ${profile.label}`, 55, 58);
  ctx.restore();
}

function drawPhaseOverlay() {
  if (mode !== 'play') return;
  if (paused) {
    ctx.save();
    ctx.fillStyle = 'rgba(4,9,22,.62)'; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '700 46px "Microsoft YaHei",sans-serif';
    ctx.fillStyle = '#dffbff'; ctx.shadowColor = 'rgba(93,230,255,.8)'; ctx.shadowBlur = 22;
    ctx.fillText('已 暂 停', W / 2, H / 2 - 16);
    ctx.shadowBlur = 0;
    ctx.font = '14px "Microsoft YaHei",sans-serif';
    ctx.fillStyle = 'rgba(221,204,176,.82)';
    ctx.fillText('按 P 或点按右上角继续', W / 2, H / 2 + 36);
    ctx.restore();
    return;
  }
  if (phase === 'faceoff') {
    const n = Math.max(1, Math.ceil(countdown));
    const frac = countdown - Math.floor(countdown);
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(5,12,26,.18)';
    ctx.beginPath(); ctx.arc(W / 2, MID_Y, 74 + frac * 4, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(171,244,255,.4)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(W / 2, MID_Y, 63, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - frac)); ctx.stroke();
    ctx.font = '800 76px "Segoe UI","Microsoft YaHei",sans-serif';
    ctx.fillStyle = '#f2ffff'; ctx.shadowColor = 'rgba(88,226,255,.9)'; ctx.shadowBlur = 28;
    ctx.fillText(String(n), W / 2, MID_Y - 6);
    ctx.shadowBlur = 0;
    ctx.font = '600 14px "Microsoft YaHei",sans-serif';
    ctx.fillStyle = 'rgba(214,240,255,.78)';
    ctx.fillText(noAuto ? '准备开球' : '准备开球 · 拖动下方球拍', W / 2, MID_Y + 60);
    ctx.restore();
    return;
  }
  if (phase === 'goal') {
    const mine = lastScorer === 'p1';
    const color = mine ? '#a9f8ff' : '#ffc98c';
    const accent = mine ? 'rgba(116,235,255,' : 'rgba(255,183,103,';
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.globalAlpha = clamp(goalT / .32, 0, 1);
    ctx.fillStyle = 'rgba(4,10,23,.56)';
    rr(ctx, W / 2 - 202, MID_Y - 77, 404, 142, 22); ctx.fill();
    ctx.strokeStyle = accent + '.55)'; ctx.lineWidth = 1.4;
    rr(ctx, W / 2 - 202, MID_Y - 77, 404, 142, 22); ctx.stroke();
    ctx.strokeStyle = accent + '.20)'; ctx.lineWidth = 1;
    rr(ctx, W / 2 - 197, MID_Y - 72, 394, 132, 19); ctx.stroke();
    ctx.font = '800 52px "Microsoft YaHei",sans-serif';
    ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = 30;
    ctx.fillText('进 球', W / 2, MID_Y - 24);
    ctx.shadowBlur = 0;
    ctx.font = '600 16px "Microsoft YaHei",sans-serif';
    ctx.fillStyle = 'rgba(245,241,226,.95)';
    ctx.fillText(mine ? '你的球拍撕开防线' : (gameMode === 'local' ? 'P2 得分' : '霜影扳回一城'), W / 2, MID_Y + 34);
    ctx.restore();
  }
  if (rallyBannerT > 0 && phase === 'live') {
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.globalAlpha = clamp(rallyBannerT / .5, 0, 1);
    ctx.font = '700 24px "Microsoft YaHei",sans-serif';
    ctx.fillStyle = '#e6ffff'; ctx.shadowColor = 'rgba(100,235,255,.7)'; ctx.shadowBlur = 16;
    ctx.fillText('开 球', W / 2, MID_Y - 108);
    ctx.restore();
  }
}

function render() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.clearRect(0, 0, cv.width, cv.height);
  ctx.save();
  const sh = shakeT > 0 ? (shakeT / Math.max(.001, shakeDur)) : 0;
  const sx = Math.sin(animT * 91) * shakeAmp * sh;
  const sy = Math.cos(animT * 77) * shakeAmp * sh * .7;
  ctx.translate(viewOX + sx * viewScale, viewOY + sy * viewScale);
  ctx.scale(viewScale, viewScale);

  ctx.drawImage(bgCv, 0, 0, W, H);
  drawAurora(animT);
  drawGoalGlow(animT);

  if (mode !== 'title') {
    drawTrails();
    drawPaddle(p2, 'top', gameMode === 'local');
    drawPaddle(p1, 'bottom', false);
    drawPuck();
    drawParticles();
    drawTopHUD();
    drawPhaseOverlay();
  } else {
    drawTitleArena();
    drawParticles();
  }

  if (flashT > 0) {
    ctx.fillStyle = `rgba(224,250,255,${flashT * .38})`;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.restore();
}
function drawTitleArena() {
  // slow ceremonial drift behind the title menu
  const t = animT;
  const demoPuck = { x: W / 2 + Math.sin(t * .55) * 70, y: MID_Y + Math.cos(t * .43) * 38, r: PUCK_R, rot: t * .5 };
  const demoL = { x: W / 2 + Math.sin(t * .55 + .8) * 55, y: TABLE.y + TABLE.h - 94 - Math.sin(t * .6) * 10 };
  const demoR = { x: W / 2 + Math.sin(t * .55 + 2.6) * 52, y: TABLE.y + 94 + Math.cos(t * .5) * 10 };
  ctx.save();
  ctx.globalAlpha = .75;
  const saveP = { x: puck.x, y: puck.y, vx: puck.vx, vy: puck.vy, rot: puck.rot, r: puck.r };
  const save1 = { x: p1.x, y: p1.y }, save2 = { x: p2.x, y: p2.y };
  puck.x = demoPuck.x; puck.y = demoPuck.y; puck.rot = demoPuck.rot;
  p1.x = demoL.x; p1.y = demoL.y; p2.x = demoR.x; p2.y = demoR.y;
  drawPaddle(p2, 'top', false);
  drawPaddle(p1, 'bottom', false);
  drawPuck();
  puck.x = saveP.x; puck.y = saveP.y; puck.rot = saveP.rot; puck.vx = saveP.vx; puck.vy = saveP.vy;
  p1.x = save1.x; p1.y = save1.y; p2.x = save2.x; p2.y = save2.y;
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

// ==================== DOM wiring ====================
function bindUi() {
  titleEl.classList.remove('hide');
  endEl.classList.add('hide');
  updateTitleBest();
  updateMuteButton();
  updatePauseButton();

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
  const d = parseInt(URLP.get('difficulty') || '2', 10);
  startMatch('ai', d);
}

// ==================== G debug hooks ====================
const G_API = {
  err: G.err,
  W, H, TABLE, GOAL_L, GOAL_R, PUCK_R, PAD_R, GOAL_SCORE,
  step: (n = 60, dt = DT) => { for (let i = 0; i < n; i++) { update(dt); render(); } },
  upd: (n = 30, dt = DT) => { for (let i = 0; i < n; i++) update(dt); },
  press: (...codes) => { for (const c of codes) { pressed.add(c); held.add(c); } },
  release: (...codes) => { for (const c of codes) held.delete(c); },
  drag: (x, y) => dragTo(x, y),
  setPaddle: (which, x, y) => {
    const isP2 = which === 'p2' || which === 'ai';
    const p = isP2 ? p2 : p1;
    p.x = finite(x, p.x); p.y = finite(y, p.y);
    clampPaddle(p, isP2 ? 'top' : 'bottom');
    p.tx = p.x; p.ty = p.y; p.vx = 0; p.vy = 0;
    if (isP2) { aiTx = p.x; aiTy = p.y; }
    return { x: p.x, y: p.y };
  },
  setPuck: (x, y, vx = 0, vy = 0) => {
    puck.x = finite(x, W / 2); puck.y = finite(y, MID_Y);
    puck.vx = finite(vx); puck.vy = finite(vy);
    puck.x = clamp(puck.x, TABLE.x + PUCK_R, TABLE.x + TABLE.w - PUCK_R);
    puck.y = clamp(puck.y, TABLE.y + PUCK_R, TABLE.y + TABLE.h - PUCK_R);
    trailPuck.length = 0;
    return { x: puck.x, y: puck.y, vx: puck.vx, vy: puck.vy };
  },
  setNoAuto: (v) => { noAuto = !!v; },
  setReportTarget: (fn) => { reportTarget = typeof fn === 'function' ? fn : null; },
  reportLog: () => reports.slice(),
  state: () => ({
    mode, phase, paused, gameMode,
    playerScore, aiScore, scores: [playerScore, aiScore], winner,
    best, matchTime: Math.round(matchTime * 1000) / 1000,
    countdown: Math.round(countdown * 1000) / 1000,
    goalT: Math.round(goalT * 1000) / 1000,
    noAuto, nan: nanFlag, particles: particles.length, lastScorer,
    ai: { diff: aiDiff, label: profile.label, speed: profile.speed, reaction: profile.reaction, predict: profile.predict, error: profile.error },
    puck: { x: puck.x, y: puck.y, vx: puck.vx, vy: puck.vy, r: puck.r, speed: Math.hypot(puck.vx, puck.vy) },
    p1: { x: p1.x, y: p1.y, vx: p1.vx, vy: p1.vy, r: p1.r, tx: p1.tx, ty: p1.ty },
    p2: { x: p2.x, y: p2.y, vx: p2.vx, vy: p2.vy, r: p2.r, tx: p2.tx, ty: p2.ty },
    muted: audio.isMuted(), audioCtx: audio.hasCtx(),
    reports: reports.length, bestKey: BEST_KEY,
  }),
  setMode: (m) => { if (m === 'title') { goTitle(); return true; } startMatch(m === 'local' ? 'local' : 'ai', aiDiff); return true; },
  setAI: (v) => { aiDiff = diffKey(v); profile = AI_PROFILES[aiDiff]; aiTimer = profile.reaction; aiSeed += .7; return { ...profile }; },
  setScore: (p, a) => {
    playerScore = clamp(parseInt(p, 10) || 0, 0, GOAL_SCORE);
    aiScore = clamp(parseInt(a, 10) || 0, 0, GOAL_SCORE);
    playerScore = Math.min(GOAL_SCORE, playerScore); aiScore = Math.min(GOAL_SCORE, aiScore);
    return [playerScore, aiScore];
  },
  setPhase: (p) => {
    if (p === 'live') { startRally(); return true; }
    if (p === 'faceoff') { setupFaceoff(COUNTDOWN_GOAL); return true; }
    if (p === 'goal') { phase = 'goal'; goalT = GOAL_HOLD; return true; }
    if (p === 'over') { phase = 'over'; return true; }
    return false;
  },
  startRally,
  startMatch,
  forceWin,
  forceFail,
  goTitle,
  setMuted: (v) => { audio.setMuted(!!v); muted = !!v; updateMuteButton(); },
  toggleMute,
  audio,
  aiProfiles: () => JSON.parse(JSON.stringify(AI_PROFILES)),
  view: () => ({ scale: viewScale, ox: viewOX, oy: viewOY, dpr: DPR, w: window.innerWidth, h: window.innerHeight }),
  particlesList: () => particles.slice(),
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
  const savedBest = best;
  const savedMuted = muted;
  let savedLSBest = null, savedLSMute = null;
  try { savedLSBest = localStorage.getItem(BEST_KEY); savedLSMute = localStorage.getItem(MUTE_KEY); } catch (e) { }
  muted = true;
  audio.setMuted(true);
  updateMuteButton();
  const frames = [];
  G_API.setReportTarget(f => frames.push(f));

  try {
    await nap();

    // 1 — clean boot
    ok(1, G_API.err.length === 0 && !nanFlag, `启动零报错 errors=${G_API.err.length}`);

    // deterministic match start
    G_API.startMatch('ai', 2);
    G_API.startRally();

    // 2 — no NaN / outside-rink positions during a fast stress run
    let finiteOk = true, inside = true;
    for (let k = 0; k < 6; k++) {
      G_API.startRally();
      G_API.setPaddle('p1', 420, 430);
      G_API.setPaddle('p2', 520, 150);
      G_API.setPuck(180 + k * 80, 160 + k * 30, (k % 2 ? -1 : 1) * 1300, (k % 3 ? 1 : -1) * 900);
      R(60);
      const s = S();
      for (const val of [s.puck.x, s.puck.y, s.puck.vx, s.puck.vy, s.p1.x, s.p1.y, s.p2.x, s.p2.y, s.matchTime]) {
        if (!Number.isFinite(val)) finiteOk = false;
      }
      if (s.phase !== 'goal' && (s.puck.x < TABLE.x + PUCK_R - .5 || s.puck.x > TABLE.x + TABLE.w - PUCK_R + .5 ||
          s.puck.y < TABLE.y + PUCK_R - .5 || s.puck.y > TABLE.y + TABLE.h - PUCK_R + .5)) inside = false;
    }
    ok(2, finiteOk && inside && !S().nan, '高压 360 帧无 NaN 且球始终在界内');

    // 3 — wall reflection math
    G_API.startMatch('ai', 1);
    G_API.startRally();
    G_API.setPaddle('p1', 750, 430);
    G_API.setPaddle('p2', 680, 140);
    G_API.setPuck(TABLE.x + PUCK_R + 1.5, MID_Y, -700, 0);
    R(5);
    {
      const s = S();
      ok(3, s.puck.vx > 0 && s.puck.x >= TABLE.x + PUCK_R - .5, `左墙反弹 vx=-700→${s.puck.vx.toFixed(0)}`);
    }

    // 4 — paddle-strike direction (a rising paddle below the puck sends it up)
    G_API.startRally();
    G_API.setPaddle('p2', 730, 120);
    G_API.setPaddle('p1', 450, 430);
    G_API.setPuck(450, 365, 0, 0);
    G_API.press('KeyW');
    R(8);
    G_API.release('KeyW');
    ok(4, S().puck.vy < -40, `球拍击球方向 vy=${S().puck.vy.toFixed(0)}`);

    // 5 — friction
    G_API.startRally();
    G_API.setPaddle('p1', 740, 440);
    G_API.setPaddle('p2', 700, 120);
    G_API.setPuck(450, MID_Y, 340, 0);
    const v0 = S().puck.speed;
    R(60);
    const v1 = S().puck.speed;
    ok(5, v1 < v0 * .9 && v1 > 0, `摩擦减速 ${v0.toFixed(0)}→${v1.toFixed(0)}`);

    // 6 — goal detection in the mouth increments player score
    G_API.setScore(0, 0);
    G_API.startRally();
    G_API.setPaddle('p1', 760, 440);
    G_API.setPaddle('p2', 310, 130);
    G_API.setPuck(W / 2, TABLE.y + PUCK_R + 4, 0, -620);
    R(4);
    {
      const s = S();
      ok(6, s.playerScore === 1 && s.phase === 'goal' && s.lastScorer === 'p1', `上球门进球 player=${s.playerScore} phase=${s.phase}`);
    }

    // 7 — crossing outside the mouth bounces, no score (goal judge edge)
    G_API.startRally();
    G_API.setScore(0, 0);
    G_API.setPuck(220, TABLE.y + PUCK_R + 3, 0, -620);
    R(5);
    {
      const s = S();
      ok(7, s.playerScore === 0 && s.aiScore === 0 && s.puck.vy > 0, `门柱外反弹不进球 vy=${s.puck.vy.toFixed(0)}`);
    }

    // 7b — the opposite mouth gives the AI a point (symmetric judge)
    G_API.startRally();
    G_API.setScore(0, 0);
    G_API.setPaddle('p1', 760, 440);
    G_API.setPaddle('p2', 300, 130);
    G_API.setPuck(W / 2, TABLE.y + TABLE.h - PUCK_R - 4, 0, 620);
    R(4);
    {
      const s = S();
      ok('7b', s.aiScore === 1 && s.playerScore === 0 && s.lastScorer === 'p2' && s.phase === 'goal',
        `下球门进球 AI=${s.aiScore}`);
    }

    // 8 — score setter accepts increases and decreases
    G_API.setScore(5, 3);
    const hi = S();
    G_API.setScore(1, 0);
    const lo = S();
    ok(8, hi.playerScore === 5 && hi.aiScore === 3 && lo.playerScore === 1 && lo.aiScore === 0, '比分 setter 增减生效');
    G_API.setScore(0, 0);

    // 9 — failure path → gameOver
    frames.length = 0;
    G_API.startMatch('ai', 2);
    G_API.startRally();
    G_API.setScore(2, 6);
    G_API.forceFail();
    {
      const s = S();
      ok(9, s.mode === 'over' && s.aiScore === 7 && s.winner === 'p2' && frames.some(f => f.kind === 'gameOver'),
        `失败路径 mode=${s.mode} AI=${s.aiScore}`);
    }

    // 10 — victory path → complete
    frames.length = 0;
    G_API.startMatch('ai', 2);
    G_API.startRally();
    G_API.setScore(3, 2);
    G_API.forceWin();
    {
      const s = S();
      ok(10, s.mode === 'over' && s.playerScore === 7 && s.winner === 'p1' && frames.some(f => f.kind === 'complete'),
        `胜利路径 mode=${s.mode} player=${s.playerScore}`);
    }

    // 11 — report frame order ready → progress → gameOver / complete
    {
      const log = G_API.reportLog();
      const readyI = log.findIndex(f => f.kind === 'ready');
      const progressI = frames.findIndex(f => f.kind === 'progress');
      const completeI = frames.findIndex(f => f.kind === 'complete');
      ok(11, readyI === 0 && progressI >= 0 && completeI > progressI,
        `上报帧序 ready=${readyI} progress=${progressI} complete=${completeI}`);
    }

    // 12 — best write / read, then restore
    {
      best = 0;
      try { localStorage.removeItem(BEST_KEY); } catch (e) { }
      G_API.startMatch('ai', 1);
      G_API.startRally();
      R(3);
      G_API.forceWin();
      const stored = parseFloat(localStorage.getItem(BEST_KEY) || '0') || 0;
      const wrote = stored > 0 && Math.abs(stored - best) < .001;
      best = savedBest;
      try {
        if (savedLSBest === null) localStorage.removeItem(BEST_KEY);
        else localStorage.setItem(BEST_KEY, savedLSBest);
      } catch (e) { }
      ok(12, wrote && best === savedBest, `best 写入 ${stored.toFixed(2)}s / 已还原`);
    }

    // 13 — pointer drag moves the player paddle
    G_API.startMatch('ai', 1);
    G_API.startRally();
    G_API.setPaddle('p1', 450, 400);
    const dragX0 = S().p1.x;
    G_API.drag(250, 440);
    R(20);
    ok(13, S().p1.x < dragX0 - 130, `拖动输入 x ${dragX0.toFixed(0)}→${S().p1.x.toFixed(0)}`);

    // 14 — WASD keyboard moves P1
    G_API.startMatch('local', 1);
    G_API.startRally();
    G_API.setPaddle('p1', 450, 400);
    const kx0 = S().p1.x;
    G_API.press('KeyA');
    R(20);
    G_API.release('KeyA');
    ok(14, S().p1.x < kx0 - 100, `WASD 输入 x ${kx0.toFixed(0)}→${S().p1.x.toFixed(0)}`);

    // 15 — arrow keys move P2 in local mode
    G_API.setPaddle('p2', 450, 150);
    const k2x0 = S().p2.x;
    G_API.press('ArrowRight');
    R(20);
    G_API.release('ArrowRight');
    ok(15, S().p2.x > k2x0 + 100, `P2 方向键 x ${k2x0.toFixed(0)}→${S().p2.x.toFixed(0)}`);

    // 16 — local mode disables the AI and reports local mode
    {
      G_API.startMatch('local', 1);
      G_API.startRally();
      G_API.setPaddle('p2', 450, 150);
      const before = S().p2.x;
      R(20);
      const local = S();
      ok(16, local.gameMode === 'local' && Math.abs(S().p2.x - before) < 1, '本地双人模式 · AI 关闭');
    }

    // 17 — pause freezes the puck, resume advances it again
    G_API.startMatch('ai', 2);
    G_API.startRally();
    G_API.setPaddle('p1', 750, 430);
    G_API.setPaddle('p2', 680, 120);
    G_API.setPuck(W / 2, MID_Y, 300, 40);
    R(2);
    const pz = { x: S().puck.x, y: S().puck.y };
    G_API.press('KeyP');
    R(10);
    const pausedS = S();
    const frozen = pausedS.paused && Math.abs(pausedS.puck.x - pz.x) < .001 && Math.abs(pausedS.puck.y - pz.y) < .001;
    G_API.press('KeyP');
    R(12);
    const resumed = !S().paused && Math.abs(S().puck.x - pz.x) > .1;
    ok(17, frozen && resumed, `暂停冻结/恢复 paused=${pausedS.paused}`);

    // 18 — touch pointer binding moves P1
    G_API.startMatch('ai', 1);
    G_API.startRally();
    G_API.setPaddle('p1', 650, 400);
    {
      const v = G_API.view();
      const cx = v.ox + 250 * v.scale, cy = v.oy + 400 * v.scale;
      const ev = new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerType: 'touch', pointerId: 77, clientX: cx, clientY: cy });
      cv.dispatchEvent(ev);
      R(18);
      cv.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerType: 'touch', pointerId: 77, clientX: cx, clientY: cy }));
      ok(18, S().p1.x < 560, `触控球拍绑定 x=${S().p1.x.toFixed(0)}`);
    }

    // 19 — AI profiles differ measurably in all four dimensions
    {
      const a = G_API.aiProfiles();
      ok(19, a.easy.speed < a.medium.speed && a.medium.speed < a.hard.speed &&
        a.easy.reaction > a.medium.reaction && a.medium.reaction > a.hard.reaction &&
        a.easy.predict < a.medium.predict && a.medium.predict < a.hard.predict &&
        a.easy.error > a.medium.error && a.medium.error > a.hard.error,
        `AI 三档 speed ${a.easy.speed}/${a.medium.speed}/${a.hard.speed}`);
    }

    // 20 — hard AI actually covers more ground than easy AI in equal frames
    {
      const measure = (diff) => {
        G_API.startMatch('ai', diff);
        G_API.startRally();
        G_API.setPaddle('p1', 750, 440);
        G_API.setPaddle('p2', 450, TABLE.y + 72);
        G_API.setPuck(675, 188, 0, 0);
        const x0 = S().p2.x;
        R(30);
        return S().p2.x - x0;
      };
      const de = measure(1), dh = measure(3);
      ok(20, dh > de + 60, `AI 实移 hard ${dh.toFixed(0)}px > easy ${de.toFixed(0)}px`);
    }

    // 21 — difficulty setter updates live profile
    {
      G_API.startMatch('ai', 1);
      G_API.startRally();
      G_API.setAI(3);
      const s = S();
      ok(21, s.ai.diff === 'hard' && s.ai.speed === 620 && s.ai.reaction === 0.055, 'G.setAI 切换硬档生效');
    }

    // 22 — four title mode buttons exist and start the right mode
    {
      G_API.goTitle();
      const buttons = document.querySelectorAll('.modebtn');
      const titleVisible = !titleEl.classList.contains('hide');
      document.querySelector('.modebtn[data-mode="ai"][data-diff="3"]').click();
      const started = S();
      ok(22, buttons.length === 4 && titleVisible && started.mode === 'play' && started.gameMode === 'ai' && started.ai.diff === 'hard',
        `模式菜单 ${buttons.length} 项 / 硬档启动`);
    }

    // 23 — restart resets score, clock, puck and phase
    {
      G_API.setScore(4, 2);
      G_API.setPuck(220, 210, 400, -200);
      G_API.startMatch('ai', 2);
      const s = S();
      ok(23, s.playerScore === 0 && s.aiScore === 0 && s.phase === 'faceoff' && s.matchTime === 0 &&
        Math.abs(s.puck.x - W / 2) < .01 && Math.abs(s.puck.y - MID_Y) < .01 && s.winner === null,
        '重开一局状态复位');
    }

    // 24 — countdown actually decrements when noAuto is off
    {
      G_API.setNoAuto(false);
      G_API.startMatch('ai', 1);
      const c0 = S().countdown;
      R(30);
      const c1 = S().countdown;
      G_API.setNoAuto(true);
      ok(24, c1 < c0 && c0 > 0 && S().phase === 'faceoff', `开球倒计时 ${c0.toFixed(2)}→${c1.toFixed(2)}`);
    }

    // 25 — goal resets puck to centre and enters a new faceoff countdown
    {
      G_API.setNoAuto(false);
      G_API.startMatch('ai', 2);
      G_API.startRally();
      G_API.setPaddle('p1', 750, 440);
      G_API.setPaddle('p2', 300, 130);
      G_API.setPuck(W / 2, TABLE.y + PUCK_R + 4, 0, -620);
      R(4);
      const scored = S().phase === 'goal';
      R(105);
      const s = S();
      G_API.setNoAuto(true);
      ok(25, scored && s.phase === 'faceoff' && s.countdown > 0 &&
        Math.abs(s.puck.x - W / 2) < .01 && Math.abs(s.puck.y - MID_Y) < .01,
        `进球后开球复位 phase=${s.phase} cd=${s.countdown.toFixed(2)}`);
    }

    // 26 — full first-to-7 match fast-forwarded through real goal detection
    {
      G_API.setNoAuto(true);
      G_API.startMatch('ai', 3);
      G_API.startRally();
      G_API.setScore(0, 0);
      const err0 = G_API.err.length;
      for (let i = 0; i < 7; i++) {
        G_API.startRally();
        G_API.setPaddle('p1', 750, 440);
        G_API.setPaddle('p2', 300, 130);
        G_API.setPuck(W / 2, TABLE.y + PUCK_R + 4, 0, -720);
        R(4);
      }
      G_API.setNoAuto(false);
      R(120);
      G_API.setNoAuto(true);
      const s = S();
      const complete = frames.some(f => f.kind === 'complete');
      ok(26, s.mode === 'over' && s.playerScore === 7 && !s.nan && G_API.err.length === err0 && complete,
        `整局快进 mode=${s.mode} ${s.playerScore}:${s.aiScore} nan=${s.nan}`);
    }

    // 27 — audio is muted and no AudioContext was created during autotest
    ok(27, audio.isMuted() === true && audio.hasCtx() === false, '自测静音且未创建 AudioContext');

    // 28 — M key toggles mute both ways
    {
      const m0 = S().muted;
      G_API.press('KeyM'); R(1); G_API.release('KeyM');
      const m1 = S().muted;
      G_API.press('KeyM'); R(1); G_API.release('KeyM');
      const m2 = S().muted;
      ok(28, m1 !== m0 && m2 === m0, `M 键静音切换 ${m0}→${m1}→${m2}`);
    }

    // 29 — settlement has restart / difficulty / title controls
    {
      const go = document.getElementById('go');
      const change = document.getElementById('change');
      const home = document.getElementById('home');
      const visible = !endEl.classList.contains('hide');
      ok(29, !!go && !!change && !!home && visible, '结算面板：再来/换难度/回标题');
    }

    // 30 — back to title restores menu + best display
    {
      G_API.goTitle();
      const s = S();
      const titleVisible = !titleEl.classList.contains('hide');
      const endHidden = endEl.classList.contains('hide');
      ok(30, s.mode === 'title' && titleVisible && endHidden && /最快胜利|尚无胜绩/.test(bestEl.textContent), '测完回标题画面');
    }

    // 31 — DONE marker / minimum coverage
    ok(31, results.length >= 24, `断言覆盖 ${results.length} 条（≥24）`);

  } catch (err) {
    window.__TEST_ERR = String((err && err.stack) || err);
    T.fail++;
    results.push({ id: 'ERR', ok: false, name: `autotest crashed: ${window.__TEST_ERR}` });
    try { G_API.goTitle(); } catch (e) { }
  } finally {
    G_API.setReportTarget(null);
    G_API.setNoAuto(false);
    try {
      if (savedLSBest === null) localStorage.removeItem(BEST_KEY);
      else localStorage.setItem(BEST_KEY, savedLSBest);
      if (savedLSMute === null) localStorage.removeItem(MUTE_KEY);
      else localStorage.setItem(MUTE_KEY, savedLSMute);
    } catch (e) { }
    best = savedBest;
    muted = savedMuted;
    audio.setMuted(savedMuted);
    updateMuteButton();
    updateTitleBest();
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
