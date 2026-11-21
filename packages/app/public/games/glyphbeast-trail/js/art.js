// Glyphbeast: Sixfold Trail — procedural ink-and-rune art.
// Everything is drawn with Canvas paths; there are no image assets.
import { SPECIES, ELEMENTS } from './data.js';

export const PAL = {
  ink0: '#080716', ink1: '#0e0c22', ink2: '#171331', ink3: '#221c40',
  copper: '#d9a45b', copperHi: '#f4d293', copperLo: '#8b6538',
  jade: '#6fe0c0', jadeDeep: '#2c8d7c',
  verm: '#e06544', vermHi: '#ff9a6a',
  paper: '#ead9b8', paperDim: '#b7a98c', muted: '#9d90b4',
  black: '#05040d',
};

const TAU = Math.PI * 2;

function lerp(a, b, t) { return a + (b - a) * t; }
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; }

const BODY = {
  flame:  { hi: '#c86a4e', mid: '#a64a38', lo: '#6f2a21', cream: '#efc9a2' },
  tide:   { hi: '#6fc3b6', mid: '#468f88', lo: '#265f5e', cream: '#d4eee2' },
  stone:  { hi: '#b98d58', mid: '#8e6b42', lo: '#5d452c', cream: '#e7d3ae' },
  gale:   { hi: '#8fc7a0', mid: '#5f9972', lo: '#386447', cream: '#dff0d3' },
  light:  { hi: '#e2c47e', mid: '#b2934f', lo: '#7a6335', cream: '#f7ecc8' },
  shadow: { hi: '#7f6cab', mid: '#5a4a81', lo: '#352a52', cream: '#cdc0e6' },
};

function bodyGrad(ctx, el, y0 = -40, y1 = 55) {
  const b = BODY[el];
  const g = ctx.createLinearGradient(0, y0, -8, y1);
  g.addColorStop(0, b.hi); g.addColorStop(0.55, b.mid); g.addColorStop(1, b.lo);
  return g;
}

function inkStroke(ctx, w = 2.2, col = '#100c20') {
  ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
}
function copperStroke(ctx, w = 1.2, alpha = 0.55) {
  ctx.strokeStyle = `rgba(226,178,104,${alpha})`; ctx.lineWidth = w; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
}
function path(ctx, fn) { ctx.beginPath(); fn(ctx); }

function blob(ctx, x, y, rx, ry, rot = 0) {
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, TAU);
}
function fillInk(ctx, fn, grad, lw = 2.2) {
  path(ctx, fn); ctx.fillStyle = grad; ctx.fill(); inkStroke(ctx, lw); ctx.stroke();
}
function eye(ctx, x, y, r, glow = '#ffe9b8', pupil = '#171024') {
  ctx.save();
  ctx.fillStyle = '#f8efd4'; blob(ctx, x, y, r, r * 0.82); ctx.fill();
  ctx.fillStyle = pupil; ctx.beginPath(); ctx.ellipse(x + r * 0.12, y, r * 0.42, r * 0.66, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = glow; ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.arc(x - r * 0.25, y - r * 0.25, r * 0.18, 0, TAU); ctx.fill();
  ctx.restore();
}
function runeMarks(ctx, el, t, positions) {
  const e = ELEMENTS[el];
  ctx.save();
  ctx.strokeStyle = e.light; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.85;
  ctx.shadowColor = e.hue; ctx.shadowBlur = 8;
  for (let i = 0; i < positions.length; i++) {
    const [x, y, r, a0] = positions[i];
    ctx.beginPath(); ctx.arc(x, y, r, a0 || -0.9, (a0 || -0.9) + 1.7); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + Math.cos((a0 || -0.9) + 1.7) * r, y + Math.sin((a0 || -0.9) + 1.7) * r);
    ctx.lineTo(x + Math.cos((a0 || -0.9) + 2.1) * (r + 4), y + Math.sin((a0 || -0.9) + 2.1) * (r + 4)); ctx.stroke();
  }
  ctx.restore();
}
function flameTip(ctx, x, y, s, col, alpha = 1) {
  ctx.save(); ctx.globalAlpha = alpha;
  ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.moveTo(x, y - 16 * s);
  ctx.bezierCurveTo(x + 12 * s, y - 3 * s, x + 8 * s, y + 7 * s, x, y + 8 * s);
  ctx.bezierCurveTo(x - 8 * s, y + 7 * s, x - 12 * s, y - 2 * s, x, y - 16 * s);
  ctx.fill();
  ctx.fillStyle = '#fff1c4'; ctx.globalAlpha = alpha * 0.75;
  ctx.beginPath(); ctx.ellipse(x, y + 1 * s, 3.2 * s, 5 * s, 0, 0, TAU); ctx.fill();
  ctx.restore();
}
function leg(ctx, x1, y1, x2, y2, w, grad) {
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
  ctx.strokeStyle = grad; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.stroke();
  ctx.strokeStyle = 'rgba(20,14,30,.65)'; ctx.lineWidth = Math.max(1, w * 0.18); ctx.stroke();
}

