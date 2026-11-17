// Abyss Reaper 暗渊割草者 — survivors-like horde roguelite.
// guizang-game-skill methodology, third series #4. Structure mirrors
// orchard-fusion: fixed-step loop, G debug hooks, ?autotest=1 suite,
// site report bridge, WebAudio synth audio, pre-rendered sprites.

import {
  ENEMY_TYPES, ENEMY_CAP, makeSprites, drawSpriteAt, makeEnemy, makeBoss,
  updateEnemy, ringPos, spawnRateAt, pickType, drawEnemy, drawBoss,
} from './enemies.js';
import { WEAPON_DEFS, makeWeaponSystem } from './weapons.js';
import { PASSIVE_DEFS, xpNeed, buildChoices, choiceCard } from './upgrades.js';
import { makeAudio } from './audio.js';
import { makeUI } from './ui.js';

// ==================== constants / layout ====================
const W = 960, H = 560, STEP = 1 / 60;
const PLAYER_R = 12, MAX_HP = 100, BASE_SPEED = 150;
const GEM_CAP = 420, PART_CAP = 320, FLOAT_CAP = 40;

// ==================== state ====================
let mode = 'title';            // title | play | over | win
let paused = false, pending = false, noAuto = false;
let gameT = 0;                 // run clock: schedules/win timer (frozen by noAuto)
let simT = 0;                  // sim clock: combat cooldowns (advances every update)
let kills = 0, level = 1, xp = 0, need = xpNeed(1), hp = MAX_HP;
let invuln = 0, hitstop = 0, shakeT = 0, shakeAmp = 0, hurtFlash = 0, goldFlash = 0;
let spawnAcc = 0, nextWaveAt = 45, nextEliteAt = 90, eliteCount = 0;
let bossSpawned = false, bossKilled = false, boss = null;
let levelUpsQueued = 0, pendingChoices = [], lastProgressMin = -1;
let magnetAll = false;

let best = { time: 0, kills: 0 };
try {
  const b = JSON.parse(localStorage.getItem('abr.best') || '{}');
  best = { time: (b.time | 0) || 0, kills: (b.kills | 0) || 0 };
} catch (e) { }
let muted = false;
try { muted = localStorage.getItem('abr.mute') === '1'; } catch (e) { }

const enemies = [], gems = [], drops = [], bolts = [], bossBullets = [], parts = [], floats = [];
const passives = {};
const stats = { speed: BASE_SPEED, magnet: 90, armorMul: 1, cdrMul: 1 };
const player = { x: W / 2, y: H / 2, r: PLAYER_R };

const sys = makeWeaponSystem();
const audio = makeAudio();
const AUTOTEST = new URLSearchParams(location.search).has('autotest');
const rng = Math.random;

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

// static abyss floor (pre-rendered once)
const bgCv = document.createElement('canvas');
bgCv.width = W * 2; bgCv.height = H * 2;
{
  const c = bgCv.getContext('2d'); c.scale(2, 2);
  const g = c.createRadialGradient(W / 2, H / 2, 60, W / 2, H / 2, W * .72);
  g.addColorStop(0, '#0e1a10'); g.addColorStop(.72, '#0a120a'); g.addColorStop(1, '#050805');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  // faint rune grid
  c.strokeStyle = 'rgba(110,180,100,.06)'; c.lineWidth = 1;
  for (let x = 0; x <= W; x += 80) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); }
  for (let y = 0; y <= H; y += 80) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
  for (let i = 0; i < 26; i++) {   // scattered soul motes
    c.fillStyle = `rgba(150,230,130,${.03 + Math.random() * .05})`;
    const x = Math.random() * W, y = Math.random() * H, r = 1 + Math.random() * 2.4;
    c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
  }
  // vignette
  const v = c.createRadialGradient(W / 2, H / 2, H * .42, W / 2, H / 2, W * .68);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.55)');
  c.fillStyle = v; c.fillRect(0, 0, W, H);
}

// ==================== UI ====================
const ui = makeUI({
  onStart: () => { audio.ensure(); audio.sfx.ui(); startGame(); },
  onRestart: () => { audio.sfx.ui(); startGame(); },
  onBackTitle: () => { audio.sfx.ui(); toTitle(); },
  onMute: () => toggleMute(),
  onPause: () => { audio.sfx.ui(); togglePause(); },
  onChoose: (i) => choose(i),
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
report('ready', { game: 'abyss-reaper' });

// ==================== helpers ====================
const fmtT = (t) => {
  const s = Math.floor(t);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};
function shake(t, amp) { shakeT = Math.max(shakeT, t); shakeAmp = Math.max(shakeAmp, amp); }
function addFloat(x, y, text, color = '#d8f5c0', size = 15) {
  if (floats.length >= FLOAT_CAP) floats.shift();
  floats.push({ x, y, text, color, size, life: 0.9, max: 0.9 });
}
function spawnBurst(x, y, n, color, speed = 180) {
  for (let i = 0; i < n && parts.length < PART_CAP; i++) {
    const a = Math.random() * Math.PI * 2, sp = speed * (.4 + Math.random() * .8);
    parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: .4 + Math.random() * .3, max: .7, color, size: 2 + Math.random() * 3.5 });
  }
}

// ---- spatial grid (uniform hash, rebuilt each frame) ----
const CELL = 52;
const grid = new Map();
const gkey = (cx, cy) => cx * 1024 + cy;
function rebuildGrid() {
  grid.clear();
  for (const e of enemies) {
    const k = gkey(((e.x / CELL) | 0) + 4, ((e.y / CELL) | 0) + 4);
    let a = grid.get(k);
    if (!a) { a = []; grid.set(k, a); }
    a.push(e);
  }
}
function query(x, y, r, cb) {   // centers within r of (x,y)
  const x0 = (((x - r) / CELL) | 0) + 4, x1 = (((x + r) / CELL) | 0) + 4;
  const y0 = (((y - r) / CELL) | 0) + 4, y1 = (((y + r) / CELL) | 0) + 4;
  for (let cx = x0; cx <= x1; cx++) {
    for (let cy = y0; cy <= y1; cy++) {
      const a = grid.get(gkey(cx, cy));
      if (!a) continue;
      for (let i = 0; i < a.length; i++) if (!a[i].dead) cb(a[i]);
    }
  }
}
function nearest(x, y, maxR, exclude) {
  let bestE = null, bd = maxR * maxR;
  for (const e of enemies) {
    if (e.dead || (exclude && (exclude.has ? exclude.has(e.id) : exclude === e))) continue;
    const dx = e.x - x, dy = e.y - y, d2 = dx * dx + dy * dy;
    if (d2 < bd) { bd = d2; bestE = e; }
  }
  return bestE;
}
function nearestK(x, y, n) {
  const arr = [];
  for (const e of enemies) {
    if (e.dead) continue;
    const dx = e.x - x, dy = e.y - y;
    arr.push({ e, d: dx * dx + dy * dy });
  }
  arr.sort((a, b) => a.d - b.d);
  return arr.slice(0, n).map(o => o.e);
}

// weapons ctx (bound each frame — gameT changes)
const wctx = {
  get player() { return player; },
  get stats() { return stats; },
  get W() { return W; }, get H() { return H; },
  get gameT() { return gameT; },
  query, nearest, nearestK,
  damageEnemy, damageBoss, hitBoss, hitBossArea,
  heal: (n) => healPlayer(n),
  sfx: (k) => { if (audio.sfx[k]) audio.sfx[k](); },
};

