# 需求规格:游戏进度存档 + 成就系统(feature-progress-achievements-20260729)

> 阶段1产出 | request-analysis(brainstorming + writing-plans)生成 | 评审见 review/spec_review_vN.md
> 创建日期:2026-07-29 | 负责人:Claude(Application Owner 调度)

## 1. 需求背景与目标

### 问题/机会
LightGame 平台已上线 52 款游戏(51 local + 1 iframe),具备收藏(FavoritesContext)与性能埋点(PerformanceContext)能力,但**没有任何跨会话的游戏进度留存与成就激励**:玩家每次打开都是"新玩家",平台无法回答"我玩过哪些、玩了多久、最高分多少、解锁了什么"。这削弱了休闲游戏平台最核心的"再来一局"留存动力。

### 目标(一句话,可验证)
为平台新增一套**纯前端、localStorage 持久化、对游戏零侵入(可降级)、对支持游戏可深度上报**的进度存档与成就系统:玩家的游玩次数/时长/最高分/最近游玩被自动记录,12 个成就可被多维度条件自动解锁并即时通知,至少 1 款本地游戏完成上报适配并验证闭环。

### 非目标(YAGNI,本期明确不做)
- **不做后端/账号/云同步**:纯 localStorage,无登录、无跨设备同步(平台本身无后端无认证)。
- **不做成就点/积分商城/排行榜**:不引入经济系统或社交排行(避免范围蔓延)。
- **不改造 PerformanceContext 的既有埋点口径**:新增进度系统独立计数,不破坏性能仪表盘。
- **不批量改造所有本地游戏**:仅选 1 款源码可改的游戏做上报适配演示,其余游戏走"被动记录"降级路径自动完整可用。
- **不动 games.json(自动生成)、不动 Vite manualChunks(ForwardRef 铁律)、不引入新 CSP 外域**。
- **不做游戏内进度(关卡状态)的跨设备续玩**:平台只记录"汇总指标 + 游戏自报的自定义进度快照",不做游戏状态机的序列化续关。

## 2. 用户故事 / 验收标准

### US-1 被动进度记录(平台侧,无需游戏配合)
- 作为玩家,我进入一款游戏的全屏游玩时,平台自动记录该游戏的**游玩次数 +1、首次/最近游玩时间**;退出全屏时累加**本次游玩时长**到总时长。
- 作为玩家,即便游戏完全不支持上报,以上记录依然完整(降级路径)。
- 验收:
  - [ ] 首次进入游戏详情页并点击 Play 进入全屏 → 该游戏 playCount=1、firstPlayedAt/lastPlayedAt 有值
  - [ ] 游玩 30 秒后退出全屏 → totalPlayDurationMs ≈ 30000(±2s 误差)
  - [ ] 刷新页面后数据仍在(localStorage 持久化)
  - [ ] 中途切后台(visibilitychange hidden)或关闭标签页(beforeunload)时,已游玩时长被 flush,不全丢

### US-2 最高分上报与破纪录
- 作为玩家,支持上报的游戏在结束/得分时把分数 postMessage 给平台,平台记录**单游戏最高分**,破纪录时触发"破纪录"相关成就。
- 验收:
  - [ ] 游戏上报 score=50 → highScore=50
  - [ ] 再上报 score=30 → highScore 仍为 50(只升不降),lastScore=30
  - [ ] 上报 score=80(破纪录)→ highScore=80,触发 🏅 Record Breaker 成就解锁(仅首次)
  - [ ] 不支持上报的游戏:highScore 为 null,但其他进度功能不受影响

### US-3 最近玩过 & 全局统计
- 作为玩家,我能看到"最近玩过"列表(按最近游玩时间倒序),以及全局统计:总游玩次数、总时长、玩过的游戏数、解锁成就数。
- 验收:
  - [ ] 连续玩 A、B、C 三款 → 最近玩过列表顺序为 C、B、A
  - [ ] 全局统计的 distinctGamesPlayed = 3、totalPlays 为各游戏次数之和、totalPlayDurationMs 为各游戏时长之和

