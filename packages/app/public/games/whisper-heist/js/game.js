// Whisper Heist 声息窃影 — a 2D top-down stealth game for the Guizang series.
// Vanilla ES modules, no external requests. Fixed-step loop, G debug hooks,
// ?autotest=1 suite, site report bridge and fully synthesized WebAudio.

import { LEVELS, TOTAL_LEVELS, LEVEL_TIME, CHAPTERS, VIEW_W as W, VIEW_H as H, cloneLevel } from './levels.js';
import { angleDiff, inCone, losClear, noiseStrength, segRect, circleRect, moveCircle, sightFactor, clamp, dist } from './stealth.js';
import { renderStatic, renderTitleCard, PAL } from './art.js';
import { makeAudio } from './audio.js';
import { makeUI } from './ui.js';

const DT = 1 / 60;
const CATCH_R_CHASE = 17;
const CATCH_R_SEARCH = 12;
const RELIC_VALUE_BASE = 120;
const KEY_BEST = 'whh.best';
const KEY_PROG = 'whh.progress';
const KEY_MUTE = 'whh.mute';
const AUTOTEST = new URLSearchParams(location.search).has('autotest');

// ==================== persistent meta ====================
let best = 0, progress = 0, muted = false;
try { best = parseInt(localStorage.getItem(KEY_BEST) || '0', 10) || 0; } catch (e) { best = 0; }
try { progress = parseInt(localStorage.getItem(KEY_PROG) || '0', 10) || 0; } catch (e) { progress = 0; }
progress = clamp(progress, 0, TOTAL_LEVELS);
try { muted = localStorage.getItem(KEY_MUTE) === '1'; } catch (e) { muted = false; }

// ==================== state ====================
let mode = 'title';               // title | select | play | over | win
let paused = false, noAuto = false;
let levelIndex = 0, level = null, statics = null;
let walls = [], darkZones = [], relics = [], guards = [], exitZone = null;
let player = { x: 64, y: 270, r: 9, crouch: false, face: 0, moving: false };
let score = 0, time = LEVEL_TIME, alarm = 0, alarmTier = 0, searches = 0;
let relicsTaken = 0, relicsTotal = 0, decoys = 3, decoyCd = 0;
let playT = 0, noiseClock = 0;
let waves = [], particles = [], floats = [], decoyShots = [];
let hitstop = 0, shakeT = 0, shakeAmp = 0, flashT = 0, flashColor = '255,240,200';
let lastNoise = { x: 0, y: 0, r: 0, t: 0, kind: 'none' };
let touchCrouch = false;
let lastProgressReport = -99;
let hudT = 0, promptTxt = '';
let reportTarget = null;
const reports = [];
const titleBg = renderTitleCard();

const audio = makeAudio();
audio.setMuted(muted);

// ==================== protocol bridge ====================
function toWireReport(frame) {
  const score = Number.isFinite(frame.score) ? Math.round(frame.score) : undefined;
  if (frame.kind === 'progress') return { kind: 'progress', data: { ...frame } };
  if (frame.kind === 'event') return { kind: 'event', event: String(frame.event || frame.tag || 'event'), data: { ...frame } };
  if (frame.kind === 'gameOver') return { kind: 'gameOver', score, progress: (frame.progress && typeof frame.progress === 'object') ? frame.progress : { value: frame.progress }, data: { ...frame } };
  if (frame.kind === 'complete') return { kind: 'complete', score };
  return frame;
}
function report(kind, payload = {}) {
  const frame = { kind, ...payload, score: payload.score !== undefined ? Math.round(payload.score) : undefined };
  if (frame.score === undefined) delete frame.score;
  reports.push(frame);
  if (reports.length > 240) reports.shift();
  try {
    if (reportTarget) reportTarget(frame);
    else if (window.parent !== window) {
      window.parent.postMessage({ source: 'lightgame', type: 'lightgame:report', payload: toWireReport(frame) }, '*');
      if (frame.kind === 'ready') window.parent.postMessage({ source: 'lightgame', type: 'lightgame:ready', gameId: 'whisper-heist', v: 1 }, '*');
    }
  } catch (e) { }
}
report('ready', { game: 'whisper-heist' });

function progressPct() {
  const inLevel = relicsTotal > 0 ? relicsTaken / relicsTotal : 0;
  return Math.round(((levelIndex + inLevel) / TOTAL_LEVELS) * 100);
}

// ==================== canvas / view ====================
const cv = document.getElementById('gl');
const ctx = cv.getContext('2d');
let DPR = 1, viewScale = 1, viewOX = 0, viewOY = 0;
const mouse = { x: W / 2, y: H / 2, active: false };

function resize() {
  DPR = Math.min(2, window.devicePixelRatio || 1);
  cv.width = Math.max(1, Math.round(innerWidth * DPR));
  cv.height = Math.max(1, Math.round(innerHeight * DPR));
  viewScale = Math.min(innerWidth / W, innerHeight / H);
  viewOX = (innerWidth - W * viewScale) / 2;
  viewOY = (innerHeight - H * viewScale) / 2;
}
addEventListener('resize', resize);
resize();

function toWorld(clientX, clientY) {
  return { x: (clientX - viewOX) / viewScale, y: (clientY - viewOY) / viewScale };
}

// ==================== UI ====================
const ui = makeUI({
  onStart: () => { audio.unlock(); audio.sfx.ui(); startFromProgress(); },
  onSelect: () => { audio.sfx.ui(); mode = 'select'; ui.showSelect(true, progress); },
  onBackTitle: () => toTitle(),
  onSelectLevel: (i) => {
    if (i <= progress) { audio.unlock(); audio.sfx.ui(); setLevel(i); }
    else { audio.sfx.ui(); ui.showToast('尚未解锁：先完成前一铺'); }
  },
  onRetry: () => { audio.sfx.ui(); restartLevel(); },
  onNext: () => { audio.sfx.ui(); if (levelIndex < TOTAL_LEVELS - 1) setLevel(levelIndex + 1); else toTitle(); },
  onPause: () => togglePause(),
  onMute: () => toggleMute(),
  onCrouch: () => {
    touchCrouch = !touchCrouch;
    ui.setCrouchIcon(touchCrouch);
    audio.sfx.ui();
  },
  onDecoy: () => { throwDecoy(); },
  onInteract: () => { interact(); },
  onShare: () => {
    try {
      if (typeof window.dp_share === 'function') window.dp_share(score);
      else if (window.parent !== window && typeof window.parent.handleGlobalShare === 'function') window.parent.handleGlobalShare(score);
    } catch (e) { }
  },
});

ui.setMutedIcon(muted);
ui.setBest(best);
ui.setProgress(progress, best);
ui.showTitle(true);
ui.showHud(false);

// ==================== input ====================
const held = new Set();
const pressed = new Set();

function pressCode(code) { held.add(code); pressed.add(code); }
function releaseCode(code) { held.delete(code); }

addEventListener('keydown', (e) => {
  if (e.isComposing || e.keyCode === 229) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
  if (!e.repeat) pressed.add(e.code);
  held.add(e.code);
  audio.unlock();
});
addEventListener('keyup', (e) => { held.delete(e.code); });
addEventListener('blur', () => { held.clear(); pressed.clear(); stick.active = false; stick.dx = stick.dy = 0; resetStickKnob(); });
document.addEventListener('visibilitychange', () => { held.clear(); pressed.clear(); });

function consumeActions() {
  if (!pressed.size) return;
  for (const code of pressed) {
    if (code === 'KeyM') toggleMute();
    else if (code === 'KeyP') togglePause();
    else if (code === 'KeyR') { if (mode === 'play' || mode === 'over' || mode === 'win' || paused) restartLevel(); }
    else if (mode === 'play' && !paused) {
      if (code === 'KeyE') interact();
      else if (code === 'Space' || code === 'Digit1') throwDecoy();
    }
    if (mode === 'title' && code === 'Enter') startFromProgress();
  }
  pressed.clear();
}

// mouse aim
cv.addEventListener('pointermove', (e) => {
  const p = toWorld(e.clientX, e.clientY);
  mouse.x = p.x; mouse.y = p.y;
  if (e.pointerType === 'mouse') mouse.active = true;
});
cv.addEventListener('pointerdown', (e) => {
  audio.unlock();
  const p = toWorld(e.clientX, e.clientY);
  mouse.x = p.x; mouse.y = p.y;
  if (e.pointerType === 'mouse') mouse.active = true;
});

