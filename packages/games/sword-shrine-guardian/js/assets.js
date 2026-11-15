// Procedural assets: canvas-painted textures, materials, shared geometries. No external files.
import * as THREE from '../vendor/three.module.min.js';

export const rngSeed = (s) => () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;

function cv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
export function tex(canvas, { repeat = 1, srgb = true } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4; return t;
}

// --- stone slab ground: slabs with tint variance, cracks, grit ---
export function groundTex() {
  const S = 512, c = cv(S, S), g = c.getContext('2d'), R = rngSeed(7);
  g.fillStyle = '#3a4150'; g.fillRect(0, 0, S, S);
  const cell = 128;
  for (let y = 0; y < S; y += cell) for (let x = 0; x < S; x += cell) {
    const v = 62 + R() * 34 | 0;
    g.fillStyle = `rgb(${v},${v + 5},${v + 16})`;
    g.fillRect(x + 2, y + 2, cell - 4, cell - 4);
    g.strokeStyle = 'rgba(14,17,24,.9)'; g.lineWidth = 3; g.strokeRect(x + 2, y + 2, cell - 4, cell - 4);
    for (let i = 0; i < 26; i++) { const p = R() * 70 | 0; g.fillStyle = `rgba(${p},${p + 6},${p + 16},.3)`; g.fillRect(x + R() * cell, y + R() * cell, 2 + R() * 5, 2 + R() * 5); }
    if (R() < .6) { g.strokeStyle = 'rgba(16,19,26,.7)'; g.lineWidth = 1.4; g.beginPath(); let px = x + R() * cell, py = y + R() * cell; g.moveTo(px, py); for (let i = 0; i < 4; i++) { px += (R() - .5) * 46; py += (R() - .5) * 46; g.lineTo(px, py); } g.stroke(); }
  }
  for (let i = 0; i < 380; i++) { const p = R() * 90 | 0; g.fillStyle = `rgba(${p},${p + 6},${p + 18},.25)`; g.fillRect(R() * S, R() * S, 1 + R() * 3, 1 + R() * 3); }
  return tex(c, { repeat: 7 });
}

// --- radial soft glow sprite (particles, lanterns, loot) ---
export function glowTex(color = '255,190,120') {
  const S = 128, c = cv(S, S), g = c.getContext('2d');
  const gr = g.createRadialGradient(S / 2, S / 2, 2, S / 2, S / 2, S / 2);
  gr.addColorStop(0, `rgba(${color},1)`); gr.addColorStop(.25, `rgba(${color},.55)`); gr.addColorStop(1, `rgba(${color},0)`);
  g.fillStyle = gr; g.fillRect(0, 0, S, S);
  return tex(c);
}

// --- streak streak (sparks / slash droplets) ---
export function streakTex() {
  const S = 64, c = cv(S, S), g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, S, 0);
  gr.addColorStop(0, 'rgba(255,240,220,0)'); gr.addColorStop(.5, 'rgba(255,230,200,.9)'); gr.addColorStop(1, 'rgba(255,250,240,0)');
  g.fillStyle = gr; g.fillRect(0, S / 2 - 3, S, 6);
  return tex(c);
}

// --- noise texture for shader erosion / stripes ---
export function noiseTex() {
  const S = 256, c = cv(S, S), g = c.getContext('2d'), img = g.createImageData(S, S), R = rngSeed(31);
  for (let i = 0; i < img.data.length; i += 4) { const v = R() * 255 | 0; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
  g.putImageData(img, 0, 0);
  return tex(c, { repeat: 1, srgb: false });
}

// --- star field sky texture (equirect-ish gradient + stars drawn in shader instead; this is the gradient) ---
export function skyMat() {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {},
    vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
    fragmentShader: `varying vec3 vP;
      void main(){
        float h = normalize(vP).y;
        vec3 top = vec3(.012,.02,.05);
        vec3 hor = vec3(.07,.10,.16);
        vec3 bot = vec3(.02,.03,.05);
        vec3 col = h > 0. ? mix(hor, top, pow(clamp(h,0.,1.), .55)) : mix(hor, bot, clamp(-h,0.,1.)*.8);
        // faint moon glow band
        col += vec3(.10,.12,.14) * pow(max(0., 1. - abs(h - .52) * 4.2), 3.0);
        gl_FragColor = vec4(col, 1.);
      }`
  });
}

