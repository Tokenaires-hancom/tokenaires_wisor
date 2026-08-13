# persona_explain

투자 대가 페르소나로 재무 지표를 **해설**하는 챗봇.
숫자는 팀 `scores.json`이 계산해 넘기고, LLM은 해설만 한다. 매수·매도·목표가·전망은 하지 않는다.

## 구성

| 파일 | 역할 |
|---|---|
| `personas.py` | 공통 규칙 + 대가별 시스템 프롬프트 |
| `safety.py` | 금지표현 필터 (`ok` / `cleaned` / `regenerate`) |
| `explain.py` | 지표·기준판정 블록 조립, LLM 호출, 안전 재생성 |
| `scores_source.py` | `scores.json` 로드, camelCase → 내부 키 |
| `chat.py` | 멀티턴 코어 `PersonaChat` (프레임워크 비의존) |
| `session_store.py` | 세션 TTL 30분, 개수 상한 |
| `server.py` | 표준 라이브러리 HTTP 서버 |
| `cli.py` | 대화형 터미널 |
| `main.py` | 모델 파라미터 탐침 |
| `챗봇_API계약.md` | 프론트 담당자용 계약 |

## 빠른 시작

```bash
cd persona_explain
pip install -r requirements.txt
cp .env.example .env          # OPENROUTER_API_KEY 채우기
python server.py --mock       # 키 없이 형태만 확인
python server.py              # 키가 있으면 실제 모델
```

Windows 콘솔에서 한글이 깨지면 `PYTHONIOENCODING=utf-8`을 붙인다.

서버 주소는 `http://127.0.0.1:8000` — **브라우저에서 이 주소를 열면 연습장 화면**이 뜹니다.
(`--mock`이면 숫자만 나열하고, 키를 넣고 `python server.py`만 실행하면 OpenRouter의 gpt-5.4-mini를 씁니다.)

프론트 연동은 [챗봇_API계약.md](챗봇_API계약.md)만 보면 됩니다. `/health` 는 JSON입니다.

```bash
python cli.py --mock          # 터미널로 대화
pytest -q                     # 키 없이 전부 검증
python main.py --params       # gpt-5.4-mini가 받는 파라미터 확인
```

## 데이터

서버는 팀 저장소의 `apps/web/lib/generated/scores.json`을 읽는다.
기본 후보 경로는 `Desktop/wisor_develop/...` (공식 develop clone).
다른 위치를 쓰려면 `.env`에 `SCORES_JSON_PATH`를 적는다.

프론트는 지표 값을 보내지 않는다. `{ticker, persona}`만 보낸다.

## 모델

기본은 OpenRouter의 `openai/gpt-5.4-mini`. `.env`에 `OPENROUTER_API_KEY`가 있으면
`https://openrouter.ai/api/v1/chat/completions` 로 붙는다. OpenRouter 문서의 `requests.post`
예시와 **같은 주소·같은 Bearer 키**이고, OpenAI 호환 SDK가 그 POST를 대신 날린다.
키가 없거나 `--mock`이면 숫자를 나열하는 더미로 떨어진다.

모델이 `temperature`나 `max_tokens`를 거부하면 어댑터가 그 파라미터를 빼고 다시 부른다.
재생성은 가능한 한 `temperature=0.3` + 회피 지시를 쓰고, 온도를 못 받으면 힌트만으로 차이를 만든다.

## 대화 구조

```
[system]    공통 규칙 + 대가 프롬프트 + 채점 기준 + CRITERIA_RULES + CHAT_RULES
[user]      <지표> + <기준판정>     ← 앵커. 잘리지 않는다
[assistant] 첫 해설
[user]      후속 질문 …
```

기준 판정은 화면과 같은 pass/fail 문장이다. 챗봇은 그 문장을 되풀이하지 않고, 왜 그 기준을 쓰는지와 숫자가 무엇을 뜻하는지를 설명한다.

## 페르소나

`buffett` · `graham` · `lynch` · `greenblatt`. 이름은 `scores.json`의 `styles[].name`과 같다.

## 안전장치

- 블록 밖 숫자 창작 금지, 종목 외부 지식 금지
- 매수·매도·목표가·저평가·고평가·전망 표현은 1회 재생성 후 차단
- 차단된 답변은 대화 기록에 남기지 않는다
- 모든 해설 끝에 "이 설명은 교육용이며 투자 조언이 아닙니다."

## 테스트

`pytest -q`가 검증하는 것은 배선이다: 키 매핑, 앵커 고정, 세션 TTL, HTTP 계약, 안전 필터.
품질(3인칭 말투, 비유)은 `python cli.py`로 사람이 읽는다.
