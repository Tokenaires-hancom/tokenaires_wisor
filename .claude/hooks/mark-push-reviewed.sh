#!/usr/bin/env bash
# require-review-before-push.sh가 다시 안 막도록, 방금 검수를 끝낸 push
# 대상 diff의 해시를 기록한다.
#
# /code-review, /simplify를 실제로 돌리고 발견 사항을 처리한 뒤에만
# 실행한다. 그냥 이 스크립트만 실행하고 검수를 건너뛰면 훅이 있으나
# 마나 해진다.

set -uo pipefail

root="${CLAUDE_PROJECT_DIR:-$(pwd)}"
state_file="$root/.git/claude-push-review-state"

cd "$root" || exit 1

upstream=$(git rev-parse --abbrev-ref --symbolic-full-name '@{upstream}' 2>/dev/null || true)
if [ -n "$upstream" ]; then
  base="$upstream"
else
  git fetch origin develop --quiet 2>/dev/null || true
  base="origin/develop"
fi

push_diff=$(git diff "${base}..HEAD" 2>/dev/null || true)

if [ -z "$push_diff" ]; then
  echo "[mark-push-reviewed] push할 커밋이 없습니다. 기록할 게 없습니다."
  exit 0
fi

printf '%s' "$push_diff" | sha256sum | cut -d' ' -f1 > "$state_file"
echo "[mark-push-reviewed] 검수 완료로 기록했습니다."
