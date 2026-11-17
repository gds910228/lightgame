// Sling Siege 弹弓拆塔记 — slingshot physics destruction puzzle.
// guizang-game-skill methodology, third series #6. 2D canvas, self-written
// AABB physics (js/physics.js), material damage (wood/stone/glass), collapse
// crush / fatal-fall / blast kills, TNT chain explosions, triple pearls,
// 24 hand-designed levels with star ratings & chapter gates.
// Structure mirrors orchard-fusion: fixed-step loop, G debug hooks,
// ?autotest=1 suite (MessageChannel nap), site report bridge, synth audio.

import { WORLD, SLING, LEVELS, SANDBOX, CHAPTERS } from './levels.js';
import { MATS, ENEMY_TYPES, PROJ_DEFS, makeBlock, makeEnemy, makeProjectile,
         drawBlock, drawEnemy, drawProjectile, drawFrag, drawStar, drawSling } from './entities.js';
import { makePhysics } from './physics.js';
import { makeAudio } from './audio.js';
import { makeUI } from './ui.js';

// ==================== constants ====================
const W = WORLD.W, H = WORLD.H, GROUND_Y = WORLD.GROUND_Y;
const MAXV = 1200;                    // launch speed at power 1 (px/s)
const BAND_MAX = 110;                 // drag distance for full power
const MIN_PULL = 20;                  // below this the shot is cancelled
const FALL_DEATH = 100;               // 2 m at 50 px/m
const DMG_K = 0.10;                   // projectile impact damage coefficient
const IMPACT_K = 0.02;                // block-block / ground impact coefficient
const TNT_R = 150;                    // explosion radius (block damage + push)
const TNT_KILL_R = TNT_R * 0.85;      // enemy kill radius
const CHAIN_R = 260;                  // tnt→tnt chain detonation radius
const TNT_DMG = 170;                  // damage at blast center
const PROGRESS_T = 3;                 // progress report throttle (s)

// ==================== state ====================
let mode = 'title';                   // title | select | play | clear | over
let paused = false, noAuto = false;
let level = SANDBOX;
let bodies = [];                      // blocks + projectiles (physics bodies)
let enemies = [];
let frags = [], parts = [], floats = [], rings = [];
let ammo = { ball: 0, tnt: 0, tri: 0 };
let curKind = 'ball';
let shotsUsed = 0, score = 0, killCount = 0, lastStars = 0;
let winT = 0, failT = 0, playT = 0, lastProgT = -99, hitstop = 0;
let shakeT = 0, shakeAmp = 0, flashT = 0;
let explosions = 0, lastChain = false, completeSent = false;
const boomQueue = [];
let aim = null;                       // {sx,sy,cx,cy,pid}
let lastKillCause = '';

let records = { levels: {} };
try { records = JSON.parse(localStorage.getItem('sls.best') || '') || { levels: {} }; } catch (e) { }
if (!records || typeof records !== 'object' || !records.levels) records = { levels: {} };
let muted = false;
try { muted = localStorage.getItem('sls.mute') === '1'; } catch (e) { }

const phys = makePhysics({ groundY: GROUND_Y, platforms: [], gravity: 1300 });
const audio = makeAudio();
const AUTOTEST = new URLSearchParams(location.search).has('autotest');

function totalStars() {
  let t = 0;
  for (const k in records.levels) t += records.levels[k].s || 0;
  return t;
}
function persistRecords() {
  try { localStorage.setItem('sls.best', JSON.stringify(records)); } catch (e) { }
}
function saveRecord(no, stars, sc) {
  const old = records.levels[no];
  if (!old || stars > old.s || (stars === old.s && sc > old.sc)) {
    records.levels[no] = { s: stars, sc };
    persistRecords();
  }
}
function chapterUnlocked(ci) {
  const c = CHAPTERS[ci];
  if (!c) return false;
  return totalStars() >= c.need;
}
function levelUnlocked(no) {
  if (no === 1) return true;
  const c = CHAPTERS.find(c => no >= c.from && no <= c.to);
  if (!c) return false;
  if (totalStars() < c.need) return false;
  return no === c.from ? true : !!records.levels[no - 1];
}
function calcStars(used, par) {
  if (used <= par) return 3;
  if (used <= par + 1) return 2;
  return 1;
}
function blastDamage(d) {
  const f = Math.max(0, 1 - d / TNT_R);
  return TNT_DMG * Math.pow(f, 0.8);
}
function srand(seed) { let s = seed; return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }; }

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

// static dusk meadow layer (pre-rendered once)
const bgCv = document.createElement('canvas');
bgCv.width = W * 2; bgCv.height = H * 2;
{
  const c = bgCv.getContext('2d'); c.scale(2, 2);
  const sky = c.createLinearGradient(0, 0, 0, GROUND_Y);
  sky.addColorStop(0, '#35264f'); sky.addColorStop(.38, '#7a4260');
  sky.addColorStop(.62, '#c96a50'); sky.addColorStop(.82, '#eda15f'); sky.addColorStop(1, '#f7c96e');
  c.fillStyle = sky; c.fillRect(0, 0, W, GROUND_Y);
  const sg = c.createRadialGradient(1020, 470, 10, 1020, 470, 150);
  sg.addColorStop(0, 'rgba(255,225,160,.9)'); sg.addColorStop(.25, 'rgba(255,200,120,.45)'); sg.addColorStop(1, 'rgba(255,190,110,0)');
  c.fillStyle = sg; c.fillRect(860, 320, 330, 310);
  c.fillStyle = '#ffe1a0';
  c.beginPath(); c.arc(1020, 470, 46, 0, 7); c.fill();
  c.fillStyle = 'rgba(255,190,150,.14)';
  for (const [cx, cy, cw] of [[260, 150, 220], [560, 110, 160], [880, 200, 260], [1180, 130, 180]]) {
    c.beginPath(); c.ellipse(cx, cy, cw, 22, 0, 0, 7); c.fill();
    c.beginPath(); c.ellipse(cx + cw * .3, cy - 16, cw * .5, 16, 0, 0, 7); c.fill();
  }
  c.fillStyle = '#4a3358';
  c.beginPath(); c.moveTo(0, 560);
  for (let x = 0; x <= W; x += 64) c.quadraticCurveTo(x + 32, 528 + Math.sin(x * .011) * 26, x + 64, 556);
  c.lineTo(W, GROUND_Y); c.lineTo(0, GROUND_Y); c.fill();
  c.fillStyle = '#5c3f5e';
  c.beginPath(); c.moveTo(0, 592);
  for (let x = 0; x <= W; x += 96) c.quadraticCurveTo(x + 48, 566 + Math.sin(x * .017 + 2) * 18, x + 96, 590);
  c.lineTo(W, GROUND_Y); c.lineTo(0, GROUND_Y); c.fill();
  const gg = c.createLinearGradient(0, GROUND_Y, 0, H);
  gg.addColorStop(0, '#96a03c'); gg.addColorStop(.25, '#7d8f3a'); gg.addColorStop(.55, '#6b4a2e'); gg.addColorStop(1, '#523620');
  c.fillStyle = gg; c.fillRect(0, GROUND_Y, W, H - GROUND_Y);
  c.strokeStyle = 'rgba(255,230,160,.55)'; c.lineWidth = 2.5;
  c.beginPath(); c.moveTo(0, GROUND_Y + 1); c.lineTo(W, GROUND_Y + 1); c.stroke();
  const r = srand(913);
  c.strokeStyle = 'rgba(60,80,30,.5)'; c.lineWidth = 1.6;
  for (let i = 0; i < 130; i++) {
    const gx = r() * W, gy = GROUND_Y + 3 + r() * 16;
    c.beginPath(); c.moveTo(gx, gy); c.lineTo(gx + (r() - .5) * 5, gy - 5 - r() * 5); c.stroke();
  }
  c.fillStyle = 'rgba(50,32,18,.4)';
  for (let i = 0; i < 60; i++) c.fillRect(r() * W, GROUND_Y + 22 + r() * 70, 3 + r() * 4, 2.5);
  const vg = c.createRadialGradient(W / 2, H / 2, H * .55, W / 2, H / 2, H * 1.15);
  vg.addColorStop(0, 'rgba(20,10,30,0)'); vg.addColorStop(1, 'rgba(20,10,30,.42)');
  c.fillStyle = vg; c.fillRect(0, 0, W, H);
}

