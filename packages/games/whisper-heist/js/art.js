// Static hand-drawn layers. The floor/decor and the wall layer are pre-rendered
// at 2× and composited each frame: background → vision cones → walls → actors,
// which makes walls genuinely occlude sight cones and sound rings.

export const PAL = {
  ink: '#0b0e24',
  floor0: '#111634',
  floor1: '#171c40',
  wall: '#232a55',
  wallDark: '#161b3d',
  copper: '#c8a15a',
  copperSoft: 'rgba(200,161,90,.45)',
  gold: '#ffd77a',
  cinnabar: '#c94f4a',
  jade: '#6fe0c8',
  paper: '#e8dcc0',
};

function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function line(c, x1, y1, x2, y2, jitter, rand) {
  c.beginPath();
  const n = Math.max(2, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 26));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const jx = (rand() - 0.5) * jitter, jy = (rand() - 0.5) * jitter;
    const x = x1 + (x2 - x1) * t + jx, y = y1 + (y2 - y1) * t + jy;
    i ? c.lineTo(x, y) : c.moveTo(x, y);
  }
  c.stroke();
}

// Draw one wall rect with double ink outline + paper fibres.
function drawWall(c, w, rand, isLow) {
  c.save();
  c.fillStyle = isLow ? '#2a2a52' : PAL.wall;
  c.fillRect(w.x, w.y, w.w, w.h);
  // inner shading
  const g = c.createLinearGradient(w.x, w.y, w.x, w.y + w.h);
  g.addColorStop(0, 'rgba(255,255,255,.10)');
  g.addColorStop(0.35, 'rgba(255,255,255,0)');
  g.addColorStop(1, 'rgba(0,0,0,.32)');
  c.fillStyle = g;
  c.fillRect(w.x, w.y, w.w, w.h);
  // fibres / hatch
  c.strokeStyle = isLow ? 'rgba(111,224,200,.22)' : 'rgba(200,161,90,.16)';
  c.lineWidth = 1;
  const count = isLow ? Math.max(2, ((w.w + w.h) / 16) | 0) : Math.max(2, ((w.w + w.h) / 26) | 0);
  for (let i = 0; i < count; i++) {
    const t = rand();
    if (w.w > w.h) {
      const x = w.x + t * w.w;
      c.beginPath(); c.moveTo(x, w.y + 3); c.lineTo(x - 3 + rand() * 6, w.y + w.h - 3); c.stroke();
    } else {
      const y = w.y + t * w.h;
      c.beginPath(); c.moveTo(w.x + 3, y); c.lineTo(w.x + w.w - 3, y - 3 + rand() * 6); c.stroke();
    }
  }
  // outlines
  c.strokeStyle = isLow ? 'rgba(111,224,200,.65)' : PAL.copper;
  c.lineWidth = 2.4;
  if (isLow) c.setLineDash([8, 6]);
  c.strokeRect(w.x + 0.5, w.y + 0.5, w.w - 1, w.h - 1);
  c.setLineDash([]);
  c.strokeStyle = isLow ? 'rgba(111,224,200,.22)' : 'rgba(0,0,0,.5)';
  c.lineWidth = 1.4;
  c.strokeRect(w.x + 3.5, w.y + 3.5, w.w - 7, w.h - 7);
  // metal studs on tall walls
  if (!isLow && w.w > 18 && w.h > 18) {
    c.fillStyle = 'rgba(255,215,122,.5)';
    const step = 34;
    for (let x = w.x + 12; x < w.x + w.w - 6; x += step) {
      for (let y = w.y + 12; y < w.y + w.h - 6; y += step) {
        c.beginPath(); c.arc(x, y, 1.4, 0, Math.PI * 2); c.fill();
      }
    }
  }
  // low-cover chevrons hint: duck!
  if (isLow) {
    c.strokeStyle = 'rgba(232,220,192,.45)';
    c.lineWidth = 1.6;
    if (w.w >= w.h) {
      const cx = w.x + w.w / 2, cy = w.y + w.h / 2;
      c.beginPath(); c.moveTo(cx - 8, cy - 4); c.lineTo(cx - 3, cy + 2); c.lineTo(cx + 2, cy - 4); c.stroke();
      c.beginPath(); c.moveTo(cx + 3, cy - 4); c.lineTo(cx + 8, cy + 2); c.lineTo(cx + 13, cy - 4); c.stroke();
    }
  }
  c.restore();
}

