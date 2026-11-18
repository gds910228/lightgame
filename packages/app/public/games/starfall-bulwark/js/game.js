// Starfall Bulwark — main loop, wave director, economy, events, blessing
// drafts, site protocol bridge, G debug hooks and the ?autotest=1 suite.
import * as THREE from '../vendor/three.module.min.js';
import { makeWorld } from './world.js';
import { makeFX } from './fx.js';
import { makeEnemy, ENEMY, AFFIX } from './enemies.js';
import { TOWERS, makeTower, bindCurve, sellValue } from './towers.js';
import { makeAudio } from './audio.js';
import { makeUI } from './ui.js';
import { keys, pressed, mouse, endFrame, debugPanel, initTouch } from './input.js';
import { glowTex } from './assets.js';

const DT = 1 / 60, CORE_MAX = 20, START_ESS = 130, TOTAL_WAVES = 10;
const SPAWN_IV = { crawler: 1.0, runner: .7, wisp: 1.2, brute: 1.6, shaman: 1.8, colossus: 3 };

const WAVES = [
  [['crawler', 6]],
  [['crawler', 8], ['runner', 3]],
  [['crawler', 6], ['runner', 4], ['brute', 1]],
  [['crawler', 10], ['wisp', 5]],
  [['runner', 6], ['brute', 3], ['shaman', 1]],
  [['crawler', 8], ['wisp', 6], ['shaman', 2]],
  [['runner', 12], ['brute', 4]],
  [['crawler', 8], ['runner', 6], ['brute', 3], ['shaman', 2]],
  [['wisp', 10], ['shaman', 4], ['brute', 3]],
  [['colossus', 1], ['crawler', 8]],
];

const BLESSINGS = [
  { id: 'sharp', zh: '锋鸣', glyph: '➶', max: 4, desc: '弩箭塔伤害 +20%', apply: () => mods.ballistaDmg += .2 },
  { id: 'alloy', zh: '磐晶合金', glyph: '◈', max: 4, desc: '全塔伤害 +8%', apply: () => mods.allDmg += .08 },
  { id: 'lens', zh: '透镜阵列', glyph: '◎', max: 3, desc: '全塔射程 +10%', apply: () => mods.range += .1 },
  { id: 'chill', zh: '霜寒入髓', glyph: '❄', max: 3, desc: '减速效果 +12%', apply: () => mods.slow += .12 },
  { id: 'grid', zh: '导电晶格', glyph: '⚡', max: 2, desc: '连雷弹跳 +1', apply: () => mods.chain += 1 },
  { id: 'ember', zh: '燃熔余烬', glyph: '☀', max: 2, desc: '迫炮溅射 +20%', apply: () => mods.splash += .2 },
  { id: 'focus', zh: '聚星光焦', glyph: '✧', max: 3, desc: '棱镜光束伤害 +25%', apply: () => mods.prismDmg += .25 },
  { id: 'well', zh: '潮汐聚灵', glyph: '◍', max: 4, desc: '星尘获取 +15%', apply: () => mods.essence += .15 },
  { id: 'weave', zh: '核心重塑', glyph: '❖', max: 99, desc: '立刻修复星核 +4', apply: () => { coreHp = Math.min(CORE_MAX, coreHp + 4); world.setCoreFrac(coreHp / CORE_MAX); } },
  { id: 'cap', zh: '过载电容', glyph: '⟡', max: 4, desc: '全塔射速 +8%', apply: () => mods.rate += .08 },
];

const EVENTS = {
  tide:   { zh: '精 华 潮', sub: '本波击杀星尘翻倍', apply: () => rewardMult = 2, revert: () => rewardMult = 1 },
  meteor: { zh: '星 陨', sub: '陨石将坠入战场', apply: () => { meteorQ = [3, 7, 11]; }, revert: () => meteorQ = [] },
  fog:    { zh: '迷 雾', sub: '本波全塔射程 -20%', apply: () => fogWave = true, revert: () => fogWave = false },
  over:   { zh: '超 频', sub: '开波 18 秒射速 +45%', apply: () => overchargeT = 18, revert: () => overchargeT = 0 },
  swarm:  { zh: '虫 潮', sub: '本波敌群 +30%', apply: () => swarmMult = 1.3, revert: () => swarmMult = 1 },
};

// --- state ---
let mode = 'title';                 // title | build | combat | draft | over | win
let wave = 0, wavesCleared = 0, endless = false;
let essence = START_ESS, coreHp = CORE_MAX;
let towers = [], enemies = [], spawnQ = [], meteorQ = [];
let speed = 1, paused = false, callT = 0, combatT = 0, overchargeT = 0;
let rewardMult = 1, fogWave = false, swarmMult = 1, lastEvent = '';
let noAuto = false;                 // autotest guard: build countdown never auto-calls
let selPad = -1, selTower = null;
let best = 0, newBest = false, nanFlag = false;
let mods, counts, reportTarget = null;
let reports = [];
const G = { err: [] }; window.__G = G;

try { best = parseInt(localStorage.getItem('sfb.best') || '0') || 0; } catch (e) { best = 0; }
function saveBest() {
  const w = endless ? wave : Math.max(wavesCleared, wave);
  if (w > best) { best = w; newBest = true; try { localStorage.setItem('sfb.best', String(best)); } catch (e) { } }
}

function resetState(toEndless = false) {
  wave = toEndless ? TOTAL_WAVES : 0;
  endless = toEndless; wavesCleared = 0;
  essence = START_ESS; coreHp = CORE_MAX;
  towers.forEach(t => t.dispose(world.scene)); towers = [];
  enemies.forEach(e => e.dispose(world.scene)); enemies = [];
  spawnQ = []; meteorQ = [];
  speed = 1; paused = false; callT = 0; combatT = 0; overchargeT = 0;
  rewardMult = 1; fogWave = false; swarmMult = 1; lastEvent = '';
  selPad = -1; selTower = null; newBest = false; nanFlag = false;
  mods = { ballistaDmg: 1, allDmg: 1, range: 1, rate: 1, slow: 0, chain: 0, splash: 1, prismDmg: 1, essence: 1 };
  counts = {};
  world.pads.forEach(p => { p.tower = null; p.glow.material.opacity = 0; });
  fx.clear(); ui.hideDraft(); ui.hideEnd(); ui.towerPanel(null); ui.boss(null);
  ui.speed(1); ui.pause(false); ui.callBtn(false); world.setCoreFrac(1);
}

