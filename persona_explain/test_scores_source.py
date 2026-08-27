"""scores_source 검증 — 팀 데이터를 읽는 층이 조용히 틀리지 않게 한다.

여기서 잡으려는 사고는 두 가지다.

- 지표 키 변환표가 빠지거나 어긋나서 지표가 조용히 사라지는 것.
- 화면과 다른 자리수·형식으로 숫자를 말하는 것.

실제 scores.json이 있으면 그것으로도 확인하고, 없으면(팀 저장소를 clone하지 않은
사람) 그 부분만 건너뛴다.
"""
from __future__ import annotations

import copy
import json

import pytest

import scores_source
from explain import METRIC_LABELS, NO_VALUE, format_criteria_block
from scores_source import (METRIC_SPEC, SCORES_KEY_TO_METRIC, ScoresData,
                           ScoresNotFound, UnknownStyle, UnknownTicker,
                           format_value)

# ---- 변환표 ------------------------------------------------------------------

def test_every_metric_has_a_display_spec():
    # METRIC_SPEC에 빠진 키가 있으면 그 지표는 프롬프트에서 사라진다.
    assert set(SCORES_KEY_TO_METRIC) == set(METRIC_SPEC)


def test_internal_keys_are_known_labels():
    # 변환 결과가 METRIC_LABELS에 없으면 손으로 넣는 경로와 이름이 갈린다.
    for internal in SCORES_KEY_TO_METRIC.values():
        assert internal in METRIC_LABELS, internal


def test_internal_keys_are_unique():
    values = list(SCORES_KEY_TO_METRIC.values())
    assert len(values) == len(set(values))


# ---- 값 표기 (apps/web/lib/format.ts와 같은 규칙) -----------------------------

@pytest.mark.parametrize("value,fmt,cap,expected", [
    (0.14453131319875906, "pct", None, "14.5%"),
    (-0.22225348799727473, "pct", None, "-22.2%"),
    (0.7136389360498019, "x", None, "0.7배"),
    (250.0, "x", 100, "100배 초과"),
    (13.205357142857142, "x", 100, "13.2배"),
    (8.096056661377947, "raw", None, "8.10"),
    (None, "pct", None, NO_VALUE),
    (None, "x", 100, NO_VALUE),
])
def test_format_value_matches_screen(value, fmt, cap, expected):
    assert format_value(value, fmt, cap) == expected


def test_interest_coverage_is_capped():
    # 분모가 0에 가까우면 배수가 무의미하게 커진다. 화면과 같은 cap을 써야 한다.
    assert METRIC_SPEC["interestCoverage"][2] == 100
    assert scores_source.format_metric("interestCoverage", 1e6) == "100배 초과"


# ---- 가짜 데이터로 로더 확인 --------------------------------------------------

FAKE = {
    "generatedAt": "2026-08-07T01:32:16+00:00",
    "dataSource": "sec-toss",
    "asOf": {"price": "2026-08-05", "financial": "2025-03-29"},
    "styles": [
        {"id": "buffett", "name": "워런 버핏·찰리 멍거", "modelVersion": "Buffett 1.0",
         "method": "threshold",
         "criteria": [
             {"code": "BUF_ROIC_LEVEL", "label": "자본 효율성", "weight": 3,
              "detail": "5년 평균 ROIC ≥ 12%"},
             {"code": "BUF_GROWTH", "label": "사업의 성장", "weight": 2,
              "detail": "매출 5년 연평균 성장률 ≥ 3%"},
         ]},
        {"id": "greenblatt", "name": "조엘 그린블랫", "modelVersion": "Greenblatt 1.0",
         "method": "rank",
         "criteria": [{"code": "GRB_QUALITY_RANK", "label": "사업의 질 순위",
                       "weight": 1, "detail": "자본수익률 순위"}]},
    ],
    "companies": [
        {"ticker": "aapl", "name": "애플", "sector": "Electronic Computers",
         "price": 200.0, "marketCap": 3000.0,
         "asOf": {"price": "2026-08-05", "financial": "2025-09-27"},
         "metrics": {"roicAvg5y": 0.556, "revenueCagr5y": 0.033,
                     "interestCoverage": None},
         "scores": {
             "buffett": {"styleId": "buffett", "modelVersion": "Buffett 1.0",
                         "score": 72, "passed": 1, "totalJudged": 2, "total": 2,
                         "dataConfidence": "높음",
                         "criteria": [
                             {"code": "BUF_ROIC_LEVEL", "label": "자본 효율성",
                              "weight": 3, "status": "pass",
                              "message": "자본 대비 이익이 높습니다.",
                              "detail": "5년 평균 ROIC ≥ 12%"},
                             {"code": "BUF_GROWTH", "label": "사업의 성장",
                              "weight": 2, "status": "fail",
                              "message": "매출 성장이 둔화돼 있습니다.",
                              "detail": "매출 5년 연평균 성장률 ≥ 3%"},
                         ],
                         "reasons": ["자본 대비 이익이 높습니다."],
                         "risks": ["매출 성장이 둔화돼 있습니다."]},
             "greenblatt": {"styleId": "greenblatt", "modelVersion": "Greenblatt 1.0",
                            "score": 68, "passed": 1, "totalJudged": 1, "total": 1,
                            "dataConfidence": "높음",
                            "criteria": [{"code": "GRB_QUALITY_RANK",
                                          "label": "사업의 질 순위", "weight": 1,
                                          "status": "pass",
                                          "message": "271개 중 3위입니다.",
                                          "detail": "자본수익률 순위"}],
                            "reasons": [], "risks": [],
                            "rank": 88, "rankComponents": {"quality": 3, "value": 208}},
         }},
        {"ticker": "ACGL", "name": "아치 캐피털", "sector": "Fire, Marine",
         "price": 90.0, "marketCap": 300.0,
         "asOf": {"price": "2026-08-05", "financial": "2025-12-31"},
         "metrics": {"roicAvg5y": None, "revenueCagr5y": 0.21},
         "scores": {"buffett": {"styleId": "buffett", "modelVersion": "Buffett 1.0",
                                "score": None, "passed": 0, "totalJudged": 0,
                                "total": 8, "dataConfidence": "판정 대상 아님",
                                "criteria": [], "reasons": [], "risks": []}}},
    ],
}


