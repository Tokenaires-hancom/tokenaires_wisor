# 사이트맵 페이지별 콘텐츠 감사 (Sitemap Content Audit)

> 이 문서는 요청받은 사이트맵의 각 라우트가 `apps/web` 코드베이스에서 실제로 어떤 콘텐츠와 기능을 담고 있는지 코드를 근거로 정리한 것입니다. 기획 문서가 아니라 **현재 구현 상태를 그대로 기록한 감사(audit) 문서**입니다.
>
> 작성 기준일: 2026-08-10 · 대상: `apps/web/app` (Next.js 15 App Router)

---
사이트맵

/ (메인 / 대시보드)
├── /me (개인 프로필 / 학습 및 퀴즈 기록)
├── /practice (투자 개념 및 재무 분석 퀴즈 / 실습)
├── /learn (투자 교육 메인)
│   ├── /learn/compare (거장별 투자 철학 & 지표 비교)
│   ├── /learn/scoring (종목 가치평가 스코어링 공식 & 스코어 산출 기준)
│   └── /learn/masters (투자의 거장 7인 심화 세션)
│       ├── /learn/masters/buffett (1. 워런 버핏)
│       ├── /learn/masters/graham (2. 벤저민 그레이엄)
│       ├── /learn/masters/lynch (3. 피터 린치)
│       ├── /learn/masters/greenblatt (4. 조엘 그린블라트)
│       ├── /learn/masters/fisher (5. 필립 피셔)
│       ├── /learn/masters/marks (6. 하워드 막스)
│       └── /learn/masters/soros (7. 조지 소로스)
├── /screener (종목 스크리너 메인)
│   ├── /screener/buffett (워런 버핏 전략)
│   ├── /screener/graham (벤저민 그레이엄 전략)
│   ├── /screener/lynch (피터 린치 전략)
│   └── /screener/greenblatt (조엘 그린블라트 전략)
└── /stock/[ticker] (개별 종목 상세 및 가치평가)    
---

## 사이트맵과 실제 라우트 구조의 차이

요청하신 사이트맵과 실제 코드의 라우트 구조를 대조한 결과, 다음과 같은 차이가 있습니다.

| 사이트맵 표기 | 실제 구현 | 비고 |
|---|---|---|
| `/stock/[ticker]` | `/stocks/[ticker]` | 복수형. `apps/web/app/stocks/[ticker]/page.tsx` |
| `/screener` (메인 인덱스) | **별도 페이지 없음** | `/screener/[style]` 동적 라우트 하나가 4개 전략을 탭으로 전환. 전역 내비게이션(`components/Nav.tsx`)도 `/screener`가 아니라 `/screener/buffett`로 직접 연결됨 |
| `/screener/buffett`, `/graham`, `/lynch`, `/greenblatt` | `/screener/[style]` 동적 라우트 1개 | `generateStaticParams()`가 `SCORABLE_MASTERS`(buffett·graham·lynch·greenblatt) 4개를 정적 생성 |
| `/learn/masters` (메인 인덱스) | **별도 페이지 없음** | `/learn` (`app/learn/page.tsx`)이 7인 마스터 카드 그리드 + 차트 5단원 그리드를 함께 보여주며 사실상 이 역할을 겸함 |
| `/learn/masters/buffett` 등 7개 정적 경로 | `/learn/masters/[slug]` 동적 라우트 1개 | `generateStaticParams()`가 7인(`MASTERS`)을 정적 생성. 이 페이지는 "심화 세션" 자체가 아니라 마스터별 **개요/목차** 페이지이고, 실제 5장 본문은 아래 `[chapter]` 라우트에 있음 |
| (사이트맵에 명시 안 됨) | `/learn/masters/[slug]/[chapter]` (1~5) | 7인 × 5장 = 35개 페이지가 정적 생성됨. "심화 세션"의 실제 본문은 이 레벨에 있음 |
| (사이트맵에 없음) | `/learn/chart/[slug]` | 차트 기초 5단원(캔들·이동평균선·추세·지지저항·거래량). 사이트맵에 누락되어 있지만 `/learn`과 `/practice`에서 계속 링크되는 핵심 라우트 |

