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
