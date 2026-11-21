// Crucible Atelier 坩埚炼金坊 — 2D canvas idle alchemy sim.
// 36-recipe dependency tree, 4 automation lines, offline production (8h cap),
// prestige inheritance, pressure/overload failure path, site report bridge,
// G debug hooks and the ?autotest=1 suite.

import {
  RECIPES, RECIPE_BY_ID, ITEMS, LINE_DEFS, LINE_RATES,
  MAX_LEVEL, OFFLINE_CAP, MAX_PRESSURE, OVERLOAD_PRESSURE,
  productionMul, isRecipeAvailable, formatNum, TIER_LABELS, TIER_COLORS,
} from './data.js';
import { makeRenderer, makeIconCanvas } from './render.js';
import { makeAudio } from './audio.js';

const DT = 1 / 60;
const SAVE_KEY = 'cra.save';
const BEST_KEY = 'cra.best';
const MUTE_KEY = 'cra.mute';
const AUTOTEST = new URLSearchParams(location.search).has('autotest');
const AUTOSTART = new URLSearchParams(location.search).has('autostart');
const MAX_PARTICLES = 260;
const MAX_BUBBLES = 34;

const $ = (id) => document.getElementById(id);

// ---------------------------------------------------------------- state
let mode = 'title';               // title | play | over | complete
let paused = false, noAuto = false;
let best = 0, muted = false, hasSave = false;
let res = { mat: 12, gold: 0, ess: 0 };
let levels = [0, 0, 0, 0];
let items = { water: 6, ash: 6 };
let discovered = new Set();
let totalCrafts = 0, totalUpgrades = 0, prestige = 0;
let pressure = 0;
let selectedLine = 0;
let selectedRecipe = 'mist';
let tab = 1;
let simTime = 0;
let lastProgressAt = -99, lastSaveAt = 0;
let baseAcc = 0, baseToggle = 0;
let hitstop = 0, shakeT = 0, shakeAmp = 0, flashT = 0, craftPulse = 0, gatherPulse = 0;
let ambientAcc = 0, bubbleAcc = 0;
let pendingOfflineSec = null;
let lastOffline = null;
let clockOffset = 0;
let lastSeen = Date.now();
let nanFlag = false;
let prestigeArmedUntil = 0;
let detailSig = '';

const particles = [];
const floats = [];
const bubbles = [];
const reports = [];
let reportTarget = null;

// ---------------------------------------------------------------- boot data
const savedKeys = [SAVE_KEY, BEST_KEY, MUTE_KEY];
try {
  best = parseInt(localStorage.getItem(BEST_KEY) || '0', 10) || 0;
} catch (e) { best = 0; }
try {
  muted = localStorage.getItem(MUTE_KEY) === '1';
} catch (e) { muted = false; }

const audio = makeAudio();
audio.setMuted(muted);

const canvas = $('gl');
const renderer = makeRenderer(canvas);
window.addEventListener('resize', () => renderer.resize());

// ---------------------------------------------------------------- protocol
function sendParent(payload) {
  try {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ source: 'lightgame', type: 'lightgame:report', payload }, '*');
    }
  } catch (e) { }
}
function wireReport(frame) {
  const kind = frame.kind;
  const score = Number.isFinite(frame.score) ? Math.round(frame.score) : 0;
  if (kind === 'progress') return { kind: 'progress', data: { ...frame } };
  if (kind === 'event') return { kind: 'event', event: String(frame.event || frame.tag || 'event'), data: { ...frame } };
  if (kind === 'gameOver') {
    const prog = frame.progress && typeof frame.progress === 'object' ? frame.progress : { value: frame.progress };
    return { kind: 'gameOver', score, progress: prog, data: { ...frame } };
  }
  if (kind === 'complete') return { kind: 'complete', score };
  return frame;
}
function report(kind, payload = {}) {
  const frame = { kind, ...payload };
  if (Number.isFinite(frame.score)) frame.score = Math.round(frame.score);
  reports.push(frame);
  if (reportTarget) {
    try { reportTarget(frame); } catch (e) { }
    return;
  }
  sendParent(wireReport(frame));
}

function scoreNow() {
  const wealth = res.mat + res.gold * 2 + res.ess * 10;
  return Math.max(0, Math.round(discovered.size * 120 + totalCrafts * 15 + prestige * 400 + wealth / 10));
}
function progressPct() {
  if (mode === 'complete') return 100;
  return Math.max(0, Math.min(99, Math.floor(discovered.size / RECIPES.length * 100)));
}
function postProgress(force = false) {
  if (!force && simTime - lastProgressAt < 2.0) return;
  lastProgressAt = simTime;
  report('progress', {
    score: scoreNow(), progress: progressPct(), recipes: discovered.size,
    mat: Math.round(res.mat * 10) / 10, gold: Math.round(res.gold * 10) / 10,
    ess: Math.round(res.ess * 10) / 10, prestige,
  });
}
report('ready', { game: 'crucible-atelier', version: '1.0.0' });
try {
  if (window.parent && window.parent !== window) {
    window.parent.postMessage({ source: 'lightgame', type: 'lightgame:ready', gameId: 'crucible-atelier', v: 1 }, '*');
  }
} catch (e) { }