### US-4 成就自动解锁 + 幂等通知
- 作为玩家,当我的进度/收藏满足某成就条件时,成就自动解锁并弹出通知;重复触发不会重复解锁、不会重复弹通知。
- 验收(共 12 个成就,见 §3.4):
  - [ ] 首次玩任意游戏 → 🎮 First Steps 解锁并弹一次通知
  - [ ] 玩过 5/10/20 款不同游戏 → 对应 Explorer 成就依次解锁
  - [ ] 累计游玩达 30 分钟 / 2 小时 → 对应时长成就解锁
  - [ ] 收藏第 1 款 / 第 5 款 → 对应收藏成就解锁(复用 FavoritesContext)
  - [ ] 单游戏玩 10 次 / 50 次 → 对应 Dedication 成就解锁
  - [ ] 上报破纪录分数 → Record Breaker 解锁
  - [ ] 解锁全部其他 11 个 → 👑 Completionist 元成就解锁
  - [ ] 刷新页面后已解锁成就不重复弹窗(只解锁一次)

### US-5 postMessage 协议(向后兼容)
- 作为平台,游戏 iframe 通过 `postMessage` 上报 score/progress/gameOver/event,平台在 GameDetailPage 已有的 message 监听里**扩展兼容**,不破坏既有的 SHARE_GAME / NAVIGATE_TO_HOME。
- 验收:
  - [ ] 收到 `{source:'lightgame', type:'lightgame:report', payload:{kind:'score', score:42}}` → 记录分数
  - [ ] 收到旧格式 `{type:'SHARE_GAME', data:{score:10}}` → 仍触发分享,不报错
  - [ ] 收到 `{type:'NAVIGATE_TO_HOME'}` → 仍回首页
  - [ ] 收到非预期/恶意结构消息 → 安全忽略,不崩溃(校验 event.source 为当前 iframe、payload 类型)
  - [ ] iframe 加载后平台 postMessage 一个 `lightgame:ready` 握手,游戏可据此感知平台支持

### US-6 游戏适配闭环(至少 1 款)
- 作为开发者,选一款源码可读的本地游戏注入上报脚本,验证端到端闭环。
- 候选:`packages/games/black-tiles-game/doNotTouchWhite.js`(源码可读 IIFE,有明确 `gameState.score` 与 `gameOver()` 函数,第 185 行),**非** laser-defense(gm12.min.js 压缩产物不可改)。
- 验收:
  - [ ] 在 `gameOver()` 中 `parent.postMessage({source:'lightgame', type:'lightgame:report', payload:{kind:'gameOver', score: gameState.score}}, '*')`
  - [ ] 本地 dev 玩一局结束 → 平台收到消息 → highScore 更新 → 满足条件时成就解锁
  - [ ] sync-games 后改动同步到 public/games(改源目录,不直接改 public)

### US-7 UI 展示
- 作为玩家:
  - 游戏详情页显示该游戏的进度卡片(次数 / 时长 / 最高分 / 首末游玩)
  - 游戏卡片(GameCard)对已玩过的游戏显示轻量"已玩"标记/次数角标
  - 新增 `/achievements` 页面:全局统计 + 成就网格(已解锁/未解锁,含图标标题描述解锁时间)+ 最近玩过列表
  - 成就解锁时弹出风格与现有 Tailwind/neon 主题一致的通知 Toast
- 验收:
  - [ ] GameDetailPage 在游戏信息区展示进度卡片(无数据时显示"尚未游玩"空态)
  - [ ] GameCard 对有进度的游戏显示 ✓ 已玩 + 次数
  - [ ] Header/MobileMenu/Footer 有进入 Achievements 的入口
  - [ ] `/achievements` 路由可直达,布局在 Layout 内(含 Header/Footer)
  - [ ] 解锁通知自动消失(约 4s),多条可排队,不阻挡游戏操作

## 3. 方案设计

### 3.1 选定方案(架构决策与权衡)

**决策 1:两个独立 Context(ProgressContext + AchievementsContext),非合并。**
- 理由:① 职责单一(存档 vs 成就评估),与现有 FavoritesContext/PerformanceContext 模式一致,符合 `.harness/rules/工程结构.md` 的分层;② 依赖单向——AchievementsProvider 嵌套在 ProgressProvider 与 FavoritesProvider **之内**,只读它们的状态做评估,不产生循环依赖;③ 订阅粒度更细:只关心进度数据的组件(GameCard)不必订阅成就解锁队列,降低重渲染。代价是两个文件,但可测试性更好(成就引擎做成纯函数 service)。

