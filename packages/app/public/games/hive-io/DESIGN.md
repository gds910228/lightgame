# Hive IO（蜂巢大作战）— 设计文档

> guizang-game-skill 方法论第三批 #7，3D 蛇形 IO 竞技（Arcade/IO）。主线程自建（波次 B）。
> three.js r170 本地 vendor + 复用已验证两通道 bloom；全部体节/蜜珠走 InstancedMesh（容量 1600/640）；
> 代码全部原创，无外网依赖。

## 0. 决策

| 决策点 | 选择 | 依据 |
|---|---|---|
| 类型 | 3D snake-io（花田吞噬） | 站内两条 snake 都是经典网格制，io 竞技型为空白 |
| 渲染 | 体节单 InstancedMesh + 实例色，头部独立 mesh | 13 蛇 × 平均 30 节 ≈ 400 draw → 1 draw call |
| 坐标系 | 头部自由平面移动 + 路径历史采样体节（间距 0.62m） | slither 式平滑蛇形 |
| 相机 | 跟随头后方（dist 15 / h 13.5），shake 支持掩护竞技读屏 | io 类标准视野 |
| 边界 | R=120 荆棘围墙（越界即死，围墙不受出生保护豁免） | 地图圆形可视边界 |

## 1. 玩法与数值

- **体长成长**：吃蜜珠 +1 节（tier1 遗骸珠 +3 节 +5 分）；加速冲刺 2.2 节/秒 + 身后掉落普通珠。
- **速度**：基础 9.5 m/s，冲刺 17.5（转向速率冲刺时 ×0.82）。
- **转向**：目标角 + 角速度限制 3.4 rad/s（防原地甩头）。
- **头撞裁决**：双方头距 <1.1m → 小者亡（<92% 体长）；接近则同归于尽；头入体节（跳过前 6 节）→ 冲入者亡。
- **出生保护**：3s 闪烁（保护期内不会被杀，但可以杀人；围墙不受保护豁免）。
- **花丛**：12 片花田（30% 蜜珠生成在花田内），花田内毒刺 2-3 个：扎刺 -3 节 + 减速演出（CD 1.2s）。
- **AI 12 蜂**：贪食（就近索珠）/ 猎手（截杀比自己小的蜂头，预判 4m 前置量）/ 游荡（随机航点+回避大体蜂）；全部先做边界回避（R-14 内目标角朝心）。
- **阵亡转化**：遗体每 2 节掉 1 颗高价值遗骸珠。
- **加冕**：体长 ≥100 →「蜂王加冕」complete 帧（可继续无尽）。
- **best**：`hio.bestLen` / `hio.bestKills`。

## 2. 文件结构

```
js/world.js    花田圆竞技场/荆棘围墙/12 花丛+毒刺/蜂巢装饰/bloom+自适应画质/跟随相机
js/swarm.js    蛇池(spawn/remove/updateSnake/renderInstances)+路径采样体节+InstancedMesh 实例色
js/audio.js    SFX(eat/boost/kill/sting/death/crown/rankUp/ui)+草地循环配乐
js/ui.js       HUD/排行榜(前5+我)/横幅/toast/标题/结算
js/game.js     蜜珠池+导演(花田加权)/AI 三性格/头撞裁决/毒刺/加冕/G 钩子/?autotest=1/上报
```

## 3. G 调试钩子

`G.step/upd/press/setNoAuto/setReportTarget/setAim/setBoost/setLen/clearProt/spawnBot/spawnOrb/state/fx/pool/player()/world/audio/forceGameOver/startGame`。
URL：`?autotest=1`（静音、audio 无 ctx、测完回标题、写 window.__TEST）。

## 4. 验证清单（?autotest=1 — 2026-11-17 实测 30/30）

- [x] T1 启动零报错 / T2 13 蜂在场 / T3 体长 3 + 出生保护
- [x] T4 朝目标角前进 / T5 转向受角速度限制
- [x] T6 吃珠体长 +1 / T7 吃珠得分
- [x] T8 加速耗体长(≥2) / T9 加速显著提速
- [x] T11 体型压制击杀小蜂 / T12 遗骸化蜜珠
- [x] T13 头入体判负 / T14 以小撞大判负 / T15 冲出围墙判负
- [x] T16 毒刺扣体长 / T17 保护 3s 结束
- [x] T18 AI 自主移动 / T19 边界 AI 目标角朝内
- [x] T20 排行榜 5 行 / T21 体长 100 加冕 complete
- [x] T22 bestLen/bestKills 写 localStorage（隔离污染）
- [x] T23-T25 上报帧序 ready/complete/gameOver
- [x] T26 全场 400 帧无 NaN 无泄漏
- [x] T27-T28 AudioContext/自测静音
- [x] T29 UI 元素 / T30 45s 快进无 NaN 无新报错 / T31 回标题

**实测结果**：2026-11-17 Playwright 实载 **30/30 ×2 连续全过**、零报错、零外网请求；实机鼠标引导+左键加速验证（吃 2 珠体长+1、AI 互杀）、有头 FPS≈57（headless 18fps 为 SwiftShader 软渲染环境噪声，已加自适应降档）。开发中修掉的坑：① HEAD_R 未导出；② G.setLen 用 path.length= 扩出 undefined 槽位致渲染崩溃；③ 出生保护错误地豁免了围墙与击杀判定（保护只应防被杀）；④ killSnake 只加蛇对象 kills、模块级 kills 永远为 0；⑤ 测试里吃散珠留下小数 growth 抵消加速消耗导致 T8 偶发（测试改为确定性扣减前提）；⑥ 对撞测试几何须先完成转向再布机器人于行进正前方。