"""모델이 어떤 파라미터를 받는지 확인하는 탐침.

챗봇의 안전 장치는 "차단되면 temperature를 올려 다시 생성한다"에 기대고 있다.
모델이 temperature나 max_tokens를 아예 받지 않으면 그 장치가 조용히 무력해지므로,
새 모델로 바꿀 때마다 여기서 먼저 확인한다.

    python main.py            # 파라미터 조합 4가지 + 어댑터 실호출
    python main.py --params   # 파라미터 조합만 (토큰 절약)
"""
from __future__ import annotations

import os
import sys

from explain import OPENROUTER_BASE_URL, OpenAIAdapter, load_dotenv_file

PROMPT = [{"role": "user", "content": "1+1은 얼마인가요? 숫자만 답하세요."}]


def _force_utf8() -> None:
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8")
        except (AttributeError, OSError):
            pass


def _client_and_model():
    from openai import OpenAI

    load_dotenv_file()
    key = os.getenv("OPENROUTER_API_KEY")
    if key:
        base = os.getenv("PERSONA_BASE_URL") or OPENROUTER_BASE_URL
        model = os.getenv("PERSONA_MODEL", "openai/gpt-5.4-mini")
        return OpenAI(api_key=key, base_url=base), model, base
    key = os.getenv("OPENAI_API_KEY")
    if not key:
        raise SystemExit("API 키가 없습니다. .env에 OPENROUTER_API_KEY를 넣으세요.")
    return OpenAI(api_key=key), os.getenv("PERSONA_MODEL", "gpt-4o-mini"), None


def probe_params() -> None:
    client, model, base = _client_and_model()
    print(f"model={model}")
    print(f"base_url={base or 'https://api.openai.com/v1 (기본)'}\n")

    cases = {
        "temperature=0 + max_tokens": {"temperature": 0, "max_tokens": 64},
        "max_tokens 만": {"max_tokens": 64},
        "temperature=0 + max_completion_tokens": {"temperature": 0,
                                                 "max_completion_tokens": 64},
        "파라미터 없음": {},
    }
    for label, kwargs in cases.items():
        try:
            resp = client.chat.completions.create(
                model=model, messages=PROMPT, **kwargs)
            text = (resp.choices[0].message.content or "").strip().replace("\n", " ")
            print(f"  [받음]   {label}  → {text[:40]!r}")
        except Exception as exc:  # 어떤 파라미터를 왜 거부하는지 그대로 보여준다
            first_line = str(exc).split("\n")[0]
            print(f"  [거부됨] {label}\n           {first_line[:200]}")


def probe_adapter() -> None:
    """어댑터가 실제 종목 하나를 끝까지 해설하는지 확인한다."""
    import scores_source

    print("\n" + "=" * 70)
    adapter = OpenAIAdapter()
    print(f"어댑터: model={adapter.model} base_url={adapter.base_url}")

    from chat import PersonaChat

    data = scores_source.get_data()
    ticker = data.tickers()[0]
    company = data.company(ticker)
    judgement = data.judgement(ticker, "buffett")

    session = PersonaChat("buffett", company=company, judgement=judgement,
                          adapter=adapter)
    print(f"\n종목: {company.name} ({company.ticker})")
    print(f"판정: {judgement.passed}/{judgement.total} 충족, 점수 {judgement.score}")
    print("-" * 70)
    reply = session.start()
    print(reply.text)
    print("-" * 70)
    print(f"verdict={reply.verdict} regenerated={reply.regenerated}")
    print(f"어댑터가 최종적으로 쓴 파라미터: "
          f"token_param={adapter._token_param} temperature전송={adapter._send_temperature}")

    print("\n후속 질문: '왜 현재 가격 기준이 미충족인가요?'")
    print("-" * 70)
    print(session.ask("왜 현재 가격 기준이 미충족인가요?").text)


if __name__ == "__main__":
    _force_utf8()
    probe_params()
    if "--params" not in sys.argv:
        probe_adapter()
