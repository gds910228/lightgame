# Frostpuck Arena（霜锋冰球）— 设计文档

> 灯匠夜游 · 第 5 铺。类型：2D Canvas 物理空气冰球（Sports / Physics）。
> 全部代码原创：自写圆-圆弹性碰撞与子步进球判定、程序化冰面/极光/球拍美术、WebAudio 全合成音效与配乐；零外部请求、零 CDN。

## 0. 决策

| 决策点 | 选择 | 依据 |
|---|---|---|
| 画幅 | 逻辑 900 × 540，等比缩放居中，DPR 上限 2 | 桌面与横屏触控都完整可见；16:9 截图裁切友好 |
| 物理 | 自写圆形刚体近似：位置修正 + 质量加权冲量 + 子步积分 | 空气冰球只需要圆-圆与四壁，避免外部物理库 |
| 局制 | 先到 7 分，进球后停表演再开球倒计时 | 单局约 2–5 分钟，节奏明确 |
| AI | 三档参数化：速度 / 反应 / 预判 / 瞄准误差 / 防守站位 | 差异既能被感知，也能被 autotest 数值断言 |
| 操作 | 鼠标/触屏拖拽；单人兼容 WASD；本地双人 P1 WASD / P2 方向键 | 桌面与移动端都能玩；双人无需第二设备 |
| 音频 | 首次真实手势建 AudioContext，全合成 SFX + 三态 BGM | 符合自动播放策略与系列约定 |
| 美术 | 深夜靛青背景、极光、冰蓝/霜白冰面、铜金边框与球拍辉光 | 保留系列夜游气质，又有冰球辨识度 |

## 1. 玩法与状态流

- **模式**：标题页四个入口——单人对 AI 易 / 中 / 难、本地双人。
- **胜负**：上球门被攻破记玩家 1 分，下球门被攻破记 AI/P2 1 分；先到 7 分结束。
- **开球**：比赛开始与每次进球后回到中圈；3-2-1 倒计时后进入 live。进球后有约 1.55 秒庆祝/屏震/粒子，再进入下一次开球倒计时。
- **球拍限制**：两拍各占半场，不能穿越中线；AI 拍在上半场，玩家拍在下半场。
- **暂停**：P / 右上角按钮冻结球、球拍、倒计时与粒子。
- **记录**：`fpa.best` 保存玩家最快胜利用时（秒，保留两位），标题页显示；本地双人 P1 取胜也会记录。
- **里程碑**：每次得分上报 `progress`；玩家先到 7 上报 `complete`，AI 先到 7 上报 `gameOver`。

## 2. 物理参数

| 参数 | 数值 | 说明 |
|---|---|---|
| 逻辑场地 | x=54, y=78, w=792, h=404 | 四壁与球门开口均在此矩形上 |
| 球门开口 | 160 px（x=370..530） | 上/下门；门柱外碰撞反弹 |
| 冰球半径 / 质量 | 14 px / 1 | — |
| 球拍半径 / 质量 | 29 px / 7 | 球拍为运动学物体，质量参与冲量计算 |
| 球-拍恢复系数 | 0.97 | 击球方向由“拍心指向球心”法线决定 |
| 四壁恢复系数 | 0.92 | 侧壁与门柱外上下壁 |
| 空气阻尼 | 0.43 /s（指数） | 冰球会自然减速 |
| 滚动摩擦 | 9 px/s² | 低速时补足线性衰减，防止无限漂移 |
| 最大球速 | 1380 px/s | 防止数值爆炸；每帧最多 6 个子步 |
| 球拍键盘速度 | 660 px/s | 单人 WASD / 双人 P1、P2 |
| 鼠标/触屏跟随速度 | 1900 px/s | 直接拖拽手感，仍受半场边界约束 |
| 屏震上限 | 10 px，约 0.52 s | 进球；击球为小屏震 |
| hit-stop | 55 ms 击球 / 80 ms 进球 | 在固定步长内计时，不阻塞渲染 |
| 收敛保护 | 位置 clamp + 速度 clamp + NaN 扫描 | 极端速度下也不穿墙/出 NaN |

核心数学：
1. 侧壁/非门口上下壁采用位置回退 + 速度分量取反乘恢复系数。
2. 球拍碰撞沿法线施加 `j = -(1+e)·v_rel·n / (1/m_puck + 1/m_paddle)`，再以质量加权写回冰球速度；球拍速度参与相对速度。
3. 进球判定：球心 x 位于门柱之间，且球体前缘越过球门线即得分；进球后把球留在门线内并终止本帧物理。
4. 摩擦：每子步指数空气阻尼 + 与速度方向相反的线性滚动摩擦。

