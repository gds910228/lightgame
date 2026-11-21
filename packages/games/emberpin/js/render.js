// Emberpin — procedural Canvas art: charcoal cabinet, molten-gold rails,
// glazed vermilion targets, ember particles, glass-dome reflections and all
// the HUD. Everything is drawn from code; there are no image assets.

import {
  VW, VH, TABLE, BALL_R, FLIP_RAD, FLIP_LEN, LANE_FLOOR_Y, LANE_X,
  WALLS, LANE_FLOOR, BUMPERS, RINGS, POSTS, SLINGS, TARGET_GROUPS, FLIP_PIVOTS,
} from './physics.js';

const GOLD = '#e7b263', GOLD_HI = '#ffe3a1', VERM = '#e85a3e', JADE = '#56c9b4';
const INK = '#0a0706';

function rr(c, x, y, w, h, r) {
  const q = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  c.beginPath();
  c.moveTo(x + q, y);
  c.lineTo(x + w - q, y); c.quadraticCurveTo(x + w, y, x + w, y + q);
  c.lineTo(x + w, y + h - q); c.quadraticCurveTo(x + w, y + h, x + w - q, y + h);
  c.lineTo(x + q, y + h); c.quadraticCurveTo(x, y + h, x, y + h - q);
  c.lineTo(x, y + q); c.quadraticCurveTo(x, y, x + q, y);
  c.closePath();
}

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function diamond(c, x, y, s) {
  c.beginPath(); c.moveTo(x, y - s); c.lineTo(x + s, y); c.lineTo(x, y + s); c.lineTo(x - s, y); c.closePath();
}

