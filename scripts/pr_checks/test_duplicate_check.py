import subprocess
from pathlib import Path

import duplicate_check

BLOCK = """def calculate_discount(price, rate):
    if rate < 0 or rate > 1:
        raise ValueError("rate must be between 0 and 1")
    discounted = price * (1 - rate)
    rounded = round(discounted, 2)
    return rounded
"""


def _git(cwd: Path, *args: str) -> subprocess.CompletedProcess:
    return subprocess.run(
        ["git", *args],
        cwd=cwd,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        check=True,
    )


def _init_repo(root: Path) -> None:
    _git(root, "init", "-q")
    _git(root, "config", "user.email", "test@example.com")
    _git(root, "config", "user.name", "Test")


def _write(root: Path, rel_path: str, content: str) -> Path:
    file_path = root / rel_path
    file_path.parent.mkdir(parents=True, exist_ok=True)
    file_path.write_text(content, encoding="utf-8")
    return file_path


def _commit_all(root: Path, message: str) -> None:
    _git(root, "add", "-A")
    _git(root, "commit", "-q", "-m", message)


def _staged_diff(root: Path) -> str:
    return _git(root, "diff", "--cached").stdout


def test_no_report_when_added_block_is_unique(tmp_path):
    _init_repo(tmp_path)
    _write(tmp_path, "a.py", "print('unrelated')\n")
    _commit_all(tmp_path, "init")

    _write(tmp_path, "b.py", BLOCK)
    _git(tmp_path, "add", "-A")

    groups = duplicate_check.find_new_duplicates(tmp_path, _staged_diff(tmp_path))

    assert groups == []


def test_report_when_added_block_duplicates_existing_code(tmp_path):
    _init_repo(tmp_path)
    _write(tmp_path, "a.py", BLOCK)
    _commit_all(tmp_path, "init")

    _write(tmp_path, "b.py", BLOCK)
    _git(tmp_path, "add", "-A")

    groups = duplicate_check.find_new_duplicates(tmp_path, _staged_diff(tmp_path))

    assert len(groups) == 1
    assert set(groups[0]["locations"]) == {"a.py", "b.py"}


def test_report_when_added_block_duplicates_within_same_new_file(tmp_path):
    _init_repo(tmp_path)
    _write(tmp_path, "a.py", "print('seed')\n")
    _commit_all(tmp_path, "init")

    _write(tmp_path, "b.py", BLOCK + "\n" + BLOCK)
    _git(tmp_path, "add", "-A")

    groups = duplicate_check.find_new_duplicates(tmp_path, _staged_diff(tmp_path))

    assert len(groups) == 1
    assert groups[0]["locations"] == ["b.py"]


def test_preexisting_duplication_untouched_by_diff_is_not_reported(tmp_path):
    _init_repo(tmp_path)
    _write(tmp_path, "a.py", BLOCK)
    _write(tmp_path, "b.py", BLOCK)
    _commit_all(tmp_path, "init with existing debt")

    # a.py, b.py와 무관한 한 줄만 고친다 — 이 duplicate는 diff에 안 잡혀야 한다.
    _write(tmp_path, "c.py", "print('unrelated change')\n")
    _git(tmp_path, "add", "-A")

    groups = duplicate_check.find_new_duplicates(tmp_path, _staged_diff(tmp_path))

    assert groups == []


def test_git_diff_subprocess_call_survives_korean_content(tmp_path):
    # Windows에서 subprocess.run(..., text=True)에 encoding을 안 주면 기본
    # 로케일(cp949 등)로 디코딩을 시도하다 한글 섞인 diff에서
    # UnicodeDecodeError가 난다 — 실제로 이 버그로 커밋이 한 번 깨졌다.
    # _git/_staged_diff가 main()과 같은 인자(encoding="utf-8")를 쓰므로
    # 그대로 재사용해서 재현한다.
    _init_repo(tmp_path)
    _write(tmp_path, "a.py", "print('seed')\n")
    _commit_all(tmp_path, "초기 커밋")

    _write(tmp_path, "b.py", "# 한글 주석입니다\nprint('new')\n")
    _git(tmp_path, "add", "-A")

    assert "한글 주석입니다" in _staged_diff(tmp_path)


def test_diff_args_defaults_to_staged():
    assert duplicate_check._diff_args([]) == ["diff", "--cached"]


def test_diff_args_uses_base_ref_range_when_given():
    assert duplicate_check._diff_args(["--base", "origin/develop"]) == [
        "diff",
        "origin/develop...HEAD",
    ]


def test_find_all_duplicates_reports_preexisting_debt(tmp_path):
    # find_new_duplicates(게이트용)는 손 안 댄 기존 빚을 안 보지만,
    # find_all_duplicates(감사용)는 diff와 무관하게 저장소 전체를 본다.
    _write(tmp_path, "a.py", BLOCK)
    _write(tmp_path, "b.py", BLOCK)

    groups = duplicate_check.find_all_duplicates(tmp_path)

    assert len(groups) == 1
    assert set(groups[0]["locations"]) == {"a.py", "b.py"}


def test_find_all_duplicates_empty_when_no_duplication(tmp_path):
    _write(tmp_path, "a.py", "def foo():\n    return 1\n")

    assert duplicate_check.find_all_duplicates(tmp_path) == []


def test_short_block_below_minimum_not_flagged(tmp_path):
    _init_repo(tmp_path)
    short = "def foo():\n    x = 1\n    return x\n"
    _write(tmp_path, "a.py", short)
    _commit_all(tmp_path, "init")

    _write(tmp_path, "b.py", short)
    _git(tmp_path, "add", "-A")

    groups = duplicate_check.find_new_duplicates(tmp_path, _staged_diff(tmp_path))

    assert groups == []
