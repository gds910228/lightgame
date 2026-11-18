// Station-wide audit: for every game in packages/games, collect facts that drive upgrade priority.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'D:/WorkProjects/AI/Lightgame/packages/games';
const OUT = 'D:/WorkProjects/AI/Lightgame/.scratch/station-upgrade/audit.json';

const games = fs.readdirSync(ROOT).filter(d => fs.statSync(path.join(ROOT, d)).isDirectory());
const report = [];

for (const id of games) {
  const dir = path.join(ROOT, id);
  const files = [];
  (function walk(d) {
    for (const f of fs.readdirSync(d)) {
      const p = path.join(d, f);
      if (fs.statSync(p).isDirectory()) walk(p);
      else files.push(p);
    }
  })(dir);

  const rel = files.map(f => path.relative(dir, f).replace(/\\/g, '/'));
  const byExt = e => rel.filter(f => f.toLowerCase().endsWith(e));
  const audio = [...byExt('.mp3'), ...byExt('.ogg'), ...byExt('.wav'), ...byExt('.m4a')];
  const images = [...byExt('.png'), ...byExt('.jpg'), ...byExt('.jpeg'), ...byExt('.gif'), ...byExt('.svg'), ...byExt('.webp')];
  const totalSize = files.reduce((s, f) => s + fs.statSync(f).size, 0);

  let meta = {};
  try { meta = JSON.parse(fs.readFileSync(path.join(dir, 'metadata.json'), 'utf8')); } catch {}

  // tech detection from index.html + js
  let html = '';
  try { html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8'); } catch {}
  const jsFiles = rel.filter(f => f.endsWith('.js') && !f.includes('/'));
  let jsBlob = html;
  for (const j of jsFiles) {
    try { jsBlob += '\n' + fs.readFileSync(path.join(dir, j), 'utf8'); } catch {}
  }
  const tech = {
    canvas: /getContext\(['"]2d|createElement\(['"]canvas/.test(jsBlob),
    three: /THREE\.|three\.(min|module)/i.test(jsBlob),
    phaser: /Phaser/i.test(jsBlob),
    domImg: /document\.write\s*\(\s*['"`]<img|new Image\(/.test(jsBlob),
    requestsExternal: /https?:\/\/(?!127\.0\.0\.1|localhost)/i.test(jsBlob.replace(/xmlns[^"']*/g, '')),
    hasMetaViewport: /name=["']viewport["']/i.test(html),
    touchHandlers: /touchstart|pointerdown|ontouchstart/i.test(jsBlob),
  };
  // external domains actually referenced (license/dependency awareness)
  const extDomains = [...new Set((jsBlob.match(/https?:\/\/[a-z0-9.-]+/gi) || [])
    .map(u => u.replace(/^https?:\/\//i, '').split('/')[0])
    .filter(d => !/^(127\.0\.0\.1|localhost)$/i.test(d)))];

  report.push({
    id, title: meta.title || id, type: meta.type || 'local', category: meta.category,
    totalKB: Math.round(totalSize / 1024),
    files: files.length,
    audioCount: audio.length,
    audioFiles: audio,
    imageCount: images.length,
    hasIndex: rel.includes('index.html'),
    hasMeta: rel.includes('metadata.json'),
    tech, extDomains,
    jsMainKB: jsFiles.length ? Math.round(Math.max(...jsFiles.map(f => fs.statSync(path.join(dir, f)).size)) / 1024) : 0,
  });
}

fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
// console summary
const noAudio = report.filter(g => g.audioCount === 0 && g.type === 'local');
const noIndex = report.filter(g => !g.hasIndex);
console.log(`games: ${report.length}`);
console.log(`iframe games: ${report.filter(g => g.type !== 'local').length}`);
console.log(`local games without ANY audio: ${noAudio.length}`);
console.log(noAudio.map(g => `${g.id}(${g.totalKB}KB,${g.tech.canvas ? 'canvas' : g.tech.domImg ? 'dom' : g.tech.three ? 'three' : '?'})`).join('\n') || '(none)');
console.log(`missing index.html: ${noIndex.map(g => g.id).join(', ') || '(none)'}`);
