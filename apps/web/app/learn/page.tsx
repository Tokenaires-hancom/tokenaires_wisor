import Link from "next/link";
import MasterCarousel from "@/components/MasterCarousel";
import StockBasicsLauncher from "@/components/StockBasicsLauncher";

export default function LearnIndex() {
  return (
    <div className="wrap learn-page">
      <div className="learn-page-header">
        <div>
          <p className="eyebrow">배우기</p>
          <h1 className="thesis">다양한 관점의 투자 철학을 배우고 나만의 기준을 세워보세요</h1>
        </div>
      </div>

      <div className="learn-selection">
        <div className="learn-tools">
          <StockBasicsLauncher />
          <Link href="/learn/compare" className="learn-tool">
            <span>대가들의 투자철학 비교</span>
            <span className="learn-tool-arrow" aria-hidden="true">→</span>
          </Link>
        </div>

        <MasterCarousel />

        <div className="learn-sources-link">
          <Link href="/learn/sources">커리큘럼 참고문헌</Link>
        </div>
      </div>
    </div>
  );
}
