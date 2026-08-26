/** 레슨 미니 경로 위치. 채점형 문항을 맞힌 횟수만 센다. 오답은 자리를 바꾸지 않는다. */

/** 캐릭터가 서는 점. 0은 출발, 전부 맞히면 마지막 점. 점이 없으면 0. */
export function lessonPathIndex(correctCount: number, total: number): number {
  if (total <= 0) return 0;
  const clamped = Math.max(0, correctCount);
  return Math.min(clamped, total - 1);
}

export type LessonDotState = "done" | "current" | "todo";

/** 점 i의 표시. 맞힌 점보다 앞은 완료, 캐릭터가 선 미완료 점은 현재, 나머지는 남음. */
export function lessonDotState(
  i: number,
  correctCount: number,
  total: number,
): LessonDotState {
  if (i < correctCount) return "done";
  if (i === lessonPathIndex(correctCount, total) && correctCount < total) return "current";
  return "todo";
}
