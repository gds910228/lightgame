# Ironwright Arena 锻甲机斗场 — 设计文档

> 灯匠夜游 · 第 11 铺。2D Canvas 机甲装配 + 三连 Boss 竞技场。全程序化绘制与 WebAudio 合成，无外部请求、字体、图片或音频。工作区：`packages/games/ironwright-arena/`。

## 1. 定位与观感

| 项 | 决定 |
|---|---|
| 类型 | 装配式双摇杆机甲 Boss Rush |
| 视角 | 固定 2D 画幅 1280×720，熔炉竞技场 |
| 调色 | 铁灰 `#1b1916` / 警示橙 `#ff8a3d` / 熔金 `#ffd27a` / 赤热 `#ff5a24` / 玉青屏障 `#8fe6d4` |
| 标题 | 「灯匠夜游 · 第 11 铺」置于标题页与结算页 |
| 美术 | 全部 Canvas 路径、渐变、粒子与描边；机甲躯干、武器、推进器随装配改变轮廓；Boss 体型/配色/攻击预警区分明确 |
| 音频 | WebAudio 全合成，首次真实手势后建 AudioContext；M 静音；autotest 期间不建 AudioContext |
| 工程 | Vanilla ES modules，无依赖；固有步长 60 Hz，dt clamp；DPR ≤ 2；粒子/弹幕上限；页面隐藏暂停 |

## 2. 流程

标题 → 锻炉装配（初始）→ Boss 1「铁颚监工」→ 锻炉整备（有限维修 + 改装）→ Boss 2「熔核裁判」→ 锻炉整备 → Boss 3「铸世巨像」→ 通关。

- 任意 Boss 战 HP 归零 → `gameover`，上报 `gameOver`，结算面板提供「整备再战 / 回标题」。
- 三战全胜 → `complete`，上报 `complete`，记录最佳通关时间与最高分。
- R 键任一战/结算中重新整备：回到锻炉，Boss 归零、HP 满、铸币回到初始值。
- 每场约 1–2 分钟。脚本机器人实测（不停射击、环绕移动、自动开屏障、每战维修）：
  - 默认机（机炮/蜂窝复甲/标准推进器）：48.4s / 72.4s / 62.0s，通关时 2 HP。
  - 熔钢重甲（首战后换装）：55.6s / 76.8s / 90.4s，通关时 8 HP。
  - 寒铁绝缘甲：45.4s / 67.1s / 75.2s，通关时 43 HP。
  - 以上为脚本验证，不是人类试玩数据。

## 3. 装配与数值

### 3.1 推导公式

```
weight      = weapon.weight + armor.weight + thruster.weight
maxHp       = armor.hp
armorFlat   = armor.armor
moveSpeed   = round(250 × armor.speed × thruster.speed × (1 − weight × 0.0012))
heatCap     = armor.heat + thruster.heat
heatVent    = round(11 × armor.vent, 1) /s
dashSpeed   = round(760 × thruster.dash)
dashCost    = 32 energy
dashCd      = thruster.cd
energyMax   = thruster.energy
energyRegen = thruster.regen /s
伤害减免    = max(1, 原始伤害 − armorFlat)
过热        = heat ≥ heatCap → 1.2s 停火；结束后 heat 降至 35% 上限
```

### 3.2 武器（6）

| 武器 | 模式 | 铸币 | 单发伤害 | 间隔 | 热量/发 | 射程 | 重量 | 特点 |
|---|---|---:|---:|---:|---:|---:|---:|---|
| 熔切巨刃 | melee | 30 | 46 | 0.55s | 9 | 148 | 24 | 118° 扇形斩；可劈掉近身弹丸 |
| 双管机炮 | auto | 45 | 8 | 0.11s | 5.2 | 760 | 18 | 9.1 发/s，持续压制 |
| 蜂群导弹 | missile | 60 | 38 | 0.85s | 17 | 780 | 26 | 追踪，命中熔爆 |
| 聚焦光束 | beam | 65 | 5 | 0.10s | 5.8 | 700 | 22 | 高速重离子束，热量极高 |
| 熔渣霰弹 | shot | 40 | 6×8 | 0.72s | 18 | 470 | 30 | 8 枚扇形，近身爆发 |
| 逆流盾铳 | pulse | 55 | 24 | 0.46s | 11 | 610 | 32 | E 屏障时长×1.55、反弹×1.5 |

### 3.3 装甲（6）

