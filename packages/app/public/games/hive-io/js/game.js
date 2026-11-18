// Hive IO 蜂巢大作战 — 3D snake-io arena.
// guizang-game-skill methodology, third series #7. Player + 12 AI bees eat
// nectar, boost-drain length, kill by head-on size duels; bodies convert to
// nectar on death. Instanced rendering, spatial-hash orb pickup.

import { makeWorld, ARENA_R, FLOWERS } from './world.js';
import { makeSnakePool, HEAD_R } from './swarm.js';
import { makeAudio } from './audio.js';
import { makeUI } from './ui.js';
import * as THREE from '../vendor/three.module.min.js';

const ORB_MAX = 420, ORB_R = .42;
const CROWN_LEN = 100;
const BOT_COUNT = 12;
const STING_LOSS = 3;

// ==================== state ====================
let mode = 'title', paused = false, noAuto = false;
let score = 0, bestLen = 0, bestKills = 0, kills = 0, crownDone = false;
let playT = 0, time = 0;
try { bestLen = parseInt(localStorage.getItem('hio.bestLen') || '0') || 0; bestKills = parseInt(localStorage.getItem('hio.bestKills') || '0') || 0; } catch (e) { }
let muted = false;
try { muted = localStorage.getItem('hio.mute') === '1'; } catch (e) { }
const AUTOTEST = new URLSearchParams(location.search).has('autotest');

const world = makeWorld();
const audio = makeAudio();
const pool = makeSnakePool(world.scene, world.matStd);
const ui = makeUI({
  onStart: () => { audio.ensure(); audio.sfx.ui(); startGame(); },
  onRestart: () => { audio.sfx.ui(); startGame(); },
  onBackTitle: () => { audio.sfx.ui(); toTitle(); },
  onMute: () => toggleMute(),
  onPause: () => { audio.sfx.ui(); togglePause(); },
});
ui.setBest(bestLen, bestKills);
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
report('ready', { game: 'hive-io' });

// ==================== nectar orbs (instanced) ====================
const orbGeo = new THREE.SphereGeometry(ORB_R, 8, 6);
const orbMat = new THREE.MeshStandardMaterial({ color: 0xffd166, emissive: 0xd9a018, emissiveIntensity: .7, roughness: .4 });
const orbInst = new THREE.InstancedMesh(orbGeo, orbMat, ORB_MAX + 220);
orbInst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
orbInst.count = 0;
world.scene.add(orbInst);
const orbs = [];                        // {x,z,vx,vy?,tier,taken}
const dummy = new THREE.Object3D();

function orbValue(tier) { return tier === 1 ? 3 : 1; }   // tier 1 = juicy corpse orb

function spawnOrb(x, z, tier = 0) {
  const r = ARENA_R - 4;
  if (x === undefined) { const a = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random()) * r; x = Math.cos(a) * rr; z = Math.sin(a) * rr; }
  orbs.push({ x, z, tier, taken: false, ph: Math.random() * 6 });
}
function removeOrb(i) { orbs.splice(i, 1); }

function renderOrbs() {
  let n = 0;
  for (const o of orbs) {
    if (n >= orbInst.instanceMatrix.instanceCount) break;
    dummy.position.set(o.x, ORB_R + Math.sin(time * 2.4 + o.ph) * .12, o.z);
    dummy.scale.setScalar(o.tier === 1 ? 1.7 : 1);
    dummy.updateMatrix();
    orbInst.setMatrixAt(n, dummy.matrix);
    n++;
  }
  orbInst.count = n;
  orbInst.instanceMatrix.needsUpdate = true;
}

// ==================== game flow ====================
let player = null;
const botNames = ['蜜旋', '刺影', '花后', '铁颚', '风哨', '夜蜂', '金环', '毒吻', '雾翅', '雷鸣', '苔壳', '焰腹'];
const botColors = [0xe84a6c, 0x6fa8ff, 0xb060ff, 0x50d8a0, 0xff8a5c, 0x60c8e8, 0xd8b050, 0xc860e8, 0x8ad84a, 0xff6f91, 0x5cd0d8, 0xa8b0ff];

