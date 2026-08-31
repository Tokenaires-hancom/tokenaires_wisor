#!/usr/bin/env bash
# web 런타임 이미지가 화면이 읽을 scores.json을 들고 있는지 본다.
#
# 이 검사가 없어서 2026-08-31 배포가 통째로 롤백됐다. lib/scores.ts가 파일을
# 런타임에 읽도록 바뀌었는데 Dockerfile.web의 runtime 스테이지 COPY 목록은
# 빌드 때 번들로 들어가던 시절 그대로였다. 빌드도 테스트도 통과하고,
# 컨테이너가 healthy가 되지 못하는 자리에서만 드러난다.
set -Eeuo pipefail

readonly repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)
readonly dockerfile=${repo_root}/deploy/oci/app/Dockerfile.web
readonly loader=${repo_root}/apps/web/lib/scores.ts

# lib/scores.ts가 SCORES_JSON_PATH 없이 찾아보는 자리. 여기가 바뀌면 이 검사도
# 같이 바뀌어야 하므로, 경로를 이 파일에 적지 않고 로더에서 확인한다.
grep -Fq '"lib", "generated", "scores.json"' "${loader}"

runtime_stage=$(awk '/^FROM .* AS runtime/ { in_runtime = 1 } in_runtime' "${dockerfile}")
if ! grep -Fq 'lib/generated/scores.json' <<<"${runtime_stage}"; then
  echo "Dockerfile.web의 runtime 스테이지가 lib/generated/scores.json을 복사하지 않습니다." >&2
  echo "화면은 이 파일을 런타임에 읽습니다. 없으면 모든 페이지가 500이 됩니다." >&2
  exit 1
fi

echo "OCI_WEB_RUNTIME_DATA_OK"
