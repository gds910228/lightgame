// Shadowspire Ninja 影峰登天 — a vertical wall-jump tower climb.
// Vanilla ES module, fixed-step physics, procedural canvas art, WebAudio synth,
// site report bridge, debug G hooks and a deterministic ?autotest=1 suite.

import { CFG, zoneAt, buildLevel, surfaceBelow, routeStats } from './level.js';
import { makeAudio } from './audio.js';
import { makeUI } from './ui.js';
import { createRenderer } from './render.js';

const DT = 1 / 60;
const W = CFG.W, H = CFG.H, PPM = CFG.PPM;
const WORLD_W = CFG.WORLD_W, WORLD_H = CFG.WORLD_H;
const PARAMS = new URLSearchParams(location.search);
const AUTOTEST = PARAMS.has('autotest');
const AUTOSTART = PARAMS.get('autostart') === '1' || PARAMS.has('auto');

// --- feel / balance table -------------------------------------------------
const GRAV = 47;
const MAX_FALL = -22;
const MOVE = 7.7;
const GROUND_ACC = 58;
const AIR_ACC = 31;
const GROUND_FRICTION = 55;
const AIR_DRAG = 10;
const JUMP_V = 19.6;
const COYOTE = 0.11;
const JUMP_BUFFER = 0.12;
const WALL_SLIDE = 4.3;
const WALL_JUMP_X = 9.4;
const WALL_JUMP_Y = 17.7;
const MAX_CHI = 100;
const DASH_COST = 24;
const DASH_SPEED = 27;
const DASH_TIME = 0.16;
const DASH_CD = 0.38;
const DASH_IFRAME = 0.23;
const HITSTOP_DEATH = 0.085;
const HITSTOP_FLOW = 0.07;
const FLOW_TIME = 3.2;
const FLOW_MULT = 1.28;
const FLOW_BONUS = 200;
const WALL_DASH_BONUS = 120;
const DUST_CHI = 18;
const DUST_SCORE = 25;
const HEIGHT_SCORE = 2;
const CP_BONUS = 300;
const START_LIVES = 3;
const PW = 0.78, PH = 1.72;
const HALF_W = PW / 2;

const __BOOTERR = window.__BOOTERR || (window.__BOOTERR = []);

// --- modules --------------------------------------------------------------
const canvas = document.getElementById('cv');
const renderer = createRenderer(canvas);
const level = buildLevel();
const audio = makeAudio({ autotest: AUTOTEST });
const levelRoute = routeStats(level);

let reportTarget = null;
const reports = [];
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
  if (frame.score != null) frame.score = Math.round(frame.score);
  if (frame.progress != null) frame.progress = Math.round(frame.progress);
  reports.push(frame);
  try {
    if (reportTarget) reportTarget(frame);
    else if (window.parent !== window) {
      window.parent.postMessage(
        { source: 'lightgame', type: 'lightgame:report', payload: toWireReport(frame) }, '*'
      );
      if (frame.kind === 'ready') window.parent.postMessage({ source: 'lightgame', type: 'lightgame:ready', gameId: 'shadowspire-ninja', v: 1 }, '*');
    }
  } catch (e) { }
}
report('ready', { game: 'shadowspire-ninja' });

// --- state ----------------------------------------------------------------
let mode = 'title';             // title | play | over | win
let paused = false;
let noAuto = false;
let lives = START_LIVES;
let score = 0;
let dust = 0;
let chi = MAX_CHI;
let best = 0;
try { best = Math.max(0, parseInt(localStorage.getItem('ssn.best') || '0', 10) || 0); } catch (e) { }

let maxHeight = CFG.START_Y;
let lastScoredHeight = 0;
let checkpointY = 0;
let nextCpIndex = 1;
let cpSpawn = { x: 15, y: CFG.START_Y + 0.02 };
let runT = 0;
let ambientT = 0;
let endCause = '';
let hitstop = 0;
let shakeAmp = 0;
let flashT = 0;
let hintWall = false;
let hintDash = false;
let trailAcc = 0, ghostAcc = 0, dustAcc = 0;
let cameraY = -5;

const held = new Set();
const pressed = new Set();
const touch = { left: false, right: false, jump: false, dash: false };

const player = {
  x: 15, y: CFG.START_Y + 0.02, vx: 0, vy: 0, face: 1,
  grounded: true, coyote: 0, jumpBuf: 0, wallDir: 0,
  wallJumps: 0, flowT: 0, wallFreshT: 0,
  dashT: 0, dashCd: 0, dashDir: 1, invulnT: 0,
  trail: [],
};

const particles = [];
const floats = [];
const ghosts = [];

const ui = makeUI({
  onStart: () => { audio.unlock(); startGame(); },
  onRestart: () => { audio.unlock(); startGame(); },
  onBackTitle: () => { audio.play('ui'); toTitle(); },
  onMute: () => toggleMute(),
  onPause: () => togglePause(),
  onShare: () => {
    try {
      if (typeof window.dp_share === 'function') window.dp_share(Math.floor(maxHeight));
    } catch (e) { }
  },
});

// --- little helpers -------------------------------------------------------
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const approach = (v, target, delta) => v < target ? Math.min(target, v + delta) : Math.max(target, v - delta);
const rnd = (a, b) => a + Math.random() * (b - a);
const isJumpDown = () => pressed.has('Space') || pressed.has('KeyW') || pressed.has('ArrowUp');
const isJumpHeld = () => held.has('Space') || held.has('KeyW') || held.has('ArrowUp') || touch.jump;
const isDashDown = () => pressed.has('ShiftLeft') || pressed.has('ShiftRight') || pressed.has('KeyK');
const isLeft = () => held.has('KeyA') || held.has('ArrowLeft') || touch.left;
const isRight = () => held.has('KeyD') || held.has('ArrowRight') || touch.right;

function zoneNow() { return zoneAt(Math.max(0, Math.min(WORLD_H - 0.01, player.y))); }

function addShake(n) { shakeAmp = Math.min(8, shakeAmp + n); }
function addHitstop(n) { hitstop = Math.max(hitstop, n); }

