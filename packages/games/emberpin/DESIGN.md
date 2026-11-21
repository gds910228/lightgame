# Emberpin 余烬弹珠台 — 设计文档

> 灯匠夜游 · 第 10 铺。类型：2D Canvas 经典弹珠台（Arcade / Pinball / Physics）。
> 全部代码原创：自写球-线/球-圆/球-胶囊（翻板）碰撞、固定步长主循环、程序化台面与灯效、WebAudio 全合成音频；零外部请求、零 CDN、零图片素材。

## 0. 决策

| 决策点 | 选择 | 依据 |
|---|---|---|
| 画幅 | 逻辑 560 × 900，弹珠台 540 × 880 居中，等比缩放，DPR 上限 2 | 竖长台面是弹珠台的经典比例；横屏左右留出 HUD，竖屏改为顶部紧凑状态条 |
| 物理 | 自写圆形刚体 + 线段/圆/旋转胶囊碰撞；每个球按速度自适应 1–7 子步 | 需要真实的导轨反弹、保险杠弹射与翻板冲量，外部物理库反而难调 |
| 翻板 | 胶囊体 + 角速度表面速度；按下时额外保证沿台面向上的一脚 | 让“按翻板真的能打到球并改变速度”稳定可测，也符合弹珠手感 |
| 发射 | 右侧发射轨 + 蓄力弹簧，0.92 秒蓄满，速度 900–2100 px/s | 蓄力可感知，弱弹会落回发射轨，满力沿顶弧进入上半场 |
| 任务 | 3 组 × 3 个落靶；整组点亮提升倍率并给多球/额外球 | 目标清晰、数值可测，构成“记忆点”奖励循环 |
| 三球制 | 同时多球共享库存：全部落球后扣 1 球，库存 0 判负 | 支持多球奖励而不额外消耗球数 |
| 美术 | 炭黑/熔金/釉朱 + 余烬粒子 + 玻璃罩反光 + 发光得分环 | 保留“灯匠夜游”的夜色气质，同时一眼可辨为弹珠台 |
| 音频 | 首次真实手势建 AudioContext；自测全程静音且不建 ctx | 符合自动播放策略，保证自测控制台零 warning |

## 1. 玩法与状态流

- 标题页：中文标题、系列「第 10 铺」、最高分、操作引导，一键「落球开场」。`?autostart=1` 直接开局并自动满力发射（仅供截图/演示）。
- 开局：3 球，1 球停在右侧发射轨。按住空格蓄力，松开弹射；球沿发射轨上行，被顶部金轨导向左上进入主台面。
- 主循环：左右翻板、三道弹跳柱（保险杠）、两枚发光得分环、两组弹弓、两枚小立柱、三组落靶。
- 任务：每组 3 个靶，命中即点亮并“落下”；整组点亮后任务完成、倍率 +1、奖励多球或额外球。
- 连击：任意计分命中刷新 2.4 秒连击窗口，连击系数 `1 + min(combo,10) × 0.2`。
- 落球：球从底部漏出；若场上有其他球（多球）则只移除该球；场上无球时扣 1 球并补球到发射轨。库存 0 → `gameOver`。
- 通关：三组任务全部完成且得分 ≥ 60,000 → `complete`。
- 暂停：P / 右上按钮冻结球、翻板、粒子、蓄力与计时；页面隐藏清空累计时间并暂停蓄力。
- 记录：`emp.best`（最高分）、`emp.mute`（静音偏好）；自测结束恢复测试前值。

## 2. 数值表

### 物理

