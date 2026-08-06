"""토스증권 시세와 SEC XBRL 공시를 결합한 미국주식 실데이터 공급자."""

from __future__ import annotations

import json
import time
from datetime import datetime, timedelta
from typing import Callable
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

from ..metrics import Fundamentals

JsonGetter = Callable[[str, dict[str, str] | None], dict]

SEC_TICKERS_URL = "https://www.sec.gov/files/company_tickers.json"
SEC_FACTS_URL = "https://data.sec.gov/api/xbrl/companyfacts/CIK{cik}.json"
# 업종(sicDescription)은 companyfacts에 없다. 여기에만 있다.
SEC_SUBMISSIONS_URL = "https://data.sec.gov/submissions/CIK{cik}.json"
TOSS_BASE = "https://openapi.tossinvest.com"


class ProviderDataError(RuntimeError):
    pass


def _get_json(url: str, headers: dict[str, str] | None = None) -> dict:
    request = Request(url, headers=headers or {})
    try:
        with urlopen(request, timeout=30) as response:
            return json.load(response)
    except HTTPError as error:
        raise ProviderDataError(f"HTTP {error.code}: {url}") from error
    except (URLError, TimeoutError) as error:
        raise ProviderDataError(f"요청 실패: {url} ({error})") from error


def _annual_values(
    company_facts: dict,
    tags: tuple[str, ...],
    unit: str = "USD",
    duration: bool = True,
) -> dict[str, float]:
    us_gaap = company_facts.get("facts", {}).get("us-gaap", {})
    merged: dict[str, float] = {}
    for tag in tags:
        entries = us_gaap.get(tag, {}).get("units", {}).get(unit, [])
        selected: dict[str, dict] = {}
        for entry in entries:
            if not str(entry.get("form", "")).startswith("10-K"):
                continue
            if not entry.get("end") or not isinstance(entry.get("val"), (int, float)):
                continue
            if duration:
                if not entry.get("start"):
                    continue
                days = (datetime.fromisoformat(entry["end"]) - datetime.fromisoformat(entry["start"])).days
                if not 300 <= days <= 430:
                    continue
            end = entry["end"]
            if end not in selected or entry.get("filed", "") > selected[end].get("filed", ""):
                selected[end] = entry
        # 앞쪽 태그를 우선하되, 회사가 공시 태그를 바꾼 연도는 뒤쪽 대체 태그로 채운다.
        for end, entry in selected.items():
            merged.setdefault(end, float(entry["val"]))
    return merged


def _latest_value(company_facts: dict, tags: tuple[str, ...], duration: bool = False) -> float | None:
    values = _annual_values(company_facts, tags, duration=duration)
    return values[max(values)] if values else None


def fundamentals_from_sec(
    ticker: str,
    stock: dict,
    price: dict,
    company_facts: dict,
    submissions: dict,
) -> Fundamentals:
    revenue = _annual_values(company_facts, (
        "RevenueFromContractWithCustomerExcludingAssessedTax", "Revenues", "SalesRevenueNet",
    ))
    ebit = _annual_values(company_facts, ("OperatingIncomeLoss",))
    net_income = _annual_values(company_facts, ("NetIncomeLoss", "ProfitLoss"))
    operating_cash = _annual_values(company_facts, ("NetCashProvidedByUsedInOperatingActivities",))
    capex = _annual_values(company_facts, (
        "PaymentsToAcquirePropertyPlantAndEquipment",
        "PaymentsToAcquireProductiveAssets",
        "PaymentsToAcquireOtherProductiveAssets",
        "PaymentsForProceedsFromProductiveAssets",
    ))
    equity = _annual_values(company_facts, (
        "StockholdersEquity", "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest",
    ), duration=False)
    assets = _annual_values(company_facts, ("Assets",), duration=False)
    current_liabilities = _annual_values(company_facts, ("LiabilitiesCurrent",), duration=False)
    cash = _annual_values(company_facts, (
        "CashAndCashEquivalentsAtCarryingValue", "CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents",
    ), duration=False)
    eps = _annual_values(company_facts, ("EarningsPerShareDiluted",), unit="USD/shares")

    required_by_name = {
        "revenue": revenue,
        "ebit": ebit,
        "netIncome": net_income,
        "operatingCash": operating_cash,
        "capex": capex,
        "equity": equity,
        "assets": assets,
        "currentLiabilities": current_liabilities,
        "cash": cash,
    }
    required = list(required_by_name.values())
    common_ends = sorted(set.intersection(*(set(values) for values in required)))[-5:]
    if len(common_ends) < 5:
        counts = ", ".join(f"{name}={len(values)}" for name, values in required_by_name.items())
        raise ProviderDataError(
            f"{ticker}: 공통된 5개 회계연도 공시를 구성할 수 없습니다({counts}, common={len(common_ends)})."
        )

    million = 1_000_000
    fcf = [(operating_cash[end] - capex[end]) / million for end in common_ends]
    invested_capital = [
        (assets[end] - current_liabilities[end] - cash[end]) / million for end in common_ends
    ]
    eps_series = [eps[end] for end in common_ends if end in eps]

    debt = _latest_value(company_facts, (
        "LongTermDebtAndFinanceLeaseObligations", "LongTermDebt", "LongTermDebtNoncurrent",
    ))
    # 태그는 회사마다 다르다. 넓은 항목부터 좁은 항목 순으로 두고 앞쪽을 우선한다.
    interest = _latest_value(company_facts, (
        "InterestExpenseNonOperating", "InterestExpense", "InterestAndDebtExpense",
    ), duration=True)
    depreciation = _latest_value(company_facts, (
        "DepreciationDepletionAndAmortization", "DepreciationDepletionAndAmortizationPropertyPlantAndEquipment",
        "DepreciationAndAmortization", "Depreciation",
    ), duration=True)

    return Fundamentals(
        ticker=ticker,
        name=stock["name"],
        sector=submissions.get("sicDescription") or "분류 없음",
        price=float(price["closePrice"]),
        shares_out=float(stock["sharesOutstanding"]) / million,
        price_as_of=price["timestamp"][:10],
        financial_as_of=common_ends[-1],
        revenue=[revenue[end] / million for end in common_ends],
        ebit=[ebit[end] / million for end in common_ends],
        net_income=[net_income[end] / million for end in common_ends],
        fcf=fcf,
        invested_capital=invested_capital,
        equity=[equity[end] / million for end in common_ends],
        eps=eps_series,
        total_debt=None if debt is None else debt / million,
        cash=cash[common_ends[-1]] / million,
        interest_expense=None if interest is None else interest / million,
        depreciation=None if depreciation is None else depreciation / million,
        current_assets=(
            None if (value := _latest_value(company_facts, ("AssetsCurrent",))) is None else value / million
        ),
        current_liabilities=current_liabilities[common_ends[-1]] / million,
    )


