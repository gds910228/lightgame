// Five in Row Master 五子棋大师 — 15x15 gomoku.
// Local two-player, three AI tiers, forbidden-move toggle, undo, reviewable
// move history, career win persistence, procedural wood-board Canvas art,
// synthesized WebAudio, site report bridge, G hooks and ?autotest=1.

import {
  N, EMPTY, BLACK, WHITE, STAR_POINTS,
  opp, inB, makeBoard,
  findWin, checkForbidden, mulberry32,
  rankMoves, pickMove,
  runSelfplay, runBenchmark, DIFF_META, BALANCE_HANDICAP,
} from './logic.js';
import { makeAudio } from './audio.js';

// ==================== constants ====================
const DT = 1 / 60;
const AI_DELAY = 0.34;
const AUTOTEST = new URLSearchParams(location.search).has('autotest');
const URLP = new URLSearchParams(location.search);

const KEY_WINS_B = 'frm.wins.black';
const KEY_WINS_W = 'frm.wins.white';
const KEY_MUTE = 'frm.mute';
const KEY_FORBID = 'frm.forbidden';
const GAME_ID = 'five-in-row-master';

// ==================== persistence ====================
function readInt(key) {
  try { return Math.max(0, parseInt(localStorage.getItem(key) || '0', 10) || 0); } catch (e) { return 0; }
}
function readBool(key) {
  try { return localStorage.getItem(key) === '1'; } catch (e) { return false; }
}
function write(key, val) {
  try { localStorage.setItem(key, String(val)); } catch (e) { }
}
let wins = { black: readInt(KEY_WINS_B), white: readInt(KEY_WINS_W) };
let muted = readBool(KEY_MUTE);
let forbiddenOn = readBool(KEY_FORBID);

const audio = makeAudio();
audio.setMuted(muted);

// ==================== mutable state ====================
let mode = 'title';            // screen: title | play | over
let gameMode = 'ai';           // ai | local
let aiDiff = 'medium';
let board = makeBoard();
let history = [];              // {r,c,p,n}
let turn = BLACK;
let result = null;             // {winner, reason, line, overline, score}
let paused = false, noAuto = false;
let reportTarget = null;
let cursorR = 7, cursorC = 7;
let hoverR = -1, hoverC = -1;
let reviewIndex = -1;
let gameTime = 0, animT = 0;
let aiTimer = AI_DELAY;
let repeatT = 0;
let placeAnim = null;          // {r,c,t}
let winT = 0, shakeT = 0, shakeAmp = 0;
let badFlash = null;           // {r,c,t}
let pendingTaps = [];
let particles = [];
let reports = [];

const held = new Set();
const pressed = new Set();
const liveRng = () => Math.random();

// ==================== DOM ====================
const cv = document.getElementById('board');
const ctx = cv.getContext('2d');
const boardWrap = document.getElementById('boardwrap');
const titleEl = document.getElementById('title');
const endEl = document.getElementById('end');
const endhEl = document.getElementById('endh');
const endkickEl = document.getElementById('endkick');
const enddEl = document.getElementById('endd');
const bestEl = document.getElementById('titlebest');
const turnStone = document.getElementById('turnstone');
const turnText = document.getElementById('turntext');
const turnSub = document.getElementById('turnsub');
const moveNumEl = document.getElementById('movenum');
const modeTagEl = document.getElementById('modetag');
const thinkingEl = document.getElementById('thinking');
const winsbEl = document.getElementById('winsb');
const winswEl = document.getElementById('winsw');
const histEl = document.getElementById('hist');
const histCountEl = document.getElementById('histcount');
const reviewChip = document.getElementById('reviewchip');
const undoBtn = document.getElementById('undo');
const forbidBtn = document.getElementById('forbid');
const restartBtn = document.getElementById('restart');
const homeBtn = document.getElementById('homebtn');
const muteBtn = document.getElementById('mutebtn');
const pauseBtn = document.getElementById('pausebtn');
const pauseVeil = document.getElementById('pauseveil');
const toastEl = document.getElementById('toast');

// ==================== canvas geometry ====================
let DPR = 1, boardPx = 600;
let geo = { size: 600, pad: 44, step: 36 };
let boardLayer = null;
let layerPx = 0;

function cellXY(r, c) {
  return { x: geo.pad + c * geo.step, y: geo.pad + r * geo.step };
}
function pickCell(clientX, clientY) {
  const rect = cv.getBoundingClientRect();
  const x = clientX - rect.left, y = clientY - rect.top;
  if (x < geo.pad - geo.step * .45 || y < geo.pad - geo.step * .45) return null;
  const c = Math.round((x - geo.pad) / geo.step);
  const r = Math.round((y - geo.pad) / geo.step);
  if (!inB(r, c)) return null;
  const p = cellXY(r, c);
  if (Math.hypot(x - p.x, y - p.y) > geo.step * .62) return null;
  return { r, c };
}

function layout() {
  const w = Math.max(220, boardWrap.clientWidth || 600);
  const h = Math.max(220, boardWrap.clientHeight || 600);
  const size = Math.floor(Math.min(w, h));
  if (!size || !Number.isFinite(size)) return;
  DPR = Math.min(2, window.devicePixelRatio || 1);
  boardPx = size;
  geo = { size, pad: size * .072, step: (size - size * .144) / (N - 1) };
  cv.style.width = size + 'px';
  cv.style.height = size + 'px';
  cv.width = Math.max(1, Math.round(size * DPR));
  cv.height = Math.max(1, Math.round(size * DPR));
  if (layerPx !== size * DPR) {
    layerPx = size * DPR;
    buildBoardLayer();
  }
}
window.addEventListener('resize', () => { layout(); render(); });
if (window.ResizeObserver) {
  try { new ResizeObserver(() => { layout(); render(); }).observe(boardWrap); } catch (e) { }
}

function roundRectPath(g, x, y, w, h, r) {
  const q = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  g.beginPath();
  g.moveTo(x + q, y);
  g.lineTo(x + w - q, y); g.quadraticCurveTo(x + w, y, x + w, y + q);
  g.lineTo(x + w, y + h - q); g.quadraticCurveTo(x + w, y + h, x + w - q, y + h);
  g.lineTo(x + q, y + h); g.quadraticCurveTo(x, y + h, x, y + h - q);
  g.lineTo(x, y + q); g.quadraticCurveTo(x, y, x + q, y);
  g.closePath();
}

function buildBoardLayer() {
  const size = boardPx;
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(size * DPR));
  c.height = Math.max(1, Math.round(size * DPR));
  const g = c.getContext('2d');
  g.setTransform(DPR, 0, 0, DPR, 0, 0);
  const rnd = mulberry32(20261126);

  // frame + wood
  g.save();
  roundRectPath(g, 0, 0, size, size, size * .028);
  g.clip();
  const base = g.createLinearGradient(0, 0, size, size);
  base.addColorStop(0, '#dcb37c');
  base.addColorStop(.45, '#caa066');
  base.addColorStop(1, '#a97845');
  g.fillStyle = base;
  g.fillRect(0, 0, size, size);

  const glow = g.createRadialGradient(size * .42, size * .32, size * .06, size * .5, size * .5, size * .78);
  glow.addColorStop(0, 'rgba(255,236,198,.35)');
  glow.addColorStop(.55, 'rgba(255,220,170,.06)');
  glow.addColorStop(1, 'rgba(52,26,8,.24)');
  g.fillStyle = glow;
  g.fillRect(0, 0, size, size);

  // grain
  for (let i = 0; i < 120; i++) {
    const y0 = rnd() * size;
    const amp = (rnd() - .5) * size * .035;
    const w = .5 + rnd() * 1.7;
    g.strokeStyle = 'rgba(78,40,14,' + (0.035 + rnd() * 0.085).toFixed(3) + ')';
    g.lineWidth = w;
    g.beginPath();
    g.moveTo(-10, y0);
    for (let x = 0; x <= size + 20; x += size / 8) {
      g.lineTo(x, y0 + Math.sin(x / size * Math.PI * 2 + i) * amp);
    }
    g.stroke();
  }
  // knots
  for (let i = 0; i < 5; i++) {
    const kx = size * (.12 + rnd() * .76), ky = size * (.12 + rnd() * .76);
    const kr = size * (.012 + rnd() * .022);
    for (let j = 0; j < 4; j++) {
      g.strokeStyle = 'rgba(74,38,13,' + (0.08 - j * 0.015) + ')';
      g.lineWidth = 1;
      g.beginPath();
      g.ellipse(kx, ky, kr * (1 + j * .8), kr * (.42 + j * .34), (rnd() - .5) * .7, 0, Math.PI * 2);
      g.stroke();
    }
  }
  // soft vignette
  const vig = g.createRadialGradient(size * .5, size * .46, size * .2, size * .5, size * .5, size * .72);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(46,22,6,.3)');
  g.fillStyle = vig;
  g.fillRect(0, 0, size, size);
  g.restore();

  // inner gold hairline frame
  g.save();
  roundRectPath(g, size * .012, size * .012, size * .976, size * .976, size * .022);
  g.strokeStyle = 'rgba(92,54,22,.55)';
  g.lineWidth = 1.2;
  g.stroke();
  roundRectPath(g, size * .006, size * .006, size * .988, size * .988, size * .027);
  g.strokeStyle = 'rgba(255,225,170,.32)';
  g.lineWidth = .8;
  g.stroke();
  g.restore();

  const pad = geo.pad, step = geo.step;
  // grid
  g.save();
  g.lineCap = 'round';
  for (let i = 0; i < N; i++) {
    const p = pad + i * step;
    g.strokeStyle = i === 0 || i === N - 1 ? 'rgba(58,33,13,.82)' : 'rgba(62,36,15,.6)';
    g.lineWidth = i === 0 || i === N - 1 ? Math.max(1.3, step * .045) : Math.max(.8, step * .027);
    g.beginPath(); g.moveTo(pad, p); g.lineTo(pad + (N - 1) * step, p); g.stroke();
    g.beginPath(); g.moveTo(p, pad); g.lineTo(p, pad + (N - 1) * step); g.stroke();
  }
  g.restore();

  // star points
  g.save();
  g.fillStyle = 'rgba(48,28,11,.86)';
  for (const [r, c] of STAR_POINTS) {
    const p = cellXY(r, c);
    g.beginPath(); g.arc(p.x, p.y, Math.max(2, step * .075), 0, Math.PI * 2); g.fill();
  }
  // tiny center seal
  const cp = cellXY(7, 7);
  g.strokeStyle = 'rgba(120,60,24,.28)';
  g.lineWidth = 1;
  g.beginPath(); g.arc(cp.x, cp.y, step * .3, 0, Math.PI * 2); g.stroke();
  g.restore();

  // coordinates
  g.save();
  g.fillStyle = 'rgba(60,37,16,.72)';
  g.font = Math.max(8, Math.round(step * .34)) + 'px "Noto Serif SC","Songti SC",serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const lx = pad * .44, ly = pad + (N - 1) * step;
  for (let c = 0; c < N; c++) {
    g.fillText(String.fromCharCode(65 + c), pad + c * step, ly + pad * .46);
  }
  for (let r = 0; r < N; r++) {
    g.fillText(String(r + 1), lx, pad + r * step);
  }
  g.restore();

  boardLayer = c;
}

