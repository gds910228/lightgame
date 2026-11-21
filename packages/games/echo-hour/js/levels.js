// Echo Hour — 12 hand-authored levels (3 chapters × 4) plus the deterministic
// solution scripts used by the in-page 12-level audit. Geometry is plain data:
// axis-aligned platforms, doors, plates, switches, lasers, crushers, conveyors
// and sliding blockers. No randomness in layout.

export const LEVEL_COUNT = 12;
export const CHAPTERS = [
  { id: 1, name: '铜轴初响', sub: '让回声替你按住过去' },
  { id: 2, name: '倒流回廊', sub: '把机关拨回安全的节拍' },
  { id: 3, name: '双时之门', sub: '影子与倒流并用' },
];

export const MECH_CLASSES = ['plate', 'door', 'switch', 'laser', 'crusher', 'conveyor', 'mover'];

const NAMES = [
  '第一道回声', '光闸之下', '守时的门', '冲压机之息',
  '激光节拍', '逆向传送带', '双压走廊', '滑动石匣',
  '影与光', '定时与滑石', '三重时轴', '双时之门',
];

const FLOOR = 620;

function ground(worldW) {
  return [{ x: 0, y: FLOOR, w: worldW, h: 130, kind: 'ground' }];
}
function ledge(x, y, w) {
  return { x, y, w, h: 16, kind: 'ledge' };
}
function exitAt(worldW) {
  return { x: worldW - 180, y: 470, w: 94, h: 150 };
}

// Each level is authored once. `solution` is a linear bot script executed with
// the real physics, collision and mechanism code by G.auditLevel().
function level(def) {
  const base = {
    id: 0, chapter: 1, name: '', hint: '',
    worldW: 2000, floorY: FLOOR, killY: 820,
    start: { x: 130, y: 588 },
    platforms: [], doors: [], plates: [], switches: [],
    lasers: [], crushers: [], conveyors: [], movers: [],
    spikes: [], collectibles: [], exit: exitAt(2000),
    par: 24, rewindPar: 2, solution: [],
  };
  const l = Object.assign(base, def);
  l.platforms = [...ground(l.worldW), ...(def.platforms || [])];
  l.exit = def.exit || exitAt(l.worldW);
  l.chapterName = CHAPTERS[l.chapter - 1].name;
  l.hint = def.hint || '';
  return l;
}

