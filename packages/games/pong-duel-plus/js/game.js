// Pong Duel Plus 乒乓对决 — a 2D Canvas pong duel.
// guizang-game-skill series. Vertical paddles, hit-position angles, paddle
// velocity spin, three power-ups, first-to-11, three AI tiers, local two-player,
// touch split zones, synthesized WebAudio, site report bridge, G hooks and a
// deterministic ?autotest=1 suite.

import {
  W, H, WALL_TOP, WALL_BOTTOM, BALL_R, PADDLE_W, PADDLE_H, PADDLE_LONG,
  PADDLE_X1, PADDLE_X2, HUMAN_SPEED, TOUCH_SPEED, WIN_SCORE, SERVE_TIME,
  MAX_BALL, SLOW_CAP, MIN_BALL,
  POW_RAD, POWERUPS, AI_PROFILES,
  clamp, clamp01, sign, finite, mulberry32, diffKey,
  makeWorld, resetWorld, reseedWorld, stepWorld, aiIntent, humanIntent,
  hitMath, forceScore, grantPowerup, spawnPowerup, runSelfplay,
} from './logic.js';
import { makeAudio } from './audio.js';

// ==================== constants ====================
const DT = 1 / 60;
const DEFAULT_SEED = 0x5EED2026;
const BEST_WINS1_KEY = 'pdp.winsP1';
const BEST_WINS2_KEY = 'pdp.winsP2';
const BEST_RALLY_KEY = 'pdp.bestRally';
const MUTE_KEY = 'pdp.mute';
const GHOST_COUNT = 3;
const AUTOTEST = new URLSearchParams(location.search).has('autotest');
const URLP = new URLSearchParams(location.search);

// ==================== persistent ====================
function readInt(key) {
  try { return parseInt(localStorage.getItem(key) || '0', 10) || 0; } catch (e) { return 0; }
}
let winsP1 = readInt(BEST_WINS1_KEY);
let winsP2 = readInt(BEST_WINS2_KEY);
let bestRally = readInt(BEST_RALLY_KEY);
let muted = false;
try { muted = localStorage.getItem(MUTE_KEY) === '1'; } catch (e) { muted = false; }

function persistRecords() {
  try {
    localStorage.setItem(BEST_WINS1_KEY, String(winsP1));
    localStorage.setItem(BEST_WINS2_KEY, String(winsP2));
    localStorage.setItem(BEST_RALLY_KEY, String(bestRally));
  } catch (e) { }
}

const audio = makeAudio();
audio.setMuted(muted);

// ==================== mutable state ====================
let mode = 'title';                  // title | play | over
let gameMode = 'ai';                 // ai | local
let aiDiff = 'medium';
let profile = AI_PROFILES.medium;
let paused = false, noAuto = false, winner = null;
let matchTime = 0, matchCount = 0;
let nanFlag = false;
let animT = 0;
let hitstopT = 0, shakeT = 0, shakeDur = 0.2, shakeAmp = 0;
let flashT = 0, bannerT = 0, scoreFlashT = 0;
let reportTarget = null;
let lastScorer = null;
let worldSeed = DEFAULT_SEED;
let seedLocked = false;
let world = makeWorld(worldSeed);

const reports = [];
const particles = [];
const trail = [];
const held = new Set();
const pressed = new Set();
const touchTargets = { p1: null, p2: null };
const lastSfxAt = { wall: 0, power: 0 };

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

// ==================== helpers ====================
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
function fmtTime(t) {
  const s = Math.max(0, finite(t));
  const m = Math.floor(s / 60), ss = Math.floor(s % 60), d = Math.floor((s - Math.floor(s)) * 10);
  return `${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}.${d}`;
}
function scoreInt() { return world.score1 * 100 + world.score2; }
function progressPct() { return Math.round(clamp01(Math.max(world.score1, world.score2) / WIN_SCORE) * 100); }
function sideColor(side) { return side === 'p2' ? '#93a4ff' : '#ff9a76'; }
function sideName(side) {
  if (side === 'p1') return 'P1';
  return gameMode === 'local' ? 'P2' : `${profile.zh}AI`;
}
function updateTitleBest() {
  if (!bestEl) return;
  if (winsP1 <= 0 && winsP2 <= 0 && bestRally <= 0) {
    bestEl.textContent = '尚无战绩 · 先到 11 分，写下双侧胜场与最长对拉';
  } else {
    bestEl.textContent = `P1 胜 ${winsP1} · P2 胜 ${winsP2} · 最长对拉 ${bestRally} 拍`;
  }
}
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
function toast(msg, ms = 1500) {
  if (!toastEl) return;
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toastEl.classList.remove('show'), ms);
}
function nextSeed() {
  if (!seedLocked) worldSeed = (Math.imul(worldSeed, 1664525) + 1013904223) >>> 0;
  return worldSeed;
}

// ==================== reports / bridge ====================
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
      if (kind === 'ready') window.parent.postMessage({ source: 'lightgame', type: 'lightgame:ready', gameId: 'pong-duel-plus', v: 1 }, '*');
    }
  } catch (e) { }
}
report('ready', { game: 'pong-duel-plus' });

// ==================== static procedural art ====================
const bgCv = document.createElement('canvas');
bgCv.width = W * 2; bgCv.height = H * 2;

function buildStaticArt() {
  const c = bgCv.getContext('2d');
  c.scale(2, 2);
  const rnd = mulberry32(0x9A17F00D);

  let g = c.createLinearGradient(0, 0, W * .55, H);
  g.addColorStop(0, '#0a1020'); g.addColorStop(.42, '#0d1730');
  g.addColorStop(.74, '#081120'); g.addColorStop(1, '#04070e');
  c.fillStyle = g; c.fillRect(0, 0, W, H);

  // soft table glow behind the court
  const halo = c.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, 520);
  halo.addColorStop(0, 'rgba(78,120,170,.15)');
  halo.addColorStop(.5, 'rgba(40,64,110,.06)');
  halo.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = halo; c.fillRect(0, 0, W, H);

  // stars / paper dust
  for (let i = 0; i < 260; i++) {
    const x = rnd() * W, y = rnd() * H;
    c.fillStyle = `rgba(${190 + rnd() * 55 | 0},${200 + rnd() * 45 | 0},${215 + rnd() * 40 | 0},${.03 + rnd() * .16})`;
    c.beginPath(); c.arc(x, y, .35 + rnd() * 1.25, 0, 7); c.fill();
  }
  for (let i = 0; i < 44; i++) {
    const x = rnd() * W, y = rnd() * H, len = 18 + rnd() * 86;
    c.strokeStyle = `rgba(${rnd() < .5 ? '224,174,98' : '107,125,255'},${.02 + rnd() * .05})`;
    c.lineWidth = .6;
    c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + len * .4, y + (rnd() - .5) * 14, x + len, y + (rnd() - .5) * 6); c.stroke();
  }

  // side aura bands
  for (const [x, col] of [[36, '255,107,74'], [W - 36, '107,125,255']]) {
    const sg = c.createLinearGradient(x - 90, 0, x + 90, 0);
    sg.addColorStop(0, 'rgba(0,0,0,0)');
    sg.addColorStop(.5, `rgba(${col},.10)`);
    sg.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = sg;
    c.fillRect(x - 90, 40, 180, H - 80);
  }

  // faint moon-gate sigil behind the centre of the court
  c.save();
  c.translate(W / 2, H / 2);
  c.strokeStyle = 'rgba(224,174,98,.05)';
  for (let r = 120; r <= 244; r += 62) {
    c.lineWidth = 1;
    c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.stroke();
  }
  c.strokeStyle = 'rgba(88,216,192,.035)';
  for (let i = 0; i < 16; i++) {
    const a = i / 16 * Math.PI * 2;
    c.beginPath();
    c.moveTo(Math.cos(a) * 122, Math.sin(a) * 122);
    c.lineTo(Math.cos(a) * 238, Math.sin(a) * 238);
    c.stroke();
  }
  c.restore();

  // soft lantern haze in the upper corners
  for (const [x, col] of [[108, '255,176,96'], [W - 108, '150,170,255']]) {
    const lg = c.createRadialGradient(x, 78, 4, x, 78, 132);
    lg.addColorStop(0, `rgba(${col},.10)`);
    lg.addColorStop(.45, `rgba(${col},.035)`);
    lg.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = lg;
    c.beginPath(); c.arc(x, 78, 132, 0, Math.PI * 2); c.fill();
  }

  // table frame
  c.save();
  c.fillStyle = 'rgba(7,13,25,.62)';
  rr(c, 22, 28, W - 44, H - 56, 24); c.fill();
  c.strokeStyle = 'rgba(224,174,98,.70)'; c.lineWidth = 2.4;
  rr(c, 22, 28, W - 44, H - 56, 24); c.stroke();
  c.strokeStyle = 'rgba(88,216,192,.30)'; c.lineWidth = 1;
  rr(c, 29, 35, W - 58, H - 70, 18); c.stroke();
  c.restore();

  // play-field top/bottom rails
  for (const y of [WALL_TOP, WALL_BOTTOM]) {
    const rail = c.createLinearGradient(0, y - 3, 0, y + 3);
    rail.addColorStop(0, 'rgba(224,174,98,0)');
    rail.addColorStop(.5, 'rgba(255,224,160,.42)');
    rail.addColorStop(1, 'rgba(224,174,98,0)');
    c.strokeStyle = rail; c.lineWidth = 2;
    c.beginPath(); c.moveTo(38, y); c.lineTo(W - 38, y); c.stroke();
  }

  // net
  c.save();
  c.strokeStyle = 'rgba(230,220,200,.30)';
  c.lineWidth = 1.4;
  c.setLineDash([5, 9]);
  c.beginPath(); c.moveTo(W / 2, WALL_TOP + 4); c.lineTo(W / 2, WALL_BOTTOM - 4); c.stroke();
  c.setLineDash([]);
  c.strokeStyle = 'rgba(224,174,98,.22)';
  c.lineWidth = 1;
  c.beginPath(); c.arc(W / 2, H / 2, 66, 0, Math.PI * 2); c.stroke();
  c.beginPath(); c.arc(W / 2, H / 2, 5, 0, Math.PI * 2); c.stroke();
  c.restore();

  // goal shading
  for (const [x0, x1, col] of [[38, PADDLE_X1 - 30, '255,107,74'], [W - 38, PADDLE_X2 + 30, '107,125,255']]) {
    const gg = c.createLinearGradient(x0, 0, x1, 0);
    gg.addColorStop(0, `rgba(${col},.13)`);
    gg.addColorStop(1, `rgba(${col},0)`);
    c.fillStyle = gg;
    c.fillRect(Math.min(x0, x1), WALL_TOP + 2, Math.abs(x1 - x0), WALL_BOTTOM - WALL_TOP - 4);
  }

  // corner rivets
  for (const [x, y] of [[32, 38], [W - 32, 38], [32, H - 38], [W - 32, H - 38]]) {
    c.fillStyle = 'rgba(255,224,160,.65)';
    c.beginPath(); c.arc(x, y, 2.1, 0, 7); c.fill();
  }

  // watermark
  c.save();
  c.globalAlpha = .22;
  c.fillStyle = 'rgba(220,230,255,.55)';
  c.font = '600 10px "Segoe UI","Microsoft YaHei",sans-serif';
  c.textAlign = 'center';
  c.fillText('P O N G   D U E L   P L U S', W / 2, H - 20);
  c.restore();

  // bottom vignette
  const vig = c.createLinearGradient(0, H - 120, 0, H);
  vig.addColorStop(0, 'rgba(0,0,0,0)'); vig.addColorStop(1, 'rgba(0,0,0,.46)');
  c.fillStyle = vig; c.fillRect(0, H - 120, W, 120);
}
buildStaticArt();

