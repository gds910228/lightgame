// Deep Catch Saga 深海垂钓记 — casual fishing + collection game.
// guizang-game-skill methodology, third series #5. Structure mirrors the
// orchard-fusion benchmark: fixed-step loop, window.G debug hooks,
// ?autotest=1 suite (MessageChannel nap), site report bridge, WebAudio synth.
// Three-stage loop (cast → sink → reel QTE) + 42-fish dex + coin upgrades.

import {
  FISH, LAYERS, QUALITIES, DEPTH_TIERS, TEMPO,
  fishOf, poolWeights, weightFor, makeFishSprites, drawFish, drawFishInBox,
} from './fish.js';
import { makeStages, layerOf, castPowerAt, SURFACE_Y, PX_M, W, H, WORLD_H } from './stages.js';
import { makeAudio } from './audio.js';
import { makeUI } from './ui.js';

// ==================== constants ====================
const AUTOTEST = new URLSearchParams(location.search).has('autotest');
const MILESTONES = [
  { pct: 10, coins: 200 }, { pct: 25, coins: 500 }, { pct: 50, coins: 1200 },
  { pct: 75, coins: 2500 }, { pct: 100, coins: 6000 },
];
const UPGRADES = [
  { name: '下沉速度', desc: '鱼钩下潜更快，直抵深层', costs: [120, 260, 480, 800] },
  { name: '张力容错', desc: '挣扎期张力上升更慢', costs: [100, 220, 420, 700] },
  { name: '稀有运气', desc: '稀有及以上鱼出现率提升', costs: [150, 320, 600, 1000] },
  { name: '磁力吸附', desc: '鱼钩自动小幅避开障碍', costs: [200, 450, 850] },
];
const HINTS = {
  dock: '',
  cast: '空格 / 点按 停针 —— 指针越靠中心，抛得越远！',
  fly: '抛竿！',
  sink: 'A/D 或左右半屏 移动鱼钩 · 空格/S 收杆 · 避开礁石与水母',
  reel: '鱼挣扎时松手，平稳时按住收线（空格 / 按住屏幕）',
  result: '收获！点按继续',
  retract: '',
};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const r1 = v => Math.round(v * 10) / 10;

// ==================== persistent state ====================
let mode = 'title';                    // title | play
let paused = false, noAuto = false, panel = null;
let score = 0, playT = 0, lastProgressT = -99;
let hitstop = 0, shakeT = 0, shakeAmp = 0, flashT = 0;

function loadSave() {
  const d = { coins: 0, upg: [0, 0, 0, 0], dex: {}, ms: [false, false, false, false, false] };
  try {
    const j = JSON.parse(localStorage.getItem('dcs.save') || 'null');
    if (j) {
      d.coins = j.coins | 0 || 0;
      if (Array.isArray(j.upg)) for (let i = 0; i < 4; i++) d.upg[i] = clamp(j.upg[i] | 0, 0, UPGRADES[i].costs.length);
      if (j.dex && typeof j.dex === 'object') {
        for (const f of FISH) { const w = +j.dex[f.id]; if (w > 0) d.dex[f.id] = w; }
      }
      if (Array.isArray(j.ms)) for (let i = 0; i < 5; i++) d.ms[i] = !!j.ms[i];
    }
  } catch (e) { }
  return d;
}
function persistSave() { try { localStorage.setItem('dcs.save', JSON.stringify(save)); } catch (e) { } }
function loadBest() {
  try {
    const j = JSON.parse(localStorage.getItem('dcs.best') || 'null');
    if (j && typeof j === 'object') return { top: Math.max(0, j.top | 0), dex: clamp(+j.dex || 0, 0, 100) };
  } catch (e) { }
  return { top: 0, dex: 0 };
}
function persistBest() { try { localStorage.setItem('dcs.best', JSON.stringify({ top: best.top, dex: r1(best.dex) })); } catch (e) { } }

let save = loadSave();
let best = loadBest();
let muted = false;
try { muted = localStorage.getItem('dcs.mute') === '1'; } catch (e) { }

function dexPct() { return Object.keys(save.dex).length / FISH.length * 100; }

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
makeFishSprites(Math.min(2, Math.max(1.5, DPR)));
let spritesReady = true;

// static water strip (pre-rendered once): 6 depth bands + plankton + seafloor
const bgStrip = document.createElement('canvas');
bgStrip.width = W; bgStrip.height = WORLD_H;
{
  const c = bgStrip.getContext('2d');
  const g = c.createLinearGradient(0, SURFACE_Y, 0, WORLD_H);
  const stops = [[0, '#83dbef'], [15, '#54bfdc'], [40, '#2f93ba'], [80, '#20658f'], [140, '#1d4469'], [220, '#132c4b'], [360, '#060e1d']];
  for (const [d, col] of stops) g.addColorStop(Math.min(1, (SURFACE_Y + d * PX_M) / WORLD_H), col);
  g.addColorStop(1, '#04080f');
  c.fillStyle = g;
  c.fillRect(0, SURFACE_Y, W, WORLD_H - SURFACE_Y);
  for (let i = 0; i < 170; i++) {
    const y = SURFACE_Y + Math.random() * (WORLD_H - SURFACE_Y);
    c.fillStyle = `rgba(255,255,255,${.03 + Math.random() * .05})`;
    c.beginPath(); c.arc(Math.random() * W, y, 1 + Math.random() * 1.6, 0, 7); c.fill();
  }
  c.fillStyle = '#050a14';
  c.beginPath();
  c.moveTo(0, WORLD_H);
  for (let x = 0; x <= W; x += 40) c.lineTo(x, WORLD_H - 34 - Math.sin(x * .02) * 14 - Math.random() * 10);
  c.lineTo(W, WORLD_H); c.closePath(); c.fill();
  c.fillStyle = '#0a1626';
  for (let i = 0; i < 7; i++) {
    const x = 30 + Math.random() * (W - 60), r = 12 + Math.random() * 20;
    c.beginPath(); c.arc(x, WORLD_H - 26, r, Math.PI, 0); c.fill();
  }
}
const STARS = Array.from({ length: 46 }, () => [Math.random() * W, Math.random() * 225]);

// ==================== fx systems ====================
const parts = [], floats = [], coinfx = [], schools = [];
let bubbleAcc = 0, schoolTimer = 1.2, camY = 0;
const fx = {
  burst(x, y, color, n = 10, spd = 140) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = spd * (.4 + Math.random() * .8);
      parts.push({ type: 'dot', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 60, grav: 240, life: .5 + Math.random() * .4, max: .9, size: 2 + Math.random() * 3.5, color });
    }
  },
  sparkle(x, y, n = 10) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = 60 + Math.random() * 160;
      parts.push({ type: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: .6 + Math.random() * .5, max: 1.1, color: Math.random() < .5 ? '#ffd44e' : '#fff6c8', size: 2 + Math.random() * 3 });
    }
  },
  ring(x, y, color = 'rgba(255,255,255,.7)', vr = 130) {
    parts.push({ type: 'ring', x, y, r: 4, vr, life: .7, max: .7, color });
  },
  splash(x, y) {
    this.ring(x, y, 'rgba(240,252,255,.8)', 150);
    this.ring(x, y, 'rgba(200,240,255,.5)', 100);
    for (let i = 0; i < 10; i++) {
      parts.push({ type: 'dot', x: x + Math.random() * 16 - 8, y, vx: Math.random() * 120 - 60, vy: -160 - Math.random() * 180, grav: 620, life: .5 + Math.random() * .3, max: .8, size: 2 + Math.random() * 2.5, color: '#dff2fc' });
    }
  },
  float(text, x, y, color = '#fff2d8', size = 20) { floats.push({ x, y, text, life: 1, color, size }); },
  shake(t, amp) { shakeT = Math.max(shakeT, t); shakeAmp = Math.max(shakeAmp, amp); },
  stop(t) { hitstop = Math.max(hitstop, t); },
};