// --- boot ---
const world = makeWorld(document.getElementById('gl'));
bindCurve(world);
const fx = makeFX(world.scene);
const glowT = glowTex();
const audio = makeAudio();
const ui = makeUI({
  onSpeed: toggleSpeed, onPause: togglePause, onMute: () => ui.mute(audio.toggleMute()),
  onCall: () => callWave(true), onUpgrade: upgradeSel, onSell: sellSel, onDeselect: deselect,
  onBuild: (key) => buildOn(key), onStart: () => startGame(false),
});

// --- protocol (site bridge) ---
function report(kind, payload = {}) {
  const frame = { kind, ...payload };
  reports.push(frame);
  try {
    if (reportTarget) reportTarget(frame);
    else if (window.parent !== window) window.parent.postMessage({ source: 'lightgame', type: 'lightgame:report', payload: frame }, '*');
  } catch (e) { }
}
G.setReportTarget = (fn) => { reportTarget = fn; };
report('ready', { game: 'starfall-bulwark' });

// --- waves / director ---
function waveComp(w) {
  if (!endless && w <= TOTAL_WAVES) return WAVES[w - 1] || WAVES[0];
  const idx = Math.max(0, w - TOTAL_WAVES - 1);
  const base = WAVES[idx % 10].map(x => [...x]);
  const comp = base.filter(g => g[0] !== 'colossus');
  if (idx % 5 === 4) comp.unshift(['colossus', 1]);
  return comp;
}
function wavePlan(w) {
  const idx = Math.max(0, w - TOTAL_WAVES - 1);
  const cycle = Math.floor(idx / 5) + 1;
  return { hpMult: 1 + .16 * cycle, spdMult: 1 + Math.min(.04 * (cycle - 1), .3), cycle };
}
function buildSpawnQ(comp, t0 = 1) {
  const q = [];
  let gi = 0;
  for (const [kind, count0] of comp) {
    const count = Math.max(1, Math.round(count0 * swarmMult));
    for (let i = 0; i < count; i++) q.push({ kind, t: t0 + gi * .55 + i * SPAWN_IV[kind] });
    gi++;
  }
  q.sort((a, b) => a.t - b.t);
  return q;
}
function nextWaveText(w) {
  return waveComp(w).map(([k, n]) => `${ENEMY[k].zh}×${n}`).join('  ');
}
function callWave(bonus = true) {
  if (mode !== 'build') return false;
  if (bonus && callT > 0) gain(15);
  wave++;
  mode = 'combat'; combatT = 0;
  swarmMult = 1; rewardMult = 1; fogWave = false; overchargeT = 0;
  const comp = waveComp(wave);
  const bossWave = comp.some(g => g[0] === 'colossus');
  // random event roll first (swarm must affect this wave's spawn queue)
  if (!bossWave && Math.random() < (endless ? .55 : .4)) {
    const pool = Object.keys(EVENTS).filter(k => k !== lastEvent);
    const ev = pool[(Math.random() * pool.length) | 0];
    lastEvent = ev;
    EVENTS[ev].apply();
    ui.banner(EVENTS[ev].zh, EVENTS[ev].sub, 2.6);
  }
  spawnQ = buildSpawnQ(comp);
  audio.setState(bossWave ? 'boss' : 'combat');
  ui.banner(bossWave ? '裂 地 巨 像' : `第 ${wave} 波`, bossWave ? '踏碎大地的轰鸣' : '来袭');
  audio.play(bossWave ? 'roar' : 'waveStart');
  ui.callBtn(false);
  return true;
}
function gain(n) {
  const g = Math.floor(n * mods.essence);
  essence += g; ui.essencePop(g); audio.play('coin');
}
function endWave() {
  wavesCleared = wave;
  saveBest();
  gain(20 + 2 * wave);
  if (lastEvent && EVENTS[lastEvent]) { EVENTS[lastEvent].revert(); lastEvent = ''; }
  audio.setState('build');
  report('progress', { wave, score: wavesCleared });
  if (!endless && wave >= TOTAL_WAVES) { winGame(); return; }
  if (wave % 3 === 0) { startDraft(); return; }
  mode = 'build'; callT = 10; ui.callBtn(true, true, callT);
  ui.toast(`清波奖励 +${20 + 2 * wave}✦`);
}
function winGame() {
  mode = 'win'; audio.play('victory'); audio.setState('build');
  report('complete', { score: wavesCleared });
  ui.end({ win: true, waves: wave, best, newBest }, { endless: () => startGame(true), restart: () => startGame(false) });
}
function loseGame() {
  mode = 'over'; audio.play('defeat');
  saveBest();
  report('gameOver', { score: wavesCleared, progress: wave });
  ui.end({ win: false, waves: wave, best, newBest }, { restart: () => startGame(false) });
  ui.boss(null);
}
function startGame(toEndless) {
  resetState(toEndless);
  ui.hideTitle();
  audio.unlock(); audio.setState('build');
  mode = 'build'; callT = toEndless ? 8 : 18;
  ui.callBtn(true, true, callT);
  ui.banner(toEndless ? '无 尽 坚 守' : '坠 星 坚 守', toEndless ? '每 5 波一位巨像' : '点石台建塔 · 提前召唤得星尘', 2.6);
}
function startDraft() {
  mode = 'draft';
  const pool = BLESSINGS.filter(b => (counts[b.id] || 0) < b.max);
  const cards = []; const cand = [...pool];
  while (cards.length < 3 && cand.length) cards.push(cand.splice((Math.random() * cand.length) | 0, 1)[0]);
  if (!cards.length) { mode = 'build'; callT = 10; ui.callBtn(true, true, callT); return; }
  ui.draft(cards, (i) => {
    const b = cards[i];
    counts[b.id] = (counts[b.id] || 0) + 1;
    b.apply(); audio.play('upgrade');
    ui.toast(`获得祝福：${b.zh} — ${b.desc}`);
    mode = 'build'; callT = 10; ui.callBtn(true, true, callT);
  });
}

