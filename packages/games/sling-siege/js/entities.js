// Entities for Sling Siege: material table, block/enemy/projectile factories
// and all canvas drawing (procedural sprites, no assets).
// Damage model lives in game.js; this module defines the numbers.

export const MATS = {
  wood:  { key: 'wood',  name: '木',   hp: 55,  density: 1.0,
           fill: '#a4713c', dark: '#7c4f26', edge: '#5e3c1c', frag: '#8a5c2e', light: '#c08a50' },
  stone: { key: 'stone', name: '石',   hp: 130, density: 2.2,
           fill: '#a8adb5', dark: '#81878f', edge: '#5f656e', frag: '#8f959d', light: '#c8cdd4' },
  glass: { key: 'glass', name: '玻璃', hp: 16,  density: 0.6,
           fill: 'rgba(150,222,235,.52)', dark: 'rgba(96,178,196,.55)', edge: '#9fdce8', frag: '#bdeef5', light: 'rgba(230,250,252,.75)' },
};

export const ENEMY_TYPES = {
  small:  { w: 26, h: 34, hp: 1, score: 100, name: '小兵' },
  medium: { w: 32, h: 42, hp: 2, score: 200, name: '中尉' },
  large:  { w: 40, h: 52, hp: 3, score: 300, name: '大块头' },
};

export const PROJ_DEFS = {
  ball:  { mass: 1.0, size: 26 },
  tnt:   { mass: 0.8, size: 24 },
  pearl: { mass: 0.4, size: 16 },
};

let _id = 0;
export function nextId() { return ++_id; }

export function makeBlock(mat, cx, cy, w, h) {
  const m = MATS[mat] || MATS.wood;
  const mass = Math.max(0.08, (w * h / 4000) * m.density);
  return {
    id: nextId(), kind: 'block', mat: m.key,
    x: cx, y: cy, px: cx, py: cy,
    halfW: w / 2, halfH: h / 2, w, h,
    vx: 0, vy: 0, mass, invMass: 1 / mass,
    hp: m.hp, maxHp: m.hp,
    grounded: false, asleep: true, sleepT: 0, supportOn: null,
    dead: false, hitFlash: 0,
  };
}

export function makeEnemy(type, x, feetY) {
  const t = ENEMY_TYPES[type] || ENEMY_TYPES.small;
  return {
    id: nextId(), type, w: t.w, h: t.h, hp: t.hp, maxHp: t.hp, score: t.score,
    x, y: feetY - t.h / 2,
    vx: 0, vy: 0,
    support: null, falling: false, fallFrom: 0,
    dead: false, hitCd: 0, flash: 0, bob: Math.random() * 6,
  };
}

export function makeProjectile(kind, x, y, vx, vy) {
  const d = PROJ_DEFS[kind] || PROJ_DEFS.ball;
  const half = d.size / 2;
  return {
    id: nextId(), kind,
    x, y, px: x, py: y,
    halfW: half, halfH: half, w: d.size, h: d.size,
    vx, vy, mass: d.mass, invMass: 1 / d.mass,
    rot: 0, fuse: 0, ehitCd: 0, rest: 0, bounces: 0,
    grounded: false, asleep: false, sleepT: 0, supportOn: null,
    dead: false, boomQueued: false, chain: false, born: 0,
  };
}

// ---------- drawing ----------
function rr(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

// deterministic pseudo-random from seed (cracks / speckles)
function srand(seed) { let s = seed; return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }; }

