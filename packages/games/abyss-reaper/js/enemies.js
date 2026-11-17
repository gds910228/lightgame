// Enemy definitions, pre-rendered sprites, spawn math and per-enemy AI
// for Abyss Reaper 暗渊割草者 (survivors-like horde).
// All procedural, no assets. Blood-red horde on abyss green-black.

export const ENEMY_CAP = 280;          // hard concurrency cap for perf safety

// 4 base types. hp scales ×(1+0.35·tMin), dmg ×(1+0.05·tMin) at spawn.
export const ENEMY_TYPES = {
  crawler: { id: 'crawler', name: '爬行者', hp: 14, spd: 42, dmg: 6,  r: 13, xp: 1, color: '#c22e3a', knockRes: 0 },
  dasher:  { id: 'dasher',  name: '疾冲者', hp: 9,  spd: 88, dmg: 8,  r: 11, xp: 1, color: '#e0563c', knockRes: 0 },
  shell:   { id: 'shell',   name: '装甲壳', hp: 48, spd: 26, dmg: 12, r: 18, xp: 2, color: '#7e1f2c', knockRes: 0.25 },
  moth:    { id: 'moth',    name: '毒雾蛾', hp: 16, spd: 55, dmg: 5,  r: 12, xp: 2, color: '#9c46b8', knockRes: 0, ranged: true },
};
export const BASE_KINDS = Object.keys(ENEMY_TYPES);

let eidSeq = 1;
export function makeEnemy(kind, x, y, tMin = 0, elite = false) {
  const T = ENEMY_TYPES[kind] || ENEMY_TYPES.crawler;
  const hpS = 1 + 0.35 * tMin, dmgS = 1 + 0.05 * tMin;
  const e = {
    id: eidSeq++, kind, elite,
    name: elite ? '精英·' + T.name : T.name,
    x, y, vx: 0, vy: 0,
    r: T.r * (elite ? 1.6 : 1),
    hp: T.hp * hpS * (elite ? 8 : 1),
    spd: T.spd * (elite ? 0.9 : 1),
    dmg: T.dmg * dmgS * (elite ? 1.5 : 1),
    xp: elite ? 10 : T.xp,
    knockRes: T.knockRes || 0,
    ranged: !!T.ranged,
    flash: 0, slowT: 0, stunT: 0,
    dashT: 1 + Math.random() * 1.5, dashV: 0,
    shootT: 1 + Math.random() * 2,
    wcd: {}, dead: false,
  };
  e.maxhp = e.hp;
  return e;
}

export function makeBoss(x, y) {
  return {
    id: -1, kind: 'boss', boss: true, name: '终极死神',
    x, y, vx: 0, vy: 0, r: 34,
    hp: 2600, maxhp: 2600, spd: 34, dmg: 20,
    phase: 'chase', patT: 1.6, patIdx: -1,
    castT: 0, emT: 0, tele: 0, dashT: 0, spiralAng: 0, volleys: 0,
    flash: 0, wcd: {}, dead: false,
  };
}

// ---- spawn math ----------------------------------------------------------
// density formula from spec: ×(1 + 0.12·t/min), base rate 2.2/s
export function spawnRateAt(tMin) { return 2.2 * (1 + 0.12 * tMin); }

export function pickType(tMin, rng = Math.random) {
  const w = [
    ['crawler', 46],
    ['dasher', 30],
    ['shell', tMin > 2 ? 18 : 4],
    ['moth', tMin > 3.5 ? 14 : 2],
  ];
  let total = 0; for (const [, v] of w) total += v;
  let v = rng() * total;
  for (const [k, val] of w) { v -= val; if (v <= 0) return k; }
  return 'crawler';
}

// random point just outside the screen rectangle (the spawn "ring")
export function ringPos(W, H, pad = 34, rng = Math.random) {
  const side = (rng() * 4) | 0;
  if (side === 0) return { x: rng() * W, y: -pad };
  if (side === 1) return { x: W + pad, y: rng() * H };
  if (side === 2) return { x: rng() * W, y: H + pad };
  return { x: -pad, y: rng() * H };
}

