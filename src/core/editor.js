export function lineCells(from, to, width, height) {
  let [x, y] = from;
  const [tx, ty] = to;
  const dx = Math.abs(tx - x),
    dy = -Math.abs(ty - y);
  const sx = x < tx ? 1 : -1,
    sy = y < ty ? 1 : -1;
  let error = dx + dy;
  const indices = [];
  while (true) {
    if (x >= 0 && y >= 0 && x < width && y < height)
      indices.push(y * width + x);
    if (x === tx && y === ty) break;
    const twice = error * 2;
    if (twice >= dy) {
      error += dy;
      x += sx;
    }
    if (twice <= dx) {
      error += dx;
      y += sy;
    }
  }
  return indices;
}

// One begin/update/commit transaction = one undo, including a dragged stroke.
export function createEditor(initial) {
  let current = initial;
  let baseline = null;
  const past = [],
    future = [];
  return {
    get pattern() {
      return current;
    },
    get canUndo() {
      return past.length > 0;
    },
    get canRedo() {
      return future.length > 0;
    },
    begin() {
      if (!baseline) baseline = current;
    },
    paint(indices, code) {
      const cells = current.cells.slice();
      for (const i of indices) {
        if (!Number.isInteger(i) || i < 0 || i >= cells.length)
          throw new Error("格子坐标越界。");
        cells[i] = code;
      }
      current = { ...current, cells };
    },
    replace(from, to) {
      current = {
        ...current,
        cells: current.cells.map((c) => (c === from ? to : c)),
      };
    },
    commit() {
      if (!baseline) return false;
      const changed = baseline.cells.some((c, i) => c !== current.cells[i]);
      if (changed) {
        past.push(baseline);
        future.length = 0;
      }
      baseline = null;
      return changed;
    },
    undo() {
      if (past.length && !baseline) {
        future.push(current);
        current = past.pop();
      }
    },
    redo() {
      if (future.length && !baseline) {
        past.push(current);
        current = future.pop();
      }
    },
  };
}
