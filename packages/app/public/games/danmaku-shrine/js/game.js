// Danmaku Shrine 弹幕魔境 — vertical bullet-hell boss rush.
// guizang-game-skill methodology, third series #10. 2D canvas, pooled bullets,
// graze system, bombs, 4 bosses × 2 phases × 2 rotating spells. G hooks +
// ?autotest=1 + site report bridge + WebAudio synth audio.

import { BOSS_LIST, SPELL_LEN } from './bosses.js';
import { makeAudio } from './audio.js';
import { makeUI } from './ui.js';

// ==================== constants ====================
const W = 540, H = 720;
const PLAYER_R = 2.5, GRAZE_R = 13;
const P_SPEED = 265, P_FOCUS = 118;
const BULLET_CAP = 900;
const GRAZE_METER_MAX = 100;
const START_LIVES = 3, START_BOMBS = 3;
const BOSS_Y = 130;

// ==================== state ====================
let mode = 'title', paused = false, noAuto = false, god = false;
let score = 0, bestScore = 0, bestBoss = 0;
let lives, bombs, grazeCount = 0, grazeMeter = 0;
let invulnT = 0, bombFlashT = 0, deathT = 0;
let bossIdx = 0, phaseIdx = 0, spellIdx = 0, spellT = 0, phaseHp = 0, phaseHpMax = 1, phaseT = 0;
let introT = 0, transitionT = 0, captured = false, phaseDied = false;
let playT = 0, time = 0, lastProgressT = 0;
let usedContinue = false;
try {
  bestScore = parseInt(localStorage.getItem('dks.bestScore') || '0') || 0;
  bestBoss = parseInt(localStorage.getItem('dks.bestBoss') || '0') || 0;
} catch (e) { }
let muted = false;
try { muted = localStorage.getItem('dks.mute') === '1'; } catch (e) { }
const AUTOTEST = new URLSearchParams(location.search).has('autotest');

const player = { x: W / 2, y: H - 90, alive: true, focusing: false };
const bullets = [];                 // {x,y,vx,vy,r,type,grazed}
const shots = [];                   // player shots
const parts = [];
let boss = null;                    // {x,y,def,hp,phase,spellIdx,spellT,phaseT,fA,fB,tAcc}
let held = new Set();

const audio = makeAudio();

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

// bullet sprite cache per (type,radius)
const spriteCache = new Map();
function bulletSprite(type, r) {
  const key = type + r;
  if (spriteCache.has(key)) return spriteCache.get(key);
  const pad = 6, size = Math.ceil((r * 2 + pad * 2) * 2);
  const c = document.createElement('canvas'); c.width = size; c.height = size;
  const g = c.getContext('2d'); g.scale(2, 2); g.translate(r + pad, r + pad);
  const colors = { red: '#ff6a5a', blue: '#5ab0ff', purple: '#c07aff', gold: '#ffcf5a', pink: '#ff8ad0', cyan: '#6affd8' };
  const col = colors[type] || colors.red;
  const grad = g.createRadialGradient(0, 0, r * .2, 0, 0, r);
  grad.addColorStop(0, '#ffffff'); grad.addColorStop(.45, col); grad.addColorStop(1, col + '00');
  g.fillStyle = grad; g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill();
  spriteCache.set(key, c);
  return c;
}

// ==================== UI ====================
const ui = makeUI({
  onStart: () => { audio.ensure(); audio.sfx.ui(); startGame(false); },
  onRestart: () => { audio.sfx.ui(); startGame(false); },
  onContinue: () => { audio.sfx.ui(); startGame(true); },
  onBackTitle: () => { audio.sfx.ui(); toTitle(); },
  onMute: () => toggleMute(),
  onPause: () => { audio.sfx.ui(); togglePause(); },
});
ui.setBest(bestScore, bestBoss);
ui.showTitle(true);
ui.setMutedIcon(muted);
audio.setMuted(muted);

// ==================== protocol ====================
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
report('ready', { game: 'danmaku-shrine' });

// ==================== flow ====================
function resetRun(keepBoss) {
  bullets.length = 0; shots.length = 0; parts.length = 0;
  held.clear();
  lives = START_LIVES; bombs = START_BOMBS;
  grazeCount = 0; grazeMeter = 0;
  invulnT = 3; bombFlashT = 0; deathT = 0;
  player.x = W / 2; player.y = H - 90; player.alive = true;
  if (!keepBoss) { bossIdx = 0; score = 0; usedContinue = false; }
  phaseIdx = 0; spellIdx = 0; spellT = 0; phaseT = 0;
  captured = false; phaseDied = false; transitionT = 0;
  spawnBoss(bossIdx);
  ui.setScore(score); ui.setLives(lives); ui.setBombs(bombs); ui.setGraze(0, 0);
}
function startGame(continuing) {
  if (continuing) {
    usedContinue = true;
    score = Math.floor(score * .7);            // 30% penalty
    lives = START_LIVES; bombs = START_BOMBS;
    invulnT = 3; deathT = 0;
    player.x = W / 2; player.y = H - 90; player.alive = true;
    bullets.length = 0; shots.length = 0; held.clear();
    spellIdx = 0; spellT = 0; phaseT = 0;
    spawnBoss(bossIdx);
    ui.setScore(score); ui.setLives(lives); ui.setBombs(bombs);
    mode = 'play'; paused = false;
    ui.showTitle(false); ui.showEnd(false); ui.setPausedIcon(false);
    ui.showBoss(true);
    return;
  }
  resetRun(false);
  mode = 'play'; paused = false;
  ui.showTitle(false); ui.showEnd(false); ui.setPausedIcon(false);
  if (!audio.hasCtx() && !AUTOTEST) audio.ensure();
}
function toTitle() {
  mode = 'title'; paused = false;
  ui.showTitle(true); ui.showEnd(false); ui.showBoss(false);
  ui.setBest(bestScore, bestBoss);
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
  try { localStorage.setItem('dks.mute', muted ? '1' : '0'); } catch (e) { }
}

