
# TaskMinder - 桌面任务提醒助手

一款轻量级 Windows 桌面任务提醒工具，采用抽屉式 UI 贴边显示，不干扰日常工作。支持任务分类、智能提醒、延期管理、循环任务等功能。

## 功能特性

### 核心功能
- **任务 CRUD** — 创建、编辑、完成、删除任务，支持任务内容描述
- **5 种任务类型** — 重点任务、日常维护、安全工作、科创工作、个人晋升，可自定义新增
- **智能提醒** — 桌面弹窗提醒，支持提前 1 小时 / 2 小时 / 1 天 / 2 天 / 7 天
- **延后提醒** — 关闭提醒后可选 15 分钟 / 30 分钟 / 1 小时 / 1 天 / 自定义时间再提醒
- **延期管理** — 手动选择新截止时间，默认延期至次日 17:30
- **循环任务** — 支持每天 / 每周（指定星期）/ 每月（指定日期）自动生成实例
- **逾期自动标记** — 每 30 秒检测并自动标记逾期任务

### 提醒弹窗
- 显示任务名称、截止时间和剩余时间
- 支持「完成任务」「延后」「关闭」三个操作
- 关闭后 1 小时再次提醒，延后按选择时间再提醒

### 抽屉式 UI
- 收起时缩小为标签条贴边，支持上下拖拽调整位置
- 收起状态鼠标穿透，不阻挡桌面操作
- 展开为 400×700 面板，支持左右侧切换
- `Alt + T` 全局快捷键快速切换收起/展开

### 4 种主题
- 极简白 / 暗夜黑 / 纯净蓝 / 透明磨砂

### 其他
- 开机自动启动
- 窗口置顶
- 搜索过滤（按名称 / 内容）
- 筛选栏：延期 / 逾期 / 历史查看
- 数据本地存储，无需联网

## 技术栈

| 层 | 技术 |
|---|---|
| 框架 | Electron + Vue 3 |
| 构建 | Vite 6 |
| 数据库 | sql.js（WASM SQLite） |
| 打包 | electron-builder（portable） |

## 项目结构

```
TaskMinder/
├── electron/
│   ├── main.js          # 主进程：窗口管理、IPC、系统托盘、提醒弹窗
│   └── preload.js       # 预加载脚本：contextBridge API 桥接
├── src/
│   ├── main.js          # Vue 入口
│   ├── App.vue          # 主界面：搜索、筛选、任务列表、弹窗
│   ├── assets/
│   │   └── themes.css   # 4 主题 CSS 变量
│   ├── components/
│   │   ├── TaskCard.vue        # 紧凑任务卡片
│   │   └── TransitionPopup.vue # 弹窗动画
│   └── composables/
│       └── database.js  # SQLite 数据层 + 提醒系统
├── public/
│   └── sql-wasm.wasm    # SQLite WASM 引擎
├── dist/                # Vite 构建产物
├── package.json
└── vite.config.js
```

## 快速开始

### 环境要求

- Node.js >= 18
- npm >= 9

### 安装

```bash
git clone https://github.com/YOUR_USERNAME/TaskMinder.git
cd TaskMinder
npm install
```

### 开发模式

```bash
npm run start
```

构建前端并启动 Electron。

### 打包便携版

```bash
npm run electron:build
```

输出到 `dist-electron/任务提醒助手-portable/`，免安装直接运行。

## 数据存储

数据库文件位于 `%APPDATA%/taskminder/taskminder.db`，为标准 SQLite 格式，可用任意 SQLite 工具查看。

### 表结构

- **tasks** — 任务主表（标题、内容、类型、状态、截止时间、提醒提前量、循环规则）
- **reminders** — 提醒记录表（触发时间、延后时间、关闭标记）
- **settings** — 设置键值对（主题、置顶、抽屉方向等）

## 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Alt + T` | 切换抽屉收起/展开 |

## License

MIT
