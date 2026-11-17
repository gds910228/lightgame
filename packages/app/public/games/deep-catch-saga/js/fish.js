// fish.js — 42 fish = 6 depth layers × 7 qualities, quality/economy tables,
// weighted bite pools, fully procedural sprite pre-render (+ dex silhouettes).
// Every fish is parameterized: shape / colors / pattern / fins / glow / extras.

export const LAYERS = [
  { name: '浅滩',   en: 'Shallows',   range: [0, 15],    top: '#83dbef', bot: '#54bfdc' },
  { name: '珊瑚礁', en: 'Coral Reef', range: [15, 40],   top: '#54bfdc', bot: '#2f93ba' },
  { name: '深海礁', en: 'Reef Deep',  range: [40, 80],   top: '#2f93ba', bot: '#20658f' },
  { name: '暮光层', en: 'Twilight',   range: [80, 140],  top: '#20658f', bot: '#1d4469' },
  { name: '午夜带', en: 'Midnight',   range: [140, 220], top: '#1d4469', bot: '#132c4b' },
  { name: '深渊',   en: 'Abyss',      range: [220, 360], top: '#132c4b', bot: '#060e1d' },
];
export const DEPTH_TIERS = [15, 40, 80, 140, 220, 360];

export const QUALITIES = [
  { name: '常见', en: 'Common', color: '#b8c8d4', score: 12,   price: 6 },
  { name: '优良', en: 'Fine',   color: '#7ddc86', score: 30,   price: 14 },
  { name: '稀有', en: 'Rare',   color: '#58b8f0', score: 70,   price: 34 },
  { name: '史诗', en: 'Epic',   color: '#b47cf4', score: 160,  price: 80 },
  { name: '传说', en: 'Legend', color: '#ffb050', score: 380,  price: 190 },
  { name: '神话', en: 'Mythic', color: '#ff70a8', score: 900,  price: 460 },
  { name: '传奇', en: 'Saga',   color: '#ffd44e', score: 2600, price: 1200 },
];

// Reel QTE tempo per quality: struggle/calm seconds, tension rise, reel progress (/s).
// q6 legendary fish: fast-slow alternating special rhythm (handled in stages.js).
export const TEMPO = [
  { s: .70, c: 1.50, rise: 46, prog: 16.5 },
  { s: .80, c: 1.35, rise: 52, prog: 15.5 },
  { s: .95, c: 1.20, rise: 58, prog: 14.5 },
  { s: 1.10, c: 1.05, rise: 64, prog: 13.5 },
  { s: 1.25, c: .95, rise: 72, prog: 12.5 },
  { s: 1.40, c: .85, rise: 80, prog: 11.5 },
  { s: .50, c: .90, rise: 95, prog: 10.5 },
];

const LAYER_KG = [0.4, 1.2, 3.5, 9, 25, 70];
const Q_KG = [1, 1.5, 2.2, 3.2, 4.8, 7, 12];

function niceKg(v) {
  if (v < 1) return Math.round(v * 10) / 10;
  if (v < 20) return Math.round(v * 10) / 10;
  return Math.round(v);
}

function F(layer, q, name, en, shape, len, hue, hue2, belly, pattern, fin, glow, extras = {}, bodyAlpha = 1) {
  const kg = LAYER_KG[layer] * Q_KG[q];
  return {
    id: 'f' + layer + '_' + q, layer, q, name, en, shape, len,
    hue, hue2, belly, pattern, fin, glow, extras, bodyAlpha,
    wMin: niceKg(kg * .55), wMax: niceKg(kg * 1.7),
    score: QUALITIES[q].score, price: QUALITIES[q].price,
  };
}

