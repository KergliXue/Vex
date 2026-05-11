# Vex

## 作者声明

❤️本项目完全由AI编写❤️

💩无人类编写的究极无敌屎山玩具💩

*** 我不建议任何人类细看这些代码并且给我提交什么pr 如果你真的是个M 恭喜你你应该和豆包谈恋爱 ***

Vex 是一个运行在桌面的 AI Companion 原型项目：它以透明悬浮窗的形式常驻屏幕角落，结合 Live2D 角色、托盘控制、窗口上下文感知和截图分析，像一个会吐槽、会搭话的桌宠一样陪着你工作。

项目基于 `Electron + React + Vite + TypeScript`，当前更偏向实验性作品和个人玩具项目，但已经具备一个完整桌宠应用的基本骨架。

## 功能概览

- 透明置顶桌宠窗口，常驻桌面右下角
- macOS 托盘菜单，可打开控制台和调试面板
- Live2D 模型加载与缩放配置
- 基于当前前台应用和窗口标题的上下文感知
- 支持快捷键手动触发屏幕截图分析
- 聊天记录本地持久化
- 支持多模型配置：
  - `DeepSeek` 负责主要对话
  - `Gemini` 可作为视觉理解模块
  - `Doubao / Ark` 可作为视觉理解模块
- 角色卡通过独立文件夹管理，支持导入、导出和切换启用角色

## 技术栈

- `Electron`
- `React 19`
- `Vite`
- `TypeScript`
- `PixiJS`
- `pixi-live2d-display`

## 本地开发

### 1. 安装依赖

```bash
npm install
```

### 2. 启动开发环境

```bash
npm run dev
```

这会同时启动：

- `Vite` 开发服务器，默认端口 `5174`
- `Electron` 桌面应用

### 3. 构建前端资源

```bash
npm run build
```

### 4. 代码检查

```bash
npm run lint
```

## 项目结构

```text
vex/
├── electron/           # Electron 主进程与 preload
├── public/live2d/      # Live2D runtime 与模型资源
├── src/                # React 前端与桌宠界面逻辑
├── dist/               # 构建产物
├── chat.log            # 调试日志
└── README.md
```

## 配置说明

应用中的大多数设置都保存在浏览器本地存储里，包含：

- `DeepSeek API Key`
- `Gemini API Key`
- `Doubao API Key`
- `Doubao Endpoint ID`
- 搭话概率
- 调试模式
- Live2D 模型路径
- Live2D 缩放

此外，角色配置现在位于用户目录下的 `roles/` 中。每个角色都是一个文件夹，至少包含：

```text
角色名/
├── config.json   # name / description / image
├── soul.md       # 角色灵魂提示词
└── avatar.png    # 用于在设置页区分角色的图片
```

应用会在首次运行时自动创建默认角色，并把旧版 `soul.md` 迁移为默认角色的灵魂内容。

## Live2D 使用方式

默认模型路径为：

```text
/live2d/zzz_belle/zzz_belle.model3.json
```

如果你想替换角色：

1. 把 Live2D 运行时文件和模型资源放进 `public/live2d/`
2. 在控制台中修改模型配置文件路径
3. 视需要调整缩放比例

## 平台说明

当前实现明显偏向 `macOS`：

- 使用了 `osascript` 获取前台窗口信息
- 使用了 macOS 托盘行为与快捷键方案

如果要支持 Windows 或 Linux，需要额外实现对应的平台层能力。

## 当前状态

这是一个已经跑起来的 AI 桌宠实验项目，但仍有一些明显的工程化缺口：

- 暂无完整发布流程
- 缺少正式打包与安装说明
- 缺少自动化测试
- 权限、稳定性和异常处理仍可继续加强

如果你只是想快速体验一个“会盯着你屏幕并吐槽你”的桌宠，这个项目已经够有意思了。

## License

当前仓库未声明开源许可证。如需公开发布到 GitHub，建议补充一个明确的 `LICENSE` 文件。
