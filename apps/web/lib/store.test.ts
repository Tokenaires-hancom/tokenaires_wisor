import assert from "node:assert/strict";
import test from "node:test";
import {
  hasLearningState,
  getJournal,
  getNotes,
  getProgress,
  getWatchlist,
  markLessonDone,
  recordQuiz,
  saveJournalEntry,
  saveNote,
  toggleWatch,
  withoutMasterProgress,
  type LocalLearningState,
  type Progress,
} from "./store.ts";

async function withBrowserStorage(
  run: (values: Map<string, string>) => Promise<void>,
): Promise<void> {
  const values = new Map<string, string>();
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key),
      },
      dispatchEvent: () => true,
    },
  });

  try {
    await run(values);
  } finally {
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
}

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

test("비회원 기록이 하나라도 있으면 계정 이전 대상으로 본다", () => {
  const empty: LocalLearningState = {
    watchlist: [],
    notes: [],
    progress: { lessonsDone: [], quizResults: {} },
    journal: [],
  };
  assert.equal(hasLearningState(empty), false);
  assert.equal(hasLearningState({ ...empty, watchlist: ["AAPL"] }), true);
  assert.equal(
    hasLearningState({
      ...empty,
      progress: {
        lessonsDone: [],
        quizResults: {
          "master:buffett:1": { correct: 2, total: 3, at: "2026-08-20T00:00:00.000Z" },
        },
      },
    }),
    true,
  );
});

test("비회원의 모든 학습 기록은 브라우저 임시 저장소에 남는다", async () => {
  await withBrowserStorage(async () => {
    await toggleWatch("AAPL");
    await markLessonDone("master:buffett:1");
    await recordQuiz("master:buffett:1", 2, 3);
    await saveNote({
      ticker: "AAPL",
      name: "Apple",
      whyInterested: "사업 구조 확인",
      styleScores: [],
      strengths: ["현금흐름"],
      risks: ["집중도"],
      openQuestions: "다음 분기 마진",
      status: "digging",
    });
    await saveJournalEntry("master:buffett:1#1", "무엇을 확인했나요?", "현금흐름");

    assert.deepEqual(await getWatchlist(), ["AAPL"]);
    assert.equal((await getProgress()).quizResults["master:buffett:1"].correct, 2);
    assert.equal((await getNotes())[0].ticker, "AAPL");
    assert.equal((await getJournal())[0].id, "master:buffett:1#1");
  });
});

test("학습노트는 관심 종목 등록과 관계없이 남는다", async () => {
  await withBrowserStorage(async () => {
    await saveNote({
      ticker: "AAPL",
      name: "Apple",
      whyInterested: "사업 구조 확인",
      styleScores: [],
      strengths: ["현금흐름"],
      risks: ["집중도"],
      openQuestions: "다음 분기 마진",
      status: "digging",
    });

    assert.deepEqual(await getWatchlist(), []);
    assert.equal((await getNotes())[0].ticker, "AAPL");

    await toggleWatch("AAPL");
    await toggleWatch("AAPL");

    assert.deepEqual(await getWatchlist(), []);
    assert.equal((await getNotes())[0].ticker, "AAPL");
  });
});