export const FISH = [
  // ===== 第 0 层 浅滩 0-15m =====
  F(0, 0, '小银鱼', 'Silver Sprat', 'slim', 30, '#c9d9e2', '#8fa8bc', '#f2f8fc', 'hstripe', 'norm', 0),
  F(0, 1, '蓝鳍鲹', 'Bluefin Jack', 'std', 40, '#6fb6e0', '#3d78b8', '#eaf4fa', 'none', 'spiky', 0),
  F(0, 2, '珊瑚蝶鱼', 'Coral Butterfly', 'tall', 42, '#ffd257', '#33334a', '#fff3cc', 'bars', 'flow', 0),
  F(0, 3, '金鳞鲈', 'Gilded Bass', 'std', 48, '#f2b13c', '#c67f1e', '#ffedc0', 'spots', 'spiky', .12),
  F(0, 4, '琉璃鲷', 'Glass Snapper', 'tall', 44, '#7fe8d8', '#38b0a0', '#ecfffb', 'none', 'flow', .4, {}, .82),
  F(0, 5, '七彩斗鱼', 'Prism Betta', 'std', 40, '#ff7bb8', '#66d8ff', '#ffeaf4', 'hstripe', 'flow', .45),
  F(0, 6, '潮汐之王·金冠鲷', 'Tide King', 'std', 78, '#f4c84a', '#a8721c', '#fff2c8', 'mottle', 'spiky', .5, { crown: 1 }),
  // ===== 第 1 层 珊瑚礁 15-40m =====
  F(1, 0, '沙丁鱼', 'Sardine', 'slim', 32, '#a8c0dc', '#7e9ab8', '#eef4fa', 'hstripe', 'norm', 0),
  F(1, 1, '黄尾梅鲷', 'Yellowtail Snapper', 'std', 42, '#c9d8e4', '#e8c33c', '#f8fbfd', 'none', 'norm', 0),
  F(1, 2, '蓝纹神仙', 'Blue Angelfish', 'tall', 46, '#58a8f0', '#2456b8', '#e2f0ff', 'bars', 'flow', .1),
  F(1, 3, '灯笼河鲀', 'Lantern Puffer', 'round', 46, '#f2c96a', '#c08a30', '#fff0c6', 'spots', 'norm', .18, { spike: 1 }),
  F(1, 4, '月影鳐', 'Moonshadow Ray', 'flat', 62, '#cfe0ee', '#8fb0cc', '#f6fbff', 'stars', 'norm', .3),
  F(1, 5, '幻彩鹦嘴鱼', 'Dream Parrotfish', 'std', 46, '#e86ac8', '#3cc898', '#ffe8f6', 'mottle', 'flow', .35),
  F(1, 6, '珊瑚之主·翠玉龙鱼', 'Jade Dragonfish', 'long', 92, '#3ab88a', '#157a58', '#d9fff0', 'glowveins', 'long', .5, { whisker: 1, crown: 1 }),
  // ===== 第 2 层 深海礁 40-80m =====
  F(2, 0, '褐石鲈', 'Gravel Grunter', 'std', 42, '#8a7a64', '#5c5142', '#d2c6b2', 'mottle', 'norm', 0),
  F(2, 1, '墨色鲷', 'Ink Seabream', 'tall', 44, '#5e5470', '#3a3352', '#aca4be', 'none', 'norm', 0),
  F(2, 2, '虎纹笛鲷', 'Tiger Snapper', 'std', 50, '#e8a44c', '#b25e14', '#ffe6bc', 'stripes', 'spiky', 0),
  F(2, 3, '紫电海鳗', 'Violet Moray', 'long', 88, '#8a6ae0', '#5a36ae', '#e4dcff', 'glowveins', 'long', .4),
  F(2, 4, '血珊瑚石斑', 'Blood Coral Grouper', 'std', 56, '#d85a4a', '#8e2820', '#ffd6ca', 'spots', 'spiky', .1),
  F(2, 5, '幽蓝剑旗鱼', 'Azure Swordfish', 'sword', 84, '#56c8f0', '#2874b4', '#e2f6ff', 'neonline', 'spiky', .5),
  F(2, 6, '深礁霸主·玄铁枪鱼', 'Iron Marlin', 'sword', 108, '#7a8ba0', '#42526a', '#cad6e2', 'mottle', 'spiky', .35, { crown: 1 }),
  // ===== 第 3 层 暮光层 80-140m =====
  F(3, 0, '灯眼鱼', 'Lamp-eye Fish', 'std', 38, '#5e7894', '#3a526e', '#baccd8', 'none', 'norm', .2, { lamp: 1 }),
  F(3, 1, '银斧鱼', 'Silver Hatchet', 'tall', 40, '#b6c6d6', '#748ea8', '#f0f8ff', 'hstripe', 'norm', .22),
  F(3, 2, '霓虹灯鱼', 'Neon Tetra', 'slim', 30, '#3cc4e4', '#e84a5e', '#eafaff', 'neonline', 'norm', .5),
  F(3, 3, '幽灵鲑', 'Ghost Salmon', 'std', 50, '#c6d6e2', '#94aec2', '#f6fbff', 'spots', 'norm', .28, {}, .72),
  F(3, 4, '电光鳐', 'Voltray', 'flat', 66, '#66c6ee', '#3a58dd', '#e2f2ff', 'glowveins', 'norm', .5),
  F(3, 5, '巨口吞噬者', 'Gulper Devourer', 'long', 90, '#2c3a56', '#161f38', '#5e7294', 'none', 'long', .22, { bigmouth: 1 }),
  F(3, 6, '暮光之王·鎏金鮟鱇', 'Gilded Angler', 'round', 64, '#e8b44a', '#865a1a', '#ffe8b4', 'spots', 'norm', .55, { lure: 1, crown: 1 }),
  // ===== 第 4 层 午夜带 140-220m =====
  F(4, 0, '星光鲱', 'Star Herring', 'slim', 32, '#48688e', '#2a4266', '#9fc0dc', 'stars', 'norm', .25),
  F(4, 1, '黑眶灯鱼', 'Ringlight Fish', 'std', 40, '#3a5470', '#21334d', '#a6c2da', 'none', 'norm', .3, { lamp: 1 }),
  F(4, 2, '影刃鲭', 'Shadow Blade', 'slim', 44, '#4a5e78', '#28364e', '#a6bace', 'hstripe', 'norm', .18),
  F(4, 3, '熔岩金眼鲷', 'Molten Gilt-head', 'tall', 48, '#7a4226', '#ff9a3a', '#3c2010', 'glowveins', 'spiky', .55),
  F(4, 4, '极光魔魟', 'Aurora Devilray', 'flat', 72, '#56c6be', '#b26ae0', '#e2fbff', 'stars', 'norm', .5),
  F(4, 5, '深海女王·皇带鱼', 'Opal Queen Oarfish', 'long', 104, '#c8d4e2', '#e85a6a', '#f4f8ff', 'hstripe', 'long', .4, { crest: 1 }),
  F(4, 6, '午夜之主·星辉鲲', 'Starveil Kun', 'std', 120, '#2a3c66', '#7ec8ff', '#0f1c38', 'stars', 'flow', .6, { crown: 1, whisker: 1 }),
  // ===== 第 5 层 深渊 220-360m =====
  F(5, 0, '深渊灯笼鱼', 'Abyss Lanternfish', 'round', 36, '#2a3c56', '#152238', '#6e8aa8', 'spots', 'norm', .3, { lamp: 1 }),
  F(5, 1, '深渊狗鳕', 'Abyss Hake', 'std', 44, '#3c4a5e', '#222c3c', '#8ea2b8', 'mottle', 'norm', .08),
  F(5, 2, '暗紫锯鳐', 'Dusk Sawfish', 'sword', 96, '#4a3c6e', '#282046', '#a89ad0', 'none', 'norm', .28, { saw: 1 }),
  F(5, 3, '磷火冥鳗', 'Phosphor Eel', 'long', 94, '#263f38', '#48e2a4', '#0e2c24', 'glowveins', 'long', .6),
  F(5, 4, '虚空吞天鲶', 'Void Gulper Catfish', 'long', 100, '#241e3c', '#5a3cb8', '#cabcf2', 'none', 'long', .4, { whisker: 1, bigmouth: 1 }),
  F(5, 5, '渊海皇·利维坦', 'Leviathan', 'long', 130, '#1e5a5e', '#46e0d6', '#0c302f', 'glowveins', 'long', .55, { crown: 1, whisker: 1 }),
  F(5, 6, '深渊之神·永夜沧龙', 'Evernight God', 'std', 140, '#1a1832', '#8a5cff', '#3a2a6e', 'stars', 'spiky', .75, { crown: 1 }),
];

