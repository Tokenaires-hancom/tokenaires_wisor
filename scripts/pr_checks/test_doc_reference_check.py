from pathlib import Path

import doc_reference_check


def _write(root: Path, rel_path: str, content: str) -> Path:
    file_path = root / rel_path
    file_path.parent.mkdir(parents=True, exist_ok=True)
    file_path.write_text(content, encoding="utf-8")
    return file_path


def test_existing_file_reference_is_not_flagged(tmp_path):
    (tmp_path / "scripts").mkdir()
    (tmp_path / "scripts" / "run.py").write_text("print(1)\n")
    _write(tmp_path, "docs/x.md", "실제 있는 `scripts/run.py`를 참고하세요.\n")

    assert doc_reference_check.find_broken_references(tmp_path) == {}


def test_deleted_file_reference_is_flagged(tmp_path):
    # scripts/ 디렉터리 자체는 실제로 있고(첫 세그먼트 판정용), 그 안의
    # gone.py 파일만 없는 — 파일이 지워진 실제 상황과 같은 조건.
    (tmp_path / "scripts").mkdir()
    _write(tmp_path, "docs/x.md", "이제 없는 `scripts/gone.py`를 참고하세요.\n")

    broken = doc_reference_check.find_broken_references(tmp_path)

    assert broken == {str(Path("docs") / "x.md"): ["scripts/gone.py"]}


def test_route_paths_are_not_flagged(tmp_path):
    _write(tmp_path, "docs/x.md", "`/learn`과 `/stocks/[ticker]` 화면입니다.\n")

    assert doc_reference_check.find_broken_references(tmp_path) == {}


def test_property_access_is_not_flagged(tmp_path):
    _write(tmp_path, "docs/x.md", "`chapter.lede`와 `slot.asks`를 읽는다.\n")

    assert doc_reference_check.find_broken_references(tmp_path) == {}


def test_import_alias_is_not_flagged(tmp_path):
    _write(tmp_path, "docs/x.md", "`@/lib/scores`와 `next/navigation`을 쓴다.\n")

    assert doc_reference_check.find_broken_references(tmp_path) == {}


def test_branch_name_is_not_flagged(tmp_path):
    _write(tmp_path, "docs/x.md", "`feat/screener-filter` 브랜치에서 작업한다.\n")

    assert doc_reference_check.find_broken_references(tmp_path) == {}


def test_bare_filename_found_anywhere_in_repo(tmp_path):
    (tmp_path / "apps" / "web").mkdir(parents=True)
    (tmp_path / "apps" / "web" / "CLAUDE.md").write_text("x")
    _write(tmp_path, "docs/x.md", "루트 아닌 `CLAUDE.md`도 있습니다.\n")

    assert doc_reference_check.find_broken_references(tmp_path) == {}


def test_line_number_suffix_is_stripped_before_check(tmp_path):
    (tmp_path / "apps" / "web" / "app").mkdir(parents=True)
    (tmp_path / "apps" / "web" / "app" / "page.tsx").write_text("x")
    _write(tmp_path, "docs/x.md", "`apps/web/app/page.tsx:56`을 보세요.\n")

    assert doc_reference_check.find_broken_references(tmp_path) == {}


def test_css_values_are_not_flagged(tmp_path):
    _write(tmp_path, "docs/x.md", "글자 간격은 `0.16em`, 크기는 `1.25rem`.\n")

    assert doc_reference_check.find_broken_references(tmp_path) == {}
