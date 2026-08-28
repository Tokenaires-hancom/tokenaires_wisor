"""페르소나 지표 해설 오케스트레이터.

흐름: 지표(dict) -> <지표> 블록 조립 -> 페르소나 프롬프트 + LLM 호출
      -> 안전 필터 -> (block이면 1회 재생성) -> 해설 텍스트.

LLM 어댑터는 교체 가능. 기본은 키 없이 도는 mock.
실제 모델은 OpenAIAdapter (OPENAI_API_KEY 환경변수 또는 같은 폴더의 .env 필요).

멀티턴 대화(chat.py)도 이 모듈의 어댑터와 generate()를 그대로 쓴다.
"""
from __future__ import annotations

import os
import re
from dataclasses import dataclass

from personas import (PERSONAS, SCORE_PERSONAS, build_system_prompt,
                      is_checklist)
import safety

# 지표 필드 → 사람이 읽을 라벨 (해설 프롬프트 가독성용)
#
# 이 표는 손으로 지표를 넣는 경로(cli.py)에서만 쓴다. scores.json에서 온 지표는
# 팀 화면과 같은 라벨·표기를 써야 하므로 scores_source.METRIC_SPEC을 따른다.
METRIC_LABELS = {
    "PBR": "PBR(주가순자산비율)",
    "PER": "PER(주가수익비율)",
    "PEG": "PEG(성장 대비 가격)",
    "ROIC_5y_avg": "5년 평균 ROIC",
    "magic_formula_ROC": "마법공식 자본수익률",
    "FCF_margin": "FCF 마진",
    "FCF_yield": "FCF 수익률",
    "netDebt_to_EBITDA": "순부채/EBITDA",
    "revenue_CAGR_5y": "매출 5년 CAGR",
    "interest_coverage": "이자 감당력(영업이익/이자비용)",
    "earnings_growth": "이익 성장률",
    "current_ratio": "유동비율",
    "debt_to_equity": "부채/자기자본",
    "EV_EBIT": "EV/EBIT",
    "earnings_yield": "이익수익률(EBIT/기업가치)",
}

# 값이 없을 때 프롬프트에 쓰는 표기. 팀 화면(lib/format.ts)과 같은 문구를 쓴다.
NO_VALUE = "정보 없음"

# pass/fail/unknown → 프롬프트에서 쓰는 한국어. LLM이 영어 상태값을 제 나름대로
# 번역하다 뜻이 흔들리는 것을 막는다.
STATUS_LABELS = {
    "pass": "충족",
    "fail": "미충족",
    "unknown": "판정불가",
}

BLOCKED_MESSAGE = "안전 기준 위반으로 해설을 제공할 수 없습니다."

# 재생성은 temperature를 올려야 의미가 있다. 0을 유지하면 같은 답이 다시 나와
# 재시도가 반드시 같은 이유로 또 걸린다.
#
# temperature를 아예 받지 않는 모델이면 어댑터가 이 값을 버린다. 그때는 모델
# 기본값의 흔들림과 _RETRY_HINT가 대신 차이를 만든다.
RETRY_TEMPERATURE = 0.3

_RETRY_HINT = """

[재생성 지시]
직전 답변이 금지 표현(매수·매도·목표가·저평가·고평가·가격 전망)을 포함해 차단되었다.
같은 내용을 그 표현들 없이 다시 작성하라. 지표 값과 기준은 그대로 둔다.
"""


def render_metrics_block(pairs, name: str | None = None,
                         header: list[str] | None = None) -> str:
    """(라벨, 표시값) 목록 → <지표> 블록.

    표시값은 이미 사람이 읽을 문자열로 만들어져 있어야 한다. 값이 없으면 None을
    넣는다. scores.json 경로는 화면과 같은 표기로 미리 만들어 넘기고, 손으로
    넣는 경로는 format_metrics_block이 대신 만들어 준다.
    """
    lines = []
    if name:
        lines.append(f"종목명(표시용): {name}")
    lines.extend(header or [])
    for label, value in pairs:
        lines.append(f"- {label}: {NO_VALUE if value is None else value}")
    return "<지표>\n" + "\n".join(lines) + "\n</지표>"


def format_metrics_block(metrics: dict, name: str | None = None) -> str:
    """내부 키 dict → <지표> 블록. 손으로 넣은 지표(cli.py)와 테스트용."""
    pairs = [(label, metrics[key])
             for key, label in METRIC_LABELS.items() if key in metrics]
    return render_metrics_block(pairs, name)


