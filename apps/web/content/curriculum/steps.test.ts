import assert from "node:assert/strict";
import { test } from "node:test";
import type { Exercise } from "./types.ts";
import { chapterSteps, stepLabel } from "./steps.ts";

const graded: Exercise = {
  kind: "graded",
  prompt: "물음",
  choices: ["가", "나"],
  answers: [0],
  explain: "풀이",
};
const journal: Exercise = { kind: "journal", prompt: "기록" };

test("읽기로 시작하고 정리로 끝난다", () => {
  assert.deepEqual(chapterSteps([]), [{ kind: "read" }, { kind: "summary" }]);
});

test("문항 하나가 스텝 하나가 된다", () => {
  assert.deepEqual(chapterSteps([graded, journal]), [
    { kind: "read" },
    { kind: "exercise", index: 0 },
    { kind: "exercise", index: 1 },
    { kind: "summary" },
  ]);
});

test("문항 순서가 원본 배열 순서를 그대로 따른다", () => {
  const steps = chapterSteps([journal, graded]);
  const indexes = steps
    .filter((step): step is { kind: "exercise"; index: number } => step.kind === "exercise")
    .map((step) => step.index);
  assert.deepEqual(indexes, [0, 1]);
});

test("스텝마다 사람이 읽는 이름이 있다", () => {
  assert.equal(stepLabel({ kind: "read" }), "읽기");
  assert.equal(stepLabel({ kind: "exercise", index: 0 }), "확인");
  assert.equal(stepLabel({ kind: "summary" }), "정리");
});
