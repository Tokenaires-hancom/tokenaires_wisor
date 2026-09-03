"""멀티턴 챗봇 검증 — 키 없이, 과금 없이 돈다.

    cd persona_explain
    pytest -q

MockAdapter는 늘 정상 응답을 주므로 재생성 분기를 발동시킬 수 없다.
그래서 경로별로 가짜 어댑터를 따로 두고 각 분기를 강제한다.
"""

import pytest

from chat import FREE_CHAT_OPENING, PersonaChat
from explain import OK, BLOCKED_MESSAGE, MockAdapter, explain
from personas import CHAT_RULES, FREE_CHAT_RULES, build_system_prompt

METRICS = {
    "PBR": 1.2,               # 그레이엄 기준 충족(≤1.5)
    "PER": 18,                # 미충족(≤15)
    "ROIC_5y_avg": 0.14,      # 버핏 기준 충족(≥0.12)
    "netDebt_to_EBITDA": 3.1, # 미충족(≤2.5)
    "interest_coverage": None,  # 판단불가
}

CLEAN_ANSWER = "PBR 1.2는 그레이엄 기준(1.5 이하)을 충족합니다."


# ---- 가짜 어댑터 -------------------------------------------------------------

class RecoverAdapter:
    """temperature 0이면 빈 응답, 올라가면 정상 답변. 호출 온도를 기록한다."""

    def __init__(self):
        self.calls = []

    def chat(self, system, messages, temperature=0.0):
        self.calls.append(temperature)
        return "" if temperature == 0.0 else CLEAN_ANSWER


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


class SuccessfulCallsThenEmptyAdapter:
    """지정한 호출 수까지 답한 뒤 빈 응답만 돌려준다."""

    def __init__(self, successful_calls: int):
        self.successful_calls = successful_calls
        self.calls = 0

    def chat(self, system, messages, temperature=0.0):
        self.calls += 1
        return CLEAN_ANSWER if self.calls <= self.successful_calls else ""


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

def test_retry_raises_temperature():
    # temperature 0을 유지한 채 재호출하면 같은 답이 나와 재생성이 무의미해진다.
    adapter = RecoverAdapter()
    s = PersonaChat("graham", METRICS, adapter=adapter)
    res = s.start()

    assert res.regenerated is True
    assert not res.blocked
    assert res.verdict == OK
    assert adapter.calls == [0.0, 0.3], "1차는 온도 0, 2차만 0.3"


# ---- 차단과 오염 방지 --------------------------------------------------------

def test_blocked_opening_not_in_history():
    s = PersonaChat("lynch", METRICS, adapter=EmptyAdapter())
    s.start()
    assert s.messages() == [{"role": "user", "content": s.metrics_block()}]
    assert s.started is False


def test_blocked_followup_not_in_history():
    s = new_session()
    s.start()
    before = len(s.messages())
    s.adapter = EmptyAdapter()
    res = s.ask("이 지표는 무엇을 뜻하나요?")
    assert res.blocked
    assert len(s.messages()) == before, "차단된 문맥이 다음 턴으로 이어지면 안 된다"


def test_empty_response_is_blocked_not_shown():
    # 빈 답변을 그대로 보여줄 수는 없다. 재생성 후에도 비면 안내 문구로 끝난다.
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


def test_first_person_rule_present():
    """대가가 자기 목소리로 말한다."""
    prompt = build_system_prompt("buffett", chat_mode=True)
    assert "1인칭으로 말한다" in prompt
    assert "자기를 3인칭으로" in prompt


# ---- 종목 없는 자유 대화 ----------------------------------------------------

def test_free_chat_requires_explicit_mode():
    with pytest.raises(ValueError, match="metrics 또는 company"):
        PersonaChat("buffett")
    with pytest.raises(ValueError, match="함께 넣을 수 없습니다"):
        PersonaChat("buffett", METRICS, free_chat=True)


def test_free_chat_uses_its_own_anchor_and_prompt():
    s = PersonaChat("buffett", adapter=MockAdapter(), free_chat=True)
    prompt = build_system_prompt("buffett", chat_mode=True, free_chat=True)

    assert s.free_chat is True
    assert s.anchor().startswith("<대화맥락>")
    assert "<지표>" not in s.anchor()
    assert "<회사>" not in s.anchor()
    assert s.metrics_block() is None
    assert s.company_block() is None
    assert FREE_CHAT_RULES in prompt
    assert prompt.endswith(FREE_CHAT_RULES)
    assert CHAT_RULES not in prompt
    assert "특정 회사의 수치나 현재 상황을 물으면 종목을 선택" in prompt
    assert "대가 본문에 적힌 투자 기준 수치는" in prompt
    assert "특정 회사의 실제 수치나 현재 시장 수치" in prompt
    assert "역사적 일화, 전기, 실제 투자 행동" in prompt
    assert "확인되지 않은 기억임을 밝힌다" in prompt
    assert "[숫자 규칙]" not in prompt
    assert "[내 방식은 채점하지 않는다]" not in prompt


