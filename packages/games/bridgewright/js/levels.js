// Bridgewright 造桥匠 — level data, material economy and the authored
// "reference truss" for every level.  Every level has a real solution:
// a driveable beam deck plus tension cables / ground pillars whose combined
// cost is always below that level's budget.

export const MATERIALS = {
  beam: {
    key: 'beam', zh: '木梁', short: '梁', digit: '1', glyph: '▬',
    rate: 2.4, k: 2650, zeta: .58, maxForce: 20000,
    color: '#c8894f', color2: '#8d542d',
    desc: '抗压也抗拉 · 铺成桥面',
  },
  cable: {
    key: 'cable', zh: '缆索', short: '索', digit: '2', glyph: '⌁',
    rate: 1.05, k: 2250, zeta: .52, maxForce: 16000, tensionOnly: true,
    color: '#7ad9c6', color2: '#397f7b',
    desc: '仅抗拉 · 轻而便宜',
  },
  pillar: {
    key: 'pillar', zh: '石柱', short: '柱', digit: '3', glyph: '▮',
    rate: 6.2, base: 58, k: 12500, zeta: .85, maxForce: 50000, vertical: true,
    color: '#aeb7c8', color2: '#596378',
    desc: '自地面撑起节点 · 昂贵',
  },
};

export const GROUND_Y = 472;
export const FAIL_Y = 525;
export const MAX_SPAN = 650;
export const CARVE = { wheel: 7 };

export function memberCost(type, len = 0, height = 0) {
  const m = MATERIALS[type];
  if (!m) return Infinity;
  if (m.vertical) return Math.round(m.base + Math.max(0, height) * m.rate);
  return Math.max(1, Math.round(len * m.rate));
}

function costOf(nodes, aId, bId, type) {
  const a = nodes.find(n => n.id === aId);
  if (type === 'pillar') return memberCost(type, 0, GROUND_Y - a.y0);
  const b = nodes.find(n => n.id === bId);
  const len = Math.hypot(b.x0 - a.x0, b.y0 - a.y0);
  return memberCost(type, len, 0);
}

function buildLevel(spec) {
  const nodes = [];
  const add = (n) => {
    nodes.push({
      id: n.id, x: n.x, y: n.y, x0: n.x, y0: n.y,
      fixed: !!n.fixed, kind: n.kind || (n.fixed ? 'anchor' : 'deck'),
      label: n.label || n.id,
    });
    return n;
  };
  add({ id: 'L', x: spec.left, y: spec.deckY, fixed: true, kind: 'anchor', label: '左岸锚' });
  spec.xs.forEach((x, i) => add({ id: 'd' + (i + 1), x, y: spec.deckY + (spec.wave ? Math.sin(i * 1.7) * spec.wave : 0), kind: 'deck', label: '桥面节点' }));
  add({ id: 'R', x: spec.right, y: spec.deckY, fixed: true, kind: 'anchor', label: '右岸锚' });
  const deck = ['L', ...spec.xs.map((_, i) => 'd' + (i + 1)), 'R'];
  (spec.towers || []).forEach(t => add({
    id: t.id, x: t.x, y: t.y, fixed: true, kind: 'tower', label: t.label || '塔架锚',
  }));
  (spec.anchors || []).forEach(t => add({
    id: t.id, x: t.x, y: t.y, fixed: true, kind: 'anchor', label: t.label || '崖壁锚',
  }));

  const solution = [];
  for (let i = 0; i < deck.length - 1; i++) solution.push([deck[i], deck[i + 1], 'beam']);
  for (const e of spec.extra) {
    if (e[2] === 'pillar') solution.push([e[0], null, 'pillar']);
    else solution.push([e[0], e[1], e[2]]);
  }
  let solutionCost = 0;
  for (const [a, b, type] of solution) solutionCost += costOf(nodes, a, b, type);
  const budget = Math.round(solutionCost * spec.budgetFactor / 10) * 10;
  const distance = spec.right - spec.left;
  const par = Math.ceil((distance + 70) / spec.car.speed * 1.12 + 1.2);
  return {
    id: spec.id, index: spec.id, chapter: spec.chapter, name: spec.name,
    subtitle: spec.subtitle, budget, budgetFactor: spec.budgetFactor,
    nodes, deck, groundY: GROUND_Y, failY: FAIL_Y,
    car: { ...spec.car }, par, solutionCost, solution,
    maxSpan: MAX_SPAN, stars: { two: .95, three: .74, budgetLeft: .08 },
  };
}

const L = [];
const add = (o) => L.push(o);

