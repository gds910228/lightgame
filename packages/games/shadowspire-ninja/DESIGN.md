# 影峰登天 Shadowspire Ninja — 设计文档

> 灯匠夜游 · 第 2 铺。竖高画幅 2D 忍者蹬墙爬塔，纯 vanilla JS ES module，
> Canvas 程序化美术 + WebAudio 全合成音画，零外部请求。逻辑画幅 540×960，
> 桌面与触屏均可玩。开发者自测记录见文末。

## 1. 体验目标

- **一句话**：从塔底一路蹬墙、冲刺、拾灯屑，爬满 1200m 到星阁。
- **第一分钟**：起跳后立刻能贴墙；蹬墙 1.5 秒内接 Shift 冲刺必得「蹬墙·疾影」+120 分与回气，
  形成前 10 秒的第一次正反馈。教程 toast 与首次蹬墙/冲刺提示各出现一次。
- **记忆点**：不落地连续 3 次蹬墙 → 进入 3.2 秒「流」状态（移动 ×1.28、+200 分、粒子/音效/横幅）。
- **风险**：3 条命，150m 一个灯标；坠落超过最近灯标 28m 或碰到刺阵即失一命；命尽结算。
- **节奏**：木塔（暖铜、木构、火星）→ 风廊（玉青、竹格、风线）→ 星阁（靛紫、金线、星图）。

## 2. 操作

| 输入 | 行为 |
|---|---|
| A / D、← / → | 横移 |
| Space / W / ↑ | 跳跃；贴墙时蹬墙跳 |
| Shift / K | 疾影冲刺（消耗 24 气，0.38s 冷却，0.23s 无敌帧） |
| P | 暂停 / 继续 |
| M | 静音 / 恢复（存 `ssn.mute`） |
| R | 重开本局 |
| 触屏 | 左 / 右 / 跃 / 疾 四键；右上角暂停、静音 |

## 3. 数值表（实测使用的常量）

| 项目 | 数值 | 备注 |
|---|---|---|
| 固定步长 | 1/60 s | accumulator 上限 0.16s，单帧最多 6 步 |
| 逻辑画幅 | 540×960 | PPM = 18 px/m，塔宽 30m |
| 塔高 / 房间 | 1200m / 60 间×20m | 主线平台每 2.857m 一级 |
| 重力 | 47 m/s² | 下落钳制 -22 m/s |
| 横移速度 | 7.7 m/s | 地面加速 58，空中加速 31 |
| 跳跃初速 | 19.6 m/s | 跃高约 4.09m；土狼时间 0.11s；跳跃缓冲 0.12s |
| 墙滑 | -4.3 m/s | 需按住朝墙方向 |
| 蹬墙跳 | 水平 9.4 / 垂直 17.7 m/s | 不落地连跳计数；落地清零 |
| 流状态 | 3.2s，移动 ×1.28 | 三连蹬墙触发；+200 分；hit-stop 70ms |
| 冲刺 | 27 m/s，0.16s | 耗气 24；冷却 0.38s；无敌 0.23s |
| 气 | 0–100 | 开局 100；灯屑 +18；灯标回满；复活保底 60 |
| 蹬墙+冲刺奖励 | +120 分、气 +10 | 蹬墙后 1.5s 内冲刺；每次蹬墙限一次 |
| 灯屑 | 每颗 +1 灯屑、+18 气、+25 分 | 共 3×约 2–3 颗/房间 + 3 颗开局引导 |
| 高度得分 | 每新高度 1m +2 分 | 只按历史最高计，不刷回程分 |
| 灯标 | 150/300/…/1050m | +300 分，回满气，记录复活点 |
| 生命 / 复活 | 3 条 / 1.25s 无敌 | 命尽 → gameOver |
| 深渊判定 | 低于最近灯标 28m | 第一段以 0m 为基准 |
| 刺阵 | 静态刺 + 周期预警 | 预警 1.05s → 伸出 0.72s → 收回；周期 3.8s |
| hit-stop / 屏震 | 85ms（致命），70ms（流） | 屏震上限 8px |
| 最高纪录 | `ssn.best`，整数米 | 灯标/死亡/通关/离页时写入；标题与 HUD 展示 |

## 4. 文件结构

```
index.html               中文 UI、错误陷阱、stage/letterbox、触屏键、play68 桥接
js/game.js               固定步长主循环、物理/输入/灯标/经济/上报/G 钩子/autotest
js/level.js              确定性 60 房间生成、检查点平台、刺阵、灯屑、可达性统计
js/render.js             Canvas 程序化美术（塔构/平台/角色/灯屑/预警/粒子/远景）
js/audio.js              WebAudio 全合成 SFX + 六态 BGM（title/wood/wind/star/danger/win）
js/ui.js                 DOM HUD、横幅/toast、标题/暂停/结算、best 显示
static/play68.js         本地兼容层：goHome / clickMore / play68_submitScore
static/play68bar.js      本地分享桥：handleGlobalShare(score)、dp_share 与旧别名
metadata.json / thumbnail.jpg / DESIGN.md
```

## 5. 站点与调试接口

- `?autotest=1`：静音跑 33 条断言 → `window.__TEST.done`，结束回标题。
- `?autostart=1` / `?auto`：直接开局，便于实机截图。
- `window.G` / `window.__G`：`err, step(n,dt), upd(n,dt), press(...), release(...), setNoAuto,
  setReportTarget, state(), setHeight, setPos, setLives, setChi, setScore, setDust, setBest,
  setInvuln, setPaused, damage, forceGameOver, forceWin, level, route, audio, renderer`。
