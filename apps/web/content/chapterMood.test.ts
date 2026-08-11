import assert from "node:assert/strict";
import test from "node:test";
import { moodFor } from "./chapterMood.ts";

test("본문 읽는 중에는 안내한다", () => {
  assert.equal(moodFor({ stepKind: "read" }), "guide");
});

test("요약에서는 깨달음과 응원을 보인다", () => {
  assert.equal(moodFor({ stepKind: "summary" }), "aha");
});

test("문항을 아직 제출하지 않았으면 안내한다", () => {
  assert.equal(
    moodFor({ stepKind: "exercise", exerciseKind: "graded", submitted: false, correct: false }),
    "guide",
  );
});

test("채점 문항을 맞히면 기뻐한다", () => {
  assert.equal(
    moodFor({ stepKind: "exercise", exerciseKind: "graded", submitted: true, correct: true }),
    "great",
  );
});

test("채점 문항을 틀리면 아쉽다", () => {
  assert.equal(
    moodFor({ stepKind: "exercise", exerciseKind: "graded", submitted: true, correct: false }),
    "nope",
  );
});

test("힌트 보기 문항을 제출하면 응원한다", () => {
  assert.equal(
    moodFor({ stepKind: "exercise", exerciseKind: "guided", submitted: true, correct: false }),
    "proud",
  );
});

test("기록을 제출하면 응원한다", () => {
  assert.equal(
    moodFor({ stepKind: "exercise", exerciseKind: "journal", submitted: true, correct: false }),
    "proud",
  );
});
