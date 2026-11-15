// Main: boot, fixed-step loop, wave director, camera-relative movement, music state,
// G debug hooks (step/upd/press/shot), ?params, and the ?autotest=1 self-test suite.
import * as THREE from '../vendor/three.module.min.js';
import { keys, pressed, endFrame, debugPanel, initTouch, stick } from './input.js';
import { makeWorld } from './world.js';
import { makeFX } from './fx.js';
import { makeAudio } from './audio.js';
import { makeUI } from './ui.js';
import { Player, Walker, Caster, Boss, Loot, angDiff } from './actors.js';
import { V } from './rig.js';

const DT = 1 / 60;
const Q = new URLSearchParams(location.search);
const AUTO = Q.has('auto') || Q.has('autotest');
const AUTOTEST = Q.has('autotest');
const GOD = Q.has('god');
const STAGE = Q.get('stage') || '';
const SHOW = Q.get('show') || '';

// ---- boot ----
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.18;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.getElementById('app').appendChild(renderer.domElement);

const world = makeWorld(renderer);
const fx = makeFX(world.scene);
const audio = makeAudio();
const ui = makeUI();
const ash = fx.makeAsh(world.camera);
if (AUTOTEST) audio.mute(true);
if (Q.has('mute')) audio.mute(true);

const ctx = {
  scene: world.scene, fx, audio, ui, colliders: world.colliders,
  player: null, enemies: [], projectiles: [], loots: [],
  meleeToken: null, moveDir: V(), parryHeld: false,
  timeScale: 1, slowT: 0, time: 0,
  shake(a) { world.rig.shake(a); },
  slowmo(scale, dur) { this.timeScale = scale; this.slowT = dur; },
  onDeath: null, onPlayerDeath: null, onBossPhase2: null, onBossDeath: null,
};
ctx.player = new Player(ctx);
ctx.player.pos.set(0, 0, 10);
ctx.player.facing = Math.PI; // face the altar (north, -Z is toward gate; altar at -7.5)
let state = 'title';
let stateT = 0;

// ---- director ----
const WAVES = [
  { walkers: 3, casters: 0, label: '第 一 波' },
  { walkers: 2, casters: 1, label: '第 二 波' },
  { walkers: 3, casters: 2, label: '第 三 波' },
];
const director = { wave: -1, phase: 'calm', calmT: 1.2, bossSpawned: false };

// ---- upgrade pool: offered 3-at-a-time after each cleared wave (roguelite-lite) ----
const UPGRADES = [
  { id: 'atk',   name: '锋 锐', desc: '攻击伤害 +15%', max: 5, apply(p) { p.mods.dmg += .15; } },
  { id: 'hp',    name: '罡 体', desc: '生命上限 +25，并立即回复 25', max: 5, apply(p) { p.maxHp += 25; p.hp = Math.min(p.maxHp, p.hp + 25); } },
  { id: 'spd',   name: '疾 风', desc: '移动速度 +10%', max: 4, apply(p) { p.mods.speed += .1; } },
  { id: 'wave',  name: '剑 气 弹', desc: '重击第三段放出飞行剑气，再次选择提升伤害', max: 3, apply(p) { if (p.mods.swordWave === 0) p.mods.swordWave = 1; else p.mods.waveDmg += 10; } },
  { id: 'leech', name: '汲 血', desc: '每次命中回复 1.5 生命', max: 4, apply(p) { p.mods.lifesteal += 1.5; } },
  { id: 'dash',  name: '流 影', desc: '闪避消耗 -5，冷却 -25%', max: 3, apply(p) { p.mods.dashCost = Math.max(10, p.mods.dashCost - 5); p.mods.dashCd *= .75; } },
  { id: 'tough', name: '韧 皮', desc: '受到的伤害 -12%', max: 4, apply(p) { p.mods.dmgTaken = Math.max(.4, p.mods.dmgTaken * .88); } },
  { id: 'stam',  name: '气 海', desc: '体力上限 +30，回复速度 +20%', max: 4, apply(p) { p.maxStamina += 30; p.stamina = Math.min(p.maxStamina, p.stamina + 20); p.mods.stamRegen *= 1.2; } },
  { id: 'parry', name: '听 风', desc: '弹反窗口 +0.08s，反击窗口 +0.25s', max: 3, apply(p) { p.mods.parryWin += .08; p.mods.counterWin += .25; } },
  { id: 'heavy', name: '崩 山', desc: '重击伤害 +25%', max: 4, apply(p) { p.mods.heavy += .25; } },
];
function offerUpgrades() {
  const p = ctx.player;
  const pool = UPGRADES.filter(u => (p.upgradeCounts[u.id] || 0) < u.max);
  if (!pool.length) { director.phase = 'calm'; director.calmT = 2.2; return; }
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0;[pool[i], pool[j]] = [pool[j], pool[i]]; }
  ctx.pendingUpgrades = pool.slice(0, 3);
  director.phase = 'choose';
  ui.showUpgrades(ctx.pendingUpgrades.map(u => ({ name: u.name, desc: u.desc, stacks: p.upgradeCounts[u.id] || 0 })), pickUpgrade);
  ui.banner('择 一 而 强', '点击或按 1 / 2 / 3', 2.2);
}
function pickUpgrade(i) {
  const u = ctx.pendingUpgrades && ctx.pendingUpgrades[i];
  if (!u || director.phase !== 'choose') return;
  u.apply(ctx.player);
  ctx.player.upgradeCounts[u.id] = (ctx.player.upgradeCounts[u.id] || 0) + 1;
  ui.toast('已获强化：' + u.name.replace(/ /g, ''));
  ui.upgradeList(Object.entries(ctx.player.upgradeCounts).map(([id, n]) => {
    const def = UPGRADES.find(x => x.id === id);
    return def ? def.name.replace(/ /g, '') + '×' + n : '';
  }).filter(Boolean).join('　'));
  ui.hideUpgrades();
  ctx.pendingUpgrades = null;
  director.phase = 'calm'; director.calmT = 1.4;
  audio.S.drop(1);
}

