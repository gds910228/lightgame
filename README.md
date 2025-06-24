# LightGame

![LightGame Logo](public/favicon.svg)

LightGame是一个精美设计的纯前端休闲游戏平台，面向寻求快速放松的上班族。该平台无需登录，体验极简，设计精美，包含多种休闲游戏。

## 特点

- **即开即玩**: 无需注册登录，直接体验游戏乐趣
- **精美界面**: 采用卡通插画风格，动画流畅，视觉效果佳
- **多种游戏**: 包含贪吃蛇、俄罗斯方块、太空射击等经典游戏
- **响应式设计**: 适配各种屏幕尺寸，提供良好的用户体验

## 技术栈

- **前端框架**: React + TypeScript
- **样式**: Tailwind CSS
- **构建工具**: Vite
- **部署**: GitHub Pages + GitHub Actions

## 本地开发

```bash
# 克隆仓库
git clone https://github.com/gds910228/lightgame.git
cd lightgame

# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 预览生产版本
npm run preview
```

## 项目结构

```
lightgame/
├── docs/               # 文档目录
├── games/              # 游戏目录
│   ├── snake/          # 贪吃蛇游戏
│   ├── tetris/         # 俄罗斯方块游戏
│   └── space-shooter/  # 太空射击游戏
├── public/             # 静态资源
├── scripts/            # 构建脚本
├── src/                # 源代码
│   ├── components/     # 组件
│   ├── pages/          # 页面
│   ├── services/       # 服务
│   └── types/          # 类型定义
└── .github/            # GitHub配置
```

## 添加新游戏

1. 在`games/`目录下创建新的游戏目录
2. 添加游戏文件，包括`index.html`和游戏资源
3. 创建`metadata.json`文件，包含游戏信息
4. 运行`npm run prebuild`更新游戏列表

## 发布历史

查看[发布说明](release.md)获取详细信息。

## 许可证

MIT 