function addScore(n) {
  score += Math.round(n);
  ui.setScore(score);
  if (playT - lastProgressT > 8) { lastProgressT = playT; report('progress', { score, progress: bossIdx }); }
}

// ==================== bullets ====================
function spawnBullet(x, y, vx, vy, r = 5, type = 'red') {
  if (bullets.length >= BULLET_CAP) bullets.shift();
  bullets.push({ x, y, vx, vy, r, type, grazed: false });
}
function clearBullets(scoreSparks) {
  if (scoreSparks) for (const b of bullets) addScore(5);
  bullets.length = 0;
}

// pattern helpers (bx,by = boss position)
const aimAt = (x, y, tx, ty, sp) => { const d = Math.hypot(tx - x, ty - y) || 1; return [ (tx - x) / d * sp, (ty - y) / d * sp ]; };
function ring(x, y, n, sp, type, r, phase = 0) {
  for (let i = 0; i < n; i++) {
    const a = phase + i / n * Math.PI * 2;
    spawnBullet(x, y, Math.cos(a) * sp, Math.sin(a) * sp, r, type);
  }
}
function fan(x, y, n, sp, center, spread, type, r) {
  for (let i = 0; i < n; i++) {
    const a = center + (i / (n - 1) - .5) * spread;
    spawnBullet(x, y, Math.cos(a) * sp, Math.sin(a) * sp, r, type);
  }
}

