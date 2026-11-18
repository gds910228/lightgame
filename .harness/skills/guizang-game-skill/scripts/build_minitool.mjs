// Build the Xiaohongshu mini-tool package: node tools/build_mini.mjs   (run from game/)  ->  dist/mini/ and dist/wusuo-minitool.zip
// The container allows no network requests (fetch / XHR), no WASM, no module or inline scripts, and only web file types
// (html css js json png jpg gif webp svg woff), 10 MiB for the whole zip. So:
//   - models: simplified, textures pulled out as .webp files, geometry + animation as base64 inside data/*.js (classic scripts, loaded on demand)
//   - audio: decoded with Web Audio from base64 in data/*.js (no media elements, no fetch); recorded music is left out, the synth score plays instead
//   - code: one classic ES2017 script; every `fetch` in the bundle is rewritten to a local lookup, the meshopt (WASM) decoder is stubbed out
import fs from 'node:fs'; import path from 'node:path'; import { execFileSync } from 'node:child_process';
import { NodeIO } from '@gltf-transform/core'; import { ALL_EXTENSIONS, KHRMeshQuantization } from '@gltf-transform/extensions';
import { textureCompress, dedup, prune, weld, simplify, resample } from '@gltf-transform/functions'; import { MeshoptSimplifier } from 'meshoptimizer'; import sharp from 'sharp'; import { build } from 'esbuild';

const OUT = 'dist/mini', ZIP = 'dist/wusuo-minitool.zip'; fs.rmSync(OUT, { recursive: true, force: true }); for (const d of ['assets/m', 'assets/tex', 'assets/ui', 'assets/fx', 'data']) fs.mkdirSync(path.join(OUT, d), { recursive: true });
await MeshoptSimplifier.ready; const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const J = (f) => JSON.parse(fs.readFileSync(f, 'utf8')); const log = (...a) => console.log(...a); const kb = (n) => (n / 1024).toFixed(0) + 'K';
const IDX = {}; let nData = 0; const big = [];
function dataFile(name, entries) { const f = name + '.js'; let s = ''; for (const [k, v] of Object.entries(entries)) { IDX[k] = f; s += `__D(${JSON.stringify(k)},${JSON.stringify(v)});\n`; if (v.b && v.b.length * 0.75 > 1048576) big.push(k + ' ' + kb(v.b.length * 0.75)); } fs.writeFileSync(path.join(OUT, 'data', f), s); nData += s.length; return s.length; }

