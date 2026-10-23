# 任务清单:inbox 30 游戏批量接入

> 阶段1产出 | 每游戏一条 Task,固定 10 步流水线;完成一个移动一个、commit 一个

## 任务依赖图

- Task 1–30 互相独立(不同游戏目录),但共享 main 工作区 → 串行执行(规范:不让多个 implementer 并行冲突)。
- Task 31(收尾)依赖 1–30 全部完成。
- 顺序:G1–G13 已清洁游戏复验 → G14 dots-mania → G15 hyper-gunner → G16–G30 原始游戏(由易到难)。

## Task 0:环境准备(已完成)

- [x] `npm install`(workspace,根目录)
- [x] git init + 基线 commit `71e81ea`(zip 不含 .git)
- [x] 取证工具:/tmp/lgcheck.py(资源+词表+中文)、/tmp/pup/lgplay.js(puppeteer-core+系统 chromium,prison-whack 冒烟通过)
- [x] AJV 单游戏 metadata 校验脚本待 G1 前在 /tmp 落地(同 scripts/schemas/metadata.schema.json + 九枚举白名单 + 图片存在性)

## 每游戏标准 11 步(适用 Task G1–G30,v2)

1. 移动/重命名:`packages/games/games-inbox/<old>` → `packages/games/<id>`;.htm→index.html 并同步引用;字节级编码复检(GBK→UTF-8,含无扩展名文件)
2. 入口头部:`<html lang="en">`、英文 title/description/keywords、保留 viewport/charset
3. metadata.json(id/title/category 九枚举/description/controls + tags/author/version);**image 与 thumbnail 都显式提供且指向真实文件**;/tmp AJV 单游戏校验通过
4. 中文英文化:HTML/JS 原文 + 压缩 JS 的 \uXXXX **仅替换玩家可见串**(引擎串保留登记);canvas 字体名与 CSS font-family 中文字体名(黑体/宋体/微软雅黑/STHeiti/STXihei 等)→ sans-serif
5. 平台桥接(prison-whack 范式):lgShare/lgGoHome + 旧名别名;submitScore 类仅更新分享文案,禁止 confirm/alert/自动分享/外跳
6. 删除旧平台代码:17 词词表全部追踪器/外链/微信桥/朋友圈蒙层/广告(cpro_id/ad.htm/show_ads.js/ga.js/广告 iframe;showAd/hideAd 空桩去调用)/packer 注入(o.js、nddsc 尾注入、mnygl 注释 packer);**远程 `<script src=http>` 库下载内置保留许可头**(G15 校验 jquery 版本一致);远程图床/音频改本地;裸 IP 端点(42.121.113.35、218.244.142.3 等)删除;死代码死引用清理
7. 三道扫描:① 17 词原正则;② 通用 `grep -rnoE "https?://[a-z0-9.-]+"`(许可头/DTD 豁免登记);③ `grep -n "[一-鿿]" index.html`。豁免项四列登记(文件:行号/串/不可见理由/处置)
8. 质量检查:改动 JS 全部 `node --check`;/tmp/lgcheck.py 资源完整性(入口引用 + metadata 图片全部存在)
9. headless 取证:puppeteer+chromium 真实等待(必要时点屏),截图人工目检渲染;未捕获 JS 异常=0;远端 requestfailed=0(favicon 类登记);console 日志与截图存 /tmp/lgshots
10. 记录证据到 coding_report:改动文件数/翻译串数/删除外链与追踪器清单/烘焙中文图清单/豁免四列表/截图与日志结论
11. 源侧 commit(仅 packages/games/<id>,全角括号):`game: 接入 <id>(<English Title>)`,记录 hash

> 失败品处置:无法修复 → `git mv`(或移动)至 `archive/inbox-failed/<原名>/` + 独立 `chore:` commit + 报告说明,不静默丢弃。

## Task 1–13:已清洁游戏复验补缺

- [ ] G1 face-pair-match | G2 lumberjack-tap | G3 monster-shooter-rush | G4 prison-memory-match
- [ ] G5 prison-whack | G6 sea-treasure-match | G7 tile-tap-rush(标杆复验)
- [ ] G8 nerve-cat-launch(登记引擎 UA 串) | G9 save-the-sperm(同) | G10 wildflower-picker(同)
- [ ] G11 smartphone-shooter(改写含 legacy 词元的注释)
- [ ] G12 soccer-dash(审查 isWeixin 分支,去微信特有行为/外跳,UA 判定若仅用于布局可降级保留)
- [ ] G13 find-the-different-face(m.min.css `'微软雅黑'` → sans-serif)

## Task 14–15:带 metadata 但未清洗

- [ ] G14 dots-mania:index.html 导航/分享块、5 个 JS 中文、删 o.js(51.la packer)及其引用
- [ ] G15 hyper-gunner:重建为整洁目录(删 ad.htm/HyperGunner_files 中 ga.js/show_ads.js/_pagevisit.htm 等 IE 残骸),jquery 改用本地已有副本 HyperGunner_files/jquery-1.6.2.min.js(保留许可头),WeixinJSBridge/lanrenmb 清除,textdata 文案英文化

