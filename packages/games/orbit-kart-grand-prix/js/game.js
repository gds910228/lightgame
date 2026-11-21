// game.js — Orbit Kart Grand Prix
// Fixed-step three.js racing loop, drift charge, three items, three rubber-band AI,
// site reporting bridge, G debug hooks and the ?autotest=1 suite.
import * as THREE from '../vendor/three.module.min.js';
import { TRACKS, buildWorld } from './track.js';
import { makeKartModel, makeRoadblock, makeMissile, makeDustSprite } from './karts.js';
import { makeAudio } from './audio.js';

const DT = 1 / 60;
const LAPS = 3;
const RACE_LIMIT = 300;
const BEST_KEY = 'okg.best.v1';
const MUTE_KEY = 'okg.mute';
const AUTOTEST = new URLSearchParams(location.search).has('autotest');
const params = new URLSearchParams(location.search);
const AUTOSTART = params.has('autostart') || params.has('cover');
const COLOR = { player: 0xe8b463, ai: [0x65c6b3, 0xdf6b52, 0xcf9bff] };
const AI_NAMES = ['岚', '砾', '弦'];
const ITEM_DEFS = {
  dash: { glyph: '➤', name: '星焰冲刺', key: '直线喷发' },
  missile: { glyph: '➶', name: '追踪弹', key: '锁定前车' },
  block: { glyph: '▦', name: '路障', key: '丢在身后' }
};

const $ = id => document.getElementById(id);
const canvas = $('gl');
const ui = {
  title: $('title'), hud: $('hud'), count: $('count'), countn: $('countn'),
  banner: $('banner'), bannerm: $('bannerm'), banners: $('banners'), toast: $('toast'),
  pause: $('pause'), results: $('results'), touch: $('touch'),
  pos: $('pos'), lap: $('lap'), timer: $('timer'), speedo: $('speedo'), speedfill: $('speedfill'),
  itemSlot: $('itemSlot'), itemIcon: $('itemIcon'), itemName: $('itemName'), itemKey: $('itemKey'),
  boostbar: $('boostbar'), boostfill: $('boostfill'), hint: $('hint'),
  bestline: $('bestline'), trackpick: $('trackpick'), minimap: $('minimap'),
  rescap: $('rescap'), resh: $('resh'), ressub: $('ressub'), rpos: $('rpos'), rtime: $('rtime'),
  rlap: $('rlap'), rscore: $('rscore'), resultRows: $('resultRows'),
  mutebtn: $('mutebtn'), pausebtn: $('pausebtn')
};

// ---------- renderer / scene ----------
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
renderer.setSize(innerWidth, innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.18;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 1200);
camera.position.set(0, 30, 70);

const hemi = new THREE.HemisphereLight(0xd8efff, 0x1d1720, 1.55);
scene.add(new THREE.AmbientLight(0x8fa9c0, .32));
scene.add(hemi);
const keyLight = new THREE.DirectionalLight(0xffe2b6, 2.2);
keyLight.position.set(110, 180, 80);
scene.add(keyLight);
const rimLight = new THREE.DirectionalLight(0x7fd8d0, 1.15);
rimLight.position.set(-80, 70, -120);
scene.add(rimLight);
const lowLight = new THREE.PointLight(0xe8b463, 18, 90, 2);
lowLight.position.set(0, 12, 0);
scene.add(lowLight);

// ---------- state ----------
let world = null;
let trackIndex = 0;
let raceMode = 'gp';               // gp | tt
let screen = 'title';              // title | countdown | race | results
let paused = false;
let testActive = AUTOTEST;
let noAuto = false;
let reportTarget = null;
let reports = [];
let racers = [];
let player = null;
let playerAuto = false;
let boxes = [];
let blocks = [];
let missiles = [];
let fx = [];
let score = 0;
let raceT = 0;
let countdownT = 0;
let raceOver = false;
let dnf = false;
let hitStop = 0;
let trauma = 0;
let titleT = 0;
let hintT = 0;
let lastCountShown = '';
let toastT = 0;
let raceSeed = 0x1a2b3c4d;
let aiTimer = 0;
let pendingReportProgress = 0;
let bestData = loadBest();
let muted = localStorage.getItem(MUTE_KEY) === '1' || AUTOTEST;
let savedMute = localStorage.getItem(MUTE_KEY);

const audio = makeAudio();
audio.setMuted(muted);

// ---------- helpers ----------
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const pad2 = n => String(n).padStart(2, '0');
function fmtTime(sec) {
  if (!Number.isFinite(sec) || sec < 0) return '--:--.--';
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return `${pad2(m)}:${s.toFixed(2).padStart(5, '0')}`;
}
function fmtShort(sec) {
  if (!Number.isFinite(sec) || sec <= 0) return '--:--';
  return fmtTime(sec);
}
function rnd() {
  raceSeed += 0x6D2B79F5;
  let t = raceSeed;
  t = Math.imul(t ^ (t >>> 15), 1 | t);
  t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
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
    else if (window.parent && window.parent !== window) {
      window.parent.postMessage({ source: 'lightgame', type: 'lightgame:report', payload: toWireReport(frame) }, '*');
      if (frame.kind === 'ready') window.parent.postMessage({ source: 'lightgame', type: 'lightgame:ready', gameId: 'orbit-kart-grand-prix', v: 1 }, '*');
    }
  } catch (e) {}
}
function toast(msg, dur = 1.8) {
  ui.toast.textContent = msg;
  ui.toast.classList.add('on');
  toastT = dur;
}
function banner(main, sub = '', dur = 1.6) {
  ui.bannerm.textContent = main;
  ui.banners.textContent = sub;
  ui.banner.classList.add('on');
  setTimeout(() => {
    if (!testActive) ui.banner.classList.remove('on');
  }, dur * 1000);
}
function saveMute() {
  try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch (e) {}
}
function toggleMute() {
  muted = !muted;
  audio.setMuted(muted);
  saveMute();
  ui.mutebtn.textContent = muted ? '∅' : '♪';
  if (!muted) { audio.ensure(); audio.updateMusic(); }
}
function loadBest() {
  const def = { tracks: {}, races: 0, wins: 0 };
  try {
    const raw = JSON.parse(localStorage.getItem(BEST_KEY) || 'null');
    if (!raw || typeof raw !== 'object') return def;
    if (!raw.tracks || typeof raw.tracks !== 'object') raw.tracks = {};
    return raw;
  } catch (e) { return def; }
}
function saveBest() {
  try { localStorage.setItem(BEST_KEY, JSON.stringify(bestData)); } catch (e) {}
}
function trackBest(i = trackIndex) {
  const id = TRACKS[i].id;
  return bestData.tracks[id] || null;
}

// ---------- input ----------
const keys = new Set();
const pressed = new Set();
const hasTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
const TOUCH_KEYS = ['TouchLeft', 'TouchRight', 'TouchBrake', 'TouchDrift'];
if (hasTouch) ui.touch.classList.add('on');

function registerKey(code, down) {
  if (down) {
    if (!keys.has(code)) pressed.add(code);
    keys.add(code);
  } else keys.delete(code);
}
const HANDLED = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyE', 'KeyM', 'KeyP', 'KeyR', 'Space',
  'ShiftLeft', 'ShiftRight', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Escape'
]);
addEventListener('keydown', e => {
  if (!HANDLED.has(e.code)) return;
  e.preventDefault();
  if (!e.repeat) registerKey(e.code, true);
  if (!AUTOTEST) audio.ensure();
  audio.updateMusic();
});
addEventListener('keyup', e => {
  if (HANDLED.has(e.code)) { e.preventDefault(); registerKey(e.code, false); }
});
addEventListener('blur', () => keys.clear());
document.addEventListener('visibilitychange', () => {
  if (document.hidden) last = performance.now();
});
addEventListener('resize', resize);
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

