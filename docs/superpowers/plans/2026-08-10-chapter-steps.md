# 챕터 스텝화 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 챕터 화면에서 본문과 문항이 한 번에 다 보이는 구조를, 한 화면에 하나씩 지나가는 스텝 구조로 바꾼다.

**Architecture:** 스텝 목록을 만드는 로직을 순수 함수(`content/curriculum/steps.ts`)로 분리해 `node --test`로 검증한다. `ChapterExercises`는 문항 전체를 렌더하던 것에서 현재 스텝 하나만 렌더하는 컴포넌트로 바꾼다. 본문(읽기)과 정리는 서버에서 내려오고, 스텝 이동만 클라이언트가 맡는다.

**Tech Stack:** Next.js 15 App Router · React 19 · TypeScript strict · 순수 CSS · `node --test` (Node 23+ 타입 스트리핑)

## Global Constraints

- **의존성을 추가하지 않는다.** 웹은 `next` · `react` · `react-dom`뿐이고 그 상태를 유지한다. 테스트는 `node --test`만 쓴다
- **빨강·초록을 쓰지 않는다.** 충족은 `--plum`, 미충족은 `--ochre`. 색만으로 의미를 전달하지 않고 채움·빗금·점선을 함께 쓴다
- **스타일은 `app/globals.css`의 토큰과 클래스만.** 인라인 `style`은 일회성 여백 조정에만
- **클라이언트 컴포넌트에서 `lib/scores.ts`를 import하지 않는다.** 타입은 `lib/scores.types.ts`에서
- **저장은 `lib/store.ts`를 거친다.** 컴포넌트에서 `localStorage`를 직접 부르지 않는다. 모든 함수는 `Promise`를 돌려준다
- **잠금을 만들지 않는다.** 미완 스텝도 이동 가능해야 한다. 흐림은 "아직 안 봤다"는 표시이지 막는 장치가 아니다
- **사용자 문구는 관찰과 확인까지만.** "~하면 좋습니다", "지금이 기회입니다" 류를 쓰지 않는다
- 커밋 전 `npm run build`와 `npm test`를 모두 통과해야 한다

## 이번 계획에 없는 것

스펙의 나머지는 후속 계획으로 나눈다. 이 계획은 **챕터 화면 하나**만 다룬다.

| 후속 | 내용 |
|---|---|
| 경로 화면 | `/learn` 카드 그리드 · `/learn/masters/[slug]` 세로 노드 |
| 콘텐츠 정리 | 기록형 30 → 7 축소. guided 문항 23개를 새로 써야 하므로 콘텐츠 작업 |
| 경로 끝 | 기준 소개 · 종합 확인 · `/learn/scoring` 접기 |
| 종목 찾기 | `/screener` 단일화 · 검색 |

**콘텐츠를 이번에 바꾸지 않는다.** 지금 분포(장마다 문항 2~4개)를 그대로 스텝으로 펼친다. 스텝 수가 장마다 다른 것은 이 단계에서 정상이다.

## File Structure

| 파일 | 책임 |
|---|---|
| `content/curriculum/steps.ts` (신규) | 챕터 하나 → 스텝 목록. 순수 함수, DOM 없음 |
| `content/curriculum/steps.test.ts` (신규) | 위 함수의 검증 |
| `components/ChapterExercises.tsx` (개조) | 현재 스텝 하나만 렌더 + 이동. 저장 로직은 그대로 |
| `app/learn/masters/[slug]/[chapter]/page.tsx` (수정) | 본문을 컴포넌트로 넘김. 상단 진행 바 교체 |
| `app/globals.css` (추가) | 스텝 진행 바와 이동 바 클래스 |

---

### Task 1: 스텝 목록을 만드는 순수 함수

**Files:**
- Create: `apps/web/content/curriculum/steps.ts`
- Test: `apps/web/content/curriculum/steps.test.ts`

**Interfaces:**
- Consumes: `Exercise` (`content/curriculum/types.ts`)
- Produces:
  - `type Step = { kind: "read" } | { kind: "exercise"; index: number } | { kind: "summary" }`
  - `chapterSteps(exercises: Exercise[]): Step[]`
  - `stepLabel(step: Step): string`

`Chapter` 전체가 아니라 `Exercise[]`만 받는다. 스텝 개수를 정하는 데 필요한 것이 문항 배열뿐이고, 클라이언트 컴포넌트가 가짜 `Chapter`를 지어내지 않아도 된다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`apps/web/content/curriculum/steps.test.ts`:

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import type { Exercise } from "./types.ts";
import { chapterSteps, stepLabel } from "./steps.ts";

