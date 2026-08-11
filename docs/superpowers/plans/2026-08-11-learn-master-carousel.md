# 배우기 대가 선택 레일 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/learn`의 상단 학습 도구를 오른쪽에 정리하고, 넓어진 화면 안에서 버핏 전신 캐릭터가 중심이 되는 큰 가로 스냅 레일을 제공한다.

**Architecture:** 상호작용은 새 클라이언트 컴포넌트 `MasterCarousel`에 격리한다. 서버 페이지는 기존 콘텐츠를 유지하고 컴포넌트만 호출하며, 레이아웃·호버 화살표·모바일 스냅은 `globals.css`가 담당한다.

**Tech Stack:** Next.js 15, React 19, TypeScript, 순수 CSS

## Global Constraints

- 새 UI 라이브러리를 추가하지 않는다.
- 자동 넘김을 넣지 않는다.
- 버핏 외 대가는 기존 `/investors/{id}.png`를 사용한다.
- `.claude/launch.json`은 수정하거나 스테이징하지 않는다.
- 버핏 이미지는 `C:/Users/Har27/Desktop/캐릭/워랜 메인1.png`를 유지한다.

---

### Task 1: 대가 선택 캐러셀

**Files:**
- Create: `apps/web/components/MasterCarousel.tsx`
- Modify: `apps/web/app/learn/page.tsx`
- Modify: `apps/web/app/globals.css`
- Copy: `C:/Users/Har27/Desktop/캐릭/워랜 메인1.png` → `apps/web/public/characters/buffett/main.png`

**Interfaces:**
- Consumes: `MASTERS`, `MasterCharacter`가 사용하던 대가 메타데이터, `/investors/{id}.png`
- Produces: `MasterCarousel(): JSX.Element`, `.master-carousel*` CSS 클래스

- [x] **Step 1: 기준 검증을 실행한다**

Run: `cd apps/web && npm test`
Expected: 현재 테스트 전체 통과

- [x] **Step 2: 캐러셀 컴포넌트를 만든다**

`MasterCarousel`은 `useRef<HTMLUListElement>`로 레일을 잡고, 화살표 클릭 시 첫 카드의 실제 너비와 `gap`을 읽어 한 카드만큼 `scrollBy({ behavior: "smooth" })`한다. 버핏은 `/characters/buffett/main.png`, 나머지는 `/investors/{id}.png`를 사용한다.

- [x] **Step 3: 배우기 페이지에서 기존 그리드를 교체한다**

`apps/web/app/learn/page.tsx`의 `MASTERS.map` 블록을 `<MasterCarousel />`로 교체하고 더 이상 쓰지 않는 import를 제거한다.

- [x] **Step 4: 레일과 카드 스타일을 추가한다**

데스크톱 카드 폭은 `280px`, 모바일은 `86vw`로 한다. 레일은 `overflow-x: auto`, `scroll-snap-type: x mandatory`, 카드는 `scroll-snap-align: start`를 사용한다. 화살표는 데스크톱에서 레일 가장자리에 겹치고 기본 `opacity: .35`, 컨테이너 호버와 `:focus-visible`에서 `opacity: 1`이 된다. `max-width: 640px`에서는 화살표를 숨긴다.

- [x] **Step 5: 브라우저에서 검증한다**

`/learn`에서 버핏 전신 이미지, 동일 높이 카드, 화살표 클릭 이동, 모바일 스와이프 스냅, 페이지 가로 오버플로 없음, 키보드 포커스를 확인한다.

- [x] **Step 6: 전체 검증을 실행한다**

Run: `cd apps/web && npm test && npm run build`
Expected: 테스트 66개 이상 통과, 빌드 성공

- [x] **Step 7: 커밋한다**

```powershell
git add -- apps/web/components/MasterCarousel.tsx apps/web/app/learn/page.tsx apps/web/app/globals.css apps/web/public/characters/buffett/main.png docs/superpowers/specs/2026-08-11-learn-master-carousel-design.md docs/superpowers/plans/2026-08-11-learn-master-carousel.md
git commit -m "feat: 배우기 대가 선택을 카드 레일로 바꾼다"
```

---

### Task 2: 표시 피드백 반영

**Files:**
- Modify: `apps/web/app/learn/page.tsx`
- Modify: `apps/web/components/StockBasicsLauncher.tsx`
- Modify: `apps/web/app/globals.css`

**Interfaces:**
- Consumes: 기존 `StockBasicsLauncher`, `/learn/compare`, `.master-carousel*`
- Produces: `.learn-page`, `.learn-page-header`, `.learn-tools`, `.learn-tool` 레이아웃 클래스

- [x] **Step 1: 기존 테스트를 기준선으로 실행한다**

Run: `cd apps/web && npm test`
Expected: 테스트 66개 이상 통과

- [x] **Step 2: 상단 학습 도구를 제목 오른쪽에 재배치한다**

`StockBasicsLauncher`의 버튼 이름을 `주식 기본개념`으로 줄이고, 비교 링크 이름을 `대가들의 투자철학 비교`로 바꾼다. 두 항목은 `.learn-tools` 안에서 세로로 쌓고 모바일에서는 제목 아래로 이동한다.