// --- spawning ---
function rollAffixes() {
  if (!endless) return null;
  const { cycle } = wavePlan(wave);
  if (Math.random() >= Math.min(.2 + .1 * cycle, .75)) return null;
  const ks = Object.keys(AFFIX);
  const n = Math.random() < .12 ? 2 : 1;
  const out = [];
  while (out.length < n && out.length < ks.length) {
    const k = ks[(Math.random() * ks.length) | 0];
    if (!out.includes(k)) out.push(k);
  }
  return out;
}
function spawn(kind, t = 0, opts = {}) {
  const plan = opts.noScale ? { hpMult: 1, spdMult: 1 } : wavePlan(Math.max(wave, 1));
  if (!opts.affixes && !opts.noScale) opts.affixes = rollAffixes();
  const e = makeEnemy(kind, world, { hpMult: plan.hpMult, spdMult: plan.spdMult, ...opts, t: opts.t ?? t });
  if (e.fly) e.group.position.set(10.5, 1, -9.5);
  else { const p = world.curve.getPointAt(Math.min(Math.max(t, 0), 1)); e.group.position.set(p.x, .12, p.z); }
  enemies.push(e);
  world.scene.add(e.group);
  return e;
}
function killEnemy(e) {
  const r = Math.floor(e.def.reward * rewardMult * mods.essence);
  essence += r; ui.essencePop(r); audio.play('coin');
  fx.burst(e.pos(), e.def.color, 12, 2.2, 1.4);
  fx.ring(e.pos(true), e.def.color, 1.1, .35);
  if (e.boss) { report('event', { event: 'boss_slain' }); ui.banner('巨 像 陨 落', `+${r}✦`, 2.2); }
  e.dispose(world.scene);
}

// --- build / upgrade / sell ---
function buildOn(key) {
  if (selPad < 0 || mode === 'title' || mode === 'over' || mode === 'win') return false;
  const pad = world.pads[selPad];
  if (pad.tower) return false;
  const cost = TOWERS[key].cost;
  if (essence < cost) { ui.toast('星尘不足'); audio.play('disable'); return false; }
  essence -= cost;
  const t = makeTower(key, pad, mods, fx, glowT);
  pad.tower = t; towers.push(t);
  audio.play('place');
  fx.ring(pad.pos, TOWERS[key].color, 1.4, .4);
  deselect();
  return true;
}
function selectPad(i) {
  if (mode !== 'build' && mode !== 'combat' && mode !== 'draft') return;
  selPad = i; selTower = null;
  ui.towerPanel(null);
  world.pads.forEach(p => { if (p.tower) p.tower.showRange(false); });
  ui.cards(true, affordMap());
  audio.play('click');
}
function selectTower(pad, t) {
  selTower = t; selPad = world.pads.indexOf(pad);
  world.pads.forEach(p => { if (p.tower && p.tower !== t) p.tower.showRange(false); });
  t.showRange(true, fogWave);
  ui.towerPanel(t);
  ui.cards(false, {});
  audio.play('click');
}
function deselect() {
  selPad = -1; selTower = null;
  ui.towerPanel(null); ui.cards(false, {});
  world.pads.forEach(p => { if (p.tower) p.tower.showRange(false); });
}
function affordMap() {
  const m = {};
  for (const k of Object.keys(TOWERS)) m[k] = essence >= TOWERS[k].cost;
  return m;
}
function upgradeSel() {
  if (!selTower) return false;
  if (selTower.lv >= 2) { ui.toast('已满级 Lv3'); return false; }
  const cost = selTower.def.upg[selTower.lv];
  if (essence < cost) { ui.toast(`星尘不足（需 ${cost}✦）`); return false; }
  essence -= cost;
  selTower.upgrade(); audio.play('upgrade');
  fx.ring(selTower.pad.pos, selTower.def.color, 1.6, .4);
  ui.towerPanel(selTower);
  return true;
}
function sellSel() {
  if (!selTower) return false;
  const v = sellValue(selTower);
  essence += v; ui.essencePop(v); audio.play('sell');
  selTower.pad.tower = null;
  selTower.dispose(world.scene);
  towers = towers.filter(t => t !== selTower);
  deselect();
  return true;
}
function toggleSpeed() { if (mode === 'build' || mode === 'combat') { speed = speed === 1 ? 2 : 1; ui.speed(speed); audio.play('click'); } }
function togglePause() {
  if (mode !== 'build' && mode !== 'combat' && mode !== 'draft') return;
  paused = !paused; ui.pause(paused);
}