function spawnPoint(minDistFromPlayer = 6) {
  for (let i = 0; i < 24; i++) {
    const a = Math.random() * Math.PI * 2, r = 11 + Math.random() * 5;
    const p = V(Math.cos(a) * r, 0, Math.sin(a) * r);
    if (p.distanceTo(ctx.player.pos) > minDistFromPlayer) return p;
  }
  return V(12, 0, 0);
}
function spawnEnemy(kind) {
  const p = spawnPoint();
  const e = kind === 'walker' ? new Walker(ctx, p) : new Caster(ctx, p);
  ctx.enemies.push(e);
  return e;
}
function startWave(i) {
  director.wave = i; director.phase = 'fight';
  const w = WAVES[i];
  ui.banner(w.label, '歼灭来犯之敌');
  for (let k = 0; k < w.walkers; k++) spawnEnemy('walker');
  for (let k = 0; k < w.casters; k++) spawnEnemy('caster');
  audio.setMusic('combat');
}
function startBoss() {
  director.phase = 'boss';
  const b = new Boss(ctx, V(0, 0, -7.5 - 6));
  b.facing = 0;
  ctx.enemies.push(b); ctx.boss = b;
  ui.banner('守 卫 苏 醒', '石祠的守护者睁开了眼');
  audio.setMusic('boss');
  audio.S.roar();
  ctx.onBossPhase2 = () => { ui.banner('守 卫 之 怒', '石躯灼热，动作更快'); };
  ctx.onBossDeath = () => {
    ctx.slowmo(.35, 1.2);
    audio.S.win();
    setTimeout(() => { if (state === 'play') { state = 'win'; stateT = 0; ui.end('夜 尽 天 明', '你守住了剑祠'); audio.setMusic('explore'); } }, 2200);
  };
}
function advanceDirector(dt) {
  if (ctx.noDirector || director.phase === 'choose') return;   // 'choose' waits for the player's pick
  if (director.phase === 'calm') {
    director.calmT -= dt;
    if (director.calmT <= 0) {
      if (director.wave + 1 < WAVES.length) startWave(director.wave + 1);
      else if (!director.bossSpawned) { director.bossSpawned = true; startBoss(); }
    }
  } else if (director.phase === 'fight') {
    const alive = ctx.enemies.some(e => e.alive);
    if (!alive && ctx.enemies.length) {
      // wave cleared: small heal, then the three-choice upgrade offer
      ctx.enemies.length = 0; // corpses already removed by cleanup loop
      ctx.player.hp = Math.min(ctx.player.maxHp, ctx.player.hp + 8);
      ui.toast('喘息 · 生命回复 +8');
      offerUpgrades();
    }
  }
}
function jumpStage(s) {
  clearAll();
  ctx.player.hp = ctx.player.maxHp; ctx.player.stamina = ctx.player.maxStamina;
  ctx.player.pos.set(0, 0, 10); ctx.player.facing = Math.PI;
  if (s === 'w1') { director.wave = -1; director.phase = 'calm'; director.calmT = .1; }
  else if (s === 'w2') { director.wave = 0; director.phase = 'calm'; director.calmT = .1; }
  else if (s === 'w3') { director.wave = 1; director.phase = 'calm'; director.calmT = .1; }
  else if (s === 'boss') { director.wave = 2; director.phase = 'calm'; director.calmT = .1; director.bossSpawned = false; }
  state = 'play'; ui.hud();
}
function clearAll() {
  for (const e of ctx.enemies) ctx.scene.remove(e.rig.grp);
  ctx.enemies.length = 0;
  for (const o of ctx.projectiles) o.kill();
  ctx.projectiles.length = 0;
  for (const l of ctx.loots) { ctx.scene.remove(l.mesh); l.col.kill(); }
  ctx.loots.length = 0;
  ctx.meleeToken = null; ctx.boss = null;
  fx.clear();
}
function resetGame() {
  clearAll();
  const p = ctx.player;
  p.resetProgress();
  ui.upgradeList('');
  ctx.pendingUpgrades = null; ui.hideUpgrades();
  p.hp = p.maxHp; p.stamina = p.maxStamina; p.alive = true; p.dead = false;
  p.state = 'idle'; p.stateT = 0; p.invulnT = 0; p.hitstopT = 0;
  p.counterT = 0; p.counterTarget = null; p.parryT = 0; p.guardHeld = false;
  p.comboIdx = 0; p.comboT = 0; p.buf = null;
  p.pos.set(0, 0, 10); p.vel.set(0, 0, 0); p.facing = Math.PI;
  p.setIdle();
  director.wave = -1; director.phase = 'calm'; director.calmT = 1.2; director.bossSpawned = false;
  ctx.onBossPhase2 = null; ctx.onBossDeath = null;
  world.rig.reset();
  ui.hideEnd();
  ui.hud();                    // reveal HUD and hide the title overlay (start / retry paths)
  state = 'play'; stateT = 0;
  audio.setMusic('explore');
}
ctx.onPlayerDeath = () => {
  audio.S.dead();
  setTimeout(() => { if (state === 'play') { state = 'dead'; stateT = 0; ui.end('身 死 祠 破', '剑祠在夜色中陷落'); } }, 1400);
};
ctx.onDeath = (e) => {
  // loot drop on kill (skill: 掉落物)
  const roll = Math.random();
  if (e instanceof Walker && roll < .45) ctx.loots.push(new Loot(ctx, e.pos.clone(), 'heal'));
  else if (e instanceof Caster && roll < .7) ctx.loots.push(new Loot(ctx, e.pos.clone(), 'spirit'));
  if (ctx.meleeToken === e) ctx.meleeToken = null;
};

