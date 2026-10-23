# 任务清单:fix-seven-game-bugs

> 阶段1产出 | request-analysis(writing-plans)生成 | checkbox 跟踪

## 任务依赖图

- Task 1(平台 aspectRatio 支持)是 Task 3/4/5/6 的前置(它们的 metadata aspectRatio 依赖平台支持才生效)
- Task 2(封面)、Task 7(tap→click)与 Task 1 独立
- 全部完成后统一 Playwright 取证(Task 8)+ 本地门禁(Task 9)

## Task 1: 平台全屏层 aspectRatio 支持
**文件:**
- Modify: `packages/app/src/types/index.ts:1-10`(Game 接口加 `aspectRatio?: string`)
- Modify: `packages/app/src/pages/GameDetailPage.tsx:519-543`(全屏 iframe 等比内接)

- [ ] Step 1: types/index.ts Game 接口加 `aspectRatio?: string`
- [ ] Step 2: GameDetailPage.tsx 加 parseAspectRatio 工具("w:h" → number,非法/缺失返回 null)
- [ ] Step 3: 全屏层改为 flex 居中容器;iframe style:有 R 时 `width: min(100%, calc(100% * R))`、`height: min(100%, calc(100% / R))`(百分比相对 fixed inset-0 容器,与 spec §3.1 一致);无 R 保持 w-full h-full
- [ ] Step 4: `npx tsc --noEmit`(app 目录)类型通过
- [ ] Step 5: 验证无 aspectRatio 游戏视觉零变化(dev server + Playwright 对照)

## Task 2: 封面定向修正与 build 稳定性取证
**文件:**
- Modify: `packages/app/public/games.json`(retro 两字段:loading.png → Public/upload/6177/53fe872815c9a.jpeg)

- [ ] Step 1: 改 games.json 中 retro-game-tune-quiz 的 image/thumbnail
- [ ] Step 2: 跑 `npm run build:games:list`,取证日志:moon-rabbit 显示 "Preserving manual image path ... mmttt.png"、retro 显示 Preserving jpeg
- [ ] Step 3: 复查 games.json 两个游戏字段值正确未被重置

## Task 3: peach-catch-frenzy 半屏修复
**文件:**
- Modify: `packages/games/peach-catch-frenzy/index.html:46`(删 `top:-50%`)
- Modify: `packages/games/peach-catch-frenzy/metadata.json`(加 aspectRatio "2:3")

- [ ] Step 1: 删除 index.html L46 内联样式中 `top:-50%`
- [ ] Step 2: metadata.json 加 `"aspectRatio": "2:3"`
- [ ] Step 3: `npm run sync-games` 同步到 public

## Task 4: skyscraper-stack aspectRatio
**文件:**
- Modify: `packages/games/skyscraper-stack/metadata.json`(加 aspectRatio "2:3")

- [ ] Step 1: metadata.json 加 `"aspectRatio": "2:3"`
- [ ] Step 2: sync-games 同步

## Task 5: smartphone-shooter aspectRatio
**文件:**
- Modify: `packages/games/smartphone-shooter/metadata.json`(加 aspectRatio "9:16")

- [ ] Step 1: metadata.json 加 `"aspectRatio": "9:16"`
- [ ] Step 2: sync-games 同步
- [ ] Step 3: Playwright 验证 TAP TO START 可见;不可见则执行备选(改 all-in-one.js:3146-3157 菜单 y 相对化)

## Task 6: soccer-dash 输入修复
**文件:**
- Modify: `packages/games/soccer-dash/index.html`(iTouch 补鼠标、multiway 提速、focus)
- Modify: `packages/games/soccer-dash/metadata.json`(加 aspectRatio "2:3")

- [ ] Step 1: 检索 index.html 内 `Crafty.config.speed` 全部引用,确定改法(全局 speed 或仅 multiway 传参)
- [ ] Step 2: iTouch.init 增加 mousedown/mousemove/mouseup 监听,复用 touchMove 的 tween 逻辑(坐标取法适配 mouse 事件接口——mouse 事件无 e.touches[0],直接照抄会抛 TypeError)
- [ ] Step 3: multiway 速度提升至 ~200px/s
- [ ] Step 4: 游戏开始回调加 window.focus();验证点:Playwright 进游戏后直接 keyboard.down 方向键即位移(证明无需先点页面获取焦点)
- [ ] Step 5: metadata 加 aspectRatio "2:3",sync-games
- [ ] Step 6: Playwright 实测鼠标拖动/键盘位移 ≥60px 每秒/无报错

## Task 7: tickle-frenzy tap→click
**文件:**
- Modify: `packages/games/tickle-frenzy/js/35/index4.js:82,86,88`(.tap → .on('click'),共 3 处:答题/#start/.retry)

- [ ] Step 1: 全文件检索 `.tap(` 确认所有绑定点(已知 3 处:L82/L86/L88)
- [ ] Step 2: 全部改为 `.on('click', fn)`;sync-games
- [ ] Step 3: Playwright click #start 取证 `.intro` 隐藏、游戏推进;验证 .retry click 有效

## Task 8: 全量 Playwright 取证
- [ ] peach 1280x720 全画面可见
- [ ] skyscraper visibleSize ≥ 世界高度、UI 在屏内
- [ ] smartphone-shooter 入口可见可点
- [ ] soccer-dash 鼠标+键盘有效
- [ ] tickle-frenzy 开始可触发
- [ ] 回归:无 aspectRatio 游戏(如 tetris)全屏层仍铺满;首页卡片正常

## Task 9: 本地门禁三件套
- [ ] `npm run lint` 0 warning
- [ ] `npm run build` 通过(dist 产物存在)
- [ ] `npm run validate:games` 82 游戏全过
- [ ] 派发 code-reviewer 审查整体实现

## Task 10: 提交(策略待用户确认)
- [ ] git add 精确路径(7 游戏 + 平台 2 文件 + games.json;**不含 sitemap.xml**——纯手工文件且含 23 个未提交游戏的死链,移出本次提交;不混入 wiki/package-lock/其余 23 游戏)
- [ ] 询问用户 push 决议,按决议执行
