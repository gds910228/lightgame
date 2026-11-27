// Card Duel Arena 斗牌竞技场 — 1v1 turn-based card battle.
// Vanilla ES modules, procedural Canvas art + DOM cards, synthesized WebAudio,
// deterministic rules/AI/selfplay, site report bridge, G hooks and ?autotest=1.

import {
  RULES, CLASSES, CARD_LIBRARY, CARD_MAP, CLASS_DECKS,
  CAT_LABEL, CAT_COLOR, classCounter, counterRelation,
  createBattle, playCard as rulesPlayCard, endTurn as rulesEndTurn,
  chooseAction, drawCards, totalCards, playableIndices,
  runSelfplay as engineSelfplay, runBenchmark as engineBenchmark,
} from './logic.js';
import { makeAudio } from './audio.js';

const DT = 1 / 60;
const AUTOTEST = new URLSearchParams(location.search).has('autotest');
const URLP = new URLSearchParams(location.search);
const SITE = 'card-duel-arena';
const W = 1600, H = 900;

const KEY = {
  wins: 'cda.wins', losses: 'cda.losses', best: 'cda.best', mute: 'cda.mute',
};
const PERSIST_PREFIX = 'cda.';

const AI_TIERS = {
  easy: {
    id: 'easy', num: 1, name: '易', policy: 'random legal',
    label: '随机合法', desc: '在可支付的牌中随机选择，偶尔提前结束回合。',
  },
  medium: {
    id: 'medium', num: 2, name: '中', policy: 'greedy value',
    label: '贪心价值', desc: '逐张评估伤害、护甲、抽牌与增益，选择当前价值最高的一张。',
  },
  hard: {
    id: 'hard', num: 3, name: '难', policy: 'one-turn lookahead',
    label: '一回合前瞻', desc: '模拟自己剩余的回合和对手一整回合的贪心反击，再决定出牌。',
  },
};
const DIFF_ORDER = ['easy', 'medium', 'hard'];

function diffKey(v) {
  if (typeof v === 'number' || /^[1-3]$/.test(String(v))) {
    return DIFF_ORDER[Math.max(0, Math.min(2, (parseInt(v, 10) || 2) - 1))];
  }
  return AI_TIERS[v] ? v : 'medium';
}
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function finite(v, d = 0) { return Number.isFinite(v) ? v : d; }
function lerp(a, b, t) { return a + (b - a) * t; }
function roundRectPath(c, x, y, w, h, r) {
  const q = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  c.beginPath();
  c.moveTo(x + q, y);
  c.lineTo(x + w - q, y); c.quadraticCurveTo(x + w, y, x + w, y + q);
  c.lineTo(x + w, y + h - q); c.quadraticCurveTo(x + w, y + h, x + w - q, y + h);
  c.lineTo(x + q, y + h); c.quadraticCurveTo(x, y + h, x, y + h - q);
  c.lineTo(x, y + q); c.quadraticCurveTo(x, y, x + q, y);
  c.closePath();
}
function $id(id) { return document.getElementById(id); }

// ==================== persistence ====================
function readInt(key, d = 0) {
  try { const v = parseInt(localStorage.getItem(key) || '', 10); return Number.isFinite(v) ? v : d; } catch (e) { return d; }
}
let records = {
  wins: Math.max(0, readInt(KEY.wins, 0)),
  losses: Math.max(0, readInt(KEY.losses, 0)),
  best: Math.max(0, readInt(KEY.best, 0)),
};
let muted = false;
try { muted = localStorage.getItem(KEY.mute) === '1'; } catch (e) { muted = false; }
const audio = makeAudio();
audio.setMuted(muted);

function saveRecords() {
  try {
    localStorage.setItem(KEY.wins, String(records.wins));
    localStorage.setItem(KEY.losses, String(records.losses));
    localStorage.setItem(KEY.best, String(records.best));
  } catch (e) { }
}
function reloadRecords() {
  records = {
    wins: Math.max(0, readInt(KEY.wins, 0)),
    losses: Math.max(0, readInt(KEY.losses, 0)),
    best: Math.max(0, readInt(KEY.best, 0)),
  };
  updateTitleUI();
  updateUI();
  return { ...records };
}
function persistMute() {
  try { localStorage.setItem(KEY.mute, muted ? '1' : '0'); } catch (e) { }
}

// ==================== mutable state ====================
let screen = 'title';          // title | playing | over
let mode = 'ai';               // ai | local
let diff = 'medium';
let battle = null;
let paused = false, noAuto = false;
let privacyPending = false;
let selected = -1;
let aiTimer = 0;
let gameSerial = 0;
let lastStart = { mode: 'ai', diff: 'medium', p1: 'blade', p2: 'ranger' };
let uiClasses = { p1: 'blade', p2: 'ranger' };
let reportTarget = null;
const reports = [];
let lastReportProgress = -1, lastReportScore = -1;
let nanFlag = false;

const fx = {
  hitstopT: 0, shakeT: 0, shakeDur: .18, shakeAmp: 0,
  flashT: 0, lunge: { p1: 0, p2: 0 }, flash: { p1: 0, p2: 0 },
  particles: [], floaters: [], projectiles: [],
};
let animT = 0;

// ==================== DOM ====================
const cv = $id('stage');
const ctx = cv.getContext('2d');
const titleEl = $id('title');
const gameuiEl = $id('gameui');
const privacyEl = $id('privacy');
const pauseEl = $id('pause');
const endEl = $id('end');
const handEl = $id('hand');
const toastEl = $id('toast');
const muteBtn = $id('mutebtn');
const pauseBtn = $id('pausebtn');
const homeBtn = $id('homebtn');
const endTurnBtn = $id('endturn');
const playBtn = $id('playbtn');

let viewScale = 1, viewOX = 0, viewOY = 0, DPR = 1;
function resize() {
  DPR = Math.min(2, window.devicePixelRatio || 1);
  cv.width = Math.max(1, Math.round(window.innerWidth * DPR));
  cv.height = Math.max(1, Math.round(window.innerHeight * DPR));
  viewScale = Math.min(window.innerWidth / W, window.innerHeight / H);
  viewOX = (window.innerWidth - W * viewScale) / 2;
  viewOY = (window.innerHeight - H * viewScale) / 2;
}
window.addEventListener('resize', resize);

// ==================== tiny helpers ====================
function toast(msg, ms = 1500) {
  if (!toastEl) return;
  toastEl.textContent = String(msg);
  toastEl.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toastEl.classList.remove('show'), ms);
}
function player(side) { return battle ? (side === 'p2' ? battle.p2 : battle.p1) : null; }
function other(side) { return side === 'p2' ? 'p1' : 'p2'; }
function classOf(side) { return battle ? (side === 'p2' ? battle.p2class : battle.p1class) : uiClasses[side]; }
function humanTurn() {
  if (!battle || screen !== 'playing' || paused || privacyPending || battle.over) return false;
  return mode === 'local' || battle.active === 'p1';
}
function activeHumanSide() {
  if (!battle) return null;
  if (mode === 'local') return battle.active;
  return 'p1';
}
function scoreInt() {
  if (!battle) return 0;
  const p1 = battle.p1;
  const won = battle.over && battle.winner === 'p1';
  let s = p1.damageDealt * 12 + Math.max(0, p1.hp - battle.p2.hp) * 10;
  if (battle.over) {
    if (won) s += 1000 + Math.max(0, 40 - battle.turn) * 5 + p1.hp * 8;
    else s = Math.max(1, s);
  }
  return Math.max(0, Math.round(s));
}
function progressInt() {
  if (!battle) return 0;
  if (battle.over) return battle.winner === 'p1' ? 100 : Math.min(99, Math.max(1, Math.round(battle.p1.damageDealt / 30 * 86)));
  return Math.min(99, Math.round(
    (battle.p1.damageDealt / Math.max(1, battle.p2.maxHp)) * 64 +
    ((battle.p2.maxHp - battle.p2.hp) / Math.max(1, battle.p2.maxHp)) * 24 +
    Math.min(10, battle.turn / 3)
  ));
}
function scanNan() {
  if (!battle) return false;
  const vals = [
    battle.p1.hp, battle.p1.block, battle.p1.energy, battle.p1.maxEnergy,
    battle.p2.hp, battle.p2.block, battle.p2.energy, battle.p2.maxEnergy,
    battle.turn,
  ];
  if (vals.some(v => !Number.isFinite(v))) return true;
  for (const p of [battle.p1, battle.p2]) {
    for (const v of [p.burn, p.burnT, p.nextAtk, p.weaken, p.thorns, p.thornsT, p.damageDealt]) {
      if (!Number.isFinite(v)) return true;
    }
  }
  return false;
}

// ==================== site report ====================
function toWireReport(frame) {
  const score = Number.isFinite(frame.score) ? Math.round(frame.score) : undefined;
  if (frame.kind === 'progress') return { kind: 'progress', data: { ...frame } };
  if (frame.kind === 'event') return { kind: 'event', event: String(frame.event || frame.tag || 'event'), data: { ...frame } };
  if (frame.kind === 'gameOver') return { kind: 'gameOver', score, progress: { value: Number.isFinite(frame.progress) ? frame.progress : 0 }, data: { ...frame } };
  if (frame.kind === 'complete') return { kind: 'complete', score };
  return frame;
}
function report(kind, payload = {}) {
  const frame = { kind, ...payload };
  reports.push(frame);
  try {
    if (reportTarget) reportTarget(frame);
    else if (window.parent !== window) {
      window.parent.postMessage({ source: 'lightgame', type: 'lightgame:report', payload: toWireReport(frame) }, '*');
      if (kind === 'ready') window.parent.postMessage({ source: 'lightgame', type: 'lightgame:ready', gameId: SITE, v: 1 }, '*');
    }
  } catch (e) { }
}
report('ready', { game: SITE });
function reportProgress(force = false) {
  if (!battle) return;
  const p = progressInt(), s = scoreInt();
  if (!force && p === lastReportProgress && s === lastReportScore) return;
  lastReportProgress = p; lastReportScore = s;
  report('progress', {
    score: s, progress: p, turn: battle.turn,
    p1Hp: battle.p1.hp, p2Hp: battle.p2.hp,
    p1Class: battle.p1class, p2Class: battle.p2class,
  });
}

