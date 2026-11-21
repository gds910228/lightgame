// Crucible Atelier 坩埚炼金坊 — static data tables.
// 36 recipes arranged as a dependency tree, 4 automation lines, 2 base items.
// All content is original; no external assets.

export const MAX_LEVEL = 12;
export const OFFLINE_CAP = 8 * 3600;      // 8 hours, in seconds
export const MAX_PRESSURE = 100;
export const OVERLOAD_PRESSURE = 28;

// ---------------------------------------------------------------- base items
export const BASE_ITEMS = {
  water: { id: 'water', name: '水滴', glyph: '水', shape: 'drop', color: '#6fc8ff', base: true, desc: '冷凝管尖坠下的清亮雨水。' },
  ash: { id: 'ash', name: '灰烬', glyph: '灰', shape: 'powder', color: '#a89a8c', base: true, desc: '炉膛深处筛出的温热余灰。' },
};

// ---------------------------------------------------------------- recipes
// inputs: [ [itemId, count], ... ]  req: recipe ids that must have been
// discovered first.  A recipe becomes available only after every req is known,
// so the tree opens progressively from 水滴 + 灰烬.
export const RECIPES = [
  // ---- tier 1 (6) ----
  { id: 'mist', name: '薄雾', tier: 1, inputs: [['water', 1], ['ash', 1]], req: [], shape: 'cloud', color: '#a8c4d8', desc: '水汽被炉灰托住，在铜口结成一层薄薄的雾。' },
  { id: 'mire', name: '泥沼', tier: 1, inputs: [['water', 2]], req: [], shape: 'mud', color: '#7a7a4a', desc: '雨水与炉底沉泥搅成的一小汪浊绿。' },
  { id: 'soot', name: '炭末', tier: 1, inputs: [['ash', 2]], req: [], shape: 'coal', color: '#6a6068', desc: '筛过三遍的细炭，摸起来像冷掉的星尘。' },
  { id: 'dew', name: '晨露', tier: 1, inputs: [['water', 1], ['mist', 1]], req: ['mist'], shape: 'drop', color: '#8fe8d8', desc: '薄雾凝回的一滴露，带着黎明的凉意。' },
  { id: 'ember', name: '余烬', tier: 1, inputs: [['ash', 1], ['soot', 1]], req: ['soot'], shape: 'flame', color: '#ff8a5c', desc: '炭末里尚未熄灭的一点橘红。' },
  { id: 'lichen', name: '地衣', tier: 1, inputs: [['mire', 1], ['mist', 1]], req: ['mist', 'mire'], shape: 'leaf', color: '#6fbf73', desc: '泥沼边沿攀着的药草地衣，叶背泛银。' },

  // ---- tier 2 (8) ----
  { id: 'vapor', name: '蒸汽', tier: 2, inputs: [['dew', 1], ['water', 1]], req: ['dew'], shape: 'cloud', color: '#c8d8e8', desc: '晨露回炉后的暖白蒸汽，能托起一束光。' },
  { id: 'mudcake', name: '泥饼', tier: 2, inputs: [['mire', 1], ['ember', 1]], req: ['mire', 'ember'], shape: 'mud', color: '#a07a52', desc: '余烬烘干的泥团，敲开有陶土的气味。' },
  { id: 'lye', name: '灰碱', tier: 2, inputs: [['soot', 1], ['dew', 1]], req: ['soot', 'dew'], shape: 'flask', color: '#d8c8a0', desc: '炭末与露水浸出的碱液，指尖会发涩。' },
  { id: 'sprout', name: '药芽', tier: 2, inputs: [['lichen', 1], ['dew', 1]], req: ['lichen'], shape: 'leaf', color: '#8ed86a', desc: '地衣在露水里抽出的嫩芽，苦中回甘。' },
  { id: 'charcoal', name: '精炭', tier: 2, inputs: [['ember', 1], ['soot', 1]], req: ['ember', 'soot'], shape: 'coal', color: '#4a3f48', desc: '余烬压实后得到的硬炭，烧起来几乎没有烟。' },
  { id: 'salt', name: '晶盐', tier: 2, inputs: [['dew', 2]], req: ['dew'], shape: 'crystal', color: '#e8f0f8', desc: '晨露收干后留下的细白晶粒。' },
  { id: 'clay', name: '陶土', tier: 2, inputs: [['mire', 1], ['soot', 1]], req: ['mire'], shape: 'mud', color: '#c07850', desc: '泥沼与炭末揉出的细陶土，手感温润。' },
  { id: 'fog', name: '浓雾', tier: 2, inputs: [['mist', 1], ['vapor', 1]], req: ['mist', 'vapor'], shape: 'cloud', color: '#8a9ab8', desc: '雾与蒸汽交叠，铜勺伸进去只剩一个影子。' },

  // ---- tier 3 (8) ----
  { id: 'tincture', name: '草药酊', tier: 3, inputs: [['sprout', 1], ['lye', 1]], req: ['sprout', 'lye'], shape: 'flask', color: '#7ad8a8', desc: '药芽在灰碱里浸出的绿色药酊。' },
  { id: 'lime', name: '石灰', tier: 3, inputs: [['mudcake', 1], ['ember', 1]], req: ['mudcake', 'ember'], shape: 'powder', color: '#e8e0c8', desc: '泥饼煅烧后的白粉，遇水会发烫。' },
  { id: 'alkali', name: '碱液', tier: 3, inputs: [['lye', 2]], req: ['lye'], shape: 'flask', color: '#b8e0d0', desc: '灰碱提纯两遍，清得能照见铜勺。' },
  { id: 'resin', name: '松脂', tier: 3, inputs: [['charcoal', 1], ['fog', 1]], req: ['charcoal', 'fog'], shape: 'drop', color: '#d8a850', desc: '浓雾凝在精炭上，滴下的金色树胶。' },
  { id: 'glass', name: '玻璃砂', tier: 3, inputs: [['salt', 1], ['charcoal', 1]], req: ['salt', 'charcoal'], shape: 'crystal', color: '#b8e8e0', desc: '晶盐与精炭同烧，得到透亮的玻璃砂。' },
  { id: 'broth', name: '药汤', tier: 3, inputs: [['sprout', 1], ['clay', 1]], req: ['sprout', 'clay'], shape: 'pot', color: '#c8a850', desc: '药芽在陶土罐里熬出的褐色汤底。' },
  { id: 'pigment', name: '铜绿', tier: 3, inputs: [['clay', 1], ['salt', 1]], req: ['clay', 'salt'], shape: 'bottle', color: '#3aa898', desc: '陶土与晶盐闷出的青绿颜料。' },
  { id: 'oil', name: '香精油', tier: 3, inputs: [['vapor', 1], ['lye', 1]], req: ['vapor', 'lye'], shape: 'bottle', color: '#e0c060', desc: '蒸汽带走药性，冷凝成一瓶金色精油。' },

  // ---- tier 4 (6) ----
  { id: 'elixir', name: '药液', tier: 4, inputs: [['tincture', 1], ['broth', 1]], req: ['tincture', 'broth'], shape: 'flask', color: '#7fe0c8', desc: '草药酊与药汤兑成的青碧药液。' },
  { id: 'copper', name: '紫铜锭', tier: 4, inputs: [['pigment', 1], ['lime', 1]], req: ['pigment', 'lime'], shape: 'ingot', color: '#b06a4a', desc: '铜绿与石灰还原出的紫铜锭，断面泛紫。' },
  { id: 'crystal', name: '星盐', tier: 4, inputs: [['glass', 1], ['oil', 1]], req: ['glass', 'oil'], shape: 'crystal', color: '#6fb8ff', desc: '玻璃砂裹着香精油结晶，夜里会微微发蓝。' },
  { id: 'lampoil', name: '灯油', tier: 4, inputs: [['oil', 1], ['resin', 1]], req: ['oil', 'resin'], shape: 'bottle', color: '#ffc860', desc: '香精油与松脂调成的长明灯油。' },
  { id: 'balm', name: '香膏', tier: 4, inputs: [['elixir', 1], ['resin', 1]], req: ['elixir', 'resin'], shape: 'jar', color: '#d8e8a0', desc: '药液收进松脂，凝成一小罐淡金香膏。' },
  { id: 'ink', name: '靛青墨', tier: 4, inputs: [['pigment', 1], ['alkali', 1]], req: ['pigment', 'alkali'], shape: 'bottle', color: '#3a4a9a', desc: '铜绿与碱液调出的深夜靛青，写在纸上像星空。' },

  // ---- tier 5 (5) ----
  { id: 'starsteel', name: '星钢', tier: 5, inputs: [['copper', 1], ['crystal', 1]], req: ['copper', 'crystal'], shape: 'ingot', color: '#8fa8d8', desc: '紫铜与星盐同炼，锤面浮出细碎星纹。' },
  { id: 'moondrop', name: '月露', tier: 5, inputs: [['elixir', 1], ['crystal', 1]], req: ['elixir', 'crystal'], shape: 'drop', color: '#b0d8ff', desc: '药液映着星盐，凝成一滴冷白月露。' },
  { id: 'starlamp', name: '星灯', tier: 5, inputs: [['lampoil', 1], ['glass', 1]], req: ['lampoil', 'glass'], shape: 'lamp', color: '#ffd77a', desc: '灯油封进玻璃砂，一盏不需要灯芯的星灯。' },
  { id: 'bluefire', name: '蓝焰', tier: 5, inputs: [['ink', 1], ['lampoil', 1]], req: ['ink', 'lampoil'], shape: 'flame', color: '#4aa8ff', desc: '靛青墨混入灯油，点燃后是一簇安静的蓝焰。' },
  { id: 'gild', name: '鎏金液', tier: 5, inputs: [['balm', 1], ['copper', 1]], req: ['balm', 'copper'], shape: 'bottle', color: '#ffb850', desc: '香膏化开紫铜，得到能鎏亮铜面的金液。' },

  // ---- tier 6 (3) ----
  { id: 'astral', name: '星辉液', tier: 6, inputs: [['moondrop', 1], ['bluefire', 1]], req: ['moondrop', 'bluefire'], shape: 'orb', color: '#7ad8ff', desc: '月露与蓝焰相拥，液面浮起一条缓慢旋转的银河。' },
  { id: 'core', name: '星辉核心', tier: 6, inputs: [['starsteel', 1], ['gild', 1]], req: ['starsteel', 'gild'], shape: 'orb', color: '#ff9a5c', desc: '星钢以鎏金液封边，核心像一粒被握热的星。' },
  { id: 'crucible', name: '星辉坩埚', tier: 6, inputs: [['core', 1], ['astral', 1]], req: ['core', 'astral'], shape: 'crucible', color: '#c8794a', final: true, allRecipes: true, desc: '以全部配方为火，铸成终局之器。炉火从此不再熄灭。' },
];

