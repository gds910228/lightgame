# 代码评审报告 v2(R2 复审)

> 阶段4产出 | code-reviewer 专项子代理(只评审,不改源码)
> 版本递增:v1, v2... 旧版不删 | 轮次上限:2 轮,超出升级人工
> 评审日期:2026-10-23 | Base SHA:d8dece9 → 工作区未提交 diff + untracked 游戏目录
> 复审对象:R1(NEEDS_REVISION,Critical=0 / Important=2)处置后的文档/取证产物 + 顺手吸收的 M-3 代码改动

## 评审结论

- [x] ✅ **APPROVED**

**判定说明**:R1 的两项 Important(I-1 公式描述失真、I-2 取证未落盘)均已实质闭环并经评审者逐项核验;R1 闭环路径明示"两项完成后无需源代码改动,确认文档即转 APPROVED",本轮据此复核通过。R1 之后新增的唯一代码改动(soccer-dash mousedown `e.preventDefault()`,吸收 R1 M-3)经结构分析 + 评审者独立 Playwright 实测证明**零副作用**。门禁由评审者复跑全绿(tsc / validate 82 / sync IN SYNC)。剩余为非阻塞 Minor(见 §遗留)。

## R1 问题闭环核验

### I-1:spec §3.1 与 coding_report 公式描述 ↔ 实际实现 —— ✅ 已闭环

**三方一致性核对(spec ↔ 代码 ↔ 报告):**

| 核对项 | spec.md §3.1(L30) | 代码(GameDetailPage.tsx) | coding_report_v1.md | 一致 |
|---|---|---|---|---|
| 公式 | `width: min(100cqw, calc(100cqh * R))`、`height: min(100cqh, calc(100cqw / R))` | L161-162 同式(R=parseAspectRatio 的 w/h) | 改动清单第 3 条同式 | ✅ |
| 容器 | `containerType:'size'` | L553 `style={{ containerType: 'size' }}` | 记载 | ✅ |
| 居中/黑边 | flex 居中、bg-black | L552 `flex items-center justify-center` + `bg-black` | 记载 | ✅ |
| 退化行为 | 不支持 cqw → 整条声明 invalid → 退回 w-full h-full | L566 `className="w-full h-full"` + L574 内联 style 覆盖,undefined 时回落(CSSOM 丢弃非法声明,类名兜底) | 记载 | ✅ |
| 无 aspectRatio 游戏 | 零回归(实测 DOM 逐属性零变化) | aspectFitStyle=undefined → spread 无操作 | 记载 | ✅ |

**演进记录如实性**:spec §3.1"公式演进记录(v2 修订)"明确标注——百分比方案系 R1/R2 评审建议、经 Playwright 实测数学不成立(width/height 内百分数各按本轴解析、无法跨轴约束,1280×720 配 2:3 得 853×720 而非 480×720),最终换用 cqw/cqh。**未粉饰评审自身先前的错误建议,如实归档**——这正是 R1 要求的 errata 姿态。coding_report"验证迭代记录"按 R1→R4 完整记录了"gameService 丢字段 + 百分比公式错误 → cqw/cqh"的偏离链,SSOT 链无断点。

**数学独立复算**(评审者):R=2/3 → min(1280, 720·⅔)=480 / min(720, 1280÷⅔)=720 → **480×720**;R=9/16 → **405×720**。与 spec/验证报告记载的实测值逐位吻合。

**M-1(兼容下限文档化)随闭环覆盖**:spec §3.1 退化语句即 R1 闭环路径要求的"顺带覆盖 M-1",Chrome 105+/Safari 16+/FF 110+ 以下退化为修复前铺满行为、非灾难。✅

### I-2:Playwright 取证落盘 —— ✅ 已闭环

**`coding/verification_report_v1.md` 核验**(R1 建议路径为 `coding/verify/playwright_rounds.md`,作者落点不同但实质等同,不构成偏差):

1. **轮次完整**:轮次概览表覆盖 R1(6P/4F)→ R2(5P/1F)→ R3(1F)→ R4(全 PASS),每轮含触发条件与发现——失败轮同样如实记录,不是只贴终态。
2. **逐项结论+证据**:15 行结果表(A1/A2、B1/B2、C1-C4、D1-D3、E、F1/F2、G),每行有量化证据:rect=(0,0,1280x720)、iframe 480x720@x=400 / 405x720@x=437.5、visibleSize=320x480、像素差 93.56%/83.89%~94.02%、派发坐标逐位吻合 (291,324) 等、钳制 225.75/16.5/372.5、tween 98→203、速度 ~210-220px/s、pageerrors=[]。
3. **证据可追溯**:报告头部声明脚本/截图位于 `%TEMP%\lgverify\`(r2_*/r3_*/r4_*、shots2~4)与 `%TEMP%\ss-*`;**评审者实证该目录存在**且文件名与报告引用一致(a_~f_ 主脚本、r2_c1~c8/r3_c1* 迭代脚本、ss-c1~c4 截图)。仓内持久层(报告数值/断言表)+ 仓外过程层(脚本/截图)双层结构满足 R1"落盘+最小断言表"要求。
4. **smartphone 三层 bug 链附录**与代码实况吻合(评审者抽查:L2382 `А.target.tagName` 读第 3 参、L2389-2395 `if (!U) return` 守卫、构造器 config 拷贝均在)。

### R1 后新增代码改动:soccer-dash mousedown preventDefault(吸收 M-3)—— ✅ 无副作用

**结构分析(问题 3 的两个子问)**:

1. **按钮不在 #cr-stage 内**:`#_gamestart`(index.html:756)、`#_gamestart2`(:783)、`#_gamerule`(:755)、gameover 三按钮(:803-805)均为 `#cr-stage`(:818)的 **DOM 兄弟**(CSS 定位覆盖层),不是后代。mousedown 监听只挂在 `#cr-stage`(:1669),按钮交互的事件根本不会流经该监听器 → preventDefault 对按钮路径**零接触**。#cr-stage 内后代仅 interface/.life、#gamescore、#gametest、空 scale div、canvas,均无 click 处理器(grep 实证仅 .show()/.hide()/.text() 展示性操作)。
2. **即使在内也不阻断 click**:按 UI Events 规范,cancel mousedown 的默认动作只取消文本选区启动/焦点切换/拖拽启动;click 是 mouseup 后**独立派发**的事件,不是 mousedown 的默认动作——cancel mousedown 不抑制 click 合成。且 preventDefault ≠ stopPropagation,Crafty 自身挂载的任何监听器照常收到事件。