// ================= CHAPTER I · 暮谷初桥 =================
add(buildLevel({
  id: 1, chapter: 1, name: '初渡溪谷', subtitle: '把第一根木梁铺到对岸',
  left: 150, right: 810, deckY: 300, xs: [310, 480, 650],
  towers: [{ id: 'TL', x: 150, y: 168, label: '左塔' }, { id: 'TR', x: 810, y: 168, label: '右塔' }],
  extra: [['TL', 'd1', 'cable'], ['TR', 'd3', 'cable']],
  car: { mass: 2.3, speed: 62 }, budgetFactor: 1.38,
}));
add(buildLevel({
  id: 2, chapter: 1, name: '苔石浅滩', subtitle: '单塔斜索，借力而行',
  left: 135, right: 825, deckY: 318, xs: [268, 402, 536, 670],
  towers: [{ id: 'TL', x: 140, y: 160, label: '左塔' }],
  extra: [['TL', 'd1', 'cable'], ['TL', 'd2', 'cable'], ['TL', 'd3', 'cable']],
  car: { mass: 2.7, speed: 60 }, budgetFactor: 1.32,
}));
add(buildLevel({
  id: 3, chapter: 1, name: '窄脊风门', subtitle: '双塔高悬，缆索交叉',
  left: 158, right: 802, deckY: 286, xs: [320, 480, 640],
  towers: [{ id: 'TL', x: 158, y: 116, label: '高塔' }, { id: 'TR', x: 802, y: 116, label: '高塔' }],
  extra: [['TL', 'd1', 'cable'], ['TL', 'd2', 'cable'], ['TR', 'd2', 'cable'], ['TR', 'd3', 'cable']],
  car: { mass: 3.0, speed: 59 }, budgetFactor: 1.25,
}));
add(buildLevel({
  id: 4, chapter: 1, name: '旧驿渡口', subtitle: '认识石柱：把重量送回大地',
  left: 145, right: 815, deckY: 324, xs: [265, 400, 535, 670],
  towers: [{ id: 'TL', x: 145, y: 178, label: '左塔' }, { id: 'TR', x: 815, y: 178, label: '右塔' }],
  extra: [['TL', 'd1', 'cable'], ['TL', 'd2', 'cable'], ['TR', 'd4', 'cable'], ['d2', null, 'pillar']],
  car: { mass: 3.3, speed: 58 }, budgetFactor: 1.25,
}));
add(buildLevel({
  id: 5, chapter: 1, name: '双塔之弦', subtitle: '长桥多节点，让每根索都有用',
  left: 135, right: 825, deckY: 310, xs: [235, 342, 452, 566, 676],
  towers: [{ id: 'TL', x: 132, y: 148, label: '左塔' }, { id: 'TR', x: 828, y: 148, label: '右塔' }],
  extra: [['TL', 'd1', 'cable'], ['TL', 'd2', 'cable'], ['TR', 'd4', 'cable'], ['TR', 'd5', 'cable'], ['d3', null, 'pillar']],
  car: { mass: 3.6, speed: 57 }, budgetFactor: 1.22,
}));
add(buildLevel({
  id: 6, chapter: 1, name: '暮色长桥', subtitle: '章末重车 · 七跨长虹',
  left: 124, right: 836, deckY: 300, xs: [226, 328, 430, 532, 634, 736],
  towers: [{ id: 'TL', x: 120, y: 138, label: '左塔' }, { id: 'TR', x: 840, y: 138, label: '右塔' }],
  extra: [['TL', 'd1', 'cable'], ['TL', 'd2', 'cable'], ['TR', 'd5', 'cable'], ['TR', 'd4', 'cable'], ['d3', null, 'pillar']],
  car: { mass: 4.0, speed: 56 }, budgetFactor: 1.20,
}));

