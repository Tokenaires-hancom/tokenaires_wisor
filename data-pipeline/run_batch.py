#!/usr/bin/env python3
"""재무데이터 → 지표 → 스타일 점수 → scores.json.

    python run_batch.py                                    # 예시 데이터로 실행
    python run_batch.py --provider sec-toss                # 전체 수집(하루 1회)
    python run_batch.py --provider sec-toss --mode prices  # 체결가만 갱신(3시간마다)

두 모드로 나눈 이유. 재무는 분기에 한 번 바뀌고 가격은 3시간마다 바뀐다. 가격을
갱신할 때마다 SEC를 다시 부르면 종목당 두 번씩 380종목, 하루 여덟 번이면 6천 회가
넘는다. full이 재무를 data/fundamentals.json에 남기고 prices가 그것을 읽는다.

웹 앱은 이 파일 하나만 읽는다. 화면 코드가 재무 원천을 직접 만지지 않게 하기 위해서다.
"""

from __future__ import annotations

import argparse
import json
import os
import stat
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

from wisor_data import metrics, quality
from wisor_data.coverage import (
    MAGIC_FORMULA_UNSCORABLE_REASON,
    UNSCORABLE_REASON,
    is_magic_formula_scorable,
    is_scorable,
)
from wisor_data.providers.base import SampleProvider
from wisor_data.providers.sec_toss import (
    CachedPriceProvider,
    SecTossProvider,
    read_fundamentals_cache,
)
from wisor_data.scores_contract import validate_scores_payload
from wisor_data.styles import buffett, graham, greenblatt, lynch
from wisor_data.styles.base import StyleScore

THRESHOLD_STYLES = [buffett.STYLE, graham.STYLE, lynch.STYLE]
STYLES = [*THRESHOLD_STYLES, greenblatt.STYLE]

ROOT = Path(__file__).resolve().parent
DEFAULT_OUT = ROOT.parent / "apps" / "web" / "lib" / "generated" / "scores.json"
# 기준 시각은 읽는 사람 기준으로 적는다. 화면도 이 값을 그대로 보여준다.
SEOUL = ZoneInfo("Asia/Seoul")


def write_json_atomic(path: Path, payload: dict) -> None:
    """같은 디렉터리에서 완성한 파일만 공개해 읽는 쪽에 반쪽 JSON을 보이지 않는다."""
    path.parent.mkdir(parents=True, exist_ok=True)
    mode = stat.S_IMODE(path.stat().st_mode) if path.exists() else 0o644
    fd, temporary = tempfile.mkstemp(
        dir=path.parent,
        prefix=f".{path.name}.",
        suffix=".tmp",
    )
    temporary_path = Path(temporary)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump(payload, handle, ensure_ascii=False, indent=2)
            handle.flush()
            os.fsync(handle.fileno())
        os.chmod(temporary_path, mode)
        os.replace(temporary_path, path)
        if os.name != "nt":
            directory_fd = os.open(path.parent, os.O_RDONLY | getattr(os, "O_DIRECTORY", 0))
            try:
                os.fsync(directory_fd)
            finally:
                os.close(directory_fd)
    finally:
        temporary_path.unlink(missing_ok=True)


def _unscorable(style, reason: str = UNSCORABLE_REASON) -> StyleScore:
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
        unscorable_reason=reason,
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


