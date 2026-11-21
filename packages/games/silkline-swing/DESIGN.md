# Silkline Swing 丝线荡跃 · 设计文档

- **id**: `silkline-swing`
- **系列**: 灯匠夜游 · 第 6 铺
- **类型**: 2D Canvas 物理摆荡平台
- **画幅**: 逻辑分辨率 1280 × 720，等比缩放；横屏铺满，竖屏居中显示完整可玩画幅
- **技术**: vanilla ES modules；Canvas 2D 全部程序化绘制；WebAudio 全合成；无第三方库、CDN、字体、图片或音频请求

---

## 1. 核心设计

一句话：**抓住铜锚，把身体荡起来，在正确的时机松手，让惯性把你送过深峡。**

玩家按住 `Space / 鼠标左键 / 触屏`，系统在射程 500 px 内选择锚点（优先朝向前方），玉青丝线立即绷紧并把玩家收到一个刚性圆周上。绕锚摆动时按 `A/D` 施加水平泵摆力，`W/S` 收放丝长；松开抓取键后丝线消失，玩家保留当时的切向速度飞出，只受重力与轻微空中控制影响。每关悬浮三颗星屑，穿过釉朱星门即通关；尖刺与深渊会折断丝线，扣一条生命并回到最近检查点，三条命耗尽则本关失败。

美术方向：深夜靛青峡谷、铜金锚点、玉青蛛丝、釉朱星门；月亮、远山、雾带、纸刻岩石平台、提灯守丝人、粒子与屏震。

### 操作

| 输入 | 行为 |
|---|---|
| 按住 `Space` / 鼠标左键 / 触屏画布 | 抓住射程内锚点；松开即释放 |
| `A / ←`、`D / →` | 泵摆（附着时水平推力；空中时轻微控制） |
| `W / ↑`、`S / ↓` | 收丝（缩短 L）/ 放丝（增长 L） |
| `R` / 右上「重」 | 重开本关（生命、星屑、计时复位） |
| `P` / 右上「停」 | 暂停 / 继续（冻结物理与关卡计时） |
| `M` / 右上「声」 | 静音 / 开启声音，状态写入 localStorage |
| 触屏：抓丝 / ← / → / 收 / 放 | 与键盘等价的按住式触控 |
| 结算：下一关 / 再试一次 / 回标题 | 关卡推进、重试与返回 |

开局引导一行：`按住 Space / 鼠标 / 触屏抓丝 · A/D 泵摆 · W/S 收放 · 松手飞出`。

---

## 2. 物理模型与数值

固定步长 60 Hz（accumulator，dt clamp 0.1 s）。所有物理是纯函数 `physics.js`，渲染与 UI 不参与力学。

| 参数 | 值 | 说明 |
|---|---:|---|
| 重力 `g` | 1300 px/s² | 无空气阻尼 |
| 泵摆水平加速度 | 900 px/s² | 仅附着时 |
| 空中控制 | 300 px/s² | 仅自由飞行时 |
| 最大速度 | 1650 px/s | 速度钳制 |
| 抓取射程 | 500 px | 圆的欧氏距离 |
| 丝长 `L` | 90–430 px | 初始/收放均钳制 |
| 收放速度 | 330 px/s | `reel=-1` 收、`+1` 放 |
| 玩家半径 | 11 px | 碰撞圆 |

### 2.1 绳长约束（刚性丝线）

附着时每帧积分后把位置投影回以锚点 `a` 为圆心、当前丝长 `L` 为半径的圆：

```
p' = a + (p - a) / |p - a| · L
n  = (p - a) / |p - a|
v' = v - (v · n) n          // 移除径向速度，只保留切向速度
```

因此摆角/绳长约束、松手速度、锚点选择都是可断言的真实量：

- `|p - a| == L`（浮点误差内）；
- 附着期间径向速度 `v · n == 0`；
- 松手时 `v` 保留（进入自由飞行后仅叠加 `g·dt` 与方向输入）。

### 2.2 抓取与锚点选择

- 抓取时 `L = clamp(0.8 × d, 120, 330)`：丝线先放出再被守丝人收紧，避免远端抓取时摆弧插入地面。
- 选择规则：先筛出“朝向前方”的锚点（`(anchor.x - player.x) * facing >= -24`），在朝前锚中取最近；若没有朝前锚，才允许抓身后的最近锚。
- 刚松开的锚点有 0.8 s 忽略窗口，避免“松手立刻粘回同一锚”的卡死。
- 生命/检查点/脆丝/活锚/风区都参与同一物理步进。

### 2.3 变化机制