function bindTouchButton(id, code) {
  const el = $(id);
  if (!el) return;
  const on = e => {
    e.preventDefault();
    el.setPointerCapture && el.setPointerCapture(e.pointerId);
    keys.add(code);
    if (code === 'TouchItem') pressed.add('KeyE');
    if (code === 'TouchPause') pressed.add('KeyP');
    audio.ensure(); audio.updateMusic();
  };
  const off = e => {
    e.preventDefault();
    keys.delete(code);
    if (code === 'TouchItem' || code === 'TouchPause') keys.delete(code);
  };
  el.addEventListener('pointerdown', on);
  el.addEventListener('pointerup', off);
  el.addEventListener('pointercancel', off);
  el.addEventListener('pointerleave', off);
}
bindTouchButton('tl', 'TouchLeft');
bindTouchButton('tr', 'TouchRight');
bindTouchButton('tbrake', 'TouchBrake');
bindTouchButton('tdrift', 'TouchDrift');
bindTouchButton('titem', 'TouchItem');
bindTouchButton('tmenu', 'TouchPause');

// ---------- UI wiring ----------
ui.mutebtn.textContent = muted ? '∅' : '♪';
ui.mutebtn.addEventListener('click', e => { e.stopPropagation(); toggleMute(); });
ui.pausebtn.addEventListener('click', () => togglePause());
document.querySelectorAll('.modeBtn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.modeBtn').forEach(b => b.classList.toggle('on', b === btn));
    raceMode = btn.dataset.mode;
    updateBestLine();
    audio.sfx.ui();
  });
});
$('startbtn').addEventListener('click', () => {
  audio.ensure(); audio.updateMusic();
  startRace({ mode: raceMode, track: trackIndex });
});
$('resumebtn').addEventListener('click', () => togglePause(false));
$('quitbtn').addEventListener('click', () => toTitle());
$('againbtn').addEventListener('click', () => { startRace({ mode: raceMode, track: trackIndex }); });
$('homebtn').addEventListener('click', () => toTitle());
$('sharebtn').addEventListener('click', () => {
  try {
    if (typeof dp_share === 'function') dp_share(Math.round(score));
    else if (window.parent && typeof window.parent.handleGlobalShare === 'function') window.parent.handleGlobalShare(Math.round(score));
  } catch (e) {}
});

function buildTrackCards() {
  ui.trackpick.innerHTML = '<div class="cap">SELECT CIRCUIT · 选择赛道</div>';
  TRACKS.forEach((t, i) => {
    const el = document.createElement('div');
    el.className = 'trackcard' + (i === trackIndex ? ' on' : '');
    el.dataset.i = i;
    el.innerHTML = `<div class="swatch" style="background:${t.accent}"></div>
      <div class="no">0${i + 1}</div>
      <div><div class="tname">${t.name}</div><div class="ten">${t.en}</div></div>
      <div class="meta">${t.tag}<br><span data-best="${i}"></span></div>
      <div class="flag">${i + 1}</div>`;
    el.addEventListener('click', () => {
      if (screen !== 'title') return;
      trackIndex = i;
      document.querySelectorAll('.trackcard').forEach(c => c.classList.toggle('on', c === el));
      setWorld(i);
      updateBestLine();
      audio.sfx.ui();
    });
    ui.trackpick.appendChild(el);
  });
  refreshTrackMeta();
}
function refreshTrackMeta() {
  document.querySelectorAll('[data-best]').forEach(el => {
    const i = Number(el.dataset.best);
    const b = trackBest(i);
    el.textContent = b && b.rank ? `最佳 P${b.rank} · ${fmtShort(b.lap)}` : '尚无纪录';
  });
}
function updateBestLine() {
  const b = trackBest();
  const modeName = raceMode === 'tt' ? '计时赛' : '竞速赛';
  if (!b) ui.bestline.innerHTML = `${modeName} · 穿过问号箱拿道具，漂移越久加速越猛。<br>本赛道暂无纪录，第一条最快圈等你写下。`;
  else ui.bestline.innerHTML = `${modeName} · <b>最佳名次 P${b.rank || '-'}</b> · <b>最快圈 ${fmtShort(b.lap)}</b><br>历史最高积分 ${b.score || 0} · 已完赛 ${bestData.races || 0} 场`;
}
buildTrackCards();

// ---------- world ----------
function setWorld(i) {
  if (world) {
    world.dispose();
    world = null;
  }
  trackIndex = i;
  world = buildWorld(scene, i);
  hemi.color.set(0xe4f5ff);
  rimLight.color.set(TRACKS[i].accent2);
  lowLight.color.set(TRACKS[i].accent);
  prepareBoxes();
  if (screen === 'title') titleT = 0;
}
function prepareBoxes() {
  boxes = world.itemBoxes.map((b, i) => ({
    ...b,
    s: b.u * world.length,
    lateral: b.lane * world.width,
    baseY: b.mesh.position.y,
    phase: i * .7,
    active: false,
    respawn: 0
  }));
  resetBoxes();
}
function resetBoxes() {
  for (const b of boxes) {
    b.active = raceMode === 'gp';
    b.respawn = 0;
    if (b.mesh) { b.mesh.visible = raceMode === 'gp'; b.glow.visible = raceMode === 'gp'; }
  }
}
setWorld(0);

// ---------- karts ----------
function disposeObject(obj) {
  if (!obj) return;
  scene.remove(obj);
  obj.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        if (m.map && !m.map.userData.shared) m.map.dispose();
        m.dispose();
      }
    }
  });
}
function clearRaceObjects() {
  for (const r of racers) if (r.group) disposeObject(r.group);
  racers = [];
  player = null;
  for (const b of blocks) if (b.mesh) disposeObject(b.mesh);
  blocks = [];
  for (const m of missiles) if (m.mesh) disposeObject(m.mesh);
  missiles = [];
  for (const e of fx) if (e.sprite) disposeObject(e.sprite);
  fx = [];
}
function makeRacer(opts) {
  const group = makeKartModel(opts.color, opts.isPlayer);
  scene.add(group);
  return {
    ...opts,
    group,
    s: opts.s,
    lateral: opts.lateral,
    speed: 0,
    lap: 1,
    crossings: 0,
    finished: false,
    finishT: 0,
    lapTimes: [],
    lapStart: 0,
    boostT: 0,
    boostPow: 0,
    driftT: 0,
    driftCharge: 0,
    driftHeld: false,
    spinT: 0,
    item: null,
    rank: 1,
    fxT: 0,
    steer: 0,
    throttle: 0,
    itemTimer: 1.6 + rnd() * 3,
    ai: opts.ai || null
  };
}
function createRacers() {
  clearRaceObjects();
  raceSeed = 0x1a2b3c4d;
  const startGap = 7.5;
  player = makeRacer({
    isPlayer: true, name: '你', color: COLOR.player,
    s: 7, lateral: 0
  });
  racers.push(player);
  if (raceMode === 'gp') {
    const lanes = [-3.7, 3.7, 0];
    for (let i = 0; i < 3; i++) {
      const r = makeRacer({
        isPlayer: false, name: AI_NAMES[i], color: COLOR.ai[i],
        s: 7 + startGap * (i + 1), lateral: lanes[i],
        ai: { skill: .93 + i * .035, phase: i * 2.1, mistakeT: 0 }
      });
      racers.push(r);
    }
  }
  updateRanks();
  placeAll(0);
}

