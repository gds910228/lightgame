// Aqua Conduit 水脉连环 — 2D Canvas pipe-rotation puzzle.
// guizang third-series #8. Fixed-step logic, authored+audited 24 levels,
// G debug hooks and a 35+ assertion ?autotest=1 suite.

import { LEVELS, CHAPTERS, TOTAL_LEVELS, levelByNumber, chapterFor } from './levels.js';
import {
  DIR, OPP, BIT, ALL, DR, DC, rotMask, maskAt, dirsOf, isMovable,
  solveFlow, optimalMoves, autoSolution, canonicalRotations, initialRotations,
  cellAt, indexAt, levelIndex, countMechanics, keyOf,
} from './flow.js';
import { makeAudio } from './audio.js';

const W = 960, H = 540, DT = 1 / 60;
const $ = (s) => document.querySelector(s);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pad2 = (n) => String(n).padStart(2, '0');
const fmtTime = (s) => {
  s = Math.max(0, s);
  const m = Math.floor(s / 60), r = Math.floor(s % 60);
  return pad2(m) + ':' + pad2(r);
};
const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];

const STORE = { best: 'aqc.best', stars: 'aqc.stars', scores: 'aqc.scores', unlocked: 'aqc.unlocked', mute: 'aqc.mute' };
const AUTOTEST = new URLSearchParams(location.search).has('autotest');

// ==================== canvas / frame ====================
const cv = $('#gl');
const ctx = cv.getContext('2d');
let DPR = 1, viewScale = 1, viewOX = 0, viewOY = 0;
let shakeT = 0, shakeAmp = 0, flashT = 0, flashColor = '255,226,170';

function resize() {
  DPR = Math.min(2, window.devicePixelRatio || 1);
  const vw = Math.max(1, innerWidth), vh = Math.max(1, innerHeight);
  cv.width = Math.round(vw * DPR); cv.height = Math.round(vh * DPR);
  viewScale = Math.min(vw / W, vh / H);
  viewOX = (vw - W * viewScale) / 2;
  viewOY = (vh - H * viewScale) / 2;
  if (!Number.isFinite(viewScale) || viewScale <= 0) { viewScale = 1; viewOX = viewOY = 0; }
  const root = document.documentElement.style;
  root.setProperty('--ft', viewOY + 'px');
  root.setProperty('--fl', viewOX + 'px');
  root.setProperty('--fw', (W * viewScale) + 'px');
  root.setProperty('--fh', (H * viewScale) + 'px');
}
addEventListener('resize', resize);
resize();