## 3. AI 三档数值表

| 难度 | 最高移速 px/s | 反应间隔 s | 预判系数 | 瞄准误差 px | 防守站位 y | 进攻系数 | 可测差异 |
|---|---:|---:|---:|---:|---:|---:|---|
| 易 | 250 | 0.34 | 0.12 | 62 | 表顶 +108 | 0.55 | 慢、只轻微预判、误差大 |
| 中 | 402 | 0.17 | 0.56 | 24 | 表顶 +100 | 0.80 | 能截断多数直线球 |
| 难 | 620 | 0.055 | 0.94 | 6 | 表顶 +92 | 1.00 | 高速封角，按反弹后 x 预测 |

AI 行为：每 `reaction` 秒重算一次目标；球朝 AI 半场飞来时，用 `x + vx·t·predict` 预测到达防守线时的 x，并按侧壁 `reflectX` 折叠；球停在 AI 半场且速度低时下压进攻；其余时间回到带正弦误差的中央防守位。autotest 用相同 30 帧测量：难档实际横向位移必须比易档多 60 px 以上。

## 4. 文件结构

```
index.html                 中文 UI、标题/结算 DOM、__BOOTERR 陷阱、script error 监听
js/physics.js              纯函数：常量、clamp、reflectX、球-拍冲量、子步进球/四壁
js/audio.js                WebAudio 合成：击球/撞墙/进球/胜负/UI + title/match/tension/end BGM
js/game.js                 固定步长主循环、状态机、AI、输入、程序化渲染、G 钩子、autotest
static/play68.js           goHome / clickMore / play68 兼容入口（回站点 `/`）
static/play68bar.js        父页面 handleGlobalShare(score) 桥、dp_share 等别名
metadata.json              id/title/category/description/controls/thumbnail
thumbnail.jpg              640 × 360 实机对局截图
```

## 5. G 调试钩子

- 推进：`G.step(n, dt)`（含渲染）、`G.upd(n, dt)`（只跑逻辑）。
- 输入：`G.press(...codes)`、`G.release(...codes)`、`G.drag(x, y)`、`G.setPaddle('p1'|'p2'|'ai', x, y)`。
- 场景：`G.setPuck(x, y, vx, vy)`、`G.startMatch(mode, diff)`、`G.startRally()`、`G.setPhase(...)`、`G.goTitle()`。
- 状态：`G.state()`（比分、相位、球/拍坐标速度、AI 参数、粒子数、NaN 标志、静音状态）。
- 控制：`G.setScore(p, a)`、`G.setMode(...)`、`G.setAI(diff)`、`G.setNoAuto(v)`、`G.setReportTarget(fn)`、`G.reportLog()`。
- 路径：`G.forceWin()`、`G.forceFail()`、`G.setMuted(v)`、`G.toggleMute()`、`G.aiProfiles()`、`G.view()`。
- URL：`?autostart=1&difficulty=1|2|3`（直接进入对局）、`?autotest=1`（静音、推进式测试、测完回标题）。

## 6. 站点上报与桥接

- 上报帧：`ready` → 进球时 `progress{score,progress}` → 玩家 7 分时 `complete{score,progress,time}` / AI 7 分时 `gameOver{score,progress,time}`。
- `G.setReportTarget(fn)` 可截获帧；未设置时 `postMessage({source:'lightgame', type:'lightgame:report', payload})` 给父页面。
- 分享：`window.parent.handleGlobalShare(score)`；本地桥提供 `dp_share / show_share / clickMore / goHome`；`goHome` 返回站点根 `/`。
- 存储键：`fpa.best`（最快胜利秒数）、`fpa.mute`（静音偏好）。autotest 结束会恢复测试前的 localStorage 与内存值。

## 7. 美术与音频

- **冰面**：离屏静态层 2× 预渲染；冰蓝渐变、斜向玻璃高光、径向暗角、程序化霜点、滑痕、角落霜枝、半场虚线、中圈、争球圈、球门区弧线、门柱铜件。
- **极光**：三条随时间正弦漂移的屏幕混合色带 + 顶部径向冷光。
- **实体**：球拍为铜金外环 + 冰蓝/紫晶内盘 + 4 向刻线 + 中心标记 + 拖尾；冰球为多层径向渐变 + 发光环 + 旋转刻线 + 拖尾。
- **反馈**：击球火花环、撞墙火花、进球 110 粒子烟花 + 多圈冲击环 + 白闪 + 屏震 + hit-stop。
- **音频**：首次真实手势建立 AudioContext；`unlock / play / setState / tick / setMuted`；静音时 master gain=0；autotest 不创建 ctx。

