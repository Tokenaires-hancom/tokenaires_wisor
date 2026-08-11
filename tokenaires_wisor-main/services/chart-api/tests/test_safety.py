"""금지 표현 필터 검증.

공개 전 내부 기준(설계 가이드 11장) 중 "금지된 매수·매도 표현 0건"을 지키는지
여기서 확인한다. 새 실패 사례가 나오면 문장을 그대로 이 파일에 추가한다.
"""

import pytest

from app.services import safety

# 반드시 걸러져야 하는 문장. 실제 모델이 만들어낸 표현을 그대로 모아 둔다.
MUST_BLOCK = [
    "단기 이동평균선이 장기선을 상향 돌파해 매수 관점으로 볼 수 있습니다.",
    "지금 구간은 분할 매도로 대응하는 것이 좋습니다.",
    "목표가는 직전 고점 부근으로 볼 수 있습니다.",
    "손절은 최근 저점 아래로 잡으면 됩니다.",
    "이 흐름이라면 앞으로 상승할 가능성이 큽니다.",
    "추가 하락할 것으로 보입니다.",
    "바닥을 다졌다고 볼 수 있습니다.",
    "반등 확률은 70% 정도로 보입니다.",
    "확실한 추세 전환 신호입니다.",
    "장기 투자자에게 안전한 투자 구간입니다.",
    "골든크로스가 나왔으니 진입을 고려해 볼 수 있습니다.",
]

# 교육용으로 정상인 문장. 하나라도 걸리면 과잉 차단이다.
MUST_PASS = [
    "캔들 차트가 사용되고 있습니다.",
    "화면상 단기 이동평균선이 중기 이동평균선 아래에 있습니다.",
    "최근 구간에서 고점과 저점이 비슷한 범위 안에 머무는 모습이 보입니다.",
    "이전에 가격이 여러 번 반응한 구간이 보이지만 정확한 가격은 명확하지 않습니다.",
    "골든크로스는 단기선이 장기선을 위로 지나는 현상을 부르는 이름입니다.",
    "두 선이 교차했다고 해서 이후 방향이 정해지는 것은 아닙니다.",
    "거래량 막대가 아래쪽 패널에 표시되어 있습니다.",
    "전체 차트 기간을 확인하기 어렵습니다.",
    "이미지 해상도가 낮아 가격 숫자를 읽기 어렵습니다.",
    "음봉이 연속으로 나타난 구간이 보입니다.",
    "이 차트만으로는 장기 추세를 판단하기 어렵습니다.",
]


@pytest.mark.parametrize("sentence", MUST_BLOCK)
def test_banned_sentences_are_caught(sentence):
    result = safety.filter_text(sentence)
    assert result.violations, f"걸러지지 않았습니다: {sentence}"
    assert result.blocked, f"block 등급이어야 합니다: {sentence}"
    assert sentence not in result.text


@pytest.mark.parametrize("sentence", MUST_PASS)
def test_educational_sentences_survive(sentence):
    result = safety.filter_text(sentence)
    assert result.clean, f"정상 문장이 걸렸습니다: {sentence} → {result.violations}"
    assert result.text == sentence


def test_only_offending_sentence_is_removed():
    text = ("캔들 차트가 사용되고 있습니다. "
            "지금이 매수 시점입니다. "
            "거래량 막대가 아래쪽 패널에 표시되어 있습니다.")
    result = safety.filter_text(text)
    assert "캔들 차트가 사용되고 있습니다." in result.text
    assert "거래량 막대가 아래쪽 패널에 표시되어 있습니다." in result.text
    assert "매수" not in result.text
    assert len(result.removed) == 1


def test_forbidden_fields_are_rejected():
    payload = {
        "chartType": "candlestick",
        "observations": [],
        "targetPrice": 512.0,
        "confidence": 0.87,
    }
    violations = safety.check_payload(payload)
    codes = {v.code for v in violations}
    assert codes == {"FORBIDDEN_FIELD"}
    assert {v.excerpt for v in violations} == {"targetPrice", "confidence"}


def test_nested_strings_are_scanned():
    payload = {
        "observations": [
            {"category": "trend", "description": "지금 매수해도 괜찮아 보입니다."},
        ],
    }
    violations = safety.check_payload(payload)
    assert any(v.code == "ACTION_BUY" for v in violations)


def test_external_knowledge_is_sentence_level():
    text = "이 기업은 최근 실적 발표에서 좋은 숫자를 냈습니다."
    result = safety.filter_text(text)
    assert result.violations
    assert not result.blocked  # 문장만 떼어내면 된다
    assert result.text == ""
