# 주식 기본개념 튜토리얼 — 전달용 패키지

다섯 단원(주식이란? · 시장 구조 · 가격과 시가총액 · 배당·자사주매입 · 리스크와 분산)을 담은
듀오링고 스타일 튜토리얼 기능입니다. `/learn` 페이지의 카드를 누르면 **페이지 이동 없이 모달
팝업**으로 다섯 단원 + 퀴즈가 한 번에 뜨고, `Esc`나 배경 클릭·닫기 버튼으로 닫힙니다. `/me` 페이지
진행률·퀴즈 결과에도 정식으로 반영됩니다.

전용 라우트(`/learn/basics`)는 없습니다. 모든 내용은 `StockBasicsLauncher` 컴포넌트 하나가
트리거 카드와 모달을 함께 들고 있습니다.

새로 추가한 npm 패키지는 없습니다. `npm install`을 다시 돌릴 필요가 없습니다.

## 포함된 것

```
stock-basics-tutorial.patch   ← git이 있다면 이 파일 하나로 적용 가능
files/                        ← git 없이 수동으로 복사/병합할 때 참고할 "최종본" 파일들
  apps/web/content/stockBasics.ts                (신규)
  apps/web/components/DuoQuiz.tsx                (신규)
  apps/web/components/StockBasicsLauncher.tsx    (신규)
  apps/web/lib/analytics.ts                      (수정)
  apps/web/app/learn/page.tsx                    (수정)
  apps/web/components/MyLearning.tsx              (수정)
  apps/web/app/globals.css                       (수정)
```

## 적용 방법 (택 1)

### 방법 A — git 저장소를 쓰고 있다면 (추천)

저장소 루트(`apps` 폴더가 보이는 위치)에서:

```bash
git apply stock-basics-tutorial.patch
```

- 이미 `apps/web/lib/analytics.ts`, `apps/web/app/learn/page.tsx`,
  `apps/web/components/MyLearning.tsx`, `apps/web/app/globals.css`를 다른 작업으로 건드린
  상태라면 충돌이 날 수 있습니다. 그럴 땐 `git apply --3way stock-basics-tutorial.patch`로
  시도하거나, 아래 방법 B로 `files/` 폴더의 변경 부분만 직접 병합하세요.
- 적용 후 `git status`로 7개 파일(신규 3 + 수정 4)이 잡히는지 확인하면 됩니다.

### 방법 B — git 없이 수동으로 복사

1. **신규 파일 3개**는 그대로 같은 경로에 복사하면 끝입니다.
   - `apps/web/content/stockBasics.ts`
   - `apps/web/components/DuoQuiz.tsx`
   - `apps/web/components/StockBasicsLauncher.tsx`
2. **수정된 파일 4개**는 팀원의 로컬 버전과 다를 수 있으니, 아래 "무엇이 바뀌었나"를 참고해서
   `files/` 안의 최종본과 비교(diff)한 뒤 필요한 부분만 옮겨 붙이세요.

## 무엇이 바뀌었나 (수정 파일 4개)

### `apps/web/lib/analytics.ts`
`WisorEvent` 타입에 이벤트 2개 추가:
```ts
| "stock_basics_started"
| "stock_basics_completed"
```

### `apps/web/app/learn/page.tsx`
상단에 `StockBasicsLauncher` import 추가 + 페이지 맨 위에 "가장 먼저: 주식 기본개념" 섹션과
`<StockBasicsLauncher />` 호출 1개 추가. 이 컴포넌트는 카드(트리거)와 모달을 함께 렌더링하므로
별도 링크나 라우트가 필요 없습니다. 기존 "투자 대가에게 배우기" / "차트 기초 배우기" 섹션은
그대로 둡니다.

### `apps/web/components/MyLearning.tsx`
- `STOCK_BASICS`, `STOCK_BASICS_BY_ID` import 추가
- 기본개념 5단원 중 완료한 단원 수를 계산하는 `basicsDone` 추가
- 상단 진행률 카드에 "주식 기본개념 단원 (n/5)" 카드 1개 추가
- 퀴즈 결과 목록에서 `kind === "basics"`일 때 원본 id(`basics:what-is-a-stock`) 대신
  단원 제목("주식이란 무엇인가" 등)이 보이도록 라벨 분기 추가

### `apps/web/app/globals.css`
모달용 클래스 3개 추가 (기존 색상 변수만 사용, 새 색 도입 없음):
- `.modal-overlay` — 화면 전체를 덮는 반투명 배경
- `.modal-panel` — 가운데 정렬된 카드형 패널, 다섯 단원이 스크롤되도록 `max-height`/`overflow-y`
- `.modal-close` — 우상단 닫기 버튼

## `StockBasicsLauncher` 컴포넌트가 하는 일

`apps/web/components/StockBasicsLauncher.tsx` 하나가 다음을 모두 담당합니다.

- 클릭하면 열리는 카드형 버튼(트리거)과, `react-dom`의 `createPortal`로 `document.body`에 그리는
  모달을 함께 렌더링합니다 (부모 `.wrap`의 `max-width`/overflow에 잘리지 않도록).
- 모달이 열려 있는 동안 배경 스크롤을 막고, `Esc` 키·배경 클릭·닫기 버튼으로 닫힙니다.
- 모달 안 내용(목차 + 다섯 단원 + `DuoQuiz`)은 예전에 별도 라우트였던 `/learn/basics` 페이지와
  동일하며, 라우트가 아니라 컴포넌트 상태로만 열리고 닫힙니다.

## 통합 후 확인

```bash
npm install   # 새 의존성은 없지만, 혹시 몰라 한 번
npm run build
npm run dev
```

브라우저에서 `/learn`으로 들어가 최상단 카드를 눌러 모달이 뜨는지 → `Esc`/배경 클릭/닫기 버튼으로
닫히는지 → 아무 단원이나 퀴즈를 풀어보고 `/me` 페이지에서 "주식 기본개념 단원" 진행률 카드가
올라가는지, 퀴즈 결과 목록에 단원 제목이 제대로 표시되는지 확인하면 끝입니다. `/learn/basics`
같은 별도 URL은 더 이상 존재하지 않습니다(404).
