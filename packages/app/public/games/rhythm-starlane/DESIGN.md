# Rhythm Starlane（节奏星轨）— 设计文档

> guizang-game-skill 方法论第三批 #3。类型：4 键下落式音乐节奏（Music/Rhythm）。
> 2D canvas + WebAudio 按谱实时合成（3 首原创曲），谱面由曲谱「拍型序列」数据驱动生成。
> 代码结构对齐标杆 orchard-fusion（固定步长主循环 / G 钩子 / ?autotest=1 / 上报桥 / 无素材无外网）。

## 0. 决策

| 决策点 | 选择 | 依据 |
|---|---|---|
| 玩法 | 4 键下落式（D F J K / 触屏 4 分区） | 站内无下落式节奏游戏；经典 4K 模式上手即懂 |
| 谱面来源 | 曲谱数据驱动：每首歌定义「拍型序列 seq」（每小节选一种十六分步拍型），note 时间 = LEADIN + (小节×4拍 + 步/4) × 60/BPM | 绝非随机；谱面与音乐同源，打的就是旋律落点 |
| 音频 | WebAudio 按谱实时合成：lead 旋律（与谱面同拍）+ pad 和弦 + 鼓组 + bass，前瞻调度 0.18s | skill 降级路线；旋律与谱面一一对应保证"音画同步" |
| 歌曲时钟 | songTime 由游戏固定步长 update 推进（非 ctx.currentTime），音频按 anchor 映射 | 暂停即冻结音乐+note；autotest 无 ctx 也能整曲快进 |
| 难度 | E/N/H = 十六分过滤(4/2/1) + 双押率(.06/.16/.30) + 下落秒数(2.3/1.8/1.35) | 密度/双押/流速三轴差异，同一首歌三档体验 |
| 画幅 | 竖屏逻辑 540×840，等比缩放居中，DPR≤2 | 手机竖持首选；四轨各 96px 居中 |
| 上报 | ready / progress(每 10% 里程碑) / event(fever) / complete / gameOver(中断) | 站点协议 |
| hit-stop | 节奏游戏不做 hit-stop（冻结时间轴会破坏音画同步），以"判定线节拍脉动 + Fever 屏闪 + combo 弹跳"替代手感三件套中的该项；screen shake（MISS/Fever）与粒子（命中爆点）保留 | 类型特化偏离，如实注明 |

## 1. 玩法与数值表

| 项目 | 数值 |
|---|---|
| 判定窗 | PERFECT ±40ms（金光爆点 14 粒子）/ GOOD ±90ms（蓝光 8 粒子）/ 其余 MISS（红闪+屏震+combo 断裂） |
| 过线未击 | songTime > note.t + 90ms → 自动 MISS；过早 >90ms 按压忽略不惩罚 |
| 分数 | PERFECT 100 / GOOD 50 × combo 加成 × Fever |
| combo 加成 | 每 25 连击 +5%（×1.05, 1.10 …），10 档封顶 ×1.5（250 连击） |
| Fever | combo 达 50 触发，8 秒分数 ×2 + 全屏金光 + 星野加速 + 金色 combo；MISS 立即熄灭；此后每再 +50 连击可再触发 |
| MISS | combo 归零、Fever 熄灭、轨道红闪 0.22s 屏震 |
| 准确率 | (P×1 + G×0.5) / 总 note 数 ×100%；评级 S≥95 / A≥85 / B≥70 / C≥55 / D<55 |
| 中断 | Esc / ✕ 按钮随时结束 → 结算（未判定 note 计入总数拉低准确率），上报 gameOver |
| best | localStorage `rsl.best.{曲idx}{难度}` = {s:最高分, a:最高准确率}；静音键 `rsl.mute` |
| 下落 | note 从 y=36 落到判定线 y=690；速度 = 654px / fall 秒 |
| 同轨最小间隔 | 90ms（生成期确定性轮转修正），谱面断言阈值 85ms |
| 暂停 | P / 按钮：songTime 冻结（note 冻结）+ 音乐停（掐掉未完成源）+ 恢复重新锚定 |

### 三首歌设计（曲名/主题/拍型特征）

