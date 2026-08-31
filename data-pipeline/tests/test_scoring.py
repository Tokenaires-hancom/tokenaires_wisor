"""점수 모델 검증.

가장 중요한 것
- 데이터가 없으면 fail이 아니라 unknown이어야 한다(없는 값을 벌점으로 바꾸지 않는다)
"""

import json
from pathlib import Path

import pytest

from wisor_data import metrics, quality
from wisor_data.metrics import Fundamentals
from wisor_data.styles import buffett, graham, greenblatt, lynch

ROOT = Path(__file__).resolve().parents[1]
UNIVERSE = json.loads((ROOT / "data" / "universe_sample.json").read_text(encoding="utf-8"))
ALL_STYLES = [buffett.STYLE, graham.STYLE, lynch.STYLE]


def sample(ticker: str) -> Fundamentals:
    raw = next(c for c in UNIVERSE["companies"] if c["ticker"] == ticker)
    return Fundamentals.from_dict(raw)


def test_cagr_basic():
    assert metrics.cagr([100, 200]) == pytest.approx(1.0)
    assert metrics.cagr([100, 110, 121]) == pytest.approx(0.10, rel=1e-6)


def test_cagr_refuses_sign_flip():
    assert metrics.cagr([-50, 100]) is None
    assert metrics.cagr([100, -50]) is None
    assert metrics.cagr([100]) is None


def test_missing_data_becomes_unknown_not_fail():
    bare = Fundamentals(
        ticker="TEST", name="Test", sector="테스트", price=10.0, shares_out=100.0,
        price_as_of="2026-07-29", financial_as_of="2026-06-30",
    )
    m = metrics.compute(bare)
    score = buffett.STYLE.score(m)

    assert score.data_confidence == "정보 부족"
    assert score.score is None
    assert all(c.status != "fail" for c in score.criteria if c.code == "BUF_ROIC_LEVEL")


def test_score_is_share_of_passed_weight():
    m = metrics.compute(sample("ADBE"))
    score = buffett.STYLE.score(m)

    judged = [c for c in score.criteria if c.status != "unknown"]
    passed_weight = sum(c.weight for c in judged if c.status == "pass")
    total_weight = sum(c.weight for c in judged)
    assert score.score == round(passed_weight / total_weight * 100)


def test_no_style_ships_a_draft_model_version():
    """0.9는 검수 전 초안 표기다. 화면에 나가는 모델은 1.0 이상이어야 한다.

    모델 버전은 DataStamp로 사용자에게 그대로 노출된다. 초안이 나가면 안 된다.
    """
    for style in [*ALL_STYLES, greenblatt.STYLE]:
        version = float(style.model_version.rsplit(" ", 1)[1])
        assert version >= 1.0, f"{style.model_version}은 검수 전 초안 표기입니다."


def test_criteria_count_is_eight_for_buffett():
    """기획서 11.3의 '8개 기준 중 6개' 문구가 성립해야 한다."""
    assert len(buffett.STYLE.criteria) == 8


def interest_cover(coverage: float):
    criterion = next(c for c in buffett.CRITERIA if c.code == "BUF_INTEREST_COVER")
    return criterion.evaluate(metrics.Metrics(interest_coverage=coverage))


def negative_equity_company():
    """자사주를 오래 사들여 자기자본이 마이너스인 기업(알트리아·HP·오토존)."""
    f = sample("ADBE")
    f.equity = [100.0, 50.0, 10.0, -20.0, -50.0]
    f.total_debt = 1000.0
    return metrics.compute(f)


def test_negative_equity_makes_pbr_unknown_not_a_negative_ratio():
    """PBR = 시총 / 자기자본이라 자본이 마이너스면 음수가 나온다.

    그 값은 '싸다'는 뜻이 아닌데 `pbr <= 1.5` 판정을 그대로 통과한다. 실제로
    알트리아가 PBR -32.6배로 '장부가치 대비 가격이 낮습니다' 판정을 받았다.
    """
    assert negative_equity_company().pbr is None