const SHAPES = {
  badger(ctx, sp, el, t) {
    const b = BODY[el], g = bodyGrad(ctx, el);
    // bushy tail with a live ember
    ctx.save();
    ctx.beginPath(); ctx.moveTo(-34, 12);
    ctx.bezierCurveTo(-78, 18, -92, -22, -64, -30);
    ctx.bezierCurveTo(-48, -35, -44, -8, -30, -2); ctx.closePath();
    ctx.fillStyle = b.mid; ctx.fill(); inkStroke(ctx, 2.2); ctx.stroke();
    ctx.strokeStyle = b.cream; ctx.lineWidth = 2; ctx.beginPath();
    ctx.moveTo(-54, -12); ctx.quadraticCurveTo(-66, -2, -60, 12); ctx.stroke();
    flameTip(ctx, -64, -33, 0.85, ELEMENTS[el].light, 0.95 + Math.sin(t * 4) * 0.05);
    ctx.restore();
    // legs
    leg(ctx, -26, 30, -30, 50, 12, b.lo); leg(ctx, 22, 30, 26, 50, 12, b.lo);
    leg(ctx, -12, 32, -14, 51, 11, b.mid); leg(ctx, 34, 30, 38, 50, 11, b.mid);
    // body + belly
    fillInk(ctx, c => blob(c, -2, 10, 46, 32), g);
    ctx.globalAlpha = 0.9; blob(ctx, 2, 22, 28, 16); ctx.fillStyle = b.cream; ctx.fill(); ctx.globalAlpha = 1;
    // head
    fillInk(ctx, c => blob(c, 38, -14, 26, 23), g);
    // ears
    fillInk(ctx, c => { c.moveTo(22, -30); c.quadraticCurveTo(18, -46, 32, -40); c.quadraticCurveTo(36, -32, 30, -28); }, b.mid, 1.6);
    fillInk(ctx, c => { c.moveTo(48, -30); c.quadraticCurveTo(54, -45, 60, -33); c.quadraticCurveTo(58, -25, 52, -25); }, b.mid, 1.6);
    // black mask + cream stripe
    ctx.save(); ctx.fillStyle = 'rgba(26,18,42,.9)';
    blob(ctx, 30, -16, 12, 9, -0.2); ctx.fill(); blob(ctx, 47, -17, 11, 8, 0.2); ctx.fill(); ctx.restore();
    ctx.strokeStyle = b.cream; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(38, -36); ctx.quadraticCurveTo(41, -20, 44, -8); ctx.stroke();
    eye(ctx, 33, -16, 4.6); eye(ctx, 47, -17, 4.6);
    ctx.fillStyle = '#24182e'; blob(ctx, 56, -7, 5, 3.4); ctx.fill();
    runeMarks(ctx, el, t, [[-8, 8, 11, -0.6], [10, 16, 7, 1.2]]);
  },

  stag(ctx, sp, el, t) {
    const b = BODY[el], g = bodyGrad(ctx, el);
    // legs
    leg(ctx, -22, 18, -26, 55, 7, b.lo); leg(ctx, -6, 20, -8, 56, 7, b.mid);
    leg(ctx, 20, 18, 24, 55, 7, b.lo); leg(ctx, 32, 18, 38, 55, 7, b.mid);
    // body
    fillInk(ctx, c => blob(c, 0, 10, 38, 23), g);
    // neck
    fillInk(ctx, c => { c.moveTo(20, 4); c.quadraticCurveTo(34, -14, 40, -38); c.lineTo(52, -34); c.quadraticCurveTo(44, -10, 36, 12); }, g);
    // head
    fillInk(ctx, c => blob(c, 47, -46, 17, 13, -0.22), g);
    ctx.fillStyle = b.cream; blob(ctx, 58, -44, 8, 5.5, -0.2); ctx.fill();
    // ears
    fillInk(ctx, c => { c.moveTo(38, -56); c.quadraticCurveTo(30, -72, 44, -64); }, b.mid, 1.4);
    // antlers
    ctx.save(); ctx.strokeStyle = PAL.copper; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.shadowColor = PAL.copper; ctx.shadowBlur = 4;
    ctx.beginPath(); ctx.moveTo(44, -56); ctx.quadraticCurveTo(44, -80, 30, -88); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(37, -72); ctx.lineTo(22, -76); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(50, -57); ctx.quadraticCurveTo(58, -82, 72, -84); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(60, -72); ctx.lineTo(72, -66); ctx.stroke();
    ctx.restore();
    flameTip(ctx, 29, -92, 0.5, ELEMENTS[el].light, 0.9 + Math.sin(t * 5) * 0.1);
    flameTip(ctx, 73, -88, 0.46, ELEMENTS[el].light, 0.85 + Math.cos(t * 4.3) * 0.1);
    // tail
    ctx.strokeStyle = b.cream; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-36, 2); ctx.quadraticCurveTo(-48, -2, -44, 10); ctx.stroke();
    eye(ctx, 52, -48, 4.2);
    ctx.fillStyle = '#24182e'; blob(ctx, 61, -41, 3.4, 2.4); ctx.fill();
    runeMarks(ctx, el, t, [[-2, 6, 10, -1.4], [14, 14, 6, 0.7]]);
  },

  otter(ctx, sp, el, t) {
    const b = BODY[el], g = bodyGrad(ctx, el);
    // thick tail
    ctx.beginPath(); ctx.moveTo(-38, 24);
    ctx.bezierCurveTo(-72, 30, -84, 12, -66, 2); ctx.quadraticCurveTo(-55, -2, -54, 10);
    ctx.fillStyle = b.mid; ctx.fill(); inkStroke(ctx, 2); ctx.stroke();
    // body
    fillInk(ctx, c => blob(c, 2, 22, 48, 21), g);
    ctx.fillStyle = b.cream; ctx.globalAlpha = 0.9; blob(ctx, 12, 30, 30, 10); ctx.fill(); ctx.globalAlpha = 1;
    // paws
    leg(ctx, -18, 34, -24, 48, 9, b.lo); leg(ctx, 24, 34, 30, 48, 9, b.lo);
    // head
    fillInk(ctx, c => blob(c, 48, 2, 22, 19), g);
    fillInk(ctx, c => { c.moveTo(34, -12); c.quadraticCurveTo(32, -25, 42, -18); }, b.mid, 1.4);
    fillInk(ctx, c => { c.moveTo(57, -12); c.quadraticCurveTo(62, -24, 66, -14); }, b.mid, 1.4);
    ctx.fillStyle = b.cream; blob(ctx, 60, 8, 11, 8); ctx.fill();
    eye(ctx, 43, 0, 4.4); eye(ctx, 57, 0, 4.4);
    ctx.fillStyle = '#24182e'; blob(ctx, 64, 7, 4, 2.8); ctx.fill();
    // whiskers
    ctx.save(); ctx.strokeStyle = 'rgba(240,230,205,.65)'; ctx.lineWidth = 1;
    for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(62, 8 + i * 3); ctx.lineTo(82, 4 + i * 7); ctx.stroke(); }
    ctx.restore();
    runeMarks(ctx, el, t, [[-6, 20, 11, -0.4], [8, 28, 6, 1.6]]);
  },

  shell(ctx, sp, el, t) {
    const b = BODY[el], g = bodyGrad(ctx, el, -50, 40);
    const float = Math.sin(t * 1.8) * 3;
    ctx.save(); ctx.translate(0, float);
    // mist tail
    ctx.strokeStyle = 'rgba(140,230,215,.35)'; ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-18 + i * 18, 34); ctx.quadraticCurveTo(-30 + i * 24, 50, -14 + i * 20, 58); ctx.stroke(); }
    // shell fan
    ctx.beginPath(); ctx.moveTo(-60, 28); ctx.quadraticCurveTo(-64, -28, 0, -52); ctx.quadraticCurveTo(64, -28, 60, 28); ctx.quadraticCurveTo(0, 40, -60, 28); ctx.closePath();
    ctx.fillStyle = g; ctx.fill(); inkStroke(ctx, 2.4); ctx.stroke();
    ctx.strokeStyle = b.cream; ctx.lineWidth = 1.4; ctx.globalAlpha = 0.7;
    for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(i * 15, 30); ctx.quadraticCurveTo(i * 18, -10, i * 2, -44); ctx.stroke(); }
    ctx.globalAlpha = 1;
    // pearls
    for (let i = 0; i < 2; i++) {
      const px = -42 + i * 84, py = -8 + Math.sin(t * 2.4 + i) * 5;
      ctx.fillStyle = ELEMENTS[el].light; ctx.shadowColor = ELEMENTS[el].hue; ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.arc(px, py, 5, 0, TAU); ctx.fill(); ctx.shadowBlur = 0;
    }
    // head peeking
    fillInk(ctx, c => blob(c, 0, 30, 18, 14), b.hi);
    eye(ctx, -6, 28, 3.6); eye(ctx, 6, 28, 3.6);
    ctx.fillStyle = '#24182e'; blob(ctx, 0, 36, 4, 2.4); ctx.fill();
    runeMarks(ctx, el, t, [[0, -6, 14, -1.2], [0, 6, 8, 1.9]]);
    ctx.restore();
  },

  rhino(ctx, sp, el, t) {
    const b = BODY[el], g = bodyGrad(ctx, el);
    leg(ctx, -32, 32, -36, 52, 14, b.lo); leg(ctx, 22, 32, 26, 52, 14, b.lo);
    leg(ctx, -16, 34, -18, 53, 12, b.mid); leg(ctx, 38, 34, 42, 53, 12, b.mid);
    // body
    fillInk(ctx, c => blob(c, 0, 12, 52, 32), g);
    // back plates
    ctx.save(); ctx.fillStyle = b.lo; ctx.strokeStyle = 'rgba(20,14,30,.8)'; ctx.lineWidth = 1.5;
    for (let i = 0; i < 4; i++) {
      const x = -38 + i * 20;
      ctx.beginPath(); ctx.moveTo(x - 12, -14); ctx.lineTo(x, -26 - (i % 2) * 4); ctx.lineTo(x + 12, -14); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
    // head + horn
    fillInk(ctx, c => { c.moveTo(34, -18); c.quadraticCurveTo(62, -22, 66, 4); c.quadraticCurveTo(62, 26, 38, 24); c.quadraticCurveTo(30, 4, 34, -18); }, g);
    ctx.fillStyle = PAL.copperHi; ctx.strokeStyle = PAL.copperLo; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(60, -10); ctx.quadraticCurveTo(94, -34, 96, -58); ctx.quadraticCurveTo(76, -38, 54, -20); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(240,220,180,.28)'; ctx.beginPath(); ctx.moveTo(64, -14); ctx.quadraticCurveTo(84, -32, 88, -48); ctx.quadraticCurveTo(76, -32, 62, -20); ctx.fill();
    fillInk(ctx, c => { c.moveTo(46, -22); c.quadraticCurveTo(44, -36, 56, -28); }, b.mid, 1.2);
    ctx.strokeStyle = b.lo; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(58, 10); ctx.lineTo(68, 8); ctx.stroke();
    eye(ctx, 56, 2, 4.2);
    ctx.fillStyle = '#24182e'; blob(ctx, 72, 14, 4, 2.5); ctx.fill();
    // tail
    ctx.strokeStyle = b.lo; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-48, 4); ctx.quadraticCurveTo(-62, 12, -58, 24); ctx.stroke();
    runeMarks(ctx, el, t, [[-8, 4, 12, -0.8], [10, 18, 7, 1.1]]);
  },

  tortoise(ctx, sp, el, t) {
    const b = BODY[el], g = bodyGrad(ctx, el);
    leg(ctx, -34, 30, -38, 50, 13, b.lo); leg(ctx, 30, 30, 34, 50, 13, b.lo);
    // head + neck
    fillInk(ctx, c => blob(c, 58, 24, 17, 13), b.hi);
    ctx.strokeStyle = b.hi; ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(44, 18); ctx.lineTo(36, 12); ctx.stroke();
    eye(ctx, 63, 21, 3.4);
    // shell dome
    ctx.beginPath(); ctx.moveTo(-58, 30); ctx.quadraticCurveTo(-64, -28, 0, -46); ctx.quadraticCurveTo(64, -28, 58, 30); ctx.closePath();
    ctx.fillStyle = g; ctx.fill(); inkStroke(ctx, 2.6); ctx.stroke();
    // hexagonal plates
    ctx.save(); ctx.strokeStyle = b.cream; ctx.globalAlpha = 0.65; ctx.lineWidth = 1.3;
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
      const cx = -24 + i * 24 + j * 12, cy = -8 + j * 18;
      ctx.beginPath();
      for (let k = 0; k < 6; k++) { const a = -Math.PI / 2 + k * TAU / 6; const px = cx + Math.cos(a) * 12, py = cy + Math.sin(a) * 11; k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
      ctx.closePath(); ctx.stroke();
    }
    ctx.restore();
    // moss tufts
    ctx.fillStyle = '#79a86a';
    for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(-36 + i * 18, -32 + Math.sin(i) * 6, 4 + (i % 2), 0, TAU); ctx.fill(); }
    // tail
    ctx.fillStyle = b.lo; blob(ctx, -60, 28, 8, 4, -0.3); ctx.fill();
    runeMarks(ctx, el, t, [[0, -18, 13, -1.6], [0, 2, 7, 0.9]]);
  },

  falcon(ctx, sp, el, t) {
    const b = BODY[el], g = bodyGrad(ctx, el);
    const flap = Math.sin(t * 3.2) * 4;
    // wings
    ctx.save();
    ctx.fillStyle = g; inkStroke(ctx, 2);
    ctx.beginPath(); ctx.moveTo(-12, -6); ctx.quadraticCurveTo(-58, -34 - flap, -92, -12 + flap); ctx.quadraticCurveTo(-62, 4, -28, 14); ctx.quadraticCurveTo(-18, 6, -12, -6); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(12, -6); ctx.quadraticCurveTo(58, -34 - flap, 92, -12 + flap); ctx.quadraticCurveTo(62, 4, 28, 14); ctx.quadraticCurveTo(18, 6, 12, -6); ctx.fill(); ctx.stroke();
    // feather notches
    ctx.strokeStyle = b.lo; ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-28 - i * 14, 8); ctx.lineTo(-42 - i * 14, 18 - i * 3); ctx.stroke(); ctx.beginPath(); ctx.moveTo(28 + i * 14, 8); ctx.lineTo(42 + i * 14, 18 - i * 3); ctx.stroke(); }
    ctx.restore();
    // tail feathers
    ctx.fillStyle = b.lo;
    for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(i * 7, 18); ctx.lineTo(i * 12, 48); ctx.lineTo(i * 7 + 5, 40); ctx.closePath(); ctx.fill(); }
    // body/head
    fillInk(ctx, c => blob(c, 0, 4, 20, 28), g);
    fillInk(ctx, c => blob(c, 4, -30, 19, 16), b.hi);
    // beak
    ctx.fillStyle = PAL.copperHi; ctx.strokeStyle = PAL.copperLo; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(18, -34); ctx.lineTo(34, -27); ctx.lineTo(19, -22); ctx.closePath(); ctx.fill(); ctx.stroke();
    eye(ctx, 11, -33, 3.8); eye(ctx, -3, -33, 3.8);
    // talons
    ctx.strokeStyle = PAL.copper; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(-6, 30); ctx.lineTo(-10, 44); ctx.moveTo(6, 30); ctx.lineTo(10, 44); ctx.stroke();
    runeMarks(ctx, el, t, [[-2, 0, 10, -1.8], [0, 12, 5, 0.8]]);
  },

  fox(ctx, sp, el, t) {
    const b = BODY[el], g = bodyGrad(ctx, el);
    // big tail behind
    ctx.beginPath(); ctx.moveTo(-16, 38);
    ctx.bezierCurveTo(-58, 42, -86, 8, -66, -16);
    ctx.bezierCurveTo(-52, -30, -34, -12, -40, 8);
    ctx.bezierCurveTo(-42, 26, -26, 34, -16, 30); ctx.closePath();
    ctx.fillStyle = g; ctx.fill(); inkStroke(ctx, 2.2); ctx.stroke();
    ctx.fillStyle = b.cream; ctx.beginPath(); ctx.moveTo(-67, -18); ctx.quadraticCurveTo(-58, -28, -50, -16); ctx.quadraticCurveTo(-60, -8, -67, -18); ctx.fill();
    // body sitting
    fillInk(ctx, c => { c.moveTo(-26, 46); c.quadraticCurveTo(-32, 4, -10, -8); c.quadraticCurveTo(18, -6, 26, 20); c.quadraticCurveTo(30, 40, 22, 46); }, g);
    ctx.fillStyle = b.cream; ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.moveTo(-6, 4); ctx.quadraticCurveTo(12, 6, 16, 38); ctx.quadraticCurveTo(4, 46, -6, 38); ctx.fill(); ctx.globalAlpha = 1;
    // head
    fillInk(ctx, c => { c.moveTo(-6, -14); c.quadraticCurveTo(6, -36, 28, -30); c.quadraticCurveTo(38, -12, 22, 2); c.quadraticCurveTo(4, 10, -6, -14); }, g);
    // ears
    fillInk(ctx, c => { c.moveTo(0, -30); c.lineTo(-8, -62); c.lineTo(14, -40); }, b.mid, 1.6);
    fillInk(ctx, c => { c.moveTo(20, -34); c.lineTo(30, -62); c.lineTo(34, -34); }, b.mid, 1.6);
    ctx.fillStyle = b.cream; ctx.beginPath(); ctx.moveTo(0, -36); ctx.lineTo(-4, -54); ctx.lineTo(8, -40); ctx.fill();
    ctx.beginPath(); ctx.moveTo(24, -38); ctx.lineTo(29, -54); ctx.lineTo(30, -38); ctx.fill();
    // snout
    ctx.fillStyle = b.cream; blob(ctx, 30, -8, 12, 7, 0.2); ctx.fill();
    eye(ctx, 12, -22, 3.8); eye(ctx, 26, -20, 3.5);
    ctx.fillStyle = '#1b1428'; blob(ctx, 40, -6, 3.2, 2.2); ctx.fill();
    // front paws
    leg(ctx, 4, 34, 2, 48, 8, b.lo); leg(ctx, 18, 34, 20, 48, 8, b.lo);
    runeMarks(ctx, el, t, [[4, 0, 9, -0.2], [-12, 20, 6, 1.5]]);
  },

  rabbit(ctx, sp, el, t) {
    const b = BODY[el], g = bodyGrad(ctx, el);
    // lantern
    const sway = Math.sin(t * 2.2) * 3;
    ctx.save(); ctx.translate(0, -64);
    ctx.strokeStyle = PAL.copper; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(0, 6); ctx.lineTo(0, -4); ctx.stroke();
    ctx.fillStyle = 'rgba(255,230,150,.18)'; ctx.shadowColor = ELEMENTS[el].light; ctx.shadowBlur = 18;
    ctx.beginPath(); ctx.arc(sway * 0.2, -12, 11, 0, TAU); ctx.fill();
    ctx.fillStyle = ELEMENTS[el].light; ctx.beginPath(); ctx.ellipse(sway * 0.2, -12, 6, 8, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = PAL.copper; ctx.stroke();
    ctx.restore();
    // feet
    ctx.fillStyle = b.lo; blob(ctx, -16, 50, 13, 5); ctx.fill(); blob(ctx, 16, 50, 13, 5); ctx.fill();
    // body
    fillInk(ctx, c => blob(c, 0, 26, 30, 27), g);
    ctx.fillStyle = b.cream; ctx.globalAlpha = 0.9; blob(ctx, 0, 34, 18, 14); ctx.fill(); ctx.globalAlpha = 1;
    // ears
    fillInk(ctx, c => { c.moveTo(-14, -2); c.quadraticCurveTo(-38, -26, -24, -62); c.quadraticCurveTo(-8, -42, -2, -8); }, g, 1.8);
    fillInk(ctx, c => { c.moveTo(10, -8); c.quadraticCurveTo(22, -50, 34, -58); c.quadraticCurveTo(34, -22, 20, -2); }, g, 1.8);
    ctx.fillStyle = b.cream; ctx.globalAlpha = 0.7;
    ctx.beginPath(); ctx.moveTo(-13, -10); ctx.quadraticCurveTo(-28, -30, -20, -50); ctx.quadraticCurveTo(-12, -30, -8, -12); ctx.fill();
    ctx.beginPath(); ctx.moveTo(16, -12); ctx.quadraticCurveTo(25, -40, 30, -50); ctx.quadraticCurveTo(28, -26, 18, -10); ctx.fill();
    ctx.globalAlpha = 1;
    // head
    fillInk(ctx, c => blob(c, 0, 0, 24, 21), g);
    eye(ctx, -8, 0, 4.4); eye(ctx, 8, 0, 4.4);
    ctx.fillStyle = '#24182e'; blob(ctx, 0, 10, 3.6, 2.4); ctx.fill();
    // arms
    leg(ctx, -22, 24, -30, 32, 7, b.mid); leg(ctx, 22, 24, 30, 32, 7, b.mid);
    runeMarks(ctx, el, t, [[0, 26, 9, -1.1], [0, 36, 5, 1.4]]);
  },

  ram(ctx, sp, el, t) {
    const b = BODY[el], g = bodyGrad(ctx, el);
    leg(ctx, -26, 30, -30, 52, 10, b.lo); leg(ctx, 6, 32, 4, 53, 10, b.mid); leg(ctx, 28, 30, 32, 52, 10, b.lo);
    // fluffy body
    ctx.fillStyle = g; inkStroke(ctx, 2.2);
    ctx.beginPath();
    const pts = [[-30, 22], [-20, -4], [2, -12], [26, -4], [38, 20], [30, 36], [0, 40], [-24, 36]];
    for (let i = 0; i < pts.length; i++) {
      const [x, y] = pts[i], [nx, ny] = pts[(i + 1) % pts.length];
      if (i === 0) ctx.moveTo(x, y); else ctx.arcTo(x, y, (x + nx) / 2, (y + ny) / 2, 8);
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    // wool curls
    ctx.strokeStyle = b.cream; ctx.lineWidth = 2; ctx.globalAlpha = 0.55;
    for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(-18 + i * 11, 12 + (i % 2) * 10, 7, 0.4, 4.4); ctx.stroke(); }
    ctx.globalAlpha = 1;
    // head
    fillInk(ctx, c => blob(c, 38, -10, 20, 16), b.hi);
    // spiral horns
    ctx.save(); ctx.strokeStyle = PAL.copper; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.shadowColor = PAL.copperLo; ctx.shadowBlur = 3;
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      for (let i = 0; i <= 20; i++) {
        const a = i * 0.48, r = 16 - i * 0.62;
        const px = 38 + dir * (12 + Math.cos(a) * r * 0.9), py = -22 + Math.sin(a) * r * 0.75;
        i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.stroke();
    }
    ctx.restore();
    eye(ctx, 42, -10, 3.6);
    ctx.fillStyle = b.cream; blob(ctx, 54, 2, 8, 5); ctx.fill();
    ctx.fillStyle = '#24182e'; blob(ctx, 56, 2, 3, 2); ctx.fill();
    // ears
    ctx.fillStyle = b.lo; blob(ctx, 24, -14, 7, 4, -0.5); ctx.fill();
    ctx.fillStyle = b.cream; blob(ctx, -40, 16, 7, 5, 0.4); ctx.fill();
    runeMarks(ctx, el, t, [[-4, 14, 9, -0.7], [12, 24, 5, 1.6]]);
  },

  cat(ctx, sp, el, t) {
    const b = BODY[el], g = bodyGrad(ctx, el);
    // twin tails
    ctx.save(); ctx.strokeStyle = b.mid; ctx.lineWidth = 8; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-34, 20); ctx.bezierCurveTo(-62, 4, -60, -30, -40, -36); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-30, 28); ctx.bezierCurveTo(-70, 26, -74, 40, -54, 44); ctx.stroke();
    ctx.strokeStyle = ELEMENTS[el].light; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-40, -34); ctx.lineTo(-44, -40); ctx.stroke();
    ctx.restore();
    // body
    fillInk(ctx, c => { c.moveTo(-28, 44); c.quadraticCurveTo(-36, 8, -16, -6); c.quadraticCurveTo(16, -12, 30, 10); c.quadraticCurveTo(34, 34, 26, 46); }, g);
    // legs
    leg(ctx, -14, 34, -16, 52, 8, b.lo); leg(ctx, 14, 36, 16, 52, 8, b.lo);
    leg(ctx, 24, 30, 30, 45, 7, b.mid);
    // head
    fillInk(ctx, c => { c.moveTo(14, -18); c.quadraticCurveTo(22, -40, 46, -36); c.quadraticCurveTo(60, -18, 50, 0); c.quadraticCurveTo(30, 8, 18, -4); }, g);
    // ears
    fillInk(ctx, c => { c.moveTo(22, -34); c.lineTo(18, -60); c.lineTo(38, -42); }, b.mid, 1.5);
    fillInk(ctx, c => { c.moveTo(46, -38); c.lineTo(54, -62); c.lineTo(58, -36); }, b.mid, 1.5);
    ctx.fillStyle = b.lo; ctx.beginPath(); ctx.moveTo(25, -38); ctx.lineTo(22, -53); ctx.lineTo(33, -42); ctx.fill();
    // ink drip
    ctx.fillStyle = ELEMENTS[el].dark; ctx.beginPath(); ctx.moveTo(18, 40); ctx.quadraticCurveTo(22, 56, 18, 60); ctx.quadraticCurveTo(14, 52, 14, 42); ctx.fill();
    eye(ctx, 32, -22, 3.8, ELEMENTS[el].light); eye(ctx, 46, -22, 3.6, ELEMENTS[el].light);
    // slit pupils
    ctx.fillStyle = '#0e0a18'; ctx.fillRect(31, -26, 2, 8); ctx.fillRect(45, -25, 2, 7);
    ctx.fillStyle = b.cream; blob(ctx, 54, -10, 8, 5); ctx.fill();
    ctx.fillStyle = '#24182e'; blob(ctx, 58, -10, 3, 2); ctx.fill();
    runeMarks(ctx, el, t, [[0, 12, 10, -1.3], [8, 24, 6, 0.9]]);
  },

  owl(ctx, sp, el, t) {
    const b = BODY[el], g = bodyGrad(ctx, el);
    // ear tufts
    fillInk(ctx, c => { c.moveTo(-24, -34); c.lineTo(-30, -62); c.lineTo(-8, -46); }, b.mid, 1.6);
    fillInk(ctx, c => { c.moveTo(24, -34); c.lineTo(30, -62); c.lineTo(8, -46); }, b.mid, 1.6);
    // body
    fillInk(ctx, c => blob(c, 0, 10, 36, 42), g);
    // wings
    ctx.fillStyle = b.lo; ctx.strokeStyle = 'rgba(20,14,30,.7)'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(-30, -10); ctx.quadraticCurveTo(-54, 16, -34, 42); ctx.quadraticCurveTo(-24, 20, -24, -2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(30, -10); ctx.quadraticCurveTo(54, 16, 34, 42); ctx.quadraticCurveTo(24, 20, 24, -2); ctx.fill(); ctx.stroke();
    // belly feather marks
    ctx.strokeStyle = b.cream; ctx.lineWidth = 1.3; ctx.globalAlpha = 0.55;
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(0, 12 + i * 8, 9 - i, 0.8, 2.3); ctx.stroke(); }
    ctx.globalAlpha = 1;
    // eye discs
    ctx.save();
    ctx.fillStyle = b.cream; ctx.globalAlpha = 0.9;
    blob(ctx, -14, -16, 15, 15); ctx.fill(); blob(ctx, 14, -16, 15, 15); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = ELEMENTS[el].light; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(-14, -16, 15, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.arc(14, -16, 15, 0, TAU); ctx.stroke();
    ctx.restore();
    // pupils
    ctx.fillStyle = '#161022'; blob(ctx, -14, -16, 6, 7); ctx.fill(); blob(ctx, 14, -16, 6, 7); ctx.fill();
    ctx.fillStyle = ELEMENTS[el].light; blob(ctx, -16, -19, 2, 2); ctx.fill(); blob(ctx, 12, -19, 2, 2); ctx.fill();
    // beak
    ctx.fillStyle = PAL.copperHi; ctx.beginPath(); ctx.moveTo(-5, -4); ctx.lineTo(5, -4); ctx.lineTo(0, 6); ctx.closePath(); ctx.fill();
    // talons
    ctx.strokeStyle = PAL.copper; ctx.lineWidth = 2.4;
    for (let i = -1; i <= 1; i += 2) { ctx.beginPath(); ctx.moveTo(i * 10, 46); ctx.lineTo(i * 14, 56); ctx.stroke(); }
    runeMarks(ctx, el, t, [[0, 20, 12, -1.4], [0, 32, 7, 0.6]]);
  },
};

