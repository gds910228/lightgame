# 部署报告
- 未推送/未部署(遵循约束)。
- 本地产物:packages/app/public/games.json(82)、packages/app/public/games/(82)、packages/app/dist 构建成功。
- sitemap:packages/app/public/sitemap.xml 追加 30 条 /game/<id>,lastmod 2026-10-22。
- 上线前建议:在预发环境以 iframe 实测父级 handleGlobalShare(本地为 navigator.share 降级)。