export function drawBlock(c, b) {
  const m = MATS[b.mat] || MATS.wood;
  const x = b.x - b.halfW, y = b.y - b.halfH, w = b.w, h = b.h;
  c.save();
  if (b.mat === 'glass') {
    c.fillStyle = m.fill;
    rr(c, x, y, w, h, 3); c.fill();
    // sheen
    c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = 2;
    c.beginPath();
    c.moveTo(x + w * .18, y + h - 3); c.lineTo(x + w - 3, y + h * .16);
    c.moveTo(x + w * .1, y + h * .55); c.lineTo(x + w * .55, y + 2);
    c.stroke();
    c.strokeStyle = m.edge; c.lineWidth = 2;
    rr(c, x + 1, y + 1, w - 2, h - 2, 3); c.stroke();
  } else {
    const g = c.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, m.light); g.addColorStop(.35, m.fill); g.addColorStop(1, m.dark);
    c.fillStyle = g;
    rr(c, x, y, w, h, 4); c.fill();
    c.strokeStyle = m.edge; c.lineWidth = 2;
    rr(c, x + 1, y + 1, w - 2, h - 2, 4); c.stroke();
    if (b.mat === 'wood' && w >= h) {         // plank grain
      c.strokeStyle = 'rgba(94,60,28,.45)'; c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(x + 6, y + h * .38); c.lineTo(x + w - 6, y + h * .34); c.stroke();
      c.beginPath(); c.moveTo(x + 6, y + h * .66); c.lineTo(x + w - 6, y + h * .7); c.stroke();
    } else if (b.mat === 'wood') {            // post grain
      c.strokeStyle = 'rgba(94,60,28,.45)'; c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(x + w * .35, y + 5); c.lineTo(x + w * .3, y + h - 5); c.stroke();
      c.beginPath(); c.moveTo(x + w * .68, y + 5); c.lineTo(x + w * .72, y + h - 5); c.stroke();
    } else {                                  // stone speckles
      const r = srand(b.id * 97 + 13);
      c.fillStyle = 'rgba(70,76,84,.4)';
      for (let i = 0; i < 6; i++) {
        const px = x + 4 + r() * (w - 8), py = y + 4 + r() * (h - 8);
        c.fillRect(px, py, 2.5, 2.5);
      }
      c.strokeStyle = 'rgba(255,255,255,.25)'; c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(x + 3, y + h - 3); c.lineTo(x + w - 3, y + h - 3); c.stroke();
    }
  }
  // damage cracks
  const ratio = b.hp / b.maxHp;
  if (ratio < 0.92) {
    const r = srand(b.id * 31 + 7);
    const n = ratio < 0.45 ? 3 : 2;
    c.strokeStyle = b.mat === 'glass' ? 'rgba(255,255,255,.85)' : 'rgba(30,18,8,.6)';
    c.lineWidth = 1.6;
    for (let i = 0; i < n; i++) {
      let cx = x + r() * w, cy = y + (i % 2 === 0 ? 0 : h);
      c.beginPath(); c.moveTo(cx, cy);
      const steps = 3;
      for (let s = 1; s <= steps; s++) {
        cx += (r() - .5) * w * .3;
        cy += (i % 2 === 0 ? 1 : -1) * h * .3 + (r() - .5) * 6;
        c.lineTo(cx, Math.max(y, Math.min(y + h, cy)));
      }
      c.stroke();
    }
  }
  if (b.hitFlash > 0) {
    c.fillStyle = `rgba(255,240,210,${b.hitFlash * 2})`;
    rr(c, x, y, w, h, 4); c.fill();
  }
  c.restore();
}

export function drawFrag(c, f) {
  const m = MATS[f.mat] || MATS.wood;
  c.save();
  c.translate(f.x, f.y); c.rotate(f.rot);
  c.globalAlpha = Math.max(0, Math.min(1, f.life / .5));
  c.fillStyle = m.frag;
  c.fillRect(-f.w / 2, -f.h / 2, f.w, f.h);
  c.strokeStyle = m.edge; c.lineWidth = 1;
  c.strokeRect(-f.w / 2, -f.h / 2, f.w, f.h);
  c.restore();
}

