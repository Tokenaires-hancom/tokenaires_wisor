# 배포

> 담당: 2번(백엔드·플랫폼·배포·환경변수)
> 현재 운영은 OCI의 <https://wisor.site>입니다. 자동 배포 계약은
> [OCI main 자동 배포](./oci-autodeploy.md)에 있습니다. `render.yaml`은 기존 Render 설정입니다.

---

## 현재 운영: OCI

GitHub `main`의 애플리케이션 변경은 `.github/workflows/deploy-oci.yml`이 검사한 뒤 OCI에
커밋 SHA 단위로 배포합니다. 서버는 `/opt/wisor/releases/<sha>`의 불변 release를 만들고,
Web·Persona 이미지가 모두 healthy이며 외부 경로가 응답할 때만 전환을 확정합니다. 실패하면
이전 이미지·코드·배치 소스를 함께 복원합니다.

점수 JSON과 재무 캐시만 바뀐 자동 커밋은 앱 배포를 시작하지 않습니다. OCI의 별도 배치가
운영 데이터를 갱신하므로 3시간마다 같은 이미지를 중복 빌드하지 않기 위한 구분입니다.

---

## 기존 Render 배포

| 서비스 | 런타임 | 주소 | 저장소 위치 |
|---|---|---|---|
| 웹 | Node 24 · `next start` | <https://wisor-w0fu.onrender.com> | `apps/web` |
| 해설 챗봇 API | Python · `ThreadingHTTPServer` | <https://tokenaires-wisor.onrender.com> | `persona_explain` |

둘 다 Render의 **별도 서비스**입니다. 웹은 Node, 챗봇은 Python이라 한 서비스에 넣으려면
두 런타임을 담은 Dockerfile과 프로세스 매니저가 필요합니다. 나누는 쪽을 택했습니다.

브라우저는 챗봇 주소를 모릅니다. `/api/persona`만 보고, Next의 rewrite가
`PERSONA_API_ORIGIN`으로 넘깁니다(`apps/web/next.config.mjs`).

```
브라우저 → wisor-w0fu.onrender.com/api/persona/health
         → (rewrite) tokenaires-wisor.onrender.com/health
```

**Netlify는 더 이상 쓰지 않습니다.** 예전 배포(`tokenaires-wisor.netlify.app`)는
`PERSONA_API_ORIGIN`이 없어 `/api/persona/health`가 500을 냈습니다. 루트 `netlify.toml`은
삭제했고, 되살릴 일이 생기면 git 이력에서 꺼냅니다.

> 🚨 **Netlify 대시보드에서 저장소 연결과 자동 배포가 끊겼는지 확인해야 합니다.**
>
> 삭제한 `netlify.toml`은 주석에 이렇게 적혀 있었습니다 — *"Netlify UI의 Build settings는
> 비워 둔다. 이 파일이 UI 설정을 덮어쓰므로"*, 그리고 *"이 줄이 없으면 base 디렉터리가
> 통째로 발행돼 소스가 그대로 공개된다. **실제로 그렇게 나갔다.**"*
>
> 즉 UI 설정은 의도적으로 비어 있고, 이 파일이 유일한 설정이었습니다. 파일이 사라진
> 채로 그 사이트가 다시 빌드되면 `base`·`publish`·`command`가 전부 없어
> **소스가 공개됐던 사고가 재현됩니다.**
>
> 로컬 `.netlify/` 상태는 삭제했습니다. 로컬 파일 삭제는 외부 사이트나 Git 연결을 끊지
> 않으므로, 남은 연결 여부는 Netlify 대시보드에서 확인하고 필요하면 해제하세요. — 2번

---

## 환경변수

`render.yaml`에 값까지 적힌 것은 비밀이 아닌 것뿐입니다. 비밀값은 Render UI에서 채웁니다.

### 웹 (`wisor`)

| 키 | 값 | 없으면 |
|---|---|---|
| `NODE_VERSION` | `24` | 플랫폼 기본 버전으로 빌드됩니다. `package.json`의 `engines`는 `>=23`이지만 Render는 이 필드로 런타임을 고르지 않습니다 |
| `PERSONA_API_ORIGIN` | `https://tokenaires-wisor.onrender.com` | `127.0.0.1:8000`으로 떨어져 **챗봇이 전부 500**입니다. Netlify 배포가 죽었던 원인이 이것입니다 |

`PERSONA_API_ORIGIN`은 **스킴까지 있어야 합니다.** rewrite가 `${origin}/:path*`로 이어
붙이기 때문입니다. Render의 `fromService`가 주는 `host`·`hostport`는 스킴이 없어
여기에 쓸 수 없습니다. 그래서 `render.yaml`에 주소를 그대로 적었습니다.

### 챗봇 (`tokenaires-wisor`)

| 키 | 값 | 없으면 |
|---|---|---|
| `HOST` | `0.0.0.0` | **`server.py`의 기본값은 `127.0.0.1`입니다.** 그대로 두면 Render가 서비스에 붙지 못합니다 |
| `PORT` | **적지 않습니다** | Render가 주입하고 `server.py`가 `os.getenv("PORT")`로 읽습니다. 손으로 적으면 플랫폼이 준 값을 덮어써서 붙지 못합니다 |
| `ALLOWED_ORIGINS` | `https://wisor-w0fu.onrender.com` | `*`로 떨어집니다. 개발 기본값이라 배포에서는 좁힙니다 |
| `PERSONA_MODEL` | `openai/gpt-5.4-mini` | OpenRouter 키가 있으면 같은 기본값, OpenAI 직접이면 `gpt-4o-mini` |
| `OPENROUTER_API_KEY` | (Render UI) | `MockAdapter`로 떨어집니다. 서버는 살아 있지만 해설이 고정 문구가 됩니다 |
| `SCORES_JSON_PATH` | **적지 않습니다** | 3장 참고 |

