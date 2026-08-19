# 대가 상세 페이지 폴더탭 전환

## 목표

`/learn/masters/[slug]` 하단 4개 섹션(철학 원칙 · 선호하는 기업 · 근거로 삼은 자료 · 실패하는 경우, 점수 없는 대가는 자가진단까지 5개)이 전부 같은 모양의 `<details>` 아코디언으로 나열돼 시각 위계가 없고, 모바일에서 다 펼치면 스크롤이 길어져 탐색이 불편하다. 이 4~5개를 폴더 서류철 탭 + 단일 콘텐츠 패널 구조로 바꾼다. 업적 3카드 섹션은 이번 변경 대상이 아니고 그대로 둔다.

## 범위

### 하는 것

- `apps/web/components/MasterTabs.tsx` 신설 (client component). 탭바 + 패널 렌더링, 활성 탭 상태 관리.
- `apps/web/app/learn/masters/[slug]/page.tsx`의 `.master-tips` `<details>` 4~5개 블록을 `<MasterTabs tabs={...} />` 호출로 교체. 각 탭의 콘텐츠(원칙 리스트, `reason-list`, 출처 리스트, 자가진단)는 지금 로직 그대로 옮기기만 한다.
- `globals.css`의 `.master-tips` 계열 규칙(2765~2786행)을 새 `.master-tab*` 계열로 교체. 폴더탭 비주얼, 호버, 전환 애니메이션, 760px 이하 세로 스택 포함.

### 하지 않는 것

- 업적 3카드(`.master-achievements`, `.achievement-records`) 섹션은 건드리지 않는다.
- 각 섹션의 텍스트/데이터 내용은 바꾸지 않는다 (`master.principles`, `master.likes`, `curriculum.primarySources`, `master.failsWhen` 그대로 사용).
- 키보드 화살표 탭 이동(roving tabindex)은 넣지 않는다. 클릭/탭만 지원.
- 모바일에서 탭마다 개별 패널을 두지 않는다. 세로로 쌓인 탭 리스트 아래에 패널 하나만 유지한다 (탭 전환 시 그 패널 내용만 바뀜).

## 데이터 모델

```ts
// components/MasterTabs.tsx
export type MasterTab = {
  id: string;
  label: string;       // 탭에 보이는 짧은 텍스트
  content: ReactNode;   // 패널에 렌더링할 내용 (page.tsx가 조립해서 넘김)
};

function MasterTabs({ tabs }: { tabs: MasterTab[] }): JSX.Element
```

`page.tsx`는 지금 각 `<details>` 안에 있던 JSX(리스트 등)를 그대로 `content`에 담아 배열로 넘긴다. 자가진단 탭은 `!meta`일 때만 배열에 추가해 지금의 조건부 렌더링을 유지한다.

기본 활성 탭은 배열의 첫 항목(철학 원칙)이다.

## 렌더링 / 상태

- `useState<string>(tabs[0].id)`로 활성 탭 id 관리.
- 탭 버튼 클릭 시 `setActiveId`. 패널은 `<div role="tabpanel" key={activeId}>{active.content}</div>` — `key`를 바꿔 리마운트시켜 전환 애니메이션을 CSS 쪽에서 자연스럽게 재생시킨다.
- 접근성: 탭바 `role="tablist"`, 탭 `<button role="tab" aria-selected={activeId===id} aria-controls={panelId} id={tabId}>`, 패널 `role="tabpanel" aria-labelledby={tabId} tabIndex={0}`.

## 스타일

### 폴더탭 모양

- `.master-tablist`: `display:flex`, 탭 사이 겹침(`margin-right:-1px` 정도), `border-bottom:1px solid var(--line)` 없이 패널 상단과 맞물리게.
- `.master-tab`: `border:1px solid var(--line)`, 위쪽 모서리만 `border-radius`, `background:var(--bg)`, `color:var(--ink-soft)`, `font-weight:600`, `padding:0.55rem 1rem`, `cursor:pointer`.
- `.master-tab[aria-selected="true"]`: `border-top:3px solid var(--gold)` (업적 카드 포인트 색 재사용), `background:var(--surface)`, `color:var(--ink)`, `font-weight:700`, `transform:translateY(-2px)`, 아래쪽 테두리를 패널 배경색과 맞춰 시각적으로 이어붙임.
- `.master-tabpanel`: `border:1px solid var(--line)`, `border-radius:0 8px 8px 8px`, `background:var(--surface)`, `box-shadow:0 3px 0 var(--line)` (업적 카드와 동일한 언어), `padding:1rem 1.2rem`.

### 호버

- 비활성 탭 hover: `background:var(--surface)`, `color:var(--ink)`, `transform:translateY(-1px)`, `transition:background-color 150ms ease, color 150ms ease, transform 150ms ease`.
- 활성 탭은 hover 시 변화 없음 (이미 올라와 있는 상태).

### 전환 애니메이션

- `.master-tabpanel`에 `@keyframes master-tab-in { from { opacity:0; transform:translateY(4px);} to { opacity:1; transform:translateY(0);} }`, `animation:master-tab-in 180ms ease-out`.
- 활성 탭 자체도 `background-color`, `transform`에 150ms transition.
- 하드코딩 hex 새로 넣지 않는다. 기존 CSS 변수(`--gold`, `--line`, `--ink`, `--ink-soft`, `--surface`, `--bg`)만 사용.

### 반응형 (760px 이하, 기존 브레이크포인트)

- `.master-tablist`: `flex-direction:column`, 각 탭 `width:100%`, 겹침 대신 `margin-bottom:-1px`.
- 활성 탭의 `border-radius`를 `8px 8px 0 0`로, 패널은 탭 리스트 바로 아래 하나로 유지 (탭별 개별 패널 없음).

## 검증

- `cd apps/web && npm run build` 통과.
- 브라우저에서 데스크톱 폭: 탭 4~5개 가로로 겹쳐 보이고 클릭 시 패널 내용 바뀌는지, 호버 시 비활성 탭 색 변화하는지 확인.
- 375px 폭: 탭이 세로로 쌓이고 패널이 리스트 아래 하나만 나오는지 확인.
- 점수 없는 대가(자가진단 탭 있는 경우)와 있는 대가 둘 다 확인.
- 키보드 Tab으로 탭 버튼에 포커스 가고 Enter/Space로 전환되는지 확인 (버튼 기본 동작이므로 별도 구현 불필요).

## 위험과 완화

| 위험 | 완화 |
|---|---|
| `<details>` 제거로 기존 CSS(`.master-tips details`, `.master-tips summary`)가 고아 규칙으로 남는다 | 같은 변경에서 `globals.css`의 옛 `.master-tips` 규칙을 새 규칙으로 교체 (삭제 포함) |
| 탭 4~5개 라벨이 좁은 화면에서 줄바꿈되며 폴더탭 모양이 깨진다 | 라벨을 짧게 유지 ("철학 원칙", "선호 기업", "근거 자료", "실패 케이스", "자가진단"), 375px에서 실측 확인 |
| `key={activeId}` 리마운트로 패널 내부에 상태가 있었다면 초기화된다 | 현재 패널 콘텐츠는 순수 리스트 렌더링이라 내부 상태 없음. 문제 없음 |
