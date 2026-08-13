"""멀티턴 챗봇 검증 — 키 없이, 과금 없이 돈다.

    cd persona_explain
    pytest -q

MockAdapter는 금지 표현을 절대 뱉지 않아 안전 필터를 발동시킬 수 없다.
그래서 경로별로 가짜 어댑터를 따로 두고 각 분기를 강제한다.
"""

import pytest

import safety
from chat import PersonaChat
from explain import BLOCKED_MESSAGE, MockAdapter, explain
from personas import CHAT_RULES, build_system_prompt

METRICS = {
    "PBR": 1.2,               # 그레이엄 기준 충족(≤1.5)
    "PER": 18,                # 미충족(≤15)
    "ROIC_5y_avg": 0.14,      # 버핏 기준 충족(≥0.12)
    "netDebt_to_EBITDA": 3.1, # 미충족(≤2.5)
    "interest_coverage": None,  # 판단불가
}

CLEAN_ANSWER = (
    "PBR 1.2는 그레이엄 기준(1.5 이하)을 충족합니다.\n"
    "이 설명은 교육용이며 투자 조언이 아닙니다."
)


# ---- 가짜 어댑터 -------------------------------------------------------------

class RecoverAdapter:
    """temperature 0이면 금지 표현, 올라가면 정상 답변. 호출 인자를 기록한다."""

    def __init__(self):
        self.calls = []

    def chat(self, system, messages, temperature=0.0):
        self.calls.append((temperature, "[재생성 지시]" in system))
        if temperature == 0.0:
            return "지금 매수하세요. 목표가는 500달러입니다."
        return CLEAN_ANSWER


class AlwaysBadAdapter:
    """재생성해도 계속 위반 — 차단으로 끝나야 한다."""

    def chat(self, system, messages, temperature=0.0):
        return "지금 매수하세요. 저평가 구간입니다."


class EmptyAdapter:
    """콘텐츠 필터에 걸렸을 때처럼 빈 문자열만 준다."""

    def chat(self, system, messages, temperature=0.0):
        return ""


class CountingAdapter:
    """호출 횟수를 세는 mock."""

    def __init__(self):
        self.calls = 0
        self._inner = MockAdapter()

    def chat(self, system, messages, temperature=0.0):
        self.calls += 1
        return self._inner.chat(system, messages, temperature)


def new_session(persona: str = "buffett", **kwargs) -> PersonaChat:
    """mock 어댑터를 물린 기본 세션."""
    kwargs.setdefault("adapter", MockAdapter())
    kwargs.setdefault("name", "Adobe")
    return PersonaChat(persona, METRICS, **kwargs)


# ---- 멀티턴 구조 -------------------------------------------------------------

def test_metrics_block_stays_first_message():
    # 앵커가 앞에 남아야 몇 턴이 지나도 모델이 원본 숫자를 보고 답한다.
    s = new_session()
    s.start()
    s.ask("ROIC가 뭔가요?")
    first = s.messages()[0]
    assert first["role"] == "user"
    assert first["content"].startswith("<지표>")
    assert "Adobe" in first["content"]


def test_two_followups_accumulate():
    s = new_session()
    s.start()
    s.ask("ROIC가 뭔가요?")
    s.ask("부채는 어떻게 보나요?")
    # 앵커 + 첫 해설 + (질문, 답변) 2쌍
    assert len(s.messages()) == 6


def test_unknown_metric_shows_as_no_data():
    # 값 없음 표기는 팀 화면(lib/format.ts)과 같은 문구를 쓴다.
    s = new_session()
    assert "이자 감당력(영업이익/이자비용): 정보 없음" in s.metrics_block()


# ---- 재생성 보정 (핵심 회귀 방지) --------------------------------------------

def test_retry_raises_temperature_and_adds_hint():
    # temperature 0을 유지한 채 재호출하면 같은 답이 나와 재생성이 무의미해진다.
    adapter = RecoverAdapter()
    s = PersonaChat("graham", METRICS, adapter=adapter)
    res = s.start()

    assert res.regenerated is True
    assert not res.blocked
    assert adapter.calls[0] == (0.0, False), "1차는 온도 0, 회피 지시 없음"
    assert adapter.calls[1] == (0.3, True), "2차만 온도 0.3, 회피 지시 붙음"


def test_recovered_answer_has_no_banned_word():
    s = PersonaChat("graham", METRICS, adapter=RecoverAdapter())
    res = s.start()
    assert "매수" not in res.text
    assert "목표가" not in res.text
    assert res.verdict == safety.OK


# ---- 차단과 오염 방지 --------------------------------------------------------

def test_persistent_violation_is_blocked():
    s = PersonaChat("lynch", METRICS, adapter=AlwaysBadAdapter())
    res = s.start()
    assert res.blocked
    assert res.verdict == safety.REGENERATE
    assert res.text == BLOCKED_MESSAGE


def test_blocked_opening_not_in_history():
    s = PersonaChat("lynch", METRICS, adapter=AlwaysBadAdapter())
    s.start()
    assert s.messages() == [{"role": "user", "content": s.metrics_block()}]
    assert s.started is False