async function glb(rel, { tex = 512, tris = 4000, animOnly = false } = {}) {
  const d = await io.read('assets/' + rel), root = d.getRoot(), id = 'm' + Object.keys(IDX).length;
  if (animOnly) for (const n of root.listNodes()) { n.setMesh(null); n.setSkin(null); }
  // animation diet: scale tracks are all 1 (and harmful, see chars.js); translation tracks that never leave the rest pose say nothing
  for (const a of root.listAnimations()) for (const ch of a.listChannels()) { const p = ch.getTargetPath(), n = ch.getTargetNode(), sm = ch.getSampler(); let drop = p === 'scale';
    if (p === 'translation' && n) { const o = sm.getOutput(), r = n.getTranslation(), e = [0, 0, 0]; drop = true; for (let i = 0; i < o.getCount() && drop; i++) { o.getElement(i, e); if (Math.abs(e[0] - r[0]) + Math.abs(e[1] - r[1]) + Math.abs(e[2] - r[2]) > 2e-4) drop = false; } }
    if (drop) { a.removeChannel(ch); ch.dispose(); if (!sm.listParents().some((x) => x.propertyType === 'AnimationChannel')) { a.removeSampler(sm); sm.dispose(); } } }
  await d.transform(dedup(), resample());
  // long clips (idle loops, the long hurt take) keep every second key: 15 keys a second is plenty for slow motion, and it halves the biggest buffers
  for (const an of root.listAnimations()) for (const sm of new Set(an.listChannels().map((c) => c.getSampler()))) { const inp = sm.getInput(), out = sm.getOutput(), n = inp.getCount(); if (n < 100 || inp.getMax([])[0] < 3) continue; const es = out.getElementSize(), keep = []; for (let i = 0; i < n; i += 2) keep.push(i); if (keep[keep.length - 1] !== n - 1) keep.push(n - 1);
    const ti = new Float32Array(keep.length), to = new Float32Array(keep.length * es), e = []; keep.forEach((k, i) => { ti[i] = inp.getScalar(k); out.getElement(k, e); for (let c = 0; c < es; c++) to[i * es + c] = e[c]; }); sm.setInput(d.createAccessor().setType('SCALAR').setArray(ti).setBuffer(root.listBuffers()[0])); sm.setOutput(d.createAccessor().setType(out.getType()).setArray(to).setBuffer(root.listBuffers()[0])); }
  if (!animOnly) { let t = 0; for (const m of root.listMeshes()) for (const pr of m.listPrimitives()) t += (pr.getIndices()?.getCount() ?? pr.getAttribute('POSITION').getCount()) / 3; const ratio = Math.min(1, tris / t);
    if (ratio < 0.95) await d.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.08, lockBorder: false })); }
  for (const m of root.listMeshes()) for (const pr of m.listPrimitives()) { pr.setAttribute('TANGENT', null); pr.setAttribute('COLOR_0', null); pr.setAttribute('TEXCOORD_1', null); }
  // pack normals, UVs and skin weights into normalised integers (plain glTF, no decoder needed). Positions stay float: quantising them rescales the mesh and broke skinned characters in the other build.
  { let used = false; const conv = (pr, sem, Arr, norm) => { const a = pr.getAttribute(sem); if (!a || a.getComponentType() !== 5126) return; const src = a.getArray(), es = a.getElementSize(), out = new Arr(src.length), max = Arr === Int8Array ? 127 : Arr === Uint8Array ? 255 : 65535;
      if (sem === 'TEXCOORD_0') { for (const v of src) if (v < 0 || v > 1) return; }
      if (sem === 'WEIGHTS_0') { for (let i = 0; i < src.length; i += es) { let t = 0; const q = []; for (let c = 0; c < es; c++) { q[c] = Math.round(src[i + c] * 255); t += q[c]; } let m = 0; for (let c = 1; c < es; c++) if (q[c] > q[m]) m = c; q[m] += 255 - t; for (let c = 0; c < es; c++) out[i + c] = Math.max(0, q[c]); } }
      else for (let i = 0; i < src.length; i++) out[i] = Math.round(Math.max(Arr === Int8Array ? -1 : 0, Math.min(1, src[i])) * max);
      pr.setAttribute(sem, d.createAccessor().setType(a.getType()).setArray(out).setNormalized(true).setBuffer(a.getBuffer())); if (sem !== 'WEIGHTS_0') used = true; };
    for (const m of root.listMeshes()) for (const pr of m.listPrimitives()) { conv(pr, 'NORMAL', Int8Array); conv(pr, 'TEXCOORD_0', Uint16Array); conv(pr, 'WEIGHTS_0', Uint8Array); }
    if (used) d.createExtension(KHRMeshQuantization).setRequired(true); }
  await d.transform(prune({ keepLeaves: true, keepAttributes: false }), textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [tex, tex], quality: 78 }));
  root.listTextures().forEach((t, i) => t.setURI(`${id}_${i}.webp`)); root.listBuffers().forEach((b) => b.setURI(id + '.bin'));
  const { json, resources } = await io.writeJSON(d, { basename: id }); let bin = Buffer.alloc(0), img = 0;
  for (const [uri, data] of Object.entries(resources)) { if (uri.endsWith('.bin')) bin = Buffer.from(data); else { fs.writeFileSync(path.join(OUT, 'assets/m', uri), data); img += data.length; } }
  for (const im of json.images || []) im.uri = 'assets/m/' + im.uri; delete json.buffers[0].uri;
  let nt = 0; for (const m of root.listMeshes()) for (const pr of m.listPrimitives()) nt += (pr.getIndices()?.getCount() ?? 0) / 3;
  dataFile(id, { ['assets/' + rel]: { j: json, b: bin.toString('base64') } }); return `${kb(bin.length)} bin, ${kb(img)} img, ${Math.round(nt)} tris`;
}
// ---- models
const chars = J('assets/chars.json'), props = J('assets/props.json'), loot = J('assets/loot.json');
const TRI = { hero: 8000, boss: 8000, walker: 5500, caster: 5500, spear: 5500 }, PT = { gate: 6000, hall: 5000, shrine: 4500, tree: 3000, rock: 1500, statue: 2500, lantern: 2000, pillar: 1500, censer: 2000, stele: 1500, post: 1200, beast: 2500 };
for (const [k, c] of Object.entries(chars)) { if (k === 'weapons') { for (const [w, f] of Object.entries(c)) log('weapon', w, await glb(f, { tex: 256, tris: 1500 })); continue; }
  log(k, await glb(c.files[0], { tex: 512, tris: TRI[k] || 6000 }), '| anim', c.files[1] ? await glb(c.files[1], { animOnly: true }) : '-'); }
