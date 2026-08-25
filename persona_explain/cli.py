"""페르소나 지표 해설 챗봇 — 대화형 터미널.

    python cli.py            # 키가 있으면 실제 모델, 없으면 mock
    python cli.py --mock     # 키가 있어도 mock 강제(과금 없음)

지표를 한 번 정해두고, 대가별 관점으로 묻고 답하는 멀티턴 대화를 한다.
"""
from __future__ import annotations

import json
import sys

from chat import PersonaChat
from explain import METRIC_LABELS, MockAdapter, OpenAIAdapter
from personas import PERSONAS

SAMPLE_NAME = "Adobe"
SAMPLE_METRICS = {
    "PBR": 1.2, "PER": 18, "PEG": None,
    "ROIC_5y_avg": 0.14, "FCF_margin": 0.11,
    "netDebt_to_EBITDA": 3.1, "revenue_CAGR_5y": 0.04,
    "interest_coverage": None, "earnings_growth": None,
}

HELP = f"""\
명령
  /persona <{'|'.join(PERSONAS)}>  대가 교체 (대화 기록은 초기화)
  /metrics                         지금 해설 중인 지표 보기
  /reset                           대화 기록만 초기화
  /help                            이 도움말
  /quit                            종료
그 밖의 입력은 모두 후속 질문으로 전달된다."""


def _force_utf8() -> None:
    """Windows 콘솔에서 한글 출력이 UnicodeEncodeError로 죽는 것을 막는다."""
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8")
        except (AttributeError, OSError):
            pass


def _prompt(text: str, default: str = "") -> str:
    """입력 한 줄. EOF(파이프 입력 끝)면 기본값으로 넘어간다."""
    try:
        value = input(text).strip()
    except EOFError:
        print()
        return default
    return value or default


def build_adapter(force_mock: bool):
    """실제 어댑터를 만들어 보고, 키가 없거나 SDK가 없으면 mock으로 떨어진다."""
    if force_mock:
        print("[mock 모드] 실제 호출 없이 돕니다.")
        return MockAdapter()
    try:
        adapter = OpenAIAdapter()
    except (RuntimeError, ImportError) as exc:
        print(f"[mock 모드] {exc}")
        return MockAdapter()
    print(f"[OpenAI 모드] model={adapter.model}")
    return adapter


def choose_persona(default: str = "buffett") -> str:
    print("\n대가를 고르세요.")
    for key, persona in PERSONAS.items():
        print(f"  {key:8s} {persona['name']}")
    while True:
        key = _prompt(f"페르소나 [{default}]: ", default)
        if key in PERSONAS:
            return key
        print(f"  '{key}'는 없는 페르소나입니다. {list(PERSONAS)} 중에서 고르세요.")


def _input_metrics_manually() -> tuple[dict, str | None]:
    print("\n비율·성장률은 소수로 넣으세요 (9% → 0.09). 엔터만 치면 '데이터 없음'입니다.")
    name = _prompt("종목명(표시용, 생략 가능): ") or None
    metrics: dict = {}
    for key, label in METRIC_LABELS.items():
        while True:
            raw = _prompt(f"  {label}: ")
            if not raw:
                metrics[key] = None
                break
            try:
                metrics[key] = float(raw)
                break
            except ValueError:
                print("    숫자로 넣어주세요. (예: 1.2)")
    return metrics, name


def _load_metrics_file() -> tuple[dict, str | None] | None:
    path = _prompt("JSON 파일 경로: ")
    if not path:
        return None
    try:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
    except (OSError, json.JSONDecodeError) as exc:
        print(f"  읽지 못했습니다: {exc}")
        return None
    if not isinstance(data, dict):
        print("  최상위가 객체(dict)인 JSON이어야 합니다.")
        return None
    name = data.get("name")
    metrics = data.get("metrics", data)
    unknown = [k for k in metrics if k not in METRIC_LABELS]
    if unknown:
        print(f"  모르는 필드는 무시합니다: {unknown}")
    return {k: v for k, v in metrics.items() if k in METRIC_LABELS}, name


def choose_metrics() -> tuple[dict, str | None]:
    print("\n해설할 지표를 정합니다.")
    print("  1) 샘플 (Adobe)")
    print("  2) 직접 입력")
    print("  3) JSON 파일")
    while True:
        choice = _prompt("선택 [1]: ", "1")
        if choice == "1":
            return dict(SAMPLE_METRICS), SAMPLE_NAME
        if choice == "2":
            return _input_metrics_manually()
        if choice == "3":
            loaded = _load_metrics_file()
            if loaded is not None:
                return loaded
            continue
        print("  1, 2, 3 중에서 고르세요.")


def show_metrics(session: PersonaChat) -> None:
    """세션을 붙들고 있는 블록을 보여준다.

    채점하지 않는 대가를 고르면 지표가 아니라 <회사> 블록이 앵커다.
    """
    print(session.metrics_block() or session.company_block())


def print_reply(session: PersonaChat, reply) -> None:
    note = ""
    if reply.blocked:
        note = "  (안전 필터 차단 — 이 답변은 기록에 남기지 않았습니다)"
    elif reply.regenerated:
        note = "  (금지 표현이 있어 한 번 다시 생성했습니다)"
    print(f"\n[{session.persona_name}]{note}")
    print(reply.text)


def handle_command(session: PersonaChat, line: str) -> bool:
    """명령을 처리했으면 True. /quit이면 SystemExit."""
    parts = line.split()
    cmd, args = parts[0], parts[1:]

    if cmd in ("/quit", "/exit"):
        raise SystemExit(0)
    if cmd == "/help":
        print(HELP)
    elif cmd == "/metrics":
        show_metrics(session)
    elif cmd == "/reset":
        session.reset()
        print("대화 기록을 지웠습니다. 지표는 그대로입니다.")
        print_reply(session, session.start())
    elif cmd == "/persona":
        key = args[0] if args else ""
        if key not in PERSONAS:
            print(f"사용법: /persona {'|'.join(PERSONAS)}")
        else:
            session.switch_persona(key)
            print(f"{session.persona_name}의 관점으로 바꿉니다. 대화 기록은 초기화됩니다.")
            print_reply(session, session.start())
    else:
        print(f"모르는 명령입니다: {cmd}  (/help)")
    return True


def main() -> None:
    _force_utf8()
    force_mock = "--mock" in sys.argv

    print("=" * 60)
    print("페르소나 지표 해설 챗봇")
    print("숫자는 여러분이 넣고, 챗봇은 대가의 기준으로 설명만 합니다.")
    print("매수·매도·목표가·전망은 다루지 않습니다.")
    print("=" * 60)

    adapter = build_adapter(force_mock)
    persona_key = choose_persona()
    metrics, name = choose_metrics()

    session = PersonaChat(persona_key, metrics, name=name, adapter=adapter)
    print("\n첫 해설을 만드는 중입니다…")
    print_reply(session, session.start())
    print(f"\n{HELP}\n")

    while True:
        line = _prompt("\n질문> ", "/quit")
        if not line:
            continue
        if line.startswith("/"):
            handle_command(session, line)
            continue
        print_reply(session, session.ask(line))


if __name__ == "__main__":
    try:
        main()
    except (KeyboardInterrupt, SystemExit):
        print("\n종료합니다.")
