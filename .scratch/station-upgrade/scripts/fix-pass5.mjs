// Fix pass 5: last 6 items.
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = 'D:/WorkProjects/AI/Lightgame/packages/games';
const BK = 'D:/WorkProjects/AI/Lightgame/.scratch/station-upgrade/backup';
const log = [];
function bk(p, tag) { const d = path.join(BK, 'pass5'); fs.mkdirSync(d, { recursive: true }); const t = path.join(d, tag); if (!fs.existsSync(t)) fs.copyFileSync(p, t); }

// 1. super-shooter easing: file truncated mid-license-comment — append closer
{
  const p = path.join(ROOT, 'super-shooter-football/js/jquery.easing.1.3.js');
  bk(p, 'jquery.easing.1.3.js');
  let s = fs.readFileSync(p, 'utf8');
  if (!/\*\//.test(s.slice(s.lastIndexOf('/*')))) {
    s = s.replace(/\s*$/, '\n */\n');
    fs.writeFileSync(p, s);
    try { execSync(`node --check "${p}"`, { stdio: 'pipe' }); log.push('easing: closer appended, syntax OK'); }
    catch (e) { log.push('easing: still broken — ' + String(e).slice(0, 80)); }
  } else log.push('easing: closer present?');
}

// 2. super-mario: remove images/stat.php script tag (contains pingtcss writer)
{
  const p = path.join(ROOT, 'super-mario-adventure/index.html');
  bk(p, 'super-mario-index.html');
  let s = fs.readFileSync(p, 'utf8');
  const out = s.replace(/<script[^>]*src=["'][^"']*stat\.php[^"']*["'][^>]*>\s*<\/script>\s*/gi, '');
  if (out !== s) { fs.writeFileSync(p, out); log.push('super-mario: stat.php tag removed'); }
  else log.push('super-mario: stat.php tag not found in html (check inline)');
}

// 3. fortune-money: animated_cloud.png placeholder (soft white cloud blob)
{
  const p = path.join(ROOT, 'fortune-money-game/animated_cloud.png');
  if (!fs.existsSync(p)) {
    execSync(`ffmpeg -y -v error -f lavfi -i "gradients=s=260x120:c0=0xffffff:c1=0xe8ecf2" -vf "geq=r='255':g='255':b='255-alpha*(X-W/2)*(X-W/2)/8000*(Y-H/2)*(Y-H/2)/3000':a=1" -frames:v 1 "${p}" 2>/dev/null || ffmpeg -y -v error -f lavfi -i "color=c=white:s=260x120" -frames:v 1 "${p}"`);
    log.push('fortune-money: animated_cloud.png created');
  }
}

// 4. island-quiz: literal function(){} file (vendor code requests it as an asset)
{
  const p = path.join(ROOT, 'island-quiz-game/function(){}');
  if (!fs.existsSync(p)) { fs.writeFileSync(p, ''); log.push('island-quiz: function(){} stub file created'); }
}

// 5. stack-wood: i/xwuz.png placeholder
{
  const p = path.join(ROOT, 'stack-wood-game/i/xwuz.png');
  if (!fs.existsSync(p)) {
    execSync(`ffmpeg -y -v error -f lavfi -i "gradients=s=64x64:c0=0x8a5a2b:c1=0x5a3a1b" -frames:v 1 "${p}"`);
    log.push('stack-wood: i/xwuz.png created');
  }
}

// 6. ice-bucket: _hmt stub (its inline caller survived the strip)
{
  const p = path.join(ROOT, 'ice-bucket-challenge/index.html');
  bk(p, 'ice-index.html');
  let s = fs.readFileSync(p, 'utf8');
  if (!/window\._hmt\s*=/.test(s)) {
    s = s.replace(/<head[^>]*>/i, m => m + '\n<script>window._hmt=window._hmt||[];window.mebtnopenurl=window.mebtnopenurl||function(){};</script>');
    fs.writeFileSync(p, s);
    log.push('ice-bucket: _hmt stub injected');
  } else log.push('ice-bucket: stub already present');
}

console.log(log.join('\n'));
console.log('pass5 done');