// spell pattern implementations — fire per-frame using boss timers
const SPELLS = {
  // —— Boss1 phase1
  '绯扇': (b, dt) => {
    b.tAcc += dt;
    if (b.tAcc > .55) {
      b.tAcc = 0;
      fan(b.x, b.y, 7, 150 + bossIdx * 8, Math.atan2(player.y - b.y, player.x - b.x), 1.1, 'red', 5.5);
      ring(b.x, b.y, 14, 95, 'pink', 4, b.fA += .31);
      audio.sfx.bossShot();
    }
  },
  '赤环': (b, dt) => {
    b.tAcc += dt;
    if (b.tAcc > .8) {
      b.tAcc = 0;
      ring(b.x, b.y, 20, 120, 'red', 5, b.fA += .5);
      fan(b.x, b.y, 3, 200, Math.atan2(player.y - b.y, player.x - b.x), .35, 'gold', 6);
      audio.sfx.bossShot();
    }
  },
  // —— Boss1 phase2
  '焰螺旋': (b, dt) => {
    b.fB += dt;
    b.tAcc += dt;
    if (b.tAcc > .09) {
      b.tAcc = 0;
      const a = b.fA += .42;
      spawnBullet(b.x, b.y, Math.cos(a) * 140, Math.sin(a) * 140, 5, 'red');
      spawnBullet(b.x, b.y, Math.cos(a + Math.PI) * 140, Math.sin(a + Math.PI) * 140, 5, 'red');
      spawnBullet(b.x, b.y, Math.cos(-a * 1.3) * 165, Math.sin(-a * 1.3) * 165, 4.5, 'gold');
    }
  },
  '红雹': (b, dt) => {
    b.tAcc += dt;
    if (b.tAcc > .3) {
      b.tAcc = 0;
      for (let i = 0; i < 5; i++) spawnBullet(b.x + (Math.random() - .5) * 220, b.y - 30, 0, 170 + Math.random() * 90, 5.5, 'pink');
      fan(b.x, b.y, 5, 170, Math.atan2(player.y - b.y, player.x - b.x), .9, 'red', 5.5);
      audio.sfx.bossShot();
    }
  },
  // —— Boss2 phase1
  '十字岚': (b, dt) => {
    b.tAcc += dt;
    if (b.tAcc > .5) {
      b.tAcc = 0;
      for (let k = 0; k < 4; k++) {
        const base = k * Math.PI / 2 + b.fA;
        for (let i = -2; i <= 2; i++) {
          const a = base + i * .12;
          spawnBullet(b.x, b.y, Math.cos(a) * 160, Math.sin(a) * 160, 5, 'blue');
        }
      }
      b.fA += .25;
      audio.sfx.bossShot();
    }
  },
  '跳弹碎屑': (b, dt) => {
    b.tAcc += dt;
    if (b.tAcc > .42) {
      b.tAcc = 0;
      for (let i = 0; i < 4; i++) {
        const a = Math.random() * Math.PI * 2;
        spawnBullet(b.x, b.y, Math.cos(a) * 180, Math.sin(a) * 180, 4.5, 'cyan', true);
      }
      audio.sfx.bossShot();
    }
  },
  // —— Boss2 phase2
  '苍雨': (b, dt) => {
    b.tAcc += dt;
    if (b.tAcc > .16) {
      b.tAcc = 0;
      spawnBullet(Math.random() * W, -10, (Math.random() - .5) * 40, 190 + Math.random() * 110, 5, 'blue');
      if (Math.random() < .4) fan(b.x, b.y, 3, 190, Math.atan2(player.y - b.y, player.x - b.x), .3, 'cyan', 6);
    }
  },
  '疾风连弩': (b, dt) => {
    b.tAcc += dt;
    if (b.tAcc > .34) {
      b.tAcc = 0;
      const [vx, vy] = aimAt(b.x, b.y, player.x, player.y, 240);
      spawnBullet(b.x, b.y, vx, vy, 6, 'blue');
      ring(b.x, b.y, 10, 110, 'cyan', 4.5, b.fA += .4);
      audio.sfx.bossShot();
    }
  },
  // —— Boss3 phase1
  '蝶舞回廊': (b, dt) => {
    b.tAcc += dt;
    if (b.tAcc > .24) {
      b.tAcc = 0;
      const a = b.fA += .5;
      for (let k = 0; k < 2; k++) {
        spawnBullet(b.x, b.y, Math.cos(a + k * Math.PI) * 130, Math.sin(a + k * Math.PI) * 130 * .6 + 60, 5.5, 'purple');
      }
      ring(b.x, b.y, 12, 100, 'pink', 4.5, b.fB += .27);
    }
  },
  '诱引花瓣': (b, dt) => {
    b.tAcc += dt;
    if (b.tAcc > .6) {
      b.tAcc = 0;
      const [vx, vy] = aimAt(b.x, b.y, player.x, player.y, 120);
      spawnBullet(b.x, b.y, vx, vy, 6, 'purple', false, .9);     // homing
      fan(b.x, b.y, 8, 135, Math.PI / 2, 1.4, 'pink', 5);
      audio.sfx.bossShot();
    }
  },
  // —— Boss3 phase2
  '夜之帘': (b, dt) => {
    b.tAcc += dt;
    if (b.tAcc > .5) {
      b.tAcc = 0;
      b.fA += .18;
      for (let i = 0; i < 9; i++) {
        const x = (i + .5) / 9 * W + Math.sin(b.fA) * 34;
        spawnBullet(x, -8, 0, 150 + (i % 3) * 26, 5.5, 'purple');
      }
    }
  },
  '双蝶螺旋': (b, dt) => {
    b.tAcc += dt;
    if (b.tAcc > .1) {
      b.tAcc = 0;
      const a = b.fA += .34;
      for (const off of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
        spawnBullet(b.x, b.y, Math.cos(a + off) * 150, Math.sin(a + off) * 150, 5, 'purple');
      }
    }
  },
  // —— Boss4 phase1
  '黄金涡': (b, dt) => {
    b.tAcc += dt;
    if (b.tAcc > .12) {
      b.tAcc = 0;
      const a = b.fA += .38;
      for (const off of [0, Math.PI]) {
        spawnBullet(b.x, b.y, Math.cos(a + off) * 165, Math.sin(a + off) * 165, 5.5, 'gold');
      }
      if (Math.random() < .3) fan(b.x, b.y, 5, 160, Math.atan2(player.y - b.y, player.x - b.x), .8, 'red', 5.5);
    }
  },
  '魔界壁': (b, dt) => {
    b.tAcc += dt;
    if (b.tAcc > .62) {
      b.tAcc = 0;
      const gap = Math.random() * (W - 130) + 65;
      for (let i = 0; i < 12; i++) {
        const x = (i + .5) / 12 * W;
        if (Math.abs(x - gap) < 62) continue;
        spawnBullet(x, -8, 0, 165, 6, 'gold');
      }
      fan(b.x, b.y, 6, 140, Math.atan2(player.y - b.y, player.x - b.x), 1, 'red', 5.5);
      audio.sfx.bossShot();
    }
  },
  // —— Boss4 phase2
  '终焉螺旋': (b, dt) => {
    b.tAcc += dt;
    if (b.tAcc > .08) {
      b.tAcc = 0;
      const a = b.fA += .44;
      for (const off of [0, Math.PI * 2 / 3, Math.PI * 4 / 3]) {
        spawnBullet(b.x, b.y, Math.cos(a + off) * 160, Math.sin(a + off) * 160, 5, 'gold');
      }
    }
  },
  '无名狂想': (b, dt) => {
    b.tAcc += dt;
    if (b.tAcc > .38) {
      b.tAcc = 0;
      const [vx, vy] = aimAt(b.x, b.y, player.x, player.y, 230);
      spawnBullet(b.x, b.y, vx, vy, 6.5, 'red');
      ring(b.x, b.y, 16, 130, 'purple', 5, b.fA += .5);
      audio.sfx.bossShot();
    }
  },
};

// homing bullets: type flag via r>5.8 purple? — use explicit list
const homing = new Set();
const origSpawn = spawnBullet;
spawnBullet = function (x, y, vx, vy, r = 5, type = 'red', bounce = false, home = false) {
  origSpawn(x, y, vx, vy, r, type);
  const b = bullets[bullets.length - 1];
  if (bounce) b.bounce = true;
  if (home) homing.add(b);
};

// ==================== boss ====================
function spawnBoss(idx) {
  const def = BOSS_LIST[idx];
  const ph = def.phases[phaseIdx];
  phaseHpMax = ph.hp; phaseHp = ph.hp; phaseT = ph.dur; spellT = SPELL_LEN;
  spellIdx = 0;
  boss = { x: W / 2, y: -40, ty: BOSS_Y, def, hp: ph.hp, fA: 0, fB: 0, tAcc: 0, entering: true };
  captured = false; phaseDied = false;
  clearBullets(false);
  ui.showBoss(true);
  ui.setBoss(def.short, 1, ph.spells[0]);
  audio.state('boss');
  if (!noAuto) { introT = 1.6; ui.showBanner(def.name, `第 ${phaseIdx + 1} 相 · ${ph.spells[0]}`, 1600); }
  else introT = 0;
}

