# fix-seven-game-bugs-20261023 变更摘要

> **Single Source of Truth** | 全流程追溯 | 每阶段完成后立即更新本文件
> 创建日期:2026-10-23 | 负责人:Application Owner Agent | 分支:main(直接开发)

## 1. 基本信息

| 字段 | 值 |
|---|---|
| 变更类型 | fix |
| 需求名称 | seven-game-bugs(7 个游戏 bug 修复) |
| 创建日期 | 2026-10-23 |
| 需求来源 | 用户报告:封面黑白/黑屏 2 个、画面显示不全 2 个、交互失效 3 个 |
| 负责人 | Application Owner Agent |
| 工作分支 | main(直接开发,见开发流程规范 §2) |
| Base SHA | d8dece9 |
| Head SHA | (编码中) |
| 最终状态 | 🟡进行中 |

## 2. 十阶段执行状态

| # | 阶段 | 状态 | 完成日期 | 评审轮次 | 产出物 | 备注 |
|---|---|---|---|---|---|---|
| 0 | 项目摸底(按需) | ✅ | 2026-10-23 | - | 3 个并行诊断代理报告(结论并入 spec §2) | 全部根因实证闭环 |
| 1 | 需求分析 | ✅ | 2026-10-23 | - | spec.md(v2), tasks.md | HITL-1 用户已答(封面手改/音乐正常/先修复) |
| 2 | 需求评审 | ✅ | 2026-10-23 | 3/3 | review/spec_review_v1~v3.md | v3 APPROVED;HITL-2 由 HITL-1"先排查修复问题"授权覆盖,提交前仍有 HITL |
| 3 | 编码实现 | ✅ | 2026-10-23 | - | coding/coding_report_v1.md(最终版) | 含验证驱动迭代:gameService 透传/cqw 公式/smartphone 三层库 bug/soccer Moved NaN |
| 4 | 编码评审 | ✅ | 2026-10-23 | 2/2 | review/code_review_v1~v2.md | v2 APPROVED(Critical=0, Important=0);Playwright 4 轮 15 项全 PASS(coding/verification_report_v1.md) |
| 5 | 单元测试编写 | ⏭ | - | - | - | 无单测框架;静态游戏修复以 Playwright headless 实测替代(沿 batch-30 先例) |
| 6 | 单元测试评审 | ⏭ | - | - | - | 同阶段 5 |
| 7 | 代码推送 | 🟡 | - | - | commit(+push 待决议) | 门禁全绿;待用户推送决议(HITL-3+推送合并询问) |
| 8 | CI 验证 | ⬜ | - | - | ci_result.md | 视 push 决议 |
| 9 | 部署验证 | ⬜ | - | - | deploy_report.md | 视 push 决议 |
| 10 | 用户确认 | ⬜ | - - | - | (本文件最终版) | HITL-5 |

> 状态标记:⬜未开始 / 🔄进行中 / ✅通过 / ❌失败回退 / ⏸暂停待人工 / ⏭跳过(注明原因)

## 3. 质量门禁记录

| 门禁 | 阶段 | 结果 | 证据(命令输出/链接) | 日期 |
|---|---|---|---|---|
| spec 评审 APPROVED | 2 | ✅ | review/spec_review_v3.md(R1/R2 NEEDS_REVISION 均已修订) | 2026-10-23 |
| Critical=0 & Important=0 | 4 | ✅ | review/code_review_v2.md(R1 的 2 Important 均为文档项,已闭环) | 2026-10-23 |
| Playwright 全项取证 | 3/4 | ✅ | coding/verification_report_v1.md(4 轮迭代,最终 15 项全 PASS) | 2026-10-23 |
| tsc --noEmit | 3/4 | ✅ | exit 0(评审独立复跑) | 2026-10-23 |
| lint 0 warning | 7 | ✅ | `npm run lint`(--max-warnings 0)无输出 | 2026-10-23 |
| build 产物存在 | 7 | ✅ | dist: index.html 4.62kB / css 44.36kB / js 415.23kB | 2026-10-23 |
| validate:games 游戏数>0 | 7 | ✅ | 82/82 | 2026-10-23 |
| 测试先失败过(TDD) | 5 | ⏭ | 无框架,Playwright 实测替代 | |
| CI status=SUCCESS(非空跑) | 8 | | 待 push 决议 | |
| 部署端到端取证 | 9 | | 待 push 决议 | |

## 4. CI 测试用例统计

| 指标 | 值 |
|---|---|
| 单元测试总数 | N/A(无框架) |
| 通过 / 失败 | N/A |
| CI run 链接 | 待 push 决议 |
| validate-games 游戏数 | 待跑(预期 82) |

## 5. Human-in-the-Loop 决议记录

| HITL | 阶段 | 决议内容 | 决议人 | 日期 |
|---|---|---|---|---|
| HITL-1 需求待决议 | 1 | ①用户已手改两游戏封面路径(moon-rabbit→mmttt.png;retro→loading.png),问是否会被重置→方案中以 build 实测取证;②修不好的游戏删除→7 个均有根因走修复;③retro 音乐用户确认"正常了"不处理;④推送策略"先排查修复问题"(提交前再问);⑤wiki/package-lock 遗留先不动 | 用户 | 2026-10-23 |
| HITL-2 计划评审后 | 2 | 用户 HITL-1"先排查修复问题"视为修复路径授权;spec v3 APPROVED 后直接进编码,提交前仍有用户确认点 | 用户(推断)+AO | 2026-10-23 |
| HITL-3 编码评审后 | 4 | | | |
| HITL-4 部署参数 | 9 | | | |
| HITL-5 最终交付 | 10 | | | |

## 6. 人工干预点与偏差记录

- 诊断代理发现:batch-30 的 30 个游戏目录 + games.json/sitemap.xml 未提交(上个变更决议不 push 的遗留),本次修复的 7 个游戏在其中——修复提交必然连带游戏本体首次入库;sitemap.xml 经 R2 评审判定含 23 个未提交游戏死链,移出本次提交范围
- retro 封面:用户手改的 loading.png 实测 184x92 近灰度(质量差),方案调整为彩色 jpeg(Public/upload/6177/53fe872815c9a.jpeg,640x960),将在交付时向用户说明理由
- 阶段 5/6 跳过:无单测框架,与 batch-30 先例一致,以 Playwright 实测替代

## 7. 教训沉淀(供 Rules/Wiki 更新)

- 候选 1:`findCandidateImage` 优先级表把 share.png(微信分享提示图,通常灰度/近透明)排在通用图扫描之前,导致多游戏封面选中劣质图;建议后续把 share.* 从 primary 列表移除或降级(本次未全局改,避免波及 11 个已人工调优封面)
- 候选 2:竖屏手机 H5 游戏接入平台必须带 aspectRatio,否则横屏视口喂竖屏游戏会出现裁切/按钮出画/变形三类症状(本次平台侧已支持,新游戏接入 SOP 应补此检查项)

## 8. 变更文件清单

```
fix-seven-game-bugs-20261023/
├── summary.md                     ← 本文件
├── request_analysis/{spec.md, tasks.md, review/spec_review_v1~v3.md}
├── coding/{coding_report_v1.md, review/code_review_v1.md}
├── ci_result/ci_result.md
└── deployment/deploy_report.md
```