// --- materials ---
export const mats = {
  stone: null, stoneDark: null, ground: null,
  init() {
    this.ground = new THREE.MeshStandardMaterial({ map: groundTex(), roughness: .92, metalness: .05, color: 0xb8bcc8 });
    this.stone = new THREE.MeshStandardMaterial({ color: 0x626a78, roughness: .88, metalness: .08, flatShading: true });
    this.stoneDark = new THREE.MeshStandardMaterial({ color: 0x3a4050, roughness: .95, metalness: .05, flatShading: true });
    this.rock = new THREE.MeshStandardMaterial({ color: 0x4a5162, roughness: .95, flatShading: true });
    this.lantern = new THREE.MeshStandardMaterial({ color: 0x8b8578, roughness: .85, flatShading: true });
    this.lanternGlow = new THREE.MeshStandardMaterial({ color: 0xffc984, emissive: 0xff9a3c, emissiveIntensity: 2.2, roughness: .6 });
    this.swordBlade = new THREE.MeshStandardMaterial({ color: 0xcfd6e4, emissive: 0x8fd8ff, emissiveIntensity: .5, roughness: .22, metalness: .85, flatShading: true });
    this.swordGuard = new THREE.MeshStandardMaterial({ color: 0x8a7448, roughness: .4, metalness: .8, flatShading: true });
    this.altarGlow = new THREE.MeshStandardMaterial({ color: 0x9fe8ff, emissive: 0x5cc8ff, emissiveIntensity: 1.5, roughness: .4 });
  }
};

// --- arena walkable radius with noise edge ---
export const ARENA = { R: 26, edge(a) { return this.R * (1 + .10 * Math.sin(3 * a) + .06 * Math.sin(7 * a + 1.7)); } };
export function walkable(x, z, pad = 0) {
  const r = Math.hypot(x, z); if (r > ARENA.edge(Math.atan2(z, x)) - pad) return false;
  return true;
}
export function clampToArena(p, pad = 0.6) {
  const r = Math.hypot(p.x, p.z), a = Math.atan2(p.z, p.x), max = ARENA.edge(a) - pad;
  if (r > max) { p.x *= max / r; p.z *= max / r; return true; }
  return false;
}

// --- colliders: keep spacing wide so circles never form concave traps (skill: combat-feel 场地) ---
export function makeColliders() {
  const cols = [];
  const add = (x, z, r) => cols.push({ x, z, r });
  add(0, -7.5, 3.1);                                   // altar dais
  for (let i = 0; i < 4; i++) { const a = Math.PI / 4 + i * Math.PI / 2 + .18; add(Math.cos(a) * 13.5, Math.sin(a) * 13.5, 1.15); } // pillars
  add(-8, 3.5, .8); add(9, 5.2, .9); add(5, -13, .8);  // lanterns (thin posts)
  add(-13, 6, 1.7); add(12, -4, 1.6); add(-6, -16, 1.5); add(7, 13, 1.6); add(-16, -3, 1.4); // rocks
  add(-2.6, -21.6, 1.0); add(2.6, -21.6, 1.0);         // gate posts
  return cols;
}

// resolve circle collisions + arena boundary; returns true if position was corrected
export function resolveCollisions(pos, radius, colliders) {
  let hit = false;
  for (const c of colliders) {
    const dx = pos.x - c.x, dz = pos.z - c.z, rr = radius + c.r, d2 = dx * dx + dz * dz;
    if (d2 < rr * rr && d2 > 1e-9) {
      const d = Math.sqrt(d2); pos.x = c.x + dx / d * rr; pos.z = c.z + dz / d * rr; hit = true;
    }
  }
  if (clampToArena(pos, radius + .5)) hit = true;
  return hit;
}

// --- prop builders (all flat-shaded primitives) ---
function jitterGeo(geo, amt, seed = 5) {
  const p = geo.attributes.position, R = rngSeed(seed);
  for (let i = 0; i < p.count; i++) {
    p.setXYZ(i, p.getX(i) * (1 + (R() - .5) * amt), p.getY(i) * (1 + (R() - .5) * amt), p.getZ(i) * (1 + (R() - .5) * amt));
  }
  geo.computeVertexNormals(); return geo;
}