function spawnParticle(x, y, vx, vy, type, color, life, size, extra = {}) {
  if (particles.length > 260) particles.shift();
  particles.push({ x, y, vx, vy, type, color, life, max: life, size, grav: 0, rot: 0, ...extra });
}
function burst(x, y, n, colors, spd = 6, opts = {}) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = spd * (0.32 + Math.random() * 0.85);
    spawnParticle(
      x, y, Math.cos(a) * s, Math.sin(a) * s + (opts.up || 0),
      opts.type || 'spark', colors[(Math.random() * colors.length) | 0],
      (opts.life || 0.55) * (0.6 + Math.random() * 0.7),
      (opts.size || 2) * (0.7 + Math.random() * 0.8),
      { grav: opts.grav == null ? 8 : opts.grav }
    );
  }
}
function ring(x, y, color, size = 2, life = 0.42) {
  spawnParticle(x, y, 0, 0, 'ring', color, life, size, { grav: 0 });
}
function floatText(x, y, text, color = '#ffe5a8') {
  if (floats.length > 16) floats.shift();
  floats.push({ x, y, text, color, life: 0.95, max: 0.95 });
}

function clearPressed() { pressed.clear(); }

function loadMutedUI() { ui.setMuted(audio.muted); }

// --- flow / reset ---------------------------------------------------------
function resetPickupsAndHazards() {
  for (const p of level.pickups) p.taken = false;
  for (const h of level.hazards) {
    if (!h.static) { h.active = false; h.warn = false; }
    else { h.active = true; h.warn = false; }
  }
}

function resetPlayer() {
  player.x = 15; player.y = CFG.START_Y + 0.02;
  player.vx = 0; player.vy = 0; player.face = 1;
  player.grounded = true; player.coyote = COYOTE; player.jumpBuf = 0; player.wallDir = 0;
  player.wallJumps = 0; player.flowT = 0; player.wallFreshT = 0;
  player.dashT = 0; player.dashCd = 0; player.dashDir = 1; player.invulnT = 0;
  player.trail.length = 0;
}

function resetRun() {
  lives = START_LIVES;
  score = 0; dust = 0; chi = MAX_CHI;
  maxHeight = CFG.START_Y; lastScoredHeight = Math.floor(CFG.START_Y);
  checkpointY = 0; nextCpIndex = 1;
  cpSpawn = { x: 15, y: CFG.START_Y + 0.02 };
  runT = 0; hitstop = 0; shakeAmp = 0; flashT = 0;
  hintWall = false; hintDash = false;
  trailAcc = 0; ghostAcc = 0; dustAcc = 0;
  particles.length = 0; floats.length = 0; ghosts.length = 0;
  resetPickupsAndHazards();
  resetPlayer();
}

function snapCamera() {
  cameraY = clamp(player.y - 17.8, -5, WORLD_H - 18);
}

function startGame() {
  resetRun();
  mode = 'play'; paused = false; endCause = '';
  snapCamera();
  ui.showTitle(false); ui.hideEnd(); ui.showPause(false); ui.setPaused(false);
  ui.setBest(best);
  audio.setState(zoneNow().id);
  ui.toast('A/D 横移 · 空格起跃 · 贴墙再按空格蹬墙 · Shift 冲刺', 4600);
  report('progress', { score: 0, progress: 0 });
}

function toTitle() {
  resetRun();
  mode = 'title'; paused = false;
  snapCamera();
  ui.showTitle(true); ui.hideEnd(); ui.showPause(false); ui.setPaused(false);
  ui.setBest(best);
  audio.setState('title');
}

function togglePause(force) {
  if (mode !== 'play') return;
  paused = force == null ? !paused : !!force;
  ui.setPaused(paused);
  if (paused) {
    ui.toast('入定 · P 继续', 1200);
    audio.setState('title');
  } else {
    audio.setState(zoneNow().id);
  }
}

function toggleMute() {
  audio.toggleMute();
  ui.setMuted(audio.muted);
  ui.toast(audio.muted ? '已静音 · M 恢复' : '声音已开 · M 静音', 1200);
}

function saveBest() {
  const h = Math.max(0, Math.floor(maxHeight));
  if (h > best) {
    best = h;
    try { localStorage.setItem('ssn.best', String(best)); } catch (e) { }
    ui.setBest(best);
    return true;
  }
  return false;
}

function gameOver(cause = '灯焰熄灭') {
  if (mode !== 'play') {
    if (mode === 'over') return;
  }
  endCause = cause;
  mode = 'over'; paused = false;
  saveBest();
  ui.setPaused(false);
  ui.showPause(false);
  report('gameOver', { score, progress: Math.floor(maxHeight), cause });
  audio.setState('title');
  audio.play('over');
  ui.showEnd({ kind: 'over', score: Math.floor(score), height: Math.floor(maxHeight), best, time: runT, cause });
}

function win() {
  if (mode !== 'play') return;
  mode = 'win'; paused = false;
  maxHeight = WORLD_H;
  score += 1000;
  saveBest();
  ui.setPaused(false);
  ui.showPause(false);
  report('complete', { score, progress: WORLD_H });
  audio.setState('win');
  audio.play('win');
  burst(player.x, player.y + 1, 42, ['#fff0b5', '#e4c06f', '#9fe8c8', '#c84e3b'], 10, { size: 2.4, life: 1.4, up: 4 });
  ui.showEnd({ kind: 'win', score: Math.floor(score), height: WORLD_H, best, time: runT });
}

function damage(cause = '刺阵') {
  if (mode !== 'play' || player.invulnT > 0) return false;
  lives--;
  endCause = cause;
  hitstop = HITSTOP_DEATH;
  addShake(7);
  flashT = 0.3;
  burst(player.x, player.y + 0.8, 24, ['#d9493a', '#f3a45f', '#ffe0a8'], 8, { size: 2.8, life: 0.7, up: 2 });
  ring(player.x, player.y + 0.8, 'rgba(255,130,92,.8)', 2, 0.55);
  audio.play('hurt');
  if (lives <= 0) {
    gameOver(cause);
  } else {
    respawn();
  }
  return true;
}

function respawn() {
  player.x = cpSpawn.x; player.y = cpSpawn.y;
  player.vx = 0; player.vy = 0;
  player.grounded = false; player.coyote = 0; player.jumpBuf = 0;
  player.wallDir = 0; player.wallJumps = 0; player.flowT = 0; player.wallFreshT = 0;
  player.dashT = 0; player.dashCd = 0; player.invulnT = 1.25;
  player.trail.length = 0;
  chi = Math.max(chi, 60);
  snapCamera();
  ui.toast(`命火复燃 · 还剩 ${lives} 命`, 1600);
}

