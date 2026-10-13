export const BOARD_SIDE = 29;
export const MAX_DIMENSION = 128;

export function fitGrid(sourceWidth, sourceHeight, maxWidth, maxHeight) {
  if (
    ![sourceWidth, sourceHeight, maxWidth, maxHeight].every(Number.isInteger) ||
    sourceWidth < 1 ||
    sourceHeight < 1 ||
    maxWidth < 1 ||
    maxHeight < 1 ||
    maxWidth > MAX_DIMENSION ||
    maxHeight > MAX_DIMENSION
  ) {
    throw new Error("尺寸上限必须是 1～128 的整数。");
  }
  const scale = Math.min(maxWidth / sourceWidth, maxHeight / sourceHeight);
  return {
    width: Math.max(1, Math.min(maxWidth, Math.round(sourceWidth * scale))),
    height: Math.max(1, Math.min(maxHeight, Math.round(sourceHeight * scale))),
  };
}

export function boardCapacity(count) {
  if (![1, 4, 9].includes(count)) throw new Error("请选择 1、4 或 9 块底板。");
  const side = Math.sqrt(count) * BOARD_SIDE;
  return { width: side, height: side };
}