**决策 2:高频时长累积不进 React state,退出/切后台时 flush。**
- 游玩时长每秒 setState 会让所有 Progress 消费者重渲染。方案:进入全屏时在 GameDetailPage 用 ref 记录 sessionStart,退出全屏/visibilitychange hidden/beforeunload/每 30s 时调用 `recordPlayEnd()` 一次性累加并持久化。Context state 只在离散事件(开始、结束、上报分数)变更,低频。

**决策 3:成就评估做成纯函数,不依赖"触发上下文"。**
- 引擎签名 `evaluateAchievements(ctx, prevUnlocked) → { newlyUnlocked, next }`,输入是(进度快照 + 收藏 + 已解锁集合),输出新解锁项。"破纪录"成就的判定是"任一游戏 highScore !== null 且 > 0"(因最高分只升不降且持久化,一旦存在即代表曾破纪录),无需知道"是不是这一次破的"。幂等天然成立:只有 `next[id]` 不存在时才加入 newlyUnlocked 并弹 Toast。可直接单元测试,无需 React。

**决策 4:postMessage 协议用 `source:'lightgame'` 命名空间隔离。**
- 不与既有 `type:'SHARE_GAME'` 冲突;handler 先判 `data.source==='lightgame'` 走新协议,否则走旧逻辑分支(向后兼容)。安全上校验 `event.source === iframeRef.current?.contentWindow`,只信任当前游戏 iframe 的消息;payload 用类型守卫校验,非法即忽略。不新增外域、不改 CSP(postMessage 同源/1games.io 内,无新网络请求)。

**决策 5:新增独立 `/achievements` 页面,而非塞进 HomePage。**
- 理由:① HomePage 已 268 行,继续堆面板违反 Rules"GameDetailPage 495 行偏大,新增逻辑优先下沉/拆分"的精神;② 成就 + 统计 + 最近玩过构成独立"玩家中心",值得有可分享 URL、可在导航直达、移动端可入底栏;③ 与 Favorites 用 `/?favorites=true` 过滤首页的模式区分(成就信息密度高,不适合卡片网格内嵌)。同时在 GameCard 做轻量"已玩"角标、GameDetailPage 做进度卡片,覆盖各入口。

