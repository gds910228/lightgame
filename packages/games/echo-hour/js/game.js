// Echo Hour 回声之时 — main loop, echo recording/replay, local rewind,
// mechanisms, site bridge, G debug hooks and the ?autotest=1 suite.
import {
  P, clamp, overlaps, playerRect, makePlayer, respawnPlayer, stepPlayer,
  phaseU, ratingFor, starsSum,
} from './physics.js';
import {
  LEVELS, LEVEL_COUNT, CHAPTERS, MECH_CLASSES, instantiateLevel, mechanismClasses,
} from './levels.js';
import { makeRenderer, W, H } from './render.js';
import { makeAudio } from './audio.js';
import { makeUI } from './ui.js';

const DT = 1 / 60;
const REC_MAX = 480;          // 8 seconds at 60 Hz
const REW_MAX = 181;          // 3 seconds + current frame
const REW_WINDOW = 3.0;
const LIVES = 3;
const AUTOTEST = new URLSearchParams(location.search).has('autotest');
const STORE = { stars: 'ech.stars', unlocked: 'ech.unlocked', best: 'ech.best', mute: 'ech.mute' };

// ==================== state ====================
let mode = 'title';                 // title | play | end
let paused = false, noAuto = false, testMode = false, fastMode = false;
let levelN = 1, level, pl;
let lives = LIVES, rewindUses = 0, levelTime = 0, levelScore = 0, collectCount = 0;
let levelCleared = false, endCanNext = false, deathT = 0, hitstop = 0;
let camX = 0, visualT = 0, hudAcc = 0, timelineAcc = 0;
let recording = false, recFrames = [];
let echoActive = false, echoFrames = [], echoT = 0, echoPos = null, echoTrail = [];
let echoPrevIdx = -1;
let rewinding = false, rewindTime = 0, snapBuf = [];
let particles = [], floats = [];
let shakeT = 0, shakeAmp = 0, flashT = 0;
let starsByLevel = {}, unlocked = 1, totalStars = 0, best = 0, muted = false;
let reportTarget = null, reports = [];
let lastProgressT = -9;
const keys = new Set(), pressed = new Set();
const sim = { dir: 0, jumpHeld: false, jumpPressed: false, rewind: false };
let lastFrame = 0, acc = 0;

// ==================== storage ====================
function loadProgress() {
  starsByLevel = {};
  try {
    const raw = JSON.parse(localStorage.getItem(STORE.stars) || '{}');
    for (let i = 1; i <= LEVEL_COUNT; i++) {
      const v = Number(raw && raw[i]);
      if (Number.isInteger(v) && v >= 0 && v <= 3) starsByLevel[i] = v;
    }
  } catch (e) { }
  try { unlocked = clamp(parseInt(localStorage.getItem(STORE.unlocked) || '1', 10) || 1, 1, LEVEL_COUNT); } catch (e) { unlocked = 1; }
  totalStars = starsSum(starsByLevel);
  try { best = Math.max(totalStars, parseInt(localStorage.getItem(STORE.best) || '0', 10) || 0); } catch (e) { best = totalStars; }
  try { muted = localStorage.getItem(STORE.mute) === '1'; } catch (e) { muted = false; }
}
function recalcTotal() { totalStars = starsSum(starsByLevel); }
function saveProgress() {
  try {
    localStorage.setItem(STORE.stars, JSON.stringify(starsByLevel));
    localStorage.setItem(STORE.unlocked, String(unlocked));
    localStorage.setItem(STORE.best, String(best));
    localStorage.setItem(STORE.mute, muted ? '1' : '0');
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
  ui.setMute(muted);
  audio.setMuted(muted);
}
loadProgress();

// ==================== systems ====================
const canvas = document.getElementById('gl');
const renderer = makeRenderer(canvas);
const audio = makeAudio();
const ui = makeUI({
  onStart: () => startFromTitle(),
  onLevel: (n) => { if (n <= unlocked) startLevel(n); },
  onRetry: () => startLevel(levelN),
  onNext: () => { if (endCanNext) startLevel(levelN + 1); else toTitle(); },
  onHome: () => toTitle(),
  onMute: () => toggleMute(),
  onPause: () => togglePause(),
  onRestart: () => restartLevel(),
  onRecord: () => { if (mode === 'play' && !paused) toggleRecord(); },
});
audio.setMuted(muted);
ui.setMute(muted);
renderer.resize();

function bootAudio() {
  if (AUTOTEST || fastMode) return;
  try {
    if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
  } catch (e) { }
  audio.ensure();
}
function playSfx(name) {
  if (fastMode || !audio.sfx[name]) return;
  audio.sfx[name]();
}

// ==================== protocol bridge ====================
function toWireReport(frame) {
  const score = Number.isFinite(frame.score) ? Math.round(frame.score) : undefined;
  if (frame.kind === 'progress') return { kind: 'progress', data: { ...frame } };
  if (frame.kind === 'event') return { kind: 'event', event: String(frame.event || frame.tag || 'event'), data: { ...frame } };
  if (frame.kind === 'gameOver') return {
    kind: 'gameOver', score,
    progress: { value: Number.isFinite(frame.progress) ? frame.progress : 0 },
    data: { ...frame },
  };
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
      if (frame.kind === 'ready') {
        window.parent.postMessage({ source: 'lightgame', type: 'lightgame:ready', gameId: 'echo-hour', v: 1 }, '*');
      }
    }
  } catch (e) { }
}
report('ready', { game: 'echo-hour', version: '1.0.0' });

// ==================== score / flow ====================
function scoreNow() { return Math.max(0, Math.round(levelScore + levelN * 10)); }
function allCleared() {
  for (let i = 1; i <= LEVEL_COUNT; i++) if (!(starsByLevel[i] >= 1)) return false;
  return true;
}
function progressSnapshot() {
  recalcTotal();
  return { starsByLevel: { ...starsByLevel }, unlocked, totalStars, best, muted };
}

function startFromTitle() {
  bootAudio();
  playSfx('ui');
  startLevel(clamp(unlocked, 1, LEVEL_COUNT));
}
function startLevel(n) {
  bootAudio();
  levelN = clamp(n | 0, 1, LEVEL_COUNT);
  level = instantiateLevel(levelN);
  pl = makePlayer(level);
  lives = LIVES; rewindUses = 0; levelTime = 0; levelScore = 0; collectCount = 0;
  levelCleared = false; endCanNext = false; deathT = 0; hitstop = 0;
  shakeT = 0; shakeAmp = 0; flashT = 0;
  recording = false; recFrames = [];
  echoActive = false; echoFrames = []; echoT = 0; echoPos = null; echoTrail = []; echoPrevIdx = -1;
  rewinding = false; rewindTime = 0; snapBuf = [];
  particles = []; floats = [];
  keys.clear(); pressed.clear(); sim.dir = 0; sim.jumpHeld = false; sim.jumpPressed = false; sim.rewind = false;
  camX = clamp(pl.x - W * 0.42, 0, Math.max(0, level.worldW - W));
  mode = 'play'; paused = false; lastProgressT = -9;
  refreshMechanics(0, false);
  pushSnapshot();
  ui.showTitle(false); ui.showEnd(false); ui.showHud(true);
  ui.showTouch(ui.isTouch());
  ui.setPause(false); ui.setMute(muted);
  ui.el.guide.style.display = '';
  ui.setHud(hudData());
  ui.setTimeline({ recFrac: 0, rewFrac: snapBuf.length / REW_MAX, recording: false, rewinding: false });
  ui.banner(`第 ${levelN} 关 · ${level.name}`, level.hint, 3400);
  audio.state('play');
  report('event', { event: 'levelStart', level: levelN, score: scoreNow(), chapter: level.chapter });
}
function toTitle() {
  mode = 'title'; paused = false; deathT = 0; levelCleared = false; endCanNext = false;
  recording = false; recFrames = []; echoActive = false; echoFrames = []; echoPos = null; echoTrail = [];
  rewinding = false; snapBuf = []; particles = []; floats = []; sim.dir = 0; sim.rewind = false;
  keys.clear(); pressed.clear();
  if (!level) { level = instantiateLevel(1); pl = makePlayer(level); }
  ui.showTitle(true, progressSnapshot(), clamp(unlocked, 1, LEVEL_COUNT));
  ui.showHud(false); ui.showEnd(false); ui.setPause(false); ui.showTouch(false);
  ui.hideBanner();
  ui.el.guide.style.display = 'none';
  audio.state('calm');
}
function restartLevel() {
  if (mode === 'title') return;
  playSfx('ui');
  ui.toast('重开本关');
  startLevel(levelN);
}
function nextLevelAfterEnd() {
  if (levelN < LEVEL_COUNT) startLevel(levelN + 1);
  else toTitle();
}