def test_blocked_followup_not_in_history():
    s = new_session()
    s.start()
    before = len(s.messages())
    s.adapter = AlwaysBadAdapter()
    res = s.ask("그래서 사도 되나요?")
    assert res.blocked
    assert len(s.messages()) == before, "차단된 문맥이 다음 턴으로 이어지면 안 된다"


def test_empty_response_is_blocked_not_shown():
    # safety.check("")는 위반이 없어 ok지만, 빈 답변을 그대로 보여줄 수는 없다.
    s = PersonaChat("buffett", METRICS, adapter=EmptyAdapter())
    res = s.start()
    assert res.blocked
    assert res.text == BLOCKED_MESSAGE


# ---- 히스토리와 세션 ---------------------------------------------------------

def test_history_trims_oldest_but_keeps_anchor():
    s = new_session(max_followups=2)
    s.start()
    for i in range(4):
        s.ask(f"질문 {i}")

    msgs = s.messages()
    assert len(msgs) == 6, "앵커 + 첫 해설 + 최근 2쌍"
    assert msgs[0]["content"].startswith("<지표>")
    assert "질문 3" in msgs[-2]["content"], "최신 질문은 남아야 한다"
    assert "질문 0" not in "".join(m["content"] for m in msgs)


def test_switch_persona_resets_history_keeps_metrics():
    s = new_session()
    s.start()
    s.ask("ROIC가 뭔가요?")
    block_before = s.metrics_block()

    s.switch_persona("graham")
    assert s.persona_name == "벤저민 그레이엄"
    assert s.started is False
    assert s.messages() == [{"role": "user", "content": block_before}]
    assert s.metrics_block() == block_before


def test_set_metrics_updates_anchor_and_resets():
    s = new_session()
    s.start()
    s.set_metrics({"PER": 9}, name="Newco")

    msgs = s.messages()
    assert len(msgs) == 1
    assert "Newco" in msgs[0]["content"]
    assert "PER(주가수익비율): 9" in msgs[0]["content"]
    assert "Adobe" not in msgs[0]["content"]


def test_start_twice_does_not_call_model_again():
    adapter = CountingAdapter()
    s = PersonaChat("buffett", METRICS, adapter=adapter)
    first = s.start()
    second = s.start()
    assert adapter.calls == 1
    assert second.text == first.text


def test_unknown_persona_rejected():
    with pytest.raises(ValueError):
        PersonaChat("munger", METRICS)

    s = new_session()
    with pytest.raises(ValueError):
        s.switch_persona("munger")


def test_empty_question_rejected():
    s = new_session()
    s.start()
    with pytest.raises(ValueError):
        s.ask("   ")


# ---- 프롬프트 ---------------------------------------------------------------

def test_chat_rules_only_in_chat_mode():
    single = build_system_prompt("buffett")
    multi = build_system_prompt("buffett", chat_mode=True)
    assert CHAT_RULES not in single
    assert CHAT_RULES in multi
    # 대가별 기준은 두 모드 모두에 남아 있어야 한다.
    assert "5년 평균 ROIC" in single and "5년 평균 ROIC" in multi


def test_criteria_rules_only_when_requested():
    from personas import CRITERIA_RULES

    plain = build_system_prompt("buffett", chat_mode=True)
    with_block = build_system_prompt("buffett", chat_mode=True, with_criteria=True)
    assert CRITERIA_RULES not in plain
    assert CRITERIA_RULES in with_block
    assert "뒤집" in with_block


def test_anchor_includes_criteria_when_judgement_given():
    pytest.importorskip("scores_source")
    import scores_source
    from scores_source import ScoresNotFound

    try:
        data = scores_source.get_data()
    except ScoresNotFound:
        pytest.skip("scores.json이 없습니다")

    ticker = data.tickers()[0]
    s = PersonaChat(
        "buffett",
        company=data.company(ticker),
        judgement=data.judgement(ticker, "buffett"),
        criteria_spec=data.styles["buffett"].criteria,
        adapter=MockAdapter(),
    )
    assert s.messages()[0]["content"].startswith("<지표>")
    assert "<기준판정>" in s.anchor()
    assert s.criteria_block() is not None

    s.switch_persona("graham")
    assert s.persona_key == "graham"
    assert s.started is False
    assert "그레이엄" in s.criteria_block()
    # 페르소나를 바꾸면 기준판정 앵커도 갈아야 한다
    assert s.judgement.style == "graham"


def test_third_person_rule_present():
    prompt = build_system_prompt("buffett", chat_mode=True)
    assert "1인칭" in prompt
    assert "이 설명은 교육용이며 투자 조언이 아닙니다." in prompt


# ---- 단발 해설 회귀 ----------------------------------------------------------

def test_single_shot_explain_still_works():
    res = explain("buffett", METRICS, name="Adobe")
    assert res.verdict == safety.OK
    assert res.regenerated is False
    assert "교육용" in res.text
