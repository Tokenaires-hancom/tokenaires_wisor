# 투자 스타일 커리큘럼 — 설계

작성일 2026-08-06 · 원본 `investment-styles-curriculum.md`(투자 스타일 7유형 × 5장)

---

## 목표

대가 학습 콘텐츠를 원칙 나열에서 **챕터 커리큘럼**으로 바꾼다. 일곱 스타일이 같은 다섯 칸(전제·탐색·검증·처분·실패)을 공유하므로 챕터 단위 횡단 비교가 가능해진다.

지금 콘텐츠는 대가 3명 × 원칙 5개 + 객관식 3문항이다. 원칙은 읽고 끝나고, 퀴즈는 개념 확인에 그친다. 문서가 제안하는 3계층 문제(채점형·첨삭형·기록형)는 **읽은 것을 자기 상황에 대보게 하는 장치**이고, 이 제품이 사용자를 "무엇을 확인해야 하는가"로 데려간다는 원칙과 맞는다.

## 범위

**1단계 (이 문서)** — 기존 대가 3명을 5장 골격으로 옮기고 문제 3계층을 구현한다.

| 항목 | 영역 |
|---|---|
| 커리큘럼·문항 타입 설계 | `content/curriculum/` |
| 버핏·그레이엄·린치 15개 챕터 본문 + 문항 약 39개 (문서 30 + 기존 퀴즈 9 재배치) | `content/curriculum/` |
| 채점형(복수정답 포함)·첨삭형·기록형 컴포넌트 | `components/` |
| 기록형 저장과 재노출 | `lib/store.ts` |
| 챕터 라우트·목차 페이지 개조 | `app/learn/masters/` |
| 진도 집계 갱신 | `app/me/`, `components/MyLearning.tsx` |
| `Master.quiz` 제거에 따른 문구 수정 | `app/page.tsx`, `app/learn/page.tsx` |

**2단계 (별도 스펙)** — 피셔·그린블랫·막스·소로스 4명 추가, 그린블랫 순위 기반 점수 모델, 횡단 비교 페이지.

먼저 3명으로 구조를 돌려보고 분량과 사용감을 확인한 뒤 나머지를 채운다.

## 결정 사항

### 스타일 7개를 모두 넣되 점수 모델은 되는 것만

문서의 7개 스타일 중 개별 종목 재무 지표로 판정할 수 있는 것은 일부뿐이다.

| 스타일 | 점수 모델 | 근거 |
|---|---|---|
| 버핏 · 그레이엄 · 린치 | 이미 있음 | Buffett 1.0 / Graham 0.9 / Lynch 0.9 |
| 그린블랫 | 2단계에 추가 | 자본수익률·이익수익률 둘 다 `Metrics`에 있음. 단 **순위 합산**이라 `Criterion.test`가 종목 하나만 보는 현재 구조를 확장해야 함 |
| 피셔 | 만들지 않음 | R&D 생산성·이익률 유지·경영진 정직성. 원천에 R&D와 매출총이익 항목이 없고 본질이 정성 탐문 |
| 막스 | 만들지 않음 | 신용 스프레드·리스크 프리미엄·시장 심리. 개별 종목이 아니라 **시장 레벨** 데이터 |
| 소로스 | 만들지 않음 | 가격 추세·자금 유입. `Fundamentals.price`가 단일 스칼라라 가격 시계열이 없음 |

피셔·막스·소로스는 점수 대신 **자가진단 체크리스트**를 붙인다(2단계). 재무 지표로 근사하면 그 스타일이 실제로 묻는 것과 다른 것을 재게 되고, 이는 스타일을 잘못 가르치는 결과다.

### 기존 콘텐츠는 개요로 남긴다

`content/masters.ts`의 `intro` · `oneLine` · `likes` · `failsWhen` · `principles`는 목차 페이지의 요약으로 유지한다. 검수된 한국어 문장이라 버릴 이유가 없다.

`Master.quiz`(9문항)는 제거하고 주제가 맞는 장의 `graded` 문항으로 옮긴다.