function bossDamage(d) {
  if (!boss || boss.entering || transitionT > 0) return;
  phaseHp -= d;
  addScore(d * 2);
  if (phaseHp <= 0) {
    // phase cleared by kill
    addScore(10000 * (bossIdx + 1) * (phaseIdx + 1) * .5);
    endPhase(true);
  }
}
function endPhase(killed) {
  transitionT = 1.4;
  clearBullets(true);
  if (killed) audio.sfx.bosskill();
  else { audio.sfx.capture(); if (!phaseDied) { addScore(5000 * (bossIdx + 1)); ui.showBanner('符卡收取！', `+${5000 * (bossIdx + 1)}`, 1600); report('event', { tag: 'capture', boss: bossIdx, phase: phaseIdx }); } }
  if (phaseIdx === 0) {
    phaseIdx = 1;
  } else {
    // boss defeated
    if (bossIdx >= BOSS_LIST.length - 1) {
      // game complete!
      mode = 'over';
      audio.sfx.bosskill(); audio.stop();
      const isNew = score > bestScore;
      if (isNew) bestScore = score;
      bestBoss = BOSS_LIST.length - 1;
      try { localStorage.setItem('dks.bestScore', String(bestScore)); localStorage.setItem('dks.bestBoss', String(bestBoss)); } catch (e) { }
      ui.setBest(bestScore, bestBoss);
      ui.setEnd('魔境制压！', `得分 ${score}${isNew ? ' ⭐ 新纪录' : `\n纪录 ${bestScore}`}\n四魔尽讨 · 擦弹 ${grazeCount} 枚`);
      ui.showEnd(true);
      report('complete', { score, progress: BOSS_LIST.length });
      ui.showBoss(false);
      boss = null;
      return;
    }
    bossIdx++;
    phaseIdx = 0;
    if (bossIdx > bestBoss) { bestBoss = bossIdx; try { localStorage.setItem('dks.bestBoss', String(bestBoss)); } catch (e) { } }
    report('progress', { score, progress: bossIdx });
  }
  spawnBoss(bossIdx);
}

function updateBoss(dt) {
  if (transitionT > 0) {
    transitionT -= dt;
    if (transitionT <= 0) transitionT = 0;
    return;
  }
  if (introT > 0) { introT -= dt; return; }
  if (!boss) return;
  // enter
  if (boss.entering) {
    boss.y += (boss.ty - boss.y) * Math.min(1, 3 * dt);
    if (Math.abs(boss.y - boss.ty) < 2) boss.entering = false;
    return;
  }
  // drift
  boss.x = W / 2 + Math.sin(time * .7 + bossIdx) * (120 + bossIdx * 14);
  boss.y = BOSS_Y + Math.sin(time * 1.1) * 16;
  // spell timer
  spellT -= dt;
  phaseT -= dt;
  const ph = boss.def.phases[phaseIdx];
  const spell = SPELLS[ph.spells[spellIdx]];
  if (spell) spell(boss, dt);
  if (spellT <= 0) {
    spellIdx++;
    spellT = SPELL_LEN;
    clearBullets(true);
    if (spellIdx >= ph.spells.length) spellIdx = ph.spells.length - 1;   // last spell loops
    ui.setBoss(boss.def.short, phaseHp / phaseHpMax, ph.spells[spellIdx]);
  }
  if (phaseT <= 0) {
    // survived the phase → capture (advance regardless of hp)
    endPhase(false);
    return;                                  // boss may be null after final kill
  }
  ui.setBoss(boss.def.short, Math.max(0, phaseHp / phaseHpMax), ph.spells[spellIdx]);
}

// ==================== player ====================
function updatePlayer(dt) {
  if (!player.alive) {
    deathT -= dt;
    if (deathT <= 0 && lives >= 0) { player.alive = true; player.x = W / 2; player.y = H - 90; invulnT = 3; }
    return;
  }
  if (invulnT > 0) invulnT -= dt;
  player.focusing = held.has('ShiftLeft') || held.has('ShiftRight');
  const sp = player.focusing ? P_FOCUS : P_SPEED;
  let dx = 0, dy = 0;
  if (held.has('ArrowLeft') || held.has('KeyA')) dx -= 1;
  if (held.has('ArrowRight') || held.has('KeyD')) dx += 1;
  if (held.has('ArrowUp') || held.has('KeyW')) dy -= 1;
  if (held.has('ArrowDown') || held.has('KeyS')) dy += 1;
  if (dx && dy) { dx *= .7071; dy *= .7071; }
  player.x = Math.max(14, Math.min(W - 14, player.x + dx * sp * dt));
  player.y = Math.max(20, Math.min(H - 20, player.y + dy * sp * dt));
  // auto-fire
  shotT -= dt;
  if (shotT <= 0) {
    shotT = player.focusing ? .09 : .12;
    const spread = player.focusing ? [0] : [-.12, 0, .12];
    for (const s of spread) shots.push({ x: player.x + s * 30, y: player.y - 14, vx: Math.sin(s) * 620, vy: -620 });
  }
}

let shotT = 0;