// touch joystick
const stick = { active: false, id: null, dx: 0, dy: 0 };
function resetStickKnob() { if (ui.el.stickknob) ui.el.stickknob.style.transform = 'translate(0,0)'; }
function updateStick(e) {
  const r = ui.el.stickzone.getBoundingClientRect();
  let dx = (e.clientX - (r.left + r.width / 2)) / 44;
  let dy = (e.clientY - (r.top + r.height / 2)) / 44;
  const len = Math.hypot(dx, dy);
  if (len > 1) { dx /= len; dy /= len; }
  stick.dx = dx; stick.dy = dy;
  ui.el.stickknob.style.transform = `translate(${dx * 36}px,${dy * 36}px)`;
}
ui.el.stickzone.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  audio.unlock();
  stick.active = true; stick.id = e.pointerId;
  try { ui.el.stickzone.setPointerCapture(e.pointerId); } catch (err) { }
  updateStick(e);
});
ui.el.stickzone.addEventListener('pointermove', (e) => {
  if (!stick.active || e.pointerId !== stick.id) return;
  e.preventDefault();
  updateStick(e);
});
function endStick(e) {
  if (!stick.active || (e && e.pointerId !== stick.id)) return;
  stick.active = false; stick.id = null; stick.dx = 0; stick.dy = 0;
  resetStickKnob();
}
ui.el.stickzone.addEventListener('pointerup', endStick);
ui.el.stickzone.addEventListener('pointercancel', endStick);
ui.el.stickzone.addEventListener('lostpointercapture', endStick);

// show touch shell only on touch-capable devices, but keep it available to tests
if (('ontouchstart' in window) || (navigator.maxTouchPoints || 0) > 0) ui.el.touch.classList.add('on');

// ==================== level loading ====================
function makeGuard(g) {
  return {
    type: g.type, x: g.x, y: g.y,
    homeX: g.x, homeY: g.y, baseFace: g.face, face: g.face,
    vision: g.vision, half: g.half,
    speed: g.speed || (g.type === 'patrol' ? 56 : g.type === 'hearing' ? 74 : 50),
    path: g.path ? g.path.map(p => ({ x: p[0], y: p[1] })) : null,
    wpt: 1, pauseT: 0, state: 'calm', stateT: 0,
    target: null, seeing: false, lastSeen: { x: g.x, y: g.y }, anim: Math.random() * 9,
  };
}

function setLevel(i, opts = {}) {
  i = clamp(i | 0, 0, TOTAL_LEVELS - 1);
  const data = cloneLevel(i);
  if (!data) return false;
  levelIndex = i; level = data;
  walls = data.walls; darkZones = data.dark || [];
  relics = data.relics.map(r => ({ x: r.x, y: r.y, taken: false }));
  relicsTotal = relics.length; relicsTaken = 0;
  exitZone = data.exit;
  guards = data.guards.map(makeGuard);
  player = { x: data.start.x, y: data.start.y, r: 9, crouch: false, face: 0, moving: false };
  score = 0; time = LEVEL_TIME; alarm = 0; alarmTier = 0; searches = 0;
  decoys = data.decoys || 3; decoyCd = 0;
  playT = 0; noiseClock = 0; hitstop = 0; shakeT = 0; shakeAmp = 0; flashT = 0;
  waves = []; particles = []; floats = []; decoyShots = [];
  lastNoise = { x: 0, y: 0, r: 0, t: 0, kind: 'none' };
  lastProgressReport = -99; touchCrouch = false; paused = false;
  stick.active = false; stick.dx = stick.dy = 0; resetStickKnob();
  statics = renderStatic(data, i);
  mode = 'play';
  ui.showTitle(false); ui.showSelect(false); ui.showEnd(false); ui.showPause(false);
  ui.showHud(true); ui.setPausedIcon(false); ui.setCrouchIcon(false);
  ui.setLevelName(`第 ${i + 1} 铺 · ${data.name}`);
  ui.setPrompt('');
  syncHud();
  audio.stop(); audio.setState('calm');
  ui.showBanner(`第 ${i + 1} 铺`, data.name, 1500);
  if (!opts.silentStart) audio.sfx.door();
  report('event', { tag: 'level_start', level: i + 1 });
  return true;
}

function startFromProgress() {
  setLevel(Math.min(progress, TOTAL_LEVELS - 1));
}

function restartLevel() {
  setLevel(levelIndex, { silentStart: true });
  ui.showToast('本铺重置');
}

function toTitle() {
  mode = 'title'; paused = false;
  held.clear(); pressed.clear();
  stick.active = false; stick.dx = stick.dy = 0; resetStickKnob();
  ui.showTitle(true); ui.showSelect(false); ui.showEnd(false); ui.showPause(false);
  ui.showHud(false); ui.setPrompt('');
  ui.hideBanner(); ui.hideToast();
  ui.setBest(best); ui.setProgress(progress, best);
  audio.stop(); audio.setState('calm');
}

// ==================== HUD ====================
function syncHud() {
  ui.setScore(score);
  ui.setTimer(time);
  ui.setRelics(relicsTaken, relicsTotal);
  ui.setDecoys(decoys);
  ui.setAlarm(alarm);
  ui.setBest(best);
}

function toggleMute() {
  muted = !muted;
  audio.setMuted(muted);
  ui.setMutedIcon(muted);
  try { localStorage.setItem(KEY_MUTE, muted ? '1' : '0'); } catch (e) { }
  if (!muted) audio.unlock();
}

function togglePause() {
  if (mode !== 'play') return;
  paused = !paused;
  ui.setPausedIcon(paused);
  ui.showPause(paused);
  if (paused) ui.setPrompt('');
}

// ==================== combat / economy ====================
function addFloat(x, y, text, color) {
  floats.push({ x, y, text, color, life: 1.1 });
}

function addScore(v) {
  const before = score;
  score = Math.max(0, Math.round(score + v));
  if (score !== before) ui.setScore(score);
}
function setScore(v) { score = Math.max(0, Math.round(v) || 0); ui.setScore(score); }

function emitNoise(x, y, radius, kind = 'step') {
  radius = clamp(radius, 0, 420);
  lastNoise = { x, y, r: radius, t: playT, kind };
  waves.push({ x, y, max: radius, age: 0, life: kind === 'decoy' ? 1.05 : 0.62, kind });
  if (waves.length > 48) waves.shift();
  let triggered = false;
  for (const g of guards) {
    const mul = g.type === 'hearing' ? 1.5 : 1;
    if (dist(g.x, g.y, x, y) > radius * mul) continue;
    if (g.state === 'chase') continue;
    if (g.state === 'calm' || g.state === 'susp' || g.state === 'return') {
      guardSetState(g, 'search', x, y);
      triggered = true;
    } else if (g.state === 'search') {
      g.target = { x, y };
    }
  }
  if (triggered) {
    searches++;
    addScore(-20);
    addFloat(x, y - 18, '搜查 -20', '#ff9a84');
    audio.sfx.search();
  }
  return triggered;
}

function guardSetState(g, state, tx, ty) {
  g.state = state; g.stateT = 0;
  if (tx !== undefined) g.target = { x: tx, y: ty };
  if (state === 'calm') { g.target = null; g.pauseT = 0; }
}

function insideDark(x, y) {
  for (const d of darkZones) {
    if (x >= d.x && x <= d.x + d.w && y >= d.y && y <= d.y + d.h) return true;
  }
  return false;
}

function throwDecoy() {
  if (mode !== 'play' || paused || decoyCd > 0 || decoys <= 0) return false;
  decoys--; decoyCd = 0.65;
  let ang = player.face;
  if (mouse.active) ang = Math.atan2(mouse.y - player.y, mouse.x - player.x);
  decoyShots.push({
    x: player.x + Math.cos(ang) * 14, y: player.y + Math.sin(ang) * 14,
    vx: Math.cos(ang) * 340, vy: Math.sin(ang) * 340, life: 0.66,
  });
  ui.setDecoys(decoys);
  audio.sfx.throw();
  return true;
}

function landDecoy(s) {
  particles.push(...burst(s.x, s.y, '#ffd77a', 12, 1.2));
  emitNoise(s.x, s.y, 220, 'decoy');
  audio.sfx.land();
  shakeT = Math.max(shakeT, 0.12); shakeAmp = 3;
}

