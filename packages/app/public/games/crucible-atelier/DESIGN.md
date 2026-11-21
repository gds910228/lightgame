# Crucible Atelier 坩埚炼金坊 — 设计文档

> 灯匠夜游 · 第 13 铺。2D Canvas 放置炼金模拟，vanilla ES modules，零外网、零外部素材、WebAudio 全合成。
> 主题：紫铜坩埚、药草绿、星辉蓝、深夜靛青。所有画面由 Canvas 程序化绘制，配方卡使用 16 种可辨识图标族。

## 1. 玩法与目标

- **开局**：素材 12、金币 0、精华 0，水滴 6、灰烬 6；四条产线均为 Lv.0。点击坩埚或「采撷」获得 +2 水滴、+2 灰烬、+1 素材。
- **配方树**：36 条配方分六阶，只能从「水滴 + 灰烬」起步，按前置配方逐级解锁。点击配方卡即选中并尝试炼成；锁定配方不会扣材料。
- **终局**：录满全部 36 条配方（其中星辉坩埚本身为第 36 条；炼成前需已录 35 条），消耗「星辉核心 + 星辉液」铸出 **星辉坩埚**，进入 `complete`。
- **失败**：点「超载催炼」可让一次炼成产出 ×3，但炉压 +28；炉压以 2.5/秒自然回落，达到 100 即 **炸炉破产 → gameOver**。四次连续超载即可触发，属于玩家主动承担的风险路径。结算提供「重开一炉 / 回标题」。
- **转生**：至少录得 10 张配方后可「重铸炉心」，按 `max(1, floor(已录/4) + floor(总炼成/40))` 获得传承点。转生重置资源、产线、配方与炉压，保留传承与最高纪录。每点传承使四条产线输出 ×(1+0.15×传承)。

### 配方树（36）

| 阶 | 配方 | 输入 | 前置 |
|---|---|---|---|
| 1 | 薄雾 | 水滴+灰烬 | — |
| 1 | 泥沼 | 水滴×2 | — |
| 1 | 炭末 | 灰烬×2 | — |
| 1 | 晨露 | 水滴+薄雾 | 薄雾 |
| 1 | 余烬 | 灰烬+炭末 | 炭末 |
| 1 | 地衣 | 泥沼+薄雾 | 薄雾、泥沼 |
| 2 | 蒸汽 | 晨露+水滴 | 晨露 |
| 2 | 泥饼 | 泥沼+余烬 | 泥沼、余烬 |
| 2 | 灰碱 | 炭末+晨露 | 炭末、晨露 |
| 2 | 药芽 | 地衣+晨露 | 地衣 |
| 2 | 精炭 | 余烬+炭末 | 余烬、炭末 |
| 2 | 晶盐 | 晨露×2 | 晨露 |
| 2 | 陶土 | 泥沼+炭末 | 泥沼 |
| 2 | 浓雾 | 薄雾+蒸汽 | 薄雾、蒸汽 |
| 3 | 草药酊 | 药芽+灰碱 | 药芽、灰碱 |
| 3 | 石灰 | 泥饼+余烬 | 泥饼、余烬 |
| 3 | 碱液 | 灰碱×2 | 灰碱 |
| 3 | 松脂 | 精炭+浓雾 | 精炭、浓雾 |
| 3 | 玻璃砂 | 晶盐+精炭 | 晶盐、精炭 |
| 3 | 药汤 | 药芽+陶土 | 药芽、陶土 |
| 3 | 铜绿 | 陶土+晶盐 | 陶土、晶盐 |
| 3 | 香精油 | 蒸汽+灰碱 | 蒸汽、灰碱 |
| 4 | 药液 | 草药酊+药汤 | 草药酊、药汤 |
| 4 | 紫铜锭 | 铜绿+石灰 | 铜绿、石灰 |
| 4 | 星盐 | 玻璃砂+香精油 | 玻璃砂、香精油 |
| 4 | 灯油 | 香精油+松脂 | 香精油、松脂 |
| 4 | 香膏 | 药液+松脂 | 药液、松脂 |
| 4 | 靛青墨 | 铜绿+碱液 | 铜绿、碱液 |
| 5 | 星钢 | 紫铜锭+星盐 | 紫铜锭、星盐 |
| 5 | 月露 | 药液+星盐 | 药液、星盐 |
| 5 | 星灯 | 灯油+玻璃砂 | 灯油、玻璃砂 |
| 5 | 蓝焰 | 靛青墨+灯油 | 靛青墨、灯油 |
| 5 | 鎏金液 | 香膏+紫铜锭 | 香膏、紫铜锭 |
| 6 | 星辉液 | 月露+蓝焰 | 月露、蓝焰 |
| 6 | 星辉核心 | 星钢+鎏金液 | 星钢、鎏金液 |
| 6 | 星辉坩埚 | 星辉核心+星辉液 | 星辉核心、星辉液；且已录满其余 35 条 |

