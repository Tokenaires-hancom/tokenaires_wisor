import { useId, type ReactNode } from "react";

const TERM_DEFINITIONS = {
  roic: "투하자본수익률. 기업이 사업에 투입한 자본으로 세후영업이익을 얼마나 냈는지 보여주는 비율입니다.",
  fcfMargin:
    "매출 가운데 잉여현금흐름으로 남은 비율입니다. 잉여현금흐름을 매출로 나누어 계산합니다.",
  fcfYield:
    "시가총액과 비교해 잉여현금흐름이 어느 정도인지 보여주는 비율입니다. 잉여현금흐름을 시가총액으로 나눕니다.",
  fcf: "영업으로 번 현금에서 설비 투자 등 사업 유지에 쓴 현금을 빼고 남은 금액입니다.",
  ebitda:
    "이자·세금·감가상각비를 빼기 전 이익입니다. 사업이 현금을 벌어들이는 힘을 비교할 때 주로 씁니다.",
  ebit: "이자와 세금을 빼기 전 영업이익입니다. 기업의 본업에서 나온 이익을 비교할 때 씁니다.",
  ev: "기업가치. 시가총액에 순부채를 더해 기업 전체를 인수한다고 가정한 가치를 나타냅니다.",
  evEbit: "기업가치를 이자와 세금을 빼기 전 영업이익으로 나눈 값입니다.",
  earningsYield:
    "기업가치에 비해 영업이익이 어느 정도인지 보여주는 비율입니다. EV/EBIT의 역수입니다.",
  interestCoverage:
    "영업이익으로 이자비용을 몇 배 감당할 수 있는지 보여주는 지표입니다.",
  cagr: "여러 해의 시작값과 끝값을 기준으로 매년 같은 비율로 성장했다고 환산한 값입니다.",
  per: "주가를 주당순이익으로 나눈 값입니다. 이익에 비해 주가가 몇 배인지 보여줍니다.",
  pbr: "주가를 주당순자산으로 나눈 값입니다. 순자산에 비해 주가가 몇 배인지 보여줍니다.",
  peg: "PER을 이익 성장률로 나눈 값입니다. 이익 성장 속도와 주가 수준을 함께 비교합니다.",
  currentRatio: "유동자산을 유동부채로 나눈 값입니다. 단기 채무를 감당할 여력을 살펴봅니다.",
  debtToEquity: "총부채를 자기자본으로 나눈 값입니다. 자기자본에 비해 부채가 어느 정도인지 보여줍니다.",
  netDebt: "이자 부담이 있는 부채에서 현금성 자산을 뺀 값입니다.",
  marketCap: "주가에 발행주식수를 곱한 값으로, 주식시장이 평가한 회사 지분 전체의 가치입니다.",
} as const;

type FinancialTermKey = keyof typeof TERM_DEFINITIONS;

const TERM_ALIASES: { text: string; term: FinancialTermKey }[] = [
  { text: "잉여현금흐름 마진", term: "fcfMargin" },
  { text: "잉여현금흐름 수익률", term: "fcfYield" },
  { text: "이익수익률", term: "earningsYield" },
  { text: "매출 5년 연평균 성장률", term: "cagr" },
  { text: "주당순이익 5년 연평균 성장률", term: "cagr" },
  { text: "부채 / 자기자본", term: "debtToEquity" },
  { text: "자본수익률", term: "roic" },
  { text: "잉여현금흐름", term: "fcf" },
  { text: "이자보상배율", term: "interestCoverage" },
  { text: "연평균 성장률", term: "cagr" },
  { text: "시가총액", term: "marketCap" },
  { text: "유동비율", term: "currentRatio" },
  { text: "순부채", term: "netDebt" },
  { text: "EV / EBIT", term: "evEbit" },
  { text: "EV/EBIT", term: "evEbit" },
  { text: "EBITDA", term: "ebitda" },
  { text: "ROIC", term: "roic" },
  { text: "FCF", term: "fcf" },
  { text: "PER", term: "per" },
  { text: "PBR", term: "pbr" },
  { text: "PEG", term: "peg" },
  { text: "EBIT", term: "ebit" },
  { text: "기업가치", term: "ev" },
];

const ALIAS_PATTERN = new RegExp(
  `(${TERM_ALIASES.map(({ text }) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`,
  "g",
);

const TERM_BY_ALIAS = new Map(TERM_ALIASES.map(({ text, term }) => [text, term]));

export function FinancialTerm({ term, children }: { term: FinancialTermKey; children: ReactNode }) {
  const definition = TERM_DEFINITIONS[term];
  const tooltipId = useId();

  return (
    <span className="financial-term">
      <button type="button" className="financial-term-trigger" aria-describedby={tooltipId}>
        {children}
        <span className="financial-term-mark" aria-hidden="true">
          ?
        </span>
      </button>
      <span id={tooltipId} className="financial-term-tooltip" role="tooltip">
        {definition}
      </span>
    </span>
  );
}

export function FinancialText({ text }: { text: string }) {
  return text.split(ALIAS_PATTERN).map((part, index) => {
    const term = TERM_BY_ALIAS.get(part);
    return term ? (
      <FinancialTerm key={`${part}-${index}`} term={term}>
        {part}
      </FinancialTerm>
    ) : (
      part
    );
  });
}