// ==================== stats / progression ====================
function recomputeStats() {
  stats.speed = BASE_SPEED * (1 + 0.08 * (passives.speed || 0));
  stats.magnet = 90 + 26 * (passives.magnet || 0);
  stats.armorMul = 1 - 0.06 * (passives.armor || 0);
  stats.cdrMul = 1 - 0.05 * (passives.cdr || 0);
}

function giveXp(n) {
  if (mode !== 'play') return;
  xp += n;
  let leveled = false;
  while (xp >= need) {
    xp -= need; level++;
    need = xpNeed(level);
    levelUpsQueued++; leveled = true;
  }
  if (leveled) { audio.sfx.levelup(); goldFlash = 0.5; }
  if (levelUpsQueued > 0 && !pending && mode === 'play' && !paused) openLevelUp();
}

function openLevelUp() {
  pending = true;
  pendingChoices = buildChoices({ weapons: sys.list, passives });
  ui.renderChoices(pendingChoices.map(choiceCard), (i) => choose(i));
  ui.showLevelUp(true);
  audio.sfx.ui();
}

function choose(i) {
  if (!pending || mode !== 'play') return;
  const c = pendingChoices[i];
  if (!c) return;
  pending = false;
  ui.showLevelUp(false);
  levelUpsQueued = Math.max(0, levelUpsQueued - 1);
  applyChoice(c);
  ui.setWeapons(weaponChips());
  if (levelUpsQueued > 0 && !paused && mode === 'play') openLevelUp();
}

function applyChoice(c) {
  switch (c.type) {
    case 'weapon': sys.add(c.id); break;
    case 'upgrade': { const w = sys.find(c.id); if (w) w.lv = Math.min(WEAPON_DEFS[c.id].maxLv, w.lv + 1); break; }
    case 'passive': passives[c.id] = (passives[c.id] || 0) + 1; recomputeStats(); break;
    case 'evolve': {
      sys.evolve(c.id);
      const D = WEAPON_DEFS[c.id];
      ui.showBanner('★ 进化 · ' + D.evo.name, D.evo.desc, 2000, 'gold');
      audio.sfx.evolve();
      report('event', { tag: 'evolve', score: kills });
      break;
    }
    case 'heal': healPlayer(40); break;
    case 'xp': giveXp(30); break;
  }
}

function weaponChips() {
  return sys.list.map(w => ({
    g: WEAPON_DEFS[w.id].glyph, lv: w.lv, evo: w.evolved,
  }));
}

// ==================== damage / kill ====================
function damageEnemy(e, dmg, src, opts = {}) {
  if (e.dead || mode !== 'play') return false;
  if (opts.wcd) {
    const last = e.wcd[src] !== undefined ? e.wcd[src] : -9;
    if (simT - last < opts.wcd) return false;
    e.wcd[src] = simT;
  }
  e.hp -= dmg;
  e.flash = 0.12;
  audio.sfx.hit();
  if (e.hp <= 0) { killEnemy(e); return true; }
  return true;
}

function damageBoss(dmg, opts = {}) {
  if (!boss || boss.dead || mode !== 'play') return false;
  if (opts.wcd) {
    const last = boss.wcd._s !== undefined ? boss.wcd._s : -9;
    if (simT - last < opts.wcd) return false;
    boss.wcd._s = simT;
    if (opts.leech && opts.heal) opts.heal();
    return true;
  }
  boss.hp -= dmg;
  boss.flash = 0.12;
  audio.sfx.hit();
  ui.setBossFrac(boss.hp / boss.maxhp);
  if (boss.hp <= 0) killBoss();
  return true;
}
function hitBoss(x, y, r, dmg, opts = {}) {
  if (!boss || boss.dead) return false;
  const dx = boss.x - x, dy = boss.y - y, rr = r + boss.r;
  if (dx * dx + dy * dy < rr * rr) return damageBoss(dmg, opts);
  return false;
}
function hitBossArea(x, y, r, dmg) {
  if (!boss || boss.dead) return;
  const dx = boss.x - x, dy = boss.y - y, rr = r + boss.r * .5;
  if (dx * dx + dy * dy < rr * rr) damageBoss(dmg);
}

function killEnemy(e) {
  if (e.dead) return;
  e.dead = true;
  kills++;
  gems.push({ x: e.x, y: e.y, v: e.xp, big: e.xp >= 2, spd: 120, bob: Math.random() * 6 });
  if (gems.length > GEM_CAP) { const g = gems.shift(); giveXp(g.v); }   // soft cap: oldest auto-collects
  spawnBurst(e.x, e.y, e.elite ? 18 : 6, e.elite ? '#ffd77a' : '#d84550', e.elite ? 260 : 170);
  addFloat(e.x, e.y - e.r - 4, `+${e.xp}`, e.elite ? '#ffd77a' : '#9fe870', e.elite ? 18 : 12);
  audio.sfx.kill();
  if (e.elite) {
    hitstop = Math.max(hitstop, 0.085);
    shake(0.3, 5);
    audio.sfx.elite();
    if (Math.random() < 0.4) drops.push({ kind: 'heal', x: e.x, y: e.y, bob: Math.random() * 6 });
  } else {
    const r = Math.random();
    if (r < 0.025) drops.push({ kind: 'heal', x: e.x, y: e.y, bob: Math.random() * 6 });
    else if (r < 0.035) drops.push({ kind: 'magnet', x: e.x, y: e.y, bob: Math.random() * 6 });
  }
  // evolved poison: kills inside a plague zone spread it
  for (const z of sys.zones) {
    if (z.slow && (e.x - z.x) ** 2 + (e.y - z.y) ** 2 < z.r * z.r) {
      sys.spawnZone(e.x, e.y, { r: 46, dps: Math.max(6, z.dps * .5), dur: 2, slow: 1 });
      break;
    }
  }
}

function killBoss() {
  if (!boss) return;
  boss.dead = true;
  bossKilled = true;
  hitstop = 0.25;
  shake(0.7, 11);
  goldFlash = 0.5;
  audio.sfx.bossDie();
  spawnBurst(boss.x, boss.y, 46, '#ff8a5c', 380);
  gems.push({ x: boss.x, y: boss.y, v: 40, big: true, spd: 120, bob: 0 });
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2;
    gems.push({ x: boss.x + Math.cos(a) * 60, y: boss.y + Math.sin(a) * 60, v: 2, big: true, spd: 120, bob: Math.random() * 6 });
  }
  boss = null;
  ui.setBoss(null);
  audio.state('fight');
  report('event', { tag: 'bossKill', score: kills });
}

function damagePlayer(dmg, opts = {}) {
  if (mode !== 'play' || pending) return;
  if (!opts.pierce && invuln > 0) return;
  hp -= dmg * stats.armorMul;
  invuln = 0.55;
  hurtFlash = 0.35;
  shake(0.18, 3);
  audio.sfx.hurt();
  if (hp <= 0) { hp = 0; gameOver(); }
}
function healPlayer(n) {
  if (mode !== 'play') return;
  hp = Math.min(MAX_HP, hp + n);
  addFloat(player.x, player.y - 20, `+${n} 生命`, '#7ee87a', 15);
}

function spawnBolt(x, y, vx, vy, dmg) {
  if (bolts.length > 160) return;
  bolts.push({ x, y, vx, vy, r: 6, dmg, life: 5 });
}

