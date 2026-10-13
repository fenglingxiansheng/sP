import { createMatcher } from "./color.js";
import { validateCrop } from "./crop.js";
import { fitGrid } from "./sizing.js";
import { areaColor, visibleColor, PIXEL_STYLES } from "./pixelate.js";

export const MAX_GRID = 128;
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_IMAGE_PIXELS = 16_000_000;

export function gridSize(sourceWidth, sourceHeight, width) {
  if (
    ![sourceWidth, sourceHeight, width].every(Number.isInteger) ||
    sourceWidth < 1 ||
    sourceHeight < 1 ||
    width < 1 ||
    width > MAX_GRID
  ) {
    throw new Error("网格宽度必须是 1～128 的整数。");
  }
  const height = Math.max(1, Math.round((sourceHeight / sourceWidth) * width));
  if (height > MAX_GRID)
    throw new Error("按比例计算的高度超过 128 格，请减小网格宽度。");
  return { width, height };
}

export function sampleGrid(image, width, crop = null, options = {}) {
  const region = validateCrop(image, crop);
  const size =
    options.height === undefined
      ? gridSize(region.width, region.height, width)
      : fitGrid(region.width, region.height, width, options.height);
  const style = options.style ?? "nearest";
  if (!PIXEL_STYLES.includes(style)) throw new Error("不支持的像素化方式。");
  if (options.mask && options.mask.length !== image.width * image.height)
    throw new Error("背景蒙版尺寸与原图不一致。");
  if (image.data.length !== image.width * image.height * 4)
    throw new Error("图片像素数据不完整。");
  const colors = [];
  for (let y = 0; y < size.height; y++) {
    const sy =
      region.y +
      Math.min(
        region.height - 1,
        Math.floor(((y + 0.5) * region.height) / size.height),
      );
    for (let x = 0; x < size.width; x++) {
      if (style !== "nearest") {
        colors.push(
          areaColor(
            image,
            region.x + (x * region.width) / size.width,
            region.y + (y * region.height) / size.height,
            region.x + ((x + 1) * region.width) / size.width,
            region.y + ((y + 1) * region.height) / size.height,
            style,
            options.mask,
          ),
        );
        continue;
      }
      const sx =
        region.x +
        Math.min(
          region.width - 1,
          Math.floor(((x + 0.5) * region.width) / size.width),
        );
      colors.push(visibleColor(image, sy * image.width + sx, options.mask));
    }
  }
  return {
    ...size,
    colors,
    style,
    ...(options.height !== undefined
      ? { bounds: { width, height: options.height } }
      : {}),
    ...(options.backgroundRemoved ? { backgroundRemoved: true } : {}),
    ...(crop
      ? {
          crop: {
            ...region,
            sourceWidth: image.width,
            sourceHeight: image.height,
          },
        }
      : {}),
  };
}

export function matchGrid(grid, palette) {
  const match = createMatcher(palette);
  return {
    width: grid.width,
    height: grid.height,
    cells: grid.colors.map((c) => (c === null ? null : match(c))),
    paletteId: palette.id,
    paletteVersion: palette.version,
    settings: {
      width: grid.width,
      sampling: grid.style ?? "nearest",
      transparency: "empty-or-white",
      matching: "lab-cie76",
      ...(grid.crop ? { crop: { ...grid.crop } } : {}),
      ...(grid.bounds ? { bounds: { ...grid.bounds } } : {}),
      ...(grid.backgroundRemoved ? { backgroundRemoved: true } : {}),
    },
  };
}

export function countBeads(pattern) {
  const counts = new Map();
  for (const code of pattern?.cells ?? [])
    if (code !== null) counts.set(code, (counts.get(code) ?? 0) + 1);
  return {
    total: [...counts.values()].reduce((a, b) => a + b, 0),
    colors: counts.size,
    items: [...counts]
      .map(([code, count]) => ({ code, count }))
      .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code)),
  };
}