// ---- per-enemy AI --------------------------------------------------------
// ctx: { player, W, H, spawnBolt(x,y,vx,vy,dmg) }
export function updateEnemy(e, dt, ctx) {
  e.flash = Math.max(0, e.flash - dt * 8);
  e.slowT = Math.max(0, e.slowT - dt);
  if (e.stunT > 0) { e.stunT -= dt; e.vx = e.vy = 0; return; }
  const p = ctx.player;
  const dx = p.x - e.x, dy = p.y - e.y;
  const d = Math.hypot(dx, dy) || 1;
  let spd = e.spd * (e.slowT > 0 ? 0.55 : 1);
  if (e.ranged) {                                   // 毒雾蛾: keep distance + shoot
    if (d < 210) spd = -spd * 0.8;
    else if (d < 250) spd *= 0.15;
    e.shootT -= dt;
    if (e.shootT <= 0 && d < 430) {
      e.shootT = 2.6 + Math.random() * 0.7;
      ctx.spawnBolt(e.x, e.y, dx / d * 150, dy / d * 150, e.dmg);
    }
  } else if (e.kind === 'dasher') {                 // 疾冲者: dash bursts
    e.dashT -= dt;
    if (e.dashT <= 0) { e.dashT = 2.0 + Math.random() * 1.2; e.dashV = 0.38; }
    if (e.dashV > 0) { e.dashV -= dt; spd *= 2.6; }
  }
  const nx = dx / d, ny = dy / d;
  e.vx = nx * spd; e.vy = ny * spd;
  e.x += e.vx * dt; e.y += e.vy * dt;
  // loose world clamp so nothing roams into the void
  if (e.x < -80) e.x = -80; else if (e.x > ctx.W + 80) e.x = ctx.W + 80;
  if (e.y < -80) e.y = -80; else if (e.y > ctx.H + 80) e.y = ctx.H + 80;
}

// ---- pre-rendered sprites ------------------------------------------------
const SPR = {};
let DPRQ = 2;
function bake(key, baseR, drawFn) {
  const pad = Math.max(8, baseR * 0.5);
  const L = Math.ceil((baseR + pad) * 2);
  const cv = document.createElement('canvas');
  cv.width = Math.ceil(L * DPRQ); cv.height = Math.ceil(L * DPRQ);
  const c = cv.getContext('2d');
  c.scale(DPRQ, DPRQ); c.translate(L / 2, L / 2);
  drawFn(c, baseR);
  SPR[key] = { cv, base: baseR, L };
}

function radial(c, r, col, hi) {
  const g = c.createRadialGradient(-r * .35, -r * .4, r * .12, 0, 0, r * 1.15);
  g.addColorStop(0, hi); g.addColorStop(.6, col); g.addColorStop(1, '#1a060a');
  c.fillStyle = g;
  c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.fill();
}

