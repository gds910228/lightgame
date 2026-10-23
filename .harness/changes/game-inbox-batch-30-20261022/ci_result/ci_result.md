# CI 结果(本地门禁,2026-10-22)
- node scripts/validate-games.js: ✅ 82 passed, 0 failed
- node packages/app/scripts/build-games-list.js: ✅ wrote 82 games
- npm run lint: ✅ 0 warnings 0 errors
- npm run build: ✅ built(dist/games.json 82,dist/games 82 目录)
- node --check:所有改动 JS 通过
- headless sweep(30 新游戏):pageerror=0 / reqfail 仅豁免项
