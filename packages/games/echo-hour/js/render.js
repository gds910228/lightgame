// Echo Hour — procedural Canvas 2D art: indigo paper night, copper gears,
// twin cyan/amber timelines. No images, fonts or network requests.

export const W = 1280, H = 720;

const C = {
  ink: '#05070f', indigo: '#0a1226', indigo2: '#152747', deep: '#070c19',
  copper: '#e0a45a', copperHi: '#ffd99a', copperDim: '#80552a',
  cyan: '#6fe3e8', cyanHi: '#c8feff', cyanDim: '#2b7780',
  amber: '#ffc063', amberHi: '#fff0c8',
  jade: '#6fe3c4', jadeHi: '#c9ffed', verm: '#e35d4c', vermHi: '#ff9a78',
  paper: '#f1e4c8', muted: '#8fa1bf',
};

function rr(c, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

function starPath(c, x, y, r, points, inner, rot = 0) {
  c.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const a = rot + i * Math.PI / points - Math.PI / 2;
    const rr2 = i % 2 === 0 ? r : r * inner;
    const px = x + Math.cos(a) * rr2, py = y + Math.sin(a) * rr2;
    if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
  }
  c.closePath();
}

function rngFrom(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

function makeGear(c, cx, cy, R, teeth, color, alpha, rot = 0) {
  c.save();
  c.translate(cx, cy); c.rotate(rot);
  c.globalAlpha = alpha;
  c.fillStyle = color; c.strokeStyle = color;
  c.beginPath();
  for (let i = 0; i < teeth * 2; i++) {
    const a = i / (teeth * 2) * Math.PI * 2;
    const r = i % 2 === 0 ? R : R * 0.82;
    const px = Math.cos(a) * r, py = Math.sin(a) * r;
    if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
  }
  c.closePath(); c.fill();
  c.globalCompositeOperation = 'destination-out';
  c.beginPath(); c.arc(0, 0, R * 0.52, 0, 7); c.fill();
  const spokes = 6;
  c.lineWidth = R * 0.12;
  for (let i = 0; i < spokes; i++) {
    const a = i / spokes * Math.PI * 2;
    c.beginPath(); c.moveTo(Math.cos(a) * R * 0.14, Math.sin(a) * R * 0.14);
    c.lineTo(Math.cos(a) * R * 0.5, Math.sin(a) * R * 0.5); c.stroke();
  }
  c.beginPath(); c.arc(0, 0, R * 0.13, 0, 7); c.fill();
  c.restore();
}

function makeBg(chapter) {
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  const rnd = rngFrom(9107 + chapter * 733);

  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#04060e');
  g.addColorStop(0.34, '#0a1428');
  g.addColorStop(0.68, '#0d1d38');
  g.addColorStop(1, '#050912');
  c.fillStyle = g; c.fillRect(0, 0, W, H);

  // paper fibre grain
  for (let i = 0; i < 520; i++) {
    const x = rnd() * W, y = rnd() * H;
    c.fillStyle = `rgba(220,200,170,${0.012 + rnd() * 0.026})`;
    c.fillRect(x, y, 1 + rnd() * 3, 1);
  }
  for (let i = 0; i < 90; i++) {
    const x = rnd() * W, y = rnd() * H;
    c.strokeStyle = `rgba(180,200,235,${0.018 + rnd() * 0.03})`;
    c.lineWidth = 0.7;
    c.beginPath(); c.moveTo(x, y); c.lineTo(x + 14 + rnd() * 28, y + (rnd() - 0.5) * 5); c.stroke();
  }

  // stardust
  for (let i = 0; i < 240; i++) {
    const x = rnd() * W, y = rnd() * H * 0.68, r = 0.4 + rnd() * 1.5;
    c.fillStyle = `rgba(${170 + (rnd() * 70 | 0)},${205 + (rnd() * 45 | 0)},255,${0.12 + rnd() * 0.5})`;
    c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
  }

  // twin timeline ribbons across the sky
  const ribbons = [
    { col: [111, 227, 232], off: -86, amp: 22, y: 168 },
    { col: [255, 192, 99], off: 74, amp: 26, y: 190 },
  ];
  for (const rb of ribbons) {
    for (let pass = 0; pass < 2; pass++) {
      c.beginPath();
      for (let x = -30; x <= W + 30; x += 12) {
        const y = rb.y + rb.off * 0.2 + Math.sin(x * 0.0045 + rb.off) * rb.amp + Math.sin(x * 0.0011) * 30;
        if (x < 0) c.moveTo(x, y); else c.lineTo(x, y);
      }
      c.strokeStyle = `rgba(${rb.col[0]},${rb.col[1]},${rb.col[2]},${pass === 0 ? 0.055 : 0.026})`;
      c.lineWidth = pass === 0 ? 16 : 40; c.stroke();
    }
    // tick marks
    for (let x = 40; x < W; x += 64) {
      const y = rb.y + rb.off * 0.2 + Math.sin(x * 0.0045 + rb.off) * rb.amp + Math.sin(x * 0.0011) * 30;
      c.strokeStyle = `rgba(${rb.col[0]},${rb.col[1]},${rb.col[2]},0.11)`;
      c.lineWidth = 1;
      c.beginPath(); c.moveTo(x, y - 7); c.lineTo(x, y + 7); c.stroke();
    }
  }

  // giant background gears
  makeGear(c, 170, 330, 150, 16, C.copper, 0.05, 0.2);
  makeGear(c, 1030, 250, 110, 12, C.cyan, 0.04, -0.4);
  makeGear(c, 880, 440, 78, 10, C.copper, 0.045, 0.9);

  // distant arches
  c.fillStyle = 'rgba(10,20,40,0.9)';
  for (let i = 0; i < 7; i++) {
    const x = 60 + i * 195 + (rnd() - 0.5) * 30;
    const h = 90 + rnd() * 90;
    c.fillRect(x, H - 120 - h, 34, h + 120);
    c.beginPath(); c.arc(x + 17, H - 120 - h + 2, 17, Math.PI, 0); c.fill();
  }
  // haze
  const hz = c.createLinearGradient(0, H * 0.55, 0, H);
  hz.addColorStop(0, 'rgba(35,70,110,0)');
  hz.addColorStop(0.6, 'rgba(30,60,100,0.12)');
  hz.addColorStop(1, 'rgba(10,22,44,0.42)');
  c.fillStyle = hz; c.fillRect(0, 0, W, H);
  return cv;
}

function makeVignette() {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  const g = c.createRadialGradient(W / 2, H * 0.46, H * 0.22, W / 2, H * 0.5, H * 0.88);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(0.72, 'rgba(0,0,0,0.16)');
  g.addColorStop(1, 'rgba(0,0,0,0.62)');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  return cv;
}

export function makeRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let DPR = 1, scale = 1, ox = 0, oy = 0, vw = W, vh = H;
  const bgs = [makeBg(1), makeBg(2), makeBg(3)];
  const vignette = makeVignette();

  function resize() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    vw = Math.max(1, innerWidth); vh = Math.max(1, innerHeight);
    canvas.width = Math.round(vw * DPR);
    canvas.height = Math.round(vh * DPR);
    scale = Math.min(vw / W, vh / H);
    ox = (vw - W * scale) / 2;
    oy = (vh - H * scale) / 2;
  }

  function drawFigure(c, x, y, o) {
    const { alpha = 1, ghost = false, facing = 1, stride = 0, lantern = true, attack = 0 } = o;
    const cx = x + 11, base = y + 32;
    c.save();
    c.globalAlpha = alpha;
    if (ghost) c.globalCompositeOperation = 'lighter';
    const coat = ghost ? 'rgba(111,227,232,0.42)' : '#1b2b4a';
    const coat2 = ghost ? 'rgba(111,227,232,0.3)' : '#0e1830';
    const trim = ghost ? 'rgba(200,254,255,0.55)' : C.copper;
    const skin = ghost ? 'rgba(200,254,255,0.55)' : '#e8d3ae';
    const scarf = ghost ? 'rgba(180,250,255,0.45)' : C.verm;
    const swing = Math.sin(stride) * 5;
    // shadow
    if (!ghost) {
      c.fillStyle = 'rgba(0,0,0,0.35)';
      c.beginPath(); c.ellipse(cx, base + 1, 13, 3.6, 0, 0, 7); c.fill();
    }
    // legs
    c.strokeStyle = ghost ? 'rgba(180,250,255,0.4)' : '#0a1020';
    c.lineWidth = 4.4; c.lineCap = 'round';
    c.beginPath(); c.moveTo(cx - 4, base - 12); c.lineTo(cx - 6 - swing * .5, base); c.stroke();
    c.beginPath(); c.moveTo(cx + 4, base - 12); c.lineTo(cx + 6 + swing * .5, base); c.stroke();
    // coat body
    c.fillStyle = coat;
    c.beginPath();
    c.moveTo(cx - 9, base - 22);
    c.quadraticCurveTo(cx - 12, base - 12, cx - 8, base - 8);
    c.lineTo(cx + 8, base - 8);
    c.quadraticCurveTo(cx + 12, base - 12, cx + 9, base - 22);
    c.quadraticCurveTo(cx, base - 27, cx - 9, base - 22);
    c.fill();
    c.fillStyle = coat2;
    c.beginPath(); c.moveTo(cx - 1, base - 23); c.lineTo(cx - 7, base - 8); c.lineTo(cx + 7, base - 8); c.lineTo(cx + 1, base - 23); c.fill();
    // trim
    c.strokeStyle = trim; c.lineWidth = 1.4;
    c.beginPath(); c.moveTo(cx - 8, base - 21); c.lineTo(cx, base - 24); c.lineTo(cx + 8, base - 21); c.stroke();
    c.beginPath(); c.moveTo(cx, base - 22); c.lineTo(cx, base - 9); c.stroke();
    // scarf
    c.strokeStyle = scarf; c.lineWidth = 3.4; c.lineCap = 'round';
    const fl = Math.sin(o.t || 0) * 2;
    c.beginPath(); c.moveTo(cx + facing * 3, base - 26);
    c.quadraticCurveTo(cx - facing * 10, base - 26 + fl, cx - facing * 15, base - 20 + fl); c.stroke();
    // head
    c.fillStyle = skin;
    c.beginPath(); c.arc(cx + facing * 1.5, base - 29, 6.2, 0, 7); c.fill();
    c.fillStyle = ghost ? 'rgba(90,225,235,0.6)' : '#111a30';
    c.beginPath(); c.arc(cx + facing * 1.5, base - 31.5, 6.4, Math.PI, Math.PI * 2); c.fill();
    // eye
    if (!ghost) {
      c.fillStyle = '#0b1020';
      c.beginPath(); c.arc(cx + facing * 3.4, base - 28.6, 1.1, 0, 7); c.fill();
    }
    // lantern
    if (lantern) {
      const lx = cx + facing * 11, ly = base - 17 + Math.sin((o.t || 0) * 2.2) * 1.5;
      c.strokeStyle = trim; c.lineWidth = 1;
      c.beginPath(); c.moveTo(cx + facing * 8, base - 22); c.lineTo(lx, ly - 5); c.stroke();
      if (!ghost) {
        const gg = c.createRadialGradient(lx, ly, 1, lx, ly, 16);
        gg.addColorStop(0, 'rgba(255,220,150,0.75)');
        gg.addColorStop(1, 'rgba(255,180,80,0)');
        c.fillStyle = gg; c.beginPath(); c.arc(lx, ly, 16, 0, 7); c.fill();
      }
      c.fillStyle = ghost ? 'rgba(180,250,255,0.4)' : C.amberHi;
      rr(c, lx - 3.6, ly - 4.5, 7.2, 9, 2); c.fill();
      c.strokeStyle = ghost ? 'rgba(180,250,255,0.45)' : C.copper;
      c.lineWidth = 1.1; rr(c, lx - 3.6, ly - 4.5, 7.2, 9, 2); c.stroke();
    }
    // recording / rewind aura
    if (attack > 0) {
      c.strokeStyle = `rgba(255,192,99,${0.16 + 0.14 * Math.sin((o.t || 0) * 7)})`;
      c.lineWidth = 2;
      c.beginPath(); c.arc(cx, base - 16, 22 + Math.sin((o.t || 0) * 5) * 2, 0, 7); c.stroke();
    }
    c.restore();
  }

  function drawPlatform(c, p, t) {
    const grd = c.createLinearGradient(0, p.y, 0, p.y + Math.min(p.h, 130));
    grd.addColorStop(0, p.kind === 'ledge' ? '#172a49' : '#122039');
    grd.addColorStop(0.18, '#0c1730');
    grd.addColorStop(1, '#060b17');
    c.fillStyle = grd;
    c.fillRect(p.x, p.y, p.w, p.h);
    // copper lip
    const lip = c.createLinearGradient(p.x, 0, p.x + p.w, 0);
    lip.addColorStop(0, 'rgba(141,95,46,0.45)');
    lip.addColorStop(0.5, 'rgba(255,217,154,0.8)');
    lip.addColorStop(1, 'rgba(141,95,46,0.45)');
    c.fillStyle = lip;
    c.fillRect(p.x, p.y, p.w, 2.4);
    c.fillStyle = 'rgba(111,227,232,0.07)';
    c.fillRect(p.x, p.y + 2.4, p.w, 1);
    // paper-cut hatch
    c.strokeStyle = 'rgba(150,180,220,0.055)'; c.lineWidth = 1;
    for (let x = p.x + 18; x < p.x + p.w; x += 32) {
      c.beginPath(); c.moveTo(x, p.y + 8); c.lineTo(x - 10, p.y + Math.min(p.h, 54)); c.stroke();
    }
    // rivets
    c.fillStyle = 'rgba(224,164,90,0.3)';
    for (let x = p.x + 24; x < p.x + p.w - 8; x += 56) {
      c.beginPath(); c.arc(x, p.y + 10, 1.7, 0, 7); c.fill();
    }
    // underside glow
    if (p.kind === 'ledge') {
      c.fillStyle = 'rgba(111,227,232,0.08)';
      c.fillRect(p.x, p.y + p.h, p.w, 1.5);
    }
  }

  function drawPlate(c, p, t) {
    const glow = p.pressed ? 1 : 0.25;
    c.save();
    c.fillStyle = '#251a10';
    rr(c, p.x - 4, p.y - 4, p.w + 8, p.h + 8, 3); c.fill();
    c.strokeStyle = p.pressed ? C.jade : 'rgba(224,164,90,0.6)';
    c.lineWidth = 1.4; rr(c, p.x - 4, p.y - 4, p.w + 8, p.h + 8, 3); c.stroke();
    const grd = c.createLinearGradient(0, p.y, 0, p.y + p.h);
    grd.addColorStop(0, p.pressed ? '#7fe3c8' : '#b98242');
    grd.addColorStop(1, p.pressed ? '#2f8a7c' : '#6b4620');
    c.fillStyle = grd;
    rr(c, p.x, p.y, p.w, p.h, 2); c.fill();
    if (p.pressed) {
      c.shadowColor = C.jade; c.shadowBlur = 12;
      c.strokeStyle = 'rgba(201,255,237,0.8)'; c.lineWidth = 1.2;
      rr(c, p.x, p.y + 1, p.w, p.h - 2, 2); c.stroke();
      c.shadowBlur = 0;
    }
    // etched ticks
    c.strokeStyle = 'rgba(10,16,28,0.55)'; c.lineWidth = 1;
    for (let x = p.x + 8; x < p.x + p.w - 3; x += 10) {
      c.beginPath(); c.moveTo(x, p.y + 2); c.lineTo(x, p.y + p.h - 2); c.stroke();
    }
    c.restore();
  }

  function drawSwitch(c, s, t) {
    c.save();
    c.fillStyle = '#2a1c10';
    rr(c, s.x - 5, s.y - 12, s.w + 10, s.h + 12, 3); c.fill();
    c.strokeStyle = s.flash > 0 ? C.cyan : 'rgba(224,164,90,0.65)';
    c.lineWidth = 1.3; rr(c, s.x - 5, s.y - 12, s.w + 10, s.h + 12, 3); c.stroke();
    const cx = s.x + s.w / 2, cy = s.y - 16;
    c.fillStyle = '#101a2e';
    c.beginPath(); c.arc(cx, cy, 12, 0, 7); c.fill();
    c.strokeStyle = s.flash > 0 ? C.cyanHi : C.copper; c.lineWidth = 1.4;
    c.beginPath(); c.arc(cx, cy, 12, 0, 7); c.stroke();
    c.strokeStyle = C.copperHi; c.lineWidth = 1.2;
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * Math.PI * 2;
      c.beginPath(); c.moveTo(cx + Math.cos(a) * 8.5, cy + Math.sin(a) * 8.5);
      c.lineTo(cx + Math.cos(a) * 10.5, cy + Math.sin(a) * 10.5); c.stroke();
    }
    const hand = s.flash > 0 ? -0.5 : (t * 0.8) % (Math.PI * 2);
    c.strokeStyle = s.flash > 0 ? C.cyanHi : C.amber;
    c.lineWidth = 1.8;
    c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(hand - Math.PI / 2) * 7, cy + Math.sin(hand - Math.PI / 2) * 7); c.stroke();
    c.fillStyle = C.copperHi;
    c.beginPath(); c.arc(cx, cy, 1.8, 0, 7); c.fill();
    c.restore();
  }

  function drawDoor(c, d, t) {
    const open = Math.max(0, Math.min(1, d.anim || 0));
    c.save();
    // frame
    c.fillStyle = '#1a120a';
    c.fillRect(d.x - 8, d.y - 8, d.w + 16, d.h + 8);
    c.fillStyle = C.copperDim;
    c.fillRect(d.x - 8, d.y - 8, d.w + 16, 4);
    c.fillRect(d.x - 8, d.y + d.h - 2, d.w + 16, 4);
    c.strokeStyle = 'rgba(255,217,154,0.5)'; c.lineWidth = 1;
    c.strokeRect(d.x - 8 + 0.5, d.y - 8 + 0.5, d.w + 15, d.h + 7);
    // two panels sliding vertically apart
    const gap = open * (d.h * 0.5 + 4);
    const panelH = d.h * 0.5 + 2;
    const grd = c.createLinearGradient(d.x, 0, d.x + d.w, 0);
    grd.addColorStop(0, '#6b4620'); grd.addColorStop(0.35, '#c99352');
    grd.addColorStop(0.62, '#7c5427'); grd.addColorStop(1, '#4b3118');
    c.fillStyle = grd;
    c.fillRect(d.x, d.y - gap, d.w, panelH);
    c.fillRect(d.x, d.y + d.h * 0.5 - 2 + gap, d.w, panelH);
    // panel bands
    c.strokeStyle = 'rgba(20,12,6,0.6)'; c.lineWidth = 1;
    for (let yy = d.y - gap + 12; yy < d.y - gap + panelH; yy += 18) {
      c.beginPath(); c.moveTo(d.x + 3, yy); c.lineTo(d.x + d.w - 3, yy); c.stroke();
    }
    // lock gear at the seam
    if (open < 0.5) {
      makeGear(c, d.x + d.w / 2, d.y + d.h / 2, 11, 8, C.copperHi, 0.9, t * 0.6);
      c.fillStyle = 'rgba(10,16,28,0.8)';
      c.beginPath(); c.arc(d.x + d.w / 2, d.y + d.h / 2, 3.6, 0, 7); c.fill();
    }
    if (open > 0.06) {
      c.fillStyle = `rgba(111,227,232,${0.1 + open * 0.16})`;
      c.fillRect(d.x - 2, d.y + d.h * 0.5 - gap, d.w + 4, gap * 2);
    }
    // base
    c.fillStyle = C.copperDim;
    c.fillRect(d.x - 10, d.y + d.h - 4, d.w + 20, 6);
    c.restore();
  }

  function drawLaser(c, l, t) {
    const on = l.on;
    // emitters
    c.fillStyle = '#22170d';
    rr(c, l.x - 6, l.y - 12, l.w + 12, 12, 2); c.fill();
    rr(c, l.x - 6, l.y + l.h, l.w + 12, 12, 2); c.fill();
    c.fillStyle = C.copperDim;
    c.fillRect(l.x + l.w / 2 - 2, l.y - 12, 4, 12);
    c.fillRect(l.x + l.w / 2 - 2, l.y + l.h, 4, 12);
    if (on) {
      c.save();
      c.shadowColor = C.verm; c.shadowBlur = 18;
      const grd = c.createLinearGradient(l.x, 0, l.x + l.w, 0);
      grd.addColorStop(0, 'rgba(227,93,76,0.15)');
      grd.addColorStop(0.35, 'rgba(255,154,120,0.95)');
      grd.addColorStop(0.5, '#ffe8dc');
      grd.addColorStop(0.65, 'rgba(255,154,120,0.95)');
      grd.addColorStop(1, 'rgba(227,93,76,0.15)');
      c.fillStyle = grd;
      c.fillRect(l.x - 3 + Math.sin(t * 21) * 0.8, l.y, l.w + 6, l.h);
      c.fillStyle = 'rgba(255,120,100,0.18)';
      c.fillRect(l.x - 72, l.y, l.w + 144, l.h);
      c.restore();
    } else {
      c.strokeStyle = 'rgba(227,93,76,0.25)'; c.lineWidth = 1;
      c.setLineDash([5, 7]);
      c.beginPath(); c.moveTo(l.x + l.w / 2, l.y); c.lineTo(l.x + l.w / 2, l.y + l.h); c.stroke();
      c.setLineDash([]);
    }
    // tiny cap lights
    c.fillStyle = on ? C.vermHi : 'rgba(227,93,76,0.35)';
    c.beginPath(); c.arc(l.x + l.w / 2, l.y - 2, 3, 0, 7); c.fill();
    c.beginPath(); c.arc(l.x + l.w / 2, l.y + l.h + 2, 3, 0, 7); c.fill();
  }

  function drawCrusher(c, cr, t) {
    const cx = cr.x + cr.w / 2;
    // rail
    c.strokeStyle = 'rgba(224,164,90,0.32)'; c.lineWidth = 3;
    c.beginPath(); c.moveTo(cx - 9, 0); c.lineTo(cx - 9, cr.y + 14); c.stroke();
    c.beginPath(); c.moveTo(cx + 9, 0); c.lineTo(cx + 9, cr.y + 14); c.stroke();
    c.fillStyle = 'rgba(224,164,90,0.5)';
    for (let y = 30; y < cr.y; y += 44) c.fillRect(cx - 11, y, 22, 3);
    // rod
    c.fillStyle = '#5c4025';
    c.fillRect(cx - 6, 0, 12, cr.y + 4);
    // block
    const grd = c.createLinearGradient(0, cr.y, 0, cr.y + cr.h);
    grd.addColorStop(0, '#9a6a35'); grd.addColorStop(0.25, '#d7a25d');
    grd.addColorStop(0.6, '#6f4a24'); grd.addColorStop(1, '#3a2714');
    c.fillStyle = grd;
    rr(c, cr.x, cr.y, cr.w, cr.h, 5); c.fill();
    c.strokeStyle = 'rgba(255,217,154,0.55)'; c.lineWidth = 1.4;
    rr(c, cr.x + 0.5, cr.y + 0.5, cr.w - 1, cr.h - 1, 5); c.stroke();
    // teeth
    c.fillStyle = '#d8b47a';
    for (let i = 0; i < 6; i++) {
      const tx = cr.x + 7 + i * (cr.w - 14) / 5;
      c.beginPath(); c.moveTo(tx - 5, cr.y + cr.h); c.lineTo(tx, cr.y + cr.h + 9); c.lineTo(tx + 5, cr.y + cr.h); c.fill();
    }
    // hazard warning
    const danger = cr.y + cr.h > 560;
    c.fillStyle = danger ? `rgba(227,93,76,${0.35 + 0.25 * Math.sin(t * 12)})` : 'rgba(111,227,196,0.4)';
    c.beginPath(); c.arc(cx, cr.y + 12, 3.4, 0, 7); c.fill();
    c.strokeStyle = 'rgba(10,16,28,0.5)'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(cr.x + 8, cr.y + cr.h * 0.45); c.lineTo(cr.x + cr.w - 8, cr.y + cr.h * 0.45); c.stroke();
  }

  function drawConveyor(c, cv, t) {
    c.save();
    c.fillStyle = '#111d33';
    rr(c, cv.x, cv.y - 6, cv.w, 18, 3); c.fill();
    c.strokeStyle = 'rgba(224,164,90,0.4)'; c.lineWidth = 1;
    rr(c, cv.x, cv.y - 6, cv.w, 18, 3); c.stroke();
    const ph = (t * cv.dir * 90) % 26;
    for (let x = cv.x + 6 + (ph < 0 ? 26 + ph : ph); x < cv.x + cv.w - 4; x += 26) {
      c.strokeStyle = cv.dir > 0 ? 'rgba(111,227,196,0.55)' : 'rgba(227,93,76,0.5)';
      c.lineWidth = 2;
      c.beginPath();
      if (cv.dir > 0) { c.moveTo(x, cv.y - 3); c.lineTo(x + 8, cv.y + 2); c.lineTo(x, cv.y + 7); }
      else { c.moveTo(x + 8, cv.y - 3); c.lineTo(x, cv.y + 2); c.lineTo(x + 8, cv.y + 7); }
      c.stroke();
    }
    // end rollers
    c.fillStyle = 'rgba(224,164,90,0.45)';
    for (const x of [cv.x + 3, cv.x + cv.w - 3]) {
      c.beginPath(); c.arc(x, cv.y + 3, 3.4, 0, 7); c.fill();
    }
    c.restore();
  }

  function drawMover(c, m, t) {
    const cx = m.x + m.w / 2;
    c.strokeStyle = 'rgba(224,164,90,0.25)'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(m.x + 5, 0); c.lineTo(m.x + 5, m.y + 6); c.stroke();
    c.beginPath(); c.moveTo(m.x + m.w - 5, 0); c.lineTo(m.x + m.w - 5, m.y + 6); c.stroke();
    const grd = c.createLinearGradient(m.x, 0, m.x + m.w, 0);
    grd.addColorStop(0, '#3d2a15'); grd.addColorStop(0.3, '#8f6432');
    grd.addColorStop(0.55, '#c69a5c'); grd.addColorStop(1, '#33230f');
    c.fillStyle = grd;
    rr(c, m.x, m.y, m.w, m.h, 5); c.fill();
    c.strokeStyle = 'rgba(255,217,154,0.5)'; c.lineWidth = 1.3;
    rr(c, m.x + 0.5, m.y + 0.5, m.w - 1, m.h - 1, 5); c.stroke();
    // engraved concentric gear
    makeGear(c, cx, m.y + m.h * 0.45, 17, 9, 'rgba(255,217,154,0.28)', 0.8, t * 0.5);
    // horizontal bands
    c.strokeStyle = 'rgba(20,12,6,0.5)'; c.lineWidth = 1.5;
    for (let yy = m.y + 14; yy < m.y + m.h; yy += 26) {
      c.beginPath(); c.moveTo(m.x + 5, yy); c.lineTo(m.x + m.w - 5, yy); c.stroke();
    }
    c.fillStyle = m.y + m.h > 560 ? 'rgba(227,93,76,0.6)' : 'rgba(111,227,196,0.45)';
    c.beginPath(); c.arc(cx, m.y + 9, 2.8, 0, 7); c.fill();
  }

  function drawSpikes(c, s) {
    c.fillStyle = '#2a1218';
    c.fillRect(s.x, s.y + s.h - 4, s.w, 4);
    for (let x = s.x + 4; x < s.x + s.w - 2; x += 14) {
      c.fillStyle = '#c86a5e';
      c.beginPath(); c.moveTo(x, s.y + s.h); c.lineTo(x + 6, s.y); c.lineTo(x + 12, s.y + s.h); c.fill();
      c.strokeStyle = 'rgba(255,180,160,0.35)'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(x + 6, s.y); c.lineTo(x + 11, s.y + s.h); c.stroke();
    }
  }

  function drawCollectible(c, k, t) {
    const bob = Math.sin(t * 2.1 + (k.phase || 0)) * 4;
    const x = k.x, y = k.y + bob;
    if (k.got) {
      c.save(); c.globalAlpha = 0.22;
      c.strokeStyle = C.copperDim; c.lineWidth = 1;
      c.beginPath(); c.arc(x, y, 13, 0, 7); c.stroke();
      c.restore();
      return;
    }
    c.save();
    if (k.type === 'hourglass') {
      const g = c.createRadialGradient(x, y, 2, x, y, 26);
      g.addColorStop(0, 'rgba(255,230,176,0.42)');
      g.addColorStop(1, 'rgba(255,180,80,0)');
      c.fillStyle = g; c.beginPath(); c.arc(x, y, 26, 0, 7); c.fill();
      c.strokeStyle = C.copperHi; c.lineWidth = 1.3;
      c.beginPath();
      c.moveTo(x - 9, y - 11); c.lineTo(x + 9, y - 11); c.lineTo(x, y); c.closePath();
      c.moveTo(x - 9, y + 11); c.lineTo(x + 9, y + 11); c.lineTo(x, y); c.closePath();
      c.stroke();
      c.fillStyle = 'rgba(255,215,140,0.85)';
      c.beginPath(); c.moveTo(x - 7, y - 10); c.lineTo(x + 7, y - 10); c.lineTo(x, y - 1); c.fill();
      c.beginPath(); c.moveTo(x - 5, y + 10); c.lineTo(x + 5, y + 10); c.lineTo(x, y + 3); c.fill();
      c.fillStyle = C.copper; c.fillRect(x - 10, y - 14, 20, 3); c.fillRect(x - 10, y + 11, 20, 3);
      // falling sand
      c.fillStyle = 'rgba(255,230,170,0.85)';
      c.fillRect(x - 0.6, y - 1, 1.2, 6 + (t * 5 % 4));
    } else {
      const g = c.createRadialGradient(x, y, 2, x, y, 28);
      g.addColorStop(0, 'rgba(111,227,232,0.4)');
      g.addColorStop(1, 'rgba(111,227,232,0)');
      c.fillStyle = g; c.beginPath(); c.arc(x, y, 28, 0, 7); c.fill();
      c.fillStyle = C.cyanHi;
      starPath(c, x, y, 10, 5, 0.45, t * 0.8); c.fill();
      c.strokeStyle = C.cyan; c.lineWidth = 1;
      starPath(c, x, y, 15, 5, 0.55, -t * 0.3); c.stroke();
    }
    c.restore();
  }

  function drawExit(c, ex, t, unlocked) {
    const cx = ex.x + ex.w / 2, cy = ex.y + ex.h / 2;
    c.save();
    // jade inner glow
    const g = c.createRadialGradient(cx, cy, 8, cx, cy, ex.w * 0.9);
    g.addColorStop(0, `rgba(111,227,196,${0.22 + 0.06 * Math.sin(t * 3)})`);
    g.addColorStop(1, 'rgba(111,227,196,0)');
    c.fillStyle = g; c.fillRect(ex.x - 60, ex.y - 60, ex.w + 120, ex.h + 100);
    // arch
    c.strokeStyle = C.copper; c.lineWidth = 7; c.lineCap = 'round';
    c.beginPath(); c.moveTo(ex.x + 6, ex.y + ex.h); c.lineTo(ex.x + 6, ex.y + 46);
    c.quadraticCurveTo(cx, ex.y - 18, ex.x + ex.w - 6, ex.y + 46);
    c.lineTo(ex.x + ex.w - 6, ex.y + ex.h); c.stroke();
    c.strokeStyle = 'rgba(255,217,154,0.8)'; c.lineWidth = 1.6;
    c.beginPath(); c.moveTo(ex.x + 14, ex.y + ex.h); c.lineTo(ex.x + 14, ex.y + 50);
    c.quadraticCurveTo(cx, ex.y - 6, ex.x + ex.w - 14, ex.y + 50);
    c.lineTo(ex.x + ex.w - 14, ex.y + ex.h); c.stroke();
    // inner star field
    for (let i = 0; i < 10; i++) {
      const a = t * 0.7 + i * 0.63;
      const rx = cx + Math.cos(a) * (10 + (i % 4) * 7);
      const ry = cy + Math.sin(a * 1.3) * (26 + (i % 3) * 12);
      c.fillStyle = `rgba(201,255,237,${0.25 + 0.3 * Math.sin(t * 2 + i)})`;
      c.beginPath(); c.arc(rx, ry, 1.2 + (i % 2) * 0.8, 0, 7); c.fill();
    }
    // rotating gear halo
    makeGear(c, cx, cy, 22, 10, 'rgba(224,164,90,0.5)', 0.55, t * 0.4);
    // glyph
    c.fillStyle = 'rgba(201,255,237,0.92)';
    c.font = '700 22px "STKaiti","KaiTi",serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.shadowColor = C.jade; c.shadowBlur = 14;
    c.fillText('时', cx, cy + 1);
    c.shadowBlur = 0;
    // base steps
    c.fillStyle = '#1a120a';
    c.fillRect(ex.x - 12, ex.y + ex.h - 5, ex.w + 24, 7);
    c.fillStyle = C.copperDim;
    c.fillRect(ex.x - 12, ex.y + ex.h - 5, ex.w + 24, 2);
    c.restore();
  }

  function drawParticles(c, particles, floats) {
    for (const p of particles) {
      const a = Math.max(0, p.life / p.max);
      c.globalAlpha = a;
      c.fillStyle = p.color;
      if (p.kind === 'line') {
        c.strokeStyle = p.color; c.lineWidth = p.size * 0.6;
        c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x - p.vx * 0.02, p.y - p.vy * 0.02); c.stroke();
      } else if (p.kind === 'ring') {
        c.strokeStyle = p.color; c.lineWidth = 1.6;
        c.beginPath(); c.arc(p.x, p.y, p.size * (1.6 - a), 0, 7); c.stroke();
      } else {
        c.beginPath(); c.arc(p.x, p.y, p.size * (0.4 + a * 0.6), 0, 7); c.fill();
      }
    }
    c.globalAlpha = 1;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    for (const f of floats) {
      const a = Math.max(0, Math.min(1, f.life / f.max));
      c.globalAlpha = a;
      c.font = `700 ${f.size}px "Noto Sans SC","Microsoft YaHei",sans-serif`;
      c.strokeStyle = 'rgba(4,8,16,0.8)'; c.lineWidth = 3;
      c.strokeText(f.text, f.x, f.y);
      c.fillStyle = f.color;
      c.fillText(f.text, f.x, f.y);
    }
    c.globalAlpha = 1;
  }

  function draw(v) {
    const { level, player, echoPos, echoTrail, particles, floats, cameraX, time, t,
      shakeX = 0, shakeY = 0, rewinding = false, recording = false,
      echoActive = false, deathT = 0, flashAlpha = 0, paused = false } = v;

    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, vw, vh);
    // letterbox
    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(scale, scale);
    ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();

    // background
    const bg = bgs[Math.max(0, Math.min(2, (level ? level.chapter : 1) - 1))];
    ctx.drawImage(bg, 0, 0, W, H);

    // parallax gears / background mechanism silhouettes
    const cam = cameraX || 0;
    ctx.save();
    ctx.translate(-(cam * 0.12) % W, 0);
    makeGear(ctx, 200, 300, 130, 14, C.copper, 0.045, t * 0.05);
    makeGear(ctx, 1010, 260, 96, 10, C.cyan, 0.04, -t * 0.07);
    ctx.restore();
    // distant timeline pendulum
    ctx.save();
    ctx.translate(W / 2 - (cam * 0.06) % 300, 90);
    ctx.strokeStyle = 'rgba(224,164,90,0.09)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.sin(t * 0.7) * 120, 180); ctx.stroke();
    ctx.fillStyle = 'rgba(255,217,154,0.16)';
    ctx.beginPath(); ctx.arc(Math.sin(t * 0.7) * 120, 180, 18, 0, 7); ctx.fill();
    ctx.restore();

    // world
    ctx.save();
    ctx.translate(-cam + shakeX, shakeY);
    if (level) {
      for (const p of level.platforms) drawPlatform(ctx, p, t);
      for (const sp of level.spikes) drawSpikes(ctx, sp);
      for (const cv of level.conveyors) drawConveyor(ctx, cv, t);
      for (const pl of level.plates) drawPlate(ctx, pl, t);
      for (const sw of level.switches) drawSwitch(ctx, sw, t);
      for (const l of level.lasers) drawLaser(ctx, l, t);
      for (const cr of level.crushers) drawCrusher(ctx, cr, t);
      for (const m of level.movers) drawMover(ctx, m, t);
      for (const d of level.doors) drawDoor(ctx, d, t);
      for (const k of level.collectibles) drawCollectible(ctx, k, t);
      drawExit(ctx, level.exit, t, true);

      // echo trail and silhouette
      if (echoActive && echoPos) {
        if (echoTrail && echoTrail.length) {
          for (let i = 0; i < echoTrail.length; i++) {
            const f = echoTrail[i];
            drawFigure(ctx, f.x, f.y, {
              alpha: 0.045 + i * 0.012, ghost: true, facing: f.facing, stride: 0,
              lantern: false, t,
            });
          }
        }
        drawFigure(ctx, echoPos.x, echoPos.y, {
          alpha: 0.72, ghost: true, facing: echoPos.facing || 1,
          stride: 0, lantern: true, t,
        });
        // gear halo above echo
        ctx.save();
        ctx.globalAlpha = 0.55;
        makeGear(ctx, echoPos.x + 11, echoPos.y - 12, 8, 8, C.cyan, 0.5, t * 0.9);
        ctx.restore();
        // loop ring
        ctx.strokeStyle = 'rgba(111,227,232,0.28)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(echoPos.x + 11, echoPos.y + 34, 19, 5, 0, 0, 7);
        ctx.stroke();
      }

      if (player) {
        drawFigure(ctx, player.x, player.y, {
          alpha: deathT > 0 ? 0.5 : 1,
          ghost: false, facing: player.facing, stride: player.stride,
          lantern: true, t, attack: recording ? 1 : 0,
        });
        if (recording) {
          ctx.strokeStyle = `rgba(255,211,140,${0.5 + 0.25 * Math.sin(t * 8)})`;
          ctx.lineWidth = 1.2;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.arc(player.x + 11, player.y + 16, 27, 0, 7);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
      drawParticles(ctx, particles || [], floats || []);
    }
    ctx.restore();

    // rewind / record screen treatments (within logical canvas)
    if (rewinding) {
      ctx.fillStyle = 'rgba(40,150,170,0.13)';
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(160,245,255,0.10)';
      ctx.lineWidth = 1;
      for (let y = (t * 90) % 8; y < H; y += 8) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }
      ctx.fillStyle = 'rgba(184,251,255,0.82)';
      ctx.font = '700 22px "STKaiti","KaiTi",serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.letterSpacing = '8px';
      ctx.fillText('时 间 倒 流', W / 2, 72);
    }
    if (recording) {
      ctx.strokeStyle = 'rgba(255,192,99,0.6)'; ctx.lineWidth = 2;
      const m = 18, L = 26;
      for (const [x, y, dx, dy] of [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]]) {
        ctx.beginPath(); ctx.moveTo(x + dx * L, y); ctx.lineTo(x, y); ctx.lineTo(x, y + dy * L); ctx.stroke();
      }
      ctx.fillStyle = `rgba(255,192,99,${0.7 + 0.3 * Math.sin(t * 6)})`;
      ctx.beginPath(); ctx.arc(W / 2, 38, 6, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,230,190,0.9)';
      ctx.font = '700 13px "Noto Sans SC",sans-serif';
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText('REC · 录制回声', W / 2 + 14, 38);
    }
    if (flashAlpha > 0) {
      ctx.fillStyle = `rgba(255,238,208,${flashAlpha})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (deathT > 0) {
      ctx.fillStyle = `rgba(160,30,30,${Math.min(0.35, deathT * 0.55)})`;
      ctx.fillRect(0, 0, W, H);
    }
    // vignette
    ctx.drawImage(vignette, 0, 0, W, H);

    ctx.restore();
  }

  return { resize, draw, W, H };
}
