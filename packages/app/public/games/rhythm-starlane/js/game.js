// Rhythm Starlane 节奏星轨 — 4 键下落式音乐节奏游戏。
// guizang-game-skill 方法论第三批 #3。结构对齐标杆 orchard-fusion：
// 固定步长 rAF 循环 + accumulator、G 调试钩子、?autotest=1 套件、站点上报桥、
// WebAudio 全合成音频（无 ctx 时静默空转，autotest 全程不建 ctx）。

import { SONGS, DIFFS, LEADIN, buildChart, buildMusic } from './songs.js';
import { makePlay, judgeFor, comboBonus, accOf, gradeFor, GOOD_WIN } from './play.js';
import { makeAudio } from './audio.js';
import { makeUI } from './ui.js';

// ==================== 常量 / 版式 ====================
const W = 540, H = 840;
const LANES = 4, LANE_W = 96, FIELD_L = (W - LANES * LANE_W) / 2, FIELD_R = FIELD_L + LANES * LANE_W;
const JUDGE_Y = 690, SPAWN_Y = 36;
const LANE_COLORS = ['#35e0d2', '#ffc85c', '#a86cff', '#ff6ca8'];   // 青 / 金 / 紫 / 粉
const LANE_KEYS = { KeyD: 0, KeyF: 1, KeyJ: 2, KeyK: 3 };
const KEY_LABELS = ['D', 'F', 'J', 'K'];
const GRADE_COLORS = { S: '#ffd75c', A: '#35e0d2', B: '#a86cff', C: '#ff6ca8', D: '#8a93b8' };
const STEP = 1 / 60;

// ==================== 状态 ====================
let mode = 'select';                    // select | play | over
let paused = false, noAuto = false;
let muted = false;
try { muted = localStorage.getItem('rsl.mute') === '1'; } catch (e) { }
let selSong = 0, selDiff = 'N';
let songIdx = 0, diffId = 'N', chart = null, notes = null, length = 1, speed = 300, songSpb = .5;
let songTime = 0, playT = 0, missIdx = 0, nextMile = .1, resultsKind = '';
let shakeT = 0, shakeAmp = 0, flashT = 0, comboPop = 0;
const laneGlow = [0, 0, 0, 0], laneFlash = [0, 0, 0, 0];
const stars = Array.from({ length: 70 }, () => ({
  x: Math.random() * W, y: Math.random() * H, r: .6 + Math.random() * 1.8,
  sp: 14 + Math.random() * 46, tw: 2 + Math.random() * 4,
}));
const play = makePlay();
const audio = makeAudio();
const AUTOTEST = new URLSearchParams(location.search).has('autotest');

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

