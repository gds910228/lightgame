# Echo Hour 回声之时 · 设计文档

- 系列：灯匠夜游 · Guizang 精品系列第三期 · 第 12 铺
- id：`echo-hour`
- 类型：2D Canvas 时间回溯解谜平台
- 目录：`packages/games/echo-hour/`
- 技术：vanilla ES modules、Canvas 2D、WebAudio 全合成、零外部请求

## 1. 设计目标

玩家同时掌握两段时间：

1. **回声（Echo）**：录制最近最多 8 秒的自身行动，停下后生成青色的“回声影子”，按固定帧序循环重演。影子能替玩家压住压力板、踩下时序开关、抬起冲压机、顶住滑石，但不能拾取沙漏与星粒，也不会被机关伤害。
2. **倒流（Rewind）**：按住 Q / Shift，把玩家自身与局部时间机关（门计时、激光相位、冲压机、传送带、滑石、开关倒计时）倒回最多 3 秒。倒流会同时回退玩家位置、速度、关卡用时与机关时钟。

核心张力：影子代表“未来的重复”，倒流代表“过去的撤回”。前者要求玩家预先设计一段可循环的动作，后者要求玩家在错误的节拍里主动退回去。三星分别由“是否通关 / 用时 / 倒流次数”决定。

观感：深夜靛青纸底、暖铜金机关、青/琥珀双时间轴、釉朱危险光闸、玉青终点时门。角色、平台、机关、粒子全部程序化绘制。

## 2. 操作

| 操作 | 键鼠 | 触屏 |
|---|---|---|
| 移动 | A / D 或 ← / → | ← / → |
| 跳跃 | Space / W / ↑ | 跳 |
| 开始 / 停止录制 | E | 录 |
| 倒流（按住） | Q 或 Shift | 溯（按住） |
| 重开本关 | R | HUD 的“重” |
| 暂停 | P / Esc | HUD 的“停” |
| 静音 | M | HUD 的“声/静” |

跳跃：`Space` 按下沿触发，支持 0.11s 输入缓冲与 0.09s 郊狼时间；松键可短跳。

## 3. 数值表（实测代码常量）

| 项目 | 数值 |
|---|---|
| 固定步长 | 1/60 s，dt clamp 0.1s，帧内最多 5 step |
| 玩家碰撞盒 | 22 × 32 px |
| 移动加速度 / 摩擦 | 2800 / 3200 px·s⁻² |
| 最大水平速度 | 250 px·s⁻¹ |
| 重力 / 最大下落 | 1900 / 900 px·s⁻² |
| 跳跃初速 | 590 px·s⁻¹（最大高度约 91.6 px） |
| 录制上限 | 480 帧 = 8.0 s，满帧自动停止 |
| 回放帧率 | 60 Hz，按帧插值，循环播放 |
| 倒流缓冲 | 181 个快照 ≈ 3.0 s |
| 生命 | 3 点；死亡扣 1 点，归零判负 |
| 死亡硬直 | 0.62 s 后回到起点 |
| hit-stop | 死亡 0.07s、收集 0.02s、回声生成 0.03s |
| 屏幕震动 | 幅度上限 17，按剩余时间衰减 |
| 粒子上限 | 280 个 |
| DPR 上限 | 2 |
| 画布逻辑尺寸 | 1280 × 720，等比 letterbox |
| 收集品 | 沙漏 +100 分；星粒 +100 分 |
| 通关底分 | +200 分；最终分 = 关卡分 + 关卡号 × 10 |
| 星级 | 1 星通关；用时 ≤ par 再 +1；倒流次数 ≤ rewindPar 再 +1 |
| 失败上报 | `gameOver{score, progress}`；最终关/全通 `complete` |

机关模型：