// ---------- race control ----------
function startRace(opts = {}) {
  if (opts.track !== undefined && opts.track !== trackIndex) {
    setWorld(opts.track);
    buildTrackCards();
  }
  raceMode = opts.mode || raceMode;
  document.querySelectorAll('.modeBtn').forEach(b => b.classList.toggle('on', b.dataset.mode === raceMode));
  screen = opts.skipCountdown ? 'race' : 'countdown';
  paused = false;
  raceOver = false;
  dnf = false;
  score = 0;
  raceT = 0;
  countdownT = opts.skipCountdown ? 0 : 3.35;
  lastCountShown = '';
  hitStop = 0;
  trauma = 0;
  hintT = 5;
  toastT = 0;
  ui.toast.classList.remove('on');
  ui.title.classList.add('hide');
  ui.results.classList.add('hide');
  ui.pause.classList.add('hide');
  ui.hud.classList.add('on');
  ui.touch.classList.toggle('on', hasTouch);
  ui.count.classList.toggle('on', !opts.skipCountdown);
  if (!opts.skipCountdown) { ui.countn.textContent = '3'; ui.countn.style.animation = 'none'; void ui.countn.offsetWidth; ui.countn.style.animation = ''; }
  resetBoxes();
  createRacers();
  ui.itemSlot.style.visibility = raceMode === 'tt' ? 'hidden' : 'visible';
  const itemBtn = $('titem'); if (itemBtn) itemBtn.style.display = raceMode === 'tt' ? 'none' : 'flex';
  updateHUD();
  if (!AUTOTEST) audio.ensure();
  audio.setState('race');
  audio.updateMusic();
  if (!AUTOTEST) audio.sfx.ui();
  if (opts.skipCountdown) beginRace();
  return true;
}
function beginRace() {
  screen = 'race';
  ui.count.classList.remove('on');
  raceT = 0;
  for (const r of racers) r.lapStart = 0;
  audio.sfx.go();
  banner('GO', TRACKS[trackIndex].en, 1.2);
  report('progress', { score: 0, progress: 0, lap: 1, track: TRACKS[trackIndex].id });
}
function togglePause(force) {
  if (!(screen === 'race' || screen === 'countdown' || screen === 'results')) return;
  paused = force === undefined ? !paused : !!force;
  ui.pause.classList.toggle('hide', !paused);
  ui.pausebtn.textContent = paused ? '▶' : '❚❚';
  if (paused) audio.stopEngine();
  else { if (!AUTOTEST) audio.ensure(); audio.updateMusic(); }
}
function toTitle() {
  screen = 'title';
  paused = false;
  raceOver = false;
  clearRaceObjects();
  screen = 'title';
  ui.title.classList.remove('hide');
  ui.results.classList.add('hide');
  ui.pause.classList.add('hide');
  ui.hud.classList.remove('on');
  ui.count.classList.remove('on');
  ui.banner.classList.remove('on');
  ui.toast.classList.remove('on');
  ui.boostbar.classList.remove('on');
  ui.touch.classList.remove('on');
  ui.itemSlot.style.visibility = 'visible';
  audio.setState('title');
  audio.stopEngine();
  audio.updateMusic();
  refreshTrackMeta();
  updateBestLine();
  titleT = 0;
}
function updateRanks() {
  const sorted = [...racers].sort((a, b) => {
    if (a.finished && b.finished) return a.finishT - b.finishT;
    if (a.finished) return -1;
    if (b.finished) return 1;
    return progressOf(b) - progressOf(a);
  });
  sorted.forEach((r, i) => { r.rank = i + 1; });
}
function progressOf(r) { return r.crossings * world.length + r.s; }
function rubberFactor(gap) {
  return clamp(1 + clamp(gap, -180, 180) / 900, .88, 1.18);
}

function addScore(n) {
  score = Math.max(0, score + Math.round(n));
}
function triggerBoost(r, tier) {
  r.boostT = Math.max(r.boostT, tier === 2 ? 1.85 : .95);
  r.boostPow = Math.max(r.boostPow, tier === 2 ? 21 : 12);
  if (r.isPlayer) {
    addScore(tier * 40);
    audio.sfx.boost(tier);
    trauma = Math.min(.45, trauma + .18);
    report('event', { tag: tier === 2 ? 'drift-boost-2' : 'drift-boost-1', score });
    toast(tier === 2 ? '二段星焰加速！' : '漂移加速', 1.1);
    spawnBurst(r, tier === 2 ? 0xffe0a2 : 0x8fe9dc, 12, 5);
  }
}

function playerControls() {
  const brake = keys.has('KeyS') || keys.has('ArrowDown') || keys.has('TouchBrake');
  const auto = hasTouch && !brake;
  const throttle = keys.has('KeyW') || keys.has('ArrowUp') || auto;
  const steer = (keys.has('KeyD') || keys.has('ArrowRight') || keys.has('TouchRight') ? 1 : 0)
    - (keys.has('KeyA') || keys.has('ArrowLeft') || keys.has('TouchLeft') ? 1 : 0);
  const drift = keys.has('ShiftLeft') || keys.has('ShiftRight') || keys.has('TouchDrift');
  return { throttle, brake, steer, drift };
}
function aiControls(r) {
  const ai = r.ai || { phase: 0, skill: 1 };
  let target = Math.sin(r.s * .008 + ai.phase) * world.half * .44;
  if (!r.item && raceMode === 'gp') {
    let best = null, bd = 1e9;
    for (const b of boxes) {
      if (!b.active) continue;
      let d = (b.s - r.s + world.length) % world.length;
      if (d < 90 && Math.abs(b.lateral - r.lateral) < 7 && d < bd) { bd = d; best = b; }
    }
    if (best) target = best.lateral;
  }
  for (const bl of blocks) {
    let d = (bl.s - r.s + world.length) % world.length;
    if (d < 28 && Math.abs(bl.lateral - r.lateral) < 2.4) target = bl.lateral + (bl.lateral > 0 ? -3.4 : 3.4);
  }
  target = clamp(target, -world.half + 1.5, world.half - 1.5);
  return { throttle: r.spinT <= 0 ? 1 : 0, brake: false, steer: clamp((target - r.lateral) * .38, -1, 1), drift: false };
}
function doDrift(r, ctrl, dt) {
  if (!r.isPlayer) return;
  if (ctrl.drift && r.speed > 15 && Math.abs(ctrl.steer) > .12 && r.spinT <= 0) {
    if (r.driftT === 0) audio.sfx.driftStart();
    r.driftT += dt;
    r.driftCharge = Math.min(2.1, r.driftCharge + dt * (.72 + Math.abs(ctrl.steer) * .6));
    r.driftHeld = true;
  } else if (r.driftHeld && (!ctrl.drift || r.spinT > 0)) {
    const ch = r.driftCharge;
    r.driftHeld = false;
    r.driftT = 0;
    r.driftCharge = 0;
    if (ch > .45) triggerBoost(r, ch >= 1.4 ? 2 : 1);
  }
}