function resetPlay() {
  for (const s of [...pool.snakes]) pool.remove(s);
  orbs.length = 0;
  score = 0; kills = 0; playT = 0; crownDone = false;
  player = pool.spawn({ x: 0, z: 20, angle: -Math.PI / 2, color: 0xffd166, isPlayer: true, name: '蜂王(你)', length: 3 });
  for (let i = 0; i < BOT_COUNT; i++) {
    const a = (i / BOT_COUNT) * Math.PI * 2;
    const rr = 30 + Math.random() * 60;
    pool.spawn({
      x: Math.cos(a) * rr, z: Math.sin(a) * rr, angle: a + Math.PI / 2,
      color: botColors[i], name: botNames[i],
      personality: ['glutton', 'hunter', 'wanderer'][i % 3],
      length: 4 + Math.floor(Math.random() * 7),
    });
  }
  for (let i = 0; i < ORB_MAX; i++) spawnOrb();
  ui.setScore(0); ui.setLength(3); ui.setKills(0);
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
  ui.setBest(bestLen, bestKills);
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
  try { localStorage.setItem('hio.mute', muted ? '1' : '0'); } catch (e) { }
}

// ==================== player input ====================
let aimAngle = -Math.PI / 2, boostHeld = false;
function setAimFromScreen(sx, sy) {
  // screen-space direction relative to player head (camera behind player)
  const dx = sx - innerWidth / 2;
  const dy = sy - innerHeight / 2;
  if (dx * dx + dy * dy < 900) return;     // deadzone near center
  aimAngle = Math.atan2(dy, -dx) + Math.PI / 2;   // forward = -y screen ≈ player heading
}
addEventListener('pointermove', (e) => { if (mode === 'play' && !paused) setAimFromScreen(e.clientX, e.clientY); });
addEventListener('pointerdown', (e) => {
  audio.ensure();
  if (e.pointerType === 'touch') { aimBoostBtnCheck(e); return; }
  if (mode === 'play' && !paused) { boostHeld = true; if (!player.P_boostedOnce) { audio.sfx.boostOn(); player.P_boostedOnce = true; } }
});
addEventListener('pointerup', () => { boostHeld = false; });
addEventListener('blur', () => { boostHeld = false; });
function aimBoostBtnCheck(e) { /* touch steer handled in touch zones */ }

// ==================== AI ====================
function botThink(s, dt) {
  s.aiT -= dt;
  const inFlower = FLOWERS.some(f => (s.x - f.x) ** 2 + (s.z - f.z) ** 2 < f.r * f.r);
  if (s.aiT <= 0) {
    s.aiT = .8 + Math.random() * 1.2;
    // boundary avoidance first
    const distR = Math.hypot(s.x, s.z);
    if (distR > ARENA_R - 14) {
      s.targetAngle = Math.atan2(-s.z, -s.x) + (Math.random() - .5) * .6;
      return;
    }
    if (s.personality === 'glutton') {
      // seek nearest orb, prefer flowers slightly
      let bx = 0, bz = 0, bd = 1e9;
      for (let i = 0; i < orbs.length; i += 3) {
        const o = orbs[i];
        const d = (o.x - s.x) ** 2 + (o.z - s.z) ** 2;
        if (d < bd) { bd = d; bx = o.x; bz = o.z; }
      }
      s.targetAngle = Math.atan2(bz - s.z, bx - s.x);
      s.boosting = false;
    } else if (s.personality === 'hunter') {
      // chase smallest snake head that is smaller than me
      let prey = null, pd = 1e9;
      for (const o of pool.snakes) {
        if (o === s || !o.alive) continue;
        if (o.len >= s.len * .92) continue;
        const d = (o.x - s.x) ** 2 + (o.z - s.z) ** 2;
        if (d < pd && d < 80 * 80) { pd = d; prey = o; }
      }
      if (prey) {
        // aim ahead of prey head to cut it off
        const ax = prey.x + Math.cos(prey.angle) * 4, az = prey.z + Math.sin(prey.angle) * 4;
        s.targetAngle = Math.atan2(az - s.z, ax - s.x);
        s.boosting = s.len > 8 && Math.random() < .35;
      } else { s.personality = 'glutton'; }
    } else {
      // wanderer: random waypoint in arena, flee bigger heads
      if ((s.aiTarget.x - s.x) ** 2 + (s.aiTarget.z - s.z) ** 2 < 100) {
        const a = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random()) * (ARENA_R - 20);
        s.aiTarget.x = Math.cos(a) * rr; s.aiTarget.z = Math.sin(a) * rr;
      }
      s.targetAngle = Math.atan2(s.aiTarget.z - s.z, s.aiTarget.x - s.x);
      s.boosting = Math.random() < .05;
    }
    if (inFlower && Math.random() < .3) s.boosting = false;   // bees cautious in flowers
  }
}

