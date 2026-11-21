// Particle and floating-text layer. Capped count, updated by the fixed step.
const MAX_P = 420;

export function makeFX() {
  const parts = [];
  const floats = [];
  const rings = [];

  function push(p) {
    if (parts.length >= MAX_P) parts.shift();
    parts.push(p);
  }

  function burst(x, y, color, n = 14, opt = {}) {
    const speed = opt.speed || 150, life = opt.life || 0.7, grav = opt.grav == null ? 210 : opt.grav;
    for (let i = 0; i < n; i++) {
      const a = (opt.angle == null ? Math.random() * Math.PI * 2 : opt.angle + (Math.random() - 0.5) * (opt.spread || 2.4));
      const v = speed * (0.35 + Math.random() * 0.8);
      push({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - (opt.lift || 0),
        life, max: life, grav, size: (opt.size || 3) * (0.6 + Math.random() * 0.8),
        color, type: opt.type || 'dot', spin: Math.random() * 6, vspin: (Math.random() - 0.5) * 8,
      });
    }
  }

  function ring(x, y, color, r = 60, life = 0.4, w = 3) {
    rings.push({ x, y, color, r0: 8, r1: r, life, max: life, w });
  }

  function float(x, y, text, color = '#f4d293', opt = {}) {
    floats.push({ x, y, text, color, life: opt.life || 0.95, max: opt.life || 0.95, vy: opt.vy == null ? -42 : opt.vy, size: opt.size || 22 });
  }

  function update(dt) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life -= dt;
      if (p.life <= 0) { parts.splice(i, 1); continue; }
      p.vy += p.grav * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.spin += p.vspin * dt;
      p.vx *= (1 - 1.1 * dt);
    }
    for (let i = floats.length - 1; i >= 0; i--) {
      const f = floats[i];
      f.life -= dt;
      if (f.life <= 0) { floats.splice(i, 1); continue; }
      f.y += f.vy * dt; f.vy *= (1 - 1.5 * dt);
    }
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i];
      r.life -= dt;
      if (r.life <= 0) rings.splice(i, 1);
    }
  }

  function draw(ctx) {
    ctx.save();
    for (const p of parts) {
      const a = Math.max(0, p.life / p.max);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      if (p.type === 'streak') {
        ctx.strokeStyle = p.color; ctx.lineWidth = p.size * 0.8; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03); ctx.stroke();
      } else if (p.type === 'rune') {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.spin);
        ctx.strokeStyle = p.color; ctx.lineWidth = 1.4; ctx.globalAlpha = a * 0.8;
        ctx.beginPath(); ctx.arc(0, 0, p.size * 2.2, 0, Math.PI * 1.4); ctx.stroke();
        ctx.restore();
      } else if (p.type === 'leaf') {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.spin);
        ctx.beginPath(); ctx.ellipse(0, 0, p.size * 1.8, p.size * 0.7, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      } else {
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.4 + a * 0.6), 0, Math.PI * 2); ctx.fill();
      }
    }
    for (const r of rings) {
      const a = Math.max(0, r.life / r.max);
      const rad = r.r1 + (r.r0 - r.r1) * a;
      ctx.globalAlpha = a * 0.8; ctx.strokeStyle = r.color; ctx.lineWidth = r.w * (0.4 + a * 0.8);
      ctx.beginPath(); ctx.arc(r.x, r.y, rad, 0, Math.PI * 2); ctx.stroke();
    }
    for (const f of floats) {
      const a = Math.min(1, f.life / f.max * 1.8);
      ctx.globalAlpha = a; ctx.fillStyle = f.color;
      ctx.font = `700 ${f.size}px "Noto Serif CJK SC","Songti SC",serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(5,3,14,.9)'; ctx.shadowBlur = 6;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.restore();
  }

  function clear() { parts.length = 0; floats.length = 0; rings.length = 0; }

  return { burst, ring, float, update, draw, clear, get count() { return parts.length; }, particles: parts, floats };
}