정리하면, 사이트맵의 "메인" 인덱스 두 곳(`/screener`, `/learn/masters`)은 별도 페이지 없이 상위 페이지(`/learn`)나 탭 전환(`/screener/[style]`)으로 대체되어 있고, "거장 7인 심화 세션"과 "전략별 페이지"는 정적 경로 나열이 아니라 동적 라우트(`[slug]`, `[chapter]`, `[style]`)로 구현되어 있습니다.

---

## 1. `/` — 메인 / 대시보드

**파일**: `apps/web/app/page.tsx`

서비스의 첫인상 페이지. "질문하는 법을 배우는 서비스"라는 포지셔닝을 제시하고 세 곳으로 유도합니다.

- **히어로**: "어떤 시장에서도 흔들리지 않는 질문하는 법을 배웁니다" 헤드라인 + 리드 문단. 매수·매도 판단을 제공하지 않는다는 원칙을 첫 화면에서부터 명시
- **CTA 3개**: `/learn`(투자 대가에게 배우기), `/screener/buffett`(예시 결과 보기), `/learn/compare`(일곱 투자 철학 비교하기)
- **예시 데이터 배지**: `<SampleDataFlag />` — 지금 표시 중인 수치가 예시 데이터인지 실데이터(`sec-toss`)인지 표시
- **7대 거장 카드 그리드**: `content/masters.ts`의 `MASTERS` 배열을 순회. 각 카드는 투자 유형명(예: "우량 가치"), 대가 이름, 한 줄 소개, 챕터 수(`CURRICULUM_BY_MASTER[id].chapters.length`)를 보여주고 `/learn/masters/{id}`로 연결
- **"두 개의 렌즈" 설명 카드 3개**: 기업 관점 / 차트 관점 / 나의 학습노트 — 서비스의 핵심 구조(두 관점을 절대 합산하지 않음)를 설명
- **결과 화면 미리보기**: 버핏 스타일 1위 종목 샘플을 실제 스크리너와 동일한 컴포넌트(`CriteriaBar`, `DataStamp`)로 렌더링해 "점수보다 기준이 먼저 보인다"는 디자인 원칙을 시연

**구현 상태**: 완성. 서버 컴포넌트, `lib/scores.ts`(서버 전용)에서 데이터를 가져옴.

---

## 2. `/me` — 개인 프로필 / 학습 및 퀴즈 기록

**파일**: `apps/web/app/me/page.tsx` (서버) → `components/MyLearning.tsx` (클라이언트)

로그인/계정 시스템 없이 브라우저 로컬 저장(`lib/store.ts`, 전부 `Promise` 기반 — Supabase 교체 예정 지점) 기반으로 개인 학습 현황을 모아 보여주는 대시보드입니다.

- **진도율 카드 3개**: 투자 대가 챕터 진도(35장 중 완료 수), 차트 기초 단원 진도(5단원 중 완료 수), "두 관점을 함께 적은 노트" 수
- **퀴즈 결과 목록**: 챕터별/차트단원별로 정답 수/전체 문항 수 표시 (`progress.quizResults`)
- **90일 스페이스드 리피티션 저널**: `journalDue.ts` 로직으로 90일 이상 지난 저널 답변을 다시 보여주고, 지금 생각을 새로 기록하게 함 (`dueJournalEntries`, `saveJournalEntry`)
- **관심종목(Watchlist)**: `getWatchlist()`로 담아둔 티커 목록을 카드로 표시, `/stocks/{ticker}`로 연결
- **종목 학습노트 목록**: 종목별로 기업 관점 강점/위험, 차트 관점 관찰, 열린 질문을 요약 카드로 표시. 노트 삭제 기능 포함
- **면책 문구**: 데이터가 이 브라우저에만 저장되며 계정 연동은 다음 단계임을 명시

