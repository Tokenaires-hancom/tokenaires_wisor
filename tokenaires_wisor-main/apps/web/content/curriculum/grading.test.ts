import assert from "node:assert/strict";
import { test } from "node:test";
import { isCorrect } from "./grading.ts";

test("단일 정답을 맞히면 참", () => {
  assert.equal(isCorrect([1], [1]), true);
});

test("단일 정답을 틀리면 거짓", () => {
  assert.equal(isCorrect([1], [2]), false);
});

test("복수 정답은 고른 순서와 무관하다", () => {
  assert.equal(isCorrect([1, 3], [3, 1]), true);
});

test("복수 정답 중 일부만 고르면 거짓", () => {
  assert.equal(isCorrect([1, 3], [1]), false);
});

test("정답에 오답을 더해 고르면 거짓", () => {
  assert.equal(isCorrect([1, 3], [1, 3, 0]), false);
});

test("아무것도 고르지 않으면 거짓", () => {
  assert.equal(isCorrect([1], []), false);
});
