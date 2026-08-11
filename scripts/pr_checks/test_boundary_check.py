from pathlib import Path

import boundary_check


def _write(root: Path, rel_path: str, content: str) -> Path:
    file_path = root / rel_path
    file_path.parent.mkdir(parents=True, exist_ok=True)
    file_path.write_text(content, encoding="utf-8")
    return file_path


def test_no_violation_when_client_file_does_not_import_scores(tmp_path):
    _write(
        tmp_path,
        "components/Button.tsx",
        '"use client";\n\nimport { useState } from "react";\n',
    )

    assert boundary_check.find_violations(tmp_path) == []


def test_violation_when_client_file_imports_scores_directly(tmp_path):
    bad_file = _write(
        tmp_path,
        "components/Leaky.tsx",
        '"use client";\n\nimport { companies } from "@/lib/scores";\n',
    )

    assert boundary_check.find_violations(tmp_path) == [bad_file]


def test_no_violation_when_client_file_imports_scores_types(tmp_path):
    _write(
        tmp_path,
        "components/Safe.tsx",
        '"use client";\n\nimport type { Company } from "@/lib/scores.types";\n',
    )

    assert boundary_check.find_violations(tmp_path) == []


def test_no_violation_when_server_file_imports_scores_directly(tmp_path):
    _write(
        tmp_path,
        "app/page.tsx",
        'import { companies } from "@/lib/scores";\n\nexport default function Page() {}\n',
    )

    assert boundary_check.find_violations(tmp_path) == []


def test_real_repo_has_no_boundary_violations():
    web_root = Path(__file__).resolve().parents[2] / "apps" / "web"

    assert boundary_check.find_violations(web_root) == []