export const LEVELS = [
  // ---------------- Chapter 1: echo basics ----------------
  level({
    id: 1, chapter: 1, name: NAMES[0], par: 20, rewindPar: 0,
    worldW: 1900,
    hint: '按 E 录制走上压力板，再按 E 停下；影子会循环替你压住铜板。',
    platforms: [ledge(1060, 500, 190)],
    plates: [{ id: 0, x: 560, y: 612, w: 92, h: 8, link: { type: 'door', index: 0 } }],
    doors: [{ id: 0, x: 980, y: 520, w: 26, h: 100, mode: 'hold', plate: 0 }],
    collectibles: [
      { x: 740, y: 578, type: 'hourglass' },
      { x: 1210, y: 452, type: 'star' },
    ],
    spikes: [{ x: 1090, y: 484, w: 60, h: 16 }],
    solution: [
      { a: 'record' }, { a: 'move', x: 606 }, { a: 'wait', t: 1.6 }, { a: 'record' },
      { a: 'move', x: 930 }, { a: 'waitDoor', i: 0 }, { a: 'move', x: 1760 },
    ],
  }),
  level({
    id: 2, chapter: 1, name: NAMES[1], par: 24, rewindPar: 0,
    worldW: 2000,
    hint: '压力板接通时，光闸熄灭。让影子多站一会儿，你才有时间穿过。',
    platforms: [],
    plates: [{ id: 0, x: 600, y: 612, w: 92, h: 8, link: { type: 'laser', index: 0 } }],
    lasers: [
      { x: 980, y: 430, w: 12, h: 190, mode: 'plate', plate: 0 },
      { x: 1220, y: 430, w: 12, h: 190, mode: 'plate', plate: 0 },
    ],
    collectibles: [
      { x: 760, y: 578, type: 'star' },
      { x: 1480, y: 578, type: 'hourglass' },
    ],
    solution: [
      { a: 'record' }, { a: 'move', x: 640 }, { a: 'wait', t: 1.9 }, { a: 'record' },
      { a: 'move', x: 900 }, { a: 'waitLaserOff', i: 0 }, { a: 'move', x: 1260 }, { a: 'move', x: 1860 },
    ],
  }),
  level({
    id: 3, chapter: 1, name: NAMES[2], par: 22, rewindPar: 1,
    worldW: 2100,
    hint: '影子踩上时序开关，铜门会开启数秒。站在门前等它。',
    platforms: [ledge(1430, 500, 170)],
    switches: [{ id: 0, x: 600, y: 612, w: 44, h: 8, link: { type: 'door', index: 0 }, duration: 3.2 }],
    doors: [{ id: 0, x: 1030, y: 510, w: 28, h: 110, mode: 'timer' }],
    collectibles: [
      { x: 780, y: 578, type: 'hourglass' },
      { x: 1500, y: 460, type: 'star' },
    ],
    solution: [
      { a: 'record' }, { a: 'move', x: 615 }, { a: 'wait', t: 0.5 }, { a: 'record' },
      { a: 'move', x: 900 }, { a: 'waitDoor', i: 0 }, { a: 'move', x: 1960 },
    ],
  }),
  level({
    id: 4, chapter: 1, name: NAMES[3], par: 25, rewindPar: 1,
    worldW: 2150,
    hint: '影子压住铜板时，冲压机会悬停在上方。等它抬起再走。',
    platforms: [],
    plates: [{ id: 0, x: 620, y: 612, w: 92, h: 8, link: { type: 'crusher', index: 0 } }],
    crushers: [{ x: 1000, baseY: 400, amp: 120, w: 88, h: 90, period: 2.2, phase: 0.25, plate: 0 }],
    collectibles: [
      { x: 820, y: 578, type: 'star' },
      { x: 1620, y: 578, type: 'hourglass' },
    ],
    solution: [
      { a: 'record' }, { a: 'move', x: 666 }, { a: 'wait', t: 2.0 }, { a: 'record' },
      { a: 'move', x: 900 }, { a: 'waitCrusherUp', i: 0 }, { a: 'move', x: 1600 }, { a: 'move', x: 2010 },
    ],
  }),

  // ---------------- Chapter 2: rewind basics ----------------
  level({
    id: 5, chapter: 2, name: NAMES[4], par: 24, rewindPar: 2,
    worldW: 2150,
    hint: '按住 Q / Shift 倒流，让光闸的节拍回到熄灭的那一刻。',
    platforms: [ledge(1500, 500, 190)],
    lasers: [{ x: 980, y: 430, w: 12, h: 190, mode: 'period', period: 2.6, phase: 0.5, duty: 0.42 }],
    collectibles: [
      { x: 760, y: 578, type: 'hourglass' },
      { x: 1570, y: 460, type: 'star' },
    ],
    solution: [
      { a: 'move', x: 820 }, { a: 'wait', t: 0.5 }, { a: 'rewind', t: 1.0 },
      { a: 'waitLaserOff', i: 0 }, { a: 'move', x: 1250 }, { a: 'move', x: 2010 },
    ],
  }),
  level({
    id: 6, chapter: 2, name: NAMES[5], par: 27, rewindPar: 2,
    worldW: 2200,
    hint: '逆向传送带会把你推回去。倒流到它顺向的相位，再一口气跑过。',
    platforms: [],
    conveyors: [{ x: 760, y: 612, w: 560, h: 8, period: 3.2, phase: 0.6, speed: 360 }],
    collectibles: [
      { x: 600, y: 578, type: 'star' },
      { x: 1480, y: 578, type: 'hourglass' },
    ],
    solution: [
      { a: 'move', x: 700 }, { a: 'wait', t: 0.4 }, { a: 'rewind', t: 1.2 },
      { a: 'waitConveyorFwd', i: 0 }, { a: 'move', x: 1400 }, { a: 'move', x: 2060 },
    ],
  }),
  level({
    id: 7, chapter: 2, name: NAMES[6], par: 25, rewindPar: 2,
    worldW: 2200,
    hint: '两台冲压机交替落下。倒流能把你带回它抬起的瞬间。',
    platforms: [ledge(1600, 500, 190)],
    crushers: [
      { x: 900, baseY: 390, amp: 120, w: 90, h: 90, period: 2.4, phase: 0.0 },
      { x: 1150, baseY: 390, amp: 120, w: 90, h: 90, period: 2.4, phase: 0.5 },
    ],
    collectibles: [
      { x: 780, y: 578, type: 'hourglass' },
      { x: 1640, y: 452, type: 'star' },
    ],
    spikes: [{ x: 1710, y: 484, w: 56, h: 16 }],
    solution: [
      { a: 'move', x: 800 }, { a: 'wait', t: 0.3 }, { a: 'rewind', t: 0.6 },
      { a: 'move', x: 820 }, { a: 'waitCrusherUp', i: 0 }, { a: 'move', x: 1030 },
      { a: 'waitCrusherUp', i: 1 }, { a: 'move', x: 2060 },
    ],
  }),
  level({
    id: 8, chapter: 2, name: NAMES[7], par: 27, rewindPar: 2,
    worldW: 2250,
    hint: '影子压住铜板抬起滑石；倒流则把时序门拨回开合的空窗。',
    platforms: [],
    plates: [{ id: 0, x: 640, y: 612, w: 92, h: 8, link: { type: 'mover', index: 0 } }],
    movers: [{ x: 1040, baseY: 330, amp: 150, w: 70, h: 170, period: 3.4, phase: 0.2, plate: 0 }],
    doors: [{ id: 0, x: 1430, y: 510, w: 28, h: 110, mode: 'period', period: 3.0, phase: 0.0, duty: 0.45 }],
    collectibles: [
      { x: 850, y: 578, type: 'star' },
      { x: 1680, y: 578, type: 'hourglass' },
    ],
    solution: [
      { a: 'record' }, { a: 'move', x: 686 }, { a: 'wait', t: 1.6 }, { a: 'record' },
      { a: 'move', x: 900 }, { a: 'wait', t: 0.5 }, { a: 'rewind', t: 0.8 },
      { a: 'waitMoverUp', i: 0 }, { a: 'move', x: 1200 }, { a: 'waitDoor', i: 0 },
      { a: 'move', x: 1500 }, { a: 'move', x: 2110 },
    ],
  }),

  // ---------------- Chapter 3: both hands ----------------
  level({
    id: 9, chapter: 3, name: NAMES[8], par: 30, rewindPar: 3,
    worldW: 2250,
    hint: '影子按住铜板打开门，你再用倒流压住光闸的节拍。',
    platforms: [],
    plates: [{ id: 0, x: 560, y: 612, w: 92, h: 8, link: { type: 'door', index: 0 } }],
    doors: [{ id: 0, x: 880, y: 510, w: 28, h: 110, mode: 'hold', plate: 0 }],
    lasers: [{ x: 1200, y: 430, w: 12, h: 190, mode: 'period', period: 2.4, phase: 0.3, duty: 0.45 }],
    collectibles: [
      { x: 760, y: 578, type: 'hourglass' },
      { x: 1520, y: 578, type: 'star' },
    ],
    solution: [
      { a: 'record' }, { a: 'move', x: 606 }, { a: 'wait', t: 1.6 }, { a: 'record' },
      { a: 'move', x: 830 }, { a: 'waitDoor', i: 0 }, { a: 'move', x: 1100 },
      { a: 'wait', t: 0.3 }, { a: 'rewind', t: 0.9 }, { a: 'waitLaserOff', i: 0 },
      { a: 'move', x: 1450 }, { a: 'move', x: 2110 },
    ],
  }),
  level({
    id: 10, chapter: 3, name: NAMES[9], par: 30, rewindPar: 3,
    worldW: 2300,
    hint: '影子踩开关，铜门短暂洞开；滑石则以自己的周期升降。',
    platforms: [],
    switches: [{ id: 0, x: 560, y: 612, w: 44, h: 8, link: { type: 'door', index: 0 }, duration: 2.8 }],
    doors: [{ id: 0, x: 900, y: 510, w: 28, h: 110, mode: 'timer' }],
    movers: [{ x: 1320, baseY: 340, amp: 140, w: 70, h: 170, period: 3.0, phase: 0.1 }],
    collectibles: [
      { x: 780, y: 578, type: 'star' },
      { x: 1660, y: 578, type: 'hourglass' },
    ],
    solution: [
      { a: 'record' }, { a: 'move', x: 575 }, { a: 'wait', t: 0.5 }, { a: 'record' },
      { a: 'move', x: 800 }, { a: 'waitDoor', i: 0 }, { a: 'move', x: 1050 },
      { a: 'wait', t: 0.4 }, { a: 'rewind', t: 0.8 }, { a: 'waitMoverUp', i: 0 },
      { a: 'move', x: 1500 }, { a: 'move', x: 2160 },
    ],
  }),
  level({
    id: 11, chapter: 3, name: NAMES[10], par: 32, rewindPar: 3,
    worldW: 2350,
    hint: '影子抬起冲压机；倒流把传送带拨回顺向。两段时间要接上。',
    platforms: [],
    plates: [{ id: 0, x: 580, y: 612, w: 92, h: 8, link: { type: 'crusher', index: 0 } }],
    crushers: [{ x: 880, baseY: 380, amp: 140, w: 88, h: 90, period: 2.0, phase: 0.2, plate: 0 }],
    conveyors: [{ x: 1050, y: 612, w: 520, h: 8, period: 3.0, phase: 0.4, speed: 360 }],
    collectibles: [
      { x: 760, y: 578, type: 'hourglass' },
      { x: 1620, y: 578, type: 'star' },
    ],
    solution: [
      { a: 'record' }, { a: 'move', x: 626 }, { a: 'wait', t: 1.8 }, { a: 'record' },
      { a: 'move', x: 800 }, { a: 'waitCrusherUp', i: 0 }, { a: 'move', x: 1000 },
      { a: 'wait', t: 0.4 }, { a: 'rewind', t: 1.0 }, { a: 'waitConveyorFwd', i: 0 },
      { a: 'move', x: 1650 }, { a: 'move', x: 2210 },
    ],
  }),
  level({
    id: 12, chapter: 3, name: NAMES[11], par: 42, rewindPar: 3,
    worldW: 2500,
    hint: '影子压住光闸，你踩开关开门，再用倒流穿过最后的节拍与冲压。',
    platforms: [ledge(2180, 480, 190)],
    plates: [{ id: 0, x: 560, y: 612, w: 92, h: 8, link: { type: 'laser', index: 0 } }],
    switches: [{ id: 0, x: 1020, y: 612, w: 44, h: 8, link: { type: 'door', index: 0 }, duration: 3.2 }],
    doors: [{ id: 0, x: 1200, y: 510, w: 28, h: 110, mode: 'timer' }],
    lasers: [
      { x: 850, y: 430, w: 12, h: 190, mode: 'plate', plate: 0 },
      { x: 1500, y: 430, w: 12, h: 190, mode: 'period', period: 2.2, phase: 0.7, duty: 0.4 },
    ],
    crushers: [{ x: 1750, baseY: 380, amp: 120, w: 90, h: 90, period: 2.6, phase: 0.2 }],
    collectibles: [
      { x: 760, y: 578, type: 'star' },
      { x: 1660, y: 578, type: 'hourglass' },
      { x: 2225, y: 432, type: 'star' },
    ],
    spikes: [{ x: 2290, y: 464, w: 56, h: 16 }],
    solution: [
      { a: 'record' }, { a: 'move', x: 606 }, { a: 'wait', t: 1.8 }, { a: 'record' },
      { a: 'move', x: 760 }, { a: 'waitLaserOff', i: 0 }, { a: 'move', x: 1040 },
      { a: 'waitDoor', i: 0 }, { a: 'move', x: 1350 }, { a: 'wait', t: 0.3 },
      { a: 'rewind', t: 0.8 }, { a: 'waitLaserOff', i: 1 }, { a: 'move', x: 1650 },
      { a: 'waitCrusherUp', i: 0 }, { a: 'move', x: 2360 },
    ],
  }),
];

