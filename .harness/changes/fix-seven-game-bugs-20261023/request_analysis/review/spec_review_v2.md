# 需求评审报告 v2(R2 复审)

> 阶段2产出 | spec-reviewer | 评审方式:逐条对照 R1 问题清单 + 源码/脚本二次实证
> 版本递增:v1, v2, v3... 旧版本永不删除 | 轮次上限:3 轮,超出升级人工

## 评审对象
- 文件:request_analysis/spec.md(版本 v2)+ tasks.md
- 基准:R1 问题清单(3 Important + 6 Minor,见 spec_review_v1.md)+ 二次源码实证

## 本轮实证动作(复核记录)
- tickle-frenzy:grep 全游戏 `.tap(` → 仅 index4.js 一文件、精确 3 处(L82 `$(".buttons .col")` / L86 `$("#start")` / L88 `$(".retry")`);index.html:18 `<div class="intro">`(class 非 id)、L21 `<button id="start">`、L39 `<div id="go">` 均存在
- soccer-dash:grep `Crafty.config.speed` 全文件仅 L875 一处;`speed: 6` 仅 L829;坐标取法实证 L1617 `event.touches[0].pageX` / L1632 `event.targetTouches[0].pageX`(mouse 事件确无这些集合);L1645-1657 iTouch 仅绑 touch 三事件
- 平台:GameDetailPage.tsx:519-521 全屏容器确为 `fixed inset-0 bg-black z-50`(定尺寸,百分比可靠解析);build-games-list.js loadExistingGamesList 仅保护 image/thumbnail/cover 三字段、preserveManualPath 无条件保留 `/` 开头绝对路径;schema L40 `aspectRatio` pattern `^[0-9]+:[0-9]+$`("2:3"/"9:16" 均匹配)
- games.json:moon-rabbit=mmttt.png(用户手改在位)、retro=loading.png(待改),与 spec 一致
- sitemap.xml:git 跟踪文件,当前未提交修改 **+180 行 = 30 个 batch-30 游戏 URL**(本次 7 个全部 IN,另含其余 23 个);grep `scripts/`、`packages/app/scripts/`、两级 package.json 均**无 sitemap 生成链路**(纯手工维护)
- 文件路径:`packages/games/smartphone-shooter/js/all-in-one.js`、`packages/games/skyscraper-stack/src/game.min.js` 实际存在(M-4 所指真实路径)
- Task 8 回归示例游戏 `tetris` 目录存在

## 评审结论
- [ ] ✅ APPROVED -- 可进入编码
- [x] 🔄 需修改 -- 见下方问题(1 个 Important 阻塞:tasks.md 与 spec v2 的公式矛盾;其余均为 ≤1 行修订)
- [ ] ⏸ 升级人工 -- 轮次超限

---

## 一、R1 问题逐条核对(3 Important + 6 Minor)

