# 逐游戏接入台账(阶段 3 工作记录)

> 每完成一个游戏追加一行;字段:id | commit | 改动文件 | 翻译串 | 删除外链/追踪器 | 烘焙中文图/豁免 | 证据。最终报告由此汇总。

| # | 原目录 | id | title | commit | 改动文件数 | 翻译串数 | 删除的外链/追踪器 | 图片中文/豁免登记 | 验证证据 |
|---|---|---|---|---|---|---|---|---|---|
| G1 | face-pair-match | face-pair-match | Face Pair Match | f668449 | 1 删(Thumbs.db),代码 0 改 | 0(前次已英文化) | 无残留 | 烘焙图:img/curscore(当前得分)、bestscore(历史最高)、replaybtn(重玩)、sharebtn(低调炫耀)、toplistbtn(更多)、bg 水印(本游戏由奇葩游戏提供) | 截图 g1-face-pair.png 棋盘+计时;pageerr=0;fail.fail=SoundJS 探测豁免;all.mp3=原生 Android 死分支 |
| G2 | lumberjack-tap | lumberjack-tap | Lumberjack Tap | a4d243b | 0 | 0 | 无 | 烘焙图:标题"是男人就啪啪…"、点击箭头"点击" | 截图 f-lumberjack-tap;pageerr=0 |
| G3 | monster-shooter-rush | monster-shooter-rush | Monster Shooter Rush | 5cfd97f | 0 | 0 | 无 | 烘焙图:"萝莉来了"标题、邀请好友两行文案 | 截图 f-monster-shooter-rush;pageerr=0 |
| G4 | prison-memory-match | prison-memory-match | Prison Memory Match | 44390f2 | 0 | 0 | 无 | 烘焙图:得分标签(同 face-pair 系列) | 截图 f-prison-memory-match;pageerr=0;fail.fail 探测豁免 |
| G5 | prison-whack | prison-whack | Prison Whack | cfb1dec | 0 | 0 | 无 | 烘焙图:"监狱风云"logo、"战略网官方出品"水印、"开始游戏"按钮 | pw_puppeteer.png;pageerr=0 |
| G6 | sea-treasure-match | sea-treasure-match | Sea Treasure Match | 4a450b1 | 2(index.html,game.min.js) | 0(游戏自带英文本地化) | 无残留 | 烘焙图:title.png"开心消消乐"、logo.png 中文三联漫画(splash 已 CSS 隐藏) | g2-sea5.png 菜单英文;pageerr=0。修复:_SPTimer/SpilGamesBrandTimer 空桩、#splashscreen 永久隐藏(旧 fadeOut 浏览器分支 no-op 死循环)、audio 预载 play() promise catch |
| G7 | tile-tap-rush | tile-tap-rush | Tile Tap Rush | 66ade21 | 0 | 0 | 无 | 未见中文烘焙字 | 截图 f-tile-tap-rush;pageerr=0;fail.fail 豁免 |
| G8 | nerve-cat-launch | nerve-cat-launch | Nerve Cat Launch | dbed726 | 1(egret_loader.js) | 3(注释/致命错误文案) | 无残留 | 游戏画面英文;egret 引擎诊断中文 66 行(game-min2.js Logger/throw,不可见)登记豁免;UA 枚举 micromessenger/wechat 豁免 | f-nerve-cat-launch.png;pageerr=0 |
| G9 | save-the-sperm | save-the-sperm | Save the Sperm | ca6b32d | 1(game.min.js) | 0(文本均为烘焙资源) | 无残留 | 烘焙图:uiTex.png(开始游戏/更多游戏/再来一次/返回菜单/分享我的拯救量)、位图字体 font-24(fnt 为 GBK 编码)绘"快来拯救精子" | f-save-the-sperm.png;pageerr=0(修 logoData 空字符串守卫);index.html 2 处 w3.org DTD 豁免;UA 枚举豁免 |
| G10 | wildflower-picker | wildflower-picker | Wildflower Picker | f62e63b | 10(game.min.js + 9 个静音占位音) | 12(\uXXXX:加载3/开始/炫耀/再来/5 评级/结果文案/分享引导;黑体宋体→Arial) | 无残留 | 无可见中文烘焙字 | wf-en.png 游戏中英文;pageerr=0、reqfail=0(补 ogg/m4a/mp4 占位消除格式探测 404);UA 枚举豁免 |
| G11 | smartphone-shooter | smartphone-shooter | Smartphone Shooter | 6c505cc | 2(index.html 注释改写;新增 res/camera.mp3 静音占位) | 0 | 无残留 | 烘焙图:title.png"狂摄 iPhone 6" | f-smartphone-shooter.png;pageerr=0(占位音消除快门 404) |
| G12 | soccer-dash | soccer-dash | Soccer Dash | 92bc3a0 | 1(index.html) | 2(注释/函数名) | 无残留 | 烘焙图:JZ.gif"olá!快跑!"开始图 | soccer-play4.png 实战(分数/障碍);pageerr=0。修复 2 个致命旧 bug:Crafty.canvas.init()(0.7 已删 API)、Crafty.load 数组形式被忽略→{images:[]};STHeiti→sans-serif;isWeixin→isMessengerBrowser;fasle 笔误 |
| G13 | find-the-different-face | find-the-different-face | Find the Different Face | 8fb1d1e | 1(m.min.css) | 0 | 无残留 | 未见中文烘焙字 | f-find-the-different-face.png;pageerr=0;libs.min.js 内 underscorejs.org 许可 URL 豁免;'微软雅黑'→sans-serif |
| G14 | dots-mania | dots-mania | Dots Mania | 7d9a016 | 7(入口+load/menu/end;删 o.js/code.js/config.main.js/jquery+2 死图) | ~20 | hm.baidu、g.lanrenmb、WeixinJSBridge、menu.js 尾部 2sky packer 注入(wei.2sky.cn/game/53/o.js) | 无可见中文烘焙字;vapp/logo.jpg 旧 6e 平台 logo(已改跳首页)登记 | dots-menu.png 英文菜单+0 错误 0 失败请求;node --check 通过 |
| G15 | hyper-gunner | hyper-gunner | Hyper Gunner | 3547477 | 3(入口/data.js/game.js 1 行;删 ga.js/show_ads.js/aselect.js/_pagevisit.htm/ad.htm) | 0(英文原游戏) | GA(UA-28241583)、linezing tongji.gif 广告 iframe、远程 lanren jquery、WeixinJSBridge 全套 | 无 | hyper-2.png 实战画面;pageerr=0;jquery 许可 URL 豁免 |
| G16 | mxcz | dream-merge-2048 | Dream Merge 2048 | cb1e62f | 5(入口/actuator/keyboard/main.css+icon.png) | ~20(9 级人生目标词条/胜负/分享/导航/积分标签) | linezing tongji.gif、lanren、WeixinJSBridge+FB、46465/apiwck 推广 | 无 | dream2048.png 英文;pageerr=0;生成 icon 封面 |
| G17 | maomi | tap-frenzy | Tap Frenzy | b802128 | 2(入口重写/index.htm 删除) | ~25(计时/评级/结果/按钮全部中性化) | tajs、lanren、mmbiz、WeixinJSBridge | 无(knydh 粉色心形按钮、猫照片 SFW 保留) | tapfrenzy.png;pageerr=0 |
| G18 | naoyangyang | tickle-frenzy | Tickle Frenzy | 57bc688 | 5(入口/index4/css/zepto 注入切除) | 8(标题/说明/结算/分享) | tajs、lanren、mp 微信文章、vdcom.cn 远程 CSS 图 10 个改本地、zepto 尾部 o.js packer(wei.2sky.cn/35/o.js) | 烘焙图:ready.png 预备/go.png 开始 | tickle2.png 英文;pageerr=0、reqfail=0 |
| G19 | nddsc | how-many-hits | How Many Hits? | 50cb8b8 | 2(入口/游戏 JS) | 6(加载/得分/最高) | tajs、lanren、mmbiz、微信桥、随机 oixm/hiemma/peagame 域、尾部 9g packer 注入 | 烘焙图:uiTex.png 开始/更多按钮、标题图 | hits.png;pageerr=0;UA wechat + github zlib 许可豁免 |
| G20 | mnygl | mummy-maze-escape | Mummy Maze Escape | 6e0c6fb | 4(入口/游戏 JS 默认 ENG/引擎两处) | 3(锁定关卡提示;注释保留) | tajs、lanren、9g 注释包、jsgamemin 尾部 vbaitong 注入(0.vbaitong.com/l.js)、LeiYoo 平台加载图 404 改本地 | 烘焙图:cover.png"木乃伊归来"、chinese/english 切换图 | mummy3.png 英文按钮;pageerr=0;代码注释中文登记 |
| G21 | mingxuanyixian | tightrope-walker | Tightrope Walker | 5eec9d5 | 4(入口/min 默认 ENG/jj 提示/清单 URL id) | 12(引擎加载提示 7+分享文案等) | lanren(含清单内 URL-as-id)、微信桥、9gloading 品牌图改本地 a.png | 烘焙图:logo"命悬一线"、start/more/retry/back/isexit/score/Hscore 原图缺失英文版(清单映射到中文 PNG)逐项登记 | tightrope3.png;pageerr=0 |
| G22 | mishi | room-escape-reaction | Room Escape Reaction | aee68db | 3(入口/默认 ENG/引擎) | 5(加载提示/锁定 alert) | tajs、lanren、mmbiz、LeiYoo 加载图 404 改自制中性图 | 烘焙图:1.jpg 密室逃脱标题 | mishi2.png 英文 Start/More;pageerr=0;代码注释中文登记 |
| G23 | mmttt | moon-rabbit-jump | Moon Rabbit Jump | 47ab758 | 5(入口/loader 注释/端点/尾部注入) | 12(加载/介绍 6 条/结果/排行) | tajs、lanren、mmbiz、42.121 排行榜与 httpbin UA 探测、9g 尾部 packer(game.9g.com/zqcs/o.js)、微信 OAuth | 烘焙图:title 萌萌跳跳兔/开始按钮图集 | moon2.png;pageerr=0;egret 引擎诊断串豁免 |
| G24 | money | cash-catch-rush | Cash Catch Rush | 0a7066d | 4(入口重写/.htm/eval cookie/sinaimg 本地) | ~18(结果 5 档/按钮/积分/导航) | tajs 双统计、lanren、heirui、mm 微信文章、dwz 短链、sinaimg 远程背景改本地 | 人民币 rmb.png(核心素材保留) | cash2.png 游戏中;pageerr=0;fail.fail 探测豁免 |
| G25 | mzpk | name-duel | Name Duel | 4fba430 | 4(入口/JS/删 dog/nbproject) | ~45(战斗叙述全部去性暗示中性化) | 46465、345.gd OAuth、lanren、微信桥、9g 注释注入 | 烘焙图:bg1 开始拳/标题字 | duel2.png;pageerr=0;照片素材按 HITL 保留 |
| G26 | memeda | peek-and-pop | Peek and Pop | 35b4153 | 6(入口/CSS 远程图改本地/主 JS/删重复 CSS) | ~25(评级 5/结果文案/模板) | linezing、lanren、qpic 头像与背景 15 处全部改本地、微信桥 | 无文字(嘴唇/照片) | peek.png 英文菜单;pageerr=0;照片保留 |
| G27 | mnbyg | pop-star-tap | Pop Star Tap | d9e3ea5 | 4(入口/JS 文案/注释暂停) | ~25(评级 5/结果/分数) | tajs、lanren、mmbiz、微信文章、微信桥 | 自拍开始背景图(HITL 授权保留) | popstar.png;pageerr=0 |
| G28 | monkey | peach-catch-frenzy | Peach Catch Frenzy | 33e82c6 | 6(入口/loader/字体/音频/规则按钮/三屏) | 3(加载/标题) | 微信桥、lanren、品牌促销三屏图用 island 自制英文屏替换 | 按钮 sheet 无文字;三屏已替换 | peach2.png;pageerr=0;jPlayer 死依赖删除 |
| G29 | ndtnrgclm | retro-game-tune-quiz | Retro Game Tune Quiz | 894a9ab | 3(入口/题目/删广告与尾部) | ~70(10 题 40 选项+10 结果+按钮) | 百度联盟 cpro_id u1646897、lanren、mmbiz、微信桥、31671 假人数 | 无 | quiz2.png 英文;pageerr=0;IP 名称与 MP3 版权风险已在 metadata notes 显著标注 |
| G30 | mtl | skyscraper-stack | Skyscraper Stack | 0e852a7 | 8(缺失引擎联网内置 cocos2d-html5 v3.0-alpha2+underscore+polyfill/入口/JS) | ~30(地标 11/结果/按钮/关注层) | tajs、lanren、微信桥、_hmt、9g 尾部 packer、随机导流 | 烘焙图:texture.png 摩天楼标题与懒人模板水印 | sky8.png 实际游戏画面 0 错误;MIT 引擎保留许可头 |
