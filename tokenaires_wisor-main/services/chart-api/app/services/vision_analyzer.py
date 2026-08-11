"""분석 흐름 조립.

이미지 → 프롬프트 → LLM → 파싱 → 안전 검사 → 구조화 응답.

안전 검사에서 block 등급이 나오면 한 번 재생성하고, 그래도 걸리면 분석을 제공하지 않는다.
문장 등급이면 그 문장만 떼어내고 나머지는 살린다.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

from ..schemas.analysis import (
    DISCLAIMER,
    AnalysisResponse,
    LlmOutput,
    Observation,
    RejectionResponse,
)
from . import prompt as prompt_module
from . import safety
from .llm_adapter import VisionProvider, parse_json

log = logging.getLogger("wisor.chart")

MAX_ATTEMPTS = 2
MIN_OBSERVATIONS = 2

VALID_CATEGORIES = {
    "chart_type", "candle", "moving_average", "trend", "support_resistance", "volume", "axis",
}
VALID_VISIBILITY = {"clear", "partial", "unclear"}
VALID_CHART_TYPES = {"candlestick", "line", "bar", "area", "unknown"}


class AnalysisRejected(Exception):
    def __init__(self, reason: str):
        super().__init__(reason)
        self.reason = reason


@dataclass
class AnalysisOutcome:
    response: AnalysisResponse
    attempts: int
    filtered_sentences: list[str]
    violation_codes: list[str]


async def analyze(
    provider: VisionProvider,
    image_bytes: bytes,
    media_type: str,
    lesson_id: str | None = None,
) -> AnalysisOutcome:
    messages = prompt_module.build_messages(lesson_id)
    last_violations: list[safety.Violation] = []

    for attempt in range(1, MAX_ATTEMPTS + 1):
        raw = await provider.analyze(image_bytes, media_type, messages)

        try:
            parsed = LlmOutput(**parse_json(raw))
        except Exception as exc:  # 모델이 형식을 어긴 경우
            log.warning("응답 파싱 실패(%d회차): %s", attempt, exc)
            if attempt == MAX_ATTEMPTS:
                raise AnalysisRejected("분석 결과를 만들지 못했습니다. 잠시 후 다시 시도해 주세요.")
            continue

        if not parsed.analyzable:
            raise AnalysisRejected(
                parsed.rejectionReason
                or "차트 요소가 충분히 선명하지 않아 교육용 분석을 제공하기 어렵습니다."
            )

        cleaned, violations, removed = _sanitize(parsed)
        blocking = [v for v in violations if v.severity == "block"]

        if blocking and attempt < MAX_ATTEMPTS:
            log.warning("금지 표현으로 재생성(%d회차): %s",
                        attempt, [v.code for v in blocking])
            last_violations = violations
            continue

        if blocking:
            log.error("재생성 후에도 금지 표현: %s", [v.code for v in blocking])
            raise AnalysisRejected(
                "교육용으로 적절한 설명을 만들지 못했습니다. 다른 차트 이미지로 다시 시도해 주세요."
            )

        if len(cleaned.observations) < MIN_OBSERVATIONS:
            raise AnalysisRejected(
                "차트에서 설명할 수 있는 요소를 충분히 찾지 못했습니다. 차트 영역만 잘라서 다시 올려주세요."
            )

        return AnalysisOutcome(
            response=cleaned,
            attempts=attempt,
            filtered_sentences=removed,
            violation_codes=[v.code for v in violations],
        )

    raise AnalysisRejected("분석에 실패했습니다.")


def _sanitize(parsed: LlmOutput) -> tuple[AnalysisResponse, list[safety.Violation], list[str]]:
    """위반 문장을 떼어내고 스키마에 맞게 정리한다."""
    violations: list[safety.Violation] = []
    removed: list[str] = []

    observations: list[Observation] = []
    for raw_obs in parsed.observations:
        category = raw_obs.get("category")
        visibility = raw_obs.get("visibility")
        description = (raw_obs.get("description") or "").strip()
        if category not in VALID_CATEGORIES or visibility not in VALID_VISIBILITY or not description:
            continue

        result = safety.filter_text(description)
        violations.extend(result.violations)
        removed.extend(result.removed)
        if not result.text:
            continue
        observations.append(
            Observation(category=category, visibility=visibility, description=result.text)
        )

    uncertainties = _clean_list(parsed.uncertainties, violations, removed)
    learning_points = _clean_list(parsed.learningPoints, violations, removed)

    # relatedLessons는 화이트리스트 밖 값을 버린다. 없는 학습 페이지로 링크되지 않게 한다.
    lessons = [l for l in parsed.relatedLessons if l in prompt_module.LESSON_IDS]

    chart_type = parsed.chartType if parsed.chartType in VALID_CHART_TYPES else "unknown"

    response = AnalysisResponse(
        chartType=chart_type,
        observations=observations,
        uncertainties=uncertainties or ["이미지에서 확인하기 어려운 부분이 있는지 직접 한 번 더 살펴보세요."],
        learningPoints=learning_points,
        relatedLessons=lessons,
        disclaimer=DISCLAIMER,
        promptVersion=prompt_module.PROMPT_VERSION,
        filtered=bool(removed),
    )
    return response, violations, removed


def _clean_list(
    items: list[str], violations: list[safety.Violation], removed: list[str]
) -> list[str]:
    kept = []
    for item in items:
        result = safety.filter_text(item)
        violations.extend(result.violations)
        removed.extend(result.removed)
        if result.text:
            kept.append(result.text)
    return kept


def rejection(reason: str) -> RejectionResponse:
    return RejectionResponse(reason=reason)