@pytest.fixture
def fake(tmp_path):
    path = tmp_path / "scores.json"
    path.write_text(json.dumps(FAKE, ensure_ascii=False), encoding="utf-8")
    return ScoresData(str(path))


def test_loads_styles_and_companies(fake):
    assert len(fake) == 2
    assert fake.style_ids() == ["buffett", "greenblatt"]
    assert fake.styles["greenblatt"].method == "rank"
    assert len(fake.styles["buffett"].criteria) == 2


def test_ticker_lookup_is_case_insensitive(fake):
    assert fake.company("aapl").ticker == "AAPL"
    assert fake.company("AaPl").ticker == "AAPL"
    assert fake.company(" aapl ").ticker == "AAPL"


def test_unknown_ticker_and_style_raise(fake):
    with pytest.raises(UnknownTicker):
        fake.company("NOSUCH")
    with pytest.raises(UnknownStyle):
        fake.judgement("AAPL", "nosuchstyle")


def test_metrics_use_internal_keys(fake):
    metrics = fake.company("AAPL").metrics
    assert metrics["ROIC_5y_avg"] == 0.556
    assert metrics["revenue_CAGR_5y"] == 0.033
    assert metrics["interest_coverage"] is None
    # camelCase 키가 그대로 새어 나오면 프롬프트 라벨이 깨진다
    assert "roicAvg5y" not in metrics


def test_metrics_block_uses_screen_labels(fake):
    block = fake.company("AAPL").metrics_block()
    assert block.startswith("<지표>")
    assert "애플 (AAPL)" in block
    assert "- 자본수익률(5년 평균): 55.6%" in block
    assert f"- 이자보상배율: {NO_VALUE}" in block


def test_judgement_carries_thresholds(fake):
    judged = fake.judgement("AAPL", "buffett")
    assert judged.judged is True
    assert judged.score == 72
    assert judged.data_confidence == "높음"
    labels = [c["label"] for c in judged.criteria]
    assert labels == ["자본 효율성", "사업의 성장"]


def test_rank_style_keeps_rank_fields(fake):
    judged = fake.judgement("AAPL", "greenblatt")
    assert judged.rank == 88
    assert judged.rank_components == {"quality": 3, "value": 208}
    assert judged.method == "rank"


def test_unscorable_company_has_no_criteria(fake):
    judged = fake.judgement("ACGL", "buffett")
    assert judged.judged is False
    assert judged.score is None
    assert judged.data_confidence == "판정 대상 아님"


def test_missing_style_for_company_is_not_judged(fake):
    # 유니버스에는 있지만 이 관점의 점수가 아예 없는 종목
    judged = fake.judgement("ACGL", "greenblatt")
    assert judged.judged is False
    assert judged.data_confidence == "판정 대상 아님"


def test_criteria_block_marks_status_in_korean(fake):
    block = format_criteria_block(fake.judgement("AAPL", "buffett"))
    assert "[충족] 자본 효율성" in block
    assert "[미충족] 사업의 성장" in block
    assert "기준: 5년 평균 ROIC ≥ 12%" in block


def test_criteria_block_for_unscorable_says_so(fake):
    block = format_criteria_block(fake.judgement("ACGL", "buffett"))
    assert "채점 대상이 아닙니다" in block
    assert "[충족]" not in block
    assert "[미충족]" not in block