export function buildProps(scene) {
  const props = { occluders: [] };
  const grp = new THREE.Group(); scene.add(grp); props.group = grp;
  const M = (geo, mat, x, y, z, ry = 0, s = 1) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.y = ry; m.scale.setScalar(s); m.castShadow = m.receiveShadow = true; grp.add(m); return m; };
  // altar: dais + broken greatsword + glow
  const dais = new THREE.Mesh(jitterGeo(new THREE.CylinderGeometry(3.1, 3.4, .5, 9), .04), mats.stone);
  dais.position.set(0, .25, -7.5); dais.receiveShadow = true; grp.add(dais);
  const dais2 = new THREE.Mesh(jitterGeo(new THREE.CylinderGeometry(2.1, 2.45, .5, 9), .04), mats.stoneDark);
  dais2.position.set(0, .72, -7.5); dais2.receiveShadow = true; grp.add(dais2);
  const blade = new THREE.Mesh(jitterGeo(new THREE.BoxGeometry(.5, 4.6, .12), .06, 9), mats.swordBlade);
  blade.position.set(0, 3.3, -7.5); blade.rotation.z = .16; blade.castShadow = true; grp.add(blade);
  const guard = new THREE.Mesh(new THREE.BoxGeometry(1.3, .18, .3), mats.swordGuard);
  guard.position.set(0, 1.6, -7.5); guard.rotation.z = .16; grp.add(guard);
  const glowSpr = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex('120,210,255'), transparent: true, opacity: .5, blending: THREE.AdditiveBlending, depthWrite: false }));
  glowSpr.scale.set(3.4, 3.4, 1); glowSpr.position.set(0, .95, -7.5); grp.add(glowSpr);
  // broken pillars (occluders, tall)
  const pg = jitterGeo(new THREE.CylinderGeometry(.85, 1.0, 5.6, 8), .05);
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + i * Math.PI / 2 + .18, x = Math.cos(a) * 13.5, z = Math.sin(a) * 13.5;
    const h = 3.4 + (i % 2) * 1.8, p = new THREE.Mesh(pg, mats.stone);
    p.position.set(x, h / 2, z); p.scale.y = h / 5.6; p.rotation.y = R0(i); p.castShadow = p.receiveShadow = true; grp.add(p);
    props.occluders.push({ x, z, r: 1.5, mesh: p });
  }
  // stone lanterns with warm point lights
  for (const [x, z] of [[-8, 3.5], [9, 5.2], [5, -13]]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(.22, .3, 1.5, 7), mats.lantern);
    post.position.set(x, .75, z); post.castShadow = true; grp.add(post);
    const box = new THREE.Mesh(new THREE.BoxGeometry(.62, .55, .62), mats.lantern);
    box.position.set(x, 1.72, z); box.castShadow = true; grp.add(box);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(.5, .35, 6), mats.stoneDark);
    cap.position.set(x, 2.16, z); grp.add(cap);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(.34, .34, .34), mats.lanternGlow);
    lamp.position.set(x, 1.72, z); grp.add(lamp);
    const li = new THREE.PointLight(0xffa95e, 14, 17, 2); li.position.set(x, 1.9, z); grp.add(li);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex('255,170,90'), transparent: true, opacity: .55, blending: THREE.AdditiveBlending, depthWrite: false }));
    s.scale.set(2.6, 2.6, 1); s.position.set(x, 1.72, z); grp.add(s);
    props.occluders.push({ x, z, r: .8, mesh: box });
  }
  // gate (north): posts + lintel, big occluder
  const gp = jitterGeo(new THREE.BoxGeometry(1.1, 6.4, 1.1), .05);
  for (const x of [-2.6, 2.6]) {
    const p = new THREE.Mesh(gp, mats.stoneDark); p.position.set(x, 3.2, -21.6); p.castShadow = true; grp.add(p);
    props.occluders.push({ x, z: -21.6, r: 1.2, mesh: p });
  }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(7.6, .9, 1.3), mats.stone);
  lintel.position.set(0, 6.7, -21.6); lintel.castShadow = true; grp.add(lintel);
  // rocks
  const rg = jitterGeo(new THREE.DodecahedronGeometry(1, 0), .28, 13);
  for (const [x, z, s] of [[-13, 6, 1.7], [12, -4, 1.5], [-6, -16, 1.4], [7, 13, 1.6], [-16, -3, 1.3]]) {
    const r = new THREE.Mesh(rg, mats.rock); r.position.set(x, s * .5, z); r.scale.setScalar(s); r.rotation.y = x * 1.7;
    r.castShadow = r.receiveShadow = true; grp.add(r);
    props.occluders.push({ x, z, r: s, mesh: r });
  }
  return props;
}
const R0 = (i) => i * 1.31;