- **移动锚**：第 2 章起部分路线锚沿椭圆轨道摆动（振幅 30–46 px / 34–56 px，速度 0.8–1.3 rad/s），锚点位置随时间变化并参与约束。
- **脆丝锚**：第 2 章起出现，首次抓取后 2.6 s 崩断；环上有倒计时弧与裂纹，崩断后本局不可再用。
- **风区**：第 2/3 章的矩形横风带（±150–260 px/s² 水平加速度），以飘动流线与箭头表现，不使用硬矩形色块。
- **尖刺 / 深渊**：尖刺为矩形危险区，深渊为 `y > killY`；均立即扣命并回到检查点。
- **检查点**：每关两个（路线的 1/3、2/3 处），越过 `triggerX` 自动点亮；重生时挂在检查点锚下，并有 0.6 s 自动抓丝宽限。

### 2.4 星级

| 星级 | 条件 |
|---|---|
| ★ | 抵达星门 |
| ★★ | 抵达 + 收集 ≥ 2 颗星屑 |
| ★★★ | 抵达 + 收集全部 3 颗星屑 + 用时 ≤ `par` |

`par` 在构建期由“确定性参考路线”的实测时间计算：`par = max(24, round(参考时间 × 3.6 + 8))`，保证参考路线可拿到三星，同时给真人留下操作余量。

### 2.5 得分与上报

- 上报分数（整数）：`totalStars × 100 + unlocked × 10 + level × 3 + currentShards`。
- 星屑 +1 分；一段路线内分数单调不减（进入下一关时等级项 +3、星屑项归零，净变化 ≥ 0）。
- 上报帧：`ready → event(levelStart) → progress（通关）→ event(levelClear) → complete（第 18 关或全部 18 关均有星）`；失败为 `gameOver`。
- 向父页发送兼容信封：`progress → {kind:'progress', data}`、`event → {kind:'event', event, data}`、`gameOver → {kind:'gameOver', score, progress:{value}, data}`、`complete → {kind:'complete', score}`；ready 另发 `{source:'lightgame', type:'lightgame:ready', gameId, v:1}`。

---

## 3. 18 关配置（3 章 × 6）

几何全部由 `js/levels.js` 按关卡种子确定性生成；三颗星屑的位置由**真实物理 + 真实锚点选择规则**跑出的参考路线轨迹上取样，再二次验证。`参考时间` 为自动参考路线（会顺路收齐 3 星屑）的实测秒数。

| 关 | 章 | 名称 | 世界宽 | 锚点 | 星屑 | par s | 参考 s | 移动锚 | 脆丝 | 风区 | 尖刺簇 |
|---:|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 1 | 灯口试丝 | 2400 | 8 | 3 | 24 | 3.53 | 0 | 0 | 0 | 4 |
| 2 | 1 | 苔桥回响 | 2550 | 9 | 3 | 24 | 4.45 | 0 | 0 | 0 | 4 |
| 3 | 1 | 双锚浅湾 | 2700 | 9 | 3 | 25 | 4.72 | 0 | 0 | 0 | 4 |
| 4 | 1 | 铜环低语 | 2850 | 10 | 3 | 25 | 4.63 | 0 | 0 | 0 | 5 |
| 5 | 1 | 窄风廊 | 3000 | 10 | 3 | 24 | 4.58 | 0 | 0 | 0 | 5 |
| 6 | 1 | 暮谷长摆 | 3150 | 11 | 3 | 37 | 8.00 | 0 | 0 | 0 | 5 |
| 7 | 2 | 断索崖 | 3460 | 12 | 3 | 30 | 6.08 | 2 | 1 | 1 | 6 |
| 8 | 2 | 风眼 | 3610 | 12 | 3 | 29 | 5.95 | 2 | 1 | 1 | 6 |
| 9 | 2 | 碎星索道 | 3760 | 13 | 3 | 33 | 6.85 | 2 | 2 | 1 | 6 |
| 10 | 2 | 悬灯栈 | 3910 | 13 | 3 | 30 | 6.20 | 2 | 2 | 1 | 6 |
| 11 | 2 | 回旋门 | 4060 | 14 | 3 | 34 | 7.30 | 2 | 2 | 1 | 7 |
| 12 | 2 | 赤铜深井 | 4210 | 15 | 3 | 37 | 7.98 | 2 | 2 | 1 | 7 |
| 13 | 3 | 碎月峡 | 4520 | 15 | 3 | 35 | 7.40 | 4 | 2 | 2 | 7 |
| 14 | 3 | 灯河回廊 | 4670 | 16 | 3 | 35 | 7.42 | 5 | 2 | 2 | 8 |
| 15 | 3 | 双月摆渡 | 4820 | 16 | 3 | 39 | 8.62 | 5 | 2 | 2 | 8 |
| 16 | 3 | 蚀心索 | 4970 | 17 | 3 | 37 | 8.12 | 5 | 2 | 2 | 8 |
| 17 | 3 | 星门残响 | 5120 | 18 | 3 | 40 | 8.80 | 5 | 2 | 2 | 9 |
| 18 | 3 | 终跃 · 灯河 | 5270 | 18 | 3 | 45 | 10.17 | 5 | 2 | 2 | 9 |

