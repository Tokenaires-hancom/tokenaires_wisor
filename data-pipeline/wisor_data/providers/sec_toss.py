"""토스증권 시세와 SEC XBRL 공시를 결합한 미국주식 실데이터 공급자."""

from __future__ import annotations

import json
import time
from dataclasses import asdict
from datetime import datetime, timedelta
from pathlib import Path
from typing import Callable
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

from ..coverage import is_finance_sic
from ..metrics import Fundamentals

JsonGetter = Callable[[str, dict[str, str] | None], dict]

SEC_TICKERS_URL = "https://www.sec.gov/files/company_tickers.json"
SEC_FACTS_URL = "https://data.sec.gov/api/xbrl/companyfacts/CIK{cik}.json"
# 업종(sicDescription)은 companyfacts에 없다. 여기에만 있다.
SEC_SUBMISSIONS_URL = "https://data.sec.gov/submissions/CIK{cik}.json"
TOSS_BASE = "https://openapi.tossinvest.com"

# SEC는 초당 10회를 넘기지 말라고 요구한다. 종목당 companyfacts와 submissions
# 두 번을 부르므로 호출 사이마다 쉰다. 500종목 규모에서는 이걸 지키지 않으면
# 429가 쏟아지고, 재시도가 그걸 '느림'으로 덮어 버린다.
SEC_REQUEST_INTERVAL = 0.15
# 500종목을 URL 하나에 담지 않는다.
STOCKS_PER_REQUEST = 50


class ProviderDataError(RuntimeError):
    def __init__(
        self,
        message: str,
        retryable: bool = False,
        status: int | None = None,
        code: str = "FETCH_FAILED",
        detail: str = "",
    ):
        super().__init__(message)
        #: 다시 걸면 될 수 있는 실패인지. 없는 종목의 404를 세 번 두드리지 않는다.
        self.retryable = retryable
        #: HTTP 상태. 401(토큰 만료)을 다른 실패와 구분하는 데 쓴다.
        self.status = status
        #: 왜 빠졌는지. 화면의 '무엇을 배제했나'에 그대로 집계된다.
        self.code = code
        self.detail = detail


def _get_json(url: str, headers: dict[str, str] | None = None) -> dict:
    request = Request(url, headers=headers or {})
    try:
        with urlopen(request, timeout=60) as response:
            return json.load(response)
    except HTTPError as error:
        # 429는 속도 초과, 5xx는 상대 쪽 문제다. 둘 다 잠시 뒤 다시 걸면 된다.
        retryable = error.code == 429 or 500 <= error.code < 600
        raise ProviderDataError(f"HTTP {error.code}: {url}", retryable, error.code) from error
    except (URLError, TimeoutError) as error:
        raise ProviderDataError(f"요청 실패: {url} ({error})", retryable=True) from error


def with_retry(call, attempts: int = 3, sleep=time.sleep):
    """일시적인 실패만 다시 건다. 기다리는 시간은 회차마다 늘린다."""
    for attempt in range(1, attempts + 1):
        try:
            return call()
        except ProviderDataError as error:
            if not error.retryable or attempt == attempts:
                raise
            sleep(2 ** attempt)


def read_checkpoint(path: Path, price_date: str) -> dict[str, Fundamentals]:
    """이전 실행에서 이미 받아 둔 종목. 가격 기준일이 다르면 쓰지 않는다.

    어제 종가로 만든 결과를 오늘 배치가 조용히 재사용하면, 오래된 값이 최신인
    것처럼 화면에 나간다. 이 파이프라인에서 이미 한 번 겪은 종류의 사고다.
    """
    if not path.exists():
        return {}
    found: dict[str, Fundamentals] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        row = json.loads(line)
        if row.get("priceDate") == price_date:
            found[row["company"]["ticker"]] = Fundamentals(**row["company"])
    return found


def append_checkpoint(path: Path, price_date: str, company: Fundamentals) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    row = {"priceDate": price_date, "company": asdict(company)}
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(row, ensure_ascii=False) + "\n")


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


