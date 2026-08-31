import MyLearning, { type WatchCompanyInfo } from "@/components/MyLearning";
import { companies, loadScores } from "@/lib/scores";

export const dynamic = "force-dynamic";

/** 서버 컴포넌트. 재무데이터 전체가 아니라 관심종목 카드에 필요한 요약만 내려보낸다. */
export default function MyLearningPage() {
  const allCompanies = companies(loadScores());
  const marketCapUniverse = [...allCompanies]
    .filter((company) => Number.isFinite(company.marketCap))
    .sort((a, b) => b.marketCap - a.marketCap);
  const marketCapRanks = new Map(
    marketCapUniverse.map((company, index) => [company.ticker, index + 1]),
  );
  const companyInfo = Object.fromEntries(
    allCompanies.map((company) => [
      company.ticker,
      {
        name: company.name,
        sector: company.sector,
        price: company.price,
        marketCap: company.marketCap,
        marketCapRank: marketCapRanks.get(company.ticker),
        universeSize: marketCapUniverse.length,
        priceAsOf: company.asOf.price,
      } satisfies WatchCompanyInfo,
    ]),
  );

  return <MyLearning companies={companyInfo} />;
}
