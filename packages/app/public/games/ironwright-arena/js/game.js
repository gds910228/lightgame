// Ironwright Arena 锻甲机斗场 — 灯匠夜游 · 第 11 铺.
// A 2D Canvas mech foundry and three-boss arena. Build a rig out of six
// weapons, six armor plates and four thrusters; every choice changes the
// combat numbers. Fixed-step 60 Hz logic, procedural art, synthesized audio,
// site report bridge, G debug hooks and a ?autotest=1 suite.

import {
  VW, VH, ARENA, BOSSES, WEAPONS, ARMORS, THRUSTERS, DEFAULT_LOADOUT,
  START_COINS, REPAIR_COST, REPAIR_FRAC, BARRIER_COST, BARRIER_TIME,
  deriveStats, loadoutCost, partByKey, formatTime, clamp, angleDiff, arenaClamp,
} from './data.js';
import { createRenderer } from './renderer.js';
import { makeAudio } from './audio.js';

const DT = 1 / 60;
const TAU = Math.PI * 2;
const PARAMS = new URLSearchParams(location.search);
const AUTOTEST = PARAMS.has('autotest');
const AUTOSTART = PARAMS.get('autostart') === '1' || PARAMS.has('auto');
const MUTE_KEY = 'irw.mute';
const BEST_TIME_KEY = 'irw.bestTime';
const BEST_SCORE_KEY = 'irw.bestScore';
const AIM_KEY = 'irw.autoaim';
const FIRE_KEY = 'irw.autofire';
// 手动瞄准（鼠标 / 右摇杆）闲置多久后交还给自动瞄准
const MANUAL_AIM_HOLD = 1.2;

// ---------------------------------------------------------------- state
let mode = 'title';              // title | forge | combat | gameover | complete
let paused = false, noAuto = false;
let time = 0, runTime = 0, bossIndex = 0;
let coins = START_COINS, parts = 0, repairLeft = 0;
let loadout = { ...DEFAULT_LOADOUT };
let stats = deriveStats(loadout);
let player = null, boss = null;
let bullets = [], bossBullets = [], zones = [], slashes = [], particles = [], floats = [];
let shotsFired = 0, nanFlag = false, newBest = false;
let bestTime = 0, bestScore = 0;
let reportTarget = null;
const reports = [];
let hitstopT = 0, shakeT = 0, shakeAmp = 0, shakeX = 0, shakeY = 0, hurtFlash = 0;
let aimManualT = 99;             // 距上次手动瞄准输入的秒数
let autoAim = true, autoFire = false;
const TOUCHLIKE = (typeof matchMedia === 'function' && matchMedia('(pointer:coarse)').matches) || 'ontouchstart' in window;
try {
  autoAim = localStorage.getItem(AIM_KEY) !== '0';
  const savedFire = localStorage.getItem(FIRE_KEY);
  autoFire = savedFire === null ? TOUCHLIKE : savedFire === '1';
} catch (e) { }
// 正在手动瞄准：短期内碰过鼠标/右摇杆，或仍按住开火
const manualAimActive = () => aimManualT < MANUAL_AIM_HOLD || mouseDown || touchAim.active;
let touchMove = { x: 0, y: 0, mag: 0 };
let touchAim = { active: false, x: 0, y: 0 };
let touchFire = false;
let forgeStep = 0;
let toastTimer = 0, bannerTimer = 0;

const held = new Set();
const pressed = new Set();

try {
  bestTime = parseFloat(localStorage.getItem(BEST_TIME_KEY) || '0') || 0;
  bestScore = parseInt(localStorage.getItem(BEST_SCORE_KEY) || '0', 10) || 0;
} catch (e) { bestTime = 0; bestScore = 0; }
let muted = false;
try { muted = localStorage.getItem(MUTE_KEY) === '1'; } catch (e) { muted = false; }

const audio = makeAudio();
audio.setMuted(muted);

// ---------------------------------------------------------------- DOM
const cv = document.getElementById('gl');
const renderer = createRenderer(cv);
const titleEl = document.getElementById('title');
const forgeEl = document.getElementById('forge');
const pauseEl = document.getElementById('pause');
const endEl = document.getElementById('end');
const hudEl = document.getElementById('hud');
const touchEl = document.getElementById('touchui');
const toastEl = document.getElementById('toast');
const bannerEl = document.getElementById('banner');
const bannerMain = bannerEl.querySelector('.bmain');
const bannerSub = bannerEl.querySelector('.bsub');
const titleBestEl = document.getElementById('titlebest');
const forgeKickerEl = document.getElementById('forgeKicker');
const coinEl = document.getElementById('coinEl');
const partEl = document.getElementById('partEl');
const statList = document.getElementById('statList');
const bossPreviewEl = document.getElementById('bossPreview');
const confirmBtn = document.getElementById('confirmBtn');
const repairBtn = document.getElementById('repairBtn');
const muteBtn = document.getElementById('mutebtn');
const pauseBtn = document.getElementById('pausebtn');
const aimBtn = document.getElementById('aimbtn');
const fireBtn = document.getElementById('firebtn');
const hpFill = document.getElementById('hpfill');
const hpText = document.getElementById('hptext');
const energyFill = document.getElementById('energyfill');
const heatFill = document.getElementById('heatfill');
const heatText = document.getElementById('heattext');
const coreFill = document.getElementById('corefill');
const bossNameEl = document.getElementById('bossname');
const bossFill = document.getElementById('bossfill');
const bossIndexEl = document.getElementById('bossindex');
const timerEl = document.getElementById('timer');
const runCoinsEl = document.getElementById('runcoins');
const runPartsEl = document.getElementById('runparts');
const statusEl = document.getElementById('status');
const endhEl = document.getElementById('endh');
const endkickerEl = document.getElementById('endkicker');
const enddEl = document.getElementById('endd');
const retryBtn = document.getElementById('retrybtn');
const homeBtn = document.getElementById('homebtn');
const resumeBtn = document.getElementById('resumeBtn');
const restartBtn = document.getElementById('restartBtn');
const pauseHomeBtn = document.getElementById('pauseHome');
const startBtn = document.getElementById('startbtn');
const forgeHomeBtn = document.getElementById('forgeHome');
const joyMove = document.getElementById('joyMove');
const joyAim = document.getElementById('joyAim');
const tDash = document.getElementById('tdash');
const tGuard = document.getElementById('tguard');

// ---------------------------------------------------------------- protocol
function sendParent(payload) {
  try {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ source: 'lightgame', type: 'lightgame:report', payload }, '*');
    }
  } catch (e) { }
}
function report(kind, payload = {}) {
  const frame = { kind, ...payload };
  reports.push(frame);
  if (reportTarget) {
    try { reportTarget(frame); } catch (e) { }
    return;
  }
  let env;
  if (kind === 'progress') env = { kind: 'progress', data: { ...frame } };
  else if (kind === 'event') env = { kind: 'event', event: frame.event || frame.tag, data: { ...frame } };
  else if (kind === 'gameOver') env = { kind: 'gameOver', score: Math.round(frame.score) | 0, progress: { value: frame.progress }, data: { ...frame } };
  else if (kind === 'complete') env = { kind: 'complete', score: Math.round(frame.score) | 0 };
  else env = { ...frame };
  sendParent(env);
}
const scoreValue = () => Math.max(0, Math.round(parts * 100 + bossIndex * 1000 + coins));
const progressValue = () => Math.round(bossIndex / BOSSES.length * 100);

report('ready', { game: 'ironwright-arena', bosses: BOSSES.length });
try {
  if (window.parent && window.parent !== window) {
    window.parent.postMessage({ source: 'lightgame', type: 'lightgame:ready', gameId: 'ironwright-arena', v: 1 }, '*');
  }
} catch (e) { }

// ---------------------------------------------------------------- economy
function saveBest() {
  if (!(runTime > 0)) return;
  let changed = false;
  const t = Math.round(runTime * 1000) / 1000;
  if (!bestTime || t < bestTime) {
    bestTime = t; changed = true;
    try { localStorage.setItem(BEST_TIME_KEY, String(t)); } catch (e) { }
  }
  const sc = scoreValue();
  if (sc > bestScore) {
    bestScore = sc; changed = true;
    try { localStorage.setItem(BEST_SCORE_KEY, String(bestScore)); } catch (e) { }
  }
  if (changed) newBest = true;
  syncTitleBest();
}
function syncTitleBest() {
  if (!titleBestEl) return;
  titleBestEl.textContent = bestTime > 0
    ? `最佳通关 ${formatTime(bestTime)} · 最高分 ${bestScore.toLocaleString('en-US')}`
    : '尚无完整通关记录';
}
function setCoinsNow(v) { coins = Math.max(0, Math.round(Number(v) || 0)); }
function addCoins(n) { coins = Math.max(0, coins + Math.round(Number(n) || 0)); }
function addParts(n) { parts = Math.max(0, parts + Math.round(Number(n) || 0)); }

// ---------------------------------------------------------------- UI helpers
function toast(msg, ms = 1700) {
  if (!toastEl) return;
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), ms);
}
function banner(main, sub = '', ms = 2200) {
  if (!bannerEl) return;
  bannerMain.textContent = main;
  bannerSub.textContent = sub;
  bannerEl.classList.add('on');
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => bannerEl.classList.remove('on'), ms);
}
function setMuted(v) {
  muted = !!v;
  audio.setMuted(muted);
  if (muteBtn) { muteBtn.textContent = muted ? '🔇' : '🔊'; muteBtn.classList.toggle('on', muted); }
  try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch (e) { }
}
function toggleMute() { setMuted(!muted); audio.play('ui'); }
function setAutoAim(v, silent = false) {
  autoAim = !!v;
  try { localStorage.setItem(AIM_KEY, autoAim ? '1' : '0'); } catch (e) { }
  if (aimBtn) {
    aimBtn.textContent = autoAim ? '瞄·自动' : '瞄·手动';
    aimBtn.classList.toggle('on', autoAim);
    aimBtn.title = autoAim ? '自动瞄准：开启（G 切换）' : '自动瞄准：关闭（G 切换）';
  }
  if (!silent) toast(autoAim ? '自动瞄准：开启 · 1.2 秒不动鼠标/右摇杆后自动锁定 Boss' : '自动瞄准：关闭 · 完全手动瞄准');
}
function setAutoFire(v, silent = false) {
  autoFire = !!v;
  try { localStorage.setItem(FIRE_KEY, autoFire ? '1' : '0'); } catch (e) { }
  if (fireBtn) {
    fireBtn.textContent = autoFire ? '射·自动' : '射·手动';
    fireBtn.classList.toggle('on', autoFire);
    fireBtn.title = autoFire ? '自动开火：开启（F 切换）' : '自动开火：关闭（F 切换）';
  }
  if (!silent) toast(autoFire ? '自动开火：开启 · 自动瞄准锁定时持续射击' : '自动开火：关闭 · 手动开火（左键 / J / 右摇杆）');
}
function hideAllOverlays() {
  [titleEl, forgeEl, pauseEl, endEl].forEach(el => { if (el) el.classList.add('hide'); });
}
function showHud(on) { if (hudEl) hudEl.classList.toggle('hide', !on); }
function showTouch(on) {
  if (!touchEl) return;
  touchEl.classList.toggle('hide', !on);
}
function togglePause(force) {
  if (mode !== 'combat') return false;
  const next = typeof force === 'boolean' ? force : !paused;
  if (next === paused) return paused;
  paused = next;
  if (pauseEl) pauseEl.classList.toggle('hide', !paused);
  if (pauseBtn) pauseBtn.textContent = paused ? '▶' : '❚❚';
  audio.play('ui');
  return paused;
}

