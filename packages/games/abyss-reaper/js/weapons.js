// Weapon system for Abyss Reaper 暗渊割草者.
// 6 weapons × 8 levels + evolution forms. Auto-targeting, no manual fire.
// Owns: projectiles (axe/cross/ghostfire), poison zones, chain-bolt FX,
// orbiting scythe blades. All damage flows through ctx.damageEnemy /
// ctx.damageBoss (game.js), so tests can trace "fire → damage lands".

export const EVO_NEED = 3;   // passive level required for evolution

export const WEAPON_DEFS = {
  scythe: {
    id: 'scythe', name: '镰刃环绕', glyph: '镰', passive: 'armor',
    desc: '两柄魂镰绕身旋转，绞割近身之敌',
    upDesc: '伤害 +3 · 范围 +5 · 每 2 级 +1 镰',
    evo: { name: '血月大镰', desc: '血月悬空，七镰环舞，命中汲取生命' },
    maxLv: 8, base: { cd: 0 },
    stats(lv) {
      const k = lv - 1;
      return { blades: 2 + Math.min(3, Math.floor(k / 2)), dmg: 8 + 3 * k, radius: 64 + 5 * k, rot: 2.4 + 0.08 * k, hitCd: 0.45, leech: 0 };
    },
    evoStats() { return { blades: 7, dmg: 40, radius: 118, rot: 3.0, hitCd: 0.3, leech: 1 }; },
  },
  axe: {
    id: 'axe', name: '飞斧投掷', glyph: '斧', passive: 'speed',
    desc: '掷出旋转巨斧，贯穿一条直线上的敌人',
    upDesc: '伤害 +7 · 穿透 +1 · 4/7 级 +1 斧',
    evo: { name: '斩风巨斧', desc: '斧刃风暴连绵不绝，无坚不摧' },
    maxLv: 8, base: { cd: 1.5 },
    stats(lv) {
      const k = lv - 1;
      return { count: 1 + (lv >= 4 ? 1 : 0) + (lv >= 7 ? 1 : 0), dmg: 16 + 7 * k, pierce: 3 + Math.floor(k / 2), spd: 300, size: 12, life: 1.8 };
    },
    evoStats() { return { count: 3, dmg: 90, pierce: 99, spd: 360, size: 18, life: 2.2 }; },
  },
  cross: {
    id: 'cross', name: '圣光十字', glyph: '十', passive: 'cdr',
    desc: '向十字四向射出穿透圣弹',
    upDesc: '伤害 +5 · 弹速 +18 · 3/6 级穿透 +1',
    evo: { name: '圣裁之环', desc: '八向圣环裁决全场邪祟' },
    maxLv: 8, base: { cd: 2.0 },
    stats(lv) {
      const k = lv - 1;
      return { dirs: 4, dmg: 12 + 5 * k, pierce: 2 + Math.floor(k / 3), spd: 340 + 18 * k, size: 7, life: 1.5 };
    },
    evoStats() { return { dirs: 8, dmg: 60, pierce: 8, spd: 420, size: 10, life: 1.8 }; },
  },
  poison: {
    id: 'poison', name: '毒圈', glyph: '毒', passive: 'magnet',
    desc: '在最近敌人脚下生成腐蚀毒沼，持续伤害',
    upDesc: '伤害 +3/s · 范围 +7 · 持续 +0.35s',
    evo: { name: '瘟疫渊泽', desc: '毒沼化为深渊，腐蚀迟缓，击杀扩散' },
    maxLv: 8, base: { cd: 3.2 },
    stats(lv) {
      const k = lv - 1;
      return { r: 55 + 7 * k, dps: 7 + 3 * k, dur: 3 + 0.35 * k, slow: 0 };
    },
    evoStats() { return { r: 130, dps: 46, dur: 6, slow: 1 }; },
  },
  lightning: {
    id: 'lightning', name: '雷链', glyph: '雷', passive: 'cdr',
    desc: '落雷轰击最近敌人并逐个跳跃传导',
    upDesc: '伤害 +6 · 每 2 级链数 +1 · 范围 +15',
    evo: { name: '天罚雷暴', desc: '八连天罚落雷，麻痹苍生' },
    maxLv: 8, base: { cd: 1.8 },
    stats(lv) {
      const k = lv - 1;
      return { chains: 2 + Math.floor(k / 2), dmg: 13 + 6 * k, range: 150 + 15 * k, stun: 0 };
    },
    evoStats() { return { chains: 8, dmg: 80, range: 300, stun: 0.5 }; },
  },
  ghostfire: {
    id: 'ghostfire', name: '幽火弹', glyph: '火', passive: 'speed',
    desc: '幽火循迹而行，追猎最近的活物',
    upDesc: '伤害 +4 · 每 2 级弹数 +1',
    evo: { name: '幽冥追魂火', desc: '八焰缠魂，无孔不入' },
    maxLv: 8, base: { cd: 1.3 },
    stats(lv) {
      const k = lv - 1;
      return { count: 2 + Math.floor(k / 2), dmg: 8 + 4 * k, spd: 240 + 12 * k, turn: 3.5 + 0.2 * k, life: 2.4, size: 8, pierce: 1 };
    },
    evoStats() { return { count: 8, dmg: 55, spd: 320, turn: 7, life: 3, size: 11, pierce: 2 }; },
  },
};