| 기존 문항 | 옮길 곳 |
|---|---|
| 버핏 — 해자의 뜻 | 2장 탐색 |
| 버핏 — 순이익이 아니라 잉여현금흐름을 보는 이유 | 3장 검증 |
| 버핏 — 가격은 어떤 위치인가 | 5장 실패 (좋은 회사를 비싸게 사는 것) |
| 그레이엄 — 안전마진 | 1장 전제 |
| 그레이엄 — 유동비율을 보는 이유 | 3장 검증 |
| 그레이엄 — 가치함정 | 5장 실패 |
| 린치 — PER 24배 두 회사 | 3장 검증 |
| 린치 — 이익은 늘고 매출은 제자리 | 3장 검증 |
| 린치 — 가장 크게 틀리는 상황 | 5장 실패 |

`QuizItem` **타입 자체는 `masters.ts`에 남긴다** — `content/chartLessons.ts`(4번 담당)가 쓰고 있고, 그 파일을 건드리지 않기 위해서다.

`Master.quiz`를 지우면 `app/page.tsx`의 홈 카드가 타입 오류를 낸다. 지금 `{master.minutes}분 학습 · 기준 {master.principles.length}개 · 퀴즈 {master.quiz.length}문항`인 줄을 **`기준 {principles.length}개 · {chapters.length}장`**으로 바꾼다. 퀴즈가 챕터 안으로 들어갔으므로 홈에서 따로 셀 것이 아니다.

### 채점형은 객관식으로 통일한다

문서의 채점형 절반이 계산·단답이다(NCAV, PEG, 복리 배수). 계산 **결과**를 선택지로 만들어 객관식화한다.

```
Q. 유동자산 800억, 총부채 500억, 시가총액 180억. NCAV와 시총/NCAV 비율은?
   ① 300억 · 0.6   ② 300억 · 1.67   ③ 1,300억 · 0.14   ④ 180억 · 1.0
```

숫자 입력 채점은 단위·반올림·복수 정답 처리가 필요하고, 정답인데 오답으로 뜨는 순간 학습자가 신뢰를 잃는다. 30문항 중 6~7개를 위해 채점기를 하나 더 만들 값어치가 없다. 나중에 `graded`에 변형을 추가하는 형태로 얹을 수 있으므로 지금 없다고 막히는 것은 없다.

### 4장(처분) 서술은 3인칭으로 고정한다

루트 CLAUDE.md는 매수·매도·손절 류 문구를 금지한다. 4장이 다루는 것은 "이 스타일은 어떤 조건에서 파는가"라는 **지식**이지 사용자에게 팔라는 권유가 아니므로 원칙과 양립한다. 다만 선을 코드로 긋는다.

- 쓴다 — "이 스타일은 가치에 닿으면 판다", "논거가 깨질 때만 판다"
- 쓰지 않는다 — "지금 파세요", "손절하세요", "이 종목을 정리하는 게 좋습니다"

문서의 기록형 문항이 이미 "당신은 …할 수 있습니까?"라는 성찰형이라 이 선과 맞는다.

---

## 콘텐츠 구조

### 타입

```ts
// content/curriculum/types.ts
import type { Master } from "../masters";   // 반드시 type import.
                                            // 값으로 가져오면 CHAPTER_SLOTS를 쓰는 클라이언트
                                            // 컴포넌트에 masters.ts 전체가 실린다

export const CHAPTER_SLOTS = [
  { no: 1, slot: "premise", label: "전제", asks: "이 스타일은 시장에 대해 무엇을 가정하는가" },
  { no: 2, slot: "search",  label: "탐색", asks: "무엇을, 어디서 찾는가" },
  { no: 3, slot: "verify",  label: "검증", asks: "사기 전에 무엇을 확인하는가" },
  { no: 4, slot: "exit",    label: "처분", asks: "언제까지 들고, 무엇이 팔게 하는가" },
  { no: 5, slot: "failure", label: "실패", asks: "이 스타일은 어떻게 무너지는가" },
] as const;

export type Exercise =
  | { kind: "graded";  prompt: string; choices: string[]; answers: number[]; explain: string }
  | { kind: "guided";  prompt: string; checkpoints: string[] }
  | { kind: "journal"; prompt: string };

export type Chapter = {
  title: string;        // 칸 이름이 아니라 그 장의 제목
  lede: string;         // 문서의 인용구
  body: string[];       // 단락 배열. 한 단락 2~4문장
  exercises: Exercise[];
};

export type Curriculum = {
  masterId: Master["id"];
  sellType: string;     // "가격 도달형"
  sellTrigger: string;  // "가치에 닿거나 기한 만료"
  currency: string;     // "학습 내용은 2026년 7월 기준입니다"
  chapters: [Chapter, Chapter, Chapter, Chapter, Chapter];
};
```

