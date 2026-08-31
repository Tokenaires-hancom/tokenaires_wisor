import Link from "next/link";
import { notFound } from "next/navigation";
import DataStamp, { SampleDataFlag } from "@/components/DataStamp";
import CriteriaLegend from "@/components/CriteriaLegend";
import ScreenerSplit from "@/components/ScreenerSplit";
import { MASTER_BY_ID } from "@/content/masters";
import { loadScores, marketCapRanks, ranked, styleMeta } from "@/lib/scores";

// 배치가 scores.json을 교체하면 다음 요청이 새 값을 읽어야 한다. 정적 생성이면
// 빌드 시점 값이 굳으므로 이 화면은 요청마다 렌더한다.
export const dynamic = "force-dynamic";

export default async function Screener({ params }: { params: Promise<{ style: string }> }) {
  const { style } = await params;
  const data = loadScores();
  const master = MASTER_BY_ID[style as keyof typeof MASTER_BY_ID];
  const meta = styleMeta(style, data);
  if (!master || !meta) notFound();

  const { scored, unscored, unscorable } = ranked(style, data);

  /* DataStamp는 lib/scores(서버 전용)를 읽어서 오른쪽 칸(클라이언트 컴포넌트)이
     직접 못 부른다. 세 묶음(채점·정보 부족·판정 제외) 전부 왼쪽 목록에서 고를 수
     있으므로(ScreenerSplit의 목록 머리 전환) 셋 다 여기서 미리 렌더링해 넘긴다 —
     이 목록은 어차피 페이지네이션과 함께 전부 클라이언트로 내려가는 값이라
     (components/ScreenerCompanies.tsx) stamp를 다 만들어 둬도 새로 유출되는
     데이터가 없다.

     종목 상세에서 대가 얼굴을 눌러 다른 철학으로 바꿔 볼 수 있으므로(StockDetailBody의
     대가 칸), 지금 철학 하나가 아니라 종목마다 가진 철학 전부의 스탬프를 미리
     만들어 둔다 — 그래야 대가를 바꿔도 그 철학의 진짜 재무 기준일·모델 버전이
     따라온다. */
  const marketCapRankMap = marketCapRanks(data);
  const marketCapUniverseSize = Object.keys(marketCapRankMap).length;
  const styleMetaById = Object.fromEntries(data.styles.map((m) => [m.id, styleMeta(m.id, data)]));
  const stamps = Object.fromEntries(
    [...scored, ...unscored, ...unscorable].map((c) => [
      c.ticker,
      Object.fromEntries(
        Object.keys(c.scores).map((sid) => [
          sid,
          <DataStamp
            price={c.asOf.price}
            financial={c.asOf.financial}
            modelVersion={styleMetaById[sid]?.modelVersion}
            confidence={c.scores[sid]?.dataConfidence}
          />,
        ])
      ),
    ])
  );

  return (
    <div className="screener-page wrap wrap-wide">
      <nav className="screener-style-tabs" aria-label="투자 철학 선택">
        {data.styles
          .map((model) => {
            const modelMaster = MASTER_BY_ID[model.id as keyof typeof MASTER_BY_ID];
            const isActive = model.id === style;

            return (
              <Link
                key={model.id}
                href={`/screener/${model.id}`}
                className="screener-style-tab"
                aria-current={isActive ? "page" : undefined}
              >
                {/* 이름이 바로 옆에 글자로 있으므로 alt는 비운다 */}
                <img
                  className="investor-avatar"
                  src={`/investors/${model.id}.png`}
                  alt=""
                  width={36}
                  height={36}
                />
                <span className="screener-tab-text">
                  <span className="screener-tab-name">
                    {modelMaster?.name.split(" · ")[0] ?? model.name}
                  </span>
                  <span className="style-name">
                    {modelMaster?.styleName ?? model.modelVersion}
                  </span>
                </span>
              </Link>
            );
          })}
      </nav>

      {/* 제목·한 줄 설명은 지웠다. 탭이 이미 고른 철학 이름·배지를 보여주고,
          같은 내용(오래 살아남을 사업을…)은 아무 종목도 안 고른 오른쪽 칸
          (CriteriaLegend)에도 없다 — 스크롤 없는 화면에서 반복해서 쓸 자리가
          없다.

          예시 데이터 배지는 왼쪽 목록 머리로 들어간다(ScreenerSplit). 여기와
          오른쪽 칸 둘 다에 두면 종목을 고른 순간 같은 배지가 두 번 뜬다 — 이
          배지는 실데이터가 예시로 덮였다는 사고 신호라, 개수가 흔들리면 안 된다. */}
      <ScreenerSplit
        scored={scored}
        unscored={unscored}
        unscorable={unscorable}
        style={style}
        stamps={stamps}
        sampleFlag={<SampleDataFlag />}
        marketCapRanks={marketCapRankMap}
        marketCapUniverseSize={marketCapUniverseSize}
        emptyState={
          <CriteriaLegend
            style={style}
            meta={meta}
            master={master}
            unscorableCount={unscorable.length}
            unscorableReason={
              unscorable[0]?.scores[style]?.unscorableReason ?? unscorable[0]?.unscorableReason
            }
          />
        }
      />

      {/* 정보 부족·판정하지 않은 업종을 화면 아래에 따로 나열하던 블록 둘은
          지웠다 — ScreenerSplit의 목록 머리 전환([정보 부족]·[판정 제외])이
          같은 종목을 왼쪽에서 고를 수 있게 대체한다. 목록을 떠나지 않고도
          이 종목들의 기준 판정·지표를 오른쪽 칸에서 바로 볼 수 있다.

          철학 배우기·점수 설명 링크와 데이터 생성 고지도 지웠다 — 페이지
          전체를 스크롤 없는 고정 칸(641px 이상)으로 만들면서 왼쪽 목록이
          페이지네이션까지 스크롤 없이 다 들어가야 해서, 그 공간을 여기 대신
          쓴다. 같은 링크는 /learn 안에, 고지는 오른쪽 칸(StockLenses)에도
          남아 있다. */}
    </div>
  );
}