// ---- input mapping ----
initTouch();
function processInput() {
  for (const c of pressed) {
    if (c === 'KeyJ') ctx.player.press('attack');
    else if (c === 'Space') ctx.player.press('dash');
    else if (c === 'KeyK') ctx.player.press('parry');
    else if (c === 'Digit1' || c === 'Numpad1') { if (director.phase === 'choose') pickUpgrade(0); }
    else if (c === 'Digit2' || c === 'Numpad2') { if (director.phase === 'choose') pickUpgrade(1); }
    else if (c === 'Digit3' || c === 'Numpad3') { if (director.phase === 'choose') pickUpgrade(2); }
  }
  ctx.parryHeld = keys.has('KeyK');   // touch parry button adds KeyK to keys while held
  if (G && G.__manual) return;        // autotest drives moveDir directly
  // camera-relative movement
  const y = Math.PI * .18; // CAM_YAW
  const upX = -Math.sin(y), upZ = -Math.cos(y), rX = Math.cos(y), rZ = -Math.sin(y);
  let ix = 0, iz = 0;
  if (keys.has('KeyW')) { ix += upX; iz += upZ; }
  if (keys.has('KeyS')) { ix -= upX; iz -= upZ; }
  if (keys.has('KeyD')) { ix += rX; iz += rZ; }
  if (keys.has('KeyA')) { ix -= rX; iz -= rZ; }
  if (stick.active) { ix += rX * stick.x + upX * -stick.y; iz += rZ * stick.x + upZ * -stick.y; }
  ctx.moveDir.set(ix, 0, iz);
  if (ctx.moveDir.lengthSq() > 1) ctx.moveDir.normalize();
}

