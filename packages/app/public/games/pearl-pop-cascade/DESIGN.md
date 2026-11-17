# Pearl Pop Cascade（珠光瀑语）— 设计文档

> guizang-game-skill 方法论第三批 #9，3D 幻珠弹瀑（Arcade/Pachinko，Peggle-like）。主线程自建（波次 B）。
> 板面逻辑坐标 2D 圆物理（重力 -26 / 恢复 0.8 / 速度钳制 42 / 三子步）渲染进 three.js 梦境板；
> bloom 复用已验证管线 + 自适应降档；WebAudio 全合成音效（击珠音阶上行 chime）与 pad 配乐。

## 0. 决策

| 决策点 | 选择 | 依据 |
|---|---|---|
| 类型 | Peggle-like 弹珠消珠 | 站内无同类；单手可玩+强反馈，超休闲大盘玩法 |
| 物理 | 自写 2D 圆物理（子步×3）+ 反卡死扰动 | 圆-圆/墙碰撞简单可靠；楔形缝防卡死（1.2s 低速→侧推→再卡强制释放） |
| 视角 | 正面板透视相机（z=41）+ 轻微震屏 | 全板可见，发射器入画 |
| 计分 | 一击倍率阶梯 ×1→×1.5→×2…×10 封顶 | Peggle 风格"慢热连击" dopamine |
| 轮次 | 无尽轮：清台 +5000，珍珠 75+5/轮 至 110 | 持续难度爬坡 |

## 1. 玩法与数值

- **珍珠**：蓝(100×倍率)/紫(本击全部 ×5，3% 概率)/绿(+1 免费钢珠，1.5% 概率，保底各≥1)。
- **FEVER**：剩 ≤10 颗时触发（落珠瞬间判定）：+3 连免费钢珠 + 横幅。
- **金壶**：2 只游走（速度 6+0.8/轮），接住 +1000 +1 免费珠。
- **钢珠**：开局 8，撞墙 +10 分（鼓励贴墙打法）。
- **best**：`ppc.bestScore` / `ppc.bestRound`。

## 2. 文件结构

```
js/world.js   梦境板(渐变背板+星点+侧墙)/发射器/相机/bloom+自适应
js/audio.js   SFX(pegLadder/purple/launch/fever/clear/bucket/lose/ui)+梦境 pad 配乐
js/ui.js      HUD(分数/轮次/本击倍率/钢珠/珍珠)/横幅/toast/标题/结算
js/game.js    珍珠布局(行+抖动+保底特殊)/钢珠物理/金壶/FEVER/清台/G 钩子/?autotest=1/上报
```

## 3. G 调试钩子

`G.step/upd/press/setNoAuto/setReportTarget/setAim/setBalls/setFreeBalls/killPegs(n)/pushPegsAside/bucketAt(i,x)/pegsLeft/state/fx/pegs/buckets/ball()/audio/world/forceGameOver/launch/startGame`。
URL：`?autotest=1`（静音、audio 无 ctx、测完回标题、写 window.__TEST）。

## 4. 验证清单（?autotest=1 — 2026-11-17 实测 27/27）

- [x] T1 启动零报错 / T2 开局 75 珍珠 8 钢珠 / T3 布局在板内
- [x] T4 发射在场 / T5 下落无 NaN / T6 击中并移除 / T7 击珠得分 / T8 落出回收
- [x] T9 一击倍率阶梯(100+150) / T10 第三颗 ×2 / T11 紫 ×5 / T12 绿 +1 珠
- [x] T13 削到剩 10 / T14 FEVER 触发 +3 免费珠
- [x] T15 清台进第 2 轮且珍珠 +5 / T16 金壶接珠 +1000+1 珠
- [x] T17 钢珠耗尽判负 / T18 瞄准角钳制 / T19 best 读写（隔离污染）
- [x] T20-T22 上报帧序 ready/progress/gameOver / T23 重开复位
- [x] T24 金壶游走 / T25 AudioContext+静音 / T26 30 发快进无 NaN / T27 回标题

**实测结果**：2026-11-17 Playwright 实载 **27/27 ×2 连续全过**、零报错、零外网请求；实机一击 460 分（阶梯 100+150+200+撞墙 10）验证、有头 FPS≈57。开发中修掉的坑：① stepBall 内 killBall 后 update 仍读空 ball → 崩溃；② 倍率阶梯首击应为 ×1（shotHits-1 基数）；③ 球卡在墙+珍珠楔形缝永不落出 → 低速计时侧推/强制释放；④ T16 直落线被随机珍珠偏转 → pushPegsAside 测试钩子；⑤ fb0 重名声明；⑥ 相机 z=34 裁掉发射器 → 41。