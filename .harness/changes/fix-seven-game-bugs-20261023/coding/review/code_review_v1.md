# 代码评审报告 v1

> 阶段4产出 | code-reviewer 专项子代理(只评审,不改源码)
> 版本递增:v1, v2... 旧版不删 | 轮次上限:2 轮,超出升级人工
> 评审日期:2026-10-23 | Base SHA:d8dece9 → 工作区未提交 diff + untracked 游戏目录

## 评审结论

- [x] 🔄 **NEEDS_REVISION(仅限文档/取证产物,源代码零必改项)**

**判定说明**:源代码层面 Critical=0、代码级 Important=0,三处交互修复与平台 letterbox 实现经逐行验证均正确(依据见 §4/§5)。但存在 2 项 Important 级**流程/文档**问题(I-1 spec 与编码报告描述的公式与实际实现不符且原公式数学上错误;I-2 Playwright 三轮取证结论未落盘)。按门禁"Critical=0 且 Important=0 才可合入",需先闭环这两项(均为分钟级文档工作,不动代码),再行合入。

## 评审范围与独立取证

评审者本人复跑/核验(非转述编码方结论):

| 取证项 | 命令/方法 | 结果 |
|---|---|---|
| TS 类型 | `cd packages/app && npx tsc --noEmit` | exit 0(独立复核通过,`containerType` 内联样式合法) |
| games.json 完整性 | python 脚本对比 HEAD↔工作区全部字段 | 52 存量游戏零字段漂移、零丢失,新增 30(batch-30),人工封面(moon-rabbit mmttt.png 等)全保留 |
| Crafty Moved 载荷 | grep `soccer-dash/lib/crafty.min.js` | 实证 `trigger("Moved",{axis,oldValue})`,修复的载荷读取正确 |
| Toucher 派发链 | 通读 all-in-one.js L290-360(aC/c 派发)+ L414-650(基类/子类) | Н 过滤器第 3 参=event、İ 处理器第 3 参=touches,与修复代码逐位吻合 |
| Zepto tap 实现 | grep tickle-frenzy js/35/zepto.js | tap 为 touchend 合成事件,桌面端永不触发;`.on('click')` 修复方向正确 |
| 源↔public 同步 | `diff -rq` 7 个游戏目录 | 全部 IN SYNC |
| schema | 检查 metadata.schema.json | `aspectRatio` 已定义(pattern `^[0-9]+:[0-9]+$`),4 个 metadata 值合法 |
| retro 封面文件 | 检查源/public 两端 jpeg 存在性 | 均存在;metadata 与 games.json 路径一致;preserveManualPath 机制可保不被 build 重置 |

## 问题清单

