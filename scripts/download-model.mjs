import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, rename, rm } from "node:fs/promises";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
const target = new URL("../public/models/isnetis.onnx", import.meta.url);
const temporary = new URL(
  "../public/models/isnetis.onnx.part",
  import.meta.url,
);
const expected =
  "f15622d853e8260172812b657053460e20806f04b9e05147d49af7bed31a6e99";
async function hash(path) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}
try {
  let valid = false;
  try {
    valid = (await hash(target)) === expected;
  } catch {}
  if (valid) console.log("Anime Segmentation 模型已存在且校验通过。");
  else {
    await mkdir(new URL("../public/models/", import.meta.url), {
      recursive: true,
    });
    console.log("下载官方 Anime Segmentation 模型（176 MB）…");
    const response = await fetch(
      "https://huggingface.co/skytnt/anime-seg/resolve/493cb60893f47441b26ec4fb9a306bce9e342982/isnetis.onnx",
      { signal: AbortSignal.timeout(20 * 60 * 1000) },
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    await pipeline(
      Readable.fromWeb(response.body),
      createWriteStream(temporary),
    );
    if ((await hash(temporary)) !== expected)
      throw new Error("模型 SHA256 校验失败");
    await rename(temporary, target);
    console.log("下载完成，SHA256 校验通过。");
  }
} catch (error) {
  await rm(temporary, { force: true });
  console.error("模型准备失败：", error.message);
  process.exitCode = 1;
}