export function drawBeast(ctx, id, x, y, s = 1, opts = {}) {
  const sp = SPECIES[id];
  if (!sp) return;
  const el = sp.el, t = opts.t || 0;
  ctx.save();
  // ground shadow
  ctx.save(); ctx.globalAlpha = (opts.alpha == null ? 1 : opts.alpha) * 0.32;
  ctx.fillStyle = '#04030b';
  ctx.beginPath(); ctx.ellipse(x, y + 58 * s, 50 * s, 11 * s, 0, 0, TAU); ctx.fill(); ctx.restore();
  ctx.translate(x, y);
  ctx.scale(opts.flip ? -s : s, s);
  if (opts.alpha != null) ctx.globalAlpha = opts.alpha;
  if (opts.faint) { ctx.rotate(-0.32); ctx.translate(-8, 8); ctx.globalAlpha *= 0.62; }
  const floaty = sp.shape === 'falcon' || sp.shape === 'shell';
  const bob = floaty ? Math.sin(t * 2.1) * 4 : Math.sin(t * 2.4) * 2;
  ctx.translate(0, bob);
  if (opts.flash) {
    ctx.save(); ctx.globalAlpha = Math.min(1, opts.flash) * 0.55; ctx.fillStyle = '#fff6d8';
    ctx.beginPath(); ctx.ellipse(0, 6, 74, 70, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }
  if (opts.shadowAura) { ctx.save(); ctx.shadowColor = ELEMENTS[el].hue; ctx.shadowBlur = 22; ctx.globalAlpha = 0.6; }
  SHAPES[sp.shape] && SHAPES[sp.shape](ctx, sp, el, t);
  if (opts.shadowAura) ctx.restore();
  // element motes
  if (opts.motes !== false) {
    ctx.save(); ctx.fillStyle = ELEMENTS[el].light; ctx.globalAlpha = 0.55;
    for (let i = 0; i < 3; i++) {
      const a = t * 0.8 + i * 2.1, r = 58 + Math.sin(t + i) * 5;
      ctx.beginPath(); ctx.arc(Math.cos(a) * r, -18 + Math.sin(a) * 24, 2.2, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
  ctx.restore();
}

// ---------- element icons ----------
export function drawElementIcon(ctx, el, x, y, r, opts = {}) {
  const e = ELEMENTS[el];
  if (!e) return;
  ctx.save(); ctx.translate(x, y);
  if (opts.plate !== false) {
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU);
    ctx.fillStyle = opts.dim ? 'rgba(20,16,38,.85)' : 'rgba(16,12,32,.9)'; ctx.fill();
    ctx.strokeStyle = opts.dim ? 'rgba(200,170,110,.32)' : e.hue; ctx.lineWidth = 1.5; ctx.stroke();
  }
  ctx.strokeStyle = opts.dim ? e.dark : e.light; ctx.fillStyle = e.light;
  ctx.lineWidth = Math.max(1.3, r * 0.14); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.shadowColor = e.hue; ctx.shadowBlur = opts.plate === false ? 6 : 0;
  const k = r * 0.58;
  const g = e.glyph;
  if (g === 'flame') {
    ctx.beginPath(); ctx.moveTo(0, -k); ctx.bezierCurveTo(k * 0.8, -k * 0.2, k * 0.5, k * 0.75, 0, k * 0.8);
    ctx.bezierCurveTo(-k * 0.5, k * 0.75, -k * 0.8, -k * 0.2, 0, -k); ctx.fill();
  } else if (g === 'wave') {
    for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(-k, i * k * 0.48); ctx.quadraticCurveTo(0, i * k * 0.48 - k * 0.6, k, i * k * 0.48); ctx.stroke(); }
  } else if (g === 'stone') {
    ctx.beginPath(); ctx.moveTo(0, -k); ctx.lineTo(k * 0.9, -k * 0.1); ctx.lineTo(k * 0.45, k * 0.8); ctx.lineTo(-k * 0.45, k * 0.8); ctx.lineTo(-k * 0.9, -k * 0.1); ctx.closePath(); ctx.stroke();
  } else if (g === 'gale') {
    for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(-k, i * k * 0.55); ctx.quadraticCurveTo(k * 0.4, i * k * 0.55 - k * 0.35, k, i * k * 0.35); ctx.stroke(); }
  } else if (g === 'light') {
    ctx.beginPath(); ctx.arc(0, 0, k * 0.38, 0, TAU); ctx.fill();
    for (let i = 0; i < 6; i++) { const a = i * TAU / 6; ctx.beginPath(); ctx.moveTo(Math.cos(a) * k * 0.62, Math.sin(a) * k * 0.62); ctx.lineTo(Math.cos(a) * k, Math.sin(a) * k); ctx.stroke(); }
  } else if (g === 'shadow') {
    ctx.beginPath(); ctx.arc(0, 0, k * 0.7, -1.1, 1.9); ctx.stroke();
    ctx.beginPath(); ctx.arc(k * 0.28, 0, k * 0.52, 1.85, 4.35); ctx.stroke();
  }
  ctx.restore();
}

export function drawGlyphRing(ctx, x, y, r, t = 0, opts = {}) {
  const alpha = opts.alpha == null ? 1 : opts.alpha;
  ctx.save(); ctx.translate(x, y); ctx.globalAlpha = alpha;
  // outer rings
  ctx.strokeStyle = 'rgba(217,164,91,.28)'; ctx.lineWidth = 1.2;
  for (const rr of [r, r * 0.86, r * 0.46]) { ctx.beginPath(); ctx.arc(0, 0, rr, 0, TAU); ctx.stroke(); }
  // tick marks
  ctx.strokeStyle = 'rgba(217,164,91,.42)';
  for (let i = 0; i < 60; i++) {
    const a = i * TAU / 60, len = i % 5 === 0 ? 9 : 4;
    ctx.beginPath(); ctx.moveTo(Math.cos(a) * (r - 2), Math.sin(a) * (r - 2));
    ctx.lineTo(Math.cos(a) * (r - 2 - len), Math.sin(a) * (r - 2 - len)); ctx.stroke();
  }
  // six element nodes, slowly rotating
  const rot = (opts.rot == null ? t * 0.05 : opts.rot);
  const els = ['flame', 'gale', 'stone', 'tide', 'light', 'shadow'];
  for (let i = 0; i < 6; i++) {
    const a = rot + i * TAU / 6 - Math.PI / 2;
    const px = Math.cos(a) * r * 0.7, py = Math.sin(a) * r * 0.7;
    drawElementIcon(ctx, els[i], px, py, Math.max(10, r * 0.095), { plate: true, dim: opts.dim });
  }
  // center glyph
  ctx.strokeStyle = 'rgba(244,210,147,.55)'; ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = rot * 0.7 + i * TAU / 6 - Math.PI / 2;
    const px = Math.cos(a) * r * 0.32, py = Math.sin(a) * r * 0.32;
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.closePath(); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, r * 0.12, 0, TAU); ctx.stroke();
  ctx.restore();
}

