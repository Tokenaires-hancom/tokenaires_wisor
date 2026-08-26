#!/usr/bin/env bash
set -Eeuo pipefail

readonly repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)
# shellcheck disable=SC1091
. "${repo_root}/deploy/oci/lib/deploy-state.sh"

readonly temp_dir=$(mktemp -d)

cleanup() {
  case ${temp_dir} in
    /tmp/*|/var/tmp/*) rm -rf --one-file-system -- "${temp_dir}" ;;
    *) printf 'unexpected test temp path: %s\n' "${temp_dir}" >&2; return 1 ;;
  esac
}
trap cleanup EXIT

fail() {
  printf 'test-state: %s\n' "$*" >&2
  return 1
}

assert_file() {
  local expected=$1
  local path=$2
  [[ $(<"${path}") == "${expected}" ]] \
    || fail "${path} is not ${expected}"
}

config=${temp_dir}/config.env
printf 'KEEP=yes\nTARGET=old\n' >"${config}"
wisor_replace_key "${config}" TARGET new
[[ $(sed -n 's/^TARGET=//p' "${config}") == new ]]
command cp -- "${config}" "${config}.before"
if wisor_replace_key "${config}" MISSING value; then
  fail 'wisor_replace_key accepted a missing key'
fi
cmp --silent "${config}.before" "${config}" \
  || fail 'missing-key replacement changed the destination'

restore_source=${temp_dir}/restore.source
restore_destination=${temp_dir}/restore.destination
printf 'old\n' >"${restore_source}"
printf 'new\n' >"${restore_destination}"
cp() { return 73; }
if wisor_restore_file "${restore_source}" "${restore_destination}"; then
  fail 'wisor_restore_file hid a cp failure'
fi
unset -f cp
assert_file new "${restore_destination}"
if compgen -G "${temp_dir}/.restore.*" >/dev/null; then
  fail 'wisor_restore_file left a temporary file'
fi

for accepted in \
  apps/web/lib/generated/scores.json \
  data-pipeline/data/fundamentals.json; do
  wisor_is_data_only_path "${accepted}" \
    || fail "data-only policy rejected ${accepted}"
done
for rejected in apps/web/page.tsx docs/note.md .github/workflows/check.yml; do
  if wisor_is_data_only_path "${rejected}"; then
    fail "data-only policy accepted ${rejected}"
  fi
done

# Git for Windows emulates directory symlinks as directory copies. The Linux
# runner and the OCI host execute all symlink/rename rollback cases below.
if [[ $(uname -s) == MINGW* ]]; then
  printf 'OCI_DEPLOY_STATE_OK (Linux symlink cases skipped)\n'
  exit 0
fi

link_root=${temp_dir}/link-root
mkdir -p "${link_root}/old" "${link_root}/new"
ln -s -- "${link_root}/old" "${link_root}/current"
mv() { return 74; }
if wisor_point_current_at \
  "${link_root}" "${link_root}/current" "${link_root}/new"; then
  fail 'wisor_point_current_at hid an mv failure'
fi
unset -f mv
[[ $(readlink "${link_root}/current") == "${link_root}/old" ]]
[[ ! -e ${link_root}/.current.$$.tmp && ! -L ${link_root}/.current.$$.tmp ]]

no_previous=${temp_dir}/no-previous
mkdir -p "${no_previous}/live"
printf 'live\n' >"${no_previous}/live/value"
wisor_restore_tree \
  "${no_previous}/previous" "${no_previous}/live" "${no_previous}/failed"
assert_file live "${no_previous}/live/value"

saved_only=${temp_dir}/saved-only
mkdir -p "${saved_only}/previous"
printf 'old\n' >"${saved_only}/previous/value"
wisor_restore_tree \
  "${saved_only}/previous" "${saved_only}/live" "${saved_only}/failed"
assert_file old "${saved_only}/live/value"

tree_move_failure=${temp_dir}/tree-move-failure
mkdir -p "${tree_move_failure}/previous" "${tree_move_failure}/live"
printf 'old\n' >"${tree_move_failure}/previous/value"
printf 'new\n' >"${tree_move_failure}/live/value"
mv() { return 76; }
if wisor_restore_tree \
  "${tree_move_failure}/previous" "${tree_move_failure}/live" \
  "${tree_move_failure}/failed"; then
  fail 'wisor_restore_tree hid an mv failure'
fi
unset -f mv
assert_file old "${tree_move_failure}/previous/value"
assert_file new "${tree_move_failure}/live/value"
[[ ! -e ${tree_move_failure}/failed ]]

prepare_rollback_fixture() {
  fixture=$1
  fixture_root=${fixture}/opt/wisor
  fixture_state=${fixture_root}/deploy-state/run
  fixture_current=${fixture_root}/current
  fixture_release_env=${fixture}/etc/release.env
  fixture_batch_conf=${fixture}/etc/batch.conf
  fixture_deploy=${fixture_root}/deploy
  fixture_batch=${fixture_root}/batch-source
  fixture_bin=${fixture}/usr/local/sbin
  fixture_libexec=${fixture}/usr/local/libexec
  fixture_deployer=${fixture_bin}/wisor-deploy
  fixture_dispatch=${fixture_bin}/wisor-deploy-dispatch
  fixture_verifier=${fixture_libexec}/wisor-verify-live.py
  fixture_state_lib=${fixture_libexec}/wisor-deploy-state.sh

  mkdir -p \
    "${fixture_state}/deploy.previous" \
    "${fixture_state}/batch-source.previous" \
    "${fixture_root}/releases/old" \
    "${fixture_root}/releases/new" \
    "${fixture_deploy}" "${fixture_batch}" \
    "$(dirname "${fixture_release_env}")" "${fixture_bin}" "${fixture_libexec}"
  printf 'old-deploy\n' >"${fixture_state}/deploy.previous/value"
  printf 'old-batch\n' >"${fixture_state}/batch-source.previous/value"
  printf 'new-deploy\n' >"${fixture_deploy}/value"
  printf 'new-batch\n' >"${fixture_batch}/value"
  ln -s -- "${fixture_root}/releases/new" "${fixture_current}"
  printf '%s\n' "${fixture_root}/releases/old" >"${fixture_state}/current.previous"

  for name in \
    release.env batch.conf wisor-deploy wisor-deploy-dispatch \
    wisor-verify-live.py deploy-state.sh; do
    printf 'old-%s\n' "${name}" >"${fixture_state}/${name}.previous"
  done
  printf 'new-release\n' >"${fixture_release_env}"
  printf 'new-batch-conf\n' >"${fixture_batch_conf}"
  printf 'new-deployer\n' >"${fixture_deployer}"
  printf 'new-dispatch\n' >"${fixture_dispatch}"
  printf 'new-verifier\n' >"${fixture_verifier}"
  printf 'new-state-lib\n' >"${fixture_state_lib}"
}

restore_fixture() {
  wisor_restore_release_state \
    "${fixture_state}" "${fixture_root}" "${fixture_current}" \
    "${fixture_release_env}" "${fixture_batch_conf}" \
    "${fixture_deploy}" "${fixture_batch}" \
    "${fixture_deployer}" "${fixture_dispatch}" \
    "${fixture_verifier}" "${fixture_state_lib}"
}

assert_fixture_restored() {
  assert_file old-deploy "${fixture_deploy}/value"
  assert_file old-batch "${fixture_batch}/value"
  [[ $(readlink "${fixture_current}") == "${fixture_root}/releases/old" ]]
  assert_file old-release.env "${fixture_release_env}"
  assert_file old-batch.conf "${fixture_batch_conf}"
  assert_file old-wisor-deploy "${fixture_deployer}"
  assert_file old-wisor-deploy-dispatch "${fixture_dispatch}"
  assert_file old-wisor-verify-live.py "${fixture_verifier}"
  assert_file old-deploy-state.sh "${fixture_state_lib}"
  assert_file new-deploy "${fixture_state}/deploy.failed/value"
  assert_file new-batch "${fixture_state}/batch-source.failed/value"
}

prepare_rollback_fixture "${temp_dir}/rollback-success"
restore_fixture
assert_fixture_restored

prepare_rollback_fixture "${temp_dir}/rollback-copy-failure"
cp() { return 75; }
if restore_fixture; then
  fail 'wisor_restore_release_state hid a snapshot copy failure'
fi
unset -f cp
# File restoration failed, but the independent directory recovery still ran.
assert_file old-deploy "${fixture_deploy}/value"
assert_file old-batch "${fixture_batch}/value"
[[ $(readlink "${fixture_current}") == "${fixture_root}/releases/old" ]]

printf 'OCI_DEPLOY_STATE_OK\n'
