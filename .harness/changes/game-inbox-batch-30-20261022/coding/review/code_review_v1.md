# 代码评审报告 v1(owner 自评 + 自动门禁)

## 评审轮次
1 轮。评审方式:逐项对照 spec 11 步流水线 + 自动扫描脚本 + headless 实测。

## 通过项
- 30/30 元数据通过 validate-games(AJV schema/枚举/图片存在性/目录-id 一致)。
- 30/30 headless pageerror=0、reqfail 除 SoundJS fail.fail 能力探测与豁免项外为 0。
- 全部游戏入口 lang=en、title/description/keywords 齐备。
- 外链通用扫描(http://)、17 词追踪器正则、\uXXXX 中文精确替换、GBK→UTF-8、CSS/JS 字体名替换均逐游戏执行。
- 分享全部改为 window.parent.handleGlobalShare;dp_submitScore 仅更新文案,无 confirm/alert/自动跳转;更多游戏跳 '/'。
- 注入器 8 处 packer 全部切除并 node --check 通过。
- 提交粒度:每游戏一个独立 commit(含 rename 识别)。

## 已记录的例外(符合标准豁免)
- 图片烘焙中文美术字:无法在不重绘美术的前提下消除,逐游戏登记(见 ledger)。
- 引擎内部诊断串(cocos/egret Logger)、引擎 UA 枚举值(wechat/micromessenger)、zlib/许可 URL、w3.org 命名空间。
- 代码注释中的中文与旧平台痕迹(munaiyiguilai.js 注释、mishi 引擎注释):玩家不可见,登记。
- 人民币图案(cash-catch-rush)与真人照片(peek/pop-star/tap-frenzy):HITL 决议保留+文案中性化。
- retro-game-tune-quiz:题面经典游戏 IP 名与无授权 MP3(10 首)为既有内容,metadata.notes 显著标注版权风险。

## 遗留风险
- 部分游戏结束页按钮文字为烘焙图(中文);如需彻底英文需美术重绘。
- skyscraper-stack 使用 cocos2d-html5 v3.0-alpha2 兼容引擎(MIT),版本通过 0 pageerror 实测确认,但与原版次差异属低风险。
