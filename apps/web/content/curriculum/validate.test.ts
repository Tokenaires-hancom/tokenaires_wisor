import assert from "node:assert/strict";
import { test } from "node:test";
import type { Chapter, Curriculum } from "./types.ts";
import { curriculumProblems } from "./validate.ts";

function chapter(overrides: Partial<Chapter> = {}): Chapter {
  return {
    title: "제목",
    lede: "인용구",
    body: ["본문 한 단락."],
    exercises: [],
    ...overrides,
  };
}

function curriculum(first: Chapter): Curriculum {
  return {
    masterId: "buffett",
    sellType: "논거 붕괴형",
    sellTrigger: "해자 침식",
    currency: "학습 내용은 2026년 7월 기준입니다.",
    chapters: [first, chapter(), chapter(), chapter(), chapter()],
  };
}

test("멀쩡한 커리큘럼은 문제를 내지 않는다", () => {
  assert.deepEqual(curriculumProblems([curriculum(chapter())]), []);
});

test("정답 인덱스가 선택지 범위를 벗어나면 잡는다", () => {
  const problems = curriculumProblems([
    curriculum(
      chapter({
        exercises: [
          {
            kind: "graded",
            prompt: "질문",
            choices: ["가", "나"],
            answers: [5],
            explain: "해설",
          },
        ],
      }),
    ),
  ]);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /범위 밖/);
});

test("정답이 하나도 없으면 잡는다", () => {
  const problems = curriculumProblems([
    curriculum(
      chapter({
        exercises: [
          { kind: "graded", prompt: "질문", choices: ["가", "나"], answers: [], explain: "해설" },
        ],
      }),
    ),
  ]);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /정답이 지정되지/);
});

test("체크 포인트가 비면 잡는다", () => {
  const problems = curriculumProblems([
    curriculum(chapter({ exercises: [{ kind: "guided", prompt: "질문", checkpoints: [] }] })),
  ]);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /체크 포인트/);
});

test("본문이 비면 잡는다", () => {
  const problems = curriculumProblems([curriculum(chapter({ body: [] }))]);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /본문이 비어/);
});

test("권유형 표현을 잡는다", () => {
  const problems = curriculumProblems([
    curriculum(chapter({ body: ["이 종목은 지금 사야 합니다."] })),
  ]);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /권유형/);
});

test("문제를 전부 모아서 돌려준다 — 첫 개에서 멈추지 않는다", () => {
  const problems = curriculumProblems([
    curriculum(chapter({ body: [], exercises: [{ kind: "guided", prompt: "질문", checkpoints: [] }] })),
  ]);
  assert.equal(problems.length, 2);
});

test("어느 대가의 몇 장인지 메시지에 담는다", () => {
  const problems = curriculumProblems([curriculum(chapter({ body: [] }))]);
  assert.match(problems[0], /buffett 1장/);
});
