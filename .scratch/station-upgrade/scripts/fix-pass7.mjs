// Fix pass 7: island-quiz dc.js tracking send no-op + super-shooter _smq stub.
import fs from 'node:fs';
import path from 'node:path';
const ROOT = 'D:/WorkProjects/AI/Lightgame/packages/games';
const BK = 'D:/WorkProjects/AI/Lightgame/.scratch/station-upgrade/backup';
const log = [];

// 1. island-quiz: dc.js line 86 builds invalid data-URI+query URLs — make send a no-op
{
  const p = path.join(ROOT, 'island-quiz-game/static/dc.js');
  const d = path.join(BK, 'pass7');
  fs.mkdirSync(d, { recursive: true });
  const bkp = path.join(d, 'dc.js');
  if (!fs.existsSync(bkp)) fs.copyFileSync(p, bkp);
  let s = fs.readFileSync(p, 'utf8');
  const out = s.replace(
    /submitURL\.src = _DC_Constant\.rurl \+ submitData;/,
    'return; /*[lg] tracking send disabled (rurl replaced, combo produced invalid URL)*/'
  );
  if (out !== s) { fs.writeFileSync(p, out); log.push('island-quiz dc.js: tracking send disabled'); }
}

// 2. super-shooter: _smq stats stub
{
  const p = path.join(ROOT, 'super-shooter-football/index.html');
  let s = fs.readFileSync(p, 'utf8');
  if (!/window\._smq\s*=/.test(s)) {
    s = s.replace(/<head[^>]*>/i, m => m + '\n<script>window._smq=window._smq||[];</script>');
    fs.writeFileSync(p, s);
    log.push('super-shooter: _smq stub injected');
  }
}

console.log(log.join('\n') || '(nothing)');
console.log('pass7 done');
