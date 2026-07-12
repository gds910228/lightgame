# 变更管理规范

> SOP 阶段九 | 每个需求创建标准化变更目录,全流程可追溯
> 模板位于 `_template/`,使用时复制并重命名

## 1. 目录命名

```
.harness/changes/{变更类型}-{需求名称}-{YYYYMMDD}/
```

- **变更类型**:`feature`(新功能)/ `fix`(修bug)/ `chore`(杂项)/ `game`(新增游戏)
- **需求名称**:kebab-case,简短达意(如 `add-favorites-sync`、`fix-iframe-csp`)
- **日期**:需求创建日,YYYYMMDD(如 `20260711`)
- 示例:`game-add-bubble-pop-20260711`、`feature-search-filter-20260715`

## 2. 使用方式

新需求进入阶段1时,Application Owner Agent 自动创建变更目录:

```bash
cp -r .harness/changes/_template .harness/changes/{类型}-{需求}-{YYYYMMDD}
```

复制后:
1. 改 `summary.md` 顶部标题与基本信息
2. 各阶段推进时,填充对应文件(替换模板占位符)
3. 每阶段完成立即更新 `summary.md` 的十阶段状态表

## 3. 目录结构

```
{类型}-{需求}-{YYYYMMDD}/
├── summary.md                     # SSOT,全流程追溯(每阶段更新)
├── request_analysis/
│   ├── spec.md                    # 阶段1:需求规格
│   ├── tasks.md                   # 阶段1:任务清单
│   └── review/
│       ├── spec_review_v1.md      # 阶段2:需求评审(版本递增)
│       └── spec_review_v2.md
├── coding/
│   ├── coding_report_v1.md        # 阶段3:编码报告(版本递增)
│   └── review/
│       └── code_review_v1.md      # 阶段4:代码评审(版本递增)
├── unit_test/
│   ├── test_report.md             # 阶段5:测试报告
│   └── review/
│       └── test_review_v1.md      # 阶段6:测试评审(版本递增)
├── ci_result/
│   └── ci_result.md               # 阶段8:CI验证
└── deployment/
    └── deploy_report.md           # 阶段9:部署验证
```

## 4. 版本递增规则(评审文件)

- 评审文件命名:`{名}_v{N}.md`(如 `spec_review_v1.md`、`code_review_v2.md`)
- **每轮评审若需修改**,新建下一版本文件(`v1`->`v2`->`v3`),**旧版本永不删除**
- 编码报告同理:`coding_report_v1.md` -> `coding_report_v2.md`(重大返工时递增)
- 当前版本号记录在 `summary.md` 十阶段状态表的"评审轮次"列

## 5. summary.md 更新规则(SSOT)

`summary.md` 是 Single Source of Truth,**每阶段完成后立即更新**:

| 时机 | 更新内容 |
|---|---|
| 阶段1完成 | 基本信息、十阶段表阶段1状态、产出物 |
| 每个评审完成 | 状态表"评审轮次"列、质量门禁记录、HITL 决议 |
| 阶段7 | 门禁三件套证据(lint/build/validate)、Base/Head SHA |
| 阶段8 | CI 测试用例统计、run 链接 |
| 阶段10 | 最终状态、教训沉淀 |

记录字段:执行状态、评审轮次、CI 测试用例数、HITL 决议、人工干预点。

## 6. 评审轮次上限与升级

| 评审 | 上限 | 超限处理 |
|---|---|---|
| 需求评审(阶段2) | 3 轮 | 停止,升级人工决策,记入 summary 人工干预点 |
| 编码评审(阶段4) | 2 轮 | 同上 |
| 测试评审(阶段6) | 2 轮 | 同上 |

超限时 `summary.md` 最终状态置 ⏸暂停待人工,记录未决议项。

## 7. 不可遗漏项

- 评审文件**旧版本永不删除**(可追溯修改历程)
- `summary.md` **每阶段必更**,不积压到最后
- 人工干预点、3次修复未果、轮次超限**必须如实记录**(不隐瞒)
- 教训沉淀:过程中新教训 patch 进 `.harness/rules/` 或 `wiki/`,并在 summary §7 记录

## 8. 与 Agent 的关系

Application Owner Agent(`.harness/agents/application-owner.md`)在阶段1进入时**自动创建**本结构,并在模块四调度指令中要求每阶段更新 `summary.md`。变更类型 `game` 对应游戏接入专项流程(见开发流程规范.md §5)。
