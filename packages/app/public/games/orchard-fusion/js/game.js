// Orchard Fusion 果园大合成 — Suika-like merge puzzle.
// guizang-game-skill methodology, third series #1. Structure mirrors
// starfall-bulwark: fixed-step loop, G debug hooks, ?autotest=1 suite,
// site report bridge, WebAudio synth audio.

import { FRUITS, SCORES, pickSpawnTier, makeSprites, drawSprite } from './fruits.js';
const MAX_TIER = FRUITS.length - 1;   // watermelon; top tier never merges further
import { makePhysics } from './physics.js';
import { makeAudio } from './audio.js';
import { makeUI } from './ui.js';

// ==================== constants / layout ====================
const W = 540, H = 840;               // logical canvas size
const JAR = { left: 40, right: 500, floor: 800, top: 110 };
const DANGER_Y = 205;                 // settled fruit above this line for 2s = lose
const SPAWN_Y = 148;                  // aim fruit hover height
const COOLDOWN = 0.45;                // s between drops
const DANGER_TIME = 2.0;              // s above line to lose
const COMBO_CAP = 5;                  // chain multiplier cap

// ==================== state ====================
let mode = 'title';                   // title | play | over
let paused = false, noAuto = false;
let score = 0, best = 0, maxTier = -1, totalMerges = 0;
try { best = parseInt(localStorage.getItem('orf.best') || '0') || 0; } catch (e) { }
let muted = false;
try { muted = localStorage.getItem('orf.mute') === '1'; } catch (e) { }

const bodies = [];
const parts = [];                     // particles
const floats = [];                    // score floaters
let comboChain = 0;                   // merges within current drop chain
let cooldown = 0, curTier = -1, nextTier = -1, swapped = false;
let dangerT = 0, warnAcc = 0, hitstop = 0, shakeT = 0, shakeAmp = 0, flashT = 0;
let aimX = W / 2, holding = false;
let lastProgressT = 0, playT = 0;

const rng = () => Math.random();
const phys = makePhysics({ left: JAR.left, right: JAR.right, floor: JAR.floor });
const audio = makeAudio();
const AUTOTEST = new URLSearchParams(location.search).has('autotest');

// ==================== canvas ====================
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
makeSprites(Math.min(2, Math.max(1.5, DPR)));

// static jar layer (pre-rendered once)
const bgCv = document.createElement('canvas');
bgCv.width = W * 2; bgCv.height = H * 2;
{
  const c = bgCv.getContext('2d'); c.scale(2, 2);
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#3a2a16'); g.addColorStop(.5, '#2b1d12'); g.addColorStop(1, '#1c1208');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  for (let i = 0; i < 40; i++) {
    c.fillStyle = `rgba(255,200,120,${.03 + Math.random() * .04})`;
    c.beginPath(); c.arc(Math.random() * W, Math.random() * H, 1.5 + Math.random() * 2.5, 0, 7); c.fill();
  }
  const ig = c.createLinearGradient(0, JAR.top, 0, JAR.floor);
  ig.addColorStop(0, 'rgba(255,232,190,.10)'); ig.addColorStop(1, 'rgba(255,214,150,.04)');
  c.fillStyle = ig; c.fillRect(JAR.left, JAR.top, JAR.right - JAR.left, JAR.floor - JAR.top);
  c.fillStyle = '#6e4a24'; c.fillRect(JAR.left - 26, JAR.top - 6, 26, JAR.floor - JAR.top + 12);
  c.fillStyle = '#5c3d1c'; c.fillRect(JAR.right, JAR.top - 6, 26, JAR.floor - JAR.top + 12);
  c.fillStyle = '#7c5628'; c.fillRect(JAR.left - 26, JAR.floor, JAR.right - JAR.left + 52, 30);
  c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 2;
  for (const x of [JAR.left - 13, JAR.right + 13]) { c.beginPath(); c.moveTo(x, JAR.top - 6); c.lineTo(x, JAR.floor + 30); c.stroke(); }
  c.strokeStyle = 'rgba(255,220,160,.15)';
  c.beginPath(); c.moveTo(JAR.left, JAR.top - 6); c.lineTo(JAR.left, JAR.floor); c.stroke();
  c.beginPath(); c.moveTo(JAR.right, JAR.top - 6); c.lineTo(JAR.right, JAR.floor); c.stroke();
}

