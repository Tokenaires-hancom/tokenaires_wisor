import Link from "next/link";
import MasterGrid from "@/components/MasterGrid";
import StyleComparisonTable from "@/components/StyleComparisonTable";

export default function LearnIndex() {
  return (
    <div className="wrap wrap-wide learn-page">
      <div className="learn-page-header">
        <div>
          <h1 className="thesis">대가를 통해 투자기준을 세워 보세요</h1>
        </div>
      </div>

      <MasterGrid />

      <StyleComparisonTable />

      <div className="learn-sources-link">
        <Link href="/learn/sources">커리큘럼 참고문헌</Link>
      </div>
    </div>
  );
}
