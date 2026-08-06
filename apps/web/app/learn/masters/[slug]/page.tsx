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
  const { scored } = ranked(master.id);
  const curriculum = CURRICULUM_BY_MASTER[master.id];

  return (
    <div className="wrap wrap-narrow" style={{ paddingBlock: "3.5rem 5rem" }}>
      <p className="eyebrow">{master.minutes}분 학습 · {master.subtitle}</p>
      <h1 className="thesis" style={{ maxWidth: "24ch" }}>
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
        이 스타일의 매도 조건 — {curriculum.sellType} · {curriculum.sellTrigger}
      </p>

      <hr className="rule" />

      <h2 className="section">이 스타일이 던지는 질문</h2>
      <p className="lede">
        {meta ? `점수 모델 ${meta.modelVersion}은 아래 생각을 ${meta.criteria.length}개의 판정 기준으로 옮긴 것입니다.` : ""}
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
        이 스타일이 지는 상황
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

      <h2 className="section">이 기준으로 정리된 종목</h2>
      <p className="lede">
        {meta?.modelVersion} 모델이 {scored.length}개 종목에 같은 기준을 적용했습니다. 순위가 아니라
        기준을 몇 개 충족했는지를 봅니다.
      </p>
      <Link href={`/screener/${master.id}`} className="btn">
        {master.name.split(" · ")[0]} 스타일 종목 보기
      </Link>
    </div>
  );
}