const graded: Exercise = {
  kind: "graded",
  prompt: "물음",
  choices: ["가", "나"],
  answers: [0],
  explain: "풀이",
};
const journal: Exercise = { kind: "journal", prompt: "기록" };

test("읽기로 시작하고 정리로 끝난다", () => {
  assert.deepEqual(chapterSteps([]), [{ kind: "read" }, { kind: "summary" }]);
});

test("문항 하나가 스텝 하나가 된다", () => {
  assert.deepEqual(chapterSteps([graded, journal]), [
    { kind: "read" },
    { kind: "exercise", index: 0 },
    { kind: "exercise", index: 1 },
    { kind: "summary" },
  ]);
});

test("문항 순서가 원본 배열 순서를 그대로 따른다", () => {
  const steps = chapterSteps([journal, graded]);
  const indexes = steps
    .filter((step): step is { kind: "exercise"; index: number } => step.kind === "exercise")
    .map((step) => step.index);
  assert.deepEqual(indexes, [0, 1]);
});

test("스텝마다 사람이 읽는 이름이 있다", () => {
  assert.equal(stepLabel({ kind: "read" }), "읽기");
  assert.equal(stepLabel({ kind: "exercise", index: 0 }), "확인");
  assert.equal(stepLabel({ kind: "summary" }), "정리");
});
```

- [ ] **Step 2: 실패를 확인한다**

```bash
cd apps/web && node --test "content/curriculum/steps.test.ts"
```

기대: `Cannot find module './steps.ts'`로 실패.

- [ ] **Step 3: 최소 구현을 쓴다**

`apps/web/content/curriculum/steps.ts`:

```ts
import type { Exercise } from "./types.ts";

/** 챕터를 한 화면에 하나씩 지나가는 단위로 쪼갠다.
 *
 *  문항 수가 장마다 달라 스텝 수도 달라진다. 콘텐츠를 고르게 맞추는 일은
 *  별도 작업이고, 여기서는 있는 그대로 펼친다. */
export type Step =
  | { kind: "read" }
  | { kind: "exercise"; index: number }
  | { kind: "summary" };

const LABEL: Record<Step["kind"], string> = {
  read: "읽기",
  exercise: "확인",
  summary: "정리",
};

export function chapterSteps(exercises: Exercise[]): Step[] {
  return [
    { kind: "read" },
    ...exercises.map((_, index) => ({ kind: "exercise" as const, index })),
    { kind: "summary" },
  ];
}

export function stepLabel(step: Step): string {
  return LABEL[step.kind];
}
```

- [ ] **Step 4: 통과를 확인한다**

```bash
cd apps/web && node --test "content/curriculum/steps.test.ts"
```

기대: 4 tests pass.

- [ ] **Step 5: 전체 테스트를 돌린다**

```bash
cd apps/web && npm test
```

기대: 51 pass, 0 fail (기존 47 + 신규 4).

- [ ] **Step 6: 커밋한다**

```bash
git add content/curriculum/steps.ts content/curriculum/steps.test.ts
git commit -m "챕터를 스텝 단위로 쪼개는 함수를 더한다

