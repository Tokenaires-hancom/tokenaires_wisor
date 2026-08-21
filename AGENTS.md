# AGENTS.md — Wisor

이 저장소에서 일하는 모든 코딩 에이전트(Codex, Claude Code 등)를 위한 파일입니다.

## 먼저 읽을 것

**규칙 본문은 [`CLAUDE.md`](CLAUDE.md)에 있습니다. 작업 시작 전에 읽으세요.**
웹 앱을 건드린다면 [`apps/web/CLAUDE.md`](apps/web/CLAUDE.md)도 함께 읽습니다.

이 파일에 규칙을 복사해 두지 않았습니다. 두 벌이 되면 반드시 갈라지기 때문입니다.
다만 어겼을 때 되돌리기 어려운 것들만 아래에 다시 적습니다.

## 작업 위치

정본은 한 곳입니다.

```
C:\Users\Har27\Documents\Codex\2026-08-11\new-chat\tokenaires_wisor
```

이 머신에는 같은 저장소의 다른 사본이 있을 수 있습니다(예: `Downloads\tokenaires_wisor-main`).
**정본이 아닌 곳에서 작업하지 마세요.** 실제로 개발 서버가 다른 사본에서 뜨는 바람에,
고치지도 않은 화면을 검증한 사고가 있었습니다.

개발 서버를 띄우기 전에 어느 경로에서 도는지 확인하세요.

```bash
# 3000번 포트를 잡은 프로세스의 실제 경로
powershell -Command "Get-NetTCPConnection -LocalPort 3000 -State Listen | ForEach-Object { (Get-CimInstance Win32_Process -Filter \"ProcessId=$($_.OwningProcess)\").CommandLine }"
```

## 어기면 되돌리기 어려운 것

전체 목록은 `CLAUDE.md`의 「절대 하지 말 것」에 있습니다. 그중에서도:

- **없는 값을 0으로 채우지 않습니다.** 판정할 데이터가 없으면 `fail`이 아니라 `unknown`이고, 점수의 분모에서도 빠집니다.
- **주식 화면에 빨강·초록을 쓰지 않습니다.** 두 색은 가격 방향을 뜻하는데 이 제품은 방향을 말하지 않습니다. 상태를 색만으로 구분하지 말고 채움·빗금·점선을 함께 씁니다.
- **응답 스키마에 `confidence` · `targetPrice` · `buySignal` 류 필드를 넣지 않습니다.** 스키마의 `extra="forbid"`는 실수가 아니라 방어선입니다.
- **컴포넌트에서 `localStorage`를 직접 부르지 않습니다.** 저장은 `apps/web/lib/store.ts`를 거칩니다.
- **클라이언트 컴포넌트에서 `lib/scores.ts`를 import하지 않습니다.** `scores.json` 전체가 브라우저 번들에 실립니다.
- **의존성을 마음대로 추가하지 않습니다.** 지금 웹은 Next와 React뿐입니다. 정말 필요하면 먼저 물어보세요.
- **`git push`는 사람이 시켰을 때만.** 기본 브랜치는 `develop`이고, 작업은 `feat/…` `fix/…` 브랜치에서 합니다.

## push 전 검수

Claude Code에는 `git push`를 한 번 막고 검수를 거치게 하는 훅이 있습니다(`.claude/hooks/pre-push-check.sh`).
**Codex에는 그 자동 차단이 없으므로 직접 해야 합니다.** push하기 전에 이 파일을 읽고 그대로 수행하세요.

```
.claude/skills/clean-check/SKILL.md
```

이번에 push될 diff를 클린 코드 5원칙 항목별로 판정해서 알려줍니다.
**결과는 아무것도 막지 않습니다** — 지적을 보고 고칠지 그대로 갈지는 사람이 정합니다.
마지막 단계의 `--mark`는 Claude Code 훅의 상태 파일을 갱신하는 것이라 Codex에서는 건너뜁니다.

저장소 **전체** 상태를 보는 검수는 따로 있고, 사람이 시킬 때만 돕니다.

```
.claude/skills/whole-check/SKILL.md
```

결과는 `docs/audit/YYYY-MM-DD.md`에 남습니다. 회차끼리 비교하는 것이 목적이라 형식이 고정입니다.

**두 파일은 Claude Code와 Codex가 같이 씁니다. Codex용 사본을 따로 만들지 마세요.**
두 벌이 되면 갈라지고, 그러면 같은 코드가 누가 검수했느냐에 따라 다르게 판정됩니다.
판정 기준(❌ · ⚠️ · ✅ · 해당 없음)은 `CLAUDE.md`의 「검수 등급」 절 한 곳에만 있습니다.

## 인계

에이전트가 바뀔 때 [`docs/HANDOFF.md`](docs/HANDOFF.md)를 읽고, 작업을 마치면 갱신하세요.
설계 문서와 구현 계획은 `docs/superpowers/specs/`와 `docs/superpowers/plans/`에 커밋됩니다.
`.superpowers/`는 `.gitignore` 대상이라 다른 에이전트에게 넘어가지 않습니다 —
남겨야 할 내용은 `docs/` 아래에 두세요.

## 확인

바꾼 뒤에는 이 셋을 통과시킵니다.

```bash
cd apps/web
npm test        # node --test, content/**/*.test.ts 와 lib/**/*.test.ts
npm run build
```

화면을 바꿨다면 개발 서버에서 눈으로도 확인합니다. 이 프로젝트의 결함은
텍스트 diff에 안 나타나는 경우가 많습니다 — 실제로 캐릭터 이미지의 머리카락이
지워진 결함을 diff로는 못 잡고 그림을 열어서 찾았습니다.