function nearestRelic() {
  let bestR = null, bd = 40;
  for (const r of relics) {
    if (r.taken) continue;
    const d = dist(player.x, player.y, r.x, r.y);
    if (d < bd) { bd = d; bestR = r; }
  }
  return bestR;
}
function exitCenter() { return { x: exitZone.x + exitZone.w / 2, y: exitZone.y + exitZone.h / 2 }; }
function atExit() { const c = exitCenter(); return dist(player.x, player.y, c.x, c.y) < 52; }

function interact() {
  if (mode !== 'play' || paused) return false;
  const r = nearestRelic();
  if (r) {
    r.taken = true; relicsTaken++;
    const value = RELIC_VALUE_BASE + levelIndex * 20;
    addScore(value);
    addFloat(r.x, r.y - 22, `+${value}`, '#ffe08a');
    particles.push(...burst(r.x, r.y, '#ffd77a', 22, 1.35));
    hitstop = 0.07; shakeT = 0.24; shakeAmp = 5; flashT = 0.16; flashColor = '255,225,150';
    audio.sfx.steal();
    if (relicsTaken >= relicsTotal) {
      ui.showBanner('密匣已尽', '灯未灭，速往出口 · E 撤离', 1900);
      audio.sfx.door();
    } else {
      ui.showBanner('密匣得手', `还剩 ${relicsTotal - relicsTaken} 只`, 1100);
    }
    if (playT - lastProgressReport > 1.2) {
      lastProgressReport = playT;
      report('progress', { score, progress: progressPct(), relics: relicsTaken, level: levelIndex + 1 });
    }
    syncHud();
    return true;
  }
  if (atExit()) {
    if (relicsTaken >= relicsTotal) { completeLevel(); return true; }
    ui.showToast(`还差 ${relicsTotal - relicsTaken} 只密匣`);
    audio.sfx.ui();
    return false;
  }
  return false;
}

function completeLevel() {
  if (mode !== 'play') return false;
  const timeBonus = Math.ceil(Math.max(0, time)) * 2;
  const stealthBonus = searches === 0 ? 200 : 0;
  addScore(timeBonus + stealthBonus);
  const accuracy = searches === 0 ? '无声无息' : `触发搜查 ${searches} 次`;
  mode = 'win'; paused = false;
  ui.setPrompt(''); ui.showPause(false);
  const newProgress = Math.max(progress, levelIndex + 1);
  if (newProgress !== progress) {
    progress = newProgress;
    try { localStorage.setItem(KEY_PROG, String(progress)); } catch (e) { }
  }
  if (score > best) {
    best = score;
    try { localStorage.setItem(KEY_BEST, String(best)); } catch (e) { }
  }
  report('progress', { score, progress: progressPct(), level: levelIndex + 1 });
  report('complete', { score, progress: Math.round((levelIndex + 1) / TOTAL_LEVELS * 100), level: levelIndex + 1 });
  audio.stop(); audio.sfx.win();
  shakeT = 0.4; shakeAmp = 4; flashT = 0.3; flashColor = '180,255,235';
  particles.push(...burst(player.x, player.y, '#6fe0c8', 30, 1.8));
  const hasNext = levelIndex < TOTAL_LEVELS - 1;
  ui.setEnd({
    win: true, hasNext, score,
    head: progress >= TOTAL_LEVELS ? '十二铺 · 全得手' : '潜行成功',
    detail: `用时 ${Math.floor((LEVEL_TIME - time) / 60)}分${String(Math.floor((LEVEL_TIME - time) % 60)).padStart(2, '0')}秒 · ${accuracy}\n`
      + `时间奖励 +${timeBonus}${stealthBonus ? ` · 潜行奖励 +${stealthBonus}` : ''}\n`
      + `密匣 ${relicsTaken}/${relicsTotal} · 得分 ${score}`,
  });
  ui.showEnd(true); ui.showHud(false);
  ui.setBest(best); ui.setProgress(progress, best);
  return true;
}

function failLevel(reason) {
  if (mode !== 'play') return false;
  mode = 'over'; paused = false;
  if (reason === 'caught') audio.sfx.caught();
  else { audio.sfx.fail(); audio.sfx.alarm(); }
  particles.push(...burst(player.x, player.y, reason === 'caught' ? '#ff8a70' : '#c94f4a', 24, 1.7));
  hitstop = 0.1; shakeT = 0.5; shakeAmp = 8; flashT = 0.34; flashColor = '210,60,50';
  ui.setPrompt(''); ui.showPause(false); ui.showHud(false);
  const why = reason === 'caught' ? '被守卫拿住' : reason === 'timeout' ? '时限已尽，灯已尽灭' : '警戒已满，灯下无路';
  ui.setEnd({
    win: false, hasNext: false, score,
    head: '潜行失败', detail: `${why}\n密匣 ${relicsTaken}/${relicsTotal} · 用时 ${Math.floor((LEVEL_TIME - time) / 60)}分${String(Math.floor((LEVEL_TIME - time) % 60)).padStart(2, '0')}秒`,
  });
  ui.showEnd(true);
  report('gameOver', { score, progress: progressPct(), level: levelIndex + 1, reason });
  ui.setBest(best);
  return true;
}

// ==================== particles / fx ====================
function burst(x, y, color, n, spread) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, sp = (30 + Math.random() * 130) * spread;
    out.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.45 + Math.random() * 0.55, max: 1, color, size: 1.5 + Math.random() * 2.6 });
  }
  return out;
}

function updateFx(dt) {
  for (let i = waves.length - 1; i >= 0; i--) {
    const w = waves[i]; w.age += dt;
    if (w.age >= w.life) waves.splice(i, 1);
  }
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt; if (p.life <= 0) { particles.splice(i, 1); continue; }
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vx *= (1 - 3 * dt); p.vy *= (1 - 3 * dt);
  }
  for (let i = floats.length - 1; i >= 0; i--) {
    const f = floats[i]; f.life -= dt * 1.1; f.y -= 26 * dt;
    if (f.life <= 0) floats.splice(i, 1);
  }
  if (shakeT > 0) shakeT -= dt;
  if (flashT > 0) flashT -= dt;
  if (decoyCd > 0) decoyCd = Math.max(0, decoyCd - dt);
}

// ==================== guards ====================
function moveGuardToward(g, tx, ty, speed, dt) {
  const dx = tx - g.x, dy = ty - g.y;
  const d = Math.hypot(dx, dy);
  if (d < 0.001) return 0;
  const ux = dx / d, uy = dy / d;
  const np = moveCircle(g.x, g.y, ux * speed * dt, uy * speed * dt, 10, walls);
  g.x = clamp(np.x, 26, W - 26); g.y = clamp(np.y, 26, H - 26);
  const want = Math.atan2(uy, ux);
  g.face += clamp(angleDiff(want, g.face), -5 * dt, 5 * dt);
  return d;
}

function updateGuard(g, dt) {
  g.anim += dt;
  if (g.state === 'chase') {
    const tx = g.lastSeen.x, ty = g.lastSeen.y;
    const d = moveGuardToward(g, tx, ty, 128, dt);
    if (d < 9) {
      g.stateT += dt;
      g.face += Math.sin(playT * 7 + g.anim) * dt * 2.2;
      if (g.stateT > 2.2) guardSetState(g, 'search', tx, ty);
    }
    return;
  }
  if (g.state === 'search') {
    g.stateT += dt;
    const tx = g.target ? g.target.x : g.x, ty = g.target ? g.target.y : g.y;
    const d = moveGuardToward(g, tx, ty, 92, dt);
    if (d < 8) g.face += Math.sin(playT * 3.2 + g.anim) * dt * 1.5;
    if (g.stateT > 5.5) guardSetState(g, 'return', g.homeX, g.homeY);
    return;
  }
  if (g.state === 'return') {
    g.stateT += dt;
    const d = moveGuardToward(g, g.homeX, g.homeY, 68, dt);
    if (d < 9 || g.stateT > 8) { guardSetState(g, 'calm'); g.face = g.baseFace; }
    return;
  }
  // calm / suspicious
  if (g.path && g.path.length > 1) {
    if (g.pauseT > 0) {
      g.pauseT -= dt;
      const nxt = g.path[g.wpt % g.path.length];
      const want = Math.atan2(nxt.y - g.y, nxt.x - g.x);
      g.face += clamp(angleDiff(want, g.face), -3 * dt, 3 * dt);
    } else {
      const nxt = g.path[g.wpt % g.path.length];
      const d = moveGuardToward(g, nxt.x, nxt.y, g.speed, dt);
      if (d < 5) { g.wpt = (g.wpt + 1) % g.path.length; g.pauseT = 0.7; }
    }
  } else if (g.type === 'hearing') {
    g.face = g.baseFace + Math.sin(playT * 0.9 + g.anim) * 0.3;
  } else {
    g.face = g.baseFace;
  }
}

