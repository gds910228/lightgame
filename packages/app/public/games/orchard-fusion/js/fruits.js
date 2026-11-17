// Fruit definitions and pre-rendered sprites.
// 11-tier evolution chain, classic triangular score table, cute procedural faces.

export const FRUITS = [
  { name: '樱桃', en: 'Cherry',   r: 14,  color: '#e8394a', dark: '#a81c2c', leaf: '#4a9e3c' },
  { name: '草莓', en: 'Strawberry', r: 20, color: '#f25767', dark: '#c22e42', leaf: '#54b04a' },
  { name: '葡萄', en: 'Grape',    r: 27,  color: '#9a5cd0', dark: '#6e3aa0', leaf: '#54b04a' },
  { name: '橘子', en: 'Orange',   r: 34,  color: '#ffa63c', dark: '#d97718', leaf: '#5cb84c' },
  { name: '柿子', en: 'Persimmon', r: 42, color: '#ff8a3c', dark: '#cf5a1a', leaf: '#5cb84c' },
  { name: '苹果', en: 'Apple',    r: 51,  color: '#f4524c', dark: '#c22a2a', leaf: '#54b04a' },
  { name: '梨',   en: 'Pear',     r: 61,  color: '#c8e04c', dark: '#96b024', leaf: '#5cb84c' },
  { name: '桃子', en: 'Peach',    r: 72,  color: '#ffb2c0', dark: '#e07a92', leaf: '#54b04a' },
  { name: '菠萝', en: 'Pineapple', r: 84, color: '#ffcf3c', dark: '#d9a218', leaf: '#4a9e3c' },
  { name: '甜瓜', en: 'Melon',    r: 97,  color: '#b8ec8a', dark: '#84c25a', leaf: '#54b04a' },
  { name: '西瓜', en: 'Watermelon', r: 111, color: '#3cb454', dark: '#1e8438', leaf: '#3c8e34' },
];

// Classic triangular score table: 1,3,6,10,15,21,28,36,45,55,66
export const SCORES = FRUITS.map((_, i) => (i + 1) * (i + 2) / 2);

// Spawn pool: only the 5 smallest tiers, weighted.
export const SPAWN_TIERS = [0, 1, 2, 3, 4];
export const SPAWN_WEIGHTS = [30, 26, 20, 14, 10];

export function pickSpawnTier(rng = Math.random) {
  const total = SPAWN_WEIGHTS.reduce((a, b) => a + b, 0);
  let v = rng() * total;
  for (let i = 0; i < SPAWN_WEIGHTS.length; i++) { v -= SPAWN_WEIGHTS[i]; if (v <= 0) return SPAWN_TIERS[i]; }
  return 0;
}

// Pre-render each fruit sprite once at 2x device quality (radius * 2 padding).
const sprites = [];
let spriteDPR = 2;
export function makeSprites(DPR = 2) {
  if (sprites.length) return sprites;
  spriteDPR = DPR;
  for (const f of FRUITS) {
    const pad = 10, size = Math.ceil((f.r * 2 + pad * 2) * DPR);
    const cv = document.createElement('canvas'); cv.width = size; cv.height = size;
    const c = cv.getContext('2d');
    c.scale(DPR, DPR); c.translate(pad + f.r, pad + f.r);
    drawFruitBody(c, f.r, f);
    sprites.push(cv);
  }
  return sprites;
}

function drawFruitBody(c, r, f) {
  // body radial gradient
  const g = c.createRadialGradient(-r * .35, -r * .4, r * .15, 0, 0, r * 1.15);
  g.addColorStop(0, lighten(f.color, .28));
  g.addColorStop(.62, f.color);
  g.addColorStop(1, f.dark);
  c.fillStyle = g;
  c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.fill();

  // subtle rim
  c.strokeStyle = 'rgba(0,0,0,.18)'; c.lineWidth = Math.max(1.2, r * .05);
  c.beginPath(); c.arc(0, 0, r - c.lineWidth / 2, 0, Math.PI * 2); c.stroke();

  // specular highlight
  c.fillStyle = 'rgba(255,255,255,.5)';
  c.beginPath(); c.ellipse(-r * .38, -r * .42, r * .22, r * .13, -.6, 0, Math.PI * 2); c.fill();

  // watermelon stripes
  if (f.en === 'Watermelon') {
    c.strokeStyle = 'rgba(20,80,40,.55)'; c.lineWidth = r * .1;
    for (let i = -2; i <= 2; i++) {
      c.beginPath();
      c.ellipse(0, 0, r * .92, r * .92, 0, (i * .5) - .22 + Math.PI, (i * .5) + .22 + Math.PI);
      c.stroke();
    }
  }
  // strawberry seeds
  if (f.en === 'Strawberry') {
    c.fillStyle = 'rgba(255,240,200,.75)';
    for (let i = 0; i < 7; i++) {
      const a = i * 2.4, rr = r * (.35 + (i % 3) * .16);
      c.beginPath(); c.ellipse(Math.cos(a) * rr, Math.sin(a) * rr, r * .045, r * .07, a, 0, Math.PI * 2); c.fill();
    }
  }

  // cute face (eyes + smile) for charm
  const eye = r * .1, ex = r * .3, ey = r * .05;
  c.strokeStyle = 'rgba(40,20,10,.85)'; c.lineWidth = Math.max(1.4, r * .07); c.lineCap = 'round';
  c.beginPath(); c.arc(-ex, ey, eye, Math.PI * 1.15, Math.PI * 1.95); c.stroke(); // happy closed eyes ∪
  c.beginPath(); c.arc(ex, ey, eye, Math.PI * 1.15, Math.PI * 1.95); c.stroke();
  c.beginPath(); c.arc(0, r * .22, r * .16, Math.PI * .15, Math.PI * .85); c.stroke(); // smile

  // leaf + stem on top
  c.fillStyle = f.leaf;
  c.beginPath();
  c.ellipse(r * .22, -r * .98, r * .3, r * .13, -.5, 0, Math.PI * 2); c.fill();
  c.strokeStyle = '#7a4a20'; c.lineWidth = Math.max(1.4, r * .08);
  c.beginPath(); c.moveTo(0, -r * .92); c.quadraticCurveTo(r * .04, -r * 1.14, r * .1, -r * 1.2); c.stroke();
}

export function drawSprite(c, tier, x, y, r, rot = 0, alpha = 1) {
  const sp = sprites[tier]; if (!sp) return;
  const logical = sp.width / spriteDPR;      // sprite logical size (content pre-scaled by DPR)
  const s = r / FRUITS[tier].r;              // allow visual squash via r mismatch
  c.save(); c.translate(x, y); c.rotate(rot); c.globalAlpha = alpha; c.scale(s, s);
  c.drawImage(sp, -logical / 2, -logical / 2, logical, logical);
  c.restore();
}

function lighten(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, (n >> 16) + Math.round(255 * amt));
  const g = Math.min(255, ((n >> 8) & 255) + Math.round(255 * amt));
  const b = Math.min(255, (n & 255) + Math.round(255 * amt));
  return `rgb(${r},${g},${b})`;
}
