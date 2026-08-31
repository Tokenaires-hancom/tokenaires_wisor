"""페르소나 멀티턴 대화 코어.

HTTP 프레임워크에 의존하지 않는다. cli.py와 server.py가 같은 코어를 쓴다.

대화 구조:
    [system]    공통 규칙 + 대가 프롬프트 + 채점 기준 + CRITERIA_RULES + CHAT_RULES
    [user]      <지표> 블록 + <기준판정> 블록   ← 앵커. 절대 잘리지 않는다.
    [assistant] 첫 해설
    [user]      후속 질문 …

채점하지 않는 대가(personas의 kind="checklist")는 앵커가 다르다. 지표도 기준 판정도
없으므로 <회사> 블록 하나만 싣고, 첫 응답은 해설이 아니라 확인 질문 목록이다.

    [system]    확인질문 규칙 + 대가 프롬프트 + CHECKLIST_CHAT_RULES
    [user]      <회사> 블록                    ← 앵커
    [assistant] 확인 질문 목록

지표를 넣는 길이 둘이다.

- 손으로 넣기: PersonaChat("buffett", {"PER": 18, ...}, name="Adobe")
- 팀 데이터:   PersonaChat("buffett", company=..., judgement=...)
               (scores_source에서 꺼낸 것. 기준 판정까지 함께 실린다.)
"""
from __future__ import annotations

from dataclasses import dataclass

from explain import (OK, REGENERATE, MockAdapter, format_company_block,
                     format_criteria_block, format_metrics_block, generate)
from personas import PERSONAS, build_system_prompt, is_checklist


@dataclass
class ChatReply:
    persona: str
    text: str
    verdict: str        # OK / REGENERATE
    regenerated: bool

    @property
    def blocked(self) -> bool:
        return self.verdict == REGENERATE