def _value_at(
    company_facts: dict, tags: tuple[str, ...], end: str, duration: bool = False
) -> float | None:
    """재무 기준연도의 값. 그 해에 없으면 다른 해의 값으로 대신 채우지 않는다.

    회사는 쓰던 태그를 도중에 버린다. VZ의 LongTermDebt는 2013년에서 멈춰 있는데,
    '가장 최근에 값이 있는 해'를 집으면 12년 전 부채가 현재 부채로 나간다.
    """
    return _annual_values(company_facts, tags, duration=duration).get(end)


def _total_debt_at(company_facts: dict, end: str) -> float | None:
    """총부채. 넓은 정의부터 찾는다.

    좁은 태그를 먼저 잡으면 부채를 적게 잡게 되고, 레버리지 판정이 관대해진다.
    관대한 쪽으로 틀리는 것이 이 지표에서는 더 위험하다.
    """
    for tags in (
        ("DebtLongtermAndShorttermCombinedAmount",),
        ("LongTermDebtAndFinanceLeaseObligations", "LongTermDebtAndCapitalLeaseObligations"),
        ("LongTermDebt",),  # 유동성 장기부채를 이미 포함한 총액이다. 따로 더하지 않는다
    ):
        value = _value_at(company_facts, tags, end)
        if value is not None:
            return value

    # 총액 태그가 없는 회사는 비유동 + 유동으로 맞춘다. 한쪽만 있으면 판정 불가다
    noncurrent = _value_at(company_facts, ("LongTermDebtNoncurrent",), end)
    current = _value_at(company_facts, ("LongTermDebtCurrent",), end)
    if noncurrent is None or current is None:
        return None
    return noncurrent + current


INTEREST_TAGS = ("InterestExpenseNonoperating", "InterestExpense", "InterestAndDebtExpense")

# 세전이익. 회사가 영업이익을 따로 태그하지 않을 때 EBIT의 재료가 된다.
PRETAX_TAGS = (
    "IncomeLossFromContinuingOperationsBeforeIncomeTaxesMinorityInterestAndIncomeLossFromEquityMethodInvestments",
    "IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest",
)


def _ebit_series(company_facts: dict) -> dict[str, float]:
    """영업이익 시계열.

    CVX·COP·BMY·CLX 같은 대형주가 OperatingIncomeLoss 계열 태그를 아예 쓰지 않는다.
    그 경우 세전이익에 이자비용을 더해 근사한다. 널리 쓰는 EBIT 정의다.

    근사이므로 영업 외 손익(투자평가손익·환차손익)이 섞인다. 직접 공시한 값이
    있으면 언제나 그쪽을 쓴다.
    """
    direct = _annual_values(company_facts, ("OperatingIncomeLoss",))
    if direct:
        return direct

    pretax = _annual_values(company_facts, PRETAX_TAGS)
    if not pretax:
        return {}
    interest = _annual_values(company_facts, INTEREST_TAGS)
    # 그 해 이자비용이 없으면 세전이익만 쓴다. EBIT가 작게 잡혀 판정은
    # 엄격해지는 쪽으로 틀린다. 반대 방향보다 안전하다.
    return {end: value + interest.get(end, 0.0) for end, value in pretax.items()}


