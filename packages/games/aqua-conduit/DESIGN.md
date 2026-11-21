# 水脉连环 Aqua Conduit · 设计文档

- **id**: `aqua-conduit`
- **系列**: 灯匠夜游 · 第 8 铺
- **类型**: 2D Canvas 限步管道旋转解谜
- **逻辑画幅**: 960 × 540，等比缩放并居中；桌面、横屏与竖屏均可操作（竖屏为居中横置画幅）
- **技术**: 纯 vanilla ES modules；无第三方库、无 CDN、无外部字体/图片/音频；所有画面由 Canvas 程序化绘制，所有声音由 WebAudio 实时合成
- **目录**: `packages/games/aqua-conduit/`
- **测试端口**: 8623

---

## 1. 核心设计

一句话：**转动铜管，把夜泉接到喷泉或水车；步数有限，水路必须一次比一次更准。**

玩家面对一张青石夜渠网格。每个管件只能旋转 90°；点击/触摸顺时针，右键/Shift 点击逆时针。水源是固定端点，目标喷泉或水车是固定端点；中间的直管、弯管、三通与十字桥初始被随机拧乱。水流按真实连通关系流动：两边开口相对才通水；铜闸必须转到「通」的角度；单向阀只允许沿金色箭头方向流动；十字桥只允许直行，不能拐弯；第四章有碧、蓝两股水，两种颜色进入同一格会混流并断掉该格。

设计约束：

1. **每一步都有代价**：每旋转一个可动管件消耗 1 步；步数用尽仍未接通全部目标即失败；接通全部目标即通关。
2. **每关都有作者参考解**：24 关的 `sol` 旋转构成真实可行解；`G.autoSolve()` 走与玩家完全相同的旋转路径。
3. **预算递减的是容错，不是绝对步数**：预算 = 参考步数 + 余量；余量按章节从 6/5 逐步收紧到 1。后面关卡路径更长，绝对预算自然更大，但容错严格递减。
4. **程序化美术**：深夜靛青瓷砖、铜金管壁、玉青水流、釉朱水池、铜闸轮盘、单向箭头、十字桥拱、水车、粒子、涟漪与屏幕震动；不使用纯色占位方框。
5. **零外网**：无 `fetch`/XHR/WebSocket/外部资源；页面内 `window.__NET` 审计计数为 0。

### 操作

| 输入 | 行为 |
|---|---|
| 鼠标点击 / 触屏点按管件 | 顺时针旋转 90°，消耗 1 步 |
| 右键 / Shift + 点击 | 逆时针旋转 90°，消耗 1 步 |
| 方向键 / WASD | 移动键盘光标（青色虚线框） |
| Space / Enter | 旋转光标所在管件；Shift+Space 反向 |
| R / 右上 ↻ / 底部「重开 R」 | 重开当前关，旋转与步数复位 |
| P / 右上 Ⅱ / 底部「暂停 P」 | 暂停 / 继续；暂停冻结时间、水流相位、粒子与输入 |
| M / 右上「声/静」 | 静音 / 开启；状态写入 `aqc.mute` |
| 右上「选」/ 结算「回标题」 | 回到关卡选择 |
| 结算三键 | 下一关 / 再来一次 / 回标题 |

开局一行引导：点按管件旋转 90°；第一章每关的开始 toast 会说明当前关的目标。第二章提示铜闸「通」才会放水，第三章提示单向阀与十字桥，第四章提示碧/蓝不能混流。

---

## 2. 管件与水流规则

方向位：`1=N, 2=E, 4=S, 8=W`；旋转为顺时针四分之一圈。每个可动管件在 `js/levels.js` 中保存：

- `m0`：旋转 0 时的开口掩码；
- `rot`：当前旋转（初始被拧乱）；
- `sol`：作者解所需旋转；
- `onPath`：是否属于作者主路径；
- `e0/x0`：单向阀在作者角度下的入口/出口方向。