export const RECIPE_BY_ID = Object.fromEntries(RECIPES.map(r => [r.id, r]));

// Full item catalogue (base items + every recipe output).
export const ITEMS = { ...BASE_ITEMS };
for (const r of RECIPES) {
  ITEMS[r.id] = {
    id: r.id, name: r.name, glyph: r.name[0], shape: r.shape, color: r.color,
    tier: r.tier, desc: r.desc, recipe: r,
  };
}

export const TIER_LABELS = {
  1: '一阶 · 水解', 2: '二阶 · 蒸馏', 3: '三阶 · 煅烧',
  4: '四阶 · 封装', 5: '五阶 · 化合', 6: '六阶 · 星辉',
};

export const TIER_COLORS = {
  1: '#8ed86a', 2: '#7ad8ff', 3: '#ffc860', 4: '#e0925a', 5: '#c8a0ff', 6: '#ffd77a',
};

// ---------------------------------------------------------------- lines
// level 0 = idle. Effective output = rate * level * (1 + 0.15 * prestige).
export const LINE_DEFS = [
  {
    id: 'gather', name: '采集线', glyph: '采', color: '#8ed86a',
    tag: '淘洗炉灰与雨水',
    out: '+2.4 素材/秒', detail: '不消耗资源；每级还会额外淘出水滴与灰烬',
    cost: (l) => ({ gold: Math.round(20 * Math.pow(1.55, l)) }),
  },
  {
    id: 'distill', name: '蒸馏线', glyph: '蒸', color: '#7ad8ff',
    tag: '以素材熬取精华',
    out: '+0.42 精华/秒', detail: '每级消耗 2.0 素材/秒',
    cost: (l) => ({ gold: Math.round(45 * Math.pow(1.60, l)) }),
  },
  {
    id: 'synth', name: '合成线', glyph: '合', color: '#ffc860',
    tag: '素材与精华炼金',
    out: '+11 金币/秒', detail: '每级消耗 1.1 素材 + 0.26 精华/秒',
    cost: (l) => ({ gold: Math.round(70 * Math.pow(1.58, l)), mat: Math.round(30 * Math.pow(1.40, l)) }),
  },
  {
    id: 'pack', name: '封装线', glyph: '封', color: '#e0925a',
    tag: '精华封瓶出售',
    out: '+24 金币/秒', detail: '每级消耗 0.18 精华/秒',
    cost: (l) => ({ gold: Math.round(110 * Math.pow(1.60, l)), ess: Math.round((2 + 1.5 * l) * 10) / 10 }),
  },
];