function rr(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}
function hexa(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`;
}

// 静态层离屏预渲染（午夜蓝底 + 星野 + 四轨面板 + 判定线 + 键帽）
const bgCv = document.createElement('canvas');
bgCv.width = W * 2; bgCv.height = H * 2;
{
  const c = bgCv.getContext('2d'); c.scale(2, 2);
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#0b1132'); g.addColorStop(.45, '#0a0e26'); g.addColorStop(1, '#05081a');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  const blobs = [[140, 180, '#a86cff'], [420, 320, '#35e0d2'], [300, 620, '#ff6ca8']];
  for (const [bx, by, col] of blobs) {
    const rg = c.createRadialGradient(bx, by, 10, bx, by, 230);
    rg.addColorStop(0, hexa(col, .10)); rg.addColorStop(1, hexa(col, 0));
    c.fillStyle = rg; c.fillRect(bx - 230, by - 230, 460, 460);
  }
  for (let i = 0; i < 60; i++) {
    c.fillStyle = `rgba(190,210,255,${.08 + Math.random() * .22})`;
    c.beginPath(); c.arc(Math.random() * W, Math.random() * H, .5 + Math.random() * 1.4, 0, 7); c.fill();
  }
  c.fillStyle = 'rgba(8,12,34,.62)';
  c.fillRect(FIELD_L, 30, LANES * LANE_W, JUDGE_Y + 46 - 30);
  for (let i = 0; i < 4; i++) {
    const lg = c.createLinearGradient(0, 30, 0, JUDGE_Y);
    lg.addColorStop(0, hexa(LANE_COLORS[i], .10)); lg.addColorStop(1, hexa(LANE_COLORS[i], .02));
    c.fillStyle = lg;
    c.fillRect(FIELD_L + i * LANE_W + 2, 30, LANE_W - 4, JUDGE_Y - 30);
  }
  c.strokeStyle = 'rgba(150,175,255,.16)'; c.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    c.beginPath(); c.moveTo(FIELD_L + i * LANE_W + .5, 30); c.lineTo(FIELD_L + i * LANE_W + .5, JUDGE_Y + 46); c.stroke();
  }
  c.strokeStyle = 'rgba(150,175,255,.25)';
  c.beginPath(); c.moveTo(FIELD_L, 30.5); c.lineTo(FIELD_R, 30.5); c.stroke();
  c.fillStyle = 'rgba(230,240,255,.14)';
  c.fillRect(FIELD_L, JUDGE_Y - 2, LANES * LANE_W, 4);
  for (let i = 0; i < 4; i++) {
    const x = FIELD_L + i * LANE_W;
    rr(c, x + 8, JUDGE_Y + 14, LANE_W - 16, 52, 10);
    c.fillStyle = 'rgba(255,255,255,.05)'; c.fill();
    c.strokeStyle = hexa(LANE_COLORS[i], .75); c.lineWidth = 1.5; c.stroke();
    c.fillStyle = hexa(LANE_COLORS[i], .9);
    c.font = '700 22px "Microsoft YaHei",sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(KEY_LABELS[i], x + LANE_W / 2, JUDGE_Y + 40);
  }
  c.fillStyle = 'rgba(140,160,220,.5)';
  c.font = '12px "Microsoft YaHei",sans-serif'; c.textAlign = 'center'; c.textBaseline = 'alphabetic';
  c.fillText('D F J K 四键 · 触屏四分区点按', W / 2, JUDGE_Y + 92);
}

// ==================== 粒子 / 飘字池 ====================
const P_MAX = 420;
const parts = Array.from({ length: P_MAX }, () => ({ alive: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, color: '#fff', size: 2, grav: 0 }));
let pHead = 0;
function spawnPart(x, y, vx, vy, life, color, size, grav = 0) {
  const p = parts[pHead]; pHead = (pHead + 1) % P_MAX;
  p.alive = true; p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.life = life; p.max = life; p.color = color; p.size = size; p.grav = grav;
}
function partsAlive() { let c = 0; for (const p of parts) if (p.alive) c++; return c; }

const F_MAX = 32;
const floats = Array.from({ length: F_MAX }, () => ({ alive: false, text: '', color: '#fff', size: 16, x: 0, y: 0, life: 0, max: 1 }));
let fHead = 0;
function spawnFloat(lane, text, color, size) {
  const f = floats[fHead]; fHead = (fHead + 1) % F_MAX;
  f.alive = true; f.text = text; f.color = color; f.size = size;
  f.x = FIELD_L + lane * LANE_W + LANE_W / 2;
  f.y = JUDGE_Y - 40 - Math.random() * 14;
  f.life = .7; f.max = .7;
}

// ==================== 上报桥 ====================
const reports = [];
let reportTarget = null;
function report(kind, payload = {}) {
  const frame = { kind, ...payload };
  reports.push(frame);
  try {
    if (reportTarget) reportTarget(frame);
    else if (window.parent !== window) window.parent.postMessage({ source: 'lightgame', type: 'lightgame:report', payload: frame }, '*');
  } catch (e) { }
}
report('ready', { game: 'rhythm-starlane' });

// ==================== best 存取（rsl. 前缀，每曲每难度） ====================
function bestKey(si, di) { return `rsl.best.${si}${di}`; }
function getBestRec(si, di) {
  try {
    const raw = localStorage.getItem(bestKey(si, di));
    if (!raw) return null;
    const o = JSON.parse(raw);
    if (!o || typeof o.s !== 'number' || typeof o.a !== 'number') return null;
    return o;
  } catch (e) { return null; }
}
function saveBest(si, di, s, a) {
  const cur = getBestRec(si, di) || { s: 0, a: 0 };
  if (s > cur.s || a > cur.a) {
    const rec = { s: Math.max(cur.s, s | 0), a: Math.max(cur.a, a) };
    try { localStorage.setItem(bestKey(si, di), JSON.stringify(rec)); } catch (e) { }
    return rec;
  }
  return cur;
}

// ==================== UI ====================
const ui = makeUI({
  onStart: () => { if (!AUTOTEST) audio.ensure(); audio.sfx.ui(); startSong(selSong, selDiff); },
  onPickSong: i => { selSong = i; ui.markSong(i); refreshSelBest(); audio.sfx.ui(); },
  onPickDiff: d => { selDiff = d; ui.markDiff(d); refreshSelBest(); audio.sfx.ui(); },
  onRestart: () => { audio.sfx.ui(); startSong(songIdx, diffId); },
  onBackSelect: () => { audio.sfx.ui(); toSelect(); },
  onMute: () => toggleMute(),
  onPause: () => { audio.sfx.ui(); togglePause(); },
  onQuit: () => { if (mode === 'play') finish('abort'); },
  onPad: l => { laneGlow[l] = 1; if (mode === 'play' && !paused) hitNote(l, 0); },
});
ui.markSong(selSong); ui.markDiff(selDiff);
ui.setMutedIcon(muted);
audio.setMuted(muted);
ui.showEnd(false);
ui.showSelect(true);
ui.padShow(false);
refreshSelBest();

function refreshSelBest() {
  const rec = getBestRec(selSong, selDiff);
  ui.setSelBest(rec
    ? `${SONGS[selSong].name} · ${selDiff} 难度最高分 ${rec.s} · 最高准确率 ${rec.a.toFixed(1)}%`
    : '暂无纪录 · 完成一曲创造纪录');
}

// ==================== 游戏流程 ====================
function startSong(si, di) {
  const diff = DIFFS.find(d => d.id === di) || DIFFS[1];
  songIdx = si; diffId = diff.id;
  chart = buildChart(si, DIFFS.indexOf(diff));
  notes = chart.notes;
  for (const n of notes) n.j = null;
  length = chart.length;
  speed = (JUDGE_Y - SPAWN_Y) / diff.fall;
  songSpb = chart.music.spb;
  songTime = 0; playT = 0; missIdx = 0; nextMile = .1; resultsKind = '';
  play.reset();
  laneGlow.fill(0); laneFlash.fill(0);
  shakeT = 0; shakeAmp = 0; flashT = 0; comboPop = 0;
  mode = 'play'; paused = false;
  ui.showSelect(false); ui.showEnd(false); ui.setPausedIcon(false); ui.padShow(true);
  ui.setScore(0); ui.setAcc(null); ui.setProgress(0);
  ui.setSongLabel(`${SONGS[si].name} · ${diff.name}${diff.id} · ${SONGS[si].bpm} BPM`);
  audio.playSong(chart.music, 0);
  ui.showBanner(SONGS[si].name, `${diff.name}难度 · ${diff.hint}`, 2000);
}

function finish(kind) {
  if (mode !== 'play' || !notes) return;
  resultsKind = kind; mode = 'over'; paused = false;
  const total = notes.length;
  const acc = accOf(play.perfect, play.good, total);
  const grade = gradeFor(acc);
  const prev = getBestRec(songIdx, diffId) || { s: 0, a: 0 };
  const rec = saveBest(songIdx, diffId, play.score, acc);
  ui.padShow(false);
  audio.stopSong();
  if (kind === 'complete') {
    audio.sfx.complete(); flashT = .35;
    ui.setProgress(1);
    report('complete', { score: play.score, acc: +acc.toFixed(2), grade, progress: 1 });
  } else {
    audio.sfx.lose();
    report('gameOver', { score: play.score, progress: +Math.min(1, songTime / length).toFixed(3) });
  }
  const isNew = play.score > prev.s;
  ui.setEnd(grade, GRADE_COLORS[grade],
    kind === 'complete' ? (isNew ? '新纪录！' : '曲目完成！') : '曲目中断',
    `得分 ${play.score}${isNew ? '  ⭐ 新纪录' : ''}\n` +
    `准确率 ${acc.toFixed(1)}% · 最大连击 ${play.maxCombo}\n` +
    `PERFECT ${play.perfect} · GOOD ${play.good} · MISS ${play.miss}`);
  ui.showEnd(true);
  ui.setPausedIcon(false);
}

function toSelect() {
  mode = 'select'; paused = false;
  audio.stopSong();
  chart = null; notes = null; songTime = 0; resultsKind = '';
  ui.showEnd(false); ui.showSelect(true); ui.padShow(false);
  ui.setPausedIcon(false);
  ui.setSongLabel('');
  refreshSelBest();
}

function togglePause() {
  if (mode !== 'play') return;
  paused = !paused;
  ui.setPausedIcon(paused);
  if (paused) { audio.pauseSong(); ui.showBanner('已暂停', '按 P 或点按继续', 999999); }
  else { ui.el.banner.classList.remove('show'); audio.resumeSong(songTime); }
}

function toggleMute() {
  muted = !muted;
  audio.setMuted(muted);
  ui.setMutedIcon(muted);
  ui.showToast(muted ? '已静音' : '取消静音');
  try { localStorage.setItem('rsl.mute', muted ? '1' : '0'); } catch (e) { }
}

// ==================== 判定 ====================
function hitNote(lane, offset = 0) {
  if (mode !== 'play' || paused || !notes) return null;
  const target = songTime + offset;
  let best = null, bestD = 1e9;
  for (let i = missIdx; i < notes.length; i++) {
    const n = notes[i];
    if (n.t > target + GOOD_WIN + 1e-9) break;
    if (n.j || n.lane !== lane) continue;
    const ad = Math.abs(target - n.t);
    if (ad <= GOOD_WIN && ad < bestD) { bestD = ad; best = n; }
  }
  if (!best) return null;
  const judge = judgeFor(target - best.t);
  best.j = judge;
  const r = play.hit(judge);
  comboPop = 1; laneGlow[lane] = 1;
  judgeFx(lane, judge, r);
  return r;
}

function judgeFx(lane, judge, r) {
  const cx = FIELD_L + lane * LANE_W + LANE_W / 2;
  const col = judge === 'perfect' ? '#ffd75c' : '#58a8ff';
  spawnFloat(lane, judge === 'perfect' ? 'PERFECT' : 'GOOD', col, judge === 'perfect' ? 20 : 16);
  const n = judge === 'perfect' ? 14 : 8;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, sp = 60 + Math.random() * 220;
    spawnPart(cx, JUDGE_Y, Math.cos(a) * sp, Math.sin(a) * sp - 60, .35 + Math.random() * .25, col, 2 + Math.random() * 3.5, 600);
  }
  audio.sfx.hit(judge, lane);
  if (r.feverStarted) {
    flashT = .45; shakeT = .3; shakeAmp = 5;
    audio.sfx.fever();
    ui.showBanner('FEVER TIME!', '50 连击 · 分数 ×2', 1500);
    report('event', { tag: 'fever', score: play.score });
  }
}

function missFx(n) {
  laneFlash[n.lane] = 1; shakeT = .22; shakeAmp = 5;
  const cx = FIELD_L + n.lane * LANE_W + LANE_W / 2;
  for (let i = 0; i < 6; i++) {
    const a = Math.random() * Math.PI * 2, sp = 40 + Math.random() * 140;
    spawnPart(cx, JUDGE_Y, Math.cos(a) * sp, Math.sin(a) * sp - 40, .3, '#ff4455', 2 + Math.random() * 2.5, 500);
  }
  spawnFloat(n.lane, 'MISS', '#ff4455', 15);
  audio.sfx.hit('miss', n.lane);
}

function autoPass() {
  while (missIdx < notes.length && notes[missIdx].t + GOOD_WIN < songTime - 1e-9) {
    const n = notes[missIdx];
    if (!n.j) { n.j = 'miss'; play.missNote(); missFx(n); }
    missIdx++;
  }
}

// ==================== 更新 ====================
function update(dt) {
  playT += dt;
  if (mode === 'play' && !paused) {
    songTime += dt;
    if (!noAuto) autoPass();
    play.tick(dt);
    const pr = songTime / length;
    while (nextMile <= .999 && pr >= nextMile) {
      report('progress', { score: play.score, progress: +Math.min(1, pr).toFixed(3) });
      nextMile += .1;
    }
    if (!noAuto && songTime >= length) finish('complete');
    audio.songSync(songTime);
    ui.setAcc(play.judged > 0 ? accOf(play.perfect, play.good, play.judged) : null);
    ui.setProgress(Math.min(1, pr));
    ui.setScore(play.score);
    if (play.fever && Math.random() < .6) {
      spawnPart(FIELD_L + Math.random() * LANES * LANE_W, -10, (Math.random() * 2 - 1) * 30, 300 + Math.random() * 300,
        .5, LANE_COLORS[(Math.random() * 4) | 0], 2 + Math.random() * 2, 0);
    }
  }
  for (let i = 0; i < 4; i++) {
    laneGlow[i] = Math.max(0, laneGlow[i] - dt * 4);
    laneFlash[i] = Math.max(0, laneFlash[i] - dt * 3);
  }
  const smul = play.fever ? 4.5 : 1.2;
  for (const s of stars) { s.y += s.sp * smul * dt; if (s.y > H + 4) { s.y = -4; s.x = Math.random() * W; } }
  for (const p of parts) {
    if (!p.alive) continue;
    p.life -= dt;
    if (p.life <= 0) { p.alive = false; continue; }
    p.vy += p.grav * dt; p.x += p.vx * dt; p.y += p.vy * dt;
  }
  for (const f of floats) {
    if (!f.alive) continue;
    f.life -= dt;
    if (f.life <= 0) { f.alive = false; continue; }
    f.y -= 26 * dt;
  }
  if (shakeT > 0) shakeT -= dt;
  if (flashT > 0) flashT -= dt;
  comboPop = Math.max(0, comboPop - dt * 4.5);
}

// ==================== 渲染 ====================
function render() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.clearRect(0, 0, cv.width, cv.height);
  ctx.save();
  ctx.translate(viewOX, viewOY); ctx.scale(viewScale, viewScale);
  const shx = shakeT > 0 ? (Math.random() * 2 - 1) * shakeAmp * shakeT * 5 : 0;
  const shy = shakeT > 0 ? (Math.random() * 2 - 1) * shakeAmp * shakeT * 5 : 0;
  ctx.translate(shx, shy);

  ctx.drawImage(bgCv, 0, 0, W, H);

  // 星野
  for (const s of stars) {
    ctx.fillStyle = `rgba(200,215,255,${.25 + .2 * Math.sin(playT * s.tw + s.x)})`;
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
  }

  // Fever 光效
  if (play.fever) {
    const fa = .10 + .05 * Math.sin(playT * 9);
    const fg = ctx.createLinearGradient(0, 0, 0, H);
    fg.addColorStop(0, `rgba(255,200,90,${fa})`);
    fg.addColorStop(.6, 'rgba(255,200,90,0)');
    ctx.fillStyle = fg; ctx.fillRect(0, 0, W, H);
  }

  // 轨道按压光柱 / MISS 红闪
  for (let i = 0; i < 4; i++) {
    const x = FIELD_L + i * LANE_W;
    if (laneGlow[i] > 0) {
      const lg = ctx.createLinearGradient(0, 30, 0, JUDGE_Y);
      lg.addColorStop(0, hexa(LANE_COLORS[i], 0));
      lg.addColorStop(1, hexa(LANE_COLORS[i], laneGlow[i] * .30));
      ctx.fillStyle = lg; ctx.fillRect(x + 2, 30, LANE_W - 4, JUDGE_Y - 30);
    }
    if (laneFlash[i] > 0) {
      ctx.fillStyle = `rgba(255,68,85,${laneFlash[i] * .4})`;
      ctx.fillRect(x + 2, 30, LANE_W - 4, JUDGE_Y - 30);
    }
  }

  // note（发光横条）
  if (notes) {
    const vis = (JUDGE_Y - SPAWN_Y) / speed + .3;
    for (let i = missIdx; i < notes.length; i++) {
      const n = notes[i];
      const dtN = n.t - songTime;
      if (dtN > vis) break;
      if (n.j) continue;
      const y = JUDGE_Y - dtN * speed;
      if (y < 26) continue;
      const x = FIELD_L + n.lane * LANE_W;
      const col = LANE_COLORS[n.lane];
      ctx.fillStyle = hexa(col, .30);
      rr(ctx, x + 3, y - 11, LANE_W - 6, 22, 8); ctx.fill();
      ctx.fillStyle = col;
      rr(ctx, x + 7, y - 6, LANE_W - 14, 12, 5); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.75)';
      ctx.fillRect(x + 12, y - 4, LANE_W - 24, 3);
      if (dtN >= 0 && dtN <= .13) {
        ctx.strokeStyle = `rgba(255,255,255,${.5 * (1 - dtN / .13)})`;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x + LANE_W / 2, JUDGE_Y, 9 + (dtN / .13) * 16, 0, Math.PI * 2); ctx.stroke();
      }
    }
  }

  // 判定线（随节拍脉动）
  const beatPh = songSpb > 0 && songTime > LEADIN - .3 ? (((songTime - LEADIN) / songSpb) % 1 + 1) % 1 : 1;
  const pulse = mode === 'play' ? Math.pow(Math.max(0, 1 - beatPh), 2) : 0;
  ctx.fillStyle = `rgba(150,190,255,${.12 + .25 * pulse})`;
  ctx.fillRect(FIELD_L, JUDGE_Y - 6, LANES * LANE_W, 12);
  ctx.fillStyle = `rgba(240,248,255,${.55 + .35 * pulse})`;
  ctx.fillRect(FIELD_L, JUDGE_Y - 1.5, LANES * LANE_W, 3);

  // 键帽按压高亮
  for (let i = 0; i < 4; i++) {
    if (laneGlow[i] > 0) {
      const x = FIELD_L + i * LANE_W;
      ctx.fillStyle = hexa(LANE_COLORS[i], laneGlow[i] * .5);
      rr(ctx, x + 8, JUDGE_Y + 14, LANE_W - 16, 52, 10); ctx.fill();
    }
  }

  // 粒子
  for (const p of parts) {
    if (!p.alive) continue;
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;

  // 判定飘字
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  for (const f of floats) {
    if (!f.alive) continue;
    ctx.globalAlpha = Math.max(0, f.life / f.max);
    ctx.font = `800 ${f.size}px "Microsoft YaHei",sans-serif`;
    ctx.fillStyle = f.color;
    ctx.strokeStyle = 'rgba(6,10,26,.8)'; ctx.lineWidth = 3;
    ctx.strokeText(f.text, f.x, f.y); ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;

  // combo 数字弹跳
  if (mode === 'play' && play.combo >= 2) {
    const s = 1 + .35 * comboPop;
    ctx.save();
    ctx.translate(W / 2, 208); ctx.scale(s, s);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '800 44px "Microsoft YaHei",sans-serif';
    ctx.fillStyle = play.fever ? '#ffd75c' : '#eef3ff';
    ctx.shadowColor = play.fever ? 'rgba(255,200,90,.9)' : 'rgba(120,160,255,.8)';
    ctx.shadowBlur = 16;
    ctx.fillText(String(play.combo), 0, 0);
    ctx.shadowBlur = 0;
    ctx.font = '700 14px "Microsoft YaHei",sans-serif';
    ctx.fillStyle = play.fever ? 'rgba(255,220,150,.9)' : 'rgba(160,185,255,.8)';
    ctx.fillText(play.fever ? 'FEVER ×2' : 'COMBO', 0, 32);
    ctx.restore();
  }

  // 开头倒数提示
  if (mode === 'play' && songTime < LEADIN) {
    ctx.globalAlpha = Math.max(0, Math.min(1, (LEADIN - songTime) / LEADIN * 1.4));
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '700 30px "Microsoft YaHei",sans-serif';
    ctx.fillStyle = '#c8d4ff';
    ctx.fillText('READY…', W / 2, 300);
    ctx.globalAlpha = 1;
  }

  if (flashT > 0) {
    ctx.fillStyle = `rgba(255,244,214,${Math.min(.6, flashT * 1.4)})`;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.restore();
}

// ==================== 主循环 ====================
let last = performance.now(), acc = 0;
function tick(now) {
  requestAnimationFrame(tick);
  let dt = (now - last) / 1000; last = now;
  if (document.hidden) return;
  dt = Math.min(dt, 1 / 30);
  handleKeys();
  acc += dt;
  while (acc >= STEP) { update(STEP); acc -= STEP; }
  render();
}
requestAnimationFrame(tick);

// ==================== 输入 ====================
const pressed = new Set();
addEventListener('keydown', e => {
  if (e.isComposing || e.keyCode === 229) return;
  if (e.metaKey || e.altKey || e.ctrlKey) return;
  if (!e.repeat) pressed.add(e.code);
  if (e.code === 'Space' || e.code === 'Tab') e.preventDefault();
});
addEventListener('blur', () => pressed.clear());
document.addEventListener('visibilitychange', () => pressed.clear());

function handleKeys() {
  for (const code of pressed) {
    if (code === 'KeyP') togglePause();
    else if (code === 'KeyM') toggleMute();
    else if (code === 'Escape') { if (mode === 'play') finish('abort'); }
    else if (code === 'Enter') {
      if (mode === 'select') { if (!AUTOTEST) audio.ensure(); audio.sfx.ui(); startSong(selSong, selDiff); }
      else if (mode === 'over') { audio.sfx.ui(); startSong(songIdx, diffId); }
    }
    else {
      const l = LANE_KEYS[code];
      if (l !== undefined) { laneGlow[l] = 1; if (mode === 'play' && !paused) hitNote(l, 0); }
    }
  }
  pressed.clear();
}

// ==================== G 调试钩子 ====================
const G = {
  err: window.__BOOTERR,
  W, H, JUDGE_Y, LANES,
  step: (n = 60, dt = STEP) => { for (let i = 0; i < n; i++) { handleKeys(); update(dt); render(); } },
  upd: (n = 30, dt = STEP) => { for (let i = 0; i < n; i++) { handleKeys(); update(dt); } },
  press: (...codes) => codes.forEach(c => pressed.add(c)),
  hitNote: (lane, offset = 0) => hitNote(lane, offset),
  songTime: () => songTime,
  setSongTime: t => { songTime = Math.max(0, +t || 0); audio.seek(songTime); },
  setCombo: v => play.setCombo(v),
  setNoAuto: v => { noAuto = !!v; },
  setReportTarget: fn => { reportTarget = fn; },
  setScore: v => { play.setScore(v); ui.setScore(play.score); },
  startSong: (si = 0, di = 'N') => startSong(si, di),
  finish: kind => finish(kind === 'complete' ? 'complete' : 'abort'),
  toSelect: () => toSelect(),
  chart: () => chart,
  chartFor: (si, di) => buildChart(si, Math.max(0, DIFFS.findIndex(d => d.id === di))),
  songs: SONGS, diffs: DIFFS,
  math: { judgeFor, comboBonus, accOf, gradeFor },
  notes: () => notes,
  state: () => ({
    mode, paused, noAuto, selSong, selDiff, songIdx, diffId,
    score: play.score, combo: play.combo, maxCombo: play.maxCombo,
    fever: play.fever, feverT: +play.feverT.toFixed(3),
    perfect: play.perfect, good: play.good, miss: play.miss, judged: play.judged,
    acc: play.judged > 0 ? +accOf(play.perfect, play.good, play.judged).toFixed(2) : null,
    songTime: +songTime.toFixed(4), progress: +Math.min(1, songTime / length).toFixed(4),
    length, notesTotal: notes ? notes.length : 0, missIdx, resultsKind,
    best: getBestRec(songIdx, diffId), shakeT: +Math.max(0, shakeT).toFixed(3),
  }),
  fx: () => ({ parts: partsAlive(), floats: floats.reduce((c, f) => c + (f.alive ? 1 : 0), 0), shake: +Math.max(0, shakeT).toFixed(3), flash: +Math.max(0, flashT).toFixed(3), fever: play.fever }),
  audio,
};
window.__G = G;
window.addEventListener('error', e => { if (G.err) G.err.push(String(e.message || e)); });

// ==================== ？autotest=1 自测套件 ====================
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
    const finite = v => typeof v === 'number' && Number.isFinite(v);
    G.setNoAuto(true);                       // 铁律：屏蔽自动 MISS / 自动终曲
    audio.setMuted(true);
    const rawBest0E = localStorage.getItem('rsl.best.0E');
    const rawBest1E = localStorage.getItem('rsl.best.1E');
    const restoreBest = (si, di, raw) => {
      try {
        if (raw === null) localStorage.removeItem(`rsl.best.${si}${di}`);
        else localStorage.setItem(`rsl.best.${si}${di}`, raw);
      } catch (e) { }
    };
    const frames = [];
    G.setReportTarget(f => frames.push(f));
    await nap();

    // -- T1 启动零报错
    assert(1, G.err.length === 0, '启动零报错');

    // -- T2 选曲界面 UI 完整
    const U = ui.el;
    assert(2, U.songcards.length === 3 && U.diffbtns.length === 3 && !!U.start && !!U.selbest
      && !!U.mutebtn && !!U.pausebtn && !!U.quitbtn && U.select.style.display !== 'none',
      '选曲界面 UI 完整（3 曲/3 难度/开始/静音/暂停/结束）');

    // -- T3 ready 首帧
    assert(3, reports[0] && reports[0].kind === 'ready', 'ready 上报帧为首帧');
    await nap();

    // -- T4 三首歌元数据合法
    let metaOK = SONGS.length === 3
      && new Set(SONGS.map(s => s.bpm)).size === 3
      && SONGS.every(s => s.seq.every(pn => !!s.patterns[pn]))
      && SONGS.every(s => s.seq.length >= 28 && s.seq.length <= 48)
      && SONGS.every(s => Object.values(s.drums).every(arr => arr.every(st => st >= 0 && st <= 15)));
    assert(4, metaOK, '三首歌元数据（BPM 互异/拍型引用存在/鼓组 16 步合法）');

    // -- T5 九组谱面完整性
    let chartOK = true;
    for (let si = 0; si < 3; si++) {
      for (let di = 0; di < 3; di++) {
        const ch = G.chartFor(si, DIFFS[di].id);
        const ns = ch.notes;
        if (!ns.length) { chartOK = false; break; }
        for (let k = 1; k < ns.length; k++) if (ns[k].t < ns[k - 1].t - 1e-9) chartOK = false;
        for (const n of ns) if (n.t < LEADIN - 1e-6 || n.t > ch.length) chartOK = false;
        const seen = new Set();
        const laneT = [[], [], [], []];
        for (const n of ns) {
          if (seen.has(n.t.toFixed(4) + '_' + n.lane)) chartOK = false;
          seen.add(n.t.toFixed(4) + '_' + n.lane);
          laneT[n.lane].push(n.t);
        }
        for (const arr of laneT) for (let k = 1; k < arr.length; k++) if (arr[k] - arr[k - 1] < .085) chartOK = false;
        const mel = ch.music.melody;
        for (let k = 1; k < mel.length; k++) if (mel[k].t < mel[k - 1].t - 1e-9) chartOK = false;
        if (!finite(ch.length) || ch.length < 60 || ch.length > 90) chartOK = false;
      }
    }
    assert(5, chartOK, '9 组谱面完整性（时间递增/同轨间隔≥0.085s/在曲长内/无重复/60-90s）');

    // -- T6 谱面时间数学（拍×BPM 映射）
    {
      const song = SONGS[0], spb = 60 / song.bpm;
      const exp = new Set();
      let expE = 0;
      song.seq.forEach((pn, bar) => {
        for (const st of song.patterns[pn]) {
          exp.add((LEADIN + (bar * 4 + st / 4) * spb).toFixed(4));
          if (st % 4 === 0) expE++;
        }
      });
      const ch = G.chartFor(0, 'E');
      let allIn = true;
      for (const n of ch.notes) if (!exp.has(n.t.toFixed(4))) allIn = false;
      assert(6, allIn && Math.abs(ch.notes[0].t - LEADIN) < 1e-6 && ch.notes.length >= expE,
        '谱面时间=拍×BPM 映射且首音符=LEADIN');
    }

    // -- T7 难度密度与双押递增
    {
      const cE = G.chartFor(0, 'E').notes.length, cN = G.chartFor(0, 'N').notes.length, cH = G.chartFor(0, 'H').notes.length;
      const dE = G.chartFor(0, 'E').notes.filter(n => n.dbl).length;
      const dH = G.chartFor(0, 'H').notes.filter(n => n.dbl).length;
      assert(7, cE < cN && cN < cH && dH >= dE && cH > 200, `难度密度 E(${cE})<N(${cN})<H(${cH}) 且 H 双押≥E`);
    }

    // -- T8 判定窗三档数学
    {
      const j = G.math.judgeFor;
      assert(8, j(0) === 'perfect' && j(40e-3) === 'perfect' && j(-40e-3) === 'perfect'
        && j(41e-3) === 'good' && j(-41e-3) === 'good' && j(90e-3) === 'good' && j(-90e-3) === 'good'
        && j(91e-3) === 'miss' && j(-91e-3) === 'miss', '判定窗 ±40 PERFECT / ±90 GOOD / 其余 MISS');
    }

    // -- T9 combo 加成表
    {
      const cb = G.math.comboBonus;
      assert(9, cb(1) === 1 && cb(24) === 1 && cb(25) === 1.05 && cb(50) === 1.1 && cb(249) === 1.45 && cb(250) === 1.5 && cb(999) === 1.5,
        'combo 加成每 25 连击 +5% 封顶 ×1.5');
    }

    // -- T10 accOf/gradeFor 数学
    {
      const a = G.math.accOf, gr = G.math.gradeFor;
      assert(10, a(10, 0, 10) === 100 && a(0, 10, 10) === 50 && Math.abs(a(5, 5, 20) - 37.5) < 1e-9
        && gr(95) === 'S' && gr(94.9) === 'A' && gr(85) === 'A' && gr(84.9) === 'B'
        && gr(70) === 'B' && gr(55) === 'C' && gr(54.9) === 'D', '准确率权重与 S/A/B/C/D 评级边界');
    }
    await nap();

    // -- T11-T16 游玩核心：命中/加成/Fever/MISS
    startSong(0, 'N');
    G.setNoAuto(true);
    const chN = G.chart();
    {
      const ns = chN.notes;
      const at = k => { G.setSongTime(ns[k].t); return ns[k]; };
      // T11 PERFECT
      const n0 = at(0);
      const r0 = G.hitNote(n0.lane, 0);
      assert(11, r0 && r0.judge === 'perfect' && r0.combo === 1 && S().score === 100, 'hitNote PERFECT=100 分 combo=1');

      // T12 GOOD
      G.setSongTime(ns[1].t + .06);
      const r1 = G.hitNote(ns[1].lane, 0);
      assert(12, r1 && r1.judge === 'good' && S().score === 150, 'hitNote GOOD=50 分');

      // T13 过早按压忽略
      const sBefore = S().score, cBefore = S().combo;
      G.setSongTime(ns[2].t);
      const r2 = G.hitNote(ns[2].lane, -.5);
      assert(13, r2 === null && S().score === sBefore && S().combo === cBefore, '过早(>90ms)按压被忽略不惩罚');

      // T14 combo25 → +5%
      G.setCombo(24);
      const n3 = ns[3];
      G.setSongTime(n3.t);
      const r3 = G.hitNote(n3.lane, 0);
      assert(14, r3 && r3.combo === 25 && S().score === sBefore + 105, 'combo 达 25 时 PERFECT 得 100×1.05=105');
      const sc25 = S().score;

      // T15 combo50 → Fever ×2
      G.setCombo(49);
      const n4 = ns[4];
      G.setSongTime(n4.t);
      const r4 = G.hitNote(n4.lane, 0);
      assert(15, r4 && r4.combo === 50 && r4.feverStarted === true && S().fever === true && S().feverT > 7.9
        && S().score === sc25 + Math.round(100 * 1.1 * 2), 'combo 达 50 进入 Fever（8s）且分数 ×2=220');
      const sc50 = S().score;

      // T16 Fever 期间加成 + 8 秒自动结束
      const n5 = ns[5];
      G.setSongTime(n5.t);
      const r5 = G.hitNote(n5.lane, 0);
      assert(16, r5 && r5.combo === 51 && S().score === sc50 + Math.round(100 * 1.1 * 2), 'Fever 期间继续 ×2 计分');
      G.upd(500);   // 8.33s
      assert(35, !(S().fever) && S().feverT === 0, 'Fever 8 秒后自动结束');
    }
    await nap();

    // -- T17/T18 自动 MISS + combo 断裂反馈
    {
      const st0 = S();
      assert(17, st0.perfect === 4 && st0.good === 1 && st0.miss === 0, '判定计数累计一致（4P/1G）');
      G.setNoAuto(false);
      const ns = G.chart().notes;
      let k = 0;
      while (k < ns.length && ns[k].j) k++;
      G.setSongTime(ns[k].t - .12);
      G.upd(15);   // 0.25s，note 过线 90ms → 自动 MISS
      const st1 = S();
      assert(18, st1.miss >= 1 && st1.combo === 0 && G.fx().parts > 0 && G.fx().shake > 0,
        '过线自动 MISS + combo 断裂 + 红闪粒子/抖动反馈');
      G.setNoAuto(true);
    }

    // -- T19/T20 暂停冻结（音乐+note）与恢复
    {
      startSong(0, 'N');
      G.setNoAuto(true);
      G.setSongTime(2.3);
      G.upd(30);
      const t0 = S().songTime;
      G.press('KeyP'); G.upd(1);
      const pausedNow = S().paused;
      G.upd(30);
      const t1 = S().songTime;
      assert(19, pausedNow && Math.abs(t1 - t0) < 1e-9 && G.audio.songPlaying() === false, '暂停冻结 songTime/note 且音乐停止');
      G.press('KeyP'); G.upd(1);
      const t2 = S().songTime;
      G.upd(10);
      const t3 = S().songTime;
      assert(20, !S().paused && t3 > t2 && G.audio.songPlaying() === true, '恢复后 songTime 继续推进且音乐恢复');
    }

    // -- T21 键盘四键映射
    {
      startSong(0, 'N');
      G.setNoAuto(true);
      const ns = G.chart().notes;
      const keyOf = ['KeyD', 'KeyF', 'KeyJ', 'KeyK'];
      G.setSongTime(ns[0].t);
      G.press(keyOf[ns[0].lane]); G.upd(1);
      assert(21, S().perfect === 1 && S().score === 100, '键盘 D/F/J/K 映射四轨命中');
    }

    // -- T22 空按不惩罚
    {
      const s0 = S().score, c0 = S().combo;
      G.setSongTime(1.2);   // 倒数段无 note
      G.press('KeyD'); G.upd(1);
      assert(22, S().score === s0 && S().combo === c0, '无 note 空按不惩罚');
    }

    // -- T23 setScore 整数钳制
    {
      G.setScore(1234.9);
      assert(23, S().score === 1234, 'setScore 整数钳制');
    }

    // -- T24 触屏 4 分区存在
    assert(24, ui.el.padzones.length === 4 && ui.el.padzones.every((z, i) => +z.dataset.lane === i),
      '触屏 4 分区存在（data-lane 0-3）');
    await nap();

    // -- T25 中断局 → gameOver 末帧 + 结算面板
    {
      startSong(0, 'E');
      G.setNoAuto(true);
      G.upd(90);
      G.finish('abort');
      const st = S();
      assert(25, st.mode === 'over' && st.resultsKind === 'abort'
        && frames[frames.length - 1].kind === 'gameOver'
        && ui.el.end.style.display === 'flex' && ui.el.endgrade.textContent === 'D',
        '中断局 gameOver 末帧 + 结算面板（全 MISS 评 D）');
    }

    // -- T26 best 写入 localStorage（测后还原）
    {
      try { localStorage.removeItem('rsl.best.0E'); } catch (e) { }   // 隔离：清掉可能存在的旧纪录
      startSong(0, 'E');
      G.setNoAuto(true);
      G.setScore(2345);
      G.finish('complete');
      let rec = null;
      try { rec = JSON.parse(localStorage.getItem('rsl.best.0E') || 'null'); } catch (e) { }
      assert(26, rec && rec.s === 2345 && typeof rec.a === 'number' && S().best && S().best.s === 2345,
        'best（最高分+准确率）写入 rsl.best.0E');
      restoreBest(0, 'E', rawBest0E);
      const back = localStorage.getItem('rsl.best.0E');
      assert(36, back === rawBest0E, 'best 还原为原值');
    }

    // -- T27/T28 整曲快进：complete 末帧 + progress 帧序 + 无 NaN 无新报错
    {
      startSong(1, 'E');
      G.setNoAuto(false);
      const errBefore = G.err.length;
      const fMark = frames.length;
      let nanBad = false;
      const totalFrames = Math.ceil(S().length * 60) + 120;
      for (let i = 0; i < totalFrames; i++) {
        G.upd(1);
        if (i % 300 === 0) {
          const st = S();
          if (!finite(st.score) || !finite(st.songTime) || !finite(st.combo) || !finite(st.feverT)) nanBad = true;
          const ns = G.notes();
          if (ns && ns[st.missIdx] && !finite(ns[st.missIdx].t)) nanBad = true;
        }
      }
      const st = S();
      const seg = frames.slice(fMark);
      const progs = seg.filter(f => f.kind === 'progress').map(f => f.progress);
      let progOK = progs.length >= 3 && progs.every(p => p > 0 && p <= 1);
      for (let i = 1; i < progs.length; i++) if (progs[i] < progs[i - 1]) progOK = false;
      assert(27, st.mode === 'over' && st.resultsKind === 'complete'
        && seg[seg.length - 1].kind === 'complete' && progOK,
        '整曲快进到曲末 → complete 末帧 + progress(0-1) 递增帧序');
      assert(28, !nanBad && G.err.length === errBefore, '整曲快进全程无 NaN 无新报错');
      G.setNoAuto(true);
    }
    await nap();

    // -- T29 AudioContext / 歌曲调度状态 / 自测静音
    {
      const okEnsure = G.audio.ensure();
      assert(29, okEnsure && G.audio.hasCtx() && G.audio.isMuted() === true, 'AudioContext 可创建且自测期间保持静音');
      G.audio.playSong(G.chartFor(1, 'N').music, 0);
      const p1 = G.audio.songPlaying();
      G.audio.pauseSong();
      const p2 = G.audio.songPlaying();
      G.audio.resumeSong(0);
      const p3 = G.audio.songPlaying();
      G.audio.stopSong();
      const p4 = G.audio.songPlaying();
      assert(37, p1 && !p2 && p3 && !p4, '歌曲调度状态切换 播放/暂停/恢复/停止');
    }

    // -- T30 结算面板元素
    {
      assert(30, !!ui.el.endgrade && !!ui.el.endh && !!ui.el.endd && !!ui.el.go && !!ui.el.go2
        && (ui.el.endgrade.textContent || '').match(/^[SABCD]$/), '结算面板元素完整（评级/标题/详情/两按钮）');
    }

    // -- T31 双押同拍异轨
    {
      const ns = G.chartFor(0, 'H').notes;
      let dblOK = false;
      for (let i = 1; i < ns.length; i++) {
        if (Math.abs(ns[i].t - ns[i - 1].t) < 1e-9) {
          if (ns[i].lane !== ns[i - 1].lane) dblOK = true;
        }
      }
      assert(31, dblOK, '双押同拍异轨存在');
    }

    // -- T32 state() 快照字段完备
    {
      const st = S();
      const keys = ['mode', 'paused', 'songIdx', 'diffId', 'score', 'combo', 'maxCombo', 'fever', 'feverT',
        'perfect', 'good', 'miss', 'acc', 'songTime', 'progress', 'length', 'notesTotal', 'missIdx', 'resultsKind', 'best'];
      assert(32, keys.every(k => st[k] !== undefined) && finite(st.score) && finite(st.songTime), 'state() 快照字段完备且无 NaN');
    }

    // -- T33 点选卡片/难度生效
    {
      ui.el.songcards[1].click();
      ui.el.diffbtns[2].click();
      assert(33, S().selSong === 1 && S().selDiff === 'H' && ui.el.selbest.textContent.length > 0,
        '点选曲目卡/难度按钮生效且 best 文案更新');
      ui.el.songcards[0].click();
      ui.el.diffbtns[1].click();
    }

    // -- T34 测完回选曲界面 + chart 清空 + best 二次还原（防后期局污染）
    {
      G.toSelect();
      assert(34, S().mode === 'select' && G.chart() === null && ui.el.select.style.display === 'flex',
        '测完回选曲界面且谱面清空');
      restoreBest(0, 'E', rawBest0E);
      restoreBest(1, 'E', rawBest1E);
      assert(38, localStorage.getItem('rsl.best.0E') === rawBest0E && localStorage.getItem('rsl.best.1E') === rawBest1E,
        'best 二次还原（套件末尾防污染）');
    }

    audio.setMuted(true);
    const pass = results.filter(r => r.ok).length;
    window.__TEST = { pass, fail: results.length - pass, total: results.length, results, done: true };
    console.log(`[autotest] ${pass}/${results.length} passed`);
  }
}

if (new URLSearchParams(location.search).get('autotest')) autotest();
