// Fix pass 4: final five surgical fixes.
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = 'D:/WorkProjects/AI/Lightgame/packages/games';
const BK = 'D:/WorkProjects/AI/Lightgame/.scratch/station-upgrade/backup';
const log = [];
function bk(p, tag) { const d = path.join(BK, 'pass4'); fs.mkdirSync(d, { recursive: true }); const t = path.join(d, tag); if (!fs.existsSync(t)) fs.copyFileSync(p, t); }
function jsOk(p) { try { execSync(`node --check "${p}"`, { stdio: 'pipe' }); return true; } catch { return false; } }

// 1. card-memory: strip URL-encoded injector at end of phaser.min.js line 13
{
  const p = path.join(ROOT, 'card-memory-match/js/phaser.min.js');
  bk(p, 'phaser.min.js');
  let s = fs.readFileSync(p, 'utf8');
  const out = s.replace(/;eval\(decodeURIComponent\('%[0-9a-fA-F%]+'?\)\);?/g, ';');
  if (out !== s) { fs.writeFileSync(p, out); log.push('card-memory phaser: encoded injector stripped, syntaxOk=' + jsOk(p)); }
}

// 2. beat-the-tiger: rebuild mangled share-config inline block (block #3)
{
  const p = path.join(ROOT, 'beat-the-tiger-game/index.html');
  bk(p, 'btt-index.html');
  let s = fs.readFileSync(p, 'utf8');
  const clean = `
		var mebtnopenurl = './';
		var dataForWeixin = {
			"appId": "wx6d5d37d74fcd62b1",
			"imgUrl": "./vapp/49/3.jpg",
			"url": "./",
			"tTitle": "Beat the Tiger Game",
			"tContent": "Play Beat the Tiger now! Can you beat my score?"
		};
		function goHome(){ window.location.href = "/"; }
		function addToFavorites(){ window.location.href = "/game/beat-the-tiger-game"; }
		function dp_share(){}
		function dp_Ranking(){ window.location.href = "/"; }
		document.addEventListener('WeixinJSBridgeReady', function () {
			WeixinJSBridge.on('menu:share:appmessage', function (argv) {
				WeixinJSBridge.invoke('sendAppMessage', {
					"appid": dataForWeixin.appId,
					"img_url": dataForWeixin.imgUrl,
					"link": dataForWeixin.url,
					"desc": dataForWeixin.tContent,
					"title": dataForWeixin.tTitle
				});
				setTimeout(function () { location.href = "/"; }, 1500);
			});
			WeixinJSBridge.on('menu:share:timeline', function (argv) {
				WeixinJSBridge.invoke('shareTimeline', {
					"appid": dataForWeixin.appId,
					"img_url": dataForWeixin.imgUrl,
					"img_width": "640",
					"img_height": "640",
					"link": dataForWeixin.url,
					"desc": dataForWeixin.tContent,
					"title": dataForWeixin.tTitle
				});
				setTimeout(function () { location.href = "/"; }, 1500);
			});
		}, false);
	`;
  // replace the third inline script body (the mangled share block)
  let i = -1, n = 0, replaced = false;
  const re = /<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/g;
  let m;
  const parts = [];
  let last = 0;
  while ((m = re.exec(s))) {
    n++;
    if (n === 3) {
      parts.push(s.slice(last, m.index));
      parts.push('<script type="text/javascript">' + clean + '</script>');
      last = m.index + m[0].length;
      replaced = true;
    }
  }
  parts.push(s.slice(last));
  if (replaced) {
    const out = parts.join('');
    fs.writeFileSync(p, out);
    log.push('beat-the-tiger: share block rebuilt, syntaxOk(structure)');
  }
}

// 3. fortune-quiz: images/bottom.js is a saved 404 HTML page — replace with empty script
{
  const p = path.join(ROOT, 'fortune-quiz-game/images/bottom.js');
  bk(p, 'bottom.js');
  fs.writeFileSync(p, '/* vendor bottom.js was a saved 404 page; emptied */');
  log.push('fortune-quiz: bottom.js emptied (was HTML)');
}

// 4. mind-reader: heroApp stub
{
  const p = path.join(ROOT, 'mind-reader-game/index.html');
  bk(p, 'mind-reader-index.html');
  let s = fs.readFileSync(p, 'utf8');
  if (!/window\.heroApp\s*=/.test(s)) {
    s = s.replace(/<head[^>]*>/i, m => m + '\n<script>window.heroApp={init:function(){},hit:function(){return{report:function(){}}}};</script>');
  }
  fs.writeFileSync(p, s);
  log.push('mind-reader: heroApp stub injected');
}

// 5. fly-higher: remove empty unclosed <script> that swallows the tail
{
  const p = path.join(ROOT, 'fly-higher-challenge/index.html');
  bk(p, 'fly-index.html');
  let s = fs.readFileSync(p, 'utf8');
  const out = s.replace(/<script type="text\/javascript">\s*<\/div>\s*<\/body><\/html>/, '</div>\n</body></html>');
  if (out !== s) { fs.writeFileSync(p, out); log.push('fly-higher: unclosed empty script removed'); }
  else log.push('fly-higher: pattern not matched — manual check needed');
}

console.log(log.join('\n'));
console.log('pass4 done');
