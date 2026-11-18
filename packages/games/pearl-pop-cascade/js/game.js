// Pearl Pop Cascade 珠光瀑语 — Peggle-like 3D pachinko.
// guizang-game-skill methodology, third series #9. 2D circle physics in board
// logical coords rendered in 3D. Fixed-step loop, G hooks, ?autotest=1,
// site report bridge, WebAudio synth audio.

import { makeWorld, BW, BH } from './world.js';
import { makeAudio } from './audio.js';
import { makeUI } from './ui.js';
import * as THREE from '../vendor/three.module.min.js';

// ==================== physics constants ====================
const GRAV = -26, REST = .8, WALL_REST = .75, BALL_R = .55, PEG_R = .56;
const MAXV = 42, SUBSTEPS = 3;
const START_BALLS = 8, FEVER_AT = 12, FEVER_BALLS = 3;
const BUCKET_W = 3.4;

// ==================== state ====================
let mode = 'title', paused = false, noAuto = false;
let score = 0, bestScore = 0, bestRound = 0, round = 1;
let balls = START_BALLS, freeBalls = 0, mult = 1, shotHits = 0, purpleHit = false;
let feverArmed = false, feverActive = false, clearBonus = 0;
let aimAngle = 0, fastBall = false;        // click during flight = fast-forward
let ball = null;                           // {x,y,vx,vy}
let playT = 0, time = 0, lastReportT = 0;
const pegs = [], buckets = [], trailDots = [];
try {
  bestScore = parseInt(localStorage.getItem('ppc.bestScore') || '0') || 0;
  bestRound = parseInt(localStorage.getItem('ppc.bestRound') || '0') || 0;
} catch (e) { }
let muted = false;
try { muted = localStorage.getItem('ppc.mute') === '1'; } catch (e) { }
const AUTOTEST = new URLSearchParams(location.search).has('autotest');

const world = makeWorld();
const audio = makeAudio();
const ui = makeUI({
  onStart: () => { audio.ensure(); audio.sfx.ui(); startGame(); },
  onRestart: () => { audio.sfx.ui(); startGame(); },
  onBackTitle: () => { audio.sfx.ui(); toTitle(); },
  onMute: () => toggleMute(),
  onPause: () => { audio.sfx.ui(); togglePause(); },
});
ui.setBest(bestScore, bestRound);
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
report('ready', { game: 'pearl-pop-cascade' });

// ==================== 3D meshes ====================
const pegGeo = new THREE.SphereGeometry(PEG_R, 12, 10);
const ballMesh = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 14, 12),
  new THREE.MeshStandardMaterial({ color: 0xe8f4ff, emissive: 0x6a8ad8, emissiveIntensity: .5, metalness: .6, roughness: .2 }));
ballMesh.visible = false;
world.scene.add(ballMesh);
const trailGeo = new THREE.SphereGeometry(.16, 6, 5);
const trailMat = new THREE.MeshBasicMaterial({ color: 0x9fc8ff, transparent: true, opacity: .5 });
const trailMeshes = [];
for (let i = 0; i < 8; i++) { const m = new THREE.Mesh(trailGeo, trailMat); m.visible = false; world.scene.add(trailMeshes[i] = m); }
const launcher = new THREE.Group();
{
  const base = new THREE.Mesh(new THREE.ConeGeometry(1.1, 2.2, 10), world.matStd(0x7a5cd8, { emissive: 0x5a3cc8, ei: .7 }));
  base.rotation.z = 0;
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(.5, .7, 2.4, 10), world.matStd(0x9a7af0, { emissive: 0x7a5cd8, ei: .8 }));
  barrel.position.y = .8;
  launcher.add(base, barrel);
  launcher.position.set(0, BH + 1.6, 0);
  world.scene.add(launcher);
}

