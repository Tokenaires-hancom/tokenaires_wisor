#!/usr/bin/env python3
"""하루 한 번 도는 배치. 재무데이터 → 지표 → 스타일 점수 → scores.json.

    python run_batch.py                 # 예시 데이터로 실행
    python run_batch.py --out ../apps/web/lib/generated/scores.json

웹 앱은 이 파일 하나만 읽는다. 화면 코드가 재무 원천을 직접 만지지 않게 하기 위해서다.
"""

from __future__ import annotations

import argparse
import json
import os
from datetime import datetime, timezone
from pathlib import Path

from wisor_data import metrics, quality
from wisor_data.coverage import UNSCORABLE_REASON, is_scorable
from wisor_data.providers.base import SampleProvider
from wisor_data.providers.sec_toss import SecTossProvider
from wisor_data.styles import buffett, graham, greenblatt, lynch
from wisor_data.styles.base import StyleScore

THRESHOLD_STYLES = [buffett.STYLE, graham.STYLE, lynch.STYLE]
STYLES = [*THRESHOLD_STYLES, greenblatt.STYLE]

ROOT = Path(__file__).resolve().parent
DEFAULT_OUT = ROOT.parent / "apps" / "web" / "lib" / "generated" / "scores.json"


def _unscorable(style) -> StyleScore:
    """판정 대상이 아닌 업종의 자리. 화면이 스타일 항목을 찾으므로 비워 두지 않는다.

    '정보 부족'과 구분해야 한다. 데이터는 다 있고, 맞지 않는 것은 모델 쪽이다.
    """
    return StyleScore(
        style_id=style.id,
        model_version=style.model_version,
        score=None,
        passed=0,
        total_judged=0,
        total=len(style.criteria),
        data_confidence="판정 대상 아님",
    )


def _universe_report(provider, universe_meta: dict | None, passed, issues) -> dict:
    """유니버스에 무엇이 들어왔고 무엇이 왜 빠졌는지.

    지금까지 이 정보는 배치 로그(stdout)에만 있었다. 화면에서 '무엇을 배제했나'를
    설명하려면 결과 파일에 남아 있어야 한다.

    종목은 두 단계에서 빠진다. 공급자 단계(공시를 구성하지 못함)와 품질 게이트
    (구성했지만 내보낼 수 없음)다. 사용자에게는 한 덩어리로 보여야 하므로 합친다.
    """
    reasons: dict[str, str] = {}
    for row in getattr(provider, "excluded", lambda: [])():
        reasons.setdefault(row["ticker"], row["code"])
    for issue in issues:
        # 한 종목이 여러 이유로 걸려도 한 번만 센다. 그래야 요청 = 수록 + 배제가 맞는다.
        if issue.fatal:
            reasons.setdefault(issue.ticker, issue.code)

    grouped: dict[str, list[str]] = {}
    for ticker, code in reasons.items():
        grouped.setdefault(code, []).append(ticker)

    meta = universe_meta or {}
    return {
        "indexes": meta.get("indexes", []),
        "fetchedAt": meta.get("fetchedAt", ""),
        "requested": len(passed) + len(reasons),
        "included": len(passed),
        "excluded": [
            {"code": code, "count": len(tickers), "examples": sorted(tickers)[:3]}
            for code, tickers in sorted(grouped.items(), key=lambda kv: (-len(kv[1]), kv[0]))
        ],
    }


def build(provider, universe_meta: dict | None = None) -> dict:
    companies = provider.load()
    passed, issues = quality.partition(companies)

    fatal = [i for i in issues if i.fatal]
    warn = [i for i in issues if not i.fatal]
    print(f"[품질] 입력 {len(companies)}종목 · 통과 {len(passed)}종목 "
          f"· 치명 {len(fatal)}건 · 경고 {len(warn)}건")
    for i in issues:
        print(f"  {'✗' if i.fatal else '!'} {i.ticker} {i.code}: {i.message}")

    prepared = [(fundamentals, metrics.compute(fundamentals)) for fundamentals in passed]

    # 판정 대상이 아닌 업종은 상대 순위의 모수에서도 뺀다. 넣으면 사업회사의 순위가 밀린다.
    scorable = [(f, m) for f, m in prepared if is_scorable(f)]
    greenblatt_scores = greenblatt.score_universe(
        {fundamentals.ticker: computed for fundamentals, computed in scorable}
    )
    skipped = len(prepared) - len(scorable)
    if skipped:
        print(f"[업종] {skipped}종목은 판정 대상이 아닙니다(은행·보험·부동산). 지표는 그대로 내보냅니다.")

    rows = []
    for f, m in prepared:
        if is_scorable(f):
            scores = {s.id: s.score(m).to_dict() for s in THRESHOLD_STYLES}
            scores[greenblatt.STYLE.id] = greenblatt_scores[f.ticker].to_dict()
        else:
            scores = {s.id: _unscorable(s).to_dict() for s in STYLES}
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
            **({} if is_scorable(f) else {"scorable": False, "unscorableReason": UNSCORABLE_REASON}),
        })

    # 기준일은 실제로 내보낸 종목만 설명해야 한다. 공급자는 품질 게이트에서
    # 탈락한 종목까지 넣어 계산하므로, 화면에 아무 종목도 해당하지 않는 날짜가 찍혔다.
    as_of = {
        "price": min(f.price_as_of for f, _ in prepared),
        "financial": min(f.financial_as_of for f, _ in prepared),
    } if prepared else provider.as_of()

    return {
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "dataSource": provider.source_name,
        "asOf": as_of,
        "universe": _universe_report(provider, universe_meta, passed, issues),
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
    parser.add_argument("--provider", choices=("sample", "sec-toss"), default="sample")
    parser.add_argument("--universe", default=str(ROOT / "data" / "universe_sample.json"))
    parser.add_argument("--out", default=str(DEFAULT_OUT))
    parser.add_argument(
        "--checkpoint",
        default=str(ROOT / ".cache" / "sec-toss.jsonl"),
        help="중간에 끊겼을 때 이어받을 파일. 같은 날 종가에 대해서만 재사용한다",
    )
    parser.add_argument("--limit", type=int, help="유니버스 앞에서 N종목만 (시험 실행용)")
    args = parser.parse_args()

    universe_path = Path(args.universe)
    raw_universe = json.loads(universe_path.read_text(encoding="utf-8"))
    universe_meta = {
        "indexes": sorted({name for c in raw_universe["companies"] for name in c.get("indexes", [])}),
        "fetchedAt": raw_universe.get("fetchedAt", ""),
    }
    if args.provider == "sample":
        provider = SampleProvider(universe_path)
    else:
        tickers = [company["ticker"] for company in raw_universe["companies"]]
        provider = SecTossProvider(
            toss_client_id=os.environ.get("TOSS_INVEST_CLIENT_ID", ""),
            toss_client_secret=os.environ.get("TOSS_INVEST_CLIENT_SECRET", ""),
            sec_user_agent=os.environ.get("WISOR_SEC_USER_AGENT", ""),
            universe=tickers[: args.limit] if args.limit else tickers,
            checkpoint=Path(args.checkpoint),
        )
    payload = build(provider, universe_meta)

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
