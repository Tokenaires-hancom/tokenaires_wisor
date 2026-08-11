import assert from "node:assert/strict";
import test from "node:test";
import { CHART_LESSONS, LESSON_BY_ID } from "./chartLessons.ts";

const EXPECTED_IDS = [
  "candle-basics",
  "moving-average-basics",
  "trend-basics",
  "support-resistance",
  "volume-basics",
];

test("차트 기초는 분석 API와 약속한 다섯 단원을 유지한다", () => {
  assert.deepEqual(
    CHART_LESSONS.map((lesson) => lesson.id),
    EXPECTED_IDS
  );
});

test("각 단원은 설명, 관찰 순서, 사례, 체크리스트, 복습 문항을 충분히 갖춘다", () => {
  for (const lesson of CHART_LESSONS) {
    assert.ok(lesson.concepts.length >= 5, `${lesson.id}: 핵심 개념이 부족합니다`);
    assert.ok(lesson.readingSteps.length >= 4, `${lesson.id}: 관찰 순서가 부족합니다`);
    assert.ok(lesson.workedExample.observations.length >= 3, `${lesson.id}: 사례 관찰이 부족합니다`);
    assert.ok(lesson.checklist.length >= 5, `${lesson.id}: 체크리스트가 부족합니다`);
    assert.ok(lesson.quiz.length >= 5, `${lesson.id}: 복습 문항이 부족합니다`);
  }
});

test("모든 단원은 id로 다시 찾을 수 있다", () => {
  for (const lesson of CHART_LESSONS) {
    assert.equal(LESSON_BY_ID[lesson.id], lesson);
  }
});
