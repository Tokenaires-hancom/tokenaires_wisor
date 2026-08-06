"""SEC 공시 파싱 검증.

여기의 표본은 **실제 SEC API가 돌려주는 모양**을 따라야 한다. 손으로 만든 편한 모양에
맞춰 테스트를 쓰면, 태그가 어긋나 있어도 초록불이 나오고 화면에는 빈 값이 나간다.
아래 태그 조합은 2026-08-06에 9개 종목의 companyfacts를 실제로 조회해 확인한 것이다.

- 업종(sicDescription)은 companyfacts에 없다. submissions 엔드포인트에만 있다
- 감가상각 태그는 회사마다 다르다. MSFT·TXN·GILD는 Depreciation만, UNH·VZ는 DepreciationAndAmortization
- TXN은 이자비용을 InterestAndDebtExpense로만 공시한다
"""

from wisor_data.providers.sec_toss import _annual_values, fundamentals_from_sec

YEARS = range(2020, 2025)

# 5개 회계연도를 구성하는 데 반드시 필요한 태그. 없으면 종목 자체가 제외된다.
REQUIRED = (
    ("Revenues", 1000, True),
    ("OperatingIncomeLoss", 200, True),
    ("NetIncomeLoss", 150, True),
    ("NetCashProvidedByUsedInOperatingActivities", 180, True),
    ("PaymentsToAcquirePropertyPlantAndEquipment", 30, True),
    ("StockholdersEquity", 500, False),
    ("Assets", 1000, False),
    ("LiabilitiesCurrent", 200, False),
    ("CashAndCashEquivalentsAtCarryingValue", 100, False),
)

STOCK = {"name": "Test", "sharesOutstanding": "100000000"}
PRICE = {"closePrice": "25", "timestamp": "2025-01-02T16:00:00-05:00"}
SUBMISSIONS = {"sicDescription": "Services-Prepackaged Software"}


def fact(tag, values, unit="USD"):
    return {tag: {"units": {unit: values}}}


def annual(value, year, duration=True):
    row = {
        "val": value,
        "end": f"{year}-12-31",
        "filed": f"{year + 1}-02-01",
        "form": "10-K",
    }
    if duration:
        row["start"] = f"{year}-01-01"
    return row


def series(tag, base, duration=True, unit="USD"):
    return fact(tag, [annual(base + year - 2020, year, duration) for year in YEARS], unit)


def company_facts(**extra_tags):
    """필수 태그를 채운 companyfacts. extra_tags로 선택 항목의 태그 이름을 바꿔 끼운다.

    실제 API와 마찬가지로 sicDescription을 넣지 않는다.
    """
    facts = {}
    for tag, base, duration in REQUIRED:
        facts.update(series(tag, base, duration))
    facts.update(series("EarningsPerShareDiluted", 2, unit="USD/shares"))
    for tag, (value, duration) in extra_tags.items():
        facts.update(fact(tag, [annual(value, year, duration) for year in YEARS]))
    return {"facts": {"us-gaap": facts}}


def build(submissions=SUBMISSIONS, **extra_tags):
    return fundamentals_from_sec("TEST", STOCK, PRICE, company_facts(**extra_tags), submissions)


def test_annual_values_uses_latest_restated_value():
    rows = [annual(100, 2021), {**annual(110, 2021), "filed": "2023-02-01"}]
    company = {"facts": {"us-gaap": fact("Revenues", rows)}}
    assert _annual_values(company, ("Revenues",))["2021-12-31"] == 110


def test_fundamentals_are_built_from_five_real_fiscal_years():
    result = build(
        LongTermDebt=(300, False),
        InterestExpense=(10, True),
        DepreciationDepletionAndAmortization=(20, True),
        AssetsCurrent=(400, False),
    )

    assert result.revenue == [0.001, 0.001001, 0.001002, 0.001003, 0.001004]
    assert result.fcf[-1] == (184 - 34) / 1_000_000
    assert result.invested_capital[-1] == (1004 - 204 - 104) / 1_000_000
    assert result.price == 25
    assert result.shares_out == 100
    assert result.financial_as_of == "2024-12-31"


def test_sector_comes_from_submissions_because_companyfacts_has_no_sic():
    """companyfacts에는 sicDescription이 없다. 여기서 업종을 찾으면 항상 '분류 없음'이 된다."""
    result = build(submissions={"sicDescription": "Retail-Retail Stores"})

    assert result.sector == "Retail-Retail Stores"


def test_sector_is_unclassified_when_submissions_omits_it():
    assert build(submissions={}).sector == "분류 없음"


def test_depreciation_falls_back_to_plain_depreciation_tag():
    """MSFT·TXN·GILD는 감가상각을 Depreciation 하나로만 공시한다."""
    result = build(Depreciation=(20, True))

    assert result.depreciation == 20 / 1_000_000


def test_depreciation_falls_back_to_depreciation_and_amortization_tag():
    """UNH·VZ는 DepreciationAndAmortization을 쓴다."""
    result = build(DepreciationAndAmortization=(20, True))

    assert result.depreciation == 20 / 1_000_000


def test_interest_expense_falls_back_to_interest_and_debt_expense():
    """TXN은 이자비용을 InterestAndDebtExpense로만 공시한다."""
    result = build(InterestAndDebtExpense=(10, True))

    assert result.interest_expense == 10 / 1_000_000


def test_missing_optional_tags_stay_none_and_are_not_filled_with_zero():
    """ULTA·LULU처럼 장기차입금 태그가 아예 없는 회사는 0이 아니라 판정 불가다."""
    result = build()

    assert result.total_debt is None
    assert result.interest_expense is None
    assert result.depreciation is None
