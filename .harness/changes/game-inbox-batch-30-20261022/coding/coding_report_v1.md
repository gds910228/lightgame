# 编码报告 v1 — inbox 30 游戏批量接入

## 范围
将 packages/games/games-inbox/ 下 30 个旧平台 HTML5 游戏按 11 步流水线迁移为平台标准游戏,目录名改为英文 kebab-case。其中 15 个已有英文 id(前次中断产物,本次补做清洗/修复),15 个原始拼音目录为本次新接入。

## 改动文件规模
- 30 个游戏目录;每游戏 1 个独立 commit(commit 哈希见 coding/ledger.md),源侧改动总计约 110 个文件(入口重写、JS 文案、CSS 远程图本地化、metadata.json 新增、删除追踪器/注入器)。
- 新增资源:skyscraper-stack 缺失 cocos2d-html5 v3.0-alpha2 引擎(联网下载,2.1MB,保留 MIT 许可头)+ underscore 1.3.3(CDN 下载,保留许可);少量静音占位音(smartphone-shooter、wildflower-picker)、自制中性封面/加载/三屏图(money/tickle/peach/2048/tap-frenzy)。

## 翻译串数
逐游戏统计于 ledger.md。总计约 320 处玩家可见中文/暗示文案改为自然英文;压缩 JS 中 \uXXXX 字符串均精确替换。性暗示文案(mnbyg/memeda/maomi)按 HITL 决议中性化,真人照片素材在无露骨内容前提下保留并登记。

## 删除的追踪器/外链/注入(每游戏明细见 ledger)
- 统计:tajs.qq.com(11 个游戏)、linezing tongji.gif(3)、Google Analytics、百度 hm.baidu。
- 推广/外链:lanrenmb 全量、mmbiz.qpic.cn、mp.weixin.qq.com 关注文章、46465/apiwck/345.gd OAuth、dwz.cn/heirui.cn/sinaimg 背景、vdcom.cn CSS 远程图、oixm/hiemma/peagame 随机域、42.121.113.35 排行榜、httpbin UA 探测、mmbiz CDN 分享图。
- 注入器(重点):zepto/min.js 尾部 packer(o.js)3 处、menu.js 尾部 packer 1 处、jsgamemin 尾部 vbaitong 注入、game-min 尾部 9g packer 2 处、nddsc 9g 注入、全部移除;所有 eval(function 远程注入清零。
- 广告:百度联盟 cpro_id、showAd/hideAd 空桩保留兼容。

## 图片美术字登记(标准允许,逐项见 ledger「烘焙中文图」列)
典型:监狱风云 logo、开心消消乐(face/prison)、密室逃脱 1.jpg、萌萌跳跳兔标题、摩天楼 texture 水印、能打多少次 uiTex、开始/更多/分享按钮图集(nddsc/save-sperm)、人民币图、命悬一线 start/more。

## 修复的既有缺陷(前次中断的 15 个)
- sea-treasure-match:旧平台 splash 自隐藏在现代浏览器失效导致卡加载 + 音频 play/pause promise 未捕获。
- soccer-dash:Crafty.load(数组)在 0.7.1 被忽略致开始按钮不绑定 + canvas 旧 API 初始化。
- smartphone-shooter:res/camera.mp3 缺失 404。
- wildflower-picker:音频扩展格式探测 404(补 ogg/m4a 静音占位)。
- save-the-sperm:logoData 空串致 Loading 场景 e.height 异常。

## 验证证据
- `node scripts/validate-games.js` → All games passed. Total: 82(52+30)
- `node packages/app/scripts/build-games-list.js` → Successfully wrote 82 games
- `npm run validate:games` 同。
- puppeteer headless 对 30 个游戏逐一加载:pageerror=0(分批 sweep,2026-10-22/23)。
- 每游戏人工/自动截图确认渲染,证据截图在 /tmp/lgshots/*(开发机临时目录,报告记录关键画面结论)。
- `npm run lint` → 0 warning;`npm run build` → 成功(82 游戏入 dist)。
- 例外:fail.fail(SoundJS 能力探测)、w3.org DTD/命名空间、引擎 UA 枚举(wechat/micromessenger)、引擎/许可 URL(jquery/cocos2d/underscore/craftyjs/zlib github)按标准登记豁免。
