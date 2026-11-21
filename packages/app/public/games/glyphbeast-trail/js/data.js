// Glyphbeast: Sixfold Trail — data tables.
// Elements, status effects, 12 species (each 3 skills), wild zones, four bosses.

export const ELEMENTS = {
  flame:  { zh: '焰', long: '焰', hue: '#ef7a52', light: '#ffb98e', dark: '#7c2b20', glyph: 'flame' },
  tide:   { zh: '潮', long: '潮', hue: '#5ccbc6', light: '#a9f0e6', dark: '#1f5f66', glyph: 'wave' },
  stone:  { zh: '岩', long: '岩', hue: '#c9a066', light: '#edd6a4', dark: '#66502f', glyph: 'stone' },
  gale:   { zh: '风', long: '风', hue: '#8fd9a6', light: '#d1f5d8', dark: '#3f6b50', glyph: 'gale' },
  light:  { zh: '光', long: '光', hue: '#f0d486', light: '#fff3c4', dark: '#806630', glyph: 'light' },
  shadow: { zh: '影', long: '影', hue: '#a58ade', light: '#d9c8ff', dark: '#4b3776', glyph: 'shadow' },
};

// One six-step cycle: each element beats the next and is weak to the previous.
export const CYCLE = ['flame', 'gale', 'stone', 'tide', 'light', 'shadow'];
export const ELEMENT_LIST = CYCLE.slice();

export function elemMult(atkEl, defEl) {
  if (!ELEMENTS[atkEl] || !ELEMENTS[defEl] || atkEl === defEl) return 1;
  const a = CYCLE.indexOf(atkEl), d = CYCLE.indexOf(defEl);
  if ((a + 1) % 6 === d) return 1.5;
  if ((d + 1) % 6 === a) return 0.67;
  return 1;
}

export const STATUS = {
  burn:   { zh: '灼烧', short: '灼', turns: 3, color: '#f07850', dot: 1 / 16 },
  slow:   { zh: '潮缚', short: '缚', turns: 3, color: '#5ccbc6', spd: 0.6 },
  accdown:{ zh: '风蚀', short: '蚀', turns: 3, color: '#8fd9a6', acc: -0.2 },
  atkdown:{ zh: '影蚀', short: '蚀', turns: 3, color: '#a58ade', atk: 0.75 },
  stun:   { zh: '麻痹', short: '麻', turns: 1, color: '#f0d486', skip: true },
};

export const SPECIES_ORDER = [
  'emberbadger', 'candlestag', 'tideotter', 'shellspirit', 'gravelrhino', 'mosstort',
  'galefalcon', 'reedfox', 'lamprabbit', 'dawnram', 'inkcat', 'nightowl',
];

