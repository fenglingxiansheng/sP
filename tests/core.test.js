import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { rgbToLab, createMatcher } from "../src/core/color.js";
import {
  gridSize,
  sampleGrid,
  matchGrid,
  countBeads,
} from "../src/core/pattern.js";
import { createEditor, lineCells } from "../src/core/editor.js";
import { parseProject, serializeProject } from "../src/core/project.js";
import { imageHeader } from "../src/core/image.js";
import { cropFromPoints, validateCrop } from "../src/core/crop.js";

test("crop sampling excludes background and uses the selected aspect ratio", () => {
  const image = {
    width: 4,
    height: 2,
    data: [
      0, 0, 0, 255, 255, 0, 0, 255, 255, 255, 255, 255, 0, 0, 0, 255, 0, 0, 0,
      255, 0, 255, 0, 128, 0, 0, 255, 0, 0, 0, 0, 255,
    ],
  };
  const grid = sampleGrid(image, 2, { x: 1, y: 0, width: 2, height: 2 });
  assert.deepEqual(grid.colors, [
    [255, 0, 0],
    [255, 255, 255],
    [127, 255, 127],
    null,
  ]);
  assert.equal(grid.height, 2);
  assert.deepEqual(
    sampleGrid(image, 4, { x: 1, y: 0, width: 2, height: 1 }).colors,
    [
      [255, 0, 0],
      [255, 0, 0],
      [255, 255, 255],
      [255, 255, 255],
      [255, 0, 0],
      [255, 0, 0],
      [255, 255, 255],
      [255, 255, 255],
    ],
  );
});

test("crop boundaries support reverse drags, single pixels and reject invalid regions", () => {
  const image = { width: 40, height: 20 };
  assert.deepEqual(cropFromPoints({ x: 30, y: 15 }, { x: 5, y: 2 }, image), {
    x: 5,
    y: 2,
    width: 25,
    height: 13,
  });
  assert.deepEqual(cropFromPoints({ x: 40, y: 20 }, { x: 40, y: 20 }, image), {
    x: 39,
    y: 19,
    width: 1,
    height: 1,
  });
  for (const crop of [
    { x: -1, y: 0, width: 1, height: 1 },
    { x: 0, y: 0, width: 0, height: 1 },
    { x: 39, y: 0, width: 2, height: 1 },
    { x: 0.5, y: 0, width: 1, height: 1 },
  ])
    assert.throws(() => validateCrop(image, crop), /裁剪/);
});

test("crop settings survive project round trips and invalid crop metadata is rejected", () => {
  const grid = sampleGrid(
    { width: 2, height: 1, data: [255, 255, 255, 255, 0, 0, 0, 255] },
    1,
    { x: 1, y: 0, width: 1, height: 1 },
  );
  const generated = matchGrid(grid, palette);
  assert.deepEqual(
    parseProject(serializeProject("裁剪", generated, palette)).pattern,
    generated,
  );
  const bad = JSON.parse(serializeProject("裁剪", generated, palette));
  bad.pattern.settings.crop.x = 5;
  assert.throws(() => parseProject(JSON.stringify(bad)), /裁剪/);
});

const palette = JSON.parse(
  readFileSync(new URL("../src/data/artkal-s.json", import.meta.url), "utf8"),
);
const pattern = matchGrid(
  { width: 3, height: 1, colors: [[255, 255, 255], null, [0, 0, 0]] },
  palette,
);

