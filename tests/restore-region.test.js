import test from "node:test";
import assert from "node:assert/strict";
import { restoreConnectedColor } from "../src/core/background.js";
test("point keep restores only connected similar original pixels and preserves alpha", () => {
  const image = {
    width: 5,
    height: 1,
    data: new Uint8ClampedArray([
      30, 30, 60, 255, 35, 35, 65, 128, 200, 200, 0, 255, 30, 30, 60, 255, 30,
      30, 60, 0,
    ]),
  };
  const original = image.data.slice(),
    mask = new Uint8Array([1, 1, 1, 1, 1]);
  assert.equal(restoreConnectedColor(image, mask, [0], 10), true);
  assert.deepEqual([...mask], [0, 0, 1, 1, 1]);
  assert.deepEqual(image.data, original);
  assert.equal(restoreConnectedColor(image, mask, [0], 10), false);
});
