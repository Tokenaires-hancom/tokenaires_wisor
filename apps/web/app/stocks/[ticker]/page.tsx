import Link from "next/link";
import { notFound } from "next/navigation";
import DataStamp, { SampleDataFlag } from "@/components/DataStamp";
import StockDetailBody from "@/components/StockDetailBody";
import { companies, company, marketCapRanks, styleMeta } from "@/lib/scores";

export function generateStaticParams() {
  return companies().map((c) => ({ ticker: c.ticker }));
}

export default async function StockDetail({
  params,
  searchParams,
}: {
  params: Promise<{ ticker: string }>;
  searchParams: Promise<{ style?: string }>;
}) {
  const { ticker } = await params;
  const { style } = await searchParams;
  const found = company(ticker);
  if (!found) notFound();

  const styleId = style && found.scores[style] ? style : "buffett";
  const ranks = marketCapRanks();

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
