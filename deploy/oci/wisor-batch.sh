#!/usr/bin/env bash
set -Eeuo pipefail

requested_mode="${1:-}"
if [[ "$requested_mode" != "auto" && "$requested_mode" != "prices" && "$requested_mode" != "full" ]]; then
  echo "사용법: wisor-batch.sh auto|prices|full" >&2
  exit 2
fi

: "${WISOR_REPO_DIR:?WISOR_REPO_DIR를 설정하세요}"
: "${WISOR_PYTHON:?WISOR_PYTHON을 설정하세요}"
for required_name in TOSS_INVEST_CLIENT_ID TOSS_INVEST_CLIENT_SECRET WISOR_SEC_USER_AGENT; do
  if [[ -z "${!required_name:-}" ]]; then
    echo "필수 환경변수가 비어 있습니다: $required_name" >&2
    exit 2
  fi
done

runtime_dir="${WISOR_RUNTIME_DIR:-/var/lib/wisor/runtime}"
state_dir="${WISOR_BATCH_STATE_DIR:-/var/lib/wisor/batch}"
minimum_companies="${WISOR_MINIMUM_COMPANIES:-300}"
maximum_company_drop="${WISOR_MAXIMUM_COMPANY_DROP:-8}"
minimum_price_refresh_ratio="${WISOR_MINIMUM_PRICE_REFRESH_RATIO:-0.95}"
web_url="${WISOR_WEB_VERSION_URL:-http://127.0.0.1/api/data-version}"
persona_url="${WISOR_PERSONA_META_URL:-http://127.0.0.1/api/persona/meta}"
pipeline_dir="$WISOR_REPO_DIR/data-pipeline"
live="$runtime_dir/scores.json"
previous="$runtime_dir/scores.previous.json"
last_full_marker="$state_dir/last-full-date"
fundamentals_live="$state_dir/fundamentals.json"
fundamentals_previous="$state_dir/fundamentals.previous.json"
checkpoint="$state_dir/sec-toss.jsonl"

umask 027
mkdir -p "$runtime_dir" "$state_dir"
chmod 0755 "$runtime_dir"
chmod 0750 "$state_dir"
exec 9>"$state_dir/batch.lock"
if ! flock -n 9; then
  echo "다른 Wisor 배치가 실행 중입니다." >&2
  exit 75
fi

if [[ ! "$minimum_companies" =~ ^[0-9]+$ || ! "$maximum_company_drop" =~ ^[0-9]+$ ]]; then
  echo "종목 수 안전선은 0 이상의 정수여야 합니다." >&2
  exit 2
fi

if [[ ! -f "$live" ]]; then
  echo "$live 정상본이 없습니다. 먼저 추적된 scores.json을 설치하세요." >&2
  exit 1
fi

