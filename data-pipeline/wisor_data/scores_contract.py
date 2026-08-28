"""런타임에 공개하기 전 scores.json의 최소 계약을 확인한다."""

from __future__ import annotations

import argparse
import json
import math
from datetime import datetime, timedelta
from pathlib import Path


PRODUCTION_STYLE_IDS = {"buffett", "graham", "lynch", "greenblatt"}


class ScoresContractError(ValueError):
    """화면과 챗봇이 함께 기대하는 JSON 계약을 어겼다."""


def _require(condition: bool, message: str) -> None:
    if not condition:
        raise ScoresContractError(message)


def validate_scores_payload(
    payload,
    *,
    expected_source: str | None = None,
    minimum_companies: int = 1,
    minimum_price_refresh_ratio: float | None = None,
) -> dict:
    _require(minimum_companies >= 1, "minimum_companies는 1 이상이어야 합니다.")
    if minimum_price_refresh_ratio is not None:
        _require(
            0 < minimum_price_refresh_ratio <= 1,
            "minimum_price_refresh_ratio는 0보다 크고 1 이하여야 합니다.",
        )
    _require(isinstance(payload, dict), "최상위 값은 JSON 객체여야 합니다.")
    _require(
        isinstance(payload.get("generatedAt"), str) and bool(payload["generatedAt"]),
        "generatedAt이 없습니다.",
    )
    _require(
        isinstance(payload.get("dataSource"), str) and bool(payload["dataSource"]),
        "dataSource가 없습니다.",
    )
    if expected_source:
        _require(
            payload["dataSource"] == expected_source,
            f"dataSource가 {expected_source!r}가 아닙니다: {payload['dataSource']!r}",
        )

    as_of = payload.get("asOf")
    _require(isinstance(as_of, dict), "asOf 객체가 없습니다.")
    _require(isinstance(as_of.get("price"), str) and bool(as_of["price"]), "asOf.price가 없습니다.")
    _require(
        isinstance(as_of.get("financial"), str) and bool(as_of["financial"]),
        "asOf.financial이 없습니다.",
    )

    styles = payload.get("styles")
    _require(isinstance(styles, list) and styles, "styles가 비어 있습니다.")
    style_ids: list[str] = []
    for style in styles:
        _require(isinstance(style, dict), "styles 항목은 객체여야 합니다.")
        style_id = style.get("id")
        _require(isinstance(style_id, str) and bool(style_id), "styles[].id가 비어 있습니다.")
        _require(
            isinstance(style.get("name"), str) and bool(style["name"]),
            f"{style_id}의 name이 비어 있습니다.",
        )
        _require(
            isinstance(style.get("modelVersion"), str) and bool(style["modelVersion"]),
            f"{style_id}의 modelVersion이 비어 있습니다.",
        )
        _require(style.get("method") in {"threshold", "rank"}, f"{style_id}의 method가 올바르지 않습니다.")
        criteria = style.get("criteria")
        _require(isinstance(criteria, list) and criteria, f"{style_id}의 criteria가 비어 있습니다.")
        criterion_codes: list[str] = []
        for criterion in criteria:
            _require(isinstance(criterion, dict), f"{style_id}의 criterion이 객체가 아닙니다.")
            code = criterion.get("code")
            _require(isinstance(code, str) and bool(code), f"{style_id}의 criterion code가 비어 있습니다.")
            _require(
                isinstance(criterion.get("label"), str) and bool(criterion["label"]),
                f"{style_id}/{code}의 label이 비어 있습니다.",
            )
            _require(
                isinstance(criterion.get("detail"), str) and bool(criterion["detail"]),
                f"{style_id}/{code}의 detail이 비어 있습니다.",
            )
            weight = criterion.get("weight")
            _require(
                isinstance(weight, (int, float)) and not isinstance(weight, bool) and weight > 0,
                f"{style_id}/{code}의 weight가 올바르지 않습니다.",
            )
            criterion_codes.append(code)
        _require(
            len(criterion_codes) == len(set(criterion_codes)),
            f"{style_id}의 criterion code가 중복됐습니다.",
        )
        style_ids.append(style_id)
    _require(len(style_ids) == len(set(style_ids)), "styles[].id가 중복됐습니다.")
    if expected_source == "sec-toss":
        _require(
            set(style_ids) == PRODUCTION_STYLE_IDS,
            f"운영 style 집합이 올바르지 않습니다: {sorted(style_ids)}",
        )

    companies = payload.get("companies")
    _require(isinstance(companies, list), "companies 배열이 없습니다.")
    _require(
        len(companies) >= minimum_companies,
        f"companies가 {len(companies)}개라 최소 {minimum_companies}개보다 적습니다.",
    )
    normalized_tickers: list[str] = []
    required_scores = set(style_ids)
    for company in companies:
        _require(isinstance(company, dict), "companies 항목은 객체여야 합니다.")
        ticker = company.get("ticker")
        _require(isinstance(ticker, str) and ticker, "companies[].ticker가 비어 있습니다.")
        normalized_tickers.append(ticker.strip().upper())
        _require(
            isinstance(company.get("name"), str) and bool(company["name"]),
            f"{ticker}의 name이 비어 있습니다.",
        )
        _require(isinstance(company.get("sector"), str), f"{ticker}의 sector가 문자열이 아닙니다.")
        for field in ("price", "marketCap"):
            value = company.get(field)
            _require(
                isinstance(value, (int, float)) and
                not isinstance(value, bool) and
                math.isfinite(value) and value > 0,
                f"{ticker}의 {field}가 양의 유한수가 아닙니다.",
            )
        company_as_of = company.get("asOf")
        _require(isinstance(company_as_of, dict), f"{ticker}의 asOf 객체가 없습니다.")
        _require(
            isinstance(company_as_of.get("price"), str) and bool(company_as_of["price"]),
            f"{ticker}의 asOf.price가 없습니다.",
        )
        _require(
            isinstance(company_as_of.get("financial"), str) and bool(company_as_of["financial"]),
            f"{ticker}의 asOf.financial이 없습니다.",
        )
        metrics = company.get("metrics")
        _require(isinstance(metrics, dict), f"{ticker}의 metrics 객체가 없습니다.")
        _require(
            all(
                value is None or (
                    isinstance(value, (int, float)) and
                    not isinstance(value, bool) and
                    math.isfinite(value)
                )
                for value in metrics.values()
            ),
            f"{ticker}의 metrics에 유한수가 아닌 값이 있습니다.",
        )
        scores = company.get("scores")
        _require(isinstance(scores, dict), f"{ticker}의 scores 객체가 없습니다.")
        missing = sorted(required_scores - set(scores))
        _require(not missing, f"{ticker}에 점수 자리가 없습니다: {missing}")
        _require(set(scores) == required_scores, f"{ticker}의 scores style 집합이 다릅니다.")
        for style_id in style_ids:
            score = scores[style_id]
            _require(isinstance(score, dict), f"{ticker}/{style_id}의 score가 객체가 아닙니다.")
            _require(score.get("styleId") == style_id, f"{ticker}/{style_id}의 styleId가 다릅니다.")
            _require(
                isinstance(score.get("modelVersion"), str) and bool(score["modelVersion"]),
                f"{ticker}/{style_id}의 modelVersion이 비어 있습니다.",
            )
            value = score.get("score")
            _require(
                value is None or (
                    isinstance(value, (int, float)) and
                    not isinstance(value, bool) and
                    math.isfinite(value)
                ),
                f"{ticker}/{style_id}의 score가 올바르지 않습니다.",
            )
            for field in ("passed", "totalJudged", "total"):
                count = score.get(field)
                _require(
                    isinstance(count, int) and not isinstance(count, bool) and count >= 0,
                    f"{ticker}/{style_id}의 {field}가 올바르지 않습니다.",
                )
            _require(
                isinstance(score.get("dataConfidence"), str),
                f"{ticker}/{style_id}의 dataConfidence가 문자열이 아닙니다.",
            )
            for field in ("criteria", "reasons", "risks"):
                _require(isinstance(score.get(field), list), f"{ticker}/{style_id}의 {field}가 배열이 아닙니다.")
            for criterion in score["criteria"]:
                _require(isinstance(criterion, dict), f"{ticker}/{style_id}의 criterion이 객체가 아닙니다.")
                _require(
                    isinstance(criterion.get("code"), str) and bool(criterion["code"]),
                    f"{ticker}/{style_id}의 criterion code가 비어 있습니다.",
                )
                _require(
                    criterion.get("status") in {"pass", "fail", "unknown"},
                    f"{ticker}/{style_id}/{criterion.get('code')}의 status가 올바르지 않습니다.",
                )
    _require(
        len(normalized_tickers) == len(set(normalized_tickers)),
        "companies[].ticker가 대소문자 구분 없이 중복됐습니다.",
    )

    universe = payload.get("universe")
    _require(isinstance(universe, dict), "universe 객체가 없습니다.")
    _require(
        isinstance(universe.get("included"), int) and not isinstance(universe["included"], bool),
        "universe.included가 정수가 아닙니다.",
    )
    _require(
        universe["included"] == len(companies),
        "universe.included와 companies 개수가 다릅니다.",
    )
    _require(
        isinstance(universe.get("requested"), int) and universe["requested"] >= universe["included"],
        "universe.requested가 included보다 작거나 정수가 아닙니다.",
    )

    if minimum_price_refresh_ratio is not None:
        price_at = as_of.get("priceAt")
        coverage = as_of.get("priceCoverage")
        _require(isinstance(price_at, str) and bool(price_at), "가격 갱신 결과에 asOf.priceAt이 없습니다.")
        try:
            parsed_price_at = datetime.fromisoformat(price_at)
        except ValueError as exc:
            raise ScoresContractError("asOf.priceAt이 ISO-8601 시각이 아닙니다.") from exc
        _require(
            parsed_price_at.utcoffset() == timedelta(hours=9),
            "asOf.priceAt은 KST(+09:00) 시각이어야 합니다.",
        )
        _require(isinstance(coverage, dict), "가격 갱신 결과에 asOf.priceCoverage가 없습니다.")
        refreshed = coverage.get("refreshed")
        total = coverage.get("total")
        _require(
            isinstance(refreshed, int) and not isinstance(refreshed, bool) and
            isinstance(total, int) and not isinstance(total, bool),
            "asOf.priceCoverage 값이 정수가 아닙니다.",
        )
        for company in companies:
            company_price_at = company["asOf"].get("priceAt")
            _require(
                company_price_at is None or company_price_at == price_at,
                f"{company['ticker']}의 priceAt이 파일 기준 시각과 다릅니다.",
            )
            if company_price_at is not None:
                _require(
                    company["asOf"]["price"] == price_at[:10],
                    f"{company['ticker']}의 가격 날짜와 priceAt 날짜가 다릅니다.",
                )
        actual_refreshed = sum(company["asOf"].get("priceAt") == price_at for company in companies)
        _require(total == len(companies), "priceCoverage.total과 companies 개수가 다릅니다.")
        _require(refreshed == actual_refreshed, "priceCoverage.refreshed와 종목별 priceAt이 다릅니다.")
        _require(
            refreshed / total >= minimum_price_refresh_ratio,
            f"가격 갱신 비율이 {refreshed}/{total}로 최소 {minimum_price_refresh_ratio:.0%}보다 낮습니다.",
        )
    return payload


def load_scores(
    path: Path,
    *,
    expected_source: str | None = None,
    minimum_companies: int = 1,
    minimum_price_refresh_ratio: float | None = None,
) -> dict:
    with path.open(encoding="utf-8") as handle:
        payload = json.load(handle)
    return validate_scores_payload(
        payload,
        expected_source=expected_source,
        minimum_companies=minimum_companies,
        minimum_price_refresh_ratio=minimum_price_refresh_ratio,
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("path", type=Path)
    parser.add_argument("--expected-source")
    parser.add_argument("--minimum-companies", type=int, default=1)
    parser.add_argument("--minimum-price-refresh-ratio", type=float)
    parser.add_argument("--print-company-count", action="store_true")
    args = parser.parse_args()
    payload = load_scores(
        args.path,
        expected_source=args.expected_source,
        minimum_companies=args.minimum_companies,
        minimum_price_refresh_ratio=args.minimum_price_refresh_ratio,
    )
    print(len(payload["companies"]) if args.print_company_count else payload["generatedAt"])


if __name__ == "__main__":
    main()
