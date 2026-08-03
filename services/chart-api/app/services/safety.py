"""출력 안전장치 — 설계 가이드 9장의 두 번째 방어선.

프롬프트 제약이 첫 번째 방어선이고, 이 모듈이 두 번째다. 모델이 규칙을 어겼을 때
그대로 사용자에게 나가지 않게 막는다. 외부 의존성이 없어 단독으로 테스트한다.

판정은 두 단계다.
- sentence: 해당 문장만 떼어낸다. 나머지 설명은 살린다.
- block: 응답 전체를 버리고 다시 만든다. 재생성해도 걸리면 분석을 제공하지 않는다.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Literal

Severity = Literal["sentence", "block"]

# 응답 본문에 절대 들어가면 안 되는 필드 (설계 가이드 8장)
FORBIDDEN_FIELDS = {
    "buySignal",
    "sellSignal",
    "targetPrice",
    "stopLoss",
    "upsideProbability",
    "futureDirection",
    "recommendedAction",
    "confidence",
}


@dataclass(frozen=True)
class Rule:
    code: str
    pattern: re.Pattern
    severity: Severity
    note: str


def _rule(code: str, pattern: str, severity: Severity, note: str) -> Rule:
    return Rule(code, re.compile(pattern, re.IGNORECASE), severity, note)


RULES: list[Rule] = [
    # 매매 지시
    _rule("ACTION_BUY", r"매수|사야|사는\s*것이\s*좋|진입\s*시점|buy\s+signal", "block", "매매 지시"),
    _rule("ACTION_SELL", r"매도|팔아야|파는\s*것이\s*좋|익절|sell\s+signal", "block", "매매 지시"),
    _rule("ACTION_HOLD", r"보유를\s*유지|홀딩하", "block", "매매 지시"),
    # 가격 목표
    _rule("PRICE_TARGET", r"목표가|목표\s*주가|적정\s*주가|target\s+price", "block", "목표가 제시"),
    _rule("PRICE_STOP", r"손절|스탑로스|stop\s*loss", "block", "손절가 제시"),
    # 미래 예측
    _rule("FORECAST_UP", r"상승할\s*(것|가능성)|오를\s*(것|가능성)|반등할\s*(것|가능성)|급등", "block", "가격 예측"),
    _rule("FORECAST_DOWN", r"하락할\s*(것|가능성)|내릴\s*(것|가능성)|급락", "block", "가격 예측"),
    _rule("FORECAST_LEVEL", r"바닥(을|이|은)?\s*(다졌|찍었|확인|입니다)|천장(을|이)?\s*(찍|확인)", "block", "고점·저점 단정"),
    _rule("FORECAST_PROB", r"\d+\s*%\s*(확률|가능성)|확률은\s*\d+", "block", "확률 제시"),
    # 단정과 보장
    _rule("CERTAINTY", r"확실한[^.!?]{0,12}(신호|전환)|틀림없|반드시\s*(오|내)", "block", "단정 표현"),
    _rule("GUARANTEE", r"수익\s*보장|손실\s*없|안전한\s*투자", "block", "수익 보장"),
    _rule("RECOMMEND", r"투자\s*추천|추천\s*종목|권장\s*(매|비중)", "block", "투자 추천"),
    # 이미지 밖 정보 사용
    _rule("EXTERNAL_KNOWLEDGE", r"실적\s*발표|뉴스에\s*따르|이\s*기업(은|의)\s*최근|해당\s*종목의\s*재무", "sentence",
          "이미지 밖 정보 사용"),
    _rule("TICKER_GUESS", r"(으)?로\s*보이는\s*종목은|아마도\s*[A-Z]{2,5}\s*(주가|차트)", "sentence", "종목 추측"),
    # 신호 해석을 매매로 연결
    _rule("ACTION_ENTRY", r"진입(을|하|\s*시점|\s*타이밍|\s*구간)|비중을?\s*(확대|축소)|분할\s*(매|접근)", "block",
          "매매 지시"),
    _rule("SIGNAL_TO_ACTION",
          r"(골든크로스|데드크로스|돌파|이탈|지지선|저항선)[^.!?]{0,24}(매수|매도|진입|정리|대응|공략)", "block",
          "패턴을 매매 판단으로 연결"),
]

# 문장 분리: 마침표·물음표·느낌표·줄바꿈 기준. 한국어 종결어미 뒤 공백까지 함께 본다.
_SENTENCE_SPLIT = re.compile(r"(?<=[.!?…])\s+|\n+")


@dataclass
class Violation:
    code: str
    severity: Severity
    note: str
    excerpt: str


@dataclass
class FilterResult:
    text: str
    violations: list[Violation] = field(default_factory=list)
    removed: list[str] = field(default_factory=list)

    @property
    def blocked(self) -> bool:
        return any(v.severity == "block" for v in self.violations)

    @property
    def clean(self) -> bool:
        return not self.violations


def scan(text: str) -> list[Violation]:
    """텍스트를 훑어 위반을 모은다. 텍스트는 바꾸지 않는다."""
    found: list[Violation] = []
    for rule in RULES:
        for match in rule.pattern.finditer(text):
            start = max(0, match.start() - 12)
            end = min(len(text), match.end() + 12)
            found.append(Violation(rule.code, rule.severity, rule.note, text[start:end].strip()))
    return found


def filter_text(text: str) -> FilterResult:
    """문장 단위로 검사해 위반 문장을 떼어낸다.

    block 등급이 하나라도 있으면 blocked=True로 표시한다. 이 경우 호출부는
    문장 제거로 끝내지 말고 재생성 또는 거절을 선택해야 한다.
    """
    sentences = [s for s in _SENTENCE_SPLIT.split(text) if s.strip()]
    kept, removed, violations = [], [], []

    for sentence in sentences:
        found = scan(sentence)
        if found:
            violations.extend(found)
            removed.append(sentence.strip())
        else:
            kept.append(sentence.strip())

    return FilterResult(text=" ".join(kept), violations=violations, removed=removed)


def check_payload(payload: dict) -> list[Violation]:
    """구조화 응답 전체를 검사한다. 금지 필드가 있으면 그 자체로 block."""
    violations: list[Violation] = []

    for key in payload:
        if key in FORBIDDEN_FIELDS:
            violations.append(Violation("FORBIDDEN_FIELD", "block", "금지 필드", key))

    for text in _walk_strings(payload):
        violations.extend(scan(text))

    return violations


def _walk_strings(node) -> list[str]:
    if isinstance(node, str):
        return [node]
    if isinstance(node, dict):
        return [s for v in node.values() for s in _walk_strings(v)]
    if isinstance(node, (list, tuple)):
        return [s for v in node for s in _walk_strings(v)]
    return []
