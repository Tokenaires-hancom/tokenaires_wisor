# 클린 코드 검수 게이트 — 설계

작성일 2026-08-18

---

## 배경

`2026-08-11-pr-review-system-design.md`는 "병합을 강제로 막는 게이트를 만들지 않는다"를 목표가 아닌 것으로 명시했다. 4명이 막 직접 커밋 관행에서 PR로 전환하던 시점이라, 게이트가 고장처럼 느껴지지 않게 하려는 판단이었다.

이제 그 전환은 끝났고, 실제로 운영하면서 "테스트도 안 돌려보고 커밋", "같은 로직이 여러 파일에 복붙" 같은 사고가 나기 전에 막을 필요가 생겼다. 이 설계는 **그 방향을 공식적으로 뒤집는다** — chrusterd(기술 리드)의 결정이다.

이 시스템의 목적은 하나로 좁힌다: **정해둔 규칙과 테스트를 위반하지 않고 코드가 생성됐는지 검수한다.** 4명이 "좋은 코드를 알아보게" 만드는 학습·코칭 기능은 의도적으로 범위 밖에 둔다 — 그건 이미 `claude-quality-review.yml`이 다른 목적(교육)으로 하고 있었고, 이번 설계와는 다른 문제다.

### 이미 있던 것과의 관계

설계 전에 저장소를 직접 확인한 결과, 상당 부분이 이미 있었다.

- **`pr-review.yml`**이 이미 PR마다 `data-pipeline pytest`, `apps/web npm run build`, `npx tsc --noEmit`, 번들 누출 grep, `boundary_check.py`, develop 병합 가능 여부를 전부 돌리고, 실패하면 워크플로 자체를 실패 처리한다(`위반 있으면 실패로 표시` 스텝). **다만 어느 브랜치 보호 규칙에도 연결돼 있지 않아 병합을 막지는 않는다.**
- **`pr_format_check.py`**가 이미 PR 제목(`type: 설명`)과 본문 3섹션을 검사한다. 의도적으로 소프트 게이트다(워크플로 실패 판정에서 제외).
- **`.claude/hooks/require-review-before-commit.sh`**가 이미 `git commit` 직전에 개입해서 `/simplify → /code-review`를 돌렸는지 확인한다. 다만 **절차만 확인하고 내용은 검증하지 않는다** — `mark-commit-reviewed.sh`만 실행하고 실제 리뷰·수정을 건너뛰어도 통과된다.
- **`.claude/hooks/verify.sh`**가 점수 모델 파일 수정 직후 테스트를 돌리지만 항상 `exit 0`이라 절대 막지 않는다.
- **CODEOWNERS**는 4명을 대칭으로 등록해뒀을 뿐, 경로별 소유자 구분이 없다.

이 설계는 위 인프라를 최대한 재사용한다. 새로 만드는 건 정말 없는 부분(문자 그대로의 중복 탐지, 로컬 빠른 하드블록, push 전 검수, 게이트키퍼 강제)으로 좁힌다.

## 목표가 아닌 것

- 4명이 코드를 스스로 알아보게 만드는 학습·코칭 (`claude-quality-review.yml`이 이미 다른 목적으로 하던 것과 별개로, 이번 시스템은 다루지 않는다)
- 새 외부 의존성 추가 (루트 `CLAUDE.md`의 "❌ 의존성 추가" 원칙 유지 — husky·jscpd 등 대신 git 내장 기능과 표준 라이브러리만 쓴다)
- 개별 커밋 메시지 하드블록 (검토했으나 기각 — `pr_format_check.py`가 이미 PR 제목·본문 형식을 검사하고 있어 중복이라고 판단했다)
- 판단이 필요한 항목(파급범위, 관용적 패턴, 의미상 중복, 커밋 메시지 충실도)을 하드블록하는 것 — confidence가 높아도 LLM 판단은 틀릴 수 있고, 이 팀은 그 판단을 반박할 방법이 없다. 이 항목들은 항상 "알려주고 사람이 승인해야 고친다"로 유지한다

## 결정 사항

### 1. 전체 구조

```
커밋마다        → ① 로컬 하드블록 (결정론적 스크립트, LLM 없음)
push 직전 1회   → ② /code-review + /simplify (CLAUDE.md 클린코드 원칙 + 도메인 규칙 + 일반 품질 감사)
push 직후        → ②의 결과를 PR에 sticky 코멘트로 기록
PR 오픈/갱신 시  → 기존 pr-review.yml (규칙 기반)만 유지
머지 시도 시     → branch protection (서버 최종 방어선)
```