// ==================== spawning ====================
function spawnAtRing(kind, elite = false) {
  const pos = ringPos(W, H);
  const e = makeEnemy(kind, pos.x, pos.y, gameT / 60, elite);
  enemies.push(e);
  return e;
}
function spawnWave(tMin) {
  const n = Math.round(10 + 3 * tMin);
  for (let i = 0; i < n && enemies.length < ENEMY_CAP; i++) spawnAtRing(pickType(tMin));
  ui.showToast('怪潮来袭！', 1500);
}
function processSchedule() {
  const tMin = gameT / 60;
  while (gameT >= nextEliteAt) {
    nextEliteAt += 90;
    if (enemies.length < ENEMY_CAP) { spawnAtRing(pickType(tMin), true); eliteCount++; }
    ui.showToast('精英怪来袭！', 1600);
    audio.sfx.warn();
  }
  while (gameT >= nextWaveAt) { nextWaveAt += 45; spawnWave(tMin); }
  if (!bossSpawned && gameT >= 600) spawnBoss();
  const m = Math.floor(gameT / 60);
  if (m > lastProgressMin) { lastProgressMin = m; report('progress', { score: kills, progress: m }); }
}
function spawnBoss(x = W / 2, y = -60) {
  boss = makeBoss(x, y);
  bossSpawned = true;
  ui.setBoss({ name: '终极死神', frac: 1 });
  ui.showBanner('⚠ 终极死神降临 ⚠', '弹幕与冲撞 · 击败它！', 2600, 'danger');
  audio.sfx.bossWarn();
  audio.state('boss');
  shake(0.4, 6);
  report('event', { tag: 'boss', score: kills });
}
function doSpawns(dt) {
  const tMin = gameT / 60;
  spawnAcc += spawnRateAt(tMin) * dt;
  while (spawnAcc >= 1 && enemies.length < ENEMY_CAP) { spawnAcc -= 1; spawnAtRing(pickType(tMin)); }
  processSchedule();
}

// ==================== boss AI ====================
function updateBoss(dt) {
  if (!boss) return;
  boss.flash = Math.max(0, boss.flash - dt * 8);
  const dx = player.x - boss.x, dy = player.y - boss.y;
  const d = Math.hypot(dx, dy) || 1;
  if (boss.phase === 'chase') {
    boss.x += dx / d * boss.spd * dt;
    boss.y += dy / d * boss.spd * dt;
    boss.patT -= dt;
    if (boss.patT <= 0) beginPattern();
  } else if (boss.phase === 'tele') {
    boss.tx = player.x; boss.ty = player.y;
    boss.tele -= dt;
    if (boss.tele <= 0) {
      boss.phase = 'dash'; boss.dashT = 0.85;
      const dd = Math.hypot(player.x - boss.x, player.y - boss.y) || 1;
      boss.vx = (player.x - boss.x) / dd * 440;
      boss.vy = (player.y - boss.y) / dd * 440;
      audio.sfx.warn();
    }
  } else if (boss.phase === 'dash') {
    boss.dashT -= dt;
    boss.x += boss.vx * dt; boss.y += boss.vy * dt;
    if (boss.x < 24) { boss.x = 24; boss.vx = Math.abs(boss.vx); }
    if (boss.x > W - 24) { boss.x = W - 24; boss.vx = -Math.abs(boss.vx); }
    if (boss.y < 24) { boss.y = 24; boss.vy = Math.abs(boss.vy); }
    if (boss.y > H - 24) { boss.y = H - 24; boss.vy = -Math.abs(boss.vy); }
    if (boss.dashT <= 0) endPattern();
  } else if (boss.phase === 'cast') {
    boss.castT -= dt; boss.emT -= dt;
    const i = boss.patIdx;
    if (boss.emT <= 0 && bossBullets.length < 240) {
      if (i === 0) {           // radial volleys
        boss.emT = 0.5; boss.volleys++;
        const base = boss.volleys * 0.35;
        for (let k = 0; k < 14; k++) {
          const a = base + k / 14 * Math.PI * 2;
          bossBullets.push({ x: boss.x, y: boss.y, vx: Math.cos(a) * 130, vy: Math.sin(a) * 130, r: 5, dmg: 9, life: 7 });
        }
        audio.sfx.shoot();
      } else if (i === 1) {    // spiral
        boss.emT = 0.09;
        boss.spiralAng += 0.55;
        for (const s of [0, Math.PI]) {
          bossBullets.push({ x: boss.x, y: boss.y, vx: Math.cos(boss.spiralAng + s) * 150, vy: Math.sin(boss.spiralAng + s) * 150, r: 5, dmg: 9, life: 7 });
        }
      } else if (i === 2) {    // aimed shotgun
        boss.emT = 0.45;
        const a0 = Math.atan2(player.y - boss.y, player.x - boss.x);
        for (let k = -2; k <= 2; k++) {
          const a = a0 + k * 0.22;
          bossBullets.push({ x: boss.x, y: boss.y, vx: Math.cos(a) * 195, vy: Math.sin(a) * 195, r: 5, dmg: 9, life: 7 });
        }
        audio.sfx.shoot();
      }
    }
    if (boss.castT <= 0) endPattern();
  }
  boss.x = Math.max(-30, Math.min(W + 30, boss.x));
  boss.y = Math.max(-30, Math.min(H + 30, boss.y));
}
function beginPattern() {
  boss.patIdx = (boss.patIdx + 1) % 5;
  if (boss.patIdx === 4) { boss.phase = 'tele'; boss.tele = 0.7; return; }
  boss.phase = 'cast';
  boss.emT = 0;
  if (boss.patIdx === 3) {   // ring with a gap, fired once
    boss.castT = 0.35;
    const gap = Math.random() * Math.PI * 2;
    for (let k = 0; k < 24; k++) {
      const a = k / 24 * Math.PI * 2;
      let da = Math.abs(a - gap); da = Math.min(da, Math.PI * 2 - da);
      if (da < 0.5) continue;
      bossBullets.push({ x: boss.x, y: boss.y, vx: Math.cos(a) * 105, vy: Math.sin(a) * 105, r: 5, dmg: 9, life: 7 });
    }
  } else boss.castT = [1.6, 1.7, 0.9][boss.patIdx];
}
function endPattern() { boss.phase = 'chase'; boss.patT = 1.8; }