| 装甲 | 铸币 | HP | 固定减伤 | 速度系数 | 热量容限 | 散热系数 | 重量 |
|---|---:|---:|---:|---:|---:|---:|---:|
| 游隼骨架 | 30 | 90 | 0 | 1.22 | 80 | 1.00 | 18 |
| 轻质陶甲 | 40 | 105 | 1 | 1.12 | 98 | 1.12 | 28 |
| 蜂窝复甲 | 50 | 130 | 2 | 1.00 | 122 | 1.00 | 40 |
| 赤铜反应甲 | 55 | 118 | 1 | 1.04 | 115 | 1.32 | 36 |
| 寒铁绝缘甲 | 60 | 128 | 2 | 0.95 | 155 | 1.10 | 48 |
| 熔钢重甲 | 65 | 180 | 4 | 0.82 | 110 | 0.90 | 66 |

### 3.4 推进器（4）

| 推进器 | 铸币 | 速度系数 | 冲刺系数 | 冲刺 CD | 能量上限 | 回能/s | 附加热量 | 重量 | 特性 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| 标准推进器 | 25 | 1.00 | 1.00 | 1.40s | 100 | 24 | 0 | 22 | 均衡 |
| 涡轮冲刺 | 45 | 1.08 | 1.28 | 1.02s | 90 | 22 | 8 | 20 | 冲刺更远、更频繁 |
| 悬浮反推 | 35 | 1.12 | 0.92 | 1.18s | 120 | 30 | 2 | 24 | 悬浮滑行 |
| 熔炉过载 | 55 | 0.94 | 1.45 | 1.55s | 130 | 20 | 18 | 34 | 冲刺撞击 40 伤害 |

默认装：双管机炮 + 蜂窝复甲 + 标准推进器（总价 120，初始 300 铸币 → 余额 180）。推导值：HP 130、减伤 2、移速 226px/s、热量上限 122、散热 11/s、冲刺 760px/s / 1.4s。

### 3.5 换装经济

- 换装按价差结算：`coins += 旧部件价格 − 新部件价格`。
- `coins + 价差 < 0` 时拒绝安装并提示。拆下贵部件会返还铸币。
- 战斗奖励：Boss 1 +90 铸币 / +20 零件；Boss 2 +120 / +32；Boss 3 +160 / +48。
- 战斗间整备：每场之间一次维修，30 铸币恢复 40% 最大结构；已满血或次数用尽则拒绝。
- 得分（整数）：`parts × 100 + 击败Boss数 × 1000 + coins`。
- 最佳通关时间与最高分分别写入 `irw.bestTime`、`irw.bestScore`；autotest 测后还原原值。静音写入 `irw.mute`。
- 自动瞄准 / 自动开火开关分别写入 `irw.autoaim`、`irw.autofire`（缺省：瞄开 / 桌面关·触屏开）；autotest 测后还原原值。

## 4. Boss 与攻击

| Boss | HP | 半径 | 移速 | 攻击间隔 | 奖励 | 攻击序列 |
|---|---:|---:|---:|---:|---|---|
| 铁颚监工 IRONJAW WARDEN | 2400 | 56 | 70 | 1.9s | 90 / 20 | 落锤、环射、冲撞、环射 |
| 熔核裁判 CRUCIBLE ARBITER | 3400 | 66 | 92 | 1.65s | 120 / 32 | 扫射光带、导弹雨、十字光束、扫射 |
| 铸世巨像 FORGE COLOSSUS | 4600 | 82 | 58 | 1.45s | 160 / 48 | 熔核新星、冲撞、导弹雨、十字光束；半血过载后间隔 ×0.62、弹速/弹数提升 |

### 4.1 攻击时间轴与伤害

| 招式 | 预警 | 生效 | 伤害 | 说明 |
|---|---|---:|---:|---|
| 落锤 slam | 1.0s | 0.68–0.80s 后落点爆炸 | 24 | 三个圆型落点，玩家当前位 + 两侧 |
| 环射 radial | 0.8s | 3 波（过载 4 波），间隔 0.24s | 10/弹 | 12/波径向弹 |
| 冲撞 charge | 1.0s | 0.46s 冲撞 | 28 | 锁定方向，红色走廊预警 |
| 扫射光带 sweep | 1.05s | 1.55s 旋转光束 | 18 | 1.3–1.7 rad/s 扫过 |
| 导弹雨 missiles/rain | 0.9–0.95s | 1.0s 后落点 | 20 | 5–10 个圆形落点 |
| 十字光束 cross | 0.95s | 0.55s 十字激光 | 20 | 横/竖两条贯穿光束 |
| 熔核新星 nova | 0.95s | 3 波，间隔 0.27s | 10/弹 | 20/22/24 枚环形弹 |

