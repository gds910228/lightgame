// Ironwright Arena 锻甲机斗场 — build definitions, derived combat stats and
// the three boss blueprints. All balance values are mirrored in DESIGN.md.

export const VW = 1280;
export const VH = 720;
export const ARENA = { cx: 640, cy: 386, rx: 548, ry: 272 };

export const START_COINS = 300;
export const REPAIR_COST = 30;
export const REPAIR_FRAC = 0.4;
export const DASH_COST = 32;
export const BARRIER_COST = 60;
export const BARRIER_TIME = 1.7;

export const WEAPONS = [
  {
    key: 'cleaver', name: '熔切巨刃', en: 'MOLTEN CLEAVER', glyph: '⚔', mode: 'melee',
    price: 30, dmg: 46, cd: 0.55, heat: 9, range: 148, arc: 1.05, weight: 24,
    blurb: '近身扇形斩击，单发最重，命中回收熔核。', color: '#ffb15c',
  },
  {
    key: 'autocannon', name: '双管机炮', en: 'TWIN AUTOCANNON', glyph: '⌁', mode: 'auto',
    price: 45, dmg: 8, cd: 0.11, heat: 5.2, speed: 920, range: 760, spread: 0.028,
    count: 1, weight: 18, blurb: '9 发/秒的持续压制，热量积蓄最快。', color: '#ffd27a',
  },
  {
    key: 'missile', name: '蜂群导弹', en: 'SWARM MISSILES', glyph: '➤', mode: 'missile',
    price: 60, dmg: 38, cd: 0.85, heat: 17, speed: 350, range: 780,
    splash: 58, splashR: 76, weight: 26, blurb: '追踪弹头，命中后熔爆溅射。', color: '#ff8450',
  },
  {
    key: 'beam', name: '聚焦光束', en: 'FOCUS LANCE', glyph: '≋', mode: 'beam',
    price: 65, dmg: 5, cd: 0.10, heat: 5.8, range: 700, weight: 22,
    blurb: '持续照射，精度要求高，热量消耗极大。', color: '#ffe6a0',
  },
  {
    key: 'shotgun', name: '熔渣霰弹', en: 'SLAG SCATTER', glyph: '✹', mode: 'shot',
    price: 40, dmg: 6, cd: 0.72, heat: 18, speed: 780, range: 470,
    count: 8, spread: 0.38, weight: 30, blurb: '八枚熔渣近距齐射，贴身爆发极高。', color: '#ff9a48',
  },
  {
    key: 'aegis', name: '逆流盾铳', en: 'REFLUX AEGIS', glyph: '⛨', mode: 'pulse',
    price: 55, dmg: 24, cd: 0.46, heat: 11, speed: 650, range: 610,
    counter: 1.5, weight: 32, blurb: '重脉冲；E 屏障延长且反弹伤害更高。', color: '#8fe6d4',
  },
];

export const ARMORS = [
  {
    key: 'falcon', name: '游隼骨架', en: 'FALCON FRAME', glyph: '⌇',
    price: 30, hp: 90, armor: 0, speed: 1.22, heat: 80, vent: 1.00, weight: 18,
    blurb: '极轻竞速骨架，快但脆，热量容限小。', accent: '#b7c3c4',
  },
  {
    key: 'ceramic', name: '轻质陶甲', en: 'CERAMIC PLATE', glyph: '◫',
    price: 40, hp: 105, armor: 1, speed: 1.12, heat: 98, vent: 1.12, weight: 28,
    blurb: '轻陶瓷夹层，兼顾散热与机动。', accent: '#c9bda6',
  },
  {
    key: 'composite', name: '蜂窝复甲', en: 'HIVE COMPOSITE', glyph: '⬡',
    price: 50, hp: 130, armor: 2, speed: 1.00, heat: 122, vent: 1.00, weight: 40,
    blurb: '标准蜂巢复合板，各项均衡。', accent: '#a6a8a2',
  },
  {
    key: 'reactive', name: '赤铜反应甲', en: 'COPPER REACTIVE', glyph: '◉',
    price: 55, hp: 118, armor: 1, speed: 1.04, heat: 115, vent: 1.32, weight: 36,
    blurb: '赤铜导热层，热量消散快三成。', accent: '#d98b54',
  },
  {
    key: 'cryo', name: '寒铁绝缘甲', en: 'COLD IRON WEAVE', glyph: '❄',
    price: 60, hp: 128, armor: 2, speed: 0.95, heat: 155, vent: 1.10, weight: 48,
    blurb: '寒铁隔热织层，可承受长时间过热。', accent: '#91b8c4',
  },
  {
    key: 'heavy', name: '熔钢重甲', en: 'CRUCIBLE PLATE', glyph: '▰',
    price: 65, hp: 180, armor: 4, speed: 0.82, heat: 110, vent: 0.90, weight: 66,
    blurb: '厚重熔钢，最高结构值与固定减伤。', accent: '#e0a057',
  },
];

