"""배치 CLI 방어 — 예시 데이터가 화면 파일을 덮지 못한다.

옵션 없이 `python run_batch.py`를 치면 실데이터 380종목이 예시 12종목으로 덮이는
사고가 있었다. 루트 CLAUDE.md가 그 명령을 "커밋 전 반드시"로 안내하고 있어서,
규칙을 지키려는 사람이 정확히 그 함정에 들어갔다.

여기서 막는 것은 둘이다. 기본값이 되살아나는 것과, 예시 데이터가 화면이 읽는
scores.json으로 나가는 것.
"""

import json
import sys
from pathlib import Path

import pytest

import run_batch

ROOT = Path(__file__).resolve().parents[1]
SAMPLE_UNIVERSE = str(ROOT / "data" / "universe_sample.json")


def run(monkeypatch, *argv: str) -> None:
    monkeypatch.setattr(sys, "argv", ["run_batch.py", *argv])
    run_batch.main()


# 아래 둘은 "나머지 인자를 다 준 상태에서 하나만 뺀다". 한꺼번에 빼면 다른 인자가
# required라서 어느 쪽이 되살아나도 SystemExit이 나고, 테스트가 실패할 수 없게 된다.


def test_provider_has_no_default(monkeypatch, tmp_path):
    """--provider에 기본값이 되살아나면 이 실행이 그냥 성공해버린다."""
    with pytest.raises(SystemExit):
        run(monkeypatch, "--universe", SAMPLE_UNIVERSE, "--out", str(tmp_path / "x.json"))


def test_universe_has_no_default(monkeypatch, tmp_path):
    """--universe에 기본값이 되살아나면 이 실행이 그냥 성공해버린다."""
    with pytest.raises(SystemExit):
        run(monkeypatch, "--provider", "sample", "--out", str(tmp_path / "x.json"))


def test_sample_data_cannot_be_written_to_screen_scores(monkeypatch):
    """--out을 안 주면 기본 경로가 화면이 읽는 파일이라 거부한다."""
    with pytest.raises(SystemExit):
        run(monkeypatch, "--provider", "sample", "--universe", SAMPLE_UNIVERSE)


def test_sample_data_runs_when_out_points_elsewhere(monkeypatch, tmp_path):
    """예시 데이터로 배치가 도는지 확인하는 용도는 그대로 살아 있다."""
    out = tmp_path / "sample-scores.json"
    run(monkeypatch, "--provider", "sample", "--universe", SAMPLE_UNIVERSE, "--out", str(out))
    assert out.exists()


def test_atomic_writer_replaces_complete_json(tmp_path):
    out = tmp_path / "scores.json"
    out.write_text('{"version": "old"}', encoding="utf-8")

    run_batch.write_json_atomic(out, {"version": "new", "companies": []})

    assert json.loads(out.read_text(encoding="utf-8")) == {
        "version": "new",
        "companies": [],
    }
    assert list(tmp_path.glob(".scores.json.*.tmp")) == []


def test_atomic_writer_keeps_old_file_when_publish_fails(monkeypatch, tmp_path):
    out = tmp_path / "scores.json"
    old = '{"version": "old"}'
    out.write_text(old, encoding="utf-8")

    def fail_replace(_source, _target):
        raise OSError("publish failed")

    monkeypatch.setattr(run_batch.os, "replace", fail_replace)
    with pytest.raises(OSError, match="publish failed"):
        run_batch.write_json_atomic(out, {"version": "new"})

    assert out.read_text(encoding="utf-8") == old
    assert list(tmp_path.glob(".scores.json.*.tmp")) == []


@pytest.mark.parametrize(("keep_checkpoint", "checkpoint_remains"), [(False, False), (True, True)])
def test_full_checkpoint_can_wait_for_outer_publish_verification(
    monkeypatch, tmp_path, keep_checkpoint, checkpoint_remains
):
    class FakeSecTossProvider:
        source_name = "sec-toss"

        def __init__(self, **_kwargs):
            pass

    checkpoint = tmp_path / "sec-toss.jsonl"
    checkpoint.write_text('{"ticker":"TEST"}\n', encoding="utf-8")
    out = tmp_path / "scores.json"
    monkeypatch.setattr(run_batch, "SecTossProvider", FakeSecTossProvider)
    monkeypatch.setattr(
        run_batch,
        "build",
        lambda *_args: {"generatedAt": "test", "styles": [], "companies": []},
    )
    monkeypatch.setattr(run_batch, "validate_scores_payload", lambda *_args, **_kwargs: None)

    argv = [
        "--provider", "sec-toss",
        "--mode", "full",
        "--universe", SAMPLE_UNIVERSE,
        "--out", str(out),
        "--checkpoint", str(checkpoint),
    ]
    if keep_checkpoint:
        argv.append("--keep-checkpoint")
    run(monkeypatch, *argv)

    assert checkpoint.exists() is checkpoint_remains