**구현 상태**: 완성. 다만 Supabase 미연결 상태로 브라우저 로컬 저장만 동작(README "남은 작업" 항목).

---

## 3. `/practice` — 투자 개념 및 재무 분석 퀴즈 / 실습

**파일**: `apps/web/app/practice/page.tsx` (서버) → `components/ChartAnalyzer.tsx` (클라이언트)

> 실제로는 "재무 분석 퀴즈" 페이지가 아니라 **차트 이미지 분석 실습(베타)** 전용 페이지입니다. 재무 분석 퀴즈는 각 마스터의 챕터 페이지(`/learn/masters/[slug]/[chapter]`)에 내장되어 있습니다.

- **차트 실습 · 베타** 헤더: "앞으로의 가격, 매수·매도 판단, 목표가는 다루지 않는다"는 스코프 고지
- **`ChartAnalyzer` 컴포넌트**: 차트 이미지를 드래그앤드롭 또는 파일 선택으로 업로드 → FastAPI 서비스(`services/chart-api`, 기본 `http://localhost:8000/api/chart/analyze`)로 전송 → 결과로 차트 유형, 관찰 요소(가시성 등급 포함), "이미지로는 알 수 없는 것", 관련 학습 링크, 면책 문구를 렌더링
  - 종목명·티커는 전송하지 않음(전역 원칙)
  - 업로드 이미지는 서버에 저장하지 않음(안내 문구로 고지)
  - JPG/PNG/WebP, 5MB 이하 제한
- **"먼저 개념부터 보고 싶다면" 섹션**: 차트 기초 5단원(`CHART_LESSONS`) 카드 그리드 → `/learn/chart/{id}`로 연결

**구현 상태**: 완성(베타 라벨). 백엔드(`services/chart-api`)가 켜져 있어야 실제 분석이 동작하며, 인증/사용량 제한은 README상 미완료 항목.

---

## 4. `/learn` — 투자 교육 메인

**파일**: `apps/web/app/learn/page.tsx`

"기업을 고르는 법"과 "가격을 읽는 법"을 분리해서 가르친다는 서비스 철학을 소개하는 허브 페이지. 사이트맵상 `/learn/masters` 메인 인덱스 역할까지 겸합니다.

- **인트로**: 두 기술(종목 선별 vs 차트 읽기)이 다르다는 설명, 학습노트에서 두 관점이 만난다는 구조 설명
- **"투자 대가에게 배우기" 섹션**:
  - 학습 순서 추천 문구(버핏 → 그레이엄·린치 → 막스 → 피셔·그린블랫·소로스는 선택)
  - `/learn/compare`(다섯 질문으로 비교), `/learn/scoring`(점수 산출법) 바로가기 버튼
  - 7인 마스터 카드 그리드: 투자자 아바타 이미지(`/investors/{id}.png`), 유형명, 이름, 한 줄 소개, 챕터 수 → `/learn/masters/{id}`
- **"차트 기초 배우기" 섹션**: 5단원(캔들 이해하기 · 이동평균선 · 추세 · 지지와 저항 · 거래량) 카드 그리드 → `/learn/chart/{id}`

**구현 상태**: 완성.

### 4-1. `/learn/compare` — 거장별 투자 철학 & 지표 비교

**파일**: `apps/web/app/learn/compare/page.tsx`

- **횡단 비교표**: 7개 철학(행) × 5장(열: 전제·탐색·검증·처분·실패, `CHAPTER_SLOTS`) 매트릭스. 각 셀은 해당 장의 실제 제목이고 클릭 시 `/learn/masters/{id}/{chapter}`로 이동
- **처분 규율 비교표**: 철학별 매도 유형(`sellType`)과 매도 방아쇠(`sellTrigger`)를 나란히 비교
- **"내가 실행할 수 있는 교집합" 최종 기록**: `ChapterExercises` 컴포넌트로 자본 시간표·기질·역량 3층을 적고 교집합을 정리하는 저널형 연습(`CROSS_EXERCISES`, `content/curriculum/compare.ts`)

