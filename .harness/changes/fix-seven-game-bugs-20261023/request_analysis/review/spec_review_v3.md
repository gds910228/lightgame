# 需求评审报告 v3(R3 终审)

> 阶段2产出 | spec-reviewer | 评审方式:逐条对照 R2 问题清单 + grep/源码/git 三重实证(不采信修订声称)
> 版本递增:v1, v2, v3... 旧版本永不删除 | 轮次上限:3 轮,超出升级人工

## 评审对象
- 文件:request_analysis/spec.md(作者第二轮修订版)+ tasks.md(同批修订)
- 基准:R2 问题清单(V2-1 阻塞 + V2-2~V2-6 随行,见 spec_review_v2.md)

## 本轮实证动作(复核记录)
- **grep 修订痕迹**:`100vw|100vh` 在 spec/tasks 中仅存于 spec §3.1 解释性文字("规避 100vw/100vh 偏差",说明为何不用的原因,非公式本身);`照抄` 在 tasks 中仅存于 L60 警告语(否定式:直接照抄会抛 TypeError);`sitemap` 在 tasks 中仅存于 Task 10 的移出说明;`index4.js:82` 在 spec 中命中 2 处均为 `82,86,88` 三处口径
- **源码行号终审抽查(全部精确命中)**:peach `index.html:46` 内联 `top:-50%` ✅;tickle `js/35/index4.js` L82 `$(".buttons .col").tap` / L86 `$("#start").tap` / L88 `$(".retry").tap` 三处 ✅;soccer-dash `index.html` L829 `speed: 6` / L875 `movementSpeed: Crafty.config.speed + ...` ✅;smartphone-shooter `js/all-in-one.js:3146-3157` `U=(this.height-400>>1)-100` + 按钮画在 `U+500` ✅;skyscraper `src/game.min.js:3788-3794` `cc.winSize` 误用 ✅;`GameDetailPage.tsx:519-543` 全屏层仍为 `fixed inset-0` + iframe `w-full h-full`(未动,待编码)✅;`build-games-list.js:207-223` preserveManualPath 对 `/` 开头无条件保留、日志文案与 Task 2 Step 2 期望一致 ✅
- **games.json 现状**:moon-rabbit image/thumbnail 均为 `/games/moon-rabbit-jump/mmttt.png`(用户手改在位)、retro 仍为 loading.png(待改)、总数 82——spec 前提未漂移 ✅
- **git 工作区实证**:`M packages/app/public/games.json`、`M packages/app/public/sitemap.xml`、`M package-lock.json`、`D wiki/项目摸底报告.md`,30 个游戏目录 untracked——spec §1"尚未提交"前提与 §3.3 遗留变更隔离清单均与实际一致;sitemap.xml 确有未提交修改,印证 Task 10 移出决策的事实基础

## 评审结论
- [x] ✅ APPROVED -- 可进入编码
- [ ] 🔄 需修改
- [ ] ⏸ 升级人工 -- 轮次超限

---

## 一、R2 问题逐条核对(V2-1 阻塞 + V2-2~V2-6 随行)

| R2# | 要求 | 修订后实际状态(实证) | 判定 |
|---|---|---|---|
| **V2-1(阻塞)** | tasks Task 1 Step 3 公式改容器相对单位,与 spec §3.1 逐字一致 | tasks.md L18:iframe style 有 R 时 `width: min(100%, calc(100% * R))`、`height: min(100%, calc(100% / R))`(百分比相对 fixed inset-0 容器,与 spec §3.1 一致);无 R 保持 w-full h-full。**与 spec §3.1 逐字一致**,grep 证明两文件均无 vw/vh 公式残留(仅 spec §3.1 保留"为何规避 vw/vh"的说明,属正确论证非矛盾)。R2 附带建议的"Task 8 补 iframe rect 不超出容器断言"为可选强化("可顺带"),未加不构成未修复 | ✅ 闭环 |
| V2-2 | tasks Task 6 Step 2 删除"照抄 touch"措辞 | tasks.md L60:"复用 touchMove 的 tween 逻辑(**坐标取法适配 mouse 事件接口**——mouse 事件无 e.touches[0],直接照抄会抛 TypeError)"。grep 实证"照抄"仅存于警告语否定式用法,checklist 指令与 spec §3.2 ① 同口径 | ✅ 闭环 |
| V2-3 | spec §2 表 #7 改三处口径 `82,86,88` | spec.md L21:`js/35/index4.js:82,86,88`;§3.2(L42)三处含后果说明;tasks Task 7、验收 §6 同口径。源码实证确为 L82/86/88 三处 .tap。SSOT 内部矛盾消除 | ✅ 闭环 |
| V2-4 | sitemap.xml 移出本次提交并在 Task 10 注明 | tasks.md Task 10(L89):"**不含 sitemap.xml**——纯手工文件且含 23 个未提交游戏的死链,移出本次提交;不混入 wiki/package-lock/其余 23 游戏"。git 实证 sitemap.xml 确为已跟踪且带未提交修改,移出决策有事实依据且理由准确 | ✅ 闭环 |
| V2-5 | M-6 二选一:补验证点或删 ④ | 选择了"补验证点":tasks Task 6 Step 4(L62)"验证点:Playwright 进游戏后直接 keyboard.down 方向键即位移(证明无需先点页面获取焦点)"——精确对应"iframe 未点击时键盘也生效",可执行、可取证。验证点落在 tasks(执行层)而非 spec §6(汇总层),形式残留但实质闭环,编码/测试阶段按 checklist 必然执行 | ✅ 闭环 |
| V2-6(非必须) | 补 all-in-one.js/game.min.js 路径前缀;回写 M-2③ | 未吸收:spec §2 #4/#5 仍无 `src/`、`js/` 前缀(本轮实证两文件真实存在且行号准确,不影响正确性);M-2③(sync-games 不写 games.json)仍未回写 spec §4。R2 已定性"合计 3 行,非必须" | ✗ 未吸收(非阻塞,见遗留项) |

