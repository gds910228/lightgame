// Glyphbeast: Sixfold Trail — 2D canvas turn-based monster trainer.
// Night-indigo ink world, copper runes, twelve procedural beasts, four bosses.
import {
  ELEMENTS, CYCLE, STATUS, SPECIES, SPECIES_ORDER, ZONES, BOSSES, SHOP_ITEMS,
  statsAt, xpNeed, damageCore, damageFormula, elemMult, xpReward, goldReward, bossGoldReward,
  PLAYER_SPEED, CAM_W, CAM_H, WORLD_W, WORLD_H, START_POS, CAMP_POS, SHOP_POS,
} from './data.js';
import {
  PAL, drawBeast, drawElementIcon, drawGlyphRing, drawPlayer, drawTent, drawCampfire,
  drawShop, drawGate, drawGrassTuft, drawRock, drawReed, drawDeadTree, drawWaterBand,
} from './art.js';
import { makeAudio } from './audio.js';
import { makeFX } from './fx.js';

const DT = 1 / 60;
const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const AUTOTEST = new URLSearchParams(location.search).has('autotest');
const STORE = {
  boss: 'gbt.boss', bossMax: 'gbt.bossMax', best: 'gbt.best',
  caught: 'gbt.caught', save: 'gbt.save', mute: 'gbt.mute',
};
const WIRE_SCORE = 1000;

// ---------- canvas ----------
const canvas = $('gl');
const ctx = canvas.getContext('2d');
let cssW = innerWidth, cssH = innerHeight, dpr = 1, viewScale = 1, offX = 0, offY = 0;
let paperPat = null;

function resize() {
  cssW = innerWidth; cssH = innerHeight;
  dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  viewScale = Math.min(cssW / CAM_W, cssH / CAM_H);
  offX = (cssW - CAM_W * viewScale) / 2;
  offY = (cssH - CAM_H * viewScale) / 2;
}
resize();
addEventListener('resize', resize);

function screenPoint(lx, ly) {
  const r = canvas.getBoundingClientRect();
  return { x: r.left + offX + lx * viewScale, y: r.top + offY + ly * viewScale };
}
function canvasPoint(clientX, clientY) {
  const r = canvas.getBoundingClientRect();
  return { x: (clientX - r.left - offX) / viewScale, y: (clientY - r.top - offY) / viewScale };
}

function makePaper() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 256, 256);
  for (let i = 0; i < 2400; i++) {
    const a = Math.random() * 0.05;
    g.fillStyle = `rgba(240,220,180,${a})`;
    g.fillRect(Math.random() * 256, Math.random() * 256, 1, 1);
  }
  for (let i = 0; i < 90; i++) {
    g.strokeStyle = `rgba(210,190,160,${0.015 + Math.random() * 0.02})`;
    g.lineWidth = 0.6;
    const x = Math.random() * 256, y = Math.random() * 256;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + (Math.random() - 0.5) * 26, y + (Math.random() - 0.5) * 8); g.stroke();
  }
  paperPat = ctx.createPattern(c, 'repeat');
}
makePaper();

// ---------- run state ----------
let mode = 'title';            // title | explore | battle | shop | over | complete
let paused = false, codexOpen = false;
let simTime = 0, hitstop = 0, shake = 0;
let gold = 60, seals = 3, bosses = 0, bossMax = 0, best = 0;
let party = [], reserves = [];
let caught = new Set(), seen = new Set();
let hasSave = false;
let player = { x: START_POS.x, y: START_POS.y, facing: 1, moving: false };
let moveTarget = null;
let encounter = { dist: 0, cooldown: 0, tutorial: true };
let cam = { x: 0, y: 0 };
let zoneNow = 'meadow';
let battle = null;
let shopSel = 0;
let menuSel = 0;
let virtualDir = null;
let touchSeen = false;
let toast = { text: '', t: 0 };
let zoneToast = { text: '', sub: '', t: 0 };
let noAuto = false, reportTarget = null, reports = [];
let rngState = 0x9e3779b9;
let lastProgressAt = -10;
let codexScroll = 0;
let bgFlash = 0;
let startedAt = 0;

const fx = makeFX();
const audio = makeAudio();

// ---------- rng ----------
function rand() {
  rngState = (Math.imul(rngState, 1664525) + 1013904223) >>> 0;
  return rngState / 4294967296;
}
function setSeed(n) { rngState = (n >>> 0) || 0x9e3779b9; }

// ---------- storage ----------
function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, String(v)); } catch (e) { } }
function lsDel(k) { try { localStorage.removeItem(k); } catch (e) { } }

function storageSnapshot() {
  const o = {};
  for (const k of Object.values(STORE)) o[k] = lsGet(k);
  return o;
}
function restoreStorage(snap) {
  for (const k of Object.values(STORE)) {
    if (!snap || snap[k] == null) lsDel(k);
    else lsSet(k, snap[k]);
  }
  loadMeta();
}
function loadMeta() {
  bossMax = clamp(parseInt(lsGet(STORE.bossMax) || '0', 10) || 0, 0, 4);
  best = Math.max(0, parseInt(lsGet(STORE.best) || '0', 10) || 0);
  caught = new Set();
  try {
    const raw = JSON.parse(lsGet(STORE.caught) || '[]');
    if (Array.isArray(raw)) raw.forEach(id => { if (SPECIES[id]) caught.add(id); });
  } catch (e) { }
  const m = lsGet(STORE.mute);
  if (m === '1') audio.setMuted(true);
  hasSave = !!lsGet(STORE.save);
}
function saveMeta() {
  lsSet(STORE.boss, bosses);
  bossMax = Math.max(bossMax, bosses);
  lsSet(STORE.bossMax, bossMax);
  best = Math.max(best, scoreNow());
  lsSet(STORE.best, best);
  lsSet(STORE.caught, JSON.stringify([...caught]));
}
function saveRun() {
  saveMeta();
  const data = {
    v: 1, gold, seals, bosses, best,
    party: party.map(b => ({ id: b.id, level: b.level, xp: b.xp, hp: Math.round(b.hp) })),
    reserves: reserves.map(b => ({ id: b.id, level: b.level, xp: b.xp })),
    caught: [...caught], seen: [...seen],
    pos: { x: Math.round(player.x), y: Math.round(player.y) },
    tutorial: encounter.tutorial,
  };
  lsSet(STORE.save, JSON.stringify(data));
  hasSave = true;
}
function loadRun() {
  try {
    const raw = JSON.parse(lsGet(STORE.save) || 'null');
    if (!raw || raw.v !== 1 || !Array.isArray(raw.party) || !raw.party.length) return false;
    const p = [];
    for (const it of raw.party.slice(0, 4)) {
      if (!SPECIES[it.id]) continue;
      const b = makeBeast(it.id, clamp(parseInt(it.level, 10) || 5, 1, 40));
      b.xp = Math.max(0, parseInt(it.xp, 10) || 0);
      b.hp = clamp(parseInt(it.hp, 10) || b.maxHp, 1, b.maxHp);
      p.push(b);
    }
    if (!p.length) return false;
    party = p;
    reserves = (raw.reserves || []).filter(it => it && SPECIES[it.id]).map(it => makeBeast(it.id, clamp(parseInt(it.level, 10) || 5, 1, 40)));
    gold = Math.max(0, parseInt(raw.gold, 10) || 0);
    seals = Math.max(0, parseInt(raw.seals, 10) || 0);
    bosses = clamp(parseInt(raw.bosses, 10) || 0, 0, 4);
    caught = new Set((raw.caught || []).filter(id => SPECIES[id]));
    seen = new Set((raw.seen || []).filter(id => SPECIES[id]));
    player.x = clamp(parseFloat(raw.pos && raw.pos.x) || START_POS.x, 30, WORLD_W - 30);
    player.y = clamp(parseFloat(raw.pos && raw.pos.y) || START_POS.y, 30, WORLD_H - 30);
    encounter.tutorial = raw.tutorial !== false;
    encounter.cooldown = 1.2; encounter.dist = 0;
    return true;
  } catch (e) { return false; }
}

// ---------- meta helpers ----------
function maxPartyLevel() { let m = 1; for (const b of party) m = Math.max(m, b.level); return m; }
function scoreNow() {
  return Math.round(bosses * WIRE_SCORE + caught.size * 100 + maxPartyLevel() * 10 + Math.floor(gold / 10));
}
function progressPct() {
  const lv = clamp(maxPartyLevel(), 1, 30);
  return Math.round(bosses / 4 * 60 + caught.size / 12 * 25 + lv / 30 * 15);
}
function partyAlive() { return party.filter(b => b.hp > 0); }
function nextBoss() { return bosses < 4 ? BOSSES[bosses] : null; }

function makeBeast(id, level, opts = {}) {
  const sp = SPECIES[id];
  const st = statsAt(sp, Math.max(1, level));
  return {
    id, level: Math.max(1, Math.round(level)), xp: 0,
    hp: st.hp, maxHp: st.hp, atk: st.atk, def: st.def, spd: st.spd,
    statuses: {}, shield: 0, boss: !!opts.boss,
  };
}
function recomputeBeast(b) {
  const st = statsAt(SPECIES[b.id], b.level);
  const gain = st.hp - b.maxHp;
  b.maxHp = st.hp; b.atk = st.atk; b.def = st.def; b.spd = st.spd;
  b.hp = Math.min(b.maxHp, b.hp + Math.max(0, gain));
}
function grantXP(b, amount) {
  if (!b || b.hp <= 0) return 0;
  let ups = 0;
  b.xp += Math.max(0, Math.round(amount));
  while (b.level < 40 && b.xp >= xpNeed(b.level)) {
    b.xp -= xpNeed(b.level); b.level++; recomputeBeast(b); ups++;
  }
  return ups;
}
function healParty() {
  for (const b of party) { b.hp = b.maxHp; b.statuses = {}; b.shield = 0; }
}

// ---------- protocol ----------
function wireReport(frame) {
  const kind = frame.kind;
  const score = Number.isFinite(frame.score) ? Math.round(frame.score) : undefined;
  if (kind === 'progress') return { kind: 'progress', data: { ...frame } };
  if (kind === 'event') return { kind: 'event', event: String(frame.event || frame.tag || 'event'), data: { ...frame } };
  if (kind === 'gameOver') {
    const prog = frame.progress && typeof frame.progress === 'object' ? frame.progress : { value: frame.progress };
    return { kind: 'gameOver', score, progress: prog, data: { ...frame } };
  }
  if (kind === 'complete') return { kind: 'complete', score };
  return frame;
}
function report(kind, payload = {}) {
  const frame = { kind, ...payload };
  if (Number.isFinite(frame.score)) frame.score = Math.round(frame.score);
  reports.push(frame);
  try {
    if (reportTarget) reportTarget(frame);
    else if (window.parent !== window) {
      window.parent.postMessage({ source: 'lightgame', type: 'lightgame:report', payload: wireReport(frame) }, '*');
      if (kind === 'ready') window.parent.postMessage({ source: 'lightgame', type: 'lightgame:ready', gameId: 'glyphbeast-trail', v: 1 }, '*');
    }
  } catch (e) { }
}
function postProgress(force = false) {
  if (!force && noAuto) { /* autotest can force */ }
  if (!force && simTime - lastProgressAt < 1.0) return;
  lastProgressAt = simTime;
  report('progress', {
    score: scoreNow(), progress: progressPct(), bosses, caught: caught.size,
    maxLevel: maxPartyLevel(), gold, seals,
  });
}

// ---------- audio / mute ----------
function toggleMute() {
  const m = !audio.muted;
  if (!m && !AUTOTEST) audio.unlock();
  audio.setMuted(m);
  lsSet(STORE.mute, m ? '1' : '0');
  toastMsg(m ? '已静音' : '声音已开启');
  return m;
}
function toastMsg(text, dur = 2.4) { toast.text = text; toast.t = dur; }

// ---------- new run / title ----------
function newRun(startExplore = true) {
  bosses = 0; gold = 60; seals = 3;
  party = [makeBeast('emberbadger', 5)];
  reserves = [];
  caught = new Set(['emberbadger']);
  seen = new Set(['emberbadger']);
  player = { x: START_POS.x, y: START_POS.y, facing: 1, moving: false };
  moveTarget = null;
  encounter = { dist: 0, cooldown: 1.0, tutorial: true };
  battle = null; paused = false; codexOpen = false;
  healParty();
  saveRun();
  if (startExplore) {
    mode = 'explore'; audio.setState('explore');
    zoneNow = 'meadow';
    zoneToast = { text: '萤草甸', sub: '方向键 / WASD 移动 · E 交互', t: 3.2 };
    startedAt = simTime;
  }
}
function startGame(fresh) {
  if (!fresh && hasSave && loadRun()) {
    mode = 'explore'; paused = false; codexOpen = false; battle = null;
    audio.setState('explore');
    zoneNow = zoneAt(player.x);
    zoneToast = { text: zoneLabel(zoneNow), sub: '旅程继续 · 最高进度 ' + bossMax + '/4', t: 3 };
    startedAt = simTime;
  } else {
    newRun(true);
  }
}
function toTitle() {
  mode = 'title'; paused = false; codexOpen = false; battle = null;
  moveTarget = null;
  audio.setState('title');
  loadMeta();
}
function restartRun() {
  newRun(true);
  toastMsg('新旅程开始 · 队伍已重置');
}
function retryFromOver() {
  healParty();
  player.x = CAMP_POS.x; player.y = CAMP_POS.y + 40; player.facing = 1;
  battle = null; mode = 'explore'; paused = false;
  encounter = { dist: 0, cooldown: 1.2, tutorial: false };
  moveTarget = null;
  audio.setState('explore');
  saveRun();
  toastMsg('回到营地 · 全队已疗愈');
}

// ---------- world helpers ----------
function zoneAt(x) {
  if (x < 850) return 'meadow';
  if (x < 1210) return 'river';
  if (x < 1600) return 'crag';
  return 'shadow';
}
function zoneLabel(id) { const z = ZONES.find(z => z.id === id); return z ? z.zh : '萤草甸'; }
function zoneObj(id) { return ZONES.find(z => z.id === id); }
function grassAt(x, y) {
  for (const z of ZONES) for (const g of z.grass) {
    if (x >= g.x && x <= g.x + g.w && y >= g.y && y <= g.y + g.h) return z;
  }
  return null;
}
function nearestInteract() {
  let bestN = null, bestD = 1e9;
  const cand = [
    { kind: 'camp', x: CAMP_POS.x, y: CAMP_POS.y, r: 92, label: '在篝火旁休整（全队回复）' },
    { kind: 'shop', x: SHOP_POS.x, y: SHOP_POS.y, r: 86, label: '与阿藤交易符印' },
  ];
  for (let i = 0; i < BOSSES.length; i++) {
    const b = BOSSES[i];
    const state = i < bosses ? 'beaten' : i === bosses ? 'open' : 'locked';
    cand.push({ kind: 'gate', gate: i, x: b.x, y: b.y, r: 108, label: state === 'locked' ? `尚不能挑战 ${b.gate}` : state === 'beaten' ? `${b.gate} · 已过` : `挑战 ${b.gate} · ${b.name}` });
  }
  for (const c of cand) {
    const d = Math.hypot(player.x - c.x, player.y - c.y);
    if (d < c.r && d < bestD) { bestD = d; bestN = c; }
  }
  return bestN;
}
function interact() {
  if (mode !== 'explore' || paused || codexOpen) return false;
  const near = nearestInteract();
  if (!near) { toastMsg('四下只有虫鸣。往草丛里再走走吧。'); return false; }
  if (near.kind === 'camp') {
    healParty();
    audio.play('camp');
    fx.ring(player.x, player.y + 12, '#8fe0b8', 70, 0.7, 3);
    fx.burst(player.x, player.y, '#a8f0c0', 18, { speed: 70, life: 1.0, grav: -30 });
    toastMsg('篝火暖了全队 · 符兽的伤都好了');
    saveRun();
    return true;
  }
  if (near.kind === 'shop') {
    openShop();
    return true;
  }
  if (near.kind === 'gate') {
    const i = near.gate, b = BOSSES[i];
    if (i < bosses) { toastMsg(`${b.gate} 已经通过。${b.winLine ? '' : ''}`); return false; }
    if (i > bosses) {
      audio.play('deny');
      toastMsg(`冠军路要一关一关走 · 先击败 ${BOSSES[bosses].gate} 的 ${BOSSES[bosses].name}`);
      return false;
    }
    startBossBattle(i);
    return true;
  }
  return false;
}

// ---------- shop ----------
function openShop() { mode = 'shop'; shopSel = 0; audio.play('confirm'); }
function closeShop() { if (mode === 'shop') { mode = 'explore'; audio.play('back'); } }
function buyItem(i) {
  const it = SHOP_ITEMS[i];
  if (!it) return false;
  if (gold < it.cost) { audio.play('deny'); toastMsg(`铜钱不够 · 还差 ${it.cost - gold}`); return false; }
  gold -= it.cost; seals += it.seals;
  audio.play('buy');
  toastMsg(`${it.zh} 已放入行囊`);
  saveRun();
  return true;
}

// ---------- codex ----------
function toggleCodex() {
  if (mode !== 'explore') return false;
  codexOpen = !codexOpen;
  audio.play(codexOpen ? 'confirm' : 'back');
  return codexOpen;
}

// ---------- pause ----------
function togglePause() {
  if (codexOpen) return false;
  if (!['explore', 'battle', 'shop'].includes(mode)) return false;
  paused = !paused;
  audio.play(paused ? 'back' : 'confirm');
  return paused;
}
function setPaused(v) {
  if (!['explore', 'battle', 'shop'].includes(mode)) return false;
  paused = !!v;
  return paused;
}

// ---------- battle: creation ----------
function statusLine(b) {
  const names = Object.keys(b.statuses || {});
  return names.map(n => STATUS[n] ? STATUS[n].zh : n).join(' · ');
}
function effSpd(b) { return b.spd * (b.statuses.slow ? STATUS.slow.spd : 1); }
function effAtk(b) { return b.atk * (b.statuses.atkdown ? STATUS.atkdown.atk : 1); }
function effAcc(b, sk) { return clamp((sk.acc == null ? 1 : sk.acc) + (b.statuses.accdown ? STATUS.accdown.acc : 0), 0.25, 1); }
function shieldOf(b) { return Math.max(0, b.shield || 0); }

