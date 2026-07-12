# CI 验证结果

> 阶段8产出 | unit-test-ci | 防空跑误绿:必须确认步骤实执行 + 游戏数>0

## 1. 本地门禁(推送前必跑,CI 不兜底)
> 本项目远程 CI 仅跑 validate-games(且仅 games/scripts 变更触发),lint/tsc/build 无 CI 保护。

| 命令 | 退出码 | 结果 | 证据 |
|---|---|---|---|
| `npm run lint` | | 0 warning? | (输出摘要) |
| `npm run build` | | 产物存在? | `packages/app/dist/` 列表 |
| `npm run validate:games` | | 游戏数>0? | (输出 N games) |

**门禁**:三项全真(退出码0 + 产物存在 + 游戏数>0)才可 push main。

## 2. 远程 CI
- PR(可选,本项目默认直接 push main 无 PR):
- 分支:
- Run ID / 链接:

| Job | status | 步骤是否实执行(非skipped) | 备注 |
|---|---|---|---|
| validate-games | SUCCESS/FAILURE | 是/否 | 若 paths 未触发则 job 不跑,此时依赖本地门禁,不可视为"CI通过" |

**门禁**:`status==SUCCESS` 且步骤实执行 且输出含 "validated N games" 且 N>0。

## 3. 失败回退
- CI 失败类型:lint / tsc / build / validate / test
- 回退到:阶段5(测试)/ 阶段3(编码)
- 根因分析:(用 systematic-debugging,不猜)

## 4. 结论
- [ ] ✅ CI 验证通过(有证据)
- [ ] ❌ 失败,已回退