export function drawPlayer(ctx, x, y, facing, t, opts = {}) {
  ctx.save(); ctx.translate(x, y);
  ctx.scale(facing < 0 ? -1 : 1, 1);
  const bob = Math.sin(t * 7) * (opts.moving ? 2.2 : 0.8);
  ctx.translate(0, bob);
  // shadow
  ctx.fillStyle = 'rgba(4,3,12,.4)'; ctx.beginPath(); ctx.ellipse(0, 3, 16, 6, 0, 0, TAU); ctx.fill();
  // cloak
  ctx.fillStyle = '#2a2450'; ctx.strokeStyle = '#16112c'; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(-11, -20); ctx.quadraticCurveTo(-17, 0, -14, 4); ctx.lineTo(14, 4); ctx.quadraticCurveTo(17, -2, 11, -20); ctx.closePath(); ctx.fill(); ctx.stroke();
  // copper trim
  ctx.strokeStyle = 'rgba(217,164,91,.75)'; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(-12, -4); ctx.lineTo(13, -4); ctx.stroke();
  // legs
  ctx.strokeStyle = '#1b1634'; ctx.lineWidth = 5; ctx.lineCap = 'round';
  const sw = opts.moving ? Math.sin(t * 10) * 3 : 0;
  ctx.beginPath(); ctx.moveTo(-5, 3); ctx.lineTo(-6 + sw, 14); ctx.moveTo(5, 3); ctx.lineTo(6 - sw, 14); ctx.stroke();
  // head
  ctx.fillStyle = '#d8b48a'; ctx.beginPath(); ctx.arc(0, -25, 8, 0, TAU); ctx.fill();
  // hat
  ctx.fillStyle = '#3a315f'; ctx.strokeStyle = '#17112c'; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(-17, -29); ctx.quadraticCurveTo(0, -38, 17, -29); ctx.quadraticCurveTo(0, -34, -17, -29); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-9, -30); ctx.quadraticCurveTo(0, -48, 9, -30); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(217,164,91,.8)'; ctx.beginPath(); ctx.arc(0, -30, 2.2, 0, TAU); ctx.fill();
  // scarf
  ctx.fillStyle = '#b8503c'; ctx.beginPath(); ctx.moveTo(-8, -19); ctx.quadraticCurveTo(0, -16, 8, -19); ctx.lineTo(11, -13); ctx.quadraticCurveTo(0, -11, -8, -15); ctx.fill();
  // lantern staff
  const sway = Math.sin(t * 3) * 2;
  ctx.strokeStyle = '#8a6236'; ctx.lineWidth = 2.4;
  ctx.beginPath(); ctx.moveTo(13, -32); ctx.lineTo(17, 12); ctx.stroke();
  ctx.strokeStyle = 'rgba(217,164,91,.8)'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(13, -30); ctx.quadraticCurveTo(26, -34, 27, -22); ctx.stroke();
  const lx = 27 + sway, ly = -17;
  ctx.save(); ctx.shadowColor = '#ffd98a'; ctx.shadowBlur = 16;
  ctx.fillStyle = 'rgba(255,220,140,.35)'; ctx.beginPath(); ctx.arc(lx, ly, 9, 0, TAU); ctx.fill();
  ctx.fillStyle = '#ffe4a2'; ctx.beginPath(); ctx.ellipse(lx, ly, 5, 7, 0, 0, TAU); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = '#b88a4a'; ctx.strokeRect(lx - 5, ly - 8, 10, 16);
  // face mark
  ctx.fillStyle = '#2a2036'; ctx.beginPath(); ctx.arc(3, -25, 1.3, 0, TAU); ctx.fill();
  ctx.restore();
}

