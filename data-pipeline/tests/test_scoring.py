"""점수 모델 검증.

가장 중요한 두 가지
- 데이터가 없으면 fail이 아니라 unknown이어야 한다(없는 값을 벌점으로 바꾸지 않는다)
- 사용자에게 나가는 문장에 매매·예측 표현이 없어야 한다
"""

import json
from pathlib import Path

import pytest

from wisor_data import metrics, quality
from wisor_data.metrics import Fundamentals
from wisor_data.styles import buffett, graham, greenblatt, lynch
from wisor_data.styles.base import BANNED_PHRASES

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


def test_criteria_count_is_eight_for_buffett():
    """기획서 11.3의 '8개 기준 중 6개' 문구가 성립해야 한다."""
    assert len(buffett.STYLE.criteria) == 8


@pytest.mark.parametrize("style", ALL_STYLES, ids=lambda s: s.id)
@pytest.mark.parametrize("ticker", [c["ticker"] for c in UNIVERSE["companies"]])
def test_no_banned_phrase_in_user_facing_text(style, ticker):
    m = metrics.compute(sample(ticker))
    score = style.score(m)
    for criterion in score.criteria:
        for banned in BANNED_PHRASES:
            assert banned not in criterion.message, (
                f"{ticker}/{criterion.code}에 금지 표현 {banned!r}: {criterion.message}"
            )


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


def test_greenblatt_combines_quality_and_value_ranks():
    universe = {
        "AAA": metrics.Metrics(roic_avg_5y=0.30, earnings_yield=0.05),
        "BBB": metrics.Metrics(roic_avg_5y=0.20, earnings_yield=0.10),
        "CCC": metrics.Metrics(roic_avg_5y=0.10, earnings_yield=0.03),
    }
    scores = greenblatt.score_universe(universe)

    assert scores["AAA"].rank == 1
    assert scores["BBB"].rank == 1
    assert scores["CCC"].rank == 3
    assert scores["BBB"].rank_components == {"quality": 2, "value": 1}


def test_greenblatt_missing_metric_is_unscored():
    scores = greenblatt.score_universe(
        {
            "KNOWN": metrics.Metrics(roic_avg_5y=0.20, earnings_yield=0.08),
            "MISSING": metrics.Metrics(roic_avg_5y=0.20, earnings_yield=None),
        }
    )

    assert scores["MISSING"].score is None
    assert scores["MISSING"].data_confidence == "정보 부족"
    assert all(criterion.status == "unknown" for criterion in scores["MISSING"].criteria)


def test_greenblatt_rank_messages_are_safe_for_sample_universe():
    universe = {
        company["ticker"]: metrics.compute(Fundamentals.from_dict(company))
        for company in UNIVERSE["companies"]
    }
    for score in greenblatt.score_universe(universe).values():
        for criterion in score.criteria:
            for banned in BANNED_PHRASES:
                assert banned not in criterion.message
