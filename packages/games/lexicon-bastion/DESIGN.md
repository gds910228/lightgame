# 词垒防线 · Lexicon Bastion — 设计与验证

- 系列：灯匠夜游 · 第 7 铺
- 类型：2D Canvas 打字防御 / 无尽波次
- 目录：`packages/games/lexicon-bastion/`
- 测试端口：8622
- 版本：1.0.0（2026-11-20）

## 1. 概念与目标

深夜纸底上，英文单词乘着釉朱色的几何敌人自上方压境。玩家直接敲击键盘，
把单词逐字母拼完，词垒中央的铜炮便发射弹幕。拼写越快，连击越高；连击和
准确率又会加速「充能」，充满时自动释放一次全场齐射。单词漏过底部石墙会削
减词垒 HP，HP 归零本局结束。

记忆点：

- **逐字母锁定**：首字母锁住最靠近石墙的匹配单词，打完最后一个字母立刻开火。
- **充能齐射**：连击/准确率积累充能，满 100 自动触发，不必额外按键。
- **三段长词垒主**：第 10 波垒主需要连续拼完三条长词，破关后进入无尽。

## 2. 操作

| 操作 | 桌面 | 触屏 |
|---|---|---|
| 输入单词 | 直接敲 A–Z | 页内输入框（系统键盘）或展开 26 键虚拟键盘 |
| 手动锁定 | 鼠标点击敌人或词牌 | 点按敌人或词牌 |
| 暂停 | `P` 或右上角暂停按钮 | 底部「暂停」或右上角按钮；暂停面板的「继续」 |
| 静音 | `M` 或右上角按钮 | 底部「静音」 |
| 重开 | `R` 或右上角 ↺ | 底部「重开」 |

因为 P/M/R 本身也是单词字母，快捷键采用**上下文优先**规则：当该字母正是当前
锁定单词的下一个字母（或场上存在以该字母开头的词）时，优先输入；否则才执行
暂停/静音/重开。暂停状态下 P 一定执行恢复。结算/里程碑面板的按钮均可点按。

## 3. 核心循环

```
标题 → 第 1 波（play）→ 清空本波 → 三选一升级（draft）→ 1.5s 后下一波（ready）
                                              ↘ 第 10 波垒主死亡 → complete / milestone
                                                   ├ 继续无尽 → 第 11 波……
                                                   ├ 回结算 → over
                                                   └ 重开
任一波 HP 归零 → over（重试 / 回标题）
```

- 固定步长 1/60，rAF accumulator，dt 上限 0.1s；页面隐藏自动暂停并清空累计。
- 敌人、弹道、粒子全部在主 frame 内更新；粒子上限 280，弹道上限 48，冲击环 26。
- 命中/破盾/击杀有 35–110ms hit-stop、屏幕震动与玉青粒子；泄漏为釉朱色反馈。
- DPR 上限 2；静态背景与墙体离屏预渲染，尺寸切换时重建。

## 4. 数值表

### 4.1 敌人

| 类型 | 中文 | HP（拼词次数） | 到达底部伤害 | 下降速度（H/秒） | 击杀分 | 备注 |
|---|---|---:|---:|---:|---:|---|
| slab | 厚壁 | 3 + floor(w/5) | 12 | 0.028 | 16 | 慢速高血，宽梯形 |
| darter | 疾羽 | 1 | 8 | 0.058 | 12 | 快速菱形 |
| splitter | 裂晶 | 2 + floor(w/5) | 10 | 0.038 | 18 | 死亡分裂为 2 只碎晶 |
| shield | 盾鳞 | 1 + 1 盾 | 14 | 0.033 | 20 | 第一次拼完整词只破盾 |
| shard | 碎晶 | 1 | 4 | 0.052 | 6 | 分裂产物，不再分裂 |
| boss | 垒主 | 段数（2–3） | 40 | 0.030 | 170 | 每段一条长词，无视弹幕加伤 |

- 速度乘数：`1 + min(0.5, (wave-1) × 0.022)`。
- 敌人 y 以逻辑高度比例下降，横竖屏的压迫时间保持一致。
- 护盾破碎后立刻换上一条新词；普通敌人未死时也会换新词，避免重复拼同一条。