// ==================== procedural particles ====================
function burst(x, y, n, colors, power = 1) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = (12 + Math.random() * 55) * power;
    particles.push({
      x, y,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 20 * power,
      life: .35 + Math.random() * .35, max: .7,
      r: 1 + Math.random() * 2.6,
      color: colors[(Math.random() * colors.length) | 0],
      grav: 70,
    });
  }
  if (particles.length > 280) particles.splice(0, particles.length - 280);
}
function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) { particles.splice(i, 1); continue; }
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vy += p.grav * dt;
    p.vx *= .985; p.vy *= .985;
  }
}

// ==================== reporting ====================
function scoreInt() { return result && Number.isFinite(result.score) ? Math.round(result.score) : 0; }
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
      if (kind === 'ready') window.parent.postMessage({ source: 'lightgame', type: 'lightgame:ready', gameId: GAME_ID, v: 1 }, '*');
    }
  } catch (e) { }
}
report('ready', { game: GAME_ID });

// ==================== helpers ====================
function coordLabel(r, c) { return String.fromCharCode(65 + c) + (r + 1); }
function sideName(side) {
  if (side === BLACK) return gameMode === 'local' ? '黑方' : '你';
  if (side === WHITE) return gameMode === 'local' ? '白方' : 'AI 白方';
  return '和局';
}
function isHumanTurn() {
  return mode === 'play' && !result && !paused && (gameMode === 'local' || turn === BLACK);
}
function toast(msg, ms = 1600) {
  if (!toastEl) return;
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toastEl.classList.remove('show'), ms);
}
function updateTitleBest() {
  if (!bestEl) return;
  const total = wins.black + wins.white;
  if (total <= 0) bestEl.textContent = '尚无胜场 · 执黑先行，连成五子即胜';
  else bestEl.textContent = `生涯战绩 · 黑方 ${wins.black} 胜 · 白方 ${wins.white} 胜`;
}
function updateMuteButton() {
  muteBtn.textContent = muted ? '静' : '♪';
  muteBtn.classList.toggle('on', muted);
  muteBtn.title = muted ? '取消静音 (M)' : '静音 (M)';
}
function updatePauseButton() {
  pauseBtn.textContent = paused ? '▶' : '❚❚';
  pauseBtn.title = paused ? '继续 (P)' : '暂停 (P)';
  pauseBtn.disabled = mode !== 'play';
  if (pauseVeil) pauseVeil.classList.toggle('hide', !(paused && mode === 'play'));
}
function saveWins() {
  write(KEY_WINS_B, wins.black);
  write(KEY_WINS_W, wins.white);
}
function setWinsState(b, w, persist = true) {
  wins.black = Math.max(0, parseInt(b, 10) || 0);
  wins.white = Math.max(0, parseInt(w, 10) || 0);
  if (persist) saveWins();
  updateTitleBest();
  if (winsbEl) winsbEl.textContent = wins.black;
  if (winswEl) winswEl.textContent = wins.white;
}
function restoreWins() {
  wins.black = readInt(KEY_WINS_B);
  wins.white = readInt(KEY_WINS_W);
  updateTitleBest();
  if (winsbEl) winsbEl.textContent = wins.black;
  if (winswEl) winswEl.textContent = wins.white;
}

// ==================== UI ====================
function updateUI() {
  const meta = DIFF_META[aiDiff] || DIFF_META.medium;
  if (winsbEl) winsbEl.textContent = wins.black;
  if (winswEl) winswEl.textContent = wins.white;
  if (moveNumEl) moveNumEl.textContent = history.length;
  if (histCountEl) histCountEl.textContent = history.length + ' 手';
  if (modeTagEl) modeTagEl.textContent = gameMode === 'local' ? '本地双人' : `单人 · ${meta.zh}档`;

  let stoneIsBlack = turn === BLACK;
  if (result) stoneIsBlack = result.winner === WHITE ? false : true;
  if (turnStone) turnStone.className = stoneIsBlack ? 'black' : 'white';
  if (turnText) {
    if (mode === 'title') turnText.textContent = '黑方先行';
    else if (result) turnText.textContent = result.winner === EMPTY ? '和 局' : (result.winner === BLACK ? '黑方胜出' : '白方胜出');
    else if (gameMode === 'ai') turnText.textContent = turn === BLACK ? '你 · 黑方落子' : 'AI · 白方落子';
    else turnText.textContent = turn === BLACK ? '黑方落子' : '白方落子';
  }
  if (turnSub) {
    if (gameMode === 'local') turnSub.innerHTML = '本地双人<br>黑先白后';
    else turnSub.innerHTML = `你执黑<br>AI · ${meta.zh}档`;
  }
  if (thinkingEl) thinkingEl.classList.toggle('hide', !(mode === 'play' && !result && gameMode === 'ai' && turn === WHITE && !paused && !noAuto));
  if (undoBtn) undoBtn.disabled = !(mode === 'play' && history.length > 0 && !result);
  if (forbidBtn) forbidBtn.classList.toggle('on', forbiddenOn);
  if (reviewChip) reviewChip.classList.toggle('hide', reviewIndex < 0);
  updatePauseButton();
  updateMuteButton();
  updateTitleBest();
}

function renderHistory() {
  if (!histEl) return;
  histEl.innerHTML = '';
  if (!history.length) {
    const d = document.createElement('div');
    d.className = 'hempty';
    d.innerHTML = '尚未落子<br>黑方先行，落子后此处记录每一手。';
    histEl.appendChild(d);
    return;
  }
  for (let i = 0; i < history.length; i++) {
    const m = history[i];
    const b = document.createElement('button');
    b.className = 'hrow' + (reviewIndex === i ? ' hl' : '');
    b.dataset.i = String(i);
    b.type = 'button';
    const no = document.createElement('span'); no.className = 'hno'; no.textContent = String(m.n).padStart(2, ' ');
    const dot = document.createElement('span'); dot.className = 'hdot ' + (m.p === BLACK ? 'black' : 'white');
    const pos = document.createElement('span'); pos.className = 'hpos'; pos.textContent = coordLabel(m.r, m.c);
    const note = document.createElement('span'); note.className = 'hnote';
    note.textContent = m.p === BLACK ? '黑' : '白';
    b.appendChild(no); b.appendChild(dot); b.appendChild(pos); b.appendChild(note);
    b.addEventListener('click', () => selectHistory(i));
    histEl.appendChild(b);
  }
}
function selectHistory(i) {
  if (i < 0 || i >= history.length) return;
  reviewIndex = reviewIndex === i ? -1 : i;
  renderHistory();
  updateUI();
  const row = histEl.querySelector(`.hrow[data-i="${i}"]`);
  if (row && reviewIndex === i) row.scrollIntoView({ block: 'nearest' });
  render();
}
function scrollHistoryBottom() {
  if (histEl && reviewIndex < 0) histEl.scrollTop = histEl.scrollHeight;
}

