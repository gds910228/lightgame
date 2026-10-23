# 需求规格:games-inbox 30 个 HTML5 游戏批量接入平台

> 阶段1产出 | request-analysis 生成 | 评审见 review/spec_review_vN.md
> 变更类型:game | 创建:2026-10-22 | 需求来源:用户迭代需求(见 `.autocase/input/prompt.md`)

## 1. 需求背景与目标

- **问题/机会**:`packages/games/games-inbox/` 积压 30 个中文旧平台(懒人模板 lanrenmb / 46465 / 9g 等)HTML5 游戏源码,含追踪器、外链、微信桥、广告、eval 注入、中文文案与敏感题材,未接入平台管线。
- **目标**:30 个游戏全部按 laser-defense 范式接入(重命名 + index.html + metadata.json + 英文化 + 平台桥接 + 清残留 + 验证),inbox 清空,生成物重建,sitemap 追加,本地门禁三件套通过,全程可追溯(每游戏一 commit + 报告)。
- **非目标**:不改 scripts/ 管线核心逻辑;不手改 games.json / public/games;不 push 不部署;不重绘美术;不重构与本需求无关的代码;sitemap 历史条目不修正。

## 2. 用户故事 / 验收标准

作为平台用户,我希望在游戏列表看到并游玩这 30 个游戏,全程英文、无外链跳转、无统计/广告、分享/首页按钮走平台桥,站点门禁全绿。

- [ ] 30 个目录以 `<id>` 位于 `packages/games/`,inbox 目录本身删除;目录名 = metadata.id = `/games/<id>/index.html`;无法修复的失败品移至仓库内 `archive/inbox-failed/<原名>/`(管线不扫描),原状保留+报告,不静默丢弃
- [ ] 每游戏入口 index.html:`lang="en"`、英文 title/description/keywords、viewport/charset 保留
- [ ] 每游戏 metadata.json 经 AJV(同 schema)+九枚举白名单+image/thumbnail 存在性校验;image 与 thumbnail 均显式提供且指向真实文件
- [ ] HTML/JS 玩家可见中文为 0(\uXXXX 仅替换可见串;canvas 与 CSS font-family 中文字体名改 sans-serif);图片美术字逐项登记
- [ ] 分享 → window.parent.handleGlobalShare(降级 navigator.share);更多/首页/排行榜 → /;submitScore 类回调只改分享文案,无 confirm/alert/自动分享/外跳;旧函数名保留为别名(范式以 prison-whack 为准,不复制 laser-defense 的自动分享)
- [ ] 追踪器/外链(含裸 IP)/微信桥/广告/广告桩调用/packer 注入全部删除(代码级,非注释);远程 JS 库下载内置并保留许可头
- [ ] 三道扫描:17 词正则为空 / 通用 http(s) URL 逐条删除或登记(许可头豁免)/ 入口中文为空;豁免仅限引擎不可见 UA 枚举与许可头,四列登记
- [ ] 入口相对资源引用 + metadata 图片 100% 存在;改动 JS `node --check` 通过
- [ ] puppeteer+chromium 截图渲染正常、未捕获 JS 异常 0、无远端请求失败(favicon 类登记)
- [ ] 每游戏一个源侧 commit `game: 接入 <id>(<Title>)`(全角括号);生成物+sitemap 一个独立 `chore:` commit
- [ ] sync-games + build:games:list 后 games.json 含全部新游戏;sitemap +N 条(30 或 29+归档说明),ISO 时间格式对齐现状
- [ ] lint 0 warning / build 成功 / validate:games 通过且通过数 = 52 + 接入成功数
- [ ] 变更记录(spec/tasks/coding_report/summary)与最终报告(清单表/例外/门禁)交付

## 3. 方案设计

