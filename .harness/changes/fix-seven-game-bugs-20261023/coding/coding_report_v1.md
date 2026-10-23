# 编码报告 v1(最终版,含验证迭代)

> 阶段3产出 | 执行方式:主会话直接实现(每处修改行数小且诊断上下文充分,派发子代理的通信失真风险大于收益)
> 版本:v1(内容更新至验证后终态) | 状态:DONE

## 实现概要
- 完成任务数:7/7(spec Task 1~7)+ 验证驱动补丁(见"迭代记录")
- 工作分支:main(直接开发)
- Base SHA:d8dece9 → Head SHA:(待提交)

## 最终改动清单

### 平台侧
1. `packages/app/src/types/index.ts`:Game 接口加 `aspectRatio?: string`
2. `packages/app/src/services/gameService.ts`(验证 R1 发现遗漏):RawGameMeta 加 aspectRatio;getAllGames map 用条件 spread 透传 `...(isString(raw.aspectRatio) ? { aspectRatio: raw.aspectRatio } : {})`
3. `packages/app/src/pages/GameDetailPage.tsx`:
   - `parseAspectRatio()`:"w:h" → 正数 ratio(正则严格校验)
   - `aspectFitStyle`:**cqw/cqh 容器查询单位公式**(spec v2 公式演进记录;百分比公式实测跨不了轴):`width: min(100cqw, calc(100cqh * R))`、`height: min(100cqh, calc(100cqw / R))`
   - 全屏容器 `containerType: 'size'`(启用容器查询)+ `flex items-center justify-center`;iframe style 展开 aspectFitStyle
   - `requestFullscreen` 的 `swallow()` 兜底(验证中暴露的偶发 unhandled rejection)
   - 无 aspectRatio 游戏:style undefined,DOM 输出零变化(实测回归通过)

### 游戏侧
4. `peach-catch-frenzy/index.html:46`:删内联 `top:-50%`;`metadata.json` 加 `"aspectRatio": "2:3"`
5. `skyscraper-stack/metadata.json`:加 `"aspectRatio": "2:3"`(不动 minified Cocos 代码)
6. `smartphone-shooter/metadata.json`:加 `"aspectRatio": "9:16"`
7. `smartphone-shooter/js/all-in-one.js`(**验证 R2/R3/R4 迭代发现的三层库固有 bug**):
   - ① `Toucher.kR.extend` 生成构造器补 config 拷贝(命名空间默认在前,实例 config 优先)——原构造器丢参数导致 tap/swipe 处理器全部落到原型空函数
   - ② tap 处理器 İ 入口 `if (!U) return` 守卫——İ 身兼基类 init 钩子(注册器 0 参调用)与 tap 回调(5 参)两职
   - ③ tap 过滤器 Н 改读第 3 参 event:`return !!(А && А.target && А.target.tagName == "CANVAS")`——原读第 4 参 manager(无 .target)每次真实指针事件必崩
   - 影响面:extend 子类 АE/Ι/P5/Z 中仅 Ι/Z 有实例化点,已评审确认收敛
8. `soccer-dash/index.html`:
   - `Crafty.config.speed: 6 → 200`(px/s;仅 movementSpeed 一处消费)
   - iTouch:touchMove 抽共享 `movePlayer(x,y)`;补 mousedown(e.preventDefault)/mousemove(仅按下时)/document.mouseup 三监听;坐标 getBoundingClientRect 换算 stage 相对(mouse 事件无 touches[0],适配接口)
   - **验证 R1 发现新缺陷并修**:Moved 回调改 `from.axis === 'x' ? from.oldValue : this.x`(Crafty 0.7.1 载荷为 {axis,oldValue},原 from.x 写法在提速撞墙后产生 NaN 永久锁死)
   - begin click 加 `window.focus()`
9. `soccer-dash/metadata.json`:加 `"aspectRatio": "2:3"`
10. `tickle-frenzy/js/35/index4.js:82,86,88`:3 处 `.tap(fn)` → `.on('click', fn)`(答题/#start/.retry),零残留

### 数据
11. `packages/app/public/games.json`:retro-game-tune-quiz image/thumbnail → `Public/upload/6177/53fe872815c9a.jpeg`(640x960 彩色;用户手改的 loading.png 为 184x92 近灰度小图)

## 第二轮用户反馈修复(2026-10-23 追加)

12. `smartphone-shooter/js/all-in-one.js` 结算场景 cF:删除 `shareGame(C.İ)` 自动调用(微信营销遗留:结算瞬间自动弹系统分享面板;分享已由平台分享按钮承载)
13. `peach-catch-frenzy/src/main.js:206-219`:输入处理对称支持 mouse(mousedown 开启 mov / mousemove 直接跟随 monkey.x / mouseup 关闭)——原代码只认 touch*,桌面鼠标拖动走不进即时跟随逻辑,猴子只能靠慢速 dirX 移动(用户反馈"移动太慢"的真相);另补 obj 判空防御
14. `soccer-dash/index.html` 三处 `new Crafty.polygon` 点对参数展平为单扁平数组(L895 Player/L1044 Pile/L1184 Goal)——bundled crafty.min.js 的 polygon 构造器只接受单扁平数组,点对形式产生嵌套 points,`shift()` 字符串拼接腐蚀 hitbox,`hit()` 恒 false,碰撞链路全断(连带射门 +3 失效);诊断代理运行时注入实证 + 修复后 6/6 复验 PASS(hp 扣加/.life 同步/皮肤切换/GameOver)

### 向用户说明的设计事实
- soccer-dash 分数不因物件变化是原设计:分数=生存计时(200ms+1)+射门+3;物件改变的是命(hp,右上角 .life 小字显示)
- smartphone-shooter 一局拍 1 张即结算为现存代码行为(多拍循环逻辑是死代码,空块痕迹疑似历史上被裁剪;恢复属重造不在本次范围)

## 验证迭代记录(三轮 Playwright,详见 verification_report_v1.md)
- R1:游戏本体修复全过;平台层 FAIL(gameService 丢字段 + 百分比公式数学错误)→ 补透传 + 改 cqw/cqh
- R2:平台层全过(480x720/405x720 精确);smartphone 点击链路 FAIL(库固有:构造器丢 config)→ 修 extend
- R3:config 生效但引出 İ 双重身份崩溃(onload 中断)→ 加守卫
- R4:**全部 PASS**(15 项验证 + 3 项回归,数值证据齐全)

## 硬约束自查
- [x] manualChunks 未改;[x] games.json 仅按 preserveManualPath 机制定向微调;[x] 无裸 any(tsc 全绿);[x] 未新增游戏;[x] iframe 仅 1games.io;[x] 无新增外域 CSP

## 门禁(全绿)
tsc exit 0 / lint 0 warning / build 成功 / validate:games 82/82 / build:games:list 两轮稳定(52 存量游戏零漂移,评审独立复核)