function completeLevel() {
  if (mode !== 'play' || levelCleared) return;
  levelCleared = true;
  mode = 'end';
  endCanNext = levelN < LEVEL_COUNT;
  const stars = ratingFor(level, true, levelTime, rewindUses);
  if (stars > (starsByLevel[levelN] || 0)) starsByLevel[levelN] = stars;
  unlocked = Math.max(unlocked, Math.min(LEVEL_COUNT, levelN + 1));
  recalcTotal();
  if (totalStars > best) best = totalStars;
  levelScore += 200;
  saveProgress();
  playSfx('complete'); audio.state('win');
  addShake(9, 0.5);
  burst(pl.x + 11, pl.y + 16, 34, '#ffe0a0', 280, 0.9);
  burst(level.exit.x + level.exit.w / 2, level.exit.y + level.exit.h / 2, 28, '#b6ffe8', 220, 1.0);
  const sc = scoreNow();
  report('progress', {
    score: sc, progress: levelN, level: levelN, stars,
    keys: collectCount, time: +levelTime.toFixed(1), rewinds: rewindUses,
  });
  report('event', { event: 'levelClear', level: levelN, stars, score: sc });
  if (levelN === LEVEL_COUNT || allCleared()) report('complete', { score: sc });
  ui.showHud(false); ui.setPause(false); ui.hideBanner();
  ui.endPanel({
    kick: levelN === LEVEL_COUNT ? 'ECHO HOUR COMPLETE' : 'ECHO RESTORED',
    heading: levelN === LEVEL_COUNT ? '双时之门已开' : '时门已渡',
    reason: `${level.name} · 用时 ${levelTime.toFixed(1)}s · 倒流 ${rewindUses} 次 · 沙漏星粒 ${collectCount}/${level.collectibles.length}`,
    stars, keys: collectCount, keyTotal: level.collectibles.length,
    time: levelTime, rewinds: rewindUses, totalStars,
    canNext: endCanNext, nextLabel: '下一关',
  });
}
function failLevel(reason) {
  if (mode !== 'play' || levelCleared) return;
  levelCleared = false;
  mode = 'end';
  replayFailSfx();
  const sc = scoreNow();
  report('gameOver', {
    score: sc, progress: levelN, level: levelN, keys: collectCount,
    time: +levelTime.toFixed(1), rewinds: rewindUses, reason: reason || 'life',
  });
  ui.showHud(false); ui.setPause(false); ui.hideBanner();
  ui.endPanel({
    kick: 'ECHO LOST',
    heading: '回声消散',
    reason: `${level.name} · ${reasonText(reason)} · 生命耗尽`,
    stars: 0, keys: collectCount, keyTotal: level.collectibles.length,
    time: levelTime, rewinds: rewindUses, totalStars, canNext: false,
  });
}
function replayFailSfx() { playSfx('fail'); audio.state('calm'); }
function reasonText(r) {
  if (r === 'spike') return '被尖刺刺穿';
  if (r === 'laser') return '撞上致命光闸';
  if (r === 'crusher') return '被冲压机碾碎';
  if (r === 'abyss') return '坠入无时深渊';
  return '生命耗尽';
}

// ==================== effects ====================
function addShake(amp, dur) { shakeAmp = Math.max(shakeAmp, amp); shakeT = Math.max(shakeT, dur || 0.25); }
function burst(x, y, n, color, spd = 180, life = 0.7, kind = 'dot') {
  if (fastMode) return;
  if (particles.length > 280) return;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, v = spd * (0.3 + Math.random() * 0.8);
    particles.push({
      x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - spd * 0.15,
      life: life * (0.6 + Math.random() * 0.6), max: life,
      size: 1 + Math.random() * 2.6, color, kind,
    });
  }
  if (particles.length > 280) particles.splice(0, particles.length - 280);
}
function ring(x, y, color) { if (fastMode) return; particles.push({ x, y, vx: 0, vy: 0, life: 0.45, max: 0.45, size: 34, color, kind: 'ring' }); }
function floatText(x, y, text, color = '#b6ffe8', size = 15) {
  if (fastMode) return;
  floats.push({ x, y, text, color, size, life: 1.0, max: 1.0 });
  if (floats.length > 18) floats.shift();
}
function updateFX(dt, slow = false) {
  const g = slow ? 40 : 480;
  for (const p of particles) {
    p.x += p.vx * dt; p.y += p.vy * dt;
    if (p.kind !== 'ring') p.vy += g * dt;
    p.vx *= (1 - 1.5 * dt);
    p.life -= dt;
  }
  particles = particles.filter(p => p.life > 0);
  for (const f of floats) { f.y -= 28 * dt; f.life -= dt; }
  floats = floats.filter(f => f.life > 0);
  if (shakeT > 0) { shakeT = Math.max(0, shakeT - dt); if (shakeT <= 0) shakeAmp = 0; }
  if (flashT > 0) flashT = Math.max(0, flashT - dt);
}
function getShake() {
  if (shakeT <= 0) return { x: 0, y: 0 };
  const a = shakeAmp * Math.min(1, shakeT / 0.28);
  return { x: (Math.random() * 2 - 1) * a, y: (Math.random() * 2 - 1) * a };
}

// ==================== mechanisms ====================
function echoRect() { return echoPos ? { x: echoPos.x, y: echoPos.y, w: P.w, h: P.h } : null; }
function bodyHits(r) {
  if (!r) return false;
  return overlaps(r, playerRect(pl)) || (echoActive && echoPos && overlaps(r, echoRect()));
}
function platePressed(p) {
  return overlaps(p, playerRect(pl)) || (echoActive && echoPos && overlaps(p, echoRect()));
}
function doorOpen(d) {
  if (d.mode === 'hold') {
    const p = level.plates[d.plate];
    return !!(p && p.pressed);
  }
  if (d.mode === 'timer') return d.timer > 0;
  if (d.mode === 'period') return phaseU(level.mechT, d) < (d.duty || 0.5);
  return false;
}
function laserOn(l) {
  if (l.mode === 'plate') {
    const p = level.plates[l.plate];
    return !(p && p.pressed);
  }
  return phaseU(level.mechT, l) < (l.duty || 0.5);
}