| 管件 | 开口 | 规则 |
|---|---|---|
| 直管 straight | 2 个相对开口 | 直行 |
| 弯管 elbow | 2 个相邻开口 | 转弯 |
| 三通 tee | 3 个开口 | 分流/合流；有一条装饰支路，水流可进入死路 |
| 十字 cross | 4 个开口 | 只允许从入口直行到对面；NS 与 EW 是两条独立通道，不互通、不可拐弯 |
| 水源 source | 1 个固定开口 | 水的起点；第四章每关 2 个，颜色不同 |
| 目标 target | 1 个固定开口 | 喷泉或水车；第四章要求对应颜色 |
| 铜闸 valve | 2 个开口 | 仅当 `rot === sol` 时打开；打开显示「通」与玉青光环，关闭显示「闭」与朱红光环 |
| 单向阀 oneway | 2 个开口 + 箭头 | 只允许从入口侧流向出口侧；旋转会同时旋转方向 |
| 装饰 decor / 空 tile | 无实际水流 | 用于夜渠瓷砖与刻纹，不参与求解 |

水流求解器 `js/flow.js` 的 `solveFlow(level, rotations)` 做方向性 BFS：

1. 从每个水源按颜色出发；只有两侧开口相对时才建立有向边。
2. 铜闸关闭时水可以到达闸前，但不能穿过。
3. 单向阀在错误入口进入时不产生输出；十字桥只输出入口的对面方向。
4. 第四章对每种颜色独立 BFS；若同一格被两种颜色到达（水源/目标除外），该格被标记为混流并封锁，重新迭代直到稳定；目标只在收到自己的颜色时才算接通。
5. 返回 `solved`、`targets`、`cellColors`、`mixed`、`edges`、`waterDirs` 等只读信息，供渲染、胜负判定与审计共用。

### 失败与胜利

- 每次旋转后重新求解；若所有目标接通 → 胜利。
- 若步数变为 0 且仍有目标未接通 → 失败（「步数用尽，水路仍未接通」）。
- 步数用尽的最后一步如果刚好接通，则算胜利，不算失败。
- 失败与胜利都会发出站点上报，并显示结算面板；失败可一键重试。

---

## 3. 限步、星级与计分

每关：

- `optimal`：作者参考解的最少点击次数（旋到 `sol` 的最短方向；顺时针 1 次、逆时针 1 次或 2 次）。
- `slack`：容错余量，按章节收紧。
- `budget = optimal + slack`：本关总步数。
- `par`：显示用参考时间（秒），由路径格数与章节推导。

预算余量趋势：

| 章节 | 关卡 | 余量 |
|---|---|---|
| 一 · 青石夜渠 | 1–6 | 6, 5, 5, 4, 4, 3 |
| 二 · 铜闸暗流 | 7–12 | 4, 4, 3, 3, 3, 2 |
| 三 · 单向回廊 | 13–18 | 3, 3, 2, 2, 2, 1 |
| 四 · 双色泉眼 | 19–24 | 3, 3, 2, 2, 1, 1 |

星级（`calcStars`）：

- ★★★：`used <= optimal` 且 `time <= par`。
- ★★：`used <= optimal + max(1, ceil(slack/2))` 且 `time <= par * 1.6`。
- ★：接通目标但未达到上述条件。
- 作者参考解在演练中用时接近 0，因此 24 关均可拿 3 星；`G.autoSolve` / `G.solveAll` 也验证了这一点。

单关分数（整数）：

```
score = (budget - used) * 12 + stars * 60 + max(0, round(par - time)) * 2
```

- 剩余步数、星级与用时都会转成分数。
- 每关保存历史最高单关分；总分为所有关卡最高单关分之和；`best` 为历史最高总分。

### localStorage（统一前缀 `aqc.`）

| 键 | 内容 |
|---|---|
| `aqc.stars` | `{ "1": 3, ... }` 每关最高星级 |
| `aqc.scores` | `{ "1": 310, ... }` 每关最高单关分 |
| `aqc.unlocked` | 已解锁的最高关号（1–24） |
| `aqc.best` | 历史最高总分 |
| `aqc.mute` | 静音状态 `0/1` |

自动测试会先快照全部 `aqc.*` 原值，结束后逐一还原；测试页本身保持静音（`setMutedSilent(true)`），但不会覆盖已还原的 `aqc.mute`。

---

## 4. 24 关配置（4 章 × 6 关）