| R1# | 要求 | v2 实际状态 | 判定 |
|---|---|---|---|
| I-1 tap 共 3 处 | spec §2 表 #7 与 §3.2 均改"三处(82/86/88)" | §3.2 ✅(3 处齐,含漏改 L88 后果说明);tasks Task 7 ✅;验收 ✅(答题/重玩按钮均覆盖)。**残留:spec §2 表 #7(L21)仍写"`js/35/index4.js:82,86`"(2 处)**,与 §3.2 自相矛盾。二次实证源码确为 3 处 | ◐ 部分闭环(功能风险已消,SSOT 内部矛盾残留 → 本轮 V2-3) |
| I-2 `.intro` 选择器 | 验收改 class 选择器 | spec §6 ✅ "click #start 后 `.intro` 覆盖层隐藏…选择器为 class 非 id";tasks Task 7 Step 3 ✅。实证 `#start` id 真实存在,验收可执行 | ✅ 闭环 |
| I-3 公式容器相对单位 | spec §3.1 与 Task 1 Step 3 均改 `min(100%, calc(100% * R))` | spec §3.1 ✅(并注明"百分比相对 fixed inset-0 容器,规避 100vw/100vh 偏差",与容器实证一致)。**tasks.md Task 1 Step 3(L18)仍为 `min(100vw, calc(100vh*R))` / `min(100vh, calc(100vw/R))`** — 编码阶段照 checklist 逐字执行会把 I-3 风险原样带回(桌面滚动条超宽右缘被裁、iOS 动态视口底部 UI 被裁,与本次所修"显示不全"同类),且现有验收项无一能拦截(headless Playwright 无经典滚动条、不模拟 iOS 动态视口)= 静默失败 | ❌ 未闭环(→ 本轮 V2-1,阻塞) |
| M-1 mouse 坐标 TypeError | 措辞改"适配 mouse 事件接口" | spec §3.2 ① ✅(明确"mouse 事件无 e.touches[0],照抄 touch 取法抛 TypeError",实证 touchMove 确用 `event.targetTouches[0].pageX`)。**tasks.md Task 6 Step 2(L60)仍写"坐标换算照抄 touch 实现"**,与 SSOT 直接矛盾——checklist 指令恰是 M-1 警告的写法。有 Task 6 Step 6 "无报错" 兜底(响亮失败)故不单独阻塞,但必须随本轮一并修 | ◐ spec 闭环 / tasks 未传导(→ 本轮 V2-2) |
| M-2 三条检索结论回写 | 补进 §4 风险对策 | ① speed 单点消费 → §3.2 ✅(二次实证仅 L875 消费,L829 定义);② schema aspectRatio 宽容 → §3.1 ✅(实证 schema L40);③ sync-games 不写 games.json → 未回写 | ◐ 2/3 闭环(残留为建议性,不阻塞) |
| M-3 位移量化 | 量化阈值 | §6 ✅ "键盘按住位移 ≥60px/秒(量化阈值)"。较 R1 建议 150px/s 宽松,但客观可判:与坏值 6px/s 拉开 10 倍、与期望 200px/s 留 3.3 倍容差(容忍帧率波动),量化目的达成 | ✅ 闭环 |
| M-4 证据路径补全 | 补 `js/`、`src/` 前缀 | 未吸收:spec §2 #5 仍 "all-in-one.js:3146-3157"、#4 仍 "game.min.js:3788-3794"(实际分别在 `js/`、`src/` 子目录,已实证)。不影响正确性,影响直达效率 | ✗ 未吸收(Minor,不阻塞,建议随本轮顺手补) |
| M-5 sitemap | 确认生成链路/从清单移除 | 未吸收,且本轮实证加重:`packages/app/public/sitemap.xml` 无任何脚本生成(纯手工),其未提交修改是 batch-30 的 +180 行(30 个 URL,含本次 7 个 + **其余 23 个**)。Task 10(L89)字面 "git add … games.json/sitemap" 会把 23 个**未提交游戏**的 URL 一并发布(线上 sitemap 指向 404),违反 spec §3.3 自身"不混入未评审产物"原则 | ✗ 未吸收(→ 本轮 V2-4,提交阶段前必须决断) |
| M-6 window.focus 验收 | 补验证点或删改动,二选一 | 未做:§3.2 ④ 保留 focus 改动,验收 §6 仍无对应条目("iframe 未点击时键盘也生效") | ✗ 未吸收(Minor,不阻塞,二选一即可) |

**R1 结论对照:3 Important 中 1 个完全闭环(I-2)、1 个部分闭环(I-1,残留 1 处陈旧引用)、1 个 spec 闭环但未传导到 tasks.md(I-3);6 Minor 中 1 闭环(M-3)、2 部分闭环(M-1/M-2)、3 未吸收(M-4/M-5/M-6)。**

## 二、修订是否引入新问题

