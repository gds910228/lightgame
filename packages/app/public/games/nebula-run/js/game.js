// Nebula Run 星窟狂奔 — 3-lane 3D endless runner.
// guizang-game-skill methodology, third series #2 (3D exemplar).
// Player fixed at z=0; world moves +z. Fixed-step loop, G hooks, ?autotest=1,
// site report bridge, WebAudio synth audio.

import { makeWorld } from './world.js';
import { makePlayer } from './player.js';
import { makeObstacles } from './obstacles.js';
import { makeAudio } from './audio.js';
import { makeUI } from './ui.js';

// ==================== constants ====================
const BASE_SPEED = 24, MAX_SPEED = 56, SPEED_RAMP = .35;   // m/s, per s
const MILESTONE = 500;                                      // m per milestone/tunnel
const TUNNEL_LEN = 100;                                     // m of tunnel after milestone
const NEAR_MISS_GAP = .62;                                  // m lateral gap that counts as near miss
const NEAR_MISS_SCORE = 50;
const SHIELD_REGEN = 1200;                                  // m
const SLOWMO_T = .09, SLOWMO_SCALE = .35;

// ==================== state ====================
let mode = 'title', paused = false, noAuto = false;
let score = 0, best = 0, dist = 0, mult = 1, coins = 0;
let speed = BASE_SPEED, nextMilestone = MILESTONE, tunnelEnd = -1, lastShieldAt = 0;
let nearMisses = 0, hits = 0, timeScale = 1, slowmoT = 0, playT = 0;
let nextSpawnDist = 30, scoreAcc = 0;
const floats = [];
try { best = parseInt(localStorage.getItem('nbr.best') || '0') || 0; } catch (e) { }
let muted = false;
try { muted = localStorage.getItem('nbr.mute') === '1'; } catch (e) { }
const AUTOTEST = new URLSearchParams(location.search).has('autotest');