| # | 曲名 | 主题 | BPM/曲长 | 拍型特征（patterns → seq） |
|---|---|---|---|---|
| 0 | 霓虹脉动 Neon Pulse | 赛博夜城 · 电子疾走 | 128 / 77.5s | A 小调 Am-F-C-G。拍型 P1 四分基本 → P2 切分推进（+反拍 6/14 步）→ P3 八分驱动 → P4 密集收尾（15 步抢拍）→ P5 反拍悬停；40 小节「 intro→verse→build→chorus→break→outro」段落化编排，H 难度八分流为主 |
| 1 | 星尘漫游 Stardust Drift | 深空星云 · 梦境慢舞 | 96 / 72.5s | D 大调 D-A-Bm-G。Q4 慢拍留白（每小节 3 点）→ Q2/Q3 中密 → Q5 切分叹息；28 小节舒缓编排，鼓组 kick 只踩 1/3 拍，E 难度下接近"点头"节奏，适合新手 |
| 2 | 超频引擎 Overdrive Engine | 机械核心 · 高速爆发 | 160 / 68.5s | E 小调 Em-D-C-G。R2 六点推进 → R3 全八分 → R4 十六分爆点（3/11/15 步插拍）→ R5 悬停喘息；44 小节「build→drop×4→half→drop」EDM 结构，kick 三连推进（0/3/8/11 步），H 难度全密连打 |

音乐合成：和弦 pad 每小节 3 音（含微失谐）、bass 每半小节根音、鼓组 kick/snare/hat 16 步型、
lead 旋律 = 和弦琶音循环 + 半小节强位翻高八度（与谱面 note 同拍同源，命中即"弹 melody"）。

## 2. 文件结构

```
js/songs.js   3 首曲数据（拍型序列/和弦/鼓组/轨道序列）+ buildMusic 音乐事件表 + buildChart 确定性谱面生成（mulberry32 种子）
js/play.js    判定窗/连击加成/Fever/准确率/评级 纯逻辑核心（无 DOM/canvas/音频依赖，可独立断言）
js/audio.js   WebAudio 合成：SFX（hit 三档/fever/complete/lose/ui）+ 歌曲前瞻调度器（播放/暂停/恢复/seek）
js/ui.js      DOM 层：HUD/选曲界面(3 曲×3 难度)/结算面板/banner/toast/静音/暂停/结束/触屏 4 分区
js/game.js    主循环(固定步长 accumulator)、下落渲染、粒子/飘字池、判定线、协议、G 钩子、?autotest=1 套件(38 断言)
```

## 3. G 调试钩子

`G.step(n,dt)` / `G.upd(n,dt)` / `G.press(...codes)` / `G.hitNote(lane,offset)`（模拟判定，返回 {judge,gain,combo,feverStarted}）/
`G.songTime()` / `G.setSongTime(t)`（快进/跳拍，同步音频锚点）/ `G.setCombo(v)` / `G.setScore(v)` / `G.setNoAuto(v)`（屏蔽自动 MISS+曲末自动结算）/
`G.setReportTarget(fn)` / `G.startSong(si,di)` / `G.finish('complete'|'abort')` / `G.toSelect()` / `G.chart()` / `G.chartFor(si,di)` /
`G.notes()` / `G.songs` / `G.diffs` / `G.math`（judgeFor/comboBonus/accOf/gradeFor）/ `G.state()`（全字段快照）/ `G.fx()`（parts/floats/shake/flash/fever）/
`G.audio`。URL：`?autotest=1`（静音、全程不建 AudioContext、测完回选曲、写 `window.__TEST`）。

## 4. 上报协议

`ready{game}` 载入 → `progress{score,progress}`（曲百分比 0-1，每 10% 里程碑，整数分数）→ `event{tag:'fever'}` →
`complete{score,acc,grade,progress:1}`（曲完成末帧）或 `gameOver{score,progress}`（中断末帧）。

## 5. 验证清单（?autotest=1 — 2026-11-18 实测 38/38）

