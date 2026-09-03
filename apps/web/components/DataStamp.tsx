import { financialRange } from "@/lib/financialRange";
import { dateRange, displayModelVersion } from "@/lib/format";
import { isSampleData, loadScores } from "@/lib/scores";
import type { ScoresPayload } from "@/lib/scores.types";

/** "2026-08-07T15:31:15+09:00" → "2026-08-07 15:31 KST"
 *
 * 문자열을 그대로 자른다. Date로 파싱하면 보는 사람의 시간대로 바뀌어,
 * 배치가 어느 시각의 값을 받았는지가 사람마다 달라진다.
 */
function stampTime(iso: string): string {
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} KST`;
}

/** 기획서 11.2 — "현재"라고 쓰지 않고 날짜를 보여준다. */
export default function DataStamp({
  data,
  price,
  priceAt,
  financial,
  modelVersion,
  confidence,
}: {
  data?: ScoresPayload;
  price?: string;
  /** null이면 파일 전체 조회 시각 대신 종목별 과거 날짜를 표시한다. */
  priceAt?: string | null;
  financial?: string;
  modelVersion?: string;
  confidence?: string;
}) {
  const snapshot = data ?? loadScores();
  const range = financialRange(snapshot.companies, snapshot.asOf.financial);
  const effectivePriceAt = priceAt === null ? undefined : (priceAt ?? snapshot.asOf.priceAt);
  const priceCoverage = snapshot.asOf.priceCoverage;

  return (
    <div className="stamp">
      {/* 장중 체결가로 만든 파일은 종목마다 같은 시각에 받은 값이라 파일 단위 시각을
          그대로 쓴다. 종가로 만든 파일은 예전처럼 종목별 날짜를 쓴다. */}
      {effectivePriceAt ? (
        <span>
          가격 기준 {stampTime(effectivePriceAt)} 마지막 체결가
          {priceAt === undefined &&
            priceCoverage &&
            priceCoverage.refreshed < priceCoverage.total &&
            ` (${priceCoverage.refreshed}/${priceCoverage.total}종목 갱신)`}
        </span>
      ) : (
        <span>가격 기준 {price ?? snapshot.asOf.price} 종가</span>
      )}
      {/* 종목 하나를 보여줄 때는 그 종목의 날짜를, 목록에서는 걸쳐 있는 범위를 쓴다 */}
      <span>재무 기준 {financial ?? dateRange(range.from, range.to)}</span>
      {modelVersion && <span>점수 모델 {displayModelVersion(modelVersion)}</span>}
      {confidence && <span>데이터 신뢰도 {confidence}</span>}
      {snapshot.dataSource === "sec-toss" && <span>토스증권 가격 · SEC 공시</span>}
      {isSampleData(snapshot) && <span>· 예시 데이터</span>}
    </div>
  );
}

export function SampleDataFlag({ data }: { data?: ScoresPayload } = {}) {
  const snapshot = data ?? loadScores();
  if (!isSampleData(snapshot)) return null;
  return (
    <p className="sample-flag">
      지금 보이는 재무수치와 점수는 화면 확인용 <strong>예시 데이터</strong>입니다. 실제 기업의
      재무제표가 아닙니다.
    </p>
  );
}