// ==================== detection ====================
function updateDetection(dt) {
  let seen = false, maxRate = 0, lastX = 0, lastY = 0;
  const dark = insideDark(player.x, player.y);
  for (const g of guards) {
    const d = dist(g.x, g.y, player.x, player.y);
    let range = g.vision;
    if (dark) range *= 0.62;
    const sees = d <= range
      && inCone(g.x, g.y, g.face, g.half, player.x, player.y)
      && losClear(g.x, g.y, player.x, player.y, walls);
    g.seeing = sees;
    if (!sees) continue;
    seen = true;
    g.lastSeen = { x: player.x, y: player.y };
    lastX = player.x; lastY = player.y;
    let rate = 25 * sightFactor(d, Math.max(20, range));
    if (player.crouch) rate *= 0.34;
    if (dark) rate *= 0.48;
    if (rate > maxRate) maxRate = rate;
  }

  if (seen) alarm = Math.min(100, alarm + maxRate * dt);
  else alarm = Math.max(0, alarm - 6.5 * dt);

  const newTier = alarm >= 66 ? 3 : alarm >= 25 ? 2 : alarm > 1 ? 1 : 0;
  if (newTier > alarmTier) {
    alarmTier = newTier;
    if (newTier === 2) {
      searches++;
      addScore(-30);
      addFloat(lastX || player.x, (lastY || player.y) - 20, '搜索 -30', '#ff9a84');
      for (const g of guards) {
        if (g.state !== 'chase' && dist(g.x, g.y, lastX, lastY) < 420) guardSetState(g, 'search', lastX, lastY);
      }
      ui.showBanner('警 觉', '守卫开始搜索', 1100);
      audio.sfx.alarm();
    } else if (newTier === 3) {
      addScore(-60);
      addFloat(player.x, player.y - 24, '追捕 -60', '#ff8a70');
      for (const g of guards) {
        if (dist(g.x, g.y, player.x, player.y) < 560) guardSetState(g, 'chase', player.x, player.y);
      }
      ui.showBanner('追 捕', '灯下人正在逼近', 1300);
      audio.sfx.spotted();
      report('event', { tag: 'alarm', level: levelIndex + 1 });
      particles.push(...burst(player.x, player.y, '#ff8a70', 18, 1.5));
      hitstop = Math.max(hitstop, 0.06);
      shakeT = Math.max(shakeT, 0.35); shakeAmp = 6; flashT = 0.2; flashColor = '220,80,60';
    }
  } else if (newTier < alarmTier) {
    alarmTier = newTier;
  }
  if (alarm >= 100) { failLevel('alarm'); return false; }

  // caught: a chasing guard closes the distance
  for (const g of guards) {
    if (g.state !== 'chase' && g.state !== 'search') continue;
    const d = dist(g.x, g.y, player.x, player.y);
    const rr = g.state === 'chase' ? CATCH_R_CHASE : CATCH_R_SEARCH;
    if (d < rr && losClear(g.x, g.y, player.x, player.y, walls)) {
      failLevel('caught');
      return false;
    }
  }
  return true;
}

// ==================== play update ====================
function updatePlay(dt) {
  if (hitstop > 0) {
    hitstop = Math.max(0, hitstop - dt);
    updateFx(dt);
    return;
  }
  playT += dt;
  if (!noAuto) {
    time -= dt;
    if (time <= 0) { time = 0; syncHud(); failLevel('timeout'); return; }
  }

  // --- crouch / movement ---
  let ix = 0, iy = 0;
  if (held.has('KeyA') || held.has('ArrowLeft')) ix -= 1;
  if (held.has('KeyD') || held.has('ArrowRight')) ix += 1;
  if (held.has('KeyW') || held.has('ArrowUp')) iy -= 1;
  if (held.has('KeyS') || held.has('ArrowDown')) iy += 1;
  ix += stick.dx; iy += stick.dy;
  let len = Math.hypot(ix, iy);
  if (len > 1) { ix /= len; iy /= len; len = 1; }
  const moving = len > 0.12;
  let wantCrouch = held.has('ShiftLeft') || held.has('ShiftRight') || touchCrouch;
  if (!wantCrouch) {
    for (const w of walls) {
      if (w.type === 'low' && circleRect(player.x, player.y, player.r, w)) { wantCrouch = true; break; }
    }
  }
  player.crouch = wantCrouch;
  player.moving = moving;
  if (moving) {
    const speed = player.crouch ? 68 : 138;
    const solids = walls;
    const np = moveCircle(player.x, player.y, ix * speed * dt, iy * speed * dt, player.r,
      player.crouch ? solids.filter(w => w.type !== 'low') : solids);
    player.x = clamp(np.x, 24, W - 24);
    player.y = clamp(np.y, 24, H - 24);
    player.face = Math.atan2(iy, ix);
    noiseClock -= dt;
    if (noiseClock <= 0) {
      noiseClock = player.crouch ? 0.6 : 0.34;
      const radius = player.crouch ? 28 : 82;
      emitNoise(player.x, player.y, radius, player.crouch ? 'crouch' : 'step');
      if (player.crouch) audio.sfx.softstep(); else audio.sfx.step();
      if (Math.random() < 0.35) {
        particles.push({ x: player.x, y: player.y + 5, vx: (Math.random() - .5) * 12, vy: 6, life: .3, max: .3, color: '#9a8f78', size: 1.4 });
      }
    }
  } else {
    noiseClock = 0;
  }

  // --- decoy projectiles ---
  for (let i = decoyShots.length - 1; i >= 0; i--) {
    const s = decoyShots[i];
    s.life -= dt;
    const nx = s.x + s.vx * dt, ny = s.y + s.vy * dt;
    let hit = false;
    for (const w of walls) { if (circleRect(nx, ny, 3, w)) { hit = true; break; } }
    if (hit || s.life <= 0) { decoyShots.splice(i, 1); landDecoy(s); continue; }
    s.x = nx; s.y = ny;
    if (Math.random() < 0.6) particles.push({ x: s.x, y: s.y, vx: 0, vy: 0, life: .22, max: .22, color: 'rgba(255,215,122,.6)', size: 1.6 });
  }

  // --- guards ---
  for (const g of guards) updateGuard(g, dt);

  // --- sight / alarm / catch ---
  if (!updateDetection(dt)) return;

  // --- prompts ---
  let p = '';
  if (nearestRelic()) p = 'E  偷取密匣';
  else if (atExit()) p = relicsTaken >= relicsTotal ? 'E  撤离' : `还差 ${relicsTotal - relicsTaken} 只密匣`;
  if (p !== promptTxt) { promptTxt = p; ui.setPrompt(p); }

  updateFx(dt);

  hudT += dt;
  if (hudT >= 0.08) { hudT = 0; syncHud(); }
  audio.setState(alarm >= 66 ? 'chase' : alarm >= 25 ? 'alert' : 'calm');
}

// ==================== frame / render ====================
function logicStep(dt) {
  if (mode === 'play' && !paused) updatePlay(dt);
  else updateFx(dt);
  audio.tick(dt);
}
function advance(dt) {
  consumeActions();
  logicStep(dt);
}

let last = performance.now(), acc = 0;
function tick(now) {
  requestAnimationFrame(tick);
  let dt = (now - last) / 1000; last = now;
  if (document.hidden) return;
  dt = Math.min(dt, 1 / 30);
  if (pressed.size) consumeActions();
  if (mode === 'play' && !paused) {
    acc += dt;
    let n = 0;
    while (acc >= DT && n < 8) { logicStep(DT); acc -= DT; n++; if (mode !== 'play') break; }
  } else {
    acc = 0;
    logicStep(dt);
  }
  render();
}
requestAnimationFrame(tick);