// ==================== pegs ====================
function makePegMesh(kind) {
  const color = kind === 'purple' ? 0xb060ff : kind === 'green' ? 0x50d8a0 : 0x6fa8ff;
  return new THREE.Mesh(pegGeo, world.matStd(color, { emissive: color, ei: kind === 'blue' ? .55 : 1.1, rough: .3 }));
}
function layoutPegs(seedRng, count) {
  for (const p of pegs) world.scene.remove(p.mesh);
  pegs.length = 0;
  const rows = Math.ceil(count / 12);
  let placed = 0;
  for (let r = 0; r < rows && placed < count; r++) {
    const y = 5.5 + (r / Math.max(1, rows - 1)) * 19;
    const n = Math.min(14, count - placed);
    for (let i = 0; i < n; i++) {
      const x = -BW / 2 + 2.4 + (BW - 4.8) * ((i + .5) / n) + (seedRng() - .5) * .9;
      const yy = y + (seedRng() - .5) * 1.4;
      if (yy > BH - 2.5 && Math.abs(x) < 3.4) continue;      // keep launcher column clear
      const kind = seedRng() < .03 ? 'purple' : seedRng() < .015 ? 'green' : 'blue';
      const mesh = makePegMesh(kind);
      mesh.position.set(x, yy, 0);
      world.scene.add(mesh);
      pegs.push({ x, y: yy, kind, mesh, alive: true, pulse: 0 });
      placed++;
    }
  }
  // guarantee specials exist
  if (!pegs.some(p => p.kind === 'purple')) {
    const p = pegs[Math.floor(seedRng() * pegs.length)];
    p.kind = 'purple'; p.mesh.material = world.matStd(0xb060ff, { emissive: 0xb060ff, ei: 1.1, rough: .3 });
  }
  if (!pegs.some(p => p.kind === 'green')) {
    const p = pegs[Math.floor(seedRng() * pegs.length)];
    p.kind = 'green'; p.mesh.material = world.matStd(0x50d8a0, { emissive: 0x50d8a0, ei: 1.1, rough: .3 });
  }
}

// ==================== buckets ====================
function makeBucket(x, dir) {
  const g = new THREE.Group();
  const cup = new THREE.Mesh(new THREE.BoxGeometry(BUCKET_W, 1.6, 1.8), world.matStd(0xffd166, { emissive: 0xd9a018, ei: .8, metalness: .5, roughness: .3 }));
  cup.position.y = .8;
  g.add(cup);
  g.position.set(x, 1.1, 0);
  world.scene.add(g);
  return { g, x, dir, speed: 6 };
}
function layoutBuckets(round) {
  for (const b of buckets) world.scene.remove(b.g);
  buckets.length = 0;
  const speed = 6 + round * .8;
  buckets.push(makeBucket(-BW / 4, 1, speed), makeBucket(BW / 4, -1, speed));
  buckets[0].speed = buckets[1].speed = speed;
}

// ==================== game flow ====================
function resetPlay() {
  score = 0; round = 1; balls = START_BALLS; freeBalls = 0;
  mult = 1; shotHits = 0; purpleHit = false;
  feverArmed = false; feverActive = false; clearBonus = 0;
  killBall(); playT = 0; lastReportT = 0;
  layoutPegs(Math.random, 75);
  layoutBuckets(1);
  ui.setScore(0); ui.setRound(1); ui.setMult(1); ui.setBalls(balls + freeBalls); ui.setPegs(pegs.filter(p => p.alive).length);
}
function startGame() {
  resetPlay();
  mode = 'play'; paused = false;
  ui.showTitle(false); ui.showEnd(false); ui.setPausedIcon(false);
  ui.el.banner.classList.remove('show');
  if (!audio.hasCtx() && !AUTOTEST) audio.ensure();
}
function toTitle() {
  mode = 'title'; paused = false;
  ui.showTitle(true); ui.showEnd(false);
  ui.setBest(bestScore, bestRound);
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
  try { localStorage.setItem('ppc.mute', muted ? '1' : '0'); } catch (e) { }
}

function killBall() { ball = null; ballMesh.visible = false; trailDots.length = 0; }

function alivePegs() { return pegs.filter(p => p.alive); }

function launch() {
  if (mode !== 'play' || paused) return false;
  if (ball) return false;
  if (balls <= 0 && freeBalls <= 0) return false;
  if (freeBalls > 0) freeBalls--; else balls--;
  const a = aimAngle;
  ball = { x: 0, y: BH - 1.4, vx: Math.sin(a) * 30, vy: -Math.cos(a) * 30 };
  shotHits = 0; purpleHit = false; mult = 1;
  ui.setMult(1);
  audio.sfx.launch();
  return true;
}

