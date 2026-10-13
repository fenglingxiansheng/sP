export function validateCrop(image, crop = null) {
  const rect = crop ?? { x: 0, y: 0, width: image.width, height: image.height };
  if (
    ![rect.x, rect.y, rect.width, rect.height].every(Number.isInteger) ||
    rect.x < 0 ||
    rect.y < 0 ||
    rect.width < 1 ||
    rect.height < 1 ||
    rect.x + rect.width > image.width ||
    rect.y + rect.height > image.height
  ) {
    throw new Error("裁剪区域必须在原图内，且至少保留 1 × 1 像素。");
  }
  return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
}

// Pointer coordinates describe pixel boundaries, not pixel centers.
export function cropFromPoints(a, b, image) {
  const x = Math.max(0, Math.min(image.width - 1, Math.min(a.x, b.x)));
  const y = Math.max(0, Math.min(image.height - 1, Math.min(a.y, b.y)));
  return {
    x,
    y,
    width: Math.max(1, Math.min(image.width, Math.max(a.x, b.x)) - x),
    height: Math.max(1, Math.min(image.height, Math.max(a.y, b.y)) - y),
  };
}