// ==================== UI ====================
const ui = makeUI({
  onStart: () => { audio.sfx.ui(); toSelect(); },
  onSelect: () => { audio.sfx.ui(); toSelect(); },
  onBack: () => { audio.sfx.ui(); toTitle(); },
  onPick: (no) => { audio.sfx.select(); loadLevel(no); },
  onRetry: () => { audio.sfx.ui(); retry(); },
  onNext: () => { audio.sfx.ui(); nextLevel(); },
  onMenu: () => { audio.sfx.ui(); toSelect(); },
  onResume: () => { audio.sfx.ui(); togglePause(); },
  onMute: () => toggleMute(),
  onPause: () => { audio.sfx.ui(); togglePause(); },
});
for (const [btn, kind] of [[ui.el.amb, 'ball'], [ui.el.amt, 'tnt'], [ui.el.amr, 'tri']]) {
  btn.addEventListener('click', () => pickKind(kind));
}
ui.setTitleBest(totalStars());
ui.showTitle(true);
ui.showSelect(false);
ui.setMutedIcon(muted);
audio.setMuted(muted);

// ==================== report bridge ====================
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
report('ready', { game: 'sling-siege' });

function reportProgress(force = false) {
  if (level.sandbox) return;
  if (!force && playT - lastProgT < PROGRESS_T) return;
  lastProgT = playT;
  report('progress', { score, progress: +(level.no / 24).toFixed(4) });
}

// ==================== game flow ====================
function loadLevel(no) {
  level = no === 0 ? SANDBOX : (LEVELS[no - 1] || SANDBOX);
  bodies = [];
  enemies = [];
  frags = []; parts = []; floats = []; rings = [];
  boomQueue.length = 0;
  ammo = { ball: level.ammo.ball || 0, tnt: level.ammo.tnt || 0, tri: level.ammo.tri || 0 };
  curKind = ammo.ball > 0 ? 'ball' : (ammo.tnt > 0 ? 'tnt' : 'tri');
  shotsUsed = 0; score = 0; killCount = 0; lastStars = 0;
  winT = 0; failT = 0; playT = 0; lastProgT = -99; hitstop = 0;
  shakeT = 0; flashT = 0; explosions = 0; lastChain = false;
  aim = null;

  for (const b of level.blocks) bodies.push(makeBlock(b[0], b[1], b[2], b[3], b[4]));
  for (const e of level.enemies) enemies.push(makeEnemy(e[0], e[1], e[2]));
  phys.platforms.length = 0;
  for (const p of level.platforms) phys.platforms.push({ cx: p[0], cy: p[1], w: p[2], h: p[3] });

  mode = 'play'; paused = false;
  ui.showTitle(false); ui.showSelect(false); ui.showEnd(false); ui.showPause(false);
  ui.setPausedIcon(false);
  ui.setLevel(level.no, level.name, level.par);
  syncHud();

  // pre-settle: run a few silent frames so stacks rest perfectly before play
  for (let i = 0; i < 45; i++) {
    phys.step(bodies, 1 / 60);
    updateEnemies(1 / 60, true);
  }
  cleanupDead();

  if (level.hint) ui.showToast(level.hint, 4200);
  ui.showBanner(`第 ${level.no} 关 · ${level.name}`, `敌人 ×${aliveEnemies()} · ≤${level.par} 发得三星`, 1800);
  if (!audio.hasCtx() && !AUTOTEST) audio.ensure();
  audio.state('battle'); audio.update();
}
function retry() { if (mode !== 'title') loadLevel(level.no); }
function nextLevel() {
  const n = level.no + 1;
  if (n <= 24 && levelUnlocked(n)) loadLevel(n);
  else toSelect();
}
function toTitle() {
  mode = 'title'; paused = false;
  ui.showTitle(true); ui.showSelect(false); ui.showEnd(false); ui.showPause(false);
  ui.setPausedIcon(false); ui.setTitleBest(totalStars());
}
function toSelect() {
  mode = 'select'; paused = false;
  ui.showTitle(false); ui.showEnd(false); ui.showPause(false);
  ui.showSelect(true); ui.setPausedIcon(false);
  ui.setTitleBest(totalStars());
  ui.buildSelect(LEVELS, records.levels, levelUnlocked, (no) => { audio.sfx.select(); loadLevel(no); });
}
function togglePause() {
  if (mode !== 'play') return;
  paused = !paused;
  ui.setPausedIcon(paused);
  ui.showPause(paused);
}
function toggleMute() {
  muted = !muted;
  audio.setMuted(muted);
  ui.setMutedIcon(muted);
  try { localStorage.setItem('sls.mute', muted ? '1' : '0'); } catch (e) { }
}
function pickKind(k) {
  if (mode !== 'play' || paused) return;
  if (!(ammo[k] > 0)) return;
  curKind = k;
  ui.setAmmo(ammo, curKind);
  audio.sfx.select();
}
function aliveEnemies() { let n = 0; for (const e of enemies) if (!e.dead) n++; return n; }
function ammoLeft() { return ammo.ball + ammo.tnt + ammo.tri; }
function syncHud() {
  ui.setAmmo(ammo, curKind);
  ui.setEnemiesLeft(aliveEnemies());
  ui.setScore(score);
}

function doClear() {
  mode = 'clear';
  const leftover = ammoLeft();
  if (leftover > 0) {
    score += leftover * 100;
    floats.push({ x: SLING.x + 90, y: SLING.y - 70, text: `剩余弹药 +${leftover * 100}`, life: 1.4, color: '#ffe9a8', size: 22 });
  }
  lastStars = calcStars(shotsUsed, level.par);
  saveRecord(level.no, lastStars, score);
  reportProgress(true);
  report('event', { tag: 'clear', level: level.no, stars: lastStars });
  if ((level.no === 24 || totalStars() >= 72) && !completeSent) {
    completeSent = true;
    report('complete', { score, progress: 1 });
  }
  ui.setScore(score);
  ui.setTitleBest(totalStars());
  ui.showEnd(true);
  ui.setEnd(true, { stars: lastStars, score, used: shotsUsed, par: level.par });
  audio.sfx.win();
  for (let n = 0; n < lastStars; n++) audio.sfx.star(n);
  for (let i = 0; i < 60; i++) {
    const a = Math.random() * Math.PI * 2, sp = 120 + Math.random() * 380;
    const cols = ['#ffd77a', '#ff8a5c', '#9a5cd0', '#6fe8d8', '#f25767'];
    parts.push({ x: W / 2, y: H * .35, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 120, life: .9 + Math.random() * .7, max: 1.6, color: cols[i % 5], size: 3 + Math.random() * 4, grav: 420, kind: 'dot' });
  }
}
function doFail() {
  mode = 'over';
  audio.sfx.lose();
  report('gameOver', { score, progress: +(level.no / 24).toFixed(4) });
  ui.showEnd(true);
  ui.setEnd(false, { score, left: aliveEnemies() });
}