// --- input ----------------------------------------------------------------
function processMeta() {
  if (pressed.has('KeyM')) {
    pressed.delete('KeyM');
    toggleMute();
  }
  if (pressed.has('KeyP')) {
    pressed.delete('KeyP');
    if (mode === 'play') togglePause();
  }
  if (pressed.has('KeyR')) {
    pressed.delete('KeyR');
    if (mode !== 'title') startGame();
  }
  if (mode === 'title' && (pressed.has('Space') || pressed.has('Enter'))) {
    pressed.delete('Space'); pressed.delete('Enter');
    startGame();
  } else if ((mode === 'over' || mode === 'win') && (pressed.has('Space') || pressed.has('Enter'))) {
    pressed.delete('Space'); pressed.delete('Enter');
    startGame();
  }
}

function press(...codes) {
  for (const c of codes) { held.add(c); pressed.add(c); }
}
function release(...codes) {
  for (const c of codes) held.delete(c);
}

window.addEventListener('keydown', (e) => {
  const c = e.code;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight'].includes(c)) e.preventDefault();
  if (e.repeat) return;
  if (!held.has(c)) pressed.add(c);
  held.add(c);
  if (!AUTOTEST) audio.unlock();
});
window.addEventListener('keyup', (e) => { held.delete(e.code); });
window.addEventListener('blur', () => {
  held.clear(); touch.left = touch.right = touch.jump = touch.dash = false;
});

function bindTouch(id, flag, onDown) {
  const el = document.getElementById(id);
  if (!el) return;
  const down = (e) => {
    if (e.cancelable) e.preventDefault();
    touch[flag] = true;
    if (onDown) onDown();
    el.classList.add('on');
    if (!AUTOTEST) audio.unlock();
    try { el.setPointerCapture(e.pointerId); } catch (err) { }
  };
  const up = (e) => {
    touch[flag] = false;
    el.classList.remove('on');
    if (e && e.cancelable) e.preventDefault();
  };
  el.addEventListener('pointerdown', down);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  el.addEventListener('pointerleave', (e) => { if (e.pointerType === 'touch') up(e); });
}
bindTouch('btn-left', 'left');
bindTouch('btn-right', 'right');
bindTouch('btn-jump', 'jump', () => pressed.add('Space'));
bindTouch('btn-dash', 'dash', () => pressed.add('ShiftLeft'));

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    saveBest();
    if (mode === 'play' && !paused) togglePause(true);
  }
});
window.addEventListener('pagehide', () => { saveBest(); });

// --- physics --------------------------------------------------------------
function tryDash(dir) {
  if (player.dashT > 0) return false;
  if (player.dashCd > 0) return false;
  if (chi < DASH_COST) {
    audio.play('dashNo');
    floatText(player.x, player.y + 1.7, '气不足', '#d99a82');
    return false;
  }
  const dd = dir || player.face;
  player.dashDir = dd;
  player.face = dd;
  player.dashT = DASH_TIME;
  player.dashCd = DASH_CD;
  player.invulnT = Math.max(player.invulnT, DASH_IFRAME);
  player.vy = 0;
  player.vx = dd * DASH_SPEED;
  chi = Math.max(0, chi - DASH_COST);
  if (player.wallFreshT > 0) {
    player.wallFreshT = 0;
    score += WALL_DASH_BONUS;
    chi = Math.min(MAX_CHI, chi + 10);
    ui.banner('蹬墙 · 疾影', `+${WALL_DASH_BONUS} 分 · 气 +10`, 1200);
    floatText(player.x, player.y + 2.0, `+${WALL_DASH_BONUS}`, '#ffe38f');
    burst(player.x, player.y + 0.85, 16, ['#ffe3a0', '#c84e3b', '#9fe8c8'], 8, { size: 2.2, life: 0.7 });
    audio.play('wallDash');
    addShake(3);
  } else {
    audio.play('dash');
  }
  for (let i = 0; i < 10; i++) {
    spawnParticle(player.x - dd * 0.3, player.y + rnd(0.2, 1.4), -dd * rnd(3, 9), rnd(-2, 2), 'spark', i % 2 ? '#ffe0a0' : '#c84e3b', rnd(0.25, 0.5), 1.2 + Math.random(), { grav: -2 });
  }
  return true;
}

