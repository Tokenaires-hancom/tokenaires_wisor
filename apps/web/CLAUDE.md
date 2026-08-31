# CLAUDE.md — apps/web

> 담당: 1번(제품·UX·프론트엔드), 2번(`lib/store.ts` 및 Supabase 연동)
> 루트 `CLAUDE.md`의 규칙이 먼저 적용됩니다.

## 스택

Next.js 15 App Router · React 19 · TypeScript strict · **순수 CSS**

Tailwind, CSS-in-JS, UI 라이브러리를 쓰지 않습니다. 스타일은 `app/globals.css`의 토큰과 클래스만 씁니다. 인라인 `style`은 일회성 여백 조정에만 허용합니다.

## 데이터

```
lib/generated/scores.json   ← 로컬·빌드 fallback. data-pipeline이 만들며 손으로 고치지 않는다
lib/scores.ts               ← 서버 전용. SCORES_JSON_PATH 우선 런타임 로더
lib/scores.types.ts         ← 클라이언트 안전. 타입과 라벨만
content/masters.ts          ← 대가 3명 학습 콘텐츠 + 퀴즈
lib/store.ts                ← 사용자 데이터 저장. Supabase 교체 지점
lib/analytics.ts            ← 측정 이벤트
```

### 서버 전용 경계

**클라이언트 컴포넌트는 `lib/scores.ts`를 import하지 않습니다.** 이 파일은 Node 파일시스템으로 scores.json 전체를 읽으므로 클라이언트에서 실행할 수 없고, 경계를 흐리면 재무데이터가 브라우저 번들로 들어갈 수 있습니다. 500종목이면 5MB에 가깝습니다.

- 타입과 라벨 → `lib/scores.types.ts`에서 가져옵니다
- 데이터 → 서버 컴포넌트가 필요한 만큼만 props로 내려보냅니다 (`app/me/page.tsx`가 예시입니다)
- 실수로 import하면 브라우저에서 모듈 평가 시 예외가 납니다. 조용히 통과하지 않습니다

빌드 후 확인: `grep -rl "evEbitMedian5y" .next/static/`가 비어 있어야 합니다.

### 저장소

**컴포넌트에서 `localStorage`를 직접 부르지 않습니다.** 반드시 `lib/store.ts`를 거칩니다. 2번이 Supabase를 붙일 때 이 파일의 함수 본문만 교체하기로 돼 있습니다.

**`store.ts`의 함수는 전부 `Promise`를 돌려줍니다.** localStorage는 동기지만 Supabase는 비동기라서 시그니처를 미리 맞춰 뒀습니다. 편의상 동기로 되돌리지 마세요.

## 디자인 토큰

색은 `globals.css`의 CSS 변수만 씁니다. 하드코딩한 hex를 새로 넣지 않습니다.

듀오링고를 레퍼런스로 삼습니다. 듀오링고가 초록을 쓰는 자리를 골드(`--gold`)가 받고, 버건디(`--wine`)는 포인트에만 씁니다.

```
--gold    데이터 화면의 충족·주요 버튼      --wine    포인트·버튼·학습 화면
--ochre   미충족·주의                      --ink     본문 / --ink-soft 보조 설명
--line    경계선                           --paper / --surface 배경
```

**빨강·초록 금지.** 이유는 루트 `CLAUDE.md`에 있습니다 — 주식 화면에서 빨강·초록은 가격 방향을 뜻하므로 방향을 말하지 않는 이 제품은 그 두 색을 팔레트에서 뺍니다. `--wine`(#C2183C)은 색상환상 빨강에 가깝지만 가격 방향을 표시하는 데는 쓰지 않습니다: 화면(screener, stocks) 위의 충족/pass 표시는 반드시 `--gold`를 쓰고, `--wine`은 버튼·포커스 링·`.style-name` 배지·학습(`/learn`) 화면의 퀴즈 정답 표시처럼 방향과 무관한 자리에만 씁니다.

상태를 색으로만 구분하지 말고 채움·빗금·점선을 함께 씁니다(`CriteriaBar` 참고). `--gold`와 `--ochre`는 색상환에서 이웃이라 더더욱, pass/fail/unknown 구분은 색이 아니라 형태(채움 / 빗금+테두리 / 점선)가 책임집니다.

골드 위에 흰 글씨를 얹을 때는 대비가 낮으므로(2.05:1) 16px 이상, `font-weight: 700` 이상에서만 씁니다. 작은 설명 문구를 골드 배경에 올리지 않습니다.

활자는 명조 구분이 없습니다. 산스(`--sans`)가 전부를 담당하고, 모노(`--mono`)는 티커·날짜·수치에만 씁니다. 제목과 본문의 대비는 서체가 아니라 굵기로 만듭니다 — 제목은 `font-weight: 800`.

## 서명 요소

`components/CriteriaBar.tsx`는 이 제품의 정체성입니다. 큰 점수 숫자가 주인공이 되지 않도록 만든 것이므로, 점수를 더 크게 강조하거나 기준 막대를 빼는 방향의 변경은 하지 않습니다.

## 종목 상세의 두 관점

`components/StockLenses.tsx`는 기업 관점 / 학습노트를 탭으로 분리합니다.

## 문구

`components/`와 `app/`의 모든 한국어 문장은 사용자에게 그대로 나갑니다. 루트 `CLAUDE.md`의 문구 규칙표를 따릅니다.

- 능동태, 문장형 대문자 없이, 군더더기 없이
- 버튼 이름은 흐름 내내 같게 씁니다("학습노트 저장" → 저장 후에도 같은 이름)
- 빈 화면은 분위기가 아니라 다음 행동을 안내합니다
- 오류는 무엇이 잘못됐고 어떻게 고치는지 말합니다. 사과하지 않습니다

## 새 페이지를 만들 때

1. 배치 데이터와 무관한 페이지는 `generateStaticParams`로 정적 생성 가능한지 먼저 봅니다. `scores.json`을 읽는 페이지는 런타임 교체를 반영하도록 동적 렌더링합니다
2. Next 15에서 `params`와 `searchParams`는 Promise입니다. `await` 합니다
3. 상태가 필요할 때만 `"use client"`를 붙입니다
4. 점수를 보여주는 화면에는 `<DataStamp>`를 반드시 넣습니다

## 확인

```bash
npm run build     # 커밋 전 필수. 타입 오류와 정적 생성 실패를 여기서 잡는다
```

모바일 폭(375px)에서 깨지지 않는지, 키보드 Tab으로 모든 조작이 가능한지 함께 봅니다.