// ==================== game flow ====================
function resetRun() {
  enemies.length = 0; gems.length = 0; drops.length = 0;
  bolts.length = 0; bossBullets.length = 0; parts.length = 0; floats.length = 0;
  sys.reset(); sys.add('scythe');
  for (const k in passives) delete passives[k];
  recomputeStats();
  gameT = 0; kills = 0; level = 1; xp = 0; need = xpNeed(1); hp = MAX_HP;
  invuln = 0; hitstop = 0; shakeT = 0; hurtFlash = 0; goldFlash = 0;
  spawnAcc = 0; nextWaveAt = 45; nextEliteAt = 90; eliteCount = 0;
  bossSpawned = false; bossKilled = false; boss = null;
  levelUpsQueued = 0; pendingChoices = []; lastProgressMin = -1;
  magnetAll = false;
  player.x = W / 2; player.y = H / 2;
  ui.setBoss(null);
  ui.setWeapons(weaponChips());
}
function startGame() {
  resetRun();
  mode = 'play'; paused = false; pending = false;
  ui.showTitle(false); ui.showEnd(false); ui.showLevelUp(false);
  ui.setPausedIcon(false);
  ui.el.banner.classList.remove('show');
  if (!audio.hasCtx() && !AUTOTEST) audio.ensure();   // autotest: stay ctx-less & silent
  audio.state('fight');
  ui.showToast('移动躲避怪潮，武器自动收割 —— 收集晶石变强！', 2600);
}
function toTitle() {
  mode = 'title'; paused = false; pending = false;
  ui.showTitle(true); ui.showEnd(false); ui.showLevelUp(false);
  ui.setBest(best);
  audio.state('calm');
}
function togglePause() {
  if (mode !== 'play' || pending) return;
  paused = !paused;
  ui.setPausedIcon(paused);
  if (paused) { audio.stop(); ui.showBanner('已暂停', '按 P 或点按继续', 999999); }
  else ui.el.banner.classList.remove('show');
}
function toggleMute() {
  muted = !muted;
  audio.setMuted(muted);
  ui.setMutedIcon(muted);
  try { localStorage.setItem('abr.mute', muted ? '1' : '0'); } catch (e) { }
}
function saveBest() {
  const nbTime = Math.floor(gameT), nbKills = kills;
  const isNew = nbTime > best.time || nbKills > best.kills;
  best.time = Math.max(best.time, nbTime);
  best.kills = Math.max(best.kills, nbKills);
  try { localStorage.setItem('abr.best', JSON.stringify(best)); } catch (e) { }
  ui.setBest(best);
  return isNew;
}
function gameOver() {
  if (mode !== 'play') return;
  mode = 'over';
  audio.stop();
  audio.sfx.lose();
  const isNew = saveBest();
  ui.setEnd('你被暗渊吞噬',
    `存活 ${fmtT(gameT)}\n击杀 ${kills} · 等级 Lv.${level}${isNew ? '  ⭐ 新纪录' : ''}`,
    true);
  ui.showEnd(true);
  report('gameOver', { score: kills, progress: Math.floor(gameT / 60) });
}
function win() {
  if (mode !== 'play') return;
  mode = 'win';
  audio.stop();
  audio.sfx.win();
  saveBest();
  ui.setEnd('死神降临 · 胜利',
    `你守住了暗渊！\n存活 ${fmtT(gameT)} · 击杀 ${kills} · 等级 Lv.${level}`);
  ui.showEnd(true);
  report('complete', { score: kills, progress: Math.max(15, Math.floor(gameT / 60)) });
}
function checkWin() {
  if (mode === 'play' && !pending && gameT >= 900 && bossSpawned && bossKilled) win();
}

// ==================== update ====================
const held = new Set(), once = new Set();
const joyVec = { x: 0, y: 0 };

function moveInput() {
  if (joyVec.x || joyVec.y) return joyVec;
  const x = (held.has('KeyD') || held.has('ArrowRight') ? 1 : 0) - (held.has('KeyA') || held.has('ArrowLeft') ? 1 : 0);
  const y = (held.has('KeyS') || held.has('ArrowDown') ? 1 : 0) - (held.has('KeyW') || held.has('ArrowUp') ? 1 : 0);
  return { x, y };
}
function movePlayer(dt) {
  const v = moveInput();
  const len = Math.hypot(v.x, v.y);
  if (len > 0) {
    const s = stats.speed * Math.min(1, len);
    player.x += v.x / len * s * dt;
    player.y += v.y / len * s * dt;
  }
  player.x = Math.max(14, Math.min(W - 14, player.x));
  player.y = Math.max(14, Math.min(H - 14, player.y));
}

function separation() {
  for (const e of enemies) {
    if (e.dead) continue;
    const cx = ((e.x / CELL) | 0) + 4, cy = ((e.y / CELL) | 0) + 4;
    let checked = 0;
    for (let gx = cx - 1; gx <= cx + 1 && checked < 6; gx++) {
      for (let gy = cy - 1; gy <= cy + 1 && checked < 6; gy++) {
        const a = grid.get(gkey(gx, gy));
        if (!a) continue;
        for (let i = 0; i < a.length; i++) {
          const o = a[i];
          if (o === e || o.dead) continue;
          const dx = o.x - e.x, dy = o.y - e.y;
          const rr = e.r + o.r, d2 = dx * dx + dy * dy;
          if (d2 > 0.0001 && d2 < rr * rr) {
            const d = Math.sqrt(d2), push = (rr - d) * 0.3;
            const ux = dx / d, uy = dy / d;
            e.x -= ux * push; e.y -= uy * push;
            o.x += ux * push; o.y += uy * push;
          }
          if (++checked >= 6) break;
        }
      }
    }
  }
}

function update(dt) {
  if (!noAuto) gameT += dt;
  if (hitstop > 0) { hitstop -= dt; return; }        // brief freeze on elite/boss kills
  simT += dt;                                        // combat clock: advances even under noAuto

  movePlayer(dt);
  if (!noAuto) doSpawns(dt);

  // cull dead from previous frame
  for (let i = enemies.length - 1; i >= 0; i--) if (enemies[i].dead) enemies.splice(i, 1);

  rebuildGrid();
  for (const e of enemies) updateEnemy(e, dt, { player, W, H, spawnBolt });
  separation();
  updateBoss(dt);

  // weapons: fire + projectiles + zones + blades (damage flows through hooks)
  sys.update(dt, wctx);

  // enemy bolts (moth) & boss bullets
  for (let i = bolts.length - 1; i >= 0; i--) {
    const b = bolts[i];
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    const dx = player.x - b.x, dy = player.y - b.y;
    if (dx * dx + dy * dy < (b.r + player.r) * (b.r + player.r)) { damagePlayer(b.dmg); bolts.splice(i, 1); continue; }
    if (b.life <= 0 || b.x < -40 || b.x > W + 40 || b.y < -40 || b.y > H + 40) bolts.splice(i, 1);
  }
  for (let i = bossBullets.length - 1; i >= 0; i--) {
    const b = bossBullets[i];
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    const dx = player.x - b.x, dy = player.y - b.y;
    if (dx * dx + dy * dy < (b.r + player.r) * (b.r + player.r)) { damagePlayer(b.dmg); bossBullets.splice(i, 1); continue; }
    if (b.life <= 0 || b.x < -40 || b.x > W + 40 || b.y < -40 || b.y > H + 40) bossBullets.splice(i, 1);
  }

  // contact damage (enemies near player + boss body)
  query(player.x, player.y, player.r + 30, (e) => {
    const dx = e.x - player.x, dy = e.y - player.y;
    if (dx * dx + dy * dy < (e.r + player.r + 2) * (e.r + player.r + 2)) damagePlayer(e.dmg);
  });
  if (boss) {
    const dx = boss.x - player.x, dy = boss.y - player.y;
    if (dx * dx + dy * dy < (boss.r + player.r + 2) * (boss.r + player.r + 2)) damagePlayer(boss.dmg);
  }

  // gems: magnet attraction + collection
  for (let i = gems.length - 1; i >= 0; i--) {
    const g = gems[i];
    const dx = player.x - g.x, dy = player.y - g.y;
    const d2 = dx * dx + dy * dy;
    const mr = magnetAll ? 99999 : stats.magnet;
    if (d2 < mr * mr) {
      g.spd = Math.min(760, (g.spd || 120) + 980 * dt);
      const d = Math.sqrt(d2) || 1;
      g.x += dx / d * g.spd * dt;
      g.y += dy / d * g.spd * dt;
    }
    if (d2 < (player.r + 7) * (player.r + 7)) {
      giveXp(g.v);
      audio.sfx.pickup();
      spawnBurst(g.x, g.y, 3, '#9fe870', 90);
      gems.splice(i, 1);
    }
  }
  if (magnetAll && gems.length === 0) magnetAll = false;

  // drops: heal / magnet
  for (let i = drops.length - 1; i >= 0; i--) {
    const d = drops[i];
    const dx = player.x - d.x, dy = player.y - d.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < stats.magnet * stats.magnet) {
      const dd = Math.sqrt(d2) || 1;
      d.x += dx / dd * 220 * dt; d.y += dy / dd * 220 * dt;
    }
    if (d2 < (player.r + 12) * (player.r + 12)) {
      if (d.kind === 'heal') { healPlayer(25); audio.sfx.heal(); }
      else {
        magnetAll = true;
        audio.sfx.magnet();
        ui.showBanner('磁石！', '全图晶石向你飞来', 1300);
      }
      drops.splice(i, 1);
    }
  }

  // fx decay
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.life -= dt;
    if (p.life <= 0) { parts.splice(i, 1); continue; }
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vx *= 0.92; p.vy *= 0.92;
  }
  for (let i = floats.length - 1; i >= 0; i--) {
    const f = floats[i];
    f.life -= dt; f.y -= 30 * dt;
    if (f.life <= 0) floats.splice(i, 1);
  }
  if (shakeT > 0) shakeT -= dt;
  if (hurtFlash > 0) hurtFlash -= dt;
  if (goldFlash > 0) goldFlash -= dt;
  if (invuln > 0) invuln -= dt;

  if (!noAuto) checkWin();

  audio.state(boss ? 'boss' : 'fight');
  audio.update();
}

