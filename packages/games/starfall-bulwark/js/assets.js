// Procedural assets: canvas textures, shared materials, sprite text tags.
// Fallback route per guizang-game-skill assets.md (no external image deps).
import * as THREE from '../vendor/three.module.min.js';

export function rngSeed(seed) { let s = seed >>> 0; return () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

function cv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function tex(c, { repeat = 1, srgb = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// Ground: dark indigo-basalt with speckle + faint crack strokes.
export function groundTex() {
  const [c, g] = cv(256, 256), R = rngSeed(7);
  g.fillStyle = '#14131f'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) {
    const v = 18 + R() * 30;
    g.fillStyle = `rgb(${v | 0},${(v * 0.9) | 0},${(v * 1.35) | 0})`;
    g.fillRect(R() * 256, R() * 256, 1 + R() * 2.4, 1 + R() * 2.4);
  }
  g.strokeStyle = 'rgba(70,60,110,.28)'; g.lineWidth = 1;
  for (let i = 0; i < 26; i++) {
    g.beginPath(); let x = R() * 256, y = R() * 256; g.moveTo(x, y);
    for (let k = 0; k < 5; k++) { x += (R() - .5) * 34; y += (R() - .5) * 34; g.lineTo(x, y); }
    g.stroke();
  }
  return tex(c, { repeat: 6 });
}

// Path stone: dark slate with teal glowing seams (cracked star-road).
export function pathTex() {
  const [c, g] = cv(256, 256), R = rngSeed(21);
  g.fillStyle = '#1c2230'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) { const v = 26 + R() * 22; g.fillStyle = `rgb(${v | 0},${(v + 8) | 0},${(v + 16) | 0})`; g.fillRect(R() * 256, R() * 256, 2 + R() * 3, 2 + R() * 3); }
  g.strokeStyle = 'rgba(90,220,215,.5)'; g.lineWidth = 2; g.lineCap = 'round';
  for (let i = 0; i < 12; i++) {
    g.beginPath(); let x = R() * 256, y = R() * 256; g.moveTo(x, y);
    for (let k = 0; k < 4; k++) { x += (R() - .5) * 50; y += (R() - .5) * 50; g.lineTo(x, y); }
    g.stroke();
  }
  return tex(c, { repeat: 1 });
}

// Radial glow sprite (white center → transparent), tint via material color.
export function glowTex() {
  const [c, g] = cv(128, 128);
  const rg = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(.4, 'rgba(255,255,255,.5)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = rg; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Horizontal streak for projectile trails / beams.
export function streakTex() {
  const [c, g] = cv(128, 32);
  const lg = g.createLinearGradient(0, 0, 128, 0);
  lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(.5, 'rgba(255,255,255,.9)'); lg.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = lg;
  g.shadowColor = 'rgba(255,255,255,.8)'; g.shadowBlur = 8;
  g.fillRect(0, 13, 128, 6);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Shared factory: standard material with optional emissive pulse support.
export function matStd(color, { emissive = 0x000000, ei = 0, rough = .85, metal = .12, flat = true } = {}) {
  const m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, flatShading: flat });
  if (emissive) { m.emissive = new THREE.Color(emissive); m.emissiveIntensity = ei; }
  return m;
}

// Sprite text tag (affix labels / small floating names).
export function textTag(text, { fg = '#ffd77a', bg = 'rgba(30,10,40,.72)', size = 26, pad = 8 } = {}) {
  const [c, g] = cv(4, 4);
  g.font = `${size}px "Microsoft YaHei", sans-serif`;
  const w = Math.ceil(g.measureText(text).width) + pad * 2, h = size + pad * 2;
  c.width = w; c.height = h;
  const g2 = c.getContext('2d');
  g2.font = `${size}px "Microsoft YaHei", sans-serif`;
  g2.fillStyle = bg;
  const r = 6; g2.beginPath(); g2.roundRect(0, 0, w, h, r); g2.fill();
  g2.fillStyle = fg; g2.textAlign = 'center'; g2.textBaseline = 'middle';
  g2.fillText(text, w / 2, h / 2 + 1);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
  sp.scale.set(w / 42, h / 42, 1);
  return sp;
}

// HP bar sprite: two-layer canvas redrawn on demand (cheap, few enemies alive).
export function hpBar() {
  const [c, g] = cv(48, 7);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
  sp.scale.set(.9, .14, 1);
  let last = -1;
  sp.redraw = (frac) => {
    const f = Math.max(0, Math.min(1, frac)), q = Math.round(f * 20);
    if (q === last) return; last = q;
    g.clearRect(0, 0, 48, 7);
    g.fillStyle = 'rgba(8,8,14,.85)'; g.fillRect(0, 0, 48, 7);
    g.fillStyle = f > .5 ? '#6fe08a' : f > .25 ? '#e0b34f' : '#e05252';
    g.fillRect(1, 1, 46 * f, 5);
    t.needsUpdate = true;
  };
  return sp;
}