function updatePlayer(dt) {
  const p = player;
  const wasGrounded = p.grounded;
  const prevVy = p.vy;

  p.dashCd = Math.max(0, p.dashCd - dt);
  p.dashT = Math.max(0, p.dashT - dt);
  p.invulnT = Math.max(0, p.invulnT - dt);
  p.flowT = Math.max(0, p.flowT - dt);
  p.wallFreshT = Math.max(0, p.wallFreshT - dt);
  p.coyote = Math.max(0, p.coyote - dt);

  const left = isLeft(), right = isRight();
  const dir = (right ? 1 : 0) - (left ? 1 : 0);
  if (dir) p.face = dir;

  if (isJumpDown()) p.jumpBuf = JUMP_BUFFER;
  else p.jumpBuf = Math.max(0, p.jumpBuf - dt);

  if (isDashDown()) tryDash(dir);

  if (p.dashT > 0) {
    p.vx = p.dashDir * DASH_SPEED;
    p.vy = 0;
    ghostAcc += dt;
    if (ghostAcc > 0.032) {
      ghostAcc = 0;
      ghosts.push({ x: p.x, y: p.y, life: 1, rot: 0.25 * p.dashDir });
    }
  } else {
    // jump order: ground/coyote first, then wall
    if (p.jumpBuf > 0 && (p.grounded || p.coyote > 0)) {
      p.vy = JUMP_V;
      p.grounded = false;
      p.coyote = 0;
      p.jumpBuf = 0;
      p.wallJumps = 0;
      audio.play('jump');
      burst(p.x, p.y, 8, ['#e6c98e', '#a9774c', '#f5dfb0'], 4, { size: 1.5, life: 0.4, up: 1, type: 'dust' });
      ring(p.x, p.y, 'rgba(255,224,164,.5)', 1.4, 0.3);
    } else if (p.jumpBuf > 0 && p.wallDir !== 0 && !p.grounded) {
      const away = -p.wallDir;
      p.vx = away * WALL_JUMP_X;
      p.vy = WALL_JUMP_Y;
      p.face = away;
      p.grounded = false;
      p.coyote = 0;
      p.jumpBuf = 0;
      p.wallJumps++;
      p.wallFreshT = 1.5;
      audio.play('wall');
      const wvx = p.wallDir * 4;
      burst(p.x - p.wallDir * 0.35, p.y + 1.1, 10, ['#ffe0a0', '#9fe8c8', '#c84e3b'], 5, { size: 1.6, life: 0.46, up: 1 });
      addShake(1.5);
      if (p.wallJumps >= 3) {
        p.wallJumps = 0;
        p.flowT = FLOW_TIME;
        score += FLOW_BONUS;
        hitstop = Math.max(hitstop, HITSTOP_FLOW);
        addShake(5);
        flashT = Math.max(flashT, 0.12);
        audio.play('flow');
        ui.banner('流 · 蹬墙三连', `疾行加速 ${FLOW_TIME.toFixed(0)} 秒 · +${FLOW_BONUS} 分`, 1800);
        floatText(p.x, p.y + 2.2, `+${FLOW_BONUS}`, '#ffe58f');
        ring(p.x, p.y + 0.8, 'rgba(255,225,150,.9)', 2.5, 0.7);
        burst(p.x, p.y + 0.8, 18, ['#ffe8a8', '#9fe8c8'], 7, { size: 2.1, life: 0.7 });
      }
      if (!hintWall && runT < 12) {
        hintWall = true;
        ui.toast('漂亮的蹬墙！趁气未散按 Shift 冲刺', 2600);
      }
    }
    // horizontal control
    if (dir) {
      const target = dir * MOVE * (p.flowT > 0 ? FLOW_MULT : 1);
      p.vx = approach(p.vx, target, (p.grounded ? GROUND_ACC : AIR_ACC) * dt);
    } else {
      p.vx = approach(p.vx, 0, (p.grounded ? GROUND_FRICTION : AIR_DRAG) * dt);
    }
    // gravity and variable jump
    if (!p.grounded) {
      p.vy -= GRAV * dt;
      if (!isJumpHeld() && p.vy > 0) p.vy -= GRAV * 0.95 * dt;
      p.vy = Math.max(MAX_FALL, p.vy);
    } else if (p.vy < 0) {
      p.vy = 0;
    }
    // wall slide
    if (!p.grounded && p.wallDir !== 0 && p.vy < 0 && dir === p.wallDir) {
      p.vy = Math.max(p.vy, -WALL_SLIDE);
      if (Math.random() < dt * 26) {
        spawnParticle(p.x + p.wallDir * HALF_W, p.y + rnd(0.2, 1.4), -p.wallDir * rnd(0.5, 2.2), rnd(-2.5, -0.6), 'spark', '#e8c78d', rnd(0.2, 0.45), 1.1, { grav: 2 });
      }
    }
  }

  // integrate horizontal + wall collision
  p.x += p.vx * dt;
  p.x = clamp(p.x, HALF_W, WORLD_W - HALF_W);
  for (const w of level.walls) {
    if (p.x + HALF_W <= w.x || p.x - HALF_W >= w.x + w.w || p.y >= w.y + w.h || p.y + PH <= w.y) continue;
    if (p.vx > 0) p.x = w.x - HALF_W;
    else if (p.vx < 0) p.x = w.x + w.w + HALF_W;
    else {
      const dL = Math.abs(p.x - HALF_W - (w.x + w.w));
      const dR = Math.abs(p.x + HALF_W - w.x);
      if (dL < dR) p.x = w.x + w.w + HALF_W;
      else p.x = w.x - HALF_W;
    }
    p.vx = 0;
  }

  // integrate vertical + one-way landings
  const oldY = p.y;
  if (p.dashT <= 0) p.y += p.vy * dt;
  p.grounded = false;
  if (p.vy <= 0 || p.dashT <= 0) {
    let landY = -Infinity;
    for (const s of level.platforms) {
      if (p.x + HALF_W <= s.x + 0.01 || p.x - HALF_W >= s.x + s.w - 0.01) continue;
      if (oldY >= s.y - 0.015 && p.y <= s.y + 0.015 && s.y > landY) landY = s.y;
    }
    for (const w of level.walls) {
      const top = w.y + w.h;
      if (p.x + HALF_W <= w.x + 0.01 || p.x - HALF_W >= w.x + w.w - 0.01) continue;
      if (oldY >= top - 0.015 && p.y <= top + 0.015 && top > landY) landY = top;
    }
    if (landY > -Infinity) {
      p.y = landY;
      p.vy = 0;
      p.grounded = true;
    }
  }

  // wall probe after movement
  p.wallDir = 0;
  if (!p.grounded) {
    for (const w of level.walls) {
      if (p.y >= w.y + w.h || p.y + PH <= w.y) continue;
      if (Math.abs((p.x - HALF_W) - (w.x + w.w)) < 0.16 && p.x > w.x + w.w * 0.5) { p.wallDir = -1; break; }
      if (Math.abs((p.x + HALF_W) - w.x) < 0.16 && p.x < w.x + w.w * 0.5) { p.wallDir = 1; break; }
    }
  }

  if (p.grounded) {
    p.wallJumps = 0;
    p.coyote = COYOTE;
    if (!wasGrounded && prevVy < -7) {
      audio.play('land');
      burst(p.x, p.y, 6, ['#d8b27f', '#8c6a52'], 3, { size: 1.4, life: 0.35, type: 'dust', up: 0 });
      addShake(Math.min(2.5, -prevVy * 0.11));
    }
    if (Math.abs(p.vx) > 4 && Math.random() < dt * 12) {
      dustAcc += dt;
      if (dustAcc > 0.1) {
        dustAcc = 0;
        spawnParticle(p.x - p.face * 0.25, p.y + 0.05, -p.face * rnd(1, 3), rnd(0.2, 1.4), 'dust', 'rgba(214,174,122,.55)', rnd(0.25, 0.45), rnd(1, 2), { grav: -1 });
      }
    }
  }

  // trail
  trailAcc += dt;
  if (trailAcc > 0.035) {
    trailAcc = 0;
    p.trail.push({ x: p.x - p.face * 0.12, y: p.y + 1.42 });
    if (p.trail.length > 11) p.trail.shift();
  }

  // teach the first wall-dash inside the first ten seconds
  if (!hintDash && p.wallFreshT > 0 && runT < 10) {
    hintDash = true;
    ui.toast('趁蹬墙后的 1.5 秒按 Shift，疾影会额外加分', 2600);
  }
}

