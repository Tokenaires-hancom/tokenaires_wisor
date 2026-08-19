#!/usr/bin/env bash
# git push 직전에, 이번에 나갈 커밋들에 대해 /code-review + /simplify를
# 돌렸는지 확인한다(루트 CLAUDE.md "push 전 — 클린 코드 검수" 참고).
#
# ①(커밋 하드블록)과 다르게 이건 내용을 판정하지 않는다 — 판단이 필요한
# 영역(파급범위·패턴·의미상 중복·도메인 규칙)이라 결과로 막지 않기로
# 했다. 여기서 보장하는 건 "실행됐는가"뿐이다. 실행했는지는 결국 Claude
# 자기 보고에 의존한다 — mark-push-reviewed.sh를 건너뛰고 바로 부르면
# 훅이 있으나 마나 해진다. 이건 알려진 한계다(2026-08-18 설계의
# "받아들인 리스크" 참고) — 그래도 아무 훅도 없는 것보다는, 최소한
# "실행을 잊어버리는" 실수는 막아준다.
#
# 무엇을 push할지: upstream이 있으면 @{upstream}..HEAD, 없으면(첫 push)
# origin/develop..HEAD로 본다.

set -uo pipefail

payload=$(cat)

if python3 -c "print(1)" >/dev/null 2>&1; then
  py=python3
else
  py=python
fi

command=$(printf '%s' "$payload" | "$py" -c "import json,sys; print(json.load(sys.stdin).get('tool_input',{}).get('command',''))" 2>/dev/null)

# git push가 아니면 관여하지 않는다.
printf '%s' "$command" | grep -Eq '(^|&&|;|\|)[[:space:]]*git[[:space:]]+push([[:space:]]|$)' || exit 0

root="${CLAUDE_PROJECT_DIR:-$(pwd)}"
state_file="$root/.git/claude-push-review-state"

cd "$root" || exit 0

upstream=$(git rev-parse --abbrev-ref --symbolic-full-name '@{upstream}' 2>/dev/null || true)
if [ -n "$upstream" ]; then
  base="$upstream"
else
  git fetch origin develop --quiet 2>/dev/null || true
  base="origin/develop"
fi

push_diff=$(git diff "${base}..HEAD" 2>/dev/null || true)

# 나갈 게 없으면(이미 원격과 같음) 관여하지 않는다.
if [ -z "$push_diff" ]; then
  exit 0
fi

current_hash=$(printf '%s' "$push_diff" | sha256sum | cut -d' ' -f1)
reviewed_hash=$(cat "$state_file" 2>/dev/null || true)

if [ "$current_hash" = "$reviewed_hash" ]; then
  exit 0
fi

"$py" -c '
import json, sys
print(json.dumps({
    "hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "permissionDecision": "deny",
        "permissionDecisionReason": "push 전 클린 코드 검수가 아직 안 됐습니다. 이번에 나갈 커밋 전체 diff에 /code-review -> /simplify를 순서대로 돌리세요(루트 CLAUDE.md \"클린 코드 원칙\" 기준). 발견 사항이 있으면 고칠지 사람에게 물어보고 반영하세요. 다 끝나면 bash .claude/hooks/mark-push-reviewed.sh 를 실행해 완료를 기록한 뒤 git push를 다시 시도하세요.",
    }
}))
'
exit 0