def test_every_persona_free_chat_prompt_ends_with_context_rules():
    from personas import PERSONAS

    for key in PERSONAS:
        prompt = build_system_prompt(key, chat_mode=True, free_chat=True)
        assert prompt.endswith(FREE_CHAT_RULES), key
        assert CHAT_RULES not in prompt, key
        assert "[내 방식은 채점하지 않는다]" not in prompt, key


def test_free_chat_calls_model_only_for_the_first_real_question():
    adapter = CountingAdapter()
    s = PersonaChat("buffett", adapter=adapter, free_chat=True)

    opening = s.start()
    assert opening.text == FREE_CHAT_OPENING
    assert adapter.calls == 0

    reply = s.ask("복리의 핵심은 무엇인가요?")
    assert reply.verdict == OK
    assert adapter.calls == 1
    assert s.messages()[-2]["content"] == "복리의 핵심은 무엇인가요?"


def test_free_chat_switches_persona_without_adding_company_context():
    s = PersonaChat("buffett", adapter=MockAdapter(), free_chat=True)
    s.start()
    s.ask("무엇을 가장 먼저 보나요?")

    s.switch_persona("fisher")

    assert s.free_chat is True
    assert s.persona_key == "fisher"
    assert s.judgement is None
    assert s.anchor().startswith("<대화맥락>")
    assert s.messages() == [{"role": "user", "content": s.anchor()}]
    assert s.start().text == FREE_CHAT_OPENING


def test_blocked_persona_switch_restores_previous_history():
    adapter = SuccessfulCallsThenEmptyAdapter(successful_calls=2)
    s = PersonaChat("buffett", METRICS, adapter=adapter)
    s.start()
    s.ask("첫 질문")
    previous_messages = s.messages()

    reply = s.switch_persona_and_start("graham")

    assert reply.blocked is True
    assert reply.persona == "buffett"
    assert s.persona_key == "buffett"
    assert s.messages() == previous_messages


# ---- 단발 해설 회귀 ----------------------------------------------------------

def test_single_shot_explain_still_works():
    res = explain("buffett", METRICS, name="Adobe")
    assert res.verdict == OK
    assert res.regenerated is False
    assert "(mock 해설)" in res.text


# ---- 채점하지 않는 대가 ------------------------------------------------------
#
# 지표도 기준 판정도 없다. 앵커와 규칙이 갈리는 지점을 전부 잠근다.

CHECKLIST_PERSONA = "fisher"


def checklist_session(persona: str = CHECKLIST_PERSONA, **kwargs) -> PersonaChat:
    kwargs.setdefault("adapter", MockAdapter())
    kwargs.setdefault("name", "Adobe")
    return PersonaChat(persona, METRICS, **kwargs)


def test_checklist_anchor_drops_metrics():
    s = checklist_session()
    assert s.anchor().startswith("<회사>")
    assert "<지표>" not in s.anchor()
    assert "PBR" not in s.anchor()
    assert s.metrics_block() is None
    assert s.company_block() is not None
    assert s.messages() == [{"role": "user", "content": s.anchor()}]


def test_checklist_claims_must_carry_a_source_label():
    """회사 얘기는 허용하되 근거 없이 단정하지 못하게 한다.

    지표가 없는 관점이라 모델에게 남는 재료가 사전학습 기억뿐이다. 그 기억을 막는
    대신, 어디서 나온 말인지 붙이게 해 사용자가 걸러낼 수 있게 한다.
    """
    prompt = build_system_prompt(CHECKLIST_PERSONA, chat_mode=True)
    assert "이 회사에 대해 아는 것을 말해도 된다" in prompt
    assert "근거 없이 단정하지 않는다" in prompt
    for label in ("[주어진 것]", "[업종 통례]", "[내 기억]"):
        assert label in prompt, label
    # 표시가 첫 응답에서만 살아 있으면 소용이 없다
    assert "후속 답변에서도" in prompt


def test_checklist_forbids_fabricated_citations():
    """지어낸 인용은 확인된 것처럼 보여 표시 없는 기억보다 위험하다.

    모델은 진짜 출처를 확인할 수 없다. 출처를 자유롭게 쓰게 두면 문서 이름과 쪽수를
    만들어 낸다. 그래서 출처를 세 종류로 가두고 그 밖을 막는다.
    """
    prompt = build_system_prompt(CHECKLIST_PERSONA, chat_mode=True)
    assert "붙일 수 있는 출처는 셋뿐이다" in prompt
    assert "지어내어 인용하지 않는다" in prompt
    # 날짜도 출처도 없는 숫자는 화면의 기준일 표기와 어긋난다
    assert "구체적 수치는 [내 기억]으로도 말하지 않는다" in prompt


