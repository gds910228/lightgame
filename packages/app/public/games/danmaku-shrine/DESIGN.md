# Danmaku Shrine（弹幕魔境）— 设计文档

> guizang-game-skill 方法论第三批 #10，纵版弹幕 Boss rush（Action/Shmup）。主线程自建（波次 B）。
> 2D canvas（540×720 逻辑竖幅），弹幕池上限 900 预渲染精灵；4 Boss × 2 相 × 2 符卡轮转；
> WebAudio 全合成（Boss 战双态配乐 fight/boss）。

## 0. 决策

| 决策点 | 选择 | 依据 |
|---|---|---|
| 类型 | 弹幕 Boss rush（非通关弹幕） | 站内无同类；四魔连战节奏紧凑，观赏性极强 |
| 判定 | 判定点 2.5px + 擦弹半径 13px | 东方系标准；低速模式可视化判定点 |
| 双胜利路径 | 撑过相计时=收取(+5000×魔序) 或 击破(+10000×魔序×相) | 回避型与火力型玩家各有最优解 |
| 符卡 | 每相 2 张轮转(15s/张)，相计时 30s | 快节奏 Boss rush，4-6 分钟一局 |
| 继续 | 续战罚 30% 分，从当前 Boss 重开 | 街机传统 |

## 1. 玩法与数值

- **自机**：速度 265 / 低速 118(Shift)，自动射击(低速 3 收 1 束,伤害 15 vs 分散 11×3)；残机 3。
- **灵击(炸弹)**：清屏每弹 +5 分 + 2.5s 无敌；开局 3，擦弹槽 100 满 → +1（extend）。
- **擦弹**：13px 内未中弹 → +10 分/枚 + 槽 +1。
- **Boss**：血条+符卡名；入场 1.6s；击破相 → 全清弹幕 → 下一相/下一魔；4 魔全破 → complete。
- **弹幕 16 符卡**：绯扇/赤环/焰螺旋/红雹/十字岚/跳弹碎屑/苍雨/疾风连弩/蝶舞回廊/诱引花瓣(追踪)/夜之帘/双蝶螺旋/黄金涡/魔界壁/终焉螺旋/无名狂想。
- **best**：`dks.bestScore` / `dks.bestBoss`；静音 `dks.mute`。

## 2. 文件结构

```
js/bosses.js  Boss 数据(名字/色板/相 hp/时长/符卡表)
js/audio.js   SFX(graze/bomb/death/capture/bosskill/extend/ui)+fight/boss 双态配乐
js/ui.js      HUD(残机/灵击/擦弹槽)/Boss 血条+符卡名/横幅/toast/标题/结算/触控区
js/game.js    弹幕池+16 符卡实现+擦弹/灵击/相导演/ Boss 漂移/G 钩子/?autotest=1/上报
```

## 3. G 调试钩子

`G.step/upd/press/hold/release/setNoAuto/setGod/setReportTarget/skipToBoss(n)/setPhaseHp/setPhaseT/setSpellT/setGrazeMeter/spawnBulletAt/clearBullets/state/fx/player/bullets/shots/bossRef/audio/forceGameOver/startGame`。
URL：`?autotest=1`（静音、audio 无 ctx、测完回标题、写 window.__TEST）。

## 4. 验证清单（?autotest=1 — 2026-11-17 实测 29/29）

- [x] T1 启动零报错 / T2 3 残机 3 灵击 / T3 Boss1 出场 / T4 Boss 入场完成
- [x] T5 移动位移 / T6 低速模式减速
- [x] T7 弹中判定点→残机-1 / T8 重生无敌
- [x] T9 擦弹计数 / T10 擦弹加分 / T11 槽满送灵击
- [x] T12 灵击清屏+无敌 / T13-T14 收取进 2 相+清屏加分
- [x] T15 两相击破 → Boss2 / T16 末魔击破 → complete
- [x] T17 弹池上限 900 无 NaN / T18 符卡计时轮转
- [x] T19 best 读写（隔离）/ T20 续战罚 30%
- [x] T21-T23 上报帧序 ready/progress/gameOver / T24 暂停冻结
- [x] T25-T26 AudioContext/Boss 配乐态 / T27 UI+触控元素
- [x] T28 无敌 120s 快进无 NaN 无新报错 / T29 回标题

**实测结果**：2026-11-17 Playwright 实载 **29/29 ×2 连续全过**、零报错、零外网请求；实机走位/低速/灵击验证（自动射击命中 Boss、真实死亡重生正确）、有头 FPS≈57。开发中修掉的坑：① 击中玩家→clearBullets 清空数组后外层循环仍按旧索引访问 → undefined 崩溃（命中后 return）；② 测试先 startGame 后 setNoAuto 导致 Boss intro 计时未被跳过；③ Boss 入场动画期间计时器不运行（测试须等入场）；④ **held 按键状态跨用例泄漏**（前一测试的 ArrowRight 让自机一路飘到右墙、子弹永远打不到 Boss）→ startGame 清空 held；⑤ 相击破≠Boss 击破（bossIdx 只在两相全破后进位）→ T15 改为连破两相；⑥ 自机弹扇形散布 ±60px 横漂 + Boss 横漂错峰 → 命中半径 42→52。