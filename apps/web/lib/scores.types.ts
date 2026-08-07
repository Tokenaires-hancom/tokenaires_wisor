/** 클라이언트에서 안전하게 가져다 쓸 수 있는 타입과 라벨.
 *
 * 이 파일은 재무데이터를 import하지 않는다. 클라이언트 컴포넌트는 반드시 여기서
 * 가져오고, `lib/scores.ts`(서버 전용)를 건드리지 않는다. 그러지 않으면
 * scores.json 전체가 브라우저 번들에 실린다.
 */

export type CriterionStatus = "pass" | "fail" | "unknown";

export type CriterionResult = {
  code: string;
  label: string;
  weight: number;
  status: CriterionStatus;
  message: string;
  detail: string;
};

export type StyleScore = {
  styleId: string;
  modelVersion: string;
  score: number | null;
  passed: number;
  totalJudged: number;
  total: number;
  dataConfidence: string;
  criteria: CriterionResult[];
  reasons: string[];
  risks: string[];
  rank?: number;
  rankComponents?: { quality: number; value: number };
};

export type Company = {
  ticker: string;
  name: string;
  sector: string;
  price: number;
  marketCap: number;
  asOf: { price: string; financial: string };
  metrics: Record<string, number | null>;
  scores: Record<string, StyleScore>;
  /** 업종이 현재 점수 모델의 전제와 달라 판정하지 않은 종목. 데이터 부족과 다르다. */
  scorable?: boolean;
  unscorableReason?: string;
};

export type StyleMeta = {
  id: string;
  name: string;
  modelVersion: string;
  method?: "threshold" | "rank";
  criteria: { code: string; label: string; weight: number; detail: string }[];
};

export type UniverseReport = {
  indexes: string[];
  fetchedAt: string;
  requested: number;
  included: number;
  excluded: { code: string; count: number; examples: string[] }[];
};

/** 지수 슬러그를 사람이 읽는 이름으로. */
export const INDEX_LABELS: Record<string, string> = {
  sp500: "S&P 500",
  nasdaq100: "NASDAQ-100",
};

/** 배치는 슬러그를 알파벳순으로 넘긴다. 화면에서는 INDEX_LABELS에 적은 순서를 따른다. */
export function indexNames(indexes: string[]): string {
  const order = Object.keys(INDEX_LABELS);
  const rank = (id: string) => (order.indexOf(id) === -1 ? order.length : order.indexOf(id));
  return [...indexes]
    .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
    .map((id) => INDEX_LABELS[id] ?? id)
    .join(" · ");
}

/** 배제 사유를 사용자 문장으로. 코드는 배치가 붙이고, 설명은 화면이 맡는다. */
export const EXCLUSION_LABELS: Record<string, string> = {
  NO_COMMON_YEARS:
    "공시 태그를 도중에 바꿔 최근 5개 회계연도가 겹치지 않습니다. 빠진 해를 채워 넣지 않습니다.",
  NOT_10K:
    "미국 연차보고서(10-K)를 제출하지 않습니다. 외국 발행사는 양식이 달라(20-F) 같은 방식으로 읽을 수 없습니다.",
  MISSING_FIELD: "점수 계산에 필요한 재무 항목을 공시에서 찾지 못했습니다.",
  STALE_FINANCIALS:
    "가장 최근 재무가 가격 기준일보다 18개월 넘게 뒤처집니다. 오래된 숫자로 채점하지 않습니다.",
  SHORT_SERIES: "5개 회계연도를 채우지 못했습니다.",
  NULL_IN_SERIES: "시계열에 빈 값이 있습니다.",
  NON_POSITIVE_REVENUE: "매출에 0 이하인 해가 있어 성장률을 만들 수 없습니다.",
  NON_POSITIVE_IC: "투하자본이 0 이하라 자본수익률을 만들 수 없습니다.",
  BAD_PRICE: "가격이 0 이하입니다.",
  BAD_SHARES: "발행주식수가 0 이하입니다.",
  MISSING_AS_OF: "기준일이 없습니다.",
  NOT_LISTED: "시세나 공시 식별자를 찾지 못했습니다.",
  FETCH_FAILED: "공시를 받아오지 못했습니다.",
};

export type ScoresPayload = {
  generatedAt: string;
  dataSource: string;
  /**
   * price는 날짜, priceAt은 체결가를 받은 시각이다.
   *
   * 장중 가격으로 만든 파일에만 priceAt이 있다. 전 거래일 종가로 만든 파일에는
   * 없고, 그때 화면은 '종가'라고 쓴다. 같은 날짜인데 점수가 다른 파일이 하루에
   * 여러 번 생기므로, 날짜만으로는 무엇이 최신인지 말할 수 없다.
   */
  asOf: { price: string; financial: string; priceAt?: string };
  universe?: UniverseReport;
  styles: StyleMeta[];
  companies: Company[];
};

/** cap: 이 배수를 넘으면 숫자 대신 '초과'로 쓴다. 분모가 0에 가까워지는 지표에만 준다. */
export const METRIC_LABELS: Record<
  string,
  { label: string; format: "pct" | "x" | "raw"; cap?: number }
> = {
  roicAvg5y: { label: "자본수익률(5년 평균)", format: "pct" },
  fcfMargin: { label: "잉여현금흐름 마진", format: "pct" },
  fcfYield: { label: "잉여현금흐름 수익률", format: "pct" },
  netDebtToEbitda: { label: "순부채 / EBITDA", format: "x" },
  interestCoverage: { label: "이자보상배율", format: "x", cap: 100 },
  revenueCagr5y: { label: "매출 5년 연평균 성장률", format: "pct" },
  epsCagr5y: { label: "주당순이익 5년 연평균 성장률", format: "pct" },
  pe: { label: "PER", format: "x" },
  pbr: { label: "PBR", format: "x" },
  peg: { label: "PEG", format: "raw" },
  currentRatio: { label: "유동비율", format: "raw" },
  debtToEquity: { label: "부채 / 자기자본", format: "raw" },
  evEbit: { label: "EV / EBIT", format: "x" },
  earningsYield: { label: "이익수익률(EBIT / 기업가치)", format: "pct" },
};