- 状态改动均走 `setXxx`；`G.state()` 返回只读快照。
- 上报：`ready{game}` → 开局/灯标 `progress{score,progress}` → `gameOver{score,progress,cause}`
  或 `complete{score,progress}`。`setReportTarget` 可捕获帧。
- 分享：`dp_share(score)` 优先调用 `window.parent.handleGlobalShare(score)`；
  `goHome/clickMore` 返回站点 `/`。所有脚本、字体、画布素材均为本地或系统资源。

## 6. 美术与手感实现

- 深夜靛青纸底：逐帧渐变 + 预渲染纸纹 + 星点/火星/风线 + 纸刻塔架/吊牌/印章。
- 三塔区主色：木塔暖铜 `#d99a55`；风廊玉青 `#80cbb6`；星阁金紫 `#e4c06f/#372257`。
- 平台带金色上沿、木纹/竹节/星纹、纸刻锯齿底边与托架；检查点有鸟居式灯架与灯标牌。
- 忍者：手绘线描身体 + 铜金描边、围巾拖尾/头带、背刀、跑步/跳跃/蹬墙/冲刺姿态；
  冲刺拖影，受伤闪烁，粒子/浮动分数/环。
- 镜头：指数平滑跟随；屏震带 8px 上限；命中 70–85ms 冻结；粒子和浮动字都在主循环内更新。

## 7. 验证清单

### 7.1 实测通过（Playwright 实载，两轮连续）

- [x] `?autotest=1` **33/33 断言全过 ×2 轮**（`.scratch/guizang3/shadowspire-ninja/test.mjs`）
- [x] 零 console error/warning、零 pageerror、零 requestfailed
- [x] 零外部请求；实际请求仅为 `localhost:8611` 下的 index、2 个 static、5 个 js 模块
- [x] `__BOOTERR` 与 `G.err` 均为空；两轮结束均回到标题，`best` 测试后还原
- [x] 核心数学：跳跃初速、贴墙检测+蹬墙水平/垂直速度、冲刺扣气/冷却/无敌、三连蹬墙流状态
- [x] 经济：灯屑 +1/+18 气/+25 分；高度计分；灯标 +300 与回气
- [x] 失败路径：刺/伤害扣命→检查点复活；最后一条命→`gameOver` 上报
- [x] 胜利路径：高度 1200m → `win` + `complete` 上报
- [x] 上报帧序：ready 首帧；progress 在 gameOver/complete 之前；gameOver/complete 为末帧
- [x] `ssn.best` localStorage 写入/读回，测试后恢复原值
- [x] 输入模拟：`G.press('KeyD')` 后 x 增加；`Space` 后高度上升
- [x] 暂停冻结位置，恢复后继续移动；重开复位命/分/屑/高度
- [x] 触屏四键存在，`pointerdown` 跳跃键实际起跳
- [x] 1200 帧混合输入快进无 NaN/无新增报错；`G.step` 渲染 8 帧无错
- [x] 刺阵周期：预警段先于伸出段，预警可被视觉捕获
- [x] 关卡可达性：429 个 route 面，最大纵向升差 2.86m，最大横向边缘间隙 6.64m
- [x] 真实键盘冒烟（`.scratch/.../smoke.mjs`）：点击开始后 AudioContext 建立；
  → 移动 x 15→19.04；Space 后 y→2.71m；Shift 后气 100→76、dashT≈0.11、无敌≈0.18；
  P 暂停覆盖层出现，M 静音；rAF 采样 60fps；控制台/外网均零
- [x] 直接打开 `index.html`（不带参数）无 console 错误；标题 HUD 隐藏、best 与印记显示
- [x] 截图：标题 1280×720、游戏内 640×360、封面 640×360 JPEG（非纯色，1.3 万色）
  - `.scratch/guizang3/shadowspire-ninja/title-1280x720.png`
  - `.scratch/guizang3/shadowspire-ninja/game-in-640x360.png`
  - `packages/games/shadowspire-ninja/thumbnail.jpg`（另存 `.scratch/.../thumb-checkpoint.png`）

### 7.2 仅确认不报错 / 数学上可达

- [x] 60 房间程序化生成固定 seed 可复现；但**未由真人从 0m 连续手动爬到 1200m**。
  已分别实测每类动作、检查点、伤害、胜利上报和路线间隙；完整 5 分钟真人攀爬需人工试玩。
- [x] WebAudio 合成路径不报错且真实手势可建 context；音色/平衡**未用耳朵验收**。
- [x] 三种塔区画面均由同一渲染器实际绘制并截图；星阁截图见封面，木塔/风廊仅代码路径与短跑验证。

### 7.3 需人工试玩确认

- 蹬墙三连的难度与「流」窗口是否偏宽/偏窄。
- 灯屑密度是否足够支撑冲刺节奏（当前 153 颗）。
- 触屏按键尺寸/拇指遮挡、长时间攀爬的重复感与 BGM 听感。

## 8. 已知问题

- 竖屏 9:16 在宽屏下左右留黑边（按规格 letterbox）；封面使用实机竖屏画面的横向裁切，
  因此不含 HUD。
- 关卡为确定性程序生成但非手工编排；安全路线连续可达，但视觉上局部段落较疏。
- 未提供完整 1200m 的录像或人类通关记录；难度与心流仍建议人工试玩微调。
