import type { Exercise } from "./types.ts";

/** 챕터를 한 화면에 하나씩 지나가는 단위로 쪼갠다.
 *
 *  문항 수가 장마다 달라 스텝 수도 달라진다. 콘텐츠를 고르게 맞추는 일은
 *  별도 작업이고, 여기서는 있는 그대로 펼친다. */
export type Step =
  | { kind: "read" }
  | { kind: "exercise"; index: number }
  | { kind: "summary" };

const LABEL: Record<Step["kind"], string> = {
  read: "읽기",
  exercise: "확인",
  summary: "정리",
};

export function chapterSteps(exercises: Exercise[]): Step[] {
  return [
    { kind: "read" },
    ...exercises.map((_, index) => ({ kind: "exercise" as const, index })),
    { kind: "summary" },
  ];
}

export function stepLabel(step: Step): string {
  return LABEL[step.kind];
}
