import { journalEntriesNewestFirst, type JournalEntry } from "./store.ts";

export type JournalGroup = {
  id: string;
  prompt: string;
  answers: JournalEntry[];
};

/** 같은 문항에 여러 번 답한 것을 한 자리에 모은다. 그룹도 그룹 안의 답도 최신순이다.
 *
 *  묶는 기준은 문항 ID다 — 응답 ID는 답할 때마다 새로 생기지만 문항 ID는 유지된다.
 *  화면에 쓰는 문구는 가장 최근 답의 것을 쓴다. 커리큘럼 본문이 고쳐지면 같은 문항이라도
 *  예전 답에는 옛 문구가 박혀 있어서, 둘을 나란히 놓으면 질문이 두 개로 보인다. */
export function groupJournalByPrompt(entries: JournalEntry[]): JournalGroup[] {
  const byQuestion = new Map<string, JournalEntry[]>();

  for (const entry of journalEntriesNewestFirst(entries)) {
    const answers = byQuestion.get(entry.id);
    if (answers) answers.push(entry);
    else byQuestion.set(entry.id, [entry]);
  }

  return [...byQuestion.values()].map((answers) => ({
    id: answers[0].id,
    prompt: answers[0].prompt,
    answers,
  }));
}
