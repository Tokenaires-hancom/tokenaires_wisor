import Link from "next/link";
import { notFound } from "next/navigation";
import DataStamp, { SampleDataFlag } from "@/components/DataStamp";
import StockDetailBody from "@/components/StockDetailBody";
import { companies, company, loadScores, marketCapRanks, styleMeta } from "@/lib/scores";

// 배치가 scores.json을 교체하면 다음 요청이 새 값을 읽어야 한다. 정적 생성이면
// 빌드 시점 값이 굳으므로 이 화면은 요청마다 렌더한다.
export const dynamic = "force-dynamic";

export default async function StockDetail({
  params,
  searchParams,
}: {
  params: Promise<{ ticker: string }>;
  searchParams: Promise<{ style?: string }>;
}) {
  const { ticker } = await params;
  const { style } = await searchParams;
  const data = loadScores();
  const found = company(ticker, data);
  if (!found) notFound();

  const styleId = style && found.scores[style] ? style : "buffett";
  const ranks = marketCapRanks(data);

  /* 종목 상세의 대가 칸에서 다른 철학을 눌러도 진짜 재무 기준일·모델 버전이
     따라오도록, 이 종목이 가진 철학마다 스탬프를 미리 만들어 둔다
     (components/StockDetailBody.tsx의 stamps prop 참고). */
  const stamps = Object.fromEntries(
    Object.keys(found.scores).map((sid) => [
      sid,
      <DataStamp
        price={found.asOf.price}
        financial={found.asOf.financial}
        modelVersion={styleMeta(sid)?.modelVersion}
        confidence={found.scores[sid]?.dataConfidence}
      />,
    ])
  );

  return (
    <div className="wrap" style={{ paddingBlock: "3rem 5rem" }}>
      <Link href={`/screener/${styleId}`} className="mono" style={{ color: "var(--ink-faint)" }}>
        ← 목록으로
      </Link>

      <StockDetailBody
        company={found}
        marketCapRank={ranks[found.ticker]}
        marketCapUniverseSize={Object.keys(ranks).length}
        initialStyle={styleId}
        stamps={stamps}
        sampleFlag={<SampleDataFlag />}
      />
    </div>
  );
}
