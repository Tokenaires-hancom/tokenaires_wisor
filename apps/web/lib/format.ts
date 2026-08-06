export function pct(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined) return "정보 없음";
  return `${(value * 100).toFixed(digits)}%`;
}

/** 분모가 0에 가까우면 배수가 무의미하게 커진다. 그런 지표만 cap을 준다. */
export function times(value: number | null | undefined, digits = 1, cap?: number): string {
  if (value === null || value === undefined) return "정보 없음";
  if (cap !== undefined && value > cap) return `${cap}배 초과`;
  return `${value.toFixed(digits)}배`;
}

export function plain(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined) return "정보 없음";
  return value.toFixed(digits);
}

export function money(value: number | null | undefined): string {
  if (value === null || value === undefined) return "정보 없음";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}조 달러`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}십억 달러`;
  return `${value.toFixed(0)}백만 달러`;
}

export function formatMetric(
  value: number | null | undefined,
  format: "pct" | "x" | "raw",
  cap?: number
): string {
  if (format === "pct") return pct(value);
  if (format === "x") return times(value, 1, cap);
  return plain(value);
}
