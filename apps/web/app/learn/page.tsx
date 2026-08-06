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
        어떤 기업을 관심 있게 볼 것인가. 순서대로 볼 것을 권합니다. 버핏에서 시작해 그레이엄으로
        뿌리를 보고, 린치에서 분산과 집중의 대조를 봅니다. 관심 있는 장만 골라 봐도 됩니다.
      </p>
      <div className="grid">
        {MASTERS.map((m) => (
          <Link key={m.id} href={`/learn/masters/${m.id}`} className="card card-link">
            <p className="eyebrow">{m.subtitle}</p>
            <h3 className="sub" style={{ fontSize: "1.05rem" }}>
              {m.name}
            </h3>
            <p style={{ fontSize: "0.9rem", color: "var(--ink-soft)", margin: 0 }}>{m.oneLine}</p>
            <p className="mono" style={{ color: "var(--ink-faint)", margin: 0 }}>
              {CURRICULUM_BY_MASTER[m.id].chapters.length}장
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
