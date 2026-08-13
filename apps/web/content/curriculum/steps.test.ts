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
  const input = [journal, graded];
  const steps = chapterSteps(input);
  // index만 보면 순서를 뒤집어도 0..n-1이 나오므로 우연히 통과한다.
  // 실제 원본 배열의 어떤 항목을 가리키는지까지 확인한다.
  const first = steps[1];
  const second = steps[2];
  assert.equal(first.kind, "exercise");
  assert.equal(second.kind, "exercise");
  if (first.kind !== "exercise" || second.kind !== "exercise") return;
  assert.equal(input[first.index], journal);
  assert.equal(input[second.index], graded);
});

test("스텝 수는 문항 수보다 둘 많다", () => {
  assert.equal(chapterSteps([]).length, 2);
  assert.equal(chapterSteps([graded, journal]).length, 4);
});

test("스텝마다 사람이 읽는 이름이 있다", () => {
  assert.equal(stepLabel({ kind: "read" }), "읽기");
  assert.equal(stepLabel({ kind: "exercise", index: 0 }), "확인");
  assert.equal(stepLabel({ kind: "summary" }), "정리");
});
