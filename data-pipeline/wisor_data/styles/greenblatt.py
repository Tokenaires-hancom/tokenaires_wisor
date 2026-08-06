"""그린블랫 스타일 — Greenblatt 1.0.

절대 문턱을 통과시키는 모델이 아니라 같은 유니버스 안에서 사업의 질과 가격을
각각 순위 매긴 뒤 합산한다. 개별 Metrics 하나만으로는 결과를 만들 수 없다.
"""

from __future__ import annotations

from dataclasses import dataclass

from ..metrics import Metrics
from .base import CriterionResult, StyleScore, pct


@dataclass(frozen=True)
class RankCriterion:
    code: str
    label: str
    weight: int
    detail: str


@dataclass(frozen=True)
class RankedStyle:
    id: str
    name: str
    model_version: str
    method: str
    criteria: list[RankCriterion]


CRITERIA = [
    RankCriterion(
        code="GRB_QUALITY_RANK",
        label="사업의 질 순위",
        weight=1,
        detail="5년 평균 자본수익률의 유니버스 내 내림차순 순위",
    ),
    RankCriterion(
        code="GRB_VALUE_RANK",
        label="가격 순위",
        weight=1,
        detail="EBIT / 기업가치(이익수익률)의 유니버스 내 내림차순 순위",
    ),
]

STYLE = RankedStyle(
    id="greenblatt",
    name="조엘 그린블랫",
    model_version="Greenblatt 1.0",
    method="rank",
    criteria=CRITERIA,
)


def _ordinal_ranks(values: dict[str, float]) -> dict[str, int]:
    """큰 값이 1위. 동률은 티커 순으로 고정해 배치 결과가 흔들리지 않게 한다."""
    ordered = sorted(values, key=lambda ticker: (-values[ticker], ticker))
    return {ticker: index + 1 for index, ticker in enumerate(ordered)}


def score_universe(metrics_by_ticker: dict[str, Metrics]) -> dict[str, StyleScore]:
    eligible = {
        ticker: metrics
        for ticker, metrics in metrics_by_ticker.items()
        if metrics.roic_avg_5y is not None and metrics.earnings_yield is not None
    }
    quality_ranks = _ordinal_ranks(
        {ticker: metrics.roic_avg_5y for ticker, metrics in eligible.items()}
    )
    value_ranks = _ordinal_ranks(
        {ticker: metrics.earnings_yield for ticker, metrics in eligible.items()}
    )
    combined = {
        ticker: quality_ranks[ticker] + value_ranks[ticker]
        for ticker in eligible
    }
    ordered = sorted(combined, key=lambda ticker: (combined[ticker], ticker))
    overall_ranks: dict[str, int] = {}
    previous_total: int | None = None
    current_rank = 0
    for index, ticker in enumerate(ordered):
        if combined[ticker] != previous_total:
            current_rank = index + 1
            previous_total = combined[ticker]
        overall_ranks[ticker] = current_rank
    total = len(ordered)
    half = max(1, (total + 1) // 2)

    scores: dict[str, StyleScore] = {}
    for ticker, metrics in metrics_by_ticker.items():
        if ticker not in eligible:
            criteria = [
                CriterionResult(
                    criterion.code,
                    criterion.label,
                    criterion.weight,
                    "unknown",
                    "상대 순위를 계산할 데이터가 부족합니다.",
                    criterion.detail,
                )
                for criterion in CRITERIA
            ]
            scores[ticker] = StyleScore(
                style_id=STYLE.id,
                model_version=STYLE.model_version,
                score=None,
                passed=0,
                total_judged=0,
                total=len(CRITERIA),
                data_confidence="정보 부족",
                criteria=criteria,
            )
            continue

        quality_rank = quality_ranks[ticker]
        value_rank = value_ranks[ticker]
        rank = overall_ranks[ticker]
        score = round((total - rank + 1) / total * 100) if total else None
        criteria = [
            CriterionResult(
                CRITERIA[0].code,
                CRITERIA[0].label,
                CRITERIA[0].weight,
                "pass" if quality_rank <= half else "fail",
                f"자본수익률 상대 순위 {quality_rank}위/{total}개입니다"
                f"(5년 평균 {pct(metrics.roic_avg_5y, 1)}).",
                CRITERIA[0].detail,
            ),
            CriterionResult(
                CRITERIA[1].code,
                CRITERIA[1].label,
                CRITERIA[1].weight,
                "pass" if value_rank <= half else "fail",
                f"이익수익률 상대 순위 {value_rank}위/{total}개입니다"
                f"({pct(metrics.earnings_yield, 1)}).",
                CRITERIA[1].detail,
            ),
        ]
        scores[ticker] = StyleScore(
            style_id=STYLE.id,
            model_version=STYLE.model_version,
            score=score,
            passed=sum(criterion.status == "pass" for criterion in criteria),
            total_judged=len(criteria),
            total=len(criteria),
            data_confidence="높음",
            criteria=criteria,
            rank=rank,
            rank_components={"quality": quality_rank, "value": value_rank},
        )

    return scores
