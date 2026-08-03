"""분석 흐름 검증 — 모델이 규칙을 어겼을 때 무슨 일이 일어나는가."""

import json

import pytest

from app.services import vision_analyzer
from app.services.llm_adapter import MockVisionProvider, parse_json
from app.services.prompt import LESSON_IDS, build_messages

IMAGE = b"fake-bytes"


def canned(**overrides) -> str:
    body = {
        "analyzable": True,
        "rejectionReason": None,
        "chartType": "candlestick",
        "observations": [
            {"category": "chart_type", "visibility": "clear", "description": "캔들 차트가 사용되고 있습니다."},
            {"category": "trend", "visibility": "partial", "description": "최근 가격이 좁은 범위 안에서 움직입니다."},
            {"category": "volume", "visibility": "clear", "description": "아래쪽에 거래량 막대가 있습니다."},
        ],
        "uncertainties": ["전체 기간을 확인하기 어렵습니다."],
        "learningPoints": ["횡보 추세"],
        "relatedLessons": ["trend-basics"],
    }
    body.update(overrides)
    return json.dumps(body, ensure_ascii=False)


class ScriptedProvider:
    """회차별로 다른 응답을 돌려주는 공급자. 재생성 동작을 확인한다."""

    name = "scripted"

    def __init__(self, *responses: str):
        self.responses = list(responses)
        self.calls = 0

    async def analyze(self, image_bytes, media_type, messages):
        self.calls += 1
        return self.responses[min(self.calls - 1, len(self.responses) - 1)]


async def test_happy_path():
    outcome = await vision_analyzer.analyze(MockVisionProvider(), IMAGE, "image/png")
    assert outcome.response.chartType == "candlestick"
    assert len(outcome.response.observations) >= 3
    assert outcome.response.uncertainties
    assert outcome.response.filtered is False
    assert outcome.attempts == 1


async def test_forbidden_fields_never_reach_response():
    outcome = await vision_analyzer.analyze(MockVisionProvider(), IMAGE, "image/png")
    body = outcome.response.model_dump()
    for banned in ("buySignal", "sellSignal", "targetPrice", "stopLoss",
                   "upsideProbability", "futureDirection", "recommendedAction", "confidence"):
        assert banned not in body


async def test_model_rejection_is_passed_through():
    provider = MockVisionProvider(canned(analyzable=False, rejectionReason="차트가 아닌 이미지로 보입니다."))
    with pytest.raises(vision_analyzer.AnalysisRejected) as exc:
        await vision_analyzer.analyze(provider, IMAGE, "image/png")
    assert "차트가 아닌" in exc.value.reason


async def test_banned_expression_triggers_one_retry():
    bad = canned(observations=[
        {"category": "trend", "visibility": "clear", "description": "지금이 매수 시점입니다."},
        {"category": "candle", "visibility": "clear", "description": "양봉이 이어집니다."},
        {"category": "volume", "visibility": "clear", "description": "거래량 막대가 보입니다."},
    ])
    provider = ScriptedProvider(bad, canned())
    outcome = await vision_analyzer.analyze(provider, IMAGE, "image/png")

    assert provider.calls == 2
    assert outcome.attempts == 2
    assert "매수" not in json.dumps(outcome.response.model_dump(), ensure_ascii=False)


async def test_repeated_violation_is_refused():
    bad = canned(observations=[
        {"category": "trend", "visibility": "clear", "description": "목표가는 직전 고점입니다."},
        {"category": "candle", "visibility": "clear", "description": "양봉이 이어집니다."},
        {"category": "volume", "visibility": "clear", "description": "거래량 막대가 보입니다."},
    ])
    provider = ScriptedProvider(bad, bad)
    with pytest.raises(vision_analyzer.AnalysisRejected):
        await vision_analyzer.analyze(provider, IMAGE, "image/png")
    assert provider.calls == 2


async def test_sentence_level_violation_keeps_the_rest():
    body = canned(uncertainties=["전체 기간을 확인하기 어렵습니다.", "이 기업은 최근 실적 발표가 있었습니다."])
    outcome = await vision_analyzer.analyze(MockVisionProvider(body), IMAGE, "image/png")
    assert outcome.response.uncertainties == ["전체 기간을 확인하기 어렵습니다."]
    assert outcome.response.filtered is True


async def test_unknown_lesson_ids_are_dropped():
    body = canned(relatedLessons=["trend-basics", "elliott-wave", "fibonacci"])
    outcome = await vision_analyzer.analyze(MockVisionProvider(body), IMAGE, "image/png")
    assert outcome.response.relatedLessons == ["trend-basics"]


async def test_too_few_observations_is_refused():
    body = canned(observations=[
        {"category": "chart_type", "visibility": "unclear", "description": "무언가 보입니다."},
    ])
    with pytest.raises(vision_analyzer.AnalysisRejected):
        await vision_analyzer.analyze(MockVisionProvider(body), IMAGE, "image/png")


async def test_malformed_json_is_refused():
    provider = ScriptedProvider("죄송합니다, 분석할 수 없습니다.", "여전히 JSON이 아닙니다.")
    with pytest.raises(vision_analyzer.AnalysisRejected):
        await vision_analyzer.analyze(provider, IMAGE, "image/png")


def test_parse_json_handles_code_fence():
    assert parse_json('```json\n{"a": 1}\n```') == {"a": 1}
    assert parse_json('설명입니다.\n{"a": 2}\n끝.') == {"a": 2}


def test_prompt_never_receives_ticker():
    messages = build_messages("trend-basics")
    joined = messages["system"] + messages["user"]
    assert "티커" in messages["system"]  # 티커를 쓰지 말라는 지시는 있어야 하고
    assert "ADBE" not in joined  # 실제 종목은 절대 들어가지 않는다


def test_prompt_pins_lesson_whitelist():
    messages = build_messages(None)
    for lesson in LESSON_IDS:
        assert lesson in messages["system"]