export function renderStatic(level, index) {
  const W = 960, H = 540, S = 2;
  const rand = rng(0x9E37 + index * 7919);
  const bg = makeCanvas(W * S, H * S);
  const bc = bg.getContext('2d'); bc.scale(S, S);

  // indigo paper base
  const g = bc.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#0d1130');
  g.addColorStop(0.45, PAL.floor0);
  g.addColorStop(1, '#1c1430');
  bc.fillStyle = g; bc.fillRect(0, 0, W, H);

  // paper grain
  for (let i = 0; i < 900; i++) {
    const a = 0.015 + rand() * 0.035;
    bc.fillStyle = rand() < 0.5 ? `rgba(232,220,192,${a})` : `rgba(6,8,22,${a * 1.6})`;
    const s = rand() < 0.85 ? 1 : 2;
    bc.fillRect(rand() * W, rand() * H, s, s);
  }
  // faint floor grid / stone seams
  bc.strokeStyle = 'rgba(200,161,90,.055)'; bc.lineWidth = 1;
  for (let x = 40; x < W; x += 40) { bc.beginPath(); bc.moveTo(x, 16); bc.lineTo(x, H - 16); bc.stroke(); }
  for (let y = 40; y < H; y += 40) { bc.beginPath(); bc.moveTo(16, y); bc.lineTo(W - 16, y); bc.stroke(); }
  // tea-stain blots
  for (let i = 0; i < 12; i++) {
    const x = 30 + rand() * (W - 60), y = 30 + rand() * (H - 60), r = 20 + rand() * 70;
    const rg = bc.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, `rgba(80,52,30,${0.05 + rand() * 0.05})`);
    rg.addColorStop(1, 'rgba(80,52,30,0)');
    bc.fillStyle = rg; bc.beginPath(); bc.arc(x, y, r, 0, Math.PI * 2); bc.fill();
  }

  // dark zones (hiding spots)
  for (const d of level.dark) {
    bc.fillStyle = 'rgba(4,7,20,.52)';
    bc.fillRect(d.x, d.y, d.w, d.h);
    bc.strokeStyle = 'rgba(111,224,200,.26)';
    bc.setLineDash([6, 8]); bc.lineWidth = 1.5;
    bc.strokeRect(d.x + 2, d.y + 2, d.w - 4, d.h - 4);
    bc.setLineDash([]);
    for (let i = 0; i < 8; i++) {
      const x = d.x + 8 + rand() * (d.w - 16), y = d.y + 8 + rand() * (d.h - 16);
      bc.fillStyle = 'rgba(111,224,200,.25)';
      bc.beginPath(); bc.arc(x, y, 0.9, 0, Math.PI * 2); bc.fill();
    }
    bc.fillStyle = 'rgba(111,224,200,.42)';
    bc.font = '10px "Microsoft YaHei",sans-serif';
    bc.fillText('暗处', d.x + 7, d.y + 14);
  }

  // exit floor mat
  const ex = level.exit;
  const eg = bc.createRadialGradient(ex.x + ex.w / 2, ex.y + ex.h / 2, 2, ex.x + ex.w / 2, ex.y + ex.h / 2, 72);
  eg.addColorStop(0, 'rgba(111,224,200,.18)');
  eg.addColorStop(1, 'rgba(111,224,200,0)');
  bc.fillStyle = eg; bc.fillRect(ex.x - 50, ex.y - 50, ex.w + 100, ex.h + 100);
  bc.strokeStyle = 'rgba(111,224,200,.38)'; bc.lineWidth = 2;
  bc.setLineDash([9, 7]);
  bc.strokeRect(ex.x - 4, ex.y - 4, ex.w + 8, ex.h + 8);
  bc.setLineDash([]);

  // title stamp bottom-left
  bc.save();
  bc.globalAlpha = 0.42;
  bc.fillStyle = PAL.copper;
  bc.font = '12px "Microsoft YaHei",sans-serif';
  bc.fillText(`第 ${index + 1} 铺 · ${level.name}`, 26, 512);
  bc.textAlign = 'right';
  bc.font = '10px "Microsoft YaHei",sans-serif';
  bc.fillStyle = 'rgba(232,220,192,.55)';
  bc.fillText('灯匠夜游 · 第 4 铺', 934, 512);
  bc.restore();

  // wall layer (transparent)
  const wallsCv = makeCanvas(W * S, H * S);
  const wc = wallsCv.getContext('2d'); wc.scale(S, S);
  for (const w of level.walls) drawWall(wc, w, rand, w.type === 'low');

  return { bg, walls: wallsCv };
}

// small helper for the title/level-select background; a lantern-lit alley
export function renderTitleCard() {
  const W = 960, H = 540, S = 2;
  const cv = makeCanvas(W * S, H * S);
  const c = cv.getContext('2d'); c.scale(S, S);
  const rand = rng(0x51A9);
  const g = c.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#0a0d23'); g.addColorStop(0.6, '#171a3e'); g.addColorStop(1, '#241530');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  // distant roofs
  c.fillStyle = 'rgba(10,13,35,.9)';
  for (let i = 0; i < 9; i++) {
    const x = i * 120 - 30, h = 90 + rand() * 90;
    c.beginPath(); c.moveTo(x, 380); c.lineTo(x + 60, 380 - h * .55); c.lineTo(x + 120, 380); c.closePath(); c.fill();
    c.fillRect(x + 10, 380, 100, 80);
  }
  // lanterns
  for (let i = 0; i < 7; i++) {
    const x = 60 + i * 140, y = 120 + rand() * 60;
    const rg = c.createRadialGradient(x, y, 1, x, y, 70);
    rg.addColorStop(0, 'rgba(255,180,90,.28)'); rg.addColorStop(1, 'rgba(255,180,90,0)');
    c.fillStyle = rg; c.beginPath(); c.arc(x, y, 70, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#c94f4a';
    c.beginPath(); c.ellipse(x, y, 11, 15, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#ffd77a'; c.lineWidth = 1.2; c.stroke();
    c.strokeStyle = 'rgba(200,161,90,.5)';
    c.beginPath(); c.moveTo(x, y - 15); c.lineTo(x, 40 + rand() * 20); c.stroke();
  }
  // rain lines
  c.strokeStyle = 'rgba(180,200,230,.10)'; c.lineWidth = 1;
  for (let i = 0; i < 160; i++) {
    const x = rand() * W, y = rand() * H;
    c.beginPath(); c.moveTo(x, y); c.lineTo(x - 4, y + 14); c.stroke();
  }
  // vignette
  const vg = c.createRadialGradient(W / 2, H / 2, 120, W / 2, H / 2, 620);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(2,4,14,.75)');
  c.fillStyle = vg; c.fillRect(0, 0, W, H);
  return cv;
}
