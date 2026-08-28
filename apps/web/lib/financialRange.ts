import type { Company } from "./scores.types";

export type FinancialRange = { from: string; to: string };

/** 유니버스 전체가 걸쳐 있는 재무 기준일의 범위.
 *
 * scores.json 맨 위의 asOf.financial은 가장 이른 날 하나뿐이라, 목록 화면에서
 * 나머지 종목에 대해 틀린 날짜가 된다. 종목별 날짜는 companies[].asOf에 이미
 * 있으므로 여기서 모은다.
 *
 * fallback은 종목이 하나도 없을 때 양쪽에 그대로 쓴다. 빈 문자열을 돌려주면
 * 화면에 날짜 자리가 빈 채로 나가고, 그것이 "기준일이 없는 데이터"인지
 * "계산이 틀린 것"인지 보는 사람이 구별할 수 없다.
 */
export function financialRange(companies: Company[], fallback: string): FinancialRange {
  const dates = companies.map((c) => c.asOf.financial).sort();
  return { from: dates[0] ?? fallback, to: dates[dates.length - 1] ?? fallback };
}
