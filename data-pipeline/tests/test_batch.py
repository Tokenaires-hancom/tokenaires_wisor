"""배치 조립 검증 — 업종 게이트.

은행·보험·리츠는 유니버스에 넣되 점수를 내지 않는다. 화면에서 검색하면 종목은
나오지만 점수 자리에는 판정하지 않은 이유가 나가야 한다.
"""

import json
from pathlib import Path

import pytest

from run_batch import build
from wisor_data.coverage import UNSCORABLE_REASON
from wisor_data.metrics import Fundamentals

ROOT = Path(__file__).resolve().parents[1]
UNIVERSE = json.loads((ROOT / "data" / "universe_sample.json").read_text(encoding="utf-8"))


def sample(ticker: str, sic: str | None) -> Fundamentals:
    raw = next(c for c in UNIVERSE["companies"] if c["ticker"] == ticker)
    f = Fundamentals.from_dict(raw)
    f.sic = sic
    return f


class FakeProvider:
    source_name = "test"

    def __init__(self, companies, as_of=None):
        self.companies = companies
        self._as_of = as_of or {"price": "2026-08-05", "financial": "2025-12-31"}

    def load(self):
        return self.companies

    def as_of(self):
        return self._as_of


def row(payload, ticker):
    return next(c for c in payload["companies"] if c["ticker"] == ticker)


@pytest.fixture
def payload():
    return build(FakeProvider([
        sample("ADBE", "7372"),    # 소프트웨어 — 판정 대상
        sample("MSFT", "7372"),    # 소프트웨어 — 판정 대상
        sample("ULTA", "6022"),    # 은행으로 가정 — 판정 대상 아님
    ]))


def test_as_of_describes_the_companies_that_actually_went_out():
    """공급자는 품질 게이트에서 탈락한 종목까지 넣어 기준일을 계산한다.

    그 결과 화면에 2012-12-31이 찍혔는데, 그 날짜인 종목은 출력에 하나도 없었다.
    기준일은 실제로 내보낸 것만 설명해야 한다.
    """
    older, newer = sample("ADBE", "7372"), sample("MSFT", "7372")
    older.financial_as_of, newer.financial_as_of = "2025-06-30", "2025-12-31"
    older.price_as_of = newer.price_as_of = "2026-08-05"
    provider = FakeProvider([older, newer], as_of={"price": "2011-01-01", "financial": "2012-12-31"})

    result = build(provider)

    assert result["asOf"] == {"price": "2026-08-05", "financial": "2025-06-30"}


class ExcludingProvider(FakeProvider):
    """공급자 단계에서 일부 종목을 떨어뜨린 상황."""

    def __init__(self, companies, dropped):
        super().__init__(companies)
        self.dropped = dropped

    def excluded(self):
        return self.dropped


def test_universe_report_says_what_came_in_and_what_was_left_out():
    """무엇을 배제했는지는 지금 배치 로그에만 있다. 화면에서 쓰려면 결과에 남겨야 한다."""
    provider = ExcludingProvider(
        [sample("ADBE", "7372"), sample("MSFT", "7372")],
        [
            {"ticker": "ASML", "code": "NOT_10K", "detail": ""},
            {"ticker": "ARM", "code": "NOT_10K", "detail": ""},
            {"ticker": "DIS", "code": "NO_COMMON_YEARS", "detail": ""},
        ],
    )

    universe = build(provider, {"indexes": ["S&P 500"], "fetchedAt": "2026-08-06"})["universe"]

    assert universe["requested"] == 5
    assert universe["included"] == 2
    assert universe["indexes"] == ["S&P 500"]
    by_code = {e["code"]: e for e in universe["excluded"]}
    assert by_code["NOT_10K"]["count"] == 2
    assert by_code["NOT_10K"]["examples"] == ["ARM", "ASML"]


def test_quality_failures_are_reported_alongside_provider_failures():
    """두 단계에서 빠지는데 사용자에게는 '무엇이 빠졌나' 하나로 보여야 한다."""
    stale = sample("MSFT", "7372")
    stale.price_as_of, stale.financial_as_of = "2026-08-05", "2023-01-01"
    provider = ExcludingProvider(
        [sample("ADBE", "7372"), stale],
        [{"ticker": "ASML", "code": "NOT_10K", "detail": ""}],
    )

    universe = build(provider, None)["universe"]
    by_code = {e["code"]: e for e in universe["excluded"]}

    assert by_code["STALE_FINANCIALS"]["count"] == 1
    assert by_code["NOT_10K"]["count"] == 1


def test_the_numbers_add_up():
    """요청 = 수록 + 배제. 어긋나면 화면에서 사용자가 바로 알아챈다."""
    provider = ExcludingProvider(
        [sample("ADBE", "7372")],
        [{"ticker": f"X{i}", "code": "NO_COMMON_YEARS", "detail": ""} for i in range(4)],
    )

    u = build(provider, None)["universe"]

    assert u["requested"] == u["included"] + sum(e["count"] for e in u["excluded"])


def test_a_company_failing_twice_is_counted_once():
    """한 종목이 여러 이유로 걸려도 배제 수는 한 번만 센다."""
    broken = sample("MSFT", "7372")
    broken.price_as_of, broken.financial_as_of = "2026-08-05", "2023-01-01"
    broken.revenue = broken.revenue[:2]

    u = build(ExcludingProvider([sample("ADBE", "7372"), broken], []), None)["universe"]

    assert sum(e["count"] for e in u["excluded"]) == 1


def test_financial_company_stays_in_the_universe(payload):
    assert row(payload, "ULTA")["ticker"] == "ULTA"


def test_financial_company_gets_no_style_score(payload):
    scores = row(payload, "ULTA")["scores"]

    assert scores, "스타일 항목 자체는 있어야 화면이 깨지지 않는다"
    assert all(s["score"] is None for s in scores.values())


def test_financial_company_says_why_it_was_not_scored(payload):
    bank = row(payload, "ULTA")

    assert bank["scorable"] is False
    assert bank["unscorableReason"] == UNSCORABLE_REASON


def test_metrics_are_still_shown_for_a_financial_company(payload):
    """점수를 안 낼 뿐 지표는 그대로 보여준다. 숨기는 것은 별개의 결정이다."""
    assert row(payload, "ULTA")["metrics"]["roicAvg5y"] is not None


def test_operating_company_is_unaffected_by_the_gate(payload):
    adbe = row(payload, "ADBE")

    assert adbe.get("scorable") is not False
    assert adbe["scores"]["buffett"]["score"] is not None


def test_financials_are_left_out_of_the_greenblatt_ranking(payload):
    """상대 순위의 모수에 들어가면 사업회사의 순위가 밀린다."""
    message = row(payload, "ADBE")["scores"]["greenblatt"]["criteria"][0]["message"]

    assert "2개 종목" in message
    assert "3개 종목" not in message