export function drawEnemy(c, e, time) {
  const bob = e.support && !e.falling ? Math.sin(time * 3 + e.bob) * 1.2 : 0;
  const x = e.x, y = e.y + bob;
  const w = e.w, h = e.h;
  c.save();
  if (e.flash > 0) { c.translate((Math.random() - .5) * 3, 0); }
  // body
  const g = c.createLinearGradient(x, y - h / 2, x, y + h / 2);
  g.addColorStop(0, '#8cc65c'); g.addColorStop(.6, '#6fb24a'); g.addColorStop(1, '#4a8e2e');
  c.fillStyle = g;
  rr(c, x - w / 2, y - h / 2, w, h, Math.min(9, w * .3)); c.fill();
  c.strokeStyle = '#356b20'; c.lineWidth = 1.6;
  rr(c, x - w / 2 + 1, y - h / 2 + 1, w - 2, h - 2, Math.min(9, w * .3)); c.stroke();
  // belly
  c.fillStyle = 'rgba(220,240,190,.5)';
  c.beginPath(); c.ellipse(x, y + h * .16, w * .3, h * .26, 0, 0, Math.PI * 2); c.fill();
  // eyes (look left toward the slingshot)
  const ey = y - h * .18, ex = w * .16, er = Math.max(2.4, w * .11);
  c.fillStyle = '#fff';
  c.beginPath(); c.arc(x - ex, ey, er, 0, 7); c.fill();
  c.beginPath(); c.arc(x + ex, ey, er, 0, 7); c.fill();
  c.fillStyle = '#222';
  c.beginPath(); c.arc(x - ex - er * .35, ey, er * .5, 0, 7); c.fill();
  c.beginPath(); c.arc(x + ex - er * .35, ey, er * .5, 0, 7); c.fill();
  // angry brows
  c.strokeStyle = '#2d5a1a'; c.lineWidth = Math.max(1.6, w * .07); c.lineCap = 'round';
  c.beginPath(); c.moveTo(x - ex - er, ey - er * 1.5); c.lineTo(x - ex + er * .5, ey - er * .9); c.stroke();
  c.beginPath(); c.moveTo(x + ex + er, ey - er * 1.5); c.lineTo(x + ex - er * .5, ey - er * .9); c.stroke();
  // mouth
  c.beginPath(); c.moveTo(x - w * .14, y + h * .05); c.lineTo(x + w * .1, y + h * .1); c.stroke();
  // feet
  c.fillStyle = '#3f7a26';
  c.fillRect(x - w * .3, y + h / 2 - 3, w * .22, 4);
  c.fillRect(x + w * .1, y + h / 2 - 3, w * .22, 4);
  // hp pips
  if (e.maxHp > 1) {
    for (let i = 0; i < e.maxHp; i++) {
      c.fillStyle = i < e.hp ? '#ffd34d' : 'rgba(40,40,40,.45)';
      c.beginPath();
      c.arc(x - (e.maxHp - 1) * 4 + i * 8, y - h / 2 - 7, 3, 0, 7); c.fill();
    }
  }
  if (e.flash > 0) {
    c.globalAlpha = e.flash * 3;
    c.fillStyle = '#fff';
    rr(c, x - w / 2, y - h / 2, w, h, 9); c.fill();
    c.globalAlpha = 1;
  }
  c.restore();
}

export function drawProjectile(c, p, time) {
  const x = p.x, y = p.y;
  c.save();
  c.translate(x, y);
  if (p.kind === 'ball') {
    c.rotate(p.rot);
    const r = p.halfW;
    const g = c.createRadialGradient(-r * .35, -r * .4, r * .1, 0, 0, r * 1.15);
    g.addColorStop(0, '#c8c2b8'); g.addColorStop(.6, '#9a948a'); g.addColorStop(1, '#6a645c');
    c.fillStyle = g;
    c.beginPath(); c.arc(0, 0, r, 0, 7); c.fill();
    c.strokeStyle = 'rgba(50,45,40,.5)'; c.lineWidth = 1.5;
    c.beginPath(); c.arc(0, 0, r - 1, 0, 7); c.stroke();
    c.fillStyle = 'rgba(80,74,66,.5)';
    c.beginPath(); c.arc(r * .3, r * .2, r * .2, 0, 7); c.fill();
    c.beginPath(); c.arc(-r * .25, r * .35, r * .14, 0, 7); c.fill();
  } else if (p.kind === 'tnt') {
    c.rotate(Math.sin(time * 6 + p.id) * .08);
    const w = p.halfW * 1.7, h = p.halfH * 2.1;
    const g = c.createLinearGradient(-w / 2, 0, w / 2, 0);
    g.addColorStop(0, '#e04838'); g.addColorStop(.5, '#c03024'); g.addColorStop(1, '#93231a');
    c.fillStyle = g;
    rr(c, -w / 2, -h / 2, w, h, 4); c.fill();
    c.fillStyle = '#f2e2c0';
    c.fillRect(-w / 2 + 3, -h * .18, w - 6, h * .3);
    c.strokeStyle = '#3a2a18'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(0, -h / 2); c.quadraticCurveTo(4, -h / 2 - 6, 8, -h / 2 - 8); c.stroke();
    // fuse spark
    const sp = 2.4 + Math.sin(time * 22 + p.id) * 1.2;
    c.fillStyle = '#ffd34d';
    c.beginPath(); c.arc(8, -h / 2 - 8, sp, 0, 7); c.fill();
    c.fillStyle = 'rgba(255,120,40,.8)';
    c.beginPath(); c.arc(8, -h / 2 - 8, sp * .55, 0, 7); c.fill();
  } else {  // pearl
    const r = p.halfW;
    const g = c.createRadialGradient(-r * .3, -r * .35, r * .1, 0, 0, r);
    g.addColorStop(0, '#ffffff'); g.addColorStop(.55, '#bfeef2'); g.addColorStop(1, '#6ab8c8');
    c.fillStyle = g;
    c.beginPath(); c.arc(0, 0, r, 0, 7); c.fill();
    c.strokeStyle = 'rgba(60,120,135,.6)'; c.lineWidth = 1.2;
    c.beginPath(); c.arc(0, 0, r - .8, 0, 7); c.stroke();
  }
  c.restore();
}