function coinFly(n) {
  for (let i = 0; i < n; i++) {
    coinfx.push({ x: 250 + Math.random() * 60 - 30, y: 460 + Math.random() * 40 - 20, t: -i * .07, dur: .55 + Math.random() * .25 });
  }
}

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
report('ready', { game: 'deep-catch-saga' });

// ==================== audio / ui / stages ====================
const audio = makeAudio();
audio.setMuted(muted);

const ui = makeUI({
  onStart: () => { audio.sfx.ui(); startGame(); },
  onContinue: () => { audio.sfx.ui(); stages.endResult(); },
  onDex: () => { audio.sfx.ui(); openPanel('dex'); },
  onShop: () => { audio.sfx.ui(); openPanel('shop'); },
  onCloseDex: () => { audio.sfx.ui(); openPanel(null); },
  onCloseShop: () => { audio.sfx.ui(); openPanel(null); },
  onMute: () => toggleMute(),
  onPause: () => { audio.sfx.ui(); togglePause(); },
  onReelHold: (v) => { reelBtnHold = !!v; },
  onBuy: (i) => { buyUpgrade(i); },
  drawFishCell: (c, fish, sil) => drawFishInBox(c, fish, 0, 0, c.canvas.width, c.canvas.height, sil),
});
ui.setBestLine(best.top, best.dex);
ui.showTitle(true);
ui.setMutedIcon(muted);

const rng = Math.random;
const stages = makeStages({
  rng,
  noAuto: () => noAuto,
  upgrades: () => save.upg,
  audio,
  fx,
  drawFish,
  hooks: {
    onCatch: (f, w) => catchFish(f, w),
    onSnap: (f) => snapFish(f),
    onRock: () => ui.showToast('鱼线挂到礁石，收回重抛', 2000),
    onJelly: () => ui.showToast('被水母麻痹 0.8 秒，不能移动！', 2000),
  },
});

// ==================== game flow ====================
function resetPlay() {
  score = 0; playT = 0; lastProgressT = -99;
  hitstop = 0; shakeT = 0; flashT = 0;
  const S = stages.S;
  S.stage = 'cast'; S.castPos = 50; S.castDir = 1; S.castPower = 0; S.cap = 15;
  S.depth = 0; S.hookX = 270; S.hookVX = 0; S.stunT = 0; S.rising = false;
  S.fish = null; S.weight = 0; S.phase = 'calm'; S.phaseT = 0; S.phaseIdx = 0;
  S.tension = 0; S.bursts = 0; S.progress = 0;
  S.rocks.length = 0; S.jellies.length = 0;
  S.caughtCount = 0; S.lostCount = 0; S.resultT = 0; S.retractT = 0; S.retractReason = '';
  ui.setScore(0);
}
function startGame() {
  resetPlay();
  mode = 'play'; paused = false;
  openPanel(null);
  ui.showTitle(false); ui.showResult(false); ui.setPausedIcon(false);
  ui.showBanner('开钓！', '指针停在中心区 = 远投', 1300);
  if (!audio.hasCtx() && !AUTOTEST) audio.ensure();
}
function toTitle() {
  mode = 'title'; paused = false;
  openPanel(null);
  stages.S.stage = 'dock'; stages.S.fish = null; stages.S.depth = 0; stages.S.hookX = 270;
  ui.showTitle(true); ui.showResult(false); ui.setPausedIcon(false);
  ui.setBestLine(best.top, best.dex);
}
function togglePause() {
  if (mode !== 'play' || panel) return;
  paused = !paused;
  ui.setPausedIcon(paused);
  if (paused) { audio.stop(); ui.showBanner('已暂停', '按 P 或点按继续', 999999); }
  else ui.el.banner.classList.remove('show');
}
function toggleMute() {
  muted = !muted;
  audio.setMuted(muted);
  ui.setMutedIcon(muted);
  try { localStorage.setItem('dcs.mute', muted ? '1' : '0'); } catch (e) { }
}
function openPanel(name) {
  panel = name || null;
  ui.showDex(panel === 'dex');
  ui.showShop(panel === 'shop');
  if (panel) ui.showResult(false);   // panels take precedence over the catch card
  if (panel === 'dex') ui.refreshDex(save.dex, dexPct());
  if (panel === 'shop') ui.refreshShop(save.upg, save.coins, UPGRADES);
}
function buyUpgrade(i) {
  const def = UPGRADES[i];
  if (!def) return false;
  const lvl = save.upg[i] | 0;
  if (lvl >= def.costs.length) return false;
  const cost = def.costs[lvl];
  if (save.coins < cost) return false;
  save.coins -= cost;
  save.upg[i] = lvl + 1;
  persistSave();
  ui.setCoins(save.coins);
  if (panel === 'shop') ui.refreshShop(save.upg, save.coins, UPGRADES);
  audio.sfx.buy();
  ui.showToast(def.name + ' 升级到 Lv.' + (lvl + 1) + '！', 1600);
  return true;
}
function reloadPersistence() {
  save = loadSave();
  best = loadBest();
  ui.setScore(score); ui.setCoins(save.coins); ui.setDexPct(dexPct());
  ui.setBestLine(best.top, best.dex);
}

// ==================== economy / dex ====================
function checkMilestones() {
  const pct = dexPct();
  let granted = 0;
  MILESTONES.forEach((m, i) => {
    if (!save.ms[i] && pct >= m.pct - 1e-9) {
      save.ms[i] = true;
      save.coins += m.coins;
      granted += m.coins;
      ui.showToast(`图鉴收集度达到 ${m.pct}%！里程碑奖励 +${m.coins} 金币`, 2800);
      audio.sfx.milestone();
      coinFly(8);
      report('event', { tag: 'milestone', pct: m.pct, coins: m.coins });
    }
  });
  if (granted) { persistSave(); ui.setCoins(save.coins); }
  return granted;
}