def test_negative_equity_makes_debt_to_equity_unknown():
    """부채비율도 마찬가지다. 음수가 되면 부채가 많은 기업이 기준을 통과한다."""
    assert negative_equity_company().debt_to_equity is None


def test_graham_does_not_pass_a_company_with_negative_equity_on_book_value():
    m = negative_equity_company()
    codes = {c.code: c.status for c in graham.STYLE.score(m).criteria}

    assert codes["GRA_PBR"] == "unknown"
    assert codes["GRA_DEBT_EQUITY"] == "unknown"


def test_zero_interest_expense_is_unknown_not_infinite_coverage():
    """이자비용이 0이면 배수를 만들 수 없다. 0으로 나눈 결과를 '무한히 안전함'으로 바꾸지 않는다."""
    f = Fundamentals(
        ticker="TEST", name="Test", sector="테스트", price=10.0, shares_out=100.0,
        price_as_of="2026-07-29", financial_as_of="2026-06-30",
        ebit=[100.0], interest_expense=0.0,
    )

    assert metrics.compute(f).interest_coverage is None


def test_interest_cover_message_caps_absurd_ratio():
    """이자 부담이 거의 없는 회사는 배수가 무의미하게 커진다(실측 ULTA 8286배).

    판정은 그대로 통과시킨다. 8배 기준을 진짜로 넘은 것이 맞기 때문이다.
    다만 사용자에게 '8286배'라고 말하지는 않는다.
    """
    result = interest_cover(8286.4)

    assert result.status == "pass"
    assert "8286" not in result.message
    assert "100배를 넘습니다" in result.message


def test_interest_cover_message_keeps_ordinary_ratio():
    assert "53배입니다" in interest_cover(52.9).message


@pytest.mark.parametrize("style", ALL_STYLES, ids=lambda s: s.id)
def test_risks_are_always_shown_alongside_reasons(style):
    """기획서 11.1 — 통과하지 못한 기준을 숨기지 않는다."""
    for company in UNIVERSE["companies"]:
        m = metrics.compute(Fundamentals.from_dict(company))
        score = style.score(m)
        if score.passed < score.total:
            assert score.risks, f"{company['ticker']}: 통과하지 못한 기준이 있는데 위험이 비어 있습니다."


def test_quality_flags_short_series():
    broken = sample("ADBE")
    broken.revenue = broken.revenue[:3]
    issues = quality.check(broken)
    assert any(i.code == "SHORT_SERIES" and i.fatal for i in issues)


def test_quality_rejects_financials_that_are_years_behind_the_price():
    """5년 교집합이 옛날에 걸린 종목은 탈락이 아니라 '옛 재무로 자신 있게 채점'으로 나타난다.

    실제로 KLA는 FY2014, TJX는 FY2018 숫자로 점수가 나갔다. 회사가 도중에 태그를
    바꾸면 필수 항목의 공통 연도가 과거에 멈추는데, 그 사실이 화면에 보이지 않는다.
    """
    stale = sample("ADBE")
    stale.price_as_of, stale.financial_as_of = "2026-08-05", "2024-12-31"

    issues = quality.check(stale)

    assert any(i.code == "STALE_FINANCIALS" and i.fatal for i in issues)


def test_quality_allows_a_late_fiscal_year_filer():
    """6월 결산 기업의 최신 연간보고서는 8월 기준으로 1년 전 것이 맞다.

    FY2026 10-K 제출 기한이 아직 지나지 않았다. 여기를 막으면 멀쩡한 기업이 빠진다.
    """
    june = sample("ADBE")
    june.price_as_of, june.financial_as_of = "2026-08-05", "2025-06-30"

    assert not any(i.code == "STALE_FINANCIALS" for i in quality.check(june))