// ---- update ----
function update(dt) {
  ctx.time += dt;
  if (ctx.slowT > 0) { ctx.slowT -= dt; if (ctx.slowT <= 0) ctx.timeScale = 1; }
  const sdt = dt * ctx.timeScale;
  if (state === 'play' || state === 'show') processInput();
  else ctx.moveDir.set(0, 0, 0);

  if (state === 'play') {
    const p = ctx.player;
    if (GOD && p.alive) p.invulnT = Math.max(p.invulnT, .1);
    p.update(sdt);
    for (const e of ctx.enemies) e.update(sdt);
    // body push: entities keep volume (skill: 身体有体积)
    const ents = [p, ...ctx.enemies.filter(e => e.alive)];
    for (let i = 0; i < ents.length; i++) for (let j = i + 1; j < ents.length; j++) {
      const a = ents[i], b = ents[j];
      if (a.state === 'dash' || b.state === 'dash' || !a.alive || !b.alive) continue;
      const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z;
      const rr = a.radius + b.radius, d2 = dx * dx + dz * dz;
      if (d2 < rr * rr && d2 > 1e-8) {
        const d = Math.sqrt(d2), push = (rr - d) / 2 / d;
        a.pos.x -= dx * push; a.pos.z -= dz * push;
        b.pos.x += dx * push; b.pos.z += dz * push;
      }
    }
    // projectiles: enemy orbs hurt the player, the player's sword-wave hurts enemies
    for (const o of ctx.projectiles) {
      if (!o.alive) continue;
      if (o.team === 'player') {
        for (const e of ctx.enemies) {
          if (!e.alive) continue;
          if (o.pos.distanceTo(e.pos.clone().add(V(0, 1, 0))) < .8 + e.radius) {
            e.takeHit({ dmg: o.dmg, dir: o.vel.clone().setY(0).normalize(), heavy: false, from: p, knock: 1.5 });
            if (e.posture !== undefined) e.posture += 6;
            o.kill();
            fx.burst(o.pos, 0xaef0ff, { n: 7, size: .9, speed: 4 });
            audio.S.orbBreak();
            break;
          }
        }
      } else if (o.pos.distanceTo(p.pos.clone().add(V(0, 1, 0))) < .62) {
        p.receiveProj(o);
        o.kill();
        fx.burst(o.pos, 0x8fe8cc, { n: 6, size: .8, speed: 3.5 });
      }
      if (o.pos.length() > 60) o.kill();
    }
    ctx.projectiles = ctx.projectiles.filter(o => o.alive);
    for (const l of ctx.loots) l.update(sdt);
    ctx.loots = ctx.loots.filter(l => l.alive);
    advanceDirector(sdt);
    // corpses: remove rig after 1.8s
    for (let i = ctx.enemies.length - 1; i >= 0; i--) {
      const e = ctx.enemies[i];
      if (!e.alive && e.deadT > 1.8) { ctx.scene.remove(e.rig.grp); ctx.enemies.splice(i, 1); }
    }
    // music state
    if (ctx.enemies.some(e => e instanceof Boss && e.alive)) audio.setMusic('boss');
    else if (ctx.enemies.some(e => e.alive)) audio.setMusic('combat');
    else audio.setMusic('explore');
    // HUD
    const pmax = p.maxHp;
    ui.hp(p.hp / pmax, p._ghost === undefined ? p.hp / pmax : p._ghost / pmax);
    p._ghost = (p._ghost === undefined ? p.hp : p._ghost) > p.hp ? p._ghost : p.hp;
    if (p._ghost > p.hp) p._ghost = Math.max(p.hp, p._ghost - dt * 30);
    ui.stamina(p.stamina / p.maxStamina);
    ui.skillCd(2, p.dashCdT > 0 ? p.dashCdT / .45 : 0);
    if (p.dashCdT > 0) p.dashCdT -= dt;
    if (ctx.boss) ui.boss(ctx.boss.alive, '石 祠 守 卫', ctx.boss.hp / ctx.boss.maxHp, ctx.boss.posture / ctx.boss.maxPosture);
    else ui.boss(false);
  } else if (state === 'dead' || state === 'win') {
    // keep death/victory animations playing after the round ends
    ctx.player.update(sdt);
    for (const e of ctx.enemies) e.update(sdt);
    for (const l of ctx.loots) l.update(sdt);
  }
  fx.update(sdt);
  ash.update(sdt);
  // camera
  if (state === 'title') { ctx.player.poseStep(dt, 0); world.rig.titleOrbit(ctx.time, V(0, 0, -4)); }
  else if (state === 'show') {
    const t = ctx.time * .5;
    const c = ctx.player.pos;
    world.camera.position.set(c.x + Math.sin(t) * 3.2, 2.1, c.z + Math.cos(t) * 3.2);
    world.camera.lookAt(c.x, 1.3, c.z);
    ctx.player.setIdle();
    ctx.player.update(sdt);
  } else world.rig.update(sdt, ctx.player.pos, ctx.enemies, ctx.time);
  stateT += dt;
  endFrame();
}