// ==================== procedural art ====================
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function drawClassEmblem(canvas, cls) {
  if (!canvas || !canvas.getContext) return;
  const c = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  c.clearRect(0, 0, w, h);
  const col = CLASSES[cls].color;
  const g = c.createRadialGradient(w * .42, h * .35, 2, w / 2, h / 2, w * .52);
  g.addColorStop(0, 'rgba(255,255,255,.14)');
  g.addColorStop(.38, col + '44');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = g;
  c.beginPath(); c.arc(w / 2, h / 2, w * .47, 0, Math.PI * 2); c.fill();
  c.strokeStyle = col + 'aa'; c.lineWidth = 1.2;
  c.beginPath(); c.arc(w / 2, h / 2, w * .3, 0, Math.PI * 2); c.stroke();
  c.save();
  c.translate(w / 2, h / 2);
  c.strokeStyle = '#fff6dd'; c.fillStyle = col;
  c.lineCap = 'round'; c.lineJoin = 'round';
  if (cls === 'blade') {
    c.rotate(-.68);
    c.lineWidth = 3;
    c.beginPath(); c.moveTo(0, 13); c.lineTo(0, -15); c.stroke();
    c.lineWidth = 2;
    c.beginPath(); c.moveTo(-7, 6); c.lineTo(7, 6); c.stroke();
    c.beginPath(); c.moveTo(0, 13); c.lineTo(-4, 19); c.lineTo(4, 19); c.closePath(); c.fill();
  } else if (cls === 'ranger') {
    c.lineWidth = 2.3;
    c.beginPath(); c.arc(-3, 0, 13, -1.15, 1.15); c.stroke();
    c.strokeStyle = col;
    c.beginPath(); c.moveTo(-11, 5); c.lineTo(13, 0); c.lineTo(-11, -5); c.stroke();
    c.beginPath(); c.moveTo(4, 0); c.lineTo(12, -5); c.lineTo(12, 5); c.closePath(); c.fill();
  } else {
    c.lineWidth = 2;
    c.beginPath(); c.moveTo(0, 20); c.lineTo(0, -14); c.stroke();
    c.fillStyle = col;
    c.beginPath(); c.arc(0, -17, 6, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#fff6dd'; c.lineWidth = 1;
    c.beginPath(); c.arc(0, -17, 3, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = col + 'cc'; c.lineWidth = 1.5;
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2 + .4;
      c.beginPath(); c.arc(Math.cos(a) * 16, Math.sin(a) * 16, 2.2, 0, Math.PI * 2); c.stroke();
    }
  }
  c.restore();
}

function drawCardArt(canvas, card) {
  if (!canvas || !card) return;
  canvas.width = 280; canvas.height = 140;
  const c = canvas.getContext('2d');
  const w = 280, h = 140;
  const main = CAT_COLOR[card.cat] || '#d8c8a6';
  const bg = c.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, '#0b1118'); bg.addColorStop(.55, '#111c24'); bg.addColorStop(1, '#070b10');
  c.fillStyle = bg; c.fillRect(0, 0, w, h);
  const gl = c.createRadialGradient(w * .5, h * .52, 4, w * .5, h * .52, w * .62);
  gl.addColorStop(0, main + '55'); gl.addColorStop(.44, main + '16'); gl.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = gl; c.fillRect(0, 0, w, h);

  c.save();
  c.translate(w / 2, h / 2 + 2);
  c.strokeStyle = main; c.fillStyle = main; c.lineCap = 'round'; c.lineJoin = 'round';
  const icon = card.icon;
  if (icon === 'slash') {
    c.lineWidth = 4; c.strokeStyle = '#ffe3b1';
    c.beginPath(); c.arc(-4, 2, 42, -2.45, -.25); c.stroke();
    c.lineWidth = 8; c.strokeStyle = main + '66';
    c.beginPath(); c.arc(-4, 2, 42, -2.35, -.36); c.stroke();
    c.lineWidth = 5; c.strokeStyle = '#f4f0df';
    c.beginPath(); c.moveTo(-25, 28); c.lineTo(22, -25); c.stroke();
  } else if (icon === 'hammer') {
    c.fillStyle = '#d7e4e6';
    c.save(); c.rotate(.62);
    c.fillRect(-6, -8, 12, 46);
    c.fillStyle = main;
    c.beginPath(); c.moveTo(-26, -26); c.lineTo(26, -26); c.lineTo(18, -5); c.lineTo(-18, -5); c.closePath(); c.fill();
    c.strokeStyle = '#fff2d0'; c.lineWidth = 2; c.stroke();
    c.restore();
    c.strokeStyle = '#ffffff66'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(-35, 26); c.lineTo(25, -35); c.stroke();
  } else if (icon === 'twin') {
    c.lineWidth = 4; c.strokeStyle = '#f6ead0';
    c.save(); c.rotate(.75); c.beginPath(); c.moveTo(-28, 28); c.lineTo(25, -28); c.stroke(); c.restore();
    c.save(); c.rotate(-.75); c.beginPath(); c.moveTo(-28, 28); c.lineTo(25, -28); c.stroke(); c.restore();
    c.strokeStyle = main; c.lineWidth = 2;
    c.beginPath(); c.moveTo(-34, -22); c.lineTo(-12, 28); c.stroke();
    c.beginPath(); c.moveTo(34, -22); c.lineTo(12, 28); c.stroke();
  } else if (icon === 'flame') {
    c.fillStyle = main;
    c.beginPath(); c.moveTo(0, 48); c.bezierCurveTo(-40, 24, -21, -8, -4, -44);
    c.bezierCurveTo(-1, -17, 23, -24, 15, -5); c.bezierCurveTo(32, -9, 31, 28, 0, 48); c.fill();
    c.fillStyle = '#ffe49b';
    c.beginPath(); c.moveTo(2, 38); c.bezierCurveTo(-15, 24, -3, 7, 5, -9); c.bezierCurveTo(17, 8, 20, 26, 2, 38); c.fill();
    c.strokeStyle = main + '77'; c.lineWidth = 3;
    c.beginPath(); c.arc(0, 8, 52, .4, Math.PI * 1.6); c.stroke();
  } else if (icon === 'bolt') {
    c.fillStyle = '#ffe9a8';
    c.beginPath(); c.moveTo(7, -48); c.lineTo(-25, 3); c.lineTo(-2, 3); c.lineTo(-10, 47); c.lineTo(29, -9); c.lineTo(5, -9); c.closePath(); c.fill();
    c.strokeStyle = main; c.lineWidth = 4;
    c.beginPath(); c.arc(0, 0, 48, .5, 2.4); c.stroke();
    c.beginPath(); c.arc(0, 0, 48, 3.7, 5.6); c.stroke();
  } else if (icon === 'dagger') {
    c.rotate(-.7);
    c.fillStyle = '#e9f4ef';
    c.beginPath(); c.moveTo(0, -43); c.lineTo(11, 11); c.lineTo(0, 22); c.lineTo(-11, 11); c.closePath(); c.fill();
    c.fillStyle = main;
    c.fillRect(-18, 20, 36, 7);
    c.fillStyle = '#d4b170';
    c.fillRect(-5, 27, 10, 21);
    c.strokeStyle = '#00000055'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(0, -36); c.lineTo(0, 17); c.stroke();
  } else if (icon === 'exec') {
    c.strokeStyle = '#ffe9b4'; c.lineWidth = 4;
    c.beginPath(); c.arc(0, 0, 36, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = main + '99'; c.lineWidth = 2;
    c.beginPath(); c.arc(0, 0, 46, .3, 5.5); c.stroke();
    c.lineWidth = 5; c.strokeStyle = '#f4f2e4';
    c.beginPath(); c.moveTo(-23, 28); c.lineTo(23, -28); c.stroke();
    c.beginPath(); c.moveTo(-27, 8); c.lineTo(-8, 8); c.stroke();
  } else if (icon === 'arrow') {
    c.strokeStyle = main; c.lineWidth = 3;
    c.beginPath(); c.arc(-20, 0, 42, -1.13, 1.13); c.stroke();
    c.strokeStyle = '#f4f2e1'; c.lineWidth = 2.5;
    c.beginPath(); c.moveTo(-42, 0); c.lineTo(38, 0); c.stroke();
    c.fillStyle = '#f4f2e1';
    c.beginPath(); c.moveTo(42, 0); c.lineTo(25, -10); c.lineTo(25, 10); c.closePath(); c.fill();
    c.strokeStyle = main + '88'; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(-42, 0); c.lineTo(-30, -10); c.moveTo(-42, 0); c.lineTo(-30, 10); c.stroke();
  } else if (icon === 'shield') {
    c.fillStyle = '#dff9ef';
    c.beginPath(); c.moveTo(0, -46); c.lineTo(35, -28); c.lineTo(28, 20); c.lineTo(0, 45); c.lineTo(-28, 20); c.lineTo(-35, -28); c.closePath(); c.fill();
    c.fillStyle = main;
    c.beginPath(); c.moveTo(0, -34); c.lineTo(22, -23); c.lineTo(17, 12); c.lineTo(0, 30); c.lineTo(-17, 12); c.lineTo(-22, -23); c.closePath(); c.fill();
    c.strokeStyle = '#ffffffbb'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(0, -20); c.lineTo(0, 18); c.moveTo(-13, -1); c.lineTo(13, -1); c.stroke();
  } else if (icon === 'wall') {
    c.fillStyle = '#b7d9d3';
    for (let row = 0; row < 4; row++) {
      const y = -35 + row * 20;
      for (let i = -2; i <= 2; i++) {
        const x = i * 22 + (row % 2 ? 11 : 0);
        c.fillRect(x - 10, y, 20, 16);
      }
    }
    c.strokeStyle = main; c.lineWidth = 3;
    c.strokeRect(-47, -39, 94, 82);
    c.strokeStyle = '#ffffff44'; c.lineWidth = 1;
    c.strokeRect(-41, -33, 82, 70);
  } else if (icon === 'riposte') {
    c.fillStyle = '#d9f5ea';
    c.beginPath(); c.moveTo(0, -38); c.lineTo(27, -23); c.lineTo(20, 16); c.lineTo(0, 36); c.lineTo(-20, 16); c.lineTo(-27, -23); c.closePath(); c.fill();
    c.strokeStyle = main; c.lineWidth = 8;
    c.beginPath(); c.moveTo(-28, 34); c.lineTo(30, -34); c.stroke();
    c.strokeStyle = '#fff4d4'; c.lineWidth = 3;
    c.beginPath(); c.moveTo(-32, 30); c.lineTo(24, -30); c.stroke();
  } else if (icon === 'wind') {
    c.strokeStyle = main; c.lineWidth = 3;
    for (let i = 0; i < 3; i++) {
      c.beginPath();
      c.arc(0, 8, 17 + i * 12, -.9 + i * .2, Math.PI * 1.1 + i * .15);
      c.stroke();
    }
    c.fillStyle = '#dfffee';
    for (let i = 0; i < 5; i++) {
      const a = i / 5 * Math.PI * 2;
      c.beginPath(); c.arc(Math.cos(a) * 44, Math.sin(a) * 32 + 7, 3, 0, Math.PI * 2); c.fill();
    }
  } else if (icon === 'thorn') {
    c.strokeStyle = main; c.lineWidth = 5;
    c.beginPath(); c.moveTo(-40, 38); c.bezierCurveTo(-18, 4, 3, 21, 31, -34); c.stroke();
    c.fillStyle = '#d9ffe9';
    for (let i = 0; i < 6; i++) {
      const t = i / 5;
      const x = lerp(-40, 31, t), y = lerp(38, -34, t) + Math.sin(t * 6) * 7;
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + (i % 2 ? 10 : -10), y - 12); c.lineTo(x + (i % 2 ? 2 : -2), y + 2); c.closePath(); c.fill();
    }
    c.strokeStyle = main + '77'; c.lineWidth = 2;
    c.beginPath(); c.arc(0, 0, 48, 0, Math.PI * 2); c.stroke();
  } else if (icon === 'prayer') {
    c.strokeStyle = '#ffecae'; c.lineWidth = 4;
    c.beginPath(); c.arc(0, -3, 29, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = main; c.lineWidth = 3;
    c.beginPath(); c.arc(0, -3, 38, .3, 2.8); c.stroke();
    c.beginPath(); c.arc(0, -3, 38, 3.5, 5.9); c.stroke();
    c.fillStyle = '#effff8';
    c.fillRect(-4, -23, 8, 38); c.fillRect(-18, -7, 36, 8);
    c.strokeStyle = '#ffffff88'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(-41, 32); c.lineTo(0, 12); c.lineTo(41, 32); c.stroke();
  } else if (icon === 'arcane') {
    c.strokeStyle = main; c.lineWidth = 2;
    c.beginPath(); c.arc(0, 0, 32, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.arc(0, 0, 44, .3, 5.8); c.stroke();
    c.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2 - Math.PI / 2;
      const x = Math.cos(a) * 30, y = Math.sin(a) * 30;
      if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
    }
    c.closePath(); c.stroke();
    c.fillStyle = '#f4e9ff';
    c.beginPath(); c.arc(0, 0, 7, 0, Math.PI * 2); c.fill();
    c.fillStyle = main;
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2;
      c.beginPath(); c.arc(Math.cos(a) * 49, Math.sin(a) * 49, 2, 0, Math.PI * 2); c.fill();
    }
  } else if (icon === 'fireball') {
    c.fillStyle = main;
    c.beginPath(); c.arc(0, 0, 31, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#fff0b8';
    c.beginPath(); c.arc(-5, -5, 17, 0, Math.PI * 2); c.fill();
    for (let i = 0; i < 7; i++) {
      const a = i / 7 * Math.PI * 2 + .3;
      c.strokeStyle = main + 'aa'; c.lineWidth = 4;
      c.beginPath(); c.moveTo(Math.cos(a) * 34, Math.sin(a) * 34); c.lineTo(Math.cos(a) * 52, Math.sin(a) * 52); c.stroke();
    }
    c.strokeStyle = '#ffffff55'; c.lineWidth = 2;
    c.beginPath(); c.arc(0, 0, 41, .4, 5.5); c.stroke();
  } else if (icon === 'bless') {
    c.strokeStyle = main; c.lineWidth = 3;
    for (let i = 0; i < 3; i++) {
      const x = -32 + i * 32, h = 15 + i * 9;
      c.beginPath(); c.moveTo(x, 32); c.lineTo(x, 32 - h); c.lineTo(x - 9, 32 - h + 9); c.moveTo(x, 32 - h); c.lineTo(x + 9, 32 - h + 9); c.stroke();
    }
    c.fillStyle = '#ffe9a4';
    c.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = i / 10 * Math.PI * 2 - Math.PI / 2, r = i % 2 ? 9 : 22;
      const x = Math.cos(a) * r, y = Math.sin(a) * r - 20;
      if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
    }
    c.closePath(); c.fill();
    c.strokeStyle = main + '88'; c.lineWidth = 2;
    c.beginPath(); c.arc(0, 0, 49, 0, Math.PI * 2); c.stroke();
  } else if (icon === 'surge') {
    c.strokeStyle = main; c.lineWidth = 4;
    c.beginPath();
    for (let i = 0; i < 44; i++) {
      const t = i / 43, a = t * Math.PI * 4.2, r = 4 + t * 43;
      const x = Math.cos(a) * r, y = Math.sin(a) * r * .72;
      if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
    }
    c.stroke();
    c.strokeStyle = '#f0e5ff'; c.lineWidth = 2;
    c.beginPath();
    for (let i = 0; i < 40; i++) {
      const t = i / 39, a = t * Math.PI * 4.2 + Math.PI, r = 4 + t * 38;
      const x = Math.cos(a) * r, y = Math.sin(a) * r * .72;
      if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
    }
    c.stroke();
    c.fillStyle = '#fff4ca';
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2;
      c.beginPath(); c.arc(Math.cos(a) * 48, Math.sin(a) * 34, 2.4, 0, Math.PI * 2); c.fill();
    }
  } else if (icon === 'curse') {
    c.strokeStyle = main; c.lineWidth = 2.5;
    c.beginPath(); c.arc(0, 4, 42, 0, Math.PI * 2); c.stroke();
    c.fillStyle = '#1a1024';
    c.beginPath(); c.arc(0, 4, 34, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#f3e8ff';
    c.beginPath(); c.moveTo(-35, 0); c.quadraticCurveTo(0, -30, 35, 0); c.quadraticCurveTo(0, 30, -35, 0); c.stroke();
    c.fillStyle = main;
    c.beginPath(); c.arc(0, 4, 12, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#120a1a';
    c.beginPath(); c.arc(0, 4, 5, 0, Math.PI * 2); c.fill();
    c.strokeStyle = main + '88'; c.lineWidth = 3;
    c.beginPath(); c.arc(0, 4, 52, .4, 2.7); c.stroke();
  } else if (icon === 'purify') {
    c.fillStyle = '#e9fff7';
    c.beginPath(); c.moveTo(0, -45); c.bezierCurveTo(25, -17, 35, 2, 0, 37); c.bezierCurveTo(-35, 2, -25, -17, 0, -45); c.fill();
    c.fillStyle = main;
    c.beginPath(); c.moveTo(0, -28); c.bezierCurveTo(14, -11, 19, 2, 0, 23); c.bezierCurveTo(-19, 2, -14, -11, 0, -28); c.fill();
    c.strokeStyle = '#ffffff99'; c.lineWidth = 2;
    c.beginPath(); c.arc(0, 0, 47, .2, 3.2); c.stroke();
    c.beginPath(); c.arc(0, 0, 47, 3.4, 6.1); c.stroke();
    for (let i = 0; i < 4; i++) {
      const a = i / 4 * Math.PI * 2 + .7;
      c.beginPath(); c.arc(Math.cos(a) * 30, Math.sin(a) * 30, 2, 0, Math.PI * 2); c.fill();
    }
  } else {
    c.strokeStyle = main; c.lineWidth = 3;
    c.beginPath(); c.arc(0, 0, 35, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.moveTo(-25, 0); c.lineTo(25, 0); c.moveTo(0, -25); c.lineTo(0, 25); c.stroke();
  }
  c.restore();

  c.strokeStyle = main + '33'; c.lineWidth = 1;
  c.strokeRect(8, 8, w - 16, h - 16);
  c.fillStyle = main + '55';
  c.font = '700 10px "Microsoft YaHei",sans-serif';
  c.textAlign = 'left'; c.textBaseline = 'top';
  c.fillText(CAT_LABEL[card.cat] || '', 14, 13);
}

const bgCv = document.createElement('canvas');
bgCv.width = W; bgCv.height = H;
function buildBackground() {
  const c = bgCv.getContext('2d');
  const rnd = seeded(0xC0FFEE);
  let g = c.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#071014'); g.addColorStop(.38, '#0c1a20');
  g.addColorStop(.72, '#0a1419'); g.addColorStop(1, '#030608');
  c.fillStyle = g; c.fillRect(0, 0, W, H);

  // far aurora / jade haze
  const aur = c.createRadialGradient(W * .48, H * .38, 20, W * .48, H * .38, W * .62);
  aur.addColorStop(0, 'rgba(55,151,130,.15)');
  aur.addColorStop(.34, 'rgba(39,84,100,.09)');
  aur.addColorStop(.72, 'rgba(76,60,125,.05)');
  aur.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = aur; c.fillRect(0, 0, W, H);

  // faint stars / dust
  for (let i = 0; i < 240; i++) {
    const x = rnd() * W, y = rnd() * H * .78, r = .4 + rnd() * 1.5;
    c.fillStyle = `rgba(${170 + rnd() * 80 | 0},${220 + rnd() * 35 | 0},${210 + rnd() * 40 | 0},${.025 + rnd() * .14})`;
    c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
  }
  // long paper fibres
  for (let i = 0; i < 48; i++) {
    const x = rnd() * W, y = rnd() * H, len = 30 + rnd() * 120;
    c.strokeStyle = `rgba(${rnd() < .5 ? '94,224,188' : '231,189,114'},${.018 + rnd() * .035})`;
    c.lineWidth = .7;
    c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + len * .45, y + (rnd() - .5) * 26, x + len, y + (rnd() - .5) * 10); c.stroke();
  }

  // central arcane table
  c.save();
  c.translate(W / 2, H * .63);
  // table shadow
  const sh = c.createRadialGradient(0, 90, 40, 0, 70, 760);
  sh.addColorStop(0, 'rgba(0,0,0,.55)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = sh;
  c.beginPath(); c.ellipse(0, 80, 760, 190, 0, 0, Math.PI * 2); c.fill();
  // table top
  const table = c.createLinearGradient(0, -110, 0, 160);
  table.addColorStop(0, 'rgba(20,55,53,.62)');
  table.addColorStop(.35, 'rgba(12,34,35,.78)');
  table.addColorStop(1, 'rgba(4,12,14,.9)');
  c.fillStyle = table;
  c.beginPath(); c.ellipse(0, 5, 710, 178, 0, 0, Math.PI * 2); c.fill();
  c.strokeStyle = 'rgba(231,189,114,.23)'; c.lineWidth = 2;
  c.beginPath(); c.ellipse(0, 5, 710, 178, 0, 0, Math.PI * 2); c.stroke();
  c.strokeStyle = 'rgba(79,224,188,.13)'; c.lineWidth = 1.2;
  c.beginPath(); c.ellipse(0, 5, 646, 156, 0, 0, Math.PI * 2); c.stroke();
  // radial rune spokes
  c.strokeStyle = 'rgba(79,224,188,.105)'; c.lineWidth = 1;
  for (let i = 0; i < 24; i++) {
    const a = i / 24 * Math.PI * 2;
    c.beginPath(); c.moveTo(Math.cos(a) * 350, Math.sin(a) * 86 + 5); c.lineTo(Math.cos(a) * 650, Math.sin(a) * 158 + 5); c.stroke();
  }
  // inner sigil
  c.strokeStyle = 'rgba(231,189,114,.18)'; c.lineWidth = 1.2;
  c.beginPath(); c.ellipse(0, 5, 290, 74, 0, 0, Math.PI * 2); c.stroke();
  c.beginPath(); c.ellipse(0, 5, 214, 54, 0, 0, Math.PI * 2); c.stroke();
  c.strokeStyle = 'rgba(79,224,188,.16)';
  c.beginPath(); c.ellipse(0, 5, 350, 88, 0, .2, 2.9); c.stroke();
  c.beginPath(); c.ellipse(0, 5, 350, 88, 0, 3.4, 6.0); c.stroke();
  // centre diamond
  c.fillStyle = 'rgba(231,189,114,.11)';
  c.beginPath(); c.moveTo(0, -24); c.lineTo(48, 5); c.lineTo(0, 34); c.lineTo(-48, 5); c.closePath(); c.fill();
  c.strokeStyle = 'rgba(255,232,174,.30)'; c.lineWidth = 1.2; c.stroke();
  c.restore();

  // floating cards in the air
  const cards = [
    [-450, 205, -.24, 44, 62, 'rgba(231,189,114,.11)'],
    [430, 150, .17, 58, 82, 'rgba(79,224,188,.11)'],
    [-250, 90, .34, 34, 48, 'rgba(154,134,255,.11)'],
    [330, 330, -.31, 32, 44, 'rgba(240,122,77,.10)'],
    [530, 360, .25, 40, 55, 'rgba(231,189,114,.075)'],
  ];
  for (const [x, y, rot, cw, ch, col] of cards) {
    c.save();
    c.translate(W / 2 + x, y); c.rotate(rot);
    c.fillStyle = 'rgba(7,12,16,.55)';
    roundRectPath(c, -cw / 2, -ch / 2, cw, ch, 5); c.fill();
    c.strokeStyle = col; c.lineWidth = 1.2;
    roundRectPath(c, -cw / 2, -ch / 2, cw, ch, 5); c.stroke();
    c.strokeStyle = col; c.lineWidth = .8;
    c.beginPath(); c.moveTo(-cw * .28, -ch * .1); c.lineTo(cw * .28, -ch * .1);
    c.moveTo(-cw * .2, ch * .05); c.lineTo(cw * .2, ch * .05); c.stroke();
    c.restore();
  }

  // top / bottom vignette
  const top = c.createLinearGradient(0, 0, 0, 220);
  top.addColorStop(0, 'rgba(2,5,7,.8)'); top.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = top; c.fillRect(0, 0, W, 220);
  const bot = c.createLinearGradient(0, 630, 0, H);
  bot.addColorStop(0, 'rgba(0,0,0,0)'); bot.addColorStop(1, 'rgba(0,0,0,.78)');
  c.fillStyle = bot; c.fillRect(0, 630, W, H - 630);

  // side pillars
  for (const sx of [0, W]) {
    const side = c.createLinearGradient(sx === 0 ? 0 : W, 0, sx === 0 ? 130 : W - 130, 0);
    side.addColorStop(0, 'rgba(2,5,7,.86)'); side.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = side; c.fillRect(sx === 0 ? 0 : W - 130, 0, 130, H);
  }
}

// ==================== visual FX ====================
function burst(x, y, color, n = 12, power = 220) {
  if (fx.particles.length > 220) fx.particles.splice(0, 30);
  for (let i = 0; i < n; i++) {
    const a = (Math.random() - .5) * Math.PI * 1.7 - Math.PI / 2;
    const sp = power * (.3 + Math.random() * .8);
    fx.particles.push({
      x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 35,
      life: .25 + Math.random() * .4, max: .65,
      size: 1.2 + Math.random() * 2.8, color, grav: 460, drag: .6,
      rot: Math.random() * 7, vr: (Math.random() - .5) * 7,
    });
  }
}
function ringFx(x, y, color, size = 18, grow = 190, life = .35) {
  fx.particles.push({ x, y, vx: 0, vy: 0, life, max: life, size, grow, color, grav: 0, drag: 0, ring: true });
}
function floater(side, text, color, big = false) {
  const x = sideX(side) + (Math.random() - .5) * 30;
  fx.floaters.push({ x, y: H * .40 + (Math.random() - .5) * 18, text, color, life: 1.05, max: 1.05, big });
}
function sideX(side) { return side === 'p1' ? W * .285 : W * .715; }
function sideSelfX(side) { return side === 'p1' ? W * .16 : W * .84; }

function spawnProjectile(side, card) {
  const fromX = sideSelfX(side) + (Math.random() - .5) * 30;
  const toX = sideX(side) + (Math.random() - .5) * 18;
  const toY = H * .47;
  fx.projectiles.push({
    x: fromX, y: H * .76, sx: fromX, sy: H * .76, tx: toX, ty: toY,
    t: 0, dur: .24, card, side, rot: (Math.random() - .5) * .5,
  });
}
function applyEvents(events, actorSide) {
  if (!Array.isArray(events)) return;
  for (const ev of events) {
    if (ev.type === 'play') {
      const card = CARD_MAP[ev.card];
      spawnProjectile(ev.by || actorSide, card);
      fx.lunge[ev.by || actorSide] = .28;
      if (card && card.cat === 'defense') fx.lunge[ev.by || actorSide] = .12;
    } else if (ev.type === 'damage') {
      const side = ev.target;
      const col = ev.counter > 1 ? '#ffe3a3' : (side === 'p1' ? '#ffb08d' : '#d2c2ff');
      floater(side, `-${ev.hpLoss}`, col, ev.hpLoss >= 8);
      if (ev.blocked > 0) floater(side, `护甲 -${ev.blocked}`, '#8ff5dc', false);
      if (ev.counter > 1) floater(side, '克制 ×1.15', '#ffe3a3', false);
      burst(sideX(side), H * .43, col, ev.hpLoss >= 8 ? 26 : 16, 250 + ev.hpLoss * 8);
      ringFx(sideX(side), H * .45, col, 18, 210, .35);
      fx.flash[side] = .18;
      fx.shakeT = .18; fx.shakeDur = .18; fx.shakeAmp = Math.min(9, 3 + ev.hpLoss * .35);
      fx.hitstopT = .07;
      audio.play('attack', Math.min(1, ev.hpLoss / 10));
    } else if (ev.type === 'block') {
      floater(ev.by, `+${ev.amount} 护甲`, '#9ffbe4', false);
      burst(sideX(ev.by), H * .44, '#8ff5dc', 10, 150);
      audio.play('block');
    } else if (ev.type === 'heal') {
      floater(ev.by, `+${ev.amount} 生命`, '#a7ffd9', false);
      burst(sideX(ev.by), H * .43, '#8ff5dc', 12, 120);
      audio.play('heal');
    } else if (ev.type === 'energy') {
      floater(ev.by, `+${ev.amount} 能量`, '#ffe4a0', false);
      audio.play('energy');
    } else if (ev.type === 'draw') {
      if (ev.count > 0) floater(ev.by, `抽 ${ev.count} 张`, '#bfe8ff', false);
      audio.play('draw');
    } else if (ev.type === 'applyBurn') {
      floater(ev.target, `灼烧 ${ev.amount}`, '#ffa17d', false);
      audio.play('burn');
    } else if (ev.type === 'burn') {
      floater(ev.target, `灼烧 -${ev.amount}`, '#ff9a73', false);
      fx.flash[ev.target] = .12;
      burst(sideX(ev.target), H * .44, '#ff9a73', 12, 160);
      audio.play('burn');
    } else if (ev.type === 'buff' || ev.type === 'thornsUp') {
      floater(ev.by, ev.type === 'buff' ? `强化 +${ev.amount}` : `荆棘 ${ev.amount}`, '#ffe2a0', false);
      burst(sideX(ev.by), H * .44, '#ffe2a0', 8, 110);
    } else if (ev.type === 'weaken') {
      floater(ev.target, `虚弱 -${ev.amount}`, '#c5aaff', false);
    } else if (ev.type === 'cleanse') {
      floater(ev.by, '净化', '#b8ffe5', false);
    } else if (ev.type === 'thorns') {
      floater(ev.target, `反伤 -${ev.amount}`, '#b8ffe5', false);
      burst(sideX(ev.target), H * .44, '#b8ffe5', 10, 140);
      audio.play('block');
    } else if (ev.type === 'strip') {
      if (ev.amount > 0) floater(ev.target, `破甲 -${ev.amount}`, '#ffd59d', false);
    }
  }
}
function updateFx(dt) {
  fx.hitstopT = Math.max(0, fx.hitstopT - dt);
  fx.shakeT = Math.max(0, fx.shakeT - dt);
  fx.flashT = Math.max(0, fx.flashT - dt);
  fx.lunge.p1 = Math.max(0, fx.lunge.p1 - dt);
  fx.lunge.p2 = Math.max(0, fx.lunge.p2 - dt);
  fx.flash.p1 = Math.max(0, fx.flash.p1 - dt);
  fx.flash.p2 = Math.max(0, fx.flash.p2 - dt);
  for (let i = fx.projectiles.length - 1; i >= 0; i--) {
    const p = fx.projectiles[i];
    p.t += dt / p.dur;
    if (p.t >= 1) {
      burst(p.tx, p.ty, p.side === 'p1' ? '#ffa889' : '#cbbdff', 7, 120);
      fx.projectiles.splice(i, 1);
    }
  }
  for (let i = fx.particles.length - 1; i >= 0; i--) {
    const p = fx.particles[i];
    p.life -= dt;
    if (p.life <= 0) { fx.particles.splice(i, 1); continue; }
    if (p.ring) { p.size += p.grow * dt; continue; }
    p.vy += p.grav * dt;
    p.vx *= Math.max(0, 1 - p.drag * dt);
    p.vy *= Math.max(0, 1 - p.drag * dt);
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.rot += p.vr * dt;
  }
  for (let i = fx.floaters.length - 1; i >= 0; i--) {
    const f = fx.floaters[i];
    f.life -= dt; f.y -= 28 * dt;
    if (f.life <= 0) fx.floaters.splice(i, 1);
  }
}

// ==================== canvas rendering ====================
function drawDuelist(side, clsId, t, active) {
  const cls = CLASSES[clsId];
  const x = sideX(side);
  const y = H * .655;
  const dir = side === 'p1' ? 1 : -1;
  const col = cls.color;
  const bob = Math.sin(t * 1.7 + (side === 'p1' ? 0 : 1.3)) * 3.2;
  const lunge = fx.lunge[side] > 0 ? Math.sin((1 - fx.lunge[side] / .28) * Math.PI) * 42 : 0;
  const flash = fx.flash[side] > 0;
  const fallen = battle && battle.over && battle.winner !== side ? 1 : 0;
  const alpha = fallen ? .4 : 1;

  ctx.save();
  ctx.globalAlpha = alpha;

  // shadow
  ctx.fillStyle = 'rgba(0,0,0,.5)';
  ctx.beginPath(); ctx.ellipse(x, y + 13, 90, 19, 0, 0, Math.PI * 2); ctx.fill();

  // aura / active ring
  const aura = ctx.createRadialGradient(x, y - 110, 6, x, y - 100, 185);
  aura.addColorStop(0, col + (active ? '3a' : '1a'));
  aura.addColorStop(.55, col + (active ? '10' : '07'));
  aura.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = aura;
  ctx.beginPath(); ctx.ellipse(x, y - 105, 180, 205, 0, 0, Math.PI * 2); ctx.fill();
  if (active) {
    ctx.strokeStyle = col + '66'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.ellipse(x, y + 2, 118 + Math.sin(t * 2.1) * 4, 24, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = col + '33';
    ctx.beginPath(); ctx.ellipse(x, y + 2, 146, 31, 0, .2, 2.8); ctx.stroke();
  }

  ctx.save();
  ctx.translate(x + dir * lunge, y + bob);
  ctx.scale(dir, 1);

  // back cape
  const cape = ctx.createLinearGradient(-40, -140, 40, 8);
  cape.addColorStop(0, col + '55'); cape.addColorStop(.6, col + '22'); cape.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = cape;
  ctx.beginPath();
  ctx.moveTo(-22, -135);
  ctx.quadraticCurveTo(-95, -72, -78, 8);
  ctx.lineTo(-15, -8); ctx.closePath(); ctx.fill();

  // robe body
  const robe = ctx.createLinearGradient(-58, -132, 58, 16);
  robe.addColorStop(0, '#1a252b');
  robe.addColorStop(.46, col + 'aa');
  robe.addColorStop(.8, col + '55');
  robe.addColorStop(1, '#0b1115');
  ctx.fillStyle = robe;
  ctx.beginPath();
  ctx.moveTo(-26, -138);
  ctx.lineTo(-45, -100);
  ctx.lineTo(-58, -35);
  ctx.lineTo(-66, 12);
  ctx.lineTo(-28, 20);
  ctx.lineTo(0, 12);
  ctx.lineTo(30, 20);
  ctx.lineTo(62, 12);
  ctx.lineTo(52, -38);
  ctx.lineTo(40, -100);
  ctx.lineTo(24, -138);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.65)'; ctx.lineWidth = 3; ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(-25, -128); ctx.lineTo(-34, -74); ctx.lineTo(-46, -10); ctx.stroke();

  // sash
  ctx.strokeStyle = col; ctx.lineWidth = 4.5;
  ctx.beginPath(); ctx.moveTo(-38, -86); ctx.quadraticCurveTo(0, -72, 42, -90); ctx.stroke();
  ctx.fillStyle = '#f7e6b0';
  ctx.beginPath(); ctx.moveTo(-5, -82); ctx.lineTo(6, -77); ctx.lineTo(-3, -69); ctx.closePath(); ctx.fill();

  // shoulders / arms
  ctx.strokeStyle = '#121b20'; ctx.lineWidth = 16; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-25, -126); ctx.lineTo(-46, -80); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(25, -126); ctx.lineTo(52, -92); ctx.stroke();
  ctx.strokeStyle = col + '99'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-26, -124); ctx.lineTo(-46, -81); ctx.stroke();

  // head
  ctx.fillStyle = '#f1d5b4';
  ctx.beginPath(); ctx.arc(0, -156, 19, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 2; ctx.stroke();
  // hair / hood
  ctx.fillStyle = '#15191e';
  ctx.beginPath();
  ctx.arc(0, -160, 20, Math.PI * 1.03, Math.PI * 2.02);
  ctx.lineTo(18, -155); ctx.closePath(); ctx.fill();
  if (clsId === 'mage') {
    ctx.fillStyle = col + 'cc';
    ctx.beginPath(); ctx.moveTo(-22, -166); ctx.lineTo(0, -205); ctx.lineTo(21, -166); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#f7e6b0'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(0, -200); ctx.lineTo(0, -177); ctx.stroke();
  } else if (clsId === 'ranger') {
    ctx.fillStyle = col + 'dd';
    ctx.beginPath(); ctx.moveTo(-19, -172); ctx.lineTo(0, -192); ctx.lineTo(18, -168); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#e4c78e';
    ctx.beginPath(); ctx.arc(18, -175, 2.2, 0, 7); ctx.fill();
  } else {
    ctx.fillStyle = '#d9b56e';
    ctx.beginPath(); ctx.arc(0, -179, 4.4, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#f0d59a'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(0, -184); ctx.lineTo(7, -191); ctx.stroke();
  }
  // eyes
  ctx.fillStyle = '#20151a';
  ctx.beginPath(); ctx.arc(8, -155, 2.1, 0, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(95,48,36,.55)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(3, -147); ctx.lineTo(12, -147); ctx.stroke();
  // collar
  ctx.strokeStyle = '#f7e6b0'; ctx.lineWidth = 2.2;
  ctx.beginPath(); ctx.moveTo(-13, -140); ctx.lineTo(0, -125); ctx.lineTo(13, -140); ctx.stroke();

  // weapon
  ctx.save();
  ctx.translate(42, -100);
  if (clsId === 'blade') {
    ctx.rotate(-.34);
    ctx.strokeStyle = '#e9e2cf'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(0, 8); ctx.lineTo(80, -34); ctx.stroke();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(2, 4); ctx.lineTo(77, -34); ctx.stroke();
    ctx.strokeStyle = '#d7b56f'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(-4, 14); ctx.lineTo(12, 0); ctx.stroke();
  } else if (clsId === 'ranger') {
    ctx.rotate(-.15);
    ctx.strokeStyle = col; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(16, -6, 54, -1.24, 1.2); ctx.stroke();
    ctx.strokeStyle = '#e9e2cf'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(-9, -57); ctx.lineTo(-9, 53); ctx.stroke();
    ctx.strokeStyle = '#f7e6b0'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-9, 0); ctx.lineTo(72, 0); ctx.stroke();
    ctx.fillStyle = '#f7e6b0';
    ctx.beginPath(); ctx.moveTo(76, 0); ctx.lineTo(64, -6); ctx.lineTo(64, 6); ctx.closePath(); ctx.fill();
  } else {
    ctx.rotate(.08);
    ctx.strokeStyle = '#b59b72'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(0, 45); ctx.lineTo(0, -88); ctx.stroke();
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(0, -97, 17, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#eefaff';
    ctx.beginPath(); ctx.arc(-4, -102, 6, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ffffff88'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(0, -97, 24, .3, 2.7); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, -97, 24, 3.5, 5.8); ctx.stroke();
  }
  ctx.restore();

  // guard / cast curl
  if (battle && battle.active === side && humanTurn()) {
    ctx.strokeStyle = col + '55'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(52, -92, 28, -1.2, .8); ctx.stroke();
  }

  if (flash) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = fx.flash[side] / .18 * .5;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.ellipse(0, -95, 72, 110, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  ctx.restore();

  // class label / floating crest
  ctx.save();
  ctx.globalAlpha = .9;
  ctx.fillStyle = 'rgba(4,9,12,.72)';
  ctx.strokeStyle = col + '55'; ctx.lineWidth = 1;
  const label = `${cls.short} · ${side.toUpperCase()}`;
  ctx.font = '700 11px "Microsoft YaHei",sans-serif';
  const tw = ctx.measureText(label).width + 22;
  const lx = x - tw / 2, ly = y + 32;
  roundRectPath(ctx, lx, ly, tw, 22, 11); ctx.fill(); ctx.stroke();
  ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(label, x, ly + 11);
  ctx.restore();

  ctx.restore();
}

function drawParticlesAndFx() {
  ctx.save();
  for (const p of fx.particles) {
    const a = clamp(p.life / p.max, 0, 1);
    if (p.ring) {
      ctx.globalAlpha = a * .7;
      ctx.strokeStyle = p.color; ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.stroke();
    } else {
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot || 0);
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 1.5);
      ctx.restore();
    }
  }
  ctx.globalAlpha = 1;
  for (const pr of fx.projectiles) {
    const t = clamp(pr.t, 0, 1);
    const e = 1 - Math.pow(1 - t, 3);
    const x = lerp(pr.sx, pr.tx, e);
    const y = lerp(pr.sy, pr.ty, e) - Math.sin(e * Math.PI) * 80;
    const col = pr.side === 'p1' ? '#ffa889' : '#cbbdff';
    ctx.save(); ctx.translate(x, y); ctx.rotate(pr.rot + e * 2.2);
    ctx.fillStyle = 'rgba(6,12,16,.92)';
    ctx.strokeStyle = col; ctx.lineWidth = 2;
    roundRectPath(ctx, -26, -36, 52, 72, 6); ctx.fill(); ctx.stroke();
    ctx.fillStyle = col + 'cc';
    ctx.font = '800 18px "Microsoft YaHei",sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(pr.card ? pr.card.name.slice(0, 1) : '牌', 0, 0);
    ctx.restore();
  }
  for (const f of fx.floaters) {
    const a = clamp(f.life / f.max, 0, 1);
    ctx.globalAlpha = a;
    ctx.font = f.big ? '800 32px "Microsoft YaHei",sans-serif' : '700 18px "Microsoft YaHei",sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.7)';
    ctx.strokeText(f.text, f.x, f.y);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.restore();
}

function render() {
  if (!ctx) return;
  const t = performance.now() / 1000;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.clearRect(0, 0, cv.width, cv.height);
  ctx.save();
  const sh = fx.shakeT > 0 ? fx.shakeT / Math.max(.001, fx.shakeDur) : 0;
  const sx = Math.sin(t * 97) * fx.shakeAmp * sh;
  const sy = Math.cos(t * 79) * fx.shakeAmp * sh * .55;
  ctx.translate(viewOX + sx * viewScale, viewOY + sy * viewScale);
  ctx.scale(viewScale, viewScale);
  ctx.drawImage(bgCv, 0, 0);

  // animated centre sigil
  ctx.save();
  ctx.translate(W / 2, H * .46);
  ctx.rotate(t * .06);
  ctx.strokeStyle = 'rgba(79,224,188,.075)'; ctx.lineWidth = 1;
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2;
    ctx.beginPath(); ctx.moveTo(Math.cos(a) * 74, Math.sin(a) * 74); ctx.lineTo(Math.cos(a) * 214, Math.sin(a) * 214); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(231,189,114,.06)';
  ctx.beginPath(); ctx.arc(0, 0, 160, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, 230, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();

  const p1cls = classOf('p1'), p2cls = classOf('p2');
  const a1 = !!(battle && screen === 'playing' && battle.active === 'p1' && !battle.over);
  const a2 = !!(battle && screen === 'playing' && battle.active === 'p2' && !battle.over);
  drawDuelist('p1', p1cls, t, a1);
  drawDuelist('p2', p2cls, t, a2);
  drawParticlesAndFx();

  // top / side faint title watermark in match
  if (screen === 'playing' || screen === 'over') {
    ctx.save();
    ctx.globalAlpha = .5;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '700 11px "Microsoft YaHei",sans-serif';
    ctx.fillStyle = 'rgba(231,189,114,.36)';
    ctx.fillText('C A R D   D U E L   A R E N A', W / 2, H - 24);
    ctx.restore();
  }
  ctx.restore();
}

// ==================== title DOM ====================
function updateTitleUI() {
  const bestEl = $id('titleRecord');
  if (bestEl) {
    bestEl.textContent = `战绩 ${records.wins} 胜 ${records.losses} 负 · 最佳 ${records.best}`;
  }
  document.querySelectorAll('.class-chip').forEach(btn => {
    btn.classList.toggle('sel', uiClasses[btn.dataset.side] === btn.dataset.class);
  });
  const p1Info = $id('deckInfo');
  if (p1Info) {
    const deck = CLASS_DECKS[uiClasses.p1] || [];
    const counts = { attack: 0, defense: 0, spell: 0 };
    for (const id of deck) counts[(CARD_MAP[id] || {}).cat] = (counts[(CARD_MAP[id] || {}).cat] || 0) + 1;
    const rel = counterRelation(uiClasses.p1, uiClasses.p2);
    const relTxt = rel === 'advantage' ? '克制对手 ×1.15' : rel === 'disadvantage' ? '被对手克制' : '同职业 · 无克制';
    p1Info.innerHTML = `<span class="ca">攻${counts.attack}</span> / <span class="cd">防${counts.defense}</span> / <span class="cs">法${counts.spell}</span> · 20 张 · ${relTxt}`;
  }
  const p2Info = $id('p2Info');
  if (p2Info) {
    const isLocal = false;
    const rel = counterRelation(uiClasses.p2, uiClasses.p1);
    const relTxt = rel === 'advantage' ? '克制 P1 ×1.15' : rel === 'disadvantage' ? '被 P1 克制' : '同职业 · 无克制';
    p2Info.textContent = `${CLASSES[uiClasses.p2].name} · ${relTxt} · 后手开局 3 护甲`;
  }
  const p2head = $id('p2head');
  if (p2head) p2head.textContent = 'P2 / AI 对手';
}
function bindTitle() {
  document.querySelectorAll('.class-chip').forEach(btn => {
    const side = btn.dataset.side, cls = btn.dataset.class;
    drawClassEmblem(btn.querySelector('canvas'), cls);
    btn.addEventListener('click', () => {
      if (!AUTOTEST) unlockAudio();
      audio.play('ui');
      uiClasses[side] = cls;
      updateTitleUI();
    });
  });
  document.querySelectorAll('.modebtn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!AUTOTEST) unlockAudio();
      audio.play('ui');
      const m = btn.dataset.mode || 'ai';
      const d = diffKey(btn.dataset.diff || '2');
      startGame(m, d, uiClasses.p1, uiClasses.p2);
    });
  });
}

// ==================== in-game DOM ====================
function cardDom(card, index, activeSide, disabled, isSelected) {
  const el = document.createElement('button');
  el.className = 'card' + (isSelected ? ' sel' : '') + (disabled ? ' off' : '');
  el.dataset.id = card.id;
  el.dataset.cat = card.cat;
  el.dataset.index = String(index);
  el.setAttribute('aria-label', `${card.name}，${CAT_LABEL[card.cat]}，${card.cost} 能量，${card.text}`);
  const cost = document.createElement('span'); cost.className = 'c-cost'; cost.textContent = String(card.cost);
  const cat = document.createElement('span'); cat.className = 'c-cat'; cat.textContent = CAT_LABEL[card.cat];
  const art = document.createElement('div'); art.className = 'c-art';
  const artCanvas = document.createElement('canvas');
  art.appendChild(artCanvas);
  const name = document.createElement('div'); name.className = 'c-name'; name.textContent = card.name;
  const en = document.createElement('div'); en.className = 'c-en'; en.textContent = card.en || card.id;
  const text = document.createElement('div'); text.className = 'c-text'; text.textContent = card.text;
  const deco = document.createElement('span'); deco.className = 'c-deco';
  el.append(cost, cat, art, name, en, text, deco);
  if (index < 5) {
    const key = document.createElement('span'); key.className = 'c-key'; key.textContent = String(index + 1);
    el.appendChild(key);
  }
  el.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!AUTOTEST) unlockAudio();
    if (!humanTurn()) { toast(mode === 'local' ? '当前不是可操作回合' : '对手回合，请稍候'); return; }
    if (selected === index) {
      playSelected();
    } else {
      selected = index;
      audio.play('select');
      updateUI();
    }
  });
  drawCardArt(artCanvas, card);
  return el;
}