function updateRacer(r, dt) {
  if (r.finished) return;
  const ctrl = r.isPlayer && !playerAuto ? playerControls() : aiControls(r);
  r.throttle = ctrl.throttle ? 1 : 0;
  r.steer = ctrl.steer;
  const drifting = r.driftHeld;
  if (r.spinT > 0) {
    r.spinT = Math.max(0, r.spinT - dt);
    r.speed *= Math.pow(.18, dt);
    r.boostT = 0;
    r.boostPow = 0;
    r.driftHeld = false;
    r.driftT = 0;
    r.driftCharge = 0;
  } else {
    doDrift(r, ctrl, dt);
    let baseMax = r.isPlayer ? 52 : 48 + r.ai.skill * 4.6;
    if (!r.isPlayer) {
      const gap = progressOf(player) - progressOf(r);
      baseMax *= rubberFactor(gap);
    }
    if (drifting) baseMax *= .965;
    const max = baseMax + (r.boostT > 0 ? r.boostPow : 0);
    if (ctrl.throttle) r.speed += (r.boostT > 0 ? 40 : 25.5) * dt;
    else r.speed -= 12 * dt;
    if (ctrl.brake) r.speed -= 38 * dt;
    r.speed = clamp(r.speed, 0, max);
    r.lateral += ctrl.steer * (4.6 + r.speed * .135) * (drifting ? 1.55 : 1) * dt;
    r.lateral = clamp(r.lateral, -world.half + 1.25, world.half - 1.25);
    if (r.boostT > 0) {
      r.boostT = Math.max(0, r.boostT - dt);
      if (r.boostT === 0) r.boostPow = 0;
    }
  }
  r.s += r.speed * dt;
  while (r.s >= world.length) {
    r.s -= world.length;
    r.crossings++;
    const lapT = raceT - r.lapStart;
    r.lapTimes.push(lapT);
    r.lapStart = raceT;
    if (r.isPlayer) {
      addScore(500);
      report('progress', {
        score, progress: +(r.crossings / LAPS).toFixed(3), lap: Math.min(LAPS, r.crossings + 1),
        track: TRACKS[trackIndex].id, timeMs: Math.round(raceT * 1000)
      });
      audio.sfx.lap();
      if (r.crossings < LAPS) {
        banner(r.crossings === LAPS - 1 ? '最后一圈' : `第 ${r.crossings + 1} 圈`, `最快 ${fmtTime(Math.min(...r.lapTimes))}`, 1.25);
      }
    }
    r.lap = Math.min(LAPS, r.crossings + 1);
    if (r.crossings >= LAPS) { finishRacer(r); break; }
  }
  if (!r.isPlayer && r.spinT <= 0 && raceMode === 'gp') {
    r.itemTimer -= dt;
    if (r.item && r.itemTimer <= 0 && !noAuto) {
      useItem(r);
      r.itemTimer = 2.4 + rnd() * 3.5;
    }
  }
}
function finishRacer(r) {
  if (r.finished) return;
  r.finished = true;
  r.finishT = raceT;
  r.finishRank = r.rank;
  if (r.isPlayer) finishRace();
}
function finishRace() {
  if (raceOver) return;
  raceOver = true;
  screen = 'results';
  ui.banner.classList.remove('on');
  updateRanks();
  const rank = player.rank;
  score += Math.max(0, (5 - rank) * 220) + Math.max(0, Math.floor((RACE_LIMIT - raceT) * 2));
  score = Math.round(score);
  updateBest(rank);
  report('complete', {
    score, progress: 1, rank, track: TRACKS[trackIndex].id,
    timeMs: Math.round(raceT * 1000), mode: raceMode
  });
  audio.sfx.win();
  audio.stopEngine();
  audio.setState('result');
  showResults(false);
}
function failRace(reason = '时间耗尽') {
  if (raceOver) return;
  raceOver = true;
  dnf = true;
  screen = 'results';
  report('gameOver', {
    score: Math.round(score), progress: +(progressOf(player) / (world.length * LAPS)).toFixed(3),
    reason, track: TRACKS[trackIndex].id
  });
  audio.sfx.lose();
  audio.stopEngine();
  audio.setState('result');
  showResults(true, reason);
}
function updateBest(rank) {
  const id = TRACKS[trackIndex].id;
  const prev = bestData.tracks[id] || {};
  const fastest = player.lapTimes.length ? Math.min(...player.lapTimes) : 0;
  const best = {
    rank: !prev.rank || rank < prev.rank ? rank : prev.rank,
    lap: !prev.lap || (fastest > 0 && fastest < prev.lap) ? fastest : prev.lap,
    score: Math.max(prev.score || 0, score)
  };
  bestData.tracks[id] = best;
  bestData.races = (bestData.races || 0) + 1;
  if (rank === 1) bestData.wins = (bestData.wins || 0) + 1;
  saveBest();
  refreshTrackMeta();
}
function showResults(failed, reason = '') {
  screen = 'results';
  ui.hud.classList.remove('on');
  ui.results.classList.remove('hide');
  ui.touch.classList.remove('on');
  const rank = player.rank;
  const fastest = player.lapTimes.length ? Math.min(...player.lapTimes) : 0;
  ui.rescap.textContent = failed ? 'TIME UP · 未完赛' : 'RACE COMPLETE · 冲线';
  ui.resh.textContent = failed ? '星环熄灯' : (rank === 1 ? '冲线夺冠' : `冲线 · 第 ${rank} 名`);
  const b = trackBest();
  const newBest = !failed && b && b.rank === rank && (!b.lap || fastest <= b.lap + .001);
  ui.ressub.innerHTML = failed
    ? `${TRACKS[trackIndex].name} · ${reason}`
    : `${TRACKS[trackIndex].name} · ${raceMode === 'tt' ? '计时赛' : '竞速赛'}${newBest ? ' · <span class="newbest">新纪录</span>' : ''}`;
  ui.rpos.textContent = failed ? '--' : rank;
  ui.rtime.textContent = failed ? fmtShort(raceT) : fmtShort(raceT);
  ui.rlap.textContent = fastest ? fmtTime(fastest) : '--:--';
  ui.rscore.textContent = Math.round(score);
  const sorted = [...racers].sort((a, b2) => a.rank - b2.rank);
  ui.resultRows.innerHTML = sorted.map(r => {
    const t = r.finished ? fmtTime(r.finishT) : '未完赛';
    return `<div class="rrow ${r.isPlayer ? 'me' : ''}"><span class="rk">${r.rank}</span><span class="nm">${r.name}</span><span class="tm">${t}</span></div>`;
  }).join('');
  updateBestLine();
}

// ---------- items / pickups / hazards ----------
function useItem(r) {
  if (!r || !r.item || screen !== 'race' || paused || r.finished) return false;
  const kind = r.item;
  r.item = null;
  if (kind === 'dash') {
    triggerBoost(r, 2);
    if (r.isPlayer) { addScore(40); toast('星焰冲刺！', 1.1); }
    if (!r.isPlayer) audio.sfx.boost(1);
  } else if (kind === 'missile') {
    fireMissile(r);
    if (r.isPlayer) { addScore(35); toast('追踪弹已发射', 1.1); }
  } else if (kind === 'block') {
    dropBlock(r);
    if (r.isPlayer) { addScore(30); toast('路障已丢在身后', 1.1); }
  }
  if (r.isPlayer) { updateItemSlot(); hitStop = .06; }
  return true;
}
function fireMissile(r) {
  const mine = progressOf(r);
  let target = null, bestD = 1e9;
  for (const o of racers) {
    if (o === r || o.finished) continue;
    let d = progressOf(o) - mine;
    if (d > 0 && d < 260 && d < bestD) { bestD = d; target = o; }
  }
  const mesh = makeMissile(r.isPlayer ? 0xffcf7a : 0xcf9bff);
  mesh.position.copy(r.group.position).add(new THREE.Vector3(0, 1.2, 0));
  scene.add(mesh);
  missiles.push({ mesh, source: r, target, t: 0, dur: .65 + Math.min(.45, bestD / 500), from: mesh.position.clone() });
  audio.sfx.missile();
}
function dropBlock(r) {
  const a = world.pointAt(r.s - 7);
  const mesh = makeRoadblock();
  mesh.position.copy(a.p).addScaledVector(a.right, r.lateral);
  mesh.position.y += .12;
  mesh.rotation.y = Math.atan2(a.tan.x, a.tan.z);
  scene.add(mesh);
  blocks.push({ mesh, s: (r.s - 7 + world.length) % world.length, lateral: r.lateral, life: 24, hit: new Set() });
  audio.sfx.drop();
}
function applyHit(r, from) {
  if (r.spinT > 0) return;
  r.spinT = 1.15;
  r.speed *= .42;
  r.boostT = 0;
  spawnBurst(r, 0xff8a4c, 16, 7);
  if (r.isPlayer) {
    hitStop = .085;
    trauma = Math.min(.7, trauma + .35);
    audio.sfx.hit();
    toast('被击中！稳住方向', 1.4);
  }
}
function updateMissiles(dt) {
  for (let i = missiles.length - 1; i >= 0; i--) {
    const m = missiles[i];
    m.t += dt;
    if (m.target) {
      const dest = m.target.group.position.clone().add(new THREE.Vector3(0, 1.1, 0));
      const k = clamp(m.t / m.dur, 0, 1);
      const arc = Math.sin(k * Math.PI) * 5;
      m.mesh.position.lerpVectors(m.from, dest, k);
      m.mesh.position.y += arc;
      m.mesh.lookAt(dest);
      if (k >= 1) {
        applyHit(m.target, m.source);
        disposeObject(m.mesh);
        missiles.splice(i, 1);
      }
    } else if (m.t > m.dur) {
      spawnBurstPos(m.mesh.position, 0xffcf7a, 8, 5);
      disposeObject(m.mesh);
      missiles.splice(i, 1);
    }
  }
}
function updateBlocks(dt) {
  for (let i = blocks.length - 1; i >= 0; i--) {
    const b = blocks[i];
    b.life -= dt;
    b.mesh.rotation.y += dt * .35;
    let hit = false;
    for (const r of racers) {
      if (r.finished || b.hit.has(r)) continue;
      let d = (b.s - r.s + world.length) % world.length;
      if (d < 4.2 && Math.abs(b.lateral - r.lateral) < 2.25) {
        b.hit.add(r);
        applyHit(r, null);
        hit = true;
      }
    }
    if (hit || b.life <= 0) {
      disposeObject(b.mesh);
      blocks.splice(i, 1);
    }
  }
}
function updatePickups(r) {
  if (raceMode !== 'gp' || r.item) return;
  for (const b of boxes) {
    if (!b.active) continue;
    let d = (b.s - r.s + world.length) % world.length;
    if (d < 3.4 && Math.abs(b.lateral - r.lateral) < 2.3) {
      b.active = false;
      b.respawn = noAuto ? 999 : 8.5;
      b.mesh.visible = false;
      b.glow.visible = false;
      if (r.isPlayer) {
        const roll = rnd();
        r.item = roll < .34 ? 'dash' : roll < .67 ? 'missile' : 'block';
        addScore(25);
        audio.sfx.pickup();
        updateItemSlot();
        report('event', { tag: 'item-pickup', score, item: r.item });
      } else {
        const roll = rnd();
        r.item = roll < .4 ? 'dash' : roll < .73 ? 'missile' : 'block';
      }
      return;
    }
  }
}

