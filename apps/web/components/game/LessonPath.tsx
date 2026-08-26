import type { CSSProperties } from "react";
import MasterCharacter from "@/components/MasterCharacter";
import { lessonDotState, lessonPathIndex } from "@/lib/lessonPath.ts";

const SWAY = [0, 18, 28, 18, 0, 18, 28, 18];
const ROW = 56;

/** 채점형 문항 수만큼 점을 찍고, 맞힌 횟수 자리에 대가 캐릭터를 둔다.
 *  캐릭터는 점과 같은 리스트 칸에 넣지 않는다 — 칸을 바꾸면 걷지 않고 다시 붙는다. */
export default function LessonPath({
  masterId,
  correctCount,
  total,
}: {
  masterId: string;
  correctCount: number;
  total: number;
}) {
  if (total <= 0) return null;

  const at = lessonPathIndex(correctCount, total);
  const sway = SWAY[at % SWAY.length];

  return (
    <div
      className="lesson-path"
      aria-label="퀴즈 진행 경로"
      style={{ "--at": at, "--sway": `${sway}px`, "--row": `${ROW}px` } as CSSProperties}
    >
      <ol className="lesson-path-track">
        {Array.from({ length: total }, (_, i) => {
          const state = lessonDotState(i, correctCount, total);
          return (
            <li
              key={i}
              className="lesson-path-row"
              style={{ "--sway": `${SWAY[i % SWAY.length]}px` } as CSSProperties}
            >
              <span className="lesson-path-dot" data-state={state}>
                <span className="visually-hidden">
                  {i + 1}번 {state === "done" ? "맞춤" : state === "current" ? "지금" : "남음"}
                </span>
                <span aria-hidden="true">{state === "done" ? "✓" : i + 1}</span>
              </span>
            </li>
          );
        })}
      </ol>
      <span className="lesson-path-figure">
        <MasterCharacter masterId={masterId} height={96} />
      </span>
    </div>
  );
}
