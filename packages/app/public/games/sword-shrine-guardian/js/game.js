// Main: boot, fixed-step loop, wave director, camera-relative movement, music state,
// G debug hooks (step/upd/press/shot), ?params, and the ?autotest=1 self-test suite.
import * as THREE from '../vendor/three.module.min.js';
import { keys, pressed, endFrame, debugPanel, initTouch, stick } from './input.js';
import { makeWorld } from './world.js';
import { makeFX } from './fx.js';
import { makeAudio } from './audio.js';
import { makeUI } from './ui.js';
import { Player, Walker, Caster, Boss, Loot, angDiff } from './actors.js';
import { resolveCollisions, textTag } from './assets.js';
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
  coins: 0, blasts: [], meteorLands: [], meteorT: 0,
  fireZones: [], fovKick: () => world.rig.fovKick(),
  grantBuff,
  shake(a) { world.rig.shake(a); },
  slowmo(scale, dur) { this.timeScale = scale; this.slowT = dur; },
  onDeath: null, onPlayerDeath: null, onBossPhase2: null, onBossDeath: null,
};
ctx.player = new Player(ctx);
ctx.player.pos.set(0, 0, 10);
ctx.player.facing = Math.PI; // face the altar (north, -Z is toward gate; altar at -7.5)
world.ash = ash;
let state = 'title';
let stateT = 0;
reportReady();

// ---- inter-wave shop (灵币 economy) ----
const SHOP_ITEMS = [
  { id: 'heal',  name: '伤 药', desc: '立即回复 40 生命', price: 25 },
  { id: 'brew',  name: '灵 酿', desc: '体力回满，回复 10 生命', price: 15 },
  { id: 'forge', name: '重 铸', desc: '攻击伤害永久 +8%', price: 60 },
];
function grantRandomUpgrade() {
  const p = ctx.player;
  const pool = UPGRADES.filter(u => (p.upgradeCounts[u.id] || 0) < u.max);
  if (!pool.length) return false;
  const u = pool[Math.random() * pool.length | 0];
  u.apply(p);
  p.upgradeCounts[u.id] = (p.upgradeCounts[u.id] || 0) + 1;
  ui.toast('秘籍习得：' + u.name.replace(/ /g, ''));
  ui.upgradeList(Object.entries(p.upgradeCounts).map(([id, n]) => {
    const def = UPGRADES.find(x => x.id === id);
    return def ? def.name.replace(/ /g, '') + '×' + n : '';
  }).filter(Boolean).join('　'));
  audio.S.drop(1);
  return true;
}
function buyShopItem(id) {
  if (id === 'secret') {
    if ((ctx.coins || 0) < 45) { ui.toast('灵币不足'); audio.S.click(); return false; }
    ctx.coins -= 45;
    if (!grantRandomUpgrade()) ctx.coins += 45;   // pool exhausted: refund
    return true;
  }
  const it = SHOP_ITEMS.find(s => s.id === id);
  if (!it) return false;
  if ((ctx.coins || 0) < it.price) { ui.toast('灵币不足'); audio.S.click(); return false; }
  ctx.coins -= it.price;
  if (id === 'heal') ctx.player.hp = Math.min(ctx.player.maxHp, ctx.player.hp + 40);
  else if (id === 'brew') { ctx.player.stamina = ctx.player.maxStamina; ctx.player.hp = Math.min(ctx.player.maxHp, ctx.player.hp + 10); }
  else if (id === 'forge') ctx.player.mods.dmg += .08;
  ui.refreshShopCoins(ctx.coins);
  ui.toast(it.name.replace(/ /g, '') + ' 已购');
  audio.S.drop(1);
  return true;
}
// endless zone rotation: each full cycle beyond the first re-skins the shrine grounds
function zoneFor(i) {
  const cyc = Math.floor(i / 4) - 1;
  if (cyc < 1) return 'night';
  return ['snow', 'firefly', 'night'][(cyc - 1) % 3];
}

// ---- director ----
const WAVES = [
  { walkers: 3, casters: 0, label: '第 一 波' },
  { walkers: 2, casters: 1, label: '第 二 波' },
  { walkers: 2, casters: 2, label: '第 三 波' },
];
const director = { wave: -1, phase: 'calm', calmT: 1.2, bossSpawned: false, endless: false, scale: 1, dmgScale: 1 };

// ---- best-wave record (localStorage; wrapped — iframes may deny storage) ----
const BEST_KEY = 'ssg.bestWave';
function loadBest() { try { return +localStorage.getItem(BEST_KEY) || 0; } catch (e) { return 0; } }
function saveBest(v) { try { localStorage.setItem(BEST_KEY, String(v)); } catch (e) { } }
let bestWave = loadBest();
function recordWave(v) { if (v > bestWave) { bestWave = v; saveBest(bestWave); ui.titleBest(`最高波次 ${bestWave}`); return true; } return false; }

// ---- daily trial: same seed for everyone on the same calendar day ----
const DAILY_SEED = (() => { const d = new Date(); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); })();
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function dailyKey() { return 'ssg.dailyBest.' + DAILY_SEED; }
function dailyBest() { try { return +localStorage.getItem(dailyKey()) || 0; } catch (e) { return 0; } }
function recordDaily(v) { try { if (v > dailyBest()) localStorage.setItem(dailyKey(), String(v)); } catch (e) { } }
// per-wave deterministic event: works for endless waves too (no fixed-length plan to run out of)
function dailyEventFor(i) {
  const r = mulberry32(DAILY_SEED * 7 + (i + 1) * 131)();
  const bossSlot = i % 4 === 3;
  const pool = EVENT_POOL.filter(e => e.bossOk || !bossSlot);
  return pool[Math.floor(r * pool.length)].id;
}
function startDaily() {
  resetGame();
  director.daily = true;
  const rng = mulberry32(DAILY_SEED ^ 0x9e3779b9);
  const pool = UPGRADES.slice();
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1));[pool[i], pool[j]] = [pool[j], pool[i]]; }
  for (const u of pool.slice(0, 2)) { u.apply(ctx.player); ctx.player.upgradeCounts[u.id] = (ctx.player.upgradeCounts[u.id] || 0) + 1; }
  ui.upgradeList(Object.entries(ctx.player.upgradeCounts).map(([id, n]) => {
    const def = UPGRADES.find(x => x.id === id);
    return def ? def.name.replace(/ /g, '') + '×' + n : '';
  }).filter(Boolean).join('　'));
  state = 'play'; stateT = 0; ui.hud();
  director.phase = 'calm'; director.calmT = 1.4; director.wave = -1;
  ui.toast('每日试炼 · 今日事件顺序全场一致');
}
function endlessDef(i) {
  // every 4th endless wave is a boss; each full cycle scales enemies up
  const cyc = Math.max(0, Math.floor(i / 4) - 1), k = i % 4;
  if (k === 3) return { boss: true, scale: 1 + cyc * .5, dmgS: 1 + cyc * .12 };
  const comps = [[3, 0], [2, 1], [3, 2]];
  return { walkers: comps[k][0], casters: comps[k][1], scale: 1 + cyc * .18, dmgS: 1 + cyc * .1 };
}

// ---- random night events: spice for normal late waves and endless alike ----
const ALTAR_POS = V(0, 0, -7.5);
const EVENT_POOL = [
  { id: 'blood',  name: '血 月', desc: '血月当空：敌人伤害 +25%，击杀必掉回复', weight: 2,   bossOk: false },
  { id: 'fog',    name: '雾 隐', desc: '浓雾蔽目：视野大减，敌人迟缓 20%', weight: 2,   bossOk: false },
  { id: 'spirit', name: '剑 灵', desc: '剑灵显圣：周期落剑斩向最近的敌人 · 18 秒', weight: 2,  bossOk: true },
  { id: 'tide',   name: '灵 潮', desc: '灵潮涌动：移速 +12%、体力回复翻倍、闪避耗 -8 · 25 秒', weight: 2, bossOk: true },
  { id: 'altar',  name: '恩 赐', desc: '祭坛苏醒：立于光圈内每秒回复生命', weight: 1.5, bossOk: true },
  { id: 'chest',  name: '异 客', desc: '金装客人携赏而来：速斩之！', weight: 1.5, bossOk: false },
  { id: 'merchant', name: '商 客', desc: '雾中行商停驻片刻 · 携币者速往', weight: 1.2, bossOk: false },
];

