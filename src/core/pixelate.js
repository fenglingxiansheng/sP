export const PIXEL_STYLES = ["nearest", "smooth", "edge"];

export function visibleColor(image, index, mask) {
  if (mask?.[index]) return null;
  const offset = index * 4,
    alpha = image.data[offset + 3] / 255;
  return alpha === 0
    ? null
    : [0, 1, 2].map((channel) =>
        Math.round(image.data[offset + channel] * alpha + 255 * (1 - alpha)),
      );
}

// Area-weighted average / dominant coarse color. Ignore erased pixels entirely:
// they must never be blended back into foreground as an opaque background.
export function areaColor(image, left, top, right, bottom, style, mask) {
  let coverage = 0;
  const sums = [0, 0, 0];
  const bins = style === "edge" ? new Map() : null;
  for (let y = Math.floor(top); y < Math.ceil(bottom); y++) {
    const overlapY = Math.min(bottom, y + 1) - Math.max(top, y);
    for (let x = Math.floor(left); x < Math.ceil(right); x++) {
      const weight = overlapY * (Math.min(right, x + 1) - Math.max(left, x));
      if (
        weight <= 0 ||
        x < 0 ||
        x >= image.width ||
        y < 0 ||
        y >= image.height
      )
        continue;
      const color = visibleColor(image, y * image.width + x, mask);
      if (!color) continue;
      coverage += weight;
      if (bins) {
        const key = color.map((v) => v >> 5).join(",");
        const bin = bins.get(key) ?? { weight: 0, color: [0, 0, 0] };
        bin.weight += weight;
        for (let c = 0; c < 3; c++) bin.color[c] += color[c] * weight;
        bins.set(key, bin);
      } else for (let c = 0; c < 3; c++) sums[c] += color[c] * weight;
    }
  }
  if (coverage < (right - left) * (bottom - top) * 0.5 || coverage === 0)
    return null;
  if (!bins) return sums.map((n) => Math.round(n / coverage));
  let best;
  for (const bin of bins.values())
    if (!best || bin.weight > best.weight) best = bin;
  return best.color.map((n) => Math.round(n / best.weight));
}
