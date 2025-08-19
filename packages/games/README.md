# packages/games 接入指南（中文）

本目录用于存放“原始游戏源码”（local）或“外链游戏的占位目录”（iframe）。配合脚本自动化，最终会将合规游戏输出到 `packages/app/public/games/{id}/`，并统一以 `/games/{id}/index.html` 作为访问入口。

——

## 目录命名与结构

- 目录名即游戏 `id`（推荐小写英文与短横线，例如 `snake-arena`）。
- 必须包含：`metadata.json`
- local（本地游戏）还需包含：`index.html` 及其依赖资源。
- 建议结构（可按项目需要调整）：
  ```
  packages/games/{id}/
  ├─ index.html              // local 必需
  ├─ metadata.json           // 必需
  ├─ assets/                 // 可选：图片/音频/脚本等
  ├─ images/                 // 可选
  ├─ js/ css/                // 可选
  └─ thumbnail.png           // 可选：缩略图（也可为远程 URL）
  ```

——

## 元数据（metadata.json）字段约定

必填（两种类型通用）
- id: string（目录名同名，形如 `snake-arena`）
- title: string（展示名称）
- category: string 或 string[]（分类）
- description: string（简介）
- controls: string（操作说明）

可选（通用）
- tags: string[]
- author: string
- version: string
- image / thumbnail / cover: string（可为相对路径或绝对 URL；建议使用 `image` 或 `thumbnail`）
- features: string[]
- difficulty / players / rating / featured / date_added / play_count 等

local 专属（任选其一）
- 无需额外字段；仅需确保目录下有 `index.html`
- 如需比例提示，可设置：
  - aspectRatio: "16:9" 或 "9:16"
  - 或 width/height: number（用于包装页比例推断，优先级低于 aspectRatio）

iframe 专属（仅支持 1games.io）
- iframe_url 或 embedUrl（必须指向 `https://1games.io/...`）
- aspectRatio: "W:H"（推荐，示例 "16:9"）
- 可选：width、height（若无 aspectRatio，会用此推断比例）
- 可选：allow（默认 "fullscreen; autoplay"）
- 可选：sandbox（一般不加；确有需要可设置为字符串或 true/false）

——

## 示例

local 示例
```json
{
  "id": "tetris",
  "title": "Tetris",
  "category": "Puzzle",
  "description": "经典俄罗斯方块，排列方块消行。",
  "controls": "方向键控制移动与旋转；空格硬降。",
  "image": "./thumbnail.png",
  "version": "1.0.0",
  "features": ["经典玩法", "多级难度"]
}
```

iframe 示例（仅 1games.io）
```json
{
  "id": "snake-arena",
  "title": "Snake Arena",
  "category": "Action",
  "description": "实时对战的贪吃蛇游戏。",
  "controls": "WASD / 方向键",
  "iframe_url": "https://1games.io/game/snake-arena/",
  "aspectRatio": "16:9",
  "thumbnail": "https://images.unsplash.com/photo-1511512578047-dfb367046420?w=400&h=300&fit=crop&crop=center",
  "version": "1.0.0"
}
```

——

## 接入流程

1) 新建目录
- 在 `packages/games` 下创建 `{id}` 目录（与 `id` 一致）。

2) 添加必要文件
- local：放入 `index.html` 与资源，编写 `metadata.json`（按上文字段）。
- iframe：仅需 `metadata.json`；可放置本地缩略图或使用远程 URL。

3) 校验
- 运行：
```bash
node scripts/validate-games.js
```
- 行为：
  - 使用 JSON Schema 校验 `metadata.json` 字段
  - local：检查是否存在 `index.html`
  - iframe：仅允许 `1games.io`；对外链做 HEAD/GET 预检，若响应头存在 `X-Frame-Options: deny/sameorigin` 或 CSP 中 `frame-ancestors` 限制，或网络/状态异常，则阻断

4) 同步
- 运行：
```bash
node scripts/sync-games.js
```
- 行为：
  - local：复制整个目录到 `packages/app/public/games/{id}`
  - iframe：生成静态包装页 `packages/app/public/games/{id}/index.html`（响应式比例、懒加载、全屏按钮）

5) 访问
- 统一入口：
```
/games/{id}/index.html
```

——

## 重要约束

- Iframe 白名单：目前仅允许 `1games.io`
- 预检失败：直接阻断，不会同步到 `public` 目录
- 包装页不展示来源/版权链接（如需可后续调整）
- SEO：包装页含基本 `title/description`；iframe 内容不可索引
- 列表构建：脚本会默认将 `path` 规范为 `/games/{id}/index.html`，无需在 `metadata.json` 中手填

——

## 常见问题（FAQ）

- 预检失败？
  - 检查外链是否为 `https://1games.io/...`
  - 目标站点若返回 `X-Frame-Options: deny/sameorigin` 或 CSP 的 `frame-ancestors` 限制，则无法嵌入
  - 遇到 3xx 重定向会持续跟随并校验重定向后的域名仍在白名单内

- AJV 依赖缺失？
  - 安装开发依赖：
    ```bash
    npm i -D ajv ajv-formats
    ```

- 图片路径
  - 如果 `image/thumbnail` 为相对路径，请保证文件存在于当前目录，并在构建时会复制到 `public`
  - 推荐将缩略图做压缩（项目已有优化脚本，可后续统一接入）

——

## 命令速查

- 校验（Schema + 预检）
```bash
node scripts/validate-games.js
```

- 同步（复制本地 / 生成 iframe 包装页）
```bash
node scripts/sync-games.js
```

- 开发（建议先校验再同步）
```bash
npm run dev