// ==================== drawing ====================
function drawExit() {
  const e = exitZone;
  const open = relicsTaken >= relicsTotal;
  const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
  const pulse = 0.5 + 0.5 * Math.sin(playT * 2.4);
  ctx.save();
  ctx.translate(cx, cy);
  const glow = ctx.createRadialGradient(0, 0, 4, 0, 0, 54);
  glow.addColorStop(0, open ? `rgba(111,224,200,${0.24 + pulse * 0.16})` : 'rgba(120,120,140,.10)');
  glow.addColorStop(1, 'rgba(111,224,200,0)');
  ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, 0, 54, 0, Math.PI * 2); ctx.fill();
  // paper door frame
  ctx.strokeStyle = open ? PAL.jade : 'rgba(160,150,140,.45)';
  ctx.lineWidth = 3;
  ctx.strokeRect(-e.w / 2, -e.h / 2, e.w, e.h);
  ctx.strokeStyle = 'rgba(200,161,90,.6)'; ctx.lineWidth = 1.2;
  ctx.strokeRect(-e.w / 2 + 5, -e.h / 2 + 5, e.w - 10, e.h - 10);
  ctx.fillStyle = open ? 'rgba(111,224,200,.10)' : 'rgba(20,24,48,.5)';
  ctx.fillRect(-e.w / 2 + 2, -e.h / 2 + 2, e.w - 4, e.h - 4);
  // light seam
  if (open) {
    ctx.fillStyle = `rgba(160,255,230,${0.35 + pulse * 0.3})`;
    ctx.fillRect(-2, -e.h / 2 + 8, 4, e.h - 16);
  }
  ctx.fillStyle = open ? '#c9fff0' : 'rgba(200,190,170,.55)';
  ctx.font = '10px "Microsoft YaHei",sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(open ? '出 口' : '出 口 · 锁', 0, e.h / 2 - 8);
  ctx.restore();
}

