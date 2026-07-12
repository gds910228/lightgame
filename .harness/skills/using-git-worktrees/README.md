# using-git-worktrees

> SOP 第四阶段 · (辅助)分支隔离 · 加载时机: **L2**(仅并行多需求时,**可选**)
> 复用全局 superpowers: `~/.claude/skills/using-git-worktrees/`

## 触发场景(可选,非默认)
- **并行开发多个独立需求**,需隔离工作区互不干扰时
- 本项目默认直接在 main 开发(见 `开发流程规范.md` §2),**日常单需求无需 worktree**

## 输入
- 当前分支(main)
- 需求名(用于 worktree 命名)

## 执行步骤(仅并行多需求时)
调用 `using-git-worktrees` skill:
1. 从 main 创建隔离 worktree
2. 在 worktree 内完成编码 / 测试 / 评审
3. 完成后用 `finishing-a-development-branch` 合并回 main,清理 worktree

## 输出
- 隔离工作区(路径见 `git worktree list`)

## 加载时机
L2:仅并行多需求时加载。单需求 main 直接开发不加载。

## 项目适配
- **本项目默认 main 直接开发**,worktree 是可选项,不要默认使用
- **Claude Code 环境**:可用内置 `EnterWorktree`(worktree 建在 `.claude/worktrees/`,自动管理)
- **手动**:`git worktree add ../Lightgame-{feature} -b feature/{name}`
- worktree 内仍需 `npm install`(`node_modules` 不跨 worktree 共享)
- 游戏源在 `packages/games/`,sync 目标在 `packages/app/public/games/`--worktree 内改游戏后仍需 `npm run sync-games`