// ---------- effects ----------
function spawnBurst(r, color, n = 10, power = 4) {
  if (!r || !r.group) return;
  spawnBurstPos(r.group.position.clone().add(new THREE.Vector3(0, .5, 0)), color, n, power);
}
function spawnBurstPos(pos, color, n = 10, power = 4) {
  if (fx.length > 140) return;
  for (let i = 0; i < n; i++) {
    const sp = makeDustSprite(color);
    sp.position.copy(pos);
    const a = Math.random() * Math.PI * 2, h = Math.random() * 2;
    sp.scale.setScalar(.7 + Math.random() * 1.4);
    scene.add(sp);
    fx.push({
      sprite: sp,
      life: .35 + Math.random() * .35,
      max: .7,
      vx: Math.cos(a) * power * (.3 + Math.random()),
      vy: h * power * .55,
      vz: Math.sin(a) * power * (.3 + Math.random())
    });
  }
}
function updateFx(dt) {
  for (let i = fx.length - 1; i >= 0; i--) {
    const f = fx[i];
    f.life -= dt;
    if (f.life <= 0) { disposeObject(f.sprite); fx.splice(i, 1); continue; }
    f.sprite.position.x += f.vx * dt;
    f.sprite.position.y += f.vy * dt;
    f.sprite.position.z += f.vz * dt;
    f.vy -= 3.4 * dt;
    f.sprite.material.opacity = Math.max(0, f.life / f.max) * .72;
  }
}
function updateBoxAnim(dt) {
  for (let i = 0; i < boxes.length; i++) {
    const b = boxes[i];
    if (!b.active) {
      if (raceMode === 'gp' && screen === 'race' && !noAuto) {
        b.respawn -= dt;
        if (b.respawn <= 0) {
          b.active = true;
          b.mesh.visible = true; b.glow.visible = true;
        }
      }
      continue;
    }
    b.mesh.rotation.y += dt * 1.2;
    b.mesh.rotation.x = Math.sin(performance.now() * .001 + b.phase) * .16;
    b.mesh.position.y = b.baseY + Math.sin(performance.now() * .002 + b.phase) * .22;
    b.glow.material.opacity = .35 + Math.sin(performance.now() * .003 + b.phase) * .15;
  }
}
function updateEffects(dt) {
  updateFx(dt);
  updateBoxAnim(dt);
  updateMissiles(dt);
  updateBlocks(dt);
  if (trauma > 0) trauma = Math.max(0, trauma - dt * 1.6);
  if (toastT > 0) { toastT -= dt; if (toastT <= 0) ui.toast.classList.remove('on'); }
  if (hintT > 0) {
    hintT -= dt;
    ui.hint.classList.toggle('on', hintT > 0 && screen === 'race' && !paused);
  } else ui.hint.classList.remove('on');
}

// ---------- update ----------
function raceInput() {
  return playerControls();
}
function updateRace(dt) {
  raceT += dt;
  if (raceT > RACE_LIMIT) { failRace('时间耗尽'); return; }
  for (const r of racers) updateRacer(r, dt);
  for (const r of racers) updatePickups(r);
  updateRanks();
  updateEffects(dt);
  const pc = player;
  if (pc) {
    audio.engine(pc.speed, pc.boostT > 0, pc.driftHeld);
    if ((pc.driftHeld || pc.boostT > 0) && pc.speed > 4) {
      pc.fxT -= dt;
      if (pc.fxT <= 0) {
        pc.fxT = .045;
        const back = pc.group.position.clone().addScaledVector(world.pointAt(pc.s).tan, -1.8);
        spawnBurstPos(back, pc.boostT > 0 ? 0xffd08a : (pc.driftHeld ? 0xff8a4c : 0x8fe9dc), 2, 2.2);
      }
    }
  }
  updateHUD();
}
function updateTitle(dt) {
  titleT += dt;
  const p = world.pointAt(9).p;
  const a = titleT * .07;
  camera.position.set(p.x + Math.cos(a) * 27, p.y + 14, p.z + Math.sin(a) * 27);
  camera.lookAt(p.x, p.y + 2.2, p.z);
  updateEffects(dt);
}
function updateResults(dt) {
  updateEffects(dt);
  if (player) {
    const p = player.group.position;
    const a = performance.now() * .00008;
    camera.position.lerp(new THREE.Vector3(p.x + Math.cos(a) * 16, p.y + 7, p.z + Math.sin(a) * 16), 1 - Math.pow(.02, dt));
    camera.lookAt(p.x, p.y + 1, p.z);
  }
}
function tick(dt) {
  processPressed();
  if (paused) { audio.stopEngine(); pressed.clear(); return; }
  if (hitStop > 0) {
    hitStop -= dt;
    updateEffects(dt);
    pressed.clear();
    return;
  }
  if (screen === 'title') updateTitle(dt);
  else if (screen === 'countdown') {
    countdownT -= dt;
    const n = Math.max(1, Math.ceil(countdownT));
    if (String(n) !== lastCountShown) {
      lastCountShown = String(n);
      ui.countn.textContent = String(n);
      ui.countn.style.animation = 'none'; void ui.countn.offsetWidth; ui.countn.style.animation = '';
      audio.sfx.count();
    }
    updateEffects(dt);
    for (const r of racers) placeRacer(r, dt);
    updateFollowCamera(dt, true);
    if (countdownT <= 0) beginRace();
  } else if (screen === 'race') {
    updateRace(dt);
    updateFollowCamera(dt);
  } else if (screen === 'results') updateResults(dt);
  pressed.clear();
}
function processPressed() {
  if (pressed.has('KeyM')) toggleMute();
  if (pressed.has('KeyP') || pressed.has('Escape') || pressed.has('TouchPause')) {
    if (screen === 'race' || screen === 'countdown' || screen === 'results') togglePause();
  }
  if (pressed.has('KeyR') && screen === 'race' && player && !paused) resetPlayerToTrack();
  if ((pressed.has('KeyE') || pressed.has('Space')) && screen === 'race' && !paused) {
    if (player) useItem(player);
  }
}

