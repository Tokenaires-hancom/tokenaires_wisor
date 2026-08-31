"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { isCorrect } from "@/content/curriculum/grading";
import Mascot from "@/components/game/Mascot";
import WaveMascot from "@/components/game/WaveMascot";
import LessonPath from "@/components/game/LessonPath";
import WisorTown from "@/components/game/WisorTown";
import "@/components/game/lesson.css";
import { chapterSteps, stepLabel } from "@/content/curriculum/steps";
// SOURCE_KINDS는 값이지만 types.ts가 Master를 type import만 하므로 번들에 masters.ts가 실리지 않는다
import { SOURCE_KINDS, type Exercise, type SourceNote } from "@/content/curriculum/types";
import { track } from "@/lib/analytics";
import { markLessonDone, recordQuiz, saveJournalEntry, getProgress, type Progress } from "@/lib/store";

// 사운드 (WebAudio, 에셋 없이)
let AC: AudioContext | null = null;
function beep(freq: number, dur: number, type: OscillatorType) {
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    AC = AC ?? new Ctor();
    const o = AC.createOscillator();
    const g = AC.createGain();
    o.type = type;
    o.frequency.value = freq;
    o.connect(g);
    g.connect(AC.destination);
    g.gain.setValueAtTime(0.1, AC.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, AC.currentTime + dur);
    o.start();
    o.stop(AC.currentTime + dur);
  } catch {
    /* 사운드 실패는 진행과 무관 */
  }
}
function playCorrect() {
  beep(523, 0.1, "triangle");
  window.setTimeout(() => beep(784, 0.16, "triangle"), 90); // 딩~
}
function playWrong() {
  beep(160, 0.22, "sawtooth");
}

const SUBMIT_LABEL: Record<Exercise["kind"], string> = {
  graded: "답 확인하기",
  guided: "체크 포인트 보기",
  journal: "기록하기",
};

/** 챕터의 유일한 클라이언트 경계.
 *
 * 진도와 점수를 나눠 기록한다. 채점형 문항이 없는 장도 있으므로 모든 문항을
 * 처리하면 진도를 남기고, 채점형 문항이 있는 장만 점수를 추가로 남긴다.
 */
