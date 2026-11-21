// Shadowspire Ninja — procedural canvas art. Every visible mark is drawn here:
// indigo washi sky, cut-paper tower, copper/timber/stone ledges, lantern dust,
// warning caltrops and a hand-inked ninja with eight metres of scarf.

import { CFG, zoneAt } from './level.js';

const W = CFG.W, H = CFG.H, PPM = CFG.PPM;
const TAU = Math.PI * 2;

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makePaper() {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const r = rng(0x9A17C0DE);
  g.clearRect(0, 0, W, H);
  for (let i = 0; i < 4200; i++) {
    const x = r() * W, y = r() * H;
    g.fillStyle = r() < 0.68 ? `rgba(255,232,196,${0.012 + r() * 0.025})` : `rgba(0,0,0,${0.01 + r() * 0.035})`;
    g.fillRect(x, y, r() < 0.2 ? 2 : 1, 1);
  }
  for (let i = 0; i < 120; i++) {
    g.strokeStyle = `rgba(255,236,200,${0.008 + r() * 0.018})`;
    g.lineWidth = 1;
    const x = r() * W, y = r() * H;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + 8 + r() * 34, y + (r() - .5) * 8); g.stroke();
  }
  return c;
}

function polygon(g, pts, fill, stroke, lw = 1) {
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
  g.closePath();
  if (fill) { g.fillStyle = fill; g.fill(); }
  if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.stroke(); }
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d', { alpha: false });
  const paper = makePaper();
  const stars = [];
  const embers = [];
  const sr = rng(0x51A2F00D);
  for (let i = 0; i < 82; i++) {
    stars.push({ x: sr() * W, y: sr() * H, s: 0.4 + sr() * 1.6, a: 0.18 + sr() * 0.62, p: sr() * TAU, layer: sr() < .6 ? .12 : .24 });
  }
  for (let i = 0; i < 34; i++) {
    embers.push({ x: sr() * W, y: sr() * H, s: 0.7 + sr() * 1.8, sp: 5 + sr() * 18, p: sr() * TAU });
  }
  const constellations = [
    [[0.10, 0.19], [0.16, 0.14], [0.21, 0.22], [0.28, 0.18], [0.31, 0.27]],
    [[0.67, 0.12], [0.72, 0.08], [0.79, 0.14], [0.84, 0.09], [0.88, 0.18], [0.81, 0.22]],
    [[0.43, 0.31], [0.49, 0.27], [0.55, 0.33], [0.61, 0.29]],
  ];

  let DPR = 1;
  function setup() {
    DPR = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.imageSmoothingEnabled = true;
  }
  setup();

  function sy(worldY, camY) { return H - (worldY - camY) * PPM; }
  function sx(worldX) { return worldX * PPM; }

  function drawSky(scene) {
    const cam = scene.cameraY;
    const mid = cam + H / PPM * 0.5;
    const z = zoneAt(mid);
    const t = scene.t;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    if (z.id === 'wood') {
      g.addColorStop(0, '#120d20'); g.addColorStop(0.42, '#251529'); g.addColorStop(1, '#2d1a27');
    } else if (z.id === 'wind') {
      g.addColorStop(0, '#09141f'); g.addColorStop(0.5, '#123039'); g.addColorStop(1, '#18312f');
    } else {
      g.addColorStop(0, '#0d0820'); g.addColorStop(0.52, '#211440'); g.addColorStop(1, '#2b1940');
    }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // moon / lantern halo
    const moonX = W * 0.76, moonY = 152 + Math.sin(t * 0.09) * 4;
    const halo = ctx.createRadialGradient(moonX, moonY, 6, moonX, moonY, 118);
    halo.addColorStop(0, z.id === 'wind' ? 'rgba(203,255,239,.34)' : 'rgba(255,226,158,.32)');
    halo.addColorStop(0.28, z.id === 'star' ? 'rgba(240,213,145,.12)' : 'rgba(224,181,111,.10)');
    halo.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = halo;
    ctx.beginPath(); ctx.arc(moonX, moonY, 118, 0, TAU); ctx.fill();
    ctx.fillStyle = z.id === 'wind' ? '#d7f4e4' : '#f2dfaa';
    ctx.globalAlpha = 0.68;
    ctx.beginPath(); ctx.arc(moonX, moonY, 34, 0, TAU); ctx.fill();
    ctx.globalAlpha = 0.22;
    ctx.beginPath(); ctx.arc(moonX - 7, moonY - 8, 34, 0, TAU); ctx.stroke();
    ctx.globalAlpha = 1;

    // parallax stars
    for (const s of stars) {
      let yy = (s.y - cam * s.layer * PPM * 0.08 + t * 1.2) % H;
      if (yy < 0) yy += H;
      const tw = 0.5 + 0.5 * Math.sin(t * 1.4 + s.p);
      ctx.fillStyle = `rgba(255,242,203,${s.a * (0.45 + tw * 0.55)})`;
      ctx.beginPath(); ctx.arc(s.x, yy, s.s * (0.8 + tw * 0.3), 0, TAU); ctx.fill();
    }

    // constellations in the star district
    if (z.id === 'star') {
      ctx.strokeStyle = 'rgba(255,232,171,.13)';
      ctx.lineWidth = 1;
      for (const c of constellations) {
        ctx.beginPath();
        c.forEach(([x, y], i) => i ? ctx.lineTo(x * W, y * H * 0.8 + 60) : ctx.moveTo(x * W, y * H * 0.8 + 60));
        ctx.stroke();
        for (const [x, y] of c) {
          ctx.fillStyle = 'rgba(255,240,190,.55)';
          ctx.beginPath(); ctx.arc(x * W, y * H * 0.8 + 60, 1.5, 0, TAU); ctx.fill();
        }
      }
    }

    // distant roof silhouettes / tower ribs
    ctx.save();
    ctx.globalAlpha = 0.54;
    ctx.fillStyle = z.id === 'wind' ? 'rgba(4,15,20,.72)' : 'rgba(10,6,18,.72)';
    const off = ((-cam * 2.3) % 290 + 290) % 290;
    for (let i = -1; i < 4; i++) {
      const bx = -80 + i * 190 + off * 0.18;
      ctx.beginPath();
      ctx.moveTo(bx, H);
      ctx.lineTo(bx + 14, H);
      ctx.lineTo(bx + 14, 300);
      ctx.lineTo(bx + 64, 268);
      ctx.lineTo(bx + 114, 300);
      ctx.lineTo(bx + 114, H);
      ctx.lineTo(bx + 128, H);
      ctx.lineTo(bx + 128, 282);
      ctx.lineTo(bx + 64, 238);
      ctx.lineTo(bx, 282);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,220,167,.08)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.restore();

    // zone-specific drifting weather
    if (z.id === 'wind') {
      ctx.strokeStyle = 'rgba(171,236,219,.10)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 12; i++) {
        const yy = (i * 83 + t * (24 + i * 3)) % H;
        const xx = ((i * 137 + t * (38 + i * 4)) % (W + 200)) - 100;
        ctx.beginPath();
        ctx.moveTo(xx, yy);
        ctx.bezierCurveTo(xx + 34, yy - 7, xx + 72, yy + 5, xx + 114, yy - 2);
        ctx.stroke();
      }
    } else if (z.id === 'wood') {
      for (const e of embers) {
        const yy = (e.y - t * e.sp) % H;
        const xx = e.x + Math.sin(t * 0.9 + e.p) * 9;
        ctx.fillStyle = `rgba(255,178,92,${0.12 + 0.16 * (0.5 + 0.5 * Math.sin(t + e.p))})`;
        ctx.beginPath(); ctx.arc(xx, yy < 0 ? yy + H : yy, e.s, 0, TAU); ctx.fill();
      }
    } else {
      ctx.fillStyle = 'rgba(236,219,158,.18)';
      for (let i = 0; i < 20; i++) {
        const xx = ((i * 71 + t * 6) % W);
        const yy = ((i * 137 + t * 11) % H);
        ctx.fillRect(xx, yy, 1, 1);
      }
    }

    // atmospheric haze bands
    for (let i = 0; i < 4; i++) {
      const yy = ((i * 251 + cam * 2.8 + t * 2) % (H + 160)) - 80;
      const fg = ctx.createLinearGradient(0, yy - 40, 0, yy + 40);
      fg.addColorStop(0, 'rgba(0,0,0,0)');
      fg.addColorStop(0.5, z.id === 'wind' ? 'rgba(120,208,190,.035)' : 'rgba(201,145,92,.032)');
      fg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = fg;
      ctx.fillRect(0, yy - 40, W, 80);
    }
  }

  function drawTowerFrame(scene) {
    const cam = scene.cameraY, sh = scene.shakeY;
    const z = zoneAt(cam + 25);
    const y0 = Math.floor(cam / 10) * 10 - 10;
    for (let wy = y0; wy < cam + H / PPM + 12; wy += 10) {
      const yy = sy(wy, cam, sh);
      const alpha = 0.3;
      // cross brace
      ctx.strokeStyle = z.id === 'wind' ? `rgba(104,181,163,${alpha})` : `rgba(146,87,55,${alpha})`;
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(8, yy); ctx.lineTo(W - 8, yy); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,226,176,.10)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(8, yy - 2); ctx.lineTo(W - 8, yy - 2); ctx.stroke();
      // side diagonals
      if (((wy / 10) | 0) % 2 === 0) {
        ctx.strokeStyle = z.id === 'star' ? 'rgba(212,182,108,.13)' : 'rgba(220,166,104,.11)';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(14, yy); ctx.lineTo(76, yy + 96); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(W - 14, yy); ctx.lineTo(W - 76, yy + 96); ctx.stroke();
      }
      // hanging paper charm, one every 40 m
      if (((wy / 10) | 0) % 4 === 0) {
        const bx = ((wy / 10) | 0) % 8 === 0 ? 79 : W - 79;
        ctx.strokeStyle = 'rgba(29,16,31,.7)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(bx, yy); ctx.lineTo(bx, yy + 19); ctx.stroke();
        polygon(ctx, [[bx - 9, yy + 19], [bx + 9, yy + 19], [bx + 7, yy + 49], [bx, yy + 55], [bx - 7, yy + 49]], 'rgba(202,170,113,.16)', 'rgba(231,196,127,.32)', 1);
        ctx.fillStyle = 'rgba(201,82,62,.55)';
        ctx.font = '10px "KaiTi","STKaiti",serif';
        ctx.textAlign = 'center';
        ctx.fillText('影', bx, yy + 38);
      }
    }
    // vertical boundary framing
    const vg = ctx.createLinearGradient(0, 0, 24, 0);
    vg.addColorStop(0, 'rgba(0,0,0,.46)'); vg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, 24, H);
    const vg2 = ctx.createLinearGradient(W, 0, W - 24, 0);
    vg2.addColorStop(0, 'rgba(0,0,0,.46)'); vg2.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = vg2; ctx.fillRect(W - 24, 0, 24, H);
  }

  function drawWall(w, cam, sh, t) {
    const x = sx(w.x, sx(0, 0));
    const yTop = sy(w.y + w.h, cam, sh);
    const hh = w.h * PPM;
    const ww = w.w * PPM;
    if (yTop > H + 20 || yTop + hh < -20) return;
    const z = zoneAt(w.y + w.h / 2);
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.28)';
    ctx.fillRect(x + 4, yTop + 4, ww, hh);
    const g = ctx.createLinearGradient(x, 0, x + ww, 0);
    if (z.id === 'wind') {
      g.addColorStop(0, '#132e30'); g.addColorStop(0.55, '#1f4d48'); g.addColorStop(1, '#0c2125');
    } else if (z.id === 'star') {
      g.addColorStop(0, '#1b122e'); g.addColorStop(0.55, '#34214c'); g.addColorStop(1, '#140d26');
    } else {
      g.addColorStop(0, '#2a1819'); g.addColorStop(0.55, '#4a2a24'); g.addColorStop(1, '#211316');
    }
    ctx.fillStyle = g;
    ctx.fillRect(x, yTop, ww, hh);
    // cap
    ctx.fillStyle = z.accent;
    ctx.globalAlpha = 0.72;
    ctx.fillRect(x - 2, yTop - 2, ww + 4, 3);
    ctx.globalAlpha = 1;

    if (z.id === 'wood') {
      ctx.strokeStyle = 'rgba(255,197,125,.15)';
      ctx.lineWidth = 1;
      for (let i = 8; i < hh; i += 18) {
        ctx.beginPath(); ctx.moveTo(x + 3, yTop + i); ctx.lineTo(x + ww - 2, yTop + i); ctx.stroke();
      }
      ctx.fillStyle = 'rgba(19,12,15,.5)';
      for (let i = 14; i < hh; i += 38) {
        ctx.beginPath(); ctx.arc(x + ww * 0.5, yTop + i, 2, 0, TAU); ctx.fill();
      }
      // hanging talisman
      if (hh > 45) {
        ctx.fillStyle = 'rgba(227,203,158,.58)';
        ctx.fillRect(x + ww * .22, yTop + 13, ww * .48, 15);
        ctx.fillStyle = 'rgba(118,44,37,.72)';
        ctx.font = '9px "KaiTi","STKaiti",serif';
        ctx.textAlign = 'center';
        ctx.fillText('風', x + ww * .46, yTop + 24);
      }
    } else if (z.id === 'wind') {
      ctx.strokeStyle = 'rgba(152,235,208,.18)';
      ctx.lineWidth = 1;
      for (let i = 6; i < hh; i += 15) {
        ctx.beginPath(); ctx.moveTo(x + 2, yTop + i); ctx.lineTo(x + ww - 2, yTop + i + 1.5); ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(12,35,35,.55)';
      for (let i = 23; i < hh; i += 52) {
        ctx.beginPath(); ctx.moveTo(x, yTop + i); ctx.lineTo(x + ww, yTop + i); ctx.lineWidth = 3; ctx.stroke();
      }
    } else {
      ctx.strokeStyle = 'rgba(231,198,112,.22)';
      ctx.lineWidth = 1;
      for (let i = 10; i < hh; i += 22) {
        ctx.beginPath(); ctx.moveTo(x + 2, yTop + i); ctx.lineTo(x + ww - 2, yTop + i); ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(229,193,104,.28)';
      ctx.beginPath();
      ctx.moveTo(x + ww * .5, yTop + 8);
      ctx.lineTo(x + ww * .5, yTop + hh - 8);
      ctx.stroke();
      for (let i = 28; i < hh; i += 60) {
        ctx.strokeStyle = 'rgba(229,193,104,.42)';
        ctx.beginPath(); ctx.arc(x + ww * .5, yTop + i, 5, 0, TAU); ctx.stroke();
      }
    }
    // inner pillar gets a paper-cut notch
    if (w.inner) {
      ctx.fillStyle = z.accent2;
      ctx.globalAlpha = .7;
      polygon(ctx, [[x, yTop], [x - 5, yTop + 8], [x, yTop + 16]], z.accent2);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  function drawPlatform(p, cam, sh, t) {
    const x = sx(p.x, sceneShakeX);
    const top = sy(p.y, cam, sh);
    const w = p.w * PPM;
    const h = Math.max(8, p.h * PPM);
    if (top > H + 30 || top + h < -30) return;
    const z = zoneAt(p.y);
    ctx.save();
    // paper shadow
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    ctx.fillRect(x + 4, top + 7, w, h + 2);

    const g = ctx.createLinearGradient(0, top, 0, top + h);
    if (p.kind === 'finish') {
      g.addColorStop(0, '#e2c06d'); g.addColorStop(1, '#5d3b38');
    } else if (z.id === 'wind') {
      g.addColorStop(0, '#285a51'); g.addColorStop(0.24, '#80cbb6'); g.addColorStop(0.3, '#2c5b52'); g.addColorStop(1, '#122e2c');
    } else if (z.id === 'star') {
      g.addColorStop(0, '#3a2857'); g.addColorStop(0.22, '#e0bd6b'); g.addColorStop(0.28, '#3a2853'); g.addColorStop(1, '#171026');
    } else {
      g.addColorStop(0, '#4f2b25'); g.addColorStop(0.22, '#d99a55'); g.addColorStop(0.29, '#5a3027'); g.addColorStop(1, '#281618');
    }
    ctx.fillStyle = g;
    ctx.fillRect(x, top, w, h);

    // top light lip
    ctx.fillStyle = z.glow;
    ctx.globalAlpha = p.checkpoint ? .95 : .64;
    ctx.fillRect(x + 1, top, w - 2, 2);
    ctx.globalAlpha = 1;

    // ink wood grain
    ctx.strokeStyle = z.id === 'wind' ? 'rgba(9,31,30,.42)' : z.id === 'star' ? 'rgba(15,8,26,.5)' : 'rgba(29,13,12,.42)';
    ctx.lineWidth = 1;
    for (let i = 10; i < w - 8; i += 22 + ((p.seed * 17) | 0) % 9) {
      ctx.beginPath();
      ctx.moveTo(x + i, top + 4);
      ctx.bezierCurveTo(x + i + 7, top + h * .35, x + i - 4, top + h * .65, x + i + 10, top + h - 2);
      ctx.stroke();
    }

    // paper-cut teeth under the edge
    ctx.fillStyle = z.ink;
    ctx.globalAlpha = .7;
    for (let i = 4; i < w - 2; i += 22) {
      polygon(ctx, [[x + i, top + h], [x + i + 7, top + h + 7], [x + i + 14, top + h]], z.ink);
    }
    ctx.globalAlpha = 1;
    // little bracket supports give the ledges a built, paper-cut silhouette
    ctx.strokeStyle = z.id === 'wind' ? 'rgba(77,153,136,.55)' : 'rgba(109,63,44,.62)';
    ctx.lineWidth = 2;
    for (const bx of [x + 8, x + w - 8]) {
      ctx.beginPath(); ctx.moveTo(bx, top + h + 1); ctx.lineTo(bx + (bx < x + w / 2 ? 4 : -4), top + h + 10); ctx.stroke();
    }

    // copper end caps
    ctx.fillStyle = z.id === 'wind' ? '#8de0c5' : '#d9aa62';
    ctx.globalAlpha = .7;
    ctx.fillRect(x - 3, top - 1, 3, h + 1);
    ctx.fillRect(x + w, top - 1, 3, h + 1);
    ctx.globalAlpha = 1;

    if (p.checkpoint) {
      ctx.strokeStyle = 'rgba(255,228,155,.7)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x - 1.5, top - 1.5, w + 3, h + 2);
      ctx.fillStyle = 'rgba(255,225,147,.85)';
      ctx.font = 'bold 9px "KaiTi","STKaiti",serif';
      ctx.textAlign = 'center';
      ctx.fillText('灯 标', x + w / 2, top + h + 14);
    }
    ctx.restore();
  }

  function drawHazard(h, cam, sh, t) {
    const x = sx(h.x, sceneShakeX);
    const top = sy(h.y, cam, sh);
    const w = h.w * PPM;
    if (top > H + 20 || top < -30) return;
    if (h.kind === 'caltrop') {
      ctx.save();
      ctx.fillStyle = 'rgba(255,88,66,.1)';
      ctx.beginPath(); ctx.ellipse(x + w / 2, top + 1, w * .72, 5, 0, 0, TAU); ctx.fill();
      for (let i = 0; i < 4; i++) {
        const bx = x + 3 + i * (w - 6) / 4;
        polygon(ctx, [[bx, top], [bx + 5, top - 10 - (i % 2) * 2], [bx + 10, top]], '#bd4434', 'rgba(255,177,130,.55)', 0.7);
        ctx.fillStyle = 'rgba(255,205,157,.8)';
        ctx.fillRect(bx + 4.5, top - 4, 1, 3);
        ctx.fillStyle = '#bd4434';
      }
      ctx.restore();
      return;
    }
    const active = h.active;
    const warn = h.warn;
    ctx.save();
    // socket
    ctx.fillStyle = '#181020';
    ctx.fillRect(x, top - 3, w, 4);
    ctx.fillStyle = warn ? 'rgba(224,79,55,.46)' : 'rgba(100,72,94,.55)';
    ctx.fillRect(x + 1, top - 2, w - 2, 1.5);
    if (warn) {
      const pulse = .5 + .5 * Math.sin(t * 18);
      const gr = ctx.createRadialGradient(x + w / 2, top - 10, 2, x + w / 2, top - 10, w * .9);
      gr.addColorStop(0, `rgba(255,94,64,${.22 + pulse * .2})`);
      gr.addColorStop(1, 'rgba(255,94,64,0)');
      ctx.fillStyle = gr;
      ctx.beginPath(); ctx.arc(x + w / 2, top - 8, w * .9, 0, TAU); ctx.fill();
      ctx.strokeStyle = `rgba(255,164,112,${.35 + pulse * .45})`;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(x + w / 2, top - 1, w * .62, 3.5, 0, 0, TAU); ctx.stroke();
      ctx.fillStyle = `rgba(255,210,160,${.55 + pulse * .35})`;
      ctx.font = 'bold 10px "KaiTi",serif';
      ctx.textAlign = 'center';
      ctx.fillText('!', x + w / 2, top - 13);
    }
    if (active) {
      for (let i = 0; i < 5; i++) {
        const bx = x + 1 + i * (w - 2) / 5;
        polygon(ctx, [[bx, top], [bx + 4.4, top - 14], [bx + 8.8, top]], '#cf4a36', 'rgba(255,179,125,.6)', .7);
      }
      ctx.fillStyle = 'rgba(255,120,80,.16)';
      ctx.beginPath(); ctx.ellipse(x + w / 2, top - 1, w * .62, 4, 0, 0, TAU); ctx.fill();
    } else if (!warn) {
      // retracted teeth slots
      for (let i = 0; i < 5; i++) {
        const bx = x + 2 + i * (w - 4) / 5;
        ctx.fillStyle = 'rgba(121,83,104,.5)';
        ctx.fillRect(bx, top - 1, 5, 1.5);
      }
    }
    ctx.restore();
  }

  function drawPickup(p, cam, sh, t) {
    if (p.taken) return;
    const x = sx(p.x, sceneShakeX);
    const y = sy(p.y + Math.sin(t * 2.3 + p.phase) * 0.18, cam, sh);
    if (x < -20 || x > W + 20 || y < -20 || y > H + 20) return;
    const pulse = .72 + .28 * Math.sin(t * 3 + p.phase);
    ctx.save();
    const g = ctx.createRadialGradient(x, y, 0, x, y, 20);
    g.addColorStop(0, `rgba(255,234,160,${.45 * pulse})`);
    g.addColorStop(.35, `rgba(255,184,83,${.18 * pulse})`);
    g.addColorStop(1, 'rgba(255,184,83,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, 20, 0, TAU); ctx.fill();
    ctx.translate(x, y);
    ctx.rotate(t * .7 + p.phase);
    ctx.fillStyle = '#ffe3a0';
    ctx.beginPath();
    ctx.moveTo(0, -5.5); ctx.quadraticCurveTo(2.2, -2.2, 5.5, 0);
    ctx.quadraticCurveTo(2.2, 2.2, 0, 5.5); ctx.quadraticCurveTo(-2.2, 2.2, -5.5, 0);
    ctx.quadraticCurveTo(-2.2, -2.2, 0, -5.5);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,225,.8)';
    ctx.lineWidth = .8;
    ctx.beginPath(); ctx.moveTo(0, -3); ctx.lineTo(0, 3); ctx.stroke();
    ctx.restore();
  }

  function drawLantern(l, cam, sh, t) {
    const x = sx(l.x, sceneShakeX);
    const y = sy(l.y + Math.sin(t * 1.1 + l.phase) * 0.12, cam, sh);
    if (x < -40 || x > W + 40 || y < -40 || y > H + 40) return;
    const z = zoneAt(l.y);
    ctx.save();
    ctx.strokeStyle = 'rgba(35,22,32,.7)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, y - 25); ctx.lineTo(x, y - 9); ctx.stroke();
    const glow = ctx.createRadialGradient(x, y, 1, x, y, 28);
    glow.addColorStop(0, z.id === 'wind' ? 'rgba(162,255,224,.24)' : 'rgba(255,210,126,.25)');
    glow.addColorStop(1, 'rgba(255,180,80,0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(x, y, 28, 0, TAU); ctx.fill();
    ctx.fillStyle = z.id === 'wind' ? 'rgba(159,231,211,.8)' : z.id === 'star' ? 'rgba(244,226,165,.85)' : 'rgba(238,184,105,.85)';
    ctx.beginPath(); ctx.ellipse(x, y - 3, 5 * l.scale, 8 * l.scale, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(30,20,26,.8)';
    ctx.fillRect(x - 5 * l.scale, y - 11 * l.scale, 10 * l.scale, 2);
    ctx.fillRect(x - 3 * l.scale, y + 5 * l.scale, 6 * l.scale, 1.5);
    ctx.restore();
  }

  function drawGate(g, cam, sh, t, checkpointY, mode) {
    const x = sx(g.x, sceneShakeX);
    const y = sy(g.y, cam, sh);
    if (y > H + 130 || y < -160) return;
    const active = g.height <= checkpointY || (g.finish && mode === 'win');
    const z = zoneAt(g.y);
    const half = g.finish ? 4.6 : 3.1;
    ctx.save();
    // glow on the deck
    const gl = ctx.createRadialGradient(x, y - 16, 2, x, y - 16, 70);
    gl.addColorStop(0, active ? 'rgba(137,237,203,.22)' : 'rgba(220,170,95,.10)');
    gl.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gl;
    ctx.beginPath(); ctx.arc(x, y - 16, 70, 0, TAU); ctx.fill();

    // posts
    ctx.lineCap = 'round';
    ctx.strokeStyle = g.finish ? '#e3c374' : z.accent;
    ctx.lineWidth = g.finish ? 4 : 3;
    ctx.beginPath(); ctx.moveTo(x - half * PPM, y); ctx.lineTo(x - half * PPM, y - 58); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + half * PPM, y); ctx.lineTo(x + half * PPM, y - 58); ctx.stroke();
    // curved lintel
    ctx.lineWidth = g.finish ? 5 : 3.5;
    ctx.beginPath();
    ctx.moveTo(x - half * PPM - 9, y - 54);
    ctx.quadraticCurveTo(x, y - 70, x + half * PPM + 9, y - 54);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,238,188,.38)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - half * PPM - 9, y - 57);
    ctx.quadraticCurveTo(x, y - 73, x + half * PPM + 9, y - 57);
    ctx.stroke();

    // hanging lantern
    const swing = Math.sin(t * 1.2 + g.idx) * 3;
    ctx.strokeStyle = 'rgba(54,30,33,.7)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, y - 59); ctx.lineTo(x + swing, y - 39); ctx.stroke();
    const lg = ctx.createRadialGradient(x + swing, y - 32, 1, x + swing, y - 32, 32);
    lg.addColorStop(0, active ? 'rgba(169,255,220,.5)' : 'rgba(255,209,126,.32)');
    lg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = lg;
    ctx.beginPath(); ctx.arc(x + swing, y - 32, 32, 0, TAU); ctx.fill();
    ctx.fillStyle = active ? '#a9f0d2' : '#e8b76f';
    ctx.beginPath(); ctx.ellipse(x + swing, y - 33, 6.5, 10, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(32,21,26,.8)';
    ctx.fillRect(x + swing - 6, y - 44, 12, 2);
    if (active) {
      ctx.strokeStyle = 'rgba(159,240,207,.45)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(x + swing, y - 33, 17 + Math.sin(t * 2) * 2, 0, TAU); ctx.stroke();
    }
    // height plaque
    ctx.fillStyle = 'rgba(22,14,24,.62)';
    ctx.fillRect(x - 18, y - 52, 36, 13);
    ctx.fillStyle = active ? '#b9f3d9' : '#e5bf7b';
    ctx.font = '9px "KaiTi","STKaiti",serif';
    ctx.textAlign = 'center';
    ctx.fillText(g.finish ? '星阁' : `${g.height}m`, x, y - 42);

    if (g.finish) {
      ctx.fillStyle = 'rgba(255,233,162,.14)';
      ctx.beginPath(); ctx.arc(x, y - 108, 42, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(255,233,162,.4)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(x, y - 108, 42, 0, TAU); ctx.stroke();
      ctx.fillStyle = 'rgba(255,238,185,.8)';
      ctx.beginPath(); ctx.arc(x, y - 108, 23, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  function drawScarf(p, cam, sh, t) {
    const pts = p.trail || [];
    if (pts.length < 2) return;
    ctx.save();
    ctx.lineCap = 'round';
    for (let pass = 0; pass < 2; pass++) {
      ctx.beginPath();
      for (let i = 0; i < pts.length; i++) {
        const q = pts[i];
        const x = sx(q.x, sceneShakeX);
        const y = sy(q.y, cam, sh);
        if (i === 0) ctx.moveTo(x, y);
        else {
          const prev = pts[i - 1];
          const px = sx(prev.x, sceneShakeX), py = sy(prev.y, cam, sh);
          ctx.quadraticCurveTo((px + x) / 2, (py + y) / 2 + Math.sin(t * 6 + i) * 1.5, x, y);
        }
      }
      ctx.strokeStyle = pass === 0 ? 'rgba(70,20,28,.32)' : '#c84e3b';
      ctx.lineWidth = pass === 0 ? 4.6 : 2.0;
      ctx.globalAlpha = pass === 0 ? .34 : .62;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawPlayer(p, cam, sh, t, scene) {
    if (p.invulnT > 0 && Math.floor(t * 25) % 2 === 0 && !p.dashT) return;
    const x = sx(p.x, sceneShakeX);
    const feet = sy(p.y, cam, sh);
    if (x < -100 || x > W + 100 || feet < -100 || feet > H + 100) return;

    // dash afterimages
    if (scene.ghosts && scene.ghosts.length) {
      for (const gh of scene.ghosts) {
        const gx = sx(gh.x, sceneShakeX), gy = sy(gh.y, cam, sh);
        ctx.save();
        ctx.globalAlpha = gh.life * .18;
        ctx.fillStyle = '#c84e3b';
        ctx.beginPath(); ctx.ellipse(gx, gy - 17, 7, 19, gh.rot || 0, 0, TAU); ctx.fill();
        ctx.restore();
      }
    }

    // scarf trail is in absolute screen space; the body gets its own transform
    drawScarf(p, cam, sh, t);

    // warm rim behind the silhouette so the ninja reads against the tower
    const aura = ctx.createRadialGradient(x, feet - 28, 1, x, feet - 28, 42);
    aura.addColorStop(0, 'rgba(255,208,131,.20)');
    aura.addColorStop(.46, 'rgba(198,83,62,.09)');
    aura.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = aura;
    ctx.beginPath(); ctx.arc(x, feet - 28, 42, 0, TAU); ctx.fill();

    ctx.save();
    ctx.translate(x, feet);
    const air = Math.max(0, Math.min(1, 1 - Math.abs(p.vy) / 12));
    ctx.fillStyle = `rgba(0,0,0,${0.18 + air * 0.12})`;
    ctx.beginPath(); ctx.ellipse(0, 2, 12, 3.5, 0, 0, TAU); ctx.fill();

    const face = p.face >= 0 ? 1 : -1;
    ctx.scale(face * 1.42, 1.42);
    const speed = Math.min(1, Math.abs(p.vx) / 7.5);
    const run = p.grounded ? Math.sin(t * 15 + speed * 5) * (0.35 + speed * 0.8) : 0;
    const bob = p.grounded ? Math.abs(Math.sin(t * 15)) * 1.2 * speed : 0;
    const tilt = p.dashT ? 0.42 : p.wallDir ? -p.wallDir * face * 0.14 : 0;
    ctx.rotate(tilt);
    ctx.translate(0, -bob);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const limb = (x1, y1, x2, y2, w = 2.7, bend = 0) => {
      ctx.strokeStyle = 'rgba(230,186,119,.30)';
      ctx.lineWidth = w + 1.15;
      ctx.beginPath(); ctx.moveTo(x1, y1);
      if (bend) ctx.quadraticCurveTo((x1 + x2) / 2 + bend, (y1 + y2) / 2, x2, y2);
      else ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.strokeStyle = '#1a1730';
      ctx.lineWidth = w;
      ctx.beginPath(); ctx.moveTo(x1, y1);
      if (bend) ctx.quadraticCurveTo((x1 + x2) / 2 + bend, (y1 + y2) / 2, x2, y2);
      else ctx.lineTo(x2, y2);
      ctx.stroke();
    };

    // the long local scarf tail is drawn behind the body
    const flap = Math.sin(t * 5.4) * 2.4;
    ctx.strokeStyle = 'rgba(30,15,25,.50)';
    ctx.lineWidth = 4.6;
    ctx.beginPath();
    ctx.moveTo(-3.4, -26);
    ctx.bezierCurveTo(-12, -30 + flap, -18, -23 - flap, -27, -27 + flap * 1.5);
    ctx.stroke();
    ctx.strokeStyle = '#c84e3b';
    ctx.lineWidth = 2.35;
    ctx.beginPath();
    ctx.moveTo(-3.4, -26);
    ctx.bezierCurveTo(-12, -30 + flap, -18, -23 - flap, -27, -27 + flap * 1.5);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,151,111,.55)';
    ctx.lineWidth = .7;
    ctx.beginPath();
    ctx.moveTo(-4, -26.8);
    ctx.bezierCurveTo(-12, -30.6 + flap, -18, -23.6 - flap, -26, -27.4 + flap * 1.5);
    ctx.stroke();

    // legs
    if (p.dashT) {
      limb(-1, -11, -12, -9, 3.1, -1.5);
      limb(1, -11, -9, -2.5, 3.1, 1);
    } else if (!p.grounded) {
      const tuck = p.vy > 0 ? 4 : 2;
      limb(-1, -11, -5, -5 - tuck, 3, -0.5);
      limb(1.5, -11, 8, -7.5 - tuck, 3, 0.8);
    } else {
      const stride = run * 8;
      limb(-1, -11, -3 - stride, -1, 3, -1.2);
      limb(1.5, -11, 3 + stride, -1, 3, 0.8);
      ctx.strokeStyle = 'rgba(238,205,146,.55)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(-3 - stride, -1.2); ctx.lineTo(-1 - stride, -0.8); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(3 + stride, -1.2); ctx.lineTo(5 + stride, -0.8); ctx.stroke();
    }

    // torso — broader shoulders and a tapered waist keep the ninja readable
    ctx.beginPath();
    ctx.moveTo(-5.6, -24.6);
    ctx.quadraticCurveTo(-7.2, -17, -4.4, -10.2);
    ctx.quadraticCurveTo(0, -7.2, 4.8, -10.6);
    ctx.quadraticCurveTo(6.8, -17.6, 4.4, -24.8);
    ctx.quadraticCurveTo(-0.5, -27.2, -5.6, -24.6);
    ctx.closePath();
    const bodyGrad = ctx.createLinearGradient(-6, -24, 6, -10);
    bodyGrad.addColorStop(0, '#19152e');
    bodyGrad.addColorStop(.58, '#272142');
    bodyGrad.addColorStop(1, '#121024');
    ctx.fillStyle = bodyGrad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(232,194,128,.45)';
    ctx.lineWidth = 0.85;
    ctx.stroke();
    // sash and chest ribbon
    ctx.fillStyle = '#b84a38';
    ctx.beginPath();
    ctx.moveTo(-5.4, -15.2); ctx.lineTo(5.8, -14.5); ctx.lineTo(5.4, -11.6); ctx.lineTo(-5.0, -12.4);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,178,123,.55)';
    ctx.lineWidth = .8;
    ctx.beginPath(); ctx.moveTo(-4.8, -13.5); ctx.lineTo(5, -12.7); ctx.stroke();
    // shoulder wrap
    ctx.fillStyle = 'rgba(70,59,103,.9)';
    ctx.beginPath(); ctx.ellipse(1.8, -23.2, 4.0, 2.2, -0.12, 0, TAU); ctx.fill();

    // arms
    if (p.dashT) {
      limb(3, -23, -7, -25, 2.7, -1.5);
      limb(1, -21.5, -9, -17, 2.7, -1);
    } else if (p.wallDir) {
      limb(3.6, -23, 10, -19.5, 2.7, 1);
      limb(-1.5, -21.5, -5, -14, 2.6, -0.5);
    } else {
      limb(3.2, -23, 6 - run * 2.2, -15.5, 2.7, 1);
      limb(-2.2, -22, -5 + run * 2.2, -14.8, 2.6, -0.8);
    }

    // head: hood, skin sliver, mask band, jade eye
    ctx.fillStyle = '#d9a46e';
    ctx.beginPath(); ctx.arc(1.1, -29.5, 5.35, 0, TAU); ctx.fill();
    ctx.fillStyle = '#19152e';
    ctx.beginPath();
    ctx.arc(0.0, -30.7, 5.75, Math.PI * 0.72, Math.PI * 2.15);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(232,194,128,.4)';
    ctx.lineWidth = .75;
    ctx.beginPath(); ctx.arc(0.0, -30.7, 5.75, Math.PI * 0.72, Math.PI * 2.15); ctx.stroke();
    // mask band over the lower face
    ctx.fillStyle = '#b84a38';
    ctx.beginPath();
    ctx.moveTo(-4.2, -28.0); ctx.lineTo(5.4, -29.1); ctx.lineTo(5.1, -31.0); ctx.lineTo(-4.8, -30.1);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,190,138,.45)';
    ctx.lineWidth = .65;
    ctx.beginPath(); ctx.moveTo(-3.8, -29.4); ctx.lineTo(4.8, -30.1); ctx.stroke();
    // eye
    ctx.fillStyle = '#b7f2d1';
    ctx.beginPath(); ctx.ellipse(3.25, -30.1, 1.65, .85, -.08, 0, TAU); ctx.fill();
    ctx.fillStyle = '#1a171f';
    ctx.beginPath(); ctx.arc(3.75, -30.1, .48, 0, TAU); ctx.fill();
    // headband ribbons
    const tail = Math.sin(t * 7.5) * 2.2;
    ctx.strokeStyle = '#c84e3b';
    ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(-4.4, -32.2); ctx.quadraticCurveTo(-10.5, -35 + tail, -16, -29.5 + tail); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,150,110,.45)';
    ctx.lineWidth = .7;
    ctx.beginPath(); ctx.moveTo(-4.6, -31.8); ctx.quadraticCurveTo(-10.5, -34.2 + tail, -15.5, -28.8 + tail); ctx.stroke();

    // blade strapped to the back
    ctx.save();
    ctx.rotate(-0.62);
    ctx.strokeStyle = 'rgba(220,246,233,.78)';
    ctx.lineWidth = 1.35;
    ctx.beginPath(); ctx.moveTo(-3.8, -8); ctx.lineTo(-1.4, -29); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,240,.32)';
    ctx.lineWidth = .55;
    ctx.beginPath(); ctx.moveTo(-4.6, -8); ctx.lineTo(-2.2, -29); ctx.stroke();
    ctx.strokeStyle = '#d9aa62';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-4.8, -7.2); ctx.lineTo(-0.8, -1.8); ctx.stroke();
    ctx.restore();

    if (p.dashT) {
      ctx.strokeStyle = 'rgba(255,226,166,.55)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(-15 - i * 5, -23 + i * 6);
        ctx.lineTo(-29 - i * 8, -23 + i * 6);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawParticles(scene, cam, sh) {
    ctx.save();
    for (const p of scene.particles) {
      const x = sx(p.x, sceneShakeX), y = sy(p.y, cam, sh);
      const a = Math.max(0, Math.min(1, p.life / p.max));
      if (p.type === 'ring') {
        ctx.strokeStyle = p.color;
        ctx.globalAlpha = a * .7;
        ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.arc(x, y, p.size * (1.8 - a * 1.2), 0, TAU); ctx.stroke();
      } else if (p.type === 'spark') {
        ctx.globalAlpha = a;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.size * .6;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - p.vx * .035, y + p.vy * .035); ctx.stroke();
      } else if (p.type === 'shard') {
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        ctx.save(); ctx.translate(x, y); ctx.rotate(p.rot || 0);
        polygon(ctx, [[-2, -4], [3, -1], [1, 4], [-3, 2]], p.color);
        ctx.restore();
      } else {
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(x, y, p.size * (.6 + (1 - a) * .5), 0, TAU); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    for (const f of scene.floats) {
      const x = sx(f.x, sceneShakeX), y = sy(f.y, cam, sh);
      const a = Math.max(0, Math.min(1, f.life / f.max));
      ctx.globalAlpha = a;
      ctx.font = 'bold 11px "KaiTi","STKaiti",serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(0,0,0,.42)';
      ctx.fillText(f.text, x + 1, y + 1);
      ctx.fillStyle = f.color || '#ffe5a8';
      ctx.fillText(f.text, x, y);
    }
    ctx.restore();
  }

  function drawForeground(scene) {
    const z = zoneAt(scene.cameraY + 25);
    // vignette
    const v = ctx.createRadialGradient(W / 2, H * .48, H * .24, W / 2, H * .48, H * .66);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(.72, 'rgba(3,2,9,.12)');
    v.addColorStop(1, 'rgba(3,2,9,.58)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);
    // paper grain
    ctx.globalAlpha = .5;
    ctx.drawImage(paper, 0, 0);
    ctx.globalAlpha = 1;
    // hit flashes
    if (scene.flashT > 0) {
      ctx.fillStyle = `rgba(255,92,61,${Math.min(.28, scene.flashT * .65)})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (scene.flowT > 0) {
      ctx.strokeStyle = 'rgba(255,220,146,.16)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 7; i++) {
        const yy = (i * 131 + scene.t * 380) % H;
        ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(W, yy + 1); ctx.stroke();
      }
    }
    if (scene.mode === 'title') {
      ctx.fillStyle = 'rgba(8,5,16,.26)';
      ctx.fillRect(0, 0, W, H);
    }
    // thin gold frame
    ctx.strokeStyle = `rgba(231,193,113,${z.id === 'wind' ? .18 : .22})`;
    ctx.lineWidth = 1;
    ctx.strokeRect(7.5, 7.5, W - 15, H - 15);
    ctx.strokeStyle = 'rgba(0,0,0,.5)';
    ctx.strokeRect(9.5, 9.5, W - 19, H - 19);
  }

  // module-scope shake state, assigned each draw; kept simple and deterministic
  let sceneShakeX = 0, sceneShakeY = 0;

  function draw(scene) {
    sceneShakeX = scene.shakeX || 0;
    sceneShakeY = scene.shakeY || 0;
    const cam = scene.cameraY;
    const sh = sceneShakeY;
    ctx.save();
    drawSky(scene);
    ctx.save();
    ctx.translate(sceneShakeX, sceneShakeY);

    drawTowerFrame(scene);

    // lanterns and gates behind ledges
    for (const l of scene.level.lanterns) drawLantern(l, cam, sh, scene.t);
    for (const g of scene.level.gates) drawGate(g, cam, sh, scene.t, scene.checkpointY, scene.mode);

    for (const w of scene.level.walls) drawWall(w, cam, sh, scene.t);
    for (const p of scene.level.platforms) drawPlatform(p, cam, sh, scene.t);
    for (const h of scene.level.hazards) drawHazard(h, cam, sh, scene.t);
    for (const p of scene.level.pickups) drawPickup(p, cam, sh, scene.t);
    if (scene.mode !== 'title' || scene.showPlayer) drawPlayer(scene.player, cam, sh, scene.t, scene);
    drawParticles(scene, cam, sh);
    ctx.restore();

    drawForeground(scene);
    ctx.restore();
  }

  return { draw, setup, W, H };
}