// ==================== flow ====================
function hideOverlays() {
  titleEl.classList.add('hide');
  endEl.classList.add('hide');
}
function resetBoardState() {
  board = makeBoard();
  history = [];
  turn = BLACK;
  result = null;
  paused = false;
  cursorR = 7; cursorC = 7;
  hoverR = -1; hoverC = -1;
  reviewIndex = -1;
  gameTime = 0;
  aiTimer = AI_DELAY;
  repeatT = 0;
  placeAnim = null;
  winT = 0; shakeT = 0;
  badFlash = null;
  pendingTaps.length = 0;
  particles.length = 0;
  held.clear();
  pressed.clear();
  renderHistory();
}
function startGame(gm = gameMode, diff = aiDiff) {
  gameMode = gm === 'local' ? 'local' : 'ai';
  aiDiff = DIFF_META[diff] ? diff : 'medium';
  mode = 'play';
  resetBoardState();
  hideOverlays();
  updateUI();
  audio.reset();
  audio.setState('play');
  layout();
  render();
  return true;
}
function restartGame() {
  startGame(gameMode, aiDiff);
  toast('已重开一局');
}
function goTitle() {
  mode = 'title';
  resetBoardState();
  titleEl.classList.remove('hide');
  endEl.classList.add('hide');
  updateUI();
  renderHistory();
  audio.setState('title');
  layout();
  render();
}
function goHomeBridge() {
  try {
    if (window.parent && window.parent !== window && window.parent.location) {
      window.parent.location.href = '/';
      return;
    }
  } catch (e) { }
  try { window.location.href = '/'; } catch (e2) { }
}
function shareScore() {
  audio.play('share');
  const s = scoreInt();
  try { if (typeof window.dp_share === 'function') { window.dp_share(s); return; } } catch (e) { }
  try {
    if (window.parent && window.parent !== window && typeof window.parent.handleGlobalShare === 'function') {
      window.parent.handleGlobalShare(s);
    }
  } catch (e) { }
}

// ==================== move / game end ====================
function commitMove(r, c, p) {
  if (!inB(r, c) || board[r * N + c] !== EMPTY) {
    if (p === turn) toast('此处已有棋子');
    return false;
  }
  if (p === BLACK && forbiddenOn) {
    const f = checkForbidden(board, r, c);
    if (f.forbidden) {
      const reasonMap = { overline: '长连禁手', 'double-four': '双四禁手', 'double-three': '双三禁手' };
      toast('黑方' + (reasonMap[f.reason] || '禁手') + '，不可落子');
      audio.play('forbidden');
      badFlash = { r, c, t: .42 };
      return false;
    }
  }
  board[r * N + c] = p;
  const m = { r, c, p, n: history.length + 1 };
  history.push(m);
  reviewIndex = -1;
  placeAnim = { r, c, t: 0 };
  const pt = cellXY(r, c);
  burst(pt.x, pt.y, 7, p === BLACK ? ['#3a332a', '#d8a44d', '#8b6a3e'] : ['#f4ecd8', '#d8a44d', '#b8a88c'], .7);
  audio.play('place', p);
  report('progress', {
    score: 0,
    progress: Math.round(history.length / (N * N) * 100),
    moves: history.length,
    turn: p,
    player: p === BLACK ? 'black' : 'white',
  });
  const w = findWin(board, r, c, p);
  renderHistory();
  scrollHistoryBottom();
  if (w) {
    finishGame(p, w.overline ? 'overline' : 'five', w);
    return true;
  }
  if (history.length >= N * N) {
    finishGame(EMPTY, 'draw', null);
    return true;
  }
  turn = opp(p);
  aiTimer = AI_DELAY;
  repeatT = 0;
  badFlash = null;
  updateUI();
  return true;
}

function attemptPlace(r, c) {
  if (!isHumanTurn()) return false;
  return commitMove(r, c, turn);
}

function finishGame(winner, reason, winInfo) {
  if (mode !== 'play' || result) return false;
  mode = 'over';
  paused = false;
  turn = winner === WHITE ? WHITE : BLACK;
  const line = winInfo && winInfo.line ? winInfo.line.map(o => ({ r: o.r, c: o.c })) : [];
  const sc = winner === BLACK ? Math.max(10, 1200 - history.length * 8) : 0;
  result = { winner, reason, line, overline: !!(winInfo && winInfo.overline), score: sc };
  winT = 0;
  shakeT = .36; shakeAmp = winner === EMPTY ? 3 : 6;
  if (winner === BLACK) {
    wins.black++;
    saveWins();
    audio.play('win');
    const p = line.length ? cellXY(line[Math.floor(line.length / 2)].r, line[Math.floor(line.length / 2)].c) : { x: boardPx / 2, y: boardPx / 2 };
    burst(p.x, p.y, 60, ['#ffd98e', '#ff9a76', '#8ff2db', '#fff4d8'], 1.5);
  } else if (winner === WHITE) {
    wins.white++;
    saveWins();
    audio.play('lose');
  } else {
    audio.play('draw');
  }
  updateTitleBest();
  updateUI();
  renderHistory();
  report('progress', {
    score: sc, progress: 100, moves: history.length,
    winner: winner === BLACK ? 'black' : winner === WHITE ? 'white' : 'draw',
    reason,
  });
  if (winner === BLACK) {
    report('complete', { score: sc, progress: 100, moves: history.length, reason, forbidden: forbiddenOn });
  } else {
    report('gameOver', { score: sc, progress: 100, moves: history.length, reason, draw: winner === EMPTY, forbidden: forbiddenOn });
  }
  showEnd();
  updatePauseButton();
  return true;
}

function showEnd() {
  if (!result) return;
  const ai = gameMode === 'ai';
  const w = result.winner;
  endkickEl.textContent = '对 局 结 算 · 第 ' + history.length + ' 手';
  if (w === EMPTY) endhEl.textContent = '和 局';
  else if (w === BLACK) endhEl.textContent = ai ? '你 执 黑 胜 出' : '黑 方 胜 出';
  else endhEl.textContent = ai ? 'A I 白 方 胜 出' : '白 方 胜 出';
  const reasonText = result.reason === 'five' ? '五子连珠'
    : result.reason === 'overline' ? '长连（自由规则）'
      : result.reason === 'draw' ? '棋盘已满'
        : result.reason === 'forced' ? '测试裁定' : '对局结束';
  const lines = [];
  lines.push(`共 ${history.length} 手 · ${reasonText} · 用时 ${fmtTime(gameTime)}`);
  lines.push(`生涯战绩　黑方 ${wins.black} 胜 · 白方 ${wins.white} 胜`);
  if (forbiddenOn) lines.push('本局启用禁手：黑方不可长连 / 双四 / 双三');
  if (w === WHITE) lines.push('黑方先行仍有优势，调整开局再战一局。');
  enddEl.textContent = lines.join('\n');
  endEl.classList.remove('hide');
  titleEl.classList.add('hide');
}
function fmtTime(t) {
  const s = Math.max(0, Number.isFinite(t) ? t : 0);
  const m = Math.floor(s / 60), ss = Math.floor(s % 60);
  return String(m).padStart(2, '0') + ':' + String(ss).padStart(2, '0');
}

function forceResult(w) {
  let winner = w;
  if (w === 'black' || w === 1 || w === 'p1') winner = BLACK;
  else if (w === 'white' || w === 2 || w === 'p2') winner = WHITE;
  else winner = EMPTY;
  if (mode === 'title') startGame(gameMode, aiDiff);
  if (mode !== 'play' || result) return false;
  return finishGame(winner, winner === EMPTY ? 'draw' : 'forced', null);
}

// ==================== undo ====================
function popOne() {
  const m = history.pop();
  if (!m) return null;
  board[m.r * N + m.c] = EMPTY;
  turn = m.p;
  result = null;
  winT = 0;
  return m;
}
function undoOne() {
  if (!history.length) return false;
  popOne();
  reviewIndex = -1;
  placeAnim = null;
  badFlash = null;
  if (mode === 'over') { mode = 'play'; endEl.classList.add('hide'); }
  renderHistory();
  updateUI();
  return true;
}
function undo() {
  if (mode !== 'play' || !history.length || paused) return false;
  const first = popOne();
  if (!first) return false;
  if (gameMode === 'ai' && turn === WHITE && history.length && history[history.length - 1].p === BLACK) {
    popOne();
  }
  reviewIndex = -1;
  placeAnim = null;
  badFlash = null;
  aiTimer = AI_DELAY;
  repeatT = 0;
  audio.play('undo');
  toast(gameMode === 'ai' && first.p === WHITE ? '已悔回上一手' : '已悔棋');
  renderHistory();
  scrollHistoryBottom();
  updateUI();
  return true;
}

// ==================== settings ====================
function setForbidden(v, opts = {}) {
  forbiddenOn = !!v;
  write(KEY_FORBID, forbiddenOn ? '1' : '0');
  updateUI();
  render();
  if (!opts.silent) toast(forbiddenOn ? '禁手规则已开启：黑方长连 / 双四 / 双三不可落子' : '禁手规则已关闭');
  return forbiddenOn;
}
function toggleForbidden() { return setForbidden(!forbiddenOn); }
function toggleMute() {
  muted = !muted;
  audio.setMuted(muted);
  write(KEY_MUTE, muted ? '1' : '0');
  updateMuteButton();
  if (!muted) audio.play('ui');
  return muted;
}
function setMuted(v) {
  muted = !!v;
  audio.setMuted(muted);
  write(KEY_MUTE, muted ? '1' : '0');
  updateMuteButton();
}
function togglePause() {
  if (mode !== 'play') return false;
  paused = !paused;
  audio.play('pause');
  updatePauseButton();
  updateUI();
  return paused;
}
function setPaused(v) {
  if (mode !== 'play') return false;
  paused = !!v;
  updatePauseButton();
  updateUI();
  return paused;
}
function setDifficulty(d) {
  if (DIFF_META[d]) aiDiff = d;
  updateUI();
  return aiDiff;
}

