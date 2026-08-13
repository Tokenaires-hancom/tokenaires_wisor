import { MASTER_BY_ID } from "@/content/masters";
import type { Coverage } from "@/lib/coverage";

/** 철학별 채점 종목 수 비교표.
 *
 * 스크리너와 설명 페이지가 같은 값을 쓴다. 숫자를 두 곳에서 따로 세면 반드시 어긋난다.
 * 서버 컴포넌트에서 계산한 Coverage를 받기만 하고 scores.json을 직접 읽지 않는다.
 */
export default function CoverageTable({
  coverage,
  currentStyle,
}: {
  coverage: Coverage;
  currentStyle?: string;
}) {
  return (
    <table className="coverage-table">
      <thead>
        <tr>
          <th scope="col">투자 철학</th>
          <th scope="col">기준</th>
          <th scope="col">비어도 되는 수</th>
          <th scope="col">채점</th>
          <th scope="col">정보 부족</th>
        </tr>
      </thead>
      <tbody>
        {coverage.byStyle.map((s) => {
          const name = MASTER_BY_ID[s.styleId as keyof typeof MASTER_BY_ID]?.name.split(" · ")[0];
          const isRank = s.styleId.startsWith("greenblatt");
          return (
            <tr key={s.styleId} aria-current={s.styleId === currentStyle ? "true" : undefined}>
              <th scope="row">{name ?? s.styleId}</th>
              <td className="mono">{s.criteriaCount}개{isRank ? " 순위" : ""}</td>
              <td className="mono">{s.allowedUnknown}개</td>
              <td className="mono">{s.scored}종목</td>
              <td className="mono">{s.unscored === 0 ? "—" : `${s.unscored}종목`}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
