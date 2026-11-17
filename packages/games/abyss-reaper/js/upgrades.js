// Upgrade pool for Abyss Reaper 暗渊割草者: 4 passives, XP curve,
// three-choice level-up builder (evolution-priority), card metadata.

import { WEAPON_DEFS, EVO_NEED } from './weapons.js';

export const PASSIVE_DEFS = {
  speed:  { id: 'speed',  name: '疾风之靴', glyph: '疾', desc: '移动速度 +8% / 级', max: 5 },
  magnet: { id: 'magnet', name: '磁力晶石', glyph: '磁', desc: '拾取半径 +26 / 级', max: 5 },
  armor:  { id: 'armor',  name: '深渊骨甲', glyph: '甲', desc: '受到伤害 -6% / 级', max: 5 },
  cdr:    { id: 'cdr',    name: '时之沙漏', glyph: '时', desc: '武器冷却 -5% / 级', max: 5 },
};

export function xpNeed(level) {
  return Math.floor(5 + (level - 1) * 8 + Math.pow(level - 1, 1.7) * 1.5);
}

// Build 3 level-up choices. Eligible evolutions always come first
// (guaranteed offer when weapon is maxed + its passive >= 3),
// the rest is sampled from weapons / upgrades / passives.
export function buildChoices({ weapons, passives }) {
  const out = [];
  for (const w of weapons) {
    const D = WEAPON_DEFS[w.id];
    if (w.lv >= D.maxLv && !w.evolved && (passives[D.passive] || 0) >= (D.evoNeed || EVO_NEED)) {
      out.push({ type: 'evolve', id: w.id });
    }
  }
  const pool = [];
  const owned = new Set(weapons.map(w => w.id));
  for (const w of weapons) if (w.lv < WEAPON_DEFS[w.id].maxLv) pool.push({ type: 'upgrade', id: w.id, lv: w.lv + 1 });
  for (const id in WEAPON_DEFS) if (!owned.has(id)) pool.push({ type: 'weapon', id });
  for (const id in PASSIVE_DEFS) {
    const lv = passives[id] || 0;
    if (lv < PASSIVE_DEFS[id].max) pool.push({ type: 'passive', id, lv: lv + 1 });
  }
  for (let i = pool.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  while (out.length < 3 && pool.length) out.push(pool.pop());
  let fb = 0;
  while (out.length < 3) out.push((fb++ % 2 === 0) ? { type: 'heal' } : { type: 'xp' });
  return out.slice(0, 3);
}

// Card presentation metadata for ui.renderChoices
export function choiceCard(c) {
  if (c.type === 'evolve') {
    const D = WEAPON_DEFS[c.id];
    return { cls: 'evolve', glyph: D.glyph, tag: '进化', name: D.evo.name, desc: D.evo.desc };
  }
  if (c.type === 'weapon') {
    const D = WEAPON_DEFS[c.id];
    return { cls: '', glyph: D.glyph, tag: '新武器', name: D.name, desc: D.desc };
  }
  if (c.type === 'upgrade') {
    const D = WEAPON_DEFS[c.id];
    return { cls: '', glyph: D.glyph, tag: '强化', name: `${D.name} → Lv${c.lv}`, desc: D.upDesc };
  }
  if (c.type === 'passive') {
    const D = PASSIVE_DEFS[c.id];
    return { cls: '', glyph: D.glyph, tag: '被动', name: `${D.name} Lv${c.lv}`, desc: D.desc };
  }
  if (c.type === 'heal') return { cls: '', glyph: '治', tag: '补给', name: '深渊补给', desc: '立即回复 40 点生命' };
  return { cls: '', glyph: '晶', tag: '魂能', name: '魂能结晶', desc: '立即获得 30 XP' };
}