function drawRelics() {
  for (const r of relics) {
    ctx.save();
    ctx.translate(r.x, r.y);
    const bob = Math.sin(playT * 2.2 + r.x * 0.03) * 1.6;
    if (r.taken) {
      ctx.globalAlpha = 0.18;
      ctx.strokeStyle = PAL.copper; ctx.lineWidth = 1;
      ctx.strokeRect(-8, -7, 16, 14);
      ctx.globalAlpha = 1;
      ctx.restore(); continue;
    }
    const glow = ctx.createRadialGradient(0, bob, 1, 0, bob, 34);
    glow.addColorStop(0, 'rgba(255,215,122,.26)'); glow.addColorStop(1, 'rgba(255,215,122,0)');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, bob, 34, 0, Math.PI * 2); ctx.fill();
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    ctx.beginPath(); ctx.ellipse(0, 9, 10, 4, 0, 0, Math.PI * 2); ctx.fill();
    // lacquer box
    ctx.fillStyle = '#8f2f2c';
    ctx.fillRect(-9, -7 + bob, 18, 14);
    ctx.fillStyle = '#c94f4a';
    ctx.fillRect(-9, -7 + bob, 18, 5);
    ctx.strokeStyle = PAL.gold; ctx.lineWidth = 1.4;
    ctx.strokeRect(-9, -7 + bob, 18, 14);
    ctx.strokeStyle = 'rgba(255,215,122,.7)';
    ctx.beginPath(); ctx.moveTo(0, -6 + bob); ctx.lineTo(0, 6 + bob); ctx.stroke();
    ctx.fillStyle = PAL.gold;
    ctx.beginPath(); ctx.arc(0, 0 + bob, 2.4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

function drawVisionCone(g) {
  const col = g.state === 'chase'
    ? { fill: 'rgba(220,76,66,.20)', line: 'rgba(240,110,96,.75)' }
    : g.state === 'search'
      ? { fill: 'rgba(255,205,110,.14)', line: 'rgba(255,215,122,.62)' }
      : { fill: 'rgba(111,224,200,.105)', line: 'rgba(111,224,200,.42)' };
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(g.x, g.y);
  ctx.arc(g.x, g.y, g.vision, g.face - g.half, g.face + g.half);
  ctx.closePath();
  ctx.fillStyle = col.fill; ctx.fill();
  ctx.strokeStyle = col.line; ctx.lineWidth = 1.4;
  ctx.stroke();
  // bright rim
  ctx.beginPath();
  ctx.arc(g.x, g.y, g.vision, g.face - g.half, g.face + g.half);
  ctx.strokeStyle = col.line; ctx.globalAlpha = 0.5; ctx.lineWidth = 0.8; ctx.stroke();
  ctx.restore();
}

function drawGuard(g) {
  ctx.save();
  ctx.translate(g.x, g.y);
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,.38)';
  ctx.beginPath(); ctx.ellipse(0, 7, 11, 4.5, 0, 0, Math.PI * 2); ctx.fill();
  // lantern glow for fixed guards
  if (g.type === 'fixed') {
    const lg = ctx.createRadialGradient(8, -4, 1, 8, -4, 26);
    lg.addColorStop(0, 'rgba(255,190,90,.22)'); lg.addColorStop(1, 'rgba(255,190,90,0)');
    ctx.fillStyle = lg; ctx.beginPath(); ctx.arc(8, -4, 26, 0, Math.PI * 2); ctx.fill();
  }
  // cloak
  ctx.fillStyle = '#242a52';
  ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = PAL.copper; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.stroke();
  // shoulders
  ctx.strokeStyle = 'rgba(200,161,90,.5)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, 0, 6.5, g.face + 2.1, g.face + 4.2); ctx.stroke();
  // head / hat
  ctx.fillStyle = '#d8c9a8';
  ctx.beginPath(); ctx.arc(0, 0, 4.6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#1a2042';
  ctx.beginPath(); ctx.arc(0, 0, 5.4, g.face + Math.PI * .55, g.face + Math.PI * 1.45); ctx.fill();
  // facing wedge
  ctx.fillStyle = g.state === 'chase' ? '#ff7b6a' : PAL.gold;
  ctx.beginPath();
  ctx.moveTo(Math.cos(g.face) * 15, Math.sin(g.face) * 15);
  ctx.lineTo(Math.cos(g.face + 2.5) * 6, Math.sin(g.face + 2.5) * 6);
  ctx.lineTo(Math.cos(g.face - 2.5) * 6, Math.sin(g.face - 2.5) * 6);
  ctx.closePath(); ctx.fill();
  // hearing guard ear arcs
  if (g.type === 'hearing') {
    ctx.strokeStyle = 'rgba(111,224,200,.7)'; ctx.lineWidth = 1.1;
    for (let i = 1; i <= 2; i++) {
      ctx.beginPath(); ctx.arc(0, 0, 12 + i * 4, -0.7, 0.7); ctx.stroke();
    }
  }
  // state glyph
  if (g.state === 'chase' || g.state === 'search' || g.state === 'return') {
    const glyph = g.state === 'chase' ? '!' : g.state === 'search' ? '?' : '·';
    ctx.fillStyle = g.state === 'chase' ? '#ff8a78' : g.state === 'search' ? PAL.gold : 'rgba(200,190,170,.6)';
    ctx.font = 'bold 15px "Microsoft YaHei",sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(glyph, 0, -16 - Math.sin(playT * 6) * 1.5);
  }
  ctx.restore();
}

function drawPlayer() {
  const r = player.crouch ? 7 : 9;
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.fillStyle = 'rgba(0,0,0,.4)';
  ctx.beginPath(); ctx.ellipse(0, 7, r + 2, 4, 0, 0, Math.PI * 2); ctx.fill();
  // coat
  ctx.fillStyle = '#d8c9a8';
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#8f7a52'; ctx.lineWidth = 1.3;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
  // cinnabar sash
  ctx.strokeStyle = PAL.cinnabar; ctx.lineWidth = 2.2;
  ctx.beginPath(); ctx.moveTo(Math.cos(player.face + 1.6) * (r - 1), Math.sin(player.face + 1.6) * (r - 1));
  ctx.lineTo(Math.cos(player.face - 1.6) * (r - 1), Math.sin(player.face - 1.6) * (r - 1)); ctx.stroke();
  // hood / head
  ctx.fillStyle = player.crouch ? '#3c3560' : '#2c2a52';
  ctx.beginPath(); ctx.arc(0, 0, r * 0.52, 0, Math.PI * 2); ctx.fill();
  // facing wedge
  ctx.fillStyle = PAL.jade;
  ctx.beginPath();
  ctx.moveTo(Math.cos(player.face) * (r + 8), Math.sin(player.face) * (r + 8));
  ctx.lineTo(Math.cos(player.face + 2.6) * (r + 1), Math.sin(player.face + 2.6) * (r + 1));
  ctx.lineTo(Math.cos(player.face - 2.6) * (r + 1), Math.sin(player.face - 2.6) * (r + 1));
  ctx.closePath(); ctx.fill();
  if (player.crouch) {
    ctx.strokeStyle = 'rgba(111,224,200,.55)'; ctx.lineWidth = 1;
    ctx.setLineDash([3, 4]);
    ctx.beginPath(); ctx.arc(0, 0, r + 5, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.restore();
}

function drawWaves() {
  for (const w of waves) {
    const t = w.age / w.life;
    const rad = 6 + w.max * (1 - Math.pow(1 - t, 2));
    const alpha = (1 - t) * (w.kind === 'decoy' ? 0.75 : 0.34);
    ctx.strokeStyle = w.kind === 'decoy' ? `rgba(255,215,122,${alpha})` : `rgba(111,224,200,${alpha})`;
    ctx.lineWidth = w.kind === 'decoy' ? 2 : 1;
    ctx.beginPath(); ctx.arc(w.x, w.y, rad, 0, Math.PI * 2); ctx.stroke();
    if (w.kind === 'decoy') {
      ctx.globalAlpha = alpha * 0.6;
      ctx.beginPath(); ctx.arc(w.x, w.y, rad * 0.6, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
}

function drawDecoys() {
  for (const s of decoyShots) {
    ctx.fillStyle = '#ffd77a';
    ctx.beginPath(); ctx.arc(s.x, s.y, 4, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,215,122,.5)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(s.x, s.y, 8, 0, Math.PI * 2); ctx.stroke();
  }
}

function drawParticles() {
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life / (p.max || 1));
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawFloats() {
  ctx.textAlign = 'center';
  for (const f of floats) {
    ctx.globalAlpha = Math.min(1, f.life * 1.4);
    ctx.font = 'bold 15px "Microsoft YaHei",sans-serif';
    ctx.fillStyle = f.color;
    ctx.strokeStyle = 'rgba(6,8,20,.7)'; ctx.lineWidth = 3;
    ctx.strokeText(f.text, f.x, f.y);
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
}

function render() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.clearRect(0, 0, cv.width / DPR, cv.height / DPR);
  ctx.save();
  ctx.translate(viewOX, viewOY); ctx.scale(viewScale, viewScale);

  if (mode === 'title' || mode === 'select' || !statics) {
    ctx.drawImage(titleBg, 0, 0, W, H);
    const vg = ctx.createRadialGradient(W / 2, H / 2, 180, W / 2, H / 2, 640);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(2,4,14,.6)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    ctx.restore();
    return;
  }

  const shx = shakeT > 0 ? (Math.random() * 2 - 1) * shakeAmp * Math.min(1, shakeT * 3) : 0;
  const shy = shakeT > 0 ? (Math.random() * 2 - 1) * shakeAmp * Math.min(1, shakeT * 3) : 0;
  ctx.translate(shx, shy);

  ctx.drawImage(statics.bg, 0, 0, W, H);
  drawExit();
  drawRelics();
  for (const g of guards) drawVisionCone(g);
  ctx.drawImage(statics.walls, 0, 0, W, H);
  drawWaves();
  for (const g of guards) drawGuard(g);
  drawPlayer();
  drawDecoys();
  drawParticles();
  drawFloats();

  // vignette + alarm + flash
  const vg = ctx.createRadialGradient(W / 2, H / 2, 190, W / 2, H / 2, 660);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(2,4,14,.62)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  if (alarm > 8) {
    const a = Math.min(0.5, alarm / 100 * 0.55) * (0.7 + 0.3 * Math.sin(playT * 8));
    const rg = ctx.createRadialGradient(W / 2, H / 2, 220, W / 2, H / 2, 660);
    rg.addColorStop(0, 'rgba(201,79,74,0)');
    rg.addColorStop(1, `rgba(201,79,74,${a})`);
    ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
  }
  if (flashT > 0) {
    ctx.fillStyle = `rgba(${flashColor},${Math.min(0.55, flashT * 1.7)})`;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.restore();
}

// ==================== G debug hooks ====================
const G = {
  err: window.__BOOTERR || (window.__BOOTERR = []),
  step: (n = 60, dt = DT) => {
    for (let i = 0; i < n; i++) { advance(dt); render(); }
  },
  upd: (n = 30, dt = DT) => { for (let i = 0; i < n; i++) advance(dt); },
  press: (...codes) => codes.forEach(c => pressCode(c)),
  release: (...codes) => codes.forEach(c => releaseCode(c)),
  clearKeys: () => { held.clear(); pressed.clear(); stick.dx = stick.dy = 0; },
  setNoAuto: (v) => { noAuto = !!v; },
  setReportTarget: (fn) => { reportTarget = fn; },
  state: () => ({
    mode, paused, noAuto, level: levelIndex, levelName: level ? level.name : '',
    score, best, progress, time: +time.toFixed(3), alarm: +alarm.toFixed(3), tier: alarmTier,
    searches, relicsTaken, relicsTotal, relicsLeft: relicsTotal - relicsTaken,
    decoys, decoyCd: +decoyCd.toFixed(3), crouch: player.crouch,
    x: +player.x.toFixed(3), y: +player.y.toFixed(3), face: +player.face.toFixed(4),
    player: { x: +player.x.toFixed(3), y: +player.y.toFixed(3), crouch: player.crouch, face: +player.face.toFixed(4) },
    guards: guards.map(g => ({
      type: g.type, state: g.state, x: +g.x.toFixed(2), y: +g.y.toFixed(2),
      face: +g.face.toFixed(3), seeing: g.seeing, vision: g.vision, half: g.half,
    })),
    guardsCount: guards.length, noiseRings: waves.length, particles: particles.length,
    lastNoise: { ...lastNoise }, unlocked: progress, paused,
  }),
  setLevel: (i, autostart = true) => setLevel(i, { silentStart: true }),
  restartLevel: () => restartLevel(),
  toTitle: () => toTitle(),
  startFromProgress: () => startFromProgress(),
  teleport: (x, y, crouch) => {
    player.x = clamp(x, 24, W - 24); player.y = clamp(y, 24, H - 24);
    if (typeof crouch === 'boolean') { player.crouch = crouch; touchCrouch = crouch; ui.setCrouchIcon(crouch); }
  },
  setScore: (v) => setScore(v),
  addScore: (v) => addScore(v),
  setTime: (v) => { time = Math.max(0, Number(v) || 0); syncHud(); },
  setRelics: (n) => {
    n = clamp(n | 0, 0, relicsTotal);
    let left = relics.filter(r => !r.taken).length;
    for (let i = 0; i < relics.length && left > n; i++) if (!relics[i].taken) { relics[i].taken = true; left--; }
    for (let i = relics.length - 1; i >= 0 && left < n; i--) if (relics[i].taken) { relics[i].taken = false; left++; }
    relicsTaken = relicsTotal - left;
    syncHud();
    return relicsTaken;
  },
  setDecoys: (n) => { decoys = Math.max(0, n | 0); ui.setDecoys(decoys); },
  setMuted: (v) => { muted = !!v; audio.setMuted(muted); ui.setMutedIcon(muted); },
  setBest: (v) => { best = Math.max(0, v | 0); ui.setBest(best); },
  reloadBest: () => { try { best = parseInt(localStorage.getItem(KEY_BEST) || '0', 10) || 0; } catch (e) { best = 0; } ui.setBest(best); return best; },
  forceAlert: (v) => {
    alarm = clamp(Number(v) || 0, 0, 100);
    if (alarm >= 66) {
      alarmTier = 3;
      for (const g of guards) guardSetState(g, 'chase', player.x, player.y);
    } else if (alarm >= 25) {
      alarmTier = 2;
      for (const g of guards) guardSetState(g, 'search', player.x, player.y);
    } else if (alarm > 0) alarmTier = 1;
    else alarmTier = 0;
    syncHud();
    if (alarm >= 100) failLevel('alarm');
    return alarm;
  },
  forceWin: () => {
    if (mode !== 'play') return false;
    for (const r of relics) r.taken = true;
    relicsTaken = relicsTotal;
    return completeLevel();
  },
  forceFail: (reason = 'debug') => failLevel(reason === 'caught' ? 'caught' : reason === 'timeout' ? 'timeout' : 'alarm'),
  emitNoise: (x, y, r, kind) => emitNoise(x, y, r, kind || 'debug'),
  interact: () => interact(),
  throwDecoy: () => throwDecoy(),
  lastNoise: () => ({ ...lastNoise }),
  levels: LEVELS,
  math: { angleDiff, inCone, losClear, noiseStrength, segRect, circleRect, moveCircle, sightFactor, dist },
  audio, ui, player,
  getLevel: () => level,
  setTouchCrouch: (v) => { touchCrouch = !!v; ui.setCrouchIcon(touchCrouch); },
};
window.G = G;
window.__G = G;

// ==================== autotest ====================
const nap = () => new Promise(r => { const mc = new MessageChannel(); mc.port1.onmessage = () => r(); mc.port2.postMessage(0); });

async function autotest() {
  G.setNoAuto(true);              // mandatory first line: no real-time countdowns
  const results = [];
  const assert = (id, ok, name) => {
    results.push({ id, ok: !!ok, name });
    if (!ok) console.warn(`[T${id}] FAIL ${name}`);
  };
  const S = () => G.state();
  const savedBest = best, savedProgress = progress, savedMuted = muted;
  let savedBestRaw = null, savedProgRaw = null;
  try { savedBestRaw = localStorage.getItem(KEY_BEST); savedProgRaw = localStorage.getItem(KEY_PROG); } catch (e) { }

  try {
    const frames = [];
    G.setReportTarget(f => frames.push(f));
    muted = true; audio.setMuted(true); ui.setMutedIcon(true);
    audio.ensure();
    await nap();

    // 1 boot clean
    assert(1, G.err.length === 0 && (window.__BOOTERR || []).length === 0, '启动零报错');

    // 2 cone math
    const M = G.math;
    assert(2, M.inCone(0, 0, 0, Math.PI / 6, 100, 0)
      && M.inCone(0, 0, 0, Math.PI / 6, 100, 55)
      && !M.inCone(0, 0, 0, Math.PI / 6, 100, 70)
      && !M.inCone(0, 0, 0, Math.PI / 6, -100, 0), '视野锥角度判定');

    // 3 LOS
    const testWalls = [{ x: 100, y: 0, w: 20, h: 200, type: 'wall' }];
    assert(3, !M.losClear(0, 100, 220, 100, testWalls)
      && M.losClear(0, 300, 220, 300, testWalls)
      && !M.losClear(0, 100, 220, 100, [{ x: 100, y: 0, w: 20, h: 200, type: 'low' }]), '墙体/矮掩体遮挡视线');

    // 4 noise falloff
    assert(4, Math.abs(M.noiseStrength(50, 100) - 0.5) < 1e-6
      && M.noiseStrength(140, 100) === 0 && M.noiseStrength(0, 220) === 1, '声纹距离衰减');

    // 5 level data integrity (12 handcrafted, 3 chapters, 3 guard types)
    const allTypes = new Set();
    let cfgOk = LEVELS.length === 12;
    for (const lv of LEVELS) {
      if (!(lv.relics.length >= 2 && lv.guards.length >= 1 && lv.walls.length >= 8 && lv.exit)) cfgOk = false;
      for (const g of lv.guards) allTypes.add(g.type);
    }
    assert(5, cfgOk && allTypes.has('fixed') && allTypes.has('patrol') && allTypes.has('hearing'), '12 关配置与三类守卫');

    // 6 level load
    assert(6, G.setLevel(0) && S().mode === 'play' && S().level === 0
      && S().relicsTotal >= 2 && S().guardsCount >= 3 && Math.abs(S().time - LEVEL_TIME) < 0.001, '载入第一铺');

    // 7 no NaN after idle
    G.upd(300);
    let st = S();
    let finite = [st.x, st.y, st.time, st.alarm, st.score].every(Number.isFinite)
      && st.guards.every(g => Number.isFinite(g.x) && Number.isFinite(g.y) && Number.isFinite(g.face));
    assert(7, finite, '300 帧后关键数值无 NaN');

    // 8 input simulation moves the player
    G.setLevel(0);
    const x0 = S().x;
    G.press('KeyD');
    G.upd(30);
    G.release('KeyD');
    const x1 = S().x;
    assert(8, x1 > x0 + 10 && Number.isFinite(x1), 'G.press 输入模拟使玩家移动');

    // 9 wall blocking
    G.setLevel(0);
    G.teleport(300, 200);
    G.press('KeyD'); G.upd(80); G.release('KeyD');
    assert(9, S().x < 333 && S().x > 300, '实体墙阻挡移动');

    // 10 crouch-only low cover
    G.setLevel(0);
    G.teleport(270, 269);
    G.press('KeyD'); G.upd(60); G.release('KeyD');
    const blockedX = S().x;
    G.teleport(270, 269);
    G.press('ShiftLeft', 'KeyD'); G.upd(100); G.release('ShiftLeft', 'KeyD');
    const passX = S().x;
    assert(10, blockedX < 292 && passX > 345, `矮掩体站立阻挡/蹲行通过 (${blockedX.toFixed(0)}→${passX.toFixed(0)})`);

    // 11 crouch lowers emitted noise
    G.setLevel(0);
    G.teleport(100, 470);
    G.press('KeyD'); G.upd(60); G.release('KeyD');
    const standNoise = G.lastNoise().r;
    G.setLevel(0);
    G.teleport(100, 470);
    G.press('ShiftLeft', 'KeyD'); G.upd(60); G.release('ShiftLeft', 'KeyD');
    const crouchNoise = G.lastNoise().r;
    assert(11, standNoise >= 80 && crouchNoise <= 30 && standNoise > crouchNoise * 2, `蹲行降噪 ${standNoise}→${crouchNoise}`);

    // 12 hearing guard investigates noise
    G.setLevel(0);
    const hg = S().guards.find(g => g.type === 'hearing');
    const hx0 = hg.x;
    G.emitNoise(700, 452, 150, 'test');
    G.upd(90);
    const hg2 = S().guards.find(g => g.type === 'hearing');
    assert(12, hg2.state === 'search' && hg2.x < hx0 - 15 && Number.isFinite(hg2.x), `守卫循声调查位移 ${hx0.toFixed(0)}→${hg2.x.toFixed(0)}`);

    // 13 noise search costs score
    G.setLevel(0);
    G.setScore(500);
    G.emitNoise(700, 452, 150, 'test');
    assert(13, S().score === 480 && S().searches >= 1, '触发搜查扣分');

    // 14 vision raises alarm
    G.setLevel(0);
    G.teleport(420, 263);
    G.upd(40);
    assert(14, S().alarm > 1 && S().guards.some(g => g.seeing), '视野锥内触发警戒');

    // 15 wall blocks sight in-game
    G.setLevel(0);
    const blockedByWall = !M.losClear(474, 263, 300, 200, G.getLevel().walls);
    G.teleport(300, 200);
    G.upd(45);
    assert(15, blockedByWall && S().alarm < 0.5 && !S().guards.some(g => g.seeing), '墙后不被发现');

    // 16 alarm decays when hidden
    G.setLevel(0);
    G.teleport(420, 263); G.upd(40);
    const aMax = S().alarm;
    G.teleport(100, 470); G.upd(120);
    assert(16, aMax > 1 && S().alarm < aMax, `警戒回落 ${aMax.toFixed(1)}→${S().alarm.toFixed(1)}`);

    // 17 crouch in dark slows detection
    G.setLevel(0);
    G.teleport(430, 263);         // inside the dark room, in front of the fixed guard
    G.setNoAuto(false);
    G.upd(20);
    const alarmStanding = S().alarm;
    G.setLevel(0);
    G.teleport(430, 263);
    G.setTouchCrouch(true);
    G.upd(20);
    const alarmCrouch = S().alarm;
    G.setTouchCrouch(false);
    G.setNoAuto(true);
    assert(17, alarmStanding > 0.5 && alarmCrouch < alarmStanding, `暗区蹲行降低察觉 ${alarmStanding.toFixed(2)}→${alarmCrouch.toFixed(2)}`);

    // 18 pause freezes movement and the clock
    G.setLevel(0);
    G.setNoAuto(false);
    G.upd(10);
    const pt = S().time, px = S().x;
    G.press('KeyP'); G.press('KeyD'); G.upd(45);
    const pausedNow = S().paused, pt2 = S().time, px2 = S().x;
    G.press('KeyP'); G.upd(45); G.release('KeyD');
    const resumedTime = S().time;
    G.setNoAuto(true);
    assert(18, pausedNow && Math.abs(pt2 - pt) < 1e-6 && Math.abs(px2 - px) < 1e-6 && resumedTime < pt2, '暂停冻结计时与移动');

    // 19 decoy throw / landing noise
    G.setLevel(0);
    const d0 = S().decoys;
    G.press('Space'); G.upd(2);
    const d1 = S().decoys;
    G.upd(70);
    const ln = G.lastNoise();
    assert(19, d1 === d0 - 1 && ln.kind === 'decoy' && ln.r >= 200, `声饵投掷与落点声纹 (${ln.kind}:${ln.r})`);

    // 20 touch bindings (DOM buttons drive real actions)
    G.setLevel(0);
    const td = document.getElementById('tdecoy');
    const beforeTouch = S().decoys;
    td.click();
    const afterTouch = S().decoys;
    document.getElementById('tcrouch').click();
    assert(20, !!td && !!document.getElementById('tinteract') && afterTouch === beforeTouch - 1, '触屏按钮绑定生效');
    G.setTouchCrouch(false);

    // 21 relic steal increases score
    G.setLevel(0);
    G.teleport(476, 263);
    G.press('KeyE'); G.upd(2);
    assert(21, S().relicsTaken === 1 && S().score >= 120, '偷取密匣加分');

    // 22 alarm-full failure
    G.setLevel(0);
    frames.length = 0;
    G.forceAlert(100);
    assert(22, S().mode === 'over' && frames.some(f => f.kind === 'gameOver'), '警戒满失败并上报');

    // 23 caught failure path
    G.setLevel(0);
    G.forceAlert(80);
    G.teleport(S().guards[0].x, S().guards[0].y);
    G.upd(30);
    assert(23, S().mode === 'over', '被守卫追上失败');

    // 24 timeout failure path
    G.setLevel(0);
    G.setTime(0.02); G.setNoAuto(false); G.upd(5); G.setNoAuto(true);
    assert(24, S().mode === 'over' && S().time <= 0.02, '180 秒超时判负');
    G.setNoAuto(true);

    // 25 restart resets everything
    G.setLevel(0); G.setScore(999); G.forceAlert(50); G.forceFail('caught');
    G.restartLevel();
    const rs = S();
    assert(25, rs.mode === 'play' && rs.score === 0 && rs.alarm === 0 && rs.relicsTaken === 0
      && Math.abs(rs.time - LEVEL_TIME) < 0.001 && rs.paused === false, '重开本铺状态复位');

    // 26 alert stages search → chase
    G.setLevel(0);
    G.forceAlert(30);
    const stage2 = S().tier === 2 && S().guards.some(g => g.state === 'search');
    G.forceAlert(75);
    const stage3 = S().tier === 3 && S().guards.some(g => g.state === 'chase');
    assert(26, stage2 && stage3, '警戒三级：搜索→追捕');

    // 27 victory via exit after all relics
    G.setLevel(0);
    G.setScore(0);
    G.setRelics(0);
    G.teleport(exitZone.x + exitZone.w / 2, exitZone.y + exitZone.h / 2);
    G.press('KeyE'); G.upd(2);
    const winSt = S();
    assert(27, winSt.mode === 'win' && winSt.score >= 500, `全部密匣+出口胜利 (score=${winSt.score})`);

    // 28 site report frames: ready → progress → complete
    const kinds = frames.map(f => f.kind);
    const firstReady = reports[0] && reports[0].kind === 'ready';
    const pi = kinds.indexOf('progress'), ci = kinds.indexOf('complete');
    assert(28, firstReady && pi >= 0 && ci > pi && kinds[kinds.length - 1] === 'complete',
      `上报帧序 ${kinds.join('→')}`);

    // 29 progress persisted
    let progNow = 0;
    try { progNow = parseInt(localStorage.getItem(KEY_PROG) || '0', 10) || 0; } catch (e) { }
    assert(29, progNow >= 1 && progNow === S().progress, '关卡进度写入 localStorage');

    // 30 best localStorage write + reload
    G.setBest(0);
    G.setLevel(0); G.setRelics(0);
    G.teleport(exitZone.x + exitZone.w / 2, exitZone.y + exitZone.h / 2);
    G.press('KeyE'); G.upd(2);
    const bestState = S().best;
    const bestWritten = (() => { try { return parseInt(localStorage.getItem(KEY_BEST) || '0', 10) || 0; } catch (e) { return 0; } })();
    try { localStorage.setItem(KEY_BEST, '4321'); } catch (e) { }
    const reloaded = G.reloadBest();
    assert(30, bestWritten > 0 && bestWritten === bestState && reloaded === 4321, `best 写入/读回还原 (${bestWritten}/${reloaded})`);

    // 31 particle / wave systems update inside the frame
    G.setLevel(0); G.setScore(0);
    G.teleport(476, 263);
    G.press('KeyE'); G.upd(1);
    const pCount = S().particles;
    G.upd(90);
    assert(31, pCount > 0 && S().particles < pCount, '特效/粒子在 frame 内更新衰减');

    // 32 full fast-forward stress
    G.setLevel(0);
    const errBefore = G.err.length;
    for (let i = 0; i < 600; i++) {
      if (i % 40 === 0) { G.press(i % 80 === 0 ? 'KeyD' : 'KeyW'); G.release(i % 80 === 0 ? 'KeyW' : 'KeyD'); }
      if (i % 120 === 0) G.press('Space');
      G.upd(1);
      if (i % 60 === 0) G.release('Space');
    }
    G.clearKeys();
    st = S();
    finite = [st.x, st.y, st.time, st.alarm, st.score].every(Number.isFinite)
      && st.guards.every(g => Number.isFinite(g.x) && Number.isFinite(g.y));
    assert(32, finite && G.err.length === errBefore, '整局快进 600 帧无 NaN 无报错');

    // 33 audio synthesis / mute state
    audio.setState('chase');
    const audioChase = audio.state === 'chase';
    audio.setState('calm');
    assert(33, audio.hasCtx() && audio.isMuted() === true && audioChase && audio.state === 'calm', '音频合成、状态切换与静音');

    // 34 return to title
    G.toTitle();
    const titleVisible = !document.getElementById('title').classList.contains('hide');
    assert(34, S().mode === 'title' && titleVisible, '测完回到标题画面');
    assert(35, !!(ui.el.mutebtn && ui.el.pausebtn && ui.el.stickzone && ui.el.tdecoy && ui.el.tinteract), 'HUD/触屏 DOM 绑定存在');

  } catch (err) {
    window.__TEST_ERR = String(err && err.stack || err);
    results.push({ id: 99, ok: false, name: 'autotest crash: ' + String(err && err.message || err) });
    console.error('[autotest] crashed', err);
  }

  // restore the player's real records and leave the page on the title screen
  try {
    if (savedBestRaw === null) localStorage.removeItem(KEY_BEST); else localStorage.setItem(KEY_BEST, savedBestRaw);
    if (savedProgRaw === null) localStorage.removeItem(KEY_PROG); else localStorage.setItem(KEY_PROG, savedProgRaw);
  } catch (e) { }
  best = savedBest; progress = savedProgress;
  muted = savedMuted;
  audio.setMuted(muted); ui.setMutedIcon(muted);
  G.setReportTarget(null);
  ui.setBest(best); ui.setProgress(progress, best);
  G.toTitle();

  const pass = results.filter(r => r.ok).length;
  const total = results.length;
  window.__TEST = { pass, fail: total - pass, passed: pass, failed: total - pass, total, results, done: true };
  console.log(`[autotest] ${pass}/${total} passed`);
}

if (new URLSearchParams(location.search).get('autotest')) autotest();

// autostart for screenshots: ?autostart=1&level=1 (1-based level number)
{
  const q = new URLSearchParams(location.search);
  if (q.has('autostart')) {
    const li = clamp((parseInt(q.get('level') || '1', 10) || 1) - 1, 0, TOTAL_LEVELS - 1);
    setLevel(li, { silentStart: true });
  }
}

window.addEventListener('error', e => { if (G.err) G.err.push(String(e.message || e)); });
