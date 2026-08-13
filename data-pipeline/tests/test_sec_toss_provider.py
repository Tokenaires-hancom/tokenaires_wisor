"""SEC 공시 파싱 검증.

여기의 표본은 **실제 SEC API가 돌려주는 모양**을 따라야 한다. 손으로 만든 편한 모양에
맞춰 테스트를 쓰면, 태그가 어긋나 있어도 초록불이 나오고 화면에는 빈 값이 나간다.
아래 태그 조합은 2026-08-06에 9개 종목의 companyfacts를 실제로 조회해 확인한 것이다.

- 업종(sicDescription)은 companyfacts에 없다. submissions 엔드포인트에만 있다
- 감가상각 태그는 회사마다 다르다. MSFT·TXN·GILD는 Depreciation만, UNH·VZ는 DepreciationAndAmortization
- TXN은 이자비용을 InterestAndDebtExpense로만 공시한다
"""

import pytest

from wisor_data.providers.sec_toss import (
    ProviderDataError,
    SecTossProvider,
    _annual_values,
    fundamentals_from_sec,
)

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

STOCK = {"name": "Test", "sharesOutstanding": "100000000", "marketCap": "3000000000"}
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
    """필수 태그를 채운 companyfacts. extra_tags로 선택 항목의 태그를 바꿔 끼운다.

    값 자리에 dict를 주면 그 연도에만 넣는다. 회사가 몇 해 전에 쓰다 만 태그를
    표현하기 위한 것이다(VZ의 LongTermDebt는 2013년에서 멈춰 있다).
    실제 API와 마찬가지로 sicDescription을 넣지 않는다.
    """
    facts = {}
    for tag, base, duration in REQUIRED:
        facts.update(series(tag, base, duration))
    facts.update(series("EarningsPerShareDiluted", 2, unit="USD/shares"))
    for tag, (value, duration) in extra_tags.items():
        by_year = value if isinstance(value, dict) else {year: value for year in YEARS}
        facts.update(fact(tag, [annual(v, y, duration) for y, v in by_year.items()]))
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
    assert result.market_cap == 3000
    assert result.financial_as_of == "2024-12-31"


def test_net_fixed_assets_uses_latest_net_ppe_for_magic_formula():
    result = build(PropertyPlantAndEquipmentNet=(400, False))

    assert result.net_fixed_assets == 400 / 1_000_000


def test_market_cap_must_come_from_api():
    stock = {"name": "Test", "sharesOutstanding": "100000000"}

    with pytest.raises(ProviderDataError) as caught:
        fundamentals_from_sec("TEST", stock, PRICE, company_facts(), SUBMISSIONS)

    assert caught.value.code == "MISSING_FIELD"
    assert caught.value.detail == "marketCap"


def test_nasdaq_market_caps_keep_only_positive_api_values():
    provider = SecTossProvider(
        toss_client_id="id",
        toss_client_secret="secret",
        sec_user_agent="Wisor test@example.com",
        universe=["ADBE"],
        get_json=lambda _url, _headers: {
            "data": {
                "rows": [
                    {"symbol": "ADBE", "marketCap": "102853125000.00"},
                    {"symbol": "ZERO", "marketCap": "0"},
                    {"symbol": "EMPTY", "marketCap": None},
                ]
            }
        },
    )

    assert provider._market_caps() == {"ADBE": 102853125000.0}


def test_sector_comes_from_submissions_because_companyfacts_has_no_sic():
    """companyfacts에는 sicDescription이 없다. 여기서 업종을 찾으면 항상 '분류 없음'이 된다."""
    result = build(submissions={"sicDescription": "Retail-Retail Stores"})

    assert result.sector == "Retail-Retail Stores"


def test_sector_is_unclassified_when_submissions_omits_it():
    assert build(submissions={}).sector == "분류 없음"


def test_sic_code_comes_from_submissions_for_the_coverage_gate():
    """업종 판정은 SIC 코드로 한다. 재무 숫자와 같은 출처라 어긋나지 않는다."""
    result = build(submissions={"sicDescription": "State Commercial Banks", "sic": "6022"})

    assert result.sic == "6022"


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