export function makeSprites(DPR = 2) {
  if (SPR.crawler) return SPR;
  DPRQ = Math.max(1.5, Math.min(2, DPR));
  // 爬行者: blob + legs + eyes
  bake('crawler', 13, (c, r) => {
    c.strokeStyle = '#5e1018'; c.lineWidth = 2.4; c.lineCap = 'round';
    for (let i = -1; i <= 1; i++) for (const s of [-1, 1]) {
      c.beginPath(); c.moveTo(s * r * .45, i * r * .45);
      c.lineTo(s * r * 1.2, i * r * .55 + r * .25); c.stroke();
    }
    radial(c, r, '#c22e3a', '#e8606a');
    c.fillStyle = '#ffd77a';
    c.beginPath(); c.arc(-r * .3, -r * .15, r * .13, 0, 7); c.fill();
    c.beginPath(); c.arc(r * .3, -r * .15, r * .13, 0, 7); c.fill();
  });
  // 疾冲者: arrow body
  bake('dasher', 11, (c, r) => {
    const g = c.createLinearGradient(-r, 0, r * 1.4, 0);
    g.addColorStop(0, '#701c14'); g.addColorStop(1, '#f07a50');
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(r * 1.4, 0); c.lineTo(-r * .9, r * .78);
    c.lineTo(-r * .45, 0); c.lineTo(-r * .9, -r * .78); c.closePath(); c.fill();
    c.fillStyle = '#ffe08a';
    c.beginPath(); c.arc(r * .5, 0, r * .16, 0, 7); c.fill();
  });
  // 装甲壳: plated dome
  bake('shell', 18, (c, r) => {
    radial(c, r, '#7e1f2c', '#a83848');
    c.strokeStyle = 'rgba(20,4,8,.7)'; c.lineWidth = 3;
    for (const k of [.4, .72]) { c.beginPath(); c.arc(0, 0, r * k, .5, Math.PI - .5); c.stroke(); }
    c.fillStyle = '#3a0a12';
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3 + .3;
      c.beginPath();
      c.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      c.lineTo(Math.cos(a) * (r + 5), Math.sin(a) * (r + 5));
      c.lineTo(Math.cos(a + .22) * r, Math.sin(a + .22) * r);
      c.fill();
    }
    c.fillStyle = '#e8b04a';
    c.beginPath(); c.arc(0, r * .1, r * .12, 0, 7); c.fill();
  });
  // 毒雾蛾: wings + body
  bake('moth', 12, (c, r) => {
    c.fillStyle = 'rgba(156,70,184,.92)';
    for (const s of [-1, 1]) {
      c.beginPath(); c.ellipse(s * r * .62, -r * .18, r * .62, r * .42, s * .5, 0, 7); c.fill();
      c.beginPath(); c.ellipse(s * r * .5, r * .42, r * .4, r * .28, s * .3, 0, 7); c.fill();
    }
    c.strokeStyle = 'rgba(240,190,255,.5)'; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(0, -r * .4); c.lineTo(-r * .5, -r * 1.05); c.stroke();
    c.beginPath(); c.moveTo(0, -r * .4); c.lineTo(r * .5, -r * 1.05); c.stroke();
    const g = c.createLinearGradient(0, -r, 0, r);
    g.addColorStop(0, '#c468d8'); g.addColorStop(1, '#4a1440');
    c.fillStyle = g;
    c.beginPath(); c.ellipse(0, 0, r * .3, r * .78, 0, 0, 7); c.fill();
    c.fillStyle = '#d8ffb0';
    c.beginPath(); c.arc(0, -r * .45, r * .12, 0, 7); c.fill();
  });
  // 终极死神 Boss: robe + crown + red eyes
  bake('boss', 34, (c, r) => {
    const g = c.createRadialGradient(0, -r * .2, r * .2, 0, 0, r * 1.1);
    g.addColorStop(0, '#4a1420'); g.addColorStop(.7, '#2a0a12'); g.addColorStop(1, '#12040a');
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(0, -r * 1.1);
    c.quadraticCurveTo(r * 1.05, -r * .3, r * .8, r);
    c.lineTo(-r * .8, r);
    c.quadraticCurveTo(-r * 1.05, -r * .3, 0, -r * 1.1);
    c.fill();
    c.strokeStyle = 'rgba(255,90,90,.35)'; c.lineWidth = 2; c.stroke();
    // crown
    c.fillStyle = '#e8dcc0';
    for (let i = -1; i <= 1; i++) {
      c.beginPath();
      c.moveTo(i * r * .34 - r * .12, -r * .62);
      c.lineTo(i * r * .34, -r * 1.0 - (i === 0 ? r * .12 : 0));
      c.lineTo(i * r * .34 + r * .12, -r * .62);
      c.fill();
    }
    // eyes
    c.fillStyle = '#ff3a3a';
    c.shadowColor = 'rgba(255,60,60,.9)'; c.shadowBlur = 8;
    c.beginPath(); c.arc(-r * .18, -r * .42, r * .08, 0, 7); c.fill();
    c.beginPath(); c.arc(r * .18, -r * .42, r * .08, 0, 7); c.fill();
    c.shadowBlur = 0;
  });
  // player: bone-white reaper
  bake('player', 12, (c, r) => {
    const g = c.createRadialGradient(-r * .3, -r * .4, r * .15, 0, 0, r * 1.2);
    g.addColorStop(0, '#fff8e8'); g.addColorStop(.65, '#e8e0d0'); g.addColorStop(1, '#a89a84');
    c.fillStyle = g;
    c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#2a2018';
    c.beginPath(); c.arc(0, -r * .28, r * .5, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#9fe870';
    c.beginPath(); c.arc(-r * .18, -r * .3, r * .1, 0, 7); c.fill();
    c.beginPath(); c.arc(r * .18, -r * .3, r * .1, 0, 7); c.fill();
    c.strokeStyle = 'rgba(60,40,20,.5)'; c.lineWidth = 1.4;
    c.beginPath(); c.arc(0, 0, r - .8, 0, Math.PI * 2); c.stroke();
  });
  // pickups
  bake('gem', 7, (c, r) => {
    const g = c.createLinearGradient(0, -r, 0, r);
    g.addColorStop(0, '#c8ffc0'); g.addColorStop(.5, '#6ed868'); g.addColorStop(1, '#2a8838');
    c.fillStyle = g;
    c.beginPath(); c.moveTo(0, -r); c.lineTo(r * .72, 0); c.lineTo(0, r); c.lineTo(-r * .72, 0); c.closePath(); c.fill();
    c.fillStyle = 'rgba(255,255,255,.75)';
    c.beginPath(); c.moveTo(0, -r * .75); c.lineTo(r * .3, -r * .1); c.lineTo(0, 0); c.lineTo(-r * .3, -r * .1); c.closePath(); c.fill();
  });
  bake('gemBig', 10, (c, r) => {
    const g = c.createLinearGradient(0, -r, 0, r);
    g.addColorStop(0, '#c0f4ff'); g.addColorStop(.5, '#4ec8d8'); g.addColorStop(1, '#187898');
    c.fillStyle = g;
    c.beginPath(); c.moveTo(0, -r); c.lineTo(r * .72, 0); c.lineTo(0, r); c.lineTo(-r * .72, 0); c.closePath(); c.fill();
    c.fillStyle = 'rgba(255,255,255,.75)';
    c.beginPath(); c.moveTo(0, -r * .75); c.lineTo(r * .3, -r * .1); c.lineTo(0, 0); c.lineTo(-r * .3, -r * .1); c.closePath(); c.fill();
  });
  bake('heal', 10, (c, r) => {
    c.save(); c.rotate(-.6);
    c.fillStyle = '#a8683a';
    c.beginPath(); c.ellipse(0, 0, r * .82, r * .55, 0, 0, 7); c.fill();
    c.fillStyle = '#f0e8d8';
    c.beginPath(); c.arc(r * .85, 0, r * .3, 0, 7); c.fill();
    c.fillRect(r * .45, -r * .12, r * .45, r * .24);
    c.restore();
  });
  bake('magnet', 10, (c, r) => {
    c.strokeStyle = '#d8d8e0'; c.lineWidth = r * .5; c.lineCap = 'butt';
    c.beginPath(); c.arc(0, r * .1, r * .55, Math.PI, 0, false); c.stroke();
    c.fillStyle = '#e04848';
    c.fillRect(-r * .8, -r * .5, r * .5, r * .5);
    c.fillRect(r * .3, -r * .5, r * .5, r * .5);
  });
  return SPR;
}

