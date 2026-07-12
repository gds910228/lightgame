# using-git-worktrees

> SOP 第四阶段 · (辅助)分支隔离 · 加载时机: **L2**(阶段 7 推送前 / 编码开始前)
> 复用全局 superpowers: `~/.claude/skills/using-git-worktrees/`

## 触发场景
- 编码开始前建立隔离工作区(`subagent-driven-development` 要求前置)
- 并行开发多个独立需求
- 不在 main 上直接动手

## 输入
- 当前分支(main)
- 需求名(用于分支命名)

## 执行步骤
调用 `using-git-worktrees` skill:
1. 从 main 创建隔离 worktree
2. 在 worktree 内完成所有编码 / 测试 / 评审
3. 完成后用 `finishing-a-development-branch` 合并

## 输出
- 隔离工作区(路径见 `git worktree list`)

## 加载时机
L2:编码开始前加载。

## 项目适配
- **Claude Code 环境(优先)**:用内置 `EnterWorktree`(worktree 建在 `.claude/worktrees/`,自动管理,会话结束可 keep/remove)
- **手动**:`git worktree add ../Lightgame-{feature} -b feature/{name}`
- 本项目 main 为默认分支,所有 PR 指向 main
- worktree 内仍需 `npm install`(`node_modules` 不跨 worktree 共享)
- 游戏源在 `packages/games/`,sync 目标在 `packages/app/public/games/`--worktree 内改游戏后仍需 `npm run sync-games`