// ---------------------------------------------------------------- run setup
function makePlayer() {
  const p = {
    x: ARENA.cx, y: ARENA.cy + 175, r: 20,
    hp: stats.maxHp, maxHp: stats.maxHp,
    energy: stats.energyMax, energyMax: stats.energyMax,
    heat: 0, heatMax: stats.heatCap,
    core: 50,
    aim: -Math.PI / 2,
    fireCd: 0, overheatT: 0, dashT: 0, dashCd: 0, dashVX: 0, dashVY: 0,
    dashHit: false, invuln: 1.0, barrierT: 0, barrierMax: BARRIER_TIME,
    hurtCd: 0, targetSpeed: 0, hoverActive: stats.hover,
    weaponKey: loadout.weapon, armorKey: loadout.armor, thrusterKey: loadout.thruster,
  };
  return p;
}
function syncPlayerStats(keepHp = true) {
  if (!player) return;
  const oldMax = player.maxHp;
  player.maxHp = stats.maxHp;
  if (!keepHp) player.hp = stats.maxHp;
  else if (player.hp > player.maxHp) player.hp = player.maxHp;
  else if (player.hp > 0 && player.maxHp > oldMax) {
    // armor swaps do not grant free healing, but never lower a wounded pilot
    player.hp = Math.min(player.maxHp, player.hp);
  }
  player.heatMax = stats.heatCap;
  player.energyMax = stats.energyMax;
  player.energy = Math.min(player.energy, player.energyMax);
  player.heat = Math.min(player.heat, player.heatMax);
  player.weaponKey = loadout.weapon;
  player.armorKey = loadout.armor;
  player.thrusterKey = loadout.thruster;
  player.hoverActive = stats.hover;
}
function clearField() {
  bullets = []; bossBullets = []; zones = []; slashes = []; particles = []; floats = [];
  hitstopT = 0; shakeT = 0; shakeX = 0; shakeY = 0; hurtFlash = 0;
}
function beginNewRun() {
  mode = 'forge'; paused = false; bossIndex = 0; parts = 0; repairLeft = 0; runTime = 0;
  newBest = false; nanFlag = false; shotsFired = 0; aimManualT = 99;
  loadout = { ...DEFAULT_LOADOUT };
  stats = deriveStats(loadout);
  coins = START_COINS - stats.loadoutCost;
  player = makePlayer(); boss = null;
  clearField();
  hideAllOverlays(); showHud(false); showTouch(false); showForge(false);
  if (pauseEl) pauseEl.classList.add('hide');
  if (pauseBtn) pauseBtn.textContent = '❚❚';
  setMuted(muted);
  syncTitleBest();
  forgeStep = 0;
  audio.setState('forge');
  renderer.resize();
  updateForgeUI();
  return true;
}
function startFromTitle() {
  if (!AUTOTEST) audio.unlock();
  beginNewRun();
  audio.play('confirm');
}
function goTitle() {
  mode = 'title'; paused = false; boss = null; clearField();
  hideAllOverlays(); showHud(false); showTouch(false);
  if (titleEl) titleEl.classList.remove('hide');
  if (pauseEl) pauseEl.classList.add('hide');
  syncTitleBest();
  audio.setState('title');
}
function showForge(afterBoss) {
  mode = 'forge'; paused = false;
  if (forgeEl) forgeEl.classList.remove('hide');
  hideAllOverlays(); if (forgeEl) forgeEl.classList.remove('hide');
  showHud(false); showTouch(false);
  forgeKickerEl.textContent = afterBoss ? '整备台 · 战后维护' : '装配台 · 首战准备';
  updateForgeUI();
  renderer.resize();
  forgeStep = 0;
}
function enterForgeAfterBoss() {
  boss = null;
  clearField();
  if (player) {
    player.heat = 0; player.overheatT = 0; player.dashT = 0; player.barrierT = 0;
    player.fireCd = 0; player.dashCd = 0; player.energy = Math.min(player.energyMax, stats.energyMax);
    player.invuln = 0.8;
    player.x = ARENA.cx; player.y = ARENA.cy + 175; player.aim = -Math.PI / 2;
  }
  repairLeft = Math.max(repairLeft, 1);
  showForge(true);
  audio.setState('forge');
}

// ---------------------------------------------------------------- forge UI
const forgeLists = {};
function initForgeDom() {
  const slots = [
    ['weapon', WEAPONS, 'weaponList'],
    ['armor', ARMORS, 'armorList'],
    ['thruster', THRUSTERS, 'thrusterList'],
  ];
  for (const [slot, list, id] of slots) {
    const el = document.getElementById(id);
    if (!el) continue;
    forgeLists[slot] = el;
    el.innerHTML = list.map(p => {
      const meta = slot === 'weapon'
        ? `${p.dmg}${p.count > 1 ? '×' + p.count : ''} 伤害 · ${(1 / p.cd).toFixed(1)}/s · 热 ${p.heat}`
        : slot === 'armor'
          ? `结构 ${p.hp} · 减伤 ${p.armor} · 速 ${Math.round(p.speed * 100)}%`
          : `推力 ${Math.round(p.speed * 100)}% · 冲刺 ${Math.round(p.dash * 100)}% · CD ${p.cd.toFixed(2)}s`;
      return `<button class="pcard" data-slot="${slot}" data-key="${p.key}" type="button">
        <span class="pglyph">${p.glyph}</span>
        <span class="pbody"><span class="pname">${p.name}</span><span class="pmeta">${meta}</span></span>
        <span class="pprice">${p.price}</span>
      </button>`;
    }).join('');
    el.addEventListener('click', (e) => {
      const card = e.target.closest('.pcard');
      if (!card) return;
      if (!AUTOTEST) audio.unlock();
      selectPart(slot, card.dataset.key);
    });
  }
}
function selectPart(slot, key) {
  if (mode !== 'forge') return false;
  const list = slot === 'weapon' ? WEAPONS : slot === 'armor' ? ARMORS : THRUSTERS;
  const oldP = partByKey(slot, loadout[slot]);
  const newP = list.find(p => p.key === key);
  if (!newP) return false;
  if (newP.key === oldP.key) return true;
  const delta = oldP.price - newP.price;
  if (coins + delta < 0) {
    toast(`铸币不足：更换${newP.name}还需 ${-(coins + delta)} 铸币`);
    audio.play('ui');
    return false;
  }
  coins += delta;
  loadout[slot] = newP.key;
  stats = deriveStats(loadout);
  syncPlayerStats(true);
  audio.play('select');
  updateForgeUI();
  renderer.drawPreview(loadout, stats, time);
  return true;
}
function updateForgeUI() {
  if (!confirmBtn) return;
  coinEl.textContent = String(coins);
  partEl.textContent = String(parts);
  for (const slot of ['weapon', 'armor', 'thruster']) {
    const el = forgeLists[slot];
    if (!el) continue;
    el.querySelectorAll('.pcard').forEach(c => {
      c.classList.toggle('sel', c.dataset.key === loadout[slot]);
    });
  }
  const w = partByKey('weapon', loadout.weapon);
  const a = partByKey('armor', loadout.armor);
  const t = partByKey('thruster', loadout.thruster);
  const rows = [
    ['火力', `${stats.dmg}${stats.count > 1 ? ' × ' + stats.count : ''} / 发`, `${(1 / stats.fireDelay).toFixed(1)} 发/秒`],
    ['结构', `${stats.maxHp} HP`, `固定减伤 ${stats.armor}`],
    ['机动', `${stats.speed} px/s`, `重量 ${stats.weight}`],
    ['热量', `上限 ${stats.heatCap}`, `散热 ${stats.heatVent}/s`],
    ['冲刺', `${stats.dashSpeed} px/s`, `CD ${stats.dashCd.toFixed(2)}s · 耗能 ${stats.dashCost}`],
    ['部件', `${w.name}`, `${a.name} · ${t.name}`],
  ];
  statList.innerHTML = rows.map(r => `<div class="srow"><span>${r[0]}</span><b>${r[1]}</b><em>${r[2]}</em></div>`).join('');
  const nb = BOSSES[Math.min(bossIndex, BOSSES.length - 1)];
  bossPreviewEl.innerHTML = `<span class="bpno">${bossIndex + 1} / ${BOSSES.length}</span> ${nb.name} <small>${nb.en}</small>`;
  const canRepair = player && repairLeft > 0 && player.hp < stats.maxHp && coins >= REPAIR_COST;
  repairBtn.disabled = !canRepair;
  repairBtn.textContent = player && player.hp < stats.maxHp
    ? (repairLeft > 0 ? `维修 +${Math.round(stats.maxHp * REPAIR_FRAC)} HP · ${REPAIR_COST} 铸币` : '本场维修已用过')
    : '机体完好';
  confirmBtn.textContent = bossIndex > 0 ? `确认装配 · 挑战 ${BOSSES[bossIndex].name}` : '确认装配 · 点 火 出 击';
  confirmBtn.disabled = coins < 0;
  renderer.drawPreview(loadout, stats, time);
}
function doRepair() {
  if (mode !== 'forge' || !player) return false;
  if (player.hp >= stats.maxHp) { toast('机体结构完好，无需维修'); return false; }
  if (repairLeft <= 0) { toast('每场整备只能维修一次'); return false; }
  if (coins < REPAIR_COST) { toast(`铸币不足，维修需要 ${REPAIR_COST}`); return false; }
  coins -= REPAIR_COST;
  repairLeft--;
  const heal = Math.round(stats.maxHp * REPAIR_FRAC);
  player.hp = Math.min(stats.maxHp, player.hp + heal);
  audio.play('repair');
  toast(`维护完成：结构 +${heal}，消耗 ${REPAIR_COST} 铸币`);
  updateForgeUI();
  return true;
}

// ---------------------------------------------------------------- combat start
function makeBoss(def) {
  return {
    def, x: ARENA.cx, y: ARENA.cy - 118, r: def.r,
    hp: def.hp, maxHp: def.hp,
    angle: Math.PI / 2, flash: 0, time: 0, defeated: false,
    attack: null, nextAttack: 1.45, patternIdx: 0, enraged: false,
  };
}
function confirmLoadout() {
  if (mode !== 'forge') return false;
  if (coins < 0) { toast('铸币不足'); return false; }
  stats = deriveStats(loadout);
  syncPlayerStats(true);
  if (!player) player = makePlayer();
  player.x = ARENA.cx; player.y = ARENA.cy + 175; player.r = 20;
  player.energy = stats.energyMax; player.heat = 0; player.overheatT = 0;
  player.dashT = 0; player.dashCd = 0; player.barrierT = 0; player.invuln = 0.9;
  player.fireCd = 0; player.aim = -Math.PI / 2; player.core = Math.max(40, player.core);
  boss = makeBoss(BOSSES[bossIndex]);
  clearField();
  mode = 'combat'; paused = false;
  hideAllOverlays(); showHud(true); showTouch(isTouchDevice());
  if (pauseEl) pauseEl.classList.add('hide');
  aimManualT = 99;
  audio.setState('boss');
  banner(`${boss.def.name}`, `${boss.def.en} · 第 ${bossIndex + 1} / ${BOSSES.length} 战`, 2400);
  toast(boss.def.intro, 3200);
  updateHUD();
  return true;
}