# 확인질문 대가의 앵커에 함께 싣는 못박기. 같은 취지가 시스템 프롬프트에도 있지만,
# 앵커는 대화 내내 첫 user 메시지로 남아 규칙보다 가까이 읽힌다.
_NO_SCORE_NOTE = [
    "이 관점은 재무 지표로 채점하지 않는다. 그래서 지표도 기준 판정도 주지 않는다.",
    "이 블록에 적힌 것 외에 이 회사에 대해 말할 때는 어디서 나온 말인지 함께 밝힌다.",
]


def format_company_block(name: str | None = None, ticker: str | None = None,
                         sector: str | None = None) -> str:
    """<회사> 블록. 채점하지 않는 대가와의 대화에서 <지표> 블록을 대신한다.

    숫자를 싣지 않는다. 이 관점은 지표로 판정하지 않는데 지표를 함께 실으면
    모델이 그 숫자로 판정하려 들기 때문이다.
    """
    lines = []
    if name or ticker:
        label = f"{name} ({ticker})" if name and ticker else (name or ticker)
        lines.append(f"종목명(표시용): {label}")
    else:
        lines.append("종목이 지정되지 않았다. 특정 회사를 가정하지 않는다.")
    if sector:
        lines.append(f"업종: {sector}")
    lines.extend(_NO_SCORE_NOTE)
    return "<회사>\n" + "\n".join(lines) + "\n</회사>"


def format_criteria_block(judgement) -> str:
    """페르소나별 기준 판정 → <기준판정> 블록.

    팀 파이프라인이 이미 채점해 둔 결과를 그대로 싣는다. 임계값이 여기 실려 있으므로
    프롬프트에 적힌 기준과 화면의 기준이 어긋날 여지가 없다.

    judgement는 scores_source.Judgement 또는 같은 필드를 가진 객체.
    """
    head = f"관점: {judgement.persona_name} ({judgement.model_version})"
    lines = [head, f"데이터 신뢰도: {judgement.data_confidence}"]

    if judgement.unscorable_reason:
        lines.append(f"채점 제외 사유: {judgement.unscorable_reason}")

    if not judgement.criteria:
        lines.append("이 종목은 이 관점의 채점 대상이 아닙니다. "
                     "기준별 판정 결과가 없으므로 기준 충족 여부를 말하지 않는다.")
        return "<기준판정>\n" + "\n".join(lines) + "\n</기준판정>"

    summary = f"종합: {judgement.total}개 기준 중 {judgement.passed}개 충족"
    if judgement.score is not None:
        summary += f" (점수 {judgement.score})"
    if judgement.total_judged != judgement.total:
        summary += f" — 판정 가능한 기준은 {judgement.total_judged}개"
    lines.append(summary)

    if judgement.rank is not None:
        rank_line = f"유니버스 내 순위: {judgement.rank}위"
        comp = judgement.rank_components or {}
        if comp:
            rank_line += (f" (사업의 질 {comp.get('quality')}위, "
                          f"가격 {comp.get('value')}위)")
        lines.append(rank_line)

    for cr in judgement.criteria:
        status = STATUS_LABELS.get(cr.get("status"), cr.get("status"))
        lines.append(
            f"- [{status}] {cr.get('label')} | 기준: {cr.get('detail')} "
            f"| 화면 문구: {cr.get('message')}"
        )
    return "<기준판정>\n" + "\n".join(lines) + "\n</기준판정>"


# ---- LLM 어댑터 -------------------------------------------------------------
#
# 어댑터는 chat(system, messages, temperature) 하나만 구현하면 된다.
# complete()는 1턴짜리 특수 케이스라 chat() 위에 얹는다.

def load_dotenv_file() -> None:
    """같은 폴더의 .env를 환경변수로 올린다. python-dotenv가 없으면 조용히 넘어간다."""
    try:
        from dotenv import load_dotenv
    except ImportError:
        return
    load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))


class MockAdapter:
    """키 없이 도는 더미. 주어진 숫자만 기계적으로 나열한다(환각 없음)."""

    name = "mock"

    def chat(self, system: str, messages: list[dict], temperature: float = 0.0) -> str:
        last_user = next(
            (m["content"] for m in reversed(messages) if m["role"] == "user"), ""
        )
        metric_lines = [l for l in last_user.splitlines() if l.startswith("- ")]
        if metric_lines:
            head = "다음은 제공된 지표에 대한 설명입니다."
            body = "\n".join(f"{l} — (mock 해설)" for l in metric_lines)
        else:
            head = "주어진 블록 범위 안에서만 설명합니다."
            body = f"- 질문 \"{last_user.strip()}\" — (mock 후속 답변)"
        return f"{head}\n{body}\n\n이 설명은 교육용이며 투자 조언이 아닙니다."

    def complete(self, system: str, user: str) -> str:
        return self.chat(system, [{"role": "user", "content": user}])


OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
OPENROUTER_DEFAULT_MODEL = "openai/gpt-5.4-mini"
OPENAI_DEFAULT_MODEL = "gpt-4o-mini"


class OpenAIAdapter:
    """OpenAI 호환 API 호출. 기본 경로는 OpenRouter.

    OPENROUTER_API_KEY가 있으면 OpenRouter로, OPENAI_API_KEY만 있으면 OpenAI로 붙는다.
    둘 다 같은 chat.completions 규격이라 코드는 하나로 충분하다.

    기본 temperature=0으로 숫자를 지어내지 않게 한다. 다만 모델에 따라
    temperature나 max_tokens를 아예 받지 않는 경우가 있어, 거부당하면 그 파라미터를
    빼고 다시 부른다(_adapt).
    """

    name = "openai"

    def __init__(self, model: str | None = None, max_tokens: int = 1500,
                 api_key: str | None = None, base_url: str | None = None):
        from openai import OpenAI  # 지연 임포트: mock만 쓸 땐 미설치여도 됨

        load_dotenv_file()
        key, base = api_key, base_url or os.getenv("PERSONA_BASE_URL")
        if key is None:
            if os.getenv("OPENROUTER_API_KEY"):
                key = os.getenv("OPENROUTER_API_KEY")
                base = base or OPENROUTER_BASE_URL
            else:
                key = os.getenv("OPENAI_API_KEY")
        if not key:
            raise RuntimeError(
                "API 키가 없습니다. .env에 OPENROUTER_API_KEY(또는 OPENAI_API_KEY)를 "
                "설정하세요."
            )
        headers = {}
        if base and "openrouter.ai" in base:
            headers["HTTP-Referer"] = os.getenv(
                "OPENROUTER_HTTP_REFERER", "http://127.0.0.1:8000")
            headers["X-OpenRouter-Title"] = os.getenv(
                "OPENROUTER_TITLE", "persona-explain")
        client_kw = {"api_key": key}
        if base:
            client_kw["base_url"] = base
        if headers:
            client_kw["default_headers"] = headers
        self._client = OpenAI(**client_kw)
        self._base_url = base
        self.name = "openrouter" if base and "openrouter.ai" in base else "openai"
        self._model = model or os.getenv("PERSONA_MODEL") or (
            OPENROUTER_DEFAULT_MODEL if (base and "openrouter.ai" in base)
            else OPENAI_DEFAULT_MODEL
        )
        self._max_tokens = max_tokens
        # 모델이 거부하면 순서대로 물러난다: max_tokens → max_completion_tokens → 생략
        self._token_param: str | None = "max_tokens"
        self._send_temperature = True

    @property
    def model(self) -> str:
        return self._model

    @property
    def base_url(self) -> str | None:
        return self._base_url

    def _adapt(self, exc: Exception) -> bool:
        """모델이 거부한 파라미터를 알아보고 빼거나 바꾼다. 바꿨으면 True."""
        msg = str(exc).lower()
        if "temperature" in msg and self._send_temperature:
            self._send_temperature = False
            return True
        if self._token_param and self._token_param.lower() in msg:
            self._token_param = (
                "max_completion_tokens" if self._token_param == "max_tokens" else None
            )
            return True
        return False

    def chat(self, system: str, messages: list[dict], temperature: float = 0.0) -> str:
        while True:
            kwargs: dict = {
                "model": self._model,
                "messages": [{"role": "system", "content": system}, *messages],
            }
            if self._token_param:
                kwargs[self._token_param] = self._max_tokens
            if self._send_temperature:
                kwargs["temperature"] = temperature
            try:
                resp = self._client.chat.completions.create(**kwargs)
            except Exception as exc:  # 파라미터 거부만 걸러내고 나머지는 그대로 올린다
                if self._adapt(exc):
                    continue
                raise
            break

        choice = resp.choices[0]
        # 콘텐츠 필터에 걸리면 빈 문자열 → check_output이 REGENERATE로 본다
        if choice.finish_reason == "content_filter":
            return ""
        return choice.message.content or ""

    def complete(self, system: str, user: str) -> str:
        return self.chat(system, [{"role": "user", "content": user}])


