// Lexicon Bastion 词垒防线 — 2D Canvas typing defence.
// Night-paper art, a stone word-fortress, copper-gold enemy words and jade
// impact sparks. Fixed-step loop, deterministic RNG, G debug hooks and a
// 42-assertion ?autotest=1 suite modelled on starfall-bulwark / bridgewright.

import { makeAudio } from './audio.js';
import { pickWord, bossSegmentsFor, mulberry32, WORD_COUNTS } from './words.js';

const DT = 1 / 60;
const PARAMS = new URLSearchParams(location.search);
const AUTOTEST = PARAMS.has('autotest');

const SERIF = '"Noto Serif CJK SC","STKaiti","KaiTi",serif';
const LATIN = 'Georgia,"Times New Roman",serif';

const ENEMY_DEFS = {
  slab:     { zh: '厚壁', glyph: '厚', baseHp: 3, dmg: 12, speed: .028, scale: 1.12, body: [52, 32], killScore: 16, color: ['#e8795c', '#8f2e2b'] },
  darter:   { zh: '疾羽', glyph: '疾', baseHp: 1, dmg: 8,  speed: .058, scale: .92, body: [26, 36], killScore: 12, color: ['#f08a5f', '#a3432f'] },
  splitter: { zh: '裂晶', glyph: '裂', baseHp: 2, dmg: 10, speed: .038, scale: 1.00, body: [36, 34], killScore: 18, color: ['#d06588', '#7d2e4f'] },
  shield:   { zh: '盾鳞', glyph: '盾', baseHp: 1, dmg: 14, speed: .033, scale: 1.04, body: [36, 42], killScore: 20, color: ['#d95f4b', '#7e2b2b'], shield: 1 },
  shard:    { zh: '碎晶', glyph: '碎', baseHp: 1, dmg: 4,  speed: .052, scale: .62, body: [24, 24], killScore: 6,  color: ['#e888a5', '#8e3a57'] },
  boss:     { zh: '垒主', glyph: '垒', baseHp: 2, dmg: 40, speed: .030, scale: 1.00, body: [110, 110], killScore: 170, color: ['#e2603f', '#6e2323'] },
};

const STORE = { best: 'lxb.best', wave: 'lxb.wave', combo: 'lxb.combo', acc: 'lxb.acc', wpm: 'lxb.wpm', mute: 'lxb.mute' };

// ---------- DOM ----------
const $ = id => document.getElementById(id);
const cv = $('gl');
const ctx = cv.getContext('2d');
const el = {
  hud: $('hud'), waveNum: $('waveNum'), waveSub: $('waveSub'), inkVal: $('inkVal'), scoreVal: $('scoreVal'),
  accVal: $('accVal'), wpmVal: $('wpmVal'), comboVal: $('comboVal'), bestVal: $('bestVal'),
  hpwrap: $('hpwrap'), hpFill: $('hpFill'), hpNum: $('hpNum'),
  chargewrap: $('chargewrap'), chargeFill: $('chargeFill'), chargeVal: $('chargeVal'),
  bossbar: $('bossbar'), bossName: $('bossName'), bossPips: $('bossPips'), bossFill: $('bossFill'),
  title: $('title'), titleBest: $('titleBest'), titleWave: $('titleWave'), titleCombo: $('titleCombo'), titleAcc: $('titleAcc'), titleWpm: $('titleWpm'),
  draft: $('draft'), draftInk: $('draftInk'), draftCards: $('draftCards'), draftSkip: $('draftSkip'),
  milestone: $('milestone'), msScore: $('msScore'), msWave: $('msWave'), msAcc: $('msAcc'), msWpm: $('msWpm'), msCombo: $('msCombo'), msKills: $('msKills'),
  end: $('end'), endKick: $('endKick'), endTitle: $('endTitle'), endReason: $('endReason'),
  endScore: $('endScore'), endWave: $('endWave'), endAcc: $('endAcc'), endWpm: $('endWpm'), endCombo: $('endCombo'), endKills: $('endKills'),
  endContinue: $('endContinue'), endRetry: $('endRetry'), endHome: $('endHome'),
  pause: $('pause'), pauseResume: $('pauseResume'),
  banner: $('banner'), bannerMain: $('bannerMain'), bannerSub: $('bannerSub'), toast: $('toast'),
  typebar: $('typebar'), typefield: $('typefield'), vkToggle: $('vkToggle'), vkb: $('vkb'),
  tPause: $('tPause'), tMute: $('tMute'), tRestart: $('tRestart'),
  btnMute: $('btnMute'), btnPause: $('btnPause'), btnRestart: $('btnRestart'),
};

// ---------- state ----------
let mode = 'title';                 // title | play | ready | draft | milestone | over
let paused = false, noAuto = false;
let wave = 0, score = 0, ink = 0, hp = 100, maxHp = 100;
let combo = 0, maxCombo = 0, correctChars = 0, misses = 0;
let wordsDone = 0, kills = 0, leaks = 0, volleys = 0;
let fireLv = 0, wordLv = 0, guardLv = 0;
let activeT = 0, visualT = 0, charge = 0;
let enemies = [], queue = [], bolts = [], particles = [], rings = [], floats = [], motes = [];
let lockId = 0, nextId = 1;
let waveT = 0, waveReadyT = 0, waveActive = false;
let pendingMilestone = false, milestoneDone = false, endless = false;
let hitstop = 0, shakeT = 0, shakeAmp = 0, flashT = 0, flashRGB = '255,240,210';
let draftCards = [];
let bannerTimer = 0, toastTimer = 0;
let reportTarget = null;
const reports = [];
let seed = (Date.now() ^ 0x9e3779b9) >>> 0;
let rng = mulberry32(seed);
let recentWords = [];
let touchMode = false;

const audio = makeAudio();

// ---------- storage ----------
let rec = { best: 0, wave: 0, combo: 0, acc: 0, wpm: 0 };
function loadRecords() {
  const num = (k, d = 0) => { try { const v = parseFloat(localStorage.getItem(k)); return Number.isFinite(v) ? v : d; } catch (e) { return d; } };
  rec.best = Math.max(0, Math.round(num(STORE.best)));
  rec.wave = Math.max(0, Math.round(num(STORE.wave)));
  rec.combo = Math.max(0, Math.round(num(STORE.combo)));
  rec.acc = Math.max(0, Math.min(100, num(STORE.acc)));
  rec.wpm = Math.max(0, Math.round(num(STORE.wpm)));
}
function persistRecords() {
  try {
    localStorage.setItem(STORE.best, String(rec.best));
    localStorage.setItem(STORE.wave, String(rec.wave));
    localStorage.setItem(STORE.combo, String(rec.combo));
    localStorage.setItem(STORE.acc, String(rec.acc));
    localStorage.setItem(STORE.wpm, String(rec.wpm));
  } catch (e) { }
}
function saveRecords() {
  rec.best = Math.max(rec.best, Math.round(score));
  rec.wave = Math.max(rec.wave, wave);
  rec.combo = Math.max(rec.combo, maxCombo);
  if (correctChars + misses >= 10) rec.acc = Math.max(rec.acc, +accuracyPct().toFixed(1));
  rec.wpm = Math.max(rec.wpm, wpmNow());
  persistRecords();
}
function storageSnapshot() {
  const o = {};
  for (const k of Object.values(STORE)) { try { o[k] = localStorage.getItem(k); } catch (e) { o[k] = null; } }
  return o;
}
function restoreStorage(snap) {
  for (const k of Object.values(STORE)) {
    try {
      if (!snap || snap[k] == null) localStorage.removeItem(k);
      else localStorage.setItem(k, snap[k]);
    } catch (e) { }
  }
  loadRecords();
  updateTitleRecords();
  updateHUD();
}
loadRecords();

// ---------- protocol ----------
function toWireReport(frame) {
  const scoreR = Number.isFinite(frame.score) ? Math.round(frame.score) : undefined;
  if (frame.kind === 'progress') return { kind: 'progress', data: { ...frame } };
  if (frame.kind === 'event') return { kind: 'event', event: String(frame.event || frame.tag || 'event'), data: { ...frame } };
  if (frame.kind === 'gameOver') return { kind: 'gameOver', score: scoreR, progress: { value: frame.progress }, data: { ...frame } };
  if (frame.kind === 'complete') return { kind: 'complete', score: scoreR };
  return frame;
}
function report(kind, payload = {}) {
  const frame = { kind, ...payload };
  reports.push(frame);
  try {
    if (reportTarget) reportTarget(frame);
    else if (window.parent !== window) {
      window.parent.postMessage({ source: 'lightgame', type: 'lightgame:report', payload: toWireReport(frame) }, '*');
      if (frame.kind === 'ready') window.parent.postMessage({ source: 'lightgame', type: 'lightgame:ready', gameId: 'lexicon-bastion', v: 1 }, '*');
    }
  } catch (e) { }
}
report('ready', { game: 'lexicon-bastion' });

// ---------- math / rules ----------
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function accuracyPct() { const t = correctChars + misses; return t ? (correctChars / t) * 100 : 100; }
function wpmNow() { return activeT >= 3 ? Math.round((correctChars / 5) / (activeT / 60)) : 0; }
function wordLenCap() {
  const base = Math.min(10, 4 + Math.floor(Math.max(0, wave - 1) / 2));
  return Math.max(3, base - wordLv);
}
function wordDamage() { return 1 + fireLv; }
function wordReward(len, c = combo) { return { score: Math.round(len * 6 + c * 3), ink: 2 + Math.floor(c / 3) + Math.floor(len / 3) }; }
function chargeGain(c = combo, acc = accuracyPct() / 100) { return (2 + Math.min(c, 20) * .15) * (.6 + acc * .4); }
function levelOf(kind) { return kind === 'fire' ? fireLv : kind === 'word' ? wordLv : guardLv; }
function upgradeCost(kind) { return 20 + 12 * levelOf(kind); }
function isBossWave(w) { return w > 0 && (w % 8 === 0 || w === 10); }
function speedMult() { return 1 + Math.min(.5, (Math.max(1, wave) - 1) * .022); }
function availableKinds(w) {
  const a = ['slab', 'slab', 'darter', 'darter'];
  if (w >= 2) a.push('splitter');
  if (w >= 3) a.push('shield');
  if (w >= 5) a.push('darter');
  return a;
}
function waveSpec(w) {
  const boss = isBossWave(w);
  const count = boss ? 1 : clamp(4 + Math.floor(w * 1.15), 5, 16);
  const interval = Math.max(.42, 1.05 - w * .03);
  return { boss, count, interval, kinds: availableKinds(w) };
}

// ---------- layout / canvas ----------
let DPR = 1, VW = 960, VH = 540, wallY = 470, lanes = 7, portrait = false;
let viewScale = 1, viewOX = 0, viewOY = 0;
const bgCv = document.createElement('canvas');
let layoutKey = '';
function laneX(i) { return VW * (i + .5) / lanes; }
function computeLayout() {
  const p = innerWidth / Math.max(1, innerHeight) < .95;
  const nw = p ? 560 : 960, nh = p ? 860 : 540;
  const key = nw + 'x' + nh;
  const changed = key !== layoutKey;
  VW = nw; VH = nh; portrait = p; wallY = p ? 760 : 470; lanes = p ? 5 : 7;
  DPR = Math.min(2, window.devicePixelRatio || 1);
  cv.width = Math.round(innerWidth * DPR);
  cv.height = Math.round(innerHeight * DPR);
  viewScale = Math.min(innerWidth / VW, innerHeight / VH);
  viewOX = (innerWidth - VW * viewScale) / 2;
  viewOY = (innerHeight - VH * viewScale) / 2;
  if (changed) {
    layoutKey = key;
    rebuildBackground();
    resetMotes();
  }
}
function rrect(c, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}
function diamondPath(c, x, y, r) {
  c.beginPath(); c.moveTo(x, y - r); c.lineTo(x + r, y); c.lineTo(x, y + r); c.lineTo(x - r, y); c.closePath();
}