逐段核对 v2 新增文字(容器相对单位说明、TypeError 警告、tap 3 处、阈值 60px/s、schema/additionalProperties 引用),**与源码事实全部一致,无新的事实错误**。唯一"新问题"是修订不彻底造成的 spec ↔ tasks 矛盾(V2-1/V2-2):spec.md 已改对、tasks.md 未同步——属传导缺失而非内容错误。

## 三、本轮问题清单

| # | 问题描述 | 建议 | 优先级 | 是否阻塞 |
|---|---|---|---|---|
| V2-1 | tasks.md Task 1 Step 3(L18)公式仍为 `min(100vw, calc(100vh*R))`/`min(100vh, calc(100vw/R))`,与 spec §3.1 容器相对单位直接矛盾。编码按 checklist 逐字执行会重新引入 I-3 风险,且现有验收(Playwright 多视口)无法拦截——headless 无经典滚动条、不模拟 iOS 动态视口,属静默失败 | 改为 `width: min(100%, calc(100% * R))`、`height: min(100%, calc(100% / R))`(与 spec §3.1 逐字一致,并注明"百分比相对 fixed inset-0 容器");可顺带在 Task 8 补一条"iframe rect 不超出全屏容器 rect"断言作廉价防线 | Important | **是** |
| V2-2 | tasks.md Task 6 Step 2(L60)"坐标换算照抄 touch 实现"与 spec §3.2 ① 的 TypeError 警告直接矛盾(checklist 指令恰是被禁止的写法) | 改为"坐标映射:`touches[0]/targetTouches[0].pageX/pageY` → mouse 事件 `pageX/pageY`,tween 逻辑复用" | Important | 否(Task 6 Step 6 "无报错" 可兜底,但须随本轮修) |
| V2-3 | spec §2 表 #7(L21)仍写 "`js/35/index4.js:82,86`"(2 处),与 §3.2/tasks/验收的 3 处口径自相矛盾 | 改为 "`js/35/index4.js:82,86,88`"(一行) | Minor | 否 |
| V2-4 | Task 10 提交清单含 sitemap:实证为手工维护文件,未提交修改是 batch-30 的 30 个 URL(含 23 个未提交游戏),字面 add 会发布 23 条死链,违反 spec §3.3 | sitemap 从本次 git add 清单移除(归属 batch-30 接入变更),在 Task 10 注明"sitemap.xml 的 batch-30 修改不在本次提交范围";或经用户明确确认后再定 | Minor | 否(编码/测试不涉及,但 Task 10 执行前必须清晰) |
| V2-5 | M-6 二选一未做:§3.2 ④ window.focus() 保留但验收无对应条目 | 补验收"iframe 未点击状态下按键即生效",或删 ④ 保持最小性 | Minor | 否 |
| V2-6 | M-4 未吸收:all-in-one.js / game.min.js 引用缺 `js/`、`src/` 路径前缀;M-2③(sync-games 不写 games.json)未回写 | 顺手补全路径与一句风险备注(合计 3 行,非必须) | Minor | 否 |

**Critical:无。**

## 四、总评

spec.md v2 对 R1 三项 Important 的**方案层修复全部正确**:容器相对公式(且容器定尺寸前提经实证成立)、.intro 选择器、tap 3 处与 mouse 坐标警告均与源码二次实证一致,位移阈值量化达标,修订未引入任何新的事实错误。问题出在**修订未传导到 tasks.md**:Task 1 Step 3 仍是 100vw/100vh 公式(与 spec 逐字矛盾,照单执行会静默重新引入本次要修的"显示不全"症状,且验收拦不住)、Task 6 Step 2 仍保留"照抄 touch"措辞,另 sitemap 经实证已从"待确认"升级为"应明确移出本次提交"。全部修订合计 <10 行、无任何方案推翻——修完 V2-1(阻塞)与 V2-2~V2-5(随行)即可进入编码。

## 评审轮次
- 当前:第 2 轮 / 上限 3 轮
- 历史:v1 NEEDS_REVISION(spec_review_v1.md,3 Important + 6 Minor)
