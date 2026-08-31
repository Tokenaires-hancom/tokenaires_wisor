import assert from "node:assert/strict";
import { test } from "node:test";
import { BUFFETT } from "./buffett.ts";
import { FISHER } from "./fisher.ts";
import { GRAHAM } from "./graham.ts";
import { GREENBLATT } from "./greenblatt.ts";
import { LYNCH } from "./lynch.ts";
import { MARKS } from "./marks.ts";
import { SOROS } from "./soros.ts";
import type { Chapter, Curriculum } from "./types.ts";
import { curriculumProblems } from "./validate.ts";

function chapter(overrides: Partial<Chapter> = {}): Chapter {
  return {
    title: "제목",
    oneLine: "비교표 한 줄",
    lede: "인용구",
    body: ["본문 한 단락."],
    sources: [{ kind: "원문", paragraph: 0, text: "어떤 책 1장." }],
    exercises: [],
    ...overrides,
  };
}

function curriculum(first: Chapter): Curriculum {
  return {
    masterId: "buffett",
    sellType: "논거 붕괴형",
    sellTrigger: "해자 침식",
    primarySources: ["어떤 책 (1949)"],
    // 다섯째는 실패 장이다. 비교표에 나가지 않으므로 oneLine을 두지 않는다
    chapters: [first, chapter(), chapter(), chapter(), chapter({ oneLine: undefined })],
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
  const problems = curriculumProblems([
    curriculum(chapter({ body: [], sources: [{ kind: "원문", text: "어떤 책 1장." }] })),
  ]);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /본문이 비어/);
});

test("출처가 비면 잡는다", () => {
  const problems = curriculumProblems([curriculum(chapter({ sources: [] }))]);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /출처가 비어/);
});

test("각주가 가리키는 문단이 본문 범위 밖이면 잡는다", () => {
  // 본문을 줄이고 각주를 그대로 두면 엉뚱한 문단에 출처가 붙는다.
  const problems = curriculumProblems([
    curriculum(
      chapter({
        body: ["한 단락뿐이다."],
        sources: [{ kind: "정리", paragraph: 3, text: "이 과정의 정리다." }],
      }),
    ),
  ]);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /범위 밖/);
});

test("문단 번호가 음수면 잡는다", () => {
  const problems = curriculumProblems([
    curriculum(chapter({ sources: [{ kind: "원문", paragraph: -1, text: "출처." }] })),
  ]);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /올바르지 않습니다/);
});

test("문단 번호를 생략한 각주는 장 전체에 붙으므로 통과한다", () => {
  const problems = curriculumProblems([
    curriculum(chapter({ sources: [{ kind: "창작", text: "이 과정이 만든 이름이다." }] })),
  ]);
  assert.deepEqual(problems, []);
});

test("근거 자료 목록이 비면 잡는다", () => {
  const base = curriculum(chapter());
  const problems = curriculumProblems([{ ...base, primarySources: [] }]);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /근거 자료 목록이 비어/);
});

test("실제 일곱 커리큘럼은 문제를 내지 않는다", () => {
  assert.deepEqual(
    curriculumProblems([BUFFETT, GRAHAM, LYNCH, MARKS, FISHER, GREENBLATT, SOROS]),
    [],
  );
});

test("문제를 전부 모아서 돌려준다 — 첫 개에서 멈추지 않는다", () => {
  // 각주에 문단 번호를 두지 않아 본문·체크 포인트 두 문제만 남긴다
  const problems = curriculumProblems([
    curriculum(
      chapter({
        body: [],
        sources: [{ kind: "원문", text: "어떤 책 1장." }],
        exercises: [{ kind: "guided", prompt: "질문", checkpoints: [] }],
      }),
    ),
  ]);
  assert.equal(problems.length, 2);
});

test("어느 대가의 몇 장인지 메시지에 담는다", () => {
  const problems = curriculumProblems([curriculum(chapter({ body: [] }))]);
  assert.match(problems[0], /buffett 1장/);
});

test("비교표에 나가는 칸에 oneLine이 없으면 잡는다", () => {
  const problems = curriculumProblems([curriculum(chapter({ oneLine: undefined }))]);
  assert.match(problems[0], /oneLine이 없습니다/);
});

test("비교표에 나가지 않는 실패 칸에 oneLine이 있으면 잡는다", () => {
  const broken = curriculum(chapter());
  broken.chapters[4] = chapter({ oneLine: "여기 있으면 안 된다" });
  const problems = curriculumProblems([broken]);
  assert.match(problems[0], /5장: 비교표에 나가지 않는 칸인데 oneLine이 있습니다/);
});

test("oneLine이 24자를 넘으면 잡는다", () => {
  const problems = curriculumProblems([
    curriculum(chapter({ oneLine: "가".repeat(25) })),
  ]);
  assert.match(problems[0], /25자로 24자를 넘습니다/);
});

test("oneLine이 딱 24자면 통과한다", () => {
  assert.deepEqual(curriculumProblems([curriculum(chapter({ oneLine: "가".repeat(24) }))]), []);
});

test("oneLine이 마침표로 끝나면 잡는다", () => {
  const problems = curriculumProblems([curriculum(chapter({ oneLine: "한 줄이다." }))]);
  assert.match(problems[0], /마침표로 끝납니다/);
});
