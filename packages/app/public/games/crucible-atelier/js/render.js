// Crucible Atelier — procedural canvas art: workshop scene, crucible, fire,
// bubbles/steam/embers and item icons. No images, no external fonts.

// ---------------------------------------------------------------- colour utils
function parseHex(h) {
  const s = String(h || '#888888').replace('#', '');
  const n = s.length === 3
    ? s.split('').map(x => x + x).join('')
    : s.padEnd(6, '8').slice(0, 6);
  return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)];
}
export function shade(hex, amt) {
  const [r, g, b] = parseHex(hex);
  const f = (v) => Math.max(0, Math.min(255, Math.round(amt >= 0 ? v + (255 - v) * amt : v * (1 + amt))));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}
function rgba(hex, a) {
  const [r, g, b] = parseHex(hex);
  return `rgba(${r},${g},${b},${a})`;
}
function lg(c, x0, y0, x1, y1, stops) {
  const g = c.createLinearGradient(x0, y0, x1, y1);
  for (const [p, col] of stops) g.addColorStop(p, col);
  return g;
}
function rg(c, x, y, r0, r1, stops) {
  const g = c.createRadialGradient(x, y, r0, x, y, r1);
  for (const [p, col] of stops) g.addColorStop(p, col);
  return g;
}

// ---------------------------------------------------------------- item icons
// Every icon is drawn in a 64×64 local space. Colours vary per item so a card
// stays recognisable even at 40px.
function iconDrop(c, col) {
  c.beginPath();
  c.moveTo(32, 6);
  c.bezierCurveTo(44, 22, 52, 32, 52, 42);
  c.bezierCurveTo(52, 53, 43, 59, 32, 59);
  c.bezierCurveTo(21, 59, 12, 53, 12, 42);
  c.bezierCurveTo(12, 32, 20, 22, 32, 6);
  c.closePath();
  c.fillStyle = lg(c, 20, 8, 46, 58, [[0, shade(col, 0.42)], [0.5, col], [1, shade(col, -0.34)]]);
  c.fill();
  c.strokeStyle = 'rgba(8,10,26,.55)'; c.lineWidth = 2; c.stroke();
  c.beginPath(); c.ellipse(26, 34, 5, 9, -0.5, 0, Math.PI * 2);
  c.fillStyle = 'rgba(255,255,255,.55)'; c.fill();
}

function iconCloud(c, col) {
  c.fillStyle = lg(c, 8, 20, 56, 56, [[0, shade(col, 0.34)], [1, shade(col, -0.2)]]);
  c.strokeStyle = 'rgba(8,10,26,.42)'; c.lineWidth = 2;
  const puffs = [[22, 40, 14], [35, 32, 17], [47, 41, 12], [30, 45, 13]];
  c.beginPath();
  for (const [x, y, r] of puffs) { c.moveTo(x + r, y); c.arc(x, y, r, 0, Math.PI * 2); }
  c.fill(); c.stroke();
  c.fillStyle = 'rgba(255,255,255,.28)';
  c.beginPath(); c.ellipse(31, 28, 12, 6, -0.3, 0, Math.PI * 2); c.fill();
}

function iconMud(c, col) {
  c.beginPath();
  c.moveTo(12, 44);
  c.bezierCurveTo(10, 30, 20, 24, 27, 27);
  c.bezierCurveTo(32, 18, 47, 19, 50, 29);
  c.bezierCurveTo(60, 33, 58, 48, 50, 54);
  c.bezierCurveTo(38, 61, 18, 58, 12, 44);
  c.closePath();
  c.fillStyle = lg(c, 10, 20, 56, 58, [[0, shade(col, 0.26)], [1, shade(col, -0.3)]]);
  c.fill(); c.strokeStyle = 'rgba(8,10,26,.5)'; c.lineWidth = 2; c.stroke();
  c.fillStyle = 'rgba(255,255,255,.18)';
  for (const [x, y, r] of [[24, 36, 2.5], [36, 31, 2], [43, 44, 3], [28, 48, 1.8]]) {
    c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
  }
}

function iconCoal(c, col) {
  c.beginPath();
  c.moveTo(16, 46); c.lineTo(22, 24); c.lineTo(38, 14); c.lineTo(53, 28); c.lineTo(50, 48); c.lineTo(30, 56);
  c.closePath();
  c.fillStyle = lg(c, 18, 16, 50, 54, [[0, shade(col, 0.3)], [1, shade(col, -0.3)]]);
  c.fill(); c.strokeStyle = 'rgba(8,10,26,.6)'; c.lineWidth = 2; c.stroke();
  c.strokeStyle = 'rgba(255,255,255,.22)'; c.lineWidth = 1.4;
  c.beginPath(); c.moveTo(24, 28); c.lineTo(35, 34); c.lineTo(47, 30); c.stroke();
  c.beginPath(); c.moveTo(32, 48); c.lineTo(40, 37); c.stroke();
}

function iconFlame(c, col) {
  c.beginPath();
  c.moveTo(32, 6);
  c.bezierCurveTo(41, 20, 50, 26, 49, 40);
  c.bezierCurveTo(49, 53, 42, 60, 32, 60);
  c.bezierCurveTo(21, 60, 14, 53, 15, 41);
  c.bezierCurveTo(16, 30, 25, 27, 26, 16);
  c.bezierCurveTo(30, 22, 32, 26, 31, 31);
  c.bezierCurveTo(36, 27, 37, 19, 32, 6);
  c.closePath();
  c.fillStyle = lg(c, 20, 8, 46, 58, [[0, shade(col, 0.35)], [0.6, col], [1, shade(col, -0.2)]]);
  c.fill(); c.strokeStyle = 'rgba(60,16,8,.35)'; c.lineWidth = 1.6; c.stroke();
  c.beginPath();
  c.moveTo(31, 30);
  c.bezierCurveTo(38, 39, 41, 43, 40, 49);
  c.bezierCurveTo(39, 55, 36, 57, 32, 57);
  c.bezierCurveTo(27, 57, 24, 53, 25, 48);
  c.bezierCurveTo(26, 42, 30, 38, 31, 30);
  c.closePath();
  c.fillStyle = 'rgba(255,245,190,.85)'; c.fill();
}

