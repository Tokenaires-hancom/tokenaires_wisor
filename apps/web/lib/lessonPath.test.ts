import assert from "node:assert/strict";
import test from "node:test";
import { lessonDotState, lessonPathIndex } from "./lessonPath.ts";

test("점이 없으면 인덱스는 0", () => {
  assert.equal(lessonPathIndex(0, 0), 0);
  assert.equal(lessonPathIndex(3, 0), 0);
});

test("맞힌 수만큼 앞으로 가고 마지막 점을 넘지 않는다", () => {
  assert.equal(lessonPathIndex(0, 3), 0);
  assert.equal(lessonPathIndex(1, 3), 1);
  assert.equal(lessonPathIndex(2, 3), 2);
  assert.equal(lessonPathIndex(3, 3), 2);
});

test("문항 하나면 정답 전후 모두 그 점", () => {
  assert.equal(lessonPathIndex(0, 1), 0);
  assert.equal(lessonPathIndex(1, 1), 0);
});

test("오답(맞힌 수 유지)은 자리를 바꾸지 않는다", () => {
  assert.equal(lessonPathIndex(1, 4), lessonPathIndex(1, 4));
  assert.equal(lessonPathIndex(0, 4), 0);
});

test("점 상태는 완료·현재·남음으로 갈린다", () => {
  assert.equal(lessonDotState(0, 0, 3), "current");
  assert.equal(lessonDotState(1, 0, 3), "todo");
  assert.equal(lessonDotState(0, 1, 3), "done");
  assert.equal(lessonDotState(1, 1, 3), "current");
  assert.equal(lessonDotState(2, 1, 3), "todo");
  assert.equal(lessonDotState(0, 3, 3), "done");
  assert.equal(lessonDotState(1, 3, 3), "done");
  assert.equal(lessonDotState(2, 3, 3), "done");
});
