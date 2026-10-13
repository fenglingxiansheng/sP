# 提交版运行说明

源码使用本文件夹上一级的现有项目。完整操作说明见 [项目 README](../README.md)，环境详情见 [REQUIREMENTS.md](REQUIREMENTS.md)。

## 环境

Node.js **24.13.0**，npm **11.6.2**；建议使用现代桌面 Chrome / Edge。项目使用 Vue 3 + JavaScript + Vite，浏览器本地处理图片，无需 Python、数据库、账号或 API Key。

## 启动

打开终端，进入**包含 package.json 的项目根目录**，不要停留在“提交文档”文件夹：

```powershell
node --version
npm --version
npm ci
npm run model:download
npm run dev
```

访问终端显示的 Local 地址，默认通常为 `http://127.0.0.1:5173/`。端口被占用时以实际输出为准。不能直接双击 index.html。

首次安装 npm 依赖需要网络。模型已存在且校验正确时，model:download 只做本地校验；模型缺失时访问作者官方 Hugging Face 仓库下载。图片不会发送到外部推理服务。

## 检查及构建

```powershell
npm test
npm run build
npm run preview
```

当前核心自动测试为24项。preview 地址通常为 `http://127.0.0.1:4173/`，以终端为准。运行中按 Ctrl+C 停止服务。Windows 下先停止开发/预览服务，再执行 npm ci，避免依赖文件占用。

## 最短体验流程

1. 直接使用内置小花，或上传 PNG/JPEG。
2. 按需裁剪、去背景；调整尺寸上限或底板数量，点击“生成图案”。
3. 使用画笔、橡皮、吸色和替色，查看右侧材料统计。
4. 点击导出 PNG，检查网格、色号、行列编号和图例；也可保存项目 JSON 后载入继续编辑。

原图裁剪和背景窗口支持 Ctrl＋滚轮缩放、空格＋左键平移、“适应窗口”复位。自动抠图适合动漫人物但可能误删手臂、细线；用点选保留、恢复笔刷修补，再应用并生成。
