"use client";

import { useState } from "react";
import type { QuizItem } from "@/content/masters";
import { recordQuiz } from "@/lib/store";
import { track, type WisorEvent } from "@/lib/analytics";

export default function Quiz({
  id,
  items,
  completedEvent,
}: {
  id: string;
  items: QuizItem[];
  completedEvent: WisorEvent;
}) {
  const [answers, setAnswers] = useState<(number | null)[]>(items.map(() => null));
  const [submitted, setSubmitted] = useState(false);

  const answered = answers.every((a) => a !== null);
  const correct = answers.filter((a, i) => a === items[i].answer).length;

  function choose(qIndex: number, choice: number) {
    if (submitted) return;
    setAnswers((prev) => prev.map((v, i) => (i === qIndex ? choice : v)));
  }

  function submit() {
    setSubmitted(true);
    void recordQuiz(id, correct, items.length);
    track(completedEvent, { id, correct, total: items.length });
  }

  return (
    <section className="stack">
      {items.map((item, qi) => (
        <div key={qi} className="card">
          <p className="eyebrow">문항 {qi + 1}</p>
          <h3 className="sub">{item.question}</h3>
          <div role="group" aria-label={item.question}>
            {item.choices.map((choice, ci) => {
              let state: string | undefined;
              if (submitted) {
                if (ci === item.answer && answers[qi] === ci) state = "correct";
                else if (answers[qi] === ci) state = "wrong";
                else if (ci === item.answer) state = "missed";
              } else if (answers[qi] === ci) {
                state = "correct";
              }
              return (
                <button
                  key={ci}
                  type="button"
                  className="choice"
                  data-state={state}
                  aria-pressed={answers[qi] === ci}
                  onClick={() => choose(qi, ci)}
                >
                  <span className="mono">{String.fromCharCode(65 + ci)}</span>
                  <span>{choice}</span>
                </button>
              );
            })}
          </div>
          {submitted && (
            <p style={{ fontSize: "0.88rem", color: "var(--ink-soft)", marginBottom: 0 }}>
              {item.explain}
            </p>
          )}
        </div>
      ))}

      {!submitted ? (
        <button type="button" className="btn" disabled={!answered} onClick={submit}>
          {answered ? "답 확인하기" : "세 문항을 모두 골라주세요"}
        </button>
      ) : (
        <p className="card" style={{ marginBottom: 0 }}>
          <strong>
            {items.length}문항 중 {correct}문항을 맞혔습니다.
          </strong>{" "}
          {correct === items.length
            ? "개념이 자리를 잡았습니다. 다음 단계로 넘어가세요."
            : "틀린 문항의 해설을 한 번 더 읽어보면 도움이 됩니다."}
        </p>
      )}
    </section>
  );
}
