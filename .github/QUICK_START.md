# TaskManager - GitHub Actions 快速开始指南

## ✅ 已完成的配置

主人，我已经为你的 TaskManager 项目配置好了 GitHub Actions，可以自动构建 Windows 和 macOS 版本。

### 📁 项目位置
- **本地路径**: `~/Downloads/TaskManager-main/`
- **类型**: Electron + React + TypeScript + Vite
- **构建工具**: electron-builder

### 🔧 已修改的文件

1. **`package.json`** - 添加了 Windows 构建配置
   - NSIS 安装包
   - 便携版
   - 自定义安装选项

2. **`package.json`** - 记录到 TOOLS.md

3. **`.github/workflows/build-windows.yml`** - Windows 构建工作流
4. **`.github/workflows/build-macos.yml`** - macOS 构建工作流
5. **`.github/workflows/build-all.yml`** - 全平台构建工作流
6. **`.github/workflows/README.md`** - 详细使用说明

---

## 🚀 下一步操作

### 1️⃣ 提交代码到 GitHub

```bash
cd ~/Downloads/TaskManager-main

# 检查远程仓库
git remote -v

# 如果还没有远程仓库，先创建一个
# 访问 https://github.com/new 创建仓库

# 添加远程仓库
git remote add origin https://github.com/你的用户名/taskmanager.git

# 推送代码
git branch -M main
git push -u origin main
```

### 2️⃣ 提交 GitHub Actions 配置

```bash
cd ~/Downloads/TaskManager-main

# 添加所有配置文件
git add .github/ package.json

# 提交
git commit -m "Add GitHub Actions for Windows and macOS builds"

# 推送
git push
```

### 3️⃣ 测试构建

推送后，GitHub Actions 会自动运行。你也可以手动触发：
1. 进入 GitHub 仓库
2. 点击 **Actions** 标签页
3. 选择 **Build Windows** 或 **Build All Platforms**
4. 点击 **Run workflow**

---

## 📦 构建产物

### Windows
- **NSIS 安装包**: `TaskManager Setup x.x.x.exe`
- **便携版**: `TaskManager x.x.x.exe`

### macOS
- **DMG 镜像**: `TaskManager-x.x.x.dmg`

---

## 🏷️ 创建 Release

创建 Tag 会自动构建并创建 Release：

```bash
# 创建标签
git tag -a v1.0.0 -m "Version 1.0.0"

# 推送标签
git push origin v1.0.0
```

---

## ⚠️ 重要提示

### 1. 如果还没有 GitHub 仓库

需要先创建一个 GitHub 仓库：
1. 访问 https://github.com/new
2. 仓库名称：`taskmanager`
3. 设置为 Public 或 Private
4. 点击 **Create repository**
5. 按照上面的步骤推送代码

### 2. 构建时间

- 首次构建：5-10 分钟
- 后续构建：3-5 分钟（利用缓存）

### 3. 构建失败怎么办？

1. 查看 Actions 运行日志
2. 检查本地是否能成功构建：
   ```bash
   npm run build
   npm run dist -- --win
   ```
3. 查看详细的 `.github/workflows/README.md`

---

## 📖 详细文档

查看 `.github/workflows/README.md` 获取：
- 详细的工作流说明
- 自定义配置方法
- 常见问题解决

---

## 💡 建议

1. **先测试本地构建**：确保 `npm run dist -- --win` 本地能成功
2. **使用 `build-all.yml`**：一次性构建所有平台
3. **创建 Tag 时再构建**：节省 GitHub Actions 的使用额度

---

**主人，配置已经准备好了！你可以先提交代码测试一下。如果有任何问题，随时告诉我。** 🎀

**需要我帮你提交代码吗？**