// ---------- placement / camera / render ----------
function placeRacer(r, dt) {
  if (!r.group) return;
  const a = world.pointAt(r.s);
  const pos = a.p.clone().addScaledVector(a.right, r.lateral);
  r.group.position.set(pos.x, pos.y + .56, pos.z);
  const yaw = Math.atan2(a.tan.x, a.tan.z);
  r.group.rotation.order = 'YXZ';
  r.group.rotation.y = yaw - r.steer * .06 + (r.spinT > 0 ? r.spinT * 11 : 0);
  r.group.rotation.z = -r.steer * .1;
  r.group.rotation.x = r.boostT > 0 ? -.025 : 0;
  if (r.group.userData.wheels) {
    for (const w of r.group.userData.wheels) w.rotation.x += r.speed * (dt || DT) * 1.2;
  }
  if (r.group.userData.glow) {
    r.group.userData.glow.material.opacity = r.boostT > 0 ? .85 : (r.isPlayer ? .46 : .25);
    const s = r.boostT > 0 ? 5.2 : 3.8;
    r.group.userData.glow.scale.set(s, 1.7, 1);
  }
}
function placeAll(dt) {
  for (const r of racers) placeRacer(r, dt);
}
function updateFollowCamera(dt, snap = false) {
  if (!player) return;
  const a = world.pointAt(player.s);
  const p = player.group.position;
  const back = 6.4 + player.speed * .014;
  const high = 4.5 + player.speed * .011;
  const desired = p.clone().addScaledVector(a.tan, -back).add(new THREE.Vector3(0, high, 0));
  if (snap) camera.position.copy(desired);
  else camera.position.lerp(desired, 1 - Math.exp(-30 * dt));
  const look = p.clone().addScaledVector(a.tan, 7.2).add(new THREE.Vector3(0, 1.35, 0));
  camera.lookAt(look);
  const fov = 62 + clamp((player.speed - 25) * .17, 0, 8) + (player.boostT > 0 ? 4 : 0);
  if (Math.abs(camera.fov - fov) > .02) { camera.fov += (fov - camera.fov) * .1; camera.updateProjectionMatrix(); }
}
function render() {
  if (!world) return;
  placeAll(0);
  if (trauma > .001) {
    camera.position.x += (Math.random() - .5) * trauma * .6;
    camera.position.y += (Math.random() - .5) * trauma * .35;
  }
  renderer.render(scene, camera);
}

// ---------- HUD ----------
function updateHUD() {
  if (!player) return;
  ui.pos.textContent = player.rank;
  const suffix = document.querySelector('.bigpos .suf');
  if (suffix) suffix.textContent = '/ ' + racers.length;
  ui.lap.textContent = Math.min(LAPS, player.crossings + 1);
  ui.timer.textContent = fmtTime(raceT);
  ui.speedo.innerHTML = `${Math.round(player.speed * 3.6)}<small> KM/H</small>`;
  ui.speedfill.style.width = clamp(player.speed / 78 * 100, 0, 100) + '%';
  const charge = player.driftCharge;
  if (charge > .03 || player.boostT > 0) {
    ui.boostbar.classList.add('on');
    ui.boostfill.style.width = clamp(player.boostT > 0 ? 100 : charge / 2.1 * 100, 0, 100) + '%';
  } else ui.boostbar.classList.remove('on');
  updateItemSlot();
  drawMinimap();
}
function updateItemSlot() {
  if (!player) return;
  if (!player.item) {
    ui.itemSlot.classList.add('empty');
    ui.itemIcon.textContent = '·';
    ui.itemName.textContent = '暂无道具';
    ui.itemKey.textContent = '穿过问号箱拾取';
  } else {
    const d = ITEM_DEFS[player.item];
    ui.itemSlot.classList.remove('empty');
    ui.itemIcon.textContent = d.glyph;
    ui.itemName.textContent = d.name;
    ui.itemKey.textContent = d.key + ' · E';
  }
}
let mmBg = null;
function drawMinimap() {
  const cv = ui.minimap;
  if (!cv || !world) return;
  const g = cv.getContext('2d');
  const w = cv.width, h = cv.height;
  if (!mmBg) {
    g.clearRect(0, 0, w, h);
  }
  g.clearRect(0, 0, w, h);
  let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
  for (const p of world.minimap) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z); }
  const pad = 18;
  const sc = Math.min((w - pad * 2) / Math.max(1, maxX - minX), (h - pad * 2) / Math.max(1, maxZ - minZ));
  const ox = (w - (maxX - minX) * sc) / 2, oz = (h - (maxZ - minZ) * sc) / 2;
  const mx = p => ox + (p.x - minX) * sc;
  const mz = p => oz + (p.z - minZ) * sc;
  g.beginPath();
  world.minimap.forEach((p, i) => { i ? g.lineTo(mx(p), mz(p)) : g.moveTo(mx(p), mz(p)); });
  g.closePath();
  g.strokeStyle = 'rgba(232,180,99,.42)'; g.lineWidth = 5; g.lineJoin = 'round'; g.stroke();
  g.strokeStyle = 'rgba(101,198,179,.25)'; g.lineWidth = 1.5; g.stroke();
  for (const r of racers) {
    const p = world.pointAt(r.s).p;
    g.beginPath(); g.arc(mx(p), mz(p), r.isPlayer ? 4 : 3, 0, Math.PI * 2);
    g.fillStyle = r.isPlayer ? '#ffe0a2' : '#' + r.color.toString(16).padStart(6, '0');
    g.fill();
    if (r.isPlayer) { g.strokeStyle = 'rgba(101,198,179,.9)'; g.lineWidth = 1.5; g.stroke(); }
  }
}

// ---------- main loop ----------
let last = performance.now();
let acc = 0;
function loop(ts) {
  requestAnimationFrame(loop);
  if (testActive) return;
  const dt = Math.min(.12, Math.max(0, (ts - last) / 1000));
  last = ts;
  acc += dt;
  let guard = 0;
  while (acc >= DT && guard++ < 8) { tick(DT); acc -= DT; }
  render();
}
requestAnimationFrame(loop);
resize();

// ---------- G debug hooks ----------
const G = {
  err: window.__BOOTERR,
  step: (n = 60, dt = DT) => { for (let i = 0; i < n; i++) { tick(dt); render(); } },
  upd: (n = 30, dt = DT) => { for (let i = 0; i < n; i++) tick(dt); },
  press: (...codes) => { for (const c of codes) { keys.add(c); pressed.add(c); } },
  release: (...codes) => { for (const c of codes) keys.delete(c); },
  setNoAuto: (v) => { noAuto = !!v; },
  setReportTarget: (fn) => { reportTarget = fn; },
  startRace: (opts = {}) => startRace(opts),
  toTitle: () => toTitle(),
  again: () => startRace({ mode: raceMode, track: trackIndex }),
  setTrack: (i) => { if (screen === 'title') { trackIndex = clamp(i | 0, 0, 2); setWorld(trackIndex); buildTrackCards(); } },
  setS: (v) => { if (player) { player.s = ((v % world.length) + world.length) % world.length; placeRacer(player, 0); } },
  setSpeed: (v) => { if (player) player.speed = Math.max(0, Number(v) || 0); },
  setCrossings: (v) => { if (player) { player.crossings = Math.max(0, v | 0); player.lap = Math.min(LAPS, player.crossings + 1); } },
  setRaceTime: (v) => { raceT = Math.max(0, Number(v) || 0); },
  setScore: (v) => { score = Math.max(0, Math.round(Number(v) || 0)); },
  setPaused: (v) => { paused = !!v; ui.pause.classList.toggle('hide', !paused); },
  setLateral: (v) => { if (player) player.lateral = clamp(Number(v) || 0, -world.half + 1.25, world.half - 1.25); },
  setAI: (i, s, lateral) => { const r = racers.filter(x => !x.isPlayer)[i]; if (r) { r.s = ((Number(s) % world.length) + world.length) % world.length; if (lateral !== undefined) r.lateral = clamp(Number(lateral) || 0, -world.half + 1.25, world.half - 1.25); } },
  aiStates: () => racers.filter(r => !r.isPlayer).map(r => ({ name: r.name, s: +r.s.toFixed(2), lateral: +r.lateral.toFixed(2), spinT: +r.spinT.toFixed(3), item: r.item, finished: r.finished })),
  hazards: () => ({ blocks: blocks.length, missiles: missiles.length }),
  grantItem: (kind) => { if (player) { player.item = ITEM_DEFS[kind] ? kind : 'dash'; updateItemSlot(); } },
  useItem: () => { const ok = player ? useItem(player) : false; updateHUD(); return ok; },
  forceFinish: () => { if (player) finishRace(); },
  forceDNF: () => failRace('测试退赛'),
  getBox: (i) => boxes[i],
  setBoxActive: (i, v) => { if (boxes[i]) { boxes[i].active = !!v; boxes[i].mesh.visible = !!v; boxes[i].glow.visible = !!v; } },
  rubberFactor,
  trackSample: (i = trackIndex) => {
    const t = TRACKS[i];
    const c = new THREE.CatmullRomCurve3((() => {
      const pts = [];
      const N = 18;
      for (let k = 0; k < N; k++) {
        const a = k / N * Math.PI * 2;
        let rr = 1;
        for (const [kk, amp, ph] of t.shape.h) rr += amp * Math.sin(kk * a + ph);
        pts.push(new THREE.Vector3(Math.cos(a) * t.shape.rx * rr, 5 + t.shape.yAmp * Math.sin(t.shape.yFreq * a + .7), Math.sin(a) * t.shape.rz * rr));
      }
      return pts;
    })(), true, 'catmullrom', .42);
    return { length: c.getLength(), point: c.getPointAt(.1) };
  },
  renderInfo: () => ({ calls: renderer.info.render.calls, triangles: renderer.info.render.triangles }),
  visual: () => ({ camera: camera.position.toArray().map(v => +v.toFixed(2)), racers: racers.map(r => ({ name: r.name, isPlayer: r.isPlayer, s: +r.s.toFixed(1), pos: r.group.position.toArray().map(v => +v.toFixed(2)), color: r.group.children[0].material.color.getHexString(), rank: r.rank, speed: +r.speed.toFixed(1) })) }),
  state: () => ({
    screen, paused, mode: raceMode, track: TRACKS[trackIndex].id, trackIndex,
    score, raceT: +raceT.toFixed(3), countdown: +countdownT.toFixed(3),
    racerCount: racers.length, aiCount: racers.filter(r => !r.isPlayer).length,
    rank: player ? player.rank : 0,
    s: player ? +player.s.toFixed(3) : 0,
    speed: player ? +player.speed.toFixed(3) : 0,
    lateral: player ? +player.lateral.toFixed(3) : 0,
    lap: player ? player.lap : 0, crossings: player ? player.crossings : 0,
    item: player ? player.item : null,
    driftCharge: player ? +player.driftCharge.toFixed(3) : 0,
    boostT: player ? +player.boostT.toFixed(3) : 0,
    boostPow: player ? player.boostPow : 0,
    spinT: player ? +player.spinT.toFixed(3) : 0,
    finished: player ? player.finished : false,
    dnf, raceOver, trackLength: world ? +world.length.toFixed(2) : 0,
    best: bestData,
    positions: [...racers].sort((a, b) => a.rank - b.rank).map(r => ({ name: r.name, rank: r.rank, s: +r.s.toFixed(2), crossings: r.crossings, finished: r.finished }))
  }),
  reports,
  tracks: TRACKS,
  items: ITEM_DEFS,
  audio,
  world: () => world
};
window.G = G;
window.__G = G;

