"""500종목 배치의 재시도·재개 검증.

종목당 SEC companyfacts가 5~30MB다. 500종목이면 수 GB이고 수십 분이 걸린다.
중간에 끊겼을 때 처음부터 다시 받으면 안 된다.

원본 응답은 저장하지 않는다. 파싱된 Fundamentals만 남기면 500종목이 수백 KB다.
"""

import pytest

from wisor_data.metrics import Fundamentals
from wisor_data.providers.sec_toss import (
    ProviderDataError,
    append_checkpoint,
    read_checkpoint,
    with_retry,
)


def company(ticker="TEST", price_as_of="2026-08-05"):
    return Fundamentals(
        ticker=ticker, name="Test", sector="테스트", price=10.0, shares_out=100.0,
        price_as_of=price_as_of, financial_as_of="2025-12-31", sic="7372",
        revenue=[1.0, 2.0, 3.0, 4.0, 5.0],
    )


def test_retries_a_transient_failure_and_succeeds():
    attempts = []

    def call():
        attempts.append(1)
        if len(attempts) < 3:
            raise ProviderDataError("HTTP 429", retryable=True)
        return "ok"

    assert with_retry(call, sleep=lambda _: None) == "ok"
    assert len(attempts) == 3


def test_gives_up_after_the_last_attempt():
    def call():
        raise ProviderDataError("HTTP 503", retryable=True)

    with pytest.raises(ProviderDataError):
        with_retry(call, attempts=2, sleep=lambda _: None)


def test_does_not_retry_a_ticker_that_simply_does_not_exist():
    """상장폐지 종목의 404를 세 번 두드리면 500종목에서 시간만 버린다."""
    attempts = []

    def call():
        attempts.append(1)
        raise ProviderDataError("HTTP 404", retryable=False)

    with pytest.raises(ProviderDataError):
        with_retry(call, sleep=lambda _: None)
    assert len(attempts) == 1


def test_backs_off_longer_on_each_retry():
    waits = []

    def call():
        raise ProviderDataError("HTTP 429", retryable=True)

    with pytest.raises(ProviderDataError):
        with_retry(call, attempts=4, sleep=waits.append)
    assert waits == sorted(waits) and len(set(waits)) > 1


def test_checkpoint_round_trips_a_parsed_company(tmp_path):
    path = tmp_path / "checkpoint.jsonl"
    append_checkpoint(path, "2026-08-05", company("MSFT"))

    restored = read_checkpoint(path, "2026-08-05")

    assert list(restored) == ["MSFT"]
    assert restored["MSFT"].revenue == [1.0, 2.0, 3.0, 4.0, 5.0]
    assert restored["MSFT"].sic == "7372"


def test_checkpoint_from_another_price_date_is_ignored(tmp_path):
    """어제 종가로 만든 결과를 오늘 배치가 조용히 재사용하면 안 된다."""
    path = tmp_path / "checkpoint.jsonl"
    append_checkpoint(path, "2026-08-04", company("MSFT"))

    assert read_checkpoint(path, "2026-08-05") == {}


def test_missing_checkpoint_is_not_an_error(tmp_path):
    assert read_checkpoint(tmp_path / "none.jsonl", "2026-08-05") == {}


def test_incomplete_last_checkpoint_line_is_ignored(tmp_path):
    path = tmp_path / "checkpoint.jsonl"
    append_checkpoint(path, "2026-08-05", company("MSFT"))
    with path.open("a", encoding="utf-8") as handle:
        handle.write('{"priceDate":')

    restored = read_checkpoint(path, "2026-08-05")

    assert list(restored) == ["MSFT"]

    append_checkpoint(path, "2026-08-05", company("AAPL"))
    restored_after_append = read_checkpoint(path, "2026-08-05")
    assert list(restored_after_append) == ["MSFT", "AAPL"]


def test_append_separates_a_valid_last_row_without_newline(tmp_path):
    path = tmp_path / "checkpoint.jsonl"
    append_checkpoint(path, "2026-08-05", company("MSFT"))
    path.write_bytes(path.read_bytes().rstrip(b"\n"))

    append_checkpoint(path, "2026-08-05", company("AAPL"))

    restored = read_checkpoint(path, "2026-08-05")
    assert list(restored) == ["MSFT", "AAPL"]
