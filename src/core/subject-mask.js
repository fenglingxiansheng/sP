// Convert model saliency to the editor's binary erase mask. Original alpha stays intact.
export function subjectMask(scores, size, width, height, options = {}) {
  const region = options.region ?? { x: 0, y: 0, width: size, height: size };
  const normalize = options.normalize !== false;
  let low = Infinity,
    high = -Infinity;
  for (const value of scores) {
    if (!Number.isFinite(value)) throw new Error("模型输出无效，请重试。");
    low = Math.min(low, value);
    high = Math.max(high, value);
  }
  if (scores.length !== size * size || (normalize && high - low < 1e-6))
    throw new Error("未能区分主体和背景，请使用手动工具。");
  const mask = new Uint8Array(width * height);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const sx = Math.max(
        region.x,
        Math.min(
          region.x + region.width - 1,
          region.x + ((x + 0.5) * region.width) / width - 0.5,
        ),
      );
      const sy = Math.max(
        region.y,
        Math.min(
          region.y + region.height - 1,
          region.y + ((y + 0.5) * region.height) / height - 0.5,
        ),
      );
      const x0 = Math.floor(sx),
        y0 = Math.floor(sy),
        x1 = Math.min(region.x + region.width - 1, x0 + 1),
        y1 = Math.min(region.y + region.height - 1, y0 + 1);
      const a = sx - x0,
        b = sy - y0;
      const value =
        (scores[y0 * size + x0] * (1 - a) + scores[y0 * size + x1] * a) *
          (1 - b) +
        (scores[y1 * size + x0] * (1 - a) + scores[y1 * size + x1] * a) * b;
      mask[y * width + x] =
        (normalize ? (value - low) / (high - low) : value) < 0.5 ? 1 : 0;
    }
  return mask;
}

// Centered zero padding as in the upstream inference.py.
export function animeRegion(width, height, size = 1024) {
  const w =
    width >= height ? size : Math.max(1, Math.floor((size * width) / height));
  const h =
    height >= width ? size : Math.max(1, Math.floor((size * height) / width));
  return {
    x: Math.floor((size - w) / 2),
    y: Math.floor((size - h) / 2),
    width: w,
    height: h,
  };
}
