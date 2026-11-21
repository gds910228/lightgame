// Silkline Swing — procedural Canvas art: indigo canyon, copper anchors,
// jade silk, glazed-vermilion star gate. No images, no fonts, no network.
import { anchorPos } from './physics.js';

export const W = 1280, H = 720;

const C = {
  ink: '#060a15', indigo: '#0c1630', indigo2: '#16274b', ridge1: '#101c38',
  ridge2: '#182a4b', rock: '#0e172c', rockHi: '#24395f',
  copper: '#e0a45a', copperHi: '#ffd99a', copperDim: '#8d5f2e',
  jade: '#6fe3c4', jadeHi: '#b6ffe8', jadeDim: '#2f8a7c',
  verm: '#e35d4c', vermHi: '#ff9a78', vermDim: '#7c2b2c',
  paper: '#ffe8c2', muted: '#8fa1bf',
};

function rngFrom(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

function roundRect(c, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

function drawStar(c, x, y, r, points, inner, rot = 0) {
  c.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const a = rot + i * Math.PI / points;
    const rr = i % 2 === 0 ? r : r * inner;
    const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
    if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
  }
  c.closePath();
}

function makeSky() {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#050813');
  g.addColorStop(0.42, '#0b142c');
  g.addColorStop(0.7, '#101f3d');
  g.addColorStop(1, '#070c19');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  // star dust
  const rnd = rngFrom(77);
  for (let i = 0; i < 220; i++) {
    const x = rnd() * W, y = rnd() * H * 0.62, r = 0.4 + rnd() * 1.5;
    c.fillStyle = `rgba(${180 + (rnd() * 60 | 0)},${210 + (rnd() * 40 | 0)},255,${0.14 + rnd() * 0.5})`;
    c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
  }
  // faint aurora ribbons
  for (let i = 0; i < 3; i++) {
    c.beginPath();
    for (let x = -20; x <= W + 20; x += 16) {
      const y = 100 + i * 46 + Math.sin(x * 0.004 + i * 1.7) * 24;
      if (x < 0) c.moveTo(x, y); else c.lineTo(x, y);
    }
    c.strokeStyle = `rgba(96,200,190,${0.035 + i * 0.012})`;
    c.lineWidth = 18; c.stroke();
  }
  return cv;
}

function makeMoon() {
  const cv = document.createElement('canvas'); cv.width = 260; cv.height = 260;
  const c = cv.getContext('2d');
  const g = c.createRadialGradient(130, 130, 24, 130, 130, 128);
  g.addColorStop(0, 'rgba(230,250,225,0.95)');
  g.addColorStop(0.28, 'rgba(190,235,210,0.5)');
  g.addColorStop(0.62, 'rgba(120,200,190,0.13)');
  g.addColorStop(1, 'rgba(80,150,160,0)');
  c.fillStyle = g; c.fillRect(0, 0, 260, 260);
  c.beginPath(); c.arc(130, 130, 43, 0, 7);
  c.fillStyle = '#d8eeda'; c.fill();
  c.globalAlpha = 0.22; c.fillStyle = '#9cc8b8';
  for (const [x, y, r] of [[116, 116, 10], [145, 138, 7], [126, 150, 5], [146, 110, 4]]) {
    c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
  }
  c.globalAlpha = 1;
  return cv;
}

function makeRidge(width, seed, baseY, amp, color, alpha, peaks) {
  const cv = document.createElement('canvas'); cv.width = width; cv.height = H;
  const c = cv.getContext('2d');
  const rnd = rngFrom(seed);
  c.beginPath();
  c.moveTo(0, H);
  let x = 0;
  const pts = [];
  while (x < width + 60) {
    const step = 40 + rnd() * 90;
    const y = baseY - Math.abs(Math.sin(x * 0.004 + seed) * amp) - rnd() * amp * 0.7;
    pts.push([x, y]);
    x += step;
  }
  c.lineTo(0, pts[0][1]);
  for (const p of pts) c.lineTo(p[0], p[1]);
  // jagged spires
  for (let i = 1; i < pts.length; i++) {
    if (rnd() < 0.35) {
      const [px, py] = pts[i];
      c.lineTo(px + 10, py - peaks * (0.4 + rnd() * 0.8));
      c.lineTo(px + 26, py + 12);
    }
  }
  c.lineTo(width, H);
  c.closePath();
  const g = c.createLinearGradient(0, baseY - amp, 0, H);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(5,8,18,0.98)');
  c.globalAlpha = alpha; c.fillStyle = g; c.fill();
  c.globalAlpha = 1;
  // rim light
  c.beginPath();
  pts.forEach((p, i) => { if (i) c.lineTo(p[0], p[1]); else c.moveTo(p[0], p[1]); });
  c.strokeStyle = 'rgba(120,170,210,0.10)'; c.lineWidth = 2; c.stroke();
  return cv;
}

function makeHaze() {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  const g = c.createLinearGradient(0, H * 0.42, 0, H);
  g.addColorStop(0, 'rgba(30,60,100,0)');
  g.addColorStop(0.5, 'rgba(35,70,110,0.15)');
  g.addColorStop(1, 'rgba(16,30,55,0.35)');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  return cv;
}

export function makeRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const sky = makeSky(), moon = makeMoon(), haze = makeHaze();
  const ridgeFar = makeRidge(2048, 11, 520, 80, '#14233f', 0.85, 70);
  const ridgeNear = makeRidge(2048, 29, 610, 70, '#0d1830', 0.95, 110);
  const stars = (() => {
    const r = rngFrom(123), a = [];
    for (let i = 0; i < 90; i++) a.push({ x: r() * W, y: r() * 300, p: r() * 6.28, s: 0.5 + r() * 1.1 });
    return a;
  })();
  let viewScale = 1, viewOX = 0, viewOY = 0, DPR = 1;

  function resize() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(innerWidth * DPR);
    canvas.height = Math.round(innerHeight * DPR);
    canvas.style.width = innerWidth + 'px';
    canvas.style.height = innerHeight + 'px';
    const sc = Math.min(innerWidth / W, innerHeight / H);
    viewScale = sc;
    viewOX = (innerWidth - W * sc) / 2;
    viewOY = (innerHeight - H * sc) / 2;
  }

  function tile(c, img, offsetY, par, camX, alpha = 1) {
    const off = -((camX * par) % img.width);
    c.globalAlpha = alpha;
    for (let x = off - img.width; x < W + img.width; x += img.width) {
      c.drawImage(img, Math.round(x), Math.round(offsetY));
    }
    c.globalAlpha = 1;
  }

  function drawBackground(c, t, camX, chapter) {
    c.drawImage(sky, 0, 0);
    // moon with slight parallax
    const mx = 1000 - (camX * 0.04) % 220;
    c.drawImage(moon, mx - 130, 40);
    // twinkle
    for (const s of stars) {
      const a = 0.25 + 0.55 * (0.5 + 0.5 * Math.sin(t * 1.4 + s.p));
      c.fillStyle = `rgba(210,240,235,${a})`;
      c.beginPath(); c.arc(s.x - (camX * 0.02) % W, s.y, s.s, 0, 7); c.fill();
    }
    tile(c, ridgeFar, 40, 0.16, camX, 0.9);
    tile(c, ridgeNear, -10, 0.34, camX, 0.95);
    c.drawImage(haze, 0, 0);
    // drifting fog bands
    for (let i = 0; i < 4; i++) {
      const y = 330 + i * 78 + Math.sin(t * 0.3 + i) * 8;
      const x = -((t * (7 + i * 3) + camX * 0.2) % (W + 400));
      const g = c.createLinearGradient(x, y, x + 620, y);
      g.addColorStop(0, 'rgba(120,170,200,0)');
      g.addColorStop(0.5, `rgba(120,170,200,${0.035 + i * 0.012})`);
      g.addColorStop(1, 'rgba(120,170,200,0)');
      c.fillStyle = g;
      c.fillRect(x, y, 620, 26 + i * 8);
      c.fillStyle = g; c.fillRect(x - W - 200, y, 620, 26 + i * 8);
    }
    // canyon depth glow at bottom
    const dg = c.createLinearGradient(0, H * 0.6, 0, H);
    dg.addColorStop(0, 'rgba(10,20,40,0)');
    dg.addColorStop(1, 'rgba(3,6,14,0.92)');
    c.fillStyle = dg; c.fillRect(0, 0, W, H);
  }

  function drawPlatform(c, p, camX, camY, t, seed) {
    const x = p.x - camX, y = p.y - camY;
    if (x + p.w < -80 || x > W + 80) return;
    const r = rngFrom(seed + p.x * 3);
    // body
    const g = c.createLinearGradient(0, y, 0, y + p.h);
    g.addColorStop(0, '#1a2b4c');
    g.addColorStop(0.18, '#122039');
    g.addColorStop(1, '#070d1a');
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(x, y);
    // serrated top edge
    let px = x;
    c.lineTo(px, y);
    while (px < x + p.w) {
      const nx = Math.min(x + p.w, px + 22 + r() * 40);
      c.lineTo(nx, y + (r() - 0.5) * 4);
      px = nx;
    }
    c.lineTo(x + p.w, y + p.h);
    c.lineTo(x, y + p.h);
    c.closePath(); c.fill();
    // rim
    c.strokeStyle = 'rgba(224,164,90,0.55)'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(x, y + 1); c.lineTo(x + p.w, y + 1); c.stroke();
    c.strokeStyle = 'rgba(111,227,196,0.16)'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(x + 4, y + 5); c.lineTo(x + p.w - 4, y + 5); c.stroke();
    // cracks
    for (let i = 0; i < 7; i++) {
      let cx = x + 12 + r() * (p.w - 24), cy = y + 12 + r() * (p.h - 24);
      c.strokeStyle = `rgba(120,160,200,${0.06 + r() * 0.08})`;
      c.lineWidth = 1; c.beginPath(); c.moveTo(cx, cy);
      for (let k = 0; k < 3; k++) { cx += (r() - 0.5) * 26; cy += 8 + r() * 16; c.lineTo(cx, cy); }
      c.stroke();
    }
    // hanging threads / vines
    for (let i = 0; i < 3; i++) {
      const vx = x + 20 + r() * (p.w - 40);
      c.strokeStyle = 'rgba(111,227,196,0.12)'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(vx, y);
      c.bezierCurveTo(vx + 8, y + 22, vx - 6, y + 40, vx + 3, y + 62);
      c.stroke();
    }
    // lantern on the start/exit ledges
    if (x > -60 && x < W + 60) {
      const lx = x + 34, ly = y - 18;
      const lg = c.createRadialGradient(lx, ly, 1, lx, ly, 34);
      lg.addColorStop(0, 'rgba(255,190,100,0.55)');
      lg.addColorStop(1, 'rgba(255,150,60,0)');
      c.fillStyle = lg; c.beginPath(); c.arc(lx, ly, 34, 0, 7); c.fill();
      c.fillStyle = 'rgba(255,190,110,0.85)';
      roundRect(c, lx - 5, ly - 9, 10, 15, 3); c.fill();
      c.strokeStyle = 'rgba(224,164,90,0.7)'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(lx, ly - 9); c.lineTo(lx, y); c.stroke();
    }
  }

  function drawSpike(c, s, camX, camY) {
    const x = s.x - camX, y = s.y - camY;
    if (x + s.w < -40 || x > W + 40) return;
    const n = Math.max(3, Math.round(s.w / 18));
    const step = s.w / n;
    c.beginPath();
    if (s.hang) {
      c.moveTo(x, y);
      for (let i = 0; i < n; i++) {
        c.lineTo(x + step * (i + 0.5), y + s.h);
        c.lineTo(x + step * (i + 1), y);
      }
      c.lineTo(x + s.w, y - 8);
      c.lineTo(x, y - 8);
    } else {
      c.moveTo(x, y + s.h);
      for (let i = 0; i < n; i++) {
        c.lineTo(x + step * (i + 0.5), y);
        c.lineTo(x + step * (i + 1), y + s.h);
      }
    }
    c.closePath();
    const g = c.createLinearGradient(0, y, 0, y + s.h);
    g.addColorStop(0, C.vermHi); g.addColorStop(1, C.vermDim);
    c.fillStyle = g; c.fill();
    c.strokeStyle = 'rgba(255,150,110,0.55)'; c.lineWidth = 1; c.stroke();
    // glow at the base
    c.fillStyle = 'rgba(227,93,76,0.18)';
    c.fillRect(x, s.hang ? y : y + s.h - 4, s.w, 4);
  }

  function drawWind(c, w, camX, camY, t) {
    const x = w.x - camX, y = w.y - camY;
    if (x + w.w < -40 || x > W + 40) return;
    const dir = Math.sign(w.vx) || 1;
    c.save();
    c.beginPath(); c.rect(x, y, w.w, w.h); c.clip();
    // soft core, no hard rectangular fill
    const cx = x + w.w / 2, cy = y + w.h / 2;
    const g0 = c.createRadialGradient(cx, cy, 20, cx, cy, Math.max(w.w, w.h) * 0.58);
    g0.addColorStop(0, 'rgba(140,220,225,0.09)');
    g0.addColorStop(0.65, 'rgba(140,220,225,0.035)');
    g0.addColorStop(1, 'rgba(140,220,225,0)');
    c.fillStyle = g0; c.fillRect(x, y, w.w, w.h);
    for (let i = 0; i < 14; i++) {
      const yy = y + ((i * 47 + t * 34 * (0.5 + (i % 3) * 0.2)) % w.h + w.h) % w.h;
      const xx = x + ((i * 83 + t * Math.abs(w.vx) * 0.55 * dir + w.w) % (w.w + 160)) - 80;
      const len = 40 + (i % 5) * 26;
      const g = c.createLinearGradient(xx, yy, xx + len * dir, yy);
      g.addColorStop(0, 'rgba(150,235,225,0)');
      g.addColorStop(0.45, 'rgba(150,235,225,0.24)');
      g.addColorStop(1, 'rgba(150,235,225,0)');
      c.strokeStyle = g; c.lineWidth = 1.4;
      c.beginPath(); c.moveTo(xx, yy); c.lineTo(xx + len * dir, yy + 3); c.stroke();
      if (i % 4 === 0) {
        const ax = xx + len * 0.55 * dir, ay = yy + 1.6;
        c.strokeStyle = 'rgba(170,245,235,0.30)'; c.lineWidth = 1.3;
        c.beginPath(); c.moveTo(ax - 5 * dir, ay - 4); c.lineTo(ax, ay); c.lineTo(ax - 5 * dir, ay + 4); c.stroke();
      }
    }
    c.restore();
    // dashed edge markers fade toward the corners
    c.save();
    c.setLineDash([6, 16]); c.lineDashOffset = -t * 30 * dir;
    c.strokeStyle = 'rgba(140,225,220,0.16)'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(x, y + 20); c.lineTo(x, y + w.h - 20);
    c.moveTo(x + w.w, y + 20); c.lineTo(x + w.w, y + w.h - 20); c.stroke();
    c.restore();
  }

  function drawAnchor(c, a, t, physT, camX, camY, candidate, chapter) {
    const ap = anchorPos(a, physT);
    const x = ap.x - camX, y = ap.y - camY;
    const bx = a.x - camX, by = a.y - camY;
    if (x < -100 || x > W + 100) return;
    if (a.type === 'moving' && !a.broken) {
      // orbit track at the resting point, current ring follows the live anchor
      c.strokeStyle = 'rgba(224,164,90,0.13)'; c.lineWidth = 1;
      c.beginPath(); c.ellipse(bx, by, a.ampX + 12, a.ampY + 8, 0, 0, 7); c.stroke();
      c.strokeStyle = 'rgba(224,164,90,0.35)'; c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(bx, by); c.lineTo(x, y); c.stroke();
      c.fillStyle = 'rgba(255,217,154,0.35)';
      c.beginPath(); c.arc(bx, by, 3, 0, 7); c.fill();
    }
    const broken = a.broken;
    const r = 15;
    // glow
    if (!broken) {
      const gg = c.createRadialGradient(x, y, 2, x, y, candidate ? 46 : 30);
      gg.addColorStop(0, a.type === 'fragile' ? 'rgba(180,240,220,0.45)' : 'rgba(255,205,120,0.5)');
      gg.addColorStop(1, 'rgba(255,180,80,0)');
      c.fillStyle = gg; c.beginPath(); c.arc(x, y, candidate ? 46 : 30, 0, 7); c.fill();
    }
    // ring
    c.lineWidth = 3;
    c.strokeStyle = broken ? 'rgba(110,120,140,0.35)' : (a.type === 'fragile' ? '#b9e6d4' : C.copper);
    c.beginPath(); c.arc(x, y, r, 0, 7); c.stroke();
    c.lineWidth = 1;
    c.strokeStyle = broken ? 'rgba(110,120,140,0.25)' : 'rgba(255,230,180,0.75)';
    c.beginPath(); c.arc(x, y, r - 4, 0, 7); c.stroke();
    // inner pin
    c.fillStyle = broken ? '#3c465c' : (a.type === 'fragile' ? C.jadeHi : C.copperHi);
    c.beginPath(); c.arc(x, y, 3.4, 0, 7); c.fill();
    // fragile cracks / timer
    if (a.type === 'fragile' && !broken) {
      c.strokeStyle = 'rgba(120,230,200,0.8)'; c.lineWidth = 1.2;
      c.beginPath(); c.moveTo(x - 8, y - 10); c.lineTo(x - 3, y - 2); c.lineTo(x - 9, y + 6); c.stroke();
      if (a.fragT > 0) {
        const f = Math.max(0, Math.min(1, a.fragT / 2.6));
        c.strokeStyle = f > 0.4 ? 'rgba(111,227,196,0.85)' : 'rgba(227,93,76,0.95)';
        c.lineWidth = 2;
        c.beginPath(); c.arc(x, y, r + 6, -Math.PI / 2, -Math.PI / 2 + f * Math.PI * 2); c.stroke();
      }
    }
    if (a.type === 'moving' && !broken) {
      for (let i = 0; i < 3; i++) {
        const ang = t * 1.4 + i * 2.09;
        c.fillStyle = 'rgba(255,217,154,0.7)';
        c.beginPath(); c.arc(x + Math.cos(ang) * (r + 8), y + Math.sin(ang) * (r + 8), 2, 0, 7); c.fill();
      }
    }
    if (candidate && !broken) {
      const pulse = 0.5 + 0.5 * Math.sin(t * 6);
      c.strokeStyle = `rgba(182,255,232,${0.25 + pulse * 0.4})`; c.lineWidth = 1.5;
      c.setLineDash([4, 6]); c.lineDashOffset = -t * 24;
      c.beginPath(); c.arc(x, y, 24 + pulse * 4, 0, 7); c.stroke();
      c.setLineDash([]);
    }
    // hanging bar above the resting point
    const hx = a.type === 'moving' ? bx : x, hy = a.type === 'moving' ? by : y;
    c.strokeStyle = 'rgba(224,164,90,0.5)'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(hx, hy - r); c.lineTo(hx, hy - 52); c.stroke();
    c.fillStyle = 'rgba(224,164,90,0.5)';
    c.fillRect(hx - 12, hy - 56, 24, 5);
  }

  function drawGate(c, g, t, camX, camY, progress) {
    const x = g.x - camX, y = g.y - camY;
    const hw = g.w / 2, hh = g.h / 2;
    if (x < -160 || x > W + 160) return;
    // aura
    const ag = c.createRadialGradient(x, y, 10, x, y, hh * 0.95);
    ag.addColorStop(0, 'rgba(255,150,100,0.20)');
    ag.addColorStop(0.6, 'rgba(227,93,76,0.10)');
    ag.addColorStop(1, 'rgba(227,93,76,0)');
    c.fillStyle = ag; c.beginPath(); c.ellipse(x, y, hw * 1.5, hh * 0.95, 0, 0, 7); c.fill();
    // portal interior
    c.save();
    c.beginPath();
    c.moveTo(x - hw + 6, y + hh);
    c.lineTo(x - hw + 6, y - hh + 40);
    c.quadraticCurveTo(x, y - hh - 24, x + hw - 6, y - hh + 40);
    c.lineTo(x + hw - 6, y + hh);
    c.closePath();
    const pg = c.createLinearGradient(x, y - hh, x, y + hh);
    pg.addColorStop(0, 'rgba(40,24,50,0.92)');
    pg.addColorStop(0.55, 'rgba(58,28,46,0.94)');
    pg.addColorStop(1, 'rgba(20,12,26,0.96)');
    c.fillStyle = pg; c.fill();
    c.clip();
    // swirling stars inside
    for (let i = 0; i < 26; i++) {
      const ang = i * 2.4 + t * (0.3 + (i % 5) * 0.1);
      const rr = 8 + (i * 7) % 48;
      const sx = x + Math.cos(ang) * rr, sy = y - 10 + Math.sin(ang * 1.3) * 80;
      c.fillStyle = `rgba(255,${190 + (i % 3) * 20},${140 + (i % 4) * 20},${0.3 + (i % 5) * 0.12})`;
      c.beginPath(); c.arc(sx, sy, 1 + (i % 3) * 0.7, 0, 7); c.fill();
    }
    // vertical light bands
    for (let i = 0; i < 3; i++) {
      const bx = x - hw + 20 + i * (hw * 2 - 40) / 2;
      c.fillStyle = `rgba(255,170,110,${0.05 + 0.03 * Math.sin(t * 1.7 + i)})`;
      c.fillRect(bx - 3, y - hh, 6, hh * 2);
    }
    c.restore();
    // arch frame
    c.lineWidth = 6; c.strokeStyle = C.vermDim;
    c.beginPath();
    c.moveTo(x - hw, y + hh + 6);
    c.lineTo(x - hw, y - hh + 40);
    c.quadraticCurveTo(x, y - hh - 30, x + hw, y - hh + 40);
    c.lineTo(x + hw, y + hh + 6);
    c.stroke();
    c.lineWidth = 2; c.strokeStyle = C.vermHi;
    c.beginPath();
    c.moveTo(x - hw + 5, y + hh + 6);
    c.lineTo(x - hw + 5, y - hh + 42);
    c.quadraticCurveTo(x, y - hh - 22, x + hw - 5, y - hh + 42);
    c.lineTo(x + hw - 5, y + hh + 6);
    c.stroke();
    // keystone
    c.save();
    c.translate(x, y - hh + 12);
    c.rotate(Math.PI / 4);
    c.fillStyle = C.copper;
    c.fillRect(-7, -7, 14, 14);
    c.strokeStyle = C.copperHi; c.lineWidth = 1; c.strokeRect(-7, -7, 14, 14);
    c.restore();
    // base plinths
    for (const s of [-1, 1]) {
      c.fillStyle = '#2a1a2a';
      c.fillRect(x + s * hw - 16, y + hh - 4, 32, 18);
      c.strokeStyle = 'rgba(227,93,76,0.6)'; c.lineWidth = 1;
      c.strokeRect(x + s * hw - 16, y + hh - 4, 32, 18);
    }
    // label glow
    c.fillStyle = `rgba(255,190,140,${0.55 + 0.2 * Math.sin(t * 2.4)})`;
    c.font = '600 12px "Microsoft YaHei", sans-serif';
    c.textAlign = 'center';
    c.fillText('星 门', x, y + hh + 38);
  }

  function drawShard(c, sh, t, camX, camY) {
    if (sh.got) return;
    const x = sh.x - camX, y = sh.y - camY + Math.sin(t * 2.2 + sh.x * 0.01) * 4;
    if (x < -40 || x > W + 40) return;
    const pulse = 0.75 + 0.25 * Math.sin(t * 3.2 + sh.x * 0.02);
    const g = c.createRadialGradient(x, y, 1, x, y, 26 * pulse);
    g.addColorStop(0, 'rgba(182,255,232,0.5)');
    g.addColorStop(1, 'rgba(111,227,196,0)');
    c.fillStyle = g; c.beginPath(); c.arc(x, y, 26 * pulse, 0, 7); c.fill();
    c.save(); c.translate(x, y); c.rotate(t * 1.4);
    drawStar(c, 0, 0, 11, 3, 0.42, -Math.PI / 2);
    c.fillStyle = C.jadeHi; c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 1; c.stroke();
    c.restore();
  }

  function drawCheckpoint(c, cp, camX, camY, t, active) {
    const x = cp.x - camX, y = cp.y - camY;
    if (x < -60 || x > W + 60) return;
    // hanging knot ribbon
    c.strokeStyle = active ? 'rgba(111,227,196,0.8)' : 'rgba(111,227,196,0.24)';
    c.lineWidth = 2;
    c.beginPath(); c.moveTo(x, y - 58); c.lineTo(x, y - 16); c.stroke();
    const gg = c.createRadialGradient(x, y, 1, x, y, active ? 40 : 22);
    gg.addColorStop(0, active ? 'rgba(111,227,196,0.55)' : 'rgba(111,227,196,0.18)');
    gg.addColorStop(1, 'rgba(111,227,196,0)');
    c.fillStyle = gg; c.beginPath(); c.arc(x, y, active ? 40 : 22, 0, 7); c.fill();
    c.fillStyle = active ? C.jadeHi : 'rgba(111,227,196,0.45)';
    roundRect(c, x - 5, y - 12, 10, 18, 3); c.fill();
    if (active) {
      c.strokeStyle = `rgba(182,255,232,${0.4 + 0.3 * Math.sin(t * 4)})`;
      c.lineWidth = 1.2;
      c.beginPath(); c.arc(x, y - 3, 17, 0, 7); c.stroke();
    }
  }

  function drawSilk(c, pl, a, t, camX, camY) {
    const live = anchorPos(a, pl.t);
    const ax = live.x - camX, ay = live.y - camY;
    const px = pl.x - camX, py = pl.y - camY;
    const dx = px - ax, dy = py - ay, len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    // glow underlay
    c.strokeStyle = 'rgba(111,227,196,0.16)'; c.lineWidth = 7;
    c.beginPath(); c.moveTo(ax, ay); c.lineTo(px, py); c.stroke();
    // silk with a faint shimmer curve
    c.strokeStyle = 'rgba(150,245,220,0.9)'; c.lineWidth = 2;
    c.beginPath();
    const seg = 12;
    for (let i = 0; i <= seg; i++) {
      const f = i / seg;
      const bow = Math.sin(f * Math.PI) * Math.sin(t * 8 + f * 6) * 2.2;
      const x = ax + dx * f + nx * bow, y = ay + dy * f + ny * bow;
      if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
    }
    c.stroke();
    // small silk motes along the line
    for (let i = 1; i < 4; i++) {
      const f = ((t * 0.5 + i * 0.24) % 1);
      const x = ax + dx * f, y = ay + dy * f;
      c.fillStyle = 'rgba(200,255,238,0.8)';
      c.beginPath(); c.arc(x, y, 1.4, 0, 7); c.fill();
    }
  }

  function drawTrail(c, trail, camX, camY) {
    for (let i = 0; i < trail.length; i++) {
      const p = trail[i];
      const f = i / trail.length;
      c.fillStyle = `rgba(111,227,196,${0.05 + f * 0.22})`;
      c.beginPath(); c.arc(p.x - camX, p.y - camY, 1.5 + f * 4, 0, 7); c.fill();
    }
  }

  function drawPlayer(c, pl, t, camX, camY) {
    const x = pl.x - camX, y = pl.y - camY;
    const vx = pl.vx, vy = pl.vy;
    const speed = Math.hypot(vx, vy);
    const ang = Math.atan2(vy, vx);
    // lantern aura
    const g = c.createRadialGradient(x, y, 2, x, y, 52);
    g.addColorStop(0, 'rgba(255,196,110,0.34)');
    g.addColorStop(1, 'rgba(255,160,70,0)');
    c.fillStyle = g; c.beginPath(); c.arc(x, y, 52, 0, 7); c.fill();
    // scarf ribbon following velocity
    c.strokeStyle = 'rgba(227,93,76,0.65)'; c.lineWidth = 4; c.lineCap = 'round';
    c.beginPath();
    c.moveTo(x, y - 2);
    for (let i = 1; i <= 4; i++) {
      const f = i / 4;
      c.lineTo(x - vx * 0.035 * f + Math.sin(t * 9 + i) * 7 * f,
        y - vy * 0.02 * f + Math.cos(t * 7 + i) * 6 * f + 4);
    }
    c.stroke();
    c.lineCap = 'butt';
    // cloak
    c.save(); c.translate(x, y);
    const lean = Math.max(-0.5, Math.min(0.5, vx / 1400));
    c.rotate(lean * 0.35);
    c.fillStyle = '#19233d';
    c.beginPath();
    c.moveTo(-13, 14);
    c.quadraticCurveTo(-15, -8, 0, -14);
    c.quadraticCurveTo(15, -8, 13, 14);
    c.quadraticCurveTo(0, 20, -13, 14);
    c.closePath(); c.fill();
    c.strokeStyle = 'rgba(224,164,90,0.55)'; c.lineWidth = 1.4; c.stroke();
    // hood
    c.fillStyle = '#0e1730';
    c.beginPath(); c.arc(0, -13, 8.5, 0, 7); c.fill();
    c.strokeStyle = 'rgba(224,164,90,0.8)'; c.lineWidth = 1.2; c.stroke();
    // face glow
    c.fillStyle = 'rgba(255,220,170,0.85)';
    c.beginPath(); c.arc(0, -13, 4.6, 0, 7); c.fill();
    // lantern at chest
    const lg = c.createRadialGradient(0, 1, 1, 0, 1, 16);
    lg.addColorStop(0, 'rgba(255,220,150,0.95)');
    lg.addColorStop(0.45, 'rgba(255,170,80,0.8)');
    lg.addColorStop(1, 'rgba(255,140,60,0)');
    c.fillStyle = lg; c.beginPath(); c.arc(0, 1, 15, 0, 7); c.fill();
    c.fillStyle = C.paper; roundRect(c, -3.5, -3, 7, 9, 2); c.fill();
    // legs
    c.strokeStyle = '#26344f'; c.lineWidth = 3;
    c.beginPath(); c.moveTo(-5, 14); c.lineTo(-7, 22); c.moveTo(5, 14); c.lineTo(7, 22); c.stroke();
    c.restore();
    // motion streaks
    if (speed > 500) {
      c.strokeStyle = `rgba(182,255,232,${Math.min(0.35, speed / 4000)})`;
      c.lineWidth = 1.2;
      for (let i = 0; i < 3; i++) {
        const back = 18 + i * 14;
        c.beginPath();
        c.moveTo(x - vx / speed * back + (i - 1) * 6, y - vy / speed * back + (i - 1) * 6);
        c.lineTo(x - vx / speed * (back + 14) + (i - 1) * 6, y - vy / speed * (back + 14) + (i - 1) * 6);
        c.stroke();
      }
    }
  }

  function drawParticles(c, parts, camX, camY) {
    for (const p of parts) {
      const a = Math.max(0, p.life / p.maxLife);
      const x = p.x - camX, y = p.y - camY;
      if (p.kind === 'line') {
        c.strokeStyle = p.color; c.globalAlpha = a; c.lineWidth = p.size;
        c.beginPath(); c.moveTo(x, y); c.lineTo(x - p.vx * 0.03, y - p.vy * 0.03); c.stroke();
      } else {
        c.fillStyle = p.color; c.globalAlpha = a;
        c.beginPath(); c.arc(x, y, p.size * (0.4 + a * 0.6), 0, 7); c.fill();
      }
    }
    c.globalAlpha = 1;
  }

  function drawFloats(c, floats, camX, camY) {
    c.textAlign = 'center';
    for (const f of floats) {
      const a = Math.max(0, f.life / f.maxLife);
      c.globalAlpha = a;
      c.fillStyle = f.color || '#ffe8c2';
      c.font = `600 ${f.size || 16}px "Microsoft YaHei", sans-serif`;
      c.fillText(f.text, f.x - camX, f.y - camY);
    }
    c.globalAlpha = 1;
  }

  function drawVignette(c, danger) {
    const g = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.32, W / 2, H / 2, Math.max(W, H) * 0.72);
    g.addColorStop(0, 'rgba(4,8,16,0)');
    g.addColorStop(1, 'rgba(4,8,16,0.55)');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    if (danger > 0) {
      c.fillStyle = `rgba(180,40,30,${danger * 0.22})`; c.fillRect(0, 0, W, H);
    }
    // film grain-ish paper lines
    c.globalAlpha = 0.035; c.strokeStyle = '#cfe0ff'; c.lineWidth = 1;
    for (let y = 0; y < H; y += 4) {
      c.beginPath(); c.moveTo(0, y + 0.5); c.lineTo(W, y + 0.5); c.stroke();
    }
    c.globalAlpha = 1;
  }

  function draw(v) {
    const { level, player, camX, camY, time, particles, floats, trail, shake,
      candidate, danger = 0, paused = false } = v;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    // letterbox
    ctx.save();
    ctx.translate(viewOX, viewOY);
    ctx.scale(viewScale, viewScale);
    ctx.save();
    const sx = shake ? (Math.random() - 0.5) * shake : 0;
    const sy = shake ? (Math.random() - 0.5) * shake : 0;
    ctx.translate(sx, sy);

    drawBackground(ctx, time, camX, level.chapter);
    // world layers
    for (const w of level.winds) drawWind(ctx, w, camX, camY, time);
    for (const p of level.platforms) drawPlatform(ctx, p, camX, camY, time, 31 + level.id * 7);
    for (const s of level.spikes) drawSpike(ctx, s, camX, camY);
    for (const cp of level.checkpoints) drawCheckpoint(ctx, cp, camX, camY, time, cp.active);
    drawGate(ctx, level.gate, time, camX, camY, 0);
    drawTrail(ctx, trail, camX, camY);
    // anchors (with their hanging pins)
    for (let i = 0; i < level.anchors.length; i++) {
      drawAnchor(ctx, level.anchors[i], time, player.t, camX, camY, i === candidate, level.chapter);
    }
    if (player.anchor >= 0) drawSilk(ctx, player, level.anchors[player.anchor], time, camX, camY);
    for (const sh of level.shards) drawShard(ctx, sh, time, camX, camY);
    drawPlayer(ctx, player, time, camX, camY);
    drawParticles(ctx, particles, camX, camY);
    drawFloats(ctx, floats, camX, camY);
    drawVignette(ctx, danger);
    ctx.restore();               // end shake
    ctx.restore();               // end game-view transform
    // letterbox bars in physical pixels (portrait center band / ultrawide)
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.fillStyle = '#05070e';
    if (viewOY > 0.5) {
      ctx.fillRect(0, 0, innerWidth, viewOY);
      ctx.fillRect(0, innerHeight - viewOY, innerWidth, viewOY);
    }
    if (viewOX > 0.5) {
      ctx.fillRect(0, 0, viewOX, innerHeight);
      ctx.fillRect(innerWidth - viewOX, 0, viewOX, innerHeight);
    }
    if (paused) {
      ctx.fillStyle = 'rgba(4,8,16,0.35)';
      ctx.fillRect(viewOX, viewOY, W * viewScale, H * viewScale);
    }
  }

  return { resize, draw, W, H, view: () => ({ scale: viewScale, ox: viewOX, oy: viewOY }) };
}
