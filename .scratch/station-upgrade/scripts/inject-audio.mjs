// P1: inject generic audio layer (BGM + tap sound + mute button) into truly-silent games.
// Skips games that already have audio.js. Backs up every index.html before patching.
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = 'D:/WorkProjects/AI/Lightgame/packages/games';
const BK = 'D:/WorkProjects/AI/Lightgame/.scratch/station-upgrade/backup';
const POOL = 'D:/WorkProjects/AI/Lightgame/.scratch/station-upgrade/audiopool';
const DL = 'D:/WorkProjects/AI/Lightgame/.scratch/gm-pilot/dl';
fs.mkdirSync(POOL, { recursive: true });
fs.mkdirSync(BK, { recursive: true });

// 1) build normalized audio pool (peak -1.5dB)
function norm(src, dst, extra = 'anull', gainOffset = -1.5) {
  const peak = parseFloat(execSync(`ffmpeg -i "${src}" -af volumedetect -f null - 2>&1 | grep max_volume`).toString().match(/(-?[\d.]+) dB/)[1]);
  const gain = (gainOffset - peak).toFixed(2);
  execSync(`ffmpeg -y -v error -i "${src}" -af "volume=${gain}dB,${extra}" -ar 44100 -ac 2 -b:a 96k "${dst}"`);
  console.log('pool:', path.basename(dst));
}
norm(`${DL}/bgm_stage1.ogg`, `${POOL}/bgmA.mp3`);
norm(`${DL}/bgm_Stage.ogg`, `${POOL}/bgmB.mp3`);
norm(`${DL}/bgm_BossFight.ogg`, `${POOL}/bgmC.mp3`);
norm(`${DL}/bgm_StageSelect.ogg`, `${POOL}/bgmD.mp3`);
norm(`${DL}/swishes/swishes/swish-12.wav`, `${POOL}/click.mp3`, 'anull', -6); // subtle tap

// 2) inject into target games
const targets = JSON.parse(fs.readFileSync('D:/WorkProjects/AI/Lightgame/.scratch/station-upgrade/sound-in-code.json', 'utf8'))
  .filter(g => !g.soundInCode).map(g => g.id)
  .filter(id => !fs.existsSync(path.join(ROOT, id, 'audio.js'))); // gold-miner has own layer

const audioJs = fs.readFileSync('D:/WorkProjects/AI/Lightgame/.scratch/station-upgrade/scripts/audio-generic.js', 'utf8');
const sources = `# 本游戏 snd/ 音频来源 — 全部 CC0
- bgm.mp3 — "4 Chiptunes (Adventure)"（Stage 1/2、Boss Fight、Stage Select 之一），作者 Juhani Junkala (subspaceaudio)，CC0：https://opengameart.org/content/4-chiptunes-adventure
- click.mp3 — swish-12.wav，"Swishes Sound Pack"，CC0：https://opengameart.org/content/swishes-sound-pack
经 ffmpeg 峰值归一（-1.5dBFS）后转 44.1kHz mp3。`;

const done = [], skipped = [];
function hashIdx(s, n) { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h % n; }

for (const id of targets) {
  const dir = path.join(ROOT, id);
  const ih = path.join(dir, 'index.html');
  if (!fs.existsSync(ih)) { skipped.push(id + ' (no index.html)'); continue; }
  let html = fs.readFileSync(ih, 'utf8');
  if (/audio\.js/.test(html)) { skipped.push(id + ' (already has audio.js)'); continue; }
  try { fs.mkdirSync(path.join(dir, 'snd'), { recursive: true }); } catch {}
  const bgm = ['bgmA', 'bgmB', 'bgmC', 'bgmD'][hashIdx(id, 4)];
  fs.copyFileSync(`${POOL}/${bgm}.mp3`, path.join(dir, 'snd/bgm.mp3'));
  fs.copyFileSync(`${POOL}/click.mp3`, path.join(dir, 'snd/click.mp3'));
  fs.writeFileSync(path.join(dir, 'snd/SOURCES.md'), sources);
  fs.writeFileSync(path.join(dir, 'audio.js'), audioJs);
  fs.copyFileSync(ih, path.join(BK, id + '-index.html'));
  const tag = '\t<script src="audio.js?v=1"></script>\n';
  if (/<\/body>/i.test(html)) html = html.replace(/<\/body>/i, tag + '</body>');
  else html += tag;
  fs.writeFileSync(ih, html);
  done.push(`${id}(${bgm})`);
}
console.log(`\ninjected: ${done.length}`);
console.log(done.join('\n'));
console.log('skipped:', skipped.join(', ') || '(none)');