// ================= CHAPTER II · 风蚀深峡 =================
add(buildLevel({
  id: 7, chapter: 2, name: '风蚀门廊', subtitle: '峡谷收紧，索力开始吃紧',
  left: 170, right: 790, deckY: 272, xs: [292, 412, 532, 652],
  towers: [{ id: 'TL', x: 166, y: 112, label: '左塔' }, { id: 'TR', x: 794, y: 108, label: '右塔' }],
  extra: [['TL', 'd1', 'cable'], ['TL', 'd2', 'cable'], ['TR', 'd3', 'cable'], ['TR', 'd4', 'cable']],
  car: { mass: 4.2, speed: 55 }, budgetFactor: 1.18,
}));
add(buildLevel({
  id: 8, chapter: 2, name: '断崖回响', subtitle: '单侧塔索 + 末端石柱',
  left: 128, right: 832, deckY: 330, xs: [245, 360, 476, 592, 708],
  towers: [{ id: 'TL', x: 124, y: 170, label: '左塔' }],
  extra: [['TL', 'd1', 'cable'], ['TL', 'd2', 'cable'], ['TL', 'd3', 'cable'], ['d4', null, 'pillar'], ['d5', null, 'pillar']],
  car: { mass: 4.6, speed: 54 }, budgetFactor: 1.17,
}));
add(buildLevel({
  id: 9, chapter: 2, name: '月牙索桥', subtitle: '交叉缆索，抵消左右摆荡',
  left: 156, right: 804, deckY: 260, xs: [265, 375, 486, 596, 704],
  towers: [{ id: 'TL', x: 152, y: 94, label: '高塔' }, { id: 'TR', x: 808, y: 94, label: '高塔' }],
  extra: [['TL', 'd1', 'cable'], ['TL', 'd2', 'cable'], ['TR', 'd4', 'cable'], ['TR', 'd5', 'cable'], ['TL', 'd3', 'cable'], ['TR', 'd3', 'cable']],
  car: { mass: 4.9, speed: 58 }, budgetFactor: 1.16,
}));
add(buildLevel({
  id: 10, chapter: 2, name: '千钉峡道', subtitle: '八跨长桥，预算要用在刀刃上',
  left: 118, right: 842, deckY: 316, xs: [220, 322, 424, 526, 628, 730],
  towers: [{ id: 'TL', x: 114, y: 144, label: '左塔' }, { id: 'TR', x: 846, y: 148, label: '右塔' }],
  extra: [['TL', 'd1', 'cable'], ['TL', 'd2', 'cable'], ['TR', 'd5', 'cable'], ['TR', 'd6', 'cable'], ['d3', null, 'pillar'], ['d4', null, 'pillar']],
  car: { mass: 5.2, speed: 56 }, budgetFactor: 1.15,
}));
add(buildLevel({
  id: 11, chapter: 2, name: '悬风耳堂', subtitle: '高塔长索，节点不能下坠',
  left: 164, right: 796, deckY: 292, xs: [270, 376, 482, 588, 694],
  towers: [{ id: 'TL', x: 160, y: 86, label: '高塔' }, { id: 'TR', x: 800, y: 90, label: '高塔' }],
  extra: [['TL', 'd1', 'cable'], ['TL', 'd2', 'cable'], ['TL', 'd3', 'cable'], ['TR', 'd4', 'cable'], ['TR', 'd5', 'cable'], ['d2', null, 'pillar']],
  car: { mass: 5.6, speed: 55 }, budgetFactor: 1.14,
}));
add(buildLevel({
  id: 12, chapter: 2, name: '铁脊关', subtitle: '章末重载 · 双柱压阵',
  left: 112, right: 848, deckY: 306, xs: [216, 320, 424, 528, 632, 736],
  towers: [{ id: 'TL', x: 108, y: 132, label: '铁塔' }, { id: 'TR', x: 852, y: 136, label: '铁塔' }],
  extra: [['TL', 'd1', 'cable'], ['TL', 'd2', 'cable'], ['TR', 'd5', 'cable'], ['TR', 'd6', 'cable'], ['d3', null, 'pillar'], ['d4', null, 'pillar']],
  car: { mass: 6.0, speed: 53 }, budgetFactor: 1.14,
}));

