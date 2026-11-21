// Ironwright Arena — procedural Canvas renderer. Every surface, mech, spark
// and boss is drawn from paths and gradients; no image, font or network asset
// is loaded. The static foundry plate is baked once into an offscreen canvas.

import {
  VW, VH, ARENA, BOSSES, WEAPONS, ARMORS, THRUSTERS, partByKey, clamp,
} from './data.js';

const TAU = Math.PI * 2;
const fract = n => n - Math.floor(n);
const hash = n => fract(Math.sin(n * 127.1 + 311.7) * 43758.5453);
const lerp = (a, b, t) => a + (b - a) * t;

function roundRect(g, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + rr, y);
  g.arcTo(x + w, y, x + w, y + h, rr);
  g.arcTo(x + w, y + h, x, y + h, rr);
  g.arcTo(x, y + h, x, y, rr);
  g.arcTo(x, y, x + w, y, rr);
  g.closePath();
}

function poly(g, pts, close = true) {
  if (!pts.length) return;
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
  if (close) g.closePath();
}

function glowDot(g, x, y, r, color, alpha = 1) {
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, color);
  gr.addColorStop(0.28, color);
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.globalAlpha = alpha;
  g.fillStyle = gr;
  g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  g.globalAlpha = 1;
}

function makeBackground() {
  const c = document.createElement('canvas');
  c.width = VW; c.height = VH;
  const g = c.getContext('2d');

  // soot-dark foundry hall
  let bg = g.createLinearGradient(0, 0, 0, VH);
  bg.addColorStop(0, '#090807');
  bg.addColorStop(0.46, '#171411');
  bg.addColorStop(1, '#080706');
  g.fillStyle = bg; g.fillRect(0, 0, VW, VH);

  // furnace haze behind the arena
  let haze = g.createRadialGradient(ARENA.cx, ARENA.cy + 30, 20, ARENA.cx, ARENA.cy + 30, 640);
  haze.addColorStop(0, 'rgba(255,128,48,.18)');
  haze.addColorStop(0.42, 'rgba(150,60,24,.075)');
  haze.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = haze; g.fillRect(0, 0, VW, VH);

  // back wall girders and pipes
  g.save();
  g.globalAlpha = 0.55;
  for (let i = 0; i < 7; i++) {
    const x = 60 + i * 195;
    g.strokeStyle = i % 2 ? '#2b2722' : '#211e1a';
    g.lineWidth = 16;
    g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 8, 86); g.stroke();
    g.strokeStyle = 'rgba(255,180,90,.12)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(x + 4, 0); g.lineTo(x + 10, 80); g.stroke();
  }
  for (let i = 0; i < 4; i++) {
    const y = 32 + i * 17;
    g.strokeStyle = 'rgba(70,62,52,.55)'; g.lineWidth = 7;
    g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(280, y + 22, 830, y - 18, VW, y + 9); g.stroke();
    g.strokeStyle = 'rgba(200,150,80,.08)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(0, y - 2); g.bezierCurveTo(280, y + 20, 830, y - 20, VW, y + 7); g.stroke();
  }
  // hanging chains
  for (let i = 0; i < 11; i++) {
    const x = 70 + i * 112 + hash(i) * 40;
    const len = 40 + hash(i + 9) * 95;
    g.strokeStyle = 'rgba(95,84,68,.36)'; g.lineWidth = 3;
    for (let y = 0; y < len; y += 10) {
      g.beginPath(); g.ellipse(x + Math.sin(y * .4 + i) * 2, y + 5, 4.5, 6, 0, 0, TAU); g.stroke();
    }
  }
  g.restore();

  // arena drop shadow
  g.save();
  g.translate(ARENA.cx, ARENA.cy + 18);
  g.scale(1, ARENA.ry / ARENA.rx);
  let sh = g.createRadialGradient(0, 0, ARENA.rx * .45, 0, 0, ARENA.rx * 1.12);
  sh.addColorStop(0, 'rgba(0,0,0,.68)');
  sh.addColorStop(.8, 'rgba(0,0,0,.38)');
  sh.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = sh;
  g.beginPath(); g.arc(0, 0, ARENA.rx * 1.12, 0, TAU); g.fill();
  g.restore();

  // arena plate
  g.save();
  g.beginPath(); g.ellipse(ARENA.cx, ARENA.cy, ARENA.rx, ARENA.ry, 0, 0, TAU); g.clip();
  let floor = g.createRadialGradient(ARENA.cx - 80, ARENA.cy - 80, 10, ARENA.cx, ARENA.cy, ARENA.rx);
  floor.addColorStop(0, '#2c2823');
  floor.addColorStop(0.48, '#211e1b');
  floor.addColorStop(0.82, '#171512');
  floor.addColorStop(1, '#0e0d0c');
  g.fillStyle = floor;
  g.fillRect(ARENA.cx - ARENA.rx, ARENA.cy - ARENA.ry, ARENA.rx * 2, ARENA.ry * 2);

  // 12 wedge plates
  for (let i = 0; i < 12; i++) {
    const a0 = i / 12 * TAU, a1 = (i + 1) / 12 * TAU;
    poly(g, [[ARENA.cx, ARENA.cy],
      [ARENA.cx + Math.cos(a0) * ARENA.rx, ARENA.cy + Math.sin(a0) * ARENA.ry],
      [ARENA.cx + Math.cos(a1) * ARENA.rx, ARENA.cy + Math.sin(a1) * ARENA.ry]]);
    g.fillStyle = i % 2 ? 'rgba(255,255,255,.012)' : 'rgba(0,0,0,.035)';
    g.fill();
    g.strokeStyle = 'rgba(120,108,88,.14)'; g.lineWidth = 1;
    g.stroke();
  }

  // concentric engraved rings
  for (let i = 1; i <= 7; i++) {
    const f = i / 7;
    g.strokeStyle = i === 3 ? 'rgba(255,152,64,.18)' : 'rgba(140,125,102,.12)';
    g.lineWidth = i === 3 ? 2 : 1;
    g.beginPath(); g.ellipse(ARENA.cx, ARENA.cy, ARENA.rx * f * .94, ARENA.ry * f * .94, 0, 0, TAU); g.stroke();
  }
  // radial seams
  for (let i = 0; i < 24; i++) {
    const a = i / 24 * TAU, r0 = ARENA.rx * .18;
    g.strokeStyle = 'rgba(115,104,86,.13)'; g.lineWidth = 1;
    g.beginPath();
    g.moveTo(ARENA.cx + Math.cos(a) * r0, ARENA.cy + Math.sin(a) * r0 * (ARENA.ry / ARENA.rx));
    g.lineTo(ARENA.cx + Math.cos(a) * ARENA.rx * .9, ARENA.cy + Math.sin(a) * ARENA.ry * .9);
    g.stroke();
  }

  // rivets
  for (let i = 0; i < 58; i++) {
    const a = hash(i + 2) * TAU;
    const rr = 0.55 + hash(i + 8) * .36;
    const x = ARENA.cx + Math.cos(a) * ARENA.rx * rr;
    const y = ARENA.cy + Math.sin(a) * ARENA.ry * rr;
    g.fillStyle = 'rgba(190,166,122,.18)';
    g.beginPath(); g.arc(x, y, 1.7, 0, TAU); g.fill();
    g.fillStyle = 'rgba(0,0,0,.4)';
    g.beginPath(); g.arc(x + .8, y + .8, 1.2, 0, TAU); g.fill();
  }

  // central furnace grate
  g.save();
  g.translate(ARENA.cx, ARENA.cy);
  g.scale(1, ARENA.ry / ARENA.rx);
  const grate = g.createRadialGradient(0, 0, 8, 0, 0, 128);
  grate.addColorStop(0, 'rgba(255,126,45,.28)');
  grate.addColorStop(.45, 'rgba(80,40,18,.38)');
  grate.addColorStop(1, 'rgba(8,7,6,.9)');
  g.fillStyle = grate;
  g.beginPath(); g.arc(0, 0, 128, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(255,161,74,.4)'; g.lineWidth = 3;
  g.beginPath(); g.arc(0, 0, 126, 0, TAU); g.stroke();
  for (let i = -5; i <= 5; i++) {
    g.strokeStyle = 'rgba(20,18,16,.75)'; g.lineWidth = 7;
    g.beginPath(); g.moveTo(-100, i * 16); g.lineTo(100, i * 16); g.stroke();
    g.strokeStyle = 'rgba(255,155,68,.18)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(-100, i * 16 - 2); g.lineTo(100, i * 16 - 2); g.stroke();
  }
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * TAU;
    g.strokeStyle = 'rgba(25,22,19,.8)'; g.lineWidth = 5;
    g.beginPath(); g.moveTo(Math.cos(a) * 30, Math.sin(a) * 30); g.lineTo(Math.cos(a) * 120, Math.sin(a) * 120); g.stroke();
  }
  g.restore();

  // molten circuit channels
  g.save();
  g.strokeStyle = 'rgba(255,107,36,.42)'; g.lineWidth = 4;
  g.shadowColor = 'rgba(255,110,35,.65)'; g.shadowBlur = 12;
  for (const side of [-1, 1]) {
    g.beginPath();
    g.moveTo(ARENA.cx + side * 52, ARENA.cy + 80);
    g.lineTo(ARENA.cx + side * 155, ARENA.cy + 80);
    g.lineTo(ARENA.cx + side * 155, ARENA.cy + 145);
    g.lineTo(ARENA.cx + side * 255, ARENA.cy + 145);
    g.stroke();
    g.beginPath();
    g.moveTo(ARENA.cx + side * 95, ARENA.cy - 90);
    g.lineTo(ARENA.cx + side * 95, ARENA.cy - 145);
    g.lineTo(ARENA.cx + side * 22, ARENA.cy - 145);
    g.stroke();
  }
  g.restore();

  // hazard rim
  g.save();
  g.beginPath(); g.ellipse(ARENA.cx, ARENA.cy, ARENA.rx, ARENA.ry, 0, 0, TAU);
  g.ellipse(ARENA.cx, ARENA.cy, ARENA.rx - 30, ARENA.ry - 30, 0, 0, TAU, true);
  g.clip('evenodd');
  g.fillStyle = '#151310'; g.fillRect(0, 0, VW, VH);
  g.strokeStyle = 'rgba(255,143,52,.42)'; g.lineWidth = 13;
  for (let i = -VW; i < VW * 2; i += 42) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 180, VH); g.stroke();
  }
  g.restore();

  // rim edge
  g.strokeStyle = 'rgba(255,169,82,.33)'; g.lineWidth = 3;
  g.beginPath(); g.ellipse(ARENA.cx, ARENA.cy, ARENA.rx - 1, ARENA.ry - 1, 0, 0, TAU); g.stroke();
  g.strokeStyle = 'rgba(210,184,138,.28)'; g.lineWidth = 1.5;
  g.beginPath(); g.ellipse(ARENA.cx, ARENA.cy, ARENA.rx - 31, ARENA.ry - 31, 0, 0, TAU); g.stroke();

  // floor micro-scratches
  for (let i = 0; i < 85; i++) {
    const x = 120 + hash(i * 2.1) * 1040;
    const y = 140 + hash(i * 3.7) * 500;
    if (((x - ARENA.cx) / ARENA.rx) ** 2 + ((y - ARENA.cy) / ARENA.ry) ** 2 > .92) continue;
    g.strokeStyle = `rgba(210,190,150,${.018 + hash(i) * .03})`;
    g.lineWidth = 1;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + 10 + hash(i + 3) * 38, y + (hash(i + 5) - .5) * 8); g.stroke();
  }
  g.restore();

  // furnace pylons around rim
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + Math.PI / 8;
    const x = ARENA.cx + Math.cos(a) * ARENA.rx * 1.02;
    const y = ARENA.cy + Math.sin(a) * ARENA.ry * 1.08;
    const s = .75 + hash(i + 40) * .3;
    g.save();
    g.translate(x, y);
    g.scale(s, s);
    g.fillStyle = 'rgba(0,0,0,.5)';
    g.beginPath(); g.ellipse(0, 12, 27, 9, 0, 0, TAU); g.fill();
    // base
    poly(g, [[-25, 15], [25, 15], [18, -2], [-18, -2]]);
    let pg = g.createLinearGradient(0, -60, 0, 18);
    pg.addColorStop(0, '#5b5246'); pg.addColorStop(.5, '#2a2722'); pg.addColorStop(1, '#151310');
    g.fillStyle = pg; g.fill();
    g.strokeStyle = 'rgba(255,180,90,.22)'; g.lineWidth = 1; g.stroke();
    // stack
    poly(g, [[-9, -2], [9, -2], [7, -52], [-7, -52]]);
    g.fillStyle = '#211e1a'; g.fill();
    g.strokeStyle = 'rgba(190,158,112,.22)'; g.stroke();
    // furnace vents
    for (let k = 0; k < 3; k++) {
      g.fillStyle = 'rgba(255,112,38,.55)';
      g.beginPath(); g.arc(0, -8 - k * 13, 3.6, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,214,128,.35)';
      g.beginPath(); g.arc(0, -8 - k * 13, 1.6, 0, TAU); g.fill();
    }
    g.restore();
    glowDot(g, x, y - 20, 52, 'rgba(255,118,36,.18)', 1);
  }

  // top and bottom vignette
  let vig = g.createRadialGradient(VW / 2, VH / 2, 220, VW / 2, VH / 2, 760);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(.7, 'rgba(0,0,0,.22)');
  vig.addColorStop(1, 'rgba(0,0,0,.82)');
  g.fillStyle = vig; g.fillRect(0, 0, VW, VH);

  // fine grain
  g.save();
  for (let i = 0; i < 900; i++) {
    g.fillStyle = `rgba(255,235,200,${hash(i + 777) * .018})`;
    g.fillRect(hash(i * 2.3) * VW, hash(i * 5.1) * VH, 1, 1);
  }
  g.restore();
  return c;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const bg = makeBackground();
  const preview = document.getElementById('forgecv');
  const pctx = preview ? preview.getContext('2d') : null;
  let scale = 1, ox = 0, oy = 0, dpr = 1, cssW = VW, cssH = VH;

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    cssW = Math.max(1, window.innerWidth);
    cssH = Math.max(1, window.innerHeight);
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    scale = Math.min(cssW / VW, cssH / VH);
    ox = (cssW - VW * scale) / 2;
    oy = (cssH - VH * scale) / 2;
    if (preview) {
      const p = preview.getBoundingClientRect();
      const pw = Math.max(180, Math.round((p.width || 320) * dpr));
      const ph = Math.max(180, Math.round((p.height || 300) * dpr));
      preview.width = pw; preview.height = ph;
    }
  }

  function draw(view) {
    if (!view) return;
    if (view.mode === 'title') {
      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssW, cssH);
      ctx.fillStyle = '#050504'; ctx.fillRect(0, 0, cssW, cssH);
      ctx.translate(ox, oy); ctx.scale(scale, scale);
      drawTitleScene(view.time || 0);
      ctx.restore();
      return;
    }
    drawArenaScene(view);
  }

  function screenToWorld(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    return { x: (clientX - r.left - ox) / scale, y: (clientY - r.top - oy) / scale };
  }

  function drawAmbient(g, time, heat = 0) {
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 46; i++) {
      const speed = 9 + hash(i + 20) * 22;
      const x = 70 + hash(i + 30) * 1140 + Math.sin(time * .35 + i) * 20;
      const y = VH - ((time * speed + hash(i + 11) * VH) % (VH + 80));
      const a = .06 + hash(i + 5) * .12;
      glowDot(g, x, y, 6 + hash(i + 2) * 14, i % 5 === 0 ? 'rgba(255,228,160,.35)' : 'rgba(255,108,38,.3)', a);
    }
    // forge embers near the rim pylons
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + Math.PI / 8;
      const x = ARENA.cx + Math.cos(a) * ARENA.rx * 1.02;
      const y = ARENA.cy + Math.sin(a) * ARENA.ry * 1.08;
      for (let k = 0; k < 4; k++) {
        const ph = (time * (.25 + hash(i * 9 + k) * .4) + hash(i + k * 3)) % 1;
        glowDot(g, x + Math.sin(ph * 9 + k) * 8, y - 20 - ph * 44, 5 + (1 - ph) * 6, 'rgba(255,146,52,.45)', (1 - ph) * .34);
      }
    }
    if (heat > 0) {
      glowDot(g, VW / 2, VH - 20, 250 + heat * 80, 'rgba(255,74,24,.16)', Math.min(.8, heat));
    }
    g.restore();
  }

  function drawTitleScene(time) {
    ctx.drawImage(bg, 0, 0);
    drawAmbient(ctx, time);
    // furnace halo behind the title silhouettes
    const halo = ctx.createRadialGradient(640, 380, 20, 640, 380, 470);
    halo.addColorStop(0, 'rgba(255,128,45,.13)');
    halo.addColorStop(.55, 'rgba(160,62,20,.05)');
    halo.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = halo; ctx.fillRect(80, 60, 1120, 620);
    const b = BOSSES[2];
    drawBoss(ctx, {
      x: 1036, y: 392, r: 92, def: { ...b, color: '#ff9a3e', accent: '#ffe0a0', dark: '#3b2014' },
      hp: 1, maxHp: 1, flash: 0, enraged: true, angle: Math.PI, time,
    }, time, .88, 1.2);
    drawPlayer(ctx, {
      x: 258, y: 442, aim: -0.52, moving: false, targetSpeed: 0,
      stats: { weapon: 'cleaver', armorKey: 'composite', thrusterKey: 'standard', colors: { weapon: '#ffb15c', armor: '#a6a8a2', thruster: '#c9a46a' } },
    }, {
      weapon: 'cleaver', armor: 'composite', thruster: 'standard',
    }, time, 1.42, 1, true);
    // big faint title emblem arc
    ctx.save();
    ctx.globalAlpha = .22;
    ctx.strokeStyle = '#ffb15c'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(640, 380, 260 + Math.sin(time * .5) * 4, -2.7, -0.4); ctx.stroke();
    ctx.beginPath(); ctx.arc(640, 380, 250 + Math.sin(time * .5 + 2) * 4, 0.44, 2.7); ctx.stroke();
    ctx.restore();
    const vig = ctx.createRadialGradient(VW / 2, VH / 2, 220, VW / 2, VH / 2, 720);
    vig.addColorStop(0, 'rgba(0,0,0,0)'); vig.addColorStop(.72, 'rgba(0,0,0,.28)'); vig.addColorStop(1, 'rgba(0,0,0,.66)');
    ctx.fillStyle = vig; ctx.fillRect(0, 0, VW, VH);
  }

  function drawArenaScene(view) {
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    ctx.fillStyle = '#050504'; ctx.fillRect(0, 0, cssW, cssH);
    ctx.translate(ox, oy); ctx.scale(scale, scale);
    ctx.save();
    if (view.shakeX || view.shakeY) ctx.translate(view.shakeX || 0, view.shakeY || 0);
    ctx.drawImage(bg, 0, 0);
    drawAmbient(ctx, view.time, view.player ? view.player.heat / Math.max(1, view.player.heatMax) : 0);
    drawZones(ctx, view.zones, view.time);
    if (view.boss && view.attack) drawAttackWarning(ctx, view.boss, view.attack, view.time);
    if (view.boss) drawBoss(ctx, view.boss, view.time, 1, 1.24);
    if (view.aimLock && view.boss) drawAimLock(ctx, view.boss, view.time);
    if (view.player) {
      drawPlayer(ctx, view.player, view.loadout, view.time, 1.48, 1, false);
      if (view.player.barrierT > 0) drawBarrier(ctx, view.player, view.time);
      drawAim(ctx, view.player, view.aim, view.time);
    }
    drawBossBeams(ctx, view.boss, view.attack, view.time);
    drawBullets(ctx, view.bullets, view.bossBullets, view.time);
    drawSlashes(ctx, view.slashes, view.time);
    drawParticles(ctx, view.particles);
    drawFloats(ctx, view.floats);
    if (view.boss && view.boss.hp <= 0) drawBossCollapse(ctx, view.boss, view.time);
    // screen edge damage / heat vignette
    if (view.hurtFlash > 0) {
      const v = ctx.createRadialGradient(VW / 2, VH / 2, 220, VW / 2, VH / 2, 720);
      v.addColorStop(0, 'rgba(0,0,0,0)');
      v.addColorStop(1, `rgba(210,32,16,${Math.min(.62, view.hurtFlash * .55)})`);
      ctx.fillStyle = v; ctx.fillRect(0, 0, VW, VH);
    }
    ctx.restore();
    // letterbox is clipped by the CSS viewport; draw a subtle frame
    ctx.strokeStyle = 'rgba(255,175,90,.12)'; ctx.lineWidth = 2;
    ctx.strokeRect(14, 14, VW - 28, VH - 28);
    ctx.restore();
  }

  // ------------------------------------------------------------ bosses
  // 自动瞄准锁定框：Boss 周围双圈旋转托架（玉青色，与屏障同色系）
  function drawAimLock(g, b, time) {
    if (!b) return;
    const r1 = (b.r || 56) + 12;
    g.save();
    g.translate(b.x, b.y);
    g.save();
    g.rotate(time * .9);
    g.strokeStyle = 'rgba(143,230,212,.7)';
    g.lineWidth = 1.8;
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2;
      g.beginPath();
      g.arc(0, 0, r1, a + .2, a + Math.PI / 2 - .2);
      g.stroke();
    }
    g.restore();
    g.save();
    g.rotate(-time * 1.55);
    g.strokeStyle = 'rgba(143,230,212,.22)';
    g.lineWidth = 1;
    g.setLineDash([7, 9]);
    g.beginPath(); g.arc(0, 0, r1 + 8, 0, TAU); g.stroke();
    g.restore();
    // 顶部小锁标
    const ty = -r1 - 14 + Math.sin(time * 3.1) * 2;
    g.fillStyle = 'rgba(143,230,212,.85)';
    g.font = '700 9px "Microsoft YaHei",sans-serif';
    g.textAlign = 'center';
    g.fillText('锁定', 0, ty);
    g.beginPath();
    g.moveTo(-3.4, ty + 3.5); g.lineTo(3.4, ty + 3.5); g.lineTo(0, ty + 8.2); g.closePath();
    g.fill();
    g.restore();
  }

  function drawBoss(g, b, time, alpha = 1, scaleMul = 1) {
    if (!b || !b.def) return;
    const s = scaleMul * (b.r / 56);
    const d = b.def;
    g.save();
    g.globalAlpha = alpha;
    g.translate(b.x, b.y);
    // shadow / core glow
    g.fillStyle = 'rgba(0,0,0,.55)';
    g.beginPath(); g.ellipse(0, 38 * s, 74 * s, 19 * s, 0, 0, TAU); g.fill();
    glowDot(g, 0, 2, 140 * s, 'rgba(255,122,42,.18)', .5);
    if (d.id === 'warden') drawWarden(g, b, time, s);
    else if (d.id === 'arbiter') drawArbiter(g, b, time, s);
    else drawColossus(g, b, time, s);
    if (b.flash > 0) {
      g.globalCompositeOperation = 'lighter';
      glowDot(g, 0, -8 * s, 105 * s, 'rgba(255,240,190,.75)', Math.min(.5, b.flash * 1.5));
      g.globalCompositeOperation = 'source-over';
    }
    g.restore();
  }

  function drawWarden(g, b, time, s) {
    const d = b.def;
    const bob = Math.sin(time * 2.1) * 2;
    g.save(); g.scale(s, s); g.translate(0, bob);
    // legs / hydraulic feet
    for (const side of [-1, 1]) {
      g.save(); g.translate(side * 35, 29);
      poly(g, [[-15, -12], [10, -12], [17, 13], [-8, 22]]);
      const lg = g.createLinearGradient(0, -18, 0, 26);
      lg.addColorStop(0, '#60564a'); lg.addColorStop(.55, '#2c2722'); lg.addColorStop(1, '#14110f');
      g.fillStyle = lg; g.fill();
      g.strokeStyle = 'rgba(255,180,90,.2)'; g.lineWidth = 1.2; g.stroke();
      g.fillStyle = 'rgba(255,112,36,.45)';
      g.beginPath(); g.arc(0, 8, 4, 0, TAU); g.fill();
      g.restore();
    }
    // torso
    poly(g, [[-45, -34], [45, -34], [58, 8], [34, 40], [-34, 40], [-58, 8]]);
    let tg = g.createLinearGradient(-55, -40, 45, 42);
    tg.addColorStop(0, '#49413a'); tg.addColorStop(.38, '#292521'); tg.addColorStop(1, '#141210');
    g.fillStyle = tg; g.fill();
    g.strokeStyle = 'rgba(255,170,85,.28)'; g.lineWidth = 2; g.stroke();
    // chest plates
    for (const side of [-1, 1]) {
      poly(g, [[side * 8, -28], [side * 38, -20], [side * 30, 3], [side * 10, -2]]);
      g.fillStyle = side < 0 ? '#332d27' : '#3a322b'; g.fill();
      g.strokeStyle = 'rgba(160,140,110,.22)'; g.lineWidth = 1; g.stroke();
    }
    // furnace chest
    glowDot(g, 0, 9, 31, 'rgba(255,107,32,.55)', .8);
    g.fillStyle = '#ff8b38';
    g.beginPath(); g.arc(0, 9, 13, 0, TAU); g.fill();
    g.fillStyle = '#ffe0a0';
    g.beginPath(); g.arc(0, 9, 6 + Math.sin(time * 8) * 1.5, 0, TAU); g.fill();
    // head
    g.save(); g.translate(0, -50 + bob * .5);
    poly(g, [[-22, 12], [-26, -7], [-12, -22], [12, -22], [26, -7], [22, 12]]);
    g.fillStyle = '#302923'; g.fill();
    g.strokeStyle = 'rgba(255,190,110,.3)'; g.stroke();
    // horns
    poly(g, [[-20, -12], [-36, -27], [-26, -5]]); g.fillStyle = d.accent; g.globalAlpha = .7; g.fill(); g.globalAlpha = 1;
    poly(g, [[20, -12], [36, -27], [26, -5]]); g.fillStyle = d.accent; g.globalAlpha = .7; g.fill(); g.globalAlpha = 1;
    // eyes
    g.fillStyle = '#ffb04c'; g.globalAlpha = .95;
    g.fillRect(-14, -5, 8, 3); g.fillRect(6, -5, 8, 3); g.globalAlpha = 1;
    g.restore();
    // fists
    for (const side of [-1, 1]) {
      const f = Math.sin(time * 1.9 + (side > 0 ? 1 : 0)) * 3;
      g.save(); g.translate(side * 63, 12 + f);
      poly(g, [[-17, -13], [9, -19], [20, 0], [10, 20], [-15, 15], [-24, 0]]);
      let fg = g.createLinearGradient(-24, -20, 20, 20);
      fg.addColorStop(0, '#756552'); fg.addColorStop(.5, '#393129'); fg.addColorStop(1, '#171412');
      g.fillStyle = fg; g.fill();
      g.strokeStyle = 'rgba(255,177,92,.25)'; g.stroke();
      g.strokeStyle = 'rgba(255,130,50,.45)'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(-13, 3); g.lineTo(13, 3); g.stroke();
      g.restore();
    }
    // chains and pipe details
    g.strokeStyle = 'rgba(210,180,130,.25)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(-44, -30); g.bezierCurveTo(-52, -52, -40, -62, -50, -78); g.stroke();
    g.beginPath(); g.moveTo(44, -30); g.bezierCurveTo(52, -52, 40, -62, 50, -78); g.stroke();
    g.restore();
  }

  function drawArbiter(g, b, time, s) {
    const d = b.def;
    const bob = Math.sin(time * 1.7) * 4;
    g.save(); g.scale(s, s); g.translate(0, bob - 8);
    // levitation thruster plumes
    for (const off of [-20, 20]) {
      g.globalCompositeOperation = 'lighter';
      const pl = g.createLinearGradient(off, 28, off, 88);
      pl.addColorStop(0, 'rgba(255,150,60,.34)'); pl.addColorStop(1, 'rgba(255,80,20,0)');
      g.fillStyle = pl;
      poly(g, [[off - 8, 30], [off + 8, 30], [off + 18, 88 + Math.sin(time * 7) * 5], [off - 18, 88]]);
      g.fill();
      g.globalCompositeOperation = 'source-over';
    }
    // rotating halo rings
    for (let k = 0; k < 2; k++) {
      g.save();
      g.rotate(time * (k ? -.55 : .35) + k);
      g.strokeStyle = k ? 'rgba(255,212,132,.62)' : 'rgba(255,105,44,.6)';
      g.lineWidth = k ? 2.4 : 5;
      g.shadowColor = k ? 'rgba(255,218,140,.5)' : 'rgba(255,80,25,.55)';
      g.shadowBlur = 12;
      g.beginPath(); g.ellipse(0, -12, 94 - k * 12, 22 - k * 2, 0, 0, TAU); g.stroke();
      g.shadowBlur = 0;
      for (let i = 0; i < 4; i++) {
        const a = i / 4 * TAU;
        glowDot(g, Math.cos(a) * (88 - k * 12), -12 + Math.sin(a) * (20 - k * 2), 9, 'rgba(255,220,142,.55)', .9);
      }
      g.restore();
    }
    // floating sentry orbs
    for (const side of [-1, 1]) {
      const ox = side * 86, oy = -38 + Math.sin(time * 2 + side) * 6;
      g.save();
      g.translate(ox, oy);
      glowDot(g, 0, 0, 18, 'rgba(255,124,44,.5)', .8);
      poly(g, [[-7, -9], [7, -9], [11, 0], [7, 9], [-7, 9], [-11, 0]]);
      g.fillStyle = '#3d332a'; g.fill();
      g.strokeStyle = 'rgba(255,210,126,.5)'; g.lineWidth = 1.2; g.stroke();
      g.fillStyle = '#ffd682'; g.beginPath(); g.arc(0, 0, 2.6, 0, TAU); g.fill();
      g.restore();
    }
    // lower robe
    poly(g, [[-48, -6], [48, -6], [33, 54], [0, 74], [-33, 54]]);
    let rg = g.createLinearGradient(0, -6, 0, 72);
    rg.addColorStop(0, '#665647'); rg.addColorStop(.48, '#302821'); rg.addColorStop(1, '#100e0c');
    g.fillStyle = rg; g.fill();
    g.strokeStyle = 'rgba(255,198,112,.42)'; g.lineWidth = 1.6; g.stroke();
    for (const sx of [-18, 0, 18]) {
      g.strokeStyle = 'rgba(255,132,48,.35)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(sx, 8); g.lineTo(sx * 1.45, 52); g.stroke();
    }
    // torso
    poly(g, [[-34, -38], [34, -38], [42, 12], [21, 30], [-21, 30], [-42, 12]]);
    let tg = g.createLinearGradient(-40, -42, 40, 30);
    tg.addColorStop(0, '#786450'); tg.addColorStop(.34, '#3a3029'); tg.addColorStop(1, '#171412');
    g.fillStyle = tg; g.fill();
    g.strokeStyle = 'rgba(255,203,125,.52)'; g.lineWidth = 2; g.stroke();
    // rib plates
    for (const side of [-1, 1]) {
      poly(g, [[side * 8, -28], [side * 30, -24], [side * 26, 10], [side * 10, 15]]);
      g.fillStyle = side < 0 ? 'rgba(64,48,36,.8)' : 'rgba(86,60,39,.75)';
      g.fill();
      g.strokeStyle = 'rgba(255,181,92,.25)'; g.lineWidth = 1; g.stroke();
    }
    // vertical core
    glowDot(g, 0, 2, 34, 'rgba(255,94,32,.65)', .9);
    g.fillStyle = '#ffd27a';
    roundRect(g, -5, -22, 10, 39, 5); g.fill();
    g.fillStyle = '#fff6d2';
    roundRect(g, -2, -17, 4, 28, 2); g.fill();
    // shoulder cannons, clearly outside the torso
    for (const side of [-1, 1]) {
      g.save();
      g.translate(side * 59, -27);
      g.rotate(side * -.17);
      poly(g, [[-16, -18], [18, -13], [24, 10], [-14, 16]]);
      let cg = g.createLinearGradient(-16, -18, 24, 16);
      cg.addColorStop(0, '#655545'); cg.addColorStop(.5, '#332b24'); cg.addColorStop(1, '#13110f');
      g.fillStyle = cg; g.fill();
      g.strokeStyle = 'rgba(255,196,108,.5)'; g.lineWidth = 1.4; g.stroke();
      g.fillStyle = '#131110';
      roundRect(g, side > 0 ? 6 : -24, 1, 18, 9, 3); g.fill();
      g.fillStyle = 'rgba(255,192,96,.85)';
      g.beginPath(); g.arc(side * 15, 5, 3, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(255,145,54,.55)'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(side * -8, -8); g.lineTo(side * 14, 8); g.stroke();
      glowDot(g, side * 15, 5, 12, 'rgba(255,102,32,.45)', .6);
      g.restore();
    }
    // head lens
    glowDot(g, 0, -49, 22, 'rgba(255,138,46,.55)', .8);
    g.fillStyle = '#ffe5a6';
    g.beginPath(); g.moveTo(0, -62); g.lineTo(12, -49); g.lineTo(0, -37); g.lineTo(-12, -49); g.closePath(); g.fill();
    g.fillStyle = '#ff7138';
    g.beginPath(); g.arc(0, -49, 4, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(255,218,140,.65)'; g.lineWidth = 1.4;
    g.beginPath(); g.arc(0, -49, 20, -2.6, -0.54); g.stroke();
    // hanging seals
    for (const side of [-1, 1]) {
      g.strokeStyle = 'rgba(255,208,130,.38)'; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(side * 27, 22); g.lineTo(side * 35, 52 + Math.sin(time * 2 + side) * 4); g.stroke();
      g.fillStyle = 'rgba(255,173,75,.55)';
      g.beginPath(); g.arc(side * 35, 55 + Math.sin(time * 2 + side) * 4, 3, 0, TAU); g.fill();
    }
    g.restore();
  }

  function drawColossus(g, b, time, s) {
    const d = b.def;
    const bob = Math.sin(time * 1.4) * 2;
    g.save(); g.scale(s, s); g.translate(0, bob);
    // four legs
    for (const side of [-1, 1]) {
      for (const off of [-16, 16]) {
        g.save(); g.translate(side * 52 + off * .2, 25 + Math.abs(off) * .25);
        poly(g, [[-12, -18], [12, -18], [17, 35], [-10, 40]]);
        let lg = g.createLinearGradient(0, -20, 0, 42);
        lg.addColorStop(0, '#5d5144'); lg.addColorStop(.6, '#29231e'); lg.addColorStop(1, '#100e0d');
        g.fillStyle = lg; g.fill(); g.strokeStyle = 'rgba(255,180,90,.18)'; g.stroke();
        g.fillStyle = 'rgba(255,110,36,.38)';
        g.beginPath(); g.arc(0, 14, 3, 0, TAU); g.fill();
        g.restore();
      }
    }
    // massive torso
    poly(g, [[-57, -42], [57, -42], [72, 5], [45, 43], [-45, 43], [-72, 5]]);
    let tg = g.createLinearGradient(-64, -46, 58, 46);
    tg.addColorStop(0, '#5b4c3d'); tg.addColorStop(.35, '#2e2721'); tg.addColorStop(1, '#15120f');
    g.fillStyle = tg; g.fill();
    g.strokeStyle = 'rgba(255,176,86,.33)'; g.lineWidth = 2.4; g.stroke();
    // gear shoulders
    for (const side of [-1, 1]) {
      g.save(); g.translate(side * 70, -24); g.rotate(time * .22 * side);
      g.fillStyle = '#312a23';
      g.beginPath(); g.arc(0, 0, 25, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(255,186,96,.35)'; g.lineWidth = 2; g.stroke();
      for (let i = 0; i < 10; i++) {
        const a = i / 10 * TAU;
        poly(g, [[Math.cos(a) * 23, Math.sin(a) * 23], [Math.cos(a + .09) * 33, Math.sin(a + .09) * 33], [Math.cos(a + .19) * 23, Math.sin(a + .19) * 23]]);
        g.fillStyle = '#3a3128'; g.fill();
      }
      glowDot(g, 0, 0, 15, 'rgba(255,143,48,.42)', .8);
      g.restore();
    }
    // furnace maw
    g.fillStyle = '#0a0807';
    roundRect(g, -31, 2, 62, 31, 8); g.fill();
    g.strokeStyle = 'rgba(255,179,85,.5)'; g.lineWidth = 2; g.stroke();
    for (let i = 0; i < 7; i++) {
      g.fillStyle = i % 2 ? '#ff9a44' : '#ffd77c';
      poly(g, [[-26 + i * 8, 6], [-22 + i * 8, 6], [-24 + i * 8, 14]]);
      g.fill();
      poly(g, [[-26 + i * 8, 29], [-22 + i * 8, 29], [-24 + i * 8, 22]]);
      g.fill();
    }
    glowDot(g, 0, 17, 45, 'rgba(255,94,26,.55)', .55);
    // crown horns
    g.save(); g.translate(0, -58);
    poly(g, [[-44, 8], [-58, -25], [-32, -6], [-21, -31], [0, -9], [21, -31], [32, -6], [58, -25], [44, 8], [24, 16], [-24, 16]]);
    let cg = g.createLinearGradient(0, -34, 0, 16);
    cg.addColorStop(0, '#7b664f'); cg.addColorStop(1, '#241e19');
    g.fillStyle = cg; g.fill(); g.strokeStyle = 'rgba(255,205,120,.33)'; g.lineWidth = 1.5; g.stroke();
    glowDot(g, 0, -3, 25, 'rgba(255,203,112,.32)', .6);
    // central eye
    g.fillStyle = '#ffcf73'; g.beginPath(); g.arc(0, -3, 5, 0, TAU); g.fill();
    g.restore();
    // pipe arms
    for (const side of [-1, 1]) {
      g.strokeStyle = 'rgba(150,126,92,.38)'; g.lineWidth = 8;
      g.beginPath(); g.moveTo(side * 60, 20); g.bezierCurveTo(side * 88, 28, side * 89, 52, side * 75, 66); g.stroke();
      g.strokeStyle = 'rgba(255,156,66,.28)'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(side * 60, 17); g.bezierCurveTo(side * 85, 27, side * 86, 49, side * 73, 62); g.stroke();
    }
    g.restore();
  }

  function drawBossCollapse(g, b, time) {
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 5; i++) {
      const a = time * (1.2 + i * .2) + i;
      glowDot(g, b.x + Math.cos(a) * (30 + i * 15), b.y + Math.sin(a) * (20 + i * 9), 20 + i * 8, 'rgba(255,158,60,.8)', .2);
    }
    g.restore();
  }

  // ------------------------------------------------------------ player
  function drawPlayer(g, p, loadout, time, scaleMul = 1, alpha = 1, preview = false) {
    if (!p) return;
    const st = p.stats || null;
    const wk = p.weaponKey || (loadout && loadout.weapon) || 'autocannon';
    const ak = p.armorKey || (loadout && loadout.armor) || 'composite';
    const tk = p.thrusterKey || (loadout && loadout.thruster) || 'standard';
    const w = WEAPONS.find(x => x.key === wk) || WEAPONS[1];
    const a = ARMORS.find(x => x.key === ak) || ARMORS[2];
    const t = THRUSTERS.find(x => x.key === tk) || THRUSTERS[0];
    const s = scaleMul;
    const aim = p.aim || -Math.PI / 2;
    const speedT = clamp((p.targetSpeed || 0) / 220, 0, 1);
    const step = Math.sin(time * 12) * speedT;
    g.save();
    g.globalAlpha = alpha;
    g.translate(p.x, p.y);
    g.scale(s, s);
    // shadow
    g.fillStyle = `rgba(0,0,0,${p.hoverActive ? .25 : .45})`;
    g.beginPath(); g.ellipse(0, 27, 29, 10, 0, 0, TAU); g.fill();
    if (p.hoverActive) {
      g.globalCompositeOperation = 'lighter';
      for (const side of [-1, 1]) {
        let hg = g.createRadialGradient(side * 17, 24, 2, side * 17, 24, 20);
        hg.addColorStop(0, 'rgba(126,220,210,.25)'); hg.addColorStop(1, 'rgba(30,120,120,0)');
        g.fillStyle = hg;
        g.beginPath(); g.arc(side * 17, 24, 20, 0, TAU); g.fill();
      }
      g.globalCompositeOperation = 'source-over';
    }
    if (p.dashT > 0) {
      g.globalAlpha = alpha * .26;
      for (let i = 1; i <= 3; i++) {
        g.save(); g.translate(-Math.cos(aim) * i * 14, -Math.sin(aim) * i * 14);
        g.fillStyle = t.accent; g.beginPath(); g.ellipse(0, 0, 19, 26, 0, 0, TAU); g.fill();
        g.restore();
      }
      g.globalAlpha = alpha;
    }
    // legs
    for (const side of [-1, 1]) {
      g.save(); g.translate(side * 11, 13 + (side > 0 ? step : -step) * 2);
      poly(g, [[-8, -8], [8, -8], [10, 17], [-7, 19]]);
      let lg = g.createLinearGradient(0, -10, 0, 20);
      lg.addColorStop(0, a.accent); lg.addColorStop(.35, '#4a433a'); lg.addColorStop(1, '#181513');
      g.fillStyle = lg; g.fill();
      g.strokeStyle = 'rgba(255,190,100,.2)'; g.lineWidth = 1; g.stroke();
      g.fillStyle = 'rgba(255,126,42,.42)';
      g.beginPath(); g.arc(0, 7, 2.2, 0, TAU); g.fill();
      g.restore();
    }
    // thruster pack
    g.save(); g.translate(0, 3);
    poly(g, [[-15, -10], [15, -10], [18, 14], [-18, 14]]);
    g.fillStyle = '#25211c'; g.fill();
    g.strokeStyle = 'rgba(255,180,95,.24)'; g.stroke();
    for (const side of [-1, 1]) {
      g.fillStyle = t.accent;
      g.globalAlpha = .7;
      g.beginPath(); g.arc(side * 11, 8, 3.4, 0, TAU); g.fill();
      g.globalAlpha = 1;
      if (speedT > .1 || p.dashT > 0) {
        g.globalCompositeOperation = 'lighter';
        const jl = 14 + speedT * 26 + (p.dashT > 0 ? 30 : 0) + Math.sin(time * 22 + side) * 4;
        let jg = g.createLinearGradient(side * 11, 12, side * 11, 12 + jl);
        jg.addColorStop(0, 'rgba(255,202,110,.8)'); jg.addColorStop(.6, 'rgba(255,98,30,.45)'); jg.addColorStop(1, 'rgba(255,60,10,0)');
        g.fillStyle = jg;
        poly(g, [[side * 11 - 4, 11], [side * 11 + 4, 11], [side * 11 + 1, 12 + jl], [side * 11 - 1, 12 + jl]]);
        g.fill();
        g.globalCompositeOperation = 'source-over';
      }
    }
    g.restore();
    // torso
    poly(g, [[-23, -20], [23, -20], [31, -2], [19, 20], [-19, 20], [-31, -2]]);
    let tg = g.createLinearGradient(-26, -22, 25, 22);
    tg.addColorStop(0, a.accent); tg.addColorStop(.34, '#4e463d'); tg.addColorStop(.72, '#2b2621'); tg.addColorStop(1, '#171412');
    g.fillStyle = tg; g.fill();
    g.strokeStyle = 'rgba(255,194,112,.32)'; g.lineWidth = 1.2; g.stroke();
    // chest vents / armor type details
    if (ak === 'heavy') {
      g.fillStyle = 'rgba(255,176,80,.28)'; roundRect(g, -18, -14, 36, 7, 2); g.fill();
      g.strokeStyle = 'rgba(255,204,124,.35)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(-22, 7); g.lineTo(22, 7); g.stroke();
    } else if (ak === 'cryo') {
      g.strokeStyle = 'rgba(126,210,220,.4)'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(-15, -12); g.lineTo(0, 2); g.lineTo(15, -12); g.stroke();
    } else if (ak === 'reactive') {
      for (let i = -1; i <= 1; i++) { g.fillStyle = 'rgba(255,133,60,.3)'; roundRect(g, i * 11 - 4, -13, 7, 9, 2); g.fill(); }
    } else {
      for (let i = -1; i <= 1; i++) {
        g.fillStyle = 'rgba(15,13,11,.55)';
        roundRect(g, i * 10 - 3, -13, 5, 8, 2); g.fill();
      }
    }
    // pilot core
    glowDot(g, 0, 0, 15, 'rgba(255,123,40,.55)', .75);
    g.fillStyle = '#ffdf9a'; g.beginPath(); g.arc(0, 0, 3.4, 0, TAU); g.fill();
    // shoulders
    for (const side of [-1, 1]) {
      g.save(); g.translate(side * 26, -13);
      poly(g, [[-8, -8], [10, -6], [12, 8], [-7, 9]]);
      g.fillStyle = '#3c352d'; g.fill();
      g.strokeStyle = 'rgba(255,190,105,.24)'; g.lineWidth = 1; g.stroke();
      g.restore();
    }
    // head
    g.save(); g.translate(0, -28);
    poly(g, [[-10, 7], [-9, -6], [-4, -11], [5, -11], [10, -5], [9, 7]]);
    g.fillStyle = '#2c2721'; g.fill();
    g.strokeStyle = 'rgba(255,193,108,.35)'; g.stroke();
    g.fillStyle = '#ffbe5d'; g.fillRect(-6, -3, 12, 3.2);
    g.fillStyle = '#ffe9b0'; g.fillRect(-2, -3, 4, 3.2);
    g.strokeStyle = 'rgba(255,198,118,.55)'; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(5, -10); g.lineTo(8, -19); g.stroke();
    glowDot(g, 8, -19, 5, 'rgba(255,120,32,.5)', .6);
    g.restore();
    // weapon arm — orientation is the aim vector
    const dx = Math.cos(aim), dy = Math.sin(aim);
    const bx = 10 + dx * 10, by = -7 + dy * 10;
    const ex = bx + dx * 44, ey = by + dy * 44;
    g.save();
    g.translate(bx, by); g.rotate(aim);
    // upper arm
    g.strokeStyle = '#3c352d'; g.lineWidth = 12; g.lineCap = 'round';
    g.beginPath(); g.moveTo(0, 0); g.lineTo(26, 0); g.stroke();
    g.strokeStyle = 'rgba(255,197,112,.26)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(4, -4); g.lineTo(23, -4); g.stroke();
    if (wk === 'cleaver') {
      // huge cleaver blade
      poly(g, [[24, -4], [71, -14], [81, 0], [71, 14], [24, 5]]);
      let bg2 = g.createLinearGradient(24, -14, 80, 14);
      bg2.addColorStop(0, '#8a7660'); bg2.addColorStop(.45, '#4c443a'); bg2.addColorStop(1, '#c4a574');
      g.fillStyle = bg2; g.fill();
      g.strokeStyle = 'rgba(255,204,120,.7)'; g.lineWidth = 1.5; g.stroke();
      g.strokeStyle = 'rgba(255,117,38,.85)'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(69, -13); g.lineTo(78, 0); g.lineTo(67, 13); g.stroke();
      glowDot(g, 76, 0, 16, 'rgba(255,112,32,.35)', .7);
    } else if (wk === 'autocannon') {
      g.fillStyle = '#282420'; roundRect(g, 19, -8, 42, 6, 2); g.fill();
      roundRect(g, 19, 2, 42, 6, 2); g.fill();
      g.strokeStyle = 'rgba(255,198,112,.4)'; g.lineWidth = 1;
      g.strokeRect(23, -7, 30, 4); g.strokeRect(23, 3, 30, 4);
      g.fillStyle = '#ffd27a'; g.beginPath(); g.arc(61, -5, 2, 0, TAU); g.arc(61, 5, 2, 0, TAU); g.fill();
    } else if (wk === 'missile') {
      poly(g, [[20, -13], [58, -13], [64, 0], [58, 13], [20, 13]]);
      g.fillStyle = '#393128'; g.fill(); g.strokeStyle = 'rgba(255,172,80,.35)'; g.stroke();
      for (let i = 0; i < 4; i++) {
        const yy = -9 + i * 6;
        g.fillStyle = '#100f0d'; roundRect(g, 25, yy - 2, 28, 3.4, 1.5); g.fill();
        g.fillStyle = 'rgba(255,153,60,.6)'; g.beginPath(); g.arc(30, yy, 1.3, 0, TAU); g.fill();
      }
    } else if (wk === 'beam') {
      poly(g, [[19, -10], [50, -7], [63, -2], [63, 2], [50, 7], [19, 10]]);
      g.fillStyle = '#302b25'; g.fill(); g.strokeStyle = 'rgba(255,205,126,.38)'; g.stroke();
      glowDot(g, 63, 0, 13, 'rgba(255,224,140,.45)', .7);
      g.fillStyle = '#fff0bc'; g.beginPath(); g.arc(62, 0, 2.5, 0, TAU); g.fill();
    } else if (wk === 'shotgun') {
      poly(g, [[19, -9], [55, -12], [64, -4], [64, 4], [55, 12], [19, 9]]);
      g.fillStyle = '#3b332a'; g.fill(); g.strokeStyle = 'rgba(255,165,76,.4)'; g.stroke();
      for (let i = -1; i <= 1; i++) { g.fillStyle = '#17130f'; g.beginPath(); g.arc(59, i * 4, 2.2, 0, TAU); g.fill(); }
    } else {
      // aegis shield cannon
      g.fillStyle = '#56352a';
      poly(g, [[8, -20], [42, -24], [53, -13], [53, 13], [42, 24], [8, 20]]);
      g.fill(); g.strokeStyle = 'rgba(143,230,212,.5)'; g.lineWidth = 1.5; g.stroke();
      g.fillStyle = '#10110f';
      roundRect(g, 49, -7, 17, 14, 3); g.fill();
      glowDot(g, 59, 0, 12, 'rgba(143,230,212,.4)', .6);
    }
    g.restore();
    g.restore();
  }

  function drawBarrier(g, p, time) {
    g.save();
    g.translate(p.x, p.y);
    g.rotate(time * .55);
    g.globalCompositeOperation = 'lighter';
    const a = .3 + Math.sin(time * 8) * .08;
    g.strokeStyle = `rgba(143,230,212,${a + .18})`; g.lineWidth = 2.5;
    g.beginPath();
    for (let i = 0; i <= 6; i++) {
      const ang = i / 6 * TAU, r = 44 + Math.sin(time * 5 + i) * 2;
      const x = Math.cos(ang) * r, y = Math.sin(ang) * r;
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.stroke();
    glowDot(g, 0, 0, 58, 'rgba(96,210,200,.28)', .6);
    g.restore();
  }

  function drawAim(g, p, aim, time) {
    if (!aim) return;
    const dx = Math.cos(p.aim || -Math.PI / 2), dy = Math.sin(p.aim || -Math.PI / 2);
    const dist = 150 + Math.sin(time * 4) * 4;
    const x = p.x + dx * dist, y = p.y + dy * dist;
    g.save();
    g.globalAlpha = .55;
    g.strokeStyle = '#ffd27a'; g.lineWidth = 1.2;
    g.beginPath(); g.arc(x, y, 10, 0, TAU); g.stroke();
    g.beginPath(); g.moveTo(x - 16, y); g.lineTo(x - 6, y); g.moveTo(x + 6, y); g.lineTo(x + 16, y); g.stroke();
    g.beginPath(); g.moveTo(x, y - 16); g.lineTo(x, y - 6); g.moveTo(x, y + 6); g.lineTo(x, y + 16); g.stroke();
    g.fillStyle = 'rgba(255,180,82,.6)';
    g.beginPath(); g.arc(x, y, 1.7, 0, TAU); g.fill();
    g.restore();
  }

  // ------------------------------------------------------------ attack effects
  function drawAttackWarning(g, b, atk, time) {
    if (!atk) return;
    const warn = clamp(atk.t / Math.max(.01, atk.windup), 0, 1);
    const pulse = .35 + Math.sin(time * 12) * .12 + warn * .25;
    g.save();
    g.globalAlpha = .8;
    if (atk.kind === 'charge') {
      const a = atk.data.angle;
      g.translate(b.x, b.y);
      g.rotate(a);
      g.fillStyle = `rgba(255,84,32,${.06 + pulse * .10})`;
      poly(g, [[0, -38], [760, -54], [760, 54], [0, 38]]); g.fill();
      g.strokeStyle = `rgba(255,140,58,${pulse})`; g.lineWidth = 2;
      g.setLineDash([16, 12]); g.lineDashOffset = -time * 70;
      g.beginPath(); g.moveTo(0, -38); g.lineTo(760, -54); g.moveTo(0, 38); g.lineTo(760, 54); g.stroke();
      g.setLineDash([]);
      for (let i = 1; i < 6; i++) {
        const x = i * 110;
        g.strokeStyle = `rgba(255,190,95,${pulse * .9})`; g.lineWidth = 3;
        g.beginPath(); g.moveTo(x - 10, -12); g.lineTo(x + 2, 0); g.lineTo(x - 10, 12); g.stroke();
      }
    } else if (atk.kind === 'radial' || atk.kind === 'nova') {
      const r = 60 + warn * 110;
      g.strokeStyle = `rgba(255,112,40,${pulse})`; g.lineWidth = 3;
      g.setLineDash([12, 10]); g.lineDashOffset = time * 50;
      g.beginPath(); g.arc(b.x, b.y, r, 0, TAU); g.stroke();
      g.setLineDash([]);
      g.strokeStyle = `rgba(255,211,125,${pulse * .55})`; g.lineWidth = 1;
      for (let i = 0; i < (atk.kind === 'nova' ? 16 : 10); i++) {
        const a = i / (atk.kind === 'nova' ? 16 : 10) * TAU + time * .4;
        g.beginPath(); g.moveTo(b.x + Math.cos(a) * (r + 6), b.y + Math.sin(a) * (r + 6)); g.lineTo(b.x + Math.cos(a) * (r + 20), b.y + Math.sin(a) * (r + 20)); g.stroke();
      }
    } else if (atk.kind === 'sweep') {
      const a0 = atk.data.angle;
      const sweep = atk.kind === 'sweep' ? (b.def.id === 'arbiter' ? 1.45 : 1.1) : 1.1;
      g.translate(b.x, b.y);
      g.fillStyle = `rgba(255,82,28,${.05 + pulse * .08})`;
      g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, 820, a0 - .1, a0 + sweep + .1); g.closePath(); g.fill();
      g.strokeStyle = `rgba(255,140,58,${pulse})`; g.lineWidth = 2;
      g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a0) * 820, Math.sin(a0) * 820); g.stroke();
      g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a0 + sweep) * 820, Math.sin(a0 + sweep) * 820); g.stroke();
    } else if (atk.kind === 'cross') {
      g.translate(b.x, b.y);
      g.strokeStyle = `rgba(255,110,40,${pulse})`; g.lineWidth = 30;
      g.setLineDash([34, 20]); g.lineDashOffset = -time * 80;
      g.beginPath(); g.moveTo(-900, 0); g.lineTo(900, 0); g.moveTo(0, -500); g.lineTo(0, 500); g.stroke();
      g.strokeStyle = `rgba(255,220,145,${pulse * .8})`; g.lineWidth = 2;
      g.beginPath(); g.moveTo(-900, 0); g.lineTo(900, 0); g.moveTo(0, -500); g.lineTo(0, 500); g.stroke();
      g.setLineDash([]);
    } else if (atk.kind === 'slam' || atk.kind === 'missiles' || atk.kind === 'rain') {
      const zs = atk.data.zones || [];
      for (const z of zs) {
        g.strokeStyle = `rgba(255,102,36,${.5 + Math.sin(time * 14 + z.seed) * .18})`; g.lineWidth = 2;
        g.setLineDash([9, 7]); g.lineDashOffset = time * 40;
        g.beginPath(); g.arc(z.x, z.y, z.r, 0, TAU); g.stroke();
        g.setLineDash([]);
        g.fillStyle = 'rgba(255,104,36,.08)';
        g.beginPath(); g.arc(z.x, z.y, z.r, 0, TAU); g.fill();
        g.strokeStyle = 'rgba(255,203,120,.55)'; g.lineWidth = 1;
        g.beginPath(); g.moveTo(z.x - z.r * .5, z.y); g.lineTo(z.x + z.r * .5, z.y); g.stroke();
        g.beginPath(); g.moveTo(z.x, z.y - z.r * .5); g.lineTo(z.x, z.y + z.r * .5); g.stroke();
      }
    }
    g.restore();
  }

  function drawBossBeams(g, b, atk, time) {
    if (!b || !atk || atk.t < atk.windup) return;
    const activeT = atk.t - atk.windup;
    g.save();
    g.globalCompositeOperation = 'lighter';
    if (atk.kind === 'sweep' && activeT >= 0 && activeT < atk.active) {
      const a = atk.data.angle + activeT * (atk.data.rate || 1.25);
      const gr = g.createLinearGradient(b.x, b.y, b.x + Math.cos(a) * 900, b.y + Math.sin(a) * 900);
      gr.addColorStop(0, 'rgba(255,232,150,.9)'); gr.addColorStop(.25, 'rgba(255,119,38,.8)'); gr.addColorStop(1, 'rgba(255,58,16,.1)');
      g.strokeStyle = gr; g.lineWidth = 22; g.shadowColor = '#ff6a24'; g.shadowBlur = 30;
      g.beginPath(); g.moveTo(b.x, b.y); g.lineTo(b.x + Math.cos(a) * 900, b.y + Math.sin(a) * 900); g.stroke();
      g.strokeStyle = 'rgba(255,245,200,.9)'; g.lineWidth = 4; g.shadowBlur = 18;
      g.beginPath(); g.moveTo(b.x, b.y); g.lineTo(b.x + Math.cos(a) * 900, b.y + Math.sin(a) * 900); g.stroke();
    } else if (atk.kind === 'cross' && activeT < atk.active) {
      g.translate(b.x, b.y);
      g.strokeStyle = 'rgba(255,92,30,.8)'; g.lineWidth = 22; g.shadowColor = '#ff702c'; g.shadowBlur = 32;
      g.beginPath(); g.moveTo(-900, 0); g.lineTo(900, 0); g.moveTo(0, -500); g.lineTo(0, 500); g.stroke();
      g.strokeStyle = 'rgba(255,239,184,.9)'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(-900, 0); g.lineTo(900, 0); g.moveTo(0, -500); g.lineTo(0, 500); g.stroke();
    }
    g.restore();
  }

  function drawZones(g, zones, time) {
    if (!zones) return;
    for (const z of zones) {
      if (z.blastT > 0) {
        const f = 1 - z.blastT / z.blastMax;
        g.save(); g.globalCompositeOperation = 'lighter';
        glowDot(g, z.x, z.y, z.r * (1 + f * .8), 'rgba(255,138,48,.8)', .55 * (1 - f));
        g.strokeStyle = `rgba(255,225,160,${.7 * (1 - f)})`; g.lineWidth = 3;
        g.beginPath(); g.arc(z.x, z.y, z.r * (.4 + f * .7), 0, TAU); g.stroke();
        g.restore();
      } else if (z.t > 0) {
        const warn = clamp(1 - z.t / Math.max(.01, z.delay || 1), 0, 1);
        const pulse = .4 + Math.sin(time * 14 + z.seed) * .15 + warn * .2;
        g.save();
        g.fillStyle = `rgba(255,92,28,${.05 + pulse * .06})`;
        g.beginPath(); g.arc(z.x, z.y, z.r, 0, TAU); g.fill();
        g.strokeStyle = `rgba(255,118,45,${pulse})`; g.lineWidth = 2;
        g.setLineDash([9, 7]); g.lineDashOffset = time * 38;
        g.beginPath(); g.arc(z.x, z.y, z.r, 0, TAU); g.stroke();
        g.strokeStyle = `rgba(255,210,132,${pulse * .7})`; g.lineWidth = 1;
        g.beginPath(); g.arc(z.x, z.y, z.r * Math.max(.12, warn), 0, TAU); g.stroke();
        g.setLineDash([]);
        g.restore();
      }
    }
  }

  function drawBullets(g, bullets, bossBullets, time) {
    g.save();
    if (bullets) {
      for (const b of bullets) {
        g.save();
        g.globalCompositeOperation = 'lighter';
        if (b.kind === 'missile') {
          const a = Math.atan2(b.vy, b.vx);
          g.translate(b.x, b.y); g.rotate(a);
          g.strokeStyle = 'rgba(255,120,50,.28)'; g.lineWidth = 6; g.lineCap = 'round';
          g.beginPath(); g.moveTo(-24, 0); g.lineTo(2, 0); g.stroke();
          poly(g, [[-7, -4], [7, 0], [-7, 4], [-11, 0]]);
          g.fillStyle = '#ffd181'; g.fill();
          glowDot(g, 0, 0, 15, 'rgba(255,153,60,.7)', .8);
        } else if (b.kind === 'pulse') {
          g.strokeStyle = 'rgba(143,230,212,.9)'; g.lineWidth = 3;
          g.beginPath(); g.arc(b.x, b.y, 7, 0, TAU); g.stroke();
          glowDot(g, b.x, b.y, 18, 'rgba(143,230,212,.6)', .75);
        } else {
          const col = b.kind === 'pellet' ? 'rgba(255,196,100,.95)' : 'rgba(255,231,160,.95)';
          g.strokeStyle = b.kind === 'pellet' ? 'rgba(255,154,70,.6)' : 'rgba(255,189,90,.65)';
          g.lineWidth = b.kind === 'pellet' ? 2 : 2.5;
          g.beginPath(); g.moveTo(b.px ?? b.x, b.py ?? b.y); g.lineTo(b.x, b.y); g.stroke();
          glowDot(g, b.x, b.y, b.kind === 'pellet' ? 8 : 11, col, .7);
        }
        g.restore();
      }
    }
    if (bossBullets) {
      for (const b of bossBullets) {
        g.save();
        g.globalCompositeOperation = 'lighter';
        const col = b.kind === 'shard' ? 'rgba(255,192,99,.95)' : 'rgba(255,112,44,.95)';
        g.strokeStyle = b.kind === 'shard' ? 'rgba(255,213,133,.45)' : 'rgba(255,92,30,.42)';
        g.lineWidth = 5;
        g.beginPath(); g.moveTo(b.x - b.vx * .035, b.y - b.vy * .035); g.lineTo(b.x, b.y); g.stroke();
        glowDot(g, b.x, b.y, b.r * 1.85, col, .7);
        g.fillStyle = b.kind === 'shard' ? '#fff0c0' : '#ffd08a';
        g.beginPath(); g.arc(b.x, b.y, Math.max(2, b.r * .48), 0, TAU); g.fill();
        g.restore();
      }
    }
    g.restore();
  }

  function drawSlashes(g, slashes, time) {
    if (!slashes) return;
    for (const s of slashes) {
      const f = 1 - s.t / s.max;
      g.save();
      g.translate(s.x, s.y); g.rotate(s.a);
      g.globalCompositeOperation = 'lighter';
      g.strokeStyle = `rgba(255,186,88,${.8 * f})`; g.lineWidth = 10 * f + 2;
      g.shadowColor = '#ff8c30'; g.shadowBlur = 18;
      g.beginPath(); g.arc(0, 0, s.r, -s.arc / 2, s.arc / 2); g.stroke();
      g.strokeStyle = `rgba(255,242,200,${.9 * f})`; g.lineWidth = 2;
      g.beginPath(); g.arc(0, 0, s.r - 8, -s.arc / 2, s.arc / 2); g.stroke();
      g.restore();
    }
  }

  function drawParticles(g, p) {
    if (!p) return;
    g.save();
    for (const q of p) {
      const a = Math.max(0, q.life / q.max);
      if (q.kind === 'smoke') {
        g.globalAlpha = a * .22;
        g.fillStyle = q.color;
        g.beginPath(); g.arc(q.x, q.y, q.size * (1.7 - a * .5), 0, TAU); g.fill();
      } else if (q.kind === 'ember') {
        g.globalAlpha = a * .85;
        g.globalCompositeOperation = 'lighter';
        glowDot(g, q.x, q.y, q.size * 2.4, q.color, a * .65);
      } else {
        g.globalAlpha = a;
        g.globalCompositeOperation = 'lighter';
        g.strokeStyle = q.color; g.lineWidth = Math.max(1, q.size * .5);
        g.beginPath(); g.moveTo(q.x, q.y); g.lineTo(q.x - q.vx * .018, q.y - q.vy * .018); g.stroke();
        glowDot(g, q.x, q.y, q.size * 2, q.color, a * .55);
      }
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    g.restore();
  }

  function drawFloats(g, floats) {
    if (!floats) return;
    g.save();
    g.textAlign = 'center';
    for (const f of floats) {
      const a = Math.max(0, f.life / f.max);
      g.globalAlpha = a;
      g.font = `700 ${f.size || 14}px "Microsoft YaHei", system-ui, sans-serif`;
      g.fillStyle = f.color || '#ffe2a4';
      g.shadowColor = 'rgba(0,0,0,.8)'; g.shadowBlur = 4;
      g.fillText(f.text, f.x, f.y);
    }
    g.restore();
  }

  // ------------------------------------------------------------ forge preview
  function drawPreview(loadout, stats, time) {
    if (!pctx || !preview) return;
    const w = preview.width, h = preview.height;
    const g = pctx;
    g.clearRect(0, 0, w, h);
    let bgGrad = g.createRadialGradient(w * .5, h * .42, 10, w * .5, h * .55, w * .72);
    bgGrad.addColorStop(0, 'rgba(92,55,26,.5)');
    bgGrad.addColorStop(.52, 'rgba(27,22,18,.65)');
    bgGrad.addColorStop(1, 'rgba(0,0,0,.9)');
    g.fillStyle = bgGrad; g.fillRect(0, 0, w, h);
    // pedestal rings
    g.save();
    g.translate(w * .5, h * .79);
    g.scale(1, .3);
    for (let i = 0; i < 4; i++) {
      g.strokeStyle = `rgba(255,164,74,${.3 - i * .06})`; g.lineWidth = 2;
      g.beginPath(); g.arc(0, 0, w * (.13 + i * .07), 0, TAU); g.stroke();
    }
    g.fillStyle = 'rgba(255,113,33,.12)'; g.beginPath(); g.arc(0, 0, w * .3, 0, TAU); g.fill();
    g.restore();
    // sparks
    g.save(); g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 26; i++) {
      const ph = (time * (.1 + hash(i) * .25) + hash(i + 5)) % 1;
      const x = w * .2 + hash(i + 8) * w * .6;
      const y = h * (.72 - ph * .57);
      glowDot(g, x + Math.sin(time + i) * 4, y, 5 + (1 - ph) * 8, 'rgba(255,156,56,.55)', (1 - ph) * .35);
    }
    g.restore();
    const scl = Math.min(w / 420, h / 420) * 1.95;
    drawPlayer(g, {
      x: w * .5, y: h * .55, aim: -Math.PI / 2 + .35,
      targetSpeed: 0, hoverActive: stats.hover, dashT: 0,
      stats,
    }, loadout, time, scl, 1, true);
    // scanline shimmer
    g.save(); g.globalAlpha = .06; g.strokeStyle = '#ffd9a0';
    for (let y = 0; y < h; y += 8) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    g.restore();
    g.strokeStyle = 'rgba(255,177,92,.22)'; g.lineWidth = 2;
    roundRect(g, 1, 1, w - 2, h - 2, 8); g.stroke();
  }

  return { resize, screenToWorld, draw, drawArenaScene, drawTitleScene, drawPreview, VW, VH };
}
