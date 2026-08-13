import Link from "next/link";
import { notFound } from "next/navigation";
import DataStamp, { SampleDataFlag } from "@/components/DataStamp";
import StockLenses from "@/components/StockLenses";
import { FinancialTerm } from "@/components/FinancialTerm";
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
  const marketCapUniverse = [...companies()]
    .filter((c) => Number.isFinite(c.marketCap))
    .sort((a, b) => b.marketCap - a.marketCap);
  const marketCapRank = marketCapUniverse.findIndex((c) => c.ticker === found.ticker) + 1;

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
          {found.ticker} · {found.sector}
        </p>
        <div className="stock-market-strip" aria-label="종목 시장 정보">
          <div>
            <span>종가</span>
            <strong>{found.price.toFixed(2)} 달러</strong>
          </div>
          <div>
            <span><FinancialTerm term="marketCap">시가총액</FinancialTerm></span>
            <strong>{money(found.marketCap)}</strong>
          </div>
          <div>
            <span><FinancialTerm term="marketCap">시가총액</FinancialTerm> 순위</span>
            <strong>
              {marketCapRank > 0 ? `${marketCapRank}위` : "정보 없음"}
              {marketCapRank > 0 && <small> / {marketCapUniverse.length}종목</small>}
            </strong>
          </div>
        </div>
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