### 4.2 波次与 Boss

| 项目 | 规则 |
|---|---|
| 普通波敌人数 | `clamp(4 + floor(1.15 × w), 5, 16)` |
| 出生间隔 | `max(0.42, 1.05 − 0.03 × w)` 秒 |
| 敌人解锁 | 第 1 波厚壁/疾羽；第 2 波裂晶；第 3 波盾鳞 |
| Boss 波 | `w % 8 == 0` 或 `w == 10`；第 8 波 2 段，第 10 波 3 段，之后 3 段并轮换词表 |
| 第 10 波 Boss | `impenetrable · fortification · constellation` |
| 无尽 | 第 10 波击破后 `complete`，可继续；此后每逢 8 的倍数再出垒主 |

### 4.3 单词长度上限

`min(10, 4 + floor((w−1)/2)) − wordLv`，最低 3 字母。

内置词库 263 条（262 个唯一词），按真实长度自动分桶：

| 长度 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 数量 | 48 | 62 | 44 | 38 | 24 | 23 | 11 | 13 |

### 4.4 得分 / 墨能

| 事件 | 得分 | 墨能 |
|---|---|---|
| 拼完单词 | `len × 6 + combo × 3` | `2 + floor(combo/3) + floor(len/3)` |
| 击杀 | 敌人击杀分 | +2（垒主 +35） |
| 清波 | `12 × w` | `8 + 2 × w` |
| 第 10 波 Boss 击杀 | 170 + 120 + 10w | +25 +10 |

连击在每次完整拼完单词时 +1；错键或泄漏清零。准确率 =
`correctChars / (correctChars + misses) × 100%`。WPM =
`(correctChars / 5) / (activeT / 60)`，activeT < 3 秒时显示 0。

### 4.5 充能与齐射

- 每个正确字母：`(2 + min(combo, 20) × 0.15) × (0.6 + accuracy × 0.4)`。
- 达到 100 自动发动「充能齐射」：对全场存活敌人各造成 1 点伤害并破盾；
  垒主损失 1 段；充能清零，伴随震屏、闪白与冲击环。

### 4.6 升级（每波清空后的三选一）

| 升级 | 效果 | 成本 |
|---|---|---|
| 连弩（fire） | 每次拼词的弹幕伤害 +1（1 → 2 → …） | `20 + 12 × 当前等级` 墨能 |
| 简牍（word） | 之后单词长度上限 −1（最低 3） | 同上 |
| 壁垒（guard） | HP 上限 +15，并立即回垒 15 | 同上 |
| 休整（skip） | 回垒 5，不消耗墨能 | 免费 |

墨能不足的卡牌会置灰；不会出现无路可走的软锁。

### 4.7 持久化

| 键 | 含义 |
|---|---|
| `lxb.best` | 最高分 |
| `lxb.wave` | 最高波次 |
| `lxb.combo` | 最高连击 |
| `lxb.acc` | 最佳准确率（≥10 次输入后计入） |
| `lxb.wpm` | 最佳 WPM |
| `lxb.mute` | 静音状态 |

autotest 开始时快照全部键，结束时逐键还原。

## 5. 站点协议

- `ready`（载入）→ `progress`（每次清波，含 `score/progress/wave`）→
  `gameOver`（HP 归零）或 `complete`（第 10 波里程碑）。
- `event`：`boss_wave`、`boss_slain`。
- 所有分数取整。
- 对 parent 使用兼容信封：`{source:'lightgame', type:'lightgame:report', payload}`；
  `progress → {kind:'progress',data}`，`event → {kind:'event',event,data}`，
  `gameOver → {kind:'gameOver',score,progress:{value},data}`，
  `complete → {kind:'complete',score}`；`ready` 另发 `lightgame:ready`。
- 本地 `static/play68.js` + `play68bar.js` 提供 `goHome / clickMore / dp_share /
  play68_submitScore`，分享委托 `parent.handleGlobalShare(score)`。