class PersonaChat:
    """한 페르소나와의 대화 세션 하나.

    지표는 세션 내내 고정이고, 페르소나는 대화 중 바꿀 수 있다(히스토리는 초기화).
    """

    def __init__(self, persona_key: str, metrics: dict | None = None,
                 name: str | None = None, adapter=None, max_followups: int = 8,
                 company=None, judgement=None, criteria_spec=None):
        if persona_key not in PERSONAS:
            raise ValueError(
                f"unknown persona: {persona_key} (choose from {list(PERSONAS)})")
        if metrics is None and company is None:
            raise ValueError("metrics 또는 company 중 하나는 있어야 합니다.")

        self.persona_key = persona_key
        self.adapter = adapter or MockAdapter()
        self.max_followups = max_followups
        self.company = company
        self.metrics = dict(metrics) if metrics is not None else None
        self.name = name if company is None else company.name
        # 채점하지 않는 대가는 판정을 쓰지 않는다. 넘어와도 들고 있지 않는다 —
        # 남겨 두면 페르소나를 되돌릴 때 남의 관점의 판정이 되살아난다.
        checklist = is_checklist(persona_key)
        self._judgement = None if checklist else judgement
        self._criteria_spec = () if checklist else tuple(criteria_spec or ())
        self._opening: str | None = None
        self._followups: list[dict] = []
        self._rebuild_anchor()

    # ---- 조회 --------------------------------------------------------------

    @property
    def persona_name(self) -> str:
        return PERSONAS[self.persona_key]["name"]

    @property
    def started(self) -> bool:
        return self._opening is not None

    @property
    def judgement(self):
        return self._judgement

    @property
    def ticker(self) -> str | None:
        return self.company.ticker if self.company is not None else None

    def messages(self) -> list[dict]:
        """지금까지의 대화. HTTP 계층이 그대로 직렬화해 쓸 수 있다."""
        return self._build_messages()

    def metrics_block(self) -> str | None:
        """<지표> 블록. 채점하지 않는 대가와의 대화에는 없다."""
        return self._metrics_block

    def company_block(self) -> str | None:
        """<회사> 블록. 채점하는 대가와의 대화에는 없다."""
        return self._company_block

    def criteria_block(self) -> str | None:
        return self._criteria_block

    def anchor(self) -> str:
        """대화 첫 user 메시지 전문.

        채점하는 대가는 지표와 기준 판정이, 채점하지 않는 대가는 <회사> 블록이 들어간다.
        """
        return self._anchor

    # ---- 대화 --------------------------------------------------------------

    def start(self) -> ChatReply:
        """첫 해설을 만든다. 이미 시작했으면 기존 해설을 그대로 돌려준다."""
        if self._opening is not None:
            return ChatReply(self.persona_key, self._opening, OK, False)

        reply = self._generate(self._build_messages())
        if not reply.blocked:
            self._opening = reply.text
        return reply

    def ask(self, question: str) -> ChatReply:
        """후속 질문. 차단된 답변은 히스토리에 남기지 않는다."""
        question = question.strip()
        if not question:
            raise ValueError("빈 질문입니다.")
        if self._opening is None:
            self.start()

        reply = self._generate(self._build_messages(question))
        # 차단된 답변을 히스토리에 넣으면 오염된 문맥이 다음 턴에 그대로 이어진다.
        if not reply.blocked:
            self._followups.append({"role": "user", "content": question})
            self._followups.append({"role": "assistant", "content": reply.text})
            self._trim()
        return reply

    # ---- 세션 조작 ----------------------------------------------------------

    def switch_persona(self, persona_key: str, judgement=None,
                       criteria_spec=None) -> None:
        """페르소나 교체. 지표는 유지하고 히스토리는 버린다.

        앞 대가의 기준·말투가 남은 채로 다른 대가를 설명하면 관점이 섞인다.

        기준 판정은 페르소나마다 다르므로 새 판정으로 갈아야 한다. company가 있으면
        직접 찾아오고, 없으면 호출자가 judgement를 넘겨야 한다.
        """
        if persona_key not in PERSONAS:
            raise ValueError(
                f"unknown persona: {persona_key} (choose from {list(PERSONAS)})")

        if is_checklist(persona_key):
            # 판정을 찾아오면 안 된다. scores.json에 이 관점의 스타일 자체가 없어
            # data.judgement()가 UnknownStyle로 터진다. 앞 대가의 판정을 그대로
            # 들고 가는 것도 안 된다 — 다른 관점의 채점 결과가 된다.
            judgement, criteria_spec = None, ()
            self._judgement = None
            self._criteria_spec = ()
        elif judgement is None and self.company is not None:
            import scores_source  # 손으로 넣는 경로에서는 필요 없어 여기서 임포트한다

            data = scores_source.get_data()
            judgement = data.judgement(self.company.ticker, persona_key)
            criteria_spec = data.styles[persona_key].criteria
        elif judgement is None and self._judgement is not None:
            raise ValueError(
                "기준 판정이 있는 세션은 페르소나를 바꿀 때 새 judgement가 필요합니다."
            )

        self.persona_key = persona_key
        if judgement is not None:
            self._judgement = judgement
            self._criteria_spec = tuple(criteria_spec or ())
        self._rebuild_anchor()
        self.reset()

    def set_metrics(self, metrics: dict, name: str | None = None) -> None:
        """손으로 넣은 지표 교체. 앵커가 바뀌므로 히스토리도 버린다."""
        self.company = None
        self.metrics = dict(metrics)
        self.name = name
        self._judgement = None
        self._criteria_spec = ()
        self._rebuild_anchor()
        self.reset()

    def set_company(self, company, judgement=None, criteria_spec=None) -> None:
        """종목 교체. 지표와 기준 판정이 함께 바뀐다."""
        self.company = company
        self.metrics = None
        self.name = company.name
        checklist = is_checklist(self.persona_key)
        self._judgement = None if checklist else judgement
        self._criteria_spec = () if checklist else tuple(criteria_spec or ())
        self._rebuild_anchor()
        self.reset()

    def reset(self) -> None:
        self._opening = None
        self._followups = []

    # ---- 내부 --------------------------------------------------------------

    def _rebuild_anchor(self) -> None:
        """앵커를 다시 만든다.

        채점하는 대가는 <지표> 블록(+ 있으면 <기준판정>)을 받는다. 채점하지 않는
        대가는 <회사> 블록만 받는다. 판정에 쓰지도 않을 지표를 함께 실으면 모델이
        그 숫자로 판정하려 들기 때문이다.
        """
        if is_checklist(self.persona_key):
            self._metrics_block = None
            self._criteria_block = None
            self._company_block = format_company_block(
                self.name, self.ticker,
                self.company.sector if self.company is not None else None)
            self._anchor = self._company_block
            return

        self._company_block = None
        if self.company is not None:
            self._metrics_block = self.company.metrics_block()
        else:
            self._metrics_block = format_metrics_block(self.metrics, self.name)
        self._criteria_block = (
            format_criteria_block(self._judgement) if self._judgement is not None
            else None
        )
        self._anchor = (
            f"{self._metrics_block}\n\n{self._criteria_block}"
            if self._criteria_block else self._metrics_block
        )

    def _build_messages(self, question: str | None = None) -> list[dict]:
        msgs: list[dict] = [{"role": "user", "content": self._anchor}]
        if self._opening is not None:
            msgs.append({"role": "assistant", "content": self._opening})
        msgs.extend(self._followups)
        if question is not None:
            msgs.append({"role": "user", "content": question})
        return msgs

    def _generate(self, messages: list[dict]) -> ChatReply:
        system = build_system_prompt(
            self.persona_key, chat_mode=True,
            criteria_spec=self._criteria_spec,
            with_criteria=self._criteria_block is not None,
        )
        text, verdict, regenerated = generate(self.adapter, system, messages)
        return ChatReply(self.persona_key, text, verdict, regenerated)

    def _trim(self) -> None:
        """오래된 (질문, 답변) 쌍부터 버린다. 앵커와 첫 해설은 항상 남는다."""
        limit = self.max_followups * 2
        if len(self._followups) > limit:
            self._followups = self._followups[-limit:]


if __name__ == "__main__":
    import sys

    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8")
        except (AttributeError, OSError):
            pass

    # 팀 데이터에서 한 종목을 꺼내 앵커가 어떻게 조립되는지 보여준다(mock 응답).
    import scores_source

    data = scores_source.get_data()
    ticker = sys.argv[1] if len(sys.argv) > 1 else data.tickers()[0]
    persona = sys.argv[2] if len(sys.argv) > 2 else "buffett"

    session = PersonaChat(
        persona,
        company=data.company(ticker),
        judgement=data.judgement(ticker, persona),
        criteria_spec=data.styles[persona].criteria,
    )
    print(session.anchor())
    print("\n=== 첫 해설(mock) ===")
    print(session.start().text)
