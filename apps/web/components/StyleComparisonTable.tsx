import { CHAPTER_SLOTS, CURRICULA } from "@/content/curriculum";
import { MASTER_BY_ID } from "@/content/masters";

/** 일곱 철학 × 다섯 장 비교표. `/learn` 하단과 `/learn/compare`가 같은 표를 쓴다.
 *  `/learn`은 이미 h1을 갖고 있으므로 그쪽에서는 제목이 h2로 내려간다. */
export default function StyleComparisonTable({
  asPageHeading = false,
}: {
  asPageHeading?: boolean;
}) {
  const Heading = asPageHeading ? "h1" : "h2";

  return (
    <section className="style-comparison">
      <p className="eyebrow">일곱 투자 철학 횡단 비교</p>
      <Heading className={asPageHeading ? "thesis" : "section"}>
        같은 다섯 질문에 서로 다른 답을 놓습니다.
      </Heading>
      <p className="lede" style={{ maxWidth: "62ch" }}>
        어느 투자 철학이 더 낫다는 표가 아닙니다. 전제·탐색·검증·처분·실패의 같은 칸을 맞춰 보면,
        서로 충돌하는 규율과 함께 쓸 수 있는 부분이 분명해집니다.
      </p>

      <div className="comparison-scroll" tabIndex={0} aria-label="일곱 투자 철학의 다섯 장 비교표">
        <table className="comparison-matrix">
          <thead>
            <tr>
              <th scope="col">투자 철학</th>
              {CHAPTER_SLOTS.map((slot) => (
                <th key={slot.no} scope="col">
                  <span className="mono">{String(slot.no).padStart(2, "0")}</span>
                  <span>{slot.label}</span>
                  <small>{slot.asks}</small>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CURRICULA.map((curriculum) => {
              const master = MASTER_BY_ID[curriculum.masterId];
              return (
                <tr key={curriculum.masterId}>
                  <th scope="row">{master.name.split(" · ")[0]}</th>
                  {curriculum.chapters.map((chapter, index) => (
                    <td key={CHAPTER_SLOTS[index].no}>{chapter.title}</td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="disclaimer">표는 좌우로 움직여 볼 수 있습니다.</p>
    </section>
  );
}
