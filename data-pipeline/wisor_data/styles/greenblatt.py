"""조엘 그린블랫 순위 모델.

``Greenblatt 1.0``은 『주식시장을 이기는 작은 책』의 마법공식을 따른다.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Callable

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


MAGIC_FORMULA_CRITERIA = [
    RankCriterion(
        code="GRB_MAGIC_QUALITY_RANK",
        label="마법공식 자본수익률 순위",
        weight=1,
        detail="최신 EBIT / (유동자산 − 유동부채 + 순유형자산)의 유니버스 내 내림차순 순위",
    ),
    RankCriterion(
        code="GRB_MAGIC_VALUE_RANK",
        label="마법공식 이익수익률 순위",
        weight=1,
        detail="최신 EBIT / 기업가치의 유니버스 내 내림차순 순위",
    ),
]

STYLE = RankedStyle(
    id="greenblatt",
    name="조엘 그린블랫",
    model_version="Greenblatt 1.0",
    method="rank",
    criteria=MAGIC_FORMULA_CRITERIA,
)

def _ordinal_ranks(values: dict[str, float]) -> dict[str, int]:
    """큰 값이 1위. 동률은 티커 순으로 고정해 배치 결과가 흔들리지 않게 한다."""
    ordered = sorted(values, key=lambda ticker: (-values[ticker], ticker))
    return {ticker: index + 1 for index, ticker in enumerate(ordered)}


def _score_universe(
    metrics_by_ticker: dict[str, Metrics],
    style: RankedStyle,
    quality_value: Callable[[Metrics], float | None],
    quality_description: Callable[[Metrics], str],
) -> dict[str, StyleScore]:
    eligible = {
        ticker: metrics
        for ticker, metrics in metrics_by_ticker.items()
        if quality_value(metrics) is not None and metrics.earnings_yield is not None
    }
    quality_ranks = _ordinal_ranks(
        {ticker: quality_value(metrics) for ticker, metrics in eligible.items()}
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
                for criterion in style.criteria
            ]
            scores[ticker] = StyleScore(
                style_id=style.id,
                model_version=style.model_version,
                score=None,
                passed=0,
                total_judged=0,
                total=len(style.criteria),
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
                style.criteria[0].code,
                style.criteria[0].label,
                style.criteria[0].weight,
                "pass" if quality_rank <= half else "fail",
                f"두 지표를 모두 계산할 수 있는 {total}개 종목 중 자본수익률 {quality_rank}위입니다"
                f"({quality_description(metrics)}).",
                style.criteria[0].detail,
            ),
            CriterionResult(
                style.criteria[1].code,
                style.criteria[1].label,
                style.criteria[1].weight,
                "pass" if value_rank <= half else "fail",
                f"두 지표를 모두 계산할 수 있는 {total}개 종목 중 이익수익률 {value_rank}위입니다"
                f"({pct(metrics.earnings_yield, 1)}).",
                style.criteria[1].detail,
            ),
        ]
        scores[ticker] = StyleScore(
            style_id=style.id,
            model_version=style.model_version,
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


def score_universe(metrics_by_ticker: dict[str, Metrics]) -> dict[str, StyleScore]:
    """원래 마법공식: 최신 세전 ROC와 이익수익률의 순위를 합산한다."""
    return _score_universe(
        metrics_by_ticker,
        STYLE,
        lambda metrics: metrics.magic_formula_roc,
        lambda metrics: pct(metrics.magic_formula_roc, 1),
    )
