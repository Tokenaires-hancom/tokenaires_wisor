import assert from "node:assert/strict";
import test from "node:test";
import { getCarouselRange } from "./carouselRange.ts";

test("넓은 레일은 현재 보이는 카드 범위를 표시한다", () => {
  assert.deepEqual(getCarouselRange(0, 1312, 376, 7), { start: 0, end: 3 });
});

test("마지막 스크롤 위치에서는 일곱 번째 카드까지 표시한다", () => {
  assert.deepEqual(getCarouselRange(1312, 1312, 376, 7), { start: 3, end: 6 });
});

test("좁은 레일에서는 한 카드만 표시한다", () => {
  assert.deepEqual(getCarouselRange(0, 323, 339, 7), { start: 0, end: 0 });
});
