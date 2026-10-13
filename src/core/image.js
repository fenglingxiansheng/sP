import { MAX_FILE_BYTES, MAX_IMAGE_PIXELS } from "./pattern.js";

// Read dimensions before decoding: a small compressed image can have huge pixel dimensions.
export function imageHeader(buffer) {
  const b = new Uint8Array(buffer),
    v = new DataView(buffer);
  if (
    b.length >= 24 &&
    [137, 80, 78, 71, 13, 10, 26, 10].every((n, i) => b[i] === n)
  ) {
    return { width: v.getUint32(16), height: v.getUint32(20) };
  }
  if (b[0] === 255 && b[1] === 216) {
    let p = 2;
    while (p + 3 < b.length) {
      if (b[p] !== 255) break;
      while (b[p] === 255) p++;
      const marker = b[p++];
      if (marker === 217 || marker === 218) break;
      if (marker === 1 || (marker >= 208 && marker <= 215)) continue;
      if (p + 2 > b.length) break;
      const length = v.getUint16(p);
      if (length < 2 || p + length > b.length) break;
      if (
        [
          192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207,
        ].includes(marker) &&
        length >= 7
      ) {
        return { height: v.getUint16(p + 3), width: v.getUint16(p + 5) };
      }
      p += length;
    }
  }
  throw new Error("仅支持有效的 PNG 或 JPEG 图片。");
}

export async function decodeImage(file) {
  if (file.size > MAX_FILE_BYTES) throw new Error("图片不能超过 10 MB。");
  const size = imageHeader(await file.arrayBuffer());
  if (
    !size.width ||
    !size.height ||
    size.width * size.height > MAX_IMAGE_PIXELS
  )
    throw new Error("原图不能超过 1600 万像素，请先缩小图片。");
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("图片解码失败，请检查文件是否损坏。");
  }
  try {
    if (bitmap.width * bitmap.height > MAX_IMAGE_PIXELS)
      throw new Error("图片像素数量过大。");
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(bitmap, 0, 0);
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return { width: pixels.width, height: pixels.height, data: pixels.data };
  } finally {
    bitmap.close();
  }
}