function catchFish(f, w) {
  const gain = f.score, price = f.price;
  score += gain;
  save.coins += price;
  if (w > (save.dex[f.id] || 0)) save.dex[f.id] = w;
  const prevTop = best.top;
  if (f.score > best.top) best.top = f.score;
  best.dex = dexPct();
  persistSave(); persistBest();
  checkMilestones();

  ui.setScore(score); ui.setCoins(save.coins); ui.setDexPct(dexPct());
  ui.showCatch(f, w, gain, price, QUALITIES[f.q].name, QUALITIES[f.q].color);

  const S = stages.S;
  const hy = SURFACE_Y + S.depth * PX_M;
  fx.burst(S.hookX, hy, QUALITIES[f.q].color, 16 + f.q * 4, 150 + f.q * 30);
  if (f.q >= 4) fx.sparkle(S.hookX, hy, 12 + f.q * 3);
  fx.float(`+${gain}`, S.hookX, hy - 30, '#ffe9a8', 22);
  fx.float(`+${price}🪙`, S.hookX, hy - 6, '#ffd44e', 17);
  coinFly(5 + Math.min(9, f.q * 2));
  fx.shake(.2 + f.q * .03, 2 + f.q * .7);
  if (f.q >= 4) { fx.stop(.08); flashT = .3; }

  audio.sfx.catch(f.q);
  if (f.q === 6) {
    audio.sfx.legendary();
    ui.showBanner('传奇渔获！！', `${f.name} · ${QUALITIES[6].name}之鱼`, 2600);
  } else if (f.q >= 4) {
    ui.showBanner(`${f.name}！`, `${QUALITIES[f.q].name}级渔获 · +${gain}分`, 1800);
  } else {
    ui.showToast(`钓到了 ${f.name}（${QUALITIES[f.q].name}） +${gain}分`, 1800);
  }
  if (f.score > prevTop && prevTop > 0) ui.showBanner('新纪录单鱼分！', `${f.name} ${f.score} 分`, 1600);

  if (playT - lastProgressT > 3) { lastProgressT = playT; report('progress', { score, progress: r1(dexPct()) }); }
  if (f.q === 6) report('event', { tag: 'legendary', score });
}

function snapFish(f) {
  audio.sfx.snap();
  ui.showToast(`断线脱钩！${f ? f.name + ' 跑掉了' : ''}`, 2200);
  ui.showBanner('脱钩了…', '张力过大，鱼线断裂', 1300);
  report('event', { tag: 'snap' });
}

// ==================== input ====================
const pressed = new Set(), down = new Set();
let virtualMove = 0, virtualHold = false, touchHold = false, touchSide = 0, reelBtnHold = false;

addEventListener('keydown', (e) => {
  if (e.isComposing || e.keyCode === 229) return;
  if (e.metaKey || e.altKey || e.ctrlKey) return;
  if (!e.repeat) { pressed.add(e.code); down.add(e.code); }
  if (e.code === 'Space' || e.code === 'Tab') e.preventDefault();
});
addEventListener('keyup', (e) => down.delete(e.code));
addEventListener('blur', () => { pressed.clear(); down.clear(); touchHold = false; touchSide = 0; reelBtnHold = false; });
document.addEventListener('visibilitychange', () => { pressed.clear(); down.clear(); });

function handleKeys() {
  for (const code of pressed) {
    if (code === 'KeyP') togglePause();
    else if (code === 'KeyM') toggleMute();
    else if (code === 'KeyB') openPanel(panel === 'dex' ? null : 'dex');
    else if (code === 'KeyU') openPanel(panel === 'shop' ? null : 'shop');
    else if (code === 'Escape') openPanel(null);
    else if (code === 'Enter') {
      if (mode === 'title') startGame();
      else if (stages.S.stage === 'result') stages.endResult();
    } else if (code === 'Space') {
      if (mode === 'play' && !paused && !panel) {
        if (stages.S.stage === 'cast') stages.startCast();
        else if (stages.S.stage === 'result') stages.endResult();
      }
    }
  }
  pressed.clear();
}
function gatherInput() {
  let move = 0;
  if (down.has('KeyA') || down.has('ArrowLeft')) move -= 1;
  if (down.has('KeyD') || down.has('ArrowRight')) move += 1;
  if (!move && touchSide) move = touchSide;
  if (virtualMove) move = virtualMove;
  const hold = down.has('Space') || touchHold || virtualHold || reelBtnHold;
  const rise = down.has('Space') || down.has('KeyS') || reelBtnHold;
  return { move, hold, rise };
}

function toLogicalX(cx) { return clamp((cx - viewOX) / viewScale, 0, W); }
cv.addEventListener('pointerdown', (e) => {
  if (panel || mode !== 'play') return;
  if (!AUTOTEST) audio.ensure();
  const S = stages.S;
  if (S.stage === 'cast') { stages.startCast(); return; }
  if (S.stage === 'result') { stages.endResult(); return; }
  if (S.stage === 'sink' || S.stage === 'reel') {
    touchHold = true;
    touchSide = toLogicalX(e.clientX) < W / 2 ? -1 : 1;
    if (cv.setPointerCapture) { try { cv.setPointerCapture(e.pointerId); } catch (err) { } }
  }
});
cv.addEventListener('pointermove', (e) => {
  if (!touchHold) return;
  touchSide = toLogicalX(e.clientX) < W / 2 ? -1 : 1;
});
const endTouch = () => { touchHold = false; touchSide = 0; };
cv.addEventListener('pointerup', endTouch);
cv.addEventListener('pointercancel', endTouch);

// ==================== update ====================
let lastHint = '';
function syncUI() {
  const S = stages.S;
  ui.setReelBtn(S.stage === 'sink');
  ui.setDepth(S.depth, LAYERS[layerOf(S.depth)].name);
  ui.showResult(S.stage === 'result');
  const h = HINTS[S.stage] || '';
  if (h !== lastHint) { lastHint = h; ui.hint(h); }
}
function camTarget() {
  const S = stages.S;
  if (S.stage === 'sink' || S.stage === 'reel' || S.stage === 'result' || S.stage === 'retract') {
    return clamp(SURFACE_Y + S.depth * PX_M - H * .42, 0, WORLD_H - H);
  }
  return 0;
}
function update(dt) {
  playT += dt;
  if (hitstop > 0) { hitstop -= dt; return; }
  stages.update(dt, gatherInput());
  syncUI();
  camY += (camTarget() - camY) * Math.min(1, dt * 6);
  updateSchools(dt);
  updateParts(dt);
  for (let i = floats.length - 1; i >= 0; i--) {
    const fl = floats[i];
    fl.life -= dt * 1.1; fl.y -= 34 * dt;
    if (fl.life <= 0) floats.splice(i, 1);
  }
  for (let i = coinfx.length - 1; i >= 0; i--) {
    const c = coinfx[i];
    c.t += dt;
    if (c.t >= c.dur) coinfx.splice(i, 1);
  }
  if (shakeT > 0) { shakeT -= dt; if (shakeT <= 0) shakeAmp = 0; }
  if (flashT > 0) flashT -= dt;
  const S = stages.S;
  audio.state((S.stage === 'reel' || (S.stage === 'sink' && S.depth > 30)) ? 'deep' : 'surface');
  audio.update();
}