function renderHandUI() {
  if (!handEl) return;
  handEl.innerHTML = '';
  if (!battle || screen !== 'playing' || privacyPending || battle.over) return;
  const shownSide = mode === 'local' ? battle.active : 'p1';
  const p = player(shownSide);
  if (!p) return;
  const canAct = humanTurn();
  for (let i = 0; i < p.hand.length; i++) {
    const card = CARD_MAP[p.hand[i]];
    if (!card) continue;
    const disabled = !canAct || card.cost > p.energy;
    handEl.appendChild(cardDom(card, i, shownSide, disabled, selected === i));
  }
}

function pipsHtml(energy, maxEnergy) {
  let s = '';
  for (let i = 0; i < RULES.maxEnergy; i++) {
    s += `<span class="pip ${i < energy ? 'on' : i < maxEnergy ? 'max' : ''}"></span>`;
  }
  return s;
}

function updatePanel(side) {
  const p = player(side);
  if (!p) return;
  const cls = classOf(side);
  const clsInfo = CLASSES[cls];
  const panel = $id(side === 'p1' ? 'panelP1' : 'panelP2');
  const isActive = battle && battle.active === side && !battle.over;
  panel.classList.toggle('active', !!isActive);
  panel.classList.toggle('dead', p.hp <= 0);
  $id(side === 'p1' ? 'avaP1' : 'avaP2').textContent = cls === 'blade' ? '⚔' : cls === 'ranger' ? '➹' : '✦';
  let name;
  if (mode === 'local') name = `${side.toUpperCase()} · ${clsInfo.name}`;
  else if (side === 'p1') name = `你 · ${clsInfo.name}`;
  else name = `${clsInfo.name} · ${AI_TIERS[diff].name}档 AI`;
  $id(side === 'p1' ? 'nameP1' : 'nameP2').textContent = name;
  $id(side === 'p1' ? 'clsP1' : 'clsP2').textContent = `${clsInfo.title} · ${clsInfo.tag}`;
  $id(side === 'p1' ? 'sideP1' : 'sideP2').textContent = side.toUpperCase();
  $id(side === 'p1' ? 'hpValP1' : 'hpValP2').textContent = String(Math.max(0, Math.round(p.hp)));
  $id(side === 'p1' ? 'hpFillP1' : 'hpFillP2').style.width = `${clamp(p.hp / p.maxHp * 100, 0, 100)}%`;
  $id(side === 'p1' ? 'blockP1' : 'blockP2').textContent = `护甲 ${Math.max(0, Math.round(p.block))}`;
  $id(side === 'p1' ? 'handP1' : 'handP2').textContent = `手牌 ${p.hand.length}`;
  $id(side === 'p1' ? 'deckP1' : 'deckP2').textContent = `牌库 ${p.deck.length} / 弃 ${p.discard.length}`;
  $id(side === 'p1' ? 'energyP1' : 'energyP2').textContent = `${p.energy}/${p.maxEnergy}`;
  $id(side === 'p1' ? 'pipsP1' : 'pipsP2').innerHTML = pipsHtml(p.energy, p.maxEnergy);
  // status chips via title on block chip
  const extra = [];
  if (p.burn > 0) extra.push(`灼烧${p.burn}×${p.burnT}`);
  if (p.nextAtk > 0) extra.push(`强化+${p.nextAtk}`);
  if (p.weaken > 0) extra.push(`虚弱-${p.weaken}`);
  if (p.thorns > 0) extra.push(`荆棘${p.thorns}`);
  const blockEl = $id(side === 'p1' ? 'blockP1' : 'blockP2');
  blockEl.textContent = extra.length ? `护甲 ${Math.max(0, Math.round(p.block))} · ${extra.join(' / ')}` : `护甲 ${Math.max(0, Math.round(p.block))}`;
}

