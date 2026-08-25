"use client";

import { useEffect, useState } from "react";
import type { QuizItem } from "@/content/masters";
import { markLessonDone, recordQuiz } from "@/lib/store";
import { track, type WisorEvent } from "@/lib/analytics";
import "./game/mascot.css";

/** 상태별 마스코트. 애니메이션 WebP라 img로 자동 재생된다. */
function Mascot({ state }: { state: "idle" | "correct" | "wrong" | "celebrate" }) {
  const label = { idle: "학습 중", correct: "정답", wrong: "응원", celebrate: "축하" }[state];
  return (
    <div className="duo-mascot">
      <img src={`/mascot/${state}.webp`} alt={`마스코트 — ${label}`} />
      {state === "correct" && <span className="duo-xppop">+5 XP</span>}
    </div>
  );
}

/** 듀오링고 스타일 퀴즈. 기존 `Quiz`(components/Quiz.tsx)와 달리 한 문항씩 즉시
 *  정오를 보여주고 다음 문항으로 넘어간다. 빨강·초록 금지 규칙은 주식 화면에서
 *  가격 방향을 뜻하지 않기 위한 것이라 학습 화면인 이 퀴즈에는 적용되지 않는다.
 *  배지·점수 색은 --wine(정답)·--ochre(오답)을 쓴다. */
export default function DuoQuiz({
  id,
  items,
  startEvent,
  completedEvent,
}: {
  id: string;
  items: QuizItem[];
  startEvent?: WisorEvent;
  completedEvent: WisorEvent;
}) {
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [history, setHistory] = useState<boolean[]>([]);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    if (startEvent) track(startEvent, { id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const item = items[step];
  const correctCount = history.filter(Boolean).length;
  const streak = (() => {
    let count = 0;
    for (let i = history.length - 1; i >= 0; i -= 1) {
      if (!history[i]) break;
      count += 1;
    }
    return count;
  })();

  function choose(choice: number) {
    if (revealed) return;
    setSelected(choice);
  }

  function check() {
    if (selected === null) return;
    setRevealed(true);
    setHistory((prev) => [...prev, selected === item.answer]);
  }

  async function advance() {
    if (!revealed) return;
    if (step + 1 < items.length) {
      setStep((s) => s + 1);
      setSelected(null);
      setRevealed(false);
      return;
    }

    const finalCorrect = correctCount + (selected === item.answer ? 1 : 0);
    await recordQuiz(id, finalCorrect, items.length);
    await markLessonDone(id);
    track(completedEvent, { id, correct: finalCorrect, total: items.length });
    setFinished(true);
  }

  function retry() {
    setStep(0);
    setSelected(null);
    setRevealed(false);
    setHistory([]);
    setFinished(false);
  }

  if (finished) {
    const missed = items.filter((_, i) => !history[i]);
    const ratio = correctCount / items.length;
    const message =
      ratio === 1
        ? "만점입니다. 이 단원의 개념이 자리를 잡았습니다."
        : ratio >= 0.8
          ? "대부분 맞혔습니다. 놓친 문항의 해설만 한 번 더 읽어보세요."
          : "틀린 문항의 해설을 다시 읽고 한 번 더 풀어보길 권합니다.";

    return (
      <div className="card">
        <Mascot state="celebrate" />
        <p className="eyebrow">결과</p>
        <div style={{ display: "flex", alignItems: "baseline", gap: "0.6rem", marginBottom: "1rem" }}>
          <span className="score-value" style={{ fontSize: "2.2rem" }}>
            {correctCount}
          </span>
          <span className="score-of">/ {items.length}문항 정답</span>
        </div>
        <p style={{ margin: "0 0 1.25rem", fontSize: "0.93rem", color: "var(--ink-soft)" }}>{message}</p>

        {missed.length > 0 && (
          <>
            <p className="eyebrow">다시 볼 문항</p>
            <ul className="reason-list" style={{ marginBottom: "1.25rem" }}>
              {missed.map((m, i) => (
                <li key={i} data-kind="fail">
                  {m.question} — {m.explain}
                </li>
              ))}
            </ul>
          </>
        )}

        <button type="button" className="btn" data-variant="quiet" onClick={retry}>
          처음부터 다시 풀기
        </button>
      </div>
    );
  }

  const mascotState = !revealed ? "idle" : selected === item.answer ? "correct" : "wrong";

  return (
    <div className="card">
      <Mascot state={mascotState} />
      <div className="chapter-progress" aria-label={`${items.length}문항 중 ${step + 1}번째`}>
        {items.map((_, i) => (
          <span key={i} data-state={i < step ? "done" : i === step ? "current" : undefined} />
        ))}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: "1rem" }}>
        <p className="eyebrow" style={{ margin: 0 }}>
          문항 {step + 1} / {items.length}
        </p>
        {streak >= 2 && (
          <p className="mono" style={{ margin: 0, color: "var(--wine)", fontSize: "0.82rem" }}>
            연속 정답 {streak}개
          </p>
        )}
      </div>

      <h3 className="sub" style={{ marginTop: "0.75rem" }}>
        {item.question}
      </h3>

      <div role="group" aria-label={item.question}>
        {item.choices.map((choice, ci) => {
          let state: string | undefined;
          if (revealed) {
            if (ci === item.answer && selected === ci) state = "correct";
            else if (selected === ci) state = "wrong";
            else if (ci === item.answer) state = "missed";
          } else if (selected === ci) {
            state = "correct";
          }
          return (
            <button
              key={ci}
              type="button"
              className="choice"
              data-state={state}
              aria-pressed={selected === ci}
              disabled={revealed}
              onClick={() => choose(ci)}
            >
              <span className="mono">{String.fromCharCode(65 + ci)}</span>
              <span>{choice}</span>
            </button>
          );
        })}
      </div>

      {revealed && (
        <p role="status" style={{ fontSize: "0.88rem", color: "var(--ink-soft)", marginTop: "1rem" }}>
          {item.explain}
        </p>
      )}

      <div style={{ marginTop: "1.25rem" }}>
        {!revealed ? (
          <button type="button" className="btn" disabled={selected === null} onClick={check}>
            정답 확인
          </button>
        ) : (
          <button type="button" className="btn" onClick={() => void advance()}>
            {step + 1 < items.length ? "다음 문항" : "결과 보기"}
          </button>
        )}
      </div>
    </div>
  );
}