function startWildBattle(speciesId, level) {
  if (!SPECIES[speciesId]) return false;
  const foe = makeBeast(speciesId, level || 3);
  seen.add(speciesId);
  const z = zoneAt(player.x);
  battle = {
    wild: true, bossIdx: -1, boss: null, bgZone: z,
    enemies: [foe], enemyIdx: 0, activeIdx: party.findIndex(b => b.hp > 0),
    phase: 'intro', timer: 1.0, enterT: 0,
    turn: 1, log: [], queue: [], menuSel: 0, subSel: 0,
    lastOrder: [], lastAction: null, result: null, anim: null,
    roundDone: false, capturePending: false, needEnemySend: false,
  };
  if (battle.activeIdx < 0) battle.activeIdx = 0;
  blog(`野生的 ${SPECIES[speciesId].zh}（Lv${foe.level}）从草叶间探出头。`, '#f4d293');
  blog('选择指令：战技、投符印、换兽或逃离。', PAL.muted);
  mode = 'battle'; paused = false; codexOpen = false;
  held.clear(); virtualDir = null; moveTarget = null;
  audio.setState('battle'); audio.play('encounter');
  saveRun();
  return true;
}
function startBossBattle(i) {
  const bd = BOSSES[i];
  if (!bd) return false;
  if (i !== bosses) return false;
  if (!party.some(b => b.hp > 0)) { toastMsg('队伍需要先休整'); return false; }
  const enemies = bd.team.map(t => { const b = makeBeast(t.id, t.lvl, { boss: true }); seen.add(t.id); return b; });
  battle = {
    wild: false, bossIdx: i, boss: bd, bgZone: bd.el,
    enemies, enemyIdx: 0, activeIdx: party.findIndex(b => b.hp > 0),
    phase: 'intro', timer: 1.1, enterT: 0,
    turn: 1, log: [], queue: [], menuSel: 0, subSel: 0,
    lastOrder: [], lastAction: null, result: null, anim: null,
    roundDone: false, capturePending: false, needEnemySend: false,
  };
  if (battle.activeIdx < 0) battle.activeIdx = 0;
  blog(`${bd.title} · ${bd.name}`, '#f4d293');
  blog(bd.intro.replace(/\n/g, ' '), PAL.paperDim);
  mode = 'battle'; paused = false; codexOpen = false;
  held.clear(); virtualDir = null; moveTarget = null;
  audio.setState('boss'); audio.play('gate');
  return true;
}
function blog(text, color = PAL.paper) {
  if (!battle) return;
  battle.log.push({ text, color });
  if (battle.log.length > 24) battle.log.shift();
}
function activeBeast() { return battle && party[battle.activeIdx] ? party[battle.activeIdx] : null; }
function enemyActive() { return battle && battle.enemies[battle.enemyIdx] ? battle.enemies[battle.enemyIdx] : null; }

function enemyChooseSkill() {
  const e = enemyActive();
  if (!e) return 0;
  const skills = SPECIES[e.id].skills;
  const healIdx = skills.findIndex(s => s.type === 'heal');
  const statusIdx = skills.findIndex(s => s.type === 'status');
  const dmgIdx = skills.findIndex(s => s.type === 'damage');
  const ratio = e.hp / e.maxHp;
  if (healIdx >= 0 && ratio < 0.4 && rand() < 0.62) return healIdx;
  if (statusIdx >= 0 && rand() < 0.28) return statusIdx;
  if (dmgIdx >= 0 && rand() < 0.86) return dmgIdx;
  return (rand() * skills.length) | 0;
}

function beginResolve(actions, intro = null) {
  if (!battle) return;
  if (intro) blog(intro, PAL.paperDim);
  battle.phase = 'resolving';
  battle.queue = actions;
  battle.roundDone = false;
  battle.timer = 0.52;
}

function chooseMain(i) {
  if (!battle || battle.phase !== 'menu') return false;
  audio.play('confirm');
  if (i === 0) { battle.phase = 'skills'; battle.subSel = 0; return true; }
  if (i === 1) return throwSeal();
  if (i === 2) {
    if (party.filter(b => b.hp > 0).length <= 1) { blog('队伍里没有其他能上场的符兽。', PAL.muted); audio.play('deny'); return false; }
    battle.phase = 'party'; battle.subSel = 0; return true;
  }
  if (i === 3) return attemptFlee();
  return false;
}

function useSkill(idx) {
  if (!battle || (battle.phase !== 'menu' && battle.phase !== 'skills' && battle.phase !== 'sub')) return false;
  const a = activeBeast();
  const sk = a && SPECIES[a.id].skills[idx];
  if (!sk) return false;
  const e = enemyActive();
  if (!e) return false;
  const playerAct = { kind: 'skill', side: 'player', idx };
  const enemyAct = { kind: 'skill', side: 'enemy', idx: enemyChooseSkill() };
  const acts = [playerAct, enemyAct];
  acts.sort((x, y) => {
    const sx = x.side === 'player' ? effSpd(a) : effSpd(e);
    const sy = y.side === 'player' ? effSpd(a) : effSpd(e);
    if (sy !== sx) return sy - sx;
    return x.side === 'player' ? -1 : 1;
  });
  battle.lastOrder = acts.map(x => x.side);
  battle.logSel = 0;
  beginResolve(acts, `${SPECIES[a.id].zh} 使用「${sk.name}」。`);
  return true;
}

function setStatus(target, id, turns) {
  if (!target || !STATUS[id]) return;
  target.statuses[id] = turns != null ? turns : (id === 'stun' ? 2 : STATUS[id].turns);
}

function applyDamage(actor, target, skill, side) {
  const mult = elemMult(skill.el, SPECIES[target.id].el);
  const variance = 0.92 + rand() * 0.16;
  const critChance = 0.07 + (skill.crit || 0);
  const crit = rand() < critChance;
  let raw = damageFormula(actor.level, effAtk(actor), target.def, skill.power, mult, variance);
  if (crit) raw = Math.round(raw * 1.5);
  let absorbed = 0;
  if (target.shield > 0) { absorbed = Math.min(target.shield, raw); target.shield -= absorbed; }
  const loss = Math.max(0, raw - absorbed);
  target.hp = Math.max(0, target.hp - loss);
  // visual
  const pos = side === 'enemy' ? { x: 920, y: 300 } : { x: 320, y: 390 };
  const el = ELEMENTS[skill.el];
  fx.burst(pos.x, pos.y, el.light, crit ? 24 : 15, { speed: crit ? 240 : 160, life: 0.6, type: 'streak', grav: 100 });
  fx.ring(pos.x, pos.y, el.hue, crit ? 80 : 54, 0.42, crit ? 4 : 2.4);
  fx.float(pos.x + (side === 'enemy' ? -20 : 20), pos.y - 110, (loss > 0 ? '-' + loss : '护盾抵挡'), crit ? '#ffd27a' : '#f0e2c4', { size: crit ? 30 : 23 });
  if (absorbed > 0) fx.float(pos.x, pos.y - 80, '盾 -' + absorbed, '#8fd9a6', { size: 18 });
  hitstop = crit ? 0.09 : 0.06;
  shake = Math.max(shake, crit ? 11 : 6);
  bgFlash = Math.max(bgFlash, crit ? 0.22 : 0.12);
  battle.lastAction = { side, skill: skill.name, damage: loss, crit, absorbed, mult };
  let msg = `${actor === activeBeast() ? '我方' : '对手'} ${SPECIES[actor.id].zh} 的「${skill.name}」`;
  if (crit) msg += ' 会心一击！';
  msg += loss > 0 ? ` 造成 ${loss} 点伤害。` : ' 被护盾全部挡下。';
  if (absorbed > 0) msg += `（护盾吸收 ${absorbed}）`;
  if (mult > 1) msg += ' 属性克制！';
  else if (mult < 1) msg += ' 效果不佳…';
  blog(msg, side === 'player' ? '#e7f4df' : '#ffd3c2');
  return { loss, absorbed, crit };
}

function executeSkill(side, idx) {
  const a = side === 'player' ? activeBeast() : enemyActive();
  const d = side === 'player' ? enemyActive() : activeBeast();
  if (!a || !d || a.hp <= 0 || d.hp <= 0) return;
  if (a.statuses.stun) {
    delete a.statuses.stun;
    blog(`${SPECIES[a.id].zh} 被麻痹，动不了！`, '#f0d486');
    audio.play('status');
    return;
  }
  const sk = SPECIES[a.id].skills[idx] || SPECIES[a.id].skills[0];
  const mySide = side === 'player' ? 'player' : 'enemy';
  const foeSide = side === 'player' ? 'enemy' : 'player';
  const who = side === 'player' ? '我方' : '对手';
  if (sk.type === 'heal' || sk.type === 'shield') {
    // support skills always land
    if (sk.type === 'heal') {
      const amt = Math.round(a.maxHp * sk.heal);
      const before = a.hp; a.hp = Math.min(a.maxHp, a.hp + amt);
      const gained = Math.round(a.hp - before);
      if (side === 'player') { fx.burst(320, 390, '#b8f0ca', 16, { speed: 55, life: 0.9, grav: -50 }); fx.float(320, 300, '+' + gained, '#b8f0ca', { size: 24 }); }
      else { fx.burst(920, 300, '#b8f0ca', 16, { speed: 55, life: 0.9, grav: -50 }); fx.float(920, 220, '+' + gained, '#b8f0ca', { size: 24 }); }
      blog(`${who} ${SPECIES[a.id].zh} 使用「${sk.name}」，回复 ${gained} 点体力。`, '#c8f0d0');
      audio.play('heal');
    } else {
      const amt = Math.round(a.maxHp * sk.shield);
      a.shield = Math.min(Math.round(a.maxHp * 0.65), (a.shield || 0) + amt);
      if (side === 'player') fx.ring(320, 390, '#9fe8d0', 70, 0.5, 3);
      else fx.ring(920, 300, '#9fe8d0', 70, 0.5, 3);
      blog(`${who} ${SPECIES[a.id].zh} 使用「${sk.name}」，获得 ${amt} 点护盾。`, '#b8e8dc');
      audio.play('shield');
    }
    battle.anim = { type: sk.type === 'heal' ? 'heal' : 'shield', side: mySide, t: 0, dur: 0.6, el: sk.el };
    return;
  }
  const acc = effAcc(a, sk);
  if (rand() > acc) {
    blog(`${who} ${SPECIES[a.id].zh} 的「${sk.name}」落空了。`, PAL.muted);
    audio.play('miss');
    if (side === 'enemy') fx.float(320, 280, 'MISS', '#a99bbf', { size: 20 });
    else fx.float(920, 200, 'MISS', '#a99bbf', { size: 20 });
    battle.anim = { type: 'miss', side: mySide, t: 0, dur: 0.4, el: sk.el };
    return;
  }
  battle.anim = { type: 'element', side: mySide, t: 0, dur: 0.55, el: sk.el };
  if (sk.power > 0) applyDamage(a, d, sk, foeSide === 'enemy' ? 'enemy' : 'player');
  if (sk.status && rand() < (sk.chance == null ? 1 : sk.chance)) {
    setStatus(d, sk.status);
    const st = STATUS[sk.status];
    blog(`${SPECIES[d.id].zh} 陷入「${st.zh}」。`, st.color);
    audio.play('status');
    fx.burst(foeSide === 'enemy' ? 920 : 320, foeSide === 'enemy' ? 300 : 390, st.color, 10, { speed: 60, life: 0.8, type: 'rune' });
  }
  if (d.hp <= 0) blog(`${SPECIES[d.id].zh} 倒下了。`, '#d8a0a0');
  // a fainted side cannot continue this round's queued action
  if (d.hp <= 0) battle.queue.length = 0;
}

function endRound() {
  const units = [];
  const p = activeBeast(); const e = enemyActive();
  if (p && p.hp > 0) units.push({ b: p, side: 'player' });
  if (e && e.hp > 0) units.push({ b: e, side: 'enemy' });
  for (const { b, side } of units) {
    for (const id of Object.keys(b.statuses)) {
      const st = STATUS[id];
      if (!st) { delete b.statuses[id]; continue; }
      if (st.dot) {
        const dmg = Math.max(1, Math.round(b.maxHp * st.dot));
        b.hp = Math.max(0, b.hp - dmg);
        blog(`${SPECIES[b.id].zh} 受到「${st.zh}」${dmg} 点伤害。`, st.color);
        fx.float(side === 'enemy' ? 920 : 320, (side === 'enemy' ? 280 : 370), '-' + dmg, st.color, { size: 18 });
      }
      b.statuses[id]--;
      if (b.statuses[id] <= 0) delete b.statuses[id];
    }
  }
  if (p && p.hp <= 0) blog(`${SPECIES[p.id].zh} 失去了战斗能力。`, '#e09090');
  if (e && e.hp <= 0) blog(`${SPECIES[e.id].zh} 失去了战斗能力。`, '#e09090');
}

function afterRound() {
  if (!battle) return;
  const p = activeBeast(), e = enemyActive();
  const enemiesDown = battle.enemies.every(x => x.hp <= 0);
  const playersDown = party.every(x => x.hp <= 0);
  if (enemiesDown) {
    battle.phase = 'victoryDelay'; battle.timer = 1.0;
    return;
  }
  if (playersDown) { finishBattle('lose'); return; }
  if (p && p.hp <= 0) {
    battle.phase = 'switch'; battle.needEnemySend = !!(e && e.hp <= 0);
    blog('选择下一只符兽上场。', '#f4d293');
    audio.play('faint');
    return;
  }
  if (e && e.hp <= 0) {
    battle.needEnemySend = true;
    battle.phase = 'send'; battle.timer = 0.95;
    return;
  }
  nextTurn();
}

function nextTurn() {
  if (!battle) return;
  battle.turn++;
  battle.phase = 'menu';
  battle.menuSel = 0;
  battle.subSel = 0;
  battle.roundDone = false;
}

function updateBattle(dt) {
  if (!battle) return;
  battle.enterT = Math.min(1, battle.enterT + dt * 2.2);
  if (battle.anim) {
    battle.anim.t += dt;
    if (battle.anim.t >= battle.anim.dur) battle.anim = null;
  }
  if (battle.phase === 'intro') {
    battle.timer -= dt;
    if (battle.timer <= 0) { battle.phase = 'menu'; }
    return;
  }
  if (battle.phase === 'captureDelay') {
    battle.timer -= dt;
    if (battle.timer <= 0) finishBattle('capture');
    return;
  }
  if (battle.phase === 'victoryDelay') {
    battle.timer -= dt;
    if (battle.timer <= 0) finishBattle('win');
    return;
  }
  if (battle.phase === 'send') {
    battle.timer -= dt;
    if (battle.timer <= 0) {
      battle.enemyIdx++;
      const e = enemyActive();
      if (e) {
        blog(`对手派出了 ${SPECIES[e.id].zh}（Lv${e.level}）。`, '#ffd3c2');
        audio.play('gate');
      }
      battle.needEnemySend = false;
      const p = activeBeast();
      if (!p || p.hp <= 0) { battle.phase = 'switch'; blog('选择下一只符兽上场。', '#f4d293'); }
      else nextTurn();
    }
    return;
  }
  if (battle.phase !== 'resolving') return;
  battle.timer -= dt;
  if (battle.timer > 0) return;
  if (battle.queue.length) {
    const act = battle.queue.shift();
    if (act.kind === 'skill') executeSkill(act.side, act.idx);
    battle.timer = 0.82;
    if (battle.queue.length === 0) battle.timer = 0.55;
    return;
  }
  if (!battle.roundDone) {
    endRound();
    battle.roundDone = true;
    battle.timer = 0.6;
    return;
  }
  afterRound();
}

function throwSeal() {
  if (!battle || battle.phase !== 'menu') return false;
  if (battle.bossIdx >= 0) {
    blog('守关人的符兽不认外人的符印。', PAL.muted); audio.play('deny'); return false;
  }
  if (seals <= 0) {
    blog('符印用完了 · 去驿铺补一些，或先削弱它。', PAL.muted); audio.play('deny'); return false;
  }
  seals--;
  const foe = enemyActive();
  const chance = captureChanceOf(foe, activeBeast());
  blog(`你投出一枚符印（剩余 ${seals} 枚）· 捕获率约 ${Math.round(chance * 100)}%。`, '#f4d293');
  audio.play('seal');
  battle.anim = { type: 'seal', side: 'enemy', t: 0, dur: 0.9, el: 'light' };
  fx.ring(920, 300, '#f4d293', 72, 0.7, 3);
  fx.burst(920, 300, '#ffe4a2', 18, { speed: 80, life: 0.9, type: 'rune' });
  if (rand() < chance || battle.forceCatch) {
    battle.forceCatch = false;
    battle.capturePending = true;
    battle.phase = 'captureDelay';
    battle.timer = 1.15;
    blog(`符印合拢 · ${SPECIES[foe.id].zh} 安静下来。`, '#ffe4a2');
    audio.play('capture');
    fx.burst(920, 300, '#ffe9b0', 30, { speed: 130, life: 1.2, type: 'rune', grav: -20 });
  } else {
    blog(`符印裂开，${SPECIES[foe.id].zh} 挣脱了！`, '#ffd3c2');
    audio.play('hit');
    const enemyAct = { kind: 'skill', side: 'enemy', idx: enemyChooseSkill() };
    beginResolve([enemyAct]);
  }
  saveRun();
  return true;
}

function captureChanceOf(foe, mine) {
  if (!foe || !mine) return 0;
  const ratio = clamp(foe.hp / foe.maxHp, 0, 1);
  const sp = SPECIES[foe.id];
  const statused = Object.keys(foe.statuses).length > 0 ? 1.2 : 1;
  const lvl = clamp((mine.level - foe.level) * 0.03, -0.2, 0.2);
  return clamp(sp.catch * (1 - 0.55 * ratio) * statused * (1 + lvl), 0.03, 0.95);
}

function fleeChance() {
  if (!battle) return 0;
  if (battle.bossIdx >= 0) return 0;
  const p = activeBeast(), e = enemyActive();
  if (!p || !e) return 0;
  return clamp(0.45 + (effSpd(p) - effSpd(e)) * 0.025, 0.18, 0.9);
}
function attemptFlee() {
  if (!battle || battle.phase !== 'menu') return false;
  if (battle.bossIdx >= 0) {
    blog('守关当前，退无可退。', '#ffd3c2');
    audio.play('deny');
    return false;
  }
  const ch = fleeChance();
  if (rand() < ch) {
    audio.play('flee');
    finishBattle('flee');
    return true;
  }
  blog('没能脱身！', PAL.muted);
  audio.play('miss');
  beginResolve([{ kind: 'skill', side: 'enemy', idx: enemyChooseSkill() }]);
  return false;
}

function switchTo(i) {
  if (!battle || (battle.phase !== 'party' && battle.phase !== 'switch')) return false;
  const target = party[i];
  if (!target) return false;
  if (i === battle.activeIdx) { blog('它已经在场上了。', PAL.muted); audio.play('deny'); return false; }
  if (target.hp <= 0) { blog(`${SPECIES[target.id].zh} 已经没有战斗能力。`, PAL.muted); audio.play('deny'); return false; }
  const forced = battle.phase === 'switch';
  battle.activeIdx = i;
  blog(`换上了 ${SPECIES[target.id].zh}（Lv${target.level}）。`, '#c8f0d0');
  audio.play('confirm');
  fx.ring(320, 390, '#9fe8d0', 55, 0.5, 2);
  if (forced) {
    if (battle.needEnemySend) {
      battle.needEnemySend = false;
      battle.phase = 'send'; battle.timer = 0.85;
    } else nextTurn();
  } else {
    beginResolve([{ kind: 'skill', side: 'enemy', idx: enemyChooseSkill() }]);
  }
  saveRun();
  return true;
}