- [x] T1 启动零报错
- [x] T2 选曲界面 UI 完整（3 曲卡/3 难度/开始/静音/暂停/结束）
- [x] T3 ready 上报帧为首帧
- [x] T4 三首歌元数据（BPM 互异/拍型引用存在/鼓组 16 步合法）
- [x] T5 9 组谱面完整性（时间递增/同轨间隔≥85ms/在曲长内/无重复/曲长 60-90s）
- [x] T6 谱面时间=拍×BPM 映射（E 谱全部命中期望集，首音符=LEADIN）
- [x] T7 难度密度 E<N<H 且 H 双押≥E
- [x] T8 判定窗 ±40/±90/其余 三档数学
- [x] T9 combo 加成表（25→1.05 / 250→1.5 封顶）
- [x] T10 准确率权重与 S/A/B/C/D 评级边界
- [x] T11 hitNote PERFECT=100 分 combo=1
- [x] T12 hitNote GOOD=50 分
- [x] T13 过早(>90ms)按压忽略不惩罚
- [x] T14 combo 25 → 105 分（+5%）
- [x] T15 combo 50 → Fever 进入 8s、分数 ×2=220
- [x] T16 Fever 期间继续 ×2 计分
- [x] T17 判定计数累计一致（4P/1G/0M）
- [x] T18 过线自动 MISS + combo 断裂 + 红闪粒子/抖动
- [x] T19 暂停冻结 songTime/note 且音乐停止
- [x] T20 恢复后 songTime 推进且音乐恢复
- [x] T21 键盘 D/F/J/K 映射四轨命中
- [x] T22 空 note 空按不惩罚
- [x] T23 setScore 整数钳制
- [x] T24 触屏 4 分区存在（data-lane 0-3）
- [x] T25 中断局 → gameOver 末帧 + 结算面板（全 MISS 评 D）
- [x] T26 best（最高分+准确率）写入 rsl.best.0E
- [x] T36 best 还原为原值
- [x] T27 整曲快进 → complete 末帧 + progress(0-1) 递增帧序
- [x] T28 整曲快进全程无 NaN 无新报错
- [x] T29 AudioContext 可创建且自测期间保持静音
- [x] T37 歌曲调度状态 播放/暂停/恢复/停止
- [x] T30 结算面板元素完整（评级/标题/详情/两按钮）
- [x] T31 双押同拍异轨存在
- [x] T32 state() 快照字段完备且无 NaN
- [x] T33 点选曲目卡/难度按钮生效且 best 文案更新
- [x] T34 测完回选曲界面且谱面清空
- [x] T38 best 二次还原（套件末尾防后期局污染）

**实测结果**（2026-11-18，Playwright 实载源码目录静态服务 :8610，`node test.mjs rhythm-starlane 8610 --shot`）：
**38/38 断言全过 ×2 连续运行**，控制台零报错零警告（AudioContext 无手势警告属环境豁免项，实际也未出现——ctx 在套件末段才显式创建），
零外网请求。截图 3 张（选曲界面 shot-title / 游玩中 shot-play / 测后 shot-after-test）存档 `.scratch/guizang3/rhythm-starlane/`。
开发中修掉的坑：① 首轮 T9 失败是断言自身数值错误（comboBonus(499) 已达 1.5 封顶而非 1.45）——改用 249/250 检查边界后通过，逻辑本身无 bug；
② songs.js 初稿误留一行 `delete n => 0` 非法语法（编辑残留），提交前静态排查删除；
③ 测试期 best 断言前先 removeItem 隔离旧纪录 + 套件末尾二次还原，防止"测一次靠副作用/污染真实纪录"。

**验证分级**：
- 实际验证过：全部 38 条断言（含判定窗/加成/Fever/谱面数学/暂停冻结/上报帧序/整曲快进/best 读写还原/双押结构）+ Playwright 实载零报错 + 截图三张。
- 仅确认不报错：音频实际发声（headless 无法听音；仅验证 ctx 创建/调度状态机/静音标志，音色与响度需人工试听）；
  触屏分区的真实指针命中（Playwright 只验证了元素与绑定存在，未模拟真机触摸滑动）。
- 需人工试玩：手感调优（下落速度/判定体感）、三首歌听感、Fever 视觉密度、手机端竖屏点按体验。

## 6. 站点集成

- metadata.json 符合 schema（id=rhythm-starlane, title="Rhythm Starlane 节奏星轨", category="Music,Rhythm", 英文 description/controls, date_added 2026-11-17）。
- thumbnail.jpg 640×360 由主线程实机截图（agent 阶段不产出）。
- best 键：`rsl.best.{si}{diff}`（如 rsl.best.0N）；静音键：`rsl.mute`。
- 页面直开与站点 iframe 两态可玩（上报桥 window.parent postMessage 带来源标记）。