function updateShots(dt) {
  for (let i = shots.length - 1; i >= 0; i--) {
    const s = shots[i];
    s.x += s.vx * dt; s.y += s.vy * dt;
    if (s.y < -20) { shots.splice(i, 1); continue; }
    // hit boss
    if (boss && !boss.entering && transitionT <= 0 && introT <= 0) {
      const d = Math.hypot(s.x - boss.x, s.y - boss.y);
      if (d < 52) {
        bossDamage(player.focusing ? 15 : 11);
        shots.splice(i, 1);
        parts.push({ x: s.x, y: s.y, vx: (Math.random() - .5) * 80, vy: (Math.random() - .5) * 80, life: .3, max: .3, color: '#aee8ff', size: 3, grav: 0 });
        continue;
      }
    }
  }
}

function killPlayer() {
  if (god || invulnT > 0 || !player.alive) return;
  player.alive = false;
  deathT = 1.1;
  lives--;
  phaseDied = true;
  clearBullets(false);
  audio.sfx.death();
  if (lives < 0) {
    gameOver();
  } else {
    ui.setLives(lives);
  }
}

function useBomb() {
  if (bombs <= 0 || !player.alive) return;
  bombs--;
  invulnT = 2.5;
  bombFlashT = .5;
  clearBullets(true);
  audio.sfx.bomb();
  world_flash = .4;
  ui.setBombs(bombs);
}

let world_flash = 0;

function checkBullets(dt) {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    // homing curve
    if (homing.has(b)) {
      const [tx, ty] = aimAt(b.x, b.y, player.x, player.y, 60);
      b.vx += tx * dt * 2.2; b.vy += ty * dt * 2.2;
      if (b.y > H + 60) homing.delete(b);
    }
    b.x += b.vx * dt; b.y += b.vy * dt;
    // bounce type
    if (b.bounce) {
      if (b.x < 6 || b.x > W - 6) { b.vx *= -1; b.x = Math.max(6, Math.min(W - 6, b.x)); }
      if (b.y < 6) { b.vy = Math.abs(b.vy); }
    }
    if (b.x < -50 || b.x > W + 50 || b.y < -60 || b.y > H + 60) {
      bullets.splice(i, 1); homing.delete(b);
      continue;
    }
    if (god || !player.alive) continue;
    const d = Math.hypot(b.x - player.x, b.y - player.y);
    if (d < b.r + PLAYER_R) {
      bullets.splice(i, 1); homing.delete(b);
      killPlayer();
      return;                    // killPlayer cleared the whole array — stop iterating
    }
    if (!b.grazed && d < GRAZE_R + b.r) {
      b.grazed = true;
      grazeCount++;
      addScore(10);
      grazeMeter += 1;
      audio.sfx.graze();
      if (grazeMeter >= GRAZE_METER_MAX) {
        grazeMeter = 0;
        bombs++;
        audio.sfx.extend();
        ui.showToast('擦弹槽满 · 灵击 +1');
        ui.setBombs(bombs);
      }
      ui.setGraze(grazeCount, grazeMeter);
    }
  }
}

function gameOver() {
  mode = 'over';
  audio.stop();
  const isNew = score > bestScore;
  if (isNew) bestScore = score;
  if (bossIdx > bestBoss) bestBoss = bossIdx;
  try { localStorage.setItem('dks.bestScore', String(bestScore)); localStorage.setItem('dks.bestBoss', String(bestBoss)); } catch (e) { }
  ui.setBest(bestScore, bestBoss);
  ui.setEnd(isNew ? '虽败犹荣' : '魔境长眠',
    `得分 ${score}${isNew ? ' ⭐ 新纪录' : `\n纪录 ${bestScore}`}\n到达 ${BOSS_LIST[bossIdx].short} · 擦弹 ${grazeCount} 枚`);
  ui.showEnd(true);
  report('gameOver', { score, progress: bossIdx });
  ui.showBoss(false);
}

// ==================== update ====================
function update(dt) {
  time += dt; playT += dt;
  updatePlayer(dt);
  updateShots(dt);
  updateBoss(dt);
  checkBullets(dt);
  if (bombFlashT > 0) bombFlashT -= dt;
  if (world_flash > 0) world_flash -= dt;
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.life -= dt;
    if (p.life <= 0) { parts.splice(i, 1); continue; }
    p.vy += (p.grav || 0) * dt; p.x += p.vx * dt; p.y += p.vy * dt;
  }
  audio.state(boss && !boss.entering ? 'boss' : 'fight');
  audio.update();
}

