import Link from "next/link";
import MasterCharacter from "@/components/MasterCharacter";
import StockBasicsLauncher from "@/components/StockBasicsLauncher";
import { hasCharacter } from "@/content/characters";
import { MASTERS } from "@/content/masters";

export default function LearnIndex() {
  return (
    <div className="wrap" style={{ paddingBlock: "3.5rem 5rem" }}>
      <p className="eyebrow">배우기</p>
      <h1 className="thesis">누구의 눈으로 기업을 볼까요</h1>

      <StockBasicsLauncher />

      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "2rem" }}>
        <Link href="/learn/compare" className="btn" data-variant="quiet">
          다섯 질문으로 일곱 투자 철학 비교하기
        </Link>
      </div>

      <ul className="master-grid">
        {MASTERS.map((m) => {
          const ready = hasCharacter(m.id);
          return (
            <li key={m.id}>
              <Link
                href={`/learn/masters/${m.id}`}
                className="master-card"
                data-ready={ready ? "true" : "false"}
              >
                <span className="master-card-art">
                  {ready ? (
                    <MasterCharacter masterId={m.id} height={150} />
                  ) : (
                    <img
                      className="investor-avatar"
                      src={`/investors/${m.id}.png`}
                      alt=""
                      width={64}
                      height={64}
                    />
                  )}
                </span>
                <span className="master-card-body">
                  <span className="style-name">{m.styleName}</span>
                  <strong className="master-card-name">{m.name}</strong>
                  <span className="master-card-line">
                    {ready ? m.oneLine : "캐릭터 준비 중 · 내용은 볼 수 있어요"}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