// ==================== render ====================
function render() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.clearRect(0, 0, cv.width, cv.height);
  ctx.save();
  ctx.translate(viewOX, viewOY); ctx.scale(viewScale, viewScale);
  const shx = shakeT > 0 ? (Math.random() * 2 - 1) * shakeAmp * Math.min(1, shakeT * 4) : 0;
  const shy = shakeT > 0 ? (Math.random() * 2 - 1) * shakeAmp * Math.min(1, shakeT * 4) : 0;
  ctx.translate(shx, shy);

  ctx.drawImage(bgCv, 0, 0, W, H);

  sys.draw(ctx, { player, gameT });            // zones under everything

  // gems
  for (const g of gems) {
    const bob = Math.sin(gameT * 5 + g.bob) * 2;
    drawSpriteAt(ctx, g.big ? 'gemBig' : 'gem', g.x, g.y + bob, g.big ? 10 : 7);
  }
  // drops
  for (const d of drops) {
    const bob = Math.sin(gameT * 4 + d.bob) * 3;
    drawSpriteAt(ctx, d.kind, d.x, d.y + bob, 11);
  }
  // enemies
  for (const e of enemies) if (!e.dead) drawEnemy(ctx, e, gameT);
  // boss
  if (boss) drawBoss(ctx, boss, gameT);

  // player (blink while invulnerable)
  const blink = invuln > 0 ? (Math.floor(gameT * 18) % 2 ? 0.45 : 0.95) : 1;
  drawSpriteAt(ctx, 'player', player.x, player.y, PLAYER_R, 0, blink);
  if (goldFlash > 0) {   // level-up halo
    ctx.strokeStyle = `rgba(255,215,122,${goldFlash * 1.1})`;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(player.x, player.y, PLAYER_R + 8 + (0.5 - goldFlash) * 60, 0, Math.PI * 2); ctx.stroke();
  }

  // enemy bolts / boss bullets
  for (const b of bolts) {
    ctx.fillStyle = 'rgba(190,90,220,.9)';
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(240,180,255,.5)';
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 1.8, 0, Math.PI * 2); ctx.fill();
  }
  for (const b of bossBullets) {
    ctx.fillStyle = 'rgba(230,60,70,.95)';
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,120,110,.4)';
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 1.9, 0, Math.PI * 2); ctx.fill();
  }

  // particles + floaters
  for (const p of parts) {
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'center';
  for (const f of floats) {
    ctx.globalAlpha = Math.min(1, f.life * 1.5);
    ctx.font = `700 ${f.size}px "Microsoft YaHei",sans-serif`;
    ctx.fillStyle = f.color;
    ctx.strokeStyle = 'rgba(5,10,6,.8)'; ctx.lineWidth = 3;
    ctx.strokeText(f.text, f.x, f.y); ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;

  if (hurtFlash > 0) {
    ctx.fillStyle = `rgba(220,40,40,${hurtFlash * 0.4})`;
    ctx.fillRect(0, 0, W, H);
  }
  if (goldFlash > 0) {
    ctx.fillStyle = `rgba(255,215,122,${goldFlash * 0.22})`;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.restore();

  // DOM HUD sync
  ui.setHud({ t: fmtT(gameT), kills, lvl: level, hp, maxHp: MAX_HP, xp, need });
  if (boss) ui.setBossFrac(boss.hp / boss.maxhp);
}

// ==================== main loop ====================
let last = performance.now(), acc = 0;
function tick(now) {
  requestAnimationFrame(tick);
  let dt = (now - last) / 1000; last = now;
  if (document.hidden) return;
  dt = Math.min(dt, 1 / 30);
  if (mode === 'play' && !paused && !pending) {
    acc += dt;
    while (acc >= STEP) { update(STEP); acc -= STEP; }
  }
  render();
}
requestAnimationFrame(tick);

// ==================== input ====================
addEventListener('keydown', (e) => {
  if (e.isComposing || e.keyCode === 229) return;
  if (e.metaKey || e.altKey || e.ctrlKey) return;
  held.add(e.code);
  if (!e.repeat) once.add(e.code);
  if (e.code === 'Space' || e.code === 'Tab' || e.code.startsWith('Arrow')) e.preventDefault();
});
addEventListener('keyup', (e) => held.delete(e.code));
addEventListener('blur', () => { held.clear(); });
document.addEventListener('visibilitychange', () => held.clear());

function handleKeys() {
  for (const code of once) {
    if (code === 'KeyP') togglePause();
    else if (code === 'KeyM') toggleMute();
    else if (code === 'Enter') { if (mode === 'title' || mode === 'over' || mode === 'win') startGame(); }
    else if (code === 'Digit1') choose(0);
    else if (code === 'Digit2') choose(1);
    else if (code === 'Digit3') choose(2);
  }
  once.clear();
}

// virtual joystick (pointer = touch/mouse drag on canvas)
let joyActive = false, joyBX = 0, joyBY = 0;
cv.addEventListener('pointerdown', (e) => {
  if (mode !== 'play' || pending) return;
  audio.ensure();
  joyActive = true;
  joyBX = e.clientX; joyBY = e.clientY;
  ui.showJoy(e.clientX, e.clientY, 0, 0);
  if (cv.setPointerCapture) { try { cv.setPointerCapture(e.pointerId); } catch (err) { } }
});
cv.addEventListener('pointermove', (e) => {
  if (!joyActive) return;
  const dx = e.clientX - joyBX, dy = e.clientY - joyBY;
  const d = Math.hypot(dx, dy);
  const cl = Math.min(1, d / 56);
  const nx = d > 0 ? dx / d : 0, ny = d > 0 ? dy / d : 0;
  joyVec.x = nx * cl; joyVec.y = ny * cl;
  ui.showJoy(joyBX, joyBY, nx * cl * 34, ny * cl * 34);
});
function joyEnd() {
  joyActive = false;
  joyVec.x = 0; joyVec.y = 0;
  ui.hideJoy();
}
cv.addEventListener('pointerup', joyEnd);
cv.addEventListener('pointercancel', joyEnd);

// ==================== G debug hooks ====================
// 铁律：G 内改内部状态一律 setXxx / 函数，绝不用 Object.assign 访问器展平。
const G = {
  err: window.__BOOTERR,
  W, H, STEP,
  step: (n = 60, dt = 1 / 60) => { for (let i = 0; i < n; i++) { handleKeys(); if (mode === 'play' && !paused && !pending) update(dt); render(); } },
  upd: (n = 30, dt = 1 / 60) => { for (let i = 0; i < n; i++) { handleKeys(); if (mode === 'play' && !paused && !pending) update(dt); } },
  press: (...codes) => codes.forEach(c => { held.add(c); once.add(c); }),
  clearKeys: () => { held.clear(); once.clear(); },
  setJoy: (dx, dy) => {
    const l = Math.hypot(dx, dy);
    joyVec.x = l > 1 ? dx / l : dx;
    joyVec.y = l > 1 ? dy / l : dy;
  },
  setNoAuto: (v) => { noAuto = !!v; },
  setReportTarget: (fn) => { reportTarget = fn; },
  setScore: (v) => { kills = v | 0; },
  setHp: (v) => { hp = Math.max(0, Math.min(MAX_HP, v)); },

  // gameplay-specific hooks
  spawn: (kind, x, y) => {
    if (kind === 'boss') { spawnBoss(x === undefined ? W / 2 : x, y === undefined ? -60 : y); return boss; }
    const k = kind === 'elite' ? pickType(gameT / 60) : kind;
    const e = makeEnemy(ENEMY_TYPES[k] ? k : 'crawler', x === undefined ? ringPos(W, H).x : x, y === undefined ? ringPos(W, H).y : y, gameT / 60, kind === 'elite');
    enemies.push(e);
    if (kind === 'elite') eliteCount++;
    return e;
  },
  giveDrop: (kind, x, y) => {
    const px = x === undefined ? player.x : x, py = y === undefined ? player.y : y;
    if (kind === 'gem') { const g = { x: px, y: py, v: 1, big: false, spd: 120, bob: Math.random() * 6 }; gems.push(g); return g; }
    const d = { kind: kind === 'heal' ? 'heal' : 'magnet', x: px, y: py, bob: Math.random() * 6 };
    drops.push(d);
    return d;
  },
  giveXp: (n) => giveXp(n),
  giveWeapon: (name, lv) => { const w = sys.add(name); if (lv) sys.setLv(name, lv); ui.setWeapons(weaponChips()); return w; },
  givePassive: (name, lv = 1) => { passives[name] = Math.min(PASSIVE_DEFS[name].max, lv | 0); recomputeStats(); return passives[name]; },
  levelUp: () => { levelUpsQueued++; if (!pending && mode === 'play' && !paused) openLevelUp(); return pending; },
  choose: (i) => choose(i),
  timeJump: (sec) => {
    for (let s = 0; s < sec; s++) { gameT += 1; if (mode === 'play') processSchedule(); }
    if (mode === 'play') checkWin();
    return Math.floor(gameT);
  },
  smite: (target) => {
    if (target === 'boss') return boss ? damageBoss(boss.hp + 1) : false;
    const e = nearest(player.x, player.y, 1e9, null);
    if (!e) return false;
    return damageEnemy(e, e.hp + 1, 'smite');
  },
  hurtPlayer: (d) => damagePlayer(d, { pierce: true }),

  state: () => ({
    mode, paused, pending, noAuto,
    gameT: +gameT.toFixed(2), kills, level, xp: +xp.toFixed(2), xpNeed: need,
    hp: +hp.toFixed(2), maxHp: MAX_HP,
    px: +player.x.toFixed(1), py: +player.y.toFixed(1),
    enemies: enemies.length, gems: gems.length, drops: drops.length,
    bolts: bolts.length, bossBullets: bossBullets.length,
    elites: eliteCount, bossSpawned, bossKilled,
    boss: boss ? { hp: Math.round(boss.hp), maxhp: boss.maxhp, phase: boss.phase } : null,
    weapons: sys.list.map(w => ({
      id: w.id, lv: w.lv, evolved: w.evolved,
      name: w.evolved ? WEAPON_DEFS[w.id].evo.name : WEAPON_DEFS[w.id].name,
      cd: +w.cd.toFixed(3),
    })),
    passives: { ...passives },
    stats: {
      speed: +stats.speed.toFixed(2), magnet: stats.magnet,
      armorMul: +stats.armorMul.toFixed(3), cdrMul: +stats.cdrMul.toFixed(3),
    },
    choices: pendingChoices.map(c => ({ type: c.type, id: c.id || null })),
    magnetAll, best: { ...best },
  }),
  fx: () => ({
    parts: parts.length, floats: floats.length,
    zones: sys.zones.length, proj: sys.projectiles.length, chains: sys.chains.length,
    bossBullets: bossBullets.length, bolts: bolts.length,
  }),
  enemies, gems, drops, audio, ui,
  startGame, toTitle, forceGameOver: () => gameOver(),
};
window.__G = G;
window.addEventListener('error', e => { if (G.err) G.err.push(String(e.message || e)); });

// ==================== autotest suite (?autotest=1) ====================
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
    const savedBestRaw = (function () { try { return localStorage.getItem('abr.best'); } catch (e) { return null; } })();
    const restoreBest = () => {
      try {
        if (savedBestRaw === null) localStorage.removeItem('abr.best');
        else localStorage.setItem('abr.best', savedBestRaw);
      } catch (e) { }
    };
    const frames = [];
    G.setReportTarget(f => frames.push(f));
    const fresh = () => { G.clearKeys(); startGame(); G.setNoAuto(true); };
    const drive = (n) => {   // update loop that survives level-up pauses & death
      for (let i = 0; i < n; i++) {
        if (S().pending) G.choose(0);
        if (S().mode !== 'play') return false;
        G.upd(1);
      }
      return true;
    };
    await nap();

    // -- T1: boot clean
    assert(1, G.err.length === 0, '启动零报错');
    const errBefore = G.err.length;

    // -- T2-T4: movement math
    fresh();
    const p0x = S().px, p0y = S().py;
    G.press('KeyW'); G.upd(30); G.clearKeys();
    assert(2, S().py < p0y - 60 && !isNaN(S().py), 'W 键向上移动 ≈75px 无 NaN');
    G.press('KeyD'); G.upd(30); G.clearKeys();
    assert(3, S().px > p0x + 60, 'D 键向右移动 ≈75px');
    assert(4, Math.abs(S().stats.speed - 150) < 0.01, '基础移速 150');

    // -- T5: scythe auto-targets and damages a fixed enemy
    const e1 = G.spawn('crawler', player.x + 70, player.y);
    const hp1 = e1.hp;
    G.upd(90);
    assert(5, e1.dead || e1.hp < hp1, '镰刃环绕自动索敌伤害落地');

    // -- T6: homing projectile system reaches a far tanky enemy (out of blade reach)
    G.giveWeapon('ghostfire');
    const e2 = G.spawn('shell', player.x + 200, player.y);
    const hp2 = e2.hp;
    G.upd(150);
    assert(6, e2.dead || e2.hp < hp2 - 8, '幽火追踪弹投射物命中远距装甲壳');

    // -- T7: lightning chains onto multiple enemies
    const c1 = G.spawn('crawler', player.x + 90, player.y);
    const c2 = G.spawn('crawler', player.x + 140, player.y + 10);
    const c3 = G.spawn('crawler', player.x + 190, player.y + 20);
    const hpC = [c1.hp, c2.hp, c3.hp];
    G.giveWeapon('lightning');
    G.upd(30);
    const hitN = [c1, c2, c3].filter((e, i) => e.dead || e.hp < hpC[i]).length;
    assert(7, hitN >= 2, `雷链命中 ≥2 个敌人 (实测 ${hitN})`);

    // -- T8/T9: poison zone spawns and deals damage over time
    fresh();
    const e3 = G.spawn('crawler', player.x + 120, player.y);
    const hp3 = e3.hp;
    G.giveWeapon('poison');
    let sawZone = false;
    for (let i = 0; i < 300; i++) { G.upd(1); if (G.fx().zones > 0) sawZone = true; }
    assert(8, sawZone, '毒圈生成于战场');
    assert(9, e3.dead || e3.hp < hp3, '毒圈持续伤害敌人');

    // -- T10: XP gem pickup within magnet radius
    fresh();
    G.giveDrop('gem', player.x + 30, player.y);
    const xp0 = S().xp;
    G.upd(60);
    assert(10, S().xp > xp0, '晶石在吸附半径内被吸取得 XP');

    // -- T11-T14: level-up three-choice flow
    const need0 = S().xpNeed;
    G.giveXp(need0 - S().xp);
    assert(11, S().pending === true && S().choices.length === 3, 'XP 满触发升级三选一');
    assert(12, !ui.el.lvup.classList.contains('hide') && ui.el.lvcards.children.length === 3, '升级面板 DOM 打开且渲染 3 张卡');
    const snap = () => ({
      w: S().weapons.map(w => w.id + w.lv + (w.evolved ? '*' : '')).join('|'),
      p: JSON.stringify(S().passives), h: S().hp, x: S().xp,
    });
    const b0 = snap();
    G.choose(0);
    const a0 = snap();
    assert(13, JSON.stringify(b0) !== JSON.stringify(a0), '选择选项产生实际效果');
    assert(14, S().pending === false && ui.el.lvup.classList.contains('hide'), '选择后面板关闭恢复战斗');

    // -- T15-T17: passives measurably change stats & weapon cooldown
    fresh();
    G.givePassive('speed', 5);
    assert(15, Math.abs(S().stats.speed - 150 * 1.4) < 0.1, '移速被动 5 级 = 210 (+40%)');
    G.givePassive('cdr', 5);
    assert(16, Math.abs(S().stats.cdrMul - 0.75) < 0.001, '冷却缩减 5 级 = 75%');
    G.givePassive('armor', 5);
    const hpB = S().hp;
    G.hurtPlayer(10);
    assert(17, Math.abs((hpB - S().hp) - 7) < 0.01, '护甲减伤 30% 实际生效 (10→7)');
    G.givePassive('magnet', 5);
    assert(17.5, S().stats.magnet === 220, '拾取半径 5 级 = 220');
    G.giveWeapon('ghostfire');
    G.upd(25);
    const gw = S().weapons.find(w => w.id === 'ghostfire');
    assert(17.8, gw && gw.cd > 0 && gw.cd <= 1.3 * 0.75 + 0.01, '冷却缩减实际作用于武器 CD');

    // -- T18/T19: evolution condition & form switch
    fresh();
    G.giveWeapon('scythe', 8);
    G.givePassive('armor', 3);
    G.levelUp();
    const ch = S().choices;
    assert(18, ch.some(c => c.type === 'evolve'), '武器满级+被动≥3 → 进化选项出现');
    const evoIdx = ch.findIndex(c => c.type === 'evolve');
    G.choose(evoIdx);
    const sw = S().weapons.find(w => w.id === 'scythe');
    assert(19, sw && sw.evolved === true && sw.name === '血月大镰', '进化形态切换为血月大镰');

    // -- T20/T21: elite every 90s via timeJump
    fresh();
    G.timeJump(90);
    assert(20, S().elites >= 1, 'timeJump 90s 精英怪出现');
    const el = G.enemies.find(e => e.elite);
    const BT = el && ENEMY_TYPES[el.kind];
    assert(21, el && BT && el.r >= BT.r * 1.6 - 0.01 && el.hp >= BT.hp * 8 * (1 + 0.35 * 1.5) - 0.01, '精英血量×8 体型×1.6（含时间缩放，任意种类）');

    // -- T22/T23: boss at 10min + HP bar
    G.timeJump(510);
    assert(22, S().boss && S().boss.hp > 0, 'timeJump 600s 终极 Boss 出现');
    assert(23, !ui.el.bossbar.classList.contains('hide'), 'Boss 血条 DOM 显示');
    let sawB = 0;
    G.givePassive('armor', 5);   // deterministic survival against random elite mix
    G.setHp(100);
    for (let i = 0; i < 210; i++) {
      if (S().pending) G.choose(0);
      if (i % 20 === 19) G.setHp(100);
      if (S().mode !== 'play') break;
      G.upd(1);
      sawB = Math.max(sawB, G.fx().bossBullets);
    }
    assert(24, sawB > 0, `Boss 弹幕发射 (峰值 ${sawB} 发)`);
    G.smite('boss');
    assert(25, S().boss === null && S().bossKilled === true && ui.el.bossbar.classList.contains('hide'), 'Boss 被击败消失且血条隐藏');

    // -- T26/T27: victory at 15min after boss kill → complete frame
    for (let k = 0; k < 10 && S().pending; k++) G.choose(0);   // drain level-ups opened by the last fight frames
    G.timeJump(400);
    assert(26, S().mode === 'win', '撑过 15min 且 Boss 已亡 → 死神降临胜利');
    assert(27, frames.some(f => f.kind === 'complete'), 'complete 上报帧');

    // -- T28/T29: death settlement
    fresh();
    G.hurtPlayer(9999);
    assert(28, S().mode === 'over', '生命归零 → 结算');
    assert(29, frames.some(f => f.kind === 'gameOver'), 'gameOver 上报帧');

    // -- T30: magnet attracts whole-map gems
    fresh();
    for (let i = 0; i < 8; i++) G.giveDrop('gem', player.x + (i % 2 ? 300 : -300), player.y + (i < 4 ? 200 : -200));
    const g0 = G.gems.length, xpM0 = S().xp;
    G.giveDrop('magnet', player.x + 10, player.y);
    drive(260);
    // 8 gems = 8 XP: 5 consumed by the level-up, 3 left over — deterministic
    assert(30, G.gems.length === 0 && S().level >= 2 && S().xp >= 3, `磁石全图吸取 ${g0} 颗晶石全部入账 (升级消耗计入)`);

    // -- T31: heal drumstick
    G.hurtPlayer(40);
    const hpH = S().hp;
    G.giveDrop('heal', player.x + 10, player.y);
    drive(60);
    assert(31, S().hp > hpH, '鸡腿回血生效');

    // -- T32/T33: separation under stack pressure
    fresh();
    for (let i = 0; i < 40; i++) G.spawn(i % 3 === 0 ? 'dasher' : 'crawler', player.x + 20, player.y + 20);
    let nanS = false, boomS = false;
    for (let i = 0; i < 300; i++) {
      G.upd(1);
      for (const e of G.enemies) {
        if (isNaN(e.x) || isNaN(e.y) || isNaN(e.vx) || isNaN(e.vy)) nanS = true;
        if (Math.abs(e.vx) > 900 || Math.abs(e.vy) > 900) boomS = true;
      }
    }
    assert(32, !nanS, '40 挤叠敌人 300 帧无 NaN');
    assert(33, !boomS, '分离力无速度爆炸');

    // -- T34/T35: 220 enemies, 600 frames, no NaN, perf budget
    fresh();
    for (let i = 0; i < 220; i++) G.spawn(['crawler', 'dasher', 'shell', 'moth'][i % 4], Math.random() * W, Math.random() * H);
    const t0 = Date.now();
    let nanP = false;
    for (let i = 0; i < 600; i++) {
      if (S().pending) G.choose(0);
      if (i % 40 === 39) G.setHp(100);
      G.upd(1);
      if (i % 30 === 0) for (const e of G.enemies) if (isNaN(e.x) || isNaN(e.y) || isNaN(e.hp)) nanP = true;
    }
    const dur = Date.now() - t0;
    assert(34, !nanP, '220 敌 600 帧无 NaN');
    assert(35, dur < 12000, `220 敌 600 帧逻辑耗时 ${dur}ms < 12000ms`);
    G.step(30);
    assert(35.5, G.err.length === errBefore, '220 敌渲染 30 帧无新报错');

    // -- T36: kill drops gem, kills counted, particles spawned
    fresh();
    const ek = G.spawn('crawler', player.x + 80, player.y);
    for (let i = 0; i < 240 && !ek.dead; i++) G.upd(1);
    assert(36, ek.dead && S().kills >= 1 && (G.gems.length > 0 || S().xp >= 1), '击杀掉落晶石/计分');
    assert(36.5, G.fx().parts > 0, '击杀产生粒子特效');

    // -- T37-T40: content definitions & curves
    assert(37, spawnRateAt(0) < spawnRateAt(5) && spawnRateAt(5) < spawnRateAt(10), '刷怪密度随时间单调增长 (1+0.12t/min)');
    assert(38, xpNeed(1) < xpNeed(5) && xpNeed(5) < xpNeed(10), 'XP 曲线单调递增');
    assert(39, Object.keys(WEAPON_DEFS).length === 6 && Object.values(WEAPON_DEFS).every(d => d.maxLv === 8) && Object.keys(PASSIVE_DEFS).length === 4, '6 武器×8 级 + 4 被动×5 级定义完整');
    assert(40, Object.keys(ENEMY_TYPES).length === 4, '4 种基础敌人定义');

    // -- T41/T42: pause freezes the world
    fresh();
    G.spawn('crawler', player.x + 150, player.y);
    G.upd(30);
    const ex0 = G.enemies[0].x;
    G.press('KeyP'); G.upd(20);
    assert(41, S().paused === true && Math.abs(G.enemies[0].x - ex0) < 0.001, '暂停冻结世界');
    G.press('KeyP'); G.upd(5);
    assert(42, S().paused === false, '恢复运行');

    // -- T43: restart resets state
    fresh();
    G.setScore(77);
    G.timeJump(95);
    G.upd(5);
    startGame();
    const st = S();
    assert(43, st.kills === 0 && st.gameT === 0 && st.enemies === 0 && st.level === 1 && st.gems === 0 && st.boss === null && st.elites === 0, '重开一局状态完整复位');

    // -- T44: virtual joystick input
    fresh();
    const jx0 = S().px;
    G.setJoy(1, 0);
    G.upd(20);
    G.setJoy(0, 0);
    assert(44, S().px > jx0 + 40, '虚拟摇杆输入生效');

    // -- T45/T46: UI bindings & weapon chips
    assert(45, ui.el.mutebtn && ui.el.pausebtn && ui.el.start && ui.el.lvup && ui.el.bossbar && ui.el.go && ui.el.go2 && ui.el.wlist, '静音/暂停/开始/升级/Boss 条/结算 UI 元素存在');
    assert(46, ui.el.wlist.children.length === S().weapons.length, '武器栏芯片随持有武器更新');

    // -- T47/T48: audio context & mute state (explicit ensure, stays silent)
    audio.ensure();
    assert(47, audio.hasCtx(), 'AudioContext 可创建（显式）');
    audio.state('boss');
    assert(48, audio.state() === 'boss' && audio.isMuted() === true, 'BGM 状态切换 boss 且自测全程静音');
    audio.state('calm');

    // -- T49: long fast-forward with live spawning — no NaN, no new errors
    G.clearKeys();
    startGame();
    G.setNoAuto(false);
    G.timeJump(540);
    for (let i = 0; i < 600; i++) {
      if (S().pending) G.choose(0);
      if (S().mode !== 'play') break;
      G.upd(1);
    }
    let nanF = false;
    for (const e of G.enemies) if (isNaN(e.x) || isNaN(e.y) || isNaN(e.hp)) nanF = true;
    for (const g of G.gems) if (isNaN(g.x) || isNaN(g.y)) nanF = true;
    assert(49, !nanF && G.err.length === errBefore, 'timeJump 9min + 600 战斗帧无 NaN 无新报错');

    // -- T50: best record write (isolated)
    fresh();
    try { localStorage.setItem('abr.best', '0'); } catch (e) { }
    best = { time: 0, kills: 0 };
    G.timeJump(200);
    G.setScore(123);
    G.hurtPlayer(9999);
    const bNow = (function () { try { return JSON.parse(localStorage.getItem('abr.best') || '{}'); } catch (e) { return {}; } })();
    assert(50, bNow.kills === 123 && bNow.time >= 200, 'best 写入 localStorage (时长+击杀)');

    // -- T51-T53: report frame sequence
    assert(51, reports[0] && reports[0].kind === 'ready', 'ready 上报帧为首帧');
    assert(52, frames.some(f => f.kind === 'progress'), 'progress 上报帧存在 (score/progress=分钟)');
    const lastF = frames[frames.length - 1];
    assert(53, lastF && lastF.kind === 'gameOver', 'gameOver 为当前末帧');
    assert(53.5, frames.every(f => ['ready', 'progress', 'gameOver', 'complete', 'event'].includes(f.kind)), '上报帧种类合法');

    // -- T54: back to title, restore best (again, in case late writes)
    toTitle();
    assert(54, S().mode === 'title' && !ui.el.title.classList.contains('hide'), '测完回到标题画面');
    restoreBest();
    best.time = 0; best.kills = 0;
    try {
      const rb = savedBestRaw === null ? { time: 0, kills: 0 } : JSON.parse(savedBestRaw);
      best = { time: (rb.time | 0) || 0, kills: (rb.kills | 0) || 0 };
    } catch (e) { best = { time: 0, kills: 0 }; }
    ui.setBest(best);

    const pass = results.filter(r => r.ok).length;
    window.__TEST = { pass, fail: results.length - pass, total: results.length, results, done: true };
    console.log(`[autotest] ${pass}/${results.length} passed`);
  }
}

if (new URLSearchParams(location.search).get('autotest')) autotest();
