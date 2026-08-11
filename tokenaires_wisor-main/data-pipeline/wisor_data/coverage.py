"""현재 점수 모델이 판정할 수 있는 업종.

네 스타일 모두 사업회사의 대차대조표를 전제로 만들어져 있다.

- `invested_capital = 자산 − 유동부채 − 현금`은 예금과 대출이 본업인 은행에서
  의미가 없다. 여기서 나온 ROIC는 숫자일 뿐 사업의 질이 아니다
- `EV = 시총 + 순부채`도 부채가 곧 사업인 회사에는 성립하지 않는다
- 리츠는 감가상각이 커서 순이익이 현금창출력을 크게 밑돈다. 업계는 FFO를 쓴다

그래서 이 업종은 **데이터가 없어서가 아니라 모델이 맞지 않아서** 점수를 내지 않는다.
둘을 뭉개면 '정보 부족'이라는 틀린 이유가 사용자에게 나간다.

업종은 SEC submissions의 SIC 코드로 판별한다. 재무 숫자와 같은 출처라 어긋나지 않는다.
6000~6799는 금융·보험·부동산이다.

전용 지표(은행 ROE·BIS비율, 리츠 FFO)를 만들면 그때 다시 판정 대상에 넣는다.
"""

from __future__ import annotations

from .metrics import Fundamentals

FINANCE_SIC_RANGE = (6000, 6799)

UNSCORABLE_REASON = "은행·보험·부동산은 현재 점수 모델이 전제하는 대차대조표와 달라 판정하지 않습니다."


def is_finance_sic(sic: str | None) -> bool:
    """금융·보험·부동산 업종인지. SIC를 모르면 아니라고 본다."""
    if not sic or not sic.isdigit():
        return False
    return FINANCE_SIC_RANGE[0] <= int(sic) <= FINANCE_SIC_RANGE[1]


def is_scorable(f: Fundamentals) -> bool:
    """업종 기준으로 점수를 낼 수 있는 종목인지. SIC를 모르면 막지 않는다."""
    return not is_finance_sic(f.sic)