// --- interactions ---------------------------------------------------------
function updateHazards(dt) {
  for (const h of level.hazards) {
    if (h.static) { h.active = true; h.warn = false; continue; }
    const local = (runT + h.phase) % h.cycle;
    h.warn = local < h.warnDur;
    h.active = local >= h.warnDur && local < h.warnDur + h.activeDur;
  }
  if (player.invulnT > 0) return;
  for (const h of level.hazards) {
    if (!h.active) continue;
    if (player.x + HALF_W > h.x && player.x - HALF_W < h.x + h.w &&
      player.y < h.y + h.h && player.y + PH > h.y) {
      damage('刺阵');
      return;
    }
  }
}

function updatePickups() {
  const cx = player.x, cy = player.y + 0.86;
  for (const p of level.pickups) {
    if (p.taken) continue;
    const dx = cx - p.x, dy = cy - p.y;
    if (dx * dx + dy * dy < 0.82 * 0.82) {
      p.taken = true;
      dust++;
      chi = Math.min(MAX_CHI, chi + DUST_CHI);
      score += DUST_SCORE;
      audio.play('dust');
      burst(p.x, p.y, 12, ['#ffe7a6', '#f4bd62', '#fff5cf'], 5, { size: 1.8, life: 0.55, grav: -1 });
      ring(p.x, p.y, 'rgba(255,222,138,.75)', 1.2, 0.4);
      floatText(p.x, p.y + 0.7, `灯屑 +1 · 气 +${DUST_CHI}`, '#ffe7a6');
    }
  }
}

function checkProgress() {
  if (mode !== 'play') return;
  if (player.y > maxHeight) maxHeight = player.y;
  const fl = Math.floor(maxHeight);
  if (fl > lastScoredHeight) {
    score += (fl - lastScoredHeight) * HEIGHT_SCORE;
    lastScoredHeight = fl;
  }
  while (nextCpIndex <= CFG.CP_COUNT && player.y >= nextCpIndex * CFG.CP_STEP) {
    checkpointY = nextCpIndex * CFG.CP_STEP;
    cpSpawn = { x: 15, y: checkpointY + 0.03 };
    score += CP_BONUS;
    chi = MAX_CHI;
    nextCpIndex++;
    audio.play('checkpoint');
    addShake(2.5);
    flashT = Math.max(flashT, 0.1);
    ring(player.x, player.y + 0.8, 'rgba(151,240,207,.9)', 3, 0.8);
    burst(player.x, player.y + 0.8, 22, ['#b9f3d9', '#ffe2a1'], 7, { size: 2, life: 0.8 });
    ui.banner(`灯标 ${checkpointY}m`, `命火已记 · 气已回满 · +${CP_BONUS}`, 1900);
    saveBest();
    report('progress', { score, progress: checkpointY });
    audio.setState(zoneNow().id);
  }
  if (player.y < checkpointY - 28) {
    damage('坠入深渊');
  }
  if (player.y >= WORLD_H) win();
}

// --- camera / fx ----------------------------------------------------------
function updateCamera(dt, snap = false) {
  const target = clamp(player.y - 17.8, -5, WORLD_H - 18);
  if (snap) cameraY = target;
  else cameraY += (target - cameraY) * (1 - Math.exp(-7.5 * dt));
  shakeAmp *= Math.exp(-6.2 * dt);
  if (shakeAmp < 0.04) shakeAmp = 0;
  flashT = Math.max(0, flashT - dt);
  if (hitstop > 0) hitstop = Math.max(0, hitstop - dt);
}

function updateFx(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) { particles.splice(i, 1); continue; }
    p.vy -= (p.grav || 0) * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.rot = (p.rot || 0) + dt * 5;
  }
  for (let i = floats.length - 1; i >= 0; i--) {
    const f = floats[i];
    f.life -= dt;
    f.y += dt * 1.15;
    if (f.life <= 0) floats.splice(i, 1);
  }
  for (let i = ghosts.length - 1; i >= 0; i--) {
    ghosts[i].life -= dt * 3.4;
    if (ghosts[i].life <= 0) ghosts.splice(i, 1);
  }
}

// --- main tick ------------------------------------------------------------
function tick(dt) {
  processMeta();
  if (mode !== 'play') { updateFx(dt); updateCamera(dt); clearPressed(); return; }
  if (paused) { updateFx(0); clearPressed(); return; }
  if (hitstop > 0) {
    hitstop = Math.max(0, hitstop - dt);
    updateFx(dt * 0.28);
    updateCamera(dt * 0.3);
    clearPressed();
    return;
  }
  runT += dt;
  checkProgress();
  if (mode !== 'play') { updateFx(dt); clearPressed(); return; }
  updatePlayer(dt);
  updatePickups();
  updateHazards(dt);
  if (mode === 'play') checkProgress();
  updateFx(dt);
  updateCamera(dt);
  if (mode === 'play') {
    const z = zoneNow();
    if (audio.state !== 'danger' && lives === 1) audio.setState('danger');
    else if (lives > 1 && audio.state === 'danger') audio.setState(z.id);
    else if (audio.state === 'title' || !audio.state) audio.setState(z.id);
  }
  clearPressed();
}

// --- render ---------------------------------------------------------------
let lastRenderT = 0;
function render(t) {
  lastRenderT = t;
  const zone = zoneNow();
  const z = zoneAt(clamp(player.y, 0, WORLD_H - 0.001));
  const shakeX = shakeAmp > 0 ? Math.sin(t * 88) * shakeAmp : 0;
  const shakeY = shakeAmp > 0 ? Math.cos(t * 73) * shakeAmp * 0.7 : 0;
  renderer.draw({
    t, mode, paused,
    cameraY, shakeX, shakeY,
    level, player, particles, floats, ghosts,
    checkpointY, flowT: player.flowT,
    flashT, runT,
    showPlayer: true,
  });
  ui.setHud({
    height: maxHeight,
    best,
    score: Math.floor(score),
    dust,
    lives,
    chi,
    maxChi: MAX_CHI,
    dashCd: player.dashCd,
    flowT: player.flowT,
    flowMult: player.flowT > 0 ? FLOW_MULT : 1,
    zone: z,
  });
}