function iconLeaf(c, col) {
  c.save(); c.translate(32, 33); c.rotate(-0.5);
  c.beginPath(); c.ellipse(0, 0, 21, 12, 0, 0, Math.PI * 2);
  c.fillStyle = lg(c, -20, -10, 20, 12, [[0, shade(col, 0.38)], [1, shade(col, -0.28)]]);
  c.fill(); c.strokeStyle = 'rgba(8,26,12,.45)'; c.lineWidth = 1.8; c.stroke();
  c.strokeStyle = 'rgba(255,255,255,.4)'; c.lineWidth = 1.4;
  c.beginPath(); c.moveTo(-17, 0); c.lineTo(17, 0); c.stroke();
  for (let i = -10; i <= 10; i += 6) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i + 5, -5); c.stroke(); }
  c.restore();
}

function iconFlask(c, col) {
  c.beginPath();
  c.moveTo(27, 8); c.lineTo(37, 8); c.lineTo(37, 24); c.lineTo(52, 50);
  c.quadraticCurveTo(55, 58, 46, 58); c.lineTo(18, 58);
  c.quadraticCurveTo(9, 58, 12, 50); c.lineTo(27, 24); c.closePath();
  c.fillStyle = 'rgba(14,18,34,.35)'; c.fill();
  c.strokeStyle = 'rgba(8,10,26,.55)'; c.lineWidth = 2; c.stroke();
  c.beginPath();
  c.moveTo(24, 37); c.lineTo(40, 37); c.lineTo(51, 55); c.lineTo(13, 55); c.closePath();
  c.fillStyle = lg(c, 14, 36, 50, 56, [[0, shade(col, 0.2)], [1, shade(col, -0.3)]]);
  c.fill();
  c.beginPath(); c.ellipse(32, 37, 8, 3, 0, 0, Math.PI * 2);
  c.fillStyle = rgba(col, 0.9); c.fill();
  c.fillStyle = 'rgba(255,255,255,.4)';
  c.beginPath(); c.ellipse(26, 46, 3, 6, 0.2, 0, Math.PI * 2); c.fill();
  c.fillStyle = shade(col, 0.35);
  c.fillRect(26, 5, 12, 4);
}

function iconCrystal(c, col) {
  c.beginPath();
  c.moveTo(32, 4); c.lineTo(51, 22); c.lineTo(43, 58); c.lineTo(21, 58); c.lineTo(13, 22);
  c.closePath();
  c.fillStyle = lg(c, 14, 6, 50, 58, [[0, shade(col, 0.45)], [0.5, col], [1, shade(col, -0.3)]]);
  c.fill(); c.strokeStyle = 'rgba(8,10,26,.5)'; c.lineWidth = 2; c.stroke();
  c.strokeStyle = 'rgba(255,255,255,.45)'; c.lineWidth = 1.4;
  c.beginPath(); c.moveTo(32, 4); c.lineTo(32, 58); c.moveTo(13, 22); c.lineTo(51, 22); c.moveTo(21, 58); c.lineTo(32, 22); c.stroke();
}

function iconPowder(c, col) {
  c.beginPath();
  c.moveTo(8, 56); c.quadraticCurveTo(16, 44, 26, 46);
  c.quadraticCurveTo(32, 30, 40, 40);
  c.quadraticCurveTo(50, 43, 56, 56); c.closePath();
  c.fillStyle = lg(c, 10, 36, 52, 58, [[0, shade(col, 0.25)], [1, shade(col, -0.22)]]);
  c.fill(); c.strokeStyle = 'rgba(30,24,20,.35)'; c.lineWidth = 1.6; c.stroke();
  c.fillStyle = 'rgba(255,255,255,.42)';
  for (const [x, y, r] of [[22, 48, 2], [31, 42, 1.7], [43, 48, 2.4], [36, 53, 1.5], [49, 52, 1.3]]) {
    c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
  }
}

function iconPot(c, col) {
  c.beginPath();
  c.moveTo(12, 24);
  c.bezierCurveTo(12, 46, 20, 57, 32, 57);
  c.bezierCurveTo(44, 57, 52, 46, 52, 24);
  c.closePath();
  c.fillStyle = lg(c, 14, 24, 50, 56, [[0, shade(col, 0.26)], [1, shade(col, -0.34)]]);
  c.fill(); c.strokeStyle = 'rgba(8,10,26,.55)'; c.lineWidth = 2; c.stroke();
  c.beginPath(); c.ellipse(32, 24, 20, 6, 0, 0, Math.PI * 2);
  c.fillStyle = shade(col, 0.15); c.fill();
  c.strokeStyle = 'rgba(8,10,26,.5)'; c.lineWidth = 1.6; c.stroke();
  c.beginPath(); c.ellipse(32, 24, 14, 3.4, 0, 0, Math.PI * 2);
  c.fillStyle = rgba('#7ad8ff', 0.5); c.fill();
  c.strokeStyle = shadedStroke(col);
  c.lineWidth = 2.6;
  c.beginPath(); c.arc(10, 34, 7, 1.2, 4.4); c.stroke();
  c.beginPath(); c.arc(54, 34, 7, -1.6, 1.6); c.stroke();
  c.strokeStyle = 'rgba(255,255,255,.3)'; c.lineWidth = 1.4;
  c.beginPath(); c.moveTo(21, 52); c.quadraticCurveTo(32, 45, 43, 52); c.stroke();
  c.strokeStyle = 'rgba(230,240,255,.35)'; c.lineWidth = 2;
  for (let i = 0; i < 2; i++) {
    c.beginPath(); c.moveTo(24 + i * 12, 20);
    c.bezierCurveTo(20 + i * 12, 12, 30 + i * 12, 10, 26 + i * 12, 3); c.stroke();
  }
}
function shadedStroke(col) { return shade(col, -0.25); }