`claude-quality-review.yml`/`quality-review-prompt.md`와 `claude-rules-review.yml`/`rules-review-prompt.md` **둘 다 폐기한다** — ②(`/code-review`+`/simplify`)가 CLAUDE.md 전체(클린코드 원칙 + 도메인 규칙: 매수·매도 권유 금지, 금지 문구 등)를 감사 근거로 삼으므로 두 레이어의 판단 영역을 모두 흡수한다.

**알려진 리스크(수용함, chrusterd 결정)**: ②는 로컬 Claude Code 세션 안에서만 실행된다. `claude-rules-review.yml`처럼 GitHub `pull_request` 이벤트에 걸려 무조건 도는 서버 트리거가 없으므로, 누군가 터미널에서 직접 `git push`하거나 세션이 중간에 끊기면 ②가 아예 안 도는 경우가 생길 수 있다. 실제로 저장소의 과거 커밋 152개 중 Claude 공동저자 트레일러가 있는 건 79개뿐이었지만, 이 저장소는 커밋 메시지에 트레일러를 요구하지 않아 이 수치로 "Claude Code를 안 거쳤다"를 증명할 수는 없었다 — 즉 과거에도 사후 감사(audit)가 불가능했다는 뜻이고, 이 상태를 그대로 받아들이기로 했다. 추후 필요해지면 `pr-review.yml`에 "이 PR에 `wisor-local-review` 코멘트가 없다"만 표시하는(막지 않는) 감지 스텝을 저비용으로 추가할 수 있다 — 지금은 범위 밖.

### 2. 로컬 하드블록 (①)

**대상 (전부 결정론적, LLM 서브에이전트 불필요)**

| 항목 | 판정 | 부재 시 |
|---|---|---|
| 테스트 실패 | 변경된 영역만 빠르게 (예: `data-pipeline`만 고쳤으면 그 pytest만) | 테스트가 아예 없으면 통과 — 충분성은 사람이 PR에서 판단 |
| 문자 그대로의 중복 | 신규 스크립트, 유사도 임계값 기반 | — |

**전체 5종(pytest 양쪽 + build + tsc + 번들누출) 풀세트는 로컬에서 강제하지 않는다.** 매 커밋마다 다 돌리면 느려서 큰 커밋으로 몰아 우회하는 부작용이 커진다. 풀세트는 4번(서버 최종 방어선)에서 강제한다.

**자동 수정**
- 하드블록 2항목에만 적용. 2회 시도 → 실패하면 포기하고 사람에게 넘김(오버라이드 가능)
- 테스트 실패 자동 수정 시 **테스트 파일은 절대 건드리지 않는다** — 구현 코드만 고친다. 테스트를 약화시켜 통과시키는 것은 검증 시스템 자체를 무력화한다
- 수정 결과는 원래 커밋에 합치지 않고 `auto-fix: <설명>` 형태의 **별도 커밋**으로 분리한다

**오버라이드**
- 하드블록을 사유를 남기고 강행할 수 있다
- 오버라이드하면 **다음 push 시 PR에 흔적을 남긴다** (어떤 규칙을, 왜 우회했는지)
- 정상 통과와 경고는 흔적을 남기지 않는다 — 오버라이드만 예외적으로 기록해서 신호 대 잡음비를 지킨다

**트리거 이중화**

`require-review-before-commit.sh`는 아래 두 검사를 실제로 수행하도록 교체한다(기존 절차 확인 로직은 폐기).

- **Claude Code 훅** (`PreToolUse`, 기존 `Bash(git commit*)` matcher 유지): Claude Code로 커밋할 때
- **git 네이티브 훅** (`.githooks/pre-commit` + `git config core.hooksPath .githooks`): 터미널에서 직접 커밋해도 걸리게. 순수 git 기능 + 표준 라이브러리 스크립트라 의존성 추가 없음. 자동 수정 기능은 AI가 필요하므로 여기서는 지원하지 않는다 — 차단만 하고 "Claude Code에서 고치라"고 안내한다

### 3. push 전 검수 (②)

`git push` 시도 시 세션이 자동으로 다음을 수행한다.