---

## 챗봇이 `scores.json`을 찾는 방법

`rootDir: persona_explain`은 빌드·실행 디렉터리만 정합니다. **저장소 전체가 체크아웃됩니다.**
그래서 `scores_source.PATH_CANDIDATES`의 첫 후보가 그대로 잡힙니다.

```
persona_explain/../apps/web/lib/generated/scores.json
```

`SCORES_JSON_PATH`를 따로 줄 필요가 없습니다. 못 찾으면 `ScoresNotFound`로 죽으면서
찾아본 경로를 전부 출력하므로, 로그를 보면 바로 압니다.

> ⚠️ **웹과 챗봇은 같은 파일을 다른 시점에 읽습니다.** 웹은 빌드 시점에 번들로 굽고,
> 챗봇은 런타임에 파일을 엽니다. 두 서비스를 따로 배포하므로 한쪽만 재배포하면
> **같은 종목에 서로 다른 기준일 값을 낼 수 있습니다.** `scores.json`이 갱신되면
> 두 서비스를 함께 재배포합니다.

---

## `scores.json` 운영 갱신 경로

```
OCI wisor-batch.timer
  → /opt/wisor/batch-source의 고정된 코드로 배치 실행
  → 데이터 검증
  → Web·Persona를 같은 scores.json으로 함께 전환
```

`.github/workflows/scores.yml`은 예약 실행을 하지 않는 수동 복구 수단입니다. 선택한 브랜치에
생성 파일을 커밋하지만, 생성 파일만 바뀐 push는 OCI 앱 자동 배포 대상에서 제외됩니다.
운영 데이터 전환은 서버 배치 경로를 사용합니다.

---

## 콜드스타트

무료 플랜은 유휴 상태에서 서비스를 재웁니다. 챗봇은 예열로 다룹니다.

`components/PersonaChatFab.tsx`가 마운트 시 `getHealth()`를 한 번 던져,
사용자가 버튼을 누르기 전에 서버가 깨어나도록 합니다. 실패는 `console.debug`로 삼키고
화면에 영향을 주지 않으며, 열 때 `ensureHealth`가 다시 확인합니다.

---

## Blueprint로 동기화하기 전에

`render.yaml`은 저장소에 있기만 해서는 **아무 일도 하지 않습니다.** 지금 도는 두 서비스는
Render UI에서 손으로 만들었고, Blueprint는 사람이 명시적으로 동기화할 때만 적용됩니다.

**Blueprint는 서비스를 이름으로 찾습니다. 이름이 다르면 기존 서비스를 고치는 대신
새 서비스를 새 URL로 만듭니다.** 동기화 전에 아래를 Render 대시보드에서 확인하세요.

| 확인할 것 | `render.yaml`에 적힌 값 | 근거 |
|---|---|---|
| 웹 서비스 이름 | `wisor` | URL `wisor-w0fu.onrender.com`에서 추론. `-w0fu`는 이름이 겹칠 때 Render가 붙이는 접미사 |
| 챗봇 서비스 이름 | `tokenaires-wisor` | URL에 접미사가 없어 이름과 같음 |
| 플랜 | `free` | 콜드스타트가 관측됨 |
| 웹 start 명령 | `npm run start` | `package.json`의 스크립트. `next start -p 3000`이고 Render가 열린 포트를 감지 |
| `ALLOWED_ORIGINS` | `https://wisor-w0fu.onrender.com` | 관측값이 아니라 고른 값입니다. 개발 기본값 `*`보다 좁힌 것이고, 브라우저는 Next rewrite를 거치므로 챗봇에 교차 출처 요청을 보내지 않아 좁혀도 동작에 영향이 없습니다 |

이름이 다르면 **`render.yaml`을 실제 이름에 맞추고 나서** 동기화합니다.

키 이름도 함께 확인하세요. Render는 예전에 `env:`를 쓰다가 `runtime:`으로 바꿨고,
이 파일은 `runtime:`으로 적혀 있습니다. **최상위 키가 스키마와 다르면 파싱 단계에서
실패합니다** — 정작 동작해야 할 때 걸립니다. Render 대시보드의 Blueprint 검증으로
먼저 통과시킨 뒤 적용하세요.

`render.yaml`에 넣지 않은 것도 있습니다. `healthCheckPath`는 지금 UI 설정을 모르는
상태에서 추가하면 동기화가 동작을 바꾸므로 뺐습니다. 챗봇은 `/health`, 웹은 `/`가
쓸 만한 값입니다.

---

## 로컬에서 같은 구성 돌리기

```bash
# 챗봇 (터미널 1)
cd persona_explain
pip install -r requirements.txt
cp .env.example .env        # OPENROUTER_API_KEY 채우기. 없으면 Mock으로 돈다
python server.py            # http://127.0.0.1:8000

# 웹 (터미널 2)
cd apps/web
npm install
npm run dev                 # http://localhost:3000
```

`PERSONA_API_ORIGIN`의 로컬 기본값이 `http://127.0.0.1:8000`이라
`apps/web/.env.local` 없이도 붙습니다. 확인은 <http://localhost:3000/api/persona/health>.
