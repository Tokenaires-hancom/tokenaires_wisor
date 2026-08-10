"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { isCorrect } from "@/content/curriculum/grading";
import { chapterSteps, stepLabel } from "@/content/curriculum/steps";
import type { Exercise } from "@/content/curriculum/types";
import { track } from "@/lib/analytics";
import { markLessonDone, recordQuiz, saveJournalEntry } from "@/lib/store";

/** 챕터의 유일한 클라이언트 경계.
 *
 * 진도와 점수를 나눠 기록한다. 채점형 문항이 없는 장도 있으므로 모든 문항을
 * 처리하면 진도를 남기고, 채점형 문항이 있는 장만 점수를 추가로 남긴다.
 */
export default function ChapterExercises({
  chapterId,
  exercises,
  body,
  closing,
  initialStep = 0,
  syncStepToUrl = true,
}: {
  chapterId: string;
  exercises: Exercise[];
  body: string[];
  closing: string;
  initialStep?: number;
  /** 페이지가 `?step=`을 읽어 되돌릴 수 있을 때만 켠다. 읽지 않는 페이지에 켜면
   *  주소가 실제로 복원되지 않는 스텝을 주장하게 된다. */
  syncStepToUrl?: boolean;
}) {
  const steps = chapterSteps(exercises);
  const router = useRouter();
  const [at, setAt] = useState(() => Math.min(Math.max(initialStep, 0), steps.length - 1));
  const [done, setDone] = useState<boolean[]>(exercises.map(() => false));
  const [picks, setPicks] = useState<number[][]>(exercises.map(() => []));
  const [texts, setTexts] = useState<string[]>(exercises.map(() => ""));
  const contentRef = useRef<HTMLDivElement>(null);
  const mounted = useRef(false);

  const step = steps[at];

  // 스텝이 바뀔 때 포커스를 새 콘텐츠로 옮긴다. 경계 스텝에서는 눌렀던
  // 이전/계속 버튼이 disabled가 되며 포커스가 body로 떨어지는데, 그러면
  // 다음 Tab이 문서 맨 위부터 다시 시작한다. 첫 마운트에는 옮기지 않는다.
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    contentRef.current?.focus({ preventScroll: true });
  }, [at]);

  function go(next: number) {
    setAt(next);
    if (syncStepToUrl) {
      router.replace(`?step=${next}`, { scroll: false });
    }
  }

  function toggle(index: number, choice: number, multiple: boolean) {
    if (done[index]) return;
    setPicks((prev) =>
      prev.map((picked, i) => {
        if (i !== index) return picked;
        if (!multiple) return [choice];
        return picked.includes(choice)
          ? picked.filter((candidate) => candidate !== choice)
          : [...picked, choice];
      }),
    );
  }

  async function finish(index: number) {
    const next = done.map((complete, i) => (i === index ? true : complete));
    setDone(next);

    const exercise = exercises[index];
    if (exercise.kind === "journal") {
      await saveJournalEntry(`${chapterId}#${index}`, exercise.prompt, texts[index]);
    }

    if (!next.every(Boolean)) return;

    await markLessonDone(chapterId);

    const graded = exercises
      .map((item, i) => ({ item, i }))
      .filter(
        (candidate): candidate is {
          item: Extract<Exercise, { kind: "graded" }>;
          i: number;
        } => candidate.item.kind === "graded",
      );
    const correct = graded.filter(({ item, i }) => isCorrect(item.answers, picks[i])).length;

    if (graded.length > 0) {
      await recordQuiz(chapterId, correct, graded.length);
    }

    if (chapterId.startsWith("master:")) {
      track("master_lesson_completed", {
        id: chapterId,
        correct,
        total: graded.length,
      });
    }
  }

  return (
    <section aria-label="챕터 진행">
      <ol className="step-bar" aria-label={`${steps.length}단계 중 ${at + 1}단계`}>
        {steps.map((each, index) => (
          <li
            key={index}
            data-state={index < at ? "done" : index === at ? "current" : undefined}
            aria-current={index === at ? "step" : undefined}
          >
            <span className="visually-hidden">{stepLabel(each)}</span>
          </li>
        ))}
      </ol>

      <div
        ref={contentRef}
        tabIndex={-1}
        role="group"
        aria-label={`${stepLabel(step)} 단계, ${at + 1}/${steps.length}`}
      >
        {step.kind === "read" && (
          <div className="prose">
            {body.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
        )}

        {step.kind === "exercise" && (
          <div className="card">
            {exercises[step.index].kind === "graded" && (
              <Graded
                exercise={exercises[step.index] as Extract<Exercise, { kind: "graded" }>}
                picked={picks[step.index]}
                submitted={done[step.index]}
                onPick={(choice) =>
                  toggle(
                    step.index,
                    choice,
                    (exercises[step.index] as Extract<Exercise, { kind: "graded" }>).answers.length > 1,
                  )
                }
                onSubmit={() => void finish(step.index)}
              />
            )}
            {exercises[step.index].kind === "guided" && (
              <Guided
                exercise={exercises[step.index] as Extract<Exercise, { kind: "guided" }>}
                text={texts[step.index]}
                revealed={done[step.index]}
                onChange={(value) =>
                  setTexts((prev) => prev.map((text, i) => (i === step.index ? value : text)))
                }
                onSubmit={() => void finish(step.index)}
              />
            )}
            {exercises[step.index].kind === "journal" && (
              <Journal
                exercise={exercises[step.index] as Extract<Exercise, { kind: "journal" }>}
                text={texts[step.index]}
                saved={done[step.index]}
                onChange={(value) =>
                  setTexts((prev) => prev.map((text, i) => (i === step.index ? value : text)))
                }
                onSubmit={() => void finish(step.index)}
              />
            )}
          </div>
        )}

        {step.kind === "summary" && (
          <div className="card">
            <p className="eyebrow">이 장의 한 문장</p>
            <p style={{ margin: 0, fontFamily: "var(--serif)", fontSize: "1.05rem" }}>{closing}</p>
          </div>
        )}
      </div>

      <div className="step-nav">
        <button
          type="button"
          className="btn"
          data-variant="quiet"
          disabled={at === 0}
          onClick={() => go(at - 1)}
        >
          이전
        </button>
        <span className="mono">
          {at + 1} / {steps.length}
        </span>
        <button
          type="button"
          className="btn"
          disabled={at === steps.length - 1}
          onClick={() => go(at + 1)}
        >
          계속
        </button>
      </div>
    </section>
  );
}