// Base stats are level-1 values; statsAt() applies gentle growth.
export const SPECIES = {
  emberbadger: {
    id: 'emberbadger', zh: '焰尾獾', en: 'Emberbadger', el: 'flame', shape: 'badger',
    base: { hp: 54, atk: 15, def: 11, spd: 13 }, catch: 0.34, zone: '萤草甸',
    lore: '尾尖藏着一粒不灭的炭火，夜里走路时会替主人照见脚下的石缝。',
    skills: [
      { id: 'eb1', name: '火尾扫', el: 'flame', type: 'damage', power: 48, acc: 0.95, status: 'burn', chance: 0.18, desc: '甩尾横扫，偶有火星沾身。' },
      { id: 'eb2', name: '灼痕', el: 'flame', type: 'status', power: 8, acc: 0.9, status: 'burn', chance: 1.0, desc: '在对手身上烙下灼痕。' },
      { id: 'eb3', name: '暖焰蜷', el: 'flame', type: 'heal', heal: 0.3, acc: 1, desc: '蜷成一团，借体内炭火疗伤。' },
    ],
  },
  candlestag: {
    id: 'candlestag', zh: '烛角鹿', en: 'Candlestag', el: 'flame', shape: 'stag',
    base: { hp: 52, atk: 16, def: 9, spd: 15 }, catch: 0.28, zone: '无灯原',
    lore: '角枝上燃着两簇不会滴落的烛焰，走过的地方雪会化开。',
    skills: [
      { id: 'cs1', name: '烛角突', el: 'flame', type: 'damage', power: 54, acc: 0.9, desc: '低头以烛角进击。' },
      { id: 'cs2', name: '燎原印', el: 'flame', type: 'status', power: 6, acc: 0.85, status: 'burn', chance: 0.85, desc: '踏出火印，烧灼对手。' },
      { id: 'cs3', name: '焰帷', el: 'flame', type: 'shield', shield: 0.3, acc: 1, desc: '掀起焰幕，挡下部分伤害。' },
    ],
  },
  tideotter: {
    id: 'tideotter', zh: '潮牙獭', en: 'Tide Otter', el: 'tide', shape: 'otter',
    base: { hp: 58, atk: 14, def: 12, spd: 12 }, catch: 0.36, zone: '萤草甸 · 潮鸣溪',
    lore: '会把捡到的亮石子含在腮边，遇到熟人时吐出来当礼物。',
    skills: [
      { id: 'to1', name: '潮牙咬', el: 'tide', type: 'damage', power: 46, acc: 0.95, desc: '带上潮气的利齿一咬。' },
      { id: 'to2', name: '缠潮', el: 'tide', type: 'status', power: 8, acc: 0.9, status: 'slow', chance: 0.9, desc: '湿冷的潮线缠住四肢。' },
      { id: 'to3', name: '水茴愈', el: 'tide', type: 'heal', heal: 0.3, acc: 1, desc: '嚼一株水茴，缓缓复原。' },
    ],
  },
  shellspirit: {
    id: 'shellspirit', zh: '汀贝灵', en: 'Shell Spirit', el: 'tide', shape: 'shell',
    base: { hp: 64, atk: 11, def: 17, spd: 8 }, catch: 0.3, zone: '潮鸣溪',
    lore: '空贝里住着一位小小的汐神，浪退时能听见它磨牙似的细响。',
    skills: [
      { id: 'ss1', name: '贝刃回旋', el: 'tide', type: 'damage', power: 44, acc: 0.9, desc: '旋起锋利贝缘。' },
      { id: 'ss2', name: '雾沫', el: 'tide', type: 'status', power: 6, acc: 0.9, status: 'accdown', chance: 0.9, desc: '喷出咸雾，遮蔽对手视线。' },
      { id: 'ss3', name: '珠泪壳', el: 'tide', type: 'shield', shield: 0.35, acc: 1, desc: '凝出珍珠般的护壳。' },
    ],
  },
  gravelrhino: {
    id: 'gravelrhino', zh: '砾背犀', en: 'Gravel Rhino', el: 'stone', shape: 'rhino',
    base: { hp: 70, atk: 17, def: 15, spd: 8 }, catch: 0.22, zone: '风蚀嶂 · 无灯原',
    lore: '背甲上滚落的碎石会自己爬回去，像一小群听话的甲虫。',
    skills: [
      { id: 'gr1', name: '碎岩冲', el: 'stone', type: 'damage', power: 58, acc: 0.88, desc: '裹着碎石正面冲锋。' },
      { id: 'gr2', name: '震地', el: 'stone', type: 'status', power: 10, acc: 0.85, status: 'stun', chance: 0.45, desc: '踏裂地面，震得对手发麻。' },
      { id: 'gr3', name: '砾甲', el: 'stone', type: 'shield', shield: 0.32, acc: 1, desc: '把碎石聚成护甲。' },
    ],
  },
  mosstort: {
    id: 'mosstort', zh: '苔石龟', en: 'Moss Tortoise', el: 'stone', shape: 'tortoise',
    base: { hp: 76, atk: 12, def: 19, spd: 6 }, catch: 0.28, zone: '潮鸣溪 · 风蚀嶂',
    lore: '壳上的苔藓按节气变色，是山民不用翻书的历法。',
    skills: [
      { id: 'mt1', name: '岩壳撞', el: 'stone', type: 'damage', power: 42, acc: 0.96, desc: '缩进壳里，笨重地撞出去。' },
      { id: 'mt2', name: '苔缚', el: 'stone', type: 'status', power: 6, acc: 0.9, status: 'slow', chance: 0.9, desc: '湿苔缠足，拖慢步伐。' },
      { id: 'mt3', name: '地脉回春', el: 'stone', type: 'heal', heal: 0.32, acc: 1, desc: '伏地吸纳地脉暖气。' },
    ],
  },
  galefalcon: {
    id: 'galefalcon', zh: '风翎隼', en: 'Gale Falcon', el: 'gale', shape: 'falcon',
    base: { hp: 48, atk: 16, def: 8, spd: 18 }, catch: 0.24, zone: '风蚀嶂',
    lore: '翅下的风会把人的话吹成两截，所以山民只对它打手势。',
    skills: [
      { id: 'gf1', name: '风翎斩', el: 'gale', type: 'damage', power: 50, acc: 0.92, crit: 0.08, desc: '以翼缘划出一道风刃。' },
      { id: 'gf2', name: '乱流', el: 'gale', type: 'status', power: 5, acc: 0.85, status: 'accdown', chance: 0.85, desc: '搅乱气流，令对手失准。' },
      { id: 'gf3', name: '振翅', el: 'gale', type: 'heal', heal: 0.24, acc: 1, desc: '展开双翅调整呼吸。' },
    ],
  },
  reedfox: {
    id: 'reedfox', zh: '芦笛狐', en: 'Reed Fox', el: 'gale', shape: 'fox',
    base: { hp: 54, atk: 14, def: 10, spd: 16 }, catch: 0.3, zone: '潮鸣溪',
    lore: '折一截芦管就能吹出三种调子，夜里常把赶路的人引到正道上。',
    skills: [
      { id: 'rf1', name: '芦笛音', el: 'gale', type: 'damage', power: 45, acc: 0.95, desc: '吹出尖锐的芦笛声波。' },
      { id: 'rf2', name: '迷音', el: 'gale', type: 'status', power: 4, acc: 0.9, status: 'stun', chance: 0.4, desc: '一段绕梁的调子，听呆对手。' },
      { id: 'rf3', name: '顺风盾', el: 'gale', type: 'shield', shield: 0.24, acc: 1, desc: '借顺风织出一面软盾。' },
    ],
  },
  lamprabbit: {
    id: 'lamprabbit', zh: '灯芯兔', en: 'Lamp Rabbit', el: 'light', shape: 'rabbit',
    base: { hp: 50, atk: 13, def: 10, spd: 15 }, catch: 0.36, zone: '萤草甸',
    lore: '额前小灯只在高兴时亮，遇见生人会立刻缩成一颗安静的红豆。',
    skills: [
      { id: 'lr1', name: '灯芯踢', el: 'light', type: 'damage', power: 44, acc: 0.96, desc: '后腿一蹬，带起一溜光屑。' },
      { id: 'lr2', name: '晃灯', el: 'light', type: 'status', power: 4, acc: 0.85, status: 'accdown', chance: 0.85, desc: '晃花对手的眼睛。' },
      { id: 'lr3', name: '暖光', el: 'light', type: 'heal', heal: 0.36, acc: 1, desc: '额灯低垂，暖意漫过全身。' },
    ],
  },
  dawnram: {
    id: 'dawnram', zh: '曦角羊', en: 'Dawn Ram', el: 'light', shape: 'ram',
    base: { hp: 62, atk: 15, def: 14, spd: 10 }, catch: 0.26, zone: '风蚀嶂',
    lore: '角尖蓄着清晨第一缕光，撞在石上会迸出细小的虹。',
    skills: [
      { id: 'dr1', name: '曦角撞', el: 'light', type: 'damage', power: 52, acc: 0.92, desc: '低头亮角，正面撞去。' },
      { id: 'dr2', name: '曙光耀', el: 'light', type: 'status', power: 8, acc: 0.9, status: 'accdown', chance: 0.9, desc: '角尖骤亮，刺痛视线。' },
      { id: 'dr3', name: '晨曦护', el: 'light', type: 'shield', shield: 0.34, acc: 1, desc: '以晨光裹住身体。' },
    ],
  },
  inkcat: {
    id: 'inkcat', zh: '墨影猫', en: 'Ink Cat', el: 'shadow', shape: 'cat',
    base: { hp: 50, atk: 17, def: 9, spd: 18 }, catch: 0.22, zone: '无灯原',
    lore: '尾巴尖会滴下墨点，走过的墙根留下一串很快消失的猫爪印。',
    skills: [
      { id: 'ic1', name: '墨爪', el: 'shadow', type: 'damage', power: 54, acc: 0.92, crit: 0.08, desc: '一爪撕开暗色口子。' },
      { id: 'ic2', name: '影缠', el: 'shadow', type: 'status', power: 8, acc: 0.9, status: 'atkdown', chance: 0.9, desc: '影子缠上对手前肢。' },
      { id: 'ic3', name: '潜影盾', el: 'shadow', type: 'shield', shield: 0.26, acc: 1, desc: '没入薄影，卸去一部分劲力。' },
    ],
  },
  nightowl: {
    id: 'nightowl', zh: '夜巡鸮', en: 'Night Owl', el: 'shadow', shape: 'owl',
    base: { hp: 62, atk: 15, def: 12, spd: 13 }, catch: 0.24, zone: '无灯原',
    lore: '两圈眼斑像旧铜镜，巡夜时会替迷路的人把影子领回家。',
    skills: [
      { id: 'no1', name: '夜巡俯冲', el: 'shadow', type: 'damage', power: 50, acc: 0.94, desc: '无声俯冲，翅羽擦出暗芒。' },
      { id: 'no2', name: '哑声', el: 'shadow', type: 'status', power: 8, acc: 0.85, status: 'stun', chance: 0.35, desc: '一声低哑的鸣叫，令人僵住。' },
      { id: 'no3', name: '暗羽愈', el: 'shadow', type: 'heal', heal: 0.3, acc: 1, desc: '理一理暗羽，稳住心脉。' },
    ],
  },
};