// ---------------------------------------------------------------- input
function isTouchDevice() {
  try { return matchMedia('(pointer:coarse)').matches || (navigator.maxTouchPoints || 0) > 0; } catch (e) { return false; }
}
function maybeUnlock(e) {
  if (AUTOTEST) return;
  if (e && e.isTrusted === false) return;
  audio.unlock();
}
const moveKeys = { left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'], up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'] };
function keyAny(list) { return list.some(k => held.has(k)); }
function moveVector() {
  if (touchMove.mag > 0.08) {
    const m = Math.hypot(touchMove.x, touchMove.y) || 1;
    return { x: touchMove.x / m * Math.min(1, touchMove.mag), y: touchMove.y / m * Math.min(1, touchMove.mag), mag: Math.min(1, touchMove.mag) };
  }
  let x = (keyAny(moveKeys.right) ? 1 : 0) - (keyAny(moveKeys.left) ? 1 : 0);
  let y = (keyAny(moveKeys.down) ? 1 : 0) - (keyAny(moveKeys.up) ? 1 : 0);
  const m = Math.hypot(x, y);
  if (m > 0) { x /= m; y /= m; }
  return { x, y, mag: m > 0 ? 1 : 0 };
}
function handleInput() {
  if (pressed.has('KeyM')) toggleMute();
  if (pressed.has('KeyP')) togglePause();
  if (pressed.has('KeyR')) {
    if (mode === 'combat' || mode === 'gameover' || mode === 'complete' || paused) beginNewRun();
  }
  if (mode === 'title' && (pressed.has('Enter') || pressed.has('Space'))) startFromTitle();
  if (mode === 'combat' && !paused) {
    if (pressed.has('ShiftLeft') || pressed.has('ShiftRight') || pressed.has('KeyK')) triggerDash();
    if (pressed.has('KeyE')) triggerBarrier();
  }
  if (pressed.has('KeyG')) setAutoAim(!autoAim);
  if (pressed.has('KeyF')) setAutoFire(!autoFire);
  pressed.clear();
}
addEventListener('keydown', (e) => {
  const c = e.code;
  if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyJ', 'KeyK', 'KeyE', 'KeyP', 'KeyM', 'KeyR', 'KeyG', 'KeyF', 'ShiftLeft', 'ShiftRight', 'Enter'].includes(c)) {
    e.preventDefault();
  }
  if (['KeyJ', 'KeyK', 'KeyE', 'KeyP', 'KeyM', 'KeyR', 'KeyG', 'KeyF', 'ShiftLeft', 'ShiftRight', 'Enter', 'Space'].includes(c)) maybeUnlock(e);
  held.add(c);
  if (!e.repeat) pressed.add(c);
});
addEventListener('keyup', (e) => { held.delete(e.code); });
addEventListener('blur', () => { held.clear(); pressed.clear(); });

function updateAimFromClient(clientX, clientY) {
  if (!player || mode !== 'combat') return;
  const w = renderer.screenToWorld(clientX, clientY);
  player.aim = Math.atan2(w.y - player.y, w.x - player.x);
  aimManualT = 0;
}
cv.addEventListener('pointermove', (e) => {
  updateAimFromClient(e.clientX, e.clientY);
});
cv.addEventListener('pointerdown', (e) => {
  if (e.button !== 0 || mode !== 'combat' || paused) return;
  maybeUnlock(e);
  updateAimFromClient(e.clientX, e.clientY);
  if (e.pointerType === 'mouse' || e.pointerType === 'pen') {
    aimManualT = 0; mouseDown = true;
  } else {
    touchFire = true;
  }
  e.preventDefault();
});
function endFirePointer() { mouseDown = false; }
addEventListener('pointerup', (e) => { if (e.button === 0 || e.pointerType !== 'mouse') endFirePointer(); });
addEventListener('pointercancel', endFirePointer);
cv.addEventListener('contextmenu', e => e.preventDefault());
let mouseDown = false;

function bindStick(el, kind) {
  if (!el) return;
  let pid = null;
  const knob = el.querySelector('.knob');
  function setFrom(e) {
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const maxR = Math.max(18, Math.min(r.width, r.height) * .34);
    let dx = e.clientX - cx, dy = e.clientY - cy;
    const d = Math.hypot(dx, dy);
    if (d > maxR) { dx = dx / d * maxR; dy = dy / d * maxR; }
    const nx = dx / maxR, ny = dy / maxR;
    if (knob) knob.style.transform = `translate(${dx}px,${dy}px)`;
    if (kind === 'move') {
      touchMove.x = nx; touchMove.y = ny; touchMove.mag = Math.min(1, d / maxR);
    } else {
      touchAim.active = true; touchAim.x = nx; touchAim.y = ny;
      if (player) player.aim = Math.atan2(ny, nx);
      aimManualT = 0; touchFire = true;
    }
  }
  el.addEventListener('pointerdown', (e) => {
    e.preventDefault(); maybeUnlock(e);
    pid = e.pointerId;
    try { el.setPointerCapture(pid); } catch (err) { }
    el.classList.add('active');
    setFrom(e);
  });
  el.addEventListener('pointermove', (e) => { if (e.pointerId === pid) setFrom(e); });
  const up = (e) => {
    if (pid !== null && e.pointerId !== pid) return;
    pid = null;
    el.classList.remove('active');
    if (knob) knob.style.transform = 'translate(0,0)';
    if (kind === 'move') { touchMove = { x: 0, y: 0, mag: 0 }; }
    else { touchAim.active = false; touchFire = false; }
  };
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
}
bindStick(joyMove, 'move');
bindStick(joyAim, 'aim');
if (tDash) tDash.addEventListener('pointerdown', (e) => { e.preventDefault(); maybeUnlock(e); triggerDash(); });
if (tGuard) tGuard.addEventListener('pointerdown', (e) => { e.preventDefault(); maybeUnlock(e); triggerBarrier(); });
document.addEventListener('contextmenu', e => { if (e.target === cv) e.preventDefault(); });

// ---------------------------------------------------------------- combat actions
function emit(x, y, n, color, power = 1, kind = 'spark') {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return;
  for (let i = 0; i < n; i++) {
    if (particles.length > 340) particles.shift();
    const a = Math.random() * TAU;
    const sp = (40 + Math.random() * 220) * power;
    particles.push({
      x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (kind === 'ember' ? 35 : 0),
      life: .3 + Math.random() * .55, max: .85,
      color, size: 1.3 + Math.random() * 3.2, kind,
    });
  }
}
function addFloat(x, y, text, color = '#ffe2a4', size = 14) {
  if (floats.length > 20) floats.shift();
  floats.push({ x, y, text, color, size, life: .9, max: .9 });
}
function addShake(amp, t) { shakeAmp = Math.max(shakeAmp, amp); shakeT = Math.max(shakeT, t); }
function addHeat(n) {
  if (!player) return;
  player.heat += n;
  if (player.heat >= player.heatMax && player.overheatT <= 0) {
    player.heat = player.heatMax;
    player.overheatT = 1.2;
    addFloat(player.x, player.y - 50, '过热！', '#ff6a2e', 17);
    addShake(3, .18);
    toast('散热口过载 — 等待冷却', 1200);
    audio.play('overheat');
  }
}
function muzzlePoint() {
  return { x: player.x + Math.cos(player.aim) * 30, y: player.y + Math.sin(player.aim) * 30 };
}
function spawnPlayerBullet(a, speed, kind, dmg, extra = {}) {
  const m = muzzlePoint();
  bullets.push({
    x: m.x, y: m.y, px: m.x, py: m.y,
    vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
    kind, dmg, life: extra.life || 1.3,
    homing: !!extra.homing, splash: extra.splash || 0, splashR: extra.splashR || 0,
    target: boss,
  });
  if (bullets.length > 90) bullets.shift();
}
function tryFire() {
  if (mode !== 'combat' || paused || !player || !boss || boss.hp <= 0) return false;
  if (player.fireCd > 0 || player.overheatT > 0) return false;
  const w = partByKey('weapon', loadout.weapon);
  const a = player.aim;
  if (w.mode === 'melee') {
    player.fireCd = w.cd;
    addHeat(w.heat);
    shotsFired++;
    slashes.push({ x: player.x, y: player.y, a, r: w.range * .86, arc: w.arc, t: 0, max: .24 });
    audio.play('slash');
    addShake(2.5, .12);
    const d = Math.hypot(boss.x - player.x, boss.y - player.y);
    const ba = Math.atan2(boss.y - player.y, boss.x - player.x);
    if (d <= w.range + boss.r && Math.abs(angleDiff(ba, a)) <= w.arc * .55) {
      hitBoss(w.dmg, a);
      emit(player.x + Math.cos(a) * 100, player.y + Math.sin(a) * 100, 14, '#ffbd68', 1.2);
      addShake(5, .16); hitstopT = Math.max(hitstopT, .05);
    }
    // blades also swat nearby hostile rounds
    for (const b of bossBullets) {
      if (Math.hypot(b.x - player.x, b.y - player.y) < w.range && Math.abs(angleDiff(Math.atan2(b.y - player.y, b.x - player.x), a)) < w.arc * .6) {
        b.dead = true; emit(b.x, b.y, 4, '#ffd27a', .7);
      }
    }
    emit(muzzlePoint().x, muzzlePoint().y, 6, '#ff9a44', .8);
    return true;
  }
  if (w.mode === 'auto' || w.mode === 'beam') {
    player.fireCd = w.cd;
    addHeat(w.mode === 'beam' ? w.heat : w.heat);
    shotsFired++;
    const spread = w.spread || 0;
    const ang = a + (Math.random() - .5) * spread;
    spawnPlayerBullet(ang, w.mode === 'beam' ? 2400 : w.speed, w.mode === 'beam' ? 'beam' : 'auto', w.dmg, { life: w.mode === 'beam' ? .32 : 1.2 });
    emit(muzzlePoint().x, muzzlePoint().y, w.mode === 'beam' ? 4 : 3, '#ffe1a0', .7);
    audio.play(w.mode === 'beam' ? 'beam' : 'fireAuto');
    addShake(w.mode === 'beam' ? .8 : .7, .04);
    return true;
  }
  if (w.mode === 'shot') {
    player.fireCd = w.cd;
    addHeat(w.heat);
    shotsFired++;
    for (let i = 0; i < w.count; i++) {
      const t = w.count === 1 ? .5 : i / (w.count - 1);
      const ang = a + (t - .5) * w.spread + (Math.random() - .5) * .03;
      spawnPlayerBullet(ang, w.speed, 'pellet', w.dmg, { life: .7 });
    }
    emit(muzzlePoint().x, muzzlePoint().y, 16, '#ffb15a', 1.2);
    addShake(3.5, .1);
    audio.play('fireHeavy');
    return true;
  }
  if (w.mode === 'missile') {
    player.fireCd = w.cd;
    addHeat(w.heat);
    shotsFired++;
    spawnPlayerBullet(a, w.speed, 'missile', w.dmg, { homing: true, splash: w.splash, splashR: w.splashR, life: 2.8 });
    emit(muzzlePoint().x, muzzlePoint().y, 8, '#ff9a50', 1);
    audio.play('missile');
    addShake(1.8, .08);
    return true;
  }
  // pulse
  player.fireCd = w.cd;
  addHeat(w.heat);
  shotsFired++;
  spawnPlayerBullet(a, w.speed, 'pulse', w.dmg, { life: 1.2 });
  emit(muzzlePoint().x, muzzlePoint().y, 6, '#94e6d8', .8);
  audio.play('fireHeavy');
  addShake(1.4, .06);
  return true;
}
function triggerDash() {
  if (mode !== 'combat' || paused || !player) return false;
  if (player.dashCd > 0) { toast('推进器冷却中', 900); return false; }
  if (player.energy < stats.dashCost) { toast('推进能量不足', 900); return false; }
  const mv = moveVector();
  let ax = mv.mag > .05 ? mv.x : Math.cos(player.aim);
  let ay = mv.mag > .05 ? mv.y : Math.sin(player.aim);
  const m = Math.hypot(ax, ay) || 1;
  ax /= m; ay /= m;
  player.energy -= stats.dashCost;
  player.heat = Math.min(player.heatMax, player.heat + 6);
  player.dashT = .18; player.dashCd = stats.dashCd;
  player.dashVX = ax * stats.dashSpeed; player.dashVY = ay * stats.dashSpeed;
  player.dashHit = false;
  player.invuln = Math.max(player.invuln, .28);
  emit(player.x, player.y + 16, 12, '#ffc16a', 1.2, 'ember');
  audio.play('dash');
  addShake(2, .12);
  return true;
}
function triggerBarrier() {
  if (mode !== 'combat' || paused || !player) return false;
  if (player.barrierT > 0) return false;
  if (player.core < BARRIER_COST) { toast(`熔核不足：需要 ${BARRIER_COST}`, 1000); return false; }
  player.core -= BARRIER_COST;
  const shieldWeapon = partByKey('weapon', loadout.weapon).key === 'aegis';
  player.barrierMax = BARRIER_TIME * (shieldWeapon ? 1.55 : 1);
  player.barrierT = player.barrierMax;
  addShake(2.4, .16);
  emit(player.x, player.y, 18, '#8fe6d4', 1.1, 'ember');
  audio.play('barrier');
  toast(shieldWeapon ? '逆流屏障展开 — 反弹强化' : '熔核屏障展开', 1200);
  return true;
}
function hurtPlayer(amount, source = '') {
  if (mode !== 'combat' || paused || !player) return false;
  if (player.invuln > 0 || player.barrierT > 0) return false;
  const dmg = Math.max(1, Math.round(amount - stats.armor));
  player.hp -= dmg;
  player.invuln = .55;
  hurtFlash = Math.max(hurtFlash, .55);
  addShake(7, .28);
  hitstopT = Math.max(hitstopT, .07);
  addFloat(player.x, player.y - 38, `-${dmg}`, '#ff6b4a', 18);
  emit(player.x, player.y, 20, '#ff7548', 1.5);
  audio.play('hurt');
  if (player.hp <= 0) {
    player.hp = 0;
    loseGame(source);
  }
  return true;
}

