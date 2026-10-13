import { MAX_FILE_BYTES, MAX_GRID, MAX_IMAGE_PIXELS } from "./pattern.js";
import { validateCrop } from "./crop.js";
import { fitGrid } from "./sizing.js";
import { PIXEL_STYLES } from "./pixelate.js";

const fail = (message) => {
  throw new Error(`项目文件无效：${message}`);
};
const string = (value, max = 160) =>
  typeof value === "string" && value.length > 0 && value.length <= max;

export function validateProject(input) {
  if (!input || input.schemaVersion !== 1) fail("不支持的文件版本。");
  const { palette: p, pattern: g } = input;
  if (
    !p ||
    !["id", "brand", "series", "version"].every((k) => string(p[k])) ||
    !Array.isArray(p.colors) ||
    p.colors.length < 1 ||
    p.colors.length > 512
  )
    fail("色表缺失或格式错误。");
  const codes = new Set();
  const colors = p.colors.map((c) => {
    if (
      !c ||
      !/^S\d{2,3}$/.test(c.code) ||
      codes.has(c.code) ||
      !Array.isArray(c.rgb) ||
      c.rgb.length !== 3 ||
      !c.rgb.every((v) => Number.isInteger(v) && v >= 0 && v <= 255)
    )
      fail("色号重复或 RGB 错误。");
    codes.add(c.code);
    return {
      code: c.code,
      rgb: [...c.rgb],
      hex:
        "#" +
        c.rgb
          .map((n) => n.toString(16).padStart(2, "0"))
          .join("")
          .toUpperCase(),
    };
  });
  if (
    !g ||
    ![g.width, g.height].every(
      (n) => Number.isInteger(n) && n >= 1 && n <= MAX_GRID,
    ) ||
    !Array.isArray(g.cells) ||
    g.cells.length !== g.width * g.height
  )
    fail("格数与图案尺寸不一致。");
  if (g.paletteId !== p.id || g.paletteVersion !== p.version)
    fail("图案与色表版本不一致。");
  if (!g.cells.every((c) => c === null || codes.has(c)))
    fail("图案包含未知色号。");
  if (
    !g.settings ||
    g.settings.width !== g.width ||
    !PIXEL_STYLES.includes(g.settings.sampling) ||
    g.settings.transparency !== "empty-or-white" ||
    g.settings.matching !== "lab-cie76"
  )
    fail("生成参数不受支持。");
  let bounds;
  if (g.settings.bounds !== undefined) {
    const b = g.settings.bounds;
    if (
      !b ||
      ![b.width, b.height].every(
        (n) => Number.isInteger(n) && n > 0 && n <= MAX_GRID,
      ) ||
      g.width > b.width ||
      g.height > b.height
    )
      fail("尺寸上限无效。");
    bounds = { width: b.width, height: b.height };
  }
  if (
    g.settings.backgroundRemoved !== undefined &&
    typeof g.settings.backgroundRemoved !== "boolean"
  )
    fail("背景处理参数无效。");
  let crop;
  if (g.settings.crop !== undefined) {
    const c = g.settings.crop;
    if (
      !c ||
      ![c.sourceWidth, c.sourceHeight].every(
        (n) => Number.isInteger(n) && n > 0,
      ) ||
      c.sourceWidth * c.sourceHeight > MAX_IMAGE_PIXELS
    )
      fail("裁剪原图尺寸无效。");
    try {
      crop = {
        ...validateCrop({ width: c.sourceWidth, height: c.sourceHeight }, c),
        sourceWidth: c.sourceWidth,
        sourceHeight: c.sourceHeight,
      };
    } catch {
      fail("裁剪区域超出原图。");
    }
    const expected = bounds
      ? fitGrid(crop.width, crop.height, bounds.width, bounds.height)
      : {
          width: g.width,
          height: Math.max(1, Math.round((crop.height / crop.width) * g.width)),
        };
    if (expected.width !== g.width || expected.height !== g.height)
      fail("裁剪比例与图案不一致。");
  }
  return {
    schemaVersion: 1,
    name: string(input.name, 80) ? input.name : "我的拼豆图案",
    palette: {
      id: p.id,
      brand: p.brand,
      series: p.series,
      version: p.version,
      source: typeof p.source === "string" ? p.source.slice(0, 2048) : "",
      colors,
    },
    pattern: {
      width: g.width,
      height: g.height,
      cells: [...g.cells],
      paletteId: p.id,
      paletteVersion: p.version,
      settings: {
        width: g.width,
        sampling: g.settings.sampling,
        transparency: "empty-or-white",
        matching: "lab-cie76",
        ...(crop ? { crop } : {}),
        ...(bounds ? { bounds } : {}),
        ...(g.settings.backgroundRemoved ? { backgroundRemoved: true } : {}),
      },
    },
  };
}

export function parseProject(text) {
  if (new TextEncoder().encode(text).length > MAX_FILE_BYTES)
    fail("文件超过 10 MB。");
  let input;
  try {
    input = JSON.parse(text);
  } catch {
    fail("无法读取 JSON。");
  }
  return validateProject(input);
}

export function serializeProject(name, pattern, palette) {
  return JSON.stringify(
    validateProject({ schemaVersion: 1, name, pattern, palette }),
    null,
    2,
  );
}
