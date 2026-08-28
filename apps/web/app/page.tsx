import "./home-v5.css";
import DataStamp, { SampleDataFlag } from "@/components/DataStamp";
import HomeHero from "@/components/home/HomeHero";
import HomePrinciples from "@/components/home/HomePrinciples";
import HomeMasters from "@/components/home/HomeMasters";
import HomeJourney from "@/components/home/HomeJourney";
import HomeResult from "@/components/home/HomeResult";
import ScrollTop from "@/components/ScrollTop";
import { MASTERS } from "@/content/masters";
import { displayModelVersion } from "@/lib/format";
import { loadScores, ranked, styleMeta } from "@/lib/scores";

export const dynamic = "force-dynamic";

export default function Home() {
  const data = loadScores();
  const { scored } = ranked("buffett", data);
  const sample = scored[0];
  const meta = styleMeta("buffett", data);

  return (
    <div className="hv-home">
      <SampleDataFlag data={data} />
      <ScrollTop />
      <HomeHero />
      <HomePrinciples />
      <HomeMasters
        masters={MASTERS.map((m) => ({
          id: m.id,
          name: m.name,
          styleName: m.styleName,
          oneLine: m.oneLine,
        }))}
      />
      <HomeJourney />
      {sample && meta && (
        <HomeResult
          sample={{
            name: sample.name,
            ticker: sample.ticker,
            score: sample.scores.buffett.score,
            passed: sample.scores.buffett.passed,
            total: sample.scores.buffett.total,
            modelLabel: displayModelVersion(meta.modelVersion),
            criteria: sample.scores.buffett.criteria,
            reasons: sample.scores.buffett.reasons.slice(0, 2),
            risks: sample.scores.buffett.risks.slice(0, 1),
          }}
          stamp={
            <DataStamp
              data={data}
              price={sample.asOf.price}
              priceAt={sample.asOf.priceAt ?? null}
              financial={sample.asOf.financial}
              modelVersion={meta.modelVersion}
              confidence={sample.scores.buffett.dataConfidence}
            />
          }
        />
      )}
    </div>
  );
}