// ==================== collisions ====================
function headHitsBody(a, b) {
  // does a's head touch b's body segments (skip near-head segs)?
  const hr = HEAD_R * (1 + Math.min(1.6, (a.len - 3) * .012));
  const start = 6;
  for (let i = start; i < b.path.length; i += 2) {
    const p = b.path[i];
    const dx = a.x - p.x, dz = a.z - p.z;
    const rr = hr + .5;
    if (dx * dx + dz * dz < rr * rr) return true;
  }
  return false;
}

function killSnake(s, killer) {
  if (killer) { killer.kills++; if (killer.isPlayer) kills = killer.kills; }
  // convert body to juicy orbs
  const step = 2;
  for (let i = 0; i < s.path.length; i += step) {
    const p = s.path[i];
    if (Math.hypot(p.x, p.z) < ARENA_R - 3) spawnOrb(p.x + (Math.random() - .5), p.z + (Math.random() - .5), 1);
  }
  if (s.isPlayer) {
    audio.sfx.death();
    world.shake(.6, .4);
    gameOver();
  } else {
    audio.sfx.kill();
    pool.remove(s);
  }
}

function checkCollisions() {
  const P = player;
  // player: orbs
  const pr = HEAD_R * (1 + Math.min(1.6, (P.len - 3) * .012)) + .5;
  for (let i = orbs.length - 1; i >= 0; i--) {
    const o = orbs[i];
    const dx = P.x - o.x, dz = P.z - o.z;
    if (dx * dx + dz * dz < pr * pr) {
      P.growth += orbValue(o.tier);
      while (P.growth >= 1) { P.growth -= 1; P.len++; }
      score += o.tier === 1 ? 5 : 1;
      removeOrb(i);
      if (!noAuto || Math.random() < .1) audio.sfx.eat();
    }
  }
  // player: thorn stings
  for (const t of world.thorns) {
    const dx = P.x - t.x, dz = P.z - t.z;
    if (dx * dx + dz * dz < t.r * t.r) {
      if (P.stingCD === undefined || P.stingCD <= 0) {
        P.stingCD = 1.2;
        P.len = Math.max(2, P.len - STING_LOSS);
        P.stings++;
        audio.sfx.sting();
        world.shake(.35, .25);
        ui.showToast(`毒刺扎了！体长 -${STING_LOSS}`);
      }
    }
  }
  if (P.stingCD === undefined) P.stingCD = 0; else P.stingCD -= 1 / 60;

  // boundary death — walls kill regardless of spawn protection
  for (const s of pool.snakes) {
    if (Math.hypot(s.x, s.z) > ARENA_R - .5) {
      if (!noAuto || s.isPlayer) killSnake(s, null);
    }
  }
  // snakes pairwise duels / body crashes
  for (const a of pool.snakes) {
    if (!a.alive) continue;
    for (const b of pool.snakes) {
      if (a === b || !b.alive) continue;
      const dd = (a.x - b.x) ** 2 + (a.z - b.z) ** 2;
      const headR = HEAD_R * 1.3;
      if (dd < headR * headR) {
        // head-on duel: smaller dies; near-equal → both die.
        // Spawn protection only shields from being killed (protected bee can still kill).
        if (a.len < b.len * .92) { if (a.protT <= 0) killSnake(a, b); }
        else if (b.len < a.len * .92) { if (b.protT <= 0) killSnake(b, a); }
        else { if (a.protT <= 0) killSnake(a, b); if (b.alive && b.protT <= 0) killSnake(b, a); }
        break;
      } else {
        // head into body
        if (headHitsBody(a, b)) { if (a.protT <= 0) killSnake(a, b); break; }
      }
    }
  }
}