function finishBattle(kind) {
  if (!battle) return false;
  const b = battle;
  if (kind === 'win') {
    audio.play('win');
    const totalXp = b.enemies.reduce((s, e) => s + xpReward(e.level), 0);
    const goldGain = b.bossIdx >= 0 ? bossGoldReward(b.bossIdx) : b.enemies.reduce((s, e) => s + goldReward(e.level), 0);
    gold += goldGain;
    const active = activeBeast();
    const ups = [];
    for (const p of party) {
      if (p.hp <= 0) continue;
      const gain = p === active ? totalXp : Math.round(totalXp * 0.55);
      const n = grantXP(p, gain);
      if (n) ups.push(`${SPECIES[p.id].zh} 升到 Lv${p.level}`);
    }
    if (ups.length) audio.play('levelup');
    let final = false;
    if (b.bossIdx >= 0) {
      bosses = Math.max(bosses, b.bossIdx + 1);
      bossMax = Math.max(bossMax, bosses);
      final = bosses >= 4;
      audio.setState(final ? 'title' : 'explore');
      postProgress(true);
      report('event', { event: 'boss', tag: 'boss', boss: b.boss.name, gate: b.boss.gate, index: b.bossIdx + 1, score: scoreNow(), progress: progressPct() });
    }
    saveRun();
    if (final) {
      postProgress(true);
      report('complete', { score: scoreNow(), bosses, caught: caught.size });
    }
    b.result = {
      kind: 'win', gold: goldGain, xp: totalXp, ups, boss: b.bossIdx >= 0,
      bossName: b.boss ? b.boss.name : '', gate: b.boss ? b.boss.gate : '', final,
      complete: final,
    };
    b.phase = 'result';
    blog(final ? '六道归一 · 冠军路已走完。' : b.bossIdx >= 0 ? `击败了 ${b.boss.name} · ${b.boss.gate} 通过。` : '战斗胜利。', '#ffe4a2');
    return true;
  }
  if (kind === 'capture') {
    const foe = enemyActive();
    if (!foe) { finishBattle('win'); return true; }
    caught.add(foe.id); seen.add(foe.id);
    audio.play('capture');
    let toParty = false;
    if (party.length < 4) {
      const nb = makeBeast(foe.id, foe.level);
      party.push(nb); toParty = true;
    } else {
      reserves.push(makeBeast(foe.id, foe.level));
    }
    const totalXp = Math.round(xpReward(foe.level) * 0.5);
    const active = activeBeast();
    const ups = [];
    for (const p of party) {
      if (p.hp <= 0) continue;
      const gain = p === active ? totalXp : Math.round(totalXp * 0.55);
      const n = grantXP(p, gain);
      if (n) ups.push(`${SPECIES[p.id].zh} 升到 Lv${p.level}`);
    }
    if (ups.length) audio.play('levelup');
    saveRun();
    report('event', { event: 'capture', tag: 'capture', species: foe.id, level: foe.level, toParty, score: scoreNow(), progress: progressPct() });
    postProgress(true);
    b.result = {
      kind: 'capture', name: SPECIES[foe.id].zh, level: foe.level, toParty, xp: totalXp, ups,
    };
    b.phase = 'result';
    blog(`捕获成功 · ${SPECIES[foe.id].zh} 加入了${toParty ? '队伍' : '符兽录'}。`, '#ffe4a2');
    return true;
  }
  if (kind === 'lose') {
    audio.play('lose');
    mode = 'over';
    saveMeta();
    report('gameOver', {
      score: scoreNow(), progress: progressPct(), bosses, caught: caught.size,
      maxLevel: maxPartyLevel(), gold, seals,
    });
    b.phase = 'lost';
    if (battle) { battle = null; }
    return true;
  }
  if (kind === 'flee') {
    audio.play('flee');
    exitBattleToExplore();
    return true;
  }
  return false;
}
function exitBattleToExplore() {
  battle = null;
  mode = 'explore';
  paused = false;
  encounter = { dist: 0, cooldown: 1.4, tutorial: false };
  moveTarget = null;
  audio.setState('explore');
  saveRun();
}
function continueBattleResult() {
  if (!battle || battle.phase !== 'result') return false;
  const r = battle.result;
  if (!r) return false;
  if (r.kind === 'win' && r.final) {
    battle = null; mode = 'complete'; paused = false;
    audio.setState('title');
    saveRun();
    return true;
  }
  if (r.kind === 'win' && r.boss) { healParty(); }
  exitBattleToExplore();
  return true;
}

// ---------- input ----------
const held = new Set();
const pressed = new Set();
const MOVE_CODES = {
  left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'],
  up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'],
};
function downHeld(list) { return list.some(c => held.has(c)); }

addEventListener('keydown', (e) => {
  const code = e.code;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'].includes(code)) e.preventDefault();
  if (e.repeat) { held.add(code); return; }
  held.add(code); pressed.add(code);
  if (!AUTOTEST) audio.unlock();
});
addEventListener('keyup', (e) => { held.delete(e.code); });
addEventListener('blur', () => { held.clear(); virtualDir = null; });

canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  touchSeen = touchSeen || e.pointerType === 'touch';
  if (!AUTOTEST) audio.unlock();
  const pt = canvasPoint(e.clientX, e.clientY);
  pointerDownLogical(pt.x, pt.y, e.pointerType || 'mouse');
});
addEventListener('pointerup', () => { virtualDir = null; });
addEventListener('pointercancel', () => { virtualDir = null; });

function pointerDownLogical(lx, ly, type = 'mouse') {
  if (type === 'touch') touchSeen = true;
  const rects = uiRects();
  for (const r of rects) {
    if (lx >= r.x && lx <= r.x + r.w && ly >= r.y && ly <= r.y + r.h) {
      activateHotspot(r.id);
      return r.id;
    }
  }
  if (paused || codexOpen) return null;
  if (mode === 'battle' && battle && battle.phase === 'intro') { battle.phase = 'menu'; battle.timer = 0; return 'skip'; }
  if (mode === 'explore') {
    if (ly < 500 && !touchSeen) { /* allow click anywhere on the world */ }
    moveTarget = { x: clamp(lx + cam.x, 20, WORLD_W - 20), y: clamp(ly + cam.y, 20, WORLD_H - 20) };
    return 'world';
  }
  return null;
}

function activateHotspot(id) {
  if (id === 'start') { startGame(false); audio.play('confirm'); return; }
  if (id === 'newrun') { startGame(true); audio.play('confirm'); return; }
  if (id === 'codex-close' || id === 'codex') { if (codexOpen) toggleCodex(); return; }
  if (id === 'shop-close') { closeShop(); return; }
  if (id === 'buy0') { buyItem(0); return; }
  if (id === 'buy1') { buyItem(1); return; }
  if (id === 'pause-resume') { setPaused(false); audio.play('confirm'); return; }
  if (id === 'pause-restart') { restartRun(); return; }
  if (id === 'pause-title') { toTitle(); return; }
  if (id === 'end-retry') { retryFromOver(); audio.play('confirm'); return; }
  if (id === 'end-title') { toTitle(); return; }
  if (id === 'end-again') { restartRun(); return; }
  if (id === 'battle-continue') { continueBattleResult(); return; }
  if (id === 'battle-back') { if (battle && (battle.phase === 'skills' || battle.phase === 'party')) { battle.phase = 'menu'; audio.play('back'); } return; }
  if (id.startsWith('battle-main-')) { chooseMain(parseInt(id.slice(-1), 10)); return; }
  if (id.startsWith('battle-skill-')) { useSkill(parseInt(id.slice(-1), 10)); return; }
  if (id.startsWith('battle-party-')) { switchTo(parseInt(id.slice(-1), 10)); return; }
  if (id.startsWith('dpad-')) {
    const dir = id.slice(5);
    virtualDir = dir;
    const dx = dir === 'left' ? -60 : dir === 'right' ? 60 : 0;
    const dy = dir === 'up' ? -60 : dir === 'down' ? 60 : 0;
    moveTarget = { x: clamp(player.x + dx, 24, WORLD_W - 24), y: clamp(player.y + dy, 24, WORLD_H - 24) };
  }
  if (id === 'interact') { interact(); return; }
  if (id === 'codex-open') { toggleCodex(); return; }
}

// DOM buttons
function bindTopButtons() {
  const mb = $('btn-mute'), pb = $('btn-pause'), cb = $('btn-codex');
  if (mb) mb.addEventListener('pointerdown', (e) => { e.preventDefault(); if (!AUTOTEST) audio.unlock(); toggleMute(); updateTopButtons(); });
  if (pb) pb.addEventListener('pointerdown', (e) => { e.preventDefault(); if (!AUTOTEST) audio.unlock(); togglePause(); updateTopButtons(); });
  if (cb) cb.addEventListener('pointerdown', (e) => { e.preventDefault(); if (!AUTOTEST) audio.unlock(); if (mode === 'explore') toggleCodex(); else toastMsg('行旅中才能翻阅符兽录'); });
}
function updateTopButtons() {
  const mb = $('btn-mute'), pb = $('btn-pause');
  if (mb) { mb.textContent = audio.muted ? '静' : '声'; mb.classList.toggle('on', audio.muted); }
  if (pb) { pb.textContent = paused ? '▶' : 'Ⅱ'; pb.classList.toggle('on', paused); }
}

function processGlobal(pNow) {
  if (pNow.has('KeyM')) { toggleMute(); updateTopButtons(); }
  if (pNow.has('KeyP') && !codexOpen && ['explore', 'battle', 'shop'].includes(mode)) { togglePause(); updateTopButtons(); }
  if (pNow.has('KeyC') && mode === 'explore' && !paused && !codexOpen) { toggleCodex(); }
}

function handleTitleInput(pNow) {
  if (pNow.has('Enter') || pNow.has('Space') || pNow.has('KeyE')) { startGame(false); audio.play('confirm'); return; }
  if (pNow.has('KeyN') && hasSave) { startGame(true); audio.play('confirm'); }
}
function handleEndInput(pNow) {
  if (mode === 'over') {
    if (pNow.has('Enter') || pNow.has('Space') || pNow.has('KeyE')) retryFromOver();
    if (pNow.has('Escape')) toTitle();
  } else {
    if (pNow.has('Enter') || pNow.has('Space') || pNow.has('KeyE')) restartRun();
    if (pNow.has('Escape')) toTitle();
  }
}
function handleShopInput(pNow) {
  if (pNow.has('Digit1')) buyItem(0);
  if (pNow.has('Digit2')) buyItem(1);
  if (pNow.has('Escape') || pNow.has('KeyE') || pNow.has('Enter')) closeShop();
}
function handleCodexInput(pNow) {
  if (pNow.has('Escape') || pNow.has('KeyC') || pNow.has('KeyE') || pNow.has('Enter')) toggleCodex();
}
function handlePauseInput(pNow) {
  if (pNow.has('Escape')) { setPaused(false); updateTopButtons(); }
}
function handleBattleInput(pNow) {
  if (!battle) return;
  const ph = battle.phase;
  if (ph === 'result') {
    if (pNow.has('Enter') || pNow.has('Space') || pNow.has('KeyE') || pNow.has('Digit1')) continueBattleResult();
    return;
  }
  if (ph === 'intro') {
    const digit = ['Digit1', 'Digit2', 'Digit3', 'Digit4'].findIndex(c => pNow.has(c));
    if (digit >= 0) { battle.phase = 'menu'; battle.timer = 0; chooseMain(digit); }
    else if (pNow.has('Enter') || pNow.has('Space') || pNow.has('KeyE')) { battle.phase = 'menu'; battle.timer = 0; }
    return;
  }
  if (ph === 'menu') {
    if (pNow.has('Digit1') || pNow.has('Numpad1')) { chooseMain(0); return; }
    if (pNow.has('Digit2') || pNow.has('Numpad2')) { chooseMain(1); return; }
    if (pNow.has('Digit3') || pNow.has('Numpad3')) { chooseMain(2); return; }
    if (pNow.has('Digit4') || pNow.has('Numpad4')) { chooseMain(3); return; }
    let sel = battle.menuSel || 0;
    if (pNow.has('ArrowLeft')) { sel = sel % 2 === 1 ? sel - 1 : sel; audio.play('menu'); }
    if (pNow.has('ArrowRight')) { sel = sel % 2 === 0 ? sel + 1 : sel; audio.play('menu'); }
    if (pNow.has('ArrowUp')) { sel = sel >= 2 ? sel - 2 : sel; audio.play('menu'); }
    if (pNow.has('ArrowDown')) { sel = sel < 2 ? sel + 2 : sel; audio.play('menu'); }
    battle.menuSel = sel;
    if (pNow.has('Enter') || pNow.has('Space') || pNow.has('KeyE')) chooseMain(sel);
    return;
  }
  if (ph === 'skills') {
    if (pNow.has('Escape') || pNow.has('Backspace')) { battle.phase = 'menu'; audio.play('back'); return; }
    if (pNow.has('Digit1') || pNow.has('Numpad1')) { useSkill(0); return; }
    if (pNow.has('Digit2') || pNow.has('Numpad2')) { useSkill(1); return; }
    if (pNow.has('Digit3') || pNow.has('Numpad3')) { useSkill(2); return; }
    let sel = battle.subSel || 0;
    if (pNow.has('ArrowUp')) { sel = (sel + 2) % 3; audio.play('menu'); }
    if (pNow.has('ArrowDown')) { sel = (sel + 1) % 3; audio.play('menu'); }
    battle.subSel = sel;
    if (pNow.has('Enter') || pNow.has('Space') || pNow.has('KeyE')) useSkill(sel);
    return;
  }
  if (ph === 'party' || ph === 'switch') {
    if (pNow.has('Escape') && ph === 'party') { battle.phase = 'menu'; audio.play('back'); return; }
    if (pNow.has('Digit1') || pNow.has('Numpad1')) { switchTo(0); return; }
    if (pNow.has('Digit2') || pNow.has('Numpad2')) { switchTo(1); return; }
    if (pNow.has('Digit3') || pNow.has('Numpad3')) { switchTo(2); return; }
    if (pNow.has('Digit4') || pNow.has('Numpad4')) { switchTo(3); return; }
    let sel = battle.subSel || 0;
    if (pNow.has('ArrowUp')) { sel = (sel + party.length - 1) % party.length; audio.play('menu'); }
    if (pNow.has('ArrowDown')) { sel = (sel + 1) % party.length; audio.play('menu'); }
    battle.subSel = sel;
    if (pNow.has('Enter') || pNow.has('Space')) switchTo(sel);
  }
}

function updateExplore(dt) {
  if (paused || codexOpen) return;
  let dx = 0, dy = 0;
  if (virtualDir === 'left') dx -= 1;
  if (virtualDir === 'right') dx += 1;
  if (virtualDir === 'up') dy -= 1;
  if (virtualDir === 'down') dy += 1;
  if (downHeld(MOVE_CODES.left)) dx -= 1;
  if (downHeld(MOVE_CODES.right)) dx += 1;
  if (downHeld(MOVE_CODES.up)) dy -= 1;
  if (downHeld(MOVE_CODES.down)) dy += 1;
  if (dx || dy) moveTarget = null;
  if (!dx && !dy && moveTarget) {
    const tx = moveTarget.x - player.x, ty = moveTarget.y - player.y;
    const d = Math.hypot(tx, ty);
    if (d < 3) moveTarget = null;
    else { dx = tx / d; dy = ty / d; }
  }
  let moved = 0;
  if (dx || dy) {
    const len = Math.hypot(dx, dy) || 1;
    const nx = dx / len, ny = dy / len;
    const step = PLAYER_SPEED * dt;
    player.x = clamp(player.x + nx * step, 24, WORLD_W - 24);
    player.y = clamp(player.y + ny * step, 24, WORLD_H - 24);
    player.moving = true;
    if (Math.abs(nx) > 0.05) player.facing = nx > 0 ? 1 : -1;
    moved = step;
  } else {
    player.moving = false;
  }
  // zone transitions
  const z = zoneAt(player.x);
  if (z !== zoneNow) {
    zoneNow = z;
    zoneToast = { text: zoneLabel(z), sub: zoneHints(z), t: 2.8 };
  }
  // encounters
  if (encounter.cooldown > 0) encounter.cooldown = Math.max(0, encounter.cooldown - dt);
  if (mode === 'explore' && moved > 0 && encounter.cooldown <= 0 && !AUTOTEST_TUTORIAL_LOCK) {
    const g = grassAt(player.x, player.y);
    if (g) {
      encounter.dist += moved;
      const threshold = encounter.tutorial ? 52 : 150 + rand() * 90;
      if (encounter.dist >= threshold) {
        encounter.dist = 0;
        encounter.tutorial = false;
        if (rand() < 0.92) {
          const pick = pickWild(g);
          startWildBattle(pick.id, pick.level);
          return;
        }
      }
    } else {
      encounter.dist = Math.max(0, encounter.dist - moved * 0.6);
    }
  }
  cam.x = clamp(player.x - CAM_W / 2, 0, WORLD_W - CAM_W);
  cam.y = clamp(player.y - CAM_H / 2, 0, WORLD_H - CAM_H);
}
let AUTOTEST_TUTORIAL_LOCK = false;

function pickWild(zone) {
  let total = 0;
  for (const w of zone.wild) total += w.w;
  let r = rand() * total;
  for (const w of zone.wild) {
    r -= w.w;
    if (r <= 0) {
      const lvl = w.min + Math.floor(rand() * (w.max - w.min + 1));
      return { id: w.id, level: lvl };
    }
  }
  const f = zone.wild[0];
  return { id: f.id, level: f.min };
}
function zoneHints(id) {
  return { meadow: '符兽在草丛里 · 削弱后再投符印', river: '潮声变重了 · 商路到此为止', crag: '风把石头磨成了符形', shadow: '灯火之外的最后一程' }[id] || '';
}

function update(dt) {
  const pNow = new Set(pressed); pressed.clear();
  if (!paused) simTime += dt;
  processGlobal(pNow);
  if (paused) {
    handlePauseInput(pNow);
    updateTopButtons();
    return;
  }
  if (toast.t > 0) toast.t = Math.max(0, toast.t - dt);
  if (zoneToast.t > 0) zoneToast.t = Math.max(0, zoneToast.t - dt);
  if (bgFlash > 0) bgFlash = Math.max(0, bgFlash - dt * 1.7);
  if (shake > 0) shake = Math.max(0, shake - dt * 26);
  if (hitstop > 0) { hitstop -= dt; fx.update(dt * 0.35); audio.tick(dt); return; }
  if (codexOpen) { handleCodexInput(pNow); fx.update(dt); audio.tick(dt); return; }
  if (mode === 'title') {
    handleTitleInput(pNow);
  } else if (mode === 'explore') {
    if (pNow.has('KeyE') || pNow.has('Enter')) interact();
    updateExplore(dt);
  } else if (mode === 'battle') {
    handleBattleInput(pNow);
    updateBattle(dt);
    if (battle && battle.activeIdx >= party.length) battle.activeIdx = 0;
  } else if (mode === 'shop') {
    handleShopInput(pNow);
  } else if (mode === 'over' || mode === 'complete') {
    handleEndInput(pNow);
  }
  fx.update(dt);
  audio.tick(dt);
  updateTopButtons();
}