// --- combat hooks ---
const hooks = {
  onLeak(e) {
    coreHp -= e.def.coreDmg;
    world.setCoreFrac(Math.max(0, coreHp / CORE_MAX));
    ui.flash(); audio.play('leak');
    fx.ring(new THREE.Vector3(-5.5, .6, 0), 0xe05252, 2.2, .5);
    fx.burst(new THREE.Vector3(-5.5, 1.2, 0), 0xe05252, 18, 2.4, 1.6);
    ui.toast(`星核受损 -${e.def.coreDmg}`);
    if (coreHp <= 0) { coreHp = 0; loseGame(); }
  },
  onDeath(e) { killEnemy(e); },
  onHeal(sh) { fx.ring(sh.pos(), 0x9a5af0, 1.6, .4); audio.play('heal'); },
  onStomp(boss) {
    audio.play('stomp');
    fx.ring(boss.pos(true), 0xc05a45, 3.2, .55);
    let bestT = null, bd = 1e9;
    for (const t of towers) { const d = t.group.position.distanceTo(boss.pos(true)); if (d < bd) { bd = d; bestT = t; } }
    if (bestT) {
      bestT.disabledT = 3.5; bestT.setDisabled(true); bestT.fx.beamEnd(bestT._beamId);
      fx.burst(bestT.group.position.clone().add(new THREE.Vector3(0, 1, 0)), 0xc05a45, 10, 1.4, 1);
      audio.play('disable');
      if (selTower === bestT) ui.towerPanel(bestT);
      ui.toast('★ 践踏！' + bestT.def.zh + ' 停机 3.5s');
    }
  },
};
function ctxHit(tower, e, dealt) {
  if (tower && tower.key === 'prism') audio.play('beamTick');
  if (!e.alive && !e.leaked) hooks.onDeath(e);
}

// --- input ---
function handleClick() {
  if (mode === 'title' || mode === 'over' || mode === 'win') return;
  const pickables = [];
  world.pads.forEach((p, i) => { p.mesh.userData.padIndex = i; pickables.push(p.mesh); });
  towers.forEach(t => { t.group.userData.padIndex = world.pads.indexOf(t.pad); pickables.push(t.group); });
  const hit = world.raycast({ x: mouse.x, y: mouse.y }, pickables);
  if (hit) {
    let o = hit.object;
    while (o && o.userData.padIndex === undefined) o = o.parent;
    if (o) {
      const i = o.userData.padIndex, pad = world.pads[i];
      if (pad.tower) selectTower(pad, pad.tower);
      else selectPad(i);
      return;
    }
  }
  deselect();
}
addEventListener('keydown', (e) => {
  if (mode === 'title') return;
  if (e.code === 'Escape') deselect();
  if (e.code === 'KeyF') toggleSpeed();
  if (e.code === 'KeyP') togglePause();
  if (e.code === 'Space') { mode === 'build' ? callWave(true) : toggleSpeed(); }
  if (e.code === 'KeyU') upgradeSel();
  if (e.code === 'KeyX') sellSel();
  if (/^Digit[1-5]$/.test(e.code)) buildOn(Object.keys(TOWERS)[+e.code.slice(5) - 1]);
});
initTouch((code) => { if (code === 'Space' && mode === 'build') callWave(true); });

const dbg = debugPanel(() =>
  `mode:${mode} wave:${wave} core:${coreHp} ✦:${essence}\nenemies:${enemies.length} q:${spawnQ.length} towers:${towers.length} selPad:${selPad}`);

// --- step ---
function step(dt) {
  world.update(dt);
  audio.tick(dt);
  ui.update(dt);
  const afford = affordMap(), anyAfford = Object.values(afford).some(Boolean);
  world.pads.forEach((p, i) => {
    if (!p.tower) world.padPulse(i, mode === 'build' && anyAfford, 0x6fe8d8);
    else if (selTower && p.tower === selTower) p.tower.showRange(true, fogWave);
  });
  if (selPad >= 0 && !selTower && (mode === 'build' || mode === 'combat')) ui.cards(true, affordMap());

  if (mode === 'build') {
    callT -= dt;
    ui.callBtn(true, true, callT);
    if (callT <= 0 && !noAuto) callWave(false);
  } else if (mode === 'combat') {
    combatT += dt;
    if (overchargeT > 0) overchargeT -= dt;
    while (spawnQ.length && spawnQ[0].t <= combatT) spawn(spawnQ.shift().kind);
    if (meteorQ.length && meteorQ[0] <= combatT) {
      meteorQ.shift();
      const alive = enemies.filter(e => e.alive);
      const tgt = alive.length ? alive[(Math.random() * alive.length) | 0].pos(true) : world.curve.getPointAt(Math.random() * .9 + .05);
      audio.play('meteor');
      fx.meteor(tgt, (to) => {
        fx.ring(to, 0xffc878, 1.8, .45); fx.burst(to, 0xffa050, 18, 2.4, 1.8);
        fx.flash(to.clone().add(new THREE.Vector3(0, .4, 0)), 0xffd090, .5, 2.4, .3);
        audio.play('boom');
        for (const e of enemies) {
          if (!e.alive) continue;
          if (e.pos(true).distanceTo(to) <= 1.8) { const d = e.takeHit(80); if (d) ctxHit(null, e, d); }
        }
      });
    }
  }

  // enemies & towers tick in build AND combat (towers idle-guard, tests spawn in build)
  if (mode === 'build' || mode === 'combat') {
    const ctx = { enemies: () => enemies, overcharge: overchargeT, fog: fogWave, hit: ctxHit };
    for (const e of enemies) { if (e.alive) e.update(dt, hooks, () => enemies); }
    for (const t of towers) t.update(dt, ctx);
    fx.update(dt);
    enemies = enemies.filter(e => {
      if (e.alive) return true;
      if (!e.leaked) hooks.onDeath(e);
      e.dispose(world.scene);
      return false;
    });
    const boss = enemies.find(e => e.boss);
    ui.boss(boss ? '裂地巨像' : null, boss ? boss.hp / boss.maxHp : 0);
    if (mode === 'combat' && !spawnQ.length && !enemies.length) endWave();
  }

  if (mode === 'combat') {
    ui.hud({ core: coreHp, coreMax: CORE_MAX, essence, wave, endless, preview: `剩余敌人 ${spawnQ.length + enemies.length}`, best });
  } else {
    ui.hud({ core: coreHp, coreMax: CORE_MAX, essence, wave, endless, preview: mode === 'build' ? ('下波：' + nextWaveText(wave + 1)) : '', best });
  }
  if (!Number.isFinite(coreHp) || !Number.isFinite(essence) || !Number.isFinite(wave)) nanFlag = true;
}