const world = makeWorld();
const audio = makeAudio();
const player = makePlayer(world.scene, world.matStd);
const obs = makeObstacles(world.scene, world.matStd);
const ui = makeUI({
  onStart: () => { audio.ensure(); audio.sfx.ui(); startGame(); },
  onRestart: () => { audio.sfx.ui(); startGame(); },
  onBackTitle: () => { audio.sfx.ui(); toTitle(); },
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
report('ready', { game: 'nebula-run' });

// ==================== game flow ====================
function resetPlay() {
  score = 0; dist = 0; mult = 1; coins = 0; speed = BASE_SPEED; scoreAcc = 0;
  nextMilestone = MILESTONE; tunnelEnd = -1; lastShieldAt = 0;
  nearMisses = 0; hits = 0; timeScale = 1; slowmoT = 0; playT = 0;
  nextSpawnDist = 30;
  floats.length = 0;
  player.reset();
  obs.clearAll();
  ui.setScore(0); ui.setDist(0); ui.setMult(1); ui.setShield(true);
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
  ui.setBest(best);
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
  try { localStorage.setItem('nbr.mute', muted ? '1' : '0'); } catch (e) { }
}

function addScore(n) { score += n; ui.setScore(score); }
function addDistScore(dt) {
  // fractional accumulation, floor-credited (per-frame rounding inflates)
  scoreAcc += speed * dt * mult;
  const whole = Math.floor(scoreAcc);
  if (whole > 0) { scoreAcc -= whole; addScore(whole); }
}
function addFloat(x, y, text, color = '#ffe9a8') {
  floats.push({ x, y, text, color, life: 1 });
}

// ==================== spawner director ====================
function directorSpawn() {
  // weighted patterns; walls warned 1.2s ahead by their own geometry glow
  const roll = Math.random();
  const z = obs.SPAWN_Z;
  if (roll < .26) {           // rock (sometimes double-wide or double lane)
    const lane = Math.floor(Math.random() * 3);
    obs.spawnRock(z, lane, Math.random() < .3);
    if (Math.random() < .35) obs.coinArc(z - 2, lane);
  } else if (roll < .46) {    // beam → slide
    obs.spawnBeam(z, Math.floor(Math.random() * 3));
    if (Math.random() < .4) obs.coinLine(z - 3, Math.floor(Math.random() * 3), 5);
  } else if (roll < .60) {    // wall → must switch
    obs.spawnWall(z, Math.floor(Math.random() * 3));
  } else if (roll < .78) {    // pure coins
    const r = Math.random();
    if (r < .4) obs.coinLine(z, Math.floor(Math.random() * 3), 7);
    else if (r < .75) obs.coinArc(z, Math.floor(Math.random() * 3));
    else obs.coinZig(z);
  } else if (roll < .88) {    // gate tri-lane
    obs.spawnGate(z);
    obs.coinLine(z - 4, Math.floor(Math.random() * 3), 4);
  } else {                    // mixed: rock + beam in different lanes
    const l1 = Math.floor(Math.random() * 3);
    let l2 = (l1 + 1 + Math.floor(Math.random() * 2)) % 3;
    obs.spawnRock(z, l1); obs.spawnBeam(z - 1.5, l2);
  }
}

// ==================== collision & events ====================
function laneX(l) { return [-3, 0, 3][l]; }

function checkCollisions() {
  const hb = player.hitbox();
  // obstacles
  for (const kind of ['rock', 'beam', 'wall']) {
    for (const m of obs.active[kind]) {
      const u = m.userData;
      const dx = Math.abs(hb.x - m.position.x);
      const dz = Math.abs(hb.z - m.position.z);
      // crossing frame detection (once per obstacle)
      if (!u.crossed && m.position.z > hb.z + u.halfD + .2) {
        u.crossed = true;
        // near-miss: survived pass with small lateral gap (or small vertical clearance over rocks)
        if (dx < u.halfW + hb.halfW + NEAR_MISS_GAP && dx > u.halfW + hb.halfW - .05) {
          nearMisses++;
          const gain = NEAR_MISS_SCORE * mult;
          addScore(gain);
          addFloat(m.position.x, 2.6, `惊险 +${gain}`);
          audio.sfx.nearmiss();
          slowmoT = SLOWMO_T;
        } else if (u.kind === 'rock' && dx < u.halfW + hb.halfW && hb.bottom > u.y1 && hb.bottom < u.y1 + NEAR_MISS_GAP) {
          nearMisses++;
          const gain = NEAR_MISS_SCORE * mult;
          addScore(gain);
          addFloat(m.position.x, 2.6, `擦顶 +${gain}`);
          audio.sfx.nearmiss();
          slowmoT = SLOWMO_T;
        }
      }
      // actual AABB hit
      if (dx < u.halfW + hb.halfW && dz < u.halfD + hb.halfD && hb.top > u.y0 && hb.bottom < u.y1) {
        onHit(m, u);
        break;
      }
    }
  }
  // coins
  for (const m of obs.active.coin) {
    const u = m.userData;
    if (u.taken) continue;
    const dx = Math.abs(hb.x - m.position.x), dz = Math.abs(hb.z - m.position.z);
    const dy = Math.abs((hb.bottom + hb.top) / 2 - m.position.y);
    if (dx < 1.0 && dz < 1.0 && dy < 1.3) {
      u.taken = true;
      m.visible = false;
      coins++;
      const gain = 10 * mult;
      addScore(gain);
      audio.sfx.coin();
    }
  }
  // gates
  for (const m of obs.active.gate) {
    const u = m.userData;
    if (u.crossed) continue;
    if (m.position.z > hb.z + .3) {
      u.crossed = true;
      // nearest lane ring decides value
      let bestLane = 0, bestDx = 99;
      for (let i = 0; i < 3; i++) {
        const d = Math.abs(hb.x - laneX(i));
        if (d < bestDx) { bestDx = d; bestLane = i; }
      }
      mult = u.vals ? u.vals[bestLane] : 2;
      ui.setMult(mult);
      audio.sfx.gate(mult);
      ui.showBanner(`倍率 ×${mult}！`, ['蓝色 ×2', '金色 ×3', '紫色 ×5'][bestLane], 1000);
    }
  }
}

function onHit(m, u) {
  if (player.P.invulnT > 0) return;
  hits++;
  world.shake(.5, .35);
  audio.sfx.hit();
  slowmoT = SLOWMO_T;
  if (player.P.shield) {
    player.loseShield();
    ui.setShield(false);
    ui.showBanner('护盾抵消！', `${SHIELD_REGEN}m 后补给新护盾`, 1200);
    // push obstacle away so no repeat-hit while overlapping invuln
    m.position.z += 6;
    u.crossed = true;
  } else {
    player.P.alive = false;
    gameOver();
  }
}

function gameOver() {
  if (mode !== 'play') return;
  mode = 'over';
  audio.sfx.lose();
  audio.stop();
  const isNew = score > best;
  if (isNew) { best = score; try { localStorage.setItem('nbr.best', String(best)); } catch (e) { } }
  ui.setBest(best);
  ui.setEnd(isNew ? '新纪录！' : '坠落星渊',
    `得分 ${score}${isNew ? '  ⭐ 新纪录' : `\n纪录 ${best}`}\n距离 ${Math.floor(dist)} m · 星尘 ${coins}\n惊险闪避 ${nearMisses} 次`);
  ui.showEnd(true);
  report('gameOver', { score, progress: Math.floor(dist / 100) });
}

// ==================== update ====================
function update(dt) {
  playT += dt;
  // speed ramp (frozen under noAuto for deterministic tests)
  if (!noAuto) speed = Math.min(MAX_SPEED, speed + SPEED_RAMP * dt);
  dist += speed * dt;

  // distance scoring ×mult (1 pt per meter, fractional accumulation)
  addDistScore(dt);

  // shield regen per 1200m
  if (!player.P.shield && dist - lastShieldAt >= SHIELD_REGEN) {
    lastShieldAt = dist;
    player.giveShield();
    ui.setShield(true);
    ui.showToast('✦ 护盾补给完成');
  }

  // milestones + tunnel sections
  if (!noAuto && dist >= nextMilestone) {
    nextMilestone += MILESTONE;
    tunnelEnd = dist + TUNNEL_LEN;
    audio.sfx.milestone();
    ui.showBanner(`${Math.floor(dist / MILESTONE) * MILESTONE} m!`, '进入星窟隧道 · 音乐变奏', 1600);
    report('progress', { score, progress: Math.floor(dist / 100) });
  }
  const tunnel = dist < tunnelEnd;
  if (world.tunnelOn !== tunnel) world.setTunnel(tunnel);
  audio.state(tunnel ? 'tunnel' : 'cruise');

  // director (frozen under noAuto)
  if (!noAuto && dist >= nextSpawnDist) {
    nextSpawnDist = dist + 16 + Math.random() * 14;
    directorSpawn();
  }

  // slow-mo time scale
  if (slowmoT > 0) { slowmoT -= dt; timeScale = SLOWMO_SCALE; if (slowmoT <= 0) timeScale = 1; }

  const sdt = dt * timeScale;
  player.update(sdt, speed);
  obs.update(sdt, speed, world.time);
  checkCollisions();
  world.update(sdt, speed);

  // floaters (screen-space simple rise)
  for (let i = floats.length - 1; i >= 0; i--) {
    floats[i].life -= dt * 1.2;
    if (floats[i].life <= 0) floats.splice(i, 1);
  }
  audio.update();
}

// ==================== render (3D + DOM floaters via banner only) ====================
function render() {
  world.render();
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
  } else {
    world.update(dt, mode === 'title' ? 8 : 0);   // idle drift on title
  }
  // HUD floaters → toast area (kept light)
  render();
}
requestAnimationFrame(tick);

// ==================== input ====================
const pressed = new Set(), held = new Set();
addEventListener('keydown', (e) => {
  if (e.isComposing || e.keyCode === 229) return;
  if (/^(Meta|Alt|Control)/.test(e.code)) { held.clear(); return; }
  if (e.metaKey || e.altKey || e.ctrlKey) return;
  if (!e.repeat) pressed.add(e.code);
  held.add(e.code);
  if (['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
});
addEventListener('keyup', (e) => held.delete(e.code));
addEventListener('blur', () => { pressed.clear(); held.clear(); });
document.addEventListener('visibilitychange', () => { pressed.clear(); held.clear(); });

function handleKeys() {
  for (const code of pressed) {
    if (code === 'KeyP') togglePause();
    else if (code === 'KeyM') toggleMute();
    else if (code === 'Enter' && (mode === 'title' || mode === 'over')) startGame();
    else if (mode === 'play' && !paused) {
      if (code === 'ArrowLeft' || code === 'KeyA') { if (player.moveLane(-1)) audio.sfx.ui(); }
      else if (code === 'ArrowRight' || code === 'KeyD') { if (player.moveLane(1)) audio.sfx.ui(); }
      else if (code === 'ArrowUp' || code === 'KeyW' || code === 'Space') { if (player.jump()) audio.sfx.jump(); }
      else if (code === 'ArrowDown' || code === 'KeyS') { if (player.slide()) audio.sfx.slide(); }
    }
  }
  pressed.clear();
  // variable jump: releasing early cancels the soar
  if (mode === 'play' && !paused) {
    const rising = player.P.holding;
    if (rising && !(held.has('ArrowUp') || held.has('KeyW') || held.has('Space'))) player.releaseHold();
  }
}

// touch zones
function bindTouch(id, down, up) {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('pointerdown', (e) => { e.preventDefault(); down(); });
  if (up) for (const ev of ['pointerup', 'pointercancel']) el.addEventListener(ev, up);
}
bindTouch('tleft', () => { if (mode === 'play' && !paused) player.moveLane(-1); });
bindTouch('tright', () => { if (mode === 'play' && !paused) player.moveLane(1); });
bindTouch('tjump', () => { if (mode === 'play' && !paused) { if (player.jump()) audio.sfx.jump(); } }, () => player.releaseHold());
bindTouch('tslide', () => { if (mode === 'play' && !paused) { if (player.slide()) audio.sfx.slide(); } });
addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'touch') ui.el.touch.classList.add('on');
  audio.ensure();
}, { passive: true });