function addScore(n) {
  score += n;
  ui.setScore(score);
  if (playT - lastReportT > 3) { lastReportT = playT; report('progress', { score, progress: 1 - alivePegs().length / Math.max(1, pegs.length) }); }
}

function hitPeg(p) {
  p.alive = false;
  p.pulse = 1;
  shotHits++;
  mult = Math.min(10, 1 + (shotHits - 1) * .5);   // ×1, ×1.5, ×2 … first hit base
  let gain = Math.round(100 * mult);
  if (p.kind === 'purple') { purpleHit = true; gain *= 5; audio.sfx.purple(); ui.showToast('紫珍珠 ×5！'); }
  if (p.kind === 'green') { freeBalls++; audio.sfx.bucket(); ui.showToast('绿珍珠 +1 免费钢珠'); }
  if (purpleHit && p.kind !== 'purple') gain *= 5;
  addScore(gain);
  ui.setMult(purpleHit ? mult * 5 : mult);
  audio.sfx.pegLadder(Math.min(shotHits, 8));
  world.shake(.25, .15);
  // sink animation data
  p.sinkT = 0;
}

function pegCountLeft() { return alivePegs().length; }

function checkFeverAndClear() {
  const left = pegCountLeft();
  if (!feverArmed && left <= FEVER_AT) {
    feverArmed = true;
    feverActive = true;
    freeBalls += FEVER_BALLS;
    audio.sfx.fever();
    ui.showBanner('FEVER！', `剩 ${left} 颗珍珠 · ${FEVER_BALLS} 连免费钢珠`, 2000);
    ui.setBalls(balls + freeBalls);
  }
  if (left === 0) {
    clearBonus = 5000;
    addScore(clearBonus);
    audio.sfx.clear();
    ui.showBanner('清台！', `+${clearBonus} · 进入第 ${round + 1} 轮`, 2400);
    round++;
    if (round > bestRound) { bestRound = round - 1; saveBest(); }
    feverArmed = false; feverActive = false;
    layoutPegs(Math.random, Math.min(110, 75 + (round - 1) * 5));
    layoutBuckets(round);
    ui.setRound(round); ui.setPegs(pegCountLeft()); ui.setBalls(balls + freeBalls);
  }
}

function saveBest() {
  try { localStorage.setItem('ppc.bestScore', String(bestScore)); localStorage.setItem('ppc.bestRound', String(bestRound)); } catch (e) { }
}

function gameOver() {
  if (mode !== 'play') return;
  mode = 'over';
  audio.sfx.lose();
  audio.stop();
  const isNew = score > bestScore;
  if (isNew) bestScore = score;
  if (round > bestRound) bestRound = round;
  saveBest();
  ui.setBest(bestScore, bestRound);
  ui.setEnd(isNew ? '新纪录！' : '珠瀑落幕',
    `得分 ${score}${isNew ? '  ⭐ 新纪录' : `\n纪录 ${bestScore}`}\n到达第 ${round} 轮 · 清台奖励累计 ${clearBonus}`);
  ui.showEnd(true);
  report('gameOver', { score, progress: round - 1 });
}