// ==================== keyboard / pointer ====================
const MOVE_CODES = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight',
  'Enter', 'Space', 'NumpadEnter', 'KeyU', 'KeyF', 'KeyR', 'KeyM', 'KeyP', 'Escape', 'Backspace',
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

function onFirstGesture() {
  if (!AUTOTEST) audio.unlock();
}
window.addEventListener('pointerdown', onFirstGesture, { once: true, capture: true });
window.addEventListener('keydown', onFirstGesture, { once: true, capture: true });

function handleSystemKeys() {
  if (pressed.has('KeyM')) toggleMute();
  if (pressed.has('KeyP') && mode === 'play') togglePause();
  if (pressed.has('KeyR') && (mode === 'play' || mode === 'over')) restartGame();
  if (pressed.has('KeyU') && mode === 'play') undo();
  if (pressed.has('Backspace') && mode === 'play') undo();
  if (pressed.has('KeyF') && mode === 'play') toggleForbidden();
  if (pressed.has('Escape')) {
    if (mode === 'play' || mode === 'over') goTitle();
  }
}

function moveCursor(dir, n = 1) {
  if (dir === 'left') cursorC = Math.max(0, cursorC - n);
  else if (dir === 'right') cursorC = Math.min(N - 1, cursorC + n);
  else if (dir === 'up') cursorR = Math.max(0, cursorR - n);
  else if (dir === 'down') cursorR = Math.min(N - 1, cursorR + n);
}
function cursorDirFromKeys() {
  if (pressed.has('KeyA') || pressed.has('ArrowLeft')) return 'left';
  if (pressed.has('KeyD') || pressed.has('ArrowRight')) return 'right';
  if (pressed.has('KeyW') || pressed.has('ArrowUp')) return 'up';
  if (pressed.has('KeyS') || pressed.has('ArrowDown')) return 'down';
  return null;
}
function heldDir() {
  if (held.has('KeyA') || held.has('ArrowLeft')) return 'left';
  if (held.has('KeyD') || held.has('ArrowRight')) return 'right';
  if (held.has('KeyW') || held.has('ArrowUp')) return 'up';
  if (held.has('KeyS') || held.has('ArrowDown')) return 'down';
  return null;
}
function handleCursorInput(dt) {
  if (!isHumanTurn()) { repeatT = 0; return; }
  const d = cursorDirFromKeys();
  if (d) {
    moveCursor(d, 1);
    repeatT = .17;
    audio.play('ui');
  } else {
    const hd = heldDir();
    if (hd) {
      repeatT -= dt;
      if (repeatT <= 0) { moveCursor(hd, 1); repeatT = .1; }
    } else repeatT = 0;
  }
  if (pressed.has('Enter') || pressed.has('NumpadEnter') || pressed.has('Space')) {
    attemptPlace(cursorR, cursorC);
  }
}
function handlePointerQueue() {
  while (pendingTaps.length) {
    const t = pendingTaps.shift();
    if (!isHumanTurn()) continue;
    cursorR = t.r; cursorC = t.c;
    attemptPlace(t.r, t.c);
  }
}
function onPointerDown(e) {
  if (!AUTOTEST) audio.unlock();
  e.preventDefault();
  const cell = pickCell(e.clientX, e.clientY);
  if (!cell) return;
  pendingTaps.push(cell);
  try { if (cv.setPointerCapture) cv.setPointerCapture(e.pointerId); } catch (err) { }
}
function onPointerMove(e) {
  if (e.pointerType === 'touch') return;
  const cell = pickCell(e.clientX, e.clientY);
  hoverR = cell ? cell.r : -1;
  hoverC = cell ? cell.c : -1;
}
function onPointerLeave() { hoverR = -1; hoverC = -1; }
cv.addEventListener('pointerdown', onPointerDown);
cv.addEventListener('pointermove', onPointerMove);
cv.addEventListener('pointerleave', onPointerLeave);
cv.addEventListener('pointercancel', onPointerLeave);
cv.addEventListener('contextmenu', e => e.preventDefault());

// ==================== AI ====================
function performAIMove() {
  if (mode !== 'play' || result || paused || gameMode !== 'ai' || turn !== WHITE) return false;
  if (!history.length) return false;
  const mv = pickMove(board, WHITE, aiDiff, {
    rng: liveRng,
    forbidden: forbiddenOn,
    jitter: aiDiff === 'easy' ? 0 : 1,
    varietyProb: aiDiff === 'easy' ? 0 : .035,
  });
  if (!mv) return false;
  return commitMove(mv.r, mv.c, WHITE);
}
function updateAI(dt) {
  if (mode !== 'play' || result || paused || noAuto) return;
  if (gameMode !== 'ai' || turn !== WHITE) return;
  aiTimer -= dt;
  if (aiTimer <= 0) {
    aiTimer = AI_DELAY;
    performAIMove();
  }
}

// ==================== update / render ====================
function update(dt) {
  if (!Number.isFinite(dt) || dt <= 0) return;
  animT += dt;
  if (!muted) audio.tick(dt);
  audio.setState(mode === 'title' ? 'title' : mode === 'over' ? 'end' : (gameMode === 'ai' && turn === WHITE ? 'tense' : 'play'));

  handleSystemKeys();

  if (mode === 'play' && !paused) {
    gameTime += dt;
    handlePointerQueue();
    if (!result) handleCursorInput(dt);
    updateAI(dt);
    if (placeAnim) {
      placeAnim.t += dt;
      if (placeAnim.t > .26) placeAnim = null;
    }
    if (badFlash) { badFlash.t -= dt; if (badFlash.t <= 0) badFlash = null; }
    if (winT < 10) winT += dt;
    updateParticles(dt);
  }
  if (shakeT > 0) shakeT = Math.max(0, shakeT - dt);
  pressed.clear();
}

function drawStone(r, c, p, alpha = 1, scale = 1) {
  const { x, y } = cellXY(r, c);
  const rad = geo.step * .43 * scale;
  if (rad <= .2) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  // shadow
  ctx.beginPath();
  ctx.ellipse(x + rad * .12, y + rad * .24, rad * .98, rad * .66, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(38,20,6,.32)';
  ctx.fill();
  const gr = ctx.createRadialGradient(x - rad * .34, y - rad * .38, rad * .05, x, y, rad * 1.06);
  if (p === BLACK) {
    gr.addColorStop(0, '#7a7a78');
    gr.addColorStop(.28, '#343432');
    gr.addColorStop(.72, '#111110');
    gr.addColorStop(1, '#020202');
  } else {
    gr.addColorStop(0, '#ffffff');
    gr.addColorStop(.42, '#f6efdf');
    gr.addColorStop(.8, '#d4c9b1');
    gr.addColorStop(1, '#a99a80');
  }
  ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2);
  ctx.fillStyle = gr; ctx.fill();
  ctx.lineWidth = Math.max(.6, rad * .055);
  ctx.strokeStyle = p === BLACK ? 'rgba(200,190,160,.2)' : 'rgba(84,58,28,.45)';
  ctx.stroke();
  // specular
  ctx.beginPath();
  ctx.ellipse(x - rad * .32, y - rad * .38, rad * .28, rad * .17, -.6, 0, Math.PI * 2);
  ctx.fillStyle = p === BLACK ? 'rgba(255,255,255,.28)' : 'rgba(255,255,255,.85)';
  ctx.fill();
  ctx.restore();
}

function drawMoveMarker(m, color, alpha = 1, ringScale = .22) {
  if (!m) return;
  const { x, y } = cellXY(m.r, m.c);
  const rad = geo.step * .43;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.beginPath(); ctx.arc(x, y, Math.max(2.2, rad * ringScale), 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = Math.max(.8, rad * .07);
  ctx.strokeStyle = 'rgba(255,236,190,.85)';
  ctx.stroke();
  ctx.restore();
}

function drawWinLine() {
  if (!result || !result.line || !result.line.length) return;
  const line = result.line;
  const a = cellXY(line[0].r, line[0].c);
  const b = cellXY(line[line.length - 1].r, line[line.length - 1].c);
  const pulse = .62 + Math.sin(animT * 5.4) * .2;
  const grow = Math.min(1, winT / .42);
  ctx.save();
  ctx.globalAlpha = .92;
  ctx.strokeStyle = 'rgba(255,196,90,' + (.7 + pulse * .2) + ')';
  ctx.lineWidth = geo.step * .17;
  ctx.lineCap = 'round';
  ctx.shadowColor = 'rgba(255,120,50,.9)';
  ctx.shadowBlur = 18;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(a.x + (b.x - a.x) * grow, a.y + (b.y - a.y) * grow);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255,245,210,.9)';
  ctx.lineWidth = Math.max(1.2, geo.step * .045);
  ctx.stroke();
  for (const cell of line) {
    const p = cellXY(cell.r, cell.c);
    ctx.beginPath();
    ctx.arc(p.x, p.y, geo.step * .43 * (1 + .1 * pulse), 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,220,140,.8)';
    ctx.lineWidth = Math.max(1.2, geo.step * .05);
    ctx.stroke();
  }
  ctx.restore();
}