**구현 상태**: 완성.

### 4-2. `/learn/scoring` — 종목 가치평가 스코어링 공식 & 스코어 산출 기준

**파일**: `apps/web/app/learn/scoring/page.tsx`

- **1. 종목은 어떻게 고르나**: 지수 구성종목 수 → 제외 종목 수와 사유별 분류(예: 금융·리츠, ETF 등) → 최종 유니버스 수, 실제 데이터(`DATA.universe`)로 채워짐
- **2. 점수는 어떻게 만드나**: 철학마다 채점 가능 종목 수가 다른 이유를 5단계로 설명
  1. 기준을 하나씩 판정
  2. 판정 불가는 미충족이 아니라 "판정 불가"
  3. 점수 = 충족 기준 비중 합 ÷ 판정 기준 비중 합
  4. 판정 불가가 25%를 넘으면 점수 미생성("정보 부족")
  5. 모델이 안 맞는 업종(은행·리츠 등)은 아예 판정 안 함
- **철학별 커버리지 표**(`CoverageTable`): 철학별 판정 가능/불가 종목 수, 가장 많이 비었던 기준 항목
- **`DataStamp`**: 데이터 생성 시각 고지

**구현 상태**: 완성. 실제 커버리지 수치는 `lib/scores.ts`가 `scores.json`을 읽어 계산.

### 4-3. `/learn/masters` — 투자의 거장 7인 심화 세션 (메인 인덱스는 `/learn`이 대체)

**파일**: `apps/web/app/learn/masters/[slug]/page.tsx` (동적 라우트, `generateStaticParams`로 7개 정적 생성)

이 페이지는 "심화 세션 본문"이 아니라 **마스터별 개요/목차 페이지**입니다.

- 투자자 아바타, 유형명·소요 시간(20분)·부제, 한 줄 요약, 소개 문단
- **5장 목차** (`CHAPTER_SLOTS` 기준: 전제/탐색/검증/처분/실패) → 각 장으로 링크
- 매도 조건 한 줄 요약(`sellType`, `sellTrigger`)
- **원칙 카드 목록** (`master.principles`, 대가별 5개 원칙 각각 제목+설명)
- **선호하는 기업 특징** (`master.likes`, 3개)
- **이 철학이 지는 상황** (`master.failsWhen`, 3개)
- 조건부 CTA:
  - 점수형 철학(buffett/graham/lynch/greenblatt): "이 기준으로 정리된 종목" → `/screener/{id}`
  - 체크리스트형 철학(fisher/marks/soros): "자가진단 · 점수 없음" 섹션 — 원칙들을 판정 불가(`unknown`) 항목으로 나열하고 1장으로 유도

**구현 상태**: 완성.

#### 4-3-1. `/learn/masters/[slug]/[chapter]` — 실제 심화 세션 본문 (1~5장, 7인 × 5장 = 35페이지)

**파일**: `apps/web/app/learn/masters/[slug]/[chapter]/page.tsx`

사이트맵에서 `/learn/masters/buffett` 등으로 표기된 "심화 세션"의 실제 본문은 이 챕터 레벨에 있습니다.

- 진행률 표시줄(5칸, 완료/현재 상태 표시)
- 장 제목, 리드 문단, 그 장이 던지는 질문(`slot.asks`)
- **본문**: 여러 단락(`chapter.body: string[]`)
- **연습문제**(`ChapterExercises`, `content/curriculum/{master}.ts`): 3가지 유형
  - `graded`: 즉시 채점 객관식(정답+해설, 복수정답 가능)
  - `guided`: 채점 없이 직접 써보고 체크포인트로 스스로 확인
  - `journal`: 저널형(90일 뒤 `/me`에서 다시 묻는 스페이스드 리피티션 문항)
- 이전 장/다음 장 카드 네비게이션. 마지막 장(5장)에서는 "다음 단계: 이 기준으로 종목 보기" → `/screener/{id}`로 유도
- 통화/단위 고지(`curriculum.currency`)