export function spDef(id) { return SPECIES[id]; }
export function skillOf(id, i) { const s = SPECIES[id]; return s && s.skills[i]; }

export function statsAt(sp, level) {
  const L = Math.max(1, Math.round(level));
  return {
    hp: Math.max(1, Math.round(sp.base.hp * (1 + 0.085 * (L - 1)))),
    atk: Math.max(1, Math.round(sp.base.atk * (1 + 0.055 * (L - 1)))),
    def: Math.max(1, Math.round(sp.base.def * (1 + 0.05 * (L - 1)))),
    spd: Math.max(1, Math.round(sp.base.spd * (1 + 0.045 * (L - 1)))),
  };
}

export function xpNeed(level) { return 40 + Math.max(1, level) * 20; }

// Pure damage core (before shield / crit / variance). Kept separate for tests.
export function damageCore(level, atk, def, power, mult = 1) {
  const raw = (((2 * level / 5 + 2) * power * atk / Math.max(1, def)) / 20 + level * 0.5) * mult;
  return Math.max(1, raw);
}

export function damageFormula(level, atk, def, power, mult = 1, variance = 1) {
  return Math.max(1, Math.round(damageCore(level, atk, def, power, mult) * variance));
}

export function xpReward(level) { return 14 + Math.round(level) * 7; }
export function goldReward(level) { return 10 + Math.round(level) * 4; }
export function bossGoldReward(i) { return 90 + i * 50; }

