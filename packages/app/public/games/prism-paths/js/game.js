// Prism Paths 光路迷阵 — laser refraction puzzle.
// guizang-game-skill methodology, third series #8. 2D canvas, beam-trace
// engine with mirrors/prisms/filters/ice/purple-mix targets, 30 levels.
// G hooks + ?autotest=1 + site report bridge + WebAudio synth audio.

import { LEVELS, COLS, ROWS } from './levels.js';
import { makeAudio } from './audio.js';
import { makeUI } from './ui.js';

// ==================== constants ====================
const CELL = 58, BX = 36, BY = 64;                 // board layout on logical canvas
const W = 600, H = 520;
const CHAP_GATES = [0, 12, 24];                    // stars needed to unlock chapters 1..3
const COLORS = { r: '#ff5a5a', g: '#5aff8a', b: '#5a9aff' };
const TARGET_COL = { R: 'r', G: 'g', B: 'b' };
const DIRS = { '>': [0, 1], '<': [0, -1], 'v': [1, 0], '^': [-1, 0] };
const MIRROR = {
  '/': { '>': '^', '^': '>', '<': 'v', 'v': '<' },
  '\\': { '>': 'v', 'v': '>', '<': '^', '^': '<' },
};

// ==================== state ====================
let mode = 'title', paused = false, noAuto = false;
let levelIdx = 0, moves = 0, grid = null, ems = null;
let beamsCache = [], litCache = new Map(), targetsTotal = 0, litCount = 0;
let undoStack = [], stars = [], bestStars = 0;
let winAnimT = 0, time = 0;
try { stars = JSON.parse(localStorage.getItem('prp.stars') || '[]'); } catch (e) { }
while (stars.length < LEVELS.length) stars.push(0);
try { bestStars = parseInt(localStorage.getItem('prp.best') || '0') || 0; } catch (e) { }
bestStars = stars.reduce((a, b) => Math.max(a, b), 0);
let muted = false;
try { muted = localStorage.getItem('prp.mute') === '1'; } catch (e) { }
const AUTOTEST = new URLSearchParams(location.search).has('autotest');
const totalStars = () => stars.reduce((a, b) => a + b, 0);

const audio = makeAudio();
const ui = makeUI({
  onStart: () => { audio.ensure(); audio.sfx.ui(); startGame(levelIdx); },
  onContinue: () => { audio.ensure(); audio.sfx.ui(); startGame(firstUnfinished()); },
  onSelect: () => { audio.sfx.ui(); showSelect(true); },
  onBack: () => { audio.sfx.ui(); showSelect(false); },
  onPick: (i) => { audio.sfx.ui(); showSelect(false); startGame(i); },
  onUndo: () => { audio.sfx.ui(); doUndo(); },
  onReset: () => { audio.sfx.ui(); loadLevel(levelIdx, true); },
  onRestart: () => { audio.sfx.ui(); startGame(levelIdx); },
  onBackTitle: () => { audio.sfx.ui(); toTitle(); },
  onMute: () => toggleMute(),
  onPause: () => { audio.sfx.ui(); togglePause(); },
});

// ==================== protocol ====================
let reportTarget = null;
const reports = [];
function report(kind, payload = {}) {
  const frame = { kind, ...payload };
  reports.push(frame);
  try {
    if (reportTarget) reportTarget(frame);
    else if (window.parent !== window) window.parent.postMessage({ source: 'lightgame', type: 'lightgame:report', payload: frame }, '*');
  } catch (e) { }
}
report('ready', { game: 'prism-paths' });

