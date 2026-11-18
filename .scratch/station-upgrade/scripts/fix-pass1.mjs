// Fix pass 1: strip dead vendor scripts, add missing-global stubs, fix immortal-warrior path.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'D:/WorkProjects/AI/Lightgame/packages/games';
const BK = 'D:/WorkProjects/AI/Lightgame/.scratch/station-upgrade/backup';
fs.mkdirSync(BK, { recursive: true });
const smoke = JSON.parse(fs.readFileSync('D:/WorkProjects/AI/Lightgame/.scratch/station-upgrade/smoke.json', 'utf8'));

const DEAD = /pingtcss|tajs\.qq|ossweb-img|tongji\.linezing|linezing|100bt|lanrenmb|vbaitong|myqcloud|cnzz|umeng/i;

function backup(id, file) {
  const dst = path.join(BK, id + '-' + file);
  if (!fs.existsSync(dst)) fs.copyFileSync(path.join(ROOT, id, file), dst);
}

function stripDeadScripts(html) {
  // <script src="...dead..."></script>
  let out = html.replace(/<script[^>]*\ssrc=["'][^"']*["'][^>]*>\s*<\/script>/gi, m => DEAD.test(m) ? '' : m);
  // inline <script> ... dead ... </script> (skip if it also defines something else we need — accept removal)
  out = out.replace(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/gi, m => DEAD.test(m) ? '' : m);
  return out;
}

const changed = [], stubs = [];
for (const r of smoke) {
  const id = r.id;
  const needsStrip = [...r.failedReq, ...r.consoleErrors].some(u => DEAD.test(u));
  const needsStub = r.pageErrors.some(e => /_hmt|mebtnopenurl/i.test(e));
  if (!needsStrip && !needsStub) continue;
  const ih = path.join(ROOT, id, 'index.html');
  let html = fs.readFileSync(ih, 'utf8');
  backup(id, 'index.html');
  if (needsStrip) html = stripDeadScripts(html);
  if (needsStub) {
    html = html.replace(/<head[^>]*>/i, m => m + '\n<script>window._hmt=window._hmt||[];window.mebtnopenurl=window.mebtnopenurl||function(){};window.isDebugEnabled=true;</script>');
    stubs.push(id);
  }
  fs.writeFileSync(ih, html);
  changed.push(id);
}

// immortal-warrior: requirejs data-main points to js/main but file is at root
{
  const ih = path.join(ROOT, 'immortal-warrior/index.html');
  let html = fs.readFileSync(ih, 'utf8');
  backup('immortal-warrior', 'index.html');
  html = html.replace('data-main="js/main"', 'data-main="main"');
  // drop stale injected duplicate loader if present
  html = html.replace(/^\s*<script[^>]*data-requiremodule="main"[^>]*>\s*<\/script>\s*$/gim, '');
  fs.writeFileSync(ih, html);
  changed.push('immortal-warrior');
}

console.log('changed:', changed.length);
console.log(changed.join('\n'));
console.log('stubs injected:', stubs.join(', ') || '(none)');