function updateUI() {
  if (nanFlag || scanNan()) nanFlag = true;
  const isPlaying = screen === 'playing' && !!battle;
  gameuiEl.classList.toggle('hide', !isPlaying);
  homeBtn.classList.toggle('hide', screen === 'title');
  pauseBtn.classList.toggle('hide', screen === 'title');
  pauseBtn.disabled = !isPlaying;
  pauseBtn.textContent = paused ? '▶' : '❚❚';
  pauseBtn.title = paused ? '继续 (P)' : '暂停 (P)';
  muteBtn.textContent = muted ? '静' : '♪';
  muteBtn.classList.toggle('on', muted);
  muteBtn.title = muted ? '取消静音 (M)' : '静音 (M)';

  if (!isPlaying) {
    handEl.innerHTML = '';
    updateTitleUI();
    return;
  }
  updatePanel('p1');
  updatePanel('p2');
  const active = battle.active;
  const cls = classOf(active);
  let tag;
  if (battle.over) tag = '对局结束';
  else if (mode === 'ai') tag = active === 'p1' ? '你的回合' : `对手思考中 · ${AI_TIERS[diff].name}档`;
  else tag = `${active.toUpperCase()} 回合`;
  $id('turnTag').textContent = tag;
  $id('turnSub').textContent = `第 ${battle.turn} 回合 · ${CLASSES[cls].short} · 能量 ${player(active).energy}/${player(active).maxEnergy}`;
  const lastLog = battle.log && battle.log.length ? battle.log[battle.log.length - 1].text : '';
  $id('logline').textContent = lastLog || '选择一张牌，再次点击或 Enter 打出';
  $id('handCount').textContent = String(player(mode === 'local' ? active : 'p1').hand.length);
  $id('turnInfo').textContent = privacyPending ? '交接中' : tag;
  $id('classInfo').textContent = `${CLASSES[classOf('p1')].short} vs ${CLASSES[classOf('p2')].short}`;
  $id('selhint').textContent = !humanTurn() ? '等待对手行动…' : selected >= 0 ? '再次点击 / Enter 出牌' : '点击选中 · 再点出牌';
  endTurnBtn.disabled = !humanTurn();
  playBtn.disabled = !humanTurn() || selected < 0;
  if (selected >= 0) {
    const p = player(activeHumanSide() || active);
    if (!p || selected >= p.hand.length) selected = -1;
    if (selected >= 0) {
      const c = CARD_MAP[p.hand[selected]];
      playBtn.disabled = !humanTurn() || !c || c.cost > p.energy;
    }
  }
  renderHandUI();
  updateTitleUI();
}

