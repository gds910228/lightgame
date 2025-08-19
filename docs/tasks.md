# Lightgame 项目任务进度（中文）

本页用于跟踪“新增游戏”的标准化与自动化接入流程进度。目标：将新游戏放入 packages/games 后，脚本自动完成校验、同步，并在 packages/app/public/games 下生成可直接访问的入口（本地游戏原样复制；Iframe 外链生成包装页）。

更新时间：2025-08-19

——

## To Do
- [ ] watch 自动化
  - [ ] scripts/watch-games.js 监听 packages/games 变化，增量触发 validate → sync
- [ ] 资源优化整合
  - [ ] 复用 packages/app/scripts/optimize-games.cjs，对缩略图/截图执行压缩（webp/avif 优先）
- [ ] 文档完善
  - [ ] 在站内贡献指南中补充“接入流程说明”“字段说明”（面向贡献者）
  - [ ] 在首页/列表页适配必要的说明（如 iframe 包装页行为）

## Doing
- [ ] 前端列表字段一致性评估
  - [ ] 是否需要统一使用 image 字段（兼容 thumbnail）
  - [ ] 是否在前端消费 type 字段（通常不需要，包装页已统一入口）

## Done
- [x] 接入模式与策略确定
  - [x] 支持两种类型：local（本地源码）、iframe（外链包装）
  - [x] 外链白名单：仅允许 1games.io
  - [x] 预检失败直接阻断
- [x] can-embed 预检库（scripts/lib/can-embed.js）
  - [x] 检查 X-Frame-Options 与 CSP frame-ancestors
  - [x] 处理 3xx 重定向并强制白名单校验
- [x] 同步脚本增强（scripts/sync-games.js）
  - [x] local：复制目录到 packages/app/public/games/{slug}
  - [x] iframe：生成响应式、懒加载、支持全屏的包装页 index.html
- [x] 元数据 Schema（draft-07）与校验脚本
  - [x] scripts/schemas/metadata.schema.json（兼容现有字段）
  - [x] scripts/validate-games.js（AJV 校验 + 1games.io 预检 + 本地 index.html 检查）
- [x] 全量校验与同步验证
  - [x] node scripts/validate-games.js → ✅ All games passed
  - [x] node scripts/sync-games.js → 已复制本地游戏并生成 snake-arena 的 iframe 包装页
- [x] 扩展构建列表（packages/app/scripts/build-games-list.js）
  - [x] 元数据来源切换为 packages/games
  - [x] 统一 path 为 /games/{slug}/index.html
  - [x] 新增 type 字段（local / iframe）
  - [x] 归一化 image/thumbnail/cover 相对路径
- [x] CI 集成（.github/workflows/validate-games.yml）
  - [x] PR 与 main 推送触发校验脚本，失败阻断合并
- [x] 中文文档
  - [x] docs/tasks.md：中文任务看板与操作指引
  - [x] packages/games/README.md：中文接入指南（local 与 iframe、字段、示例、命令、约束与 FAQ）

——

## 使用说明（团队内部）

新增“本地游戏”（local）
1. 在 packages/games 下创建目录（建议使用小写短横线命名，如 my-game）。
2. 放入 index.html 与资产文件，并提供 metadata.json（至少包含：id、title、category、description、controls）。
3. 运行：
   - npm run validate:games
   - npm run sync-games
4. 访问路径：/games/{id}/index.html

新增“Iframe 外链游戏”（iframe，仅支持 1games.io）
1. 在 packages/games 下创建目录（如 snake-arena）。
2. 提供 metadata.json，包含：
   - 必填：id、title、category、description、controls
   - 必填其一：iframe_url 或 embedUrl（必须指向 https://1games.io/...）
   - 可选：aspectRatio（如 "16:9"，优先级高于 width/height），width、height、allow、sandbox
3. 运行：
   - npm run validate:games（做白名单与 XFO/CSP 预检）
   - npm run sync-games（生成包装页到 public）
4. 访问路径：/games/{id}/index.html

——

## 命令速查

- 校验（Schema + 预检）
  - npm run validate:games
- 同步（复制本地 / 生成 iframe 包装页）
  - npm run sync-games
- 构建游戏列表（生成 packages/app/public/games.json）
  - npm run build:games:list
- 开发（建议先校验再同步）
  - npm run dev

——

## 设计约束与约定

- Iframe 白名单：目前仅允许 1games.io
- 预检失败（网络错、非 2xx、X-Frame-Options 阻断、CSP frame-ancestors 限制、跨域重定向）→ 直接阻断
- 包装页不展示来源/版权链接（按需可后续调整）
- SEO：包装页包含基本 title/description；iframe 内部内容不可索引
- 统一入口：所有游戏均通过 /games/{slug}/index.html 访问

——

## 变更记录（关键文件）
- scripts/lib/can-embed.js（新增）
- scripts/sync-games.js（重写：按 metadata 分支 local/iframe）
- scripts/schemas/metadata.schema.json（新增：draft-07）
- scripts/validate-games.js（新增：AJV + 预检）
- packages/app/scripts/build-games-list.js（增强：来源/字段规范化）
- .github/workflows/validate-games.yml（新增：CI 校验）