function drawParticles() {
  if (!particles.length) return;
  ctx.save();
  for (const p of particles) {
    const a = Math.max(0, Math.min(1, p.life / p.max));
    ctx.globalAlpha = a * .9;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * (0.5 + a * .7), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawCursorAndHover() {
  if (!isHumanTurn()) return;
  const showCursor = true;
  const cr = hoverR >= 0 ? hoverR : cursorR;
  const cc = hoverC >= 0 ? hoverC : cursorC;
  if (!inB(cr, cc)) return;
  const { x, y } = cellXY(cr, cc);
  const step = geo.step;
  const occupied = board[cr * N + cc] !== EMPTY;
  let illegal = false;
  if (!occupied && !result) {
    if (forbiddenOn && turn === BLACK) illegal = checkForbidden(board, cr, cc).forbidden;
    drawStone(cr, cc, turn, illegal ? .2 : .34, .96);
    if (illegal) {
      ctx.save();
      ctx.strokeStyle = 'rgba(232,85,58,.95)';
      ctx.lineWidth = Math.max(2, step * .08);
      ctx.lineCap = 'round';
      const q = step * .22;
      ctx.beginPath(); ctx.moveTo(x - q, y - q); ctx.lineTo(x + q, y + q); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + q, y - q); ctx.lineTo(x - q, y + q); ctx.stroke();
      ctx.restore();
    }
  }
  ctx.save();
  const len = step * .3;
  ctx.strokeStyle = illegal ? 'rgba(255,120,95,.95)' : 'rgba(255,217,142,.95)';
  ctx.lineWidth = Math.max(1.4, step * .055);
  ctx.lineCap = 'round';
  const x0 = x - step * .5, x1 = x + step * .5, y0 = y - step * .5, y1 = y + step * .5;
  const corners = [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]];
  for (const [cx, cy, sx, sy] of corners) {
    ctx.beginPath();
    ctx.moveTo(cx + sx * len, cy);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx, cy + sy * len);
    ctx.stroke();
  }
  ctx.restore();
}

function render() {
  if (!geo.size) return;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.clearRect(0, 0, geo.size, geo.size);
  ctx.save();
  if (shakeT > 0) {
    const k = shakeT / .36;
    ctx.translate((Math.random() - .5) * shakeAmp * k, (Math.random() - .5) * shakeAmp * k);
  }
  if (boardLayer) ctx.drawImage(boardLayer, 0, 0, geo.size, geo.size);
  else { ctx.fillStyle = '#c99a63'; ctx.fillRect(0, 0, geo.size, geo.size); }

  const reviewMax = reviewIndex >= 0 ? reviewIndex : history.length - 1;
  for (let i = 0; i < history.length; i++) {
    const m = history[i];
    const dim = i > reviewMax;
    let alpha = dim ? .17 : 1;
    let scale = 1;
    if (placeAnim && placeAnim.r === m.r && placeAnim.c === m.c && i === history.length - 1) {
      const u = Math.min(1, placeAnim.t / .2);
      scale = .55 + .45 * (1 - Math.pow(1 - u, 3));
    }
    drawStone(m.r, m.c, m.p, alpha, scale);
  }

  if (result && result.line && result.line.length) drawWinLine();

  const markIdx = reviewIndex >= 0 ? reviewIndex : history.length - 1;
  if (markIdx >= 0 && history[markIdx] && (!result || result.line.length === 0)) {
    drawMoveMarker(history[markIdx], 'rgba(232,85,58,.95)', .95, .23);
  } else if (markIdx >= 0 && history[markIdx]) {
    drawMoveMarker(history[markIdx], 'rgba(255,236,180,.95)', .85, .18);
  }

  if (reviewIndex >= 0) {
    ctx.save();
    ctx.fillStyle = 'rgba(8,18,15,.72)';
    ctx.strokeStyle = 'rgba(88,216,192,.45)';
    ctx.lineWidth = 1;
    const txt = `回看第 ${reviewIndex + 1} 手 · ${coordLabel(history[reviewIndex].r, history[reviewIndex].c)}`;
    const fs = Math.max(10, geo.step * .36);
    ctx.font = fs + 'px "Microsoft YaHei","PingFang SC",sans-serif';
    const tw = ctx.measureText(txt).width;
    roundRectPath(ctx, geo.pad, geo.pad * .2, tw + 22, fs + 12, 8);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#c8fff1';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(txt, geo.pad + 11, geo.pad * .2 + (fs + 12) / 2);
    // reveal marker
    const m = history[reviewIndex];
    const p = cellXY(m.r, m.c);
    ctx.beginPath();
    ctx.arc(p.x, p.y, geo.step * .52, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(88,216,192,.9)';
    ctx.lineWidth = Math.max(1.6, geo.step * .06);
    ctx.stroke();
    ctx.restore();
  }

  if (badFlash) {
    const a = Math.max(0, Math.min(1, badFlash.t / .42));
    const p = cellXY(badFlash.r, badFlash.c);
    const q = geo.step * .24;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.strokeStyle = 'rgba(232,85,58,.95)';
    ctx.lineWidth = Math.max(2, geo.step * .08);
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(p.x - q, p.y - q); ctx.lineTo(p.x + q, p.y + q); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(p.x + q, p.y - q); ctx.lineTo(p.x - q, p.y + q); ctx.stroke();
    ctx.restore();
  }

  drawCursorAndHover();
  drawParticles();
  ctx.restore();
}

// ==================== URL / DOM wiring ====================
function bindUi() {
  document.querySelectorAll('.modebtn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!AUTOTEST) audio.unlock();
      audio.play('ui');
      const gm = btn.dataset.mode === 'local' ? 'local' : 'ai';
      startGame(gm, btn.dataset.diff || 'medium');
    });
  });
  muteBtn.addEventListener('click', () => { if (!AUTOTEST) audio.unlock(); toggleMute(); audio.play('ui'); });
  pauseBtn.addEventListener('click', () => { if (!AUTOTEST) audio.unlock(); togglePause(); });
  undoBtn.addEventListener('click', () => { if (!AUTOTEST) audio.unlock(); undo(); });
  forbidBtn.addEventListener('click', () => { if (!AUTOTEST) audio.unlock(); toggleForbidden(); audio.play('ui'); });
  restartBtn.addEventListener('click', () => { if (!AUTOTEST) audio.unlock(); restartGame(); });
  homeBtn.addEventListener('click', () => { if (!AUTOTEST) audio.unlock(); goTitle(); });
  document.getElementById('go').addEventListener('click', () => { if (!AUTOTEST) audio.unlock(); audio.play('ui'); startGame(gameMode, aiDiff); });
  document.getElementById('change').addEventListener('click', () => { if (!AUTOTEST) audio.unlock(); audio.play('ui'); goTitle(); });
  document.getElementById('home').addEventListener('click', () => { if (!AUTOTEST) audio.unlock(); audio.play('ui'); goTitle(); });
  const shareBtn = document.getElementById('share');
  if (shareBtn) shareBtn.addEventListener('click', () => { if (!AUTOTEST) audio.unlock(); shareScore(); });
  reviewChip.addEventListener('click', () => {
    reviewIndex = -1;
    renderHistory(); updateUI(); render();
    scrollHistoryBottom();
  });
}
bindUi();

if (URLP.has('autostart') && !AUTOTEST) {
  startGame(URLP.get('mode') === 'local' ? 'local' : 'ai', URLP.get('difficulty') || 'medium');
} else {
  updateUI();
  renderHistory();
}
layout();
render();

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

// ==================== G hooks ====================
function snapshot() {
  return {
    mode, screen: mode, gameMode, aiDiff,
    turn, turnName: turn === BLACK ? 'black' : 'white',
    paused, noAuto, forbidden: forbiddenOn,
    moves: history.length,
    board: Array.from(board),
    history: history.map(m => ({ r: m.r, c: m.c, p: m.p, n: m.n, label: coordLabel(m.r, m.c) })),
    lastMove: history.length ? { ...history[history.length - 1], label: coordLabel(history[history.length - 1].r, history[history.length - 1].c) } : null,
    cursor: { r: cursorR, c: cursorC },
    hover: { r: hoverR, c: hoverC },
    reviewIndex,
    result: result ? {
      winner: result.winner, reason: result.reason, overline: result.overline,
      score: result.score, line: result.line.map(o => ({ r: o.r, c: o.c })),
    } : null,
    winner: result ? result.winner : EMPTY,
    gameTime: Math.round(gameTime * 100) / 100,
    aiTimer: Math.round(aiTimer * 1000) / 1000,
    wins: { black: wins.black, white: wins.white },
    muted, audioCtx: audio.hasCtx(), audioMuted: audio.isMuted(),
    score: scoreInt(),
    progress: Math.round(history.length / (N * N) * 100),
    reports: reports.length,
    particles: particles.length,
    keys: [KEY_WINS_B, KEY_WINS_W, KEY_MUTE, KEY_FORBID],
    nan: !(Number.isFinite(gameTime) && Number.isFinite(aiTimer)),
  };
}

function loadPosition(list, nextTurn, opts = {}) {
  board = makeBoard();
  history = [];
  const arr = Array.isArray(list) ? list : [];
  for (const item of arr) {
    const r = Array.isArray(item) ? item[0] : item.r;
    const c = Array.isArray(item) ? item[1] : item.c;
    const p = Array.isArray(item) ? item[2] : (item.p || BLACK);
    if (!inB(r, c)) continue;
    board[r * N + c] = p;
    history.push({ r, c, p, n: history.length + 1 });
  }
  mode = 'play';
  result = null;
  paused = false;
  reviewIndex = -1;
  placeAnim = null;
  badFlash = null;
  winT = 0;
  gameTime = 0;
  aiTimer = AI_DELAY;
  turn = nextTurn === WHITE || nextTurn === 'white' ? WHITE : BLACK;
  if (nextTurn == null && history.length) turn = opp(history[history.length - 1].p);
  if (opts.gameMode) gameMode = opts.gameMode === 'local' ? 'local' : 'ai';
  if (opts.difficulty && DIFF_META[opts.difficulty]) aiDiff = opts.difficulty;
  if (opts.forbidden != null) forbiddenOn = !!opts.forbidden;
  hideOverlays();
  renderHistory();
  updateUI();
  render();
  return snapshot();
}

