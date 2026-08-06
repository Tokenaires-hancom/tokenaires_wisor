"""데이터 품질 검사.

배치는 검사를 통과한 종목만 화면으로 내보낸다. 억지로 점수를 만들지 않는 것이
기획서 8.3의 요구사항이다("데이터가 부족한 종목은 '정보 부족'으로 표시").
"""

from __future__ import annotations

from dataclasses import dataclass

from .metrics import Fundamentals

REQUIRED_YEARS = 5


@dataclass
class Issue:
    ticker: str
    code: str
    message: str
    fatal: bool


def check(f: Fundamentals) -> list[Issue]:
    issues: list[Issue] = []

    def add(code: str, message: str, fatal: bool = True) -> None:
        issues.append(Issue(f.ticker, code, message, fatal))

    for field_name in ("revenue", "ebit", "net_income", "fcf", "invested_capital", "equity"):
        series = getattr(f, field_name)
        if len(series) < REQUIRED_YEARS:
            add("SHORT_SERIES", f"{field_name} 시계열이 {len(series)}년치뿐입니다.")
        if any(v is None for v in series):
            add("NULL_IN_SERIES", f"{field_name}에 빈 값이 있습니다.")

    if f.price <= 0:
        add("BAD_PRICE", "가격이 0 이하입니다.")
    if f.shares_out <= 0:
        add("BAD_SHARES", "발행주식수가 0 이하입니다.")
    for field_name in ("total_debt", "cash", "interest_expense", "depreciation"):
        if getattr(f, field_name) is None:
            add("MISSING_SCALAR", f"{field_name} 값이 없습니다.", fatal=False)
    if f.revenue and any(v <= 0 for v in f.revenue):
        add("NON_POSITIVE_REVENUE", "매출에 0 이하 값이 있습니다.")
    if f.invested_capital and any(v <= 0 for v in f.invested_capital):
        add("NON_POSITIVE_IC", "투하자본에 0 이하 값이 있습니다.")

    if f.revenue and len(f.revenue) >= 2:
        for i in range(1, len(f.revenue)):
            prev, cur = f.revenue[i - 1], f.revenue[i]
            if prev > 0 and (cur / prev > 3 or cur / prev < 0.33):
                add("REVENUE_JUMP",
                    f"매출이 한 해 만에 {prev:,.0f} → {cur:,.0f}로 크게 변했습니다. 원천 확인이 필요합니다.",
                    fatal=False)

    if not f.price_as_of or not f.financial_as_of:
        add("MISSING_AS_OF", "기준일이 없습니다.")

    return issues


def partition(companies: list[Fundamentals]) -> tuple[list[Fundamentals], list[Issue]]:
    """치명적 문제가 없는 종목만 통과시키고, 전체 이슈 목록을 함께 돌려준다."""
    passed, all_issues = [], []
    for f in companies:
        issues = check(f)
        all_issues.extend(issues)
        if not any(i.fatal for i in issues):
            passed.append(f)
    return passed, all_issues
