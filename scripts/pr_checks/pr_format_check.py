"""PR 제목·본문 형식 검사 — 소프트 게이트.

`type: 설명` 제목(CLAUDE.md의 브랜치 접두사와 같은 집합)과 PR 템플릿 세 섹션이
채워졌는지만 본다. 위반해도 병합을 막지 않는다 — pr-review.yml의 최종 실패
판정에 이 검사 결과는 포함하지 않는다.
"""

from __future__ import annotations

import os
import re
import sys

TITLE_TYPES = ("feat", "fix", "docs", "chore", "data")
TITLE_PATTERN = re.compile(r"^(" + "|".join(TITLE_TYPES) + r"):\s*\S")

# 헤더 텍스트에 이 키워드가 들어있으면 해당 섹션으로 본다.
# 템플릿(.github/pull_request_template.md) 문구와 정확히 같지 않아도 되도록 느슨하게 잡는다.
REQUIRED_SECTIONS = {
    "무엇을 바꿨는지": "무엇을",
    "왜": "왜",
    "어떻게 확인했는지": "확인",
}
SECTION_HEADER = re.compile(r"^#{1,6}\s*(.+?)\s*$")


def check_title(title: str) -> list[str]:
    if not TITLE_PATTERN.match((title or "").strip()):
        types = "/".join(TITLE_TYPES)
        return [f'제목이 "{types}: 설명" 형식이 아닙니다: "{title}"']
    return []


def _section_bodies(body: str) -> dict[str, str]:
    sections: dict[str, list[str]] = {}
    current: str | None = None
    for line in body.splitlines():
        match = SECTION_HEADER.match(line)
        if match:
            current = match.group(1)
            sections[current] = []
            continue
        if current is not None:
            sections[current].append(line)
    return {name: "\n".join(lines).strip() for name, lines in sections.items()}


def check_body(body: str) -> list[str]:
    headers = _section_bodies(body or "")
    violations = []
    for label, keyword in REQUIRED_SECTIONS.items():
        matched = next((h for h in headers if keyword in h), None)
        if matched is None:
            violations.append(f"'{label}' 섹션이 없습니다.")
        elif not headers[matched]:
            violations.append(f"'{label}' 섹션이 비어 있습니다.")
    return violations


def main() -> int:
    title = os.environ.get("PR_TITLE", "")
    body = os.environ.get("PR_BODY", "")

    violations = check_title(title) + check_body(body)
    if violations:
        print("PR 형식 확인이 필요합니다 (병합을 막지는 않습니다).")
        for v in violations:
            print(f"  - {v}")
        return 1
    print("PR 형식 검사 통과.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
