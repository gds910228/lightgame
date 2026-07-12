# code-review

> SOP 第四阶段 · 代码检查 · 加载时机: **L2**(阶段 4 / 合并前)
> 复用全局 superpowers: `~/.claude/skills/requesting-code-review/` + `~/.claude/skills/receiving-code-review/`

## 触发场景
- 编码评审阶段(阶段 4)
- 合并到 main 前
- 重大功能完成后、卡住时(新视角)、重构前(基线检查)

## 输入
- `git diff`: `BASE_SHA..HEAD_SHA`
- 对应 spec / tasks.md 作为评审基准

## 执行步骤
1. 取 SHA:`BASE_SHA=$(git rev-parse HEAD~N)`(或 `origin/main`),`HEAD_SHA=$(git rev-parse HEAD)`
2. 调用 `requesting-code-review`,派发 `code-reviewer` 子代理,填模板:`{WHAT_WAS_IMPLEMENTED}` / `{PLAN_OR_REQUIREMENTS}` / `{BASE_SHA}` / `{HEAD_SHA}` / `{DESCRIPTION}`
3. 收到反馈后调用 `receiving-code-review` 回应:Critical 立即修 / Important 继续前必修 / Minor 记录待办 / 有理有据反驳
4. 修复后**重新派发评审**(re-review 不可跳过)

## 输出
- `.harness/changes/{变更}/coding/review/code_review_vN.md`(版本递增,旧版不删)

## 加载时机
L2:评审阶段加载 requesting-code-review + receiving-code-review 全文。

## 项目适配:静态检查项清单

**风格:**
- TS 类型完整,无裸 `any`(必要时加注释说明)
- 命名符合 React 惯例(组件 PascalCase,hook `use` 前缀)
- 遵循现有分层(components/pages/contexts/services/types),不乱放

**安全:**
- iframe 仅 `1games.io`,无其他外域嵌入
- CSP 头(`vercel.json`)未引入未授权外域
- 无用户输入直接 `innerHTML`(游戏 iframe wrapper 尤其注意)
- EmailJS `service_id` / `template_id` 不在前端可见明文暴露敏感配置

**性能:**
- 未设 Vite `manualChunks`(应 `undefined`,否则触发 ForwardRef 错误)
- 图片走 `optimize-games`,封面/缩略图已压缩
- game 列表增长时有虚拟化或分页预案
- Context 未过度订阅导致全量重渲染

**构建门禁:**
- `npm run lint` 通过
- `tsc` 类型检查通过
- `npm run build` 通过(含 sync-games + build:games:list)
- `npm run validate:games` 通过(iframe 嵌入预检)
