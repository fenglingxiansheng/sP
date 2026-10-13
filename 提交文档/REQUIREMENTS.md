# 环境与依赖复现规范

## 固定环境

| 项目 | 值 | 固定方式 |
| --- | --- | --- |
| Node.js | 24.13.0 | `.nvmrc`、`package.json` engines |
| npm | 11.6.2 | `packageManager`、engines |
| Vue | 3.5.43 | package.json 与 package-lock.json |
| Vite | 8.3.4 | 同上 |
| @vitejs/plugin-vue | 6.0.10 | 同上 |
| onnxruntime-web | 1.24.3 | package.json 与 package-lock.json |
| 测试器 | Node 内置 node:test | 无额外测试依赖 |

`.npmrc` 启用 `engine-strict=true`。项目统一使用 npm，锁文件固定直接和间接依赖。首次安装使用 `npm ci`，不要删除锁文件或混用 yarn/pnpm。

## 复现步骤

1. 安装 Node 24.13.0、npm 11.6.2，确认命令行实际版本。
2. 从交付仓库或完整源码压缩包进入项目根目录。
3. 停止该项目正在运行的 Vite 服务，防止 Windows 文件占用。
4. 执行 `npm ci`、`npm run model:download`，随后 `npm test` 和 `npm run build`。完整模型包已准备好时，下载命令只校验文件。
5. 执行 `npm run dev` 或 `npm run preview`，打开终端显示的本地地址。

不需要 Python、后端、数据库、API Key 或环境变量配置。Python 只曾用于开发阶段整理 PDF 数值和生成样例，不是安装与运行依赖。因此本项目不提供无用途的 pip requirements.txt。

Node 版本管理器不是必需，可手动安装指定版本。`packageManager` 不会自动替用户安装对应 npm；需要自行核对。

## 实际验证

- 日期：2026-10-12 至 2026-10-13。
- 系统：Windows x64，版本 10.0.26200。
- Node：24.13.0；npm：11.6.2。
- Chrome：154.0.8037.98。
- 依赖锁文件安装：在停止开发服务后，`npm ci --offline --no-audit --no-fund --cache .tmp/npm-cache` 成功。本机已有安装缓存；验收机器正常联网运行 `npm ci` 即可。
- 核心测试：24 项通过。
- 构建：通过，输出 dist。
- 浏览器：已检查上传转换、编辑、撤销重做、保存恢复、PNG 导出及 128×128 网格。
- GitHub 地址与验收提交：尚未上传，上传时补充。

锁定依赖不能保证不同操作系统的系统字体或浏览器绘制得到逐像素相同的图片。完整跨浏览器验证和压力测试由后续验收安排。

## 文件职责与提交清单

- `package.json`：运行依赖、开发依赖、脚本、版本要求。
- `package-lock.json`：完整依赖树和安装完整性信息，必须提交。
- `.nvmrc` / `.npmrc`：Node 固定版本和严格引擎检查，必须提交。
- 源码、测试、样例、内置色表、README 和 docs：必须提交。
- `node_modules/`、`dist/`、`.tmp/`、`artifacts/`、日志、凭证：不提交，已由 `.gitignore` 排除。

不能提交本机绝对路径作为运行依赖。当前应用和测试使用相对路径，图片与色表随源码提供，无远程 CDN 运行依赖。


底板尺寸和手动背景处理未引入依赖；新增自动主体抠图使用固定 onnxruntime-web 1.24.3，锁文件已更新。public/models 内含 U2NetP 权重和许可，构建会复制模型并生成 WASM 资源。图片不上传，运行时资源均从本机加载。



## 2026-10-13 Anime Segmentation 增量

当前默认模型改为 Anime Segmentation ISNet 176 MB；ONNX Runtime 版本仍为1.24.3，不新增 Python 依赖。GitHub 克隆后须运行 `npm run model:download`，完整压缩包已包含权重。首次准备模型需要连接 Hugging Face，运行应用只访问本机服务。