한 화면에 본문과 문항이 모두 보이면 성격이 다른 문항 셋이 같은 무게로
읽힌다. 화면을 나누기 전에 나누는 규칙부터 순수 함수로 떼어 둔다."
```

---

### Task 2: 챕터를 한 화면에 하나씩 지나가도록 바꾼다

컴포넌트와 호출부를 한 Task로 묶는다. 컴포넌트만 고치면 props 타입이 어긋나 빌드가 깨지고, 빌드되지 않는 중간 상태는 리뷰할 수 없다.

**Files:**
- Modify: `apps/web/components/ChapterExercises.tsx`
- Modify: `apps/web/app/globals.css`
- Modify: `apps/web/app/learn/masters/[slug]/[chapter]/page.tsx`

**Interfaces:**
- Consumes: `chapterSteps`, `stepLabel`, `Step` (Task 1)
- Produces: `ChapterExercises`가 받는 props가 바뀐다 —
  `{ chapterId: string; exercises: Exercise[]; body: string[]; closing: string }`
  `title` · `lede` · `asks`는 넘기지 않는다. 서버 컴포넌트에 그대로 남는다.

**그대로 두는 것:** `Graded` · `Guided` · `Journal` 세 하위 컴포넌트와 `toggle()` · `finish()`의 본문. 저장 로직과 진도 기록 조건은 하나도 바뀌지 않는다. 바뀌는 것은 최상위 컴포넌트의 `return` 부분과 상태 하나(`at`)뿐이다.

- [ ] **Step 1: import에 스텝 함수를 더한다**

파일 상단 import 블록에 한 줄을 넣는다.

```tsx
import { chapterSteps, stepLabel } from "@/content/curriculum/steps";
```

- [ ] **Step 2: 최상위 컴포넌트를 교체한다**

`export default function ChapterExercises(...)` 전체를 아래로 바꾼다. 파일 아래쪽의 `Graded` · `Guided` · `Journal` 정의는 손대지 않는다.

```tsx
export default function ChapterExercises({
  chapterId,
  exercises,
  body,
  closing,
}: {
  chapterId: string;
  exercises: Exercise[];
  body: string[];
  closing: string;
}) {
  const steps = chapterSteps(exercises);
  const [at, setAt] = useState(0);
  const [done, setDone] = useState<boolean[]>(exercises.map(() => false));
  const [picks, setPicks] = useState<number[][]>(exercises.map(() => []));
  const [texts, setTexts] = useState<string[]>(exercises.map(() => ""));

  const step = steps[at];

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
          >
            <span className="visually-hidden">{stepLabel(each)}</span>
          </li>
        ))}
      </ol>

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

      <div className="step-nav">
        <button
          type="button"
          className="btn"
          data-variant="quiet"
          disabled={at === 0}
          onClick={() => setAt(at - 1)}
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
          onClick={() => setAt(at + 1)}
        >
          계속
        </button>
      </div>
    </section>
  );
}
```

**"계속"에 조건을 걸지 않는다.** 문항을 풀지 않아도 넘어갈 수 있다. 잠금을 만들지 않기로 한 결정이 여기에도 적용된다.

- [ ] **Step 3: 스텝 바와 이동 바 스타일을 더한다**

`app/globals.css` 끝에 붙인다. 기존 `.chapter-progress` 아래에 둔다.

```css
/* 챕터 안에서 지금 어디쯤인지. 잠금이 아니라 표시다 */
.step-bar {
  display: flex;
  gap: 3px;
  list-style: none;
  margin: 0 0 1.5rem;
  padding: 0;
}
.step-bar li {
  flex: 1;
  height: 5px;
  border-radius: 3px;
  background: var(--line);
}
.step-bar li[data-state="done"] { background: var(--plum); }
.step-bar li[data-state="current"] {
  background: var(--plum);
  opacity: 0.55;
}

.step-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-top: 2rem;
  padding-top: 1rem;
  border-top: 1px solid var(--line);
}
.step-nav .mono { color: var(--ink-faint); font-size: 0.85rem; }

.visually-hidden {
  position: absolute;
  width: 1px; height: 1px;
  margin: -1px; padding: 0;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}
```

- [ ] **Step 4: 챕터 페이지가 본문을 컴포넌트로 넘기게 한다**

`app/learn/masters/[slug]/[chapter]/page.tsx`에서 `<div className="prose">` 블록과 기존 `<div className="chapter-progress">` 블록을 지운다. 진행 표시는 `ChapterExercises`의 `.step-bar`가 대신한다.

`ChapterExercises` 호출을 바꾼다.

```tsx
<ChapterExercises
  chapterId={`master:${master.id}:${slot.no}`}
  exercises={chapter.exercises}
  body={chapter.body}
  closing={chapter.lede}
/>
```

`chapter.lede`를 정리 문장으로 재사용한다. 새로 쓸 글이 없다.

제목 · `chapter.lede` · `slot.asks`는 서버에 그대로 남긴다. 스텝이 바뀌어도 장의 정체는 보여야 한다. 정리 스텝에서 `lede`가 다시 나오는 것은 의도된 반복이다 — 장을 열 때 본 문장을 닫으면서 다시 읽는다.

- [ ] **Step 5: 빌드가 통과하는지 확인한다**

```bash
cd apps/web && npm run build
```

기대: 성공. 35개 챕터 경로가 모두 생성된다.

- [ ] **Step 6: 서버 전용 경계가 유지되는지 확인한다**

```bash
cd apps/web && grep -rl "evEbitMedian5y" .next/static/
```

기대: 출력 없음. `ChapterExercises`는 클라이언트 컴포넌트이므로 이 검사가 실질적이다.

- [ ] **Step 7: 실제 화면을 본다**

```bash
cd apps/web && npm run dev
```

`http://localhost:3000/learn/masters/buffett/1`에서 확인한다.

