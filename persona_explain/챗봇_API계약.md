# 챗봇 API 계약

프론트(1번 담당)는 이 파일만 보면 된다. 서버는 `python server.py`로 띄운다.

기본 주소: `http://127.0.0.1:8000` (브라우저로 열면 연습장 HTML, `/health` 는 JSON)  
세션 수명: 마지막 요청부터 **30분**. 만료·재시작 후 404가 오면 세션을 다시 만든다.

숫자는 프론트가 보내지 않는다. `{ticker, persona}`만 보낸다. 서버가 팀 `scores.json`에서 지표와 기준 판정을 꺼내 쓴다. 그래서 화면에 뜬 숫자와 챗봇이 말하는 숫자가 어긋나지 않는다.

## 엔드포인트

| 메서드 | 경로 | 하는 일 |
|---|---|---|
| GET | `/` | 연습장 HTML (로컬에서 직접 눌러보기) |
| GET | `/health` | 살아 있는지 |
| GET | `/meta` | 데이터 기준일, 지원 페르소나, 세션 TTL |
| GET | `/companies?q=&limit=` | 티커·종목명 검색 (플로팅에서 종목을 고를 때) |
| POST | `/sessions` | 세션 생성 + 첫 해설 |
| POST | `/sessions/{id}/messages` | 후속 질문 |
| POST | `/sessions/{id}/persona` | 관점 교체 (기록 초기화 + 새 첫 해설) |
| DELETE | `/sessions/{id}` | 세션 삭제 |
| OPTIONS | 모든 경로 | CORS 프리플라이트 |

모르는 JSON 필드는 무시하지 않고 400으로 거부한다.

## 페르소나 id

일곱이고 두 갈래다. `personas[].evaluation`이 어느 쪽인지 알려준다.

| evaluation | id | 답변 |
|---|---|---|
| `score` | `buffett` · `graham` · `lynch` · `greenblatt` | 지표와 기준 판정을 읽어 준다 |
| `checklist` | `marks` · `fisher` · `soros` | 점수를 내지 않는다. 무엇을 확인할지 알려 준다 |

대가는 모두 **1인칭으로 말한다**("나는…"). 화면에서 대가 이름과 초상을 함께 보여 주면
말하는 주체가 분명해진다.

`checklist` 관점의 답변에는 `[주어진 것]` `[업종 통례]` `[내 기억]` 같은 출처 표시가
문장에 섞여 나온다. 회사에 대한 주장이 어디서 나왔는지 사용자가 가려 볼 수 있게 한
장치이므로 **화면에서 지우지 않는다.** `[내 기억]`은 모델이 학습 자료에서 기억한 것으로
확인되지 않은 내용이고, 답변에 확인할 곳이 함께 나온다.

`checklist` 관점은 `scores.json`에 채점 스타일이 없다. 그래서 응답의 `judgement`가
`null`이고 `modelVersion`도 없다. 숫자를 말하지 않으니 화면에서 점수·기준 막대를
함께 그리지 않는다.

지원 목록과 **순서**는 `GET /meta`의 `personas`가 진실이다. 순서는 배우기 화면의
대가 순서(`content/masters.ts`)와 같으므로 받은 대로 그리면 된다.

## 요청 / 응답

### POST `/sessions`

```json
{ "ticker": "AAPL", "persona": "buffett" }
```

201:

```json
{
  "sessionId": "…",
  "persona": "buffett",
  "personaName": "워런 버핏·찰리 멍거",
  "evaluation": "score",
  "company": { "ticker": "AAPL", "name": "애플", "sector": "…", "styles": ["buffett", "graham", "lynch", "greenblatt"] },
  "asOf": { "price": "2026-08-05", "financial": "2025-09-27" },
  "judgement": {
    "style": "buffett", "personaName": "워런 버핏·찰리 멍거",
    "modelVersion": "Buffett 1.0", "score": 72,
    "passed": 6, "totalJudged": 8, "total": 8,
    "dataConfidence": "높음", "judged": true, "rank": null
  },
  "opening": "첫 해설 본문…",
  "verdict": "ok",
  "regenerated": false,
  "blocked": false,
  "expiresIn": 1800
}
```

`checklist` 관점이면 같은 형태에서 `evaluation`이 `"checklist"`, `judgement`가 `null`이다.
`company`와 `asOf`는 그대로 온다.

없는 종목 → 404 `{ "error": { "code": "unknown_ticker" } }`  
없는 관점 → 400 `{ "error": { "code": "unknown_persona" } }`

