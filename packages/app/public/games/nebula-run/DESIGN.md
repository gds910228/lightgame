# Nebula Run（星窟狂奔）— 设计文档

> guizang-game-skill 方法论第三批 #2，3D 无尽跑酷（Action/Runner）。本批**标杆款（3D 模板）**。
> 复用 sword-shrine-guardian/starfall-bulwark 已验证的两通道 bloom 管线与 skill input 核心；
> three.js r170 本地 vendor，代码全部原创，无外网依赖。

## 0. 决策

| 决策点 | 选择 | 依据 |
|---|---|---|
| 类型 | 3 车道 3D 无尽跑酷 | 站内无同类；动作系大盘玩法，3D 表现力强 |
| 坐标系 | 玩家固定 z=0，世界向 +z 移动 | 避免 float 漂移，回收逻辑简单 |
| 视角 | 跟随追尾相机（y4.2 z9.5 看向 -14） | skill：斜俯/追尾省工作量且画面精致 |
| 泛光 | 两通道 bright+separable blur（复用） | 已验证管线；弱机自适应降 1 迭代 |
| 跳跃 | 可变高度（按住升程重力 ×0.45） | skill combat-feel：给玩家高度控制权 |

## 1. 玩法与数值

- **速度**：24 → 56 m/s（+0.35/s²），noAuto 时冻结（供测试）。
- **计分**：距离 1 分/m × 倍率（小数累积取整防逐帧 round 虚高）；星币 +10×倍率；惊险 +50×倍率。
- **倍率门**：三环并排 蓝×2 / 金×3 / 紫×5，穿环换倍率。
- **障碍**：陨石（跳/切道，30% 双宽）、能量横梁（铲滑，梁下沿 1.15m > 铲滑高 0.9m）、封堵墙（必须切道，自带红色预警光条）。
- **惊险系统**：横向缝隙 0.62m 内擦过（或擦顶）→ +50×倍率 + 慢动作 90ms（timeScale 0.35）。
- **护盾**：抵挡一次撞击，无敌 2s（闪烁），每 1200m 补给。
- **里程碑**：每 500m 横幅 + progress 上报 + 100m 隧道段（拱廊 + 雾色/配乐变奏 tunnel 态）。
- **best**：`nbr.best`；静音 `nbr.mute`。

## 2. 文件结构

```
js/world.js     场景/灯/雾/星空/车道地砖(9 块循环)/霓虹柱(22 根循环)/隧道拱(8)/尘埃粒子/bloom/自适应画质
js/player.js    车道 lerp(12/s)+可变跳(13 初速/-30g)+铲滑 0.62s+护盾球+无敌闪烁+拖尾
js/obstacles.js 池化 rock/beam/wall/coin/gate + coinLine/coinArc/coinZig 图案 + 循环回收
js/audio.js     SFX(jump/slide/coin/nearmiss/gate/hit/milestone/lose/ui) + cruise/tunnel 双态配乐
js/ui.js        DOM HUD(分数/距离/倍率/护盾/横幅/toast/标题/结算) + 触控四区
js/game.js      导演(16-30m 间距加权模式)/碰撞(穿框检测+惊险)/经济/里程碑/G 钩子/?autotest=1/上报
```

## 3. G 调试钩子

`G.step/upd/press/hold/release`、`G.setNoAuto`（冻结速度爬升+导演自动生成）、`G.setSpeed/setDist/setScore`、
`G.spawnRock/spawnBeam/spawnWall/spawnCoin/spawnGate`（绝对 z 直接布置）、`G.state/fx`、`G.player/obs/audio/world`、
`G.forceGameOver/startGame`、`G.setReportTarget`。URL：`?autotest=1`。

## 4. 验证清单（?autotest=1 — 2026-11-17 实测）

- [x] T1 启动零报错 / T2 进入 play / T3 基础速度 24
- [x] T4 左切道 lerp 到位 / T5 右两次切到右道
- [x] T6 跳跃起落 / T7 长按跳更高（apexHold > apexTap+0.3）
- [x] T8 铲滑生效并按时结束
- [x] T9 noAuto 速度恒定 / T10 导演不自动生成
- [x] T11 手动生成岩石 / T12 越过玩家回收
- [x] T13 吃币计分 / T14 穿环 ×2 / T15 ×2 距离分速率 45-52
- [x] T16 时机跳跃过岩石 / T17 时机铲滑过横梁
- [x] T18 撞墙耗盾进无敌 / T19 无敌期二次接触不扣血 / T20 无敌结束撞击判负
- [x] T21 贴脸擦过计数 / T22 惊险 +50 / T23-T24 慢动作受控恢复
- [x] T25 500m 隧道 / T26 progress 上报 / T27 隧道退出
- [x] T28 1200m 护盾补给
- [x] T29 108 实体 900 帧无 NaN 无泄漏
- [x] T30 best 写 localStorage / T31-T33 上报帧序 / T34 重开复位
- [x] T35-T37 AudioContext/tunnel 态/静音 / T38 UI+触控 DOM
- [x] T39 60s 快进无 NaN 无新报错 / T40 回标题

**实测结果**：2026-11-17 Playwright 实载 **40/40 ×2 连续全过**、零报错、零外网请求；实机键盘连招（切道/跳/铲滑）验证、有头模式 FPS≈57、headless 18fps 为 SwiftShader 软渲染环境噪声（已加自适应降档保弱机）。开发中修掉的坑：① 逐帧 Math.round 距离分虚高（60 vs 48）→ 小数累积取整；② 测试同帧重复 press 被 Set 去重 → 间隔 upd(1)；③ setDist 测试距离不够 1200m。