// ================= CHAPTER III · 熔月峡谷 =================
add(buildLevel({
  id: 13, chapter: 3, name: '赤铜门', subtitle: '熔月之下，轻索也要拉满',
  left: 138, right: 822, deckY: 326, xs: [234, 330, 426, 522, 618, 714],
  towers: [{ id: 'TL', x: 134, y: 150, label: '铜塔' }, { id: 'TR', x: 826, y: 146, label: '铜塔' }],
  extra: [['TL', 'd1', 'cable'], ['TL', 'd2', 'cable'], ['TL', 'd3', 'cable'], ['TR', 'd4', 'cable'], ['TR', 'd5', 'cable'], ['TR', 'd6', 'cable'], ['d3', null, 'pillar']],
  car: { mass: 6.4, speed: 54 }, budgetFactor: 1.16,
}));
add(buildLevel({
  id: 14, chapter: 3, name: '星烬深渊', subtitle: '深谷风急，重车碾过每一跨',
  left: 122, right: 838, deckY: 274, xs: [222, 322, 422, 522, 622, 722],
  towers: [{ id: 'TL', x: 118, y: 76, label: '星塔' }, { id: 'TR', x: 842, y: 80, label: '星塔' }],
  extra: [['TL', 'd1', 'cable'], ['TL', 'd2', 'cable'], ['TL', 'd3', 'cable'], ['TR', 'd4', 'cable'], ['TR', 'd5', 'cable'], ['TR', 'd6', 'cable'], ['d2', null, 'pillar'], ['d5', null, 'pillar']],
  car: { mass: 6.8, speed: 55 }, budgetFactor: 1.14,
}));
add(buildLevel({
  id: 15, chapter: 3, name: '回声索道', subtitle: '左右交替受力，别让中心空着',
  left: 150, right: 810, deckY: 300, xs: [244, 338, 432, 526, 620, 714],
  towers: [{ id: 'TL', x: 146, y: 100, label: '左塔' }, { id: 'TR', x: 814, y: 104, label: '右塔' }],
  extra: [['TL', 'd1', 'cable'], ['TL', 'd2', 'cable'], ['TL', 'd3', 'cable'], ['TR', 'd4', 'cable'], ['TR', 'd5', 'cable'], ['TR', 'd6', 'cable'], ['d3', null, 'pillar'], ['d4', null, 'pillar']],
  car: { mass: 7.0, speed: 56 }, budgetFactor: 1.13,
}));
add(buildLevel({
  id: 16, chapter: 3, name: '铜钉长坡', subtitle: '桥面微坡，重车把力压向中段',
  left: 124, right: 836, deckY: 312, xs: [222, 320, 418, 516, 614, 712],
  towers: [{ id: 'TL', x: 120, y: 116, label: '铜塔' }, { id: 'TR', x: 840, y: 120, label: '铜塔' }],
  extra: [['TL', 'd1', 'cable'], ['TL', 'd2', 'cable'], ['TR', 'd5', 'cable'], ['TR', 'd6', 'cable'], ['d2', null, 'pillar'], ['d4', null, 'pillar'], ['d5', null, 'pillar']],
  car: { mass: 7.3, speed: 54 }, budgetFactor: 1.12,
}));
add(buildLevel({
  id: 17, chapter: 3, name: '月蚀悬桥', subtitle: '月蚀将临 · 长索与石柱并重',
  left: 144, right: 816, deckY: 284, xs: [238, 332, 426, 520, 614, 708],
  towers: [{ id: 'TL', x: 140, y: 70, label: '月塔' }, { id: 'TR', x: 820, y: 74, label: '月塔' }],
  extra: [['TL', 'd1', 'cable'], ['TL', 'd2', 'cable'], ['TL', 'd3', 'cable'], ['TR', 'd4', 'cable'], ['TR', 'd5', 'cable'], ['TR', 'd6', 'cable'], ['d2', null, 'pillar'], ['d4', null, 'pillar'], ['d5', null, 'pillar']],
  car: { mass: 7.6, speed: 53 }, budgetFactor: 1.12,
}));
add(buildLevel({
  id: 18, chapter: 3, name: '终渡 · 灯河', subtitle: '最后一车矿石，驶向灯河彼岸',
  left: 114, right: 846, deckY: 296, xs: [218, 322, 426, 530, 634, 738],
  towers: [{ id: 'TL', x: 110, y: 82, label: '灯塔' }, { id: 'TR', x: 850, y: 86, label: '灯塔' }],
  extra: [['TL', 'd1', 'cable'], ['TL', 'd2', 'cable'], ['TL', 'd3', 'cable'], ['TR', 'd4', 'cable'], ['TR', 'd5', 'cable'], ['TR', 'd6', 'cable'], ['d2', null, 'pillar'], ['d3', null, 'pillar'], ['d4', null, 'pillar'], ['d5', null, 'pillar']],
  car: { mass: 8.0, speed: 52 }, budgetFactor: 1.11,
}));

export const LEVELS = L;
export const CHAPTERS = [
  { id: 1, zh: '暮谷初桥', en: 'DUSK VALLEY', range: [1, 6] },
  { id: 2, zh: '风蚀深峡', en: 'WINDWORN GORGE', range: [7, 12] },
  { id: 3, zh: '熔月峡谷', en: 'EMBER MOON RAVINE', range: [13, 18] },
];
export const TOTAL_LEVELS = LEVELS.length;

export function levelByNumber(n) {
  return LEVELS.find(l => l.id === n) || LEVELS[0];
}

export function levelNode(level, id) {
  return level.nodes.find(n => n.id === id);
}