export default function ChapterExercises({
  chapterId,
  exercises,
  body,
  sources,
  closing,
  initialStep = 0,
  syncStepToUrl = true,
  next,
  masterId,
}: {
  chapterId: string;
  exercises: Exercise[];
  body: string[];
  /** 본문의 출처. 대가 챕터만 갖고 있어서 선택이다(비교 페이지에는 본문이 없다). */
  sources?: SourceNote[];
  closing: string;
  initialStep?: number;
  /** 페이지가 `?step=`을 읽어 되돌릴 수 있을 때만 켠다. 읽지 않는 페이지에 켜면
   *  주소가 실제로 복원되지 않는 스텝을 주장하게 된다. */
  syncStepToUrl?: boolean;
  /** 마지막 스텝에서 '계속' 대신 보여줄 이동 대상. 없으면 마지막 스텝에서
   *  그냥 비활성화된다(예: compare 페이지의 최종 기록에는 다음 장이 없다). */
  next?: { href: string; label: string };
  /** 대가 장에만 넘긴다. 비교 페이지처럼 대가 없는 레슨은 미니 경로를 그리지 않는다. */
  masterId?: string;
}) {
  const steps = chapterSteps(exercises);
  const router = useRouter();
  const [at, setAt] = useState(() => Math.min(Math.max(initialStep, 0), steps.length - 1));
  const [done, setDone] = useState<boolean[]>(exercises.map(() => false));
  const [picks, setPicks] = useState<number[][]>(exercises.map(() => []));
  const [texts, setTexts] = useState<string[]>(exercises.map(() => ""));
  const [combo, setCombo] = useState(0); // 세션 내 연속 정답 (오답이면 0으로)
  const [townProgress, setTownProgress] = useState<Progress | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const mounted = useRef(false);

  const step = steps[at];
  const exerciseIndex = step.kind === "exercise" ? step.index : undefined;
  const currentExercise = exerciseIndex !== undefined ? exercises[exerciseIndex] : undefined;
  const currentSubmitted = exerciseIndex !== undefined && done[exerciseIndex];
  const currentHasInput =
    currentExercise?.kind === "graded"
      ? picks[exerciseIndex!].length > 0
      : currentExercise !== undefined && texts[exerciseIndex!].trim() !== "";
  // C2: 채점형 문항을 제출했을 때의 정오. 하단 피드백 배너에 쓴다.
  const gradedFeedback =
    currentExercise?.kind === "graded" && currentSubmitted
      ? {
          correct: isCorrect(currentExercise.answers, picks[exerciseIndex!]),
          explain: currentExercise.explain,
        }
      : null;
  const gradedTotal = exercises.filter((item) => item.kind === "graded").length;
  const gradedCorrect = exercises.reduce((count, item, i) => {
    if (item.kind !== "graded" || !done[i]) return count;
    return count + (isCorrect(item.answers, picks[i]) ? 1 : 0);
  }, 0);
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
    const updated = done.map((complete, i) => (i === index ? true : complete));
    setDone(updated);

    const exercise = exercises[index];
    if (exercise.kind === "graded") {
      const correct = isCorrect(exercise.answers, picks[index]);
      setCombo((c) => (correct ? c + 1 : 0));
      if (correct) playCorrect();
      else playWrong();
    }
    if (exercise.kind === "journal") {
      await saveJournalEntry(`${chapterId}#${index}`, exercise.prompt, texts[index]);
    }

    if (!updated.every(Boolean)) return;

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
      setTownProgress(await getProgress());
    }
  }

  return (
    <section aria-label="챕터 진행">
      {townProgress && masterId && (
        <div className="town-reward" role="dialog" aria-labelledby="town-reward-title">
          <h2 id="town-reward-title" className="visually-hidden">
            배울수록 마을이 자랍니다
          </h2>
          <WisorTown progress={townProgress} highlightId={masterId} mascot="celebrate" />
          <button type="button" className="btn" onClick={() => setTownProgress(null)}>
            계속
          </button>
        </div>
      )}
      {combo >= 2 && (
        <p className="lesson-combo" key={combo} role="status">
          🔥 {combo}번 연속 정답
        </p>
      )}
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

      <div className="chapter-stage">
        <div
          key={at}
          ref={contentRef}
          tabIndex={-1}
          role="group"
          className="step-slide"
          aria-label={`${stepLabel(step)} 단계, ${at + 1}/${steps.length}`}
        >
        {step.kind === "read" && (
          <div className="prose-rail">
            <div className="prose-rail-mascot">
              <WaveMascot />
            </div>
            <div className="prose">
              {body.map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
              {sources && sources.length > 0 && <Sources sources={sources} />}
            </div>
          </div>
        )}

        {step.kind === "exercise" && (
          <div className="card">
            {exercises[step.index].kind === "graded" && (
              <Graded
                exercise={exercises[step.index] as Extract<Exercise, { kind: "graded" }>}
                picked={picks[step.index]}
                submitted={done[step.index]}
                feedbackState={gradedFeedback ? (gradedFeedback.correct ? "correct" : "wrong") : undefined}
                onPick={(choice) =>
                  toggle(
                    step.index,
                    choice,
                    (exercises[step.index] as Extract<Exercise, { kind: "graded" }>).answers.length > 1,
                  )
                }
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
              />
            )}
          </div>
        )}

        {step.kind === "summary" && (
          <div className="card">
            <Mascot state="celebrate" />
            <p className="eyebrow">이 장의 한 문장</p>
            <p style={{ margin: 0, fontSize: "1.05rem" }}>{closing}</p>
          </div>
        )}
        </div>

      </div>

      {gradedFeedback && (
        <div className="lesson-feedback" data-kind={gradedFeedback.correct ? "correct" : "wrong"} role="status">
          <div className="lesson-feedback-text">
            <strong>{gradedFeedback.correct ? "정답!" : "다시 볼까요"}</strong>
            <p>{gradedFeedback.explain}</p>
          </div>
        </div>
      )}

      <div className="step-nav">
        {at > 0 ? (
          <button type="button" className="btn" data-variant="quiet" onClick={() => go(at - 1)}>
            이전
          </button>
        ) : (
          <span aria-hidden="true" />
        )}
        <span className="mono">
          {at + 1} / {steps.length}
        </span>
        {at === steps.length - 1 && next ? (
          <Link href={next.href} className="btn">
            {next.label}
          </Link>
        ) : currentExercise && !currentSubmitted ? (
          <button
            type="button"
            className="btn"
            disabled={!currentHasInput}
            onClick={() => void finish(exerciseIndex!)}
          >
            {SUBMIT_LABEL[currentExercise.kind]}
          </button>
        ) : (
          <button
            type="button"
            className="btn"
            disabled={at === steps.length - 1}
            onClick={() => go(at + 1)}
          >
            계속
          </button>
        )}
      </div>
    </section>
  );
}

