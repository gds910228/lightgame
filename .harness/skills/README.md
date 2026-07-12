# Harness Skills 索引

> 对应《Harness 落地设计 SOP》第四阶段:技能体系
> 本文件为 **L1 常驻上下文**,每次会话加载;单个 skill 文档为 **L2 阶段触发**加载;wiki/ 为 L3 按需。

## 设计原则:索引式复用

superpowers(v5.0.2,全局安装于 `~/.claude/skills/`)的成熟 skill **不复制**,在此建立**适配索引**——标注 SOP 角色、触发场景、加载时机,实际调用走全局 skill。superpowers 无对应、且本项目专属的环节(项目分析、CI 门禁、部署验证、CI 配置生成),**自建**并适配 React + TypeScript + Vite + GitHub Actions + Vercel 技术栈。

## 上下文分层(SOP 阶段七)

| 层级 | 内容 | 加载时机 | 总量控制 |
|---|---|---|---|
| L1 常驻 | 本索引 + 三份 Rules + Application Owner Agent | 每次会话开始 | 填充率 < 40% |
| L2 阶段触发 | 当前阶段对应的 skill 文档 | 进入该阶段时 | 仅加载当前阶段 |
| L3 按需 | `wiki/` 知识库 | Agent 自主查阅 | 不主动加载 |

## Skills 总览(12 个)

### A. 直接复用 superpowers(8 个)

| Skill | 路径 | SOP 对应 | superpowers 来源 | 触发场景 |
|---|---|---|---|---|
| request-analysis | `./request-analysis/` | 需求分析 | brainstorming + writing-plans | 新需求接入,产出 spec + tasks |
| coding-skill | `./coding-skill/` | 编码实现 | subagent-driven-development + executing-plans | 执行计划、分层编码 |
| expert-reviewer | `./expert-reviewer/` | 专家评审 | subagent-driven 双评审 + requesting-code-review | 计划/编码/测试评审 |
| unit-test-write | `./unit-test-write/` | 单元测试 | test-driven-development | 编码后 / 改 bug 时写测试 |
| code-review | `./code-review/` | 代码检查 | requesting-code-review + receiving-code-review | 合并前静态检查 |
| systematic-debugging | `./systematic-debugging/` | (辅助)调试 | systematic-debugging | 任何 bug / 测试失败 / 异常行为 |
| using-git-worktrees | `./using-git-worktrees/` | (辅助)分支 | using-git-worktrees | 并行隔离(可选) |
| finishing-a-development-branch | `./finishing-a-development-branch/` | (辅助)交付 | finishing-a-development-branch | 提交/push main |

### B. 复用 + 自建门禁(2 个)

| Skill | 路径 | SOP 对应 | superpowers 来源 | 自建部分 |
|---|---|---|---|---|
| unit-test-ci | `./unit-test-ci/` | CI 验证 | verification-before-completion | CI 门禁条件(lint + tsc + build + validate:games) |
| deploy-verify | `./deploy-verify/` | 部署验证 | verification-before-completion | Vercel 端到端验证步骤 |

### C. 纯自建(2 个,本项目专属)

| Skill | 路径 | SOP 对应 | 说明 |
|---|---|---|---|
| project-analysis | `./project-analysis/` | 项目分析 | 全局扫描 packages/、高频变更区、依赖关系、game 分布 |
| github-actions-generate | `./github-actions-generate/` | CI 配置生成 | 生成/更新 `.github/workflows/`(替代 SOP 的 aone-ci-generate) |

## 调用方式

- **复用型(A 类)**:进入对应阶段时,用 `Skill` 工具调用全局 superpowers 的原始 skill(如 `brainstorming`);本目录 README 仅作 SOP 适配桥接(路径覆盖、角色映射、轮次约束)。
- **自建型(B/C 类)**:直接读本目录 README 执行。
- 每个 skill README 统一含五要素:**触发场景 / 输入 / 执行步骤 / 输出 / 加载时机**。

## 与十阶段流程的映射(SOP 阶段八)

| # | 阶段 | 加载 Skill | 质量门禁 |
|---|---|---|---|
| 1 | 需求分析 | request-analysis | spec.md + tasks.md 存在 |
| 2 | 需求评审 | expert-reviewer | APPROVED(≤3 轮) |
| 3 | 编码实现 | coding-skill | tasks 全部 [x] |
| 4 | 编码评审 | expert-reviewer + code-review | Critical=0(≤2 轮) |
| 5 | 单元测试编写 | unit-test-write | 测试存在且失败过 |
| 6 | 单元测试评审 | expert-reviewer | APPROVED(≤2 轮) |
| 7 | 代码推送 | finishing-a-development-branch | commit+push main |
| 8 | CI 验证 | unit-test-ci | status=SUCCESS && 产物>0 |
| 9 | 部署验证 | deploy-verify | 端到端检查通过 |
| 10 | 用户确认 | (Human-in-the-Loop) | 用户签字 |

## 变更产物路径约定(SOP 阶段九)

所有 skill 产出写入 `.harness/changes/{变更类型}-{需求名}-{YYYYMMDD}/`,**覆盖** superpowers 默认的 `docs/superpowers/` 路径:

```
request_analysis/{spec.md, tasks.md, review/spec_review_vN.md}
coding/{coding_report_vN.md, review/code_review_vN.md}
unit_test/{test_report.md, review/}
ci_result/ci_result.md
deployment/deploy_report.md
summary.md  # 每阶段完成后更新
```