// ==================== firing ====================
function launch(kind, x, y, vx, vy, consume) {
  if (consume) {
    if (ammo[kind] <= 0) return false;
    ammo[kind]--;
    shotsUsed++;
    if (ammo[curKind] <= 0) {
      curKind = ammo.ball > 0 ? 'ball' : (ammo.tnt > 0 ? 'tnt' : (ammo.tri > 0 ? 'tri' : curKind));
    }
  }
  if (kind === 'tri') {
    const base = Math.atan2(-vy, vx);
    const sp = Math.hypot(vx, vy);
    for (let i = -1; i <= 1; i++) {
      const a = base + i * 7 * Math.PI / 180;
      bodies.push(makeProjectile('pearl', x + Math.cos(a) * 18, y - Math.sin(a) * 18, Math.cos(a) * sp, -Math.sin(a) * sp));
    }
  } else {
    bodies.push(makeProjectile(kind, x, y, vx, vy));
  }
  audio.sfx.fire();
  for (let i = 0; i < 6; i++) {
    parts.push({ x, y, vx: -vx * .08 + (Math.random() - .5) * 60, vy: -vy * .08 + (Math.random() - .5) * 60, life: .3, max: .3, color: '#f2dcb0', size: 2.5, grav: 0, kind: 'dot' });
  }
  shakeT = Math.max(shakeT, .1); shakeAmp = Math.max(shakeAmp, 2);
  syncHud();
  reportProgress();
  return true;
}

function fireAt(kind, angleDeg, power, force = false) {
  if (mode !== 'play' || paused) return false;
  if (!force && ammo[kind] <= 0) return false;
  const v = Math.max(.05, Math.min(1, power)) * MAXV;
  const a = angleDeg * Math.PI / 180;
  return launch(kind, SLING.x, SLING.y, Math.cos(a) * v, -Math.sin(a) * v, !force);
}

function fireFromDrag() {
  if (!aim) return;
  const dx = aim.cx - aim.sx, dy = aim.cy - aim.sy;
  const len = Math.hypot(dx, dy);
  aim = null;
  if (len < MIN_PULL) return;
  const cl = Math.min(len, BAND_MAX);
  const nx = -dx / len, ny = -dy / len;      // launch opposite the pull
  const v = cl / BAND_MAX * MAXV;
  const px = SLING.x - nx * cl, py = SLING.y - ny * cl;
  launch(curKind, px, py, nx * v, ny * v, true);
}

function predictTrajectory(x, y, vx, vy, n = 12) {
  const pts = [];
  const dt = .05;
  for (let i = 0; i < n; i++) {
    x += vx * dt; y += vy * dt; vy += phys.GRAV * dt;
    pts.push({ x, y });
    if (y > GROUND_Y - 4) break;
  }
  return pts;
}

function solveShot(tx, ty, hitR = 26) {
  // flattest-first scan: outer angle asc (fast low arcs before steep lobs),
  // inner power desc (strongest shot at that angle)
  for (let ang = 15; ang <= 80; ang += 2.5) {
    for (let power = 1; power >= 0.35; power -= 0.05) {
      if (simHit(ang, power, tx, ty, hitR)) return { angle: ang, power };
    }
  }
  return null;
}
function simHit(ang, power, tx, ty, hitR) {
  const v = power * MAXV, r = ang * Math.PI / 180;
  let x = SLING.x, y = SLING.y, vx = Math.cos(r) * v, vy = -Math.sin(r) * v;
  const dt = 1 / 60;
  for (let i = 0; i < 420; i++) {
    x += vx * dt; y += vy * dt; vy += phys.GRAV * dt;
    if (y > GROUND_Y - 6 && vy > 0) return false;
    if (x > W + 40 || x < -40) return false;
    if (Math.hypot(x - tx, y - ty) < hitR) return true;
  }
  return false;
}

// ==================== damage / destruction ====================
phys.onImpact = (a, b, vn) => {
  const isProj = (o) => o && o.kind !== 'block';
  if (a.kind === 'tnt') { queueBoom(a); return; }
  if (isProj(b) && b.kind === 'tnt') { queueBoom(b); return; }
  if (a.kind === 'pearl' || (isProj(b) && b.kind === 'pearl')) {
    const p = a.kind === 'pearl' ? a : b;
    const other = p === a ? b : a;
    if (other && other.kind === 'block') damageBlock(other, vn * p.mass * DMG_K, p);
    breakPearl(p);
    return;
  }
  if (a.kind === 'ball' || (isProj(b) && b.kind === 'ball')) {
    const p = a.kind === 'ball' ? a : b;
    const other = p === a ? b : a;
    if (other && other.kind === 'block') {
      damageBlock(other, vn * p.mass * DMG_K, p);
      if (other.mat === 'wood') audio.sfx.hitWood(Math.min(1, vn / 900));
      else if (other.mat === 'stone') audio.sfx.hitStone(Math.min(1, vn / 900));
    }
    return;
  }
  if (a.kind === 'block' && b && b.kind === 'block') {
    const dA = Math.max(0, vn - 140) * b.mass * IMPACT_K;
    const dB = Math.max(0, vn - 140) * a.mass * IMPACT_K;
    if (dA > .6) damageBlock(a, dA, b);
    if (dB > .6) damageBlock(b, dB, a);
    return;
  }
  if (a.kind === 'block' && !b) {
    const d = Math.max(0, vn - 170) * a.mass * IMPACT_K * .9;
    if (d > .6) damageBlock(a, d, null);
    if (vn > 220) audio.sfx.thud();
  }
};

function damageBlock(b, dmg, src) {
  if (b.dead) return;
  phys.wake(b);
  b.hp -= dmg;
  b.hitFlash = .18;
  if (b.hp <= 0) destroyBlock(b, src);
}

function destroyBlock(b) {
  if (b.dead) return;
  b.dead = true;
  score += 10;
  ui.setScore(score);
  spawnFrags(b);
  chipBurst(b);
  if (b.mat === 'glass') audio.sfx.glassBreak();
  else if (b.mat === 'wood') audio.sfx.woodBreak();
  else audio.sfx.stoneBreak();
  shakeT = Math.max(shakeT, .18); shakeAmp = Math.max(shakeAmp, b.mat === 'stone' ? 4 : 2.6);
  if (b.mat === 'stone') hitstop = Math.max(hitstop, .05);
  for (const o of bodies) {
    if (!o.dead && o.asleep && o.supportOn === b) phys.wake(o);
  }
}

function spawnFrags(b) {
  const area = b.w * b.h;
  const n = area >= 3600 ? 4 : (area >= 1500 ? 3 : 2);
  const cw = b.w / 2, ch = b.h / 2;
  const cells = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
  const start = b.id % 4;
  for (let i = 0; i < n; i++) {
    const [sx, sy] = cells[(start + i) % 4];
    frags.push({
      x: b.x + sx * cw / 2, y: b.y + sy * ch / 2,
      w: Math.max(8, cw), h: Math.max(8, ch),
      vx: b.vx * .4 + sx * (60 + Math.random() * 90) + (Math.random() - .5) * 60,
      vy: b.vy * .3 - 90 - Math.random() * 130,
      rot: 0, vr: (Math.random() - .5) * 7,
      life: 2.5, mat: b.mat,
    });
  }
}
function chipBurst(b) {
  const m = MATS[b.mat];
  for (let i = 0; i < 12; i++) {
    const a = Math.random() * Math.PI * 2, sp = 90 + Math.random() * 220;
    parts.push({ x: b.x, y: b.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 100, life: .45 + Math.random() * .3, max: .75, color: m.frag, size: 2 + Math.random() * 3.5, grav: 900, kind: 'dot' });
  }
}
function breakPearl(p) {
  if (p.dead) return;
  p.dead = true;
  for (let i = 0; i < 6; i++) {
    const a = Math.random() * Math.PI * 2, sp = 60 + Math.random() * 140;
    parts.push({ x: p.x, y: p.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: .3, max: .3, color: '#bdeef5', size: 2, grav: 500, kind: 'dot' });
  }
}

