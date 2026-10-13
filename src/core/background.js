// 0 = preserve source alpha; 1 = erase. Never overwrite the original RGBA data.
export function createMask(image) {
  return new Uint8Array(image.width * image.height);
}

export function paintMask(mask, image, from, to, radius, restore = false) {
  if (
    mask.length !== image.width * image.height ||
    !Number.isFinite(radius) ||
    radius <= 0 ||
    ![from.x, from.y, to.x, to.y].every(Number.isFinite)
  )
    throw new Error("背景笔刷参数无效。");
  const left = Math.max(0, Math.floor(Math.min(from.x, to.x) - radius));
  const right = Math.min(
    image.width - 1,
    Math.ceil(Math.max(from.x, to.x) + radius),
  );
  const top = Math.max(0, Math.floor(Math.min(from.y, to.y) - radius));
  const bottom = Math.min(
    image.height - 1,
    Math.ceil(Math.max(from.y, to.y) + radius),
  );
  const dx = to.x - from.x,
    dy = to.y - from.y,
    lengthSquared = dx * dx + dy * dy;
  let changed = false;
  for (let y = top; y <= bottom; y++)
    for (let x = left; x <= right; x++) {
      const t = lengthSquared
        ? Math.max(
            0,
            Math.min(
              1,
              ((x + 0.5 - from.x) * dx + (y + 0.5 - from.y) * dy) /
                lengthSquared,
            ),
          )
        : 0;
      if (
        (x + 0.5 - from.x - t * dx) ** 2 + (y + 0.5 - from.y - t * dy) ** 2 >
        radius ** 2
      )
        continue;
      const index = y * image.width + x,
        value = restore ? 0 : 1;
      if (mask[index] !== value) {
        mask[index] = value;
        changed = true;
      }
    }
  return changed;
}

// Flood fill is anchored to each selected border color, never to the previous
// pixel: gradual gradients must not "walk" from background into the subject.
export function removeConnectedColor(image, mask, seedIndices, tolerance = 24) {
  return fillConnectedColor(image, mask, seedIndices, tolerance, 1);
}

export function restoreConnectedColor(
  image,
  mask,
  seedIndices,
  tolerance = 24,
) {
  return fillConnectedColor(image, mask, seedIndices, tolerance, 0);
}

function fillConnectedColor(image, mask, seedIndices, tolerance, value) {
  const { width, height, data } = image,
    length = width * height;
  if (
    mask.length !== length ||
    !Number.isFinite(tolerance) ||
    tolerance < 0 ||
    tolerance > 100
  )
    throw new Error("背景去除参数无效。");
  const queue = new Uint32Array(length),
    visited = new Uint8Array(length);
  const maxDistance = 3 * tolerance ** 2;
  let changed = false;
  for (const seed of seedIndices) {
    if (
      !Number.isInteger(seed) ||
      seed < 0 ||
      seed >= length ||
      data[seed * 4 + 3] === 0
    )
      continue;
    visited.fill(0);
    const offset = seed * 4,
      target = [data[offset], data[offset + 1], data[offset + 2]];
    let head = 0,
      tail = 0;
    const visit = (index) => {
      if (visited[index]) return;
      visited[index] = 1;
      const i = index * 4;
      const transparent = data[i + 3] === 0;
      if (
        !transparent &&
        target.reduce((sum, v, c) => sum + (data[i + c] - v) ** 2, 0) >
          maxDistance
      )
        return;
      queue[tail++] = index;
    };
    visit(seed);
    while (head < tail) {
      const index = queue[head++],
        x = index % width;
      if (mask[index] !== value && data[index * 4 + 3] > 0) {
        mask[index] = value;
        changed = true;
      }
      if (x > 0) visit(index - 1);
      if (x + 1 < width) visit(index + 1);
      if (index >= width) visit(index - width);
      if (index + width < length) visit(index + width);
    }
  }
  return changed;
}

export function cornerSeeds(image, tolerance = 24) {
  // Only the most common similar opaque corner colors are considered. If all
  // four disagree, use top-left and let the user correct it with the wand/brush.
  const indices = [
    ...new Set([
      0,
      image.width - 1,
      (image.height - 1) * image.width,
      image.width * image.height - 1,
    ]),
  ].filter((i) => image.data[i * 4 + 3] > 0);
  let best = [];
  for (const seed of indices) {
    const group = indices.filter(
      (i) =>
        [0, 1, 2].reduce(
          (sum, c) =>
            sum + (image.data[i * 4 + c] - image.data[seed * 4 + c]) ** 2,
          0,
        ) <=
        3 * tolerance ** 2,
    );
    if (group.length > best.length) best = group;
  }
  return best;
}

export function maskCount(mask, image) {
  let count = 0;
  for (let i = 0; i < mask.length; i++)
    if (mask[i] && image.data[i * 4 + 3]) count++;
  return count;
}