## Task 16–30:15 个原始游戏

- [ ] G16 mxcz → dream-merge-2048(Puzzle):2048 词条/UI 英文,linezing 像素、46465/apiwck、lanrenmb、微信块删除
- [ ] G17 maomi → tap-frenzy(Arcade):10 秒戳按钮;性暗示文案/评级中性化;tajs/微信块删除;mm.jpg/knydh.png vision 核查
- [ ] G18 naoyangyang → tickle-frenzy(Arcade):CSS 远程图床 URL 全改本地 vapp/35;缺图处理;tajs/微信块;ready/go/share 中文切图登记
- [ ] G19 nddsc → how-many-hits(Arcade):删 game.min.js 尾部 packed eval 注入;4 个 canvas 中文字符串;UI 中文切图登记
- [ ] G20 mnygl → mummy-maze-escape(Puzzle):默认英文切图、去语言切换;tajs、注释 packer、9g 注释清理;alert 中文改英文;中文封面登记
- [ ] G21 mingxuanyixian → tightrope-walker(Arcade):默认英文切图;SEO 垃圾标题修正;微信/lanrenmb 清理;资源完整性
- [ ] G22 mishi → room-escape-reaction(Arcade):play68 侧栏/微信块/tajs 清理,默认英文切图;桥接 play68_submitScore
- [ ] G23 mmttt → moon-rabbit-jump(Arcade):egret 压缩 JS 约 12 个游戏可见 \uXXXX 串替换(引擎 600+ 串保留登记);删 42.121.113.35 排行榜/test 端点与 httpbin.org、mmbiz 图;eval 上下文核查(引擎内部则登记)
- [ ] G24 money → cash-catch-rush(Arcade):.htm→html;双腾讯统计(含 files/stats.js)删除;sinaimg 远程背景本地化/移除;dwz/heirui 外链删;财富文案中性;eval(cookie) 改写
- [ ] G25 mzpk → name-duel(Casual):nf.min.js 约 45 个 \uXXXX 文案英文化(粗俗梗中性化);微信 OAuth 红包漏斗/46465/345.gd 删除;img/win.jpg 缺失处理;nbproject 清理
- [ ] G26 memeda → peek-and-pop(Arcade):15 张照片 URL 改本地;linezing、lanrenmb、微信块删;评级/结果文案中性化;vision 核查照片
- [ ] G27 mnbyg → pop-star-tap(Arcade):同 memeda 类清洗;mblogpic 照片保留+中性文案;微信文章/lanrenmb 删除
- [ ] G28 monkey → peach-catch-frenzy(Casual):品牌促销三屏中文图与领奖死按钮处理;jPlayer 死依赖删;loader 中文串翻译;lanrenmb 清理;无法替换的中文整图登记
- [ ] G29 ndtnrgclm → retro-game-tune-quiz(Quiz):约 80 串翻译;百度联盟 cpro_id 广告位/假人数删;mmbiz/微信/lanrenmb 清理;配乐版权例外显著标注
- [ ] G30 mtl → skyscraper-stack(Casual):尝试内置 cocos2d-html5 engine.js(联网获取匹配版本,保留 MIT 头)启动游戏;tajs/BS SDK 外呼(pictoword.hortorgame、42.x 裸 IP)/9g/关注广告删除;地标表去天安门换全球地标;**修复失败 → 移动到 archive/inbox-failed/mtl/ 并独立 chore commit+报告**,不留 inbox

## Task 31:收尾交付(依赖 G1–G30)

- [ ] 无条件删除 `packages/games/games-inbox/` 目录本身(空目录也会致 validate 报红);清理空杂散目录 packages/find-the-different-face/
- [ ] `npm run sync-games`(0 skip 0 error)
- [ ] `npm run build:games:list`;核对 games.json 条数 = 52 + 接入成功数
- [ ] sitemap.xml 按接入清单追加 N 条,严格对齐现有格式:`2026-10-22T00:00:00+00:00` / monthly / 0.8;现存量 51 条(历史漂移,不修)在报告说明
- [ ] `npm run lint`(0 warning) / `npm run build`(成功) / `npm run validate:games`(通过且数量=52+接入成功数),输出留 ci_result/
- [ ] **独立 chore commit**:`chore: sync 生成物并追加 sitemap`(public/games + games.json + sitemap.xml)
- [ ] coding_report_v1 / summary 填写;最终报告(清单表+例外+门禁输出)
- [ ] 派发 code-reviewer 整体复审(阶段 4)

## 全局验证

- [ ] lint / build / validate:games 三件套取证
- [ ] 30(或 29+1 归档)个 game commit + 1 个生成物 chore commit
- [ ] 不 push、不部署