function refreshMechanics(dt, advance) {
  if (!level) return;
  if (advance) {
    level.mechT += dt;
    for (const d of level.doors) if (d.mode === 'timer') d.timer = Math.max(0, d.timer - dt);
    for (const s of level.switches) { s.cd = Math.max(0, s.cd - dt); s.flash = Math.max(0, s.flash - dt); }
  }
  // plates derive from bodies
  for (const p of level.plates) {
    const was = p.pressed;
    p.pressed = platePressed(p);
    if (p.pressed && !was && advance) { playSfx('switchOn'); ring(p.x + p.w / 2, p.y + 2, '#6fe3c4'); }
  }
  // switches trigger on rising edge, from player or echo
  for (const s of level.switches) {
    const hit = bodyHits(s);
    if (hit && !s.prevHit && s.cd <= 0) {
      s.cd = 0.55; s.flash = 0.4;
      const d = level.doors[s.link.index];
      if (d && s.link.type === 'door') d.timer = Math.max(d.timer, s.duration || 2.5);
      if (advance) {
        playSfx('switchOn');
        ring(s.x + s.w / 2, s.y - 4, '#6fe3e8');
        floatText(s.x + s.w / 2, s.y - 30, '时序接通', '#b8fbff', 14);
      }
    }
    s.prevHit = hit;
  }
  // doors
  for (const d of level.doors) {
    const open = doorOpen(d);
    const before = d.open;
    d.open = open;
    d.anim = d.anim == null ? (open ? 1 : 0) : d.anim + ((open ? 1 : 0) - d.anim) * Math.min(1, (advance ? dt : 0) * 12);
    if (open && !before && advance) { playSfx('gate'); ring(d.x + d.w / 2, d.y + d.h / 2, '#ffd99a'); }
  }
  // lasers
  for (const l of level.lasers) {
    const on = laserOn(l);
    if (on && !l.on && advance) playSfx('laser');
    l.on = on;
  }
  // crushers
  for (const c of level.crushers) {
    const held = c.plate != null && level.plates[c.plate] && level.plates[c.plate].pressed;
    if (held) c.y = c.baseY;
    else {
      const u = phaseU(level.mechT, c);
      c.y = c.baseY + c.amp * (0.5 - 0.5 * Math.cos(u * Math.PI * 2));
    }
    c.safe = c.y + c.h < 560;
  }
  // conveyors
  for (const cv of level.conveyors) {
    const held = cv.plate != null && level.plates[cv.plate] && level.plates[cv.plate].pressed;
    cv.dir = held ? 1 : (phaseU(level.mechT, cv) < 0.5 ? 1 : -1);
  }
  // movers
  for (const m of level.movers) {
    const held = m.plate != null && level.plates[m.plate] && level.plates[m.plate].pressed;
    if (held) m.y = m.baseY;
    else {
      const u = phaseU(level.mechT, m);
      m.y = m.baseY + m.amp * (0.5 - 0.5 * Math.cos(u * Math.PI * 2));
    }
    m.safe = m.y + m.h < 560;
  }
}

function solidsNow() {
  const arr = [];
  for (const p of level.platforms) arr.push({ x: p.x, y: p.y, w: p.w, h: p.h });
  for (const d of level.doors) if (!d.open) arr.push({ x: d.x, y: d.y, w: d.w, h: d.h });
  for (const m of level.movers) arr.push({ x: m.x, y: m.y, w: m.w, h: m.h });
  return arr;
}
function conveyorPush() {
  if (!pl.onGround) return 0;
  for (const cv of level.conveyors) {
    if (pl.x + P.w > cv.x && pl.x < cv.x + cv.w && Math.abs((pl.y + P.h) - cv.y) < 12) {
      return cv.dir * cv.speed;
    }
  }
  return 0;
}

// ==================== echo ====================
function recordFrame() {
  if (!recording) return;
  recFrames.push({
    x: pl.x, y: pl.y, vx: pl.vx, vy: pl.vy,
    facing: pl.facing, onGround: pl.onGround,
  });
  if (recFrames.length >= REC_MAX) stopRecording(true);
}
function startRecording() {
  if (mode !== 'play' || paused || deathT > 0) return false;
  recording = true;
  recFrames = [];
  echoActive = false; echoFrames = []; echoT = 0; echoPos = null; echoTrail = []; echoPrevIdx = -1;
  playSfx('recordStart');
  ui.toast('开始录制 · 再按 E 停下');
  return true;
}
function stopRecording(auto = false) {
  if (!recording) return false;
  recording = false;
  if (recFrames.length < 8) {
    ui.toast('录制太短，回声未成形');
    playSfx('ui');
    return false;
  }
  echoFrames = recFrames.slice(0, REC_MAX);
  echoActive = true;
  echoT = 0; echoPrevIdx = -1; echoTrail = [];
  const len = echoFrames.length;
  echoPos = { x: echoFrames[0].x, y: echoFrames[0].y, facing: echoFrames[0].facing };
  playSfx('recordStop'); playSfx('echo');
  hitstop = Math.min(hitstop, 0.03);
  burst(echoPos.x + 11, echoPos.y + 16, 18, '#b8fbff', 190, 0.75);
  floatText(echoPos.x + 11, echoPos.y - 16, `回声成形 ${(len / 60).toFixed(1)}s`, '#b8fbff', 14);
  ui.banner(auto ? '回声成形 · 满 8 秒' : '回声成形', '影子将循环重演这段行动', 1500);
  return true;
}
function toggleRecord() {
  if (mode !== 'play' || paused || deathT > 0) return false;
  return recording ? stopRecording(false) : startRecording();
}
function updateEcho(dt) {
  if (!echoActive || !echoFrames.length) { echoPos = null; return; }
  const len = echoFrames.length;
  echoT += dt;
  const f = echoT * 60;
  const idx = ((Math.floor(f) % len) + len) % len;
  const nidx = (idx + 1) % len;
  const a = f - Math.floor(f);
  const A = echoFrames[idx], B = echoFrames[nidx];
  echoPos = {
    x: A.x + (B.x - A.x) * a,
    y: A.y + (B.y - A.y) * a,
    facing: B.facing || A.facing || 1,
  };
  if (idx !== echoPrevIdx) {
    echoPrevIdx = idx;
    echoTrail.push({ x: echoPos.x, y: echoPos.y, facing: echoPos.facing });
    if (echoTrail.length > 9) echoTrail.shift();
  }
}
function setEchoPos(x, y, facing = 1) {
  echoFrames = [{ x: +x, y: +y, vx: 0, vy: 0, facing, onGround: true }];
  echoActive = true; echoT = 0; echoPrevIdx = -1; echoTrail = [];
  echoPos = { x: +x, y: +y, facing };
  return true;
}
function clearEcho() {
  echoActive = false; echoFrames = []; echoT = 0; echoPos = null; echoTrail = []; echoPrevIdx = -1;
}

// ==================== rewind ====================
function isRewindHeld() {
  return keys.has('KeyQ') || keys.has('ShiftLeft') || keys.has('ShiftRight') ||
    sim.rewind || ui.touchState().rewind;
}
function makeSnapshot() {
  return {
    x: pl.x, y: pl.y, vx: pl.vx, vy: pl.vy, onGround: pl.onGround,
    facing: pl.facing, coyote: pl.coyote, jumpBuf: pl.jumpBuf,
    mechT: level.mechT, time: levelTime,
    doors: level.doors.map(d => d.timer),
    switches: level.switches.map(s => [s.cd, s.prevHit ? 1 : 0]),
  };
}
function pushSnapshot() {
  if (!level || !pl) return;
  snapBuf.push(makeSnapshot());
  if (snapBuf.length > REW_MAX) snapBuf.shift();
}
function applySnapshot(s) {
  pl.x = s.x; pl.y = s.y; pl.vx = s.vx; pl.vy = s.vy;
  pl.onGround = s.onGround; pl.facing = s.facing;
  pl.coyote = s.coyote; pl.jumpBuf = s.jumpBuf;
  level.mechT = s.mechT; levelTime = s.time;
  level.doors.forEach((d, i) => { d.timer = s.doors[i] || 0; });
  level.switches.forEach((sw, i) => { const v = s.switches[i] || [0, 0]; sw.cd = v[0]; sw.prevHit = !!v[1]; });
  refreshMechanics(0, false);
}
function startRewind() {
  if (rewinding) return;
  rewinding = true; rewindTime = 0; rewindUses++;
  playSfx('rewindStart'); audio.state('rewind');
  addShake(3, 0.2);
  ui.toast('时间倒流');
}
function endRewind() {
  if (!rewinding) return;
  rewinding = false;
  playSfx('rewindEnd'); audio.state('play');
}
function rewindStep() {
  if (snapBuf.length <= 1) { endRewind(); return; }
  const s = snapBuf.pop();
  applySnapshot(s);
  rewindTime += DT;
  if (!fastMode) {
    if (Math.random() < 0.5) burst(pl.x + 11, pl.y + 16, 1, '#8ff0f5', 70, 0.35, 'line');
  }
  if (rewindTime >= REW_WINDOW + 0.001) endRewind();
}