“路径格”= 作者主路径（双色关卡为两条路径之和）；“参考步”= 作者解最少点击；“预算”= 参考步 + 余量。表中机制只统计**主路径上**的管件；网格中另有装饰/干扰管件，数量更多但不计入目标路径。

| 关 | 章 | 名称 | 网格 | 路径格 | 参考步 | 预算 | 余量 | 路径上的机制 |
|---:|---:|---|---:|---:|---:|---:|---:|---|
| 1 | 1 | 初引清泉 | 6×4 | 7 | 5 | 11 | 6 | 直×3 弯×2 |
| 2 | 1 | 转角回声 | 6×4 | 8 | 6 | 11 | 5 | 直×3 弯×3 |
| 3 | 1 | 三重门 | 6×5 | 7 | 4 | 9 | 5 | 三通×1 |
| 4 | 1 | 石阶水痕 | 7×5 | 10 | 9 | 13 | 4 | 三通×1 |
| 5 | 1 | 分叉小径 | 7×5 | 11 | 7 | 11 | 4 | 三通×2 |
| 6 | 1 | 夜渠尽头 | 7×5 | 10 | 6 | 9 | 3 | 三通×2 |
| 7 | 2 | 铜闸初启 | 7×5 | 9 | 6 | 10 | 4 | 铜闸×1 · 三通×1 |
| 8 | 2 | 双闸合流 | 7×5 | 10 | 5 | 9 | 4 | 铜闸×2 · 三通×1 |
| 9 | 2 | 倒影回环 | 7×6 | 11 | 8 | 11 | 3 | 铜闸×2 · 三通×2 |
| 10 | 2 | 暗渠分流 | 7×6 | 11 | 5 | 8 | 3 | 铜闸×2 · 三通×2 |
| 11 | 2 | 锈阀谜阵 | 8×6 | 12 | 10 | 13 | 3 | 铜闸×3 · 三通×2 |
| 12 | 2 | 闸口明月 | 8×6 | 13 | 12 | 14 | 2 | 铜闸×3 · 三通×2 |
| 13 | 3 | 单向回廊 | 7×5 | 9 | 7 | 10 | 3 | 单向×2 · 十字×1 · 三通×1 |
| 14 | 3 | 逆流之壁 | 8×6 | 11 | 9 | 12 | 3 | 单向×2 · 十字×1 · 三通×2 |
| 15 | 3 | 十字水镜 | 8×6 | 11 | 8 | 10 | 2 | 单向×3 · 十字×1 · 三通×1 |
| 16 | 3 | 铜钉急弯 | 8×6 | 11 | 6 | 8 | 2 | 单向×3 · 十字×2 · 三通×2 |
| 17 | 3 | 逆水行舟 | 8×6 | 13 | 9 | 11 | 2 | 单向×4 · 十字×1 · 三通×2 |
| 18 | 3 | 回廊终章 | 8×6 | 14 | 9 | 10 | 1 | 单向×4 · 十字×2 · 三通×2 |
| 19 | 4 | 双泉初会 | 8×5 | 21 | 18 | 21 | 3 | 直/弯 · 碧+蓝双色 |
| 20 | 4 | 碧与蓝 | 8×6 | 22 | 18 | 21 | 3 | 直/弯 · 碧+蓝双色 |
| 21 | 4 | 平行水脉 | 8×6 | 23 | 15 | 17 | 2 | 直/弯 · 碧+蓝双色 |
| 22 | 4 | 交错的影 | 8×6 | 23 | 18 | 20 | 2 | 直/弯 · 碧+蓝双色 |
| 23 | 4 | 双色回环 | 8×6 | 26 | 22 | 23 | 1 | 直/弯 · 碧+蓝双色 |
| 24 | 4 | 双泉归海 | 8×6 | 24 | 18 | 19 | 1 | 直/弯 · 碧+蓝双色 |

章节：

1. **青石夜渠**（1–6）：直管、弯管、三通；认识旋转与限步。
2. **铜闸暗流**（7–12）：铜闸必须转到「通」；闸后分流与回环。
3. **单向回廊**（13–18）：单向阀与十字桥；逆流与拐弯都会断水。
4. **双色泉眼**（19–24）：碧、蓝两股水、两个目标；同格混流会封锁。

---

## 5. 关卡生成与可解性审计