// ==================== flow ====================
function clearFx() {
  fx.hitstopT = 0; fx.shakeT = 0; fx.shakeAmp = 0; fx.flashT = 0;
  fx.lunge.p1 = fx.lunge.p2 = 0;
  fx.flash.p1 = fx.flash.p2 = 0;
  fx.particles.length = 0; fx.floaters.length = 0; fx.projectiles.length = 0;
}
function showPrivacy(side) {
  privacyPending = true;
  selected = -1;
  handEl.innerHTML = '';
  $id('privacyWho').textContent = `${side.toUpperCase()} 的回合`;
  privacyEl.classList.remove('hide');
  updateUI();
}
function continueAfterPrivacy() {
  if (!privacyPending) return false;
  privacyPending = false;
  selected = -1;
  privacyEl.classList.add('hide');
  audio.play('turn');
  updateUI();
  return true;
}
function startGame(gm = 'ai', d = 'medium', p1class = uiClasses.p1, p2class = uiClasses.p2, opts = {}) {
  mode = gm === 'local' ? 'local' : 'ai';
  diff = diffKey(d);
  uiClasses = {
    p1: CLASSES[p1class] ? p1class : 'blade',
    p2: CLASSES[p2class] ? p2class : 'ranger',
  };
  lastStart = { mode, diff, p1: uiClasses.p1, p2: uiClasses.p2 };
  const seed = Number.isFinite(opts.seed)
    ? opts.seed
    : (AUTOTEST ? (91001 + (gameSerial++) * 7919) : ((Date.now() ^ (gameSerial++ * 2654435761)) >>> 0));
  battle = createBattle({
    p1class: uiClasses.p1, p2class: uiClasses.p2,
    seed, firstSide: 'p1',
  });
  screen = 'playing'; paused = false; selected = -1; privacyPending = false;
  aiTimer = .55; lastReportProgress = -1; lastReportScore = -1; nanFlag = false;
  clearFx();
  titleEl.classList.add('hide');
  endEl.classList.add('hide');
  pauseEl.classList.add('hide');
  privacyEl.classList.add('hide');
  gameuiEl.classList.remove('hide');
  homeBtn.classList.remove('hide');
  reportProgress(true);
  audio.reset(); audio.setState('battle'); audio.play('start');
  updateUI();
  updateTitleUI();
  if (mode === 'local') {
    showPrivacy(battle.active);
    toast('本地双人：请将设备交给 P1，按空格继续', 2200);
  } else {
    toast('你的回合：点击选牌，再点一次出牌', 2100);
  }
  return snapshot();
}
function goTitle() {
  screen = 'title'; paused = false; privacyPending = false; selected = -1;
  battle = null;
  privacyEl.classList.add('hide');
  pauseEl.classList.add('hide');
  endEl.classList.add('hide');
  titleEl.classList.remove('hide');
  gameuiEl.classList.add('hide');
  homeBtn.classList.add('hide');
  handEl.innerHTML = '';
  if (toastEl) { clearTimeout(toast._t); toastEl.classList.remove('show'); }
  clearFx();
  audio.setState('title'); audio.reset();
  updateTitleUI();
  updateUI();
  return snapshot();
}
function togglePause() {
  if (screen !== 'playing') return false;
  paused = !paused;
  if (paused) pauseEl.classList.remove('hide');
  else pauseEl.classList.add('hide');
  audio.play('pause');
  updateUI();
  return paused;
}
function toggleMute() {
  muted = !muted;
  audio.setMuted(muted);
  persistMute();
  updateUI();
  return muted;
}
function playSelected() {
  if (!battle || screen !== 'playing') return { ok: false, error: 'not-playing' };
  if (!humanTurn()) return { ok: false, error: 'not-turn' };
  if (selected < 0) { toast('先用 1-5 或点击选中一张牌'); return { ok: false, error: 'no-selection' }; }
  const p = player(activeHumanSide());
  const idx = selected;
  if (!p || idx >= p.hand.length) { selected = -1; updateUI(); return { ok: false, error: 'no-card' }; }
  const card = CARD_MAP[p.hand[idx]];
  if (!card) { selected = -1; updateUI(); return { ok: false, error: 'bad-card' }; }
  if (card.cost > p.energy) {
    toast(`能量不足：需要 ${card.cost} 点，当前 ${p.energy} 点`);
    audio.play('block');
    return { ok: false, error: 'energy' };
  }
  const oldHp = battle.p2.hp;
  const res = rulesPlayCard(battle, battle.active, idx);
  if (!res.ok) {
    toast(res.error === 'energy' ? '能量不足' : '无法打出这张牌');
    return res;
  }
  selected = -1;
  applyEvents(res.events, p.side);
  if (battle.p2.hp < oldHp) fx.flashT = .05;
  audio.play('card');
  reportProgress();
  updateUI();
  if (battle.over) finishGame();
  return res;
}
function doEndTurn() {
  if (!battle || screen !== 'playing') return { ok: false, error: 'not-playing' };
  if (!humanTurn()) return { ok: false, error: 'not-turn' };
  const from = battle.active;
  const res = rulesEndTurn(battle);
  selected = -1;
  audio.play('turn');
  applyEvents(res.events || [], from);
  reportProgress();
  if (battle.over) {
    updateUI();
    finishGame();
    return res;
  }
  if (mode === 'local') {
    showPrivacy(battle.active);
    toast(`${battle.active.toUpperCase()} 的回合`, 1100);
  } else {
    aiTimer = .55;
    updateUI();
  }
  return res;
}
function aiOneAction() {
  if (!battle || screen !== 'playing' || battle.over || mode !== 'ai' || battle.active !== 'p2') {
    return { ok: false, error: 'not-ai-turn' };
  }
  const action = chooseAction(battle, diff, 'p2');
  if (action.type === 'end') {
    const res = rulesEndTurn(battle);
    applyEvents(res.events || [], 'p2');
    audio.play('turn');
    reportProgress();
    aiTimer = .45;
    updateUI();
    if (battle.over) finishGame();
    return { ok: true, action, result: res };
  }
  const res = rulesPlayCard(battle, 'p2', action.index);
  if (!res.ok) {
    // Extremely defensive: if a candidate went stale, end the turn.
    return doEndTurnAI();
  }
  applyEvents(res.events, 'p2');
  audio.play('card');
  reportProgress();
  aiTimer = .55;
  updateUI();
  if (battle.over) finishGame();
  return { ok: true, action, result: res };
}
function doEndTurnAI() {
  if (!battle || battle.over) return { ok: false };
  const res = rulesEndTurn(battle);
  applyEvents(res.events || [], 'p2');
  audio.play('turn');
  reportProgress();
  aiTimer = .45;
  updateUI();
  if (battle.over) finishGame();
  return { ok: true, result: res };
}
function finishGame() {
  if (!battle || screen === 'over') return false;
  if (!battle.over) return false;
  screen = 'over';
  paused = false;
  privacyPending = false;
  if (toastEl) { clearTimeout(toast._t); toastEl.classList.remove('show'); }
  privacyEl.classList.add('hide');
  pauseEl.classList.add('hide');
  gameuiEl.classList.add('hide');
  handEl.innerHTML = '';
  const won = battle.winner === 'p1';
  const local = mode === 'local';
  let newBest = false;
  if (mode === 'ai') {
    if (won) {
      records.wins += 1;
      if (scoreInt() > records.best) { records.best = scoreInt(); newBest = true; }
    } else {
      records.losses += 1;
    }
    saveRecords();
  }
  const sc = scoreInt(), pr = won ? 100 : Math.min(99, Math.max(1, progressInt()));
  report(won ? 'complete' : 'gameOver', {
    score: sc, progress: pr, won, mode, diff,
    p1Class: battle.p1class, p2Class: battle.p2class,
    p1Hp: battle.p1.hp, p2Hp: battle.p2.hp,
    turns: battle.turn, reason: battle.reason,
    wins: records.wins, losses: records.losses, best: records.best,
  });
  audio.setState('end');
  audio.play(won ? 'win' : 'lose');
  const endKick = $id('endKick'), endTitle = $id('endTitle'), endd = $id('endd');
  endKick.textContent = local ? 'LOCAL DUEL RESULT · 本地对局' : 'DUEL RESULT · 对局结算';
  if (local) endTitle.textContent = won ? 'P1 获 胜' : 'P2 获 胜';
  else endTitle.textContent = won ? '斗 牌 获 胜' : '牌 局 败 北';
  const winnerName = won
    ? (local ? 'P1' : '你')
    : (local ? 'P2' : `${CLASSES[battle.p2class].short} AI`);
  const lines = [];
  lines.push(`${local ? 'P1' : '你'} · ${CLASSES[battle.p1class].name}   vs   ${local ? 'P2' : 'AI'} · ${CLASSES[battle.p2class].name}`);
  lines.push(`胜者：${winnerName} · ${battle.turn} 回合 · ${battle.reason === 'burn' ? '灼烧终结' : battle.reason === 'timeout' ? '回合上限判定' : '生命归零'}`);
  lines.push(`生命 ${Math.max(0, Math.round(battle.p1.hp))} : ${Math.max(0, Math.round(battle.p2.hp))} · 造成伤害 ${Math.round(battle.p1.damageDealt)}`);
  lines.push(`本局得分 ${sc}${newBest ? ' · ★ 新最佳' : ''}`);
  if (local) lines.push('本地双人对局不计入单人战绩。');
  else lines.push(`单人战绩 ${records.wins} 胜 ${records.losses} 负 · 最佳 ${records.best}`);
  endd.textContent = lines.join('\n');
  endEl.classList.remove('hide');
  titleEl.classList.add('hide');
  updateTitleUI();
  updateUI();
  return true;
}
function shareScore() {
  const sc = scoreInt();
  audio.play('share');
  try {
    if (window.parent && window.parent !== window && typeof window.parent.handleGlobalShare === 'function') {
      window.parent.handleGlobalShare(sc);
      return true;
    }
  } catch (e) { }
  if (typeof window.dp_share === 'function') {
    try { window.dp_share(sc); return true; } catch (e) { }
  }
  return false;
}

