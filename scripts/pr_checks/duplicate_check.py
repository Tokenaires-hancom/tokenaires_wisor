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

**판정은 min_lines(6줄)짜리 슬라이딩 윈도우 단위지만, 보고는 구간 단위다.**
연속으로 겹치는 윈도우를 _merge_spans로 하나의 구간으로 합쳐서 보고한다 —
안 그러면 33줄짜리 통째 중복이 겹치는 윈도우 개수(28개)만큼 부풀려져서
"서로 다른 중복 28개"처럼 오해를 준다.

**위치는 항상 실제 파일 줄번호(1부터)다.** diff에서 추가된 줄의 위치는
hunk 헤더(`@@ -a,b +c,d @@`)를 근거로 실제 새 파일 기준 줄번호로 환산한다
— 그냥 "몇 번째로 추가된 줄인지"로 세면, 서로 떨어진 여러 hunk가 이어붙여
지면서 구간 병합이 엉뚱한 곳끼리 합쳐지는 버그가 생긴다(실제로 한 번
겪었다 — 무관한 두 위치가 48줄짜리 "중복"으로 잘못 합쳐졌었다).
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


def _significant_lines(text: str) -> list[tuple[str, int]]:
    """빈 줄을 뺀 (정규화된 내용, 실제 1-based 줄번호) 목록."""
    result = []
    for lineno, raw in enumerate(text.splitlines(), start=1):
        normalized = _normalize_line(raw)
        if normalized:
            result.append((normalized, lineno))
    return result


