const DAY = 24 * 60 * 60 * 1000;

/** 기록 시각이 지정한 간격의 경계에 닿았거나 지났는지 판정한다. */
export function isDue(at: string, now: number, afterDays: number): boolean {
  return new Date(at).getTime() <= now - afterDays * DAY;
}