// ==================== runtime system ====================
export function makeWeaponSystem() {
  const list = [];          // [{id, lv, cd, evolved}]
  const projectiles = [];   // axe / cross / ghost orbs
  const zones = [];         // poison
  const chains = [];        // lightning FX {x1,y1,x2,y2,life}
  let bladeAng = 0;

  const find = (id) => list.find(w => w.id === id);
  const statsOf = (w) => w.evolved ? WEAPON_DEFS[w.id].evoStats() : WEAPON_DEFS[w.id].stats(w.lv);

  function add(id) {
    let w = find(id);
    if (!w) { w = { id, lv: 1, cd: 0.2, evolved: false }; list.push(w); }  // small initial cd → instant feedback & testability
    return w;
  }
  function setLv(id, lv) {
    const w = find(id);
    if (w) w.lv = Math.max(1, Math.min(WEAPON_DEFS[id].maxLv, lv | 0));
    return w;
  }
  function evolve(id) { const w = find(id); if (w) w.evolved = true; return w; }
  function reset() { list.length = 0; projectiles.length = 0; zones.length = 0; chains.length = 0; bladeAng = 0; }

  // ---- per-frame ----
  function update(dt, ctx) {
    for (const w of list) {
      const D = WEAPON_DEFS[w.id], st = statsOf(w);
      if (w.id === 'scythe') { stepScythe(w, st, dt, ctx); continue; }
      w.cd -= dt;
      if (w.cd <= 0) { fire(w, st, ctx); w.cd = D.base.cd * ctx.stats.cdrMul; }
    }
    stepProjectiles(dt, ctx);
    stepZones(dt, ctx);
    for (let i = chains.length - 1; i >= 0; i--) { chains[i].life -= dt; if (chains[i].life <= 0) chains.splice(i, 1); }
  }

  function stepScythe(w, st, dt, ctx) {
    bladeAng += st.rot * dt;
    const p = ctx.player;
    const R = 16;
    for (let i = 0; i < st.blades; i++) {
      const a = bladeAng + i * Math.PI * 2 / st.blades;
      const bx = p.x + Math.cos(a) * st.radius, by = p.y + Math.sin(a) * st.radius;
      ctx.query(bx, by, R + 18, (e) => {
        const dx = e.x - bx, dy = e.y - by;
        if (dx * dx + dy * dy < (R + e.r) * (R + e.r)) {
          if (ctx.damageEnemy(e, st.dmg, 'scythe', { wcd: st.hitCd }) && st.leech) ctx.heal(st.leech);
        }
      });
      ctx.hitBoss(bx, by, R, st.dmg, { wcd: st.hitCd, leech: st.leech, heal: () => ctx.heal(st.leech) });
    }
    // inner guard: the arc sweeps through the center — enemies hugging the
    // player are reaped too (no safe blind spot inside the ring)
    const inner = Math.max(26, st.radius * 0.55);
    ctx.query(p.x, p.y, inner + 18, (e) => {
      const dx = e.x - p.x, dy = e.y - p.y;
      if (dx * dx + dy * dy < (inner + e.r) * (inner + e.r)) {
        if (ctx.damageEnemy(e, st.dmg, 'scythe', { wcd: st.hitCd }) && st.leech) ctx.heal(st.leech);
      }
    });
  }

  function fire(w, st, ctx) {
    const p = ctx.player;
    if (w.id === 'axe') {
      const targets = ctx.nearestK(p.x, p.y, st.count);
      for (let i = 0; i < st.count; i++) {
        let a;
        const t = targets[i];
        if (t) a = Math.atan2(t.y - p.y, t.x - p.x);
        else a = Math.random() * Math.PI * 2;
        projectiles.push({ kind: 'axe', x: p.x, y: p.y, vx: Math.cos(a) * st.spd, vy: Math.sin(a) * st.spd, r: st.size, dmg: st.dmg, pierce: st.pierce, hits: new Set(), life: st.life, rot: 0, spd: st.spd });
      }
      ctx.sfx('shoot');
    } else if (w.id === 'cross') {
      const off = 0;   // fixed cross
      for (let i = 0; i < st.dirs; i++) {
        const a = off + i * Math.PI * 2 / st.dirs;
        projectiles.push({ kind: 'cross', x: p.x, y: p.y, vx: Math.cos(a) * st.spd, vy: Math.sin(a) * st.spd, r: st.size, dmg: st.dmg, pierce: st.pierce, hits: new Set(), life: st.life, spd: st.spd });
      }
      ctx.sfx('shoot');
    } else if (w.id === 'poison') {
      const t = ctx.nearest(p.x, p.y, 300, null);
      const zx = t ? t.x : p.x, zy = t ? t.y : p.y;
      zones.push({ x: zx, y: zy, r: st.r, dps: st.dps, life: st.dur, max: st.dur, tick: 0, slow: st.slow });
      ctx.sfx('poison');
    } else if (w.id === 'lightning') {
      fireLightning(st, ctx);
    } else if (w.id === 'ghostfire') {
      const base = Math.random() * Math.PI * 2;
      for (let i = 0; i < st.count; i++) {
        const a = base + i * 0.5;
        projectiles.push({ kind: 'ghost', x: p.x, y: p.y, vx: Math.cos(a) * st.spd, vy: Math.sin(a) * st.spd, r: st.size, dmg: st.dmg, pierce: st.pierce, hits: new Set(), life: st.life, spd: st.spd, turn: st.turn });
      }
      ctx.sfx('shoot');
    }
  }

  function fireLightning(st, ctx) {
    let sx = ctx.player.x, sy = ctx.player.y;
    const hit = new Set();
    for (let i = 0; i <= st.chains; i++) {
      const e = ctx.nearest(sx, sy, st.range, hit);
      if (!e) break;
      ctx.damageEnemy(e, st.dmg * Math.pow(0.78, i), 'lightning');
      if (st.stun) e.stunT = Math.max(e.stunT, st.stun);
      chains.push({ x1: sx, y1: sy, x2: e.x, y2: e.y, life: 0.16 });
      hit.add(e.id);
      sx = e.x; sy = e.y;
    }
    if (hit.size) ctx.sfx('zap');
  }

  function stepProjectiles(dt, ctx) {
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i];
      p.life -= dt;
      if (p.life <= 0) { projectiles.splice(i, 1); continue; }
      if (p.kind === 'ghost') {           // homing steer (dampens near target so the
        const t = ctx.nearest(p.x, p.y, 340, p.hits);   // turn radius can't exceed hit range)
        if (t) {
          const dx = t.x - p.x, dy = t.y - p.y;
          const dist = Math.hypot(dx, dy) || 1;
          const want = Math.atan2(dy, dx);
          const cur = Math.atan2(p.vy, p.vx);
          let d = want - cur;
          while (d > Math.PI) d -= Math.PI * 2;
          while (d < -Math.PI) d += Math.PI * 2;
          const spdEff = Math.min(p.spd, 110 + dist * 3.2);
          const na = dist < 40 ? want : cur + Math.max(-p.turn * dt, Math.min(p.turn * dt, d));
          p.vx = Math.cos(na) * spdEff; p.vy = Math.sin(na) * spdEff;
        }
      } else if (p.kind === 'axe') {
        p.rot += 12 * dt;
      }
      p.x += p.vx * dt; p.y += p.vy * dt;
      // world cull
      if (p.x < -60 || p.x > ctx.W + 60 || p.y < -60 || p.y > ctx.H + 60) { projectiles.splice(i, 1); continue; }
      // collide enemies
      let dead = false;
      ctx.query(p.x, p.y, p.r + 22, (e) => {
        if (dead || p.hits.has(e.id)) return;
        const dx = e.x - p.x, dy = e.y - p.y;
        if (dx * dx + dy * dy < (p.r + e.r) * (p.r + e.r)) {
          p.hits.add(e.id);
          ctx.damageEnemy(e, p.dmg, p.kind);
          if (--p.pierce <= 0) dead = true;
        }
      });
      if (!dead && ctx.hitBoss(p.x, p.y, p.r, p.dmg)) { p.hits.add(-1); if (--p.pierce <= 0) dead = true; }
      if (dead) projectiles.splice(i, 1);
    }
  }

  function stepZones(dt, ctx) {
    for (let i = zones.length - 1; i >= 0; i--) {
      const z = zones[i];
      z.life -= dt;
      if (z.life <= 0) { zones.splice(i, 1); continue; }
      z.tick -= dt;
      if (z.tick <= 0) {
        z.tick = 0.25;
        const hit = z.dps * 0.25;
        ctx.query(z.x, z.y, z.r, (e) => {
          const dx = e.x - z.x, dy = e.y - z.y;
          if (dx * dx + dy * dy < (z.r + e.r * .5) * (z.r + e.r * .5)) {
            ctx.damageEnemy(e, hit, 'poison', { noKb: true });
            if (z.slow) e.slowT = Math.max(e.slowT, 0.35);
          }
        });
        ctx.hitBossArea(z.x, z.y, z.r, hit);
      }
    }
  }

  function spawnZone(x, y, st) { zones.push({ x, y, r: st.r, dps: st.dps, life: st.dur, max: st.dur, tick: 0, slow: st.slow }); }

  // ---- rendering ----
  function draw(c, g) {   // g: {player, gameT}
    // poison zones (under entities)
    for (const z of zones) {
      const a = Math.min(1, z.life / .7);
      c.fillStyle = z.slow ? `rgba(150,80,200,${.13 * a})` : `rgba(110,220,90,${.12 * a})`;
      c.beginPath(); c.arc(z.x, z.y, z.r, 0, Math.PI * 2); c.fill();
      c.strokeStyle = z.slow ? `rgba(200,140,255,${.5 * a})` : `rgba(160,240,120,${.45 * a})`;
      c.lineWidth = 2;
      c.stroke();
      const pu = 1 + .05 * Math.sin(g.gameT * 7 + z.x);
      c.beginPath(); c.arc(z.x, z.y, z.r * .62 * pu, 0, Math.PI * 2);
      c.fillStyle = z.slow ? `rgba(190,110,255,${.1 * a})` : `rgba(140,230,100,${.1 * a})`;
      c.fill();
    }
    // lightning bolts
    for (const ch of chains) {
      const a = ch.life / .16;
      const mx = (ch.x1 + ch.x2) / 2 + (Math.random() - .5) * 16;
      const my = (ch.y1 + ch.y2) / 2 + (Math.random() - .5) * 16;
      c.strokeStyle = `rgba(190,225,255,${.28 * a})`; c.lineWidth = 5;
      c.beginPath(); c.moveTo(ch.x1, ch.y1); c.lineTo(mx, my); c.lineTo(ch.x2, ch.y2); c.stroke();
      c.strokeStyle = `rgba(240,250,255,${.9 * a})`; c.lineWidth = 2;
      c.beginPath(); c.moveTo(ch.x1, ch.y1); c.lineTo(mx, my); c.lineTo(ch.x2, ch.y2); c.stroke();
    }
    // projectiles
    for (const p of projectiles) {
      if (p.kind === 'axe') {
        c.save(); c.translate(p.x, p.y); c.rotate(p.rot);
        c.strokeStyle = '#8a6a3a'; c.lineWidth = 3;
        c.beginPath(); c.moveTo(-p.r * .8, 0); c.lineTo(p.r * .8, 0); c.stroke();
        c.fillStyle = '#cfd8dc';
        c.beginPath(); c.arc(p.r * .55, 0, p.r * .62, -Math.PI * .8, Math.PI * .8); c.fill();
        c.fillStyle = '#8a949c';
        c.beginPath(); c.arc(p.r * .55, 0, p.r * .3, -Math.PI * .7, Math.PI * .7); c.fill();
        c.restore();
      } else if (p.kind === 'cross') {
        c.fillStyle = 'rgba(255,235,150,.35)';
        c.beginPath(); c.arc(p.x, p.y, p.r * 1.8, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#ffe98a';
        c.beginPath(); c.arc(p.x, p.y, p.r, 0, Math.PI * 2); c.fill();
        c.strokeStyle = '#fff'; c.lineWidth = 2;
        c.beginPath(); c.moveTo(p.x - p.r * .6, p.y); c.lineTo(p.x + p.r * .6, p.y);
        c.moveTo(p.x, p.y - p.r * .6); c.lineTo(p.x, p.y + p.r * .6); c.stroke();
      } else if (p.kind === 'ghost') {
        c.fillStyle = 'rgba(110,230,230,.3)';
        c.beginPath(); c.arc(p.x, p.y, p.r * 1.7, 0, Math.PI * 2); c.fill();
        c.fillStyle = 'rgba(120,240,220,.9)';
        c.beginPath(); c.arc(p.x, p.y, p.r, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#f0ffff';
        c.beginPath(); c.arc(p.x, p.y, p.r * .45, 0, Math.PI * 2); c.fill();
      }
    }
    // scythe blades
    for (const w of list) {
      if (w.id !== 'scythe') continue;
      const st = statsOf(w), p = g.player;
      for (let i = 0; i < st.blades; i++) {
        const a = bladeAng + i * Math.PI * 2 / st.blades;
        const bx = p.x + Math.cos(a) * st.radius, by = p.y + Math.sin(a) * st.radius;
        drawBlade(c, bx, by, a + Math.PI / 2, w.evolved);
      }
    }
  }

  function drawBlade(c, x, y, rot, evolved) {
    c.save(); c.translate(x, y); c.rotate(rot);
    const g = c.createLinearGradient(0, -14, 0, 14);
    if (evolved) { g.addColorStop(0, '#ffd0d0'); g.addColorStop(1, '#b01830'); }
    else { g.addColorStop(0, '#f0f8e0'); g.addColorStop(1, '#7aa868'); }
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(0, -18);
    c.quadraticCurveTo(13, -4, 6, 16);
    c.quadraticCurveTo(2, 4, -6, 12);
    c.quadraticCurveTo(-10, -6, 0, -18);
    c.fill();
    c.strokeStyle = 'rgba(20,30,16,.5)'; c.lineWidth = 1.2; c.stroke();
    c.restore();
  }

  return {
    list, projectiles, zones, chains,
    add, setLv, evolve, find, statsOf, reset, update, draw, spawnZone,
  };
}
