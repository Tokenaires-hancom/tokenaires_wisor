import Link from "next/link";
import { notFound } from "next/navigation";
import DataStamp, { SampleDataFlag } from "@/components/DataStamp";
import StockLenses from "@/components/StockLenses";
import { companies, company, styleMeta } from "@/lib/scores";
import { money } from "@/lib/format";

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
  const meta = styleMeta(styleId);

  return (
    <div className="wrap" style={{ paddingBlock: "3rem 5rem" }}>
      <Link href={`/screener/${styleId}`} className="mono" style={{ color: "var(--ink-faint)" }}>
        ← 목록으로
      </Link>

      <div style={{ marginTop: "1rem", marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "2.2rem", fontWeight: 400, margin: "0 0 0.35rem" }}>
          {found.name}
        </h1>
        <p className="mono" style={{ color: "var(--ink-faint)", margin: 0 }}>
          {found.ticker} · {found.sector} · 종가 {found.price.toFixed(2)} 달러 · 시가총액{" "}
          {money(found.marketCap)}
        </p>
        <DataStamp
          price={found.asOf.price}
          financial={found.asOf.financial}
          modelVersion={meta?.modelVersion}
          confidence={found.scores[styleId]?.dataConfidence}
        />
      </div>

      <SampleDataFlag />

      <div style={{ marginTop: "1.5rem" }}>
        <StockLenses company={found} initialStyle={styleId} />
      </div>
    </div>
  );
}