// ==================== procedural backdrop ====================
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const bg = document.createElement('canvas');
bg.width = W * 2; bg.height = H * 2;
{
  const b = bg.getContext('2d');
  b.scale(2, 2);
  const rnd = mulberry32(80024);
  const sky = b.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#050914');
  sky.addColorStop(.4, '#0c1731');
  sky.addColorStop(.72, '#12213f');
  sky.addColorStop(1, '#060a17');
  b.fillStyle = sky; b.fillRect(0, 0, W, H);

  // deep indigo ceramic wall, large tiles with brass grout
  const wall = b.createLinearGradient(0, 0, W, H);
  wall.addColorStop(0, 'rgba(24,38,72,.30)');
  wall.addColorStop(.5, 'rgba(14,24,48,.16)');
  wall.addColorStop(1, 'rgba(34,50,88,.24)');
  b.fillStyle = wall; b.fillRect(0, 0, W, H);
  b.strokeStyle = 'rgba(160,190,220,.055)'; b.lineWidth = 1;
  for (let x = -60; x < W + 60; x += 96) { b.beginPath(); b.moveTo(x, 0); b.lineTo(x + 120, H); b.stroke(); }
  for (let y = 24; y < H; y += 74) { b.beginPath(); b.moveTo(0, y); b.lineTo(W, y + 26); b.stroke(); }
  b.strokeStyle = 'rgba(215,160,90,.045)';
  for (let x = 48; x < W; x += 192) { b.beginPath(); b.moveTo(x, 0); b.lineTo(x - 40, H); b.stroke(); }

  // faint water-clock rings behind the board
  for (const [cx, cy, r] of [[480, 285, 292], [480, 285, 228], [480, 285, 164]]) {
    b.strokeStyle = 'rgba(120,224,200,.05)'; b.lineWidth = 1.2;
    b.beginPath(); b.arc(cx, cy, r, 0, 7); b.stroke();
    b.strokeStyle = 'rgba(215,160,90,.06)';
    for (let i = 0; i < 12; i++) {
      const a = i * Math.PI / 6;
      b.beginPath(); b.moveTo(cx + Math.cos(a) * (r - 10), cy + Math.sin(a) * (r - 10));
      b.lineTo(cx + Math.cos(a) * (r + 8), cy + Math.sin(a) * (r + 8)); b.stroke();
    }
  }

  // hanging lamps / warm pools
  for (const [x, y, r, c] of [[110, 88, 210, '226,168,96'], [850, 452, 240, '90,200,184'], [760, 78, 160, '226,168,96']]) {
    const g = b.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${c},.10)`); g.addColorStop(.45, `rgba(${c},.035)`); g.addColorStop(1, `rgba(${c},0)`);
    b.fillStyle = g; b.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // dust
  for (let i = 0; i < 220; i++) {
    const x = rnd() * W, y = rnd() * H;
    b.fillStyle = `rgba(${200 + rnd() * 40 | 0},${210 + rnd() * 30 | 0},255,${.02 + rnd() * .07})`;
    b.beginPath(); b.arc(x, y, .4 + rnd() * 1.2, 0, 7); b.fill();
  }
  // vignette + grain
  const vig = b.createRadialGradient(W / 2, H * .47, H * .18, W / 2, H * .52, W * .72);
  vig.addColorStop(0, 'rgba(0,0,0,0)'); vig.addColorStop(1, 'rgba(2,4,10,.72)');
  b.fillStyle = vig; b.fillRect(0, 0, W, H);
  for (let i = 0; i < 900; i++) {
    b.fillStyle = `rgba(255,240,210,${rnd() * .02})`;
    b.fillRect(rnd() * W, rnd() * H, 1, 1);
  }
}

// ==================== boot state ====================
const audio = makeAudio();
let mode = 'title';                    // title | play | win | over
let paused = false, noAuto = false, demoMode = false;
let levelN = 1, level = null, flow = null;
let used = 0, movesLeft = 0, elapsed = 0, flowPhase = 0;
let hitstop = 0, hudT = 0;
let cursor = { r: 0, c: 0 }, hover = null, pointer = null;
let particles = [], floats = [];
let endTimer = 0, pendingEnd = null, lastOutcome = null;
let toastTimer = 0;
let backdrop = null, backdropFlow = null;
let reportTarget = null;
const reports = [];
let starsByLevel = {}, bestScores = {}, unlocked = 1, totalStars = 0, totalScore = 0, best = 0;
let mutedSaved = false;

// ==================== storage / progress ====================
function loadProgress() {
  starsByLevel = {};
  try {
    const raw = JSON.parse(localStorage.getItem(STORE.stars) || '{}');
    for (let n = 1; n <= TOTAL_LEVELS; n++) {
      const v = Number(raw && raw[n]);
      if (Number.isInteger(v) && v >= 0 && v <= 3) starsByLevel[n] = v;
    }
  } catch (e) { }
  bestScores = {};
  try {
    const raw = JSON.parse(localStorage.getItem(STORE.scores) || '{}');
    for (let n = 1; n <= TOTAL_LEVELS; n++) {
      const v = Number(raw && raw[n]);
      if (Number.isFinite(v) && v >= 0) bestScores[n] = Math.round(v);
    }
  } catch (e) { }
  try { unlocked = clamp(parseInt(localStorage.getItem(STORE.unlocked) || '1', 10) || 1, 1, TOTAL_LEVELS); } catch (e) { unlocked = 1; }
  totalStars = 0; totalScore = 0;
  for (let n = 1; n <= TOTAL_LEVELS; n++) { totalStars += starsByLevel[n] || 0; totalScore += bestScores[n] || 0; }
  try { best = Math.max(totalScore, parseInt(localStorage.getItem(STORE.best) || '0', 10) || 0); } catch (e) { best = totalScore; }
}
function saveProgress() {
  try {
    localStorage.setItem(STORE.stars, JSON.stringify(starsByLevel));
    localStorage.setItem(STORE.scores, JSON.stringify(bestScores));
    localStorage.setItem(STORE.unlocked, String(unlocked));
    localStorage.setItem(STORE.best, String(best));
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
  refreshTitle();
  updateHUD();
}
loadProgress();

// ==================== protocol bridge ====================
function toWireReport(frame) {
  const score = Number.isFinite(frame.score) ? Math.round(frame.score) : undefined;
  if (frame.kind === 'progress') return { kind: 'progress', data: { ...frame } };
  if (frame.kind === 'event') return { kind: 'event', event: String(frame.event || frame.tag || 'event'), data: { ...frame } };
  if (frame.kind === 'gameOver') return { kind: 'gameOver', score, progress: { value: frame.progress }, data: { ...frame } };
  if (frame.kind === 'complete') return { kind: 'complete', score };
  return frame;
}
function report(kind, payload = {}) {
  const frame = { kind, ...payload };
  if (Number.isFinite(frame.score)) frame.score = Math.round(frame.score);
  reports.push(frame);
  try {
    if (reportTarget) reportTarget(frame);
    else if (window.parent !== window) {
      window.parent.postMessage({ source: 'lightgame', type: 'lightgame:report', payload: toWireReport(frame) }, '*');
      if (frame.kind === 'ready') window.parent.postMessage({ source: 'lightgame', type: 'lightgame:ready', gameId: 'aqua-conduit', v: 1 }, '*');
    }
  } catch (e) { }
}
report('ready', { game: 'aqua-conduit', version: '1.0.0' });

// ==================== DOM refs ====================
const ui = {
  hud: $('#hud'), title: $('#title'), end: $('#end'), pause: $('#pause'), toast: $('#toast'),
  chapter: $('#hud-chapter'), name: $('#hud-level'), sub: $('#hud-sub'),
  moves: $('#hud-moves'), budget: $('#hud-budget'), bar: $('#hud-bar'),
  target: $('#hud-target'), time: $('#hud-time'), mech: $('#hud-mech'),
  stars: $('#hud-stars'), starsl: $('#hud-starsl'),
  mute: $('#btn-mute'), pauseBtn: $('#btn-pause'), restart: $('#btn-restart'), titleBtn: $('#btn-title'),
  reset2: $('#btn-reset2'), pause2: $('#btn-pause2'),
  hint: $('#hintline'),
  titleStars: $('#title-stars'), titleBest: $('#title-best'), titleProgress: $('#title-progress'),
  start: $('#startbtn'), chaptermap: $('#chaptermap'),
  endKick: $('#end-kick'), endHeading: $('#end-heading'), endReason: $('#end-reason'),
  endStars: [...document.querySelectorAll('#end-stars span')],
  endScore: $('#end-score'), endLeft: $('#end-left'), endTime: $('#end-time'), endOptimal: $('#end-optimal'),
  endNext: $('#end-next'), endRetry: $('#end-retry'), endHome: $('#end-home'),
  pauseResume: $('#pause-resume'), pauseTitle: $('#pause-title'),
};

function toast(msg) {
  if (!ui.toast) return;
  ui.toast.textContent = msg;
  ui.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ui.toast.classList.remove('show'), 1600);
}
function chapterOf(n) { return chapterFor(n); }

function updateMuteBtn() {
  if (!ui.mute) return;
  ui.mute.textContent = audio.isMuted() ? '静' : '声';
  ui.mute.classList.toggle('off', audio.isMuted());
}

function mechChips() {
  if (!level) return [];
  const c = { valve: 0, oneway: 0, cross: 0, tee: 0, straight: 0, elbow: 0 };
  for (const cell of level.cells) if (cell.onPath) c[cell.t] = (c[cell.t] || 0) + 1;
  const out = [];
  if (level.mech === 'color') out.push(['双色水脉', 'cop']);
  if (c.valve) out.push([`铜闸 ×${c.valve}`, 'cop']);
  if (c.oneway) out.push([`单向阀 ×${c.oneway}`, 'ver']);
  if (c.cross) out.push([`十字桥 ×${c.cross}`, '']);
  if (c.tee) out.push([`三通 ×${c.tee}`, '']);
  if (!out.length) out.push([c.elbow ? `弯头 ×${c.elbow}` : '直管', '']);
  return out;
}

function updateHUD() {
  if (!ui.hud || !level) return;
  if (mode === 'title') { ui.hud.classList.add('hidden'); return; }
  ui.hud.classList.remove('hidden');
  const ch = chapterOf(levelN);
  ui.chapter.innerHTML = `<span class="knum">第 ${pad2(levelN)} 关</span><span class="kch"> · 第${['一', '二', '三', '四'][ch.id - 1]}章 ${ch.zh}</span>`;
  ui.name.textContent = level.name;
  ui.sub.textContent = level.subtitle;
  ui.moves.textContent = String(movesLeft);
  ui.budget.textContent = String(level.budget);
  ui.moves.classList.toggle('low', movesLeft <= Math.max(1, Math.ceil(level.budget * .2)));
  const pct = level.budget > 0 ? clamp(movesLeft / level.budget, 0, 1) : 0;
  ui.bar.style.width = (pct * 100).toFixed(1) + '%';
  ui.bar.classList.toggle('danger', movesLeft <= Math.max(1, Math.ceil(level.budget * .2)));
  ui.bar.classList.toggle('warn', movesLeft > Math.max(1, Math.ceil(level.budget * .2)) && movesLeft <= Math.ceil(level.budget * .45));
  ui.target.textContent = `三星 ≤ ${level.optimal} 步 · 限时 ${level.par}s`;
  ui.time.textContent = fmtTime(elapsed);
  ui.mech.innerHTML = mechChips().map(([t, cls]) => `<span class="${cls}">${t}</span>`).join('');
  const st = starsByLevel[levelN] || 0;
  ui.stars.textContent = '★'.repeat(st) + '☆'.repeat(3 - st);
  ui.starsl.textContent = `总星 ${totalStars} / ${TOTAL_LEVELS * 3}`;
  const hints = {
    basic: '点按管件旋转 <b>90°</b> · <b>Shift</b>/右键反向',
    valve: '铜闸转到「<b>通</b>」才会放水 · 点按旋转',
    oneway: '单向阀只认<b>箭头</b> · 十字桥只走直线',
    color: '<b>碧水</b>与<b>蓝水</b>不能混流 · 各自接到同色目标',
  };
  ui.hint.innerHTML = (hints[level.mech] || hints.basic) + ' · <b>R</b> 重开 · <b>P</b> 暂停';
}

function refreshTitle() {
  if (!ui.titleStars) return;
  ui.titleStars.textContent = String(totalStars);
  ui.titleBest.textContent = String(best);
  ui.titleProgress.textContent = `${unlocked} / ${TOTAL_LEVELS}`;
  ui.start.textContent = unlocked > 1 ? `继续 · 第 ${pad2(unlocked)} 关` : '开始引水';
  const buttons = ui.chaptermap ? ui.chaptermap.querySelectorAll('.lv') : [];
  buttons.forEach(btn => {
    const n = Number(btn.dataset.level);
    const st = starsByLevel[n] || 0;
    const locked = n > unlocked;
    btn.classList.toggle('locked', locked);
    btn.classList.toggle('cur', !locked && n === unlocked);
    const stars = btn.querySelector('.ls');
    if (stars) stars.textContent = locked ? '◇' : (st > 0 ? '★'.repeat(st) : '·');
  });
}

function buildTitleMap() {
  if (!ui.chaptermap) return;
  ui.chaptermap.innerHTML = '';
  for (const ch of CHAPTERS) {
    const box = document.createElement('div');
    box.className = 'chapter';
    const head = document.createElement('div');
    head.className = 'chhead';
    head.innerHTML = `<span class="ch">${ch.zh}</span><span class="ce">${ch.en}</span>`;
    box.appendChild(head);
    const grid = document.createElement('div');
    grid.className = 'levels';
    for (let n = ch.range[0]; n <= ch.range[1]; n++) {
      const b = document.createElement('button');
      b.className = 'lv';
      b.dataset.level = n;
      b.title = `第 ${n} 关 · ${levelByNumber(n).name}`;
      b.innerHTML = `<span>${pad2(n)}</span><span class="ls">·</span>`;
      b.addEventListener('click', () => { if (n <= unlocked) startLevel(n); });
      grid.appendChild(b);
    }
    box.appendChild(grid);
    ui.chaptermap.appendChild(box);
  }
  refreshTitle();
}

// ==================== level lifecycle ====================
function cloneLevel(n) {
  const src = levelByNumber(n);
  const lvl = {
    ...src,
    sources: src.sources.map(s => ({ ...s })),
    targets: src.targets.map(t => ({ ...t })),
    cells: src.cells.map(c => ({ ...c })),
  };
  delete lvl.__idx;
  return lvl;
}
function layout(lvl = level) {
  const cols = lvl ? lvl.cols : 6, rows = lvl ? lvl.rows : 4;
  const area = { x: 100, y: 92, w: 760, h: 398 };
  const tile = Math.min(area.w / cols, area.h / rows, 94);
  return {
    x: area.x + (area.w - tile * cols) / 2,
    y: area.y + (area.h - tile * rows) / 2,
    tile, cols, rows,
  };
}
function buildIndex() { if (level) levelIndex(level); }

function loadLevel(n, opts = {}) {
  levelN = clamp(n, 1, TOTAL_LEVELS);
  level = cloneLevel(levelN);
  buildIndex();
  used = 0; movesLeft = level.budget; elapsed = 0; flowPhase = 0;
  paused = false; hitstop = 0; shakeT = 0; flashT = 0; endTimer = 0; pendingEnd = null; lastOutcome = null;
  particles = []; floats = []; hover = null; pointer = null;
  demoMode = !!opts.demo;
  const first = level.cells.find(c => c.onPath && isMovable(c) && c.t !== 'cross');
  cursor = first ? { r: first.r, c: first.c } : { r: 0, c: 0 };
  flow = solveFlow(level);
  if (opts.demo) applyDemo(opts.demoFrac || .66);
  updateHUD();
  return level;
}
function startLevel(n, opts = {}) {
  loadLevel(n, opts);
  mode = 'play';
  ui.title.classList.add('hidden');
  ui.end.classList.add('hidden');
  ui.pause.classList.add('hidden');
  ui.hud.classList.remove('hidden');
  audio.setState('play');
  audio.sfx.level();
  report('progress', {
    score: totalScore, progress: levelN, stars: totalStars,
    budget: level.budget, optimal: level.optimal,
  });
  const ch = chapterOf(levelN);
  toast(`第 ${pad2(levelN)} 关 · ${level.name} — ${level.subtitle}`);
  ui.hint.innerHTML = `第${['一', '二', '三', '四'][ch.id - 1]}章 ${ch.zh} · 点按管件旋转 <b>90°</b> · <b>R</b> 重开`;
  updateHUD();
  return true;
}
function restartLevel() {
  if (mode === 'title') return false;
  const n = levelN;
  loadLevel(n);
  mode = 'play';
  ui.end.classList.add('hidden');
  ui.pause.classList.add('hidden');
  ui.hud.classList.remove('hidden');
  audio.setState('play');
  toast('已重开 · 水路复位');
  updateHUD();
  return true;
}
function toTitle() {
  mode = 'title'; paused = false; demoMode = false;
  ui.hud.classList.add('hidden');
  ui.end.classList.add('hidden');
  ui.pause.classList.add('hidden');
  ui.title.classList.remove('hidden');
  audio.setState('title');
  if (!backdrop) makeBackdrop();
  refreshTitle();
  updateHUD();
}
function nextLevel() {
  if (levelN < TOTAL_LEVELS) startLevel(levelN + 1);
  else toTitle();
}

function makeBackdrop() {
  backdrop = cloneLevel(18);
  const aw = backdrop.pathA || [];
  const takeA = Math.max(3, Math.floor(aw.length * .62));
  for (let i = 0; i < takeA; i++) {
    const [r, c] = aw[i];
    const cell = cellAt(backdrop, r, c);
    if (cell && isMovable(cell) && cell.t !== 'cross') cell.rot = cell.sol;
  }
  backdropFlow = solveFlow(backdrop);
}

// ==================== scoring / outcome ====================
function calcStars(levelDef, usedMoves, time) {
  if (usedMoves <= levelDef.optimal && time <= levelDef.par) return 3;
  if (usedMoves <= levelDef.optimal + Math.max(1, Math.ceil(levelDef.slack / 2)) && time <= levelDef.par * 1.6) return 2;
  return 1;
}
function calcLevelScore(levelDef, usedMoves, stars, time) {
  const remain = Math.max(0, levelDef.budget - usedMoves);
  const timeBonus = Math.max(0, Math.round(levelDef.par - time));
  return Math.max(0, Math.round(remain * 12 + stars * 60 + timeBonus * 2));
}

function winLevel(forced = false) {
  if (mode !== 'play') return false;
  mode = 'win'; paused = false;
  const stars = forced ? 3 : calcStars(level, used, elapsed);
  const score = calcLevelScore(level, forced ? level.optimal : used, stars, elapsed);
  starsByLevel[levelN] = Math.max(starsByLevel[levelN] || 0, stars);
  bestScores[levelN] = Math.max(bestScores[levelN] || 0, score);
  if (levelN < TOTAL_LEVELS) unlocked = Math.max(unlocked, levelN + 1);
  totalStars = 0; totalScore = 0;
  for (let n = 1; n <= TOTAL_LEVELS; n++) { totalStars += starsByLevel[n] || 0; totalScore += bestScores[n] || 0; }
  best = Math.max(best, totalScore);
  saveProgress();
  lastOutcome = { win: true, stars, score, used, movesLeft, elapsed, optimal: level.optimal, level: levelN };
  audio.setState('win'); audio.sfx.win();
  const L = layout();
  for (const t of level.targets) {
    const i = indexAt(level, t.r, t.c);
    const x = L.x + t.c * L.tile + L.tile / 2, y = L.y + t.r * L.tile + L.tile / 2;
    burst(x, y, t.color === 'azure' ? '#6fb6ff' : '#78e0c8', 22, 150, 1.1, 3.2, 260);
    ripple(x, y, t.color === 'azure' ? '#6fb6ff' : '#78e0c8', 1.0);
  }
  for (let i = 0; i < 34; i++) {
    const x = L.x + Math.random() * L.tile * L.cols;
    const y = L.y + Math.random() * L.tile * L.rows;
    burst(x, y, i % 3 === 0 ? '#f2cf8d' : (i % 3 === 1 ? '#78e0c8' : '#e26858'), 1, 60, .9, 2, 280);
  }
  shakeT = .5; shakeAmp = 6; flashT = .45; flashColor = '255,226,170'; hitstop = .09;
  report('complete', {
    score: totalScore, progress: levelN, stars, levelScore: score,
    moves: used, movesLeft, optimal: level.optimal, time: +elapsed.toFixed(1), totalStars,
  });
  if (levelN === TOTAL_LEVELS) report('event', { event: 'campaign_complete', score: totalScore });
  endTimer = .85; pendingEnd = 'win';
  updateHUD();
  return true;
}

function failLevel(reason) {
  if (mode !== 'play') return false;
  mode = 'over'; paused = false;
  lastOutcome = { win: false, reason: reason || '水路未通', score: totalScore, used, movesLeft, elapsed, level: levelN };
  audio.setState('fail'); audio.sfx.fail();
  shakeT = .65; shakeAmp = 8; flashT = .35; flashColor = '226,104,88'; hitstop = .08;
  const L = layout();
  for (let i = 0; i < 24; i++) {
    burst(L.x + Math.random() * L.tile * L.cols, L.y + Math.random() * L.tile * L.rows,
      i % 2 ? '#e26858' : '#8d3333', 1, 100, .9, 2.4, 320);
  }
  report('gameOver', {
    score: totalScore, progress: levelN, reason: lastOutcome.reason,
    moves: used, movesLeft, optimal: level.optimal, time: +elapsed.toFixed(1),
  });
  endTimer = .7; pendingEnd = 'over';
  updateHUD();
  return true;
}

function evaluateOutcome() {
  if (mode !== 'play' || demoMode) return;
  flow = solveFlow(level);
  if (flow.solved) { winLevel(false); return; }
  if (movesLeft <= 0) failLevel('步数用尽，水路仍未接通');
}
function setMoves(n) {
  movesLeft = Math.max(0, Math.round(+n || 0));
  updateHUD();
  if (mode === 'play') evaluateOutcome();
  return movesLeft;
}
function setRotationsForSolution(checkOpen = true) {
  if (!level) return false;
  for (const c of level.cells) {
    if (c.onPath && isMovable(c) && c.t !== 'cross') c.rot = c.sol;
  }
  flow = solveFlow(level);
  updateHUD();
  return flow.solved;
}

// ==================== rotation ====================
function rotateCell(r, c, dir = 1, opts = {}) {
  if (mode !== 'play' || paused) return false;
  const cell = cellAt(level, r, c);
  if (!cell) return false;
  if (!isMovable(cell) || cell.t === 'cross') {
    if (!opts.silent) { audio.sfx.blocked(); toast(cell.t === 'cross' ? '十字水桥四向贯通，不用旋转' : '这块是石壁，转不动'); }
    return false;
  }
  if (!opts.free && movesLeft <= 0) {
    if (!opts.silent) { audio.sfx.blocked(); toast('步数已用尽'); }
    evaluateOutcome();
    return false;
  }
  const q = dir < 0 ? 3 : 1;
  const before = cell.rot;
  const wasOpen = cell.t === 'valve' && before === cell.sol;
  cell.rot = (cell.rot + q) & 3;
  if (!opts.free) { used++; movesLeft = Math.max(0, movesLeft - 1); }
  const nowOpen = cell.t === 'valve' && cell.rot === cell.sol;
  if (cell.t === 'valve' && nowOpen && !wasOpen) {
    audio.sfx.valveOpen();
    report('event', { event: 'valve_open', progress: levelN, score: totalScore });
  } else if (cell.t === 'valve' && !nowOpen && wasOpen) {
    audio.sfx.valveClosed();
  } else {
    audio.sfx.rotate();
  }
  const L = layout();
  const x = L.x + c * L.tile + L.tile / 2, y = L.y + r * L.tile + L.tile / 2;
  if (!opts.silent) {
    burst(x, y, cell.t === 'valve' ? (nowOpen ? '#78e0c8' : '#e26858') : '#f2cf8d', 7, 68, .42, 2, 240);
    if (cell.t === 'oneway') ripple(x, y, '#f0b85e', .28);
  }
  const beforeSolved = flow && flow.solved;
  flow = solveFlow(level);
  if (!opts.silent) {
    if (flow.solved && !beforeSolved) {
      shakeT = .25; shakeAmp = 3; flashT = .18; flashColor = '160,240,220';
      audio.sfx.splash();
    } else if (level.mech === 'color' && flow.mixed.size) {
      audio.sfx.mix();
      shakeT = .18; shakeAmp = 2.2;
      toast('两色混流了 · 分开它们');
    }
  }
  updateHUD();
  if (!opts.noCheck && !demoMode) evaluateOutcome();
  return true;
}

function autoSolveCurrent(opts = {}) {
  if (mode === 'title') startLevel(levelN);
  if (mode !== 'play') return mode === 'win';
  const steps = autoSolution(level);
  for (const st of steps) {
    if (mode !== 'play') break;
    rotateCell(st.r, st.c, st.dir, { silent: true, noCheck: true, free: !!opts.free });
  }
  flow = solveFlow(level);
  if (flow.solved) winLevel(!!opts.forced);
  else if (movesLeft <= 0) failLevel('参考解步数与预算不符');
  return mode === 'win';
}

function solveAllLevels() {
  const out = { allWin: true, failures: [], nan: false, levels: [] };
  for (let n = 1; n <= TOTAL_LEVELS; n++) {
    startLevel(n);
    const won = autoSolveCurrent();
    const st = state();
    out.levels.push({ id: n, won, mode, used, optimal: level.optimal, stars: lastOutcome && lastOutcome.stars, nan: st.nan });
    if (!won) { out.allWin = false; out.failures.push(n); }
    if (st.nan) out.nan = true;
  }
  return out;
}

// ==================== FX ====================
function burst(x, y, color, n = 8, speed = 80, life = .5, size = 2, grav = 300) {
  if (particles.length > 260) particles.splice(0, particles.length - 240);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, sp = speed * (.35 + Math.random());
    particles.push({
      x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - speed * .28,
      life: life * (.6 + Math.random() * .7), max: life, size: size * (.45 + Math.random()),
      color, grav,
    });
  }
}
function ripple(x, y, color, life = .5, r0 = 4, r1 = 26) {
  particles.push({ x, y, ring: true, life, max: life, color, r0, r1, size: 1, grav: 0 });
}
function floatText(x, y, text, color = '#f2cf8d') {
  floats.push({ x, y, text, life: 1.05, color, size: 16 });
}
function updateFX(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) { particles.splice(i, 1); continue; }
    if (p.ring) continue;
    p.vy += (p.grav || 0) * dt;
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vx *= .988; p.vy *= .988;
  }
  for (let i = floats.length - 1; i >= 0; i--) {
    const f = floats[i];
    f.life -= dt; f.y -= 26 * dt;
    if (f.life <= 0) floats.splice(i, 1);
  }
  if (shakeT > 0) shakeT = Math.max(0, shakeT - dt);
  if (flashT > 0) flashT = Math.max(0, flashT - dt);
}

// ==================== update ====================
function update(dt) {
  if (mode === 'play' && paused) { audio.update(dt); return; }
  if (mode === 'play') {
    if (hitstop > 0) hitstop = Math.max(0, hitstop - dt);
    else {
      elapsed += dt;
      flowPhase += dt;
      updateFX(dt);
    }
    hudT += dt;
    if (hudT >= .2) { hudT = 0; updateHUD(); }
    if (endTimer > 0) {
      endTimer -= dt;
      if (endTimer <= 0 && pendingEnd && !noAuto) showEnd();
    }
    audio.update(dt);
  } else if (mode === 'win' || mode === 'over') {
    if (hitstop > 0) hitstop = Math.max(0, hitstop - dt);
    else { flowPhase += dt * .7; updateFX(dt); }
    if (endTimer > 0) {
      endTimer -= dt;
      if (endTimer <= 0 && pendingEnd && !noAuto) showEnd();
    }
    audio.update(dt);
  } else {
    flowPhase += dt * .55;
    updateFX(dt);
    audio.update(dt);
  }
}

function showEnd() {
  if (!pendingEnd) return;
  const r = lastOutcome || {};
  const win = !!r.win;
  ui.end.classList.remove('hidden');
  ui.endKick.textContent = win ? 'FLOW REPORT · 水路报告' : 'FLOW REPORT · 断流报告';
  ui.endHeading.textContent = win ? (levelN === TOTAL_LEVELS ? '水脉贯通' : '水路通了') : '水路未通';
  ui.endReason.textContent = win
    ? (levelN === TOTAL_LEVELS ? '二十四关水脉相连 · 灯河不眠' : (level.mech === 'color' ? '双色归位 · 各入其泉' : '清水抵达终点'))
    : (r.reason || '步数用尽');
  ui.endStars.forEach((el, i) => {
    el.classList.toggle('on', win && i < (r.stars || 0));
  });
  ui.endScore.textContent = String(r.score || 0);
  ui.endLeft.textContent = String(Math.max(0, r.movesLeft == null ? movesLeft : r.movesLeft));
  ui.endTime.textContent = (r.elapsed == null ? elapsed : r.elapsed).toFixed(1) + 's';
  ui.endOptimal.textContent = String(level ? level.optimal : 0);
  const isLast = levelN >= TOTAL_LEVELS;
  ui.endNext.disabled = !win || isLast;
  ui.endNext.textContent = isLast ? '已到终章' : '下一关';
  ui.endRetry.textContent = '再来一次';
  ui.endHome.textContent = '回标题';
  if (win) setTimeout(() => audio.sfx.star(), 140);
}

function togglePause() {
  if (mode !== 'play') return false;
  paused = !paused;
  ui.pause.classList.toggle('hidden', !paused);
  ui.pauseBtn.textContent = paused ? '▶' : 'Ⅱ';
  if (paused) audio.sfx.ui();
  return paused;
}
function setPaused(v) {
  if (mode !== 'play') return false;
  paused = !!v;
  ui.pause.classList.toggle('hidden', !paused);
  ui.pauseBtn.textContent = paused ? '▶' : 'Ⅱ';
  return paused;
}
function toggleMute() {
  const m = audio.toggleMute();
  updateMuteBtn();
  toast(m ? '已静音' : '声音已开启');
  return m;
}

// ==================== input ====================
const pressed = new Set();
addEventListener('keydown', (e) => {
  if (e.isComposing || e.keyCode === 229) return;
  if (e.metaKey || e.altKey || e.ctrlKey) return;
  if (!e.repeat) pressed.add(e.code);
  if (['Space', 'Tab', 'Enter', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (e.isTrusted && !AUTOTEST) audio.ensure();
});
addEventListener('keyup', () => { });
addEventListener('blur', () => pressed.clear());
document.addEventListener('visibilitychange', () => { if (document.hidden) pressed.clear(); });

function moveCursor(dr, dc) {
  if (!level) return;
  cursor.r = clamp(cursor.r + dr, 0, level.rows - 1);
  cursor.c = clamp(cursor.c + dc, 0, level.cols - 1);
  audio.sfx.ui();
}
function handleKeys() {
  for (const code of pressed) {
    if (code === 'KeyM') toggleMute();
    else if (code === 'KeyP') togglePause();
    else if (code === 'KeyR') { if (mode !== 'title') restartLevel(); }
    else if (code === 'Escape') { if (mode === 'play') setPaused(!paused); }
    else if (code === 'ArrowUp' || code === 'KeyW') moveCursor(-1, 0);
    else if (code === 'ArrowDown' || code === 'KeyS') moveCursor(1, 0);
    else if (code === 'ArrowLeft' || code === 'KeyA') moveCursor(0, -1);
    else if (code === 'ArrowRight' || code === 'KeyD') moveCursor(0, 1);
    else if (code === 'Space' || code === 'Enter') {
      if (mode === 'title') startLevel(Math.min(unlocked, TOTAL_LEVELS));
      else if (mode === 'play') {
        if (paused) setPaused(false);
        else rotateCell(cursor.r, cursor.c, 1);
      } else if (mode === 'win') nextLevel();
      else if (mode === 'over') restartLevel();
    }
  }
  pressed.clear();
}

function toLogical(clientX, clientY) {
  return { x: (clientX - viewOX) / viewScale, y: (clientY - viewOY) / viewScale };
}
function cellFromLogical(x, y) {
  if (!level) return null;
  const L = layout();
  const c = Math.floor((x - L.x) / L.tile), r = Math.floor((y - L.y) / L.tile);
  if (r < 0 || c < 0 || r >= level.rows || c >= level.cols) return null;
  return { r, c };
}
cv.addEventListener('pointerdown', (e) => {
  if (mode !== 'play' || paused) return;
  if (e.isTrusted && !AUTOTEST) audio.ensure();
  const p = toLogical(e.clientX, e.clientY);
  const cell = cellFromLogical(p.x, p.y);
  if (!cell) return;
  const dir = (e.button === 2 || e.shiftKey) ? -1 : 1;
  cursor = { r: cell.r, c: cell.c };
  rotateCell(cell.r, cell.c, dir);
  e.preventDefault();
});
cv.addEventListener('pointermove', (e) => {
  if (mode !== 'play') { hover = null; return; }
  const p = toLogical(e.clientX, e.clientY);
  pointer = p;
  const cell = cellFromLogical(p.x, p.y);
  hover = cell;
  cv.style.cursor = cell && isMovable(cellAt(level, cell.r, cell.c)) && cellAt(level, cell.r, cell.c).t !== 'cross' ? 'pointer' : 'default';
});
cv.addEventListener('pointerleave', () => { hover = null; });
cv.addEventListener('contextmenu', (e) => e.preventDefault());

// UI buttons
ui.mute.addEventListener('click', () => toggleMute());
ui.pauseBtn.addEventListener('click', () => { if (!AUTOTEST) audio.ensure(); togglePause(); });
ui.restart.addEventListener('click', () => restartLevel());
ui.titleBtn.addEventListener('click', () => toTitle());
ui.reset2.addEventListener('click', () => restartLevel());
ui.pause2.addEventListener('click', () => togglePause());
ui.start.addEventListener('click', () => { if (!AUTOTEST) audio.ensure(); startLevel(Math.min(unlocked, TOTAL_LEVELS)); });
ui.endNext.addEventListener('click', () => { if (lastOutcome && lastOutcome.win) nextLevel(); });
ui.endRetry.addEventListener('click', () => restartLevel());
ui.endHome.addEventListener('click', () => toTitle());
ui.pauseResume.addEventListener('click', () => setPaused(false));
ui.pauseTitle.addEventListener('click', () => toTitle());
buildTitleMap();
updateMuteBtn();

document.addEventListener('pointerdown', (e) => { if (e.isTrusted && !AUTOTEST) audio.ensure(); }, true);

// ==================== rendering ====================
function rr(c, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

function drawBackground(t) {
  ctx.drawImage(bg, 0, 0, W, H);
  // ambient dust / fireflies
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < 22; i++) {
    const x = (i * 137.3 + Math.sin(t * .17 + i) * 22 + W) % W;
    const y = 70 + ((i * 73.7 + t * (2 + i % 4)) % (H - 130));
    const a = .04 + .10 * (.5 + .5 * Math.sin(t * 1.3 + i * 2.1));
    ctx.fillStyle = `rgba(${i % 3 ? '240,201,138' : '120,224,200'},${a})`;
    ctx.beginPath(); ctx.arc(x, y, .7 + (i % 3) * .55, 0, 7); ctx.fill();
  }
  ctx.restore();
}

function tileHash(r, c, id) {
  let h = (r * 374761393 + c * 668265263 + id * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function drawTile(r, c, x, y, s, hasPipe) {
  const h = tileHash(r, c, levelN);
  const g = ctx.createLinearGradient(x, y, x + s, y + s);
  g.addColorStop(0, hasPipe ? '#1b2a4d' : '#172445');
  g.addColorStop(.5, '#101a33');
  g.addColorStop(1, hasPipe ? '#0c1428' : '#0b1224');
  rr(ctx, x + 1.5, y + 1.5, s - 3, s - 3, s * .1);
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = 'rgba(6,10,20,.72)'; ctx.lineWidth = 1.4; ctx.stroke();
  // bevel highlight
  ctx.beginPath();
  ctx.moveTo(x + s * .13, y + s * .07);
  ctx.lineTo(x + s * .87, y + s * .07);
  ctx.strokeStyle = 'rgba(200,220,255,.055)'; ctx.lineWidth = 1; ctx.stroke();
  // inner inset
  rr(ctx, x + s * .1, y + s * .1, s * .8, s * .8, s * .06);
  ctx.strokeStyle = 'rgba(215,160,90,.055)'; ctx.lineWidth = .8; ctx.stroke();
  // corner rivets
  ctx.fillStyle = 'rgba(215,160,90,.22)';
  for (const [dx, dy] of [[.16, .16], [.84, .16], [.16, .84], [.84, .84]]) {
    ctx.beginPath(); ctx.arc(x + s * dx, y + s * dy, Math.max(.8, s * .015), 0, 7); ctx.fill();
  }
  // engraved motif on quiet tiles
  if (!hasPipe) {
    ctx.strokeStyle = `rgba(120,224,200,${.035 + h * .035})`;
    ctx.lineWidth = .8;
    ctx.beginPath();
    if (h < .33) { ctx.arc(x + s / 2, y + s / 2, s * (.15 + h * .05), .2, 2.7); }
    else if (h < .66) {
      ctx.moveTo(x + s * .3, y + s * .68); ctx.quadraticCurveTo(x + s * .5, y + s * .36, x + s * .7, y + s * .68);
    } else {
      ctx.moveTo(x + s * .28, y + s * .3); ctx.lineTo(x + s * .4, y + s * .3); ctx.lineTo(x + s * .4, y + s * .42);
    }
    ctx.stroke();
    // tile crack
    if (h > .55) {
      ctx.strokeStyle = 'rgba(6,10,20,.35)'; ctx.lineWidth = .7;
      ctx.beginPath();
      ctx.moveTo(x + s * (.2 + h * .5), y + s * .18);
      ctx.lineTo(x + s * (.28 + h * .4), y + s * .44);
      ctx.lineTo(x + s * (.22 + h * .45), y + s * .72);
      ctx.stroke();
    }
  }
}

function drawBoardFrame(L) {
  const pad = 10;
  const x = L.x - pad, y = L.y - pad, w = L.tile * L.cols + pad * 2, h = L.tile * L.rows + pad * 2;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 8;
  rr(ctx, x, y, w, h, 14);
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, 'rgba(38,50,82,.65)'); g.addColorStop(1, 'rgba(10,16,31,.82)');
  ctx.fillStyle = g; ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(215,160,90,.34)'; ctx.lineWidth = 1.6;
  rr(ctx, x, y, w, h, 14); ctx.stroke();
  ctx.strokeStyle = 'rgba(120,224,200,.12)'; ctx.lineWidth = .8;
  rr(ctx, x + 4, y + 4, w - 8, h - 8, 11); ctx.stroke();
  // corner ornaments
  ctx.strokeStyle = 'rgba(215,160,90,.5)'; ctx.lineWidth = 1.2;
  for (const [cx, cy, sx, sy] of [[x + 8, y + 8, 1, 1], [x + w - 8, y + 8, -1, 1], [x + 8, y + h - 8, 1, -1], [x + w - 8, y + h - 8, -1, -1]]) {
    ctx.beginPath();
    ctx.moveTo(cx + sx * 12, cy); ctx.lineTo(cx, cy); ctx.lineTo(cx, cy + sy * 12);
    ctx.stroke();
    ctx.fillStyle = 'rgba(215,160,90,.5)';
    ctx.beginPath(); ctx.arc(cx, cy, 1.6, 0, 7); ctx.fill();
  }
  // clip to board
  ctx.save();
  rr(ctx, x - 2, y - 2, w + 4, h + 4, 15); ctx.clip();
  const bgm = ctx.createRadialGradient(L.x + w * .5, L.y + h * .4, 10, L.x + w * .5, L.y + h * .5, w * .7);
  bgm.addColorStop(0, 'rgba(34,50,88,.35)'); bgm.addColorStop(1, 'rgba(4,8,16,.30)');
  ctx.fillStyle = bgm; ctx.fillRect(x, y, w, h);
  ctx.restore();
  return { x, y, w, h };
}

function pipePath(cx, cy, dirs, half) {
  ctx.beginPath();
  if (dirs.length === 2 && OPP[dirs[0]] !== dirs[1]) {
    const a = dirs[0], b = dirs[1];
    ctx.moveTo(cx + DX[a] * half, cy + DY[a] * half);
    ctx.quadraticCurveTo(cx, cy, cx + DX[b] * half, cy + DY[b] * half);
  } else if (dirs.length === 2) {
    const a = dirs[0], b = dirs[1];
    ctx.moveTo(cx + DX[a] * half, cy + DY[a] * half);
    ctx.lineTo(cx + DX[b] * half, cy + DY[b] * half);
  } else if (dirs.length === 1) {
    ctx.moveTo(cx, cy); ctx.lineTo(cx + DX[dirs[0]] * half, cy + DY[dirs[0]] * half);
  } else {
    for (const d of dirs) {
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + DX[d] * half, cy + DY[d] * half);
    }
  }
}

function pipeColors(color) {
  if (color === 'azure') return { a: '#d8ecff', b: '#6fb6ff', c: '#2d5f9e', glow: 'rgba(111,182,255,.6)' };
  return { a: '#b8fff0', b: '#6fe3ca', c: '#2e857c', glow: 'rgba(111,227,202,.55)' };
}

function drawPipe(cell, x, y, s, flowInfo, index) {
  const mask = maskAt(cell, cell.rot);
  const dirs = dirsOf(mask);
  if (!dirs.length) return;
  const cx = x + s / 2, cy = y + s / 2, half = s * .485;
  const outer = s * .285, bore = s * .155, waterW = s * .088;
  const copper = ctx.createLinearGradient(x, y, x + s, y + s);
  copper.addColorStop(0, '#f4d49b');
  copper.addColorStop(.28, '#c98c4a');
  copper.addColorStop(.62, '#8c5229');
  copper.addColorStop(1, '#5b351c');
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // shadow
  ctx.save(); ctx.translate(2.2, 3.2);
  pipePath(cx, cy, dirs, half);
  ctx.strokeStyle = 'rgba(0,0,0,.42)'; ctx.lineWidth = outer + 2;
  ctx.stroke(); ctx.restore();
  // outer copper wall
  pipePath(cx, cy, dirs, half);
  ctx.strokeStyle = copper; ctx.lineWidth = outer; ctx.stroke();
  // bore
  pipePath(cx, cy, dirs, half);
  ctx.strokeStyle = '#080e1c'; ctx.lineWidth = bore; ctx.stroke();
  // inner highlight
  pipePath(cx, cy, dirs, half);
  ctx.strokeStyle = 'rgba(255,238,205,.10)'; ctx.lineWidth = Math.max(1, s * .018); ctx.stroke();
  // arms that actually carry water
  const colors = flowInfo.cellColors.get(index);
  const mixed = flowInfo.mixed && flowInfo.mixed.has(index);
  const reached = !!colors || mixed;
  if (reached) {
    let col = 'jade';
    if (colors && colors.size === 1) col = [...colors][0];
    const pc = mixed ? { a: '#c9b08a', b: '#9a7c52', c: '#5a4528', glow: 'rgba(160,130,90,.4)' } : pipeColors(col);
    const wdSet = flowInfo.waterDirs && flowInfo.waterDirs.get(index);
    let wdirs = wdSet ? dirs.filter(d => wdSet.has(d)) : dirs.slice();
    if (!wdirs.length) wdirs = dirs.slice();
    if (colors) {
      ctx.save();
      ctx.shadowColor = pc.glow; ctx.shadowBlur = s * .16;
      pipePath(cx, cy, wdirs, half * .96);
      ctx.strokeStyle = pc.b; ctx.lineWidth = waterW; ctx.stroke();
      // animated bright core
      ctx.shadowBlur = 0;
      ctx.setLineDash([s * .07, s * .16]);
      ctx.lineDashOffset = -flowPhase * s * 1.15;
      pipePath(cx, cy, wdirs, half * .96);
      ctx.strokeStyle = pc.a; ctx.lineWidth = Math.max(1.2, waterW * .38); ctx.globalAlpha = .85; ctx.stroke();
      ctx.setLineDash([]); ctx.globalAlpha = 1;
      ctx.restore();
    } else {
      // contaminated water: a muddy bulb with no clean flow
      ctx.save();
      ctx.fillStyle = 'rgba(150,118,78,.42)';
      ctx.beginPath(); ctx.arc(cx, cy, s * .105, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(200,170,120,.4)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(cx, cy, s * .15, 0, 7); ctx.stroke();
      ctx.restore();
    }
  }
  // flanges at the hub and arm ends
  if (dirs.length >= 2) {
    ctx.fillStyle = '#101a30'; ctx.strokeStyle = 'rgba(242,207,141,.7)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(cx, cy, s * .135, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,236,196,.75)';
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3 + .3;
      ctx.beginPath(); ctx.arc(cx + Math.cos(a) * s * .102, cy + Math.sin(a) * s * .102, Math.max(.8, s * .011), 0, 7); ctx.fill();
    }
  }
  for (const d of dirs) {
    const ex = cx + DX[d] * half, ey = cy + DY[d] * half;
    ctx.fillStyle = '#0c1426'; ctx.strokeStyle = 'rgba(215,160,90,.55)'; ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.arc(ex, ey, s * .072, 0, 7); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
}

function drawCrossArch(cell, x, y, s) {
  if (cell.t !== 'cross') return;
  const cx = x + s / 2, cy = y + s / 2;
  ctx.save();
  rr(ctx, cx - s * .105, cy - s * .30, s * .21, s * .60, s * .06);
  ctx.fillStyle = 'rgba(12,20,38,.72)'; ctx.fill();
  ctx.strokeStyle = 'rgba(242,207,141,.65)'; ctx.lineWidth = 1.3; ctx.stroke();
  ctx.strokeStyle = 'rgba(120,224,200,.38)'; ctx.lineWidth = .8;
  ctx.beginPath(); ctx.moveTo(cx - s * .07, cy - s * .24); ctx.lineTo(cx - s * .07, cy + s * .24); ctx.stroke();
  ctx.restore();
}

function drawValve(cell, x, y, s) {
  if (cell.t !== 'valve') return;
  const cx = x + s / 2, cy = y + s / 2;
  const open = cell.rot === cell.sol;
  ctx.save();
  const ring = open ? '#78e0c8' : '#e26858';
  ctx.shadowColor = open ? 'rgba(120,224,200,.7)' : 'rgba(226,104,88,.5)';
  ctx.shadowBlur = s * .13;
  ctx.fillStyle = 'rgba(15,22,38,.95)'; ctx.strokeStyle = ring; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(cx, cy, s * .205, 0, 7); ctx.fill(); ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#c98c4a'; ctx.lineWidth = 1.6;
  for (let i = 0; i < 5; i++) {
    const a = i * Math.PI * 2 / 5 + cell.rot * Math.PI / 2;
    ctx.beginPath(); ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a) * s * .17, cy + Math.sin(a) * s * .17); ctx.stroke();
  }
  ctx.fillStyle = open ? '#78e0c8' : '#e26858';
  ctx.beginPath(); ctx.arc(cx, cy, s * .042, 0, 7); ctx.fill();
  // chip
  ctx.font = `700 ${Math.round(s * .14)}px "Microsoft YaHei",sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const label = open ? '通' : '闭';
  ctx.fillStyle = open ? 'rgba(20,70,58,.92)' : 'rgba(84,30,28,.92)';
  rr(ctx, cx - s * .13, y + s * .08, s * .26, s * .18, s * .05); ctx.fill();
  ctx.strokeStyle = ring; ctx.lineWidth = .8; ctx.stroke();
  ctx.fillStyle = open ? '#b9fff0' : '#ffc0b4';
  ctx.fillText(label, cx, y + s * .175);
  ctx.restore();
}

