import "./mascot.css";

export type MascotState = "idle" | "correct" | "wrong" | "celebrate";

/** 상태별 코인 마스코트. 애니메이션 WebP라 img로 자동 재생된다.
 *  정답일 때 "+5 XP" 팝을 함께 띄운다. */
export default function Mascot({ state }: { state: MascotState }) {
  const label = { idle: "학습 중", correct: "정답", wrong: "응원", celebrate: "축하" }[state];
  return (
    <div className="duo-mascot">
      <img src={`/mascot/${state}.webp`} alt={`마스코트 — ${label}`} />
      {state === "correct" && <span className="duo-xppop">+5 XP</span>}
    </div>
  );
}