// Wild zones and their grass patches (all coordinates in world pixels).
export const ZONES = [
  {
    id: 'meadow', zh: '萤草甸', sub: '灯虫与初生的符兽', x0: 340, x1: 840,
    grass: [
      { x: 470, y: 430, w: 250, h: 190 },
      { x: 540, y: 780, w: 260, h: 210 },
      { x: 360, y: 1000, w: 220, h: 180 },
    ],
    wild: [
      { id: 'emberbadger', min: 3, max: 5, w: 3 },
      { id: 'tideotter', min: 3, max: 5, w: 3 },
      { id: 'lamprabbit', min: 4, max: 6, w: 1 },
    ],
    wander: [{ id: 'emberbadger', x: 600, y: 540 }, { id: 'tideotter', x: 650, y: 900 }, { id: 'lamprabbit', x: 460, y: 600 }],
  },
  {
    id: 'river', zh: '潮鸣溪', sub: '潮声里藏着旧符', x0: 850, x1: 1200,
    grass: [
      { x: 880, y: 390, w: 260, h: 220 },
      { x: 860, y: 940, w: 270, h: 220 },
    ],
    wild: [
      { id: 'shellspirit', min: 6, max: 8, w: 3 },
      { id: 'mosstort', min: 6, max: 8, w: 2 },
      { id: 'reedfox', min: 7, max: 9, w: 3 },
    ],
    wander: [{ id: 'reedfox', x: 1000, y: 520 }, { id: 'shellspirit', x: 1030, y: 1040 }, { id: 'mosstort', x: 930, y: 700 }],
  },
  {
    id: 'crag', zh: '风蚀嶂', sub: '风把石头的棱角磨成符形', x0: 1210, x1: 1590,
    grass: [
      { x: 1290, y: 350, w: 230, h: 200 },
      { x: 1310, y: 900, w: 240, h: 240 },
      { x: 1490, y: 620, w: 170, h: 170 },
    ],
    wild: [
      { id: 'gravelrhino', min: 9, max: 11, w: 3 },
      { id: 'galefalcon', min: 9, max: 12, w: 3 },
      { id: 'dawnram', min: 10, max: 12, w: 2 },
      { id: 'mosstort', min: 9, max: 11, w: 1 },
    ],
    wander: [{ id: 'galefalcon', x: 1380, y: 470 }, { id: 'gravelrhino', x: 1430, y: 1000 }, { id: 'dawnram', x: 1550, y: 700 }],
  },
  {
    id: 'shadow', zh: '无灯原', sub: '只剩符纹在夜里发亮', x0: 1600, x1: 2200,
    grass: [
      { x: 1680, y: 340, w: 240, h: 220 },
      { x: 1680, y: 960, w: 260, h: 220 },
      { x: 1960, y: 330, w: 180, h: 220 },
    ],
    wild: [
      { id: 'candlestag', min: 13, max: 15, w: 2 },
      { id: 'inkcat', min: 13, max: 16, w: 3 },
      { id: 'nightowl', min: 13, max: 16, w: 3 },
      { id: 'gravelrhino', min: 13, max: 15, w: 1 },
    ],
    wander: [{ id: 'inkcat', x: 1770, y: 460 }, { id: 'nightowl', x: 1800, y: 1050 }, { id: 'candlestag', x: 2040, y: 440 }],
  },
];

