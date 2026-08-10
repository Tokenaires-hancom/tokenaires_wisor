import Link from "next/link";
import { notFound } from "next/navigation";
import MasterPath from "@/components/MasterPath";
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
    <div className="wrap wrap-narrow" style={{ paddingBlock: "3rem 5rem" }}>
      <div style={{ display: "flex", gap: "0.85rem", alignItems: "center", marginBottom: "1.5rem" }}>
        <img
          className="investor-avatar"
          src={`/investors/${master.id}.png`}
          alt=""
          width={56}
          height={56}
        />
        <div>
          <p className="style-kicker" style={{ margin: 0 }}>
            <span className="style-name">{master.styleName}</span>
            <span>
              {master.minutes}분 학습 · {master.subtitle}
            </span>
          </p>
          <h1 className="thesis" style={{ fontSize: "1.4rem", margin: "0.2rem 0 0" }}>
            {master.oneLine}
          </h1>
        </div>
      </div>

      <div className="master-overview">
        <div>
          <MasterPath masterId={master.id} />

          <div style={{ marginTop: "1.25rem" }}>
            {meta ? (
              <Link href={`/screener/${master.id}`} className="btn">
                이 기준으로 종목 보기
              </Link>
            ) : (
              <Link href={`/learn/masters/${master.id}/1`} className="btn" data-variant="quiet">
                첫 장에서 시작하기
              </Link>
            )}
          </div>
        </div>

        <div className="master-tips">
          <details>
            <summary>이 철학의 원칙 {master.principles.length}가지</summary>
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
            <summary>이 철학이 지는 상황</summary>
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

          <p className="disclaimer" style={{ margin: 0 }}>
            매도 조건 — {curriculum.sellType} · {curriculum.sellTrigger}
          </p>
        </div>
      </div>
    </div>
  );
}
