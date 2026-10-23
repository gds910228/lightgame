# 需求规格:fix-seven-game-bugs(7 个游戏 bug 修复)

> 阶段1产出 | request-analysis 生成 | 评审见 review/spec_review_vN.md

## 1. 需求背景与目标

- **问题**:用户报告 7 个游戏问题(封面黑白/黑屏 2 个、画面显示不全 2 个、交互失效 3 个),均为 batch-30 接入、尚未提交 git 的游戏。
- **目标**:7 个问题全部根因修复并通过 Playwright 实测取证;对修不好的游戏用户指示删除(当前 7 个均已有实证根因与方案,走修复路径)。
- **非目标**:不全局重构 build-games-list.js 粘性逻辑;不改 skyscraper-stack 的 minified Cocos 代码;不处理 retro 音乐(用户已确认正常);不动 wiki/package-lock 遗留变更。

## 2. 根因诊断结论(3 个并行诊断代理实证,主会话复核)

| # | 游戏 | 症状 | 根因(证据) |
|---|---|---|---|
| 1 | moon-rabbit-jump | 封面黑白 | games.json 曾指向 share.png(498x768 纯灰度微信分享图,sat=0.0),metadata 声明被 `build-games-list.js:207-223` preserveManualPath 粘性忽略。**用户已手动改 → mmttt.png** |
| 2 | peach-catch-frenzy | 只看到半屏 | `index.html:46` 内联 `top:-50%`(table 垂直居中 hack 残留)把画面上移半个视口被 overflow:hidden 裁掉;headless 实测 rect={y:-360,h:720},任何视口下都是精确一半 |
| 3 | retro-game-tune-quiz | 封面黑屏 | games.json 曾指向 share.png(100% 像素半透明、99% 亮度<16,渲染为黑块)。用户手改 → loading.png,但该图实测 184x92 近灰度小图质量差;metadata 声明的 `Public/upload/6177/53fe872815c9a.jpeg`(640x960 彩色)更优 |
| 4 | skyscraper-stack | 看不到全部画面 | minified `game.min.js:3788-3794` 把 cc.winSize(=320x480)误当窗口尺寸,恒等于硬编码 320x480 FIXED_WIDTH;横屏 1280x720 下 scale=4、visibleSize=320x180,世界顶部 62.5% 永久不可见;竖屏(390x844→320x692)正常 |
| 5 | smartphone-shooter | 没有入口可点击 | "TAP TO START" 画在 `all-in-one.js:3146-3157` 的 U+500(U=(height-400>>1)-100);画布高由视口宽高比决定(3568-3580),桌面 16:9 下画布高≈360 → 按钮画在 y≈380 画布外;点击链路本身正常(Toucher 无触摸时回退 mousedown) |
| 6 | soccer-dash | 鼠标键盘无效 | ① `index.html:1599-1660` iTouch 只绑 touch 事件,无鼠标路径;② Multiway 速度 =speed(6)+⌈level/2⌉=6px/秒(875/896 行),Crafty 0.7.1 按秒积分 → 按住 1 秒仅移 6px,不可感知 |
| 7 | tickle-frenzy | 点击开始无反应 | `js/35/index4.js:82,86,88` 用 Zepto 1.1.4 `.tap()` 绑定;其 touch 模块对 pointerType="mouse" 显式过滤且不绑 mousedown/click → 桌面点击永不触发;游戏流程本身正常 |

**共性根因**:`GameDetailPage.tsx:519-543` 全屏 iframe 为 w-full h-full(桌面=横屏视口),aspectRatio 字段在 app/src 零命中——竖屏手机游戏被喂横屏视口,是 #2(变形)#4(裁切)#5(按钮出画)共同诱因。

## 3. 方案设计

### 3.1 平台侧(治本,惠及 #2/#4/#5/#6)
- `packages/app/src/types/index.ts`:Game 接口加 `aspectRatio?: string`
- `packages/app/src/services/gameService.ts`:getAllGames 的 map 白名单需透传 aspectRatio(编码中发现原白名单会丢字段,已补)
- `packages/app/src/pages/GameDetailPage.tsx` 全屏层:game.aspectRatio 存在时 iframe 等比内接。**公式演进记录(v2 修订)**:R1/R2 评审建议的 `min(100%, calc(100% * R))` 百分比方案经 Playwright 实测**数学不成立**(width/height 内的百分数各按本轴解析,无法跨轴约束——1280x720 配 2:3 得 853x720 而非 480x720);最终实现为容器查询单位:全屏容器 `containerType:'size'`,iframe `width: min(100cqw, calc(100cqh * R))`、`height: min(100cqh, calc(100cqw / R))`(cqw/cqh 相对容器解析,可跨轴比较;实测 2:3→480x720、9:16→405x720 精确),flex 居中,黑边由 bg-black 提供;不支持 cqw 的旧浏览器整条声明 invalid → 退回 w-full h-full(退化到修复前行为,非灾难);**无 aspectRatio 游戏保持 w-full h-full 现状,零回归(已实测 DOM 输出逐属性零变化)**
- games.json 生成无需改:build-games-list.js L289 直接透传 metadata 全部字段;metadata schema 已声明 aspectRatio 且 additionalProperties:true(评审实证,schema L40)

### 3.2 各游戏修复