`Chapter`에 `no`나 `slot`을 넣지 않는다. 배열 위치가 곧 칸이다. 중복해서 들고 있으면 어긋날 수 있고, 어긋나면 횡단 비교가 조용히 깨진다. 길이 5 튜플이 "모든 스타일이 다섯 칸을 채운다"를 타입으로 보장한다.

`answers`가 배열인 것은 문서에 복수정답이 있기 때문이다("해자가 아닌 것을 **모두** 고르세요"). 단일 정답이면 길이 1.

`sellType`·`sellTrigger`는 2단계 횡단 비교표에 쓸 값이지만 데이터는 지금 넣는다. 그때는 페이지만 만들면 된다.

### 파일 배치

```
content/masters.ts          quiz 필드 제거. 나머지는 그대로 (QuizItem 타입 포함)
content/curriculum/
  types.ts                  위 타입 + CHAPTER_SLOTS
  buffett.ts                C. 해자 집중형
  graham.ts                 A. 안전마진형
  lynch.ts                  D. 저평가 성장형
  index.ts                  CURRICULA · CURRICULUM_BY_MASTER · chapterOf + 로드 시점 검사
```

배열 순서는 문서의 `A/C/D`가 아니라 기존 `MASTERS` 순서(버핏·그레이엄·린치)를 따른다. 목차 페이지와 스크리너가 이미 그 순서다. 문서가 제안한 학습 순서(버핏 → 그레이엄 → 린치)는 `/learn`의 안내 문구로 넣는다.

### 본문 출처

문서의 각 장은 인용구 1줄 + 서술 3~5문장이다. `lede` + `body` 2~3단락으로 옮긴다.

`principles`와 챕터 본문의 관계를 명확히 해 둔다. **`principles`는 `masters.ts`에 그대로 남아 목차 페이지의 요약 카드가 되고, 챕터 본문은 문서를 바탕으로 새로 쓴다.** 같은 문장을 두 곳에 복제하지 않는다. 개념이 겹칠 때(예: 버핏의 "장부상 이익이 아니라 현금이 들어오는가"와 3장 검증의 소유주이익)는 요약 카드가 한 줄로 말하고 챕터가 자세히 말하는 관계가 된다.

문서의 계산 문항은 값을 검산했고 전부 맞다.

| 문항 | 검산 |
|---|---|
| NCAV | 800 − 500 = 300, 180 ÷ 300 = 0.6 ≤ 0.67 통과 |
| PEG | 36 ÷ 12 = 3.0, 기준선 1 초과 |
| 복리 20년 | 1.12²⁰ = 9.646 → 세후 7.744 / 연 9.36% 복리 = 5.986 / 차이 29.4% |
| 성장주 하락 | 0.8 × 0.5 = 0.4, −60% |

사실관계 문장(프리시전 캐스트파츠, 2023~24년 애플 매도, 버크셔의 보험 플로트)은 문서 그대로 옮긴다. 확인 없이 고치지 않는다.

---

## 화면과 컴포넌트

### 라우트

