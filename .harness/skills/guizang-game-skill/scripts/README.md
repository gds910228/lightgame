# scripts/ 用途说明（众测改编版）

| 脚本 | 用途 | 用法 |
|---|---|---|
| `runtest.mjs` | 跑单款 `?autotest=1` 套件 + 控制台/外网审计 + 可选截图 | `node runtest.mjs <gameId> <port> [--shot]` |
| `verify-input.mjs` | 真实键鼠输入冒烟（不经 G 钩子，断言按键后状态变化，防"autotest 全绿但键盘死"） | `node verify-input.mjs <port> [game...]` |
| `sitesmoke.mjs` | 对 `packages/app/public/games/` 构建副本做站点级冒烟（iframe 视角直开+游玩+零报错） | `node sitesmoke.mjs <port> <gameId...>` |
| `gen-thumbs.mjs` | 实机截图生成 640×360 封面（依赖 ffmpeg） | `node gen-thumbs.mjs <gameId> [port]` |
| `input.js` | skill 自带键鼠输入模块（防丢键+F3 调试面板），游戏内直接复用 | 见 SKILL.md |
| `serve.mjs` | skill 自带本地静态服务器 | `node serve.mjs <dir> <port>` |
| `build_single_html.mjs` / `build_minitool.mjs` | 单文件打包（本任务**不要求**使用，仅作体积控制参考） | 见 references/packaging.md |

⚠️ `runtest/verify-input/sitesmoke/gen-thumbs` 是第三批模板，`createRequire` 的 playwright 路径与 `gen-thumbs.mjs` 的 `ROOT` 为本机硬编码，换环境先改。云端若无 playwright，验证以页面内 `?autotest=1` 套件 + 页面内 fetch/XHR 审计替代（见 CROWDTEST-CONVENTIONS.md §8–9）。