1. staged 아님, **push될 커밋 전체의 diff**를 대상으로 `/code-review` → `/simplify` 실행
2. CLAUDE.md에 문서화된 클린코드 원칙(6번 참고)을 `/code-review`의 CLAUDE.md 준수 감사가 자동으로 확인한다 — 별도 지시 불필요, CLAUDE.md에 원칙만 명시하면 됨
3. 발견 사항이 있으면 **사람에게 보여주고 "고칠까요?" 질문**. 승인하면 그 자리에서 수정(일반적인 Claude Code 작업이라 자동수정 안전장치 불필요 — 사람이 매번 확인함)
4. push 완료 후, 이 리뷰 결과 요약을 PR에 sticky 코멘트로 남긴다 (`<!-- wisor-local-review -->` 마커, 위반 없어도 "위반 없음" 명시) — 리뷰를 다시 돌리는 게 아니라 **로컬에서 이미 나온 결과를 재활용**하므로 추가 비용이 없다

이 레이어는 매 커밋이 아니라 **push 1회당 1번**만 돈다 — 커밋은 로컬에서 자주 하고 push는 그보다 드물게 하므로, 무거운 LLM 리뷰의 실행 빈도를 실질적으로 낮춘다.

### 4. 서버 최종 방어선

로컬 git 훅은 `git commit --no-verify`로 우회 가능하다 — 클라이언트 설정만으로는 원천 차단이 안 된다. 그래서 진짜 강제력은 서버에 둔다.

`pr-review.yml`은 이미 실패 신호를 내고 있으므로(위 "배경" 참고), **branch protection에 이 워크플로를 필수 상태 검사로 등록**하기만 하면 된다.

**예외 하나 — 구현 중 발견**: `duplicate_check.py`(문자 그대로의 중복)는 원래 로컬 훅에만 연결할 계획이었는데, 그러면 `git commit --no-verify`로 우회했을 때 중복 검사만 서버 백업이 없는 구멍이 남는다는 걸 구현하다 발견했다. 그래서 `pr-review.yml`에도 같은 스크립트를 `--base origin/develop` 모드로 추가했다(로컬은 `git diff --cached`, 서버는 `git diff <base>...HEAD` — 같은 함수, diff 소스만 다름). 이걸로 이 스크립트도 "새로 만들 게 없다"에 포함된다 — 로컬용으로 이미 만든 스크립트를 서버에서도 그대로 재사용했다.

```
gh api repos/Tokenaires-hancom/tokenaires_wisor/branches/develop/protection \
  -X PUT -F required_status_checks[strict]=true \
  -F required_status_checks[contexts][]=... (pr-review.yml의 job 이름)
```

### 5. 거버넌스

**게이트키퍼**: naemnaem99 (2026-08-19 변경, 원래 chrusterd로 설계했었다 — 아래 참고)

**경로 기반 (CODEOWNERS 확장, GitHub 기본 기능으로 해결)**

```
* @chrusterd @rainbow0291 @naemnaem99 @limsojang-gif
.claude/** @naemnaem99
.githooks/** @naemnaem99
CLAUDE.md @naemnaem99
scripts/pr_checks/** @naemnaem99
```

branch protection에서 `require_code_owner_reviews: true`로 켜면, 이 경로들을 건드리는 PR은 naemnaem99 승인 없이 병합할 수 없다. 커스텀 스크립트 불필요.

**오버라이드 흔적 기반 (경로로 못 잡으므로 별도 체크 필요)**

오버라이드 흔적이 있는 PR은 경로와 무관하게 naemnaem99 승인이 필요하다. 이건 CODEOWNERS로 표현이 안 되므로, PR 코멘트/커밋 메시지에서 오버라이드 마커를 찾아 naemnaem99를 리뷰어로 지정하는 작은 체크를 `pr-review.yml`에 추가한다.

**평소 PR**: 4명 상호 승인 (지금은 승인 0명이어도 병합 가능한 상태 — `required_approving_review_count`를 1 이상으로 새로 설정하는 것이니 기존 관행을 유지하는 게 아니라 새로 도입하는 규칙이다)

### 6. CLAUDE.md 갱신

루트 `CLAUDE.md`에 클린코드 원칙 섹션을 추가한다. `/code-review`의 CLAUDE.md 준수 감사 에이전트가 그대로 읽으므로, 이 문서화 자체가 곧 ②의 검사 기준이 된다 — 클린코드 원칙뿐 아니라 기존 `rules-review-prompt.md`가 보던 도메인 규칙(핵심 원칙, 문장 규칙, "절대 하지 말 것")도 이미 루트 `CLAUDE.md`에 있으므로 별도 작업 없이 같이 흡수된다.

