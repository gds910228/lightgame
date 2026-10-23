# 验证取证报告 v1(Playwright 全量,三轮)

> 编码评审 I-2 落盘要求 | 环境:Chromium headless 1280x720 / dev server localhost:3000 | 证据脚本与截图在系统临时目录 `%TEMP%\lgverify\`(r2_*/r3_*/r4_*、shots2~4/)与 `%TEMP%\ss-*`

## 轮次概览

| 轮 | 触发 | 结果 | 发现 |
|---|---|---|---|
| R1 | 初版编码后 | 6 PASS / 4 FAIL | 游戏本体修复全过;平台 aspectRatio 未生效(gameService 丢字段 + 百分比公式跨不了轴);soccer 速度修复暴露撞墙 NaN |
| R2 | 三重修复后(gameService 透传 + containerType:size/cqw/cqh + Moved 钳制) | 5 PASS / 1 FAIL | 平台层全过(480x720/405x720 精确);smartphone 点击开始链路死(库固有 bug:构造器丢 config) |
| R3 | 修 Toucher.kR.extend 构造器 | 1 FAIL | config 生效但引出 `İ` 双重身份:注册器 0 参调用 tap 处理器在 U[0] 崩溃,onload 链中断 |
| R4 | 加 `if(!U) return` 守卫 + 修 Н 过滤器参数位(第 4 参→第 3 参) | **全 PASS** | 三层修复链打通 |

## 最终验证结论(全部 PASS,证据为实测数值/截图)

| # | 项 | 结果 | 关键证据 |
|---|---|---|---|
| A1 | peach 直开画面完整 | PASS | #container rect=(0,0,1280x720),top=0(修复前 -360);标题/按钮完整;0 pageerror |
| A2 | peach 平台全屏层 | PASS | iframe 480x720 @ x=400(2:3 精确);竖条居中黑边;画面完整 |
| B1 | skyscraper 全屏层 | PASS | iframe 480x720;visibleSize=320x480(设计世界全可见,修复前 320x180);顶部 HUD(红心/分数/楼层)+GO 按钮截图可见 |
| B2 | skyscraper 直开对比 | 符合预期 | 直开仍显示不全(游戏代码未改,修复靠平台竖屏容器)——与 B1 拉开差异证明平台层生效 |
| C1 | smartphone 全屏层 | PASS | iframe 405x720 @ x=437.5(9:16 精确);canvas 640x1137>567;TAP TO START 可见(3525 亮色像素) |
| C2 | smartphone 点击开始 | PASS | 像素差 93.56%(标题→射击场景);0 pageerror |
| C3 | smartphone 游戏内连点 | PASS | 4 次点击 83.89%~94.02% 反馈;游戏状态 В.v 坐标与派发坐标逐位吻合((291,324)/(202,489)/(263,561));0 pageerror |
| C4 | smartphone 直开 | PASS | 95.24% 场景切换;0 pageerror |
| D1 | soccer 键盘速度 | PASS | ~210-220px/s(配置 200);撞右墙 x 钳制 225.75 稳定无 NaN(R1 曾 NaN 已修);上下墙钳制 16.5/372.5 精确吻合边界 |
| D2 | soccer 鼠标拖动 | PASS | Player x 98→203 平滑 tween 至预期目标 203.75;y 269.5≈270 |
| D3 | soccer 无 pageerror | PASS | 全轮次 errors=[] |
| E | tickle 点击开始 | PASS | click #start 后 .intro display:none、#go 出现→主循环推进(.feet 显示);0 pageerror |
| F1 | 回归:tetris 无 aspectRatio | PASS | iframe 1280x720 铺满(零回归) |
| F2 | 回归:封面卡片 | PASS | moon-rabbit→mmttt.png(150x149 彩色)、retro→53fe872815c9a.jpeg(640x960 彩色)均加载成功非黑块 |
| G | 回归:snake 直开+peach | PASS | snake 全屏铺满;peach A1 保持 |

## 门禁
- `npx tsc --noEmit` exit 0(依赖恢复后)
- `npm run lint` 0 warning(--max-warnings 0)
- `npm run build` 成功(dist 产物: index.html 4.62kB / css 44.36kB / js 415.23kB;第二轮修复后重跑 ✓ built in 5.70s)
- `npm run validate:games` 82/82
- `npm run build:games:list` 稳定性:两轮后 moon-rabbit(mmttt.png)/retro(jpeg)均被 preserveManualPath 保留;52 存量游戏零字段漂移(评审独立复核)

## 第二轮用户反馈验证(2026-10-23 追加,全 PASS)

| 项 | 结果 | 证据 |
|---|---|---|
| peach 鼠标拖动即时跟随 | PASS | monkey.x 与 指针x−猴宽/2 误差全部为 0(直开+平台全屏层 iframe 双环境);快速拖动 20ms 内到位零延迟;mouseup 后停止跟随;0 pageerror |
| smartphone 结算不再自动弹分享 | PASS | 结算+PLAY AGAIN 重开两轮:handleGlobalShare/navigator.share/lgShare 调用全 0,无弹窗无 toast;结算画面(SCORE+PLAY AGAIN)正常;0 pageerror |
| soccer 碰撞链路恢复 | PASS(6/6) | hitbox 未腐蚀(map.points 32 数字无 NaN);Pile 命中 hp 3→2 + .life "2" + 皮肤 618ms 切换;Jersey 命中 hp+1(×3);连撞至 hp 0 → Gameover 面板(得分 61/称号 Trainee);键盘 dx=36px 与 201px/s×0.18s 精确吻合;0 pageerror |

## 附:smartphone-shooter 三层 bug 链(库内固有,任何环境都不可玩)
1. `Toucher.kR.extend` 生成的构造器丢弃 `new` 时传入的 config(基类 kR 构造器本有拷贝逻辑,子类构造器漏调)→ tap 处理器落到原型空函数
2. `İ` 身兼二职(基类 init 钩子/Ι 类 tap 回调),config 生效后注册器 0 参调用真处理器 → `U[0]` 崩溃中断 onload → splash 场景不渲染
3. tap 过滤器 `Н` 读第 4 参 `.target`(约定第 3 参才是 event,第 4 参是 manager)→ 每次真实指针事件在过滤器层崩溃,先于守卫

修复:①构造器补 config 拷贝(命名空间默认在前,config 优先)②处理器入口 `if(!U) return` ③过滤器改读第 3 参并防御 `!!(А && А.target && ...)`