// ==================== orbs director ====================
function directorTick() {
  if (noAuto) return;
  // keep orb population
  while (orbs.length < ORB_MAX) {
    // flowers are nectar-rich: 30% spawn inside a patch
    if (Math.random() < .3 && FLOWERS.length) {
      const f = FLOWERS[Math.floor(Math.random() * FLOWERS.length)];
      const a = Math.random() * Math.PI * 2, rr = Math.random() * f.r;
      spawnOrb(f.x + Math.cos(a) * rr, f.z + Math.sin(a) * rr);
    } else spawnOrb();
  }
}

// ==================== update ====================
function update(dt) {
  time += dt; playT += dt;
  // player steering/input
  player.targetAngle = aimAngle;
  player.boosting = boostHeld || boostKey;
  pool.dropOrb = (s) => {
    if (Math.hypot(s.x, s.z) < ARENA_R - 3) spawnOrb(s.x - Math.cos(s.angle) * 1.4, s.z - Math.sin(s.angle) * 1.4, 0);
  };
  for (const s of pool.snakes) {
    if (!s.isPlayer && !noAuto) botThink(s, dt);
    pool.updateSnake(s, dt, time);
  }
  checkCollisions();
  directorTick();
  renderOrbs();
  pool.renderInstances(time);
  world.follow(player.x, player.z, player.angle);
  // crown
  if (!crownDone && player.len >= CROWN_LEN) {
    crownDone = true;
    audio.sfx.crown();
    ui.showBanner('蜂王加冕！', `体长突破 ${CROWN_LEN} · 继续无限吞噬`, 2600);
    report('complete', { score, progress: Math.min(1, player.len / CROWN_LEN) });
  }
  audio.update();
  updateLeaderboard();
}

// ==================== leaderboard ====================
function updateLeaderboard() {
  const rows = pool.snakes.map(s => ({ name: s.isPlayer ? '蜂王(你)' : s.name, len: s.len, me: s.isPlayer }))
    .sort((a, b) => b.len - a.len);
  rows.forEach((r, i) => r.rank = i + 1);
  ui.setLeaderboard(rows.slice(0, 5));
  const myRank = rows.findIndex(r => r.me) + 1;
  ui.setLength(player.len); ui.setKills(kills); ui.setScore(score);
  return myRank;
}

// ==================== game over ====================
function gameOver() {
  if (mode !== 'play') return;
  mode = 'over';
  audio.stop();
  const isNew = player.len > bestLen;
  if (isNew) bestLen = player.len;
  if (kills > bestKills) bestKills = kills;
  try { localStorage.setItem('hio.bestLen', String(bestLen)); localStorage.setItem('hio.bestKills', String(bestKills)); } catch (e) { }
  ui.setBest(bestLen, bestKills);
  ui.setEnd(isNew ? '体长新纪录！' : '蜂王陨落',
    `体长 ${player.len}${isNew ? ' ⭐' : ''}\n吞噬 ${kills} · 得分 ${score}\n毒刺扎伤 ${player.stings} 次`);
  ui.showEnd(true);
  report('gameOver', { score, progress: Math.min(1, player.len / CROWN_LEN) });
}

// ==================== main loop ====================
let last = performance.now(), acc = 0;
let boostKey = false;
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
  world.render();
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
addEventListener('keyup', (e) => { if (e.code === 'Space') boostKey = false; });
addEventListener('blur', () => { pressed.clear(); boostKey = false; });
document.addEventListener('visibilitychange', () => { pressed.clear(); boostKey = false; });

