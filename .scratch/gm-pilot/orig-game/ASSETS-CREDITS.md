# gold-miner 素材来源记录（2026-11-17 改造）

## 音频（全部 CC0，无需署名，此处仅记录出处）
- `snd/launch.mp3` — swish-7.wav，出自 "Swishes Sound Pack"（CC0）https://opengameart.org/content/swishes-sound-pack
- `snd/coin.mp3` — "10 8bit coin sounds"（CC0）https://opengameart.org/content/10-8bit-coin-sounds
- `snd/win.mp3` — "New thing get!"（CC0）https://opengameart.org/content/new-thing-get
- `snd/lose.mp3` — "Game over short jingle"（CC0）https://opengameart.org/content/game-over-short-jingle
- `snd/bgm.mp3` — "4 Chiptunes (Adventure) - 1. Stage 1"，作者 Juhani Junkala (subspaceaudio)（CC0）https://opengameart.org/content/4-chiptunes-adventure

## 图片（本次替换：t/dse/l1a-l3b 及全部 zz_* 缩放版）
- 标题 `t.jpg`（含"黄金矿工"标题字）、加载页 `dse.jpg`、地上条带 `l1a/l2a/l3a.jpg`、
  地下层 `l1b.jpg`（木支撑墙）、`l3b.jpg`（冻土）— 用 pollinations.ai 免费 API 生成
  （提示词工程 + ffmpeg 后处理：裁水印/去瑕疵/边缘延展/标题字烧录）
- 地下层 `l2b.jpg` — ffmpeg geq 程序化生成（沙丘波纹，非 AI）
- 原 dseffects.com 版素材备份于 `.scratch/gm-pilot/backup/`（不入版本库）

## 代码改动
- `index.html`：移除第三方 Share 按钮；追加 `audio.js`
- `audio.js`（新增，无侵入）：首次交互解锁 WebAudio；点击=出钩音效；
  `#hs` 得分增加=金币音效；BGM 循环（音量约为音效的 1/4）
