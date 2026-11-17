// Sling Siege 弹弓拆塔记 — 24 hand-designed levels (3 chapters × 8).
// Pure data module (no imports) so it can be validated standalone in node.
//
// Coordinate system: world 1280×720, ground top surface GROUND_Y = 620,
// slingshot anchor (150, 470). All coordinates in px.
//   blocks[i]     = [mat, cx, cy, w, h]          mat: 'wood' | 'stone' | 'glass'
//   enemies[i]    = [type, x, feetY]             type: 'small' | 'medium' | 'large'
//                 feetY = top surface of whatever the enemy stands on
//                 (ground surface = 620)
//   platforms[i]  = [cx, cy, w, h]               static stone geometry
// Every level has an explicit intended solution (see hint), 2-5 enemies,
// ammo budget ≥ par+2 so at least 1 star is always reachable.

export const WORLD = { W: 1280, H: 720, GROUND_Y: 620 };
export const SLING = { x: 150, y: 470 };

export const CHAPTERS = [
  { name: '第一章 · 初试身手', need: 0, from: 1, to: 8 },
  { name: '第二章 · 石堡攻坚', need: 9, from: 9, to: 16 },
  { name: '第三章 · 机关要塞', need: 18, from: 17, to: 24 },
];

export const LEVELS = [
  {
    no: 1, name: '第一座塔', par: 2, ammo: { ball: 4, tnt: 0, tri: 0 },
    blocks: [
      ['glass', 850, 597, 46, 46],
      ['wood', 850, 524, 24, 100],
      ['glass', 1000, 597, 46, 46],
    ],
    enemies: [['small', 850, 474], ['small', 1000, 574]],
    platforms: [],
    hint: '按住弹弓向后拖，松手发射——直击敌人，或射断木柱让塔倒人亡',
  },
  {
    no: 2, name: '双子塔', par: 3, ammo: { ball: 5, tnt: 0, tri: 0 },
    blocks: [
      ['glass', 760, 597, 46, 46], ['wood', 760, 551, 46, 46], ['wood', 760, 505, 46, 46],
      ['wood', 980, 597, 46, 46], ['glass', 980, 551, 46, 46], ['wood', 980, 505, 46, 46],
    ],
    enemies: [['small', 760, 482], ['small', 980, 482]],
    platforms: [],
    hint: '每座塔的敌人都是直击目标，打掉塔腰它们会一起坠落',
  },
  {
    no: 3, name: '玻璃展台', par: 3, ammo: { ball: 4, tnt: 0, tri: 1 },
    blocks: [
      ['glass', 820, 565, 18, 110], ['glass', 920, 565, 18, 110],
      ['wood', 870, 499, 160, 22],
    ],
    enemies: [['medium', 870, 488], ['small', 1050, 620]],
    platforms: [],
    hint: '三连珠可同时打断两根玻璃柱，台上敌人坠落出局，残敌直击',
  },
  {
    no: 4, name: '石墩阵地', par: 3, ammo: { ball: 6, tnt: 1 },
    blocks: [
      ['stone', 900, 597, 46, 46], ['stone', 900, 551, 46, 46], ['wood', 900, 505, 46, 46],
    ],
    enemies: [['medium', 900, 482], ['small', 1010, 620]],
    platforms: [],
    hint: '石块很硬但敌人很脆——塔顶敌人直击两发，地面残敌补一刀',
  },
  {
    no: 5, name: '玻璃穹顶', par: 2, ammo: { ball: 4, tnt: 0, tri: 1 },
    blocks: [
      ['glass', 860, 597, 46, 46], ['glass', 860, 551, 46, 46], ['glass', 860, 505, 46, 46],
    ],
    enemies: [['small', 845, 482], ['small', 877, 482]],
    platforms: [],
    hint: '全玻璃塔一击即碎，三连珠横扫塔身可一串双杀',
  },
  {
    no: 6, name: '长廊断桥', par: 3, ammo: { ball: 5, tnt: 0, tri: 0 },
    blocks: [
      ['wood', 780, 565, 24, 110], ['wood', 1040, 565, 24, 110],
      ['wood', 910, 498, 300, 24],
    ],
    enemies: [['medium', 860, 486], ['small', 990, 486], ['small', 1120, 620]],
    platforms: [],
    hint: '两根木柱都打断，长桥塌落桥上双敌坠亡，再直击地面残敌',
  },
  {
    no: 7, name: '三重门', par: 2, ammo: { ball: 4, tnt: 1 },
    blocks: [
      ['wood', 800, 565, 24, 110], ['wood', 900, 565, 24, 110], ['wood', 1000, 565, 24, 110],
      ['wood', 900, 499, 260, 22],
    ],
    enemies: [['medium', 850, 620], ['small', 950, 620], ['small', 900, 488]],
    platforms: [],
    hint: '把炸药抛进门阵正中，一炸三杀；稳妥打法是逐个直击',
  },
  {
    no: 8, name: '高塔巨敌', par: 3, ammo: { ball: 6, tnt: 1 },
    blocks: [
      ['stone', 880, 597, 46, 46], ['stone', 880, 551, 46, 46],
      ['wood', 830, 478, 24, 100], ['wood', 930, 478, 24, 100],
      ['wood', 880, 416, 200, 24],
    ],
    enemies: [['large', 880, 404], ['medium', 1060, 620]],
    platforms: [],
    hint: '打断两根木柱让高台整个塌落，大块头从高处摔落即死',
  },
  {
    no: 9, name: '石墙暗堡', par: 2, ammo: { ball: 5, tnt: 1 },
    blocks: [
      ['stone', 760, 597, 46, 46], ['stone', 760, 551, 46, 46], ['stone', 760, 505, 46, 46],
      ['wood', 790, 471, 130, 22],
    ],
    enemies: [['small', 790, 460], ['medium', 880, 620]],
    platforms: [],
    hint: '炸药越过墙顶轰进堡内震杀躲藏者，屋顶哨兵直击补刀',
  },
  {
    no: 10, name: '双重堡垒', par: 4, ammo: { ball: 6, tnt: 1 },
    blocks: [
      ['stone', 720, 597, 46, 46], ['stone', 720, 551, 46, 46], ['stone', 720, 505, 46, 46],
      ['glass', 860, 565, 18, 110],
      ['wood', 790, 470, 260, 24],
    ],
    enemies: [['medium', 790, 620], ['small', 790, 458]],
    platforms: [],
    hint: '炸药掀翻木顶棚送走屋顶哨兵，再敲碎玻璃内墙直击躲藏者',
  },
  {
    no: 11, name: '瞭望台', par: 3, ammo: { ball: 5, tnt: 0, tri: 1 },
    blocks: [
      ['glass', 760, 565, 18, 110],
      ['wood', 820, 565, 24, 110], ['wood', 920, 565, 24, 110],
      ['stone', 870, 497, 180, 26],
    ],
    enemies: [['medium', 870, 484], ['small', 1040, 620]],
    platforms: [],
    hint: '两根木柱都打断，石台连人坠地；三连珠也能补刀远处残敌',
  },
  {
    no: 12, name: '石拱棚屋', par: 2, ammo: { ball: 4, tnt: 1 },
    blocks: [
      ['wood', 800, 565, 24, 110], ['wood', 1000, 565, 24, 110],
      ['wood', 900, 498, 320, 24],
    ],
    enemies: [['medium', 900, 620], ['small', 860, 620], ['small', 940, 620]],
    platforms: [],
    hint: '两根柱子打断让整个木棚拍在三名敌人头上，一击全灭',
  },
  {
    no: 13, name: '窄窗箭楼', par: 4, ammo: { ball: 6, tnt: 0, tri: 1 },
    blocks: [
      ['glass', 780, 565, 18, 110], ['glass', 1060, 565, 18, 110],
      ['stone', 920, 597, 46, 46], ['stone', 920, 551, 46, 46], ['wood', 920, 505, 46, 46],
    ],
    enemies: [['small', 810, 620], ['small', 1030, 620], ['medium', 920, 482]],
    platforms: [],
    hint: '三连珠先清两侧玻璃再直击小兵，塔顶中敌抛物线点名',
  },
  {
    no: 14, name: '叠石阶梯', par: 4, ammo: { ball: 5, tnt: 1 },
    blocks: [
      ['stone', 760, 597, 46, 46],
      ['stone', 820, 597, 46, 46], ['stone', 820, 551, 46, 46],
      ['stone', 880, 597, 46, 46], ['stone', 880, 551, 46, 46], ['stone', 880, 505, 46, 46],
    ],
    enemies: [['small', 760, 574], ['medium', 820, 528], ['large', 880, 482]],
    platforms: [],
    hint: '炸药贴脸大块头一击致命，中级直击两发、小兵一发',
  },
  {
    no: 15, name: '玻璃花园', par: 3, ammo: { ball: 4, tnt: 0, tri: 2 },
    blocks: [
      ['glass', 860, 597, 46, 46], ['glass', 920, 597, 46, 46], ['glass', 980, 597, 46, 46],
      ['glass', 890, 551, 46, 46], ['glass', 950, 551, 46, 46], ['glass', 920, 505, 46, 46],
    ],
    enemies: [['small', 920, 482], ['medium', 1080, 620], ['small', 740, 620]],
    platforms: [],
    hint: '珠串扫碎玻璃金字塔塔尖，两个地面残敌逐个直击',
  },
  {
    no: 16, name: '巨堡总攻', par: 5, ammo: { ball: 7, tnt: 2 },
    blocks: [
      ['stone', 720, 597, 46, 46], ['stone', 720, 551, 46, 46], ['stone', 720, 505, 46, 46],
      ['stone', 1120, 597, 46, 46], ['stone', 1120, 551, 46, 46], ['stone', 1120, 505, 46, 46],
      ['wood', 920, 470, 480, 24],
    ],
    enemies: [['medium', 860, 620], ['medium', 980, 620], ['large', 1060, 620]],
    platforms: [],
    hint: '第一发炸药掀顶棚（棚塌压敌），第二发抛入堡内震杀残敌',
  },
  {
    no: 17, name: '高台跷板', par: 2, ammo: { ball: 4, tnt: 0, tri: 0 },
    blocks: [
      ['wood', 940, 555, 24, 130],
      ['wood', 940, 479, 240, 22],
    ],
    enemies: [['small', 860, 468], ['medium', 1030, 468], ['small', 740, 620]],
    platforms: [],
    hint: '射断独柱支点，跷板两头敌人一起坠落；地面小兵直击',
  },
  {
    no: 18, name: '双跷联动', par: 3, ammo: { ball: 5, tnt: 0, tri: 0 },
    blocks: [
      ['wood', 820, 555, 24, 130], ['wood', 820, 479, 200, 22],
      ['wood', 1060, 555, 24, 130], ['wood', 1060, 479, 200, 22],
    ],
    enemies: [['small', 770, 468], ['medium', 870, 468], ['small', 1010, 468], ['small', 1110, 468]],
    platforms: [],
    hint: '两根支点柱各一发，四名敌人分两批从高台坠落',
  },
  {
    no: 19, name: '吊桥哨台', par: 3, ammo: { ball: 5, tnt: 0, tri: 0 },
    blocks: [
      ['wood', 830, 429, 200, 22],
    ],
    enemies: [['small', 900, 418], ['medium', 700, 440]],
    platforms: [[700, 530, 140, 180]],
    hint: '猛击吊板右端把它打滑出石台，桥上哨兵随板坠落；指挥官直击',
  },
  {
    no: 20, name: '一炸三杀', par: 2, ammo: { ball: 4, tnt: 2 },
    blocks: [
      ['stone', 900, 597, 46, 46],
    ],
    enemies: [['medium', 970, 620], ['medium', 1030, 620], ['small', 1090, 620]],
    platforms: [],
    hint: '炸药越过矮墙落入敌窝正中，冲击波一网打尽三人',
  },
  {
    no: 21, name: '石堡深处', par: 3, ammo: { ball: 4, tnt: 2 },
    blocks: [
      ['stone', 900, 597, 46, 46], ['stone', 900, 551, 46, 46], ['stone', 900, 505, 46, 46],
    ],
    enemies: [['large', 960, 620], ['small', 900, 482]],
    platforms: [],
    hint: '炸药越过石墙顶轰在堡内大块头身边，墙顶哨兵直击',
  },
  {
    no: 22, name: '双塔连廊', par: 3, ammo: { ball: 6, tnt: 1, tri: 1 },
    blocks: [
      ['wood', 820, 565, 24, 110], ['wood', 920, 565, 24, 110], ['wood', 870, 498, 180, 24],
      ['wood', 1040, 565, 24, 110], ['wood', 1140, 565, 24, 110], ['wood', 1090, 498, 180, 24],
    ],
    enemies: [['small', 830, 486], ['small', 910, 486], ['medium', 1070, 486], ['small', 1130, 486], ['small', 980, 620]],
    platforms: [],
    hint: '每座塔打断一根柱子即塌，四个高处敌人坠亡，夹缝小兵直击',
  },
  {
    no: 23, name: '王座之室', par: 4, ammo: { ball: 6, tnt: 2 },
    blocks: [
      ['stone', 900, 597, 46, 46], ['stone', 960, 597, 46, 46], ['stone', 1020, 597, 46, 46],
      ['stone', 900, 551, 46, 46], ['stone', 960, 551, 46, 46], ['stone', 1020, 551, 46, 46],
      ['wood', 960, 516, 300, 24],
    ],
    enemies: [['large', 960, 504], ['small', 760, 620], ['medium', 1120, 620]],
    platforms: [],
    hint: '炸药在王座顶棚炸开，大王被炸落或随棚坠落；两侧残敌点名',
  },
  {
    no: 24, name: '要塞终局', par: 4, ammo: { ball: 6, tnt: 2, tri: 1 },
    blocks: [
      ['stone', 720, 597, 46, 46], ['stone', 720, 551, 46, 46], ['stone', 720, 505, 46, 46],
      ['stone', 1140, 597, 46, 46], ['stone', 1140, 551, 46, 46], ['stone', 1140, 505, 46, 46],
      ['wood', 930, 470, 500, 24],
      ['glass', 930, 435, 46, 46],
      ['stone', 930, 597, 46, 46],
    ],
    enemies: [['small', 930, 412], ['medium', 930, 574], ['medium', 1060, 620], ['small', 810, 620]],
    platforms: [],
    hint: '三连珠点掉塔顶玻璃哨兵，炸药掀顶棚压塌堡内，残敌逐个清',
  },
];

// Hidden sandbox used by autotest / dev hooks (never shown in level select).
export const SANDBOX = {
  no: 0, name: '试验场', par: 99, ammo: { ball: 99, tnt: 99, tri: 99 },
  blocks: [], enemies: [], platforms: [], sandbox: true, hint: '',
};
