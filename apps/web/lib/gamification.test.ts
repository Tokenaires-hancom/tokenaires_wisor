import assert from "node:assert/strict";
import test from "node:test";
import { levelFor, xpTotal, streakDays, dailyGoalMet, isChapterUnlocked } from "./gamification.ts";

const progress = (lessonsDone: string[]) => ({ lessonsDone, quizResults: {} });

const DAY = 86_400_000;
const NOW = Date.parse("2026-08-25T10:00:00Z");
/** 오늘로부터 dayOffset일 전에 푼 퀴즈들로 진도를 만든다. */
const quizzedOn = (dayOffsets: number[]) => ({
  lessonsDone: [],
  quizResults: Object.fromEntries(
    dayOffsets.map((d, i) => [
      `master:buffett:${i + 1}`,
      { correct: 3, total: 3, at: new Date(NOW - d * DAY).toISOString() },
    ]),
  ),
});

test("완료 챕터가 없으면 XP 0", () => {
  assert.equal(xpTotal(progress([])), 0);
});

test("유효한 대가 챕터 하나당 20 XP", () => {
  assert.equal(
    xpTotal(progress(["master:buffett:1", "master:buffett:2", "master:buffett:3"])),
    60,
  );
});

test("잘못된 id(모르는 대가·범위 밖 장·basics)는 XP에서 뺀다", () => {
  const p = progress([
    "master:buffett:1", // 유효
    "master:unknown:1", // 모르는 대가
    "master:buffett:9", // 범위 밖 장
    "master:buffett:0", // 범위 밖 장
    "basics:1", // 대가 챕터 아님
  ]);
  assert.equal(xpTotal(p), 20);
});

test("퀴즈 기록이 없으면 스트릭 0", () => {
  assert.equal(streakDays(progress([]), NOW), 0);
});

test("오늘 하루만 했으면 스트릭 1", () => {
  assert.equal(streakDays(quizzedOn([0]), NOW), 1);
});

test("오늘·어제·그제 연속이면 스트릭 3", () => {
  assert.equal(streakDays(quizzedOn([0, 1, 2]), NOW), 3);
});

test("중간에 하루 빠지면 거기서 끊긴다", () => {
  // 오늘·어제는 있고 그제(2일 전)는 없음 → 2
  assert.equal(streakDays(quizzedOn([0, 1, 3]), NOW), 2);
});

test("마지막 활동이 이틀 넘게 지났으면 스트릭 끊겨 0", () => {
  assert.equal(streakDays(quizzedOn([3, 4, 5]), NOW), 0);
});

test("어제까지 했으면 아직 유효(오늘 안 했어도)", () => {
  assert.equal(streakDays(quizzedOn([1, 2]), NOW), 2);
});

test("오늘 퀴즈를 했으면 데일리 골 달성", () => {
  assert.equal(dailyGoalMet(quizzedOn([0]), NOW), true);
});

test("오늘 안 했으면 데일리 골 미달성", () => {
  assert.equal(dailyGoalMet(quizzedOn([1]), NOW), false);
  assert.equal(dailyGoalMet(progress([]), NOW), false);
});

test("각 대가의 1장은 항상 열려 있다", () => {
  assert.equal(isChapterUnlocked(progress([]), "buffett", 1), true);
});

test("앞 장을 끝내야 다음 장이 열린다", () => {
  const p = progress(["master:buffett:1"]);
  assert.equal(isChapterUnlocked(p, "buffett", 2), true);
  assert.equal(isChapterUnlocked(p, "buffett", 3), false);
});

test("대가끼리는 독립이다(버핏 1장으로 그레이엄 2장은 안 열림)", () => {
  const p = progress(["master:buffett:1"]);
  assert.equal(isChapterUnlocked(p, "graham", 2), false);
});

test("XP 0이면 레벨 1, 다음 레벨까지 20 남았다", () => {
  const r = levelFor(0);
  assert.equal(r.level, 1);
  assert.equal(r.xpIntoLevel, 0);
  assert.equal(r.xpToNext, 20);
});

test("임계값에 정확히 닿으면 다음 레벨로 올라간다", () => {
  assert.equal(levelFor(20).level, 2);
  assert.equal(levelFor(60).level, 3);
});

test("임계값 직전이면 아직 이전 레벨이다", () => {
  const r = levelFor(19);
  assert.equal(r.level, 1);
  assert.equal(r.xpToNext, 1);
});

test("전체 완주(700)면 만렙 9, 더 넘어도 9에서 멈춘다", () => {
  assert.equal(levelFor(700).level, 9);
  assert.equal(levelFor(700).xpToNext, 0);
  assert.equal(levelFor(5000).level, 9);
});