for (const [k, f] of Object.entries(props)) log('prop', k, await glb(f, { tex: k === 'gate' || k === 'hall' ? 512 : 256, tris: PT[k] || 2000 }));
for (const [k, f] of Object.entries(loot)) log('loot', k, await glb(f, { tex: 128, tris: 700 }));
dataFile('manifest', { 'assets/chars.json': { j: chars }, 'assets/props.json': { j: props }, 'assets/loot.json': { j: loot } });
// ---- images stay ordinary files
for (const f of fs.readdirSync('assets/tex').filter((f) => /\.jpg$/.test(f))) fs.writeFileSync(path.join(OUT, 'assets/tex', f), await sharp('assets/tex/' + f).resize(512, 512, { fit: 'inside' }).jpeg({ quality: 76 }).toBuffer());
fs.writeFileSync(path.join(OUT, 'assets/fx/ink.jpg'), await sharp('assets/fx/ink.jpg').resize(1024, 1024, { fit: 'inside' }).jpeg({ quality: 78 }).toBuffer());
for (const f of fs.readdirSync('assets/ui')) if (/\.(png|jpg)$/.test(f)) fs.writeFileSync(path.join(OUT, 'assets/ui', f), f === 'title.png' ? await sharp('assets/ui/title.png').resize(900, null, { withoutEnlargement: true }).png({ palette: true, colours: 48 }).toBuffer() : /^icon|^i_/.test(f) ? await sharp('assets/ui/' + f).resize(160, 160).jpeg({ quality: 80 }).toBuffer() : fs.readFileSync('assets/ui/' + f));
// ---- audio: mono, low bitrate, base64 for decodeAudioData
const tmp = path.join(OUT, '_t.mp3'); const enc = (src, br) => { execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', src, '-ac', '1', '-b:a', br, tmp]); const b = fs.readFileSync(tmp); fs.unlinkSync(tmp); return b.toString('base64'); };
{ const e = {}; for (const f of fs.readdirSync('assets/sfx').filter((f) => f.endsWith('.mp3'))) e['assets/sfx/' + f] = { b: enc('assets/sfx/' + f, '48k') }; log('sfx', kb(dataFile('sfx', e))); }
{ const e = {}; for (const f of fs.readdirSync('assets/voice').filter((f) => f.endsWith('.mp3'))) e['assets/voice/' + f] = { b: enc('assets/voice/' + f, '40k') }; log('voice', kb(dataFile('voice', e))); }
for (const n of ['explore', 'combat', 'boss']) if (fs.existsSync(`assets/music/${n}.mp3`)) log('music', n, kb(dataFile('mu_' + n, { [`assets/music/${n}.mp3`]: { b: enc(`assets/music/${n}.mp3`, '36k') } })));
if (fs.existsSync('assets/music/ambient.mp3')) log('ambient', kb(dataFile('amb', { 'assets/music/ambient.mp3': { b: enc('assets/music/ambient.mp3', '40k') } })));
// ---- code: classic script, ES2017, no fetch / WASM / dynamic import
const AUTHOR = '/* 雾锁山门 · 歸藏作品 · © 2026 歸藏 Guizang · 未经许可不得转载、改名再发布或商用 · built by AI with guizang-game-skill */';
const RUNTIME = `(function(){var M={},W={},L={},IDX=${JSON.stringify(IDX)};function k(u){return String(u).replace(/^\\.\\//,'').split('?')[0]}
window.__D=function(key,v){M[key]=v;var w=W[key];if(w){delete W[key];for(var i=0;i<w.length;i++)w[i][0](v)}};
function get(u){var key=k(u);return new Promise(function(res,rej){if(M[key])return res(M[key]);var f=IDX[key];if(!f)return rej(new Error('not packed: '+key));(W[key]=W[key]||[]).push([res,rej]);if(L[f])return;L[f]=1;var s=document.createElement('script');s.src='./data/'+f;s.onerror=function(){for(var q in W)if(IDX[q]===f){var w=W[q];delete W[q];for(var i=0;i<w.length;i++)w[i][1](new Error('load failed: '+f))}};document.head.appendChild(s)})}
function b64(s){var bin=atob(s),n=bin.length,u=new Uint8Array(n);for(var i=0;i<n;i++)u[i]=bin.charCodeAt(i);return u.buffer}
window.__MINI={get:get,b64:b64};
window.__lf=function(u){return get(u).then(function(v){return{ok:true,status:200,json:function(){return Promise.resolve(v.j)},arrayBuffer:function(){return Promise.resolve(b64(v.b))},text:function(){return Promise.resolve(JSON.stringify(v.j))}}},function(){return{ok:false,status:404,json:function(){return Promise.reject(new Error('404'))},arrayBuffer:function(){return Promise.reject(new Error('404'))},text:function(){return Promise.reject(new Error('404'))}}})};
window.__CFG={touch:true,links:false,settings:false,grass:26000,pixels:2.0e6,shadow:1024,quality:{ao:false,steps:8},trees:12,rocks:30};
if(typeof globalThis==='undefined')window.globalThis=window;
if(!Array.prototype.flat)Array.prototype.flat=function(d){d=d===undefined?1:d;return this.reduce(function(a,v){return a.concat(Array.isArray(v)&&d>0?v.flat(d-1):[v])},[])};
if(!Array.prototype.flatMap)Array.prototype.flatMap=function(f,t){return this.map(f,t).flat()};
if(!Object.fromEntries)Object.fromEntries=function(it){var o={};Array.from(it).forEach(function(e){o[e[0]]=e[1]});return o};
if(!String.prototype.replaceAll)String.prototype.replaceAll=function(a,b){return typeof a==='string'?this.split(a).join(b):this.replace(a,b)};
if(!Element.prototype.closest)Element.prototype.closest=function(s){var e=this;while(e&&e.nodeType===1){if(e.matches(s))return e;e=e.parentElement}return null};
if(!window.queueMicrotask)window.queueMicrotask=function(f){Promise.resolve().then(f)};
})();`;
const r = await build({ entryPoints: ['src/game.js'], bundle: true, format: 'iife', minify: true, write: false, target: ['es2017', 'chrome61'], legalComments: 'none', charset: 'utf8',
  define: { fetch: '__lf', createImageBitmap: 'undefined', __NOFS__: 'true' }, alias: { three: './vendor/three/build/three.module.js' },
  plugins: [{ name: 'mini', setup(b) { b.onResolve({ filter: /^three\/addons\// }, (a) => /meshopt_decoder/.test(a.path) ? { path: 'meshopt-stub', namespace: 'stub' } : { path: path.resolve('vendor/three/jsm', a.path.slice('three/addons/'.length)) });
    b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: 'export const MeshoptDecoder = { supported: false, ready: Promise.resolve() };', loader: 'js' })); } }] });
