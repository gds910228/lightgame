# expert-reviewer

> SOP 第四阶段 · 专家评审 · 加载时机: **L2**(阶段 2 / 4 / 6 触发)
> 复用全局 superpowers: `subagent-driven-development` 内置双评审 + `~/.claude/skills/requesting-code-review/`

## 触发场景
- 阶段 2 需求评审:评审 spec.md + tasks.md
- 阶段 4 编码评审:评审代码 diff
- 阶段 6 单元测试评审:评审测试用例

## 输入
- 评审对象:spec 文档 / `git diff {BASE_SHA}..{HEAD_SHA}` / 测试文件
- 评审基准:对应 spec 或 tasks.md

## 执行步骤
1. **计划/文档评审**:派发 `spec-document-reviewer` 子代理(brainstorming/writing-plans 内置),用精心构造的评审上下文(非会话历史)
2. **代码评审**:
   - 取 `BASE_SHA=$(git rev-parse HEAD~N)` / `HEAD_SHA=$(git rev-parse HEAD)`
   - 调用 `requesting-code-review`,派发 `code-reviewer` 子代理,填模板:`{WHAT_WAS_IMPLEMENTED}` / `{PLAN_OR_REQUIREMENTS}` / `{BASE_SHA}` / `{HEAD_SHA}` / `{DESCRIPTION}`
3. 评审报告写盘,问题修复后**重新派发评审**(不跳过 re-review)
4. 按严重度处理:Critical 立即修 / Important 继续前必修 / Minor 记录待办

## 输出
- `.harness/changes/{变更}/request_analysis/review/spec_review_vN.md`
- `.harness/changes/{变更}/coding/review/code_review_vN.md`
- `.harness/changes/{变更}/unit_test/review/test_review_vN.md`
- 报告格式:**问题描述 + 建议 + 优先级(Critical/Important/Minor)**

## 加载时机
L2:评审阶段加载 requesting-code-review 全文。

## 项目适配:评审轮次约束(SOP 阶段八)
- 需求评审:**最多 3 轮**,超出升级人工决策
- 编码评审 / 测试评审:**最多 2 轮**,超出升级人工决策
- 评审文件版本递增(v1, v2, v3...),**旧版本永不删除**
- 评审子代理上下文必须**精心构造**,绝不传会话历史(避免被思路带偏)

## 红线
- 不因"很简单"跳过评审
- 不带未修复的 Critical / Important 进入下一阶段
- 不让 implementer 自审替代正式评审(两者都需要)
- spec 合规评审未 ✅ 前,**不**开始代码质量评审(顺序不可换)
