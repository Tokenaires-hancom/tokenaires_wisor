/** 여러 종목을 한 화면에 놓을 때의 재무 기준일.
 *
 * 회계연도 종료일은 회사마다 다르다. 목록에 날짜 하나를 찍으면 나머지 종목에는
 * 틀린 날짜가 된다. 가장 이른 날을 쓰면 신선도를 낮춰 말하고, 늦은 날을 쓰면
 * 실제보다 최신인 것처럼 말한다. 그래서 섞여 있다는 사실을 그대로 보여준다.
 */
export function dateRange(from: string, to: string): string {
  return from === to ? from : `${from} ~ ${to}`;
}

/** 배치의 영문 모델 버전은 호환성을 위해 유지하고, 화면에서는 한글 이름을 쓴다. */
const MODEL_NAMES: Record<string, string> = {
  "Buffett 1.0": "버핏 1.0",
  "Graham 1.0": "그레이엄 1.0",
  "Lynch 1.0": "린치 1.0",
  "Greenblatt 1.0": "그린블랫 1.0",
};

export function displayModelVersion(modelVersion: string): string {
  return MODEL_NAMES[modelVersion] ?? modelVersion;
}

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

/** 입력은 백만 달러 단위다. 한국어는 십억·백만을 배수로 쓰지 않으므로 억·조로 옮긴다. */
export function money(value: number | null | undefined): string {
  if (value === null || value === undefined) return "정보 없음";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}조 달러`;
  return `${(value / 100).toFixed(1)}억 달러`;
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
