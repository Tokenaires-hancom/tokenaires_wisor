import Link from "next/link";
import CriteriaBar from "@/components/CriteriaBar";
import DataStamp, { SampleDataFlag } from "@/components/DataStamp";
import { MASTERS } from "@/content/masters";
import { CURRICULUM_BY_MASTER } from "@/content/curriculum";
import { displayModelVersion } from "@/lib/format";
import { ranked, styleMeta } from "@/lib/scores";

/** 7명의 원형 아바타를 듀오링고 마스코트 무리처럼 겹쳐 배치한다.
 *  좌표는 고정값이다 — 서버 컴포넌트라 Math.random을 쓰면 하이드레이션이 어긋난다. */
const HERO_CLUSTER: { id: (typeof MASTERS)[number]["id"]; top: string; left: string; size: number; rotate: number }[] = [
  { id: "buffett", top: "4%", left: "36%", size: 108, rotate: -6 },
  { id: "graham", top: "0%", left: "2%", size: 62, rotate: 11 },
  { id: "lynch", top: "6%", left: "74%", size: 58, rotate: -13 },
  { id: "fisher", top: "48%", left: "0%", size: 68, rotate: 8 },
  { id: "greenblatt", top: "52%", left: "78%", size: 64, rotate: 14 },
  { id: "marks", top: "66%", left: "28%", size: 60, rotate: -9 },
  { id: "soros", top: "72%", left: "58%", size: 52, rotate: 7 },
];