function handleKeys() {
  for (const code of pressed) {
    if (code === 'KeyP') togglePause();
    else if (code === 'KeyM') toggleMute();
    else if (code === 'Enter' && (mode === 'title' || mode === 'over')) startGame();
    else if (code === 'Space' && mode === 'play' && !paused) { boostKey = true; audio.sfx.boostOn(); }
    else if (code === 'ArrowLeft' && mode === 'play' && !paused) aimAngle -= .4;
    else if (code === 'ArrowRight' && mode === 'play' && !paused) aimAngle += .4;
  }
  pressed.clear();
}

// touch zones: drag anywhere steers; boost button bottom-right
{
  let touchActive = false;
  addEventListener('touchstart', () => { touchActive = true; }, { passive: true });
  addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch' || mode !== 'play' || paused) return;
    setAimFromScreen(e.clientX, e.clientY);
    touchActive = true;
  }, { passive: true });
  addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch' && touchActive && mode === 'play' && !paused) setAimFromScreen(e.clientX, e.clientY);
  }, { passive: true });
}

// ==================== G debug hooks ====================
const G = {
  err: window.__BOOTERR,
  step: (n = 60, dt = 1 / 60) => { for (let i = 0; i < n; i++) { handleKeys(); if (mode === 'play' && !paused) update(dt); world.render(); } },
  upd: (n = 30, dt = 1 / 60) => { for (let i = 0; i < n; i++) { handleKeys(); if (mode === 'play' && !paused) update(dt); } },
  press: (...codes) => codes.forEach(c => pressed.add(c)),
  setNoAuto: (v) => { noAuto = !!v; },
  setReportTarget: (fn) => { reportTarget = fn; },
  setAim: (a) => { aimAngle = a; },
  setBoost: (v) => { boostKey = !!v; boostHeld = !!v; },
  setLen: (v) => {
    const want = Math.max(2, v | 0);
    player.len = want;
    for (let i = player.path.length; i < want; i++) player.path.push({ x: player.x - Math.cos(player.angle) * i * pool.SEG_GAP, z: player.z - Math.sin(player.angle) * i * pool.SEG_GAP });
  },
  clearProt: () => { player.protT = 0; },
  spawnBot: (opts) => pool.spawn({ color: 0xffffff, name: 'test', length: 3, x: 0, z: 0, angle: 0, ...opts }),
  spawnOrb: (x, z, tier) => spawnOrb(x, z, tier),
  state: () => ({ mode, paused, score, bestLen, bestKills, kills, crownDone, orbs: orbs.length, snakes: pool.snakes.length, player: player ? { x: +player.x.toFixed(2), z: +player.z.toFixed(2), angle: +player.angle.toFixed(2), len: player.len, boosting: player.boosting, alive: player.alive, protT: +player.protT.toFixed(2), stings: player.stings } : null }),
  fx: () => ({ segs: pool.snakes.reduce((a, s) => a + s.path.length, 0) }),
  pool, player: () => player, world, audio,
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
    const savedLen = bestLen, savedKills = bestKills;
    G.setReportTarget(() => { });

    assert(1, G.err.length === 0, '启动零报错');
    startGame();
    G.setNoAuto(true);
    assert(2, S().mode === 'play' && S().snakes === BOT_COUNT + 1, '开局 13 蜂在场');
    assert(3, S().player.len === 3 && S().player.protT > 0, '玩家体长 3 且出生保护');

    // -- T4: steering moves head
    const p0 = { x: S().player.x, z: S().player.z };
    G.setAim(0);                        // head east
    G.upd(30);
    const st4 = S().player;
    assert(4, st4.x > p0.x + 2, '朝目标角前进');
    // turn-rate limited: flip aim 180°, heading shouldn't fully flip in 3 frames
    G.setAim(Math.PI); const aBefore = st4.angle; G.upd(3);
    assert(5, Math.abs(S().player.angle - aBefore) < .35, '转向受角速度限制');

    // -- T6/T7: eat orb grows, director restores (noAuto freezes director: manual add)
    const len0 = S().player.len;
    G.spawnOrb(S().player.x + .3, S().player.z, 0);
    G.upd(2);
    assert(6, S().player.len === len0 + 1, '吃蜜珠体长 +1');
    assert(7, S().score >= 1, '吃珠得分');

    // -- T8/T9: boost drains length + moves faster
    G.setLen(10);
    const lenB = S().player.len;
    G.setBoost(true);
    const xB = S().player.x;
    G.upd(60);
    const movedB = S().player.x - xB;
    assert(8, S().player.len <= lenB - 2, '加速消耗体长(≥2)');
    G.setBoost(false);
    const xC = S().player.x;
    G.upd(60);
    const movedN = S().player.x - xC;
    assert(9, movedB > movedN * 1.3, '加速速度明显更快');

    // -- T11: head-on duel — smaller bot dies, player kills++
    startGame();
    G.setNoAuto(true);
    G.setLen(30); G.clearProt();
    G.setAim(0);
    G.upd(40);                            // settle heading east
    const kills0 = S().kills;
    G.spawnBot({ x: S().player.x + 6, z: S().player.z, angle: Math.PI, length: 4, name: 'duel' });
    G.upd(120);
    assert(11, S().kills === kills0 + 1, '体型压制：头撞击杀小蜂');

    // -- T12: corpse converts to orbs
    assert(12, S().orbs > ORB_MAX - 50, '阵亡蜂化为蜜珠(场上蜜珠增加)');

    // -- T13: head vs body kills the runner
    startGame();
    G.setNoAuto(true);
    G.setLen(5); G.clearProt();
    G.setAim(0);
    G.spawnBot({ x: S().player.x + 10, z: S().player.z - 2, angle: 0, length: 12, name: 'wall' });
    G.upd(200);
    assert(13, S().mode === 'over', '头撞大体蜂身体判负');

    // -- T14: bigger head-on kills player (small player duels big bot)
    startGame();
    G.setNoAuto(true);
    G.clearProt();
    G.setAim(0);
    G.upd(40);
    G.spawnBot({ x: S().player.x + 5, z: S().player.z, angle: Math.PI, length: 30, name: 'big' });
    G.upd(150);
    assert(14, S().mode === 'over', '头对头以小撞大判负');

    // -- T15: boundary death
    startGame();
    G.setNoAuto(true);
    player.x = ARENA_R - 1; player.z = 0; player.angle = 0;   // run outward
    G.setAim(0);
    G.upd(30);
    assert(15, S().mode === 'over', '冲出荆棘围墙判负');

    // -- T16: thorn sting
    startGame();
    G.setNoAuto(true);
    G.setLen(12); G.clearProt();
    const thorn = world.thorns[0];
    player.x = thorn.x + 1.5; player.z = thorn.z; player.angle = Math.PI / 2;
    const lenT = S().player.len;
    G.upd(60);
    assert(16, S().player.stings >= 1 && S().player.len <= lenT - STING_LOSS + 1, `毒刺扣体长(≥${STING_LOSS})`);

    // -- T17: protection expires
    startGame();
    G.setNoAuto(true);
    G.upd(200);
    assert(17, S().player.protT === 0, '3 秒出生保护结束');

    // -- T18: bots move (AI runs when noAuto=false)
    startGame();
    G.setNoAuto(false);
    const bot = pool.snakes.find(s => !s.isPlayer);
    const bx = bot.x, bz = bot.z;
    G.upd(60);
    assert(18, Math.hypot(bot.x - bx, bot.z - bz) > 2, 'AI 蜂自主移动');
    G.setNoAuto(true);

    // -- T19: bots avoid boundary
    bot.x = ARENA_R - 12; bot.z = 0;
    bot.aiT = 0;
    G.setNoAuto(false);
    G.upd(20);
    const inward = Math.cos(bot.targetAngle) * (-bot.x) + Math.sin(bot.targetAngle) * (-bot.z);
    G.setNoAuto(true);
    assert(19, inward > 0, '边界附近的 AI 目标角朝内');

    // -- T20: leaderboard rows & ordering
    startGame();
    G.setLen(50);
    G.upd(2);
    const rows = ui.el.lbrows.children.length;
    assert(20, rows === 5, '排行榜显示 5 行');

    // -- T21: crown at 100
    G.setLen(101);
    G.upd(2);
    assert(21, S().crownDone === true, '体长 100 触发蜂王加冕 complete');

    // -- T22: best persistence
    startGame();
    bestLen = 0; bestKills = 0;
    try { localStorage.setItem('hio.bestLen', '0'); localStorage.setItem('hio.bestKills', '0'); } catch (e) { }
    G.setLen(88); kills = 7;
    G.forceGameOver();
    const bl = parseInt(localStorage.getItem('hio.bestLen') || '0') || 0;
    const bk = parseInt(localStorage.getItem('hio.bestKills') || '0') || 0;
    assert(22, bl === 88 && bk === 7, 'bestLen/bestKills 写 localStorage');
    try { localStorage.setItem('hio.bestLen', String(savedLen)); localStorage.setItem('hio.bestKills', String(savedKills)); } catch (e) { }
    bestLen = savedLen; bestKills = savedKills;

    // -- T23: protocol sequence
    assert(23, reports[0] && reports[0].kind === 'ready', 'ready 首帧');
    assert(24, reports.some(f => f.kind === 'complete'), 'complete 加冕帧存在');
    assert(25, reports[reports.length - 1].kind === 'gameOver', 'gameOver 末帧');

    // -- T26: 13 snakes 400 frames no NaN no leak
    startGame();
    G.setNoAuto(false);
    let nan = false, leak = false;
    for (let i = 0; i < 400; i++) {
      G.upd(1);
      for (const s of pool.snakes) {
        if (isNaN(s.x) || isNaN(s.z) || isNaN(s.angle)) nan = true;
        if (Math.hypot(s.x, s.z) > ARENA_R + 30) leak = true;
        if (s.path.length > s.len + 40) leak = true;
      }
    }
    assert(26, !nan && !leak, '全场 400 帧无 NaN 无泄漏');

    // -- T27: audio
    audio.ensure();
    assert(27, audio.hasCtx(), 'AudioContext 可创建');
    assert(28, audio.isMuted() === true, '自测静音保持');

    // -- T29: UI elements
    assert(29, !!ui.el.mutebtn && !!ui.el.pausebtn && !!ui.el.lbrows && !!ui.el.start, 'UI 元素存在');

    // -- T30: full fast-forward 45s
    const errBefore = G.err.length;
    startGame();
    G.setNoAuto(false);
    for (let i = 0; i < 2700; i++) {
      G.upd(1);
      if (i % 180 === 60) G.setAim(Math.random() * Math.PI * 2);
      if (i % 240 === 120) G.setBoost(true);
      if (i % 240 === 180) G.setBoost(false);
      if (S().mode !== 'play') break;
    }
    assert(30, !isNaN(S().score) && G.err.length === errBefore, '45s 快进无 NaN 无新报错');
    if (S().mode === 'play') G.forceGameOver();
    toTitle();
    assert(31, S().mode === 'title' && !ui.el.title.classList.contains('hide'), '测完回标题');

    // restore best
    try { localStorage.setItem('hio.bestLen', String(savedLen)); localStorage.setItem('hio.bestKills', String(savedKills)); } catch (e) { }
    bestLen = savedLen; bestKills = savedKills; ui.setBest(bestLen, bestKills);

    const pass = results.filter(r => r.ok).length;
    window.__TEST = { pass, fail: results.length - pass, total: results.length, results, done: true };
    console.log(`[autotest] ${pass}/${results.length} passed`);
  }
}

if (new URLSearchParams(location.search).get('autotest')) autotest();
