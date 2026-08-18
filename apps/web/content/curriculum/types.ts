import type { Master } from "../masters";   // 반드시 type import.
                                            // 값으로 가져오면 CHAPTER_SLOTS를 쓰는
                                            // 클라이언트 컴포넌트에 masters.ts 전체가 실린다

/** 일곱 투자 철학이 공유하는 다섯 칸. 챕터 배열의 위치가 곧 이 칸이다.
 *
 *  `asks`는 장을 읽는 사람에게 던지는 질문이다. `picks`는 비교표에서 그 칸을 고르는
 *  사람에게 던지는 질문이고, **`picks`가 있는 칸만 비교표에 나온다**.
 *
 *  실패 칸에는 `picks`가 없다. 실패는 그 철학이 무너지는 이유라서 "나는 이렇게 한다"로
 *  고를 수 있는 대상이 아니다. 배우는 장으로는 그대로 남는다. */
export const CHAPTER_SLOTS = [
  {
    no: 1,
    slot: "premise",
    label: "전제",
    asks: "이 철학은 시장에 대해 무엇을 가정하는가",
    picks: "시장을 어떻게 보는가",
  },
  {
    no: 2,
    slot: "search",
    label: "탐색",
    asks: "무엇을, 어디서 찾는가",
    picks: "살 회사를 어떻게 찾는가",
  },
  {
    no: 3,
    slot: "verify",
    label: "검증",
    asks: "사기 전에 무엇을 확인하는가",
    picks: "살 회사의 무엇을 확인하는가",
  },
  {
    no: 4,
    slot: "exit",
    label: "처분",
    asks: "언제까지 들고, 무엇이 팔게 하는가",
    picks: "가진 주식을 언제 파는가",
  },
  { no: 5, slot: "failure", label: "실패", asks: "이 철학은 어떻게 무너지는가" },
] as const;

/** 비교표에 나가는 칸. 실패 칸이 빠져 넷이다. */
export const PICKABLE_SLOTS = CHAPTER_SLOTS.filter(
  (slot): slot is Extract<(typeof CHAPTER_SLOTS)[number], { picks: string }> => "picks" in slot,
);

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

/** 주석의 세 유형. 어디까지가 대가의 말이고 어디부터가 이 과정의 서술인지 가른다.
 *  이 구분이 없으면 커리큘럼이 만든 표현을 그 사람이 실제로 한 말로 오해하게 된다. */
export const SOURCE_KINDS = ["원문", "정리", "창작"] as const;

export type SourceKind = (typeof SOURCE_KINDS)[number];

export const SOURCE_KIND_MEANING: Record<SourceKind, string> = {
  원문: "그 사람의 책·주주서한·인터뷰에 실제로 있는 내용",
  정리: "취지는 맞지만 문장 자체는 이 과정이 요약·재구성한 것",
  창작: "원문에 근거가 없고 교육을 위해 새로 만든 것",
};

export type SourceNote = {
  kind: SourceKind;
  /** 몇 번째 본문 문단(0부터)에 붙는 각주인가. 생략하면 장 전체에 붙는다.
   *  본문을 고치고 각주를 안 고치면 validate가 빌드에서 잡는다. */
  paragraph?: number;
  text: string;
};

export type Chapter = {
  title: string;
  /** 비교표 칸에 그대로 나가는 한 문장. 제목은 은유가 섞여 있고 lede는 길이가
   *  들쭉날쭉해서 스물여덟 칸을 나란히 놓고 고르는 데는 쓸 수 없다.
   *
   *  `picks`가 있는 칸(전제·탐색·검증·처분)에서는 반드시 있어야 하고, 실패 칸에는
   *  두지 않는다. 이 짝이 맞는지는 validate가 빌드에서 본다. */
  oneLine?: string;
  lede: string;
  body: string[];
  /** 본문의 출처. 비워 둘 수 없다 — 출처 없는 서술을 남기지 않기 위한 강제다. */
  sources: SourceNote[];
  exercises: Exercise[];
};

export type Curriculum = {
  masterId: Master["id"];
  sellType: string;
  sellTrigger: string;
  /** 이 철학의 1차 자료. 대가 개요 페이지에 나간다. */
  primarySources: string[];
  chapters: [Chapter, Chapter, Chapter, Chapter, Chapter];
};