// ---- loop ----
let acc = 0, last = performance.now();
function tickNow() { update(DT); }
function frame(now) {
  requestAnimationFrame(frame);
  const el = Math.min(.12, (now - last) / 1000); last = now;
  acc += el;
  let n = 0;
  while (acc >= DT && n < 4) { tickNow(); acc -= DT; n++; }
  world.render();
  if (panelFn) panelFn();
}
requestAnimationFrame(frame);
addEventListener('resize', () => world.resize());

// ---- title / start ----
ui.title();
document.getElementById('startbtn').addEventListener('click', () => {
  audio.mute(false); audio.setMusic('explore'); audio.startAmbient();
  audio.S.click();
  resetGame();
});
document.getElementById('end').querySelector('.go').addEventListener('click', () => {
  audio.S.click();
  resetGame();
});
if (SHOW) {
  state = 'show'; ui.title(); ui.showTitle(false); ui.showHud(false);
  if (SHOW === 'char') { ctx.player.pos.set(0, 0, 0); }
}
if (STAGE) { jumpStage(STAGE); if (!AUTO) audio.setMusic('explore'); }
else if (AUTO) { state = 'play'; ui.hud(); resetGame(); }

// ---- debug: F3 + G hooks (skill: 怎么自己验证) ----
let fps = 0, fpsAcc = 0, fpsN = 0;
setInterval(() => { fps = fpsN; fpsN = 0; }, 1000);
const panelFn = debugPanel(() =>
  `state: ${state} t=${ctx.time.toFixed(1)} ts=${ctx.timeScale}\n` +
  `hp: ${ctx.player.hp.toFixed(0)} sta: ${ctx.player.stamina.toFixed(0)} st: ${ctx.player.state} ${ctx.player.stateT.toFixed(2)}\n` +
  `pos: ${ctx.player.pos.x.toFixed(1)},${ctx.player.pos.z.toFixed(1)} facing: ${ctx.player.facing.toFixed(2)}\n` +
  `enemies: ${ctx.enemies.filter(e => e.alive).length} token: ${ctx.meleeToken ? ctx.meleeToken.id : '-'} proj: ${ctx.projectiles.length} fx: ${fx.count()}\n` +
  `wave: ${director.wave} phase: ${director.phase} fps: ${fps} tscale: ${ctx.timeScale}`
);
window.__ERRS = [];
addEventListener('error', (e) => { window.__ERRS.push(String(e.message || e)); });
const origErr = console.error;
console.error = (...a) => { window.__ERRS.push(a.map(String).join(' ')); origErr(...a); };

