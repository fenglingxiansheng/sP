import { textColor } from "./color.js";
import { countBeads } from "./pattern.js";

export function drawGrid(
  ctx,
  pattern,
  palette,
  { cell = 24, x = 0, y = 0, labels = true, grid = true } = {},
) {
  const colors = new Map(palette.colors.map((c) => [c.code, c]));
  ctx.save();
  ctx.font = `500 ${Math.max(7, Math.floor(cell * 0.29))}px Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  pattern.cells.forEach((code, i) => {
    const col = i % pattern.width,
      row = Math.floor(i / pattern.width);
    const px = x + col * cell,
      py = y + row * cell;
    const color = colors.get(code);
    ctx.fillStyle = color?.hex ?? ((col + row) % 2 ? "#f0f1ed" : "#fafbf8");
    ctx.fillRect(px, py, cell, cell);
    if (color && labels && cell >= 24) {
      ctx.fillStyle = textColor(color.rgb);
      ctx.fillText(code, px + cell / 2, py + cell / 2, cell - 3);
    }
  });
  if (grid) {
    ctx.strokeStyle = "#26382935";
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    for (let col = 0; col <= pattern.width; col++) {
      ctx.moveTo(x + col * cell, y);
      ctx.lineTo(x + col * cell, y + pattern.height * cell);
    }
    for (let row = 0; row <= pattern.height; row++) {
      ctx.moveTo(x, y + row * cell);
      ctx.lineTo(x + pattern.width * cell, y + row * cell);
    }
    ctx.stroke();
  }
  ctx.restore();
}

export function drawPreview(canvas, pattern, palette, options) {
  canvas.width = pattern.width * options.cell;
  canvas.height = pattern.height * options.cell;
  drawGrid(canvas.getContext("2d"), pattern, palette, options);
}

export function renderSheet(pattern, palette, name = "我的拼豆图案") {
  const cell = 32,
    margin = 56,
    top = 144;
  const stats = countBeads(pattern);
  const width = Math.max(760, pattern.width * cell + margin * 2);
  const columns = Math.max(1, Math.floor((width - margin * 2) / 164));
  const legendY = top + pattern.height * cell + 60;
  const height =
    legendY + 44 + Math.ceil(stats.items.length / columns) * 34 + 62;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#263a2b";
  ctx.font = "bold 27px Arial, sans-serif";
  ctx.fillText(
    (name.trim() || "我的拼豆图案").slice(0, 80),
    margin,
    48,
    width - margin * 2,
  );
  ctx.font = "15px Arial, sans-serif";
  ctx.fillStyle = "#5e6e62";
  ctx.fillText(
    `${palette.brand} ${palette.series}   |   ${pattern.width} × ${pattern.height} 格   |   ${stats.total} 颗   |   ${stats.colors} 色`,
    margin,
    80,
    width - margin * 2,
  );
  ctx.font = "12px Arial, sans-serif";
  ctx.fillText(
    "豆绘 · 拼豆图纸  /  空白格无需放豆  /  色号以本页图例为准",
    margin,
    106,
  );
  drawGrid(ctx, pattern, palette, { cell, x: margin, y: top, labels: true });
  ctx.fillStyle = "#627066";
  ctx.font = "10px Arial, sans-serif";
  ctx.textAlign = "center";
  for (let x = 0; x < pattern.width; x++)
    ctx.fillText(String(x + 1), margin + (x + 0.5) * cell, top - 9);
  ctx.textAlign = "right";
  for (let y = 0; y < pattern.height; y++)
    ctx.fillText(String(y + 1), margin - 9, top + (y + 0.5) * cell + 3);
  ctx.textAlign = "left";
  ctx.fillStyle = "#263a2b";
  ctx.font = "bold 19px Arial, sans-serif";
  ctx.fillText("材料清单", margin, legendY);
  const lookup = new Map(palette.colors.map((c) => [c.code, c]));
  stats.items.forEach((item, i) => {
    const x = margin + (i % columns) * 164,
      y = legendY + 20 + Math.floor(i / columns) * 34;
    ctx.fillStyle = lookup.get(item.code).hex;
    ctx.fillRect(x, y, 22, 22);
    ctx.strokeStyle = "#bbc1b8";
    ctx.strokeRect(x, y, 22, 22);
    ctx.fillStyle = "#263a2b";
    ctx.font = "13px Arial, sans-serif";
    ctx.fillText(`${item.code} · ${item.count} 颗`, x + 30, y + 16);
  });
  ctx.font = "12px Arial, sans-serif";
  ctx.fillStyle = "#778276";
  ctx.fillText(
    "颜色为数字色表近似值，实物可能存在色差。本图不按拼豆实物尺寸排版。",
    margin,
    height - 24,
    width - margin * 2,
  );
  return canvas;
}

export async function exportPng(pattern, palette, name) {
  const canvas = renderSheet(pattern, palette, name);
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("PNG 导出失败，请尝试较小的图案。"));
    }, "image/png"),
  );
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
