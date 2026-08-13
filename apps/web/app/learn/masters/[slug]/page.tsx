import Link from "next/link";
import { notFound } from "next/navigation";
import MasterPath from "@/components/MasterPath";
import MobileMasterDock from "@/components/MobileMasterDock";
import { CURRICULUM_BY_MASTER } from "@/content/curriculum";
import { MASTERS, MASTER_BY_ID, type Master } from "@/content/masters";
import { styleMeta } from "@/lib/scores";

export function generateStaticParams() {
  return MASTERS.map((m) => ({ slug: m.id }));
}

export default async function MasterLesson({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const master = MASTER_BY_ID[slug as Master["id"]];
  if (!master) notFound();

  const meta = styleMeta(master.id);
  const curriculum = CURRICULUM_BY_MASTER[master.id];

  return (
    <div className="wrap master-page">
      <div className="master-shell">
        <nav className="master-rail" aria-label="다른 대가로 이동">
          {MASTERS.map((m) => (
            <Link
              key={m.id}
              href={`/learn/masters/${m.id}`}
              className="master-rail-item"
              data-current={m.id === master.id ? "true" : undefined}
              aria-current={m.id === master.id ? "page" : undefined}
            >
              <img src={`/investors/${m.id}.png`} alt={m.name} width={64} height={64} />
              <span className="master-rail-name" aria-hidden="true">
                {m.name}
              </span>
            </Link>
          ))}
        </nav>

        <MobileMasterDock currentId={master.id} />

        <div className="master-main">
          <div className="unit-banner">
            <Link href="/learn" className="unit-banner-back" aria-label="배우기 목록으로">
              <span aria-hidden="true">←</span>
            </Link>
            <div className="unit-banner-text">
              <p className="unit-banner-style">{master.styleName}</p>
              <h1 className="unit-banner-name">{master.name}</h1>
            </div>
            <a href="#achievements" className="unit-banner-guide">
              업적 보기
            </a>
          </div>

          <p className="lede" style={{ textAlign: "center", margin: "1.25rem auto 2rem" }}>
            {master.oneLine}
          </p>

          <MasterPath
            masterId={master.id}
            scorable={!!meta}
            chapterTitles={curriculum.chapters.map((chapter) => chapter.title)}
          />

          <section className="master-achievements" id="achievements" aria-labelledby="achievements-title">
            <div className="master-achievements-head">
              <div>
                <p className="eyebrow">투자사에 남긴 것</p>
                <h2 id="achievements-title">{master.name}의 업적</h2>
              </div>
              <p>
                수익률 숫자보다 오래 남은 질문과 도구를 중심으로 봅니다. 무엇을 해냈는지와 오늘의
                투자자가 무엇을 이어받았는지를 함께 정리했습니다.
              </p>
            </div>

            <ol className="achievement-records">
              {master.achievements.map((achievement) => (
                <li key={`${achievement.label}-${achievement.title}`}>
                  <span className="achievement-label">{achievement.label}</span>
                  <h3>{achievement.title}</h3>
                  <p>{achievement.body}</p>
                  <small>근거 · {achievement.source}</small>
                </li>
              ))}
            </ol>
          </section>

          <hr className="rule" />

          <div className="master-tips">
            <details id="principles">
              <summary>
                {master.name} 철학 원칙 {master.principles.length}가지
              </summary>
              <ul style={{ margin: "0.65rem 0 0", paddingLeft: "1.1rem", fontSize: "0.88rem" }}>
                {master.principles.map((p) => (
                  <li key={p.title} style={{ color: "var(--ink-soft)", padding: "0.15rem 0" }}>
                    <strong style={{ color: "var(--ink)" }}>{p.title}</strong> — {p.body}
                  </li>
                ))}
              </ul>
            </details>

            <details>
              <summary>선호하는 기업</summary>
              <ul className="reason-list">
                {master.likes.map((l, i) => (
                  <li key={i} data-kind="pass">
                    {l}
                  </li>
                ))}
              </ul>
            </details>

            <details>
              {/* 개수를 세지 않는다. primarySources에는 자료 외에 앞 항목의 세부·배경 사실·
                  주의문이 섞여 있어서, 배열 길이가 자료 종수와 일치하지 않는다 */}
              <summary>이 철학이 근거로 삼은 자료</summary>
              <ul style={{ margin: "0.65rem 0 0", paddingLeft: "1.1rem", fontSize: "0.85rem" }}>
                {curriculum.primarySources.map((source) => (
                  <li key={source} style={{ color: "var(--ink-soft)", padding: "0.15rem 0" }}>
                    {source}
                  </li>
                ))}
              </ul>
              <p style={{ fontSize: "0.82rem", color: "var(--ink-soft)", marginBottom: 0 }}>
                각 장의 본문 아래에 문단별 출처가 접혀 있습니다.{" "}
                <Link href="/learn/sources">전체 참고문헌</Link>
              </p>
            </details>

            <details>
              <summary>실패하는 경우</summary>
              <ul className="reason-list">
                {master.failsWhen.map((f, i) => (
                  <li key={i} data-kind="fail">
                    {f}
                  </li>
                ))}
              </ul>
            </details>

            {!meta && (
              <details>
                <summary>자가진단 · 점수 없음</summary>
                <p style={{ fontSize: "0.85rem", color: "var(--ink-soft)", marginTop: 0 }}>
                  이 항목들은 공시 숫자만으로 판정할 수 없습니다. 답을 알고 있는지보다 근거를 직접
                  구할 수 있는지가 중요합니다.
                </p>
                <ul className="reason-list">
                  {master.principles.map((p) => (
                    <li key={p.title} data-kind="unknown">
                      {p.title}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