kst_date="$(TZ=Asia/Seoul date +%F)"
kst_hour="$(TZ=Asia/Seoul date +%H)"
mode="$requested_mode"
if [[ "$mode" == "auto" ]]; then
  last_full_date=""
  [[ ! -f "$last_full_marker" ]] || read -r last_full_date < "$last_full_marker"
  if (( 10#$kst_hour >= 16 )) && [[ "$last_full_date" != "$kst_date" ]]; then
    mode="full"
  else
    mode="prices"
  fi
fi

cd "$pipeline_dir"
current_expected="$("$WISOR_PYTHON" -m wisor_data.scores_contract \
  "$live" \
  --expected-source sec-toss \
  --minimum-companies "$minimum_companies")"
current_count="$("$WISOR_PYTHON" -m wisor_data.scores_contract \
  "$live" \
  --expected-source sec-toss \
  --minimum-companies "$minimum_companies" \
  --print-company-count)"
publish_minimum=$((current_count - maximum_company_drop))
if (( publish_minimum < minimum_companies )); then
  publish_minimum="$minimum_companies"
fi

candidate=""
previous_candidate=""
rollback_candidate=""
marker_candidate=""
fundamentals_candidate=""
fundamentals_previous_candidate=""
fundamentals_arg="$fundamentals_live"
checkpoint_args=()
live_replaced=0
publish_verified=0
cleanup() {
  status=$?
  set +e
  if (( status != 0 && live_replaced == 1 && publish_verified == 0 )) && [[ -f "$previous" ]]; then
    emergency_candidate=""
    if emergency_candidate="$(mktemp "$runtime_dir/.scores.emergency-rollback.XXXXXX")" &&
      cp --preserve=mode,timestamps -- "$previous" "$emergency_candidate" &&
      mv -f -- "$emergency_candidate" "$live"; then
      echo "비정상 종료로 검증 전 scores.json을 이전 정상본으로 복원했습니다." >&2
    else
      [[ -z "$emergency_candidate" ]] || rm -f -- "$emergency_candidate"
      echo "비정상 종료 뒤 scores.json 자동 복원에도 실패했습니다." >&2
    fi
  fi
  [[ -z "$candidate" ]] || rm -f -- "$candidate"
  [[ -z "$previous_candidate" ]] || rm -f -- "$previous_candidate"
  [[ -z "$rollback_candidate" ]] || rm -f -- "$rollback_candidate"
  [[ -z "$marker_candidate" ]] || rm -f -- "$marker_candidate"
  [[ -z "$fundamentals_candidate" ]] || rm -f -- "$fundamentals_candidate"
  [[ -z "$fundamentals_previous_candidate" ]] || rm -f -- "$fundamentals_previous_candidate"
  trap - EXIT
  exit "$status"
}
trap cleanup EXIT
trap 'exit 143' TERM
trap 'exit 130' INT
trap 'exit 129' HUP

candidate="$(mktemp "$runtime_dir/.scores.${mode}.XXXXXX")"
if [[ "$mode" == "full" ]]; then
  fundamentals_candidate="$(mktemp "$state_dir/.fundamentals.full.XXXXXX")"
  fundamentals_arg="$fundamentals_candidate"
  checkpoint_args+=(--keep-checkpoint)
fi

"$WISOR_PYTHON" run_batch.py \
  --provider sec-toss \
  --mode "$mode" \
  --universe data/universe_us.json \
  --fundamentals-cache "$fundamentals_arg" \
  --checkpoint "$checkpoint" \
  "${checkpoint_args[@]}" \
  --out "$candidate"

contract_args=(
  "$candidate"
  --expected-source sec-toss
  --minimum-companies "$publish_minimum"
)
if [[ "$mode" == "prices" ]]; then
  contract_args+=(--minimum-price-refresh-ratio "$minimum_price_refresh_ratio")
fi
expected="$("$WISOR_PYTHON" -m wisor_data.scores_contract "${contract_args[@]}")"
expected_count="$("$WISOR_PYTHON" -m wisor_data.scores_contract \
  "${contract_args[@]}" \
  --print-company-count)"
chmod 0644 "$candidate"

if [[ -f "$live" ]]; then
  previous_candidate="$(mktemp "$runtime_dir/.scores.previous.XXXXXX")"
  cp --preserve=mode,timestamps -- "$live" "$previous_candidate"
  mv -f -- "$previous_candidate" "$previous"
  previous_candidate=""
fi
live_replaced=1
mv -f -- "$candidate" "$live"
candidate=""

if ! "$WISOR_PYTHON" "$WISOR_REPO_DIR/deploy/oci/verify_runtime.py" \
  --expected "$expected" \
  --expected-source sec-toss \
  --expected-companies "$expected_count" \
  --web-url "$web_url" \
  --persona-url "$persona_url"; then
  if [[ -f "$previous" ]]; then
    rollback_candidate="$(mktemp "$runtime_dir/.scores.rollback.XXXXXX")"
    cp --preserve=mode,timestamps -- "$previous" "$rollback_candidate"
    mv -f -- "$rollback_candidate" "$live"
    rollback_candidate=""
    live_replaced=0
    echo "버전 확인이 실패해 이전 scores.json으로 되돌렸습니다." >&2
    if ! "$WISOR_PYTHON" "$WISOR_REPO_DIR/deploy/oci/verify_runtime.py" \
      --expected "$current_expected" \
      --expected-source sec-toss \
      --expected-companies "$current_count" \
      --web-url "$web_url" \
      --persona-url "$persona_url" \
      --timeout 10; then
      echo "파일은 복원했지만 두 서비스의 롤백 반영은 확인하지 못했습니다." >&2
    fi
  fi
  exit 1
fi

if [[ "$mode" == "full" ]]; then
  if [[ -f "$fundamentals_live" ]]; then
    fundamentals_previous_candidate="$(mktemp "$state_dir/.fundamentals.previous.XXXXXX")"
    cp --preserve=mode,timestamps -- "$fundamentals_live" "$fundamentals_previous_candidate"
    mv -f -- "$fundamentals_previous_candidate" "$fundamentals_previous"
    fundamentals_previous_candidate=""
  fi
  chmod 0640 "$fundamentals_candidate"
  mv -f -- "$fundamentals_candidate" "$fundamentals_live"
  fundamentals_candidate=""
fi
publish_verified=1

if [[ "$mode" == "full" ]]; then
  marker_candidate="$(mktemp "$state_dir/.last-full-date.XXXXXX")"
  printf '%s\n' "$kst_date" > "$marker_candidate"
  chmod 0640 "$marker_candidate"
  mv -f -- "$marker_candidate" "$last_full_marker"
  marker_candidate=""
  rm -f -- "$checkpoint"
fi

echo "scores.json 게시 완료: $expected"
