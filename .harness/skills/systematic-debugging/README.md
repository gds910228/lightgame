# systematic-debugging

> SOP 第四阶段 · (辅助)调试 · 加载时机: **L2**(遇 bug 时)
> 复用全局 superpowers: `~/.claude/skills/systematic-debugging/`

## 触发场景
- 任何 bug、测试失败、异常行为、性能问题、build 失败、集成问题
- 尤其:时间紧迫时("快速修一下"的诱惑)、已试过多修未果、前一次修复无效

## 输入
- 错误信息 / 失败现象 / 复现步骤

## 执行步骤
调用 `systematic-debugging` skill,严格走四阶段(每阶段完成才进下一):

1. **Phase 1 根因调查**:精读错误信息 -> 稳定复现 -> 查近期改动(`git diff`)-> 多组件系统加边界日志 -> 反向追踪数据流
2. **Phase 2 模式分析**:找同类正常代码 -> 完整读参考实现(不 skim)-> 列出所有差异
3. **Phase 3 假设与测试**:单一假设 -> 最小改动验证 -> 一次只改一个变量
4. **Phase 4 实现**:写复现失败测试(TDD)-> 单一修复 -> 验证
   - 若 **≥3 次修复失败**:停下质疑架构,找人讨论,**不要试第 4 次**

> Iron Law:未完成根因调查,不提修复方案。症状修复即失败。

## 输出
- 复现测试(归入 `unit_test/`)
- 根因记录写入 `.harness/changes/{变更}/coding/debug_log.md`(可选)

## 加载时机
L2:遇 bug 时加载 systematic-debugging 全文。

## 项目适配:常见故障 → 首选排查点

| 现象 | 首选排查 |
|---|---|
| iframe 游戏空白 | 控制台 X-Frame-Options / CSP frame-ancestors;跑 `npm run validate:games`;查 `can-embed.js` 预检 |
| 游戏不出现 | `metadata.json` 是否有效;`npm run sync-games` 是否跑过;`games.json` 是否重建 |
| build 失败 | `tsc` 类型错误(`packages/app/src/types/`);是否漏 `sync-games`;删 `games.json` 重建 |
| 端口占用 | dev server 默认 3000 |
| CSP 违规 | `vercel.json` 头是否加新 CDN / 分析域名 |
| React ForwardRef 错误 | 是否误设 `manualChunks`(应 `undefined`) |
| 热重载失效 | `npm run dev:watch` 是否在跑 |

## 配套
- Phase 4 写复现测试时,用 `unit-test-write` skill(test-driven-development)
- 声称修复前,用 `verification-before-completion` 跑命令取证
