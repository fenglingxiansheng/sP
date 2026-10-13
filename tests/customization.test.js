import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { boardCapacity, fitGrid } from "../src/core/sizing.js";
import { sampleGrid, matchGrid, countBeads } from "../src/core/pattern.js";
import {
  createMask,
  paintMask,
  removeConnectedColor,
  cornerSeeds,
  maskCount,
} from "../src/core/background.js";
import { parseProject, serializeProject } from "../src/core/project.js";

const palette = JSON.parse(
  readFileSync(new URL("../src/data/artkal-s.json", import.meta.url), "utf8"),
);
const image = (width, height, colors) => ({
  width,
  height,
  data: Uint8ClampedArray.from(colors.flat()),
});

test("board capacities fit landscape and portrait into a non-stretched bounding box", () => {
  assert.deepEqual(
    [1, 4, 9].map((n) => boardCapacity(n).width),
    [29, 58, 87],
  );
  assert.deepEqual(fitGrid(200, 100, 58, 58), { width: 58, height: 29 });
  assert.deepEqual(fitGrid(100, 200, 58, 58), { width: 29, height: 58 });
  assert.deepEqual(fitGrid(200, 100, 100, 30), { width: 60, height: 30 });
  assert.throws(() => fitGrid(10, 10, 129, 20), /尺寸/);
});

test("retro, smoothing and dominant-color modes produce distinct and reproducible colors", () => {
  const src = image(3, 1, [
    [255, 0, 0, 255],
    [0, 0, 255, 255],
    [255, 0, 0, 255],
  ]);
  const read = (style) =>
    sampleGrid(src, 1, null, { height: 1, style }).colors[0];
  assert.deepEqual(read("nearest"), [0, 0, 255]);
  assert.deepEqual(read("smooth"), [170, 0, 85]);
  assert.deepEqual(read("edge"), [255, 0, 0]);
  assert.throws(() => sampleGrid(src, 1, null, { style: "unknown" }), /像素/);
});

test("all sampling styles preserve fully erased regions and never blend hidden background colors", () => {
  const src = image(2, 1, [
    [255, 0, 0, 255],
    [0, 0, 255, 255],
  ]);
  for (const style of ["nearest", "smooth", "edge"]) {
    assert.deepEqual(
      sampleGrid(src, 2, null, { style, mask: new Uint8Array([1, 0]) }).colors,
      [null, [0, 0, 255]],
    );
    assert.deepEqual(
      sampleGrid(src, 1, null, { style, mask: new Uint8Array([1, 1]) }).colors,
      [null],
    );
  }
  assert.deepEqual(
    sampleGrid(src, 1, null, { style: "smooth", mask: new Uint8Array([1, 0]) })
      .colors,
    [[0, 0, 255]],
  );
  const sparse = image(3, 1, [
    [255, 0, 0, 255],
    [0, 0, 255, 255],
    [255, 0, 0, 255],
  ]);
  assert.deepEqual(
    sampleGrid(sparse, 1, null, {
      style: "smooth",
      mask: new Uint8Array([1, 0, 1]),
    }).colors,
    [null],
  );
});

test("background flood fill removes only connected similar colors, not enclosed same-color details", () => {
  const white = [255, 255, 255, 255],
    black = [0, 0, 0, 255];
  const pixels = [];
  for (let y = 0; y < 5; y++)
    for (let x = 0; x < 5; x++)
      pixels.push(
        x === 0 || x === 4 || y === 0 || y === 4 || (x === 2 && y === 2)
          ? white
          : black,
      );
  const src = image(5, 5, pixels),
    mask = createMask(src);
  removeConnectedColor(src, mask, cornerSeeds(src), 0);
  assert.equal(maskCount(mask, src), 16);
  assert.equal(mask[12], 0);
  assert.equal(
    countBeads(matchGrid(sampleGrid(src, 5, null, { mask }), palette)).total,
    9,
  );
});

test("background fill anchors tolerance to seed and ignores fully transparent seeds", () => {
  const src = image(
      5,
      1,
      [0, 10, 20, 30, 40].map((n) => [n, n, n, 255]),
    ),
    mask = createMask(src);
  removeConnectedColor(src, mask, [0], 15);
  assert.deepEqual([...mask], [1, 1, 0, 0, 0]);
  const transparent = image(2, 1, [
      [0, 0, 0, 0],
      [0, 0, 0, 255],
    ]),
    empty = createMask(transparent);
  removeConnectedColor(transparent, empty, [0], 0);
  assert.deepEqual([...empty], [0, 0]);
});

test("brush strokes have no gaps; restore retains original alpha and source data", () => {
  const src = image(
    8,
    2,
    Array.from({ length: 16 }, () => [10, 20, 30, 128]),
  );
  const original = [...src.data],
    mask = createMask(src);
  paintMask(mask, src, { x: 0.5, y: 0.5 }, { x: 7.5, y: 0.5 }, 0.6);
  assert.deepEqual([...mask.slice(0, 8)], Array(8).fill(1));
  paintMask(mask, src, { x: 3.5, y: 0.5 }, { x: 3.5, y: 0.5 }, 0.6, true);
  assert.equal(mask[3], 0);
  assert.deepEqual([...src.data], original);
  assert.deepEqual(
    sampleGrid(src, 8, null, { mask }).colors[3],
    [132, 137, 142],
  );
});

test("new size, pixelation and background settings round-trip alongside crop metadata", () => {
  const src = image(
    4,
    2,
    Array.from({ length: 8 }, () => [255, 255, 255, 255]),
  );
  const generated = matchGrid(
    sampleGrid(
      src,
      29,
      { x: 1, y: 0, width: 1, height: 2 },
      { height: 29, style: "edge", backgroundRemoved: true },
    ),
    palette,
  );
  assert.deepEqual([generated.width, generated.height], [15, 29]);
  const json = serializeProject("新项目", generated, palette);
  assert.deepEqual(parseProject(json).pattern, generated);
  for (const mutate of [
    (p) => (p.pattern.settings.bounds.width = 129),
    (p) => (p.pattern.settings.sampling = "fake"),
    (p) => (p.pattern.settings.backgroundRemoved = "yes"),
  ]) {
    const p = JSON.parse(json);
    mutate(p);
    assert.throws(() => parseProject(JSON.stringify(p)), /项目文件/);
  }
});