| 参数 | 数值 | 说明 |
|---|---:|---|
| 台面局部坐标 | 540 × 880 | 外轨 x=18..522，顶部 17 段手绘圆弧 |
| 球半径 | 11 px | 直径 22，明显可见；发射轨宽 52 |
| 重力 | 1400 px/s² | 弹珠台倾斜感 |
| 最大球速 | 2400 px/s | 速度钳制，防数值爆炸 |
| 空气阻尼 | 0.24 /s（指数） | 保持动量，不无脑停球 |
| 子步 | `ceil(speed·dt/5)`，1–7 步 | 高速也不穿轨 |
| 墙/轨恢复系数 | 0.54 | 导轨与底部 |
| 保险杠 | 半径 28/32；恢复 0.45；径向冲量 620 | 命中计分并有冷却 0.16 s |
| 得分环 | 半径 20；恢复 0.72；计分冷却 0.7 s | 圆环同时是碰撞体 |
| 弹弓 | 恢复 0.62 + 法向冲量 540；冷却 0.22 s | 两组斜向踢球面 |
| 翻板 | 长 80，半径 9；静止角 ±0.38 rad，按下角 左 -0.44 / 右 π+0.44；上摆 21 rad/s，回落 9 rad/s | 胶囊碰撞使用角速度表面速度；上摆时给 520+ 的向上保障冲量 |
| 发射蓄力 | 0.92 s 满；`v = -(900 + 1200×power)` | 满力约 -2100，弱弹会回落 |
| 圆心漏球线 | y > 872 | 球从翻板间漏出 |

### 计分与倍率

| 事件 | 基础分 | 备注 |
|---|---:|---|
| 保险杠 | 120 | 最高频 |
| 弹弓 | 60 | 踢球 + 计分 |
| 得分环 | 500 | 发光环，冷却 0.7 s |
| 任务靶 | 800 | 单靶，命中即点亮 |
| 完成一组 | 5000 × 完成前倍率 | 不参与连击系数，直接加算 |
| 倍率 | 1 → 2 → 3 → 4，上限 5 | 每完成一组 +1 |
| 连击系数 | `1 + min(combo,10) × 0.2` | combo 上限 11（显示值），窗口 2.4 s |
| 目标分 | 60,000 | 与三组任务同时满足才通关 |
| 开局球数 | 3 | `ballsLeft` 同时包含当前球 |
| 额外球上限 | 6 | 第二组任务奖励 |
| 多球奖励 | 第一组 +1 球，第三组 +2 球 | 场上并发球；共享库存 |

计分公式：`gain = round(base × multiplier × comboMult)`，得分为整数。
例：倍率 1、连击首次命中任务靶 = `round(800×1×1.2) = 960`；倍率 3 时为 `2880`。

### 任务与奖励

| 组 | 名称 | 颜色 | 位置 | 完成奖励 |
|---|---|---|---|---|
| 一 | 余火 | 釉朱 `#e85a3e` | 上半场左排 3 靶 | 多球 +1（场上双球） |
| 二 | 青焰 | 玉青 `#56c9b4` | 上半场右排 3 靶 | 额外球库存 +1 |
| 三 | 金环 | 熔金 `#ffc76a` | 中场横排 3 靶 | 多球 +2（终局三球） |

## 3. 文件结构

```
index.html                 中文 UI、标题/结算、__BOOTERR + netwrap 审计、触控按钮
js/physics.js              纯函数：常量、台面几何、线段/圆/胶囊/球球碰撞
js/render.js               程序化台面静态层、动态灯效、余烬粒子、玻璃反光、HUD
js/audio.js                WebAudio 合成：发射/翻板/保险杠/任务/多球/胜负 + 四态 BGM
js/game.js                 固定步长主循环、状态机、任务、输入、上报、G 钩子、autotest
static/play68.js           goHome / clickMore / dp_share / play68_submitScore
static/play68bar.js        父页面 handleGlobalShare(score) 桥与本地别名
metadata.json              id/title/category/description/controls/thumbnail
thumbnail.jpg              640 × 360 JPEG，实机游玩截图
```

## 4. 操作

- 键盘：空格蓄力/发射；A / ← 左翻板；D / → 右翻板；P 暂停；M 静音；R 重开；Enter 在标题/结算开局。
- 触屏：左右半屏按下控制对应翻板；「发射」按钮点按开始蓄力、松开弹射；另有两个翻板按钮。点击画布也可在发射轨有球时开始蓄力。
- 鼠标：左右半屏点按也可驱动翻板（键盘为主，鼠标为辅）。
- 开局一行引导写在标题页与游戏内底栏；失败/通关结算均有「再来一局 / 回标题」。

