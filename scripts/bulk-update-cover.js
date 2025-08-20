const fs = require('fs');
const path = require('path');

const slugs = ['snake','bdsjm','bttz','blglez','bbjx','tetris','tower-defense'];

function readJsonSafe(p) {
  let txt = fs.readFileSync(p, 'utf8');
  // strip BOM
  if (txt.charCodeAt(0) === 0xFEFF) txt = txt.slice(1);
  return JSON.parse(txt);
}

function writeJson(p, obj) {
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(p, JSON.stringify(obj, null, 2), 'utf8');
}

let updated = 0;
for (const slug of slugs) {
  const metaPath = path.join('packages', 'games', slug, 'metadata.json');
  try {
    if (!fs.existsSync(metaPath)) {
      console.warn(`skip ${slug}: metadata.json not found`);
      continue;
    }
    const meta = readJsonSafe(metaPath);
    meta.image = 'cover.svg';
    meta.thumbnail = 'cover.svg';
    writeJson(metaPath, meta);
    console.log('updated', slug);
    updated++;
  } catch (e) {
    console.error('failed', slug, e.message);
  }
}

console.log(`done. updated ${updated}/${slugs.length}`);