export function drawSpriteAt(c, key, x, y, r, rot = 0, alpha = 1) {
  const sp = SPR[key]; if (!sp) return;
  const s = r / sp.base;
  c.save(); c.translate(x, y);
  if (rot) c.rotate(rot);
  if (alpha < 1) c.globalAlpha = alpha;
  c.scale(s, s);
  c.drawImage(sp.cv, -sp.L / 2, -sp.L / 2, sp.L, sp.L);
  c.restore();
}

export function drawEnemy(c, e, gameT) {
  drawSpriteAt(c, e.kind, e.x, e.y, e.r);
  if (e.elite) {   // gold aura
    const pu = .5 + .5 * Math.sin(gameT * 6 + e.id);
    c.strokeStyle = `rgba(255,214,110,${.55 + pu * .35})`;
    c.lineWidth = 2.5;
    c.beginPath(); c.arc(e.x, e.y, e.r + 5 + pu * 2, 0, Math.PI * 2); c.stroke();
    // mini hp bar
    const w = e.r * 2;
    c.fillStyle = 'rgba(0,0,0,.55)';
    c.fillRect(e.x - w / 2, e.y - e.r - 10, w, 4);
    c.fillStyle = '#ffd77a';
    c.fillRect(e.x - w / 2, e.y - e.r - 10, w * Math.max(0, e.hp / e.maxhp), 4);
  }
  if (e.flash > 0) {   // white hit flash
    c.globalAlpha = Math.min(1, e.flash * 7);
    c.fillStyle = '#ffffff';
    c.beginPath(); c.arc(e.x, e.y, e.r, 0, Math.PI * 2); c.fill();
    c.globalAlpha = 1;
  }
}

export function drawBoss(c, b, gameT) {
  drawSpriteAt(c, 'boss', b.x, b.y, b.r);
  if (b.phase === 'tele') {   // charge telegraph line
    const pu = .4 + .6 * Math.abs(Math.sin(gameT * 18));
    c.strokeStyle = `rgba(255,60,50,${pu})`; c.lineWidth = 3; c.setLineDash([12, 8]);
    c.beginPath(); c.moveTo(b.x, b.y); c.lineTo(b.tx || b.x, b.ty || b.y); c.stroke();
    c.setLineDash([]);
  }
  if (b.flash > 0) {
    c.globalAlpha = Math.min(1, b.flash * 6);
    c.fillStyle = '#fff';
    c.beginPath(); c.arc(b.x, b.y, b.r, 0, Math.PI * 2); c.fill();
    c.globalAlpha = 1;
  }
}
