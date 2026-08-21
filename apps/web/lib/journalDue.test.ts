import assert from "node:assert/strict";
import { test } from "node:test";
import { daysSince, isDue } from "./journalDue.ts";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 7, 6, 12);

test("정확히 90일이 지난 기록은 다시 볼 때가 됐다", () => {
  assert.equal(isDue(new Date(NOW - 90 * DAY).toISOString(), NOW, 90), true);
});

test("89일이 지난 기록은 아직 다시 볼 때가 아니다", () => {
  assert.equal(isDue(new Date(NOW - 89 * DAY).toISOString(), NOW, 90), false);
});

test("91일이 지난 기록은 다시 볼 때가 됐다", () => {
  assert.equal(isDue(new Date(NOW - 91 * DAY).toISOString(), NOW, 90), true);
});

test("방금 쓴 기록은 아직 다시 볼 때가 아니다", () => {
  assert.equal(isDue(new Date(NOW).toISOString(), NOW, 90), false);
});

test("다시 볼 간격을 다르게 정할 수 있다", () => {
  assert.equal(isDue(new Date(NOW - 30 * DAY).toISOString(), NOW, 30), true);
  assert.equal(isDue(new Date(NOW - 30 * DAY).toISOString(), NOW, 31), false);
});

test("기록한 날부터 며칠이 지났는지 센다", () => {
  assert.equal(daysSince(new Date(NOW - 90 * DAY).toISOString(), NOW), 90);
  assert.equal(daysSince(new Date(NOW - 200 * DAY).toISOString(), NOW), 200);
  assert.equal(daysSince(new Date(NOW).toISOString(), NOW), 0);
});

test("날짜를 못 읽으면 며칠인지 말하지 않는다", () => {
  assert.equal(daysSince("2026-13-45", NOW), null);
});