function Graded({
  exercise,
  picked,
  submitted,
  onPick,
  onSubmit,
}: {
  exercise: Extract<Exercise, { kind: "graded" }>;
  picked: number[];
  submitted: boolean;
  onPick: (choice: number) => void;
  onSubmit: () => void;
}) {
  const multiple = exercise.answers.length > 1;

  return (
    <>
      <p className="eyebrow">확인 문항{multiple ? " · 복수 정답" : ""}</p>
      <h3 className="sub">{exercise.prompt}</h3>
      <div role="group" aria-label={exercise.prompt}>
        {exercise.choices.map((choice, choiceIndex) => {
          let state: string | undefined;
          if (submitted) {
            if (exercise.answers.includes(choiceIndex) && picked.includes(choiceIndex)) {
              state = "correct";
            } else if (picked.includes(choiceIndex)) {
              state = "wrong";
            } else if (exercise.answers.includes(choiceIndex)) {
              state = "missed";
            }
          } else if (picked.includes(choiceIndex)) {
            state = "correct";
          }

          return (
            <button
              key={choiceIndex}
              type="button"
              className="choice"
              data-state={state}
              aria-pressed={picked.includes(choiceIndex)}
              disabled={submitted}
              onClick={() => onPick(choiceIndex)}
            >
              <span className="mono">{String.fromCharCode(65 + choiceIndex)}</span>
              <span>{choice}</span>
            </button>
          );
        })}
      </div>
      {submitted ? (
        <p
          role="status"
          style={{ fontSize: "0.88rem", color: "var(--ink-soft)", marginBottom: 0 }}
        >
          {exercise.explain}
        </p>
      ) : (
        <button type="button" className="btn" disabled={picked.length === 0} onClick={onSubmit}>
          답 확인하기
        </button>
      )}
    </>
  );
}

function Guided({
  exercise,
  text,
  revealed,
  onChange,
  onSubmit,
}: {
  exercise: Extract<Exercise, { kind: "guided" }>;
  text: string;
  revealed: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <>
      <p className="eyebrow">써보기 · 점수 없음</p>
      <h3 className="sub">{exercise.prompt}</h3>
      <label className="field">
        <span>내 답</span>
        <textarea
          rows={4}
          value={text}
          onChange={(event) => onChange(event.target.value)}
          disabled={revealed}
        />
      </label>
      {revealed ? (
        <div className="checkpoints" role="status">
          <p className="eyebrow">체크 포인트</p>
          <ul className="reason-list">
            {exercise.checkpoints.map((point, index) => (
              <li key={index} data-kind="pass">
                {point}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <button type="button" className="btn" disabled={text.trim() === ""} onClick={onSubmit}>
          체크 포인트 보기
        </button>
      )}
    </>
  );
}

function Journal({
  exercise,
  text,
  saved,
  onChange,
  onSubmit,
}: {
  exercise: Extract<Exercise, { kind: "journal" }>;
  text: string;
  saved: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <>
      <p className="eyebrow">기록 · 90일 뒤 다시 묻습니다</p>
      <h3 className="sub">{exercise.prompt}</h3>
      <label className="field">
        <span>내 기록</span>
        <textarea
          rows={4}
          value={text}
          onChange={(event) => onChange(event.target.value)}
          disabled={saved}
        />
      </label>
      {saved ? (
        <p
          role="status"
          style={{ fontSize: "0.88rem", color: "var(--ink-soft)", marginBottom: 0 }}
        >
          기록했습니다. 90일 뒤 내 학습에서 다시 묻습니다.
        </p>
      ) : (
        <button type="button" className="btn" disabled={text.trim() === ""} onClick={onSubmit}>
          기록하기
        </button>
      )}
    </>
  );
}