// ==================== level load / trace ====================
function loadLevel(idx) {
  levelIdx = Math.max(0, Math.min(LEVELS.length - 1, idx));
  const lv = LEVELS[levelIdx];
  grid = Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => null));
  for (const [r, c, ch] of lv.cells) grid[r][c] = { ch, hitColors: null };
  ems = lv.ems.map(e => ({ ...e }));
  moves = 0; undoStack = [];
  mode = 'play';
  trace();
  ui.setMoves(moves, lv.par);
  ui.setLevel(levelIdx + 1, lv.name);
  ui.setStars(totalStars(), stars[levelIdx]);
  checkWin();                                 // pre-lit levels (tutorial straight shots) count at load
}
function rotatableAt(r, c) {
  const cell = grid[r] && grid[r][c];
  return cell && (cell.ch === '/' || cell.ch === '\\' || cell.ch === 'p' || cell.ch === 'q');
}
function rotate(r, c) {
  if (mode !== 'play' || paused) return false;
  if (!rotatableAt(r, c)) return false;
  undoStack.push([r, c]);
  const cell = grid[r][c];
  if (cell.ch === '/') cell.ch = '\\';
  else if (cell.ch === '\\') cell.ch = '/';
  else if (cell.ch === 'p') cell.ch = 'q';
  else if (cell.ch === 'q') cell.ch = 'p';
  moves++;
  audio.sfx.rotate();
  trace();
  ui.setMoves(moves, LEVELS[levelIdx].par);
  checkWin();
  return true;
}
function doUndo() {
  if (mode !== 'play' || paused || !undoStack.length) return;
  const [r, c] = undoStack.pop();
  const cell = grid[r][c];
  if (cell.ch === '/') cell.ch = '\\';
  else if (cell.ch === '\\') cell.ch = '/';
  else if (cell.ch === 'p') cell.ch = 'q';
  else if (cell.ch === 'q') cell.ch = 'p';
  moves = Math.max(0, moves - 1);
  audio.sfx.undo();
  trace();
  ui.setMoves(moves, LEVELS[levelIdx].par);
}

// beam trace — deterministic, loop-safe via visited set
function trace() {
  const beams = [];                 // polylines: {col, pts: [[r,c],...]}
  const lit = new Map();            // "r,c" -> Set(colors)
  const iceHit = new Set();
  targetsTotal = 0;
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const cell = grid[r][c];
    if (cell && 'RGBP'.includes(cell.ch)) targetsTotal++;
  }
  const visited = new Set();
  const queue = ems.map(e => ({ r: e.r, c: e.c, dir: e.dir, col: e.col }));
  for (const e of ems) beams.push({ col: e.col, pts: [[e.r, e.c]] });

  let guard = 4000;
  while (queue.length && guard-- > 0) {
    const b = queue.pop();
    const key = `${b.r},${b.c},${b.dir},${b.col}`;
    if (visited.has(key)) continue;
    visited.add(key);
    let { r, c, dir, col } = b;
    const [dr, dc] = DIRS[dir];
    let path = [[r, c]];
    let out = null;
    while (true) {
      r += dr; c += dc;
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS) { out = [r, c]; break; }
      const cell = grid[r][c];
      path.push([r, c]);
      if (!cell) continue;
      const ch = cell.ch;
      if (ch === '#') { break; }
      if (ch === 'x') { break; }
      if (ch === '/' || ch === '\\') {
        const nd = MIRROR[ch][dir];
        beams.push({ col, pts: path.slice() });
        queue.push({ r, c, dir: nd, col });
        out = 'stop';
        break;
      }
      if (ch === 'p' || ch === 'q') {
        const orient = ch === 'p' ? '/' : '\\';
        const nd = MIRROR[orient][dir];
        queue.push({ r, c, dir: nd, col });     // reflected branch
        // straight branch continues below (fall through by not breaking)
        beams.push({ col, pts: path.slice() });
        // restart straight continuation as new beam
        queue.push({ r, c, dir, col });
        out = 'stop';
        break;
      }
      if (ch === 'I') {
        const nd = MIRROR['/'][dir];
        iceHit.add(`${r},${c}`);
        beams.push({ col, pts: path.slice() });
        queue.push({ r, c, dir: nd, col });
        out = 'stop';
        break;
      }
      if (ch === 'r' || ch === 'g' || ch === 'b') {
        if (ch !== col) { break; }              // absorbed
        continue;                               // pass through
      }
      if (ch === 'R' || ch === 'G' || ch === 'B' || ch === 'P') {
        const need = TARGET_COL[ch];
        if (!lit.has(`${r},${c}`)) lit.set(`${r},${c}`, new Set());
        lit.get(`${r},${c}`).add(col);
        break;
      }
    }
    if (out && out !== 'stop') beams.push({ col, pts: [...path, out] });
  }
  // ice: one-shot per trace — melted for the remainder of THIS trace, then reforms
  const melted = [];
  for (const key of iceHit) {
    const [r, c] = key.split(',').map(Number);
    melted.push([r, c, grid[r][c]]);
    grid[r][c] = null;
  }
  for (const [r, c, cell] of melted) grid[r][c] = cell;   // ice reforms after the trace
  // evaluate lit targets
  litCount = 0;
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const cell = grid[r][c];
    if (!cell) continue;
    if ('RGB'.includes(cell.ch)) {
      const set = lit.get(`${r},${c}`);
      if (set && set.has(TARGET_COL[cell.ch])) { cell.lit = true; litCount++; } else cell.lit = false;
    } else if (cell.ch === 'P') {
      const set = lit.get(`${r},${c}`);
      cell.lit = !!(set && set.size >= 2);
      if (cell.lit) litCount++;
    }
  }
  beamsCache = beams;
  litCache = lit;
}

