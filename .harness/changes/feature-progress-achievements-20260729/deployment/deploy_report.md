# 部署验证报告

> 阶段9产出 | deploy-verify | 每项必须 curl/实测取证,非假设 | HITL-4 部署参数确认

## 0. 部署目标确认(HITL-4)
- [ ] GitHub Pages(deploy.yml 实际生效)
- [ ] Vercel(vercel.json)
- 部署 URL:
- 环境参数:

> 本项目存在双配置,部署前必须确认实际生效目标,否则验证错地址。

## 1. 基础可达性
| 检查 | 期望 | 实测 | 证据 |
|---|---|---|---|
| `curl -sI {URL}/` | 200, text/html | | |
| `curl -sI {URL}/games.json` | 200, application/json | | |

## 2. SPA 路由(rewrites 生效)
| 路径 | 期望 | 实测 |
|---|---|---|
| `/privacy` | 200(非404) | |
| `/contact-us` | 200 | |

## 3. 游戏清单完整性
- `games.json` 游戏数:本地 X / 线上 Y(应一致)
- 抽样游戏页:`{URL}/games/{id}/index.html` -> 

## 4. 安全头
| 头 | 期望 | 实测 |
|---|---|---|
| CSP `frame-src` 含 1games.io | 是 | |
| X-Frame-Options | SAMEORIGIN | |
| X-Content-Type-Options | nosniff | |

## 5. iframe 游戏渲染(抽样,配 Browser MCP)
- 游戏详情页打开:iframe 渲染(非空白)? 控制台无 X-Frame-Options/CSP 报错?
- 截图链接:

## 6. 静态资源
| 资源 | 期望 | 实测 |
|---|---|---|
| `/sitemap.xml` | 200, application/xml | |
| `/robots.txt` | 200, text/plain | |

## 7. 失败回退
- 失败项:
- 回退到:阶段8(CI)/ 阶段3(编码)
- CSP/iframe 问题:查 `scripts/lib/can-embed.js`

## 8. 结论
- [ ] ✅ 部署验证通过(每项取证)
- [ ] ❌ 失败,已回退