- **파급범위 최소화**: 한 기능 변경이 건드리는 파일 수·모듈 경계를 최소화한다
- **관용적 패턴 우선**: 트릭보다 예측 가능한 흔한 패턴을 쓴다
- **중복 없이 재사용**: 같은 로직을 복붙하지 말고 함수로 뽑아 재사용한다 (문자 그대로의 중복은 ①이 하드블록, 의미상 중복은 ②가 경고)
- **커밋 메시지는 왜를 설명**: 이미 있는 규칙("무엇을 바꿨는지가 아니라 왜")을 클린코드 맥락에서도 재확인

## 롤아웃 절차

일괄 적용한다(단계적 도입 안 함) — chrusterd가 지금 바로 필요하다고 판단.

1. CLAUDE.md에 클린코드 원칙 섹션 추가
2. `scripts/pr_checks/duplicate_check.py` 작성 (신규, stdlib 전용)
3. `.githooks/pre-commit` 작성 + `core.hooksPath` 설정을 저장소 초기화 스크립트/README에 안내 (자동 적용 안 되므로 4명 각자 한 번 설정해야 함)
4. `.claude/hooks/require-review-before-commit.sh` 교체 (① 로직으로)
5. push 시 ② 트리거 (CLAUDE.md의 "Claude Code 사용 규칙" 섹션에 명시 — push 전 `/code-review`+`/simplify` 실행이 표준 절차임을 기술)
6. `claude-quality-review.yml`/`quality-review-prompt.md`, `claude-rules-review.yml`/`rules-review-prompt.md` 삭제
7. `pr-review.yml`에 오버라이드 흔적 체크 스텝 추가
8. CODEOWNERS 경로 확장
9. branch protection 설정 (필수 상태 검사 + 코드오너 리뷰 + 승인 1명 이상)
10. `2026-08-11-pr-review-system-design.md`의 "목표가 아닌 것"·"범위 밖"에 갱신 이력 추가 (이 문서가 그 결정을 뒤집었음을 기록)
11. **확인 필요(구현 중 발견, 2026-08-19)**: `/code-review`·`/simplify`가 이 저장소의 `.claude/settings.json`에 선언돼 있지 않다 — naemnaem99 개인 환경에 설치된 플러그인 마켓플레이스(`claude-plugins-official`)에서 나온 것으로 보인다. 나머지 3명(`rainbow0291`·`chrusterd`·`limsojang-gif`) 각자의 Claude Code 환경에서 `/code-review`가 인식되는지 확인 필요 — 안 되면 ②(push 전 검수)가 그 사람에게는 아예 작동하지 않는다.

## 에러 처리

- 자동 수정이 2회 시도 후에도 실패하면 하드블록 상태로 남고, 오버라이드 경로로만 진행 가능
- git 네이티브 훅과 Claude Code 훅이 이중으로 걸려도 같은 검사를 두 번 하지 않도록, 상태 파일(`​.git/claude-review-state` 패턴 재사용)로 이미 통과한 staged diff는 재검사하지 않는다
- branch protection 필수 검사가 GitHub 쪽 장애로 안 뜨면(예: Actions 다운) 병합이 막힌다 — 이건 의도된 동작이다(사람이 실패로 인지하고 기다리거나 관리자 권한으로 예외 처리)

## 테스트

- `scripts/pr_checks/duplicate_check.py`는 기존 `boundary_check.py`와 같은 스타일로 통과·위반 fixture 단위 테스트를 포함한다
- `.githooks/pre-commit`, `require-review-before-commit.sh`는 결함을 심은 테스트 커밋으로 실제로 막히는지 확인한다 (테스트 실패 상태로 커밋 시도 → 차단 확인, 중복 코드 커밋 시도 → 차단 확인)
- branch protection 설정 후, 일부러 실패하는 테스트 PR로 병합 버튼이 실제로 비활성화되는지 확인한다

## 범위 밖

- 4명의 "좋은 코드를 알아보는 눈"을 기르는 것 — `claude-quality-review.yml`이 다루던 목적이었으나 이 시스템의 책임이 아니다
- 파급범위·관용적 패턴·의미상 중복·커밋 메시지 충실도를 하드블록하는 것 — 항상 경고+승인 방식 유지
- 개별 커밋 메시지 형식 하드블록 — `pr_format_check.py`가 PR 레벨에서 이미 다룸
- ②가 실행되지 않은 push를 감지·표시하는 것 — 필요성은 인지하나 지금은 만들지 않는다(위 "1. 전체 구조"의 "알려진 리스크" 참고)
