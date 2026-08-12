import assert from "node:assert/strict";
import test from "node:test";
import { getCharacterAnchor } from "./masterPathAnchor.ts";

test("버핏은 1·2 / 3 / 4·5의 세 구간에서만 이동한다", () => {
  assert.equal(getCharacterAnchor(1), 2);
  assert.equal(getCharacterAnchor(2), 2);
  assert.equal(getCharacterAnchor(3), 3);
  assert.equal(getCharacterAnchor(4), 5);
  assert.equal(getCharacterAnchor(5), 5);
  assert.equal(getCharacterAnchor(undefined), 5);
});
