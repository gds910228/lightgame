# 代码评审报告 v1

> 阶段4产出 | expert-reviewer + code-review(code-reviewer 子代理) | BASE_SHA..HEAD_SHA
> 版本递增:v1, v2... 旧版不删 | 轮次上限:2 轮,超出升级人工
> 顺序:spec 合规评审 ✅ 后才进行本代码质量评审(不可换序)

## 评审对象
- diff:`git diff {BASE_SHA}..{HEAD_SHA}`
- 基准:request_analysis/spec.md + tasks.md

## 评审维度

### 风格
- [ ] TS 类型完整,无裸 any
- [ ] 命名符合规范(组件 PascalCase / hook use 前缀)
- [ ] 遵循分层(components/pages/contexts/services/types)

### 安全
- [ ] iframe 仅 1games.io
- [ ] CSP 未引入未授权外域
- [ ] 无用户输入直接 innerHTML/dangerouslySetInnerHTML
- [ ] 敏感配置走 .env

### 性能
- [ ] manualChunks 未设(应 undefined)
- [ ] 图片已优化
- [ ] Context 未过度订阅
- [ ] 大列表有虚拟化/分页预案(若涉及)

### 构建门禁
- [ ] `npm run lint` 0 warning
- [ ] `tsc` 通过
- [ ] `npm run build` 通过
- [ ] `npm run validate:games` 通过

## 评审结论
- [ ] ✅ Approved -- 可进入测试
- [ ] 🔄 需修改 -- 见下方(修复后 re-review,不可跳过)
- [ ] ⏸ 升级人工 -- 轮次超限

## 问题清单

| # | 问题描述 | 建议 | 优先级 | 阻塞 |
|---|---|---|---|---|
| 1 | | | Critical | 是 |

> 门禁:Critical=0 且 Important=0 才可合入。Minor 记录待办。

## 评审轮次
- 当前:第 1 轮 / 上限 2 轮
- 历史:-