// ==================== physics ====================
function stepBall(dt) {
  if (!ball) return;
  ball.restT = 0;
  for (let s = 0; s < SUBSTEPS; s++) {
    const h = dt / SUBSTEPS;
    ball.vy += GRAV * h;
    const sp = Math.hypot(ball.vx, ball.vy);
    if (sp > MAXV) { const k = MAXV / sp; ball.vx *= k; ball.vy *= k; }
    ball.x += ball.vx * h;
    ball.y += ball.vy * h;
    // walls
    if (ball.x - BALL_R < -BW / 2) { ball.x = -BW / 2 + BALL_R; ball.vx = Math.abs(ball.vx) * WALL_REST; addScore(10); }
    if (ball.x + BALL_R > BW / 2) { ball.x = BW / 2 - BALL_R; ball.vx = -Math.abs(ball.vx) * WALL_REST; addScore(10); }
    if (ball.y + BALL_R > BH + 2) { ball.y = BH + 2 - BALL_R; ball.vy = -Math.abs(ball.vy) * WALL_REST; }
    // pegs
    for (const p of pegs) {
      if (!p.alive) continue;
      const dx = ball.x - p.x, dy = ball.y - p.y;
      const rr = BALL_R + PEG_R;
      const d2 = dx * dx + dy * dy;
      if (d2 < rr * rr && d2 > 0) {
        const d = Math.sqrt(d2), nx = dx / d, ny = dy / d;
        ball.x = p.x + nx * rr; ball.y = p.y + ny * rr;
        const vn = ball.vx * nx + ball.vy * ny;
        if (vn < 0) {
          ball.vx -= (1 + REST) * vn * nx;
          ball.vy -= (1 + REST) * vn * ny;
          hitPeg(p);
        }
      }
    }
    // bucket catch
    for (const b of buckets) {
      if (Math.abs(ball.x - b.x) < BUCKET_W / 2 && ball.y < 1.9) {
        freeBalls++;
        addScore(1000);
        audio.sfx.bucket();
        ui.showToast('金壶接住！+1 免费钢珠 +1000');
        ui.setBalls(balls + freeBalls);
        killBall();
        checkFeverAndClear();
        return;
      }
    }
    // fall out
    if (ball.y < -1.6) {
      killBall();
      checkFeverAndClear();
      return;
    }
  }
  // anti-wedge: trapped between wall & pegs with dying velocity → nudge, then release
  const spd = Math.hypot(ball.vx, ball.vy);
  if (spd < 1.5) {
    ball.restT = (ball.restT || 0) + dt;
    if (ball.restT > 1.2 && !ball.nudged) { ball.vx += ball.x <= 0 ? 3.2 : -3.2; ball.nudged = true; ball.restT = 0; }
    else if (ball.restT > 1.2 && ball.nudged) { ball.nudged = false; killBall(); checkFeverAndClear(); }
  } else { ball.restT = 0; ball.nudged = false; }
}

function updateBuckets(dt) {
  for (const b of buckets) {
    b.x += b.dir * b.speed * dt;
    if (b.x > BW / 2 - 3) { b.x = BW / 2 - 3; b.dir = -1; }
    if (b.x < -BW / 2 + 3) { b.x = -BW / 2 + 3; b.dir = 1; }
    b.g.position.x = b.x;
  }
}

// trajectory preview: simulate 46 steps
function updatePreview() {
  if (mode !== 'play') { trailMeshes.forEach(m => m.visible = false); return; }
  let x = 0, y = BH - 1.4, vx = Math.sin(aimAngle) * 30, vy = -Math.cos(aimAngle) * 30;
  let dot = 0;
  const h = 1 / 45;
  for (let i = 0; i < 64 && dot < trailMeshes.length; i++) {
    vy += GRAV * h; x += vx * h; y += vy * h;
    if (x < -BW / 2 || x > BW / 2) break;
    let hit = false;
    for (const p of pegs) {
      if (!p.alive) continue;
      const dx = x - p.x, dy = y - p.y;
      if (dx * dx + dy * dy < (BALL_R + PEG_R) * (BALL_R + PEG_R)) { hit = true; break; }
    }
    if (hit || i % 7 === 6) {
      const m = trailMeshes[dot++];
      m.position.set(x, y, .4);
      m.visible = true;
      if (hit) break;
    }
  }
  for (let i = dot; i < trailMeshes.length; i++) trailMeshes[i].visible = false;
}