def test_interest_expense_reads_the_nonoperating_tag_with_its_real_spelling():
    """실제 태그는 InterestExpenseNonoperating이다(소문자 o).

    대문자 O로 적힌 이름은 어디에도 없어서 한 번도 매칭되지 않았다. ADBE·MSFT·GILD·VZ는
    최근 연도에 이 태그로만 이자비용을 공시한다.
    """
    result = build(InterestExpenseNonoperating=(6694, True))

    assert result.interest_expense == 6694 / 1_000_000


def test_missing_optional_tags_stay_none_and_are_not_filled_with_zero():
    """ULTA·LULU처럼 장기차입금 태그가 아예 없는 회사는 0이 아니라 판정 불가다."""
    result = build()

    assert result.total_debt is None
    assert result.interest_expense is None
    assert result.depreciation is None


PRETAX = "IncomeLossFromContinuingOperationsBeforeIncomeTaxesMinorityInterestAndIncomeLossFromEquityMethodInvestments"


def test_operating_income_tag_is_used_when_the_company_reports_it():
    """직접 공시한 값이 있으면 근사하지 않는다."""
    result = build(OperatingIncomeLoss=(500, True), **{PRETAX: (400, True), "InterestExpense": (30, True)})

    assert result.ebit[-1] == 500 / 1_000_000  # 세전이익+이자(430)가 아니라 공시값


def test_ebit_falls_back_to_pretax_income_plus_interest():
    """CVX·COP·BMY·CLX는 OperatingIncomeLoss 계열 태그가 아예 없다.

    세전이익에 이자비용을 더하면 영업이익에 가까워진다. 널리 쓰는 근사다.
    """
    facts = company_facts(**{PRETAX: (400, True), "InterestExpense": (30, True)})
    del facts["facts"]["us-gaap"]["OperatingIncomeLoss"]

    result = fundamentals_from_sec("TEST", STOCK, PRICE, facts, SUBMISSIONS)

    assert result.ebit[-1] == 430 / 1_000_000


def test_ebit_fallback_uses_pretax_alone_when_interest_is_not_reported():
    """이자비용이 없으면 세전이익만 쓴다. EBIT가 작게 잡혀 판정은 엄격해지는 쪽이다."""
    facts = company_facts(**{PRETAX: (400, True)})
    del facts["facts"]["us-gaap"]["OperatingIncomeLoss"]

    assert fundamentals_from_sec("TEST", STOCK, PRICE, facts, SUBMISSIONS).ebit[-1] == 400 / 1_000_000


def test_bank_is_built_without_the_tags_banks_do_not_file():
    """은행은 유동/비유동 구분 대차대조표를 쓰지 않아 LiabilitiesCurrent가 없다.

    설비투자도 따로 공시하지 않는다. 이 항목을 요구하면 은행은 유니버스에 들어오지
    못한다. 점수를 내지 않을 뿐 종목 자체는 보여주기로 했으므로 요건을 줄인다.
    """
    facts = company_facts(**{PRETAX: (400, True)})
    for tag in ("LiabilitiesCurrent", "PaymentsToAcquirePropertyPlantAndEquipment", "OperatingIncomeLoss"):
        del facts["facts"]["us-gaap"][tag]

    result = fundamentals_from_sec(
        "BANK", STOCK, PRICE, facts, {"sicDescription": "State Commercial Banks", "sic": "6022"}
    )

    assert result.ticker == "BANK"
    assert result.revenue and result.net_income and result.equity
    assert result.invested_capital == []  # 유동부채가 없으면 투하자본을 만들 수 없다
    assert result.fcf == []


def test_operating_company_still_needs_the_full_set():
    """사업회사는 요건을 줄이지 않는다. 줄이면 점수의 근거가 비어 버린다."""
    facts = company_facts()
    del facts["facts"]["us-gaap"]["LiabilitiesCurrent"]

    with pytest.raises(ProviderDataError):
        fundamentals_from_sec("TEST", STOCK, PRICE, facts, SUBMISSIONS)


