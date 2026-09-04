#!/usr/bin/env bash
# 배포기가 브랜치와 공개 주소를 /etc/wisor/deploy.conf에서만 읽는지 확인한다.
# 운영과 개발이 같은 배포기를 쓰므로, 여기에 값이 다시 박히면 한쪽이 다른 쪽 주소를
# 검증하게 된다.
set -Eeuo pipefail

readonly repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)
readonly deployer=${repo_root}/deploy/oci/bin/wisor-deploy
readonly temp_dir=$(mktemp -d)

cleanup() {
  case ${temp_dir} in
    /tmp/*|/var/tmp/*) rm -rf --one-file-system -- "${temp_dir}" ;;
    *) printf 'unexpected test temp path: %s\n' "${temp_dir}" >&2; return 1 ;;
  esac
}
trap cleanup EXIT

bash -n "${deployer}"

# 설정 파일이 없으면 필수 파일 검사가 배포를 멈춘다.
grep -Fq '  "${DEPLOY_CONF}" \' "${deployer}"
grep -Fq 'readonly DEPLOY_CONF=/etc/wisor/deploy.conf' "${deployer}"

# 값이 비면 죽는다.
grep -Fq 'die "deploy.conf의 WISOR_DEPLOY_BRANCH가 없습니다"' "${deployer}"
grep -Fq 'die "deploy.conf의 WISOR_PUBLIC_ORIGIN이 없습니다' "${deployer}"

# 브랜치와 주소가 설정에서만 온다.
if grep -Fq 'wisor.site' "${deployer}"; then
  printf 'deployer still hardcodes a public origin\n' >&2
  exit 1
fi
if grep -Fq 'origin/main' "${deployer}"; then
  printf 'deployer still hardcodes a deploy branch\n' >&2
  exit 1
fi
grep -Fq '"+refs/heads/${deploy_branch}:refs/remotes/origin/${deploy_branch}"' "${deployer}"
grep -Fq '"${public_origin}/api/persona/health"' "${deployer}"

# 파싱 자체는 배포기에서 그대로 꺼내 돌린다. 정규식을 여기에 베껴 두면 배포기만
# 고쳐졌을 때 이 테스트가 눈치채지 못한다.
parse_statement() {
  # 배포기의 두 대입문은 줄 연결로 두 줄이다. 한 줄로 합치면 여기서 절반만 꺼내
  # 가므로, 합칠 때 이 -A1도 함께 고쳐야 한다.
  local name=$1
  grep -A1 -F "${name}=\$(sed" "${deployer}"
}

parse_value() {
  local name=$1 conf=$2
  local script=${temp_dir}/parse-${name}.sh
  {
    parse_statement "${name}"
    printf 'printf %%s "${%s}"\n' "${name}"
  } >"${script}"
  DEPLOY_CONF=${conf} bash "${script}"
}

expect() {
  local label=$1 actual=$2 wanted=$3
  if [[ ${actual} != "${wanted}" ]]; then
    printf '%s: got %q, want %q\n' "${label}" "${actual}" "${wanted}" >&2
    exit 1
  fi
}

readonly good=${temp_dir}/good.conf
printf 'WISOR_DEPLOY_BRANCH=develop\nWISOR_PUBLIC_ORIGIN=https://dev.wisor.site\n' >"${good}"
expect 'branch' "$(parse_value deploy_branch "${good}")" develop
expect 'origin' "$(parse_value public_origin "${good}")" https://dev.wisor.site

# 끝의 /는 받지 않는다. 붙으면 curl 대상이 //가 되고, web.env의 SITE_ORIGIN과도
# 어긋난다.
readonly trailing=${temp_dir}/trailing.conf
printf 'WISOR_DEPLOY_BRANCH=main\nWISOR_PUBLIC_ORIGIN=https://wisor.site/\n' >"${trailing}"
expect 'trailing slash' "$(parse_value public_origin "${trailing}")" ''

# 스킴이 없으면 받지 않는다.
readonly no_scheme=${temp_dir}/no-scheme.conf
printf 'WISOR_DEPLOY_BRANCH=main\nWISOR_PUBLIC_ORIGIN=wisor.site\n' >"${no_scheme}"
expect 'missing scheme' "$(parse_value public_origin "${no_scheme}")" ''

# 키가 아예 없으면 빈 값이 되고, 배포기는 그 자리에서 죽는다.
readonly empty=${temp_dir}/empty.conf
: >"${empty}"
expect 'empty branch' "$(parse_value deploy_branch "${empty}")" ''
expect 'empty origin' "$(parse_value public_origin "${empty}")" ''

printf 'OCI_DEPLOY_CONF_OK\n'
