"""피터 린치 스타일 — Lynch 0.9 (초안)

"이해할 수 있고 잘 성장하는 회사를 합리적인 가격에." 성장의 크기와 지속성,
그리고 성장률 대비 가격(PEG)을 함께 본다.
"""

from .base import Criterion, Style, num, pct

CRITERIA = [
    Criterion(
        code="LYN_EPS_GROWTH",
        label="이익 성장",
        weight=3,
        detail="주당순이익 5년 연평균 성장률 15~40%",
        test=lambda m: None if m.eps_cagr_5y is None else 0.15 <= m.eps_cagr_5y <= 0.40,
        on_pass=lambda m: f"주당순이익이 5년 동안 연평균 {pct(m.eps_cagr_5y, 1)} 늘었습니다.",
        on_fail=lambda m: (
            f"주당순이익 성장률이 연평균 {pct(m.eps_cagr_5y, 1)}로 이 스타일이 보는 구간(15~40%) 밖입니다."
        ),
    ),
    Criterion(
        code="LYN_PEG",
        label="성장률 대비 가격",
        weight=3,
        detail="PEG ≤ 1.2",
        test=lambda m: None if m.peg is None else 0 < m.peg <= 1.2,
        on_pass=lambda m: f"성장률에 비해 가격이 무겁지 않습니다(PEG {num(m.peg, 2)}).",
        on_fail=lambda m: f"성장률에 비해 가격이 앞서 있습니다(PEG {num(m.peg, 2)}).",
    ),
    Criterion(
        code="LYN_REVENUE_GROWTH",
        label="매출 성장의 뒷받침",
        weight=2,
        detail="매출 5년 연평균 성장률 ≥ 8%",
        test=lambda m: None if m.revenue_cagr_5y is None else m.revenue_cagr_5y >= 0.08,
        on_pass=lambda m: f"이익뿐 아니라 매출도 연평균 {pct(m.revenue_cagr_5y, 1)} 늘었습니다.",
        on_fail=lambda m: f"매출 성장은 연평균 {pct(m.revenue_cagr_5y, 1)}에 그쳤습니다.",
    ),
    Criterion(
        code="LYN_DEBT",
        label="부채 부담",
        weight=2,
        detail="순부채 / EBITDA ≤ 2.0",
        test=lambda m: None if m.net_debt_to_ebitda is None else m.net_debt_to_ebitda <= 2.0,
        on_pass=lambda m: f"성장 기업치고 부채 부담이 가볍습니다(순부채/EBITDA {num(m.net_debt_to_ebitda)}배).",
        on_fail=lambda m: f"성장에 비해 부채 부담이 있습니다(순부채/EBITDA {num(m.net_debt_to_ebitda)}배).",
    ),
    Criterion(
        code="LYN_PROFITABILITY",
        label="성장의 질",
        weight=2,
        detail="5년 평균 ROIC ≥ 10%",
        test=lambda m: None if m.roic_avg_5y is None else m.roic_avg_5y >= 0.10,
        on_pass=lambda m: f"성장하면서도 자본 대비 이익을 냈습니다(5년 평균 ROIC {pct(m.roic_avg_5y)}).",
        on_fail=lambda m: f"성장에 비해 자본 대비 이익이 낮습니다(5년 평균 ROIC {pct(m.roic_avg_5y)}).",
    ),
]

STYLE = Style(id="lynch", name="피터 린치", model_version="Lynch 0.9", criteria=CRITERIA)