def raises_with(**overrides):
    facts = company_facts()
    for tag in overrides.pop("drop", []):
        del facts["facts"]["us-gaap"][tag]
    with pytest.raises(ProviderDataError) as caught:
        fundamentals_from_sec("TEST", STOCK, PRICE, facts, SUBMISSIONS)
    return caught.value


def test_company_that_files_no_10k_is_reported_as_such():
    """ASML·ARM·PDD 같은 외국 발행사는 20-F를 낸다. 태그가 하나도 잡히지 않는다.

    '5개 연도가 없다'가 아니라 '미국 연차보고서를 내지 않는다'가 사용자에게 맞는 설명이다.
    """
    error = raises_with(drop=[tag for tag, _, _ in REQUIRED] + ["EarningsPerShareDiluted"])

    assert error.code == "NOT_10K"


def test_missing_single_required_tag_is_reported_by_name():
    error = raises_with(drop=["PaymentsToAcquirePropertyPlantAndEquipment"])

    assert error.code == "MISSING_FIELD"
    assert "capex" in error.detail


def test_tags_that_exist_but_never_overlap_are_a_different_reason():
    """회사가 도중에 태그를 바꾸면 각 항목은 있는데 공통 연도가 없다. 가장 흔한 사유다."""
    facts = company_facts()
    # 매출만 다른 연도로 옮겨 공통 구간을 없앤다
    facts["facts"]["us-gaap"].update(
        fact("Revenues", [annual(1000, y) for y in range(2010, 2015)])
    )
    with pytest.raises(ProviderDataError) as caught:
        fundamentals_from_sec("TEST", STOCK, PRICE, facts, SUBMISSIONS)

    assert caught.value.code == "NO_COMMON_YEARS"


def test_stale_debt_tag_from_another_year_is_not_used_as_current_debt():
    """VZ의 LongTermDebt는 2013년에서 멈춰 있는데 그 값이 현재 부채로 쓰이고 있었다.

    재무 기준연도에 값이 없으면 다른 해의 값으로 대신 채우지 않는다.
    """
    result = build(LongTermDebt=({2019: 900}, False))

    assert result.total_debt is None


def test_total_debt_prefers_the_combined_total_over_the_long_term_only_tag():
    """UNH·VZ는 DebtLongtermAndShorttermCombinedAmount에만 최신 총부채가 있다.

    좁은 태그를 먼저 잡으면 부채를 적게 잡아 판정이 관대해진다.
    """
    result = build(
        DebtLongtermAndShorttermCombinedAmount=(800, False),
        LongTermDebtNoncurrent=(500, False),
    )

    assert result.total_debt == 800 / 1_000_000


def test_total_debt_adds_the_current_portion_when_only_the_split_tags_exist():
    result = build(LongTermDebtNoncurrent=(500, False), LongTermDebtCurrent=(120, False))

    assert result.total_debt == 620 / 1_000_000


def test_long_term_debt_total_is_not_double_counted_with_its_current_portion():
    """LongTermDebt는 유동성 장기부채를 이미 포함한 총액이다(MSFT 40,294 = 31,067 + 9,227)."""
    result = build(
        LongTermDebt=(620, False),
        LongTermDebtNoncurrent=(500, False),
        LongTermDebtCurrent=(120, False),
    )

    assert result.total_debt == 620 / 1_000_000


def test_depreciation_adds_intangible_amortization_when_only_depreciation_is_reported():
    """MSFT·GILD는 Depreciation만 쓴다. 상각을 빼면 EBITDA가 크게 어긋난다(GILD 370 vs 2,770)."""
    result = build(Depreciation=(370, True), AmortizationOfIntangibleAssets=(2400, True))

    assert result.depreciation == 2770 / 1_000_000


def test_inclusive_depreciation_tag_is_not_double_counted_with_amortization():
    """VZ의 DepreciationAndAmortization 18,349는 이미 상각 2,999를 포함한다."""
    result = build(
        DepreciationAndAmortization=(18349, True),
        AmortizationOfIntangibleAssets=(2999, True),
    )

    assert result.depreciation == 18349 / 1_000_000