// ==================== input ====================
const pressed = new Set();
const held = new Set();
const GAME_KEYS = new Set([
  'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9',
  'Enter', 'NumpadEnter', 'KeyE', 'KeyP', 'KeyM', 'KeyR', 'Escape', 'Space',
]);
function onKeyDown(e) {
  if (e.isComposing || e.keyCode === 229) return;
  if (e.metaKey || e.altKey || e.ctrlKey) return;
  if (GAME_KEYS.has(e.code)) e.preventDefault();
  if (!e.repeat) pressed.add(e.code);
  held.add(e.code);
}
function onKeyUp(e) { held.delete(e.code); }
window.addEventListener('keydown', onKeyDown);
window.addEventListener('keyup', onKeyUp);
window.addEventListener('blur', () => { held.clear(); pressed.clear(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) held.clear(); });

function unlockAudio() {
  if (AUTOTEST) return false;
  return audio.unlock();
}
window.addEventListener('pointerdown', unlockAudio, { once: true, capture: true });
window.addEventListener('keydown', unlockAudio, { once: true, capture: true });

function handleSystemKeys() {
  if (pressed.has('KeyM')) toggleMute();
  if (pressed.has('KeyP')) {
    if (screen === 'playing') togglePause();
  }
  if (pressed.has('KeyR')) {
    if (screen === 'playing' || screen === 'over') {
      startGame(lastStart.mode, lastStart.diff, lastStart.p1, lastStart.p2);
      toast('已重开一局');
    }
  }
  if (pressed.has('Escape')) {
    if (privacyPending) goTitle();
    else if (screen === 'over') goTitle();
    else if (screen === 'playing') togglePause();
  }
}

function update(dt) {
  if (!Number.isFinite(dt) || dt <= 0) return;
  animT += dt;
  handleSystemKeys();
  updateFx(dt);
  audio.tick(dt);
  if (screen === 'playing') audio.setState(battle && battle.over ? 'result' : 'battle');
  else if (screen === 'over') audio.setState('end');

  if (screen === 'title' || screen === 'over') {
    pressed.clear();
    return;
  }
  if (paused) {
    pressed.clear();
    return;
  }
  if (privacyPending) {
    if (pressed.has('Space') || pressed.has('NumpadEnter')) continueAfterPrivacy();
    pressed.clear();
    return;
  }

  const human = humanTurn();
  if (human) {
    if (pressed.has('KeyE')) {
      doEndTurn();
      pressed.clear();
      return;
    }
    for (let i = 1; i <= 9; i++) {
      if (pressed.has('Digit' + i)) {
        const p = player(activeHumanSide());
        if (p && i - 1 < p.hand.length && !paused) {
          selected = i - 1;
          audio.play('select');
          updateUI();
        }
      }
    }
    if (pressed.has('Enter') || pressed.has('NumpadEnter')) {
      playSelected();
    }
  } else if (mode === 'ai' && battle && !battle.over && battle.active === 'p2' && !noAuto) {
    aiTimer -= dt;
    if (aiTimer <= 0) {
      aiTimer = .55;
      aiOneAction();
    }
  }
  pressed.clear();
}

// ==================== main loop ====================
let last = performance.now(), acc = 0;
function frame(now) {
  requestAnimationFrame(frame);
  if (document.hidden) { last = now; acc = 0; return; }
  let dt = (now - last) / 1000;
  last = now;
  if (!Number.isFinite(dt) || dt < 0) dt = 0;
  dt = Math.min(dt, 1 / 20);
  acc += dt;
  let guard = 0;
  while (acc >= DT && guard++ < 10) { update(DT); acc -= DT; }
  render();
}

// ==================== snapshot ====================
function snapPlayer(p) {
  if (!p) return null;
  return {
    side: p.side, cls: p.cls, hp: p.hp, maxHp: p.maxHp, block: p.block,
    energy: p.energy, maxEnergy: p.maxEnergy,
    hand: p.hand.slice(), handIdx: p.hand.map(id => (CARD_MAP[id] || {}).name || id),
    deck: p.deck.slice(), discard: p.discard.slice(),
    handN: p.hand.length, deckN: p.deck.length, discardN: p.discard.length,
    totalN: totalCards(p),
    burn: p.burn, burnT: p.burnT, nextAtk: p.nextAtk, weaken: p.weaken,
    thorns: p.thorns, thornsT: p.thornsT,
    damageDealt: p.damageDealt, cardsPlayed: p.cardsPlayed, turnsTaken: p.turnsTaken,
    firstTurnDone: p.firstTurnDone,
  };
}
function snapshot() {
  if (scanNan()) nanFlag = true;
  const p1 = battle ? battle.p1 : null;
  const p2 = battle ? battle.p2 : null;
  const total = (p) => p ? totalCards(p) : 0;
  return {
    screen, mode, diff, paused, noAuto, privacyPending, privacyVisible: !privacyEl.classList.contains('hide'),
    selected, active: battle ? battle.active : null,
    humanTurn: humanTurn(), humanSide: mode === 'local' ? (battle ? battle.active : null) : 'p1',
    turn: battle ? battle.turn : 0, over: battle ? !!battle.over : false,
    winner: battle ? battle.winner : null, reason: battle ? battle.reason : '',
    p1Class: battle ? battle.p1class : uiClasses.p1,
    p2Class: battle ? battle.p2class : uiClasses.p2,
    p1: snapPlayer(p1), p2: snapPlayer(p2),
    p1Total: total(p1), p2Total: total(p2),
    reshuffles: battle ? battle.log.filter(e => e.kind === 'reshuffle').length : 0,
    score: scoreInt(), progress: progressInt(),
    records: { ...records }, wins: records.wins, losses: records.losses, best: records.best,
    muted, audioCtx: audio.hasCtx(),
    aiTier: diff, aiPolicy: (AI_TIERS[diff] || AI_TIERS.medium).policy,
    libraryCount: CARD_LIBRARY.length,
    deckCounts: Object.fromEntries(Object.entries(CLASS_DECKS).map(([k, v]) => [k, v.length])),
    reports: reports.length,
    extReq: Number(window.__EXTREQ) || 0,
    nan: nanFlag,
    privacyHandRendered: handEl ? handEl.children.length : 0,
    titleVisible: !titleEl.classList.contains('hide'),
    endVisible: !endEl.classList.contains('hide'),
    pauseVisible: !pauseEl.classList.contains('hide'),
    log: battle ? battle.log.slice(-12).map(e => ({ ...e })) : [],
  };
}

// ==================== URL / UI wiring ====================
function bindButtons() {
  muteBtn.addEventListener('click', () => { unlockAudio(); audio.play('ui'); toggleMute(); });
  pauseBtn.addEventListener('click', () => { unlockAudio(); audio.play('ui'); togglePause(); });
  homeBtn.addEventListener('click', () => { unlockAudio(); audio.play('ui'); goTitle(); });
  endTurnBtn.addEventListener('click', () => { unlockAudio(); audio.play('ui'); if (doEndTurn().ok === false) { /* keep UI quiet */ } });
  playBtn.addEventListener('click', () => { unlockAudio(); audio.play('ui'); playSelected(); });
  $id('privacyContinue').addEventListener('click', () => { unlockAudio(); audio.play('ui'); continueAfterPrivacy(); });
  $id('resume').addEventListener('click', () => { unlockAudio(); audio.play('ui'); togglePause(); });
  $id('restart2').addEventListener('click', () => { unlockAudio(); audio.play('ui'); startGame(lastStart.mode, lastStart.diff, lastStart.p1, lastStart.p2); });
  $id('home2').addEventListener('click', () => { unlockAudio(); audio.play('ui'); goTitle(); });
  $id('again').addEventListener('click', () => { unlockAudio(); audio.play('ui'); startGame(lastStart.mode, lastStart.diff, lastStart.p1, lastStart.p2); });
  $id('change').addEventListener('click', () => { unlockAudio(); audio.play('ui'); goTitle(); });
  $id('home').addEventListener('click', () => { unlockAudio(); audio.play('ui'); goTitle(); });
  $id('share').addEventListener('click', () => { unlockAudio(); audio.play('ui'); shareScore(); });
}


// ---------------- gameplay help overlay ----------------
(() => {
  const modal = document.getElementById('helpModal');
  const openBtn = document.getElementById('helpOpen');
  const closeBtn = document.getElementById('helpClose');
  if (!modal || !openBtn || !closeBtn) return;
  const setHelp = (open) => {
    modal.classList.toggle('hide', !open);
    try { (open ? closeBtn : openBtn).focus(); } catch (e) { }
  };
  openBtn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); setHelp(true); });
  closeBtn.addEventListener('click', (e) => { e.preventDefault(); setHelp(false); });
  modal.addEventListener('click', (e) => { if (e.target === modal) setHelp(false); });
  window.addEventListener('keydown', (e) => {
    if (modal.classList.contains('hide')) return;
    e.stopImmediatePropagation();
    if (e.code === 'Escape') { e.preventDefault(); setHelp(false); }
    else if (['Enter', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  }, true);
  window.__setHelp = setHelp;
})();