function queueBoom(p) {
  if (p.dead || p.boomQueued) return;
  p.boomQueued = true;
  boomQueue.push(p);
}
function processBooms() {
  let guard = 0;
  while (boomQueue.length && guard++ < 8) {
    const p = boomQueue.shift();
    if (p.dead) continue;
    if (p.chain) lastChain = true;
    p.dead = true;
    explosion(p.x, p.y, p);
  }
}
function explosion(x, y, src) {
  explosions++;
  audio.sfx.boom();
  flashT = .3; shakeT = .42; shakeAmp = 9;
  hitstop = Math.max(hitstop, .085);
  rings.push({ x, y, r: 12, t: .38, max: .38 });
  for (let i = 0; i < 22; i++) {
    const a = Math.random() * Math.PI * 2, sp = 120 + Math.random() * 420;
    parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 140, life: .4 + Math.random() * .45, max: .85, color: ['#ffd77a', '#ff8a3c', '#e84a30'][i % 3], size: 3 + Math.random() * 5, grav: 300, kind: 'dot' });
  }
  for (let i = 0; i < 10; i++) {
    const a = Math.random() * Math.PI * 2;
    parts.push({ x, y, vx: Math.cos(a) * 60, vy: -40 - Math.random() * 90, life: .7 + Math.random() * .5, max: 1.2, color: 'rgba(90,70,60,.5)', size: 8 + Math.random() * 12, grav: -30, kind: 'smoke' });
  }
  for (const b of bodies) {
    if (b.dead || b === src) continue;
    const d = Math.hypot(b.x - x, b.y - y);
    if (b.kind === 'block') {
      if (d < TNT_R) {
        const f = Math.max(0, 1 - d / TNT_R);
        phys.wake(b);
        damageBlock(b, blastDamage(d), null);
        if (!b.dead) {
          const nx = (b.x - x) / (d || 1), ny = (b.y - y) / (d || 1);
          b.vx += nx * 300 * f;
          b.vy += ny * 300 * f - 130 * f;
          b.asleep = false;
        }
      }
    } else if (b.kind === 'tnt') {
      if (d < CHAIN_R) { b.chain = true; queueBoom(b); }
    } else {
      if (d < TNT_R) {
        const f = Math.max(0, 1 - d / TNT_R);
        b.vx += ((b.x - x) / (d || 1)) * 260 * f;
      }
    }
  }
  for (const e of enemies) {
    if (e.dead) continue;
    if (Math.hypot(e.x - x, e.y - y) < TNT_KILL_R) killEnemy(e, 'blast');
  }
  reportProgress();
}

// ==================== enemies ====================
function findEnemySupport(e) {
  const feet = e.y + e.h / 2;
  let best = null, bestD = 99;
  for (const b of bodies) {
    if (b.kind !== 'block' || b.dead) continue;
    const top = b.y - b.halfH;
    const d = feet - top;
    if (d >= -10 && d <= 8 && e.x + e.w / 2 > b.x - b.halfW + 4 && e.x - e.w / 2 < b.x + b.halfW - 4) {
      if (Math.abs(d) < bestD) { bestD = Math.abs(d); best = { top, blk: b }; }
    }
  }
  for (const p of phys.platforms) {
    const top = p.cy - p.h / 2;
    const d = feet - top;
    if (d >= -10 && d <= 8 && e.x + e.w / 2 > p.cx - p.w / 2 + 4 && e.x - e.w / 2 < p.cx + p.w / 2 - 4) {
      if (Math.abs(d) < bestD) { bestD = Math.abs(d); best = { top, plat: p }; }
    }
  }
  {
    const d = feet - GROUND_Y;
    if (d >= -10 && d <= 8 && Math.abs(d) < bestD) best = { top: GROUND_Y };
  }
  return best;
}

function updateEnemies(dt, settle = false) {
  for (const e of enemies) {
    if (e.dead) continue;
    e.hitCd = Math.max(0, e.hitCd - dt);
    e.flash = Math.max(0, e.flash - dt);
    if (Math.abs(e.vx) > 4) {
      e.x += e.vx * dt;
      e.vx *= Math.max(0, 1 - 3.5 * dt);
    }
    const sup = findEnemySupport(e);
    if (sup) {
      if (e.falling) {
        const drop = (e.y + e.h / 2) - e.fallFrom;
        e.falling = false; e.vy = 0;
        if (!settle && drop > FALL_DEATH) { killEnemy(e, 'fall'); continue; }
      }
      if (sup.blk) e.x += sup.blk.x - sup.blk.px;   // ride the support block
      e.y = sup.top - e.h / 2;
      e.support = sup.blk || sup.plat || 'ground';
    } else {
      if (!e.falling) { e.falling = true; e.fallFrom = e.y + e.h / 2; e.vy = Math.max(e.vy, 0); }
      e.vy += phys.GRAV * dt;
      e.y += e.vy * dt;
      e.x += e.vx * dt;
    }
    if (e.dead) continue;
    // crush by moving / burying blocks
    for (const b of bodies) {
      if (b.kind !== 'block' || b.dead) continue;
      const ox = Math.min(e.x + e.w / 2, b.x + b.halfW) - Math.max(e.x - e.w / 2, b.x - b.halfW);
      const oy = Math.min(e.y + e.h / 2, b.y + b.halfH) - Math.max(e.y - e.h / 2, b.y - b.halfH);
      if (ox > 0 && oy > 0) {
        const pen = Math.min(ox, oy);
        const sp = Math.abs(b.vx) + Math.abs(b.vy);
        if (!settle && pen > 8 && (sp > 130 || pen > e.h * .5)) { killEnemy(e, 'crush'); break; }
      }
    }
    if (e.dead) continue;
    // direct projectile hits
    for (const p of bodies) {
      if (p.kind === 'block' || p.dead || p.ehitCd > 0) continue;
      if (Math.abs(p.x - e.x) < p.halfW + e.w / 2 && Math.abs(p.y - e.y) < p.halfH + e.h / 2
          && Math.hypot(p.vx, p.vy) > 140) {
        p.ehitCd = .28;
        e.hp -= 1;
        e.flash = .15;
        e.vx += p.vx * .22;
        for (let i = 0; i < 4; i++) {
          parts.push({ x: e.x, y: e.y, vx: (Math.random() - .5) * 160, vy: -Math.random() * 160, life: .3, max: .3, color: '#8cc65c', size: 2.5, grav: 700, kind: 'dot' });
        }
        audio.sfx.hitWood(.7);
        if (e.hp <= 0) { killEnemy(e, 'hit'); break; }
      }
    }
    if (e.dead) continue;
    if (e.y - e.h / 2 > H + 60 || e.x < -60 || e.x > W + 60) killEnemy(e, 'out');
  }
}

function killEnemy(e, cause) {
  if (e.dead) return;
  e.dead = true;
  killCount++;
  score += e.score;
  ui.setScore(score);
  ui.setEnemiesLeft(aliveEnemies());
  floats.push({ x: e.x, y: e.y - e.h, text: `+${e.score}`, life: 1, color: '#ffd77a', size: 22 });
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI / 2 + (Math.random() - .5) * 2.2, sp = 160 + Math.random() * 240;
    parts.push({ x: e.x, y: e.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: .6 + Math.random() * .4, max: 1, color: '#ffd34d', size: 4 + Math.random() * 3, grav: 500, kind: 'star', rot: Math.random() * 6, vr: (Math.random() - .5) * 9 });
  }
  parts.push({ x: e.x, y: e.y, vx: e.vx * .6 + (cause === 'blast' ? (Math.random() - .5) * 300 : 0), vy: -220 - Math.random() * 120, life: .8, max: .8, color: '#6fb24a', size: 1, grav: 900, kind: 'goner', rot: 0, vr: 6, etype: e.type, ewidth: e.w, eheight: e.h });
  hitstop = Math.max(hitstop, .06);
  shakeT = Math.max(shakeT, .15); shakeAmp = Math.max(shakeAmp, 2.5);
  audio.sfx.kill();
  lastKillCause = cause;
  reportProgress();
}

