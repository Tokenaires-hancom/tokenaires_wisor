# 투자 스타일 커리큘럼 1단계 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 대가 3명(버핏·그레이엄·린치)의 학습 콘텐츠를 원칙 나열에서 5장 챕터 커리큘럼으로 바꾸고, 채점형·첨삭형·기록형 3계층 문항을 붙인다.

**Architecture:** 커리큘럼 데이터는 `content/curriculum/`에 타입 안전한 정적 콘텐츠로 두고, 배열 위치가 곧 챕터 칸이 되도록 길이 5 튜플로 고정한다. 챕터 페이지는 서버 컴포넌트이고 클라이언트 경계는 문항 컴포넌트 하나뿐이다. 콘텐츠 무결성은 별도 스크립트 없이 `content/curriculum/index.ts`의 모듈 로드 시점 검사로 강제하며, 페이지가 전부 정적 생성이므로 이것이 곧 빌드 타임 검사가 된다.

**Tech Stack:** Next.js 15 App Router · React 19 · TypeScript strict · 순수 CSS · localStorage(`lib/store.ts` 경유)

**설계 문서:** `docs/superpowers/specs/2026-08-06-learn-curriculum-design.md`

## Global Constraints

이 절의 규칙은 모든 과제에 암묵적으로 포함된다.

- **의존성을 추가하지 않는다.** 지금 `apps/web`의 dependencies는 `next` · `react` · `react-dom` 셋뿐이고 그 상태를 유지한다. 테스트 러너도 설치하지 않는다
- **테스트는 Node 내장 러너를 쓴다.** `node:test` + `node:assert`는 Node에 들어 있어 설치할 것이 없다. Node 23+는 `.ts` 타입 스트리핑이 기본이라 TypeScript를 그대로 돌린다. 확인된 환경은 v24.18.0
  - 테스트 파일은 소스를 **확장자까지 적어** 가져온다 — `import { isCorrect } from "./grading.ts"`. Node ESM은 확장자 생략을 허용하지 않는다
  - 그래서 `tsconfig.json`에 `"allowImportingTsExtensions": true`가 필요하다. `noEmit: true`라 쓸 수 있다
  - `@/` 경로 별칭은 Node가 해석하지 못한다. 테스트 대상 모듈은 상대 경로만 쓴다
  - React 컴포넌트 렌더링은 이 방식으로 테스트할 수 없다(DOM 환경이 필요하고 그건 의존성이다). 컴포넌트는 빌드와 손 확인으로 검증한다
- **검증 두 가지.** 두 명령이 모두 통과해야 과제가 끝난다

  ```bash
  cd apps/web && npm test        # 순수 로직
  cd apps/web && npm run build   # 타입 오류 · 정적 생성 · 로드 시점 검사
  ```
- **순수 CSS만.** Tailwind·CSS-in-JS·UI 라이브러리 금지. `app/globals.css`의 토큰과 클래스만 쓰고 하드코딩 hex를 넣지 않는다. 인라인 `style`은 일회성 여백 조정에만
- **빨강·초록 금지.** 충족은 `--plum`, 미충족은 `--ochre`. 색만으로 의미를 전달하지 않고 채움·빗금·점선을 함께 쓴다
- **클라이언트 컴포넌트에서 `lib/scores.ts`를 import하지 않는다.** 타입은 `lib/scores.types.ts`에서 가져온다
- **컴포넌트에서 `localStorage`를 직접 부르지 않는다.** 반드시 `lib/store.ts`를 거치고, 그 함수들은 전부 `Promise`를 돌려준다. 동기로 되돌리지 않는다
- **Next 15에서 `params`는 Promise다.** `await` 한다
- **사용자에게 보이는 문장:** 4장(처분) 서술은 3인칭 고정. "이 스타일은 가치에 닿으면 판다"는 쓰고 "지금 파세요"·"손절하세요"·"추천합니다"는 쓰지 않는다. "현재" 대신 날짜를 쓴다
- **커밋 메시지:** 한국어 한 줄 요약 + 필요하면 본문에 **왜** 바꿨는지. 무엇을 바꿨는지가 아니다
- **브랜치:** `feat/learn-curriculum` (이미 생성됨, 스펙 커밋 `53612a5` 위에 쌓는다)

## File Structure

| 파일 | 책임 |
|---|---|
| `docs/sources/investment-styles-curriculum.md` | 원본 커리큘럼 문서. 콘텐츠의 출처를 저장소 안에 고정 |
| `apps/web/package.json` | (수정) `test` 스크립트와 `engines` 추가 |
| `apps/web/tsconfig.json` | (수정) `allowImportingTsExtensions` |
| `apps/web/content/curriculum/types.ts` | `Exercise` · `Chapter` · `Curriculum` 타입과 `CHAPTER_SLOTS` 상수. 값 import 없음 |
| `apps/web/content/curriculum/validate.ts` | 커리큘럼 검사. 오류 메시지 배열을 돌려주는 순수 함수 |
| `apps/web/content/curriculum/validate.test.ts` | 위 함수의 테스트 |
| `apps/web/content/curriculum/grading.ts` | `isCorrect(answers, picked)`. 복수정답 집합 비교 |
| `apps/web/content/curriculum/grading.test.ts` | 위 함수의 테스트 |
| `apps/web/content/curriculum/buffett.ts` | 해자 집중형 5장 |
| `apps/web/content/curriculum/graham.ts` | 안전마진형 5장 |
| `apps/web/content/curriculum/lynch.ts` | 저평가 성장형 5장 |
| `apps/web/content/curriculum/index.ts` | `CURRICULA` · `CURRICULUM_BY_MASTER` · `chapterOf` + 로드 시점 검사 |
| `apps/web/content/masters.ts` | (수정) `quiz` 필드 제거. `QuizItem` 타입은 유지 |
| `apps/web/lib/store.ts` | (수정) 저널 저장·조회 3함수 추가 |
| `apps/web/components/ChapterExercises.tsx` | 챕터의 유일한 클라이언트 경계. 3계층 문항 렌더링과 진도 기록 |
| `apps/web/app/learn/masters/[slug]/[chapter]/page.tsx` | 챕터 본문 페이지. 15개 정적 경로 |
| `apps/web/app/learn/masters/[slug]/page.tsx` | (수정) 목차 페이지로 전환. `<Quiz>` 제거 |
| `apps/web/app/page.tsx` | (수정) 홈 카드 문구 |
| `apps/web/app/learn/page.tsx` | (수정) 장 수 표시 + 학습 순서 안내 |
| `apps/web/components/MyLearning.tsx` | (수정) 챕터 진도 집계 + 되돌아볼 기록 |
| `apps/web/app/globals.css` | (수정) 챕터·목차·문항 클래스 추가 |

`components/Quiz.tsx`는 건드리지 않는다. `content/chartLessons.ts`(4번 담당)가 계속 쓴다.

---

## Task 1: 원본 문서 반입 · 타입 · 버핏 커리큘럼 · 로드 시점 검사

이 과제가 검사 장치와 콘텐츠 형식을 동시에 확정한다. 검사를 먼저 만들고 실제 콘텐츠로 깨뜨려 본 뒤 고친다.

**Files:**
- Create: `docs/sources/investment-styles-curriculum.md`
- Modify: `apps/web/package.json` (`test` 스크립트, `engines`)
- Modify: `apps/web/tsconfig.json` (`allowImportingTsExtensions`)
- Create: `apps/web/content/curriculum/types.ts`
- Create: `apps/web/content/curriculum/validate.ts`
- Create: `apps/web/content/curriculum/buffett.ts`
- Create: `apps/web/content/curriculum/index.ts`
- Test: `apps/web/content/curriculum/validate.test.ts`

**Interfaces:**
- Produces:
  - `CHAPTER_SLOTS: readonly { no: number; slot: string; label: string; asks: string }[]` (길이 5)
  - `type Exercise = GradedExercise | GuidedExercise | JournalExercise`
  - `type Chapter = { title: string; lede: string; body: string[]; exercises: Exercise[] }`
  - `type Curriculum = { masterId: Master["id"]; sellType: string; sellTrigger: string; currency: string; chapters: [Chapter, Chapter, Chapter, Chapter, Chapter] }`
  - `curriculumProblems(curricula: Curriculum[]): string[]` — 문제를 찾으면 메시지 배열, 없으면 빈 배열
  - `CURRICULA: Curriculum[]`, `CURRICULUM_BY_MASTER: Record<Master["id"], Curriculum>`, `chapterOf(masterId: string, no: number): Chapter | undefined`