// ==================== death / hazards ====================
function onDeath(reason) {
  if (mode !== 'play' || deathT > 0) return;
  lives--;
  if (recording) { recording = false; recFrames = []; }
  playSfx('death'); ui.flash(true);
  addShake(17, 0.55); hitstop = 0.07;
  burst(pl.x + 11, pl.y + 16, 28, '#e35d4c', 300, 0.9);
  burst(pl.x + 11, pl.y + 16, 14, '#ffd99a', 200, 0.7);
  floatText(pl.x + 11, pl.y - 22, lives > 0 ? '回声断裂' : '生命耗尽', '#ff9a78', 18);
  if (lives <= 0) { failLevel(reason); return; }
  deathT = 0.62;
}
function doRespawn() {
  if (mode !== 'play') return;
  respawnPlayer(pl, level);
  deathT = 0;
  snapBuf = [];
  pushSnapshot();
  camX = clamp(pl.x - W * 0.42, 0, Math.max(0, level.worldW - W));
  ui.toast('回到时廊起点');
}
function checkHazards() {
  if (mode !== 'play' || deathT > 0) return;
  const r = playerRect(pl);
  let reason = '';
  if (level.spikes.some(s => overlaps(r, s))) reason = 'spike';
  if (!reason && level.lasers.some(l => l.on && overlaps(r, { x: l.x - 2, y: l.y, w: l.w + 4, h: l.h }))) reason = 'laser';
  if (!reason && level.crushers.some(c => overlaps(r, { x: c.x, y: c.y, w: c.w, h: c.h }))) reason = 'crusher';
  if (!reason && pl.y > level.killY) reason = 'abyss';
  if (reason) onDeath(reason);
}
function checkCollect() {
  const px = pl.x + 11, py = pl.y + 16;
  for (const c of level.collectibles) {
    if (c.got) continue;
    if (Math.hypot(px - c.x, py - c.y) < 50) {
      c.got = true;
      collectCount++;
      levelScore += 100;
      playSfx('collect');
      burst(c.x, c.y, 18, c.type === 'hourglass' ? '#ffd99a' : '#b8fbff', 200, 0.8);
      ring(c.x, c.y, c.type === 'hourglass' ? '#ffd99a' : '#b8fbff');
      floatText(c.x, c.y - 18, c.type === 'hourglass' ? '沙漏 +100' : '星粒 +100', '#ffe8c2', 15);
      hitstop = Math.max(hitstop, 0.02);
      if (levelTime - lastProgressT > 2) {
        lastProgressT = levelTime;
        report('progress', {
          score: scoreNow(), progress: levelN, level: levelN,
          keys: collectCount, time: +levelTime.toFixed(1),
        });
      }
    }
  }
}
function checkExit() {
  if (mode === 'play' && overlaps(playerRect(pl), level.exit)) completeLevel();
}

// ==================== input ====================
function handleOneShots() {
  if (pressed.has('KeyP')) { pressed.delete('KeyP'); togglePause(); }
  if (pressed.has('KeyM')) { pressed.delete('KeyM'); toggleMute(); }
  if (pressed.has('KeyR')) { pressed.delete('KeyR'); if (mode === 'play' || mode === 'end') restartLevel(); }
  if (pressed.has('Escape')) { pressed.delete('Escape'); if (mode === 'play') togglePause(); }
  if (pressed.has('KeyE')) {
    pressed.delete('KeyE');
    if (mode === 'play' && !paused && deathT <= 0) toggleRecord();
  }
  if (pressed.has('Enter')) {
    pressed.delete('Enter');
    if (mode === 'title') startFromTitle();
    else if (mode === 'end') { if (endCanNext) nextLevelAfterEnd(); else toTitle(); }
  }
}
function gatherInput() {
  const ts = ui.touchState();
  let dir = sim.dir;
  if (keys.has('KeyA') || keys.has('ArrowLeft') || ts.left) dir -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight') || ts.right) dir += 1;
  dir = clamp(dir, -1, 1);
  const jumpHeld = keys.has('Space') || keys.has('ArrowUp') || keys.has('KeyW') || sim.jumpHeld || ts.jump;
  let jumpPressed = pressed.has('Space') || pressed.has('ArrowUp') || pressed.has('KeyW') || sim.jumpPressed;
  if (ui.consumeJump()) jumpPressed = true;
  sim.jumpPressed = false;
  return { dir, jumpHeld, jumpPressed, push: conveyorPush() };
}
function togglePause() {
  if (mode !== 'play') return;
  paused = !paused;
  ui.setPause(paused);
  if (paused) ui.banner('已暂停', '按 P 或点「续」继续', 0);
  else { ui.hideBanner(); lastFrame = performance.now(); }
}
function toggleMute() {
  muted = !muted;
  audio.setMuted(muted);
  ui.setMute(muted);
  try { localStorage.setItem(STORE.mute, muted ? '1' : '0'); } catch (e) { }
  if (!muted) bootAudio();
  playSfx('ui');
}

// ==================== update / frame ====================
function update(dt) {
  visualT += dt;
  audio.tick(dt);
  handleOneShots();
  if (mode !== 'play') {
    pressed.clear();
    if (!fastMode) updateFX(dt);
    return;
  }
  if (paused) { pressed.clear(); return; }
  if (hitstop > 0) { hitstop -= dt; updateFX(dt); pressed.clear(); return; }
  if (deathT > 0) {
    deathT -= dt;
    updateFX(dt);
    if (deathT <= 0) doRespawn();
    pressed.clear();
    return;
  }

  levelTime += dt;

  const wantRewind = isRewindHeld();
  if (wantRewind && !recording && snapBuf.length > 1) {
    if (!rewinding) startRewind();
    rewindStep();
    updateFX(dt, true);
    updateCamera(dt);
    tickHud(dt);
    pressed.clear();
    return;
  }
  if (rewinding) endRewind();

  updateEcho(dt);
  refreshMechanics(dt, true);

  const input = gatherInput();
  const wasGround = pl.onGround;
  const solids = solidsNow();
  stepPlayer(pl, input, dt, solids);
  if (!wasGround && pl.onGround) playSfx('land');
  if (recording) recordFrame();

  refreshMechanics(0, false);
  checkCollect();
  checkHazards();
  if (mode === 'play') checkExit();
  updateFX(dt);
  updateCamera(dt);
  if (mode === 'play') pushSnapshot();
  tickHud(dt);
  pressed.clear();
}

function updateCamera(dt) {
  if (!level || !pl) return;
  const target = clamp(pl.x - W * 0.42, 0, Math.max(0, level.worldW - W));
  camX += (target - camX) * Math.min(1, dt * 6);
}

function hudData() {
  return {
    chapter: level ? level.chapter : 1,
    chapterName: level ? level.chapterName : '',
    level: levelN,
    name: level ? level.name : '',
    keys: collectCount,
    keyTotal: level ? level.collectibles.length : 2,
    lives,
    time: levelTime,
    rewinds: rewindUses,
    totalStars,
  };
}
function tickHud(dt) {
  if (fastMode) return;
  hudAcc += dt; timelineAcc += dt;
  if (hudAcc > 0.08) {
    hudAcc = 0;
    ui.setHud(hudData());
  }
  if (timelineAcc > 0.05) {
    timelineAcc = 0;
    ui.setTimeline({
      recFrac: recording ? recFrames.length / REC_MAX : 0,
      rewFrac: Math.min(1, snapBuf.length / REW_MAX),
      recording,
      rewinding,
    });
  }
}