// ------------------------------------------------------------------ static art
function buildStatic(scale) {
  const cv = document.createElement('canvas');
  cv.width = Math.round(540 * scale); cv.height = Math.round(880 * scale);
  const g = cv.getContext('2d');
  g.scale(scale, scale);
  const rnd = mulberry32(0xE3B1);
  const W = 540, H = 880;

  // cabinet body
  let grd = g.createLinearGradient(0, 0, W, H);
  grd.addColorStop(0, '#2a1a13'); grd.addColorStop(0.42, '#160f0c'); grd.addColorStop(1, '#0b0706');
  rr(g, 0, 0, W, H, 26); g.fillStyle = grd; g.fill();
  g.strokeStyle = 'rgba(231,178,99,.5)'; g.lineWidth = 2; rr(g, 4, 4, W - 8, H - 8, 23); g.stroke();
  g.strokeStyle = 'rgba(255,227,161,.18)'; g.lineWidth = 1; rr(g, 9, 9, W - 18, H - 18, 20); g.stroke();

  // side flourishes
  for (const side of [0, 1]) {
    g.save();
    if (side) { g.translate(W, 0); g.scale(-1, 1); }
    g.strokeStyle = 'rgba(231,178,99,.22)'; g.lineWidth = 1.4;
    for (let i = 0; i < 5; i++) {
      g.beginPath();
      g.moveTo(18, 170 + i * 92);
      g.bezierCurveTo(2, 200 + i * 92, 4, 250 + i * 92, 17, 268 + i * 92);
      g.stroke();
    }
    for (let i = 0; i < 4; i++) diamond(g, 13, 205 + i * 92, 3.2), g.fillStyle = 'rgba(231,178,99,.32)', g.fill();
    g.restore();
  }

  // playfield base
  g.save();
  rr(g, 12, 12, W - 24, H - 24, 18); g.clip();
  const pg = g.createRadialGradient(244, 300, 40, 244, 380, 560);
  pg.addColorStop(0, '#422718'); pg.addColorStop(0.36, '#2a1811'); pg.addColorStop(0.72, '#160d0a'); pg.addColorStop(1, '#090605');
  g.fillStyle = pg; g.fillRect(0, 0, W, H);

  // paper / charcoal grain
  for (let i = 0; i < 900; i++) {
    const x = rnd() * W, y = rnd() * H, a = 0.02 + rnd() * 0.06;
    g.fillStyle = rnd() > 0.55 ? `rgba(255,206,140,${a * 0.55})` : `rgba(0,0,0,${a})`;
    g.beginPath(); g.arc(x, y, 0.6 + rnd() * 2.1, 0, 6.2832); g.fill();
  }
  // faint inlaid arcs
  g.lineWidth = 1.2;
  for (let i = 0; i < 4; i++) {
    g.strokeStyle = `rgba(231,178,99,${0.055 - i * 0.011})`;
    g.beginPath(); g.arc(244, 300, 120 + i * 74, 0.15, Math.PI - 0.15); g.stroke();
  }
  g.strokeStyle = 'rgba(232,90,62,.10)';
  g.beginPath(); g.arc(244, 620, 150, Math.PI + 0.3, 6.2832 - 0.3); g.stroke();

  // launch lane
  const lg = g.createLinearGradient(470, 0, 522, 0);
  lg.addColorStop(0, '#1a1310'); lg.addColorStop(0.45, '#2b1e16'); lg.addColorStop(1, '#120b08');
  g.fillStyle = lg; g.fillRect(470, 24, 52, H - 60);
  g.strokeStyle = 'rgba(231,178,99,.35)'; g.lineWidth = 1;
  g.beginPath(); g.moveTo(484, 320); g.lineTo(484, 840); g.stroke();
  g.fillStyle = 'rgba(255,199,106,.42)';
  for (const y of [360, 470, 580, 690]) {
    g.beginPath(); g.moveTo(496, y - 14); g.lineTo(507, y); g.lineTo(485, y); g.closePath(); g.fill();
  }
  // lane label
  g.save(); g.translate(511, 760); g.rotate(-Math.PI / 2);
  g.fillStyle = 'rgba(255,227,161,.4)'; g.font = '600 12px "Microsoft YaHei",sans-serif';
  g.textAlign = 'center'; g.fillText('发 射 轨', 0, 4); g.restore();

  // lower apron
  const ag = g.createLinearGradient(0, 780, 0, 870);
  ag.addColorStop(0, 'rgba(20,12,9,0)'); ag.addColorStop(0.3, '#160e0a'); ag.addColorStop(1, '#0a0605');
  g.fillStyle = ag; g.fillRect(18, 780, 452, 84);
  g.strokeStyle = 'rgba(231,178,99,.28)'; g.lineWidth = 1;
  g.beginPath(); g.moveTo(30, 792); g.quadraticCurveTo(244, 776, 458, 792); g.stroke();
  g.fillStyle = 'rgba(255,227,161,.24)'; g.font = '700 15px "Microsoft YaHei",sans-serif';
  g.textAlign = 'center'; g.fillText('E M B E R P I N', 244, 842);
  g.fillStyle = 'rgba(255,199,106,.16)'; g.font = '600 9px "Microsoft YaHei",sans-serif';
  g.fillText('余 烬 弹 珠 台 · 第 十 铺', 244, 858);
  for (const x of [96, 392]) { diamond(g, x, 824, 4); g.fillStyle = 'rgba(232,90,62,.3)'; g.fill(); }

  // central ember medallion (fills the mid-field, sits behind the ball)
  g.save();
  g.translate(244, 452);
  g.strokeStyle = 'rgba(231,178,99,.13)'; g.lineWidth = 1.4;
  for (const r of [58, 74, 96]) { g.beginPath(); g.arc(0, 0, r, 0, 6.2832); g.stroke(); }
  for (let i = 0; i < 12; i++) {
    const a = i * Math.PI / 6;
    g.save(); g.rotate(a);
    g.strokeStyle = i % 3 === 0 ? 'rgba(232,90,62,.18)' : 'rgba(231,178,99,.10)';
    g.beginPath();
    g.moveTo(0, 18); g.quadraticCurveTo(17, 44, 0, 96); g.quadraticCurveTo(-17, 44, 0, 18);
    g.stroke();
    g.restore();
  }
  g.strokeStyle = 'rgba(255,199,106,.20)'; g.lineWidth = 2;
  g.beginPath(); g.arc(0, 0, 30, 0.4, 6.2832 - 0.4); g.stroke();
  diamond(g, 0, 0, 12); g.fillStyle = 'rgba(232,90,62,.16)'; g.fill();
  diamond(g, 0, 0, 6); g.fillStyle = 'rgba(255,199,106,.22)'; g.fill();
  g.fillStyle = 'rgba(255,227,161,.20)'; g.font = '600 9px "Microsoft YaHei",sans-serif';
  g.textAlign = 'center'; g.fillText('余 烬 核', 0, 4);
  g.restore();

  // inlaid lane arrows feeding the bumpers
  g.strokeStyle = 'rgba(255,199,106,.20)'; g.lineWidth = 1.4;
  for (const a of [-2.25, -0.89]) {
    g.save(); g.translate(244, 488); g.rotate(a);
    for (let i = 0; i < 3; i++) {
      g.beginPath(); g.moveTo(-7, -i * 11); g.lineTo(0, -8 - i * 11); g.lineTo(7, -i * 11); g.stroke();
    }
    g.restore();
  }
  for (const x of [64, 424]) {
    diamond(g, x, 520, 3.2); g.fillStyle = 'rgba(231,178,99,.18)'; g.fill();
  }

  // target-group etch labels
  g.font = '600 10px "Microsoft YaHei",sans-serif'; g.textAlign = 'center';
  g.fillStyle = 'rgba(232,90,62,.42)'; g.fillText('余 火', 158, 328);
  g.fillStyle = 'rgba(86,201,180,.42)'; g.fillText('青 焰', 330, 328);
  g.fillStyle = 'rgba(255,199,106,.42)'; g.fillText('金 环', 249, 538);

  // slingshot bodies (the kicker faces are drawn live)
  for (const s of SLINGS) {
    const [a, b, c] = s.tri;
    g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(c[0], c[1]); g.closePath();
    g.fillStyle = 'rgba(34,17,13,.92)'; g.fill();
    g.strokeStyle = 'rgba(231,178,99,.4)'; g.lineWidth = 1.5; g.stroke();
    g.strokeStyle = 'rgba(232,90,62,.3)'; g.lineWidth = 4;
    g.beginPath(); g.moveTo(s.x1, s.y1); g.lineTo(s.x2, s.y2); g.stroke();
  }

  // post etch rings
  for (const p of POSTS) {
    g.beginPath(); g.arc(p.x, p.y, 15, 0, 6.2832);
    g.strokeStyle = 'rgba(231,178,99,.16)'; g.lineWidth = 1; g.stroke();
  }

  // rails
  function rail(x1, y1, x2, y2, glow = 1) {
    g.strokeStyle = 'rgba(0,0,0,.85)'; g.lineWidth = 9; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
    g.strokeStyle = glow > 0 ? '#b9853f' : '#6f4d28'; g.lineWidth = 4;
    g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
    g.strokeStyle = 'rgba(255,227,161,.55)'; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(x1 - 1, y1 - 1); g.lineTo(x2 - 1, y2 - 1); g.stroke();
  }
  for (const [x1, y1, x2, y2] of WALLS) rail(x1, y1, x2, y2, 1);
  rail(LANE_FLOOR[0], LANE_FLOOR[1], LANE_FLOOR[2], LANE_FLOOR[3], 0.4);

  // crown ornaments
  g.strokeStyle = 'rgba(255,199,106,.32)'; g.lineWidth = 1.3;
  g.beginPath(); g.arc(244, 354, 236, Math.PI + 0.24, 6.2832 - 0.24); g.stroke();
  for (const x of [150, 244, 338]) {
    diamond(g, x, 42, 4.4); g.fillStyle = 'rgba(232,90,62,.34)'; g.fill();
  }

  // vignette + glass
  const vg = g.createRadialGradient(244, 400, 140, 244, 420, 540);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.55)');
  g.fillStyle = vg; g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'screen';
  const gg = g.createLinearGradient(0, 0, 420, 620);
  gg.addColorStop(0, 'rgba(255,240,210,.09)'); gg.addColorStop(0.16, 'rgba(255,240,210,0)');
  gg.addColorStop(0.28, 'rgba(255,245,220,.045)'); gg.addColorStop(0.4, 'rgba(255,240,210,0)');
  g.fillStyle = gg; g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'source-over';
  g.restore();

  // bezel bolts
  for (const [x, y] of [[24, 24], [516, 24], [24, 856], [516, 856]]) {
    g.beginPath(); g.arc(x, y, 4, 0, 6.2832); g.fillStyle = '#3a2718'; g.fill();
    g.strokeStyle = 'rgba(255,227,161,.45)'; g.lineWidth = 1; g.stroke();
  }
  return cv;
}