| 游戏 | 改动 | 文件 |
|---|---|---|
| moon-rabbit-jump | 无代码改动;验证用户手改的 mmttt.png 在 `npm run build:games:list` 后不被重置(preserveManualPath 对 `/` 开头绝对路径无条件保留) | 无 |
| peach-catch-frenzy | ① index.html L46 删内联 `top:-50%`;② metadata 加 `"aspectRatio": "2:3"`(640x960) | index.html:46、metadata.json |
| retro-game-tune-quiz | games.json image/thumbnail 从 loading.png(184x92 近灰度)调整为 `/games/retro-game-tune-quiz/Public/upload/6177/53fe872815c9a.jpeg`(640x960 彩色,metadata 本就声明),变更时向用户说明 | packages/app/public/games.json |
| skyscraper-stack | metadata 加 `"aspectRatio": "2:3"`;不动 minified 代码(竖屏 iframe 下 FIXED_WIDTH 世界全可见,实测依据 390x844→visible 320x692>480) | metadata.json |
| smartphone-shooter | metadata 加 `"aspectRatio": "9:16"`(640x1140≈0.5614);9:16 容器内画布高≈1138>567 → 按钮 y=768 进可视区;若实测仍不可见,备选改 all-in-one.js 菜单 y 为相对高度 | metadata.json |
| soccer-dash | ① iTouch 补 mouse 路径(mousedown/mousemove/mouseup 映射现有 touchMove tween 逻辑;**坐标取法适配 mouse 事件接口**——mouse 事件无 e.touches[0],直接照抄 touch 取法会抛 TypeError,评审 Minor);② Multiway 速度 6→200px/s(评审实证 `Crafty.config.speed` 仅 L875 一处消费,直接改 L829 即为最小改法);③ metadata 加 `"aspectRatio": "2:3"`(舞台 320x480);④ 开始回调加 window.focus() | index.html(明文)、metadata.json |
| tickle-frenzy | index4.js 全文件检索 `.tap(`,**共 3 处:L82(答题按钮)、L86(#start 开始)、L88(.retry 重玩)**,全部改 `.on('click', fn)`(触摸设备由合成 click 触发,单一来源无双发;漏改 L88 会导致桌面重玩失效,评审 I-1);若实测横屏布局异常再补 aspectRatio | js/35/index4.js:82,86,88 |

### 3.3 明确不做(反向清单)
- 不全局反转 preserveManualPath 优先级:实测会波及 11 个 batch-30 人工调优封面的游戏(影响面已量化)
- 不删任何游戏(7 个均有根因与方案)
- 不动 wiki 删除/package-lock 遗留变更(git add 精确路径)

## 4. 约束与风险

- **业务约束**:games.json 禁止整体手改但允许 preserveManualPath 机制内的路径微调(本方案仅定向改 retro 两个字段);TS strict 不降级;禁裸 any;manualChunks 保持 undefined
- **技术风险与对策**:
  - aspectRatio 公式极端视口异常 → min() 数学上必等比不溢出,Playwright 多视口实测
  - soccer-dash 速度影响其他机制 → 先检索 speed 引用面;完整玩一局验证
  - 用户手改 games.json 被覆盖 → 验证顺序:build:games:list 后检查值仍在,sync/build 后复查

## 5. 澄清问题闭环

| # | 问题 | 决议 | 来源 |
|---|---|---|---|
| 1 | 手改的封面路径会被 build 重置吗 | 不会——preserveManualPath 对 `/` 开头绝对路径无条件保留(build-games-list.js:212-215),将以实测 build 取证 | 用户 HITL-1 |
| 2 | retro 封面用 loading.png 还是彩色 jpeg | 建议彩色 jpeg(640x960);loading.png 实测 184x92 近灰度质量差 | 用户 HITL-1 + 主会话实测 |
| 3 | retro 音乐 | 用户确认"音乐正常了",不处理 | 用户 HITL-1 |
| 4 | 修不好的游戏删除 | 7 个均有实证根因,全部走修复;skyscraper 若平台侧修复后实测仍不可见再升级决策 | 用户 HITL-1 |
| 5 | 推送策略 | 用户指示"先排查修复问题";修复验证完成后再次询问,默认不 push | 用户 HITL-1 |
| 6 | wiki/package-lock 遗留变更 | 先不处理,不混入本次提交 | 用户 HITL-1 |

## 6. 验收标准(可测试)

- [ ] moon-rabbit 封面 build 后仍为 mmttt.png(取证 build 日志)
- [ ] retro 封面为彩色 jpeg 且 build 稳定;首页卡片显示非黑块
- [ ] peach 在 1280x720 下 #container 全在视口内(y≥0),全画面可见
- [ ] skyscraper 全屏层下 visibleSize 高 ≥480,分数/楼层 UI 在屏内
- [ ] smartphone-shooter TAP TO START 可见,点击后游戏开始
- [ ] soccer-dash 鼠标拖动玩家跟随、键盘按住位移 ≥60px/秒(量化阈值)、无 JS 报错
- [ ] tickle-frenzy 桌面 click #start 后游戏推进(`.intro` 覆盖层隐藏;答题/重玩按钮 click 同样有效——选择器为 class 非 id,评审 I-2)
- [ ] 回归:无 aspectRatio 游戏全屏层仍 w-full h-full
- [ ] 本地门禁:lint 0 warning / build 成功产物存在 / validate:games 82 游戏全过

## 7. 评审状态

- 当前版本:v2(吸收 spec_review_v1 的 I-1/I-2/I-3 与关键 Minor:tap 共 3 处、.intro 选择器、容器相对单位、mouse 坐标 TypeError、speed 单点消费、位移阈值量化)
- 评审记录:review/spec_review_v1.md
- 状态:🔄v1 NEEDS_REVISION 已修订,待复审