function rebuildBackground() {
  bgCv.width = Math.round(VW * 2); bgCv.height = Math.round(VH * 2);
  const c = bgCv.getContext('2d');
  c.setTransform(2, 0, 0, 2, 0, 0);
  const rnd = mulberry32(0x51abcdef);
  const g = c.createLinearGradient(0, 0, 0, VH);
  g.addColorStop(0, '#080d1f'); g.addColorStop(.55, '#0d1631'); g.addColorStop(1, '#101b3a');
  c.fillStyle = g; c.fillRect(0, 0, VW, VH);

  // faint manuscript ruling
  c.strokeStyle = 'rgba(196,214,240,.026)'; c.lineWidth = 1;
  for (let y = 36; y < wallY; y += 42) {
    c.beginPath(); c.moveTo(0, y + .5); c.lineTo(VW, y + .5); c.stroke();
  }
  // paper grain
  for (let i = 0; i < 2500; i++) {
    const x = rnd() * VW, y = rnd() * VH;
    const a = .015 + rnd() * .035;
    c.fillStyle = rnd() < .5 ? `rgba(240,226,198,${a})` : `rgba(120,224,200,${a * .55})`;
    c.fillRect(x, y, rnd() < .85 ? 1 : 2, 1);
  }
  // great faded sigil
  const cx = VW / 2, cy = VH * .36, R = Math.min(VW, VH) * .31;
  c.save();
  c.strokeStyle = 'rgba(217,163,91,.06)'; c.lineWidth = 1;
  c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.stroke();
  c.beginPath(); c.arc(cx, cy, R * .74, 0, Math.PI * 2); c.stroke();
  for (let i = 0; i < 24; i++) {
    const a = i / 24 * Math.PI * 2;
    c.beginPath();
    c.moveTo(cx + Math.cos(a) * R * .8, cy + Math.sin(a) * R * .8);
    c.lineTo(cx + Math.cos(a) * (R * .8 + (i % 3 === 0 ? 12 : 5)), cy + Math.sin(a) * (R * .8 + (i % 3 === 0 ? 12 : 5)));
    c.stroke();
  }
  c.strokeStyle = 'rgba(120,224,200,.035)';
  diamondPath(c, cx, cy, R * .18); c.stroke();
  c.restore();

  // faint ink-wash sweeps
  c.save();
  c.strokeStyle = 'rgba(96,150,200,.045)';
  for (let i = 0; i < 4; i++) {
    const yy = VH * (.18 + i * .11);
    c.lineWidth = 14 + i * 5;
    c.beginPath();
    c.moveTo(-40, yy);
    c.bezierCurveTo(VW * .28, yy - 40 - i * 8, VW * .6, yy + 34, VW + 40, yy - 8);
    c.stroke();
  }
  c.restore();

  // drifting ghost glyphs fixed into the paper
  const ghost = ['W', 'O', 'R', 'D', 'A', 'Z', '词', '垒', '墨', '光', 'L', 'X', 'B', 'T', 'N'];
  for (let i = 0; i < ghost.length; i++) {
    const gx = (i * 173.7 + 61) % VW;
    const gy = VH * .12 + ((i * 97.3) % (VH * .56));
    c.globalAlpha = .022 + (i % 4) * .008;
    c.fillStyle = i % 3 === 0 ? '#78e0c8' : '#e8c07a';
    c.font = `${26 + (i % 5) * 9}px ${i > 5 ? SERIF : LATIN}`;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(ghost[i], gx, gy);
  }
  c.globalAlpha = 1;

  // slim side rails with rune notches
  for (const rx of [34, VW - 34]) {
    c.strokeStyle = 'rgba(217,163,91,.075)'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(rx + .5, 20); c.lineTo(rx + .5, wallY - 24); c.stroke();
    for (let y = 44; y < wallY - 30; y += 58) {
      c.fillStyle = 'rgba(217,163,91,.10)';
      diamondPath(c, rx, y, 2.6); c.fill();
    }
  }

  // horizon mist just above the wall
  const mist = c.createLinearGradient(0, wallY - 130, 0, wallY - 4);
  mist.addColorStop(0, 'rgba(120,224,200,0)');
  mist.addColorStop(.7, 'rgba(120,224,200,.045)');
  mist.addColorStop(1, 'rgba(232,192,122,.05)');
  c.fillStyle = mist; c.fillRect(0, wallY - 130, VW, 126);

  // fortress wall
  const top = wallY;
  const wg = c.createLinearGradient(0, top, 0, VH);
  wg.addColorStop(0, '#1b2339'); wg.addColorStop(.5, '#111a2f'); wg.addColorStop(1, '#080d19');
  c.fillStyle = wg; c.fillRect(0, top, VW, VH - top);

  // stone courses
  let y = top + 20, row = 0;
  while (y < VH) {
    const h = 22 + rnd() * 9;
    let x = -20 - rnd() * 20;
    while (x < VW) {
      const w = 34 + rnd() * 54;
      const shade = 18 + Math.floor(rnd() * 12);
      c.fillStyle = `rgb(${shade + 6},${shade + 12},${shade + 26})`;
      rrect(c, x + 2, y + 2, w - 4, Math.min(h - 4, VH - y - 2), 4); c.fill();
      c.strokeStyle = 'rgba(217,163,91,.10)'; c.lineWidth = 1; c.stroke();
      c.fillStyle = 'rgba(255,232,196,.035)';
      c.fillRect(x + 6, y + 4, w - 12, 1.5);
      x += w + 3;
    }
    y += h + 3; row++;
    if (row > 40) break;
  }

  // crenellated parapet
  c.fillStyle = '#1c2743';
  const crenW = 28, gap = 22;
  for (let x = -10; x < VW + 30; x += crenW + gap) {
    c.fillRect(x, top - 15, crenW, 16);
    c.fillStyle = 'rgba(217,163,91,.28)';
    c.fillRect(x, top - 15, crenW, 1.5);
    c.fillStyle = '#1c2743';
  }
  c.fillStyle = 'rgba(217,163,91,.42)';
  c.fillRect(0, top - 1, VW, 1.4);
  c.fillStyle = 'rgba(120,224,200,.10)';
  c.fillRect(0, top + 1, VW, 4);

  // central gate plaque
  const gw = Math.min(150, VW * .2);
  c.fillStyle = 'rgba(4,7,15,.55)';
  rrect(c, VW / 2 - gw / 2, top + 18, gw, VH - top - 22, 9); c.fill();
  c.strokeStyle = 'rgba(217,163,91,.22)'; c.lineWidth = 1.4; c.stroke();
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillStyle = 'rgba(232,192,122,.30)';
  c.font = `700 ${Math.max(18, Math.round(VW * .028))}px ${SERIF}`;
  c.fillText('词 垒', VW / 2, top + 46);
  c.strokeStyle = 'rgba(120,224,200,.12)'; c.lineWidth = 1;
  c.beginPath(); c.moveTo(VW / 2 - gw * .3, top + 62); c.lineTo(VW / 2 + gw * .3, top + 62); c.stroke();

  // hanging banners
  for (const bx of [VW * .13, VW * .87]) {
    c.strokeStyle = 'rgba(217,163,91,.35)'; c.lineWidth = 1.4;
    c.beginPath(); c.moveTo(bx, top - 22); c.lineTo(bx, top + 76); c.stroke();
    const bg = c.createLinearGradient(bx, top, bx, top + 76);
    bg.addColorStop(0, 'rgba(143,46,43,.55)'); bg.addColorStop(1, 'rgba(70,24,28,.25)');
    c.fillStyle = bg;
    c.beginPath(); c.moveTo(bx + 2, top + 6); c.lineTo(bx + 20, top + 6); c.lineTo(bx + 20, top + 66); c.lineTo(bx + 11, top + 75); c.lineTo(bx + 2, top + 66); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(217,163,91,.22)'; c.stroke();
    c.fillStyle = 'rgba(247,224,178,.45)';
    c.font = `700 10px ${SERIF}`; c.textAlign = 'center';
    c.fillText('垒', bx + 11, top + 30);
  }

  // vignette
  const vg = c.createRadialGradient(VW / 2, VH * .4, VH * .12, VW / 2, VH * .48, Math.max(VW, VH) * .72);
  vg.addColorStop(0, 'rgba(2,5,12,0)'); vg.addColorStop(1, 'rgba(2,5,12,.66)');
  c.fillStyle = vg; c.fillRect(0, 0, VW, VH);

  // corner ornaments
  c.strokeStyle = 'rgba(217,163,91,.18)'; c.lineWidth = 1;
  for (const [ox, oy, sx, sy] of [[14, 14, 1, 1], [VW - 14, 14, -1, 1], [14, VH - 14, 1, -1], [VW - 14, VH - 14, -1, -1]]) {
    c.beginPath();
    c.moveTo(ox + sx * 30, oy); c.lineTo(ox, oy); c.lineTo(ox, oy + sy * 30);
    c.stroke();
    c.beginPath(); c.arc(ox + sx * 8, oy + sy * 8, 2, 0, Math.PI * 2); c.stroke();
  }
}

function resetMotes() {
  const r = mulberry32(0x77cc11);
  motes = [];
  const n = portrait ? 30 : 46;
  for (let i = 0; i < n; i++) {
    motes.push({ x: r() * VW, y: r() * VH * .88, rad: .6 + r() * 1.8, sp: 5 + r() * 15, ph: r() * 6.283, jade: r() < .68, a: .10 + r() * .20 });
  }
}
function updateMotes(dt) {
  for (const m of motes) {
    m.y -= m.sp * dt;
    m.x += Math.sin(visualT * .55 + m.ph) * 2.2 * dt;
    if (m.y < -8) { m.y = VH * .9; m.x = ((m.ph * 137.3) % 1) * VW; }
  }
}

// ---------- state helpers ----------
function isNaNState() {
  const vals = [score, ink, hp, maxHp, charge, combo, correctChars, misses, activeT, wave, waveT];
  if (vals.some(v => !Number.isFinite(v))) return true;
  for (const e of enemies) {
    if (!Number.isFinite(e.y + e.xOff + e.typed)) return true;
    if (!Number.isFinite(e.drawX)) return true;
  }
  for (const b of bolts) if (!Number.isFinite(b.t)) return true;
  return false;
}
function updateTitleRecords() {
  el.titleBest.textContent = String(rec.best);
  el.titleWave.textContent = String(rec.wave);
  el.titleCombo.textContent = String(rec.combo);
  el.titleAcc.textContent = rec.acc.toFixed(1) + '%';
  el.titleWpm.textContent = String(rec.wpm);
}

// ---------- HUD ----------
const hudCache = {};
function setTxt(node, key, val) { if (hudCache[key] !== val) { hudCache[key] = val; node.textContent = val; } }
function setStyle(node, key, prop, val) { const k = key + '.' + prop; if (hudCache[k] !== val) { hudCache[k] = val; node.style[prop] = val; } }
function setClass(node, key, cls, on) { const k = 'cls.' + key + '.' + cls; if (hudCache[k] !== on) { hudCache[k] = on; node.classList.toggle(cls, on); } }

function updateHUD() {
  const acc = accuracyPct(), wpm = wpmNow();
  setTxt(el.waveNum, 'wave', wave > 0 ? `第 ${wave} 波` : '待命');
  setTxt(el.waveSub, 'wavesub', endless ? '无尽垒潮' : mode === 'draft' ? '墨能工坊' : (isBossWave(wave) && mode === 'play' ? '垒主来犯' : '敌词压境'));
  setTxt(el.inkVal, 'ink', String(Math.round(ink)));
  setTxt(el.scoreVal, 'score', String(Math.round(score)));
  setTxt(el.accVal, 'acc', acc.toFixed(1) + '%');
  setTxt(el.wpmVal, 'wpm', String(wpm));
  setTxt(el.comboVal, 'combo', String(combo));
  setTxt(el.bestVal, 'best', String(rec.best));
  setClass(el.comboVal, 'combohot', 'hot', combo >= 5);
  setTxt(el.hpNum, 'hpnum', `${Math.max(0, Math.round(hp))} / ${Math.round(maxHp)}`);
  setStyle(el.hpFill, 'hp', 'width', `${clamp(hp / maxHp * 100, 0, 100)}%`);
  setClass(el.hpwrap, 'hplow', 'low', hp / maxHp <= .3);
  setTxt(el.chargeVal, 'chg', `${Math.round(charge)}%`);
  setStyle(el.chargeFill, 'chgf', 'width', `${clamp(charge, 0, 100)}%`);
  setClass(el.chargewrap, 'chghot', 'hot', charge >= 75);

  const boss = enemies.find(e => e.boss && e.alive);
  setClass(el.bossbar, 'bossshow', 'hide', !boss);
  if (boss) {
    setTxt(el.bossName, 'bossname', `${boss.word ? boss.word.length : 0} 字母 · ${boss.hp}/${boss.maxHp} 段`);
    setTxt(el.bossPips, 'bosspips', `${boss.hp} / ${boss.maxHp}`);
    setStyle(el.bossFill, 'bossfill', 'width', `${clamp(boss.hp / boss.maxHp * 100, 0, 100)}%`);
  }

  const muted = audio.isMuted();
  setTxt(el.btnMute, 'mute', muted ? '静' : '声');
  setClass(el.btnMute, 'muteon', 'on', muted);
  setTxt(el.btnPause, 'pause', paused ? '▶' : 'Ⅱ');
  setTxt(el.tMute, 'tmute', muted ? '开启声音' : '静音');
  setTxt(el.tPause, 'tpause', paused ? '继续' : '暂停');
}

function showToast(msg, ms = 1700) {
  el.toast.textContent = msg;
  el.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.toast.classList.remove('show'), ms);
}
function showBanner(main, sub, ms = 1500) {
  el.bannerMain.textContent = main;
  el.bannerSub.textContent = sub || '';
  el.banner.classList.add('show');
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => el.banner.classList.remove('show'), ms);
}

