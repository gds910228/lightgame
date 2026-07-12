# 任务清单:{需求名称}

> 阶段1产出 | request-analysis(writing-plans)生成 | 每步 2-5 分钟 | checkbox 跟踪

## 任务依赖图
(简述任务间依赖;独立任务可由 subagent 并行/串行执行)

## Task 1: {组件名}
**文件:**
- Create: `exact/path/to/file.tsx`
- Modify: `packages/app/src/...:行号`
- Test: `packages/app/src/.../__tests__/*.test.ts`

- [ ] Step 1: 写失败测试(RED)
- [ ] Step 2: 跑测试确认失败且原因正确
- [ ] Step 3: 写最小实现(GREEN)
- [ ] Step 4: 跑测试确认通过 + 其他测试不破
- [ ] Step 5: 重构(REFACTOR),保持绿
- [ ] Step 6: 提交 `feat: ...`

> 模型选择:1-2文件机械=快模型 / 多文件集成=标准 / 设计判断=最强

## Task 2: {组件名}
**文件:** ...
- [ ] Step 1 ~ N: ...

## 全局验证(全部 Task 完成后)
- [ ] `npm run lint` 0 warning
- [ ] `npm run build` 通过(含 sync-games + games-list)
- [ ] `npm run validate:games` 通过
- [ ] 派发 final code-reviewer 审查整体实现
