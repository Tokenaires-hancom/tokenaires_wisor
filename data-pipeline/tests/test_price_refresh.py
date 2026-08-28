"""3시간마다 도는 가격 갱신 실행의 검증.

이 실행은 SEC를 부르지 않고 캐시된 재무에 체결가만 덮어쓴다. 여기서 지켜야 할
것은 하나다. **가격에서 나오는 지표만 움직이고 재무에서 나오는 지표는 그대로여야
한다.** 캐시 왕복이 손실을 내면 하루 여덟 번 망가진 점수가 커밋된다.
"""

import json

import pytest

from run_batch import build
from wisor_data import metrics
from wisor_data.metrics import Fundamentals
from wisor_data.providers.sec_toss import (
    CachedPriceProvider,
    read_fundamentals_cache,
    write_fundamentals_cache,
)
from wisor_data.scores_contract import ScoresContractError, validate_scores_payload

# 가격이 바뀌면 따라 움직여야 하는 지표.
PRICE_DEPENDENT = {
    "market_cap", "enterprise_value", "pe", "pbr", "peg",
    "fcf_yield", "ev_ebit", "earnings_yield",
}


def company(ticker="TEST", price=10.0):
    return Fundamentals(
        ticker=ticker, name="Test", sector="테스트", price=price, shares_out=100.0,
        market_cap=price * 100.0,
        price_as_of="2026-08-05", financial_as_of="2025-12-31", sic="7372",
        revenue=[100.0, 110.0, 120.0, 130.0, 140.0],
        ebit=[10.0, 11.0, 12.0, 13.0, 14.0],
        net_income=[8.0, 9.0, 10.0, 11.0, 12.0],
        fcf=[7.0, 8.0, 9.0, 10.0, 11.0],
        invested_capital=[50.0, 55.0, 60.0, 65.0, 70.0],
        equity=[40.0, 45.0, 50.0, 55.0, 60.0],
        eps=[0.8, 0.9, 1.0, 1.1, 1.2],
        total_debt=20.0, cash=5.0, interest_expense=1.0, depreciation=2.0,
        current_assets=30.0, current_liabilities=15.0,
    )


def test_cache_roundtrip_keeps_every_field(tmp_path):
    """캐시를 거쳐도 재무가 한 글자도 바뀌지 않아야 한다."""
    original = [company("AAA"), company("BBB", price=25.0)]
    path = tmp_path / "fundamentals.json"

    write_fundamentals_cache(path, original)
    restored, built_at = read_fundamentals_cache(path)

    assert restored == original
    assert built_at  # 언제 수집한 재무인지 남아 있어야 한다


def test_missing_cache_fails_loudly(tmp_path):
    """캐시가 없으면 조용히 SEC 전체 수집으로 되돌아가지 않고 멈춘다."""
    with pytest.raises(FileNotFoundError) as error:
        read_fundamentals_cache(tmp_path / "없는파일.json")
    assert "--mode full" in str(error.value)


def test_only_price_dependent_metrics_move():
    """체결가를 덮어써도 재무에서 나오는 지표는 그대로여야 한다."""
    before = metrics.compute(company(price=10.0))

    provider = CachedPriceProvider(
        prices={"TEST": 20.0},
        market_caps={"TEST": 2500.0},
        companies=[company(price=10.0)],
        price_at="2026-08-07T15:22:51+09:00",
    )
    after = metrics.compute(provider.load()[0])

    moved = {
        name for name in vars(before)
        if getattr(before, name) != getattr(after, name)
    }
    assert moved, "가격을 두 배로 바꿨는데 아무 지표도 움직이지 않았다"
    assert moved <= PRICE_DEPENDENT, f"재무 지표가 함께 흔들렸다: {sorted(moved - PRICE_DEPENDENT)}"

    # 시가총액은 가격*주식수가 아니라 API가 준 값을 쓴다.
    assert after.market_cap == pytest.approx(2500.0)


def test_price_date_follows_the_fetch_time():
    """가격 기준일은 조회 시각의 날짜를 따른다."""
    provider = CachedPriceProvider(
        prices={"TEST": 20.0},
        market_caps={"TEST": 2500.0},
        companies=[company()],
        price_at="2026-08-07T15:22:51+09:00",
    )
    refreshed = provider.load()[0]

    assert refreshed.price == 20.0
    assert refreshed.price_as_of == "2026-08-07"
    # 재무 기준일은 가격과 무관하다. 같이 끌려가면 품질 게이트가 무너진다.
    assert refreshed.financial_as_of == "2025-12-31"


def test_a_ticker_without_a_price_keeps_the_cached_value():
    """체결가를 못 받은 종목은 빼거나 0으로 채우지 않고 캐시 값을 유지한다."""
    provider = CachedPriceProvider(
        prices={"AAA": 20.0},
        market_caps={"AAA": 2500.0},
        companies=[company("AAA"), company("BBB", price=33.0)],
        price_at="2026-08-07T15:22:51+09:00",
    )
    refreshed = {c.ticker: c for c in provider.load()}

    assert len(refreshed) == 2, "유니버스가 실행마다 출렁이면 안 된다"
    assert refreshed["BBB"].price == 33.0
    assert refreshed["BBB"].market_cap == 3300.0
    assert refreshed["BBB"].price_as_of == "2026-08-05"  # 옛 기준일을 그대로 둔다
    assert provider.stale() == ["BBB"]
    assert provider.refreshed() == ["AAA"]


def test_as_of_reports_the_oldest_price_date():
    """일부가 갱신되지 않았으면 기준일은 가장 이른 쪽을 말해야 한다."""
    provider = CachedPriceProvider(
        prices={"AAA": 20.0},
        market_caps={"AAA": 2500.0},
        companies=[company("AAA"), company("BBB")],
        price_at="2026-08-07T15:22:51+09:00",
    )
    provider.load()

    assert provider.as_of()["price"] == "2026-08-05"


@pytest.mark.parametrize("bad_value", [0.0, -1.0, float("nan"), float("inf")])
def test_non_positive_or_non_finite_market_data_stays_stale(bad_value):
    original = company("BAD", price=33.0)
    provider = CachedPriceProvider(
        prices={"BAD": bad_value},
        market_caps={"BAD": 2500.0},
        companies=[original],
        price_at="2026-08-07T15:22:51+09:00",
    )

    refreshed = provider.load()[0]

    assert refreshed.price == 33.0
    assert refreshed.price_as_of == "2026-08-05"
    assert provider.stale() == ["BAD"]
    assert provider.refreshed() == []


def test_price_refresh_marks_each_fresh_company_and_rejects_low_coverage():
    price_at = "2026-08-07T15:22:51+09:00"
    provider = CachedPriceProvider(
        prices={"AAA": 20.0},
        market_caps={"AAA": 2500.0},
        companies=[company("AAA"), company("BBB")],
        price_at=price_at,
    )

    payload = build(provider, price_at=price_at)
    rows = {row["ticker"]: row for row in payload["companies"]}

    assert rows["AAA"]["asOf"]["priceAt"] == price_at
    assert "priceAt" not in rows["BBB"]["asOf"]
    assert payload["asOf"]["priceCoverage"] == {"refreshed": 1, "total": 2}
    with pytest.raises(ScoresContractError, match="최소 95%"):
        validate_scores_payload(
            payload,
            expected_source="sec-toss",
            minimum_price_refresh_ratio=0.95,
        )