function drawOneWay(cell, x, y, s) {
  if (cell.t !== 'oneway') return;
  const cx = x + s / 2, cy = y + s / 2;
  const en = (cell.e0 + cell.rot - cell.sol + 8) & 3;
  const ex = (cell.x0 + cell.rot - cell.sol + 8) & 3;
  const a = Math.atan2(DY[ex], DX[ex]);
  ctx.save();
  ctx.translate(cx, cy); ctx.rotate(a);
  ctx.fillStyle = 'rgba(12,18,32,.85)'; ctx.strokeStyle = '#f0b85e'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(s * .12, 0); ctx.lineTo(-s * .03, -s * .085); ctx.lineTo(-s * .03, s * .085); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ffe2a4';
  ctx.beginPath(); ctx.arc(s * .035, 0, s * .018, 0, 7); ctx.fill();
  ctx.restore();
  // inlet notch
  ctx.save();
  ctx.translate(cx + DX[en] * s * .28, cy + DY[en] * s * .28);
  ctx.rotate(Math.atan2(DY[en], DX[en]));
  ctx.strokeStyle = 'rgba(240,184,94,.6)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(-s * .04, -s * .04); ctx.lineTo(0, 0); ctx.lineTo(-s * .04, s * .04); ctx.stroke();
  ctx.restore();
}

