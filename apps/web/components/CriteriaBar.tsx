import type { CriterionResult } from "@/lib/scores";

/** Wisor의 서명 요소.
 *  점수 숫자보다 '어떤 기준을 통과했고 어떤 기준을 판정하지 못했는가'가 먼저 보이게 한다.
 *  칸의 너비는 그 기준의 가중치다. 색이 아니라 채움·빗금·점선으로 구분해 색만으로
 *  의미를 전달하지 않는다. */
export default function CriteriaBar({
  criteria,
  size = "md",
  showLegend = false,
}: {
  criteria: CriterionResult[];
  size?: "sm" | "md";
  showLegend?: boolean;
}) {
  const passed = criteria.filter((c) => c.status === "pass").length;
  const judged = criteria.filter((c) => c.status !== "unknown").length;

  return (
    <div>
      <div
        className="criteria-bar"
        data-size={size}
        role="img"
        aria-label={`판정한 ${judged}개 기준 중 ${passed}개 통과, 전체 기준 ${criteria.length}개`}
      >
        {criteria.map((c) => (
          <span
            key={c.code}
            className="tick"
            data-status={c.status}
            style={{ ["--weight" as string]: c.weight }}
            title={`${c.label} · ${c.detail}`}
          />
        ))}
      </div>
      {showLegend && (
        <div className="criteria-legend">
          <span>
            <i className="swatch" style={{ background: "var(--gold)" }} /> 통과
          </span>
          <span>
            <i
              className="swatch"
              style={{ background: "var(--ochre-soft)", border: "1px solid var(--ochre-line)" }}
            />{" "}
            통과하지 못함
          </span>
          <span>
            <i className="swatch" style={{ border: "1px dashed var(--line-strong)" }} /> 판정할 데이터 부족
          </span>
          <span>칸의 너비는 기준의 비중입니다.</span>
        </div>
      )}
    </div>
  );
}