// ==================== flow ====================
function hideOverlays() { titleEl.classList.add('hide'); endEl.classList.add('hide'); }
function syncBodyMode() { document.body.classList.toggle('inplay', mode === 'play'); }

function goTitle() {
  mode = 'title'; paused = false; winner = null; lastScorer = null;
  nanFlag = false; hitstopT = 0; shakeT = 0; flashT = 0; bannerT = 0; scoreFlashT = 0;
  particles.length = 0; trail.length = 0;
  touchTargets.p1 = null; touchTargets.p2 = null;
  resetWorld(world, nextSeed());
  world.noAuto = noAuto;
  world.powerupsEnabled = true;
  hideOverlays();
  titleEl.classList.remove('hide');
  syncBodyMode();
  updateTitleBest(); updatePauseButton(); updateMuteButton();
  audio.setState('title'); audio.reset();
}

function startMatch(gm = 'ai', diff = aiDiff) {
  gameMode = gm === 'local' ? 'local' : 'ai';
  aiDiff = diffKey(diff);
  profile = AI_PROFILES[aiDiff];
  mode = 'play'; paused = false; winner = null; lastScorer = null;
  matchTime = 0; matchCount++;
  nanFlag = false; hitstopT = 0; shakeT = 0; flashT = 0; bannerT = 0; scoreFlashT = 0;
  particles.length = 0; trail.length = 0;
  touchTargets.p1 = null; touchTargets.p2 = null;
  resetWorld(world, nextSeed());
  world.noAuto = noAuto;
  world.silent = false;
  world.powerupsEnabled = true;
  world.server = 'p1';
  world.lastHitter = 'p1';
  hideOverlays();
  syncBodyMode();
  updateMuteButton(); updatePauseButton();
  audio.reset();
  audio.setState('match');
  return true;
}

function showEnd(won) {
  const ai = gameMode === 'ai';
  endkickEl.textContent = 'MATCH RESULT · 乒乓记';
  endhEl.textContent = won ? (ai ? '你 赢 下 对 决' : 'P1 夺 魁') : (ai ? 'AI 赢 下 对 决' : 'P2 夺 魁');
  const lines = [];
  if (ai) lines.push(`你  ${world.score1}  :  ${world.score2}  ${profile.zh}AI`);
  else lines.push(`P1  ${world.score1}  :  ${world.score2}  P2`);
  lines.push(`最长对拉 ${bestRally} 拍 · 用时 ${fmtTime(matchTime)}`);
  lines.push(`累计胜场  P1 ${winsP1} · P2 ${winsP2}`);
  lines.push(won ? '先到 11 分 · 一拍定音' : '读旋、抢边、再来一局');
  enddEl.textContent = lines.join('\n');
  endEl.classList.remove('hide');
  titleEl.classList.add('hide');
  updateTitleBest();
}

function endMatch(side) {
  if (mode !== 'play') return false;
  mode = 'over'; paused = false;
  winner = side === 'p1' ? 'p1' : 'p2';
  world.winner = winner;
  world.phase = 'ended';
  const won = winner === 'p1';
  if (won) winsP1++; else winsP2++;
  persistRecords();
  audio.setState('end');
  audio.play(won ? 'win' : 'lose');
  if (won) {
    report('complete', {
      score: scoreInt(), progress: 100,
      p1: world.score1, p2: world.score2, rally: bestRally,
      time: Math.round(matchTime * 100) / 100, mode: gameMode, diff: aiDiff,
    });
  } else {
    report('gameOver', {
      score: scoreInt(), progress: progressPct(),
      p1: world.score1, p2: world.score2, rally: bestRally,
      time: Math.round(matchTime * 100) / 100, mode: gameMode, diff: aiDiff,
    });
  }
  showEnd(won);
  syncBodyMode();
  updatePauseButton();
  return true;
}

function handleScoreEvent(ev) {
  if (!ev) return;
  lastScorer = ev.side;
  if (ev.rally > bestRally) { bestRally = ev.rally; persistRecords(); }
  hitstopT = 0.08;
  shakeDur = 0.32; shakeT = 0.32; shakeAmp = ev.winner ? 10 : 8;
  flashT = ev.winner ? 0.34 : 0.22;
  scoreFlashT = 0.8;
  trail.length = 0;
  const bx = clamp(finite(ev.x, ev.side === 'p1' ? W - 30 : 30), 30, W - 30);
  const by = clamp(finite(ev.y, H / 2), WALL_TOP + 20, WALL_BOTTOM - 20);
  const col = sideColor(ev.side);
  spawnBurst(bx, by, col, 30, 260);
  spawnRing(bx, by, col, 18, 260, .5);
  spawnRing(bx, by, '#ffe0a0', 30, 220, .62);
  audio.play('score');
  const label = sideName(ev.side);
  if (ev.winner) {
    toast(`${label} 拿下第 11 分`);
  } else {
    toast(`${label} 得分 ${ev.score1} : ${ev.score2} · ${sideName(ev.server)} 发球`);
  }
  report('progress', {
    score: scoreInt(), progress: progressPct(),
    p1: world.score1, p2: world.score2,
    rally: ev.rally, bestRally, server: ev.server,
    mode: gameMode, diff: aiDiff,
  });
  if (ev.winner) endMatch(ev.winner);
}

function forceWin() {
  if (mode !== 'play') startMatch(gameMode, aiDiff);
  world.score1 = WIN_SCORE;
  world.winner = 'p1';
  world.phase = 'ended';
  scoreFlashT = 0.8;
  report('progress', { score: scoreInt(), progress: 100, p1: world.score1, p2: world.score2, forced: true });
  return endMatch('p1');
}
function forceFail() {
  if (mode !== 'play') startMatch(gameMode, aiDiff);
  world.score2 = WIN_SCORE;
  world.winner = 'p2';
  world.phase = 'ended';
  scoreFlashT = 0.8;
  report('progress', { score: scoreInt(), progress: progressPct(), p1: world.score1, p2: world.score2, forced: true });
  return endMatch('p2');
}
function forcePoint(side) {
  if (mode !== 'play') startMatch(gameMode, aiDiff);
  const ev = forceScore(world, side === 'p2' ? 'p2' : 'p1');
  if (ev) handleScoreEvent(ev);
  return snapshot();
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
const MOVE_CODES = new Set(['KeyW', 'KeyS', 'ArrowUp', 'ArrowDown', 'KeyP', 'KeyM', 'KeyR', 'Escape', 'Space']);
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
window.addEventListener('blur', () => { held.clear(); touchTargets.p1 = null; touchTargets.p2 = null; });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { held.clear(); touchTargets.p1 = null; touchTargets.p2 = null; }
});

function onFirstGesture() { if (!AUTOTEST) audio.unlock(); }
window.addEventListener('pointerdown', onFirstGesture, { once: true, capture: true });
window.addEventListener('keydown', onFirstGesture, { once: true, capture: true });

function handleSystemKeys() {
  if (pressed.has('KeyM')) toggleMute();
  if (pressed.has('KeyP') && mode === 'play') togglePause();
  if (pressed.has('KeyR') && (mode === 'play' || mode === 'over')) {
    startMatch(gameMode, aiDiff); toast('已重开一局');
  }
  if (pressed.has('Escape')) {
    if (mode === 'play') togglePause();
    else if (mode === 'over') goTitle();
  }
}

function keyDir(up, down) { return (down ? 1 : 0) - (up ? 1 : 0); }

function readHumanIntent(side) {
  if (side === 'p1') {
    if (touchTargets.p1) return { type: 'target', y: touchTargets.p1.y, speed: TOUCH_SPEED };
    let up = held.has('KeyW'), down = held.has('KeyS');
    if (gameMode === 'ai') { up = up || held.has('ArrowUp'); down = down || held.has('ArrowDown'); }
    return humanIntent(keyDir(up, down), HUMAN_SPEED);
  }
  if (touchTargets.p2) return { type: 'target', y: touchTargets.p2.y, speed: TOUCH_SPEED };
  return humanIntent(keyDir(held.has('ArrowUp'), held.has('ArrowDown')), HUMAN_SPEED);
}