export const LINE_RATES = {
  // per second, at level 1
  gatherMat: 2.4,
  distillMat: 2.0,
  distillEss: 0.42,
  synthMat: 1.1,
  synthEss: 0.26,
  synthGold: 11,
  packEss: 0.18,
  packGold: 24,
};

export const PRESTIGE_STEP = 0.15;     // +15% line output per inherited ember

export function productionMul(prestige) {
  return 1 + PRESTIGE_STEP * Math.max(0, prestige | 0);
}

export function isRecipeAvailable(r, discoveredSet) {
  if (!r) return false;
  return r.req.every(id => discoveredSet.has(id));
}

export function recipeInputText(r) {
  if (!r) return '';
  return r.inputs.map(([id, n]) => `${ITEMS[id].name}×${n}`).join(' + ');
}

export function formatNum(v) {
  if (!Number.isFinite(v)) return '0';
  if (Math.abs(v) < 0.005) return '0';
  if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(1) + 'M';
  if (Math.abs(v) >= 1e4) return (v / 1e3).toFixed(1) + 'k';
  if (Math.abs(v) >= 100) return String(Math.floor(v));
  if (Math.abs(v) >= 10) return (Math.floor(v * 10) / 10).toFixed(1);
  if (Math.abs(v) >= 1) return (Math.floor(v * 10) / 10).toFixed(1);
  return (Math.floor(v * 100) / 100).toFixed(2);
}