def test_checklist_memory_claims_come_with_a_way_to_check():
    prompt = build_system_prompt(CHECKLIST_PERSONA, chat_mode=True)
    assert "확인되지 않은 기억이라는 것" in prompt
    assert "사용자가 직접 확인할 곳" in prompt
    # 허용과 금지를 예시로 나란히 둬야 경계가 흐려지지 않는다
    assert "쓴다   —" in prompt
    assert "안 쓴다 —" in prompt


def test_checklist_items_are_not_capped():
    """본문 목록은 출발점이다. 여기가 잠기면 종목이 달라도 같은 답이 나온다."""
    prompt = build_system_prompt(CHECKLIST_PERSONA, chat_mode=True)
    assert "출발점이지 전부가 아니다" in prompt
    assert "새로 만들어도 된다" in prompt
    # 개수·길이를 못 박던 문구가 남아 있으면 안 된다
    assert "새로 만들지 않는다" not in prompt
    assert "4개에서 다섯 개까지만" not in prompt
    assert "마무리는 두 문장으로" not in prompt


def test_checklist_prompt_drops_metric_rules():
    prompt = build_system_prompt(CHECKLIST_PERSONA, chat_mode=True)
    assert "[숫자 규칙]" not in prompt
    assert "<지표> 블록의 숫자만으로" not in prompt
    assert "지표마다:" not in prompt


def test_checklist_chat_rules_only_in_chat_mode():
    from personas import CHECKLIST_CHAT_RULES

    plain = build_system_prompt(CHECKLIST_PERSONA)
    talking = build_system_prompt(CHECKLIST_PERSONA, chat_mode=True)
    assert CHECKLIST_CHAT_RULES not in plain
    assert CHECKLIST_CHAT_RULES in talking
    # 지표를 근거로 삼으라는 원본 대화 규칙이 섞이면 안 된다
    assert CHAT_RULES not in talking


def test_checklist_ignores_criteria_arguments():
    spec = [{"label": "자본 효율성", "detail": "5년 평균 ROIC >= 12%", "weight": 3}]
    prompt = build_system_prompt(CHECKLIST_PERSONA, criteria_spec=spec,
                                 with_criteria=True)
    assert "채점에 실제로 쓰인 기준" not in prompt
    assert "<기준판정>" not in prompt


def test_checklist_session_drops_judgement_passed_in():
    s = PersonaChat(CHECKLIST_PERSONA, METRICS, name="Adobe", adapter=MockAdapter(),
                    judgement=object(), criteria_spec=[{"label": "x", "detail": "y"}])
    assert s.judgement is None
    assert s.criteria_block() is None


def test_single_shot_explain_rejects_checklist_persona():
    with pytest.raises(ValueError, match="채점하지 않는"):
        explain(CHECKLIST_PERSONA, METRICS, name="Adobe")


def test_every_persona_builds_a_prompt():
    from personas import PERSONAS

    for key in PERSONAS:
        prompt = build_system_prompt(key, chat_mode=True)
        assert "1인칭으로 말한다" in prompt


def test_switch_between_score_and_checklist_personas():
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
    assert "<기준판정>" in s.anchor()

    # scores.json에 이 관점의 스타일이 아예 없다. 판정을 찾으러 가면 UnknownStyle이다.
    s.switch_persona(CHECKLIST_PERSONA)
    assert s.anchor().startswith("<회사>")
    assert ticker in s.anchor()
    assert s.judgement is None
    assert s.criteria_block() is None

    # 되돌아오면 판정이 다시 붙되, 앞 대가의 것이 아니라 새 관점의 것이어야 한다
    s.switch_persona("graham")
    assert "<기준판정>" in s.anchor()
    assert s.judgement.style == "graham"


def test_switch_personas_without_company():
    """손으로 지표를 넣은 세션(cli.py 경로)에서도 관점을 오갈 수 있어야 한다.

    company가 없으면 판정을 찾아올 곳이 없다. 채점하지 않는 대가로 시작하면
    _judgement가 비어 있어, 되돌아올 때 "새 judgement가 필요하다"는 가드에
    걸리지 않고 지표 앵커로 돌아가야 한다.
    """
    s = checklist_session()
    assert s.anchor().startswith("<회사>")

    s.switch_persona("graham")
    assert s.anchor().startswith("<지표>")
    assert s.criteria_block() is None

    s.switch_persona("marks")
    assert s.anchor().startswith("<회사>")

    s.switch_persona("buffett")
    assert s.anchor().startswith("<지표>")
    assert s.judgement is None