// ---------- flow ----------
function hideOverlays() {
  el.title.classList.add('hide'); el.draft.classList.add('hide');
  el.milestone.classList.add('hide'); el.end.classList.add('hide');
  el.pause.classList.add('hide');
}
function showHUD(on) { el.hud.classList.toggle('hide', !on); }
function showTitleScreen() {
  hideOverlays();
  el.title.classList.remove('hide');
  showHUD(false);
  updateTitleRecords();
}
function resetRun() {
  score = 0; ink = 0; maxHp = 100; hp = maxHp;
  fireLv = wordLv = guardLv = 0;
  combo = maxCombo = correctChars = misses = wordsDone = kills = leaks = volleys = 0;
  activeT = 0; charge = 0;
  enemies = []; queue = []; bolts = []; particles = []; rings = []; floats = [];
  lockId = 0; nextId = 1;
  wave = 0; waveT = 0; waveReadyT = 0; waveActive = false;
  pendingMilestone = false; milestoneDone = false; endless = false;
  hitstop = 0; shakeT = 0; shakeAmp = 0; flashT = 0;
  paused = false; draftCards = []; recentWords = [];
  hideOverlays();
  showHUD(true);
  updateHUD();
}
function startGame() {
  resetRun();
  mode = 'play';
  startWave(1);
  audio.setState('calm');
  showToast('逐字拼出英文单词，完成即齐射');
}
function restartGame() {
  if (mode !== 'title') saveRecords();
  startGame();
}
function toTitle() {
  mode = 'title'; paused = false;
  enemies = []; queue = []; bolts = []; particles = []; rings = []; floats = [];
  lockId = 0; waveActive = false;
  showTitleScreen();
  audio.setState('title');
  updateHUD();
}

function buildQueue(w) {
  const spec = waveSpec(w);
  const q = [];
  if (spec.boss) {
    q.push({ kind: 'boss', t: .9, segments: bossSegmentsFor(w) });
  } else {
    for (let i = 0; i < spec.count; i++) {
      const kind = spec.kinds[Math.floor(rng() * spec.kinds.length)];
      q.push({ kind, t: .7 + i * spec.interval + rng() * .18 });
    }
  }
  q.sort((a, b) => a.t - b.t);
  return q;
}
function startWave(w) {
  w = Math.max(1, Math.floor(w));
  wave = w;
  queue = buildQueue(w);
  waveT = 0; waveReadyT = 0; waveActive = true;
  lockId = 0; mode = 'play'; paused = false;
  hideOverlays(); showHUD(true);
  const spec = waveSpec(w);
  if (spec.boss) {
    audio.setState('boss'); audio.sfx.boss();
    showBanner('垒 主 来 犯', `第 ${w} 波 · 拼完整段长词`, 2400);
    report('event', { event: 'boss_wave', wave: w, score: Math.round(score) });
  } else {
    audio.setState('combat');
    if (w === 1) showBanner('第 1 波', '敌词压境 · 逐字拼写', 1600);
    else if (w % 5 === 0) { audio.sfx.wave(); showBanner(`第 ${w} 波`, '敌潮渐密 · 守住词垒', 1500); }
  }
  updateHUD();
}
function onWaveClear() {
  if (mode !== 'play') return;
  waveActive = false;
  const w = wave;
  const sBonus = 12 * w, iBonus = 8 + 2 * w;
  score += sBonus; ink += iBonus;
  saveRecords();
  report('progress', { score: Math.round(score), progress: w, wave: w });
  audio.setState('calm'); audio.sfx.wave();
  showBanner(`第 ${w} 波 · 已 清`, `+${sBonus} 分 · +${iBonus} 墨能`, 1500);
  showToast(`墨能 +${iBonus}`);
  openDraft();
}
function openDraft() {
  mode = 'draft';
  clearTimeout(bannerTimer);
  el.banner.classList.remove('show');
  draftCards = buildDraftCards();
  renderDraft();
  el.draft.classList.remove('hide');
  hidePause();
  audio.setState('calm');
  updateHUD();
}
function closeDraft() {
  el.draft.classList.add('hide');
  mode = 'ready';
  waveReadyT = 0;
  updateHUD();
}
function buildDraftCards() {
  const defs = [
    { kind: 'fire', glyph: '弩', name: '连弩', lv: fireLv, desc: `弹幕伤害 ${wordDamage()} → ${wordDamage() + 1}` },
    { kind: 'word', glyph: '简', name: '简牍', lv: wordLv, desc: `单词上限 ${wordLenCap()} → ${Math.max(3, wordLenCap() - 1)} 字母` },
    { kind: 'guard', glyph: '垒', name: '壁垒', lv: guardLv, desc: `词垒上限 ${maxHp} → ${maxHp + 15}，并回垒 15` },
  ];
  return defs.map(d => {
    const cost = upgradeCost(d.kind);
    return { ...d, cost, affordable: ink >= cost };
  });
}
function renderDraft() {
  el.draftInk.textContent = String(Math.round(ink));
  el.draftCards.innerHTML = '';
  for (const card of draftCards) {
    const d = document.createElement('div');
    d.className = 'dcard' + (card.affordable ? '' : ' disabled');
    d.dataset.kind = card.kind;
    const gl = document.createElement('div'); gl.className = 'dglyph'; gl.textContent = card.glyph;
    const nm = document.createElement('div'); nm.className = 'dname'; nm.textContent = card.name;
    const lv = document.createElement('div'); lv.className = 'dlv'; lv.textContent = `Lv ${card.lv + 1}`;
    const ds = document.createElement('div'); ds.className = 'ddesc'; ds.textContent = card.desc;
    const co = document.createElement('div'); co.className = 'dcost'; co.textContent = `${card.cost} 墨能`;
    d.append(gl, nm, lv, ds, co);
    d.addEventListener('click', () => { if (card.affordable) buyUpgrade(card.kind); });
    el.draftCards.appendChild(d);
  }
}
function buyUpgrade(kind) {
  if (kind !== 'fire' && kind !== 'word' && kind !== 'guard') return false;
  const cost = upgradeCost(kind);
  if (ink < cost) { showToast('墨能不足'); audio.sfx.error(); return false; }
  ink -= cost;
  if (kind === 'fire') fireLv++;
  else if (kind === 'word') wordLv++;
  else { guardLv++; maxHp += 15; hp = Math.min(maxHp, hp + 15); }
  audio.sfx.upgrade();
  showToast(kind === 'fire' ? `连弩 Lv${fireLv} · 弹幕伤害 ${wordDamage()}` : kind === 'word' ? `简牍 Lv${wordLv} · 单词上限 ${wordLenCap()}` : `壁垒 Lv${guardLv} · 词垒上限 ${maxHp}`);
  if (mode === 'draft') { closeDraft(); }
  updateHUD();
  return true;
}
function skipDraft() {
  hp = Math.min(maxHp, hp + 5);
  showToast('休整：词垒回垒 5');
  closeDraft();
}

// ---------- milestone / end ----------
function triggerMilestone() {
  if (mode === 'milestone') return;
  mode = 'milestone';
  milestoneDone = true;
  clearTimeout(bannerTimer);
  el.banner.classList.remove('show');
  saveRecords();
  report('complete', { score: Math.round(score) });
  audio.sfx.victory(); audio.setState('win');
  el.msScore.textContent = String(Math.round(score));
  el.msWave.textContent = String(wave);
  el.msAcc.textContent = accuracyPct().toFixed(1) + '%';
  el.msWpm.textContent = String(wpmNow());
  el.msCombo.textContent = String(maxCombo);
  el.msKills.textContent = String(kills);
  hidePause();
  el.milestone.classList.remove('hide');
  updateHUD();
}
function continueEndless() {
  hideOverlays();
  showHUD(true);
  endless = true;
  if (!enemies.some(e => e.alive) && queue.length === 0 && wave > 0) {
    mode = 'play';
    onWaveClear();
  } else {
    mode = 'play';
  }
  updateHUD();
}
function settleFromMilestone() {
  hideOverlays();
  mode = 'over';
  showEnd(true);
  updateHUD();
}
function gameOver() {
  if (mode === 'over') return;
  mode = 'over';
  paused = false;
  lockId = 0;
  saveRecords();
  report('gameOver', { score: Math.round(score), progress: wave, wave });
  audio.sfx.defeat(); audio.setState('over');
  hidePause();
  showEnd(false);
  updateHUD();
}
function showEnd(milestone) {
  clearTimeout(bannerTimer);
  el.banner.classList.remove('show');
  el.endKick.textContent = milestone ? 'MILESTONE · 词垒结算' : 'SETTLEMENT · 词垒结算';
  el.endTitle.textContent = milestone ? '词 垒 永 固' : '词 垒 失 守';
  el.endReason.textContent = milestone ? '第 10 波垒主已破，词垒的灯火仍可继续深入。' : '敌词已越过最后的石墙。再试一次，把连击续起来。';
  el.endScore.textContent = String(Math.round(score));
  el.endWave.textContent = String(wave);
  el.endAcc.textContent = accuracyPct().toFixed(1) + '%';
  el.endWpm.textContent = String(wpmNow());
  el.endCombo.textContent = String(maxCombo);
  el.endKills.textContent = String(kills);
  el.endContinue.classList.toggle('hide', !(milestone && milestoneDone && !endless));
  el.end.classList.remove('hide');
  showHUD(true);
}

// ---------- pause / mute ----------
function showPause() { el.pause.classList.remove('hide'); }
function hidePause() { el.pause.classList.add('hide'); }
function togglePause() {
  if (mode !== 'play') return;
  paused = !paused;
  paused ? showPause() : hidePause();
  audio.sfx.ui();
  updateHUD();
}
function toggleMute() {
  const m = audio.toggleMute();
  showToast(m ? '已静音' : '声音已开启');
  updateHUD();
}

// ---------- spawning ----------
function spawnY() { return -VH * .08 - rng() * VH * .06; }
function positionX(e) {
  if (e.lane < 0) return VW / 2 + (e.xOff || 0);
  const wob = Math.sin(e.bornT * 1.6 + e.phase) * VW * .006;
  return clamp(laneX(e.lane) + (e.xOff || 0) + wob, VW * .06, VW * .94);
}
function chooseLane() {
  const used = new Set(enemies.filter(e => e.alive && e.lane >= 0 && e.y < 70).map(e => e.lane));
  const free = [];
  for (let i = 0; i < lanes; i++) if (!used.has(i)) free.push(i);
  const arr = free.length ? free : Array.from({ length: lanes }, (_, i) => i);
  return arr[Math.floor(rng() * arr.length)];
}
function nextWordFor(cap) {
  const w = pickWord(rng, cap, recentWords);
  recentWords.push(w); if (recentWords.length > 16) recentWords.shift();
  return w;
}
function spawnEnemy(kind, opts = {}) {
  const def = ENEMY_DEFS[kind] || ENEMY_DEFS.darter;
  const boss = kind === 'boss';
  const segments = boss ? (opts.segments ? opts.segments.slice() : bossSegmentsFor(wave)) : null;
  let word = opts.word ? String(opts.word).toLowerCase().replace(/[^a-z]/g, '') : '';
  if (boss) word = segments[0];
  if (!word) word = boss ? segments[0] : nextWordFor(kind === 'shard' ? Math.min(4, wordLenCap()) : wordLenCap());
  if (!boss && opts.word) { recentWords.push(word); if (recentWords.length > 16) recentWords.shift(); }
  const hpBase = opts.hp != null ? Math.max(1, Math.round(opts.hp)) : (def.baseHp + ((kind === 'slab' || kind === 'splitter') ? Math.floor(wave / 5) : 0));
  const e = {
    id: nextId++, kind, def,
    word, typed: 0,
    hp: boss ? segments.length : hpBase,
    maxHp: boss ? segments.length : hpBase,
    shield: opts.shield != null ? Math.max(0, opts.shield) : (def.shield || 0),
    boss, segments, segIndex: 0,
    lane: opts.lane != null ? opts.lane : (boss ? -1 : chooseLane()),
    xOff: opts.xOff || 0,
    y: opts.y != null ? opts.y : spawnY(),
    drawX: 0, bornT: 0, phase: rng() * Math.PI * 2, flash: 0,
    alive: true, leaked: false,
    isShard: kind === 'shard' || !!opts.isShard,
  };
  e.drawX = positionX(e);
  enemies.push(e);
  return e;
}
function spawnFromQueue(item) {
  if (item.kind === 'boss') spawnEnemy('boss', { segments: item.segments, y: -VH * .14 });
  else spawnEnemy(item.kind);
}