function render() {
  if (!level || !pl) return;
  const sh = getShake();
  renderer.draw({
    level, player: pl, echoPos, echoTrail,
    particles, floats, cameraX: camX,
    time: levelTime, t: visualT,
    shakeX: sh.x, shakeY: sh.y,
    rewinding, recording, echoActive,
    deathT, flashAlpha: flashT,
    paused,
  });
}

function frame(now) {
  requestAnimationFrame(frame);
  if (!lastFrame) lastFrame = now;
  let dt = (now - lastFrame) / 1000;
  lastFrame = now;
  if (!Number.isFinite(dt) || dt < 0) dt = 0;
  dt = Math.min(dt, 0.1);
  if (document.hidden) return;
  if (!testMode) {
    acc += dt;
    let steps = 0;
    while (acc >= DT && steps < 5) { update(DT); acc -= DT; steps++; }
    if (acc > DT * 5) acc = 0;
  }
  render();
}
requestAnimationFrame(frame);

// window / pointer wiring
addEventListener('keydown', (e) => {
  if (e.isTrusted) bootAudio();
  if (['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Tab'].includes(e.code)) e.preventDefault();
  if (e.isComposing || e.keyCode === 229) return;
  if (!e.repeat) pressed.add(e.code);
  keys.add(e.code);
}, { passive: false });
addEventListener('keyup', (e) => { keys.delete(e.code); });
addEventListener('blur', () => { keys.clear(); sim.dir = 0; sim.jumpHeld = false; sim.rewind = false; });
document.addEventListener('visibilitychange', () => {
  lastFrame = performance.now();
  if (document.hidden && mode === 'play' && !paused) {
    paused = true; ui.setPause(true);
    ui.banner('已暂停', '页面隐藏时自动暂停', 0);
  }
});
canvas.addEventListener('pointerdown', (e) => {
  if (e.isTrusted) bootAudio();
  e.preventDefault();
});
addEventListener('resize', () => renderer.resize());

// ==================== boot scene / URL params ====================
level = instantiateLevel(1);
pl = makePlayer(level);
camX = 0;
ui.showTitle(true, progressSnapshot(), clamp(unlocked, 1, LEVEL_COUNT));
ui.showHud(false);
ui.showTouch(false);
ui.el.guide.style.display = 'none';

const params = new URLSearchParams(location.search);
if (params.has('autostart')) {
  startLevel(clamp(parseInt(params.get('level') || '1', 10) || 1, 1, LEVEL_COUNT));
  // Run a representative slice of the level-1 solution for a real gameplay cover:
  // the echo is holding the plate, the door is open, and the player is at the gate.
  runBotOps(level.solution.slice(0, 6));
  for (let i = 0; i < 24 && mode === 'play'; i++) update(DT);  // let the door finish opening
  camX = clamp(pl.x - W * 0.56, 0, Math.max(0, level.worldW - W));
  ui.showTouch(false);
  ui.hideBanner();
  ui.el.toast.classList.remove('show');
  testMode = true;
  ui.el.guide.style.display = '';
} else if (params.has('level') && !AUTOTEST) {
  startLevel(clamp(parseInt(params.get('level') || '1', 10) || 1, 1, LEVEL_COUNT));
  ui.el.guide.style.display = '';
}

// ==================== bot / 12-level audit ====================
function runBotOps(ops) {
  const beginLives = lives;
  const abort = () => mode !== 'play' || lives < beginLives;
  const step = () => update(DT);
  const waitFor = (pred, maxT) => {
    let t = 0;
    while (t < maxT && !abort()) {
      if (pred()) return true;
      step(); t += DT;
    }
    return pred() && !abort();
  };
  for (const op of ops) {
    if (abort()) break;
    if (op.a === 'record') { toggleRecord(); continue; }
    if (op.a === 'move') {
      let t = 0;
      while (t < 12 && !abort()) {
        const dx = op.x - pl.x;
        if (Math.abs(dx) <= 3) break;
        sim.dir = dx > 0 ? 1 : -1;
        step(); t += DT;
      }
      sim.dir = 0;
    } else if (op.a === 'wait') {
      for (let t = 0; t < op.t && !abort(); t += DT) step();
    } else if (op.a === 'rewind') {
      sim.rewind = true;
      let t = 0;
      while (t < op.t && !abort()) { step(); t += DT; if (!rewinding && t > 0.05) break; }
      sim.rewind = false;
      step();
    } else if (op.a === 'waitDoor') {
      waitFor(() => !!level.doors[op.i].open, 12);
    } else if (op.a === 'waitLaserOff') {
      waitFor(() => {
        const l = level.lasers[op.i];
        if (l.on) return false;
        if (l.mode === 'period') {
          const u = phaseU(level.mechT, l);
          return (1 - u) * (l.period || 1) >= 0.75;
        }
        return true;
      }, 12);
    } else if (op.a === 'waitCrusherUp') {
      const c = level.crushers[op.i];
      waitFor(() => {
        if (c.plate != null && level.plates[c.plate] && level.plates[c.plate].pressed) return true;
        if (c.y > c.baseY + 8) return false;
        const u = phaseU(level.mechT, c);
        return u < 0.07 || u > 0.93;
      }, 12);
    } else if (op.a === 'waitConveyorFwd') {
      waitFor(() => level.conveyors[op.i].dir > 0, 12);
    } else if (op.a === 'waitMoverUp') {
      waitFor(() => level.movers[op.i].y <= level.movers[op.i].baseY + 30, 12);
    }
  }
  sim.dir = 0; sim.rewind = false; sim.jumpHeld = false;
}
function auditLevel(n) {
  startLevel(n);
  const prevFast = fastMode;
  fastMode = true;
  const beginLives = lives;
  const ops = level.solution || [];
  runBotOps(ops);
  const res = {
    level: n, ok: mode === 'end' && levelCleared,
    cleared: levelCleared, mode, lives, deaths: beginLives - lives,
    time: +levelTime.toFixed(2), rewinds: rewindUses, keys: collectCount,
    echoFrames: echoFrames.length, reason: mode === 'play' ? 'not-at-exit' : '',
  };
  // finish any pending level-end UI with fast mode off (safe bookkeeping)
  fastMode = prevFast;
  return res;
}
function auditAll() {
  const out = [];
  for (let i = 1; i <= LEVEL_COUNT; i++) out.push(auditLevel(i));
  startLevel(1);
  return out;
}

