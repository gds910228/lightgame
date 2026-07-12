# request-analysis

> SOP 第四阶段 · 需求分析 · 加载时机: **L2**(进入阶段 1 时)
> 复用全局 superpowers: `~/.claude/skills/brainstorming/` + `~/.claude/skills/writing-plans/`

## 触发场景
- 新需求接入(新游戏、新页面、新功能、行为修改)
- 任何创造性工作动手之前(即便"看起来很简单")

## 输入
- 用户需求描述(自然语言)
- 项目上下文:`packages/` 结构、`CLAUDE.md`、`docs/PRD.md`、近期 commit

## 执行步骤
1. **调用 `brainstorming` skill**(用 Skill 工具):探索项目上下文 → 逐个澄清问题 → 提 2-3 方案 → 出设计 → spec review loop(子代理评审,≤5 轮)→ 用户确认
2. **调用 `writing-plans` skill**:把 spec 转成 bite-sized 任务(每步 2-5 分钟)→ plan review loop
3. 把 spec 与 plan 落到 SOP 变更目录(见下方"路径覆盖")

## 输出
- `.harness/changes/{变更}/request_analysis/spec.md` —— 需求规格
- `.harness/changes/{变更}/request_analysis/tasks.md` —— 任务清单(checkbox 语法)
- `.harness/changes/{变更}/request_analysis/review/spec_review_vN.md` —— 评审记录(版本递增)

## 路径覆盖(关键适配)
superpowers 默认把 spec 写到 `docs/superpowers/specs/`、plan 写到 `docs/superpowers/plans/`。**本项目覆盖为** SOP 变更目录 `.harness/changes/{变更}/request_analysis/`,以纳入变更管理可追溯体系(SOP 阶段九)。

## 加载时机
L2:仅需求分析阶段加载 brainstorming + writing-plans 全文。

## 项目适配提示
- 游戏集成类需求:先确认是 `local` 还是 `iframe`(仅 1games.io),参考 `metadata.schema.json`
- 多子系统需求:brainstorming 会要求先分解为子项目,每个独立 spec→plan→实现