// ==================== updates ====================
function updateProjectiles(dt) {
  for (const p of bodies) {
    if (p.kind === 'block' || p.dead) continue;
    p.ehitCd = Math.max(0, p.ehitCd - dt);
    p.born += dt;
    if (p.kind === 'tnt') {
      p.fuse += dt;
      if (p.fuse >= 1.2) { queueBoom(p); continue; }
      for (const e of enemies) {
        if (e.dead) continue;
        if (Math.abs(p.x - e.x) < p.halfW + e.w / 2 && Math.abs(p.y - e.y) < p.halfH + e.h / 2) { queueBoom(p); break; }
      }
      if (p.boomQueued) continue;
    }
    if (p.asleep) {
      p.rest += dt;
      if (p.rest > .5) {
        p.dead = true;
        for (let i = 0; i < 5; i++) parts.push({ x: p.x, y: p.y, vx: (Math.random() - .5) * 80, vy: -Math.random() * 80, life: .3, max: .3, color: '#c8c2b8', size: 2, grav: 300, kind: 'dot' });
      }
    }
    if (p.x < -60 || p.x > W + 60 || p.y > H + 80) p.dead = true;
  }
}

function updateFrags(dt) {
  for (let i = frags.length - 1; i >= 0; i--) {
    const f = frags[i];
    f.life -= dt;
    if (f.life <= 0 || f.x < -80 || f.x > W + 80 || f.y > H + 80) { frags.splice(i, 1); continue; }
    f.vy += phys.GRAV * dt;
    f.x += f.vx * dt; f.y += f.vy * dt;
    f.rot += f.vr * dt;
    if (f.y + f.h / 2 > GROUND_Y) {
      f.y = GROUND_Y - f.h / 2;
      f.vy = Math.abs(f.vy) > 120 ? -f.vy * .35 : 0;
      f.vx *= .9; f.vr *= .9;
    }
  }
}

function updateParts(dt) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.life -= dt;
    if (p.life <= 0) { parts.splice(i, 1); continue; }
    p.vy += (p.grav || 0) * dt;
    p.x += p.vx * dt; p.y += p.vy * dt;
    if (p.kind === 'goner' && p.y > GROUND_Y - 6) { p.y = GROUND_Y - 6; p.vy = -p.vy * .3; p.vx *= .8; }
    if (p.rot !== undefined) p.rot += (p.vr || 0) * dt;
  }
  if (parts.length > 260) parts.splice(0, parts.length - 260);
  for (let i = rings.length - 1; i >= 0; i--) {
    const r = rings[i];
    r.t -= dt;
    if (r.t <= 0) { rings.splice(i, 1); continue; }
    r.r += 480 * dt;
  }
  for (let i = floats.length - 1; i >= 0; i--) {
    const fl = floats[i];
    fl.life -= dt * 1.1; fl.y -= 34 * dt;
    if (fl.life <= 0) floats.splice(i, 1);
  }
}

function checkWinFail(dt) {
  if (noAuto || mode !== 'play' || level.sandbox || paused) return;
  const alive = aliveEnemies();
  const busy = bodies.some(b => !b.dead && b.kind !== 'block' && !b.asleep) ||
               bodies.some(b => !b.dead && b.kind === 'block' && !b.asleep && Math.abs(b.vx) + Math.abs(b.vy) > 8);
  if (alive === 0) {
    winT += dt; failT = 0;
    if (winT >= .7) doClear();
  } else if (ammoLeft() === 0 && !busy) {
    failT += dt; winT = 0;
    if (failT >= 2.0) doFail();
  } else {
    winT = 0; failT = 0;
  }
}

function cleanupDead() {
  for (let i = bodies.length - 1; i >= 0; i--) if (bodies[i].dead) bodies.splice(i, 1);
}

function update(dt) {
  playT += dt;
  if (hitstop > 0) { hitstop -= dt; return; }   // hit-stop freezes the world

  phys.step(bodies, dt);
  processBooms();
  updateEnemies(dt);
  updateProjectiles(dt);
  updateFrags(dt);
  updateParts(dt);
  cleanupDead();
  if (shakeT > 0) shakeT -= dt;
  if (flashT > 0) flashT -= dt;
  checkWinFail(dt);
  audio.state(mode === 'play' ? 'battle' : 'calm');
  audio.update();
}

// ==================== render ====================
function render() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.clearRect(0, 0, cv.width, cv.height);
  ctx.save();
  ctx.translate(viewOX, viewOY); ctx.scale(viewScale, viewScale);
  const shk = shakeT > 0 ? Math.min(1, shakeT * 4) : 0;
  const shx = (Math.random() * 2 - 1) * shakeAmp * shk;
  const shy = (Math.random() * 2 - 1) * shakeAmp * shk;
  ctx.translate(shx, shy);

  ctx.drawImage(bgCv, 0, 0, W, H);

  for (const p of phys.platforms) {
    const x = p.cx - p.w / 2, y = p.cy - p.h / 2;
    const g = ctx.createLinearGradient(0, y, 0, y + p.h);
    g.addColorStop(0, '#9aa0a8'); g.addColorStop(1, '#6e747c');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, p.w, p.h);
    ctx.strokeStyle = '#565c64'; ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, p.w - 2, p.h - 2);
    ctx.fillStyle = 'rgba(255,230,180,.3)';
    ctx.fillRect(x, y, p.w, 3);
  }

  for (const b of bodies) if (b.kind === 'block' && !b.dead) drawBlock(ctx, b);
  for (const f of frags) drawFrag(ctx, f);
  for (const b of bodies) if (b.kind !== 'block' && !b.dead) drawProjectile(ctx, b, playT);
  for (const e of enemies) if (!e.dead) drawEnemy(ctx, e, playT);

  let pouchPos = null;
  if (mode === 'play' && aim) {
    const dx = aim.cx - aim.sx, dy = aim.cy - aim.sy;
    const len = Math.hypot(dx, dy) || 1;
    const cl = Math.min(len, BAND_MAX);
    pouchPos = { x: SLING.x + dx / len * cl, y: SLING.y + dy / len * cl };
    const v = cl / BAND_MAX * MAXV;
    const vx = -dx / len * v, vy = -dy / len * v;
    if (len >= MIN_PULL) {
      const pts = predictTrajectory(pouchPos.x, pouchPos.y, vx, vy, 12);
      for (let i = 0; i < pts.length; i++) {
        ctx.globalAlpha = .75 * (1 - i / pts.length) + .1;
        ctx.fillStyle = '#fff4dc';
        ctx.beginPath(); ctx.arc(pts[i].x, pts[i].y, 4 - i * .18, 0, 7); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  } else if (mode === 'play' && !paused && ammo[curKind] > 0) {
    pouchPos = { x: SLING.x, y: SLING.y };
  }
  if (mode === 'play') drawSling(ctx, pouchPos, curKind);

  for (const r of rings) {
    ctx.globalAlpha = r.t / r.max * .8;
    ctx.strokeStyle = '#ffcf7a'; ctx.lineWidth = 5 * (r.t / r.max) + 1.5;
    ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, 7); ctx.stroke();
    ctx.globalAlpha = 1;
  }

  for (const p of parts) {
    const a = Math.max(0, Math.min(1, p.life / p.max));
    ctx.globalAlpha = a;
    if (p.kind === 'star') drawStar(ctx, p.x, p.y, p.size, p.rot || 0, p.color);
    else if (p.kind === 'goner') {
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot || 0);
      ctx.globalAlpha = a * .9;
      ctx.fillStyle = p.color;
      const w = p.ewidth, h = p.eheight;
      if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, 8); ctx.fill(); }
      else ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.restore();
    }
    else if (p.kind === 'smoke') {
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1.6 - a), 0, 7); ctx.fill();
    }
    else {
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, 7); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;

  ctx.textAlign = 'center';
  for (const fl of floats) {
    ctx.globalAlpha = Math.min(1, fl.life * 1.6);
    ctx.font = `700 ${fl.size}px "Microsoft YaHei",sans-serif`;
    ctx.fillStyle = fl.color;
    ctx.strokeStyle = 'rgba(40,20,40,.75)'; ctx.lineWidth = 3;
    ctx.strokeText(fl.text, fl.x, fl.y); ctx.fillText(fl.text, fl.x, fl.y);
  }
  ctx.globalAlpha = 1;

  if (flashT > 0) {
    ctx.fillStyle = `rgba(255,236,200,${flashT * .85})`;
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
    else if (code === 'KeyR') { if (mode === 'play') retry(); }
    else if (code === 'Digit1') pickKind('ball');
    else if (code === 'Digit2') pickKind('tnt');
    else if (code === 'Digit3') pickKind('tri');
    else if (code === 'Escape') { if (mode === 'play') toSelect(); }
  }
  pressed.clear();
}

