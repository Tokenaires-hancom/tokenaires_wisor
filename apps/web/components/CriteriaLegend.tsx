import CriteriaBar from "@/components/CriteriaBar";
import CriteriaLegendExtras from "@/components/CriteriaLegendExtras";
import DataStamp from "@/components/DataStamp";
import type { Master } from "@/content/masters";
import { DATA } from "@/lib/scores";
import { EXCLUSION_LABELS, indexNames, type CriterionResult, type StyleMeta } from "@/lib/scores.types";

/** "이 철학이 종목을 어떻게 읽는가"를 설명하는 카드 — 지금은 `/screener/[style]`의
 *  목록 위에 있고, 좌우 분할이 들어오면 오른쪽 칸의 빈 상태(아무 종목도 안 고른
 *  동안)로 옮겨간다. `lib/scores`를 쓰는 `DataStamp`를 부르므로 서버 컴포넌트로만
 *  둔다 — 클라이언트 컴포넌트가 이 파일을 직접 import하면 안 된다. 필요할 때는
 *  서버가 미리 렌더링해 `ReactNode`로 넘긴다(`components/StockDetailBody.tsx`의
 *  `stamp` prop과 같은 방식).
 *
 *  그린블랫(순위 모델)은 기준이 아니라 두 순위를 설명해야 해서 마법공식 설명이
 *  앞에 따로 붙는다. 나머지 철학은 기준 목록만 있다. */
