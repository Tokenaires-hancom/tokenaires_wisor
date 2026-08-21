#!/usr/bin/env bash
# git push 직전에 클린 코드 5원칙 검수를 한 번 거치게 한다.
#
# 훅은 스킬을 직접 호출할 수 없다. push를 한 번 막으면서(deny) 그 이유에
# SKILL.md 경로를 적어주면, Claude가 그 파일을 읽고 수행한다.
#
# 스킬 "이름"(/clean-check)이 아니라 "파일 경로"를 주는 이유: 프로젝트 로컬
# 스킬이 clone만 한 팀원 세션에서 등록되는지 검증되지 않았다. 경로를 주면
# 그냥 읽어서 수행하므로 등록 여부와 무관하게 작동한다.
#
# 검수 결과는 아무것도 막지 않는다 — 지적을 보고 그대로 push해도 된다.
# 그래서 오버라이드 경로가 없다. 실제로 병합을 막는 건 PR에서 도는
# .github/workflows/check.yml 뿐이다(테스트·빌드·타입체크·유출 grep).
#
# 두 가지 모드로 쓴다.
#   (인자 없음)  PreToolUse 훅. stdin으로 tool_input을 받는다.
#   --mark       검수를 마쳤다고 기록. SKILL.md 마지막 단계가 호출한다.

set -uo pipefail

root="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
state_file="$root/.git/clean-check-state"

cd "$root" || exit 0

# 이번에 push될 diff. upstream이 있으면 그 기준, 없으면(첫 push) develop 기준.
push_diff() {
  local base
  base=$(git rev-parse --abbrev-ref --symbolic-full-name '@{upstream}' 2>/dev/null || true)
  if [ -z "$base" ]; then
    git fetch origin develop --quiet 2>/dev/null || true
    base="origin/develop"
  fi
  git diff "${base}..HEAD" 2>/dev/null || true
}

if [ "${1:-}" = "--mark" ]; then
  printf '%s' "$(push_diff)" | sha256sum | cut -d' ' -f1 > "$state_file"
  echo "클린 코드 검수 완료로 기록했습니다. 이제 git push가 통과합니다."
  exit 0
fi

payload=$(cat)

# settings.json의 if 조건을 뺐으므로(PowerShell까지 걸려면 뺄 수밖에 없다) 이 훅은
# 모든 셸 명령에 대해 돈다. 관계없는 명령에서 python을 띄우지 않도록 먼저 거른다.
printf '%s' "$payload" | grep -q "push\|pr create" || exit 0

if python3 -c "print(1)" >/dev/null 2>&1; then
  py=python3
else
  py=python
fi

command=$(printf '%s' "$payload" | "$py" -c "import json,sys; print(json.load(sys.stdin).get('tool_input',{}).get('command',''))" 2>/dev/null)

# push하는 명령이 아니면 관여하지 않는다. gh pr create를 같이 보는 이유는, 원격에
# 없는 브랜치로 PR을 열면 gh가 push까지 하기 때문이다. git push만 보면 그 경로가 샌다.
printf '%s' "$command" | grep -Eq '(^|&&|;|\|)[[:space:]]*(git[[:space:]]+push|gh[[:space:]]+pr[[:space:]]+create)([[:space:]]|$)' || exit 0

diff_text=$(push_diff)

# 나갈 게 없으면(이미 원격과 같음) 관여하지 않는다.
[ -z "$diff_text" ] && exit 0

current=$(printf '%s' "$diff_text" | sha256sum | cut -d' ' -f1)
reviewed=$(cat "$state_file" 2>/dev/null || true)

# 같은 내용을 이미 검수했으면 통과.
[ "$current" = "$reviewed" ] && exit 0

"$py" -c '
import json
print(json.dumps({
    "hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "permissionDecision": "deny",
        "permissionDecisionReason": "push 전 클린 코드 검수가 아직 안 됐습니다. .claude/skills/clean-check/SKILL.md 를 읽고 그대로 수행하세요. 5원칙 판정 결과를 사람에게 보여주고, 고칠지 이대로 갈지 물어본 뒤 다시 push하면 됩니다.",
    }
}))
'
exit 0