test("official palette has 156 unique numeric S colors, no metallic approximations", () => {
  assert.equal(palette.colors.length, 156);
  assert.equal(new Set(palette.colors.map((c) => c.code)).size, 156);
  for (const c of palette.colors) {
    assert.ok(c.rgb.every((v) => Number.isInteger(v) && v >= 0 && v <= 255));
    assert.equal(
      c.hex,
      "#" +
        c.rgb
          .map((n) => n.toString(16).padStart(2, "0"))
          .join("")
          .toUpperCase(),
    );
  }
  assert.ok(
    !palette.colors.some((c) => ["S41", "S42", "S63"].includes(c.code)),
  );
});
test("Lab reference white, black and red", () => {
  for (const [rgb, expected] of [
    [
      [255, 255, 255],
      [100, 0, 0],
    ],
    [
      [0, 0, 0],
      [0, 0, 0],
    ],
    [
      [255, 0, 0],
      [53.24, 80.09, 67.2],
    ],
  ]) {
    rgbToLab(rgb).forEach((value, i) =>
      assert.ok(Math.abs(value - expected[i]) < 0.02),
    );
  }
});
test("exact matches, deterministic ties and null cells", () => {
  assert.deepEqual(pattern.cells, ["S01", null, "S13"]);
  const match = createMatcher(palette);
  assert.equal(match([234, 167, 148]), "S18"); // S94 has the same official RGB: first wins.
  for (const c of palette.colors)
    assert.deepEqual(
      palette.colors.find((p) => p.code === match(c.rgb)).rgb,
      c.rgb,
    );
});
test("nearest sampling uses pixel centers and composites alpha on white", () => {
  const grid = sampleGrid(
    { width: 2, height: 1, data: [20, 40, 60, 0, 255, 0, 0, 128] },
    2,
  );
  assert.deepEqual(grid.colors, [null, [255, 127, 127]]);
  assert.deepEqual(
    sampleGrid(
      { width: 2, height: 1, data: [0, 0, 0, 255, 255, 255, 255, 255] },
      1,
    ).colors,
    [[255, 255, 255]],
  );
  assert.deepEqual(gridSize(30, 60, 32), { width: 32, height: 64 });
  assert.throws(() => gridSize(10, 100, 64), /高度/);
  assert.throws(() => gridSize(10, 10, 1.5), /整数/);
});
test("drag interpolation is continuous and one transaction is one undo", () => {
  assert.deepEqual(lineCells([0, 0], [2, 0], 3, 1), [0, 1, 2]);
  const edit = createEditor(pattern);
  edit.begin();
  edit.paint([0], "S05");
  edit.paint([1, 2], "S05");
  edit.commit();
  assert.deepEqual(edit.pattern.cells, ["S05", "S05", "S05"]);
  edit.undo();
  assert.deepEqual(edit.pattern, pattern);
  assert.equal(edit.canUndo, false);
  edit.redo();
  assert.deepEqual(edit.pattern.cells, ["S05", "S05", "S05"]);
  edit.undo();
  edit.begin();
  edit.paint([1], "S20");
  edit.commit();
  assert.equal(edit.canRedo, false);
});
test("replace and erase update statistics and undo correctly", () => {
  const edit = createEditor(pattern);
  edit.begin();
  edit.replace("S01", "S13");
  edit.commit();
  assert.deepEqual(countBeads(edit.pattern), {
    total: 2,
    colors: 1,
    items: [{ code: "S13", count: 2 }],
  });
  edit.begin();
  edit.paint([0], null);
  edit.commit();
  assert.equal(countBeads(edit.pattern).total, 1);
  edit.undo();
  edit.undo();
  assert.deepEqual(edit.pattern, pattern);
});
test("project round trip preserves pattern and palette snapshot without history or original", () => {
  const restored = parseProject(serializeProject("小花", pattern, palette));
  assert.deepEqual(restored.pattern, pattern);
  assert.deepEqual(restored.palette.colors, palette.colors);
  assert.equal(restored.name, "小花");
  assert.equal(restored.history, undefined);
  assert.equal(restored.original, undefined);
});
test("invalid project versions, dimensions, colors and palette mismatch are rejected", () => {
  const fresh = () => JSON.parse(serializeProject("test", pattern, palette));
  for (const modify of [
    (p) => (p.schemaVersion = 9),
    (p) => (p.pattern.width = 129),
    (p) => p.pattern.cells.pop(),
    (p) => (p.pattern.cells[0] = "UNKNOWN"),
    (p) => (p.palette.colors[0].rgb[0] = 999),
    (p) => (p.pattern.paletteVersion = "other"),
  ]) {
    const p = fresh();
    modify(p);
    assert.throws(() => parseProject(JSON.stringify(p)), /项目文件无效/);
  }
  assert.throws(() => parseProject("{broken"), /JSON/);
});
test("PNG and JPEG headers can be inspected before allocating decoded pixels", () => {
  for (const filename of ["flower.png", "flower.jpg"]) {
    const bytes = readFileSync(
      new URL(`../public/samples/${filename}`, import.meta.url),
    );
    assert.deepEqual(
      imageHeader(
        bytes.buffer.slice(
          bytes.byteOffset,
          bytes.byteOffset + bytes.byteLength,
        ),
      ),
      { width: 32, height: 32 },
    );
  }
  assert.throws(() => imageHeader(new Uint8Array([1, 2, 3]).buffer), /PNG/);
});