export const fishIndex = (layer, q) => layer * 7 + q;
export const fishOf = (layer, q) => FISH[fishIndex(layer, q)];

// ---- weighted bite pool (rarity upgrade shifts weights toward rare tiers) ----
const BASE_W = [34, 24, 16, 10, 6.5, 3.5, 1.6];
export function poolWeights(layer, rarityLvl = 0) {
  const L = Math.max(0, Math.min(4, rarityLvl | 0));
  const mult = [
    Math.max(.72, 1 - .07 * L),
    1 + .12 * L, 1 + .24 * L, 1 + .38 * L, 1 + .55 * L, 1 + .8 * L, 1 + 1.1 * L,
  ];
  return BASE_W.map((w, i) => +(w * mult[i]).toFixed(4));
}

export function pickFish(layer, rarityLvl = 0, rng = Math.random) {
  const pool = FISH.filter(f => f.layer === layer);
  const w = poolWeights(layer, rarityLvl);
  let v = rng() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pool.length; i++) { v -= w[i]; if (v <= 0) return pool[i]; }
  return pool[0];
}

export function weightFor(fish, rng = Math.random) {
  return niceKg(fish.wMin + rng() * (fish.wMax - fish.wMin));
}

// ==================== procedural sprite pre-render ====================
const sprites = [], silhouettes = [];
let spriteDPR = 2;

