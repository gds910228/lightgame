# 需求评审报告 v1

> 阶段2产出 | spec-reviewer | 评审方式:逐条抽查源码/脚本实证(非通读式评审)
> 版本递增:v1, v2, v3... 旧版本永不删除 | 轮次上限:3 轮,超出升级人工

## 评审对象
- 文件:request_analysis/spec.md(版本 v1)+ tasks.md
- 基准:用户原始需求 + `.harness/rules/` + 实际源码抽查(build-games-list.js / GameDetailPage.tsx / metadata.schema.json / sync-games.js / 7 个游戏源文件)

## 评审检查项
- [x] 需求理解准确,无歧义(一处事实错误见 I-1)
- [x] 目标可验证,验收标准清晰(一条不可执行见 I-2)
- [x] 方案选型有 2-3 备选 + 理由(smartphone-shooter 主/备方案、soccer-dash speed 条件分支均合理)
- [x] 非目标明确(YAGNI)(反向清单明确,preserveManualPath 不全局反转有量化依据)
- [x] 约束与风险识别充分(漏 1 项实现级风险见 I-3)
- [x] 架构影响与现有结构兼容(参考 工程结构.md)(aspectRatio 已在 schema 声明、app/src 零命中确认)
- [x] 澄清问题已闭环(HITL-1 六问全部有决议)
- [x] 无过度设计 / 无遗漏(仅措辞级问题见 Minor)

## 评审结论
- [ ] ✅ APPROVED -- 可进入编码
- [x] 🔄 需修改 -- 见下方问题(3 个 Important,均为小改,无需推翻任何方案)
- [ ] ⏸ 升级人工 -- 轮次超限

---

## 一、逐项评审要点结论

### 要点 1:技术方案正确性 — 通过(全部抽查证据成立)

| spec 断言 | 抽查结果 |
|---|---|
| preserveManualPath 对 `/` 开头绝对路径无条件保留(build-games-list.js:207-223) | ✅ 实证 `packages/app/scripts/build-games-list.js:208-223`。L212-215:`/^https?:\/\//i.test(manualPath) \|\| manualPath.startsWith('/')` 即直接 `metadata[assetType] = manualPath` 并打日志,**不做文件存在性检查**。Task 2 期望的日志文案 `Preserving manual image path for ...` 与 L214 实际输出格式一致 |
| games.json 当前状态(moon-rabbit=mmttt.png 绝对路径) | ✅ 实测 `packages/app/public/games.json`:moon-rabbit 为 `/games/moon-rabbit-jump/mmttt.png`;retro 仍为 `/games/retro-game-tune-quiz/Public/fangyan/loading.png`(待改);`packages/games/moon-rabbit-jump/mmttt.png`(14.7KB)与 `packages/games/retro-game-tune-quiz/Public/upload/6177/53fe872815c9a.jpeg`(74KB)均实际存在 |
| build-games-list.js L289 直接透传 metadata 全部字段 | ✅ L289 `games.push(metadata)`,新增 aspectRatio 字段自动进入 games.json |
| GameDetailPage.tsx:519-543 全屏层描述 | ✅ L519-521 `fixed inset-0 bg-black z-50`,iframe L531-543 `w-full h-full` + sandbox/allow 属性,与 spec 一致;且 iframe **仅存在于全屏层**(L524 条件渲染),平台侧只改全屏层即覆盖全部游玩面,无遗漏 |
| aspectRatio 在 app/src 零命中 | ✅ grep 全目录 0 命中;`packages/app/src/types/index.ts` Game 接口(L1-10)确认无该字段 |
| peach index.html:46 内联 `top:-50%` | ✅ `packages/games/peach-catch-frenzy/index.html:46` 精确命中(`#container style="position:relative;top:-50%;..."`,table 居中 hack 残留) |
| soccer-dash iTouch 只绑 touch(1599-1660)、速度=speed(6)+⌈level/2⌉(875/896) | ✅ L1645-1657 仅 touchstart/touchmove/touchend 绑在 `#cr-stage`;L829 `speed: 6`、L875 `movementSpeed: Crafty.config.speed + Math.ceil(Crafty.config.level / 2)`、L896 `.multiway(this.movementSpeed, ...)` 全部精确命中 |
| smartphone-shooter U+500 出画(all-in-one.js:3146-3157) | ✅ 实际路径 `packages/games/smartphone-shooter/js/all-in-one.js`(spec 省略 `js/` 前缀,见 M-4)。L3149 `U=(this.height-400>>1)-100`、L3152 按钮图 Κe 画在 `U+500`;canvas 尺寸取自 window.innerWidth/Height(L3575-3576)。**数学复核成立**:16:9 桌面(1280x720)画布 640x360 → U+500=(360-400)/2-100+500=380>360 出画;9:16 容器画布高 640×720/405≈1138 → 按钮 y≈768<1138 进可视区,spec 的 1138/768 数值全部可复算 |
| skyscraper cc.winSize 误用(game.min.js:3788-3794) | ✅ `packages/games/skyscraper-stack/src/game.min.js:3791-3792`:`var a = cc.winSize; cc.view.setDesignResolutionSize(320, 320*(a.height/a.width), FIXED_WIDTH)` — 用设计尺寸反推设计尺寸=恒等于 320x480,结论成立 |
| tickle-frenzy Zepto .tap 桌面不触发 | ✅ `js/35/zepto.js` 确为 Zepto;`.tap(` 全游戏仅 `js/35/index4.js` 一处文件命中。**但绑定点是 3 处不是 2 处** → 见 I-1 |
| batch-30 共 30 个未提交游戏、其余 23 个不混入 | ✅ `git status` 实测 30 个 untracked 游戏目录,30-7=23 与 Task 10 表述一致;games.json 共 82 款与验收条目一致 |