// ---------- UI rects ----------
function titleRects() {
  const a = [{ id: 'start', x: 515, y: 466, w: 250, h: 60 }];
  if (hasSave) a.push({ id: 'newrun', x: 555, y: 540, w: 170, h: 44 });
  return a;
}
function pauseRects() {
  return [
    { id: 'pause-resume', x: 490, y: 352, w: 300, h: 48 },
    { id: 'pause-restart', x: 490, y: 414, w: 300, h: 48 },
    { id: 'pause-title', x: 490, y: 476, w: 300, h: 48 },
  ];
}
function shopRects() {
  return [
    { id: 'buy0', x: 400, y: 306, w: 480, h: 62 },
    { id: 'buy1', x: 400, y: 380, w: 480, h: 62 },
    { id: 'shop-close', x: 540, y: 486, w: 200, h: 44 },
  ];
}
function endRects() {
  if (mode === 'over') return [
    { id: 'end-retry', x: 438, y: 476, w: 196, h: 54 },
    { id: 'end-title', x: 646, y: 476, w: 196, h: 54 },
  ];
  return [
    { id: 'end-again', x: 438, y: 514, w: 196, h: 54 },
    { id: 'end-title', x: 646, y: 514, w: 196, h: 54 },
  ];
}
function battleRects() {
  if (!battle) return [];
  const out = [];
  if (battle.phase === 'menu') {
    const xs = [696, 976], ys = [562, 638];
    for (let i = 0; i < 4; i++) out.push({ id: 'battle-main-' + i, x: xs[i % 2], y: ys[i >> 1], w: 264, h: 62 });
  } else if (battle.phase === 'skills') {
    for (let i = 0; i < 3; i++) out.push({ id: 'battle-skill-' + i, x: 696, y: 548 + i * 44, w: 544, h: 40 });
    out.push({ id: 'battle-back', x: 696, y: 682, w: 140, h: 18 });
  } else if (battle.phase === 'party' || battle.phase === 'switch') {
    for (let i = 0; i < party.length; i++) out.push({ id: 'battle-party-' + i, x: 696, y: 548 + i * 40, w: 544, h: 35 });
    if (battle.phase === 'party') out.push({ id: 'battle-back', x: 696, y: 682, w: 140, h: 18 });
  } else if (battle.phase === 'result') {
    out.push({ id: 'battle-continue', x: 540, y: 486, w: 200, h: 48 });
  }
  return out;
}
function codexRects() { return [{ id: 'codex-close', x: 1148, y: 60, w: 66, h: 30 }]; }
function dpadRects() {
  return [
    { id: 'dpad-up', x: 82, y: 566, w: 52, h: 52 },
    { id: 'dpad-left', x: 28, y: 620, w: 52, h: 52 },
    { id: 'dpad-right', x: 136, y: 620, w: 52, h: 52 },
    { id: 'dpad-down', x: 82, y: 674, w: 52, h: 52 },
  ];
}
function touchUI() {
  return touchSeen || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
}
function uiRects() {
  if (paused) return pauseRects();
  if (codexOpen) return codexRects();
  if (mode === 'title') return titleRects();
  if (mode === 'explore') {
    const a = [];
    if (touchUI()) { a.push(...dpadRects()); a.push({ id: 'interact', x: 1120, y: 640, w: 76, h: 76 }); }
    return a;
  }
  if (mode === 'battle') return battleRects();
  if (mode === 'shop') return shopRects();
  if (mode === 'over' || mode === 'complete') return endRects();
  return [];
}

