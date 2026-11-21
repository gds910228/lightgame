// Bridgewright 造桥匠 — 2D Canvas physics bridge builder.
// guizang third-series #3. Fixed-step simulation, authored solvable levels,
// G debug hooks and a 30+ assertion ?autotest=1 suite.

import { LEVELS, CHAPTERS, MATERIALS, TOTAL_LEVELS, GROUND_Y, FAIL_Y, levelByNumber, memberCost } from './levels.js';
import { makePhysics } from './physics.js';
import { makeAudio } from './audio.js';

const W = 960, H = 540, DT = 1 / 60;
const $ = (s) => document.querySelector(s);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pad2 = (n) => String(n).padStart(2, '0');

// ==================== canvas / view ====================
const cv = $('#gl');
const ctx = cv.getContext('2d');
let DPR = 1, viewScale = 1, viewOX = 0, viewOY = 0;
let shakeT = 0, shakeAmp = 0, flashT = 0, flashColor = '255,220,170';

function resize() {
  DPR = Math.min(2, window.devicePixelRatio || 1);
  const vw = Math.max(1, innerWidth), vh = Math.max(1, innerHeight);
  cv.width = Math.round(vw * DPR); cv.height = Math.round(vh * DPR);
  viewScale = Math.min(vw / W, vh / H);
  viewOX = (vw - W * viewScale) / 2;
  viewOY = (vh - H * viewScale) / 2;
  if (!Number.isFinite(viewScale) || viewScale <= 0) { viewScale = 1; viewOX = viewOY = 0; }
}
addEventListener('resize', resize);
resize();