// ---------- typing / combat ----------
function registerMiss() {
  misses++;
  combo = 0;
  audio.sfx.error();
  shakeT = Math.max(shakeT, .16); shakeAmp = Math.max(shakeAmp, 3);
  flashT = Math.max(flashT, .16); flashRGB = '219,91,72';
  showToast('误键 · 连击中断');
  updateHUD();
}
function newWordFor(e) {
  return pickWord(rng, e.kind === 'shard' ? Math.min(4, wordLenCap()) : wordLenCap(), recentWords);
}
function addCharge(n) {
  if (mode !== 'play') return;
  charge += n;
  if (charge >= 100) { charge = 0; overloadVolley(); }
  else charge = Math.min(99.9, charge);
  updateHUD();
}
function typeLetter(ch) {
  if (mode !== 'play' || paused) return false;
  ch = String(ch || '').toLowerCase();
  if (ch.length !== 1 || ch < 'a' || ch > 'z') return false;
  let e = lockId ? enemies.find(x => x.id === lockId && x.alive) : null;
  if (!e) { lockId = 0; }
  let gain = 0;
  if (!e) {
    const cands = enemies.filter(x => x.alive && x.word && x.word[0] === ch);
    if (!cands.length) { registerMiss(); return false; }
    cands.sort((a, b) => b.y - a.y);
    e = cands[0];
    lockId = e.id;
    e.typed = 1;
  } else {
    if (e.word[e.typed] !== ch) { registerMiss(); return false; }
    e.typed++;
  }
  correctChars++;
  audio.sfx.key(e.typed / Math.max(1, e.word.length));
  if (e.typed >= e.word.length) completeTarget(e);
  addCharge(chargeGain());
  updateHUD();
  return true;
}
function completeTarget(e) {
  if (!e || !e.alive) return;
  const reward = wordReward(e.word.length, combo);
  score += reward.score;
  ink += reward.ink;
  combo++;
  maxCombo = Math.max(maxCombo, combo);
  wordsDone++;
  audio.sfx.word();
  audio.sfx.shot();
  spawnBolt(e);
  burstAt(e.drawX, e.y, 9, '#78e0c8', 70, 190, .55);
  floats.push({ x: e.drawX, y: e.y - 18, vy: -26, life: 1.05, max: 1.05, text: `+${reward.score}`, color: '#f2cf8c', size: 15 });
  hitstop = Math.max(hitstop, .045);
  shakeT = Math.max(shakeT, .13); shakeAmp = Math.max(shakeAmp, 2.4);
  lockId = 0;
  applyWordDamage(e);
  saveRecords();
  updateHUD();
}
function applyWordDamage(e) {
  if (!e || !e.alive) return;
  if (e.shield > 0) {
    e.shield = 0;
    e.flash = .4;
    e.word = newWordFor(e); e.typed = 0;
    audio.sfx.shieldBreak();
    ringAt(e.drawX, e.y, 12, 54, '#78e0c8', .35);
    burstAt(e.drawX, e.y, 14, '#e8c07a', 90, 230, .55);
    floats.push({ x: e.drawX, y: e.y + 12, vy: -18, life: 1.0, max: 1.0, text: '盾碎', color: '#78e0c8', size: 14 });
    shakeT = Math.max(shakeT, .18); shakeAmp = Math.max(shakeAmp, 3);
    return;
  }
  if (e.boss) {
    e.hp -= 1;
    audio.sfx.bossHit();
    e.flash = .35;
    hitstop = Math.max(hitstop, .06);
    shakeT = Math.max(shakeT, .22); shakeAmp = Math.max(shakeAmp, 4);
    burstAt(e.drawX, e.y, 18, '#e8c07a', 90, 240, .7);
    if (e.hp <= 0) killEnemy(e);
    else {
      e.segIndex = clamp(e.segments.length - e.hp, 0, e.segments.length - 1);
      e.word = e.segments[e.segIndex];
      e.typed = 0;
      floats.push({ x: e.drawX, y: e.y - 30, vy: -18, life: 1.1, max: 1.1, text: `第 ${e.segIndex + 1}/${e.segments.length} 段`, color: '#f0a070', size: 14 });
    }
    return;
  }
  e.hp -= wordDamage();
  e.flash = .26;
  if (e.hp <= 0) { killEnemy(e); return; }
  audio.sfx.hit();
  e.word = newWordFor(e); e.typed = 0;
  burstAt(e.drawX, e.y, 8, '#78e0c8', 60, 170, .45);
  hitstop = Math.max(hitstop, .035);
}
function killEnemy(e) {
  if (!e || !e.alive) return;
  e.alive = false;
  kills++;
  score += e.def.killScore || 0;
  ink += e.boss ? 25 : 2;
  audio.sfx.kill();
  burstAt(e.drawX, e.y, e.boss ? 34 : 16, '#78e0c8', 90, e.boss ? 360 : 240, e.boss ? 1.0 : .65);
  burstAt(e.drawX, e.y, e.boss ? 16 : 7, '#e8c07a', 60, 200, .6);
  ringAt(e.drawX, e.y, e.boss ? 40 : 8, e.boss ? 170 : 70, e.boss ? '#f0a070' : '#78e0c8', e.boss ? .6 : .35);
  shakeT = Math.max(shakeT, e.boss ? .5 : .2);
  shakeAmp = Math.max(shakeAmp, e.boss ? 8 : 3.4);
  hitstop = Math.max(hitstop, e.boss ? .11 : .06);
  if (e.kind === 'splitter' && !e.isShard) {
    for (const off of [-1, 1]) {
      spawnEnemy('shard', { lane: e.lane, y: e.y, xOff: off * 18, word: pickWord(rng, 4, recentWords) });
    }
    showToast('裂晶碎开 · 两只碎晶钻出');
  }
  if (e.boss) {
    score += 120 + wave * 10;
    ink += 10;
    report('event', { event: 'boss_slain', wave, score: Math.round(score) });
    showBanner('垒 主 陨 落', `+${120 + wave * 10} 分 · 长词已断`, 1800);
    if (wave === 10 && !milestoneDone) { milestoneDone = true; pendingMilestone = true; }
  }
  if (lockId === e.id) lockId = 0;
  updateHUD();
}
function leakEnemy(e) {
  if (!e || !e.alive) return;
  e.alive = false; e.leaked = true;
  leaks++;
  combo = 0;
  hp = Math.max(0, hp - e.def.dmg);
  if (lockId === e.id) lockId = 0;
  audio.sfx.leak();
  burstAt(e.drawX, wallY - 6, 18, '#db5b48', 80, 280, .7);
  ringAt(e.drawX, wallY - 6, 10, 90, '#db5b48', .45);
  floats.push({ x: e.drawX, y: wallY - 30, vy: -20, life: 1.1, max: 1.1, text: `-${e.def.dmg}`, color: '#ff8a70', size: 18 });
  shakeT = Math.max(shakeT, .3); shakeAmp = Math.max(shakeAmp, 5);
  flashT = Math.max(flashT, .22); flashRGB = '219,91,72';
  showToast(`词垒受损 -${e.def.dmg}`);
  updateHUD();
}

// ---------- charge volley ----------
function overloadVolley() {
  volleys++;
  const snap = enemies.filter(e => e.alive);
  for (const e of snap) {
    if (!e.alive) continue;
    if (e.shield > 0) {
      e.shield = 0; e.flash = .35;
      e.word = newWordFor(e); e.typed = 0;
    } else if (e.boss) {
      e.hp -= 1; e.flash = .35;
      if (e.hp <= 0) killEnemy(e);
      else { e.segIndex = clamp(e.segments.length - e.hp, 0, e.segments.length - 1); e.word = e.segments[e.segIndex]; e.typed = 0; }
    } else {
      e.hp -= 1; e.flash = .3;
      if (e.hp <= 0) killEnemy(e);
      else { e.word = newWordFor(e); e.typed = 0; }
    }
    if (e.alive) burstAt(e.drawX, e.y, 10, '#78e0c8', 80, 220, .55);
  }
  if (lockId && !enemies.some(e => e.id === lockId && e.alive)) lockId = 0;
  audio.sfx.volley();
  ringAt(VW / 2, wallY - 16, 18, Math.max(VW, VH) * .62, '#78e0c8', .62);
  flashT = Math.max(flashT, .3); flashRGB = '120,224,200';
  shakeT = Math.max(shakeT, .42); shakeAmp = Math.max(shakeAmp, 7);
  hitstop = Math.max(hitstop, .07);
  showBanner('充 能 齐 射', '词垒震荡 · 全场受创', 1100);
  updateHUD();
}

// ---------- fx ----------
function spawnBolt(e) {
  bolts.push({ sx: VW / 2, sy: wallY - 22, tx: e.drawX, ty: e.y, t: 0, dur: .17 });
  if (bolts.length > 48) bolts.splice(0, bolts.length - 48);
}
function burstAt(x, y, n, color, spMin, spMax, life) {
  for (let i = 0; i < n; i++) {
    const a = rng() * Math.PI * 2, sp = spMin + rng() * (spMax - spMin);
    particles.push({
      x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 26,
      life: life * (.6 + rng() * .5), max: life, size: 1.6 + rng() * 3.4,
      color, grav: 160 + rng() * 180, rot: rng() * 6.28, vrot: (rng() - .5) * 10,
      shape: rng() < .55 ? 'sq' : 'dot',
    });
  }
  if (particles.length > 280) particles.splice(0, particles.length - 280);
}
function ringAt(x, y, r0, r1, color, life) {
  rings.push({ x, y, r: r0, r0, r1, life, max: life, color });
  if (rings.length > 26) rings.splice(0, rings.length - 26);
}
function updateFX(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) { particles.splice(i, 1); continue; }
    p.vy += p.grav * dt;
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.rot += p.vrot * dt;
  }
  for (let i = rings.length - 1; i >= 0; i--) {
    const r = rings[i];
    r.life -= dt;
    if (r.life <= 0) { rings.splice(i, 1); continue; }
    r.r = r.r0 + (r.r1 - r.r0) * (1 - r.life / r.max);
  }
  for (let i = bolts.length - 1; i >= 0; i--) {
    const b = bolts[i];
    b.t += dt;
    if (b.t >= b.dur) bolts.splice(i, 1);
  }
  for (let i = floats.length - 1; i >= 0; i--) {
    const f = floats[i];
    f.life -= dt; f.y += (f.vy || -20) * dt;
    if (f.life <= 0) floats.splice(i, 1);
  }
  if (shakeT > 0) shakeT = Math.max(0, shakeT - dt);
  if (flashT > 0) flashT = Math.max(0, flashT - dt * 2.4);
}

// ---------- update ----------
function updatePlay(dt) {
  if (hitstop > 0) { hitstop = Math.max(0, hitstop - dt); return; }
  activeT += dt;
  waveT += dt;
  while (queue.length && queue[0].t <= waveT) spawnFromQueue(queue.shift());
  for (const e of [...enemies]) {
    if (!e.alive) continue;
    e.bornT += dt;
    if (e.flash > 0) e.flash = Math.max(0, e.flash - dt * 2.4);
    e.y += VH * e.def.speed * speedMult() * dt;
    e.drawX = positionX(e);
    if (e.y >= wallY - 5) leakEnemy(e);
  }
  updateFX(dt);
  enemies = enemies.filter(e => e.alive);
  if (lockId && !enemies.some(e => e.id === lockId)) lockId = 0;
  if (hp <= 0) { gameOver(); return; }
  if (pendingMilestone) { pendingMilestone = false; triggerMilestone(); return; }
  if (waveActive && queue.length === 0 && enemies.length === 0 && waveT > .7) { onWaveClear(); return; }
  const bossLive = enemies.some(e => e.boss) || queue.some(q => q.kind === 'boss');
  audio.setState(bossLive ? 'boss' : 'combat');
}
function stepGame(dt) {
  visualT += dt;
  updateMotes(dt);
  if (mode === 'play' && !paused) updatePlay(dt);
  else if (mode === 'ready' && !paused && !noAuto) {
    waveReadyT += dt;
    if (waveReadyT >= 1.5) startWave(wave + 1);
  }
  audio.update(dt);
  updateHUD();
}