| 机关 | 行为 | 回声参与 | 倒流参与 |
|---|---|---|---|
| 压力板 plate | 任意身体压住即接通 | ✓ | 状态由位置派生 |
| 铜门 door (hold) | 压力板接通期间打开 | ✓ | — |
| 铜门 door (timer) | 开关触发后倒计时打开 | 开关由回声触发 | ✓ 计时回退 |
| 铜门 door (period) | 按机关时钟周期开合 | — | ✓ 相位回退 |
| 时序开关 switch | 进入沿触发，开门 N 秒，0.55s 冷却 | ✓ | ✓ 计时/冷却回退 |
| 光闸 laser (plate) | 压力板接通时熄灭 | ✓ | — |
| 光闸 laser (period) | 按周期亮灭，致命 | — | ✓ 相位回退 |
| 冲压机 crusher | 周期上下，重叠致命；压力板接通时抬起 | ✓ | ✓ 相位回退 |
| 传送带 conveyor | 周期顺/逆向推动 | — | ✓ 相位回退 |
| 滑石 mover | 周期上下，实心挡路；压力板接通时抬起 | ✓ | ✓ 相位回退 |

两种能力合计覆盖全部 7 类机关；回声直接参与 6 类（plate、switch、hold-door、plate-laser、crusher、mover），倒流直接参与 6 类（timer-door、period-door、period-laser、crusher、conveyor、mover）。

## 4. 关卡与内容

12 关，3 章 × 4 关，全部手工摆放、无运行时随机布局。每关 2–3 个沙漏/星粒，至少一个位于主路线可自动拾取，另一个通常需要跳上侧台；侧台尖刺构成可选的失败风险。

| 关 | 章 | 名称 | par / 倒流 par | 主要机关 | 解法要点 |
|---|---|---|---|---|---|
| 1 | 一 | 第一道回声 | 20s / 0 | 压力板 → 铜门、尖刺 | 录制走上铜板并停留 1.6s，影子压板，本体过门 |
| 2 | 一 | 光闸之下 | 24s / 0 | 压力板 → 双光闸 | 影子多站 1.9s，趁光闸熄灭连穿两道 |
| 3 | 一 | 守时的门 | 22s / 1 | 时序开关、计时门 | 影子循环踩开关，本体在门前等门开 |
| 4 | 一 | 冲压机之息 | 25s / 1 | 压力板 → 冲压机 | 影子压板使冲压机悬停，本体通过 |
| 5 | 二 | 激光节拍 | 24s / 2 | 周期光闸 | 在安全位倒流 1.0s，等待新的熄灭窗口 |
| 6 | 二 | 逆向传送带 | 27s / 2 | 周期传送带 | 倒流到顺向相位，再一次性跑过 |
| 7 | 二 | 双压走廊 | 25s / 2 | 双周期冲压机、尖刺 | 倒流调整相位，逐台等“刚抬起”的空窗 |
| 8 | 二 | 滑动石匣 | 27s / 2 | 影子压板 → 滑石、周期门 | 影子抬起滑石，倒流对齐时序门 |
| 9 | 三 | 影与光 | 30s / 3 | 影子压板 → 门、周期光闸 | 门由影子保持，光闸由倒流对齐 |
| 10 | 三 | 定时与滑石 | 30s / 3 | 影子踩开关 → 计时门、滑石 | 影子负责门，滑石由倒流调相位 |
| 11 | 三 | 三重时轴 | 32s / 3 | 影子压板 → 冲压机、传送带 | 冲压机由影子抬起，传送带由倒流拨顺 |
| 12 | 三 | 双时之门 | 42s / 3 | 板→光闸、开关→计时门、周期光闸、冲压机 | 影子压光闸，本体踩开关，倒流穿最后节拍 |

每关的可行解以 `solution` 脚本保存在 `js/levels.js`，由 `G.auditLevel(n)` 使用**真实物理、真实碰撞、真实机关与真实倒流**逐帧执行并验证抵达终点。

## 5. 工程结构