**评审者独立实测**(脚本 `%TEMP%\lgverify\r2_review_soccer.py`,dev server localhost:3000,public 同步副本,截图 r2_review_soccer.png):

| 断言 | 结果 |
|---|---|
| preventDefault 后 click 合成(游戏进行中于 #cr-stage mousedown→mouseup,探针计数) | **click_fired=1 —— click 正常合成** |
| `#_gamestart` 开始按钮(在 #cr-stage 外)端到端 | curtain 隐藏 ✅ |
| `#_gamestart2` Continue 端到端 | guide/countdown 走完并移除,进入玩法(Player 存在且可驱动)✅ |
| 鼠标拖动玩家(改动所在路径) | Player x 113.75 → 202 ✅ |
| 拖动期间无文本选区 | getSelection().isCollapsed=true ✅ |
| pageerror | **[]** ✅ |

## 评审者独立复跑(非转述)

| 取证项 | 命令/方法 | 结果 |
|---|---|---|
| TS 类型 | `cd packages/app && npx tsc --noEmit` | exit 0 |
| 游戏校验(R1 后代码变更+重 sync 之后) | `node scripts/validate-games.js` | **82/82 通过** |
| 源↔public 同步(soccer-dash) | `diff -rq` | IN SYNC,preventDefault 双端一致(:1670) |
| games.json aspectRatio | python 逐条 | 82 游戏;peach 2:3 / skyscraper 2:3 / smartphone 9:16 / soccer 2:3,与 metadata 声明一致 |
| 平台 diff 范围 | `git diff d8dece9 --stat` | 仅 types/gameService/GameDetailPage 三文件,+42/-6,与 R1 评审范围一致(游戏目录 untracked,同 R1) |
| 三处游戏修复仍在位 | grep | tickle `.tap(`=0;smartphone 过滤器/守卫在位;peach `-50%`=0 |
| soccer preventDefault 副作用 | Playwright(上表) | 全过 |

## 遗留(全部非阻塞,不构成 NEEDS_REVISION 依据)

| # | 项 | 说明 | 建议 |
|---|---|---|---|
| MR2-1 | summary.md(SSOT)滞后 | §2 阶段3仍 🔄(coding_report 已标 DONE)、阶段4轮次 0/2(实际 1/2→本轮 2/2);§3 门禁 lint/build/validate 行空白;§8 文件清单缺 verification_report_v1.md;§7 未补"Playwright 取证须归档"教训候选(R1 I-2 的附带建议) | Task 10 推送前刷新 SSOT(分钟级);§7 教训候选建议照补 |
| MR2-2 | 计数标签瑕疵 | verification_report 标题"三轮"实际记录 4 轮执行(R1 初测 + 3 轮修复迭代);coding_report R4 行"15 项验证 + 3 项回归"实际为 12 项游戏验证 + 3 项回归 = 15 行 | 表格本身完整如实,仅措辞;后续版本顺手修正 |
| MR2-3 | 过程证据位于 %TEMP% | 脚本/截图在临时目录,系统清理后不可追溯(仓内报告数值已自足) | 体系性改进:后续变更目录建议在 .harness/changes/{id}/coding/verify/ 归档关键脚本与截图 |
| R1 遗留 Minor | M-2(peach 封面 SSOT 漂移)、M-4(soccer 舞台 letterbox 内未居中)、M-5(swallow 类型冗余)、M-6(smartphone Z.end 提升) | R1 已判定非阻塞,本轮未见恶化 | 留存待办,后续批次处理 |

## 门禁核对表

- [x] Critical = 0
- [x] Important = 0(R1 I-1/I-2 均闭环核验)
- [x] `npx tsc --noEmit` exit 0(评审者复跑)
- [x] `validate:games` 82/82(评审者复跑,覆盖 R1 后新增代码改动)
- [x] 源↔public IN SYNC(评审者复跑)
- [x] manualChunks/iframe 域/CSP/vercel.json 未触碰(git diff 复核)
- [x] 新增改动(preventDefault)副作用实测为零

## 评审轮次

- 当前:第 2 轮 / 上限 2 轮 → **本轮终审 APPROVED**
- 历史:v1(2026-10-23)NEEDS_REVISION:Critical=0 / Important=2(文档/流程),源代码零必改项