// ==================== UI ====================
const ui = makeUI({
  onStart: () => { audio.ensure(); audio.sfx.ui(); startGame(); },
  onRestart: () => { audio.sfx.ui(); startGame(); },
  onBackTitle: () => { audio.sfx.ui(); toTitle(); },
  onSwap: () => { audio.sfx.ui(); doSwap(); },
  onMute: () => toggleMute(),
  onPause: () => { audio.sfx.ui(); togglePause(); },
});
ui.setBest(best);
ui.showTitle(true);
ui.setMutedIcon(muted);
audio.setMuted(muted);

// ==================== protocol bridge ====================
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
report('ready', { game: 'orchard-fusion' });

// ==================== game flow ====================
function resetPlay() {
  bodies.length = 0; parts.length = 0; floats.length = 0;
  score = 0; maxTier = -1; totalMerges = 0; comboChain = 0;
  cooldown = 0; dangerT = 0; hitstop = 0; shakeT = 0; flashT = 0;
  curTier = pickSpawnTier(rng); nextTier = pickSpawnTier(rng);
  swapped = false; playT = 0; lastProgressT = 0;
  ui.setScore(0); ui.drawNext(nextTier, FRUITS[nextTier].r * .5, drawSprite);
}
function startGame() {
  resetPlay();
  mode = 'play'; paused = false;
  ui.showTitle(false); ui.showEnd(false); ui.setPausedIcon(false);
  ui.el.banner.classList.remove('show');
  if (!audio.hasCtx() && !AUTOTEST) audio.ensure();   // autotest: stay ctx-less & silent
}
function toTitle() {
  mode = 'title'; paused = false;
  ui.showTitle(true); ui.showEnd(false);
  ui.setBest(best);
}
function togglePause() {
  if (mode !== 'play') return;
  paused = !paused;
  ui.setPausedIcon(paused);
  if (paused) { audio.stop(); ui.showBanner('已暂停', '按 P 或点按继续', 999999); }
  else { ui.el.banner.classList.remove('show'); }
}
function toggleMute() {
  muted = !muted;
  audio.setMuted(muted);
  ui.setMutedIcon(muted);
  try { localStorage.setItem('orf.mute', muted ? '1' : '0'); } catch (e) { }
}
function doSwap() {
  if (mode !== 'play' || paused || swapped || cooldown > 0) return;
  const t = curTier; curTier = nextTier; nextTier = t;
  swapped = true;
  ui.drawNext(nextTier, FRUITS[nextTier].r * .5, drawSprite);
  audio.sfx.swap();
}

function spawnBody(tier, x, y, vx = 0, vy = 0) {
  const f = FRUITS[tier];
  const b = {
    tier, x: Math.max(JAR.left + f.r, Math.min(JAR.right - f.r, x)),
    y: Math.min(y, JAR.floor - f.r),      // merged fruit is bigger than parents: keep above floor
    vx, vy, r: f.r, rot: 0, hit: false, dead: false, born: 0,
  };
  bodies.push(b);
  return b;
}

function dropFruit(x, force = false) {
  if (mode !== 'play' || paused) return false;
  if (!force && cooldown > 0) return false;
  if (curTier < 0) return false;
  spawnBody(curTier, x, SPAWN_Y, 0, 60);
  audio.sfx.drop(curTier);
  cooldown = COOLDOWN;
  comboChain = 0;                      // new drop starts a new chain
  swapped = false;
  curTier = nextTier;
  nextTier = pickSpawnTier(rng);
  ui.drawNext(nextTier, FRUITS[nextTier].r * .5, drawSprite);
  return true;
}

function addScore(gain, x, y, comboN) {
  score += gain;
  ui.setScore(score);
  if (x || y) floats.push({ x, y, text: comboN > 1 ? `+${gain} ×${comboN}` : `+${gain}`, life: 1, color: comboN > 1 ? '#ffd77a' : '#fff2d8', size: comboN > 1 ? 24 + comboN * 2 : 20 });
  if (playT - lastProgressT > 3) {     // throttled milestone report
    lastProgressT = playT;
    report('progress', { score, progress: maxTier + 1 });
  }
}

