// Fix pass 6: last four nits.
import fs from 'node:fs';
import path from 'node:path';
const ROOT = 'D:/WorkProjects/AI/Lightgame/packages/games';
const log = [];

// 1. mebtnopenurl stub must be a string, not a function (island-quiz assigns it to img.src)
for (const id of ['island-quiz-game', 'ice-bucket-challenge']) {
  const p = path.join(ROOT, id, 'index.html');
  let s = fs.readFileSync(p, 'utf8');
  const out = s.replace(/window\.mebtnopenurl=window\.mebtnopenurl\|\|function\(\)\{\};/g, "window.mebtnopenurl=window.mebtnopenurl||'./';");
  if (out !== s) { fs.writeFileSync(p, out); log.push(id + ': mebtnopenurl stub -> string'); }
}

// 2. super-mario: drop img/bg.png css ref (file never existed)
{
  const p = path.join(ROOT, 'super-mario-adventure/index.html');
  let s = fs.readFileSync(p, 'utf8');
  const out = s.replace(/url\(["']?img\/bg\.png["']?\)\s*no-repeat\s*#09080d/gi, '#09080d');
  if (out !== s) { fs.writeFileSync(p, out); log.push('super-mario: bg.png css ref dropped'); }
}

// 3. super-shooter: load auth/api.js (defines Auth9G used at line ~147)
{
  const p = path.join(ROOT, 'super-shooter-football/index.html');
  let s = fs.readFileSync(p, 'utf8');
  if (!/auth\/api\.js/.test(s)) {
    s = s.replace(/<\/head>/i, m => '<script src="auth/api.js"></script>\n' + m);
    fs.writeFileSync(p, s);
    log.push('super-shooter: auth/api.js loaded');
  }
}

console.log(log.join('\n') || '(nothing)');
console.log('pass6 done');
