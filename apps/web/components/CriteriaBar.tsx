import type { CriterionResult } from "@/lib/scores.types";
import { FinancialText } from "./FinancialTerm";

/** Wisor의 서명 요소.
 *  점수 숫자보다 '어떤 기준을 통과했고 어떤 기준을 판정하지 못했는가'가 먼저 보이게 한다.
 *  칸의 너비는 그 기준의 가중치다. 색이 아니라 채움·빗금·점선으로 구분해 색만으로
 *  의미를 전달하지 않는다. */
export default function CriteriaBar({
  criteria,
  size = "md",
  showLegend = false,
  showBreakdown = false,
}: {
  criteria: CriterionResult[];
  size?: "sm" | "md";
  showLegend?: boolean;
  showBreakdown?: boolean;
}) {
  const passed = criteria.filter((c) => c.status === "pass").length;
  const judged = criteria.filter((c) => c.status !== "unknown").length;
  const totalWeight = criteria.reduce((sum, c) => sum + c.weight, 0);

  function weightLabel(weight: number) {
    if (totalWeight <= 0) return "0%";
    const percent = (weight / totalWeight) * 100;
    return `${Number.isInteger(percent) ? percent : percent.toFixed(1)}%`;
  }

  return (
    <div>
      <div
        className="criteria-bar"
        data-size={size}
        role="list"
        aria-label={`판정한 ${judged}개 기준 중 ${passed}개 충족, 전체 기준 ${criteria.length}개`}
      >
        {criteria.map((c) => {
          const percent = weightLabel(c.weight);
          const tooltip = `${c.label} · 가중치 ${c.weight}점 · 비중 ${percent}`;

          return (
            <span
              key={c.code}
              className="tick"
              data-status={c.status}
              data-tooltip={tooltip}
              role="listitem"
              tabIndex={0}
              aria-label={`${tooltip} · 기준식 ${c.detail}`}
              style={{ ["--weight" as string]: c.weight }}
            />
          );
        })}
      </div>
      {showBreakdown && (
        <ol className="criteria-bar-breakdown" aria-label="기준별 가중치와 비중">
          {criteria.map((c) => (
            <li key={c.code} data-status={c.status}>
              <i className="criteria-bar-marker" aria-hidden="true" />
              <strong><FinancialText text={c.label} /></strong>
              <span className="criteria-bar-weight">
                가중치 {c.weight}점 · 비중 {weightLabel(c.weight)}
              </span>
              <p><FinancialText text={c.detail} /></p>
            </li>
          ))}
        </ol>
      )}
      {showLegend && (
        <div className="criteria-legend">
          <span>
            <i className="swatch" style={{ background: "var(--gold)" }} /> 충족
          </span>
          <span>
            <i
              className="swatch"
              style={{ background: "var(--ochre-soft)", border: "1px solid var(--ochre-line)" }}
            />{" "}
            미충족
          </span>
          <span>
            <i className="swatch" style={{ border: "1px dashed var(--line-strong)" }} /> 판정 불가
          </span>
          <span>칸의 너비는 기준의 비중입니다.</span>
        </div>
      )}
    </div>
  );
}