function mergePair(a, b) {
  const nt = a.tier + 1;
  const nx = (a.x * a.r + b.x * b.r) / (a.r + b.r);
  const ny = (a.y * a.r + b.y * b.r) / (a.r + b.r);
  const f = FRUITS[nt];
  a.dead = b.dead = true;
  comboChain++;
  const mult = Math.min(comboChain, COMBO_CAP);
  const gain = SCORES[nt] * mult;
  const nb = spawnBody(nt, nx, ny, (a.vx + b.vx) * .3, (a.vy + b.vy) * .3 - 40);
  if (nt > maxTier) maxTier = nt;
  totalMerges++;
  addScore(gain, nx, ny - f.r - 6, mult);

  for (let i = 0; i < 10 + nt * 2; i++) {
    const a2 = Math.random() * Math.PI * 2, sp = 80 + Math.random() * (120 + nt * 30);
    parts.push({ x: nx, y: ny, vx: Math.cos(a2) * sp, vy: Math.sin(a2) * sp - 80, life: .5 + Math.random() * .3, max: .8, color: f.color, size: 3 + Math.random() * 5, grav: 900 });
  }
  audio.sfx.merge(nt, mult);
  if (nt >= 6) { shakeT = .22 + nt * .015; shakeAmp = 3 + nt * .5; }
  if (nt >= 7) hitstop = Math.max(hitstop, .07);
  if (mult >= 3 && comboChain <= COMBO_CAP) { audio.sfx.comboUp(mult); ui.showBanner(`连击 ×${mult}！`, '连续合成加成', 900); }
  if (nt >= 9) audio.sfx.bigMerge();

  // watermelon celebration: fireworks + clear small fruits with bonus
  if (nt === 10) {
    audio.sfx.firework(); flashT = .35; shakeT = .5; shakeAmp = 8;
    ui.showBanner('西瓜诞生！', '全场庆典 · 小水果转化为分数', 2200);
    for (let i = 0; i < 70; i++) {
      const a2 = Math.random() * Math.PI * 2, sp = 120 + Math.random() * 380;
      const cols = ['#ffd77a', '#ff8a5c', '#9a5cd0', '#6fe8d8', '#f25767'];
      parts.push({ x: nx, y: ny, vx: Math.cos(a2) * sp, vy: Math.sin(a2) * sp, life: .9 + Math.random() * .6, max: 1.5, color: cols[i % cols.length], size: 3 + Math.random() * 4, grav: 500 });
    }
    let bonus = 0;
    for (const b of bodies) if (!b.dead && b.tier <= 1) { b.dead = true; bonus += SCORES[b.tier] * 2; }
    if (bonus > 0) { score += bonus; ui.setScore(score); floats.push({ x: nx, y: ny + 40, text: `庆典 +${bonus}`, life: 1.2, color: '#ffe9a8', size: 26 }); }
    report('event', { tag: 'watermelon', score });
  }
  return nb;
}

function processMerges() {
  let guard = 0;
  while (guard++ < 24) {
    const pair = phys.findMerge(bodies, MAX_TIER);
    if (!pair) break;
    mergePair(pair[0], pair[1]);
    for (let i = bodies.length - 1; i >= 0; i--) if (bodies[i].dead) bodies.splice(i, 1);
  }
}

function checkDanger(dt) {
  if (noAuto || mode !== 'play') return;
  let above = false;
  for (const b of bodies) {
    const settled = Math.abs(b.vx) + Math.abs(b.vy) < 40;
    if (settled && b.y - b.r * .6 < DANGER_Y) { above = true; break; }
  }
  if (above) {
    dangerT += dt;
    warnAcc += dt;
    if (warnAcc > .5) { warnAcc = 0; audio.sfx.warn(); }
    if (dangerT >= DANGER_TIME) gameOver();
  } else {
    dangerT = Math.max(0, dangerT - dt * 1.6);
    warnAcc = 0;
  }
}