def extract_blocks(text: str, min_lines: int = MIN_BLOCK_LINES) -> list[tuple[str, int]]:
    """min_lines 줄짜리 연속 블록(정규화됨)과 그 시작 위치(실제 파일
    줄번호)를 전부 낸다. 같은 파일 안에서 같은 블록이 여러 번 나오면 그만큼
    여러 번 낸다 — 한 파일 안에서의 복붙도 잡기 위해서다.
    """
    lines = _significant_lines(text)
    return [
        ("\n".join(content for content, _ in lines[i : i + min_lines]), lines[i][1])
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


def added_blocks_by_file(
    diff_text: str, min_lines: int = MIN_BLOCK_LINES
) -> dict[str, list[tuple[str, int]]]:
    """`git diff` 텍스트에서 파일별로, 추가된 줄들로만 이루어진 min_lines
    연속 블록과 그 실제 새 파일 줄번호(1부터)를 뽑는다. hunk 헤더의 `+c,d`
    로 시작 줄번호를 잡고, 컨텍스트·추가 줄마다 늘리고 삭제 줄은 안 늘린다
    — 이래야 서로 다른 hunk가 하나로 이어붙여지지 않는다. 파일 경로는
    diff에 나온 그대로(예: apps/web/x.ts)다.
    """
    added: dict[str, list[tuple[str, int]]] = defaultdict(list)
    current_file: str | None = None
    new_lineno = 0

    for line in diff_text.splitlines():
        if line.startswith("+++ "):
            path_part = line[4:].strip()
            current_file = None if path_part == "/dev/null" else path_part.removeprefix("b/")
            continue
        if line.startswith("--- "):
            continue
        hunk_match = HUNK_HEADER.match(line)
        if hunk_match:
            new_lineno = int(hunk_match.group(1))
            continue
        if current_file is None:
            continue
        if line.startswith("\\"):
            continue  # "\ No newline at end of file"
        if line.startswith("+"):
            normalized = _normalize_line(line[1:])
            if normalized:
                added[current_file].append((normalized, new_lineno))
            new_lineno += 1
        elif line.startswith("-"):
            continue  # 새 파일엔 없는 줄, 줄번호 안 늘림
        else:
            new_lineno += 1  # 컨텍스트 줄

    blocks: dict[str, list[tuple[str, int]]] = {}
    for file_path, entries in added.items():
        file_blocks = [
            ("\n".join(content for content, _ in entries[i : i + min_lines]), entries[i][1])
            for i in range(len(entries) - min_lines + 1)
        ]
        if file_blocks:
            blocks[file_path] = file_blocks

    return blocks


def _merge_spans(
    pairs: set[tuple[int, int]], min_lines: int
) -> list[tuple[int, int, int]]:
    """(줄번호A, 줄번호B) 매치 쌍들 중, 둘 다 1씩 같이 증가하며 이어지는
    것끼리 하나의 구간으로 합친다. (시작 줄A, 시작 줄B, 구간 줄 수)를 낸다.
    """
    ordered = sorted(pairs)
    spans = []
    i = 0
    while i < len(ordered):
        start_a, start_b = ordered[i]
        j = i
        while (
            j + 1 < len(ordered)
            and ordered[j + 1] == (ordered[j][0] + 1, ordered[j][1] + 1)
        ):
            j += 1
        window_count = j - i + 1
        spans.append((start_a, start_b, window_count + min_lines - 1))
        i = j + 1
    return spans


def _scan_occurrences(
    root: Path, min_lines: int, only_bodies: set[str] | None = None
) -> dict[str, list[tuple[Path, int]]]:
    """저장소 소스 파일을 스캔해서 body -> [(경로, 실제 줄번호), ...] 맵을
    만든다. only_bodies가 있으면 그 안에 있는 body만 기록한다 — diff가
    새로 만든 블록만 관심 대상일 때 나머지를 걸러내기 위해서다.
    """
    occurrences: dict[str, list[tuple[Path, int]]] = defaultdict(list)
    for path in iter_source_files(root):
        text = path.read_text(encoding="utf-8", errors="ignore")
        for body, pos in extract_blocks(text, min_lines):
            if only_bodies is not None and body not in only_bodies:
                continue
            occurrences[body].append((path, pos))
    return occurrences


def _groups_from_pair_matches(
    pair_matches: dict[tuple[str, str], set[tuple[int, int]]], min_lines: int
) -> list[dict]:
    """(파일A, 파일B) -> {(줄A, 줄B), ...} 매핑을, 연속 윈도우를 합친 구간
    목록(사람이 읽는 결과 형태)으로 바꾼다. 위치는 이미 실제 줄번호다."""
    groups = []
    for (file_a, file_b), pairs in pair_matches.items():
        for start_a, start_b, span_lines in _merge_spans(pairs, min_lines):
            rel_a = f"{file_a}:{start_a}"
            rel_b = f"{file_b}:{start_b}"
            groups.append({"lines": span_lines, "locations": sorted({rel_a, rel_b})})
    return groups


def find_new_duplicates(
    root: Path,
    diff_text: str,
    min_lines: int = MIN_BLOCK_LINES,
) -> list[dict]:
    """diff_text가 새로 추가한 블록 중, 저장소 안에 같은 블록이 2번 이상
    존재하게 된 것만 보고한다 — 같은 파일 안에서의 복붙(자기 자신과 중복)과,
    다른 파일(기존 코드 포함)과의 중복을 둘 다 잡는다. 새로 추가했지만 딱
    한 곳에만 있는 블록(중복 아님)은 보고하지 않는다. 연속된 중복은 하나의
    구간으로 합쳐서 보고한다.
    """
    new_blocks = added_blocks_by_file(diff_text, min_lines)
    if not new_blocks:
        return []

    all_new_bodies: set[str] = set()
    for blocks in new_blocks.values():
        all_new_bodies |= {body for body, _ in blocks}

    occurrences = _scan_occurrences(root, min_lines, only_bodies=all_new_bodies)

    # 새로 추가된 두 위치가 서로 매칭되면(둘 다 diff에 새로 생긴 경우),
    # "A가 B를 찾음"과 "B가 A를 찾음"이 각각 한 번씩 잡혀서 같은 중복이
    # 두 번 보고될 수 있다. (위치, 위치) 쌍을 정렬해서 정규화한 뒤 집합에
    # 넣어 이 방향성 중복을 없앤다.
    raw_matches: set[tuple[tuple[str, int], tuple[str, int]]] = set()
    for new_file, blocks in new_blocks.items():
        for body, new_pos in blocks:
            loc_new = (new_file, new_pos)
            for other_path, other_pos in occurrences.get(body, []):
                other_rel = str(other_path.relative_to(root)).replace("\\", "/")
                loc_other = (other_rel, other_pos)
                if loc_other == loc_new:
                    continue  # 자기 자신 그 위치
                raw_matches.add(tuple(sorted((loc_new, loc_other))))

    pair_matches: dict[tuple[str, str], set[tuple[int, int]]] = defaultdict(set)
    for (file_a, pos_a), (file_b, pos_b) in raw_matches:
        pair_matches[(file_a, file_b)].add((pos_a, pos_b))

    return _groups_from_pair_matches(pair_matches, min_lines)


def _diff_args(argv: list[str]) -> list[str]:
    """기본은 `git diff --cached`(로컬 pre-commit 용). `--base <ref>`를 주면
    `git diff <ref>...HEAD`로 바꾼다(PR 전체 diff를 보는 서버 자동검사 용).
    """
    if len(argv) >= 2 and argv[0] == "--base":
        return ["diff", f"{argv[1]}...HEAD"]
    return ["diff", "--cached"]


def find_all_duplicates(root: Path, min_lines: int = MIN_BLOCK_LINES) -> list[dict]:
    """저장소 전체를 스캔해서 신규·기존 구분 없이 모든 중복 구간을 낸다.

    게이트가 아니라 **감사(audit)용**이다 — 어떤 훅에도 안 걸려 있고 병합을
    막지 않는다. `find_new_duplicates`가 "이번 diff가 새로 만든 것"만 보는
    것과 달리, 이건 이미 있던 부채까지 전부 보여준다. 필요할 때 수동으로
    `python scripts/pr_checks/duplicate_check.py --audit`로 돌린다.
    """
    occurrences = _scan_occurrences(root, min_lines)

    pair_matches: dict[tuple[str, str], set[tuple[int, int]]] = defaultdict(set)
    for locations in occurrences.values():
        if len(locations) < 2:
            continue
        for i in range(len(locations)):
            for j in range(i + 1, len(locations)):
                path_a, pos_a = locations[i]
                path_b, pos_b = locations[j]
                rel_a = str(path_a.relative_to(root)).replace("\\", "/")
                rel_b = str(path_b.relative_to(root)).replace("\\", "/")
                pair_matches[(rel_a, rel_b)].add((pos_a, pos_b))

    return _groups_from_pair_matches(pair_matches, min_lines)


def _report(groups: list[dict], *, audit: bool) -> int:
    if not groups:
        label = "저장소 전체" if audit else "이번 변경이 새로 만든"
        print(f"중복 검사 통과: {label} 문자 그대로의 중복 없음.")
        return 0

    label = "저장소 전체에 있는" if audit else "이번 변경이 새로 만든"
    print(f"{label} 중복 구간이 {len(groups)}건 있습니다.")
    for group in groups:
        print(f"  - {group['lines']}줄 구간:")
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