// ==================== render ====================
function render() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.clearRect(0, 0, cv.width, cv.height);
  ctx.save();
  ctx.translate(viewOX, viewOY); ctx.scale(viewScale, viewScale);

  // background
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#1a0f22'); bg.addColorStop(1, '#0a0812');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  // scrolling torii silhouettes
  ctx.fillStyle = 'rgba(40,24,34,.55)';
  for (let i = 0; i < 4; i++) {
    const y = ((time * 26 + i * 220) % (H + 160)) - 80;
    const w = 90 + (i % 2) * 30;
    ctx.fillRect(W / 2 - w / 2, y, 14, 60);
    ctx.fillRect(W / 2 + w / 2 - 14, y, 14, 60);
    ctx.fillRect(W / 2 - w / 2 - 12, y, w + 24, 12);
  }
  // side seals
  ctx.fillStyle = 'rgba(255,120,90,.05)';
  ctx.fillRect(0, 0, 10, H); ctx.fillRect(W - 10, 0, 10, H);

  // boss
  if (boss) {
    ctx.save();
    ctx.translate(boss.x, boss.y);
    const pulse = 1 + Math.sin(time * 4) * .04;
    ctx.scale(pulse, pulse);
    // body
    const grad = ctx.createRadialGradient(0, -8, 6, 0, 0, 40);
    grad.addColorStop(0, boss.def.accent); grad.addColorStop(.6, boss.def.color); grad.addColorStop(1, 'rgba(20,10,20,0)');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(0, 0, 40, 0, Math.PI * 2); ctx.fill();
    // mask
    ctx.fillStyle = '#f0e8dc';
    ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1a0f22';
    ctx.beginPath(); ctx.arc(-5.5, -2, 2.6, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(5.5, -2, 2.6, 0, Math.PI * 2); ctx.fill();
    // horns
    ctx.fillStyle = boss.def.accent;
    ctx.beginPath(); ctx.moveTo(-13, -12); ctx.lineTo(-19, -27); ctx.lineTo(-7, -16); ctx.fill();
    ctx.beginPath(); ctx.moveTo(13, -12); ctx.lineTo(19, -27); ctx.lineTo(7, -16); ctx.fill();
    ctx.restore();
  }

  // player shots
  ctx.fillStyle = '#aee8ff';
  for (const s of shots) { ctx.fillRect(s.x - 2, s.y - 7, 4, 12); }

  // bullets
  for (const b of bullets) {
    const sp = bulletSprite(b.type, b.r);
    ctx.drawImage(sp, b.x - sp.width / 4, b.y - sp.height / 4, sp.width / 2, sp.height / 2);
  }

  // player
  if (player.alive && mode === 'play') {
    const blink = invulnT > 0 && Math.sin(time * 24) > 0;
    if (!blink) {
      ctx.save();
      ctx.translate(player.x, player.y);
      // miko triangle
      ctx.fillStyle = invulnT > 0 ? 'rgba(255,220,230,.6)' : '#ffe8f0';
      ctx.beginPath(); ctx.moveTo(0, -13); ctx.lineTo(9, 9); ctx.lineTo(-9, 9); ctx.closePath(); ctx.fill();
      // red ribbon
      ctx.fillStyle = '#e8404a';
      ctx.fillRect(-7, -2, 14, 3.4);
      // hitbox dot (always subtle; bright in focus)
      ctx.fillStyle = player.focusing ? '#ff4040' : 'rgba(255,80,80,.75)';
      ctx.beginPath(); ctx.arc(0, 0, player.focusing ? 4 : 2.5, 0, Math.PI * 2); ctx.fill();
      if (player.focusing) {
        ctx.strokeStyle = 'rgba(255,120,120,.5)';
        ctx.beginPath(); ctx.arc(0, 0, GRAZE_R, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.restore();
    }
  }

  // particles
  for (const p of parts) {
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;

  // bomb flash
  if (bombFlashT > 0 || world_flash > 0) {
    ctx.fillStyle = `rgba(255,240,220,${Math.max(bombFlashT, world_flash) * .8})`;
    ctx.fillRect(0, 0, W, H);
  }

  // title/over overlay dims handled by DOM
  ctx.restore();
}

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
  }
  render();
}
requestAnimationFrame(tick);

// ==================== input ====================
addEventListener('keydown', (e) => {
  if (e.isComposing || e.keyCode === 229) return;
  if (/^(Meta|Alt|Control)/.test(e.code)) { held.clear(); return; }
  if (e.metaKey || e.altKey || e.ctrlKey) return;
  held.add(e.code);
  pressed.add(e.code);
  if (['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
});
const pressed = new Set();
addEventListener('keyup', (e) => held.delete(e.code));
addEventListener('blur', () => held.clear());
document.addEventListener('visibilitychange', () => held.clear());

function handleKeys() {
  for (const code of pressed) {
    if (code === 'KeyP') togglePause();
    else if (code === 'KeyM') toggleMute();
    else if (code === 'KeyX' && mode === 'play' && !paused) useBomb();
    else if (code === 'Enter' && (mode === 'title' || mode === 'over')) startGame(false);
  }
  pressed.clear();
}

// touch: drag pad moves (direct position mapping), focus & bomb buttons
{
  const pad = document.getElementById('tpad');
  const tf = document.getElementById('tfocus');
  const tb = document.getElementById('tbomb');
  addEventListener('pointerdown', (e) => {
    audio.ensure();
    if (e.pointerType === 'touch') ui.el.touch.classList.add('on');
  }, { passive: true });
  if (pad) {
    let pid = null;
    pad.addEventListener('pointerdown', (e) => { pid = e.pointerId; pad.setPointerCapture(pid); movePad(e); });
    pad.addEventListener('pointermove', (e) => { if (e.pointerId === pid) movePad(e); });
    const up = () => { pid = null; };
    for (const ev of ['pointerup', 'pointercancel']) pad.addEventListener(ev, up);
  }
  function movePad(e) {
    if (mode !== 'play' || paused) return;
    const rect = pad.getBoundingClientRect();
    player.x = Math.max(14, Math.min(W - 14, (e.clientX - rect.left) / rect.width * W));
    player.y = Math.max(20, Math.min(H - 20, (e.clientY - rect.top) / rect.height * H * .9 + H * .1));
  }
  if (tf) tf.addEventListener('pointerdown', (e) => { e.preventDefault(); held.add('ShiftLeft'); });
  if (tf) for (const ev of ['pointerup', 'pointercancel']) tf.addEventListener(ev, () => held.delete('ShiftLeft'));
  if (tb) tb.addEventListener('pointerdown', (e) => { e.preventDefault(); pressed.add('KeyX'); });
}

// ==================== G debug hooks ====================
const G = {
  err: window.__BOOTERR,
  step: (n = 60, dt = 1 / 60) => { for (let i = 0; i < n; i++) { handleKeys(); if (mode === 'play' && !paused) update(dt); render(); } },
  upd: (n = 30, dt = 1 / 60) => { for (let i = 0; i < n; i++) { handleKeys(); if (mode === 'play' && !paused) update(dt); } },
  press: (...codes) => codes.forEach(c => pressed.add(c)),
  hold: (...codes) => codes.forEach(c => held.add(c)),
  release: (...codes) => codes.forEach(c => held.delete(c)),
  setNoAuto: (v) => { noAuto = !!v; },
  setGod: (v) => { god = !!v; },
  setReportTarget: (fn) => { reportTarget = fn; },
  skipToBoss: (n) => { bossIdx = Math.min(BOSS_LIST.length - 1, Math.max(0, n | 0)); phaseIdx = 0; mode = 'play'; spawnBoss(bossIdx); },
  setPhaseHp: (v) => { phaseHp = v; },
  setPhaseT: (v) => { phaseT = v; },
  setSpellT: (v) => { spellT = v; },
  setGrazeMeter: (v) => { grazeMeter = v; },
  spawnBulletAt: (x, y, vx, vy, r, type) => spawnBullet(x, y, vx, vy, r || 5, type || 'red'),
  clearBullets: () => { bullets.length = 0; },
  state: () => ({
    mode, paused, score, bestScore, bestBoss, lives, bombs, grazeCount, grazeMeter,
    bossIdx, phaseIdx, spellIdx, spellT: +spellT.toFixed(2), phaseT: +phaseT.toFixed(2),
    phaseHp: Math.round(phaseHp), phaseHpMax, introT: +introT.toFixed(2), transitionT: +transitionT.toFixed(2),
    bullets: bullets.length, bossAlive: !!boss && !boss.entering, playerAlive: player.alive,
    px: +player.x.toFixed(1), py: +player.y.toFixed(1), invulnT: +invulnT.toFixed(2), focusing: player.focusing, god,
  }),
  fx: () => ({ shots: shots.length, parts: parts.length, homing: homing.size }),
  player, bullets, shots, bossRef: () => boss, audio,
  forceGameOver: () => gameOver(),
  startGame,
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
    const savedScore = bestScore, savedBoss = bestBoss;
    G.setReportTarget(() => { });

    assert(1, G.err.length === 0, '启动零报错');
    G.setNoAuto(true);
    startGame(false);
    assert(2, S().mode === 'play' && S().lives === 3 && S().bombs === 3, '开局 3 残机 3 灵击');
    assert(3, S().bossIdx === 0, 'Boss1 已出场(入场中)');

    // wait out intro (noAuto already skipped intro)
    G.upd(120);
    assert(4, S().bossAlive, 'Boss 进入战斗位');

    // -- T5: movement
    const p0 = { x: S().px, y: S().py };
    G.hold('ArrowLeft'); G.upd(20); G.release('ArrowLeft');
    assert(5, S().px < p0.x - 40, '左移位移');
    // -- T6: focus slow
    G.hold('ArrowRight', 'ShiftLeft');
    const pF0 = S().px;
    G.upd(10);
    const pF1 = S().px;
    G.release('ArrowRight', 'ShiftLeft');
    G.hold('ArrowRight'); G.upd(10); G.release('ArrowRight');
    const normalPerFrame = (S().px - pF1 - (pF1 - pF0)) / 10;
    assert(6, (pF1 - pF0) / 10 < P_SPEED / 60 * .55, `低速模式速度减半`);
    G.upd(2);

    // -- T7: hit → death & lives--
    startGame(false);
    G.setNoAuto(true); G.upd(200);                        // burn spawn invuln
    G.spawnBulletAt(S().px, S().py, 0, 0, 6, 'red');     // on top of player
    G.upd(2);
    assert(7, !S().playerAlive && S().lives === 2, '弹命中判定点 → 残机-1');
    G.upd(90);                                            // respawn ~1.1s
    assert(8, S().playerAlive && S().invulnT > 0, '重生无敌闪烁');

    // -- T9: graze
    startGame(false);
    G.setNoAuto(true); G.upd(10);
    const g0 = S().grazeCount, sc0 = S().score;
    G.spawnBulletAt(S().px + 9, S().py - 40, 0, 60, 5, 'red');   // passes ~9px away
    G.upd(80);
    assert(9, S().grazeCount === g0 + 1, '贴弹擦弹 +1');
    assert(10, S().score >= sc0 + 10, '擦弹 +10 分');

    // -- T11: graze meter → bomb extend
    G.setGrazeMeter(99);
    G.spawnBulletAt(S().px + 9, S().py - 40, 0, 60, 5, 'red');
    const b0 = S().bombs;
    G.upd(80);
    assert(11, S().bombs === b0 + 1 && S().grazeMeter >= 0 && S().grazeMeter < 100, '擦弹槽满 100 送灵击');

    // -- T12: bomb clears bullets + invuln
    G.clearBullets();
    for (let i = 0; i < 50; i++) G.spawnBulletAt(Math.random() * W, Math.random() * H / 2, 0, 80, 5, 'purple');
    G.press('KeyX'); G.upd(1);
    assert(12, S().bullets === 0 && S().invulnT >= 2.4 && S().bombs === b0, '灵击清屏+无敌');

    // -- T13/T14: phase capture & transition
    startGame(false);
    G.setNoAuto(true); G.upd(130);
    G.setPhaseT(.1);
    G.upd(12);
    assert(13, S().phaseIdx === 1, '撑过计时收取 → 进入 2 相');
    assert(14, S().bullets === 0 && S().score > 0, '相切换清屏+收取加分');

    // -- T15: boss kill (both phases) → next boss
    startGame(false);
    G.setNoAuto(true); G.upd(130);
    G.setPhaseHp(1);
    for (let i = 0; i < 700 && S().phaseIdx === 0; i++) G.upd(1);
    G.setPhaseHp(1);                       // phase 2 spawned at full hp
    for (let i = 0; i < 700 && S().bossIdx === 0 && S().mode === 'play'; i++) G.upd(1);
    assert(15, S().bossIdx === 1, '两相击破 → Boss2');

    // -- T16: final boss kill → complete
    G.skipToBoss(3);
    G.upd(130);
    G.setPhaseHp(1);
    for (let i = 0; i < 700 && S().mode === 'play'; i++) G.upd(1);
    // boss3 has 2 phases: first kill advances phase, second completes
    G.setPhaseHp(1);
    for (let i = 0; i < 700 && S().mode === 'play'; i++) G.upd(1);
    assert(16, S().mode === 'over' || reports.some(f => f.kind === 'complete'), '末魔击破 → complete');

    // -- T17: bullet cap
    startGame(false);
    G.setNoAuto(true); G.upd(5);
    for (let i = 0; i < 1200; i++) G.spawnBulletAt(Math.random() * W, Math.random() * H, (Math.random() - .5) * 60, (Math.random() - .5) * 60, 5, 'gold');
    let nan = false;
    for (const b of bullets) if (isNaN(b.x) || isNaN(b.y)) nan = true;
    assert(17, bullets.length <= BULLET_CAP && !nan, '弹池上限 900 无 NaN');

    // -- T18: boss spell rotation
    startGame(false);
    G.setNoAuto(true); G.upd(130);
    const sp0 = S().spellIdx;
    G.setSpellT(.1);
    G.upd(12);
    assert(18, S().spellIdx === sp0 + 1, '符卡计时轮转下张');

    // -- T19/T20: best persistence
    startGame(false);
    bestScore = 0; bestBoss = 0;
    try { localStorage.setItem('dks.bestScore', '0'); localStorage.setItem('dks.bestBoss', '0'); } catch (e) { }
    score = 3456; bossIdx = 2;
    G.forceGameOver();
    const bs = parseInt(localStorage.getItem('dks.bestScore') || '0') || 0;
    const bb = parseInt(localStorage.getItem('dks.bestBoss') || '0') || 0;
    assert(19, bs === 3456 && bb === 2, 'bestScore/bestBoss 写 localStorage');

    // -- T20: continue penalty
    score = 1000;
    startGame(true);
    assert(20, S().score === 700 && S().mode === 'play', '续战罚 30% 分');

    // -- T21: protocol frames
    assert(21, reports[0] && reports[0].kind === 'ready', 'ready 首帧');
    assert(22, reports.some(f => f.kind === 'progress'), 'progress 帧存在');
    assert(23, reports[reports.length - 1].kind === 'gameOver', 'gameOver 末帧');

    // -- T24: pause freezes
    startGame(false);
    G.setNoAuto(true); G.upd(20);
    G.clearBullets();
    G.spawnBulletAt(S().px, 100, 0, 120, 5, 'red');
    const by0 = bullets[0].y;
    G.press('KeyP'); G.upd(10);
    assert(24, Math.abs(bullets[0].y - by0) < .001 && S().paused, '暂停冻结弹幕');
    G.press('KeyP'); G.upd(2);

    // -- T25: audio
    audio.ensure();
    assert(25, audio.hasCtx() && audio.isMuted() === true, 'AudioContext + 自测静音');
    audio.state('boss');
    assert(26, audio.state() === 'boss', 'Boss 战配乐状态切换');
    audio.state('fight');

    // -- T27: UI & touch elements
    assert(27, !!ui.el.mutebtn && !!ui.el.pausebtn && !!document.getElementById('tpad') && !!document.getElementById('tbomb'), 'UI 与触控元素存在');

    // -- T28: full fast-forward 120s with god
    const errBefore = G.err.length;
    startGame(false);
    G.setNoAuto(false);
    G.setGod(true);
    let nan2 = false;
    for (let i = 0; i < 7200; i++) {
      G.upd(1);
      if (i % 90 === 30) { G.hold('ArrowLeft'); }
      if (i % 90 === 60) { G.release('ArrowLeft'); G.hold('ArrowRight'); }
      if (i % 90 === 0) { G.release('ArrowRight'); }
      if (i % 600 === 300) G.press('KeyX');
      if (S().mode !== 'play') break;
      if (isNaN(S().score) || isNaN(S().px)) nan2 = true;
    }
    assert(28, !nan2 && G.err.length === errBefore, '无敌 120s 快进无 NaN 无新报错');
    G.setGod(false);
    if (S().mode === 'play') G.forceGameOver();
    toTitle();
    assert(29, S().mode === 'title' && !ui.el.title.classList.contains('hide'), '测完回标题');

    // restore best
    try { localStorage.setItem('dks.bestScore', String(savedScore)); localStorage.setItem('dks.bestBoss', String(savedBoss)); } catch (e) { }
    bestScore = savedScore; bestBoss = savedBoss; ui.setBest(bestScore, bestBoss);

    const pass = results.filter(r => r.ok).length;
    window.__TEST = { pass, fail: results.length - pass, total: results.length, results, done: true };
    console.log(`[autotest] ${pass}/${results.length} passed`);
  }
}

if (new URLSearchParams(location.search).get('autotest')) autotest();
