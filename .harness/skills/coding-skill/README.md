# coding-skill

> SOP 第四阶段 · 编码实现 · 加载时机: **L2**(进入阶段 3 时)
> 复用全局 superpowers: `~/.claude/skills/subagent-driven-development/` + `~/.claude/skills/executing-plans/`

## 触发场景
- spec 与 tasks.md 已就绪,开始执行编码
- plan 中任务基本独立、可在当前会话推进

## 输入
- `.harness/changes/{变更}/request_analysis/tasks.md`
- `.harness/changes/{变更}/request_analysis/spec.md`

## 执行步骤
1. 读 plan,抽取所有任务全文 + 上下文,建 TodoWrite
2. **有 subagent 时(默认)**:调用 `subagent-driven-development`
   - 每任务派发 fresh implementer 子代理 → 两阶段评审(spec 合规 → 代码质量)→ 修复循环 → 标记完成
   - 模型选择:1-2 文件机械任务用快模型;多文件集成用标准模型;设计判断用最强模型
3. **无 subagent 时**:降级调用 `executing-plans`,批量执行 + checkpoint 评审
4. 全部任务完成后,派发 final code-reviewer 审查整体实现

## 输出
- 代码改动(直接提交 main,见开发流程规范 §2)
- `.harness/changes/{变更}/coding/coding_report_vN.md` —— 编码报告
- `.harness/changes/{变更}/coding/review/code_review_vN.md` —— 评审报告

## 加载时机
L2:编码阶段加载 subagent-driven-development(或 executing-plans)全文。

## 项目适配:分层规范(替代 SOP 的 Controller/Service/DAO)
本项目是 React + TS + Vite 前端 monorepo,分层为:
- `packages/app/src/components/` —— UI 组件
- `packages/app/src/pages/` —— 路由页面
- `packages/app/src/contexts/` —— Context 状态(FavoritesContext / PerformanceContext)
- `packages/app/src/services/` —— 数据/外部服务(gameService / emailService)
- `packages/app/src/types/` —— TS 类型定义
- `packages/games/{id}/` —— 单个游戏(self-contained,`metadata.json` 为单一真相源)
- `scripts/` —— 游戏管理自动化(CommonJS)

## 硬性约束清单(编码前必读)
- `npm run sync-games` 必须在 build 前跑(游戏在 sync 时拷贝,非 build 时)
- **不要**设置 Vite `manualChunks`(会触发 React ForwardRef 错误)
- 路径别名用 `@/` 指向 `packages/app/src/`
- `games.json` 自动生成,**禁止手改**,用 `npm run build:games:list`
- iframe 游戏仅限 `https://1games.io/`,需过 `scripts/lib/can-embed.js` 预检
- metadata 图片相对路径在 build 时归一化为 `/games/{id}/...`
