// Whisper Heist 声息窃影 — 12 handcrafted stealth layouts (3 chapters × 4).
// Coordinates are in the 960×540 logical playfield. Every map has a solid
// border, a start lane, a lit exit and at least two workable approaches
// (a standing corridor plus one or more crouch-only low-cover windows).

export const VIEW_W = 960;
export const VIEW_H = 540;
export const LEVEL_TIME = 180;

export const CHAPTERS = [
  { id: 1, zh: '第一章 · 纸灯回廊', en: 'Paper Lantern Corridors' },
  { id: 2, zh: '第二章 · 铜锁深院', en: 'Copper-Locked Courtyard' },
  { id: 3, zh: '第三章 · 釉朱密库', en: 'Glaze-Red Vault' },
];

const wall = (x, y, w, h) => ({ x, y, w, h, type: 'wall' });
const low = (x, y, w, h) => ({ x, y, w, h, type: 'low' });
const dark = (x, y, w, h) => ({ x, y, w, h });
const relic = (x, y) => ({ x, y });
const border = () => [wall(0, 0, 960, 16), wall(0, 524, 960, 16), wall(0, 0, 16, 540), wall(944, 0, 16, 540)];

// guard shorthand: type, x, y, facing radians, vision range, half-cone radians
const G = (type, x, y, face, vision, half, extra = {}) => ({ type, x, y, face, vision, half, ...extra });

