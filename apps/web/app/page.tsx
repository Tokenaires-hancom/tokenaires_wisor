import Link from "next/link";
import CriteriaBar from "@/components/CriteriaBar";
import DataStamp, { SampleDataFlag } from "@/components/DataStamp";
import { MASTERS } from "@/content/masters";
import { CURRICULUM_BY_MASTER } from "@/content/curriculum";
import { ranked, styleMeta } from "@/lib/scores";

export default function Home() {
  const { scored } = ranked("buffett");
  const sample = scored[0];
  const meta = styleMeta("buffett");

  return (
    <div className="wrap" style={{ paddingBlock: "4rem 5rem" }}>
      <p className="eyebrow">투자 학습 서비스</p>
      <h1 className="thesis">
        어떤 시장에서도 흔들리지 않는 <em>질문하는 법</em>을 배웁니다.
      </h1>
      <p className="lede">
        버핏부터 소로스까지 일곱 투자 대가가 기업과 시장을 볼 때 던진 질문을 배웁니다. 그리고
        차트에서 무엇이 보이고 무엇이 보이지 않는지 읽는 법을 함께 익힙니다.
        <br />
        <strong>질문하는 법을 배우고, 스스로 판단하는 법을 익히는 서비스</strong>입니다.
      </p>

      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "3rem" }}>
        <Link href="/learn" className="btn">
          투자 대가에게 배우기
        </Link>
        <Link href="/screener/buffett" className="btn" data-variant="quiet">
          예시 결과 보기
        </Link>
        <Link href="/learn/compare" className="btn" data-variant="quiet">
          일곱 투자 철학 비교하기
        </Link>
      </div>

      <SampleDataFlag />

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
              {CURRICULUM_BY_MASTER[master.id].chapters.length}장 ·{" "}
              {master.evaluation === "score" ? "점수 모델" : "자가진단"}
            </p>
          </Link>
        ))}
      </div>

      <hr className="rule" />

      <p className="eyebrow">어떻게 작동하나요</p>
      <h2 className="section">한 종목을 두 개의 렌즈로 봅니다</h2>
      <div className="grid" style={{ marginTop: "1.5rem" }}>
        <div className="card">
          <p className="eyebrow">렌즈 1</p>
          <h3 className="sub">기업 관점</h3>
          <p style={{ fontSize: "0.9rem", color: "var(--ink-soft)", margin: 0 }}>
            어떤 기업을 관심 있게 볼 것인가. 현금흐름, 자본 효율성, 부채, 성장, 가격을 같은
            기준으로 훑습니다.
          </p>
        </div>
        <div className="card">
          <p className="eyebrow">렌즈 2</p>
          <h3 className="sub">차트 관점</h3>
          <p style={{ fontSize: "0.9rem", color: "var(--ink-soft)", margin: 0 }}>
            지금 가격이 어떤 움직임을 보이고 있는가. 차트에서 보이는 것과 보이지 않는 것을
            구분해 설명합니다.
          </p>
        </div>
        <div className="card">
          <p className="eyebrow">그리고</p>
          <h3 className="sub">나의 학습노트</h3>
          <p style={{ fontSize: "0.9rem", color: "var(--ink-soft)", margin: 0 }}>
            두 관점에서 확인한 것을 한자리에 모으고, 판단은 직접 기록합니다. 두 점수를 합쳐
            매수 점수를 만들지 않습니다.
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
                  {meta.modelVersion} · {sample.scores.buffett.passed}/{sample.scores.buffett.total} 기준
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