// ==================== update / render ====================
function update(dt) {
  time += dt; playT += dt;
  updateBuckets(dt);
  if (ball) {
    stepBall(dt);
    if (fastBall && ball) { stepBall(dt); stepBall(dt); }   // click-to-fast-forward ×3
    if (!ball) fastBall = false;
    if (ball) {                              // ball may have been consumed inside stepBall
      ballMesh.position.set(ball.x, ball.y, .55);
      ballMesh.visible = true;
      if (playT % .05 < dt) { trailDots.push({ x: ball.x, y: ball.y, life: .5 }); if (trailDots.length > 16) trailDots.shift(); }
    } else ballMesh.visible = false;
  } else {
    // end of shot: ball consumed; check balls left
    if (mode === 'play' && balls <= 0 && freeBalls <= 0 && pegCountLeft() > 0) gameOver();
  }
  // peg pulse/sink visuals
  for (const p of pegs) {
    if (p.pulse > 0) {
      p.pulse -= dt * 2.4;
      p.mesh.material.emissiveIntensity = .55 + Math.max(0, p.pulse) * 2;
      if (!p.alive) { p.mesh.position.y = p.y - (1 - Math.max(0, p.pulse)) * .8; p.mesh.scale.setScalar(Math.max(.01, p.pulse)); }
    }
  }
  updatePreview();
  launcher.rotation.z = aimAngle;
  world.updateCam(dt);
  audio.update();
}

function render() { world.render(); }

