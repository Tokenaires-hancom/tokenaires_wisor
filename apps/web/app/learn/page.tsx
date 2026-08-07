import Link from "next/link";
import { CHART_LESSONS } from "@/content/chartLessons";
import { MASTERS } from "@/content/masters";
import { CURRICULUM_BY_MASTER } from "@/content/curriculum";

export default function LearnIndex() {
  return (
    <div className="wrap" style={{ paddingBlock: "3.5rem 5rem" }}>
      <p className="eyebrow">배우기</p>
      <h1 className="thesis">두 가지를 나눠서 배웁니다.</h1>
      <p className="lede">
        어떤 기업을 볼지 고르는 법과, 가격이 어떻게 움직였는지 읽는 법은 서로 다른 기술입니다.
        Wisor는 둘을 섞지 않고 따로 가르친 뒤 마지막에 학습노트에서 만나게 합니다.
      </p>

      <h2 className="section" style={{ marginTop: "3rem" }}>
        투자 대가에게 배우기
      </h2>
      <p className="lede">
        버핏에서 시작해 그레이엄과 린치를 본 뒤 막스에서 시장 단위로 시야를 넓힐 수 있습니다.
        피셔·그린블랫·소로스는 관심과 실행 방식에 따라 골라 보세요. 일곱 투자 철학은 모두 같은 다섯
        질문을 공유합니다.
      </p>
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1.5rem" }}>
        <Link href="/learn/compare" className="btn" data-variant="quiet">
          다섯 질문으로 일곱 투자 철학 비교하기
        </Link>
        <Link href="/learn/scoring" className="btn" data-variant="quiet">
          종목을 고르고 점수를 만드는 법
        </Link>
      </div>
      <div className="grid">
        {MASTERS.map((m) => (
          <Link key={m.id} href={`/learn/masters/${m.id}`} className="card card-link">
            <p className="style-kicker">
              <span className="style-name">{m.styleName}</span>
              <span>{m.subtitle}</span>
            </p>
            <div className="master-card-head">
              <img
                className="investor-avatar"
                src={`/investors/${m.id}.png`}
                alt=""
                width={52}
                height={52}
              />
              <h3 className="sub" style={{ fontSize: "1.05rem" }}>
                {m.name}
              </h3>
            </div>
            <p style={{ fontSize: "0.9rem", color: "var(--ink-soft)", margin: 0 }}>{m.oneLine}</p>
            <p className="mono" style={{ color: "var(--ink-faint)", margin: 0 }}>
              {CURRICULUM_BY_MASTER[m.id].chapters.length}장 ·{" "}
              {m.evaluation === "score" ? "점수 모델" : "자가진단"}
            </p>
          </Link>
        ))}
      </div>

      <hr className="rule" />

      <h2 className="section">차트 기초 배우기</h2>
      <p className="lede">현재 가격이 어떤 움직임을 보이고 있는가. 다섯 단원을 순서대로 봅니다.</p>
      <div className="grid">
        {CHART_LESSONS.map((lesson) => (
          <Link key={lesson.id} href={`/learn/chart/${lesson.id}`} className="card card-link">
            <p className="eyebrow">{lesson.order}단원</p>
            <h3 className="sub" style={{ fontSize: "1.05rem" }}>
              {lesson.title}
            </h3>
            <p style={{ fontSize: "0.88rem", color: "var(--ink-soft)", margin: 0 }}>
              {lesson.oneLine}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