章节：

1. **雾谷初丝**（1–6）：固定铜锚、无风，教学抓取、泵摆、收放与松手。
2. **风蚀深峡**（7–12）：引入移动锚、脆丝与横风，第一次真正要求提前看下一个锚。
3. **月蚀灯河**（13–18）：两条风带、更多活锚，最后的星门在长摆之后。

每关参考路线已由 `probeRoute` 在真实物理下验证：18/18 完成、18/18 收齐 3 颗星屑，无 NaN。

---

## 4. 程序结构与调试钩子

| 文件 | 职责 |
|---|---|
| `index.html` | 中文 UI、HUD、标题/选关、结算、错误陷阱、网络审计、play68 本地桥接 |
| `js/game.js` | 主循环、输入、关卡流程、存档、上报、粒子/屏震/顿帧、G 钩子、`?autotest=1` 套件 |
| `js/physics.js` | 纯摆荡物理、锚点选择、碰撞/危险、参考路线 autopilot |
| `js/levels.js` | 18 关确定性几何、星屑轨迹取样、星级与 par |
| `js/render.js` | 程序化背景/峡谷/锚点/丝线/星门/角色/粒子绘制与相机 |
| `js/ui.js` | DOM HUD、选关格、结算、触控按住按钮 |
| `js/audio.js` | 全合成 SFX + 帧驱动 BGM（calm/play/danger/win） |
| `static/play68.js` / `play68bar.js` | 本地站点桥接：`goHome`、`clickMore`、`dp_share`、`show_share`、`play68_submitScore`、`parent.handleGlobalShare` |

### G 钩子（`window.G` / `window.__G`）

`err, step, upd, press, up, setNoAuto, setReportTarget, state, startLevel, restartLevel, toTitle, nextLevel, forceWin, forceFail, setLives, setShards, setTime, setGrab, setDir, setReel, setPlayer, attachTo, releaseSilk, ropeInfo, anchorInfo, chooseNow, anchorCount, levelConfigs, computeStars, checkpointState, resetCheckpoints, probeLevel, probeAllLevels, autoRun, storageSnapshot, restoreStorage, reports, clearReports, levels, P, audio, ui, renderer, testMode, pauseNow`。

- `G.setNoAuto(true)` 是 `?autotest=1` 套件的第一行。
- 所有内部可变状态通过 setter / 流程函数修改；`state()` 返回只读快照。
- `?autostart=1&level=N[&shot=gate]` 会用参考 bot 推进到一个真实的荡跃画面并冻结，供封面/截图使用。

### 存储

唯一前缀 `sls2.`：

- `sls2.stars`：`{ "1":3, ... }` 每关最高星数
- `sls2.unlocked`：最高解锁关号
- `sls2.best`：历史最佳总星数
- `sls2.total`：总星数缓存
- `sls2.mute`：静音状态

自动测试会先快照以上键，结束前逐一还原。

---

## 5. 验证清单（如实区分）

### 实际运行验证过（Playwright + 页面内套件）

- [x] **连续 2 轮自动测试：每轮 51/51 断言通过**。见 `.scratch/guizang3/silkline-swing/final-test.json`；两轮均 `errors: []`、`warnings: []`、`pageerrors: []`、`external: []`、`finalMode: "title"`、`nan: false`。
- [x] **零 console error / warning / pageerror**：两轮套件、直接无参加载、真实键鼠、移动端触控、封面帧全部为空。
- [x] **零外网请求**：Playwright 收集全部 request，过滤 `http://localhost:8621`、`data:`、`blob:` 后为空；页面内 `window.__NET` 的 fetch/XHR/WS 计数与 external 均为 0。
- [x] **启动零报错**：直接打开无参数页 `__BOOTERR.length == 0`，标题可见，`G.state().nan == false`。
- [x] **核心数学（≥3 条，实测）**：
  - T3b 附着后 `|p−a|` 与 `L` 误差 `< 1e-6`；
  - T3c 附着期间径向速度 `< 1e-6`；
  - T4 沿切向泵摆后速度上升、摆角变化；
  - T5 收丝 30 帧后 `L` 按 330 px/s 缩短且约束仍成立；
  - T6 松手后切向速度保留，自由飞行仅叠加 `g·dt`；
  - T7 更远的“朝前”锚优先于更近的身后锚。
