/** 서버 전용 데이터 접근.
 *
 * scores.json은 종목이 늘면 수 MB가 된다. 이 파일을 클라이언트 컴포넌트에서
 * import하면 그 전부가 브라우저 번들에 실린다. 그래서 두 가지로 막는다.
 *
 * 1. 타입과 라벨은 lib/scores.types.ts로 분리했다. 클라이언트는 거기서 가져온다
 * 2. 아래 가드가 브라우저에서 모듈이 평가되면 바로 터진다
 *
 * 클라이언트에 필요한 데이터는 서버 컴포넌트에서 props로 내려보낸다.
 */

import raw from "./generated/scores.json";
import type { Company, ScoresPayload, StyleMeta } from "./scores.types";

export type {
  Company,
  CriterionResult,
  CriterionStatus,
  ScoresPayload,
  StyleMeta,
  StyleScore,
} from "./scores.types";
export { METRIC_LABELS } from "./scores.types";

if (typeof window !== "undefined") {
  throw new Error(
    "lib/scores.ts는 서버 전용입니다. 클라이언트 컴포넌트는 lib/scores.types.ts에서 " +
      "타입을 가져오고, 데이터는 서버 컴포넌트에서 props로 받으세요."
  );
}

export const DATA = raw as unknown as ScoresPayload;

export const IS_SAMPLE_DATA = DATA.dataSource === "sample";

/** 유니버스 전체가 걸쳐 있는 재무 기준일의 범위.
 *
 * DATA.asOf.financial은 가장 이른 날 하나뿐이라, 목록 화면에서 8종목에 대해
 * 틀린 날짜가 된다. 종목별 날짜는 companies[].asOf에 이미 있으므로 여기서 모은다.
 */
export const FINANCIAL_RANGE = (() => {
  const dates = DATA.companies.map((c) => c.asOf.financial).sort();
  return { from: dates[0] ?? DATA.asOf.financial, to: dates[dates.length - 1] ?? DATA.asOf.financial };
})();

export function styleMeta(styleId: string): StyleMeta | undefined {
  return DATA.styles.find((s) => s.id === styleId);
}

export function companies(): Company[] {
  return DATA.companies;
}

export function company(ticker: string): Company | undefined {
  return DATA.companies.find((c) => c.ticker.toUpperCase() === ticker.toUpperCase());
}

/** 티커 → 종목명. 클라이언트에 목록만 필요할 때 이것만 내려보낸다. */
export function companyNames(): Record<string, string> {
  return Object.fromEntries(DATA.companies.map((c) => [c.ticker, c.name]));
}

/** 점수를 매길 수 없는 종목은 순위에서 빼되 '정보 부족'으로 따로 돌려준다. */
export function ranked(styleId: string): { scored: Company[]; unscored: Company[] } {
  const scored: Company[] = [];
  const unscored: Company[] = [];

  for (const c of DATA.companies) {
    const s = c.scores[styleId];
    if (!s || s.score === null) unscored.push(c);
    else scored.push(c);
  }

  scored.sort((a, b) => {
    const aScore = a.scores[styleId];
    const bScore = b.scores[styleId];
    if (aScore.rank !== undefined && bScore.rank !== undefined) {
      return aScore.rank - bScore.rank || a.ticker.localeCompare(b.ticker);
    }
    return (bScore.score ?? 0) - (aScore.score ?? 0);
  });
  return { scored, unscored };
}
