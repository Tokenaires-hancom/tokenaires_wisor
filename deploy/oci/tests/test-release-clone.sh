#!/usr/bin/env bash
set -Eeuo pipefail

readonly repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)
readonly deployer=${repo_root}/deploy/oci/bin/wisor-deploy
# 배포기는 브랜치를 /etc/wisor/deploy.conf에서 읽는다. main이 아닌 이름으로
# 고정해 두면 refspec이 다시 박히는 순간 이 테스트가 깨진다.
readonly deploy_branch=develop
readonly temp_dir=$(mktemp -d)
readonly source_repo=${temp_dir}/source
readonly release_repo=${temp_dir}/release

cleanup() {
  case ${temp_dir} in
    /tmp/*|/var/tmp/*) rm -rf --one-file-system -- "${temp_dir}" ;;
    *) printf 'unexpected test temp path: %s\n' "${temp_dir}" >&2; return 1 ;;
  esac
}
trap cleanup EXIT

git init --quiet --initial-branch=stable "${source_repo}"
git -C "${source_repo}" config user.name test
git -C "${source_repo}" config user.email test@example.com
printf 'old\n' >"${source_repo}/value"
git -C "${source_repo}" add value
git -C "${source_repo}" commit --quiet -m old
old_sha=$(git -C "${source_repo}" rev-parse HEAD)

printf 'new\n' >"${source_repo}/value"
git -C "${source_repo}" commit --quiet -am new
target_sha=$(git -C "${source_repo}" rev-parse HEAD)
git -C "${source_repo}" update-ref "refs/remotes/origin/${deploy_branch}" "${target_sha}"
git -C "${source_repo}" reset --quiet --hard "${old_sha}"

git clone --quiet --no-hardlinks --no-checkout "${source_repo}" "${release_repo}"
if git -C "${release_repo}" show-ref --verify \
  "refs/remotes/origin/${deploy_branch}" >/dev/null 2>&1; then
  printf 'fixture clone unexpectedly copied the remote-tracking ref\n' >&2
  exit 1
fi

grep -Fq \
  '"+refs/remotes/origin/${deploy_branch}:refs/remotes/origin/${deploy_branch}"' \
  "${deployer}"
git -C "${release_repo}" fetch --quiet --no-tags "${source_repo}" \
  "+refs/remotes/origin/${deploy_branch}:refs/remotes/origin/${deploy_branch}"
release_branch_sha=$(git -C "${release_repo}" rev-parse "refs/remotes/origin/${deploy_branch}")
[[ ${release_branch_sha} == "${target_sha}" ]]
git -C "${release_repo}" checkout --quiet --detach "${target_sha}"
[[ $(<"${release_repo}/value") == new ]]

printf 'OCI_RELEASE_CLONE_OK\n'