**구현 상태**: 완성. 7인 전원 5장씩 콘텐츠 존재 (`content/curriculum/{buffett,graham,lynch,marks,fisher,greenblatt,soros}.ts`), 빌드 시 `curriculumProblems()` 검사가 커리큘럼 무결성(장 수, 필수 필드 등)을 강제.

---

## 5. `/screener` — 종목 스크리너 메인 (별도 페이지 없음)

사이트맵의 "`/screener` 메인"에 해당하는 별도 랜딩 페이지는 존재하지 않습니다. 대신 `/screener/[style]` 동적 라우트 하나가 4개 전략 전체를 커버하며, 페이지 안에서 탭으로 다른 전략으로 전환합니다.

### `/screener/buffett`, `/screener/graham`, `/screener/lynch`, `/screener/greenblatt`

**파일**: `apps/web/app/screener/[style]/page.tsx` (동적 라우트, `SCORABLE_MASTERS` 4명에 대해 정적 생성)

- **철학 탭 내비게이션**: 4개 전략을 가로 탭으로 전환 (다른 정성적 철학 3인은 여기 포함되지 않는 이유를 상단에 고지)
- **선택한 철학 헤더**: 대가 이름 + 한 줄 소개, `/learn/masters/{id}`로 "투자 철학 배우러 가기" 링크
- **예시 데이터 배지**(`SampleDataFlag`)
- **"점수/순위를 만드는 방식" 카드**:
  - 버핏·그레이엄·린치: 기준 가중합 방식 — 기준 목록(코드·라벨·상세 조건)을 그대로 나열
  - 그린블랫: 순위 합산 방식(절대 기준 아님) 설명
  - `DataStamp`로 모델 버전 고지
- **"왜 철학마다 종목 수가 다른가" 카드**: `CoverageTable`로 철학별 커버리지 비교, 이 철학에서 가장 많이 비었던 기준, 유니버스 제외 종목 수, `/learn/scoring` 링크
- **종목 리스트**(`ScreenerCompanies`): 채점된 종목들을 순위/점수와 함께 나열(살펴볼 순서로 프레이밍, 매수 순위 아님)
- **정보 부족 섹션**: 판정 데이터가 모자라 점수를 만들지 않은 종목 목록
- **판정하지 않은 업종 섹션**: 모델이 원천적으로 맞지 않는 업종(은행·리츠 등) 종목 — 지표는 볼 수 있게 `/stocks/{ticker}`로 링크
- 데이터 생성 시각 + "매수 권유가 아니다" 면책 문구

**구현 상태**: 완성. 4개 전략 모두 실데이터(`scores.json`, sec-toss+SEC 공시 기반) 연결됨.

---

## 6. `/stock/[ticker]` (실제: `/stocks/[ticker]`) — 개별 종목 상세 및 가치평가

**파일**: `apps/web/app/stocks/[ticker]/page.tsx` (서버) → `components/StockLenses.tsx` (클라이언트)

서비스의 핵심 "두 렌즈" 구조가 가장 잘 드러나는 페이지. 3개의 탭(렌즈)으로 구성됩니다.

- **헤더**: 종목명, 티커, 섹터, 종가, 시가총액, `DataStamp`(가격 기준일·재무 기준일·모델 버전·데이터 신뢰도), `SampleDataFlag`
- **탭 1. 기업 관점(Business Lens)**:
  - 종목이 채점된 모든 철학 버튼(점수/순위 전환 가능)
  - 기준 막대(`CriteriaBar`) 또는 순위 카드
  - "이 철학에 맞는 점" / "확인이 필요한 점" 리스트(충족·미충족·판정불가 구분)
  - `<details>` 접이식 상세 테이블: 기준별 실측치 + 원본 재무 지표(`METRIC_LABELS`) 전체