// ---- elite affixes: rules-bending modifiers on some minions (from wave 2 on) ----
const AFFIXES = [
  { id: 'blast', name: '爆裂', color: 0xff8a5c, tag: '#ff8a5c' },
  { id: 'iron',  name: '铁壁', color: 0x9ab0d8, tag: '#9ab0d8' },
  { id: 'swift', name: '迅捷', color: 0x8ff0c0, tag: '#8ff0c0' },
  { id: 'leech', name: '嗜血', color: 0xe06a8a, tag: '#e06a8a' },
  { id: 'frost', name: '冰霜', color: 0x9fd8ff, tag: '#bfe4ff', late: true },
  { id: 'thorn', name: '荆棘', color: 0xc8a0ff, tag: '#d8b3ff', late: true },
];
function applyAffix(e, a) {
  if (!e.affix) e.affix = a.id; else if (!e.affix2 && e.affix !== a.id) e.affix2 = a.id; else return;
  e.rig.mats.trim.color.lerp(new THREE.Color(a.color), .4);
  const tagCanvas = textTag(a.name, a.tag);
  const tex = new THREE.CanvasTexture(tagCanvas); tex.colorSpace = THREE.SRGBColorSpace;
  const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  tag.scale.set(1.0, .35, 1);
  // the rig group sits at the scene origin with world-space children: tags must track the owner each frame
  tag.position.set(e.pos.x, 2.0 * e.scale + .1, e.pos.z);
  e.rig.grp.add(tag);
  (e.tagSprites = e.tagSprites || []).push(tag);
  if (a.id === 'swift') { e.speed *= 1.4; e.teleT = .7 * .85; }
}
// blast zones left by 爆裂 elites: telegraph then erupt
function updateBlasts(dt) {
  for (let i = ctx.blasts.length - 1; i >= 0; i--) {
    const b = ctx.blasts[i];
    b.t += dt;
    if (b.t >= .55) {
      ctx.fx.ring(b.pos, { r0: .3, r1: 2, color: 0xff8a5c, dur: .35 });
      ctx.fx.burst(b.pos.clone().add(V(0, .4, 0)), 0xffa070, { n: 9, size: 1, speed: 5 });
      ctx.audio.S.slam();
      if (ctx.player.alive && ctx.player.pos.distanceTo(b.pos) < 1.9) ctx.player.receiveProj({ dmg: 14 * (director.dmgScale || 1), vel: ctx.player.pos.clone().sub(b.pos).setY(0).normalize() });
      ctx.blasts.splice(i, 1);
    }
  }
}

// ---- meteor: a falling spirit-stone that grants a 30s buff ----
const BUFFS = [
  { id: 'fervor', name: '狂热', desc: '伤害 +25%' },
  { id: 'aegis',  name: '金身', desc: '受伤 -30%' },
  { id: 'gale',   name: '疾风', desc: '移速 +20%' },
];
function spawnMeteor(forcePos) {
  let spot = forcePos;
  if (!spot) {
    const a = Math.random() * 6.28, r = Math.sqrt(Math.random()) * 8;
    spot = ctx.player.pos.clone().add(V(Math.cos(a) * r, 0, Math.sin(a) * r));
    resolveCollisions(spot, .3, ctx.colliders);
  }
  audio.S.meteor();
  fx.teleCircle(spot, { r: 1.4, dur: .9, color: 0xffd98c });
  fx.fallMeteor(spot, () => {
    ctx.meteorLands.push({ pos: spot.clone(), wait: .05 });
    audio.S.slam();
  });
}
function grantBuff() {
  const b = BUFFS[Math.random() * BUFFS.length | 0];
  ctx.player.buff = { id: b.id, name: b.name, until: ctx.time + 30 };
  ui.toast(b.name + '：' + b.desc + ' · 30 秒');
  audio.S.drop(1);
}

// ---- site report bridge (gameMessageProtocol v1): no-op when not embedded ----
function reportReady() { try { if (window.parent && window.parent !== window) window.parent.postMessage({ source: 'lightgame', type: 'lightgame:ready' }, '*'); } catch (e) { } }
function report(payload, target) {
  try {
    const w = target || (window.parent && window.parent !== window ? window.parent : null);
    if (w) w.postMessage({ source: 'lightgame', type: 'lightgame:report', payload }, '*');
  } catch (e) { }
}
function maybeEvent(i) {
  if (ctx.noDirector) return;
  // daily trial: per-wave seeded event — everyone gets the same run rules, endless included
  if (director.daily) { applyEvent(EVENT_POOL.find(e => e.id === dailyEventFor(i))); return; }
  const isBoss = i >= WAVES.length;
  const chance = director.endless ? .55 : .4;
  if (Math.random() > chance) return;
  let pool = EVENT_POOL.filter(e => e.id !== ctx.lastEventId);
  if (isBoss) pool = pool.filter(e => e.bossOk);
  if (!pool.length) return;
  const total = pool.reduce((s, e) => s + e.weight, 0);
  let roll = Math.random() * total;
  for (const ev of pool) { roll -= ev.weight; if (roll <= 0) { applyEvent(ev); break; } }
  // deep endless: a second event may stack on top — rules collide in surprising ways
  ctx.event2 = null;
  if (director.endless && i >= 16 && Math.random() < .5) {
    const rest = EVENT_POOL.filter(e => e.id !== (ctx.event && ctx.event.id) && (isBoss ? e.bossOk : true) && e.id !== ctx.lastEventId);
    if (rest.length) { const ev2 = rest[Math.random() * rest.length | 0]; applyEvent(ev2, true); ctx.event2 = ev2; }
  }
}
function applyEvent(ev, quiet = false) {
  ctx.lastEventId = ev.id;
  ctx.event = ev;
  if (quiet) ui.toast(ev.name + '：' + ev.desc);
  else { ui.banner(ev.name, ev.desc, 2.6); audio.S.drop(1); }
  if (ev.id === 'blood') { director.dmgScale *= 1.25; ctx.bloodMoon = true; world.setMood('blood'); }
  else if (ev.id === 'fog') { ctx.fogEvent = true; world.setMood('fog'); }
  else if (ev.id === 'spirit') { ctx.spiritT = 18; ctx.spiritTick = 3; }
  else if (ev.id === 'tide') { ctx.tideT = 25; ctx.player._counterMark = true; fx.counterRing(ctx.player); }
  else if (ev.id === 'altar') { ctx.altarT = 1; ctx.altarRing = fx.teleCircle(ALTAR_POS, { r: 3.6, dur: 999, color: 0x9fe8ff }); }
  else if (ev.id === 'merchant') {
    // fog-borne peddler: three timed coin offers near the player, one of them a random-secret
    const spot = ctx.player.pos.clone().add(V((Math.random() - .5) * 6, 0, (Math.random() - .5) * 6));
    resolveCollisions(spot, .5, ctx.colliders);
    ctx.merchantSpot = spot;
    ctx.merchantRing = fx.teleCircle(spot, { r: 1.6, dur: 14, color: 0xffd98c });
    ctx.merchantUntil = ctx.time + 13;
    const others = SHOP_ITEMS.filter(s => s.id !== 'heal').slice(0, 1).concat([SHOP_ITEMS[0]]);
    ui.showMerchant(ctx.coins, [
      { id: 'secret', name: '秘 籍', desc: '随机强化 +1 层', price: 45 },
      { id: others[0].id, name: others[0].name, desc: others[0].desc, price: others[0].price },
      { id: others[1].id, name: others[1].name, desc: others[1].desc, price: others[1].price },
    ], buyShopItem);
  }
  else if (ev.id === 'chest') { spawnChest(); }
}
function revertEvent() {
  if (!ctx.event) return;
  const id = ctx.event.id;
  if (id === 'blood') { director.dmgScale /= 1.25; ctx.bloodMoon = false; world.setMood('normal'); }
  else if (id === 'fog') { ctx.fogEvent = false; world.setMood('normal'); }
  else if (id === 'spirit') ctx.spiritT = 0;
  else if (id === 'tide') { ctx.tideT = 0; ctx.player._counterMark = false; }
  else if (id === 'altar') { ctx.altarT = 0; if (ctx.altarRing) { ctx.altarRing.kill(); ctx.altarRing = null; } }
  ctx.event = null; ctx.event2 = null;
}
function spawnChest() {
  const e = spawnEnemy('walker');
  e.chest = true; e.passive = true;
  e.hp = e.maxHp = 22; e.speed = 5.2;
  e.rig.mats.cloth.color.setHex(0xd8b36a); e.rig.mats.trim.color.setHex(0xf4e3b8); e.rig.mats.skin.color.setHex(0xffe9b8);
  e.state = 'strafe'; e.strafeT = 1e9;
  return e;
}