- [x] **Step 3: 배우기 전용 폭과 카드 크기를 늘린다**

`.learn-page` 최대 폭을 `1440px`, 데스크톱 카드 폭을 `360px`, 최소 높이를 `500px`, 삽화 높이를 `330px`로 바꾼다. `.master-card-art`의 회색 배경을 제거하고 버핏 전신 이미지가 바닥을 기준으로 크게 보이게 한다.

- [x] **Step 4: 실제 화면을 검증한다**

`/learn` 데스크톱에서 상단 도구 위치, 세 장 안팎의 큰 카드, 흰 삽화 배경, 화살표 이동을 확인한다. 모바일에서는 도구가 제목 아래에 쌓이고 카드 스와이프와 페이지 가로 오버플로가 정상인지 확인한다.

- [x] **Step 5: 전체 검증을 실행한다**

Run: `cd apps/web && npm test && npx tsc --noEmit && npm run build`
Expected: 테스트 전체 통과, 타입 검사와 빌드 성공

---

### Task 3: 정렬·카드 비율·위치 표시 보정

**Files:**
- Modify: `apps/web/app/globals.css`
- Modify: `apps/web/components/MasterCarousel.tsx`
- Modify: `apps/web/lib/carouselRange.ts`
- Test: `apps/web/lib/carouselRange.test.ts`

**Interfaces:**
- Consumes: `.learn-page`, `.learn-tools`, `.master-carousel-item`, `getCarouselRange`
- Produces: `formatCarouselRange(start: number, end: number): string`

- [x] **Step 1: 간단한 범위 표시의 실패 테스트를 작성한다**

`formatCarouselRange(0, 3)`은 `1-4`, `formatCarouselRange(3, 6)`은 `4-7`, 한 장만 보이면 `1`을 반환해야 한다.

- [x] **Step 2: 테스트가 함수 부재로 실패하는지 확인한다**

Run: `cd apps/web && node --test lib/carouselRange.test.ts`
Expected: `formatCarouselRange`를 찾지 못해 실패

- [x] **Step 3: 정렬과 카드 비율을 최소 수정한다**

배우기 화면에서 `.masthead-inner` 최대 폭을 `1440px`로 맞추고, `.learn-page-header`를 한 열로 바꾼다. `.learn-tools`는 데스크톱에서 두 열, 모바일에서 한 열로 둔다. 카드 폭은 `336px`로 줄이고 버핏 이미지의 `scale(1.08)`을 제거한 뒤 위쪽 `12px` 안전 여백을 확보한다.

- [x] **Step 4: 범위 표시를 단순화한다**

`formatCarouselRange`를 구현해 화면에는 `1-4`만 표시하고, 진행 문단의 `aria-label`에는 `현재 1번부터 4번 카드 표시, 전체 7명`을 제공한다.

- [x] **Step 5: 실제 화면과 전체 회귀를 검증한다**

데스크톱에서 로고·제목 기준선, 제목 아래 학습 도구, 네 장 카드, 버핏 머리 여백, `1-4` 표시를 확인한다. 모바일에서는 한 열 도구, 한 카드 범위, 페이지 오버플로 없음과 화살표 숨김을 확인한다.

Run: `cd apps/web && npm test && npx tsc --noEmit && npm run build`
Expected: 테스트 전체 통과, 타입 검사와 빌드 성공

---

### Task 4: 대형 화면 사이드 도구와 버핏 확대

**Files:**
- Modify: `apps/web/app/learn/page.tsx`
- Modify: `apps/web/app/globals.css`

**Interfaces:**
- Consumes: `.learn-page-header`, `.learn-tools`, `MasterCarousel`
- Produces: `.learn-selection` 레이아웃 컨테이너

- [x] **Step 1: 학습 도구와 캐러셀을 같은 선택 영역으로 묶는다**

`apps/web/app/learn/page.tsx`에서 제목만 `.learn-page-header`에 남기고, `.learn-tools`와 `<MasterCarousel />`을 새 `.learn-selection` 안에 배치한다.

- [x] **Step 2: 대형 화면 사이드바를 적용한다**

기본 화면에서는 도구가 카드 위에 머물게 한다. `min-width: 1700px`에서는 `.learn-tools`를 `right: calc(100% + 2.5rem)`, `width: 200px`로 카드 레일 왼쪽에 절대 배치하고 한 열로 쌓는다.

- [x] **Step 3: 버핏 전신 이미지 영역을 키운다**

데스크톱 `.master-card` 최소 높이를 `560px`, `.master-card-art` 높이를 `390px`, 캐러셀 화살표의 세로 위치를 `196px`로 바꾼다. 모바일의 기존 `460px` 카드와 `300px` 삽화 높이는 유지한다.

- [x] **Step 4: 전체 회귀와 로컬 응답을 검증한다**

Run: `cd apps/web && npm test && npx tsc --noEmit && npm run build`
Expected: 테스트 전체 통과, 타입 검사와 빌드 성공. 개발 서버 재실행 후 `/learn` HTTP 200.