report('ready', { game: 'orbit-kart-grand-prix', title: 'Orbit Kart Grand Prix' });

if (AUTOSTART) {
  setTimeout(() => {
    startRace({ mode: params.get('mode') === 'tt' ? 'tt' : 'gp', track: clamp(parseInt(params.get('track') || '0', 10) || 0, 0, 2), skipCountdown: true });
    playerAuto = true;
    hintT = 0;
    ui.hint.classList.remove('on');
  }, 80);
}

// ---------- autotest ----------
const nap = () => new Promise(r => { const mc = new MessageChannel(); mc.port1.onmessage = () => r(); mc.port2.postMessage(0); });
async function autotest() {
  G.setNoAuto(true);
  testActive = true;
  audio.setMuted(true);
  const results = [];
  const frames = [];
  const originalBestRaw = (() => { try { return localStorage.getItem(BEST_KEY); } catch (e) { return null; } })();
  const originalMuteRaw = savedMute;
  const assert = (id, ok, name) => {
    results.push({ id, ok: !!ok, name: name || '' });
    if (!ok) console.warn(`[T${id}] FAIL ${name || ''}`);
  };
  let savedBestObj = JSON.parse(JSON.stringify(bestData));
  const prevMute = muted;
  try {
    G.setReportTarget(f => frames.push(f));
    await nap();

    // 1 — clean boot
    assert(1, G.err.length === 0, `启动零报错 (${G.err.length})`);

    // 2 — finite state after 120 frames
    G.startRace({ mode: 'gp', track: 0, skipCountdown: true });
    G.upd(120);
    {
      const s = G.state();
      const finite = [s.s, s.speed, s.lateral, s.raceT, s.score, s.rank, s.boostT, s.driftCharge].every(Number.isFinite);
      assert(2, finite && s.racerCount === 4, `数值无 NaN, racers=${s.racerCount}`);
    }

    // 3 — input simulation moves the kart
    G.startRace({ mode: 'gp', track: 0, skipCountdown: true });
    const s0 = G.state().s;
    G.press('KeyW');
    G.upd(120);
    const s1 = G.state();
    G.release('KeyW');
    assert(3, s1.speed > 5 && s1.s !== s0, `输入生效 speed=${s1.speed.toFixed(1)}`);

    // 4 — drift charge builds while steering
    G.startRace({ mode: 'gp', track: 0, skipCountdown: true });
    G.setSpeed(35);
    G.press('ShiftLeft', 'KeyD');
    G.upd(55);
    const drift = G.state();
    assert(4, drift.driftCharge > .3 && drift.driftCharge <= 2.1, `漂移蓄气 ${drift.driftCharge}`);
    G.release('ShiftLeft', 'KeyD');
    G.upd(2);

    // 5 — releasing a charged drift fires a boost
    const boost = G.state();
    assert(5, boost.boostT > 0 && boost.boostPow > 0, `漂移释放 boost=${boost.boostT}`);

    // 6 — dash item adds score and boost (economy + effect)
    G.startRace({ mode: 'gp', track: 0, skipCountdown: true });
    G.setScore(100);
    G.grantItem('dash');
    const okDash = G.useItem();
    const dashState = G.state();
    assert(6, okDash && dashState.item === null && dashState.boostT > 0 && dashState.score >= 140, `冲刺道具 score=${dashState.score}`);

    // 7 — homing missile spins the kart ahead
    G.startRace({ mode: 'gp', track: 0, skipCountdown: true });
    G.setS(100);
    G.setAI(0, 155, 0); G.setAI(1, 190, 3); G.setAI(2, 230, -3);
    G.grantItem('missile');
    G.useItem();
    G.upd(55);
    {
      const ais = G.aiStates();
      assert(7, ais[0].spinT > 0, `追踪弹命中前车 spin=${ais[0].spinT}`);
    }

    // 8 — a dropped roadblock collides with a following kart
    G.startRace({ mode: 'gp', track: 0, skipCountdown: true });
    G.setS(400);
    G.setLateral(1);
    G.setSpeed(8);
    G.grantItem('block');
    const blockUsed = G.useItem();
    G.setAI(0, 390, 1);
    G.upd(4);
    {
      const ais = G.aiStates();
      assert(8, blockUsed && ais[0].spinT > 0 && G.hazards().blocks === 0, `路障命中后车 spin=${ais[0].spinT}`);
    }

    // 9 — lap crossing increments lap and awards 500
    G.startRace({ mode: 'gp', track: 0, skipCountdown: true });
    const beforeLap = G.state();
    G.setS(beforeLap.trackLength - 1);
    G.setCrossings(0);
    G.setSpeed(40);
    G.setScore(0);
    G.upd(10);
    const lapState = G.state();
    assert(9, lapState.crossings === 1 && lapState.lap === 2 && lapState.score >= 500, `圈数 ${lapState.lap}, score=${lapState.score}`);

    // 10 — standings put the leader first
    G.startRace({ mode: 'gp', track: 0, skipCountdown: true });
    G.setCrossings(2);
    G.setS(10);
    G.upd(2);
    const rankState = G.state();
    assert(10, rankState.rank === 1 && rankState.positions[0].name === '你', `名次 P${rankState.rank}`);

    // 11 — rubber-band curve is monotonic and clamped
    const rb0 = G.rubberFactor(-180), rb1 = G.rubberFactor(0), rb2 = G.rubberFactor(180);
    assert(11, rb0 >= .879 && rb1 === 1 && rb2 <= 1.181 && rb2 > rb1 && rb0 < rb1, `rubber ${rb0.toFixed(2)}/${rb1.toFixed(2)}/${rb2.toFixed(2)}`);

    // 12 — real item-box pickup grants item + 25 points
    G.startRace({ mode: 'gp', track: 0, skipCountdown: true });
    G.setScore(0);
    {
      const b = G.getBox(0);
      G.setS(b.s - 2.2);
      G.setLateral(b.lateral);
      G.setSpeed(32);
      G.upd(5);
      const st = G.state();
      assert(12, !!st.item && st.score >= 25, `问号箱 item=${st.item} score=${st.score}`);
    }

    // 13 — timeout failure path
    G.startRace({ mode: 'gp', track: 0, skipCountdown: true });
    frames.length = 0;
    G.setRaceTime(RACE_LIMIT + 1);
    G.upd(2);
    const dnfState = G.state();
    assert(13, dnfState.dnf && dnfState.screen === 'results' && frames.some(f => f.kind === 'gameOver'), '超时可失败并上报 gameOver');

    // 14 — finish path completes the race
    G.startRace({ mode: 'gp', track: 0, skipCountdown: true });
    frames.length = 0;
    G.setCrossings(2);
    G.setS(G.state().trackLength - 1);
    G.setSpeed(45);
    G.upd(8);
    const finState = G.state();
    assert(14, finState.finished && finState.screen === 'results' && !finState.dnf && frames.some(f => f.kind === 'complete'), '冲线通关并上报 complete');

    // 15 — protocol frame sequence and integer score
    assert(15, reports[0] && reports[0].kind === 'ready' && frames.some(f => f.kind === 'complete') && frames.every(f => f.score === undefined || Number.isInteger(f.score)), `上报 ${reports[0] && reports[0].kind} → ${frames.map(f => f.kind).join(',')}`);

    // 16 — best record persists, then restore
    {
      const raw = localStorage.getItem(BEST_KEY);
      let parsed = null;
      try { parsed = JSON.parse(raw); } catch (e) {}
      const tr = parsed && parsed.tracks && parsed.tracks[TRACKS[0].id];
      const st = G.state();
      assert(16, !!tr && tr.rank >= 1 && tr.lap > 0, `best 持久化 rank=${tr && tr.rank} lap=${tr && tr.lap && tr.lap.toFixed(2)}`);
    }

    // 17 — pause freezes the simulation
    G.startRace({ mode: 'gp', track: 0, skipCountdown: true });
    G.press('KeyP'); G.upd(2);
    const pauseS = G.state().s;
    G.setScore(77);
    G.press('KeyW'); G.upd(60);
    const pausedState = G.state();
    assert(17, pausedState.paused && Math.abs(pausedState.s - pauseS) < .001, `暂停冻结 s=${pausedState.s} paused=${pausedState.paused}`);
    G.release('KeyW');

    // 18 — resume and simulation advances
    G.press('KeyP'); G.upd(2);
    const resumed0 = G.state().s;
    G.press('KeyW'); G.upd(30); G.release('KeyW');
    assert(18, !G.state().paused && G.state().s !== resumed0, '恢复运行');

    // 19 — touch controls are bound
    const touchIds = ['tl', 'tr', 'tdrift', 'titem'];
    assert(19, touchIds.every(id => !!document.getElementById(id)), '触控元素存在');

    // 20 — audio safely creates / remains muted
    audio.setState('race');
    audio.setMuted(true);
    assert(20, audio.state() === 'race' && audio.isMuted() === true, '音频状态切换且静音');

    // 21 — restart resets score/laps/positions
    G.startRace({ mode: 'gp', track: 1, skipCountdown: true });
    const resetState = G.state();
    assert(21, resetState.score === 0 && resetState.crossings === 0 && resetState.lap === 1 && resetState.trackIndex === 1, '重开状态复位');

    // 22 — three AI + player
    assert(22, resetState.racerCount === 4 && resetState.aiCount === 3, '三名 AI 对手');

    // 23 — three circuits have real length
    const lens = [0, 1, 2].map(i => G.trackSample(i).length);
    assert(23, lens.every(v => Number.isFinite(v) && v > 600), `三条赛道长度 ${lens.map(v => v.toFixed(0)).join('/')}`);

    // 24 — track samples are finite and closed-ish
    const sample = G.trackSample(2);
    assert(24, Number.isFinite(sample.point.x + sample.point.y + sample.point.z), '赛道样点有限');

    // 25 — exactly three item kinds
    assert(25, Object.keys(ITEM_DEFS).length === 3 && !!ITEM_DEFS.dash && !!ITEM_DEFS.missile && !!ITEM_DEFS.block, '三种道具定义');

    // 26 — time trial removes AI and item pickups
    G.startRace({ mode: 'tt', track: 0, skipCountdown: true });
    const ttState = G.state();
    assert(26, ttState.aiCount === 0 && ttState.racerCount === 1, `计时赛 solo=${ttState.racerCount}`);

    // 27 — countdown holds the kart still
    G.startRace({ mode: 'gp', track: 0, skipCountdown: false });
    const cdStart = G.state().s;
    G.press('KeyW'); G.upd(50); G.release('KeyW');
    const cdState = G.state();
    assert(27, cdState.screen === 'countdown' && Math.abs(cdState.s - cdStart) < .001 && cdState.speed < 1, `倒计时冻结 screen=${cdState.screen} s=${cdState.s} speed=${cdState.speed}`);

    // 28 — a full three-lap run under simulation, no NaN / no new errors
    G.startRace({ mode: 'gp', track: 0, skipCountdown: true });
    const errBefore = G.err.length;
    G.press('KeyW');
    G.upd(6200);
    G.release('KeyW');
    const full = G.state();
    assert(28, full.finished && full.screen === 'results' && G.err.length === errBefore, `三圈快进 finished=${full.finished} score=${full.score}`);

    // 29 — rank always within field
    assert(29, full.rank >= 1 && full.rank <= 4, `名次范围 P${full.rank}`);

    // 30 — best lap preserved after finish
    {
      const tr = bestData.tracks[TRACKS[0].id];
      assert(30, tr && tr.lap > 0 && Number.isFinite(tr.lap), `最快圈持久化 ${tr && tr.lap}`);
    }

    // 31 — result UI shows four rows and is visible
    assert(31, !ui.results.classList.contains('hide') && ui.resultRows.querySelectorAll('.rrow').length === 4, '结算面板 4 行');

    // 32 — renderer produced geometry
    render();
    const ri = G.renderInfo();
    assert(32, ri.calls > 0 && ri.triangles > 0, `渲染 calls=${ri.calls} tris=${ri.triangles}`);

    // 33 — every report payload score is integer
    assert(33, reports.every(f => f.score === undefined || Number.isInteger(f.score)), '上报分数为整数');

    // 34 — return to title
    G.toTitle();
    await nap();
    const end = G.state();
    assert(34, end.screen === 'title' && !ui.title.classList.contains('hide') && !ui.hud.classList.contains('on'), '测完回标题');
  } catch (err) {
    window.__TEST_ERR = String(err && err.stack || err);
    console.error('[autotest] crashed:', window.__TEST_ERR);
    assert(999, false, 'autotest 未崩溃');
  } finally {
    // restore user data and mute preference
    try {
      if (originalBestRaw === null) localStorage.removeItem(BEST_KEY);
      else localStorage.setItem(BEST_KEY, originalBestRaw);
    } catch (e) {}
    bestData = savedBestObj;
    try {
      if (originalMuteRaw === null) localStorage.removeItem(MUTE_KEY);
      else localStorage.setItem(MUTE_KEY, originalMuteRaw);
    } catch (e) {}
    muted = prevMute;
    audio.setMuted(true);
    reportTarget = null;
    testActive = false;
    G.setNoAuto(false);
    toTitle();
    const pass = results.filter(r => r.ok).length;
    window.__TEST = {
      pass, fail: results.length - pass, total: results.length, results, done: true
    };
    console.log(`[autotest] ${pass}/${results.length} passed`);
  }
}

if (AUTOTEST) autotest();