function iconBottle(c, col) {
  c.beginPath();
  c.moveTo(27, 8); c.lineTo(37, 8); c.lineTo(37, 20);
  c.bezierCurveTo(46, 25, 49, 34, 49, 42);
  c.bezierCurveTo(49, 54, 41, 59, 32, 59);
  c.bezierCurveTo(23, 59, 15, 54, 15, 42);
  c.bezierCurveTo(15, 34, 18, 25, 27, 20);
  c.closePath();
  c.fillStyle = 'rgba(12,16,32,.42)'; c.fill();
  c.strokeStyle = 'rgba(8,10,26,.55)'; c.lineWidth = 2; c.stroke();
  c.save(); c.clip();
  c.fillStyle = lg(c, 15, 28, 49, 58, [[0, shade(col, 0.28)], [1, shade(col, -0.28)]]);
  c.fillRect(15, 31, 34, 28);
  c.fillStyle = 'rgba(255,255,255,.22)'; c.fillRect(15, 31, 34, 3);
  c.restore();
  c.fillStyle = shade(col, 0.45);
  c.fillRect(25, 4, 14, 5);
  c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 1.4;
  c.beginPath(); c.moveTo(22, 38); c.quadraticCurveTo(20, 47, 24, 53); c.stroke();
}

function iconIngot(c, col) {
  c.beginPath();
  c.moveTo(10, 50); c.lineTo(17, 34); c.lineTo(47, 34); c.lineTo(54, 50); c.closePath();
  c.fillStyle = lg(c, 12, 34, 52, 50, [[0, shade(col, 0.36)], [0.55, col], [1, shade(col, -0.3)]]);
  c.fill(); c.strokeStyle = 'rgba(10,8,22,.5)'; c.lineWidth = 2; c.stroke();
  c.beginPath();
  c.moveTo(17, 32); c.lineTo(23, 18); c.lineTo(45, 18); c.lineTo(51, 32); c.closePath();
  c.fillStyle = lg(c, 20, 18, 48, 32, [[0, shade(col, 0.5)], [1, shade(col, -0.14)]]);
  c.fill(); c.strokeStyle = 'rgba(10,8,22,.45)'; c.lineWidth = 1.8; c.stroke();
  c.strokeStyle = 'rgba(255,255,255,.4)'; c.lineWidth = 1.3;
  c.beginPath(); c.moveTo(25, 22); c.lineTo(43, 22); c.stroke();
}

function iconJar(c, col) {
  c.fillStyle = lg(c, 12, 20, 52, 56, [[0, shade(col, 0.3)], [1, shade(col, -0.25)]]);
  c.beginPath();
  c.moveTo(15, 20); c.lineTo(49, 20); c.lineTo(49, 54);
  c.quadraticCurveTo(49, 58, 43, 58); c.lineTo(21, 58);
  c.quadraticCurveTo(15, 58, 15, 54); c.closePath();
  c.fill(); c.strokeStyle = 'rgba(10,8,22,.5)'; c.lineWidth = 2; c.stroke();
  c.fillStyle = shade(col, 0.38);
  c.beginPath(); c.ellipse(32, 20, 17, 5, 0, 0, Math.PI * 2); c.fill();
  c.strokeStyle = 'rgba(10,8,22,.45)'; c.lineWidth = 1.6; c.stroke();
  c.fillStyle = 'rgba(255,255,255,.38)';
  c.fillRect(24, 24, 5, 28);
  c.fillStyle = shade(col, -0.2);
  c.beginPath(); c.ellipse(32, 42, 10, 4, 0, 0, Math.PI * 2); c.fill();
}

function iconLamp(c, col) {
  const glow = rg(c, 32, 36, 2, 28, [[0, 'rgba(255,238,180,.9)'], [0.5, rgba(col, 0.42)], [1, 'rgba(255,200,90,0)']]);
  c.fillStyle = glow; c.fillRect(2, 2, 60, 60);
  c.strokeStyle = shade(col, -0.2); c.lineWidth = 3;
  c.beginPath(); c.moveTo(32, 4); c.lineTo(32, 12); c.stroke();
  c.beginPath();
  c.moveTo(20, 14); c.lineTo(44, 14); c.lineTo(48, 52); c.lineTo(16, 52); c.closePath();
  c.fillStyle = 'rgba(255,220,140,.28)'; c.fill();
  c.strokeStyle = 'rgba(90,60,30,.55)'; c.lineWidth = 2; c.stroke();
  c.fillStyle = lg(c, 24, 24, 40, 46, [[0, '#fff3c0'], [1, shade(col, -0.1)]]);
  c.beginPath(); c.ellipse(32, 36, 8, 13, 0, 0, Math.PI * 2); c.fill();
  c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = 1.2;
  c.beginPath(); c.moveTo(16, 52); c.lineTo(48, 52); c.stroke();
}