export const THRUSTERS = [
  {
    key: 'standard', name: '标准推进器', en: 'STANDARD DRIVE', glyph: '▷',
    price: 25, speed: 1.00, dash: 1.00, cd: 1.40, energy: 100, regen: 24, heat: 0, weight: 22,
    blurb: '推力、能耗与冷却均衡。', accent: '#c9a46a',
  },
  {
    key: 'turbo', name: '涡轮冲刺', en: 'TURBO RAM', glyph: '⇶',
    price: 45, speed: 1.08, dash: 1.28, cd: 1.02, energy: 90, regen: 22, heat: 8, weight: 20,
    blurb: '冲刺更快更远，冷却更短。', accent: '#ffb45a',
  },
  {
    key: 'hover', name: '悬浮反推', en: 'HOVER REPULSOR', glyph: '⌁',
    price: 35, speed: 1.12, dash: 0.92, cd: 1.18, energy: 120, regen: 30, heat: 2, weight: 24,
    hover: true, blurb: '悬浮滑行，能量回复最快。', accent: '#9ed8d0',
  },
  {
    key: 'forge', name: '熔炉过载', en: 'FORGE OVERDRIVE', glyph: '✹',
    price: 55, speed: 0.94, dash: 1.45, cd: 1.55, energy: 130, regen: 20, heat: 18, weight: 34,
    dashDamage: 40, blurb: '冲刺撞击造成 40 伤害，代价是升温。', accent: '#ff7e42',
  },
];

export const DEFAULT_LOADOUT = { weapon: 'autocannon', armor: 'composite', thruster: 'standard' };

export const BOSSES = [
  {
    id: 'warden', name: '铁颚监工', en: 'IRONJAW WARDEN', no: 'I',
    hp: 2400, r: 56, speed: 70, interval: 1.9, reward: { coins: 90, parts: 20 },
    color: '#ff7d36', accent: '#ffd177', dark: '#3a2118',
    patterns: ['slam', 'radial', 'charge', 'radial'],
    intro: '液压颚已锁定。躲开落锤的熔渣坑。',
  },
  {
    id: 'arbiter', name: '熔核裁判', en: 'CRUCIBLE ARBITER', no: 'II',
    hp: 3400, r: 66, speed: 92, interval: 1.65, reward: { coins: 120, parts: 32 },
    color: '#ff5230', accent: '#ffe29a', dark: '#321821',
    patterns: ['sweep', 'missiles', 'cross', 'sweep'],
    intro: '审判光带正在充能。贴住内圈反而安全。',
  },
  {
    id: 'colossus', name: '铸世巨像', en: 'FORGE COLOSSUS', no: 'III',
    hp: 4600, r: 82, speed: 58, interval: 1.45, reward: { coins: 160, parts: 48 },
    color: '#ff9a3e', accent: '#fff0b3', dark: '#3b2014',
    patterns: ['nova', 'charge', 'rain', 'cross'],
    intro: '炉心解封。巨像会在半血后过载提速。',
  },
];

export const PART_SETS = { weapon: WEAPONS, armor: ARMORS, thruster: THRUSTERS };

export function partByKey(slot, key) {
  return PART_SETS[slot].find(p => p.key === key) || PART_SETS[slot][0];
}

export function loadoutCost(loadout) {
  return partByKey('weapon', loadout.weapon).price +
    partByKey('armor', loadout.armor).price +
    partByKey('thruster', loadout.thruster).price;
}

export function deriveStats(loadout) {
  const w = partByKey('weapon', loadout.weapon);
  const a = partByKey('armor', loadout.armor);
  const t = partByKey('thruster', loadout.thruster);
  const weight = w.weight + a.weight + t.weight;
  const move = Math.round(250 * a.speed * t.speed * (1 - weight * 0.0012));
  const heatCap = a.heat + t.heat;
  const heatVent = +(11 * a.vent).toFixed(1);
  return {
    weapon: w.key, armorKey: a.key, thrusterKey: t.key,
    weaponName: w.name, armorName: a.name, thrusterName: t.name,
    weaponMode: w.mode, dmg: w.dmg, fireDelay: w.cd, heatPerShot: w.heat,
    range: w.range, projSpeed: w.speed || 0, count: w.count || 1,
    spread: w.spread || 0, splash: w.splash || 0, splashR: w.splashR || 0,
    counter: !!w.counter, weaponWeight: w.weight,
    maxHp: a.hp, armor: a.armor, heatCap, heatVent,
    speed: move, weight,
    dashSpeed: Math.round(760 * t.dash), dashCd: t.cd, dashCost: DASH_COST,
    energyMax: t.energy, energyRegen: t.regen,
    hover: !!t.hover, dashDamage: t.dashDamage || 0,
    loadoutCost: w.price + a.price + t.price,
    colors: { weapon: w.color, armor: a.accent, thruster: t.accent },
  };
}

export function formatTime(sec) {
  const s = Math.max(0, Number(sec) || 0);
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  return `${String(m).padStart(2, '0')}:${r.toFixed(1).padStart(4, '0')}`;
}

export function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
export function dist2(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; }
export function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
export function arenaClamp(x, y, pad = 22) {
  // keep actors inside the elliptical plate, with a little wall clearance
  const rx = ARENA.rx - pad, ry = ARENA.ry - pad;
  const nx = (x - ARENA.cx) / rx, ny = (y - ARENA.cy) / ry;
  const d = Math.hypot(nx, ny);
  if (d <= 1) return { x, y };
  return { x: ARENA.cx + nx / d * rx, y: ARENA.cy + ny / d * ry };
}