| 경로 | 상태 | 내용 |
|---|---|---|
| `/learn/masters/[slug]` | 개조 | 개요 + 5장 목차 + `principles` 요약 카드 + 이 스타일의 매도 조건 + 스크리너 링크. 기존 `<Quiz>` 블록 제거 |
| `/learn/masters/[slug]/[chapter]` | 신규 | 챕터 본문 + 연습문제. `generateStaticParams` 3 × 5 = 15 |
| `/me` | 개조 | 챕터 진도 + 되돌아볼 기록 |

Next 15이므로 `params`는 Promise다. `await` 한다.

### ChapterExercises

클라이언트 경계는 챕터당 하나다.

```tsx
<ChapterExercises chapterId="master:buffett:3" exercises={chapter.exercises} />
```

`"use client"`는 이 컴포넌트에만 붙는다. 챕터 본문은 서버 컴포넌트로 남고 `lib/scores.ts`는 어디서도 import하지 않는다.

| 계층 | 동작 | 저장 |
|---|---|---|
| `graded` | 선택지 토글(복수정답이면 다중). "답 확인하기" → `.choice[data-state]`로 정오 표시 + `explain` 공개. 되돌리기 없음 | 정답률 |
| `guided` | `textarea` 입력 후 "체크 포인트 보기" → 체크 포인트 공개. **점수 없음**. 입력이 비면 버튼 비활성 | 없음 |
| `journal` | `textarea` 입력 후 "기록하기" → 저장. 이후 "기록했습니다 · 3개월 뒤 다시 묻습니다" 표시 | 원본 |

`guided`와 `journal` 모두 입력이 비어 있으면 버튼이 비활성이다. `guided`는 먼저 써보지 않고 답을 보면 배우는 것이 없어서고, `journal`은 빈 기록을 90일 뒤에 다시 보여줄 이유가 없어서다.

### 진도 기록 — 채점형이 없는 장이 있다

**여섯 개 장에 채점형 문항이 하나도 없다.** 문서 기준으로 그레이엄 3·5장, 버핏 1·5장, 린치 1·5장이 첨삭형 + 기록형으로만 이루어져 있다. 위 재배치로 네 개는 채워지지만 버핏 1장과 린치 1장은 여전히 채점형이 없다.

`store.ts`에서 `lessonsDone`에 값을 넣는 경로는 `recordQuiz`와 `markLessonDone` 둘뿐이다. 채점형 제출에만 진도를 걸면 이 장들은 영원히 미완으로 남고 `/me`가 15장을 채울 수 없다. **그래서 진도와 점수를 분리한다.**

```ts
// 챕터의 모든 문항을 한 번씩 처리하면 — 채점형 유무와 무관하게
await markLessonDone("master:buffett:1");

// 채점형이 있는 장만 추가로 점수를 남긴다
if (gradedTotal > 0) await recordQuiz("master:buffett:1", correct, gradedTotal);
```

"처리했다"의 기준은 계층마다 다르다. `graded`는 답 확인, `guided`는 체크 포인트 열람, `journal`은 기록 저장이다.

진도 id를 `master:<대가>:<장>` 3단으로 두면 `/me`가 "워런 버핏 3장 · 검증"으로 라벨을 만들 수 있다.

기존 `components/Quiz.tsx`는 건드리지 않는다. `content/chartLessons.ts`가 계속 쓴다.

### CSS

기존 클래스를 최대한 쓴다. `.choice[data-state="correct"|"wrong"|"missed"]`가 이미 자두색·황토색·점선으로 돼 있어 채점형은 그대로 쓰고, 자유입력은 `.field` + `.btn`을 쓴다. 제목은 `h2.section`·`h3.sub`로 정의돼 있으므로 해당 태그로 쓴다.

새로 추가 — `.chapter-progress`(5칸 진행 표시) · `.chapter-title` · `.chapter-lede`(인용구) · `.prose`(본문 단락) · `.toc` · `.chapter-nav` · `.checkpoints`.

토큰만 쓴다. 하드코딩 hex를 넣지 않는다. 빨강·초록을 쓰지 않는다.

### /me 변경

