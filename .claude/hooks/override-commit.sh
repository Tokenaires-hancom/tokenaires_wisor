#!/usr/bin/env bash
# 하드블록을 사유를 남기고 강행할 때 쓴다. require-review-before-commit.sh가
# 2회 자동 수정에도 실패했을 때 이걸 실행하라고 안내한다.
#
# 이 스크립트는 지금 staged된 diff의 해시에 사유를 묶어 .git/claude-review-override에
# 남긴다. 이후 push할 때, 이 사실이 PR에 흔적으로 남는다 — 정상 통과·정상
# 자동수정은 기록하지 않고, 오버라이드만 예외적으로 기록해서 신호 대 잡음비를
# 지킨다(2026-08-18 설계 참고).

set -uo pipefail

reason="${*:-}"
if [ -z "$reason" ]; then
  echo "사유를 인자로 주세요: bash .claude/hooks/override-commit.sh 사유텍스트" >&2
  exit 1
fi

root="${CLAUDE_PROJECT_DIR:-$(pwd)}"
staged_diff=$(cd "$root" && git diff --cached)
if [ -z "$staged_diff" ]; then
  echo "staged된 변경이 없습니다." >&2
  exit 1
fi

current_hash=$(printf '%s' "$staged_diff" | sha256sum | cut -d' ' -f1)
printf '%s %s' "$current_hash" "$reason" > "$root/.git/claude-review-override"
echo "오버라이드를 기록했습니다: $reason"
echo "이제 git commit을 다시 시도하세요."