export function drawTent(ctx, x, y, t) {
  ctx.save(); ctx.translate(x, y);
  // shadow
  ctx.fillStyle = 'rgba(4,3,12,.35)'; ctx.beginPath(); ctx.ellipse(0, 6, 52, 13, 0, 0, TAU); ctx.fill();
  // tent body
  ctx.beginPath(); ctx.moveTo(-46, 0); ctx.quadraticCurveTo(0, -78, 46, 0); ctx.closePath();
  const g = ctx.createLinearGradient(0, -70, 0, 0); g.addColorStop(0, '#4a3f70'); g.addColorStop(1, '#272144');
  ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = '#140f2a'; ctx.lineWidth = 2; ctx.stroke();
  // copper seams
  ctx.strokeStyle = 'rgba(217,164,91,.6)'; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(-34, -6); ctx.quadraticCurveTo(0, -66, 34, -6); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, -70); ctx.lineTo(0, 0); ctx.stroke();
  // door
  ctx.beginPath(); ctx.moveTo(-12, 0); ctx.quadraticCurveTo(0, -34, 12, 0); ctx.closePath();
  ctx.fillStyle = '#17122e'; ctx.fill();
  ctx.strokeStyle = 'rgba(244,210,147,.5)'; ctx.stroke();
  // banner
  ctx.strokeStyle = '#8a6236'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -70); ctx.lineTo(0, -88); ctx.stroke();
  ctx.fillStyle = '#b8503c'; ctx.beginPath(); ctx.moveTo(0, -88); ctx.lineTo(22, -83); ctx.lineTo(0, -76); ctx.fill();
  // lantern
  ctx.fillStyle = '#ffd98a'; ctx.shadowColor = '#ffcf70'; ctx.shadowBlur = 12; ctx.beginPath(); ctx.arc(38, -22, 4, 0, TAU); ctx.fill();
  ctx.restore();
}

