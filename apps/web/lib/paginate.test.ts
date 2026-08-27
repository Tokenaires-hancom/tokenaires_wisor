import assert from "node:assert/strict";
import test from "node:test";
import { PAGE_SIZE, pageCount, pageSlice } from "./paginate.ts";

const items = Array.from({ length: 26 }, (_, i) => i + 1);

test("종목이 없어도 1페이지다", () => {
  assert.equal(pageCount(0, 12), 1);
  assert.deepEqual(pageSlice([], 1, 12), []);
});

test("딱 나누어떨어지면 빈 페이지를 만들지 않는다", () => {
  assert.equal(pageCount(12, 12), 1);
  assert.equal(pageCount(24, 12), 2);
});

test("하나만 넘쳐도 페이지가 하나 늘어난다", () => {
  assert.equal(pageCount(13, 12), 2);
  assert.deepEqual(pageSlice(items, 2, 12), [13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24]);
});

test("마지막 페이지는 남은 개수만 담는다", () => {
  assert.deepEqual(pageSlice(items, 3, 12), [25, 26]);
});

test("범위 밖 페이지는 가장 가까운 끝으로 붙인다", () => {
  assert.deepEqual(pageSlice(items, 99, 12), [25, 26]);
  assert.deepEqual(pageSlice(items, 0, 12), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  assert.deepEqual(pageSlice(items, -5, 12), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
});

test("버핏 312종목은 23페이지다", () => {
  assert.equal(pageCount(312, PAGE_SIZE), 23);
});

/* size가 0으로 들어오면 나눗셈이 Infinity가 되어 페이지 수가 폭발한다.
   호출하는 쪽 실수로 화면이 멈추지 않도록 막아 둔 것을 고정한다. */
test("한 페이지 크기가 0이면 계산이 폭주하지 않는다", () => {
  assert.equal(pageCount(312, 0), 1);
  assert.deepEqual(pageSlice(items, 1, 0), []);
});