- [x] **经济增减**：T9 星屑 +1 且分数上升、不可重复收集；T12 尖刺/深渊扣命；T14 三条命耗尽进入 `gameOver`。
- [x] **失败路径**：T14 三次尖刺死亡 → `mode=end`、`lives=0`、`gameOver` 帧、结算面板可见。
- [x] **胜利/里程碑**：T16 通关得 3 星、解锁下一关、`progress` 帧与 localStorage 写入；T16d 玩家物理穿过星门也会触发通关；T30 第 18 关产生 `complete`。
- [x] **上报帧序**：模块报告日志首帧为 `ready`；T14 捕获 `gameOver`，T16/T16d 捕获 `progress`，T30 捕获 `complete`；T24 验证分类信封。
- [x] **best / 进度 localStorage 读写还原**：T25 写入并读取 `sls2.best/stars/total/unlocked`，随后恢复到测试前快照；两轮结束后 `sls2.*` 均为加载前原值（本次环境无预存值，恢复为 null）。
- [x] **输入模拟生效**：T10 通过真实键路径 `Space` 抓取、`KeyD` 改变 vx；T20 触控抓丝/右移按钮生效；Playwright 真实键盘 `Space/A/D/W/R/P/M` 与真实鼠标按住均按预期改变状态（见 `final-test.json.input`）。
- [x] **暂停冻结**：T11 暂停后 30 帧位置、丝长与关卡计时完全不变，恢复后可继续；真实 P 键同样冻结（`input.pause.frozen=true`）。
- [x] **触控绑定**：T20 与移动端实载（430×820, hasTouch）验证抓丝键、←/→、收/放按钮均改变锚点/速度。
- [x] **重开复位**：T21 与真实 R 键均复位生命 3、星屑 0、计时 0、锚点解除。
- [x] **结算按钮实测**：通关后点「下一关」进入第 2 关；失败后点「再试一次」回到第 1 关且生命 3、星屑 0；点「回标题」回到标题画面，均无控制台报错。
- [x] **整局快进无异常**：T22/T29 对 18 关逐关跑参考路线，全部完成、全部 3 星屑、无 NaN；T22b 把第 1 关完整跑过真实的 `update` 主循环（含抓取事件、星屑、星门结算与结算面板），约 3.5–4.1 s 完成并收齐 3 星屑；T28 720 帧随机输入无 NaN/崩溃/新报错。
- [x] **18 关结构**：T23 断言 18 关、3 章各 6 关、每关 3 星屑、锚点 ≥ 7、par ≥ 20。
- [x] **移动锚/脆丝/风区**：T17 活锚位置随时间变化；T18 脆丝 2.6 s 崩断并释放玩家；T19 风区改变 vx 方向。
- [x] **站点桥接**：iframe 实载捕获 `lightgame:ready` 与兼容信封；`goHome/clickMore/dp_share/play68_submitScore/show_share` 均为 function；`gameOver.progress` 为 `{value:1}`。
- [x] **缩略图**：`thumbnail.jpg` 为 640×360 JPEG，来源为第 14 关实机游玩帧（`.scratch/.../gameplay-final.png`：玩家挂在移动锚上、丝线绷紧、星屑 3/3、右侧釉朱星门可见）。
- [x] **资源体积**：整包约 153 KB，远小于 15 MB；无外部字体/图片/音频。
- [x] **编码**：所有源码/文档 UTF-8 无 BOM。

关键截图：

- `.scratch/guizang3/silkline-swing/title-final.png`（标题 + 选关）
- `.scratch/guizang3/silkline-swing/gameplay-final.png`（第 14 关实机荡跃）
- `.scratch/guizang3/silkline-swing/desktop-input.png`（真实键鼠）
- `.scratch/guizang3/silkline-swing/mobile-title.png` / `mobile-play.png`（竖屏）
- `.scratch/guizang3/silkline-swing/end-win.png` / `end-fail.png`（结算）
- `.scratch/guizang3/silkline-swing/autotest-round1.png` / `autotest-round2.png`
- `.scratch/guizang3/silkline-swing/final-test.json`（两轮与真实输入原始结果）

### 仅确认“能创建/不报错”，未做主观验收

- WebAudio 在真实点击后成功创建（`audioCtx: true`），合成 SFX/BGM 的代码路径无报错；自动测试期间保持静音，**没有人耳主观试听**音色、音量平衡与循环耐听度。
- 物理是游戏化的刚性丝线模型，不是有限元绳索；参数经 18 条参考路线与输入冒烟验证，但未做专业力学校准。
- 未在低端手机上做长时间 profiler；当前每帧约 18 个锚点、少量粒子、静态背景缓存，桌面无头 Chromium 流畅。

### 需要人工试玩确认

- 泵摆手感：水平推力与真实摆荡节奏的匹配度，以及“松手时机”的容错是否合适。
- 移动锚/脆丝在真机触屏上的可读性与难度曲线（第 7 关起的引入是否自然）。
- `par` 时间与“收齐 3 星屑”的紧张感是否平衡。
- 触屏竖屏居中画幅的可玩性（画幅较高，建议横屏）。
- 音频主观听感与音量。
