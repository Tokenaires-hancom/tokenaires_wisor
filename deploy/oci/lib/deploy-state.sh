#!/usr/bin/env bash

# These helpers are also called from an EXIT trap. Do not rely on the caller's
# errexit setting: every mutating command must report its own failure.

wisor_replace_key() {
  local file=$1
  local key=$2
  local value=$3
  local candidate

  if ! candidate=$(mktemp "$(dirname "${file}")/.${key}.XXXXXXXX"); then
    return 1
  fi
  if ! awk -F= -v key="${key}" -v value="${value}" '
      BEGIN { found = 0 }
      $1 == key { print key "=" value; found = 1; next }
      { print }
      END { if (!found) exit 42 }
    ' "${file}" >"${candidate}"; then
    rm -f -- "${candidate}"
    return 1
  fi
  if ! chown --reference="${file}" "${candidate}"; then
    rm -f -- "${candidate}"
    return 1
  fi
  if ! chmod --reference="${file}" "${candidate}"; then
    rm -f -- "${candidate}"
    return 1
  fi
  if ! mv -f -- "${candidate}" "${file}"; then
    rm -f -- "${candidate}"
    return 1
  fi
}

wisor_restore_file() {
  local source=$1
  local destination=$2
  local candidate

  if ! candidate=$(mktemp "$(dirname "${destination}")/.restore.XXXXXXXX"); then
    return 1
  fi
  if ! cp --preserve=mode,ownership,timestamps -- "${source}" "${candidate}"; then
    rm -f -- "${candidate}"
    return 1
  fi
  if ! mv -f -- "${candidate}" "${destination}"; then
    rm -f -- "${candidate}"
    return 1
  fi
}

wisor_point_current_at() {
  local wisor_root=$1
  local current_link=$2
  local release=$3
  local candidate=${wisor_root}/.current.$$.tmp

  if [[ -e ${candidate} || -L ${candidate} ]]; then
    if ! rm -f -- "${candidate}"; then
      return 1
    fi
  fi
  if ! ln -s -- "${release}" "${candidate}"; then
    return 1
  fi
  if ! mv -Tf -- "${candidate}" "${current_link}"; then
    rm -f -- "${candidate}"
    return 1
  fi
}

wisor_restore_tree() {
  local previous=$1
  local live=$2
  local failed=$3

  [[ -e ${previous} || -L ${previous} ]] || return 0
  if [[ -e ${live} || -L ${live} ]]; then
    [[ ! -e ${failed} && ! -L ${failed} ]] || return 1
    if ! mv -T -- "${live}" "${failed}"; then
      return 1
    fi
  fi
  if ! mv -T -- "${previous}" "${live}"; then
    return 1
  fi
}

wisor_restore_release_state() {
  local state_dir=$1
  local wisor_root=$2
  local current_link=$3
  local release_env=$4
  local batch_conf=$5
  local deploy_dir=$6
  local batch_source=$7
  local deploy_script=$8
  local dispatch_script=$9
  local live_check=${10}
  local state_lib=${11}
  local previous_release
  local failed=0

  if ! wisor_restore_file "${state_dir}/wisor-deploy.previous" "${deploy_script}"; then
    failed=1
  fi
  if ! wisor_restore_file \
    "${state_dir}/wisor-deploy-dispatch.previous" "${dispatch_script}"; then
    failed=1
  fi
  if ! wisor_restore_file "${state_dir}/wisor-verify-live.py.previous" "${live_check}"; then
    failed=1
  fi
  if ! wisor_restore_file "${state_dir}/deploy-state.sh.previous" "${state_lib}"; then
    failed=1
  fi
  if ! wisor_restore_file "${state_dir}/release.env.previous" "${release_env}"; then
    failed=1
  fi
  if ! wisor_restore_file "${state_dir}/batch.conf.previous" "${batch_conf}"; then
    failed=1
  fi
  if ! IFS= read -r previous_release <"${state_dir}/current.previous"; then
    failed=1
  elif ! wisor_point_current_at "${wisor_root}" "${current_link}" "${previous_release}"; then
    failed=1
  fi
  if ! wisor_restore_tree \
    "${state_dir}/batch-source.previous" "${batch_source}" \
    "${state_dir}/batch-source.failed"; then
    failed=1
  fi
  if ! wisor_restore_tree \
    "${state_dir}/deploy.previous" "${deploy_dir}" "${state_dir}/deploy.failed"; then
    failed=1
  fi

  (( failed == 0 ))
}

wisor_is_data_only_path() {
  case $1 in
    apps/web/lib/generated/scores.json|data-pipeline/data/fundamentals.json)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}
