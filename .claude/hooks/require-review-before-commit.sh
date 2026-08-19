#!/usr/bin/env bash
# git commit 직전에 실제로 검사한다 — 테스트 실패와 문자 그대로의 중복만
# 결정론적으로 막는다(루트 CLAUDE.md "클린 코드 원칙" 참고).
#
# 예전 버전은 /simplify -> /code-review를 "돌렸는지"만 절차로 확인했다.
# 이 버전은 그 절차 확인을 버리고 직접 검사·판정한다 — 절차만 확인하면
# 실제로 문제를 안 고치고 mark만 남기는 것도 통과됐기 때문이다.
#
# staged diff의 해시를 .git/claude-review-state와 비교해서, 이미 통과한
# 내용 그대로면 다시 막지 않는다. .githooks/pre-commit과 이 상태 파일을
# 공유한다 — Claude Code로 커밋하면 이 훅과 git 네이티브 훅이 이중으로
# 걸리는데, 먼저 통과한 쪽이 남긴 해시를 나중 쪽이 보고 건너뛴다.
#
# 실패하면 2회까지는 "고쳐서 다시 시도하라"고 deny하고, 그래도 실패하면
# override-commit.sh로 사유를 남기고 강행하는 길을 안내한다.

set -uo pipefail

payload=$(cat)

if python3 -c "print(1)" >/dev/null 2>&1; then
  py=python3
else
  py=python
fi

command=$(printf '%s' "$payload" | "$py" -c "import json,sys; print(json.load(sys.stdin).get('tool_input',{}).get('command',''))" 2>/dev/null)

# git commit이 아니면 관여하지 않는다.
printf '%s' "$command" | grep -Eq '(^|&&|;|\|)[[:space:]]*git[[:space:]]+commit([[:space:]]|$)' || exit 0

root="${CLAUDE_PROJECT_DIR:-$(pwd)}"
state_file="$root/.git/claude-review-state"
attempts_file="$root/.git/claude-review-attempts"
override_file="$root/.git/claude-review-override"

staged_diff=$(cd "$root" && git diff --cached)

# 스테이징된 변경이 없으면(예: --amend, 빈 커밋) 검토할 게 없다.
if [ -z "$staged_diff" ]; then
  exit 0
fi

current_hash=$(printf '%s' "$staged_diff" | sha256sum | cut -d' ' -f1)
reviewed_hash=$(cat "$state_file" 2>/dev/null || true)

if [ "$current_hash" = "$reviewed_hash" ]; then
  exit 0
fi

# 이 diff에 대해 오버라이드가 기록돼 있으면 통과시킨다 — 검사를 다시 안
# 돌린다. 사람이 이미 사유를 남기고 강행하기로 정했다.
override_line=$(cat "$override_file" 2>/dev/null || true)
if [ "${override_line%% *}" = "$current_hash" ]; then
  printf '%s' "$current_hash" > "$state_file"
  rm -f "$attempts_file"
  exit 0
fi

fail=0
changed_files=$(cd "$root" && git diff --cached --name-only)

if printf '%s\n' "$changed_files" | grep -q '^data-pipeline/'; then
  if ! (cd "$root/data-pipeline" && "$py" -m pytest -q); then
    fail=1
  fi
fi

if printf '%s\n' "$changed_files" | grep -q '^apps/web/'; then
  if ! (cd "$root/apps/web" && npm test); then
    fail=1
  fi
fi

if ! (cd "$root" && "$py" scripts/pr_checks/duplicate_check.py); then
  fail=1
fi

if [ "$fail" -eq 0 ]; then
  printf '%s' "$current_hash" > "$state_file"
  rm -f "$attempts_file"
  exit 0
fi

# 실패했다. 이 diff 해시에 대한 연속 실패 횟수를 센다.
attempt_line=$(cat "$attempts_file" 2>/dev/null || true)
if [ "${attempt_line%% *}" = "$current_hash" ]; then
  count="${attempt_line##* }"
else
  count=0
fi
count=$((count + 1))
printf '%s %s' "$current_hash" "$count" > "$attempts_file"

if [ "$count" -lt 2 ]; then
  reason="테스트 실패 또는 문자 그대로의 중복이 있습니다(${count}/2회 시도). 구현 코드를 고치세요 — 테스트 파일은 건드리지 마세요. 수정 결과는 auto-fix: 접두사로 별도 커밋 하세요."
else
  reason="2회 자동 수정 시도에도 실패했습니다. 정말 이대로 진행하려면 사유를 남기고 bash .claude/hooks/override-commit.sh 사유텍스트 를 실행한 뒤 다시 커밋하세요. push 시 PR에 흔적이 남습니다."
fi

"$py" -c '
import json, sys
print(json.dumps({
    "hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "permissionDecision": "deny",
        "permissionDecisionReason": sys.argv[1],
    }
}))
' "$reason"
exit 0