// ---------------------------------------------------------------- persistence
function nowMs() { return Date.now() + clockOffset; }
function setClock(ms) {
  if (Number.isFinite(ms)) clockOffset = ms - Date.now();
  return nowMs();
}
function saveBest() {
  const s = scoreNow();
  if (s > best) {
    best = s;
    try { localStorage.setItem(BEST_KEY, String(best)); } catch (e) { }
  }
  syncTitle();
  return best;
}
function saveGame(force = false) {
  if (!force && (noAuto || AUTOTEST || mode !== 'play')) return false;
  lastSeen = nowMs();
  lastSaveAt = simTime;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      v: 1,
      res: { mat: res.mat, gold: res.gold, ess: res.ess },
      levels: levels.slice(),
      items: { ...items },
      discovered: [...discovered],
      totalCrafts, totalUpgrades, prestige,
      pressure,
      lastSeen,
    }));
    hasSave = true;
    syncTitle();
    return true;
  } catch (e) { return false; }
}
function applySave(data) {
  if (!data || typeof data !== 'object') return false;
  try {
    const nr = data.res || {};
    res = {
      mat: Math.max(0, Number(nr.mat) || 0),
      gold: Math.max(0, Number(nr.gold) || 0),
      ess: Math.max(0, Number(nr.ess) || 0),
    };
    levels = [0, 1, 2, 3].map(i => {
      const v = Math.round(Number((data.levels || [])[i]) || 0);
      return Math.max(0, Math.min(MAX_LEVEL, v));
    });
    items = { water: 6, ash: 6 };
    const it = data.items || {};
    for (const k of Object.keys(it)) {
      if (ITEMS[k]) {
        const v = Number(it[k]);
        if (Number.isFinite(v) && v >= 0) items[k] = v;
      }
    }
    discovered = new Set((data.discovered || []).filter(id => !!RECIPE_BY_ID[id]));
    totalCrafts = Math.max(0, Math.round(Number(data.totalCrafts) || 0));
    totalUpgrades = Math.max(0, Math.round(Number(data.totalUpgrades) || 0));
    prestige = Math.max(0, Math.round(Number(data.prestige) || 0));
    pressure = Math.max(0, Math.min(MAX_PRESSURE, Number(data.pressure) || 0));
    lastSeen = Number.isFinite(Number(data.lastSeen)) ? Number(data.lastSeen) : nowMs();
    selectedRecipe = 'mist';
    selectedLine = 0;
    tab = 1;
    return true;
  } catch (e) { return false; }
}
function loadSaved() {
  let data = null;
  try { data = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (e) { data = null; }
  if (!data) return false;
  const ok = applySave(data);
  if (ok) { hasSave = true; updateUI(true); syncTitle(); }
  return ok;
}
function hardReset() {
  try { localStorage.removeItem(SAVE_KEY); localStorage.removeItem(BEST_KEY); } catch (e) { }
  best = 0;
  hasSave = false;
  hideToast();
  resetRun(false);
  mode = 'title'; paused = false;
  hideOverlays();
  showTitle(true);
  syncTitle();
  updateUI(true);
  return true;
}

// ---------------------------------------------------------------- offline
function computeOfflineGain(rawSeconds, opts = {}) {
  const raw = Math.max(0, Number(rawSeconds) || 0);
  const sec = Math.min(raw, OFFLINE_CAP);
  const L = Array.isArray(opts.levels) ? opts.levels : levels;
  const p = Number.isFinite(opts.prestige) ? opts.prestige : prestige;
  const m = productionMul(p);
  const startMat = Number.isFinite(opts.mat) ? opts.mat : res.mat;
  const startEss = Number.isFinite(opts.ess) ? opts.ess : res.ess;
  let mat = startMat, ess = startEss, gold = 0;
  const out = {
    raw, sec, capped: raw > OFFLINE_CAP,
    mat: 0, ess: 0, gold: 0,
    gatherMat: 0, distillEss: 0, synthGold: 0, packGold: 0,
    startMat, startEss,
  };
  if (sec <= 0) return out;

  const gMat = LINE_RATES.gatherMat * (L[0] || 0) * m * sec;
  mat += gMat; out.gatherMat = gMat;

  if ((L[1] || 0) > 0) {
    const needMat = LINE_RATES.distillMat * L[1] * sec;
    const f = needMat > 0 ? Math.max(0, Math.min(1, mat / needMat)) : 0;
    mat -= needMat * f;
    const e = LINE_RATES.distillEss * L[1] * m * sec * f;
    ess += e; out.distillEss = e;
  }
  if ((L[2] || 0) > 0) {
    const needMat = LINE_RATES.synthMat * L[2] * sec;
    const needEss = LINE_RATES.synthEss * L[2] * sec;
    const f = Math.max(0, Math.min(1,
      needMat > 0 ? mat / needMat : 1,
      needEss > 0 ? ess / needEss : 1));
    mat -= needMat * f;
    ess -= needEss * f;
    const g = LINE_RATES.synthGold * L[2] * m * sec * f;
    gold += g; out.synthGold = g;
  }
  if ((L[3] || 0) > 0) {
    const needEss = LINE_RATES.packEss * L[3] * sec;
    const f = needEss > 0 ? Math.max(0, Math.min(1, ess / needEss)) : 0;
    ess -= needEss * f;
    const g = LINE_RATES.packGold * L[3] * m * sec * f;
    gold += g; out.packGold = g;
  }
  out.mat = mat - startMat;
  out.ess = ess - startEss;
  out.gold = gold;
  return out;
}
function applyOffline(seconds) {
  const raw = (seconds !== undefined && seconds !== null)
    ? Number(seconds)
    : (pendingOfflineSec !== null ? pendingOfflineSec : Math.max(0, (nowMs() - lastSeen) / 1000));
  const g = computeOfflineGain(raw);
  res.mat = Math.max(0, res.mat + g.mat);
  res.ess = Math.max(0, res.ess + g.ess);
  res.gold = Math.max(0, res.gold + g.gold);
  pendingOfflineSec = null;
  lastOffline = g;
  lastSeen = nowMs();
  saveGame(true);
  updateUI(true);
  return g;
}
function claimOffline() { return applyOffline(); }

function fmtDur(sec) {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h} 小时 ${m} 分`;
  if (m > 0) return `${m} 分 ${s % 60} 秒`;
  return `${s} 秒`;
}
function showOffline(summary, rawSec) {
  const used = summary.sec;
  $('offtext').innerHTML =
    `你离开了 <b>${fmtDur(rawSec)}</b>，炉火按当前产线继续运转。<br>` +
    `素材 <b>+${formatNum(summary.mat)}</b> · 精华 <b>+${formatNum(summary.ess)}</b> · 金币 <b>+${formatNum(summary.gold)}</b><br>` +
    `<span class="st">离线收益上限 8 小时，本次计入 ${fmtDur(used)}${summary.capped ? '（已封顶）' : ''}</span>`;
  $('offline').classList.remove('hide');
  setUiHidden(true);
}
function maybeOfflineOnBoot() {
  if (!hasSave || AUTOTEST) return;
  const raw = Math.max(0, (nowMs() - lastSeen) / 1000);
  if (raw < 60) return;
  const g = computeOfflineGain(raw);
  if (g.mat + g.ess + g.gold > 0.01) {
    pendingOfflineSec = raw;
    showOffline(g, raw);
  }
}

// ---------------------------------------------------------------- run flow
function resetRun(keepPrestige = true) {
  res = { mat: 12, gold: 0, ess: 0 };
  levels = [0, 0, 0, 0];
  items = { water: 6, ash: 6 };
  discovered = new Set();
  totalCrafts = 0; totalUpgrades = 0;
  if (!keepPrestige) prestige = 0;
  pressure = 0;
  selectedLine = 0; selectedRecipe = 'mist'; tab = 1;
  simTime = 0; lastProgressAt = -99; lastSaveAt = 0;
  baseAcc = 0; baseToggle = 0;
  hitstop = 0; shakeT = 0; shakeAmp = 0; flashT = 0; craftPulse = 0; gatherPulse = 0;
  pendingOfflineSec = null;
  particles.length = 0; floats.length = 0; bubbles.length = 0;
  detailSig = '';
}
function hideOverlays() {
  $('end').classList.add('hide');
  $('offline').classList.add('hide');
  $('pausebanner').classList.add('hide');
}
function setUiHidden(v) {
  document.body.classList.toggle('ui-hidden', !!v);
}
function showTitle(v) {
  $('title').classList.toggle('hide', !v);
  setUiHidden(!!v);
}
function showEnd(v) {
  $('end').classList.toggle('hide', !v);
}
function syncTitle() {
  const tb = $('titlebest');
  if (tb) tb.textContent = `最高炼成值 ${formatNum(best)} · 已录配方 ${discovered.size}/36`;
  const btn = $('startbtn');
  if (btn) btn.textContent = (hasSave && mode === 'title') ? '继 续 炉 坊' : '点 炉 开 工';
}
function startGame(fresh = true) {
  if (fresh) resetRun(true);
  hideToast();
  mode = 'play'; paused = false;
  showTitle(false); showEnd(false);
  setUiHidden(false);
  $('offline').classList.add('hide');
  $('pausebanner').classList.add('hide');
  syncPauseBtn();
  updateUI(true);
  if (!AUTOTEST) {
    audio.ensure();
    audio.setState('play');
    audio.tick();
  }
  if (fresh && !AUTOTEST) {
    toast('点击坩埚采撷 · 点选配方卡炼成 · 1-4 升级产线', 4200);
  }
  saveGame();
  return true;
}
function toTitle() {
  if (mode === 'play') saveGame(true);
  mode = 'title'; paused = false;
  hideOverlays();
  showTitle(true);
  if (audio.hasCtx()) audio.setState('title');
  syncTitle();
  updateUI(true);
}
function restartRun() {
  audio.ensure();
  startGame(true);
}
function endToTitle() {
  mode = 'title'; paused = false;
  showEnd(false); showTitle(true);
  syncTitle(); updateUI(true);
}function togglePause() {
  if (mode !== 'play') return false;
  paused = !paused;
  $('pausebanner').classList.toggle('hide', !paused);
  syncPauseBtn();
  if (paused) audio.stop();
  else if (!AUTOTEST) { audio.setState('play'); audio.tick(); saveGame(); }
  return paused;
}
function syncPauseBtn() {
  const b = $('pausebtn');
  if (b) b.textContent = paused ? '▶' : '❚❚';
}
function toggleMute() {
  muted = !muted;
  audio.setMuted(muted);
  try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch (e) { }
  const b = $('mutebtn');
  if (b) { b.textContent = muted ? '🔇' : '🔊'; b.classList.toggle('on', muted); }
  return muted;
}
function setMuted(v) {
  muted = !!v;
  audio.setMuted(muted);
  try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch (e) { }
  const b = $('mutebtn');
  if (b) { b.textContent = muted ? '🔇' : '🔊'; b.classList.toggle('on', muted); }
  return muted;
}
function showEndPanel(kind) {
  const endEl = $('end');
  hideToast();
  floats.length = 0;
  endEl.classList.toggle('complete', kind === 'complete');
  if (kind === 'complete') {
    $('endkicker').textContent = 'END OF THE GREAT WORK';
    $('endh').textContent = '星辉坩埚炼成';
    $('endd').innerHTML =
      `三十六张配方尽数录毕，炉心亮起一条缓慢旋转的银河。<br>` +
      `<span class="big">${formatNum(scoreNow())}</span> 炼成值<br>` +
      `配方 <b>36 / 36</b> · 炼成 <b>${totalCrafts}</b> 次 · 传承 <b>${prestige}</b> · 最高 ${formatNum(best)}`;
  } else {
    $('endkicker').textContent = 'THE FURNACE FALLS SILENT';
    $('endh').textContent = '炸炉破产';
    $('endd').innerHTML =
      `炉压越过 100，紫铜坩埚在一声闷响里裂开。<br>` +
      `<span class="big">${formatNum(scoreNow())}</span> 炼成值<br>` +
      `配方 <b>${discovered.size} / 36</b> · 炼成 <b>${totalCrafts}</b> 次 · 传承 <b>${prestige}</b><br>` +
      `<span class="rec">重开一炉会保留传承加成</span>`;
  }
  showTitle(false);
  showEnd(true);
  setUiHidden(true);
  mode = kind === 'complete' ? 'complete' : 'over';
  paused = false;
  syncPauseBtn();
  updateUI(true);
}
function completeRun() {
  if (mode !== 'play') return false;
  saveBest();
  audio.sfx.win();
  audio.setState('win');
  burst(90, ['#7ad8ff', '#ffd77a', '#e8a86a', '#8ed86a', '#ffffff'], { speed: 380, life: 1.4, star: true });
  shakeT = 0.8; shakeAmp = 8; flashT = 0.45; gatherPulse = 1;
  showEndPanel('complete');
  report('complete', { score: scoreNow(), progress: 100, recipes: discovered.size, prestige });
  hasSave = false;
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { }
  return true;
}
function explode() {
  if (mode !== 'play') return false;
  pressure = MAX_PRESSURE;
  audio.sfx.explode();
  audio.stop();
  if (audio.hasCtx()) audio.setState('title');
  burst(130, ['#ff8a5c', '#ffd77a', '#e85a3e', '#7a3f30', '#7ad8ff'], { speed: 520, life: 1.5, star: true });
  burst(30, ['#3a241e', '#6a4a38'], { speed: 220, life: 1.9 });
  shakeT = 0.9; shakeAmp = 11; flashT = 0.55; hitstop = 0.12;
  saveBest();
  showEndPanel('over');
  report('gameOver', {
    score: scoreNow(), progress: progressPct(),
    recipes: discovered.size, totalCrafts, prestige, pressure,
  });
  hasSave = false;
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { }
  return true;
}

// ---------------------------------------------------------------- production
function addItemRaw(id, n) {
  const v = (items[id] || 0) + n;
  items[id] = Number.isFinite(v) && v > 0 ? v : 0;
}
function sanitize() {
  for (const k of ['mat', 'gold', 'ess']) {
    if (!Number.isFinite(res[k]) || res[k] < 0) { res[k] = Number.isFinite(res[k]) ? Math.max(0, res[k]) : 0; nanFlag = true; }
  }
  if (!Number.isFinite(pressure)) { pressure = 0; nanFlag = true; }
  for (const k of Object.keys(items)) {
    if (!Number.isFinite(items[k]) || items[k] < 0) { items[k] = 0; nanFlag = true; }
  }
  for (let i = 0; i < 4; i++) {
    if (!Number.isFinite(levels[i])) { levels[i] = 0; nanFlag = true; }
  }
}
function produce(dt) {
  if (!(dt > 0)) return;
  const m = productionMul(prestige);
  res.mat += LINE_RATES.gatherMat * levels[0] * m * dt;

  if (levels[1] > 0) {
    const needMat = LINE_RATES.distillMat * levels[1] * dt;
    const f = needMat > 0 ? Math.max(0, Math.min(1, res.mat / needMat)) : 0;
    res.mat -= needMat * f;
    res.ess += LINE_RATES.distillEss * levels[1] * m * dt * f;
  }
  if (levels[2] > 0) {
    const needMat = LINE_RATES.synthMat * levels[2] * dt;
    const needEss = LINE_RATES.synthEss * levels[2] * dt;
    const f = Math.max(0, Math.min(1,
      needMat > 0 ? res.mat / needMat : 1,
      needEss > 0 ? res.ess / needEss : 1));
    res.mat -= needMat * f;
    res.ess -= needEss * f;
    res.gold += LINE_RATES.synthGold * levels[2] * m * dt * f;
  }
  if (levels[3] > 0) {
    const needEss = LINE_RATES.packEss * levels[3] * dt;
    const f = needEss > 0 ? Math.max(0, Math.min(1, res.ess / needEss)) : 0;
    res.ess -= needEss * f;
    res.gold += LINE_RATES.packGold * levels[3] * m * dt * f;
  }

  // gather line also sifts a trickle of base ingredients
  if (levels[0] > 0) {
    baseAcc += levels[0] * 2 * dt;
    let guard = 0;
    while (baseAcc >= 1 && guard++ < 240) {
      baseAcc -= 1;
      baseToggle ^= 1;
      addItemRaw(baseToggle ? 'water' : 'ash', 1);
    }
  }
  if (res.mat < 0) res.mat = 0;
  if (res.ess < 0) res.ess = 0;
  sanitize();
}
function advance(seconds) {
  let left = Math.max(0, Number(seconds) || 0);
  let steps = 0;
  while (left > 1e-9 && steps++ < 200000) {
    const step = Math.min(0.25, left);
    if (mode === 'play') {
      produce(step);
      pressure = Math.max(0, pressure - 2.5 * step);
      simTime += step;
    }
    left -= step;
  }
  updateUI(true);
  if (mode === 'play' && pressure >= MAX_PRESSURE) explode();
  return { seconds: Math.max(0, Number(seconds) || 0), simTime };
}

// ---------------------------------------------------------------- FX
function burst(n, colors, opts = {}) {
  const { cx, cy, s } = renderer.scene;
  const speed = opts.speed || 220;
  const life = opts.life || 0.9;
  const px = opts.x !== undefined ? opts.x : cx;
  const py = opts.y !== undefined ? opts.y : cy - 60 * s;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = speed * (0.25 + Math.random() * 0.9);
    particles.push({
      x: px + (Math.random() * 2 - 1) * 22 * s,
      y: py + (Math.random() * 2 - 1) * 14 * s,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - 40,
      life: life * (0.5 + Math.random() * 0.8),
      max: life * 1.3,
      size: (opts.size || 3) * (0.6 + Math.random() * 1.4),
      color: colors[(Math.random() * colors.length) | 0],
      grav: 260,
      type: opts.star && Math.random() < 0.45 ? 'star' : 'spark',
      rot: Math.random() * 6,
    });
  }
  if (particles.length > MAX_PARTICLES) particles.splice(0, particles.length - MAX_PARTICLES);
}
function ring(x, y, color) {
  if (particles.length >= MAX_PARTICLES) particles.shift();
  particles.push({ x, y, type: 'ring', r0: 16, r1: 90, life: 0.5, max: 0.5, color });
}
function floatText(text, color, size) {
  if (floats.length >= 14) floats.shift();
  const { cx, cy, s, panelLeft } = renderer.scene;
  const spread = Math.max(120, (panelLeft - cx) * 0.55);
  floats.push({
    text,
    x: cx + Math.max(60 * s, 62) + Math.random() * spread,
    y: cy - 34 * s - Math.random() * 62,
    life: 1.25, max: 1.25, color: color || '#ffe8a8',
    size: size || (15 + Math.min(6, s * 3)),
  });
}
function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) { particles.splice(i, 1); continue; }
    if (p.type !== 'ring') {
      p.vy += (p.grav || 0) * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= 0.992;
      p.rot = (p.rot || 0) + dt * 3;
    }
  }
  for (let i = floats.length - 1; i >= 0; i--) {
    const f = floats[i];
    f.life -= dt; f.y -= 30 * dt;
    if (f.life <= 0) floats.splice(i, 1);
  }
}
function updateBubbles(dt) {
  for (let i = bubbles.length - 1; i >= 0; i--) {
    const b = bubbles[i];
    b.y += (0.38 + b.sp) * dt;
    b.life -= dt;
    if (b.life <= 0 || b.y > 1.15) bubbles.splice(i, 1);
  }
}
function ambient(dt) {
  ambientAcc += dt;
  bubbleAcc += dt;
  while (bubbleAcc >= 0.20 && bubbles.length < MAX_BUBBLES) {
    bubbleAcc -= 0.20;
    bubbles.push({
      x: (Math.random() * 2 - 1) * 0.82, y: 0.02 + Math.random() * 0.05,
      r: 1.4 + Math.random() * 3.4, sp: Math.random() * 0.6,
      life: 1.1 + Math.random() * 0.9, max: 2,
    });
  }
  while (ambientAcc >= 0.14 && particles.length < MAX_PARTICLES) {
    ambientAcc -= 0.14;
    const { cx, cy, s } = renderer.scene;
    const hot = pressure >= 70;
    particles.push({
      x: cx + (Math.random() * 2 - 1) * 96 * s,
      y: cy + 150 * s + (Math.random() * 2 - 1) * 20 * s,
      vx: (Math.random() * 2 - 1) * 18,
      vy: -(24 + Math.random() * 52),
      life: 0.7 + Math.random() * 0.9, max: 1.6,
      size: 1 + Math.random() * 2.4,
      color: hot ? (Math.random() < 0.4 ? '#7ad8ff' : '#ff8a5c') : (Math.random() < 0.25 ? '#ffd77a' : '#ff9a5c'),
      grav: 10, type: 'spark', rot: 0,
    });
  }
}

// ---------------------------------------------------------------- actions
function ensureAudio() {
  if (!AUTOTEST) {
    audio.ensure();
    audio.tick();
  }
}
function toast(msg, ms = 1700) {
  const t = $('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => t.classList.remove('show'), ms);
}
function hideToast() {
  const t = $('toast');
  if (t) t.classList.remove('show');
  clearTimeout(toast._timer);
}
function canPay(cost) {
  for (const k of Object.keys(cost)) {
    if (!(k in res) || res[k] + 1e-9 < cost[k]) return false;
  }
  return true;
}
function pay(cost) {
  for (const k of Object.keys(cost)) res[k] = Math.max(0, res[k] - cost[k]);
}
function costText(cost) {
  const names = { gold: '金', mat: '材', ess: '精' };
  return Object.keys(cost).map(k => `${names[k]} ${formatNum(cost[k])}`).join(' · ');
}
function lineCost(i) {
  if (i < 0 || i > 3) return {};
  const c = LINE_DEFS[i].cost(levels[i]);
  return { ...c };
}
function selectLine(i) {
  if (i < 0 || i > 3) return false;
  selectedLine = i;
  updateUI(true);
  return true;
}
function gather() {
  if (mode !== 'play' || paused) return false;
  ensureAudio();
  addItemRaw('water', 2);
  addItemRaw('ash', 2);
  res.mat += 1;
  gatherPulse = 1;
  craftPulse = Math.max(craftPulse, 0.4);
  audio.sfx.gather();
  floatText('+2 水滴 · +2 灰烬 · +1 素材', '#c8ecb0', 15);
  const { cx, cy, s } = renderer.scene;
  burst(10, ['#8ed86a', '#6fc8ff', '#a89a8c'], { x: cx, y: cy - 40 * s, speed: 120, life: 0.6 });
  updateUI(true);
  saveGame();
  return true;
}
function upgradeLine(i) {
  if (mode !== 'play' || paused) return false;
  if (i < 0 || i > 3) return false;
  selectedLine = i;
  if (levels[i] >= MAX_LEVEL) {
    toast(`产线已至满级 Lv.${MAX_LEVEL}`);
    return false;
  }
  const cost = lineCost(i);
  if (!canPay(cost)) {
    audio.sfx.deny();
    toast(`资源不足：需要 ${costText(cost)}`);
    updateUI(true);
    return false;
  }
  pay(cost);
  levels[i]++;
  totalUpgrades++;
  const { cx, cy, s } = renderer.scene;
  audio.sfx.upgrade();
  shakeT = Math.max(shakeT, 0.16); shakeAmp = Math.max(shakeAmp, 2.2);
  craftPulse = 1;
  burst(16, [LINE_DEFS[i].color, '#ffe8a8'], { x: cx + (i - 1.5) * 50 * s, y: cy + 60 * s, speed: 150, life: 0.7 });
  floatText(`${LINE_DEFS[i].name} Lv.${levels[i]}`, LINE_DEFS[i].color, 15);
  toast(`${LINE_DEFS[i].name} 升至 Lv.${levels[i]}`);
  postProgress(true);
  saveGame();
  updateUI(true);
  return true;
}
function itemCount(id) { return items[id] || 0; }
function available(id) {
  const r = RECIPE_BY_ID[id];
  return !!r && isRecipeAvailable(r, discovered);
}
function canCraft(id) {
  const r = RECIPE_BY_ID[id];
  if (!r) return { ok: false, why: '未知配方' };
  if (!isRecipeAvailable(r, discovered)) {
    const miss = r.req.filter(q => !discovered.has(q)).map(q => RECIPE_BY_ID[q].name);
    return { ok: false, why: `未解锁：需先炼成 ${miss.join('、')}` };
  }
  if (r.allRecipes && discovered.size < RECIPES.length - 1) {
    return { ok: false, why: `星辉坩埚需先录满其余 35 张配方（${discovered.size}/35）` };
  }
  for (const [id2, n] of r.inputs) {
    if ((items[id2] || 0) + 1e-9 < n) return { ok: false, why: `缺少 ${ITEMS[id2].name}（${formatNum(items[id2] || 0)}/${n}）` };
  }
  return { ok: true };
}
function selectRecipe(id) {
  if (!RECIPE_BY_ID[id]) return false;
  selectedRecipe = id;
  tab = RECIPE_BY_ID[id].tier;
  updateUI(true);
  return true;
}
function craft(id, opts = {}) {
  if (mode !== 'play') return { ok: false, why: '当前不在炉坊中' };
  const r = RECIPE_BY_ID[id];
  const chk = canCraft(id);
  if (!chk.ok) {
    if (!opts.quiet) { toast(chk.why); audio.sfx.deny(); }
    return { ok: false, why: chk.why };
  }
  const outN = Math.max(1, Math.round(Number(opts.outputs) || 1));
  for (const [it, n] of r.inputs) items[it] = Math.max(0, (items[it] || 0) - n);
  addItemRaw(id, outN);
  totalCrafts += 1;
  const first = !discovered.has(id);
  if (first) {
    discovered.add(id);
    const bonusGold = 10 + r.tier * 8;
    const bonusEss = Math.max(0, r.tier - 1);
    res.gold += bonusGold;
    res.ess += bonusEss;
    selectedRecipe = id; tab = r.tier;
  }
  const { cx, cy, s } = renderer.scene;
  craftPulse = 1;
  shakeT = Math.max(shakeT, first ? 0.3 : 0.16);
  shakeAmp = Math.max(shakeAmp, first ? 4.2 : 2.4);
  hitstop = Math.max(hitstop, first ? 0.075 : 0.04);
  if (first) {
    flashT = Math.max(flashT, 0.18);
    ring(cx, cy - 42 * s, r.color);
    burst(42, [r.color, '#ffe8a8', '#7ad8ff'], { speed: 260, life: 1.0, star: true });
    audio.sfx.unlock(r.tier);
    floatText(`录得「${r.name}」`, '#ffe8a8', 20);
    report('event', { event: 'discover', tag: 'discover', recipe: id, tier: r.tier, score: scoreNow(), progress: progressPct() });
    postProgress(true);
  } else {
    burst(14, [r.color, '#ffd77a'], { speed: 170, life: 0.7 });
    audio.sfx.craft(r.tier);
    floatText(`${r.name} ×${outN}`, r.color, 15);
  }
  if (r.final && discovered.size >= RECIPES.length) completeRun();
  saveGame();
  updateUI(true);
  return { ok: true, first, output: outN };
}
function craftSelected() {
  const chk = canCraft(selectedRecipe);
  if (!chk.ok) { toast(chk.why); audio.sfx.deny(); return { ok: false, why: chk.why }; }
  return craft(selectedRecipe);
}
function firstCraftable() {
  for (const r of RECIPES) {
    if (r.allRecipes && discovered.size < RECIPES.length - 1) continue;
    if (canCraft(r.id).ok) return r.id;
  }
  return null;
}
function craftAllPossible(quiet = true) {
  let n = 0;
  for (let pass = 0; pass < 3 && n < 80 && mode === 'play'; pass++) {
    for (const r of RECIPES) {
      if (mode !== 'play') break;
      if (r.allRecipes && discovered.size < RECIPES.length - 1) continue;
      let guard = 0;
      while (mode === 'play' && guard++ < 20 && canCraft(r.id).ok && n < 80) {
        const out = craft(r.id, { quiet, outputs: 1 });
        if (!out.ok) break;
        n++;
      }
    }
  }
  return n;
}
function quickCraft(which) {
  ensureAudio();
  if (which === 'q') return craftSelected();
  if (which === 'w') {
    const id = firstCraftable();
    if (!id) {
      toast('当前没有可以炼成的配方');
      audio.sfx.deny();
      return { ok: false };
    }
    selectRecipe(id);
    return craft(id);
  }
  if (which === 'e') {
    const n = craftAllPossible();
    if (n > 0) { toast(`连炼 ${n} 次`); audio.sfx.craft(3); }
    else { toast('当前没有可以炼成的配方'); audio.sfx.deny(); }
    updateUI(true);
    return { ok: n > 0, count: n };
  }
  return { ok: false };
}
function overload() {
  if (mode !== 'play' || paused) return { ok: false };
  const id = selectedRecipe;
  const r = RECIPE_BY_ID[id];
  const chk = canCraft(id);
  if (!chk.ok) { toast(chk.why); audio.sfx.deny(); return { ok: false, why: chk.why }; }
  for (const [it, n] of r.inputs) items[it] = Math.max(0, (items[it] || 0) - n);
  addItemRaw(id, 3);
  totalCrafts += 3;
  const first = !discovered.has(id);
  if (first) {
    discovered.add(id);
    res.gold += 10 + r.tier * 8;
    res.ess += Math.max(0, r.tier - 1);
    selectedRecipe = id; tab = r.tier;
  }
  pressure = Math.min(MAX_PRESSURE, pressure + OVERLOAD_PRESSURE);
  const { cx, cy, s } = renderer.scene;
  audio.sfx.overload();
  shakeT = Math.max(shakeT, 0.38); shakeAmp = Math.max(shakeAmp, 5.5);
  flashT = Math.max(flashT, 0.2);
  craftPulse = 1;
  ring(cx, cy, '#ff8a5c');
  burst(40, [r.color, '#ff8a5c', '#ffd77a'], { speed: 300, life: 1.1, star: true });
  floatText(`超载 ×3 · 炉压 +${OVERLOAD_PRESSURE}`, '#ffb090', 18);
  report('event', { event: 'overload', tag: 'overload', recipe: id, pressure, score: scoreNow(), progress: progressPct() });
  if (first) report('event', { event: 'discover', tag: 'discover', recipe: id, tier: r.tier, score: scoreNow(), progress: progressPct() });
  postProgress(true);
  if (pressure >= MAX_PRESSURE) {
    explode();
    saveGame();
    updateUI(true);
    return { ok: true, exploded: true, pressure };
  }
  if (r.final && discovered.size >= RECIPES.length) completeRun();
  toast(`炉压升至 ${Math.round(pressure)} / ${MAX_PRESSURE}`, 1400);
  saveGame();
  updateUI(true);
  return { ok: true, pressure, output: 3 };
}
function prestigeGain() {
  if (discovered.size < 10) return 0;
  return Math.max(1, Math.floor(discovered.size / 4) + Math.floor(totalCrafts / 40));
}
function doPrestige() {
  if (mode !== 'play') return 0;
  const gain = prestigeGain();
  if (gain <= 0) {
    toast('转生需要至少炼成 10 张配方');
    return 0;
  }
  prestige += gain;
  resetRun(true);
  mode = 'play'; paused = false;
  ensureAudio();
  audio.sfx.unlock(6);
  audio.setState('play');
  const { cx, cy, s } = renderer.scene;
  burst(80, ['#c8a0ff', '#7ad8ff', '#ffe8a8'], { x: cx, y: cy - 30 * s, speed: 320, life: 1.3, star: true });
  flashT = 0.35; shakeT = 0.5; shakeAmp = 6;
  report('event', { event: 'prestige', tag: 'prestige', gain, total: prestige, score: scoreNow(), progress: 0 });
  postProgress(true);
  toast(`炉心重铸 · 传承 +${gain}（产线输出 +${Math.round((productionMul(prestige) - 1) * 100)}%）`, 2600);
  saveGame();
  updateUI(true);
  return gain;
}
function onPrestigeClick() {
  ensureAudio();
  const gain = prestigeGain();
  if (gain <= 0) { toast('转生需要至少炼成 10 张配方'); return; }
  const now = performance.now();
  if (now < prestigeArmedUntil) {
    prestigeArmedUntil = 0;
    doPrestige();
  } else {
    prestigeArmedUntil = now + 4000;
    toast(`再次点击确认转生：传承 +${gain}，本炉配方与产线重置（保留传承与最高纪录）`, 3600);
  }
}
function onRecipeClick(id) {
  ensureAudio();
  selectRecipe(id);
  if (mode !== 'play') return;
  const chk = canCraft(id);
  if (chk.ok) craft(id);
  else { toast(chk.why); audio.sfx.deny(); }
}
function forceFail() {
  if (mode !== 'play') { mode = 'play'; paused = false; }
  return explode();
}
function unlockAll() {
  for (const r of RECIPES) if (!r.final) discovered.add(r.id);
  updateUI(true);
  return discovered.size;
}
function grantItem(id, n = 1) {
  if (!ITEMS[id]) return false;
  const v = (items[id] || 0) + Math.max(0, Number(n) || 0);
  items[id] = Number.isFinite(v) ? v : 0;
  updateUI(true);
  return true;
}
function setDiscovered(ids) {
  discovered = new Set();
  if (Array.isArray(ids)) for (const id of ids) if (RECIPE_BY_ID[id]) discovered.add(id);
  updateUI(true);
  return discovered.size;
}
function forceComplete() {
  if (mode !== 'play') { resetRun(true); mode = 'play'; paused = false; }
  unlockAll();
  grantItem('core', 1);
  grantItem('astral', 1);
  return craft('crucible');
}
function setRes(a, b) {
  if (a && typeof a === 'object') {
    for (const k of ['mat', 'gold', 'ess']) {
      if (a[k] !== undefined) {
        const v = Number(a[k]);
        if (Number.isFinite(v)) res[k] = Math.max(0, v);
      }
    }
  } else if (typeof a === 'string' && a in res) {
    const v = Number(b);
    if (Number.isFinite(v)) res[a] = Math.max(0, v);
  }
  sanitize();
  updateUI(true);
  return { ...res };
}
function addRes(kind, n) {
  if (!(kind in res)) return { ...res };
  const v = Number(n);
  if (Number.isFinite(v)) res[kind] = Math.max(0, res[kind] + v);
  sanitize();
  updateUI(true);
  return { ...res };
}
function setLineLevel(i, lvl) {
  if (i < 0 || i > 3) return false;
  const v = Math.round(Number(lvl));
  levels[i] = Number.isFinite(v) ? Math.max(0, Math.min(MAX_LEVEL, v)) : 0;
  updateUI(true);
  return levels[i];
}
function setPressure(v) {
  const n = Number(v);
  pressure = Number.isFinite(n) ? Math.max(0, Math.min(MAX_PRESSURE, n)) : 0;
  updateUI(true);
  return pressure;
}
function setPrestige(n) {
  const v = Math.round(Number(n));
  prestige = Number.isFinite(v) ? Math.max(0, v) : 0;
  updateUI(true);
  return prestige;
}

// ---------------------------------------------------------------- UI build
let cardRefs = [];
let tabRefs = [];
let lineRefs = [];
let uiAcc = 0;

function buildUI() {
  // tier tabs
  const tabsEl = $('tabs');
  tabsEl.innerHTML = '';
  for (const t of [1, 2, 3, 4, 5, 6]) {
    const b = document.createElement('button');
    b.className = 'tab';
    b.dataset.tier = String(t);
    b.innerHTML = `<span>${TIER_LABELS[t].split(' · ')[0]}</span><b>0/0</b>`;
    b.addEventListener('click', () => {
      tab = t; ensureAudio(); audio.sfx.ui(); updateUI(true);
    });
    tabsEl.appendChild(b);
    tabRefs.push({ el: b, tier: t, count: b.querySelector('b') });
  }

  // recipe grid
  const grid = $('grid');
  grid.innerHTML = '';
  cardRefs = [];
  for (const r of RECIPES) {
    const b = document.createElement('button');
    b.className = 'rcard';
    b.dataset.id = r.id;
    const cv = makeIconCanvas(ITEMS[r.id], 44);
    b.appendChild(cv);
    const nm = document.createElement('div'); nm.className = 'rname'; nm.textContent = r.name;
    const out = document.createElement('div'); out.className = 'rout'; out.textContent = '×0';
    const stat = document.createElement('div'); stat.className = 'rstat'; stat.textContent = '未解锁';
    const lock = document.createElement('span'); lock.className = 'lockmark'; lock.textContent = '锁';
    b.appendChild(nm); b.appendChild(out); b.appendChild(stat); b.appendChild(lock);
    b.addEventListener('click', () => onRecipeClick(r.id));
    grid.appendChild(b);
    cardRefs.push({ el: b, id: r.id, recipe: r, out, stat, lock });
  }

  // line cards
  const lc = $('linecards');
  lc.innerHTML = '';
  lineRefs = [];
  LINE_DEFS.forEach((L, i) => {
    const b = document.createElement('button');
    b.className = 'lcard';
    b.dataset.i = String(i);
    b.innerHTML =
      `<span class="lkey">${i + 1}</span>` +
      `<span class="ltop"><span class="lg" style="color:${L.color}">${L.glyph}</span>` +
      `<span class="lname">${L.name}</span></span>` +
      `<span class="llvl">Lv.0</span>` +
      `<span class="lrate"></span>` +
      `<span class="lcost"></span>`;
    b.addEventListener('click', () => {
      ensureAudio();
      selectedLine = i;
      upgradeLine(i);
    });
    lc.appendChild(b);
    lineRefs.push({
      el: b, i,
      lvl: b.querySelector('.llvl'),
      rate: b.querySelector('.lrate'),
      cost: b.querySelector('.lcost'),
    });
  });

  // detail delegation for quick buttons (rebuilt often)
  $('detail').addEventListener('pointerdown', (e) => {
    const btn = e.target && e.target.closest ? e.target.closest('button[data-q]') : null;
    if (!btn) return;
    e.preventDefault();
    ensureAudio();
    quickCraft(btn.dataset.q);
  });

  // fixed controls
  $('gatherbtn').addEventListener('pointerdown', (e) => {
    e.preventDefault();
    ensureAudio();
    gather();
  });
  $('overbtn').addEventListener('click', () => { ensureAudio(); overload(); });
  $('prestigebtn').addEventListener('click', onPrestigeClick);
  $('mutebtn').addEventListener('click', () => { ensureAudio(); toggleMute(); });
  $('pausebtn').addEventListener('click', () => { ensureAudio(); togglePause(); });
  $('startbtn').addEventListener('click', () => { ensureAudio(); audio.sfx.ui(); startGame(!hasSave); });
  $('retrybtn').addEventListener('click', () => { ensureAudio(); restartRun(); });
  $('homebtn').addEventListener('click', () => { ensureAudio(); audio.sfx.ui(); endToTitle(); });
  $('offclaim').addEventListener('click', () => {
    ensureAudio();
    const g = claimOffline();
    $('offline').classList.add('hide');
    setUiHidden(mode !== 'play');
    toast(`离线收益：素材 +${formatNum(g.mat)} · 精华 +${formatNum(g.ess)} · 金币 +${formatNum(g.gold)}`, 3200);
    audio.sfx.unlock(4);
  });
  $('offskip').addEventListener('click', () => {
    pendingOfflineSec = null;
    lastSeen = nowMs();
    $('offline').classList.add('hide');
    setUiHidden(mode !== 'play');
    saveGame(true);
  });

  // canvas tap near the pot gathers
  canvas.addEventListener('pointerdown', (e) => {
    if (mode !== 'play' || paused) return;
    ensureAudio();
    const { cx, cy, s } = renderer.scene;
    const dx = e.clientX - cx;
    const dy = e.clientY - (cy + 40 * s);
    if (Math.sqrt(dx * dx + dy * dy) < 210 * s) gather();
  });

  // initial sync
  $('mutebtn').textContent = muted ? '🔇' : '🔊';
  $('mutebtn').classList.toggle('on', muted);
}

function tierStats(t) {
  let total = 0, known = 0;
  for (const r of RECIPES) if (r.tier === t) { total++; if (discovered.has(r.id)) known++; }
  return { total, known };
}
function lineRateText(i) {
  const m = productionMul(prestige);
  const L = levels[i];
  if (i === 0) return L > 0 ? `+${(LINE_RATES.gatherMat * L * m).toFixed(1)} 素材/秒` : '未启用';
  if (i === 1) return L > 0 ? `-${(LINE_RATES.distillMat * L).toFixed(1)} 素材 → +${(LINE_RATES.distillEss * L * m).toFixed(2)} 精华/秒` : '未启用';
  if (i === 2) return L > 0 ? `-${(LINE_RATES.synthMat * L).toFixed(1)} 材 -${(LINE_RATES.synthEss * L).toFixed(2)} 精 → +${(LINE_RATES.synthGold * L * m).toFixed(0)} 金/秒` : '未启用';
  return L > 0 ? `-${(LINE_RATES.packEss * L).toFixed(2)} 精华 → +${(LINE_RATES.packGold * L * m).toFixed(0)} 金/秒` : '未启用';
}
function detailSignature() {
  const r = RECIPE_BY_ID[selectedRecipe];
  if (!r) return 'none';
  return `${selectedRecipe}|${discovered.size}|${levels.join(',')}|${prestige}|${r.inputs.map(([id]) => Math.round((items[id] || 0) * 10) / 10).join(',')}|${Math.round((items[r.id] || 0) * 10) / 10}|${mode === 'play'}`;
}
function renderDetail() {
  const el = $('detail');
  const r = RECIPE_BY_ID[selectedRecipe];
  if (!r) { el.innerHTML = '<div class="ddesc">从配方谱中选一张卡。</div>'; return; }
  const avail = isRecipeAvailable(r, discovered);
  const chk = canCraft(r.id);
  const known = discovered.has(r.id);
  const missing = r.req.filter(q => !discovered.has(q)).map(q => RECIPE_BY_ID[q].name);
  let stateText;
  if (!avail) stateText = `未解锁 · 需先炼成 ${missing.join('、')}`;
  else if (r.allRecipes && discovered.size < RECIPES.length - 1) stateText = `终局配方 · 还需录满其余 ${RECIPES.length - 1 - discovered.size} 张`;
  else if (chk.ok) stateText = '材料齐备 · 点击卡片或按 Q 炼成';
  else stateText = `材料不足 · ${chk.why}`;
  const inputHtml = r.inputs.map(([it, n]) => {
    const have = items[it] || 0;
    const cls = have + 1e-9 >= n ? 'ok' : 'no';
    return `<span class="${cls}"><i style="background:${ITEMS[it].color}"></i>${ITEMS[it].name} ${formatNum(have)}/${n}</span>`;
  }).join('') +
    `<span class="ok"><i style="background:${r.color}"></i>产出 ${r.name} ×${formatNum(items[r.id] || 0)}</span>`;
  const canQ = chk.ok;
  const wId = firstCraftable();
  const canW = !!wId;
  const canE = RECIPES.some(rr => (!rr.allRecipes || discovered.size >= RECIPES.length - 1) && canCraft(rr.id).ok);
  el.innerHTML =
    `<div class="dhead"><span class="dname" style="color:${r.color}">${r.name}</span>` +
    `<span class="dtier">${TIER_LABELS[r.tier]} · ${avail ? (known ? '已录' : '已解锁') : '未解锁'}</span></div>` +
    `<div class="ddesc">${r.desc}</div>` +
    `<div class="dinputs">${inputHtml}</div>` +
    `<div class="dstate">${stateText}</div>` +
    `<div id="quickrow">` +
    `<button data-q="q" class="${canQ ? '' : 'off'}">Q 炼选中</button>` +
    `<button data-q="w" class="${canW ? '' : 'off'}">W 首个可炼</button>` +
    `<button data-q="e" class="${canE ? '' : 'off'}">E 全部可炼</button>` +
    `</div>`;
}
function updateUI(force = false) {
  if (!force && uiAcc < 0.1) return;
  const set = (id, v) => { const n = $(id); if (n && n.textContent !== v) n.textContent = v; };
  set('resmat', formatNum(res.mat));
  set('resgold', formatNum(res.gold));
  set('resess', formatNum(res.ess));
  set('score', formatNum(scoreNow()));
  set('recnum', `${discovered.size}/36`);
  set('prest', String(prestige));
  const pv = Math.round(pressure);
  set('pval', `${pv} / ${MAX_PRESSURE}`);
  const pf = $('pfill');
  if (pf) pf.style.width = `${Math.max(0, Math.min(100, pressure))}%`;
  $('pressure').classList.toggle('danger', pressure >= 70);

  // tabs
  for (const t of tabRefs) {
    const st = tierStats(t.tier);
    t.el.classList.toggle('on', tab === t.tier);
    t.el.classList.toggle('done', st.total > 0 && st.known === st.total);
    const txt = `${st.known}/${st.total}`;
    if (t.count.textContent !== txt) t.count.textContent = txt;
  }

  // cards
  for (const c of cardRefs) {
    const r = c.recipe;
    const avail = isRecipeAvailable(r, discovered);
    const finalLock = !!r.allRecipes && discovered.size < RECIPES.length - 1;
    const known = discovered.has(r.id);
    const chk = canCraft(r.id);
    c.el.classList.toggle('hide', r.tier !== tab);
    c.el.classList.toggle('locked', !avail || finalLock);
    c.el.classList.toggle('known', known);
    c.el.classList.toggle('craft', avail && !finalLock && chk.ok);
    c.el.classList.toggle('sel', selectedRecipe === r.id);
    c.el.classList.toggle('final', !!r.final);
    const outTxt = `×${formatNum(items[r.id] || 0)}`;
    if (c.out.textContent !== outTxt) c.out.textContent = outTxt;
    const stTxt = !avail ? '未解锁' : finalLock ? '需全谱' : chk.ok ? '可炼' : known ? '已录' : '缺料';
    if (c.stat.textContent !== stTxt) c.stat.textContent = stTxt;
    c.lock.textContent = (!avail || finalLock) ? '锁' : '';
  }

  // line cards
  lineRefs.forEach((lr) => {
    const i = lr.i;
    const cost = lineCost(i);
    const max = levels[i] >= MAX_LEVEL;
    lr.el.classList.toggle('sel', selectedLine === i);
    lr.el.classList.toggle('max', max);
    lr.lvl.textContent = `Lv.${levels[i]}`;
    lr.rate.textContent = lineRateText(i);
    lr.cost.textContent = max ? '已满级' : `升级 ${costText(cost)}`;
    lr.cost.classList.toggle('no', !max && !canPay(cost));
  });

  // prestige
  const gain = prestigeGain();
  const pb = $('prestigebtn');
  if (pb) {
    pb.classList.toggle('off', gain <= 0);
    pb.innerHTML = gain > 0
      ? `转生 · 重铸炉心 <b>+${gain}</b>（当前传承 ${prestige}，输出 +${Math.round((productionMul(prestige) - 1) * 100)}%）`
      : `转生 · 需炼成 10 张配方（${discovered.size}/10）`;
  }
  const ob = $('overbtn');
  if (ob) ob.classList.toggle('off', !canCraft(selectedRecipe).ok);

  const hint = $('rechint');
  if (hint) {
    const st = tierStats(tab);
    hint.textContent = `${TIER_LABELS[tab].split(' · ')[0]} · 已录 ${st.known}/${st.total} · 点击卡片炼成`;
  }

  const sig = detailSignature();
  if (sig !== detailSig || force) { detailSig = sig; renderDetail(); }
  const oh = $('offhint');
  if (oh) {
    const g = computeOfflineGain(3600, { mat: 1e12, ess: 1e12 });
    oh.innerHTML = `离线满负荷/小时（上限 8 小时）：素材 <b>+${formatNum(g.gatherMat)}</b> · ` +
      `精华 <b>+${formatNum(g.distillEss)}</b> · 金币 <b>+${formatNum(g.gold)}</b>`;
  }
  syncPauseBtn();
  $('pausebanner').classList.toggle('hide', !(mode === 'play' && paused));
}

// ---------------------------------------------------------------- input
const pressed = new Set();
addEventListener('keydown', (e) => {
  if (e.isComposing || e.keyCode === 229) return;
  if (e.metaKey || e.altKey || e.ctrlKey) return;
  if (!e.repeat) pressed.add(e.code);
  if (e.code === 'Space' || e.code === 'Tab') e.preventDefault();
});
addEventListener('blur', () => pressed.clear());
document.addEventListener('visibilitychange', () => {
  pressed.clear();
  if (document.hidden) {
    if (mode === 'play' && !noAuto) saveGame(true);
  } else if (!noAuto) {
    maybeReturnOffline();
  }
});
function maybeReturnOffline() {
  if (AUTOTEST || !hasSave) return;
  if (!$('offline').classList.contains('hide')) return;
  const raw = Math.max(0, (nowMs() - lastSeen) / 1000);
  if (raw < 60) return;
  const g = computeOfflineGain(raw);
  if (g.mat + g.ess + g.gold > 0.01) {
    pendingOfflineSec = raw;
    showOffline(g, raw);
  }
}
function handleKeys() {
  for (const code of pressed) {
    if (code === 'Digit1' || code === 'Numpad1') selectOrUpgrade(0);
    else if (code === 'Digit2' || code === 'Numpad2') selectOrUpgrade(1);
    else if (code === 'Digit3' || code === 'Numpad3') selectOrUpgrade(2);
    else if (code === 'Digit4' || code === 'Numpad4') selectOrUpgrade(3);
    else if (code === 'KeyQ') quickCraft('q');
    else if (code === 'KeyW') quickCraft('w');
    else if (code === 'KeyE') quickCraft('e');
    else if (code === 'KeyP') togglePause();
    else if (code === 'KeyM') toggleMute();
    else if (code === 'Enter') {
      if (mode === 'title') startGame(!hasSave);
      else if (mode === 'over' || mode === 'complete') startGame(true);
    } else if (code === 'KeyR') {
      if (mode !== 'title') { ensureAudio(); startGame(true); }
    }
  }
  pressed.clear();
}
function selectOrUpgrade(i) {
  ensureAudio();
  if (mode !== 'play') { selectedLine = i; updateUI(true); return; }
  if (selectedLine === i) upgradeLine(i);
  else { selectedLine = i; audio.sfx.ui(); updateUI(true); }
}

// ---------------------------------------------------------------- update / loop
function update(dt) {
  simTime += dt;
  if (pressure >= MAX_PRESSURE) { explode(); return; }
  produce(dt);
  pressure = Math.max(0, pressure - 2.5 * dt);
  if (hitstop > 0) { hitstop = Math.max(0, hitstop - dt); }
  else {
    updateParticles(dt);
    updateBubbles(dt);
    ambient(dt);
  }
  if (shakeT > 0) shakeT = Math.max(0, shakeT - dt);
  if (flashT > 0) flashT = Math.max(0, flashT - dt);
  if (craftPulse > 0) craftPulse = Math.max(0, craftPulse - dt * 1.8);
  if (gatherPulse > 0) gatherPulse = Math.max(0, gatherPulse - dt * 2.2);
  if (pressure >= 70) audio.setState('tense');
  else if (mode === 'play') audio.setState('play');
  audio.tick();
  if (simTime - lastProgressAt >= 12 && !noAuto) postProgress(false);
  if (!noAuto && simTime - lastSaveAt >= 8 && !AUTOTEST) saveGame();
}
function makeView() {
  return {
    mode, paused, pressure, levels, prestige, discoveredCount: discovered.size,
    totalCrafts, bubbles, particles, floats,
    shakeT, shakeAmp, flashT, craftPulse, gatherPulse,
    time: (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000,
  };
}
let last = performance.now(), acc = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const raw = (now - last) / 1000;
  last = now;
  if (document.hidden) { acc = 0; return; }
  const dt = Math.max(0, Math.min(0.12, raw));
  handleKeys();
  if (mode === 'play' && !paused && !noAuto) {
    acc += dt;
    let steps = 0;
    while (acc >= DT && steps < 6) { update(DT); acc -= DT; steps++; }
    if (steps >= 6) acc = 0;
  } else {
    acc = 0;
    audio.tick();
  }
  renderer.draw(makeView());
  uiAcc += dt;
  if (uiAcc >= 0.1) { uiAcc = 0; updateUI(false); }
}

// ---------------------------------------------------------------- G hooks
const G = {
  err: window.__BOOTERR,
  DT,
  step: (n = 60, dt = DT) => {
    for (let i = 0; i < n; i++) {
      handleKeys();
      if (mode === 'play' && !paused) update(dt);
      renderer.draw(makeView());
    }
    updateUI(true);
  },
  upd: (n = 30, dt = DT) => {
    for (let i = 0; i < n; i++) {
      handleKeys();
      if (mode === 'play' && !paused) update(dt);
    }
    updateUI(true);
  },
  press: (...codes) => codes.forEach(c => pressed.add(c)),
  clearKeys: () => pressed.clear(),
  setNoAuto: (v) => { noAuto = !!v; },
  setReportTarget: (fn) => { reportTarget = typeof fn === 'function' ? fn : null; },
  state: () => ({
    mode, paused, noAuto, autotest: AUTOTEST, mute: muted, best,
    mat: res.mat, gold: res.gold, ess: res.ess,
    score: scoreNow(), progress: progressPct(),
    recipesTotal: RECIPES.length, discoveredCount: discovered.size,
    discovered: [...discovered],
    items: { ...items }, levels: levels.slice(),
    totalCrafts, totalUpgrades, pressure,
    prestige, prestigeMult: productionMul(prestige),
    selectedLine, selectedRecipe, tab,
    offlineCap: OFFLINE_CAP, pendingOfflineSec, lastSeen, now: nowMs(),
    simTime, nan: nanFlag,
    reports: reports.length, reportKinds: reports.map(r => r.kind),
    lastOffline,
  }),
  startGame: (fresh = true) => startGame(fresh),
  toTitle,
  togglePause,
  toggleMute,
  setMuted,
  gather,
  selectLine,
  upgradeLine,
  lineCost,
  selectRecipe,
  craft,
  canCraft,
  available,
  itemCount,
  grantItem,
  setDiscovered,
  unlockAll,
  craftSelected,
  quickCraft,
  craftAllPossible,
  overload,
  forceFail,
  forceComplete,
  forceWin: forceComplete,
  prestige: doPrestige,
  prestigeGain,
  setRes,
  addRes,
  setLineLevel,
  setPressure,
  setPrestige,
  setOfflineSeconds: (s) => { pendingOfflineSec = Math.max(0, Number(s) || 0); return pendingOfflineSec; },
  clearOfflineSeconds: () => { pendingOfflineSec = null; },
  applyOffline: (s) => applyOffline(s),
  claimOffline: () => claimOffline(),
  computeOfflineGain,
  setNow: (ms) => setClock(ms),
  now: () => nowMs(),
  setLastSeen: (ms) => { const v = Number(ms); if (Number.isFinite(v)) lastSeen = v; return lastSeen; },
  getLastSeen: () => lastSeen,
  saveNow: () => saveGame(true),
  loadSave: loadSaved,
  hardReset,
  resetRun: (keep = true) => resetRun(keep),
  reportProgress: (force = true) => { postProgress(!!force); return progressPct(); },
  reportLog: () => reports.slice(),
  scoreNow,
  progressPct,
  audio,
  renderer,
  defs: {
    RECIPES, RECIPE_BY_ID, ITEMS, LINE_DEFS, LINE_RATES,
    MAX_LEVEL, OFFLINE_CAP, MAX_PRESSURE, OVERLOAD_PRESSURE,
  },
};
window.G = G;
window.__G = G;
window.addEventListener('error', (e) => { if (G.err) G.err.push(String(e.message || e)); });

// ---------------------------------------------------------------- autotest
const nap = () => new Promise((r) => {
  const mc = new MessageChannel();
  mc.port1.onmessage = () => r();
  mc.port2.postMessage(0);
});

async function autotest() {
  const results = [];
  const T = window.__TEST = { pass: 0, fail: 0, total: 0, results, done: false };
  const ok = (id, cond, name) => {
    const good = !!cond;
    results.push({ id, ok: good, name });
    if (good) T.pass++; else T.fail++;
    if (!good) console.log(`[autotest] FAIL ${id}: ${name}`);
  };
  const S = () => G.state();
  const approx = (a, b, eps = 0.05) => Math.abs(a - b) <= eps;
  const saved = {};
  G.setNoAuto(true);
  audio.setMuted(true);
  for (const k of savedKeys) { try { saved[k] = localStorage.getItem(k); localStorage.removeItem(k); } catch (e) { saved[k] = null; } }
  const frames = [];
  G.setReportTarget(f => frames.push(f));
  G.hardReset();
  G.setNoAuto(true);
  G.startGame(true);
  await nap();

  // T1 boot clean
  ok(1, (window.__BOOTERR || []).length === 0 && G.err.length === 0, '启动零报错（BOOTERR 与 G.err 均为空）');

  // T2 starting economy / state
  {
    const s = S();
    ok(2, s.mode === 'play' && s.mat === 12 && s.levels.every(l => l === 0) &&
      s.discoveredCount === 0 && s.recipesTotal === 36 &&
      Number.isFinite(s.score), '开局：素材 12、四线 Lv.0、配方 0/36');
  }

  // T3 no NaN after idle frames
  G.upd(600);
  {
    const s = S();
    const finite = Number.isFinite(s.mat) && Number.isFinite(s.gold) && Number.isFinite(s.ess) &&
      Number.isFinite(s.score) && Number.isFinite(s.pressure) && s.levels.every(Number.isFinite) && !s.nan;
    ok(3, finite, '空转 600 帧资源/炉压/得分均为有限数');
  }

  // T4 data tree integrity
  {
    const R = G.defs.RECIPES;
    const sigs = new Set();
    let uniq = true, reqsOk = true;
    const ids = new Set(R.map(r => r.id));
    const tiers = new Set();
    for (const r of R) {
      const sig = r.inputs.map(([id, n]) => id + 'x' + n).sort().join('+');
      if (sigs.has(sig)) uniq = false;
      sigs.add(sig);
      tiers.add(r.tier);
      for (const q of r.req) if (!ids.has(q)) reqsOk = false;
    }
    ok(4, R.length === 36 && uniq && reqsOk && tiers.size === 6, '配方表 36 条、输入组合唯一、依赖引用完整且覆盖六阶');
  }

  // T5 progressive unlocking
  G.startGame(true);
  ok(5, G.available('mist') && G.available('mire') && G.available('soot') &&
    !G.available('dew') && !G.available('crucible'), '初始仅薄雾/泥沼/炭末开放，晨露与终局锁定');

  // T6 craft consumes inputs / yields output
  {
    G.startGame(true);
    G.grantItem('water', 5); G.grantItem('ash', 5);
    const w0 = G.itemCount('water'), a0 = G.itemCount('ash');
    const r = G.craft('mist');
    const s = S();
    ok(6, r.ok && G.itemCount('water') === w0 - 1 && G.itemCount('ash') === a0 - 1 &&
      G.itemCount('mist') === 1 && s.discoveredCount === 1 && s.totalCrafts === 1,
      '薄雾炼成：水滴-1、灰烬-1、薄雾+1、配方录入 1 张');
  }

  // T7 first-discovery bonus only once
  {
    G.startGame(true); G.setRes({ mat: 0, gold: 0, ess: 0 });
    G.grantItem('water', 8); G.grantItem('ash', 8);
    G.craft('mist');
    const gold1 = S().gold;
    G.craft('mist');
    const gold2 = S().gold;
    ok(7, gold1 === 18 && gold2 === 18, `首次录得奖励 18 金仅发一次（${gold1} → ${gold2}）`);
  }

  // T8 locked recipe cannot be crafted or consume inputs
  {
    G.startGame(true);
    const w0 = G.itemCount('water');
    const r = G.craft('dew');
    ok(8, !r.ok && G.itemCount('water') === w0 && S().discoveredCount === 0, '锁定配方无法炼成且不扣材料');
  }

  // T9 child unlocks after parent discovery
  {
    G.startGame(true); G.grantItem('water', 4); G.grantItem('ash', 4);
    G.craft('mist');
    ok(9, G.available('dew') && !G.available('ember'), '炼成薄雾后晨露解锁，余烬仍锁定（树状逐级开放）');
  }

  // T10 resource setter / add / deduct
  {
    G.setRes({ mat: 100, gold: 50, ess: 10 });
    G.addRes('gold', -30);
    G.addRes('mat', 5);
    const s = S();
    ok(10, s.gold === 20 && s.mat === 105 && s.ess === 10, '资源增减：金币 50-30=20、素材 100+5=105');
  }

  // T11 upgrade cost deduction and escalation
  {
    G.startGame(true); G.setRes({ mat: 1000, gold: 1000, ess: 1000 });
    const c0 = G.lineCost(0).gold;
    const g0 = S().gold;
    const up = G.upgradeLine(0);
    const c1 = G.lineCost(0).gold;
    ok(11, up && S().levels[0] === 1 && approx(S().gold, g0 - c0, 1e-6) && c1 > c0,
      `采集线升级扣 ${c0} 金且下一级更贵（${c0}→${c1}）`);
  }

  // T12 insufficient upgrade rejected
  {
    G.setRes({ mat: 0, gold: 0, ess: 0 });
    const lv0 = S().levels[1];
    const up = G.upgradeLine(1);
    ok(12, !up && S().levels[1] === lv0, '资源不足时升级被拒且等级不变');
  }

  // T13 level cap clamp
  {
    G.setLineLevel(0, 99);
    const atCap = S().levels[0] === G.defs.MAX_LEVEL;
    G.setRes({ mat: 1e9, gold: 1e9, ess: 1e9 });
    const up = G.upgradeLine(0);
    ok(13, atCap && !up && S().levels[0] === G.defs.MAX_LEVEL, `产线等级上限 ${G.defs.MAX_LEVEL} 且满级拒绝升级`);
  }

  // T14 gather line output math
  {
    G.startGame(true); G.setPrestige(0);
    G.setLineLevel(0, 2); G.setRes({ mat: 0, gold: 0, ess: 0 });
    G.upd(600);                                  // exactly 10 s
    ok(14, approx(S().mat, 48, 0.2), `采集线 Lv.2 × 10 秒 = 48 素材（实得 ${S().mat.toFixed(2)}）`);
  }

  // T15 distill line consumes material, makes essence
  {
    G.startGame(true); G.setPrestige(0);
    G.setLineLevel(1, 2); G.setRes({ mat: 100, gold: 0, ess: 0 });
    G.upd(600);
    const s = S();
    ok(15, approx(s.mat, 60, 0.2) && approx(s.ess, 8.4, 0.1), `蒸馏 Lv.2 × 10 秒：素材 100→60、精华 0→8.4（实得 ${s.ess.toFixed(2)}）`);
  }

  // T16 synth line consumes both, makes gold
  {
    G.startGame(true); G.setPrestige(0);
    G.setLineLevel(2, 2); G.setRes({ mat: 100, gold: 0, ess: 50 });
    G.upd(600);
    const s = S();
    ok(16, approx(s.mat, 78, 0.2) && approx(s.ess, 44.8, 0.1) && approx(s.gold, 220, 0.5),
      `合成 Lv.2 × 10 秒：材-22、精-5.2、金+220（实得 ${s.gold.toFixed(1)}）`);
  }

  // T17 pack line consumes essence, makes gold
  {
    G.startGame(true); G.setPrestige(0);
    G.setLineLevel(3, 2); G.setRes({ mat: 0, gold: 0, ess: 50 });
    G.upd(600);
    const s = S();
    ok(17, approx(s.ess, 46.4, 0.1) && approx(s.gold, 480, 0.5), `封装 Lv.2 × 10 秒：精-3.6、金+480（实得 ${s.gold.toFixed(1)}）`);
  }

  // T18 starvation never produces negative resources
  {
    G.startGame(true); G.setPrestige(0);
    G.setLineLevel(1, 3); G.setLineLevel(2, 2); G.setLineLevel(3, 1);
    G.setRes({ mat: 1, gold: 0, ess: 0 });
    G.upd(600);
    const s = S();
    ok(18, s.mat >= 0 && s.ess >= 0 && s.gold > 0 && Number.isFinite(s.ess) && s.ess <= 0.22,
      '原料不足时产线降载，资源不会被扣成负数');
  }

  // T19 pause freezes production and sim time
  {
    G.startGame(true); G.setLineLevel(0, 2); G.setRes({ mat: 0, gold: 0, ess: 0 });
    G.press('KeyP'); G.upd(2);
    const p0 = S();
    G.upd(180);
    const p1 = S();
    G.press('KeyP'); G.upd(60);
    const p2 = S();
    ok(19, p0.paused && p1.mat === p0.mat && p1.simTime === p0.simTime &&
      !p2.paused && p2.mat > p1.mat, '暂停冻结素材与 simTime，恢复后继续产出');
  }

  // T20 keyboard input path: line switch + Q craft
  {
    G.startGame(true); G.setRes({ mat: 1000, gold: 1000, ess: 1000 });
    G.grantItem('water', 4); G.grantItem('ash', 4);
    G.press('Digit2'); G.upd(1);
    const line = S().selectedLine;
    G.selectRecipe('mist');
    const c0 = S().totalCrafts;
    G.press('KeyQ'); G.upd(1);
    const c1 = S().totalCrafts;
    ok(20, line === 1 && c1 === c0 + 1, `键盘输入：Digit2 选中蒸馏线、Q 炼成计 +1（${c0}→${c1}）`);
  }

  // T21 W / E quick craft
  {
    G.startGame(true); G.setRes({ mat: 5000, gold: 5000, ess: 5000 });
    G.grantItem('water', 30); G.grantItem('ash', 30); G.grantItem('mire', 10); G.grantItem('soot', 10);
    const c0 = S().totalCrafts;
    G.press('KeyW'); G.upd(1);
    const c1 = S().totalCrafts;
    G.press('KeyE'); G.upd(1);
    const c2 = S().totalCrafts;
    ok(21, c1 > c0 && c2 > c1, `快捷合成：W 首炼（${c0}→${c1}）、E 连炼（${c1}→${c2}）`);
    G.press('Digit1'); G.upd(1);
  }

  // T22 touch pointer binding on gather button
  {
    G.startGame(true);
    const w0 = G.itemCount('water'), a0 = G.itemCount('ash');
    $('gatherbtn').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch', pointerId: 77 }));
    G.upd(1);
    ok(22, G.itemCount('water') === w0 + 2 && G.itemCount('ash') === a0 + 2,
      '触屏 pointerdown 采撷：水滴+2、灰烬+2');
  }

  // T23 offline earnings exact math
  {
    G.startGame(true); G.setPrestige(0);
    [0, 1, 2, 3].forEach(i => G.setLineLevel(i, 2));
    G.setRes({ mat: 100, gold: 0, ess: 20 });
    const g = G.computeOfflineGain(3600);
    const goldOk = approx(g.gold, 202600, 1);
    const matOk = approx(g.mat, -100, 1e-6);
    const essOk = approx(g.ess, 1023.6363636, 0.01);
    G.applyOffline(3600);
    const s = S();
    ok(23, goldOk && matOk && essOk && approx(s.gold, 202600, 1) &&
      approx(s.mat, 0, 0.01) && approx(s.ess, 1043.6363636, 0.01),
      `离线 1 小时精确产出：金 +202600、素材净 -100、精华净 +1023.64（实得金 ${s.gold.toFixed(1)}）`);
  }

  // T24 offline cap = 8 hours
  {
    G.setRes({ mat: 100, gold: 0, ess: 20 });
    const a = G.computeOfflineGain(10 * 3600);
    const b = G.computeOfflineGain(8 * 3600);
    ok(24, a.capped && a.sec === 8 * 3600 && approx(a.gold, b.gold, 1e-6) &&
      approx(a.ess, b.ess, 1e-6) && approx(a.mat, b.mat, 1e-6), '离线收益封顶 8 小时（10 小时 = 8 小时收益）');
  }

  // T25 setOfflineSeconds + setNow + claim
  {
    G.startGame(true); G.setPrestige(0);
    G.setLineLevel(0, 1); G.setRes({ mat: 0, gold: 0, ess: 0 });
    G.setNow(Date.now() + 123456);
    const now0 = G.now();
    G.setOfflineSeconds(1800);                    // 30 min at 2.4/s = 4320
    const before = G.getLastSeen();
    const g = G.claimOffline();
    const s = S();
    ok(25, approx(g.gold, 0, 1e-9) && approx(g.mat, 4320, 0.05) && approx(s.mat, 4320, 0.05) &&
      s.pendingOfflineSec === null && s.lastSeen > before && now0 > 1e12,
      `G 设置离线 1800 秒：素材 +4320（实得 ${s.mat.toFixed(1)}），时间戳已推进`);
  }

  // T26 overload pressure -> explosion failure path
  {
    G.startGame(true);
    G.grantItem('water', 40); G.grantItem('ash', 40);
    G.selectRecipe('mist');
    const t0 = S().totalCrafts;
    const c0 = G.itemCount('mist');
    const r1 = G.overload();
    const p1 = S().pressure;
    frames.length = 0;
    G.overload(); G.overload(); G.overload();
    const s = S();
    const overFrame = frames.find(f => f.kind === 'gameOver');
    ok(26, r1.ok && p1 === G.defs.OVERLOAD_PRESSURE && G.itemCount('mist') === c0 + 12 &&
      s.totalCrafts === t0 + 12 && s.mode === 'over' && s.pressure === 100 && !!overFrame &&
      Number.isInteger(overFrame.score), '超载 +28 炉压、产出×3；四次超载炸炉进入 gameOver 并上报整数分数');
  }

  // T27 restart resets run, keeps prestige
  {
    G.setPrestige(3);
    G.startGame(true);
    const s = S();
    ok(27, s.mode === 'play' && s.pressure === 0 && s.mat === 12 && s.levels.every(l => l === 0) &&
      s.discoveredCount === 0 && s.prestige === 3 && s.prestigeMult > 1, '重开一炉：资源/炉压/产线/配方复位，传承 3 保留');
  }

  // T28 endgame -> complete, 36 recipes
  {
    frames.length = 0;
    G.startGame(true);
    G.unlockAll();
    G.grantItem('core', 1); G.grantItem('astral', 1);
    G.reportProgress();
    const beforeCount = S().discoveredCount;
    const r = G.craft('crucible');
    const s = S();
    ok(28, beforeCount === 35 && r.ok && s.mode === 'complete' && s.discoveredCount === 36 &&
      frames.some(f => f.kind === 'complete'), '35 张前置配方 + 星辉坩埚 → 36/36 并进入 complete');
  }

  // T29 report order: progress before complete, event present
  {
    const ip = frames.findIndex(f => f.kind === 'progress');
    const ic = frames.findIndex(f => f.kind === 'complete');
    ok(29, ip >= 0 && ic > ip && frames.some(f => f.kind === 'event'),
      `上报帧序 progress@${ip} → complete@${ic}，且含 discover event`);
  }

  // T30 ready is the first captured protocol frame
  {
    const log = G.reportLog();
    ok(30, log.length > 0 && log[0].kind === 'ready', 'ready 为模块首个上报帧');
  }

  // T31 best persistence
  {
    const s = S();
    let stored = 0;
    try { stored = parseInt(localStorage.getItem(BEST_KEY) || '0', 10) || 0; } catch (e) { stored = 0; }
    ok(31, s.mode === 'complete' && stored === s.best && s.best === s.score,
      `通关写入最高炼成值 localStorage（${stored}）`);
  }

  // T32 save / load roundtrip
  {
    G.startGame(true); G.setPrestige(1);
    G.setLineLevel(0, 3); G.setLineLevel(2, 2);
    G.setRes({ mat: 77, gold: 88, ess: 9 });
    G.grantItem('mist', 4); G.grantItem('water', 3);
    G.saveNow();
    G.setLineLevel(0, 0); G.setLineLevel(2, 0); G.setRes({ mat: 0, gold: 0, ess: 0 });
    G.grantItem('mist', -100);
    const loaded = G.loadSave();
    const s = S();
    ok(32, loaded && s.levels[0] === 3 && s.levels[2] === 2 && s.mat === 77 &&
      s.gold === 88 && s.ess === 9 && G.itemCount('mist') >= 4 && s.prestige === 1,
      '存档 cra.save 写读往返：产线/资源/物品/传承全部还原');
  }

  // T33 hard reset clears save + best
  {
    G.setRes({ mat: 999, gold: 999, ess: 999 });
    G.saveNow();
    G.hardReset();
    const s = S();
    let hasKey = false, bestKey = null;
    try { hasKey = localStorage.getItem(SAVE_KEY) !== null; bestKey = localStorage.getItem(BEST_KEY); } catch (e) { }
    ok(33, s.mode === 'title' && s.mat === 12 && s.discoveredCount === 0 && s.prestige === 0 &&
      !hasKey && bestKey === null, '清档：删除 cra.save/cra.best 并复位到标题全新状态');
    G.startGame(true);
  }

  // T34 long fast-forward, random input, no NaN / no errors
  {
    G.startGame(true); G.setPrestige(1);
    [0, 1, 2, 3].forEach(i => G.setLineLevel(i, 6));
    G.setRes({ mat: 500, gold: 500, ess: 500 });
    G.grantItem('water', 60); G.grantItem('ash', 60);
    const err0 = G.err.length;
    let bad = false;
    for (let i = 0; i < 6000; i++) {
      if (i % 97 === 0) G.press('Digit' + (1 + (i / 97) % 4));
      if (i % 131 === 0) G.gather();
      if (i % 419 === 0) G.quickCraft('e');
      G.upd(1);
      const s = S();
      if (!Number.isFinite(s.mat) || !Number.isFinite(s.gold) || !Number.isFinite(s.ess) ||
        !Number.isFinite(s.score) || !Number.isFinite(s.pressure) || s.mat < -1e-6 || s.ess < -1e-6 ||
        !Number.isFinite(s.simTime) || s.nan) { bad = true; break; }
      if (s.mode !== 'play') break;
    }
    ok(34, !bad && G.err.length === err0 && Number.isFinite(S().score),
      `6000 帧随机采撷/升级/连炼快进无 NaN、无负资源、无新报错（模式 ${S().mode}）`);
  }

  // T35 prestige math
  {
    G.startGame(true); G.setPrestige(0);
    G.setDiscovered(RECIPES.slice(0, 12).map(r => r.id));
    G.setLineLevel(0, 3); G.setRes({ mat: 500, gold: 500, ess: 500 });
    const gain = G.prestigeGain();
    const applied = G.prestige();
    const s = S();
    ok(35, gain > 0 && applied === gain && s.prestige === gain && s.prestigeMult > 1 &&
      s.levels.every(l => l === 0) && s.discoveredCount === 0,
      `转生 +${gain} 传承：产线/配方重置，输出倍率 ×${s.prestigeMult.toFixed(2)}`);
  }

  // T36 DOM shell and card count
  {
    const cards = document.querySelectorAll('.rcard').length;
    const tabs = document.querySelectorAll('.tab').length;
    const lines = document.querySelectorAll('.lcard').length;
    ok(36, cards === 36 && tabs === 6 && lines === 4 &&
      !!document.getElementById('startbtn') && !!document.getElementById('retrybtn') &&
      !!document.getElementById('homebtn') && !!document.getElementById('offclaim') &&
      !!document.getElementById('mutebtn') && !!document.getElementById('pausebtn'), 'DOM：36 配方卡 / 6 阶页签 / 4 产线卡 / 全部按钮齐备');
  }

  // T37 back to title
  G.toTitle();
  ok(37, S().mode === 'title' && !document.getElementById('title').classList.contains('hide'), '测完回到标题画面');

  // restore the player's real storage & state
  try {
    for (const k of savedKeys) {
      if (saved[k] === null || saved[k] === undefined) localStorage.removeItem(k);
      else localStorage.setItem(k, saved[k]);
    }
  } catch (e) { }
  G.setReportTarget(null);
  best = 0;
  try { best = parseInt(localStorage.getItem(BEST_KEY) || '0', 10) || 0; } catch (e) { best = 0; }
  let restored = false;
  try { restored = loadSaved(); } catch (e) { restored = false; }
  if (!restored) { resetRun(false); hasSave = false; }
  try { muted = localStorage.getItem(MUTE_KEY) === '1'; } catch (e) { muted = false; }
  audio.setMuted(muted);
  mode = 'title'; paused = false;
  showTitle(true); showEnd(false);
  syncTitle();
  updateUI(true);

  const pass = results.filter(r => r.ok).length;
  T.pass = pass; T.fail = results.length - pass; T.total = results.length;
  T.done = true;
  console.log(`[autotest] ${pass}/${results.length} passed`);
}

// ---------------------------------------------------------------- boot
buildUI();
if (!loadSaved()) {
  resetRun(true);
  hasSave = false;
}
best = (() => { try { return parseInt(localStorage.getItem(BEST_KEY) || '0', 10) || 0; } catch (e) { return 0; } })();
muted = (() => { try { return localStorage.getItem(MUTE_KEY) === '1'; } catch (e) { return false; } })();
audio.setMuted(muted);
$('mutebtn').textContent = muted ? '🔇' : '🔊';
$('mutebtn').classList.toggle('on', muted);
mode = 'title';
showTitle(true);
showEnd(false);
syncTitle();
updateUI(true);
requestAnimationFrame(frame);

if (AUTOTEST) {
  autotest();
} else {
  maybeOfflineOnBoot();
  if (AUTOSTART) startGame(!hasSave);
}