// --- main loop ---
let last = performance.now(), acc = 0;
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(.1, (now - last) / 1000); last = now;
  dbg();
  if (pressed.size) {
    if (pressed.has('Click') && !paused) handleClick();
    endFrame();
  }
  if (mode === 'title') { world.update(dt); world.render(); return; }
  if (paused) { world.render(); return; }
  acc += dt * speed;
  let n = 0;
  while (acc >= DT && n < 8) { step(DT); acc -= DT; n++; if (mode === 'over' || mode === 'win') break; }
  world.render();
}
requestAnimationFrame(frame);

ui.title({ best }, () => startGame(false));
if (new URLSearchParams(location.search).get('auto')) startGame(false);

// ==================== G debug hooks ====================
Object.assign(G, {
  step: (n = 60, dt = DT) => { for (let i = 0; i < n; i++) { step(dt); if (pressed.size) endFrame(); } world.render(); },
  upd: (n = 30, dt = DT) => { for (let i = 0; i < n; i++) { step(dt); if (pressed.size) endFrame(); } },
  real: (n = 60) => { for (let i = 0; i < n; i++) { acc += DT * speed; while (acc >= DT) { step(DT); acc -= DT; } } },
  press: (...codes) => codes.forEach(c => pressed.add(c)),
  spawn, place: (slot, key) => { selPad = slot; if (!buildOn(key)) return false; return world.pads[slot].tower; },
  select: (slot) => selectPad(slot),
  setSel: (t) => { selTower = t; selPad = world.pads.indexOf(t.pad); },
  state: () => ({ mode, wave, essence, coreHp, towers: towers.length, enemies: enemies.length, q: spawnQ.length, best, counts, endless, callT, rewardMult, fogWave, swarmMult, overchargeT, nan: nanFlag }),
  enemies: () => enemies, towersL: () => towers,
  addEss: (n) => { essence += n; },
  setCore: (n) => { coreHp = n; world.setCoreFrac(coreHp / CORE_MAX); },
  forceEvent: (k) => { if (lastEvent && EVENTS[lastEvent]) EVENTS[lastEvent].revert(); lastEvent = ''; EVENTS[k].apply(); lastEvent = k; },
  revertEvent: (k) => { EVENTS[k] && EVENTS[k].revert(); if (lastEvent === k) lastEvent = ''; },
  draftOffer: () => {
    const pool = BLESSINGS.filter(b => (counts[b.id] || 0) < b.max);
    const cards = []; const cand = [...pool];
    while (cards.length < 3 && cand.length) cards.push(cand.splice((Math.random() * cand.length) | 0, 1)[0]);
    return cards;
  },
  grant: (id) => { const b = BLESSINGS.find(x => x.id === id); if (b) { b.apply(); counts[id] = (counts[id] || 0) + 1; } },
  callWave, startGame, wavePlan, waveComp, nextWaveText, buildSpawnQ,
  events: EVENTS, blessings: BLESSINGS, enemyDefs: ENEMY, towerDefs: TOWERS, affixes: AFFIX,
  upgrade: () => upgradeSel(), sell: () => sellSel(),
  reset: () => { resetState(false); mode = 'title'; ui.title({ best }, () => startGame(false)); },
  enterEndless: () => startGame(true),
  wipeEnemies: () => { for (const e of [...enemies]) { e.alive = false; if (!e.leaked) hooks.onDeath(e); e.dispose(world.scene); } enemies = []; spawnQ = []; },
  audio, ui, world, fx, hooks,
  setSpeed: (v) => { speed = v; }, getSpeed: () => speed,
  shot: () => world.renderer.domElement.toDataURL('image/jpeg', .6),
  noEvent: (fn) => { const r = Math.random; Math.random = () => .99; try { return fn(); } finally { Math.random = r; } },
  setNoAuto: (v) => { noAuto = v; },
  pump: () => { if (pressed.size) { if (pressed.has('Click') && !paused) handleClick(); endFrame(); } },
  clickAt: (cx, cy) => { mouse.x = cx / innerWidth * 2 - 1; mouse.y = -(cy / innerHeight) * 2 + 1; handleClick(); },
});