// --- loop -----------------------------------------------------------------
let lastTs = performance.now();
let acc = 0;
function frame(ts) {
  requestAnimationFrame(frame);
  let dt = (ts - lastTs) / 1000;
  lastTs = ts;
  if (!Number.isFinite(dt) || dt < 0) dt = 0;
  dt = Math.min(dt, 0.05);
  if (!document.hidden) {
    if (mode === 'play' && !paused && !noAuto) {
      acc = Math.min(acc + dt, 0.16);
      let guard = 0;
      while (acc >= DT && guard++ < 6) { tick(DT); acc -= DT; }
    } else {
      processMeta();
      ambientT += dt;
      if (!paused) updateFx(dt);
      updateCamera(dt);
    }
  }
  audio.tick(dt);
  render(ts / 1000);
}

// --- boot -----------------------------------------------------------------
resetRun();
mode = 'title';
snapCamera();
ui.setBest(best);
loadMutedUI();
ui.showTitle(true);
ui.setHud({
  height: maxHeight, best, score, dust, lives, chi, maxChi: MAX_CHI,
  dashCd: 0, flowT: 0, flowMult: 1, zone: zoneAt(0),
});
audio.setState('title');
render(performance.now() / 1000);
requestAnimationFrame(frame);

if (AUTOSTART && !AUTOTEST) {
  startGame();
}

// --- G debug hooks --------------------------------------------------------
function stateSnapshot() {
  return {
    mode, paused, noAuto, cameraY,
    x: player.x, y: player.y, height: player.y, maxHeight,
    vx: player.vx, vy: player.vy, face: player.face,
    grounded: player.grounded, wallDir: player.wallDir, wallJumps: player.wallJumps,
    flowT: player.flowT, flowMult: player.flowT > 0 ? FLOW_MULT : 1,
    wallFreshT: player.wallFreshT,
    dashT: player.dashT, dashCd: player.dashCd, invuln: player.invulnT,
    lives, score: Math.floor(score), dust, chi, checkpoint: checkpointY,
    best, runT, streakBroken: player.wallJumps,
    particles: particles.length, floats: floats.length,
    pickupsLeft: level.pickups.reduce((n, p) => n + (p.taken ? 0 : 1), 0),
    zone: zoneNow().id, route: levelRoute,
  };
}

const G = {
  err: __BOOTERR,
  W, H, PPM, WORLD_W, WORLD_H,
  step: (n = 60, dt = DT) => {
    for (let i = 0; i < n; i++) { tick(dt); render(performance.now() / 1000); }
  },
  upd: (n = 30, dt = DT) => { for (let i = 0; i < n; i++) tick(dt); },
  press,
  release,
  setNoAuto: (v) => { noAuto = !!v; },
  setReportTarget: (fn) => { reportTarget = typeof fn === 'function' ? fn : null; },
  state: stateSnapshot,
  setHeight: (y) => {
    player.y = clamp(Number(y) || 0, -10, WORLD_H);
    player.vx = player.vy = 0;
    player.grounded = false; player.coyote = 0; player.wallDir = 0;
    player.dashT = 0; player.dashCd = 0; player.trail.length = 0;
    snapCamera();
    return player.y;
  },
  setPos: (x, y) => {
    player.x = clamp(Number(x) || 0, HALF_W, WORLD_W - HALF_W);
    player.y = clamp(Number(y) || 0, -10, WORLD_H);
    player.vx = player.vy = 0;
    player.grounded = false; player.coyote = 0; player.wallDir = 0;
    player.dashT = 0; player.trail.length = 0;
    snapCamera();
    return { x: player.x, y: player.y };
  },
  setLives: (n) => { lives = clamp(n | 0, 0, 9); ui.setHud({ height: maxHeight, best, score, dust, lives, chi, maxChi: MAX_CHI, dashCd: player.dashCd, flowT: player.flowT, flowMult: player.flowT > 0 ? FLOW_MULT : 1, zone: zoneNow() }); },
  setChi: (n) => { chi = clamp(Number(n) || 0, 0, MAX_CHI); },
  setScore: (n) => { score = Math.max(0, Number(n) || 0); },
  setDust: (n) => { dust = Math.max(0, n | 0); },
  setBest: (n) => { best = Math.max(0, n | 0); ui.setBest(best); },
  setInvuln: (n) => { player.invulnT = Math.max(0, Number(n) || 0); },
  setPaused: (v) => { if (mode === 'play') { paused = !!v; ui.setPaused(paused); } },
  forceGameOver: () => { if (mode !== 'play') startGame(); lives = 0; gameOver('力竭'); },
  forceWin: () => { if (mode !== 'play') startGame(); win(); },
  damage: (cause) => damage(cause || '试炼'),
  startGame, toTitle, win, gameOver, report,
  level, route: levelRoute, audio, ui, renderer,
  audioState: () => audio.state,
  render: () => render(performance.now() / 1000),
};
window.G = G;
window.__G = G;

// --- autotest -------------------------------------------------------------
const nap = () => new Promise(r => {
  const mc = new MessageChannel();
  mc.port1.onmessage = () => r();
  mc.port2.postMessage(0);
});

const finite = v => typeof v === 'number' && Number.isFinite(v);

