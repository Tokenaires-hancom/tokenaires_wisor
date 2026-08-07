import Link from "next/link";
import { notFound } from "next/navigation";
import CriteriaBar from "@/components/CriteriaBar";
import DataStamp, { SampleDataFlag } from "@/components/DataStamp";
import StockLookup from "@/components/StockLookup";
import { MASTER_BY_ID, SCORABLE_MASTERS } from "@/content/masters";
import CoverageTable from "@/components/CoverageTable";
import { COVERAGE, DATA, ranked, styleMeta } from "@/lib/scores";
import { indexNames } from "@/lib/scores.types";

export function generateStaticParams() {
  return SCORABLE_MASTERS.map((master) => ({ style: master.id }));
}

export default async function Screener({ params }: { params: Promise<{ style: string }> }) {
  const { style } = await params;
  const master = MASTER_BY_ID[style as keyof typeof MASTER_BY_ID];
  const meta = styleMeta(style);
  if (!master || !meta) notFound();

  const { scored, unscored, unscorable } = ranked(style);
  const isRankModel = meta.method === "rank";
  const here = COVERAGE.byStyle.find((s) => s.styleId === style);

  return (
    <div className="wrap" style={{ paddingBlock: "3.5rem 5rem" }}>
      <p className="eyebrow">종목 찾기</p>

      <nav className="screener-style-tabs" aria-label="투자 철학 선택">
        {SCORABLE_MASTERS.map((m) => {
          const isActive = m.id === style;

          return (
            <Link
              key={m.id}
              href={`/screener/${m.id}`}
              className="screener-style-tab"
              aria-current={isActive ? "page" : undefined}
            >
              <span className="screener-tab-name">{m.name.split(" · ")[0]}</span>
              <span className="screener-tab-meta">{m.styleName}</span>
            </Link>
          );
        })}
      </nav>

      <p className="eyebrow screener-current-label">선택한 투자 철학</p>
      <h1 className="thesis" style={{ fontSize: "clamp(1.7rem, 3.6vw, 2.5rem)", maxWidth: "24ch" }}>
        {master.name.split(" · ")[0]}의 투자 철학
      </h1>
      <p className="lede">{master.oneLine}</p>

      <Link href={`/learn/masters/${master.id}`} className="btn" data-variant="quiet" style={{ marginBottom: "1.5rem" }}>
        투자 철학 배우러 가기
      </Link>

      <SampleDataFlag />

      <div style={{ marginTop: "1.5rem" }}>
        <StockLookup />
      </div>

      <div className="card" style={{ marginTop: "1.5rem" }}>
        <p className="eyebrow">{isRankModel ? "순위를 만드는 방식" : "점수를 매기는 방식"}</p>
        <p style={{ margin: "0 0 1rem", fontSize: "0.92rem", color: "var(--ink-soft)" }}>
          {isRankModel
            ? "자본수익률과 이익수익률을 각각 전체 종목 안에서 순위 매긴 뒤 두 순위를 합산합니다. 절대 문턱이나 개별 예외를 사용하지 않습니다."
            : `${meta.criteria.length}개 기준을 같은 방식으로 모든 종목에 적용하고, 충족한 기준의 비중 합을 점수로 씁니다. 판정할 데이터가 없는 기준은 감점하지 않고 따로 표시합니다.`}
        </p>
        <ol style={{ margin: 0, paddingLeft: "1.2rem", fontSize: "0.88rem", color: "var(--ink-soft)" }}>
          {meta.criteria.map((c) => (
            <li key={c.code} style={{ padding: "0.15rem 0" }}>
              <strong style={{ color: "var(--ink)" }}>{c.label}</strong> — <span className="mono">{c.detail}</span>
            </li>
          ))}
        </ol>
        <DataStamp modelVersion={meta.modelVersion} />
      </div>

      <div className="card" style={{ marginTop: "1.5rem" }}>
        <p className="eyebrow">왜 철학마다 종목 수가 다른가</p>
        <p style={{ margin: "0 0 0.5rem", fontSize: "0.92rem", color: "var(--ink-soft)" }}>
          판정할 데이터가 없는 기준은 감점하지 않고 따로 셉니다. 다만 그런 기준이 전체의 4분의
          1을 넘으면 남은 기준만으로 점수를 만들지 않습니다. <strong>기준이 적은 철학일수록 한
          항목만 비어도 이 선을 넘습니다.</strong>
        </p>
        <CoverageTable coverage={COVERAGE} currentStyle={style} />
        {here && here.topMissing.length > 0 && (
          <p style={{ margin: "1rem 0 0", fontSize: "0.88rem", color: "var(--ink-soft)" }}>
            이 철학에서 가장 많이 비었던 기준 —{" "}
            {here.topMissing.map((m) => `${m.label} ${m.count}종목`).join(" · ")}
          </p>
        )}
        {DATA.universe && (
          <p style={{ margin: "1rem 0 0", fontSize: "0.88rem", color: "var(--ink-soft)" }}>
            목록 자체는 {indexNames(DATA.universe.indexes)} 구성종목{" "}
            {DATA.universe.requested}개에서 출발해{" "}
            {DATA.universe.requested - DATA.universe.included}개를 뺀 것입니다. 기업이 나빠서가
            아니라 같은 방식으로 읽을 수 없어서입니다.
          </p>
        )}
        <p style={{ margin: "1rem 0 0" }}>
          <Link href="/learn/scoring" className="btn" data-variant="quiet">
            종목을 고르고 점수를 만드는 법
          </Link>
        </p>
      </div>

      <h2 className="section" style={{ marginTop: "3rem" }}>
        {scored.length}개 종목
      </h2>
      <p className="lede">
        순위는 결론이 아니라 살펴볼 순서입니다. 각 종목에서 충족한 기준과 확인이 필요한 점을 함께
        보세요.
      </p>

      <div>
        {scored.map((c, i) => {
          const s = c.scores[style];
          return (
            <Link key={c.ticker} href={`/stocks/${c.ticker}?style=${style}`} className="stock-row">
              <span className="stock-rank">{String(i + 1).padStart(2, "0")}</span>
              <span>
                <span className="stock-name">{c.name}</span>
                <span className="stock-ticker">{c.ticker} · {c.sector}</span>
                <div style={{ marginTop: "0.55rem", maxWidth: "420px" }}>
                  <CriteriaBar criteria={s.criteria} size="sm" />
                </div>
                <ul className="reason-list">
                  {s.reasons.slice(0, 2).map((r, ri) => (
                    <li key={ri} data-kind="pass">
                      {r}
                    </li>
                  ))}
                  {s.risks.slice(0, 1).map((r, ri) => (
                    <li key={ri} data-kind="fail">
                      {r}
                    </li>
                  ))}
                </ul>
              </span>
              <span className="stock-score">
                <span className="score-value">{s.rank !== undefined ? `#${s.rank}` : s.score}</span>
                <div className="score-of">
                  {s.rankComponents
                    ? `질 ${s.rankComponents.quality}위 · 가격 ${s.rankComponents.value}위`
                    : `${s.passed}/${s.total} 기준`}
                </div>
              </span>
            </Link>
          );
        })}
      </div>

      {unscored.length > 0 && (
        <>
          <h2 className="section" style={{ marginTop: "3rem" }}>
            정보 부족 ({unscored.length})
          </h2>
          <p className="lede">
            판정에 필요한 데이터가 모자라 점수를 만들지 않았습니다. 억지로 계산하지 않습니다.
          </p>
          <ul className="reason-list">
            {unscored.map((c) => (
              <li key={c.ticker} data-kind="unknown">
                {c.name} ({c.ticker})
              </li>
            ))}
          </ul>
        </>
      )}

      {unscorable.length > 0 && (
        <>
          <h2 className="section" style={{ marginTop: "3rem" }}>
            판정하지 않은 업종 ({unscorable.length})
          </h2>
          <p className="lede">
            {unscorable[0].unscorableReason} 데이터가 모자란 것이 아니라 모델이 맞지 않는 쪽입니다.
            종목을 눌러 지표는 그대로 볼 수 있습니다.
          </p>
          <ul className="reason-list">
            {unscorable.map((c) => (
              <li key={c.ticker} data-kind="unknown">
                <Link href={`/stocks/${c.ticker}`}>
                  {c.name} ({c.ticker})
                </Link>{" "}
                · {c.sector}
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="disclaimer">
        데이터 생성 {new Date(DATA.generatedAt).toLocaleString("ko-KR")} · 이 목록은 살펴볼 후보를
        좁히기 위한 것이며 매수 권유가 아닙니다.
      </p>
    </div>
  );
}
