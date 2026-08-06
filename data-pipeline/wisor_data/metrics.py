"""재무 원천 데이터 → 스타일 점수 계산에 쓰이는 지표.

원칙
- 계산에 필요한 항목이 하나라도 없으면 None을 돌려준다. 0으로 채우지 않는다.
- 여기서는 점수를 매기지 않는다. 판정은 styles/ 아래에서만 한다.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional, Sequence


def _safe_div(a: Optional[float], b: Optional[float]) -> Optional[float]:
    if a is None or b is None or b == 0:
        return None
    return a / b


def cagr(series: Sequence[float], years: Optional[int] = None) -> Optional[float]:
    """연평균 성장률. 시작값이 0 이하면 계산하지 않는다(부호가 바뀐 성장률은 의미가 없다)."""
    if not series or len(series) < 2:
        return None
    first, last = series[0], series[-1]
    n = years if years is not None else len(series) - 1
    if first <= 0 or last <= 0 or n <= 0:
        return None
    return (last / first) ** (1 / n) - 1


def median(values: Sequence[float]) -> Optional[float]:
    vals = sorted(v for v in values if v is not None)
    if not vals:
        return None
    mid = len(vals) // 2
    if len(vals) % 2:
        return vals[mid]
    return (vals[mid - 1] + vals[mid]) / 2


@dataclass
class Fundamentals:
    """한 종목의 원천 데이터. 금액 단위는 백만 USD, 연도 시계열은 오래된 것부터."""

    ticker: str
    name: str
    sector: str
    price: float
    shares_out: float
    price_as_of: str
    financial_as_of: str
    revenue: list[float] = field(default_factory=list)
    ebit: list[float] = field(default_factory=list)
    net_income: list[float] = field(default_factory=list)
    fcf: list[float] = field(default_factory=list)
    invested_capital: list[float] = field(default_factory=list)
    equity: list[float] = field(default_factory=list)
    eps: list[float] = field(default_factory=list)
    total_debt: float = 0.0
    cash: float = 0.0
    interest_expense: float = 0.0
    depreciation: float = 0.0
    current_assets: Optional[float] = None
    current_liabilities: Optional[float] = None
    ev_ebit_median_5y: Optional[float] = None
    eps_growth_forward: Optional[float] = None

    @classmethod
    def from_dict(cls, raw: dict) -> "Fundamentals":
        s = raw.get("series", {})
        return cls(
            ticker=raw["ticker"],
            name=raw["name"],
            sector=raw["sector"],
            price=raw["price"],
            shares_out=raw["sharesOut"],
            price_as_of=raw["asOf"]["price"],
            financial_as_of=raw["asOf"]["financial"],
            revenue=s.get("revenue", []),
            ebit=s.get("ebit", []),
            net_income=s.get("netIncome", []),
            fcf=s.get("fcf", []),
            invested_capital=s.get("investedCapital", []),
            equity=s.get("equity", []),
            eps=s.get("eps", []),
            total_debt=raw.get("totalDebt", 0.0),
            cash=raw.get("cash", 0.0),
            interest_expense=raw.get("interestExpense", 0.0),
            depreciation=raw.get("depreciation", 0.0),
            current_assets=raw.get("currentAssets"),
            current_liabilities=raw.get("currentLiabilities"),
            ev_ebit_median_5y=raw.get("evEbitMedian5y"),
            eps_growth_forward=raw.get("epsGrowthForward"),
        )


@dataclass
class Metrics:
    """스타일 판정에 쓰이는 파생 지표. 값이 None이면 '정보 부족'으로 다룬다."""

    market_cap: Optional[float] = None
    enterprise_value: Optional[float] = None
    roic_series: list[Optional[float]] = field(default_factory=list)
    roic_avg_5y: Optional[float] = None
    roic_years_above_10: int = 0
    fcf_positive_years: int = 0
    fcf_margin: Optional[float] = None
    net_debt: Optional[float] = None
    net_debt_to_ebitda: Optional[float] = None
    interest_coverage: Optional[float] = None
    revenue_cagr_5y: Optional[float] = None
    eps_cagr_5y: Optional[float] = None
    fcf_yield: Optional[float] = None
    ev_ebit: Optional[float] = None
    earnings_yield: Optional[float] = None
    ev_ebit_vs_median: Optional[float] = None
    pe: Optional[float] = None
    pbr: Optional[float] = None
    peg: Optional[float] = None
    current_ratio: Optional[float] = None
    debt_to_equity: Optional[float] = None
    profitable_years: int = 0
    data_years: int = 0

    def to_dict(self) -> dict:
        return {k: v for k, v in self.__dict__.items()}


def compute(f: Fundamentals) -> Metrics:
    m = Metrics()
    m.data_years = len(f.revenue)

    m.market_cap = f.price * f.shares_out
    m.net_debt = f.total_debt - f.cash
    m.enterprise_value = m.market_cap + m.net_debt

    m.roic_series = [
        _safe_div(ebit * 0.79, ic)  # 세후영업이익 근사: 실효세율 21% 가정
        for ebit, ic in zip(f.ebit, f.invested_capital)
    ]
    known_roic = [r for r in m.roic_series if r is not None]
    m.roic_avg_5y = sum(known_roic) / len(known_roic) if known_roic else None
    m.roic_years_above_10 = sum(1 for r in known_roic if r >= 0.10)

    m.fcf_positive_years = sum(1 for v in f.fcf if v > 0)
    if f.fcf and f.revenue:
        m.fcf_margin = _safe_div(f.fcf[-1], f.revenue[-1])

    ebitda = (f.ebit[-1] + f.depreciation) if f.ebit else None
    m.net_debt_to_ebitda = _safe_div(m.net_debt, ebitda)
    m.interest_coverage = _safe_div(f.ebit[-1] if f.ebit else None, f.interest_expense or None)

    m.revenue_cagr_5y = cagr(f.revenue)
    m.eps_cagr_5y = cagr(f.eps)

    m.fcf_yield = _safe_div(f.fcf[-1] if f.fcf else None, m.market_cap)
    m.ev_ebit = _safe_div(m.enterprise_value, f.ebit[-1] if f.ebit else None)
    m.earnings_yield = _safe_div(f.ebit[-1] if f.ebit else None, m.enterprise_value)
    if m.ev_ebit is not None and f.ev_ebit_median_5y:
        m.ev_ebit_vs_median = m.ev_ebit / f.ev_ebit_median_5y

    m.pe = _safe_div(m.market_cap, f.net_income[-1] if f.net_income else None)
    m.pbr = _safe_div(m.market_cap, f.equity[-1] if f.equity else None)

    growth = f.eps_growth_forward if f.eps_growth_forward is not None else m.eps_cagr_5y
    if m.pe is not None and growth is not None and growth > 0:
        m.peg = m.pe / (growth * 100)

    m.current_ratio = _safe_div(f.current_assets, f.current_liabilities)
    m.debt_to_equity = _safe_div(f.total_debt, f.equity[-1] if f.equity else None)
    m.profitable_years = sum(1 for v in f.net_income if v > 0)

    return m
