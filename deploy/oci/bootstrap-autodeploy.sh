#!/usr/bin/env bash
set -Eeuo pipefail

umask 077

die() {
  printf 'bootstrap ERROR: %s\n' "$*" >&2
  exit 1
}

[[ ${EUID} -eq 0 ]] || die "root로 실행해야 합니다"
[[ $# -eq 2 ]] || die "usage: bootstrap-autodeploy.sh <source-dir> <public-key-file>"

readonly source_dir=$1
readonly public_key_file=$2
readonly deploy_user=wisor-deploy
readonly deploy_home=/var/lib/wisor-deploy-ssh
readonly authorized_keys=${deploy_home}/.ssh/authorized_keys

for required_file in \
  "${source_dir}/bin/wisor-deploy" \
  "${source_dir}/bin/wisor-deploy-dispatch" \
  "${source_dir}/bin/verify-live.py" \
  "${source_dir}/lib/deploy-state.sh" \
  "${public_key_file}"; do
  [[ -s ${required_file} ]] || die "필수 파일이 없습니다: ${required_file}"
done

public_key=$(tr -d '\r\n' <"${public_key_file}")
[[ ${public_key} =~ ^ssh-ed25519\ [A-Za-z0-9+/=]+(\ .*)?$ ]] \
  || die "전용 공개키는 ssh-ed25519 형식이어야 합니다"
ssh-keygen -l -f "${public_key_file}" >/dev/null || die "공개키를 읽을 수 없습니다"

if ! id "${deploy_user}" >/dev/null 2>&1; then
  useradd --create-home --home-dir "${deploy_home}" --shell /bin/bash "${deploy_user}"
fi

actual_home=$(getent passwd "${deploy_user}" | cut -d: -f6)
[[ ${actual_home} == "${deploy_home}" ]] \
  || die "${deploy_user}의 home이 예상과 다릅니다: ${actual_home}"

install -d -o root -g root -m 0755 /usr/local/sbin /usr/local/libexec

install -o root -g root -m 0755 "${source_dir}/lib/deploy-state.sh" \
  /usr/local/libexec/wisor-deploy-state.sh
install -o root -g root -m 0755 "${source_dir}/bin/verify-live.py" \
  /usr/local/libexec/wisor-verify-live.py
install -o root -g root -m 0755 "${source_dir}/bin/wisor-batch" \
  /usr/local/libexec/wisor-batch
install -o root -g root -m 0755 "${source_dir}/bin/validate-scores.py" \
  /usr/local/libexec/wisor-validate-scores.py
install -o root -g root -m 0755 "${source_dir}/bin/wisor-deploy-dispatch" \
  /usr/local/sbin/wisor-deploy-dispatch
# Install the entry point last so it never observes missing support files.
install -o root -g root -m 0755 "${source_dir}/bin/wisor-deploy" \
  /usr/local/sbin/wisor-deploy

install -d -o "${deploy_user}" -g "${deploy_user}" -m 0700 "${deploy_home}/.ssh"
authorized_keys_tmp=$(mktemp "${deploy_home}/.ssh/.authorized_keys.XXXXXXXX")
printf 'restrict,command="/usr/local/sbin/wisor-deploy-dispatch" %s\n' \
  "${public_key}" >"${authorized_keys_tmp}"
chown "${deploy_user}:${deploy_user}" "${authorized_keys_tmp}"
chmod 0600 "${authorized_keys_tmp}"
mv -f -- "${authorized_keys_tmp}" "${authorized_keys}"

sudoers_tmp=$(mktemp /etc/sudoers.d/.wisor-deploy.XXXXXXXX)
# sudoers의 빈 인자 문자열은 이 명령을 '인자 없음'으로 한정한다.
printf '%s ALL=(root) NOPASSWD: /usr/local/sbin/wisor-deploy ""\n' \
  "${deploy_user}" >"${sudoers_tmp}"
chmod 0440 "${sudoers_tmp}"
visudo -cf "${sudoers_tmp}" >/dev/null
mv -f -- "${sudoers_tmp}" /etc/sudoers.d/wisor-deploy

passwd --lock "${deploy_user}" >/dev/null 2>&1 || true
printf '전용 자동 배포 계정을 준비했습니다: %s\n' "${deploy_user}"
