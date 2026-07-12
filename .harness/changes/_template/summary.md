# {变更类型}-{需求名称}-{YYYYMMDD} 变更摘要

> **Single Source of Truth** | 全流程追溯 | 每阶段完成后立即更新本文件
> 创建日期:YYYY-MM-DD | 负责人: | 关联分支:feature/{name}

## 1. 基本信息

| 字段 | 值 |
|---|---|
| 变更类型 | feature / fix / chore / game |
| 需求名称 | (kebab-case) |
| 创建日期 | YYYY-MM-DD |
| 需求来源 | (用户原始描述/PRD链接) |
| 负责人 | |
| 工作分支 | feature/{name} |
| Base SHA | (编码起点 commit) |
| Head SHA | (当前 commit) |
| 最终状态 | 🟡进行中 / ✅已交付 / ❌已回退 / ⏸暂停待人工 |

## 2. 十阶段执行状态

| # | 阶段 | 状态 | 完成日期 | 评审轮次 | 产出物 | 备注 |
|---|---|---|---|---|---|---|
| 0 | 项目摸底(按需) | ⬜ | - | - | project_scan.md | |
| 1 | 需求分析 | ⬜ | - | - | spec.md, tasks.md | HITL-1 |
| 2 | 需求评审 | ⬜ | - | 0/3 | review/spec_review_vN.md | ≤3轮 |
| 3 | 编码实现 | ⬜ | - | - | coding_report_vN.md | |
| 4 | 编码评审 | ⬜ | - | 0/2 | review/code_review_vN.md | HITL-3, ≤2轮 |
| 5 | 单元测试编写 | ⬜ | - | - | test_report.md | |
| 6 | 单元测试评审 | ⬜ | - | 0/2 | review/test_review_vN.md | ≤2轮 |
| 7 | 代码推送 | ⬜ | - | - | PR 链接 | |
| 8 | CI 验证 | ⬜ | - | - | ci_result.md | |
| 9 | 部署验证 | ⬜ | - | - | deploy_report.md | HITL-4 |
| 10 | 用户确认 | ⬜ | - | - | (本文件最终版) | HITL-5 |

> 状态标记:⬜未开始 / 🔄进行中 / ✅通过 / ❌失败回退 / ⏸暂停待人工 / ⏭跳过(注明原因)

## 3. 质量门禁记录

| 门禁 | 阶段 | 结果 | 证据(命令输出/链接) | 日期 |
|---|---|---|---|---|
| spec 评审 APPROVED | 2 | | | |
| Critical=0 & Important=0 | 4 | | | |
| lint 0 warning | 7 | | | |
| build 产物存在 | 7 | | | |
| validate:games 游戏数>0 | 7 | | | |
| 测试先失败过(TDD) | 5 | | | |
| CI status=SUCCESS(非空跑) | 8 | | | |
| 部署端到端取证 | 9 | | | |

## 4. CI 测试用例统计

| 指标 | 值 |
|---|---|
| 单元测试总数 | |
| 通过 / 失败 | / |
| CI run 链接 | |
| validate-games 游戏数 | |

## 5. Human-in-the-Loop 决议记录

| HITL | 阶段 | 决议内容 | 决议人 | 日期 |
|---|---|---|---|---|
| HITL-1 需求待决议 | 1 | | | |
| HITL-2 计划评审后 | 2 | | | |
| HITL-3 编码评审后 | 4 | | | |
| HITL-4 部署参数 | 9 | | | |
| HITL-5 最终交付 | 10 | | | |

## 6. 人工干预点与偏差记录

> 记录:轮次超限升级、3次修复未果质疑架构、计划/门禁偏离及原因、用户拒收回退等。
- (无 / 待记录)

## 7. 教训沉淀(供 Rules/Wiki 更新)

> 本需求过程中发现的新教训,应 patch 进 `.harness/rules/` 或 `wiki/`。
- (无 / 待记录)

## 8. 变更文件清单

```
{类型}-{需求}-{YYYYMMDD}/
├── summary.md                     ← 本文件
├── request_analysis/{spec.md, tasks.md, review/spec_review_vN.md}
├── coding/{coding_report_vN.md, review/code_review_vN.md}
├── unit_test/{test_report.md, review/test_review_vN.md}
├── ci_result/ci_result.md
└── deployment/deploy_report.md
```