- 첫 화면에 본문 2문단만 보이는가
- "계속"을 누르면 문항이 하나씩 나오는가
- "이전"으로 돌아가도 고른 답과 쓴 글이 남아 있는가
- 문항을 풀지 않아도 "계속"이 눌리는가 (잠금 없음)
- 마지막 스텝에 `chapter.lede`가 나오는가
- 375px 폭에서 이동 바가 깨지지 않는가
- Tab 키만으로 모든 이동이 되는가

- [ ] **Step 8: 전체 테스트를 돌린다**

```bash
cd apps/web && npm test && npm run build
```

기대: 51 pass · 빌드 성공.

- [ ] **Step 9: 커밋한다**

```bash
git add components/ChapterExercises.tsx app/learn/masters/\[slug\]/\[chapter\]/page.tsx app/globals.css
git commit -m "챕터를 한 화면에 하나씩 지나가도록 바꾼다

성격이 다른 문항 셋을 한꺼번에 펼치면 같은 무게로 읽힌다. 채점형은 즉시
정오를 주고 써보기는 대조를 주고 기록형은 90일 뒤에 돌아오는데, 세 장의
카드가 나란히 있으면 그 차이가 사라진다.

진도가 걸리는 시점도 드러난다. 지금은 문항을 모두 끝내야 markLessonDone이
걸리는데 그 조건이 화면에 없었다."
```

---

### Task 3: 새로고침해도 스텝이 남게 한다

스펙의 미정 항목이다. **Task 2까지 쓰고 실제로 불편한지 본 뒤에 결정한다.** 불필요하다고 판단되면 이 작업을 버린다.

**Files:**
- Modify: `apps/web/app/learn/masters/[slug]/[chapter]/page.tsx`
- Modify: `apps/web/components/ChapterExercises.tsx`

- [ ] **Step 1: `searchParams`로 초기 스텝을 받는다**

`page.tsx`:

```tsx
export default async function ChapterPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; chapter: string }>;
  searchParams: Promise<{ step?: string }>;
}) {
  const { slug, chapter: chapterParam } = await params;
  const { step } = await searchParams;
  const initialStep = Number.isInteger(Number(step)) ? Math.max(0, Number(step)) : 0;
  // ...
  <ChapterExercises initialStep={initialStep} ... />
```

`/stocks/[ticker]`가 이미 같은 방식으로 `searchParams.style`을 쓴다.

- [ ] **Step 2: 이동할 때 주소를 바꾼다**

`ChapterExercises`에서 `useRouter`의 `replace`를 쓴다. `push`가 아니다 — 스텝마다 히스토리가 쌓이면 뒤로가기가 장을 못 벗어난다.

```tsx
const router = useRouter();

function go(next: number) {
  setAt(next);
  router.replace(`?step=${next}`, { scroll: false });
}
```

- [ ] **Step 3: 확인한다**

- `?step=2`로 직접 들어가면 3번째 스텝에서 시작하는가
- 스텝을 넘긴 뒤 새로고침하면 그 자리인가
- 뒤로가기 한 번에 장을 벗어나는가
- 범위 밖 값(`?step=99`, `?step=abc`)에서 터지지 않는가

- [ ] **Step 4: 커밋한다**

```bash
git add app/learn/masters/\[slug\]/\[chapter\]/page.tsx components/ChapterExercises.tsx
git commit -m "챕터 스텝을 주소에 남긴다

새로고침하면 첫 스텝으로 돌아가 답을 다시 골라야 했다. 중간 스텝을 링크로
건넬 수도 있게 된다. replace를 쓰는 것은 스텝마다 히스토리가 쌓이면
뒤로가기로 장을 벗어날 수 없기 때문이다."
```

---

## 확인 항목

각 Task를 끝낼 때마다 아래를 실제로 돌린 결과를 남긴다.

```bash
cd apps/web && npm test          # 51 pass 이상
cd apps/web && npm run build     # 성공 · 챕터 35개 생성
cd apps/web && grep -rl "evEbitMedian5y" .next/static/   # 출력 없음
```

수동 확인은 375px 폭과 Tab 키 이동 두 가지를 반드시 포함한다.

## 되돌아볼 지점

이 계획이 끝나면 챕터의 **구조**는 바뀌지만 **콘텐츠**는 그대로다. 다음 두 가지가 남는다.

- 장마다 스텝 수가 다르다(4~6). 콘텐츠를 "채점 1 + 적용 1"로 고르게 맞추면 5스텝으로 일정해진다
- 기록형이 30개라 90일 뒤 한꺼번에 돌아온다. guided 문항 23개를 새로 써야 해소된다

둘 다 콘텐츠 작업이라 별도 계획으로 분리했다. 구조를 먼저 돌려보고 분량을 정하는 편이 낫다.