function iconOrb(c, col) {
  c.fillStyle = rg(c, 32, 30, 3, 28, [[0, '#ffffff'], [0.28, shade(col, 0.4)], [1, shade(col, -0.25)]]);
  c.beginPath(); c.arc(32, 32, 23, 0, Math.PI * 2); c.fill();
  c.strokeStyle = rgba(col, 0.6); c.lineWidth = 1.6; c.stroke();
  c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = 1.6;
  c.beginPath(); c.moveTo(32, 12); c.lineTo(32, 52); c.moveTo(12, 32); c.lineTo(52, 32); c.stroke();
  c.strokeStyle = rgba('#ffd77a', 0.85); c.lineWidth = 1.3;
  c.beginPath(); c.ellipse(32, 32, 26, 9, -0.4, 0, Math.PI * 2); c.stroke();
  c.fillStyle = 'rgba(255,255,255,.85)';
  c.beginPath(); c.arc(25, 24, 3, 0, Math.PI * 2); c.fill();
}

function iconCrucible(c, col) {
  c.fillStyle = rg(c, 32, 30, 6, 30, [[0, rgba('#7ad8ff', 0.5)], [1, 'rgba(122,216,255,0)']]);
  c.fillRect(0, 0, 64, 64);
  c.beginPath();
  c.moveTo(12, 20);
  c.bezierCurveTo(13, 42, 20, 54, 32, 54);
  c.bezierCurveTo(44, 54, 51, 42, 52, 20);
  c.closePath();
  c.fillStyle = lg(c, 14, 20, 50, 54, [[0, '#e8a86a'], [0.42, col], [1, '#6d3528']]);
  c.fill(); c.strokeStyle = 'rgba(20,8,8,.55)'; c.lineWidth = 2; c.stroke();
  c.beginPath(); c.ellipse(32, 20, 21, 6, 0, 0, Math.PI * 2);
  c.fillStyle = '#3a1e1a'; c.fill();
  c.strokeStyle = '#e8a86a'; c.lineWidth = 2; c.stroke();
  c.beginPath(); c.ellipse(32, 20, 15, 3.8, 0, 0, Math.PI * 2);
  c.fillStyle = rg(c, 32, 20, 1, 15, [[0, '#e8fbff'], [0.45, '#7ad8ff'], [1, '#2a5f9a']]);
  c.fill();
  c.strokeStyle = '#8a4a32'; c.lineWidth = 3;
  c.beginPath(); c.moveTo(18, 50); c.lineTo(15, 59); c.stroke();
  c.beginPath(); c.moveTo(46, 50); c.lineTo(49, 59); c.stroke();
  c.beginPath(); c.arc(9, 28, 7, 1.4, 4.4); c.stroke();
  c.beginPath(); c.arc(55, 28, 7, -1.8, 1.4); c.stroke();
  c.fillStyle = 'rgba(255,255,255,.45)';
  for (const [x, y, r] of [[24, 8, 1.6], [40, 6, 1.2], [50, 12, 1.4]]) {
    c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
  }
}

const SHAPES = {
  drop: iconDrop, cloud: iconCloud, mud: iconMud, coal: iconCoal, flame: iconFlame,
  leaf: iconLeaf, flask: iconFlask, crystal: iconCrystal, powder: iconPowder,
  pot: iconPot, bottle: iconBottle, ingot: iconIngot, jar: iconJar, lamp: iconLamp,
  orb: iconOrb, crucible: iconCrucible,
};

export function drawItemIcon(c, item, size) {
  if (!item) return;
  const fn = SHAPES[item.shape] || iconOrb;
  c.save();
  c.scale(size / 64, size / 64);
  fn(c, item.color || '#9fb8c8');
  c.restore();
}

export function makeIconCanvas(item, cssPx) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const px = Math.max(24, Math.round(cssPx * dpr));
  const cv = document.createElement('canvas');
  cv.width = px; cv.height = px;
  const c = cv.getContext('2d');
  drawItemIcon(c, item, px);
  cv.style.width = cssPx + 'px';
  cv.style.height = cssPx + 'px';
  return cv;
}