export default function Home() {
  const { scored } = ranked("buffett");
  const sample = scored[0];
  const meta = styleMeta("buffett");

  return (
    <div className="wrap" style={{ paddingBlock: "4rem 5rem" }}>
      <section className="hero">
        <div className="hero-cluster" aria-hidden="true">
          {HERO_CLUSTER.map((a) => (
            <img
              key={a.id}
              src={`/investors/${a.id}.png`}
              alt=""
              style={{
                top: a.top,
                left: a.left,
                width: a.size,
                height: a.size,
                transform: `rotate(${a.rotate}deg)`,
              }}
            />
          ))}
        </div>

        <div>
          <p className="eyebrow">투자 학습 서비스</p>
          <h1 className="thesis">
            투자 대가들에게 배우고
            <br />
            <em>나만의 투자원칙</em>을 세워보세요
          </h1>
        </div>

        <div className="hero-ctas">
          <Link href="/learn" className="btn">
            배우러 가기
          </Link>
        </div>

        <SampleDataFlag />
      </section>

      <hr className="rule" />

      <section className="home-intro" aria-labelledby="home-intro-title">
        <p className="eyebrow">AI 시대의 투자원칙</p>
        <h2 id="home-intro-title" className="section">
          흔들리는 시장에서, 원칙은 판단을 붙드는 기준입니다
        </h2>
        <p className="home-intro-lede">
          가격과 분위기가 바뀔 때마다 확신도 쉽게 흔들립니다. 원칙은 무엇을 보고, 언제 생각을
          바꾸며, 결과에서 무엇을 배울지 미리 정해 두어 AI가 내놓는 수많은 답에 끌려가지 않게 합니다.
        </p>

        <div className="home-principle-visual" aria-label="여러 정보를 나의 투자원칙으로 판단하는 과정">
          <div className="home-information-stream">
            <span>뉴스 요약</span>
            <span>실적 해석</span>
            <span>시장 전망</span>
          </div>
          <div className="home-principle-card">
            <p>나의 투자원칙</p>
            <strong>무엇을 볼까?</strong>
            <strong>언제 다시 볼까?</strong>
            <strong>무엇이 틀렸나?</strong>
          </div>
        </div>

        <div className="home-intro-effect">
          <div>
            <p className="eyebrow">Wisor가 돕는 방식</p>
            <h3>답 대신 판단하는 과정을 연습합니다</h3>
          </div>
          <ol>
            <li>대가의 철학을 배우고</li>
            <li>기업에 적용하고</li>
            <li>내 판단을 기록합니다</li>
          </ol>
        </div>
      </section>

      <hr className="rule" />

      <p className="eyebrow">일곱 가지 투자 철학</p>
      <h2 className="section">어떤 기준으로 기업을 보시겠습니까?</h2>
      <p className="lede">
        각 투자 철학은 그 투자자가 공개한 원칙을 참고해 Wisor가 재구성한 것입니다. 일곱 철학 모두
        전제·탐색·검증·처분·실패의 다섯 장을 같은 순서로 지납니다. 시장에 대해 무엇을 가정하는가에서
        시작해, 이 철학이 어떻게 무너지는가로 끝납니다.
      </p>

      <div className="grid">
        {MASTERS.map((master) => (
          <Link key={master.id} href={`/learn/masters/${master.id}`} className="card card-link">
            <p className="style-kicker">
              <span className="style-name">{master.styleName}</span>
              <span>{master.subtitle}</span>
            </p>
            <h3 className="sub" style={{ fontSize: "1.1rem" }}>
              {master.name}
            </h3>
            <p style={{ color: "var(--ink-soft)", fontSize: "0.9rem", margin: "0 0 1rem" }}>
              {master.oneLine}
            </p>
            <p className="mono" style={{ color: "var(--ink-faint)", margin: 0 }}>
              {CURRICULUM_BY_MASTER[master.id].chapters.length}장
            </p>
          </Link>
        ))}
      </div>

      <hr className="rule" />

      <p className="eyebrow">어떻게 작동하나요</p>
      <h2 className="section">기업 관점으로 보고, 판단은 직접 기록합니다</h2>
      <div className="grid" style={{ marginTop: "1.5rem" }}>
        <div className="card">
          <p className="eyebrow">렌즈</p>
          <h3 className="sub">기업 관점</h3>
          <p style={{ fontSize: "0.9rem", color: "var(--ink-soft)", margin: 0 }}>
            어떤 기업을 관심 있게 볼 것인가. 현금흐름, 자본 효율성, 부채, 성장, 가격을 같은
            기준으로 훑습니다.
          </p>
        </div>
        <div className="card">
          <p className="eyebrow">그리고</p>
          <h3 className="sub">나의 학습노트</h3>
          <p style={{ fontSize: "0.9rem", color: "var(--ink-soft)", margin: 0 }}>
            기업 관점에서 확인한 것을 기록해 두고, 판단은 직접 내립니다.
          </p>
        </div>
      </div>

      {sample && meta && (
        <>
          <hr className="rule" />
          <p className="eyebrow">결과 화면 미리보기</p>
          <h2 className="section">점수보다 기준이 먼저 보입니다</h2>
          <p className="lede">
            칸 하나가 기준 하나이고, 칸의 너비는 그 기준의 비중입니다. 채워진 칸은 충족, 빗금은
            미충족, 점선은 판정할 데이터가 없다는 뜻입니다.
          </p>
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
              <div>
                <strong>{sample.name}</strong>
                <span className="stock-ticker">{sample.ticker}</span>
              </div>
              <div className="stock-score">
                <div className="score-value">{sample.scores.buffett.score}</div>
                <div className="score-of">
                  {displayModelVersion(meta.modelVersion)} · {sample.scores.buffett.passed}/
                  {sample.scores.buffett.total} 기준
                </div>
              </div>
            </div>
            <div style={{ marginTop: "1rem" }}>
              <CriteriaBar criteria={sample.scores.buffett.criteria} showLegend />
            </div>
            <ul className="reason-list" style={{ marginTop: "1.25rem" }}>
              {sample.scores.buffett.reasons.slice(0, 2).map((r, i) => (
                <li key={i} data-kind="pass">
                  {r}
                </li>
              ))}
              {sample.scores.buffett.risks.slice(0, 1).map((r, i) => (
                <li key={i} data-kind="fail">
                  {r}
                </li>
              ))}
            </ul>
            <DataStamp
              price={sample.asOf.price}
              financial={sample.asOf.financial}
              modelVersion={meta.modelVersion}
              confidence={sample.scores.buffett.dataConfidence}
            />
          </div>
        </>
      )}
    </div>
  );
}