**R2 结论对照:阻塞项 V2-1 与随行 V2-2/V2-3/V2-4/V2-5 全部实证闭环;V2-6(R2 原文"非必须")未吸收,不影响编码正确性。**

## 二、修订是否引入新问题

逐段核对第二轮修订文字(容器相对公式及"与 spec §3.1 一致"引用、mouse 坐标 TypeError 警告、82,86,88 三处、sitemap 移出说明、window.focus 验证点),与源码事实、git 状态交叉验证:**无新的事实错误,无 spec ↔ tasks 矛盾,无方案变更**。两处与 R1/R2 实证的交叉确认:

1. tasks Task 6 Step 1 仍写"检索 Crafty.config.speed 全部引用,确定改法(全局 speed 或仅 multiway 传参)",而 spec §3.2 ② 已实证定论"仅 L875 一处消费,直接改 L829 即为最小改法"——Step 1 属防御性再检索而非矛盾(检索只会确认同一结论,且本轮已复核 L829/L875 引用面未变),可接受。
2. spec §6 验收"键盘按住位移 ≥60px/秒"与 tasks Task 6 Step 6"≥60px 每秒"一致;peach/skyscraper/smartphone/tickle/回归各条验收与 Task 8 清单一一对应,无孤儿条目、无不可执行断言。

## 三、前提漂移检查(终审专项)

- games.json:moon-rabbit=mmttt.png 在位、retro=loading.png 待改、共 82 款——spec §2 诊断前提与验收基线(82)均未漂移
- git:工作区含 games.json/sitemap.xml/package-lock 修改与 wiki 删除、30 个游戏 untracked——spec §1"尚未提交"与 §3.3"git add 精确路径"隔离清单与实际完全对应
- 平台代码:GameDetailPage.tsx:519-543 全屏层、types/index.ts 均未被提前改动,"待编码"状态纯净,Task 1 文件清单与行号仍有效

## 四、遗留非阻塞事项(记录备查,不要求本轮处理)

| # | 事项 | 说明 |
|---|---|---|
| V3-1 | spec §7 评审状态元信息陈旧 | 仍写"当前版本:v2"、评审记录仅列 spec_review_v1.md、状态"待复审"——实际已历经 R2 并完成第二轮修订(修订内容真实、已实证),但 §7 未反映 R2 轮次。属元信息不同步而非内容矛盾,建议编码阶段随手更新一行,不影响本轮判定 |
| V3-2 | V2-6 未吸收(M-4 路径前缀 + M-2③ 回写)+ V2-1 附带的可选断言 | spec §2 #4/#5 补 `src/`、`js/` 前缀;§4 补一句"sync-games 不写 games.json,唯一写入方为 build:games:list";Task 8 可选补"iframe rect 不超出全屏容器 rect"廉价防线。均为效率/加固项,不影响方案正确性 |
| V3-3 | V2-5 验证点仅在 tasks 层 | spec §6 验收汇总未同步"未点击即键盘生效"条目;执行层已闭环,若追求 SSOT 完美可补一行 |

## 五、总评

三轮评审累计:R1 修正 3 处方案/事实问题(tap 三处、.intro 选择器、容器相对单位),R2 修正修订传导缺失(tasks.md 未同步)与 sitemap 提交风险,本轮实证确认**全部阻塞与非阻塞修复真实落地**:spec 与 tasks 的公式、坐标映射、tap 三处、sitemap 移出、focus 验证点逐字一致且与源码事实吻合;7 个根因诊断的代码证据经三轮独立抽查零漂移;git 工作区状态与 spec 前提、隔离清单完全对应;遗留 3 项均为元信息/效率级,无一是方案或事实错误。spec+tasks 已达到可执行、可验证、可回归的编码就绪状态。

**结论:APPROVED。可以进入阶段3编码。**(遗留的 V3-1/V3-2/V3-3 可在编码阶段顺手处理,无需再回阶段1)

## 评审轮次
- 当前:第 3 轮(终审)/ 上限 3 轮
- 历史:v1 NEEDS_REVISION(spec_review_v1.md,3 Important + 6 Minor);v2 NEEDS_REVISION(spec_review_v2.md,1 Important 阻塞 V2-1 + 5 随行)
- 终审:APPROVED,轮次收敛,未触达升级人工条件