// --- grain overlay ---
export function paintGrain(canvas) {
  const S = 160; canvas.width = S; canvas.height = S;
  const g = canvas.getContext('2d'), R = rngSeed(3), img = g.createImageData(S, S);
  for (let i = 0; i < img.data.length; i += 4) { const v = R() * 255 | 0; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 28; }
  g.putImageData(img, 0, 0);
}

// --- floating name tag above elite enemies (canvas sprite) ---
export function textTag(text, color = '#ff8a5c') {
  const c = cv(160, 56), g = c.getContext('2d');
  g.font = 'bold 30px "Noto Serif SC",serif'; g.textAlign = 'center';
  g.strokeStyle = 'rgba(0,0,0,.85)'; g.lineWidth = 6;
  g.strokeText(text, 80, 38); g.fillStyle = color; g.fillText(text, 80, 38);
  return c;
}

// --- skill icon glyphs (canvas-drawn, code UI per skill vfx-ui-audio) ---
export function skillIcon(kind) {
  const S = 76, c = cv(S, S), g = c.getContext('2d');
  g.strokeStyle = '#d8b36a'; g.lineWidth = 3; g.lineCap = 'round';
  if (kind === 'attack') {
    g.beginPath(); g.moveTo(18, 58); g.lineTo(54, 22); g.stroke();
    g.beginPath(); g.moveTo(46, 18); g.lineTo(58, 30); g.stroke();           // tip flare
    g.beginPath(); g.moveTo(30, 34); g.lineTo(42, 46); g.stroke();           // guard
    g.beginPath(); g.moveTo(14, 62); g.lineTo(22, 54); g.stroke();           // pommel
  } else if (kind === 'parry') {
    g.beginPath(); g.arc(38, 38, 22, -2.3, 1.3); g.stroke();
    g.beginPath(); g.moveTo(38, 16); g.lineTo(38, 54); g.stroke();
    g.beginPath(); g.moveTo(26, 30); g.lineTo(38, 16); g.lineTo(50, 30); g.stroke();
  } else if (kind === 'dash') {
    for (let i = 0; i < 3; i++) { g.globalAlpha = .45 + i * .27; g.beginPath(); g.moveTo(14 + i * 12, 26); g.quadraticCurveTo(30 + i * 10, 38, 14 + i * 12, 50); g.stroke(); }
    g.globalAlpha = 1; g.beginPath(); g.arc(56, 38, 6, 0, 7); g.stroke();
  } else if (kind === 'wave') {
    g.beginPath(); g.arc(22, 38, 15, -2.0, 1.7); g.stroke();                 // release arc
    g.beginPath(); g.moveTo(42, 32); g.lineTo(60, 38); g.lineTo(42, 44); g.stroke();   // flying wave
    g.beginPath(); g.moveTo(46, 26); g.lineTo(54, 26); g.moveTo(46, 50); g.lineTo(54, 50); g.stroke(); // speed lines
  } else if (kind === 'rain') {
    for (const [x, y] of [[26, 14], [38, 22], [50, 14]]) { g.beginPath(); g.moveTo(x, y); g.lineTo(x - 4, y + 14); g.stroke(); }
    g.beginPath(); g.moveTo(20, 50); g.lineTo(56, 50); g.stroke();           // ground line
    g.beginPath(); g.moveTo(28, 58); g.lineTo(38, 50); g.lineTo(48, 58); g.stroke();
  } else if (kind === 'strike') {
    g.beginPath(); g.moveTo(20, 54); g.lineTo(40, 54); g.stroke();           // departure mark
    g.beginPath(); g.moveTo(30, 54); g.lineTo(44, 26); g.lineTo(58, 40); g.stroke();  // blink arc
    g.beginPath(); g.moveTo(50, 22); g.lineTo(58, 26); g.lineTo(54, 34); g.stroke();  // blade flash
  }
  return c;
}
