import Link from "next/link";
import MasterCarousel from "@/components/MasterCarousel";
import StockBasicsLauncher from "@/components/StockBasicsLauncher";

export default function LearnIndex() {
  return (
    <div className="wrap learn-page">
      <div className="learn-page-header">
        <div>
          <h1 className="thesis">누구의 눈으로 기업을 볼까요</h1>
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
      </div>
    </div>
  );
}
