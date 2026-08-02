# 单元测试报告

> 阶段5产出 | Vitest 1.6 | 2026-07-30
> 项目首次引入单测框架(application-owner "已知缺口")。仅测纯函数 service,node 环境,不引 jsdom。

## 框架引入
- devDependency:`vitest@^1.6.1`(与 Vite 5 兼容)
- 配置:`packages/app/vitest.config.ts`(复用 @ 别名,environment: 'node')
- 脚本:package.json `"test": "vitest run"`, `"test:watch": "vitest"`
- 运行位置:`packages/app/`

## 测试结果(真实输出)
```
 ✓ src/services/__tests__/progressStorage.test.ts   (18 tests)
 ✓ src/services/__tests__/achievementEngine.test.ts (11 tests)
 ✓ src/services/__tests__/gameMessageProtocol.test.ts (9 tests)
 ✓ src/services/__tests__/format.test.ts            (9 tests)

 Test Files  4 passed (4)
      Tests  47 passed (47)
   Duration  678ms
TEST=0
```

## 覆盖的行为
1. **format(9)** — duration 各档位、number 千分位、score null、date 边界。
2. **gameMessageProtocol(9)** — 5 种 payload 合法解析;错误 source/type/非法 score(负/NaN/字符串/缺失)/非对象/未知 kind/event 缺名拒绝;ready 握手结构。
3. **progressStorage(18)** — default;migrate 对 null/非对象/错版本/脏数据;sanitize;startPlay 首次/再次/不可变;addDuration 累加边界;recordScore 只升不降返回 isNewHighScore;mergeCustomProgress 浅合并;getRecentGames 排序限流;stats/maxPlay/hasHighScore 聚合;localStorage 损坏回默认、round-trip、setItem 抛错不传播。
4. **achievementEngine(11)** — 每个成就阈值;completionist 仅其余 11 全解锁才触发且不计自己;幂等(不重复解锁、二次评估空)。

## 过程说明
- 先以 tsc/lint 锁契约再补测试(项目此前无测试基建);测试运行中发现 2 处问题已修:
  1. formatDuration 秒级输出为 "45s"(测试原期望 "0m 45s",以实现简洁展示为准修测试)。
  2. 幂等用例 distinctGamesPlayed 误写为 1,修正为 5 才满足 explorer-5。
- saveProgress 容错用例的 stderr "Error saving progress: quota" 是预期 console.error(验证不抛异常),非失败。

## 边界与错误用例自查
- [x] 边界条件覆盖(0/负数/NaN/空状态/阈值临界)
- [x] 异常/错误路径覆盖(损坏 JSON、存储抛错、非法消息)
- [x] 无 mock 滥用(仅对 localStorage 做最小内存 stub,测真实行为)
- [x] 每个新纯函数有测试;Context/UI 为 React 集成层,经 build/lint + 人工自测覆盖

## 运行命令
```bash
cd packages/app && npx vitest run   # 47 passed
```
