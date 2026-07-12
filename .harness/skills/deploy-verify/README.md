# deploy-verify

> SOP 第四阶段 · 部署验证 · 加载时机: **L2**(阶段 9)
> 复用全局 superpowers: `~/.claude/skills/verification-before-completion/`(验证精神)
> 自建:GitHub Pages / Vercel 端到端验证步骤

## 触发场景
- CI 通过、合并/部署完成后
- **Human-in-the-Loop**:部署参数确认点(SOP 五个 HITL 之一)

## 输入
- 部署 URL(GitHub Pages 或 Vercel 域名)
- 本次变更内容

## 执行步骤

### 0. 确认部署目标(先厘清)
本项目存在**两套部署配置**,先向用户确认实际生效者:
- `.github/workflows/deploy.yml` -> **GitHub Pages**(push main 自动部署,output `packages/app/dist`)
- `vercel.json` -> Vercel(若 Vercel 项目仍挂载)

> 注意:当前 `deploy.yml` 走 GitHub Pages,但 `vercel.json` 仍在库中。部署前必须确认目标,避免验证错地址。

### 1. 基础可达性
```bash
curl -sI {URL}/ | grep -iE '^HTTP|content-type'        # 期望 200, text/html
curl -sI {URL}/games.json | grep -iE '^HTTP|content-type'  # 期望 200, application/json
```

### 2. SPA 路由(rewrites 生效)
```bash
curl -sI {URL}/privacy | grep '^HTTP'        # 期望 200(rewrites 到 index.html),非 404
curl -sI {URL}/contact-us | grep '^HTTP'     # 200
```

### 3. 游戏清单完整性
```bash
curl -s {URL}/games.json | jq 'length'                  # 游戏 N>0,且与本地 packages/games/ 一致
curl -sI {URL}/games/{某游戏id}/index.html | grep '^HTTP'  # 抽样 200
```

### 4. 安全头(CSP / X-Frame-Options / nosniff)
```bash
curl -sI {URL}/games/{id}/ | grep -iE 'content-security-policy|x-frame-options|x-content-type-options'
```
- CSP `frame-src` 含 `https://1games.io`
- `X-Frame-Options: SAMEORIGIN`
- `X-Content-Type-Options: nosniff`

### 5. iframe 游戏加载(抽样,配 Browser Automation MCP / Puppeteer)
- 打开 `GameDetailPage`,确认 iframe 游戏渲染(**非空白**)
- 控制台无 X-Frame-Options / CSP 拦截报错

### 6. 静态资源
```bash
curl -sI {URL}/sitemap.xml | grep -i content-type   # 200, application/xml
curl -sI {URL}/robots.txt | grep -i content-type    # 200, text/plain
```

### 7. 失败回退
- 部署验证失败 -> 回退到阶段 8(CI)/ 阶段 3(编码)
- 若是 CSP/iframe 问题,用 `systematic-debugging` + 查 `scripts/lib/can-embed.js`

## 输出
- `.harness/changes/{变更}/deployment/deploy_report.md`(每项检查的实际响应 + 判定 + 截图链接)

## 加载时机
L2:部署验证阶段加载。

## 红线
- 不说"部署成功了"--每项必须 curl 取证
- iframe 游戏**必须实际渲染**,不能只看 HTTP 200(wrapper 页 200 不代表 iframe 内游戏加载)
- CSP 头**必须实测**,不能假设 `vercel.json` 写了就生效(尤其 GitHub Pages 部署时 vercel.json 不生效)

## 配套 MCP(SOP 阶段十)
- Puppeteer / Browser Automation MCP:截图验证 iframe 渲染
- GitHub MCP:查 `deploy.yml` run 状态与 page_url
