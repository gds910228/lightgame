# finishing-a-development-branch

> SOP 第四阶段 · (辅助)交付 · 加载时机: **L2**(阶段 7 / push 前)
> 复用全局 superpowers: `~/.claude/skills/finishing-a-development-branch/`

## 触发场景
- 所有任务完成、测试通过、评审通过后
- 准备 commit 并 push 到 main(本项目直接在 main 开发)

## 输入
- 已完成的本地改动
- 通过的验证证据(`verification-before-completion` 产出:本地门禁三件套)

## 执行步骤
1. 验证全部测试 / 构建通过(**有证据**,非"应该过"):`npm run build` + `npm run validate:games`
2. commit 到 main:message 中文 + 类型前缀,AI 协作加 `Co-Authored-By`
3. push main -> 触发 GitHub Actions(`validate-games.yml` 校验 + `deploy.yml` 部署)
4. 更新 `summary.md` 最终状态

> 本项目不开 feature 分支、不走 PR(默认)。若需他人审查,可临时建分支开 PR。

## 输出
- main 上的 commit(SHA)
- push 后的 Actions run 链接
- `summary.md` 最终更新

## 加载时机
L2:交付阶段加载。

## 项目适配
- **直接 main 开发**(2026-07-11 调整,见 `开发流程规范.md` §2):不开分支,本地门禁通过即 commit + push main
- commit message 现有风格:中文 `feat:` / `fix:` / `game:` 前缀(见近期 commit)
- commit message 结尾加:`Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
- push main 触发 `validate-games.yml`(游戏元数据 + 嵌入权限校验)与 `deploy.yml`(部署)
- push 前确认:`npm run build` 本地通过 + `npm run validate:games` 通过(**取证**,非假设)
- 若用 worktree(并行多需求可选):完成后合并回 main 并清理 worktree