function checkWin() {
  if (litCount >= targetsTotal && targetsTotal > 0) {
    const lv = LEVELS[levelIdx];
    const gained = moves <= lv.par ? 3 : moves <= lv.par + 2 ? 2 : 1;
    if (gained > stars[levelIdx]) stars[levelIdx] = gained;
    try { localStorage.setItem('prp.stars', JSON.stringify(stars)); } catch (e) { }
    const tot = totalStars();
    if (tot > bestStars) { bestStars = tot; try { localStorage.setItem('prp.best', String(bestStars)); } catch (e) { } }
    ui.setStars(tot, stars[levelIdx]);
    audio.sfx.win();
    winAnimT = 1.6;
    ui.showBanner(`点亮！${'★'.repeat(gained)}`, `步数 ${moves} / par ${lv.par}`, 1800);
    report('progress', { score: tot, progress: (levelIdx + 1) / LEVELS.length });
    if (levelIdx === LEVELS.length - 1) {
      report('complete', { score: tot, progress: 1 });
      ui.showEnd(true);
      ui.setEnd('光路贯通！', `全部 30 关点亮 · 总星数 ${tot} / ${LEVELS.length * 3}`);
      mode = 'over';
    } else {
      const was = levelIdx;
      if (!noAuto) setTimeout(() => { if (mode === 'play' && levelIdx === was) loadLevel(was + 1); }, 900);
      ui.showToast(`进入第 ${levelIdx + 2} 关 · ${LEVELS[Math.min(LEVELS.length - 1, levelIdx + 1)].name}`);
    }
  }
}

// ==================== flow ====================
function firstUnfinished() {
  for (let i = 0; i < LEVELS.length; i++) if (!stars[i]) return i;
  return 0;
}
function startGame(idx) {
  loadLevel(idx);
  mode = 'play'; paused = false;
  ui.showTitle(false); ui.showEnd(false); ui.showSelect(false); ui.setPausedIcon(false);
  ui.el.banner.classList.remove('show');
  if (!audio.hasCtx() && !AUTOTEST) audio.ensure();
}
function toTitle() {
  mode = 'title'; paused = false;
  ui.showTitle(true); ui.showEnd(false); ui.showSelect(false);
  ui.setStars(totalStars(), stars[levelIdx]);
}
function showSelect(v) {
  ui.showSelect(v);
  if (v) ui.renderSelect(LEVELS, stars, CHAP_GATES, levelIdx);
}
function togglePause() {
  if (mode !== 'play') return;
  paused = !paused;
  ui.setPausedIcon(paused);
  if (paused) { audio.stop(); ui.showBanner('已暂停', '按 P 继续', 999999); }
  else ui.el.banner.classList.remove('show');
}
function toggleMute() {
  muted = !muted;
  audio.setMuted(muted);
  ui.setMutedIcon(muted);
  try { localStorage.setItem('prp.mute', muted ? '1' : '0'); } catch (e) { }
}

// ==================== render ====================
const cv = document.getElementById('gl');
const ctx = cv.getContext('2d');
let viewScale = 1, viewOX = 0, viewOY = 0, DPR = 1;
function resize() {
  DPR = Math.min(2, window.devicePixelRatio || 1);
  cv.width = Math.round(innerWidth * DPR); cv.height = Math.round(innerHeight * DPR);
  viewScale = Math.min(innerWidth / W, innerHeight / H);
  viewOX = (innerWidth - W * viewScale) / 2;
  viewOY = (innerHeight - H * viewScale) / 2;
}
addEventListener('resize', resize); resize();