function hexRGB(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mix(hex, amt) {           // amt > 0 lighten toward white, < 0 darken
  const [r, g, b] = hexRGB(hex);
  const t = amt > 0 ? 255 : 0, a = Math.abs(amt);
  const f = c => Math.round(c + (t - c) * a);
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

const SHAPE = {   // rx, ry in a 60-length art space
  slim:  [30, 11], std: [26, 16], tall: [20, 24], round: [22, 20],
  flat:  [29, 15], long: [31, 8], sword: [26, 11],
};

function bodyPath(c, rx, ry, shape) {
  c.beginPath();
  if (shape === 'flat') {
    c.moveTo(rx, 0);
    c.quadraticCurveTo(rx * .25, -ry, -rx * .55, -ry * .75);
    c.quadraticCurveTo(-rx * .95, -ry * .1, -rx * .82, 0);
    c.quadraticCurveTo(-rx * .95, ry * .1, -rx * .55, ry * .75);
    c.quadraticCurveTo(rx * .25, ry, rx, 0);
  } else {
    c.moveTo(rx, 0);
    c.bezierCurveTo(rx * .55, -ry * 1.05, -rx * .35, -ry, -rx * .8, -ry * .36);
    c.lineTo(-rx * .8, ry * .36);
    c.bezierCurveTo(-rx * .35, ry, rx * .55, ry * 1.05, rx, 0);
  }
  c.closePath();
}

function drawFishArt(c, f) {
  const [RX, RY] = SHAPE[f.shape] || SHAPE.std;
  const rx = RX, ry = RY;
  const k = f.len / 60;
  c.save();
  c.scale(k, k);
  if (f.bodyAlpha < 1) c.globalAlpha = f.bodyAlpha;

  const hue = f.hue, hue2 = f.hue2, belly = f.belly;

  // tail (behind body)
  c.fillStyle = mix(hue2, -.12);
  c.beginPath();
  if (f.shape === 'flat') {
    c.moveTo(-rx * .78, 0);
    c.lineTo(-rx - 17, -ry * .22); c.lineTo(-rx - 17, ry * .22);
    c.closePath();
  } else {
    c.moveTo(-rx * .68, 0);
    c.lineTo(-rx - 12, -ry * .8); c.lineTo(-rx * .86, 0);
    c.lineTo(-rx - 12, ry * .8);
    c.closePath();
  }
  c.fill();

  // dorsal fin by style
  c.fillStyle = mix(hue2, -.06);
  c.beginPath();
  if (f.fin === 'flow') {
    c.moveTo(rx * .3, -ry * .8);
    c.quadraticCurveTo(-rx * .1, -ry - 15, -rx * .62, -ry - 6);
    c.quadraticCurveTo(-rx * .45, -ry * .35, -rx * .1, -ry * .7);
    c.closePath();
  } else if (f.fin === 'spiky') {
    for (let i = 0; i < 3; i++) {
      const x0 = rx * (.25 - i * .28);
      c.moveTo(x0 + 7, -ry * .82);
      c.lineTo(x0 - 1, -ry - 8 - (i === 1 ? 3 : 0));
      c.lineTo(x0 - 7, -ry * .78);
      c.closePath();
    }
  } else if (f.fin === 'long') {
    for (let i = 0; i < 5; i++) {
      const x0 = rx * (.35 - i * .3);
      c.moveTo(x0 + 5, -ry * .75);
      c.quadraticCurveTo(x0, -ry - 6, x0 - 6, -ry * .72);
      c.closePath();
    }
  } else {
    c.moveTo(rx * .18, -ry * .85);
    c.lineTo(-rx * .1, -ry - 9);
    c.lineTo(-rx * .34, -ry * .75);
    c.closePath();
  }
  c.fill();

  // sword rostrum / saw nose (before body so body overlaps base)
  if (f.shape === 'sword' || f.extras.saw) {
    const nose = f.extras.saw ? rx + 22 : rx + 15;
    c.fillStyle = mix(hue, -.15);
    c.beginPath();
    c.moveTo(rx * .8, -2);
    c.lineTo(nose, f.extras.saw ? -3 : -1.5);
    c.lineTo(nose, f.extras.saw ? 3 : 1.5);
    c.lineTo(rx * .8, 3);
    c.closePath(); c.fill();
    if (f.extras.saw) {
      c.fillStyle = mix(hue2, .1);
      for (let i = 0; i < 5; i++) {
        const x0 = rx * .85 + i * 4.2;
        c.beginPath(); c.moveTo(x0, 1.5); c.lineTo(x0 + 2, 5.5); c.lineTo(x0 + 4, 1.5); c.closePath(); c.fill();
      }
    }
  }

  // body with glow halo
  if (f.glow > 0) {
    c.save();
    c.shadowColor = hue2; c.shadowBlur = 22 * f.glow;
    c.fillStyle = hue; bodyPath(c, rx, ry, f.shape); c.fill();
    c.restore();
  }
  const g = c.createLinearGradient(0, -ry, 0, ry);
  g.addColorStop(0, mix(hue, .22));
  g.addColorStop(.55, hue);
  g.addColorStop(1, belly);
  c.fillStyle = g;
  bodyPath(c, rx, ry, f.shape); c.fill();
  c.strokeStyle = 'rgba(10,20,30,.28)'; c.lineWidth = 1.6;
  bodyPath(c, rx, ry, f.shape); c.stroke();

  // specular
  c.fillStyle = 'rgba(255,255,255,.32)';
  c.beginPath(); c.ellipse(-rx * .1, -ry * .45, rx * .34, ry * .2, -.12, 0, Math.PI * 2); c.fill();

  // patterns (clipped to body)
  c.save();
  bodyPath(c, rx, ry, f.shape); c.clip();
  switch (f.pattern) {
    case 'hstripe':
      c.strokeStyle = 'rgba(30,50,70,.30)'; c.lineWidth = 2;
      for (let i = -1; i <= 1; i++) {
        c.beginPath(); c.moveTo(-rx, i * ry * .42 + 1); c.lineTo(rx, i * ry * .42 - 1); c.stroke();
      }
      break;
    case 'stripes':
      c.fillStyle = 'rgba(40,24,8,.42)';
      for (let i = 0; i < 4; i++) {
        const x0 = rx * .45 - i * rx * .38;
        c.beginPath();
        c.moveTo(x0 + 5, -ry); c.quadraticCurveTo(x0 - 4, 0, x0 + 5, ry);
        c.lineTo(x0 - 4, ry); c.quadraticCurveTo(x0 - 12, 0, x0 - 4, -ry);
        c.closePath(); c.fill();
      }
      break;
    case 'bars':
      c.fillStyle = 'rgba(24,28,44,.5)';
      for (let i = 0; i < 3; i++) {
        const x0 = rx * .5 - i * rx * .42;
        c.fillRect(x0 - 3.5, -ry, 7, ry * 2);
      }
      break;
    case 'spots':
      c.fillStyle = 'rgba(255,250,235,.4)';
      for (let i = 0; i < 8; i++) {
        const a = i * 2.39, rr = (i % 2 ? .55 : .3) * rx;
        c.beginPath(); c.arc(Math.cos(a) * rr, Math.sin(a) * ry * .5, 2.1, 0, 7); c.fill();
      }
      break;
    case 'mottle':
      c.fillStyle = 'rgba(0,0,0,.14)';
      for (let i = 0; i < 5; i++) {
        const a = i * 1.7 + 1;
        c.beginPath(); c.ellipse(Math.cos(a) * rx * .45, Math.sin(a) * ry * .45, 6.5, 4, a, 0, 7); c.fill();
      }
      c.fillStyle = 'rgba(255,255,255,.14)';
      c.beginPath(); c.ellipse(-rx * .2, ry * .3, 8, 3.4, .3, 0, 7); c.fill();
      break;
    case 'neonline':
      c.save();
      c.shadowColor = hue2; c.shadowBlur = 8;
      c.strokeStyle = hue2; c.lineWidth = 2.4;
      c.beginPath(); c.moveTo(-rx, -ry * .18); c.lineTo(rx, -ry * .22); c.stroke();
      c.strokeStyle = mix(hue2, -.3); c.lineWidth = 1.8;
      c.beginPath(); c.moveTo(-rx, ry * .3); c.lineTo(rx * .7, ry * .26); c.stroke();
      c.restore();
      break;
    case 'glowveins':
      c.save();
      c.shadowColor = hue2; c.shadowBlur = 10;
      c.strokeStyle = hue2; c.lineWidth = 1.6;
      for (let i = 0; i < 3; i++) {
        c.beginPath();
        c.moveTo(-rx * .9, ry * (.3 - i * .35));
        c.quadraticCurveTo(0, ry * (.1 - i * .35) + Math.sin(i * 2) * 4, rx * .85, ry * (.25 - i * .35));
        c.stroke();
      }
      c.restore();
      break;
    case 'stars':
      c.fillStyle = 'rgba(255,255,255,.85)';
      for (let i = 0; i < 9; i++) {
        const a = i * 2.51, x = Math.cos(a) * rx * .6 * ((i % 3) + 1) / 3, y = Math.sin(a * 1.3) * ry * .55;
        c.beginPath();
        c.moveTo(x, y - 1.8); c.lineTo(x + .55, y - .5); c.lineTo(x + 1.8, y); c.lineTo(x + .55, y + .5);
        c.lineTo(x, y + 1.8); c.lineTo(x - .55, y + .5); c.lineTo(x - 1.8, y); c.lineTo(x - .55, y - .5);
        c.closePath(); c.fill();
      }
      break;
  }
  c.restore();

  // pectoral fin
  c.fillStyle = mix(hue2, -.18);
  c.beginPath();
  c.moveTo(rx * .12, ry * .3);
  c.quadraticCurveTo(-rx * .12, ry + 8, -rx * .3, ry * .5);
  c.closePath(); c.fill();

  // extras
  const ex = f.extras || {};
  if (ex.spike) {
    c.fillStyle = mix(hue, -.3);
    for (let i = 0; i < 8; i++) {
      const a = Math.PI * (.15 + i * .09);
      const x = Math.cos(a + Math.PI) * rx * .92, y = Math.sin(a + Math.PI) * ry * .92;
      c.beginPath(); c.moveTo(x * .92, y * .92);
      c.lineTo(x * 1.22, y * 1.22); c.lineTo(x * .88 + 2, y * .88 - 2);
      c.closePath(); c.fill();
    }
  }
  if (ex.crest) {
    c.fillStyle = '#e85a6a';
    for (let i = 0; i < 6; i++) {
      const x0 = rx * .35 - i * rx * .24;
      c.beginPath(); c.moveTo(x0 + 5, -ry * .8);
      c.lineTo(x0, -ry - 8 - (i < 2 ? 4 : 0)); c.lineTo(x0 - 5, -ry * .72);
      c.closePath(); c.fill();
    }
  }
  if (ex.lure) {
    c.strokeStyle = mix(hue2, .2); c.lineWidth = 1.6;
    c.beginPath(); c.moveTo(rx * .4, -ry * .8);
    c.quadraticCurveTo(rx * .85, -ry - 10, rx * 1.1, -ry - 7);
    c.stroke();
    const lb = c.createRadialGradient(rx * 1.1, -ry - 7, 0, rx * 1.1, -ry - 7, 6);
    lb.addColorStop(0, '#fff8cf'); lb.addColorStop(.5, '#ffd24e'); lb.addColorStop(1, 'rgba(255,210,78,0)');
    c.fillStyle = lb;
    c.beginPath(); c.arc(rx * 1.1, -ry - 7, 6, 0, 7); c.fill();
  }
  if (ex.whisker) {
    c.strokeStyle = hue2; c.lineWidth = 1.7; c.lineCap = 'round';
    c.beginPath(); c.moveTo(rx * .72, ry * .3);
    c.quadraticCurveTo(rx * 1.05, ry * .8, rx * .55, ry * 1.5);
    c.stroke();
    c.beginPath(); c.moveTo(rx * .6, ry * .45);
    c.quadraticCurveTo(rx * .85, ry * 1.1, rx * .3, ry * 1.7);
    c.stroke();
  }
  if (ex.bigmouth) {
    c.fillStyle = 'rgba(8,10,18,.78)';
    c.beginPath();
    c.moveTo(rx * .98, -ry * .1);
    c.quadraticCurveTo(rx * .5, ry * .1, rx * .55, ry * .55);
    c.quadraticCurveTo(rx * .9, ry * .5, rx * .98, ry * .18);
    c.closePath(); c.fill();
  }
  if (ex.crown) {
    c.save();
    c.shadowColor = '#ffd44e'; c.shadowBlur = 8;
    c.fillStyle = '#ffd44e'; c.strokeStyle = '#a8721c'; c.lineWidth = 1.2;
    const cx0 = rx * .18, cy0 = -ry - 4, cw = 17, ch = 9;
    c.beginPath();
    c.moveTo(cx0, cy0);
    c.lineTo(cx0, cy0 - ch); c.lineTo(cx0 + cw * .25, cy0 - ch * .45);
    c.lineTo(cx0 + cw * .5, cy0 - ch); c.lineTo(cx0 + cw * .75, cy0 - ch * .45);
    c.lineTo(cx0 + cw, cy0 - ch); c.lineTo(cx0 + cw, cy0);
    c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#ff6f9d';
    c.beginPath(); c.arc(cx0 + cw * .5, cy0 - ch * .45, 1.7, 0, 7); c.fill();
    c.restore();
  }

  // eye (+ lamp halo)
  if (ex.lamp) {
    const lg = c.createRadialGradient(rx * .5, -ry * .3, 0, rx * .5, -ry * .3, 7);
    lg.addColorStop(0, 'rgba(255,240,170,.95)'); lg.addColorStop(1, 'rgba(255,240,170,0)');
    c.fillStyle = lg;
    c.beginPath(); c.arc(rx * .5, -ry * .3, 7, 0, 7); c.fill();
  }
  c.fillStyle = '#f4f8fc';
  c.beginPath(); c.arc(rx * .5, -ry * .28, 3.4, 0, 7); c.fill();
  c.fillStyle = '#101820';
  c.beginPath(); c.arc(rx * .56, -ry * .28, 1.8, 0, 7); c.fill();
  // mouth
  c.strokeStyle = 'rgba(15,25,35,.6)'; c.lineWidth = 1.4; c.lineCap = 'round';
  c.beginPath(); c.arc(rx * .78, ry * .12, 3.4, -.5, 1.1); c.stroke();
  // gill
  c.beginPath(); c.arc(rx * .26, 0, ry * .5, -1.1, 1.1); c.stroke();

  c.restore();
}

export function makeFishSprites(DPR = 2) {
  if (sprites.length) return sprites;
  spriteDPR = Math.max(1.5, Math.min(2, DPR));
  for (const f of FISH) {
    const pad = Math.ceil(f.len * .48 + 16);
    const size = f.len + pad * 2;
    const cv = document.createElement('canvas');
    cv.width = cv.height = Math.ceil(size * spriteDPR);
    const c = cv.getContext('2d');
    c.scale(spriteDPR, spriteDPR);
    c.translate(size / 2, size / 2);
    drawFishArt(c, f);
    sprites.push(cv);
    const sv = document.createElement('canvas');
    sv.width = cv.width; sv.height = cv.height;
    const sc = sv.getContext('2d');
    sc.drawImage(cv, 0, 0);
    sc.globalCompositeOperation = 'source-in';
    sc.fillStyle = 'rgba(14,24,42,.92)';
    sc.fillRect(0, 0, sv.width, sv.height);
    silhouettes.push(sv);
  }
  return sprites;
}

// draw a fish sprite; size approximates body length in px
export function drawFish(ctx, fish, x, y, scale = 1, rot = 0, alpha = 1, flip = false) {
  const idx = fishIndex(fish.layer, fish.q);
  const sp = sprites[idx];
  if (!sp) return;
  const size = sp.width / spriteDPR;
  ctx.save();
  ctx.translate(x, y); ctx.rotate(rot);
  if (flip) ctx.scale(-1, 1);
  ctx.scale(scale, scale);
  ctx.globalAlpha = alpha;
  ctx.drawImage(sp, -size / 2, -size / 2, size, size);
  ctx.restore();
}

export function drawFishSilhouette(ctx, idx, x, y, scale = 1, rot = 0, alpha = 1) {
  const sv = silhouettes[idx];
  if (!sv) return;
  const size = sv.width / spriteDPR;
  ctx.save();
  ctx.translate(x, y); ctx.rotate(rot); ctx.scale(scale, scale);
  ctx.globalAlpha = alpha;
  ctx.drawImage(sv, -size / 2, -size / 2, size, size);
  ctx.restore();
}

// draw a fish into an arbitrary ctx at a fixed box (dex cells / result card)
export function drawFishInBox(c, fish, bx, by, bw, bh, silhouette = false) {
  const idx = fishIndex(fish.layer, fish.q);
  const src = silhouette ? silhouettes[idx] : sprites[idx];
  if (!src) return;
  const size = src.width / spriteDPR;
  const fit = Math.min(bw / size, bh / size);
  c.save();
  c.translate(bx + bw / 2, by + bh / 2);
  c.scale(fit, fit);
  c.drawImage(src, -size / 2, -size / 2, size, size);
  c.restore();
}
