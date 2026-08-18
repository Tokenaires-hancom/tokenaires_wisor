import ChapterExercises from "@/components/ChapterExercises";
import StyleComparisonTable from "@/components/StyleComparisonTable";
import { CROSS_EXERCISES } from "@/content/curriculum/compare";

export default function CompareStylesPage() {
  return (
    <div className="wrap" style={{ paddingBlock: "3.5rem 5rem" }}>
      <StyleComparisonTable asPageHeading />

      <hr className="rule" />

      <p className="eyebrow">최종 기록</p>
      <h2 className="section">내가 실행할 수 있는 교집합</h2>
      <ChapterExercises
        chapterId="compare:final"
        exercises={CROSS_EXERCISES}
        body={[
          "지식보다 자본의 시간표, 기질, 실제 역량이 먼저입니다. 세 층을 차례로 적고 마지막에 교집합을 확인합니다.",
        ]}
        closing="자본의 시간표, 기질, 실제 역량이 겹치는 자리에 지금 실행할 수 있는 철학이 남는다."
        syncStepToUrl={false}
      />
    </div>
  );
}
