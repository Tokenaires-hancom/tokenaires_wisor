import StyleComparisonPicker, {
  type PickerRow,
  type PickerSlot,
} from "@/components/StyleComparisonPicker";
import { CURRICULA, PICKABLE_SLOTS } from "@/content/curriculum";
import { MASTER_BY_ID } from "@/content/masters";

/** 일곱 철학 × 다섯 장 비교표. `/learn` 하단과 `/learn/compare`가 같은 표를 쓴다.
 *  `/learn`은 이미 h1을 갖고 있으므로 그쪽에서는 제목이 h2로 내려간다.
 *
 *  이 파일은 서버 컴포넌트로 남는다. 여기에 "use client"를 붙이면 커리큘럼 일곱
 *  파일의 본문 전체와 masters.ts가 통째로 브라우저 번들에 실린다. 표가 실제로
 *  쓰는 것은 아래 35개 문장뿐이라 그것만 골라 내려보낸다. */
export default function StyleComparisonTable({
  asPageHeading = false,
}: {
  asPageHeading?: boolean;
}) {
  const Heading = asPageHeading ? "h1" : "h2";

  const slots: PickerSlot[] = PICKABLE_SLOTS.map((slot) => ({
    no: slot.no,
    label: slot.label,
    picks: slot.picks,
  }));

  // 칸 순서는 PICKABLE_SLOTS가 정한다. 장 번호로 짚어야 실패 장이 빠져도 어긋나지 않는다.
  // oneLine이 비는 경우는 validate가 빌드에서 막는다
  const rows: PickerRow[] = CURRICULA.map((curriculum) => ({
    masterId: curriculum.masterId,
    name: MASTER_BY_ID[curriculum.masterId].name.split(" · ")[0],
    cells: PICKABLE_SLOTS.map((slot) => curriculum.chapters[slot.no - 1].oneLine ?? ""),
  }));

  return (
    <section className="style-comparison" id="compare">
      <Heading className={asPageHeading ? "thesis" : "section"}>
        당신은 어떤 기준을 따르고 있나요?
      </Heading>
      <p className="lede" style={{ maxWidth: "62ch" }}>
        투자 대가들의 철학을 한눈에 보고 비교해 보세요.
        <br />
        당신의 기준을 고르고 누구의 성향과 비슷한지 확인해 보세요.
      </p>

      <StyleComparisonPicker slots={slots} rows={rows} />
    </section>
  );
}
