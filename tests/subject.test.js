import test from "node:test";
import assert from "node:assert/strict";
import { subjectMask, animeRegion } from "../src/core/subject-mask.js";

test("anime letterbox restores landscape and portrait without padding bleed", () => {
  assert.deepEqual(animeRegion(8, 4, 4), { x: 0, y: 1, width: 4, height: 2 });
  assert.deepEqual(animeRegion(4, 8, 4), { x: 1, y: 0, width: 2, height: 4 });
  const values = [
    1, 1, 1, 1, 0.2, 0.2, 0.8, 0.8, 0.2, 0.2, 0.8, 0.8, 1, 1, 1, 1,
  ];
  assert.deepEqual(
    [
      ...subjectMask(values, 4, 4, 2, {
        region: animeRegion(8, 4, 4),
        normalize: false,
      }),
    ],
    [1, 1, 0, 0, 1, 1, 0, 0],
  );
});
test("anime probabilities use absolute threshold, not min-max contrast stretching", () => {
  assert.deepEqual(
    [...subjectMask([0.1, 0.2, 0.1, 0.2], 2, 2, 2, { normalize: false })],
    [1, 1, 1, 1],
  );
  assert.deepEqual(
    [...subjectMask([0.8, 0.8, 0.8, 0.8], 2, 2, 2, { normalize: false })],
    [0, 0, 0, 0],
  );
});
test("saliency maps to erase mask with foreground kept and bilinear resize", () => {
  assert.deepEqual([...subjectMask([0, 1, 0, 1], 2, 2, 2)], [1, 0, 1, 0]);
  assert.deepEqual([...subjectMask([0, 1, 0, 1], 2, 4, 1)], [1, 1, 0, 0]);
});
test("invalid or flat inference output cannot silently erase the image", () => {
  for (const values of [
    [0, 0, 0, 0],
    [0, NaN, 1, 1],
    [0, 1],
  ])
    assert.throws(() => subjectMask(values, 2, 2, 2));
});