// ---------- render ----------
function render() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.clearRect(0, 0, cv.width, cv.height);
  ctx.save();
  ctx.translate(viewOX, viewOY);
  ctx.scale(viewScale, viewScale);
  const sx = shakeT > 0 ? Math.sin(visualT * 91) * shakeAmp * shakeT * 9 : 0;
  const sy = shakeT > 0 ? Math.cos(visualT * 73) * shakeAmp * shakeT * 7 : 0;
  ctx.translate(sx, sy);
  ctx.drawImage(bgCv, 0, 0, VW, VH);
  drawMotes();
  drawWallRunes();
  if (mode === 'title') drawTitleAmbience();
  drawLockBeam();
  const list = enemies.filter(e => e.alive).sort((a, b) => a.y - b.y);
  for (const e of list) drawEnemy(e);
  drawBolts();
  drawCannon();
  drawParticles();
  drawRings();
  drawFloats();
  if (flashT > 0) {
    ctx.fillStyle = `rgba(${flashRGB},${Math.min(.45, flashT * 1.1)})`;
    ctx.fillRect(0, 0, VW, VH);
  }
  ctx.restore();
}
function drawMotes() {
  for (const m of motes) {
    ctx.globalAlpha = m.a * (.55 + .45 * Math.sin(visualT * 1.4 + m.ph));
    ctx.fillStyle = m.jade ? '#78e0c8' : '#e8c07a';
    if (m.jade) { diamondPath(ctx, m.x, m.y, m.rad * 1.5); ctx.fill(); }
    else { ctx.beginPath(); ctx.arc(m.x, m.y, m.rad, 0, 6.283); ctx.fill(); }
  }
  ctx.globalAlpha = 1;
}
function drawWallRunes() {
  const n = portrait ? 16 : 24;
  const lit = Math.round(clamp(hp / maxHp, 0, 1) * n);
  const low = hp / maxHp <= .3;
  for (let i = 0; i < n; i++) {
    const x = (i + .5) * VW / n, y = wallY + 8;
    if (i < lit) {
      const pulse = .72 + .28 * Math.sin(visualT * 3 + i * .6);
      ctx.fillStyle = low ? `rgba(219,91,72,${pulse})` : `rgba(120,224,200,${pulse})`;
      ctx.save(); ctx.shadowColor = low ? 'rgba(219,91,72,.8)' : 'rgba(120,224,200,.7)'; ctx.shadowBlur = 8;
      diamondPath(ctx, x, y, 3.4); ctx.fill(); ctx.restore();
    } else {
      ctx.fillStyle = 'rgba(217,163,91,.15)';
      diamondPath(ctx, x, y, 2.6); ctx.fill();
    }
  }
}
function drawTitleAmbience() {
  const glyphs = ['W', 'O', 'R', 'D', 'A', 'Z', '词', '垒', '墨', '光'];
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (let i = 0; i < glyphs.length; i++) {
    const x = VW * (.1 + .1 * i) + Math.sin(visualT * .25 + i) * 14;
    const y = VH * (.2 + .065 * ((i * 7) % 9)) + Math.cos(visualT * .2 + i * 1.7) * 10;
    ctx.globalAlpha = .045 + .02 * Math.sin(visualT * .8 + i);
    ctx.fillStyle = i % 3 === 0 ? '#78e0c8' : '#e8c07a';
    ctx.font = `${24 + (i % 4) * 7}px ${i >= 6 ? SERIF : LATIN}`;
    ctx.fillText(glyphs[i], x, y);
  }
  ctx.globalAlpha = 1;
  // a slow, low word-banner strip near the wall
  ctx.globalAlpha = .10;
  ctx.fillStyle = '#e8c07a'; ctx.font = `600 ${portrait ? 11 : 12}px ${LATIN}`; ctx.textAlign = 'left';
  ctx.fillText('LEXICON · BASTION · WORD FORTRESS · 词垒防线 · 第 七 铺', 26, wallY - 26);
  ctx.globalAlpha = 1;
}
function drawLockBeam() {
  if (!lockId) return;
  const e = enemies.find(x => x.id === lockId && x.alive);
  if (!e) return;
  ctx.save();
  ctx.strokeStyle = 'rgba(120,224,200,.22)';
  ctx.lineWidth = 1; ctx.setLineDash([5, 7]);
  ctx.beginPath(); ctx.moveTo(VW / 2, wallY - 22); ctx.lineTo(e.drawX, e.y + 8); ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = 'rgba(120,224,200,.6)'; ctx.lineWidth = 1.4;
  const r = 18 + Math.sin(visualT * 6) * 2;
  diamondPath(ctx, e.drawX, e.y, r); ctx.stroke();
  ctx.restore();
}
function drawCannon() {
  const cx = VW / 2, cy = wallY - 14;
  const lock = enemies.find(e => e.id === lockId && e.alive);
  let ang = -Math.PI / 2;
  if (lock) ang = Math.atan2(lock.y - cy, lock.drawX - cx);
  // charge aura
  const frac = charge / 100;
  if (frac > .04) {
    const rg = ctx.createRadialGradient(cx, cy, 2, cx, cy, 24 + frac * 26);
    rg.addColorStop(0, `rgba(120,224,200,${.18 + frac * .22})`);
    rg.addColorStop(1, 'rgba(120,224,200,0)');
    ctx.fillStyle = rg;
    ctx.beginPath(); ctx.arc(cx, cy, 24 + frac * 26, 0, 6.283); ctx.fill();
  }
  ctx.save();
  ctx.translate(cx, cy);
  // base
  ctx.fillStyle = '#131c33'; ctx.strokeStyle = 'rgba(217,163,91,.5)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(0, 0, 15, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
  // barrel
  ctx.rotate(ang);
  const bg = ctx.createLinearGradient(0, -6, 0, 6);
  bg.addColorStop(0, '#e8c07a'); bg.addColorStop(.5, '#a8753e'); bg.addColorStop(1, '#5d3d1e');
  ctx.fillStyle = bg; ctx.strokeStyle = 'rgba(255,232,190,.5)'; ctx.lineWidth = 1;
  rrect(ctx, 2, -5, 27, 10, 4); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#f6dfa8'; ctx.beginPath(); ctx.arc(29, 0, 3.6, 0, 6.283); ctx.fill();
  ctx.restore();
  // core
  ctx.save();
  ctx.shadowColor = 'rgba(120,224,200,.9)'; ctx.shadowBlur = 10 + frac * 16;
  ctx.fillStyle = frac > .75 ? '#b8fff0' : '#78e0c8';
  ctx.beginPath(); ctx.arc(cx, cy, 4.2, 0, 6.283); ctx.fill();
  ctx.restore();
  if (combo >= 2) {
    ctx.textAlign = 'center'; ctx.font = `700 ${13 + Math.min(8, combo * .5)}px ${LATIN}`;
    ctx.fillStyle = 'rgba(120,224,200,.9)';
    ctx.fillText(`× ${combo} 连击`, cx, cy - 30);
  }
}
function drawBolts() {
  for (const b of bolts) {
    const p = clamp(b.t / b.dur, 0, 1);
    const x = b.sx + (b.tx - b.sx) * p;
    const y = b.sy + (b.ty - b.sy) * p - Math.sin(p * Math.PI) * 10;
    const q = Math.max(0, p - .38);
    const tx = b.sx + (b.tx - b.sx) * q;
    const ty = b.sy + (b.ty - b.sy) * q - Math.sin(q * Math.PI) * 10;
    ctx.strokeStyle = 'rgba(120,224,200,.36)'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(x, y); ctx.stroke();
    ctx.strokeStyle = 'rgba(242,207,140,.9)'; ctx.lineWidth = 1.7;
    ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(x, y); ctx.stroke();
    ctx.fillStyle = '#f6dfa8'; ctx.beginPath(); ctx.arc(x, y, 2.4, 0, 6.283); ctx.fill();
  }
}
function drawParticles() {
  for (const p of particles) {
    ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
    ctx.fillStyle = p.color;
    if (p.shape === 'sq') {
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size); ctx.restore();
    } else {
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size * .62, 0, 6.283); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}
function drawRings() {
  for (const r of rings) {
    ctx.globalAlpha = clamp(r.life / r.max, 0, 1) * .8;
    ctx.strokeStyle = r.color; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, 6.283); ctx.stroke();
    ctx.globalAlpha = clamp(r.life / r.max, 0, 1) * .25; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, 6.283); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}
function drawFloats() {
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const f of floats) {
    ctx.globalAlpha = clamp(f.life / f.max, 0, 1);
    ctx.font = `700 ${f.size}px ${SERIF}`;
    ctx.strokeStyle = 'rgba(4,7,15,.8)'; ctx.lineWidth = 3;
    ctx.strokeText(f.text, f.x, f.y);
    ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
}
function drawEnemy(e) {
  const x = e.drawX, y = e.y, def = e.def, s = def.scale;
  const [bw, bh] = def.body;
  const w = bw * s, h = bh * s;
  e._body = { x, y, w, h };
  if (e.flash > 0) { ctx.save(); ctx.globalAlpha = clamp(e.flash * 1.6, 0, .65); }
  // shadow
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,.34)'; ctx.beginPath(); ctx.ellipse(x, y + h * .5 + 6, w * .55, 5, 0, 0, 6.283); ctx.fill();
  ctx.restore();
  if (e.boss) drawBossBody(e, x, y);
  else {
    const g = ctx.createLinearGradient(x, y - h / 2, x, y + h / 2);
    g.addColorStop(0, def.color[0]); g.addColorStop(1, def.color[1]);
    ctx.fillStyle = g;
    ctx.strokeStyle = e.shield > 0 ? 'rgba(242,207,140,.85)' : 'rgba(232,192,122,.55)';
    ctx.lineWidth = e.shield > 0 ? 2 : 1.4;
    if (e.kind === 'slab') {
      rrect(ctx, x - w / 2, y - h / 2, w, h, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,232,190,.13)'; rrect(ctx, x - w / 2 + 5, y - h / 2 + 4, w - 10, 7, 3); ctx.fill();
      ctx.fillStyle = 'rgba(255,232,190,.65)';
      for (const dx of [-w * .28, w * .28]) { ctx.beginPath(); ctx.arc(x + dx, y + 4, 1.9, 0, 6.283); ctx.fill(); }
    } else if (e.kind === 'darter') {
      ctx.beginPath(); ctx.moveTo(x, y - h / 2); ctx.lineTo(x + w / 2, y + 1); ctx.lineTo(x, y + h / 2); ctx.lineTo(x - w / 2, y + 1); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,232,190,.22)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, y - h / 2 + 3); ctx.lineTo(x, y + h / 2 - 3); ctx.stroke();
      ctx.strokeStyle = 'rgba(240,138,95,.28)'; ctx.lineWidth = 1.4;
      for (const dx of [-7, 0, 7]) { ctx.beginPath(); ctx.moveTo(x + dx, y - h / 2 - 4); ctx.lineTo(x + dx, y - h / 2 - 12); ctx.stroke(); }
    } else if (e.kind === 'splitter') {
      diamondPath(ctx, x, y, w / 2); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,220,210,.45)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(x - 2, y - h / 2 + 2); ctx.lineTo(x + 4, y); ctx.lineTo(x - 4, y + 4); ctx.lineTo(x + 2, y + h / 2 - 2); ctx.stroke();
    } else if (e.kind === 'shield') {
      ctx.beginPath();
      ctx.moveTo(x - w / 2, y - h / 2 + 5);
      ctx.quadraticCurveTo(x - w / 2, y - h / 2, x - w / 2 + 6, y - h / 2);
      ctx.lineTo(x + w / 2 - 6, y - h / 2);
      ctx.quadraticCurveTo(x + w / 2, y - h / 2, x + w / 2, y - h / 2 + 5);
      ctx.lineTo(x + w / 2, y + h * .1);
      ctx.quadraticCurveTo(x, y + h * .62, x - w / 2, y + h * .1);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      if (e.shield > 0) {
        ctx.save();
        ctx.strokeStyle = 'rgba(120,224,200,.8)'; ctx.lineWidth = 2;
        ctx.shadowColor = 'rgba(120,224,200,.8)'; ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.arc(x, y - 2, w * .62, Math.PI * .12, Math.PI * .88); ctx.stroke();
        ctx.restore();
      } else {
        ctx.strokeStyle = 'rgba(160,120,100,.5)'; ctx.setLineDash([3, 4]); ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(x, y - 2, w * .62, Math.PI * .12, Math.PI * .88); ctx.stroke(); ctx.setLineDash([]);
      }
    } else {
      diamondPath(ctx, x, y, w / 2); ctx.fill(); ctx.stroke();
    }
    // tiny type glyph
    ctx.fillStyle = 'rgba(255,238,205,.68)'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `700 ${Math.max(10, Math.round(h * .3))}px ${SERIF}`;
    ctx.fillText(def.glyph, x, y + 1);
  }
  if (e.flash > 0) ctx.restore();
  // hp / shield pips
  if (!e.boss) {
    const pips = Math.max(0, e.hp) + (e.shield > 0 ? 1 : 0);
    for (let i = 0; i < pips; i++) {
      const px = x - (pips - 1) * 4 + i * 8;
      ctx.fillStyle = i < e.hp ? 'rgba(232,192,122,.9)' : 'rgba(120,224,200,.95)';
      diamondPath(ctx, px, y - h / 2 - 10, 2.6); ctx.fill();
    }
  }
  const plaqueY = y + h / 2 + (e.boss ? 12 : 9);
  drawWordPlaque(e, x, plaqueY, e.boss ? 24 : 15);
}
function drawBossBody(e, x, y) {
  const R = 52;
  ctx.save();
  // aura
  ctx.strokeStyle = 'rgba(240,160,112,.16)'; ctx.lineWidth = 1.4;
  for (const rr of [R + 18, R + 30]) { ctx.beginPath(); ctx.arc(x, y, rr, 0, 6.283); ctx.stroke(); }
  ctx.setLineDash([4, 10]); ctx.strokeStyle = 'rgba(120,224,200,.22)';
  ctx.beginPath(); ctx.arc(x, y, R + 23, visualT * .4, visualT * .4 + 6.283); ctx.stroke(); ctx.setLineDash([]);
  // horns
  ctx.fillStyle = 'rgba(232,192,122,.8)';
  for (const a of [-2.35, -0.79, 0.79, 2.35]) {
    const hx = x + Math.cos(a) * (R - 4), hy = y + Math.sin(a) * (R - 4);
    ctx.save(); ctx.translate(hx, hy); ctx.rotate(a);
    ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(16, 0); ctx.lineTo(0, 5); ctx.closePath(); ctx.fill(); ctx.restore();
  }
  // outer octagon
  const g = ctx.createLinearGradient(x, y - R, x, y + R);
  g.addColorStop(0, '#e2603f'); g.addColorStop(.55, '#a53a2c'); g.addColorStop(1, '#6e2323');
  ctx.fillStyle = g; ctx.strokeStyle = 'rgba(246,223,168,.65)'; ctx.lineWidth = 2.2;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) { const a = -Math.PI / 8 + i * Math.PI / 4; const px = x + Math.cos(a) * R, py = y + Math.sin(a) * R; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
  ctx.closePath(); ctx.fill(); ctx.stroke();
  // inner mask
  ctx.fillStyle = '#10172c'; ctx.strokeStyle = 'rgba(232,192,122,.7)'; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.arc(x, y, R * .58, 0, 6.283); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = 'rgba(120,224,200,.3)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(x, y, R * .44, 0, 6.283); ctx.stroke();
  ctx.fillStyle = 'rgba(246,223,168,.9)'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `700 ${Math.round(R * .52)}px ${SERIF}`;
  ctx.fillText('垒', x, y + 2);
  // flash ring
  if (e.flash > 0) {
    ctx.globalAlpha = clamp(e.flash * 1.4, 0, .6);
    ctx.fillStyle = '#fff0d0'; ctx.beginPath(); ctx.arc(x, y, R + 6, 0, 6.283); ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}
function drawWordPlaque(e, cx, y, fs) {
  const word = e.word || '';
  ctx.font = `600 ${fs}px ${LATIN}`;
  const widths = [];
  let total = 0;
  for (const ch of word) { const w = ctx.measureText(ch).width; widths.push(w); total += w; }
  const padX = e.boss ? 15 : 10, padY = e.boss ? 9 : 6;
  const w = total + padX * 2, h = fs + padY * 2;
  const x = clamp(cx - w / 2, 5, VW - w - 5);
  const locked = e.id === lockId;
  ctx.fillStyle = 'rgba(7,11,24,.86)';
  rrect(ctx, x, y, w, h, e.boss ? 10 : 7); ctx.fill();
  ctx.strokeStyle = locked ? 'rgba(120,224,200,.85)' : (e.shield > 0 ? 'rgba(232,192,122,.62)' : 'rgba(217,163,91,.34)');
  ctx.lineWidth = locked ? 1.8 : 1;
  if (locked) { ctx.save(); ctx.shadowColor = 'rgba(120,224,200,.65)'; ctx.shadowBlur = 11; }
  ctx.stroke();
  if (locked) ctx.restore();
  // corner ticks
  ctx.strokeStyle = locked ? 'rgba(120,224,200,.9)' : 'rgba(217,163,91,.28)';
  ctx.lineWidth = 1.2;
  for (const [px, py, dx, dy] of [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]]) {
    ctx.beginPath(); ctx.moveTo(px + dx * 6, py); ctx.lineTo(px, py); ctx.lineTo(px, py + dy * 6); ctx.stroke();
  }
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  let tx = x + padX;
  const ty = y + h / 2 + .5;
  const typed = Math.min(e.typed || 0, word.length);
  for (let i = 0; i < word.length; i++) {
    const isNext = locked && i === typed;
    if (isNext) { ctx.save(); ctx.shadowColor = 'rgba(120,224,200,.9)'; ctx.shadowBlur = 10; }
    ctx.fillStyle = i < typed ? '#7ee6cf' : isNext ? '#fff3d0' : '#e6c288';
    ctx.fillText(word[i], tx, ty);
    if (isNext) ctx.restore();
    tx += widths[i];
  }
  if (locked && typed < word.length) {
    const pre = widths.slice(0, typed).reduce((a, b) => a + b, 0);
    ctx.strokeStyle = 'rgba(120,224,200,.9)'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + padX + pre + 1, y + h - 3.5);
    ctx.lineTo(x + padX + pre + widths[typed] - 1, y + h - 3.5);
    ctx.stroke();
  }
  e._plaque = { x, y, w, h };
}