// ---------------------------------------------------------------- boss logic
function beginBossAttack(kind) {
  if (!boss || mode !== 'combat') return false;
  const def = boss.def;
  const aim = Math.atan2(player.y - boss.y, player.x - boss.x);
  const table = {
    slam: { windup: 1.0, active: 0, total: 2.0 },
    radial: { windup: .8, active: 1.0, total: 2.05, volleys: boss.enraged ? 4 : 3, gap: .24, count: 12 },
    charge: { windup: 1.0, active: .46, total: 1.8 },
    sweep: { windup: 1.05, active: 1.55, total: 2.95, rate: boss.enraged ? 1.7 : 1.3 },
    cross: { windup: .95, active: .55, total: 2.1 },
    missiles: { windup: .9, active: 0, total: 2.55 },
    rain: { windup: .95, active: 0, total: 2.8 },
    nova: { windup: .95, active: 1.05, total: 2.55, volleys: 3, gap: .27, count: boss.enraged ? 26 : 20 },
  };
  const cfg = table[kind] || table.radial;
  const atk = {
    kind, t: 0, windup: cfg.windup, active: cfg.active, total: cfg.total,
    volleys: cfg.volleys || 0, gap: cfg.gap || .25, count: cfg.count || 12,
    rate: cfg.rate || 1.3, fired: 0, spawned: false, data: { angle: aim, zones: [] },
  };
  if (kind === 'sweep') {
    atk.data.angle = aim - .8;
  }
  if (kind === 'charge') {
    atk.data.speed = def.id === 'colossus' ? 690 : def.id === 'arbiter' ? 760 : 640;
  }
  boss.attack = atk;
  return true;
}
function endBossAttack() {
  if (!boss) return;
  boss.attack = null;
  const en = boss.enraged ? .62 : 1;
  boss.nextAttack = boss.def.interval * en + Math.random() * .28;
}
function spawnBossRound(a, speed, dmg, r = 6, kind = 'orb') {
  const ang = Number.isFinite(a) ? a : 0;
  bossBullets.push({
    x: boss.x, y: boss.y, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed,
    r, dmg, kind, life: 8, dead: false,
  });
  if (bossBullets.length > 240) bossBullets.shift();
}
function spawnZone(x, y, r, delay, dmg, seed = 0) {
  zones.push({ x, y, r, t: delay, delay, dmg, seed, blastT: 0, blastMax: .38 });
  if (zones.length > 24) zones.shift();
}
function fireRadial(count, speed, offset) {
  for (let i = 0; i < count; i++) {
    const a = offset + i / count * TAU;
    spawnBossRound(a, speed, 10, 6, 'orb');
  }
  emit(boss.x, boss.y, 16, '#ff9a50', 1.1);
  addShake(2.4, .12);
}
function updateBossAttack(dt) {
  const b = boss;
  const atk = b && b.attack;
  if (!atk) return;
  atk.t += dt;
  const active = atk.t - atk.windup;
  if (atk.kind === 'radial' || atk.kind === 'nova') {
    while (atk.fired < atk.volleys && atk.t >= atk.windup + atk.fired * atk.gap) {
      const cnt = atk.count + (atk.kind === 'nova' ? atk.fired * 2 : 0);
      const sp = atk.kind === 'nova' ? 150 + atk.fired * 32 : 178;
      fireRadial(cnt, sp, atk.fired * .23 + (atk.kind === 'nova' ? b.time * .2 : 0));
      atk.fired++;
    }
  }
  if ((atk.kind === 'slam' || atk.kind === 'missiles' || atk.kind === 'rain') && !atk.spawned && atk.t >= atk.windup) {
    atk.spawned = true;
    if (atk.kind === 'slam') {
      const offs = [[0, 0], [-120, 28], [120, 28]];
      for (let i = 0; i < offs.length; i++) {
        const p = arenaClamp(player.x + offs[i][0], player.y + offs[i][1], 36);
        spawnZone(p.x, p.y, 58, .68 + i * .06, 24, i);
      }
      addShake(4, .25);
      audio.play('boom');
    } else {
      const n = atk.kind === 'rain' ? (b.enraged ? 10 : 8) : 5;
      for (let i = 0; i < n; i++) {
        let x, y;
        if (i === 0) { x = player.x; y = player.y; }
        else {
          x = ARENA.cx + (Math.random() * 2 - 1) * ARENA.rx * .72;
          y = ARENA.cy + (Math.random() * 2 - 1) * ARENA.ry * .7;
        }
        const p = arenaClamp(x, y, 38);
        spawnZone(p.x, p.y, 56, 1.0 + (i % 3) * .08, 20, i + 30);
      }
      atk.data.zones = zones;
      audio.play('missile');
    }
  }
  if (atk.kind === 'sweep' && active >= 0 && active < atk.active) {
    const a = atk.data.angle + active * atk.rate;
    const px = player.x - b.x, py = player.y - b.y;
    const proj = px * Math.cos(a) + py * Math.sin(a);
    if (proj > 0) {
      const perp = Math.abs(-px * Math.sin(a) + py * Math.cos(a));
      if (perp < 24 + player.r) hurtPlayer(18, 'sweep');
    }
  }
  if (atk.kind === 'cross' && active >= 0 && active < atk.active) {
    if (Math.abs(player.x - b.x) < 30 + player.r || Math.abs(player.y - b.y) < 30 + player.r) hurtPlayer(20, 'cross');
  }
  if (atk.kind === 'charge' && active >= 0 && active < atk.active) {
    const a = atk.data.angle;
    b.x += Math.cos(a) * atk.data.speed * dt;
    b.y += Math.sin(a) * atk.data.speed * dt;
    const cl = arenaClamp(b.x, b.y, b.r * .72);
    b.x = cl.x; b.y = cl.y;
    if (!atk.data.hit && Math.hypot(player.x - b.x, player.y - b.y) < b.r + player.r + 6) {
      atk.data.hit = true;
      hurtPlayer(28, 'charge');
      emit(player.x - Math.cos(a) * 10, player.y - Math.sin(a) * 10, 22, '#ff8e4c', 1.8);
      addShake(8, .3);
      hitstopT = Math.max(hitstopT, .08);
    }
    if (Math.random() < .5) emit(b.x, b.y + 24, 2, '#ff9a50', .7, 'ember');
  }
  if (atk.t >= atk.total) endBossAttack();
}
function updateBoss(dt) {
  const b = boss;
  if (!b) return;
  b.time += dt;
  b.flash = Math.max(0, b.flash - dt);
  if (b.def.id === 'colossus' && !b.enraged && b.hp <= b.maxHp * .5) {
    b.enraged = true;
    banner('炉 心 过 载', '巨像的攻击节奏加快', 1800);
    toast('警告：铸世巨像进入过载状态', 2000);
    emit(b.x, b.y, 30, '#ffb04c', 1.7);
    addShake(7, .45);
    audio.play('overheat');
  }
  if (b.attack) {
    updateBossAttack(dt);
    if (mode !== 'combat' || boss !== b) return;
  } else {
    const desired = b.def.id === 'arbiter' ? 310 : b.def.id === 'colossus' ? 255 : 215;
    const dx = player.x - b.x, dy = player.y - b.y;
    const d = Math.hypot(dx, dy) || 1;
    let vx, vy;
    if (d > desired + 34) { vx = dx / d; vy = dy / d; }
    else if (d < desired - 62) { vx = -dx / d; vy = -dy / d; }
    else { vx = -dy / d; vy = dx / d; }
    const sp = b.def.speed * (b.enraged ? 1.35 : 1);
    b.x += vx * sp * dt; b.y += vy * sp * dt;
    const cl = arenaClamp(b.x, b.y, b.r * .62);
    b.x = cl.x; b.y = cl.y;
    b.nextAttack -= dt;
    if (b.nextAttack <= 0) {
      const patterns = b.def.patterns;
      beginBossAttack(patterns[b.patternIdx % patterns.length]);
      b.patternIdx++;
    }
  }
  const sep = b.r + player.r + 4;
  const ddx = player.x - b.x, ddy = player.y - b.y;
  const dd = Math.hypot(ddx, ddy);
  if (dd > 0 && dd < sep) {
    player.x = b.x + ddx / dd * sep;
    player.y = b.y + ddy / dd * sep;
    const pcl = arenaClamp(player.x, player.y, player.r + 8);
    player.x = pcl.x; player.y = pcl.y;
  }
}

