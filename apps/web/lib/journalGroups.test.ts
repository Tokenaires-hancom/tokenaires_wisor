import assert from "node:assert/strict";
import test from "node:test";

import { groupJournalByPrompt } from "./journalGroups.ts";
import type { JournalEntry } from "./store.ts";

function answer(overrides: Partial<JournalEntry> & { responseId: string }): JournalEntry {
  return {
    id: "master:buffett:1#1",
    prompt: "무엇을 확인했나요?",
    text: `${overrides.responseId}의 답`,
    at: "2026-08-12T00:00:00.000Z",
    ...overrides,
  };
}

test("같은 문항에 여러 번 답한 것을 한 자리에 모은다", () => {
  const groups = groupJournalByPrompt([
    answer({ responseId: "buffett-2", at: "2026-08-28T00:00:00.000Z" }),
    answer({ responseId: "graham-1", id: "master:graham:1#1", at: "2026-08-20T00:00:00.000Z" }),
    answer({ responseId: "buffett-1", at: "2026-08-12T00:00:00.000Z" }),
  ]);

  assert.deepEqual(
    groups.map((group) => [group.id, group.answers.map((item) => item.responseId)]),
    [
      ["master:buffett:1#1", ["buffett-2", "buffett-1"]],
      ["master:graham:1#1", ["graham-1"]],
    ],
  );
});

test("받은 순서가 뒤죽박죽이어도 그룹과 답을 최신순으로 세운다", () => {
  const groups = groupJournalByPrompt([
    answer({ responseId: "buffett-1", at: "2026-08-12T00:00:00.000Z" }),
    answer({ responseId: "graham-1", id: "master:graham:1#1", at: "2026-08-30T00:00:00.000Z" }),
    answer({ responseId: "buffett-2", at: "2026-08-28T00:00:00.000Z" }),
  ]);

  // 그룹 순서는 그 문항의 가장 최근 답이 정한다. graham은 답이 하나뿐이지만
  // 8/30이라 8/28이 최신인 buffett보다 앞이다.
  assert.deepEqual(groups.map((group) => group.id), [
    "master:graham:1#1",
    "master:buffett:1#1",
  ]);
  assert.deepEqual(groups[1].answers.map((item) => item.responseId), ["buffett-2", "buffett-1"]);
});

test("화면 문구는 가장 최근 답의 것을 쓴다", () => {
  // 커리큘럼 본문이 고쳐지면 같은 문항이라도 예전 답에는 옛 문구가 박혀 있다.
  const groups = groupJournalByPrompt([
    answer({ responseId: "old", prompt: "예전 문구", at: "2026-08-12T00:00:00.000Z" }),
    answer({ responseId: "new", prompt: "고친 문구", at: "2026-08-28T00:00:00.000Z" }),
  ]);

  assert.equal(groups.length, 1);
  assert.equal(groups[0].prompt, "고친 문구");
});

test("기록이 없으면 빈 목록을 준다", () => {
  assert.deepEqual(groupJournalByPrompt([]), []);
});