| # | 位置 | 问题描述 | 建议 | 优先级 | 阻塞 |
|---|---|---|---|---|---|
| I-1 | `.harness/changes/fix-seven-game-bugs-20261023/coding/coding_report_v1.md:17`、`request_analysis/spec.md:29` | 两份阶段产物仍描述 `width: min(100%, calc(100% * R))` 百分比公式,而实际实现是 cqw/cqh 容器查询单位。**该百分比公式本身数学错误**:CSS 中 `width` 里的两个百分数都按容器**宽**解析,`min(100%, 100%*R)` = `min(W, W·R)`,永远不受高度约束——1280×720 容器配 R=2/3 会得到 853×720(比例 1.185)而非 480×720。spec_review_v2 把 vw/vh 改成 % 只修了"视口偏差"没修"跨轴约束"。编码者正确地偏离并换用 cqw/cqh(代码注释 L152-156 已说明理由,实测 405x720=720×9/16 吻合),但 SSOT 链上无人记录这次偏离 | 在 coding_report 追加 v2(或修订条目)记录"实现由 % 公式改为 cqw/cqh + 原因";spec.md §3.1 加 errata。否则未来维护者按 spec"改回"百分比公式会**静默重新引入显示不全 bug** | Important | 是(文档) |
| I-2 | `.harness/changes/fix-seven-game-bugs-20261023/`(整个目录) | 三轮 Playwright 全项 PASS 的取证**未归档**——目录内仅有结论引用(tasks.md/spec.md 提及),无报告/截图/断言输出文件。batch-30 先例同样未归档,属体系性缺口,但本项目铁律"完成前必须跑命令取证(禁'应该过')"要求产物可审计 | 将评审输入中的"已知验证结论"(7 游戏 + 回归 + 封面,含视口、关键断言、PASS 判定)整理落盘为 `coding/verify/playwright_rounds.md`;并在 summary.md §7 教训区补"Playwright 取证须归档"候选 | Important | 是(流程) |
| M-1 | `packages/app/src/pages/GameDetailPage.tsx:161-162` | cqw/cqh 浏览器门槛 Chrome 105+/Safari 16+/FF 110+;不支持时 CSSOM 静默丢弃 width/height 声明 → 退回 Tailwind w-full h-full(旧行为=裁切回归)。属**优雅降级**(2026 年 4 年前旧浏览器占比可忽略,且降级=修复前现状而非崩溃),但兼容下限未见文档化 | 在 spec errata 或 GameDetailPage 注释中补一行兼容下限说明,供后续接游戏时知悉 | Minor | 否 |
| M-2 | `packages/games/peach-catch-frenzy/metadata.json:7-8` vs `packages/app/public/games.json`(peach 条目) | 封面 SSOT 漂移:metadata 声明 `images/island.png`,games.json 实际 `images/0begin.png`(两文件都存在,不 404)。系 batch-30 遗留(findCandidateImage 选图早于 metadata 后补),非本次引入;preserveManualPath 对绝对路径无条件保留,漂移将永久固化 | 后续批次把 metadata 对齐到实际生效的 0begin.png(或反向),消除 SSOT 分叉。本次不阻塞 | Minor | 否 |
| M-3 | `packages/games/soccer-dash/index.html:1669-1681` | 鼠标路径 mousedown/mousemove 未 `preventDefault()`,拖拽时可能选中文本(score 等 DOM 文本);原 touch 路径(touchMove)有 preventDefault,鼠标路径语义不对齐 | mousedown 内加 `e.preventDefault()`(或 #cr-stage 加 `user-select:none`) | Minor | 否 |
| M-4 | `packages/games/soccer-dash/index.html`(整体) | 320×480 的 #cr-stage 在 480×720 letterbox iframe 内仍左上锚定,右侧 160px/下侧 240px 露绿色背景(#13a438)。交互与逻辑无碍(实测鼠标 tween 跟随正确),纯观感 | 后续可给 #cr-stage 加居中;本次不阻塞 | Minor | 否 |
| M-5 | `packages/app/src/pages/GameDetailPage.tsx:34` | `swallow` 参数类型 `Promise<void> \| undefined \| void` 中 `undefined` 与 `void` 冗余 | 可简化为 `Promise<void> \| void`(纯 nit,不影响正确性) | Minor | 否 |
| M-6 | `packages/games/smartphone-shooter/js/all-in-one.js:~616`(Z.end) | 既有问题(非本次 diff 引入):`this.В(V, Y, f, Κ, d)` 在 V/Y 声明前使用,var 提升为 undefined;但目标 В 为 no-op 配置,实际无害。记录备查,无需动作 | 不处理;若后续解压还原代码可顺带修 | Minor | 否 |

> 门禁:Critical=0 且 Important=0 才可合入。当前 I-1/I-2 未闭环 → 本轮 NEEDS_REVISION。Minor 记录待办。

## 逐评审要点结论

### 要点 1:正确性 — 全部通过

| 改动 | 结论 | 依据 |
|---|---|---|
| types/index.ts `aspectRatio?: string` | ✅ 正确 | 可选字段,注释清楚,消费方仅 GameDetailPage |
| gameService.ts 条件 spread | ✅ 正确 | `...(isString(raw.aspectRatio) ? {aspectRatio} : {})`,TS 支持,tsc 独立复核 exit 0 |
| parseAspectRatio 正则 | ✅ 边界完备 | `^(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)$`:拒绝空串/`2:`/`2/3`/负数;`w>0&&h>0` 拒 `0:3`;trim+内部空格容忍;parseFloat 于匹配数字串不可能 NaN(防御冗余但无害);schema pattern(纯整数)是它的子集 |
| aspectFitStyle(cqw/cqh) | ✅ 数学正确 | `width: min(100cqw, 100cqh·R)`、`height: min(100cqh, 100cqw/R)` 严格等比内接;实测 9:16@1280×720 → 405×720=720×9/16 精确吻合;inline style 覆盖 Tailwind w-full/h-full(优先级正确) |
| 全屏容器 flex + containerType:'size' | ✅ | 见要点 2 回归分析 |
| requestFullscreen swallow | ✅ | `Promise.resolve(p).catch()` 同时覆盖 Promise 返回(标准)与 void 返回(旧 webkit),消除 unhandled rejection |
| peach 删 top:-50% | ✅ 根因行 | `#middle[id]`(特异度 0,1,1)全面覆盖基类 `#middle` 的 absolute/top:50%,display:table-cell 垂直居中生效后,container 残留的 relative `top:-50%` 把画面整体上移半屏——删除正确;全目录 grep 无 `-50%` 残留 |
| 4 个 metadata aspectRatio 数值 | ✅ 与实际画面比一致 | peach 480×720、skyscraper canvas 320×480、soccer 320×480 均=2:3;smartphone 9:16(实测 405×720 吻合) |
| smartphone extend 构造器拷贝 config | ✅ | 原构造器只拷贝 `İ` 注册表(实证注册表 `Toucher.Ρ` 全文件零写入=恒空),config 整体丢失 → tap 处理器/过滤器/长按配置全数为原型空桩,这是交互失效根因;补拷贝后 config 键按预期覆盖原型桩 |
| smartphone tap 入口 `if(!U) return` 守卫 | ✅ 必要且充分 | 注册链 `b.c(J)` → `J.İ()` 无参调用(基类 init 钩子被实例 İ 覆盖);真实 tap 经 aC 保证 `u.length>0` 才派发 → U 恒非空数组。跳过的基类 init(`this.Β(); this.Сs()`)对该实例均为 no-op(无 config 覆盖、原型为空函数),无副作用 |
| smartphone Н 过滤器读第 3 参 | ✅ 参数位正确 | 核心派发 `aC(Κ,_,q,this)` → `Е.Еc(Κ,_,q,this)` → `this.Н(相位, touch, **event**, controller)`;`А.target.tagName=="CANVAS"` 正确读 event |
| soccer speed 6→200 | ✅ 影响面收敛 | grep 全文件 `config.speed` 仅 L875 一处消费(movementSpeed);球速/AI/滚动用 acceleration 与各自常量,不受影响;6px/s≈0.1px/帧 不可感知,200 是合理恢复 |
| soccer Moved 载荷修复 | ✅ 与 bundled Crafty 实证一致 | crafty.min.js 原文:`this.trigger("Moved",{axis:"x"/"y",oldValue:...})`;旧 from.x/from.y → attr 写 undefined → NaN 级联,修复正确;attr 恢复不触发 Moved(仅 Motion 积分触发),无递归;`attr({x:this.x})` 同值写无副作用 |
| soccer movePlayer 抽取+鼠标路径 | ✅ | mousemove 用 `getBoundingClientRect()` 换算 stage 相对坐标,规避 mouse 事件无 touches[0] 的 TypeError;mouseDown 标志防 hover 误触;document 级 mouseup 兜底窗口外释放;mouseup 复用 touchEnd(射门)且 touchEnd 不读 event 参数,传 null 安全 |
| soccer begin click 加 window.focus() | ✅ | 位于用户点击手势内调用(iframe 聚焦合法路径),键盘无需先点画面 |
| tickle .tap→.on('click') ×3 | ✅ | bundled Zepto 的 tap 是 touchend+setTimeout 合成事件,桌面端(无 touch 序列)永不触发=根因;全文件 grep 无 `.tap(` 残留;`O(e)` 的 `e==s` 松散等号兼容 data-index 字符串(既有行为) |
| retro 封面定向修正 | ✅ 且抗重置 | metadata(`Public/upload/6177/53fe872815c9a.jpeg`)与 games.json 一致;jpeg 源/public 双端存在;`preserveManualPath` 对绝对路径无条件保留 + build-games-list 的 loadExistingGamesList 机制,build 重跑不回退(编码报告已双轮 build 实证,本次评审者复核机制代码成立) |

### 要点 2:回归风险 — 未发现代码级回归

1. **无 aspectRatio 游戏零变化**:`aspectFitStyle` 为 `undefined` 时 iframe style 仍为 `{backgroundColor:'#000'}`(spread undefined 无操作),DOM 渲染输出与改前逐属性一致;容器类名 `hidden`↔`flex items-center justify-center` 仅在 isFullScreen 分支变化,flex 下唯一 in-flow 子元素 iframe 的 `w-full h-full`(width/height:100%)在定高 fixed 容器内解析不变,tetris/snake 实测铺满佐证。
2. **containerType:'size' 对 absolute 子元素**:size containment 隐含 layout containment,会使容器成为 abs/fixed 后代的 containing block——但该容器本就 `position:fixed`,改前改后同为 containing block,加载指示器/退出按钮/成就 toast(均为 absolute)无任何定位变化;size containment 要求容器尺寸不依赖内容,`fixed inset-0` 尺寸来自视口,成立;非全屏时 display:none,containment 空转。
3. **cqw/cqh 退化**:不支持 cq 单位的浏览器(CSL setters 静默丢弃非法值)→ width/height 声明失效 → 回落 Tailwind w-full h-full = 修复前的铺满(裁切)行为。降级路径安全,代价是旧浏览器无 letterbox(见 M-1 文档化建议)。
4. **gameService**:条件 spread 语法 TS 原生支持(tsc 复核);gamesCache 为页面生命周期缓存,语义不变——旧数据(无 aspectRatio 字段的 games.json)自然回落铺满,无兼容分支需求。
5. **kR.extend 影响面**:注册表 `Toucher.Ρ` 恒空;子类 АE/Ι/P5/Z 中实例化点仅 Ι(L2376)/Z(L2415)(X 控制器 L2355 是独立构造器,自带 config 拷贝,不受影响);config 键(Н/start/k/İ/В/F/Ν/G)覆盖原型同名桩正是修复目的,语义逐一核过(İ 覆盖基类 init 钩子见要点 1);АE/P5 无实例化点,零影响。
6. **soccer speed 200**:twoway(L1473)复用 `player.movementSpeed`(=200+ceil(level/2) 载入时求值),射门关横移 200px/s 过 320px 场地约 1.6s,实测钳制正常;球速/门将 AI 无 config.speed 依赖(grep 实证)。Moved 钳制边界:四条件为原逻辑保留,仅修载荷读取;逐轴恢复、无递归、无 NaN。
7. **tickle 双触发**:触摸设备上 tap 后浏览器派发**一次**原生 click;合成 tap 监听已全部移除,不存在 tap+click 双路径;viewport 含 `width=device-width, user-scalable=no`,现代移动端无 300ms click 延迟,10 秒反应玩法不受损。

### 要点 3:代码质量 — 通过

- **TS strict / 无裸 any**:全 diff 无 any;tsc 独立复核 exit 0(含 `containerType` 内联样式与条件 spread)。
- **注释**:三处游戏侧修复注释(all-in-one.js L426-430/L2384-2386、soccer L829/L898-900/L1665-1667)准确解释"为什么"(最小修改下的根因陈述),对混淆代码考古有实值;平台侧 aspectFitStyle 注释讲清了 % 单位为何不可跨轴——这条注释正是 I-1 的正确答案,应回写到 spec/报告。
- **命名/分层**:`parseAspectRatio`/`aspectFitStyle`/`swallow` 达意;改动严格落在 types/services/pages 分层内,未越层。
- **风格一致性**:平台文件本就中英注释混用,新增英文注释不突兀;游戏文件保持原注释语言。
- **manualChunks/iframe/CSP/vercel.json**:均未触碰,硬约束自查与 diff 一致。

### 要点 4:验证充分性 — 结论与代码逻辑自洽,但产物未归档(I-2)

- 抽查自洽的实证:Moved 载荷 ↔ crafty.min.js 源码;Н 参数位 ↔ aC 派发源码;405×720 ↔ min() 数学;桌面 tap 失效 ↔ Zepto touch 模块实现;games.json 存量 52 游戏零字段漂移 ↔ preserveManualPath 机制;7 游戏源↔public diff 全 IN SYNC ↔ sync-games 执行。
- tsc 由评审者独立复跑(exit 0);lint/build/validate 82 采用编码方结论(Task 9 门禁将继续复跑)。
- 缺口:三轮 Playwright 的断言明细与截图不在变更目录任何位置(batch-30 先例同样缺失),审计链断在"对话记录"——I-2。

## 门禁核对表(模板维度)

- [x] TS 类型完整,无裸 any(tsc exit 0,评审者复核)
- [x] 命名/分层合规
- [x] iframe 仅 1games.io(未触碰)
- [x] CSP 未引入外域(未触碰 vercel.json)
- [x] 无 innerHTML/dangerouslySetInnerHTML 新增
- [x] manualChunks 未设(未触碰 vite.config.ts)
- [x] 图片已优化(retro 换 640×960 彩色 jpeg 替代 184×92 近灰度图)
- [x] Context 未新增订阅
- [x] `npx tsc --noEmit` 通过(评审者复跑);lint/build/validate:编码方报告 PASS(82/82),Task 9 复核
- [ ] Critical=0 且 Important=0:**未满足(I-1/I-2)** → 本轮 NEEDS_REVISION

## 闭环路径(下一轮转 APPROVED 的条件)

1. I-1:spec.md §3.1 加 errata + coding_report 补记 cqw/cqh 偏离(含 % 公式错误原因与兼容下限,顺带覆盖 M-1)。
2. I-2:Playwright 三轮结论落盘 `coding/verify/playwright_rounds.md`(可含最小断言表)。
3. 以上两项完成后无需源代码改动,下轮评审确认文档即转 APPROVED。

## 评审轮次

- 当前:第 1 轮 / 上限 2 轮
- 历史:-