const inputFlags = { pointerBound: false, keyBound: true };
function toLogical(cx, cy) {
  return { x: (cx - viewOX) / viewScale, y: (cy - viewOY) / viewScale };
}
cv.addEventListener('pointerdown', (e) => {
  inputFlags.pointerBound = true;
  if (mode !== 'play' || paused) return;
  if (!AUTOTEST) audio.ensure();
  const p = toLogical(e.clientX, e.clientY);
  aim = { sx: p.x, sy: p.y, cx: p.x, cy: p.y, pid: e.pointerId };
  audio.sfx.stretch();
  if (cv.setPointerCapture) { try { cv.setPointerCapture(e.pointerId); } catch (err) { } }
});
cv.addEventListener('pointermove', (e) => {
  if (!aim || e.pointerId !== aim.pid) return;
  const p = toLogical(e.clientX, e.clientY);
  aim.cx = p.x; aim.cy = p.y;
});
cv.addEventListener('pointerup', (e) => {
  if (!aim || e.pointerId !== aim.pid) return;
  const p = toLogical(e.clientX, e.clientY);
  aim.cx = p.x; aim.cy = p.y;
  fireFromDrag();
});
cv.addEventListener('pointercancel', () => { aim = null; });
inputFlags.pointerBound = true;

// ==================== G debug hooks ====================
const G = {
  err: window.__BOOTERR,
  W, H, GROUND_Y, SLING, MAXV,
  step: (n = 60, dt = 1 / 60) => { for (let i = 0; i < n; i++) { handleKeys(); if (mode === 'play' && !paused) update(dt); render(); } },
  upd: (n = 30, dt = 1 / 60) => { for (let i = 0; i < n; i++) { handleKeys(); if (mode === 'play' && !paused) update(dt); } },
  press: (...codes) => codes.forEach(c => pressed.add(c)),
  load: (no) => loadLevel(no),
  fire: (angle, power, kind, force = false) => fireAt(kind || curKind, angle, power, force),
  blocks: () => bodies.filter(b => b.kind === 'block'),
  allBodies: () => bodies,
  enemies: () => enemies,
  setNoAuto: (v) => { noAuto = !!v; },
  setReportTarget: (fn) => { reportTarget = fn; },
  setScore: (v) => { score = v | 0; ui.setScore(score); lastProgT = -99; },
  setKind: (k) => { if (PROJ_DEFS[k]) curKind = k; },
  state: () => ({
    mode, paused, level: level.no, levelName: level.name, par: level.par,
    sandbox: !!level.sandbox, score, stars: lastStars, shotsUsed, killCount,
    ammo: { ...ammo }, kind: curKind, enemiesAlive: aliveEnemies(),
    blocks: bodies.filter(b => b.kind === 'block').length,
    projectiles: bodies.filter(b => b.kind !== 'block').length,
    explosions, lastChain, lastKillCause, totalStars: totalStars(),
    winT: +winT.toFixed(2), failT: +failT.toFixed(2), playT: +playT.toFixed(2),
    noAuto, muted,
  }),
  fx: () => ({ parts: parts.length, frags: frags.length, floats: floats.length, rings: rings.length }),
  calcStars, blastDamage, totalStars, chapterUnlocked, levelUnlocked, solveShot, predictTrajectory,
  devSpawnBlock: (mat, x, y, w, h, asleep = true) => {
    const b = makeBlock(mat, x, y, w, h);
    b.asleep = !!asleep;
    b.px = b.x; b.py = b.y;
    bodies.push(b);
    return b;
  },
  devSpawnEnemy: (type, x, feetY) => { const e = makeEnemy(type, x, feetY); enemies.push(e); syncHud(); return e; },
  devDamage: (b, dmg) => damageBlock(b, dmg, null),
  devSetRecord: (no, s, sc) => { records.levels[no] = { s, sc }; persistRecords(); },
  devResetRecords: () => { records = { levels: {} }; persistRecords(); },
  devRestoreBest: (str) => {
    try {
      if (str == null) localStorage.removeItem('sls.best');
      else localStorage.setItem('sls.best', str);
    } catch (e) { }
    try { records = JSON.parse(str || '') || { levels: {} }; } catch (e) { records = { levels: {} }; }
    if (!records || !records.levels) records = { levels: {} };
    ui.setTitleBest(totalStars());
  },
  retry, toSelect, toTitle, forceClear: () => doClear(), forceFail: () => doFail(),
  input: inputFlags,
  audio,
  reports,
  ui,
  startGame: (no) => loadLevel(no),
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
    const savedBestStr = (() => { try { return localStorage.getItem('sls.best'); } catch (e) { return null; } })();
    audio.setMuted(true);
    G.setNoAuto(true);
    G.setReportTarget(f => { });
    await nap();

    // T1 boot clean
    assert(1, G.err.length === 0 && window.__BOOTERR.length === 0, '启动零报错');

    // T2 material strength/density math
    assert(2, MATS.stone.hp > MATS.wood.hp && MATS.wood.hp > MATS.glass.hp &&
           MATS.stone.density > MATS.wood.density && MATS.wood.density > MATS.glass.density,
           '材质强度/密度数学 石>木>玻璃');

    // T3 blast falloff math
    assert(3, G.blastDamage(0) >= MATS.stone.hp &&
           G.blastDamage(60) > MATS.wood.hp && G.blastDamage(60) < MATS.stone.hp &&
           G.blastDamage(150) === 0, '炸药半径伤害衰减数学');

    // T4 24 levels structurally valid
    {
      let ok = LEVELS.length === 24;
      for (const L of LEVELS) {
        const sum = (L.ammo.ball || 0) + (L.ammo.tnt || 0) + (L.ammo.tri || 0);
        if (sum <= 0 || L.par < 1 || L.enemies.length < 2 || L.enemies.length > 5) ok = false;
        for (const b of L.blocks) if (!MATS[b[0]]) ok = false;
        for (const e of L.enemies) if (!ENEMY_TYPES[e[0]]) ok = false;
      }
      assert(4, ok, '24 关数据合法(配给>0/par/敌2-5/材质枚举)');
    }

    // T5 no block overlaps
    {
      let ok = true;
      for (const L of LEVELS) {
        const rects = L.blocks.map(b => [b[1], b[2], b[3], b[4]]);
        for (let i = 0; i < rects.length; i++) {
          if (rects[i][1] + rects[i][3] / 2 > GROUND_Y + 1) ok = false;
          for (let j = i + 1; j < rects.length; j++) {
            const a = rects[i], b = rects[j];
            if (Math.abs(a[0] - b[0]) < (a[2] + b[2]) / 2 - 2 && Math.abs(a[1] - b[1]) < (a[3] + b[3]) / 2 - 2) ok = false;
          }
        }
        for (const p of L.platforms) for (const a of rects) {
          if (Math.abs(a[0] - p[0]) < (a[2] + p[2]) / 2 - 2 && Math.abs(a[1] - p[1]) < (a[3] + p[3]) / 2 - 2) ok = false;
        }
      }
      assert(5, ok, '24 关块不重叠不陷地');
    }

    // T6 enemies supported
    {
      let ok = true;
      const EH = { small: 34, medium: 42, large: 52 }, EW2 = { small: 26, medium: 32, large: 40 };
      for (const L of LEVELS) {
        for (const e of L.enemies) {
          const [type, ex, feetY] = e;
          const w = EW2[type], h = EH[type];
          let sup = feetY >= GROUND_Y - 2 && feetY <= GROUND_Y + 8;
          for (const b of L.blocks) {
            const top = b[2] - b[4] / 2;
            if (feetY >= top - 2 && feetY <= top + 8 && ex + w / 2 > b[1] - b[3] / 2 + 6 && ex - w / 2 < b[1] + b[3] / 2 - 6) sup = true;
            const bx0 = b[1] - b[3] / 2, bx1 = b[1] + b[3] / 2, by0 = b[2] - b[4] / 2, by1 = b[2] + b[4] / 2;
            if (ex + w / 2 > bx0 + 2 && ex - w / 2 < bx1 - 2 && feetY > by0 + 2 && feetY - h < by1 - 2) ok = false;
          }
          for (const p of L.platforms) {
            const top = p[1] - p[3] / 2;
            if (feetY >= top - 2 && feetY <= top + 8 && ex + w / 2 > p[0] - p[2] / 2 + 6 && ex - w / 2 < p[0] + p[2] / 2 - 6) sup = true;
          }
          if (!sup) ok = false;
        }
      }
      assert(6, ok, '24 关敌人均站在支撑面上');
    }

    // T7 structure sleeps
    G.load(1);
    const snap = G.blocks().map(b => ({ b, x: b.x, y: b.y }));
    G.upd(600);
    let disp = 0;
    for (const s of snap) disp = Math.max(disp, Math.abs(s.b.x - s.x), Math.abs(s.b.y - s.y));
    assert(7, disp < 1, `静置结构 600 帧位移 <1px (实际 ${disp.toFixed(3)})`);

    // T8 no NaN after long run
    {
      let nan = false;
      for (const b of bodies) if ([b.x, b.y, b.vx, b.vy].some(isNaN)) nan = true;
      for (const e of enemies) if ([e.x, e.y, e.vx, e.vy].some(isNaN)) nan = true;
      assert(8, !nan, '长跑后数值无 NaN');
    }

    const shoot = (tx, ty, kind = 'ball', r = 32) => {
      const s = G.solveShot(tx, ty, r);
      if (!s) return false;
      return G.fire(s.angle, s.power, kind, true);
    };

    // T9 aim solver produces a trajectory + T10 glass shatters + T13 frags
    G.load(0);
    G.upd(5);
    const gblk = G.devSpawnBlock('glass', 700, 597, 46, 46);
    G.upd(5);
    const okAim = shoot(700, 596);
    G.upd(70);
    assert(9, okAim, '辅助瞄准解算命中弹道');
    assert(10, gblk.dead === true, '命中伤害→玻璃碎裂');
    const fragsAfter = G.fx().frags;
    G.upd(150);
    assert(13, fragsAfter > 0, '碎裂生成 2-4 碎片');

    // T11 wood breaks
    const wblk = G.devSpawnBlock('wood', 700, 597, 46, 46);
    G.upd(10);
    shoot(700, 596);
    G.upd(200);
    assert(11, wblk.dead === true, '命中伤害→木裂(摧毁)');

    // T12 stone only micro-damaged
    const sblk = G.devSpawnBlock('stone', 700, 597, 46, 46);
    G.upd(10);
    shoot(700, 596);
    G.upd(200);
    assert(12, !sblk.dead && sblk.hp < sblk.maxHp && sblk.hp > 0, '命中伤害→石微损不碎');

    // T14 fragments expire
    G.upd(200);
    assert(14, G.fx().frags === 0 && fragsAfter > 0, '碎片寿命 2.5s 后消失');

    // T15/T16 enemy hp decrement then direct kill
    {
      const e = G.devSpawnEnemy('medium', 500, GROUND_Y);
      G.upd(5);
      shoot(515, GROUND_Y - 18);
      G.upd(120);
      assert(15, !e.dead && e.hp === 1, '直击敌人 hp 2→1 递减');
      shoot(e.x, e.y);
      G.upd(60);
      assert(16, e.dead && S().score >= 200 && G.fx().parts > 0, '第二发消灭敌人+得分+粒子');
      G.upd(150);
    }

    // T17 crush kill
    {
      const e = G.devSpawnEnemy('small', 900, GROUND_Y);
      G.devSpawnBlock('stone', 900, 380, 46, 46, false);
      G.upd(100);
      assert(17, e.dead && S().lastKillCause === 'crush', '倒塌块压中敌人消灭');
    }

    // T18 fatal fall
    {
      const blk = G.devSpawnBlock('wood', 700, 400, 46, 46, true);
      const e = G.devSpawnEnemy('small', 700, 377);
      G.upd(20);
      G.devDamage(blk, 999);
      G.upd(140);
      assert(18, e.dead && S().lastKillCause === 'fall', '坠落 >2m 落地消灭');
    }

    // T19 TNT blast damages stone block
    {
      const blk = G.devSpawnBlock('stone', 900, 597, 46, 46);
      const ex0 = S().explosions;
      G.upd(10);
      shoot(900, 590, 'tnt', 40);
      G.upd(150);
      assert(19, S().explosions > ex0 && (blk.dead || blk.hp < blk.maxHp), '炸药命中爆炸半径伤害石块');
    }

    // T20 TNT chain detonation
    {
      const ex0 = S().explosions;
      G.fire(45, 0.5, 'tnt', true);
      G.upd(12);
      G.fire(45, 0.5, 'tnt', true);
      G.upd(170);
      assert(20, S().explosions >= ex0 + 2 && S().lastChain, '炸药链爆(第二颗被冲击波引爆)');
    }

    // T21 triple pearls spread
    {
      G.upd(60);
      const okFire = G.fire(20, 0.6, 'tri', true);
      G.upd(3);
      const pearls = bodies.filter(b => b.kind === 'pearl');
      const vxs = pearls.map(p => p.vx);
      assert(21, okFire && pearls.length === 3 && new Set(vxs.map(v => v.toFixed(1))).size === 3, '三连珠一次三向分散');
      G.upd(150);
    }

    // T22 ammo consumption
    G.load(1);
    {
      const a0 = S().ammo.ball;
      const ok1 = G.fire(30, 0.5, 'ball');
      G.upd(95);
      assert(22, ok1 && S().ammo.ball === a0 - 1 && S().shotsUsed === 1, '发射消耗弹丸配给');
    }

    // T23 drain to empty; empty rejected (deterministic spread so balls land apart)
    {
      let ok = true;
      const angles = [40, 48, 56, 64];
      let ai = 0;
      while (ammoLeft() > 0 && ai < angles.length) {
        ok = G.fire(angles[ai++], 0.5, 'ball') && ok;
        G.upd(95);
      }
      const rejected = G.fire(70, 0.5, 'ball');
      assert(23, ok && rejected === false && ammoLeft() === 0, '弹尽后拒绝发射');
    }

    // T24 out-of-ammo with enemies alive → fail
    G.setNoAuto(false);
    G.upd(520);
    assert(24, S().mode === 'over', '弹尽敌存判负 gameOver');
    G.setNoAuto(true);

    // T25 star math
    assert(25, G.calcStars(2, 2) === 3 && G.calcStars(3, 2) === 2 && G.calcStars(4, 2) === 1 && G.calcStars(9, 3) === 1, '星级 par 数学 3/2/1');

    // T26 level 1 clearable via assisted aim
    G.load(1);
    G.setNoAuto(false);
    {
      let guard = 0, fired = 0;
      while (G.enemies().some(e => !e.dead) && guard++ < 5) {
        const e = G.enemies().find(e => !e.dead);
        const s = G.solveShot(e.x, e.y);
        if (!s) break;
        if (G.fire(s.angle, s.power, 'ball')) fired++;
        G.upd(180);
      }
      assert(26, S().mode === 'clear' && S().enemiesAlive === 0, `第 1 关可通关(G.fire 辅助瞄准解, ${fired} 发)`);
    }

    // T27 3-star settlement + star animation DOM
    {
      const st = S();
      const ons = ui.el.endstars.querySelectorAll('.st.on').length;
      assert(27, st.stars === 3 && st.shotsUsed <= 2 && ons === 3, '清关 3 星结算+金星动画');
    }

    // T28 report frame order
    {
      const kinds = G.reports.map(f => f.kind);
      const iReady = kinds.indexOf('ready');
      const iProg = kinds.indexOf('progress');
      const iEvent = kinds.indexOf('event');
      const iOver = kinds.lastIndexOf('gameOver');
      assert(28, iReady === 0 && iProg > 0 && iEvent > iProg && iOver > iProg, '上报帧序 ready→progress→event/gameOver');
    }

    // T29/T30 best persistence + restore
    {
      let rec = null;
      try { rec = JSON.parse(localStorage.getItem('sls.best') || ''); } catch (e) { }
      assert(29, rec && rec.levels && rec.levels[1] && rec.levels[1].s === 3, 'best 写入 localStorage(总星数+每关)');
      G.devRestoreBest(savedBestStr);
      const after = (() => { try { return localStorage.getItem('sls.best'); } catch (e) { return null; } })();
      assert(30, after === savedBestStr, 'best 测后恢复原值');
    }

    // T31 chapter gates 9 / 18 + per-level unlock (chapterUnlocked takes 0-based chapter index)
    {
      G.devResetRecords();
      G.devSetRecord(1, 3, 100); G.devSetRecord(2, 3, 100);
      const sixLocked = !G.chapterUnlocked(1);                 // 第二章(需9★) 6 星时锁定
      G.devSetRecord(3, 3, 100);
      const nineOpen = G.chapterUnlocked(1) && !G.chapterUnlocked(2);   // 9★ 开二章, 三章仍锁
      for (let n = 4; n <= 8; n++) G.devSetRecord(n, 3, 100);  // 24★
      const twentyFourOpen = G.chapterUnlocked(1) && G.chapterUnlocked(2);
      const lvl2UnlockNeedsPrev = G.levelUnlocked(2) === true;
      G.devResetRecords();
      G.devSetRecord(1, 1, 10);
      const lvl3Locked = G.levelUnlocked(3) === false;
      assert(31, sixLocked && nineOpen && twentyFourOpen && lvl2UnlockNeedsPrev && lvl3Locked, '星数解锁章节门 9/18+逐关解锁');
      G.devRestoreBest(savedBestStr);
    }

    // T32 retry resets level state
    {
      G.load(3);
      const a0 = S().ammo.ball;
      G.fire(30, 0.6, 'ball');
      G.upd(60);
      G.retry();
      const st = S();
      assert(32, st.ammo.ball === a0 && st.score === 0 && st.shotsUsed === 0 && st.enemiesAlive === 2 && st.mode === 'play', '重试复位弹丸/得分/敌人');
    }

    // T33 UI DOM bindings + 24 level buttons
    {
      const okDom = !!(ui.el.retrybtn && ui.el.pausebtn && ui.el.mutebtn && ui.el.amb && ui.el.amt && ui.el.amr &&
        ui.el.title && ui.el.select && ui.el.end && ui.el.pausep && ui.el.next && ui.el.endstars);
      G.toSelect();
      const btns = document.querySelectorAll('#chaplist .lvlbtn').length;
      assert(33, okDom && btns === 24, 'UI(关卡选择 24 按钮/暂停/重试/静音) DOM 存在');
    }

    // T34 select button loads level (unlock 3 first via dev records)
    {
      G.devSetRecord(1, 3, 100);
      G.devSetRecord(2, 3, 100);
      G.toSelect();
      const btn = document.getElementById('lvl-3');
      btn.click();
      await nap();
      assert(34, S().mode === 'play' && S().level === 3, '选关按钮载入第 3 关');
    }

    // T35 pause freezes physics
    {
      G.press('KeyP'); G.upd(2);
      const p1 = S().paused && ui.el.pausep.style.display === 'flex';
      const y0 = G.blocks()[0] ? G.blocks()[0].y : 0;
      G.upd(10);
      const frozen = G.blocks()[0] ? Math.abs(G.blocks()[0].y - y0) < .001 : true;
      G.press('KeyP'); G.upd(2);
      assert(35, p1 && frozen && !S().paused, '暂停冻结物理+面板开合');
    }

    // T36 audio synth
    {
      audio.ensure();
      const hasCtx = audio.hasCtx();
      audio.state('battle');
      const st = audio.state();
      assert(36, hasCtx && st === 'battle' && audio.isMuted() === true, '音频 ctx/状态切换/自测静音');
    }

    // T37/T38 input bindings + key behaviors
    {
      assert(37, G.input.pointerBound === true && G.input.keyBound === true, '触屏/键盘绑定存在');
      G.press('Digit3');
      G.upd(1);
      const kind3 = S().kind;
      G.press('KeyR');
      G.upd(2);
      const st = S();
      assert(38, kind3 === 'tri' && st.ammo.ball === 4 && st.score === 0 && st.shotsUsed === 0, '数字键切换弹药+R 键重试复位');
    }

    // T39 full-session fast-forward on the biggest level
    {
      G.setNoAuto(true);
      G.load(16);
      const errBefore = G.err.length;
      let nan = false, guard = 0;
      while (ammoLeft() > 0 && guard++ < 12) {
        const alive = G.enemies().filter(e => !e.dead);
        const tgt = alive.length ? alive[guard % alive.length] : G.blocks()[0];
        if (!tgt) break;
        const s = G.solveShot(tgt.x, tgt.y, 40);
        if (s) G.fire(s.angle, s.power, 'ball'); else G.fire(45, 0.8, 'ball');
        G.upd(170);
        for (const b of bodies) if ([b.x, b.y, b.vx, b.vy].some(isNaN)) nan = true;
        for (const e of enemies) if ([e.x, e.y].some(isNaN)) nan = true;
      }
      G.upd(400);
      for (const b of bodies) if ([b.x, b.y, b.vx, b.vy].some(isNaN)) nan = true;
      assert(39, !nan && G.err.length === errBefore, '巨堡整局快进无 NaN 无新报错');
    }

    // T40 sandbox long-run stability
    {
      G.load(0);
      G.devSpawnBlock('wood', 900, 597, 46, 46);
      G.devSpawnBlock('wood', 900, 551, 46, 46);
      G.devSpawnBlock('wood', 900, 517, 120, 22);
      G.devSpawnBlock('glass', 990, 597, 46, 46);
      G.devSpawnEnemy('small', 900, 506);
      G.upd(900);
      let nan = false;
      for (const b of bodies) if ([b.x, b.y, b.vx, b.vy].some(isNaN)) nan = true;
      const settled = G.blocks().every(b => b.asleep && Math.abs(b.vy) < .01);
      assert(40, settled && !nan, '沙盒混合体 900 帧休眠稳定无 NaN');
    }

    // T41 back to level select
    {
      G.toSelect();
      assert(41, S().mode === 'select' && !ui.el.select.classList.contains('hide'), '测完回到关卡选择');
    }

    G.devRestoreBest(savedBestStr);
    audio.state('calm');

    const pass = results.filter(r => r.ok).length;
    window.__TEST = { pass, fail: results.length - pass, total: results.length, results, done: true };
    console.log(`[autotest] ${pass}/${results.length} passed`);
  }
}

if (AUTOTEST) autotest();