// ---------------------------------------------------------------- scene renderer
export function makeRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let W = 1, H = 1, DPR = 1;
  let bg = null;
  const scene = { cx: 200, cy: 300, s: 1, panelLeft: 800 };

  function resize() {
    W = window.innerWidth || 1280;
    H = window.innerHeight || 720;
    DPR = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';

    const panel = document.getElementById('recipes');
    const portrait = H > W * 1.05;
    if (portrait) {
      const linesEl = document.getElementById('lines');
      let bottomTop = H * 0.56;
      try {
        const rr = panel && panel.getBoundingClientRect();
        if (rr && rr.top > H * 0.24) bottomTop = Math.min(bottomTop, rr.top);
      } catch (e) { }
      try {
        const lr = linesEl && linesEl.getBoundingClientRect();
        if (lr && lr.top > H * 0.18) bottomTop = Math.min(bottomTop, lr.top);
      } catch (e) { }
      const topLimit = Math.min(122, H * 0.19);
      const availH = Math.max(118, bottomTop - topLimit - 8);
      scene.panelLeft = W;
      scene.cx = W * 0.50;
      scene.cy = topLimit + availH * 0.40;
      scene.s = Math.max(0.36, Math.min(0.98, Math.min(W / 430, availH / 330)));
    } else {
      let panelLeft = W;
      try {
        const r = panel && panel.getBoundingClientRect();
        if (r && r.width > 0 && r.height > 0) panelLeft = r.left;
      } catch (e) { }
      let sceneW = panelLeft > 230 ? panelLeft : W;
      if (W < 820) sceneW = Math.min(sceneW, W * 0.53);
      sceneW = Math.max(240, Math.min(sceneW, W));
      scene.panelLeft = panelLeft;
      scene.cx = sceneW * 0.50;
      scene.cy = H * 0.45;
      const s = Math.min(sceneW / 520, H / 650);
      scene.s = Math.max(0.42, Math.min(1.36, s));
    }

    buildBackground();
  }

  function buildBackground() {
    bg = document.createElement('canvas');
    bg.width = Math.max(2, Math.round(W * DPR));
    bg.height = Math.max(2, Math.round(H * DPR));
    const c = bg.getContext('2d');
    c.scale(DPR, DPR);

    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#14162e');
    g.addColorStop(0.45, '#101226');
    g.addColorStop(0.78, '#0c0d1d');
    g.addColorStop(1, '#080911');
    c.fillStyle = g; c.fillRect(0, 0, W, H);

    // soft indigo light pools
    c.fillStyle = rg(c, scene.cx, scene.cy - H * 0.14, 10, Math.max(W, H) * 0.55,
      [[0, 'rgba(48,62,124,.30)'], [0.5, 'rgba(30,32,74,.12)'], [1, 'rgba(8,9,20,0)']]);
    c.fillRect(0, 0, W, H);

    // paper grain
    for (let i = 0; i < Math.min(520, Math.round(W * H / 2600)); i++) {
      const x = Math.random() * W, y = Math.random() * H;
      const a = 0.015 + Math.random() * 0.035;
      c.fillStyle = Math.random() < 0.5 ? `rgba(235,220,180,${a})` : `rgba(120,130,190,${a})`;
      c.beginPath(); c.arc(x, y, 0.5 + Math.random() * 1.4, 0, Math.PI * 2); c.fill();
    }

    // alchemical circle behind the crucible
    const cx = scene.cx, cy = scene.cy + H * 0.015, R = 190 * scene.s;
    c.save();
    c.strokeStyle = 'rgba(190,170,130,.13)'; c.lineWidth = 1.2;
    c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.stroke();
    c.setLineDash([7, 13]);
    c.strokeStyle = 'rgba(122,216,255,.12)';
    c.beginPath(); c.arc(cx, cy, R * 0.78, 0, Math.PI * 2); c.stroke();
    c.setLineDash([]);
    c.strokeStyle = 'rgba(200,160,110,.10)';
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      c.beginPath();
      c.moveTo(cx + Math.cos(a) * R * 0.83, cy + Math.sin(a) * R * 0.83);
      c.lineTo(cx + Math.cos(a) * R * 0.94, cy + Math.sin(a) * R * 0.94);
      c.stroke();
    }
    // hexagram-ish intersecting triangles
    c.strokeStyle = 'rgba(160,150,200,.09)';
    for (const off of [0, Math.PI]) {
      c.beginPath();
      for (let i = 0; i < 3; i++) {
        const a = off + (i / 3) * Math.PI * 2 - Math.PI / 2;
        const x = cx + Math.cos(a) * R * 0.66, y = cy + Math.sin(a) * R * 0.66;
        if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
      }
      c.closePath(); c.stroke();
    }
    c.restore();

    // left shelf with jars
    const shelfY = H * 0.74;
    const shelfW = Math.min(scene.cx - 150 * scene.s, W * 0.30);
    if (shelfW > 70) {
      c.fillStyle = 'rgba(40,30,28,.45)';
      c.fillRect(0, shelfY, Math.max(0, shelfW), 6);
      c.fillRect(0, shelfY + 44, Math.max(0, shelfW), 4);
      c.fillStyle = 'rgba(60,46,36,.5)';
      const jars = [
        [0.14, 26, 32], [0.28, 18, 24], [0.42, 22, 29], [0.58, 15, 20], [0.74, 24, 34],
      ];
      for (const [fx, jw, jh] of jars) {
        const x = fx * shelfW, y = shelfY - jh;
        c.fillRect(x - jw / 2, y, jw, jh);
        c.fillStyle = 'rgba(120,190,160,.13)';
        c.fillRect(x - jw / 2 + 2, y + jh * 0.4, jw - 4, jh * 0.35);
        c.fillStyle = 'rgba(60,46,36,.5)';
      }
    }
    // right-side faint shelf silhouettes (behind the DOM panel)
    if (W > 900) {
      c.fillStyle = 'rgba(44,32,30,.30)';
      for (let i = 0; i < 5; i++) {
        const x = W * 0.64 + i * W * 0.055;
        c.fillRect(x, H * 0.62, W * 0.012, H * 0.16);
        c.fillRect(x - 4, H * 0.62, W * 0.02, 4);
      }
    }

    // table edge and floor
    c.fillStyle = 'rgba(48,32,26,.38)';
    c.fillRect(0, H * 0.79, W, H * 0.21);
    c.fillStyle = 'rgba(10,8,14,.45)';
    c.fillRect(0, H * 0.79, W, 3);
    const fg = rg(c, scene.cx, H * 0.86, 20, W * 0.5,
      [[0, 'rgba(255,150,70,.10)'], [1, 'rgba(255,120,50,0)']]);
    c.fillStyle = fg; c.fillRect(0, H * 0.72, W, H * 0.28);

    // fine vertical grain on the table
    c.strokeStyle = 'rgba(220,180,130,.04)'; c.lineWidth = 1;
    for (let i = 0; i < 16; i++) {
      const y = H * 0.80 + i * (H * 0.013);
      c.beginPath(); c.moveTo(0, y); c.lineTo(W, y + Math.sin(i) * 2); c.stroke();
    }
  }

  function drawPot(view) {
    const c = ctx;
    const { cx, cy, s } = scene;
    const pressure = Math.max(0, Math.min(1, (view.pressure || 0) / 100));
    const t = view.time || 0;
    const pw = 150 * s;
    const rimY = cy;
    const bodyDepth = 132 * s;
    const bottomY = rimY + bodyDepth;
    const pulse = view.craftPulse || 0;

    // ambient glow under / around the pot
    const glowCol = pressure > 0.65 ? 'rgba(255,90,50,' : 'rgba(255,160,80,';
    c.fillStyle = rg(c, cx, rimY + 20 * s, 8, 235 * s,
      [[0, glowCol + (0.22 + pressure * 0.18 + pulse * 0.15) + ')'],
      [0.55, 'rgba(120,90,200,.08)'], [1, 'rgba(8,9,20,0)']]);
    c.beginPath(); c.arc(cx, rimY + 10 * s, 235 * s, 0, Math.PI * 2); c.fill();

    // fire under the pot
    drawFire(c, cx, bottomY + 22 * s, s, t, pressure, pulse, view.levels ? view.levels[0] : 0);

    // legs
    c.strokeStyle = '#6d3528'; c.lineWidth = Math.max(2, 8 * s); c.lineCap = 'round';
    for (const dir of [-1, 0, 1]) {
      c.beginPath();
      c.moveTo(cx + dir * 58 * s, bottomY - 10 * s);
      c.quadraticCurveTo(cx + dir * 74 * s, bottomY + 22 * s, cx + dir * 66 * s, bottomY + 40 * s);
      c.stroke();
    }
    c.lineCap = 'butt';

    // body
    c.beginPath();
    c.moveTo(cx - pw, rimY + 6 * s);
    c.bezierCurveTo(cx - pw * 0.98, rimY + bodyDepth * 0.52, cx - pw * 0.72, bottomY - 12 * s, cx - pw * 0.42, bottomY);
    c.quadraticCurveTo(cx, bottomY + 14 * s, cx + pw * 0.42, bottomY);
    c.bezierCurveTo(cx + pw * 0.72, bottomY - 12 * s, cx + pw * 0.98, rimY + bodyDepth * 0.52, cx + pw, rimY + 6 * s);
    c.closePath();
    const bodyGrad = lg(c, cx - pw, rimY, cx + pw, bottomY,
      [[0, '#8a4a3a'], [0.18, '#c8794a'], [0.45, '#a85c3e'], [0.72, '#7a3f30'], [1, '#4a241e']]);
    c.fillStyle = bodyGrad;
    c.fill();
    c.strokeStyle = 'rgba(30,12,12,.55)'; c.lineWidth = Math.max(1.5, 3 * s); c.stroke();

    // specular copper streaks
    c.save();
    c.beginPath();
    c.moveTo(cx - pw, rimY + 6 * s);
    c.bezierCurveTo(cx - pw * 0.98, rimY + bodyDepth * 0.52, cx - pw * 0.72, bottomY - 12 * s, cx - pw * 0.42, bottomY);
    c.quadraticCurveTo(cx, bottomY + 14 * s, cx + pw * 0.42, bottomY);
    c.bezierCurveTo(cx + pw * 0.72, bottomY - 12 * s, cx + pw * 0.98, rimY + bodyDepth * 0.52, cx + pw, rimY + 6 * s);
    c.closePath(); c.clip();
    c.strokeStyle = 'rgba(255,210,150,.20)'; c.lineWidth = 7 * s;
    c.beginPath(); c.moveTo(cx - pw * 0.62, rimY + 24 * s);
    c.quadraticCurveTo(cx - pw * 0.78, rimY + 72 * s, cx - pw * 0.48, bottomY - 18 * s); c.stroke();
    c.strokeStyle = 'rgba(80,30,26,.28)'; c.lineWidth = 10 * s;
    c.beginPath(); c.moveTo(cx + pw * 0.55, rimY + 30 * s);
    c.quadraticCurveTo(cx + pw * 0.72, rimY + 84 * s, cx + pw * 0.48, bottomY - 14 * s); c.stroke();
    // hot seam when pressured
    if (pressure > 0.35) {
      c.strokeStyle = `rgba(255,${Math.round(140 - pressure * 80)},60,${0.12 + pressure * 0.28})`;
      c.lineWidth = 3 * s;
      for (let i = 0; i < 3; i++) {
        const y = rimY + (34 + i * 28) * s;
        c.beginPath(); c.moveTo(cx - pw * 0.5, y);
        c.lineTo(cx - pw * 0.16, y + 7 * s); c.lineTo(cx + pw * 0.2, y - 4 * s);
        c.lineTo(cx + pw * 0.5, y + 5 * s); c.stroke();
      }
    }
    c.restore();

    // rim
    c.beginPath(); c.ellipse(cx, rimY, pw + 4 * s, 30 * s, 0, 0, Math.PI * 2);
    c.fillStyle = lg(c, cx - pw, rimY - 20 * s, cx + pw, rimY + 20 * s,
      [[0, '#d08050'], [0.35, '#8a4a32'], [0.6, '#e8a86a'], [1, '#6d3528']]);
    c.fill();
    c.strokeStyle = 'rgba(30,12,12,.6)'; c.lineWidth = Math.max(1.5, 2.5 * s); c.stroke();

    // inner hollow
    c.beginPath(); c.ellipse(cx, rimY + 1 * s, pw - 12 * s, 22 * s, 0, 0, Math.PI * 2);
    c.fillStyle = '#2a151a'; c.fill();

    // liquid surface
    const liq = rg(c, cx, rimY, 6, pw - 16 * s,
      [[0, 'rgba(210,250,255,.92)'], [0.28, 'rgba(122,216,255,.7)'],
      [0.66, 'rgba(58,110,190,.6)'], [1, 'rgba(30,40,100,.35)']]);
    c.beginPath(); c.ellipse(cx, rimY + 2 * s, pw - 16 * s, 18 * s, 0, 0, Math.PI * 2);
    c.fillStyle = liq; c.fill();
    c.strokeStyle = 'rgba(190,240,255,.35)'; c.lineWidth = 1.4 * s; c.stroke();

    // rotating sheen
    c.save();
    c.beginPath(); c.ellipse(cx, rimY + 2 * s, pw - 18 * s, 16 * s, 0, 0, Math.PI * 2); c.clip();
    const ang = t * 0.7;
    c.strokeStyle = 'rgba(255,255,255,.16)'; c.lineWidth = 3 * s;
    c.beginPath(); c.ellipse(cx + Math.cos(ang) * 34 * s, rimY + 2 * s + Math.sin(ang) * 6 * s, 26 * s, 5 * s, 0, 0, Math.PI * 2); c.stroke();
    c.restore();

    // rim highlight
    c.strokeStyle = 'rgba(255,230,180,.42)'; c.lineWidth = 1.6 * s;
    c.beginPath(); c.ellipse(cx, rimY - 2 * s, pw + 2 * s, 26 * s, 0, Math.PI * 1.05, Math.PI * 1.55); c.stroke();

    // handles
    c.strokeStyle = '#8a4a32'; c.lineWidth = Math.max(3, 9 * s);
    c.beginPath(); c.arc(cx - pw - 12 * s, rimY + 28 * s, 30 * s, Math.PI * 0.45, Math.PI * 1.6); c.stroke();
    c.beginPath(); c.arc(cx + pw + 12 * s, rimY + 28 * s, 30 * s, -Math.PI * 0.6, Math.PI * 0.55); c.stroke();
    c.strokeStyle = 'rgba(255,210,160,.24)'; c.lineWidth = Math.max(1, 2.4 * s);
    c.beginPath(); c.arc(cx - pw - 12 * s, rimY + 28 * s, 30 * s, Math.PI * 0.45, Math.PI * 1.2); c.stroke();

    // rivets
    c.fillStyle = 'rgba(255,215,160,.42)';
    for (const a of [0.15, 0.35, 0.65, 0.85]) {
      const x = cx - pw + a * 2 * pw;
      c.beginPath(); c.arc(x, rimY + 12 * s, Math.max(1, 2.2 * s), 0, Math.PI * 2); c.fill();
    }

    // bubbles rising from the liquid
    const bubbles = view.bubbles || [];
    for (const b of bubbles) {
      const a = Math.max(0, Math.min(1, b.life / b.max));
      const bx = cx + (b.x || 0) * (pw - 34 * s);
      const by = rimY + 2 * s - (b.y || 0) * 78 * s;
      const rr = Math.max(0.6, (b.r || 2) * s * (0.7 + 0.3 * a));
      c.beginPath(); c.arc(bx, by, rr, 0, Math.PI * 2);
      c.fillStyle = `rgba(190,245,255,${0.10 + a * 0.35})`; c.fill();
      c.strokeStyle = `rgba(235,255,255,${a * 0.4})`; c.lineWidth = 1; c.stroke();
    }

    // steam wisps
    const steamN = 4;
    for (let i = 0; i < steamN; i++) {
      const ph = t * 0.55 + i * 1.7;
      const sx = cx + Math.sin(ph * 0.8 + i) * 46 * s + (i - 1.5) * 22 * s;
      const sy = rimY - 20 * s - ((t * 22 + i * 30) % 120) * s;
      const alpha = Math.max(0, 0.16 - ((t * 22 + i * 30) % 120) / 900);
      c.strokeStyle = `rgba(170,210,240,${alpha})`; c.lineWidth = 7 * s;
      c.lineCap = 'round';
      c.beginPath();
      c.moveTo(sx, sy + 36 * s);
      c.bezierCurveTo(sx - 10 * s, sy + 20 * s, sx + 12 * s, sy + 8 * s, sx - 4 * s, sy - 4 * s);
      c.stroke();
    }
    c.lineCap = 'butt';
  }

  function drawFire(c, x, y, s, t, pressure, pulse, gatherLevel) {
    const intensity = 0.7 + Math.min(0.5, gatherLevel * 0.04) + pressure * 0.5 + pulse * 0.25;
    c.save();
    c.globalCompositeOperation = 'lighter';

    // log bed
    c.globalCompositeOperation = 'source-over';
    c.fillStyle = '#2a1712';
    c.save();
    c.translate(x, y + 8 * s); c.rotate(-0.16);
    c.fillRect(-58 * s, -6 * s, 116 * s, 12 * s);
    c.restore();
    c.save();
    c.translate(x, y + 8 * s); c.rotate(0.2);
    c.fillStyle = '#341b14';
    c.fillRect(-48 * s, -5 * s, 96 * s, 10 * s);
    c.restore();
    c.fillStyle = 'rgba(255,120,50,.35)';
    c.fillRect(x - 46 * s, y + 5 * s, 92 * s, 2.5 * s);

    c.globalCompositeOperation = 'lighter';
    const tongues = 6;
    for (let i = 0; i < tongues; i++) {
      const phase = t * (5.2 + i * 0.7) + i * 2.1;
      const h = (54 + 34 * Math.sin(phase) + 18 * Math.sin(phase * 1.7)) * s * intensity;
      const w = (17 + 7 * Math.sin(phase * 1.3 + i)) * s;
      const fx = x + (i - (tongues - 1) / 2) * 22 * s;
      const baseY = y + 10 * s;
      const tilt = Math.sin(phase * 0.8) * 12 * s;
      const g = c.createLinearGradient(fx, baseY, fx, baseY - h);
      g.addColorStop(0, 'rgba(255,90,30,.55)');
      g.addColorStop(0.4, 'rgba(255,150,50,.55)');
      g.addColorStop(0.78, 'rgba(255,230,130,.5)');
      g.addColorStop(1, 'rgba(255,255,220,0)');
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(fx - w, baseY);
      c.bezierCurveTo(fx - w * 0.9, baseY - h * 0.45, fx + tilt * 0.4 - w * 0.35, baseY - h * 0.75, fx + tilt, baseY - h);
      c.bezierCurveTo(fx + tilt * 0.4 + w * 0.35, baseY - h * 0.75, fx + w * 0.9, baseY - h * 0.45, fx + w, baseY);
      c.closePath(); c.fill();
    }
    // bright core
    c.fillStyle = rg(c, x, y - 6 * s, 1, 44 * s,
      [[0, 'rgba(255,250,210,.7)'], [0.4, 'rgba(255,190,80,.32)'], [1, 'rgba(255,120,40,0)']]);
    c.beginPath(); c.ellipse(x, y - 4 * s, 46 * s, 40 * s, 0, 0, Math.PI * 2); c.fill();
    c.restore();
  }

  function drawFX(view) {
    const c = ctx;
    const { cx, cy, s } = scene;
    const parts = view.particles || [];
    for (const p of parts) {
      const a = Math.max(0, Math.min(1, p.life / (p.max || 1)));
      if (p.type === 'ring') {
        c.strokeStyle = rgba(p.color || '#ffd77a', a * 0.7);
        c.lineWidth = Math.max(1, 3 * a);
        c.beginPath(); c.arc(p.x, p.y, p.r0 + (1 - a) * (p.r1 || 60), 0, Math.PI * 2); c.stroke();
        continue;
      }
      c.globalAlpha = a;
      c.fillStyle = p.color || '#ffd77a';
      if (p.type === 'star') {
        const sz = (p.size || 2) * (0.6 + a * 0.6);
        c.save(); c.translate(p.x, p.y); c.rotate((p.rot || 0) + (p.max - p.life) * 3);
        c.beginPath();
        c.moveTo(0, -sz * 1.7); c.lineTo(sz * 0.45, -sz * 0.45); c.lineTo(sz * 1.7, 0);
        c.lineTo(sz * 0.45, sz * 0.45); c.lineTo(0, sz * 1.7); c.lineTo(-sz * 0.45, sz * 0.45);
        c.lineTo(-sz * 1.7, 0); c.lineTo(-sz * 0.45, -sz * 0.45); c.closePath();
        c.fill(); c.restore();
      } else {
        c.beginPath(); c.arc(p.x, p.y, Math.max(0.5, (p.size || 2) * (0.5 + a * 0.7)), 0, Math.PI * 2); c.fill();
      }
    }
    c.globalAlpha = 1;

    // floating reward texts
    c.textAlign = 'center';
    for (const f of (view.floats || [])) {
      const a = Math.max(0, Math.min(1, f.life / (f.max || 1)));
      c.globalAlpha = a;
      c.font = `700 ${Math.round(f.size || 18)}px "Microsoft YaHei", system-ui, sans-serif`;
      c.strokeStyle = 'rgba(8,8,20,.8)'; c.lineWidth = 3;
      c.strokeText(f.text, f.x, f.y);
      c.fillStyle = f.color || '#ffe8a8';
      c.fillText(f.text, f.x, f.y);
    }
    c.globalAlpha = 1;

    // pressure vignette
    const pressure = Math.max(0, Math.min(1, (view.pressure || 0) / 100));
    if (pressure > 0.5) {
      const edge = (pressure - 0.5) * 2;
      const v = c.createRadialGradient(cx, cy, 80 * s, cx, cy, Math.max(W, H) * 0.72);
      v.addColorStop(0, 'rgba(255,60,30,0)');
      v.addColorStop(0.72, `rgba(255,50,20,${edge * 0.10})`);
      v.addColorStop(1, `rgba(255,30,10,${edge * 0.30})`);
      c.fillStyle = v; c.fillRect(0, 0, W, H);
    }

    if ((view.flashT || 0) > 0) {
      c.fillStyle = `rgba(255,240,200,${Math.min(0.55, view.flashT * 1.6)})`;
      c.fillRect(0, 0, W, H);
    }
  }

  function draw(view = {}) {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);
    if (!bg) buildBackground();
    if (bg) ctx.drawImage(bg, 0, 0, W, H);

    ctx.save();
    const shakeT = view.shakeT || 0;
    if (shakeT > 0) {
      const amp = (view.shakeAmp || 0) * Math.min(1, shakeT * 4);
      ctx.translate((Math.random() * 2 - 1) * amp, (Math.random() * 2 - 1) * amp);
    }
    drawPot(view);
    drawFX(view);
    ctx.restore();
  }

  resize();
  return { resize, draw, get scene() { return scene; } };
}
