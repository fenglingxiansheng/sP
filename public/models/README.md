# 当前默认：Anime Segmentation / ISNet

- 作者项目：https://github.com/SkyTNT/anime-segmentation
- 用户本地参考：`chunk_photo/anime-segmentation-main/inference.py` 和 `export.py`。
- 官方权重：https://huggingface.co/skytnt/anime-seg
- 固定版本：`493cb60893f47441b26ec4fb9a306bce9e342982`
- 文件：`isnetis.onnx`，176,069,933 字节。
- SHA256：`f15622d853e8260172812b657053460e20806f04b9e05147d49af7bed31a6e99`
- 官方模型仓库标注 Apache-2.0，代码许可证随附 `ANIME-SEGMENTATION-LICENSE.txt`。
- 准备命令：`npm run model:download`，权重不提交普通 Git；完整本地交付包包含权重。

ONNX Runtime Web 1.24.3 / WASM 在浏览器 Worker 内推理，输入1024×1024，等比居中补边；RGB / 255，无 ImageNet 均值归一化。概率图去补边、双线性还原，按0.5阈值接入现有二值擦除蒙版。原图和手动恢复机制不变。加载只访问本机服务，首次准备权重时下载脚本访问 Hugging Face。

## 历史模型（保留文件供对比，不再是默认）

# 本地主体分割模型

- 模型：U²-Net 的轻量版本 U2NetP，显著主体分割，320×320 输入。
- 作者与项目：https://github.com/xuebinqin/U-2-Net
- ONNX 来源：https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2netp.onnx
- 下载校验参照：https://github.com/danielgatis/rembg/blob/main/rembg/sessions/u2netp.py
- MD5：`8e83ca70e441ab06c318d82300c84806`
- SHA256：`309c8469258dda742793dce0ebea8e6dd393174f89934733ecc8b14c76f4ddd8`
- 上游 U²-Net 使用 Apache-2.0，随附原始 `U2NET-LICENSE.txt`。ONNX 转换由 rembg 分发，其项目使用 MIT。

权重原样保留。浏览器从本机 Vite 服务按需加载；无需 API Key 或第三方推理服务。推理引擎 `onnxruntime-web@1.24.3` 使用 MIT，WASM 随构建生成（约 12.4 MB），模型约 4.6 MB。首次点击需要加载两者，浏览器缓存行为由服务响应和浏览器决定，不能保证永久缓存。

本项目用浏览器平滑缩放替代上游 Pillow Lanczos，使用 RGB 最大值归一化和 ImageNet mean/std；输出最小最大归一化，双线性放大后以 0.5 阈值生成二值擦除蒙版，适配拼豆留空规则。不是发丝级透明度抠图，也不保证识别用户指定的多个主体。
