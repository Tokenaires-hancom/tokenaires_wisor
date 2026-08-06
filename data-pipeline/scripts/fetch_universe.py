#!/usr/bin/env python3
"""지수 구성종목 목록을 받아 data/universe_us.json으로 저장한다.

    python scripts/fetch_universe.py

배치가 이 스크립트를 부르지 않는다. 목록을 파일로 굳혀 두고 사람이 갱신한다.
배치가 매번 남의 사이트 HTML 구조에 기대면, 그쪽이 표를 바꾼 날 배치가 죽고
어제와 오늘의 결과를 비교할 수도 없다.

출처가 둘인 이유: Wikipedia의 Nasdaq-100 문서는 구성종목 표를 더 이상 싣지 않고
nasdaq.com으로 링크만 건다(2026-08-06 확인). S&P 500 문서에는 표가 남아 있다.

지수 편입·편출은 수시로 일어난다. 이 파일의 fetchedAt이 오래됐으면 다시 돌린다.
"""

from __future__ import annotations

import json
import re
import urllib.request
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "universe_us.json"

SP500_URL = "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies"
NASDAQ100_URL = "https://www.slickcharts.com/nasdaq100"
SEC_TICKERS_URL = "https://www.sec.gov/files/company_tickers.json"

UA = "Mozilla/5.0 (compatible; Wisor/0.1; baro@ivyflynet.top)"


def fetch(url: str) -> str:
    request = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(request, timeout=90) as response:
        return response.read().decode("utf-8", "replace")


def cells(row: str) -> list[str]:
    raw = re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", row, re.S)
    return [re.sub(r"<[^>]+>", "", c).replace("&amp;", "&").strip() for c in raw]


def rows_of(html: str, marker: str) -> list[str]:
    table = html.split(marker, 1)[1].split("</table>", 1)[0]
    return re.findall(r"<tr[^>]*>(.*?)</tr>", table, re.S)


def sp500() -> dict[str, dict]:
    found: dict[str, dict] = {}
    for row in rows_of(fetch(SP500_URL), 'id="constituents"'):
        parts = cells(row)
        if len(parts) < 4:
            continue
        ticker = parts[0]
        if re.fullmatch(r"[A-Z][A-Z.\-]{0,6}", ticker):
            found[ticker] = {"name": parts[1], "gicsSector": parts[2]}
    return found


def nasdaq100() -> dict[str, dict]:
    found: dict[str, dict] = {}
    html = fetch(NASDAQ100_URL)
    for row in rows_of(html, "<table"):
        parts = re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", row, re.S)
        if len(parts) < 3:
            continue
        match = re.search(r"/symbol/([A-Z.\-]+)", parts[2])
        if match:
            found[match.group(1)] = {"name": cells(row)[1]}
    return found


def sec_tickers() -> set[str]:
    """SEC에 등록된 티커. 여기 없으면 CIK를 못 찾아 배치에서 어차피 빠진다."""
    rows = json.loads(fetch(SEC_TICKERS_URL))
    return {row["ticker"].upper() for row in rows.values()}


def sec_form(ticker: str) -> str:
    """주식종류 표기를 SEC 방식으로. 지수 목록은 BRK.B, SEC는 BRK-B로 쓴다."""
    return ticker.replace(".", "-")


def main() -> None:
    sp, nq = sp500(), nasdaq100()
    print(f"[출처] S&P 500 {len(sp)}종목 · NASDAQ-100 {len(nq)}종목")
    if len(sp) < 450 or len(nq) < 90:
        raise SystemExit("구성종목 수가 비정상입니다. 출처 페이지 구조가 바뀌었는지 확인하세요.")

    registered = sec_tickers()
    companies, missing = [], []
    for ticker in sorted(set(sp) | set(nq)):
        indexes = [n for n, s in (("sp500", sp), ("nasdaq100", nq)) if ticker in s]
        entry = sp.get(ticker) or nq[ticker]
        symbol = sec_form(ticker)
        if symbol not in registered:
            missing.append(ticker)
            continue
        companies.append({
            "ticker": symbol,
            "name": entry.get("name", ""),
            "indexes": indexes,
            **({"gicsSector": entry["gicsSector"]} if "gicsSector" in entry else {}),
        })

    if missing:
        print(f"[제외] SEC 등록 티커에 없어 뺍니다({len(missing)}): {', '.join(missing)}")

    OUT.write_text(json.dumps({
        "fetchedAt": date.today().isoformat(),
        "sources": {"sp500": SP500_URL, "nasdaq100": NASDAQ100_URL, "secTickers": SEC_TICKERS_URL},
        "note": "지수 구성종목은 수시로 바뀝니다. 갱신은 python scripts/fetch_universe.py",
        "companies": companies,
    }, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[출력] {OUT} · {len(companies)}종목")


if __name__ == "__main__":
    main()