// ==================== G hooks ====================
function resolveHandSide(side) {
  if (!battle) return null;
  if (side === 'p1' || side === 'p2') return side;
  return battle.active;
}
function setHp(sideOrVal, maybeVal) {
  if (!battle) return 0;
  let side, val;
  if (maybeVal === undefined) { side = battle.active; val = sideOrVal; }
  else { side = resolveHandSide(sideOrVal); val = maybeVal; }
  const p = player(side); if (!p) return 0;
  p.hp = clamp(finite(Number(val), p.hp), 0, p.maxHp);
  if (scanNan()) nanFlag = true;
  updateUI();
  return p.hp;
}
function setEnergy(sideOrVal, maybeVal) {
  if (!battle) return 0;
  let side, val;
  if (maybeVal === undefined) { side = battle.active; val = sideOrVal; }
  else { side = resolveHandSide(sideOrVal); val = maybeVal; }
  const p = player(side); if (!p) return 0;
  p.energy = clamp(finite(Number(val), p.energy), 0, RULES.maxEnergy);
  p.maxEnergy = Math.max(p.maxEnergy, p.energy);
  updateUI();
  return p.energy;
}
function setBlock(sideOrVal, maybeVal) {
  if (!battle) return 0;
  let side, val;
  if (maybeVal === undefined) { side = battle.active; val = sideOrVal; }
  else { side = resolveHandSide(sideOrVal); val = maybeVal; }
  const p = player(side); if (!p) return 0;
  p.block = Math.max(0, finite(Number(val), p.block));
  updateUI();
  return p.block;
}
function setHand(side, ids) {
  if (!battle) return [];
  const p = player(side); if (!p) return [];
  const wanted = (Array.isArray(ids) ? ids : [ids]).filter(id => CARD_MAP[id]);
  const all = p.hand.concat(p.deck, p.discard);
  for (const id of wanted) {
    const at = all.indexOf(id);
    if (at >= 0) all.splice(at, 1);
  }
  p.hand = wanted.slice(0, 20);
  p.deck = all;
  p.discard = [];
  selected = -1;
  if (scanNan()) nanFlag = true;
  updateUI();
  return p.hand.slice();
}
function drawForTest(sideOrN, maybeN) {
  if (!battle) return [];
  let side, n;
  if (typeof sideOrN === 'string') { side = sideOrN; n = maybeN; }
  else { side = battle.active; n = sideOrN; }
  n = Math.max(0, Math.min(20, Math.floor(Number(n) || 0)));
  const p = player(side);
  if (!p) return [];
  const drawn = drawCards(battle, p, n);
  if (drawn.length) applyEvents([{ type: 'draw', by: side, count: drawn.length, ids: drawn.slice() }], side);
  updateUI();
  return drawn;
}
function primeReshuffle(side) {
  if (!battle) return false;
  const p = player(side);
  if (!p) return false;
  p.discard.push(...p.deck.splice(0));
  battle.log.push({ t: battle.turn, kind: 'reshuffle', side, text: `${side.toUpperCase()} 弃牌堆洗回牌库` });
  return true;
}
function skipPrivacy() {
  if (!privacyPending) return false;
  return continueAfterPrivacy();
}
function forceWin() {
  if (!battle || screen === 'title' || screen === 'over') {
    startGame('ai', diff, lastStart.p1, lastStart.p2);
  }
  if (!battle) return false;
  if (screen === 'playing') {
    battle.p1.hp = Math.max(1, battle.p1.hp);
    battle.p2.hp = 0;
    battle.over = true; battle.winner = 'p1'; battle.reason = 'forced';
    reportProgress(true);
    updateUI();
    finishGame();
  }
  return true;
}
function forceLose() {
  if (!battle || screen === 'title' || screen === 'over') {
    startGame('ai', diff, lastStart.p1, lastStart.p2);
  }
  if (!battle) return false;
  if (screen === 'playing') {
    battle.p2.hp = Math.max(1, battle.p2.hp);
    battle.p1.hp = 0;
    battle.over = true; battle.winner = 'p2'; battle.reason = 'forced';
    reportProgress(true);
    updateUI();
    finishGame();
  }
  return true;
}
function aiAct() {
  if (mode !== 'ai' || !battle || battle.active !== 'p2') return { ok: false, error: 'not-ai-turn' };
  return aiOneAction();
}
function resizeThumb() { resize(); }
function reportLog() { return reports.slice(); }
function getLibrary() { return CARD_LIBRARY.map(c => ({ ...c })); }
function getDecks() { return Object.fromEntries(Object.entries(CLASS_DECKS).map(([k, v]) => [k, v.slice()])); }
function getClasses() { return Object.fromEntries(Object.entries(CLASSES).map(([k, v]) => [k, { ...v }])); }
function getAiTiers() { return Object.fromEntries(Object.entries(AI_TIERS).map(([k, v]) => [k, { ...v }])); }

const G = {
  err: window.__BOOTERR || [],
  W, H, RULES,
  step: (n = 60, dt = DT) => { for (let i = 0; i < n; i++) { update(dt); render(); } },
  upd: (n = 30, dt = DT) => { for (let i = 0; i < n; i++) update(dt); },
  press: (...codes) => { for (const c of codes) { pressed.add(c); held.add(c); } },
  release: (...codes) => { for (const c of codes) held.delete(c); },
  setNoAuto: (v) => { noAuto = !!v; },
  setReportTarget: (fn) => { reportTarget = typeof fn === 'function' ? fn : null; },
  reportLog,
  state: () => snapshot(),
  startGame: (gm, d, p1, p2, opts) => startGame(gm, d, p1, p2, opts || {}),
  playCard: (sel, side) => {
    if (!battle || screen !== 'playing' || privacyPending) return { ok: false, error: 'not-ready' };
    const s = resolveHandSide(side);
    if (s !== battle.active) return { ok: false, error: 'not-turn' };
    const oldHp = battle.p2.hp;
    const res = rulesPlayCard(battle, battle.active, sel);
    if (res.ok) {
      applyEvents(res.events, s);
      if (battle.p2.hp < oldHp) fx.flashT = .05;
      reportProgress(); updateUI();
      if (battle.over) finishGame();
    }
    return res;
  },
  endTurn: () => {
    if (!battle || screen !== 'playing' || privacyPending) return { ok: false, error: 'not-ready' };
    return doEndTurn();
  },
  forceWin, forceLose,
  setHp, setEnergy, setBlock, setHand, drawForTest, primeReshuffle,
  skipPrivacy, aiAct,
  goTitle,
  toggleMute,
  setMuted: (v) => { muted = !!v; audio.setMuted(muted); persistMute(); updateUI(); },
  runSelfplay: (n, d, firstSide) => engineSelfplay(n, d, firstSide || null),
  runBenchmark: (n, d) => engineBenchmark(n, d),
  getLibrary, getDecks, getClasses, getAiTiers,
  counterMultiplier: (a, b) => classCounter(a, b),
  reloadRecords,
  records: () => ({ ...records }),
  resize: resizeThumb,
  audio,
  ui: { toast, updateUI, startGame, goTitle },
};
window.G = G;
window.__G = G;

// Touch/mouse drag-to-scroll for hands that outgrow the fan.
(function bindHandDrag() {
  let dragging = false, moved = false, startX = 0, startScroll = 0, pid = null;
  handEl.addEventListener('pointerdown', (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    dragging = true; moved = false; startX = e.clientX; startScroll = handEl.scrollLeft; pid = e.pointerId;
  });
  handEl.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    if (Math.abs(dx) > 5) {
      moved = true;
      handEl.classList.add('dragging');
      handEl.scrollLeft = startScroll - dx;
      if (e.cancelable) e.preventDefault();
    }
  }, { passive: false });
  const end = () => {
    dragging = false;
    handEl.classList.remove('dragging');
    if (moved) setTimeout(() => { moved = false; }, 0);
    pid = null;
  };
  handEl.addEventListener('pointerup', end);
  handEl.addEventListener('pointercancel', end);
  handEl.addEventListener('pointerleave', end);
  handEl.addEventListener('click', (e) => {
    if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; }
  }, true);
})();

// ==================== boot ====================
resize();
buildBackground();
bindTitle();
bindButtons();
updateTitleUI();
updateUI();
audio.setState('title');
requestAnimationFrame(frame);

if (URLP.has('autostart') && !AUTOTEST) {
  const m = URLP.get('mode') === 'local' ? 'local' : 'ai';
  startGame(m, diffKey(URLP.get('difficulty') || '2'), URLP.get('p1') || 'blade', URLP.get('p2') || 'ranger');
}

// ==================== autotest ====================
const nap = () => new Promise(r => {
  const mc = new MessageChannel();
  mc.port1.onmessage = () => r();
  mc.port2.postMessage(0);
});

