import assert from "node:assert/strict";
import { test } from "node:test";
import { percentShares } from "./percent.ts";

test("아무것도 고르지 않으면 전부 0", () => {
  assert.deepEqual(percentShares([0, 0, 0]), [0, 0, 0]);
});

test("나누어떨어지는 비율은 그대로", () => {
  assert.deepEqual(percentShares([1, 1, 2]), [25, 25, 50]);
});

test("나누어떨어지지 않아도 합이 100", () => {
  const shares = percentShares([1, 1, 1]);
  assert.equal(
    shares.reduce((sum, share) => sum + share, 0),
    100,
  );
  assert.deepEqual(shares, [34, 33, 33]);
});

test("일곱으로 나눠도 합이 100", () => {
  const shares = percentShares([1, 1, 1, 1, 1, 1, 1]);
  assert.equal(
    shares.reduce((sum, share) => sum + share, 0),
    100,
  );
});

test("고르지 않은 대가는 0으로 남는다", () => {
  assert.deepEqual(percentShares([2, 0, 1]), [67, 0, 33]);
});

test("한 대가만 골랐으면 100", () => {
  assert.deepEqual(percentShares([0, 5, 0]), [0, 100, 0]);
});