所有配方输入组合互不相同（自测 T4 校验）。

## 2. 经济数值

### 资源
- **素材**：采集线产出；蒸馏/合成线消耗。
- **金币**：合成/封装线产出；产线升级、技能消耗（本作升级只消耗金币/素材/精华）。
- **精华**：蒸馏线产出；合成/封装消耗，封装线升级也需要。
- 首次录得配方奖励：金币 `10 + 8×阶`，精华 `max(0, 阶-1)`；重复炼成不再发奖励。
- 起始素材 12 用于首次产线投资；三条一阶配方首次录得共 54 金，足以把采集线升到 Lv.1–2。

### 四条产线（Lv.0 未启用，上限 Lv.12）
| 产线 | 每级产出（基础） | 每级消耗（基础） | 升级成本（从 Lv.l 起） |
|---|---|---|---|
| 采集 | +2.4 素材/秒；另 +2 基础物品/秒 | — | 金 `round(20×1.55^l)` |
| 蒸馏 | +0.42 精华/秒 | 2.0 素材/秒 | 金 `round(45×1.60^l)` |
| 合成 | +11 金币/秒 | 1.1 素材 + 0.26 精华/秒 | 金 `round(70×1.58^l)` + 材 `round(30×1.40^l)` |
| 封装 | +24 金币/秒 | 0.18 精华/秒 | 金 `round(110×1.60^l)` + 精 `2+1.5l` |

- 所有产出乘 `1+0.15×传承`；消耗不乘。
- 在线结算顺序：采集 → 蒸馏 → 合成 → 封装，按当前库存限制系数 `f=min(1, 库存/需求)` 降载，绝不出现负资源。
- 离线结算用同一顺序的解析公式，按当前产线等级与传承一次性计算。

### 离线收益
- 记录 `lastSeen` 时间戳；回来时按当前产线效率结算，**上限 8 小时（28800 秒）**。
- 1 小时、四线全 Lv.2、传承 0、库存（素材 100 / 精华 20 / 金币 0）的实测解析值：
  - 采集 +17280 素材；蒸馏消耗 14400 素材、+3024 精华；
  - 合成因素材只够 2980 而降载，金 +29800、精 -704.3636；
  - 封装金 +172800、精 -1296；
  - 净结果：素材 **-100**、精华 **+1023.6364**、金币 **+202600**（自测 T23 断言到 0.01）。
- 10 小时与 8 小时收益完全相同（T24）。

### 炼成值与纪录
`score = round(已录配方×120 + 总炼成次数×15 + 传承×400 + (素材+2×金币+10×精华)/10)`，为整数。
最高炼成值写入 `localStorage['cra.best']`；通关/炸炉时刷新。

## 3. 操作

- **鼠标/触屏**：点击坩埚或「采撷」收集；点击配方卡炼成；点击产线卡升级；点击「超载催炼」。
- **键盘**：`1-4` 选择产线（再按一次升级）；`Q` 炼选中配方；`W` 炼首个可炼配方；`E` 连炼所有可炼配方；`P` 暂停；`M` 静音；`Enter` 开始/重开；`R` 重开本炉。
- **布局**：桌面/横屏为左侧炉景 + 右侧配方谱 + 左下产线；窄屏为紧凑横向；竖屏为顶部资源、居中炉景、下方产线与配方底部面板。DPR 上限 2。

