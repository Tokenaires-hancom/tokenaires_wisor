import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  hasLearningState,
  getJournal,
  getNotes,
  getProgress,
  getWatchlist,
  journalEntriesNewestFirst,
  markLessonDone,
  recordQuiz,
  saveJournalEntry,
  saveNote,
  toggleWatch,
  withoutMasterProgress,
  type JournalEntry,
  type LocalLearningState,
  type Progress,
} from "./store.ts";

async function withBrowserStorage(
  run: (values: Map<string, string>) => Promise<void>,
  options: { failWrites?: boolean } = {},
): Promise<void> {
  const values = new Map<string, string>();
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => {
          if (options.failWrites) throw new Error("quota exceeded");
          values.set(key, value);
        },
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

test("기록형 답을 최신순으로 세우고 받은 목록은 건드리지 않는다", () => {
  const entry = (responseId: string, at: string): JournalEntry => ({
    responseId,
    id: "master:buffett:1#1",
    prompt: "무엇을 확인했나요?",
    text: `${responseId}의 답`,
    at,
  });
  // 같은 문항에 세 번 답한 상태. 저장 순서와 시간 순서를 일부러 어긋나게 둔다.
  const entries = [
    entry("second", "2026-08-20T00:00:00.000Z"),
    entry("third", "2026-08-28T00:00:00.000Z"),
    entry("first", "2026-08-12T00:00:00.000Z"),
  ];
  const before = structuredClone(entries);

  assert.deepEqual(
    journalEntriesNewestFirst(entries).map((item) => item.responseId),
    ["third", "second", "first"],
  );
  assert.deepEqual(entries, before);
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
  assert.equal(
    hasLearningState({
      ...empty,
      journal: [
        {
          responseId: "response-1",
          id: "master:buffett:1#1",
          prompt: "무엇을 확인했나요?",
          text: "현금흐름",
          at: "2026-08-20T00:00:00.000Z",
        },
      ],
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

test("같은 기록형 문항에 다시 답해도 이전 답을 남긴다", async () => {
  await withBrowserStorage(async () => {
    await saveJournalEntry("master:buffett:1#1", "무엇을 확인했나요?", "첫 답");
    await saveJournalEntry("master:buffett:1#1", "무엇을 확인했나요?", "다시 쓴 답");

    const entries = await getJournal();
    assert.equal(entries.length, 2);
    assert.deepEqual(entries.map((entry) => entry.text), ["다시 쓴 답", "첫 답"]);
    assert.notEqual(entries[0].responseId, entries[1].responseId);
  });
});

test("브라우저 저장에 실패하면 기록 완료로 처리하지 않는다", async () => {
  await withBrowserStorage(
    async () => {
      await assert.rejects(
        saveJournalEntry("master:buffett:1#1", "무엇을 확인했나요?", "현금흐름"),
        /기록을 브라우저에 저장하지 못했습니다/,
      );
      assert.deepEqual(await getJournal(), []);
    },
    { failWrites: true },
  );
});

test("브라우저의 예전 기록도 답한 시각의 최신순으로 읽는다", async () => {
  await withBrowserStorage(async (values) => {
    values.set(
      "wisor.journal",
      JSON.stringify([
        {
          id: "master:buffett:1#1",
          prompt: "첫 질문",
          text: "오래된 답",
          at: "2026-01-01T00:00:00.000Z",
        },
        {
          id: "master:graham:1#1",
          prompt: "둘째 질문",
          text: "최근 답",
          at: "2026-02-01T09:00:00+09:00",
        },
      ]),
    );

    const entries = await getJournal();
    assert.deepEqual(entries.map((entry) => entry.text), ["최근 답", "오래된 답"]);
    assert.equal(
      entries[0].responseId,
      "legacy:master:graham:1#1:2026-02-01T00:00:00.000Z",
    );
  });
});

test("DB도 브라우저와 같은 구버전 기록 식별자 규칙을 사용한다", () => {
  const schema = readFileSync(new URL("../../../supabase/schema.sql", import.meta.url), "utf8");
  const migration = readFileSync(
    new URL("../../../supabase/migrations/20260827_journal_entry_history.sql", import.meta.url),
    "utf8",
  );
  const rpcLegacyId =
    /'legacy:' \|\| \(entry ->> 'id'\) \|\| ':' \|\|\s*pg_catalog\.to_char\(\s*\(entry ->> 'at'\)::timestamptz at time zone 'UTC',\s*'YYYY-MM-DD"T"HH24:MI:SS\.MS"Z"'\s*\)/;

  assert.match(schema, rpcLegacyId);
  assert.match(migration, rpcLegacyId);
  assert.match(
    migration,
    /set response_id =\s*'legacy:' \|\| entry_id \|\| ':' \|\|\s*pg_catalog\.to_char\(\s*answered_at at time zone 'UTC',\s*'YYYY-MM-DD"T"HH24:MI:SS\.MS"Z"'\s*\)/,
  );
});

test("DB 기록 이력은 앱 사용자에게 조회와 추가만 허용한다", () => {
  const schema = readFileSync(new URL("../../../supabase/schema.sql", import.meta.url), "utf8");
  const migration = readFileSync(
    new URL("../../../supabase/migrations/20260827_journal_entry_history.sql", import.meta.url),
    "utf8",
  );

  assert.match(schema, /create policy journal_entries_owner_select[\s\S]*for select/);
  assert.match(schema, /create policy journal_entries_owner_insert[\s\S]*for insert/);
  assert.match(schema, /grant select, insert on public\.journal_entries to authenticated/);
  assert.doesNotMatch(
    schema,
    /grant select, insert, update, delete on public\.journal_entries to authenticated/,
  );
  assert.match(migration, /drop policy if exists journal_entries_owner_only/);
  assert.match(migration, /revoke all on public\.journal_entries from authenticated/);
  assert.match(migration, /grant select, insert on public\.journal_entries to authenticated/);
});