function gameOver() {
  if (mode !== 'play') return;
  mode = 'over';
  audio.sfx.lose();
  audio.stop();
  const isNew = score > best;
  if (isNew) { best = score; try { localStorage.setItem('orf.best', String(best)); } catch (e) { } }
  ui.setBest(best);
  const fname = maxTier >= 0 ? `${FRUITS[maxTier].name}${maxTier === 10 ? '🍉' : ''}` : '—';
  ui.setEnd(isNew ? '新纪录！' : '果园丰收',
    `得分 ${score}${isNew ? '  ⭐ 新纪录' : `\n纪录 ${best}`}\n最大水果 ${fname}\n合成 ${totalMerges} 次`);
  ui.showEnd(true);
  report('gameOver', { score, progress: maxTier + 1 });
}

// ==================== update / frame ====================
function update(dt) {
  playT += dt;
  if (cooldown > 0) cooldown = Math.max(0, cooldown - dt);
  if (hitstop > 0) { hitstop -= dt; return; }        // brief freeze on big merges

  phys.step(bodies, dt);
  processMerges();
  checkDanger(dt);

  for (const b of bodies) { b.rot += (b.vx / Math.max(40, b.r)) * dt; b.born += dt; }

  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.life -= dt; if (p.life <= 0) { parts.splice(i, 1); continue; }
    p.vy += (p.grav || 0) * dt; p.x += p.vx * dt; p.y += p.vy * dt;
  }
  for (let i = floats.length - 1; i >= 0; i--) {
    const fl = floats[i];
    fl.life -= dt * 1.1; fl.y -= 34 * dt;
    if (fl.life <= 0) floats.splice(i, 1);
  }
  if (shakeT > 0) shakeT -= dt;
  if (flashT > 0) flashT -= dt;

  let nearTop = false;
  for (const b of bodies) if (b.y - b.r < DANGER_Y + 90) { nearTop = true; break; }
  audio.state(nearTop ? 'danger' : 'calm');
  audio.update();
}

// ==================== render ====================
function render() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.clearRect(0, 0, cv.width, cv.height);
  ctx.save();
  ctx.translate(viewOX, viewOY); ctx.scale(viewScale, viewScale);
  const shx = shakeT > 0 ? (Math.random() * 2 - 1) * shakeAmp * shakeT * 5 : 0;
  const shy = shakeT > 0 ? (Math.random() * 2 - 1) * shakeAmp * shakeT * 5 : 0;
  ctx.translate(shx, shy);

  ctx.drawImage(bgCv, 0, 0, W, H);

  const pulse = dangerT > 0 ? .5 + .5 * Math.sin(playT * 14) : 0;
  ctx.strokeStyle = `rgba(255,70,60,${.45 + pulse * .5})`;
  ctx.lineWidth = 2.5; ctx.setLineDash([10, 8]);
  ctx.beginPath(); ctx.moveTo(JAR.left, DANGER_Y); ctx.lineTo(JAR.right, DANGER_Y); ctx.stroke();
  ctx.setLineDash([]);
  if (dangerT > 0) {
    ctx.fillStyle = `rgba(255,60,50,${.05 + pulse * .1})`;
    ctx.fillRect(JAR.left, JAR.top, JAR.right - JAR.left, DANGER_Y - JAR.top);
  }

  for (const b of bodies) drawSprite(ctx, b.tier, b.x, b.y, b.r, b.rot);

  if (mode === 'play' && !paused && cooldown <= 0 && curTier >= 0) {
    const r = FRUITS[curTier].r;
    const bob = Math.sin(playT * 3) * 3;
    ctx.strokeStyle = 'rgba(255,220,160,.25)'; ctx.lineWidth = 2; ctx.setLineDash([4, 9]);
    ctx.beginPath(); ctx.moveTo(aimX, SPAWN_Y + r + 6); ctx.lineTo(aimX, JAR.floor - 4); ctx.stroke();
    ctx.setLineDash([]);
    drawSprite(ctx, curTier, aimX, SPAWN_Y + bob, r, 0, .96);
  }

  for (const p of parts) {
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;

  ctx.textAlign = 'center';
  for (const fl of floats) {
    ctx.globalAlpha = Math.min(1, fl.life * 1.6);
    ctx.font = `700 ${fl.size}px "Microsoft YaHei",sans-serif`;
    ctx.fillStyle = fl.color;
    ctx.strokeStyle = 'rgba(60,30,5,.7)'; ctx.lineWidth = 3;
    ctx.strokeText(fl.text, fl.x, fl.y); ctx.fillText(fl.text, fl.x, fl.y);
  }
  ctx.globalAlpha = 1;

  if (flashT > 0) {
    ctx.fillStyle = `rgba(255,240,200,${flashT * .9})`;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.restore();
}

// ==================== main loop ====================
let last = performance.now(), acc = 0;
function tick(now) {
  requestAnimationFrame(tick);
  let dt = (now - last) / 1000; last = now;
  if (document.hidden) return;
  dt = Math.min(dt, 1 / 30);
  if (mode === 'play' && !paused) {
    acc += dt;
    while (acc >= 1 / 60) { update(1 / 60); acc -= 1 / 60; }
  }
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
    else if (code === 'KeyX') doSwap();
    else if (code === 'Enter') {
      if (mode === 'title' || mode === 'over') startGame();
    }
  }
  pressed.clear();
}