## 5. 站点上报与桥接

- 帧序：`ready` → 任务完成/多球/额外球时 `event` → 每 4 秒或任务完成时 `progress{score,progress,tasks}` → 失败 `gameOver{score,progress,tasks,multiplier}` / 通关 `complete{score,progress:100,tasks,multiplier}`。
- `report(kind,payload)` 对 `G.setReportTarget(fn)` 保留扁平帧；向父页面发送兼容信封：
  - progress → `{kind:'progress',data:{...frame}}`
  - event → `{kind:'event',event:frame.event||frame.tag,data:{...frame}}`
  - gameOver → `{kind:'gameOver',score,progress:{value:frame.progress},data:{...frame}}`
  - complete → `{kind:'complete',score}`
- 另发 `{source:'lightgame',type:'lightgame:ready',gameId:'emberpin',v:1}`。
- 所有分数为整数；`window.parent.handleGlobalShare(score)` 由 `static/play68bar.js` 调用；全局 `goHome / clickMore / dp_share / play68_submitScore` 均存在；`goHome` 返回 `/`。

## 6. G 调试钩子

- 推进：`step(n,dt)`（含渲染）、`upd(n,dt)`（只逻辑）、`press(...codes)`、`release(...codes)`、`clearKeys()`。
- 状态：`state()` 只读快照（mode/paused/score/best/ballsLeft/liveBalls/multiplier/combo/tasksDone/targetsLit/groups/flippers/balls/charge/serve/nan/muted 等）。
- 场景：`placeBall(x,y,vx,vy)`、`clearBalls()`、`spawnLane()`、`drainAll()`、`forceDrain()`、`addBalls(n)`、`spawnMultiball` 通过 `addBalls`。
- 玩法：`hitTarget(gi,ti)`、`completeGroup(gi)`、`completeAllTasks()`、`simulateBumper(i)`、`simulateRing(i)`、`forceWin()`、`forceFail()`、`forceLaunch(power)`。
- 控制：`startGame()`、`goTitle()`、`togglePause()`、`toggleMute()`、`setNoAuto(v)`、`setReportTarget(fn)`、`setScore/addScore/setMultiplier/setBalls/setCombo/setCharge`。
- 只读定义：`defs`（台面尺寸、墙体、保险杠、任务组、翻板角度）。
- `?autotest=1` 测试套件首行 `G.setNoAuto(true)`，静音且不创建 AudioContext，测完回标题并恢复 best / 静音原值。

## 7. 美术与音频

- **台面**：离屏 2× 预渲染。炭黑柜体 + 双层熔金描边与铆钉；暖金径向光台面；程序化纸刻噪点与刻线；中央“余烬核”十二瓣纹章；目标组刻字（余火/青焰/金环）；右侧发射轨箭头与「发射轨」竖排小字；底部 `EMBERPIN / 余烬弹珠台 · 第十铺` 铭牌。
- **动态**：三枚保险杠（多层径向渐变、旋转刻齿、命中扩散环）、两枚发光得分环（旋转刻齿 + 青玉辉光）、釉朱落靶（点亮后高亮 + 光晕）、金色翻板（按下时上摆与辉光）、弹簧柱塞与纵向蓄力条、球体铬金径向渐变 + 拖尾 + 余烬粒子。
- **氛围**：屏幕空间 74 颗上浮余烬、台面暖光晕、玻璃罩斜向高光、屏震、白闪、hit-stop（任务完成 70 ms）。
- **音频**：全合成。音效含发射、翻板、保险杠、任务靶、得分环、弹弓、撞轨、漏球、任务完成、多球、额外球、胜负、UI；BGM 四态 `title/play/tension/end`，音量约为 SFX 的 1/4；静音时 master gain=0；自测不建 ctx。