## 6. 文件

```
packages/games/lexicon-bastion/
  index.html            中文 UI、HUD、标题/草稿/里程碑/结算、错误与网络陷阱
  js/game.js            状态机、输入、波次、经济、渲染、G 钩子、42 条 autotest
  js/words.js           词库、Boss 词表、seeded RNG
  js/audio.js           全合成 SFX + 六状态 BGM（无素材）
  static/play68.js      站点兼容层
  static/play68bar.js   分享/回首页桥
  metadata.json
  thumbnail.jpg         640×360 实机游玩截图（2× 渲染后 Lanczos 缩放）
  DESIGN.md
.scratch/guizang3/lexicon-bastion/
  test.mjs              双轮 autotest + 无参数加载 + 真实键鼠 + 触屏冒烟
  audit.json            最近一次完整审计结果
  title-1280.png        1280×720 标题截图
  play-640x360.png      640×360 游玩截图（Lanczos 缩放）
  play-640.png/jpg      2× 渲染游玩截图与 640×360 JPEG 版本
  draft.png / milestone.png / mobile-*.png
  organic-18s.png       真实推进 18 秒的截图
  autotest-round1/2.png
```

## 7. G 钩子

`window.G = window.__G` 暴露：

- 强制：`err`, `step(n,dt)`, `upd(n,dt)`, `press(...codes)`, `setNoAuto`,
  `setReportTarget`, `state()`（只读快照）。
- 玩法：`typeLetter`, `typeText`, `spawn`, `setWord`, `setEnemyY/Hp/Shield`,
  `startWave`, `flushQueue`, `togglePause`, `wipeEnemies`, `clearWaveNow`,
  `autoResolve`, `forceGameOver/forceFail/forceMilestone/forceWin`,
  `buyUpgrade`, `skipDraft`, `fresh`, `startGame`, `restartGame`, `toTitle`,
  `continueEndless`, `settleFromMilestone`, `setStats`, `setHp/Ink/Score/Wave/Charge`,
  `setSeed`, `wordReward`, `chargeGain`, `waveSpec`, `enemyDefs`, `records`,
  `screenPos`, `storageSnapshot/restoreStorage`, `reports/clearReports`, `audio`,
  `demoScene`。
- 铁律：G 内改状态一律走 setter；粒子/弹道在主 update 中推进；autotest 首行
  `setNoAuto(true)`；`state()` 每帧新建只读对象。

## 8. 验证清单

### 8.1 实测通过（本轮环境）

- [x] `?autotest=1` **连续两轮**：42/42 断言通过，`fail=0`、`crash=null`。
- [x] 两轮 console `error=0`、`warning=0`、`pageerror=0`。
- [x] 两轮 Playwright request 列表外网请求 **0**；页面内 `__NET` 审计
      `fetch+xhr+ws=0`，`external=[]`。
- [x] 直接打开无参数页：`__BOOTERR.length=0`、`G` 存在、模式 `title`。
- [x] 真实键盘：`page.keyboard.type(<当前敌人单词>)` 逐键输入 → `kills=1`、
      `wordsDone=1`、得分 30–36、准确率 100%。
- [x] 真实指针：鼠标点击画布上的敌人 → `lockId` 变为该敌人 id，随后键盘输入
      完整单词并击杀。
- [x] 真实按键 `P` 暂停/恢复；`M` 静音；`R` 重开复位（wave=1、score=0、HP=100）。
- [x] 真实点击暂停按钮进入暂停，暂停面板「继续」恢复。
- [x] 触屏（Playwright 430×820, `hasTouch`）：展开虚拟键盘并点按字母 → typed 1；
      输入框接收系统键盘字符 → typed 2；暂停/静音/重开按钮全部生效。
- [x] 无脚本辅助的自由推进 18 秒：第 1 波、第 2 波清空并各出现一次升级草稿，
      自动选择升级，进入第 3 波；0 泄漏、无 NaN、无 console 错误。
