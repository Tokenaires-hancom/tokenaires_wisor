# 챕터 핵심 블록과 각주 대상 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 35개 학습 장마다 그 장의 뼈대를 담는 블록을 하나씩 세우고, 본문 문단에 걸리지 않던 각주 8개를 문항·매도 유형으로 옮긴다.

**Architecture:** `Chapter`에 `highlight` 필드를 새로 두고 `body: string[]`과 각주의 `paragraph` 인덱스는 전혀 건드리지 않는다. 강조는 본문 밖 별도 필드이므로 이 저장소에서 가장 깨지기 쉬운 문단 인덱스 결합을 아예 만들지 않는다. 각주는 기존 `paragraph`를 유지한 채 `on` 필드를 더하기만 한다.

**Tech Stack:** Next.js 15 App Router · React 19 · TypeScript strict · 순수 CSS · `node --test`(Node 23 타입 스트리핑). 새 의존성을 추가하지 않는다.

**설계 문서:** `docs/superpowers/specs/2026-08-13-chapter-highlight-design.md`

## Global Constraints

- **본문 문자열을 고치지 않는다.** `body` 배열의 원소 수도, 그 안의 문장도 그대로 둔다.
- **각주 114개의 기존 `paragraph` 값을 건드리지 않는다.** `choices` 배열의 순서도 바꾸지 않는다(`answers`가 인덱스로 가리킨다).
- 색은 `app/globals.css`의 CSS 변수만 쓴다. 하드코딩한 hex를 새로 넣지 않는다.
- **빨강·초록 금지.** 강조는 `--gold` 계열을 쓰고, 색만으로 구분하지 않는다. 형태(테두리·상단 실선)가 먼저 구분한다.
- 사용자에게 보이는 문장은 관찰과 확인 사항까지만 쓴다. `validate.ts`의 `BANNED` 배열이 실행되는 코드다: `["지금 사", "지금 파", "손절하", "추천합니다", "확실합니다", "보장합니다"]`.
- 클라이언트 컴포넌트에서 `lib/scores.ts`를 import하지 않는다.
- `components/`는 하위 디렉터리 없이 평평하다. 새 컴포넌트도 평평하게 둔다.
- 각 태스크는 `cd apps/web && npm test`가 통과한 상태로 끝난다. `content/curriculum/index.ts`가 모듈 로드 시점에 `curriculumProblems`를 돌려 throw하므로, validate 실패는 테스트뿐 아니라 빌드도 막는다.
- 커밋 메시지는 `type: 설명` 형식에 한국어 한 줄. 무엇이 아니라 **왜**를 쓴다.

## 설계 문서에서 바꾼 두 가지

실행 가능성 때문에 스펙과 다르게 가는 지점이다. 리뷰에서 되돌릴 수 있다.

1. **`highlight`를 처음부터 필수로 두지 않는다.** 스펙은 "타입 추가와 콘텐츠 채우기를 한 변경으로 묶는다"였다. 그렇게 하면 35개를 다 채울 때까지 모든 중간 상태에서 빌드가 깨져 태스크마다 검증할 수가 없다. 대신 Task 1에서 선택 필드로 넣고, 35개가 다 찬 뒤 Task 10에서 필수로 바꾼다. 최종 상태는 스펙과 같고, 가는 길만 초록으로 유지한다.
2. **`components/chapter/` 하위 디렉터리를 만들지 않는다.** 현재 `components/`에 하위 디렉터리가 하나도 없다. 관례를 따라 `components/ChapterHighlight.tsx`, `components/ChapterSources.tsx`로 둔다.

## File Structure

| 파일 | 역할 |
|---|---|
| `apps/web/content/curriculum/types.ts` | 수정 · `Highlight` 타입, `SourceNote.on` 추가 |
| `apps/web/content/curriculum/validate.ts` | 수정 · 새 규칙 5개 |
| `apps/web/content/curriculum/validate.test.ts` | 수정 · 규칙당 케이스 |
| `apps/web/content/curriculum/quotes.test.ts` | 신설 · 인용 구절이 본문에 남아 있는지 검사 |
| `apps/web/content/curriculum/{graham,buffett,fisher,greenblatt,lynch,marks,soros}.ts` | 수정 · `highlight` 5개씩, 일부에 `on` |
| `apps/web/components/ChapterHighlight.tsx` | 신설 · 강조 블록 표시 |
| `apps/web/components/ChapterSources.tsx` | 신설 · `ChapterExercises`의 `Sources`를 옮기고 대상 배지 추가 |
| `apps/web/components/ChapterExercises.tsx` | 수정 · `Sources` 제거, `highlight` prop 추가 |
| `apps/web/app/learn/masters/[slug]/[chapter]/page.tsx` | 수정 · `highlight` 전달 |
| `apps/web/app/globals.css` | 수정 · `.highlight` 계열, `.source-target` |

---

### Task 1: 타입과 검증 규칙

**Files:**
- Modify: `apps/web/content/curriculum/types.ts`
- Modify: `apps/web/content/curriculum/validate.ts`
- Test: `apps/web/content/curriculum/validate.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces: `Highlight` 타입(`formula` | `list` | `point`), `Chapter.highlight?: Highlight`, `SourceNote.on?: { exercise: number } | { sellType: true }`. Task 3~9가 `highlight`를, Task 11이 `on`을, Task 12~13이 둘 다 읽는다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`apps/web/content/curriculum/validate.test.ts`의 `chapter()` 헬퍼 아래, 마지막 테스트 앞에 추가한다.

```ts
test("강조 블록의 라벨이 비면 잡는다", () => {
  const problems = curriculumProblems([
    curriculum(chapter({ highlight: { kind: "point", label: "  ", text: "핵심." } })),
  ]);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /강조 블록/);
});

test("목록형 강조 블록의 항목이 비면 잡는다", () => {
  const problems = curriculumProblems([
    curriculum(chapter({ highlight: { kind: "list", label: "확인 항목", items: [] } })),
  ]);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /항목이 비어/);
});

test("강조 블록의 권유형 표현을 잡는다", () => {
  const problems = curriculumProblems([
    curriculum(chapter({ highlight: { kind: "point", label: "핵심", text: "지금 사야 합니다." } })),
  ]);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /권유형/);
});

test("각주에 문단과 다른 대상을 함께 지정하면 잡는다", () => {
  const problems = curriculumProblems([
    curriculum(
      chapter({
        sources: [{ kind: "원전", paragraph: 0, on: { sellType: true }, text: "출처." }],
      }),
    ),
  ]);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /함께 지정/);
});