async function autotest() {
  G.setNoAuto(true);
  const results = [];
  const assert = (id, ok, name) => {
    results.push({ id, ok: !!ok, name });
    if (!ok) console.warn(`[autotest] FAIL T${id}: ${name}`);
  };
  const S = () => G.state();
  const savedBest = best;
  const savedStored = (() => { try { return localStorage.getItem('ssn.best'); } catch (e) { return null; } })();
  const frames = [];
  G.setReportTarget(f => frames.push(f));
  audio.setMuted(true, false);

  try {
    await nap();

    // T1 boot clean
    assert(1, G.err.length === 0 && (!window.__BOOTERR || window.__BOOTERR.length === 0), `启动零报错 errors=${G.err.length}`);

    // T2 short run stays finite
    startGame();
    G.press('KeyD', 'Space'); G.upd(20); G.release('KeyD', 'Space'); G.upd(60);
    const st2 = S();
    assert(2, ['x', 'y', 'vx', 'vy', 'height', 'score', 'chi', 'dashCd'].every(k => finite(st2[k])), '跑动 80 帧关键数值无 NaN');

    // T3 ground jump impulse
    startGame();
    const yj = S().height;
    G.press('Space'); G.upd(1); G.release('Space');
    assert(3, S().vy > 10 && S().height > yj, `跳跃上升 vy=${S().vy.toFixed(2)}`);

    // T4 wall-jump maths (real wall contact)
    startGame();
    G.setPos(1.58, 5.2); G.upd(1);
    const wallDetected = S().wallDir === -1;
    G.press('Space'); G.upd(1); G.release('Space');
    const st4 = S();
    assert(4, wallDetected && st4.vx > 5 && st4.vy > 10 && st4.wallJumps >= 1, `贴墙=${wallDetected} vx=${st4.vx.toFixed(1)} vy=${st4.vy.toFixed(1)} 连跳=${st4.wallJumps}`);

    // T5 dash cost / i-frames / cooldown
    startGame();
    G.setChi(100);
    G.press('KeyD', 'ShiftLeft'); G.upd(1); G.release('ShiftLeft', 'KeyD');
    const st5 = S();
    assert(5, st5.chi === 76 && st5.dashCd > 0.2 && st5.invuln > 0, `气 100→${st5.chi} cd=${st5.dashCd.toFixed(2)} i帧=${st5.invuln.toFixed(2)}`);

    // T6 dash rejection during cooldown
    G.press('ShiftLeft'); G.upd(1); G.release('ShiftLeft');
    assert(6, S().chi === 76, '冷却中的第二次冲刺不扣气');

    // T7 dash refusal when out of chi
    G.setChi(10); G.upd(36);
    G.press('ShiftLeft'); G.upd(1); G.release('ShiftLeft');
    assert(7, S().chi === 10 && S().dashT === 0, '气不足时冲刺被拒绝');

    // T8 three air wall-jumps → flow boost and score
    startGame();
    for (let i = 0; i < 3; i++) {
      if (i % 2 === 0) G.setPos(1.58, 5.2); else G.setPos(28.42, 9.5);
      G.upd(1);
      G.press('Space'); G.upd(1); G.release('Space'); G.upd(1);
    }
    const st8 = S();
    assert(8, st8.flowT > 0 && st8.score >= FLOW_BONUS, `三连蹬墙 flowT=${st8.flowT.toFixed(2)} score=${st8.score}`);

    // T9 wall-jump + dash bonus (first ten seconds positive loop)
    startGame();
    G.setPos(1.58, 5.2); G.upd(1);
    G.press('Space'); G.upd(1); G.release('Space'); G.upd(1);
    const scoreBeforeDash = S().score;
    G.press('ShiftLeft'); G.upd(1); G.release('ShiftLeft');
    assert(9, S().score >= scoreBeforeDash + 100, `蹬墙后冲刺 +${S().score - scoreBeforeDash} 分`);

    // T10 checkpoint activation
    startGame();
    frames.length = 0;
    G.setHeight(150); G.upd(1);
    const st10 = S();
    assert(10, st10.checkpoint >= 150 && st10.chi === MAX_CHI && st10.score >= CP_BONUS, `灯标=${st10.checkpoint}m 气=${st10.chi} 分=${st10.score}`);

    // T11 progress report exists after checkpoint
    assert(11, frames.some(f => f.kind === 'progress' && f.progress >= 150), `progress 帧=${frames.map(f => f.kind).join(',')}`);

    // T12 damage costs a life and respawns at checkpoint
    G.setLives(3); G.setInvuln(0);
    const cp10 = S().checkpoint;
    G.damage('刺阵'); G.upd(2);
    const st12 = S();
    assert(12, st12.lives === 2 && st12.mode === 'play' && Math.abs(st12.y - cp10) < 2.5, `命 3→${st12.lives} 复活=${st12.y.toFixed(1)}m`);

    // T13 failure path: final life → gameOver report
    frames.length = 0;
    G.setInvuln(0); G.setLives(1);
    G.damage('最后一击'); G.upd(1);
    assert(13, S().mode === 'over' && frames.some(f => f.kind === 'gameOver'), `mode=${S().mode} 上报=${frames.map(f => f.kind).join(',')}`);

    // T14 victory path: crossing the summit reaches complete
    startGame(); frames.length = 0;
    G.setHeight(1200); G.upd(1);
    assert(14, S().mode === 'win' && frames.some(f => f.kind === 'complete' && f.progress === 1200), `mode=${S().mode} 上报=${frames.map(f => f.kind).join(',')}`);

    // T15 dust pickup economy
    startGame();
    const pk = level.pickups.find(p => !p.taken);
    G.setChi(40); G.setDust(0); G.setScore(0);
    G.setPos(pk.x, pk.y - 0.72); G.upd(1);
    const st15 = S();
    assert(15, st15.dust === 1 && st15.chi === 58 && st15.score >= DUST_SCORE, `灯屑=${st15.dust} 气=${st15.chi} 分=${st15.score}`);

    // T16 height pays score
    startGame();
    const s16 = S().score;
    G.setHeight(20); G.upd(1);
    assert(16, S().score > s16 + 20, `爬升加分 ${s16}→${S().score}`);

    // T17 simulated input moves the body
    startGame();
    const x17 = S().x;
    G.press('KeyD'); G.upd(30); G.release('KeyD');
    assert(17, S().x > x17 + 1, `按 D 30 帧 x ${x17.toFixed(2)}→${S().x.toFixed(2)}`);

    // T18 jump input raises height
    startGame();
    const h18 = S().height;
    G.press('Space'); G.upd(12); G.release('Space');
    assert(18, S().height > h18 + 0.7, `空格后高度 ${h18.toFixed(2)}→${S().height.toFixed(2)}`);

    // T19 pause freezes, resume moves
    startGame();
    G.press('KeyD'); G.upd(6);
    G.press('KeyP'); G.upd(1);
    const xPause = S().x;
    G.upd(30);
    const pausedX = S().x;
    G.press('KeyP'); G.upd(1); G.upd(10); G.release('KeyD');
    assert(19, S().paused === false && Math.abs(pausedX - xPause) < 0.001 && S().x > pausedX + 0.2, `暂停冻结 x=${pausedX.toFixed(2)} 恢复后=${S().x.toFixed(2)}`);

    // T20 touch bindings exist and jump button works
    startGame();
    const h20 = S().height;
    const touchIds = ['btn-left', 'btn-right', 'btn-jump', 'btn-dash'];
    const touchOk = touchIds.every(id => !!document.getElementById(id));
    const jumpBtn = document.getElementById('btn-jump');
    jumpBtn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch' }));
    G.upd(2);
    jumpBtn.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerType: 'touch' }));
    assert(20, touchOk && S().height > h20, `触控键=${touchOk} 跳后高度=${S().height.toFixed(2)}`);

    // T21 restart resets the run
    startGame();
    G.setScore(999); G.setDust(5); G.setHeight(300); G.forceGameOver();
    startGame();
    const st21 = S();
    assert(21, st21.lives === 3 && st21.score === 0 && st21.dust === 0 && st21.mode === 'play' && st21.height < 5, `重开 lives=${st21.lives} score=${st21.score} h=${st21.height.toFixed(1)}`);

    // T22 best height persists and can be restored
    try { localStorage.setItem('ssn.best', '0'); } catch (e) { }
    G.setBest(0);
    startGame(); G.setHeight(432); G.upd(1); G.forceGameOver();
    let stored = 0;
    try { stored = parseInt(localStorage.getItem('ssn.best') || '0', 10) || 0; } catch (e) { }
    assert(22, stored >= 432 && S().best >= 432, `localStorage=${stored} state.best=${S().best}`);

    // T23 ready is the first report frame
    assert(23, reports[0] && reports[0].kind === 'ready', `首帧=${reports[0] && reports[0].kind}`);

    // T24 progress → gameOver order
    startGame(); frames.length = 0;
    G.setHeight(150); G.upd(1); G.forceGameOver();
    const kinds24 = frames.map(f => f.kind);
    assert(24, kinds24.indexOf('progress') >= 0 && kinds24.indexOf('progress') < kinds24.indexOf('gameOver') && kinds24[kinds24.length - 1] === 'gameOver', `帧序=${kinds24.join('→')}`);

    // T25 progress → complete order and integer payload
    startGame(); frames.length = 0;
    G.setHeight(1200); G.upd(1);
    const kinds25 = frames.map(f => f.kind);
    const last25 = frames[frames.length - 1];
    assert(25, kinds25.includes('complete') && Number.isInteger(last25.score) && Number.isInteger(last25.progress), `帧序=${kinds25.join('→')}`);

    // T26 level route continuity
    assert(26, levelRoute.count > 350 && levelRoute.maxDy <= 3.05 && levelRoute.maxEdgeGap <= 7.0 && levelRoute.top >= 1199, `路线 ${levelRoute.count} 台 最大升差 ${levelRoute.maxDy.toFixed(2)}m 最大横距 ${levelRoute.maxEdgeGap.toFixed(2)}m`);

    // T27 full fast-forward with random input, no NaN / new errors
    startGame();
    const errBefore = G.err.length;
    const codes = ['KeyA', 'KeyD', 'Space', 'ShiftLeft', 'Space'];
    for (let i = 0; i < 1200; i++) {
      if (i % 23 === 0) G.release('KeyA', 'KeyD', 'ShiftLeft');
      if (i % 31 === 0) G.press(codes[(i / 31 | 0) % codes.length]);
      G.upd(1);
    }
    G.release('KeyA', 'KeyD', 'Space', 'ShiftLeft');
    const st27 = S();
    const finite27 = Object.values(st27).filter(v => typeof v === 'number').every(Number.isFinite);
    assert(27, finite27 && G.err.length === errBefore, `1200 帧快进 finite=${finite27} err+${G.err.length - errBefore}`);

    // T28 render path advances without errors
    const errBefore28 = G.err.length;
    G.step(8);
    assert(28, G.err.length === errBefore28, 'step 渲染 8 帧零新增错误');

    // T29 muted by default in autotest
    assert(29, audio.muted === true, '自测默认静音');

    // T30 static bridge aliases
    assert(30, typeof window.goHome === 'function' && typeof window.clickMore === 'function' && typeof window.dp_share === 'function' && typeof window.play68_init === 'function', 'play68 桥接别名存在');

    // T31 title screen has best + series imprint + one-line how-to
    toTitle();
    const titleTxt = document.getElementById('title').textContent || '';
    const bestTxt = document.getElementById('titlebest').textContent || '';
    assert(31, /灯匠夜游/.test(titleTxt) && /2/.test(titleTxt) && /最高|尚无/.test(bestTxt), `标题 best="${bestTxt}"`);

    // T32 back to title and no active run
    assert(32, S().mode === 'title' && !document.getElementById('title').classList.contains('hide'), `mode=${S().mode}`);

    // T33 spike trap warning beat precedes its active teeth
    startGame();
    const trap = level.hazards.find(h => h.kind === 'trap');
    let sawWarn = false, sawActive = false;
    for (let i = 0; i < 330 && !(sawWarn && sawActive); i++) {
      G.upd(1);
      if (trap && trap.warn) sawWarn = true;
      if (trap && trap.active) sawActive = true;
    }
    assert(33, !!trap && sawWarn && sawActive, `预警=${sawWarn} 伸出=${sawActive}`);
    toTitle();

    // restore the player's own best record after all destructive tests
    try {
      if (savedStored == null) localStorage.removeItem('ssn.best');
      else localStorage.setItem('ssn.best', savedStored);
    } catch (e) { }
    G.setBest(savedBest);
    audio.setMuted(true, false);
    ui.setMuted(true);
    G.setReportTarget(null);
  } catch (err) {
    window.__TEST_ERR = String(err && err.stack || err);
    console.error('[autotest] crashed:', window.__TEST_ERR);
    const pass = results.filter(r => r.ok).length;
    window.__TEST = { pass, fail: results.length - pass + 1, total: results.length + 1, passed: pass, failed: results.length - pass + 1, results, done: true, crashed: true };
    return;
  }

  const pass = results.filter(r => r.ok).length;
  const fail = results.length - pass;
  window.__TEST = {
    pass, fail, total: results.length,
    passed: pass, failed: fail,
    results, done: true,
  };
  console.log(`[autotest] ${pass}/${results.length} passed`);
}

if (AUTOTEST) autotest();