所有攻击均有地面/走廊/圆环预警，预警与生效分色；Boss 受击有白热闪光、粒子和轻微 hit-stop；玩家受击有红闪、屏幕震动、粒子与 0.55s 无敌窗。

## 5. 战斗操作

- **移动**：WASD / 方向键，椭圆竞技场边界钳制。
- **瞄准**：鼠标 / 触摸右摇杆为手动瞄准；**1.2 秒无手动瞄准输入后自动瞄准接管**（持续锁定 Boss，画 Boss 周围旋转锁定框）。`G` 开关或 HUD「瞄·自动/手动」按钮（快捷键 G）可关闭自动瞄准。
- **射击**：鼠标左键 / J / 触摸右摇杆按住；HUD「射·自动/手动」按钮（快捷键 F）开启后，自动瞄准锁定期间持续自动开火（触屏设备默认开、桌面默认关）。各武器按自身间隔与热量工作。
- **冲刺**：Shift / K / 触屏「冲刺」，消耗 32 能量，短暂无敌与残影；熔炉过载推进器有撞击伤害。
- **E 熔核屏障**：消耗 60 熔核，1.7s 无敌并反弹近身敌弹；逆流盾铳延长到 2.635s 并提高反弹伤害。
- **熔核**：造成伤害积累；初始 50，上限 100。
- **暂停 / 静音 / 重开**：P / M / R；触屏按钮含冲刺、E、暂停、静音。
- 页面隐藏自动暂停；固定步长 accumulator；autotest 用 `G.setNoAuto(true)` 完全接管推进。

## 6. 技术架构

```
index.html       中文 UI / HUD / 锻炉 / 触屏双摇杆 / 错误与网络审计陷阱
js/data.js       6 武器、6 装甲、4 推进器、3 Boss、派生数值、时间格式
js/renderer.js   程序化静态熔炉、玩家/Boss 轮廓、弹幕、粒子、预警、锻炉预览
js/audio.js      全合成 SFX + 标题/锻炉/战斗/Boss/结算五态音乐
js/game.js       固定步长主循环、装配经济、战斗、Boss AI、站点上报、G 钩子、39 条自测
static/play68*.js 本地兼容层；goHome/clickMore/dp_share/play68_submitScore 全局存在
```

- `window.G = window.__G` 提供 `step/upd/press/release/setNoAuto/setReportTarget/state` 与所有状态 setter（含 `setAutoAim/setAutoFire`）；状态快照只读。
- 上报：`reportTarget` 收扁平帧；parent 收兼容信封 `progress/event/gameOver/complete` 与 `lightgame:ready`。
- 分数强制整数；所有弹道/粒子在 frame 内更新；粒子上限 340、玩家弹 90、敌弹 240、落点 24。

## 7. 验证清单

### 7.1 自动化（实测）

- [x] **两轮连续 `?autotest=1`：39/39 全过**（39 条断言，第 1 轮与第 2 轮均 `pass=39 fail=0 total=39 done=true`）。
- [x] 启动零报错：`__BOOTERR=[]`、`G.err=[]`、console error=0、warning=0、pageerror=0。
- [x] 零外网请求：Playwright 请求列表 external=0；页面内 `__NET.fetch/xhr/ws=0`、`external=[]`。
- [x] 输入模拟生效：模拟 D 键移动 → x 640→715.33；模拟 J 射击 → Boss HP 2400→2352+；真实鼠标按住 → 2400→2352。
- [x] 瞄准手愷新增（T36-39）：手动瞄准保持、闲置 1.5 秒后自动瞄准接管并指向 Boss；关闭开关后炮口保持不动；自动开火在无输入下持续射击；`irw.autoaim`/`irw.autofire` 持久化并与 state 同步，测后还原。
- [x] 核心数学：武器伤害/间隔/热量差异；重甲 HP 180 / 减伤 4 / 移速 179；熔炉推进器冲刺 1102px/s / CD 1.55s；竞技场越界钳制。
- [x] 装甲减伤公式：30 − 2 = 28，HP 130→102。
- [x] 经济：换熔钢重甲 180→165；0 铸币拒绝安装聚焦光束；退回复合甲 500→515；Boss 奖励 +90；维修 −30 且回 40%。
- [x] 过热：热量阈值触发 `overheatT>0`，锁定期间射击数 7→7；冷却后解除。
- [x] 冲刺能量 100→68.8（32 消耗 + 回能）；E 屏障消耗 60 熔核、完全挡下 30 伤害。
- [x] 暂停冻结：P 后 30 帧玩家/Boss 位置和 runTime 不变，再按恢复。
- [x] 触屏：左摇杆 mag 0.74 推动机甲；右摇杆瞄准并射击；冲刺/E 按钮生效。
- [x] Boss 预警与执行：radial 预警 → 弹幕 0→23；slam 落点命中 HP 130→108。
- [x] 失败路径：HP 1 → 0，`gameover`，上报 gameOver；R 重开复位到锻炉。
- [x] 胜利路径：连续 3 个 Boss → `complete`，上报 complete，写入最佳时间。
- [x] best localStorage：写入 `irw.bestTime`/`irw.bestScore` 并与状态一致，测后还原。
- [x] 上报帧序：ready 首先出现；progress/event/gameOver/complete 均为整数 score；reportTarget 只收扁平帧。
- [x] 兼容信封（独立 iframe 实测）：progress→`{kind,data}`；event→`{kind,event,data}`；gameOver→`{kind,score,progress:{value},data}`；complete→`{kind,score}`；另发 `lightgame:ready`。
- [x] 1800 帧快进无 NaN、无异常、弹幕峰值 <400。
- [x] 真实键鼠冒烟：开始→锻炉→战斗；D 移动 x 640→745.47、鼠标射击 Boss HP 2400→2352、K 冲刺、E 屏障、P 暂停/恢复、M 静音/取消、R 重开全部生效。
- [x] 直接打开无参数页：`__BOOTERR=[]`，console/页面错误 0，外网 0。
- [x] 标题截图 1280×720：`.scratch/guizang3/ironwright-arena/title-1280x720.png`。
- [x] 游玩截图 640×360：`.scratch/guizang3/ironwright-arena/gameplay-640x360.png`。
- [x] 封面 `thumbnail.jpg`：实机游玩截图，640×360 JPEG（42,104 B）。
- [x] 本地静态脚本：`static/play68.js` / `static/play68bar.js` 存在，兼容入口全局函数存在。
- [x] 文件体积：整款 < 1 MB。