关卡由 `.scratch/guizang3/aqua-conduit/gen-levels.mjs` 生成，生成器不是运行时依赖；生成后把静态数据写入 `js/levels.js`。

生成流程：

1. 用固定种子的加权自避随机游走生成一条从第 0 列到最后一列的路径（双色关卡生成两条互不重叠的路径）。
2. 按路径方向为每格选择直管/弯管；按关卡机制把部分格子替换为铜闸、单向阀、十字桥或三通分支。
3. 随机选择作者旋转 `sol`，据此反推 `m0`，保证 `rot=sol` 时主路径连通。
4. 把主路径管件拧乱（多数差 1 步，少数差 2 步）；单色关卡填充随机装饰管件，双色关卡保持安静瓷砖以避免混色干扰。
5. 用与游戏相同的 `solveFlow` 做硬校验：
   - `rot=sol` 必须接通全部目标；
   - 初始 `rot` 必须**不**接通；
   - 作者解长度 = `optimal`，且 ≤ `budget`；
   - 双色关卡必须有两种颜色、两个目标，且作者解不产生混流；
   - 第二章每关至少一个主路径铜闸，第三章每关至少一个主路径单向阀。
6. 任一校验失败则换种子重生成；24 关全部通过后才写出文件。

### 静态审计

- 脚本：`.scratch/guizang3/aqua-conduit/audit.mjs`
- 结果：`.scratch/guizang3/aqua-conduit/audit.json`
- 运行：`node .scratch/guizang3/aqua-conduit/audit.mjs`
- 实测：**24/24 关 OK**，`can=true`、`ini=false`、`sol=true`，预算 ≥ 参考步，机制分布正确。
- 游戏内 `G.auditLevels()` 用同一求解器重复审计；`G.solveAll()` 对 24 关逐个 `autoSolve`，全部胜利并拿 3 星。

作者参考解不是“作弊摆放”：`G.autoSolve()` 调用玩家同样的 `rotateCell()` 路径，消耗步数、经过阀门/单向/混色判定，最后触发真实 `winLevel()`。

---

## 6. 程序结构与 G 钩子

| 文件 | 职责 |
|---|---|
| `index.html` | 中文 UI、HUD、标题关卡网格、结算/暂停、错误陷阱、`__NET` 审计、本地 play68 桥接 |
| `js/game.js` | 主循环、输入、关卡流程、旋转/胜负、星级/计分、HUD、程序化渲染、粒子、G 钩子、`?autotest=1` 套件 |
| `js/flow.js` | 旋转掩码、方向性水流 BFS、阀门/单向/十字/双色混流、`autoSolution`、审计 |
| `js/levels.js` | 24 关静态数据、4 章、作者解 `sol`、预算/星级参数、`LEVEL_STATS` |
| `js/audio.js` | 全合成 SFX + 帧驱动 BGM（title/play/win/fail），首次手势后创建 AudioContext |
| `static/play68.js` / `static/play68bar.js` | 本地站点桥：`goHome`、`clickMore`、`dp_share`、`play68_submitScore`、`parent.handleGlobalShare(score)`；无外网 |

### G 钩子（`window.G` / `window.__G`）

- 核心：`err, step(n,dt), upd(n,dt), press(...codes), setNoAuto(v), setReportTarget(fn), state()`
- 关卡：`setLevel(n), startLevel(n), restartLevel(), nextLevel(), toTitle()`
- 旋转/调试：`rotateCell(r,c,dir,opts), setRot(r,c,q), setCursor(r,c), moveCursor(dr,dc), setMoves(n), setSolutionState(), demo(frac)`
- 通关/审计：`autoSolve(opts), solveAll(), forceWin(), forceFail(reason), auditLevels(), solution(n), levelInfo(n), levelConfigs(), cellInfo(r,c), cellScreen(r,c), view(), flowSnapshot()`
- 计分/存档：`computeStars(n,used,time), calcLevelScore(n,used,stars,time), storageSnapshot(), restoreStorage(snap), storageKeys, reports(), clearReports()`
- 音频/杂项：`audio, setMuted(v), toggleMute, setPaused(v), togglePause, clearParticles, updateHUD, layout`
- 纯机制探针：`mixProbe()`（两色混流必须封锁）、`crossProbe()`（十字直通但不可拐弯）

