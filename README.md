# LightGame

![LightGame Logo](packages/app/public/favicon.svg)

LightGame 是一个精美设计的纯前端休闲游戏平台，面向寻求快速放松的上班族。平台无需登录，体验极简，视觉美观，包含多种经典与轻量游戏。

## 特点

- 即开即玩：无需注册登录
- 精美界面：动画流畅、视觉统一
- 多种游戏：贪吃蛇、俄罗斯方块、太空射击等
- 响应式设计：适配多终端

## 技术栈

- 前端：React + TypeScript
- 样式：Tailwind CSS
- 构建：Vite
- 部署：GitHub Pages / Actions

## 项目结构（Monorepo）

```
Lightgame/
├─ packages/
│  ├─ app/                       # 前端站点（Vite + React）
│  │  ├─ public/
│  │  │  ├─ games/               # 构建后游戏访问目录（/games/{id}/index.html）
│  │  │  └─ games.json           # 游戏列表（由脚本生成）
│  │  └─ scripts/                # 前端侧工具脚本
│  └─ games/                     # 游戏源目录（新增游戏放这里）
│     └─ {id}/
│        ├─ index.html           # local 模式必需
│        └─ metadata.json        # 必需（驱动自动化）
├─ scripts/                      # 根层自动化脚本（校验/同步等）
│  ├─ validate-games.js          # 元数据校验 + iframe 预检（仅允许 1games.io）
│  ├─ sync-games.js              # 同步：local 复制 / iframe 生成包装页
│  ├─ build-games-list.js        # 代理执行 packages/app 的列表构建脚本
│  └─ lib/can-embed.js           # 预检库（XFO/CSP/重定向/白名单）
├─ docs/                         # 文档
└─ .github/workflows/            # CI 工作流
```

## 源码 → 构建过程

  packages/games/             (源码目录)
        ↓
  [构建脚本从这里读取]
        ↓
  packages/app/public/games/  (临时构建目录)
        ↓
  [最终打包]
        ↓
  packages/app/dist/games/    (部署产物)

## 本地开发

```bash
# 安装依赖
npm install

# 校验（Schema + 预检）
npm run validate:games

# 同步（复制本地 / 生成 iframe 包装页）
npm run sync-games

# 构建游戏列表（生成 packages/app/public/games.json）
npm run build:games:list

# 开发（已包含自动同步）
npm run dev
```

## 新增游戏（新版流程）

支持两种接入模式，均以 metadata.json 为单一入口（Single Source of Truth）：

- local（本地源码）
  1. 在 `packages/games/{id}` 放置 `index.html` 与资源
  2. 编写 `metadata.json`（至少包含：`id`, `title`, `category`, `description`, `controls`）
  3. 执行：
     - `npm run validate:games`
     - `npm run sync-games`
  4. 访问路径：`/games/{id}/index.html`

- iframe（外链包装，仅支持 1games.io）
  1. 在 `packages/games/{id}` 下仅需 `metadata.json`
  2. 必填其一：`iframe_url` 或 `embedUrl`（必须指向 `https://1games.io/...`）
  3. 推荐：`aspectRatio`（如 `"16:9"`），或提供 `width/height` 用于比例推断；可选 `allow`（默认 `"fullscreen; autoplay"`）与 `sandbox`
  4. 执行：
     - `npm run validate:games`（会进行域名白名单与 X-Frame-Options/CSP frame-ancestors 预检，失败阻断）
     - `npm run sync-games`（生成响应式、懒加载、支持全屏的静态包装页）
  5. 访问路径：`/games/{id}/index.html`

备注：
- 前端列表由 `packages/app/scripts/build-games-list.js` 扫描 `packages/games` 的 `metadata.json` 生成，统一 `path=/games/{id}/index.html`，并自动输出 `type: local | iframe`。
- `image/thumbnail/cover` 支持相对路径，会在构建阶段归一化到 `/games/{id}/...`。

## 命令速查

- 校验（Schema + 预检）：`npm run validate:games`
- 同步（复制/生成包装页）：`npm run sync-games`
- 构建列表（生成 games.json）：`npm run build:games:list`
- 开发（含同步）：`npm run dev`
- 预览生产：`npm run preview`

## CI

- `.github/workflows/validate-games.yml`：在 PR 与 main 推送时自动运行 `node scripts/validate-games.js`，预检失败将阻断合并。

## 最近更新（2025-08-19）

- 新增 iframe 接入（仅允许 1games.io），预检 X-Frame-Options 与 CSP frame-ancestors，重定向持续白名单校验
- 同步脚本增强：local 复制目录；iframe 生成静态包装页（响应式、懒加载、全屏）
- 新增元数据 Schema（draft-07）与校验脚本（AJV）
- 构建列表增强：统一 path、补充 type 字段、规范 image/thumbnail/cover 路径
- 新增根级命令：`validate:games`、`build:games:list`
- CI 集成：PR 自动校验

## 许可证

MIT