### 要点 2:等比内接公式 — 数学正确,实现单位有风险(见 I-3)

数学复核(设 R = 宽/高,V = 视口宽高比):

- **V > R(视口更宽)**:`min(100vw, 100vh·R)` 取 100vh·R;`min(100vh, 100vw/R)` 取 100vh。结果宽/高=R,左右留黑边,不溢出。✅
- **V < R(视口更高)**:对称地取 宽=100vw、高=100vw/R,结果仍是 R,上下留黑边。✅
- **V = R**:两式均退化为视口尺寸。✅

min() 在两个约束中自动取紧的一侧,数学上**必等比、必不溢出**,spec 断言成立。

**回归性**:spec 明确"无 aspectRatio 游戏保持 w-full h-full 现状,零回归"+ Task 1 Step 5 专项验证。我额外全量扫描 `packages/games/*/metadata.json`:**当前 0 个游戏声明 aspectRatio**,即改动后受影响的只有本 spec 新增的 4 个游戏,不存在"存量游戏已声明 aspectRatio 被突然激活"的隐藏回归面。回归范围闭环。

### 要点 3:方案最小性 — 通过(1 处措辞会误导实现,见 M-1)

- **soccer-dash speed 改法**:spec 要求"先全量检索 Crafty.config.speed 引用"——本次评审已代查:`Crafty.config.speed` 全文件**仅 1 处消费**(L875 movementSpeed),球/AI 均不复用。直接改 L829 `speed: 6 → 200` 即为最小改法,"若被复用则只给 multiway 传独立值"的分支实际不会触发。建议把检索结论回写 spec 闭环(M-2)。
- **smartphone-shooter 备选路径**(菜单 y 相对化)合理且被 Playwright 实测门控——主方案数学已验证成立,备选仅兜底,非过度设计。
- **peach 双修复**(删 top:-50% + aspectRatio):top:-50% 是根因必须删;aspectRatio 治共性诱因,两者不冗余。
- 各 aspectRatio 数值复核:peach 640x960=2:3 ✅、skyscraper 设计 320x480=2:3 ✅、soccer 舞台 320x480=2:3 ✅、smartphone 640x1140≈0.5614≈9:16(0.5625)✅。
- **tickle 触摸端回归论证**("合成 click,单一来源无双发")正确:Zepto .tap 是 touch 合成事件,换原生 click 后移动端由浏览器 click 合成接管。
- soccer-dash 的 `window.focus()`:根因是速度而非焦点(iframe 被点击即获键盘焦点),属防御性加固而非根因修复——可保留,但验收无对应条目,见 M-6。

### 要点 4:验收标准可测性 — 8/9 条可客观取证,1 条不可执行(见 I-2)

| 验收条目 | 可测性 |
|---|---|
| moon-rabbit build 日志取证 | ✅ 日志文案与 build-games-list.js:214 实际输出一致 |
| retro 彩色 jpeg + build 稳定 | ✅ 可查 games.json + 视觉断言(文件已确认存在) |
| peach y≥0 | ✅ getBoundingClientRect 客观可测 |
| skyscraper visibleSize≥480 | ✅ sandbox 含 allow-same-origin,可进 iframe 执行 `cc.view.getVisibleSize()` 取数 |
| smartphone 入口可见可点 | ✅ |
| soccer 鼠标/键盘/无报错 | ⚠️ "位移可感知"偏主观,建议量化(M-3) |
| tickle #intro 隐藏 | ❌ 元素不存在——实际是 class `.intro`(index.html:18),无 `#intro` id,按字面不可执行,见 I-2 |
| 回归 w-full h-full | ✅ |
| lint/build/validate | ✅(82 款与 games.json 实测一致) |

### 要点 5:风险识别完备性 — 主要风险已覆盖,补 1 项(I-3),另附 3 条已实证排除项

**已实证排除的风险(评审新增,建议回写 spec 备查)**:
1. **AJV schema 不会拒绝 aspectRatio**:`scripts/schemas/metadata.schema.json` L40 已显式声明 `aspectRatio: {pattern: "^[0-9]+:[0-9]+$"}`("2:3"/"9:16" 均匹配),且 L61 `additionalProperties: true`;validate-games.js 仅 AJV 编译该 schema,无额外字段检查 → **零风险**。
2. **sync-games 不会覆盖 games.json**:`scripts/sync-games.js` 只 emptyDir+复制 `packages/games/ → public/games/`(L190),全程不写 games.json;games.json 唯一写入方是 build-games-list.js。注意推论:**preserveManualPath 只保护 image/thumbnail/cover 三字段**(loadExistingGamesList L127-131),Task 2 手改 retro 时只能动这两个字段,顺手动 games.json 其他字段会被静默重置。
3. **sandbox iframe 内游戏的 viewport 单位**以 iframe 盒子为视口,不引入额外风险。

