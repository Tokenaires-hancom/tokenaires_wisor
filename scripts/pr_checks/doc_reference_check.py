"""문서(.md) 안의 파일 경로 참조가 실제로 존재하는지 확인 — 감사용.

백틱으로 감싼 토큰 중 파일 경로처럼 보이는 것만 골라 저장소 기준으로 존재
여부를 확인한다. 이름이 바뀌었거나 지워진 파일을 문서가 계속 가리키고
있으면 잡아낸다 — 예: 이번에 `claude-rules-review.yml`을 지웠는데 다른
문서가 그 파일 경로를 여전히 인용하고 있는 경우.

게이트가 아니다. 백틱 안에는 파일 경로 말고도 라우트(`/learn`), 프로퍼티
접근(`chapter.lede`), import 별칭(`@/lib/scores`), 커밋 메시지 예시 등이
섞여 있어서, 이런 것까지 걸러내려고 휴리스틱을 최대한 엄격하게 잡았다 —
그래도 오탐이 남을 수 있어 사람이 결과를 보고 판단해야 한다. `--audit`인
duplicate_check.py와 같은 성격 — 훅에 안 걸려 있고 병합을 막지 않는다.

python scripts/pr_checks/doc_reference_check.py 로 수동 실행한다.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

BACKTICK = re.compile(r"`([^`\n]+)`")
SKIP_DIRS = {"node_modules", ".next", ".next-dev", "__pycache__", ".git", ".cache"}

# 파일 경로가 아니라고 확신할 수 있는 접두사 — git 레퍼런스, URL, 변수,
# 플래그, 슬래시 커맨드(/code-review), 라우트(/learn) 전부 여기서 뺀다.
NON_PATH_PREFIXES = ("origin/", "http://", "https://", "$", "-", "/")

# 이 저장소에서 실제로 쓰는 확장자만 인정한다 — 슬래시 없는 토큰(예:
# CLAUDE.md)에 적용. 이게 없으면 `1.25rem`, `chapter.lede` 같은 CSS
# 값·프로퍼티 접근까지 파일처럼 오탐한다.
REAL_EXTENSIONS = {
    "md", "py", "ts", "tsx", "js", "jsx", "json", "yml", "yaml",
    "css", "sh", "toml", "lock", "txt", "sql", "html",
}


def _looks_like_path(root: Path, token: str) -> bool:
    if not token or " " in token or "\t" in token:
        return False
    if token.startswith(NON_PATH_PREFIXES):
        return False
    if any(c in token for c in "<>*$(){}|@"):
        return False
    if "::" in token:
        return False

    clean = token.rstrip("/")
    for suffix in ("/**", "/*"):
        if clean.endswith(suffix):
            clean = clean[: -len(suffix)]
            break
    if not clean:
        return False

    if "/" in clean:
        first_segment = clean.split("/", 1)[0]
        # 상대 경로(.claude/...)거나, 첫 세그먼트가 실제 저장소 최상위
        # 디렉터리일 때만 파일 경로로 본다 — import 별칭이나 브랜치 이름
        # (feat/foo)은 첫 세그먼트가 진짜 디렉터리가 아니라서 걸러진다.
        if first_segment.startswith("."):
            return True
        return (root / first_segment).is_dir()

    ext = clean.rsplit(".", 1)[-1].lower() if "." in clean else ""
    return ext in REAL_EXTENSIONS


def find_markdown_files(root: Path) -> list[Path]:
    files = []
    for path in root.rglob("*.md"):
        if any(part in SKIP_DIRS for part in path.parts):
            continue
        files.append(path)
    return sorted(files)


def extract_path_references(root: Path, text: str) -> list[str]:
    return [
        match.group(1).strip()
        for match in BACKTICK.finditer(text)
        if _looks_like_path(root, match.group(1).strip())
    ]


LINE_SUFFIX = re.compile(r":\d+(-\d+)?$")


def _resolve(root: Path, token: str) -> bool:
    clean = token.rstrip("/")
    clean = LINE_SUFFIX.sub("", clean)  # file.tsx:56 또는 file.tsx:56-60 형태 대응
    for suffix in ("/**", "/*"):
        if clean.endswith(suffix):
            clean = clean[: -len(suffix)]
            break

    if "/" in clean:
        return (root / clean).exists()

    # 슬래시 없는 파일명(예: CLAUDE.md) — 저장소 어딘가에 같은 이름이 있으면 인정한다.
    try:
        return any(root.rglob(clean))
    except (NotImplementedError, ValueError, OSError):
        return True


def find_broken_references(root: Path) -> dict[str, list[str]]:
    broken: dict[str, list[str]] = {}
    for md_file in find_markdown_files(root):
        text = md_file.read_text(encoding="utf-8", errors="ignore")
        missing = sorted(
            {
                token
                for token in extract_path_references(root, text)
                if not _resolve(root, token)
            }
        )
        if missing:
            broken[str(md_file.relative_to(root))] = missing
    return broken


def main() -> int:
    # 콘솔 코드페이지가 UTF-8이 아니어도(예: Windows cp949) 문서 안의
    # 특수문자(제로폭 공백 등) 출력이 죽지 않게 한다.
    sys.stdout.reconfigure(errors="replace")

    repo_root = Path(__file__).resolve().parents[2]
    broken = find_broken_references(repo_root)

    if broken:
        total = sum(len(v) for v in broken.values())
        print(f"문서에서 존재하지 않는 파일 참조가 {total}건 발견됐습니다 (오탐 있을 수 있음, 감사용).")
        for md_file, tokens in broken.items():
            print(f"  {md_file}:")
            for token in tokens:
                print(f"    - `{token}`")
        print("이름이 바뀌었거나 지워진 파일을 문서가 아직 가리키고 있는지 확인하세요.")
        return 1

    print("문서 참조 검사 통과: 깨진 파일 경로 참조 없음.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
