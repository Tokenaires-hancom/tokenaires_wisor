import { loadScores } from "@/lib/scores";

export const dynamic = "force-dynamic";

export function GET() {
  const data = loadScores();
  return Response.json(
    {
      generatedAt: data.generatedAt,
      dataSource: data.dataSource,
      companies: data.companies.length,
      sampleTicker: data.companies[0]?.ticker ?? null,
      priceAt: data.asOf.priceAt ?? null,
      priceCoverage: data.asOf.priceCoverage ?? null,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