- **选定方案**:逐游戏"移动 → 改造 → 三扫 → 自动校验 → headless 取证 → 源侧 commit"的固定流水线(用户指定),直接在 main 本地开发(开发流程规范 §2),不 push。编码期 games-inbox 仍在导致整库 validate 必红(validate 对一级子目录强制 metadata),属已知豁免,中途以单游戏 AJV/资源脚本门禁,Task 31 删除 inbox 后统一跑整库三件套取证。
- **架构影响**:仅 `packages/games/`(源)、`packages/app/public/games/`+`games.json`(生成物)、`packages/app/public/sitemap.xml`(追加 30 条)、`.harness/changes/game-inbox-batch-30-20261022/`(记录);应用 TS 代码零改动。
- **桥接范式(v2 I5)**:以 `prison-whack/index.html` 内联桥为唯一标准:`lgGoHome/lgShare + goHome/clickMore/dp_Ranking/dp_share/show_share/dp_submitScore 别名`;submitScore 类回调只调 updateShare 类文案更新,**不得复制 laser-defense play68.js 的 1 秒自动分享**;mishi 的 play68_submitScore 同此约束。
- **豁免判据(v2 I6)**:① 注释/文案命中词表=违规必须改写;② 引擎 UA 枚举不可见值(`"wechat"`/`"micromessenger"`)可留,coding_report 四列登记(文件:行号/串/不可见理由/处置);③ 服务已删微信行为的 UA 函数整删,仅服务布局者改名去 weixin 字样;④ 许可头/W3C DTD URL 登记豁免。
- **失败兜底(v2 C1)**:无法修复的游戏移至仓库内 `archive/inbox-failed/<原目录名>/`(git 跟踪但管线不扫描),独立 `chore:` commit,报告说明;不静默丢弃;收尾无条件删除 `packages/games/games-inbox/`。
- **提交边界(v2 I4)**:游戏 commit 只含 `packages/games/<id>/`(含从 inbox 的 rename);生成物 1257+ 文件与 sitemap 用一个收尾 `chore: sync 生成物并追加 sitemap` commit 收纳。
- **执行顺序**:Task 0 环境准备(已完成)→ 13 个已清洁游戏复验补缺 → dots-mania、hyper-gunner 补清洗 → 15 个原始游戏由易到难(mxcz→maomi→naoyangyang→nddsc→mnygl→mingxuanyixian→mishi→mmttt→money→mzpk→memeda→mnbyg→monkey→ndtnrgclm→mtl)。
- **验证**(/tmp,不入库):`/tmp/lgcheck.py`(HTML/CSS/JS 资源完整性+词表+入口中文)、AJV 单 metadata 校验(同仓库 schema+九枚举)、`node --check`、puppeteer-core 驱动系统 chromium(`/tmp/pup/lgplay.js`,真实等待+console/pageerror/requestfailed+截图+可选点屏);已用 prison-whack 冒烟通过。

### 3.1 30 个游戏命名方案(待 HITL-1 确认)

**A. 已具英文名+metadata 的 15 个(id 沿用)**

| 原目录 | id | English Title | 摸底状态 |
|---|---|---|---|
| dots-mania | dots-mania | Dots Mania | 未清洗:中文 5 文件、WeixinJSBridge、o.js=51.la packer |
| face-pair-match | face-pair-match | Face Pair Match | 已清洁,复验 |
| find-the-different-face | find-the-different-face | Find the Different Face | 仅 m.min.css 残留微软雅黑 |
| hyper-gunner | hyper-gunner | Hyper Gunner | 未清洗:IE 另存残骸、ga.js/show_ads.js/ad.htm、lanrenmb jquery |
| lumberjack-tap | lumberjack-tap | Lumberjack Tap | 已清洁,复验 |
| monster-shooter-rush | monster-shooter-rush | Monster Shooter Rush | 已清洁,复验 |
| nerve-cat-launch | nerve-cat-launch | Nerve Cat Launch | 仅引擎 UA 表 "wechat" |
| prison-memory-match | prison-memory-match | Prison Memory Match | 已清洁,复验 |
| prison-whack | prison-whack | Prison Whack | 已清洁(桥接范式) |
| save-the-sperm | save-the-sperm | Save the Sperm | 仅引擎 UA 表 "wechat" |
| sea-treasure-match | sea-treasure-match | Sea Treasure Match | 已清洁,复验 |
| smartphone-shooter | smartphone-shooter | Smartphone Shooter | 清洁注释含 legacy 词元,改写 |
| soccer-dash | soccer-dash | Soccer Dash | isWeixin UA 函数需审查处理 |
| tile-tap-rush | tile-tap-rush | Tile Tap Rush | 已清洁,复验 |
| wildflower-picker | wildflower-picker | Wildflower Picker | 仅引擎 UA 表 "wechat" |

**B. 15 个拼音/中文目录(新命名)**

