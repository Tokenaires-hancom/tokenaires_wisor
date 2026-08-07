import type { Master } from "../masters";   // 반드시 type import.
                                            // 값으로 가져오면 CHAPTER_SLOTS를 쓰는
                                            // 클라이언트 컴포넌트에 masters.ts 전체가 실린다

/** 일곱 투자 철학이 공유하는 다섯 칸. 챕터 배열의 위치가 곧 이 칸이다. */
export const CHAPTER_SLOTS = [
  { no: 1, slot: "premise", label: "전제", asks: "이 철학은 시장에 대해 무엇을 가정하는가" },
  { no: 2, slot: "search", label: "탐색", asks: "무엇을, 어디서 찾는가" },
  { no: 3, slot: "verify", label: "검증", asks: "사기 전에 무엇을 확인하는가" },
  { no: 4, slot: "exit", label: "처분", asks: "언제까지 들고, 무엇이 팔게 하는가" },
  { no: 5, slot: "failure", label: "실패", asks: "이 철학은 어떻게 무너지는가" },
] as const;

/** 즉시 정오와 풀이를 준다. answers가 배열인 것은 복수정답 문항이 있어서다. */
export type GradedExercise = {
  kind: "graded";
  prompt: string;
  choices: string[];
  answers: number[];
  explain: string;
};

/** 점수를 매기지 않는다. 먼저 써본 뒤 체크 포인트를 본다. */
export type GuidedExercise = {
  kind: "guided";
  prompt: string;
  checkpoints: string[];
};

/** 피드백이 없다. 저장했다가 90일 뒤 다시 묻는다. */
export type JournalExercise = {
  kind: "journal";
  prompt: string;
};

export type Exercise = GradedExercise | GuidedExercise | JournalExercise;

export type Chapter = {
  title: string;
  lede: string;
  body: string[];
  exercises: Exercise[];
};

export type Curriculum = {
  masterId: Master["id"];
  sellType: string;
  sellTrigger: string;
  currency: string;
  chapters: [Chapter, Chapter, Chapter, Chapter, Chapter];
};
