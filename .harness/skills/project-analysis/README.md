# project-analysis

> SOP 第四阶段 · 项目分析 · 加载时机: **L2**(阶段 1 需求分析前 / 阶段十一 Dry Run / 阶段十二定期回顾)
> 自建:本项目专属,superpowers 无对应

## 触发场景
- 新会话 / 新需求接入前,快速建立项目全局认知
- Dry Run 测试前(摸底)
- 定期回顾(SOP 阶段十二):识别高频变更区、技术债、AI Coding 率变化

## 输入
- 代码库根路径
- git 历史(近 3 个月)

## 执行步骤

### 1. 结构扫描
```bash
ls packages/app/src/          # 组件/页面/上下文/服务/类型 分层
ls packages/games/            # 游戏清单(每个子目录 = 一个游戏)
jq 'length' packages/app/public/games.json                       # 当前游戏总数
jq '[.[].category] | group_by(.) | map({(.[0]): length}) | add' packages/app/public/games.json  # 分类分布
ls scripts/                   # 自动化脚本(validate/sync/build-list/watch/optimize)
```

### 2. 规模统计
```bash
find packages/app/src -name '*.ts' -o -name '*.tsx' | xargs wc -l | tail -1   # app 代码行数
find packages/games -name 'metadata.json' | wc -l                              # 游戏数
ls packages/games/*/index.html 2>/dev/null | wc -l                             # local 游戏数
grep -l 'iframe_url\|embedUrl' packages/games/*/metadata.json | wc -l          # iframe 游戏数
```

### 3. 高频变更区识别(识别 SOP 所指"高频变更链路")
```bash
git log --since='3 months ago' --name-only --pretty=format: | grep -v '^$' | sort | uniq -c | sort -rn | head -20
```
输出 top-20 高频文件,标注:
- 高频变更的组件 / 页面(易回归区,需重点测试)
- 高频变更的 game(活跃维护)

### 4. 依赖关系梳理
```bash
jq '.dependencies | keys' packages/app/package.json   # 运行时:react-router-dom / @emailjs/browser / @vercel/analytics / react-select
jq '.devDependencies | keys' package.json             # 构建:ajv(校验) / chokidar(watch) / typescript
```

### 5. 隐性知识与硬约束汇总(对接 SOP 阶段一)
从 `CLAUDE.md` "Important Gotchas" 提取:
- `sync-games` 必须在 build 前跑(游戏在 sync 时拷贝)
- iframe 验证阻断 build
- `games.json` 禁止手改,用 `build:games:list`
- 禁设 Vite `manualChunks`(ForwardRef 错误)
- 路径别名 `@/` -> `packages/app/src/`
- metadata 图片相对路径 build 时归一化为 `/games/{id}/...`

### 6. 风险点识别
- CI 覆盖缺口(PR 无 lint/tsc/build,见 `unit-test-ci`)
- Node 版本不一致(`validate-games.yml` 20 vs `deploy.yml` 18)
- 双部署配置(GitHub Pages vs Vercel,见 `deploy-verify`)
- 无单测框架(CLAUDE.md 明示,建议 Vitest)
- iframe 依赖外域 1games.io,嵌入权限随时可能变(需定期 `validate:games`)

## 输出
- `.harness/changes/{变更}/request_analysis/project_scan.md`(结构+规模+高频区+依赖+风险)
- 或 `wiki/项目分析.md`(定期回顾时)

## 加载时机
L2:需求分析前 / Dry Run / 定期回顾时加载。

## 建议派发子代理
对大库,用 `subagent-driven-development` 思路派发 `Explore` 子代理并行扫描不同子目录(`packages/app`、`packages/games`、`scripts`),主代理汇总。避免主上下文被文件 dump 撑爆。