// ==================== G debug hooks ====================
const G = {
  err: window.__BOOTERR,
  W, H, DT, P, REC_MAX, REW_MAX,
  step: (n = 60, dt = DT) => { for (let i = 0; i < n; i++) update(dt); render(); },
  upd: (n = 30, dt = DT) => { for (let i = 0; i < n; i++) update(dt); },
  press: (...codes) => codes.forEach(c => { pressed.add(c); keys.add(c); }),
  up: (...codes) => codes.forEach(c => keys.delete(c)),
  setNoAuto: (v) => { noAuto = !!v; },
  setReportTarget: (fn) => { reportTarget = typeof fn === 'function' ? fn : null; },
  state: () => ({
    mode, paused, noAuto, testMode, level: levelN,
    levelName: level ? level.name : '', chapter: level ? level.chapter : 1,
    lives, keys: collectCount, keyTotal: level ? level.collectibles.length : 0,
    score: scoreNow(), time: +levelTime.toFixed(3), rewinds: rewindUses,
    cleared: levelCleared, recording,
    recFrames: recFrames.length,
    echoActive, echoFrames: echoFrames.length, echoT: +echoT.toFixed(3),
    echoPos: echoPos ? { x: +echoPos.x.toFixed(2), y: +echoPos.y.toFixed(2), facing: echoPos.facing } : null,
    echoIdx: echoFrames.length ? Math.floor(echoT * 60) % echoFrames.length : -1,
    rewinding, snap: snapBuf.length, rewindTime: +rewindTime.toFixed(3),
    player: pl ? {
      x: +pl.x.toFixed(3), y: +pl.y.toFixed(3), vx: +pl.vx.toFixed(3), vy: +pl.vy.toFixed(3),
      onGround: pl.onGround, facing: pl.facing,
    } : null,
    mech: level ? {
      T: +level.mechT.toFixed(3),
      plates: level.plates.map(p => !!p.pressed),
      doors: level.doors.map(d => ({ open: !!d.open, timer: +d.timer.toFixed(3), anim: +(d.anim || 0).toFixed(3) })),
      switches: level.switches.map(s => ({ cd: +s.cd.toFixed(2), prevHit: !!s.prevHit, flash: +s.flash.toFixed(2) })),
      lasers: level.lasers.map(l => !!l.on),
      crushers: level.crushers.map(c => +c.y.toFixed(2)),
      conveyors: level.conveyors.map(c => c.dir),
      movers: level.movers.map(m => +m.y.toFixed(2)),
    } : null,
    stars: starsByLevel[levelN] || 0, totalStars, starsByLevel: { ...starsByLevel },
    unlocked, best, muted,
    audioCtx: audio.hasCtx(), audioState: audio.state(),
    reports: reports.length,
    net: window.__NET ? { ...window.__NET } : null,
    nan: !pl || ![pl.x, pl.y, pl.vx, pl.vy, levelTime, camX, echoT].every(Number.isFinite),
  }),
  startLevel: (n) => { startLevel(n); return levelN; },
  toTitle: () => toTitle(),
  restartLevel: () => restartLevel(),
  nextLevel: () => nextLevelAfterEnd(),
  forceWin: () => { if (mode !== 'play') startLevel(levelN); completeLevel(); },
  forceFail: (reason) => { if (mode !== 'play') startLevel(levelN); lives = 0; failLevel(reason || 'debug'); },
  setLives: (v) => { lives = clamp(v | 0, 0, 9); },
  setTime: (v) => { levelTime = Math.max(0, +v || 0); },
  setRewinds: (v) => { rewindUses = Math.max(0, v | 0); },
  setKeys: (v) => { collectCount = clamp(v | 0, 0, level ? level.collectibles.length : 3); },
  setPlayer: (x, y, vx = 0, vy = 0) => {
    if (!pl) return;
    pl.x = +x; pl.y = +y; pl.vx = +vx; pl.vy = +vy; pl.onGround = false;
  },
  setMechTime: (t) => { if (level) { level.mechT = +t || 0; refreshMechanics(0, false); } },
  setEchoPos: (x, y, facing) => setEchoPos(x, y, facing),
  clearEcho: () => clearEcho(),
  toggleRecord: () => toggleRecord(),
  stopRecord: () => stopRecording(false),
  setSimDir: (v) => { sim.dir = clamp(Math.sign(+v || 0), -1, 1); },
  setSimJump: (v) => { sim.jumpHeld = !!v; if (v) sim.jumpPressed = true; },
  setSimRewind: (v) => { sim.rewind = !!v; },
  setFast: (v) => { fastMode = !!v; },
  testMode: (v) => { testMode = !!v; if (!v) lastFrame = performance.now(); },
  pauseNow: (v) => { paused = !!v; ui.setPause(paused); },
  audio, ui, renderer,
  levels: LEVELS,
  mechClasses: MECH_CLASSES,
  mechanismClasses: (n) => mechanismClasses(LEVELS[(n | 0) - 1] || LEVELS[0]),
  levelConfigs: () => LEVELS.map(l => ({
    id: l.id, chapter: l.chapter, name: l.name, worldW: l.worldW,
    par: l.par, rewindPar: l.rewindPar,
    classes: mechanismClasses(l),
    collectibles: l.collectibles.length, solution: l.solution.length,
  })),
  auditLevel, auditAll,
  stateSnapshot: () => G.state(),
  storageSnapshot, restoreStorage,
  reports: () => reports.slice(),
  clearReports: () => { reports.length = 0; },
  replayReport: (kind, payload) => report(kind, payload),
  toWire: (frame) => toWireReport(frame),
};
window.G = G;
window.__G = G;
window.addEventListener('error', (e) => {
  const s = String(e.message || e);
  if (G.err && !G.err.includes(s)) G.err.push(s);
});

// ==================== ?autotest=1 ====================
if (AUTOTEST) autotest();