## 4. 视觉与音频

- **炉景**：深夜靛青纸底、纸张颗粒、炼金圆环、左右药架剪影；紫铜坩埚用多层线性/径向渐变、铜面高光、铆钉、把手和炉腿绘制；液面随时间的银河高光；程序化火焰（六簇正弦扰动火舌 + 叠色核心）、气泡、蒸汽、灰烬粒子。压力 >70 时炉缝发红并出现红色暗角。
- **配方卡**：16 种图标族（水滴/火焰/云/泥沼/炭块/晶体/叶/烧瓶/药瓶/陶罐/锭/脂罐/星灯/光球/粉堆/坩埚），不同颜色与轮廓区分；锁定配方置灰。
- **特效**：采集、炼成、首次录得、超载、炸炉均有粒子/环波/屏幕震动；首次录得与超载带 hit-stop；粒子上限 260、气泡上限 34。
- **音频**：WebAudio 合成 SFX（采撷、炼成、解锁、升级、超载、炸炉、胜利等）与四态配乐（title/play/tense/win），首次手势后建 AudioContext，autotest 全程静音，`M` 静音并存 `cra.mute`。

## 5. 工程结构

```
index.html            中文 UI、错误陷阱、fetch/XHR/WS 审计、play68 本地桥
js/data.js            36 配方、16 图标族属性、四条产线定义与成本、离线/数值公式
js/render.js          炉景/火焰/液体/气泡/蒸汽/粒子 + 图标绘制（纯 Canvas）
js/audio.js           WebAudio SFX + 四态合成 BGM
js/game.js            状态机、经济/产线/配方、离线结算、G 钩子、上报桥、?autotest=1
static/play68.js      goHome / clickMore / dp_share / play68_submitScore
static/play68bar.js   parent.handleGlobalShare 分享桥
```

- 固定步长 60Hz accumulator，dt clamp 0.12；页面隐藏时清空 accumulator。
- 存档键前缀 `cra.`：`cra.save`、`cra.best`、`cra.mute`；autotest 前快照并在结束时还原。
- 上报：`ready`（另发 `lightgame:ready`）→ `progress` / `event` → `gameOver` 或 `complete`；`reportTarget` 收扁平帧，父页面收兼容信封（progress/event/gameOver/complete 的 `data` 字段）。分数取整。

### G 钩子（节选）
`G.err / step / upd / press / setNoAuto / setReportTarget / state`
`G.startGame / toTitle / togglePause / toggleMute / gather`
`G.selectLine / upgradeLine / lineCost / selectRecipe / craft / canCraft / available / itemCount / grantItem / setDiscovered / unlockAll / craftSelected / quickCraft / craftAllPossible / overload`
`G.forceFail / forceComplete / prestige / prestigeGain / setRes / addRes / setLineLevel / setPressure / setPrestige`
`G.setOfflineSeconds / clearOfflineSeconds / applyOffline / claimOffline / computeOfflineGain / setNow / now / setLastSeen`
`G.saveNow / loadSave / hardReset / resetRun / reportProgress / reportLog / scoreNow / progressPct / defs`

状态修改均走函数；`state()` 返回副本快照。

## 6. 验证清单

