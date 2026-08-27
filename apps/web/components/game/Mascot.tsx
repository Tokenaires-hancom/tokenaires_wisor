import type { CSSProperties } from "react";
import "./mascot.css";

export type MascotState = "idle" | "teach" | "correct" | "wrong" | "celebrate";

/** 정답 시 사방으로 튀는 반짝임 좌표(°를 x/y로). */
const SPARKS = [0, 60, 120, 180, 240, 300].map((deg) => {
  const rad = (deg * Math.PI) / 180;
  return { dx: `${Math.round(Math.cos(rad) * 62)}px`, dy: `${Math.round(Math.sin(rad) * 62)}px` };
});

/** 상태별 코인 마스코트. 애니메이션 WebP라 img로 자동 재생된다.
 *  정답일 때 "+5 XP" 팝과 반짝임 버스트를 함께 띄운다.
 *  key에 state를 넣어 상태가 바뀔 때마다 등장 애니메이션이 다시 실행된다. */
export default function Mascot({ state }: { state: MascotState }) {
  const label = {
    idle: "학습 중",
    teach: "설명",
    correct: "정답",
    wrong: "응원",
    celebrate: "축하",
  }[state];
  const sparkling = state === "correct" || state === "celebrate";
  return (
    <div className="duo-mascot" data-state={state}>
      {sparkling &&
        SPARKS.map((s, i) => (
          <span
            key={i}
            className="duo-spark"
            style={{ "--dx": s.dx, "--dy": s.dy } as CSSProperties}
          />
        ))}
      <img key={state} src={`/mascot/${state}.webp`} alt={`마스코트 — ${label}`} />
      {state === "correct" && <span className="duo-xppop">+5 XP</span>}
    </div>
  );
}
