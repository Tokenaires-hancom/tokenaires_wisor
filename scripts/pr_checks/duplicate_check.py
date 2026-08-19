"""문자 그대로의 중복 코드 탐지 — 로컬 하드블록(①) 대상.

의미상 중복(이름·구현은 다르지만 하는 일이 같은 코드)은 판단이 필요해서 여기서
다루지 않는다 — push 전 검수(`/code-review`+`/simplify`)가 CLAUDE.md의 클린 코드
원칙을 근거로 경고만 한다.

여기서는 그보다 훨씬 좁고 결정론적인 것만 본다: **이번에 새로 추가한 줄이,
정규화 후 문자 그대로 다른 곳(기존 코드 포함)에도 있는가.** 재사용 함수로 안
뽑고 매번 복붙한 흔적이라, 나중에 한 곳만 고치고 나머지를 놓치는 조용한
불일치로 이어진다(루트 CLAUDE.md "클린 코드 원칙" 참고).

**기존 코드에 이미 있던 중복은 보고하지 않는다.** `git diff --cached`의
추가(`+`)된 줄에서 뽑은 블록만 대상이라, 지금 저장소에 남아 있는 기존
빚(예: MasterComparisonInteractive.tsx / MasterDiagnosisQuiz.tsx)은 이 파일을
고쳐도 새로 걸리지 않는다 — 그 파일을 고치면서 *새로* 복붙한 경우만 걸린다.
"""

from __future__ import annotations

import re
import subprocess
import sys
from collections import defaultdict
from pathlib import Path

SOURCE_EXTENSIONS = {".py", ".ts", ".tsx"}
SKIP_DIRS = {"node_modules", ".next", ".next-dev", "__pycache__", ".git", ".cache"}
MIN_BLOCK_LINES = 6

HUNK_HEADER = re.compile(r"^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@")


def _normalize_line(line: str) -> str:
    return " ".join(line.split())


def _significant_lines(text: str) -> list[str]:
    return [n for n in (_normalize_line(line) for line in text.splitlines()) if n]


def extract_blocks(text: str, min_lines: int = MIN_BLOCK_LINES) -> list[str]:
    """min_lines 줄짜리 연속 블록(정규화됨)을 전부 낸다. 같은 파일 안에서 같은
    블록이 여러 번 나오면 그만큼 여러 번 낸다 — 한 파일 안에서의 복붙도 잡기
    위해서다.
    """
    lines = _significant_lines(text)
    return [
        "\n".join(lines[i : i + min_lines])
        for i in range(len(lines) - min_lines + 1)
    ]


def iter_source_files(root: Path) -> list[Path]:
    files = []
    for path in root.rglob("*"):
        if path.suffix not in SOURCE_EXTENSIONS:
            continue
        if any(part in SKIP_DIRS for part in path.parts):
            continue
        if path.is_file():
            files.append(path)
    return sorted(files)


def added_blocks_by_file(diff_text: str, min_lines: int = MIN_BLOCK_LINES) -> dict[str, set[str]]:
    """`git diff` 텍스트에서 파일별로, 추가된 줄들로만 이루어진 min_lines
    연속 블록을 뽑는다. 파일 경로는 diff에 나온 그대로(예: apps/web/x.ts)다.
    """
    result: dict[str, list[str]] = defaultdict(list)
    current_file: str | None = None

    for line in diff_text.splitlines():
        if line.startswith("+++ "):
            path_part = line[4:].strip()
            current_file = None if path_part == "/dev/null" else path_part.removeprefix("b/")
            continue
        if HUNK_HEADER.match(line):
            continue
        if current_file is None:
            continue
        if line.startswith("+++") or line.startswith("---"):
            continue
        if line.startswith("+"):
            normalized = _normalize_line(line[1:])
            if normalized:
                result[current_file].append(normalized)

    blocks: dict[str, set[str]] = {}
    for file_path, added_lines in result.items():
        file_blocks = {
            "\n".join(added_lines[i : i + min_lines])
            for i in range(len(added_lines) - min_lines + 1)
        }
        if file_blocks:
            blocks[file_path] = file_blocks

    return blocks