约定：

- autotest 第一行 `G.setNoAuto(true)`。
- `G.state()` 只返回只读快照；内部状态只用 setter/命令函数修改。
- 粒子、屏幕震动、闪光、水流相位在 `update()` 内推进；`G.step`/`G.upd` 都会调用。
- 固定步长 60 Hz，`dt` 上限 0.1；页面隐藏时主循环直接返回；DPR 上限 2；粒子上限约 260。

### 站点上报与桥接

扁平帧（`setReportTarget` 捕获）：`ready` → `progress`（进入关卡）→ `complete`（通关）或 `gameOver`（失败）→ 可选 `event`（开闸、全章完成等）。

向 parent 的兼容信封：

- `progress`：`{kind:'progress', data:{...frame}}`
- `event`：`{kind:'event', event: frame.event||frame.tag, data:{...frame}}`
- `gameOver`：`{kind:'gameOver', score, progress:{value: frame.progress}, data:{...frame}}`
- `complete`：`{kind:'complete', score}`
- `ready`：另发 `{source:'lightgame', type:'lightgame:ready', gameId:'aqua-conduit', v:1}`

通过 `window.parent.postMessage({source:'lightgame', type:'lightgame:report', payload}, '*')` 发送。分数为整数（总分/单关分均 `Math.round`）。父页 `handleGlobalShare(score)` 由 `play68bar.js` 的 `show_share` 调用；`goHome/clickMore/dp_share/play68_submitScore` 均存在。

---

## 7. 渲染与音频

### 渲染

- 背景：深夜靛青纸底、斜向砖纹/瓷砖缝隙、水钟同心圆、暖铜/玉青光池、星尘、暗角与颗粒；全部程序化。
- 棋盘：铜金边框 + 角饰，青石陶瓷砖，砖角铆钉、刻纹/裂纹；空格也有图案，不是纯色方框。
- 管件：铜金外壁 + 深色内膛 + 中心法兰与铆钉；弯头用二次曲线绘制；三通/十字有中心枢纽；十字带竖向桥拱。
- 水流：玉青/碧蓝双层线条、发光、移动虚线、沿边流动的小水滴；目标喷泉/水车在水通后喷水/旋转；混流格显示浑浊色。
- 阀门：铜轮盘 + 辐条 + 「通/闭」标签 + 玉青/朱红光环；单向阀有金色箭头 + 入口缺口；水源有发光喷口与水滴。
- 目标：釉朱喷泉（椭圆水池 + 三股水弧）或铜木水车（8 辐轮 + 落水），按关卡交替。
- 交互：键盘光标与鼠标悬停虚线框；可动管件鼠标指针变为 pointer。
- 特效：旋转/阀门/混流/胜利/失败的粒子与涟漪，胜利/失败屏幕震动和闪光，关键事件 hit-stop 60–90 ms。

### 音频

- WebAudio 全合成：rotate/reverse/valveOpen/valveClosed/blocked/splash/mix/unlock/star/win/fail/level/ui。
- BGM：title/play/win/fail 四状态，帧驱动 16 步循环，音量约 SFX 的 1/3。
- 首次真实手势后 `ensure()`；M 键/右上按钮静音；`aqc.mute` 记忆。
- autotest 期间静音，结束后页面保持静音，但不覆盖已还原的 `aqc.mute`。

---

## 8. 验证清单（如实区分）

### 实际实测过