export function drawStar(c, x, y, r, rot, color = '#ffd34d') {
  c.save(); c.translate(x, y); c.rotate(rot);
  c.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + i * Math.PI * 2 / 5;
    const a2 = a + Math.PI / 5;
    c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    c.lineTo(Math.cos(a2) * r * .45, Math.sin(a2) * r * .45);
  }
  c.closePath();
  c.fillStyle = color; c.fill();
  c.strokeStyle = 'rgba(120,70,0,.5)'; c.lineWidth = 1; c.stroke();
  c.restore();
}

// wooden slingshot; pouchPos null = idle
export function drawSling(c, pouchPos, kind) {
  const ax = 126, ay = 492, bx = 174, by = 492, tx = 150, ty = 548;
  c.save();
  c.lineCap = 'round';
  // trunk + arms
  c.strokeStyle = '#6a4422'; c.lineWidth = 13;
  c.beginPath(); c.moveTo(150, 618); c.lineTo(tx, ty); c.stroke();
  c.strokeStyle = '#7c5228'; c.lineWidth = 10;
  c.beginPath(); c.moveTo(tx, ty); c.lineTo(ax, ay); c.stroke();
  c.beginPath(); c.moveTo(tx, ty); c.lineTo(bx, by); c.stroke();
  c.strokeStyle = 'rgba(255,220,170,.3)'; c.lineWidth = 3;
  c.beginPath(); c.moveTo(148, 610); c.lineTo(148, 552); c.stroke();
  // bands
  c.strokeStyle = '#5a2e24'; c.lineWidth = 4.5;
  if (pouchPos) {
    c.beginPath(); c.moveTo(ax, ay); c.lineTo(pouchPos.x, pouchPos.y); c.stroke();
    c.beginPath(); c.moveTo(bx, by); c.lineTo(pouchPos.x, pouchPos.y); c.stroke();
    c.fillStyle = '#3a221c';
    c.beginPath(); c.arc(pouchPos.x, pouchPos.y, 7, 0, 7); c.fill();
    // projectile preview in pouch
    c.save(); c.translate(pouchPos.x, pouchPos.y);
    if (kind === 'tnt') { c.fillStyle = '#c03024'; rr(c, -8, -10, 16, 20, 3); c.fill(); c.fillStyle = '#f2e2c0'; c.fillRect(-5, -3, 10, 6); }
    else if (kind === 'pearl') { c.fillStyle = '#bfeef2'; c.beginPath(); c.arc(0, 0, 6, 0, 7); c.fill(); }
    else { const g = c.createRadialGradient(-3, -4, 2, 0, 0, 12); g.addColorStop(0, '#c8c2b8'); g.addColorStop(1, '#6a645c'); c.fillStyle = g; c.beginPath(); c.arc(0, 0, 12, 0, 7); c.fill(); }
    c.restore();
  } else {
    c.beginPath(); c.moveTo(ax, ay); c.quadraticCurveTo(150, 505, bx, by); c.stroke();
  }
  c.restore();
}