class SecTossProvider:
    source_name = "sec-toss"

    def __init__(
        self,
        toss_client_id: str,
        toss_client_secret: str,
        sec_user_agent: str,
        universe: list[str],
        get_json: JsonGetter = _get_json,
    ):
        if not toss_client_id or not toss_client_secret:
            raise ValueError("토스증권 client_id와 client_secret이 필요합니다.")
        if "@" not in sec_user_agent:
            raise ValueError("SEC User-Agent에는 연락 가능한 이메일이 필요합니다.")
        self.toss_client_id = toss_client_id
        self.toss_client_secret = toss_client_secret
        self.sec_headers = {"User-Agent": sec_user_agent}
        self.universe = [ticker.upper() for ticker in universe]
        self.get_json = get_json
        self._as_of: dict[str, str] | None = None

    def _token(self) -> str:
        body = urlencode({
            "grant_type": "client_credentials",
            "client_id": self.toss_client_id,
            "client_secret": self.toss_client_secret,
        }).encode()
        request = Request(
            f"{TOSS_BASE}/oauth2/token",
            data=body,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        try:
            with urlopen(request, timeout=30) as response:
                payload = json.load(response)
        except HTTPError as error:
            raise ProviderDataError(f"토스 인증 실패(HTTP {error.code})") from error
        return payload["access_token"]

    def _toss_get(self, path: str, token: str) -> dict:
        return self.get_json(f"{TOSS_BASE}{path}", {"Authorization": f"Bearer {token}"})

    def load(self) -> list[Fundamentals]:
        token = self._token()
        symbols = ",".join(self.universe)
        stock_rows = self._toss_get(f"/api/v1/stocks?{urlencode({'symbols': symbols})}", token)["result"]
        stocks = {row["symbol"].upper(): row for row in stock_rows}

        ticker_rows = self.get_json(SEC_TICKERS_URL, self.sec_headers)
        cik_by_ticker = {
            row["ticker"].upper(): str(row["cik_str"]).zfill(10)
            for row in ticker_rows.values()
        }
        new_york = ZoneInfo("America/New_York")
        before = datetime.now(new_york).date() - timedelta(days=1)
        before_iso = datetime(
            before.year, before.month, before.day, 23, 59, 59, tzinfo=new_york
        ).isoformat()

        companies: list[Fundamentals] = []
        for ticker in self.universe:
            try:
                stock = stocks[ticker]
                candle_path = "/api/v1/candles?" + urlencode({
                    "symbol": ticker, "interval": "1d", "count": 1,
                    "before": before_iso, "adjusted": "true",
                })
                candle = self._toss_get(candle_path, token)["result"]["candles"][0]
                cik = cik_by_ticker[ticker]
                facts = self.get_json(SEC_FACTS_URL.format(cik=cik), self.sec_headers)
                submissions = self.get_json(SEC_SUBMISSIONS_URL.format(cik=cik), self.sec_headers)
                companies.append(fundamentals_from_sec(ticker, stock, candle, facts, submissions))
            except (KeyError, IndexError, ProviderDataError) as error:
                print(f"[공급자] {ticker} 제외: {error}")
            time.sleep(0.22)

        if not companies:
            raise ProviderDataError("실데이터로 구성할 수 있는 종목이 없습니다.")
        self._as_of = {
            "price": min(company.price_as_of for company in companies),
            "financial": min(company.financial_as_of for company in companies),
        }
        return companies

    def as_of(self) -> dict[str, str]:
        if self._as_of is None:
            raise RuntimeError("load()를 먼저 호출해야 합니다.")
        return self._as_of
