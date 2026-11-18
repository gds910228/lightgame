// Fix pass 2: repair pass-1 collateral damage + missing assets + in-JS dead links.
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = 'D:/WorkProjects/AI/Lightgame/packages/games';
const BK = 'D:/WorkProjects/AI/Lightgame/.scratch/station-upgrade/backup';
const POOL = 'D:/WorkProjects/AI/Lightgame/.scratch/station-upgrade/audiopool';
const DEAD_HOST = /(pingtcss|tajs\.qq|ossweb-img|tongji\.linezing|linezing|100bt|lanrenmb|vbaitong|myqcloud|cnzz|umeng|game\.9g\.com)/i;
const GIF = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
const log = [];

function read(p) { return fs.readFileSync(p, 'utf8'); }
function write(p, s) { fs.writeFileSync(p, s); }
function backupOf(id) { return path.join(BK, id + '-index.html'); }

// ---- 1. restore & re-strip pass-1 games ----
for (const f of fs.readdirSync(BK).filter(f => f.endsWith('-index.html'))) {
  const id = f.replace(/-index\.html$/, '');
  const ih = path.join(ROOT, id, 'index.html');
  let orig = read(backupOf(id)); // pre-pass1 state
  // (a) remove dead <script src> tags (tight, no content crossing)
  let out = orig.replace(/<script[^>]*\ssrc=["'][^"']*["'][^>]*>[^<]*<\/script>/gi, m => DEAD_HOST.test(m) ? '' : m);
  // (b) remove inline blocks only when pure-analytics: small, dead, no function defs
  out = out.replace(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/gi, (m, body) =>
    (body.length < 2000 && DEAD_HOST.test(body) && !/function\s+\w+\s*\(/.test(body)) ? '' : m);
  // safety: function-def count must not drop
  const before = (orig.match(/function\s+\w+\s*\(/g) || []).length;
  const after = (out.match(/function\s+\w+\s*\(/g) || []).length;
  if (after < before) { out = orig; log.push(`${id}: RESTORED-AS-IS (strip would lose functions)`); }
  else log.push(`${id}: re-stripped ok`);
  if (id === 'immortal-warrior') out = out.replace('data-main="js/main"', 'data-main="main"');
  // restore audio tag if this game has the station audio layer (injection backups overwrote pass-1 backups)
  if (fs.existsSync(path.join(ROOT, id, 'audio.js')) && fs.existsSync(path.join(ROOT, id, 'snd/bgm.mp3')) && !/audio\.js/.test(out)) {
    out += '\n<script src="audio.js?v=1"></script>\n';
    log.push(`${id}: audio tag re-appended`);
  }
  write(ih, out);
}

// ---- 2. color-brain: drop saved_resource (a saved 404 page loaded as JS) ----
{
  const ih = path.join(ROOT, 'color-brain-challenge/index.html');
  let html = read(ih);
  html = html.replace(/<script[^>]*src=["'][^"']*saved_resource[^"']*["'][^>]*>\s*<\/script>/gi, '');
  write(ih, html);
  log.push('color-brain: saved_resource tag removed');
}

// ---- 4. mind-reader: ISDSpeed stub ----
{
  const ih = path.join(ROOT, 'mind-reader-game/index.html');
  let html = read(ih);
  if (!/window\.ISDSpeed\s*=/.test(html)) {
    html = html.replace(/<head[^>]*>/i, m => m + '\n<script>window.ISDSpeed={hit:function(){return{report:function(){}}}};</script>');
  }
  write(ih, html);
  log.push('mind-reader: ISDSpeed stub injected');
}

// ---- 5. missing local assets ----
function cp(src, dst) { fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.copyFileSync(src, dst); log.push(`asset: ${path.relative(ROOT, dst)} created`); }
cp(path.join(ROOT, 'air-strike-battle/img/pd8.png'), path.join(ROOT, 'air-strike-battle/img/pd9.png'));
cp(path.join(ROOT, 'island-quiz-game/resource/17.jpg'), path.join(ROOT, 'island-quiz-game/resource/53.jpg'));
cp(path.join(ROOT, 'moon-rabbit-jump/resource/assets/bigmap.png'), path.join(ROOT, 'moon-rabbit-jump/resource/assets/bg1.png'));
cp(path.join(POOL, 'bgmA.mp3'), path.join(ROOT, 'immortal-warrior/sound/1.mp3'));

// bunny-tower share refs -> local file
{
  const ih = path.join(ROOT, 'bunny-tower-jump/index.html');
  let html = read(ih);
  const share = path.join(ROOT, 'bunny-tower-jump/share.png');
  if (!fs.existsSync(share)) {
    const anyImg = fs.readdirSync(path.join(ROOT, 'bunny-tower-jump')).find(f => /\.(png|jpg)$/i.test(f));
    if (anyImg) cp(path.join(ROOT, 'bunny-tower-jump', anyImg), share);
  }
  html = html.replace(/\/games\/bttz\/share\.png/g, 'share.png');
  write(ih, html);
  log.push('bunny-tower: share.png local + refs patched');
}

// egyptian: broken save-page src -> existing asset
{
  const ih = path.join(ROOT, 'egyptian-iq-test/index.html');
  let html = read(ih);
  html = html.replace(/src=["']\.\/[^"']*?_files\/460["']/g, 'src="./2000.png"');
  write(ih, html);
  log.push('egyptian: broken _files/460 src -> 2000.png');
}

// fiery-dragon: empty adsense.htm for hidden iframe
{
  const p = path.join(ROOT, 'fiery-dragon/Dragons_files/adsense.htm');
  fs.mkdirSync(path.dirname(p), { recursive: true });
  write(p, '<!doctype html><html><body></body></html>');
  log.push('fiery-dragon: adsense.htm placeholder created');
}

// fortune-quiz: CSS url(img/bg.png) -> solid color
{
  const ih = path.join(ROOT, 'fortune-quiz-game/index.html');
  let html = read(ih);
  html = html.replace(/url\(["']?img\/bg\.png["']?\)\s*no-repeat\s*#09080d/gi, '#09080d');
  write(ih, html);
  log.push('fortune-quiz: bg.png css ref dropped');
}

// beat-the-tiger: relative RESOURCE_IMG_PATH + local vapp assets
{
  const cj = path.join(ROOT, 'beat-the-tiger-game/js/code.js');
  let js = read(cj);
  js = js.replace('RESOURCE_IMG_PATH = RESOURCE_IMG_PATH || "/vapp/"', 'RESOURCE_IMG_PATH = RESOURCE_IMG_PATH || "vapp/"');
  write(cj, js);
  const vdir = path.join(ROOT, 'beat-the-tiger-game/vapp/49');
  fs.mkdirSync(vdir, { recursive: true });
  // simple loading gradient images
  execSync(`ffmpeg -y -v error -f lavfi -i "gradients=s=320x480:c0=0x2b3a55:c1=0x0e1626" -frames:v 1 "${path.join(vdir, 'loading.jpg')}"`);
  execSync(`ffmpeg -y -v error -f lavfi -i "gradients=s=320x480:c0=0x2b3a55:c1=0x0e1626" -frames:v 1 "${path.join(ROOT, 'beat-the-tiger-game/vapp/cover.jpg')}"`);
  execSync(`ffmpeg -y -v error -f lavfi -i "gradients=s=200x200:c0=0x2b3a55:c1=0x0e1626" -frames:v 1 "${path.join(ROOT, 'beat-the-tiger-game/vapp/rotate_tip.jpg')}"`);
  log.push('beat-the-tiger: vapp assets + relative path fix');
}

// stack-wood: i/bg1.png i/bg2.png i/flekk.png placeholders
{
  const idir = path.join(ROOT, 'stack-wood-game/i');
  execSync(`ffmpeg -y -v error -f lavfi -i "gradients=s=720x1280:c0=0x7ec8e3:c1=0x2b6d9f" -frames:v 1 "${idir}/bg1.png"`);
  execSync(`ffmpeg -y -v error -f lavfi -i "gradients=s=720x1280:c0=0xf4d58d:c1=0xc98f4e" -frames:v 1 "${idir}/bg2.png"`);
  execSync(`ffmpeg -y -v error -f lavfi -i "color=c=white:s=32x32" -frames:v 1 "${idir}/flekk.png"`);
  log.push('stack-wood: bg1/bg2/flekk placeholders');
}

// stock-trader: css/images/ajax-loader.gif
{
  const p = path.join(ROOT, 'stock-trader-pro/css/images/ajax-loader.gif');
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const png = path.join(ROOT, 'stock-trader-pro/css/images/_al.png');
  execSync(`ffmpeg -y -v error -f lavfi -i "gradients=s=16x16:c0=0xffffff:c1=0xdddddd" -frames:v 1 "${png}"`);
  execSync(`ffmpeg -y -v error -i "${png}" "${p}"`);
  fs.unlinkSync(png);
  log.push('stock-trader: ajax-loader.gif placeholder');
}

// ---- 6. dead-host URLs: remove dead <script src> tags, replace remaining refs with 1px gif ----
const affected = ['card-memory-match', 'dodge-the-lover', 'glass-bridge-challenge', 'super-shooter-football',
  'twins-match-up', 'ceo-fortune-quiz', 'secret-admirer-quiz', 'time-travel-quiz', 'island-quiz-game',
  'fiery-dragon', 'fortune-money-game', 'fortune-quiz-game', 'super-mario-adventure', 'beat-the-cat',
  'mind-reader-game', 'ice-bucket-challenge'];
for (const id of affected) {
  const dir = path.join(ROOT, id);
  (function walk(d) {
    for (const f of fs.readdirSync(d)) {
      const p = path.join(d, f);
      if (fs.statSync(p).isDirectory()) walk(p);
      else if (/\.(js|html|css)$/i.test(f)) {
        let s = read(p);
        const out = s
          .replace(/<script[^>]*\ssrc=["'][^"']*game\.9g\.com[^"']*["'][^>]*>[^<]*<\/script>/gi, '') // dead script tags must vanish, not become data-uri
          .replace(/(https?:\/\/)?((0\.vbaitong|g\.lanrenmb|api2\.gz\.\d+\.cee\.myqcloud|img\.tongji\.linezing|dc\.100bt|pingtcss\.qq|tajs\.qq|game\.9g)\.com)[^"'()\s\\]*/gi, GIF);
        if (out !== s) { write(p, out); log.push(`deadref: ${path.relative(ROOT, p)} cleaned`); }
      }
    }
  })(dir);
}

console.log(log.join('\n'));
console.log('pass2 done');