// ==================== main loop ====================
let last = performance.now(), acc = 0;
function tick(now) {
  requestAnimationFrame(tick);
  let dt = (now - last) / 1000; last = now;
  if (document.hidden) return;
  handleKeys();   // consume pressed keys in the REAL loop too (was debug-only — keyboard was dead for players)
  dt = Math.min(dt, 1 / 30);
  if (mode === 'play' && !paused) {
    acc += dt;
    while (acc >= 1 / 60) { update(1 / 60); acc -= 1 / 60; }
    ui.setPegs(pegCountLeft());
    ui.setBalls(balls + freeBalls);
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

function setAimFromScreen(sx, sy) {
  // raycast-ish: map screen x to aim around center
  const nx = (sx / innerWidth) * 2 - 1;
  aimAngle = Math.max(-1.3, Math.min(1.3, nx * 1.25));
}
addEventListener('pointermove', (e) => { if (mode === 'play' && !paused && e.pointerType !== 'touch') setAimFromScreen(e.clientX); });
addEventListener('pointerdown', (e) => {
  audio.ensure();
  if (mode === 'play' && !paused) {
    setAimFromScreen(e.clientX);
    if (ball) fastBall = true;              // click during flight = speed up
  }
});
addEventListener('pointerup', (e) => {
  if (mode === 'play' && !paused) {
    if (e.pointerType === 'touch') setAimFromScreen(e.clientX);
    launch();
  }
});

function handleKeys() {
  for (const code of pressed) {
    if (code === 'KeyP') togglePause();
    else if (code === 'KeyM') toggleMute();
    else if (code === 'Enter' && (mode === 'title' || mode === 'over')) startGame();
    else if (mode === 'play' && !paused) {
      if (code === 'ArrowLeft' || code === 'KeyA') aimAngle = Math.max(-1.3, aimAngle - .08);
      else if (code === 'ArrowRight' || code === 'KeyD') aimAngle = Math.min(1.3, aimAngle + .08);
      else if (code === 'Space') launch();
    }
  }
  pressed.clear();
}

// ==================== G debug hooks ====================
const G = {
  err: window.__BOOTERR,
  step: (n = 60, dt = 1 / 60) => { for (let i = 0; i < n; i++) { handleKeys(); if (mode === 'play' && !paused) update(dt); render(); } },
  upd: (n = 30, dt = 1 / 60) => { for (let i = 0; i < n; i++) { handleKeys(); if (mode === 'play' && !paused) update(dt); } },
  press: (...codes) => codes.forEach(c => pressed.add(c)),
  setNoAuto: (v) => { noAuto = !!v; },
  setReportTarget: (fn) => { reportTarget = fn; },
  setAim: (a) => { aimAngle = Math.max(-1.3, Math.min(1.3, a)); },
  setBalls: (v) => { balls = Math.max(0, v | 0); },
  setFreeBalls: (v) => { freeBalls = Math.max(0, v | 0); },
  killPegs: (n) => {                       // kill n lowest pegs (leave n alive total)
    const alive = pegs.filter(p => p.alive);
    for (let i = 0; i < alive.length - n && alive.length - i > 0; i++) alive[i].alive = false;
  },
  pegsLeft: () => pegCountLeft(),
  pushPegsAside: () => {                    // tests: move live pegs away from center column
    for (const p of pegs) {
      if (!p.alive) continue;
      if (Math.abs(p.x) < 9) { p.x = p.x >= 0 ? 12 : -12; p.mesh.position.x = p.x; }
    }
  },
  bucketAt: (i, x) => { if (buckets[i]) buckets[i].x = Math.max(-BW / 2 + 3, Math.min(BW / 2 - 3, x)); buckets[i].g.position.x = buckets[i].x; },
  state: () => ({ mode, paused, score, bestScore, bestRound, round, balls, freeBalls, mult, shotHits, purpleHit, feverArmed, feverActive, pegsLeft: pegCountLeft(), pegsTotal: pegs.length, hasBall: !!ball, aimAngle: +aimAngle.toFixed(2), bucketX: buckets.map(b => +b.x.toFixed(2)) }),
  fx: () => ({ trailDots: trailMeshes.filter(m => m.visible).length }),
  pegs, buckets, ball: () => ball, audio, world,
  forceGameOver: () => gameOver(),
  launch, startGame,
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
    const savedScore = bestScore, savedRound = bestRound;
    G.setReportTarget(() => { });

    assert(1, G.err.length === 0, '启动零报错');
    startGame();
    assert(2, S().mode === 'play' && S().pegsTotal === 75 && S().balls === 8, '开局 75 珍珠 8 钢珠');

    // -- T3: layout bounds
    let inBounds = true;
    for (const p of pegs) if (p.x < -BW / 2 + 1 || p.x > BW / 2 - 1 || p.y < 3 || p.y > BH - 1.5) inBounds = false;
    assert(3, inBounds, '珍珠全部落在板内');

    // -- T4/T5: launch + gravity
    const launched = G.launch();
    assert(4, launched && S().hasBall, '发射钢珠在场');
    G.upd(20);
    assert(5, G.ball() && !isNaN(G.ball().y), '钢珠下落无 NaN');

    // -- T6/T7: peg hit removes & scores (brute-force aims until a hit occurs)
    startGame();
    const s0 = S().score, n0 = S().pegsLeft;
    let hit = false;
    for (const a of [-.6, -.4, -.2, 0, .2, .4, .6]) {
      G.setAim(a); G.upd(1);
      if (G.launch()) {
        G.upd(240);
        if (S().pegsLeft < n0) { hit = true; break; }
      }
    }
    assert(6, hit && S().pegsLeft < n0, '击中珍珠并移除');
    assert(7, S().score > s0, '击珠得分');

    // -- T8: ball falls out & next shot ready
    G.upd(240);
    assert(8, !S().hasBall, '钢珠落出后回收');

    // -- T9/T10: ladder multiplier math (simulate hits directly)
    startGame();
    const alive0 = pegs.filter(p => p.alive && p.kind === 'blue');
    const sBefore = S().score;
    hitPeg(alive0[0]);                        // ×1    → 100
    hitPeg(alive0[1]);                        // ×1.5  → 150
    const gain2 = S().score - sBefore;
    assert(9, gain2 === 250, `一击连珠倍率阶梯(100+150=${gain2})`);
    hitPeg(alive0[2]);                        // ×2 → 200
    assert(10, S().score - sBefore === 450, '第三颗珠 ×2 计分');

    // -- T11: purple ×5
    startGame();
    const purple = pegs.find(p => p.kind === 'purple');
    const sP = S().score;
    hitPeg(purple);
    assert(11, S().score === sP + 500, '紫珍珠 ×5 计分');

    // -- T12: green free ball
    startGame();
    const green = pegs.find(p => p.kind === 'green');
    const fb0 = S().freeBalls;
    hitPeg(green);
    assert(12, S().freeBalls === fb0 + 1, '绿珍珠 +1 免费钢珠');

    // -- T13/T14: fever at ≤10 pegs
    startGame();
    G.killPegs(FEVER_AT);
    assert(13, S().pegsLeft === FEVER_AT, '削到剩 10 颗珍珠');
    if (G.launch()) G.upd(600);
    assert(14, S().feverArmed && S().freeBalls >= FEVER_BALLS, '落珠后 FEVER 触发 +3 免费珠');

    // -- T15: clear round advances
    startGame();
    G.killPegs(0);
    if (G.launch()) G.upd(600);
    assert(15, S().round === 2 && S().pegsTotal === 80, '清台进入第 2 轮且珍珠 +5');

    // -- T16: bucket catch (deterministic: pegs pushed aside, frozen bucket at center)
    startGame();
    G.killPegs(13);                            // 13 left: above FEVER_AT, no clear
    G.pushPegsAside();                         // clear the drop lane
    G.bucketAt(0, 0);
    buckets[0].dir = 0;
    const fbB = S().freeBalls;
    G.setAim(0);
    if (G.launch()) G.upd(600);
    assert(16, S().freeBalls === fbB + 1 && !S().hasBall, '金壶接住钢珠得免费珠');

    // -- T17: balls out → gameOver
    startGame();
    G.setNoAuto(true);
    G.setBalls(1); G.setFreeBalls(0);
    for (let i = 0; i < 40 && S().mode === 'play'; i++) {
      G.setAim((Math.random() - .5) * 1.2);
      if (!S().hasBall) G.launch();
      G.upd(60);
    }
    assert(17, S().mode === 'over', '钢珠耗尽判负');

    // -- T18: aim clamp
    G.setAim(5);
    assert(18, S().aimAngle <= 1.3, '瞄准角钳制 ±1.3');

    // -- T19: best persistence
    startGame();
    bestScore = 0; bestRound = 0;
    try { localStorage.setItem('ppc.bestScore', '0'); localStorage.setItem('ppc.bestRound', '0'); } catch (e) { }
    score = 2345; round = 3;
    G.forceGameOver();
    const bs = parseInt(localStorage.getItem('ppc.bestScore') || '0') || 0;
    const br = parseInt(localStorage.getItem('ppc.bestRound') || '0') || 0;
    assert(19, bs === 2345 && br === 3, 'bestScore/bestRound 写 localStorage');
    try { localStorage.setItem('ppc.bestScore', String(savedScore)); localStorage.setItem('ppc.bestRound', String(savedRound)); } catch (e) { }
    bestScore = savedScore; bestRound = savedRound;

    // -- T20: protocol sequence
    assert(20, reports[0] && reports[0].kind === 'ready', 'ready 首帧');
    assert(21, reports.some(f => f.kind === 'progress'), 'progress 帧存在');
    assert(22, reports[reports.length - 1].kind === 'gameOver', 'gameOver 末帧');

    // -- T23: restart resets
    startGame();
    const st23 = S();
    assert(23, st23.score === 0 && st23.round === 1 && st23.balls === 8 && st23.pegsTotal === 75 && !st23.feverArmed, '重开一局复位');

    // -- T24: buckets move
    const bx0 = S().bucketX[0];
    G.upd(30);
    assert(24, Math.abs(S().bucketX[0] - bx0) > .5, '金壶持续游走');

    // -- T25: audio
    audio.ensure();
    assert(25, audio.hasCtx() && audio.isMuted() === true, 'AudioContext + 自测静音');

    // -- T26: full session fast-forward
    const errBefore = G.err.length;
    startGame();
    let nan = false;
    for (let i = 0; i < 30; i++) {
      if (S().mode !== 'play') break;
      if (!S().hasBall) { G.setAim((Math.random() - .5) * 1.2); G.launch(); }
      G.upd(90);
      if (isNaN(S().score)) nan = true;
    }
    assert(26, !nan && G.err.length === errBefore, '30 发快进无 NaN 无新报错');
    if (S().mode === 'play') G.forceGameOver();
    toTitle();
    assert(27, S().mode === 'title' && !ui.el.title.classList.contains('hide'), '测完回标题');

    // restore best
    try { localStorage.setItem('ppc.bestScore', String(savedScore)); localStorage.setItem('ppc.bestRound', String(savedRound)); } catch (e) { }
    bestScore = savedScore; bestRound = savedRound; ui.setBest(bestScore, bestRound);

    const pass = results.filter(r => r.ok).length;
    window.__TEST = { pass, fail: results.length - pass, total: results.length, results, done: true };
    console.log(`[autotest] ${pass}/${results.length} passed`);
  }
}

if (new URLSearchParams(location.search).get('autotest')) autotest();