## 8. 验证清单（2026-11-19）

环境：Linux + Playwright Chromium（`--no-sandbox`），静态服务 `python3 -m http.server 8614`，测试脚本 `.scratch/guizang3/frostpuck-arena/test.mjs`。

**自动断言**（`?autotest=1`，连续两轮）：

- [x] 1 启动零报错（`__BOOTERR` / `G.err` 为空）
- [x] 2 6 组高速乱飞共 360 帧：球/拍全部有限，非进球态不出界，无 NaN
- [x] 3 侧壁反弹：左壁 -700 px/s → 正值且位置回到界内
- [x] 4 球拍击球方向：自下而上挥拍后冰球 vy < -40
- [x] 5 摩擦减速：340 px/s 运行 60 帧后速度显著下降且未归零
- [x] 6 上门口进球判定：玩家比分 0→1，进入 goal 相位
- [x] 7 门柱外越线不进球且反弹（vy 转正）
- [x] 7b 下球门进球对称计 AI 分（0:1，lastScorer=p2，goal 相位）
- [x] 8 `setScore` 比分增减（5:3 → 1:0）
- [x] 9 失败路径：AI 到 7，mode=over，捕获 `gameOver`
- [x] 10 胜利路径：玩家到 7，mode=over，捕获 `complete`
- [x] 11 上报顺序：`ready` 首帧、`progress` 在 `complete` 之前
- [x] 12 `fpa.best` 写入并读回，随后还原测试前值
- [x] 13 鼠标/拖拽输入改变玩家拍位置
- [x] 14 真实 WASD 输入路径改变 P1 位置（G.press / held 驱动）
- [x] 15 本地双人 P2 方向键改变 P2 位置
- [x] 16 本地双人模式关闭 AI，P2 无按键不自主移动
- [x] 17 暂停冻结冰球，恢复后继续运动
- [x] 18 真实 `PointerEvent(pointerType='touch')` 绑定驱动 P1
- [x] 19 AI 三档 speed / reaction / predict / error 四维严格单调差异
- [x] 20 AI 实际位移：难档 > 易档 + 60 px（相同 30 帧）
- [x] 21 `G.setAI(3)` 热切换硬档参数
- [x] 22 标题四个模式按钮存在，硬档按钮启动 hard AI 对局
- [x] 23 重开一局：比分、计时、相位、球位、winner 全复位
- [x] 24 noAuto 关闭时开球倒计时确实递减
- [x] 25 进球后经过表演/倒计时回到中圈 faceoff
- [x] 26 整局快进：7 次真实进球判定 + 末球结算，mode=over 7:0，无 NaN、无新报错、complete 存在
- [x] 27 自测期间静音，且刻意不创建 AudioContext
- [x] 28 M 键静音双向切换
- [x] 29 结算面板“再来 / 换难度 / 回标题”按钮存在且可见
- [x] 30 测完回标题，标题与 best 文案恢复
- [x] 31 断言总数 ≥ 24（实际 32 条结果）

**结果**：两轮均为 **32/32 通过**；每轮 console error = 0、console warning = 0、pageerror = 0、外网请求 = 0。Playwright 真实鼠标拖动冒烟两轮均从 x=450 → x=240。标题、对局、进球烟花截图与 640×360 实机缩略图均已人工查看。

**实际看到/听到的边界**：
- 实际看到：标题菜单、冰面纹理、极光、球拍/冰球辉光、击球火花、进球烟花与结算面板；真实鼠标拖动确实移动球拍。
- 实际数值验证：物理方向/摩擦/进球、AI 三档位移、暂停、输入、上报与 best 持久化。
- 仅确认不报错、未人工听感：WebAudio 图在真实手势后才创建，headless 测试为静音且不建 ctx；合成音色与 BGM 需人工试听。
- 未覆盖：真机 iOS/Android 多点触控（已用合成 touch PointerEvent 验证绑定）；长时间对局的 AI 观赏性/公平性需要人工试玩调参。

## 9. 已知问题与后续

1. 真实音频输出未在 headless 中试听；音量平衡（BGM 约 SFX 的 1/3–1/4）按代码设置，仍建议人工听感微调。
2. 本地双人只支持同一键盘；移动端本地双人不可用（触屏只有一个拖动焦点），标题仍会显示该模式，后续可按需加双指/双区域控制。
3. 硬档 AI 的反弹预判会让长回合变多；目前以数值差异和可击败性为先，正式上线前应做真人难度曲线测试。
4. 缩略图来自 640×360 实机对局帧；若站点要求无两侧留白，可再按 16:9 画幅单独调整逻辑画布。