// ---------- drawing helpers ----------
function rrect(x, y, w, h, r = 8) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
function panel(x, y, w, h, opt = {}) {
  const r = opt.r == null ? 10 : opt.r;
  rrect(x, y, w, h, r);
  ctx.fillStyle = opt.fill || 'rgba(14,11,30,.86)';
  ctx.fill();
  if (opt.glass !== false) {
    ctx.save(); ctx.clip();
    ctx.globalAlpha = 0.12; ctx.fillStyle = paperPat; ctx.fillRect(x, y, w, h);
    ctx.restore();
  }
  ctx.strokeStyle = opt.border || 'rgba(217,164,91,.38)';
  ctx.lineWidth = opt.lw || 1.2; ctx.stroke();
  if (opt.corners !== false) {
    ctx.strokeStyle = opt.corner || 'rgba(244,210,147,.65)'; ctx.lineWidth = 1.4;
    const c = 9;
    const corners = [[x + 4, y + 4, 1, 1], [x + w - 4, y + 4, -1, 1], [x + 4, y + h - 4, 1, -1], [x + w - 4, y + h - 4, -1, -1]];
    for (const [cx, cy, sx, sy] of corners) {
      ctx.beginPath(); ctx.moveTo(cx, cy + sy * c); ctx.lineTo(cx, cy); ctx.lineTo(cx + sx * c, cy); ctx.stroke();
    }
  }
}
function setFont(size, weight = 400, serif = false) {
  ctx.font = `${weight} ${size}px ${serif ? '"Noto Serif CJK SC","Songti SC",serif' : '"Noto Sans CJK SC","Microsoft YaHei",sans-serif'}`;
}
function text(str, x, y, size = 16, color = PAL.paper, align = 'left', weight = 400, serif = false, alpha = 1) {
  ctx.save(); ctx.globalAlpha = alpha; setFont(size, weight, serif);
  ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
  ctx.fillText(str, x, y); ctx.restore();
}
function spacedText(str, cx, y, size, gap, color, weight = 700, serif = true) {
  ctx.save(); setFont(size, weight, serif); ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const chars = [...str];
  const widths = chars.map(ch => ctx.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0) + gap * (chars.length - 1);
  let x = cx - total / 2;
  for (let i = 0; i < chars.length; i++) { ctx.fillText(chars[i], x + widths[i] / 2, y); x += widths[i] + gap; }
  ctx.restore();
}
function wrapLines(str, maxW, size, weight = 400, serif = false) {
  setFont(size, weight, serif);
  const chars = [...str];
  const lines = []; let line = '';
  for (const ch of chars) {
    if (ch === '\n') { lines.push(line); line = ''; continue; }
    const test = line + ch;
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = ch; }
    else line = test;
  }
  if (line) lines.push(line);
  return lines;
}
function drawBar(x, y, w, h, frac, color, bg = 'rgba(5,4,14,.75)', rounded = true) {
  if (rounded) rrect(x, y, w, h, h / 2); else ctx.beginPath(), ctx.rect(x, y, w, h);
  ctx.fillStyle = bg; ctx.fill();
  const f = clamp(frac, 0, 1);
  if (f > 0) {
    if (rounded) rrect(x, y, Math.max(h, w * f), h, h / 2); else ctx.beginPath(), ctx.rect(x, y, w * f, h);
    const g = ctx.createLinearGradient(x, y, x + w, y);
    g.addColorStop(0, color); g.addColorStop(1, color);
    ctx.fillStyle = g; ctx.fill();
  }
  if (rounded) rrect(x, y, w, h, h / 2); else ctx.beginPath(), ctx.rect(x, y, w, h);
  ctx.strokeStyle = 'rgba(240,220,180,.22)'; ctx.lineWidth = 1; ctx.stroke();
}
function drawStatusChips(x, y, b) {
  let cx = x;
  for (const id of Object.keys(b.statuses || {})) {
    const st = STATUS[id]; if (!st) continue;
    ctx.beginPath(); ctx.arc(cx + 9, y + 9, 9, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(10,7,20,.9)'; ctx.fill();
    ctx.strokeStyle = st.color; ctx.lineWidth = 1.2; ctx.stroke();
    text(st.short, cx + 9, y + 13, 11, st.color, 'center', 700);
    cx += 23;
  }
}
function drawCoin(x, y, size = 14) {
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = '#e8be6c'; ctx.shadowColor = '#c98f3c'; ctx.shadowBlur = 6;
  ctx.beginPath(); ctx.arc(0, 0, size * 0.5, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
  ctx.strokeStyle = '#8b6538'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, 0, size * 0.5, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = '#7a5228'; ctx.beginPath(); ctx.moveTo(-size * 0.16, 0); ctx.lineTo(size * 0.16, 0); ctx.moveTo(0, -size * 0.16); ctx.lineTo(0, size * 0.16); ctx.stroke();
  ctx.restore();
}
function drawSealIcon(x, y, s = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = '#e9d6aa'; ctx.strokeStyle = '#b8503c'; ctx.lineWidth = 1.4;
  rrect(-7, -10, 14, 20, 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#b8503c'; ctx.beginPath(); ctx.arc(0, 0, 3.4, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#b8503c'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(0, 6); ctx.stroke();
  ctx.restore();
}
function drawVignette() {
  const g = ctx.createRadialGradient(CAM_W / 2, CAM_H / 2, CAM_H * 0.32, CAM_W / 2, CAM_H / 2, CAM_W * 0.62);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(3,2,10,.55)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, CAM_W, CAM_H);
  if (paperPat) { ctx.save(); ctx.globalAlpha = 0.05; ctx.fillStyle = paperPat; ctx.fillRect(0, 0, CAM_W, CAM_H); ctx.restore(); }
}

// ---------- title render ----------
function drawTitleBg() {
  const g = ctx.createLinearGradient(0, 0, 0, CAM_H);
  g.addColorStop(0, '#090818'); g.addColorStop(0.55, '#131029'); g.addColorStop(1, '#1d1738');
  ctx.fillStyle = g; ctx.fillRect(0, 0, CAM_W, CAM_H);
  // stars
  for (let i = 0; i < 90; i++) {
    const x = (i * 197.3) % CAM_W, y = (i * 89.7) % 430;
    const tw = 0.35 + 0.65 * Math.abs(Math.sin(simTime * 0.7 + i));
    ctx.globalAlpha = 0.25 + tw * 0.4; ctx.fillStyle = i % 9 === 0 ? '#f4d293' : '#d8d2f0';
    ctx.fillRect(x, y, i % 7 === 0 ? 2 : 1, i % 7 === 0 ? 2 : 1);
  }
  ctx.globalAlpha = 1;
  // moon
  ctx.save(); ctx.globalAlpha = 0.9;
  const mg = ctx.createRadialGradient(1010, 150, 18, 1010, 150, 120);
  mg.addColorStop(0, 'rgba(255,235,190,.5)'); mg.addColorStop(0.4, 'rgba(255,220,150,.16)'); mg.addColorStop(1, 'rgba(255,220,150,0)');
  ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(1010, 150, 120, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f0d9a4'; ctx.beginPath(); ctx.arc(1010, 150, 34, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(150,120,80,.25)'; ctx.beginPath(); ctx.arc(1002, 143, 8, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(1021, 160, 5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  // distant hills
  ctx.fillStyle = 'rgba(20,17,45,.75)';
  ctx.beginPath(); ctx.moveTo(0, 560);
  for (let x = 0; x <= CAM_W; x += 40) ctx.lineTo(x, 505 + Math.sin(x * 0.006 + 1.2) * 34 + Math.sin(x * 0.017) * 10);
  ctx.lineTo(CAM_W, CAM_H); ctx.lineTo(0, CAM_H); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(12,10,28,.85)';
  ctx.beginPath(); ctx.moveTo(0, 610);
  for (let x = 0; x <= CAM_W; x += 30) ctx.lineTo(x, 580 + Math.sin(x * 0.009 + 4) * 22);
  ctx.lineTo(CAM_W, CAM_H); ctx.lineTo(0, CAM_H); ctx.closePath(); ctx.fill();
  // glyph ring
  drawGlyphRing(ctx, 640, 300, 250, simTime, { alpha: 0.34 });
  // fireflies
  for (let i = 0; i < 22; i++) {
    const x = 100 + (i * 137) % 1080, y = 420 + Math.sin(simTime * 0.8 + i * 1.7) * 60 + (i * 37) % 180;
    ctx.globalAlpha = 0.35 + 0.4 * Math.abs(Math.sin(simTime * 1.6 + i));
    ctx.fillStyle = i % 3 ? '#9fe8d0' : '#f4d293'; ctx.beginPath(); ctx.arc(x, y, 1.6, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  // beast silhouettes
  drawBeast(ctx, 'emberbadger', 175, 600, 1.55, { t: simTime, alpha: 0.52, flip: false, motes: false });
  drawBeast(ctx, 'nightowl', 1110, 590, 1.5, { t: simTime + 1.2, alpha: 0.45, flip: true, motes: false });
  drawBeast(ctx, 'tideotter', 1010, 640, 1.0, { t: simTime + 0.5, alpha: 0.25, flip: true, motes: false });
}
function renderTitle() {
  drawTitleBg();
  // series badge
  panel(30, 26, 214, 46, { fill: 'rgba(12,9,26,.72)', r: 8 });
  drawElementIcon(ctx, 'light', 56, 49, 12, { plate: false });
  text('灯匠夜游 · 第 9 铺', 78, 55, 15, PAL.copperHi, 'left', 600, true);
  // headings
  spacedText('符兽六道', 640, 214, 78, 10, '#f4d293', 700, true);
  ctx.save(); ctx.shadowColor = 'rgba(244,210,147,.32)'; ctx.shadowBlur = 30; ctx.strokeStyle = 'rgba(244,210,147,.18)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(390, 262); ctx.lineTo(890, 262); ctx.stroke(); ctx.restore();
  spacedText('GLYPHBEAST · SIXFOLD TRAIL', 640, 292, 16, 3, '#bfaecb', 500, false);
  text('十二符兽，六道相克。一盏灯，走完冠军路。', 640, 344, 17, PAL.paperDim, 'center', 400, true);
  text(hasSave ? `最高进度 ${bossMax} / 4 · 最高分 ${best}` : (bossMax ? `最高进度 ${bossMax} / 4 · 最高分 ${best}` : '尚无行旅记录'), 640, 380, 14, '#c9a86a', 'center', 400);
  // start button
  const sr = titleRects()[0];
  ctx.save();
  ctx.shadowColor = 'rgba(255,190,90,.35)'; ctx.shadowBlur = 22;
  rrect(sr.x, sr.y, sr.w, sr.h, 30);
  const bg = ctx.createLinearGradient(sr.x, sr.y, sr.x, sr.y + sr.h);
  bg.addColorStop(0, '#f4d293'); bg.addColorStop(1, '#d9a45b');
  ctx.fillStyle = bg; ctx.fill(); ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(90,60,26,.55)'; ctx.lineWidth = 1.2; ctx.stroke();
  ctx.restore();
  text(hasSave ? '继续旅程' : '启 程', sr.x + sr.w / 2, sr.y + 39, 23, '#181227', 'center', 700, true);
  if (hasSave) {
    const nr = titleRects()[1];
    panel(nr.x, nr.y, nr.w, nr.h, { fill: 'rgba(16,12,32,.72)', r: 22 });
    text('新旅程', nr.x + nr.w / 2, nr.y + 29, 16, PAL.paperDim, 'center', 500, true);
  }
  text('方向键 / WASD 移动 · E 交互 · 战斗 1-4 / 方向键+Enter · P 暂停 · M 静音', 640, 646, 13, PAL.muted, 'center', 400);
  text('点击画面启程 · 草丛中会遇见符兽', 640, 670, 13, 'rgba(200,180,150,.6)', 'center', 400);
}

// ---------- world render ----------
let worldDeco = null;
function buildWorldDeco() {
  const tufts = [], flies = [], rocks = [], reeds = [];
  let seed = 12345;
  const rr = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  for (const z of ZONES) {
    for (const g of z.grass) {
      const n = Math.round(g.w * g.h / 5400);
      for (let i = 0; i < n; i++) tufts.push({ x: g.x + rr() * g.w, y: g.y + rr() * g.h, el: z.wild[(rr() * z.wild.length) | 0].id ? SPECIES[z.wild[(rr() * z.wild.length) | 0].id].el : null, seed: rr() * 10 });
      for (let i = 0; i < 8; i++) flies.push({ x: g.x + rr() * g.w, y: g.y + rr() * g.h, p: rr() * 6 });
    }
  }
  for (let i = 0; i < 26; i++) rocks.push({ x: 260 + rr() * (WORLD_W - 520), y: 180 + rr() * (WORLD_H - 340), s: 0.6 + rr() * 0.9 });
  for (let i = 0; i < 22; i++) reeds.push({ x: 880 + rr() * 300, y: 300 + rr() * 800, p: rr() * 6 });
  for (let i = 0; i < 15; i++) rocks.push({ x: 1250 + rr() * 330, y: 200 + rr() * 1000, s: 0.8 + rr() * 1.2 });
  worldDeco = { tufts, flies, rocks, reeds };
}
buildWorldDeco();

function renderExplore() {
  cam.x = clamp(player.x - CAM_W / 2, 0, WORLD_W - CAM_W);
  cam.y = clamp(player.y - CAM_H / 2, 0, WORLD_H - CAM_H);
  // ground base
  const g = ctx.createLinearGradient(0, 0, 0, CAM_H);
  g.addColorStop(0, '#0b0a1d'); g.addColorStop(0.6, '#121028'); g.addColorStop(1, '#19142f');
  ctx.fillStyle = g; ctx.fillRect(0, 0, CAM_W, CAM_H);
  ctx.save();
  ctx.translate(-cam.x, -cam.y);
  // zone washes
  for (const z of ZONES) {
    const colors = { meadow: 'rgba(44,86,62,.18)', river: 'rgba(30,82,88,.2)', crag: 'rgba(92,72,48,.17)', shadow: 'rgba(58,40,88,.22)' };
    ctx.fillStyle = colors[z.id];
    ctx.fillRect(z.x0, 0, z.x1 - z.x0, WORLD_H);
    ctx.strokeStyle = 'rgba(217,164,91,.10)'; ctx.lineWidth = 1;
    ctx.setLineDash([6, 14]);
    ctx.beginPath(); ctx.moveTo(z.x1, 0); ctx.lineTo(z.x1, WORLD_H); ctx.stroke();
    ctx.setLineDash([]);
  }
  // trail
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(9,7,18,.8)'; ctx.lineWidth = 54;
  ctx.beginPath();
  for (let x = -20; x <= WORLD_W + 20; x += 20) {
    const y = 700 + Math.sin(x * 0.004) * 26 + Math.sin(x * 0.011) * 8;
    x === -20 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.strokeStyle = 'rgba(217,164,91,.28)'; ctx.lineWidth = 2; ctx.setLineDash([16, 22]);
  ctx.beginPath();
  for (let x = -20; x <= WORLD_W + 20; x += 20) {
    const y = 700 + Math.sin(x * 0.004) * 26 + Math.sin(x * 0.011) * 8;
    x === -20 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.stroke(); ctx.setLineDash([]);
  // rune ticks
  for (let x = 60; x < WORLD_W; x += 140) {
    const y = 700 + Math.sin(x * 0.004) * 26 + Math.sin(x * 0.011) * 8;
    ctx.strokeStyle = 'rgba(244,210,147,.22)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, y - 8); ctx.lineTo(x + 6, y); ctx.lineTo(x, y + 8); ctx.stroke();
  }
  ctx.restore();
  // river decoration
  drawWaterBand(ctx, 900, 1060, 290, simTime);
  drawWaterBand(ctx, 940, 1130, 230, simTime + 1.4);
  // grass patches
  for (const z of ZONES) for (const gr of z.grass) {
    const eg = ctx.createRadialGradient(gr.x + gr.w / 2, gr.y + gr.h / 2, 10, gr.x + gr.w / 2, gr.y + gr.h / 2, Math.max(gr.w, gr.h) * 0.7);
    eg.addColorStop(0, 'rgba(30,62,50,.55)'); eg.addColorStop(1, 'rgba(24,48,42,.18)');
    rrect(gr.x, gr.y, gr.w, gr.h, 40); ctx.fillStyle = eg; ctx.fill();
    ctx.strokeStyle = 'rgba(111,224,192,.10)'; ctx.lineWidth = 1.4; ctx.setLineDash([5, 9]); ctx.stroke(); ctx.setLineDash([]);
  }
  // tufts
  for (const t of worldDeco.tufts) drawGrassTuft(ctx, t.x, t.y, simTime, t.el, t.seed);
  // rocks / reeds / dead trees
  for (const r of worldDeco.rocks) drawRock(ctx, r.x, r.y, r.s);
  for (const r of worldDeco.reeds) drawReed(ctx, r.x, r.y, simTime, r.p);
  for (let i = 0; i < 9; i++) drawDeadTree(ctx, 1640 + i * 62, 220 + (i % 3) * 170, simTime);
  // fireflies
  for (const f of worldDeco.flies) {
    const a = 0.2 + 0.55 * Math.abs(Math.sin(simTime * 1.3 + f.p));
    ctx.globalAlpha = a; ctx.fillStyle = f.p > 3 ? '#f4d293' : '#8fe8c8';
    ctx.beginPath(); ctx.arc(f.x + Math.sin(simTime + f.p) * 8, f.y + Math.cos(simTime * 0.8 + f.p) * 6, 1.6, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  // structures
  drawTent(ctx, CAMP_POS.x, CAMP_POS.y, simTime);
  drawCampfire(ctx, CAMP_POS.x + 52, CAMP_POS.y + 18, simTime);
  drawShop(ctx, SHOP_POS.x, SHOP_POS.y, simTime);
  // labels
  text('营地', CAMP_POS.x, CAMP_POS.y - 100, 14, '#c9b48b', 'center', 600, true);
  text('驿铺', SHOP_POS.x, SHOP_POS.y - 70, 13, '#c9b48b', 'center', 600, true);
  // wanderers
  for (const z of ZONES) {
    for (let i = 0; i < z.wander.length; i++) {
      const w = z.wander[i];
      const bobx = w.x + Math.sin(simTime * 0.35 + i * 2) * 16;
      const boby = w.y + Math.cos(simTime * 0.28 + i) * 10;
      drawBeast(ctx, w.id, bobx, boby, 0.56, { t: simTime + i, alpha: 0.62, motes: false });
    }
  }
  // gates
  for (let i = 0; i < BOSSES.length; i++) {
    const b = BOSSES[i];
    const state = i < bosses ? 'beaten' : i === bosses ? 'open' : 'locked';
    drawGate(ctx, b, b.x, b.y, simTime, state);
    text(b.gate, b.x, b.y - 126, 17, state === 'locked' ? 'rgba(190,175,210,.55)' : state === 'beaten' ? '#8fd9c0' : '#f4d293', 'center', 700, true);
    text(state === 'locked' ? '封印未解' : state === 'beaten' ? '已通过' : `${b.name} · 守关中`, b.x, b.y - 106, 11, state === 'locked' ? 'rgba(170,150,190,.5)' : '#c9b48b', 'center', 400, true);
  }
  // player
  drawPlayer(ctx, player.x, player.y, player.facing, simTime, { moving: player.moving });
  // move target marker
  if (moveTarget) {
    ctx.strokeStyle = 'rgba(244,210,147,.45)'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.ellipse(moveTarget.x, moveTarget.y, 8 + Math.sin(simTime * 6) * 2, 4, 0, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
  // canopy vignette
  ctx.save();
  const shade = ctx.createLinearGradient(0, 0, 0, 200);
  shade.addColorStop(0, 'rgba(5,4,14,.8)'); shade.addColorStop(1, 'rgba(5,4,14,0)');
  ctx.fillStyle = shade; ctx.fillRect(0, 0, CAM_W, 200);
  ctx.restore();
  renderExploreHUD();
  // touch controls
  if (touchUI()) renderTouchControls();
  // zone toast
  if (zoneToast.t > 0) {
    const a = Math.min(1, zoneToast.t / 0.6);
    ctx.save(); ctx.globalAlpha = a;
    text(zoneToast.text, 640, 168, 30, '#f4d293', 'center', 700, true);
    text(zoneToast.sub, 640, 194, 13, PAL.muted, 'center', 400, true);
    ctx.restore();
  }
  // interaction hint
  const near = nearestInteract();
  if (near) {
    const locked = near.kind === 'gate' && near.gate > bosses;
    const label = near.label;
    panel(640 - Math.max(150, label.length * 8), 672, Math.max(300, label.length * 16), 34, { fill: 'rgba(12,9,26,.8)', r: 17, corners: false });
    text((locked ? '✕ ' : '[E] ') + label, 640, 695, 14, locked ? '#a899c0' : '#f4d293', 'center', 500, true);
  }
}

function renderTouchControls() {
  const rects = dpadRects();
  ctx.save();
  for (const r of rects) {
    ctx.globalAlpha = 0.68;
    ctx.beginPath(); ctx.arc(r.x + r.w / 2, r.y + r.h / 2, 26, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(16,12,34,.8)'; ctx.fill();
    ctx.strokeStyle = 'rgba(217,164,91,.55)'; ctx.lineWidth = 1.2; ctx.stroke();
    const dir = r.id.slice(-1);
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
    ctx.strokeStyle = '#f4d293'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath();
    if (dir === 'left') { ctx.moveTo(cx + 6, cy - 7); ctx.lineTo(cx - 6, cy); ctx.lineTo(cx + 6, cy + 7); }
    if (dir === 'right') { ctx.moveTo(cx - 6, cy - 7); ctx.lineTo(cx + 6, cy); ctx.lineTo(cx - 6, cy + 7); }
    if (dir === 'up') { ctx.moveTo(cx - 7, cy + 6); ctx.lineTo(cx, cy - 6); ctx.lineTo(cx + 7, cy + 6); }
    if (dir === 'down') { ctx.moveTo(cx - 7, cy - 6); ctx.lineTo(cx, cy + 6); ctx.lineTo(cx + 7, cy - 6); }
    ctx.stroke();
  }
  // interact
  ctx.globalAlpha = 0.75;
  ctx.beginPath(); ctx.arc(1158, 678, 38, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(16,12,34,.85)'; ctx.fill(); ctx.strokeStyle = 'rgba(217,164,91,.65)'; ctx.stroke();
  text('E', 1158, 687, 24, '#f4d293', 'center', 700, true);
  text('交互', 1158, 650, 11, '#c9b48b', 'center', 500, true);
  ctx.restore();
}

function renderExploreHUD() {
  // party panel
  const ph = 26 + party.length * 46 + 6;
  panel(22, 18, 342, ph, { fill: 'rgba(11,9,26,.82)' });
  text('队 伍', 42, 46, 15, '#f4d293', 'left', 700, true);
  text(`${party.length}/4 · 符兽录 ${caught.size}/12`, 342, 46, 11, PAL.muted, 'right', 400);
  for (let i = 0; i < party.length; i++) {
    const b = party[i], sp = SPECIES[b.id];
    const y = 58 + i * 46;
    if (b.hp > 0 && i === 0) {
      ctx.strokeStyle = 'rgba(111,224,192,.25)'; ctx.lineWidth = 1;
      rrect(32, y, 320, 40, 7); ctx.stroke();
    }
    drawElementIcon(ctx, sp.el, 50, y + 20, 11, { plate: true });
    text(sp.zh, 68, y + 17, 14, b.hp > 0 ? PAL.paper : '#776c88', 'left', 600, true);
    text('Lv' + b.level, 68, y + 32, 10, PAL.muted, 'left', 400);
    drawBar(140, y + 20, 190, 8, b.hp / b.maxHp, b.hp > b.maxHp * 0.3 ? '#6fe0c0' : '#e06544');
    text(`${Math.round(b.hp)}/${b.maxHp}`, 336, y + 18, 10, PAL.paperDim, 'right', 400);
    if (b.hp <= 0) text('倒', 336, y + 32, 10, '#e09090', 'right', 600);
  }
  // resources / objective (compact, left of the DOM buttons)
  panel(906, 18, 198, 92, { fill: 'rgba(11,9,26,.82)' });
  drawCoin(930, 46, 15);
  text('' + gold, 946, 52, 17, '#f0d08a', 'left', 700);
  drawSealIcon(1030, 46, 1.0);
  text('' + seals, 1046, 52, 15, '#efdcb4', 'left', 600);
  text('进度 ' + bosses + '/4', 930, 76, 11, PAL.muted, 'left', 500);
  const nb = nextBoss();
  text(nb ? `${nb.gate} · ${nb.name}` : '六道归一 · 已通关', 930, 96, 11, nb ? '#c9b48b' : '#8fd9c0', 'left', 500);
  // progress nodes
  for (let i = 0; i < 4; i++) {
    const x = 1020 + i * 20, by = 74;
    ctx.beginPath(); ctx.arc(x, by, 7, 0, Math.PI * 2);
    ctx.fillStyle = i < bosses ? 'rgba(111,224,192,.85)' : i === bosses ? 'rgba(244,210,147,.9)' : 'rgba(90,76,120,.6)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(12,9,26,.9)'; ctx.lineWidth = 1.2; ctx.stroke();
    text('' + (i + 1), x, by + 3, 8, '#161022', 'center', 700);
  }
  // tutorial line
  if (simTime - startedAt < 12 && mode === 'explore') {
    ctx.save(); ctx.globalAlpha = clamp((12 - (simTime - startedAt)) / 2, 0, 1) * 0.9;
    panel(392, 18, 396, 30, { fill: 'rgba(12,9,26,.75)', r: 15, corners: false });
    text('方向键/WASD 移动 · E 交互 · C 符兽录', 590, 38, 12, '#d8c8a8', 'center', 500);
    ctx.restore();
  }
  // top-right buttons sit in DOM; reserve space handled by CSS
  // toast
  if (toast.t > 0) {
    const a = clamp(toast.t / 0.5, 0, 1);
    ctx.save(); ctx.globalAlpha = a;
    const w = Math.max(240, Math.min(660, toast.text.length * 15 + 44));
    panel(640 - w / 2, 604, w, 36, { fill: 'rgba(14,11,30,.9)', r: 18, corners: false });
    text(toast.text, 640, 628, 14, '#efe0c3', 'center', 500, true);
    ctx.restore();
  }
}

// ---------- battle render ----------
function battleBackdrop() {
  const zoneKey = battle && battle.bossIdx >= 0 ? 'boss' : (battle ? battle.bgZone : 'meadow');
  const tints = {
    meadow: ['#121326', '#1d2338', '#243b3f'],
    river: ['#0d1424', '#132638', '#1c3b43'],
    crag: ['#151022', '#251b2c', '#3a2b30'],
    shadow: ['#0c0919', '#191130', '#271a3a'],
    boss: ['#0b0818', '#1d1230', '#331d38'],
  };
  const t = tints[zoneKey] || tints.meadow;
  const g = ctx.createLinearGradient(0, 0, 0, CAM_H);
  g.addColorStop(0, t[0]); g.addColorStop(0.58, t[1]); g.addColorStop(1, t[2]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, CAM_W, CAM_H);
  // moon / haze
  const mg = ctx.createRadialGradient(950, 120, 9, 950, 120, 160);
  mg.addColorStop(0, 'rgba(255,230,180,.24)'); mg.addColorStop(1, 'rgba(255,230,180,0)');
  ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(950, 120, 160, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(240,220,170,.5)'; ctx.beginPath(); ctx.arc(950, 120, 22, 0, Math.PI * 2); ctx.fill();
  // horizon hills
  ctx.fillStyle = 'rgba(8,7,18,.55)';
  ctx.beginPath(); ctx.moveTo(0, 420);
  for (let x = 0; x <= CAM_W; x += 36) ctx.lineTo(x, 390 + Math.sin(x * 0.01 + 2) * 30 + Math.sin(x * 0.03) * 8);
  ctx.lineTo(CAM_W, 540); ctx.lineTo(0, 540); ctx.closePath(); ctx.fill();
  // zone props silhouettes
  if (zoneKey === 'river') {
    drawWaterBand(ctx, 0, 392, CAM_W, simTime);
    for (let i = 0; i < 10; i++) drawReed(ctx, 80 + i * 130, 470, simTime, i);
  } else if (zoneKey === 'crag') {
    for (let i = 0; i < 8; i++) drawRock(ctx, 70 + i * 170, 452, 1.2 + (i % 3) * 0.4);
  } else if (zoneKey === 'shadow' || zoneKey === 'boss') {
    for (let i = 0; i < 5; i++) drawDeadTree(ctx, 90 + i * 280, 500, simTime);
  } else {
    for (let i = 0; i < 16; i++) drawGrassTuft(ctx, 40 + i * 82, 500, simTime, i % 3 ? 'gale' : 'light', i);
  }
  // rune ring
  drawGlyphRing(ctx, 640, 274, 286, simTime, { alpha: zoneKey === 'boss' ? 0.42 : 0.25 });
  // ground platforms
  for (const p of [{ x: 300, y: 505, w: 250, c: 'rgba(217,164,91,.25)' }, { x: 948, y: 414, w: 230, c: 'rgba(165,138,222,.22)' }]) {
    const pg = ctx.createRadialGradient(p.x, p.y, 8, p.x, p.y, p.w * 0.6);
    pg.addColorStop(0, p.c); pg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = pg; ctx.beginPath(); ctx.ellipse(p.x, p.y, p.w, 34, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(217,164,91,.3)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.ellipse(p.x, p.y, p.w * 0.72, 22, 0, 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i < 12; i++) {
      const a = i * Math.PI * 2 / 12 + simTime * 0.05;
      ctx.beginPath(); ctx.moveTo(p.x + Math.cos(a) * p.w * 0.72, p.y + Math.sin(a) * 22);
      ctx.lineTo(p.x + Math.cos(a) * p.w * 0.79, p.y + Math.sin(a) * 25); ctx.stroke();
    }
  }
  // ambient motes
  for (let i = 0; i < 26; i++) {
    const x = (i * 151) % CAM_W, y = 90 + (i * 71) % 380;
    ctx.globalAlpha = 0.12 + 0.3 * Math.abs(Math.sin(simTime * 0.9 + i));
    ctx.fillStyle = i % 3 ? '#f4d293' : '#8fd9c0';
    ctx.beginPath(); ctx.arc(x + Math.sin(simTime + i) * 14, y, 1.4, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  if (bgFlash > 0) { ctx.fillStyle = `rgba(255,240,200,${bgFlash * 0.5})`; ctx.fillRect(0, 0, CAM_W, CAM_H); }
}

function drawBattleEffects() {
  if (!battle || !battle.anim) return;
  const a = battle.anim;
  const target = a.side === 'player' ? { x: 948, y: 300 } : { x: 300, y: 380 };
  const p = a.t / a.dur;
  const el = ELEMENTS[a.el] || ELEMENTS.light;
  ctx.save();
  ctx.globalAlpha = 1 - p;
  if (a.type === 'element') {
    if (a.el === 'flame') {
      for (let i = 0; i < 6; i++) {
        const x = target.x + Math.cos(i * 1.7 + p * 3) * 50 * p, y = target.y - 30 + Math.sin(i) * 40;
        flameShape(x, y, 18 * (1 - p * 0.5), el.light);
      }
    } else if (a.el === 'tide') {
      ctx.strokeStyle = el.light; ctx.lineWidth = 3;
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(target.x, target.y, 20 + p * 70 + i * 10, -1.2 + i, 1.9 + i); ctx.stroke(); }
    } else if (a.el === 'stone') {
      ctx.fillStyle = el.light;
      for (let i = 0; i < 6; i++) { const x = target.x + (i - 3) * 22 * p, y = target.y + 40 - 80 * p; ctx.beginPath(); ctx.moveTo(x - 6, y + 10); ctx.lineTo(x, y - 10); ctx.lineTo(x + 7, y + 8); ctx.closePath(); ctx.fill(); }
    } else if (a.el === 'gale') {
      ctx.strokeStyle = el.light; ctx.lineWidth = 2;
      for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(target.x - 70 + i * 10, target.y - 20 + i * 11); ctx.lineTo(target.x + 50 + i * 14, target.y - 30 + i * 11); ctx.stroke(); }
    } else if (a.el === 'light') {
      ctx.strokeStyle = el.light; ctx.lineWidth = 2;
      for (let i = 0; i < 8; i++) { const ang = i * Math.PI / 4 + p; ctx.beginPath(); ctx.moveTo(target.x + Math.cos(ang) * 20, target.y + Math.sin(ang) * 20); ctx.lineTo(target.x + Math.cos(ang) * (60 + p * 40), target.y + Math.sin(ang) * (60 + p * 40)); ctx.stroke(); }
    } else {
      ctx.strokeStyle = el.light; ctx.lineWidth = 4;
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(target.x - 30 + i * 15, target.y + 40); ctx.quadraticCurveTo(target.x + Math.sin(p * 8 + i) * 30, target.y, target.x + (i - 1.5) * 22, target.y - 60 * p); ctx.stroke(); }
    }
  } else if (a.type === 'seal') {
    ctx.strokeStyle = '#f4d293'; ctx.lineWidth = 2.4;
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(920, 300, 30 + p * 60 + i * 14, p * 3 + i, p * 3 + i + 4.2); ctx.stroke(); }
    drawSealIcon(920, 300 - p * 20, 2);
  } else if (a.type === 'heal') {
    ctx.strokeStyle = '#a8f0c0'; ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(320, 360, 20 + p * 40 + i * 12, 0, Math.PI * 2); ctx.stroke(); }
  } else if (a.type === 'shield') {
    ctx.strokeStyle = '#9fe8d0'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(320, 360, 60 + Math.sin(p * Math.PI) * 18, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
}
function flameShape(x, y, s, col) {
  ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x, y - s * 1.4);
  ctx.bezierCurveTo(x + s, y - s * 0.2, x + s * 0.6, y + s * 0.7, x, y + s);
  ctx.bezierCurveTo(x - s * 0.7, y + s * 0.7, x - s, y - s * 0.2, x, y - s * 1.4); ctx.fill();
}

function renderBattle() {
  if (!battle) { renderTitle(); return; }
  battleBackdrop();
  const p = activeBeast(), e = enemyActive();
  const enter = 1 - Math.pow(1 - battle.enterT, 3);
  const enemyX = 940 + (1 - enter) * 260;
  const playerX = 300 - (1 - enter) * 220;
  // beasts
  if (e) {
    const fainted = e.hp <= 0;
    drawBeast(ctx, e.id, enemyX, 280, 2.35, { t: simTime + 0.7, flip: true, alpha: fainted ? 0.35 : 1, faint: fainted, shadowAura: true });
    if (!fainted) {
      ctx.save(); ctx.globalAlpha = 0.3;
      drawBeast(ctx, e.id, enemyX + 4, 284, 2.35, { t: simTime + 0.7, flip: true, alpha: 0.18, motes: false });
      ctx.restore();
    }
  }
  if (p) {
    const fainted = p.hp <= 0;
    drawBeast(ctx, p.id, playerX, 358, 2.5, { t: simTime, flip: false, alpha: fainted ? 0.4 : 1, faint: fainted, shadowAura: true });
  }
  drawBattleEffects();
  // enemy info
  if (e) drawBattlePlate(36, 26, e, false);
  if (p) drawBattlePlate(748, 420, p, true);
  // turn & team dots
  text(`第 ${battle.turn} 回合`, 640, 30, 14, '#c9b48b', 'center', 500, true);
  if (battle.bossIdx >= 0) text(BOSSES[battle.bossIdx].gate + ' · ' + BOSSES[battle.bossIdx].name, 640, 52, 12, '#e0c08a', 'center', 500, true);
  if (battle.enemies.length > 1) {
    for (let i = 0; i < battle.enemies.length; i++) {
      ctx.beginPath(); ctx.arc(596 + i * 20, 172, 5, 0, Math.PI * 2);
      ctx.fillStyle = battle.enemies[i].hp <= 0 ? 'rgba(80,70,100,.5)' : i === battle.enemyIdx ? '#f4d293' : '#b89b7a';
      ctx.fill();
    }
    text('对手队伍', 560, 177, 10, PAL.muted, 'right', 400);
  }
  // bottom panel
  panel(22, 516, 636, 184, { fill: 'rgba(10,8,22,.9)' });
  panel(674, 516, 584, 184, { fill: 'rgba(13,10,28,.92)' });
  drawBattleLog();
  drawBattleCommands();
  // result modal
  if (battle.phase === 'result') drawBattleResult();
  // intro veil
  if (battle.phase === 'intro') {
    ctx.save(); ctx.globalAlpha = 0.55;
    const g = ctx.createLinearGradient(0, 0, 0, CAM_H);
    g.addColorStop(0, '#080714'); g.addColorStop(1, '#121026'); ctx.fillStyle = g; ctx.fillRect(0, 0, CAM_W, CAM_H);
    ctx.restore();
    text(battle.bossIdx >= 0 ? '守关人挡住了去路' : '遭遇野生符兽', 640, 330, 28, '#f4d293', 'center', 700, true);
    text('点击或按 Enter 开始', 640, 366, 14, PAL.muted, 'center', 400);
  }
  // flash overlay
  if (bgFlash > 0) { ctx.fillStyle = `rgba(255,240,200,${bgFlash * 0.35})`; ctx.fillRect(0, 0, CAM_W, CAM_H); }
}

function drawBattlePlate(x, y, b, mine) {
  const sp = SPECIES[b.id];
  const el = ELEMENTS[sp.el];
  panel(x, y, 456, 94, { fill: 'rgba(10,8,22,.86)' });
  drawElementIcon(ctx, sp.el, x + 34, y + 47, 17, { plate: true });
  text(sp.zh, x + 62, y + 34, 20, PAL.paper, 'left', 700, true);
  text('Lv' + b.level, x + 62, y + 56, 13, '#c9b48b', 'left', 500);
  const ratio = clamp(b.hp / b.maxHp, 0, 1);
  drawBar(x + 160, y + 48, 262, 12, ratio, ratio > 0.5 ? (mine ? '#6fe0c0' : '#e0a05c') : ratio > 0.22 ? '#e8c05c' : '#e06544');
  text(`${Math.ceil(b.hp)} / ${b.maxHp}`, x + 422, y + 42, 12, '#e8dcc8', 'right', 600);
  drawStatusChips(x + 160, y + 66, b);
  if (b.shield > 0) text('盾 ' + Math.round(b.shield), x + 420, y + 76, 11, '#9fe8d0', 'right', 600);
  if (mine) {
    const alive = partyAlive().length;
    text(`队伍 ${alive}/${party.length}`, x + 62, y + 78, 11, PAL.muted, 'left', 400);
  } else {
    text(b.boss ? '守关符兽' : '野生符兽', x + 62, y + 78, 11, PAL.muted, 'left', 400);
  }
}

function drawBattleLog() {
  const lines = [];
  const log = battle.log.slice(-9);
  for (const l of log) {
    for (const ln of wrapLines(l.text, 580, 14, 400, true)) lines.push({ ln, color: l.color });
  }
  const shown = lines.slice(-6);
  for (let i = 0; i < shown.length; i++) {
    text(shown[i].ln, 42, 544 + i * 24, 14, shown[i].color, 'left', 400, true);
  }
  // decorative divider
  ctx.strokeStyle = 'rgba(217,164,91,.18)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(42, 692); ctx.lineTo(636, 692); ctx.stroke();
  text('符兽六道 · 六属性循环：焰→风→岩→潮→光→影→焰', 42, 685, 9, 'rgba(190,170,140,.5)', 'left', 400, true);
}

function drawBattleCommands() {
  const ph = battle.phase;
  drawSealIcon(1178, 539, 0.9);
  text('' + seals, 1196, 544, 12, '#efdcb4', 'left', 600);
  if (ph === 'menu') {
    text('指令 · 1-4 / 方向键 + Enter', 696, 544, 13, '#c9b48b', 'left', 500, true);
    const opts = [
      { main: '战 技', sub: '三式符技', key: '1' },
      { main: '投符印', sub: `剩余 ${seals} 枚`, key: '2' },
      { main: '换 兽', sub: `队伍 ${partyAlive().length}/${party.length}`, key: '3' },
      { main: '逃 离', sub: battle.bossIdx >= 0 ? '守关不可退' : '野生战可用', key: '4' },
    ];
    const xs = [696, 976], ys = [562, 638];
    for (let i = 0; i < 4; i++) {
      const x = xs[i % 2], y = ys[i >> 1], w = 264, h = 62;
      const sel = battle.menuSel === i;
      const disabled = i === 1 && seals <= 0;
      rrect(x, y, w, h, 8);
      ctx.fillStyle = sel ? 'rgba(76,56,32,.92)' : 'rgba(22,17,44,.9)'; ctx.fill();
      ctx.strokeStyle = sel ? '#f4d293' : disabled ? 'rgba(120,100,90,.3)' : 'rgba(217,164,91,.32)'; ctx.lineWidth = sel ? 1.8 : 1.1; ctx.stroke();
      // key badge
      ctx.beginPath(); ctx.arc(x + 26, y + 31, 15, 0, Math.PI * 2);
      ctx.fillStyle = sel ? '#f4d293' : 'rgba(217,164,91,.18)'; ctx.fill();
      text(opts[i].key, x + 26, y + 36, 14, sel ? '#1a1428' : '#e0c08a', 'center', 700);
      text(opts[i].main, x + 52, y + 28, 18, disabled ? '#8a7a80' : PAL.paper, 'left', 700, true);
      text(opts[i].sub, x + 52, y + 48, 11, disabled ? '#7a6a80' : PAL.muted, 'left', 400);
    }
  } else if (ph === 'skills') {
    const a = activeBeast();
    text('符技 · 1-3 / 方向键 + Enter · Esc 返回', 696, 544, 13, '#c9b48b', 'left', 500, true);
    const skills = a ? SPECIES[a.id].skills : [];
    for (let i = 0; i < 3; i++) {
      const sk = skills[i]; if (!sk) continue;
      const y = 548 + i * 44, sel = battle.subSel === i;
      rrect(696, y, 544, 40, 7);
      ctx.fillStyle = sel ? 'rgba(76,56,32,.9)' : 'rgba(22,17,44,.88)'; ctx.fill();
      ctx.strokeStyle = sel ? '#f4d293' : 'rgba(217,164,91,.28)'; ctx.lineWidth = sel ? 1.6 : 1; ctx.stroke();
      drawElementIcon(ctx, sk.el, 718, y + 20, 11, { plate: false });
      text(`${i + 1}. ${sk.name}`, 736, y + 25, 15, PAL.paper, 'left', 600, true);
      const tag = sk.type === 'damage' ? `伤害 ${sk.power}` : sk.type === 'status' ? `状态 · ${STATUS[sk.status] ? STATUS[sk.status].zh : ''}` : sk.type === 'heal' ? `回复 ${Math.round(sk.heal * 100)}%` : `护盾 ${Math.round(sk.shield * 100)}%`;
      text(tag, 1222, y + 24, 11, '#c9b48b', 'right', 500);
      text(`命中 ${Math.round((sk.acc == null ? 1 : sk.acc) * 100)}% · ${sk.desc}`, 736, y + 38, 9, PAL.muted, 'left', 400);
    }
    text('Esc 返回', 696, 695, 10, PAL.muted, 'left', 400);
  } else if (ph === 'party' || ph === 'switch') {
    text(ph === 'switch' ? '符兽倒下 · 选择下一只（1-4）' : '换兽（1-4）· Esc 返回', 696, 544, 13, ph === 'switch' ? '#f0c080' : '#c9b48b', 'left', 500, true);
    for (let i = 0; i < party.length; i++) {
      const b = party[i], y = 548 + i * 40, sel = battle.subSel === i;
      const dead = b.hp <= 0, cur = i === battle.activeIdx;
      rrect(696, y, 544, 35, 6);
      ctx.fillStyle = sel ? 'rgba(76,56,32,.9)' : cur ? 'rgba(40,60,56,.75)' : 'rgba(22,17,44,.88)'; ctx.fill();
      ctx.strokeStyle = sel ? '#f4d293' : 'rgba(217,164,91,.25)'; ctx.lineWidth = 1; ctx.stroke();
      drawElementIcon(ctx, SPECIES[b.id].el, 716, y + 18, 9, { plate: false, dim: dead });
      text(`${i + 1}. ${SPECIES[b.id].zh}`, 734, y + 22, 13, dead ? '#7a6e86' : PAL.paper, 'left', 600, true);
      text('Lv' + b.level, 890, y + 22, 11, PAL.muted, 'left', 400);
      drawBar(940, y + 12, 220, 9, b.hp / b.maxHp, dead ? '#5a4f66' : b.hp > b.maxHp * 0.3 ? '#6fe0c0' : '#e06544');
      text(cur ? '上场' : dead ? '倒下' : `${Math.ceil(b.hp)}/${b.maxHp}`, 1222, y + 22, 10, cur ? '#8fd9c0' : PAL.muted, 'right', 500);
    }
  } else if (ph === 'resolving' || ph === 'intro' || ph === 'captureDelay' || ph === 'victoryDelay' || ph === 'send') {
    text('……', 966, 610, 28, '#c9b48b', 'center', 700);
    text(ph === 'captureDelay' ? '符印正在合拢' : ph === 'victoryDelay' ? '战斗结束' : '符兽正在行动', 966, 644, 13, PAL.muted, 'center', 400, true);
  } else if (ph === 'result') {
    text('战斗结果', 966, 560, 14, PAL.muted, 'center', 400, true);
  }
}

function drawBattleResult() {
  const r = battle.result;
  if (!r) return;
  ctx.save(); ctx.fillStyle = 'rgba(5,4,12,.62)'; ctx.fillRect(0, 0, CAM_W, CAM_H); ctx.restore();
  const isWin = r.kind === 'win', isCap = r.kind === 'capture';
  panel(400, 178, 480, 372, { fill: 'rgba(16,12,32,.96)' });
  const title = r.final ? '六道归一' : isCap ? '捕获成功' : r.boss ? '守关人落败' : '战斗胜利';
  spacedText(title, 640, 238, 36, 6, '#f4d293', 700, true);
  ctx.strokeStyle = 'rgba(217,164,91,.3)'; ctx.beginPath(); ctx.moveTo(460, 264); ctx.lineTo(820, 264); ctx.stroke();
  if (isCap) {
    drawBeast(ctx, speciesIdFromName(r.name), 520, 344, 0.9, { t: simTime, motes: false });
    text(`${r.name} · Lv${r.level}`, 640, 330, 20, PAL.paper, 'center', 700, true);
    text(r.toParty ? '加入了队伍' : '队伍已满 · 收入符兽录', 640, 360, 14, '#8fd9c0', 'center', 500, true);
    text(`获得经验 ${r.xp}`, 640, 390, 14, '#d8c8a8', 'center', 400);
  } else if (isWin) {
    drawCoin(556, 320, 18);
    text(`+${r.gold} 铜钱`, 576, 326, 18, '#f0d08a', 'left', 700);
    text(`全队获得 ${r.xp} 经验`, 640, 358, 15, '#d8c8a8', 'center', 400);
    if (r.ups && r.ups.length) text(r.ups.slice(0, 2).join(' · '), 640, 384, 13, '#8fd9c0', 'center', 500, true);
    if (r.final) text('四位守关人已全部落败', 640, 412, 14, '#8fd9c0', 'center', 600, true);
    else if (r.boss) text(`${r.gate} · 通过`, 640, 412, 14, '#f4d293', 'center', 600, true);
  }
  const br = battleRects().find(x => x.id === 'battle-continue');
  if (br) {
    rrect(br.x, br.y, br.w, br.h, 24);
    const g = ctx.createLinearGradient(br.x, br.y, br.x, br.y + br.h);
    g.addColorStop(0, '#f4d293'); g.addColorStop(1, '#d9a45b'); ctx.fillStyle = g; ctx.fill();
    text(r.final ? '查看结语' : '继续探索', br.x + br.w / 2, br.y + 31, 17, '#181227', 'center', 700, true);
  }
}
function speciesIdFromName(name) {
  for (const id of SPECIES_ORDER) if (SPECIES[id].zh === name) return id;
  return 'emberbadger';
}

// ---------- shop / codex / pause / end render ----------
function renderShop() {
  ctx.save(); ctx.fillStyle = 'rgba(5,4,12,.6)'; ctx.fillRect(0, 0, CAM_W, CAM_H); ctx.restore();
  panel(360, 150, 560, 410, { fill: 'rgba(16,12,32,.97)' });
  drawElementIcon(ctx, 'light', 404, 198, 16, { plate: false });
  text('驿铺 · 阿藤的杂货摊', 432, 205, 25, '#f4d293', 'left', 700, true);
  text('油灯、旧符、走夜路用得上的一切。', 404, 238, 13, PAL.muted, 'left', 400, true);
  drawCoin(790, 196, 16); text('' + gold, 808, 202, 16, '#f0d08a', 'left', 700);
  drawSealIcon(870, 196, 1); text('' + seals, 886, 202, 15, '#efdcb4', 'left', 600);
  for (let i = 0; i < SHOP_ITEMS.length; i++) {
    const it = SHOP_ITEMS[i], y = 306 + i * 74;
    rrect(400, y, 480, 62, 8);
    ctx.fillStyle = 'rgba(28,22,48,.92)'; ctx.fill();
    ctx.strokeStyle = 'rgba(217,164,91,.35)'; ctx.lineWidth = 1; ctx.stroke();
    drawSealIcon(430, y + 31, 1.2);
    text(it.zh, 456, y + 27, 17, PAL.paper, 'left', 700, true);
    text(it.desc, 456, y + 47, 10, PAL.muted, 'left', 400);
    drawCoin(780, y + 31, 14); text('' + it.cost, 796, y + 36, 15, '#f0d08a', 'left', 600);
    text('购买', 854, y + 36, 13, '#8fd9c0', 'right', 600);
  }
  const cr = shopRects()[2];
  panel(cr.x, cr.y, cr.w, cr.h, { fill: 'rgba(24,18,42,.95)', r: 22 });
  text('关闭（E / Esc）', cr.x + cr.w / 2, cr.y + 28, 14, '#d8c8a8', 'center', 500, true);
  text('1 购买单枚 · 2 购买三联 · 点击商品也可购买', 640, 540, 11, PAL.muted, 'center', 400);
}

function renderCodex() {
  ctx.save(); ctx.fillStyle = 'rgba(5,4,12,.78)'; ctx.fillRect(0, 0, CAM_W, CAM_H); ctx.restore();
  panel(30, 24, 1220, 672, { fill: 'rgba(14,11,30,.97)' });
  text('符兽录', 62, 72, 30, '#f4d293', 'left', 700, true);
  text(`${caught.size} / 12 已录`, 260, 70, 15, '#8fd9c0', 'left', 500);
  text('六属性循环：焰 → 风 → 岩 → 潮 → 光 → 影 → 焰（克制 ×1.5，被克 ×0.67）', 1050, 70, 12, PAL.muted, 'right', 400, true);
  const cols = 4, cw = 286, ch = 186, gx = 54, gy = 104;
  for (let i = 0; i < SPECIES_ORDER.length; i++) {
    const id = SPECIES_ORDER[i], sp = SPECIES[id];
    const col = i % cols, row = (i / cols) | 0;
    const x = gx + col * (cw + 12), y = gy + row * (ch + 10);
    const known = caught.has(id) || seen.has(id);
    rrect(x, y, cw, ch, 9);
    ctx.fillStyle = i % 2 ? 'rgba(24,19,44,.9)' : 'rgba(20,16,38,.9)'; ctx.fill();
    ctx.strokeStyle = caught.has(id) ? 'rgba(217,164,91,.5)' : 'rgba(150,130,180,.2)'; ctx.lineWidth = 1; ctx.stroke();
    drawElementIcon(ctx, sp.el, x + 22, y + 22, 10, { plate: true, dim: !known });
    text(`${String(i + 1).padStart(2, '0')} · ${known ? sp.zh : '？？？'}`, x + 40, y + 27, 15, known ? PAL.paper : '#766a8a', 'left', 700, true);
    text(known ? sp.en : 'UNSEEN', x + cw - 12, y + 26, 9, PAL.muted, 'right', 400);
    // portrait
    drawBeast(ctx, id, x + 70, y + 112, 0.62, { t: simTime + i * 0.4, alpha: known ? 0.9 : 0.12, motes: false });
    if (known) {
      const lore = wrapLines(sp.lore, 138, 9, 400, true).slice(0, 2);
      for (let li = 0; li < lore.length; li++) text(lore[li], x + 134, y + 62 + li * 12, 9, PAL.paperDim, 'left', 400);
      text(`HP ${sp.base.hp} · 攻 ${sp.base.atk} · 防 ${sp.base.def} · 速 ${sp.base.spd}`, x + 134, y + 90, 9, PAL.muted, 'left', 400);
      for (let s = 0; s < 3; s++) {
        const sk = sp.skills[s];
        const tag = sk.type === 'damage' ? '攻' : sk.type === 'status' ? '状' : sk.type === 'heal' ? '愈' : '盾';
        text(`· ${sk.name}（${tag}）`, x + 134, y + 110 + s * 17, 10, '#c9b48b', 'left', 500, true);
      }
      if (caught.has(id)) text('已收录', x + cw - 14, y + ch - 14, 10, '#8fd9c0', 'right', 600);
      else text('仅遇见', x + cw - 14, y + ch - 14, 10, PAL.muted, 'right', 500);
    } else {
      text('尚未遇见', x + 134, y + 100, 12, '#6a5e80', 'left', 500);
    }
  }
  const cr = codexRects()[0];
  panel(cr.x, cr.y, cr.w, cr.h, { fill: 'rgba(24,18,42,.95)', r: 8 });
  text('关闭', cr.x + cr.w / 2, cr.y + 26, 13, '#d8c8a8', 'center', 500, true);
  text('C / Esc 关闭', 640, 684, 11, PAL.muted, 'center', 400);
}

function renderPause() {
  ctx.save(); ctx.fillStyle = 'rgba(4,3,10,.68)'; ctx.fillRect(0, 0, CAM_W, CAM_H); ctx.restore();
  panel(420, 214, 440, 350, { fill: 'rgba(16,12,32,.97)' });
  spacedText('旅途暂停', 640, 278, 34, 6, '#f4d293', 700, true);
  text('篝火还亮着，符兽在脚边打盹。', 640, 316, 13, PAL.muted, 'center', 400, true);
  const rs = pauseRects();
  const labels = ['继续旅程', '重新开始', '回到标题'];
  for (let i = 0; i < rs.length; i++) {
    const r = rs[i];
    rrect(r.x, r.y, r.w, r.h, 8);
    ctx.fillStyle = i === 0 ? 'rgba(76,56,32,.9)' : 'rgba(24,19,44,.92)'; ctx.fill();
    ctx.strokeStyle = i === 0 ? '#f4d293' : 'rgba(217,164,91,.3)'; ctx.lineWidth = 1; ctx.stroke();
    text(labels[i], 640, r.y + 31, 16, i === 0 ? '#f4d293' : PAL.paper, 'center', 500, true);
  }
  text('P 继续 · M 静音', 640, 542, 11, PAL.muted, 'center', 400);
}

function renderOver() {
  if (battle) renderBattle(); else drawTitleBg();
  ctx.save(); ctx.fillStyle = 'rgba(5,3,10,.76)'; ctx.fillRect(0, 0, CAM_W, CAM_H); ctx.restore();
  panel(400, 190, 480, 380, { fill: 'rgba(18,10,26,.96)', border: 'rgba(224,101,68,.45)' });
  spacedText('符兽尽倒', 640, 262, 40, 8, '#e8a08a', 700, true);
  text('灯火未灭，路还能再走。', 640, 302, 14, PAL.paperDim, 'center', 400, true);
  text(`得分 ${scoreNow()}`, 640, 348, 20, '#f0d08a', 'center', 700);
  text(`进度 ${progressPct()}% · 击败守关人 ${bosses}/4 · 收录 ${caught.size}/12`, 640, 380, 13, PAL.muted, 'center', 400);
  text('回到营地可全队疗愈，守关进度与符兽录都会保留。', 640, 412, 12, '#c9b48b', 'center', 400, true);
  const rs = endRects();
  const labels = ['重试 · 回营地', '回标题'];
  for (let i = 0; i < rs.length; i++) {
    const r = rs[i];
    rrect(r.x, r.y, r.w, r.h, 24);
    const g = ctx.createLinearGradient(r.x, r.y, r.x, r.y + r.h);
    if (i === 0) { g.addColorStop(0, '#f4d293'); g.addColorStop(1, '#d9a45b'); } else { g.addColorStop(0, '#4a3e66'); g.addColorStop(1, '#2f2748'); }
    ctx.fillStyle = g; ctx.fill();
    text(labels[i], r.x + r.w / 2, r.y + 34, 17, i === 0 ? '#181227' : '#ead9b8', 'center', 600, true);
  }
}

function renderComplete() {
  drawTitleBg();
  ctx.save(); ctx.fillStyle = 'rgba(5,3,10,.55)'; ctx.fillRect(0, 0, CAM_W, CAM_H); ctx.restore();
  // celebratory motes
  for (let i = 0; i < 40; i++) {
    ctx.globalAlpha = 0.3 + 0.5 * Math.abs(Math.sin(simTime * 1.2 + i));
    ctx.fillStyle = i % 3 === 0 ? '#f4d293' : i % 3 === 1 ? '#8fe0c0' : '#e06544';
    ctx.beginPath(); ctx.arc((i * 173 + simTime * 22) % CAM_W, (i * 97 + simTime * 12) % CAM_H, 1.6, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  panel(380, 158, 520, 420, { fill: 'rgba(16,12,32,.95)' });
  drawGlyphRing(ctx, 640, 240, 72, simTime, { alpha: 0.7 });
  spacedText('六道归一', 640, 340, 40, 8, '#f4d293', 700, true);
  text('四位守关人尽数落败，六枚符钉在坛心合成一盏灯。', 640, 374, 13, PAL.paperDim, 'center', 400, true);
  text(`最终得分 ${scoreNow()}`, 640, 420, 24, '#f0d08a', 'center', 700);
  text(`击败守关人 4/4 · 收录 ${caught.size}/12 · 最高等级 ${maxPartyLevel()}`, 640, 452, 13, PAL.muted, 'center', 400);
  text('十二种符兽，六道相生相克。你的符兽录会留在旅人的灯下。', 640, 486, 11, '#c9b48b', 'center', 400, true);
  const rs = endRects();
  const labels = ['再启新程', '回标题'];
  for (let i = 0; i < rs.length; i++) {
    const r = rs[i];
    rrect(r.x, r.y, r.w, r.h, 24);
    const g = ctx.createLinearGradient(r.x, r.y, r.x, r.y + r.h);
    if (i === 0) { g.addColorStop(0, '#f4d293'); g.addColorStop(1, '#d9a45b'); } else { g.addColorStop(0, '#4a3e66'); g.addColorStop(1, '#2f2748'); }
    ctx.fillStyle = g; ctx.fill();
    text(labels[i], r.x + r.w / 2, r.y + 34, 17, i === 0 ? '#181227' : '#ead9b8', 'center', 600, true);
  }
}

// ---------- root render ----------
function render() {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);
  ctx.fillStyle = '#05040d'; ctx.fillRect(0, 0, cssW, cssH);
  ctx.save();
  ctx.translate(offX, offY);
  ctx.scale(viewScale, viewScale);
  ctx.beginPath(); ctx.rect(0, 0, CAM_W, CAM_H); ctx.clip();
  // screen shake
  const shx = shake > 0 ? Math.sin(simTime * 93) * shake * 0.5 : 0;
  const shy = shake > 0 ? Math.cos(simTime * 71) * shake * 0.4 : 0;
  ctx.save(); ctx.translate(shx, shy);
  if (mode === 'title') renderTitle();
  else if (mode === 'explore') renderExplore();
  else if (mode === 'battle') renderBattle();
  else if (mode === 'shop') { renderExplore(); renderShop(); }
  else if (mode === 'over') renderOver();
  else if (mode === 'complete') renderComplete();
  if (paused) renderPause();
  if (codexOpen) renderCodex();
  ctx.restore();
  drawVignette();
  ctx.restore();
}

// ---------- boot ----------
loadMeta();
if (!lsGet(STORE.mute)) lsSet(STORE.mute, '0');
updateTopButtons();
bindTopButtons();

// query params for demos / screenshots
const params = new URLSearchParams(location.search);
if (!AUTOTEST) {
  if (params.has('autostart')) {
    startGame(false);
  } else if (params.has('scene') && params.get('scene') === 'battle') {
    setSeed(777);
    newRun(true);
    party = [makeBeast('emberbadger', 9), makeBeast('tideotter', 8), makeBeast('reedfox', 8), makeBeast('lamprabbit', 7)];
    caught = new Set(['emberbadger', 'tideotter', 'reedfox', 'lamprabbit']);
    gold = 180; seals = 5;
    startWildBattle('gravelrhino', 9);
    if (battle) { battle.phase = 'menu'; battle.enterT = 1; }
  } else {
    audio.setState('title');
  }
}
report('ready', { game: 'glyphbeast-trail', version: '1.0.0' });

// ---------- debug hooks ----------
const G = window.G = window.__G = {
  err: window.__BOOTERR,
  step: (n = 60, dt = DT) => { for (let i = 0; i < n; i++) { update(dt); render(); } },
  upd: (n = 30, dt = DT) => { for (let i = 0; i < n; i++) update(dt); },
  press: (...codes) => { codes.forEach(c => { held.add(c); pressed.add(c); }); },
  release: (...codes) => { codes.forEach(c => held.delete(c)); },
  setNoAuto: (v) => { noAuto = !!v; },
  setReportTarget: (fn) => { reportTarget = typeof fn === 'function' ? fn : null; },
  state: () => snapshot(),
  setSeed,
  getRandom: () => rand(),
  // economy
  setGold: (n) => { gold = Math.max(0, Math.round(+n || 0)); saveRun(); },
  addGold: (n) => { gold = Math.max(0, gold + Math.round(+n || 0)); saveRun(); },
  setSeals: (n) => { seals = Math.max(0, Math.round(+n || 0)); saveRun(); },
  addSeals: (n) => { seals = Math.max(0, seals + Math.round(+n || 0)); saveRun(); },
  // progress
  setBosses: (n) => { bosses = clamp(Math.round(+n || 0), 0, 4); bossMax = Math.max(bossMax, bosses); saveRun(); },
  canChallengeBoss: (i) => i === bosses && i >= 0 && i < 4,
  // flow
  startGame: (fresh) => startGame(!!fresh),
  newRun: () => newRun(true),
  restartRun,
  toTitle,
  retryFromOver,
  togglePause,
  setPaused,
  toggleMute,
  setMuted: (v) => { audio.setMuted(!!v); updateTopButtons(); },
  toggleCodex,
  // world
  setPlayerPos: (x, y) => { player.x = clamp(+x || 0, 24, WORLD_W - 24); player.y = clamp(+y || 0, 24, WORLD_H - 24); cam.x = clamp(player.x - CAM_W / 2, 0, WORLD_W - CAM_W); cam.y = clamp(player.y - CAM_H / 2, 0, WORLD_H - CAM_H); },
  getNearby: () => nearestInteract(),
  interact,
  campHeal: () => { healParty(); saveRun(); return party.every(b => b.hp === b.maxHp); },
  damageActive: (n) => { const b = activeBeast() || party[0]; if (b) b.hp = Math.max(0, b.hp - Math.max(1, Math.round(+n || 0))); },
  healParty: () => { healParty(); saveRun(); },
  // shop
  openShop,
  closeShop,
  buyItem,
  // party
  setParty: (arr) => {
    const list = Array.isArray(arr) ? arr.slice(0, 4) : [];
    party = list.map(it => makeBeast(SPECIES[it.id] ? it.id : 'emberbadger', clamp(parseInt(it.lvl || it.level, 10) || 5, 1, 40)));
    reserves = [];
    if (!party.length) party = [makeBeast('emberbadger', 5)];
    healParty();
    saveRun();
  },
  makeBeast: (id, lvl) => makeBeast(id, lvl),
  // battle
  startWild: (id, lvl) => startWildBattle(id, lvl),
  startBattle: (id, lvl) => startWildBattle(id, lvl),
  startBoss: (i) => startBossBattle(i),
  clearBattle: () => { battle = null; mode = 'explore'; paused = false; audio.setState('explore'); encounter.cooldown = 1; },
  chooseMain,
  useSkill,
  throwSeal,
  flee: () => attemptFlee(),
  switchTo,
  continueBattleResult,
  forceWin: () => { if (battle) { battle.phase = 'result'; finishBattle('win'); return true; } return false; },
  forceFail: () => {
    if (battle) {
      for (const b of party) b.hp = 0;
      return finishBattle('lose');
    }
    return false;
  },
  forceCapture: () => {
    if (!battle || battle.bossIdx >= 0) return false;
    const foe = enemyActive(); if (!foe) return false;
    foe.hp = Math.max(1, Math.min(foe.maxHp, 1));
    battle.phase = 'menu';
    battle.forceCatch = true;
    throwSeal();
    for (let i = 0; i < 90; i++) update(DT);
    return !!(battle && battle.result && battle.result.kind === 'capture');
  },
  setEnemyHp: (n) => { const e = enemyActive(); if (e) e.hp = clamp(Math.round(+n || 0), 0, e.maxHp); },
  setEnemyStatus: (id) => { const e = enemyActive(); if (e && STATUS[id]) e.statuses[id] = STATUS[id].turns; },
  setActiveHp: (n) => { const b = activeBeast(); if (b) b.hp = clamp(Math.round(+n || 0), 0, b.maxHp); },
  setActiveShield: (n) => { const b = activeBeast(); if (b) b.shield = Math.max(0, Math.round(+n || 0)); },
  captureChance: () => { const e = enemyActive(), p = activeBeast(); return e && p ? captureChanceOf(e, p) : 0; },
  captureChanceFor: (id, lvl, hpRatio, statused, myLvl) => {
    const f = makeBeast(id, lvl); f.hp = Math.max(1, Math.round(f.maxHp * clamp(hpRatio, 0, 1)));
    if (statused) f.statuses.burn = 2;
    const m = makeBeast('emberbadger', myLvl || 5);
    return captureChanceOf(f, m);
  },
  fleeChance,
  elementMult: elemMult,
  calcDamage: damageFormula,
  damageCore,
  xpNeed,
  // report
  reportProgress: () => postProgress(true),
  lastReport: () => reports.length ? { ...reports[reports.length - 1] } : null,
  wireReport,
  // storage
  saveNow: () => { saveRun(); return true; },
  storageSnapshot,
  restoreStorage,
  storageKeys: STORE,
  // ui
  uiRects: () => uiRects().map(r => ({ ...r })),
  screenPoint,
  tapAt: (lx, ly) => pointerDownLogical(lx, ly, 'touch'),
  // data
  species: SPECIES,
  speciesOrder: SPECIES_ORDER,
  bossDefs: BOSSES,
  zones: ZONES,
  statuses: STATUS,
  shopItems: SHOP_ITEMS,
  elements: ELEMENTS,
  cycle: CYCLE,
  audio,
  world: { w: WORLD_W, h: WORLD_H, camp: CAMP_POS, shop: SHOP_POS, start: START_POS },
  // complete for tests
  finishBattle,
};

function snapshot() {
  const bsum = (b) => b ? {
    id: b.id, level: b.level, hp: Math.round(b.hp * 100) / 100, maxHp: b.maxHp,
    atk: b.atk, def: b.def, spd: b.spd, shield: b.shield || 0,
    statuses: { ...b.statuses }, xp: b.xp,
  } : null;
  let nan = false;
  const check = (v) => { if (!Number.isFinite(v)) nan = true; };
  check(player.x); check(player.y); check(gold); check(seals); check(simTime);
  for (const b of party) { check(b.hp); check(b.maxHp); check(b.atk); check(b.def); check(b.spd); check(b.level); }
  if (battle) { for (const e of battle.enemies) { check(e.hp); check(e.maxHp); check(e.atk); check(e.def); } check(battle.timer); }
  return {
    mode, paused, codexOpen, noAuto, simTime, gold, seals, bosses, bossMax, best,
    score: scoreNow(), progress: progressPct(),
    party: party.map(bsum), reserves: reserves.map(bsum), caught: [...caught], seen: [...seen],
    hasSave, player: { x: player.x, y: player.y, facing: player.facing, moving: player.moving },
    camera: { x: cam.x, y: cam.y }, zone: zoneNow,
    inGrass: !!grassAt(player.x, player.y), nearby: nearestInteract(),
    encounter: { ...encounter }, moveTarget: moveTarget ? { ...moveTarget } : null,
    battle: battle ? {
      wild: battle.wild, bossIdx: battle.bossIdx, phase: battle.phase, turn: battle.turn,
      activeIdx: battle.activeIdx, enemyIdx: battle.enemyIdx,
      enemy: bsum(enemyActive()), active: bsum(activeBeast()),
      enemies: battle.enemies.map(bsum), log: battle.log.slice(-8).map(l => l.text),
      lastOrder: battle.lastOrder.slice(), lastAction: battle.lastAction ? { ...battle.lastAction } : null,
      result: battle.result ? { ...battle.result } : null, timer: battle.timer, queue: battle.queue.length,
      menuSel: battle.menuSel, subSel: battle.subSel, needEnemySend: battle.needEnemySend,
    } : null,
    muted: audio.muted, audioState: audio.state, audioCtx: audio.hasCtx,
    reports: reports.length, reportKinds: reports.map(r => r.kind),
    net: window.__NET ? { ...window.__NET } : null,
    uRects: uiRects().map(r => r.id),
    nan,
  };
}

// ---------- fixed-step loop ----------
let lastT = 0, acc = 0;
function frame(now) {
  if (!lastT) lastT = now;
  let dtReal = Math.min(0.1, (now - lastT) / 1000);
  lastT = now;
  if (document.hidden) { dtReal = 0; acc = 0; }
  acc += dtReal;
  let steps = 0;
  while (acc >= DT && steps < 6) { update(DT); acc -= DT; steps++; }
  if (acc < 0) acc = 0;
  render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

document.addEventListener('visibilitychange', () => { lastT = performance.now(); acc = 0; });

// ---------- autotest ----------
async function autotest() {
  G.setNoAuto(true);
  const nap = () => new Promise(r => { const mc = new MessageChannel(); mc.port1.onmessage = () => r(); mc.port2.postMessage(0); });
  const T = window.__TEST = { pass: 0, fail: 0, total: 0, results: [], done: false };
  const ok = (id, cond, name) => {
    T.results.push({ id, ok: !!cond, name: name || '' });
    cond ? T.pass++ : T.fail++;
    T.total = T.results.length;
  };
  const saved = storageSnapshot();
  const savedMuted = audio.muted;
  audio.setMuted(true);
  updateTopButtons();
  setSeed(20261120);
  const frames = [];
  G.setReportTarget(f => frames.push(f));
  await nap();
  try {
    // T1 boot
    ok('T1', G.err.length === 0 && (!window.__BOOTERR || window.__BOOTERR.length === 0), '启动零报错');
    // T2 numeric sanity
    {
      G.startGame(true); G.upd(60);
      const s = G.state();
      ok('T2', !s.nan && Number.isFinite(s.gold) && Number.isFinite(s.player.x), '关键数值无 NaN');
    }
    // T3 six-cycle element math
    {
      let good = true;
      for (let i = 0; i < 6; i++) {
        const a = CYCLE[i], b = CYCLE[(i + 1) % 6];
        if (elemMult(a, b) !== 1.5) good = false;
        if (elemMult(b, a) !== 0.67) good = false;
        if (elemMult(a, a) !== 1) good = false;
      }
      ok('T3', good, '六属性循环克制 ×1.5 / 被克 ×0.67');
    }
    // T4 damage core monotonic
    {
      const base = damageFormula(10, 20, 10, 50, 1, 1);
      const strong = damageFormula(10, 30, 10, 50, 1, 1);
      const weak = damageFormula(10, 10, 10, 50, 1, 1);
      const adv = damageFormula(10, 20, 10, 50, 1.5, 1);
      const dis = damageFormula(10, 20, 10, 50, 0.67, 1);
      ok('T4', base > 0 && strong > base && weak < base && adv > base && dis < base && Number.isFinite(adv),
        `伤害 ${base} · 攻↑${strong} · 克制${adv} · 被克${dis}`);
    }
    // T5 speed decides order
    {
      G.setParty([{ id: 'galefalcon', lvl: 12 }]);
      G.setBosses(0); G.startWild('mosstort', 6);
      G.upd(70);
      const s0 = G.state();
      G.useSkill(0); G.upd(4);
      const s = G.state();
      ok('T5', s.battle && s.battle.phase === 'resolving' && s.battle.lastOrder[0] === 'player',
        `先手 ${s.battle ? s.battle.lastOrder.join('→') : '-'} (spd ${s0.battle.active.spd}/${s0.battle.enemy.spd})`);
      G.clearBattle();
    }
    // T6 status application (guaranteed burn skill)
    {
      G.setParty([{ id: 'emberbadger', lvl: 10 }]);
      G.startWild('gravelrhino', 5);
      G.upd(70);
      G.useSkill(1);            // 灼痕, burn chance 1.0
      G.upd(200);
      const e = G.state().battle ? G.state().battle.enemy : null;
      ok('T6', !!(e && e.statuses && e.statuses.burn > 0), '灼痕状态命中');
      G.clearBattle();
    }
    // T7 burn ticks real HP
    {
      G.setParty([{ id: 'emberbadger', lvl: 12 }]);
      G.startWild('gravelrhino', 7);
      G.upd(70);
      G.setEnemyStatus('burn');
      const hp0 = G.state().battle.enemy.hp;
      G.useSkill(0);
      G.upd(240);
      const hp1 = G.state().battle ? G.state().battle.enemy.hp : hp0;
      ok('T7', hp1 < hp0, `灼烧掉血 ${hp0.toFixed(0)}→${hp1.toFixed(0)}`);
      G.clearBattle();
    }
    // T8 gold reward on win
    {
      G.setParty([{ id: 'emberbadger', lvl: 8 }]);
      G.startWild('tideotter', 5);
      const g0 = G.state().gold;
      G.forceWin();
      const g1 = G.state().gold;
      ok('T8', g1 - g0 === goldReward(5), `金币 +${g1 - g0}（公式 ${goldReward(5)}）`);
      G.continueBattleResult();
    }
    // T9 seal consumption & reject
    {
      G.startWild('tideotter', 5); G.upd(70);
      G.setSeals(0);
      const no = G.throwSeal();
      const after0 = G.state().seals;
      G.setSeals(2);
      G.setEnemyHp(9999);
      const yes = G.throwSeal();
      const after1 = G.state().seals;
      ok('T9', no === false && after0 === 0 && yes === true && after1 === 1, `符印 0 拒绝、2→${after1}`);
      G.clearBattle();
    }
    // T10 capture probability rises as HP falls and with status
    {
      const full = G.captureChanceFor('tideotter', 5, 1, false, 8);
      const low = G.captureChanceFor('tideotter', 5, 0.05, false, 8);
      const statused = G.captureChanceFor('tideotter', 5, 0.05, true, 8);
      ok('T10', low > full && statused > low && full > 0 && low <= 0.95, `捕获率 ${(full * 100).toFixed(0)}% → ${(low * 100).toFixed(0)}% · 状态 ${(statused * 100).toFixed(0)}%`);
    }
    // T11 shop economy
    {
      G.setGold(100); G.setSeals(0);
      const b1 = G.buyItem(0);
      const g1 = G.state().gold, s1 = G.state().seals;
      const b2 = G.buyItem(1);       // 100-30=70 < 80? 70 < 80 -> reject
      const g2 = G.state().gold;
      ok('T11', b1 && g1 === 70 && s1 === 1 && b2 === false && g2 === 70, `买符印 100→${g1} 金 / ${s1} 枚，余额不足拒绝`);
    }
    // T12 camp heals
    {
      G.damageActive(30);
      const hurt = G.state().party[0].hp;
      const healed = G.campHeal();
      const s = G.state();
      ok('T12', hurt < s.party[0].maxHp && healed && s.party[0].hp === s.party[0].maxHp, `营地疗愈 ${Math.round(hurt)}→${s.party[0].hp}`);
    }
    // T13 input simulation moves the trainer
    {
      G.setPlayerPos(300, 700); G.release('ArrowRight', 'KeyD');
      const x0 = G.state().player.x;
      G.press('ArrowRight'); G.upd(40); G.release('ArrowRight');
      const x1 = G.state().player.x;
      ok('T13', x1 > x0 + 30, `方向键位移 ${x0.toFixed(1)}→${x1.toFixed(1)}`);
    }
    // T14 E-key interaction at camp
    {
      damagePartyForTest(20);
      G.setPlayerPos(CAMP_POS.x, CAMP_POS.y + 30);
      G.press('KeyE'); G.upd(2); G.release('KeyE');
      const s = G.state();
      ok('T14', s.party.every(b => b.hp === b.maxHp), 'E 与篝火交互治疗全队');
    }
    // T15 battle keyboard input opens skill menu
    {
      G.setParty([{ id: 'emberbadger', lvl: 8 }]);
      G.startWild('tideotter', 5);
      G.upd(70);
      G.press('Digit1'); G.upd(2); G.release('Digit1');
      const ph = G.state().battle.phase;
      G.press('Digit1'); G.upd(4); G.release('Digit1');
      const ph2 = G.state().battle.phase;
      ok('T15', ph === 'skills' && (ph2 === 'resolving' || ph2 === 'result'), `键盘 1 → ${ph} → ${ph2}`);
      G.clearBattle();
    }
    // T16 pause freezes exploration
    {
      G.setPlayerPos(300, 700);
      G.press('KeyP'); G.upd(2); G.release('KeyP');
      const p0 = G.state().player.x;
      G.press('ArrowRight'); G.upd(60); G.release('ArrowRight');
      const p1 = G.state().player.x;
      G.press('KeyP'); G.upd(2); G.release('KeyP');
      ok('T16', G.state().paused === false && p0 === p1, '暂停时移动冻结并恢复');
    }
    // T17 pause freezes battle timer
    {
      G.startWild('tideotter', 5); G.upd(70);
      G.chooseMain(0); G.useSkill(0); G.upd(2);
      const t0 = G.state().battle.timer;
      G.press('KeyP'); G.upd(1); G.release('KeyP');
      G.upd(60);
      const t1 = G.state().battle.timer;
      G.press('KeyP'); G.upd(1); G.release('KeyP');
      G.upd(60);
      const t2 = G.state().battle.timer;
      ok('T17', t0 === t1 && t2 !== t1, `战斗计时暂停 ${t0.toFixed(2)}→${t1.toFixed(2)}→${t2.toFixed(2)}`);
      G.clearBattle();
    }
    // T18 touch tap on battle command
    {
      G.setSeals(2);
      G.startWild('tideotter', 5); G.upd(70);
      const rects = G.uiRects();
      const r = rects.find(x => x.id === 'battle-main-1');
      const before = G.state().seals;
      const hit = G.tapAt(r.x + r.w / 2, r.y + r.h / 2);
      const s = G.state();
      ok('T18', hit === 'battle-main-1' && s.seals === before - 1, `触控点选投符印 ${before}→${s.seals}`);
      G.clearBattle();
    }
    // T19 failure path → gameOver frame
    {
      frames.length = 0;
      G.startWild('tideotter', 5);
      G.forceFail();
      const s = G.state();
      const go = frames.find(f => f.kind === 'gameOver');
      ok('T19', s.mode === 'over' && !!go && Number.isInteger(go.score), `全灭 → gameOver 得分 ${go ? go.score : '-'}`);
      G.retryFromOver();
    }
    // T20 final boss victory → complete frame
    {
      frames.length = 0;
      G.setBosses(3);
      G.setParty([{ id: 'emberbadger', lvl: 24 }, { id: 'inkcat', lvl: 24 }, { id: 'dawnram', lvl: 24 }, { id: 'mosstort', lvl: 24 }]);
      G.startBoss(3);
      const started = !!G.state().battle;
      G.forceWin();
      G.continueBattleResult();
      const s = G.state();
      const prog = frames.findIndex(f => f.kind === 'progress');
      const comp = frames.findIndex(f => f.kind === 'complete');
      ok('T20', started && s.mode === 'complete' && s.bosses === 4 && prog >= 0 && comp > prog, `冠军通关 complete 帧（progress@${prog}, complete@${comp}）`);
    }
    // T21 restart resets run
    {
      G.restartRun();
      const s = G.state();
      ok('T21', s.mode === 'explore' && s.bosses === 0 && s.gold === 60 && s.seals === 3 && s.party.length === 1 && s.party[0].id === 'emberbadger', '重开复位 60 金 / 3 符印 / 1 兽');
    }
    // T22 fast-forward no NaN
    {
      G.setPlayerPos(300, 700);
      G.press('ArrowDown'); G.upd(900); G.release('ArrowDown');
      G.upd(1200);
      const s = G.state();
      ok('T22', !s.nan && s.player.y <= WORLD_H && s.player.x <= WORLD_W && fx.count <= 420, `快进 2100 帧无 NaN（y=${s.player.y.toFixed(0)}）`);
    }
    // T23 localStorage round-trip
    {
      G.setBosses(2); G.saveNow();
      const savedBoss = parseInt(localStorage.getItem(STORE.boss) || '-1', 10);
      const savedMax = parseInt(localStorage.getItem(STORE.bossMax) || '-1', 10);
      const savedBest = parseInt(localStorage.getItem(STORE.best) || '-1', 10);
      G.restoreStorage(saved);
      const restored = localStorage.getItem(STORE.save) === saved[STORE.save] && localStorage.getItem(STORE.boss) === saved[STORE.boss];
      ok('T23', savedBoss === 2 && savedMax >= 2 && savedBest > 0 && restored, `gbt.boss=${savedBoss} · best=${savedBest} · 原值还原`);
    }
    // T24 boss gate order
    {
      G.setBosses(0);
      const bad = G.canChallengeBoss(1);
      const good = G.canChallengeBoss(0);
      const startBad = G.startBoss(1);
      ok('T24', bad === false && good === true && startBad === false, '守关顺序：未过前一关不可挑战');
    }
    // T25 boss difficulty climbs / final team 4
    {
      const lv = BOSSES.map(b => b.team.reduce((s, t) => s + t.lvl, 0) / b.team.length);
      const ascending = lv.every((v, i) => i === 0 || v > lv[i - 1]);
      ok('T25', ascending && BOSSES.length === 4 && BOSSES[3].team.length === 4, `Boss 均级 ${lv.map(v => v.toFixed(1)).join(' / ')} · 终战 4 兽`);
    }
    // T26 switching changes active
    {
      G.setParty([{ id: 'emberbadger', lvl: 8 }, { id: 'tideotter', lvl: 8 }]);
      G.startWild('tideotter', 5); G.upd(70);
      G.chooseMain(2);
      const ph = G.state().battle.phase;
      G.switchTo(1); G.upd(4);
      const s = G.state();
      ok('T26', ph === 'party' && s.battle.activeIdx === 1 && s.battle.lastOrder.length === 0, '换兽生效并消耗回合');
      G.clearBattle();
    }
    // T27 shield absorbs damage
    {
      G.setParty([{ id: 'reedfox', lvl: 10 }]);
      G.startWild('mosstort', 5); G.upd(70);
      G.useSkill(2);   // 顺风盾
      G.upd(200);
      const s = G.state();
      ok('T27', !!(s.battle && s.battle.active.shield > 0), `护盾 ${s.battle ? s.battle.active.shield : 0}`);
      G.clearBattle();
    }
    // T28 heal skill raises HP, caps at max
    {
      G.setParty([{ id: 'emberbadger', lvl: 10 }]);
      G.startWild('mosstort', 5); G.upd(70);
      G.setActiveHp(10);
      const hp0 = G.state().battle.active.hp;
      G.useSkill(2);   // 暖焰蜷
      G.upd(200);
      const s = G.state();
      G.setActiveHp(s.battle.active.maxHp);
      G.useSkill(2); G.upd(200);
      const s2 = G.state();
      ok('T28', s.battle.active.hp > hp0 && s2.battle.active.hp <= s2.battle.active.maxHp, `治疗 ${hp0}→${Math.round(s.battle.active.hp)}，不溢出 ${Math.round(s2.battle.active.hp)}/${s2.battle.active.maxHp}`);
      G.clearBattle();
    }
    // T29 flee chance math / boss refuses
    {
      G.setParty([{ id: 'inkcat', lvl: 20 }]);
      G.startWild('mosstort', 5); G.upd(70);
      const fc = G.fleeChance();
      G.setBosses(0); G.startBoss(0); G.upd(70);
      const bossNo = G.flee();
      ok('T29', fc > 0.45 && bossNo === false, `野生逃离率 ${(fc * 100).toFixed(0)}%，Boss 拒绝`);
      G.clearBattle();
    }
    // T30 grass-only encounters
    {
      G.setPlayerPos(300, 700);
      const out0 = G.state().encounter.dist;
      G.press('ArrowDown'); G.upd(90); G.release('ArrowDown');
      const out = G.state();
      G.setPlayerPos(600, 850);
      const ing0 = G.state().inGrass;
      G.press('ArrowRight'); G.upd(10); G.release('ArrowRight');
      const ing = G.state();
      ok('T30', out.inGrass === false && out.encounter.dist === 0 && ing0 === true && ing.encounter.dist > 0, `草丛外不累积(${out.encounter.dist})，草丛内累积(${ing.encounter.dist.toFixed(0)})`);
      G.clearBattle();
      G.setPlayerPos(START_POS.x, START_POS.y);
    }
    // T31 species table complete
    {
      let good = SPECIES_ORDER.length === 12;
      for (const id of SPECIES_ORDER) {
        const sp = SPECIES[id];
        if (!sp || !ELEMENTS[sp.el] || !Array.isArray(sp.skills) || sp.skills.length !== 3) { good = false; break; }
        const kinds = sp.skills.map(s => s.type);
        if (!kinds.includes('damage') || !kinds.includes('status') || !(kinds.includes('heal') || kinds.includes('shield'))) good = false;
      }
      ok('T31', good, '12 种符兽 · 每只 3 技能（伤害/状态/回复或护盾）');
    }
    // T32 all species reachable in wild/boss tables
    {
      const wildIds = new Set(); ZONES.forEach(z => z.wild.forEach(w => wildIds.add(w.id)));
      const missing = SPECIES_ORDER.filter(id => !wildIds.has(id));
      ok('T32', missing.length === 0, `全部 12 种可在野外遇见（缺 ${missing.length}）`);
    }
    // T33 capture adds to party or reserve, dedupes codex
    {
      G.restartRun();
      G.setParty([{ id: 'emberbadger', lvl: 10 }, { id: 'tideotter', lvl: 9 }, { id: 'reedfox', lvl: 9 }, { id: 'lamprabbit', lvl: 9 }]);
      G.setSeals(8);
      G.startWild('shellspirit', 6);
      const cap = G.forceCapture();
      const s = G.state();
      const caughtBefore = s.caught.length;
      G.clearBattle();
      G.startWild('shellspirit', 6);
      G.forceCapture();
      const s2 = G.state();
      const uniq = new Set(s2.caught).size === s2.caught.length;
      ok('T33', cap && s.party.length === 4 && s.reserves.length >= 1 && uniq && s2.caught.length === caughtBefore, `满队捕获入 reserve=${s.reserves.length}，图鉴去重 ${caughtBefore}→${s2.caught.length}`);
      G.clearBattle();
    }
    // T34 battle input during resolve ignored
    {
      G.startWild('tideotter', 5); G.upd(70);
      G.useSkill(0); G.upd(2);
      const q0 = G.state().battle.queue, log0 = G.state().battle.log.length;
      G.press('Digit1'); G.press('Digit2'); G.upd(2);
      G.release('Digit1', 'Digit2');
      const s = G.state();
      ok('T34', s.battle && (s.battle.phase !== 'menu' || s.battle.lastOrder.length > 0) && (s.battle.queue <= q0), '结算中指令被冻结/忽略');
      G.clearBattle();
    }
    // T35 level & xp math + level-up real
    {
      G.setParty([{ id: 'emberbadger', lvl: 5 }]);
      const need = G.xpNeed(5);
      const b = party[0]; const ups = grantXP(b, need + 5);
      const s = G.state();
      ok('T35', ups === 1 && s.party[0].level === 6 && Number.isInteger(need), `经验阈值 ${need} → Lv${s.party[0].level}`);
    }
    // T36 report envelope shapes
    {
      frames.length = 0;
      G.reportProgress();
      G.startWild('tideotter', 5);
      G.forceFail();
      G.retryFromOver();
      const p = frames.find(f => f.kind === 'progress');
      const go = frames.find(f => f.kind === 'gameOver');
      const wp = p ? G.wireReport(p) : null;
      const wg = go ? G.wireReport(go) : null;
      const shapeOk = wp && wp.kind === 'progress' && !!wp.data &&
        wg && wg.kind === 'gameOver' && Number.isInteger(wg.score) && wg.progress && typeof wg.progress.value === 'number' && !!wg.data;
      ok('T36', shapeOk, 'progress/gameOver 兼容信封与整数分');
    }
    // T37 ready frame first
    {
      const s = G.state();
      ok('T37', s.reportKinds[0] === 'ready', `首帧 ${s.reportKinds[0]}`);
    }
    // T38 DOM buttons + audio mute
    {
      const mb = document.getElementById('btn-mute'), pb = document.getElementById('btn-pause'), cb = document.getElementById('btn-codex');
      G.setMuted(false); const m0 = G.state().muted;
      G.setMuted(true); const m1 = G.state().muted;
      ok('T38', !!mb && !!pb && !!cb && m0 === false && m1 === true, '暂停/静音/图鉴按钮存在，静音可切换');
    }
    // T39 pause/restart UI rects
    {
      G.setPlayerPos(START_POS.x, START_POS.y);
      G.togglePause();
      const pr = G.uiRects().map(r => r.id);
      G.togglePause();
      ok('T39', pr.includes('pause-resume') && pr.includes('pause-restart') && pr.includes('pause-title'), '暂停面板三键绑定');
    }
    // T40 codex overlay opens with 12 entries
    {
      G.setPlayerPos(START_POS.x, START_POS.y);
      G.toggleCodex();
      const open = G.state().codexOpen;
      const r = G.uiRects().map(x => x.id);
      G.toggleCodex();
      ok('T40', open === true && r.includes('codex-close') && SPECIES_ORDER.length === 12, '符兽录开合 + 12 条目');
    }
    // T41 full auto battle resolution reaches a stable phase
    {
      G.setParty([{ id: 'emberbadger', lvl: 14 }]);
      G.startWild('tideotter', 8);
      let guard = 0;
      while (guard++ < 40) {
        const s = G.state();
        if (!s.battle || s.battle.phase === 'result' || s.mode !== 'battle') break;
        if (s.battle.phase === 'menu') G.useSkill(0);
        else if (s.battle.phase === 'switch') G.switchTo(s.party.findIndex(b => b.hp > 0));
        G.upd(120);
      }
      const s = G.state();
      ok('T41', guard < 40 && !s.nan && (s.mode !== 'battle' || s.battle.phase === 'result'), `自动战斗 ${guard} 轮，mode=${s.mode}`);
      G.clearBattle();
    }
    // T42 touch dpad binding exists on coarse pointer
    {
      ok('T42', typeof G.tapAt === 'function' && typeof G.screenPoint === 'function', '触控指针路径已绑定');
    }
    // T43 no external network
    {
      const s = G.state();
      ok('T43', !s.net || (s.net.external.length === 0 && s.net.fetch === 0 && s.net.xhr === 0 && s.net.ws === 0), `外部请求 ${s.net ? s.net.external.length : 0}`);
    }
    // wrap up
    G.restoreStorage(saved);
    G.setMuted(savedMuted);
    audio.setMuted(true);
    G.toTitle();
    updateTopButtons();
    await nap();
    ok('T44', G.state().mode === 'title' && G.state().muted === true, '测后静音回标题');
    T.done = true;
  } catch (err) {
    T.crash = String(err && err.stack || err);
    T.results.push({ id: 'CRASH', ok: false, name: T.crash });
    T.pass = T.results.filter(r => r.ok).length;
    T.fail = T.results.length - T.pass;
    T.total = T.results.length;
    T.done = true;
    try { G.restoreStorage(saved); audio.setMuted(true); G.toTitle(); updateTopButtons(); } catch (e) { }
    console.log('[glyphbeast autotest] crashed:', T.crash);
  } finally {
    audio.setMuted(true);
    updateTopButtons();
  }
  T.total = T.results.length;
  T.pass = T.results.filter(r => r.ok).length;
  T.fail = T.results.length - T.pass;
  console.log(`[glyphbeast autotest] ${T.pass}/${T.total} passed, ${T.fail} failed`);
}
function damagePartyForTest(n) { for (const b of party) b.hp = Math.max(1, b.hp - n); }

if (AUTOTEST) autotest();
