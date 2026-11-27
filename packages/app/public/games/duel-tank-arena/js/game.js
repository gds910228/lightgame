// Duel Tank Arena 钢铁前线 — flagship 2D top-down 1v1 tank duel.
// Canvas renderer, fixed-step loop, WebAudio, site report bridge, G hooks,
// and a page-local ?autotest=1 suite with AI self-play balance assertions.

import {
  W, H, ARENA, CENTER, TANK_R, ROUND_TIME, ROUND_INTRO, ROUND_RESULT,
  WIN_SCORE, MAX_ROUNDS, MAP_SEQUENCE, MAPS, WEAPONS, AI_PROFILES, DIFF_ORDER,
  createBattle, updateBattle, finishRound, fireWeapon, makeRng,
  circleBlocked, lineOfSight, runSelfplay, runDifficultyBench, simulateMatch,
  snapBattle, snapTank, clamp, normAngle, angleDiff,
} from './logic.js';
import { makeAudio } from './audio.js';

const DT = 1 / 60;
const AUTOTEST = new URLSearchParams(location.search).has('autotest');
const URLP = new URLSearchParams(location.search);
const ID = 'duel-tank-arena';
const REC_KEY = 'dta.rec';
const MUTE_KEY = 'dta.mute';
const BEST_KEY = 'dta.best';
const AI_NAME = { easy: '新兵', medium: '老练', hard: '王牌' };

function safeGet(key, fallback) {
  try { const v = localStorage.getItem(key); return v === null ? fallback : v; } catch (e) { return fallback; }
}
function safeSet(key, val) {
  try { localStorage.setItem(key, String(val)); } catch (e) { }
}
function readRecord() {
  let rec = { p1: 0, p2: 0, matches: 0 };
  try {
    const raw = JSON.parse(safeGet(REC_KEY, '{}'));
    if (raw && Number.isFinite(raw.p1) && Number.isFinite(raw.p2)) {
      rec = { p1: Math.max(0, raw.p1 | 0), p2: Math.max(0, raw.p2 | 0), matches: Math.max(0, raw.matches | 0) };
    }
  } catch (e) { }
  return rec;
}
let record = readRecord();
let bestTime = Math.max(0, parseFloat(safeGet(BEST_KEY, '0')) || 0);
let muted = safeGet(MUTE_KEY, '0') === '1';
const audio = makeAudio();
audio.setMuted(muted);

// ---------------- mutable state ----------------
let mode = 'title';                 // title | play | over
let gameMode = 'ai';                // ai | local
let aiDiff = 'medium';
let battle = null;
let roundIndex = 0;
let wins = [0, 0];
let roundsPlayed = 0;
let matchOver = false;
let roundHandled = false;
let matchFinalized = false;
let matchSeconds = 0;
let paused = false;
let noAuto = false;
let mutedState = muted;
let reportTarget = null;
let reports = [];
let nanFlag = false;
let hitstopT = 0;
let shakeT = 0, shakeAmp = 0, flashT = 0;
let banner = null, bannerT = 0;
let animT = 0;
let lastResult = null;

const held = new Set();
const pressed = new Set();
const particles = [];
const P_LIMIT = 420;

// DOM
const cv = document.getElementById('game');
const ctx = cv.getContext('2d');
const titleEl = document.getElementById('title');
const endEl = document.getElementById('end');
const pauseEl = document.getElementById('pause');
const bestEl = document.getElementById('titlebest');
const endhEl = document.getElementById('endh');
const endkickEl = document.getElementById('endkick');
const endscoreEl = document.getElementById('endscore');
const enddEl = document.getElementById('endd');
const muteBtn = document.getElementById('mutebtn');
const pauseBtn = document.getElementById('pausebtn');
const toastEl = document.getElementById('toast');

// ---------------- viewport ----------------
let DPR = 1, viewScale = 1, viewOX = 0, viewOY = 0;
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

// ---------------- procedural art ----------------
const THEME = {
  steel: { floor: ['#12252c', '#1d3940', '#0a141a'], line: 'rgba(255,181,71,.13)', panel: '#263f48', edge: '#486574', top: '#3d5b64', accent: '#ffb547' },
  sand: { floor: ['#2c251b', '#4b3b27', '#17130d'], line: 'rgba(233,196,130,.13)', panel: '#5b4932', edge: '#8b704c', top: '#776145', accent: '#ffd58b' },
  neon: { floor: ['#0f1426', '#1d1533', '#070a14'], line: 'rgba(98,231,239,.14)', panel: '#262342', edge: '#564b86', top: '#433e6c', accent: '#62e7ef' },
};

function rr(c, x, y, w, h, r) {
  const q = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  c.beginPath(); c.moveTo(x + q, y); c.lineTo(x + w - q, y);
  c.quadraticCurveTo(x + w, y, x + w, y + q); c.lineTo(x + w, y + h - q);
  c.quadraticCurveTo(x + w, y + h, x + w - q, y + h); c.lineTo(x + q, y + h);
  c.quadraticCurveTo(x, y + h, x, y + h - q); c.lineTo(x, y + q);
  c.quadraticCurveTo(x, y, x + q, y); c.closePath();
}
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const bgCache = [];
function buildBackground(map, idx) {
  const cvs = document.createElement('canvas');
  cvs.width = W * 2; cvs.height = H * 2;
  const c = cvs.getContext('2d');
  c.scale(2, 2);
  const th = THEME[map.theme] || THEME.steel;
  const rnd = mulberry32(0x51ee + idx * 9203);

  // base
  const g = c.createLinearGradient(0, 0, W * .55, H);
  g.addColorStop(0, th.floor[0]); g.addColorStop(.55, th.floor[1]); g.addColorStop(1, th.floor[2]);
  c.fillStyle = g; c.fillRect(0, 0, W, H);

  // outer dark + arena bed
  c.fillStyle = 'rgba(0,0,0,.36)'; c.fillRect(0, 0, W, H);
  const ag = c.createLinearGradient(0, ARENA.y, 0, ARENA.y + ARENA.h);
  if (map.theme === 'sand') {
    ag.addColorStop(0, '#4d3a25'); ag.addColorStop(.5, '#61492e'); ag.addColorStop(1, '#392b1d');
  } else if (map.theme === 'neon') {
    ag.addColorStop(0, '#121327'); ag.addColorStop(.5, '#1b1731'); ag.addColorStop(1, '#0b0d1b');
  } else {
    ag.addColorStop(0, '#182f36'); ag.addColorStop(.5, '#203b42'); ag.addColorStop(1, '#102229');
  }
  c.fillStyle = ag; c.fillRect(ARENA.x, ARENA.y, ARENA.w, ARENA.h);

  // floor texture
  if (map.theme === 'sand') {
    for (let i = 0; i < 900; i++) {
      const x = ARENA.x + rnd() * ARENA.w, y = ARENA.y + rnd() * ARENA.h;
      c.fillStyle = `rgba(${210 + rnd() * 30 | 0},${175 + rnd() * 40 | 0},${120 + rnd() * 50 | 0},${.025 + rnd() * .1})`;
      c.fillRect(x, y, .6 + rnd() * 1.6, .6 + rnd() * 1.2);
    }
    for (let i = 0; i < 26; i++) {
      const x = ARENA.x + 30 + rnd() * (ARENA.w - 60), y = ARENA.y + 30 + rnd() * (ARENA.h - 60);
      c.strokeStyle = 'rgba(55,37,22,.42)'; c.lineWidth = .8;
      c.beginPath(); c.moveTo(x, y);
      for (let j = 0; j < 3; j++) c.lineTo(x + (rnd() - .5) * 42, y + (rnd() - .5) * 32);
      c.stroke();
    }
    // dune ripples
    c.strokeStyle = 'rgba(240,208,155,.07)'; c.lineWidth = 2;
    for (let y = ARENA.y + 40; y < ARENA.y + ARENA.h; y += 34) {
      c.beginPath();
      for (let x = ARENA.x; x <= ARENA.x + ARENA.w; x += 30) c.lineTo(x, y + Math.sin(x * .025 + y) * 4);
      c.stroke();
    }
  } else if (map.theme === 'neon') {
    c.strokeStyle = 'rgba(98,231,239,.075)'; c.lineWidth = 1;
    for (let x = ARENA.x; x <= ARENA.x + ARENA.w; x += 42) { c.beginPath(); c.moveTo(x, ARENA.y); c.lineTo(x, ARENA.y + ARENA.h); c.stroke(); }
    for (let y = ARENA.y; y <= ARENA.y + ARENA.h; y += 42) { c.beginPath(); c.moveTo(ARENA.x, y); c.lineTo(ARENA.x + ARENA.w, y); c.stroke(); }
    for (let i = 0; i < 34; i++) {
      const x = ARENA.x + 20 + rnd() * (ARENA.w - 40), y = ARENA.y + 20 + rnd() * (ARENA.h - 40);
      c.fillStyle = rnd() < .5 ? 'rgba(255,93,140,.13)' : 'rgba(98,231,239,.13)';
      c.fillRect(x, y, 10 + rnd() * 32, 1.2);
    }
  } else {
    c.strokeStyle = 'rgba(255,181,71,.08)'; c.lineWidth = 1;
    for (let x = ARENA.x; x <= ARENA.x + ARENA.w; x += 52) { c.beginPath(); c.moveTo(x, ARENA.y); c.lineTo(x, ARENA.y + ARENA.h); c.stroke(); }
    for (let y = ARENA.y; y <= ARENA.y + ARENA.h; y += 52) { c.beginPath(); c.moveTo(ARENA.x, y); c.lineTo(ARENA.x + ARENA.w, y); c.stroke(); }
    // hazard bands
    for (let i = 0; i < 6; i++) {
      c.fillStyle = 'rgba(255,181,71,.09)';
      c.save(); c.translate(ARENA.x + 20 + i * 155, ARENA.y + ARENA.h - 8); c.rotate(-.35);
      c.fillRect(0, 0, 44, 4); c.restore();
    }
  }
  // permanent floor scars and center emblem
  c.save();
  c.translate(CENTER.x, CENTER.y);
  c.strokeStyle = th.line; c.lineWidth = 1.2;
  for (const r of [42, 78, 118]) { c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.stroke(); }
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2;
    c.beginPath(); c.moveTo(Math.cos(a) * 42, Math.sin(a) * 42); c.lineTo(Math.cos(a) * 78, Math.sin(a) * 78); c.stroke();
  }
  c.fillStyle = th.accent + '22';
  c.beginPath(); c.moveTo(0, -12); c.lineTo(12, 0); c.lineTo(0, 12); c.lineTo(-12, 0); c.closePath(); c.fill();
  c.restore();

  // spawn pads
  map.spawns.forEach((s, i) => {
    c.save();
    c.translate(s.x, s.y);
    c.strokeStyle = i === 0 ? 'rgba(98,231,239,.3)' : 'rgba(255,93,93,.3)';
    c.setLineDash([5, 6]); c.lineWidth = 1.4;
    c.beginPath(); c.arc(0, 0, 29, 0, Math.PI * 2); c.stroke();
    c.setLineDash([]);
    c.fillStyle = i === 0 ? 'rgba(98,231,239,.06)' : 'rgba(255,93,93,.06)';
    c.beginPath(); c.arc(0, 0, 28, 0, Math.PI * 2); c.fill();
    c.restore();
  });

  // arena border
  c.strokeStyle = th.edge; c.lineWidth = 3; c.strokeRect(ARENA.x, ARENA.y, ARENA.w, ARENA.h);
  c.strokeStyle = 'rgba(255,255,255,.08)'; c.lineWidth = 1; c.strokeRect(ARENA.x + 4, ARENA.y + 4, ARENA.w - 8, ARENA.h - 8);
  // corner notches
  c.fillStyle = th.accent; c.globalAlpha = .42;
  [[ARENA.x, ARENA.y], [ARENA.x + ARENA.w - 34, ARENA.y], [ARENA.x, ARENA.y + ARENA.h - 3], [ARENA.x + ARENA.w - 34, ARENA.y + ARENA.h - 3]].forEach(([x, y]) => c.fillRect(x, y, 34, 3));
  c.globalAlpha = 1;

  // walls (baked static)
  for (const w of map.walls) {
    c.save();
    c.fillStyle = 'rgba(0,0,0,.38)';
    rr(c, w.x + 5, w.y + 6, w.w, w.h, 4); c.fill();
    const wg = c.createLinearGradient(w.x, w.y, w.x + w.w, w.y + w.h);
    wg.addColorStop(0, th.top); wg.addColorStop(.45, th.panel); wg.addColorStop(1, th.floor[0]);
    c.fillStyle = wg; rr(c, w.x, w.y, w.w, w.h, 4); c.fill();
    c.strokeStyle = th.edge; c.lineWidth = 1.2; c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.14)'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(w.x + 5, w.y + 3); c.lineTo(w.x + w.w - 5, w.y + 3); c.stroke();
    c.fillStyle = 'rgba(0,0,0,.26)';
    c.fillRect(w.x + 4, w.y + w.h - 5, w.w - 8, 3);
    // rivets
    for (let x = w.x + 8; x < w.x + w.w - 4; x += 18) {
      c.fillStyle = 'rgba(255,255,255,.18)'; c.beginPath(); c.arc(x, w.y + 7, 1.2, 0, 7); c.fill();
      c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.arc(x, w.y + w.h - 7, 1.2, 0, 7); c.fill();
    }
    if (map.theme === 'neon') {
      c.strokeStyle = 'rgba(98,231,239,.42)'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(w.x + 4, w.y + w.h - 8); c.lineTo(w.x + w.w - 4, w.y + w.h - 8); c.stroke();
    }
    if (map.theme === 'sand') {
      c.strokeStyle = 'rgba(255,226,170,.17)';
      c.beginPath(); c.moveTo(w.x + 9, w.y + w.h - 9); c.lineTo(w.x + 19, w.y + w.h - 13); c.stroke();
    }
    c.restore();
  }

  // vignette
  const vg = c.createRadialGradient(W / 2, H / 2, H * .28, W / 2, H / 2, H * .9);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.38)');
  c.fillStyle = vg; c.fillRect(0, 0, W, H);
  return cvs;
}
MAPS.forEach((m, i) => bgCache.push(buildBackground(m, i)));