### 7.2 仅确认不报错（未做人耳/人眼主观验收）

- [x] 五态 WebAudio 合成音乐与全部 SFX 调用路径无异常（autotest 静音且不建 AudioContext）。
- [x] 三种 Boss 与玩家默认装的绘制路径已实际渲染截屏（Warden/Arbiter/Colossus 截图存 scratch）；其余部件仅经数值/经济断言与锻炉预览路径验证，未逐件截图。
- [x] 640–1280px 宽度下 HUD 重排不重叠（640×360 实截验证）。
- [x] 粒子/弹幕上限、hit-stop、screen shake 逻辑路径。
- [x] 页面隐藏自动暂停逻辑。

### 7.3 需人工试玩

- [ ] 真人手感：鼠标瞄准的舒适度、冲刺/屏障节奏、Boss 招式是否公平。
- [ ] 真机触屏摇杆尺寸、拇指遮挡、长时间游玩发热。
- [ ] 音效实际听感与音量比例（BGM ≈ SFX 的 1/3~1/4）。
- [ ] 默认配装通关难度；脚本通关剩 2 HP，真人可能需要换重甲/寒铁甲。
- [ ] 最佳成绩在真实站点 localStorage / 父页上报环境中的持久化。

## 8. 验证命令与产物

```bash
# 静态服务
cd packages/games && python3 -m http.server 8626
# 两轮自测 + 真实键鼠 + 直接页审计 + 截图
node .scratch/guizang3/ironwright-arena/final-test.mjs
# 兼容信封（iframe parent）
node .scratch/guizang3/ironwright-arena/envelope.mjs
```

产物：

- `packages/games/ironwright-arena/thumbnail.jpg`（640×360 JPEG）
- `.scratch/guizang3/ironwright-arena/title-1280x720.png`
- `.scratch/guizang3/ironwright-arena/gameplay-640x360.png`
- `.scratch/guizang3/ironwright-arena/gameplay-1280x720.png`
- `.scratch/guizang3/ironwright-arena/report.json`
- `.scratch/guizang3/ironwright-arena/boss1.png` / `boss2.png` / `boss3.png`
- `.scratch/guizang3/ironwright-arena/forge-1280x720.png`

## 9. 已知问题

- 锻炉在窄屏（<720px）为可滚动面板，需要上下滑动；桌面为主要验收尺寸。
- 自动瞄准默认开启：手动瞄准（鼠标 / 右摇杆）后 1.2 秒无输入即被接管；想纯手动可在 HUD「瞄·手动」或按 G 关闭。自动开火独立开关（F），桌面默认关、触屏默认开。
- 默认配装对脚本机器人可通关，真人第一次游玩可能因不熟悉预警而失败，属预期难度。
- 音效与音乐仅做程序化合成，未做真人听感调校。
