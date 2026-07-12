# finishing-a-development-branch

> SOP 第四阶段 · (辅助)交付 · 加载时机: **L2**(阶段 7 / 合并前)
> 复用全局 superpowers: `~/.claude/skills/finishing-a-development-branch/`

## 触发场景
- 所有任务完成、测试通过、评审通过后
- 准备合并到 main 或开 PR

## 输入
- 已完成的工作分支
- 通过的验证证据(`verification-before-completion` 产出)

## 执行步骤
调用 `finishing-a-development-branch` skill:
1. 验证全部测试 / 构建通过(**有证据**,非"应该过")
2. 呈现合并选项(直接合并 / squash / rebase / 开 PR)
3. 执行用户选定方案
4. 清理 worktree(如用)

## 输出
- 合并 commit / PR 链接
- `summary.md` 最终更新

## 加载时机
L2:交付阶段加载。

## 项目适配
- PR 流程:feature 分支 -> main,GitHub Actions(`validate-games.yml`)自动校验游戏元数据 + 嵌入权限,失败阻断合并
- commit message 现有风格:中文 `feat:` / `fix:` 前缀(见近期 commit)
- commit message 结尾加:`Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
- PR body 结尾加:`🤖 Generated with [Claude Code](https://claude.com/claude-code)`
- **不在 main 直接 commit**(项目约定,先建分支)
- 合并前确认:`npm run build` 本地通过 + `npm run validate:games` 通过(取证,非假设)
