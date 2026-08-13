#!/usr/bin/env bash
# 점수 모델을 고치면 곧바로 해당 테스트를 돌린다.
#
# "나중에 확인하겠다"가 통하지 않는 자리다. 점수 문구가 깨지면 배치가 죽는다.
# 실패해도 작업을 막지는 않는다(exit 0). 알려주기만 한다.

set -uo pipefail

payload=$(cat)
path=$(printf '%s' "$payload" | python3 -c "import json,sys; print(json.load(sys.stdin).get('tool_input',{}).get('file_path',''))" 2>/dev/null)

[ -z "$path" ] && exit 0

root="${CLAUDE_PROJECT_DIR:-$(pwd)}"

case "$path" in
  *data-pipeline/wisor_data/*)
    echo "[verify] 점수 모델을 고쳤습니다. data-pipeline 테스트를 돌립니다."
    (cd "$root/data-pipeline" && python3 -m pytest -q 2>&1 | tail -5)
    echo "[verify] 판정이 달라졌다면 run_batch.py를 다시 돌리고 scores.json을 함께 커밋하세요."
    ;;
  *apps/web/lib/generated/scores.json)
    echo "[verify] scores.json은 손으로 고치지 않습니다. data-pipeline/run_batch.py를 돌리세요."
    ;;
esac

exit 0
