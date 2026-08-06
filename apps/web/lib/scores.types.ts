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

export type ScoresPayload = {
  generatedAt: string;
  dataSource: string;
  asOf: { price: string; financial: string };
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