- [ ] **Step 1: 원본 문서를 저장소로 들여온다**

계획과 콘텐츠가 저장소 밖 경로(`C:\Users\Har10\Downloads\`)를 가리키면 다음 사람이 출처를 잃는다.

```bash
mkdir -p docs/sources
cp "/c/Users/Har10/Downloads/investment-styles-curriculum.md" docs/sources/investment-styles-curriculum.md
```

- [ ] **Step 2: 테스트 실행 환경을 연다**

`apps/web/package.json`의 `scripts`에 추가한다. 설치할 것은 없다 — `node:test`는 Node 내장이다.

```json
"test": "node --test \"content/**/*.test.ts\" \"lib/**/*.test.ts\"",
```

같은 파일에 `engines`를 추가한다. `.ts` 타입 스트리핑이 기본인 버전을 요구한다.

```json
"engines": { "node": ">=23" }
```

`apps/web/tsconfig.json`의 `compilerOptions`에 한 줄 추가한다. 테스트가 소스를 `./grading.ts`처럼 확장자까지 적어 가져오기 때문이고, `noEmit: true`라 켤 수 있다.

```json
"allowImportingTsExtensions": true,
```

- [ ] **Step 3: 타입 파일을 만든다**

`apps/web/content/curriculum/types.ts`:

```ts
import type { Master } from "../masters";   // 반드시 type import.
                                            // 값으로 가져오면 CHAPTER_SLOTS를 쓰는
                                            // 클라이언트 컴포넌트에 masters.ts 전체가 실린다

/** 일곱 스타일이 공유하는 다섯 칸. 챕터 배열의 위치가 곧 이 칸이다. */
export const CHAPTER_SLOTS = [
  { no: 1, slot: "premise", label: "전제", asks: "이 스타일은 시장에 대해 무엇을 가정하는가" },
  { no: 2, slot: "search", label: "탐색", asks: "무엇을, 어디서 찾는가" },
  { no: 3, slot: "verify", label: "검증", asks: "사기 전에 무엇을 확인하는가" },
  { no: 4, slot: "exit", label: "처분", asks: "언제까지 들고, 무엇이 팔게 하는가" },
  { no: 5, slot: "failure", label: "실패", asks: "이 스타일은 어떻게 무너지는가" },
] as const;

/** 즉시 정오와 풀이를 준다. answers가 배열인 것은 복수정답 문항이 있어서다. */
export type GradedExercise = {
  kind: "graded";
  prompt: string;
  choices: string[];
  answers: number[];
  explain: string;
};

/** 점수를 매기지 않는다. 먼저 써본 뒤 체크 포인트를 본다. */
export type GuidedExercise = {
  kind: "guided";
  prompt: string;
  checkpoints: string[];
};

/** 피드백이 없다. 저장했다가 90일 뒤 다시 묻는다. */
export type JournalExercise = {
  kind: "journal";
  prompt: string;
};

export type Exercise = GradedExercise | GuidedExercise | JournalExercise;

export type Chapter = {
  title: string;
  lede: string;
  body: string[];
  exercises: Exercise[];
};

export type Curriculum = {
  masterId: Master["id"];
  sellType: string;
  sellTrigger: string;
  currency: string;
  chapters: [Chapter, Chapter, Chapter, Chapter, Chapter];
};
```

- [ ] **Step 4: 검사 함수의 실패하는 테스트를 먼저 쓴다**

`apps/web/content/curriculum/validate.test.ts`:

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import type { Chapter, Curriculum } from "./types.ts";
import { curriculumProblems } from "./validate.ts";

function chapter(overrides: Partial<Chapter> = {}): Chapter {
  return {
    title: "제목",
    lede: "인용구",
    body: ["본문 한 단락."],
    exercises: [],
    ...overrides,
  };
}

function curriculum(first: Chapter): Curriculum {
  return {
    masterId: "buffett",
    sellType: "논거 붕괴형",
    sellTrigger: "해자 침식",
    currency: "학습 내용은 2026년 7월 기준입니다.",
    chapters: [first, chapter(), chapter(), chapter(), chapter()],
  };
}

test("멀쩡한 커리큘럼은 문제를 내지 않는다", () => {
  assert.deepEqual(curriculumProblems([curriculum(chapter())]), []);
});

test("정답 인덱스가 선택지 범위를 벗어나면 잡는다", () => {
  const problems = curriculumProblems([
    curriculum(
      chapter({
        exercises: [
          {
            kind: "graded",
            prompt: "질문",
            choices: ["가", "나"],
            answers: [5],
            explain: "해설",
          },
        ],
      }),
    ),
  ]);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /범위 밖/);
});

test("정답이 하나도 없으면 잡는다", () => {
  const problems = curriculumProblems([
    curriculum(
      chapter({
        exercises: [
          { kind: "graded", prompt: "질문", choices: ["가", "나"], answers: [], explain: "해설" },
        ],
      }),
    ),
  ]);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /정답이 지정되지/);
});

test("체크 포인트가 비면 잡는다", () => {
  const problems = curriculumProblems([
    curriculum(chapter({ exercises: [{ kind: "guided", prompt: "질문", checkpoints: [] }] })),
  ]);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /체크 포인트/);
});

test("본문이 비면 잡는다", () => {
  const problems = curriculumProblems([curriculum(chapter({ body: [] }))]);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /본문이 비어/);
});

test("권유형 표현을 잡는다", () => {
  const problems = curriculumProblems([
    curriculum(chapter({ body: ["이 종목은 지금 사야 합니다."] })),
  ]);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /권유형/);
});

test("문제를 전부 모아서 돌려준다 — 첫 개에서 멈추지 않는다", () => {
  const problems = curriculumProblems([
    curriculum(chapter({ body: [], exercises: [{ kind: "guided", prompt: "질문", checkpoints: [] }] })),
  ]);
  assert.equal(problems.length, 2);
});

test("어느 대가의 몇 장인지 메시지에 담는다", () => {
  const problems = curriculumProblems([curriculum(chapter({ body: [] }))]);
  assert.match(problems[0], /buffett 1장/);
});
```

- [ ] **Step 5: 테스트가 실패하는지 확인한다**

Run: `cd apps/web && npm test`

Expected: FAIL — `Cannot find module '.../content/curriculum/validate.ts'`

- [ ] **Step 6: 검사 함수를 구현한다**

`apps/web/content/curriculum/validate.ts`. 던지지 않고 **모아서 돌려준다.** 문제가 여러 개일 때 하나씩 고치며 빌드를 반복하는 것은 낭비다.

```ts
import type { Curriculum } from "./types.ts";

/** 사용자에게 보이는 문장에서 막는 표현.
 *  이 제품은 관찰과 확인 사항까지만 말한다. 권유하지 않는다. */
const BANNED = ["지금 사", "지금 파", "손절하", "추천합니다", "확실합니다", "보장합니다"];

/** 타입이 잡지 못하는 것만 본다. 문제를 전부 모아 메시지 배열로 돌려준다. */
export function curriculumProblems(curricula: Curriculum[]): string[] {
  const problems: string[] = [];

  for (const curriculum of curricula) {
    curriculum.chapters.forEach((chapter, index) => {
      const where = `${curriculum.masterId} ${index + 1}장`;

      if (chapter.body.length === 0) {
        problems.push(`${where}: 본문이 비어 있습니다.`);
      }

      const text = [chapter.title, chapter.lede, ...chapter.body].join(" ");
      for (const banned of BANNED) {
        if (text.includes(banned)) {
          problems.push(`${where}: 권유형 표현 '${banned}'가 본문에 있습니다.`);
        }
      }

      chapter.exercises.forEach((exercise, position) => {
        const at = `${where} ${position + 1}번 문항`;

        if (exercise.kind === "graded") {
          if (exercise.answers.length === 0) {
            problems.push(`${at}: 정답이 지정되지 않았습니다.`);
          }
          for (const answer of exercise.answers) {
            if (answer < 0 || answer >= exercise.choices.length) {
              // 범위 밖 인덱스는 조용히 오답을 정답으로 가르친다
              problems.push(
                `${at}: 정답 인덱스 ${answer}가 선택지 ${exercise.choices.length}개의 범위 밖입니다.`,
              );
            }
          }
        }

        if (exercise.kind === "guided" && exercise.checkpoints.length === 0) {
          problems.push(`${at}: 체크 포인트가 비어 있습니다.`);
        }
      });
    });
  }

  return problems;
}
```

- [ ] **Step 7: 테스트가 통과하는지 확인한다**

Run: `cd apps/web && npm test`

Expected: PASS — 8문항 전부

- [ ] **Step 8: index를 만든다**

`apps/web/content/curriculum/index.ts`:

```ts
import type { Master } from "../masters";
import { BUFFETT } from "./buffett";
import type { Chapter, Curriculum } from "./types";
import { curriculumProblems } from "./validate";

export * from "./types";

export const CURRICULA: Curriculum[] = [BUFFETT];

// 페이지가 전부 정적 생성이라 이 검사는 빌드에서 돈다. 건너뛸 수 없다.
const problems = curriculumProblems(CURRICULA);
if (problems.length > 0) {
  throw new Error(`커리큘럼에 문제가 있습니다:\n- ${problems.join("\n- ")}`);
}

export const CURRICULUM_BY_MASTER = Object.fromEntries(
  CURRICULA.map((c) => [c.masterId, c]),
) as Record<Master["id"], Curriculum>;

export function chapterOf(masterId: string, no: number): Chapter | undefined {
  return CURRICULUM_BY_MASTER[masterId as Master["id"]]?.chapters[no - 1];
}
```

`index.ts`는 Next가 번들하는 경로이므로 `@/` 없이 확장자 없는 상대 경로를 쓴다. 확장자를 적는 것은 Node가 직접 읽는 `*.test.ts`뿐이다.

- [ ] **Step 9: 버핏 커리큘럼을 쓴다 — 1장에 일부러 잘못된 정답 인덱스를 넣는다**

`apps/web/content/curriculum/buffett.ts`. 본문은 `docs/sources/investment-styles-curriculum.md`의 **`# C. 해자 집중형 · 버핏`** 절(C1~C5)에서 옮긴다.

전사 규칙:
- 문서의 `> 인용구` → `lede`
- 문서의 서술 문단 → `body` 배열. 한 단락 2~4문장을 넘기면 나눈다
- 문서의 `채점형` → `kind: "graded"`. `<details>풀이</details>`는 `explain`으로
- 문서의 `첨삭형` → `kind: "guided"`. `<details>체크 포인트</details>`의 "체크:" 항목들을 문장 단위로 쪼개 `checkpoints` 배열로
- 문서의 `기록형` → `kind: "journal"`
- `title`은 문서에 없으므로 아래 표대로 붙인다

| 장 | title |
|---|---|
| 1 전제 | 주식이 아니라 사업을 산다 |
| 2 탐색 | 이해 가능한 사업, 해자, 자본배분 |
| 3 검증 | 회계이익이 아니라 주주 몫의 현금 |
| 4 처분 | 논거가 깨질 때만 판다 |
| 5 실패 | 좋은 회사를 비싸게 사는 것 |

`masters.ts`의 기존 버핏 퀴즈 3문항을 아래 위치에 `graded`로 함께 넣는다. 문항·선택지·`explain`은 `masters.ts`에서 그대로 옮긴다.

| 기존 문항 | 넣을 장 |
|---|---|
| 해자의 뜻 | 2장 |
| 순이익이 아니라 잉여현금흐름을 보는 이유 | 3장 |
| 가격은 어떤 위치인가 | 5장 |

1장 전체를 아래대로 쓴다. **`answers: [9]`는 일부러 넣은 잘못된 값이다.** 다음 단계에서 검사가 이걸 잡는지 확인한다.

```ts
import type { Curriculum } from "./types";

export const BUFFETT: Curriculum = {
  masterId: "buffett",
  sellType: "논거 붕괴형",
  sellTrigger: "해자 침식",
  currency: "학습 내용은 2026년 7월 기준입니다.",
  chapters: [
    {
      title: "주식이 아니라 사업을 산다",
      lede: "주식은 사업의 지분이고, 판단은 능력범위 안에서만 유효하다.",
      body: [
        "티커가 아니라 회사의 일부를 산다. 그리고 그 회사가 10년 뒤 어떤 모습일지 그려지지 않으면 능력범위 밖이므로 판단 자체를 하지 않는다.",
        "능력범위는 원의 크기보다 경계의 선명함이 중요하다. 무엇을 모르는지 아는 것이 무엇을 아는지 아는 것보다 먼저다.",
      ],
      exercises: [
        {
          kind: "graded",
          prompt: "능력범위에 대한 설명으로 가장 알맞은 것은?",
          choices: [
            "아는 산업의 수가 많을수록 좋다",
            "원의 크기보다 경계가 선명한 것이 중요하다",
            "모든 산업을 공부하면 사라진다",
            "경력이 길어지면 자동으로 넓어진다",
          ],
          answers: [9],
          explain:
            "버핏이 강조한 것은 범위의 크기가 아니라 경계입니다. 자기가 판단할 수 없는 영역을 아는 것이 판단을 아예 하지 않게 해줍니다.",
        },
        {
          kind: "guided",
          prompt: "'이 회사를 통째로 이 값에 사겠는가'로 질문을 바꾸면 무엇이 달라집니까?",
          checkpoints: [
            "회수 기간, 경쟁 구도, 10년 뒤 모습 같은 질문이 자동으로 따라온다는 점을 짚었는가.",
            "'오를까'라는 질문은 필요한 정보가 무엇인지조차 알려주지 않는다는 대비를 세웠는가.",
          ],
        },
        {
          kind: "journal",
          prompt:
            "지난 3년간 실제로 돈을 쓴 제품 5개를 적고, 각 회사의 수익 구조를 두 문장으로 쓰세요.",
        },
      ],
    },
    // 2~5장은 위 전사 규칙과 title 표에 따라 문서 C2~C5에서 옮긴다
  ],
};
```

- [ ] **Step 10: 빌드를 돌려 검사가 잡는지 확인한다**

Run: `cd apps/web && npm run build`

Expected: FAIL. 다음 메시지가 나와야 한다.

```
Error: 커리큘럼에 문제가 있습니다:
- buffett 1장 1번 문항: 정답 인덱스 9가 선택지 4개의 범위 밖입니다.
```

Step 7에서 검사 함수 자체는 이미 테스트로 확인했다. 이 단계가 확인하는 것은 **배선**이다 — `index.ts`가 실제로 그 함수를 부르고, 빌드가 그 예외로 죽는가. 빌드가 통과하면 배선이 끊긴 것이다. `index.ts`가 실제로 `CURRICULA`를 순회하는지, 어느 페이지도 이 모듈을 import하지 않아 로드 자체가 안 되는 것은 아닌지 확인한다. **이 시점엔 아직 챕터 페이지가 없으므로 `index.ts`를 import하는 페이지가 없을 수 있다.** 그럴 경우 Task 6까지 이 검사가 돌지 않으므로, 확인을 위해 `app/learn/page.tsx`에 `import { CURRICULA } from "@/content/curriculum";`를 임시로 추가하고 빌드한 뒤 되돌린다.

- [ ] **Step 11: 정답 인덱스를 고치고 나머지 4개 장을 채운다**

`answers: [9]` → `answers: [1]`로 고친다. 그리고 2~5장을 문서 C2~C5에서 전사한다.

- [ ] **Step 12: 테스트와 빌드가 모두 통과하는지 확인한다**

Run: `cd apps/web && npm test && npm run build`

Expected: 테스트 8문항 PASS, 빌드 PASS. 아직 챕터 라우트가 없으므로 페이지 수는 기존과 같다.

- [ ] **Step 13: 커밋**

```bash
git add docs/sources/ apps/web/content/curriculum/ apps/web/package.json apps/web/tsconfig.json
git commit -F - <<'EOF'
버핏 커리큘럼과 콘텐츠 검사 추가

정답 인덱스가 선택지 범위를 벗어나면 조용히 오답을 정답으로 가르치게 된다.
타입으로는 잡히지 않으므로 따로 검사한다. index.ts가 모듈 로드 시점에 부르고,
페이지가 전부 정적 생성이라 이 검사는 빌드에서 돌고 건너뛸 수 없다.

검사 함수는 던지지 않고 문제를 모아 돌려준다. 문제가 여러 개일 때 하나씩
고치며 빌드를 반복하는 것은 낭비다.

테스트는 Node 내장 러너를 쓴다. node:test는 설치할 것이 없어서 이 저장소의
의존성 정책을 건드리지 않는다.

원본 문서를 docs/sources/로 들여와 콘텐츠의 출처를 저장소 안에 고정했다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
```

---

## Task 2: 그레이엄·린치 커리큘럼

검사 장치가 Task 1에서 확정됐으므로 여기는 전사 작업이다.

**Files:**
- Create: `apps/web/content/curriculum/graham.ts`
- Create: `apps/web/content/curriculum/lynch.ts`
- Modify: `apps/web/content/curriculum/index.ts` (CURRICULA 배열에 추가)

**Interfaces:**
- Consumes: `Curriculum` 타입 (Task 1)
- Produces: `GRAHAM: Curriculum`, `LYNCH: Curriculum`

- [ ] **Step 1: 그레이엄 커리큘럼을 쓴다**

`apps/web/content/curriculum/graham.ts`. 문서의 **`# A. 안전마진형 · 그레이엄`** 절(A1~A5)에서 Task 1의 전사 규칙 그대로 옮긴다.

```ts
masterId: "graham",
sellType: "가격 도달형",
sellTrigger: "가치에 닿거나 기한 만료",
currency: "학습 내용은 2026년 7월 기준입니다.",
```

title은 이렇게 붙인다.

| 장 | title |
|---|---|
| 1 전제 | 예측하지 않고, 틀려도 되는 가격에 산다 |
| 2 탐색 | 장부에서 찾는다 |
| 3 검증 | 싼 것과 죽어가는 것을 가른다 |
| 4 처분 | 제자리로 오면 판다 |
| 5 실패 | 싼 데는 이유가 있다 |

`masters.ts`의 기존 그레이엄 퀴즈 3문항을 `graded`로 함께 넣는다.

| 기존 문항 | 넣을 장 |
|---|---|
| 안전마진을 가장 잘 설명한 것은 | 1장 |
| 유동비율을 보는 이유 | 3장 |
| 가치함정에 해당하는 상황 | 5장 |

문서 A2의 NCAV 계산 문항은 계산 **결과**를 선택지로 만든다.

```ts
{
  kind: "graded",
  prompt:
    "유동자산 800억, 총부채 500억, 시가총액 180억인 회사가 있습니다. NCAV와 시총/NCAV 비율은 얼마이고, 3분의 2 기준을 통과합니까?",
  choices: [
    "NCAV 300억 · 비율 0.6 · 통과",
    "NCAV 300억 · 비율 1.67 · 불통과",
    "NCAV 1,300억 · 비율 0.14 · 통과",
    "NCAV 180억 · 비율 1.0 · 불통과",
  ],
  answers: [0],
  explain:
    "NCAV는 유동자산에서 총부채를 뺀 800 − 500 = 300억입니다. 비율은 180 ÷ 300 = 0.6이고, 그레이엄의 실무 기준인 3분의 2(0.67) 이하이므로 통과합니다.",
},
```

- [ ] **Step 2: 린치 커리큘럼을 쓴다**

`apps/web/content/curriculum/lynch.ts`. 문서의 **`# D. 저평가 성장형 · 린치`** 절(D1~D5)에서 옮긴다.

```ts
masterId: "lynch",
sellType: "스토리 종료형",
sellTrigger: "성장 종료 또는 사업 산만화",
currency: "학습 내용은 2026년 7월 기준입니다.",
```

| 장 | title |
|---|---|
| 1 전제 | 우위는 일상에 있다 |
| 2 탐색 | 여섯 유형으로 먼저 나눈다 |
| 3 검증 | 성장률 대비 가격, 재고와 매출채권 |
| 4 처분 | 스토리가 끝나면 판다 |
| 5 실패 | 성장 추정이 틀리면 전부 틀린다 |

| 기존 문항 | 넣을 장 |
|---|---|
| PER 24배인 두 회사 | 3장 |
| 이익은 늘었는데 매출이 제자리 | 3장 |
| 가장 크게 틀리는 상황 | 5장 |

문서 D3의 PEG 계산 문항도 결과를 선택지로 만든다.

```ts
{
  kind: "graded",
  prompt: "이익이 연 12%로 성장하는 회사의 PER이 36배입니다. PEG는 얼마이고 기준을 통과합니까?",
  choices: [
    "PEG 0.33 · 통과",
    "PEG 3.0 · 불통과",
    "PEG 24 · 불통과",
    "PEG 1.0 · 통과",
  ],
  answers: [1],
  explain:
    "PEG는 PER을 성장률로 나눈 36 ÷ 12 = 3.0입니다. 기준선 1을 크게 넘습니다. PEG가 1이 되려면 PER이 12배로 내려오거나 성장률이 36%가 되어야 합니다.",
},
```

- [ ] **Step 3: index에 두 커리큘럼을 등록한다**

```ts
import { BUFFETT } from "./buffett";
import { GRAHAM } from "./graham";
import { LYNCH } from "./lynch";

// MASTERS와 같은 순서. 목차 페이지와 스크리너가 이미 이 순서다
export const CURRICULA: Curriculum[] = [BUFFETT, GRAHAM, LYNCH];
```

- [ ] **Step 4: 검사가 세 커리큘럼을 모두 훑는지 확인한다**

`graham.ts`의 아무 `guided` 문항에서 `checkpoints`를 `[]`로 잠시 바꾼다.

Run: `cd apps/web && npm run build`

Expected: FAIL — 메시지에 `graham N장 M번 문항: 체크 포인트가 비어 있습니다.`가 들어 있어야 한다. `buffett`이 아니라 `graham`으로 나오는지 본다. 세 커리큘럼이 모두 `CURRICULA`에 등록됐는지를 이 한 줄이 말해준다.

확인했으면 되돌린다.

- [ ] **Step 5: 테스트와 빌드가 모두 통과하는지 확인한다**

Run: `cd apps/web && npm test && npm run build`

Expected: 둘 다 PASS

- [ ] **Step 6: 커밋**

```bash
git add apps/web/content/curriculum/
git commit -F - <<'EOF'
그레이엄·린치 커리큘럼 추가

세 대가가 같은 다섯 칸을 채우면 챕터 단위로 스타일을 견줄 수 있다.
같은 3장(검증)을 나란히 읽으면 안전마진과 PEG가 같은 질문에 대한
서로 다른 답이라는 것이 드러난다.

계산 문항은 계산 결과를 선택지로 만들었다. 숫자 입력 채점은 단위와
반올림 처리가 필요하고, 정답인데 오답으로 뜨면 학습자가 신뢰를 잃는다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
```

---

## Task 3: masters.ts에서 quiz 제거 · 홈과 학습 인덱스 문구

퀴즈가 챕터 안으로 들어갔으므로 `Master.quiz`를 걷어낸다. 이 필드를 쓰는 화면이 하나 있고, 지우면 빌드가 깨진다 — 그걸 먼저 확인한다.

**Files:**
- Modify: `apps/web/content/masters.ts` (`Master` 타입의 `quiz` 필드와 세 대가의 `quiz` 배열 삭제)
- Modify: `apps/web/app/page.tsx:56`
- Modify: `apps/web/app/learn/page.tsx`

**Interfaces:**
- Consumes: `CURRICULUM_BY_MASTER` (Task 1·2)
- Produces: `Master` 타입에서 `quiz` 제거. `QuizItem` 타입은 계속 export

- [ ] **Step 1: quiz를 지우고 빌드가 깨지는 것을 확인한다**

`apps/web/content/masters.ts`에서 지운다.

- `Master` 타입의 `quiz: QuizItem[];` 한 줄
- 세 대가 객체의 `quiz: [ ... ]` 블록 (버핏 62~99행, 그레이엄 141~178행, 린치 220~257행 부근)

`QuizItem` 타입 정의(1~6행)는 **남긴다.** `content/chartLessons.ts`가 import하고 있다.

Run: `cd apps/web && npm run build`

Expected: FAIL. 타입 오류가 `app/page.tsx`에서 나야 한다.

```
Type error: Property 'quiz' does not exist on type 'Master'.
```

- [ ] **Step 2: 홈 카드 문구를 고친다**

`apps/web/app/page.tsx:56`. 지금은 이렇다.

```tsx
{master.minutes}분 학습 · 기준 {master.principles.length}개 · 퀴즈 {master.quiz.length}문항
```

이렇게 바꾼다. 퀴즈가 챕터 안으로 들어갔으므로 홈에서 따로 셀 것이 아니다.

```tsx
기준 {master.principles.length}개 · {CURRICULUM_BY_MASTER[master.id].chapters.length}장
```

파일 상단에 import를 추가한다.

```tsx
import { CURRICULUM_BY_MASTER } from "@/content/curriculum";
```

`app/page.tsx`는 서버 컴포넌트이므로 커리큘럼을 import해도 브라우저 번들에 실리지 않는다.

- [ ] **Step 3: 학습 인덱스에 장 수와 학습 순서 안내를 넣는다**

`apps/web/app/learn/page.tsx`의 대가 카드에 장 수를 표시한다.

```tsx
import { CURRICULUM_BY_MASTER } from "@/content/curriculum";
```

카드 안 `oneLine` 아래에 한 줄 추가한다.

```tsx
<p className="mono" style={{ color: "var(--ink-faint)", margin: 0 }}>
  {CURRICULUM_BY_MASTER[m.id].chapters.length}장
</p>
```

그리고 대가 목록 위 설명 문단에 학습 순서를 안내한다. 문서가 제안한 순서(해자 집중형 → 안전마진형 → 저평가 성장형)를 그대로 쓴다.

```tsx
<p className="lede">
  순서대로 볼 것을 권합니다. 버핏에서 시작해 그레이엄으로 뿌리를 보고, 린치에서 분산과
  집중의 대조를 봅니다. 관심 있는 장만 골라 봐도 됩니다.
</p>
```

- [ ] **Step 4: 빌드가 통과하는지 확인한다**

Run: `cd apps/web && npm test && npm run build`

Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add apps/web/content/masters.ts apps/web/app/page.tsx apps/web/app/learn/page.tsx
git commit -F - <<'EOF'
대가 퀴즈를 챕터로 옮기고 masters.ts는 개요만 남김

퀴즈가 배운 내용 바로 옆에 있어야 확인이 된다. 다섯 원칙을 다 읽고 마지막에
세 문항을 푸는 구조는 어느 원칙을 놓쳤는지 알려주지 못했다.

QuizItem 타입은 남긴다. chartLessons.ts가 쓰고 있고 그 파일은 4번 영역이다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
```

---

## Task 4: 기록형 저장

**Files:**
- Modify: `apps/web/lib/store.ts` (파일 끝에 추가)

**Interfaces:**
- Produces:
  - `type JournalEntry = { id: string; prompt: string; text: string; at: string }`
  - `getJournal(): Promise<JournalEntry[]>`
  - `saveJournalEntry(id: string, prompt: string, text: string): Promise<JournalEntry>`
  - `dueJournalEntries(afterDays?: number): Promise<JournalEntry[]>`

- [ ] **Step 1: 저널 키를 추가한다**

`apps/web/lib/store.ts`의 `KEYS`에 한 줄 추가한다.

```ts
const KEYS = {
  watchlist: "wisor.watchlist",
  notes: "wisor.notes",
  progress: "wisor.progress",
  journal: "wisor.journal",
} as const;
```

- [ ] **Step 2: 저널 함수를 추가한다**

파일 끝에 붙인다. 기존 함수는 건드리지 않는다.

```ts
/* 기록형 답 */

export type JournalEntry = {
  /** "master:buffett:1#2" — 챕터 id + 문항 위치 */
  id: string;
  /** 질문을 답과 함께 저장한다. /me가 클라이언트 컴포넌트라서, 질문을
   *  커리큘럼에서 찾아오게 하면 챕터 본문 전체가 브라우저 번들에 실린다. */
  prompt: string;
  text: string;
  at: string;
};

export async function getJournal(): Promise<JournalEntry[]> {
  return read<JournalEntry[]>(KEYS.journal, []);
}

/** 같은 문항에 다시 쓰면 덮어쓰고 시각을 갱신한다. 되돌아본 것도 기록이다. */
export async function saveJournalEntry(
  id: string,
  prompt: string,
  text: string,
): Promise<JournalEntry> {
  const saved: JournalEntry = { id, prompt, text, at: new Date().toISOString() };
  const rest = (await getJournal()).filter((e) => e.id !== id);
  write(KEYS.journal, [saved, ...rest]);
  return saved;
}

/** 쓴 지 afterDays가 지난 기록. 문서의 '3개월 뒤 재노출'이 기본값이다. */
export async function dueJournalEntries(afterDays = 90): Promise<JournalEntry[]> {
  const cutoff = Date.now() - afterDays * 24 * 60 * 60 * 1000;
  return (await getJournal()).filter((e) => new Date(e.at).getTime() <= cutoff);
}
```

- [ ] **Step 3: 빌드가 통과하는지 확인한다**

Run: `cd apps/web && npm test && npm run build`

Expected: PASS

- [ ] **Step 4: 커밋**

```bash
git add apps/web/lib/store.ts
git commit -F - <<'EOF'
기록형 답 저장 추가

기록형 문항은 점수도 정답도 없고, 90일 뒤 같은 질문을 다시 던져 그때의
답과 지금의 답을 견주게 하는 장치다. 그러려면 답이 남아 있어야 한다.

질문을 답과 함께 저장한다. /me가 클라이언트 컴포넌트라서 질문을 커리큘럼에서
찾아오게 하면 챕터 본문 전체가 브라우저 번들에 실린다.

2번 리뷰 필요: lib/store.ts는 Supabase 교체 지점이다. 기존 함수는 건드리지
않고 추가만 했다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
```

---

## Task 5: ChapterExercises 컴포넌트

**Files:**
- Create: `apps/web/content/curriculum/grading.ts`
- Create: `apps/web/components/ChapterExercises.tsx`
- Modify: `apps/web/app/globals.css` (`.checkpoints` 추가)
- Test: `apps/web/content/curriculum/grading.test.ts`

**Interfaces:**
- Consumes: `Exercise` (Task 1), `markLessonDone` · `recordQuiz` · `saveJournalEntry` (Task 4 및 기존 store)
- Produces: `isCorrect(answers: number[], picked: number[]): boolean`, `<ChapterExercises chapterId={string} exercises={Exercise[]} />`

- [ ] **Step 1: 채점 함수의 실패하는 테스트를 먼저 쓴다**

복수정답 비교는 순서에 흔들리기 쉽고 틀리면 조용히 오답 처리한다. 컴포넌트 밖으로 빼서 테스트한다.

`apps/web/content/curriculum/grading.test.ts`:

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { isCorrect } from "./grading.ts";

test("단일 정답을 맞히면 참", () => {
  assert.equal(isCorrect([1], [1]), true);
});

test("단일 정답을 틀리면 거짓", () => {
  assert.equal(isCorrect([1], [2]), false);
});

test("복수 정답은 고른 순서와 무관하다", () => {
  assert.equal(isCorrect([1, 3], [3, 1]), true);
});

test("복수 정답 중 일부만 고르면 거짓", () => {
  assert.equal(isCorrect([1, 3], [1]), false);
});

test("정답에 오답을 더해 고르면 거짓", () => {
  assert.equal(isCorrect([1, 3], [1, 3, 0]), false);
});

test("아무것도 고르지 않으면 거짓", () => {
  assert.equal(isCorrect([1], []), false);
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `cd apps/web && npm test`

Expected: FAIL — `Cannot find module '.../content/curriculum/grading.ts'`

- [ ] **Step 3: 채점 함수를 구현한다**

`apps/web/content/curriculum/grading.ts`:

```ts
/** 고른 것과 정답이 집합으로 같은지 본다. 고른 순서는 보지 않는다. */
export function isCorrect(answers: number[], picked: number[]): boolean {
  return answers.length === picked.length && answers.every((a) => picked.includes(a));
}
```

- [ ] **Step 4: 테스트가 통과하는지 확인한다**

Run: `cd apps/web && npm test`

Expected: PASS — 검사 8문항 + 채점 6문항

- [ ] **Step 5: 컴포넌트를 만든다**

`apps/web/components/ChapterExercises.tsx`:

```tsx
"use client";

import { useState } from "react";
import { isCorrect } from "@/content/curriculum/grading";
import type { Exercise } from "@/content/curriculum/types";
import { markLessonDone, recordQuiz, saveJournalEntry } from "@/lib/store";

/** 챕터의 유일한 클라이언트 경계.
 *
 *  진도와 점수를 나눠 기록한다. 열다섯 장 중 여섯 장에 채점형 문항이 아예
 *  없어서, 채점 제출에만 진도를 걸면 그 장들이 영원히 미완으로 남는다.
 */
export default function ChapterExercises({
  chapterId,
  exercises,
}: {
  chapterId: string;
  exercises: Exercise[];
}) {
  const [done, setDone] = useState<boolean[]>(exercises.map(() => false));
  const [picks, setPicks] = useState<number[][]>(exercises.map(() => []));
  const [texts, setTexts] = useState<string[]>(exercises.map(() => ""));

  function toggle(index: number, choice: number, multiple: boolean) {
    if (done[index]) return;
    setPicks((prev) =>
      prev.map((p, i) => {
        if (i !== index) return p;
        if (!multiple) return [choice];
        return p.includes(choice) ? p.filter((c) => c !== choice) : [...p, choice];
      }),
    );
  }

  async function finish(index: number) {
    const next = done.map((d, i) => (i === index ? true : d));
    setDone(next);

    const exercise = exercises[index];
    if (exercise.kind === "journal") {
      await saveJournalEntry(`${chapterId}#${index}`, exercise.prompt, texts[index]);
    }

    if (!next.every(Boolean)) return;

    // 모든 문항을 처리했다. 채점형 유무와 무관하게 진도를 남긴다.
    await markLessonDone(chapterId);

    const graded = exercises
      .map((e, i) => ({ e, i }))
      .filter((x): x is { e: Extract<Exercise, { kind: "graded" }>; i: number } =>
        x.e.kind === "graded",
      );

    if (graded.length > 0) {
      const correct = graded.filter(({ e, i }) => isCorrect(e.answers, picks[i])).length;
      await recordQuiz(chapterId, correct, graded.length);
    }
  }

  return (
    <section className="stack">
      {exercises.map((exercise, index) => (
        <div key={index} className="card">
          {exercise.kind === "graded" && (
            <Graded
              exercise={exercise}
              picked={picks[index]}
              submitted={done[index]}
              onPick={(choice) => toggle(index, choice, exercise.answers.length > 1)}
              onSubmit={() => void finish(index)}
            />
          )}
          {exercise.kind === "guided" && (
            <Guided
              exercise={exercise}
              text={texts[index]}
              revealed={done[index]}
              onChange={(v) => setTexts((prev) => prev.map((t, i) => (i === index ? v : t)))}
              onSubmit={() => void finish(index)}
            />
          )}
          {exercise.kind === "journal" && (
            <Journal
              exercise={exercise}
              text={texts[index]}
              saved={done[index]}
              onChange={(v) => setTexts((prev) => prev.map((t, i) => (i === index ? v : t)))}
              onSubmit={() => void finish(index)}
            />
          )}
        </div>
      ))}
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
        {exercise.choices.map((choice, ci) => {
          let state: string | undefined;
          if (submitted) {
            if (exercise.answers.includes(ci) && picked.includes(ci)) state = "correct";
            else if (picked.includes(ci)) state = "wrong";
            else if (exercise.answers.includes(ci)) state = "missed";
          } else if (picked.includes(ci)) {
            state = "correct";
          }
          return (
            <button
              key={ci}
              type="button"
              className="choice"
              data-state={state}
              aria-pressed={picked.includes(ci)}
              onClick={() => onPick(ci)}
            >
              <span className="mono">{String.fromCharCode(65 + ci)}</span>
              <span>{choice}</span>
            </button>
          );
        })}
      </div>
      {submitted ? (
        <p style={{ fontSize: "0.88rem", color: "var(--ink-soft)", marginBottom: 0 }}>
          {exercise.explain}
        </p>
      ) : (
        <button
          type="button"
          className="btn"
          disabled={picked.length === 0}
          onClick={onSubmit}
        >
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
          onChange={(e) => onChange(e.target.value)}
          disabled={revealed}
        />
      </label>
      {revealed ? (
        <div className="checkpoints">
          <p className="eyebrow">체크 포인트</p>
          <ul className="reason-list">
            {exercise.checkpoints.map((point, i) => (
              <li key={i} data-kind="pass">
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
          onChange={(e) => onChange(e.target.value)}
          disabled={saved}
        />
      </label>
      {saved ? (
        <p style={{ fontSize: "0.88rem", color: "var(--ink-soft)", marginBottom: 0 }}>
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
```

`guided`와 `journal` 모두 입력이 비면 버튼이 비활성이다. 먼저 써보지 않고 체크 포인트를 보면 배우는 것이 없고, 빈 기록을 90일 뒤 다시 보여줄 이유도 없다.

- [ ] **Step 6: CSS를 추가한다**

`apps/web/app/globals.css` 끝에 붙인다.

```css
/* ---------- 커리큘럼 문항 ---------- */

.checkpoints {
  margin-top: 1rem;
  padding: 1rem 1.1rem;
  background: var(--plum-soft);
  border-radius: var(--radius);
}

.checkpoints .eyebrow {
  color: var(--plum-deep);
}

.checkpoints .reason-list {
  margin-bottom: 0;
}
```

- [ ] **Step 7: 빌드가 통과하는지 확인한다**

Run: `cd apps/web && npm test && npm run build`

Expected: 둘 다 PASS. 아직 이 컴포넌트를 쓰는 페이지가 없으므로 페이지 수는 그대로다.

- [ ] **Step 8: 커밋**

```bash
git add apps/web/content/curriculum/grading.ts apps/web/content/curriculum/grading.test.ts apps/web/components/ChapterExercises.tsx apps/web/app/globals.css
git commit -F - <<'EOF'
챕터 문항 컴포넌트 추가

진도와 점수를 나눠 기록한다. 열다섯 장 중 여섯 장에 채점형 문항이 아예 없어서,
채점 제출에만 진도를 걸면 그 장들이 영원히 미완으로 남는다. 모든 문항을 처리하면
markLessonDone을 부르고, 채점형이 있는 장만 추가로 점수를 남긴다.

첨삭형과 기록형은 입력이 비면 버튼이 잠긴다. 먼저 써보지 않고 답을 보면
배우는 것이 없다.

복수정답 비교는 컴포넌트 밖으로 뺐다. 순서에 흔들리기 쉽고 틀리면 조용히
오답 처리하는데, 렌더링 안에 있으면 확인할 방법이 없다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
```

---

## Task 6: 챕터 라우트와 목차 페이지

**Files:**
- Create: `apps/web/app/learn/masters/[slug]/[chapter]/page.tsx`
- Modify: `apps/web/app/learn/masters/[slug]/page.tsx`
- Modify: `apps/web/app/globals.css`

**Interfaces:**
- Consumes: `CURRICULA` · `CURRICULUM_BY_MASTER` · `chapterOf` · `CHAPTER_SLOTS` (Task 1·2), `<ChapterExercises>` (Task 5)

- [ ] **Step 1: 챕터 페이지를 만든다**

`apps/web/app/learn/masters/[slug]/[chapter]/page.tsx`:

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import ChapterExercises from "@/components/ChapterExercises";
import { CHAPTER_SLOTS, CURRICULA, CURRICULUM_BY_MASTER, chapterOf } from "@/content/curriculum";
import { MASTER_BY_ID, type Master } from "@/content/masters";

export function generateStaticParams() {
  return CURRICULA.flatMap((curriculum) =>
    curriculum.chapters.map((_, index) => ({
      slug: curriculum.masterId,
      chapter: String(index + 1),
    })),
  );
}

export default async function ChapterPage({
  params,
}: {
  params: Promise<{ slug: string; chapter: string }>;
}) {
  const { slug, chapter: chapterParam } = await params;
  const master = MASTER_BY_ID[slug as Master["id"]];
  const no = Number(chapterParam);
  const chapter = chapterOf(slug, no);

  if (!master || !Number.isInteger(no) || !chapter) notFound();

  const curriculum = CURRICULUM_BY_MASTER[master.id];
  const slot = CHAPTER_SLOTS[no - 1];
  const previous = no > 1 ? CHAPTER_SLOTS[no - 2] : undefined;
  const next = no < CHAPTER_SLOTS.length ? CHAPTER_SLOTS[no] : undefined;

  return (
    <div className="wrap wrap-narrow" style={{ paddingBlock: "3.5rem 5rem" }}>
      <p className="eyebrow">
        {master.name} · {slot.no}장 {slot.label} / {curriculum.chapters.length}
      </p>

      <div
        className="chapter-progress"
        aria-label={`${curriculum.chapters.length}장 중 ${slot.no}장`}
      >
        {CHAPTER_SLOTS.map((s) => (
          <span
            key={s.no}
            data-state={s.no < slot.no ? "done" : s.no === slot.no ? "current" : undefined}
          />
        ))}
      </div>

      <h1 className="chapter-title">{chapter.title}</h1>
      <p className="chapter-lede">{chapter.lede}</p>
      <p className="lede">{slot.asks}</p>

      <div className="prose">
        {chapter.body.map((paragraph, i) => (
          <p key={i}>{paragraph}</p>
        ))}
      </div>

      <hr className="rule" />

      <ChapterExercises
        chapterId={`master:${master.id}:${slot.no}`}
        exercises={chapter.exercises}
      />

      <nav className="chapter-nav" aria-label="장 이동">
        <div>
          {previous ? (
            <Link href={`/learn/masters/${master.id}/${previous.no}`} className="card card-link">
              <p className="eyebrow">이전 장</p>
              <strong>
                {previous.no}장 {previous.label}
              </strong>
            </Link>
          ) : (
            <Link href={`/learn/masters/${master.id}`} className="card card-link">
              <p className="eyebrow">목차</p>
              <strong>{master.name} 전체 보기</strong>
            </Link>
          )}
        </div>
        <div>
          {next ? (
            <Link href={`/learn/masters/${master.id}/${next.no}`} className="card card-link">
              <p className="eyebrow">다음 장</p>
              <strong>
                {next.no}장 {next.label}
              </strong>
            </Link>
          ) : (
            <Link href={`/screener/${master.id}`} className="card card-link">
              <p className="eyebrow">다음 단계</p>
              <strong>이 기준으로 종목 보기</strong>
            </Link>
          )}
        </div>
      </nav>

      <p className="disclaimer">{curriculum.currency}</p>
    </div>
  );
}
```

이전·다음 링크에 `CHAPTER_SLOTS`의 칸 이름을 쓰는 이유는, 챕터 제목보다 "3장 검증"이 어디로 가는지를 더 정확히 알려주기 때문이다.

- [ ] **Step 2: 목차 페이지로 바꾼다**

`apps/web/app/learn/masters/[slug]/page.tsx`에서 `<Quiz>` 블록과 그 import를 제거하고, "이 스타일이 던지는 질문" 절 앞에 목차를 넣는다.

```tsx
import { CHAPTER_SLOTS, CURRICULUM_BY_MASTER } from "@/content/curriculum";
```

`<hr className="rule" />` 다음에 넣는다.

```tsx
<h2 className="section">목차</h2>
<p className="lede">
  한 장은 3~5분이면 읽고 문항까지 끝납니다. 순서대로 보는 것을 권하지만 관심 있는 장만
  골라 봐도 됩니다.
</p>

<div className="toc">
  {curriculum.chapters.map((chapter, index) => {
    const slot = CHAPTER_SLOTS[index];
    return (
      <Link
        key={slot.no}
        href={`/learn/masters/${master.id}/${slot.no}`}
        className="toc-item"
      >
        <span className="toc-no">{String(slot.no).padStart(2, "0")}</span>
        <span>
          <span className="toc-title">{chapter.title}</span>
          <span className="toc-question">{slot.asks}</span>
        </span>
        <span className="toc-slot">{slot.label}</span>
      </Link>
    );
  })}
</div>

<p className="disclaimer">
  이 스타일의 매도 조건 — {curriculum.sellType} · {curriculum.sellTrigger}
</p>
```

`const curriculum = CURRICULUM_BY_MASTER[master.id];`를 `const { scored } = ranked(master.id);` 아래에 추가한다.

기존 퀴즈 블록(대략 "확인해보기" eyebrow부터 `<Quiz ... />`와 그 뒤 `<hr className="rule" />`까지)을 지운다.

- [ ] **Step 3: CSS를 추가한다**

`apps/web/app/globals.css` 끝에 붙인다.

```css
/* ---------- 커리큘럼 챕터 ---------- */

.chapter-progress {
  display: flex;
  gap: 3px;
  margin: 1.25rem 0 1.75rem;
}

.chapter-progress span {
  flex: 1;
  height: 3px;
  border-radius: 1px;
  background: var(--line);
}

.chapter-progress span[data-state="done"] {
  background: var(--plum-line);
}

.chapter-progress span[data-state="current"] {
  background: var(--plum);
}

.chapter-title {
  font-family: var(--serif);
  font-size: clamp(1.8rem, 4vw, 2.5rem);
  font-weight: 400;
  line-height: 1.3;
  letter-spacing: -0.01em;
  margin: 0 0 0.75rem;
}

.chapter-lede {
  font-family: var(--serif);
  font-size: 1.15rem;
  color: var(--plum);
  margin: 0 0 1.5rem;
  padding-left: 1rem;
  border-left: 2px solid var(--plum-line);
}

/* 본문은 읽기 편한 폭과 줄간격을 우선한다 */
.prose p {
  font-size: 1.03rem;
  line-height: 1.9;
  margin: 0 0 1.5rem;
  max-width: 40em;
}

.prose p:last-child {
  margin-bottom: 0;
}

.chapter-nav {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-top: 3rem;
}

/* 목차 */

.toc {
  border-top: 1px solid var(--line);
}

.toc-item {
  display: grid;
  grid-template-columns: 2.5rem 1fr auto;
  gap: 1rem;
  align-items: baseline;
  padding: 1.1rem 0.5rem 1.1rem 0;
  border-bottom: 1px solid var(--line);
  transition: background 0.12s ease;
}

.toc-item:hover {
  background: var(--surface);
}

.toc-no {
  font-family: var(--mono);
  font-size: 0.78rem;
  color: var(--ink-faint);
}

.toc-title {
  font-weight: 600;
}

.toc-question {
  display: block;
  font-size: 0.88rem;
  color: var(--ink-soft);
  font-weight: 400;
  margin-top: 0.15rem;
}

.toc-slot {
  font-family: var(--mono);
  font-size: 0.72rem;
  color: var(--ink-faint);
  white-space: nowrap;
}

@media (max-width: 640px) {
  .chapter-nav {
    grid-template-columns: 1fr;
  }

  .toc-item {
    grid-template-columns: 2rem 1fr;
  }

  .toc-slot {
    display: none;
  }
}
```

여기서 쓰는 토큰과 클래스는 모두 이미 있다 — `--ink-faint`(15행) · `--plum-line` · `--plum-soft` · `--line` · `--surface` · `--serif` · `--mono` · `--radius`(33행) · `.disclaimer`(569행). 새 토큰을 만들지 않는다.

- [ ] **Step 4: 빌드에서 15개 챕터 경로가 생기는지 확인한다**

Run: `cd apps/web && npm test && npm run build`

Expected: PASS. 라우트 목록에 다음이 나와야 한다.

```
● /learn/masters/[slug]/[chapter]
  ├ /learn/masters/buffett/1
  ├ /learn/masters/buffett/2
  ├ /learn/masters/buffett/3
  └ [+12 more paths]
```

총 정적 페이지 수가 30에서 45로 늘어난다.

- [ ] **Step 5: 클라이언트 번들에 재무데이터가 실리지 않았는지 확인한다**

Run: `cd apps/web && grep -rl "evEbitMedian5y" .next/static/`

Expected: 아무것도 출력되지 않는다. 출력되면 어딘가의 클라이언트 컴포넌트가 `lib/scores.ts`를 import한 것이다.

- [ ] **Step 6: 손으로 확인한다**

```bash
cd apps/web && npm run dev
```

`http://localhost:3000/learn/masters/buffett/1`에서 본다.

- 375px 폭에서 레이아웃이 깨지지 않는가
- 키보드 Tab만으로 선택지·버튼·textarea에 모두 닿는가
- 채점형에서 답을 고르고 "답 확인하기"를 누르면 정오 표시와 해설이 나오는가
- 복수 정답 문항(버핏 2장 해자 문항)에서 두 개를 고를 수 있는가
- 첨삭형에서 입력 전에는 버튼이 잠겨 있는가
- 마지막 문항까지 처리한 뒤 `/me`에서 진도가 1장 늘었는가

- [ ] **Step 7: 커밋**

```bash
git add apps/web/app/learn/masters/ apps/web/app/globals.css
git commit -F - <<'EOF'
챕터 라우트와 목차 페이지 추가

한 번에 다섯 원칙을 쏟아붓는 대신 한 장씩 읽고 그 자리에서 확인하게 한다.
이전·다음 링크에 챕터 제목이 아니라 칸 이름(3장 검증)을 쓰는 이유는,
다른 스타일의 같은 장을 찾아갈 때 그쪽이 정확하기 때문이다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
```

---

## Task 7: 내 학습의 챕터 진도와 되돌아볼 기록

**Files:**
- Modify: `apps/web/components/MyLearning.tsx`

**Interfaces:**
- Consumes: `CHAPTER_SLOTS` (Task 1), `dueJournalEntries` · `saveJournalEntry` · `JournalEntry` (Task 4)

- [ ] **Step 1: 챕터 진도 집계로 바꾼다**

`apps/web/components/MyLearning.tsx`에서 대가 학습 카드가 지금 `MASTERS.filter(...)`로 3개 중 몇 개를 센다. 15장 중 몇 장으로 바꾼다.

```tsx
import { CHAPTER_SLOTS } from "@/content/curriculum/types";
import { MASTERS, MASTER_BY_ID } from "@/content/masters";
```

`types.ts`에서 직접 가져온다. `content/curriculum/index.ts`를 가져오면 챕터 본문 전체가 클라이언트 번들에 실린다.

```tsx
const totalChapters = MASTERS.length * CHAPTER_SLOTS.length;
// "master:buffett:3" 형태만 센다. 차트 단원은 "chart:candle-basics"라 2단이다
const chaptersDone = progress.lessonsDone.filter((id) => id.split(":").length === 3).length;
```

카드 문구를 바꾼다.

```tsx
<p className="eyebrow">투자 대가 챕터</p>
<p className="score-value">
  {chaptersDone}
  <span className="score-of"> / {totalChapters}</span>
</p>
```

- [ ] **Step 2: 퀴즈 결과 라벨을 챕터 단위로 바꾼다**

지금 `id.split(":")`가 2단을 가정한다. 3단을 처리한다.

```tsx
const [kind, key, no] = id.split(":");
let label: string | undefined;
if (kind === "master") {
  const name = MASTER_BY_ID[key as keyof typeof MASTER_BY_ID]?.name.split(" · ")[0];
  const slot = no ? CHAPTER_SLOTS[Number(no) - 1] : undefined;
  label = slot ? `${name} ${slot.no}장 · ${slot.label}` : name;
} else {
  label = LESSON_BY_ID[key]?.title;
}
```

- [ ] **Step 3: 되돌아볼 기록 섹션을 추가한다**

상태와 로딩을 추가한다.

```tsx
import { dueJournalEntries, saveJournalEntry, type JournalEntry } from "@/lib/store";

const [due, setDue] = useState<JournalEntry[]>([]);
const [drafts, setDrafts] = useState<Record<string, string>>({});
```

기존 `useEffect`의 로딩 함수에 한 줄 더한다.

```tsx
setDue(await dueJournalEntries());
```

학습노트 섹션 앞에 넣는다.

```tsx
{due.length > 0 && (
  <>
    <hr className="rule" />
    <p className="eyebrow">되돌아볼 기록</p>
    <h2 className="section">90일 전에 쓴 답입니다</h2>
    <p className="lede">
      그때의 답과 지금의 생각이 다르면, 무엇이 바뀌었는지가 배운 것입니다.
    </p>
    <div className="stack">
      {due.map((entry) => (
        <div key={entry.id} className="card">
          <h3 className="sub">{entry.prompt}</h3>
          <p style={{ fontSize: "0.9rem", color: "var(--ink-soft)" }}>
            {entry.at.slice(0, 10)}에 쓴 답 — {entry.text}
          </p>
          <label className="field">
            <span>지금의 답</span>
            <textarea
              rows={3}
              value={drafts[entry.id] ?? ""}
              onChange={(e) =>
                setDrafts((prev) => ({ ...prev, [entry.id]: e.target.value }))
              }
            />
          </label>
          <button
            type="button"
            className="btn"
            disabled={(drafts[entry.id] ?? "").trim() === ""}
            onClick={() => {
              void saveJournalEntry(entry.id, entry.prompt, drafts[entry.id]).then(async () =>
                setDue(await dueJournalEntries()),
              );
            }}
          >
            기록하기
          </button>
        </div>
      ))}
    </div>
  </>
)}
```

다시 쓰면 `saveJournalEntry`가 시각을 갱신하므로 목록에서 빠진다. 버튼 이름은 챕터에서 쓴 것과 같은 "기록하기"로 둔다.

- [ ] **Step 4: 빌드가 통과하는지 확인한다**

Run: `cd apps/web && npm test && npm run build`

Expected: PASS

- [ ] **Step 5: 되돌아볼 기록이 실제로 뜨는지 확인한다**

90일을 기다릴 수 없으므로 브라우저 콘솔에서 저장된 시각을 과거로 바꾼다.

```js
const j = JSON.parse(localStorage.getItem("wisor.journal"));
j[0].at = "2026-01-01T00:00:00.000Z";
localStorage.setItem("wisor.journal", JSON.stringify(j));
location.reload();
```

`/me`에 "되돌아볼 기록"이 뜨고, 지금의 답을 쓰고 "기록하기"를 누르면 목록에서 사라져야 한다.

- [ ] **Step 6: 커밋**

```bash
git add apps/web/components/MyLearning.tsx
git commit -F - <<'EOF'
내 학습에 챕터 진도와 되돌아볼 기록 추가

대가 3명 중 몇 명이 아니라 15장 중 몇 장을 센다. 진도가 장 단위여야
어디까지 왔는지가 보인다.

기록형 답은 90일이 지나면 다시 묻는다. 그때의 답과 지금의 생각이 다르면
무엇이 바뀌었는지가 배운 것이고, 같으면 그것도 답이다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
```

---

## Self-Review

**1. 스펙 커버리지**

| 스펙 요구 | 과제 |
|---|---|
| 커리큘럼·문항 타입 설계 | Task 1 |
| 챕터 5장 × 3명 본문 + 문항 39개 | Task 1·2 |
| 기존 퀴즈 9문항 재배치 (표대로) | Task 1·2 |
| `Master.quiz` 제거, `QuizItem` 유지 | Task 3 |
| `app/page.tsx` 홈 카드 문구 | Task 3 |
| `app/learn/page.tsx` 학습 순서 안내 | Task 3 |
| 저널 저장 3함수 | Task 4 |
| 채점형(복수정답)·첨삭형·기록형 컴포넌트 | Task 5 |
| 진도와 점수 분리 (`markLessonDone`) | Task 5 |
| 챕터 라우트 15경로 | Task 6 |
| 목차 페이지 + 매도 조건 노출 | Task 6 |
| 로드 시점 검사 (인덱스 범위·빈 배열·권유형 표현) | Task 1 |
| 검사 함수 단위 테스트 8문항 | Task 1 |
| 복수정답 채점 단위 테스트 6문항 | Task 5 |
| Node 내장 테스트 실행 환경 (`npm test` · `engines` · `allowImportingTsExtensions`) | Task 1 |
| 클라이언트 번들 경계 확인 | Task 6 Step 5 |
| `/me` 챕터 진도 + 되돌아볼 기록 | Task 7 |
| 375px·키보드 확인 | Task 6 Step 6 |

빠진 항목 없음.

**2. 타입 일관성**

- `CHAPTER_SLOTS`는 Task 1에서 정의하고 Task 5(간접)·6·7에서 쓴다. Task 7은 `content/curriculum/types.ts`에서 직접 가져와 클라이언트 번들 경계를 지킨다
- `chapterOf(masterId, no)`는 1-기반 `no`를 받아 `chapters[no - 1]`을 돌려준다. Task 6이 같은 규약으로 부른다
- 진도 id는 `master:<대가>:<장>`, 저널 id는 `master:<대가>:<장>#<문항위치>`로 Task 5·7에서 일치한다
- `saveJournalEntry(id, prompt, text)` 시그니처가 Task 4·5·7에서 같다
- `Exercise`의 판별자는 `kind`로 Task 1·5에서 일치한다

**3. 남은 위험**

- 테스트는 순수 함수만 덮는다. `ChapterExercises`의 렌더링과 상태 전이(모든 문항을 처리한 뒤 `markLessonDone`이 불리는가)는 DOM 환경이 필요해 자동 검증하지 않는다. Task 6 Step 6의 손 확인이 그 자리를 메운다
- `npm test`는 Node 23+의 `.ts` 타입 스트리핑에 기댄다. `engines`에 적어 두었지만 강제되지는 않는다. 낮은 버전에서는 테스트만 실패하고 빌드는 정상 동작한다
- Task 1 Step 10의 red 확인은 `index.ts`를 import하는 페이지가 있어야 성립한다. Task 6까지는 그런 페이지가 없으므로 임시 import로 확인하는 방법을 단계 안에 적어 두었다
- 콘텐츠 전사(Task 1 Step 11, Task 2 Step 1·2)는 분량이 가장 큰 단계다. 문서의 사실관계 문장(프리시전 캐스트파츠, 2023~24년 애플 매도, 버크셔의 보험 플로트)은 확인 없이 고치지 않는다. 틀린 사실이 문항의 정답이 되면 잘못된 지식을 가르치게 된다
