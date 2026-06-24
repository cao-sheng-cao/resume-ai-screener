# 简历岗位匹配评分系统｜Electron 桌面应用版

这个版本已经改成 Electron 桌面应用项目，支持打包成 Windows 安装包。

## 新增可靠性增强功能

1. 每个必要项、加分项、一票否决项都要求 AI 给出：
   - 判断结果
   - 简历原文依据
   - 判断原因
   - 单项置信度
2. 新增整体置信度。
3. 新增简历完整度、证据充分度、低置信度原因。
4. 新增一票否决 / 强风险项。
5. 新增待人工核实项。
6. 新增关键原文依据。
7. 新增面试追问。
8. 排行榜新增置信度字段。

## UI 提示增强

岗位标准填写区已内置提示：

- 必要项越硬越好：写清楚“必须有、如何算满足、什么不算满足”。
- 加分项越具体越好：写具体公司、行业、产品、客户类型、项目经验。
- 评分规则要明确：写清楚 100 分如何拆解，以及缺少核心项如何处理。

## 项目文件

```txt
package.json
src/main/main.js
src/main/preload.js
src/renderer/index.html
src/renderer/styles.css
src/renderer/renderer.js
src/assets/app-icon.png
src/assets/app-icon.ico
build-windows-installer.cmd
start-dev.cmd
```

## 开发预览

先安装 Node.js LTS，然后在项目文件夹中运行：

```bash
npm install
npm start
```

## 打包成 Windows 安装包

在 Windows 电脑上运行：

```bash
npm install
npm run dist:win
```

或者直接双击：

```txt
build-windows-installer.cmd
```

打包成功后，安装包会出现在：

```txt
dist/
```

通常会生成：

```txt
简历岗位匹配评分系统 Setup 1.0.0.exe
简历岗位匹配评分系统 1.0.0.exe
```

前者是安装版，后者是便携版。

## 最终用户如何使用

安装后：

1. 双击桌面图标打开应用。
2. 输入自己的 DeepSeek API Key。
3. 修改岗位标准。
4. 选择简历文件或粘贴简历正文。
5. 点击“开始 AI 评分”。
6. 查看评分、证据、风险、置信度和排行榜。

最终用户不需要配置服务器，不需要打开命令行，不需要本地启动网页服务，只需要输入 API Key。

## 重要说明

- 我在这里提供的是 Electron 应用项目源码和打包脚本，不是已经签名的商业安装包。
- 真正生成 Windows `.exe` 安装包需要在你的 Windows 电脑上运行一次打包命令。
- 不建议把你的 DeepSeek API Key 写死进软件里；正确方式是每个使用者第一次打开软件时自己输入 Key。


---

# GitHub Actions 云端自动打包版

本项目已经加入 GitHub Actions 工作流：

```txt
.github/workflows/build-windows.yml
```

上传到 GitHub 后，可以直接在 GitHub 云端生成 Windows 安装包，不需要在你的电脑上执行打包命令。

## 云端打包流程

1. 在 GitHub 新建仓库，例如 `resume-ai-screener`。
2. 上传本项目全部文件和文件夹，确认仓库中存在：

```txt
.github/workflows/build-windows.yml
package.json
src/main/main.js
src/renderer/index.html
src/assets/app-icon.ico
```

3. 打开仓库顶部的 `Actions`。
4. 左侧选择 `Build Windows Installer`。
5. 点击 `Run workflow`。
6. 等待构建完成。
7. 打开本次构建记录，在 `Artifacts` 区域下载：

```txt
Resume-AI-Screener-Windows-Installer
```

8. 下载后解压，即可获得安装包和便携版 exe。

## 重要提醒

- 不要把 DeepSeek API Key 写入代码，也不要上传到 GitHub。
- 这个安装包默认没有商业代码签名，Windows 可能显示“未知发布者”。这是未签名应用的正常提示。
- 商业分发时建议购买代码签名证书。