function Graded({
  exercise,
  picked,
  submitted,
  feedbackState,
  onPick,
}: {
  exercise: Extract<Exercise, { kind: "graded" }>;
  picked: number[];
  submitted: boolean;
  feedbackState?: "correct" | "wrong";
  onPick: (choice: number) => void;
}) {
  const multiple = exercise.answers.length > 1;

  return (
    <>
      <p className="eyebrow">확인 문항{multiple ? " · 복수 정답" : ""}</p>
      <div className="quiz-presenter">
        <Mascot key={feedbackState ?? "idle"} state={feedbackState ?? "idle"} />
        <h3 className="quiz-bubble sub">{exercise.prompt}</h3>
      </div>
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
    </>
  );
}

function Guided({
  exercise,
  text,
  revealed,
  onChange,
}: {
  exercise: Extract<Exercise, { kind: "guided" }>;
  text: string;
  revealed: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <>
      <p className="eyebrow">써보기 · 점수 없음</p>
      <Mascot state="teach" />
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
      {revealed && (
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
      )}
    </>
  );
}

/** 본문 아래 접어 둔 각주.
 *
 * 펼치지 않아도 요약줄에서 원문·정리·창작 비율이 보이는 것이 핵심이다.
 * 이 장의 서술 중 얼마가 대가 본인의 것인지를 읽기 전에 알 수 있어야 한다.
 */
function Sources({ sources }: { sources: SourceNote[] }) {
  const tally = SOURCE_KINDS.map((kind) => ({
    kind,
    count: sources.filter((source) => source.kind === kind).length,
  })).filter((entry) => entry.count > 0);

  return (
    <details className="source-note">
      <summary>
        <span>
          <span className="source-note-label">출처</span> {sources.length}개
        </span>
        <span className="source-note-tally">
          {tally.map((entry) => `${entry.kind} ${entry.count}`).join(" · ")}
        </span>
      </summary>
      <ul>
        {sources.map((source, index) => (
          <li key={index}>
            <span className="source-kind" data-kind={source.kind}>
              {source.kind}
            </span>
            {source.paragraph !== undefined && (
              <span className="source-para">{source.paragraph + 1}문단</span>
            )}
            <span className="source-text">{source.text}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

function Journal({
  exercise,
  text,
  saved,
  onChange,
}: {
  exercise: Extract<Exercise, { kind: "journal" }>;
  text: string;
  saved: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <>
      <p className="eyebrow">기록 · 90일 뒤 다시 묻습니다</p>
      <Mascot state="teach" />
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
      {saved && (
        <p
          role="status"
          style={{ fontSize: "0.88rem", color: "var(--ink-soft)", marginBottom: 0 }}
        >
          기록했습니다. 90일 뒤 내 학습에서 다시 묻습니다.
        </p>
      )}
    </>
  );
}