**决策 6:补全缺失的 ESLint 配置(预存问题修复)。**
- 现状:`packages/app` 无 `.eslintrc`,`npm run lint` 直接报 "couldn't find a configuration file"(laser-defense 总结已记录为教训 #2,"lint 门禁形同虚设")。需求铁律要求 lint 通过,故新增一份与已装插件(@typescript-eslint 6.x、eslint-plugin-react-hooks 4.x、eslint-plugin-react-refresh 0.4.x)匹配的 `.eslintrc.cjs`,并修掉其暴露的既有 `any` 技术债(fullscreen vendor 前缀、gameService 的 `(game:any)`)。规则集保持项目编码规范:禁裸 any、react-hooks 规则、react-refresh 仅组件导出。**这是使门禁可执行的必要前置,非范围蔓延**,会在 coding_report 中单列说明。

**决策 7:localStorage 结构带 version 字段,预留迁移。**
- 两个 key(`lightgame-progress` v1、`lightgame-achievements` v1)各自带 `version`,加载时若版本低于当前则走 `migrate()`(v1 无历史可迁,但 scaffold 好 switch,未来 v2 可加)。读取/写入全程 try/catch,参照 FavoritesContext 容错写法,损坏数据回退默认值不崩应用。

### 3.2 架构影响(涉及模块/文件,参考工程结构规则)

**新增(类型/服务/状态层):**
- `packages/app/src/types/index.ts`(扩展):追加进度/成就/协议类型
- `packages/app/src/services/progressStorage.ts`:load/save/migrate/defaults(纯函数,可测)
- `packages/app/src/services/achievementDefinitions.ts`:12 个成就定义(数据 + evaluate 谓词)
- `packages/app/src/services/achievementEngine.ts`:evaluateAchievements 纯函数(可测)
- `packages/app/src/services/gameMessageProtocol.ts`:消息解析/类型守卫/握手消息构造(纯函数,可测)
- `packages/app/src/services/format.ts`:时长/数字格式化(纯函数,可测)
- `packages/app/src/contexts/ProgressContext.tsx`:进度 Provider + useProgress
- `packages/app/src/contexts/AchievementsContext.tsx`:成就 Provider + useAchievements + 解锁队列

**新增(UI 层):**
- `packages/app/src/pages/AchievementsPage.tsx`:成就中心页
- `packages/app/src/components/GameProgressCard.tsx`:详情页进度卡片
- `packages/app/src/components/AchievementUnlockToast.tsx`:解锁通知(+ 可选 `.module.css`)
- `packages/app/src/components/AchievementIcon.tsx`:成就图标渲染(emoji/FontAwesome)
- `packages/app/src/components/RecentlyPlayed.tsx`:最近玩过列表
- PlayedBadge 内联于 GameCard(已玩角标,不单列文件)

**修改(集成点):**
- `packages/app/src/App.tsx`:Provider 嵌套新增(ProgressProvider > FavoritesProvider > AchievementsProvider)+ `/achievements` 路由
- `packages/app/src/pages/GameDetailPage.tsx`:集成 session 开始/结束计时、message handler 扩展协议、渲染进度卡片、握手 postMessage
- `packages/app/src/components/GameCard.tsx`:已玩角标
- `packages/app/src/components/Header.tsx`、`MobileMenu.tsx`、`Footer.tsx`、`MobileBottomNav.tsx`:成就入口
- `packages/app/.eslintrc.cjs`(新增配置)+ 修复既有 `any`(GameDetailPage、gameService)

**游戏适配:**
- `packages/games/black-tiles-game/doNotTouchWhite.js`:在 `gameOver()` 注入上报(改源目录,经 sync-games 同步)

**测试(阶段5):**
- `packages/app/src/services/__tests__/progressStorage.test.ts`
- `packages/app/src/services/__tests__/achievementEngine.test.ts`
- `packages/app/src/services/__tests__/gameMessageProtocol.test.ts`
- `packages/app/src/services/__tests__/format.test.ts`
- Vitest 配置:`packages/app/vitest.config.ts` + devDependency(vitest)

**变更产物:**
- `.harness/changes/feature-progress-achievements-20260729/` 全流程

### 3.3 数据结构(localStorage v1)

```ts
// key: 'lightgame-progress', version: 1
interface ProgressState {
  version: 1;
  games: Record<string, GameProgress>; // key = gameId
}
interface GameProgress {
  gameId: string;
  playCount: number;
  totalPlayDurationMs: number;
  highScore: number | null;
  lastScore: number | null;
  firstPlayedAt: number; // epoch ms
  lastPlayedAt: number;  // epoch ms
  customProgress: Record<string, unknown> | null; // 游戏自报进度快照
}

// key: 'lightgame-achievements', version: 1
interface AchievementsState {
  version: 1;
  unlocked: Record<string, { unlockedAt: number }>; // key = achievementId
}
```

### 3.4 12 个成就定义

| id | 标题 | 图标 | 维度 | 解锁条件 |
|---|---|---|---|---|
| first-play | First Steps | 🎮 | play | totalPlays >= 1 |
| explorer-5 | Explorer | 🗺️ | play | distinctGamesPlayed >= 5 |
| explorer-10 | Adventurer | 🧭 | play | distinctGamesPlayed >= 10 |
| explorer-20 | World Traveler | 🌍 | play | distinctGamesPlayed >= 20 |
| playtime-30m | Half Hour Hero | ⏱️ | duration | totalPlayDurationMs >= 30*60*1000 |
| playtime-2h | Marathon Player | ⏰ | duration | totalPlayDurationMs >= 2*60*60*1000 |
| first-favorite | First Love | ⭐ | collection | favorites.length >= 1 |
| collector-5 | Collector | 💖 | collection | favorites.length >= 5 |
| dedication-10 | Devoted | 🔥 | play | max(playCount) >= 10 |
| dedication-50 | True Fan | 💎 | play | max(playCount) >= 50 |
| record-breaker | Record Breaker | 🏆 | score | 任一 game.highScore !== null && > 0 |
| completionist | Completionist | 👑 | meta | 其余 11 个全部解锁 |

评估顺序:先评估全部非 meta 成就并解锁满足项,再用"解锁后集合"评估 meta,避免 meta 把自己算进分母。

### 3.5 postMessage 协议(v1)

游戏 → 平台:
```ts
interface LightGameReportMessage {
  source: 'lightgame';
  type: 'lightgame:report';
  payload:
    | { kind: 'score'; score: number; label?: string }
    | { kind: 'progress'; data: Record<string, unknown> }
    | { kind: 'gameOver'; score?: number; progress?: Record<string, unknown> }
    | { kind: 'complete'; score?: number }
    | { kind: 'event'; event: string; data?: Record<string, unknown> };
}
```
平台 → 游戏(iframe onLoad 后握手):
```ts
{ source: 'lightgame', type: 'lightgame:ready', gameId: string, v: 1 }
```
- `score` 为有限非负 number,否则忽略;`label` 为可选展示文案。
- `gameOver` 同时带 score 时等价于先 score 再 gameOver;`complete` 标记通关(为未来成就预留,本期记日志/自定义进度,不新增通关成就以控范围)。
- `event` 为自定义事件(扩展点),本期写入 customProgress 并 console.debug,不直接解锁成就(避免游戏随意解锁)。

### 3.6 数据流 / 组件交互

```
GameDetailPage
  ├─ 点击 Play/enterFullScreen → progress.recordPlayStart(gameId)
  │     └─ ProgressContext: 更新 games[id].playCount/时间,持久化
  │           └─ (state 变更) → AchievementsContext useEffect 触发 evaluateAchievements
  │                 └─ 新解锁 → setState + 持久化 + push 解锁队列
  ├─ iframe onLoad → iframe.contentWindow.postMessage(ready)
  ├─ window message handler:
  │     ├─ source==='lightgame' → gameMessageProtocol.parse → progress.reportScore/reportProgress/...
  │     ├─ type==='SHARE_GAME' → 既有 handleShare(不改)
  │     └─ type==='NAVIGATE_TO_HOME' → 既有回首页(不改)
  ├─ exitFullScreen / visibilitychange / beforeunload / 30s interval
  │     └─ progress.recordPlayEnd() → 累加时长 + 持久化 → 触发成就评估
  └─ 渲染 <GameProgressCard gameId={game.id} />

AchievementsContext(解锁队列)
  └─ <AchievementUnlockToast host/> 在 App/Layout 层订阅队列,自动展示/消失

Layout 路由
  └─ /achievements → <AchievementsPage/> (统计 + 成就网格 + 最近玩过)
GameCard
  └─ useProgress().getProgress(id) → 已玩角标
```

Provider 嵌套顺序(App.tsx):
```
HelmetProvider
  PerformanceProvider          (既有,不动)
    ProgressProvider            (新增,最外层业务态)
      FavoritesProvider         (既有,成就需读收藏,故 Achievements 在其内)
        AchievementsProvider    (新增,消费 progress + favorites)
          Routes / Analytics
```
> 注:AchievementsProvider 必须在 ProgressProvider 与 FavoritesProvider 之内才能消费两者。原嵌套为 PerformanceProvider > FavoritesProvider;新增 ProgressProvider 置于 FavoritesProvider 外、AchievementsProvider 置于 FavoritesProvider 内。

## 4. 约束与风险

### 业务约束(对照项目编码规范硬约束)
1. Vite `manualChunks` 保持 `undefined`,**不动 vite.config.ts 的 build 段**(ForwardRef 铁律)。
2. 不手改 `packages/app/public/games.json`,只经 `npm run build:games:list` 生成。
3. 游戏源改动只在 `packages/games/black-tiles-game/`,经 `sync-games` 拷贝到 public;不直接改 public 下的游戏文件。
4. iframe 仍仅 1games.io;postMessage 不引入新外域、不改 CSP/vercel.json。
5. 路径用 `@/` 别名;TS strict 不降级;禁裸 `any`(修复既有 any,新代码用 unknown + 守卫)。
6. 新增游戏 id 与目录名一致——本期不新增游戏,仅改 black-tiles-game 源码。
7. 文档(docs/.harness 下)用中文,代码与类型用英文。
8. 不提交 node_modules/dist/.env;需入库资产只放 .harness(不放 docs,被 gitignore)。

### 技术风险
| 风险 | 影响 | 缓解 |
|---|---|---|
| `/mnt/tos` 网络盘 I/O 极慢(已实测复制 293M 超时) | 构建/git 操作慢 | 全程在 `/tmp/lightgame-extract/Lightgame`(本地盘,已含 node_modules)开发;推送阶段再处理 |
| zip 内 node_modules 缺可执行位/跨平台可选依赖 | build 失败 | 已 `chmod +x node_modules/.bin/*` 并补装 `@rollup/rollup-linux-x64-gnu`(tsc 已过、vite build 已过,基线绿) |
| 既有 309 文件 CRLF 差异 | 误提交海量噪声 | 已设 `core.autocrlf=false` 并 `git checkout -- .` 恢复干净 LF 工作树;仅提交本次真实改动 |
| localStorage 损坏/配额满/隐私模式 | 写失败 | 全程 try/catch,读失败回退默认,写失败 console.error 不崩(FavoritesContext 同款容错) |
| 成就 useEffect 死循环/StrictMode 双弹 Toast | 重复解锁 | 评估为纯函数幂等;用 unlockedRef 读最新已解锁集合,只在有新解锁时 setState+入队;StrictMode 二次执行时 newlyUnlocked 为空 |
| message 事件被其他窗口伪造 | 脏数据 | 校验 `event.source === iframeRef.contentWindow` + payload 类型守卫;只信任当前游戏 iframe |
| 游玩时长在崩溃/强杀时丢失 | 时长偏少 | 30s 周期 flush + visibilitychange/beforeunload flush 兜底 |
| 补 ESLint 配置暴露大量既有告警 | lint 门禁不过 | 阶段3先跑 lint 取样,按最小必要修复(主要是 any),规则不误伤;记录在 coding_report |

### 依赖
- **阶段5需引入 Vitest**(项目当前无单测框架,application-owner.md "已知缺口"已注明首次需引 Vitest)。版本选与 Vite 5 兼容的 vitest ^1.6.x;仅 devDependency,不影响生产包。本期只测纯 service 函数,用 `node` 环境(不引 jsdom)。
- ESLint 配置不新增依赖(插件已在 devDependencies)。
- 不新增运行时依赖。

## 5. 澄清问题闭环

| # | 问题 | 决议 | 来源 |
|---|---|---|---|
| 1 | Context 合并还是拆分? | **拆分**为 ProgressContext + AchievementsContext,单向依赖(见 §3.1 决策1) | 自行决策,理由已记录 |
| 2 | 成就面板挂 HomePage 还是独立页? | **独立 `/achievements` 页** + GameCard 角标 + 详情页卡片(见 §3.1 决策5) | 自行决策,理由已记录 |
| 3 | 适配哪款本地游戏? | **black-tiles-game**(doNotTouchWhite.js 可读,有 score/gameOver);laser-defense 是 gm12.min.js 压缩产物不可改 | 自行决策,源码核查 |
| 4 | "游玩次数"口径? | 以**点击 Play 进入全屏(iframe 真正加载)**为一次 play;详情页浏览由 PerformanceContext 既有 page-view 口径记录,不重复(见 §3.1 决策2) | 自行决策 |
| 5 | 无 ESLint 配置导致 lint 门禁不可执行怎么办? | 补 `.eslintrc.cjs` 并修既有 any 债(见 §3.1 决策6) | 自行决策,laser-defense 教训#2 |
| 6 | 是否引入单测框架? | **引入 Vitest**(阶段5),仅测纯函数(node 环境,不引 jsdom) | application-owner 已知缺口 |
| 7 | 工作目录在 /tmp 而非 /mnt/tos? | 因网络盘 I/O 超时,在 `/tmp/lightgame-extract/Lightgame` 开发(本地盘,node_modules 齐全,基线门禁已绿);代码即真实仓库副本,push 阶段推送 main | 环境实测 |

> 以上均为基于代码事实的工程决策,无阻塞性需求歧义。若用户对"独立成就页 vs 内嵌首页""游玩次数口径"有不同偏好,可在 HITL-1 提出调整。

## 6. 评审状态
- 当前版本:v1
- 评审记录:review/spec_review_v1.md(阶段2产出)
- 状态:⬜待评审