export function mechanismClasses(l) {
  const set = new Set();
  if (l.plates.length) set.add('plate');
  if (l.doors.length) set.add('door');
  if (l.switches.length) set.add('switch');
  if (l.lasers.length) set.add('laser');
  if (l.crushers.length) set.add('crusher');
  if (l.conveyors.length) set.add('conveyor');
  if (l.movers.length) set.add('mover');
  return [...set];
}

export function chapterOf(n) {
  return Math.ceil(n / 4);
}

// Deep clone + reset every piece of mutable runtime state.
export function instantiateLevel(n) {
  const idx = Math.max(0, Math.min(LEVEL_COUNT - 1, (n | 0) - 1));
  const src = LEVELS[idx];
  const l = JSON.parse(JSON.stringify({
    ...src,
    solution: src.solution,
  }));
  l.mechT = 0;
  l.plates.forEach(p => { p.pressed = false; p.glow = 0; });
  l.switches.forEach(s => { s.cd = 0; s.prevHit = false; s.flash = 0; s.timer = 0; });
  l.doors.forEach(d => { d.open = false; d.timer = 0; d.anim = 0; });
  l.lasers.forEach(x => { x.on = true; x.flick = 0; });
  l.crushers.forEach(c => { c.y = c.baseY; c.safe = true; });
  l.movers.forEach(m => { m.y = m.baseY; m.safe = true; });
  l.conveyors.forEach(c => { c.dir = 1; });
  l.collectibles.forEach((c, i) => { c.got = false; c.phase = i * 1.7 + idx * 0.9; });
  // no collectible should begin inside the player's spawn pocket
  return l;
}