// ---------------------------------------------------------------- damage
function hitBoss(dmg, angle) {
  if (!boss || boss.hp <= 0 || mode !== 'combat') return 0;
  const applied = Math.max(1, Math.round(dmg));
  boss.hp = Math.max(0, boss.hp - applied);
  boss.flash = .1;
  player.core = Math.min(100, player.core + applied * .16);
  const a = Number.isFinite(angle) ? angle : player.aim;
  addFloat(boss.x + (Math.random() - .5) * 40, boss.y - boss.r * .55, `${applied}`, '#ffe4a6', 14 + Math.min(7, applied * .08));
  emit(boss.x - Math.cos(a) * boss.r * .4, boss.y - Math.sin(a) * boss.r * .4, applied > 20 ? 14 : 5, '#ffc16a', applied > 20 ? 1.4 : .7);
  audio.play('bossHit');
  if (applied >= 20) { addShake(2.2, .09); hitstopT = Math.max(hitstopT, .04); }
  if (boss.hp <= 0) defeatBoss();
  return applied;
}
function defeatBoss() {
  if (!boss || boss.defeated || mode !== 'combat') return false;
  const b = boss;
  b.defeated = true; b.hp = 0;
  const def = b.def;
  coins += def.reward.coins;
  parts += def.reward.parts;
  bossIndex++;
  const final = bossIndex >= BOSSES.length;
  emit(b.x, b.y, 48, '#ffb15a', 2.3);
  emit(b.x, b.y, 22, '#ff6b36', 1.8, 'ember');
  addShake(12, .7);
  hitstopT = .1;
  audio.play('bossDown');
  report('event', { event: 'boss_down', boss: def.id, index: bossIndex });
  report('progress', {
    score: scoreValue(), progress: progressValue(), boss: bossIndex,
    coins, parts,
  });
  if (final) {
    runTime = Math.round(runTime * 1000) / 1000;
    mode = 'complete';
    paused = false;
    saveBest();
    boss = null;
    clearField();
    showHud(false); showTouch(false);
    if (pauseEl) pauseEl.classList.add('hide');
    if (endEl) endEl.classList.remove('hide');
    endkickerEl.textContent = 'THE FORGE IS QUIET';
    endhEl.textContent = '炉 心 已 熄';
    enddEl.innerHTML = `<div class="bigtime">${formatTime(runTime)}</div>
      <div>三座熔炉的看守全部倒下。零件 <b>${parts}</b> · 铸币 <b>${coins}</b></div>
      <div class="rec">${newBest ? '新 纪 录 · ' : ''}最佳通关 ${bestTime > 0 ? formatTime(bestTime) : '—'} · 最高分 ${bestScore.toLocaleString('en-US')}</div>`;
    retryBtn.textContent = '再 铸 一 轮';
    audio.play('win'); audio.setState('end');
    report('complete', { score: scoreValue(), bosses: bossIndex });
  } else {
    banner(`${def.name} 击 破`, `+${def.reward.coins} 铸币 · +${def.reward.parts} 零件`, 2600);
    toast(`缴获 ${def.reward.coins} 铸币与 ${def.reward.parts} 零件，返回整备台`, 2600);
    enterForgeAfterBoss();
    audio.setState('forge');
  }
  return true;
}
function loseGame(source) {
  if (mode !== 'combat') return false;
  mode = 'gameover'; paused = false;
  player.hp = 0;
  emit(player.x, player.y, 40, '#ff7040', 2.1);
  emit(player.x, player.y, 16, '#ffd27a', 1.4, 'ember');
  addShake(13, .8);
  hitstopT = .1;
  audio.play('lose'); audio.setState('end');
  showHud(false); showTouch(false);
  if (pauseEl) pauseEl.classList.add('hide');
  if (endEl) endEl.classList.remove('hide');
  endkickerEl.textContent = 'MELT CORE SILENT';
  endhEl.textContent = '熔 核 熄 灭';
  const nb = BOSSES[Math.min(bossIndex, BOSSES.length - 1)];
  enddEl.innerHTML = `<div class="bigtime">${bossIndex} / ${BOSSES.length}</div>
    <div>机体在「${nb.name}」面前解体。零件 <b>${parts}</b> · 铸币 <b>${coins}</b> 已记录。</div>
    <div class="rec">调整装甲或武器，再进锻炉。</div>`;
  retryBtn.textContent = '整 备 再 战';
  report('gameOver', {
    score: scoreValue(), progress: progressValue(), boss: bossIndex,
    coins, parts,
  });
  return true;
}

// ---------------------------------------------------------------- combat update
function updatePlayer(dt) {
  if (!player) return;
  player.fireCd = Math.max(0, player.fireCd - dt);
  player.dashCd = Math.max(0, player.dashCd - dt);
  player.invuln = Math.max(0, player.invuln - dt);
  player.barrierT = Math.max(0, player.barrierT - dt);
  player.hurtCd = Math.max(0, player.hurtCd - dt);
  if (player.overheatT > 0) {
    player.overheatT = Math.max(0, player.overheatT - dt);
    player.heat = Math.max(0, player.heat - 22 * dt);
    if (player.overheatT <= 0) player.heat = Math.min(player.heat, player.heatMax * .35);
  } else {
    player.heat = Math.max(0, player.heat - stats.heatVent * dt);
  }
  player.energy = Math.min(stats.energyMax, player.energy + stats.energyRegen * dt);
  aimManualT = Math.min(99, aimManualT + dt);
  if (autoAim && !manualAimActive() && boss && boss.hp > 0) {
    // 自动瞄准：接管炮口，指向 Boss（手动瞄准闲置 1.2 秒后生效）
    player.aim = Math.atan2(boss.y - player.y, boss.x - player.x);
  }
  const mv = moveVector();
  if (player.dashT > 0) {
    player.dashT = Math.max(0, player.dashT - dt);
    player.x += player.dashVX * dt;
    player.y += player.dashVY * dt;
    if (stats.dashDamage && !player.dashHit && boss && boss.hp > 0) {
      if (Math.hypot(player.x - boss.x, player.y - boss.y) < boss.r + player.r + 10) {
        player.dashHit = true;
        hitBoss(stats.dashDamage, Math.atan2(player.dashVY, player.dashVX));
        emit(player.x, player.y, 14, '#ffb15a', 1.5);
        addShake(5, .18);
      }
    }
    if (Math.random() < .7) emit(player.x, player.y + 14, 1, '#ffc575', .5, 'ember');
  } else {
    player.targetSpeed = mv.mag * stats.speed;
    if (mv.mag > 0) {
      player.x += mv.x * stats.speed * dt;
      player.y += mv.y * stats.speed * dt;
    }
  }
  const cl = arenaClamp(player.x, player.y, player.r + 10);
  player.x = cl.x; player.y = cl.y;
  player.hoverActive = !!stats.hover;
  const autoFireOn = autoFire && autoAim && !manualAimActive();
  if (mouseDown || touchFire || held.has('KeyJ') || autoFireOn) tryFire();
}
function updateBullets(dt) {
  for (const b of bullets) {
    b.px = b.x; b.py = b.y;
    if (b.homing && boss && boss.hp > 0) {
      const want = Math.atan2(boss.y - b.y, boss.x - b.x);
      const cur = Math.atan2(b.vy, b.vx);
      const diff = angleDiff(want, cur);
      const na = cur + clamp(diff, -4.2 * dt, 4.2 * dt);
      const sp = Math.hypot(b.vx, b.vy);
      b.vx = Math.cos(na) * sp; b.vy = Math.sin(na) * sp;
    }
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    if (boss && boss.hp > 0 && segmentCircle(b.px, b.py, b.x, b.y, boss.x, boss.y, boss.r + 4)) {
      b.dead = true;
      hitBoss(b.dmg, Math.atan2(b.vy, b.vx));
      if (b.splash) {
        emit(b.x, b.y, 18, '#ff9a50', 1.5);
        addShake(3, .12);
        audio.play('boom');
      } else {
        emit(b.x, b.y, 5, '#ffd27a', .7);
      }
    }
    if (b.x < -40 || b.x > VW + 40 || b.y < -40 || b.y > VH + 40 || b.life <= 0) b.dead = true;
  }
  bullets = bullets.filter(b => !b.dead);
  for (const b of bossBullets) {
    if (b.dead) continue;
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    const d = Math.hypot(b.x - player.x, b.y - player.y);
    if (player.barrierT > 0 && d < 100 + b.r) {
      b.dead = true;
      const w = partByKey('weapon', loadout.weapon);
      const reflectDmg = Math.round(26 * (w.counter || 1));
      const a = Math.atan2(boss ? boss.y - player.y : -player.y, boss ? boss.x - player.x : -player.x);
      spawnPlayerBullet(a, 820, 'pulse', reflectDmg, { life: 1.4 });
      player.core = Math.min(100, player.core + 2);
      emit(b.x, b.y, 6, '#8fe6d4', .8);
      audio.play('hit');
      continue;
    }
    if (d < player.r + b.r) {
      b.dead = true;
      hurtPlayer(b.dmg, 'round');
      emit(b.x, b.y, 8, '#ff7548', .9);
    }
    if (b.x < -40 || b.x > VW + 40 || b.y < -40 || b.y > VH + 40 || b.life <= 0) b.dead = true;
  }
  bossBullets = bossBullets.filter(b => !b.dead);
}
function segmentCircle(x1, y1, x2, y2, cx, cy, r) {
  const dx = x2 - x1, dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  let t = len2 > 0 ? ((cx - x1) * dx + (cy - y1) * dy) / len2 : 0;
  t = clamp(t, 0, 1);
  const px = x1 + dx * t, py = y1 + dy * t;
  return (px - cx) ** 2 + (py - cy) ** 2 <= r * r;
}
function updateZones(dt) {
  for (const z of zones) {
    if (z.blastT > 0) {
      z.blastT = Math.max(0, z.blastT - dt);
      continue;
    }
    z.t -= dt;
    if (z.t <= 0) {
      z.blastT = z.blastMax;
      emit(z.x, z.y, 18, '#ff9c50', 1.6);
      addShake(4, .2);
      audio.play('boom');
      if (Math.hypot(player.x - z.x, player.y - z.y) <= z.r + player.r * .55) hurtPlayer(z.dmg, 'zone');
    }
  }
  zones = zones.filter(z => z.t > 0 || z.blastT > 0);
}
function updateEffects(dt) {
  for (const p of particles) {
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vx *= (1 - 2.2 * dt); p.vy *= (1 - 2.2 * dt);
    if (p.kind === 'ember') p.vy -= 36 * dt;
    p.life -= dt;
  }
  particles = particles.filter(p => p.life > 0);
  for (const f of floats) { f.y -= 20 * dt; f.life -= dt; }
  floats = floats.filter(f => f.life > 0);
  for (const s of slashes) s.t += dt;
  slashes = slashes.filter(s => s.t < s.max);
  if (shakeT > 0) {
    shakeT = Math.max(0, shakeT - dt);
    const a = shakeAmp * Math.min(1, shakeT / .18);
    shakeX = (Math.random() * 2 - 1) * a;
    shakeY = (Math.random() * 2 - 1) * a;
    if (shakeT <= 0) { shakeX = 0; shakeY = 0; shakeAmp = 0; }
  }
  hurtFlash = Math.max(0, hurtFlash - dt * 1.8);
  if (hitstopT > 0) hitstopT = Math.max(0, hitstopT - dt);
}
function updateCombat(dt) {
  if (mode !== 'combat' || paused || !player || !boss) return;
  runTime += dt;
  updatePlayer(dt);
  if (mode !== 'combat') return;
  updateBoss(dt);
  if (mode !== 'combat' || !boss) return;
  updateBullets(dt);
  if (mode !== 'combat' || !boss) return;
  updateZones(dt);
  updateEffects(dt);
  if (!Number.isFinite(player.x + player.y + player.hp + player.heat + player.energy) ||
    !Number.isFinite(boss.x + boss.y + boss.hp) || !Number.isFinite(runTime)) nanFlag = true;
}
function updateHUD() {
  if (!player || !boss) return;
  if (hpFill) hpFill.style.width = `${clamp(player.hp / Math.max(1, player.maxHp), 0, 1) * 100}%`;
  if (hpText) hpText.textContent = `${Math.ceil(player.hp)} / ${player.maxHp}`;
  if (energyFill) energyFill.style.width = `${clamp(player.energy / Math.max(1, stats.energyMax), 0, 1) * 100}%`;
  const hf = clamp(player.heat / Math.max(1, player.heatMax), 0, 1);
  if (heatFill) {
    heatFill.style.width = `${hf * 100}%`;
    heatFill.classList.toggle('hot', hf > .75 || player.overheatT > 0);
  }
  if (heatText) heatText.textContent = player.overheatT > 0 ? '过热' : `${Math.round(hf * 100)}%`;
  if (coreFill) coreFill.style.width = `${clamp(player.core / 100, 0, 1) * 100}%`;
  if (bossNameEl) bossNameEl.textContent = `${boss.def.name}  ·  ${boss.def.en}`;
  if (bossFill) bossFill.style.width = `${clamp(boss.hp / Math.max(1, boss.maxHp), 0, 1) * 100}%`;
  if (bossIndexEl) bossIndexEl.textContent = `${bossIndex + 1} / ${BOSSES.length}`;
  if (timerEl) timerEl.textContent = formatTime(runTime);
  if (runCoinsEl) runCoinsEl.textContent = String(coins);
  if (runPartsEl) runPartsEl.textContent = String(parts);
  if (statusEl) {
    statusEl.textContent = player.overheatT > 0 ? '散热中' : player.barrierT > 0 ? '屏障展开' : player.dashCd > 0 ? '推进冷却' : '作战中';
    statusEl.className = 'statusline' + (player.overheatT > 0 ? ' warn' : player.barrierT > 0 ? ' shield' : '');
  }
}

