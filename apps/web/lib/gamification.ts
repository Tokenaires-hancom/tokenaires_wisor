/** 게이미피케이션 파생 계산 — 순수 함수만.
 *
 *  XP·레벨·스트릭 등은 따로 저장하지 않고 학습 진도(store의 Progress)에서
 *  그때그때 계산한다. DOM·저장소를 모르는 함수라 브라우저 없이 검사할 수 있다. */

import { MASTER_BY_ID } from "../content/masters.ts";
import { CHAPTER_SLOTS } from "../content/curriculum/types.ts";

/** store의 Progress와 같은 모양. 계산에 필요한 부분만 구조적으로 받는다. */
export type ProgressLike = {
  lessonsDone: string[];
  quizResults: Record<string, { correct: number; total: number; at: string }>;
};

/** 완료 챕터 하나당 XP. 퀴즈 정답은 화면 팝(비영구)으로만 다루고 여기 넣지 않는다.
 *  recordQuiz가 최신 결과로 덮어써서, 정답 수를 XP에 넣으면 재시도 시 감소하기 때문. */
const CHAPTER_XP = 20;

/** "master:{id}:{1..5}" 형태의 유효한 대가 챕터 id인지. MyLearning과 같은 기준. */
export function isMasterChapter(id: string): boolean {
  const [kind, masterId, chapter] = id.split(":");
  const no = Number(chapter);
  return (
    kind === "master" &&
    masterId in MASTER_BY_ID &&
    Number.isInteger(no) &&
    no >= 1 &&
    no <= CHAPTER_SLOTS.length
  );
}

/** 완료한 대가 챕터 수. 잘못된 id는 제외한다. */
export function chaptersDone(progress: ProgressLike): number {
  return progress.lessonsDone.filter(isMasterChapter).length;
}

/** 누적 XP = 완료 챕터 × 20. 완료 목록만 커지므로 단조 증가한다. */
export function xpTotal(progress: ProgressLike): number {
  return chaptersDone(progress) * CHAPTER_XP;
}

const MS_PER_DAY = 86_400_000;
/** 타임스탬프를 일(day) 인덱스로. 자정 경계로 하루를 가른다. */
const dayIndex = (ms: number): number => Math.floor(ms / MS_PER_DAY);

/** 연속 학습일(🔥). 퀴즈를 푼 날들의 연속 길이를 센다.
 *  마지막 활동이 오늘/어제면 유효, 이틀 넘게 지났으면 끊겨 0.
 *  now는 기준 시각(ms)으로 받아 브라우저 없이 검사할 수 있게 한다. */
export function streakDays(progress: ProgressLike, now: number): number {
  const days = new Set<number>();
  for (const r of Object.values(progress.quizResults)) {
    const t = Date.parse(r.at);
    if (Number.isFinite(t)) days.add(dayIndex(t));
  }
  if (days.size === 0) return 0;

  const today = dayIndex(now);
  const last = Math.max(...days);
  if (last < today - 1) return 0; // 이틀 넘게 공백 → 끊김

  let streak = 0;
  for (let d = last; days.has(d); d -= 1) streak += 1;
  return streak;
}

/** 오늘의 목표("1단원 + 퀴즈") 달성 여부 = 오늘 푼 퀴즈가 있는가. */
export function dailyGoalMet(progress: ProgressLike, now: number): boolean {
  const today = dayIndex(now);
  return Object.values(progress.quizResults).some((r) => {
    const t = Date.parse(r.at);
    return Number.isFinite(t) && dayIndex(t) === today;
  });
}

/** 챕터 잠금 해제 여부. 대가 안에서는 순차(앞 장 완료해야 다음), 1장은 항상 열림.
 *  대가끼리는 독립이라 한 대가의 진도가 다른 대가를 열지 않는다. */
export function isChapterUnlocked(
  progress: ProgressLike,
  masterId: string,
  chapterNo: number,
): boolean {
  if (chapterNo <= 1) return true;
  return progress.lessonsDone.includes(`master:${masterId}:${chapterNo - 1}`);
}

/** 각 레벨에 도달하는 데 필요한 누적 XP. 완료 챕터 × 20 기준(전체 35챕터 = 700). */
export const LEVELS = [0, 20, 60, 120, 200, 300, 420, 560, 700] as const;

export type LevelInfo = { level: number; xpIntoLevel: number; xpToNext: number };

/** 누적 XP를 레벨 정보로 바꾼다. 만렙에서는 xpToNext가 0이다. */
export function levelFor(xp: number): LevelInfo {
  let level = 1;
  for (let i = 1; i < LEVELS.length; i += 1) {
    if (xp >= LEVELS[i]) level = i + 1;
    else break;
  }
  const floor = LEVELS[level - 1];
  const next = LEVELS[level]; // 만렙이면 undefined
  return {
    level,
    xpIntoLevel: xp - floor,
    xpToNext: next === undefined ? 0 : next - xp,
  };
}