- [x] **连续两轮 `?autotest=1`：每轮 38/38 断言通过**。结果见 `.scratch/guizang3/aqua-conduit/final-test.json`；两轮均 `errors: []`、`external: []`、`finalMode: "title"`、`nan: false`、`net.fetch/xhr/ws = 0`。
- [x] **控制台零 error / 零 warning / 零 pageerror**：Playwright 监听 `console` 的 error/warning 与 `pageerror`；两轮 autotest、真实输入页、移动端页、无参数直开页均为空。
- [x] **零外网请求**：Playwright 收集全部 request，按 `http://localhost:8623` / `data:` / `blob:` 过滤后为空；页面内 `window.__NET` 的 fetch/XHR/WS 计数为 0。
- [x] **父页兼容信封实测**：用本地父页 iframe 加载游戏，捕获到 `lightgame:ready` + `ready` 扁平帧，以及 `progress → {kind:'progress', data}`、`gameOver → {kind:'gameOver', score, progress:{value}, data}`、`complete → {kind:'complete', score}`；结果见 `.scratch/guizang3/aqua-conduit/bridge-test.json`，所有 score 均为整数。
- [x] **本地 play68 桥**：`goHome / clickMore / dp_share / play68_submitScore` 在真实页面均为 `function`；`play68bar.js` 的 `show_share` 会调用 `parent.handleGlobalShare(score)`。
- [x] **24 关静态审计全部通过**：`audit.mjs` 输出 24/24 OK；作者解 `can=true`、初始 `ini=false`、应用作者解 `sol=true`、预算 ≥ 参考步、机制分布正确。
- [x] **24 关真实自动通关**：`G.solveAll()` 逐关 `startLevel → autoSolve`，全部 `win`，无 NaN，参考解全部 3 星（T21b/T21c）。
- [x] **失败路径**：T6 将步数设为 0，`mode` 变为 `over` 且捕获 `gameOver` 上报；结算面板显示「水路未通」「步数用尽，水路仍未接通」。
- [x] **胜利路径**：T7 第 3 关参考解 → `win`，捕获 `complete`，3 星；T20 验证 `progress` 在 `complete` 之前。
- [x] **核心机制数学**：T3 旋转 4 次回到原掩码；T8 铜闸关闭使水断流；T9 单向阀反向断流；T10 十字桥直通但不可拐弯；T11 双色目标与混流封锁探针。
- [x] **经济与星级**：T12 分数随剩余步数/星级/时间变化，3/2/1 星阈值；T13 星数、单关分、`best`、解锁写入 localStorage。
- [x] **输入模拟生效**：T15 `G.press('Space')` 改变管件旋转并扣 1 步；`G.press('ArrowRight')` 移动光标；T17 在 canvas 上派发真实 `PointerEvent` 成功旋转。
- [x] **暂停冻结**：T16 暂停后 60 帧内 `time`、`flowPhase`、`used` 完全不变；恢复后继续。
- [x] **触控绑定**：T17 触控指针事件；另用 Playwright `hasTouch` + `touchscreen.tap` 实机点按，`used 0→1` 且旋转变化。
- [x] **重开复位**：T18 按 R 后 `used=0`、`movesLeft=budget`、管件回到初始旋转。
- [x] **关卡推进**：T19 通关后 `unlocked ≥ 2`，`nextLevel()` 进入第 2 关。
- [x] **整局快进无 NaN**：T23 通关后 `G.upd(600)` + `G.step(30)`，无 NaN、无新增错误。
- [x] **真实键鼠/触屏冒烟**：Playwright 实载无参数页 → 点开始 → 鼠标点击管件（rot 2→3，moves 11→10）→ ArrowRight+Space（used 2）→ P 暂停 → M 静音 → R 重开（used 0，moves 11）；移动端 tap 成功。`goHome/clickMore/dp_share/play68_submitScore` 均为 function。
- [x] **无参数直开**：`window.G.state().mode === 'title'`，零错误，零外网请求。
- [x] **localStorage 还原**：T30 逐键比对 `aqc.*` 原值；测试结束后页面静音、回标题。
- [x] **缩略图**：`thumbnail.jpg` 为 640×360 JPEG，实机第 19 关双色游玩画面（非标题/选关）。
- [x] **截图**：标题 1280×720、游玩 640×360、1280×720 游玩、移动竖屏/横屏、胜利/失败/暂停均在 `.scratch/guizang3/aqua-conduit/`。
- [x] **体积/编码**：整包远小于 15 MB；所有源码/文档 UTF-8 无 BOM。

关键截图：

