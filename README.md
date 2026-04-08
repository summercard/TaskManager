# TaskManager - 任务管理应用

一个基于 React + TypeScript + Vite 构建的现代化任务管理应用，支持看板视图、项目管理、数据导入导出等功能。

## 功能特性

### 核心功能
- **项目管理** - 创建、编辑、删除项目，支持项目状态跟踪（规划中、进行中、已完成、已搁置）
- **任务看板** - 拖拽式看板视图，支持在待处理、进行中、已完成三个状态间自由切换
- **目标管理** - 为项目设置目标数量和当前进度
- **数据导入/导出** - 支持 JSON 格式的数据备份和恢复

### 界面特性
- 响应式设计，适配桌面和移动设备
- 流畅的动画效果（基于 Framer Motion）
- 逾期任务提醒
- 今日到期任务提示
- 任务状态分布统计
- 项目进度可视化

## 技术栈

- **前端框架**: React 19
- **类型系统**: TypeScript
- **构建工具**: Vite 8
- **状态管理**: Zustand
- **UI 动画**: Framer Motion
- **拖拽功能**: @dnd-kit
- **样式**: Tailwind CSS 4
- **路由**: React Router DOM 7
- **日期处理**: Day.js

## 安装

### 环境要求
- Node.js >= 18
- npm >= 9 或 pnpm >= 8

### 安装步骤

1. 克隆项目
```bash
git clone <repository-url>
cd task-manager
```

2. 安装依赖
```bash
npm install
```

## 开发

### 桌面端（推荐）

```bash
# 桌面端开发（会启动 Vite 开发服务器供 Electron 加载）
npm run desktop:dev
```

```bash
# 构建并启动桌面端
npm run desktop:start
```

### 浏览器预览（可选）

```bash
npm run dev
```

`npm run dev` 只用于在浏览器中预览界面调试；正式使用请以桌面端为准。

### 类型检查

```bash
npm run build
```

### 代码检查

```bash
npm run lint
```

## 构建生产版本

```bash
npm run build
```

构建产物将输出到 `dist` 目录。

### 预览生产构建

```bash
npm run preview
```

## 项目结构

```
src/
├── components/          # React 组件
│   ├── common/         # 通用组件（Button、Card、Input、Modal）
│   ├── goal/           # 目标编辑器
│   ├── kanban/         # 看板相关组件
│   ├── layout/         # 布局组件
│   ├── stats/          # 统计面板
│   └── task/           # 任务弹窗
├── pages/              # 页面组件
│   ├── Dashboard/      # 仪表盘
│   ├── ProjectList/    # 项目列表
│   └── ProjectDetail/  # 项目详情
├── stores/             # Zustand 状态管理
│   ├── projectStore.ts # 项目状态
│   └── taskStore.ts    # 任务状态
├── types/              # TypeScript 类型定义
└── utils/              # 工具函数
    ├── importExport.ts # 导入导出功能
    ├── index.ts        # 通用工具
    └── storage.ts      # 本地存储适配器
```

## 使用指南

### 创建项目
1. 在仪表盘页面点击"创建项目"按钮
2. 输入项目名称和描述
3. 项目创建后会自动跳转到项目详情页面

### 管理任务
1. 在项目详情页面，点击"新建任务"按钮
2. 填写任务标题、描述（可选）、截止日期（可选）
3. 选择任务状态，默认为"待处理"
4. 点击"创建"保存任务

### 使用看板
- **切换状态**: 将任务卡片拖拽到目标列即可更新状态
- **编辑任务**: 点击任务卡片打开编辑弹窗
- **删除任务**: 在编辑弹窗中点击"删除"按钮

### 设置项目目标
1. 在项目详情页面点击"设置目标"按钮
2. 填写目标描述、目标数量和当前进度
3. 点击"保存"完成设置

### 导入导出数据
- **导出**: 点击"导出"按钮下载项目数据为 JSON 文件
- **导入**: 点击"导入"按钮选择 JSON 文件导入任务数据

## 数据存储

应用使用浏览器 localStorage 存储数据：
- `taskmanager_projects` - 项目数据
- `taskmanager_tasks` - 任务数据

注意：清除浏览器数据会导致所有项目和工作丢失，建议定期使用导出功能备份数据。

## 浏览器兼容性

- Chrome >= 90
- Firefox >= 88
- Safari >= 14
- Edge >= 90

## License

MIT