def test_quality_lets_a_financial_company_through_without_operating_series():
    """은행은 잉여현금흐름과 투하자본을 만들 수 없다. 점수를 내지 않을 뿐 종목은 보여준다."""
    bank = sample("ADBE")
    bank.sic = "6022"
    bank.fcf, bank.invested_capital = [], []

    assert not any(i.fatal for i in quality.check(bank))


def test_quality_still_requires_operating_series_from_an_operating_company():
    """사업회사에서 같은 항목이 비면 점수의 근거가 없다. 그건 통과시키지 않는다."""
    operating = sample("ADBE")
    operating.fcf, operating.invested_capital = [], []

    assert any(i.fatal for i in quality.check(operating))


def test_quality_partition_drops_fatal_only():
    good = sample("ADBE")
    bad = sample("MSFT")
    bad.price = 0
    passed, issues = quality.partition([good, bad])
    assert [f.ticker for f in passed] == ["ADBE"]
    assert any(i.code == "BAD_PRICE" for i in issues)


def test_every_company_has_at_least_one_style_score():
    for company in UNIVERSE["companies"]:
        m = metrics.compute(Fundamentals.from_dict(company))
        scores = [s.score(m).score for s in ALL_STYLES]
        assert any(v is not None for v in scores), company["ticker"]


def test_greenblatt_message_says_what_the_denominator_counts():
    """'1위/7개'만 쓰면 7이 무엇의 7인지 알 수 없다.

    종목 상세에는 스크리너의 '정보 부족' 목록이 함께 보이지 않으므로, 모수가
    유니버스 전체가 아니라 두 지표를 계산할 수 있는 종목이라는 것을 문장이 밝혀야 한다.
    """
    scores = greenblatt.score_universe(
        {
            "AAA": metrics.Metrics(magic_formula_roc=0.30, earnings_yield=0.05),
            "BBB": metrics.Metrics(magic_formula_roc=0.20, earnings_yield=0.10),
            "NODEBT": metrics.Metrics(magic_formula_roc=0.40, earnings_yield=None),
        }
    )
    message = scores["AAA"].criteria[0].message

    assert "3개" not in message, "기업가치를 못 만드는 종목까지 모수에 넣으면 안 된다"
    assert "2개" in message
    assert "계산할 수 있는" in message


def test_greenblatt_missing_metric_is_unscored():
    scores = greenblatt.score_universe(
        {
            "KNOWN": metrics.Metrics(magic_formula_roc=0.20, earnings_yield=0.08),
            "MISSING": metrics.Metrics(magic_formula_roc=0.20, earnings_yield=None),
        }
    )

    assert scores["MISSING"].score is None
    assert scores["MISSING"].data_confidence == "정보 부족"
    assert all(criterion.status == "unknown" for criterion in scores["MISSING"].criteria)


def test_magic_formula_uses_latest_pretax_roc_not_five_year_after_tax_roic():
    universe = {
        "LATEST": metrics.Metrics(
            magic_formula_roc=0.40, roic_avg_5y=0.05, earnings_yield=0.05
        ),
        "AVERAGE": metrics.Metrics(
            magic_formula_roc=0.10, roic_avg_5y=0.50, earnings_yield=0.05
        ),
    }

    scores = greenblatt.score_universe(universe)

    assert scores["LATEST"].rank_components["quality"] == 1
    assert scores["AVERAGE"].rank_components["quality"] == 2
    assert scores["LATEST"].model_version == "Greenblatt 1.0"


def test_magic_formula_roc_uses_ebit_and_tangible_capital_without_tax_adjustment():
    company = Fundamentals(
        ticker="MAGIC",
        name="Magic",
        sector="산업재",
        price=10.0,
        shares_out=100.0,
        market_cap=1000.0,
        price_as_of="2026-08-12",
        financial_as_of="2025-12-31",
        ebit=[100.0],
        current_assets=300.0,
        current_liabilities=150.0,
        net_fixed_assets=250.0,
    )

    computed = metrics.compute(company)

    assert computed.magic_formula_roc == pytest.approx(100 / (300 - 150 + 250))