def build(provider, universe_meta: dict | None = None, price_at: str | None = None) -> dict:
    companies = provider.load()
    refreshed_tickers = (
        set(provider.refreshed())
        if price_at and callable(getattr(provider, "refreshed", None))
        else set()
    )
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
    magic_formula_universe = [
        (fundamentals, computed)
        for fundamentals, computed in scorable
        if is_magic_formula_scorable(fundamentals)
    ]
    greenblatt_scores = greenblatt.score_universe(
        {fundamentals.ticker: computed for fundamentals, computed in magic_formula_universe}
    )
    skipped = len(prepared) - len(scorable)
    if skipped:
        print(f"[업종] {skipped}종목은 판정 대상이 아닙니다(은행·보험·부동산). 지표는 그대로 내보냅니다.")

    rows = []
    for f, m in prepared:
        if is_scorable(f):
            scores = {s.id: s.score(m).to_dict() for s in THRESHOLD_STYLES}
            if is_magic_formula_scorable(f):
                scores[greenblatt.STYLE.id] = greenblatt_scores[f.ticker].to_dict()
            else:
                scores[greenblatt.STYLE.id] = _unscorable(
                    greenblatt.STYLE, MAGIC_FORMULA_UNSCORABLE_REASON
                ).to_dict()
        else:
            scores = {s.id: _unscorable(s).to_dict() for s in STYLES}
        company_as_of = {"price": f.price_as_of, "financial": f.financial_as_of}
        if price_at and f.ticker in refreshed_tickers:
            company_as_of["priceAt"] = price_at
        rows.append({
            "ticker": f.ticker,
            "name": f.name,
            "sector": f.sector,
            "price": f.price,
            "marketCap": m.market_cap,
            "asOf": company_as_of,
            "metrics": {
                "roicAvg5y": m.roic_avg_5y,
                "magicFormulaRoc": m.magic_formula_roc,
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

    # 장중 체결가로 만든 파일에는 조회 시각을 함께 남긴다. 날짜만 남기면 같은 날짜인데
    # 점수가 다른 파일이 여럿 생기고, 화면은 무엇이 최신인지 말할 수 없게 된다.
    # 전 거래일 종가로 만든 파일에는 이 값이 없고, 화면은 그때 '종가'라고 쓴다.
    if price_at:
        as_of["priceAt"] = price_at
        included_tickers = {fundamentals.ticker for fundamentals, _ in prepared}
        as_of["priceCoverage"] = {
            "refreshed": len(included_tickers & refreshed_tickers),
            "total": len(included_tickers),
        }

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
    # 기본값을 두지 않는다. 예전엔 sample이 기본이라, 옵션 없이 python run_batch.py를
    # 치면 실데이터 380종목이 예시 12종목으로 덮였다. 루트 CLAUDE.md가 그 명령을
    # "커밋 전 반드시"로 안내하고 있어서, 규칙을 지키려는 사람이 정확히 그 함정에 들어갔다.
    parser.add_argument("--provider", choices=("sample", "sec-toss"), required=True)
    parser.add_argument(
        "--mode",
        choices=("full", "prices"),
        default="full",
        help="full은 SEC 공시까지 다시 받는다. prices는 캐시된 재무에 체결가만 덮어쓴다",
    )
    parser.add_argument(
        "--fundamentals-cache",
        default=str(ROOT / "data" / "fundamentals.json"),
        help="full 실행이 남기고 prices 실행이 읽는 재무 캐시. 저장소에 커밋한다",
    )
    parser.add_argument("--universe", required=True)
    parser.add_argument("--out", default=str(DEFAULT_OUT))
    parser.add_argument(
        "--checkpoint",
        default=str(ROOT / ".cache" / "sec-toss.jsonl"),
        help="중간에 끊겼을 때 이어받을 파일. 같은 날 종가에 대해서만 재사용한다",
    )
    parser.add_argument(
        "--keep-checkpoint",
        action="store_true",
        help="외부 게시 검증이 끝난 뒤 지우도록 full 체크포인트를 보존한다",
    )
    parser.add_argument("--limit", type=int, help="유니버스 앞에서 N종목만 (시험 실행용)")
    parser.add_argument(
        "--minimum-price-refresh-ratio",
        type=float,
        default=0.95,
        help="prices 결과에서 가격과 시가총액을 모두 새로 받은 최소 종목 비율",
    )
    args = parser.parse_args()
    if not 0 < args.minimum_price_refresh_ratio <= 1:
        parser.error("--minimum-price-refresh-ratio는 0보다 크고 1 이하여야 합니다.")

    universe_path = Path(args.universe)
    raw_universe = json.loads(universe_path.read_text(encoding="utf-8"))
    universe_meta = {
        "indexes": sorted({name for c in raw_universe["companies"] for name in c.get("indexes", [])}),
        "fetchedAt": raw_universe.get("fetchedAt", ""),
    }
    price_at = None
    if args.provider == "sample":
        if Path(args.out) == DEFAULT_OUT:
            parser.error(
                "예시 데이터를 화면이 읽는 scores.json에 쓸 수 없습니다. "
                "--out으로 다른 경로를 주세요. 화면에 나가는 파일은 실데이터 배치만 씁니다."
            )
        if args.mode == "prices":
            parser.error("예시 데이터에는 갱신할 체결가가 없습니다. --provider sec-toss와 함께 쓰세요.")
        provider = SampleProvider(universe_path)
    else:
        tickers = [company["ticker"] for company in raw_universe["companies"]]
        cache_path = Path(args.fundamentals_cache)
        toss = SecTossProvider(
            toss_client_id=os.environ.get("TOSS_INVEST_CLIENT_ID", ""),
            toss_client_secret=os.environ.get("TOSS_INVEST_CLIENT_SECRET", ""),
            sec_user_agent=os.environ.get("WISOR_SEC_USER_AGENT", ""),
            universe=tickers[: args.limit] if args.limit else tickers,
            checkpoint=Path(args.checkpoint),
            fundamentals_cache=cache_path,
        )
        if args.mode == "full":
            provider = toss
        else:
            # 캐시가 없으면 여기서 멈춘다. 조용히 전체 수집으로 되돌아가면 3시간마다
            # 도는 작업이 어느 날 SEC를 760번 두드리게 된다.
            companies, built_at = read_fundamentals_cache(cache_path)
            print(f"[캐시] 재무 {len(companies)}종목을 재사용합니다(수집 {built_at or '시각 미상'}).")
            price_at = datetime.now(SEOUL).isoformat(timespec="seconds")
            prices, market_caps = toss.latest_market_data()
            print(f"[가격] 체결가 {len(prices)}종목 · 기준 {price_at}")
            print(f"[market-cap] API 시가총액 {len(market_caps)}종목")
            provider = CachedPriceProvider(prices, market_caps, companies, price_at)
    payload = build(provider, universe_meta, price_at)
    validate_scores_payload(
        payload,
        expected_source=provider.source_name,
        minimum_price_refresh_ratio=(
            args.minimum_price_refresh_ratio if args.mode == "prices" else None
        ),
    )

    out = Path(args.out)
    write_json_atomic(out, payload)
    if args.provider == "sec-toss" and args.mode == "full" and not args.keep_checkpoint:
        Path(args.checkpoint).unlink(missing_ok=True)

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