async function autotest() {
  G.setNoAuto(true);
  const results = [];
  const T = window.__TEST = { pass: 0, fail: 0, total: 0, results, done: false };
  const ok = (id, cond, name) => {
    results.push({ id, ok: !!cond, name });
    if (cond) T.pass++; else { T.fail++; console.log(`[autotest] FAIL ${id}: ${name}`); }
  };
  const S = () => G.state();
  const frames = [];
  const saved = {
    wins: records.wins, losses: records.losses, best: records.best, muted,
    lw: null, ll: null, lb: null, lm: null,
  };
  try {
    saved.lw = localStorage.getItem(KEY.wins);
    saved.ll = localStorage.getItem(KEY.losses);
    saved.lb = localStorage.getItem(KEY.best);
    saved.lm = localStorage.getItem(KEY.mute);
  } catch (e) { }
  muted = true; audio.setMuted(true); updateUI();
  G.setReportTarget(f => frames.push(f));

  const startLocal = (p1 = 'blade', p2 = 'blade', seed = 70001) => {
    G.startGame('local', 'medium', p1, p2, { seed });
    if (S().privacyPending) G.skipPrivacy();
    return S();
  };
  const startAI = (d = 'medium', p1 = 'blade', p2 = 'ranger', seed = 71001) => {
    G.startGame('ai', d, p1, p2, { seed });
    return S();
  };

  try {
    await nap();

    // 1 — clean boot
    {
      const ext = performance.getEntriesByType('resource').filter(e => {
        try { return new URL(e.name).origin !== location.origin; } catch (err) { return false; }
      }).length;
      ok(1, G.err.length === 0 && window.__BOOTERR.length === 0 && ext === 0 && (Number(window.__EXTREQ) || 0) === 0,
        `启动零报错 / 零外网 errors=${G.err.length} ext=${ext}`);
    }

    // 2 — stress / no NaN
    {
      startLocal('blade', 'ranger', 70002);
      G.setEnergy('p1', 10);
      G.setEnergy('p2', 10);
      let finiteOk = true;
      for (let k = 0; k < 260; k++) {
        if (k % 9 === 0) G.press('Digit' + (1 + (k % 5)));
        if (k % 17 === 0) G.press('Enter');
        if (k % 53 === 0) G.press('KeyE');
        if (k % 31 === 0 && S().privacyPending) G.press('Space');
        update(DT);
        if (k % 40 === 0) {
          const s = S();
          const vals = [s.p1.hp, s.p1.energy, s.p2.hp, s.p2.energy, s.turn, s.score, s.progress];
          if (vals.some(v => !Number.isFinite(v))) finiteOk = false;
        }
      }
      G.release('Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Enter', 'KeyE', 'Space');
      const s = S();
      ok(2, finiteOk && !s.nan && Number.isFinite(s.p1.hp) && Number.isFinite(s.p2.hp) && G.err.length === 0,
        `260 帧乱战无 NaN / 无新报错 nan=${s.nan}`);
    }

    // 3a — attack damage after block
    {
      startLocal('blade', 'blade', 70003);
      G.setEnergy('p1', 10);
      G.setHand('p1', ['quick_slash']);
      G.setHp('p2', 30);
      G.setBlock('p2', 2);
      const r = G.playCard(0);
      const s = S();
      ok('3a', r.ok && s.p2.hp === 28 && s.p2.block === 0,
        `疾风斩 4 伤 - 2 护甲 = 2，P2 hp=${s.p2.hp} block=${s.p2.block}`);
    }

    // 3b — energy spend / limit
    {
      startLocal('blade', 'blade', 70004);
      G.setEnergy('p1', 2);
      G.setHand('p1', ['thunder_rush']);
      const fail = G.playCard(0);
      const mid = S();
      G.setEnergy('p1', 3);
      const pass = G.playCard(0);
      const end = S();
      ok('3b', !fail.ok && fail.error === 'energy' && mid.p1.energy === 2 && mid.p1.handN === 1 &&
        pass.ok && end.p1.energy === 0 && end.p1.handN === 0,
        `3 费牌：2 能量拒绝（${fail.error}），3 能量打出后 ${end.p1.energy}`);
    }

    // 3c — class counter multiplier
    {
      startLocal('blade', 'ranger', 70005);
      G.setEnergy('p1', 10);
      G.setHand('p1', ['quick_slash']);
      G.setHp('p2', 30);
      G.setBlock('p2', 0);
      const r = G.playCard(0);
      const s = S();
      const mult = G.counterMultiplier('blade', 'ranger');
      ok('3c', r.ok && Math.abs(mult - 1.15) < 1e-9 && s.p2.hp === 25,
        `剑士克游侠 ×${mult.toFixed(2)}：4 → 5 伤害，P2 hp=${s.p2.hp}`);
    }

    // 4 — score economy
    {
      startAI('medium', 'blade', 'ranger', 71002);
      G.setEnergy('p1', 10);
      G.setHand('p1', ['quick_slash']);
      G.setHp('p2', 30);
      G.setBlock('p2', 0);
      const s0 = S().score;
      G.playCard(0);
      const s1 = S();
      G.forceWin();
      const s2 = S();
      ok(4, Number.isFinite(s1.score) && s1.score > s0 && Number.isInteger(s2.score) && s2.score > 1000,
        `得分 ${s0} → ${s1.score} → 胜利 ${s2.score}`);
    }

    // 5 — loss path reachable
    {
      frames.length = 0;
      startAI('hard', 'blade', 'mage', 71003);
      G.forceLose();
      const s = S();
      ok(5, s.screen === 'over' && s.winner === 'p2' && s.endVisible && frames.some(f => f.kind === 'gameOver'),
        `失败路径 screen=${s.screen} winner=${s.winner} gameOver=${frames.some(f => f.kind === 'gameOver')}`);
    }

    // 6 — win path reachable
    {
      frames.length = 0;
      startAI('easy', 'blade', 'ranger', 71004);
      G.forceWin();
      const s = S();
      ok(6, s.screen === 'over' && s.winner === 'p1' && s.endVisible && frames.some(f => f.kind === 'complete'),
        `胜利路径 screen=${s.screen} winner=${s.winner} complete=${frames.some(f => f.kind === 'complete')}`);
    }

    // 7 — report frame order
    {
      const log = G.reportLog();
      const ri = log.findIndex(f => f.kind === 'ready');
      const pi = frames.findIndex(f => f.kind === 'progress');
      const ci = frames.findIndex(f => f.kind === 'complete' || f.kind === 'gameOver');
      ok(7, ri === 0 && pi >= 0 && ci > pi && Number.isInteger(frames[ci].score),
        `帧序 ready=${ri} progress=${pi} final=${ci} score=${frames[ci] && frames[ci].score}`);
    }

    // 8 — best localStorage write / restore
    {
      try {
        localStorage.removeItem(KEY.wins); localStorage.removeItem(KEY.losses); localStorage.removeItem(KEY.best);
      } catch (e) { }
      records.wins = 0; records.losses = 0; records.best = 0;
      startAI('easy', 'blade', 'ranger', 71005);
      G.forceWin();
      let w = 0, b = 0;
      try { w = parseInt(localStorage.getItem(KEY.wins) || '0', 10); b = parseInt(localStorage.getItem(KEY.best) || '0', 10); } catch (e) { }
      try {
        localStorage.setItem(KEY.wins, '7'); localStorage.setItem(KEY.best, '1234');
      } catch (e) { }
      G.reloadRecords();
      const restored = S();
      ok(8, w >= 1 && b > 0 && restored.wins === 7 && restored.best === 1234,
        `best 写入 ${w}胜/${b}分，重读 ${restored.wins}胜/${restored.best}分`);
      try {
        if (saved.lw === null) localStorage.removeItem(KEY.wins); else localStorage.setItem(KEY.wins, saved.lw);
        if (saved.ll === null) localStorage.removeItem(KEY.losses); else localStorage.setItem(KEY.losses, saved.ll);
        if (saved.lb === null) localStorage.removeItem(KEY.best); else localStorage.setItem(KEY.best, saved.lb);
      } catch (e) { }
      records.wins = saved.wins; records.losses = saved.losses; records.best = saved.best;
      G.reloadRecords();
    }

    // 9-11 — keyboard input simulation consumed in update
    {
      startLocal('blade', 'blade', 70006);
      G.setEnergy('p1', 5);
      G.setHand('p1', ['quick_slash', 'wood_guard']);
      G.setHp('p2', 30); G.setBlock('p2', 0);
      G.press('Digit1'); G.upd(1);
      const sel = S().selected;
      ok(9, sel === 0, `键盘 Digit1 选中第 1 张（selected=${sel}）`);
      G.press('Enter'); G.upd(1);
      const played = S();
      ok(10, played.p1.handN === 1 && played.p1.energy === 4 && played.p2.hp === 26,
        `Enter 出牌：手牌 2→${played.p1.handN}，能量 5→${played.p1.energy}，P2 30→${played.p2.hp}`);
      G.press('KeyE'); G.upd(1);
      const turned = S();
      ok(11, turned.active === 'p2' && turned.privacyPending && turned.privacyVisible,
        `E 结束回合：active=${turned.active} privacy=${turned.privacyPending}`);
    }

    // 12 — library count and categories
    {
      const lib = G.getLibrary();
      const cats = new Set(lib.map(c => c.cat));
      ok(12, lib.length === 20 && cats.has('attack') && cats.has('defense') && cats.has('spell'),
        `20 张卡牌库 / 分类 ${[...cats].join(',')}`);
    }

    // 13 — three preset 20-card decks
    {
      const decks = G.getDecks();
      const keys = Object.keys(decks);
      const all20 = keys.length === 3 && keys.every(k => decks[k].length === 20 && decks[k].every(id => !!CARD_MAP[id]));
      ok(13, all20, `三套预设牌组 ${keys.map(k => `${k}:${decks[k].length}`).join(' / ')}`);
    }

    // 14 — starting hand 5
    {
      const s = startLocal('ranger', 'mage', 70007);
      ok(14, s.p1.handN === 5 && s.p2.handN === 5 && s.p1.energy === 1 && s.p2.energy === 1,
        `双方起手 ${s.p1.handN}/${s.p2.handN} 张，能量 ${s.p1.energy}/${s.p2.energy}`);
    }

    // 15 — draw / reshuffle invariants
    {
      const s0 = startLocal('blade', 'ranger', 70008);
      const inv0 = s0.p1Total === 20 && s0.p2Total === 20;
      G.primeReshuffle('p1');
      const before = S();
      const drawn = G.drawForTest('p1', 2);
      const s1 = S();
      ok(15, inv0 && before.p1.deckN === 0 && drawn.length === 2 && s1.p1Total === 20 && s1.p2Total === 20 && s1.reshuffles >= 1,
        `牌量守恒 20：${s1.p1Total}/${s1.p2Total}，洗回 ${s1.reshuffles} 次，抽到 ${drawn.length} 张`);
    }

    // 16 — energy +1 each turn, cap 10
    {
      startLocal('blade', 'ranger', 70009);
      const startMax = S().p1.maxEnergy;
      for (let i = 0; i < 20; i++) {
        G.endTurn();
        if (S().privacyPending) G.skipPrivacy();
      }
      const s = S();
      ok(16, startMax === 1 && s.p1.maxEnergy === 10 && s.p2.maxEnergy === 10 && s.p1.energy <= 10 && s.p2.energy <= 10,
        `能量 1 → P1/P2 ${s.p1.maxEnergy}/${s.p2.maxEnergy}（上限 10）`);
    }

    // 17 — AI tiers / policies
    {
      const tiers = G.getAiTiers();
      ok(17, Object.keys(tiers).length === 3 && tiers.easy.policy === 'random legal' && tiers.medium.policy === 'greedy value' && tiers.hard.policy === 'one-turn lookahead',
        `AI 三档 ${Object.values(tiers).map(t => `${t.name}:${t.policy}`).join(' / ')}`);
    }

    // 18 — local privacy overlay and hidden hand
    {
      G.startGame('local', 'medium', 'blade', 'ranger', { seed: 70010 });
      const hidden = S();
      const domHidden = hidden.privacyPending && hidden.privacyVisible && hidden.privacyHandRendered === 0 && hidden.p1.handN === 5;
      G.skipPrivacy();
      const shown = S();
      ok(18, domHidden && !shown.privacyPending && shown.privacyHandRendered > 0,
        `隐私交接：交接时手牌 DOM=${hidden.privacyHandRendered}，继续后 ${shown.privacyHandRendered} 张`);
    }

    // 19 — restart reset
    {
      startLocal('blade', 'mage', 70011);
      G.setEnergy('p1', 7); G.setHp('p2', 12);
      G.press('KeyR'); G.upd(1);
      const s = S();
      ok(19, s.turn === 1 && s.p1.hp === 30 && s.p2.hp === 30 && s.p1.handN === 5 && s.p1.energy === 1 && s.p1Class === 'blade',
        `重开复位：turn=${s.turn} hp=${s.p1.hp}/${s.p2.hp} hand=${s.p1.handN} energy=${s.p1.energy}`);
    }

    // 20 — full AI match fast-forward + determinism
    {
      const a = G.runSelfplay(8, 'medium');
      const b = G.runSelfplay(8, 'medium');
      ok(20, a.games === 8 && a.errors === 0 && a.played === 8 && a.avgTurns > 0 && a.p1Wins === b.p1Wins && a.p2Wins === b.p2Wins,
        `AI 整局快进 8 场 ×2 一致：p1/p2 ${a.p1Wins}/${a.p2Wins}，均 ${a.avgTurns.toFixed(1)} 回合`);
    }

    // 21 — reduced same-tier first/second balance at 40 games/tier
    {
      const rows = ['easy', 'medium', 'hard'].map(d => ({ d, r: G.runSelfplay(40, d) }));
      const okAll = rows.every(x => x.r.errors === 0 && x.r.firstRate >= .40 && x.r.firstRate <= .60 && x.r.secondRate >= .40 && x.r.secondRate <= .60);
      ok(21, okAll, `同档自对弈 40 局/档（先手/后手）：` + rows.map(x => `${x.d} ${(x.r.firstRate * 100).toFixed(1)}/${(x.r.secondRate * 100).toFixed(1)}`).join(' · '));
    }

    // 22 — reduced difficulty benchmark ordering / gap
    {
      const e = G.runBenchmark(40, 'easy');
      const m = G.runBenchmark(40, 'medium');
      const h = G.runBenchmark(40, 'hard');
      const wr = [e.winRate, m.winRate, h.winRate];
      ok(22, e.errors === 0 && m.errors === 0 && h.errors === 0 && wr[0] < wr[1] && wr[1] < wr[2] && (wr[1] - wr[0]) >= .15 && (wr[2] - wr[1]) >= .15,
        `对固定贪心基准 40 局/档：易 ${(wr[0] * 100).toFixed(1)}% / 中 ${(wr[1] * 100).toFixed(1)}% / 难 ${(wr[2] * 100).toFixed(1)}%`);
    }

    // 23 — pause / resume
    {
      startLocal('blade', 'ranger', 70012);
      G.press('KeyP'); G.upd(1);
      const p1 = S();
      G.upd(12);
      const p1b = S();
      G.press('KeyP'); G.upd(1);
      const p2 = S();
      ok(23, p1.paused && p1b.paused && p1.pauseVisible && p1.turn === p1b.turn && !p2.paused,
        `暂停冻结/恢复 paused=${p1.paused}→${p2.paused}`);
    }

    // 24 — mute toggle (restore muted)
    {
      const m0 = S().muted;
      G.press('KeyM'); G.upd(1); G.release('KeyM');
      const m1 = S().muted;
      G.press('KeyM'); G.upd(1); G.release('KeyM');
      const m2 = S().muted;
      ok(24, m1 !== m0 && m2 === m0, `M 静音 ${m0}→${m1}→${m2}`);
      if (!muted) { muted = true; audio.setMuted(true); updateUI(); }
    }

    // 25 — mute + no AudioContext in autotest
    ok(25, muted === true && audio.hasCtx() === false,
      '自测全程静音，未创建 AudioContext');

    // 26 — no external requests
    {
      const ext = performance.getEntriesByType('resource').filter(e => {
        try { return new URL(e.name).origin !== location.origin; } catch (err) { return false; }
      });
      ok(26, (Number(window.__EXTREQ) || 0) === 0 && ext.length === 0,
        `外网请求 ${window.__EXTREQ || 0} 次 / 外部资源 ${ext.length} 个`);
    }

    // 27 — real DOM click selects then plays
    {
      startAI('medium', 'blade', 'blade', 71006);
      G.setEnergy('p1', 10);
      G.setHand('p1', ['quick_slash']);
      G.setHp('p2', 30); G.setBlock('p2', 0);
      const card = document.querySelector('#hand .card');
      let selAfter = -1, hpAfter = 30;
      if (card) {
        card.click();
        selAfter = S().selected;
        card.click();
        hpAfter = S().p2.hp;
      }
      ok(27, !!card && selAfter === 0 && hpAfter === 26,
        `鼠标/触屏点击卡牌：选中 ${selAfter}，P2 hp=${hpAfter}`);
    }

    // 28 — end-turn button click
    {
      startAI('medium', 'blade', 'ranger', 71007);
      const btn = document.getElementById('endturn');
      btn.click();
      const s = S();
      ok(28, !!btn && s.active === 'p2' && !s.humanTurn && s.turn === 2,
        `结束回合按钮：active=${s.active} turn=${s.turn}`);
    }

    // 29 — class selection / mode UI
    {
      G.goTitle();
      const chips = document.querySelectorAll('.class-chip');
      const modes = document.querySelectorAll('.modebtn');
      ok(29, chips.length === 6 && modes.length === 4 && S().titleVisible,
        `标题职业选择 ${chips.length} 项，模式 ${modes.length} 项`);
    }

    // 30 — AI mode human is P1 and plays first
    {
      const s = startAI('medium', 'blade', 'mage', 71008);
      ok(30, s.mode === 'ai' && s.active === 'p1' && s.humanTurn && s.humanSide === 'p1' && !s.privacyPending,
        `AI 模式人类固定 P1：active=${s.active} human=${s.humanTurn}`);
    }

    // 31 — ending a game and going to title
    {
      G.forceLose();
      const over = S();
      G.goTitle();
      const s = S();
      ok(31, over.screen === 'over' && s.screen === 'title' && s.titleVisible && !s.endVisible && s.privacyHandRendered === 0,
        `结算→回标题 screen=${s.screen} title=${s.titleVisible}`);
    }

    // 32 — assertion count
    ok(32, results.length >= 30, `断言覆盖 ${results.length} 条（≥30）`);

    // 33 — all report scores integer / progress bounded
    {
      const log = G.reportLog();
      const progs = log.filter(f => f.kind === 'progress');
      const finals = log.filter(f => f.kind === 'complete' || f.kind === 'gameOver');
      const good = progs.length > 0 && finals.length > 0 && progs.every(f => Number.isInteger(f.score) && f.progress >= 0 && f.progress <= 100) &&
        finals.every(f => Number.isInteger(f.score));
      ok(33, good, `上报 progress ${progs.length} 帧 / final ${finals.length} 帧，score 均为整数`);
    }

    // HELP — 标题「玩法说明」双栏弹层可开合、键位与规则齐全
    {
      if (window.G && typeof window.G.goTitle === 'function') window.G.goTitle();
      const hb = document.getElementById('helpOpen');
      const hm = document.getElementById('helpModal');
      const hc = document.getElementById('helpClose');
      if (hb) hb.click();
      const openOk = !!hm && !hm.classList.contains('hide');
      const txt = hm ? hm.textContent : '';
      if (hc) hc.click();
      const closedOk = !!hm && hm.classList.contains('hide');
      ok('H1', !!hb && !!hm && !!hc && openOk && closedOk &&
        txt.includes('双人对战') && txt.includes('人机对战') &&
        txt.includes('键位') && txt.includes('规则'),
        `玩法说明：双人/人机两栏 · 键位/规则 · 开合=${openOk}/${closedOk}`);
    }

  } catch (err) {
    window.__TEST_ERR = String((err && err.stack) || err);
    T.fail++;
    results.push({ id: 'ERR', ok: false, name: `autotest crashed: ${window.__TEST_ERR}` });
    console.log('[autotest] crash', window.__TEST_ERR);
    try { G.goTitle(); } catch (e) { }
  } finally {
    G.setReportTarget(null);
    G.setNoAuto(false);
    records.wins = saved.wins; records.losses = saved.losses; records.best = saved.best;
    muted = saved.muted; audio.setMuted(muted);
    try {
      if (saved.lw === null) localStorage.removeItem(KEY.wins); else localStorage.setItem(KEY.wins, saved.lw);
      if (saved.ll === null) localStorage.removeItem(KEY.losses); else localStorage.setItem(KEY.losses, saved.ll);
      if (saved.lb === null) localStorage.removeItem(KEY.best); else localStorage.setItem(KEY.best, saved.lb);
      if (saved.lm === null) localStorage.removeItem(KEY.mute); else localStorage.setItem(KEY.mute, saved.lm);
    } catch (e) { }
    try { goTitle(); } catch (e) { }
    await nap();
    T.total = results.length;
    T.pass = results.filter(r => r.ok).length;
    T.fail = results.length - T.pass;
    T.done = true;
    console.log(`[autotest] ${T.pass}/${T.total} passed, ${T.fail} failed`);
  }
}

if (AUTOTEST) autotest();