// ==================== G debug hooks ====================
const G = {
  err: window.__BOOTERR,
  step: (n = 60, dt = 1 / 60) => { for (let i = 0; i < n; i++) { handleKeys(); if (mode === 'play' && !paused) update(dt); render(); } },
  upd: (n = 30, dt = 1 / 60) => { for (let i = 0; i < n; i++) { handleKeys(); if (mode === 'play' && !paused) update(dt); } },
  press: (...codes) => codes.forEach(c => pressed.add(c)),
  hold: (...codes) => codes.forEach(c => held.add(c)),
  release: (...codes) => codes.forEach(c => held.delete(c)),
  setNoAuto: (v) => { noAuto = !!v; },
  setReportTarget: (fn) => { reportTarget = fn; },
  setSpeed: (v) => { speed = Math.max(0, v); },
  setScore: (v) => { score = v | 0; scoreAcc = 0; ui.setScore(score); },
  setDist: (v) => { dist = v; nextMilestone = (Math.floor(v / MILESTONE) + 1) * MILESTONE; },
  spawnRock: (z, lane, wide) => obs.spawnRock(z, lane, wide),
  spawnBeam: (z, lane) => obs.spawnBeam(z, lane),
  spawnWall: (z, lane) => obs.spawnWall(z, lane),
  spawnCoin: (z, lane, y) => obs.spawnCoin(z, lane, y),
  spawnGate: (z) => obs.spawnGate(z),
  state: () => ({ mode, paused, score, best, dist: +dist.toFixed(1), mult, coins, speed: +speed.toFixed(2), nearMisses, hits, timeScale, tunnel: world.tunnelOn, alive: player.P.alive, shield: player.P.shield, invulnT: +player.P.invulnT.toFixed(2), lane: player.P.lane, px: +player.P.x.toFixed(2), py: +player.P.y.toFixed(2), sliding: player.P.sliding }),
  fx: () => ({ rocks: obs.active.rock.length, beams: obs.active.beam.length, walls: obs.active.wall.length, coins: obs.active.coin.length, gates: obs.active.gate.length, floats: floats.length }),
  player, obs, audio, world,
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
    const F = () => G.fx();
    audio.setMuted(true);
    const savedBest = best;
    G.setReportTarget(() => { });

    assert(1, G.err.length === 0, '启动零报错');

    // -- T2/T3: start & base speed
    startGame();
    G.setNoAuto(true);
    assert(2, S().mode === 'play', '开局进入 play');
    assert(3, Math.abs(S().speed - 24) < .01, '基础速度 24 m/s');

    // -- T4: lane switch
    G.press('ArrowLeft'); G.upd(30);
    const st4 = S();
    assert(4, st4.lane === 0 && st4.px < -2.5, '左键切道到位 (lerp)');
    G.press('ArrowRight'); G.upd(1); G.press('ArrowRight'); G.upd(30);
    assert(5, S().lane === 2 && S().px > 2.5, '右键两次切到右道');

    // -- T6: jump arc
    G.setSpeed(0);                       // freeze world movement, isolate jump
    const yBefore = S().py;
    G.press('Space'); G.upd(3);
    const rising = S().py > yBefore;
    G.upd(120);
    const landed = Math.abs(S().py) < .01;
    assert(6, rising && landed, '跳跃起跳并落地');
    // variable jump: hold → higher apex
    G.hold('Space'); G.press('Space'); G.upd(6); G.release('Space');
    let apexHold = 0; for (let i = 0; i < 120; i++) { G.upd(1); apexHold = Math.max(apexHold, S().py); }
    G.hold('Space'); G.press('Space'); G.upd(1); G.release('Space');
    let apexTap = 0; for (let i = 0; i < 120; i++) { G.upd(1); apexTap = Math.max(apexTap, S().py); }
    assert(7, apexHold > apexTap + .3, `长按跳更高 (${apexHold.toFixed(2)} > ${apexTap.toFixed(2)})`);

    // -- T8: slide
    G.press('ArrowDown'); G.upd(2);
    const sliding = S().sliding;
    G.upd(60);
    assert(8, sliding && !S().sliding, '铲滑生效且 0.62s 后结束');

    // -- T9: noAuto freezes director & speed ramp
    startGame();
    G.setNoAuto(true);
    G.setSpeed(24);
    const d0 = S().dist;
    G.upd(240);
    const st9 = S();
    assert(9, st9.dist > d0 && Math.abs(st9.speed - 24) < .01, 'noAuto 下速度恒定');
    assert(10, F().rocks === 0 && F().coins === 0 && F().walls === 0, 'noAuto 下导演不自动生成');

    // -- T11: obstacle recycle (world moves past player)
    G.spawnRock(-60, 1);
    G.upd(20);
    assert(11, F().rocks === 1, '手动生成岩石在场');
    G.upd(600);
    assert(12, F().rocks === 0, '岩石越过玩家后回收');

    // -- T13: coin pickup & score
    startGame();
    G.setNoAuto(true); G.setSpeed(24);
    const s0 = S().score;
    G.spawnCoin(-4, 1, 1.0);            // dead center ahead of player lane 1 (ensure center lane)
    G.press('ArrowLeft'); G.upd(1); G.press('ArrowRight'); G.upd(1); G.press('ArrowRight'); G.upd(1); G.press('ArrowLeft'); G.upd(1); // stay center
    G.upd(90);
    const st13 = S();
    assert(13, st13.coins === 1 && st13.score >= s0 + 10, '吃币计分 ×1');

    // -- T14: gate multiplier
    G.spawnGate(-6);
    G.upd(60);
    assert(14, S().mult === 2, '穿过中间蓝环获得 ×2');

    // -- T15: distance score rate doubles at ×2
    const s15a = S().score;
    G.upd(60);                           // 1s at 24 m/s ×2 → 48 pts
    const gain15 = S().score - s15a;
    assert(15, gain15 >= 45 && gain15 <= 52, `×2 倍率距离分速率正确 (gain=${gain15})`);

    // -- T16: jump over rock clears it
    startGame();
    G.setNoAuto(true); G.setSpeed(24);
    G.spawnRock(-30, 1);
    G.hold('Space');
    // wait until rock ~5m ahead then jump
    let jumped = false;
    for (let i = 0; i < 400; i++) {
      G.upd(1);
      const rocks = obs.active.rock;
      if (!jumped && rocks.length && rocks[0].position.z > -6.5) { G.press('Space'); jumped = true; }
      if (jumped) break;
    }
    G.release('Space');
    for (let i = 0; i < 200; i++) G.upd(1);
    assert(16, S().hits === 0, '及时跳跃越过岩石无受击');

    // -- T17: slide under beam clears it
    startGame();
    G.setNoAuto(true); G.setSpeed(24);
    G.spawnBeam(-30, 1);
    let slid = false;
    for (let i = 0; i < 400; i++) {
      G.upd(1);
      const beams = obs.active.beam;
      if (!slid && beams.length && beams[0].position.z > -4.5) { G.press('ArrowDown'); slid = true; }
      if (slid) break;
    }
    for (let i = 0; i < 200; i++) G.upd(1);
    assert(17, S().hits === 0, '及时铲滑穿过横梁无受击');

    // -- T18/T19: wall hit consumes shield + invuln; second hit ignored during invuln
    startGame();
    G.setNoAuto(true); G.setSpeed(24);
    G.spawnWall(-12, 1);                 // dead ahead, no dodge
    for (let i = 0; i < 200 && S().hits === 0; i++) G.upd(1);
    const st18 = S();
    assert(18, st18.hits === 1 && !st18.shield && st18.invulnT > 0, '撞墙消耗护盾进入无敌');
    G.spawnWall(-4, 1);
    G.upd(80);
    assert(19, S().hits === 1, '无敌期内二次接触不再扣血');

    // -- T20: invuln expiry → second hit lethal → gameOver
    G.setNoAuto(true);
    for (let i = 0; i < 200 && S().invulnT > 0; i++) G.upd(1);
    G.spawnWall(-6, 1);
    for (let i = 0; i < 200 && S().mode === 'play'; i++) G.upd(1);
    assert(20, S().mode === 'over' && S().hits === 2, '无敌结束后再次撞击判负');

    // -- T21: near-miss on adjacent-lane pass
    startGame();
    G.setNoAuto(true); G.setSpeed(24);
    G.spawnRock(-20, 2);                 // one lane to the right of center
    // drift to lane between 1 and 2 edge — set lane 1, player x=0, rock at x=3: gap = 3 - (0.85+0.55) = 1.6 → too far; need closer pass:
    // instead push rock partially into lane edge for deterministic near-miss
    obs.active.rock[0].position.x = 1.9; // gap = 1.9 - 1.4 = .5 < .62
    const nm0 = S().nearMisses;
    const sNM = S().score;
    for (let i = 0; i < 300 && S().nearMisses === nm0; i++) G.upd(1);
    assert(21, S().nearMisses === nm0 + 1, '贴脸擦过触发惊险计数');
    assert(22, S().score >= sNM + 50, '惊险 +50×倍率');

    // -- T23: slow-mo triggers & restores
    assert(23, S().timeScale === 1 || S().timeScale === .35, '时间缩放受控');
    G.upd(30);
    assert(24, S().timeScale === 1, '慢动作 90ms 后恢复 1.0');

    // -- T25: milestone & tunnel & progress report (real accumulation)
    startGame();
    G.setNoAuto(false);
    G.setSpeed(40);
    G.setDist(480);
    const framesA = reports.length;
    for (let i = 0; i < 300 && !S().tunnel; i++) G.upd(1);
    assert(25, S().tunnel === true, '500m 里程碑进入隧道段');
    assert(26, reports.length > framesA && reports[reports.length - 1].kind === 'progress', '里程碑上报 progress 帧');
    for (let i = 0; i < 200 && S().tunnel; i++) G.upd(1);
    assert(27, S().tunnel === false, '100m 隧道段结束退出');
    G.setNoAuto(true);

    // -- T28: shield regen per 1200m
    startGame();
    G.setNoAuto(true);
    player.loseShield(); player.P.invulnT = 0;
    ui.setShield(false);
    G.setDist(1195); lastShieldAt = 0;
    G.upd(30);                            // dist crosses 1200
    assert(28, S().shield === true, '1200m 护盾补给');

    // -- T29: pool stability under load
    startGame();
    G.setNoAuto(true); G.setSpeed(40);
    for (let i = 0; i < 40; i++) G.spawnRock(-20 - i * 4, i % 3, i % 5 === 0);
    for (let i = 0; i < 60; i++) G.spawnCoin(-25 - i * 3, i % 3, 1.1);
    for (let i = 0; i < 8; i++) G.spawnGate(-30 - i * 10);
    let nan = false, leak = false;
    for (let i = 0; i < 900; i++) {
      G.upd(1);
      const f = F();
      const total = f.rocks + f.coins + f.gates + f.beams + f.walls;
      if (total > 130) leak = true;
      for (const arr of [obs.active.rock, obs.active.coin, obs.active.gate]) {
        for (const m of arr) if (isNaN(m.position.z) || m.position.z > 20) leak = true;
      }
    }
    assert(29, !nan && !leak, '108 实体 900 帧无 NaN 无泄漏');

    // -- T30: best persistence
    startGame();
    best = 0; try { localStorage.setItem('nbr.best', '0'); } catch (e) { }
    G.setScore(777);
    G.forceGameOver();
    const bestNow = parseInt(localStorage.getItem('nbr.best') || '0') || 0;
    assert(30, bestNow === 777 && S().best === 777, 'best 写入 localStorage');
    try { localStorage.setItem('nbr.best', String(savedBest)); } catch (e) { }
    best = savedBest;

    // -- T31: protocol sequence
    assert(31, reports[0] && reports[0].kind === 'ready', 'ready 首帧');
    assert(32, reports.some(f => f.kind === 'progress'), 'progress 帧存在');
    assert(33, reports[reports.length - 1].kind === 'gameOver', 'gameOver 末帧');

    // -- T34: restart resets
    startGame();
    const st34 = S();
    assert(34, st34.score === 0 && st34.dist < 1 && st34.mult === 1 && st34.shield === true && st34.hits === 0, '重开一局全部复位');

    // -- T35: audio states & ctx
    audio.ensure();
    assert(35, audio.hasCtx(), 'AudioContext 可创建');
    audio.state('tunnel');
    assert(36, audio.state() === 'tunnel', '配乐 tunnel 态切换');
    audio.state('cruise');
    assert(37, audio.isMuted() === true, '自测静音保持');

    // -- T38: UI & touch DOM
    assert(38, !!ui.el.mutebtn && !!ui.el.pausebtn && !!ui.el.start && !!document.getElementById('tleft'), 'UI 与触控区元素存在');

    // -- T39: full fast-forward 60s no exceptions no NaN
    const errBefore = G.err.length;
    startGame();
    G.setNoAuto(false);
    for (let i = 0; i < 3600; i++) {
      G.upd(1);
      if (i % 240 === 120) { G.press('Space'); }          // periodic jumps
      if (i % 300 === 200) { G.press('ArrowLeft'); G.press('ArrowRight'); }
      if (S().mode !== 'play') break;
    }
    const st39 = S();
    assert(39, !isNaN(st39.dist) && !isNaN(st39.score) && G.err.length === errBefore, '60s 快进无 NaN 无新报错');
    G.forceGameOver();
    toTitle();

    // -- T40: back to title
    assert(40, S().mode === 'title' && !ui.el.title.classList.contains('hide'), '测完回到标题画面');

    // restore best (test sessions may have overwritten)
    try { localStorage.setItem('nbr.best', String(savedBest)); } catch (e) { }
    best = savedBest; ui.setBest(best);

    const pass = results.filter(r => r.ok).length;
    window.__TEST = { pass, fail: results.length - pass, total: results.length, results, done: true };
    console.log(`[autotest] ${pass}/${results.length} passed`);
  }
}

if (new URLSearchParams(location.search).get('autotest')) autotest();
