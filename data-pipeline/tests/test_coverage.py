"""현재 점수 모델이 어떤 업종을 판정하는지 검증.

은행·보험·리츠는 데이터가 없어서가 아니라 모델이 맞지 않아서 점수를 내지 않는다.
`invested_capital = 자산 − 유동부채 − 현금`은 예금과 대출이 본업인 은행에서 의미가
없고, `EV = 시총 + 순부채`도 부채가 곧 사업인 회사에는 성립하지 않는다.
둘을 뭉개면 '정보 부족'이라는 틀린 이유가 사용자에게 나간다.
"""

from wisor_data.coverage import is_scorable
from wisor_data.metrics import Fundamentals


def company(sic):
    return Fundamentals(
        ticker="TEST", name="Test", sector="테스트", price=10.0, shares_out=100.0,
        price_as_of="2026-08-05", financial_as_of="2025-12-31", sic=sic,
    )


def test_banks_are_not_scored_by_the_current_model():
    assert is_scorable(company("6021")) is False


def test_insurers_are_not_scored_by_the_current_model():
    assert is_scorable(company("6311")) is False


def test_reits_are_not_scored_by_the_current_model():
    assert is_scorable(company("6798")) is False


def test_operating_companies_are_scored():
    assert is_scorable(company("7372")) is True   # 소프트웨어
    assert is_scorable(company("3674")) is True   # 반도체
    assert is_scorable(company("5912")) is True   # 소매


def test_the_boundary_of_the_finance_range_is_exact():
    assert is_scorable(company("5999")) is True
    assert is_scorable(company("6000")) is False
    assert is_scorable(company("6799")) is False
    assert is_scorable(company("6800")) is True


def test_company_without_a_sic_code_is_still_scored():
    """예시 데이터에는 SIC가 없다. 업종을 모른다고 판정을 막지 않는다."""
    assert is_scorable(company(None)) is True


def test_non_numeric_sic_does_not_crash_the_batch():
    assert is_scorable(company("")) is True
