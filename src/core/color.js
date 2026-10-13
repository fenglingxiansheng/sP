// sRGB (D65) -> CIELAB. Matching uses CIE76; ties keep palette order.
export function rgbToLab(rgb) {
  const [r, g, b] = rgb.map((v) => {
    const n = v / 255;
    return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
  });
  const f = (n) =>
    n > 216 / 24389 ? Math.cbrt(n) : ((24389 / 27) * n + 16) / 116;
  const x = f((0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047);
  const y = f(0.2126729 * r + 0.7151522 * g + 0.072175 * b);
  const z = f((0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

export function createMatcher(palette) {
  if (!palette.colors.length) throw new Error("色表为空。");
  const candidates = palette.colors.map((c) => ({
    code: c.code,
    lab: rgbToLab(c.rgb),
  }));
  const cache = new Map();
  return (rgb) => {
    const key = rgb.join(",");
    if (cache.has(key)) return cache.get(key);
    const lab = rgbToLab(rgb);
    let best = candidates[0].code;
    let distance = Infinity;
    for (const c of candidates) {
      const d = c.lab.reduce((sum, n, i) => sum + (n - lab[i]) ** 2, 0);
      if (d < distance) {
        distance = d;
        best = c.code;
      }
    }
    cache.set(key, best);
    return best;
  };
}

export function textColor(rgb) {
  const linear = rgb.map((v) =>
    v / 255 <= 0.04045 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4,
  );
  const luminance =
    linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
  return luminance > 0.179 ? "#17211a" : "#ffffff";
}
