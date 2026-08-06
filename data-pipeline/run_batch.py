#!/usr/bin/env python3
"""하루 한 번 도는 배치. 재무데이터 → 지표 → 스타일 점수 → scores.json.

    python run_batch.py                 # 예시 데이터로 실행
    python run_batch.py --out ../apps/web/lib/generated/scores.json

웹 앱은 이 파일 하나만 읽는다. 화면 코드가 재무 원천을 직접 만지지 않게 하기 위해서다.
"""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

from wisor_data import metrics, quality
from wisor_data.providers.base import SampleProvider
from wisor_data.styles import buffett, graham, greenblatt, lynch

THRESHOLD_STYLES = [buffett.STYLE, graham.STYLE, lynch.STYLE]
STYLES = [*THRESHOLD_STYLES, greenblatt.STYLE]

ROOT = Path(__file__).resolve().parent
DEFAULT_OUT = ROOT.parent / "apps" / "web" / "lib" / "generated" / "scores.json"


def build(provider) -> dict:
    companies = provider.load()
    passed, issues = quality.partition(companies)

    fatal = [i for i in issues if i.fatal]
    warn = [i for i in issues if not i.fatal]
    print(f"[품질] 입력 {len(companies)}종목 · 통과 {len(passed)}종목 "
          f"· 치명 {len(fatal)}건 · 경고 {len(warn)}건")
    for i in issues:
        print(f"  {'✗' if i.fatal else '!'} {i.ticker} {i.code}: {i.message}")

    prepared = [(fundamentals, metrics.compute(fundamentals)) for fundamentals in passed]
    greenblatt_scores = greenblatt.score_universe(
        {fundamentals.ticker: computed for fundamentals, computed in prepared}
    )

    rows = []
    for f, m in prepared:
        scores = {s.id: s.score(m).to_dict() for s in THRESHOLD_STYLES}
        scores[greenblatt.STYLE.id] = greenblatt_scores[f.ticker].to_dict()
        rows.append({
            "ticker": f.ticker,
            "name": f.name,
            "sector": f.sector,
            "price": f.price,
            "marketCap": m.market_cap,
            "asOf": {"price": f.price_as_of, "financial": f.financial_as_of},
            "metrics": {
                "roicAvg5y": m.roic_avg_5y,
                "fcfMargin": m.fcf_margin,
                "fcfYield": m.fcf_yield,
                "netDebtToEbitda": m.net_debt_to_ebitda,
                "interestCoverage": m.interest_coverage,
                "revenueCagr5y": m.revenue_cagr_5y,
                "epsCagr5y": m.eps_cagr_5y,
                "pe": m.pe,
                "pbr": m.pbr,
                "peg": m.peg,
                "currentRatio": m.current_ratio,
                "debtToEquity": m.debt_to_equity,
                "evEbit": m.ev_ebit,
                "earningsYield": m.earnings_yield,
            },
            "scores": scores,
        })

    return {
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "dataSource": provider.source_name,
        "asOf": provider.as_of(),
        "styles": [
            {
                "id": s.id,
                "name": s.name,
                "modelVersion": s.model_version,
                "method": getattr(s, "method", "threshold"),
                "criteria": [
                    {"code": c.code, "label": c.label, "weight": c.weight, "detail": c.detail}
                    for c in s.criteria
                ],
            }
            for s in STYLES
        ],
        "companies": rows,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--universe", default=str(ROOT / "data" / "universe_sample.json"))
    parser.add_argument("--out", default=str(DEFAULT_OUT))
    args = parser.parse_args()

    provider = SampleProvider(Path(args.universe))
    payload = build(provider)

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"\n[출력] {out} · {len(payload['companies'])}종목")
    for style in payload["styles"]:
        ranked = sorted(
            (c for c in payload["companies"] if c["scores"][style["id"]]["score"] is not None),
            key=lambda c: c["scores"][style["id"]]["score"],
            reverse=True,
        )[:3]
        top = " · ".join(
            f"{c['ticker']} {c['scores'][style['id']]['score']}점" for c in ranked
        )
        print(f"  {style['modelVersion']:<12} {top}")


if __name__ == "__main__":
    main()