- `.scratch/guizang3/aqua-conduit/title-final-1280.png` — 标题 + 关卡网格
- `.scratch/guizang3/aqua-conduit/gameplay-final-640.jpg` — 640×360 游玩（第 19 关双色进行中）
- `.scratch/guizang3/aqua-conduit/gameplay-final-1280.png` — 1280×720 游玩（第 14 关单向/十字）
- `.scratch/guizang3/aqua-conduit/level08-valves.png` — 铜闸关卡
- `.scratch/guizang3/aqua-conduit/level19-full.png` / `level24-full.png` — 双色关卡
- `.scratch/guizang3/aqua-conduit/end-win.png` / `end-fail.png` / `pause.png`
- `.scratch/guizang3/aqua-conduit/mobile-portrait2.png` / `mobile-landscape.png`
- `.scratch/guizang3/aqua-conduit/autotest-round1.png` / `autotest-round2.png`

### 仅确认“能创建/不报错”，未做主观验收

- WebAudio 在真实点击后成功创建（实机页 `audioCtx: true`），合成 SFX/BGM 代码路径无报错；自动测试保持静音，**没有人耳主观试听**音色、音量平衡与循环耐听度。
- 水流动画、粒子、屏幕震动和阀门/水车动效在实机截图中可见，但**帧率/低端机长时间表现未做 profiler**；当前每帧最多 48 格管件 + 少量粒子和水滴。
- 程序化瓷砖刻纹、铜管渐变、喷泉/水车造型为代码生成，**美术主观偏好**需人工确认。

### 需要人工试玩确认

- 难度曲线：第一章是否足够平缓；第二章阀门「通/闭」是否一眼可辨；第三章单向/十字是否教得清楚；第四章双色混流惩罚是否过重。
- 限步紧张感：`budget = optimal + slack` 的余量是否合适；3 星的时间阈值 `par` 是否过松/过紧。
- 移动端竖屏：画幅为居中横置 960×540，板面较小但可玩；是否接受或需要专门的竖屏重排。
- 音频主观听感与音量。
- 是否需要更多提示/教程动画（目前靠每关 toast、机制标签与标题页说明）。

---

## 9. 已知问题 / 有意取舍

1. **竖屏为居中横置画幅**：430×820 时板面约为 430×242，能玩但偏小；短横屏（高度 ≤ 460px）隐藏底部提示/重开/暂停条，以保持板面完整；右上角静音/暂停/重开/选关按钮始终可用。这是“居中画幅”的明确取舍，不是布局错误。
2. **绝对步数预算不是逐关单调递减**：后关卡路径更长，绝对预算必然增长；递减的是 `slack`（容错），从 6 收紧到 1。文档与 HUD 都展示“三星 ≤ optimal 步”，让玩家按参考步数判断松紧。
3. **autotest 结束后页面保持静音但还原 `aqc.mute`**：使用 `setMutedSilent(true)`，避免写回 localStorage；因此测试页的按钮显示「静」，而存储中的静音值仍是玩家原值。
4. **作者参考解的时间为 0.0s**：`G.autoSolve` 同步执行，截图/测试中的“用时 0.0s”是调试结果；真实玩家用时正常累计。
5. **装饰管件可被旋转并消耗步数**：它们是干扰项，不参与作者解；这是有意的“别乱转”设计。玩家可以通过重开或谨慎观察避免浪费步数。
6. **双色十字桥未用于主路径**：当前双色关卡使用互不重叠的两条路径，避免 NS/EW 双通道与混色规则的交互歧义；十字桥在单色章节（13–18）作为真实主路径机制出现。
7. **`thumbnail.jpg` 的演示关卡**：通过 `?autostart=1&level=19&demo=0.88` 得到进行中的代表性对局（蓝色目标已接通、碧色还差一段），`demoMode` 抑制胜负面板；步数显示为 6/21，是真实游戏渲染而非标题/选关。

---

## 10. 运行与测试命令

```bash
# 静态服务（端口 8623）
cd /mnt/tos/workspace/packages/games
python3 -m http.server 8623

# 页面内自动测试（Playwright）
cd /mnt/tos/workspace/.scratch/guizang3/aqua-conduit
node test.mjs

# 静态关卡审计
node audit.mjs

# 重新生成关卡（仅在修改生成器时；会覆盖 js/levels.js）
node gen-levels.mjs
```

浏览器入口：

- 正常标题：`http://localhost:8623/aqua-conduit/`
- 直接进关：`?level=14`
- 自动测试：`?autotest=1`
- 截图演示：`?autostart=1&level=19&demo=0.88`（`demo` 0–1 控制作者解应用到路径的比例）