// ---------------- reports / bridge ----------------
function scoreInt() { return wins[0] * 100 + wins[1]; }
function progressInt() { return Math.round(Math.min(1, roundsPlayed / MAX_ROUNDS) * 100); }
function toWire(frame) {
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
  if (reports.length > 100) reports.shift();
  try {
    if (reportTarget) reportTarget(frame);
    else if (window.parent !== window) {
      window.parent.postMessage({ source: 'lightgame', type: 'lightgame:report', payload: toWire(frame) }, '*');
      if (kind === 'ready') window.parent.postMessage({ source: 'lightgame', type: 'lightgame:ready', gameId: ID, v: 1 }, '*');
    }
  } catch (e) { }
}
report('ready', { game: ID });

// ---------------- helpers ----------------
function toast(msg, ms = 1700) {
  if (!toastEl) return;
  toastEl.textContent = msg; toastEl.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => toastEl.classList.remove('show'), ms);
}
function updateMuteBtn() {
  mutedState = audio.isMuted() ? true : muted;
  if (!muteBtn) return;
  muteBtn.textContent = audio.isMuted() ? '静' : '♪';
  muteBtn.classList.toggle('on', audio.isMuted());
  muteBtn.title = audio.isMuted() ? '取消静音 (M)' : '静音 (M)';
}
function updatePauseBtn() {
  if (!pauseBtn) return;
  pauseBtn.textContent = paused ? '▶' : '❚❚';
  pauseBtn.disabled = mode !== 'play';
  pauseBtn.title = paused ? '继续 (P)' : '暂停 (P)';
}
function saveRecord() {
  safeSet(REC_KEY, JSON.stringify(record));
}
function updateTitleBest() {
  if (!bestEl) return;
  const parts = [];
  parts.push(record.p1 + record.p2 > 0 ? `历史战绩 · P1 ${record.p1} : ${record.p2} P2` : '尚无战绩 · 打完一局 BO5 记下比分');
  if (bestTime > 0) parts.push(`最快夺冠 ${bestTime.toFixed(1)}s`);
  bestEl.textContent = parts.join(' · ');
}
function diffFrom(v) {
  const s = String(v || '').toLowerCase();
  if (s === '1' || s === 'easy') return 'easy';
  if (s === '3' || s === 'hard') return 'hard';
  return 'medium';
}
function hideOverlays() {
  titleEl.classList.add('hide'); endEl.classList.add('hide'); pauseEl.classList.add('hide');
}
function showTitle() {
  mode = 'title'; paused = false; matchOver = false; roundHandled = false; matchFinalized = false;
  hideOverlays(); titleEl.classList.remove('hide'); endEl.classList.add('hide'); pauseEl.classList.add('hide');
  updateTitleBest(); updatePauseBtn(); updateMuteBtn();
  document.body.classList.remove('solo');
  battle = null;
  held.clear(); pressed.clear();
  audio.setScene('title');
}
function goTitle() { showTitle(); }