cv.addEventListener('pointerdown', (e) => {
  if (mode !== 'play') return;
  audio.ensure();
  holding = true;
  aimX = toLogicalX(e.clientX);
  if (cv.setPointerCapture) { try { cv.setPointerCapture(e.pointerId); } catch (err) { } }
});
cv.addEventListener('pointermove', (e) => {
  if (mode !== 'play') return;
  if (!holding && e.pointerType !== 'mouse') return;
  aimX = toLogicalX(e.clientX);
});
cv.addEventListener('pointerup', (e) => {
  if (mode !== 'play') return;
  const x = toLogicalX(e.clientX);
  aimX = x; holding = false;
  dropFruit(x);
});
function toLogicalX(cx) {
  return Math.max(JAR.left + 10, Math.min(JAR.right - 10, (cx - viewOX) / viewScale));
}

// ==================== G debug hooks ====================
const G = {
  err: window.__BOOTERR,
  W: 540, H: 840, JAR, DANGER_Y,
  step: (n = 60, dt = 1 / 60) => { for (let i = 0; i < n; i++) { handleKeys(); if (mode === 'play' && !paused) update(dt); render(); } },
  upd: (n = 30, dt = 1 / 60) => { for (let i = 0; i < n; i++) { handleKeys(); if (mode === 'play' && !paused) update(dt); } },
  press: (...codes) => codes.forEach(c => pressed.add(c)),
  dropAt: (x, force = false) => dropFruit(x, force),
  spawnTier: (t, x, y) => spawnBody(t, x, y),
  setNoAuto: (v) => { noAuto = !!v; },
  setReportTarget: (fn) => { reportTarget = fn; },
  setScore: (v) => { score = v | 0; ui.setScore(score); lastProgressT = -99; },
  setNextTier: (t) => { if (t >= 0 && t < FRUITS.length) { nextTier = t; ui.drawNext(nextTier, FRUITS[nextTier].r * .5, drawSprite); } },
  state: () => ({ mode, paused, score, best, maxTier, totalMerges, comboChain, dangerT, cooldown: +cooldown.toFixed(3), curTier, nextTier, swapped, fruits: bodies.length }),
  fx: () => ({ parts: parts.length, floats: floats.length }),
  audio,
  bodies,
  forceGameOver: () => gameOver(),
  startGame,
};
window.__G = G;
window.addEventListener('error', e => { if (G.err) G.err.push(String(e.message || e)); });

