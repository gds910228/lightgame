// Build a single self-contained HTML (dist/wusuo.html) and a static site (dist/site/): node tools/build.mjs   (run from game/)
// 1. shrink assets (textures -> webp at a sane size, strip meshes from animation-only files, meshopt geometry, re-encode music)
// 2. bundle the modules with esbuild, 3. inline everything as data URLs into dist/wusuo.html
import fs from 'node:fs'; import path from 'node:path'; import { execFileSync } from 'node:child_process';
import { NodeIO } from '@gltf-transform/core'; import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { textureCompress, dedup, prune, meshopt, reorder } from '@gltf-transform/functions'; import { EXTMeshoptCompression } from '@gltf-transform/extensions'; import { MeshoptEncoder } from 'meshoptimizer'; import sharp from 'sharp'; import { build } from 'esbuild';

const OUT = 'dist', OPT = OUT + '/opt'; fs.mkdirSync(OPT, { recursive: true }); await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
const J = (f) => JSON.parse(fs.readFileSync(f, 'utf8')); const A = {}; let raw = 0;
const SITE = OUT + '/site';          /* the same shrunk assets as separate files, for static hosting (GitHub Pages): the page can draw before they finish downloading */
fs.rmSync(SITE, { recursive: true, force: true });
const put = (key, buf, mime) => { A[key] = `data:${mime};base64,` + buf.toString('base64'); raw += buf.length; const o = path.join(SITE, key); fs.mkdirSync(path.dirname(o), { recursive: true }); fs.writeFileSync(o, buf); };
const cached = async (key, src, make) => { const o = path.join(OPT, key.replace(/[\/]/g, '__')); if (!fs.existsSync(o) || fs.statSync(o).mtimeMs < fs.statSync(src).mtimeMs) fs.writeFileSync(o, await make()); return fs.readFileSync(o); };
const NOGEO = process.argv.includes('--no-meshopt');

async function glb(rel, { tex = 1024, animOnly = false, geo = true, skinned = false, hd = false } = {}) {
  const src = 'assets/' + rel; const buf = await cached(rel + (animOnly ? '.anim' : '') + '.' + tex + (geo && !NOGEO ? (skinned ? '.mf' : '.mo') : ''), src, async () => {
    const d = await io.read(src); if (animOnly) for (const n of d.getRoot().listNodes()) { n.setMesh(null); n.setSkin(null); }
    await d.transform(dedup(), prune({ keepLeaves: true, keepAttributes: true }), textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [tex, tex], quality: 82 }));
    /* skinned characters: meshopt-pack the buffers but do NOT quantise. Quantisation rescales the mesh and parks the inverse on the armature, so the packed game measured a different body height and preset clips (which carry scale tracks) shrank the character */
    if (geo && !NOGEO && !animOnly && skinned) { await d.transform(reorder({ encoder: MeshoptEncoder })); d.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE }); }
    else if (geo && !NOGEO && !animOnly) await d.transform(meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
    return Buffer.from(await io.writeBinary(d)); });
  if (hd) { const o = path.join(SITE, 'assets-hd', rel); fs.mkdirSync(path.dirname(o), { recursive: true }); fs.writeFileSync(o, buf); hdBytes += buf.length; return buf.length; }          /* the sharper set exists only in the hosted site, loaded when the player asks for it */
  put('assets/' + rel, buf, 'model/gltf-binary'); return buf.length;
}
let hdBytes = 0; const log = (...a) => console.log(...a); const mb = (n) => (n / 1e6).toFixed(2) + 'MB';
// ---- models
const chars = J('assets/chars.json'), props = J('assets/props.json'), loot = fs.existsSync('assets/loot.json') ? J('assets/loot.json') : {};
for (const [k, c] of Object.entries(chars)) { if (k === 'weapons') { for (const f of Object.values(c)) log('weapon', f.split('/')[1], mb(await glb(f, { tex: 1024 }))); continue; }
  log(k, mb(await glb(c.files[0], { tex: 1536, skinned: true })), 'anim', mb(c.files[1] ? await glb(c.files[1], { animOnly: true }) : 0)); }
