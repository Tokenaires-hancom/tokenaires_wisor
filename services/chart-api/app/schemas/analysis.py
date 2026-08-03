"""응답 스키마.

금지 필드(buySignal, targetPrice, confidence 등)는 여기에 '없다'는 사실 자체가
1차 방어다. extra="forbid"로 두어 어댑터가 임의 필드를 끼워 넣지 못하게 한다.
"""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

DISCLAIMER = "이 내용은 차트 개념 학습을 위한 설명이며 투자 조언이 아닙니다."

Category = Literal[
    "chart_type", "candle", "moving_average", "trend", "support_resistance", "volume", "axis"
]
Visibility = Literal["clear", "partial", "unclear"]

VISIBILITY_LABEL = {
    "clear": "명확히 보임",
    "partial": "일부 보임",
    "unclear": "판독 어려움",
}


class Observation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    category: Category
    visibility: Visibility
    description: str


class AnalysisResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    chartType: Literal["candlestick", "line", "bar", "area", "unknown"]
    observations: list[Observation] = Field(default_factory=list)
    uncertainties: list[str] = Field(default_factory=list)
    learningPoints: list[str] = Field(default_factory=list)
    relatedLessons: list[str] = Field(default_factory=list)
    disclaimer: str = DISCLAIMER
    promptVersion: str
    filtered: bool = Field(default=False, description="안전 필터가 일부 문장을 걸러냈는지")


class RejectionResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    reason: str
    hint: str = "차트 영역만 잘라서 다시 올려주세요."
    disclaimer: str = DISCLAIMER


class LlmOutput(BaseModel):
    """모델이 돌려준 원본 JSON. 검증 전 단계."""

    model_config = ConfigDict(extra="ignore")

    analyzable: bool = True
    rejectionReason: Optional[str] = None
    chartType: str = "unknown"
    observations: list[dict] = Field(default_factory=list)
    uncertainties: list[str] = Field(default_factory=list)
    learningPoints: list[str] = Field(default_factory=list)
    relatedLessons: list[str] = Field(default_factory=list)