async function autotest() {
  const nap = () => new Promise(r => { const mc = new MessageChannel(); mc.port1.onmessage = () => r(); mc.port2.postMessage(0); });
  const T = window.__TEST = { pass: 0, fail: 0, total: 0, results: [], done: false };
  const ok = (id, cond, msg = '') => {
    T.results.push({ id, ok: !!cond, name: msg, msg });
    cond ? T.pass++ : T.fail++;
    if (!cond) console.warn(`[autotest] FAIL ${id}: ${msg}`);
  };
  const R = (n, dt = DT) => { for (let i = 0; i < n; i++) update(dt); };
  const snap = storageSnapshot();
  const origMuted = muted;
  const readyFirst = reports.length > 0 && reports[0].kind === 'ready';
  const frames = [];
  let sample = null;

  try {
    G.setNoAuto(true);
    G.testMode(true);
    audio.setMuted(true);
    ui.setMute(true);
    G.setReportTarget(f => frames.push(f));

    await nap();
    ok(1, G.err.length === 0 && !window.__TEST_ERR, `bootErr=${G.err.length}`);

    // T2 structure
    {
      let struct = LEVELS.length === LEVEL_COUNT && LEVEL_COUNT === 12;
      const chapCount = [0, 0, 0];
      for (const l of LEVELS) {
        chapCount[l.chapter - 1]++;
        if (!(l.collectibles.length >= 2 && l.solution.length >= 4 && l.exit && l.start)) struct = false;
        if (!(l.par > 0 && l.rewindPar >= 0)) struct = false;
        if (!(l.name && l.hint)) struct = false;
      }
      ok(2, struct && chapCount.join(',') === '4,4,4', `levels=${LEVELS.length} chapters=${chapCount.join('/')}`);
    }

    // T3 mechanism classes: both abilities genuinely touch ≥6 classes
    {
      const union = new Set();
      const echoSet = new Set();
      const rewindSet = new Set();
      for (const l of LEVELS) {
        mechanismClasses(l).forEach(c => union.add(c));
        if (l.plates.length) echoSet.add('plate');
        if (l.switches.length) echoSet.add('switch');
        if (l.doors.some(d => d.mode === 'hold')) echoSet.add('door');
        if (l.lasers.some(x => x.mode === 'plate')) echoSet.add('laser');
        if (l.crushers.some(c => c.plate != null)) echoSet.add('crusher');
        if (l.movers.some(m => m.plate != null)) echoSet.add('mover');
        if (l.conveyors.some(c => c.plate != null)) echoSet.add('conveyor');
        if (l.doors.some(d => d.mode === 'timer')) rewindSet.add('door-timer');
        if (l.lasers.some(x => x.mode === 'period')) rewindSet.add('laser');
        if (l.crushers.some(c => c.plate == null)) rewindSet.add('crusher');
        if (l.conveyors.length) rewindSet.add('conveyor');
        if (l.movers.length) rewindSet.add('mover');
        if (l.switches.length) rewindSet.add('switch-timer');
      }
      ok(3, MECH_CLASSES.every(c => union.has(c)) && echoSet.size >= 6 && rewindSet.size >= 6,
        `all=${[...union].join('+')} echo=${echoSet.size} rewind=${rewindSet.size}`);
    }

    // T4 no NaN after a short cruise
    startLevel(1); R(180);
    ok(4, !G.state().nan && G.err.length === 0, `nan=${G.state().nan}`);

    // T5 recording cap math: 8 s = 480 frames, auto stop
    startLevel(1);
    G.press('KeyE'); R(1);
    const recStarted = recording;
    R(REC_MAX + 8);
    ok(5, recStarted && !recording && echoFrames.length === REC_MAX, `rec=${recStarted} frames=${echoFrames.length} recording=${recording}`);

    // T6 manual stop length and loop wrap
    startLevel(1);
    G.press('KeyE'); R(1);
    R(60);
    G.press('KeyE'); R(1);
    const fl = echoFrames.length;
    const looped = (() => {
      const before = echoPos ? { ...echoPos } : null;
      R(fl * 2 + 20);
      return before && echoPos && Number.isFinite(echoPos.x + echoPos.y);
    })();
    ok(6, !recording && fl >= 60 && fl <= 63 && echoActive && looped, `frames=${fl} active=${echoActive} loop=${looped}`);

    // T7 echo triggers a hold plate and opens its door
    startLevel(1);
    G.setEchoPos(600, 588, 1);
    R(2);
    const doorOpened = level.plates[0].pressed && level.doors[0].open;
    G.setEchoPos(200, 588, 1); R(2);
    ok(7, doorOpened && !level.doors[0].open, `pressed=${level.plates[0].pressed} open=${level.doors[0].open}`);

    // T8 echo cannot collect key items
    startLevel(1);
    const key0 = level.collectibles[0];
    G.setEchoPos(key0.x, key0.y, 1);
    R(5);
    ok(8, !key0.got && collectCount === 0, `got=${key0.got} keys=${collectCount}`);

    // T9 player plate math (door hold / release)
    startLevel(1);
    G.setPlayer(600, 588); R(2);
    const holdOpen = level.doors[0].open && level.plates[0].pressed;
    G.setPlayer(300, 588); R(2);
    const holdClosed = !level.doors[0].open && !level.plates[0].pressed;
    ok(9, holdOpen && holdClosed, `open=${holdOpen} closed=${holdClosed}`);

    // T10 switch timer math
    startLevel(3);
    G.setPlayer(610, 588); R(2);
    const timerSet = level.doors[0].timer > 3.0 && level.doors[0].open;
    R(200);
    ok(10, timerSet && !level.doors[0].open && level.doors[0].timer === 0, `timer=${level.doors[0].timer} open=${level.doors[0].open}`);

    // T11 rewind restores player position/velocity and consumes one use
    startLevel(1);
    G.setPlayer(300, 588); R(30);
    const posBefore = pl.x;
    G.press('KeyD'); R(60); G.up('KeyD');
    const posAfter = pl.x;
    sim.rewind = true;
    const usesBefore = rewindUses;
    R(60);
    sim.rewind = false; R(2);
    ok(11, posAfter > posBefore + 120 && Math.abs(pl.x - posBefore) < 12 && rewindUses === usesBefore + 1,
      `x ${posBefore.toFixed(1)}→${posAfter.toFixed(1)}→${pl.x.toFixed(1)} uses=${rewindUses}`);

    // T12 rewind restores mechanism clock
    startLevel(5);
    R(120);
    const tBefore = level.mechT;
    sim.rewind = true; R(60); sim.rewind = false; R(2);
    const tAfter = level.mechT;
    ok(12, tBefore - tAfter > 0.7 && tBefore - tAfter < 1.3, `mechT ${tBefore.toFixed(2)}→${tAfter.toFixed(2)}`);

    // T13 rewind restores a door's countdown
    startLevel(3);
    G.setPlayer(610, 588); R(2);
    R(40);
    const timerLow = level.doors[0].timer;
    sim.rewind = true; R(35); sim.rewind = false; R(2);
    ok(13, level.doors[0].timer > timerLow + 0.35, `timer ${timerLow.toFixed(2)}→${level.doors[0].timer.toFixed(2)}`);

    // T14 rewind restores periodic laser phase
    startLevel(5);
    R(50);
    const onA = level.lasers[0].on, tA = level.mechT;
    R(50);
    const onB = level.lasers[0].on;
    sim.rewind = true; R(45); sim.rewind = false; R(1);
    ok(14, level.mechT < tA + 0.4 && (level.lasers[0].on === onA || onA === onB), `t ${tA.toFixed(2)}→${level.mechT.toFixed(2)} on ${onA}→${level.lasers[0].on}`);

    // T15 star rating algebra
    {
      const l = { par: 30, rewindPar: 2 };
      ok(15, ratingFor(l, false, 10, 0) === 0 && ratingFor(l, true, 10, 0) === 3 &&
        ratingFor(l, true, 31, 0) === 2 && ratingFor(l, true, 10, 3) === 2 &&
        ratingFor(l, true, 31, 3) === 1, 'rating thresholds');
    }

    // T16 collectible economy, no double collect
    startLevel(1);
    const c0 = level.collectibles[0];
    G.setPlayer(c0.x - 11, c0.y - 16); R(2);
    const s1 = scoreNow(), n1 = collectCount;
    R(5);
    ok(16, n1 === 1 && scoreNow() >= s1 && level.collectibles[0].got && collectCount === 1, `keys=${collectCount} score=${scoreNow()}`);

    // T17 real keyboard path: D moves right, Space jumps
    startLevel(1);
    G.press('KeyD'); R(20); G.up('KeyD');
    const movedX = pl.x > 150;
    G.press('Space'); R(1); G.up('Space'); R(8);
    ok(17, movedX && pl.y < 570, `x=${pl.x.toFixed(1)} y=${pl.y.toFixed(1)}`);

    // T18 pause freezes simulation and clock
    startLevel(1); R(10);
    G.press('KeyP'); R(1);
    const px = pl.x, pt = levelTime;
    R(40);
    const frozen = paused && pl.x === px && levelTime === pt;
    G.press('KeyP'); R(1);
    ok(18, frozen && !paused, `paused=${paused} dx=${(pl.x - px).toFixed(3)}`);

    // T19 touch record + movement buttons
    startLevel(1);
    document.getElementById('trec').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch' }));
    R(1);
    const touchRec = recording;
    const tr = document.getElementById('tright');
    const x0 = pl.x;
    tr.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch' }));
    R(15);
    tr.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerType: 'touch' }));
    ok(19, touchRec && pl.x > x0 + 10, `rec=${touchRec} dx=${(pl.x - x0).toFixed(1)}`);
    G.toggleRecord();

    // T20 restart resets transient state
    startLevel(1);
    G.setEchoPos(600, 588); R(2);
    sim.rewind = true; R(20); sim.rewind = false;
    G.press('KeyE'); R(10);
    G.setLives(1); G.setTime(33); G.setRewinds(5);
    restartLevel();
    const st20 = G.state();
    ok(20, st20.lives === 3 && st20.time === 0 && st20.rewinds === 0 && !st20.recording && !st20.echoActive, `lives=${st20.lives} time=${st20.time} rewinds=${st20.rewinds}`);

    // T21 spike death costs a life and respawns
    startLevel(1);
    const sp = level.spikes[0];
    G.setPlayer(sp.x + 20, sp.y - 10, 0, 0); R(2);
    const spikeLives = lives;
    R(50);
    ok(21, spikeLives === 2 && mode === 'play' && Math.abs(pl.x - level.start.x) < 3, `lives=${spikeLives} x=${pl.x.toFixed(0)}`);

    // T22 laser death
    startLevel(2);
    G.setPlayer(980, 588); R(2);
    ok(22, lives === 2, `lives=${lives}`);

    // T23 abyss death
    startLevel(1);
    G.setPlayer(400, level.killY + 20); R(2);
    ok(23, lives === 2, `lives=${lives}`);

    // T24 failure path -> gameOver frame + end panel
    startLevel(1);
    frames.length = 0;
    for (let k = 0; k < 3; k++) {
      G.setPlayer(level.spikes[0].x + 20, level.spikes[0].y - 10); R(2); R(50);
    }
    ok(24, mode === 'end' && lives === 0 && frames.some(f => f.kind === 'gameOver'), `mode=${mode} lives=${lives} kinds=${frames.map(f => f.kind).join(',')}`);
    ok(24.1, document.getElementById('end').classList.contains('show'), 'end panel shown');

    // T25 victory path writes progress + complete on the last level
    startLevel(1);
    frames.length = 0;
    G.setTime(8); G.setRewinds(0);
    G.forceWin();
    const star1 = starsByLevel[1] || 0;
    ok(25, mode === 'end' && levelCleared && star1 === 3 && unlocked >= 2, `stars=${star1} unlocked=${unlocked}`);
    ok(25.1, frames.some(f => f.kind === 'progress' && f.level === 1), 'progress frame on clear');
    startLevel(LEVEL_COUNT); G.setTime(20); G.forceWin();
    ok(25.2, frames.some(f => f.kind === 'complete'), `kinds=${frames.map(f => f.kind).join(',')}`);

    // T26 protocol envelope + frame order
    {
      ok(26, readyFirst, `first=${readyFirst}`);
      let got = [];
      G.setReportTarget(f => got.push(f));
      report('progress', { score: 321, progress: 3 });
      report('event', { event: 'unit', score: 321 });
      report('gameOver', { score: 321, progress: 3 });
      report('complete', { score: 321 });
      G.setReportTarget(f => frames.push(f));
      ok(26.1, got.map(g => g.kind).join(',') === 'progress,event,gameOver,complete', got.map(g => g.kind).join(','));
      const w1 = toWireReport({ kind: 'progress', score: 9 });
      const w2 = toWireReport({ kind: 'event', event: 'x' });
      const w3 = toWireReport({ kind: 'gameOver', score: 9, progress: 3 });
      const w4 = toWireReport({ kind: 'complete', score: 9 });
      ok(26.2, w1.kind === 'progress' && w1.data.kind === 'progress' &&
        w2.kind === 'event' && w2.event === 'x' && w3.kind === 'gameOver' &&
        w3.progress.value === 3 && w3.data.kind === 'gameOver' && w4.kind === 'complete' && w4.score === 9,
        'wire envelope');
    }

    // T27 best / stars localStorage write-read-restore
    {
      startLevel(2);
      G.setTime(1); G.setRewinds(0);
      starsByLevel[2] = 3; unlocked = Math.max(unlocked, 3);
      recalcTotal(); best = totalStars; saveProgress();
      const readStars = JSON.parse(localStorage.getItem(STORE.stars) || '{}');
      const readBest = parseInt(localStorage.getItem(STORE.best) || '0', 10);
      ok(27, readStars['2'] === 3 && readBest === totalStars && parseInt(localStorage.getItem(STORE.unlocked) || '0', 10) >= 3,
        `stars=${readStars['2']} best=${readBest}`);
      G.restoreStorage(snap);
      ok(27.1, (starsByLevel[2] || 0) === (JSON.parse(snap[STORE.stars] || '{}')['2'] || 0), `restored=${starsByLevel[2] || 0}`);
    }

    // T28 audio mute + state machine (autotest remains silent)
    {
      const m0 = audio.isMuted();
      toggleMute(); const m1 = audio.isMuted();
      toggleMute(); const m2 = audio.isMuted();
      audio.setMuted(true);
      audio.state('rewind'); const s1 = audio.state();
      audio.state('play'); const s2 = audio.state();
      ok(28, m0 !== m1 && m2 === m0 && s1 === 'rewind' && s2 === 'play' && audio.isMuted() === true,
        `ctx=${audio.hasCtx()} mute ${m0}→${m1}→${m2} states ${s1}/${s2}`);
    }

    // T29 full 12-level solution audit (12 results)
    {
      const results = [];
      for (let i = 1; i <= LEVEL_COUNT; i++) results.push(auditLevel(i));
      results.forEach((r, i) => ok(29 + i / 100 + 0.001 * i,
        r.ok, `L${r.level} cleared=${r.cleared} mode=${r.mode} lives=${r.lives} t=${r.time}s rew=${r.rewinds} keys=${r.keys}`));
      sample = results;
      startLevel(1);
    }

    // T41 global fast-forward: random-ish input, no NaN, no crash
    {
      startLevel(1);
      let crash = false, nan = false;
      const err0 = G.err.length;
      try {
        for (let i = 0; i < 900; i++) {
          if (i % 37 === 0) sim.dir = (i % 3) - 1;
          if (i % 83 === 0) { sim.jumpPressed = true; sim.jumpHeld = true; }
          if (i % 83 === 12) sim.jumpHeld = false;
          if (i % 211 === 0 && mode === 'play') toggleRecord();
          if (i % 173 === 0) sim.rewind = i % 2 === 0;
          R(1);
          if (G.state().nan) nan = true;
          if (mode === 'end') { startLevel(1); G.setNoAuto(true); }
        }
      } catch (e) { crash = true; console.error('fast-forward crash', e); }
      sim.dir = 0; sim.rewind = false; sim.jumpHeld = false;
      ok(41, !crash && !nan && G.err.length === err0 && !G.state().nan, `crash=${crash} nan=${nan} err=${G.err.length - err0}`);
    }

    // T42 network audit: zero external requests (wrapped in index.html)
    ok(42, window.__NET && window.__NET.external.length === 0, `external=${JSON.stringify(window.__NET && window.__NET.external)}`);

    // T44 site bridge globals required by the wrapper
    ok(44, typeof window.goHome === 'function' && typeof window.clickMore === 'function' &&
      typeof window.dp_share === 'function' && typeof window.play68_submitScore === 'function',
      `goHome=${typeof window.goHome} clickMore=${typeof window.clickMore} dp_share=${typeof window.dp_share} submit=${typeof window.play68_submitScore}`);

    // T45 echo is a memory: it neither blocks nor harms the player
    startLevel(1);
    G.setPlayer(400, 588, 0, 0);
    G.setEchoPos(392, 588, 1);
    const l0 = lives;
    G.press('KeyD'); R(20); G.up('KeyD');
    ok(45, pl.x > 420 && lives === l0 && echoActive, `x=${pl.x.toFixed(1)} lives=${lives} echo=${echoActive}`);

    // T43 back to title after tests
    toTitle();
    await nap();
    ok(43, mode === 'title' && !document.getElementById('title').classList.contains('hidden'), `mode=${mode}`);
    ok(43.1, G.err.length === 0 && !G.state().nan, `err=${G.err.length}`);

    // restore player's real progress + mute state
    G.restoreStorage(snap);
    muted = origMuted;
    audio.setMuted(origMuted);
    ui.setMute(origMuted);
    G.testMode(false);
    G.setNoAuto(false);
    G.setReportTarget(null);

    window.__AUDIT = sample;
  } catch (err) {
    window.__TEST_ERR = String(err && err.stack || err);
    console.error('[autotest] crashed', window.__TEST_ERR);
    T.results.push({ id: 'CRASH', ok: false, name: window.__TEST_ERR, msg: window.__TEST_ERR });
    T.fail++;
    try { G.restoreStorage(snap); muted = origMuted; audio.setMuted(origMuted); ui.setMute(origMuted); } catch (e) { }
    try { G.setReportTarget(null); toTitle(); } catch (e) { }
  }

  T.total = T.results.length;
  T.done = true;
  console.log(`[echo-hour autotest] ${T.pass}/${T.total} passed`);
}
