import Link from "next/link";
import MasterCarousel from "@/components/MasterCarousel";
import StockBasicsLauncher from "@/components/StockBasicsLauncher";

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

      <MasterCarousel />
    </div>
  );
}
