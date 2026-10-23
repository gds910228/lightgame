# Spec 评审 v1(阶段 2)

- 评审时间:2026-10-22
- 评审方式:expert-reviewer 独立子代理(Plan 类型,仅喂入仓库路径与评审清单,不传会话历史)
- 结论:**需修改(小改后可过)** —— 1 Critical / 6 Important / 8 Minor
- 命名方案核验:**通过**(15 个新 id 合法、无碰撞、与玩法匹配)

## Critical
- C1:失败游戏"留 inbox"兜底与 validate 门禁矛盾(games-inbox 目录存在即报红,空目录也报)。修复:失败品移出 packages/games 至 `archive/inbox-failed/`,末尾无条件删除 games-inbox。

## Important
- I1:编码期 validate 必红,需对单游戏 metadata 跑独立 AJV+枚举+图片存在性校验(/tmp 脚本)。
- I2:增加"任意站外 URL"通用扫描门禁(裸 IP/未列域名,如 mmttt 的 42.121.113.35、httpbin.org);广告桩/iframe 显式入清单。
- I3:远程 JS 库下载内置+许可头纳入标准步骤;G15 校验内置 jquery 版本。
- I4:生成物提交边界:游戏 commit 仅含 packages/games/<id>;生成物+ sitemap 用独立 `chore:` commit。
- I5:submitScore 范式以 prison-whack 为准(仅文案),laser-defense play68.js 的 1 秒自动分享不得复制。
- I6:固化 17 词原正则;统一豁免判据(注释词元必改;引擎 UA 枚举可留需登记;UA 函数命名不得含 weixin 字样;MicroMessenger 不在词表)。

## Minor(采纳)
1. CSS font-family 中文字体并入第 4 步;2. sitemap ISO 时间格式+历史漂移说明;3. metadata 显式 image+thumbnail 且校验存在;4. console 判定:0 未捕获异常,远端失败须从源码消除;5. 增 Task 0 环境准备(已完成 npm install+chromium 冒烟);6. commit 统一全角括号;7. 版权例外仅入报告;8. pop-star-tap 语义提示用户。

## 处置
Owner 已按上述逐条修订 spec.md(v2)/tasks.md(v2),修订点见两文「v2 修订」节;评审结论"小改后可过",修订后自评闭环,提交 HITL-1/HITL-2 由用户终审。
