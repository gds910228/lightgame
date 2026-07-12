# unit-test-ci

> SOP 第四阶段 · CI 验证 · 加载时机: **L2**(阶段 8)
> 复用全局 superpowers: `~/.claude/skills/verification-before-completion/`(验证精神)
> 自建:本项目 CI 门禁条件(因无单测框架 + CI 覆盖不全)

## 触发场景
- 代码推送后(阶段 7)-> 等待 CI 结果
- 本地合并前自检(CI 不兜底的部分)

## 输入
- 推送的分支 / PR 号
- GitHub Actions 运行 ID

## 执行步骤

### 1. 本地门禁(CI 不兜底,**必跑**)
本项目 PR 阶段 CI 仅跑 `validate-games.js`(且仅在 `packages/games/**`、`scripts/**`、`build-games-list.js` 变更时触发),**lint / tsc / build 无 CI 保护**。故推送前本地必跑:

```bash
npm run lint           # eslint --max-warnings 0,必须 0 warning
npm run build          # tsc && vite build(含 sync-games + build:games:list)
npm run validate:games # 游戏元数据 schema + iframe 嵌入预检
```

**门禁条件(全部为真才算过):**
- `lint` 退出码 == 0 **且** 0 warning
- `build` 退出码 == 0 **且** `packages/app/dist/` 产物存在
- `validate:games` 退出码 == 0 **且** 输出含有效游戏数 > 0

### 2. 远程 CI 门禁
```bash
gh run list --branch={branch} --limit 5
gh run view {run-id} --log
```

**门禁条件(SOP 风格,防"空跑误绿"——SOP 阶段十一 Dry Run 点名的坑):**
- `validate-games` job: `status == SUCCESS`
- **且** 步骤 "Validate games" 实际执行(非 skipped)--通过 paths 触发,若 PR 未改 games/scripts 则 job 不跑,此时**不能**视为"CI 验证通过",需依赖本地门禁
- 输出含 "validated N games" **且 N > 0**(避免 0 游戏空跑误绿)

### 3. 失败回退
- CI 失败 -> 回退到阶段 5(单元测试编写)/ 阶段 3(编码),视错误类型
- 用 `systematic-debugging` 找根因,不猜

## 输出
- `.harness/changes/{变更}/ci_result/ci_result.md`(本地门禁输出 + 远程 run 链接 + 门禁判定)

## 加载时机
L2:CI 验证阶段加载。

## 项目适配:关键缺口与建议
- **缺口 1(重要)**:PR 阶段无 lint/tsc/build CI。建议用 `github-actions-generate` skill 补一个 `ci.yml`,PR 时跑 `lint + build + validate:games`。
- **缺口 2**:Node 版本不一致(`validate-games.yml` 用 20,`deploy.yml` 用 18)。建议统一(推荐 20)。
- **缺口 3**:无单测框架。若已按 `unit-test-write` 引入 Vitest,CI 应加 `npm test`,门禁加 `total_tests>0 && passed==total`。

## 红线(来自 verification-before-completion)
- 不说"应该过了"/"看起来绿"--必须跑命令、读输出、确认退出码
- 不信任"agent 报告成功"--查 `gh run` 实际状态
- 部分检查 != 全部通过
