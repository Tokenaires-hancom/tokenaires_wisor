import Link from "next/link";
import { MASTERS } from "@/content/masters";
import { CURRICULUM_BY_MASTER } from "@/content/curriculum";

export default function LearnIndex() {
  return (
    <div className="wrap" style={{ paddingBlock: "3.5rem 5rem" }}>
      <p className="eyebrow">배우기</p>
      <h1 className="thesis">일곱 투자 철학, 같은 다섯 질문</h1>

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
              {CURRICULUM_BY_MASTER[m.id].chapters.length}장
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