for (const [k, f] of Object.entries(props)) log('prop', k, mb(await glb(f, { tex: k === 'gate' || k === 'hall' || k === 'tree' ? 1536 : 1024 })));
for (const [k, f] of Object.entries(loot)) log('loot', k, mb(await glb(f, { tex: 512 })));
for (const f of ['chars.json', 'props.json', 'loot.json']) if (fs.existsSync('assets/' + f)) put('assets/' + f, fs.readFileSync('assets/' + f), 'application/json');
// ---- optional high-resolution set for the hosted site: same files, textures twice the edge length (everything the URL switch redirects must exist here too)
for (const [k, c] of Object.entries(chars)) { if (k === 'weapons') { for (const f of Object.values(c)) await glb(f, { tex: 2048, hd: true }); continue; } await glb(c.files[0], { tex: 2048, skinned: true, hd: true }); if (c.files[1]) await glb(c.files[1], { animOnly: true, hd: true }); }
for (const [k, f] of Object.entries(props)) await glb(f, { tex: 2048, hd: true }); for (const [k, f] of Object.entries(loot)) await glb(f, { tex: 512, hd: true });
for (const f of fs.readdirSync('assets/tex').filter((f) => /\.jpg$/.test(f))) { const o = path.join(SITE, 'assets-hd/tex', f); fs.mkdirSync(path.dirname(o), { recursive: true }); const b = await cached('texhd_' + f, 'assets/tex/' + f, () => sharp('assets/tex/' + f).resize(2048, 2048, { fit: 'inside' }).jpeg({ quality: 84 }).toBuffer()); fs.writeFileSync(o, b); hdBytes += b.length; }
log('hd set', mb(hdBytes));
// ---- textures, ui, audio
for (const f of fs.readdirSync('assets/tex').filter((f) => /\.jpg$/.test(f))) put('assets/tex/' + f, await cached('tex_' + f, 'assets/tex/' + f, () => sharp('assets/tex/' + f).resize(1024, 1024, { fit: 'inside' }).jpeg({ quality: 80 }).toBuffer()), 'image/jpeg');
put('assets/fx/ink.jpg', fs.readFileSync('assets/fx/ink.jpg'), 'image/jpeg');
for (const f of fs.readdirSync('assets/ui')) if (/\.(png|jpg)$/.test(f)) put('assets/ui/' + f, f === 'title.png' ? await cached('ui_title', 'assets/ui/title.png', () => sharp('assets/ui/title.png').png({ palette: true, colours: 64 }).toBuffer()) : fs.readFileSync('assets/ui/' + f), f.endsWith('png') ? 'image/png' : 'image/jpeg');
for (const f of fs.readdirSync('assets/sfx').filter((f) => f.endsWith('.mp3'))) put('assets/sfx/' + f, fs.readFileSync('assets/sfx/' + f), 'audio/mpeg');
for (const dir of ['music', 'voice']) if (fs.existsSync('assets/' + dir)) for (const f of fs.readdirSync('assets/' + dir).filter((f) => f.endsWith('.mp3'))) {
  const src = `assets/${dir}/${f}`; put(src, dir === 'voice' ? fs.readFileSync(src) : await cached(dir + '_' + f, src, () => { const o = path.join(OPT, 'tmp_' + f); execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', src, '-ac', '2', '-b:a', '88k', o]); const b = fs.readFileSync(o); fs.unlinkSync(o); return b; }), 'audio/mpeg'); }
log('assets raw', mb(raw), 'files', Object.keys(A).length);
// ---- code
const r = await build({ entryPoints: ['src/game.js'], bundle: true, format: 'esm', minify: true, write: false, target: 'es2022', legalComments: 'none',
  alias: { three: './vendor/three/build/three.module.js' }, plugins: [{ name: 'addons', setup(b) { b.onResolve({ filter: /^three\/addons\// }, (a) => ({ path: path.resolve('vendor/three/jsm', a.path.slice('three/addons/'.length)) })); } }] });
const js = r.outputFiles[0].text; log('code', mb(js.length));
// ---- html
let html = fs.readFileSync('index.html', 'utf8');
{ const i0 = html.indexOf('<script type="module">'), i1 = html.indexOf('</script>', i0) + 9; const site = html.replace(/<script type="importmap">[\s\S]*?<\/script>/, '<meta name="hd-assets" content="assets-hd">');
  const j0 = site.indexOf('<script type="module">'), j1 = site.indexOf('</script>', j0) + 9; const tag = 'game.' + (await import('node:crypto')).createHash('md5').update(js).digest('hex').slice(0, 8) + '.js';
  fs.writeFileSync(SITE + '/' + tag, js); fs.writeFileSync(SITE + '/index.html', site.slice(0, j0) + `<script type="module" src="${tag}"></script>` + site.slice(j1)); fs.writeFileSync(SITE + '/.nojekyll', '');
  const sz = (d) => fs.readdirSync(d, { withFileTypes: true }).reduce((n, e) => n + (e.isDirectory() ? sz(path.join(d, e.name)) : fs.statSync(path.join(d, e.name)).size), 0); log('wrote', SITE, mb(sz(SITE)), 'code', tag); }
html = html.replace(/<script type="importmap">[\s\S]*?<\/script>/, '').replace(/assets\/ui\/[\w.]+/g, (m) => A[m] || m);
const shim = `window.__A=${JSON.stringify(A)};(()=>{const A=window.__A,k=u=>String(u).replace(/^\\.\\//,'').split('?')[0],f=window.fetch.bind(window);window.fetch=(u,o)=>{if(typeof u!=='string')return f(u,o);const key=k(u);return A[key]?f(A[key]):key.startsWith('assets/')?Promise.resolve(new Response('',{status:404})):f(u,o)}})();`;
const i0 = html.indexOf('<script type="module">'), i1 = html.indexOf('</script>', i0) + 9;
html = html.slice(0, i0) + '<script>' + shim.replace(/<\/script/g, '<\\/script') + '</script>\n<script type="module">' + js.replace(/<\/script/g, '<\\/script') + '</script>' + html.slice(i1);
fs.writeFileSync(OUT + '/wusuo.html', html); log('wrote', OUT + '/wusuo.html', mb(fs.statSync(OUT + '/wusuo.html').size));
