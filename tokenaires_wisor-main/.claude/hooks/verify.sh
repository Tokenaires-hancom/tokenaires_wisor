#!/usr/bin/env bash
# 안전장치와 점수 모델을 고치면 곧바로 해당 테스트를 돌린다.
#
# 이 두 곳은 "나중에 확인하겠다"가 통하지 않는 자리다. 필터가 뚫린 채로
# 커밋되면 사용자에게 매매 표현이 그대로 나가고, 점수 문구가 깨지면 배치가 죽는다.
# 실패해도 작업을 막지는 않는다(exit 0). 알려주기만 한다.

set -uo pipefail

payload=$(cat)
path=$(printf '%s' "$payload" | python3 -c "import json,sys; print(json.load(sys.stdin).get('tool_input',{}).get('file_path',''))" 2>/dev/null)

[ -z "$path" ] && exit 0

root="${CLAUDE_PROJECT_DIR:-$(pwd)}"

case "$path" in
  *services/chart-api/app/services/safety.py|*services/chart-api/app/services/prompt.py|*services/chart-api/app/services/vision_analyzer.py)
    echo "[verify] 안전장치를 고쳤습니다. chart-api 테스트를 돌립니다."
    (cd "$root/services/chart-api" && python3 -m pytest -q 2>&1 | tail -5)
    ;;
  *data-pipeline/wisor_data/*)
    echo "[verify] 점수 모델을 고쳤습니다. data-pipeline 테스트를 돌립니다."
    (cd "$root/data-pipeline" && python3 -m pytest -q 2>&1 | tail -5)
    echo "[verify] 판정이 달라졌다면 run_batch.py를 다시 돌리고 scores.json을 함께 커밋하세요."
    ;;
  *apps/web/content/chartLessons.ts)
    echo "[verify] 차트 단원을 고쳤습니다. prompt.py의 LESSON_IDS와 id가 일치하는지 확인하세요."
    ;;
  *apps/web/lib/generated/scores.json)
    echo "[verify] scores.json은 손으로 고치지 않습니다. data-pipeline/run_batch.py를 돌리세요."
    ;;
esac

exit 0
