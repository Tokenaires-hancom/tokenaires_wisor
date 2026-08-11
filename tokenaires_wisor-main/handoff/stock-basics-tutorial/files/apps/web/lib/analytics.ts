/** 설계 가이드 16장의 측정 이벤트.
 *  MVP는 콘솔에만 남긴다. 실제 수집 도구는 2번 담당이 이 함수 하나만 바꿔 연결한다. */

export type WisorEvent =
  | "master_lesson_started"
  | "master_lesson_completed"
  | "style_screener_opened"
  | "stock_detail_opened"
  | "chart_lesson_started"
  | "chart_lesson_completed"
  | "chart_analysis_requested"
  | "chart_analysis_completed"
  | "related_chart_lesson_opened"
  | "study_note_saved"
  | "watchlist_added"
  | "stock_basics_started"
  | "stock_basics_completed";

export function track(event: WisorEvent, props: Record<string, unknown> = {}): void {
  if (typeof window === "undefined") return;
  // eslint-disable-next-line no-console
  console.debug("[wisor]", event, props);
}
