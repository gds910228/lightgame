# 任务清单:游戏进度存档 + 成就系统

> 阶段1产出 | request-analysis(writing-plans)生成 | 每步可独立验证 | checkbox 跟踪
> 编码顺序遵循依赖:类型 → 纯函数 service → Context → UI 集成 → 游戏适配 → 门禁

## 任务依赖图
```
T1 类型扩展
  ├─ T2 progressStorage(纯)
  ├─ T3 gameMessageProtocol(纯)
  ├─ T4 achievementDefinitions + engine(纯)
  └─ T5 format(纯)
       ├─ T6 ProgressContext(依赖 T2)
       └─ T7 AchievementsContext(依赖 T4,T6,Favorites)
             ├─ T8 App.tsx Provider 嵌套 + 路由
             ├─ T9 GameDetailPage 集成(计时/协议/进度卡)
             ├─ T10 GameProgressCard / AchievementUnlockToast / AchievementIcon
             ├─ T11 AchievementsPage + RecentlyPlayed
             ├─ T12 GameCard 已玩角标
             └─ T13 导航入口(Header/MobileMenu/Footer)
                   ├─ T14 black-tiles 游戏适配
                   └─ T15 ESLint 配置 + 既有 any 修复
                         └─ T16 本地门禁三件套取证
```
纯函数(T2-T5)与 UI(T8-T13)在依赖就绪后串行完成;本会话 Application Owner 直接实现(单 implementer,不并行以避免冲突,符合 Agent Must-not-do #7)。

---

## 阶段3:编码实现

### Task 1: 扩展共享类型
**文件:** Modify `packages/app/src/types/index.ts`
- [ ] Step 1: 追加 GameProgress、ProgressState、AchievementDefinition、AchievementEvaluationContext、AchievementsState、UnlockedAchievement、LightGameReportPayload(判别联合)、LightGameReportMessage、LightGameReadyMessage、PlaySession
- [ ] Step 2: interface 描述对象,type 描述联合;字段必填/可选明确,不滥用 `?`
- [ ] Step 3: `npx tsc --noEmit -p packages/app/tsconfig.json` 通过

### Task 2: progressStorage(纯函数 + localStorage)
**文件:** Create `packages/app/src/services/progressStorage.ts`
- [ ] Step 1: PROGRESS_STORAGE_KEY='lightgame-progress'、VERSION=1、defaultProgressState()
- [ ] Step 2: loadProgress() try/catch + 版本校验 + 损坏回默认;migrateProgress(raw) switch
- [ ] Step 3: saveProgress(state) try/catch,失败 console.error 不抛
- [ ] Step 4: 纯派生 startPlay/addDuration/recordScore/getRecentGames/getTotalStats,返回新对象
- [ ] Step 5: 不裸 any;JSON.parse 用 unknown + 守卫

### Task 3: gameMessageProtocol(纯函数)
**文件:** Create `packages/app/src/services/gameMessageProtocol.ts`
- [ ] Step 1: isLightGameReportMessage(data: unknown) 类型守卫
- [ ] Step 2: payload 校验;score 校验 finite 非负,非法 null
- [ ] Step 3: buildReadyMessage(gameId)

### Task 4: achievementDefinitions + achievementEngine
**文件:** Create achievementDefinitions.ts、achievementEngine.ts
- [ ] Step 1: ACHIEVEMENTS 12 个(spec §3.4),含 id/title/description/icon/category/evaluate(ctx)
- [ ] Step 2: meta completionist 单独处理(不算自己)
- [ ] Step 3: evaluateAchievements(ctx, prevUnlocked, now) 先非 meta 后 meta;幂等
- [ ] Step 4: now 参数注入

### Task 5: format(纯函数)
**文件:** Create `packages/app/src/services/format.ts`
- [ ] formatDuration(ms)/formatNumber/formatDate/formatScore(null→"—")
- [ ] 边界(0/负数/NaN)

### Task 6: ProgressContext
**文件:** Create `packages/app/src/contexts/ProgressContext.tsx`
- [ ] Step 1: ProgressContextType + useProgress(未挂载抛错)
- [ ] Step 2: useState 懒初始 loadProgress();useEffect 持久化
- [ ] Step 3: useRef 存 session;recordPlayStart 更新 count/时间 + 30s interval flush
- [ ] Step 4: recordPlayEnd 累加时长清 interval;无 session no-op
- [ ] Step 5: recordScore 返回 {isNewHighScore}
- [ ] Step 6: useCallback/useMemo;不裸 any;totalStats useMemo 派生

### Task 7: AchievementsContext
**文件:** Create AchievementsContext.tsx、services/achievementStorage.ts
- [ ] Step 1: ContextType(定义列表/unlocked/queue/dismissUnlock/unlockedCount)
- [ ] Step 2: loadAchievements/saveAchievements(v1,try/catch)
- [ ] Step 3: useEffect 订阅 progress+favorites;unlockedRef 读最新;evaluate;新解锁 setState+save+push(幂等)
- [ ] Step 4: dismissUnlock;queue 上限 5
- [ ] Step 5: unlocked 不进 effect deps(用 ref)防循环

### Task 8: App.tsx Provider + 路由
**文件:** Modify `packages/app/src/App.tsx`
- [ ] Step 1: import 新 Provider + AchievementsPage
- [ ] Step 2: 嵌套 HelmetProvider > PerformanceProvider > ProgressProvider > FavoritesProvider > AchievementsProvider > Routes/Analytics
- [ ] Step 3: `<Route path="achievements">`
- [ ] Step 4: 全局挂载 `<AchievementUnlockToast/>`
- [ ] Step 5: tsc 通过

### Task 9: GameDetailPage 集成
**文件:** Modify `packages/app/src/pages/GameDetailPage.tsx`
- [ ] Step 1: import useProgress/protocol/GameProgressCard;session refs
- [ ] Step 2: enterFullScreen recordPlayStart;exitFullScreen recordPlayEnd
- [ ] Step 3: handleIframeLoad postMessage ready
- [ ] Step 4: message handler:event.source 校验 → lightgame 协议分派 → 否则 SHARE_GAME/NAVIGATE_TO_HOME
- [ ] Step 5: visibilitychange/beforeunload flush;unmount 清理
- [ ] Step 6: 渲染 GameProgressCard
- [ ] Step 7: 替换 `as any` fullscreen 为类型化 helper

### Task 10: UI 组件
**文件:** Create GameProgressCard.tsx、AchievementUnlockToast.tsx、AchievementIcon.tsx
- [ ] Step 1: GameProgressCard 次数/时长/最高分/首末游玩;空态;neon 主题
- [ ] Step 2: AchievementIcon emoji;locked 灰显
- [ ] Step 3: Toast 订阅 queue,队首 4s dismiss,排队,slide-in,z-[10000],pointer-events-none
- [ ] Step 4: 视觉对齐 ToastNotification(毛玻璃),金色边框

### Task 11: AchievementsPage + RecentlyPlayed
**文件:** Create AchievementsPage.tsx、RecentlyPlayed.tsx
- [ ] Step 1: 统计卡(玩过数/总次数/总时长/解锁 X/12)
- [ ] Step 2: 12 成就网格(已解锁彩色+时间,未解锁灰显)
- [ ] Step 3: RecentlyPlayed getRecentGames(8) 紧凑列表跳详情
- [ ] Step 4: 空态引导
- [ ] Step 5: SEO

### Task 12: GameCard 已玩角标
**文件:** Modify `packages/app/src/components/GameCard.tsx`
- [ ] useProgress().getProgress;有进度右下 ✓ Played + 次数(neon-green);不遮挡 Favorite

### Task 13: 导航入口
**文件:** Modify Header.tsx、MobileMenu.tsx、Footer.tsx
- [ ] Header 桌面端 Achievements 按钮(trophy,解锁数角标)
- [ ] MobileMenu Quick Links 加项
- [ ] Footer 加链接
- [ ] MobileBottomNav 已满不新增(权衡记 coding_report)

### Task 14: black-tiles 适配
**文件:** Modify `packages/games/black-tiles-game/doNotTouchWhite.js`
- [ ] IIFE 内 reportToPlatform(kind,payload) helper,parent.postMessage,try/catch
- [ ] gameOver() 调 reportToPlatform('gameOver',{score})
- [ ] npm run sync-games 同步
- [ ] 不改 metadata.json

### Task 15: ESLint 配置 + 既有 any 修复
**文件:** Create `packages/app/.eslintrc.cjs`;Modify GameDetailPage.tsx、gameService.ts
- [ ] .eslintrc.cjs(env/extends/plugins/rules,no-explicit-any error,react-hooks,react-refresh)
- [ ] 跑 lint 取样,修(fullscreen helper、RawGameMeta + unknown 守卫)
- [ ] 复跑 lint 至 0 warning

### Task 16: 本地门禁取证
- [ ] validate:games(52)、lint(0 warning)、tsc(0 error)、build(dist 存在)
- [ ] 真实输出贴 coding_report_v1.md + summary.md

---

## 阶段5:单元测试(Vitest,RED-GREEN-REFACTOR)

### Task 17: 引入 Vitest
**文件:** Create vitest.config.ts;Modify package.json
- [ ] 安装 vitest ^1.6 devDep;test 脚本;environment node;冒烟

### Task 18-20: 纯函数测试
- [ ] progressStorage.test.ts(default/startPlay/addDuration/recordScore/recent/stats/损坏/版本/save异常)
- [ ] achievementEngine.test.ts(12 成就阈值/幂等/meta 不计自己)
- [ ] gameMessageProtocol.test.ts + format.test.ts(合法非法/各档位)
- [ ] `npm test` 全绿汇总

---

## 全局验证(阶段4 / 阶段7)
- [ ] validate:games 退出 0(52)
- [ ] lint 退出 0(0 warning)
- [ ] tsc --noEmit 退出 0
- [ ] build 退出 0(dist 含 games.json 52 条)
- [ ] 浏览器闭环:black-tiles 结束 → 最高分/次数 → 成就通知 → /achievements → 刷新持久化
- [ ] code-reviewer 子代理评审(不传会话历史);Critical=0 & Important=0
