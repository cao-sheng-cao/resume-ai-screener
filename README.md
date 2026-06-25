# 简历岗位匹配评分系统 Electron 版 v1.0.2

本版本新增：

1. DeepSeek 模型选择功能。
2. 支持在应用中切换快速模式 / 推理模式 / Pro 模式 / 兼容旧模型名。
3. 支持查看每次评分的 Token 消耗。
4. 排行榜新增“模型”和“Token”列。
5. GitHub Actions 工作流已修复：不使用 npm cache，不发布 Release，只上传 Artifacts。

## 可选模型

- DeepSeek V4 Flash｜快速评分：`deepseek-v4-flash` + thinking disabled
- DeepSeek V4 Flash｜严谨推理：`deepseek-v4-flash` + thinking enabled
- DeepSeek V4 Pro｜高质量评分：`deepseek-v4-pro` + thinking disabled
- DeepSeek V4 Pro｜高质量推理：`deepseek-v4-pro` + thinking enabled
- Legacy deepseek-chat：旧兼容快速模式
- Legacy deepseek-reasoner：旧兼容推理模式

## Token 消耗显示

评分完成后，结果页会显示：

- 输入 Token
- 输出 Token
- 总 Token
- 缓存命中 Token
- 缓存未命中 Token
- 推理 Token
- 本次实际使用模型

Token 数据来自 DeepSeek API 返回的 `usage` 字段。

## GitHub Actions 打包步骤

1. 将项目上传到 GitHub 仓库根目录。
2. 确保根目录能看到：
   - package.json
   - main.js
   - src
   - .github
   - README.md
3. 进入 Actions。
4. 运行 Build Windows Installer。
5. 运行成功后，在 Artifacts 下载安装包。

## 注意

不要把 API Key 写进代码或上传到 GitHub。每个使用者首次打开应用时自己输入 API Key。
