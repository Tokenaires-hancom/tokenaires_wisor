import Link from "next/link";
import MasterGrid from "@/components/MasterGrid";

export default function LearnIndex() {
  return (
    <div className="wrap learn-page">
      <div className="learn-page-header">
        <div>
          <p className="eyebrow">배우기</p>
          <h1 className="thesis">다양한 관점의 투자 철학을 배우고 나만의 기준을 세워보세요</h1>
        </div>
      </div>

      <MasterGrid />

      <div className="learn-sources-link">
        <Link href="/learn/sources">커리큘럼 참고문헌</Link>
      </div>
    </div>
  );
}