| 原目录 | 原名/玩法 | 拟用 id | English Title | Category |
|---|---|---|---|---|
| maomi | 看你有多花:10 秒狂戳计数(性暗示文案) | `tap-frenzy` | Tap Frenzy | Arcade |
| memeda | 美女秀秀么么哒:9 洞露头亲吻 tapper | `peek-and-pop` | Peek and Pop | Arcade |
| mingxuanyixian | 命悬一线:高空走钢丝(双语切图) | `tightrope-walker` | Tightrope Walker | Arcade |
| mishi | 密室逃脱:反应力闯关(双语切图) | `room-escape-reaction` | Room Escape Reaction | Arcade |
| mmttt | 中秋传说:玉兔割绳跳跃跑酷(egret) | `moon-rabbit-jump` | Moon Rabbit Jump | Arcade |
| mnbyg | 美女啵一个:30 秒 9 洞 tapper | `pop-star-tap` | Pop Star Tap | Arcade |
| mnygl | 木乃伊归来:50 关追逐迷宫 | `mummy-maze-escape` | Mummy Maze Escape | Puzzle |
| money | 捡钱大作战:20 秒点钞票(财运文案) | `cash-catch-rush` | Cash Catch Rush | Arcade |
| monkey | 微信抢桃:猴子接桃/炸弹 59 秒(广告游戏) | `peach-catch-frenzy` | Peach Catch Frenzy | Casual |
| mtl | 摩天楼:盖楼堆叠(cocos,缺 engine.js) | `skyscraper-stack` | Skyscraper Stack | Casual |
| mxcz | 梦想成真:2048 换皮 | `dream-merge-2048` | Dream Merge 2048 | Puzzle |
| mzpk | 名字大作战:名字 RPG 自动对决 | `name-duel` | Name Duel | Casual |
| naoyangyang | 疯狂挠痒痒:10 秒三轨反应 | `tickle-frenzy` | Tickle Frenzy | Arcade |
| nddsc | 能打多少次:时机点击甩链球(尾部 eval) | `how-many-hits` | How Many Hits? | Arcade |
| ndtnrgclm | FC 游戏音乐听辨 10 题 quiz | `retro-game-tune-quiz` | Retro Game Tune Quiz | Quiz |

id 与现有 52 目录无碰撞,均匹配 `^[a-z0-9-]+$`。

## 4. 约束与风险

- **业务约束**:metadata 是唯一真相源;sync 后才有 public/games;games.json 禁手改;不引新外域(CSP);引擎/manualChunks/TS strict 不涉及(应用零改动)。
- **敏感题材**:maomi/memeda/mnbyg 性暗示文案中性化、自拍图保留待 vision 核;money 迷信文案中性化;monkey 品牌促销屏处理;mtl 天安门换地标;ndtnrgclm IP 题面/配乐是版权例外。
- **技术风险**:
  1. mtl 缺 cocos2d engine.js,可能无法修复 → 兜底留 inbox 并报告;
  2. 压缩 JS 内 \uXXXX(mmttt 626 个,多为 egret 引擎内部串;nddsc、mzpk 各若干)替换需精确,按"仅替换玩家可见串"处理,引擎串保留登记;
  3. hyper-gunner 是 IE 另存结构,需重建相对引用;
  4. 远程图床依赖(naoyangyang CSS 的 vdcom.cn、money 的 sinaimg、memeda 图片 URL)一律改本地已有文件;缺文件(naoyang retry.png)登记例外;裸 IP 端点(mmttt 的 42.121.113.35 排行榜/httpbin、money 注释中 218.244.142.3)整段删除;
  5. 双语切图游戏(mnygl/mingxuanyixian/mishi)默认英文切图,中文封面 logo 无法改图→登记;
  6. nddsc 尾部 live eval 注入必须整段删除;
  7. mtl 修复失败 → 归档 `archive/inbox-failed/mtl/` 而非留 inbox(v2 C1)。
- **依赖**:无新增入库 npm 依赖(/tmp/puppeteer-core 仅本地取证用);chromium 已本机可用;mtl 引擎修复需要联网(待 HITL-1 授权)。

## 5. 澄清问题闭环(HITL-1)

| # | 问题 | 决议 | 来源 |
|---|---|---|---|
| 1 | 30 个命名方案(§3.1)是否认可 | 待用户 | 用户 |
| 2 | ndtnrgclm 无授权配乐/IP 题面:(a) 接入+显著版权例外标注【推荐】 (b) 留 inbox | 待用户 | 摸底 |
| 3 | 真人自拍素材(maomi/memeda/mnbyg)保留+中性文案+登记,还是另作处理 | 待用户(推荐保留) | 摸底 |
| 4 | mtl 是否授权联网下载 cocos2d-html5 引擎内置;失败留 inbox | 待用户(推荐授权) | 摸底 |
| 5 | 阶段策略:跳过 push/CI/部署(阶段 7-9 本地门禁替代),阶段 5/6 单测不适用(静态游戏无单测框架,以 headless+自动校验替代) | 用户 prompt 已明确 | 用户 |
| 6 | spec_review_v1 的 C1/I1-I6/Minor 处置 | 全部纳入 v2(见 §3 新增条款与 tasks v2) | 评审 |
| 7 | pop-star-tap(mnbyg)语义可能被误读为音乐/明星题材 | 保留为推荐名,HITL-1 时请用户一并确认(备选 mole-pop-tap) | 评审 Minor 8 |
| 8 | ndtnrgclm 版权例外标注位置 | 仅报告例外清单+coding_report,metadata 描述保持中性 | 评审 Minor 7 |

## 6. 评审状态

- 当前版本:v2(按 spec_review_v1 修订)
- 评审记录:review/spec_review_v1.md
- 状态:🔄修订完成,待 HITL-1/HITL-2 用户终审