// ==================== autotest suite ====================
const nap = () => new Promise(r => { const mc = new MessageChannel(); mc.port1.onmessage = () => r(); mc.port2.postMessage(0); });

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
  const savedBest = best;
  const frames = [];
  G.setReportTarget(f => frames.push(f));

  assert(1, G.err.length === 0, '启动零报错');

  // -- T2-T4: drop physics basics
  startGame();
  G.setNoAuto(true);
  const before = S().fruits;
  const dropped = G.dropAt(W / 2, true);
  assert(2, dropped && S().fruits === before + 1, 'dropFruit 增加一个水果');
  const y0 = bodies[bodies.length - 1].y;
  G.upd(30);
  const b0 = bodies[0];
  assert(3, b0 && b0.y > y0 && !isNaN(b0.y), '水果下落且无 NaN');
  G.upd(120);
  assert(4, b0.y + b0.r <= JAR.floor + .5 && b0.x - b0.r >= JAR.left - .5 && b0.x + b0.r <= JAR.right + .5, '水果停在罐内边界内');

  // -- T5/T6: same-tier merge + score
  startGame();
  const s0 = S().score;
  G.spawnTier(2, 200, 500); G.spawnTier(2, 232, 500);
  G.upd(30);
  assert(5, !!bodies.find(b => b.tier === 3), '同 tier 碰撞合成出下一级');
  assert(6, S().score >= s0 + SCORES[3], '合成得等级分');

  // -- T7/T8: simultaneous double merge → combo ×1/×2
  startGame();
  G.spawnTier(3, 160, 400); G.spawnTier(3, 192, 400);   // pair 1
  G.spawnTier(3, 120, 700); G.spawnTier(3, 152, 700);   // pair 2 (both in-bounds)
  const sB = S().score;
  G.upd(2);                                              // both pairs merge in one pass
  const gainT = S().score - sB;
  assert(7, gainT === SCORES[4] * 1 + SCORES[4] * 2, '同帧双连锁按 ×1/×2 计分');
  assert(8, S().comboChain >= 2, '连锁 combo 计数 ≥2');

  // -- T9: cooldown rejects rapid drop
  startGame();
  const n0 = S().fruits;
  G.dropAt(300, true);
  const rejected = G.dropAt(300);
  assert(9, rejected === false && S().fruits === n0 + 1, '冷却期内拒绝再次掉落');

  // -- T10: restart resets state
  G.forceGameOver();
  startGame();
  const st = S();
  assert(10, st.score === 0 && st.fruits === 0 && st.mode === 'play' && st.totalMerges === 0, '重开一局状态复位');

  // -- T11/T12: swap once per drop cycle
  startGame();
  const c0 = S().curTier, n1 = S().nextTier;
  G.press('KeyX'); G.upd(1);
  assert(11, S().curTier === n1 || c0 === n1, '交换当前与下一个');
  const c2 = S().curTier;
  G.press('KeyX'); G.upd(1);
  assert(12, S().curTier === c2, '同一投放周期内第二次交换被拒绝');

  // -- T13/T14/T15: watermelon celebration
  startGame();
  G.spawnTier(0, 90, 760); G.spawnTier(1, 150, 700);
  const scoreWM = S().score;
  G.spawnTier(9, 300, 300); G.spawnTier(9, 345, 300);
  G.upd(30);
  assert(13, !!bodies.find(b => b.tier === 10), '两个甜瓜合成出西瓜');
  assert(14, bodies.filter(b => b.tier <= 1).length === 0, '西瓜庆典清除全部小水果');
  assert(15, S().score > scoreWM + SCORES[10], '西瓜庆典加分超过基础分');

  // -- T16-T18: physics stability under load
  startGame();
  for (let i = 0; i < 60; i++) G.spawnTier(i % 6, JAR.left + 30 + Math.random() * (JAR.right - JAR.left - 60), 200 + Math.random() * 300);
  let nan = false, outside = false, exploded = false;
  for (let i = 0; i < 600; i++) {
    G.upd(1);
    for (const b of bodies) {
      if (isNaN(b.x) || isNaN(b.y) || isNaN(b.vx) || isNaN(b.vy)) nan = true;
      if (b.x - b.r < JAR.left - 2 || b.x + b.r > JAR.right + 2 || b.y + b.r > JAR.floor + 2) outside = true;
      if (Math.abs(b.vx) > 3300 || Math.abs(b.vy) > 3300) exploded = true;
    }
  }
  assert(16, !nan, '60 果 600 帧无 NaN');
  assert(17, !outside, '60 果 600 帧无出界');
  assert(18, !exploded, '速度钳制无爆炸');

  // -- T19/T20: pause freezes physics
  startGame();
  G.spawnTier(3, W / 2, 300); G.upd(60);
  const py = bodies[0].y;
  G.press('KeyP'); G.upd(10);
  assert(19, Math.abs(bodies[0].y - py) < .001 && S().paused, '暂停冻结物理');
  G.press('KeyP'); G.upd(5);
  const resumed = !S().paused;
  G.dropAt(200, true); G.upd(15);
  const moved = bodies[bodies.length - 1].y > SPAWN_Y;
  assert(20, resumed && moved, '恢复运行且新水果继续下落');

  // -- T21/T22: danger line lose path with real accumulation
  startGame();
  G.setNoAuto(false);
  for (let i = 0; i < 120; i++) {
    G.spawnTier(i % 7, 110 + Math.random() * 320, 190 + Math.random() * 380);
    if (i % 12 === 11) G.upd(20);
  }
  G.upd(90);
  let maxDanger = 0;
  for (let i = 0; i < 400 && S().mode === 'play'; i++) { G.upd(1); if (S().dangerT > maxDanger) maxDanger = S().dangerT; }
  assert(21, S().mode === 'over', '堆过警戒线 2 秒判负');
  assert(22, frames.some(f => f.kind === 'gameOver'), 'gameOver 上报帧');

  // -- T23: grace — moving fruit above line does not lose
  startGame();
  const flyer = G.spawnTier(4, W / 2, 160);
  flyer.vy = -620;
  G.upd(50);
  assert(23, S().mode === 'play' && S().dangerT < .2, '运动水果越线有宽限不判负');
  G.setNoAuto(true);

  // -- T24: best persistence (isolate from earlier runs' pollution)
  startGame();
  best = 0; try { localStorage.setItem('orf.best', '0'); } catch (e) { }
  G.setScore(1234);
  G.forceGameOver();
  const bestNow = parseInt(localStorage.getItem('orf.best') || '0') || 0;
  assert(24, bestNow === 1234 && S().best === 1234, '纪录写入 localStorage');
  try { localStorage.setItem('orf.best', String(savedBest)); } catch (e) { }
  best = savedBest;

  // -- T25-T27: protocol frame sequence (module-level `reports` captures all frames)
  assert(25, reports[0] && reports[0].kind === 'ready', 'ready 上报帧为首帧');
  assert(26, frames.some(f => f.kind === 'progress') || frames.some(f => f.kind === 'event'), 'progress/event 上报帧存在');
  assert(27, frames[frames.length - 1] && frames[frames.length - 1].kind === 'gameOver', 'gameOver 为当前末帧');

  // -- T28: UI DOM bindings
  assert(28, !!ui.el.mutebtn && !!ui.el.pausebtn && !!ui.el.nextbox && !!ui.el.start, '静音/暂停/交换/开始 UI 元素存在');

  // -- T29-T31: audio synth
  audio.ensure();
  assert(29, audio.hasCtx(), 'AudioContext 可创建');
  audio.state('danger');
  assert(30, audio.state() === 'danger', '配乐状态切换 danger');
  audio.state('calm');
  assert(31, audio.isMuted() === true, '自测期间保持静音');

  // -- T32/T33: full session fast-forward
  const errBefore = G.err.length;
  startGame();
  for (let i = 0; i < 240; i++) { G.dropAt(JAR.left + 20 + Math.random() * (JAR.right - JAR.left - 40), true); G.upd(3); }
  for (let i = 0; i < 200; i++) G.upd(2);
  let nan2 = false;
  for (const b of bodies) if (isNaN(b.x) || isNaN(b.y)) nan2 = true;
  assert(32, !nan2 && G.err.length === errBefore, '整局快进 240 投无 NaN 无新报错');
  if (S().mode === 'play') for (let i = 0; i < 30; i++) { G.spawnTier(7 + (i % 3), 110 + Math.random() * 320, 150 + Math.random() * 300); G.upd(5); }
  G.setNoAuto(false);
  for (let i = 0; i < 900 && S().mode === 'play'; i++) G.upd(1);
  assert(33, S().mode === 'over', '堆满后自然判负到结算');

  // -- T34: back to title screen
  toTitle();
  assert(34, !ui.el.title.classList.contains('hide') && S().mode === 'title', '测完回到标题画面');

  // restore the player's real best record (test sessions may have overwritten it)
  try { localStorage.setItem('orf.best', String(savedBest)); } catch (e) { }
  best = savedBest; ui.setBest(best);

  const pass = results.filter(r => r.ok).length;
  window.__TEST = { pass, fail: results.length - pass, total: results.length, results, done: true };
  console.log(`[autotest] ${pass}/${results.length} passed`);
  }
}

if (new URLSearchParams(location.search).get('autotest')) autotest();