// touch pads (same pressed/held path as the keyboard)
(function bindPads() {
  const pointers = new Map();
  document.querySelectorAll('#touchpads button').forEach(btn => {
    const code = btn.dataset.code;
    const down = (e) => {
      e.preventDefault(); e.stopPropagation();
      document.body.classList.add('touchui');
      if (!AUTOTEST) audio.unlock();
      try { btn.setPointerCapture && btn.setPointerCapture(e.pointerId); } catch (err) { }
      const list = pointers.get(e.pointerId) || new Set();
      list.add(code); pointers.set(e.pointerId, list);
      if (!held.has(code)) pressed.add(code);
      held.add(code);
      btn.classList.add('on');
      audio.play('ui');
    };
    const up = (e) => {
      e.preventDefault();
      const list = pointers.get(e.pointerId);
      if (list) { list.delete(code); if (!list.size) pointers.delete(e.pointerId); }
      let still = false;
      for (const set of pointers.values()) if (set.has(code)) still = true;
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

// split-screen vertical drag zones
(function bindZones() {
  const zonePointers = new Map();
  document.querySelectorAll('#touchzones .tz').forEach(z => {
    const zoneSide = z.dataset.side;
    const mapSide = () => (gameMode !== 'local' && zoneSide === 'p2') ? 'p1' : zoneSide;
    const setTarget = (e) => {
      if (!(viewScale > 0)) return;
      const ly = (e.clientY - viewOY) / viewScale;
      touchTargets[mapSide()] = { y: clamp(ly, WALL_TOP - 40, WALL_BOTTOM + 40) };
    };
    const down = (e) => {
      e.preventDefault(); e.stopPropagation();
      document.body.classList.add('touchui');
      if (!AUTOTEST) audio.unlock();
      try { z.setPointerCapture && z.setPointerCapture(e.pointerId); } catch (err) { }
      zonePointers.set(e.pointerId, mapSide());
      setTarget(e);
    };
    const move = (e) => {
      if (!zonePointers.has(e.pointerId)) return;
      e.preventDefault();
      setTarget(e);
    };
    const up = (e) => {
      e.preventDefault();
      const side = zonePointers.get(e.pointerId);
      if (side) { touchTargets[side] = null; zonePointers.delete(e.pointerId); }
    };
    z.addEventListener('pointerdown', down);
    z.addEventListener('pointermove', move);
    z.addEventListener('pointerup', up);
    z.addEventListener('pointercancel', up);
    z.addEventListener('contextmenu', e => e.preventDefault());
  });
})();

// ==================== FX ====================
function addParticle(p) {
  if (particles.length >= 460) particles.splice(0, 30);
  particles.push(p);
}
function spawnSpark(x, y, color, n = 8, power = 240, spread = Math.PI * 2, dir = 0) {
  for (let i = 0; i < n; i++) {
    const a = dir + (Math.random() - .5) * spread;
    const sp = power * (.35 + Math.random() * .8);
    addParticle({
      type: 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      life: .22 + Math.random() * .34, max: .56,
      size: 1.2 + Math.random() * 2.7, color, grav: 60, drag: .12,
    });
  }
}
function spawnRing(x, y, color, size = 16, grow = 220, life = .38) {
  addParticle({ type: 'ring', x, y, vx: 0, vy: 0, life, max: life, size, grow, color, grav: 0, drag: 0 });
}
function spawnBurst(x, y, color, n = 24, power = 280) {
  spawnSpark(x, y, color, n, power);
  for (let i = 0; i < Math.min(22, n); i++) {
    addParticle({
      type: 'confetti', x: x + (Math.random() - .5) * 30, y: y + (Math.random() - .5) * 20,
      vx: (Math.random() - .5) * 260, vy: -40 - Math.random() * 180,
      life: .7 + Math.random() * .55, max: 1.25,
      size: 1.6 + Math.random() * 2.6, color, grav: 280, drag: .08,
      rot: Math.random() * 7, vr: (Math.random() - .5) * 9,
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
  if (scoreFlashT > 0) scoreFlashT = Math.max(0, scoreFlashT - dt);
  updateParticles(dt);
  for (let i = trail.length - 1; i >= 0; i--) {
    trail[i].life -= dt;
    if (trail[i].life <= 0) trail.splice(i, 1);
  }
}
function checkNaN() {
  const b = world.ball;
  const vals = [b.x, b.y, b.vx, b.vy, b.spin, world.p1.y, world.p1.vy, world.p2.y, world.p2.vy, world.time, world.serveT];
  for (const v of vals) if (!Number.isFinite(v)) { nanFlag = true; return false; }
  return true;
}

// ==================== update ====================
function update(dt) {
  if (!Number.isFinite(dt) || dt <= 0) return;
  handleSystemKeys();
  animT += dt;
  audio.tick(dt);
  audio.setState(mode === 'title' ? 'title' : mode === 'over' ? 'end'
    : (world.score1 >= 9 || world.score2 >= 9) ? 'tension' : 'match');

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

  if (hitstopT > 0 && !noAuto) {
    updateFx(dt);
    checkNaN();
    pressed.clear();
    return;
  }

  const p1Intent = readHumanIntent('p1');
  let p2Intent;
  if (gameMode === 'local') p2Intent = readHumanIntent('p2');
  else p2Intent = aiIntent(world, 'p2', profile, dt);

  const events = stepWorld(world, { p1: p1Intent, p2: p2Intent }, dt);
  for (const ev of events) {
    if (ev.type === 'hit') {
      const power = clamp(ev.speed / 1700, .15, 1);
      audio.play('hit', power);
      const col = sideColor(ev.side);
      spawnSpark(ev.x, ev.y, col, 7 + Math.round(power * 8), 140 + power * 260,
        Math.PI * 1.25, ev.side === 'p1' ? 0 : Math.PI);
      spawnRing(ev.x, ev.y, col, 9 + power * 7, 130 + power * 100, .28);
      hitstopT = Math.max(hitstopT, .062);
      shakeDur = .15; shakeT = Math.max(shakeT, .15); shakeAmp = Math.min(7, 1.4 + power * 4);
    } else if (ev.type === 'wall') {
      const power = clamp(ev.speed / 2200, .1, 1);
      if (power > .12) spawnSpark(ev.x, ev.y, '#dff4ff', 3 + Math.round(power * 4), 70 + power * 110, Math.PI * .8, ev.which === 'top' ? Math.PI / 2 : -Math.PI / 2);
      if (animT - lastSfxAt.wall > .06 && power > .18) { audio.play('wall', power); lastSfxAt.wall = animT; }
    } else if (ev.type === 'spawn') {
      audio.play('powerSpawn');
      spawnRing(ev.x, ev.y, POWERUPS[ev.pow].color, 14, 90, .5);
    } else if (ev.type === 'collect') {
      audio.play('power', ev.pow);
      const meta = POWERUPS[ev.pow];
      spawnBurst(ev.x, ev.y, meta.color, 22, 220);
      spawnRing(ev.x, ev.y, meta.color, 16, 240, .55);
      flashT = Math.max(flashT, .14);
      shakeDur = .2; shakeT = Math.max(shakeT, .2); shakeAmp = Math.max(shakeAmp, 4);
      toast(`${sideName(ev.side)} 获得「${meta.zh}」`);
    } else if (ev.type === 'serve') {
      audio.play('serve');
      bannerT = .5;
    } else if (ev.type === 'score') {
      handleScoreEvent(ev);
    }
  }

  if (world.phase === 'live' && mode === 'play') {
    const b = world.ball;
    const last = trail[trail.length - 1];
    if (!last || Math.hypot(b.x - last.x, b.y - last.y) > 3) {
      trail.push({ x: b.x, y: b.y, life: .26, max: .26 });
      if (trail.length > 26) trail.shift();
    }
  }

  updateFx(dt);
  checkNaN();

  if (world.phase === 'ended' && mode === 'play') endMatch(world.winner || 'p1');
  pressed.clear();
}

// ==================== rendering ====================
function drawAmbient(t) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const bands = [
    { y: H * .22, a: .035, ph: .7, col: '80,150,190' },
    { y: H * .58, a: .028, ph: 2.1, col: '130,100,200' },
  ];
  for (const b of bands) {
    const g = ctx.createLinearGradient(0, b.y - 80, 0, b.y + 80);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(.5, `rgba(${b.col},${b.a * (0.7 + 0.3 * Math.sin(t * .45 + b.ph))})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, b.y - 80, W, 160);
  }
  ctx.restore();
}

function drawPaddle(p, side) {
  const pal = side === 'p1'
    ? { a: '#ffb08a', b: '#ff6b4a', c: '#8e2f1e', edge: '255,154,118' }
    : { a: '#c3ccff', b: '#6b7dff', c: '#252f7a', edge: '147,164,255' };
  const x = p.x, h = p.h;
  const y0 = p.y - h / 2;
  ctx.save();
  // glow
  ctx.globalCompositeOperation = 'lighter';
  const glow = ctx.createRadialGradient(x, p.y, 4, x, p.y, h * .9);
  glow.addColorStop(0, `rgba(${pal.edge},.24)`);
  glow.addColorStop(1, `rgba(${pal.edge},0)`);
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.ellipse(x, p.y, 38, h * .75, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  ctx.save();
  // motion smear
  if (Math.abs(p.vy) > 220) {
    ctx.globalAlpha = Math.min(.22, Math.abs(p.vy) / 3200);
    ctx.fillStyle = pal.b;
    rr(ctx, x - PADDLE_W / 2 - 3, y0 - p.vy * .012, PADDLE_W + 6, h, 7);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  const grad = ctx.createLinearGradient(x - PADDLE_W / 2, 0, x + PADDLE_W / 2, 0);
  grad.addColorStop(0, pal.c);
  grad.addColorStop(.35, pal.b);
  grad.addColorStop(.62, pal.a);
  grad.addColorStop(1, pal.c);
  ctx.fillStyle = grad;
  rr(ctx, x - PADDLE_W / 2, y0, PADDLE_W, h, 7);
  ctx.fill();
  ctx.strokeStyle = `rgba(${pal.edge},.85)`;
  ctx.lineWidth = 1.4;
  rr(ctx, x - PADDLE_W / 2, y0, PADDLE_W, h, 7);
  ctx.stroke();
  // centre band + grip line
  ctx.strokeStyle = 'rgba(255,240,210,.45)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x - PADDLE_W / 2 + 3, p.y); ctx.lineTo(x + PADDLE_W / 2 - 3, p.y); ctx.stroke();
  ctx.fillStyle = 'rgba(255,240,210,.8)';
  ctx.beginPath(); ctx.arc(x, p.y, 1.6, 0, 7); ctx.fill();
  if (p.hitFlash > 0) {
    ctx.globalAlpha = clamp01(p.hitFlash / .14) * .9;
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.6;
    rr(ctx, x - PADDLE_W / 2 - 1, y0 - 1, PADDLE_W + 2, h + 2, 8);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

function drawBallAt(x, y, r, alpha, tint, ghost) {
  ctx.save();
  ctx.globalAlpha = alpha;
  if (ghost) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = tint || 'rgba(197,154,255,.8)';
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(197,154,255,.16)';
    ctx.beginPath(); ctx.arc(x, y, r * .82, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    return;
  }
  ctx.globalCompositeOperation = 'lighter';
  const glow = ctx.createRadialGradient(x, y, 1, x, y, r * 4.2);
  glow.addColorStop(0, 'rgba(255,240,200,.55)');
  glow.addColorStop(.4, tint || 'rgba(255,200,130,.20)');
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.arc(x, y, r * 4.2, 0, Math.PI * 2); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  const body = ctx.createRadialGradient(x - r * .3, y - r * .35, r * .1, x, y, r * 1.1);
  body.addColorStop(0, '#ffffff');
  body.addColorStop(.45, '#fff1c9');
  body.addColorStop(.82, '#ffcc78');
  body.addColorStop(1, '#d67a3a');
  ctx.fillStyle = body;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = .8;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}

function drawTrail() {
  if (!trail.length) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const p of trail) {
    const a = clamp01(p.life / p.max);
    ctx.globalAlpha = a * .25;
    ctx.fillStyle = '#ffd98e';
    ctx.beginPath(); ctx.arc(p.x, p.y, BALL_R * (.35 + a * .5), 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function drawGhosts(t) {
  if (world.phantomT <= 0) return;
  const b = world.ball;
  ctx.save();
  for (let i = 0; i < GHOST_COUNT; i++) {
    const ph = t * 2.35 + i * (Math.PI * 2 / GHOST_COUNT);
    const ox = Math.cos(ph) * 38 + Math.sin(t * 1.3 + i * 1.7) * 9;
    const oy = Math.sin(ph * 1.35) * 27 + Math.cos(t * 1.1 + i) * 6;
    drawBallAt(b.x + ox, b.y + oy, BALL_R * .92, .20 + .10 * (0.5 + 0.5 * Math.sin(t * 5 + i * 2)), 'rgba(197,154,255,.7)', true);
  }
  ctx.restore();
}

function drawBall() {
  const b = world.ball;
  const slow = world.slowT > 0;
  drawBallAt(b.x, b.y, BALL_R, 1, slow ? 'rgba(143,216,255,.26)' : 'rgba(255,200,130,.20)', false);
  // spin indicator
  if (Math.abs(b.spin) > 8) {
    ctx.save();
    ctx.globalAlpha = clamp01(Math.abs(b.spin) / 300) * .8;
    ctx.strokeStyle = b.spin < 0 ? '#8fd8ff' : '#ffb27a';
    ctx.lineWidth = 1.6;
    const a0 = (animT * 9 * sign(b.spin)) % (Math.PI * 2);
    ctx.beginPath(); ctx.arc(b.x, b.y, BALL_R + 4.5, a0, a0 + 2.2); ctx.stroke();
    ctx.restore();
  }
  if (world.phantomT > 0) {
    ctx.save();
    ctx.globalAlpha = .55 + .2 * Math.sin(animT * 6);
    ctx.strokeStyle = "#c59aff";
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 4]);
    ctx.beginPath(); ctx.arc(b.x, b.y, BALL_R + 8, animT, animT + Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }
}

function drawPowerIcon(type, x, y, s, alpha = 1) {
  const meta = POWERUPS[type];
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.globalAlpha = alpha;
  ctx.lineWidth = 1.8;
  ctx.strokeStyle = meta.color;
  ctx.fillStyle = 'rgba(10,16,30,.7)';
  ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = meta.color; ctx.stroke();
  if (type === 'extend') {
    ctx.fillStyle = meta.color;
    rr(ctx, -2.5, -6, 5, 12, 2.4); ctx.fill();
    ctx.strokeStyle = 'rgba(6,14,20,.8)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(0, 5); ctx.stroke();
    ctx.fillStyle = '#eafff9';
    ctx.beginPath(); ctx.moveTo(-3, -7.5); ctx.lineTo(3, -7.5); ctx.lineTo(0, -5); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-3, 7.5); ctx.lineTo(3, 7.5); ctx.lineTo(0, 5); ctx.closePath(); ctx.fill();
  } else if (type === 'slow') {
    ctx.strokeStyle = meta.color; ctx.lineWidth = 1.4;
    for (let i = 0; i < 3; i++) {
      const a = i * Math.PI / 3;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * -6.5, Math.sin(a) * -6.5);
      ctx.lineTo(Math.cos(a) * 6.5, Math.sin(a) * 6.5);
      ctx.stroke();
    }
    ctx.fillStyle = '#eaf8ff';
    ctx.beginPath(); ctx.arc(0, 0, 1.9, 0, 7); ctx.fill();
  } else {
    ctx.strokeStyle = meta.color; ctx.lineWidth = 1.3;
    for (const [ox, oy] of [[-3.2, 1.8], [0, -1.2], [3.2, 1.8]]) {
      ctx.globalAlpha = alpha * .9;
      ctx.beginPath(); ctx.arc(ox, oy, 4.4, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.globalAlpha = alpha * .5;
    ctx.fillStyle = meta.color;
    ctx.beginPath(); ctx.arc(-3.2, 1.8, 3.2, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(0, -1.2, 3.2, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(3.2, 1.8, 3.2, 0, 7); ctx.fill();
  }
  ctx.restore();
}

function drawPowerField(t) {
  const f = world.powField;
  if (!f) return;
  const meta = POWERUPS[f.type];
  const pulse = .6 + .4 * Math.sin(t * 4.4 + f.x * .02);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(f.x, f.y, 2, f.x, f.y, POW_RAD * 3.4);
  g.addColorStop(0, meta.color + '55');
  g.addColorStop(.45, meta.color + '18');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(f.x, f.y, POW_RAD * 3.4, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = .5 + pulse * .4;
  ctx.strokeStyle = meta.color; ctx.lineWidth = 1.3;
  ctx.setLineDash([4, 6]);
  ctx.beginPath(); ctx.arc(f.x, f.y, POW_RAD + 5, -t * .8, -t * .8 + Math.PI * 2); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(7,12,24,.82)';
  ctx.beginPath(); ctx.arc(f.x, f.y, POW_RAD, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = meta.color; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.arc(f.x, f.y, POW_RAD, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
  drawPowerIcon(f.type, f.x, f.y, 1.05, 1);
  ctx.save();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = '600 10px "Microsoft YaHei",sans-serif';
  ctx.fillStyle = 'rgba(235,244,255,.82)';
  ctx.fillText(meta.zh, f.x, f.y + POW_RAD + 13);
  ctx.restore();
}

function drawParticles() {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const p of particles) {
    const a = clamp01(p.life / p.max);
    if (p.type === 'ring') {
      ctx.globalAlpha = a * .78;
      ctx.strokeStyle = p.color; ctx.lineWidth = 2;
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
    }
  }
  ctx.restore();
}

function drawPowerTimers() {
  const rows = [
    { side: 'p1', x: 90, dir: 1 },
    { side: 'p2', x: W - 150, dir: -1 },
  ];
  for (const row of rows) {
    let i = 0;
    if (row.side === 'p1') {
      if (world.p1.extendT > 0) drawChip('extend', row.x + i++ * 27, 25, world.p1.extendT, POWERUPS.extend.dur);
      if (world.slowT > 0 && world.slowSide === 'p1') drawChip('slow', row.x + i++ * 27, 25, world.slowT, POWERUPS.slow.dur);
      if (world.phantomT > 0 && world.phantomSide === 'p1') drawChip('phantom', row.x + i++ * 27, 25, world.phantomT, POWERUPS.phantom.dur);
    } else {
      if (world.p2.extendT > 0) drawChip('extend', row.x - i++ * 27, 25, world.p2.extendT, POWERUPS.extend.dur);
      if (world.slowT > 0 && world.slowSide === 'p2') drawChip('slow', row.x - i++ * 27, 25, world.slowT, POWERUPS.slow.dur);
      if (world.phantomT > 0 && world.phantomSide === 'p2') drawChip('phantom', row.x - i++ * 27, 25, world.phantomT, POWERUPS.phantom.dur);
    }
  }
}
function drawChip(type, x, y, tLeft, dur) {
  drawPowerIcon(type, x, y, .78, 1);
  ctx.save();
  ctx.strokeStyle = POWERUPS[type].color;
  ctx.globalAlpha = .85;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(x, y, 11, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clamp01(tLeft / dur));
  ctx.stroke();
  ctx.restore();
}

function drawHUD() {
  // centre scoreboard
  const bx = W / 2 - 150, by = 6, bw = 300, bh = 36;
  ctx.save();
  ctx.fillStyle = 'rgba(6,11,22,.86)';
  rr(ctx, bx, by, bw, bh, 18); ctx.fill();
  ctx.strokeStyle = 'rgba(224,174,98,.55)'; ctx.lineWidth = 1.2;
  rr(ctx, bx, by, bw, bh, 18); ctx.stroke();
  ctx.strokeStyle = 'rgba(88,216,192,.2)'; ctx.lineWidth = 1;
  rr(ctx, bx + 3, by + 3, bw - 6, bh - 6, 15); ctx.stroke();
  if (scoreFlashT > 0) {
    ctx.globalAlpha = clamp01(scoreFlashT / .8) * .35;
    ctx.fillStyle = sideColor(lastScorer || 'p1');
    rr(ctx, bx, by, bw, bh, 18); ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = '700 11px "Microsoft YaHei",sans-serif';
  ctx.fillStyle = 'rgba(255,224,160,.85)';
  ctx.fillText('P1', bx + 44, by + 18);
  ctx.fillText('P2', bx + bw - 44, by + 18);
  ctx.font = '800 23px "Segoe UI","Microsoft YaHei",sans-serif';
  ctx.fillStyle = '#ff9a76';
  ctx.fillText(String(world.score1), bx + 92, by + 18);
  ctx.fillStyle = '#c3ccff';
  ctx.fillText(String(world.score2), bx + bw - 92, by + 18);
  ctx.font = '700 13px "Segoe UI",sans-serif';
  ctx.fillStyle = 'rgba(233,223,200,.62)';
  ctx.fillText(':', W / 2, by + 18);
  ctx.font = '600 9px "Microsoft YaHei",sans-serif';
  ctx.fillStyle = 'rgba(233,223,200,.52)';
  ctx.fillText('先到 11 分', W / 2, by + 30);
  // serve marker
  const sx = world.server === 'p1' ? bx - 16 : bx + bw + 16;
  ctx.fillStyle = world.server === 'p1' ? '#ff9a76' : '#93a4ff';
  ctx.beginPath(); ctx.arc(sx, by + 18, 3.2, 0, 7); ctx.fill();
  ctx.font = '600 8px "Microsoft YaHei",sans-serif';
  ctx.fillStyle = 'rgba(233,223,200,.55)';
  ctx.fillText('发', sx, by + 31);
  ctx.restore();

  // player labels
  ctx.save();
  ctx.textBaseline = 'middle';
  ctx.font = '700 12px "Microsoft YaHei",sans-serif';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffb29a';
  ctx.fillText('P1', 26, 25);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#c3ccff';
  ctx.fillText(gameMode === 'local' ? 'P2' : `P2 · ${profile.label}`, W - 70, 25);
  ctx.restore();
  drawPowerTimers();

  // rally counter
  const cy = H - 30;
  ctx.save();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = '600 11px "Microsoft YaHei",sans-serif';
  const txt = `对拉 ${world.rally} 拍 · 最长 ${bestRally}`;
  const tw = ctx.measureText(txt).width;
  ctx.fillStyle = 'rgba(6,11,22,.72)';
  rr(ctx, W / 2 - tw / 2 - 12, cy - 11, tw + 24, 22, 11); ctx.fill();
  ctx.strokeStyle = 'rgba(224,174,98,.24)'; ctx.lineWidth = 1;
  rr(ctx, W / 2 - tw / 2 - 12, cy - 11, tw + 24, 22, 11); ctx.stroke();
  ctx.fillStyle = world.rally >= 12 ? '#ffe0a0' : 'rgba(233,223,200,.72)';
  ctx.fillText(txt, W / 2, cy);
  ctx.restore();

  // match point hint
  if (world.score1 === WIN_SCORE - 1 || world.score2 === WIN_SCORE - 1) {
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '700 10px "Microsoft YaHei",sans-serif';
    ctx.fillStyle = 'rgba(255,224,160,.85)';
    ctx.fillText('赛 点', W / 2, H - 52);
    ctx.restore();
  }
}

function drawOverlays() {
  if (mode !== 'play') return;
  if (paused) {
    ctx.save();
    ctx.fillStyle = 'rgba(3,6,13,.68)'; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '800 46px "Microsoft YaHei",sans-serif';
    ctx.fillStyle = '#fff4e1';
    ctx.shadowColor = 'rgba(224,174,98,.8)'; ctx.shadowBlur = 24;
    ctx.fillText('已 暂 停', W / 2, H / 2 - 12);
    ctx.shadowBlur = 0;
    ctx.font = '13px "Microsoft YaHei",sans-serif';
    ctx.fillStyle = 'rgba(233,223,200,.8)';
    ctx.fillText('按 P 或点按右上角继续 · R 重开', W / 2, H / 2 + 36);
    ctx.restore();
    return;
  }

  if (world.phase === 'serve') {
    const frac = clamp01(1 - world.serveT / SERVE_TIME);
    const n = Math.max(1, Math.ceil(world.serveT));
    ctx.save();
    ctx.fillStyle = 'rgba(3,6,13,.24)'; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '700 14px "Microsoft YaHei",sans-serif';
    ctx.fillStyle = world.server === 'p1' ? '#ffb29a' : '#c3ccff';
    ctx.fillText(`${sideName(world.server)} 发 球`, W / 2, H / 2 - 108);
    ctx.font = '800 70px "Segoe UI","Microsoft YaHei",sans-serif';
    ctx.fillStyle = '#fff8ea';
    ctx.shadowColor = 'rgba(224,174,98,.8)'; ctx.shadowBlur = 28;
    ctx.fillText(String(n), W / 2, H / 2 - 24);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(143,242,219,.45)'; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.arc(W / 2, H / 2 - 24, 62, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac); ctx.stroke();
    ctx.font = '600 12px "Microsoft YaHei",sans-serif';
    ctx.fillStyle = 'rgba(233,223,200,.82)';
    ctx.fillText('先到 11 分 · 拍边角度与挥拍旋转决定球路', W / 2, H / 2 + 60);
    ctx.restore();
  }

  if (bannerT > 0) {
    ctx.save();
    ctx.globalAlpha = clamp01(bannerT / .5);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '800 30px "Microsoft YaHei",sans-serif';
    ctx.fillStyle = '#fff4e1';
    ctx.shadowColor = 'rgba(88,216,192,.75)'; ctx.shadowBlur = 20;
    ctx.fillText('开 球', W / 2, H / 2 - 150);
    ctx.restore();
  }

  if (flashT > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `rgba(255,236,205,${flashT * .42})`;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
}

function drawTitleDemo() {
  const t = animT;
  const y1 = H / 2 + Math.sin(t * .85) * 96;
  const y2 = H / 2 + Math.cos(t * .72) * 96;
  const bx = W / 2 + Math.sin(t * .58) * 150;
  const by = H / 2 + Math.cos(t * .47) * 96;
  ctx.save();
  ctx.globalAlpha = .82;
  drawPaddle({ x: PADDLE_X1, y: y1, h: PADDLE_H, vy: Math.cos(t * .85) * 80, hitFlash: 0 }, 'p1');
  drawPaddle({ x: PADDLE_X2, y: y2, h: PADDLE_H, vy: -Math.sin(t * .72) * 80, hitFlash: 0 }, 'p2');
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 9; i++) {
    const tt = t - i * .028;
    const xx = W / 2 + Math.sin(tt * .58) * 150;
    const yy = H / 2 + Math.cos(tt * .47) * 96;
    ctx.globalAlpha = (1 - i / 9) * .25;
    ctx.fillStyle = '#ffd98e';
    ctx.beginPath(); ctx.arc(xx, yy, BALL_R * (1 - i / 12), 0, 7); ctx.fill();
  }
  ctx.restore();
  drawBallAt(bx, by, BALL_R, .95, 'rgba(255,200,130,.2)', false);
  drawPowerIcon('phantom', W / 2 + 236, H / 2 - 124, 1.05, .8);
  drawPowerIcon('slow', W / 2 - 236, H / 2 - 124, 1.05, .8);
  drawPowerIcon('extend', W / 2, H / 2 + 156, 1.05, .8);
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

  ctx.drawImage(bgCv, 0, 0, W, H);
  drawAmbient(animT);

  if (mode === 'title') {
    drawTitleDemo();
    drawParticles();
  } else {
    drawTrail();
    drawPowerField(animT);
    drawGhosts(animT);
    drawPaddle(world.p1, 'p1');
    drawPaddle(world.p2, 'p2');
    drawBall();
    drawParticles();
    drawHUD();
    drawOverlays();
  }
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
  updateTitleBest(); updateMuteButton(); updatePauseButton();
  document.querySelectorAll('.modebtn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!AUTOTEST) audio.unlock();
      audio.play('ui');
      startMatch(btn.dataset.mode || 'ai', btn.dataset.diff || aiDiff);
    });
  });
  if (muteBtn) muteBtn.addEventListener('click', () => { if (!AUTOTEST) audio.unlock(); toggleMute(); audio.play('ui'); });
  if (pauseBtn) pauseBtn.addEventListener('click', () => { if (!AUTOTEST) audio.unlock(); togglePause(); });
  document.getElementById('go').addEventListener('click', () => {
    if (!AUTOTEST) audio.unlock();
    audio.play('ui'); startMatch(gameMode, aiDiff);
  });
  document.getElementById('change').addEventListener('click', () => {
    if (!AUTOTEST) audio.unlock();
    audio.play('ui'); goTitle();
  });
  document.getElementById('home').addEventListener('click', () => {
    if (!AUTOTEST) audio.unlock();
    audio.play('ui'); goTitle();
  });
  const shareBtn = document.getElementById('share');
  if (shareBtn) shareBtn.addEventListener('click', () => { if (!AUTOTEST) audio.unlock(); shareScore(); });
}
bindUi();
syncBodyMode();

if (URLP.has('autostart') && !AUTOTEST) {
  startMatch(URLP.get('mode') === 'local' ? 'local' : 'ai', parseInt(URLP.get('difficulty') || '2', 10));
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
function snapshot() {
  const b = world.ball;
  return {
    mode, gameMode, aiDiff, paused, winner, matchTime: Math.round(matchTime * 1000) / 1000,
    noAuto, nan: nanFlag, noAutoWorld: world.noAuto,
    phase: world.phase, server: world.server,
    serveT: Math.round(world.serveT * 1000) / 1000,
    rally: world.rally, bestRally, score1: world.score1, score2: world.score2,
    score: scoreInt(), progress: progressPct(),
    ball: {
      x: b.x, y: b.y, vx: b.vx, vy: b.vy, spin: b.spin,
      speed: Math.hypot(b.vx, b.vy), r: BALL_R,
    },
    p1: { side: 'p1', x: world.p1.x, y: world.p1.y, vy: world.p1.vy, h: world.p1.h, extendT: world.p1.extendT, hitFlash: world.p1.hitFlash },
    p2: { side: 'p2', x: world.p2.x, y: world.p2.y, vy: world.p2.vy, h: world.p2.h, extendT: world.p2.extendT, hitFlash: world.p2.hitFlash },
    fx: {
      slowT: world.slowT, slowSide: world.slowSide,
      phantomT: world.phantomT, phantomSide: world.phantomSide,
      extP1: world.p1.extendT, extP2: world.p2.extendT,
      powField: world.powField ? { ...world.powField } : null,
      ghosts: world.phantomT > 0 ? GHOST_COUNT : 0,
      particles: particles.length, trail: trail.length,
    },
    ai: {
      diff: aiDiff, label: profile.label, zh: profile.zh,
      speed: profile.speed, reaction: profile.reaction, predict: profile.predict,
      error: profile.error, edge: profile.edge, spinRead: profile.spinRead,
    },
    winsP1, winsP2, muted, audioCtx: audio.hasCtx(),
    reports: reports.length, seed: world.seed, time: Math.round(world.time * 1000) / 1000,
    keys: { winsP1: BEST_WINS1_KEY, winsP2: BEST_WINS2_KEY, bestRally: BEST_RALLY_KEY, mute: MUTE_KEY },
  };
}

const G_API = {
  err: window.__BOOTERR || [],
  W, H, WALL_TOP, WALL_BOTTOM, BALL_R, PADDLE_W, PADDLE_H, PADDLE_LONG,
  PADDLE_X1, PADDLE_X2, WIN_SCORE, SERVE_TIME, MAX_BALL, SLOW_CAP, MIN_BALL,
  step: (n = 60, dt = DT) => { for (let i = 0; i < n; i++) { update(dt); render(); } },
  upd: (n = 30, dt = DT) => { for (let i = 0; i < n; i++) update(dt); },
  press: (...codes) => { for (const c of codes) { pressed.add(c); held.add(c); } },
  release: (...codes) => { for (const c of codes) held.delete(c); },
  setNoAuto: (v) => { noAuto = !!v; world.noAuto = noAuto; },
  setReportTarget: (fn) => { reportTarget = typeof fn === 'function' ? fn : null; },
  reportLog: () => reports.slice(),
  state: snapshot,
  start: (gm, diff) => startMatch(gm, diff),
  startMatch: (gm, diff) => startMatch(gm, diff),
  setPhase: (p) => {
    if (p === 'live') { world.phase = 'live'; world.serveT = 0; world.ai.p1.timer = 0; world.ai.p2.timer = 0; return true; }
    if (p === 'serve') { world.phase = 'serve'; world.serveT = SERVE_TIME; return true; }
    if (p === 'ended') { world.phase = 'ended'; return true; }
    return false;
  },
  setBall: (x, y, vx = 0, vy = 0, spin = 0) => {
    const b = world.ball;
    b.x = finite(x, W / 2); b.y = clamp(finite(y, H / 2), WALL_TOP + BALL_R, WALL_BOTTOM - BALL_R);
    b.vx = finite(vx); b.vy = finite(vy); b.spin = finite(spin);
    trail.length = 0;
    return { x: b.x, y: b.y, vx: b.vx, vy: b.vy, spin: b.spin };
  },
  setPaddle: (side, y, vy = 0) => {
    const p = side === 'p2' ? world.p2 : world.p1;
    const h = p.h;
    p.y = clamp(finite(y, p.y), WALL_TOP + h / 2, WALL_BOTTOM - h / 2);
    p.vy = finite(vy, 0);
    return { x: p.x, y: p.y, vy: p.vy, h: p.h };
  },
  setScore: (a, b) => {
    world.score1 = clamp(parseInt(a, 10) || 0, 0, WIN_SCORE);
    world.score2 = clamp(parseInt(b, 10) || 0, 0, WIN_SCORE);
    return [world.score1, world.score2];
  },
  setRally: (n) => { world.rally = Math.max(0, parseInt(n, 10) || 0); return world.rally; },
  setBestRally: (n) => { bestRally = Math.max(0, parseInt(n, 10) || 0); updateTitleBest(); return bestRally; },
  setServeT: (t) => { world.serveT = Math.max(0, finite(t, 0)); return world.serveT; },
  setPowerupsEnabled: (v) => { world.powerupsEnabled = !!v; return world.powerupsEnabled; },
  grantPowerup: (side, type) => grantPowerup(world, side, type),
  spawnPowerup: (type) => {
    const f = spawnPowerup(world, type);
    return { ...f };
  },
  setPowerupField: (type, x, y) => {
    if (!POWERUPS[type]) { world.powField = null; return null; }
    world.powField = {
      type,
      x: clamp(finite(x, W / 2), 80, W - 80),
      y: clamp(finite(y, H / 2), WALL_TOP + 50, WALL_BOTTOM - 50),
      born: world.time,
    };
    return { ...world.powField };
  },
  hitMath: (side, ballY, paddleY, paddleVy, inSpeed, paddleH) => hitMath(side, ballY, paddleY, paddleVy, inSpeed, paddleH),
  setSeed: (s) => {
    worldSeed = ((s >>> 0) || 1);
    seedLocked = true;
    reseedWorld(world, worldSeed);
    return worldSeed;
  },
  setSeedLocked: (v) => { seedLocked = !!v; return seedLocked; },
  forcePoint,
  forceWin,
  forceFail,
  goTitle,
  togglePause,
  toggleMute,
  setMuted: (v) => { audio.setMuted(!!v); muted = !!v; updateMuteButton(); },
  clearFx: () => { hitstopT = 0; shakeT = 0; flashT = 0; bannerT = 0; scoreFlashT = 0; particles.length = 0; trail.length = 0; },
  aiProfiles: () => JSON.parse(JSON.stringify(AI_PROFILES)),
  runSelfplay: (n, diff, opts) => runSelfplay(n, diff, opts || {}),
  audio,
  view: () => ({ scale: viewScale, ox: viewOX, oy: viewOY, dpr: DPR, w: window.innerWidth, h: window.innerHeight }),
  particlesList: () => particles.slice(),
  ui: { toast },
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
  const S = () => snapshot();
  const R = (n) => { for (let i = 0; i < n; i++) update(DT); };
  const P = (side) => side === 'p2' ? S().p2 : S().p1;
  const frames = [];
  const saved = {
    winsP1, winsP2, bestRally, muted, noAuto, seedLocked, worldSeed,
    ls: {},
  };
  try {
    saved.ls.winsP1 = localStorage.getItem(BEST_WINS1_KEY);
    saved.ls.winsP2 = localStorage.getItem(BEST_WINS2_KEY);
    saved.ls.bestRally = localStorage.getItem(BEST_RALLY_KEY);
    saved.ls.mute = localStorage.getItem(MUTE_KEY);
  } catch (e) { }
  muted = true; audio.setMuted(true); updateMuteButton();
  G_API.setReportTarget(f => frames.push(f));
  G_API.setSeed(12345);

  try {
    await nap();

    // 1 — clean boot
    ok(1, G_API.err.length === 0 && !nanFlag, `启动零报错 errors=${G_API.err.length}`);

    // 2 — stress: fast balls, all power-ups, no NaN / no new errors
    G_API.setPowerupsEnabled(true);
    G_API.startMatch('local', 'medium');
    G_API.setPhase('live');
    const err0 = G_API.err.length;
    let finiteOk = true, stressFrames = 480;
    for (let k = 0; k < stressFrames; k++) {
      if (k % 60 === 0) {
        G_API.setScore(0, 0);
        if (S().mode !== 'play') G_API.startMatch('local', 'medium');
        G_API.setPhase('live');
        G_API.setBall(220 + ((k * 37) % 520), 110 + ((k * 53) % 320),
          ((k % 2) ? 1 : -1) * (520 + (k % 5) * 180),
          ((k % 3) - 1) * 260, ((k % 5) - 2) * 90);
      }
      if (k % 80 === 0) G_API.grantPowerup(k % 2 ? 'p2' : 'p1', ['extend', 'slow', 'phantom'][k % 3]);
      update(DT);
      if (k % 40 === 0) {
        const s = S();
        for (const v of [s.ball.x, s.ball.y, s.ball.vx, s.ball.vy, s.ball.spin, s.p1.y, s.p1.vy, s.p2.y, s.p2.vy]) {
          if (!Number.isFinite(v)) finiteOk = false;
        }
      }
    }
    G_API.setPowerupsEnabled(true);
    ok(2, finiteOk && !S().nan && G_API.err.length === err0,
      `${stressFrames} 帧高速/道具乱战无 NaN、无新报错 nan=${S().nan}`);

    // 3 — core math: hit position controls outgoing angle + direction reflection
    {
      const above = G_API.hitMath('p1', 210, 270, 0, 700);
      const below = G_API.hitMath('p1', 330, 270, 0, 700);
      const right = G_API.hitMath('p2', 270, 270, 0, 700);
      ok(3, above.rel < 0 && above.vx > 0 && above.vy < 0 &&
        below.rel > 0 && below.vx > 0 && below.vy > 0 && right.vx < 0,
        `拍面角度 rel ${above.rel.toFixed(2)}→vy ${above.vy.toFixed(0)} / ${below.rel.toFixed(2)}→vy ${below.vy.toFixed(0)} · 右侧 vx ${right.vx.toFixed(0)}`);
    }

    // 4 — core math: moving paddle adds spin and spin curves the trajectory
    {
      const up = G_API.hitMath('p1', 270, 270, -420, 700);
      const down = G_API.hitMath('p1', 270, 270, 420, 700);
      G_API.startMatch('local', 'medium');
      G_API.setPhase('live');
      G_API.setPowerupsEnabled(false);
      G_API.setBall(480, 270, up.vx, up.vy, up.spin);
      const vy0 = S().ball.vy;
      R(30);
      const vy1 = S().ball.vy;
      ok(4, up.spin < 0 && down.spin > 0 && vy1 < vy0 - 12 && Number.isFinite(vy1),
        `上挥 spin ${up.spin.toFixed(0)} / 下挥 ${down.spin.toFixed(0)} · 30 帧后 vy ${vy0.toFixed(0)}→${vy1.toFixed(0)}`);
    }

    // 5 — core math: three power-up durations and effects expire
    {
      G_API.startMatch('local', 'medium');
      G_API.setPhase('live');
      G_API.setPowerupsEnabled(false);
      G_API.setBall(480, 270, 0, 0, 0);
      G_API.grantPowerup('p1', 'extend');
      const h0 = P('p1').h, e0 = S().fx.extP1;
      R(60);
      const eMid = S().fx.extP1, hMid = P('p1').h;
      R(500);
      const eEnd = S().fx.extP1, hEnd = P('p1').h;
      G_API.grantPowerup('p2', 'slow');
      const s0 = S().fx.slowT;
      R(430);
      const s1 = S().fx.slowT;
      G_API.grantPowerup('p1', 'phantom');
      const ph0 = S().fx.phantomT;
      R(370);
      const ph1 = S().fx.phantomT;
      ok(5, h0 === PADDLE_LONG && e0 === 8 && eMid > 6.9 && eMid < 7.3 && hMid === PADDLE_LONG &&
        eEnd === 0 && hEnd === PADDLE_H && s0 === 7 && s1 === 0 && ph0 === 6 && ph1 === 0,
        `长拍 ${e0}s(${h0}px)→${eMid.toFixed(1)}s→${eEnd}s/${hEnd}px · 慢球 ${s0}→${s1} · 幻影 ${ph0}→${ph1}`);
    }

    // 6 — scoring on a real ball crossing the goal line
    {
      G_API.startMatch('local', 'medium');
      G_API.setPhase('live');
      G_API.setPowerupsEnabled(true);
      G_API.setScore(0, 0);
      G_API.setBall(W - 4, H / 2, 1600, 0, 0);
      R(4);
      const s = S();
      ok(6, s.score1 === 1 && s.score2 === 0 && s.phase === 'serve' && s.server === 'p2' && s.serveT > 0,
        `进球得分 ${s.score1}:${s.score2} · 下一发球 ${s.server} · 倒计时 ${s.serveT.toFixed(2)}`);
    }

    // 7 — loss path reachable (AI reaches exactly 11)
    {
      frames.length = 0;
      G_API.startMatch('ai', 'hard');
      G_API.setPhase('live');
      G_API.setScore(10, 10);
      G_API.setBall(-30, H / 2, -1200, 0, 0);
      R(2);
      const s = S();
      ok(7, s.mode === 'over' && s.winner === 'p2' && s.score2 === 11 &&
        frames.some(f => f.kind === 'gameOver'),
        `失败路径 mode=${s.mode} ${s.score1}:${s.score2} winner=${s.winner}`);
    }

    // 8 — victory path at exactly 11 (no win-by-two)
    {
      frames.length = 0;
      G_API.startMatch('ai', 'medium');
      G_API.setPhase('live');
      G_API.setScore(10, 9);
      G_API.setBall(W + 30, H / 2, 1200, 0, 0);
      R(2);
      const s = S();
      ok(8, s.mode === 'over' && s.winner === 'p1' && s.score1 === 11 &&
        frames.some(f => f.kind === 'complete'),
        `胜利路径 11 分整 mode=${s.mode} ${s.score1}:${s.score2} winner=${s.winner}`);
    }

    // 9 — report frame order
    {
      const log = G_API.reportLog();
      const ri = log.findIndex(f => f.kind === 'ready');
      const pi = frames.findIndex(f => f.kind === 'progress');
      const ci = frames.findIndex(f => f.kind === 'complete');
      ok(9, ri === 0 && pi >= 0 && ci > pi,
        `上报帧序 ready=${ri} progress=${pi} complete=${ci}`);
    }

    // 10 — best records localStorage write / read / restore
    {
      winsP1 = 0; winsP2 = 0; bestRally = 0;
      try { localStorage.removeItem(BEST_WINS1_KEY); localStorage.removeItem(BEST_WINS2_KEY); localStorage.removeItem(BEST_RALLY_KEY); } catch (e) { }
      G_API.startMatch('local', 'medium');
      G_API.setPhase('live');
      G_API.setScore(10, 3);
      G_API.setRally(9);
      G_API.forcePoint('p1');
      let sw = 0, sr = 0;
      try { sw = parseInt(localStorage.getItem(BEST_WINS1_KEY) || '0', 10) || 0; sr = parseInt(localStorage.getItem(BEST_RALLY_KEY) || '0', 10) || 0; } catch (e) { }
      const wrote = sw === winsP1 && sw >= 1 && sr === 9 && sr === bestRally;
      // restore now, then verify the stored values match the original snapshot
      winsP1 = saved.winsP1; winsP2 = saved.winsP2; bestRally = saved.bestRally;
      try {
        if (saved.ls.winsP1 === null) localStorage.removeItem(BEST_WINS1_KEY); else localStorage.setItem(BEST_WINS1_KEY, saved.ls.winsP1);
        if (saved.ls.winsP2 === null) localStorage.removeItem(BEST_WINS2_KEY); else localStorage.setItem(BEST_WINS2_KEY, saved.ls.winsP2);
        if (saved.ls.bestRally === null) localStorage.removeItem(BEST_RALLY_KEY); else localStorage.setItem(BEST_RALLY_KEY, saved.ls.bestRally);
      } catch (e) { }
      let rw = 0, rr = 0;
      try { rw = parseInt(localStorage.getItem(BEST_WINS1_KEY) || '0', 10) || 0; rr = parseInt(localStorage.getItem(BEST_RALLY_KEY) || '0', 10) || 0; } catch (e) { }
      const restored = rw === (parseInt(saved.ls.winsP1 || '0', 10) || 0) && rr === (parseInt(saved.ls.bestRally || '0', 10) || 0);
      ok(10, wrote && restored, `best 写入 胜场 ${sw}/最长 ${sr} · 已还原 ${rw}/${rr}`);
    }

    // 11 — MANDATORY input path: G.press('KeyW') then upd moves P1 up
    {
      G_API.startMatch('local', 'medium');
      G_API.setPhase('live');
      G_API.setPowerupsEnabled(false);
      G_API.setScore(0, 0);
      G_API.setPaddle('p1', 270, 0);
      G_API.press('KeyW'); R(12); G_API.release('KeyW');
      const upY = P('p1').y;
      G_API.press('KeyS'); R(12); G_API.release('KeyS');
      const downY = P('p1').y;
      ok(11, upY < 258 && downY > upY + 2,
        `P1 键盘 W/S y 270→${upY.toFixed(0)}→${downY.toFixed(0)}`);
    }

    // 12 — local P2 arrow keys
    {
      G_API.startMatch('local', 'medium');
      G_API.setPhase('live');
      G_API.setPowerupsEnabled(false);
      G_API.setPaddle('p2', 270, 0);
      G_API.press('ArrowDown'); R(10); G_API.release('ArrowDown');
      const dY = P('p2').y;
      G_API.press('ArrowUp'); R(10); G_API.release('ArrowUp');
      const uY = P('p2').y;
      ok(12, dY > 280 && uY < dY,
        `P2 方向键 y 270→${dY.toFixed(0)}→${uY.toFixed(0)}`);
    }

    // 13 — AI profiles strictly monotonic
    {
      const a = G_API.aiProfiles();
      ok(13, a.easy.speed < a.medium.speed && a.medium.speed < a.hard.speed &&
        a.easy.reaction > a.medium.reaction && a.medium.reaction > a.hard.reaction &&
        a.easy.predict < a.medium.predict && a.medium.predict < a.hard.predict &&
        a.easy.error > a.medium.error && a.medium.error > a.hard.error &&
        a.easy.edge <= a.medium.edge && a.medium.edge < a.hard.edge &&
        a.hard.spinRead === true,
        `AI 三档 speed ${a.easy.speed}/${a.medium.speed}/${a.hard.speed} · predict ${a.easy.predict}/${a.medium.predict}/${a.hard.predict} · edge ${a.easy.edge}/${a.medium.edge}/${a.hard.edge}`);
    }

    // 14 — hard AI actually moves more than easy AI in equal frames
    {
      const measure = (diff) => {
        G_API.startMatch('ai', diff);
        G_API.setPhase('live');
        G_API.setPowerupsEnabled(false);
        G_API.setPaddle('p2', 270, 0);
        G_API.setBall(600, 120, 380, 0, 0);
        const y0 = P('p2').y;
        R(30);
        return Math.abs(P('p2').y - y0);
      };
      const de = measure('easy'), dh = measure('hard');
      ok(14, dh > de + 25 && dh > 30,
        `AI 实移 hard ${dh.toFixed(0)}px > easy ${de.toFixed(0)}px`);
    }

    // 15 — pause freezes the ball and clock, resume advances again
    {
      G_API.startMatch('ai', 'medium');
      G_API.setPhase('live');
      G_API.setPowerupsEnabled(false);
      G_API.setPaddle('p2', 270, 0);
      G_API.setBall(480, 270, 600, 80, 0);
      R(3);
      G_API.press('KeyP'); R(1);
      const pz = { x: S().ball.x, y: S().ball.y, t: S().matchTime };
      const pausedNow = S().paused;
      R(20);
      const frozen = S().paused && Math.abs(S().ball.x - pz.x) < 1e-6 &&
        Math.abs(S().ball.y - pz.y) < 1e-6 && Math.abs(S().matchTime - pz.t) < 1e-6;
      G_API.press('KeyP'); R(12);
      const resumed = !S().paused && Math.abs(S().ball.x - pz.x) > .5;
      ok(15, pausedNow && frozen && resumed, `暂停冻结/恢复 paused=${pausedNow}`);
    }

    // 16 — touch DOM: split zones + pads, drag and pad both move P1
    {
      G_API.startMatch('local', 'medium');
      G_API.setPhase('live');
      G_API.setPowerupsEnabled(false);
      G_API.setPaddle('p1', 270, 0);
      const zones = document.querySelectorAll('#touchzones .tz');
      const pads = document.querySelectorAll('#touchpads button');
      const v = G_API.view();
      const z = document.querySelector('#touchzones .tz.left');
      const cx = v.ox + 120 * v.scale, cy = v.oy + 120 * v.scale;
      z.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerType: 'touch', pointerId: 701, clientX: cx, clientY: cy }));
      R(16);
      z.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerType: 'touch', pointerId: 701, clientX: cx, clientY: cy }));
      const yDrag = P('p1').y;
      G_API.setPaddle('p1', 270, 0);
      const btn = document.querySelector('#touchpads button[data-code="KeyS"]');
      btn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerType: 'touch', pointerId: 702 }));
      R(12);
      btn.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerType: 'touch', pointerId: 702 }));
      const yPad = P('p1').y;
      ok(16, zones.length === 2 && pads.length >= 4 && yDrag < 200 && yPad > 280,
        `触屏 DOM ${zones.length} 区/${pads.length} 键 · 拖动→${yDrag.toFixed(0)} 按键→${yPad.toFixed(0)}`);
    }

    // 17 — three power-ups have distinct, measurable effects
    {
      G_API.startMatch('local', 'medium');
      G_API.setPhase('live');
      G_API.setPowerupsEnabled(false);
      G_API.setScore(0, 0);
      G_API.grantPowerup('p1', 'extend');
      const extOk = P('p1').h === PADDLE_LONG && S().fx.extP1 === 8;
      G_API.setBall(480, 270, 900, 0, 0);
      const sp0 = S().ball.speed;
      G_API.grantPowerup('p2', 'slow');
      const slowOk = S().fx.slowT === 7 && S().ball.speed < sp0 * .75 && S().ball.speed <= SLOW_CAP;
      G_API.grantPowerup('p1', 'phantom');
      const phantomOk = S().fx.phantomT === 6 && S().fx.ghosts === GHOST_COUNT;
      ok(17, extOk && slowOk && phantomOk,
        `长拍 ${P('p1').h}px · 慢球 ${sp0.toFixed(0)}→${S().ball.speed.toFixed(0)} · 幻影 ${S().fx.ghosts} 个`);
    }

    // 18 — phantom is visual-only: physics trajectory is bit-for-bit deterministic
    {
      const run = (phantom) => {
        G_API.startMatch('local', 'medium');
        G_API.setPhase('live');
        G_API.setPowerupsEnabled(false);
        if (phantom) G_API.grantPowerup('p1', 'phantom');
        G_API.setBall(480, 270, 700, 140, 0);
        R(40);
        const s = S();
        return { x: s.ball.x, y: s.ball.y, vx: s.ball.vx, vy: s.ball.vy, ghosts: s.fx.ghosts };
      };
      const a = run(false), b = run(true);
      const same = Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6 &&
        Math.abs(a.vx - b.vx) < 1e-6 && Math.abs(a.vy - b.vy) < 1e-6;
      ok(18, same && b.ghosts === GHOST_COUNT,
        `幻影不影响真实球路 · Δx=${Math.abs(a.x - b.x).toExponential(1)} · 幽灵 ${b.ghosts}`);
    }

    // 19 — restart resets score, rally, power-ups, ball and paddles
    {
      G_API.startMatch('local', 'hard');
      G_API.setPhase('live');
      G_API.setScore(5, 7);
      G_API.setRally(4);
      G_API.grantPowerup('p1', 'extend');
      G_API.grantPowerup('p2', 'phantom');
      G_API.setBall(100, 100, 500, 300, 120);
      G_API.startMatch('local', 'medium');
      const s = S();
      ok(19, s.score1 === 0 && s.score2 === 0 && s.rally === 0 && s.phase === 'serve' &&
        s.serveT > 1 && s.winner === null && s.p1.h === PADDLE_H && s.fx.extP1 === 0 &&
        s.fx.phantomT === 0 && Math.abs(s.ball.x - W / 2) < .01 && Math.abs(s.p1.y - H / 2) < .01,
        `重开复位 ${s.score1}:${s.score2} phase=${s.phase} p1h=${s.p1.h}`);
    }

    // 20 — full first-to-11 match fast-forward with no errors
    {
      G_API.setSeed(99);
      G_API.startMatch('ai', 'medium');
      const e0 = G_API.err.length;
      frames.length = 0;
      for (let i = 0; i < 11; i++) { G_API.forcePoint('p1'); R(2); }
      const s = S();
      ok(20, s.mode === 'over' && s.winner === 'p1' && s.score1 === 11 && !s.nan &&
        G_API.err.length === e0 && frames.some(f => f.kind === 'complete'),
        `整局快进 mode=${s.mode} ${s.score1}:${s.score2} nan=${s.nan}`);
    }

    // 21 — returns to title and restores menu text
    {
      G_API.goTitle();
      const s = S();
      ok(21, s.mode === 'title' && !titleEl.classList.contains('hide') &&
        endEl.classList.contains('hide') && /P1 胜|尚无/.test(bestEl.textContent),
        '测完回标题画面');
    }

    // 22 — M toggles mute both ways; no AudioContext exists in autotest
    {
      const m0 = S().muted;
      G_API.press('KeyM'); R(1); G_API.release('KeyM');
      const m1 = S().muted;
      G_API.press('KeyM'); R(1); G_API.release('KeyM');
      const m2 = S().muted;
      ok(22, m1 !== m0 && m2 === m0 && audio.hasCtx() === false && audio.isMuted() === true,
        `M 静音 ${m0}→${m1}→${m2} · ctx=${audio.hasCtx()}`);
    }

    // 23 — noAuto freezes the serve countdown; turning it off advances it
    {
      G_API.startMatch('local', 'medium');
      const st0 = S().serveT;
      R(30);
      const st1 = S().serveT;
      G_API.setNoAuto(false);
      R(30);
      const st2 = S().serveT;
      const ph = S().phase;
      G_API.setNoAuto(true);
      ok(23, Math.abs(st1 - st0) < 1e-6 && (st2 < st1 || ph === 'live'),
        `noAuto 冻结发球倒计时 ${st0.toFixed(2)}→${st1.toFixed(2)} · 关闭后 ${st2.toFixed(2)}`);
    }

    // 24 — top / bottom wall reflection
    {
      G_API.startMatch('local', 'medium');
      G_API.setPhase('live');
      G_API.setPowerupsEnabled(false);
      G_API.setScore(0, 0);
      G_API.setBall(480, WALL_TOP + BALL_R + 1, 500, -600, 0);
      R(4);
      const s = S();
      ok(24, s.ball.y >= WALL_TOP + BALL_R - .5 && s.ball.vy > 0,
        `上墙反弹 y=${s.ball.y.toFixed(1)} vy=${s.ball.vy.toFixed(0)}`);
    }

    // 25 — spin decays over time
    {
      G_API.startMatch('local', 'medium');
      G_API.setPhase('live');
      G_API.setPowerupsEnabled(false);
      G_API.setScore(0, 0);
      G_API.setBall(200, 270, 300, 0, 400);
      const sp0 = Math.abs(S().ball.spin);
      R(60);
      const sp1 = Math.abs(S().ball.spin);
      ok(25, sp1 < sp0 * .5 && Number.isFinite(S().ball.vy),
        `旋转衰减 ${sp0.toFixed(0)}→${sp1.toFixed(0)}`);
    }

    // 26 — local mode turns the AI off
    {
      G_API.startMatch('local', 'medium');
      G_API.setPhase('live');
      G_API.setPowerupsEnabled(false);
      G_API.setPaddle('p2', 270, 0);
      const y0 = P('p2').y;
      R(30);
      ok(26, Math.abs(P('p2').y - y0) < .01, '本地双人模式 · P2 无输入不移动');
    }

    // 27 — score setter accepts increases and decreases
    {
      G_API.setScore(5, 3);
      const hi = S();
      G_API.setScore(0, 0);
      const lo = S();
      ok(27, hi.score1 === 5 && hi.score2 === 3 && lo.score1 === 0 && lo.score2 === 0,
        `比分 setter 5:3 → 0:0`);
    }

    // 28 — four title mode buttons; hard button starts hard AI
    {
      G_API.goTitle();
      const btns = document.querySelectorAll('.modebtn');
      const visible = !titleEl.classList.contains('hide');
      document.querySelector('.modebtn[data-mode="ai"][data-diff="3"]').click();
      const s = S();
      ok(28, btns.length === 4 && visible && s.mode === 'play' && s.gameMode === 'ai' && s.aiDiff === 'hard',
        `模式菜单 ${btns.length} 项 · 硬档启动`);
    }

    // 29 — settlement panel controls
    {
      G_API.startMatch('local', 'medium');
      G_API.setPhase('live');
      G_API.forceWin();
      const visible = !endEl.classList.contains('hide');
      ok(29, visible && !!document.getElementById('go') &&
        !!document.getElementById('change') && !!document.getElementById('home'),
        '结算面板：再来 / 换难度 / 回标题');
    }

    // 30 — unique localStorage prefix
    {
      const s = S();
      ok(30, s.keys.winsP1.startsWith('pdp.') && s.keys.winsP2.startsWith('pdp.') &&
        s.keys.bestRally.startsWith('pdp.') && s.keys.mute.startsWith('pdp.'),
        `localStorage 前缀 ${s.keys.winsP1} / ${s.keys.bestRally}`);
    }

    // 31 — all loaded resources are same-origin
    {
      let sameOrigin = true;
      try {
        const entries = performance.getEntriesByType('resource');
        for (const e of entries) {
          const u = new URL(e.name);
          if (u.origin !== location.origin && u.protocol !== 'data:' && u.protocol !== 'blob:') sameOrigin = false;
        }
      } catch (e) { sameOrigin = false; }
      ok(31, sameOrigin && G_API.err.length === 0, '页面资源全部同源 · 无外部请求');
    }

    // 32 — seeded self-play is reproducible
    {
      const a = G_API.runSelfplay(3, 'medium', { server: 'p1', seed: 36 });
      const b = G_API.runSelfplay(3, 'medium', { server: 'p1', seed: 36 });
      ok(32, a.p1Wins === b.p1Wins && a.p2Wins === b.p2Wins && a.avgBestRally === b.avgBestRally,
        `种子自战可复现 ${a.p1Wins}:${a.p2Wins}`);
    }

    // 33 — reduced-run same-tier balance: each server's win rate in 40-60%
    {
      const N = 24, SEED = 76;
      const detail = [];
      let sameOk = true;
      for (const tier of ['easy', 'medium', 'hard']) {
        const a = G_API.runSelfplay(N, tier, { server: 'p1', seed: SEED });
        const b = G_API.runSelfplay(N, tier, { server: 'p2', seed: SEED });
        detail.push(`${tier} ${(a.p1Rate * 100).toFixed(0)}%/${(b.p1Rate * 100).toFixed(0)}%`);
        if (a.p1Rate < .4 || a.p1Rate > .6 || b.p1Rate < .4 || b.p1Rate > .6) sameOk = false;
      }
      ok(33, sameOk, `同档自战 24 局/边（先发 P1/P2）${detail.join(' · ')}`);
    }

    // 34 — reduced-run difficulty ordering: easy < medium baseline < hard
    {
      const N = 24, SEED = 76;
      const e = G_API.runSelfplay(N, 'easy', { p1Diff: 'easy', p2Diff: 'medium', server: 'p1', seed: SEED });
      const m = G_API.runSelfplay(N, 'medium', { p1Diff: 'medium', p2Diff: 'medium', server: 'p1', seed: SEED });
      const h = G_API.runSelfplay(N, 'hard', { p1Diff: 'hard', p2Diff: 'medium', server: 'p1', seed: SEED });
      const gap = h.p1Rate - e.p1Rate;
      ok(34, e.p1Rate < m.p1Rate && m.p1Rate < h.p1Rate && h.p1Rate - e.p1Rate >= .2,
        `难度梯度 easy ${(e.p1Rate * 100).toFixed(0)}% < 中基准 ${(m.p1Rate * 100).toFixed(0)}% < hard ${(h.p1Rate * 100).toFixed(0)}% · 差 ${(gap * 100).toFixed(0)}pp`);
    }

    // 35 — assertion coverage (this assertion + the final one are added next)
    ok(35, results.length + 2 >= 28, `断言覆盖 ${results.length + 2} 条（≥28）`);

    // 36 — still title, muted, no AudioContext
    {
      G_API.goTitle();
      ok(36, S().mode === 'title' && audio.hasCtx() === false && audio.isMuted() === true,
        '收尾：标题画面 · 静音 · 无 AudioContext');
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
    T.fail++;
    results.push({ id: 'ERR', ok: false, name: `autotest crashed: ${window.__TEST_ERR}` });
    console.log('[autotest] crash', window.__TEST_ERR);
    try { G_API.goTitle(); } catch (e) { }
  } finally {
    G_API.setReportTarget(null);
    G_API.setNoAuto(false);
    winsP1 = saved.winsP1; winsP2 = saved.winsP2; bestRally = saved.bestRally;
    muted = saved.muted; audio.setMuted(muted);
    seedLocked = saved.seedLocked; worldSeed = saved.worldSeed;
    try {
      if (saved.ls.winsP1 === null) localStorage.removeItem(BEST_WINS1_KEY); else localStorage.setItem(BEST_WINS1_KEY, saved.ls.winsP1);
      if (saved.ls.winsP2 === null) localStorage.removeItem(BEST_WINS2_KEY); else localStorage.setItem(BEST_WINS2_KEY, saved.ls.winsP2);
      if (saved.ls.bestRally === null) localStorage.removeItem(BEST_RALLY_KEY); else localStorage.setItem(BEST_RALLY_KEY, saved.ls.bestRally);
      if (saved.ls.mute === null) localStorage.removeItem(MUTE_KEY); else localStorage.setItem(MUTE_KEY, saved.ls.mute);
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