```
packages/games/echo-hour/
  index.html           中文 UI、错误陷阱、__NET 审计、双静态桥接脚本
  js/game.js           主循环、状态机、回声、倒流、机关、上报、G、autotest
  js/physics.js        固定步长玩家物理、AABB、phase、星级
  js/levels.js         12 关数据 + 每关可行解脚本
  js/render.js         程序化 Canvas 绘制、背景、角色、机关、粒子
  js/audio.js          全合成 SFX + 帧驱动 BGM
  js/ui.js             HUD、双时间轴、标题关卡网格、结算、触屏
  static/play68.js     本地兼容层（goHome/clickMore/dp_share/play68_submitScore）
  static/play68bar.js  本地分享桥（parent.handleGlobalShare）
  metadata.json
  thumbnail.jpg        640×360 JPEG，实机游玩截图
  DESIGN.md
```

### 站点上报

- `report(kind,payload)` 始终把**扁平帧**推入内部 `reports` 并回调 `reportTarget`（供 autotest）。
- 向父页面发送时使用兼容信封：progress → `{kind,data}`；event → `{kind,event,data}`；gameOver → `{kind,score,progress:{value},data}`；complete → `{kind,score}`。
- `ready` 帧另发 `{source:'lightgame',type:'lightgame:ready',gameId:'echo-hour',v:1}`。
- 分数为整数；stored best 为总星数，localStorage 前缀 `ech.`（`ech.stars` / `ech.unlocked` / `ech.best` / `ech.mute`）。

### G 钩子

`window.G = window.__G` 提供：`err、step、upd、press、up、setNoAuto、setReportTarget、state、startLevel、toTitle、restartLevel、nextLevel、forceWin、forceFail、setLives、setTime、setRewinds、setKeys、setPlayer、setMechTime、setEchoPos、clearEcho、toggleRecord、stopRecord、setSimDir、setSimJump、setSimRewind、auditLevel、auditAll、levelConfigs、storageSnapshot、restoreStorage、reports、clearReports、audio、ui、renderer`。内部状态修改全部通过 setter，`state()` 只返回只读快照。

## 6. 验证清单（如实记录）

### 实测通过（本机 Playwright + Chromium headless）

- [x] **连续 2 轮** `?autotest=1`：均为 **52 / 52 通过**，`fail=0`。
- [x] 每轮 `console error = 0`。
- [x] 每轮 `script warning = 0`（含 AudioContext 自动播放警告；autotest 不再创建未授权 AudioContext）。
- [x] 每轮 `pageerror = 0`。
- [x] 每轮外网请求 = 0（`window.__NET.external` 为空，Playwright request 列表过滤 localhost 后为空）。
- [x] 直接打开无参数页：`__BOOTERR=0`、`G.err=0`、标题可见、模式 title。
- [x] 真实键盘冒烟：Enter 进入第 1 关；按住 D 500ms 后 x 130 → 249.1；Space 后 y 588 → 553.7；E 开始录制；再按 E 生成回声（38 帧）。
- [x] 真实指针冒烟：显示触屏控件后点击“录”按钮，`recording` 由 false → true。
- [x] 12 关快速解审计（真实物理）：12/12 全部 `cleared=true`，每条均 3 条命无死亡；用时 7.38–12.45s，倒流 0–1 次。
- [x] 全局快进：900 帧随机输入 + 录制/倒流切换，无 NaN、无崩溃、无新增错误。
- [x] 暂停冻结、重开复位、3 种死亡（尖刺/光闸/坠落）→ `gameOver`、最终关 → `complete`、best localStorage 写入/读取/恢复。
- [x] 回声是“记忆”而非第二个实体：与玩家重叠时不影响玩家移动，也不造成伤害。
- [x] 640×360 横屏标题页实测不溢出、开始按钮可见（`shot-title-mobile.png`）；触屏控件在 640×360 下可点击。
- [x] `thumbnail.jpg`：640×360 JPEG，实机 `?autostart=1` 游玩画面（回声压板、门已开、玩家在门前）。
- [x] 体积约 184 KB（远小于 15 MB）；所有中文文件 UTF-8 无 BOM。

