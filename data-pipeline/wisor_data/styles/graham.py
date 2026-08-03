"""벤저민 그레이엄 스타일 — Graham 0.9 (초안)

"재무가 안전한 기업을 충분히 싸게." 안전마진과 재무 안정성에 무게를 둔다.
0.9는 초안 표기다. 상위 종목 검수(3번 담당) 이후 1.0으로 올린다.
"""

from .base import Criterion, Style, num, pct

CRITERIA = [
    Criterion(
        code="GRA_PE",
        label="이익 대비 가격",
        weight=3,
        detail="PER ≤ 15배",
        test=lambda m: None if m.pe is None else 0 < m.pe <= 15,
        on_pass=lambda m: f"이익 대비 가격이 낮은 편입니다(PER {num(m.pe)}배).",
        on_fail=lambda m: f"이익 대비 가격이 기준(15배)보다 높습니다(PER {num(m.pe)}배).",
    ),
    Criterion(
        code="GRA_PBR",
        label="자산 대비 가격",
        weight=2,
        detail="PBR ≤ 1.5배",
        test=lambda m: None if m.pbr is None else 0 < m.pbr <= 1.5,
        on_pass=lambda m: f"장부가치 대비 가격이 낮습니다(PBR {num(m.pbr)}배).",
        on_fail=lambda m: f"장부가치 대비 가격이 기준(1.5배)보다 높습니다(PBR {num(m.pbr)}배).",
    ),
    Criterion(
        code="GRA_CURRENT_RATIO",
        label="단기 지급 능력",
        weight=2,
        detail="유동비율 ≥ 1.5",
        test=lambda m: None if m.current_ratio is None else m.current_ratio >= 1.5,
        on_pass=lambda m: f"1년 안에 갚을 빚보다 유동자산이 {num(m.current_ratio)}배 많습니다.",
        on_fail=lambda m: f"유동비율이 {num(m.current_ratio)}로 기준(1.5)에 못 미칩니다.",
    ),
    Criterion(
        code="GRA_DEBT_EQUITY",
        label="자본 대비 부채",
        weight=2,
        detail="부채 / 자기자본 ≤ 1.0",
        test=lambda m: None if m.debt_to_equity is None else m.debt_to_equity <= 1.0,
        on_pass=lambda m: f"자기자본보다 부채가 적습니다(부채비율 {num(m.debt_to_equity, 2)}).",
        on_fail=lambda m: f"자기자본 대비 부채가 많습니다(부채비율 {num(m.debt_to_equity, 2)}).",
    ),
    Criterion(
        code="GRA_EARNINGS_STABILITY",
        label="이익의 지속성",
        weight=3,
        detail="최근 5년 연속 순이익 흑자",
        test=lambda m: None if m.data_years == 0 else m.profitable_years >= 5,
        on_pass=lambda m: "최근 5년 동안 매년 흑자를 냈습니다.",
        on_fail=lambda m: f"흑자를 낸 해가 5년 중 {m.profitable_years}년입니다.",
    ),
    Criterion(
        code="GRA_VALUE_TRAP",
        label="가치함정 점검",
        weight=2,
        detail="매출 5년 성장률 ≥ 0% (싼 데는 이유가 있는지 확인)",
        test=lambda m: None if m.revenue_cagr_5y is None else m.revenue_cagr_5y >= 0,
        on_pass=lambda m: f"가격이 낮으면서도 매출이 줄지 않았습니다(연평균 {pct(m.revenue_cagr_5y, 1)}).",
        on_fail=lambda m: f"매출이 5년 동안 연평균 {pct(m.revenue_cagr_5y, 1)}로 뒷걸음쳤습니다. 가격이 낮은 이유를 따로 봐야 합니다.",
    ),
]

STYLE = Style(id="graham", name="벤저민 그레이엄", model_version="Graham 0.9", criteria=CRITERIA)
