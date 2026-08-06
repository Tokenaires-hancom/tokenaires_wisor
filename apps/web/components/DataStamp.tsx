import { dateRange } from "@/lib/format";
import { DATA, FINANCIAL_RANGE, IS_SAMPLE_DATA } from "@/lib/scores";

/** 기획서 11.2 — "현재"라고 쓰지 않고 날짜를 보여준다. */
export default function DataStamp({
  price,
  financial,
  modelVersion,
  confidence,
}: {
  price?: string;
  financial?: string;
  modelVersion?: string;
  confidence?: string;
}) {
  return (
    <div className="stamp">
      <span>가격 기준 {price ?? DATA.asOf.price} 종가</span>
      {/* 종목 하나를 보여줄 때는 그 종목의 날짜를, 목록에서는 걸쳐 있는 범위를 쓴다 */}
      <span>재무 기준 {financial ?? dateRange(FINANCIAL_RANGE.from, FINANCIAL_RANGE.to)}</span>
      {modelVersion && <span>점수 모델 {modelVersion}</span>}
      {confidence && <span>데이터 신뢰도 {confidence}</span>}
      {DATA.dataSource === "sec-toss" && <span>토스증권 가격 · SEC 공시</span>}
      {IS_SAMPLE_DATA && <span>· 예시 데이터</span>}
    </div>
  );
}

export function SampleDataFlag() {
  if (!IS_SAMPLE_DATA) return null;
  return (
    <p className="sample-flag">
      지금 보이는 재무수치와 점수는 화면 확인용 <strong>예시 데이터</strong>입니다. 실제 기업의
      재무제표가 아닙니다.
    </p>
  );
}