// ==================== procedural backdrop ====================
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const bg = document.createElement('canvas');
bg.width = W * 2; bg.height = H * 2;
{
  const b = bg.getContext('2d');
  b.scale(2, 2);
  const rnd = mulberry32(18031);
  const sky = b.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#070b19');
  sky.addColorStop(.38, '#111b38');
  sky.addColorStop(.65, '#293453');
  sky.addColorStop(.82, '#6b4d55');
  sky.addColorStop(1, '#2a2233');
  b.fillStyle = sky; b.fillRect(0, 0, W, H);

  // star field with a faint diagonal river of stars
  for (let i = 0; i < 220; i++) {
    const x = rnd() * W, y = rnd() * H * .55;
    const r = rnd() < .9 ? .5 + rnd() * .9 : 1.3 + rnd() * 1.3;
    const a = .18 + rnd() * .65;
    b.fillStyle = `rgba(${200 + rnd() * 40 | 0},${214 + rnd() * 30 | 0},255,${a})`;
    b.beginPath(); b.arc(x, y, r, 0, 7); b.fill();
  }
  for (let i = 0; i < 90; i++) {
    const t = rnd();
    const x = 120 + t * 760 + (rnd() - .5) * 100;
    const y = 12 + t * 235 + (rnd() - .5) * 45;
    b.fillStyle = `rgba(190,215,255,${.04 + rnd() * .10})`;
    b.beginPath(); b.arc(x, y, .5 + rnd() * .9, 0, 7); b.fill();
  }

  // nebula wash
  for (const [x, y, r, c] of [[220, 150, 240, '96,120,190'], [730, 215, 210, '150,104,110'], [450, 80, 280, '70,92,150']]) {
    const g = b.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${c},.10)`); g.addColorStop(1, `rgba(${c},0)`);
    b.fillStyle = g; b.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // moon + halo
  const moonX = 778, moonY = 92, moonR = 36;
  const halo = b.createRadialGradient(moonX, moonY, moonR * .3, moonX, moonY, moonR * 4.4);
  halo.addColorStop(0, 'rgba(255,235,190,.32)');
  halo.addColorStop(.36, 'rgba(240,201,138,.11)');
  halo.addColorStop(1, 'rgba(240,201,138,0)');
  b.fillStyle = halo; b.beginPath(); b.arc(moonX, moonY, moonR * 4.4, 0, 7); b.fill();
  b.fillStyle = '#f4e2bc';
  b.beginPath(); b.arc(moonX, moonY, moonR, 0, 7); b.fill();
  b.fillStyle = 'rgba(150,130,120,.18)';
  b.beginPath(); b.arc(moonX - 10, moonY - 7, 7, 0, 7); b.fill();
  b.beginPath(); b.arc(moonX + 12, moonY + 9, 10, 0, 7); b.fill();
  b.beginPath(); b.arc(moonX + 3, moonY - 15, 4, 0, 7); b.fill();

  // wispy clouds
  b.save();
  b.globalCompositeOperation = 'screen';
  for (let i = 0; i < 8; i++) {
    const cx = 40 + rnd() * 880, cy = 130 + rnd() * 180;
    const rx = 90 + rnd() * 170, ry = 8 + rnd() * 18;
    const g = b.createRadialGradient(cx, cy, 0, cx, cy, rx);
    g.addColorStop(0, 'rgba(140,158,200,.05)'); g.addColorStop(1, 'rgba(140,158,200,0)');
    b.fillStyle = g; b.beginPath(); b.ellipse(cx, cy, rx, ry, 0, 0, 7); b.fill();
  }
  b.restore();

  // distant mesa layers
  function mesa(y0, amp, color, alpha) {
    b.beginPath(); b.moveTo(0, H);
    let x = 0;
    b.lineTo(0, y0);
    while (x < W + 60) {
      const step = 40 + rnd() * 90;
      const y = y0 - rnd() * amp - Math.sin(x * .006) * 16;
      b.lineTo(x + step * .4, y); b.lineTo(x + step, y + rnd() * 22);
      x += step;
    }
    b.lineTo(W + 60, H); b.closePath();
    b.globalAlpha = alpha; b.fillStyle = color; b.fill(); b.globalAlpha = 1;
  }
  mesa(292, 64, '#1a2740', .85);
  mesa(338, 58, '#172135', .9);
  mesa(378, 48, '#141c2d', 1);

  // warm horizon haze
  const haze = b.createLinearGradient(0, 300, 0, 450);
  haze.addColorStop(0, 'rgba(196,124,91,0)');
  haze.addColorStop(.6, 'rgba(196,124,91,.13)');
  haze.addColorStop(1, 'rgba(96,60,74,0)');
  b.fillStyle = haze; b.fillRect(0, 280, W, 200);

  // far canyon river
  b.fillStyle = '#0a1222'; b.fillRect(0, GROUND_Y - 12, W, H - GROUND_Y + 30);
  const river = b.createLinearGradient(0, GROUND_Y + 6, 0, H);
  river.addColorStop(0, 'rgba(68,133,145,.38)'); river.addColorStop(1, 'rgba(17,28,47,.1)');
  b.fillStyle = river; b.beginPath();
  b.moveTo(0, GROUND_Y + 22);
  for (let x = 0; x <= W; x += 30) b.lineTo(x, GROUND_Y + 18 + Math.sin(x * .025) * 7 + rnd() * 4);
  b.lineTo(W, H); b.lineTo(0, H); b.closePath(); b.fill();
  for (let i = 0; i < 35; i++) {
    const x = rnd() * W, y = GROUND_Y + 25 + rnd() * 70;
    b.strokeStyle = `rgba(160,214,214,${.03 + rnd() * .09})`;
    b.lineWidth = .6 + rnd(); b.beginPath(); b.moveTo(x, y); b.lineTo(x + 20 + rnd() * 60, y + (rnd() - .5) * 3); b.stroke();
  }

  // vignette & grain
  const vig = b.createRadialGradient(W / 2, H * .46, H * .18, W / 2, H * .5, W * .68);
  vig.addColorStop(0, 'rgba(0,0,0,0)'); vig.addColorStop(1, 'rgba(2,5,12,.62)');
  b.fillStyle = vig; b.fillRect(0, 0, W, H);
  for (let i = 0; i < 900; i++) {
    b.fillStyle = `rgba(255,240,210,${rnd() * .025})`;
    b.fillRect(rnd() * W, rnd() * H, 1, 1);
  }
}

// ==================== boot state ====================
const physics = makePhysics();
const audio = makeAudio();
let mode = 'title';               // title | build | test | over | win
let paused = false, noAuto = false;
let levelN = 1;
let level = levelByNumber(1);
let levelBudget = 0, spent = 0;
let material = 'beam';
let selectedNode = null, hoverNode = null, pointerDrag = null;
let pointerX = -1, pointerY = -1;
let testPeak = 0, lastStressSound = 0, stressSoundT = 0;
let warnedGroan = false, warnedDanger = false, sparkT = 0;
let result = null;
let hitstop = 0;
let slowmoT = 0;                 // 构件断裂慢动作剩余时间（只影响演出节奏，不改物理轨迹）
let winFxT = 0, overFxT = 0;     // 胜利弹跳 / 失败翻滚的纯演出计时
const particles = [];
const floats = [];
const reports = [];
let reportTarget = null;
let toastTimer = 0;

const STORE = { best: 'brw.best', stars: 'brw.stars', unlocked: 'brw.unlocked', mute: 'brw.mute' };
let starsByLevel = {};
let unlocked = 1;
let totalStars = 0, best = 0;

const AUTOTEST = new URLSearchParams(location.search).has('autotest');

// ==================== storage ====================
function loadProgress() {
  starsByLevel = {};
  try {
    const raw = JSON.parse(localStorage.getItem(STORE.stars) || '{}');
    for (let n = 1; n <= TOTAL_LEVELS; n++) {
      const v = Number(raw && raw[n]);
      if (Number.isInteger(v) && v >= 0 && v <= 3) starsByLevel[n] = v;
    }
  } catch (e) { }
  try { unlocked = clamp(parseInt(localStorage.getItem(STORE.unlocked) || '1', 10) || 1, 1, TOTAL_LEVELS); } catch (e) { unlocked = 1; }
  totalStars = 0;
  for (let n = 1; n <= TOTAL_LEVELS; n++) totalStars += starsByLevel[n] || 0;
  try { best = Math.max(totalStars, parseInt(localStorage.getItem(STORE.best) || '0', 10) || 0); } catch (e) { best = totalStars; }
}
function saveProgress() {
  try {
    localStorage.setItem(STORE.stars, JSON.stringify(starsByLevel));
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

// ==================== protocol ====================
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
      if (frame.kind === 'ready') window.parent.postMessage({ source: 'lightgame', type: 'lightgame:ready', gameId: 'bridgewright', v: 1 }, '*');
    }
  } catch (e) { }
}
report('ready', { game: 'bridgewright', version: '1.0.0' });

// ==================== UI refs ====================
const ui = {
  hud: $('#hud'), title: $('#title'), end: $('#end'), toast: $('#toast'),
  chapter: $('#hud-chapter'), level: $('#hud-level'), sub: $('#hud-sub'),
  spent: $('#hud-spent'), budget: $('#hud-budget'), bar: $('#hud-bar'),
  stress: $('#hud-stress'), remain: $('#hud-remain'),
  stars: $('#hud-stars'), starsl: $('#hud-starsl'),
  mute: $('#btn-mute'), pause: $('#btn-pause'),
  materials: [$('#mat-beam'), $('#mat-cable'), $('#mat-pillar')],
  buildActions: $('#build-actions'), testState: $('#test-state'),
  undo: $('#btn-undo'), reset: $('#btn-reset'), test: $('#btn-test'),
  hint: $('#hintline'),
  titleBest: $('#title-best'), titleProgress: $('#title-progress'), titleBridges: $('#title-bridges'),
  chaptermap: $('#chaptermap'), start: $('#startbtn'),
  endKick: $('#end-kick'), endHeading: $('#end-heading'), endReason: $('#end-reason'),
  endStars: [...document.querySelectorAll('#end-stars span')],
  endTime: $('#end-time'), endStress: $('#end-stress'), endBudget: $('#end-budget'),
  endNext: $('#end-next'), endRetry: $('#end-retry'), endTitleBtn: $('#end-home'),
};

function toast(msg) {
  ui.toast.textContent = msg;
  ui.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ui.toast.classList.remove('show'), 1700);
}

function chapterFor(n) { return CHAPTERS.find(c => n >= c.range[0] && n <= c.range[1]) || CHAPTERS[0]; }

function updateMuteBtn() {
  ui.mute.textContent = audio.isMuted() ? '静' : '声';
  ui.mute.classList.toggle('off', audio.isMuted());
}
function syncMaterialUI() {
  for (const el of ui.materials) el.classList.toggle('on', el.dataset.mat === material);
}

function updateHUD() {
  if (mode === 'title') { ui.hud.classList.add('hidden'); return; }
  ui.hud.classList.remove('hidden');
  const ch = chapterFor(levelN);
  ui.chapter.innerHTML = `<span class="knum">第 ${pad2(levelN)} 关</span><span class="kch"> · 第${['一', '二', '三'][ch.id - 1]}章 ${ch.zh}</span>`;
  ui.level.textContent = level.name;
  ui.sub.textContent = level.subtitle;
  ui.spent.textContent = String(spent);
  ui.budget.textContent = String(levelBudget);
  const pct = levelBudget > 0 ? clamp(spent / levelBudget, 0, 1) : 0;
  ui.bar.style.width = (pct * 100).toFixed(1) + '%';
  const left = Math.max(0, levelBudget - spent);
  ui.remain.textContent = `余 ${left}`;
  const pst = physics.state();
  const curStress = mode === 'test' ? Math.max(testPeak, ...(physics.stressList().length ? physics.stressList() : [0])) : 0;
  ui.stress.style.width = (clamp(curStress, 0, 1) * 100).toFixed(1) + '%';
  const st = starsByLevel[levelN] || 0;
  ui.stars.textContent = '★'.repeat(st) + '☆'.repeat(3 - st);
  ui.starsl.textContent = `总星 ${totalStars} / ${TOTAL_LEVELS * 3}`;
  ui.undo.disabled = mode !== 'build' || physics.members().length === 0;
  ui.reset.disabled = mode !== 'build' && mode !== 'test';
  ui.test.disabled = mode !== 'build';
  const isTest = mode === 'test';
  ui.buildActions.classList.toggle('hidden', isTest);
  ui.testState.classList.toggle('hidden', !isTest);
  if (isTest) {
    ui.testState.textContent = paused ? '已暂停 · P 继续' : `矿车压测中 · ${pst.elapsed.toFixed(1)}s · P 暂停`;
    ui.hint.textContent = '矿车重量逐点压在桥面节点上 · 应力超过阈值或桥面坠落即失败';
  } else if (mode === 'build') {
    ui.hint.innerHTML = '点选节点 A → B 建造 · <b>1/2/3</b> 换材料 · <b>Z</b> 撤销 · <b>R</b> 重置 · <b>Enter</b> 压测';
  }
  for (const el of ui.materials) el.classList.toggle('disabled', isTest);
  ui.materials.forEach(el => { el.style.pointerEvents = mode === 'build' ? 'auto' : 'none'; el.style.opacity = mode === 'build' ? '1' : '.45'; });
  syncMaterialUI();
}

function refreshTitle() {
  ui.titleBest.textContent = String(best);
  ui.titleProgress.textContent = `${unlocked} / ${TOTAL_LEVELS}`;
  const built = Object.values(starsByLevel).filter(v => v > 0).length;
  ui.titleBridges.textContent = `${built} / ${TOTAL_LEVELS}`;
  ui.start.textContent = unlocked > 1 ? `继续 · 第 ${pad2(unlocked)} 关` : '开始造桥';
  const buttons = ui.chaptermap.querySelectorAll('.lv');
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
      b.title = `第 ${n} 关`;
      b.innerHTML = `<span>${pad2(n)}</span><span class="ls">·</span>`;
      b.addEventListener('click', () => { if (n <= unlocked) startLevel(n); });
      grid.appendChild(b);
    }
    box.appendChild(grid);
    ui.chaptermap.appendChild(box);
  }
  refreshTitle();
}

// ==================== level / economy ====================
function calcStars(time, pressure, remain) {
  let stars = 1;
  if (pressure <= level.stars.two && time <= level.par * 1.35) stars = 2;
  if (pressure <= level.stars.three && remain >= levelBudget * level.stars.budgetLeft && time <= level.par) stars = 3;
  return stars;
}

function loadLevelIntoWorld(n) {
  levelN = clamp(n, 1, TOTAL_LEVELS);
  level = levelByNumber(levelN);
  physics.loadLevel(level);
  levelBudget = level.budget;
  spent = 0;
  material = 'beam';
  selectedNode = null; hoverNode = null; pointerDrag = null;
  testPeak = 0; result = null;
  hitstop = 0; slowmoT = 0; winFxT = 0; overFxT = 0;
  warnedGroan = false; warnedDanger = false; sparkT = 0;
  paused = false;
  particles.length = 0; floats.length = 0;
  shakeT = 0; flashT = 0;
}

function startLevel(n) {
  loadLevelIntoWorld(n);
  ui.toast.classList.remove('show');
  mode = 'build';
  ui.title.classList.add('hidden');
  ui.end.classList.add('hidden');
  ui.hud.classList.remove('hidden');
  audio.setState('build');
  audio.sfx.level();
  updateHUD();
  refreshTitle();
  toast(`第 ${pad2(levelN)} 关 · ${level.name} — 先连起桥面`);
}

function resetLevel() {
  if (mode === 'title') return false;
  const n = levelN;
  loadLevelIntoWorld(n);
  mode = 'build';
  ui.end.classList.add('hidden');
  audio.setState('build');
  selectedNode = null;
  updateHUD();
  toast('桥面已清空 · 重新来过');
  return true;
}

function showTitle() {
  mode = 'title'; paused = false;
  ui.toast.classList.remove('show');
  selectedNode = null;
  ui.title.classList.remove('hidden');
  ui.end.classList.add('hidden');
  ui.hud.classList.add('hidden');
  audio.setState('title');
  refreshTitle();
  updateHUD();
}

function setMaterial(m) {
  if (!MATERIALS[m]) return false;
  if (mode !== 'build') { toast('压测中不能更换材料'); return false; }
  material = m;
  syncMaterialUI();
  audio.sfx.click();
  const def = MATERIALS[m];
  toast(m === 'pillar' ? '石柱：点选一个桥面节点，自动落柱到谷底' : `${def.zh}：点选 A → B 连接构件`);
  return true;
}

function buildCost(aRef, bRef, type) {
  const chk = physics.canBuild(aRef, bRef, type);
  if (!chk.ok) return { ok: false, why: chk.why, cost: Infinity };
  const cost = type === 'pillar' ? memberCost(type, 0, chk.height) : memberCost(type, chk.len, 0);
  return { ok: true, cost, len: chk.len, height: chk.height, a: chk.a, b: chk.b };
}

function tryBuild(aRef, bRef, type, silent = false) {
  if (mode !== 'build' && !silent) { toast('只有在造桥阶段可以施工'); return false; }
  const info = buildCost(aRef, bRef, type);
  if (!info.ok) { if (!silent) toast(info.why); return false; }
  if (spent + info.cost > levelBudget) {
    if (!silent) toast(`预算不足：还需 ${spent + info.cost - levelBudget} 铜`);
    audio.sfx.click();
    return false;
  }
  const res = physics.build(aRef, bRef, type);
  if (!res.ok) { if (!silent) toast(res.why); return false; }
  spent += res.cost;
  selectedNode = null;
  audio.sfx[type === 'beam' ? 'place' : type]();
  const a = physics.findNode(aRef);
  const b = res.member.b;
  if (type === 'pillar') {
    spawnBurst(a.x, GROUND_Y - 6, '#c7d0df', 10, 90, .55, 2.5);
    addFloat(a.x + 8, (a.y + GROUND_Y) / 2, `-${res.cost} 铜`, '#e8c98a', 12);
  } else {
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    spawnBurst(mx, my, type === 'cable' ? '#8fe8d5' : '#e0a764', 7, 70, .45, 2);
    addFloat(mx, my - 8, `-${res.cost} 铜`, '#e8c98a', 12);
  }
  updateHUD();
  return true;
}

function undoBuild() {
  if (mode !== 'build') return false;
  const m = physics.removeLast();
  if (!m) { toast('没有可撤销的构件'); return false; }
  spent = Math.max(0, spent - m.cost);
  selectedNode = null;
  audio.sfx.undo();
  spawnBurst(m.a.x, m.a.y, '#8fa9bd', 5, 45, .35, 1.5);
  addFloat(m.a.x, m.a.y - 10, `退 +${m.cost} 铜`, '#b9d3c2', 12);
  updateHUD();
  return true;
}

function startTest() {
  if (mode !== 'build') return false;
  if (!physics.deckConnected()) { toast('桥面还没有连通：先用木梁把左右岸连起来'); return false; }
  mode = 'test'; paused = false; selectedNode = null; pointerDrag = null;
  physics.resetSim();
  testPeak = 0; lastStressSound = 0; stressSoundT = 0; result = null;
  warnedGroan = false; warnedDanger = false; sparkT = 0;
  hitstop = 0; slowmoT = 0;
  audio.setState('test');
  audio.sfx.start();
  addFloat(physics.car().x + 30, physics.car().y - 52, '出发！', '#ffe3b0', 17);
  report('progress', {
    score: totalStars * 100 + levelN,
    progress: levelN,
    budgetLeft: levelBudget - spent,
    members: physics.members().length,
  });
  updateHUD();
  return true;
}

function togglePause() {
  if (mode !== 'test') { if (mode === 'build' || mode === 'title') toast('压测时才能暂停'); return false; }
  paused = !paused;
  audio.sfx.click();
  updateHUD();
  return paused;
}

function finishLevel(forced = false) {
  const st = physics.state();
  const time = forced && mode !== 'test' ? 0 : st.elapsed;
  const pressure = forced && mode !== 'test' ? 0 : st.peakStress;
  const remain = Math.max(0, levelBudget - spent);
  const stars = forced ? 3 : calcStars(time, pressure, remain);
  const prev = starsByLevel[levelN] || 0;
  starsByLevel[levelN] = Math.max(prev, stars);
  if (levelN < TOTAL_LEVELS) unlocked = Math.max(unlocked, levelN + 1);
  totalStars = 0;
  for (let n = 1; n <= TOTAL_LEVELS; n++) totalStars += starsByLevel[n] || 0;
  best = Math.max(best, totalStars);
  saveProgress();
  result = { win: true, stars, time, pressure, remain, forced };
  mode = 'win'; paused = false;
  winFxT = 0;
  audio.setState('win'); audio.sfx.win();
  spawnBurst(level.nodes[0].x0 + 80, level.nodes[0].y0 - 40, '#f0c98a', 26, 190, 1.1, 3);
  spawnBurst(level.nodes[level.deck.length - 1].x0 - 80, level.nodes[level.deck.length - 1].y0 - 40, '#8fe8d5', 26, 190, 1.1, 3);
  spawnConfetti();
  shakeT = .45; shakeAmp = 5; flashT = .45; flashColor = '255,226,170';
  const carW = physics.car();
  if (carW) addFloat(carW.x, carW.y - 52, '抵达！', '#ffe9b8', 20);
  const nearMiss = !forced && pressure >= .93;
  report('complete', {
    score: totalStars * 100 + levelN,
    progress: levelN,
    stars,
    time: +time.toFixed(2),
    stress: +pressure.toFixed(3),
  });
  showEnd(true, forced ? '调试通关 · 桥面记录已写入'
    : `矿车抵达右岸 · 桥面经住了考验${nearMiss ? ' · 千钧一发！' : ''}`, result);
  refreshTitle();
  updateHUD();
  return true;
}

function failLevel(reason, forced = false) {
  if (mode === 'over') return false;
  const wasTest = mode === 'test';
  const st = physics.state();
  if (wasTest) testPeak = Math.max(testPeak, st.peakStress);
  const time = wasTest ? st.elapsed : 0;
  const pressure = wasTest ? testPeak : 0;
  result = { win: false, stars: 0, time, pressure, remain: Math.max(0, levelBudget - spent), reason: reason || '结构失效', forced };
  mode = 'over'; paused = false;
  overFxT = 0;
  audio.setState('fail'); audio.sfx.fail();
  shakeT = .7; shakeAmp = 9; flashT = .3; flashColor = '232,106,91';
  slowmoT = Math.max(slowmoT, .5);
  const car = physics.car();
  if (car) addFloat(car.x, car.y - 46, '塌了…', '#ff8a70', 18);
  for (let i = 0; i < 30; i++) {
    const a = Math.random() * Math.PI * 2, sp = 40 + Math.random() * 220;
    particles.push({
      x: car.x, y: car.y - 20, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40,
      life: .7 + Math.random() * .7, max: 1.4, size: 1.5 + Math.random() * 3.5,
      color: i % 3 === 0 ? '#e86a5b' : i % 3 === 1 ? '#e0a764' : '#aab9c8', grav: 620, drag: .985,
    });
  }
  report('gameOver', {
    score: totalStars * 100 + levelN,
    progress: levelN,
    reason: result.reason,
    stress: +pressure.toFixed(3),
  });
  showEnd(false, result.reason, result);
  updateHUD();
  return true;
}

function showEnd(win, reason, r) {
  ui.toast.classList.remove('show');
  ui.end.classList.remove('hidden');
  ui.endKick.textContent = win ? 'TEST REPORT · 桥面通过' : 'TEST REPORT · 结构失效';
  ui.endHeading.textContent = win ? (levelN === TOTAL_LEVELS ? '灯河彼岸' : '桥通了') : '桥塌了';
  ui.endReason.textContent = reason || '';
  ui.endTime.textContent = (r.time || 0).toFixed(1) + 's';
  ui.endStress.textContent = Math.round((r.pressure || 0) * 100) + '%';
  ui.endBudget.textContent = String(Math.round(r.remain || 0));
  ui.endStars.forEach((el, i) => {
    el.classList.toggle('on', win && i < (r.stars || 0));
    el.textContent = win && i < (r.stars || 0) ? '★' : '★';
  });
  if (win) setTimeout(() => audio.sfx.star(), 140);
  ui.endNext.disabled = !win || levelN >= TOTAL_LEVELS;
  ui.endNext.textContent = levelN >= TOTAL_LEVELS ? '已是终章' : '下一关';
  ui.endRetry.textContent = '再来一次';
  ui.endTitleBtn.textContent = '回标题';
}

function nextLevel() {
  if (levelN >= TOTAL_LEVELS) { showTitle(); return; }
  startLevel(levelN + 1);
}

// ==================== FX ====================
function spawnBurst(x, y, color, n = 8, speed = 80, life = .5, size = 2) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, sp = speed * (.35 + Math.random());
    particles.push({
      x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - speed * .3,
      life: life * (.6 + Math.random() * .7), max: life, size: size * (.5 + Math.random()),
      color, grav: 300, drag: .99,
    });
  }
}
function addFloat(x, y, text, color = '#f0d7aa', size = 14) {
  if (floats.length > 12) floats.shift();
  floats.push({ x, y, text, color, size, life: 1.15, max: 1.15 });
}
function spawnConfetti() {
  const cols = ['#f0c98a', '#8fe8d5', '#e86a5b', '#c7d0df', '#ffd98f'];
  for (let i = 0; i < 46; i++) {
    particles.push({
      x: Math.random() * W, y: -18 - Math.random() * 130,
      vx: (Math.random() - .5) * 44, vy: 55 + Math.random() * 95,
      life: 1.7 + Math.random() * 1.1, max: 2.8, size: 1.6 + Math.random() * 2.6,
      color: cols[i % cols.length], grav: 150, drag: .995,
    });
  }
}
function updateFX(dt) {
  if (slowmoT > 0) slowmoT = Math.max(0, slowmoT - dt);
  if (mode === 'win') winFxT += dt;
  if (mode === 'over') overFxT += dt;
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) { particles.splice(i, 1); continue; }
    p.vy += (p.grav || 0) * dt;
    p.vx *= (p.drag || 1); p.vy *= (p.drag || 1);
    p.x += p.vx * dt; p.y += p.vy * dt;
  }
  for (let i = floats.length - 1; i >= 0; i--) {
    const f = floats[i];
    f.life -= dt; f.y -= 30 * dt;
    if (f.life <= 0) floats.splice(i, 1);
  }
  if (shakeT > 0) shakeT = Math.max(0, shakeT - dt);
  if (flashT > 0) flashT = Math.max(0, flashT - dt);
  audio.update(dt);
}

// ==================== update ====================
function update(dt) {
  if (mode === 'test') {
    if (paused) return;
    if (hitstop > 0) { hitstop -= dt; return; }
    const before = physics.state().elapsed;
    physics.step(dt, true);
    const st = physics.state();
    if (st.elapsed <= before && st.elapsed === 0) return;
    testPeak = Math.max(testPeak, st.peakStress);
    const ev = physics.drainEvents();
    for (const e of ev) {
      if (e.type === 'snap') {
        const mx = (e.member.a.x + e.member.b.x) / 2, my = (e.member.a.y + e.member.b.y) / 2;
        spawnBurst(e.member.a.x, e.member.a.y, '#e86a5b', 18, 160, .7, 2.6);
        spawnBurst(e.member.b.x, e.member.b.y, '#f0c98a', 12, 120, .6, 2);
        spawnBurst(mx, my, '#f2e0c0', 8, 90, .5, 1.8);
        shakeT = .35; shakeAmp = 7; hitstop = .07;
        slowmoT = Math.max(slowmoT, .85);
        audio.sfx.snap();
        addFloat(mx, my - 14, '啪——断裂！', '#ff8a70', 15);
      }
    }
    const maxStress = Math.max(0, ...physics.stressList());
    if (maxStress > .62) {
      stressSoundT -= dt;
      if (stressSoundT <= 0) { stressSoundT = Math.max(.16, .6 - maxStress * .4); audio.sfx.stress(maxStress); }
      if (maxStress > .8) {
        shakeT = Math.max(shakeT, .08); shakeAmp = Math.max(shakeAmp, 1.4);
        const c1 = physics.car();
        sparkT -= dt;
        if (sparkT <= 0 && c1) { sparkT = .14; spawnBurst(c1.x - 16, c1.y + 3, '#ffd27a', 2, 70, .3, 1.3); }
        if (maxStress > .88 && !warnedDanger) {
          warnedDanger = true;
          const c2 = physics.car();
          if (c2) addFloat(c2.x, c2.y - 48, '千钧一发！', '#ff7a5c', 16);
        }
      }
    } else if (maxStress > .55 && !warnedGroan) {
      warnedGroan = true;
      const c0 = physics.car();
      if (c0) addFloat(c0.x, c0.y - 48, '木头在呻吟…', '#e0c48a', 13);
    }
    if (st.failure) { failLevel(st.failure); return; }
    if (st.car && st.car.reached) { finishLevel(false); return; }
    updateHUD();
  }
}

// ==================== input ====================
const pressed = new Set();
addEventListener('keydown', (e) => {
  if (e.isComposing || e.keyCode === 229) return;
  if (e.metaKey || e.altKey || e.ctrlKey) return;
  if (!e.repeat) pressed.add(e.code);
  if (['Space', 'Tab', 'Enter', 'KeyP', 'KeyM', 'Digit1', 'Digit2', 'Digit3', 'KeyZ', 'KeyR'].includes(e.code)) e.preventDefault();
  if (e.isTrusted && !AUTOTEST) audio.ensure();
});
addEventListener('blur', () => pressed.clear());
document.addEventListener('visibilitychange', () => { if (document.hidden) pressed.clear(); });

function handleKeys() {
  for (const code of pressed) {
    if (code === 'KeyM') {
      if (!AUTOTEST) audio.ensure(); updateMuteBtn();
      toast(audio.toggleMute() ? '已静音' : '声音已开启');
    } else if (code === 'Digit1') setMaterial('beam');
    else if (code === 'Digit2') setMaterial('cable');
    else if (code === 'Digit3') setMaterial('pillar');
    else if (code === 'KeyZ') undoBuild();
    else if (code === 'KeyR') { if (mode === 'test' || mode === 'build') resetLevel(); }
    else if (code === 'KeyP') togglePause();
    else if (code === 'Escape') { selectedNode = null; pointerDrag = null; }
    else if (code === 'Enter') {
      if (mode === 'title') startLevel(unlocked);
      else if (mode === 'build') startTest();
      else if (mode === 'over' || mode === 'win') { if (result && result.win) nextLevel(); else startLevel(levelN); }
    }
  }
  pressed.clear();
}

function logicalPoint(e) {
  return { x: (e.clientX - viewOX) / viewScale, y: (e.clientY - viewOY) / viewScale };
}
function pickNode(x, y) {
  let bestN = null, bd = 27 * 27;
  for (const n of physics.nodes()) {
    const d = (n.x - x) ** 2 + (n.y - y) ** 2;
    if (d < bd) { bd = d; bestN = n; }
  }
  return bestN;
}
function nodeRef(n) { return n ? n.id : null; }

function handleTapNode(n) {
  if (!n) { selectedNode = null; return; }
  if (material === 'pillar') {
    if (tryBuild(n, null, 'pillar')) { selectedNode = null; }
    return;
  }
  if (selectedNode) {
    if (selectedNode === n) { selectedNode = null; audio.sfx.click(); return; }
    const a = selectedNode;
    selectedNode = null;
    tryBuild(a, n, material);
  } else {
    selectedNode = n;
    audio.sfx.click();
  }
}

cv.addEventListener('pointerdown', (e) => {
  if (mode !== 'build') return;
  if (e.isTrusted && !AUTOTEST) audio.ensure();
  const p = logicalPoint(e);
  pointerX = p.x; pointerY = p.y;
  const n = pickNode(p.x, p.y);
  pointerDrag = { start: n, sx: e.clientX, sy: e.clientY, moved: false };
  try { cv.setPointerCapture(e.pointerId); } catch (err) { }
  e.preventDefault();
});
cv.addEventListener('pointermove', (e) => {
  if (mode !== 'build') return;
  const p = logicalPoint(e);
  pointerX = p.x; pointerY = p.y;
  hoverNode = pickNode(p.x, p.y);
  if (pointerDrag) {
    const d = Math.hypot(e.clientX - pointerDrag.sx, e.clientY - pointerDrag.sy);
    if (d > 7) pointerDrag.moved = true;
  }
});
cv.addEventListener('pointerup', (e) => {
  if (mode !== 'build') return;
  const p = logicalPoint(e);
  const endNode = pickNode(p.x, p.y);
  const drag = pointerDrag;
  pointerDrag = null;
  if (!drag) return;
  if (drag.start && endNode && endNode !== drag.start) {
    const a = drag.start;
    tryBuild(a, endNode, material);
    selectedNode = null;
  } else if (endNode && drag.start === endNode) {
    handleTapNode(endNode);
  } else if (!endNode) {
    selectedNode = null;
  }
  hoverNode = endNode;
  e.preventDefault();
});
cv.addEventListener('pointercancel', () => { pointerDrag = null; });
cv.addEventListener('pointerleave', () => { hoverNode = null; });

// --- UI buttons -----------------------------------------------------------
for (const el of ui.materials) el.addEventListener('click', () => setMaterial(el.dataset.mat));
ui.undo.addEventListener('click', () => undoBuild());
ui.reset.addEventListener('click', () => resetLevel());
ui.test.addEventListener('click', () => startTest());
ui.mute.addEventListener('click', () => { if (!AUTOTEST) audio.ensure(); updateMuteBtn(); toast(audio.toggleMute() ? '已静音' : '声音已开启'); });
ui.pause.addEventListener('click', () => togglePause());
ui.start.addEventListener('click', () => startLevel(Math.min(unlocked, TOTAL_LEVELS)));
ui.endNext.addEventListener('click', () => { if (result && result.win) nextLevel(); });
ui.endRetry.addEventListener('click', () => startLevel(levelN));
ui.endTitleBtn.addEventListener('click', () => showTitle());
buildTitleMap();
updateMuteBtn();

// ==================== rendering ====================
function nowSec() { return performance.now() / 1000; }

function stressLevel(s) {
  if (s >= .82) return 'danger';
  if (s >= .55) return 'warn';
  return 'safe';
}
function stressColor(s, a = 1) {
  s = clamp(s, 0, 1);
  let r, g, b;
  if (s < .55) {
    const t = s / .55;
    r = 115 + (232 - 115) * t; g = 224 + (204 - 224) * t; b = 182 + (110 - 182) * t;
  } else {
    const t = (s - .55) / .45;
    r = 232 + (232 - 232) * t; g = 204 + (106 - 204) * t; b = 110 + (91 - 110) * t;
  }
  return `rgba(${r | 0},${g | 0},${b | 0},${a})`;
}

function drawBlueprintGrid(t) {
  const lx = physics.nodes()[0].x0, rx = physics.nodes()[physics.deckNodes().length - 1].x0;
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 84, W, H - 84); ctx.clip();
  ctx.strokeStyle = 'rgba(120,221,198,.055)';
  ctx.lineWidth = .7;
  for (let x = 30; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 84); ctx.lineTo(x, H - 20); ctx.stroke(); }
  for (let y = 100; y < H - 30; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  ctx.strokeStyle = 'rgba(217,163,91,.07)';
  for (let x = 30; x < W; x += 160) { ctx.beginPath(); ctx.moveTo(x, 84); ctx.lineTo(x, H - 20); ctx.stroke(); }
  for (let y = 100; y < H - 30; y += 160) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  // span ticks
  ctx.fillStyle = 'rgba(120,221,198,.16)';
  ctx.font = '8px "Microsoft YaHei",sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`SPAN ${pad2(parseInt((rx - lx) / 10, 10))}`, lx + 6, 118);
  ctx.restore();
}

function rockPath(x0, x1, yTop, side) {
  ctx.beginPath();
  if (side === 'left') {
    ctx.moveTo(-20, yTop - 90);
    ctx.lineTo(x0 - 130, yTop - 74);
    ctx.lineTo(x0 - 62, yTop - 42);
    ctx.lineTo(x0 - 14, yTop - 12);
    ctx.lineTo(x0 + 6, yTop + 14);
    ctx.lineTo(x0 + 44, yTop + 62);
    ctx.lineTo(x0 + 64, GROUND_Y - 54);
    ctx.lineTo(x0 + 124, GROUND_Y + 26);
    ctx.lineTo(-20, GROUND_Y + 38);
  } else {
    ctx.moveTo(W + 20, yTop - 90);
    ctx.lineTo(x1 + 130, yTop - 74);
    ctx.lineTo(x1 + 62, yTop - 42);
    ctx.lineTo(x1 + 14, yTop - 12);
    ctx.lineTo(x1 - 6, yTop + 14);
    ctx.lineTo(x1 - 44, yTop + 62);
    ctx.lineTo(x1 - 64, GROUND_Y - 54);
    ctx.lineTo(x1 - 124, GROUND_Y + 26);
    ctx.lineTo(W + 20, GROUND_Y + 38);
  }
  ctx.closePath();
}

function drawBanks() {
  const L = physics.findNode('L'), R = physics.findNode('R');
  if (!L || !R) return;
  for (const side of ['left', 'right']) {
    const n = side === 'left' ? L : R;
    const g = ctx.createLinearGradient(0, n.y - 80, 0, GROUND_Y + 30);
    g.addColorStop(0, side === 'left' ? '#202c46' : '#1d2942');
    g.addColorStop(.55, '#121b2f');
    g.addColorStop(1, '#080e1c');
    rockPath(n.x, n.x, n.y, side);
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = 'rgba(217,163,91,.18)'; ctx.lineWidth = 1.4; ctx.stroke();
    // strata / cracks
    ctx.save();
    rockPath(n.x, n.x, n.y, side); ctx.clip();
    ctx.strokeStyle = 'rgba(120,150,185,.09)'; ctx.lineWidth = 1;
    for (let i = 0; i < 9; i++) {
      const yy = n.y - 60 + i * 22;
      ctx.beginPath();
      if (side === 'left') { ctx.moveTo(0, yy); ctx.lineTo(n.x + 120, yy + 8 + (i % 2) * 9); }
      else { ctx.moveTo(W, yy); ctx.lineTo(n.x - 120, yy + 8 + (i % 2) * 9); }
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(217,163,91,.08)';
    for (let i = 0; i < 5; i++) {
      const xx = side === 'left' ? 20 + i * 40 : W - 20 - i * 40;
      ctx.beginPath(); ctx.moveTo(xx, n.y - 20); ctx.lineTo(xx + (side === 'left' ? 15 : -15), GROUND_Y - 20); ctx.stroke();
    }
    ctx.restore();
    // warm rim
    ctx.strokeStyle = 'rgba(240,201,138,.24)'; ctx.lineWidth = 1.2;
    ctx.beginPath();
    if (side === 'left') {
      ctx.moveTo(n.x - 62, n.y - 42); ctx.lineTo(n.x - 14, n.y - 12); ctx.lineTo(n.x + 6, n.y + 14);
    } else {
      ctx.moveTo(n.x + 62, n.y - 42); ctx.lineTo(n.x + 14, n.y - 12); ctx.lineTo(n.x - 6, n.y + 14);
    }
    ctx.stroke();
    // grass tufts
    for (let i = 0; i < 14; i++) {
      const bx = side === 'left' ? 18 + i * 9 : W - 18 - i * 9;
      const by = n.y - 10 - Math.sin(i * 1.7) * 7;
      ctx.strokeStyle = i % 3 ? 'rgba(106,144,133,.22)' : 'rgba(217,163,91,.18)';
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + Math.sin(i) * 4, by - 6 - (i % 4) * 2); ctx.stroke();
    }
  }
  // gorge floor
  const fg = ctx.createLinearGradient(0, GROUND_Y - 8, 0, H);
  fg.addColorStop(0, 'rgba(10,17,31,0)');
  fg.addColorStop(.5, 'rgba(8,13,25,.82)');
  fg.addColorStop(1, 'rgba(4,7,14,.98)');
  ctx.fillStyle = fg; ctx.fillRect(0, GROUND_Y - 8, W, H - GROUND_Y + 8);
  // mist
  ctx.save(); ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < 4; i++) {
    const t = nowSec() * (.03 + i * .012) + i * 1.7;
    const x = (t * 80 + i * 240) % (W + 300) - 150;
    const y = GROUND_Y + 6 + i * 8;
    const g = ctx.createRadialGradient(x, y, 0, x, y, 190);
    g.addColorStop(0, 'rgba(118,168,178,.055)'); g.addColorStop(1, 'rgba(118,168,178,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, 200, 22, 0, 0, 7); ctx.fill();
  }
  ctx.restore();
}

function drawTower(n) {
  const deckY = physics.findNode('L').y;
  const baseY = Math.max(n.y + 18, deckY + 12);
  ctx.save();
  ctx.strokeStyle = 'rgba(217,163,91,.52)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(n.x, n.y); ctx.lineTo(n.x, baseY); ctx.stroke();
  ctx.strokeStyle = 'rgba(217,163,91,.30)'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(n.x - 9, baseY - 2); ctx.lineTo(n.x, n.y + 12); ctx.lineTo(n.x + 9, baseY - 2); ctx.stroke();
  for (let y = n.y + 20; y < baseY; y += 22) {
    ctx.beginPath(); ctx.moveTo(n.x - 6, y); ctx.lineTo(n.x + 6, y); ctx.stroke();
  }
  // lantern
  const glow = ctx.createRadialGradient(n.x, n.y - 3, 0, n.x, n.y - 3, 26);
  glow.addColorStop(0, 'rgba(255,214,140,.22)'); glow.addColorStop(1, 'rgba(255,214,140,0)');
  ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(n.x, n.y - 3, 26, 0, 7); ctx.fill();
  ctx.fillStyle = '#f4d28f'; ctx.beginPath(); ctx.arc(n.x, n.y - 3, 3.4, 0, 7); ctx.fill();
  ctx.restore();
}

function drawAnchor(n, side) {
  ctx.save();
  ctx.translate(n.x, n.y);
  ctx.fillStyle = '#29344b';
  ctx.strokeStyle = 'rgba(217,163,91,.55)'; ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(-13, 5); ctx.lineTo(-10, -8); ctx.lineTo(10, -8); ctx.lineTo(13, 5); ctx.lineTo(0, 10); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#d9a35b';
  ctx.beginPath(); ctx.arc(0, -2, 4, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(255,240,205,.7)';
  ctx.beginPath(); ctx.arc(-1, -3, 1.3, 0, 7); ctx.fill();
  // small pennant
  ctx.strokeStyle = 'rgba(232,224,203,.35)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(-12, -10); ctx.lineTo(-12, -28); ctx.stroke();
  ctx.fillStyle = side === 'left' ? 'rgba(227,102,90,.55)' : 'rgba(120,221,198,.45)';
  ctx.beginPath(); ctx.moveTo(-12, -27); ctx.lineTo(-1, -23); ctx.lineTo(-12, -18); ctx.closePath(); ctx.fill();
  ctx.restore();
}

function drawPillar(m) {
  const a = m.a;
  const topY = Math.min(GROUND_Y - 4, a.y);
  const x = a.x;
  ctx.save();
  const baseW = 13, topW = 9;
  const g = ctx.createLinearGradient(x - baseW, 0, x + baseW, 0);
  g.addColorStop(0, '#4c5568'); g.addColorStop(.35, '#93a0b5'); g.addColorStop(.7, '#6b758a'); g.addColorStop(1, '#343d50');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x - baseW, GROUND_Y + 6); ctx.lineTo(x - topW, topY); ctx.lineTo(x + topW, topY);
  ctx.lineTo(x + baseW, GROUND_Y + 6); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(9,14,25,.65)'; ctx.lineWidth = 1;
  for (let y = topY + 22; y < GROUND_Y; y += 24) {
    const t = (y - topY) / (GROUND_Y - topY);
    const w = topW + (baseW - topW) * t;
    ctx.beginPath(); ctx.moveTo(x - w, y); ctx.lineTo(x + w, y); ctx.stroke();
  }
  // cap and foot
  ctx.fillStyle = '#8e9aad'; ctx.strokeStyle = 'rgba(240,201,138,.3)';
  ctx.beginPath(); ctx.rect(x - 11, topY - 4, 22, 5); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.rect(x - 16, GROUND_Y - 1, 32, 7); ctx.fill(); ctx.stroke();
  if (m.stress > .66) {
    ctx.strokeStyle = m.stress > .85 ? 'rgba(232,106,91,.9)' : 'rgba(232,204,110,.75)';
    ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.moveTo(x - 5, topY + 28); ctx.lineTo(x + 2, topY + 44); ctx.lineTo(x - 3, topY + 60); ctx.lineTo(x + 4, topY + 76); ctx.stroke();
  }
  ctx.restore();
}

function isDeckBeam(m) {
  if (m.type !== 'beam') return false;
  const dn = physics.deckNodes();
  const ia = dn.indexOf(m.a), ib = dn.indexOf(m.b);
  return ia >= 0 && ib >= 0 && Math.abs(ia - ib) === 1;
}

function drawBeam(m, t) {
  const a = m.a, b = m.b;
  const angle = Math.atan2(b.y - a.y, b.x - a.x);
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const deck = isDeckBeam(m);
  const wdt = deck ? 12 : 6.5;
  const stress = mode === 'test' || mode === 'over' || mode === 'win' ? m.stress : 0;
  ctx.save();
  ctx.translate((a.x + b.x) / 2, (a.y + b.y) / 2);
  ctx.rotate(angle);
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,.3)';
  ctx.fillRect(-len / 2 + 1, -wdt / 2 + 3, len, wdt);
  const g = ctx.createLinearGradient(0, -wdt / 2, 0, wdt / 2);
  g.addColorStop(0, deck ? '#d19a5e' : '#b57a48');
  g.addColorStop(.45, deck ? '#a66b3c' : '#8c552e');
  g.addColorStop(1, '#613a20');
  ctx.fillStyle = g;
  ctx.fillRect(-len / 2, -wdt / 2, len, wdt);
  // wood grain
  ctx.strokeStyle = 'rgba(70,38,17,.34)'; ctx.lineWidth = .7;
  for (let i = 1; i < (deck ? 4 : 2); i++) {
    const y = -wdt / 2 + (wdt / (deck ? 4 : 2)) * i;
    ctx.beginPath(); ctx.moveTo(-len / 2, y); ctx.lineTo(len / 2, y); ctx.stroke();
  }
  if (deck) {
    ctx.strokeStyle = 'rgba(63,33,14,.45)'; ctx.lineWidth = .8;
    for (let x = -len / 2 + 10; x < len / 2; x += 18) {
      ctx.beginPath(); ctx.moveTo(x, -wdt / 2 - 1); ctx.lineTo(x, wdt / 2 + 1); ctx.stroke();
    }
  }
  // stress rim + subtle tint
  if (stress > .02) {
    ctx.fillStyle = stressColor(stress, .16);
    ctx.fillRect(-len / 2, -wdt / 2, len, wdt);
    ctx.strokeStyle = stressColor(stress, .92);
    ctx.lineWidth = deck ? 2.1 : 1.4;
    ctx.strokeRect(-len / 2, -wdt / 2, len, wdt);
  } else {
    ctx.strokeStyle = deck ? 'rgba(240,201,138,.25)' : 'rgba(240,201,138,.14)';
    ctx.lineWidth = .8;
    ctx.strokeRect(-len / 2, -wdt / 2, len, wdt);
  }
  // bolts
  ctx.fillStyle = '#e6bd80';
  for (const x of [-len / 2 + 4, len / 2 - 4]) {
    ctx.beginPath(); ctx.arc(x, 0, 1.8, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(50,25,10,.5)'; ctx.beginPath(); ctx.arc(x + .4, .4, .8, 0, 7); ctx.fill();
    ctx.fillStyle = '#e6bd80';
  }
  ctx.restore();
}

function drawCable(m, t) {
  const a = m.a, b = m.b;
  const d = Math.hypot(b.x - a.x, b.y - a.y);
  const slack = Math.max(0, m.rest - d);
  const stress = mode === 'test' || mode === 'over' || mode === 'win' ? m.stress : 0;
  const col = stress > .02 ? stressColor(stress, stress > .82 ? .95 : .85) : 'rgba(126,223,204,.72)';
  const midX = (a.x + b.x) / 2;
  const midY = (a.y + b.y) / 2 + Math.min(46, slack * .75 + 1.5);
  ctx.save();
  ctx.lineCap = 'round';
  if (stress > .7) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.strokeStyle = stressColor(stress, .2); ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(midX, midY, b.x, b.y); ctx.stroke();
    ctx.restore();
  }
  ctx.strokeStyle = col; ctx.lineWidth = stress > .82 ? 2.2 : 1.55;
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(midX, midY, b.x, b.y); ctx.stroke();
  // small cable clamps
  ctx.fillStyle = 'rgba(227,232,230,.75)';
  ctx.beginPath(); ctx.arc(a.x, a.y, 2.1, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(b.x, b.y, 2.1, 0, 7); ctx.fill();
  ctx.restore();
}

function drawNode(n, t) {
  const isFixed = n.fixed;
  if (isFixed) {
    if (n.kind === 'tower') return;
    drawAnchor(n, n.id === 'L' ? 'left' : 'right');
    return;
  }
  const sel = selectedNode === n;
  const hov = hoverNode === n;
  const pulse = .5 + .5 * Math.sin(t * 4 + n.x0 * .02);
  ctx.save();
  ctx.translate(n.x, n.y);
  if (sel || hov) {
    ctx.strokeStyle = sel ? `rgba(240,201,138,${.55 + pulse * .4})` : 'rgba(120,221,198,.8)';
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(0, 0, sel ? 13 + pulse * 2 : 10.5, 0, 7); ctx.stroke();
  }
  // brass gusset
  const g = ctx.createRadialGradient(-2, -3, 1, 0, 0, 9);
  g.addColorStop(0, '#f4d79c'); g.addColorStop(.45, '#c99452'); g.addColorStop(1, '#6f4727');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(0, 0, 7.2, 0, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(28,19,10,.7)'; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = 'rgba(30,22,12,.72)';
  ctx.beginPath(); ctx.arc(0, 0, 2.7, 0, 7); ctx.fill();
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + Math.PI / 4;
    ctx.fillStyle = 'rgba(255,235,190,.78)';
    ctx.beginPath(); ctx.arc(Math.cos(a) * 5, Math.sin(a) * 5, .9, 0, 7); ctx.fill();
  }
  ctx.restore();
}

function drawCar(t) {
  const c = physics.car();
  if (!c) return;
  const x = c.x, y = c.y;
  const pitch = mode === 'test' || mode === 'win' || mode === 'over' ? c.pitch : 0;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(pitch);
  // 纯演出层：胜利小弹跳 / 失败翻滚下坠（不改物理状态）
  if (mode === 'win') {
    const k = Math.max(0, 1 - winFxT / 2.4);
    ctx.translate(0, -Math.abs(Math.sin(winFxT * 5.2)) * 7 * k);
  } else if (mode === 'over') {
    ctx.translate(0, Math.min(46, overFxT * 30));
    ctx.rotate(Math.min(1.3, overFxT * 2));
  }
  // headlamp cone
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const lg = ctx.createLinearGradient(24, -20, 104, -4);
  lg.addColorStop(0, 'rgba(255,222,155,.24)'); lg.addColorStop(1, 'rgba(255,222,155,0)');
  ctx.fillStyle = lg;
  ctx.beginPath(); ctx.moveTo(22, -21); ctx.lineTo(105, -50); ctx.lineTo(112, 10); ctx.lineTo(22, -8); ctx.closePath(); ctx.fill();
  ctx.restore();
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,.34)';
  ctx.beginPath(); ctx.ellipse(0, -1, 28, 6, 0, 0, 7); ctx.fill();
  // wheels
  for (const wx of [-16, 16]) {
    ctx.save(); ctx.translate(wx, -7);
    ctx.rotate(c.wheelSpin);
    ctx.fillStyle = '#1b1a1c'; ctx.beginPath(); ctx.arc(0, 0, 7.2, 0, 7); ctx.fill();
    ctx.strokeStyle = '#b88a51'; ctx.lineWidth = 1.4; ctx.stroke();
    ctx.strokeStyle = 'rgba(220,190,140,.55)'; ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) { const a = i * Math.PI / 3; ctx.beginPath(); ctx.moveTo(-Math.cos(a) * 5, -Math.sin(a) * 5); ctx.lineTo(Math.cos(a) * 5, Math.sin(a) * 5); ctx.stroke(); }
    ctx.restore();
  }
  // cart body
  const body = ctx.createLinearGradient(0, -34, 0, -8);
  body.addColorStop(0, '#a97040'); body.addColorStop(.55, '#7d4c2a'); body.addColorStop(1, '#4e2d18');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(-24, -28); ctx.lineTo(23, -28); ctx.lineTo(27, -10); ctx.lineTo(-27, -10); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(240,201,138,.34)'; ctx.lineWidth = 1; ctx.stroke();
  // metal bands
  ctx.strokeStyle = 'rgba(45,31,20,.65)'; ctx.lineWidth = 2;
  for (const bx of [-15, 0, 15]) { ctx.beginPath(); ctx.moveTo(bx, -28); ctx.lineTo(bx + (bx > 0 ? 1.5 : 0), -10); ctx.stroke(); }
  // ore heap (mass-dependent)
  const oreN = clamp(Math.round(c.mass * .9), 3, 8);
  const rnd = mulberry32(300 + Math.round(c.mass * 10));
  for (let i = 0; i < oreN; i++) {
    const ox = -18 + (i * 37) % 38 + (rnd() - .5) * 5;
    const oy = -31 - (i % 3) * 3 + (rnd() - .5) * 3;
    const rr = 3.4 + rnd() * 2.8;
    ctx.fillStyle = i % 2 ? '#8fb4b8' : '#d1a45e';
    ctx.beginPath(); ctx.arc(ox, oy, rr, 0, 7); ctx.fill();
    ctx.fillStyle = i % 2 ? 'rgba(210,245,238,.55)' : 'rgba(255,226,165,.6)';
    ctx.beginPath(); ctx.arc(ox - 1, oy - 1, rr * .35, 0, 7); ctx.fill();
  }
  // 车夫（行驶时上下颠簸，失败后东倒西歪）
  const riding = (mode === 'test' && c.vx > 0) || mode === 'win';
  const wob = mode === 'over' ? Math.sin(overFxT * 9) * 2.2 * Math.max(0, 1 - overFxT * .7) : 0;
  const db = (riding ? Math.sin(t * 9 + 1.3) * 1.3 : 0) + wob;
  ctx.fillStyle = '#33415a';
  ctx.beginPath(); ctx.arc(-13, -31 + db, 4.6, Math.PI, 0); ctx.fill();
  ctx.fillRect(-17.6, -31 + db, 9.2, 2.4);
  ctx.fillStyle = '#e2b48c';
  ctx.beginPath(); ctx.arc(-13, -38 + db, 3.1, 0, 7); ctx.fill();
  ctx.fillStyle = '#54412b';
  ctx.beginPath(); ctx.arc(-13, -39.6 + db, 3.3, Math.PI * 1.02, Math.PI * 2.08); ctx.fill();
  ctx.fillRect(-17.4, -40.2 + db, 8.8, 1.3);
  // 车尾灯笼（钟摆式摇摆）
  const la = Math.sin(t * 2.4 + 1) * .2 + (mode === 'test' ? Math.max(-.3, Math.min(.3, -c.pitch * .5)) : 0);
  const lx2 = -22 + Math.sin(la) * 9, ly2 = -28 + Math.cos(la) * 9;
  ctx.strokeStyle = 'rgba(45,31,20,.8)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(-22, -28); ctx.lineTo(lx2, ly2); ctx.stroke();
  ctx.fillStyle = 'rgba(255,202,106,.28)';
  ctx.beginPath(); ctx.arc(lx2, ly2 + 3.4, 6.5, 0, 7); ctx.fill();
  ctx.fillStyle = '#ffca6a';
  ctx.beginPath(); ctx.arc(lx2, ly2 + 3.4, 2.6, 0, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(240,201,138,.55)'; ctx.stroke();
  // lamp
  ctx.fillStyle = '#ffd98f';
  ctx.beginPath(); ctx.arc(24, -20, 3, 0, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(47,31,16,.75)'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.arc(24, -20, 4, 0, 7); ctx.stroke();
  // 失去支撑时的惊呼
  if (mode === 'test' && !c.supported && c.unsupportedT > .12) {
    ctx.font = '700 22px "Microsoft YaHei",sans-serif';
    ctx.fillStyle = '#ff7a5c';
    ctx.textAlign = 'center';
    ctx.fillText('!', 0, -46 - Math.sin(t * 12) * 2);
  }
  ctx.restore();
}

function drawPreview(t) {
  if (mode !== 'build') return;
  if (!selectedNode) return;
  const target = hoverNode || (pointerX >= 0 ? { x: pointerX, y: pointerY } : null);
  if (!target) return;
  const a = selectedNode;
  const isPillar = material === 'pillar';
  const costInfo = isPillar ? (() => {
    const chk = physics.canBuild(a, null, 'pillar');
    return chk.ok ? { ok: true, cost: memberCost('pillar', 0, chk.height), height: chk.height } : chk;
  })() : buildCost(a, hoverNode || target, material);
  ctx.save();
  ctx.setLineDash([6, 7]);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = costInfo.ok ? 'rgba(240,201,138,.72)' : 'rgba(232,106,91,.72)';
  ctx.beginPath(); ctx.moveTo(a.x, a.y);
  if (isPillar) ctx.lineTo(a.x, GROUND_Y);
  else ctx.lineTo(target.x, target.y);
  ctx.stroke();
  ctx.setLineDash([]);
  if (costInfo.ok) {
    const label = isPillar ? `柱 · ${costInfo.cost} 铜` : `${MATERIALS[material].short} ${Math.round(costInfo.len || 0)}px · ${costInfo.cost} 铜`;
    const lx = isPillar ? a.x + 18 : (a.x + target.x) / 2;
    const ly = isPillar ? (a.y + GROUND_Y) / 2 : (a.y + target.y) / 2 - 9;
    ctx.font = '10px "Microsoft YaHei",sans-serif';
    const w = ctx.measureText(label).width + 14;
    ctx.fillStyle = 'rgba(8,14,28,.86)';
    ctx.fillRect(lx - w / 2, ly - 11, w, 17);
    ctx.strokeStyle = 'rgba(217,163,91,.35)'; ctx.strokeRect(lx - w / 2, ly - 11, w, 17);
    ctx.fillStyle = '#f0d7aa'; ctx.textAlign = 'center';
    ctx.fillText(label, lx, ly + 1);
  }
  ctx.restore();
}

function drawParticles() {
  for (const p of particles) {
    const a = clamp(p.life / p.max, 0, 1);
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (.5 + a * .5), 0, 7); ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'center';
  for (const f of floats) {
    ctx.globalAlpha = clamp(f.life, 0, 1);
    ctx.font = `700 ${f.size || 14}px "Microsoft YaHei",sans-serif`;
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
}

function drawAmbient(t) {
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < 26; i++) {
    const x = (i * 137.3 + Math.sin(t * .17 + i) * 24 + W) % W;
    const y = 150 + ((i * 71.7 + t * (2 + i % 4)) % (GROUND_Y - 140));
    const a = .05 + .12 * (0.5 + 0.5 * Math.sin(t * 1.4 + i * 2.1));
    ctx.fillStyle = `rgba(240,201,138,${a})`;
    ctx.beginPath(); ctx.arc(x, y, .7 + (i % 3) * .5, 0, 7); ctx.fill();
  }
  // 流星（纯装饰，按时间确定性出现）
  for (const off of [0, 6.5]) {
    const ph = (t + off) % 13;
    if (ph < 1.0) {
      const px = W * .94 - ph * 215, py = 40 + off * 26 + ph * 34;
      const a = Math.sin((ph / 1.0) * Math.PI) * .5;
      ctx.strokeStyle = `rgba(214,232,255,${a.toFixed(3)})`;
      ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + 46, py - 15); ctx.stroke();
      ctx.fillStyle = `rgba(240,248,255,${(a * 1.2).toFixed(3)})`;
      ctx.beginPath(); ctx.arc(px, py, 1.4, 0, 7); ctx.fill();
    }
  }
  ctx.restore();
}

function render() {
  const t = nowSec();
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = '#060a14';
  ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.save();
  ctx.translate(viewOX, viewOY); ctx.scale(viewScale, viewScale);
  const shx = shakeT > 0 ? (Math.random() * 2 - 1) * shakeAmp * shakeT * 7 : 0;
  const shy = shakeT > 0 ? (Math.random() * 2 - 1) * shakeAmp * shakeT * 7 : 0;
  ctx.translate(shx, shy);
  ctx.drawImage(bg, 0, 0, W, H);
  drawAmbient(t);
  drawBlueprintGrid(t);
  if (mode !== 'title') {
    drawBanks();
    const nodeList = physics.nodes();
    for (const n of nodeList) if (n.kind === 'tower') drawTower(n);
    const members = physics.members();
    for (const m of members) if (m.type === 'pillar') drawPillar(m);
    for (const m of members) if (m.type === 'cable') drawCable(m, t);
    for (const m of members) if (m.type === 'beam') drawBeam(m, t);
    // dashed guide where the deck is still unbuilt
    const dn = physics.deckNodes();
    for (let i = 0; i < dn.length - 1; i++) {
      if (physics.hasDeckBeam(i, i + 1)) continue;
      ctx.save(); ctx.setLineDash([4, 7]); ctx.strokeStyle = 'rgba(120,221,198,.24)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(dn[i].x, dn[i].y); ctx.lineTo(dn[i + 1].x, dn[i + 1].y); ctx.stroke(); ctx.restore();
    }
    for (const n of nodeList) drawNode(n, t);
    drawCar(t);
    drawPreview(t);
    drawParticles();
    if (paused) {
      ctx.save();
      ctx.fillStyle = 'rgba(5,9,18,.55)'; ctx.fillRect(0, 0, W, H);
      ctx.font = '700 28px "STKaiti","KaiTi",serif'; ctx.textAlign = 'center';
      ctx.fillStyle = '#f0d7aa'; ctx.fillText('已 暂 停', W / 2, H / 2 - 4);
      ctx.font = '11px "Microsoft YaHei",sans-serif'; ctx.fillStyle = 'rgba(232,224,203,.62)';
      ctx.fillText('按 P 或点右上暂停键继续', W / 2, H / 2 + 24);
      ctx.restore();
    }
  } else {
    // quiet title backdrop: canyon, towers and a ghost of the first bridge
    drawBanks();
    for (const n of physics.nodes()) if (n.kind === 'tower') drawTower(n);
    const dn = physics.deckNodes();
    ctx.save(); ctx.globalAlpha = .62;
    ctx.lineCap = 'round';
    for (let i = 0; i < dn.length - 1; i++) {
      ctx.strokeStyle = 'rgba(200,137,79,.72)'; ctx.lineWidth = 7;
      ctx.beginPath(); ctx.moveTo(dn[i].x, dn[i].y); ctx.lineTo(dn[i + 1].x, dn[i + 1].y); ctx.stroke();
      ctx.strokeStyle = 'rgba(240,201,138,.45)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(dn[i].x, dn[i].y - 3); ctx.lineTo(dn[i + 1].x, dn[i + 1].y - 3); ctx.stroke();
    }
    const towers = physics.nodes().filter(n => n.kind === 'tower');
    for (const tw of towers) {
      const targets = tw.id === 'TL' ? [dn[1], dn[2]] : [dn[dn.length - 2], dn[dn.length - 3]];
      for (const tg of targets) {
        if (!tg) continue;
        ctx.strokeStyle = 'rgba(126,223,204,.4)'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(tw.x, tw.y); ctx.lineTo(tg.x, tg.y); ctx.stroke();
      }
    }
    for (const n of dn) {
      ctx.fillStyle = 'rgba(240,201,138,.78)';
      ctx.beginPath(); ctx.arc(n.x, n.y, 3.2, 0, 7); ctx.fill();
    }
    ctx.restore();
    drawParticles();
  }
  if (flashT > 0) {
    ctx.fillStyle = `rgba(${flashColor},${flashT * .38})`;
    ctx.fillRect(0, 0, W, H);
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
  if (mode === 'test' && !paused) {
    // 断裂慢动作：只放慢真实时间的进料速度，物理子步长不变 → 轨迹与确定性完全不受影响
    acc += dt * (slowmoT > 0 ? .32 : 1);
    let steps = 0;
    while (acc >= DT && steps < 8) {
      update(DT); acc -= DT; steps++;
      if (mode !== 'test') break;
    }
  }
  updateFX(dt);
  render();
}
requestAnimationFrame(tick);

// ==================== debug hooks ====================
const G = {
  err: window.__BOOTERR,
  step: (n = 60, dt = DT) => {
    for (let i = 0; i < n; i++) { handleKeys(); update(dt); updateFX(dt); render(); }
  },
  upd: (n = 30, dt = DT) => {
    for (let i = 0; i < n; i++) { handleKeys(); update(dt); updateFX(dt); }
  },
  press: (...codes) => codes.forEach(c => pressed.add(c)),
  setNoAuto: (v) => { noAuto = !!v; },
  setReportTarget: (fn) => { reportTarget = typeof fn === 'function' ? fn : null; },
  state: () => {
    const st = physics.state();
    return {
      mode, paused, noAuto,
      level: levelN, levelName: level.name, chapter: level.chapter,
      budget: levelBudget, spent, remaining: Math.max(0, levelBudget - spent),
      material, members: st.members, deckConnected: st.deckConnected,
      selectedNode: selectedNode ? selectedNode.id : null,
      starsByLevel: { ...starsByLevel }, unlocked, totalStars, best,
      time: st.elapsed, peakStress: Math.max(st.peakStress, testPeak), failure: st.failure,
      car: st.car, stress: Math.max(0, ...physics.stressList()),
      nan: !Number.isFinite(st.elapsed + st.peakStress + spent + levelBudget) ||
        physics.nodes().some(n => !Number.isFinite(n.x + n.y + n.vx + n.vy)),
      slowmo: +slowmoT.toFixed(2),
      muted: audio.isMuted(), audioState: audio.state(), audioCtx: audio.hasCtx(),
      reports: reports.length, net: window.__NET ? { ...window.__NET } : null,
      result: result ? { ...result } : null,
    };
  },
  setBudget: (n) => { levelBudget = Math.max(0, Math.round(+n || 0)); updateHUD(); },
  buildMember: (a, b, type) => tryBuild(a, b, type),
  buildCost: (a, b, type) => buildCost(a, b, type),
  startTest: () => startTest(),
  setLevel: (n) => { startLevel(n); return levelN; },
  resetLevel: () => resetLevel(),
  clearBridge: () => { resetLevel(); return true; },
  undo: () => undoBuild(),
  setMaterial: (m) => setMaterial(m),
  forceFail: (reason) => failLevel(reason || '调试强制失败', true),
  forceWin: () => finishLevel(true),
  toTitle: () => showTitle(),
  nextLevel: () => nextLevel(),
  cutMember: (i) => physics.cutMember(i),
  memberInfo: (i) => {
    const m = physics.members()[i];
    if (!m) return null;
    return {
      mid: m.mid, type: m.type, cost: m.cost, rest: m.rest,
      dist: Math.hypot(m.b.x - m.a.x, m.b.y - m.a.y),
      stress: m.stress, stressNow: m.stressNow, force: m.force,
      a: m.a.id, b: m.b.id, snapped: m.snapped,
    };
  },
  nodeInfo: (i) => {
    const n = physics.nodes()[i];
    return n ? { id: n.id, x: n.x, y: n.y, x0: n.x0, y0: n.y0, fixed: n.fixed, kind: n.kind } : null;
  },
  nodeScreen: (i) => {
    const n = physics.nodes()[i];
    if (!n) return null;
    return { x: viewOX + n.x * viewScale, y: viewOY + n.y * viewScale };
  },
  view: () => ({ scale: viewScale, ox: viewOX, oy: viewOY, w: W, h: H }),
  setCarMass: (v) => physics.setCarMass(v),
  setCarX: (v) => physics.setCarX(v),
  stressLevel: (s) => stressLevel(s),
  computeStars: (time, pressure, remain) => calcStars(time, pressure, remain),
  materialDefs: () => JSON.parse(JSON.stringify(MATERIALS)),
  levelConfigs: () => LEVELS.map(l => ({
    id: l.id, chapter: l.chapter, name: l.name, budget: l.budget, car: { ...l.car },
    nodes: l.nodes.length, deck: l.deck.length, solutionCost: l.solutionCost, solution: l.solution.length,
    par: l.par,
  })),
  solution: (n) => {
    const l = levelByNumber(n || levelN);
    return l.solution.map(x => x.slice());
  },
  buildSolution: (n) => {
    if (n) startLevel(n);
    else resetLevel();
    let ok = true;
    for (const [a, b, type] of level.solution) {
      if (!tryBuild(a, b, type, true)) { ok = false; break; }
    }
    return ok && physics.deckConnected();
  },
  storageSnapshot,
  restoreStorage,
  storageKeys: { ...STORE },
  reports: () => reports.slice(),
  clearReports: () => { reports.length = 0; },
  levels: LEVELS,
  audio,
  physics,
  setMuted: (v) => { audio.setMuted(v); updateMuteBtn(); },
};
window.__G = G;
window.G = G;
window.addEventListener('error', e => { if (G.err && G.err.indexOf(String(e.message || e)) < 0) G.err.push(String(e.message || e)); });

loadLevelIntoWorld(1);
mode = 'title';

// first real gesture unlocks WebAudio (and only the first one)
document.addEventListener('pointerdown', (e) => { if (e.isTrusted && !AUTOTEST) audio.ensure(); }, true);

// ==================== URL modes ====================
const params = new URLSearchParams(location.search);
if (params.has('autostart')) {
  const n = clamp(parseInt(params.get('level') || '1', 10) || 1, 1, TOTAL_LEVELS);
  startLevel(n);
  if (G.buildSolution()) {
    G.startTest();
    const carX = physics.deckNodes()[0].x0 + (physics.deckNodes()[physics.deckNodes().length - 1].x0 - physics.deckNodes()[0].x0) * .46;
    G.setCarX(carX);
    G.upd(40);
  }
} else if (params.has('level')) {
  startLevel(clamp(parseInt(params.get('level') || '1', 10) || 1, 1, TOTAL_LEVELS));
} else if (!AUTOTEST) {
  showTitle();
}

// ==================== autotest ====================
async function autotest() {
  G.setNoAuto(true);
  const nap = () => new Promise(r => { const mc = new MessageChannel(); mc.port1.onmessage = () => r(); mc.port2.postMessage(0); });
  const T = window.__TEST = { pass: 0, fail: 0, total: 0, results: [], done: false };
  const ok = (id, cond, name) => {
    T.results.push({ id, ok: !!cond, name: name || '' });
    cond ? T.pass++ : T.fail++;
    T.total++;
  };
  const up = (n = 1) => G.upd(n);
  const saved = storageSnapshot();
  const savedMuted = audio.isMuted();
  audio.setMuted(true);
  updateMuteBtn();
  const frames = [];
  G.setReportTarget(f => frames.push(f));
  await nap();

  try {
    // T1 — boot clean
    ok('T1', G.err.length === 0 && (!window.__BOOTERR || window.__BOOTERR.length === 0), `零报错 err=${G.err.length}`);

    // T2 — no NaN in a real loaded bridge under load
    G.setLevel(1);
    G.buildSolution(1);
    G.startTest();
    G.setCarX(480);
    up(45);
    const s2 = G.state();
    ok('T2', !s2.nan && Number.isFinite(s2.time) && Number.isFinite(s2.peakStress), '压测 45 帧无 NaN');

    // T3 — material pricing + budget deduction
    G.setLevel(1);
    const costInfo = G.buildCost(0, 1, 'beam');
    const b0 = G.state();
    const built = G.buildMember(0, 1, 'beam');
    const b1 = G.state();
    ok('T3', built && b1.members === b0.members + 1 && b1.spent === costInfo.cost && b1.remaining === b1.budget - costInfo.cost,
      `梁价 ${costInfo.cost}，预算 ${b1.remaining}/${b1.budget}`);

    // T4 — over-budget is rejected
    G.setLevel(1);
    G.setBudget(10);
    const m0 = G.state().members;
    const rejected = G.buildMember(0, 1, 'beam');
    const s4 = G.state();
    ok('T4', rejected === false && s4.members === m0 && s4.spent === 0, '超预算拒绝建造');

    // T5 — stress / elasticity is a real simulation value
    G.setLevel(1);
    G.buildSolution(1);
    G.startTest();
    G.setCarX(480);
    up(50);
    const stresses = [];
    for (let i = 0; i < G.state().members; i++) { const mi = G.memberInfo(i); if (mi) stresses.push(mi.stress); }
    ok('T5', stresses.length > 0 && stresses.some(v => v > .001) && stresses.every(Number.isFinite) && G.state().car.load > 0,
      `应力 max=${Math.max(...stresses).toFixed(3)}，车重载荷=${G.state().car.load.toFixed(0)}`);

    // T6 — gravity makes the deck sag
    G.setLevel(1);
    for (let i = 0; i < level.deck.length - 1; i++) G.buildMember(level.deck[i], level.deck[i + 1], 'beam');
    const y0 = G.nodeInfo(1).y;
    G.startTest();
    G.setCarX(480);
    up(60);
    const y1 = G.nodeInfo(1).y;
    ok('T6', y1 > y0 + .05 && Number.isFinite(y1), `桥面下沉 ${(y1 - y0).toFixed(2)}px`);

    // T7 — undo refunds the exact build cost
    G.setLevel(1);
    const initialBudget = G.state().budget;
    G.buildMember(0, 1, 'beam');
    const afterBuild = G.state();
    G.undo();
    const afterUndo = G.state();
    ok('T7', afterBuild.spent > 0 && afterUndo.spent === 0 && afterUndo.members === 0 && afterUndo.remaining === initialBudget,
      `扣 ${afterBuild.spent} → 退 ${afterBuild.spent - afterUndo.spent}`);
    G.setBudget(initialBudget + 250);
    ok('T7b', G.state().budget === initialBudget + 250 && G.state().remaining === initialBudget + 250, '预算增加后余额同步');

    // T8a — cutting the deck during the test leads to gameOver
    const beforeFrames = frames.length;
    G.setLevel(1);
    for (let i = 0; i < level.deck.length - 1; i++) G.buildMember(level.deck[i], level.deck[i + 1], 'beam');
    G.startTest();
    G.setCarX(480);
    up(4);
    G.cutMember(0);
    for (let i = 0; i < 240 && G.state().mode === 'test'; i++) up(1);
    const failState = G.state();
    ok('T8', failState.mode === 'over' && frames.slice(beforeFrames).some(f => f.kind === 'gameOver'), '剪断桥面 → gameOver');

    // T8b — a far too heavy cart overstresses a bare deck
    G.setLevel(1);
    for (let i = 0; i < level.deck.length - 1; i++) G.buildMember(level.deck[i], level.deck[i + 1], 'beam');
    G.setCarMass(60);
    G.startTest();
    G.setCarX(480);
    for (let i = 0; i < 300 && G.state().mode === 'test'; i++) up(1);
    ok('T8b', G.state().mode === 'over', `重车压垮 mode=${G.state().mode}`);

    // T9 — authored solution crosses to the right bank
    frames.length = 0;
    G.setLevel(1);
    G.buildSolution(1);
    G.startTest();
    let guard = 0;
    while (G.state().mode === 'test' && guard < 2400) { up(2); guard += 2; }
    const winState = G.state();
    ok('T9', winState.mode === 'win' && winState.car.reached && frames.some(f => f.kind === 'complete'),
      `矿车过桥 mode=${winState.mode} t=${winState.time.toFixed(1)}s`);

    // T10 — site report order
    const moduleKinds = G.reports().map(f => f.kind);
    const targetKinds = frames.map(f => f.kind);
    ok('T10', moduleKinds[0] === 'ready' && targetKinds.indexOf('progress') >= 0 &&
      targetKinds.indexOf('complete') > targetKinds.indexOf('progress') && moduleKinds.indexOf('gameOver') >= 0,
      `本地帧首帧 ready；本次 ${targetKinds.join('→')}`);

    // T11 — best / progress localStorage write
    const preStorage = G.storageSnapshot();
    G.setLevel(2);
    G.forceWin();
    let savedStars = {}, savedUnlock = 0, savedBest = 0;
    try {
      savedStars = JSON.parse(localStorage.getItem('brw.stars') || '{}');
      savedUnlock = parseInt(localStorage.getItem('brw.unlocked') || '0', 10);
      savedBest = parseInt(localStorage.getItem('brw.best') || '0', 10);
    } catch (e) { }
    ok('T11', (savedStars['2'] || 0) >= 1 && savedUnlock >= 3 && savedBest > 0, `stars2=${savedStars['2']} unlock=${savedUnlock} best=${savedBest}`);
    G.restoreStorage(preStorage);

    // T12 — simulated keyboard input changes gameplay state, Z refunds
    G.setLevel(1);
    G.press('Digit2'); up(1);
    const keyMat = G.state().material;
    G.press('Digit1'); up(1);
    G.buildMember(0, 1, 'beam');
    const beforeUndo = G.state().spent;
    G.press('KeyZ'); up(1);
    ok('T12', keyMat === 'cable' && G.state().material === 'beam' && beforeUndo > 0 && G.state().spent === 0,
      `1/2 键切换材料，Z 撤销退款 ${beforeUndo}`);

    // T13 — pause freezes car and bridge
    G.setLevel(1);
    G.buildSolution(1);
    G.startTest();
    G.setCarX(480);
    up(30);
    const px = G.state().car.x, py = G.nodeInfo(1).y;
    G.press('KeyP'); up(1);
    const pausedNow = G.state().paused;
    up(60);
    const frozen = G.state().car.x === px && G.nodeInfo(1).y === py;
    G.press('KeyP'); up(2);
    up(30);
    const resumed = !G.state().paused && G.state().car.x !== px;
    ok('T13', pausedNow && frozen && resumed, `暂停冻结=${frozen}，恢复=${resumed}`);

    // T14 — real canvas pointer / touch binding (tap-tap builds)
    G.setLevel(1);
    selectedNode = null;
    const p1 = G.nodeScreen(1), p2 = G.nodeScreen(2);
    const pdown = (x, y) => cv.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch', clientX: x, clientY: y, pointerId: 7, isPrimary: true }));
    const pup = (x, y) => cv.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerType: 'touch', clientX: x, clientY: y, pointerId: 7, isPrimary: true }));
    pdown(p1.x, p1.y); pup(p1.x, p1.y); up(1);
    const tapSelected = G.state().selectedNode;
    pdown(p2.x, p2.y); pup(p2.x, p2.y); up(1);
    ok('T14', tapSelected === 'd1' && G.state().members === 1, `触控选中 ${tapSelected}，连成 ${G.state().members} 个构件`);

    // T15 — retry resets the construction site
    G.setLevel(1);
    G.buildMember(0, 1, 'beam');
    G.buildMember(1, 2, 'beam');
    const beforeReset = G.state();
    G.press('KeyR'); up(1);
    const afterReset = G.state();
    ok('T15', beforeReset.members === 2 && afterReset.members === 0 && afterReset.spent === 0 &&
      afterReset.mode === 'build' && afterReset.remaining === afterReset.budget, 'R 重试复位预算与构件');
    const progSnap = G.storageSnapshot();
    G.setLevel(1); G.forceWin();
    const afterWinLevel = G.state().level;
    G.nextLevel();
    ok('T15b', afterWinLevel === 1 && G.state().level === 2, `推进到第 ${G.state().level} 关`);
    G.restoreStorage(progSnap);

    // T16 — all eighteen authored solutions really cross (and earn 3 stars)
    let allWin = true, allFinite = true, allThree = true, failures = [];
    for (let n = 1; n <= TOTAL_LEVELS; n++) {
      G.setLevel(n);
      const built = G.buildSolution(n);
      if (!built) { allWin = false; failures.push(`${n}:budget`); continue; }
      G.startTest();
      let f = 0;
      while (G.state().mode === 'test' && f < 3600) { up(4); f += 4; }
      const st = G.state();
      if (st.mode !== 'win') { allWin = false; failures.push(`${n}:${st.failure || st.mode}`); }
      if (!st.result || st.result.stars !== 3) allThree = false;
      if (st.nan) allFinite = false;
    }
    ok('T16', allWin && allFinite, `18 关实解 ${allWin ? '全部过桥' : '失败 ' + failures.join(',')}`);
    ok('T16b', allThree, '18 关参考解均获 3 星');

    // T17 — no external network traffic, no boot errors after full cruise
    const net = window.__NET || { fetch: 0, xhr: 0, ws: 0, external: [] };
    ok('T17', net.fetch + net.xhr + net.ws === 0 && net.external.length === 0 && G.err.length === 0,
      `外网请求 ${net.external.length}，错误 ${G.err.length}`);

    // T18 — stress colour thresholds
    ok('T18', G.stressLevel(.2) === 'safe' && G.stressLevel(.7) === 'warn' && G.stressLevel(.95) === 'danger', '绿→黄→红应力阈值');
    G.audio.setState('test');
    const audioState = G.state().audioState;
    G.audio.setState('build');
    ok('T18b', audioState === 'test' && G.state().audioState === 'build', 'BGM 状态切换');

    // T19 — material definitions and pillar cost premium
    const defs = G.materialDefs();
    const beam = defs.beam, cable = defs.cable, pillar = defs.pillar;
    const pTall = memberCost('pillar', 0, 150), pBeam = memberCost('beam', 150, 0);
    ok('T19', cable.tensionOnly === true && beam.tensionOnly !== true && pillar.vertical === true && pTall > pBeam,
      `柱 ${pTall} > 同长度梁 ${pBeam}，索仅抗拉`);

    // T20 — eighteen distinct level / budget / vehicle configurations
    const cfgs = G.levelConfigs();
    const masses = new Set(cfgs.map(c => c.car.mass));
    const budgets = new Set(cfgs.map(c => c.budget));
    ok('T20', cfgs.length === 18 && cfgs.every(c => c.budget > 0 && c.solutionCost <= c.budget) &&
      masses.size >= 15 && budgets.size >= 15 && cfgs.every(c => c.deck >= 5), `18 关、车重 ${masses.size} 档、预算 ${budgets.size} 档`);

    // T21 — star rules really differ
    G.setLevel(1);
    const l1Budget = levelByNumber(1).budget;
    const stars3 = G.computeStars(2, .30, l1Budget * .2);
    const stars2 = G.computeStars(5, .90, l1Budget * .2);
    const stars1 = G.computeStars(5, .99, 0);
    ok('T21', stars3 === 3 && stars2 === 2 && stars1 === 1, `3/2/1 星规则 = ${stars3}/${stars2}/${stars1}`);

    // T22 — DOM structure / Chinese UI / series mark / 18 level buttons
    const lvBtns = document.querySelectorAll('#chaptermap .lv');
    const titleText = document.querySelector('#title') ? document.querySelector('#title').textContent : '';
    ok('T22', lvBtns.length === 18 && titleText.includes('灯匠夜游 · 第 3 铺') && !!document.querySelector('#btn-test') &&
      !!document.querySelector('#end-next') && !!document.querySelector('#end-retry') && !!document.querySelector('#end-home'),
      `关卡按钮 ${lvBtns.length} 个，结算三键齐全`);

    // T23 — pause button binding
    G.setLevel(1); G.buildSolution(1); G.startTest();
    ui.pause.click();
    const pbPaused = G.state().paused;
    ui.pause.click();
    ok('T23', pbPaused === true && G.state().paused === false, '暂停按钮可切换');

    // T24 — restore the player's real localStorage
    G.restoreStorage(saved);
    let restored = true;
    for (const k of Object.values(G.storageKeys)) {
      const a = saved[k] == null ? null : saved[k];
      const b = localStorage.getItem(k);
      if (a !== b) restored = false;
    }
    ok('T24', restored, 'localStorage 原值还原');

    // T25 — back to title, muted, no NaN
    G.setMuted(true);
    G.toTitle();
    const endState = G.state();
    ok('T25', endState.mode === 'title' && !ui.title.classList.contains('hidden') && ui.hud.classList.contains('hidden') &&
      endState.muted === true && !endState.nan, '测完静音回标题');

    // T26 — read/write of best really round-trips a value
    const snap2 = G.storageSnapshot();
    try { localStorage.setItem(STORE.best, '137'); } catch (e) { }
    const readBack = parseInt(localStorage.getItem(STORE.best) || '0', 10);
    G.restoreStorage(snap2);
    ok('T26', readBack === 137, 'best localStorage 读写还原');

    // T27 — snap drama: slow-motion engages when a member snaps under overload
    G.setLevel(8); G.buildSolution(8); G.startTest();
    G.setCarMass(60);
    let slowSeen = false;
    for (let i = 0; i < 900 && G.state().mode === 'test'; i++) {
      G.step(1, 1 / 60);
      if (G.state().slowmo > 0) slowSeen = true;
    }
    const st27 = G.state();
    ok('T27', st27.mode === 'over' && slowSeen && !st27.nan,
      `重车压断构件触发慢动作（slowmoSeen=${slowSeen}、结局=${st27.mode}）`);
    G.toTitle();

    T.done = true;
    T.total = T.results.length;
    T.pass = T.results.filter(r => r.ok).length;
    T.fail = T.results.filter(r => !r.ok).length;
    console.log(`[bridgewright autotest] ${T.pass}/${T.total} passed`);
  } catch (err) {
    T.crash = String(err && err.stack || err);
    T.results.push({ id: 'CRASH', ok: false, name: T.crash });
    T.total = T.results.length; T.pass = T.results.filter(r => r.ok).length; T.fail = T.results.length - T.pass;
    T.done = true;
    try { G.restoreStorage(saved); G.setMuted(savedMuted); G.toTitle(); } catch (e) { }
    console.log('[bridgewright autotest] crashed:', T.crash);
  } finally {
    audio.setMuted(true);
    updateMuteBtn();
    try { G.restoreStorage(saved); } catch (e) { }
  }
}
if (AUTOTEST) autotest();