## 8. 验证清单（2026-11-20）

环境：Linux + Playwright Chromium（`--no-sandbox --use-gl=swiftshader`），静态服务
`cd packages/games && python3 -m http.server 8625`，测试脚本
`.scratch/guizang3/emberpin/{test.mjs,audit.mjs,probe.mjs}`，报告 `.scratch/guizang3/emberpin/audit.json`。

### 实测过（Playwright 连续 2 轮页面加载）

- [x] 第 1 轮：36 / 36 断言通过，`__TEST.done=true`
- [x] 第 2 轮：36 / 36 断言通过，`__TEST.done=true`
- [x] 每轮 console error = 0；console warning = 0；pageerror = 0
- [x] 每轮外部请求 = 0（Playwright request 列表 + 页面内 `__NET.fetch/xhr/ws` 计数全为 0）
- [x] 直接打开无参数 `index.html`：零报错、零 warning、零外网，标题模式正常
- [x] 真实键盘：点击开始 → 空格蓄力（实测 charge 0.90）→ 松开弹射（vy ≈ -1728）
- [x] 真实键盘：A / D 分别使左右翻板按下；P 暂停/恢复；M 切换静音；R 重开（score 0、3 球、球在发射轨）
- [x] 真实鼠标：按住画布左半 → 左翻板按下
- [x] 真实触控事件（PointerEvent）：左/右按钮、画布左右半屏、发射按钮均生效
- [x] 标题截图 1280 × 720；游玩截图 / 封面 640 × 360；封面为真实游玩画面
- [x] 封面 `thumbnail.jpg`：JPEG 640 × 360，RGB
- [x] 长跑探针（逻辑快进、非人工）：无翻板输入 965 帧（约 16 s）自然漏完 3 球 → gameOver；有翻板/补发射 3600 帧（60 s）得分 29,592、完成 1 组任务、点亮 5 靶、剩 2 球，台面持续可玩
- [x] 待机/快进无 NaN、无球逃逸台面、无新增报错
- [x] 页面隐藏时不累计 dt（主循环 `document.hidden → acc=0`）
- [x] 文件总量约 141 KB，< 15 MB；UTF-8 无 BOM

### 断言覆盖（36 条，含全部强制类别）

启动零报错；开局状态；重力；墙体反弹；翻板击球真的改变速度/方向；保险杠计分与反弹；得分环；
任务靶精确计分 960；完成一组倍率 +1 且多球；第二组额外球；第三组多球 +2；连击系数数学；
连击窗口衰减；倍率数学（×3 → 2880）；多球数量与额外球钳制；漏球扣球并补球；暂停冻结；
A/D 输入模拟；空格蓄力发射；蓄力强度影响弹速；触屏按钮；画布半屏触控；三球耗尽 gameOver；
gameOver 上报；best localStorage 写入/读回；任务全亮 + 目标分 → complete；complete 上报；
ready 首帧 + event/progress 帧；重开完整复位；R 键重开；1500 帧快进无 NaN/无逃逸；
音频状态切换与自测静音；DOM 壳齐备；测完回标题并恢复 best。

### 仅确认不报错（未能听到/看到真实设备效果）

- WebAudio 合成音色与四态 BGM 只验证了 API 路径、状态切换与静音，没有实际监听音质。
- 静音偏好 `emp.mute` 的写入未在断言中单独读回（`emp.best` 已完整验证读写与还原）。
- 竖屏顶部状态条只通过代码路径确认，未在真实手机浏览器上检查安全区/刘海。

### 需人工试玩

- 翻板与弹弓手感、球速/重力是否偏快或偏慢，需要真人试玩再调。
- 60,000 分目标在三球内对新手是否过高；当前探针 60 秒可得约 30,000，建议人工评估。
- 多球时球-球碰撞的视觉拥挤度、触屏左右半屏同时按下的舒适度。
- 音频混音比例与手机扬声器表现。
