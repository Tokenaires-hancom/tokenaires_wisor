"""투자 스타일 점수의 공통 뼈대.

기획서 11.3의 표현 규칙을 코드 수준에서 강제한다.
- 점수는 '몇 개 기준을 통과했는가'에서 나온다. 블랙박스 회귀식이 아니다.
- 통과하지 못한 기준은 반드시 함께 내보낸다(11.1 좋은 점과 나쁜 점을 같은 비중으로).
- 판정에 필요한 값이 없으면 fail이 아니라 unknown이다.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable, Literal, Optional

from ..metrics import Metrics

Status = Literal["pass", "fail", "unknown"]

# 사용자에게 그대로 노출되는 문장에서 금지하는 표현.
# 차트 분석기(services/chart-api)와 같은 원칙을 재무 쪽에도 적용한다.
BANNED_PHRASES = [
    "매수",
    "매도",
    "목표가",
    "손절",
    "추천",
    "보장",
    "확실",
    "오를",
    "내릴",
    "급등",
    "바닥",
]


def assert_language_is_safe(text: str) -> None:
    for banned in BANNED_PHRASES:
        if banned in text:
            raise ValueError(f"금지 표현이 사용자 문구에 포함됐습니다: {banned!r} in {text!r}")


@dataclass
class Criterion:
    """스타일을 구성하는 기준 하나."""

    code: str
    label: str
    weight: int
    test: Callable[[Metrics], Optional[bool]]
    on_pass: Callable[[Metrics], str]
    on_fail: Callable[[Metrics], str]
    detail: str = ""

    def evaluate(self, m: Metrics) -> "CriterionResult":
        try:
            outcome = self.test(m)
        except (TypeError, ZeroDivisionError):
            outcome = None

        if outcome is None:
            return CriterionResult(self.code, self.label, self.weight, "unknown",
                                   "이 기준을 판정할 데이터가 부족합니다.", self.detail)
        message = self.on_pass(m) if outcome else self.on_fail(m)
        assert_language_is_safe(message)
        return CriterionResult(self.code, self.label, self.weight,
                               "pass" if outcome else "fail", message, self.detail)


@dataclass
class CriterionResult:
    code: str
    label: str
    weight: int
    status: Status
    message: str
    detail: str = ""

    def to_dict(self) -> dict:
        return {
            "code": self.code,
            "label": self.label,
            "weight": self.weight,
            "status": self.status,
            "message": self.message,
            "detail": self.detail,
        }


@dataclass
class StyleScore:
    style_id: str
    model_version: str
    score: Optional[int]
    passed: int
    total_judged: int
    total: int
    data_confidence: Literal["높음", "보통", "낮음", "정보 부족"]
    criteria: list[CriterionResult] = field(default_factory=list)

    @property
    def reasons(self) -> list[str]:
        return [c.message for c in self.criteria if c.status == "pass"]

    @property
    def risks(self) -> list[str]:
        return [c.message for c in self.criteria if c.status in ("fail", "unknown")]

    def to_dict(self) -> dict:
        return {
            "styleId": self.style_id,
            "modelVersion": self.model_version,
            "score": self.score,
            "passed": self.passed,
            "totalJudged": self.total_judged,
            "total": self.total,
            "dataConfidence": self.data_confidence,
            "criteria": [c.to_dict() for c in self.criteria],
            "reasons": self.reasons,
            "risks": self.risks,
        }


@dataclass
class Style:
    id: str
    name: str
    model_version: str
    criteria: list[Criterion]

    def score(self, m: Metrics) -> StyleScore:
        results = [c.evaluate(m) for c in self.criteria]
        judged = [r for r in results if r.status != "unknown"]
        passed = [r for r in judged if r.status == "pass"]

        judged_weight = sum(r.weight for r in judged)
        passed_weight = sum(r.weight for r in passed)
        unknown_ratio = 1 - (len(judged) / len(results)) if results else 1

        if unknown_ratio > 0.25:
            confidence, score = "정보 부족", None
        elif unknown_ratio > 0.10:
            confidence = "보통"
            score = round(passed_weight / judged_weight * 100) if judged_weight else None
        else:
            confidence = "높음"
            score = round(passed_weight / judged_weight * 100) if judged_weight else None

        return StyleScore(
            style_id=self.id,
            model_version=self.model_version,
            score=score,
            passed=len(passed),
            total_judged=len(judged),
            total=len(results),
            data_confidence=confidence,
            criteria=results,
        )


def pct(value: Optional[float], digits: int = 0) -> str:
    return "정보 없음" if value is None else f"{value * 100:.{digits}f}%"


def num(value: Optional[float], digits: int = 1) -> str:
    return "정보 없음" if value is None else f"{value:.{digits}f}"
