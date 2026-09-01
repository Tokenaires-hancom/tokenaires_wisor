#!/usr/bin/env python3
# 서버의 /usr/local/libexec/wisor-validate-scores.py 는 이 파일에서 나옵니다.
# 여기가 원본입니다. main 배포가 성공하면 wisor-deploy가 덮어쓰고, 새 서버는
# bootstrap-autodeploy.sh가 설치합니다. 이 파일이 없거나 구문 검사를 통과하지
# 못하면 배포가 설치 전에 멈춥니다.
"""Reject incomplete or stale batch output before it can reach the live app."""

from __future__ import annotations

import argparse
import json
import math
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo


STYLE_IDS = {"buffett", "graham", "lynch", "greenblatt"}


def reject_constant(value: str) -> None:
    raise ValueError(f"non-finite JSON number {value}")


def read_json(path: Path) -> dict:
    try:
        value = json.loads(
            path.read_text(encoding="utf-8"),
            parse_constant=reject_constant,
        )
    except (OSError, json.JSONDecodeError, ValueError) as error:
        raise SystemExit(f"invalid JSON {path}: {error}") from error
    if not isinstance(value, dict):
        raise SystemExit(f"top-level JSON value must be an object: {path}")
    return value


def parse_timestamp(value: object, label: str) -> datetime:
    if not isinstance(value, str) or not value:
        raise SystemExit(f"{label} is missing")
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as error:
        raise SystemExit(f"{label} is not an ISO timestamp: {value}") from error
    if parsed.tzinfo is None:
        raise SystemExit(f"{label} must include a timezone")
    return parsed.astimezone(timezone.utc)


def company_map(payload: dict, label: str) -> dict[str, dict]:
    companies = payload.get("companies")
    if not isinstance(companies, list):
        raise SystemExit(f"{label}.companies must be a list")
    found: dict[str, dict] = {}
    for row in companies:
        if not isinstance(row, dict):
            raise SystemExit(f"{label}.companies contains a non-object")
        ticker = row.get("ticker")
        if not isinstance(ticker, str) or not ticker:
            raise SystemExit(f"{label}.companies contains an empty ticker")
        if ticker in found:
            raise SystemExit(f"{label}.companies contains duplicate ticker {ticker}")
        found[ticker] = row
    return found


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", required=True, choices=("prices", "full"))
    parser.add_argument("--stable-scores", type=Path, required=True)
    parser.add_argument("--candidate-scores", type=Path, required=True)
    parser.add_argument("--stable-fundamentals", type=Path, required=True)
    parser.add_argument("--candidate-fundamentals", type=Path, required=True)
    parser.add_argument("--minimum-ratio", type=float, default=0.95)
    args = parser.parse_args()

    stable = read_json(args.stable_scores)
    candidate = read_json(args.candidate_scores)
    stable_companies = company_map(stable, "stable scores")
    candidate_companies = company_map(candidate, "candidate scores")

    if candidate.get("dataSource") != "sec-toss":
        raise SystemExit("candidate dataSource must be sec-toss")
    style_ids = {
        row.get("id")
        for row in candidate.get("styles", [])
        if isinstance(row, dict)
    }
    if style_ids != STYLE_IDS:
        raise SystemExit(f"candidate style IDs differ: {sorted(style_ids)}")

    minimum = math.ceil(len(stable_companies) * args.minimum_ratio)
    if len(candidate_companies) < minimum:
        raise SystemExit(
            f"candidate company count {len(candidate_companies)} is below minimum {minimum}"
        )
    if args.mode == "prices" and candidate_companies.keys() != stable_companies.keys():
        missing = sorted(stable_companies.keys() - candidate_companies.keys())[:5]
        added = sorted(candidate_companies.keys() - stable_companies.keys())[:5]
        raise SystemExit(f"price refresh changed the universe; missing={missing}, added={added}")

    for ticker, row in candidate_companies.items():
        price = row.get("price")
        if (
            not isinstance(price, (int, float))
            or isinstance(price, bool)
            or not math.isfinite(price)
            or price <= 0
        ):
            raise SystemExit(f"{ticker} has a missing or non-positive price")
        scores = row.get("scores")
        if not isinstance(scores, dict) or not STYLE_IDS.issubset(scores):
            raise SystemExit(f"{ticker} does not contain all four style results")

    stable_generated = parse_timestamp(stable.get("generatedAt"), "stable generatedAt")
    generated = parse_timestamp(candidate.get("generatedAt"), "candidate generatedAt")
    now = datetime.now(timezone.utc)
    if generated <= stable_generated:
        raise SystemExit("candidate generatedAt did not advance")
    if generated < now - timedelta(hours=2) or generated > now + timedelta(minutes=5):
        raise SystemExit("candidate generatedAt is not fresh")
    expected_price_date = generated.astimezone(ZoneInfo("Asia/Seoul")).date().isoformat()
    refreshed = sum(
        isinstance(row.get("asOf"), dict)
        and row["asOf"].get("price") == expected_price_date
        for row in candidate_companies.values()
    )
    required_refreshed = math.ceil(len(candidate_companies) * 0.95)
    if refreshed < required_refreshed:
        raise SystemExit(
            f"only {refreshed}/{len(candidate_companies)} company prices were refreshed; "
            f"minimum is {required_refreshed}"
        )
    regressed: list[str] = []
    for ticker, row in candidate_companies.items():
        stable_row = stable_companies.get(ticker)
        candidate_as_of = row.get("asOf")
        stable_as_of = stable_row.get("asOf") if isinstance(stable_row, dict) else None
        if not isinstance(candidate_as_of, dict) or not isinstance(stable_as_of, dict):
            continue
        candidate_date = candidate_as_of.get("price")
        stable_date = stable_as_of.get("price")
        if isinstance(candidate_date, str) and isinstance(stable_date, str):
            if candidate_date < stable_date:
                regressed.append(ticker)
    if regressed:
        raise SystemExit(f"price as-of date regressed for: {sorted(regressed)[:5]}")

    stable_fundamentals = read_json(args.stable_fundamentals)
    candidate_fundamentals = read_json(args.candidate_fundamentals)
    stable_fundamental_companies = company_map(stable_fundamentals, "stable fundamentals")
    candidate_fundamental_companies = company_map(candidate_fundamentals, "candidate fundamentals")
    fundamental_minimum = math.ceil(len(stable_fundamental_companies) * args.minimum_ratio)
    if len(candidate_fundamental_companies) < fundamental_minimum:
        raise SystemExit(
            "candidate fundamentals company count "
            f"{len(candidate_fundamental_companies)} is below minimum {fundamental_minimum}"
        )
    if args.mode == "prices" and candidate_fundamentals != stable_fundamentals:
        raise SystemExit("price refresh unexpectedly changed the fundamentals cache")
    if args.mode == "full":
        old_built = parse_timestamp(stable_fundamentals.get("builtAt"), "stable fundamentals builtAt")
        new_built = parse_timestamp(
            candidate_fundamentals.get("builtAt"), "candidate fundamentals builtAt"
        )
        if (
            new_built <= old_built
            or new_built < now - timedelta(hours=3)
            or new_built > now + timedelta(minutes=5)
        ):
            raise SystemExit("candidate fundamentals cache was not freshly rebuilt")

    print(
        "QUALITY_OK "
        f"mode={args.mode} generatedAt={candidate['generatedAt']} "
        f"companies={len(candidate_companies)} fundamentals={len(candidate_fundamental_companies)}"
    )


if __name__ == "__main__":
    main()