const G = window.G = {
  DT,
  step(n = 60, dt = DT) { for (let i = 0; i < n; i++) { update(dt); } world.render(); },
  upd(n = 30, dt = DT) { for (let i = 0; i < n; i++) update(dt); },
  press(...codes) { codes.forEach(c => pressed.add(c)); },
  act(a) { ctx.player.press(a); },
  keys, mouse: null,
  pl: () => ctx.player,
  fx, ents: () => ctx.enemies,
  spawn(kind, pos) {
    const e = kind === 'boss' ? new Boss(ctx, pos || V(0, 0, -13)) : kind === 'caster' ? new Caster(ctx, pos || V(4, 0, 4)) : new Walker(ctx, pos || V(3, 0, 3));
    ctx.enemies.push(e); return e;
  },
  state: () => state,
  setState(s) { state = s; },
  stage: jumpStage,
  clear: clearAll,
  reset: resetGame,
  pick: pickUpgrade,
  pending: () => ctx.pendingUpgrades,
  counts: () => ctx.player.upgradeCounts,
  shot(name) { world.render(); const url = renderer.domElement.toDataURL('image/png'); window.__SHOTS[name] = url; return url.length; },
  err: () => window.__ERRS,
  setStage(s) { if (s === 'boss' && ctx.boss) { ctx.boss.update(0); } },
  probe() {
    const r = ctx.player.rig.segs, w = (m) => [m.position.x.toFixed(2), m.position.y.toFixed(2), m.position.z.toFixed(2)].join(',');
    return { handR: w(r.handR), footL: w(r.footL), footR: w(r.footR), head: w(r.head) };
  },
  director, ctx: null,
};
G.ctx = ctx;
window.__SHOTS = {};

// ---------------------------------------------------------------- autotest suite
const TESTS = [];
const assert = (name, pass, detail = '') => { TESTS.push({ name, pass, detail }); console.log(`[T] ${pass ? 'PASS' : 'FAIL'} ${name} ${detail}`); };
// MessageChannel macrotask: immune to background-tab timer throttling (setTimeout(0) gets starved when hidden)
const nap = (ms = 0) => ms > 0
  ? new Promise(r => setTimeout(r, ms))
  : new Promise(r => { const c = new MessageChannel(); c.port1.onmessage = () => { c.port1.close(); r(); }; c.port2.postMessage(0); });
async function runChunks(nFrames) { // logic-only stepping in browser-friendly chunks
  let left = nFrames;
  while (left > 0) { const k = Math.min(60, left); G.upd(k); left -= k; await nap(); }
}