# ---- 출력 정돈 --------------------------------------------------------------
#
# 연습장(playground.html)과 터미널(cli.py)은 응답을 raw text로 그린다
# (textContent + white-space: pre-wrap). 모델이 제멋대로 붙이는 마크다운
# 표식(**굵게**), 굽은따옴표, 줄 끝 하드브레이크 공백은 화면에 글자 그대로
# 남아 지저분해 보인다. 화살표(→)·불릿(-)은 raw text로도 멀쩡하므로 건드리지 않는다.
#
# 프롬프트로도 마크다운을 자제시키지만 모델이 늘 따르진 않으므로, 여기서
# 결정적으로 걷어낸다.

_CURLY_QUOTES = {"“": '"', "”": '"', "‘": "'", "’": "'"}


def tidy(text: str) -> str:
    """화면 표시용 정돈: 마크다운 강조 표식 제거, 굽은따옴표 → 곧은따옴표, 줄 끝 공백 제거."""
    for curly, straight in _CURLY_QUOTES.items():
        text = text.replace(curly, straight)
    text = re.sub(r"\*\*(.+?)\*\*", r"\1", text)   # **굵게** → 굵게
    text = re.sub(r"__(.+?)__", r"\1", text)        # __굵게__ → 굵게
    text = "\n".join(line.rstrip() for line in text.splitlines())
    return text.strip()


# ---- 안전 생성 --------------------------------------------------------------

def check_output(text: str):
    """safety.check + 빈 응답 처리.

    콘텐츠 필터나 호출 이상으로 빈 문자열이 오면 그대로 보여줄 수 없으므로
    재생성 대상으로 본다.
    """
    if not text or not text.strip():
        return safety.REGENERATE, None, []
    return safety.check(text)


def generate(adapter, system: str, messages: list[dict]):
    """안전 필터를 통과한 응답을 만든다.

    block 위반이면 온도를 올리고 회피 지시를 붙여 1회 재생성한다.
    그래도 걸리면 차단 문구를 돌려준다.

    반환: (text, verdict, regenerated)
    """
    text = tidy(adapter.chat(system, messages, temperature=0.0))
    verdict, cleaned, _ = check_output(text)
    if verdict != safety.REGENERATE:
        return (cleaned if cleaned is not None else text), verdict, False

    text = tidy(adapter.chat(system + _RETRY_HINT, messages,
                             temperature=RETRY_TEMPERATURE))
    verdict, cleaned, _ = check_output(text)
    if verdict == safety.REGENERATE:
        return BLOCKED_MESSAGE, verdict, True
    return (cleaned if cleaned is not None else text), verdict, True


@dataclass
class ExplainResult:
    persona: str
    text: str
    verdict: str           # safety.OK / CLEANED / REGENERATE
    regenerated: bool


def explain(persona_key: str, metrics: dict, name: str | None = None,
            adapter=None) -> ExplainResult:
    """한 페르소나로 지표를 해설한다. block 위반 시 1회 재생성 후 실패면 차단."""
    if is_checklist(persona_key):
        raise ValueError(
            f"{persona_key}는 지표로 채점하지 않는 대가라 지표 해설을 만들 수 없습니다. "
            "chat.PersonaChat으로 확인 질문을 받으세요.")
    adapter = adapter or MockAdapter()
    system = build_system_prompt(persona_key)
    messages = [{"role": "user", "content": format_metrics_block(metrics, name)}]

    text, verdict, regenerated = generate(adapter, system, messages)
    return ExplainResult(persona_key, text, verdict, regenerated)


def explain_all(metrics: dict, name: str | None = None, adapter=None):
    """점수를 내는 대가 전부로 해설. 채점하지 않는 대가는 지표 해설 자체가 없다."""
    return {k: explain(k, metrics, name, adapter) for k in SCORE_PERSONAS}


if __name__ == "__main__":
    sample = {
        "PBR": 1.2, "PER": 18, "PEG": None,
        "ROIC_5y_avg": 0.14, "FCF_margin": 0.11,
        "netDebt_to_EBITDA": 3.1, "revenue_CAGR_5y": 0.04,
        "interest_coverage": None, "earnings_growth": None,
    }
    for key, res in explain_all(sample, name="Adobe").items():
        print(f"\n===== {PERSONAS[key]['name']} (verdict={res.verdict}) =====")
        print(res.text)