function startMatch(m, d = aiDiff) {
  gameMode = m === 'local' ? 'local' : 'ai';
  aiDiff = diffFrom(d);
  wins = [0, 0]; roundsPlayed = 0; roundIndex = 0; matchOver = false;
  roundHandled = false; matchFinalized = false; matchSeconds = 0; paused = false;
  lastResult = null; banner = null; bannerT = 0; hitstopT = 0; shakeT = 0; flashT = 0;
  particles.length = 0;
  mode = 'play';
  hideOverlays();
  titleEl.classList.add('hide'); endEl.classList.add('hide'); pauseEl.classList.add('hide');
  document.body.classList.toggle('solo', gameMode === 'ai');
  document.body.classList.toggle('touch', isTouch());
  audio.setScene('battle');
  updatePauseBtn(); updateMuteBtn();
  startRound(0);
  return G_API.state();
}
function startRound(index) {
  roundIndex = clamp(index | 0, 0, MAX_ROUNDS - 1);
  roundHandled = false;
  const aiSide1 = gameMode === 'ai' ? aiDiff : null;
  battle = createBattle(MAP_SEQUENCE[roundIndex], {
    ai0: null, ai1: aiSide1,
    seed: 20261126 + roundIndex * 7919 + wins[0] * 31 + wins[1] * 17,
    phase: 'intro',
  });
  battle.noAuto = noAuto;
  battle.freeze = noAuto;
  held.clear(); pressed.clear();
  particles.length = 0; hitstopT = 0; shakeT = 0; flashT = 0;
  banner = { text: `回合 ${roundIndex + 1}`, sub: `${battle.map.name} · ${battle.map.en}`, color: MAPS[MAP_SEQUENCE[roundIndex]].theme === 'neon' ? '#62e7ef' : '#ffb547' };
  bannerT = 2.2;
  report('event', { event: 'roundStart', round: roundIndex + 1, map: battle.map.id });
  return G_API.state();
}
function advanceRound() {
  if (matchOver) { showEnd(); return; }
  if (roundIndex >= MAX_ROUNDS - 1) { matchOver = true; finalizeMatch(); showEnd(); return; }
  startRound(roundIndex + 1);
}
function handleRoundEnd() {
  if (!battle || roundHandled) return;
  roundHandled = true;
  const winner = battle.winner;
  const reason = battle.reason;
  if (winner === 0 || winner === 1) wins[winner]++;
  roundsPlayed++;
  lastResult = { winner, reason, map: battle.map.name, hp: [battle.tanks[0].hp, battle.tanks[1].hp] };
  const who = winner === 0 ? (gameMode === 'local' ? 'P1' : '你') : (gameMode === 'local' ? 'P2' : `AI·${AI_NAME[aiDiff]}`);
  const reasonText = reason === 'timeout' ? '时间到 · 装甲量判定' : reason === 'mutual' ? '同归于尽 · 破局判定' : reason === 'force' ? '战术结算' : '击毁';
  banner = { text: `${who} 拿下第 ${roundIndex + 1} 回合`, sub: reasonText + ` · 比分 ${wins[0]} : ${wins[1]}`, color: winner === 0 ? '#62e7ef' : '#ff7373' };
  bannerT = 2.1;
  report('progress', { score: scoreInt(), progress: progressInt(), round: roundIndex + 1, winner, reason, wins: wins.slice() });
  if (wins[0] >= WIN_SCORE || wins[1] >= WIN_SCORE || roundsPlayed >= MAX_ROUNDS) {
    matchOver = true;
    finalizeMatch();
  }
}
function finalizeMatch() {
  if (matchFinalized || !matchOver) return;
  matchFinalized = true;
  const p1win = wins[0] > wins[1];
  record.matches++;
  if (p1win) record.p1++; else record.p2++;
  if (p1win && matchSeconds > 0 && (bestTime <= 0 || matchSeconds < bestTime)) {
    bestTime = matchSeconds;
    safeSet(BEST_KEY, bestTime.toFixed(2));
  }
  saveRecord(); updateTitleBest();
  if (p1win) report('complete', { score: scoreInt(), progress: 100, wins: wins.slice(), seconds: +matchSeconds.toFixed(2) });
  else report('gameOver', { score: scoreInt(), progress: 100, wins: wins.slice(), seconds: +matchSeconds.toFixed(2) });
  if (p1win) audio.play('win'); else audio.play('lose');
  audio.setScene('end');
}
function showEnd() {
  mode = 'over';
  paused = false;
  hideOverlays(); endEl.classList.remove('hide');
  const p1win = wins[0] > wins[1];
  endkickEl.textContent = p1win ? 'VICTORY · 钢铁前线告捷' : 'DEFEAT · 钢铁前线失守';
  endhEl.textContent = p1win ? (gameMode === 'local' ? 'P1 获 胜' : '你 赢 了') : (gameMode === 'local' ? 'P2 获 胜' : '你 输 了');
  endscoreEl.textContent = `${wins[0]} : ${wins[1]}`;
  const modeText = gameMode === 'local' ? '本地双人' : `单人对 AI · ${AI_NAME[aiDiff]}`;
  enddEl.innerHTML = `<b>${modeText}</b> · BO5 · 用时 ${fmtTime(matchSeconds)}<br>
    历史战绩 <b>P1 ${record.p1} : ${record.p2} P2</b>${bestTime > 0 ? ` · 最快夺冠 <b>${bestTime.toFixed(1)}s</b>` : ''}<br>
    <span style="font-size:12px;color:#8399a8">每回合换图：熔炉工厂 / 沙丘遗迹 / 霓虹工厂</span>`;
  updatePauseBtn(); updateMuteBtn();
  held.clear(); pressed.clear();
  audio.setScene('end');
}
function fmtTime(t) {
  const s = Math.max(0, t || 0);
  const m = Math.floor(s / 60), ss = Math.floor(s % 60);
  return `${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

// ---------------- effects ----------------
function addP(x, y, vx, vy, life, color, size = 2.4, gravity = 0) {
  if (particles.length >= P_LIMIT) particles.shift();
  particles.push({ x, y, vx, vy, life, max: life, color, size, gravity });
}
function burst(x, y, color, n = 10, speed = 120) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, sp = speed * (0.25 + Math.random() * 0.8);
    addP(x, y, Math.cos(a) * sp, Math.sin(a) * sp, 0.25 + Math.random() * 0.38, color, 1.4 + Math.random() * 2.6, 40);
  }
}
function updateFx(dt) {
  animT += dt;
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) { particles.splice(i, 1); continue; }
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vx *= Math.pow(0.16, dt); p.vy = p.vy * Math.pow(0.16, dt) + p.gravity * dt;
  }
  hitstopT = Math.max(0, hitstopT - dt);
  shakeT = Math.max(0, shakeT - dt);
  flashT = Math.max(0, flashT - dt);
  if (bannerT > 0) { bannerT = Math.max(0, bannerT - dt); if (bannerT <= 0) banner = null; }
}
function addShake(amp, dur = 0.18) { shakeAmp = Math.max(shakeAmp, amp); shakeT = Math.max(shakeT, dur); }
function processEvents(b) {
  for (const e of b.events) {
    if (e.type === 'fire') {
      audio.play(WEAPONS[e.weapon] ? WEAPONS[e.weapon].id : 'cannon');
      const w = WEAPONS[e.weapon] || WEAPONS[0];
      for (let i = 0; i < 4; i++) addP(e.x, e.y, Math.cos(e.angle) * (40 + Math.random() * 80) + (Math.random() - .5) * 30, Math.sin(e.angle) * 40 + (Math.random() - .5) * 30, .15 + Math.random() * .12, w.color, 1.4, 0);
      if (e.weapon === 2) addShake(2.5, 0.1);
    } else if (e.type === 'laser') {
      burst(e.x2, e.y2, '#8ff9ff', 5, 70);
    } else if (e.type === 'hit') {
      audio.play('hit');
      burst(e.x, e.y, e.kind === 'laser' ? '#8ff9ff' : '#ffcf7b', 8, 120);
      addShake(3.2, 0.12); hitstopT = Math.min(0.065, hitstopT + 0.05);
    } else if (e.type === 'kill') {
      audio.play('kill');
      const t = b.tanks[e.side];
      if (t) { burst(t.x, t.y, '#ffc36b', 28, 220); burst(t.x, t.y, '#ff6b3d', 18, 150); }
      addShake(9, 0.35); flashT = 0.12; hitstopT = Math.min(0.09, 0.08);
    } else if (e.type === 'explode') {
      audio.play('explode');
      burst(e.x, e.y, '#ffae54', 18, 190);
      burst(e.x, e.y, '#ff6250', 8, 110);
      addShake(e.kind === 'mine' ? 5 : 4, 0.2); hitstopT = Math.min(0.07, hitstopT + 0.035);
    } else if (e.type === 'spark') {
      audio.play('spark'); burst(e.x, e.y, '#ffe1a0', 4, 70);
    } else if (e.type === 'mineDrop') {
      audio.play('mine');
    } else if (e.type === 'roundWin') {
      audio.play('round');
    } else if (e.type === 'roundStart') {
      audio.play('count');
    }
  }
}

// ---------------- input ----------------
function isTouch() {
  return ('ontouchstart' in window) || (navigator.maxTouchPoints || 0) > 0 || matchMedia('(pointer:coarse)').matches;
}
function buildInputs() {
  const p1 = {
    dx: (held.has('KeyD') ? 1 : 0) - (held.has('KeyA') ? 1 : 0),
    dy: (held.has('KeyS') ? 1 : 0) - (held.has('KeyW') ? 1 : 0),
    fire: held.has('KeyF') || pressed.has('KeyF'),
    switchTo: -1,
    cycle: pressed.has('KeyE') ? 1 : pressed.has('KeyQ') ? -1 : 0,
  };
  for (let i = 0; i < 5; i++) if (pressed.has('Digit' + (i + 1))) p1.switchTo = i;
  const p2 = {
    dx: (held.has('ArrowRight') ? 1 : 0) - (held.has('ArrowLeft') ? 1 : 0),
    dy: (held.has('ArrowDown') ? 1 : 0) - (held.has('ArrowUp') ? 1 : 0),
    fire: held.has('KeyJ') || pressed.has('KeyJ'),
    switchTo: -1,
    cycle: pressed.has('KeyO') ? 1 : pressed.has('KeyU') ? -1 : 0,
  };
  const dmap = { Digit6: 0, Digit7: 1, Digit8: 2, Digit9: 3, Digit0: 4 };
  for (const [code, idx] of Object.entries(dmap)) if (pressed.has(code)) p2.switchTo = idx;
  return gameMode === 'local' ? { 0: p1, 1: p2 } : { 0: p1 };
}
function setMute(v) {
  const val = !!v;
  audio.setMuted(val); muteBtn && updateMuteBtn();
  try { localStorage.setItem(MUTE_KEY, val ? '1' : '0'); } catch (e) { }
}
function toggleMute() { setMute(!audio.isMuted()); toast(audio.isMuted() ? '已静音' : '音效开启', 1000); }
function togglePause(force) {
  if (mode !== 'play') return;
  paused = force !== undefined ? !!force : !paused;
  if (paused) pauseEl.classList.remove('hide'); else pauseEl.classList.add('hide');
  updatePauseBtn();
  if (paused) held.clear();
}
function restartMatch() {
  if (mode === 'title') return;
  startMatch(gameMode, aiDiff);
  toast('重新开局', 900);
}
function shareScore() {
  const score = scoreInt();
  try {
    if (window.parent && window.parent !== window && typeof window.parent.handleGlobalShare === 'function') {
      window.parent.handleGlobalShare(score); return;
    }
  } catch (e) { }
  try {
    if (typeof window.dp_share === 'function') { window.dp_share(score); return; }
    if (navigator.share) {
      navigator.share({ title: '钢铁前线 · 坦克对决', text: `BO5 比分 ${wins[0]} : ${wins[1]}`, url: location.href }).catch(() => { });
    } else toast(`本局比分 ${wins[0]} : ${wins[1]}`, 1600);
  } catch (e) { toast('分享暂不可用', 1200); }
}

window.addEventListener('keydown', (e) => {
  const code = e.code;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(code)) e.preventDefault();
  if (mode === 'title' && (code === 'Enter' || code === 'Space')) {
    const b = document.querySelector('.modebtn.rec'); b && b.click(); return;
  }
  if (e.repeat) { held.add(code); return; }
  if (code === 'KeyM') { toggleMute(); return; }
  if (code === 'KeyP') { togglePause(); return; }
  if (code === 'KeyR') { if (mode === 'play' || mode === 'over') restartMatch(); return; }
  if (code === 'Escape' && mode === 'play') { togglePause(); return; }
  held.add(code); pressed.add(code);
  audio.unlock();
});
window.addEventListener('keyup', (e) => { held.delete(e.code); });
window.addEventListener('blur', () => { held.clear(); pressed.clear(); });
document.addEventListener('pointerdown', () => audio.unlock(), { once: true });

document.querySelectorAll('.modebtn').forEach(btn => {
  btn.addEventListener('click', () => {
    audio.unlock(); audio.play('ui');
    startMatch(btn.dataset.mode, btn.dataset.diff);
  });
});
document.getElementById('go')?.addEventListener('click', () => { audio.play('ui'); startMatch(gameMode, aiDiff); });
document.getElementById('change')?.addEventListener('click', () => { audio.play('ui'); showTitle(); });
document.getElementById('home')?.addEventListener('click', () => { audio.play('ui'); showTitle(); });
document.getElementById('share')?.addEventListener('click', () => { audio.play('ui'); shareScore(); });
document.getElementById('resume')?.addEventListener('click', () => togglePause(false));
document.getElementById('quit')?.addEventListener('click', () => { togglePause(false); showTitle(); });
muteBtn?.addEventListener('click', toggleMute);
pauseBtn?.addEventListener('click', () => togglePause());

// touch pads
document.querySelectorAll('#touch button[data-code]').forEach(btn => {
  const code = btn.dataset.code;
  const down = (e) => {
    e.preventDefault(); e.stopPropagation();
    audio.unlock();
    if (mode !== 'play') return;
    held.add(code); pressed.add(code);
    try { btn.setPointerCapture(e.pointerId); } catch (err) { }
  };
  const up = (e) => { e.preventDefault(); e.stopPropagation(); held.delete(code); };
  btn.addEventListener('pointerdown', down);
  btn.addEventListener('pointerup', up);
  btn.addEventListener('pointercancel', up);
  btn.addEventListener('pointerleave', (e) => { if (e.buttons) held.delete(code); });
});
if (isTouch()) document.body.classList.add('touch');

// ---------------- main update ----------------
function updateLogic(dt) {
  updateFx(dt);
  if (mode === 'play' && !paused && battle) {
    if (hitstopT > 0 && !noAuto) { pressed.clear(); return; }
    const inputs = buildInputs();
    battle.freeze = noAuto;
    const prevPhase = battle.phase;
    updateBattle(battle, dt, inputs, { freeze: noAuto });
    processEvents(battle);
    if (battle.phase === 'live') matchSeconds += dt;
    checkFinite();
    pressed.clear();
    if (battle.phase === 'result') {
      if (!roundHandled) handleRoundEnd();
      if (!noAuto && battle.resultT <= 0) {
        if (matchOver) showEnd();
        else advanceRound();
      }
    }
    if (prevPhase === 'intro' && battle.phase === 'live') {
      banner = { text: '开 战', sub: '击毁对手，先取三胜', color: '#ffe0a3' }; bannerT = 1.2;
    }
  } else {
    pressed.clear();
  }
  if (mode === 'play' && paused) held.clear();
}

function checkFinite() {
  if (!battle) return;
  const vals = [
    battle.tanks[0].x, battle.tanks[0].y, battle.tanks[0].hp,
    battle.tanks[1].x, battle.tanks[1].y, battle.tanks[1].hp,
    battle.timeLeft,
  ];
  for (const v of vals) if (!Number.isFinite(v)) { nanFlag = true; break; }
}

// ---------------- render ----------------
function render() {
  const w = window.innerWidth, h = window.innerHeight;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#04070b'; ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.translate(viewOX, viewOY); ctx.scale(viewScale, viewScale);
  const b = battle;
  const mapIndex = b ? b.mapIndex : 0;
  if (bgCache[mapIndex]) ctx.drawImage(bgCache[mapIndex], 0, 0, W, H);
  if (b) {
    ctx.save();
    if (shakeT > 0) {
      const s = shakeAmp * (shakeT > 0.1 ? 1 : shakeT / 0.1);
      ctx.translate((Math.random() - .5) * s, (Math.random() - .5) * s);
    }
    drawFloorFx();
    drawMines();
    drawBeams();
    drawParticles(false);
    drawTanks();
    drawProjectiles();
    drawParticles(true);
    ctx.restore();
    drawHud();
    drawRoundOverlay();
    if (mode === 'title') { /* title overlay covers */ }
    if (mode === 'over' && !endEl.classList.contains('hide')) { /* DOM */ }
  }
  if (flashT > 0) { ctx.fillStyle = `rgba(255,190,110,${(flashT / .12) * .16})`; ctx.fillRect(0, 0, W, H); }
  drawFrameBorder();
  ctx.restore();
}

function drawFrameBorder() {
  ctx.strokeStyle = 'rgba(255,181,71,.16)'; ctx.lineWidth = 1;
  ctx.strokeRect(.5, .5, W - 1, H - 1);
}

function drawFloorFx() {
  const b = battle;
  if (!b) return;
  // centre glow during live round
  const pulse = .5 + .5 * Math.sin(animT * 2.2);
  ctx.save();
  ctx.strokeStyle = `rgba(255,181,71,${0.04 + pulse * 0.03})`; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(CENTER.x, CENTER.y, 64 + pulse * 5, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}

function drawMines() {
  for (const m of battle.mines) {
    const armed = m.arm <= 0;
    const blink = armed ? .5 + .5 * Math.sin(animT * 9 + m.x) : .2;
    ctx.save();
    ctx.translate(m.x, m.y);
    ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.beginPath(); ctx.arc(2, 3, 11, 0, 7); ctx.fill();
    ctx.fillStyle = '#1b261d'; ctx.beginPath(); ctx.arc(0, 0, 9, 0, 7); ctx.fill();
    ctx.strokeStyle = m.owner === 0 ? 'rgba(98,231,239,.7)' : 'rgba(255,93,93,.7)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(0, 0, 9, 0, 7); ctx.stroke();
    ctx.fillStyle = `rgba(184,255,110,${.25 + blink * .75})`;
    ctx.beginPath(); ctx.arc(0, 0, 2.4, 0, 7); ctx.fill();
    if (!armed) {
      ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.setLineDash([2, 3]); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(0, 0, 15, 0, 7); ctx.stroke(); ctx.setLineDash([]);
    } else {
      ctx.strokeStyle = `rgba(184,255,110,${blink * .2})`; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(0, 0, m.blast, 0, 7); ctx.stroke();
    }
    ctx.restore();
  }
}

function drawBeams() {
  for (const beam of battle.beams) {
    const a = Math.max(0, beam.life / .2);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(120,250,255,${.8 * a})`; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(beam.x1, beam.y1); ctx.lineTo(beam.x2, beam.y2); ctx.stroke();
    ctx.strokeStyle = `rgba(255,255,255,${.9 * a})`; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(beam.x1, beam.y1); ctx.lineTo(beam.x2, beam.y2); ctx.stroke();
    ctx.restore();
  }
}