// ---------------------------------------------------------------- view / render
function makeView() {
  return {
    mode, paused, time, loadout, stats,
    player: player ? {
      x: player.x, y: player.y, aim: player.aim, hp: player.hp, maxHp: player.maxHp,
      heat: player.heat, heatMax: player.heatMax, barrierT: player.barrierT,
      dashT: player.dashT, invuln: player.invuln, targetSpeed: player.targetSpeed,
      hoverActive: player.hoverActive, weaponKey: loadout.weapon, armorKey: loadout.armor,
      thrusterKey: loadout.thruster, stats,
    } : null,
    boss: boss ? {
      x: boss.x, y: boss.y, r: boss.r, hp: boss.hp, maxHp: boss.maxHp,
      def: boss.def, flash: boss.flash, enraged: boss.enraged, angle: boss.angle,
    } : null,
    attack: boss ? boss.attack : null,
    aimLock: autoAim && !manualAimActive() && !!(boss && boss.hp > 0),
    bullets, bossBullets, zones, slashes, particles, floats,
    hurtFlash, shakeX, shakeY,
  };
}
function render() {
  if (mode === 'title') {
    renderer.draw({ mode, time });
  } else {
    renderer.draw(makeView());
  }
}

// ---------------------------------------------------------------- main loop
let last = performance.now(), acc = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(.1, Math.max(0, (now - last) / 1000));
  last = now;
  time += dt;
  handleInput();
  if (mode === 'combat' && !paused && !noAuto && hitstopT <= 0) {
    acc += dt;
    let n = 0;
    while (acc >= DT && n < 8) {
      updateCombat(DT);
      acc -= DT; n++;
      if (mode !== 'combat' || paused) break;
    }
  } else {
    acc = 0;
  }
  if (mode === 'forge' && forgeStep % 2 === 0) renderer.drawPreview(loadout, stats, time);
  forgeStep++;
  updateEffects(Math.min(dt, .05));
  if (mode === 'combat') updateHUD();
  render();
}
requestAnimationFrame(frame);
addEventListener('resize', () => { renderer.resize(); if (mode === 'forge') updateForgeUI(); });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (mode === 'combat' && !paused) togglePause(true);
    acc = 0;
  }
  last = performance.now();
});

// ---------------------------------------------------------------- UI binds
startBtn.addEventListener('click', startFromTitle);
confirmBtn.addEventListener('click', () => { if (!AUTOTEST) audio.unlock(); const ok = confirmLoadout(); if (ok) audio.play('confirm'); });
repairBtn.addEventListener('click', () => { if (!AUTOTEST) audio.unlock(); doRepair(); });
forgeHomeBtn.addEventListener('click', goTitle);
muteBtn.addEventListener('click', (e) => { maybeUnlock(e); toggleMute(); });
pauseBtn.addEventListener('click', (e) => { maybeUnlock(e); togglePause(); });
if (aimBtn) aimBtn.addEventListener('click', (e) => { maybeUnlock(e); setAutoAim(!autoAim); audio.play('ui'); });
if (fireBtn) fireBtn.addEventListener('click', (e) => { maybeUnlock(e); setAutoFire(!autoFire); audio.play('ui'); });
setAutoAim(autoAim, true);
setAutoFire(autoFire, true);
retryBtn.addEventListener('click', () => { if (!AUTOTEST) audio.unlock(); beginNewRun(); audio.play('confirm'); });
homeBtn.addEventListener('click', goTitle);
resumeBtn.addEventListener('click', () => togglePause(false));
restartBtn.addEventListener('click', () => { if (!AUTOTEST) audio.unlock(); beginNewRun(); audio.play('confirm'); });
pauseHomeBtn.addEventListener('click', goTitle);

// ---------------------------------------------------------------- boot
initForgeDom();
renderer.resize();
syncTitleBest();
setMuted(muted);
if (isTouchDevice()) {
  document.body.classList.add('touch');
  showTouch(false);
}
if (AUTOSTART && !AUTOTEST) {
  beginNewRun();
  confirmLoadout();
}
if (AUTOTEST) {
  showHud(false);
  showTouch(false);
}

// ==================== G debug hooks ====================
const G = {
  err: window.__BOOTERR || (window.__BOOTERR = []),
  step(n = 60, dt = DT) {
    for (let i = 0; i < n; i++) {
      handleInput();
      if (mode === 'combat' && !paused) updateCombat(dt);
      if (mode === 'forge') updateEffects(dt);
    }
    render();
  },
  upd(n = 30, dt = DT) {
    for (let i = 0; i < n; i++) {
      handleInput();
      if (mode === 'combat' && !paused) updateCombat(dt);
      else if (mode === 'forge') updateEffects(dt);
    }
  },
  press(...codes) { codes.forEach(c => { held.add(c); pressed.add(c); }); },
  release(...codes) { codes.forEach(c => held.delete(c)); },
  clearKeys() { held.clear(); pressed.clear(); mouseDown = false; touchMove = { x: 0, y: 0, mag: 0 }; touchFire = false; touchAim.active = false; },
  setNoAuto(v) { noAuto = !!v; if (noAuto) acc = 0; },
  setReportTarget(fn) { reportTarget = typeof fn === 'function' ? fn : null; },
  startRun: beginNewRun,
  newRun: beginNewRun,
  goTitle,
  confirmLoadout,
  selectPart,
  repair: doRepair,
  togglePause,
  toggleMute,
  setMuted,
  setCoins(v) { setCoinsNow(v); updateForgeUI(); },
  addCoins,
  setParts(v) { parts = Math.max(0, Math.round(Number(v) || 0)); updateForgeUI(); },
  setPlayerHp(v) { if (player) player.hp = clamp(Number(v) || 0, 0, player.maxHp); updateHUD(); },
  setBossHp(v) { if (boss) boss.hp = clamp(Number(v) || 0, 0, boss.maxHp); updateHUD(); },
  setHeat(v) { if (player) player.heat = clamp(Number(v) || 0, 0, player.heatMax); updateHUD(); },
  setEnergy(v) { if (player) player.energy = clamp(Number(v) || 0, 0, stats.energyMax); updateHUD(); },
  setCore(v) { if (player) player.core = clamp(Number(v) || 0, 0, 100); updateHUD(); },
  setInvuln(v) { if (player) player.invuln = Math.max(0, Number(v) || 0); },
  setBarrier(v) { if (player) player.barrierT = Math.max(0, Number(v) || 0); },
  setDashCd(v) { if (player) player.dashCd = Math.max(0, Number(v) || 0); },
  setTouchVisible(v) { showTouch(!!v); },
  setAim(angle) { if (player) { player.aim = Number(angle) || 0; aimManualT = 0; } },
  setAimAtBoss() { if (player && boss) { player.aim = Math.atan2(boss.y - player.y, boss.x - player.x); aimManualT = 0; } },
  setAutoAim, setAutoFire,
  fireOnce() { if (player) player.fireCd = 0; return tryFire(); },
  triggerDash,
  triggerBarrier,
  damagePlayer(n) { return hurtPlayer(Number(n) || 0, 'debug'); },
  forceBossAttack(kind) { return beginBossAttack(kind); },
  forceWin() { return defeatBoss(); },
  forceFail() { if (player) player.hp = 0; return loseGame('debug'); },
  spawnBossRound(a, speed = 180, dmg = 10) { if (boss) spawnBossRound(Number(a) || 0, speed, dmg); },
  clearBullets() { bullets = []; bossBullets = []; zones = []; },
  statsFor(weapon, armor, thruster) {
    return deriveStats({ weapon: weapon || loadout.weapon, armor: armor || loadout.armor, thruster: thruster || loadout.thruster });
  },
  arenaClamp,
  state() {
    const s = stats;
    return {
      mode, paused, bossIndex, coins, parts, repairLeft,
      runTime: +runTime.toFixed(2), bestTime, bestScore, newBest, nan: nanFlag,
      loadout: { ...loadout },
      stats: { ...s, colors: { ...s.colors } },
      bossName: boss ? boss.def.name : '',
      bossId: boss ? boss.def.id : '',
      player: player ? {
        x: +player.x.toFixed(2), y: +player.y.toFixed(2), hp: +player.hp.toFixed(2), maxHp: player.maxHp,
        aim: +player.aim.toFixed(3), heat: +player.heat.toFixed(2), heatMax: player.heatMax,
        overheatT: +player.overheatT.toFixed(2), energy: +player.energy.toFixed(2),
        energyMax: stats.energyMax, core: +player.core.toFixed(2), barrierT: +player.barrierT.toFixed(2),
        dashT: +player.dashT.toFixed(2), dashCd: +player.dashCd.toFixed(2), invuln: +player.invuln.toFixed(2),
        targetSpeed: +player.targetSpeed.toFixed(1), moving: moveVector().mag > 0,
      } : null,
      boss: boss ? {
        x: +boss.x.toFixed(2), y: +boss.y.toFixed(2), hp: +boss.hp.toFixed(2), maxHp: boss.maxHp,
        r: boss.r, enraged: boss.enraged, attack: boss.attack ? boss.attack.kind : '',
        attackT: boss.attack ? +boss.attack.t.toFixed(2) : 0,
        windup: boss.attack ? boss.attack.windup : 0,
      } : null,
      bullets: bullets.length, bossBullets: bossBullets.length, zones: zones.length,
      shotsFired, reports: reports.length,
      autoAim, autoFire, aimManualT: +aimManualT.toFixed(2),
      touch: { moveMag: +touchMove.mag.toFixed(2), firing: touchFire, aimActive: touchAim.active },
      muted, audioCtx: audio.hasCtx(),
      bossCount: BOSSES.length,
    };
  },
  reportLog() { return reports.slice(); },
  score: scoreValue,
  defs: {
    VW, VH, ARENA, WEAPONS, ARMORS, THRUSTERS, BOSSES, DEFAULT_LOADOUT,
    START_COINS, REPAIR_COST, REPAIR_FRAC, BARRIER_COST, BARRIER_TIME, DT,
  },
  audio, renderer,
};
window.__G = G;
window.G = G;

// ==================== autotest suite ====================
const nap = () => new Promise(r => { const mc = new MessageChannel(); mc.port1.onmessage = () => r(); mc.port2.postMessage(0); });