async function autotest() {
  await nap(300);
  ctx.noDirector = true;                  // tests drive spawns manually; no wave interference
  const p = ctx.player;

  // T1 boot integrity
  {
    const ok = !window.__ERRS.length && [p.pos.x, p.pos.y, p.pos.z, p.hp].every(Number.isFinite) && state === 'play';
    assert('T1 boot: no errors, finite state, playing', !!ok, `errs=${window.__ERRS.length}`);
    G.shot('01-title-play');
  }

  // T2 movement
  {
    const x0 = p.pos.clone();
    G.keys.add('KeyW');
    await runChunks(40);
    G.keys.delete('KeyW');
    const moved = x0.distanceTo(p.pos);
    assert('T2 WASD movement displaces & turns', moved > 1.2, `moved=${moved.toFixed(2)}m`);
    G.keys.delete('KeyW');
  }

  // T3 attack lands, hitstop occurs
  {
    G.clear(); p.hp = p.maxHp; p.stamina = p.maxStamina;
    p.pos.set(0, 0, 6); p.facing = 0;
    const w = G.spawn('walker', V(0, 0, 6 + 2.4));
    w.state = 'strafe'; w.strafeT = 99;
    ctx.meleeToken = {};                                      // dummy token: walker can never start an attack
    const hp0 = w.hp;
    const hs0 = p.hitstopCount;
    await runChunks(3);
    G.act('attack');
    await runChunks(70);
    assert('T3 attack hit: enemy hp drops, hitstop fires', w.hp < hp0 && p.hitstopCount > hs0, `dmg=${(hp0 - w.hp).toFixed(0)} hs=${p.hitstopCount - hs0}`);
    G.shot('02-combat-hit');
  }

  // T4 dash i-frames vs caster AoE (unblockable, dodgeable)
  {
    G.clear(); p.hp = p.maxHp; p.stamina = p.maxStamina; p.state = 'idle'; p.invulnT = 0; p.setIdle();
    p.pos.set(0, 0, 6); p.facing = 0;
    const c = G.spawn('caster', V(0, 0, 14));
    c.state = 'cast'; c.stateT = 0; c.nextIsAoe = true; c.castCd = -1;
    let guard = 200;
    while (!(c.state === 'aoe' && c.aoeT >= .9) && guard-- > 0) { G.upd(2); await nap(); }
    const hp0 = p.hp;
    G.act('dash');
    await runChunks(50);
    assert('T4 dash i-frames dodge unblockable AoE', p.hp === hp0, `hp ${hp0}->${p.hp}`);
    // control: without dash it should hurt
    G.clear(); p.hp = p.maxHp; p.stamina = p.maxStamina; p.state = 'idle'; p.invulnT = 0;
    p.pos.set(0, 0, 6); p.facing = 0;
    const c2 = G.spawn('caster', V(0, 0, 14));
    c2.state = 'cast'; c2.stateT = 0; c2.nextIsAoe = true; c2.castCd = -1;
    guard = 300;
    while (!(c2.state === 'aoe' && c2.aoeT < 0) && guard-- > 0) { G.upd(2); await nap(); }
    const hpA = p.hp;
    assert('T4b same AoE without dash deals damage', hpA < p.maxHp, `hp=${hpA}`);
  }

  // T5 parry -> counter window -> execute
  {
    G.clear(); p.hp = p.maxHp; p.stamina = p.maxStamina; p.parriedFlag = false;
    p.invulnT = 0; p.hitstopT = 0; p.state = 'idle'; p.setIdle();   // clear post-hit invulnerability from T4b
    p.pos.set(0, 0, 6); p.facing = 0;
    const w = G.spawn('walker', V(0, 0, 6 + 2.0));
    w.facing = Math.PI;                                        // face the player
    w.state = 'strike'; w.setClip(w.atkClip); w.stateT = .28; w.hitDone = false;
    await runChunks(2);
    G.press('KeyK'); G.keys.add('KeyK'); ctx.parryHeld = true;  // parry window [.24] covers impact at stateT .42
    await runChunks(30);
    const parried = p.parriedFlag && p.counterT > 0;
    G.keys.delete('KeyK'); ctx.parryHeld = false;
    const hp0 = w.hp;
    if (parried) { G.act('attack'); await runChunks(55); }
    assert('T5 parry opens counter window, execute deals big damage', parried && (w.hp <= hp0 - 40 || !w.alive), `parried=${parried} dmg=${(hp0 - w.hp).toFixed(0)}`);
    G.shot('03-parry-counter');
  }

  // T6 slash destroys a projectile
  {
    G.clear(); p.hp = p.maxHp; p.stamina = p.maxStamina;
    p.pos.set(0, 0, 6); p.facing = 0;
    const c = G.spawn('caster', V(0, 0, 15));
    c.state = 'cast'; c.stateT = 0; c.nextIsAoe = false; c.castCd = -1;
    let guard = 200, orb = null;
    while (guard-- > 0 && !(ctx.projectiles.length && ctx.projectiles[0].alive)) { G.upd(2); await nap(); }
    orb = ctx.projectiles[0];
    assert('T6a caster orb spawned', !!orb, `n=${ctx.projectiles.length}`);
    let hit = false;
    guard = 400;
    while (guard-- > 0 && !hit) {
      G.upd(1);
      if (orb && orb.alive && orb.pos.distanceTo(p.pos.clone().add(V(0, 1, 0))) < 3.9) {
        p.facing = Math.atan2(orb.pos.x - p.pos.x, orb.pos.z - p.pos.z);
        G.act('attack');
        hit = true;
      }
      await nap();
    }
    await runChunks(40);
    const destroyed = orb && !orb.alive && orb.destroyedBySlash;
    const notHurt = p.hp === p.maxHp;
    assert('T6 slash destroys incoming orb', !!destroyed && notHurt, `destroyed=${!!destroyed} hp=${p.hp}`);
  }

  // T7 boss phase transition at 50%
  {
    G.clear(); p.hp = p.maxHp;
    p.pos.set(0, 0, 6); p.facing = Math.PI;
    const b = G.spawn('boss', V(0, 0, -4));
    b.hp = b.maxHp * .51;
    b.takeHit({ dmg: 12, dir: V(0, 0, 1), heavy: false });
    await runChunks(6);
    assert('T7 boss enters phase 2 at 50% hp', b.phase === 2 && b.alive, `phase=${b.phase} hp=${b.hp.toFixed(0)}`);
    G.shot('04-boss');
    // posture stagger check
    b.posture = 100;                                           // next boss.update triggers stagger
    await runChunks(4);
    assert('T7b posture full triggers stagger', b.state === 'stagger', `state=${b.state}`);
  }

  // T8 arena scan: no stuck points (skill: 全图扫描测试)
  {
    G.clear(); p.invulnT = 0; p.hp = p.maxHp; p.state = 'idle'; p.hitstopT = 0;
    G.__manual = true;                                          // drive moveDir directly
    ctx.noDirector = true;
    let stuck = 0, tested = 0;
    const dirs = [];
    for (let i = 0; i < 8; i++) dirs.push(V(Math.sin(i / 8 * Math.PI * 2), 0, Math.cos(i / 8 * Math.PI * 2)));
    outer:
    for (let r = 3; r <= 21; r += 3) {
      for (let a = 0; a < 12; a++) {
        const ang = a / 12 * Math.PI * 2;
        const pt = V(Math.cos(ang) * r, 0, Math.sin(ang) * r);
        // skip points inside obstacles or outside the walkable edge
        if (ctx.colliders.some(c => Math.hypot(pt.x - c.x, pt.z - c.z) < c.r + .6)) continue;
        const edge = 26 * (1 + .10 * Math.sin(3 * ang) + .06 * Math.sin(7 * ang + 1.7));
        if (r > edge - 1.5) continue;
        tested++;
        let canMove = false;
        for (const d of dirs) {
          p.pos.copy(pt); p.vel.set(0, 0, 0); p.state = 'idle';
          for (let f = 0; f < 25; f++) { ctx.moveDir.copy(d); update(1 / 60); }
          if (p.pos.distanceTo(pt) > .6) canMove = true;
          if (!canMove) {
            // try escaping toward the arena center
            const home = pt.clone().multiplyScalar(-1).normalize();
            for (let f = 0; f < 55; f++) { ctx.moveDir.copy(home); update(1 / 60); }
            if (p.pos.distanceTo(pt) > 1.2) canMove = true;
          }
          ctx.moveDir.set(0, 0, 0);
          if (canMove) break;
        }
        if (!canMove) stuck++;
        if (stuck > 3) { assert('T8 arena scan stuck points', false, 'aborted: many stuck'); break outer; }
        await nap();
      }
    }
    G.__manual = false; ctx.noDirector = false;
    assert('T8 arena scan: no stuck points', stuck === 0, `tested=${tested} stuck=${stuck}`);
  }

  // T10 upgrade flow: clear a wave -> 3-choice overlay -> pick applies & next wave resumes
  {
    ctx.noDirector = false;                       // director drives the choose flow
    G.clear(); p.invulnT = 0; p.hitstopT = 0; p.state = 'idle';
    director.wave = 0; director.phase = 'fight';
    const w = G.spawn('walker', V(8, 0, 8));
    w.takeHit({ dmg: 999, dir: V(1, 0, 0) });     // wipe the "wave"
    await runChunks(30);                          // corpse grace -> wave-clear check -> overlay
    const cards = document.querySelectorAll('#upgrades .up-card').length;
    const choosing = director.phase === 'choose' && !!ctx.pendingUpgrades;
    if (choosing) { G.press('Digit1'); await runChunks(5); }
    const picked = Object.keys(p.upgradeCounts).length === 1;
    const overlayGone = document.getElementById('upgrades').classList.contains('hide');
    const resumed = director.phase === 'calm';
    assert('T10 wave-clear offers 3 upgrades; pick applies & resumes', choosing && cards === 3 && picked && overlayGone && resumed, `cards=${cards} choosing=${choosing} picked=${picked} gone=${overlayGone} phase=${director.phase}`);
    ctx.noDirector = true; G.clear();
  }

  // T9 teardown: title + muted (skill: 测完切回标题、静音)
  {
    G.clear(); resetGame(); G.clear();
    state = 'title'; ui.title();
    audio.mute(true);
    await runChunks(10);
    assert('T9 teardown: back to title, muted, no errors', state === 'title' && audio.muted && window.__ERRS.length === 0, `errs=${window.__ERRS.length}`);
    G.shot('05-title-end');
  }

  window.__TEST = { results: TESTS, errors: window.__ERRS, done: true };
  console.log('[T] suite done:', TESTS.filter(t => t.pass).length, '/', TESTS.length);
}
if (AUTOTEST) { autotest().catch(e => { window.__TEST = { results: TESTS, errors: [...window.__ERRS, String(e)], done: true, fatal: String(e) }; }); }

export { };