// ---------- input ----------
const pressed = new Set();
function codeToLetter(code) {
  if (/^Key[A-Z]$/.test(code)) return code.slice(3).toLowerCase();
  return null;
}
function willTypeLetter(ch) {
  if (mode !== 'play' || paused) return false;
  const e = lockId ? enemies.find(x => x.id === lockId && x.alive) : null;
  if (e) return e.word[e.typed] === ch;
  return enemies.some(x => x.alive && x.word[0] === ch);
}
function handleKeys() {
  for (const code of pressed) {
    const ch = codeToLetter(code);
    if (ch) {
      if ((code === 'KeyP' || code === 'KeyM' || code === 'KeyR') && !willTypeLetter(ch)) {
        if (code === 'KeyP') togglePause();
        else if (code === 'KeyM') toggleMute();
        else restartGame();
      } else {
        typeLetter(ch);
      }
      continue;
    }
    if (code === 'Escape' && mode === 'play') togglePause();
  }
  pressed.clear();
}
window.addEventListener('keydown', (e) => {
  if (e.isComposing || e.keyCode === 229) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const tag = e.target && e.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;
  if (!e.repeat) pressed.add(e.code);
  if (e.code === 'Space' || e.code === 'Tab') e.preventDefault();
  if (/^Key[A-Z]$/.test(e.code) || e.code === 'Escape') e.preventDefault();
});
window.addEventListener('blur', () => pressed.clear());
document.addEventListener('visibilitychange', () => {
  pressed.clear();
  if (document.hidden && mode === 'play' && !paused) { paused = true; showPause(); updateHUD(); }
});

cv.addEventListener('pointerdown', (e) => {
  if (mode !== 'play' || paused) return;
  const lx = (e.clientX - viewOX) / viewScale;
  const ly = (e.clientY - viewOY) / viewScale;
  let hit = null;
  for (const en of enemies) {
    if (!en.alive || !en._body) continue;
    const b = en._body, p = en._plaque;
    if (lx > b.x - b.w * .7 && lx < b.x + b.w * .7 && ly > b.y - b.h * .8 && ly < b.y + b.h * .8) { hit = en; break; }
    if (p && lx > p.x && lx < p.x + p.w && ly > p.y && ly < p.y + p.h) { hit = en; break; }
  }
  if (hit) {
    lockId = hit.id; hit.typed = 0;
    audio.sfx.ui();
    updateHUD();
  } else if (touchMode) {
    try { el.typefield.focus({ preventScroll: true }); } catch (err) { el.typefield.focus(); }
  }
});

el.typefield.addEventListener('input', () => {
  const v = el.typefield.value;
  el.typefield.value = '';
  for (const ch of v.toLowerCase()) if (ch >= 'a' && ch <= 'z') typeLetter(ch);
});

function buildVKB() {
  const letters = 'abcdefghijklmnopqrstuvwxyz'.split('');
  el.vkb.innerHTML = '';
  for (const ch of letters) {
    const b = document.createElement('button');
    b.className = 'vkbtn';
    b.dataset.ch = ch;
    b.textContent = ch.toUpperCase();
    b.setAttribute('aria-label', ch);
    b.addEventListener('pointerdown', (ev) => { ev.preventDefault(); typeLetter(ch); });
    el.vkb.appendChild(b);
  }
}

// ---------- UI wiring ----------
$('startbtn').addEventListener('click', () => { audio.ensure(); startGame(); if (touchMode) setTimeout(() => { try { el.typefield.focus({ preventScroll: true }); } catch (e) { } }, 160); });
el.endRetry.addEventListener('click', () => { audio.ensure(); restartGame(); });
el.endHome.addEventListener('click', () => { audio.ensure(); toTitle(); });
el.endContinue.addEventListener('click', () => { audio.ensure(); continueEndless(); });
el.btnMute.addEventListener('click', toggleMute);
el.btnPause.addEventListener('click', togglePause);
el.btnRestart.addEventListener('click', () => { audio.ensure(); restartGame(); });
el.tMute.addEventListener('click', toggleMute);
el.tPause.addEventListener('click', togglePause);
el.tRestart.addEventListener('click', () => { audio.ensure(); restartGame(); });
el.pauseResume.addEventListener('click', togglePause);
el.pause.addEventListener('pointerdown', (e) => { if (e.target === el.pause) togglePause(); });
$('msContinue').addEventListener('click', () => { audio.ensure(); continueEndless(); });
$('msSettle').addEventListener('click', () => { audio.ensure(); settleFromMilestone(); });
$('msRestart').addEventListener('click', () => { audio.ensure(); restartGame(); });
el.draftSkip.addEventListener('click', skipDraft);
el.vkToggle.addEventListener('click', () => {
  const on = el.vkb.classList.toggle('show');
  el.vkToggle.classList.toggle('on', on);
  if (on) { try { el.typefield.blur(); } catch (e) { } }
});
document.addEventListener('pointerdown', () => { if (!AUTOTEST) audio.ensure(); }, true);
document.addEventListener('keydown', (e) => { if (e.isTrusted && !AUTOTEST) audio.ensure(); }, true);

// ---------- main loop ----------
let last = performance.now(), acc = 0;
function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - last) / 1000; last = now;
  if (!Number.isFinite(dt) || dt < 0) dt = 0;
  dt = Math.min(dt, .1);
  if (document.hidden) { acc = 0; return; }
  handleKeys();
  acc += dt;
  let n = 0;
  while (acc >= DT && n < 8) { stepGame(DT); acc -= DT; n++; }
  render();
}