def test_criteria_block_shows_rank(fake):
    block = format_criteria_block(fake.judgement("AAPL", "greenblatt"))
    assert "유니버스 내 순위: 88위" in block
    assert "사업의 질 3위" in block


def test_search_prefers_exact_ticker(fake):
    results = fake.search("aapl")
    assert results[0]["ticker"] == "AAPL"
    assert fake.search("애플")[0]["ticker"] == "AAPL"
    assert fake.search("") == []
    assert fake.search("zzzz") == []


def test_search_respects_limit(fake):
    assert len(fake.search("a", limit=1)) == 1


def test_missing_path_raises():
    with pytest.raises(ScoresNotFound):
        scores_source.resolve_path("/nope/scores.json")


def _replace_scores(path, payload) -> None:
    replacement = path.with_name(".scores.json.new")
    replacement.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    replacement.replace(path)


def test_get_data_reuses_unchanged_file_and_reloads_atomic_replacement(tmp_path):
    path = tmp_path / "scores.json"
    first_payload = copy.deepcopy(FAKE)
    path.write_text(json.dumps(first_payload, ensure_ascii=False), encoding="utf-8")

    first = scores_source.get_data(str(path), reload=True)
    assert scores_source.get_data(str(path)) is first

    second_payload = copy.deepcopy(FAKE)
    second_payload["generatedAt"] = "2026-08-07T02:32:16+00:00"
    _replace_scores(path, second_payload)
    second = scores_source.get_data(str(path))

    assert second is not first
    assert second.generated_at == "2026-08-07T02:32:16+00:00"


def test_get_data_keeps_last_good_snapshot_and_recovers(tmp_path):
    path = tmp_path / "scores.json"
    path.write_text(json.dumps(FAKE, ensure_ascii=False), encoding="utf-8")
    first = scores_source.get_data(str(path), reload=True)

    replacement = path.with_name(".scores.json.new")
    replacement.write_text("{", encoding="utf-8")
    replacement.replace(path)
    assert scores_source.get_data(str(path)) is first

    recovered_payload = copy.deepcopy(FAKE)
    recovered_payload["generatedAt"] = "2026-08-07T03:32:16+00:00"
    _replace_scores(path, recovered_payload)
    recovered = scores_source.get_data(str(path))

    assert recovered is not first
    assert recovered.generated_at == "2026-08-07T03:32:16+00:00"


def test_get_data_keeps_last_good_snapshot_while_file_is_missing(tmp_path):
    path = tmp_path / "scores.json"
    path.write_text(json.dumps(FAKE, ensure_ascii=False), encoding="utf-8")
    first = scores_source.get_data(str(path), reload=True)

    path.unlink()

    assert scores_source.get_data(str(path)) is first


def test_get_data_rejects_parseable_but_empty_replacement(tmp_path):
    path = tmp_path / "scores.json"
    path.write_text(json.dumps(FAKE, ensure_ascii=False), encoding="utf-8")
    first = scores_source.get_data(str(path), reload=True)
    empty = {
        "generatedAt": "2026-08-07T04:32:16+00:00",
        "dataSource": "sec-toss",
        "asOf": {"price": "2026-08-07", "financial": "2025-12-31"},
        "styles": [],
        "companies": [],
    }

    _replace_scores(path, empty)

    assert scores_source.get_data(str(path)) is first


# ---- 실제 scores.json (있을 때만) ---------------------------------------------

def _real_data():
    try:
        return scores_source.get_data()
    except ScoresNotFound:
        return None


real = _real_data()
needs_real = pytest.mark.skipif(real is None, reason="scores.json이 없습니다")


@needs_real
def test_real_file_has_expected_metric_keys():
    # 파이프라인이 지표를 추가·삭제하면 여기서 먼저 걸린다.
    seen = set()
    for ticker in real.tickers():
        seen |= set(real.company(ticker).raw_metrics)
    assert seen == set(SCORES_KEY_TO_METRIC), (
        f"scores.json에만 있는 키: {sorted(seen - set(SCORES_KEY_TO_METRIC))}, "
        f"변환표에만 있는 키: {sorted(set(SCORES_KEY_TO_METRIC) - seen)}"
    )


@needs_real
def test_real_styles_are_all_supported_by_prompts():
    # 화면에 있는 관점을 챗봇이 못 하면 프론트에서 빈 탭이 생긴다.
    from personas import PERSONAS

    missing = [s for s in real.style_ids() if s not in PERSONAS]
    assert not missing, f"프롬프트가 없는 관점: {missing}"


@needs_real
def test_real_persona_names_match_screen():
    from personas import PERSONAS

    for style_id in real.style_ids():
        assert PERSONAS[style_id]["name"] == real.styles[style_id].name
