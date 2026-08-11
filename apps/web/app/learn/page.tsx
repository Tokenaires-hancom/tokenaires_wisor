import Link from "next/link";
import { MASTERS } from "@/content/masters";
import StockBasicsLauncher from "@/components/StockBasicsLauncher";

export default function LearnIndex() {
  return (
    <div className="wrap" style={{ paddingBlock: "3.5rem 5rem" }}>
      <p className="eyebrow">배우기</p>
      <h1 className="thesis">대가들의 투자 철학을 배워보세요</h1>

      <StockBasicsLauncher />

      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1.5rem" }}>
        <Link href="/learn/compare" className="btn" data-variant="quiet">
          다섯 질문으로 일곱 투자 철학 비교하기
        </Link>
      </div>
      <div className="grid">
        {MASTERS.map((m) => (
          <Link key={m.id} href={`/learn/masters/${m.id}`} className="card card-link">
            <p className="style-kicker">
              <span className="style-name">{m.styleName}</span>
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
          </Link>
        ))}
      </div>
    </div>
  );
}