function drawSource(cell, x, y, s, flowInfo, index) {
  const cx = x + s / 2, cy = y + s / 2;
  const colors = flowInfo.cellColors.get(index);
  const col = colors && colors.size === 1 ? [...colors][0] : (cell.color || 'jade');
  const pc = pipeColors(col);
  const hydrated = !!colors;
  ctx.save();
  ctx.shadowColor = hydrated ? pc.glow : 'rgba(0,0,0,0)'; ctx.shadowBlur = hydrated ? s * .2 : 0;
  const g = ctx.createRadialGradient(cx - s * .06, cy - s * .07, s * .01, cx, cy, s * .18);
  g.addColorStop(0, '#f6d9a0'); g.addColorStop(.4, '#c98c4a'); g.addColorStop(1, '#5b351c');
  ctx.fillStyle = g; ctx.strokeStyle = 'rgba(255,226,164,.75)'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.arc(cx, cy, s * .175, 0, 7); ctx.fill(); ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#070d19';
  ctx.beginPath(); ctx.arc(cx, cy, s * .09, 0, 7); ctx.fill();
  if (hydrated) {
    ctx.fillStyle = pc.b;
    ctx.beginPath(); ctx.arc(cx, cy, s * .062, 0, 7); ctx.fill();
    ctx.fillStyle = pc.a;
    ctx.beginPath(); ctx.arc(cx - s * .018, cy - s * .018, s * .022, 0, 7); ctx.fill();
  }
  // spout drops along the opening
  const d = dirsOf(maskAt(cell, cell.rot))[0];
  if (d !== undefined && hydrated) {
    for (let i = 0; i < 3; i++) {
      const t = (flowPhase * 1.2 + i * .33) % 1;
      const px = cx + DX[d] * s * (.12 + t * .34);
      const py = cy + DY[d] * s * (.12 + t * .34) - Math.sin(t * Math.PI) * s * .05;
      ctx.fillStyle = pc.a; ctx.globalAlpha = .8 * (1 - t);
      ctx.beginPath(); ctx.arc(px, py, s * .022 * (1 - t * .4), 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  // label
  ctx.font = `700 ${Math.round(s * .115)}px "Microsoft YaHei",sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(8,14,26,.82)';
  rr(ctx, cx - s * .16, y + s * .07, s * .32, s * .16, s * .04); ctx.fill();
  ctx.strokeStyle = 'rgba(215,160,90,.5)'; ctx.lineWidth = .7; ctx.stroke();
  ctx.fillStyle = '#f2cf8d'; ctx.fillText('水源', cx, y + s * .152);
  ctx.restore();
}

function drawTarget(cell, x, y, s, flowInfo, index) {
  const cx = x + s / 2, cy = y + s / 2;
  const tgt = flowInfo.targets.find(t => t.i === index);
  const col = tgt ? tgt.color : (cell.color || 'jade');
  const pc = pipeColors(col);
  const wet = !!(tgt && tgt.ok);
  const style = cell.style || (level.targetStyle || 'fountain');
  ctx.save();
  if (style === 'fountain') {
    // basin
    const bx = cx, by = y + s * .74;
    const bg2 = ctx.createLinearGradient(bx, by - s * .12, bx, by + s * .14);
    bg2.addColorStop(0, '#b65745'); bg2.addColorStop(.5, '#8d3333'); bg2.addColorStop(1, '#4c1c20');
    ctx.fillStyle = bg2; ctx.strokeStyle = 'rgba(240,184,94,.62)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.ellipse(bx, by, s * .31, s * .115, 0, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(8,13,24,.75)';
    ctx.beginPath(); ctx.ellipse(bx, by - s * .012, s * .24, s * .072, 0, 0, 7); ctx.fill();
    if (wet) {
      ctx.fillStyle = pc.b; ctx.globalAlpha = .9;
      ctx.beginPath(); ctx.ellipse(bx, by - s * .012, s * .22, s * .06, 0, 0, 7); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = pc.a; ctx.lineWidth = Math.max(1.1, s * .02);
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(bx + i * s * .05, by - s * .03);
        ctx.quadraticCurveTo(bx + i * s * .19, by - s * .20, bx + i * s * .25, by - s * .065);
        ctx.stroke();
      }
      for (let i = 0; i < 4; i++) {
        const ph = (flowPhase * 1.1 + i * .23) % 1;
        ctx.fillStyle = pc.a; ctx.globalAlpha = .75 * (1 - ph);
        ctx.beginPath(); ctx.arc(bx + (i - 1.5) * s * .1, by - s * .03 - ph * s * .22, Math.max(.7, s * .016 * (1 - ph)), 0, 7); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    ctx.font = `700 ${Math.round(s * .105)}px "Microsoft YaHei",sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = wet ? '#ffd9c4' : '#c9a08e';
    ctx.fillText('喷泉', bx, by + s * .19);
  } else {
    // waterwheel
    const wx = x + s * .73, wy = cy;
    const rot = wet ? flowPhase * 1.9 : 0;
    ctx.strokeStyle = 'rgba(215,160,90,.75)'; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.arc(wx, wy, s * .24, 0, 7); ctx.stroke();
    ctx.strokeStyle = 'rgba(120,224,200,.32)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(wx, wy, s * .185, 0, 7); ctx.stroke();
    for (let i = 0; i < 8; i++) {
      const a = rot + i * Math.PI / 4;
      ctx.strokeStyle = i % 2 ? '#c98c4a' : '#8c5229'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(wx + Math.cos(a) * s * .06, wy + Math.sin(a) * s * .06);
      ctx.lineTo(wx + Math.cos(a) * s * .225, wy + Math.sin(a) * s * .225); ctx.stroke();
      ctx.fillStyle = 'rgba(240,184,94,.7)';
      ctx.beginPath(); ctx.arc(wx + Math.cos(a) * s * .24, wy + Math.sin(a) * s * .24, Math.max(.8, s * .012), 0, 7); ctx.fill();
    }
    ctx.fillStyle = '#3a2412'; ctx.strokeStyle = '#f0b85e'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(wx, wy, s * .05, 0, 7); ctx.fill(); ctx.stroke();
    // trough + falling stream
    ctx.fillStyle = 'rgba(215,160,90,.45)';
    ctx.fillRect(wx - s * .08, wy + s * .26, s * .16, s * .06);
    if (wet) {
      ctx.strokeStyle = pc.b; ctx.lineWidth = Math.max(1.2, s * .022);
      ctx.beginPath(); ctx.moveTo(wx - s * .03, wy + s * .20);
      ctx.quadraticCurveTo(wx - s * .10, wy + s * .32, wx - s * .02, wy + s * .39); ctx.stroke();
      for (let i = 0; i < 3; i++) {
        const ph = (flowPhase * 1.3 + i * .3) % 1;
        ctx.fillStyle = pc.a; ctx.globalAlpha = .8 * (1 - ph);
        ctx.beginPath(); ctx.arc(wx - s * .05 + (i - 1) * s * .03, wy + s * .22 + ph * s * .16, Math.max(.7, s * .015 * (1 - ph)), 0, 7); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    ctx.font = `700 ${Math.round(s * .10)}px "Microsoft YaHei",sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = wet ? '#ffd9c4' : '#c9a08e';
    ctx.fillText('水车', x + s * .18, y + s * .20);
  }
  ctx.restore();
}

function drawCellWaterEdge(L, flowInfo, lvl) {
  // small moving droplets along each traversed edge
  const seen = new Set();
  for (const e of flowInfo.edges) {
    const key = Math.min(e.a, e.b) + '|' + Math.max(e.a, e.b) + '|' + e.color;
    if (seen.has(key)) continue;
    seen.add(key);
    const ca = lvl.cells[e.a], cb = lvl.cells[e.b];
    if (!ca || !cb) continue;
    const ax = L.x + ca.c * L.tile + L.tile / 2, ay = L.y + ca.r * L.tile + L.tile / 2;
    const bx = L.x + cb.c * L.tile + L.tile / 2, by = L.y + cb.r * L.tile + L.tile / 2;
    const pc = pipeColors(e.color);
    for (let i = 0; i < 2; i++) {
      const t = (flowPhase * .85 + i * .5 + (e.a * .13 + e.b * .07)) % 1;
      const x = ax + (bx - ax) * t, y = ay + (by - ay) * t;
      ctx.fillStyle = pc.a;
      ctx.globalAlpha = .55 * Math.sin(t * Math.PI);
      ctx.beginPath(); ctx.arc(x, y, Math.max(.8, L.tile * .028), 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

function drawParticles() {
  for (const p of particles) {
    const a = clamp(p.life / p.max, 0, 1);
    if (p.ring) {
      const t = 1 - a;
      ctx.strokeStyle = p.color; ctx.globalAlpha = a * .7; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r0 + (p.r1 - p.r0) * t, 0, 7); ctx.stroke();
    } else {
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (.5 + a * .5), 0, 7); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const f of floats) {
    ctx.globalAlpha = clamp(f.life, 0, 1);
    ctx.font = `700 ${f.size}px "Microsoft YaHei",sans-serif`;
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
}

function drawCursor(L) {
  if (!level) return;
  const ringAt = (r, c, color, pulse) => {
    const x = L.x + c * L.tile, y = L.y + r * L.tile, s = L.tile;
    ctx.save();
    ctx.strokeStyle = color; ctx.lineWidth = 1.6;
    ctx.setLineDash([5, 6]); ctx.lineDashOffset = -flowPhase * 18;
    rr(ctx, x + 3, y + 3, s - 6, s - 6, s * .09); ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = .28 + pulse * .22;
    rr(ctx, x + 1, y + 1, s - 2, s - 2, s * .1);
    ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.stroke();
    ctx.restore();
  };
  if (mode === 'play' && !paused) {
    const pulse = .5 + .5 * Math.sin(flowPhase * 4);
    ringAt(cursor.r, cursor.c, 'rgba(120,224,200,.9)', pulse);
    if (hover && (hover.r !== cursor.r || hover.c !== cursor.c)) ringAt(hover.r, hover.c, 'rgba(215,160,90,.65)', pulse);
  }
}

function renderLevel(lvl, fl, isBackdrop) {
  const L = layout(lvl);
  const t = performance.now() / 1000;
  drawBackground(t);
  const frame = drawBoardFrame(L);
  ctx.save();
  if (!isBackdrop) {
    const shx = shakeT > 0 ? (Math.random() * 2 - 1) * shakeAmp * shakeT * 7 : 0;
    const shy = shakeT > 0 ? (Math.random() * 2 - 1) * shakeAmp * shakeT * 7 : 0;
    ctx.translate(shx, shy);
  }
  // tiles
  const cellByKey = new Map();
  for (const c of lvl.cells) cellByKey.set(keyOf(c.r, c.c), c);
  for (let r = 0; r < lvl.rows; r++) {
    for (let c = 0; c < lvl.cols; c++) {
      const cell = cellByKey.get(keyOf(r, c));
      drawTile(r, c, L.x + c * L.tile, L.y + r * L.tile, L.tile, !!cell);
    }
  }
  // grid hairlines
  ctx.strokeStyle = 'rgba(215,160,90,.06)'; ctx.lineWidth = .7;
  for (let c = 1; c < lvl.cols; c++) {
    ctx.beginPath(); ctx.moveTo(L.x + c * L.tile, L.y); ctx.lineTo(L.x + c * L.tile, L.y + L.rows * L.tile); ctx.stroke();
  }
  for (let r = 1; r < lvl.rows; r++) {
    ctx.beginPath(); ctx.moveTo(L.x, L.y + r * L.tile); ctx.lineTo(L.x + lvl.cols * L.tile, L.y + r * L.tile); ctx.stroke();
  }
  // pipes
  for (let i = 0; i < lvl.cells.length; i++) {
    const cell = lvl.cells[i];
    const x = L.x + cell.c * L.tile, y = L.y + cell.r * L.tile;
    if (cell.t === 'source') drawPipe(cell, x, y, L.tile, fl, i);
    else if (cell.t !== 'target') drawPipe(cell, x, y, L.tile, fl, i);
  }
  // target pipe arm on top of the basin/wheel
  for (let i = 0; i < lvl.cells.length; i++) {
    const cell = lvl.cells[i];
    if (cell.t === 'target') drawPipe(cell, L.x + cell.c * L.tile, L.y + cell.r * L.tile, L.tile, fl, i);
  }
  // overlays
  for (let i = 0; i < lvl.cells.length; i++) {
    const cell = lvl.cells[i];
    const x = L.x + cell.c * L.tile, y = L.y + cell.r * L.tile;
    if (cell.t === 'cross') drawCrossArch(cell, x, y, L.tile);
    if (cell.t === 'valve') drawValve(cell, x, y, L.tile);
    if (cell.t === 'oneway') drawOneWay(cell, x, y, L.tile);
    if (cell.t === 'source') drawSource(cell, x, y, L.tile, fl, i);
    if (cell.t === 'target') drawTarget(cell, x, y, L.tile, fl, i);
  }
  drawCellWaterEdge(L, fl, lvl);
  if (!isBackdrop) drawCursor(L);
  drawParticles();
  if (!isBackdrop && flashT > 0) {
    ctx.fillStyle = `rgba(${flashColor},${flashT * .38})`;
    ctx.fillRect(frame.x - 10, frame.y - 10, frame.w + 20, frame.h + 20);
  }
  ctx.restore();
  if (isBackdrop) {
    ctx.fillStyle = 'rgba(4,8,18,.58)';
    ctx.fillRect(0, 0, W, H);
  }
}

function render() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = '#04070f';
  ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.save();
  ctx.translate(viewOX, viewOY); ctx.scale(viewScale, viewScale);
  if (mode === 'title') {
    if (!backdrop) makeBackdrop();
    renderLevel(backdrop, backdropFlow, true);
  } else if (level) {
    renderLevel(level, flow, false);
  }
  ctx.restore();
}

// ==================== main loop ====================
let last = performance.now(), acc = 0;
function tick(now) {
  requestAnimationFrame(tick);
  let dt = Math.min(.1, (now - last) / 1000); last = now;
  if (document.hidden) return;
  handleKeys();
  acc += dt;
  let n = 0;
  while (acc >= DT && n < 8) { update(DT); acc -= DT; n++; }
  render();
}
requestAnimationFrame(tick);

// ==================== state snapshot ====================
function state() {
  const nan = !level ? false : (
    !Number.isFinite(elapsed) || !Number.isFinite(flowPhase) || !Number.isFinite(used) || !Number.isFinite(movesLeft)
    || level.cells.some(c => !Number.isFinite(c.rot) || !Number.isFinite(c.sol) || !Number.isFinite(c.m0))
  );
  const targets = flow ? flow.targets.map(t => ({ ...t })) : [];
  return {
    mode, paused, noAuto, demoMode, level: levelN,
    levelName: level ? level.name : '', chapter: level ? level.chapter : 1, mech: level ? level.mech : 'basic',
    budget: level ? level.budget : 0, optimal: level ? level.optimal : 0, slack: level ? level.slack : 0, par: level ? level.par : 0,
    used, movesLeft, time: +elapsed.toFixed(3), flowPhase: +flowPhase.toFixed(3),
    flowSolved: !!(flow && flow.solved), targets, mixed: flow ? flow.mixed.size : 0,
    reached: flow ? flow.reached.size : 0, flowColors: flow ? flow.colors.slice() : [],
    cursor: { ...cursor }, cells: level ? level.cells.length : 0,
    starsByLevel: { ...starsByLevel }, bestScores: { ...bestScores }, unlocked, totalStars, totalScore, best,
    lastOutcome: lastOutcome ? { ...lastOutcome } : null,
    nan, muted: audio.isMuted(), audioState: audio.state(), audioCtx: audio.hasCtx(),
    reports: reports.length, net: window.__NET ? { ...window.__NET } : null,
    particles: particles.length, floats: floats.length,
    pausedOverlay: !ui.pause.classList.contains('hidden'),
  };
}

function cellInfo(r, c) {
  if (!level) return null;
  const cell = cellAt(level, r, c);
  if (!cell) return null;
  const i = indexAt(level, r, c);
  const colors = flow && flow.cellColors.get(i);
  const en = cell.t === 'oneway' ? (cell.e0 + cell.rot - cell.sol + 8) & 3 : null;
  const ex = cell.t === 'oneway' ? (cell.x0 + cell.rot - cell.sol + 8) & 3 : null;
  return {
    r, c, t: cell.t, m0: cell.m0, rot: cell.rot, sol: cell.sol,
    onPath: !!cell.onPath, movable: isMovable(cell) && cell.t !== 'cross',
    mask: maskAt(cell, cell.rot), open: cell.t === 'valve' ? cell.rot === cell.sol : undefined,
    enter: en, exit: ex, water: colors ? [...colors] : [], mixed: !!(flow && flow.mixed.has(i)),
  };
}

function levelInfo(n) {
  const src = levelByNumber(n);
  return {
    id: src.id, chapter: src.chapter, name: src.name, subtitle: src.subtitle,
    cols: src.cols, rows: src.rows, mech: src.mech, budget: src.budget, optimal: src.optimal,
    slack: src.slack, par: src.par, targetStyle: src.targetStyle,
    sources: src.sources.map(s => ({ ...s })), targets: src.targets.map(t => ({ ...t })),
    cells: src.cells.map(c => ({ ...c })), mechanisms: countMechanics(src),
  };
}

function auditLevels() {
  return LEVELS.map(src => {
    const can = solveFlow(src, canonicalRotations(src));
    const ini = solveFlow(src, initialRotations(src));
    const opt = optimalMoves(src);
    const mech = countMechanics(src);
    return {
      id: src.id, chapter: src.chapter, cols: src.cols, rows: src.rows,
      pathLen: (src.pathA || []).length + (src.pathB ? src.pathB.length : 0),
      canonicalSolved: can.solved, initialSolved: ini.solved,
      optimal: opt, budget: src.budget, slack: src.budget - opt,
      targetCount: src.targets.length, sourceCount: src.sources.length,
      mechanisms: mech,
      ok: can.solved && !ini.solved && opt <= src.budget && src.sources.length > 0 && src.targets.length > 0,
    };
  });
}

// ==================== G hooks ====================
const G = {
  err: window.__BOOTERR,
  W, H, DT,
  step: (n = 60, dt = DT) => { for (let i = 0; i < n; i++) { handleKeys(); update(dt); render(); } },
  upd: (n = 30, dt = DT) => { for (let i = 0; i < n; i++) { handleKeys(); update(dt); } },
  press: (...codes) => codes.forEach(c => pressed.add(c)),
  setNoAuto: (v) => { noAuto = !!v; },
  setReportTarget: (fn) => { reportTarget = typeof fn === 'function' ? fn : null; },
  state,
  setLevel: (n) => { startLevel(clamp(+n || 1, 1, TOTAL_LEVELS)); return levelN; },
  startLevel: (n) => startLevel(clamp(+n || 1, 1, TOTAL_LEVELS)),
  restartLevel: () => restartLevel(),
  toTitle: () => toTitle(),
  nextLevel: () => nextLevel(),
  rotateCell: (r, c, dir = 1, opts = {}) => rotateCell(r, c, dir, opts),
  setRot: (r, c, q) => {
    const cell = level && cellAt(level, r, c);
    if (!cell) return false;
    cell.rot = ((Math.round(q) % 4) + 4) % 4;
    flow = solveFlow(level);
    updateHUD();
    return true;
  },
  setMoves,
  setCursor: (r, c) => { cursor = { r: clamp(r, 0, level.rows - 1), c: clamp(c, 0, level.cols - 1) }; return { ...cursor }; },
  moveCursor,
  cellInfo,
  cellScreen: (r, c) => {
    if (!level) return null;
    const L = layout();
    return {
      x: viewOX + (L.x + c * L.tile + L.tile / 2) * viewScale,
      y: viewOY + (L.y + r * L.tile + L.tile / 2) * viewScale,
    };
  },
  view: () => {
    const L = level ? layout() : { x: 0, y: 0, tile: 0, cols: 0, rows: 0 };
    return { scale: viewScale, ox: viewOX, oy: viewOY, w: W, h: H, board: { x: L.x, y: L.y, tile: L.tile, cols: L.cols, rows: L.rows } };
  },
  setSolutionState: () => setRotationsForSolution(),
  autoSolve: (opts = {}) => autoSolveCurrent(opts),
  solveAll: () => solveAllLevels(),
  forceWin: () => { const was = mode; if (was !== 'play') { if (mode === 'title') startLevel(levelN); } return winLevel(true); },
  forceFail: (reason) => failLevel(reason || '调试强制失败'),
  forceMovesFail: () => { movesLeft = 0; updateHUD(); return failLevel('步数用尽，水路仍未接通'); },
  computeStars: (n, usedMoves, time) => calcStars(levelByNumber(n), usedMoves, time),
  calcLevelScore: (n, usedMoves, stars, time) => calcLevelScore(levelByNumber(n), usedMoves, stars, time),
  levelInfo,
  levelConfigs: () => LEVELS.map(l => ({
    id: l.id, chapter: l.chapter, name: l.name, cols: l.cols, rows: l.rows, mech: l.mech,
    budget: l.budget, optimal: l.optimal, slack: l.slack, par: l.par,
    pathLen: (l.pathA || []).length + (l.pathB ? l.pathB.length : 0),
    mechanisms: l.mechanisms,
  })),
  solution: (n) => autoSolution(levelByNumber(n || levelN)),
  auditLevels,
  saveAll: () => { for (const l of LEVELS) if (l.id <= TOTAL_LEVELS) {} },
  demo: (frac = .66) => {
    if (!level) return false;
    demoMode = true;
    applyDemo(clamp(+frac || .66, 0, 1));
    return true;
  },
  setPaused,
  togglePause,
  toggleMute,
  setMuted: (v) => { audio.setMuted(v); updateMuteBtn(); return audio.isMuted(); },
  muted: () => audio.isMuted(),
  audio,
  storageSnapshot,
  restoreStorage,
  storageKeys: { ...STORE },
  reports: () => reports.slice(),
  clearReports: () => { reports.length = 0; },
  clearParticles: () => { particles.length = 0; floats.length = 0; },
  flow: (rotations) => solveFlow(level, rotations),
  flowSnapshot: () => flow ? {
    solved: flow.solved, colors: flow.colors.slice(), reached: flow.reached.size,
    mixed: flow.mixed.size, targets: flow.targets.map(t => ({ ...t })),
  } : null,
  mixProbe: () => {
    // A tiny synthetic network: jade source west + azure source east both feed
    // a central tee; the tee must report contamination.
    const cells = [
      { r: 1, c: 0, t: 'source', m0: BIT(1), rot: 0, sol: 0, color: 'jade' },
      { r: 1, c: 2, t: 'source', m0: BIT(3), rot: 0, sol: 0, color: 'azure' },
      { r: 1, c: 1, t: 'tee', m0: BIT(0) | BIT(1) | BIT(2) | BIT(3), rot: 0, sol: 0 },
      { r: 0, c: 1, t: 'target', m0: BIT(2), rot: 0, sol: 0, color: 'jade' },
    ];
    const lv = { cells, sources: [{ r: 1, c: 0, color: 'jade' }, { r: 1, c: 2, color: 'azure' }], targets: [{ r: 0, c: 1, color: 'jade' }] };
    const f = solveFlow(lv);
    return { mixed: f.mixed.size, solved: f.solved, targets: f.targets };
  },
  crossProbe: () => {
    // Cross channels conduct straight only; a north->east turn must fail.
    const cross = { r: 1, c: 1, t: 'cross', m0: ALL, rot: 0, sol: 0 };
    const srcN = { r: 0, c: 1, t: 'source', m0: BIT(2), rot: 0, sol: 0, color: 'jade' };
    const tgtS = { r: 2, c: 1, t: 'target', m0: BIT(0), rot: 0, sol: 0, color: 'jade' };
    const tgtE = { r: 1, c: 2, t: 'target', m0: BIT(3), rot: 0, sol: 0, color: 'jade' };
    const lvS = { cells: [srcN, cross, tgtS], sources: [{ r: 0, c: 1, color: 'jade' }], targets: [{ r: 2, c: 1, color: 'jade' }] };
    const lvE = { cells: [srcN, { ...cross }, tgtE], sources: [{ r: 0, c: 1, color: 'jade' }], targets: [{ r: 1, c: 2, color: 'jade' }] };
    return { straight: solveFlow(lvS).solved, turn: solveFlow(lvE).solved };
  },
  updateHUD, audio, ui, layout,
  setDPR: (v) => { DPR = clamp(v, .5, 2); resize(); },
};
window.G = G; window.__G = G;
window.addEventListener('error', e => { if (G.err && G.err.indexOf(String(e.message || e)) < 0) G.err.push(String(e.message || e)); });

// ==================== demo / screenshot mode ====================
function applyDemo(frac) {
  if (!level) return;
  const paths = [level.pathA, level.pathB].filter(Boolean);
  let applied = 0;
  for (const p of paths) {
    const take = Math.max(0, Math.floor(p.length * frac));
    for (let i = 0; i < take; i++) {
      const [r, c] = p[i];
      const cell = cellAt(level, r, c);
      if (cell && isMovable(cell) && cell.t !== 'cross' && cell.rot !== cell.sol) {
        cell.rot = cell.sol;
        applied++;
      }
    }
  }
  flow = solveFlow(level);
  used = applied;
  movesLeft = Math.max(0, level.budget - applied);
  updateHUD();
}

// ==================== boot ====================
loadLevel(1);
mode = 'title';
makeBackdrop();
buildTitleMap();
updateHUD();

const params = new URLSearchParams(location.search);
if (AUTOTEST) {
  autotest();
} else if (params.has('autostart')) {
  const n = clamp(parseInt(params.get('level') || '1', 10) || 1, 1, TOTAL_LEVELS);
  startLevel(n);
  if (params.has('demo')) { G.demo(parseFloat(params.get('demo')) || .62); }
} else if (params.has('level')) {
  startLevel(clamp(parseInt(params.get('level') || '1', 10) || 1, 1, TOTAL_LEVELS));
} else {
  toTitle();
}

// ==================== autotest suite ====================
async function autotest() {
  G.setNoAuto(true);
  const nap = () => new Promise(r => { const mc = new MessageChannel(); mc.port1.onmessage = () => r(); mc.port2.postMessage(0); });
  const T = window.__TEST = { pass: 0, fail: 0, total: 0, results: [], done: false };
  const ok = (id, cond, name) => {
    T.results.push({ id, ok: !!cond, name: name || '' });
    cond ? T.pass++ : T.fail++;
    T.total++;
    if (!cond) console.log(`[T${id}] FAIL ${name || ''}`);
  };
  const up = (n = 1) => G.upd(n);
  const saved = storageSnapshot();
  audio.setMuted(true);
  updateMuteBtn();
  const frames = [];
  G.setReportTarget(f => frames.push(f));
  await nap();

  try {
    // T1 boot clean
    ok('T1', G.err.length === 0 && (!window.__BOOTERR || window.__BOOTERR.length === 0), `零报错 err=${G.err.length}`);

    // T2 no NaN after a real level and several hundred fixed frames
    G.setLevel(1);
    up(360);
    const s2 = state();
    ok('T2', !s2.nan && Number.isFinite(s2.time) && s2.cells > 0, `360 帧无 NaN cells=${s2.cells}`);

    // T3 rotation math: four quarter turns return the same mask; a one-turn delta differs
    const pick3 = level.cells.find(c => c.onPath && c.t !== 'source' && c.t !== 'target' && c.t !== 'cross' && isMovable(c));
    const c0 = cellInfo(pick3.r, pick3.c);
    const m0 = c0.mask;
    G.setRot(c0.r, c0.c, c0.rot + 1); const m1 = cellInfo(c0.r, c0.c).mask;
    G.setRot(c0.r, c0.c, c0.rot + 2); const m2 = cellInfo(c0.r, c0.c).mask;
    G.setRot(c0.r, c0.c, c0.rot + 3); const m3 = cellInfo(c0.r, c0.c).mask;
    G.setRot(c0.r, c0.c, c0.rot + 4); const m4 = cellInfo(c0.r, c0.c).mask;
    ok('T3', m0 !== m1 && m1 !== m2 && m0 === m4 && m3 !== m0, `掩码 ${m0}→${m1}→${m2}→${m3}→${m4}`);

    // T4 a rotation consumes exactly one move
    G.setLevel(1);
    const before4 = state();
    const first = level.cells.find(c => c.onPath && isMovable(c) && c.t !== 'cross');
    G.rotateCell(first.r, first.c, 1, { silent: true });
    const after4 = state();
    ok('T4', after4.used === before4.used + 1 && after4.movesLeft === before4.movesLeft - 1, `步数 ${before4.movesLeft}→${after4.movesLeft}`);

    // T5 canonical solution really hydrates the target; scrambled start does not
    G.setLevel(1);
    const ini5 = state();
    G.setSolutionState();
    const can5 = state();
    ok('T5', !ini5.flowSolved && can5.flowSolved && can5.targets.every(t => t.ok), `初始=${ini5.flowSolved} 参考=${can5.flowSolved}`);

    // T6 move exhaustion reaches the failure path + gameOver report
    frames.length = 0;
    G.setLevel(2);
    G.setMoves(0);
    const s6 = state();
    ok('T6', s6.mode === 'over' && frames.some(f => f.kind === 'gameOver'), `mode=${s6.mode}`);

    // T7 reference solve reaches victory + complete report
    frames.length = 0;
    G.setLevel(3);
    const won7 = G.autoSolve();
    const s7 = state();
    ok('T7', won7 && s7.mode === 'win' && frames.some(f => f.kind === 'complete'), `mode=${s7.mode} win=${won7}`);
    ok('T7b', s7.lastOutcome && s7.lastOutcome.stars === 3, `stars=${s7.lastOutcome && s7.lastOutcome.stars}`);

    // T8 valve: closing a real gate on the route changes reachability
    G.setLevel(8);
    G.setSolutionState();
    const open8 = G.flowSnapshot();
    let valveBroke = false;
    for (const vc of level.cells.filter(c => c.onPath && c.t === 'valve')) {
      G.setSolutionState();
      G.setRot(vc.r, vc.c, (vc.sol + 1) & 3);
      if (!G.flowSnapshot().solved) valveBroke = true;
    }
    ok('T8', open8.solved && valveBroke, `开=${open8.solved} 任一铜闸关闭后断流=${valveBroke}`);

    // T9 one-way: reverse rotation breaks the authored route
    G.setLevel(14);
    G.setSolutionState();
    const open9 = G.flowSnapshot();
    let owBroke = false;
    for (const oc of level.cells.filter(c => c.onPath && c.t === 'oneway')) {
      G.setSolutionState();
      G.setRot(oc.r, oc.c, (oc.sol + 2) & 3);
      if (!G.flowSnapshot().solved) owBroke = true;
    }
    ok('T9', open9.solved && owBroke, `顺流=${open9.solved} 任一单向阀反向断流=${owBroke}`);

    // T10 cross channels pass straight but not turns
    const cp = G.crossProbe();
    ok('T10', cp.straight === true && cp.turn === false, `直通=${cp.straight} 转弯=${cp.turn}`);

    // T11 two-colour networks + contamination probe
    G.setLevel(19);
    G.setSolutionState();
    const f11 = G.flowSnapshot();
    const mp = G.mixProbe();
    ok('T11', f11.solved && f11.colors.length === 2 && f11.targets.length === 2 && f11.targets.every(t => t.ok), `双色=${f11.colors.join('+')} targets=${f11.targets.length}`);
    ok('T11b', mp.mixed > 0, `混流格=${mp.mixed}`);

    // T12 economic scoring + star thresholds
    const sc = G.calcLevelScore(1, 0, 3, 0);
    const sc2 = G.calcLevelScore(1, 6, 1, 999);
    ok('T12', Number.isInteger(sc) && sc > sc2 && sc2 >= 0, `满分=${sc} 低分=${sc2}`);
    const st3 = G.computeStars(1, 1, 0), st2 = G.computeStars(1, 1 + 6, 0), st1 = G.computeStars(1, 999, 9999);
    ok('T12b', st3 === 3 && st2 === 2 && st1 === 1, `星 ${st3}/${st2}/${st1}`);

    // T13 progress write: stars, score, best, unlock
    const pre13 = storageSnapshot();
    G.setLevel(1); G.forceWin();
    let savedStars = {}, savedUnlock = 0, savedBest = 0, savedScores = {};
    try {
      savedStars = JSON.parse(localStorage.getItem(STORE.stars) || '{}');
      savedScores = JSON.parse(localStorage.getItem(STORE.scores) || '{}');
      savedUnlock = parseInt(localStorage.getItem(STORE.unlocked) || '0', 10);
      savedBest = parseInt(localStorage.getItem(STORE.best) || '0', 10);
    } catch (e) { }
    ok('T13', (savedStars['1'] || 0) >= 1 && (savedScores['1'] || 0) > 0 && savedUnlock >= 2 && savedBest > 0,
      `star1=${savedStars['1']} score1=${savedScores['1']} unlock=${savedUnlock} best=${savedBest}`);
    G.restoreStorage(pre13);

    // T14 localStorage read/write/restore round-trip
    const snap14 = storageSnapshot();
    try { localStorage.setItem(STORE.best, '137'); } catch (e) { }
    const read14 = parseInt(localStorage.getItem(STORE.best) || '0', 10);
    G.restoreStorage(snap14);
    ok('T14', read14 === 137, `best 回读=${read14}`);

    // T15 keyboard input simulation: Space rotates the cursor piece and spends a move
    G.setLevel(1);
    const mv = level.cells.find(c => c.onPath && isMovable(c) && c.t !== 'cross');
    G.setCursor(mv.r, mv.c);
    const b15 = state();
    const r15 = cellInfo(mv.r, mv.c).rot;
    G.press('Space'); up(1);
    const a15 = state();
    ok('T15', a15.used === b15.used + 1 && a15.movesLeft === b15.movesLeft - 1 && cellInfo(mv.r, mv.c).rot !== r15,
      `used ${b15.used}→${a15.used} rot ${r15}→${cellInfo(mv.r, mv.c).rot}`);
    const cur15 = { ...state().cursor };
    G.press('ArrowRight'); up(1);
    ok('T15b', state().cursor.c !== cur15.c || state().cursor.r !== cur15.r, '方向键移动光标');

    // T16 pause freezes elapsed, flow phase and moves
    G.setLevel(1);
    G.press('KeyP'); up(1);
    const p16 = state();
    up(60);
    const p16b = state();
    ok('T16', p16.paused && p16b.time === p16.time && p16b.flowPhase === p16.flowPhase && p16b.used === p16.used,
      `paused=${p16.paused} time ${p16.time}→${p16b.time}`);
    G.press('KeyP'); up(1);
    ok('T16b', !state().paused, '恢复运行');

    // T17 touch / pointer binding rotates a tile
    G.setLevel(1);
    const tp = level.cells.find(c => c.onPath && isMovable(c) && c.t !== 'cross');
    const scr = G.cellScreen(tp.r, tp.c);
    const b17 = state();
    const r17 = cellInfo(tp.r, tp.c).rot;
    cv.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch', clientX: scr.x, clientY: scr.y, pointerId: 9, isPrimary: true }));
    up(1);
    const a17 = state();
    ok('T17', a17.used === b17.used + 1 && cellInfo(tp.r, tp.c).rot !== r17,
      `触控 used ${b17.used}→${a17.used} rot ${r17}→${cellInfo(tp.r, tp.c).rot}`);

    // T18 R restarts: budget and rotations reset
    G.setLevel(1);
    const first18 = level.cells.find(c => c.onPath && isMovable(c) && c.t !== 'cross');
    const initRot18 = first18.rot;
    G.rotateCell(first18.r, first18.c, 1, { silent: true });
    up(2);
    G.press('KeyR'); up(1);
    const s18 = state();
    ok('T18', s18.mode === 'play' && s18.used === 0 && s18.movesLeft === s18.budget && cellInfo(first18.r, first18.c).rot === initRot18,
      `used=${s18.used} left=${s18.movesLeft} rot=${cellInfo(first18.r, first18.c).rot}`);

    // T19 level advancement after a win
    G.setLevel(1); G.forceWin();
    const nextAvail = state().unlocked;
    G.nextLevel();
    ok('T19', nextAvail >= 2 && state().level === 2 && state().mode === 'play', `unlock=${nextAvail} level=${state().level}`);

    // T20 report frame order: ready first, progress before complete
    frames.length = 0;
    G.setLevel(4);
    G.autoSolve();
    const kinds = frames.map(f => f.kind);
    ok('T20', reports[0] && reports[0].kind === 'ready' && kinds.indexOf('progress') >= 0 && kinds.indexOf('complete') > kinds.indexOf('progress'),
      `本地首帧=${reports[0] && reports[0].kind} 本次=${kinds.join('→')}`);

    // T21 all 24 authored levels: audit + real reference solve
    const audit = G.auditLevels();
    const badAudit = audit.filter(a => !a.ok);
    ok('T21', audit.length === TOTAL_LEVELS && badAudit.length === 0, `审计 ${audit.length - badAudit.length}/${audit.length}`);
    const all = G.solveAll();
    ok('T21b', all.allWin && !all.nan && all.failures.length === 0, `24 关实解 ${all.allWin ? '全部通关' : '失败 ' + all.failures.join(',')}`);
    ok('T21c', all.levels.every(l => l.stars === 3), '24 关参考解均 3 星');

    // T22 every level has target(s), source(s), a path and a budget ≥ optimal
    const cfg = G.levelConfigs();
    ok('T22', cfg.length === 24 && cfg.every(c => c.pathLen >= c.cols && c.budget >= c.optimal && c.optimal >= 1),
      `24 关 path/budget 合法`);
    const mechOk = audit.some(a => a.mechanisms.valve > 0) && audit.some(a => a.mechanisms.oneway > 0)
      && audit.some(a => a.chapter === 4 && a.sourceCount >= 2);
    ok('T22b', mechOk, '铜闸/单向阀/双色水均有真实关卡');

    // T23 fast-forward after victory: no NaN, no new boot errors
    const errBefore = G.err.length;
    G.setLevel(12);
    G.autoSolve();
    up(600);
    G.step(30);
    const s23 = state();
    ok('T23', !s23.nan && G.err.length === errBefore && s23.mode === 'win', `mode=${s23.mode} nan=${s23.nan} err=${G.err.length}`);

    // T24 DEMO mode hydrates part of the route without ending the level
    G.setLevel(18);
    G.demo(.6);
    const s24 = state();
    ok('T24', s24.demoMode && s24.mode === 'play' && s24.reached > 2, `demo reached=${s24.reached} mode=${s24.mode}`);

    // T25 UI structure / Chinese series mark / 24 level buttons
    const lvBtns = document.querySelectorAll('#chaptermap .lv');
    const titleText = document.querySelector('#title') ? document.querySelector('#title').textContent : '';
    ok('T25', lvBtns.length === 24 && titleText.includes('灯匠夜游 · 第 8 铺') && !!ui.endNext && !!ui.endRetry && !!ui.endHome,
      `关卡按钮 ${lvBtns.length} 个，结算三键齐全`);

    // T26 audio mute + state switching
    G.setMuted(true);
    const muted26 = state().muted;
    audio.setState('win'); const a26 = state().audioState;
    audio.setState('play');
    ok('T26', muted26 === true && a26 === 'win' && state().audioState === 'play', `静音=${muted26} 状态=${a26}`);

    // T27 DOM pause button binding
    G.setLevel(1);
    ui.pauseBtn.click();
    const paused27 = state().paused;
    ui.pauseBtn.click();
    ok('T27', paused27 === true && state().paused === false && !state().pausedOverlay, '暂停按钮可切换');

    // T28 no external network / no fetch traffic
    const net = window.__NET || { fetch: 0, xhr: 0, ws: 0, external: [] };
    ok('T28', net.fetch + net.xhr + net.ws === 0 && net.external.length === 0, `外网请求 ${net.external.length}`);

    // T29 back to title, muted, clean state
    G.setMuted(true);
    G.toTitle();
    const s29 = state();
    ok('T29', s29.mode === 'title' && !ui.title.classList.contains('hidden') && ui.hud.classList.contains('hidden') && s29.muted && !s29.nan,
      '测完静音回标题');

    // T30 restore the player's original localStorage values, then keep the
    // autotest page itself silent without writing the mute key again.
    G.restoreStorage(saved);
    audio.setMutedSilent(true);
    updateMuteBtn();
    let restored = true;
    for (const k of Object.values(G.storageKeys)) {
      const a = saved[k] == null ? null : saved[k];
      const b = localStorage.getItem(k);
      if (a !== b) restored = false;
    }
    ok('T30', restored, 'localStorage 原值还原');

    T.done = true;
    T.total = T.results.length;
    T.pass = T.results.filter(r => r.ok).length;
    T.fail = T.results.filter(r => !r.ok).length;
    console.log(`[aqua-conduit autotest] ${T.pass}/${T.total} passed`);
  } catch (err) {
    T.crash = String(err && err.stack || err);
    T.results.push({ id: 'CRASH', ok: false, name: T.crash });
    T.total = T.results.length; T.pass = T.results.filter(r => r.ok).length; T.fail = T.results.length - T.pass;
    T.done = true;
    try { G.restoreStorage(saved); audio.setMutedSilent(true); G.toTitle(); } catch (e) { }
    console.log('[aqua-conduit autotest] crashed:', T.crash);
  } finally {
    try { G.restoreStorage(saved); } catch (e) { }
    try { audio.setMutedSilent(true); } catch (e) { }
    try { updateMuteBtn(); } catch (e) { }
  }
}