// ---------- debug hooks ----------
const G = {
  err: window.__BOOTERR,
  step: (n = 60, dt = DT) => { for (let i = 0; i < n; i++) { handleKeys(); stepGame(dt); render(); } },
  upd: (n = 30, dt = DT) => { for (let i = 0; i < n; i++) { handleKeys(); stepGame(dt); } },
  press: (...codes) => { for (const c of codes) pressed.add(c); },
  setNoAuto: (v) => { noAuto = !!v; },
  setReportTarget: (fn) => { reportTarget = typeof fn === 'function' ? fn : null; },
  typeLetter,
  typeText: (text) => { let n = 0; for (const ch of String(text || '')) { if (typeLetter(ch)) n++; } return n; },
  state: () => {
    const boss = enemies.find(e => e.boss && e.alive);
    return {
      mode, paused, noAuto, wave, endless, milestone: milestoneDone, waveActive,
      score: Math.round(score), ink: Math.round(ink), hp: Math.round(hp), maxHp: Math.round(maxHp),
      combo, maxCombo, correctChars, misses, wordsDone, kills, leaks, volleys,
      accuracy: +accuracyPct().toFixed(1), wpm: wpmNow(), activeT: +activeT.toFixed(2),
      charge: +charge.toFixed(1), damage: wordDamage(), wordCap: wordLenCap(),
      fireLv, wordLv, guardLv,
      enemyCount: enemies.filter(e => e.alive).length,
      queueCount: queue.length,
      lockId, wallY, lanes, portrait,
      boss: boss ? { id: boss.id, kind: boss.kind, word: boss.word, typed: boss.typed, hp: boss.hp, maxHp: boss.maxHp, segments: boss.segments ? [...boss.segments] : null } : null,
      draft: draftCards.map(c => ({ kind: c.kind, name: c.name, cost: c.cost, affordable: c.affordable, lv: c.lv })),
      records: { ...rec }, muted: audio.isMuted(), audioState: audio.state(),
      touch: touchMode,
      net: window.__NET ? { fetch: window.__NET.fetch, xhr: window.__NET.xhr, ws: window.__NET.ws, external: [...window.__NET.external] } : null,
      nan: isNaNState(),
    };
  },
  enemyInfo: (id) => {
    const e = enemies.find(x => x.id === id);
    if (!e) return null;
    return {
      id: e.id, kind: e.kind, word: e.word, typed: e.typed, hp: e.hp, maxHp: e.maxHp,
      shield: e.shield, alive: e.alive, leaked: e.leaked, boss: e.boss,
      y: +e.y.toFixed(2), x: +e.drawX.toFixed(2), lane: e.lane,
      segments: e.segments ? [...e.segments] : null,
    };
  },
  enemies: () => enemies.map(e => ({ id: e.id, kind: e.kind, word: e.word, typed: e.typed, hp: e.hp, maxHp: e.maxHp, shield: e.shield, alive: e.alive, leaked: e.leaked, boss: e.boss, y: +e.y.toFixed(2), x: +e.drawX.toFixed(2), lane: e.lane })),
  screenPos: (id) => {
    const e = enemies.find(x => x.id === id);
    if (!e) return null;
    return { x: viewOX + e.drawX * viewScale, y: viewOY + e.y * viewScale };
  },
  spawn: (kind, word, opts = {}) => { const e = spawnEnemy(kind, { ...(opts || {}), word: word || (opts && opts.word) }); updateHUD(); return e.id; },
  setWord: (id, word) => { const e = enemies.find(x => x.id === id); if (!e) return false; const w = String(word || '').toLowerCase().replace(/[^a-z]/g, ''); if (w.length < 1) return false; e.word = w; e.typed = 0; updateHUD(); return true; },
  setEnemyY: (id, y) => { const e = enemies.find(x => x.id === id); if (!e) return false; e.y = +y; e.drawX = positionX(e); return true; },
  setEnemyHp: (id, v) => { const e = enemies.find(x => x.id === id); if (!e) return false; e.hp = Math.max(0, v); return true; },
  setShield: (id, v) => { const e = enemies.find(x => x.id === id); if (!e) return false; e.shield = Math.max(0, v); return true; },
  setHp: (v) => { hp = clamp(+v || 0, 0, maxHp); updateHUD(); },
  setInk: (v) => { ink = Math.max(0, Math.round(+v || 0)); updateHUD(); },
  addInk: (v) => { ink = Math.max(0, ink + Math.round(+v || 0)); updateHUD(); },
  setScore: (v) => { score = Math.max(0, Math.round(+v || 0)); updateHUD(); },
  setWave: (v) => { wave = Math.max(0, Math.floor(+v || 0)); updateHUD(); },
  setCharge: (v) => { charge = clamp(+v || 0, 0, 99.9); updateHUD(); },
  setStats: (o = {}) => {
    if ('score' in o) score = Math.max(0, Math.round(+o.score || 0));
    if ('ink' in o) ink = Math.max(0, Math.round(+o.ink || 0));
    if ('hp' in o) hp = clamp(+o.hp || 0, 0, maxHp);
    if ('maxHp' in o) maxHp = Math.max(1, Math.round(+o.maxHp || 1));
    if ('wave' in o) wave = Math.max(0, Math.floor(+o.wave || 0));
    if ('combo' in o) combo = Math.max(0, Math.floor(+o.combo || 0));
    if ('maxCombo' in o) maxCombo = Math.max(0, Math.floor(+o.maxCombo || 0));
    if ('correct' in o) correctChars = Math.max(0, Math.floor(+o.correct || 0));
    if ('misses' in o) misses = Math.max(0, Math.floor(+o.misses || 0));
    if ('activeT' in o) activeT = Math.max(0, +o.activeT || 0);
    if ('wordsDone' in o) wordsDone = Math.max(0, Math.floor(+o.wordsDone || 0));
    if ('kills' in o) kills = Math.max(0, Math.floor(+o.kills || 0));
    if ('leaks' in o) leaks = Math.max(0, Math.floor(+o.leaks || 0));
    if ('charge' in o) charge = clamp(+o.charge || 0, 0, 99.9);
    updateHUD();
  },
  fresh: (w = 1) => {
    resetRun();
    wave = Math.max(1, Math.floor(+w || 1));
    mode = 'play'; waveActive = false; queue = []; enemies = []; waveT = 0;
    hideOverlays(); showHUD(true); updateHUD();
  },
  startWave: (w) => { startWave(Number.isFinite(+w) ? +w : wave + 1); },
  nextWave: () => startWave(wave + 1),
  flushQueue: () => { while (queue.length) spawnFromQueue(queue.shift()); updateHUD(); },
  wipeEnemies: () => { for (const e of enemies) e.alive = false; enemies = []; queue = []; lockId = 0; updateHUD(); },
  clearWaveNow: () => { enemies.forEach(e => { e.alive = false; }); enemies = []; queue = []; waveActive = true; mode = 'play'; waveT = 1; onWaveClear(); },
  autoResolve: () => {
    for (let pass = 0; pass < 10; pass++) {
      const alive = enemies.filter(e => e.alive);
      if (!alive.length) break;
      for (const e of alive) {
        if (!e.alive) continue;
        e.typed = e.word.length;
        completeTarget(e);
      }
    }
    updateHUD();
  },
  forceGameOver: () => { hp = 0; gameOver(); },
  forceFail: () => { hp = 0; gameOver(); },
  forceMilestone: () => { milestoneDone = true; wave = Math.max(wave, 10); triggerMilestone(); },
  forceWin: () => { milestoneDone = true; wave = Math.max(wave, 10); triggerMilestone(); },
  buyUpgrade,
  skipDraft,
  openDraft,
  upgradeCost,
  wordReward,
  chargeGain,
  wordLenCap,
  waveSpec,
  enemyDefs: () => JSON.parse(JSON.stringify(ENEMY_DEFS)),
  wordCounts: () => ({ ...WORD_COUNTS }),
  records: () => ({ ...rec }),
  saveRecords,
  storageSnapshot,
  restoreStorage,
  storageKeys: { ...STORE },
  reports: () => reports.slice(),
  clearReports: () => { reports.length = 0; },
  setSeed: (n) => { seed = (+n >>> 0) || 1; rng = mulberry32(seed); recentWords = []; },
  setMuted: (v) => { audio.setMuted(v); updateHUD(); },
  toggleMute,
  togglePause,
  setPaused: (v) => { if (mode === 'play') { paused = !!v; paused ? showPause() : hidePause(); updateHUD(); } },
  startGame,
  restartGame: () => { restartGame(); },
  toTitle,
  continueEndless,
  settleFromMilestone,
  demoScene,
  render,
  update: (dt = DT) => stepGame(dt),
  audio,
  version: '1.0.0',
};
window.__G = G;
window.G = G;

// ---------- demo scene (thumbnail / representative play) ----------
function demoScene() {
  resetRun();
  mode = 'play';
  wave = 6;
  score = 4280; ink = 96; hp = 76; maxHp = 100;
  fireLv = 1; wordLv = 0; guardLv = 1;
  combo = 9; maxCombo = 14; correctChars = 214; misses = 9; activeT = 44; charge = 63;
  waveActive = true; queue = []; enemies = [];
  const specs = [
    ['slab', 'lantern', 1, 152, 3],
    ['darter', 'ember', 2, 292, 1],
    ['splitter', 'citadel', 4, 224, 2],
    ['shield', 'palisade', 5, 168, 1],
    ['darter', 'ink', 6, 258, 1],
  ];
  for (const [kind, word, lane, y, hpv] of specs) {
    const e = spawnEnemy(kind, { lane, y, word, hp: hpv });
    e.drawX = positionX(e);
  }
  const lock = enemies.find(e => e.word === 'ember');
  if (lock) { lock.typed = 2; lockId = lock.id; }
  burstAt(VW * .38, VH * .36, 14, '#78e0c8', 50, 170, .7);
  burstAt(VW * .62, VH * .26, 9, '#e8c07a', 40, 140, .6);
  floats.push({ x: VW * .62, y: VH * .3, vy: -20, life: 1.4, max: 1.4, text: '+66', color: '#f2cf8c', size: 18 });
  clearTimeout(bannerTimer); clearTimeout(toastTimer);
  el.banner.classList.remove('show'); el.toast.classList.remove('show');
  hideOverlays(); showHUD(true);
  updateHUD();
  render();
}

// ---------- boot ----------
computeLayout();
buildVKB();
touchMode = (navigator.maxTouchPoints || 0) > 0 || (window.matchMedia && matchMedia('(pointer:coarse)').matches);
if (touchMode) document.body.classList.add('touch');
loadRecords();
updateTitleRecords();
showTitleScreen();
audio.setMuted(audio.isMuted());
requestAnimationFrame(frame);

if (PARAMS.has('autostart')) {
  startGame();
  if (PARAMS.get('demo') !== '0') demoScene();
}