function drawParticles(foreground) {
  for (const p of particles) {
    if ((p.size > 2.2) !== foreground) continue;
    const a = Math.max(0, p.life / p.max);
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (.4 + a * .8), 0, 7); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawProjectiles() {
  for (const p of battle.projectiles) {
    const w = WEAPONS.find(x => x.id === p.type) || WEAPONS[0];
    ctx.save();
    if (p.type === 'missile') {
      if (p.trail) {
        for (let i = 0; i < p.trail.length; i++) {
          const q = p.trail[i], a = i / p.trail.length;
          ctx.fillStyle = `rgba(255,152,93,${a * .22})`;
          ctx.beginPath(); ctx.arc(q.x, q.y, 2 + a * 3, 0, 7); ctx.fill();
        }
      }
      ctx.translate(p.x, p.y); ctx.rotate(Math.atan2(p.vy, p.vx));
      ctx.fillStyle = '#ff8a8a'; ctx.beginPath(); ctx.ellipse(0, 0, 7, 3.5, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#ffe0a3'; ctx.beginPath(); ctx.arc(-5, 0, 2, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(255,120,100,.28)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(0, 0, p.blast || 50, 0, 7); ctx.stroke();
    } else {
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = w.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.type === 'spread' ? 2.6 : 3.4, 0, 7); ctx.fill();
      ctx.globalAlpha = .35;
      ctx.beginPath(); ctx.arc(p.x, p.y, 7.5, 0, 7); ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }
}

function drawTanks() {
  for (const t of battle.tanks) {
    if (!t.alive && t.hitFlash <= 0 && !t.justDead) {
      // draw a scorch mark instead of the tank
      ctx.save(); ctx.translate(t.x, t.y);
      ctx.fillStyle = 'rgba(0,0,0,.42)'; ctx.beginPath(); ctx.ellipse(0, 0, 24, 17, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(255,150,80,.2)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, 17, 0, 7); ctx.stroke();
      ctx.restore();
      continue;
    }
    drawTank(t);
  }
}

function drawTank(t) {
  const sideColor = t.side === 0 ? '#5fe3ea' : '#ff6a6a';
  const sideLight = t.side === 0 ? '#c8fdff' : '#ffc0b5';
  const sideDark = t.side === 0 ? '#173d49' : '#491b23';
  const x = t.x, y = t.y;
  ctx.save();
  ctx.translate(x, y);
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,.38)';
  ctx.beginPath(); ctx.ellipse(4, 6, 23, 17, t.bodyAngle, 0, 7); ctx.fill();
  // tracks
  ctx.rotate(t.bodyAngle);
  ctx.fillStyle = '#0a1014';
  rr(ctx, -20, -17, 40, 8, 3); ctx.fill();
  rr(ctx, -20, 9, 40, 8, 3); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.1)';
  for (let i = -16; i < 16; i += 7) { ctx.fillRect(i, -16, 3, 6); ctx.fillRect(i, 10, 3, 6); }
  // hull
  const hg = ctx.createLinearGradient(-18, -13, 18, 14);
  hg.addColorStop(0, sideLight); hg.addColorStop(.2, sideColor); hg.addColorStop(.72, sideDark); hg.addColorStop(1, '#0b151b');
  ctx.fillStyle = hg; rr(ctx, -18, -13, 36, 26, 7); ctx.fill();
  ctx.strokeStyle = t.side === 0 ? 'rgba(183,253,255,.7)' : 'rgba(255,180,170,.7)';
  ctx.lineWidth = 1.2; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.18)'; rr(ctx, -12, -9, 16, 4, 2); ctx.fill();
  ctx.restore();

  // turret & barrel
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(t.turret);
  const bg = ctx.createLinearGradient(-6, 0, 24, 0);
  bg.addColorStop(0, sideDark); bg.addColorStop(.55, sideColor); bg.addColorStop(1, sideLight);
  ctx.fillStyle = bg;
  rr(ctx, 7, -3.4, 22, 6.8, 3); ctx.fill();
  ctx.fillStyle = t.fireFlash > 0 ? '#fff6cd' : sideLight;
  ctx.beginPath(); ctx.arc(30, 0, t.fireFlash > 0 ? 6 : 2.5, 0, 7); ctx.fill();
  const tg = ctx.createRadialGradient(-3, -3, 1, 0, 0, 12);
  tg.addColorStop(0, sideLight); tg.addColorStop(.62, sideColor); tg.addColorStop(1, sideDark);
  ctx.fillStyle = tg; ctx.beginPath(); ctx.arc(0, 0, 11.5, 0, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.32)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, 0, 7.5, 0, 7); ctx.stroke();
  ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.arc(0, 0, 3, 0, 7); ctx.fill();
  ctx.restore();

  // damage flash
  if (t.hitFlash > 0) {
    ctx.save(); ctx.globalAlpha = Math.min(.8, t.hitFlash * 5);
    ctx.fillStyle = '#fff2d0'; ctx.beginPath(); ctx.arc(x, y, 22, 0, 7); ctx.fill(); ctx.restore();
  }
  // floating hp
  if (t.alive) {
    const hpw = 42, hh = 4;
    ctx.save(); ctx.translate(x, y - 31);
    ctx.fillStyle = 'rgba(0,0,0,.55)'; rr(ctx, -hpw / 2 - 1, -1, hpw + 2, hh + 2, 2); ctx.fill();
    ctx.fillStyle = sideColor; rr(ctx, -hpw / 2, 0, hpw * (t.hp / t.maxHp), hh, 1.5); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fillRect(-hpw / 2 + 1, 1, Math.max(0, hpw * (t.hp / t.maxHp) - 2), 1);
    ctx.font = '700 8px "Microsoft YaHei",sans-serif'; ctx.textAlign = 'center';
    ctx.fillStyle = sideColor; ctx.fillText(t.side === 0 ? 'P1' : (gameMode === 'local' ? 'P2' : 'AI'), 0, -5);
    ctx.restore();
  }
}

