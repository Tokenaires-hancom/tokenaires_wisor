"""화면 ↔ 재무데이터 경계 검사.

클라이언트 컴포넌트('use client')는 apps/web/lib/scores.ts를 import하면 안 된다.
이 파일은 scores.json 전체를 최상단에서 가져오므로, 클라이언트에서 참조하면
재무데이터 전부가 브라우저 번들에 실린다. (apps/web/CLAUDE.md 참고)
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

CLIENT_DIRECTIVE = re.compile(r"""^['"]use client['"];?$""")
SCORES_IMPORT = re.compile(r"""from\s+['"]@/lib/scores['"]""")
SKIP_DIRS = {"node_modules", ".next"}


def _first_statement_line(text: str) -> str | None:
    for line in text.splitlines():
        stripped = line.strip()
        if stripped:
            return stripped
    return None


def is_client_component(text: str) -> bool:
    first_line = _first_statement_line(text)
    if first_line is None:
        return False
    return bool(CLIENT_DIRECTIVE.match(first_line))


def imports_scores_directly(text: str) -> bool:
    return bool(SCORES_IMPORT.search(text))


def find_violations(web_root: Path) -> list[Path]:
    violations = []
    for path in sorted(web_root.rglob("*.ts*")):
        if any(part in SKIP_DIRS for part in path.parts):
            continue
        text = path.read_text(encoding="utf-8")
        if is_client_component(text) and imports_scores_directly(text):
            violations.append(path)
    return violations


def main() -> int:
    web_root = Path(__file__).resolve().parents[2] / "apps" / "web"
    violations = find_violations(web_root)
    if violations:
        print("경계 위반: 클라이언트 컴포넌트가 lib/scores를 직접 import합니다.")
        for path in violations:
            print(f"  - {path.relative_to(web_root)}")
        return 1
    print("경계 검사 통과: 클라이언트 컴포넌트에서 lib/scores 직접 import 없음.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
