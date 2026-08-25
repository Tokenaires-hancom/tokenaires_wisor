import Match3 from "@/components/game/Match3.tsx";

export const metadata = {
  title: "기준 매칭 게임 · Wisor",
  description: "투자 지표 타일을 맞춰 대가의 판단 기준을 익히는 사이드 게임.",
};

export default function PlayPage() {
  return (
    <div className="wrap" style={{ paddingBlock: "3.5rem 5rem", maxWidth: "480px" }}>
      <p className="eyebrow">두뇌 휴식</p>
      <h1 className="thesis" style={{ marginBottom: "1.5rem" }}>
        기준 매칭 게임
      </h1>
      <Match3 />
    </div>
  );
}
