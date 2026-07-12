# unit-test-write

> SOP 第四阶段 · 单元测试编写 · 加载时机: **L2**(进入阶段 5 时)
> 复用全局 superpowers: `~/.claude/skills/test-driven-development/`

## 触发场景
- 实现任何功能或修复 bug 时(理想:先于实现写测试)
- 编码阶段每个子任务(subagent-driven-development 要求子代理遵循 TDD)

## 输入
- 待测代码或待实现行为描述
- 对应 spec / tasks.md

## 执行步骤
调用 `test-driven-development` skill,严格走 **RED-GREEN-REFACTOR**:
1. **RED**:写一个最小失败测试,描述期望行为
2. **Verify RED**:`npm test -- <path>` 确认**失败且失败原因正确**(功能缺失,非笔误)
3. **GREEN**:写最小代码让测试过
4. **Verify GREEN**:确认通过、其他测试不破、输出干净
5. **REFACTOR**:清理,保持绿
6. 重复下一个失败测试

> Iron Law:没有先失败过的测试,不算 TDD。先写代码再补测试 = 删除重来。

## 输出
- 测试文件(本项目建议 `packages/app/src/**/__tests__/*.test.ts(x)`)
- `.harness/changes/{变更}/unit_test/test_report.md` —— 覆盖率、用例数、红绿记录

## 加载时机
L2:测试阶段加载 test-driven-development 全文。

## 项目适配:测试框架(关键缺口)
CLAUDE.md 明确:**"No test framework configured. When adding tests, use Vitest for consistency with Vite."**

因此本项目当前**无单测基础设施**。落地此 skill 前需先补:
1. `packages/app/` 安装 `vitest` + `@testing-library/react` + `jsdom`
2. `packages/app/vitest.config.ts`(可复用 vite 别名 `@/`)
3. `package.json` 加 `"test": "vitest run"` 脚本
4. 优先测:`services/gameService.ts`(数据解析)、`contexts/FavoritesContext`(状态)、`scripts/lib/can-embed.js`(嵌入校验逻辑,可用 node:test)

## 改动驱动测试原则
- 每个新函数/方法必须有测试
- bug 修复:先写复现该 bug 的失败测试,再修(测试证明修复 + 防回归)
- 测**行为**不测实现;mock 仅在不可避免时用
- 游戏元数据校验:用 `scripts/validate-games.js` 作为集成测试基线