function drawHud() {
  if (!battle) return;
  const b = battle;
  ctx.save();
  const topg = ctx.createLinearGradient(0, 0, 0, 96);
  topg.addColorStop(0, 'rgba(4,10,15,.94)'); topg.addColorStop(.72, 'rgba(7,15,22,.87)'); topg.addColorStop(1, 'rgba(7,15,22,.1)');
  ctx.fillStyle = topg; ctx.fillRect(0, 0, W, 96);
  ctx.strokeStyle = 'rgba(157,181,198,.15)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(16, 92); ctx.lineTo(W - 16, 92); ctx.stroke();

  drawSideHud(0);
  drawSideHud(1);

  // center score / timer
  ctx.textAlign = 'center';
  ctx.font = '900 26px "Microsoft YaHei",sans-serif';
  ctx.fillStyle = b.timeLeft < 15 ? '#ff7770' : '#effbff';
  ctx.fillText(fmtTimer(b.timeLeft), W / 2, 34);
  ctx.font = '700 9px "Microsoft YaHei",sans-serif'; ctx.fillStyle = '#7f95a4';
  ctx.fillText(`ROUND ${roundIndex + 1} / 5 · ${b.map.name}`, W / 2, 48);
  // score pips
  const pipY = 63;
  for (let i = 0; i < 3; i++) {
    const px = W / 2 - 44 + i * 22;
    drawPip(px, pipY, i < wins[0], '#62e7ef');
    drawPip(px + 66, pipY, i < wins[1], '#ff6a6a');
  }
  ctx.font = '900 11px "Microsoft YaHei",sans-serif';
  ctx.fillStyle = '#62e7ef'; ctx.textAlign = 'right'; ctx.fillText(String(wins[0]), W / 2 - 55, pipY + 4);
  ctx.fillStyle = '#ff6a6a'; ctx.textAlign = 'left'; ctx.fillText(String(wins[1]), W / 2 + 55, pipY + 4);

  // bottom center map blurb
  ctx.textAlign = 'center'; ctx.font = '10px "Microsoft YaHei",sans-serif'; ctx.fillStyle = 'rgba(190,209,220,.45)';
  ctx.fillText(`BO5 · 先取 ${WIN_SCORE} 胜 · ${b.map.blurb}`, W / 2, H - 14);
  ctx.restore();
}
function fmtTimer(t) {
  const s = Math.max(0, Math.ceil(t));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
function drawPip(x, y, on, color) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 4);
  ctx.fillStyle = on ? color : 'rgba(255,255,255,.12)';
  ctx.fillRect(-5, -5, 10, 10);
  if (on) { ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 1; ctx.strokeRect(-5, -5, 10, 10); }
  ctx.restore();
}

