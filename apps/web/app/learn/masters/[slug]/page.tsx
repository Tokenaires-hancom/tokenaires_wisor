import Link from "next/link";
import { notFound } from "next/navigation";
import MasterPath from "@/components/MasterPath";
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

        <div className="master-main">
          <div className="unit-banner">
            <Link href="/learn" className="unit-banner-back" aria-label="배우기 목록으로">
              <span aria-hidden="true">←</span>
            </Link>
            <div className="unit-banner-text">
              <p className="unit-banner-style">{master.styleName}</p>
              <h1 className="unit-banner-name">{master.name}</h1>
            </div>
            <a href="#principles" className="unit-banner-guide">
              원칙 보기
            </a>
          </div>

          <p className="lede" style={{ textAlign: "center", margin: "1.25rem auto 2rem" }}>
            {master.oneLine}
          </p>

          <MasterPath masterId={master.id} scorable={!!meta} />

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