`ticker`는 필수. 종목 페이지에서 열면 그 종목을 넣고, 다른 페이지의 플로팅이면 먼저 `/companies?q=`로 고른 뒤 넣는다.

### POST `/sessions/{id}/messages`

```json
{ "question": "ROIC가 뭔가요?" }
```

200: `{ sessionId, persona, personaName, reply, verdict, regenerated, blocked, expiresIn }`

질문 공백 → 400 `invalid_field`  
500자 초과 → 400 `too_long`  
세션 없음/만료 → 404 `session_not_found` (메시지에 "세션을 새로 만들어 주세요")

### POST `/sessions/{id}/persona`

```json
{ "persona": "graham" }
```

200 형태는 세션 생성과 같다(`opening`이 새 관점의 첫 해설). 앞 대화는 버린다.

점수 관점과 확인 관점을 오갈 수 있다. 갈아탈 때마다 `evaluation`과 `judgement`가
함께 바뀌므로, 앞 관점의 점수를 화면에 남겨 두지 않는다.

### GET `/companies?q=애플&limit=10`

```json
{ "query": "애플", "results": [{ "ticker": "AAPL", "name": "애플", "sector": "…", "styles": ["buffett", "…"] }] }
```

### 에러 공통

```json
{ "error": { "code": "session_not_found", "message": "사람이 읽을 문구" } }
```

프론트는 `error.code`로 분기한다. `session_not_found`면 세션을 다시 만들면 된다.

## 세션 수명

- 마지막 요청부터 30분. 질문·관점 교체가 수명을 연장한다.
- 서버 프로세스를 다시 띄우면 전부 사라진다.
- 동시에 최대 200개. 넘으면 가장 오래 쓰지 않은 것부터 버린다.

## 지표 키 (참고)

프론트가 지표를 보낼 일은 없다. 서버가 `scores.json`의 camelCase를 아래 내부 키로 바꿔 프롬프트에 넣는다.
`checklist` 관점에는 이 표가 쓰이지 않는다 — 지표 블록 자체를 싣지 않는다.

| scores.json | 내부 키 | 화면 라벨 |
|---|---|---|
| roicAvg5y | ROIC_5y_avg | 자본수익률(5년 평균) |
| fcfMargin | FCF_margin | 잉여현금흐름 마진 |
| fcfYield | FCF_yield | 잉여현금흐름 수익률 |
| netDebtToEbitda | netDebt_to_EBITDA | 순부채 / EBITDA |
| interestCoverage | interest_coverage | 이자보상배율 |
| revenueCagr5y | revenue_CAGR_5y | 매출 5년 연평균 성장률 |
| epsCagr5y | earnings_growth | 주당순이익 5년 연평균 성장률 |
| pe | PER | PER |
| pbr | PBR | PBR |
| peg | PEG | PEG |
| currentRatio | current_ratio | 유동비율 |
| debtToEquity | debt_to_equity | 부채 / 자기자본 |
| evEbit | EV_EBIT | EV / EBIT |
| earningsYield | earnings_yield | 이익수익률(EBIT / 기업가치) |

## React 예제

```ts
const API = "http://127.0.0.1:8000";

async function startChat(ticker: string, persona: string) {
  const res = await fetch(`${API}/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ticker, persona }),
  });
  const data = await res.json();
  if (!res.ok) throw data.error;
  return data; // sessionId, opening
}

async function ask(sessionId: string, question: string) {
  const res = await fetch(`${API}/sessions/${sessionId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });
  const data = await res.json();
  if (res.status === 404 && data.error?.code === "session_not_found") {
    // 세션을 다시 만들고 같은 질문을 한 번 더 보낸다
    throw Object.assign(new Error("session gone"), { recreate: true });
  }
  if (!res.ok) throw data.error;
  return data; // reply
}

async function searchCompanies(q: string) {
  const res = await fetch(`${API}/companies?q=${encodeURIComponent(q)}`);
  return (await res.json()).results as { ticker: string; name: string }[];
}
```

개발 중 CORS는 `ALLOWED_ORIGINS=*` 이다. 배포 주소가 정해지면 그 출처만 연다.

## 아직 정하지 않은 것

- 화면 위치(플로팅 vs 종목 상세 탭) — 백엔드는 둘 다 수용한다. ticker만 있으면 된다.
- 팀 저장소 안으로 옮기는 시점 — 프론트에서 응답이 한 번 뜨면 PR.
- 세션 영속화 — 지금은 재시작하면 사라진다.