// ==================== autotest suite ====================
async function autotest() {
  const nap = () => new Promise(r => { const mc = new MessageChannel(); mc.port1.onmessage = () => r(); mc.port2.postMessage(0); });
  const T = window.__TEST = { passed: 0, failed: 0, results: [] };
  const ok = (id, cond, msg = '') => { T.results.push({ id, ok: !!cond, msg }); cond ? T.passed++ : T.failed++; console.log(`${cond ? '✓' : '✗'} ${id} ${msg}`); };
  const R = (n, dt = DT) => { for (let i = 0; i < n; i++) { step(dt); if (pressed.size) endFrame(); } };
  const backToBuild = () => { G.wipeEnemies(); R(3); mode = 'build'; callT = 999; };

  audio.unlock(); audio.toggleMute();
  G.setNoAuto(true);              // deterministic: tests call waves explicitly

  // T1 boot clean
  await nap();
  ok('T1', G.err.length === 0 && !nanFlag, `errors=${G.err.length}`);

  // T2 path continuity + pads clear of road
  {
    let ok2 = true, prev = null;
    for (let i = 0; i <= 100; i++) {
      const p = world.curve.getPointAt(i / 100);
      if (!Number.isFinite(p.x + p.y + p.z)) ok2 = false;
      if (prev && p.distanceTo(prev) > 1.2) ok2 = false;
      prev = p;
    }
    let padsOk = world.pads.length === 12;
    if (padsOk) for (const p of world.pads) {
      let m = 1e9;
      for (let i = 0; i <= 60; i++) m = Math.min(m, world.curve.getPointAt(i / 60).distanceTo(p.pos));
      if (!(m > 1.3 && m < 3.6)) { padsOk = false; break; }
    }
    ok('T2', ok2 && padsOk, `pads=${world.pads.length}`);
  }

  // T3 build deducts essence
  G.reset(); G.noEvent(() => startGame(false));
  const e0 = essence;
  ok('T3', G.place(0, 'ballista') && essence === e0 - 50 && towers.length === 1, `ess ${e0}→${essence}`);

  // T4 insufficient funds rejected
  essence = 10;
  ok('T4', !G.place(1, 'prism') && towers.length === 1, 'rejected');
  essence = e0;

  // T5 ballista kills a crawler near the road head
  {
    const e = spawn('crawler', .02, { noScale: true, hpMult: .5 });
    let t = 0;
    while (t < 14 && e.alive) { R(60); t++; }
    const dead = !e.alive && !e.leaked;
    ok('T5', dead, `killed in ${t}s`);
  }

  // T6 frost slows
  {
    G.place(2, 'frost');
    const e = spawn('runner', .15, { noScale: true });
    let slowed = false;
    for (let i = 0; i < 60 * 6 && e.alive && !slowed; i++) { R(1); if (e.slowT > 0 && e.speedNow() < e.baseSpeed) slowed = true; }
    ok('T6', slowed, `speedNow=${e.speedNow().toFixed(2)}/${e.baseSpeed}`);
  }
  G.wipeEnemies();

  // T7 totem chain reaches 2nd target (low hp so one chain shot clears both)
  {
    G.addEss(300);
    const tot = G.place(3, 'totem');
    const a = spawn('crawler', .28, { noScale: true, hpMult: .3 }), b = spawn('crawler', .30, { noScale: true, hpMult: .3 });
    for (let i = 0; i < 60 * 8 && (a.alive || b.alive); i++) R(1);
    ok('T7', !!tot && !a.alive && !b.alive, `tot=${!!tot} a=${a.alive} b=${b.alive}`);
    G.wipeEnemies();
  }

  // T8 mortar splash kills a pair / T9 mortar ignores flying, prism does not
  {
    G.addEss(300);
    G.place(4, 'mortar');
    const c1 = spawn('crawler', .42, { noScale: true, hpMult: .5 }), c2 = spawn('crawler', .45, { noScale: true, hpMult: .5 });
    for (let i = 0; i < 60 * 10 && (c1.alive || c2.alive); i++) R(1);
    ok('T8', !c1.alive && !c2.alive, 'splash killed both');
    // silence everything but the mortar, then check flying is ignored
    towers.forEach(t => { if (t.key !== 'mortar') { t.disabledT = 999; t.setDisabled(true); } });
    G.wipeEnemies();
    const w = spawn('wisp', 0, { noScale: true });
    const w0 = w.hp;
    for (let i = 0; i < 60 * 3 && w.alive && w.hp === w0; i++) R(1);
    ok('T9', w.alive && w.hp === w0, `wisp untouched hp=${w.hp}/${w0}`);
    // prism placed near the fly line catches it
    const pr = G.place(1, 'prism');
    let hitW = false;
    for (let i = 0; i < 60 * 5 && w.alive && !hitW; i++) { R(1); if (w.hp < w0 || !w.alive) hitW = true; }
    ok('T9b', hitW, `prism hit wisp hp=${w.hp.toFixed(1)}`);
    towers.forEach(t => { if (t.disabledT >= 999) { t.disabledT = 0; t.setDisabled(false); } });
    G.wipeEnemies();
  }

  // T10 leak damages core; core 0 → game over
  {
    G.setCore(3);
    const e = spawn('crawler', .995, { noScale: true });
    for (let i = 0; i < 60 * 6 && e.alive; i++) R(1);
    ok('T10', coreHp === 2 && mode !== 'over', `core 3→${coreHp}`);
    G.setCore(1);
    const e2 = spawn('crawler', .995, { noScale: true });
    for (let i = 0; i < 60 * 8 && mode !== 'over'; i++) R(1);
    ok('T10b', mode === 'over' && coreHp === 0, `mode=${mode}`);
    reports.length = 0;
    G.reset(); G.noEvent(() => startGame(false));
  }

  // T11 W1 composition + clear reward (kill 36 + clear 22)
  {
    const before = essence;
    G.noEvent(() => callWave(false));
    ok('T11', spawnQ.length === 6 && mode === 'combat', `q=${spawnQ.length} mode=${mode}`);
    G.wipeEnemies(); R(3);
    ok('T11b', essence - before === 22 && mode === 'build', `delta=${essence - before} mode=${mode}`);
    reports.length = 0;
  }

  // T12 upgrade raises stats / T13 sell refunds 70% of invested
  {
    G.addEss(400);
    const t = G.place(0, 'ballista');
    const d0 = t.dmgFor();
    G.setSel(t);
    G.upgrade();
    ok('T12', t.lv === 1 && t.dmgFor() > d0, `dmg ${d0}→${t.dmgFor()}`);
    G.upgrade();
    ok('T12b', t.lv === 2, `lv=${t.lv}`);
    const inv = t.invested, before = essence;
    G.sell();
    ok('T13', essence === before + Math.floor(.7 * inv) && towers.length === 0, `refund ${Math.floor(.7 * inv)} of ${inv}`);
    G.place(0, 'ballista');   // keep a tower for later tests
  }

  // T14 shaman heals injured ally
  {
    const br = spawn('brute', .5, { noScale: true });
    br.takeHit(30);
    const h0 = br.hp;
    const sh = spawn('shaman', .52, { noScale: true });
    let healed = false;
    for (let i = 0; i < 60 * 4 && !healed; i++) { R(1); if (br.hp > h0 || !br.alive) healed = true; }
    ok('T14', br.hp > h0 || !br.alive, `hp ${h0}→${br.hp.toFixed(1)}`);
    G.wipeEnemies();
  }

  // T15 brute armor reduces per-hit damage
  {
    const br = spawn('brute', .5, { noScale: true });
    const eff = br.takeHit(8);
    ok('T15', eff === 5, `8-3=${eff}`);
    G.wipeEnemies();
  }

  // T16 colossus stomp disables nearest tower
  {
    const c = spawn('colossus', .12, { noScale: true });
    c.stompT = 2;
    let disabled = false;
    for (let i = 0; i < 60 * 8 && !disabled; i++) { R(1); if (towers.some(t => t.disabledT > 0)) disabled = true; }
    ok('T16', disabled, `tower disabled`);
    towers.forEach(t => { t.disabledT = 0; t.setDisabled(false); });
    G.wipeEnemies();
  }

  // T17 reaching wave 10 clear → victory + complete report + endless button
  {
    reports.length = 0;
    while (wave < TOTAL_WAVES && mode !== 'win') {
      mode = 'build';
      G.noEvent(() => callWave(false));
      G.wipeEnemies(); R(3);
    }
    ok('T17', mode === 'win' && wave === TOTAL_WAVES, `mode=${mode} wave=${wave}`);
    ok('T17b', reports.some(r => r.kind === 'complete'), `kinds=${reports.map(r => r.kind).join(',')}`);
    ok('T17c', document.getElementById('go2').style.display === 'block', 'endless btn visible');
    G.reset(); G.noEvent(() => startGame(false));
  }

  // T18 blessing draft offers 3 and applies (chain blessing, rate cap math)
  {
    const cards = G.draftOffer();
    ok('T18', cards.length === 3 && cards.every(c => c.id), `3 cards`);
    G.grant('grid'); G.grant('grid');
    const t = G.place(1, 'totem');
    ok('T18b', t.st().chain + mods.chain === 4, `chain ${t.st().chain}+${mods.chain}`);
    G.setSel(t); G.sell();
    G.grant('cap'); G.grant('cap'); G.grant('cap'); G.grant('cap'); G.grant('cap');
    ok('T18c', (counts.cap || 0) === 5 && mods.rate.toFixed(2) === '1.40', `cap=${counts.cap} rate=${mods.rate}`);
    counts.cap = 0; mods.rate = 1;
  }

  // T19 essence tide doubles kill reward
  {
    const before = essence;
    G.forceEvent('tide');
    const e = spawn('crawler', .02, { noScale: true });
    e.takeHit(9999); if (!e.alive) hooks.onDeath(e);
    ok('T19', essence - before === 12, `+${essence - before} (6×2)`);
    G.revertEvent('tide');
    G.wipeEnemies();
  }

  // T20 meteor strike kills on the road (only the test crawler is alive)
  {
    G.noEvent(() => callWave(false));
    G.wipeEnemies();                 // clear the wave queue: meteor must target our crawler
    G.forceEvent('meteor');
    const e = spawn('crawler', .5, { noScale: true });
    let dead = false;
    for (let i = 0; i < 60 * 16 && !dead; i++) { R(1); if (!e.alive && !e.leaked) dead = true; }
    ok('T20', dead, 'meteor killed');
    backToBuild();
  }

  // T21 fog cuts range and reverts
  {
    const t = towers[0] || G.place(0, 'ballista');
    const r0 = t.effRange(false);
    G.forceEvent('fog');
    const r1 = t.effRange(true);
    G.revertEvent('fog');
    ok('T21', r1 < r0 * .81 && t.effRange(false) === r0, `${r0.toFixed(2)}→${r1.toFixed(2)}`);
  }

  // T22 overcharge raises fire rate
  {
    const t = towers[0] || G.place(0, 'ballista');
    const a = t.effRate(0), b = t.effRate(18);
    ok('T22', b < a * .7, `${a.toFixed(2)}→${b.toFixed(2)}s`);
  }

  // T23 swarm inflates the spawn queue
  {
    swarmMult = 1.3;
    const q = G.buildSpawnQ(G.waveComp(1)).length;
    swarmMult = 1;
    ok('T23', q === 8, `q=${q} (6×1.3)`);
  }

  // T24 endless scaling, colossus cadence, elite affixes
  {
    const plan = wavePlan(TOTAL_WAVES + 6);
    ok('T24', plan.hpMult > 1.1 && plan.cycle >= 2, `hp×${plan.hpMult.toFixed(2)} cycle=${plan.cycle}`);
    endless = true;
    ok('T24b', waveComp(TOTAL_WAVES + 6).every(g => g[0] !== 'colossus') && waveComp(TOTAL_WAVES + 5).some(g => g[0] === 'colossus'), 'colossus every 5th');
    endless = false;
    const e = spawn('crawler', .1, { noScale: true, affixes: ['swift'] });
    ok('T24c', e.baseSpeed > ENEMY.crawler.spd && e.affixes.includes('swift') && e.tags.length === 1, `swift spd=${e.baseSpeed.toFixed(2)} tag=${e.tags.length}`);
    G.wipeEnemies();
  }

  // T25 best record persists
  {
    wavesCleared = 7; saveBest();
    ok('T25', best >= 7, `best=${best}`);
  }

  // T26 protocol frame shape
  {
    let got = [];
    G.setReportTarget((f) => got.push(f));
    report('progress', { wave: 3, score: 3 });
    ok('T26', got.length === 1 && got[0].kind === 'progress' && got[0].wave === 3, JSON.stringify(got[0] || {}));
    G.setReportTarget(null);
    reports.length = 0;
  }

  // T27 speed 2× advances sim twice as fast in real frames
  {
    mode = 'build'; callT = 10; G.setSpeed(2);
    G.real(60);
    const after2x = callT;
    G.setSpeed(1);
    G.real(60);
    const after1x = callT;
    ok('T27', Math.abs((10 - after2x) - 2) < .3 && Math.abs((after2x - after1x) - 1) < .3, `2×:${(10 - after2x).toFixed(2)}s 1×:${(after2x - after1x).toFixed(2)}s`);
    callT = 999;
  }

  // T28 boss wave switches score to 'boss'
  {
    endless = true; wave = TOTAL_WAVES + 4;
    G.noEvent(() => callWave(false));
    ok('T28', audio.state === 'boss', `state=${audio.state}`);
    endless = false;
    G.wipeEnemies(); mode = 'build'; callT = 999; audio.setState('build');
  }

  // T29 early call grants +15
  {
    mode = 'build'; callT = 8;
    const before = essence;
    G.noEvent(() => callWave(true));
    ok('T29', essence === before + 15 && mode === 'combat', `+${essence - before}`);
    backToBuild();
  }

  // T30 full 10-wave cruise — no crashes, no NaN, victory reached
  {
    G.reset(); G.noEvent(() => startGame(false));
    let crashed = false;
    try {
      for (let w = 1; w <= TOTAL_WAVES && mode !== 'win'; w++) {
        mode = 'build'; G.noEvent(() => callWave(false));
        R(90);              // let the wave spawn and fight for 1.5s
        G.wipeEnemies();    // clear the remainder (incl. queue)
        R(3);               // endWave fires → build / draft / win
        if (mode === 'draft') {
          const c = G.draftOffer();
          if (c.length) G.grant(c[0].id);
          G.ui.hideDraft();
          mode = 'build'; callT = 999;
        }
        if (mode === 'win') break;
      }
    } catch (err) { crashed = true; console.error('T30 crash', err); }
    ok('T30', !crashed && mode === 'win' && !nanFlag, `mode=${mode} nan=${nanFlag} wave=${wave}`);
    G.reset(); G.noEvent(() => startGame(false));
  }

  // T31 build cards open on pad select, close on deselect
  {
    G.select(6);
    const cards = document.getElementById('cards');
    ok('T31', cards.classList.contains('on'), 'cards open');
    deselect();
    ok('T31b', !cards.classList.contains('on'), 'cards closed');
  }

  // T33 flying takes the straight shortcut off the road
  {
    const w = spawn('wisp', 0, { noScale: true });
    ok('T33', w.fly && w.t === 0, 'ground t stays 0');
    for (let i = 0; i < 60; i++) R(1);
    const pathP = world.curve.getPointAt(Math.min(w.flyF, 1));
    const dev = w.group.position.distanceTo(pathP);
    ok('T33b', w.flyF > 0 && dev > 1, `flyF=${w.flyF.toFixed(2)} dev=${dev.toFixed(1)}m`);
    G.wipeEnemies();
  }

  // T34 touch call button fires a wave
  {
    const el = document.getElementById('twave');
    mode = 'build'; callT = 5;
    const before = essence;
    el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch' }));
    R(1);
    ok('T34', essence === before + 15 && mode === 'combat', `+${essence - before} mode=${mode}`);
    backToBuild();
  }

  // T35/T36 interaction regressions (with a sane stub viewport — the hidden
  // test guest may report 0x0; the stub also validates the self-heal path)
  {
    const dW = Object.getOwnPropertyDescriptor(window, 'innerWidth');
    const dH = Object.getOwnPropertyDescriptor(window, 'innerHeight');
    Object.defineProperty(window, 'innerWidth', { value: 1280, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 720, configurable: true });
    try {
      G.reset(); G.noEvent(() => startGame(false));
      G.step(2);
      world.camera.updateMatrixWorld(true); world.camera.matrixWorldInverse.copy(world.camera.matrixWorld).invert();
      const v = world.pads[3].pos.clone().setY(.5).project(world.camera);
      const px = Math.round((v.x * .5 + .5) * innerWidth), py = Math.round((-v.y * .5 + .5) * innerHeight);
      const cards = () => document.getElementById('cards').classList.contains('on');
      const gl = document.getElementById('gl');
      // touch tap directly on the pad → tap-to-select
      gl.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch', clientX: px, clientY: py }));
      G.pump();
      ok('T35', cards(), 'touch tap selects pad');
      deselect();
      // stray touch far away, then a mouse click inside the echo window → suppressed
      gl.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch', clientX: 40, clientY: 40 }));
      G.pump();
      gl.dispatchEvent(new MouseEvent('mousemove', { clientX: px, clientY: py, bubbles: true }));
      gl.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: px, clientY: py, bubbles: true }));
      G.pump();
      ok('T35b', !cards(), 'mouse click suppressed inside touch echo window');
      // UI press (target = a DOM button) must not raycast through the DOM and deselect
      G.clickAt(px, py);
      ok('T35c-pre', cards(), 'pad selected via direct click');
      document.getElementById('callbtn').dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true, clientX: px, clientY: py }));
      G.pump();
      ok('T35c', cards(), 'UI press does not deselect');
      deselect();
      // poisoned camera aspect (0x0 collapse) self-heals and picking revives
      const cam = world.camera;
      cam.aspect = NaN; cam.updateProjectionMatrix();
      G.upd(2);
      ok('T36', isFinite(cam.aspect) && Math.abs(cam.aspect - 1280 / 720) < 1e-6, `aspect=${cam.aspect}`);
      const v2 = world.pads[5].pos.clone().setY(.5).project(cam);
      const x = Math.round((v2.x * .5 + .5) * innerWidth), y = Math.round((-v2.y * .5 + .5) * innerHeight);
      G.clickAt(x, y);
      ok('T36b', document.getElementById('cards').classList.contains('on'), 'picking works after heal');
      deselect();
    } finally {
      if (dW) Object.defineProperty(window, 'innerWidth', dW); else delete window.innerWidth;
      if (dH) Object.defineProperty(window, 'innerHeight', dH); else delete window.innerHeight;
    }
  }

  // wrap: back to title
  G.reset();
  await nap();
  ok('DONE', T.passed + T.failed >= 30, `passed=${T.passed} failed=${T.failed}`);
  console.log(`__TEST ${T.passed} passed, ${T.failed} failed`);
}
if (new URLSearchParams(location.search).get('autotest')) autotest();