test("각주가 없는 문항을 가리키면 잡는다", () => {
  const problems = curriculumProblems([
    curriculum(
      chapter({
        sources: [{ kind: "창작", on: { exercise: 3 }, text: "이 숫자는 연습용이다." }],
        exercises: [{ kind: "journal", prompt: "적으세요." }],
      }),
    ),
  ]);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /범위 밖/);
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `cd apps/web && npm test`
Expected: FAIL. `highlight`가 `Chapter`에 없어 타입 오류가 나거나, 규칙이 없어 `problems.length`가 0이다.

- [ ] **Step 3: 타입을 추가한다**

`apps/web/content/curriculum/types.ts`의 `SourceNote` 위에 넣는다.

```ts
/** 그 장의 뼈대. 본문 위에 한 번 세운다.
 *  body와 별개 필드이므로 각주의 paragraph 인덱스에 영향을 주지 않는다. */
export type Highlight =
  | { kind: "formula"; label: string; expr: string; caveat?: string }
  /** ordered는 순서가 뜻을 갖는 열거에만 붙인다. 순서 없는 항목에 번호를
   *  매기면 없는 순서를 있다고 말하게 된다. */
  | { kind: "list"; label: string; items: string[]; ordered?: boolean; caveat?: string }
  | { kind: "point"; label: string; text: string };
```

같은 파일의 `SourceNote`에 `on`을 더한다. `paragraph`는 그대로 둔다.

```ts
export type SourceNote = {
  kind: SourceKind;
  /** 몇 번째 본문 문단(0부터)에 붙는 각주인가.
   *  본문을 고치고 각주를 안 고치면 validate가 빌드에서 잡는다. */
  paragraph?: number;
  /** 문단이 아닌 대상에 붙는 각주. paragraph와 함께 쓰지 않는다.
   *  둘 다 없으면 장 전체에 붙는다. */
  on?: { exercise: number } | { sellType: true };
  text: string;
};
```

`Chapter`에 `highlight`를 선택으로 넣는다. Task 10에서 필수로 바꾼다.

```ts
export type Chapter = {
  title: string;
  lede: string;
  /** 35개 장이 다 찬 뒤 필수로 바꾼다. */
  highlight?: Highlight;
  body: string[];
  /** 본문의 출처. 비워 둘 수 없다 — 출처 없는 서술을 남기지 않기 위한 강제다. */
  sources: SourceNote[];
  exercises: Exercise[];
};
```

- [ ] **Step 4: 검증 규칙을 추가한다**

`apps/web/content/curriculum/validate.ts`의 `chapter.sources.forEach` 블록 안, `paragraph` 검사 바로 아래에 넣는다.

```ts
        if (source.on !== undefined) {
          if (source.paragraph !== undefined) {
            problems.push(`${at}: 문단과 다른 대상을 함께 지정했습니다.`);
          }
          if ("exercise" in source.on) {
            const target = source.on.exercise;
            if (
              !Number.isInteger(target) ||
              target < 0 ||
              target >= chapter.exercises.length
            ) {
              problems.push(
                `${at}: 문항 번호 ${target}가 문항 ${chapter.exercises.length}개의 범위 밖입니다.`,
              );
            }
          }
        }
```

같은 파일에서 금지어 검사용 `text`를 만드는 줄(현재 `const text = [chapter.title, chapter.lede, ...chapter.body].join(" ");`)을 찾아 강조 블록을 포함하도록 바꾼다. 바로 위에 헬퍼를 둔다.

```ts
      // 강조 블록도 사용자에게 그대로 나가므로 같은 검사를 받는다
      const highlightText = chapter.highlight
        ? [
            chapter.highlight.label,
            chapter.highlight.kind === "formula" ? chapter.highlight.expr : "",
            chapter.highlight.kind === "point" ? chapter.highlight.text : "",
            ...(chapter.highlight.kind === "list" ? chapter.highlight.items : []),
            chapter.highlight.kind !== "point" ? (chapter.highlight.caveat ?? "") : "",
          ].join(" ")
        : "";

      if (chapter.highlight) {
        const h = chapter.highlight;
        if (h.label.trim() === "") {
          problems.push(`${where}: 강조 블록의 라벨이 비어 있습니다.`);
        }
        if (h.kind === "formula" && h.expr.trim() === "") {
          problems.push(`${where}: 강조 블록의 수식이 비어 있습니다.`);
        }
        if (h.kind === "point" && h.text.trim() === "") {
          problems.push(`${where}: 강조 블록의 본문이 비어 있습니다.`);
        }
        if (h.kind === "list" && h.items.length === 0) {
          problems.push(`${where}: 강조 블록의 항목이 비어 있습니다.`);
        }
      }

      const text = [chapter.title, chapter.lede, ...chapter.body, highlightText].join(" ");
```

- [ ] **Step 5: 테스트가 통과하는지 확인한다**

Run: `cd apps/web && npm test`
Expected: PASS. 기존 75개 + 새 5개 = 80개.

- [ ] **Step 6: 커밋**

```bash
cd "c:/Users/Har10/Desktop/wisor"
git add apps/web/content/curriculum/types.ts apps/web/content/curriculum/validate.ts apps/web/content/curriculum/validate.test.ts
git commit -m "feat: 장의 뼈대를 담을 자리를 타입에 만든다

본문 문단만으로는 무엇이 핵심인지 말할 수단이 없었다. body와 각주
인덱스를 건드리지 않으려고 별도 필드로 뺐다."
```

---

### Task 2: 인용 구절 회귀 검사

각주와 문항이 따옴표로 인용한 본문 구절이 실제로 남아 있는지 본다. 이번 변경은 본문을 건드리지 않으므로 순수 회귀 감시용이고, 앞으로 본문을 다듬을 때 인용이 함께 깨지는 것을 막는다.

**Files:**
- Create: `apps/web/content/curriculum/quotes.test.ts`

**Interfaces:**
- Consumes: Task 1의 타입 변경 없이도 동작한다. 일곱 커리큘럼 export만 쓴다.
- Produces: 없음

- [ ] **Step 1: 테스트를 쓴다**

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { BUFFETT } from "./buffett.ts";
import { FISHER } from "./fisher.ts";
import { GRAHAM } from "./graham.ts";
import { GREENBLATT } from "./greenblatt.ts";
import { LYNCH } from "./lynch.ts";
import { MARKS } from "./marks.ts";
import { SOROS } from "./soros.ts";
import type { Curriculum } from "./types.ts";

const ALL: Curriculum[] = [GRAHAM, BUFFETT, FISHER, GREENBLATT, LYNCH, MARKS, SOROS];

/** 각주가 본문 구절을 따옴표로 인용하는 경우가 있다. 본문을 고치면서
 *  인용을 안 고치면 각주가 없는 문장을 인용하게 된다. */
const QUOTED = /[‘'"]([^’'"\n]{2,60})[’'"]/g;

function quotedSpans(text: string): string[] {
  return [...text.matchAll(QUOTED)].map((m) => m[1]);
}

test("각주가 인용한 구절은 그 장의 본문·리드·제목에 남아 있다", () => {
  const broken: string[] = [];

  for (const curriculum of ALL) {
    curriculum.chapters.forEach((chapter, index) => {
      const haystack = [chapter.title, chapter.lede, ...chapter.body];
      for (const source of chapter.sources) {
        for (const span of quotedSpans(source.text)) {
          // 본문 어딘가에 이미 있었던 인용만 검사한다. 책 제목이나
          // 원문 인용은 본문에 없는 것이 정상이므로 걸리지 않는다.
          const elsewhere = ALL.some((c) =>
            c.chapters.some((ch) =>
              [ch.title, ch.lede, ...ch.body].some((p) => p.includes(span)),
            ),
          );
          if (elsewhere && !haystack.some((p) => p.includes(span))) {
            broken.push(`${curriculum.masterId} ${index + 1}장 각주: '${span}'`);
          }
        }
      }
    });
  }

  assert.deepEqual(broken, []);
});

test("문항이 인용한 구절은 그 장의 본문·리드·제목에 남아 있다", () => {
  const broken: string[] = [];

  for (const curriculum of ALL) {
    curriculum.chapters.forEach((chapter, index) => {
      const haystack = [chapter.title, chapter.lede, ...chapter.body];
      for (const exercise of chapter.exercises) {
        const texts = [exercise.prompt];
        if (exercise.kind === "graded") texts.push(exercise.explain, ...exercise.choices);
        if (exercise.kind === "guided") texts.push(...exercise.checkpoints);

        for (const text of texts) {
          for (const span of quotedSpans(text)) {
            const elsewhere = ALL.some((c) =>
              c.chapters.some((ch) =>
                [ch.title, ch.lede, ...ch.body].some((p) => p.includes(span)),
              ),
            );
            if (elsewhere && !haystack.some((p) => p.includes(span))) {
              broken.push(`${curriculum.masterId} ${index + 1}장 문항: '${span}'`);
            }
          }
        }
      }
    });
  }

  assert.deepEqual(broken, []);
});
```

- [ ] **Step 2: 테스트가 통과하는지 확인한다**

Run: `cd apps/web && npm test`
Expected: PASS. 현재 각주 쪽 11개, 문항 쪽 13개 인용이 모두 걸려 있다.

- [ ] **Step 3: 일부러 깨뜨려 검사가 실제로 도는지 본다**

`apps/web/content/curriculum/graham.ts` 3장 `body[1]`에서 `배당을 오래 끊지 않고 준 이력` 부분을 `배당 이력`으로 잠깐 바꾼다.

Run: `cd apps/web && npm test`
Expected: FAIL. `graham 3장 각주: '배당을 오래 끊지 않고 준 이력'`이 나온다.

- [ ] **Step 4: 되돌린다**

```bash
cd "c:/Users/Har10/Desktop/wisor"
git checkout -- apps/web/content/curriculum/graham.ts
```

Run: `cd apps/web && npm test`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
cd "c:/Users/Har10/Desktop/wisor"
git add apps/web/content/curriculum/quotes.test.ts
git commit -m "test: 각주가 인용한 본문 구절이 사라지는 것을 잡는다

본문을 다듬다 인용된 구절만 바뀌면 각주가 없는 문장을 인용하게 되는데
지금은 아무것도 막지 않는다."
```

---

### Task 3: graham 5개 장의 강조 블록

**Files:**
- Modify: `apps/web/content/curriculum/graham.ts`

**Interfaces:**
- Consumes: Task 1의 `Highlight` 타입
- Produces: 없음

- [ ] **Step 1: 다섯 장에 `highlight`를 넣는다**

각 장 객체에서 `lede` 바로 아래, `body` 바로 위에 넣는다. 순서를 지켜야 읽는 사람이 파일을 화면 순서대로 읽는다.

1장 (`예측하지 않고, 틀려도 되는 가격에 산다`):

```ts
      highlight: {
        kind: "point",
        label: "예측을 포기한 자리",
        text: "미래를 알 수 없으니 예측하지 않는다. 장부에 이미 적혀 있는 것만 세고, 자기 판단이 자주 틀릴 것을 전제해 여러 종목에 나눠 담는다.",
      },
```

2장 (`장부에서 찾는다`):

```ts
      highlight: {
        kind: "formula",
        label: "이 장의 계산",
        expr: "순유동자산 = 유동자산 − 총부채",
        caveat: "고정자산은 0으로 놓는다 · 매수는 이 값의 3분의 2 이하에서만",
      },
```

3장 (`싼 것과 죽어가는 것을 가른다`):

```ts
      highlight: {
        kind: "list",
        label: "확인 항목 넷",
        items: [
          "유동비율 2 이상 (유동자산 ÷ 유동부채)",
          "순유동자산보다 작은 장기부채",
          "최근 10년 연속 흑자",
          "배당을 오래 끊지 않고 준 이력",
        ],
        caveat: "원문의 기준은 더 까다롭다 · 20년 무중단 배당 · PER 15배 이하 · PBR 1.5배 이하",
      },
```

4장 (`제자리로 오면 판다`):

```ts
      highlight: {
        kind: "list",
        label: "파는 두 경우",
        items: [
          "가치에 닿았을 때 — 더 오를 것 같아도 판다",
          "2~3년이 지나도 닿지 않을 때 — 정리하고 다음 후보로 넘어간다",
        ],
        caveat: "종목에 정이 들면 두 규칙이 한꺼번에 무너진다",
      },
```

5장 (`싼 데는 이유가 있다`):

```ts
      highlight: {
        kind: "list",
        label: "무너지는 두 방식",
        items: [
          "가치 함정 — 재산은 있는데 사업이 그 재산으로 현금을 만들지 못한다",
          "측정 대상의 소멸 — 정보 우위가 사라지고 가치가 무형자산으로 옮겨갔다",
        ],
        caveat: "논리가 틀린 것이 아니라 잴 것이 사라졌다",
      },
```

- [ ] **Step 2: 테스트를 돌린다**

Run: `cd apps/web && npm test`
Expected: PASS. 금지어와 빈 값 검사를 통과한다.

- [ ] **Step 3: 커밋**

```bash
cd "c:/Users/Har10/Desktop/wisor"
git add apps/web/content/curriculum/graham.ts
git commit -m "content: 그레이엄 다섯 장의 뼈대를 블록으로 세운다"
```

---

### Task 4: buffett 5개 장의 강조 블록

**Files:**
- Modify: `apps/web/content/curriculum/buffett.ts`

**Interfaces:**
- Consumes: Task 1의 `Highlight` 타입
- Produces: 없음

- [ ] **Step 1: 다섯 장에 `highlight`를 넣는다**

각 장에서 `lede` 아래, `body` 위에 넣는다.

1장 (`주식이 아니라 사업을 산다`):

```ts
      highlight: {
        kind: "point",
        label: "능력범위",
        text: "아는 분야가 넓은지가 아니라 그 경계가 선명한지를 본다. 10년 뒤 모습이 그려지지 않으면 판단하지 않고 지나간다.",
      },
```

2장 (`좋은 회사를 거르는 세 가지 질문`):

```ts
      highlight: {
        kind: "list",
        label: "후보를 거르는 세 질문",
        items: [
          "사업이 어떻게 돈을 버는지 이해할 수 있는가",
          "경쟁자가 그 이익을 쉽게 빼앗지 못하는가",
          "경영진이 번 현금을 주주에게 유리하게 배분해 왔는가",
        ],
        caveat: "하나라도 답할 근거가 없으면 좋은 회사처럼 보여도 후보에서 뺀다",
      },
```

3장 (`회계이익이 아니라 주주 몫의 현금`):

```ts
      highlight: {
        kind: "formula",
        label: "이 장의 계산",
        expr: "소유주이익 = 순이익 + 비현금비용 − 유지 자본지출",
        caveat: "유지용과 성장용을 가르는 것은 공식이 아니라 판단이다 · 연도마다 같은 기준을 쓴다",
      },
```

4장 (`논거가 깨질 때만 판다`):

```ts
      highlight: {
        kind: "formula",
        label: "1989년 서한의 숫자",
        expr: "매년 실현 2만 5,250달러 · 마지막에 한 번 69만 2,000달러",
        caveat: "1달러를 20년간 매년 두 배 · 세율 34% · 두 경우의 세전 수익은 같다",
      },
```

5장 (`좋은 기업에 투자하더라도 꼭 피해야 할 함정`):

```ts
      highlight: {
        kind: "list",
        label: "두 가지 실패",
        items: [
          "좋은 회사를 비싼 값에 사는 것 — 프리시전 캐스트파츠에서 약 110억 달러를 상각했다",
          "오래 기다릴 수 없는 돈으로 집중하는 것 — 판단이 맞아도 회복 전에 팔아야 한다",
        ],
        caveat: "집중도를 정하기 전에 자금마다 회수 시점과 상환 의무를 적는다",
      },
```

- [ ] **Step 2: 테스트를 돌린다**

Run: `cd apps/web && npm test`
Expected: PASS.

- [ ] **Step 3: 커밋**

```bash
cd "c:/Users/Har10/Desktop/wisor"
git add apps/web/content/curriculum/buffett.ts
git commit -m "content: 버핏 다섯 장의 뼈대를 블록으로 세운다"
```

---

### Task 5: fisher 5개 장의 강조 블록

**Files:**
- Modify: `apps/web/content/curriculum/fisher.ts`

**Interfaces:**
- Consumes: Task 1의 `Highlight` 타입
- Produces: 없음

- [ ] **Step 1: 다섯 장에 `highlight`를 넣는다**

1장 (`드문 기업을 찾았다면 오래 본다`):

```ts
      highlight: {
        kind: "point",
        label: "탐색과 보유가 이어지는 이유",
        text: "수십 년을 앞서는 회사는 드물어 찾는 데 비용이 크다. 팔아버리면 그만한 회사를 처음부터 다시 찾아야 하므로 한 번 찾으면 팔지 않는다.",
      },
```

2장 (`회사 밖에서 회사를 묻는다`):

```ts
      highlight: {
        kind: "list",
        label: "탐문 대상",
        items: ["고객", "경쟁사", "공급업체", "전직 직원", "업계 연구자"],
        caveat: "경쟁사에게 묻는다 — 이 업계에서 가장 무서운 회사는 어디이고 왜인가",
      },
```

3장 (`연구비가 매출로 바뀌는가`):

```ts
      highlight: {
        kind: "list",
        label: "확인 항목",
        items: [
          "연구비 대비 신제품이 실제로 얼마나 벌어들이는가",
          "영업 조직에 현장에서 발휘되는 힘이 있는가",
          "경쟁 압력 속에서도 이익률이 깎이지 않는가",
          "경영진이 나쁜 소식을 먼저 꺼내는가",
        ],
        caveat: "마지막 항목은 다른 모든 정보에 곱해지는 계수다",
      },
```

4장 (`세 경우 말고는 떠나지 않는다`):

```ts
      highlight: {
        kind: "list",
        label: "매도 사유 셋",
        items: [
          "애초 판단이 틀렸음이 드러났을 때",
          "회사가 기준에서 벗어나 더 이상 뛰어난 기업이 아니게 됐을 때",
          "훨씬 나은 대상이 나타나 자본을 옮기는 편이 나을 때",
        ],
        caveat: "이 목록에 가격은 없다",
      },
```

5장 (`탐문이 확증으로 변하는 순간`):

```ts
      highlight: {
        kind: "list",
        label: "두 가지 위험",
        items: [
          "탐문이 확증 편향의 도구가 되는 것",
          "가격을 무시하는 것",
        ],
        caveat: "무엇이 확인되면 판단을 접을지 탐문 전에 문서로 못 박아 둔다",
      },
```

- [ ] **Step 2: 테스트를 돌린다**

Run: `cd apps/web && npm test`
Expected: PASS.

- [ ] **Step 3: 커밋**

```bash
cd "c:/Users/Har10/Desktop/wisor"
git add apps/web/content/curriculum/fisher.ts
git commit -m "content: 피셔 다섯 장의 뼈대를 블록으로 세운다"
```

---

### Task 6: greenblatt 5개 장의 강조 블록

**Files:**
- Modify: `apps/web/content/curriculum/greenblatt.ts`

**Interfaces:**
- Consumes: Task 1의 `Highlight` 타입
- Produces: 없음

- [ ] **Step 1: 다섯 장에 `highlight`를 넣는다**

1장 (`재량이 들어올 자리를 없앤다`):

```ts
      highlight: {
        kind: "point",
        label: "이 철학의 결론",
        text: "판단을 더 갈고닦기보다 절차에서 사람의 재량이 개입할 자리를 없앤다. 버핏과 같은 문제를 정반대로 푸는 방식이다.",
      },
```

2장 (`두 개의 순위표를 더한다`):

```ts
      highlight: {
        kind: "formula",
        label: "이 장의 계산",
        expr: "합산 순위 = 자본수익률 순위 + 이익수익률 순위",
        caveat: "합산 상위 20~30 종목 · 몇 달에 걸쳐 5~7 종목씩 나눠 산다",
      },
```

3장 (`종목이 아니라 규칙을 검증한다`):

```ts
      highlight: {
        kind: "point",
        label: "검증 대상",
        text: "개별 종목이 아니라 규칙 자체를 검증한다. 규칙의 기대수익은 애초에 개별 오류까지 포함한 평균으로 계산된 값이다.",
      },
```

4장 (`정한 때에 다시 계산한다`):

```ts
      highlight: {
        kind: "list",
        label: "정한 때에 다시 계산한다",
        ordered: true,
        items: [
          "1년 주기로 순위를 다시 계산한다",
          "여전히 상위면 계속 들고 간다",
          "순위에서 밀려나면 내보낸다",
        ],
        caveat: "오른 종목이든 내린 종목이든 개별 사연은 고려하지 않는다",
      },
```

5장 (`규칙보다 먼저 사용자가 지친다`):

```ts
      highlight: {
        kind: "list",
        label: "원문이 제시한 부진 구간",
        items: [
          "12개월 중 5개월은 시장을 밑돈다",
          "4년에 한 번꼴로 한 해 전체가 시장에 뒤진다",
          "검증 기간에 34개월 내리 부진했던 구간이 있었다",
        ],
        caveat: "규칙의 유효성과 사용자의 지속 가능성은 따로 검증한다",
      },
```

- [ ] **Step 2: 테스트를 돌린다**

Run: `cd apps/web && npm test`
Expected: PASS.

- [ ] **Step 3: 커밋**

```bash
cd "c:/Users/Har10/Desktop/wisor"
git add apps/web/content/curriculum/greenblatt.ts
git commit -m "content: 그린블랫 다섯 장의 뼈대를 블록으로 세운다"
```

---

### Task 7: lynch 5개 장의 강조 블록

**Files:**
- Modify: `apps/web/content/curriculum/lynch.ts`

**Interfaces:**
- Consumes: Task 1의 `Highlight` 타입
- Produces: 없음

- [ ] **Step 1: 다섯 장에 `highlight`를 넣는다**

1장 (`우위는 일상에 있다`):

```ts
      highlight: {
        kind: "list",
        label: "기관을 묶는 세 제약",
        items: [
          "운용 자금이 커서 작은 회사를 사면 지분이 과도해진다",
          "내부 규정상 담지 못하는 종목이 많다",
          "낯선 회사를 샀다가 틀리면 담당자가 책임을 진다",
        ],
        caveat: "개인에게는 셋 다 없다 · 다만 발견은 후보일 뿐 매수 근거가 아니다",
      },
```

2장 (`여섯 유형으로 먼저 나눈다`):

```ts
      highlight: {
        kind: "list",
        label: "여섯 유형",
        items: [
          "저성장주 — 다 큰 회사, 성장이 느리고 배당이 후하다",
          "대형우량주 — 크고 튼튼해 불황에도 잘 버틴다",
          "고속성장주 — 작고 빠르게 큰다",
          "경기순환주 — 경기에 따라 실적이 오르내린다",
          "자산주 — 시장이 아직 못 본 숨은 자산이 있다",
          "회생주 — 망가졌다가 되살아나는 중이다",
        ],
        caveat: "순환주를 대형우량주로 착각하면 가장 비쌀 때 싸다고 오판한다",
      },
```

3장 (`성장률 대비 가격, 재고와 매출채권`):

```ts
      highlight: {
        kind: "formula",
        label: "이 장의 계산",
        expr: "PEG = PER ÷ 이익 성장률(%)",
        caveat: "1 이하가 기준선 · 『이기는 투자』의 변형식은 방향이 반대이니 섞어 쓰지 않는다",
      },
```

4장 (`스토리가 끝나면 판다`):

```ts
      highlight: {
        kind: "list",
        label: "유형별로 스토리가 끝나는 지점",
        items: [
          "고속성장주 — 성장률이 꺾이거나 새로 열 매장과 진출할 시장이 소진될 때",
          "경기순환주 — 재고 증가와 원자재 가격 정점 같은 신호가 나올 때",
          "회생주 — 정상화가 실제로 끝나 더 이상 회생 스토리가 아닐 때",
        ],
        caveat: "유형과 무관한 공통 신호 하나 — 본업과 상관없는 인수로 사업이 산만해지는 것",
      },
```

5장 (`성장 추정이 틀리면 전부 틀린다`):

```ts
      highlight: {
        kind: "formula",
        label: "하락이 곱으로 온다",
        expr: "0.8 × 0.5 = 0.4배 → −60%",
        caveat: "이익이 20% 줄고 PER이 30배에서 15배로 내려앉는 일이 동시에 일어난 경우",
      },
```

- [ ] **Step 2: 테스트를 돌린다**

Run: `cd apps/web && npm test`
Expected: PASS.

- [ ] **Step 3: 커밋**

```bash
cd "c:/Users/Har10/Desktop/wisor"
git add apps/web/content/curriculum/lynch.ts
git commit -m "content: 린치 다섯 장의 뼈대를 블록으로 세운다"
```

---

### Task 8: marks 5개 장의 강조 블록

**Files:**
- Modify: `apps/web/content/curriculum/marks.ts`

**Interfaces:**
- Consumes: Task 1의 `Highlight` 타입
- Produces: 없음

- [ ] **Step 1: 다섯 장에 `highlight`를 넣는다**

1장 (`예측 대신 위치를 파악한다`):

```ts
      highlight: {
        kind: "point",
        label: "1차와 2차",
        text: "1차적 사고는 좋은 회사니까 산다고 말한다. 2차적 사고는 그것을 모두가 알아 이미 값에 반영됐는지까지 본다.",
      },
```

2장 (`심리 온도계를 읽는다`):

```ts
      highlight: {
        kind: "list",
        label: "심리 온도계",
        items: [
          "신용이 얼마나 쉽게 풀리는가",
          "신용도가 낮은 기업의 채권조차 무리 없이 팔려 나가는가",
          "리스크 프리미엄이 얼마나 얇아졌는가",
        ],
        caveat: "가장 날카로운 신호는 악재가 나왔는데도 주가가 빠지지 않는 것",
      },
```

3장 (`위험을 영구 손실로 본다`):

```ts
      highlight: {
        kind: "point",
        label: "위험의 정의",
        text: "위험은 가격이 얼마나 출렁이는지가 아니라 돈을 영구히 잃을 가능성이다. 이 정의를 취하면 크게 빠진 자산이 오히려 안전해질 수 있다.",
      },
```

4장 (`종목이 아니라 다이얼을 돌린다`):

```ts
      highlight: {
        kind: "list",
        label: "조절 수단 셋",
        items: [
          "현금을 얼마나 둘 것인가",
          "주식과 채권의 비중을 어떻게 나눌 것인가",
          "담는 자산의 신용 등급을 어디까지로 제한할 것인가",
        ],
        caveat: "최근 2년간 현금 비중이 그대로라면 한 번도 돌리지 않았다는 뜻이다",
      },
```

5장 (`일찍 맞으면 틀린 것과 같다`):

```ts
      highlight: {
        kind: "point",
        label: "표본이 열 개를 넘지 않는다",
        text: "사이클 한 바퀴가 표본 하나인데 한 바퀴에 여러 해가 걸린다. 실력과 운을 가르기 어려우니 전망을 사전에 기록으로 남긴다.",
      },
```

- [ ] **Step 2: 테스트를 돌린다**

Run: `cd apps/web && npm test`
Expected: PASS.

- [ ] **Step 3: 커밋**

```bash
cd "c:/Users/Har10/Desktop/wisor"
git add apps/web/content/curriculum/marks.ts
git commit -m "content: 막스 다섯 장의 뼈대를 블록으로 세운다"
```

---

### Task 9: soros 5개 장의 강조 블록

**Files:**
- Modify: `apps/web/content/curriculum/soros.ts`

**Interfaces:**
- Consumes: Task 1의 `Highlight` 타입
- Produces: 없음

2장 블록은 다섯 단계를 그대로 유지한다. 2장 각주가 "본문의 5단계"를 가리키므로 단계 수가 달라지면 각주가 어긋난다.

- [ ] **Step 1: 다섯 장에 `highlight`를 넣는다**

1장 (`가격과 현실이 서로를 바꾼다`):

```ts
      highlight: {
        kind: "point",
        label: "재귀성",
        text: "인식은 늘 불완전하고, 그 인식이 매매 행동을 통해 현실 자체를 바꾼다. 가치가 가격을 정하는 것이 아니라 둘이 서로를 만든다.",
      },
```

2장 (`자기강화의 초입을 찾는다`):

```ts
      highlight: {
        kind: "list",
        label: "붐과 버스트의 다섯 단계",
        ordered: true,
        items: [
          "추세가 시작된다",
          "그 추세를 지지하는 편향이 형성된다",
          "초기 성공이 편향을 검증해 주면서 추세가 가속한다",
          "가격과 실제 현실 사이의 괴리가 벌어진다",
          "버틸 수 없는 지점에서 반전한다",
        ],
        caveat: "노리는 것은 이 순환이 막 자기강화 국면에 들어선 지점이다",
      },
```

3장 (`작게 걸어 시장에 묻는다`):

```ts
      highlight: {
        kind: "list",
        label: "검증이 매수 뒤에 온다",
        ordered: true,
        items: [
          "가설을 세운다",
          "작은 포지션으로 먼저 진입한다",
          "시장의 반응을 검증 자료로 읽는다",
          "가설이 지지되면 포지션을 키운다",
        ],
        caveat: "물타기와 정반대다 — 가설을 지지하는 방향으로 움직일 때 더 산다",
      },
```

4장 (`틀리면 줄이고 맞으면 키운다`):

```ts
      highlight: {
        kind: "point",
        label: "비대칭",
        text: "틀릴 때는 작게 끝내고 맞을 때는 크게 번다. 이 비대칭이 유지되면 승률이 절반이어도 전체 수익이 크게 남는다.",
      },
```

5장 (`설명할 수 없는 실패를 남겨둔다`):

```ts
      highlight: {
        kind: "list",
        label: "두 가지 위험",
        items: [
          "레버리지 — 최종 판단이 맞아도 그 전에 강제 청산된다",
          "반증 불가능성 — 올라도 내려도 재귀성으로 설명된다",
        ],
        caveat: "그래서 최종 심판을 이론이 아니라 가격이라는 외부 신호에 맡긴다",
      },
```

- [ ] **Step 2: 테스트를 돌린다**

Run: `cd apps/web && npm test`
Expected: PASS.

- [ ] **Step 3: 커밋**

```bash
cd "c:/Users/Har10/Desktop/wisor"
git add apps/web/content/curriculum/soros.ts
git commit -m "content: 소로스 다섯 장의 뼈대를 블록으로 세운다"
```

---

### Task 10: highlight를 필수로 바꾼다

35개가 다 찼으므로 이제 타입이 "전부 하나씩"을 강제할 수 있다.

**Files:**
- Modify: `apps/web/content/curriculum/types.ts`
- Modify: `apps/web/content/curriculum/validate.test.ts`

**Interfaces:**
- Consumes: Task 3~9의 콘텐츠
- Produces: `Chapter.highlight: Highlight` (필수). Task 13이 이에 의존해 `highlight`를 항상 넘긴다.

- [ ] **Step 1: 테스트 헬퍼에 기본 강조 블록을 넣는다**

`apps/web/content/curriculum/validate.test.ts`의 `chapter()` 헬퍼를 고친다. 필수가 되면 헬퍼가 값을 주지 않는 한 모든 기존 케이스가 타입 오류를 낸다.

```ts
function chapter(overrides: Partial<Chapter> = {}): Chapter {
  return {
    title: "제목",
    lede: "인용구",
    highlight: { kind: "point", label: "핵심", text: "이 장의 뼈대." },
    body: ["본문 한 단락."],
    sources: [{ kind: "원전", paragraph: 0, text: "어떤 책 1장." }],
    exercises: [],
    ...overrides,
  };
}
```

- [ ] **Step 2: 타입을 필수로 바꾼다**

`apps/web/content/curriculum/types.ts`의 `Chapter`에서 `?`와 임시 주석을 없앤다.

```ts
export type Chapter = {
  title: string;
  lede: string;
  /** 그 장의 뼈대. 35개 장이 하나씩 갖는다 — 없는 장을 만들지 않으려고 필수다. */
  highlight: Highlight;
  body: string[];
  /** 본문의 출처. 비워 둘 수 없다 — 출처 없는 서술을 남기지 않기 위한 강제다. */
  sources: SourceNote[];
  exercises: Exercise[];
};
```

`validate.ts`의 `if (chapter.highlight)` 가드는 그대로 둔다. 타입이 보장해도 런타임에서 값이 비는 경우를 막는 검사가 아니라 편의 가드이므로 지워도 되지만, 지우면 `highlightText` 삼항도 함께 정리해야 한다. 이번에는 건드리지 않는다.

- [ ] **Step 3: 테스트와 타입 검사를 돌린다**

Run: `cd apps/web && npm test`
Expected: PASS.

Run: `cd apps/web && npx tsc --noEmit`
Expected: 오류 없음. 35개가 다 차 있으므로 통과한다.

- [ ] **Step 4: 커밋**

```bash
cd "c:/Users/Har10/Desktop/wisor"
git add apps/web/content/curriculum/types.ts apps/web/content/curriculum/validate.test.ts
git commit -m "feat: 뼈대 없는 장을 타입이 막게 한다

35개가 다 찼으니 이제 선택 필드로 둘 이유가 없다. 앞으로 장을 추가할 때
블록을 빠뜨리면 빌드에서 걸린다."
```

---

### Task 11: 각주 8개를 제 대상으로 옮긴다

**Files:**
- Modify: `apps/web/content/curriculum/graham.ts`
- Modify: `apps/web/content/curriculum/fisher.ts`
- Modify: `apps/web/content/curriculum/greenblatt.ts`
- Modify: `apps/web/content/curriculum/lynch.ts`
- Modify: `apps/web/content/curriculum/marks.ts`
- Modify: `apps/web/content/curriculum/soros.ts`

**Interfaces:**
- Consumes: Task 1의 `SourceNote.on`
- Produces: 없음

`text`는 한 글자도 고치지 않는다. `on` 한 줄만 더한다.

- [ ] **Step 1: 문항에 걸리는 각주 둘에 `on`을 붙인다**

`graham.ts` 2장 sources 중 `확인 문항의 숫자(유동자산 800억, ...)`로 시작하는 창작 각주:

```ts
        {
          kind: "창작",
          on: { exercise: 0 },
          text: "확인 문항의 숫자(유동자산 800억, 총부채 500억, 시가총액 180억)는 계산 연습을 위해 만든 것이다.",
        },
```

`lynch.ts` 3장 sources 중 `확인 문항의 숫자(PER 36배, ...)`로 시작하는 창작 각주:

```ts
        {
          kind: "창작",
          on: { exercise: 0 },
          text: "확인 문항의 숫자(PER 36배, 성장 12% 등)는 계산 연습을 위해 만든 예시다.",
        },
```

- [ ] **Step 2: 매도 유형 이름 각주 여섯에 `on`을 붙인다**

여섯 파일의 4장 sources에 있는 `매도 유형 이름 …은 이 과정이 붙인 것이다` 각주에 각각 `on: { sellType: true },`를 `kind` 다음 줄에 넣는다. 대상 파일은 `graham.ts`, `fisher.ts`, `greenblatt.ts`, `lynch.ts`, `marks.ts`, `soros.ts`다. 예를 들어 `soros.ts` 4장은 이렇게 된다.

```ts
        {
          kind: "창작",
          on: { sellType: true },
          text: "매도 유형 이름 '가격 역행형'은 이 과정이 붙인 것이다.",
        },
```

`graham.ts` 4장 각주는 문장이 더 길지만 같은 방식이다. `text`는 그대로 둔다.

- [ ] **Step 3: 장 전체로 남길 둘은 건드리지 않는다**

`greenblatt.ts` 2장의 `원문의 스크리너에는 금융주와 유틸리티…` 각주와 `marks.ts` 4장의 `한계 주의 — 막스는 오크트리에서…` 각주는 그대로 둔다. 이 둘은 실제로 장 전체에 걸리는 단서다.

- [ ] **Step 4: 남은 대상 없는 각주가 둘뿐인지 확인한다**

Run:

```bash
cd apps/web && node --input-type=module -e "
const dir = 'C:/Users/Har10/Desktop/wisor/apps/web/content/curriculum/';
const names = ['graham','buffett','fisher','greenblatt','lynch','marks','soros'];
let n = 0;
for (const name of names) {
  const c = Object.values(await import(dir + name + '.ts'))[0];
  c.chapters.forEach((ch, i) => ch.sources.forEach((s) => {
    if (s.paragraph === undefined && s.on === undefined) { n++; console.log(c.masterId, i+1, s.text.slice(0,40)); }
  }));
}
console.log('대상 없는 각주:', n);
"
```

Expected: `대상 없는 각주: 2` — greenblatt 2장과 marks 4장만 남는다.

- [ ] **Step 5: 테스트를 돌린다**

Run: `cd apps/web && npm test`
Expected: PASS. `paragraph`와 `on`을 함께 지정한 각주가 없어야 통과한다.

- [ ] **Step 6: 커밋**

```bash
cd "c:/Users/Har10/Desktop/wisor"
git add apps/web/content/curriculum/
git commit -m "fix: 본문과 무관한 각주를 문항과 매도 유형으로 옮긴다

문항에서만 쓰는 숫자를 설명하는 각주가 본문 읽기 화면의 출처 목록에
대상 표시 없이 섞여 있었다. 각주 문안과 문단 번호는 그대로 둔다."
```

---

### Task 12: 출처 컴포넌트 분리와 대상 배지

**Files:**
- Create: `apps/web/components/ChapterSources.tsx`
- Modify: `apps/web/components/ChapterExercises.tsx`
- Modify: `apps/web/app/globals.css`

**Interfaces:**
- Consumes: Task 1의 `SourceNote.on`
- Produces: `export default function ChapterSources({ sources }: { sources: SourceNote[] })`. Task 13은 이 컴포넌트를 건드리지 않는다.

- [ ] **Step 1: 새 파일을 만든다**

`apps/web/components/ChapterSources.tsx`:

```tsx
"use client";

// SOURCE_KINDS는 값이지만 types.ts가 Master를 type import만 하므로 번들에 masters.ts가 실리지 않는다
import { SOURCE_KINDS, type SourceNote } from "@/content/curriculum/types";

/** 각주가 무엇에 붙는지 한 낱말로 말한다.
 *
 * 대상이 없으면 배지가 아예 없던 때에는 본문 각주와 문항 각주가 같은
 * 목록에서 구분되지 않았다. 넷 다 배지를 갖게 해 대상 없는 줄을 없앤다. */
function targetLabel(source: SourceNote): string {
  if (source.paragraph !== undefined) return `${source.paragraph + 1}문단`;
  if (source.on && "exercise" in source.on) return `${source.on.exercise + 1}번 문항`;
  if (source.on && "sellType" in source.on) return "매도 유형";
  return "이 장 전체";
}

/** 본문 아래 접어 둔 각주.
 *
 * 펼치지 않아도 요약줄에서 원문·정리·창작 비율이 보이는 것이 핵심이다.
 * 이 장의 서술 중 얼마가 대가 본인의 것인지를 읽기 전에 알 수 있어야 한다.
 */
export default function ChapterSources({ sources }: { sources: SourceNote[] }) {
  const tally = SOURCE_KINDS.map((kind) => ({
    kind,
    count: sources.filter((source) => source.kind === kind).length,
  })).filter((entry) => entry.count > 0);

  return (
    <details className="source-note">
      <summary>
        <span>출처 {sources.length}개</span>
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
            <span className="source-para">{targetLabel(source)}</span>
            <span className="source-text">{source.text}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}
```

- [ ] **Step 2: ChapterExercises에서 옛 Sources를 걷어낸다**

`apps/web/components/ChapterExercises.tsx`에서:

1. 파일 맨 아래의 `function Sources({ sources }: { sources: SourceNote[] }) { … }` 전체를 지운다.
2. 상단 import에서 `SOURCE_KINDS`를 뺀다. 이 파일에서 더 쓰지 않는다. `type SourceNote`는 props 타입으로 계속 쓰므로 남긴다.

```tsx
import { type Exercise, type SourceNote } from "@/content/curriculum/types";
```

3. 새 컴포넌트를 import한다.

```tsx
import ChapterSources from "@/components/ChapterSources";
```

4. 읽기 스텝에서 `<Sources …>`를 `<ChapterSources …>`로 바꾼다.

```tsx
            {sources && sources.length > 0 && <ChapterSources sources={sources} />}
```

- [ ] **Step 3: 배지가 항상 보이도록 CSS를 확인한다**

`apps/web/app/globals.css`의 `.source-para`는 이미 있다. 지금은 문단 번호만 들어가지만 이제 `이 장 전체`, `매도 유형` 같은 더 긴 낱말이 들어간다. `white-space: nowrap`이 걸려 있어 375px에서 줄이 밀릴 수 있으므로 `.source-note li`의 그리드를 바꾼다.

```css
.source-note li {
  display: grid;
  grid-template-columns: auto auto 1fr;
  align-items: baseline;
  gap: 0.4rem;
  font-size: 0.84rem;
  line-height: 1.65;
  color: var(--ink-soft);
}

@media (max-width: 30rem) {
  /* 좁은 화면에서는 배지 둘을 윗줄에 두고 본문을 아래로 내린다 */
  .source-note li {
    grid-template-columns: auto auto;
  }

  .source-note li .source-text {
    grid-column: 1 / -1;
  }
}
```

- [ ] **Step 4: 빌드와 테스트를 돌린다**

Run: `cd apps/web && npm test && npm run build`
Expected: 둘 다 통과. 빌드가 정적 페이지 435개를 생성한다.

- [ ] **Step 5: 화면을 눈으로 확인한다**

Run: `cd apps/web && npm run dev`

`http://localhost:3000/learn/masters/graham/2`를 연다. 읽기 스텝의 `출처 3개`를 펼쳐 세 줄 모두 배지를 갖는지 본다. 셋째 줄이 `1번 문항`이어야 한다. 브라우저 폭을 375px로 줄여 본문이 아래로 내려가는지 본다.

- [ ] **Step 6: 커밋**

```bash
cd "c:/Users/Har10/Desktop/wisor"
git add apps/web/components/ChapterSources.tsx apps/web/components/ChapterExercises.tsx apps/web/app/globals.css
git commit -m "feat: 각주가 무엇에 붙는지 목록에서 밝힌다

대상이 없는 각주는 배지도 없어서 본문 각주와 구분되지 않았다.
넷 다 배지를 갖게 하고, 커진 컴포넌트에서 출처를 떼어냈다."
```

---

### Task 13: 강조 블록 컴포넌트와 연결

**Files:**
- Create: `apps/web/components/ChapterHighlight.tsx`
- Modify: `apps/web/components/ChapterExercises.tsx`
- Modify: `apps/web/app/learn/masters/[slug]/[chapter]/page.tsx`
- Modify: `apps/web/app/globals.css`

**Interfaces:**
- Consumes: Task 10의 `Chapter.highlight: Highlight`, Task 12의 정리된 `ChapterExercises`
- Produces: `export default function ChapterHighlight({ highlight }: { highlight: Highlight })`

- [ ] **Step 1: 컴포넌트를 만든다**

`apps/web/components/ChapterHighlight.tsx`:

```tsx
"use client";

import type { Highlight } from "@/content/curriculum/types";

/** 그 장의 뼈대를 본문 위에 한 번 세운다.
 *
 * 본문이 다 같은 무게로 깔리면 어느 대목이 중심인지 보이지 않는다.
 * 색만으로 구분하지 않으려고 위쪽 실선과 테두리라는 형태를 함께 쓴다. */
export default function ChapterHighlight({ highlight }: { highlight: Highlight }) {
  return (
    <div className="highlight" data-kind={highlight.kind}>
      <p className="highlight-label">{highlight.label}</p>

      {highlight.kind === "formula" && <p className="highlight-expr">{highlight.expr}</p>}

      {highlight.kind === "point" && <p className="highlight-text">{highlight.text}</p>}

      {highlight.kind === "list" &&
        (highlight.ordered ? (
          <ol className="highlight-items" data-ordered="true">
            {highlight.items.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ol>
        ) : (
          <ul className="highlight-items">
            {highlight.items.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        ))}

      {highlight.kind !== "point" && highlight.caveat && (
        <p className="highlight-caveat">{highlight.caveat}</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: ChapterExercises에 prop을 더한다**

`apps/web/components/ChapterExercises.tsx`에서:

1. import를 더한다.

```tsx
import ChapterHighlight from "@/components/ChapterHighlight";
import { type Exercise, type Highlight, type SourceNote } from "@/content/curriculum/types";
```

2. props 타입과 구조 분해에 `highlight`를 더한다. `sources` 바로 아래에 둔다.

```tsx
  /** 본문의 출처. 대가 챕터만 갖고 있어서 선택이다(비교 페이지에는 본문이 없다). */
  sources?: SourceNote[];
  /** 그 장의 뼈대. 대가 챕터만 갖는다. 비교 페이지에는 없다. */
  highlight?: Highlight;
```

3. 읽기 스텝에서 본문 위에 넣는다.

```tsx
        {step.kind === "read" && (
          <div className="prose">
            {highlight && <ChapterHighlight highlight={highlight} />}
            {body.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
            {sources && sources.length > 0 && <ChapterSources sources={sources} />}
          </div>
        )}
```

- [ ] **Step 3: 챕터 페이지에서 넘긴다**

`apps/web/app/learn/masters/[slug]/[chapter]/page.tsx`의 `<ChapterExercises …>`에 한 줄 더한다.

```tsx
        sources={chapter.sources}
        highlight={chapter.highlight}
```

- [ ] **Step 4: 스타일을 넣는다**

`apps/web/app/globals.css`의 `.prose p:last-child` 규칙 아래에 넣는다.

```css
/* ---------- 챕터 강조 블록 ---------- */

/* 색만으로 말하지 않는다. 위쪽 실선과 테두리라는 형태가 먼저 구분한다.
   골드를 쓰는 이유는 리드가 이미 와인을 쓰고 있어서다 — 둘이 경합하면
   무엇이 중심인지 다시 흐려진다. */

.highlight {
  max-width: 40em;
  margin: 0 0 1.75rem;
  padding: 1.05rem 1.2rem 1.15rem;
  background: var(--paper);
  border: 1px solid var(--gold-line);
  border-top: 3px solid var(--gold);
  border-radius: 0 0 10px 10px;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.highlight-label {
  margin: 0;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--gold-deep);
}

.highlight-expr {
  margin: 0;
  font-size: 1.12rem;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--ink);
  font-variant-numeric: tabular-nums;
}

.highlight-text {
  margin: 0;
  font-size: 1rem;
  line-height: 1.75;
  color: var(--ink);
}

.highlight-items {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.highlight-items li {
  font-size: 0.96rem;
  line-height: 1.7;
  color: var(--ink);
  display: grid;
  grid-template-columns: 1.4rem 1fr;
  gap: 0.5rem;
  align-items: baseline;
}

/* 순서가 뜻을 갖는 열거에만 번호를 매긴다. 순서 없는 항목에 번호를 붙이면
   없는 순서를 있다고 말하게 된다. */
.highlight-items[data-ordered="true"] {
  counter-reset: highlight-item;
}

.highlight-items[data-ordered="true"] li {
  counter-increment: highlight-item;
}

.highlight-items[data-ordered="true"] li::before {
  content: counter(highlight-item);
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--gold-deep);
  border: 1px solid var(--gold-line);
  border-radius: 4px;
  text-align: center;
  padding: 0.05rem 0;
}

.highlight-items:not([data-ordered="true"]) li::before {
  content: "";
  width: 0.4rem;
  height: 0.4rem;
  border-radius: 50%;
  background: var(--gold);
  justify-self: center;
  transform: translateY(-0.15em);
}

.highlight-caveat {
  margin: 0;
  padding-top: 0.55rem;
  border-top: 1px dotted var(--line-strong);
  font-size: 0.85rem;
  line-height: 1.65;
  color: var(--ink-soft);
}

@media (max-width: 30rem) {
  .highlight {
    padding: 0.9rem 1rem 1rem;
  }

  .highlight-expr {
    font-size: 1.02rem;
  }
}
```

- [ ] **Step 5: 빌드와 테스트를 돌린다**

Run: `cd apps/web && npm test && npm run build`
Expected: 둘 다 통과.

- [ ] **Step 6: 세 형태를 눈으로 확인한다**

Run: `cd apps/web && npm run dev`

세 주소를 차례로 연다.

| 주소 | 확인할 것 |
|---|---|
| `/learn/masters/graham/2` | `formula` — 수식이 굵게 서고 캐비엇이 점선 아래에 붙는다 |
| `/learn/masters/soros/2` | `list` + `ordered` — 다섯 단계에 번호 상자가 붙는다 |
| `/learn/masters/graham/3` | `list` 순서 없음 — 번호 대신 점이 붙는다 |
| `/learn/masters/marks/3` | `point` — 캐비엇 없이 한 문단만 선다 |

- [ ] **Step 7: 커밋**

```bash
cd "c:/Users/Har10/Desktop/wisor"
git add apps/web/components/ChapterHighlight.tsx apps/web/components/ChapterExercises.tsx "apps/web/app/learn/masters/[slug]/[chapter]/page.tsx" apps/web/app/globals.css
git commit -m "feat: 장의 뼈대를 본문 위에 세워 시선이 멈추게 한다

35개 장이 같은 무게의 문단 나열이라 무엇이 핵심인지 보이지 않았다.
색이 아니라 형태로 구분해 골드·오커의 판정 의미와 섞이지 않게 했다."
```

---

### Task 14: 최종 확인

**Files:** 없음(확인만)

**Interfaces:**
- Consumes: Task 1~13 전부
- Produces: 없음

- [ ] **Step 1: 전체 테스트와 빌드**

Run: `cd apps/web && npm test && npm run build`
Expected: 테스트 80개 통과, 정적 페이지 435개 생성.

- [ ] **Step 2: 서버 전용 경계가 지켜졌는지 본다**

Run: `cd apps/web && grep -rl "evEbitMedian5y" .next/static/`
Expected: 아무것도 나오지 않는다. 새 클라이언트 컴포넌트가 `lib/scores.ts`를 끌어오지 않았다는 뜻이다.

- [ ] **Step 3: 35개 장에 블록이 하나씩 있는지 센다**

Run:

```bash
cd apps/web && node --input-type=module -e "
const dir = 'C:/Users/Har10/Desktop/wisor/apps/web/content/curriculum/';
const names = ['graham','buffett','fisher','greenblatt','lynch','marks','soros'];
const tally = {};
let n = 0;
for (const name of names) {
  const c = Object.values(await import(dir + name + '.ts'))[0];
  for (const ch of c.chapters) { n++; tally[ch.highlight.kind] = (tally[ch.highlight.kind] ?? 0) + 1; }
}
console.log('장', n, tally);
"
```

Expected: `장 35 { point: 10, formula: 6, list: 19 }`

- [ ] **Step 4: 키보드로 지나가 본다**

`npm run dev`로 `/learn/masters/graham/2`를 연다. Tab만으로 읽기 → 문항 → 정리 → 다음 장까지 갈 수 있는지 본다. 강조 블록이 새 포커스 대상을 만들지 않아야 한다(블록 안에 버튼이나 링크가 없다).

- [ ] **Step 5: 375px에서 본다**

브라우저 폭을 375px로 줄이고 위 네 주소를 다시 연다. 가로 스크롤이 생기지 않아야 하고, 긴 항목과 캐비엇이 잘리지 않고 접혀야 한다.

- [ ] **Step 6: 커밋할 것이 남았으면 커밋한다**

Run: `cd "c:/Users/Har10/Desktop/wisor" && git status --short`
Expected: 이 작업으로 바뀐 파일이 없다. 남아 있으면 무엇이 왜 남았는지 확인하고 커밋한다.

---

## 되돌리는 법

Task 10에서 `highlight`를 필수로 바꾼 뒤에는 콘텐츠 태스크만 되돌릴 수 없다. 되돌려야 하면 Task 10 커밋을 먼저 되돌려 선택 필드로 돌아간 뒤 콘텐츠를 손본다.
