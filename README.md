# Wisor

> 기업을 고르는 법과 가격을 관찰하는 법을 함께 가르치는 투자 학습 서비스.

투자 대가의 판단 기준으로 종목을 좁히고, 확인한 것을 하나의 학습노트로 모읍니다. **매수·매도 판단, 목표가, 미래 가격 전망은 제공하지 않습니다.**

**동작하는 서비스** — 웹 <https://wisor-w0fu.onrender.com> · 해설 챗봇 API <https://tokenaires-wisor.onrender.com>
둘 다 Render의 별도 서비스입니다. 웹은 `PERSONA_API_ORIGIN`으로 챗봇 서버를 가리킵니다.
배포 설정은 루트 `render.yaml`, 환경변수와 주의사항은 `docs/deploy.md`에 있습니다.

---

## 지금 구현된 것

| 영역 | 상태 |
|---|---|
| 배우기 | 7명의 투자 대가 × 5장 · 확인 문항 · 철학 비교 · 업적과 근거 자료 |
| 종목 찾기 | 버핏 1.0 / 그레이엄 1.0 / 린치 1.0 점수 · 그린블랫 1.0 마법공식 순위 |
| 종목 상세 | 네 투자 철학 전환 · 기준별 실제 판정 데이터 · 가중치 · 재무 용어 설명 · 학습노트 |
| 해설 챗봇 | 대가 페르소나로 지표를 해설. 금지표현 필터와 재생성. Render 배포·연결 완료 |
| 데이터 | S&P 500·NASDAQ-100 중복 제거 유니버스 517개 중 품질 기준을 통과한 380개 종목 수록 |
| Supabase | 스키마 작성 완료, 앱 연결은 미착수 (지금은 브라우저 저장) |
| 실데이터 공급자 | 토스증권 가격 + Nasdaq 시가총액 + SEC Company Facts 최근 5개 회계연도 |

주요 화면:

- `/learn` — 일곱 투자 대가의 철학을 순서대로 학습
- `/learn/masters/[slug]` — 대가별 학습 경로, 업적, 원칙과 출처
- `/learn/compare` — 철학별 판단 방식 비교
- `/screener/[style]` — 네 정량 모델의 종목 결과
- `/stocks/[ticker]` — 기업별 네 모델 판정과 학습노트

---

## 실행

필요한 환경은 Python 3.11 이상과 Node.js 23 이상입니다. 생성된 `scores.json`이 저장소에
포함돼 있어 웹만 실행할 때는 데이터 배치를 먼저 돌릴 필요가 없습니다.

### 1. 점수 만들기

```bash
cd data-pipeline
python -m venv .venv
# macOS/Linux: source .venv/bin/activate
# Windows PowerShell: .\.venv\Scripts\Activate.ps1
pip install pytest
python run_batch.py          # 예시 데이터 → apps/web/lib/generated/scores.json
python -m pytest -q
```

실데이터 전체 갱신은 `data-pipeline/.env.example`의 세 환경변수를 설정한 뒤 실행합니다.

```bash
python run_batch.py --provider sec-toss --universe data/universe_us.json
```

전체 갱신은 재무 캐시를 `data/fundamentals.json`에 남깁니다. 이후 가격만 갱신할 때는 SEC를
다시 호출하지 않습니다.

```bash
python run_batch.py --provider sec-toss --mode prices --universe data/universe_us.json
```

### 2. 웹

```bash
cd apps/web
npm install
npm run dev        # http://localhost:3000
npm test
npm run build
```

---

## 구조

```
wisor/
├─ apps/web/            Next.js 15 · 화면 전체 (1번 담당)
│   ├─ content/         투자 철학 7유형×5장 (정적 콘텐츠)
│   ├─ lib/generated/   배치가 만든 scores.json
│   └─ lib/store.ts     사용자 데이터 저장 (Supabase 교체 지점)
├─ data-pipeline/       Python 배치 · 재무데이터 → 투자 철학 점수 (3번 담당)
│   └─ data/            종목 유니버스와 재무 캐시
├─ docs/                설계, 구현 계획, 출처와 작업 인계
├─ supabase/schema.sql  사용자 데이터 스키마 (2번 담당)
└─ render.yaml          Render 두 서비스 배포 설정 (2번 담당)
```

