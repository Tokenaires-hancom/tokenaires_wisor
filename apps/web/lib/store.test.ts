import assert from "node:assert/strict";
import test from "node:test";
import { withoutMasterProgress, type Progress } from "./store.ts";

test("해당 대가의 완료와 퀴즈만 초기화한다", () => {
  const progress: Progress = {
    lessonsDone: ["master:buffett:1", "master:graham:1"],
    quizResults: {
      "master:buffett:1": { correct: 2, total: 3, at: "2026-08-12T00:00:00.000Z" },
      "master:graham:1": { correct: 3, total: 3, at: "2026-08-12T00:00:00.000Z" },
    },
  };
  const before = structuredClone(progress);

  assert.deepEqual(withoutMasterProgress(progress, "buffett"), {
    lessonsDone: ["master:graham:1"],
    quizResults: {
      "master:graham:1": { correct: 3, total: 3, at: "2026-08-12T00:00:00.000Z" },
    },
  });
  assert.deepEqual(progress, before);
});
