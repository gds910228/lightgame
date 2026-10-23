# 测试报告(静态游戏无单测框架,以 headless 行为验证替代,见 spec 阶段5)
- 30/30 游戏 file:// 加载成功,无未捕获异常。
- 对关键流程游戏(dots/tickle/soccer/sea/monster/money/skyscraper)执行点击交互,确认开始/进行/结算状态切换正常。
- 每游戏资源完整性由 lgcheck + 浏览器 requestfailed 监听双重确认。
