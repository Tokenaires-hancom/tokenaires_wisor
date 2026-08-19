import Link from "next/link";
import { CURRICULA, SOURCE_KINDS, SOURCE_KIND_MEANING } from "@/content/curriculum";
import { MASTER_BY_ID, type Master } from "@/content/masters";

export const metadata = {
  title: "참고문헌 · 배우기",
  description: "일곱 투자 철학 커리큘럼이 근거로 삼은 1차 자료.",
};

export default function SourcesPage() {
  return (
    <div className="wrap wrap-narrow" style={{ paddingBlock: "3.5rem 5rem" }}>
      <Link
        href="/learn"
        className="card card-link"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.6rem",
          padding: "0.7rem 1rem",
          width: "fit-content",
        }}
      >
        <span aria-hidden="true">←</span>
        <strong style={{ fontSize: "0.9rem" }}>배우기</strong>
      </Link>

      <p className="eyebrow" style={{ marginTop: "1.25rem" }}>
        참고문헌
      </p>
      <h1 className="chapter-title">커리큘럼이 근거로 삼은 자료</h1>
      <p className="chapter-lede">
        투자 대가의 실제 발언을 인용하고, 여기에 Wisor의 해석과 요약을 일부 덧붙였습니다.
      </p>

      <hr className="rule" />

      <h2 className="sub">출처 표기 규칙</h2>
      <ul className="source-note-legend">
        {SOURCE_KINDS.map((kind) => (
          <li key={kind}>
            <span className="source-kind" data-kind={kind}>
              {kind}
            </span>
            <span className="source-text">{SOURCE_KIND_MEANING[kind]}</span>
          </li>
        ))}
      </ul>
      <p style={{ fontSize: "0.88rem", color: "var(--ink-soft)" }}>
        투자 철학과 매도 유형의 이름은 학습과 비교의 편의를 위해 Wisor가 붙인 것입니다.
        대가들이 자신의 투자 방식을 그렇게 부른 것은 아니며, 공식 명칭이 아닙니다.
      </p>

      <hr className="rule" />

      {CURRICULA.map((curriculum) => {
        const master = MASTER_BY_ID[curriculum.masterId as Master["id"]];
        return (
          <section key={curriculum.masterId} style={{ marginBottom: "2.25rem" }}>
            <h2 className="sub" style={{ marginBottom: "0.5rem" }}>
              <Link href={`/learn/masters/${curriculum.masterId}`}>{master.name}</Link>
              <span style={{ color: "var(--ink-faint)", fontWeight: 400 }}>
                {" "}
                · {master.styleName}
              </span>
            </h2>
            <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "0.9rem" }}>
              {curriculum.primarySources.map((source) => (
                <li key={source} style={{ color: "var(--ink-soft)", padding: "0.2rem 0" }}>
                  {source}
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      <hr className="rule" />

      <h2 className="sub">본문에서 참조한 2차 자료</h2>
      <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "0.9rem" }}>
        <li style={{ color: "var(--ink-soft)", padding: "0.2rem 0" }}>
          Pat Dorsey, <em>The Little Book That Builds Wealth</em>, 2008 — 해자 5분류의 출처
        </li>
      </ul>

      <p className="disclaimer">
        이 문서는 투자 철학의 역사와 논리 구조를 학습하기 위한 교육 자료입니다. 본문의 모든 수치
        예시는 계산 연습용입니다.
      </p>
    </div>
  );
}