1. "투자 대가 학습 3개 중 n개" → "**대가 챕터 15장 중 n장**". `lessonsDone`에서 `master:` 3단 id를 센다
2. **"되돌아볼 기록"** 섹션 신규 — 90일 지난 `journal` 답을 질문과 함께 다시 보여주고 그 자리에서 다시 쓰게 한다

라벨은 `MASTER_BY_ID`(이미 클라이언트)와 `CHAPTER_SLOTS`(상수 5개)로만 만든다. 챕터 제목·본문은 서버에만 남는다.

---

## 저장소

`lib/store.ts`에 추가한다. 기존 함수 시그니처는 건드리지 않는다.

```ts
export type JournalEntry = {
  id: string;      // "master:buffett:1#2" — 챕터 + 문항 위치
  prompt: string;  // 질문을 함께 저장한다
  text: string;
  at: string;
};

export async function getJournal(): Promise<JournalEntry[]>
export async function saveJournalEntry(id: string, prompt: string, text: string): Promise<JournalEntry>
export async function dueJournalEntries(afterDays?: number): Promise<JournalEntry[]>   // 기본 90
```

새 키는 `wisor.journal` 하나다. 모든 함수는 `Promise`를 돌려준다 — Supabase 교체를 위해 맞춰 둔 규칙이다.

**질문을 답과 함께 저장하는 이유**는 `/me`가 클라이언트 컴포넌트이기 때문이다. 질문을 커리큘럼에서 찾아오게 하면 챕터 본문 전체가 브라우저 번들에 실린다. `lib/scores.ts`를 클라이언트에서 막는 것과 같은 이유다.

### 소유권

`lib/store.ts`는 2번(백엔드·통합) 담당이고 루트 CLAUDE.md는 남의 영역을 직접 고치지 말라고 한다. 이 변경은 기존 함수를 건드리지 않는 순수 추가이고, 별도 `lib/journal.ts`로 빼는 우회는 오히려 규칙의 취지(Supabase 교체 지점을 한 곳으로 유지)를 깬다. **추가만 하고 PR에서 2번 리뷰를 받는다.**

---

## 검증

새 검사 스크립트를 만들지 않는다. `content/curriculum/index.ts` 하단에 모듈 로드 시점 검사를 둔다. 페이지가 전부 정적 생성이므로 이것이 곧 빌드 타임 검사이고, 실패하면 `npm run build`가 죽는다.

타입이 못 잡는 것만 본다.

- `answers` 인덱스가 `choices` 범위 밖 — **잘못된 정답을 가르치게 된다**
- `answers` · `checkpoints` · `body`가 빈 배열
- 2인칭 권유형 문구 — "지금 사", "지금 파", "손절하", "추천합니다"

의존성이 0이고, 이 프로젝트가 이미 쓰는 방식(금지어 검사를 실행되는 코드로 두는 것)과 같다.

```bash
cd apps/web && npm run build     # 타입 + 15개 챕터 정적 생성 + 위 검사
```

그리고 손으로 본다 — 375px 폭에서 깨지지 않는지, 키보드 Tab으로 모든 조작이 되는지, `graded` 제출 후 `explain`이 읽히는지.

`data-pipeline`과 `services/chart-api`는 이 작업에서 건드리지 않으므로 회귀 확인만 한다.

---

## 이 스펙에서 하지 않는 것

- 피셔·그린블랫·막스·소로스 4명 (2단계)
- 그린블랫 점수 모델과 순위 기반 판정 프레임워크 확장 (2단계, `data-pipeline` 3번 영역)
- 횡단 비교 페이지 — 지금 3행뿐이라 페이지 하나를 쓸 값어치가 없다. 데이터(`sellType`·`sellTrigger`)는 넣어 두고 7개가 찬 뒤 만든다
- 숫자 입력 채점 — `graded` 변형으로 나중에 얹을 수 있다
- 첨삭형의 축별 태그 저장 — 문서는 언급하나 지금은 태그 체계가 없다
- Supabase 연결 — `store.ts`는 여전히 브라우저 저장이다
