# Guizang 系列第三期 · 波次二/三通用开发 brief

工作区 `/mnt/tos/workspace`。只允许新建/修改分配给自己的 `packages/games/<id>/` 与 `.scratch/guizang3/<id>/`。禁止碰其他游戏、scripts、packages/app、git；禁止 sync/build/commit。

## 必读
1. `.harness/skills/guizang-game-skill/SKILL.md`
2. `.harness/skills/guizang-game-skill/CROWDTEST-CONVENTIONS.md`
3. 参考 `packages/games/starfall-bulwark/js/game.js`（G/autotest）、`packages/games/orchard-fusion/js/game.js`、`audio.js`。

## 系列观感
灯匠夜游 · Guizang 精品系列第三期。深夜靛青纸底、暖铜金、釉朱、玉青；程序化 Canvas/几何、手绘线描/纸刻质感；禁止纯色占位；每款标题显示「灯匠夜游 · 第 N 铺」。中文 UI，文案平实具体。游戏目录、metadata 与 thumbnail 按下述规格。

## 工程约束
- vanilla JS ES modules；零外部请求/CDN/字体/图片/音频；WebAudio 全合成，首次手势后建 AudioContext，M 静音，autotest 静音；贴图 Canvas 程序化。
- 桌面键鼠 + 触屏 pointer 支持；`touch-action:none`；中文 UI 开局一行引导；失败可一键重开；结算有「重试/回标题」。
- 固定步长逻辑（accumulator 60Hz，dt clamp），页面隐藏暂停累计；DPR 上限 2；粒子有上限；命中/关键事件有 hit-stop、screen shake、粒子。
- `index.html` 必须有中文 UI、`window.__BOOTERR=[]` 错误陷阱 + error/unhandledrejection 监听、本地 `static/play68.js` + `static/play68bar.js`、`<script type="module" src="js/game.js">`。
- 所有中文文件 UTF-8 无 BOM；单款 <15MB。

## G 钩子（强制）
`window.G = window.__G = { err, step(n,dt), upd(n,dt), press(...codes), setNoAuto, setReportTarget, state(), ...按玩法的 setXxx/forceWin/forceFail }`。
- G 内改状态只用 setter；道具/粒子/弹道在 frame 内 update；autotest 第一行 `G.setNoAuto(true)`。
- `state()` 只读快照；不得用 getter 展平赋值。
- `?autotest=1` → 异步套件 → `window.__TEST={pass,fail,total,results,done:true}`，每款断言数按各游戏要求（最低 25，且必须比规格要求多或相等）。nap 使用 MessageChannel 宏任务。测完回标题；best localStorage 测后还原。
- 必含前 8 类：启动零报错 / 无 NaN / 核心机制数学≥3 / 经济增减 / 失败路径 / 胜利或里程碑 / 上报帧序 / best localStorage 读写还原；外加「输入模拟生效」、暂停冻结、触控绑定、整局快进无异常、重开复位。

## 站点上报与桥接（强制兼容当前 app）
`report(kind,payload)` 对 `reportTarget` 保留扁平帧（供 autotest）；向 parent 时用兼容信封：
- progress → `{kind:'progress', data:{...frame}}`
- event → `{kind:'event', event:frame.event||frame.tag, data:{...frame}}`
- gameOver → `{kind:'gameOver', score, progress:{value:frame.progress}, data:{...frame}}`
- complete → `{kind:'complete', score}`
- ready → 另发 `{source:'lightgame',type:'lightgame:ready',gameId,v:1}`
通过 `window.parent.postMessage({source:'lightgame',type:'lightgame:report',payload},'*')` 发送。分数整数。
桥接：`parent.handleGlobalShare(score)`、父页返回 `/`，全局 `goHome/clickMore/dp_share/play68_submitScore` 必须存在。

## 封面与验证
- `thumbnail.jpg` 必须 640×360 JPEG，实机游玩截图（非标题/选关）；可用 `?autostart=1` 或查询参数进入代表性对局。
- Playwright：`createRequire('/tmp/pw/node_modules/')`，`chromium.launch({headless:true,executablePath:'/usr/local/bin/chromium',args:['--no-sandbox','--use-gl=swiftshader']})`。静态服务从 `packages/games` 起 python http.server，用分配端口。
- 必须连续 2 轮页面加载：每轮断言全过、console error=0、script warning=0、pageerror=0、外网请求=0；真实键盘/指针冒烟；直接打开无参数页零报错；截标题 1280×720、游玩 640×360，存 `.scratch/guizang3/<id>/`。
- `DESIGN.md`：设计、数值表、关卡/内容、验证清单；如实区分「实测过」「仅不报错」「需人工试玩」。
- `metadata.json`：id、title、category（必须含 "Guizang"）、description/controls 英文，type local，path `/games/<id>/index.html`，thumbnail `./thumbnail.jpg`，tags，author LightGame，version 1.0.0，date_added 2026-11-20。
- 最后只回报：文件、两轮断言、console/外网审计、真实输入结果、截图路径、已知问题。不要贴大段代码。