export function drawCampfire(ctx, x, y, t) {
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = 'rgba(4,3,12,.3)'; ctx.beginPath(); ctx.ellipse(0, 4, 24, 7, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#5c4027'; ctx.lineWidth = 5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-14, 2); ctx.lineTo(14, -2); ctx.moveTo(-12, -3); ctx.lineTo(13, 4); ctx.stroke();
  // flames
  for (let i = 0; i < 3; i++) {
    const h = 22 + Math.sin(t * 8 + i * 2) * 6;
    ctx.fillStyle = i === 0 ? '#ff8a4a' : i === 1 ? '#ffc05e' : '#fff0b0';
    ctx.globalAlpha = 0.85;
    ctx.beginPath(); ctx.moveTo((i - 1) * 5, 0);
    ctx.quadraticCurveTo((i - 1) * 5 + 8, -h * 0.5, (i - 1) * 3 + Math.sin(t * 6 + i) * 2, -h);
    ctx.quadraticCurveTo((i - 1) * 5 - 8, -h * 0.4, (i - 1) * 5, 0); ctx.fill();
  }
  ctx.globalAlpha = 1;
  // glow
  const grd = ctx.createRadialGradient(0, -12, 2, 0, -12, 50);
  grd.addColorStop(0, 'rgba(255,170,90,.26)'); grd.addColorStop(1, 'rgba(255,170,90,0)');
  ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(0, -12, 50, 0, TAU); ctx.fill();
  ctx.restore();
}

export function drawShop(ctx, x, y, t) {
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = 'rgba(4,3,12,.35)'; ctx.beginPath(); ctx.ellipse(0, 8, 60, 14, 0, 0, TAU); ctx.fill();
  // posts
  ctx.strokeStyle = '#6f4d2f'; ctx.lineWidth = 5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-48, 6); ctx.lineTo(-48, -58); ctx.moveTo(48, 6); ctx.lineTo(48, -58); ctx.stroke();
  // awning
  ctx.beginPath(); ctx.moveTo(-60, -58); ctx.lineTo(60, -58); ctx.lineTo(48, -38); ctx.lineTo(-48, -38); ctx.closePath();
  const g = ctx.createLinearGradient(0, -58, 0, -38); g.addColorStop(0, '#b8503c'); g.addColorStop(1, '#7c3228');
  ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = '#2a1420'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.strokeStyle = 'rgba(240,210,150,.55)'; ctx.lineWidth = 1;
  for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * 20, -56); ctx.lineTo(i * 16, -39); ctx.stroke(); }
  // counter
  ctx.fillStyle = '#4c3524'; ctx.fillRect(-52, -18, 104, 10); ctx.strokeStyle = '#24170f'; ctx.strokeRect(-52, -18, 104, 10);
  ctx.fillStyle = '#5c4027'; ctx.fillRect(-42, -8, 84, 14);
  // hanging seals
  for (let i = 0; i < 4; i++) {
    const sx = -30 + i * 20, sw = Math.sin(t * 1.6 + i) * 2;
    ctx.strokeStyle = '#c9a066'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(sx, -38); ctx.lineTo(sx + sw, -26); ctx.stroke();
    ctx.fillStyle = i % 2 ? '#e8d9b8' : '#d9c08a'; ctx.fillRect(sx + sw - 3, -26, 6, 11);
    ctx.strokeStyle = '#a44a38'; ctx.strokeRect(sx + sw - 3, -26, 6, 11);
  }
  // merchant
  ctx.fillStyle = '#221b3c'; ctx.beginPath(); ctx.arc(10, -32, 9, 0, TAU); ctx.fill();
  ctx.fillStyle = '#d8b48a'; ctx.beginPath(); ctx.arc(10, -30, 7, 0, TAU); ctx.fill();
  ctx.fillStyle = '#2f2850'; ctx.beginPath(); ctx.moveTo(-2, -8); ctx.quadraticCurveTo(10, -24, 22, -8); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#c9a066'; ctx.beginPath(); ctx.arc(10, -40, 4, 0, TAU); ctx.fill();
  // lanterns
  for (let i = -1; i <= 1; i += 2) {
    ctx.fillStyle = '#ffd98a'; ctx.shadowColor = '#ffcf70'; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.arc(i * 50, -28, 3.6, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

export function drawGate(ctx, boss, x, y, t, state) {
  const el = ELEMENTS[boss.el];
  const locked = state === 'locked', beat = state === 'beaten';
  ctx.save(); ctx.translate(x, y);
  const dim = locked ? 0.52 : 1;
  ctx.globalAlpha = dim;
  // rune floor
  ctx.save();
  ctx.strokeStyle = beat ? 'rgba(111,224,192,.5)' : locked ? 'rgba(160,140,190,.3)' : el.hue;
  ctx.lineWidth = 1.6; ctx.globalAlpha = dim * (0.55 + Math.sin(t * 2) * 0.12);
  ctx.beginPath(); ctx.ellipse(0, 34, 58, 15, 0, 0, TAU); ctx.stroke();
  for (let i = 0; i < 6; i++) {
    const a = i * TAU / 6 + t * 0.08;
    ctx.beginPath(); ctx.moveTo(Math.cos(a) * 44, 34 + Math.sin(a) * 10); ctx.lineTo(Math.cos(a) * 54, 34 + Math.sin(a) * 13); ctx.stroke();
  }
  ctx.restore();
  // pillars
  ctx.fillStyle = '#352b52'; ctx.strokeStyle = '#17112e'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.rect(-48, -104, 12, 140); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.rect(36, -104, 12, 140); ctx.fill(); ctx.stroke();
  // top beams
  ctx.fillStyle = '#4a3a63';
  ctx.beginPath(); ctx.rect(-58, -108, 116, 10); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.rect(-50, -92, 100, 7); ctx.fill(); ctx.stroke();
  // banner
  ctx.fillStyle = beat ? '#3c5a52' : locked ? '#3a3350' : (boss.el === 'shadow' ? '#3f2f5c' : boss.el === 'light' ? '#7a6335' : boss.el === 'stone' ? '#66502f' : boss.el === 'gale' ? '#3f6b50' : '#1f5f66');
  ctx.beginPath(); ctx.moveTo(-16, -92); ctx.lineTo(16, -92); ctx.lineTo(16, -46); ctx.lineTo(0, -38); ctx.lineTo(-16, -46); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = el.hue; ctx.lineWidth = 1.4; ctx.stroke();
  // element emblem on banner
  drawElementIcon(ctx, boss.el, 0, -66, 13, { plate: false, dim: locked });
  // hanging seals
  for (let i = -1; i <= 1; i++) {
    const sx = i * 34 + Math.sin(t * 1.5 + i) * 1.5;
    ctx.strokeStyle = 'rgba(200,170,110,.5)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(sx, -102); ctx.lineTo(sx, -86); ctx.stroke();
    ctx.fillStyle = 'rgba(234,217,184,.7)'; ctx.fillRect(sx - 3, -86, 6, 12);
  }
  // guardian
  ctx.globalAlpha = dim * 0.95;
  ctx.fillStyle = '#1c1736'; ctx.beginPath(); ctx.arc(0, -30, 10, 0, TAU); ctx.fill();
  ctx.fillStyle = '#2b2446'; ctx.beginPath(); ctx.moveTo(-14, -12); ctx.quadraticCurveTo(0, -26, 14, -12); ctx.lineTo(12, 18); ctx.lineTo(-12, 18); ctx.closePath(); ctx.fill();
  ctx.fillStyle = el.hue; ctx.globalAlpha = dim * 0.9; ctx.beginPath(); ctx.arc(0, -33, 4, 0, TAU); ctx.fill();
  // chain if locked
  if (locked) {
    ctx.globalAlpha = 0.8; ctx.strokeStyle = 'rgba(190,170,210,.55)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-20, -78); ctx.lineTo(20, -80); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, -79, 4, 0, TAU); ctx.stroke();
  }
  ctx.restore();
}

export function drawGrassTuft(ctx, x, y, t, el, seed) {
  const sway = Math.sin(t * 2 + seed * 2.4) * 2;
  ctx.save(); ctx.translate(x, y);
  ctx.strokeStyle = el ? ELEMENTS[el].dark : '#2e5b4a';
  ctx.lineWidth = 1.5; ctx.lineCap = 'round';
  for (let i = 0; i < 5; i++) {
    const dx = (i - 2) * 3.2;
    ctx.beginPath(); ctx.moveTo(dx, 0); ctx.quadraticCurveTo(dx + sway, -8 - (i % 3) * 3, dx + sway * 1.6, -14 - (i % 3) * 4); ctx.stroke();
  }
  if (el) { ctx.fillStyle = ELEMENTS[el].light; ctx.globalAlpha = 0.6; ctx.beginPath(); ctx.arc(sway, -16, 1.6, 0, TAU); ctx.fill(); }
  ctx.restore();
}

export function drawRock(ctx, x, y, s = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = '#39334d'; ctx.strokeStyle = '#1b162e'; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(-18, 6); ctx.lineTo(-12, -12); ctx.lineTo(4, -18); ctx.lineTo(18, -6); ctx.lineTo(14, 7); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = 'rgba(217,164,91,.3)'; ctx.beginPath(); ctx.moveTo(-10, -10); ctx.lineTo(2, -4); ctx.lineTo(4, 6); ctx.stroke();
  ctx.restore();
}

export function drawReed(ctx, x, y, t, seed) {
  const sway = Math.sin(t * 1.4 + seed) * 4;
  ctx.save(); ctx.translate(x, y);
  ctx.strokeStyle = '#3d6b58'; ctx.lineWidth = 2; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(sway, -24, sway * 1.6, -46); ctx.stroke();
  ctx.fillStyle = '#5c4a33'; ctx.beginPath(); ctx.ellipse(sway * 1.6, -48, 2.6, 8, sway * 0.02, 0, TAU); ctx.fill();
  ctx.restore();
}

export function drawDeadTree(ctx, x, y, t) {
  ctx.save(); ctx.translate(x, y);
  ctx.strokeStyle = '#2b2344'; ctx.lineWidth = 6; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, 4); ctx.quadraticCurveTo(4, -42, 0, -76); ctx.stroke();
  ctx.lineWidth = 3.2;
  ctx.beginPath(); ctx.moveTo(1, -44); ctx.quadraticCurveTo(-18, -56, -22, -70); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, -60); ctx.quadraticCurveTo(16, -76, 20, -90); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-18, -56); ctx.lineTo(-24, -50); ctx.stroke();
  // faint rune
  ctx.strokeStyle = 'rgba(165,138,222,.35)'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.arc(0, -30, 6, 0.3, 3.1); ctx.stroke();
  ctx.restore();
}

export function drawWaterBand(ctx, x, y, w, t) {
  ctx.save();
  for (let i = 0; i < 4; i++) {
    ctx.strokeStyle = `rgba(92,203,198,${0.07 + i * 0.025})`; ctx.lineWidth = 2 + i;
    ctx.beginPath();
    for (let px = 0; px <= w; px += 12) {
      const py = y + i * 10 + Math.sin((x + px) * 0.02 + t * (0.8 + i * 0.2)) * 3;
      px ? ctx.lineTo(x + px, py) : ctx.moveTo(x + px, py);
    }
    ctx.stroke();
  }
  ctx.restore();
}