function updateSchools(dt) {
  schoolTimer -= dt;
  if (schoolTimer <= 0 && schools.length < 6) {
    schoolTimer = 1.6 + Math.random() * 2.6;
    const camM = camY / PX_M;
    const dM = clamp(camM + (Math.random() * 160 - 80), 4, 356);
    const dir = Math.random() < .5 ? -1 : 1;
    schools.push({
      x: dir > 0 ? -100 : W + 100, yM: dM, dir,
      spd: 26 + Math.random() * 44, n: 3 + (Math.random() * 5 | 0),
      size: 7 + Math.random() * 7, ph: Math.random() * 6.3,
      col: LAYERS[layerOf(dM)].top,
    });
  }
  for (let i = schools.length - 1; i >= 0; i--) {
    const s = schools[i];
    s.x += s.spd * s.dir * dt;
    if ((s.dir > 0 && s.x > W + 140) || (s.dir < 0 && s.x < -140)) schools.splice(i, 1);
  }
}
function updateParts(dt) {
  bubbleAcc -= dt;
  const S = stages.S;
  if (bubbleAcc <= 0) {
    bubbleAcc = .3;
    if (S.stage === 'sink' || S.stage === 'reel') {
      parts.push({ type: 'bubble', x: S.hookX + (Math.random() * 14 - 7), y: SURFACE_Y + S.depth * PX_M, r: 1.5 + Math.random() * 2.5, life: 3, max: 3 });
    }
  }
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.life -= dt;
    if (p.type === 'bubble') {
      p.y -= (46 + p.r * 8) * dt; p.x += Math.sin(p.life * 7) * 10 * dt;
      if (p.y < SURFACE_Y + 4) p.life = 0;
    } else if (p.type === 'ring') {
      p.r += p.vr * dt;
    } else if (p.type === 'spark') {
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 60 * dt;
    } else {
      p.vy += (p.grav || 0) * dt; p.x += p.vx * dt; p.y += p.vy * dt;
    }
    if (p.life <= 0) parts.splice(i, 1);
  }
  if (parts.length > 420) parts.splice(0, parts.length - 420);
}

// ==================== render ====================
const SKY_KEYS = [
  { t: 0.00, top: [38, 53, 94], mid: [94, 110, 158], bot: [232, 146, 106], dark: .5 },
  { t: 0.16, top: [111, 188, 232], mid: [159, 216, 242], bot: [223, 242, 250], dark: 0 },
  { t: 0.46, top: [111, 188, 232], mid: [165, 220, 244], bot: [226, 244, 252], dark: 0 },
  { t: 0.60, top: [74, 60, 120], mid: [138, 92, 142], bot: [242, 160, 92], dark: .35 },
  { t: 0.72, top: [16, 26, 48], mid: [28, 44, 80], bot: [44, 62, 96], dark: .85 },
  { t: 0.90, top: [16, 26, 48], mid: [28, 44, 80], bot: [44, 62, 96], dark: .85 },
  { t: 1.00, top: [38, 53, 94], mid: [94, 110, 158], bot: [232, 146, 106], dark: .5 },
];
function skyAt(cy) {
  let a = SKY_KEYS[0], b = SKY_KEYS[SKY_KEYS.length - 1];
  for (let i = 0; i < SKY_KEYS.length - 1; i++) {
    if (cy >= SKY_KEYS[i].t && cy <= SKY_KEYS[i + 1].t) { a = SKY_KEYS[i]; b = SKY_KEYS[i + 1]; break; }
  }
  const k = (cy - a.t) / Math.max(1e-6, b.t - a.t);
  const ch = (u, v) => Math.round(u + (v - u) * k);
  const rgb = (key) => `rgb(${ch(a[key][0], b[key][0])},${ch(a[key][1], b[key][1])},${ch(a[key][2], b[key][2])})`;
  return { top: rgb('top'), mid: rgb('mid'), bot: rgb('bot'), dark: a.dark + (b.dark - a.dark) * k };
}