경계 규칙:

- 화면 코드는 재무 원천을 직접 만지지 않습니다. `scores.json`만 읽습니다.

---

## 점수는 어떻게 나오는가

버핏·그레이엄·린치는 블랙박스 회귀식이 아니라 **기준 통과 여부의 가중 합**입니다.

```
버핏 1.0 = 8개 기준
  자본 효율성(3)      5년 평균 ROIC ≥ 12%
  수익성 지속성(2)    5년 중 4년 이상 ROIC ≥ 10%
  현금흐름 지속성(3)  5년 연속 잉여현금흐름 양(+)
  현금 창출력(2)      FCF 마진 ≥ 10%
  부채 부담(2)        순부채 / EBITDA ≤ 2.5배
  이자 감당력(1)      영업이익 / 이자비용 ≥ 8배
  사업의 성장(2)      매출 5년 CAGR ≥ 3%
  현재 가격(3)        FCF 수익률 ≥ 4% 또는 EV/EBIT ≤ 자기 5년 중앙값

점수 = 충족 기준의 비중 합 ÷ 판정한 기준의 비중 합 × 100
```

그린블랫 1.0은 원래 마법공식대로 최신 EBIT/(순운전자본+순유형자산)와
EBIT/기업가치(이익수익률)를 각각 내림차순으로 순위 매긴 뒤 두 순위를 합산합니다.
금융·유틸리티처럼 원식의 비교 대상이 아닌 업종은 `정보 부족`과 구분해 `판정 대상 아님`으로
표시합니다. 피셔·막스·소로스는 공개 재무지표로 본질을 근사하지 않고 학습 화면의 자가진단
체크리스트로만 다룹니다.

**판정할 데이터가 없으면 미충족이 아니라 `unknown`입니다.** 없는 값을 벌점으로 바꾸지 않습니다. `unknown`이 전체의 25%를 넘으면 점수를 만들지 않고 '정보 부족'으로 표시합니다.

---

## 구조상 지켜지는 것

**재무데이터는 브라우저로 나가지 않습니다.** `lib/scores.ts`는 서버 전용이고, 클라이언트는 `lib/scores.types.ts`에서 타입만 가져옵니다. 실수로 import하면 브라우저에서 예외가 납니다. 확인은 `npm run build` 후 `grep -rl "evEbitMedian5y" .next/static/`.

**사용자 데이터 저장은 한 파일을 거칩니다.** `lib/store.ts`의 함수는 전부 비동기라서 Supabase로 교체할 때 함수 본문만 바꾸면 됩니다.

---

## 남은 작업

- [x] 실데이터 공급자 연결 — `data-pipeline/wisor_data/providers/sec_toss.py`의 `SecTossProvider`
- [x] 종목 유니버스 구성 — S&P 500·NASDAQ-100 중복 제거, ETF·우선주·SPAC 제외
- [x] 그레이엄 / 린치 상위 종목 검수 후 1.0으로 승격
- [ ] Supabase 연결 — `apps/web/lib/store.ts`의 함수 본문만 교체
- [ ] 점수 문구를 코드+값으로 분리 — 지금은 Python이 완성한 한국어 문장이 scores.json에 실려 있어 프론트가 문구를 못 고칩니다
- [ ] 프론트엔드 스모크 테스트 1개 (학습 → 퀴즈 → 스크리너 → 상세 → 노트 저장)
- [ ] 검토자 2명이 결과를 "교육용으로 적절"하다고 평가하는지 확인

---

## 데이터 출처 표시

기본 개발 입력은 `data-pipeline/data/universe_sample.json`입니다. 저장소의 현재 화면 결과는
`data/universe_us.json`의 유니버스를 대상으로 토스증권 가격, Nasdaq 시가총액, SEC Company
Facts 공시를 결합해 생성했습니다. 공급자 값이 없는 항목은 0으로 대체하지 않으며, 판정할 수
없는 기준은 점수의 분모에서도 제외합니다.

---

## 지켜야 할 원칙

투자 철학 점수는 관찰과 확인 사항까지만 말하고, 매수·매도를 권하지 않습니다.
