# guizang 系列新游戏 —— 开发约定（众测云端改编版 · 必读）

本文件改编自 guizang-game-skill 方法论第三批（10 款）的强制开发约定，用于众测任务：
**本任务中模型是唯一执行者**——你既开发游戏，也负责集成与提交（与第三批"agent 只做游戏、主线程集成"的分工不同，差异见 §1 修订与 §8/§9）。
上一批已交付：sword-shrine-guardian（3D 动作）、starfall-bulwark（3D 塔防）及第三批 10 款，它们的
**模式就是标准答案**——不确定怎么写时先去读
`packages/games/starfall-bulwark/`（特别是 `js/game.js` 的 G 钩子与 `?autotest=1` 套件）。

## 1. 目录与文件

- 源码目录（唯一 truth）：`packages/games/{id}/`
  - `index.html` — 全屏游戏页，中文 UI，`<script>window.__BOOTERR=...`错误陷阱 + `<script type="module" src="js/game.js">`
  - `js/*.js` — ES modules 分模块（游戏逻辑/音频/UI/实体等，参考 starfall 的拆分粒度）
  - `vendor/three.module.min.js` — **仅 3D 游戏**，从 `packages/games/starfall-bulwark/vendor/` 原样复制，禁止 CDN
  - `DESIGN.md` — 设计文档 + 数值表 + **验证清单（实测结果逐条勾）**
  - `metadata.json` — 必填 id/title/category/description/controls（description/controls 用英文，站点模板如此）
  - `thumbnail.jpg` — **由你自己产出** 640×360：环境有浏览器截图能力就用实机游玩画面截图（选关屏不算）；没有就用 Canvas 程序化渲染游戏代表性画面；禁止纯色占位图。
- 【修订 · 众测版】除集成所必需（games.json 再生、sitemap 再生、packages/app/public 构建副本同步）外，不要改动主应用业务代码；**每款完成后必须自己执行集成管线并独立 commit**，message：`feat(game): <id> <英文名>`（禁止把多款塞进一个提交，禁止 git push）。上传包不含 .git：**动工前先 `git init`** 再开始第一款；若环境无 git，改为在 .harness/changes/<id>.md 顶部追加「DELIVERED <id>」交付标记。

## 2. G 调试钩子（skill 强制）

游戏模块暴露 `window.G`（参考 starfall game.js 底部）：

```js
const G = {
  err: __BOOTERR数组引用,
  step: (n=60, dt=1/60) => { for(...) frame(dt) },   // 带渲染推进 n 帧
  upd:  (n=30, dt=1/60) => { for(...) update(dt) },  // 只跑逻辑
  press: (...codes) => ...,                          // 模拟按键
  setNoAuto: (v) => { noAuto = v },                  // 必须有：屏蔽一切真实倒计时/自动推进
  setReportTarget: (fn) => ...,                      // autotest 捕获上报帧
  // 按游戏再加：spawn()/place()/state 快照只读引用等
};
```

**三条铁律（上一批踩过的坑）：**
1. `Object.assign(G, {get x(){}})` 会把访问器展平——G 内改内部状态一律用 `setXxx(v)` 函数。
2. 特效/弹道系统必须在主 frame/step 里调 `fx.update(dt)`——漏了表现为"开了火不掉血"。
3. autotest 开头第一行 `G.setNoAuto(true)`，否则测试耗时超过真实倒计时会自动插波/刷新/倒计时归零污染断言。

## 3. ？autotest=1 自测套件（每款 ≥22 条断言）

- URL 参数 `?autotest=1` → 跑 async 套件 → `window.__TEST = { pass, fail, total, results:[{id,ok,name}] }` → 默认静音 → 测完回标题画面。
- `nap()` 用 **MessageChannel 宏任务**（setTimeout 在隐藏页被节流冻结异步循环）：
  `const nap = () => new Promise(r => { const mc = new MessageChannel(); mc.port1.onmessage = () => r(); mc.port2.postMessage(0); });`
- 断言覆盖（每款按实际玩法裁剪，但必须含前 8 条）：
  1. 启动零报错（`__BOOTERR` 空、`G.err` 空）
  2. 数值无 NaN（跑 N 帧后扫描关键状态）
  3. 核心玩法机制数学（命中/合成/判定等至少 3 条）
  4. 经济系统（得分/货币增加与扣除）
  5. 失败路径可达（生命归零/超时 → gameOver）
  6. 胜利/通关路径可达（或无尽里程碑）
  7. 站点上报协议帧序（ready→progress→gameOver/complete，用 setReportTarget 捕获）
  8. best 纪录 localStorage 读写（唯一前缀键，测后还原原值）
  9+ 音频状态切换、变速/暂停、触屏绑定存在、关卡/升级/道具系统、边界（连击/最大等级/背包上限）、整局快进无异常无 NaN、UI 面板 DOM 开合、重开一局状态复位
- **强制附加条（与前 8 条同级）**：「输入模拟生效」——`G.press` 模拟一次方向/攻击键并推进若干帧后，关键游戏状态（位置/朝向/敌人 HP/得分等任选与玩法对应者）**必须产生可断言的变化**。血泪教训：第三批曾发生主循环漏调 handleKeys 导致玩家键盘全死，而套件因从未断言输入路径仍全绿。断言输入路径是防此类致命缺陷的唯一手段。
- **两次连续运行套件都全过且控制台零报错**才算过（防"测一次靠副作用"）。

## 4. 音频（audio.js）