- **탭 2. 차트 관점(Chart Lens)**: `ChartAnalyzer` 재사용(종목명·티커 전달 안 함이 원칙), 차트 읽는 순서 카드 5개(`/learn/chart/{id}`)
- **탭 3. 나의 학습노트(Note Lens)**: 7단계 폼
  1. 관심을 가진 이유(자유 서술)
  2. 투자 철학별 적합도(자동 채움, 읽기 전용 요약)
  3. 기업 관점 강점(자동 채움 미리보기)
  4. 기업 관점 위험(자동 채움 미리보기)
  5. 차트에서 관찰한 내용(직접 입력)
  6. 추가로 확인할 질문(직접 입력)
  7. 나의 판단 상태 선택(`NOTE_STATUS_LABEL`, 예: 첫 판단/재검토 등) + 관심종목 담기(`WatchButton`)
  - 저장은 `lib/store.ts`의 `saveNote()`(브라우저 로컬), `track()`으로 분석 이벤트 기록

**구현 상태**: 완성.

---

## (사이트맵 외 발견) `/learn/chart/[slug]` — 차트 기초 5단원

**파일**: `apps/web/app/learn/chart/[slug]/page.tsx` (동적 라우트, `CHART_LESSONS` 5개 정적 생성: 캔들 이해하기 · 이동평균선 · 추세 · 지지와 저항 · 거래량)

사이트맵에는 없지만 `/learn`, `/practice`, `/stocks/[ticker]`(차트 관점 탭)에서 반복적으로 링크되는 핵심 학습 콘텐츠입니다.

- 핵심 개념 카드 목록(`lesson.concepts`)
- "차트를 읽는 순서" 단계별 안내(`readingSteps`)
- "예시로 읽기": 가상의 차트 기록에 대한 관찰 목록 + 결론("여기까지 말할 수 있다"는 신중한 표현)
- "잘못 이해하기 쉬운 점": 흔한 오해(`misconception.claim`) vs 정정(`correction`)
- 체크리스트(`lesson.checklist`)
- 퀴즈(`Quiz` 컴포넌트, `lesson.quiz`)
- "직접 올린 차트로 확인해보세요": 해당 단원 컨텍스트가 달린 `ChartAnalyzer`
- 다음 단원 카드 네비게이션

**구현 상태**: 완성.

---

## 요약 표

| 라우트 | 파일 | 상태 | 데이터 소스 |
|---|---|---|---|
| `/` | `app/page.tsx` | 완성 | `content/masters.ts`, `lib/scores.ts` |
| `/me` | `app/me/page.tsx` + `MyLearning.tsx` | 완성 (로컬 저장만) | `lib/store.ts` (브라우저) |
| `/practice` | `app/practice/page.tsx` + `ChartAnalyzer.tsx` | 완성 (베타) | `services/chart-api` |
| `/learn` | `app/learn/page.tsx` | 완성 | `content/masters.ts`, `content/chartLessons.ts` |
| `/learn/compare` | `app/learn/compare/page.tsx` | 완성 | `content/curriculum/*` |
| `/learn/scoring` | `app/learn/scoring/page.tsx` | 완성 | `lib/scores.ts` (`COVERAGE`, `DATA`) |
| `/learn/masters/[slug]` | `app/learn/masters/[slug]/page.tsx` | 완성 (7개 정적 생성) | `content/masters.ts`, `lib/scores.ts` |
| `/learn/masters/[slug]/[chapter]` | `.../[chapter]/page.tsx` | 완성 (35개 정적 생성) | `content/curriculum/*` |
| `/screener/[style]` | `app/screener/[style]/page.tsx` | 완성 (4개 정적 생성) | `lib/scores.ts` |
| `/stocks/[ticker]` | `app/stocks/[ticker]/page.tsx` + `StockLenses.tsx` | 완성 | `lib/scores.ts`, `lib/store.ts` |
| `/learn/chart/[slug]` | `app/learn/chart/[slug]/page.tsx` | 완성 (5개 정적 생성) | `content/chartLessons.ts` |
| `/screener` (메인) | — | **미구현** | — |
| `/learn/masters` (메인) | — | **미구현** (`/learn`이 대체) | — |
