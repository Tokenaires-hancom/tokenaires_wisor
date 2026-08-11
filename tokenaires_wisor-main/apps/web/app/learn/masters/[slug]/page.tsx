import Link from "next/link";
import { notFound } from "next/navigation";
import { CHAPTER_SLOTS, CURRICULUM_BY_MASTER } from "@/content/curriculum";
import { MASTERS, MASTER_BY_ID, type Master } from "@/content/masters";
import { ranked, styleMeta } from "@/lib/scores";

export function generateStaticParams() {
  return MASTERS.map((m) => ({ slug: m.id }));
}

export default async function MasterLesson({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const master = MASTER_BY_ID[slug as Master["id"]];
  if (!master) notFound();

  const meta = styleMeta(master.id);
  const { scored } = master.evaluation === "score" ? ranked(master.id) : { scored: [] };
  const curriculum = CURRICULUM_BY_MASTER[master.id];

  return (
    <div className="wrap wrap-narrow" style={{ paddingBlock: "3.5rem 5rem" }}>
      <img
        className="investor-avatar master-lesson-head"
        src={`/investors/${master.id}.png`}
        alt=""
        width={80}
        height={80}
      />
      <p className="style-kicker">
        <span className="style-name">{master.styleName}</span>
        <span>{master.minutes}분 학습 · {master.subtitle}</span>
      </p>
      <h1 className="thesis">
        {master.oneLine}
      </h1>
      <p className="lede">{master.intro}</p>

      <hr className="rule" />

      <h2 className="section">목차</h2>
      <p className="lede">
        한 장은 3~5분이면 읽고 문항까지 끝납니다. 순서대로 보거나 관심 있는 장부터 골라 볼 수
        있습니다.
      </p>

      <div className="toc">
        {curriculum.chapters.map((chapter, index) => {
          const slot = CHAPTER_SLOTS[index];
          return (
            <Link
              key={slot.no}
              href={`/learn/masters/${master.id}/${slot.no}`}
              className="toc-item"
            >
              <span className="toc-no">{String(slot.no).padStart(2, "0")}</span>
              <span>
                <span className="toc-title">{chapter.title}</span>
                <span className="toc-question">{slot.asks}</span>
              </span>
              <span className="toc-slot">{slot.label}</span>
            </Link>
          );
        })}
      </div>

      <p className="disclaimer">
        이 철학의 매도 조건 — {curriculum.sellType} · {curriculum.sellTrigger}
      </p>

      <hr className="rule" />

      <h2 className="section">이 철학이 던지는 질문</h2>
      <p className="lede">
        {meta
          ? `점수 모델 ${meta.modelVersion}은 아래 생각을 ${meta.criteria.length}개의 판정 기준으로 옮긴 것입니다.`
          : "이 철학은 공개 재무지표만으로 점수를 만들지 않습니다. 아래 질문을 직접 확인하는 자가진단으로 다룹니다."}
      </p>
      <div className="stack">
        {master.principles.map((p, i) => (
          <div key={i} className="card">
            <h3 className="sub">{p.title}</h3>
            <p style={{ margin: 0, color: "var(--ink-soft)", fontSize: "0.93rem" }}>{p.body}</p>
          </div>
        ))}
      </div>

      <h2 className="section" style={{ marginTop: "3rem" }}>
        선호하는 기업
      </h2>
      <ul className="reason-list">
        {master.likes.map((l, i) => (
          <li key={i} data-kind="pass">
            {l}
          </li>
        ))}
      </ul>

      <h2 className="section" style={{ marginTop: "2.5rem" }}>
        이 철학이 지는 상황
      </h2>
      <p className="lede">
        모든 기준에는 통하지 않는 자리가 있습니다. 어디서 틀리는지를 아는 것이 기준을 쓰는 일의
        절반입니다.
      </p>
      <ul className="reason-list">
        {master.failsWhen.map((f, i) => (
          <li key={i} data-kind="fail">
            {f}
          </li>
        ))}
      </ul>

      <hr className="rule" />

      {meta ? (
        <>
          <h2 className="section">이 기준으로 정리된 종목</h2>
          <p className="lede">
            {meta.modelVersion} 모델이 {scored.length}개 종목에 같은 기준을 적용했습니다. 모델 방식과
            데이터 범위를 함께 확인할 수 있습니다.
          </p>
          <Link href={`/screener/${master.id}`} className="btn">
            이 철학의 기준으로 종목 보기
          </Link>
        </>
      ) : (
        <section className="qualitative-check">
          <p className="eyebrow">자가진단 · 점수 없음</p>
          <h2 className="section">숫자 대신 직접 확인할 항목</h2>
          <p className="lede">
            이 항목들은 공시 숫자만으로 판정할 수 없습니다. 답을 알고 있는지보다 근거를 직접
            구할 수 있는지가 중요합니다.
          </p>
          <ul className="reason-list">
            {master.principles.map((principle) => (
              <li key={principle.title} data-kind="unknown">
                {principle.title}
              </li>
            ))}
          </ul>
          <Link href={`/learn/masters/${master.id}/1`} className="btn">
            첫 장에서 확인하기
          </Link>
        </section>
      )}
    </div>
  );
}