export const BOSSES = [
  {
    id: 'ahe', name: '阿禾', title: '青盏关 · 符匠', gate: '青盏关', el: 'tide',
    x: 820, y: 700, req: 0,
    intro: '阿禾把青盏搁在膝上：\n「让我看看你的符兽，是不是只会躲。」',
    winLine: '「灯还亮着，路就还在。去吧。」',
    team: [{ id: 'tideotter', lvl: 7 }, { id: 'mosstort', lvl: 7 }],
  },
  {
    id: 'lan', name: '岚', title: '赤砂台 · 驯符师', gate: '赤砂台', el: 'gale',
    x: 1200, y: 700, req: 1,
    intro: '岚站在赤砂台的风里：\n「风认路，也认对手。别眨眼。」',
    winLine: '「好风送你一程。前面是玄的地界了。」',
    team: [{ id: 'reedfox', lvl: 11 }, { id: 'galefalcon', lvl: 11 }, { id: 'shellspirit', lvl: 11 }],
  },
  {
    id: 'xuan', name: '玄', title: '霜岩阶 · 守符人', gate: '霜岩阶', el: 'stone',
    x: 1580, y: 700, req: 2,
    intro: '玄敲了敲岩阶：\n「石头记得每一次败北。你记得吗？」',
    winLine: '「阶上的霜化了。六道坛在等你。」',
    team: [{ id: 'gravelrhino', lvl: 15 }, { id: 'dawnram', lvl: 15 }, { id: 'mosstort', lvl: 15 }],
  },
  {
    id: 'moliang', name: '墨梁', title: '六道坛 · 冠军', gate: '六道坛', el: 'shadow',
    x: 1990, y: 700, req: 3,
    intro: '墨梁立在坛心，身后六枚符钉次第亮起：\n「六道走完，才配说自己驯过兽。」',
    winLine: '「坛心的灯，从今夜起归你。」',
    team: [{ id: 'inkcat', lvl: 20 }, { id: 'nightowl', lvl: 20 }, { id: 'lamprabbit', lvl: 19 }, { id: 'emberbadger', lvl: 21 }],
  },
];

export const SHOP_ITEMS = [
  { id: 'seal1', zh: '符印 ×1', cost: 30, seals: 1, desc: '投出后可尝试捕获虚弱的符兽。' },
  { id: 'seal3', zh: '符印 ×3', cost: 80, seals: 3, desc: '一叠三枚，路上总要用的。' },
];

export const PLAYER_SPEED = 165;
export const CAM_W = 1280, CAM_H = 720;
export const WORLD_W = 2200, WORLD_H = 1400;
export const START_POS = { x: 330, y: 760 };
export const CAMP_POS = { x: 245, y: 690 };
export const SHOP_POS = { x: 415, y: 655 };