// ------------------------------------------------------------------ renderer
export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let DPR = 1, scale = 1, ox = 0, oy = 0, vw = 1, vh = 1;
  let art = null;
  const embers = [];
  const rnd = mulberry32(0x51F7);
  for (let i = 0; i < 74; i++) {
    embers.push({
      x: rnd(), y: rnd(), sp: 0.012 + rnd() * 0.05, ph: rnd() * 6.28,
      size: 0.7 + rnd() * 2.4, hue: rnd() > 0.55 ? 1 : 0, drift: 8 + rnd() * 26,
    });
  }

  function resize() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    vw = window.innerWidth; vh = window.innerHeight;
    canvas.width = Math.max(1, Math.round(vw * DPR));
    canvas.height = Math.max(1, Math.round(vh * DPR));
    scale = Math.min(vw / VW, vh / VH);
    ox = (vw - VW * scale) / 2;
    oy = (vh - VH * scale) / 2;
    if (!art) art = buildStatic(Math.min(2, Math.max(1.5, DPR)));
  }
  resize();

  function panel(x, y, w, h, r = 8) {
    rr(ctx, x, y, w, h, r);
    ctx.fillStyle = 'rgba(9,6,5,.72)'; ctx.fill();
    ctx.strokeStyle = 'rgba(231,178,99,.28)'; ctx.lineWidth = 1; ctx.stroke();
  }

  function text(str, x, y, size, color, align = 'left', weight = '600') {
    ctx.font = `${weight} ${size}px "Microsoft YaHei","PingFang SC",sans-serif`;
    ctx.textAlign = align; ctx.fillStyle = color; ctx.fillText(str, x, y);
  }

  function drawBackground(t) {
    const bg = ctx.createRadialGradient(vw * 0.5, vh * 0.42, 40, vw * 0.5, vh * 0.5, Math.max(vw, vh) * 0.7);
    bg.addColorStop(0, '#1d100a'); bg.addColorStop(0.45, '#0d0807'); bg.addColorStop(1, '#050303');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, vw, vh);
    // drifting embers
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const e of embers) {
      const y = ((e.y - t * e.sp) % 1.15 + 1.15) % 1.15;
      const x = e.x + Math.sin(t * 0.5 + e.ph) * (e.drift / Math.max(1, vw));
      const a = 0.16 + 0.32 * (0.5 + 0.5 * Math.sin(t * 1.7 + e.ph));
      ctx.fillStyle = e.hue ? `rgba(255,168,78,${a})` : `rgba(232,90,62,${a * 0.8})`;
      ctx.beginPath(); ctx.arc(x * vw, (1.08 - y) * vh, e.size, 0, 6.2832); ctx.fill();
    }
    ctx.restore();
    // faint cabinet aura
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const ax = ox + (TABLE.x + TABLE.w / 2) * scale, ay = oy + (TABLE.y + TABLE.h / 2) * scale;
    const rg = ctx.createRadialGradient(ax, ay, 20, ax, ay, Math.max(vw, vh) * 0.44);
    rg.addColorStop(0, 'rgba(120,55,20,.13)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rg; ctx.fillRect(0, 0, vw, vh);
    ctx.restore();
  }

  function drawTargets(v) {
    for (const g of v.groups) {
      for (const t of g.targets) {
        const lit = t.lit;
        const x1 = t.x1, x2 = t.x2, y = t.y1;
        ctx.save();
        if (lit) {
          ctx.globalCompositeOperation = 'lighter';
          const gl = ctx.createLinearGradient(x1 - 8, y, x2 + 8, y);
          gl.addColorStop(0, 'rgba(255,220,150,0)'); gl.addColorStop(0.5, 'rgba(255,196,106,.45)'); gl.addColorStop(1, 'rgba(255,220,150,0)');
          ctx.fillStyle = gl; ctx.fillRect(x1 - 12, y - 13, x2 - x1 + 24, 26);
          ctx.globalCompositeOperation = 'source-over';
        }
        rr(ctx, x1 - 2, y - 5, x2 - x1 + 4, 10, 5);
        ctx.fillStyle = lit ? g.color : '#3b1d16';
        ctx.fill();
        ctx.strokeStyle = lit ? '#ffe4ac' : 'rgba(231,178,99,.62)';
        ctx.lineWidth = lit ? 1.6 : 1.3;
        ctx.stroke();
        if (!lit) {
          ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(x1 + 3, y); ctx.lineTo(x2 - 3, y); ctx.stroke();
        }
        if (lit) {
          ctx.strokeStyle = 'rgba(255,248,225,.85)'; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(x1 + 3, y - 2); ctx.lineTo(x2 - 3, y - 2); ctx.stroke();
        }
        if (t.pulse > 0) {
          ctx.globalCompositeOperation = 'lighter';
          ctx.strokeStyle = `rgba(255,220,150,${Math.min(0.8, t.pulse)})`;
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc((x1 + x2) / 2, y, 14 + (1 - t.pulse) * 30, 0, 6.2832); ctx.stroke();
          ctx.globalCompositeOperation = 'source-over';
        }
        ctx.restore();
      }
    }
  }

  function drawBumpers(v) {
    for (const b of v.bumpers) {
      const pulse = b.pulse > 0 ? b.pulse : 0;
      ctx.save();
      // outer glow
      ctx.globalCompositeOperation = 'lighter';
      const gl = ctx.createRadialGradient(b.x, b.y, b.r * 0.5, b.x, b.y, b.r * 2.3);
      gl.addColorStop(0, `rgba(255,160,80,${0.14 + pulse * 0.45})`);
      gl.addColorStop(0.5, `rgba(232,90,62,${0.07 + pulse * 0.2})`);
      gl.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 2.3, 0, 6.2832); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      // base
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 4, 0, 6.2832);
      ctx.fillStyle = '#1a100c'; ctx.fill();
      ctx.strokeStyle = 'rgba(231,178,99,.55)'; ctx.lineWidth = 2; ctx.stroke();
      // cap
      const cg = ctx.createRadialGradient(b.x - b.r * 0.35, b.y - b.r * 0.4, 2, b.x, b.y, b.r);
      cg.addColorStop(0, pulse > 0 ? '#fff0c8' : '#ffcf8a');
      cg.addColorStop(0.45, pulse > 0 ? '#ffd27a' : '#d0753a');
      cg.addColorStop(1, '#4a1d12');
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r - 1, 0, 6.2832); ctx.fillStyle = cg; ctx.fill();
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 0.55, 0, 6.2832);
      ctx.strokeStyle = 'rgba(255,227,161,.55)'; ctx.lineWidth = 1.4; ctx.stroke();
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 0.18, 0, 6.2832);
      ctx.fillStyle = 'rgba(20,8,5,.9)'; ctx.fill();
      // crown ticks
      ctx.strokeStyle = 'rgba(255,227,161,.4)'; ctx.lineWidth = 1.2;
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4 + v.time * 0.35;
        ctx.beginPath();
        ctx.moveTo(b.x + Math.cos(a) * (b.r + 7), b.y + Math.sin(a) * (b.r + 7));
        ctx.lineTo(b.x + Math.cos(a) * (b.r + 11), b.y + Math.sin(a) * (b.r + 11));
        ctx.stroke();
      }
      if (pulse > 0) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = `rgba(255,210,140,${pulse * 0.7})`; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 8 + (1 - pulse) * 26, 0, 6.2832); ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.restore();
    }
  }

  function drawRings(v) {
    for (const r of v.rings) {
      const pulse = r.pulse > 0 ? r.pulse : 0;
      ctx.save();
      ctx.translate(r.x, r.y);
      ctx.globalCompositeOperation = 'lighter';
      const gl = ctx.createRadialGradient(0, 0, r.r * 0.2, 0, 0, r.r * 2.4);
      gl.addColorStop(0, `rgba(86,201,180,${0.12 + pulse * 0.28})`);
      gl.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(0, 0, r.r * 2.4, 0, 6.2832); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      ctx.rotate(v.time * 0.7);
      ctx.beginPath(); ctx.arc(0, 0, r.r, 0, 6.2832);
      ctx.strokeStyle = pulse > 0 ? '#eafff9' : '#6fded0';
      ctx.lineWidth = 4 + pulse * 3;
      ctx.shadowColor = '#56c9b4'; ctx.shadowBlur = 10 + pulse * 18;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255,227,161,.6)'; ctx.lineWidth = 1.1;
      for (let i = 0; i < 9; i++) {
        const a = i * Math.PI * 2 / 9;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * (r.r - 6), Math.sin(a) * (r.r - 6));
        ctx.lineTo(Math.cos(a) * (r.r + 7), Math.sin(a) * (r.r + 7));
        ctx.stroke();
      }
      ctx.beginPath(); ctx.arc(0, 0, 4.5, 0, 6.2832);
      ctx.fillStyle = 'rgba(86,201,180,.85)'; ctx.fill();
      ctx.beginPath(); ctx.arc(0, 0, r.r + 9, 0, 6.2832);
      ctx.strokeStyle = 'rgba(255,199,106,.24)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.restore();
    }
    for (const p of v.posts) {
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.2832);
      ctx.fillStyle = '#d6a35b'; ctx.fill();
      ctx.strokeStyle = 'rgba(255,240,205,.7)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.beginPath(); ctx.arc(p.x - 2, p.y - 2, p.r * 0.3, 0, 6.2832);
      ctx.fillStyle = 'rgba(255,248,225,.8)'; ctx.fill();
    }
  }

  function drawSlings(v) {
    for (const s of v.slings) {
      const pulse = s.pulse > 0 ? s.pulse : 0;
      ctx.save();
      ctx.strokeStyle = pulse > 0 ? '#ffe3a1' : '#c05238';
      ctx.lineWidth = 6 + pulse * 5;
      ctx.shadowColor = '#e85a3e'; ctx.shadowBlur = 6 + pulse * 20;
      ctx.beginPath(); ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); ctx.stroke();
      ctx.restore();
    }
  }

  function drawFlippers(v) {
    for (const f of v.flippers) {
      const tipX = f.x + Math.cos(f.angle) * FLIP_LEN;
      const tipY = f.y + Math.sin(f.angle) * FLIP_LEN;
      ctx.save();
      // shadow
      ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = FLIP_RAD * 2 + 4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(f.x + 3, f.y + 5); ctx.lineTo(tipX + 3, tipY + 5); ctx.stroke();
      // body
      const grd = ctx.createLinearGradient(f.x, f.y, tipX, tipY);
      grd.addColorStop(0, '#f4cf8a'); grd.addColorStop(0.4, '#d69c4e'); grd.addColorStop(0.75, '#8d5a25'); grd.addColorStop(1, '#f7dda6');
      ctx.strokeStyle = grd; ctx.lineWidth = FLIP_RAD * 2;
      ctx.shadowColor = f.pressed ? '#ffc46a' : 'rgba(231,178,99,.4)';
      ctx.shadowBlur = f.pressed ? 16 : 5;
      ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(tipX, tipY); ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255,245,215,.55)'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(f.x + Math.cos(f.angle) * 6, f.y + Math.sin(f.angle) * 6 - 2);
      ctx.lineTo(tipX - Math.cos(f.angle) * 5, tipY - Math.sin(f.angle) * 5 - 2); ctx.stroke();
      // pivot jewel
      ctx.beginPath(); ctx.arc(f.x, f.y, 11, 0, 6.2832);
      ctx.fillStyle = '#291a11'; ctx.fill();
      ctx.strokeStyle = '#e7b263'; ctx.lineWidth = 2; ctx.stroke();
      ctx.beginPath(); ctx.arc(f.x, f.y, 4.5, 0, 6.2832);
      ctx.fillStyle = f.pressed ? '#ff9b5c' : '#7c4a24'; ctx.fill();
      ctx.restore();
    }
  }

  function drawPlunger(v) {
    const x = LANE_X;
    const charge = v.charge || 0;
    const headY = 826 + charge * 20;
    ctx.save();
    // spring coils
    ctx.strokeStyle = 'rgba(231,178,99,.55)'; ctx.lineWidth = 1.6;
    for (let i = 0; i < 6; i++) {
      const y = headY + 6 + i * (charge > 0 ? 4.2 : 5.2);
      ctx.beginPath(); ctx.ellipse(x, y, 11, 2.6, 0, 0, 6.2832); ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(x, headY); ctx.lineTo(x, 872); ctx.stroke();
    // head
    rr(ctx, x - 15, headY - 7, 30, 12, 5);
    const hg = ctx.createLinearGradient(x - 15, 0, x + 15, 0);
    hg.addColorStop(0, '#7a4a22'); hg.addColorStop(0.5, '#ffe0a0'); hg.addColorStop(1, '#7a4a22');
    ctx.fillStyle = hg; ctx.fill();
    // charge column
    if (v.mode === 'play') {
      rr(ctx, 474, 700, 9, 130, 4);
      ctx.fillStyle = 'rgba(10,6,5,.8)'; ctx.fill();
      const hgt = 126 * charge;
      if (hgt > 0) {
        const cg = ctx.createLinearGradient(0, 826, 0, 700);
        cg.addColorStop(0, '#e85a3e'); cg.addColorStop(0.55, '#ffc46a'); cg.addColorStop(1, '#fff2cf');
        rr(ctx, 476, 826 - hgt, 5, hgt, 2.5); ctx.fillStyle = cg; ctx.fill();
      }
      ctx.strokeStyle = 'rgba(231,178,99,.4)'; ctx.lineWidth = 1;
      rr(ctx, 474, 700, 9, 130, 4); ctx.stroke();
      if (v.charging) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = `rgba(255,196,106,${0.15 + charge * 0.35})`;
        ctx.beginPath(); ctx.arc(x, headY, 20 + charge * 14, 0, 6.2832); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      }
    }
    ctx.restore();
  }

  function drawBall(b) {
    // trail
    for (let i = 0; i < b.trail.length; i++) {
      const p = b.trail[i];
      const a = (i / b.trail.length) * 0.22;
      ctx.beginPath(); ctx.arc(p.x, p.y, BALL_R * (0.35 + 0.5 * i / b.trail.length), 0, 6.2832);
      ctx.fillStyle = `rgba(255,170,90,${a})`; ctx.fill();
    }
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const gl = ctx.createRadialGradient(b.x, b.y, 2, b.x, b.y, BALL_R * 3.2);
    gl.addColorStop(0, 'rgba(255,200,120,.28)'); gl.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(b.x, b.y, BALL_R * 3.2, 0, 6.2832); ctx.fill();
    ctx.restore();
    // shadow
    ctx.beginPath(); ctx.ellipse(b.x + 2.5, b.y + 3.5, BALL_R * 0.95, BALL_R * 0.8, 0, 0, 6.2832);
    ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fill();
    // chrome
    const g = ctx.createRadialGradient(b.x - BALL_R * 0.38, b.y - BALL_R * 0.45, 1, b.x, b.y, BALL_R);
    g.addColorStop(0, '#fffdf4'); g.addColorStop(0.3, '#ffe6b4'); g.addColorStop(0.62, '#c08a48');
    g.addColorStop(0.86, '#5b3519'); g.addColorStop(1, '#1e110b');
    ctx.beginPath(); ctx.arc(b.x, b.y, BALL_R, 0, 6.2832);
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = 'rgba(255,233,180,.65)'; ctx.lineWidth = 0.8; ctx.stroke();
    ctx.beginPath(); ctx.arc(b.x - 3, b.y - 3.4, 2.1, 0, 6.2832);
    ctx.fillStyle = 'rgba(255,255,240,.9)'; ctx.fill();
  }

  function drawParticles(v) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of v.particles) {
      const a = Math.max(0, p.life / p.max);
      ctx.globalAlpha = a * 0.9;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.4 + a * 0.8), 0, 6.2832); ctx.fill();
    }
    ctx.restore();
  }

  function drawFloats(v) {
    ctx.save();
    ctx.textAlign = 'center';
    for (const f of v.floats) {
      const a = Math.min(1, f.life * 1.6);
      ctx.globalAlpha = a;
      ctx.font = `700 ${f.size}px "Microsoft YaHei",sans-serif`;
      ctx.strokeStyle = 'rgba(20,8,4,.8)'; ctx.lineWidth = 4;
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y);
    }
    ctx.restore();
  }

  function hud(v) {
    const u = Math.max(0.72, Math.min(1.22, Math.min(vw / 1280, vh / 720)));
    const pad = 10 * u;
    const portrait = vw < vh * 1.05;

    if (portrait) {
      // compact top bar for phones held upright
      const barH = 76;
      panel(8, 8, vw - 16, barH, 10);
      text('得 分', 18, 28, 10, 'rgba(231,178,99,.72)', 'left', '600');
      text(v.score.toLocaleString('en-US'), 18, 53, 22, '#ffe3a1', 'left', '700');
      text(`球 ${v.ballsLeft}`, vw - 18, 29, 13, '#ffe3a1', 'right', '700');
      text(`倍率 ×${v.multiplier}   连击 ×${v.combo}`, vw - 18, 48, 10, 'rgba(235,210,175,.82)', 'right', '600');
      const pbarW = Math.min(120, vw * 0.3), pbarX = 18, pbarY = 61;
      rr(ctx, pbarX, pbarY, pbarW, 4, 2); ctx.fillStyle = 'rgba(40,22,14,.9)'; ctx.fill();
      const frac = Math.max(0, Math.min(1, v.score / v.targetScore));
      if (frac > 0) {
        const pg = ctx.createLinearGradient(pbarX, 0, pbarX + pbarW, 0);
        pg.addColorStop(0, '#c05238'); pg.addColorStop(1, '#ffd88a');
        rr(ctx, pbarX, pbarY, pbarW * frac, 4, 2); ctx.fillStyle = pg; ctx.fill();
      }
      const tw = (vw - 36) / 3;
      for (let i = 0; i < 3; i++) {
        const g = v.groups[i], bx = 18 + i * tw;
        text(g.label, bx, 75, 9.5, g.done ? g.color : 'rgba(205,180,150,.62)', 'left', '600');
        for (let k = 0; k < 3; k++) {
          const cx = bx + 34 + k * 10;
          ctx.beginPath(); ctx.arc(cx, 71.5, 3.2, 0, 6.2832);
          ctx.fillStyle = g.targets[k].lit ? g.color : 'rgba(70,46,30,.85)';
          ctx.fill();
          ctx.strokeStyle = 'rgba(231,178,99,.35)'; ctx.lineWidth = 0.7; ctx.stroke();
        }
      }
    } else {
      // score panel
      const leftW = 196 * u, leftH = 92 * u;
      panel(14, 12, leftW, leftH, 9 * u);
      text('得 分', 14 + pad, 12 + 16 * u, Math.max(9, 10.5 * u), 'rgba(231,178,99,.72)', 'left', '600');
      text(v.score.toLocaleString('en-US'), 14 + pad, 12 + 42 * u, 25 * u, '#ffe3a1', 'left', '700');
      text(`倍率 ×${v.multiplier}`, 14 + pad, 12 + 62 * u, Math.max(9, 11.5 * u), v.multiplier > 1 ? '#ff9a6a' : 'rgba(220,200,170,.7)', 'left', '600');
      text(`连击 ×${v.combo}`, 14 + pad + 78 * u, 12 + 62 * u, Math.max(9, 11.5 * u), v.combo > 1 ? '#56c9b4' : 'rgba(220,200,170,.45)', 'left', '600');
      const pw = leftW - pad * 2, py = 12 + 74 * u;
      rr(ctx, 14 + pad, py, pw, 6 * u, 3 * u); ctx.fillStyle = 'rgba(40,22,14,.9)'; ctx.fill();
      const frac = Math.max(0, Math.min(1, v.score / v.targetScore));
      if (frac > 0) {
        const pg = ctx.createLinearGradient(14 + pad, 0, 14 + pad + pw, 0);
        pg.addColorStop(0, '#c05238'); pg.addColorStop(1, '#ffd88a');
        rr(ctx, 14 + pad, py, pw * frac, 6 * u, 3 * u); ctx.fillStyle = pg; ctx.fill();
      }
      text(`目标 ${v.targetScore.toLocaleString('en-US')}`, 14 + pad + pw, 12 + 72 * u, 8.5 * u, 'rgba(200,175,140,.62)', 'right', '600');

      // right panel (kept below the DOM mute/pause buttons)
      const rw = 196 * u, rx = vw - 14 - rw, ry = 58;
      panel(rx, ry, rw, 108 * u, 9 * u);
      text('余烬弹珠台 · 第 10 铺', rx + pad, ry + 16 * u, 9.5 * u, 'rgba(231,178,99,.6)', 'left', '600');
      text(`剩余球 ${v.ballsLeft}`, rx + pad, ry + 37 * u, 14 * u, '#ffe3a1', 'left', '700');
      for (let i = 0; i < Math.min(6, v.ballsLeft); i++) {
        const bx = rx + pad + 82 * u + i * 14 * u, by = ry + 32 * u;
        ctx.beginPath(); ctx.arc(bx, by, 4.3 * u, 0, 6.2832);
        const bg = ctx.createRadialGradient(bx - 1.5, by - 2, 0.5, bx, by, 5 * u);
        bg.addColorStop(0, '#fff6d8'); bg.addColorStop(1, '#a46c30');
        ctx.fillStyle = bg; ctx.fill();
      }
      text(`最高 ${v.best.toLocaleString('en-US')}`, rx + rw - pad, ry + 18 * u, 9.5 * u, 'rgba(200,175,140,.72)', 'right', '600');
      for (let i = 0; i < 3; i++) {
        const g = v.groups[i];
        const yy = ry + 58 * u + i * 16 * u;
        text(`任务${'一二三'[i]} · ${g.label}`, rx + pad, yy + 3.4 * u, Math.max(8, 9.4 * u), g.done ? g.color : 'rgba(205,180,150,.62)', 'left', '600');
        for (let k = 0; k < 3; k++) {
          const cx = rx + rw - pad - (2 - k) * 15 * u;
          ctx.beginPath(); ctx.arc(cx, yy, 4.2 * u, 0, 6.2832);
          ctx.fillStyle = g.targets[k].lit ? g.color : 'rgba(60,40,28,.8)';
          ctx.fill();
          ctx.strokeStyle = 'rgba(231,178,99,.35)'; ctx.lineWidth = 0.8; ctx.stroke();
          if (g.targets[k].lit) {
            ctx.beginPath(); ctx.arc(cx, yy, 7 * u, 0, 6.2832);
            ctx.strokeStyle = g.color; ctx.globalAlpha = 0.45; ctx.lineWidth = 1; ctx.stroke(); ctx.globalAlpha = 1;
          }
        }
      }
    }

    // combo shout
    if (v.combo >= 2 && v.mode === 'play') {
      ctx.save();
      ctx.globalAlpha = Math.min(1, v.comboT);
      text(`连 击  ×${v.combo}`, vw / 2, portrait ? 100 : 34 * u, 14 * u, '#ffd27a', 'center', '700');
      ctx.restore();
    }

    // bottom guide
    if (v.mode === 'play') {
      const hint = v.charging
        ? '蓄力中… 松开空格 / 发射键弹射'
        : (v.serve ? '按住空格蓄力，松开弹射 · 触屏点「发射」'
          : (portrait ? '空格蓄力/发射 · A/D 翻板 · P 暂停' : '空格 蓄力/发射 · A/← 左翻板 · D/→ 右翻板 · P 暂停 · M 静音 · R 重开'));
      ctx.save();
      ctx.globalAlpha = 0.85;
      text(hint, vw / 2, vh - Math.max(12, 14 * u), Math.max(10, 10.5 * u), v.charging ? '#ffd27a' : 'rgba(215,190,155,.78)', 'center', '600');
      ctx.restore();
    }

    if (v.paused) {
      ctx.fillStyle = 'rgba(5,3,2,.55)'; ctx.fillRect(0, 0, vw, vh);
      text('已 暂 停', vw / 2, vh / 2 - 6, 30 * u, '#ffe3a1', 'center', '700');
      text('按 P 或点右上角继续', vw / 2, vh / 2 + 26 * u, 12 * u, 'rgba(220,195,160,.8)', 'center', '600');
    }
  }

  function draw(v) {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    drawBackground(v.time);

    const shx = v.shakeT > 0 ? (Math.sin(v.time * 71) * v.shakeAmp * v.shakeT * 12) : 0;
    const shy = v.shakeT > 0 ? (Math.cos(v.time * 83) * v.shakeAmp * v.shakeT * 12) : 0;

    ctx.save();
    ctx.translate(ox + shx, oy + shy);
    ctx.scale(scale, scale);
    ctx.translate(TABLE.x, TABLE.y);

    ctx.drawImage(art, 0, 0, TABLE.w, TABLE.h);

    // inner playfield clip for dynamic elements
    ctx.save();
    rr(ctx, 12, 12, TABLE.w - 24, TABLE.h - 24, 18); ctx.clip();
    drawTargets(v);
    drawRings(v);
    drawSlings(v);
    drawBumpers(v);
    drawFlippers(v);
    drawPlunger(v);
    for (const b of v.balls) drawBall(b);
    drawParticles(v);
    drawFloats(v);

    // live glass sheen
    ctx.globalCompositeOperation = 'screen';
    const sg = ctx.createLinearGradient(60, 0, 220, 500);
    sg.addColorStop(0, `rgba(255,244,220,${0.028 + 0.012 * Math.sin(v.time * 0.7)})`);
    sg.addColorStop(0.5, 'rgba(255,244,220,0)');
    sg.addColorStop(1, 'rgba(255,244,220,0)');
    ctx.fillStyle = sg; ctx.fillRect(0, 0, TABLE.w, TABLE.h);
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();

    if (v.flashT > 0) {
      ctx.fillStyle = `rgba(255,226,170,${Math.min(0.5, v.flashT * 1.6)})`;
      ctx.fillRect(12, 12, TABLE.w - 24, TABLE.h - 24);
    }
    ctx.restore();

    hud(v);
  }

  return { resize, draw, get scale() { return scale; } };
}