- WebAudio 全合成（无素材）：SFX（音效短促分层）+ BGM（按游戏状态切换的合成循环，音量 ≈ SFX 的 1/3~1/4）。
- 首次用户手势后才 `new AudioContext`；M 键 + 右上角按钮静音，静音状态存 localStorage。
- **初始化逐字段核对模板**（上一批踩坑：漏 `loaded:{}` 初始化导致 BGM 永不播放且被 catch 吞掉）。
- autotest 期间静音。

## 5. 站点上报协议

```js
function report(kind, payload = {}) {
  if (reportTarget) reportTarget({ kind, ...payload });
  else if (window.parent !== window) window.parent.postMessage(
    { source: 'lightgame', type: 'lightgame:report', payload: { kind, ...payload } }, '*');
}
```
帧序：`ready`（载入）→ `progress{score,progress}`（里程碑，节流）→ `gameOver{score,progress}` → `complete`（通关）；特殊事件可加 `event{tag}`。整数分数。best 存 localStorage（键前缀每款唯一 3-4 字母，如 `orf.` `nbr.`）。

## 6. 性能与手感（skill 视觉/手感 bar）

- rAF 主循环：accumulator 固定步长（1/60）+ dt 上限 clamp；页面隐藏暂停累计（防 rAF 节流后大 dt 跳变）。
- 实体池化；canvas 游戏静态层离屏预渲染；3D 游戏复用几何/材质；`devicePixelRatio` 上限 2。
- 手感三件套必须有：受击/事件 **hit-stop（60-90ms）**、**screen shake**（有上限）、**粒子**（命中/合成/收集）。
- 泛光/高亮颜色峰值控制在 2~3（防过曝白块）。
- UI 全中文 + 开局引导一行（"点击/按住…"）；标题画面带 best 纪录；结算面板有"再来一局/回标题"。

## 7. 移动端

- pointerdown 统一输入；触屏操作按钮（暂停/静音/必要动作键）；`touch-action:none`；viewport `user-scalable=no`。
- 横竖屏都可玩（或明确竖屏设计并居中画幅）。

## 8. 质量门槛（agent DoD = 完成定义）

1. `?autotest=1` 全断言过 ×2 次，控制台零报错（含 warning 级脚本错）。
2. 【修订 · 众测版】实载验证：环境有浏览器自动化能力就用 Playwright 实载（方法见 §9），标题页 + 游戏中截图各 1 张，存工作区临时目录（如 `.scratch/autotest/{id}/`）并在波次报告中引用路径；没有则以 `?autotest=1` 页面内套件结果为准，封面改用 Canvas 程序化渲染。
3. 无任何外网请求：有 Playwright 就用 request 列表核对；没有就在页面内包一层 fetch/XHR 计数审计（autotest 期间外网请求数必须为 0），结果写进 DESIGN.md 验证清单。
4. DESIGN.md 验证清单逐条勾选并注明"实测 N/M 过"。
5. 汇报格式：结论先行 →「实际验证过」/「仅确认不报错」/「需人工试玩」三段如实区分。

## 9. 测试方法（本地复跑参考；云端以页面内 ?autotest=1 套件为准）

【修订 · 众测版】`scripts/` 下的 `runtest.mjs`（autotest 跑分+控制台/外网审计+截图，`node runtest.mjs <gameId> <port> [--shot]`）、`verify-input.mjs`（真实键鼠输入冒烟，防"autotest 全绿但键盘死"，用法 `node verify-input.mjs <port> [game...]`）、`sitesmoke.mjs`（构建副本站点级冒烟）、`gen-thumbs.mjs`（实机截图封面）是第三批模板——**其中 playwright 的 require 路径与 gen-thumbs 的 ROOT 是本机专用硬编码，换环境必须先改**。云端若无全局 playwright，验证以页面内套件 + §8.3 页面内审计替代；测试数据临时目录用 `.scratch/autotest/{id}/`，不要放 packages/games 里。

静态服务（端口自选，逐款换端口避免冲突）：
```bash
cd packages/games && python -m http.server {PORT}
```
测试脚本模板（存 .scratch/guizang3/{id}/test.mjs，**不要放 packages/games 里**）：
```js
import { createRequire } from 'module';
const require = createRequire('C:/Users/Administrator/.agents/skills/playwright-skill/node_modules/');
// 或: NODE_PATH=C:\Users\Administrator\AppData\Roaming\npm\node_modules node test.mjs 用 require('playwright')
const { chromium } = require('playwright');
const b = await chromium.launch();
const p = await b.newPage();
const errors = [], requests = [];
p.on('console', m => { if (['error','warning'].includes(m.type())) errors.push(m.text()); });
p.on('pageerror', e => errors.push(String(e)));
p.on('request', r => requests.push(r.url()));
await p.goto(`http://localhost:{PORT}/{id}/?autotest=1`);
await p.waitForFunction('window.__TEST && window.__TEST.done', { timeout: 120000 });
console.log(JSON.stringify(await p.evaluate('window.__TEST')));
console.log('errors:', errors); console.log('external:', requests.filter(u => !u.includes('localhost')));
await p.screenshot({ path: 'shot-title.png' });
await b.close();
```
注意：`waitForFunction` 依赖页面 rAF/定时器——Playwright 有头/无头前台页不被节流，可直接用；若卡住改用 `G.step()` 手动推进（页面里自测套件本身也要设计成推进式，见 §3）。

## 10. 游戏性红线

- 开局 10 秒内必须让玩家理解目标并获得第一次正反馈（首个合成/击杀/收集）。
- 失败后一键重开；单局时长目标 3~8 分钟；难度曲线：前 2 分钟平滑，之后指数+随机事件。
- 每款至少 1 个"记忆点"机制（合成进化/弹幕 grazing/连击 fever 等）让玩家愿意再来一局。