---

## 二、问题清单

| # | 问题描述 | 建议 | 优先级 | 是否阻塞 |
|---|---|---|---|---|
| I-1 | tickle-frenzy `.tap()` 实为 **3 处(L82/86/88)**,spec 写"两处(82、86)"。L82 是答题选项按钮(`$(".buttons .col")`,桌面可玩性核心),L88 是 `.retry` 重玩按钮。按 spec 字面执行会漏掉 retry——游戏结束后桌面无法重开,而现有验收条目仍能通过,形成验收盲区 | spec §2 表 #7 与 §3.2 tickle 行改"三处(82/86/88)";验收补:答题按钮 click 可选答案、`.retry` click 后 `#scoreScreen` 隐藏可重开。tasks.md Task 7 Step 1 的"全文件检索"可兜底,但 spec 是 SSOT 必须改对 | Important | 是 |
| I-2 | 验收标准"tickle …(#intro 隐藏)"引用不存在的选择器:index.html:18 是 `<div class="intro">`,全游戏无 `#intro`;实际隐藏逻辑是 index4.js 中 `d = $(".intro"); d.hide()`。按字面无法取证 | 改为"click #start 后 `.intro` 隐藏(display:none)且 `#go` 出现" | Important | 是 |
| I-3 | 公式实现用 `100vw/100vh`(spec §3.1、Task 1 Step 3)与全屏容器 `fixed inset-0` 真实尺寸有偏差:① 桌面有竖向滚动条时 100vw 按规范"视滚动条不存在"计算,比容器宽约 15px → iframe 超宽、居中偏移约 7px、右缘被裁;② iOS Safari 动态视口下 100vh 取最大视口高,工具栏可见时比容器高数十 px → iframe 纵向溢出,竖屏游戏**底部 UI(常为操作区)被裁**——与本次要修的"显示不全"同类症状,不能在修复中再引入 | 公式改容器相对:`width: min(100%, calc(100% * R))`、`height: min(100%, calc(100% / R))`(flex 容器为 fixed inset-0,宽高 definite,百分比可靠解析;数学性质与 vw/vh 版完全相同)。验收补:桌面带滚动条场景 iframe 不超出容器右缘 | Important | 是 |
| M-1 | soccer-dash"坐标取法照抄"措辞误导:touch 路径用 `event.touches[0].pageX`/`event.targetTouches[0]`(L1617/1632),鼠标事件无这些集合,字面照抄抛 TypeError;且现有 handler 用全局 `event`(L1648-1656) | 改为"坐标映射:`touches[0].pageX/pageY` → 鼠标事件 `pageX/pageY`,tween 逻辑复用",鼠标版 handler 规范带参数 | Minor | 否 |
| M-2 | 三条检索结论应回写 spec 闭环:① `Crafty.config.speed` 仅 L875 一处消费(走全局改 L829 最简路径);② aspectRatio 已在 schema 声明且 additionalProperties:true(validate 零风险);③ sync-games 不写 games.json | 补进 §4 风险对策,编码/测试阶段免重查 | Minor | 否 |
| M-3 | "键盘位移可感知"偏主观 | 量化为"按住方向键 1s 位移 ≥150px(速度 200px/s 期望约 200px)" | Minor | 否 |
| M-4 | 证据引用路径不全:all-in-one.js 实际在 `packages/games/smartphone-shooter/js/`,game.min.js 在 `packages/games/skyscraper-stack/src/` | spec 补全相对路径,方便编码/评审直达 | Minor | 否 |
| M-5 | Task 10 git add 清单含 "sitemap",spec 全文未提 sitemap 是否再生成、是否受影响 | 确认 sitemap 生成链路;无关则从提交清单移除,避免混入未评审产物 | Minor | 否 |
| M-6 | soccer-dash 方案 ④ window.focus() 在验收标准中无对应条目 | 补验证点(iframe 未点击时键盘也生效)或删掉该改动保持最小性,二选一 | Minor | 否 |

**Critical:无。**

## 三、总评

spec 诊断质量高:7 个根因的代码证据抽查**全部命中**,smartphone-shooter 的出画坐标(360/380/1138/768)可逐步复算,preserveManualPath 粘性机制、games.json 双游现状、schema 宽容性等关键前提均与代码事实一致;共性根因(横屏视口喂竖屏游戏)的治本方案数学正确、回归面经实测为零。需修订的只有:tickle 绑定点数量与选择器两处事实错误(会直接造成修复不完整/验收不可执行)、公式实现单位一处风险(移动端会复现"显示不全"症状)。3 个 Important 均为小改(预计 <15 行 spec 修订),修完即可进入编码。

## 评审轮次
- 当前:第 1 轮 / 上限 3 轮
- 历史:-
