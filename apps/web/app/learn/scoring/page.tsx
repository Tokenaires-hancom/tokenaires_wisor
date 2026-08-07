import Link from "next/link";
import CoverageTable from "@/components/CoverageTable";
import DataStamp from "@/components/DataStamp";
import { SCORABLE_MASTERS } from "@/content/masters";
import { COVERAGE, DATA } from "@/lib/scores";
import { EXCLUSION_LABELS, indexNames } from "@/lib/scores.types";

export const metadata = {
  title: "종목을 고르고 점수를 만드는 법 — Wisor",
};

const STEPS = [
  {
    title: "기준을 하나씩 판정합니다",
    body: "각 철학은 재무 항목을 보는 기준 몇 개로 이뤄져 있습니다. 기준마다 충족·미충족을 따로 판정하고, 미충족한 기준도 숨기지 않고 같은 비중으로 보여줍니다.",
  },
  {
    title: "판정할 수 없으면 미충족이 아니라 '판정 불가'입니다",
    body: "재무 공시에 그 항목이 없으면 0으로 채우지 않습니다. 데이터가 없는 것과 기준을 못 넘은 것은 전혀 다른 정보이고, 뭉개면 공시가 부실한 기업이 구조적으로 불리해집니다.",
  },
  {
    title: "점수는 충족한 기준의 비중 합입니다",
    body: "기준마다 비중이 다릅니다. 점수는 충족한 기준의 비중을 판정한 기준의 비중으로 나눈 값입니다. 판정 불가인 기준은 분자에서도 분모에서도 빠집니다. 블랙박스 회귀식이 아닙니다.",
  },
  {
    title: "판정 불가가 4분의 1을 넘으면 점수를 만들지 않습니다",
    body: "남은 기준만으로 낸 점수는 그 철학의 판단이라고 부르기 어렵습니다. 이때는 '정보 부족'으로 표시하고 순위에서 뺍니다. 억지로 계산하지 않습니다.",
  },
  {
    title: "모델이 맞지 않는 업종은 아예 판정하지 않습니다",
    body: "네 철학 모두 사업회사의 대차대조표를 전제합니다. 예금과 대출이 본업인 은행에서는 투하자본이, 부채가 곧 사업인 회사에서는 기업가치가 의미를 잃습니다. 이 업종은 데이터가 없어서가 아니라 모델이 맞지 않아서 점수를 내지 않습니다.",
  },
];

export default function Scoring() {
  const spread = COVERAGE.byStyle.map((s) => s.scored);
  const universe = DATA.universe;

  return (
    <div className="wrap" style={{ paddingBlock: "3.5rem 5rem" }}>
      <p className="eyebrow">배우기</p>
      <h1 className="thesis" style={{ fontSize: "clamp(1.7rem, 3.6vw, 2.5rem)", maxWidth: "22ch" }}>
        종목을 고르고 점수를 만드는 법
      </h1>
      <p className="lede">
        어떤 종목이 목록에 들어오는지, 그중 몇 개에 점수가 붙는지를 순서대로 설명합니다. 두 단계
        모두에서 <strong>판단할 수 없는 것은 지어내지 않고 빼고, 뺐다는 사실을 남깁니다.</strong>
      </p>

      {universe && (
        <>
          <h2 className="section" style={{ marginTop: "3rem" }}>
            1. 종목은 어떻게 고르나
          </h2>
          <p className="lede">
            {indexNames(universe.indexes)} 구성종목 {universe.requested}개에서 출발합니다
            {universe.fetchedAt && ` (구성종목 기준 ${universe.fetchedAt})`}. 특정 종목을 골라
            담지 않고 지수를 통째로 가져옵니다. 고르는 순간 결과가 그 선택을 따라가기 때문입니다.
          </p>
          <p className="lede">
            이 가운데 {universe.requested - universe.included}개를 뺐습니다.{" "}
            <strong>기업이 나빠서가 아니라 같은 방식으로 읽을 수 없어서입니다.</strong> 사유별로
            나누면 이렇습니다.
          </p>
          <div className="card">
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
            <p style={{ margin: "1rem 0 0", fontSize: "0.88rem", color: "var(--ink-soft)" }}>
              남은 <strong>{universe.included}종목</strong>이 목록에 실립니다.
            </p>
          </div>
        </>
      )}

      <h2 className="section" style={{ marginTop: "3rem" }}>
        2. 점수는 어떻게 만드나
      </h2>
      <p className="lede">
        같은 {COVERAGE.universe}종목을 놓고도 철학마다 채점한 종목 수가 {Math.min(...spread)}개에서{" "}
        {Math.max(...spread)}개까지 갈립니다. 어느 철학이 더 엄격해서가 아니라, 각자 다른 숫자를
        요구하고 그 숫자가 없는 종목은 점수를 지어내지 않기 때문입니다.
      </p>

      <ol className="scoring-steps">
        {STEPS.map((step, i) => (
          <li key={step.title}>
            <p className="eyebrow">{i + 1}단계</p>
            <h2 className="sub" style={{ fontSize: "1.05rem", marginTop: "0.25rem" }}>
              {step.title}
            </h2>
            <p style={{ color: "var(--ink-soft)", fontSize: "0.92rem", margin: "0.5rem 0 0" }}>
              {step.body}
            </p>
          </li>
        ))}
      </ol>

      <h2 className="section" style={{ marginTop: "3rem" }}>
        철학마다 종목 수가 다른 이유
      </h2>
      <p className="lede">
        전체 {COVERAGE.universe}종목 가운데 {COVERAGE.unscorable}종목은 위 5단계의 업종에 해당해
        어느 철학에서도 판정하지 않습니다. 나머지 {COVERAGE.universe - COVERAGE.unscorable}종목이
        모든 철학의 공통 출발점이고, 여기서부터 갈립니다.
      </p>

      <div className="card">
        <CoverageTable coverage={COVERAGE} />
        <p style={{ margin: "1rem 0 0", fontSize: "0.88rem", color: "var(--ink-soft)" }}>
          &lsquo;비어도 되는 수&rsquo;는 4분의 1 규칙에서 나옵니다. 기준이 8개면 2개까지 비어도
          점수가 나오지만, 5개짜리 철학은 <strong>한 항목만 비어도 곧바로 선을 넘습니다.</strong>
        </p>
        <DataStamp />
      </div>

      <h2 className="section" style={{ marginTop: "3rem" }}>
        철학별로 무엇이 비었나
      </h2>
      <ul className="reason-list">
        {COVERAGE.byStyle.map((s) => {
          const master = SCORABLE_MASTERS.find((m) => m.id === s.styleId);
          return (
            <li key={s.styleId} data-kind={s.unscored === 0 ? "pass" : "unknown"}>
              <Link href={`/screener/${s.styleId}`}>{master?.name.split(" · ")[0] ?? s.styleId}</Link>{" "}
              — {s.unscored === 0
                ? "공통 출발점의 모든 종목을 판정했습니다."
                : `${s.unscored}종목에서 점수를 만들지 않았습니다. 주로 ${s.topMissing
                    .map((m) => `${m.label}(${m.count}종목)`)
                    .join(", ")}을 판정할 수 없었습니다.`}
            </li>
          );
        })}
      </ul>

      <p className="disclaimer">
        데이터 생성 {new Date(DATA.generatedAt).toLocaleString("ko-KR")} · 종목 수는 배치를 돌릴
        때마다 달라집니다. 이 표는 지금 저장된 결과를 그대로 센 것입니다.
      </p>
    </div>
  );
}
