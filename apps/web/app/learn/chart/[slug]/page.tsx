import Link from "next/link";
import { notFound } from "next/navigation";
import ChartAnalyzer from "@/components/ChartAnalyzer";
import Quiz from "@/components/Quiz";
import { CHART_LESSONS, LESSON_BY_ID } from "@/content/chartLessons";

export function generateStaticParams() {
  return CHART_LESSONS.map((l) => ({ slug: l.id }));
}

export default async function ChartLessonPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const lesson = LESSON_BY_ID[slug];
  if (!lesson) notFound();

  const next = CHART_LESSONS.find((l) => l.order === lesson.order + 1);

  return (
    <div className="wrap wrap-narrow" style={{ paddingBlock: "3.5rem 5rem" }}>
      <p className="eyebrow">차트 기초 {lesson.order}단원 / {CHART_LESSONS.length}</p>
      <h1 className="thesis" style={{ maxWidth: "26ch", fontSize: "clamp(1.6rem, 3.6vw, 2.4rem)" }}>
        {lesson.title}
      </h1>
      <p className="lede">{lesson.oneLine}</p>

      <hr className="rule" />

      <h2 className="section">핵심 개념 세 가지</h2>
      <div className="stack" style={{ marginTop: "1.25rem" }}>
        {lesson.concepts.map((c, i) => (
          <div key={i} className="card">
            <h3 className="sub">{c.term}</h3>
            <p style={{ margin: 0, color: "var(--ink-soft)", fontSize: "0.93rem" }}>{c.body}</p>
          </div>
        ))}
      </div>

      <h2 className="section" style={{ marginTop: "3rem" }}>
        잘못 이해하기 쉬운 점
      </h2>
      <div className="card" style={{ borderColor: "var(--ochre-line)", background: "var(--ochre-soft)" }}>
        <p className="eyebrow" style={{ color: "var(--ochre)" }}>흔한 오해</p>
        <p style={{ fontFamily: "var(--serif)", fontSize: "1.1rem", margin: "0 0 1rem" }}>
          “{lesson.misconception.claim}”
        </p>
        <p style={{ margin: 0, fontSize: "0.93rem" }}>{lesson.misconception.correction}</p>
      </div>

      <hr className="rule" />

      <p className="eyebrow">확인해보기</p>
      <h2 className="section" style={{ marginBottom: "1.5rem" }}>
        세 문항
      </h2>
      <Quiz id={`chart:${lesson.id}`} items={lesson.quiz} completedEvent="chart_lesson_completed" />

      <hr className="rule" />

      <p className="eyebrow">이미지로 연습하기 · 베타</p>
      <h2 className="section">직접 올린 차트로 확인해보세요</h2>
      <p className="lede">{lesson.practicePrompt}</p>
      <ChartAnalyzer lessonId={lesson.id} />

      {next && (
        <>
          <hr className="rule" />
          <Link href={`/learn/chart/${next.id}`} className="card card-link">
            <p className="eyebrow">다음 단원</p>
            <strong>
              {next.order}. {next.title}
            </strong>
          </Link>
        </>
      )}
    </div>
  );
}