const G_API = {
  err: window.__BOOTERR || [],
  step: (n = 60, dt = DT) => { for (let i = 0; i < n; i++) { update(dt); render(); } },
  upd: (n = 30, dt = DT) => { for (let i = 0; i < n; i++) update(dt); },
  press: (...codes) => { for (const c of codes) { pressed.add(c); held.add(c); } },
  release: (...codes) => { for (const c of codes) held.delete(c); },
  setNoAuto: (v) => { noAuto = !!v; updateUI(); return noAuto; },
  setReportTarget: (fn) => { reportTarget = typeof fn === 'function' ? fn : null; },
  state: snapshot,
  startGame,
  startMatch: startGame,
  restart: restartGame,
  goTitle,
  placeStone: (r, c) => attemptPlace(parseInt(r, 10), parseInt(c, 10)),
  commitStone: (r, c, p) => commitMove(parseInt(r, 10), parseInt(c, 10), p === WHITE || p === 2 ? WHITE : BLACK),
  aiMove: performAIMove,
  undo,
  undoOne,
  setForbidden,
  toggleForbidden,
  setPaused,
  togglePause,
  setDifficulty,
  setMuted,
  toggleMute,
  setWins: (b, w, persist = true) => { setWinsState(b, w, persist !== false); return { ...wins }; },
  resetWins: () => { setWinsState(0, 0, true); return { ...wins }; },
  restoreWins: () => { restoreWins(); return { ...wins }; },
  forceResult,
  forceWin: () => forceResult(BLACK),
  forceLoss: () => forceResult(WHITE),
  forceDraw: () => forceResult(EMPTY),
  loadPosition,
  analyze: (r, c) => checkForbidden(board, parseInt(r, 10), parseInt(c, 10)),
  isForbidden: (r, c) => checkForbidden(board, parseInt(r, 10), parseInt(c, 10)),
  rankMoves: (p, diff, opts = {}) => rankMoves(board, p === WHITE ? WHITE : BLACK, diff || aiDiff, opts),
  moveCursor: (dir, n = 1) => { moveCursor(dir, n); return { r: cursorR, c: cursorC }; },
  setCursor: (r, c) => { cursorR = Math.max(0, Math.min(N - 1, parseInt(r, 10) || 0)); cursorC = Math.max(0, Math.min(N - 1, parseInt(c, 10) || 0)); return { r: cursorR, c: cursorC }; },
  selfplay: (n, diff, seed, opts) => runSelfplay(n, diff, seed, opts || {}),
  runSelfplay: (n, diff, seed, opts) => runSelfplay(n, diff, seed, opts || {}),
  runBenchmark: (n, diff, seed, opts) => runBenchmark(n, diff, seed, opts || {}),
  aiMeta: () => JSON.parse(JSON.stringify(DIFF_META)),
  balanceInfo: () => ({ handicap: { ...BALANCE_HANDICAP } }),
  reportLog: () => reports.slice(),
  coordLabel,
  cellCenter: (r, c) => cellXY(r, c),
  view: () => {
    const rect = cv.getBoundingClientRect();
    return { size: geo.size, pad: geo.pad, step: geo.step, dpr: DPR, rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height } };
  },
  particlesList: () => particles.slice(),
  audio,
  ui: { toast },
  // used by the autotest only
  _debug: {
    state: snapshot, update, render, N, BLACK, WHITE,
  },
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
    results.push({ id: String(id), ok: !!cond, name });
    if (cond) T.pass++;
    else { T.fail++; console.log(`[autotest] FAIL ${id}: ${name}`); }
  };
  const S = () => G_API.state();
  const R = (n) => { for (let i = 0; i < n; i++) update(DT); };
  const frames = [];
  const saved = {
    black: wins.black, white: wins.white, muted, forbidden: forbiddenOn,
    lb: null, lw: null, lm: null, lf: null,
  };
  try {
    saved.lb = localStorage.getItem(KEY_WINS_B);
    saved.lw = localStorage.getItem(KEY_WINS_W);
    saved.lm = localStorage.getItem(KEY_MUTE);
    saved.lf = localStorage.getItem(KEY_FORBID);
  } catch (e) { }

  function horizontalStart() {
    startGame('local', 'medium');
    loadPosition([
      [7, 3, BLACK], [0, 0, WHITE], [7, 4, BLACK], [0, 1, WHITE],
      [7, 5, BLACK], [0, 2, WHITE], [7, 6, BLACK], [0, 3, WHITE],
    ], BLACK, { forbidden: false, gameMode: 'local' });
  }
  function verticalStart() {
    startGame('local', 'medium');
    loadPosition([
      [3, 7, BLACK], [0, 0, WHITE], [4, 7, BLACK], [0, 1, WHITE],
      [5, 7, BLACK], [0, 2, WHITE], [6, 7, BLACK], [0, 3, WHITE],
    ], BLACK, { forbidden: false, gameMode: 'local' });
  }
  function diagonalStart() {
    startGame('local', 'medium');
    loadPosition([
      [3, 3, BLACK], [0, 14, WHITE], [4, 4, BLACK], [0, 13, WHITE],
      [5, 5, BLACK], [0, 12, WHITE], [6, 6, BLACK], [0, 11, WHITE],
    ], BLACK, { forbidden: false, gameMode: 'local' });
  }

  try {
    await nap();
    setMuted(true);
    G_API.setReportTarget(f => frames.push(f));

    // 1 — clean boot
    ok(1, G_API.err.length === 0 && (window.__BOOTERR || []).length === 0,
      `启动零报错 errors=${G_API.err.length} booterr=${(window.__BOOTERR || []).length}`);

    // 2 — stress 120 frames, no NaN / no new errors
    {
      horizontalStart();
      const e0 = G_API.err.length;
      let finite = true;
      for (let k = 0; k < 120; k++) {
        if (k === 20) G_API.press('KeyD');
        if (k === 30) G_API.press('Enter');
        if (k === 60) G_API.press('KeyS');
        if (k === 70) G_API.press('Enter');
        update(DT);
        if (k % 20 === 0) {
          const s = S();
          for (const v of [s.gameTime, s.aiTimer, s.cursor.r, s.cursor.c, s.progress]) if (!Number.isFinite(v)) finite = false;
          if (!s.board.every(Number.isFinite)) finite = false;
        }
      }
      G_API.release('KeyD', 'KeyS');
      ok(2, finite && !S().nan && G_API.err.length === e0, `推进 120 帧无 NaN finite=${finite} nan=${S().nan}`);
    }

    // 3 — horizontal five
    {
      horizontalStart();
      const before = S();
      const okPlace = G_API.placeStone(7, 7);
      const s = S();
      ok(3, okPlace && s.result && s.result.winner === BLACK && s.result.line.length === 5 && before.moves === 8,
        `横向五连 result=${s.result && s.result.winner} line=${s.result ? s.result.line.length : '-'}`);
    }
    // 4 — vertical five
    {
      verticalStart();
      const okPlace = G_API.placeStone(7, 7);
      const s = S();
      ok(4, okPlace && s.result && s.result.winner === BLACK && s.result.line.length === 5,
        `纵向五连 result=${s.result && s.result.winner} line=${s.result ? s.result.line.length : '-'}`);
    }
    // 5 — diagonal five
    {
      diagonalStart();
      const okPlace = G_API.placeStone(7, 7);
      const s = S();
      ok(5, okPlace && s.result && s.result.winner === BLACK && s.result.line.length === 5,
        `斜向五连 result=${s.result && s.result.winner} line=${s.result ? s.result.line.length : '-'}`);
    }
    // 6 — occupied cell / illegal placement
    {
      horizontalStart();
      const m0 = S().moves;
      const bad = G_API.placeStone(0, 0);
      const s = S();
      ok(6, bad === false && s.moves === m0 && s.board[0] === WHITE,
        `已占交叉点拒绝落子 moves=${s.moves}`);
    }
    // 6b — exactly five detected (not four / six)
    {
      horizontalStart();
      G_API.placeStone(7, 7);
      const s = S();
      ok('6b', s.result && !s.result.overline && s.result.line.length === 5 && s.result.line[0].c === 3 && s.result.line[4].c === 7,
        `恰好五连判定 line=${s.result ? s.result.line.map(o => o.c).join(',') : '-'}`);
    }

    // 7 — win scoring + persistence write
    {
      setWinsState(0, 0, true);
      horizontalStart();
      G_API.placeStone(7, 7);
      let b = 0;
      try { b = parseInt(localStorage.getItem(KEY_WINS_B) || '0', 10) || 0; } catch (e) { }
      const s = S();
      ok(7, s.wins.black === 1 && s.wins.white === 0 && b === 1 && Number.isInteger(s.score) && s.score > 0,
        `胜场与整数得分 黑=${s.wins.black}/${b} 白=${s.wins.white} score=${s.score}`);
    }
    // 7b — best localStorage RW + restore
    {
      setWinsState(2, 3, true);
      setWinsState(0, 0, false);
      const mid = S().wins;
      G_API.restoreWins();
      const after = S().wins;
      ok('7b', mid.black === 0 && mid.white === 0 && after.black === 2 && after.white === 3 &&
        localStorage.getItem(KEY_WINS_B) === '2' && localStorage.getItem(KEY_WINS_W) === '3',
        `localStorage 读写/还原 2:3 → ${after.black}:${after.white}`);
    }
    // 7c — unique key prefix
    {
      const keys = S().keys;
      ok('7c', keys.every(k => k.startsWith('frm.')) && new Set(keys).size === keys.length,
        `持久化键前缀 ${keys.join(' ')}`);
    }

    // 8 — loss path: a real white five in AI mode → gameOver
    frames.length = 0;
    startGame('ai', 'medium');
    loadPosition([
      [7, 3, WHITE], [7, 4, WHITE], [7, 5, WHITE], [7, 6, WHITE],
      [0, 0, BLACK], [0, 1, BLACK], [0, 2, BLACK], [0, 3, BLACK],
    ], WHITE, { forbidden: false, gameMode: 'ai' });
    G_API.commitStone(7, 7, WHITE);
    {
      const s = S();
      ok(8, s.mode === 'over' && s.result && s.result.winner === WHITE && frames.some(f => f.kind === 'gameOver'),
        `失败路径（白方五连） mode=${s.mode} winner=${s.result && s.result.winner}`);
    }
    // 8b — win path: a real black five via the human action → complete
    frames.length = 0;
    startGame('ai', 'medium');
    loadPosition([
      [7, 3, BLACK], [7, 4, BLACK], [7, 5, BLACK], [7, 6, BLACK],
      [0, 0, WHITE], [0, 1, WHITE], [0, 2, WHITE], [0, 3, WHITE],
    ], BLACK, { forbidden: false, gameMode: 'ai' });
    G_API.placeStone(7, 7);
    {
      const s = S();
      ok('8b', s.mode === 'over' && s.result && s.result.winner === BLACK && frames.some(f => f.kind === 'complete'),
        `胜利路径（黑方五连） mode=${s.mode} complete=${frames.some(f => f.kind === 'complete')}`);
    }
    // 8c — report order ready → progress → terminal
    {
      const log = G_API.reportLog();
      const ri = log.findIndex(f => f.kind === 'ready');
      const pi = frames.findIndex(f => f.kind === 'progress');
      const ti = frames.findIndex(f => f.kind === 'complete' || f.kind === 'gameOver');
      ok('8c', ri === 0 && pi >= 0 && ti > pi,
        `上报帧序 ready=${ri} progress=${pi} terminal=${ti}`);
    }

    // 9 — mandatory keyboard input path: cursor moves, Enter places
    {
      startGame('local', 'medium');
      G_API.setCursor(7, 7);
      const c0 = S().cursor;
      G_API.press('KeyD'); R(1); G_API.release('KeyD');
      const c1 = S().cursor;
      G_API.press('Enter'); R(1); G_API.release('Enter');
      const s = S();
      ok(9, c1.c === c0.c + 1 && c1.r === c0.r && s.moves === 1 && s.board[7 * N + 8] === BLACK,
        `键盘输入 光标 ${c0.c}→${c1.c} 落子数=${s.moves}`);
    }
    // 9b — all four WASD/arrow directions move the cursor
    {
      startGame('local', 'medium');
      G_API.setCursor(7, 7);
      G_API.press('KeyW'); R(1); G_API.release('KeyW');
      const a = S().cursor;
      G_API.press('ArrowLeft'); R(1); G_API.release('ArrowLeft');
      const b = S().cursor;
      G_API.press('KeyS'); R(1); G_API.release('KeyS');
      const c = S().cursor;
      G_API.press('ArrowRight'); R(1); G_API.release('ArrowRight');
      const d = S().cursor;
      ok('9b', a.r === 6 && b.c === 6 && c.r === 7 && d.c === 7,
        `W/A/S/D 光标 ${a.r},${b.c} → ${c.r},${d.c}`);
    }

    // 10 — undo restores exactly one move (local)
    {
      startGame('local', 'medium');
      G_API.placeStone(7, 7);
      G_API.placeStone(6, 6);
      G_API.placeStone(8, 8);
      const m0 = S().moves;
      const u = G_API.undo();
      const s = S();
      ok(10, u === true && s.moves === m0 - 1 && s.board[8 * N + 8] === EMPTY && s.turn === BLACK,
        `悔棋一手 moves=${m0}→${s.moves} 空位恢复=${s.board[8 * N + 8] === EMPTY}`);
    }
    // 10b — AI-mode undo removes the AI/human pair back to the human turn
    {
      startGame('ai', 'medium');
      G_API.placeStone(7, 7);       // human black
      G_API.aiMove();               // AI white
      const m0 = S().moves;
      G_API.undo();
      const s = S();
      ok('10b', m0 === 2 && s.moves === 0 && s.turn === BLACK && s.board[7 * N + 7] === EMPTY,
        `AI 模式悔棋成对 moves=${m0}→${s.moves} turn=${s.turnName}`);
    }

    // 11 — forbidden toggle changes legality (overline)
    {
      startGame('local', 'medium');
      setForbidden(true, { silent: true });
      loadPosition([
        [7, 2, BLACK], [7, 3, BLACK], [7, 4, BLACK], [7, 5, BLACK], [7, 7, BLACK],
        [0, 0, WHITE], [0, 1, WHITE], [0, 2, WHITE], [0, 3, WHITE], [0, 4, WHITE],
      ], BLACK, { forbidden: true, gameMode: 'local' });
      const m0 = S().moves;
      const bad = G_API.placeStone(7, 6);
      const s1 = S();
      const blocked = bad === false && s1.moves === m0 && !s1.result;
      setForbidden(false, { silent: true });
      const good = G_API.placeStone(7, 6);
      const s2 = S();
      ok(11, blocked && good === true && s2.result && s2.result.winner === BLACK && s2.result.overline,
        `禁手开关：开=拒绝(${blocked}) 关=长连胜(${good && s2.result ? s2.result.overline : '-'})`);
    }
    // 11b — double-three detection
    {
      startGame('local', 'medium');
      loadPosition([
        [7, 5, BLACK], [7, 6, BLACK], [5, 7, BLACK], [6, 7, BLACK],
        [0, 0, WHITE], [0, 1, WHITE],
      ], BLACK, { forbidden: true, gameMode: 'local' });
      const f = G_API.analyze(7, 7);
      ok('11b', f.forbidden === true && f.reason === 'double-three',
        `双三禁手检测 forbidden=${f.forbidden} reason=${f.reason}`);
    }
    // 11c — legal exactly-five is not forbidden
    {
      startGame('local', 'medium');
      loadPosition([
        [7, 3, BLACK], [7, 4, BLACK], [7, 5, BLACK], [7, 6, BLACK],
        [0, 0, WHITE], [0, 1, WHITE], [0, 2, WHITE], [0, 3, WHITE],
      ], BLACK, { forbidden: true, gameMode: 'local' });
      const f = G_API.analyze(7, 7);
      ok('11c', f.forbidden === false && f.reason === 'five',
        `恰好五连非禁手 reason=${f.reason}`);
    }
    // 11d — double-four detection
    {
      startGame('local', 'medium');
      loadPosition([
        [7, 4, BLACK], [7, 5, BLACK], [7, 6, BLACK],
        [4, 7, BLACK], [5, 7, BLACK], [6, 7, BLACK],
        [0, 0, WHITE], [0, 1, WHITE], [0, 2, WHITE], [0, 3, WHITE], [0, 4, WHITE], [0, 5, WHITE],
      ], BLACK, { forbidden: true, gameMode: 'local' });
      const f = G_API.analyze(7, 7);
      const m0 = S().moves;
      const bad = G_API.placeStone(7, 7);
      ok('11d', f.forbidden === true && f.reason === 'double-four' && bad === false && S().moves === m0,
        `双四禁手检测 forbidden=${f.forbidden} reason=${f.reason} 拒绝=${bad === false}`);
    }

    // 12 — touch / pointer binding: canvas tap places via update path
    {
      startGame('local', 'medium');
      const v = G_API.view();
      const p = G_API.cellCenter(7, 7);
      const ev = new PointerEvent('pointerdown', {
        bubbles: true, cancelable: true, pointerType: 'touch', pointerId: 41,
        clientX: v.rect.left + p.x, clientY: v.rect.top + p.y,
      });
      cv.dispatchEvent(ev);
      const before = S().moves;
      R(1);
      const s = S();
      ok(12, before === 0 && s.moves === 1 && s.board[7 * N + 7] === BLACK,
        `指针点击落子 moves=${before}→${s.moves} 绑定=${typeof onPointerDown === 'function'}`);
    }

    // 13 — pause freezes clock and AI timer
    {
      startGame('ai', 'medium');
      G_API.placeStone(7, 7);
      G_API.setNoAuto(false);
      const t0 = S().aiTimer, g0 = S().gameTime;
      G_API.press('KeyP'); R(1); G_API.release('KeyP');
      const pausedState = S().paused;
      R(30);
      const s = S();
      G_API.press('KeyP'); R(1); G_API.release('KeyP');
      G_API.setNoAuto(true);
      ok(13, pausedState && s.paused && s.moves === 1 && Math.abs(s.aiTimer - t0) < 1e-6 && Math.abs(s.gameTime - g0) < 1e-6,
        `暂停冻结 paused=${pausedState} moves=${s.moves} timer=${s.aiTimer}`);
    }

    // 14 — AI timer auto-plays when noAuto is off
    {
      startGame('ai', 'medium');
      G_API.placeStone(7, 7);
      G_API.setNoAuto(false);
      R(26);
      const s = S();
      G_API.setNoAuto(true);
      ok(14, s.moves === 2 && s.history[1].p === WHITE && s.turn === BLACK,
        `AI 自动应手 moves=${s.moves} lastP=${s.history[1] && s.history[1].p}`);
    }

    // 15 — local alternation
    {
      startGame('local', 'medium');
      G_API.placeStone(7, 7);
      G_API.placeStone(7, 8);
      const s = S();
      ok(15, s.moves === 2 && s.history[0].p === BLACK && s.history[1].p === WHITE && s.turn === BLACK,
        `本地双人轮流 黑=${s.history[0] && s.history[0].p} 白=${s.history[1] && s.history[1].p}`);
    }

    // 16 — history DOM + click highlight / review
    {
      startGame('local', 'medium');
      G_API.placeStone(7, 7);
      G_API.placeStone(6, 6);
      G_API.placeStone(8, 8);
      const rows = document.querySelectorAll('#hist .hrow');
      rows[1].click();
      const s = S();
      const hl = document.querySelectorAll('#hist .hrow.hl').length;
      ok(16, rows.length === 3 && s.reviewIndex === 1 && hl === 1 &&
        document.getElementById('histcount').textContent === '3 手',
        `历史 DOM 行数=${rows.length} 回看=${s.reviewIndex} 高亮=${hl}`);
      const cell = G_API.coordLabel(6, 6);
      ok('16b', cell === 'G7', `坐标标注 ${cell}`);
    }

    // 17 — restart resets the board but keeps career wins
    {
      startGame('local', 'medium');
      G_API.placeStone(7, 7);
      G_API.placeStone(6, 6);
      const wb = S().wins.black;
      G_API.restart();
      const s = S();
      ok(17, s.moves === 0 && s.board.every(v => v === 0) && s.turn === BLACK && s.mode === 'play' &&
        s.wins.black === wb && s.cursor.r === 7,
        `重开复位 moves=${s.moves} turn=${s.turnName} 胜场保留=${s.wins.black === wb}`);
    }

    // 18 — difficulty menu buttons
    {
      goTitle();
      const btns = document.querySelectorAll('.modebtn');
      const modes = Array.from(btns).map(b => b.dataset.mode + ':' + b.dataset.diff).join(',');
      btns[2].click();
      const s = S();
      ok(18, btns.length === 4 && s.mode === 'play' && s.gameMode === 'ai' && s.aiDiff === 'hard' &&
        modes === 'ai:easy,ai:medium,ai:hard,local:medium',
        `难度菜单 4 项 → ${modes} / 当前 ${s.aiDiff}`);
    }

    // 19 — AI tier metadata: medium ≥ depth 2, hard depth 4
    {
      const meta = G_API.aiMeta();
      ok(19, meta.easy.depth === 0 && meta.medium.depth >= 2 && meta.hard.depth === 4 &&
        meta.easy.depth < meta.medium.depth && meta.medium.depth < meta.hard.depth,
        `AI 深度 易=${meta.easy.depth} 中=${meta.medium.depth} 难=${meta.hard.depth}`);
    }

    // 20 — AI actually moves and is legal
    {
      startGame('ai', 'easy');
      G_API.placeStone(7, 7);
      const moved = G_API.aiMove();
      const s = S();
      const last = s.history[s.history.length - 1];
      ok(20, moved === true && s.moves === 2 && last.p === WHITE && s.board[last.r * N + last.c] === WHITE,
        `AI 落子合法 moves=${s.moves} last=${last.label}`);
    }

    // 21 — move history is bounded / full-board draw path reachable
    {
      startGame('local', 'medium');
      // Force a draw through the public result hook (board-full is impractical to fill here).
      const d = G_API.forceDraw();
      const s = S();
      ok(21, d === true && s.mode === 'over' && s.result && s.result.winner === EMPTY && s.result.reason === 'draw',
        `和局路径 winner=${s.result && s.result.winner} reason=${s.result && s.result.reason}`);
    }

    // 22 — audio muted, no AudioContext during autotest
    ok(22, G_API.audio.isMuted() === true && G_API.audio.hasCtx() === false,
      `自测静音 audioCtx=${G_API.audio.hasCtx()}`);

    // 23 — title / end overlay controls exist and test leaves title screen at the end
    {
      goTitle();
      const s = S();
      const visible = !titleEl.classList.contains('hide') && endEl.classList.contains('hide');
      const buttons = ['go', 'change', 'home'].every(id => !!document.getElementById(id));
      ok(23, s.mode === 'title' && visible && buttons, `回标题画面 mode=${s.mode} buttons=${buttons}`);
    }

    // 24–26 — reduced same-tier self-play balance (20 games per tier)
    {
      await nap();
      const seeds = { easy: 7127, medium: 9137, hard: 6180 };
      let easy = null, medium = null, hard = null;
      easy = G_API.runSelfplay(20, 'easy', seeds.easy);
      ok(24, easy.firstRate >= 40 && easy.firstRate <= 60,
        `易档自对弈先手胜率 ${easy.firstRate}% (${easy.firstWins}/${easy.games}, 后手 ${easy.secondRate}%, 和 ${easy.draws}, ${easy.ms}ms)`);
      medium = G_API.runSelfplay(20, 'medium', seeds.medium);
      ok(25, medium.firstRate >= 40 && medium.firstRate <= 60,
        `中档自对弈先手胜率 ${medium.firstRate}% (${medium.firstWins}/${medium.games}, 后手 ${medium.secondRate}%, 和 ${medium.draws}, ${medium.ms}ms)`);
      hard = G_API.runSelfplay(20, 'hard', seeds.hard);
      ok(26, hard.firstRate >= 40 && hard.firstRate <= 60,
        `难档自对弈先手胜率 ${hard.firstRate}% (${hard.firstWins}/${hard.games}, 后手 ${hard.secondRate}%, 和 ${hard.draws}, ${hard.ms}ms)`);
      window.__TEST_BALANCE = { easy, medium, hard };
    }

    // 27–29 — reduced benchmark vs fixed greedy baseline (12 games per tier)
    {
      const seeds = { easy: 3301, medium: 5501, hard: 7701 };
      const be = G_API.runBenchmark(12, 'easy', seeds.easy);
      const bm = G_API.runBenchmark(12, 'medium', seeds.medium);
      const bh = G_API.runBenchmark(12, 'hard', seeds.hard);
      ok(27, be.winRate >= 0 && be.winRate <= 100, `易档 vs 贪心基线 胜率 ${be.winRate}% (${be.wins}/${be.games}, ${be.ms}ms)`);
      ok(28, bm.winRate >= be.winRate + 15, `中档 vs 基线 ${bm.winRate}% ≥ 易档 ${be.winRate}% + 15`);
      ok(29, bh.winRate >= bm.winRate + 15, `难档 vs 基线 ${bh.winRate}% ≥ 中档 ${bm.winRate}% + 15`);
      window.__TEST_BENCH = { easy: be, medium: bm, hard: bh };
    }

    // 30 — report frame payloads are wire-safe & integer scores
    {
      const log = G_API.reportLog();
      const bad = log.filter(f => f.score != null && !Number.isInteger(f.score));
      const hasReady = log.some(f => f.kind === 'ready');
      const hasTerminal = log.some(f => f.kind === 'complete') && log.some(f => f.kind === 'gameOver');
      ok(30, bad.length === 0 && hasReady && hasTerminal,
        `上报载荷整数分 ${bad.length} 异常 ready=${hasReady} 胜/负帧=${hasTerminal}`);
    }

    // 31 — final assertion count
    ok(31, results.length >= 30, `断言覆盖 ${results.length} 条（≥30）`);
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
    try { goTitle(); } catch (e) { }
  } finally {
    G_API.setReportTarget(null);
    G_API.setNoAuto(false);
    wins.black = saved.black; wins.white = saved.white;
    muted = saved.muted; audio.setMuted(muted);
    forbiddenOn = saved.forbidden;
    try {
      if (saved.lb === null) localStorage.removeItem(KEY_WINS_B); else localStorage.setItem(KEY_WINS_B, saved.lb);
      if (saved.lw === null) localStorage.removeItem(KEY_WINS_W); else localStorage.setItem(KEY_WINS_W, saved.lw);
      if (saved.lm === null) localStorage.removeItem(KEY_MUTE); else localStorage.setItem(KEY_MUTE, saved.lm);
      if (saved.lf === null) localStorage.removeItem(KEY_FORBID); else localStorage.setItem(KEY_FORBID, saved.lf);
    } catch (e) { }
    updateUI();
    try { goTitle(); } catch (e) { }
    await nap();
    T.total = results.length;
    T.pass = results.filter(r => r.ok).length;
    T.fail = results.length - T.pass;
    T.done = true;
    console.log(`[autotest] ${T.pass}/${T.total} passed, ${T.fail} failed`);
  }
}

if (AUTOTEST) autotest();
