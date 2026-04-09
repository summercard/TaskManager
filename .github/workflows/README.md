# TaskManager GitHub Actions 打包配置

## 📦 工作流说明

本项目包含三个 GitHub Actions 工作流，用于自动构建 Windows 和 macOS 版本：

| 工作流 | 文件 | 说明 | 触发条件 |
|--------|------|------|---------|
| **Build Windows** | `build-windows.yml` | 仅构建 Windows 版本 | Push / Tag / PR / 手动 |
| **Build macOS** | `build-macos.yml` | 仅构建 macOS 版本 | Push / Tag / PR / 手动 |
| **Build All Platforms** | `build-all.yml` | 同时构建 Windows + macOS | Push / Tag / PR / 手动 |

---

## 🚀 使用方法

### 自动触发

以下操作会自动触发构建：

1. **Push 到 main/master 分支**
   - 自动运行对应的工作流
   - 用于测试和验证

2. **创建 Tag**（如 `v1.0.0`）
   - 自动构建所有平台
   - 自动创建 GitHub Release
   - 自动上传安装包到 Release

3. **创建 Pull Request**
   - 自动运行构建（用于验证代码）

### 手动触发

1. 进入 GitHub 仓库的 **Actions** 标签页
2. 选择对应的工作流（如 "Build Windows"）
3. 点击 **"Run workflow"** 按钮
4. 选择分支，点击 **"Run workflow"**

---

## 📥 下载构建产物

### 从 Actions 页面下载

构建完成后：
1. 进入 Actions 运行页面
2. 找到 **"Artifacts"** 部分
3. 下载对应的产物（如 `TaskManager-Windows`）

### 从 GitHub Releases 下载

如果是 Tag 触发（如 `v1.0.0`）：
1. 进入 GitHub 仓库的 **Releases** 页面
2. 找到对应的 Release
3. 下载安装包（`.exe` 或 `.dmg`）

---

## 🖥️ 构建产物说明

### Windows
- **NSIS 安装包**: `TaskManager Setup x.x.x.exe` - 推荐用户使用
- **便携版**: `TaskManager x.x.x.exe` - 无需安装，直接运行

### macOS
- **DMG 镜像**: `TaskManager-x.x.x.dmg` - 拖拽到 Applications 文件夹安装

---

## ⚙️ 构建配置说明

### Windows 构建配置

```json
"win": {
  "target": [
    { "target": "nsis", "arch": ["x64"] },
    { "target": "portable", "arch": ["x64"] }
  ],
  "icon": "build/icon.ico"
}
```

**NSIS 配置：**
- `oneClick: false` - 允许用户选择安装目录
- `allowToChangeInstallationDirectory: true` - 允许修改安装路径
- `createDesktopShortcut: true` - 创建桌面快捷方式
- `createStartMenuShortcut: true` - 创建开始菜单快捷方式

### macOS 构建配置

```json
"mac": {
  "target": [
    { "target": "dmg", "arch": ["arm64", "x64"] }
  ]
}
```

**支持架构：**
- `arm64` - Apple Silicon (M1/M2/M3)
- `x64` - Intel Mac
- 生成通用二进制文件（Universal）

---

## 🔧 自定义配置

### 修改构建名称

编辑 `package.json`：

```json
"build": {
  "productName": "TaskManager",  // 修改这里
  "appId": "com.openclaw.taskmanager"
}
```

### 添加应用图标

1. 创建 `build/` 目录
2. 添加 `icon.ico` (Windows) 和 `icon.icns` (macOS)
3. 更新 `package.json` 配置

### 修改 Node.js 版本

编辑工作流文件：

```yaml
env:
  NODE_VERSION: '20'  // 修改这里
```

---

## 📝 提交代码到 GitHub

### 初始化 Git 仓库（如果还没有）

```bash
cd ~/Downloads/TaskManager-main

# 初始化（如果还没有 .git 目录）
git init
git add .
git commit -m "Initial commit"

# 添加远程仓库
git remote add origin https://github.com/你的用户名/taskmanager.git
git branch -M main
git push -u origin main
```

### 提交 GitHub Actions 配置

```bash
cd ~/Downloads/TaskManager-main

# 添加配置文件
git add .github/workflows/ package.json

# 提交
git commit -m "Add GitHub Actions for cross-platform builds"

# 推送到 GitHub
git push
```

---

## 🏷️ 创建 Tag 和 Release

### 创建 Tag

```bash
# 创建标签（推荐）
git tag -a v1.0.0 -m "Version 1.0.0"

# 推送标签
git push origin v1.0.0
```

### 创建 Tag 后会自动：

1. 触发 GitHub Actions 构建
2. 构建 Windows + macOS 版本
3. 自动创建 GitHub Release
4. 上传安装包到 Release

---

## 🐛 常见问题

### 1. 构建失败

**检查步骤：**
- 查看 Actions 运行日志
- 确认 `npm install` 是否成功
- 确认 `npm run build` 是否成功
- 检查依赖版本是否兼容

### 2. Windows 安装包无法运行

**可能原因：**
- 缺少 Windows 图标
- 缺少必要的依赖
- 代码中的路径问题

**解决方法：**
- 添加 `build/icon.ico`
- 检查 `package.json` 中的 `files` 配置
- 确保所有资源文件都被打包

### 3. macOS DMG 无法打开

**可能原因：**
- Apple Silicon 上的签名问题
- Gatekeeper 阻止

**解决方法：**
- 右键点击 DMG → 打开 → 仍然打开
- 或在系统设置中允许来自任意开发者的应用

---

## 📚 参考资源

- [Electron Builder 文档](https://www.electron.build/)
- [GitHub Actions 文档](https://docs.github.com/en/actions)
- [Node.js 下载页面](https://nodejs.org/)

---

## 💡 提示

1. **首次构建**：建议先手动运行 `npm run dist -- --win` 本地测试
2. **缓存优化**：GitHub Actions 会缓存 `npm` 依赖，加速后续构建
3. **构建时间**：完整构建通常需要 5-10 分钟
4. **存储空间**：GitHub Actions 构建产物保留 30 天，可自动清理

---

**主人，配置已经完成！现在你可以提交代码到 GitHub，自动构建 Windows 和 macOS 版本了。** 🎀
