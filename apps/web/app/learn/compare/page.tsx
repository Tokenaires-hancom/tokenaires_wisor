import Link from "next/link";
import ChapterExercises from "@/components/ChapterExercises";
import { CROSS_EXERCISES } from "@/content/curriculum/compare";
import { CHAPTER_SLOTS, CURRICULA } from "@/content/curriculum";
import { MASTER_BY_ID } from "@/content/masters";

export default function CompareStylesPage() {
  return (
    <div className="wrap" style={{ paddingBlock: "3.5rem 5rem" }}>
      <p className="eyebrow">일곱 투자 철학 횡단 비교</p>
      <h1 className="thesis">
        같은 다섯 질문에 서로 다른 답을 놓습니다.
      </h1>
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
                  <th scope="row">
                    <Link href={`/learn/masters/${master.id}`}>{master.name.split(" · ")[0]}</Link>
                    <small>{master.evaluation === "score" ? "점수 모델" : "자가진단"}</small>
                  </th>
                  {curriculum.chapters.map((chapter, index) => (
                    <td key={CHAPTER_SLOTS[index].no}>
                      <Link href={`/learn/masters/${master.id}/${index + 1}`}>{chapter.title}</Link>
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="disclaimer">표는 좌우로 움직여 볼 수 있습니다. 각 칸을 누르면 해당 장으로 이동합니다.</p>

      <hr className="rule" />

      <p className="eyebrow">처분 규율</p>
      <h2 className="section">떠나는 이유가 가장 선명한 차이입니다</h2>
      <div className="comparison-scroll" tabIndex={0} aria-label="일곱 투자 철학의 처분 조건 비교표">
        <table className="comparison-matrix comparison-sell">
          <thead>
            <tr>
              <th scope="col">투자 철학</th>
              <th scope="col">유형</th>
              <th scope="col">방아쇠</th>
            </tr>
          </thead>
          <tbody>
            {CURRICULA.map((curriculum) => {
              const master = MASTER_BY_ID[curriculum.masterId];
              return (
                <tr key={curriculum.masterId}>
                  <th scope="row">{master.name.split(" · ")[0]}</th>
                  <td>{curriculum.sellType}</td>
                  <td>{curriculum.sellTrigger}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <hr className="rule" />

      <p className="eyebrow">최종 기록</p>
      <h2 className="section">내가 실행할 수 있는 교집합</h2>
      <p className="lede">
        지식보다 자본의 시간표, 기질, 실제 역량이 먼저입니다. 세 층을 차례로 적고 마지막에
        교집합을 확인합니다.
      </p>
      <ChapterExercises chapterId="compare:final" exercises={CROSS_EXERCISES} />
    </div>
  );
}
