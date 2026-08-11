"""번짐 지점 검사 — 차트 학습 단원 id 동기화.

세 곳에 각각 하드코딩된 값이 우연히 일치하는 구조라 자동 교차검증이 없었다.
하나만 고치면 분석 결과가 없는 페이지로 링크된다. (services/chart-api/CLAUDE.md 참고)

  - services/chart-api/app/services/prompt.py의 LESSON_IDS
  - apps/web/content/chartLessons.ts의 CHART_LESSONS[].id
  - apps/web/content/chartLessons.test.ts의 EXPECTED_IDS
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

LIST_LITERAL = "{var_name}\\s*=\\s*\\[(.*?)\\]"
QUOTED_STRING = re.compile(r"""['"]([^'"]+)['"]""")
ID_FIELD = re.compile(r"""id:\s*['"]([^'"]+)['"]""")

SOURCE_NAMES = (
    "prompt.py LESSON_IDS",
    "chartLessons.ts CHART_LESSONS",
    "chartLessons.test.ts EXPECTED_IDS",
)


def extract_string_list(text: str, var_name: str) -> list[str]:
    match = re.search(LIST_LITERAL.format(var_name=re.escape(var_name)), text, re.DOTALL)
    if match is None:
        raise ValueError(f"{var_name}를 찾을 수 없습니다.")
    return QUOTED_STRING.findall(match.group(1))


def extract_lesson_ids(chart_lessons_ts: str) -> list[str]:
    return ID_FIELD.findall(chart_lessons_ts)


def find_mismatches(
    lesson_ids: list[str], chart_ids: list[str], expected_ids: list[str]
) -> list[str]:
    sources = dict(zip(SOURCE_NAMES, (set(lesson_ids), set(chart_ids), set(expected_ids))))
    union: set[str] = set().union(*sources.values())

    mismatches = []
    for name, ids in sources.items():
        missing = union - ids
        if missing:
            mismatches.append(f"{name}에 없음: {', '.join(sorted(missing))}")
    return mismatches


def main() -> int:
    repo_root = Path(__file__).resolve().parents[2]
    prompt_py = (repo_root / "services/chart-api/app/services/prompt.py").read_text(
        encoding="utf-8"
    )
    chart_lessons_ts = (repo_root / "apps/web/content/chartLessons.ts").read_text(
        encoding="utf-8"
    )
    chart_lessons_test_ts = (
        repo_root / "apps/web/content/chartLessons.test.ts"
    ).read_text(encoding="utf-8")

    lesson_ids = extract_string_list(prompt_py, "LESSON_IDS")
    chart_ids = extract_lesson_ids(chart_lessons_ts)
    expected_ids = extract_string_list(chart_lessons_test_ts, "EXPECTED_IDS")

    mismatches = find_mismatches(lesson_ids, chart_ids, expected_ids)
    if mismatches:
        print("번짐 지점 위반: 차트 학습 단원 id가 세 곳에서 어긋납니다.")
        for mismatch in mismatches:
            print(f"  - {mismatch}")
        return 1
    print(f"번짐 지점 검사 통과: {len(lesson_ids)}개 단원 id가 세 곳 모두 일치합니다.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
