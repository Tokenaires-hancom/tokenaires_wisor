# persona_explain

투자 대가 페르소나로 재무 지표를 **해설**하는 챗봇.
숫자는 팀 `scores.json`이 계산해 넘기고, LLM은 해설만 한다.

## 구성

| 파일 | 역할 |
|---|---|
| `personas.py` | 공통 규칙 + 대가별 시스템 프롬프트 |
| `explain.py` | 지표·기준판정 블록 조립, LLM 호출, 빈 응답 재생성 |
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

서버는 같은 저장소의 `apps/web/lib/generated/scores.json`을 읽는다.
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

점수를 내지 않는 대가는 앵커가 다르다. 지표도 기준 판정도 없어 `<회사>` 블록 하나만 싣는다.

```
[system]    확인질문 규칙 + 대가 프롬프트 + CHECKLIST_CHAT_RULES
[user]      <회사>                   ← 앵커
[assistant] 확인 질문 목록
```

## 페르소나

일곱이고 두 갈래다(`PERSONAS[...]["kind"]`).

| kind | id | 답변 |
|---|---|---|
| `score` | `buffett` · `graham` · `lynch` · `greenblatt` | 지표와 기준 판정을 읽어 준다 |
| `checklist` | `marks` · `fisher` · `soros` | 점수를 내지 않는다. 무엇을 확인할지 알려 준다 |

`score`의 이름은 `scores.json`의 `styles[].name`과 같다. `checklist`는 `scores.json`에
없으므로 `apps/web/content/masters.ts`의 이름을 쓰고, 순서도 그 파일을 따른다.

`checklist` 본문의 확인 항목은 `masters.ts`와 `content/curriculum/<id>.ts`에서 옮긴
것이다. 그 커리큘럼이 원문·정리·창작을 구분해 두었으므로 여기서 새로 지어내지 않는다.

## 안전장치

- 블록 밖 숫자 창작 금지
- 종목 외부 지식은 `score` 관점에서 금지다. 화면에 뜬 숫자와 챗봇이 말하는 숫자가
  어긋나면 안 되기 때문이다
- `checklist` 관점은 회사 얘기를 허용하되 **모든 주장에 출처를 붙이게** 한다.
  붙일 수 있는 출처는 셋뿐이다 — `[주어진 것]` `[업종 통례]` `[내 기억]`.
  세 종류로 가두는 이유는 열어 두면 모델이 문서 이름과 쪽수를 지어내기 때문이다.
  지어낸 인용은 확인된 것처럼 보여 표시 없는 기억보다 위험하다
- 대가는 1인칭으로 말한다
- `checklist` 관점은 숫자가 아예 없어 외부 지식 유혹이 더 크다. 그래서 회사에 대한
  서술 자체를 막고, 물을 것과 확인할 곳만 답하게 한다
- 빈 응답은 1회 재생성 후 안내 문구로 끝난다
- 차단된 답변은 대화 기록에 남기지 않는다

## 테스트

`pytest -q`가 검증하는 것은 배선이다: 키 매핑, 앵커 고정, 세션 TTL, HTTP 계약, 빈 응답 재생성.
품질(대가별 말투, 비유)은 `python cli.py`로 사람이 읽는다.
