import Link from "next/link";
import ChartAnalyzer from "@/components/ChartAnalyzer";
import { CHART_LESSONS } from "@/content/chartLessons";

export default function Practice() {
  return (
    <div className="wrap wrap-narrow" style={{ paddingBlock: "3.5rem 5rem" }}>
      <p className="eyebrow">차트 실습 · 베타</p>
      <h1 className="thesis" style={{ maxWidth: "24ch" }}>
        보이는 것과 보이지 않는 것을 나눠 읽습니다.
      </h1>
      <p className="lede">
        차트 이미지를 올리면 무엇이 보이는지 설명하고, 이 이미지로는 알 수 없는 것이 무엇인지도
        함께 알려줍니다. 앞으로의 가격, 매수·매도 판단, 목표가는 다루지 않습니다.
      </p>

      <ChartAnalyzer />

      <hr className="rule" />

      <h2 className="section">먼저 개념부터 보고 싶다면</h2>
      <div className="grid">
        {CHART_LESSONS.map((lesson) => (
          <Link key={lesson.id} href={`/learn/chart/${lesson.id}`} className="card card-link">
            <p className="eyebrow">{lesson.order}단원</p>
            <strong>{lesson.title}</strong>
          </Link>
        ))}
      </div>
    </div>
  );
}