def _depreciation_at(company_facts: dict, end: str) -> float | None:
    """EBITDA에 더할 감가상각비. 상각을 포함한 값이어야 한다."""
    inclusive = _value_at(company_facts, (
        "DepreciationDepletionAndAmortization",
        "DepreciationDepletionAndAmortizationPropertyPlantAndEquipment",
        "DepreciationAndAmortization",
    ), end, duration=True)
    if inclusive is not None:
        return inclusive

    # Depreciation은 유형자산 감가상각만 뜻한다. 무형자산 상각이 큰 회사는
    # 이것만 쓰면 EBITDA가 크게 어긋난다(GILD 370 vs 2,770).
    depreciation = _value_at(company_facts, ("Depreciation",), end, duration=True)
    if depreciation is None:
        return None
    amortization = _value_at(company_facts, ("AmortizationOfIntangibleAssets",), end, duration=True)
    # 상각 태그가 없으면 감가상각만 쓴다. EBITDA가 작게 잡혀 레버리지 판정이
    # 엄격해지는 쪽으로 틀린다. 반대 방향보다 안전하다.
    return depreciation if amortization is None else depreciation + amortization


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
    ebit = _ebit_series(company_facts)
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
        "equity": equity,
        "assets": assets,
        "cash": cash,
    }
    # 은행·보험·리츠는 유동/비유동 구분 대차대조표를 쓰지 않아 LiabilitiesCurrent가 없고,
    # 설비투자도 따로 공시하지 않는다. 이 항목을 요구하면 유니버스에 들어오지 못한다.
    # 점수는 어차피 내지 않으므로(coverage.py) 종목을 보여주기 위해 요건을 줄인다.
    if not is_finance_sic(submissions.get("sic")):
        required_by_name["operatingCash"] = operating_cash
        required_by_name["capex"] = capex
        required_by_name["currentLiabilities"] = current_liabilities
    required = list(required_by_name.values())
    common_ends = sorted(set.intersection(*(set(values) for values in required)))[-5:]
    if len(common_ends) < 5:
        counts = ", ".join(f"{name}={len(values)}" for name, values in required_by_name.items())
        empty = [name for name, values in required_by_name.items() if not values]
        if len(empty) == len(required_by_name):
            # 태그가 하나도 안 잡힌다 = 10-K를 내지 않는 회사다(외국 발행사는 20-F).
            code, detail = "NOT_10K", ""
        elif empty:
            code, detail = "MISSING_FIELD", ", ".join(empty)
        else:
            # 각 항목은 있는데 겹치는 해가 없다. 회사가 도중에 태그를 바꾼 경우다.
            code, detail = "NO_COMMON_YEARS", ""
        raise ProviderDataError(
            f"{ticker}: 공통된 5개 회계연도 공시를 구성할 수 없습니다({counts}, common={len(common_ends)}).",
            code=code,
            detail=detail,
        )

    million = 1_000_000
    # 재료가 한 해라도 빠지면 시계열을 만들지 않는다. 빈 해를 채워 넣지 않는다.
    have_flow = all(end in operating_cash and end in capex for end in common_ends)
    have_ic = all(end in current_liabilities for end in common_ends)
    fcf = [(operating_cash[end] - capex[end]) / million for end in common_ends] if have_flow else []
    invested_capital = [
        (assets[end] - current_liabilities[end] - cash[end]) / million for end in common_ends
    ] if have_ic else []
    eps_series = [eps[end] for end in common_ends if end in eps]

    # 아래 값은 모두 시계열과 같은 회계연도에서만 가져온다. 해가 섞이면
    # 오래된 부채와 최근 이익을 나누게 된다.
    as_of = common_ends[-1]
    debt = _total_debt_at(company_facts, as_of)
    depreciation = _depreciation_at(company_facts, as_of)
    # 태그는 회사마다 다르다. 넓은 항목부터 좁은 항목 순으로 두고 앞쪽을 우선한다.
    # Nonoperating의 o는 소문자다. 대문자로 적힌 이름은 taxonomy에 없어 매칭되지 않는다.
    interest = _value_at(company_facts, (
        "InterestExpenseNonoperating", "InterestExpense", "InterestAndDebtExpense",
    ), as_of, duration=True)
    current_assets = _value_at(company_facts, ("AssetsCurrent",), as_of)

    return Fundamentals(
        ticker=ticker,
        name=stock["name"],
        sector=submissions.get("sicDescription") or "분류 없음",
        sic=submissions.get("sic") or None,
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
        cash=cash[as_of] / million,
        interest_expense=None if interest is None else interest / million,
        depreciation=None if depreciation is None else depreciation / million,
        current_assets=None if current_assets is None else current_assets / million,
        current_liabilities=(
            current_liabilities[as_of] / million if as_of in current_liabilities else None
        ),
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
        checkpoint: Path | None = None,
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
        self.checkpoint = checkpoint
        self._access_token: str | None = None
        #: 빠진 종목과 그 사유. 화면의 '무엇을 배제했나'로 그대로 나간다.
        self._excluded: list[dict] = []

    def excluded(self) -> list[dict]:
        return self._excluded
        self._as_of: dict[str, str] | None = None

    def _toss_get(self, path: str) -> dict:
        """토스 호출. 토큰이 만료됐으면 한 번 다시 받고 재시도한다.

        500종목 배치는 토큰 수명보다 오래 걸린다. 시작할 때 받은 토큰 하나로 끝까지
        가면 중간부터 전부 401이 되는데, 배치는 정상 종료하고 결과 파일도 써진다.
        실패가 조용해서 더 위험하다.
        """
        if self._access_token is None:
            self._access_token = self._fetch_token()
        try:
            return self.get_json(f"{TOSS_BASE}{path}", {"Authorization": f"Bearer {self._access_token}"})
        except ProviderDataError as error:
            if error.status != 401:
                raise
            self._access_token = self._fetch_token()
            return self.get_json(
                f"{TOSS_BASE}{path}", {"Authorization": f"Bearer {self._access_token}"}
            )

    def _fetch_token(self) -> str:
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

    def _stocks(self) -> dict[str, dict]:
        """토스 종목 정보. 500종목을 URL 하나에 담지 않고 나눠 부른다."""
        found: dict[str, dict] = {}
        for start in range(0, len(self.universe), STOCKS_PER_REQUEST):
            batch = self.universe[start : start + STOCKS_PER_REQUEST]
            path = f"/api/v1/stocks?{urlencode({'symbols': ','.join(batch)})}"
            rows = with_retry(lambda p=path: self._toss_get(p))["result"]
            found.update({row["symbol"].upper(): row for row in rows})
            time.sleep(SEC_REQUEST_INTERVAL)
        return found

    def load(self) -> list[Fundamentals]:
        stocks = self._stocks()

        ticker_rows = with_retry(lambda: self.get_json(SEC_TICKERS_URL, self.sec_headers))
        cik_by_ticker = {
            row["ticker"].upper(): str(row["cik_str"]).zfill(10)
            for row in ticker_rows.values()
        }
        new_york = ZoneInfo("America/New_York")
        before = datetime.now(new_york).date() - timedelta(days=1)
        price_date = before.isoformat()
        before_iso = datetime(
            before.year, before.month, before.day, 23, 59, 59, tzinfo=new_york
        ).isoformat()

        done = read_checkpoint(self.checkpoint, price_date) if self.checkpoint else {}
        if done:
            print(f"[공급자] 이전 실행에서 {len(done)}종목을 이어받습니다({price_date} 종가).")

        companies: list[Fundamentals] = list(done.values())
        total = len(self.universe)
        for index, ticker in enumerate(self.universe, 1):
            if ticker in done:
                continue
            try:
                stock = stocks[ticker]
                candle_path = "/api/v1/candles?" + urlencode({
                    "symbol": ticker, "interval": "1d", "count": 1,
                    "before": before_iso, "adjusted": "true",
                })
                candle = with_retry(lambda: self._toss_get(candle_path))["result"]["candles"][0]
                cik = cik_by_ticker[ticker]
                facts = with_retry(lambda: self.get_json(SEC_FACTS_URL.format(cik=cik), self.sec_headers))
                time.sleep(SEC_REQUEST_INTERVAL)
                subs = with_retry(lambda: self.get_json(SEC_SUBMISSIONS_URL.format(cik=cik), self.sec_headers))
                company = fundamentals_from_sec(ticker, stock, candle, facts, subs)
            except (KeyError, IndexError, ProviderDataError) as error:
                # KeyError/IndexError는 토스에 없는 종목·CIK 미등록·시세 없음이다.
                code = getattr(error, "code", "NOT_LISTED")
                detail = getattr(error, "detail", "")
                self._excluded.append({"ticker": ticker, "code": code, "detail": detail})
                print(f"[공급자] {ticker} 제외({code}): {error}")
            else:
                companies.append(company)
                if self.checkpoint:
                    append_checkpoint(self.checkpoint, price_date, company)
            time.sleep(SEC_REQUEST_INTERVAL)
            if index % 25 == 0:
                print(f"[공급자] {index}/{total} 진행 · 구성 {len(companies)}종목")

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