async function autotest() {
  const results = [];
  const T = window.__TEST = { pass: 0, fail: 0, total: 0, results, done: false };
  G.setNoAuto(true);
  const ok = (id, cond, name) => {
    const good = !!cond;
    results.push({ id, ok: good, name });
    if (good) T.pass++; else T.fail++;
    if (!good) console.log(`[autotest] FAIL ${id}: ${name}`);
  };
  const R = (n, dt = DT) => { for (let i = 0; i < n; i++) { handleInput(); if (mode === 'combat' && !paused) updateCombat(dt); else if (mode === 'forge') updateEffects(dt); } };
  const savedBest = bestTime, savedBestScore = bestScore, savedMute = muted;
  const savedBestRaw = (() => { try { return localStorage.getItem(BEST_TIME_KEY); } catch (e) { return null; } })();
  const savedScoreRaw = (() => { try { return localStorage.getItem(BEST_SCORE_KEY); } catch (e) { return null; } })();
  const savedMuteRaw = (() => { try { return localStorage.getItem(MUTE_KEY); } catch (e) { return null; } })();
  const savedAimRaw = (() => { try { return localStorage.getItem(AIM_KEY); } catch (e) { return null; } })();
  const savedFireRaw = (() => { try { return localStorage.getItem(FIRE_KEY); } catch (e) { return null; } })();
  const frames = [];
  try { localStorage.removeItem(BEST_TIME_KEY); localStorage.removeItem(BEST_SCORE_KEY); } catch (e) { }
  bestTime = 0; bestScore = 0;
  setMuted(true);
  G.setReportTarget(f => frames.push(f));
  G.setNoAuto(true);
  G.clearKeys();

  try {
    await nap();
    // 1 — boot
    ok(1, (window.__BOOTERR || []).length === 0 && G.err.length === 0, '启动零报错（BOOTERR / G.err 为空）');

    // 2 — new run / forge defaults
    G.startRun(); G.setNoAuto(true);
    let s = G.state();
    const defCost = G.statsFor().loadoutCost;
    ok(2, s.mode === 'forge' && s.bossIndex === 0 && s.coins === 300 - defCost &&
      s.parts === 0 && s.player.hp === s.stats.maxHp && s.loadout.weapon === 'autocannon' &&
      s.loadout.armor === 'composite' && s.loadout.thruster === 'standard',
      `首进锻炉：铸币 ${s.coins}（默认装 ${defCost}）、HP ${s.player.hp}`);

    // 3 — weapon mathematics
    const blade = G.statsFor('cleaver'), auto = G.statsFor('autocannon'), beam = G.statsFor('beam');
    ok(3, blade.dmg > auto.dmg && blade.fireDelay > auto.fireDelay && blade.heatPerShot !== auto.heatPerShot &&
      auto.weaponMode === 'auto' && beam.weaponMode === 'beam' && blade.weaponMode === 'melee',
      `巨刃 ${blade.dmg}/${blade.fireDelay}s 热${blade.heatPerShot} vs 机炮 ${auto.dmg}/${auto.fireDelay}s 热${auto.heatPerShot}；光束 ${beam.weaponMode}`);

    // 4 — armor and thruster mathematics
    const falcon = G.statsFor('autocannon', 'falcon', 'standard');
    const heavy = G.statsFor('autocannon', 'heavy', 'standard');
    const turbo = G.statsFor('autocannon', 'composite', 'turbo');
    const forgeT = G.statsFor('autocannon', 'composite', 'forge');
    ok(4, heavy.maxHp > falcon.maxHp && heavy.armor > falcon.armor && heavy.speed < falcon.speed &&
      heavy.weight > falcon.weight && forgeT.dashSpeed > turbo.dashSpeed && forgeT.dashCd > turbo.dashCd &&
      forgeT.dashDamage === 40,
      `重甲 ${heavy.maxHp}HP/${heavy.armor}甲/${heavy.speed}速 vs 游隼 ${falcon.maxHp}/${falcon.armor}/${falcon.speed}；熔炉冲刺 ${forgeT.dashSpeed}/${forgeT.dashCd}s`);

    // 5 — arena clamp
    const cl = G.arenaClamp(2000, 2000, 24);
    const inside = ((cl.x - ARENA.cx) / (ARENA.rx - 24)) ** 2 + ((cl.y - ARENA.cy) / (ARENA.ry - 24)) ** 2 <= 1.0001;
    ok(5, inside && Number.isFinite(cl.x + cl.y), `越界点钳制回场内 (${cl.x.toFixed(0)},${cl.y.toFixed(0)})`);

    // 6 — swap economy
    const beforeSwap = s.coins;
    const swapped = G.selectPart('armor', 'heavy');
    s = G.state();
    const compositeP = G.defs.ARMORS.find(a => a.key === 'composite').price;
    const heavyP = G.defs.ARMORS.find(a => a.key === 'heavy').price;
    ok(6, swapped && s.loadout.armor === 'heavy' && s.coins === beforeSwap + compositeP - heavyP &&
      s.stats.maxHp === 180, `换熔钢重甲：铸币 ${beforeSwap}→${s.coins}（差 ${compositeP - heavyP}）、HP ${s.stats.maxHp}`);

    // 7 — insufficient funds rejected
    G.setCoins(0);
    const weaponBefore = G.state().loadout.weapon;
    const rejected = G.selectPart('weapon', 'beam');
    s = G.state();
    ok(7, rejected === false && s.loadout.weapon === weaponBefore && s.coins === 0,
      `0 铸币无法安装聚焦光束（${s.loadout.weapon} 保持）`);

    // 8 — refund path + affordable setup
    G.setCoins(500);
    G.selectPart('armor', 'composite');
    G.selectPart('weapon', 'autocannon');
    s = G.state();
    ok(8, s.coins === 500 + (heavyP - compositeP) && s.stats.maxHp === 130,
      `退款换回复合甲：铸币 ${s.coins}、HP ${s.stats.maxHp}`);

    // 9 — combat start
    G.confirmLoadout(); G.setNoAuto(true);
    s = G.state();
    ok(9, s.mode === 'combat' && s.bossId === 'warden' && s.boss.hp === 2400 && !s.nan,
      `进入战斗：${s.bossName} HP ${s.boss.hp}`);

    // 10 — keyboard movement input path
    const x0 = G.state().player.x;
    G.press('KeyD'); R(20); G.release('KeyD');
    const x1 = G.state().player.x;
    ok(10, x1 > x0 + 5, `D 键移动生效 x ${x0}→${x1}`);

    // 11 — aim + fire really damages boss
    G.setAimAtBoss();
    const hp0 = G.state().boss.hp, heat0 = G.state().player.heat;
    G.press('KeyJ'); R(40); G.release('KeyJ');
    s = G.state();
    ok(11, s.boss.hp < hp0 - 7 && s.player.heat > heat0 && s.shotsFired > 0,
      `J 射击命中 Boss HP ${hp0}→${s.boss.hp}，热量 ${s.player.heat.toFixed(1)}`);

    // 12 — heat + overheat lock
    G.setHeat(s.stats.heatCap - .5);
    G.fireOnce(); R(2);
    const shotsAtOverheat = G.state().shotsFired;
    const wasOverheated = G.state().player.overheatT > 0;
    R(20);
    const shotsAfter = G.state().shotsFired;
    R(85);
    ok(12, wasOverheated && shotsAfter === shotsAtOverheat && G.state().player.overheatT <= 0,
      `过热锁定 ${wasOverheated}，锁定期间不再射击（${shotsAtOverheat}→${shotsAfter}），冷却解除`);

    // 13 — dash consumes energy and moves
    G.setEnergy(100); G.setInvuln(0);
    const px0 = G.state().player.x, py0 = G.state().player.y, en0 = G.state().player.energy;
    G.press('KeyK'); R(2); G.release('KeyK');
    s = G.state();
    const dashing = s.player.dashT > 0 || s.player.dashCd > 0;
    R(12);
    const moved = Math.hypot(G.state().player.x - px0, G.state().player.y - py0) > 10;
    ok(13, dashing && Math.abs((en0 - s.player.energy) - s.stats.dashCost) < 3 && moved,
      `K 冲刺：能量 ${en0}→${s.player.energy}（耗 ${s.stats.dashCost}）、位移 ${moved}`);

    // 14 — barrier blocks damage and spends core
    G.setInvuln(0); G.setCore(100);
    const hpBeforeBarrier = G.state().player.hp;
    const barrierUp = G.triggerBarrier();
    const coreAfter = G.state().player.core;
    const blocked = G.damagePlayer(30);
    ok(14, barrierUp && coreAfter === 40 && G.state().player.hp === hpBeforeBarrier && blocked === false,
      `E 屏障消耗 60 熔核、完全挡下 30 伤害（HP ${hpBeforeBarrier}）`);

    // 15 — armor flat mitigation exact
    G.setBarrier(0);
    G.setInvuln(0);
    // drop barrier by advancing but keep player alive
    const hpM = G.state().player.hp;
    G.damagePlayer(30);
    s = G.state();
    const expected = hpM - Math.max(1, 30 - s.stats.armor);
    ok(15, Math.abs(s.player.hp - expected) < .01,
      `装甲减伤公式：30 - ${s.stats.armor} = ${30 - s.stats.armor}（${hpM}→${s.player.hp}）`);

    // 16 — pause freezes combat
    const bpos = { x: G.state().boss.x, y: G.state().boss.y };
    const ppos = { x: G.state().player.x, y: G.state().player.y };
    const rt0 = G.state().runTime;
    G.press('KeyP'); R(2);
    const isPaused = G.state().paused;
    R(30);
    const frozen = G.state().runTime === rt0 && G.state().boss.x === bpos.x && G.state().boss.y === bpos.y &&
      G.state().player.x === ppos.x && G.state().player.y === ppos.y;
    G.press('KeyP'); R(2);
    R(20);
    const resumed = !G.state().paused && G.state().runTime > rt0;
    ok(16, isPaused && frozen && resumed, `P 暂停冻结 ${isPaused}/${frozen}，再按恢复 ${resumed}`);

    // 17 — touch movement joystick
    G.setTouchVisible(true);
    const jr = joyMove.getBoundingClientRect();
    const tx0 = G.state().player.x;
    joyMove.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch', pointerId: 41, clientX: jr.left + jr.width * .75, clientY: jr.top + jr.height * .5 }));
    R(20);
    const touchMag = G.state().touch.moveMag;
    joyMove.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerType: 'touch', pointerId: 41 }));
    R(2);
    ok(17, touchMag > 0 && Math.abs(G.state().player.x - tx0) > 2,
      `左摇杆推动机甲：mag ${touchMag}、x ${tx0}→${G.state().player.x}`);

    // 18 — touch aim joystick fires
    G.setAimAtBoss();
    const jrA = joyAim.getBoundingClientRect();
    const shotsT0 = G.state().shotsFired;
    joyAim.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch', pointerId: 42, clientX: jrA.left + jrA.width * .5, clientY: jrA.top + jrA.height * .25 }));
    R(12);
    const touchFiring = G.state().touch.firing;
    const touchAimActive = G.state().touch.aimActive;
    joyAim.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerType: 'touch', pointerId: 42 }));
    R(2);
    ok(18, touchFiring && touchAimActive && G.state().shotsFired > shotsT0,
      `右摇杆瞄准并持续射击：firing=${touchFiring}、aim=${touchAimActive}、射击 ${shotsT0}→${G.state().shotsFired}`);

    // 19 — touch action buttons
    G.setBarrier(0); G.setDashCd(0); G.setEnergy(100); G.setCore(100); G.setInvuln(0);
    const energyB = G.state().player.energy;
    tDash.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch', pointerId: 43 }));
    R(2);
    const dashOK = G.state().player.energy < energyB;
    tGuard.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch', pointerId: 44 }));
    R(2);
    const guardOK = G.state().player.barrierT > 0;
    ok(19, dashOK && guardOK, `触屏按钮：冲刺耗能 ${dashOK}、屏障 ${guardOK}`);

    // 20 — boss telegraph and execution
    G.setPlayerHp(G.state().stats.maxHp); G.setInvuln(0); G.clearBullets();
    const forceOK = G.forceBossAttack('radial');
    const atk0 = G.state().boss.attack;
    const bb0 = G.state().bossBullets;
    R(70);
    ok(20, forceOK && atk0 === 'radial' && G.state().bossBullets > bb0,
      `Boss 预警「${atk0}」→ 弹幕生成 ${bb0}→${G.state().bossBullets}`);

    // 21 — slam zone damages a stationary player
    G.clearBullets(); G.setPlayerHp(130); G.setInvuln(0);
    const hpSlam = G.state().player.hp;
    G.forceBossAttack('slam');
    R(150);
    ok(21, G.state().player.hp < hpSlam, `落锤预警圈爆炸命中：HP ${hpSlam}→${G.state().player.hp}`);

    // 22 — failure path
    G.clearBullets(); G.setInvuln(0);
    const hpFail = G.state().player.hp;
    G.setPlayerHp(1);
    G.damagePlayer(999);
    s = G.state();
    const failReport = frames.some(f => f.kind === 'gameOver' && Number.isInteger(f.score) && typeof f.progress === 'number');
    ok(22, s.mode === 'gameover' && s.player.hp === 0 && failReport,
      `HP 1 → 0 失败 gameOver（上报 score=${scoreValue()} progress=${s.bossIndex}/3）`);

    // 23 — R restart resets run
    G.press('KeyR'); R(3); G.release('KeyR');
    s = G.state();
    ok(23, s.mode === 'forge' && s.bossIndex === 0 && s.parts === 0 && s.repairLeft === 0 &&
      s.player.hp === s.stats.maxHp && s.runTime === 0,
      `R 重开复位：mode=${s.mode}、Boss ${s.bossIndex}、HP ${s.player.hp}`);

    // 24 — boss reward + intermission economy
    G.confirmLoadout(); R(6);
    const coinsBeforeKill = G.state().coins;
    const coinsFull = coinsBeforeKill;
    const kill1 = G.forceWin();
    s = G.state();
    ok(24, kill1 && s.mode === 'forge' && s.bossIndex === 1 && s.coins === coinsFull + 90 &&
      s.parts === 20 && s.repairLeft === 1,
      `击败铁颚监工：铸币 +90 → ${s.coins}、零件 ${s.parts}、维修次数 ${s.repairLeft}`);

    // 25 — repair deducts coins and heals, limited
    G.setPlayerHp(10);
    const coinsBeforeRepair = G.state().coins;
    const repaired = G.repair();
    s = G.state();
    const healed = s.player.hp > 10;
    const repaired2 = G.repair();
    ok(25, repaired && healed && s.coins === coinsBeforeRepair - 30 && repaired2 === false,
      `维修：铸币 ${coinsBeforeRepair}→${s.coins}、HP 10→${s.player.hp}、第二次被拒`);

    // 26 — report frame sequence so far
    const kinds = frames.map(f => f.kind);
    const prog = frames.find(f => f.kind === 'progress');
    ok(26, reports.length > 0 && reports[0].kind === 'ready' && kinds.includes('progress') &&
      kinds.includes('gameOver') && prog && Number.isInteger(prog.score) && Number.isInteger(prog.progress),
      `上报帧序 ready→progress→gameOver；progress score=${prog ? prog.score : '—'} progress=${prog ? prog.progress : '—'}`);

    // 27 — second and third bosses + complete path + best time
    G.confirmLoadout(); R(6);
    const boss2 = G.state().bossName;
    const kill2 = G.forceWin();
    const after2 = G.state();
    G.confirmLoadout(); R(6);
    const boss3 = G.state().bossName;
    const kill3 = G.forceWin();
    s = G.state();
    ok(27, kill2 && after2.bossIndex === 2 && kill3 && s.mode === 'complete' &&
      s.bossIndex === 3 && s.bestTime > 0,
      `连续三战：${boss2} → ${boss3} → complete（最佳 ${s.bestTime}s）`);

    // 28 — complete report and best localStorage
    let storedTime = 0, storedScore = 0;
    try { storedTime = parseFloat(localStorage.getItem(BEST_TIME_KEY) || '0') || 0; storedScore = parseInt(localStorage.getItem(BEST_SCORE_KEY) || '0', 10) || 0; } catch (e) { }
    ok(28, frames.some(f => f.kind === 'complete' && Number.isInteger(f.score)) &&
      storedTime > 0 && Math.abs(storedTime - s.bestTime) < .002 && storedScore >= s.bestScore,
      `complete 上报 + best 写入 localStorage（${storedTime}s / ${storedScore}）`);

    // 29 — finish overlay / retry and home buttons
    ok(29, endEl && !endEl.classList.contains('hide') && retryBtn && homeBtn &&
      /炉 心 已 熄/.test(endhEl.textContent), '通关结算浮层与「再铸一轮 / 回标题」按钮存在');

    // 30 — restart and fast-forward integrity
    G.startRun(); G.confirmLoadout();
    G.setPlayerHp(9999); G.setInvuln(9999);
    G.setAimAtBoss();
    let bad = false, maxSeen = 0;
    for (let i = 0; i < 1800; i++) {
      if (i % 90 === 0) G.press('KeyD');
      if (i % 90 === 18) G.release('KeyD');
      if (i % 120 === 0) G.press('KeyJ');
      if (i % 120 === 40) G.release('KeyJ');
      if (i % 200 === 0) G.press('KeyK');
      if (i % 200 === 3) G.release('KeyK');
      if (i % 260 === 0) G.press('KeyE');
      if (i % 260 === 2) G.release('KeyE');
      R(1);
      const st = G.state();
      if (st.nan || !Number.isFinite(st.player.x + st.player.y + st.boss.x + st.boss.y + st.runTime)) bad = true;
      maxSeen = Math.max(maxSeen, st.bossBullets, st.bullets);
    }
    G.clearKeys();
    ok(30, !bad && maxSeen < 400 && G.err.length === 0,
      `1800 帧快进无 NaN、无异常、无弹幕爆量（峰值 ${maxSeen}）`);

    // 31 — title + DOM shell
    G.goTitle(); G.setNoAuto(true);
    s = G.state();
    ok(31, s.mode === 'title' && !titleEl.classList.contains('hide') &&
      !!document.getElementById('startbtn') && !!document.getElementById('forge') &&
      !!document.getElementById('joystick-placeholder') === false &&
      !!document.getElementById('confirmlabel') === false &&
      !!confirmBtn && !!repairBtn && !!document.getElementById('tdash') && !!document.getElementById('tguard'),
      '返回标题画面；标题/锻炉/触控 DOM 齐备');

    // 32 — audio stays silent in autotest
    audio.setState('boss');
    ok(32, !audio.hasCtx() && audio.isMuted() && audio.state() === 'boss', '自测不建 AudioContext、保持静音、配乐状态可切换');

    // 33 — network audit
    const net = window.__NET || { fetch: 0, xhr: 0, ws: 0, external: [] };
    ok(33, net.external.length === 0 && net.fetch === 0 && net.xhr === 0 && net.ws === 0,
      `零外网请求（external=${net.external.length}、fetch=${net.fetch}）`);

    // 34 — report target receives only flat frames
    ok(34, frames.every(f => typeof f.kind === 'string' && !('data' in f) && !('payload' in f)),
      `reportTarget 收到扁平帧 ${frames.length} 条`);

    // 35 — integer score invariant
    ok(35, Number.isInteger(scoreValue()) && scoreValue() >= 0 && s.parts >= 0 && s.coins >= 0,
      `分数整数 ${scoreValue()}、铸币非负 ${s.coins}`);

    // 36 — manual aim then idle → auto-aim takes over
    G.startRun(); G.confirmLoadout(); G.setNoAuto(true); R(4);
    G.setPlayerHp(G.state().stats.maxHp); G.setInvuln(99);
    G.setAutoAim(true, true); G.setAutoFire(false, true);
    G.setAim(2.2); R(2);
    const aimHeld = G.state().player.aim;
    R(90);
    const s36 = G.state();
    const bossAngle36 = Math.atan2(s36.boss.y - s36.player.y, s36.boss.x - s36.player.x);
    ok(36, Math.abs(angleDiff(aimHeld, 2.2)) < .01 && Math.abs(angleDiff(s36.player.aim, bossAngle36)) < .06,
      `手动瞄准保持（${aimHeld.toFixed(2)}≈2.2），闲置 1.5 秒后自动瞄准接管（偏差 ${Math.abs(angleDiff(s36.player.aim, bossAngle36)).toFixed(3)} rad）`);

    // 37 — auto-aim toggle off → aim stays manual
    G.setAutoAim(false, true);
    G.setAim(2.2); R(90);
    const aim37 = G.state().player.aim;
    ok(37, Math.abs(angleDiff(aim37, 2.2)) < .001 && G.state().autoAim === false,
      `关闭自动瞄准后炮口保持 ${aim37.toFixed(2)}（2.2）不变`);

    // 38 — auto-fire fires without any input while auto-aim engaged
    G.setAutoAim(true, true); G.setAutoFire(true, true); G.setHeat(0);
    const shots38 = G.state().shotsFired;
    R(30);
    const s38 = G.state();
    ok(38, s38.shotsFired > shots38 && s38.autoFire === true,
      `自动开火：无输入射击 ${shots38}→${s38.shotsFired}`);
    G.setAutoFire(false, true);

    // 39 — aim/fire toggles persist to localStorage
    G.setAutoAim(false, true); G.setAutoFire(true, true);
    const aimStored = (() => { try { return localStorage.getItem(AIM_KEY); } catch (e) { return null; } })();
    const fireStored = (() => { try { return localStorage.getItem(FIRE_KEY); } catch (e) { return null; } })();
    const s39 = G.state();
    ok(39, aimStored === '0' && fireStored === '1' && s39.autoAim === false && s39.autoFire === true,
      `开关持久化：irw.autoaim=${aimStored}、irw.autofire=${fireStored}（state 同步）`);
    G.setAutoAim(true, true); G.setAutoFire(false, true);
  } catch (err) {
    ok('CRASH', false, `自测异常：${String(err && err.stack || err)}`);
    console.log('[autotest] crashed', err);
  } finally {
    G.setReportTarget(null);
    try { G.goTitle(); } catch (e) { }
    try {
      if (savedBestRaw === null) localStorage.removeItem(BEST_TIME_KEY); else localStorage.setItem(BEST_TIME_KEY, savedBestRaw);
      if (savedScoreRaw === null) localStorage.removeItem(BEST_SCORE_KEY); else localStorage.setItem(BEST_SCORE_KEY, savedScoreRaw);
      if (savedMuteRaw === null) localStorage.removeItem(MUTE_KEY); else localStorage.setItem(MUTE_KEY, savedMuteRaw);
      if (savedAimRaw === null) localStorage.removeItem(AIM_KEY); else localStorage.setItem(AIM_KEY, savedAimRaw);
      if (savedFireRaw === null) localStorage.removeItem(FIRE_KEY); else localStorage.setItem(FIRE_KEY, savedFireRaw);
    } catch (e) { }
    bestTime = savedBest; bestScore = savedBestScore;
    setMuted(savedMute);
    setAutoAim(savedAimRaw === null ? true : savedAimRaw === '1', true);
    setAutoFire(savedFireRaw === null ? TOUCHLIKE : savedFireRaw === '1', true);
    syncTitleBest();
    T.pass = results.filter(r => r.ok).length;
    T.fail = results.length - T.pass;
    T.total = results.length;
    T.done = true;
    console.log(`[autotest] ${T.pass}/${T.total} passed`);
  }
}
if (AUTOTEST) autotest();
