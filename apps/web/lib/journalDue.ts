const DAY = 24 * 60 * 60 * 1000;

/** 기록 시각이 지정한 간격의 경계에 닿았거나 지났는지 판정한다. */
export function isDue(at: string, now: number, afterDays: number): boolean {
  return new Date(at).getTime() <= now - afterDays * DAY;
}

/** 기록한 날부터 며칠이 지났는지. 날짜를 못 읽으면 null이다 —
 *  0일로 채우면 방금 쓴 기록과 구별되지 않는다. */
export function daysSince(at: string, now: number): number | null {
  const time = new Date(at).getTime();
  if (Number.isNaN(time)) return null;
  return Math.floor((now - time) / DAY);
}
