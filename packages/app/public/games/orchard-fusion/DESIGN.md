# Orchard Fusion（果园大合成）— 设计文档

> guizang-game-skill 方法论第三批 #1。类型：2D 物理合成（Suika-like）。本批**标杆款**（2D 模板），
> 代码全部原创（自写圆形物理解算器 + canvas 程序化贴图 + WebAudio 全合成音频）。素材降级路线，无外网依赖。

## 0. 决策

| 决策点 | 选择 | 依据 |
|---|---|---|
| 类型 | 物理合成（Puzzle/Physics） | 站内无同类；超休闲大盘验证过的强粘性玩法 |
| 物理 | 自写圆-圆分离 + 单次冲量 + 3 迭代 | 圆形场景足够；避免引入 matter-js 依赖 |
| 画幅 | 竖屏逻辑 540×840，等比缩放居中 | 手机竖持首选；桌面 letterbox |
| 音频 | WebAudio 全合成（SFX+双态 BGM） | skill 降级路线 |
| 上报 | ready/progress(3s 节流)/event(西瓜)/gameOver | 站点协议 |

## 1. 玩法与数值

- **11 级进化链**：樱桃(14px)→草莓(20)→葡萄(27)→橘子(34)→柿子(42)→苹果(51)→梨(61)→桃子(72)→菠萝(84)→甜瓜(97)→西瓜(111)。
- **分数** = 三角数表 [1,3,6,10,15,21,28,36,45,55,66] × 连锁倍率（×1..×5 封顶）。
- **投放池**：前 5 级，权重 30/26/20/14/10；冷却 450ms；X/点按预览框交换（每投一次限一次）。
- **物理**：重力 2000、恢复系数 0.12、切向摩擦 0.72、质量=r²、速度钳制 3200。
- **判负**：静止（|vx|+|vy|<40）水果顶缘越过 y=205 线持续 2s（运动中水果豁免=抛接宽限）。
- **西瓜庆典**：烟花 + 全屏闪光 + 清除全部 ≤草莓级水果按 ×2 分转化。
- **手感**：合成 ≥桃子 hit-stop 70ms；≥梨 屏震；连击 ≥3 横幅+音效；BGM 靠近警戒线自动切 danger 态。

## 2. 文件结构

```
js/fruits.js   11 级定义 + 精灵预渲染（径向渐变+高光+表情+叶柄）+ 抽取权重
js/physics.js  圆形物理解算器（积分/分离/冲量/墙约束）+ 同 tier 深度优先配对
js/audio.js    SFX(drop/merge/comboUp/bigMerge/firework/lose/warn/ui/swap) + calm/danger BGM
js/ui.js       DOM 层（分数/预览画布/横幅/toast/标题/结算/静音/暂停）
js/game.js     主循环(固定步长+accumulator)、合成链、判负、协议、G 钩子、?autotest=1
```

## 3. G 调试钩子

`G.step(n,dt)` / `G.upd(n,dt)` / `G.press(...codes)` / `G.dropAt(x,force)` / `G.spawnTier(t,x,y)` /
`G.setNoAuto(v)` / `G.setReportTarget(fn)` / `G.setScore(v)` / `G.setNextTier(t)` / `G.state()` / `G.fx()` /
`G.bodies` / `G.audio` / `G.forceGameOver()`。URL：`?autotest=1`（静音、测完回标题、写 `window.__TEST`）。

## 4. 验证清单（?autotest=1 — 2026-11-17 实测）

- [ ] T1 启动零报错
- [ ] T2 掉落增加水果 / T3 下落无 NaN / T4 停在罐内
- [ ] T5 同 tier 碰撞合成 / T6 得等级分
- [ ] T7 同帧双连锁 ×1/×2 计分 / T8 combo 计数
- [ ] T9 冷却拒投 / T10 重开复位
- [ ] T11 交换生效 / T12 周期内二次交换被拒
- [ ] T13 甜瓜合成西瓜 / T14 庆典清小果 / T15 庆典加分
- [ ] T16-T18 60 果 600 帧无 NaN/出界/爆炸
- [ ] T19 暂停冻结 / T20 恢复运行
- [ ] T21 堆过线 2s 判负 / T22 gameOver 上报
- [ ] T23 运动水果越线宽限
- [ ] T24 best 写 localStorage（隔离前后污染）
- [ ] T25-T27 上报帧序 ready/progress·event/gameOver
- [ ] T28 UI 元素绑定
- [ ] T29-T31 AudioContext/配乐状态/自测静音
- [ ] T32-T33 整局快进 240 投 + 溢出判负
- [ ] T34 回到标题画面

**实测结果**：2026-11-17 Playwright 实载（源码目录静态服务）**34/34 断言全过 ×2 连续运行**，控制台零报错（AudioContext 无手势警告属环境豁免），零外网请求；实机鼠标投放 3 果入罐验证、FPS≈61、标题/游戏中/实机三张截图存档 .scratch/guizang3/orchard-fusion/。开发中修掉的坑：① 合成到顶（西瓜）继续配对导致 FRUITS[11] 越界崩溃 → findMerge 加 maxTier 上限；② 测试用例堆叠水果因重力逐帧累积+穿透修正抖动永远不满足"静止" → 物理层加接地重力豁免（被支撑物体不累积 vy）；③ 自测后期局面的 gameOver 在 best 恢复之后又写入 localStorage 污染真实纪录 → 套件末尾二次恢复。

## 5. 站点集成

- metadata.json 符合 schema（id/title/category/description/controls）。
- thumbnail.jpg 640×360 由主线程实机截图（agent 阶段不产出）。
- 上报：ready → progress{score,progress}（≥3s 节流）→ event{tag:'watermelon'} → gameOver{score,progress}。
- best 键：`orf.best`；静音键：`orf.mute`。