### 12 关审计实测明细

| 关 | 结果 | 模式 | 生命 | 用时 | 倒流 | 收集 |
|---|---|---|---|---|---|---|
| 1 | 通过 | end | 3 | 8.32s | 0 | 1/2 |
| 2 | 通过 | end | 3 | 9.42s | 0 | 2/2 |
| 3 | 通过 | end | 3 | 7.63s | 0 | 1/2 |
| 4 | 通过 | end | 3 | 10.12s | 0 | 2/2 |
| 5 | 通过 | end | 3 | 7.38s | 1 | 1/2 |
| 6 | 通过 | end | 3 | 8.02s | 1 | 2/2 |
| 7 | 通过 | end | 3 | 9.72s | 1 | 1/2 |
| 8 | 通过 | end | 3 | 11.58s | 1 | 2/2 |
| 9 | 通过 | end | 3 | 11.97s | 1 | 2/2 |
| 10 | 通过 | end | 3 | 11.13s | 1 | 2/2 |
| 11 | 通过 | end | 3 | 11.00s | 1 | 2/2 |
| 12 | 通过 | end | 3 | 12.45s | 1 | 2/3 |

### 仅确认“不报错”，未做真人手感验证

- 触屏布局在 640×360 视口与 pointer 事件下工作正常；未在真实 iOS/Android 设备上试玩，不排除刘海/安全区与手指遮挡差异。
- WebAudio 合成音色、BGM 音量比例与倒流音效未由人耳主观评估；autotest 全程静音，只验证状态机与零报错。
- 倒流的 3 秒窗口、8 秒录制窗口与各关 par 的松紧度由脚本证明可解，尚未经过多轮真人试玩调优。
- 12 关可行解均使用“走到目标点 + 等待窗口”的脚本；真人可能用跳跃、提前录制等更灵活的方式通关，这些路径未逐一覆盖。

### 需人工试玩确认

- 第 1 关的教程引导是否足够让玩家理解“先录制、再停下、等影子压板”。
- 第 9–12 关双能力同时使用时，倒流 3 秒是否足够宽容。
- 侧台尖刺与可选收集品是否构成有趣的额外挑战，而非纯惩罚。
- 双时间轴 HUD 在手机横屏/竖屏下的可读性。

## 7. 已知问题 / 取舍

- 渲染为纯 Canvas 程序化图形，无位图素材；远景齿轮与纸纤维颗粒在低 DPR 屏幕上偏淡。
- 回声音轨是位置插值回放，不携带玩家速度用于二次物理；影子只按录制位置触发机关，不参与碰撞。这是刻意设计，保证回声是“记忆”而非第二个玩家。
- 倒流时回声时间冻结，避免机关状态与影子位置产生不一致；视觉上影子会短暂停在原地。
- 关卡 1 的主路线刻意留白，作为教学关；视觉丰富度低于第 3 章。
- 未做关卡内检查点；死亡回到起点，但回声会保留，重试成本较低。
- 未在本轮执行 `scripts/` 下的站点级冒烟或集成管线（brief 禁止 sync/build/commit）；仅验证单款目录与静态服务。

## 8. 验证命令（本地复跑）

```bash
cd packages/games && python3 -m http.server 8627
cd .scratch/guizang3/echo-hour && node test.mjs
```

`test.mjs` 会输出两轮 52 项断言、控制台/外网审计、真实键鼠结果，并生成：

- `.scratch/guizang3/echo-hour/shot-title.png`（1280×720）
- `.scratch/guizang3/echo-hour/shot-play.png`（640×360）
- `.scratch/guizang3/echo-hour/shot-play-1280.png`（1280×720，人工检查用）
- `.scratch/guizang3/echo-hour/shot-title-mobile.png`（640×360 横屏标题检查）
- `packages/games/echo-hour/thumbnail.jpg`（640×360 JPEG）
