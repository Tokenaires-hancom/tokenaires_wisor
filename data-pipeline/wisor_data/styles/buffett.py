"""버핏·멍거 스타일 — Buffett 1.0

"좋은 기업을 지나치게 비싸지 않을 때." 사업의 질 4개, 재무 안정성 2개, 성장 1개,
가격 1개로 총 8개 기준. 기획서 11.3의 권장 문구("8개 기준 중 6개에 부합합니다")가
그대로 성립하도록 기준 개수를 8개로 고정한다.
"""

from .base import Criterion, Style, num, pct

CRITERIA = [
    Criterion(
        code="BUF_ROIC_LEVEL",
        label="자본 효율성",
        weight=3,
        detail="5년 평균 ROIC ≥ 12%",
        test=lambda m: None if m.roic_avg_5y is None else m.roic_avg_5y >= 0.12,
        on_pass=lambda m: f"투자한 자본 대비 이익이 높습니다(5년 평균 ROIC {pct(m.roic_avg_5y)}).",
        on_fail=lambda m: f"투자한 자본 대비 이익이 기준(12%)에 못 미칩니다(5년 평균 {pct(m.roic_avg_5y)}).",
    ),
    Criterion(
        code="BUF_ROIC_STABILITY",
        label="수익성 지속성",
        weight=2,
        detail="최근 5년 중 4년 이상 ROIC ≥ 10%",
        test=lambda m: None if not m.roic_series else m.roic_years_above_10 >= 4,
        on_pass=lambda m: f"5년 중 {m.roic_years_above_10}년 동안 두 자릿수 자본수익률을 유지했습니다.",
        on_fail=lambda m: f"두 자릿수 자본수익률을 유지한 해가 5년 중 {m.roic_years_above_10}년에 그쳤습니다.",
    ),
    Criterion(
        code="BUF_FCF_CONSISTENCY",
        label="현금흐름 지속성",
        weight=3,
        detail="최근 5년 연속 잉여현금흐름 양(+)",
        test=lambda m: None if m.data_years == 0 else m.fcf_positive_years >= 5,
        on_pass=lambda m: "최근 5년 동안 잉여현금흐름이 매년 플러스였습니다.",
        on_fail=lambda m: f"잉여현금흐름이 플러스였던 해가 5년 중 {m.fcf_positive_years}년입니다.",
    ),
    Criterion(
        code="BUF_FCF_MARGIN",
        label="현금 창출력",
        weight=2,
        detail="잉여현금흐름 마진 ≥ 10%",
        test=lambda m: None if m.fcf_margin is None else m.fcf_margin >= 0.10,
        on_pass=lambda m: f"매출의 {pct(m.fcf_margin)}가 실제 현금으로 남습니다.",
        on_fail=lambda m: f"매출 대비 남는 현금이 {pct(m.fcf_margin)}로 기준(10%)보다 낮습니다.",
    ),
    Criterion(
        code="BUF_LEVERAGE",
        label="부채 부담",
        weight=2,
        detail="순부채 / EBITDA ≤ 2.5배",
        test=lambda m: None if m.net_debt_to_ebitda is None else m.net_debt_to_ebitda <= 2.5,
        on_pass=lambda m: f"부채가 현금창출력에 비해 낮습니다(순부채/EBITDA {num(m.net_debt_to_ebitda)}배).",
        on_fail=lambda m: f"현금창출력 대비 부채가 많습니다(순부채/EBITDA {num(m.net_debt_to_ebitda)}배).",
    ),
    Criterion(
        code="BUF_INTEREST_COVER",
        label="이자 감당력",
        weight=1,
        detail="영업이익 / 이자비용 ≥ 8배",
        test=lambda m: None if m.interest_coverage is None else m.interest_coverage >= 8,
        on_pass=lambda m: f"영업이익이 이자비용의 {num(m.interest_coverage, 0)}배입니다.",
        on_fail=lambda m: f"영업이익이 이자비용의 {num(m.interest_coverage, 1)}배로 여유가 크지 않습니다.",
    ),
    Criterion(
        code="BUF_GROWTH",
        label="사업의 성장",
        weight=2,
        detail="매출 5년 연평균 성장률 ≥ 3%",
        test=lambda m: None if m.revenue_cagr_5y is None else m.revenue_cagr_5y >= 0.03,
        on_pass=lambda m: f"매출이 5년 동안 연평균 {pct(m.revenue_cagr_5y, 1)} 성장했습니다.",
        on_fail=lambda m: f"매출 성장이 연평균 {pct(m.revenue_cagr_5y, 1)}로 둔화돼 있습니다.",
    ),
    Criterion(
        code="BUF_VALUATION",
        label="현재 가격",
        weight=3,
        detail="잉여현금흐름 수익률 ≥ 4% 또는 EV/EBIT가 자기 5년 중앙값 이하",
        test=lambda m: (
            None
            if m.fcf_yield is None and m.ev_ebit_vs_median is None
            else ((m.fcf_yield or 0) >= 0.04 or (m.ev_ebit_vs_median or 99) <= 1.0)
        ),
        on_pass=lambda m: f"현재 가치평가가 과거 평균보다 부담이 적습니다(FCF 수익률 {pct(m.fcf_yield, 1)}).",
        on_fail=lambda m: f"현재 가치평가가 과거 평균보다 높은 편입니다(FCF 수익률 {pct(m.fcf_yield, 1)}).",
    ),
]

STYLE = Style(id="buffett", name="워런 버핏·찰리 멍거", model_version="Buffett 1.0", criteria=CRITERIA)