/* this package carries no outbound or social links at all, not even as text */
const js = AUTHOR + '\n' + RUNTIME + '\n' + r.outputFiles[0].text.replace(/\s*·?\s*https:\/\/x\.com\/op7418/g, ''); fs.writeFileSync(path.join(OUT, 'game.js'), js);
// ---- html: no inline or module scripts, no outbound links, CSS a Chrome 61 engine can read
let html = fs.readFileSync('index.html', 'utf8');
html = html.replace(/<script type="importmap">[\s\S]*?<\/script>\n?/, ''); const i0 = html.indexOf('<script type="module">'), i1 = html.indexOf('</script>', i0) + 9; html = html.slice(0, i0) + '<script src="./game.js"></script>' + html.slice(i1);
html = html.replace(/<a ([^>]*)>/g, (m, at) => '<span ' + at.replace(/\s*(href|target|rel)="[^"]*"/g, '') + '>').replace(/<\/a>/g, '</span>').replace(/ ↗/g, '').replace('这个游戏由 AI 用 guizang-game-skill 做成 · 看它是怎么做的', '这个游戏由 AI 用 guizang-game-skill 做成').replace(/https:\/\/github\.com\/op7418\/guizang-game-skill/g, 'guizang-game-skill（GitHub: op7418）').replace(/\s*\(https:\/\/x\.com\/op7418\)/g, '').replace(/\s*https:\/\/x\.com\/op7418/g, '');
html = html.replace(/(src|href)="assets\//g, '$1="./assets/').replace(/url\(assets\//g, 'url(./assets/');
const first = (args) => { let d = 0, cur = '', out = []; for (const c of args) { if (c === '(') d++; if (c === ')') d--; if (c === ',' && d === 0) { out.push(cur.trim()); cur = ''; } else cur += c; } out.push(cur.trim()); return out; };
html = html.replace(/<style>([\s\S]*?)<\/style>/, (m, css) => { css = css.replace(/inset:\s*0\s*;/g, 'top:0; right:0; bottom:0; left:0;').replace(/inset:\s*(-?[\d.]+px)\s+(-?[\d.]+px)\s*;/g, 'top:$1; bottom:$1; left:$2; right:$2;');
  css = css.replace(/([\w-]+):([^;{}]*\b(?:min|clamp)\([^;{}]*);/g, (d, prop, val) => { let fb = val, g = 0; while (/\b(min|clamp)\(/.test(fb) && g++ < 6) fb = fb.replace(/\b(min|clamp)\(((?:[^()]|\([^()]*\))*)\)/, (x, fn, a) => { const p = first(a); return fn === 'min' ? p[0] : p[1]; }); return `${prop}:${fb}; ${prop}:${val};`; });
  css += '\n  /* Chrome 61 has no flex gap */ .toast { margin-bottom:8px; } #baglist b { margin-left:24px; }\n'; return '<style>' + css + '</style>'; });
fs.writeFileSync(path.join(OUT, 'index.html'), html);
// ---- static gates
const bad = []; const scan = (name, txt, pats) => { for (const p of pats) { const m = txt.match(p); if (m) bad.push(`${name}: ${m[0]}`); } };
scan('game.js', js, [/\bfetch\s*\(/, /XMLHttpRequest/, /WebAssembly/, /new Function\s*\(/, /\beval\s*\(/, /new (Shared)?Worker\s*\(/, /\bimport\s*\(/, /requestFullscreen/, /window\.open\s*\(/, /navigator\.(clipboard|geolocation|serviceWorker)/, /devicemotion|deviceorientation/i, /https?:\/\/(?!www\.w3\.org)[\w.-]+\/[^\s"'`)]*\.(js|css|png|jpg|glb|mp3|woff2?)/]);
scan("game.js", js, [/x\.com\/|twitter\.com/i]); scan("index.html", html, [/x\.com\/|twitter|@op7418/i]); scan('index.html', html, [/<script(?![^>]*\bsrc=)[^>]*>/, /type="module"/, /\son\w+="/, /target="_blank"/, /<iframe|<object|<base /, /(src|href)="https?:/, /url\(https?:/, /javascript:/]);
const types = new Set(); const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); if (e.isDirectory()) walk(f); else types.add(path.extname(f).toLowerCase()); } }; walk(OUT);
const okT = new Set(['.html', '.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.woff', '.woff2', '.json']); for (const t of types) if (!okT.has(t)) bad.push('file type not allowed: ' + t);
fs.rmSync(ZIP, { force: true }); execFileSync('zip', ['-q', '-r', '-9', path.resolve(ZIP), '.', '-x', '*.DS_Store'], { cwd: OUT });
log('\ncode', kb(js.length), '| data scripts', kb(nData), '| zip', (fs.statSync(ZIP).size / 1048576).toFixed(2), 'MiB', '| file types', [...types].join(' '));
if (big.length) log('base64 over 1 MiB:', big.join(', ')); log(bad.length ? 'STATIC GATE FAILED:\n  ' + bad.join('\n  ') : 'static gate: clean');