// ---- upgrade pool: offered 3-at-a-time after each cleared wave (roguelite-lite) ----
const UPGRADES = [
  { id: 'atk',   name: '锋 锐', desc: '攻击伤害 +15%', max: 8, apply(p) { p.mods.dmg += .15; } },
  { id: 'hp',    name: '罡 体', desc: '生命上限 +25，并立即回复 25', max: 8, apply(p) { p.maxHp += 25; p.hp = Math.min(p.maxHp, p.hp + 25); } },
  { id: 'spd',   name: '疾 风', desc: '移动速度 +10%', max: 4, apply(p) { p.mods.speed += .1; } },
  { id: 'wave',  name: '剑 气 弹', desc: '重击第三段放出飞行剑气，再次选择提升伤害', max: 3, apply(p) { if (p.mods.swordWave === 0) p.mods.swordWave = 1; else p.mods.waveDmg += 10; } },
  { id: 'leech', name: '汲 血', desc: '每次命中回复 1.5 生命', max: 4, apply(p) { p.mods.lifesteal += 1.5; } },
  { id: 'dash',  name: '流 影', desc: '闪避消耗 -5，冷却 -25%', max: 3, apply(p) { p.mods.dashCost = Math.max(10, p.mods.dashCost - 5); p.mods.dashCd *= .75; } },
  { id: 'tough', name: '韧 皮', desc: '受到的伤害 -12%', max: 4, apply(p) { p.mods.dmgTaken = Math.max(.4, p.mods.dmgTaken * .88); } },
  { id: 'stam',  name: '气 海', desc: '体力上限 +30，回复速度 +20%', max: 4, apply(p) { p.maxStamina += 30; p.stamina = Math.min(p.maxStamina, p.stamina + 20); p.mods.stamRegen *= 1.2; } },
  { id: 'parry', name: '听 风', desc: '弹反窗口 +0.08s，反击窗口 +0.25s', max: 5, apply(p) { p.mods.parryWin += .08; p.mods.counterWin += .25; } },
  { id: 'heavy', name: '崩 山', desc: '重击伤害 +25%', max: 6, apply(p) { p.mods.heavy += .25; } },
  { id: 'sqi',   name: '气 斩', desc: '剑气斩（L）伤害 +40%，冷却 -15%', max: 6, apply(p) { p.mods.waveSkillDmg = Math.round(p.mods.waveSkillDmg * 1.4); p.mods.waveCdMult *= .85; } },
  { id: 'srain', name: '剑 雨', desc: '剑雨（U）每道伤害 +30%，落剑范围 +0.5', max: 6, apply(p) { p.mods.rainHitDmg = Math.round(p.mods.rainHitDmg * 1.3); p.mods.rainMult *= 1.3; p.mods.rainR += .5; } },
  { id: 'dbl',   name: '迅 影', desc: '闪避后 1 秒内可再次闪避，消耗减半', max: 1, apply(p) { p.mods.dbl = 1; } },
  { id: 'exec',  name: '破 军', desc: '处决伤害 +30%，处决回复 10 生命', max: 3, apply(p) { p.mods.execBonus += .3; p.mods.execHeal += 10; } },
  { id: 'shadow',name: '剑 影', desc: '剑气斩（L）额外放出一道剑气', max: 2, apply(p) { p.mods.shadow += 1; } },
];
function offerUpgrades() {
  const p = ctx.player;
  const pool = UPGRADES.filter(u => (p.upgradeCounts[u.id] || 0) < u.max);
  if (!pool.length) { director.phase = 'calm'; director.calmT = 2.2; return; }
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0;[pool[i], pool[j]] = [pool[j], pool[i]]; }
  ctx.pendingUpgrades = pool.slice(0, 3);
  director.phase = 'choose';
  ui.showUpgrades(ctx.pendingUpgrades.map(u => ({ name: u.name, desc: u.desc, stacks: p.upgradeCounts[u.id] || 0 })), pickUpgrade, { coins: ctx.coins || 0, items: SHOP_ITEMS, onBuy: buyShopItem });
  ui.banner('择 一 而 强', '点击或按 1 / 2 / 3 · 灵币可在下方商铺消费', 2.4);
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
function spawnEnemy(kind, bossKind) {
  const p = spawnPoint();
  const e = kind === 'walker' ? new Walker(ctx, p)
    : kind === 'caster' ? new Caster(ctx, p)
    : new Boss(ctx, p, bossKind || 'stone');
  const m = director.scale || 1;
  if (m !== 1) { e.hp *= m; e.maxHp *= m; }
  e.dmgScale = director.dmgScale || 1;
  if (ctx.fogEvent) e.speed *= .8;                 // 雾隐: enemies slow
  // elite affix: from wave 2 on, some minions carry a rules-bending modifier; deep waves may stack two
  if (kind !== 'boss' && director.wave >= 1 && director.affixCount < 2) {
    const deep = director.endless && director.wave >= 16;
    const chance = director.endless ? (deep ? .45 : .3) : .22;
    if (Math.random() < chance) {
      director.affixCount++;
      const pool = AFFIXES.filter(a => !a.late || director.wave >= 10 || director.endless);
      applyAffix(e, pool[Math.random() * pool.length | 0]);
      if (deep && Math.random() < .12) applyAffix(e, pool[Math.random() * pool.length | 0]);   // twin affixes
    }
  }
  ctx.enemies.push(e);
  return e;
}
function startWave(i) {
  director.wave = i; director.phase = 'fight';
  const isEndless = i >= WAVES.length;
  const def = isEndless ? endlessDef(i) : WAVES[i];
  director.scale = def.scale || 1; director.dmgScale = def.dmgS || 1;
  director.affixCount = 0;
  ctx.meteorT = 10 + Math.random() * 6;            // a meteor may fall mid-wave
  if (def.boss) { startBoss(true); return; }
  ui.banner(isEndless ? `第 ${i + 1} 波` : def.label, '歼灭来犯之敌');
  if (isEndless) world.setZone(zoneFor(i));        // endless rotates the grounds each cycle
  for (let k = 0; k < def.walkers; k++) spawnEnemy('walker');
  for (let k = 0; k < def.casters; k++) spawnEnemy('caster');
  audio.setMusic('combat');
  ui.waveTag(`第 ${i + 1} 波 · 纪录 ${bestWave}`);
  maybeEvent(i);                                   // a night event may spice this wave
}
function bossKindFor(waveIdx, endless) {
  const cyc = Math.floor(waveIdx / 4) - 1;
  return (!endless || cyc % 2 === 0) ? 'stone' : 'lantern';
}
const BOSS_LINES = {
  stone: { spawn: '石躯承夜，我是唯一的看守。', rage: '炉火……未曾熄灭。', death: '守夜……至此为止。' },
  lantern: { spawn: '灯火所照，皆为吾疆。', rage: '看啊，万千灯火！', death: '灯灭……夜阑……' },
};
function startBoss(endless = false) {
  director.phase = 'boss';
  if (!endless) director.wave = WAVES.length;
  const kind = bossKindFor(director.wave, endless);
  const b = spawnEnemy('boss', kind);
  b.pos.copy(endless ? spawnPoint(9) : V(0, 0, -7.5 - 6));
  b.facing = Math.atan2(ctx.player.pos.x - b.pos.x, ctx.player.pos.z - b.pos.z);
  ctx.boss = b;
  const lines = BOSS_LINES[kind];
  ui.banner(endless ? '守 卫 再 临' : '守 卫 苏 醒', lines.spawn, 3);
  ui.bossQuote(lines.spawn);
  audio.setMusic('boss');
  audio.S.roar();
  ui.waveTag(`第 ${director.wave + 1} 波 · 纪录 ${bestWave}`);
  ctx.onSummon = () => { spawnEnemy('walker'); spawnEnemy('walker'); ui.toast('提灯鬼召来帮手'); };
  ctx.onBossPhase2 = () => { ui.banner('守 卫 之 怒', lines.rage, 2.6); ui.bossQuote(lines.rage); audio.setMusic('boss2'); };
  ctx.onBossDeath = () => {
    ctx.slowmo(.35, 1.2);
    ui.bossQuote(lines.death);
    recordWave(director.wave + 1);
    if (director.endless) {
      audio.S.win();
      ui.banner('守 卫 陨 落', '坚守仍要继续');
      director.phase = 'calm'; director.calmT = 2.4;
      ui.waveTag(`第 ${director.wave + 2} 波 · 纪录 ${bestWave}`);
    } else {
      setTimeout(() => {
        if (state === 'play') {
          state = 'win'; stateT = 0;
          report({ kind: 'complete', score: WAVES.length + 1 });
          ui.end('夜 尽 天 明', `你守住了剑祠 · 最高波次 ${bestWave}`, true);
          audio.setMusic('explore');
        }
      }, 2200);
    }
  };
}
function advanceDirector(dt) {
  if (ctx.noDirector || director.phase === 'choose') return;   // 'choose' waits for the player's pick
  if (director.phase === 'calm') {
    director.calmT -= dt;
    if (director.calmT <= 0) {
      const next = director.wave + 1;
      if (next < WAVES.length) startWave(next);
      else if (!director.endless) { if (!director.bossSpawned) { director.bossSpawned = true; startBoss(false); } }
      else startWave(next);                                    // endless: waves and bosses cycle forever
    }
  } else if (director.phase === 'fight') {
    const alive = ctx.enemies.some(e => e.alive);
    if (!alive && ctx.enemies.length) {
      // wave cleared: heal, record progress, then the three-choice upgrade offer
      ctx.enemies.length = 0; // corpses already removed by cleanup loop
      ctx.player.hp = Math.min(ctx.player.maxHp, ctx.player.hp + 15);
      ui.toast('喘息 · 生命回复 +15');
      recordWave(director.wave + 1);
      ui.waveTag(`第 ${director.wave + 2} 波 · 纪录 ${bestWave}`);
      report({ kind: 'progress', data: { wave: director.wave + 1, endless: director.endless } });
      revertEvent();
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
  revertEvent();
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
  director.endless = false; director.scale = 1; director.dmgScale = 1; director.affixCount = 0;
  director.daily = false;
  ctx.lastEventId = null; ctx.bloodMoon = false; ctx.fogEvent = false;
  ctx.spiritT = 0; ctx.tideT = 0; ctx.altarT = 0; ctx.event = null;
  ctx.blasts.length = 0; ctx.meteorLands.length = 0; ctx.meteorT = 0; ctx.coins = 0;
  for (const z of ctx.fireZones) z.fx.kill();
  ctx.fireZones.length = 0; ctx.onSummon = null;
  ctx.merchantUntil = 0; if (ctx.merchantRing) { ctx.merchantRing.kill(); ctx.merchantRing = null; }
  ui.closeMerchant();
  world.setMood('normal'); world.setZone('night');
  ui.waveTag('');
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
  setTimeout(() => {
    if (state !== 'play') return;
    state = 'dead'; stateT = 0;
    const newBest = recordWave(director.wave + 1);
    recordDaily(director.wave + 1);
    report({ kind: 'gameOver', score: director.wave + 1, progress: { wave: director.wave + 1, endless: director.endless } });
    const dailyLine = director.daily ? ` · 今日试炼 ${Math.max(director.wave + 1, dailyBest())}` : '';
    const desc = director.endless
      ? `坚守至第 ${director.wave + 1} 波 · 纪录 ${bestWave}${newBest ? ' · 新纪录！' : ''}${dailyLine}`
      : `剑祠在夜色中陷落 · 最高波次 ${bestWave}${newBest ? ' · 新纪录！' : ''}${dailyLine}`;
    ui.end('身 死 祠 破', desc, false);
  }, 1400);
};
// after the boss falls, keep holding the shrine: waves cycle forever, every 4th spawns a stronger guardian
function enterEndless() {
  if (state !== 'win') return;
  director.endless = true;
  director.bossSpawned = true;
  clearAll();
  ui.hideEnd(); ui.hud();
  state = 'play'; stateT = 0;
  director.phase = 'calm'; director.calmT = 1.6;
  ui.toast('无尽坚守开始 · 每波之间仍可择强化');
  audio.setMusic('explore');
  ui.waveTag(`第 ${director.wave + 2} 波 · 纪录 ${bestWave}`);
}
ctx.onDeath = (e) => {
  // 爆裂 elite: leaves a short-fuse blast zone at the corpse
  if (e.affix === 'blast' || e.affix2 === 'blast') {
    ctx.fx.teleCircle(e.pos, { r: 1.9, dur: .55, color: 0xff8a5c });
    ctx.blasts.push({ pos: e.pos.clone(), t: 0 });
  }
  // loot drop on kill (skill: 掉落物); 血月 guarantees heals; every kill pays coins (shop economy)
  if (e.chest) {
    ctx.coins += 30;
    ctx.loots.push(new Loot(ctx, e.pos.clone(), 'heal', 1));
    const pool = UPGRADES.filter(u => (ctx.player.upgradeCounts[u.id] || 0) < u.max);
    if (pool.length) {
      const u = pool[Math.random() * pool.length | 0];
      u.apply(ctx.player);
      ctx.player.upgradeCounts[u.id] = (ctx.player.upgradeCounts[u.id] || 0) + 1;
      ui.toast('宝箱赏赐：' + u.name.replace(/ /g, ''));
      ui.upgradeList(Object.entries(ctx.player.upgradeCounts).map(([id, n]) => {
        const def = UPGRADES.find(x => x.id === id);
        return def ? def.name.replace(/ /g, '') + '×' + n : '';
      }).filter(Boolean).join('　'));
      audio.S.drop(1);
    }
  } else {
    if (e instanceof Boss) { ctx.coins += 60; ui.toast('守卫遗落 · 灵币 +60'); }
    else ctx.loots.push(new Loot(ctx, e.pos.clone(), 'coin'));
    const roll = Math.random();
    if (e instanceof Walker && roll < (ctx.bloodMoon ? 1 : .45)) ctx.loots.push(new Loot(ctx, e.pos.clone(), 'heal'));
    else if (e instanceof Caster && roll < (ctx.bloodMoon ? 1 : .7)) ctx.loots.push(new Loot(ctx, e.pos.clone(), 'spirit'));
  }
  if (ctx.meleeToken === e) ctx.meleeToken = null;
};

// ---- input mapping ----
initTouch();
function processInput() {
  for (const c of pressed) {
    if (c === 'KeyJ') ctx.player.press('attack');
    else if (c === 'Space') ctx.player.press('dash');
    else if (c === 'KeyK') ctx.player.press('parry');
    else if (c === 'KeyL') ctx.player.press('wave');
    else if (c === 'KeyU') ctx.player.press('rain');
    else if (c === 'KeyE') ctx.player.press('strike');
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
            e.takeHit({ dmg: o.dmg, weight: o.weight || 'wave', dir: o.vel.clone().setY(0).normalize(), heavy: false, from: p, knock: 1.5 });
            if (e.posture !== undefined) e.posture += 6;
            ctx.waveHitT = ctx.time;                     // 剑气合击 window opens
            o.kill();
            fx.burst(o.pos, 0xaef0ff, { n: 7, size: .9, speed: 4 });
            audio.S.orbBreak();
            break;
          }
        }
      } else if (o.pos.distanceTo(p.pos.clone().add(V(0, 1, 0))) < .62 + (o.r || .2)) {
        // hitbox includes the orb radius: the visual halo is much wider than .62, shots looked like they passed through
        p.receiveProj(o);
        o.kill();
        fx.burst(o.pos, 0x8fe8cc, { n: 6, size: .8, speed: 3.5 });
        if (o.frost) p.frostT = 1.2;
      }
      if (o.pos.length() > 60) o.kill();
    }
    ctx.projectiles = ctx.projectiles.filter(o => o.alive);
    // --- elite affix blasts / meteor ---
    updateBlasts(sdt);
    if (director.phase === 'fight' && !ctx.boss) {
      ctx.meteorT -= sdt;
      if (ctx.meteorT <= 0) { ctx.meteorT = 13 + Math.random() * 7; spawnMeteor(); }
    }
    for (let i = ctx.meteorLands.length - 1; i >= 0; i--) {
      const m = ctx.meteorLands[i];
      m.wait -= sdt;
      if (m.wait <= 0) { ctx.loots.push(new Loot(ctx, m.pos, 'buff')); ctx.meteorLands.splice(i, 1); }
    }
    // merchant peddler lingers a while, then departs
    if (ctx.merchantUntil > 0) {
      ui.merchantLeft(Math.max(0, Math.ceil(ctx.merchantUntil - ctx.time)) + ' 秒后离去 · 灵币 ' + (ctx.coins || 0));
      if (ctx.time > ctx.merchantUntil) { ui.closeMerchant(); ctx.merchantUntil = 0; if (ctx.merchantRing) { ctx.merchantRing.kill(); ctx.merchantRing = null; } ui.toast('商人隐入雾中'); }
    }
    // --- night event timers ---
    if (ctx.spiritT > 0) {
      ctx.spiritT -= dt; ctx.spiritTick = (ctx.spiritTick ?? 3) - dt;
      if (ctx.spiritTick <= 0) {
        ctx.spiritTick = 3;
        const targets = ctx.enemies.filter(e => e.alive).sort((a, b) => a.pos.distanceTo(p.pos) - b.pos.distanceTo(p.pos));
        if (targets.length) {
          const t = targets[0];
          fx.fallBlade(t.pos.clone()); audio.S.rainHit();
          t.takeHit({ dmg: 16 * p.mods.dmg, dir: V(Math.sin(ctx.time * 2), 0, Math.cos(ctx.time * 2)), heavy: false, from: p });
          if (t.posture !== undefined) t.posture += 5;
        }
      }
      if (ctx.spiritT <= 0) ui.toast('剑灵离去');
    }
    if (ctx.tideT > 0) {
      ctx.tideT -= dt;
      if (ctx.tideT <= 0) { ctx.tideT = 0; p._counterMark = false; ui.toast('灵潮退去'); }
    }
    if (ctx.altarT > 0 && p.alive) {
      ctx.altarHeal = (ctx.altarHeal || 0) + dt;
      if (p.pos.distanceTo(ALTAR_POS) < 3.6 && ctx.altarHeal >= 1) {
        ctx.altarHeal -= 1;
        p.hp = Math.min(p.maxHp, p.hp + 3);
        fx.burst(p.pos.clone().add(V(0, 1, 0)), 0x9fe8ff, { n: 3, size: .5, speed: 2 });
      }
    }
    for (const l of ctx.loots) l.update(sdt);
    ctx.loots = ctx.loots.filter(l => l.alive);
    advanceDirector(sdt);
    // corpses: remove rig after 1.8s
    for (let i = ctx.enemies.length - 1; i >= 0; i--) {
      const e = ctx.enemies[i];
      if (!e.alive && e.deadT > 1.8) { ctx.scene.remove(e.rig.grp); ctx.enemies.splice(i, 1); }
    }
    // music state (boss phase 2 gets the intensified layer)
    const liveBoss = ctx.enemies.find(e => e instanceof Boss && e.alive);
    if (liveBoss) audio.setMusic(liveBoss.phase === 2 ? 'boss2' : 'boss');
    else if (ctx.enemies.some(e => e.alive)) audio.setMusic('combat');
    else audio.setMusic('explore');
    // burning ground zones (提灯鬼)
    for (let i = ctx.fireZones.length - 1; i >= 0; i--) {
      const z = ctx.fireZones[i];
      if (ctx.time > z.until) { z.fx.kill(); ctx.fireZones.splice(i, 1); continue; }
      z.tick = (z.tick || 0) - sdt;
      if (z.tick <= 0) {
        z.tick = .5;
        if (p.alive && p.pos.distanceTo(z.pos) < 2.2) p.burnTick(4 * (director.dmgScale || 1));
      }
    }
    // HUD
    const pmax = p.maxHp;
    ui.hp(p.hp / pmax, p._ghost === undefined ? p.hp / pmax : p._ghost / pmax);
    p._ghost = (p._ghost === undefined ? p.hp : p._ghost) > p.hp ? p._ghost : p.hp;
    if (p._ghost > p.hp) p._ghost = Math.max(p.hp, p._ghost - dt * 30);
    ui.stamina(p.stamina / p.maxStamina);
    ui.skillCd(2, p.dashCdT > 0 ? p.dashCdT / .45 : 0);
    if (p.dashCdT > 0) p.dashCdT -= dt;
    ui.skillCd(3, p.waveCdT > 0 ? p.waveCdT / (5 * p.mods.waveCdMult) : 0);
    ui.skillCd(4, p.rainCdT > 0 ? p.rainCdT / 9 : 0);
    ui.skillCd(5, p.strikeCdT > 0 ? p.strikeCdT / 8 : 0);
    ui.buffTag(p.buff ? p.buff.name + ' ' + Math.max(0, Math.ceil(p.buff.until - ctx.time)) + 's' : '');
    ui.coinHud('灵币 ' + (ctx.coins || 0));
    if (ctx.boss) ui.boss(ctx.boss.alive, ctx.boss.displayName, ctx.boss.hp / ctx.boss.maxHp, ctx.boss.posture / ctx.boss.maxPosture);
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
ui.titleBest(`最高波次 ${bestWave}${dailyBest() > 0 ? ' · 今日试炼 ' + dailyBest() : ''}`);
document.getElementById('startbtn').addEventListener('click', () => {
  audio.mute(false); audio.setMusic('explore'); audio.startAmbient();
  audio.S.click();
  resetGame();
});
document.getElementById('dailybtn').addEventListener('click', () => {
  audio.mute(false); audio.setMusic('explore'); audio.startAmbient();
  audio.S.click();
  startDaily();
});
document.getElementById('end').querySelector('.go').addEventListener('click', () => {
  audio.S.click();
  resetGame();
});
document.getElementById('end').querySelector('.go2').addEventListener('click', () => {
  audio.S.click();
  enterEndless();
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
  best: () => bestWave,
  record: recordWave,
  startDaily,
  dailyEventFor,
  events: EVENT_POOL,
  bossKindFor,
  spawnBoss: (kind, pos) => { const b = spawnEnemy('boss', kind || 'stone'); if (pos) b.pos.copy(pos); return b; },
  enterEndless: () => { state = 'win'; enterEndless(); },   // test hook: bypass the win-screen gate
  endlessDef,
  forceEvent: (id) => applyEvent(EVENT_POOL.find(e => e.id === id)),
  maybeEvent,
  affixes: AFFIXES,
  coins: () => ctx.coins,
  addCoins: (n) => { ctx.coins = (ctx.coins || 0) + n; },
  buyShopItem,
  setZone: (z) => world.setZone(z),
  zoneFor,
  revertEvent,
  spawnChest,
  applyAffix,
  spawnMeteor,
  _report: (payload) => report(payload),   // reads the (rebindable) current report fn
  setReportTarget: null,   // filled below: lets the autotest intercept postMessage
  grantBuff,
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

  // T11 difficulty defaults & endless scaling math
  {
    p.resetProgress();                                 // T10 applied an upgrade; assert on the pristine baseline
    const w = G.spawn('walker', V(6, 0, 8));
    const dOk = p.maxHp === 130 && w.dmgScale === 1 && w.hp === 46;
    const d4 = G.endlessDef(4), d7 = G.endlessDef(7), d11 = G.endlessDef(11);
    const defOk = d4.walkers === 3 && d4.scale === 1 && d7.boss === true && d7.scale === 1 && d11.boss === true && d11.scale === 1.5;
    G.clear();
    assert('T11 difficulty defaults (HP130) & endless cycle scaling', dOk && defOk, `hp=${p.maxHp} d4w=${d4.walkers} d11s=${d11.scale}`);
  }

  // T12 best-wave record + endless entry + first endless wave
  {
    G.clear(); ctx.noDirector = true;
    const b0 = G.best();
    const isNew = G.record(b0 + 3);
    const recOk = isNew && G.best() === b0 + 3;
    G.enterEndless();                                  // test hook: sets state 'win' then enters
    director.wave = WAVES.length;                      // real flow: startBoss set this before the win screen
    const entered = director.endless && state === 'play';
    ctx.noDirector = false; director.calmT = .05;
    await runChunks(30);
    const alive = ctx.enemies.filter(e => e.alive).length;
    const waveOk = director.phase === 'fight' && alive === 3 && document.getElementById('wavetag').textContent.includes('第 5 波');
    assert('T12 record persists & endless entry spawns wave 5', recOk && entered && waveOk, `best=${G.best()} entered=${entered} alive=${alive} tag=${document.getElementById('wavetag').textContent}`);
    ctx.noDirector = true; G.clear();
  }

  // T13 win screen shows the endless button and it actually enters endless mode
  {
    G.clear(); resetGame();
    state = 'win';
    ui.end('夜 尽 天 明', 'test', true);
    const go2 = document.querySelector('#end .go2');
    const visible = getComputedStyle(go2).display !== 'none' && go2.offsetParent !== null;
    go2.click();                                       // bound handler -> enterEndless
    await runChunks(3);
    const entered = director.endless && state === 'play';
    assert('T13 win screen offers endless mode & enters it', visible && entered, `visible=${visible} endless=${director.endless} state=${state}`);
  }

  // T14 new skills: L 剑气斩 flying wave & U 剑雨 smart strikes both land
  {
    G.clear(); resetGame(); ctx.noDirector = true;
    p.invulnT = 0; p.hitstopT = 0; p.state = 'idle'; p.setIdle();
    p.pos.set(0, 0, 6); p.facing = 0;
    // wave: dummy 4m ahead
    const d1 = G.spawn('walker', V(0, 0, 10));
    d1.state = 'strafe'; d1.strafeT = 99; ctx.meleeToken = {};
    const hp0 = d1.hp;
    G.press('KeyL');
    await runChunks(40);
    const waveHit = d1.hp < hp0 && p.waveCdT > 0;
    // rain: dummy beside the player, smart targeting aims strikes at it
    const d2 = G.spawn('walker', V(.9, 0, 6.9));
    d2.state = 'strafe'; d2.strafeT = 99;
    const hp1 = d2.hp;
    G.press('KeyU');
    await runChunks(60);
    const rainHit = d2.hp < hp1 && p.rainCdT > 0;
    assert('T14 L 剑气斩 & U 剑雨 both deal damage and start cooldowns', waveHit && rainHit, `wave=${waveHit} rain=${rainHit} dmgW=${(hp0 - d1.hp).toFixed(0)} dmgR=${(hp1 - d2.hp).toFixed(0)}`);
    ctx.meleeToken = null; ctx.noDirector = true; G.clear();
  }

  // T15 night events: blood moon applies & reverts; chest pays out an upgrade + big heal
  {
    G.clear(); resetGame(); ctx.noDirector = true; p.resetProgress();
    director.wave = 0; director.phase = 'fight';
    G.forceEvent('blood');
    const bloodOk = Math.abs(director.dmgScale - 1.25) < 1e-6 && ctx.bloodMoon === true && world.scene.fog.color.getHexString() === '1c0a0c';
    // chest: spawn + kill -> guaranteed tier heal + a random upgrade granted
    const c = G.spawnChest();
    const loot0 = ctx.loots.length;
    c.takeHit({ dmg: 999, dir: V(1, 0, 0) });
    G.upd(5);
    const chestOk = ctx.loots.length > loot0 && Object.keys(p.upgradeCounts).length === 1;
    G.revertEvent();
    const backOk = Math.abs(director.dmgScale - 1) < 1e-6 && !ctx.bloodMoon && world.scene.fog.color.getHexString() === '0a0f18';
    assert('T15 血月事件生效/还原 + 宝箱怪赏赐', bloodOk && chestOk && backOk, `blood=${bloodOk} chest=${chestOk} back=${backOk}`);
  }

  // T16 剑雨 CD 9s & 剑灵 event auto-strikes the nearest enemy
  {
    G.clear(); resetGame(); ctx.noDirector = true; p.resetProgress();
    p.invulnT = 0; p.hitstopT = 0; p.state = 'idle'; p.setIdle();
    p.pos.set(0, 0, 6); p.facing = 0;
    G.press('KeyU');
    G.upd(5);
    const cdOk = Math.abs(p.rainCdT - 9) < .3;
    G.forceEvent('spirit');
    const d = G.spawn('walker', V(0, 0, 8));
    d.state = 'strafe'; d.strafeT = 99; ctx.meleeToken = {};
    const hp0 = d.hp;
    await runChunks(210);                            // spirit ticks at ~3s
    const spiritOk = d.hp < hp0;
    ctx.meleeToken = null; G.clear(); G.revertEvent();
    assert('T16 剑雨CD 9s & 剑灵事件自动落剑支援', cdOk && spiritOk, `cd=${p.rainCdT.toFixed(1)} spirit=${spiritOk} dmg=${(hp0 - d.hp).toFixed(0)}`);
  }

  // T17 elite affixes: 铁壁 deflects light slashes (heavies connect); 爆裂 erupts on death
  {
    G.clear(); resetGame(); ctx.noDirector = true; p.resetProgress();
    p.invulnT = 0; p.hitstopT = 0; p.state = 'idle'; p.setIdle();
    p.pos.set(0, 0, 6); p.facing = 0;
    const w = G.spawn('walker', V(0, 0, 7.6));
    w.state = 'strafe'; w.strafeT = 99; ctx.meleeToken = {};
    G.applyAffix(w, G.affixes.find(a => a.id === 'iron'));
    const hp0 = w.hp;
    G.act('attack');
    await runChunks(70);
    const blocked = w.hp === hp0;
    w.affix = null;
    const hp1 = w.hp;
    G.act('attack');
    await runChunks(70);
    const connect = w.hp < hp1;
    // 爆裂: kill one beside the player, the blast should wound the player
    p.hp = p.maxHp; p.invulnT = 0;
    const b = G.spawn('walker', V(0, 0, 7.2));
    G.applyAffix(b, G.affixes.find(a => a.id === 'blast'));
    b.takeHit({ dmg: 999, dir: V(1, 0, 0) });
    await runChunks(45);
    const blasted = p.hp < p.maxHp;
    ctx.meleeToken = null; G.clear();
    assert('T17 铁壁格挡轻击 / 爆裂死亡引爆', blocked && connect && blasted, `blocked=${blocked} connect=${connect} blasted=${blasted}`);
  }

  // T18 meteor falls and grants a 30s buff
  {
    G.clear(); resetGame(); ctx.noDirector = true; p.resetProgress();
    p.buff = null; p.pos.set(0, 0, 6);
    G.spawnMeteor(p.pos.clone());
    await runChunks(80);
    assert('T18 流星坠落授予 30 秒增益', !!p.buff, `buff=${p.buff && p.buff.id}`);
  }

  // T19 site report protocol: framed postMessage payload delivered
  {
    const got = [];
    const handler = (ev) => { if (ev.data && ev.data.source === 'lightgame') got.push(ev.data); };
    addEventListener('message', handler);
    G.setReportTarget(window);
    G._report({ kind: 'score', score: 5 });
    await runChunks(2);
    removeEventListener('message', handler);
    assert('T19 站点上报协议消息成帧可送达', got.length >= 1 && got[0].payload.kind === 'score', `n=${got.length}`);
  }

  // T20 lantern boss: volley projectiles, burning zone, endless rotation math
  {
    G.clear(); resetGame(); ctx.noDirector = true; p.resetProgress();
    p.invulnT = 0; p.hitstopT = 0; p.state = 'idle'; p.setIdle();
    p.pos.set(0, 0, 6); p.facing = Math.PI;
    const b = G.spawnBoss('lantern', V(0, 0, -4));
    b.state = 'volley'; b.stateT = 0; b.volleyCount = 0; b.volleyT = .3;
    await runChunks(70);
    const volleyOk = ctx.projectiles.length >= 1 && b.displayName === '提 灯 鬼';
    // burning zone: force-cast one at the player's feet
    b.burnTarget = p.pos.clone(); b.state = 'burn'; b.stateT = 0; b.burnDone = false;
    const hp0 = p.hp;
    await runChunks(120);                          // zone lands at 1.2s then ticks
    const burnOk = ctx.fireZones.length >= 1 && p.hp < hp0;
    ctx.fireZones.forEach(z => z.fx.kill()); ctx.fireZones.length = 0;
    const rotOk = G.bossKindFor(7, true) === 'stone' && G.bossKindFor(11, true) === 'lantern';
    assert('T20 提灯鬼弹幕/燃烧地带/无尽轮换', volleyOk && burnOk && rotOk, `volley=${volleyOk} burn=${burnOk} rot=${rotOk}`);
    G.clear();
  }

  // T21 daily trial: deterministic per-wave events (endless-safe) + starting build
  {
    G.clear(); resetGame();
    G.startDaily();
    const counts = Object.keys(p.upgradeCounts).length;
    const ev0 = G.dailyEventFor(0);
    const detOk = ev0 === G.dailyEventFor(0) && G.events.some(e => e.id === ev0);
    const bossOk = G.events.some(e => e.id === G.dailyEventFor(3) && e.bossOk);   // boss slot only draws positive events
    const endlessOk = G.dailyEventFor(27) === G.dailyEventFor(27);                // deep endless still deterministic
    // wave 1 event should be the seeded dailyEventFor(0)
    ctx.noDirector = false; director.phase = 'calm'; director.calmT = .01; director.wave = -1;
    await runChunks(12);
    const evOk = ctx.event && ctx.event.id === ev0;
    ctx.noDirector = true;
    assert('T21 每日试炼：开局构筑+确定性事件(无尽安全)', director.daily && counts === 2 && detOk && bossOk && endlessOk && evOk, `daily=${director.daily} ups=${counts} det=${detOk} bossOk=${bossOk} ev=${evOk}`);
  }

  // T27 coin drops: every kill pays; coins auto-collected
  {
    G.clear(); resetGame(); ctx.noDirector = true; p.resetProgress();
    p.pos.set(0, 0, 10);
    const c0 = G.coins();
    const w = G.spawn('walker', V(8, 0, 8));
    w.takeHit({ dmg: 999, dir: V(1, 0, 0) });
    const lootOk = ctx.loots.some(l => l.kind === 'coin');
    const coinLoot = ctx.loots.find(l => l.kind === 'coin');
    if (coinLoot) coinLoot.flying = true;          // walk onto the drop -> magnet
    G.upd(30);
    const gain = G.coins() - c0;
    assert('T27 击杀掉落灵币并自动吸取（灵币经济闭环）', lootOk && gain >= 10, `loot=${lootOk} gain=${gain}`);
  }

  // T22 boss quotes & phase-2 music variation (real startBoss path)
  {
    G.clear(); resetGame(); ctx.noDirector = false;
    G.stage('boss');                                   // calm .01 -> startBoss, which speaks the spawn line
    await runChunks(15);
    const b = ctx.boss;
    const q0 = document.getElementById('bossquote').textContent;
    if (b) { b.hp = b.maxHp * .51; b.takeHit({ dmg: 12, dir: V(0, 0, 1) }); }
    await runChunks(6);
    const music = audio.state;
    const q2 = document.getElementById('bossquote').textContent;
    ctx.noDirector = true;
    assert('T22 Boss 台词字幕 + 二阶段配乐变奏', !!b && q0.length > 0 && q2.length > 0 && music === 'boss2', `boss=${!!b} music=${music} q0=${q0.length} q2=${q2.length}`);
    G.clear(); resetGame();
  }

  // T23 feel pack: execution zoom kick + heavy impact vignette
  {
    G.clear(); resetGame(); ctx.noDirector = true;   // keep the director quiet: only the test dummy fights
    p.invulnT = 0; p.hitstopT = 0; p.state = 'idle'; p.setIdle();
    p.pos.set(0, 0, 6); p.facing = 0;
    const d = G.spawn('walker', V(0, 0, 7.4));
    d.state = 'strafe'; d.strafeT = 99; ctx.meleeToken = {};
    // drive into combo 3 (heavy) → impact vignette fires
    G.act('attack'); await runChunks(50);
    G.act('attack'); await runChunks(50);
    const fovBefore = world.camera.fov;
    G.act('attack');
    await runChunks(60);                             // heavy hit lands at ~.44s into the swing
    const impactSeen = parseFloat(document.getElementById('impactfx').style.opacity) > 0;
    const heavyHit = d.hp < d.maxHp - 30;
    ctx.fovKick();
    G.upd(8);
    const zoomOk = world.camera.fov < 38;
    ctx.meleeToken = null; G.clear(); resetGame();
    assert('T23 手感包：重击边缘脉冲 + 处决镜头推近', impactSeen && heavyHit && zoomOk, `impact=${impactSeen} heavy=${heavyHit} fov=${world.camera.fov.toFixed(1)}`);
  }

  // T24 coin shop: purchases apply, coins deduct, unaffordable items refuse
  {
    G.clear(); resetGame(); ctx.noDirector = true; p.resetProgress();
    p.hp = 80; p.mods.dmg = 1;
    G.addCoins(100);
    const c0 = G.coins();
    const b1 = G.buyShopItem('heal');              // 25 -> +40 hp
    const healOk = b1 && p.hp === 120 && G.coins() === c0 - 25;
    const b2 = G.buyShopItem('forge');             // 60 -> dmg +.08
    const forgeOk = b2 && Math.abs(p.mods.dmg - 1.08) < 1e-9 && G.coins() === c0 - 85;
    G.addCoins(-G.coins());                        // empty the purse
    const refuse = !G.buyShopItem('brew');
    assert('T24 波间商店：购买生效/扣币/余额不足拒绝', healOk && forgeOk && refuse, `heal=${healOk} forge=${forgeOk} refuse=${refuse}`);
  }

  // T25 merchant event: timed panel opens, purchase works, auto-departs
  {
    G.clear(); resetGame(); ctx.noDirector = true; p.resetProgress();
    p.hp = 60; G.addCoins(50);
    G.forceEvent('merchant');
    await runChunks(3);
    const shown = document.getElementById('merchant').style.display === 'block';
    const hp0 = p.hp;
    const buyBtn = [...document.querySelectorAll('#merchant .mitem')].find(el => el.textContent.includes('伤'));
    buyBtn.click();                                 // 伤药 25币: +40 hp
    await runChunks(2);
    const healOk = p.hp === hp0 + 40 && G.coins() === 25;
    ctx.merchantUntil = ctx.time + .05;             // rush the departure
    await runChunks(12);
    const gone = document.getElementById('merchant').style.display === 'none';
    assert('T25 神秘商人：面板开启/购买生效/限时离去', shown && healOk && gone, `shown=${shown} heal=${healOk} gone=${gone}`);
  }

  // T26 endless zone rotation: snow & firefly re-skin the grounds
  {
    G.clear(); resetGame(); ctx.noDirector = true;
    const nightHex = world.scene.fog.color.getHexString();
    G.setZone('snow');
    const snowOk = world.scene.fog.color.getHexString() === '1a2230' && G.zoneFor(8) === 'snow';
    G.setZone('firefly');
    const flyOk = world.scene.fog.color.getHexString() === '0c1a14' && G.zoneFor(12) === 'firefly';
    G.setZone('night');
    const backOk = world.scene.fog.color.getHexString() === nightHex;
    assert('T26 场景轮换：雪庭/萤火泽变色与轮换数学', snowOk && flyOk && backOk, `snow=${snowOk} fly=${flyOk} back=${backOk}`);
  }

  // T28 frost chill & thorn reflect (deep affixes)
  {
    G.clear(); resetGame(); ctx.noDirector = true; p.resetProgress();
    p.invulnT = 0; p.hitstopT = 0; p.state = 'idle'; p.setIdle();
    p.pos.set(0, 0, 6); p.facing = 0;
    const w = G.spawn('walker', V(0, 0, 7.6));
    w.state = 'strafe'; w.strafeT = 99; ctx.meleeToken = {};
    G.applyAffix(w, G.affixes.find(a => a.id === 'frost'));
    w.state = 'strike'; w.setClip(w.atkClip); w.stateT = .28; w.hitDone = false;
    await runChunks(12);                             // strike impact at clip .42
    const frostOk = p.frostT > 0;
    p.hp = p.maxHp; p.invulnT = 0;
    w.passive = true; w.state = 'strafe'; w.strafeT = 1e9;   // disarm the frost walker for the thorn phase
    const t = G.spawn('walker', V(0, 0, 7.2));
    G.applyAffix(t, G.affixes.find(a => a.id === 'thorn'));
    t.state = 'strafe'; t.strafeT = 99;
    const php0 = p.hp, thp0 = t.hp;
    G.act('attack');
    await runChunks(50);
    const thornOk = p.hp < php0 && t.hp < thp0;    // both wounded: thorns sting back
    ctx.meleeToken = null; G.clear();
    assert('T28 冰霜减速 / 荆棘反伤', frostOk && thornOk, `frost=${frostOk} thorn=${thornOk}`);
  }

  // T29 deep endless: twin affixes on one elite + stacked double events
  {
    G.clear(); resetGame(); p.resetProgress();
    ctx.noDirector = false;                          // the double-event path runs inside the director rules
    director.endless = true; director.wave = 20;
    const w = G.spawn('walker', V(6, 0, 6));
    G.applyAffix(w, G.affixes.find(a => a.id === 'blast'));
    G.applyAffix(w, G.affixes.find(a => a.id === 'swift'));
    const dual = w.affix === 'blast' && w.affix2 === 'swift';
    let stacked = false;
    for (let i = 0; i < 40 && !stacked; i++) { G.revertEvent(); G.maybeEvent(20); if (ctx.event2) stacked = true; await nap(); }
    G.revertEvent(); G.clear();
    assert('T29 深无尽：双词缀 + 双事件叠加', dual && stacked, `dual=${dual} stacked=${stacked}`);
  }

  // T30 瞬步斩: blink behind the nearest enemy and cut
  {
    G.clear(); resetGame(); ctx.noDirector = true; p.resetProgress();
    p.invulnT = 0; p.hitstopT = 0; p.state = 'idle'; p.setIdle();
    p.pos.set(0, 0, 6); p.facing = 0;
    const d = G.spawn('walker', V(6, 0, 6));
    d.state = 'strafe'; d.strafeT = 99; ctx.meleeToken = {};
    const hp0 = d.hp, pos0 = p.pos.clone();
    G.press('KeyE');
    await runChunks(30);
    const tele = p.pos.distanceTo(pos0) > 1;
    const hit = d.hp < hp0;
    const cd0 = p.strikeCdT;
    await runChunks(120);                            // 2s: cooldown must tick down (v2.1.2 fix)
    const decays = cd0 > p.strikeCdT && p.strikeCdT > 5.5;
    ctx.meleeToken = null; G.clear();
    assert('T30 瞬步斩：瞬移+背刺+冷却且正常递减', tele && hit && cd0 > 0 && decays, `tele=${tele} hit=${hit} cd0=${cd0.toFixed(1)} now=${p.strikeCdT.toFixed(1)}`);
  }

  // T31 剑气合击: raining within 1.5s of a sword-qi hit doubles the blades
  {
    G.clear(); resetGame(); ctx.noDirector = true; p.resetProgress();
    p.invulnT = 0; p.hitstopT = 0; p.state = 'idle'; p.setIdle();
    p.pos.set(0, 0, 6); p.facing = 0;
    const d = G.spawn('walker', V(0, 0, 10));
    d.state = 'strafe'; d.strafeT = 99; ctx.meleeToken = {};
    G.press('KeyL');                                // sword qi flies, hits → waveHitT opens
    await runChunks(45);
    const opened = !!ctx.waveHitT;
    G.press('KeyU');                                // rain inside the combo window
    await runChunks(25);
    const comboOk = p.rainCombo === true && p.rainStrikes && p.rainStrikes.length === 10;
    const flash = ctx.timeScale < 1;                // slow-mo beat fires on the combo trigger
    ctx.meleeToken = null; G.clear();
    assert('T31 剑气合击：剑气命中后剑雨翻倍+演出慢动作', opened && comboOk && flash, `opened=${opened} combo=${p.rainCombo} n=${p.rainStrikes && p.rainStrikes.length} flash=${flash}`);
  }

  // T32 merchant now sells the secret scroll (random upgrade) alongside goods
  {
    G.clear(); resetGame(); ctx.noDirector = true; p.resetProgress();
    G.addCoins(50);
    G.forceEvent('merchant');
    await runChunks(3);
    const offers = document.querySelectorAll('#merchant .mitem').length;
    const secretBtn = [...document.querySelectorAll('#merchant .mitem')].find(el => el.textContent.includes('秘'));
    const shown = document.getElementById('merchant').style.display === 'block';
    if (secretBtn) secretBtn.click();
    await runChunks(2);
    const ups = Object.keys(p.upgradeCounts).length >= 1 && G.coins() === 5;
    assert('T32 商人三件货（含秘籍随机强化）', offers === 3 && shown && ups, `offers=${offers} shown=${shown} ups=${ups}`);
  }

  // T33 elite name tags follow their owner (v2.1.3: they used to pile up at the world origin)
  {
    G.clear(); resetGame(); ctx.noDirector = true; p.resetProgress();
    p.pos.set(0, 0, 10);
    const w = G.spawn('walker', V(14, 0, 12));
    w.state = 'strafe'; w.strafeT = 99; ctx.meleeToken = {};
    G.applyAffix(w, G.affixes[0]);
    G.upd(5);
    const wp = new THREE.Vector3();
    w.tagSprites[0].getWorldPosition(wp);
    const near = Math.hypot(wp.x - w.pos.x, wp.z - w.pos.z) < .5;
    ctx.meleeToken = null; G.clear();
    assert('T33 词缀名牌跟随敌人本体（不再堆在场地中心）', near, `d=${Math.hypot(wp.x - w.pos.x, wp.z - w.pos.z).toFixed(2)}`);
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

// autotest bridge for the report protocol: deliver to the same window and capture it
G.setReportTarget = (w) => { report = (payload) => { try { w.postMessage({ source: 'lightgame', type: 'lightgame:report', payload }, '*'); } catch (e) { } }; };

export { };