export const LEVELS = [
  // ---------------- Chapter 1 ----------------
  {
    name: '初更 · 灯影', sub: '一灯如豆，照见檐下暗影',
    start: { x: 64, y: 270 }, exit: { x: 892, y: 244, w: 44, h: 64 }, decoys: 3,
    walls: [
      ...border(),
      wall(340, 168, 280, 14), wall(340, 168, 14, 74), wall(340, 298, 14, 74),
      wall(340, 358, 280, 14), wall(606, 168, 14, 74), wall(606, 298, 14, 74),
      low(296, 244, 44, 50), low(620, 244, 44, 50),
    ],
    dark: [dark(360, 184, 240, 158)],
    relics: [relic(476, 263), relic(780, 452)],
    guards: [
      G('fixed', 474, 263, Math.PI, 210, 0.62),
      G('patrol', 230, 80, 0, 170, 0.55, { path: [[230, 80], [760, 80], [760, 142], [230, 142]], speed: 54 }),
      G('hearing', 818, 452, Math.PI * 1.5, 150, 0.6),
    ],
  },
  {
    name: '双灯巷', sub: '两盏灯之间，必有一条影子',
    start: { x: 64, y: 468 }, exit: { x: 892, y: 236, w: 44, h: 64 }, decoys: 3,
    walls: [
      ...border(),
      wall(16, 220, 544, 14), low(640, 220, 288, 14),
      wall(120, 92, 14, 112), wall(270, 330, 210, 14),
      wall(560, 380, 14, 144), wall(700, 58, 14, 118),
      low(560, 400, 120, 14),
    ],
    dark: [dark(680, 40, 220, 136)],
    relics: [relic(180, 170), relic(820, 440)],
    guards: [
      G('fixed', 600, 176, Math.PI / 2, 190, 0.55),
      G('patrol', 240, 120, 0, 170, 0.55, { path: [[240, 120], [760, 120], [760, 180], [240, 180]], speed: 56 }),
      G('hearing', 380, 440, Math.PI, 150, 0.6),
    ],
  },
  {
    name: '漏窗', sub: '窗纸破了一角，风声也漏了进来',
    start: { x: 64, y: 80 }, exit: { x: 880, y: 448, w: 44, h: 64 }, decoys: 3,
    walls: [
      ...border(),
      wall(16, 300, 314, 14), low(330, 300, 100, 14), wall(470, 300, 90, 14),
      low(638, 300, 100, 14), wall(738, 300, 206, 14),
      wall(240, 380, 14, 80), wall(500, 60, 14, 120),
      wall(60, 410, 140, 14),
    ],
    dark: [dark(600, 356, 240, 140)],
    relics: [relic(820, 200), relic(140, 450)],
    guards: [
      G('fixed', 470, 250, Math.PI / 2, 180, 0.55),
      G('patrol', 120, 180, 0, 165, 0.55, { path: [[120, 180], [800, 180], [800, 240], [120, 240]], speed: 55 }),
      G('hearing', 764, 470, Math.PI, 150, 0.62),
      G('fixed', 140, 356, 0, 150, 0.5),
    ],
  },
  {
    name: '铜环锁', sub: '铜环三重，锁不住一室呼吸',
    start: { x: 64, y: 468 }, exit: { x: 892, y: 250, w: 44, h: 64 }, decoys: 4,
    walls: [
      ...border(),
      wall(330, 150, 300, 14), wall(330, 150, 14, 90), wall(330, 300, 14, 90),
      wall(330, 390, 300, 14), wall(616, 150, 14, 90), wall(616, 300, 14, 90),
      low(282, 238, 48, 54), low(634, 238, 48, 54),
    ],
    dark: [dark(350, 164, 246, 212)],
    relics: [relic(480, 255), relic(168, 170), relic(820, 440)],
    guards: [
      G('fixed', 474, 255, Math.PI, 210, 0.6),
      G('patrol', 120, 80, 0, 170, 0.55, { path: [[120, 80], [800, 80], [800, 122], [120, 122]], speed: 58 }),
      G('hearing', 780, 448, Math.PI, 160, 0.62),
      G('patrol', 160, 470, Math.PI, 165, 0.55, { path: [[160, 470], [700, 470], [700, 424], [160, 424]], speed: 50 }),
    ],
  },

  // ---------------- Chapter 2 ----------------
  {
    name: '月门', sub: '月洞门里，灯影走在人之前',
    start: { x: 64, y: 60 }, exit: { x: 892, y: 448, w: 44, h: 64 }, decoys: 4,
    walls: [
      ...border(),
      wall(320, 16, 14, 150), wall(320, 236, 14, 148), low(320, 384, 14, 60), wall(320, 444, 14, 80),
      wall(650, 16, 14, 120), low(650, 136, 14, 60), wall(650, 196, 14, 140),
      wall(650, 400, 14, 124),
      wall(80, 300, 140, 14), wall(760, 300, 140, 14), wall(430, 120, 160, 14),
    ],
    dark: [dark(60, 340, 200, 150), dark(700, 40, 180, 120)],
    relics: [relic(180, 440), relic(520, 160), relic(820, 200)],
    guards: [
      G('patrol', 120, 100, 0, 170, 0.55, { path: [[120, 100], [284, 100], [284, 420], [120, 420]], speed: 55 }),
      G('fixed', 420, 210, Math.PI / 2, 190, 0.58),
      G('patrol', 700, 240, 0, 170, 0.55, { path: [[700, 240], [880, 240], [880, 380], [700, 380]], speed: 52 }),
      G('hearing', 540, 300, Math.PI, 150, 0.6),
    ],
  },
  {
    name: '回字廊', sub: '绕不出的回廊，绕不开的目光',
    start: { x: 64, y: 270 }, exit: { x: 892, y: 244, w: 44, h: 60 }, decoys: 4,
    walls: [
      ...border(),
      wall(370, 170, 220, 200),
      wall(150, 80, 180, 14), wall(630, 80, 180, 14),
      wall(150, 450, 180, 14), wall(630, 450, 180, 14),
    ],
    dark: [],
    relics: [relic(170, 170), relic(790, 170), relic(480, 455)],
    guards: [
      G('fixed', 480, 130, Math.PI / 2, 190, 0.58),
      G('fixed', 480, 440, -Math.PI / 2, 185, 0.58),
      G('patrol', 240, 116, 0, 175, 0.55, { path: [[240, 116], [720, 116], [720, 440], [240, 440]], speed: 58 }),
      G('hearing', 800, 270, Math.PI, 155, 0.62),
    ],
  },
  {
    name: '碎瓦', sub: '碎瓦之下，一步一声',
    start: { x: 64, y: 460 }, exit: { x: 892, y: 440, w: 44, h: 64 }, decoys: 4,
    walls: [
      ...border(),
      wall(180, 120, 180, 14), low(180, 180, 180, 14), wall(180, 240, 120, 14),
      wall(560, 120, 14, 160), low(560, 280, 14, 70), wall(560, 350, 14, 100),
      wall(700, 300, 180, 14), low(720, 180, 140, 14), wall(780, 380, 80, 14),
      wall(300, 380, 200, 14),
    ],
    dark: [dark(620, 40, 200, 100), dark(60, 300, 160, 140)],
    relics: [relic(150, 170), relic(800, 215), relic(500, 440)],
    guards: [
      G('hearing', 480, 180, Math.PI, 165, 0.65),
      G('patrol', 300, 60, 0, 170, 0.55, { path: [[300, 60], [800, 60], [800, 230], [300, 230]], speed: 55 }),
      G('fixed', 700, 420, Math.PI, 170, 0.55),
      G('hearing', 260, 300, 0, 150, 0.6),
    ],
  },
  {
    name: '铜锁深院', sub: '深院铜锁，锁着三只密匣',
    start: { x: 64, y: 468 }, exit: { x: 892, y: 240, w: 44, h: 60 }, decoys: 5,
    walls: [
      ...border(),
      wall(140, 150, 220, 14), wall(140, 150, 14, 100), wall(346, 150, 14, 100),
      wall(600, 350, 220, 14), wall(600, 350, 14, 100), wall(806, 350, 14, 100),
      wall(400, 240, 160, 14), wall(400, 326, 160, 14),
      low(360, 234, 40, 50), low(562, 234, 40, 50),
    ],
    dark: [dark(160, 164, 200, 110), dark(620, 240, 200, 100)],
    relics: [relic(250, 230), relic(720, 430), relic(480, 280)],
    guards: [
      G('fixed', 480, 280, Math.PI, 200, 0.6),
      G('patrol', 120, 80, 0, 172, 0.55, { path: [[120, 80], [840, 80], [840, 140], [120, 140]], speed: 58 }),
      G('hearing', 700, 460, Math.PI, 160, 0.62),
      G('patrol', 500, 440, Math.PI, 168, 0.55, { path: [[500, 440], [840, 440], [840, 320], [500, 320]], speed: 55 }),
    ],
  },

  // ---------------- Chapter 3 ----------------
  {
    name: '釉朱库', sub: '釉朱匣里，听得见心跳',
    start: { x: 64, y: 270 }, exit: { x: 892, y: 440, w: 44, h: 64 }, decoys: 5,
    walls: [
      ...border(),
      wall(300, 120, 360, 14), wall(300, 120, 14, 100), wall(300, 300, 14, 100),
      wall(300, 400, 360, 14), wall(646, 120, 14, 100), wall(646, 300, 14, 100),
      low(254, 214, 46, 56), low(660, 214, 46, 56),
      low(420, 210, 120, 14),
    ],
    dark: [dark(320, 140, 306, 250)],
    relics: [relic(480, 260), relic(150, 450), relic(860, 200)],
    guards: [
      G('fixed', 520, 262, Math.PI, 220, 0.62),
      G('patrol', 120, 90, 0, 175, 0.55, { path: [[120, 90], [880, 90], [880, 160], [120, 160]], speed: 60 }),
      G('hearing', 800, 320, Math.PI, 160, 0.65),
      G('fixed', 500, 470, Math.PI, 180, 0.55),
      G('patrol', 620, 470, Math.PI, 175, 0.55, { path: [[620, 470], [880, 470], [880, 390], [620, 390]], speed: 58 }),
    ],
  },
  {
    name: '影匣', sub: '影子里没有光，却有耳朵',
    start: { x: 64, y: 460 }, exit: { x: 892, y: 250, w: 44, h: 64 }, decoys: 5,
    walls: [
      ...border(),
      wall(200, 150, 14, 240), low(200, 390, 14, 60),
      wall(480, 100, 14, 180), low(480, 280, 14, 70), wall(480, 350, 14, 100),
      wall(760, 160, 14, 220), low(760, 380, 14, 70),
      wall(300, 150, 120, 14), wall(600, 350, 120, 14), wall(300, 300, 100, 14),
    ],
    dark: [dark(60, 180, 120, 200), dark(250, 60, 200, 80), dark(520, 180, 220, 140), dark(800, 300, 120, 200)],
    relics: [relic(150, 170), relic(820, 200), relic(500, 460)],
    guards: [
      G('hearing', 300, 250, 0, 175, 0.65),
      G('patrol', 250, 120, 0, 170, 0.55, { path: [[250, 120], [440, 120], [440, 280], [250, 280]], speed: 55 }),
      G('hearing', 700, 250, Math.PI, 165, 0.62),
      G('patrol', 300, 430, 0, 175, 0.55, { path: [[300, 430], [700, 430], [700, 360], [300, 360]], speed: 58 }),
      G('fixed', 820, 120, Math.PI / 2, 180, 0.55),
    ],
  },
  {
    name: '双面厅', sub: '两面厅堂，两扇门，只能选一边',
    start: { x: 64, y: 80 }, exit: { x: 892, y: 460, w: 44, h: 64 }, decoys: 5,
    walls: [
      ...border(),
      wall(320, 140, 320, 14), wall(320, 140, 14, 110), wall(320, 300, 14, 110),
      wall(320, 396, 320, 14), wall(626, 140, 14, 110), wall(626, 300, 14, 110),
      low(280, 248, 40, 54), low(640, 248, 40, 54),
      wall(150, 200, 120, 14), wall(700, 350, 120, 14), wall(60, 320, 120, 14),
    ],
    dark: [dark(340, 154, 266, 228), dark(700, 60, 160, 100)],
    relics: [relic(480, 260), relic(160, 440), relic(820, 210)],
    guards: [
      G('fixed', 480, 250, 0, 205, 0.6),
      G('hearing', 480, 320, Math.PI, 180, 0.6),
      G('patrol', 120, 90, 0, 175, 0.55, { path: [[120, 90], [860, 90], [860, 150], [120, 150]], speed: 60 }),
      G('patrol', 180, 470, Math.PI, 175, 0.55, { path: [[180, 470], [840, 470], [840, 410], [180, 410]], speed: 58 }),
    ],
  },
  {
    name: '无声终局', sub: '最后一只匣子，连呼吸都要藏好',
    start: { x: 64, y: 270 }, exit: { x: 892, y: 270, w: 44, h: 60 }, decoys: 6,
    walls: [
      ...border(),
      wall(400, 100, 160, 14), wall(400, 100, 14, 120), wall(400, 300, 14, 120),
      wall(400, 406, 160, 14), wall(560, 100, 14, 120), wall(560, 300, 14, 120),
      wall(200, 60, 14, 160), low(200, 220, 14, 60), wall(200, 280, 14, 180),
      wall(760, 60, 14, 160), low(760, 220, 14, 60), wall(760, 280, 14, 180),
      wall(300, 470, 360, 14),
    ],
    dark: [dark(220, 80, 160, 120), dark(600, 360, 160, 120), dark(420, 130, 120, 80)],
    relics: [relic(140, 180), relic(820, 440), relic(480, 240), relic(480, 502)],
    guards: [
      G('fixed', 480, 220, Math.PI, 200, 0.6),
      G('patrol', 120, 80, 0, 180, 0.55, { path: [[120, 80], [840, 80], [840, 180], [120, 180]], speed: 62 }),
      G('hearing', 820, 320, Math.PI, 170, 0.62),
      G('patrol', 120, 410, 0, 175, 0.55, { path: [[120, 410], [700, 410], [700, 360], [120, 360]], speed: 56 }),
      G('fixed', 350, 505, 0, 170, 0.55),
    ],
  },
];

export const TOTAL_LEVELS = LEVELS.length;

export function cloneLevel(i) {
  const lv = LEVELS[i];
  if (!lv) return null;
  return JSON.parse(JSON.stringify(lv));
}