- [x] 12 波快进（autotest T27）：第 10 波里程碑触发、继续无尽、无 NaN、无新报错。
- [x] localStorage 六个键写入后逐键还原一致（T26/T28）。
- [x] 截图产出：标题 1280×720、游玩 640×360、草稿、里程碑、移动端。
- [x] 封面 `thumbnail.jpg` 为 640×360 JPEG 实机游玩画面（非标题/选关）。

### 8.2 仅确认不报错 / 需声明

- [x] 音频**未在 autotest 中创建 AudioContext**，以保持静音和零控制台警告；
      BGM 状态切换与静音状态已断言。真实手势后的合成音色未做听感验证。
- [x] 第 10 波完整通关、`complete` 帧与无尽入口由 autotest/`forceMilestone`
      覆盖，并已截图；完整人工从第 1 波打到第 10 波的体感未实测。
- [x] 移动端使用 Playwright 的 `hasTouch` 模拟，真实 iOS/Android 系统键盘弹起
      行为需人工试玩确认。
- [x] 60fps 性能仅在 headless Chromium 中观察无明显异常；低端真机未实测。

### 8.3 需人工试玩

- 打字手感、锁定目标优先级（首字母锁最靠近石墙者）是否符合直觉。
- 难度曲线：第 5 波后单词长度与敌人数增长是否过陡/过缓；无尽 20 波后的平衡。
- P/M/R 上下文快捷键在紧张输入时是否顺手。
- 音效/BGM 的听感、音量平衡与循环疲劳。
- 真实触屏下输入框与虚拟键盘的布局舒适度。

## 9. 断言清单（42 条）

| 组 | 断言 |
|---|---|
| 启动/NaN | T1 启动零报错；T2 首波 150 帧无 NaN |
| 核心数学 | T3 逐字→完成→击杀；T4 错键断连击降准确；T5a/b 盾吸收与二次击杀；T6 裂晶分裂 2 只；T7 连击奖励公式；T21 双段垒主；T22 四类敌人；T23 波次/Boss 编排 |
| 经济 | T8 拼词加分加墨能；T9 升级扣墨能且伤害 +1；T10 墨能不足拒绝；T11 词长上限下降；T12 壁垒上限/回复 |
| 统计 | T13 准确率 80% 与 WPM=8 公式 |
| 失败/胜利 | T14 漏敌扣血；T15a/b HP 归零→over+gameOver 帧；T16a–d 三段 Boss→complete→无尽 |
| 协议/存储 | T25a–c ready→progress→gameOver/complete 与整数分；T26 记录写读；T28 逐键还原 |
| 交互 | T17 press A/R/C 输入生效；T18 暂停冻结 y/activeT；T19 虚拟键+输入框+暂停按钮；T24 R 重开复位 |
| 成长/充能 | T20 充能满自动齐射并伤害全场 |
| 整局 | T27a–c 12 波快进、里程碑、无 NaN、无新错误 |
| 环境 | T29 零外网；T30 中文系列标记/26 键/按钮；T31 音频状态与静音；T32 回标题静音；T33 全部上报分为整数 |

## 10. 已知取舍

1. `P/M/R` 与打字字母冲突，采用「能作为下一个待输入字母时优先输入」的上下文规则；
   暂停面板、按钮仍可随时操作。
2. 首字母会锁定**最靠近石墙**的匹配单词；若想改锁另一条，点击/点按敌人即可。
3. 错键不删除已输入进度，只断连击、扣准确率；无退格键。
4. 拼完但未击杀的敌人会换一条新词，因此同屏可能同时出现多条相似词。
5. autotest 的 12 波快进调用 `flushQueue/autoResolve` 调试接口；真实波次循环另以
   18 秒无人值守推进验证到第 3 波。
6. 封面由 640×360 视口、DPR=2 的实机画面经 Lanczos 缩放到 640×360 JPEG。

## 11. 复跑

```bash
cd /mnt/tos/workspace/packages/games && python3 -m http.server 8622
node /mnt/tos/workspace/.scratch/guizang3/lexicon-bastion/test.mjs
```

`test.mjs` 会写 `.scratch/guizang3/lexicon-bastion/audit.json` 并输出完整审计。