function drawSky() {
  if (camY >= SURFACE_Y) return;
  const cyc = (playT / 180 + .35) % 1;
  const pal = skyAt(cyc);
  const g = ctx.createLinearGradient(0, SURFACE_Y - 430, 0, SURFACE_Y);
  g.addColorStop(0, pal.top); g.addColorStop(.55, pal.mid); g.addColorStop(1, pal.bot);
  ctx.fillStyle = g;
  const y0 = Math.max(-40, camY - 40);
  ctx.fillRect(0, y0, W, SURFACE_Y - y0);
  if (pal.dark > .25) {
    ctx.fillStyle = `rgba(255,255,240,${Math.min(1, (pal.dark - .25) * 1.1)})`;
    for (const s of STARS) ctx.fillRect(s[0], s[1], 2, 2);
  }
  const sunT = cyc / .62;
  if (sunT >= 0 && sunT <= 1) {
    const sx = 70 + sunT * 400, sy = 200 - Math.sin(sunT * Math.PI) * 150;
    const sg = ctx.createRadialGradient(sx, sy, 4, sx, sy, 34);
    sg.addColorStop(0, 'rgba(255,244,200,.95)'); sg.addColorStop(.35, 'rgba(255,214,120,.55)'); sg.addColorStop(1, 'rgba(255,214,120,0)');
    ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(sx, sy, 34, 0, 7); ctx.fill();
  }
  const moonT = (cyc - .62) / .38;
  if (moonT >= 0 && moonT <= 1) {
    const mx = 70 + moonT * 400, my = 190 - Math.sin(moonT * Math.PI) * 130;
    ctx.fillStyle = 'rgba(230,240,255,.9)';
    ctx.beginPath(); ctx.arc(mx, my, 16, 0, 7); ctx.fill();
    ctx.fillStyle = pal.mid;
    ctx.beginPath(); ctx.arc(mx - 6, my - 4, 13, 0, 7); ctx.fill();
  }
  for (let i = 0; i < 3; i++) {
    const cx = ((playT * (8 + i * 3) + i * 240) % (W + 200)) - 100;
    const cy = 66 + i * 44;
    ctx.fillStyle = `rgba(255,255,255,${.4 * (1 - pal.dark)})`;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 44, 13, 0, 0, 7);
    ctx.ellipse(cx + 26, cy - 6, 30, 11, 0, 0, 7);
    ctx.ellipse(cx - 28, cy + 2, 26, 9, 0, 0, 7);
    ctx.fill();
  }
}
function drawGodRays() {
  const a = Math.max(0, 1 - (camY / PX_M) / 70) * .14;
  if (a <= .012) return;
  for (let i = 0; i < 4; i++) {
    const x = 60 + i * 130 + Math.sin(playT * .5 + i) * 18;
    ctx.fillStyle = `rgba(255,252,225,${a})`;
    ctx.beginPath();
    ctx.moveTo(x, SURFACE_Y);
    ctx.lineTo(x + 34, SURFACE_Y);
    ctx.lineTo(x + 92, SURFACE_Y + 620);
    ctx.lineTo(x + 22, SURFACE_Y + 620);
    ctx.closePath(); ctx.fill();
  }
}
function drawSurface() {
  const bob = Math.sin(playT * 1.2) * 4 + Math.sin(playT * 2.3) * 1.6;
  ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 2;
  ctx.beginPath();
  for (let x = 0; x <= W; x += 12) {
    const y = SURFACE_Y + Math.sin(x * .04 + playT * 2) * 3;
    if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.strokeStyle = 'rgba(230,250,255,.22)';
  ctx.beginPath();
  for (let x = 0; x <= W; x += 12) {
    const y = SURFACE_Y + 8 + Math.sin(x * .05 - playT * 1.6) * 3;
    if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();
  // boat + fisher
  const bx = 258, by = SURFACE_Y + bob;
  ctx.save();
  ctx.translate(bx, by);
  ctx.fillStyle = '#5c3d1c';
  ctx.beginPath();
  ctx.moveTo(-44, -8); ctx.quadraticCurveTo(0, 12, 46, -8);
  ctx.lineTo(38, -20); ctx.lineTo(-40, -20); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#7c5628';
  ctx.fillRect(-40, -24, 80, 6);
  ctx.fillStyle = '#2c2418';
  ctx.fillRect(2, -46, 10, 24);
  ctx.beginPath(); ctx.arc(7, -50, 6, 0, 7); ctx.fill();
  ctx.strokeStyle = '#2c2418'; ctx.lineWidth = 2.4;
  ctx.beginPath(); ctx.moveTo(10, -40); ctx.lineTo(32, -58); ctx.stroke();
  ctx.restore();
}
function drawSchools() {
  for (const s of schools) {
    const y0 = SURFACE_Y + s.yM * PX_M;
    ctx.fillStyle = s.col;
    ctx.globalAlpha = .4;
    for (let i = 0; i < s.n; i++) {
      const fx0 = s.x - s.dir * i * s.size * 2.4;
      const fy = y0 + Math.sin(stages.S.t * 2 + i * 1.3 + s.ph) * 9;
      ctx.beginPath();
      ctx.ellipse(fx0, fy, s.size, s.size * .42, 0, 0, 7); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(fx0 - s.dir * s.size, fy);
      ctx.lineTo(fx0 - s.dir * (s.size + 6), fy - 4);
      ctx.lineTo(fx0 - s.dir * (s.size + 6), fy + 4);
      ctx.closePath(); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}
function drawParts() {
  for (const p of parts) {
    if (p.type === 'bubble') {
      ctx.strokeStyle = `rgba(220,240,255,${.5 * Math.max(0, p.life / p.max)})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.stroke();
    } else if (p.type === 'ring') {
      ctx.strokeStyle = p.color;
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.stroke();
      ctx.globalAlpha = 1;
    } else if (p.type === 'spark') {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size, p.y - .8, p.size * 2, 1.6);
      ctx.fillRect(p.x - .8, p.y - p.size, 1.6, p.size * 2);
      ctx.globalAlpha = 1;
    } else {
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life / p.max));
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, 7); ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
}
function drawFloats() {
  ctx.textAlign = 'center';
  for (const fl of floats) {
    ctx.globalAlpha = Math.min(1, fl.life * 1.6);
    ctx.font = `700 ${fl.size}px "Microsoft YaHei",sans-serif`;
    ctx.fillStyle = fl.color;
    ctx.strokeStyle = 'rgba(10,30,45,.7)'; ctx.lineWidth = 3;
    ctx.strokeText(fl.text, fl.x, fl.y); ctx.fillText(fl.text, fl.x, fl.y);
  }
  ctx.globalAlpha = 1;
}
function drawGauge() {
  const gx = 502, gy = 130, gw = 20, gh = 760;
  ctx.save();
  ctx.fillStyle = 'rgba(8,18,30,.55)';
  ctx.strokeStyle = 'rgba(255,214,140,.3)'; ctx.lineWidth = 1.5;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(gx - 6, gy - 6, gw + 12, gh + 12, 8); else ctx.rect(gx - 6, gy - 6, gw + 12, gh + 12);
  ctx.fill(); ctx.stroke();
  for (let l = 0; l < 6; l++) {
    const L = LAYERS[l];
    const y0 = gy + L.range[0] / 360 * gh, y1 = gy + L.range[1] / 360 * gh;
    ctx.globalAlpha = .85;
    ctx.fillStyle = L.bot;
    ctx.fillRect(gx, y0, gw, y1 - y0);
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(255,240,210,.85)';
  ctx.font = '9px "Microsoft YaHei",sans-serif';
  ctx.textAlign = 'right';
  for (const d of [0, 15, 40, 80, 140, 220, 360]) {
    const y = gy + d / 360 * gh;
    ctx.fillText(String(d), gx - 8, y + 3);
  }
  const my = gy + clamp(stages.S.depth, 0, 360) / 360 * gh;
  ctx.fillStyle = '#ffd44e';
  ctx.fillRect(gx - 4, my - 1.5, gw + 8, 3);
  ctx.beginPath();
  ctx.moveTo(gx + gw + 4, my); ctx.lineTo(gx + gw + 12, my - 5); ctx.lineTo(gx + gw + 12, my + 5);
  ctx.closePath(); ctx.fill();
  ctx.restore();
}
function drawCoinFx() {
  for (const c of coinfx) {
    if (c.t < 0) continue;
    const k = Math.min(1, c.t / c.dur);
    const x = 250 + (36 - 250) * k;
    const y = 460 + (60 - 460) * k - Math.sin(k * Math.PI) * 130;
    ctx.fillStyle = '#ffd44e';
    ctx.beginPath(); ctx.arc(x, y, 7, 0, 7); ctx.fill();
    ctx.strokeStyle = '#a8721c'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x, y, 4.5, 0, 7); ctx.stroke();
  }
}

function render() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.clearRect(0, 0, cv.width, cv.height);
  ctx.save();
  ctx.translate(viewOX, viewOY); ctx.scale(viewScale, viewScale);
  if (shakeT > 0) {
    const k = shakeAmp * Math.min(1, shakeT * 5);
    ctx.translate((Math.random() * 2 - 1) * k, (Math.random() * 2 - 1) * k);
  }
  ctx.save();
  ctx.translate(0, -camY);
  drawSky();
  ctx.drawImage(bgStrip, 0, 0, W, WORLD_H);
  drawGodRays();
  drawSurface();
  drawSchools();
  stages.renderWorld(ctx, camY);
  drawParts();
  drawFloats();
  ctx.restore();
  drawGauge();
  stages.renderCastBar(ctx);
  stages.renderReelBar(ctx);
  drawCoinFx();
  if (flashT > 0) {
    ctx.fillStyle = `rgba(255,240,200,${flashT * .8})`;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.restore();
}

// ==================== main loop ====================
let last = performance.now(), acc = 0;
function tick(now) {
  requestAnimationFrame(tick);
  let dt = (now - last) / 1000; last = now;
  if (document.hidden) return;
  dt = Math.min(dt, 1 / 30);
  if (mode === 'play' && !paused && !panel) {
    acc += dt;
    while (acc >= 1 / 60) { update(1 / 60); acc -= 1 / 60; }
  } else {
    audio.update();
  }
  render();
}
requestAnimationFrame(tick);

// ==================== G debug hooks ====================
function genRockVerts(r) {
  const verts = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    verts.push([Math.cos(a) * r * (.72 + Math.random() * .42), Math.sin(a) * r * (.62 + Math.random() * .4)]);
  }
  return verts;
}

const G = {
  err: window.__BOOTERR,
  W, H, SURFACE_Y, PX_M,
  step: (n = 60, dt = 1 / 60) => { for (let i = 0; i < n; i++) { handleKeys(); if (mode === 'play' && !paused && !panel) update(dt); render(); } },
  upd: (n = 30, dt = 1 / 60) => { for (let i = 0; i < n; i++) { handleKeys(); if (mode === 'play' && !paused && !panel) update(dt); } },
  press: (...codes) => codes.forEach(c => pressed.add(c)),
  setNoAuto: (v) => { noAuto = !!v; },
  setReportTarget: (fn) => { reportTarget = fn; },
  setScore: (v) => { score = v | 0; ui.setScore(score); lastProgressT = -99; },
  setCoins: (v) => { save.coins = v | 0; ui.setCoins(save.coins); },
  state: () => {
    const snap = stages.snapshot();
    return {
      mode, paused, panel,
      score, coins: save.coins, upgrades: save.upg.slice(),
      dexCount: Object.keys(save.dex).length,
      dexPct: +dexPct().toFixed(2),
      bestTop: best.top, bestDex: +best.dex.toFixed(2),
      ...snap,
    };
  },
  fx: () => ({ parts: parts.length, floats: floats.length, coins: coinfx.length, schools: schools.length, hitstop: +hitstop.toFixed(3), shakeT: +shakeT.toFixed(3), flashT: +flashT.toFixed(3) }),
  // gameplay-specific hooks
  cast: (power) => stages.startCast(power == null ? null : clamp(+power || 0, 0, 1)),
  castPowerAt,
  hookMove: (d) => { virtualMove = clamp(d | 0, -1, 1); },
  reel: (h) => { virtualHold = !!h; },
  forceBite: (q) => stages.doBite(q == null ? null : +q),
  setDepthStage: (n) => stages.setDepthStage(n),
  buyUpgrade: (n) => buyUpgrade(n | 0),
  setTension: (v) => { stages.S.tension = clamp(+v || 0, 0, 100); },
  setPhase: (p) => stages.setPhase(p),
  abortReel: () => stages.abortReel(),
  continueResult: () => { if (stages.S.stage === 'result') stages.endResult(); },
  clearObstacles: () => { stages.S.rocks.length = 0; stages.S.jellies.length = 0; },
  spawnRock: (x, yM, r = 28) => stages.S.rocks.push({ x: +x, yM: +yM, r: +r, verts: genRockVerts(+r) }),
  spawnJelly: (x, yM, r = 15) => stages.S.jellies.push({ x: +x, yM: +yM, r: +r, ph: 0, cool: 0 }),
  weights: (layer, rarityLvl) => poolWeights(layer, rarityLvl),
  forceCatch: (layer, q, w) => {
    const f = fishOf(clamp(layer | 0, 0, 5), clamp(q | 0, 0, 6));
    catchFish(f, w != null ? +w : weightFor(f, rng));
  },
  FISH, QUALITIES, LAYERS, TEMPO, MILESTONES, UPGRADES,
  reports, save, best,
  stages, audio, ui,
  hasSprites: () => spritesReady,
  reloadPersistence,
  startGame, toTitle, openPanel,
};
window.__G = G;
window.addEventListener('error', e => { if (G.err) G.err.push(String(e.message || e)); });

// ==================== autotest suite ====================
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
    const SS = () => stages.S;
    audio.setMuted(true);
    G.setNoAuto(true);
    const savedBestStr = localStorage.getItem('dcs.best');
    const savedSaveStr = localStorage.getItem('dcs.save');
    const savedMuteStr = localStorage.getItem('dcs.mute');
    // clean slate for deterministic asserts across consecutive runs
    try {
      localStorage.setItem('dcs.save', JSON.stringify({ coins: 0, upg: [0, 0, 0, 0], dex: {}, ms: [false, false, false, false, false] }));
      localStorage.setItem('dcs.best', JSON.stringify({ top: 0, dex: 0 }));
    } catch (e) { }
    reloadPersistence();
    muted = true; audio.setMuted(true); ui.setMutedIcon(true);
    try { localStorage.setItem('dcs.mute', '1'); } catch (e) { }
    const frames = [];
    G.setReportTarget(f => frames.push(f));
    const restorePersist = () => {
      try {
        if (savedBestStr === null) localStorage.removeItem('dcs.best'); else localStorage.setItem('dcs.best', savedBestStr);
        if (savedSaveStr === null) localStorage.removeItem('dcs.save'); else localStorage.setItem('dcs.save', savedSaveStr);
        if (savedMuteStr === null) localStorage.removeItem('dcs.mute'); else localStorage.setItem('dcs.mute', savedMuteStr);
      } catch (e) { }
      reloadPersistence();
    };
    // realistic reel-out: hold while calm, release while struggling
    const reelOut = (maxFrames = 4200) => {
      let fr = 0;
      while (S().stage === 'reel' && fr < maxFrames) {
        G.reel(S().phase !== 'struggle');
        G.upd(3);
        fr += 3;
      }
      G.reel(false);
    };
    const catchOne = async (layer, q) => {
      G.setDepthStage(layer);
      G.clearObstacles();
      G.forceBite(q);
      await nap();
      reelOut();
      return S();
    };
    const numOk = (...vals) => vals.every(v => typeof v === 'number' && isFinite(v));

    await nap();
    assert(1, G.err.length === 0 && (window.__BOOTERR || []).length === 0, '启动零报错');
    assert(2, G.hasSprites() === true && G.FISH.length === 42, '42 张鱼精灵已预渲染');

    // -- T3: fish data completeness (6 layers × 7 qualities, names/scores/prices)
    let dataOk = G.FISH.length === 42;
    for (let l = 0; l < 6; l++) {
      const qs = G.FISH.filter(f => f.layer === l).map(f => f.q);
      if (qs.length !== 7 || qs.join(',') !== '0,1,2,3,4,5,6') dataOk = false;
    }
    for (const f of G.FISH) {
      if (!f.name || f.name.length < 2 || f.score <= 0 || f.price <= 0) dataOk = false;
      if (!(f.wMin > 0 && f.wMax >= f.wMin)) dataOk = false;
      if (!['slim', 'std', 'tall', 'round', 'flat', 'long', 'sword'].includes(f.shape)) dataOk = false;
      if (!f.hue || !f.hue2 || !f.belly) dataOk = false;
      if (f.q === 6 && !f.extras.crown) dataOk = false;   // each layer's legend fish is crowned
    }
    assert(3, dataOk, '42 鱼数据完整（6 层 × 7 品质各就位）');
    let inc = true;
    for (let i = 1; i < G.QUALITIES.length; i++) if (G.QUALITIES[i].score <= G.QUALITIES[i - 1].score) inc = false;
    assert(4, inc && G.QUALITIES.length === 7 && G.QUALITIES[6].score === 2600, '品质分数表 7 级严格递增');

    // -- T5/T6: cast power math — stopping in the center zone = max depth tier
    assert(5, G.castPowerAt(50) === 1 && G.castPowerAt(0) === 0 && G.castPowerAt(25) === .5, '蓄力条数学（中区=1.0，边缘=0）');
    startGame();
    G.cast(1); G.upd(35);
    assert(6, S().cap === 360 && S().stage === 'sink' && S().depth > 0, '停中区=最大深度档（cap 360m 深渊）');
    G.cast(0); G.upd(35);
    assert(7, S().cap === 15, '边缘停针=最浅档（15m）');
    G.cast(.5); G.upd(35);
    const capMid = S().cap;
    assert(8, capMid > 180 && capMid < 195, '半程蓄力=中间深度档');

    // -- T9: sink steering + depth cap hover
    G.clearObstacles();
    const x0 = SS().hookX;
    G.hookMove(1); G.upd(12);
    assert(9, SS().hookX > x0 + 5, 'hookMove(1) 鱼钩右移');
    G.hookMove(-1); G.upd(20);
    const xMin = SS().hookX;
    assert(10, SS().hookX < x0 - 2, 'hookMove(-1) 鱼钩左移');
    G.hookMove(0); G.upd(1);
    G.cast(0); G.upd(300); G.clearObstacles();
    assert(11, S().depth <= 15.01 && S().stage === 'sink', '深度不超过抛竿档位上限（hover 在 15m）');
    const dBefore = S().depth;
    G.upd(30);
    assert(12, Math.abs(S().depth - dBefore) < 6, '到档后悬停等待咬钩');

    // -- T13: rock collision retracts the line
    G.clearObstacles(); G.setDepthStage(2); G.clearObstacles();
    G.spawnRock(SS().hookX, SS().depth + .5, 30);
    G.upd(10);
    assert(13, S().stage === 'retract' && S().retractReason === 'rock', '碰礁=收线收回');
    G.upd(90);
    assert(14, S().stage === 'cast' && S().fishId === null, '碰礁后回到抛竿且无渔获');

    // -- T14: jellyfish stun 0.8s blocks steering
    G.clearObstacles(); G.setDepthStage(2); G.clearObstacles();
    G.spawnJelly(SS().hookX + 2, SS().depth + .4, 16);
    G.upd(8);
    assert(15, S().stunT > .6 && S().stunT <= .8, '水母触发 0.8s 眩晕');
    const sx = SS().hookX;
    G.hookMove(1); G.upd(12);
    assert(16, Math.abs(SS().hookX - sx) < 1, '眩晕期间不能移动');
    G.upd(60);
    assert(17, S().stunT <= 0, '眩晕随时间恢复');
    G.hookMove(0); G.abortReel();

    // -- T18: bite pool is strictly the current layer (shallow never yields abyss fish)
    let poolOk = true;
    for (const l of [0, 2, 5]) {
      for (let i = 0; i < 4; i++) {
        G.setDepthStage(l);            // re-place the hook each bite (abortReel resets depth)
        G.forceBite();
        if (S().layer !== l || !S().fishId) poolOk = false;
        const fish = G.FISH.find(ff => ff.id === S().fishId);
        if (!fish || fish.layer !== l) poolOk = false;
        G.abortReel();
      }
    }
    assert(18, poolOk, '咬钩鱼严格属于当前深度层（浅层不出深渊鱼）');

    // -- T19: rarity upgrade shifts weights toward rare tiers
    const w0 = G.weights(0, 0), w4 = G.weights(0, 4);
    assert(19, w4[5] > w0[5] && w4[6] > w0[6] && w4[0] < w0[0] && w0.every(v => v > 0), '稀有度升级提升稀有/神话权重');

    // -- T20/T21: reel QTE math — calm: holding reels, tension drops
    G.setDepthStage(0); G.clearObstacles();
    G.forceBite(0);
    assert(20, S().stage === 'reel' && S().fishQ === 0 && S().tension === 26, 'forceBite 进入拉杆（初始张力 26）');
    G.setPhase('calm');
    const p0 = S().progress, t0 = S().tension;
    G.reel(true); G.upd(30);
    assert(21, S().progress > p0 + 5 && S().tension < t0, '平稳期按住：收线进度涨、张力降');
    // -- T22: struggle: holding spikes tension, releasing recovers
    G.setPhase('struggle');
    const t1 = S().tension;
    G.upd(1);
    G.reel(true); G.upd(30);
    const t2 = S().tension;
    assert(22, t2 > t1 + 10, '挣扎期按住：张力快速上升');
    G.reel(false); G.upd(30);
    assert(23, S().tension < t2, '挣扎期松手：张力回落');

    // -- T24: 3 bursts = line snap + snap event frame
    // (each burst sets 70ms hit-stop; 14 frames per step leave ~9.8 active frames,
    //  enough for tension to cross 100 again; total active 0.56s < 0.7s struggle phase)
    G.setPhase('struggle'); G.reel(true);
    for (let i = 0; i < 3; i++) { G.setTension(97); G.upd(14); }
    assert(24, S().bursts === 3 && S().stage === 'retract' && S().retractReason === 'snap', '张力满 3 次→断线脱钩');
    assert(25, frames.some(f => f.kind === 'event' && f.tag === 'snap'), '断线脱钩上报 event{tag:snap}');
    G.upd(90);
    assert(26, S().stage === 'cast', '脱钩后回到抛竿');

    // -- T27/T28: catching scores & pays exactly by quality table
    G.setCoins(0); G.setScore(0);
    let st = await catchOne(0, 0);
    const f0 = G.FISH[0];
    assert(27, st.stage === 'result' && st.score === f0.score, '捕获计分=品质分表');
    assert(28, S().coins === f0.price && !!save.dex[f0.id], '卖价入金币 + 图鉴收录体重');
    st = await catchOne(0, 1);
    const f1 = G.FISH[1];
    assert(29, S().coins === f0.price + f1.price, '金币按品质卖价累计');
    assert(30, S().dexCount === 2 && Math.abs(S().dexPct - 2 / 42 * 100) < .06, '收集度% 与图鉴条目一致');

    // -- T31: dex milestone grants coins once at 10%
    G.setCoins(0);
    await catchOne(0, 2);
    await catchOne(0, 3);
    const c3 = S().coins;
    await catchOne(0, 4);            // 5 distinct → 11.9% ≥ 10%
    const c4 = S().coins;
    assert(31, c4 === c3 + G.QUALITIES[4].price + G.MILESTONES[0].coins && save.ms[0] === true, '收集度≥10% 里程碑发放金币');
    await catchOne(0, 2);
    assert(32, S().coins === c4 + G.QUALITIES[2].price, '重复渔获不重复发里程碑');

    // -- T33: upgrade purchase deducts coins and takes effect
    G.setCoins(99999);
    const spd0 = stages.sinkSpeed(), tol0 = stages.tolFactor();
    assert(33, G.buyUpgrade(0) === true && S().coins === 99999 - UPGRADES[0].costs[0] && stages.sinkSpeed() === spd0 + 14, '下沉速度升级扣款并生效');
    G.buyUpgrade(1);
    assert(34, stages.tolFactor() < tol0, '张力容错降低张力增速');
    G.buyUpgrade(2);
    assert(35, stages.rarityLvl() === 1, '稀有运气等级生效');
    G.setCoins(9999);
    while (G.buyUpgrade(3)) { }
    assert(36, stages.magnetPow() === 90, '磁力吸附可升至满级 3');
    G.setCoins(1);
    assert(37, G.buyUpgrade(1) === false && S().coins === 1, '金币不足拒绝升级');

    // -- T38: magnet auto-dodge pushes the hook away from a rock
    G.clearObstacles(); G.setDepthStage(2); G.clearObstacles();
    G.spawnRock(SS().hookX + 40, SS().depth, 26);
    const mx0 = SS().hookX;
    G.upd(40);
    assert(38, SS().hookX < mx0 - 2, '磁力吸附自动小幅纠偏远离障碍');

    // -- T39: legendary fish real catch → legendary event + best.top
    G.setScore(0);
    G.clearObstacles(); G.setDepthStage(3); G.clearObstacles();
    G.forceBite(6);
    assert(39, S().fishQ === 6 && S().tempoSpecial === true, '传奇鱼入场（快-慢交替特殊节奏）');
    await nap();
    reelOut();
    st = S();
    assert(40, st.stage === 'result' && st.score === G.QUALITIES[6].score, '传奇鱼捕获计分');
    assert(41, frames.some(f => f.kind === 'event' && f.tag === 'legendary'), '传奇鱼上报 event{tag:legendary}');

    // -- T42: best persistence — writes, never lowered by smaller catch
    const bestNow = JSON.parse(localStorage.getItem('dcs.best') || '{}');
    assert(42, bestNow.top === G.QUALITIES[6].score && S().bestTop === G.QUALITIES[6].score, '最高单鱼分写入 localStorage');
    localStorage.setItem('dcs.best', JSON.stringify({ top: 99999, dex: 0 }));
    reloadPersistence();
    await catchOne(0, 0);
    assert(43, S().bestTop === 99999, '低分渔获不会拉低最高纪录');

    // -- T44: protocol frame order
    assert(44, G.reports[0] && G.reports[0].kind === 'ready', 'ready 上报帧为首帧');
    assert(45, frames.some(f => f.kind === 'progress' && typeof f.score === 'number' && typeof f.progress === 'number'), 'progress 帧含 score/progress(收集度)');
    assert(46, !frames.some(f => f.kind === 'gameOver') && !G.reports.some(f => f.kind === 'gameOver'), '休闲玩法无 gameOver 帧');

    // -- T47: dex panel open/close, 42 cells, collected highlighted
    G.openPanel('dex');
    assert(47, !ui.el.dexpanel.classList.contains('hide') && document.querySelectorAll('#dexgrid .fcell').length === 42, '图鉴面板打开且 42 格');
    assert(48, document.querySelectorAll('#dexgrid .fcell.got').length === S().dexCount, '已收集格高亮数量一致');
    G.openPanel(null);
    assert(49, ui.el.dexpanel.classList.contains('hide'), '图鉴面板关闭');

    // -- T50: shop panel open/close with 4 upgrade rows
    G.openPanel('shop');
    assert(50, !ui.el.shoppanel.classList.contains('hide') && document.querySelectorAll('#shoprows .srow').length === 4, '商店面板打开且 4 条升级');
    G.openPanel(null);
    assert(51, ui.el.shoppanel.classList.contains('hide'), '商店面板关闭');

    // -- T52: mute toggle persists
    ui.el.mutebtn.click();
    assert(52, audio.isMuted() === false && localStorage.getItem('dcs.mute') === '0', '静音按钮切换并持久化');
    ui.el.mutebtn.click();
    assert(53, audio.isMuted() === true && localStorage.getItem('dcs.mute') === '1', '再次切换恢复静音');

    // -- T54: pause freezes the simulation
    G.clearObstacles(); G.setDepthStage(1); G.clearObstacles();
    SS().cap = 360;                  // let the hook keep sinking for the freeze check
    G.upd(20);
    const d0 = S().depth;
    G.press('KeyP'); G.upd(30);
    assert(54, S().paused === true && Math.abs(S().depth - d0) < .001, '暂停冻结模拟');
    G.press('KeyP'); G.upd(30);
    assert(55, !S().paused && S().depth > d0, '恢复后继续下潜');

    // -- T56/T57: audio ctx stays null during autotest until ensure()
    assert(56, audio.hasCtx() === false, 'AUTOTEST 模式保持无 AudioContext');
    audio.ensure();
    assert(57, audio.hasCtx() === true && audio.state('deep') === 'deep' && audio.isMuted() === true, 'AudioContext 可创建/状态切换/保持静音');
    audio.state('surface');

    // -- T58: touch/UI elements exist; reel button only during sink
    assert(58, !!ui.el.reelbtn && !!ui.el.mutebtn && !!ui.el.pausebtn && !!ui.el.dexbtn && !!ui.el.shopbtn && !!ui.el.start && !!ui.el.resbtn, '触屏与 UI 元素存在');
    G.clearObstacles(); G.setDepthStage(0); G.clearObstacles();
    G.upd(2);
    assert(59, ui.el.reelbtn.style.display !== 'none', '下沉阶段显示收杆按钮');
    G.abortReel(); G.upd(2);
    assert(60, ui.el.reelbtn.style.display === 'none', '非下沉阶段隐藏收杆按钮');

    // -- T61: 3 full fishing loops fast-forwarded, no NaN / no new errors
    const errBefore = G.err.length;
    let loopsOk = true;
    for (let k = 0; k < 3; k++) {
      startGame();
      G.cast(.8);
      G.upd(35);
      G.clearObstacles();
      G.upd(15);
      G.forceBite(1);
      await nap();
      reelOut();
      const s2 = S();
      if (s2.stage !== 'result' || !numOk(s2.depth, s2.hookX, s2.tension, s2.progress, s2.castPos)) loopsOk = false;
      G.continueResult();
    }
    assert(61, loopsOk && G.err.length === errBefore, '完整钓鱼循环快进 3 次无异常');

    // -- T62: NaN sweep over state + fx counters, then back to dock via Enter
    G.upd(240);
    const s3 = S(), f3 = G.fx();
    assert(62, numOk(s3.depth, s3.hookX, s3.tension, s3.progress, s3.castPos, s3.biteT, f3.parts, f3.floats, f3.coins, f3.schools), '长跑后数值无 NaN');
    toTitle();
    assert(63, S().mode === 'title' && !ui.el.title.classList.contains('hide') && S().stage === 'dock', '回码头(标题)界面');
    G.press('Enter'); G.upd(2);
    assert(64, S().mode === 'play', 'Enter 输入模拟开始游戏生效');
    toTitle();
    assert(65, S().mode === 'title' && !ui.el.title.classList.contains('hide'), '测完回到码头界面');

    // -- T66: restore the player's real save & records (first pass)
    restorePersist();
    assert(66, localStorage.getItem('dcs.best') === savedBestStr && localStorage.getItem('dcs.save') === savedSaveStr, 'best/存档恢复原值');

    G.setNoAuto(false);

    // final belt-and-suspenders restore (per convention: restore again at the very end)
    restorePersist();
    muted = true; audio.setMuted(true); ui.setMutedIcon(true);   // suite must leave the page silent
    try { if (savedMuteStr === null) localStorage.removeItem('dcs.mute'); else localStorage.setItem('dcs.mute', savedMuteStr); } catch (e) { }

    const pass = results.filter(r => r.ok).length;
    window.__TEST = { pass, fail: results.length - pass, total: results.length, results, done: true };
    console.log(`[autotest] ${pass}/${results.length} passed`);
  }
}

if (AUTOTEST) autotest();
