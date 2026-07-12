# github-actions-generate

> SOP 第四阶段 · CI 配置生成 · 加载时机: **L2**(补 CI 缺口时 / 新增检查项时)
> 自建:替代 SOP 的 `aone-ci-generate`,适配 GitHub Actions + 本项目技术栈

## 触发场景
- 发现 CI 覆盖缺口(如 `unit-test-ci` 指出 PR 无 lint/tsc/build 保护)
- 新增检查需求(引入 Vitest 后加 test job、加 Lighthouse 性能检查等)
- 统一 Node 版本、更新 actions 版本

## 输入
- 待补的检查项
- 现有 workflow:`.github/workflows/{validate-games.yml, deploy.yml}`

## 执行步骤

### 1. 现状审计
```bash
ls .github/workflows/
cat .github/workflows/*.yml
# 记录:现有 job、触发条件、Node 版本、actions 版本
```

### 2. 缺口识别(对照 `unit-test-ci`)
本项目当前缺口:
- [ ] PR 阶段无 lint
- [ ] PR 阶段无 tsc 类型检查
- [ ] PR 阶段无 build(仅 main push 时 `deploy.yml` 跑)
- [ ] Node 版本不一致(`validate-games` 20 / `deploy` 18)
- [ ] (引入 Vitest 后)无 test job

### 3. 生成 / 更新 workflow
针对缺口生成 `.github/workflows/ci.yml`(PR + push main 触发):

```yaml
name: ci
on:
  pull_request:
  push:
    branches: [main]
jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      - run: npm ci
      - name: Lint (0 warnings)
        run: npm run lint
      - name: Build (tsc + vite + sync-games + games-list)
        run: npm run build
      - name: Validate games (schema + iframe precheck)
        run: npm run validate:games
      # 引入 Vitest 后追加:
      # - name: Unit tests
      #   run: npm test
```

### 4. 统一现有 workflow
- `deploy.yml`:Node 18 -> 20(与 `validate-games.yml` 一致;本项目 TS 5.2 + Vite 5,Node 20 安全)
- 所有 `actions/checkout@v4`、`setup-node@v4`、`deploy-pages@v4` 保持最新稳定版

### 5. 验证
- 本地用 `act` 推演(若装了)或推送 PR 触发实测
- 确认 `ci.yml` 在 PR 上跑通,**且能拦住** lint/build/validate 失败(故意制造一次失败验证拦截)
- 用 `unit-test-ci` skill 的门禁条件核对

### 6. 失败回退
- 新 workflow 跑红 -> 不阻断主分支(仅在 PR);用 `systematic-debugging` 排查
- 误拦合法 PR -> 调整触发路径或规则

## 输出
- `.github/workflows/ci.yml`(新增)
- `.github/workflows/{validate-games,deploy}.yml`(更新 Node 版本)
- `.harness/changes/{变更}/coding/ci_config_diff.md`(变更说明)

## 加载时机
L2:补 CI 缺口 / 新增检查项时加载。

## 红线
- 不删现有 workflow 的触发条件(可能放过未校验的 PR)
- 不降低现有门禁(如把 `--max-warnings 0` 改成允许 warning)
- 新 workflow 必须先在 PR 实测跑通(含一次故意失败验证),再信任