def find_new_duplicates(
    root: Path,
    diff_text: str,
    min_lines: int = MIN_BLOCK_LINES,
) -> list[dict]:
    """diff_text가 새로 추가한 블록 중, 저장소 안에 같은 블록이 2번 이상
    존재하게 된 것만 보고한다 — 같은 파일 안에서의 복붙(자기 자신과 중복)과,
    다른 파일(기존 코드 포함)과의 중복을 둘 다 잡는다. 새로 추가했지만 딱
    한 곳에만 있는 블록(중복 아님)은 보고하지 않는다.
    """
    new_blocks = added_blocks_by_file(diff_text, min_lines)
    if not new_blocks:
        return []

    all_new_bodies: set[str] = set()
    for bodies in new_blocks.values():
        all_new_bodies |= bodies

    occurrences: dict[str, list[Path]] = defaultdict(list)
    for path in iter_source_files(root):
        text = path.read_text(encoding="utf-8", errors="ignore")
        for body in extract_blocks(text, min_lines):
            if body in all_new_bodies:
                occurrences[body].append(path)

    reported: set[str] = set()
    groups = []
    for bodies in new_blocks.values():
        for body in bodies:
            if body in reported:
                continue
            locations = occurrences.get(body, [])
            if len(locations) < 2:
                continue
            reported.add(body)
            groups.append({
                "lines": body.count("\n") + 1,
                "locations": sorted({str(p.relative_to(root)) for p in locations}),
            })
    return groups


def _diff_args(argv: list[str]) -> list[str]:
    """기본은 `git diff --cached`(로컬 pre-commit 용). `--base <ref>`를 주면
    `git diff <ref>...HEAD`로 바꾼다(PR 전체 diff를 보는 서버 자동검사 용).
    """
    if len(argv) >= 2 and argv[0] == "--base":
        return ["diff", f"{argv[1]}...HEAD"]
    return ["diff", "--cached"]


def find_all_duplicates(root: Path, min_lines: int = MIN_BLOCK_LINES) -> list[dict]:
    """저장소 전체를 스캔해서 신규·기존 구분 없이 모든 중복 블록을 낸다.

    게이트가 아니라 **감사(audit)용**이다 — 어떤 훅에도 안 걸려 있고 병합을
    막지 않는다. `find_new_duplicates`가 "이번 diff가 새로 만든 것"만 보는
    것과 달리, 이건 이미 있던 부채까지 전부 보여준다. 필요할 때 수동으로
    `python scripts/pr_checks/duplicate_check.py --audit`로 돌린다.
    """
    occurrences: dict[str, list[Path]] = defaultdict(list)
    for path in iter_source_files(root):
        text = path.read_text(encoding="utf-8", errors="ignore")
        for body in extract_blocks(text, min_lines):
            occurrences[body].append(path)

    groups = []
    for body, locations in occurrences.items():
        if len(locations) < 2:
            continue
        groups.append({
            "lines": body.count("\n") + 1,
            "locations": sorted({str(p.relative_to(root)) for p in locations}),
        })
    return groups


def _report(groups: list[dict], *, audit: bool) -> int:
    if not groups:
        label = "저장소 전체" if audit else "이번 변경이 새로 만든"
        print(f"중복 검사 통과: {label} 문자 그대로의 중복 없음.")
        return 0

    label = "저장소 전체에 있는" if audit else "이번 변경이 새로 만든"
    print(f"{label} 중복 코드가 {len(groups)}건 있습니다.")
    for group in groups:
        print(f"  - {group['lines']}줄 블록, {len(group['locations'])}곳:")
        for path in group["locations"]:
            print(f"      {path}")
    if audit:
        print("게이트를 막는 건 아닙니다 — 정리가 필요하면 별도 리팩터링 PR로 처리하세요.")
    else:
        print("같은 로직이면 함수로 뽑아 재사용하세요. 의도적으로 남기려면 오버라이드하세요.")
    return 1


def main() -> int:
    repo_root = Path(__file__).resolve().parents[2]
    argv = sys.argv[1:]

    if argv and argv[0] == "--audit":
        groups = find_all_duplicates(repo_root)
        return _report(groups, audit=True)

    diff_text = subprocess.run(
        ["git", *_diff_args(argv)],
        cwd=repo_root,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        check=True,
    ).stdout

    groups = find_new_duplicates(repo_root, diff_text)
    return _report(groups, audit=False)


if __name__ == "__main__":
    sys.exit(main())