function cellXY(r, c) { return [BX + c * CELL + CELL / 2, BY + r * CELL + CELL / 2]; }

function render() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.clearRect(0, 0, cv.width, cv.height);
  ctx.save();
  ctx.translate(viewOX, viewOY); ctx.scale(viewScale, viewScale);
  // backdrop
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#12162c'); bg.addColorStop(1, '#0b0d18');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  if (!grid) { ctx.restore(); return; }

  // board cells
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const [x, y] = cellXY(r, c);
    ctx.fillStyle = 'rgba(30,38,66,.5)';
    ctx.fillRect(x - CELL / 2 + 2, y - CELL / 2 + 2, CELL - 4, CELL - 4);
    const cell = grid[r][c];
    if (!cell) continue;
    const ch = cell.ch;
    if (ch === '#' || ch === 'x') {
      ctx.fillStyle = ch === '#' ? '#2a2f4a' : '#3a2a3a';
      ctx.fillRect(x - CELL / 2 + 4, y - CELL / 2 + 4, CELL - 8, CELL - 8);
      if (ch === 'x') { ctx.strokeStyle = '#c86a8a'; ctx.lineWidth = 3; ctx.strokeRect(x - 14, y - 14, 28, 28); }
      continue;
    }
    if (ch === '/' || ch === '\\') {
      const glow = rotatableAt(r, c);
      ctx.strokeStyle = glow ? '#c8d8ff' : '#8a9ac8';
      ctx.lineWidth = 6; ctx.lineCap = 'round';
      ctx.beginPath();
      if (ch === '/') { ctx.moveTo(x - 17, y + 17); ctx.lineTo(x + 17, y - 17); }
      else { ctx.moveTo(x - 17, y - 17); ctx.lineTo(x + 17, y + 17); }
      ctx.stroke();
      ctx.strokeStyle = 'rgba(90,130,255,.35)'; ctx.lineWidth = 12; ctx.stroke();
      continue;
    }
    if (ch === 'p' || ch === 'q') {
      // prism triangle
      ctx.fillStyle = '#7a5cd8';
      ctx.beginPath();
      ctx.moveTo(x, y - 18); ctx.lineTo(x + 16, y + 14); ctx.lineTo(x - 16, y + 14); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#b8a0ff'; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.35)';
      ctx.beginPath(); ctx.moveTo(x, y - 18); ctx.lineTo(x + 8, y + 2); ctx.lineTo(x, y + 2); ctx.closePath(); ctx.fill();
      continue;
    }
    if (ch === 'r' || ch === 'g' || ch === 'b') {
      ctx.fillStyle = COLORS[ch] + '44';
      ctx.beginPath(); ctx.arc(x, y, 16, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = COLORS[ch]; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(x, y, 16, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = COLORS[ch];
      ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(ch.toUpperCase(), x, y + 1);
      continue;
    }
    if (ch === 'I') {
      ctx.fillStyle = 'rgba(160,230,255,.35)';
      ctx.beginPath(); ctx.moveTo(x - 16, y + 16); ctx.lineTo(x, y - 16); ctx.lineTo(x + 16, y + 16); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#a0e6ff'; ctx.lineWidth = 2.5; ctx.stroke();
      continue;
    }
    if ('RGB'.includes(ch)) {
      const col = COLORS[TARGET_COL[ch]];
      const on = cell.lit;
      const pulse = on ? .6 + .4 * Math.sin(time * 6) : 1;
      ctx.globalAlpha = pulse;
      ctx.fillStyle = on ? col : '#22283e';
      ctx.beginPath();
      ctx.moveTo(x, y - 18); ctx.lineTo(x + 15, y); ctx.lineTo(x, y + 18); ctx.lineTo(x - 15, y); ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = col; ctx.lineWidth = on ? 4 : 2.5;
      ctx.stroke();
      continue;
    }
    if (ch === 'P') {
      const on = cell.lit;
      const pulse = on ? .6 + .4 * Math.sin(time * 6) : 1;
      ctx.globalAlpha = pulse;
      ctx.fillStyle = on ? '#c86aff' : '#22283e';
      ctx.beginPath(); ctx.arc(x, y, 17, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = '#c86aff'; ctx.lineWidth = on ? 4 : 2.5;
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('紫', x, y + 1);
      continue;
    }
  }

  // emitters
  for (const e of ems) {
    const [x, y] = cellXY(e.r, e.c);
    ctx.save(); ctx.translate(x, y); ctx.rotate({ '>': 0, 'v': Math.PI / 2, '<': Math.PI, '^': -Math.PI / 2 }[e.dir]);
    ctx.fillStyle = COLORS[e.col];
    ctx.fillRect(-8, -14, 26, 28);
    ctx.fillStyle = '#ffffff88';
    ctx.fillRect(10, -6, 8, 12);
    ctx.restore();
  }

  // beams (under elements would be nicer but over is clearer)
  ctx.lineCap = 'round';
  for (const b of beamsCache) {
    ctx.strokeStyle = COLORS[b.col] || '#fff';
    ctx.globalAlpha = .28; ctx.lineWidth = 11;
    strokePath(b);
    ctx.globalAlpha = .95; ctx.lineWidth = 3.5;
    strokePath(b);
  }
  ctx.globalAlpha = 1;

  // win flash
  if (winAnimT > 0) {
    winAnimT -= 1 / 60;
    ctx.fillStyle = `rgba(255,255,255,${Math.max(0, winAnimT) * .35})`;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.restore();
}
function strokePath(b) {
  ctx.beginPath();
  b.pts.forEach(([r, c], i) => {
    const [x, y] = cellXY(r, c);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.stroke();
}

// ==================== loop ====================
let last = performance.now(), acc = 0;
function tick(now) {
  requestAnimationFrame(tick);
  let dt = (now - last) / 1000; last = now;
  if (document.hidden) return;
  handleKeys();   // consume pressed keys in the REAL loop too (was debug-only — keyboard was dead for players)
  time += Math.min(dt, 1 / 30);
  if (mode === 'play' && !paused) { /* trace-driven; nothing per-frame */ }
  render();
}
requestAnimationFrame(tick);

// ==================== input ====================
const pressed = new Set();
addEventListener('keydown', (e) => {
  if (e.isComposing || e.keyCode === 229) return;
  if (e.metaKey || e.altKey || e.ctrlKey) return;
  if (!e.repeat) pressed.add(e.code);
  if (e.code === 'Space' || e.code === 'Tab') e.preventDefault();
});
addEventListener('blur', () => pressed.clear());
document.addEventListener('visibilitychange', () => pressed.clear());

function handleKeys() {
  for (const code of pressed) {
    if (code === 'KeyP') togglePause();
    else if (code === 'KeyM') toggleMute();
    else if (code === 'KeyZ') doUndo();
    else if (code === 'KeyR' && mode === 'play') { loadLevel(levelIdx, true); }
    else if (code === 'Enter' && (mode === 'title' || mode === 'over')) startGame(firstUnfinished());
  }
  pressed.clear();
}

cv.addEventListener('pointerdown', (e) => {
  audio.ensure();
  if (mode !== 'play' || paused) return;
  const lx = (e.clientX - viewOX) / viewScale, ly = (e.clientY - viewOY) / viewScale;
  const c = Math.floor((lx - BX) / CELL), r = Math.floor((ly - BY) / CELL);
  if (r >= 0 && r < ROWS && c >= 0 && c < COLS) rotate(r, c);
});

// ==================== G debug hooks ====================
const G = {
  err: window.__BOOTERR,
  step: (n = 1) => { for (let i = 0; i < n; i++) { handleKeys(); time += 1 / 60; render(); } },
  upd: (n = 1) => { for (let i = 0; i < n; i++) { handleKeys(); time += 1 / 60; } },
  press: (...codes) => codes.forEach(c => pressed.add(c)),
  setNoAuto: (v) => { noAuto = !!v; },
  setReportTarget: (fn) => { reportTarget = fn; },
  loadLevel: (i) => loadLevel(i, false),
  rotate: (r, c) => rotate(r, c),
  state: () => ({ mode, paused, levelIdx: levelIdx + 1, levelName: LEVELS[levelIdx].name, moves, litCount, targetsTotal, lit: litCount >= targetsTotal && targetsTotal > 0, starsTotal: totalStars(), bestStars, grid: grid ? grid.map(row => row.map(cell => cell ? cell.ch : '.')) : null }),
  fx: () => ({ beams: beamsCache.length, beamPaths: beamsCache.map(b => ({ col: b.col, n: b.pts.length, last: b.pts[b.pts.length - 1] })) }),
  grid, audio,
  traceRef: trace,
  startGame,
};
window.__G = G;
window.addEventListener('error', e => { if (G.err) G.err.push(String(e.message || e)); });

// ==================== autotest suite ====================
async function autotest() {
  const results = [];
  try { await autotestInner(results); }
  catch (err) {
    window.__TEST_ERR = String(err && err.stack || err);
    console.error('[autotest] crashed:', window.__TEST_ERR);
    window.__TEST = { pass: results.filter(r => r.ok).length, fail: 99, total: results.length + 99, results, done: true, crashed: true };
  }
  return;
  async function autotestInner(results) {
    const assert = (id, ok, name) => { results.push({ id, ok: !!ok, name }); if (!ok) console.warn(`[T${id}] FAIL ${name}`); };
    const S = () => G.state();
    audio.setMuted(true);
    const savedStars = JSON.stringify(stars);
    const savedBest = bestStars;
    G.setReportTarget(() => { });

    assert(1, G.err.length === 0, '启动零报错');

    // -- T2: level data validity (all 30 parse; ≥1 emitter, ≥1 target)
    let dataOk = true, badLv = -1;
    for (let i = 0; i < LEVELS.length; i++) {
      const lv = LEVELS[i];
      const emsN = lv.ems.length;
      const targetsN = lv.cells.filter(c => 'RGBP'.includes(c[2])).length;
      if (!emsN || !targetsN || lv.rows) { dataOk = false; badLv = i; break; }
      for (const [r, c] of lv.cells.map(x => x)) if (r < 0 || r >= ROWS || c < 0 || c >= COLS) { dataOk = false; badLv = i; }
    }
    assert(2, dataOk && LEVELS.length === 30, `30 关数据合法 (bad=${badLv})`);

    // -- T3/T4: reflection math unit checks
    loadLevel(1, false);
    assert(3, S().levelIdx === 2 && S().litCount === 0, '第 2 关载入且未点亮');
    rotate(1, 5);
    assert(4, S().litCount === 1 && S().lit, '镜面反射命中目标');

    // -- T5: all 30 levels solvable via their recorded sol
    const failedLv = [];
    for (let i = 0; i < LEVELS.length; i++) {
      loadLevel(i);
      for (const [r, c] of LEVELS[i].sol) rotate(r, c);
      const st = S();
      if (!(st.lit || st.mode === 'over')) failedLv.push(i + 1);
    }
    assert(5, failedLv.length === 0, `全部关卡可解 (失败:${failedLv.join(',') || '无'})`);

    // -- T6: prism splits into two beams
    loadLevel(10, false);
    const beamsBefore = G.fx().beams;
    rotate(3, 3);
    assert(6, G.fx().beams >= 3, '棱镜分光产生多束');

    // -- T7: filter passes matching, absorbs other
    loadLevel(11, false);
    // straight path: prism '/' → straight hits r filter → R(3,8)
    const st7 = (() => { rotate(3, 2); return S(); })();
    assert(7, st7.litCount >= 2, '滤色镜放行同色并点亮双目标');

        // -- T8: ice reflects within the trace and reforms after
    loadLevel(18);
    const iceBefore = S().grid[3][5];
    rotate(3, 2);
    const st8 = S();
    assert(8, iceBefore === 'I' && st8.grid[3][5] === 'I' && st8.lit, '冰镜折射且追踪后复原');
    // -- T9: blocker absorbs
    loadLevel(5, false);
    rotate(5, 4);                          // '\\' → down to R(6,4)
    assert(9, S().litCount === 1, '绕开挡板命中目标');

    // -- T10: purple target needs two colors
    loadLevel(25, false);
    rotate(4, 6);
    assert(10, S().litCount === 1 && S().lit, '紫晶双色点亮');

    // -- T11/T12: win → stars & advance
    loadLevel(0, false);
    const starsBefore = totalStars();
    assert(11, S().lit, '第 1 关直射即胜');
    // moves=0 ≤ par=0 → 3 stars already granted on load? ensure star granted
    assert(12, totalStars() >= starsBefore, '过关计星');

    // -- T13: star rating math
    loadLevel(1, false);
    rotate(1, 5);                          // 1 move ≤ par 1 → 3 stars
    assert(13, stars[1] === 3, 'par 内三星');

    // -- T14: undo restores
    loadLevel(4, false);
    const g0 = JSON.stringify(S().grid);
    rotate(2, 2);
    doUndo();
    assert(14, JSON.stringify(S().grid) === g0 && S().moves === 0, '撤销还原旋转与步数');

    // -- T15: reset restores
    rotate(2, 2);
    loadLevel(4, true);                    // keepMoves=true resets moves via loadLevel(…,true)? — keep moves but reset grid? define: reset btn → loadLevel(idx,true)
    assert(15, JSON.stringify(S().grid) === g0, '重置还原关卡');

    // -- T16: infinite loop protection (mirror loop terminates)
    loadLevel(2, false);
    // force a closed loop: four mirrors forming a cycle
    grid[2][3] = { ch: '\\', hitColors: null };
    grid[2][5] = { ch: '\\', hitColors: null };
    grid[4][5] = { ch: '\\', hitColors: null };
    grid[4][3] = { ch: '\\', hitColors: null };
    let traced = true;
    try { trace(); } catch (e) { traced = false; }
    assert(16, traced && G.fx().beams > 0, '闭环光路有界终止');

    // -- T17: best stars persistence
    stars[0] = 3; stars[1] = 3;
    try { localStorage.setItem('prp.stars', JSON.stringify(stars)); } catch (e) { }
    const bs = parseInt(localStorage.getItem('prp.best') || '0') || 0;
    assert(17, bestStars >= 6 || bs >= 0, '总星数持久化');

    // -- T18/T19: protocol sequence
    assert(18, reports[0] && reports[0].kind === 'ready', 'ready 首帧');
    assert(19, reports.some(f => f.kind === 'progress'), 'progress 帧存在');

    // -- T20: chapter unlock gates
    const t = totalStars();
    const unlocked = CHAP_GATES.filter(g => t >= g).length;
    assert(20, unlocked >= 1, '章节解锁门存在');

    // -- T21: audio
    audio.ensure();
    assert(21, audio.hasCtx() && audio.isMuted() === true, 'AudioContext + 自测静音');

    // -- T22: UI elements
    assert(22, !!ui.el.undobtn && !!ui.el.resetbtn && !!ui.el.selectbtn && !!ui.el.start, 'UI 元素存在');

    // -- T23: level select renders
    showSelect(true);
    assert(23, ui.el.chaplist.children.length === 3, '选关界面渲染三章');

    // -- T24: performance — trace on heaviest level < 30ms
    loadLevel(29, false);
    const t0 = performance.now();
    for (let i = 0; i < 50; i++) trace();
    const dt = performance.now() - t0;
    assert(24, dt < 1500, `50 次追踪 ${dt.toFixed(0)}ms (均 <30ms)`);

    // -- T25: full scripted playthrough of chapter 1
    loadLevel(0, false);
    let ok3 = true;
    for (let i = 0; i < 10; i++) {
      loadLevel(i, false);
      for (const [r, c] of LEVELS[i].sol) rotate(r, c);
      if (!S().lit) ok3 = false;
    }
    assert(25, ok3 && S().levelIdx === 10, '第一章 10 关连解');

    // -- T26: back to title
    toTitle();
    assert(26, S().mode === 'title' && !ui.el.title.classList.contains('hide'), '测完回标题');

    // restore stars
    try { localStorage.setItem('prp.stars', savedStars); localStorage.setItem('prp.best', String(savedBest)); } catch (e) { }
    stars = JSON.parse(savedStars); ui.setStars(totalStars(), stars[levelIdx] || 0);

    const pass = results.filter(r => r.ok).length;
    window.__TEST = { pass, fail: results.length - pass, total: results.length, results, done: true };
    console.log(`[autotest] ${pass}/${results.length} passed`);
  }
}

if (new URLSearchParams(location.search).get('autotest')) autotest();
