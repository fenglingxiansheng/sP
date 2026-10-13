import * as ort from "onnxruntime-web/wasm";
import wasmUrl from "onnxruntime-web/ort-wasm-simd-threaded.wasm?url";
import mjsUrl from "onnxruntime-web/ort-wasm-simd-threaded.mjs?url";
import { subjectMask, animeRegion } from "./subject-mask.js";
ort.env.wasm.numThreads = 1;
ort.env.wasm.wasmPaths = {
  wasm: new URL(wasmUrl, self.location.href).href,
  mjs: new URL(mjsUrl, self.location.href).href,
};
let session;
const status = (message) => self.postMessage({ status: message });
self.onmessage = async ({ data: { source, modelUrl } }) => {
  try {
    if (!session) {
      status("正在加载 Anime Segmentation 动漫模型（约 176 MB）…");
      const response = await fetch(modelUrl);
      if (!response.ok)
        throw new Error("动漫模型加载失败，请先运行 npm run model:download");
      const reader = response.body.getReader(),
        chunks = [];
      let length = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        length += value.length;
        status(`正在加载模型：${(length / 1024 / 1024).toFixed(1)} MB`);
      }
      const bytes = new Uint8Array(length);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.length;
      }
      chunks.length = 0;
      const digest = new Uint8Array(
        await crypto.subtle.digest("SHA-256", bytes),
      );
      const hash = Array.from(digest, (value) =>
        value.toString(16).padStart(2, "0"),
      ).join("");
      if (
        hash !==
        "f15622d853e8260172812b657053460e20806f04b9e05147d49af7bed31a6e99"
      )
        throw new Error("动漫模型不完整，请运行 npm run model:download 修复");
      status("正在初始化本地推理引擎…");
      session = await ort.InferenceSession.create(bytes, {
        executionProviders: ["wasm"],
      });
    }
    status("正在识别动漫主体，可能需要数十秒，可以取消；图片不会上传…");
    const original = new OffscreenCanvas(source.width, source.height);
    original
      .getContext("2d")
      .putImageData(
        new ImageData(source.data, source.width, source.height),
        0,
        0,
      );
    const size = 1024;
    const region = animeRegion(source.width, source.height, size);
    const canvas = new OffscreenCanvas(size, size),
      ctx = canvas.getContext("2d");
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = "#fff";
    ctx.fillRect(region.x, region.y, region.width, region.height);
    ctx.drawImage(original, region.x, region.y, region.width, region.height);
    const rgba = ctx.getImageData(0, 0, size, size).data;
    const input = new Float32Array(3 * size * size);
    for (let i = 0; i < size * size; i++)
      for (let c = 0; c < 3; c++)
        input[c * size * size + i] = rgba[i * 4 + c] / 255;
    const tensor = new ort.Tensor("float32", input, [1, 3, size, size]);
    const outputs = await session.run({ [session.inputNames[0]]: tensor });
    const mask = subjectMask(
      outputs[session.outputNames[0]].data,
      size,
      source.width,
      source.height,
      { region, normalize: false },
    );
    tensor.dispose();
    for (const output of Object.values(outputs)) output.dispose();
    self.postMessage({ mask }, [mask.buffer]);
  } catch (error) {
    self.postMessage({
      error: `自动抠图失败：${error.message || error}。可以重试或使用手动工具。`,
    });
  }
};
