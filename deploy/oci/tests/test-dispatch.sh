#!/usr/bin/env bash
set -Eeuo pipefail

readonly repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)
readonly dispatcher=${repo_root}/deploy/oci/bin/wisor-deploy-dispatch
readonly deployer=${repo_root}/deploy/oci/bin/wisor-deploy
readonly bootstrap=${repo_root}/deploy/oci/bootstrap-autodeploy.sh
readonly state_lib=${repo_root}/deploy/oci/lib/deploy-state.sh
readonly temp_dir=$(mktemp -d)
readonly capture_args=${temp_dir}/args
readonly capture_stdin=${temp_dir}/stdin

cleanup() {
  case "${temp_dir}" in
    /tmp/*|/var/tmp/*) rm -rf --one-file-system -- "${temp_dir}" ;;
    *) printf 'unexpected test temp path: %s\n' "${temp_dir}" >&2; return 1 ;;
  esac
}
trap cleanup EXIT

for script in "${dispatcher}" "${deployer}" "${bootstrap}" "${state_lib}"; do
  bash -n "${script}"
done
grep -Fq '/usr/local/libexec/wisor-deploy-state.sh' "${bootstrap}"
grep -Fq '"${STATE_LIB}"' "${deployer}"

cat >"${temp_dir}/sudo" <<'FAKE_SUDO'
#!/usr/bin/env bash
set -Eeuo pipefail
printf '%s\n' "$@" >"${CAPTURE_ARGS}"
cat >"${CAPTURE_STDIN}"
FAKE_SUDO
chmod 0700 "${temp_dir}/sudo"
export PATH=${temp_dir}:${PATH}
export CAPTURE_ARGS=${capture_args}
export CAPTURE_STDIN=${capture_stdin}

reject() {
  local original_command=$1
  local status

  rm -f -- "${capture_args}" "${capture_stdin}"
  if SSH_ORIGINAL_COMMAND="${original_command}" bash "${dispatcher}" >/dev/null 2>&1; then
    printf 'dispatcher accepted invalid command: %q\n' "${original_command}" >&2
    return 1
  else
    status=$?
  fi
  [[ ${status} -eq 64 ]]
  [[ ! -e ${capture_args} && ! -e ${capture_stdin} ]]
}

readonly sha=0123456789abcdef0123456789abcdef01234567
reject ''
reject 'deploy abc'
reject "deploy ${sha} extra"
reject "deploy ${sha}; id"
reject $'deploy 0123456789abcdef0123456789abcdef01234567\nid'
reject 'deploy 0123456789ABCDEF0123456789ABCDEF01234567'

SSH_ORIGINAL_COMMAND="deploy ${sha}" bash "${dispatcher}"
mapfile -t sudo_args <"${capture_args}"
[[ ${#sudo_args[@]} -eq 2 ]]
[[ ${sudo_args[0]} == --non-interactive ]]
[[ ${sudo_args[1]} == /usr/local/sbin/wisor-deploy ]]
[[ $(<"${capture_stdin}") == "${sha}" ]]

python - "${repo_root}/deploy/oci/bin/verify-live.py" "${repo_root}/deploy/oci/bin/validate-scores.py" <<'PY'
import ast
import pathlib
import sys

for arg in sys.argv[1:]:
    path = pathlib.Path(arg)
    ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
PY

# 배치 wrapper와 validator도 배포·bootstrap이 설치한다. 설치 경로가 없으면 서버 파일이
# 손으로만 갱신돼 조용히 낡는다 - 2026-08-26에 정확히 그렇게 낡아서 배치가 닷새 멈췄다.
readonly batch_wrapper=${repo_root}/deploy/oci/bin/wisor-batch
bash -n "${batch_wrapper}"
grep -Fq '/usr/local/libexec/wisor-batch' "${bootstrap}"
grep -Fq '/usr/local/libexec/wisor-validate-scores.py' "${bootstrap}"
grep -Fq '"${batch_script}"' "${deployer}"
grep -Fq '"${validate_script}"' "${deployer}"

# 구문 검사가 설치보다 먼저 나와야 한다. 순서가 뒤집히면 깨진 wrapper가 서버에 깔리고
# 다음 timer가 돌 때까지 아무도 모른다.
validated_line=$(grep -n 'bash -n "${batch_script}"' "${deployer}" | cut -d: -f1)
installed_line=$(grep -n '/usr/local/libexec/.wisor-batch.next' "${deployer}" | head -1 | cut -d: -f1)
[[ -n ${validated_line} && -n ${installed_line} ]]
(( validated_line < installed_line ))

printf 'OCI_DEPLOY_CONTRACT_OK\n'
