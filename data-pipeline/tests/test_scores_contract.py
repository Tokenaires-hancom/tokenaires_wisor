import copy

import pytest

from wisor_data.scores_contract import ScoresContractError, validate_scores_payload


VALID = {
    "generatedAt": "2026-08-26T00:00:00+00:00",
    "dataSource": "sec-toss",
    "asOf": {"price": "2026-08-25", "financial": "2026-06-30"},
    "universe": {"requested": 1, "included": 1},
    "styles": [
        {
            "id": "buffett", "name": "버핏", "modelVersion": "Buffett 1.0",
            "method": "threshold",
            "criteria": [{"code": "BUF_1", "label": "기준", "weight": 1, "detail": "식"}],
        },
        {
            "id": "graham", "name": "그레이엄", "modelVersion": "Graham 1.0",
            "method": "threshold",
            "criteria": [{"code": "GRA_1", "label": "기준", "weight": 1, "detail": "식"}],
        },
    ],
    "companies": [
        {
            "ticker": "AAPL",
            "name": "Apple",
            "sector": "Technology",
            "price": 100.0,
            "marketCap": 1_000.0,
            "asOf": {"price": "2026-08-25", "financial": "2026-06-30"},
            "metrics": {"pe": 20.0},
            "scores": {
                "buffett": {
                    "styleId": "buffett", "modelVersion": "Buffett 1.0", "score": 50,
                    "passed": 1, "totalJudged": 1, "total": 1, "dataConfidence": "충분",
                    "criteria": [{"code": "BUF_1", "status": "pass"}],
                    "reasons": [], "risks": [],
                },
                "graham": {
                    "styleId": "graham", "modelVersion": "Graham 1.0", "score": 40,
                    "passed": 0, "totalJudged": 1, "total": 1, "dataConfidence": "충분",
                    "criteria": [{"code": "GRA_1", "status": "fail"}],
                    "reasons": [], "risks": [],
                },
            },
        }
    ],
}


def test_valid_runtime_scores_pass():
    assert validate_scores_payload(VALID) is VALID


def test_sample_data_cannot_be_published_as_live_data():
    payload = copy.deepcopy(VALID)
    payload["dataSource"] = "sample"

    with pytest.raises(ScoresContractError, match="dataSource"):
        validate_scores_payload(payload, expected_source="sec-toss")


def test_every_company_keeps_a_slot_for_every_style():
    payload = copy.deepcopy(VALID)
    del payload["companies"][0]["scores"]["graham"]

    with pytest.raises(ScoresContractError, match="graham"):
        validate_scores_payload(payload)


def test_company_count_cannot_fall_below_publishers_safety_line():
    with pytest.raises(ScoresContractError, match="최소 2개"):
        validate_scores_payload(VALID, minimum_companies=2)


def test_tickers_are_unique_without_case_sensitivity():
    payload = copy.deepcopy(VALID)
    duplicate = copy.deepcopy(payload["companies"][0])
    duplicate["ticker"] = "aapl"
    payload["companies"].append(duplicate)
    payload["universe"]["requested"] = 2
    payload["universe"]["included"] = 2

    with pytest.raises(ScoresContractError, match="대소문자"):
        validate_scores_payload(payload)


def test_score_slot_must_be_an_object():
    payload = copy.deepcopy(VALID)
    payload["companies"][0]["scores"]["buffett"] = None

    with pytest.raises(ScoresContractError, match="객체"):
        validate_scores_payload(payload)


def test_production_source_requires_all_four_styles():
    with pytest.raises(ScoresContractError, match="운영 style"):
        validate_scores_payload(VALID, expected_source="sec-toss")


def test_price_refresh_coverage_must_match_company_rows():
    payload = copy.deepcopy(VALID)
    price_at = "2026-08-26T10:00:00+09:00"
    payload["asOf"]["priceAt"] = price_at
    payload["asOf"]["priceCoverage"] = {"refreshed": 1, "total": 1}
    payload["companies"][0]["asOf"]["price"] = "2026-08-26"
    payload["companies"][0]["asOf"]["priceAt"] = price_at

    assert validate_scores_payload(payload, minimum_price_refresh_ratio=0.95) is payload

    del payload["companies"][0]["asOf"]["priceAt"]
    with pytest.raises(ScoresContractError, match="refreshed"):
        validate_scores_payload(payload, minimum_price_refresh_ratio=0.95)


def test_price_refresh_coverage_accepts_95_percent_but_not_less():
    payload = copy.deepcopy(VALID)
    price_at = "2026-08-25T10:00:00+09:00"
    template = payload["companies"][0]
    payload["companies"] = []
    for index in range(380):
        company = copy.deepcopy(template)
        company["ticker"] = f"T{index:03d}"
        if index < 361:
            company["asOf"]["priceAt"] = price_at
        payload["companies"].append(company)
    payload["universe"] = {"requested": 380, "included": 380}
    payload["asOf"]["priceAt"] = price_at
    payload["asOf"]["priceCoverage"] = {"refreshed": 361, "total": 380}

    validate_scores_payload(payload, minimum_price_refresh_ratio=0.95)

    del payload["companies"][360]["asOf"]["priceAt"]
    payload["asOf"]["priceCoverage"]["refreshed"] = 360
    with pytest.raises(ScoresContractError, match="최소 95%"):
        validate_scores_payload(payload, minimum_price_refresh_ratio=0.95)


def test_price_refresh_timestamp_must_be_kst():
    payload = copy.deepcopy(VALID)
    price_at = "2026-08-25T01:00:00+00:00"
    payload["asOf"]["priceAt"] = price_at
    payload["asOf"]["priceCoverage"] = {"refreshed": 1, "total": 1}
    payload["companies"][0]["asOf"]["priceAt"] = price_at

    with pytest.raises(ScoresContractError, match="KST"):
        validate_scores_payload(payload, minimum_price_refresh_ratio=0.95)