### 实测通过
- [x] `?autotest=1` 连续 **2 轮**：**37/37 断言全过**（round1 37/37、round2 37/37，0 fail）。
- [x] 两轮 console error = 0、console warning = 0、pageerror = 0、external request = 0；`window.__NET` fetch/xhr/ws 均为 0。
- [x] 直接打开无参数页：`mode=title`，`__BOOTERR=[]`，全局 `goHome/clickMore/dp_share/play68_submitScore` 均为 function。
- [x] 真实键盘：`2` 选中蒸馏线（selectedLine=1）、`1` 选回采集线（=0）；`Q/W/E` 让总炼成 3→10；`P` 暂停/恢复；`M` 静音切换。
- [x] 真实鼠标：点采撷 水滴 6→8；点三张一阶配方卡 3 次炼成、54 金、3 张配方；点产线卡 Lv.0→1；点坩埚本体 水滴 0→2（重置后）。
- [x] 真实触控（hasTouch context，640×360）：点开始进入 play；点采撷 水滴 6→8；点薄雾卡 总炼成 0→1。
- [x] 离线数学：Lv.2 四线 1 小时 → 金 +202600、素材净 -100、精华净 +1023.6364（容差 0.01）；10 小时与 8 小时完全相等。
- [x] 超载失败：首超载炉压 28、产出 ×3；第四次连续超载炉压 100 → `gameOver` 帧（整数分数）。
- [x] 终局：35 张前置配方 + 星辉坩埚 → 36/36 且 `complete` 帧；`progress` 帧先于 `complete`，并含 `discover` event。
- [x] 存档 `cra.save` 写读往返还原产线/资源/物品/传承；`cra.best` 在通关后写入；`hardReset` 删除两个键并复位。
- [x] 6000 帧随机采撷/升级/连炼快进无 NaN、无负资源、无新报错。
- [x] 配方表 36 条、六阶、输入组合唯一、依赖引用完整、从水滴/灰烬可达终局。
- [x] 桌面 1280×720、640×360 横屏与 390×844 竖屏截图均正常渲染；标题/炉景/配方卡无纯色占位。
- [x] **站点兼容信封实测**（同源 iframe 父页，`.scratch/guizang3/crucible-atelier/envelope.json`）：`lightgame:ready`（gameId/v）+ `ready` report；progress 为 `{kind:'progress', data}`；event 为 `{kind:'event', event, data}`；gameOver 为 `{kind:'gameOver', score:int, progress:{value}, data}`；complete 为 `{kind:'complete', score:int}`；console error=0、external=0。
- [x] 离线弹窗与续档实测：写入 4 条产线/资源/4 张配方/传承 1 后 `saveNow` → 刷新，标题按钮显示「继续炉坊」，资源/产线/传承完整还原；把存档 `lastSeen` 改为 3 小时前再刷新，离线弹窗出现，收取后素材/精华/金币按公式增加且弹窗关闭。

### 仅确认不报错
- 音频实际听感（合成 BGM 音色、SFX 音量平衡）仅确认 AudioContext 创建成功且 autotest 静音，未做主观试听。
- 长时段真实挂机（>1 小时）的数值曲线未做真人试玩，仅用解析离线公式与 6000 帧快进覆盖。

### 需人工试玩
- 从零到 36 张配方的完整手动节奏与升级成本曲线是否过慢/过快，需要真人试玩调参。
- iOS Safari / 低端安卓的实际触摸手感、字体回退与音频解锁时机。

### 截图
- `.scratch/guizang3/crucible-atelier/title-1280x720.png`
- `.scratch/guizang3/crucible-atelier/play-1280x720-demo.png`
- `.scratch/guizang3/crucible-atelier/play-640x360.png` / `.jpg`（封面来源）
- `.scratch/guizang3/crucible-atelier/portrait-play.png`、`portrait-title.png`
- `.scratch/guizang3/crucible-atelier/end-fail.png`、`end-complete.png`
- `.scratch/guizang3/crucible-atelier/audit.json`、`envelope.json`、`run-3.txt`
- 封面 `packages/games/crucible-atelier/thumbnail.jpg`（640×360 JPEG，实机游玩）

## 7. 已知取舍

- 这是一个放置游戏，完整通关的实际时长取决于玩家的主动炼成频率；测试保证的是数学与状态机正确，不以固定 3–8 分钟通关为硬约束。
- 竖屏采用「顶部资源 + 炉景 + 底部产线/配方」的独立布局，配方面板高度固定为 38vh，极矮屏（<560px 高）需要滚动或横屏。
- 失败路径是玩家主动选择的高风险超载，不属于不可恢复的存档损坏；「重开一炉」保留传承。
