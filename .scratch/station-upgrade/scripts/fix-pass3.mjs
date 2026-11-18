// Fix pass 3: strip hidden packed injectors across all games + remaining small fixes.
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = 'D:/WorkProjects/AI/Lightgame/packages/games';
const BK = 'D:/WorkProjects/AI/Lightgame/.scratch/station-upgrade/backup';
const POOL = 'D:/WorkProjects/AI/Lightgame/.scratch/station-upgrade/audiopool';
const DL = 'D:/WorkProjects/AI/Lightgame/.scratch/gm-pilot/dl';
const DEAD = /(game\.9g\.com|0\.vbaitong\.com|pingtcss|tajs\.qq|ossweb-img|tongji\.linezing|linezing\.com|100bt|lanrenmb|myqcloud)/i;
const log = [];

function tryUnpack(src, from = 0) {
  const i = src.indexOf('eval(function(p,a,c,k,e,d)', from);
  if (i === -1) return null;
  let depth = 0, end = -1;
  for (let j = i + 4; j < src.length; j++) {
    const ch = src[j];
    if (ch === '(') depth++;
    else if (ch === ')') { depth--; if (depth === 0) { end = j + 1; break; } }
  }
  if (end === -1) return null;
  const expr = src.slice(i, end);
  try {
    const out = eval(expr.replace(/^eval/, '(') + ')');
    return { expr, out: String(out), start: i, end };
  } catch { return null; }
}

function syntaxOk(p) {
  if (!/\.js$/i.test(p)) return true;
  try { execSync(`node --check "${p}"`, { stdio: 'pipe' }); return true; }
  catch { return false; }
}

// ---- 1. hunt packed injectors ----
(function walk(d) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) { walk(p); continue; }
    if (!/\.(js|html|htm)$/i.test(f)) continue;
    const rel = path.relative(ROOT, p).replace(/\\/g, '/');
    let s;
    try { s = fs.readFileSync(p, 'utf8'); } catch { continue; }
    if (!s.includes('eval(function(p,a,c,k,e,d)')) continue;

    let work = s, dirty = false, guard = 0, from = 0;
    while (guard++ < 20) {
      const u = tryUnpack(work, from);
      if (!u) break;
      if (DEAD.test(u.out)) {
        work = work.slice(0, u.start) + '/*[lg] stripped injected packed payload*/' + work.slice(u.end);
        dirty = true;
        from = u.start + 40;
        log.push(`${rel}: stripped packed injector (${u.out.length}B payload)`);
      } else {
        from = u.end; // legit packed code, skip past it
      }
    }
    if (dirty) {
      const bk = path.join(BK, 'pass3-' + rel.replace(/[\\/:*?"<>|]/g, '__'));
      fs.mkdirSync(path.dirname(bk), { recursive: true });
      if (!fs.existsSync(bk)) fs.copyFileSync(p, bk);
      fs.writeFileSync(p, work);
      if (!syntaxOk(p)) {
        fs.writeFileSync(p, s);
        log.push(`${rel}: BROKEN SYNTAX after strip — REVERTED`);
      } else log.push(`${rel}: syntax OK`);
    }
  }
})(ROOT);

// ---- 2. beat-the-cat: create missing audio files ----
for (const [src, dst] of [[`${DL}/coin.mp3`, 'nima.mp3'], [`${POOL}/click.mp3`, 'end.mp3'], [`${POOL}/click.mp3`, 'type.mp3']]) {
  const d = path.join(ROOT, 'beat-the-cat/audio');
  fs.mkdirSync(d, { recursive: true });
  const target = path.join(d, dst);
  if (!fs.existsSync(target)) { fs.copyFileSync(src, target); log.push(`beat-the-cat/audio/${dst} created`); }
}

// ---- 3. card-memory-match: remove Google gtag block ----
{
  const ih = path.join(ROOT, 'card-memory-match/index.html');
  let s = fs.readFileSync(ih, 'utf8');
  const out = s.replace(/<!-- Google tag \(gtag\.js\) -->[\s\S]*?<\/script>\s*/i, '');
  if (out !== s) { fs.writeFileSync(ih, out); log.push('card-memory: gtag block removed'); }
}

// ---- 4. fortune-quiz-game: remove images/stats vendor script tag ----
{
  const ih = path.join(ROOT, 'fortune-quiz-game/index.html');
  let s = fs.readFileSync(ih, 'utf8');
  const out = s.replace(/<script[^>]*src=["'][^"']*images\/stats[^"']*["'][^>]*>\s*<\/script>\s*/gi, '');
  if (out !== s) { fs.writeFileSync(ih, out); log.push('fortune-quiz: images/stats tag removed'); }
}

console.log(log.join('\n') || '(nothing to do)');
console.log('pass3 done');