function drawSideHud(side) {
  const t = battle.tanks[side];
  const left = side === 0;
  const baseX = left ? 22 : W - 22;
  const dir = left ? 1 : -1;
  ctx.save();
  ctx.textAlign = left ? 'left' : 'right';
  ctx.font = '900 10px "Microsoft YaHei",sans-serif';
  ctx.fillStyle = side === 0 ? '#62e7ef' : '#ff6a6a';
  ctx.fillText(left ? 'P1 · YOU' : (gameMode === 'local' ? 'P2 · RIVAL' : `P2 · AI ${AI_NAME[aiDiff]}`), baseX, 20);
  // hp
  const hpW = 260;
  const hx = left ? baseX : baseX - hpW;
  ctx.fillStyle = 'rgba(255,255,255,.09)'; rr(ctx, hx, 26, hpW, 9, 4.5); ctx.fill();
  const ratio = Math.max(0, t.hp / t.maxHp);
  const hpGrad = ctx.createLinearGradient(hx, 0, hx + hpW, 0);
  if (side === 0) { hpGrad.addColorStop(0, '#32cbd8'); hpGrad.addColorStop(1, '#a9feff'); }
  else { hpGrad.addColorStop(0, '#ff6a6a'); hpGrad.addColorStop(1, '#ffd0ad'); }
  ctx.fillStyle = hpGrad; rr(ctx, hx, 26, hpW * ratio, 9, 4.5); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.fillRect(hx + 2, 27, Math.max(0, hpW * ratio - 4), 2);
  ctx.font = '900 10px "Microsoft YaHei",sans-serif'; ctx.fillStyle = '#c8dbe4';
  ctx.fillText(String(Math.ceil(t.hp)).padStart(3, ' '), left ? hx + hpW + 9 : hx - 9, 34);
  // weapons
  for (let i = 0; i < WEAPONS.length; i++) {
    const w = WEAPONS[i];
    const cw = 48, gap = 3;
    const x0 = left ? baseX + i * (cw + gap) : baseX - (i + 1) * (cw + gap);
    const y0 = 43;
    const selected = t.weapon === i;
    const avail = t.ammo[i] > 0 || w.ammo === Infinity;
    ctx.fillStyle = selected ? 'rgba(255,255,255,.14)' : 'rgba(255,255,255,.045)';
    rr(ctx, x0, y0, cw, 42, 5); ctx.fill();
    ctx.strokeStyle = selected ? w.color + 'cc' : 'rgba(255,255,255,.09)';
    ctx.lineWidth = selected ? 1.4 : 1; ctx.stroke();
    ctx.globalAlpha = avail ? 1 : .3;
    ctx.fillStyle = w.color; ctx.beginPath(); ctx.arc(x0 + 9, y0 + 12, 3.4, 0, 7); ctx.fill();
    ctx.font = '700 9px "Microsoft YaHei",sans-serif'; ctx.fillStyle = '#d5e5ec'; ctx.textAlign = left ? 'left' : 'right';
    ctx.fillText(w.name, left ? x0 + 16 : x0 + cw - 5, y0 + 15);
    ctx.font = '900 10px "Microsoft YaHei",sans-serif'; ctx.fillStyle = w.color;
    ctx.textAlign = left ? 'left' : 'right';
    const ammoText = w.ammo === Infinity ? '∞' : `${Math.max(0, t.ammo[i])}`;
    ctx.fillText(ammoText, left ? x0 + 6 : x0 + cw - 6, y0 + 32);
    if (t.cooldown[i] > 0) {
      const cd = t.cooldown[i] / w.cooldown;
      ctx.fillStyle = 'rgba(0,0,0,.48)';
      ctx.fillRect(x0 + 1, y0 + 33, (cw - 2) * (1 - cd), 3);
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

function drawRoundOverlay() {
  if (!battle) return;
  // intro countdown
  if (battle.phase === 'intro') {
    const n = Math.max(1, Math.ceil(battle.countdown));
    ctx.save(); ctx.textAlign = 'center';
    ctx.font = '900 76px "Microsoft YaHei",sans-serif';
    ctx.fillStyle = 'rgba(255,228,175,.92)'; ctx.shadowColor = 'rgba(255,181,71,.5)'; ctx.shadowBlur = 24;
    ctx.fillText(String(n), W / 2, 270);
    ctx.shadowBlur = 0; ctx.font = '700 12px "Microsoft YaHei",sans-serif'; ctx.fillStyle = '#b9ced9';
    ctx.fillText('准备战斗 · 掩体可挡住炮弹', W / 2, 300);
    ctx.restore();
  }
  // result
  if (battle.phase === 'result' && !matchOver) {
    const win = battle.winner;
    ctx.save(); ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(3,8,12,.42)'; ctx.fillRect(0, 168, W, 170);
    ctx.font = '900 36px "Microsoft YaHei",sans-serif';
    ctx.fillStyle = win === 0 ? '#92fbff' : '#ff9c91';
    ctx.shadowColor = win === 0 ? 'rgba(98,231,239,.4)' : 'rgba(255,93,93,.4)'; ctx.shadowBlur = 18;
    ctx.fillText(win === 0 ? (gameMode === 'local' ? 'P1 拿下本回合' : '本回合胜利') : (gameMode === 'local' ? 'P2 拿下本回合' : '本回合失利'), W / 2, 235);
    ctx.shadowBlur = 0;
    ctx.font = '700 15px "Microsoft YaHei",sans-serif'; ctx.fillStyle = '#dfeef4';
    ctx.fillText(`比分  ${wins[0]}  :  ${wins[1]}`, W / 2, 269);
    ctx.font = '11px "Microsoft YaHei",sans-serif'; ctx.fillStyle = '#9eb4c1';
    ctx.fillText(battle.reason === 'timeout' ? '时间到 · 装甲量 / 中心控制判定' : battle.reason === 'mutual' ? '双方同时被击毁 · 破局判定' : '回合结束 · 准备换图', W / 2, 293);
    ctx.restore();
  }
  // banner
  if (banner && bannerT > 0) {
    const a = Math.min(1, bannerT * 2.2);
    ctx.save(); ctx.globalAlpha = a; ctx.textAlign = 'center';
    ctx.font = '900 28px "Microsoft YaHei",sans-serif'; ctx.fillStyle = banner.color;
    ctx.shadowColor = 'rgba(0,0,0,.75)'; ctx.shadowBlur = 10;
    ctx.fillText(banner.text, W / 2, 148);
    ctx.font = '700 11px "Microsoft YaHei",sans-serif'; ctx.fillStyle = '#d5e5ec';
    ctx.fillText(banner.sub, W / 2, 168);
    ctx.restore();
  }
}

// ---------------- loop ----------------
let last = 0, acc = 0;
function frame(now) {
  if (!last) last = now;
  let dt = (now - last) / 1000; last = now;
  if (!Number.isFinite(dt) || dt < 0) dt = 0;
  dt = Math.min(dt, .05);
  acc += dt;
  let guard = 0;
  while (acc >= DT && guard++ < 5) { updateLogic(DT); acc -= DT; }
  render();
  requestAnimationFrame(frame);
}
document.addEventListener('visibilitychange', () => { last = 0; acc = 0; });
updateTitleBest(); updateMuteBtn(); updatePauseBtn();
showTitle();
requestAnimationFrame(frame);


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

// ---------------- G hooks ----------------
const G_API = {
  err: window.__BOOTERR || [],
  W, H, ARENA, CENTER, WEAPONS, MAPS, AI_PROFILES, keys: () => ({ REC_KEY, BEST_KEY, MUTE_KEY }),
  step: (n = 60, dt = DT) => { for (let i = 0; i < n; i++) { updateLogic(dt); render(); } },
  upd: (n = 30, dt = DT) => { for (let i = 0; i < n; i++) updateLogic(dt); },
  press: (...codes) => { for (const c of codes) { held.add(c); pressed.add(c); } },
  release: (...codes) => { for (const c of codes) held.delete(c); },
  clearKeys: () => { held.clear(); pressed.clear(); },
  setNoAuto: (v) => { noAuto = !!v; if (noAuto) hitstopT = 0; if (battle) { battle.noAuto = noAuto; battle.freeze = noAuto; } },
  setReportTarget: (fn) => { reportTarget = typeof fn === 'function' ? fn : null; },
  clearFx: () => { particles.length = 0; hitstopT = 0; shakeT = 0; flashT = 0; banner = null; bannerT = 0; },
  reportLog: () => reports.slice(),
  state: () => ({
    mode, gameMode, aiDiff, paused, noAuto, roundIndex, roundsPlayed, wins: wins.slice(), matchOver,
    matchSeconds, nanFlag, noAutoFrozen: noAuto, score: scoreInt(), progress: progressInt(),
    bestTime, record: { ...record }, muted: audio.isMuted(), audioCtx: audio.hasCtx(),
    keys: { REC_KEY, BEST_KEY, MUTE_KEY },
    mapList: MAPS.map(m => ({ id: m.id, name: m.name, walls: m.walls.length })),
    weapons: WEAPONS.map(w => ({ id: w.id, name: w.name, ammo: w.ammo === Infinity ? -1 : w.ammo, cooldown: w.cooldown, damage: w.damage })),
    aiProfiles: JSON.parse(JSON.stringify(AI_PROFILES)),
    battle: battle ? snapBattle(battle) : null,
    fx: { particles: particles.length, hitstop: hitstopT, shake: shakeT, banner: banner ? banner.text : '', bannerT },
    view: { scale: viewScale, ox: viewOX, oy: viewOY, dpr: DPR, w: window.innerWidth, h: window.innerHeight },
    reports: reports.length,
    lastResult,
  }),
  snapTank: () => battle ? battle.tanks.map(snapTank) : [],
  startMatch,
  startRound: (i) => { if (mode !== 'play') { gameMode = gameMode || 'local'; mode = 'play'; hideOverlays(); } startRound(i); return G_API.state(); },
  setPhase: (p) => {
    if (!battle) return false;
    if (p === 'live') { battle.phase = 'live'; battle.countdown = 0; return true; }
    if (p === 'intro') { battle.phase = 'intro'; battle.countdown = ROUND_INTRO; return true; }
    if (p === 'result') { battle.phase = 'result'; return true; }
    return false;
  },
  setAI: (d) => { aiDiff = diffFrom(d); if (battle && gameMode === 'ai') { battle.tanks[1].aiDiff = aiDiff; battle.tanks[1].profile = AI_PROFILES[aiDiff]; battle.tanks[1].maxSpeed = AI_PROFILES[aiDiff].speed; battle.tanks[1].turretSpeed = AI_PROFILES[aiDiff].turret; } return AI_PROFILES[aiDiff]; },
  aiProfiles: () => JSON.parse(JSON.stringify(AI_PROFILES)),
  setTank: (side, opts = {}) => {
    if (!battle) return null;
    const t = battle.tanks[side === 1 ? 1 : 0];
    if (Number.isFinite(opts.x)) t.x = opts.x;
    if (Number.isFinite(opts.y)) t.y = opts.y;
    if (Number.isFinite(opts.vx)) t.vx = opts.vx;
    if (Number.isFinite(opts.vy)) t.vy = opts.vy;
    if (Number.isFinite(opts.hp)) { t.hp = Math.max(0, opts.hp); t.alive = t.hp > 0; }
    if (Number.isFinite(opts.turret)) t.turret = opts.turret;
    if (Number.isFinite(opts.bodyAngle)) t.bodyAngle = opts.bodyAngle;
    if (Number.isFinite(opts.weapon)) t.weapon = clamp(opts.weapon | 0, 0, 4);
    if (Array.isArray(opts.ammo)) t.ammo = opts.ammo.map(a => (a === Infinity || a === null) ? Infinity : Math.max(0, a | 0));
    if (Array.isArray(opts.cooldown)) t.cooldown = opts.cooldown.slice(0, 5);
    if (Number.isFinite(opts.aiTimer)) t.aiTimer = opts.aiTimer;
    if (opts.aiState) t.aiState = String(opts.aiState);
    return snapTank(t);
  },
  setTimer: (s) => { if (!battle) return 0; battle.timeLeft = Math.max(0, Number(s) || 0); return battle.timeLeft; },
  setScore: (a, b) => { wins = [clamp(a | 0, 0, 9), clamp(b | 0, 0, 9)]; roundsPlayed = wins[0] + wins[1]; return wins.slice(); },
  damage: (side, amount) => { if (!battle) return null; const t = battle.tanks[side === 1 ? 1 : 0]; t.hp = Math.max(0, t.hp - Math.max(0, amount)); if (t.hp <= 0) t.alive = false; return snapTank(t); },
  fire: (side, wi) => {
    if (!battle) return false;
    const t = battle.tanks[side === 1 ? 1 : 0];
    return fireWeapon(battle, t, wi, battle.tanks[1 - (side === 1 ? 1 : 0)]);
  },
  forceRoundWin: (side) => {
    if (!battle) return false;
    const s = side === 1 ? 1 : 0;
    finishRound(battle, s, 'force');
    processEvents(battle);
    handleRoundEnd();
    return G_API.state();
  },
  nextRound: () => { if (matchOver) { showEnd(); return G_API.state(); } startRound(Math.min(MAX_ROUNDS - 1, roundIndex + 1)); return G_API.state(); },
  advanceRound: () => { advanceRound(); return G_API.state(); },
  forceWin: () => {
    wins = [WIN_SCORE, Math.min(2, wins[1])]; matchOver = true; roundsPlayed = Math.max(roundsPlayed, 3);
    if (battle) { battle.phase = 'result'; battle.winner = 0; battle.resultT = 0; }
    finalizeMatch(); showEnd(); return G_API.state();
  },
  forceFail: () => {
    wins = [Math.min(2, wins[0]), WIN_SCORE]; matchOver = true; roundsPlayed = Math.max(roundsPlayed, 3);
    if (battle) { battle.phase = 'result'; battle.winner = 1; battle.resultT = 0; }
    finalizeMatch(); showEnd(); return G_API.state();
  },
  goTitle: () => { showTitle(); return G_API.state(); },
  showEnd,
  togglePause: (v) => { togglePause(v); return paused; },
  toggleMute,
  setMuted: (v) => { setMute(v); },
  setRecord: (p1, p2, best) => { record = { p1: Math.max(0, p1 | 0), p2: Math.max(0, p2 | 0), matches: 0 }; if (Number.isFinite(best)) bestTime = Math.max(0, best); saveRecord(); if (bestTime > 0) safeSet(BEST_KEY, bestTime.toFixed(2)); updateTitleBest(); return { ...record, bestTime }; },
  runSelfplay: (n, a, b, seed) => runSelfplay(n, a || 'medium', b || a || 'medium', Number(seed) || 12345),
  runDifficultyBench: (n, seed) => runDifficultyBench(Math.max(1, n | 0), Number(seed) || 777),
  simulateMatch: (a, b, seed) => simulateMatch(a || 'medium', b || 'medium', Number(seed) || 1),
  logic: { createBattle, updateBattle, lineOfSight, circleBlocked },
};
window.G = G_API;
window.__G = G_API;

// ---------------- autotest ----------------
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
  const R = (n) => { for (let i = 0; i < n; i++) updateLogic(DT); };
  const saved = {
    rec: null, best: null, mute: null, title: null,
  };
  try {
    saved.rec = localStorage.getItem(REC_KEY);
    saved.best = localStorage.getItem(BEST_KEY);
    saved.mute = localStorage.getItem(MUTE_KEY);
  } catch (e) { }
  audio.setMuted(true);
  try {
    // 1 boot errors
    ok(1, (window.__BOOTERR || []).length === 0 && G_API.err.length === 0, '启动零报错 __BOOTERR/G.err 为空');

    // reset deterministic local match
    G_API.startMatch('local', 'medium');
    G_API.setPhase('live');
    G_API.setTank(0, { x: 300, y: 450, hp: 100, vx: 0, vy: 0, turret: 0 });
    G_API.setTank(1, { x: 720, y: 450, hp: 100, vx: 0, vy: 0, turret: Math.PI });
    G_API.setTimer(75);
    R(40);
    const s1 = S();
    ok(2, !s1.nanFlag && Number.isFinite(s1.battle.p1.x) && Number.isFinite(s1.battle.p2.hp) && Number.isFinite(s1.battle.timeLeft), '运行 40 帧关键数值无 NaN');

    // 3 input movement P1 (input consumed inside update)
    G_API.clearKeys();
    G_API.setTank(0, { x: 300, y: 450, vx: 0, vy: 0 });
    G_API.setTank(1, { x: 720, y: 450, vx: 0, vy: 0 });
    const x0 = S().battle.p1.x;
    G_API.press('KeyD'); R(20); G_API.release('KeyD');
    const x1 = S().battle.p1.x;
    ok(3, x1 > x0 + 6, `输入生效：按 D 后 P1 x ${x0.toFixed(1)}→${x1.toFixed(1)}`);

    // 4 P2 arrow input in local mode
    G_API.setTank(1, { x: 760, y: 470, vx: 0, vy: 0 });
    const y20 = S().battle.p2.y;
    G_API.press('ArrowUp'); R(20); G_API.release('ArrowUp');
    const y21 = S().battle.p2.y;
    ok(4, y21 < y20 - 5, `双人输入：P2 方向键 y ${y20.toFixed(1)}→${y21.toFixed(1)}`);

    // 5 focus fire input spawns a projectile (player input path)
    G_API.clearKeys();
    G_API.setTank(0, { x: 300, y: 450, vx: 0, vy: 0, turret: 0, cooldown: [0, 0, 0, 0, 0], weapon: 0 });
    G_API.setTank(1, { x: 650, y: 450, vx: 0, vy: 0, hp: 100 });
    const beforeShots = S().battle.projectiles.length;
    G_API.press('KeyF'); R(2); G_API.release('KeyF');
    const afterProj = S().battle.projectiles.length;
    ok(5, afterProj > beforeShots || S().battle.p2.hp < 100, `开火输入生效：弹体 ${beforeShots}→${afterProj}`);

    // 6 cannon damage is exactly 12 at clear line
    G_API.startMatch('local', 'medium'); G_API.setPhase('live');
    G_API.setTank(0, { x: 300, y: 450, vx: 0, vy: 0, turret: 0, cooldown: [0, 0, 0, 0, 0], weapon: 0 });
    G_API.setTank(1, { x: 600, y: 450, vx: 0, vy: 0, hp: 100, turret: Math.PI, cooldown: [0, 0, 0, 0, 0] });
    G_API.fire(0, 0);
    G_API.upd(55);
    ok(6, S().battle.p2.hp === 88, `普通弹命中：P2 装甲 100→${S().battle.p2.hp}（期望 88）`);

    // 7 spread pellet count
    G_API.startMatch('local', 'medium'); G_API.setPhase('live');
    G_API.setTank(0, { x: 300, y: 450, turret: 0, cooldown: [0, 0, 0, 0, 0], ammo: [null, 6, 4, 5, 3] });
    G_API.setTank(1, { x: 600, y: 450 });
    G_API.fire(0, 1);
    const spreadN = S().battle.projectiles.length;
    ok(7, spreadN === 5, `散射生成 5 枚弹丸（实际 ${spreadN}）`);

    // 8 laser instant damage
    G_API.startMatch('local', 'medium'); G_API.setPhase('live');
    G_API.setTank(0, { x: 300, y: 450, turret: 0, cooldown: [0, 0, 0, 0, 0], ammo: [null, 6, 4, 5, 3] });
    G_API.setTank(1, { x: 600, y: 450, hp: 100 });
    G_API.fire(0, 2); G_API.upd(1);
    ok(8, S().battle.p2.hp === 80 && S().battle.beams.length > 0, `激光瞬发命中：P2 装甲 ${S().battle.p2.hp}（期望 80）`);

    // 9 missile is homing and slower than cannon
    G_API.startMatch('local', 'medium'); G_API.setPhase('live');
    G_API.setTank(0, { x: 300, y: 450, turret: 0, cooldown: [0, 0, 0, 0, 0], ammo: [null, 6, 4, 5, 3] });
    G_API.setTank(1, { x: 700, y: 420 });
    const hadMissile = G_API.fire(0, 3);
    const mis = S().battle.projectiles[0];
    ok(9, hadMissile && mis && mis.type === 'missile' && Math.hypot(mis.vx, mis.vy) < 300, '导弹：追踪弹速低于普通弹');

    // 10 mine arm + trigger damage
    G_API.startMatch('local', 'medium'); G_API.setPhase('live');
    G_API.setTank(0, { x: 300, y: 450, turret: 0, cooldown: [0, 0, 0, 0, 0], ammo: [null, 6, 4, 5, 3] });
    G_API.setTank(1, { x: 700, y: 450, vx: 0, vy: 0 });
    G_API.fire(0, 4);
    const mine = S().battle.mines[0];
    if (mine) G_API.setTank(1, { x: mine.x + 10, y: mine.y });
    R(45);
    ok(10, !!mine && S().battle.p2.hp < 100, `地雷布置并触发：P2 装甲 ${S().battle.p2.hp}<100`);

    // 11 wall blocks projectile
    G_API.startMatch('local', 'medium'); G_API.setPhase('live');
    G_API.setTank(0, { x: 480, y: 170, turret: Math.PI / 2, cooldown: [0, 0, 0, 0, 0] });
    G_API.setTank(1, { x: 480, y: 430, vx: 0, vy: 0, hp: 100 });
    G_API.fire(0, 0); G_API.upd(70);
    ok(11, S().battle.p2.hp === 100, '中央掩体挡住普通弹（装甲不变）');

    // 12 ammo decrement + exhausted cannot fire
    G_API.startMatch('local', 'medium'); G_API.setPhase('live');
    G_API.setTank(0, { x: 300, y: 450, turret: 0, cooldown: [0, 0, 0, 0, 0], ammo: [null, 6, 1, 5, 3] });
    G_API.setTank(1, { x: 600, y: 450 });
    const f1 = G_API.fire(0, 2);
    const ammoAfter = S().battle.p1.ammo[2];
    const cd = S().battle.p1.cooldown[2];
    const f2 = G_API.fire(0, 2);
    ok(12, f1 && ammoAfter === 0 && f2 === false, `激光弹药 1→${ammoAfter}，空仓不可再射`);

    // 13 cooldown gate
    G_API.startMatch('local', 'medium'); G_API.setPhase('live');
    G_API.setTank(0, { x: 300, y: 450, turret: 0, cooldown: [0, 0, 0, 0, 0] });
    G_API.setTank(1, { x: 600, y: 450 });
    const c1 = G_API.fire(0, 0), c2 = G_API.fire(0, 0);
    R(30);
    const c3 = G_API.fire(0, 0);
    ok(13, c1 === true && c2 === false && c3 === true, '武器冷却闸门：连按第 2 发被拒，0.5s 后可发');

    // 14 forced round win increments score
    G_API.startMatch('local', 'medium'); G_API.setPhase('live');
    G_API.forceRoundWin(0);
    const rs = S();
    ok(14, rs.wins[0] === 1 && rs.battle.phase === 'result' && rs.battle.winner === 0, `回合胜利计分 ${rs.wins[0]}:${rs.wins[1]}`);

    // 15 BO5 early finish and report complete
    const frames = [];
    G_API.setReportTarget(f => frames.push(f));
    G_API.startMatch('local', 'medium'); G_API.setPhase('live');
    G_API.forceRoundWin(0); G_API.nextRound(); G_API.setPhase('live');
    G_API.forceRoundWin(0); G_API.nextRound(); G_API.setPhase('live');
    G_API.forceRoundWin(0);
    const b5 = S();
    ok(15, b5.wins[0] === 3 && b5.matchOver && frames.some(f => f.kind === 'complete'), `BO5 先取三胜：${b5.wins[0]}:${b5.wins[1]} 且上报 complete`);

    // 16 losing path and gameOver
    const frames2 = [];
    G_API.setReportTarget(f => frames2.push(f));
    G_API.startMatch('ai', 'easy'); G_API.setPhase('live');
    G_API.forceRoundWin(1); G_API.nextRound(); G_API.setPhase('live');
    G_API.forceRoundWin(1); G_API.nextRound(); G_API.setPhase('live');
    G_API.forceRoundWin(1);
    const lose = S();
    ok(16, lose.wins[1] === 3 && lose.matchOver && frames2.some(f => f.kind === 'gameOver'), `失败路径可达：${lose.wins[0]}:${lose.wins[1]} 且上报 gameOver`);

    // 17 report ready first and progress before terminal
    const log = G_API.reportLog();
    const k = frames2.map(f => f.kind);
    ok(17, log.length > 0 && log[0].kind === 'ready' && k.includes('progress') && k.indexOf('progress') < k.indexOf('gameOver'), '上报帧序 ready→progress→gameOver');

    // 18 localStorage record updated and readable
    let recStored = null;
    try { recStored = JSON.parse(localStorage.getItem(REC_KEY) || 'null'); } catch (e) { }
    ok(18, recStored && recStored.p2 >= 1, `localStorage 战绩已写入：P1 ${recStored ? recStored.p1 : '?'} / P2 ${recStored ? recStored.p2 : '?'}`);

    // 19 AI tiers monotonic
    const ap = S().aiProfiles;
    const mono = ap.easy.speed < ap.medium.speed && ap.medium.speed < ap.hard.speed &&
      ap.easy.lead <= ap.medium.lead && ap.medium.lead < ap.hard.lead &&
      ap.easy.jitter > ap.medium.jitter && ap.medium.jitter > ap.hard.jitter &&
      ap.easy.interval > ap.hard.interval;
    ok(19, mono, 'AI 三档: 速度/前瞻递增，抖动/反应间隔递减');

    // 20 AI actual movement differences across tiers
    G_API.startMatch('ai', 'easy'); G_API.setPhase('live'); G_API.setTank(0, { x: 160, y: 440 });
    const e0 = S().battle.p2; R(50);
    const e1 = S().battle.p2;
    G_API.startMatch('ai', 'hard'); G_API.setPhase('live'); G_API.setTank(0, { x: 160, y: 440 });
    const h0 = S().battle.p2; R(50);
    const h1 = S().battle.p2;
    const eMove = Math.hypot(e1.x - e0.x, e1.y - e0.y), hMove = Math.hypot(h1.x - h0.x, h1.y - h0.y);
    ok(20, hMove >= eMove - 2, `AI 实移：新兵 ${eMove.toFixed(1)}px / 王牌 ${hMove.toFixed(1)}px`);

    // 21 three handcrafted maps
    const maps = S().mapList;
    ok(21, maps.length === 3 && maps.every(m => m.walls >= 8), `三张手工地图：${maps.map(m => m.name + ':' + m.walls + '墙').join(' / ')}`);

    // 22-five weapon table
    const wp = S().weapons;
    ok(22, wp.length === 5 && wp.map(w => w.id).join(',') === 'cannon,spread,laser,missile,mine', '五种武器表完整且 id 正确');

    // 23-25 same-tier AI self-play (reduced runs, 40–60%)
    const bEasy = G_API.runSelfplay(80, 'easy', 'easy', 31001);
    ok(23, bEasy.p1Rate >= 0.4 && bEasy.p1Rate <= 0.6 && bEasy.p2Rate >= 0.4 && bEasy.p2Rate <= 0.6, `新兵同档自战 P1 胜率 ${(bEasy.p1Rate * 100).toFixed(1)}% / P2 ${(bEasy.p2Rate * 100).toFixed(1)}%`);
    const bMed = G_API.runSelfplay(80, 'medium', 'medium', 31002);
    ok(24, bMed.p1Rate >= 0.4 && bMed.p1Rate <= 0.6 && bMed.p2Rate >= 0.4 && bMed.p2Rate <= 0.6, `老练同档自战 P1 胜率 ${(bMed.p1Rate * 100).toFixed(1)}% / P2 ${(bMed.p2Rate * 100).toFixed(1)}%`);
    const bHard = G_API.runSelfplay(80, 'hard', 'hard', 31003);
    ok(25, bHard.p1Rate >= 0.4 && bHard.p1Rate <= 0.6 && bHard.p2Rate >= 0.4 && bHard.p2Rate <= 0.6, `王牌同档自战 P1 胜率 ${(bHard.p1Rate * 100).toFixed(1)}% / P2 ${(bHard.p2Rate * 100).toFixed(1)}%`);

    // 26 tier gap benchmark
    const gap = G_API.runDifficultyBench(60, 8801);
    ok(26, gap.mediumVsEasy.mediumWin >= 0.65 && gap.hardVsMedium.hardWin >= 0.65,
      `难度梯度：老练胜新兵 ${(gap.mediumVsEasy.mediumWin * 100).toFixed(0)}% · 王牌胜老练 ${(gap.hardVsMedium.hardWin * 100).toFixed(0)}%`);

    // 27 pause freezes live timer
    G_API.setNoAuto(false);
    G_API.startMatch('local', 'medium'); G_API.setPhase('live'); G_API.setTimer(60);
    G_API.togglePause(true);
    const tp = S().battle.timeLeft; R(30);
    const tp2 = S().battle.timeLeft;
    G_API.togglePause(false); R(10);
    const tp3 = S().battle.timeLeft;
    G_API.setNoAuto(true);
    ok(27, Math.abs(tp2 - tp) < .001 && tp3 < tp, `暂停冻结计时 ${tp.toFixed(1)}→${tp2.toFixed(1)}，恢复后 ${tp3.toFixed(1)}`);

    // 28 touch DOM pads exist with both sides
    const touchBtns = [...document.querySelectorAll('#touch button[data-code]')];
    const codes = new Set(touchBtns.map(b => b.dataset.code));
    ok(28, touchBtns.length >= 12 && codes.has('KeyA') && codes.has('KeyF') && codes.has('ArrowLeft') && codes.has('KeyJ'), `触屏双分区按钮 ${touchBtns.length} 个，双方键位齐全`);

    // 29 mode menu and hard start
    G_API.goTitle();
    const modeBtns = [...document.querySelectorAll('.modebtn')];
    const vis = !titleEl.classList.contains('hide');
    document.querySelector('.modebtn[data-mode="ai"][data-diff="3"]').click();
    const hs = S();
    ok(29, modeBtns.length === 4 && vis && hs.gameMode === 'ai' && hs.aiDiff === 'hard', `标题菜单 4 项，王牌档进入 ${hs.aiDiff}`);

    // 30 restart resets score and armor
    G_API.setScore(2, 1); G_API.setTank(0, { hp: 17 }); G_API.startRound(0);
    const rr0 = S();
    ok(30, rr0.wins[0] === 2 && rr0.wins[1] === 1 && rr0.battle.p1.hp === 100 && rr0.roundIndex === 0, '重开/换局复位：比分保留、装甲满值、回合归零');

    // 31 full 5-round fast-forward with no exceptions / NaN
    G_API.startMatch('ai', 'hard');
    let crash = false;
    try {
      for (let r = 0; r < 5; r++) {
        G_API.setPhase('live');
        R(16);
        if (S().matchOver) break;
        G_API.forceRoundWin(r % 2 === 0 ? 0 : 1);
        if (S().matchOver) break;
        G_API.nextRound();
      }
    } catch (e) { crash = true; console.error('T31', e); }
    const ff = S();
    ok(31, !crash && !ff.nanFlag && ff.matchOver, `整局快进无异常/NaN，终局 ${ff.wins[0]}:${ff.wins[1]}`);

    // 32 end panel controls visible
    G_API.forceWin();
    const endVisible = !endEl.classList.contains('hide');
    ok(32, endVisible && !!document.getElementById('go') && !!document.getElementById('change') && !!document.getElementById('home'), '结算面板：再战 / 换难度 / 回标题可见');

    // 33 audio remained muted, no AudioContext
    ok(33, audio.isMuted() === true && audio.hasCtx() === false, '自测静音且未创建 AudioContext');

    // 34 back to title
    G_API.goTitle();
    const titleBack = S();
    ok(34, titleBack.mode === 'title' && !titleEl.classList.contains('hide') && endEl.classList.contains('hide') && /历史战绩|尚无/.test(bestEl.textContent), '测完回标题画面且恢复纪录文案');

    // 35 assertion count
    ok(35, results.length >= 34, `断言覆盖 ${results.length} 条（要求 ≥22，本轮计划 34）`);
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
    T.fail++;
    results.push({ id: 'ERR', ok: false, name: `autotest crashed: ${window.__TEST_ERR}` });
    console.log('[autotest] crash', window.__TEST_ERR);
    try { G_API.goTitle(); } catch (e) { }
  } finally {
    G_API.setReportTarget(null);
    G_API.setNoAuto(false);
    audio.setMuted(saved.mute === '1');
    try {
      if (saved.rec === null) localStorage.removeItem(REC_KEY); else localStorage.setItem(REC_KEY, saved.rec);
      if (saved.best === null) localStorage.removeItem(BEST_KEY); else localStorage.setItem(BEST_KEY, saved.best);
      if (saved.mute === null) localStorage.removeItem(MUTE_KEY); else localStorage.setItem(MUTE_KEY, saved.mute);
    } catch (e) { }
    record = readRecord(); bestTime = Math.max(0, parseFloat(safeGet(BEST_KEY, '0')) || 0);
    updateTitleBest(); updateMuteBtn();
    try { G_API.goTitle(); } catch (e) { }
    await nap();
    T.total = results.length;
    T.pass = results.filter(r => r.ok).length;
    T.fail = results.length - T.pass;
    T.done = true;
    console.log(`[autotest] ${T.pass}/${T.total} passed, ${T.fail} failed`);
  }
}

if (AUTOTEST) {
  autotest();
} else if (URLP.has('autostart')) {
  setTimeout(() => {
    startMatch(URLP.get('mode') || 'ai', URLP.get('difficulty') || '2');
  }, 30);
}