// ==================== autotest suite ====================
async function autotest() {
  G.setNoAuto(true);
  const nap = () => new Promise(r => { const mc = new MessageChannel(); mc.port1.onmessage = () => r(); mc.port2.postMessage(0); });
  const T = window.__TEST = { pass: 0, fail: 0, total: 0, results: [], done: false };
  const ok = (id, cond, name = '') => {
    T.results.push({ id, ok: !!cond, name });
    cond ? T.pass++ : T.fail++;
    T.total = T.results.length;
  };
  const up = (n = 1) => G.upd(n);
  const saved = storageSnapshot();
  const savedMuted = audio.isMuted();
  const frames = [];
  G.setReportTarget(f => frames.push(f));
  audio.setMuted(true);
  await nap();

  try {
    // T1 — boot clean
    ok('T1', G.err.length === 0 && (window.__BOOTERR || []).length === 0, '启动零报错');

    // T2 — a real wave runs without NaN
    G.setSeed(20261120);
    G.startGame();
    up(150);
    const s2 = G.state();
    ok('T2', s2.mode === 'play' && !s2.nan && Number.isFinite(s2.score) && s2.wave === 1,
      `第1波 150 帧无 NaN，敌人=${s2.enemyCount} 队列=${s2.queueCount}`);

    // T3 — typing a whole word fires and kills (core loop)
    G.fresh();
    const id3 = G.spawn('darter', 'ink');
    G.typeLetter('i');
    const a3 = G.enemyInfo(id3);
    G.typeLetter('n');
    const b3 = G.enemyInfo(id3);
    G.typeLetter('k');
    const c3 = G.enemyInfo(id3);
    const s3 = G.state();
    ok('T3', a3.typed === 1 && b3.typed === 2 && b3.alive && !c3.alive && s3.kills >= 1 && s3.score > 0,
      `逐字 1→2→完成，击杀=${s3.kills} 得分=${s3.score}`);

    // T4 — a wrong key breaks combo and lowers accuracy
    G.fresh();
    G.spawn('darter', 'arc');
    G.typeText('arc');
    const before4 = G.state();
    G.spawn('darter', 'sun');
    G.typeLetter('x');
    const after4 = G.state();
    ok('T4', before4.combo === 1 && after4.combo === 0 && after4.misses > before4.misses && after4.accuracy < before4.accuracy,
      `连击 ${before4.combo}→${after4.combo}，准确 ${before4.accuracy}%→${after4.accuracy}%`);

    // T5 — shield eats the first completed word, second kills
    G.fresh();
    const id5 = G.spawn('shield', 'oak');
    G.typeText('oak');
    const a5 = G.enemyInfo(id5);
    ok('T5a', a5.alive && a5.shield === 0 && a5.hp === 1, `盾碎但存活 hp=${a5.hp} shield=${a5.shield}`);
    G.setWord(id5, 'ash');
    G.typeText('ash');
    const b5 = G.enemyInfo(id5);
    ok('T5b', !b5.alive, '第二次完成击杀盾鳞');

    // T6 — splitter spawns exactly two shards on death
    G.fresh();
    const id6 = G.spawn('splitter', 'arc', { hp: 1 });
    G.typeText('arc');
    up(1);
    const shards = G.enemies().filter(e => e.alive && e.kind === 'shard');
    const i6 = G.enemyInfo(id6);
    ok('T6', (!i6 || !i6.alive) && shards.length === 2, `裂晶分裂出 ${shards.length} 只碎晶`);

    // T7 — combo reward maths (pure)
    const r7a = G.wordReward(5, 0), r7b = G.wordReward(5, 12);
    ok('T7', r7a.score === 30 && r7b.score > r7a.score && r7b.ink > r7a.ink && Number.isInteger(r7b.score),
      `5字母 0连击 ${r7a.score}/${r7a.ink}墨 → 12连击 ${r7b.score}/${r7b.ink}墨`);

    // T8 — economy: ink and score both rise on a completed word
    G.fresh();
    G.setInk(10);
    G.spawn('darter', 'arc');
    G.typeText('arc');
    const s8 = G.state();
    ok('T8', s8.ink > 10 && s8.score >= 30, `墨能 10→${s8.ink}，得分 ${s8.score}`);

    // T9 — upgrade purchase deducts ink and raises damage
    G.fresh();
    G.setInk(100);
    const cost9 = G.upgradeCost('fire');
    const bought9 = G.buyUpgrade('fire');
    const s9 = G.state();
    ok('T9', bought9 === true && s9.fireLv === 1 && s9.damage === 2 && s9.ink === 100 - cost9,
      `连弩 Lv1，墨能 100→${s9.ink}（价 ${cost9}），伤害 ${s9.damage}`);

    // T10 — insufficient ink rejects the upgrade
    G.fresh();
    G.setInk(0);
    const bought10 = G.buyUpgrade('guard');
    const s10 = G.state();
    ok('T10', bought10 === false && s10.guardLv === 0 && s10.ink === 0, '墨能不足拒绝升级');

    // T11 — word-length upgrade lowers the word cap
    G.fresh(1);
    const cap0 = G.wordLenCap();
    G.setInk(1000);
    G.buyUpgrade('word');
    const cap1 = G.wordLenCap();
    ok('T11', cap0 >= 4 && cap1 === Math.max(3, cap0 - 1), `单词上限 ${cap0}→${cap1}`);

    // T12 — guard upgrade raises max HP and heals
    G.fresh();
    G.setHp(50);
    const max0 = G.state().maxHp;
    G.setInk(1000);
    G.buyUpgrade('guard');
    const s12 = G.state();
    ok('T12', s12.maxHp === max0 + 15 && s12.hp === 65, `词垒上限 ${max0}→${s12.maxHp}，HP ${s12.hp}`);

    // T13 — accuracy and WPM formulas
    G.fresh();
    G.setStats({ correct: 40, misses: 10, activeT: 60 });
    const s13 = G.state();
    ok('T13', Math.abs(s13.accuracy - 80) < .05 && s13.wpm === 8, `准确 ${s13.accuracy}% / WPM ${s13.wpm}`);

    // T14 — an enemy reaching the wall damages HP, not instant death
    G.fresh();
    const hp0 = G.state().hp;
    const id14 = G.spawn('darter', 'sun', { y: G.state().wallY - 2 });
    up(2);
    const s14 = G.state();
    const i14 = G.enemyInfo(id14);
    ok('T14', s14.hp === hp0 - 8 && s14.mode === 'play' && s14.leaks === 1 && (!i14 || !i14.alive),
      `词垒 ${hp0}→${s14.hp}，漏过 ${s14.leaks}`);

    // T15 — HP zero reaches gameOver and reports it
    frames.length = 0;
    G.fresh();
    G.setHp(5);
    G.spawn('darter', 'sun', { y: G.state().wallY - 2 });
    up(3);
    const s15 = G.state();
    ok('T15a', s15.mode === 'over' && s15.hp === 0, `HP 归零 → ${s15.mode}`);
    ok('T15b', frames.some(f => f.kind === 'gameOver') && !document.getElementById('end').classList.contains('hide'),
      'gameOver 上报帧 + 结算面板');

    // T16 — wave 10 boss milestone: complete report + endless continues
    G.fresh(10);
    const id16 = G.spawn('boss', null, { segments: ['impenetrable', 'fortification', 'constellation'] });
    const b16 = G.enemyInfo(id16);
    G.setWord(id16, 'arc'); G.typeText('arc'); G.upd(1);
    const b16b = G.enemyInfo(id16);
    G.setWord(id16, 'ash'); G.typeText('ash'); G.upd(1);
    G.setWord(id16, 'ink'); G.typeText('ink'); G.upd(20);
    const s16 = G.state();
    const i16c = G.enemyInfo(id16);
    ok('T16a', b16.boss && b16.maxHp === 3 && b16b.alive && b16b.hp === 2 && (!i16c || !i16c.alive) && s16.milestone,
      `三段垒主 3→2→0，里程碑=${s16.milestone}`);
    ok('T16b', frames.some(f => f.kind === 'complete'), 'complete 上报帧');
    ok('T16c', s16.mode === 'milestone' && !document.getElementById('milestone').classList.contains('hide'), '里程碑面板出现');
    G.continueEndless();
    const s16d = G.state();
    ok('T16d', s16d.endless === true && (s16d.mode === 'draft' || s16d.mode === 'play'),
      `继续无尽，模式=${s16d.mode}`);

    // T17 — simulated keyboard input drives the real handleKeys path
    G.fresh();
    const id17 = G.spawn('darter', 'arc');
    G.press('KeyA'); up(1);
    const i17a = G.enemyInfo(id17);
    G.press('KeyR'); up(1);
    const i17b = G.enemyInfo(id17);
    G.press('KeyC'); up(1);
    const i17c = G.enemyInfo(id17);
    const s17 = G.state();
    ok('T17', i17a.typed === 1 && i17b.typed === 2 && i17b.alive && !i17c.alive && s17.kills === 1,
      `press A/R/C 逐字生效，typed ${i17a.typed}/${i17b.typed}，击杀 ${s17.kills}`);

    // T18 — P pause freezes enemies and active time, P resumes
    G.fresh();
    const id18 = G.spawn('slab', 'ember');
    up(30);
    const y18a = G.enemyInfo(id18).y, t18a = G.state().activeT;
    G.press('KeyP'); up(1);
    const paused18 = G.state().paused;
    up(90);
    const y18b = G.enemyInfo(id18).y, t18c = G.state().activeT;
    G.press('KeyP'); up(1);
    up(30);
    const y18c = G.enemyInfo(id18).y;
    ok('T18', paused18 && Math.abs(y18b - y18a) < 1e-6 && Math.abs(t18c - t18a) < 1e-6 && !G.state().paused && y18c > y18b,
      `暂停冻结=${paused18}，恢复后 y ${y18b.toFixed(1)}→${y18c.toFixed(1)}`);

    // T19 — touch virtual key + in-page input field + pause button
    G.fresh();
    const id19 = G.spawn('darter', 'arc');
    const vk = document.querySelector('#vkb .vkbtn[data-ch="a"]');
    vk.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch', pointerId: 5, isPrimary: true }));
    up(1);
    const i19a = G.enemyInfo(id19);
    const tf = document.getElementById('typefield');
    tf.value = 'r';
    tf.dispatchEvent(new Event('input', { bubbles: true }));
    up(1);
    const i19b = G.enemyInfo(id19);
    const pb = document.getElementById('btnPause');
    pb.click();
    const paused19 = G.state().paused;
    pb.click();
    ok('T19', i19a.typed === 1 && i19b.typed === 2 && paused19 === true && G.state().paused === false,
      `虚拟键→输入框 typed ${i19a.typed}→${i19b.typed}，暂停按钮=${paused19}`);

    // T20 — charge gain triggers an automatic volley and damages the field
    G.fresh();
    G.setCharge(99);
    const id20 = G.spawn('slab', 'arc');
    G.typeLetter('a');
    const s20 = G.state();
    const i20 = G.enemyInfo(id20);
    ok('T20', s20.volleys === 1 && s20.charge < 2 && i20.hp < 3 && i20.alive,
      `充能满自动齐射，volleys=${s20.volleys} 厚壁 hp=${i20.hp}`);

    // T21 — boss has multi-segment long words
    G.fresh(8);
    const id21 = G.spawn('boss', null, { segments: ['stronghold', 'battlement'] });
    const b21a = G.enemyInfo(id21);
    G.setWord(id21, 'arc'); G.typeText('arc');
    const b21b = G.enemyInfo(id21);
    G.setWord(id21, 'ash'); G.typeText('ash');
    const b21c = G.enemyInfo(id21);
    ok('T21', b21a.maxHp === 2 && b21a.segments.length === 2 && b21b.alive && b21b.hp === 1 && !b21c.alive,
      `双段垒主 2→1→0，原词 ${b21a.segments.join('+')}`);

    // T22 — four ordinary enemy archetypes exist
    const defs = G.enemyDefs();
    ok('T22', ['slab', 'darter', 'splitter', 'shield'].every(k => defs[k] && defs[k].zh) && defs.shield.shield === 1,
      '厚壁/疾羽/裂晶/盾鳞 四类敌人齐全');

    // T23 — wave composition and boss cadence
    const w1 = G.waveSpec(1), w8 = G.waveSpec(8), w9 = G.waveSpec(9), w10 = G.waveSpec(10);
    ok('T23', w1.boss === false && w1.count >= 5 && w8.boss && w10.boss && !w9.boss,
      `第1波 ${w1.count} 敌；第8/10波为 Boss，第9波不是`);

    // T24 — R restart fully resets the run
    G.fresh();
    G.setStats({ score: 200, ink: 88, combo: 5, hp: 40 });
    G.spawn('darter', 'sun');
    G.press('KeyR'); up(1);
    const s24 = G.state();
    ok('T24', s24.mode === 'play' && s24.wave === 1 && s24.score === 0 && s24.ink === 0 && s24.hp === s24.maxHp && s24.combo === 0 && s24.fireLv === 0 && s24.enemyCount === 0,
      `重开复位：波 ${s24.wave}、得分 ${s24.score}、HP ${s24.hp}/${s24.maxHp}`);

    // T25 — site protocol ordering / integer scores
    ok('T25a', reports.length > 0 && reports[0].kind === 'ready', `本地首帧 ${reports[0] && reports[0].kind}`);
    const kinds = frames.map(f => f.kind);
    ok('T25b', kinds.includes('progress') && kinds.includes('gameOver') && kinds.includes('complete'),
      `捕获帧序 ${kinds.join('→')}`);
    ok('T25c', frames.every(f => f.score === undefined || Number.isInteger(f.score)), '上报分数均为整数');

    // T26 — records round-trip through localStorage
    const snap26 = G.storageSnapshot();
    G.fresh();
    G.setStats({ score: 4321, wave: 7, maxCombo: 18, correct: 100, misses: 5, activeT: 60 });
    G.saveRecords();
    const rec26 = G.records();
    let lsBest = 0;
    try { lsBest = parseInt(localStorage.getItem('lxb.best') || '0', 10); } catch (e) { }
    ok('T26', rec26.best >= 4321 && rec26.wave >= 7 && rec26.combo >= 18 && rec26.acc > 0 && rec26.wpm > 0 && lsBest >= 4321,
      `best=${rec26.best} wave=${rec26.wave} combo=${rec26.combo} acc=${rec26.acc}% wpm=${rec26.wpm}`);
    G.restoreStorage(snap26);

    // T27 — full 12-wave fast-forward: no crash, no NaN, milestone at wave 10
    const errBefore = G.err.length;
    G.fresh(1);
    let sawMilestone = false, sawDraft = false, sawNaN = false;
    for (let w = 1; w <= 12; w++) {
      G.setInk(1000);
      G.startWave(w);
      G.flushQueue();
      G.autoResolve();
      for (let i = 0; i < 70; i++) {
        up(1);
        if (G.state().mode !== 'play') break;
      }
      let s = G.state();
      if (s.mode === 'milestone') { sawMilestone = true; G.continueEndless(); s = G.state(); }
      if (s.mode === 'draft') {
        sawDraft = true;
        G.setInk(1000);
        G.buyUpgrade(['fire', 'word', 'guard'][w % 3]);
        s = G.state();
      }
      if (s.nan) sawNaN = true;
    }
    const s27 = G.state();
    ok('T27a', sawMilestone, '第 10 波垒主触发里程碑');
    ok('T27b', !sawNaN && !s27.nan && G.err.length === errBefore, `12 波快进无 NaN，错误增量 ${G.err.length - errBefore}`);
    ok('T27c', s27.wave >= 12 && s27.score > 0 && sawDraft, `抵达第 ${s27.wave} 波，得分 ${s27.score}`);

    // T28 — localStorage exact restore
    G.setMuted(savedMuted);
    G.restoreStorage(saved);
    let restored = true;
    for (const k of Object.values(G.storageKeys)) {
      const a = saved[k] == null ? null : saved[k];
      const b = localStorage.getItem(k);
      if (a !== b) restored = false;
    }
    ok('T28', restored, 'localStorage 原值逐键还原');

    // T29 — zero external network traffic (page-level wrapper)
    const net = window.__NET || { fetch: 0, xhr: 0, ws: 0, external: [] };
    ok('T29', net.fetch + net.xhr + net.ws === 0 && net.external.length === 0, `外网请求 ${net.external.length}`);

    // T30 — Chinese UI / series mark / touch controls in the DOM
    const titleText = document.getElementById('title').textContent;
    ok('T30', titleText.includes('灯匠夜游 · 第 7 铺') && document.querySelectorAll('#vkb .vkbtn').length === 26 &&
      !!el.typefield && !!el.btnPause && !!el.btnMute && !!el.btnRestart && !!el.endRetry && !!el.endHome,
      '标题系列标记、26 字母键与操作按钮齐全');

    // T31 — WebAudio state switching and mute (no context before a gesture,
    // so the autotest stays silent and the console clean)
    const hadCtx = audio.hasCtx();
    audio.setState('boss');
    const aState = audio.state();
    audio.setMuted(true);
    ok('T31', !hadCtx && aState === 'boss' && audio.isMuted(), `静默自测，BGM=${aState}，muted=${audio.isMuted()}`);

    // T32 — back to title, muted, finite
    G.toTitle();
    const s32 = G.state();
    ok('T32', s32.mode === 'title' && !el.title.classList.contains('hide') && el.end.classList.contains('hide') && s32.muted === true && !s32.nan,
      '测完静音回标题');

    // T33 — every reported score is an integer
    const allFrames = reports.concat(frames);
    ok('T33', allFrames.every(f => f.score === undefined || Number.isInteger(f.score)), '全部上报帧分数为整数');

    T.done = true;
    T.total = T.results.length;
    T.pass = T.results.filter(r => r.ok).length;
    T.fail = T.results.filter(r => !r.ok).length;
    console.log(`[lexicon-bastion autotest] ${T.pass}/${T.total} passed`);
  } catch (err) {
    T.crash = String(err && err.stack || err);
    T.results.push({ id: 'CRASH', ok: false, name: T.crash });
    T.total = T.results.length;
    T.pass = T.results.filter(r => r.ok).length;
    T.fail = T.results.filter(r => !r.ok).length;
    T.done = true;
    console.log('[lexicon-bastion autotest] crashed:', T.crash);
    try { G.toTitle(); } catch (e) { }
  } finally {
    try { G.setMuted(savedMuted); } catch (e) { }
    try { G.restoreStorage(saved); } catch (e) { }
    try { G.setReportTarget(null); } catch (e) { }
    T.done = true;
    T.total = T.results.length;
    T.pass = T.results.filter(r => r.ok).length;
    T.fail = T.results.filter(r => !r.ok).length;
  }
}

if (AUTOTEST) autotest();