export default function CriteriaLegend({
  style,
  meta,
  master,
  unscorableCount,
  unscorableReason,
}: {
  style: string;
  meta: StyleMeta;
  master: Pick<Master, "name" | "oneLine">;
  /** 이 철학의 "판정 제외" 묶음 종목 수(ScreenerSplit 목록 머리의 그 숫자와 같다). */
  unscorableCount: number;
  /** 그 종목들이 판정 제외된 이유. 그린블랫은 이미 마법공식 설명 안에서
   *  "금융·보험·부동산과 유틸리티" 제외를 다루므로 여기서 또 안 보여준다. */
  unscorableReason?: string;
}) {
  const isRankModel = meta.method === "rank";
  const illustrativeCriteria: CriterionResult[] = meta.criteria.map((c) => ({
    ...c,
    status: "unknown" as const,
    message: "",
  }));

  /* 지수 구성종목이 몇 개고 그중 왜 몇 개는 판정 제외됐는지는 철학과 무관하게
     같은 숫자다(스타일별로 갈라지는 건 그 뒤 채점 단계). CriteriaLegendExtras가
     클라이언트라 lib/scores(서버 전용)를 못 읽으므로, 여기서 미리 만들어 넘긴다 —
     DataStamp를 stamp prop으로 넘기는 것과 같은 이유, 같은 방식이다. */
  const universe = DATA.universe;
  const universeExplainer = universe && (
    <div className="universe-explainer-card">
      <p>
        {indexNames(universe.indexes)} 구성종목 {universe.requested}개에서 출발합니다
        {universe.fetchedAt && ` (구성종목 기준 ${universe.fetchedAt})`}. 특정 종목을 골라 담지
        않고 지수를 통째로 가져옵니다. 고르는 순간 결과가 그 선택을 따라가기 때문입니다.
      </p>
      <p>
        이 가운데 {universe.requested - universe.included}개를 뺐습니다. 기업이 나빠서가 아니라
        같은 방식으로 읽을 수 없어서입니다. 사유별로 나누면 이렇습니다.
      </p>
      <ul className="reason-list">
        {universe.excluded.map((e) => (
          <li key={e.code} data-kind="unknown">
            <strong>{e.count}종목</strong> — {EXCLUSION_LABELS[e.code] ?? e.code}
            {e.examples.length > 0 && (
              <span className="mono" style={{ color: "var(--ink-faint)" }}>
                {" "}
                예: {e.examples.join(" · ")}
              </span>
            )}
          </li>
        ))}
      </ul>
      <p className="universe-explainer-total">
        남은 <strong>{universe.included}종목</strong>이 목록에 실립니다.
      </p>
      {!isRankModel && unscorableCount > 0 && unscorableReason && (
        <p className="universe-explainer-total">
          이 중 <strong>{unscorableCount}종목</strong>은 이 철학에서 판정 제외입니다. {unscorableReason}
        </p>
      )}
    </div>
  );

  return (
    <>
      <div className="criteria-legend-intro">
        <h2>{master.name}의 투자 철학</h2>
        <p>{master.oneLine}</p>
      </div>

      {style === "greenblatt" && (
        <section className="magic-formula-explainer" aria-labelledby="magic-formula-title">
          <div className="magic-formula-copy">
            <p className="eyebrow">마법공식 이해하기</p>
            <h2 id="magic-formula-title">좋은 기업을, 싼 가격에 찾는 두 개의 순위표</h2>
            <p>
              그린블랫은 새로운 원리를 발명하기보다 벤저민 그레이엄의 &lsquo;싸게 사라&rsquo;는
              원칙에 워런 버핏의 &lsquo;좋은 기업을 사라&rsquo;는 생각을 결합했습니다. 자신이 오랫동안
              투자하고 컬럼비아대에서 가르쳐 온 이 방식을 2000년대 초 컴퓨터로 검증한 뒤, 누구나
              반복할 수 있도록 사업의 질과 가격을 나타내는 두 순위로 단순화했습니다. 마법공식은
              기업의 절대 점수를 정하지 않고, 두 순위를 더해 함께 앞선 기업부터 살펴봅니다.
            </p>
          </div>

          <ol className="magic-formula-flow">
            <li>
              <span className="magic-formula-step">질 순위</span>
              <strong>투입한 자본으로 이익을 잘 내는가</strong>
              <span>자본수익률 = EBIT ÷ (순운전자본 + 순유형자산)</span>
            </li>
            <li>
              <span className="magic-formula-step">가격 순위</span>
              <strong>기업 전체 가격에 비해 이익이 많은가</strong>
              <span>이익수익률 = EBIT ÷ 기업가치</span>
            </li>
            <li>
              <span className="magic-formula-step">합산 순위</span>
              <strong>두 순위의 합이 작은 기업부터 본다</strong>
              <span>한쪽만 앞선 기업보다 질과 가격이 함께 앞선 기업이 위로 갑니다.</span>
            </li>
          </ol>

          <p className="magic-formula-note">
            금융·보험·부동산과 유틸리티는 같은 방식으로 비교하기 어려워 순위에서 제외합니다.
            순위는 매수 신호가 아니라 추가로 살펴볼 순서입니다.
          </p>
        </section>
      )}

      <div className="card" style={{ marginTop: "1.5rem" }}>
        <p className="eyebrow">{isRankModel ? "순위를 만드는 방식" : "채점 방식"}</p>
        <p style={{ margin: "0 0 1rem", fontSize: "0.92rem", color: "var(--ink-soft)" }}>
          {isRankModel
            ? style === "greenblatt"
              ? "원래 마법공식대로 최신 EBIT를 순운전자본과 순유형자산의 합으로 나눈 자본수익률과 EBIT/기업가치를 각각 순위 매겨 합산합니다. 금융·유틸리티는 순위에서 제외합니다."
              : "기존 Wisor 변형대로 5년 평균 세후 ROIC와 EBIT/기업가치를 각각 순위 매긴 뒤 합산합니다."
            : "각 대가의 기준을 종목에 적용하여 충족한 기준의 비중 합으로 채점합니다. 판정할 데이터가 없는 기준은 감점하지 않고 따로 표시합니다."}
        </p>
        <CriteriaBar criteria={illustrativeCriteria} showBreakdown showLegend illustrative />
        <DataStamp modelVersion={meta.modelVersion} />
      </div>

      <CriteriaLegendExtras universeExplainer={universeExplainer} />
    </>
  );
}
