"""팀 데이터 파이프라인 산출물(scores.json)을 챗봇이 쓸 형태로 읽는다.

이 파일은 화면(apps/web)이 읽는 것과 **같은 scores.json**을 읽는다. 그래서 챗봇이
말하는 숫자와 화면에 뜬 숫자가 어긋날 수 없다. 지표를 프론트가 실어 보내는 방식을
쓰지 않는 이유가 이것이다.

여기서 꺼내 쓰는 것 세 가지:

- ``metrics``  종목별 지표 15개. camelCase 원본과 내부 키 둘 다 제공한다.
- ``styles``   페르소나별 기준 정의(code/label/weight/detail).
               기준을 코드에 하드코딩하지 않고 여기서 읽으므로, 팀이 임계값을
               바꾸면 챗봇이 자동으로 따라간다.
- ``scores``   종목×페르소나 판정. pass/fail/unknown과 화면에 뜬 문구가 들어 있다.

파일 경로는 SCORES_JSON_PATH 환경변수가 최우선이고, 없으면 아래 후보를 순서대로
찾는다. 팀 저장소 안으로 옮기면 후보 첫 항목이 맞아 들어간다.
"""
from __future__ import annotations

import json
import logging
import math
import os
import threading
from dataclasses import dataclass

from explain import NO_VALUE, load_dotenv_file, render_metrics_block

_HERE = os.path.dirname(os.path.abspath(__file__))
_LOG = logging.getLogger(__name__)

# scores.json을 찾을 후보 경로. 앞에 있는 것이 우선.
PATH_CANDIDATES = (
    # 팀 저장소 안으로 옮겼을 때 (<repo>/persona-chat/ 또는 <repo>/services/persona-chat/)
    os.path.join(_HERE, "..", "apps", "web", "lib", "generated", "scores.json"),
    os.path.join(_HERE, "..", "..", "apps", "web", "lib", "generated", "scores.json"),
    # 개발 중: 저장소 밖에서 clone한 사본을 본다
    os.path.join(_HERE, "..", "..", "..", "..", "wisor_develop",
                 "apps", "web", "lib", "generated", "scores.json"),
    os.path.join(_HERE, "..", "..", "..", "..", "tokenaires_wisor",
                 "apps", "web", "lib", "generated", "scores.json"),
    # 마지막 수단: 같은 폴더에 복사해 둔 파일
    os.path.join(_HERE, "scores.json"),
)

# 화면(apps/web/lib/scores.types.ts)의 METRIC_LABELS를 그대로 옮긴 것.
# (라벨, 표기형식, cap) — 형식과 cap까지 같아야 챗봇의 숫자 표기가 화면과 일치한다.
METRIC_SPEC: dict[str, tuple[str, str, float | None]] = {
    "roicAvg5y": ("자본수익률(5년 평균)", "pct", None),
    "magicFormulaRoc": ("마법공식 자본수익률", "pct", None),
    "fcfMargin": ("잉여현금흐름 마진", "pct", None),
    "fcfYield": ("잉여현금흐름 수익률", "pct", None),
    "netDebtToEbitda": ("순부채 / EBITDA", "x", None),
    "interestCoverage": ("이자보상배율", "x", 100),
    "revenueCagr5y": ("매출 5년 연평균 성장률", "pct", None),
    "epsCagr5y": ("주당순이익 5년 연평균 성장률", "pct", None),
    "pe": ("PER", "x", None),
    "pbr": ("PBR", "x", None),
    "peg": ("PEG", "raw", None),
    "currentRatio": ("유동비율", "raw", None),
    "debtToEquity": ("부채 / 자기자본", "raw", None),
    "evEbit": ("EV / EBIT", "x", None),
    "earningsYield": ("이익수익률(EBIT / 기업가치)", "pct", None),
}

# scores.json의 camelCase → explain.METRIC_LABELS의 내부 키.
# 손으로 넣는 경로와 데이터에서 오는 경로가 같은 이름을 쓰게 맞춰 준다.
SCORES_KEY_TO_METRIC = {
    "roicAvg5y": "ROIC_5y_avg",
    "magicFormulaRoc": "magic_formula_roc",
    "fcfMargin": "FCF_margin",
    "fcfYield": "FCF_yield",
    "netDebtToEbitda": "netDebt_to_EBITDA",
    "interestCoverage": "interest_coverage",
    "revenueCagr5y": "revenue_CAGR_5y",
    "epsCagr5y": "earnings_growth",
    "pe": "PER",
    "pbr": "PBR",
    "peg": "PEG",
    "currentRatio": "current_ratio",
    "debtToEquity": "debt_to_equity",
    "evEbit": "EV_EBIT",
    "earningsYield": "earnings_yield",
}


class ScoresNotFound(RuntimeError):
    """scores.json을 찾지 못했다."""


class UnknownTicker(KeyError):
    """유니버스에 없는 종목."""


class UnknownStyle(KeyError):
    """scores.json에 없는 페르소나."""


# ---- 값 표기 ----------------------------------------------------------------
#
# apps/web/lib/format.ts의 pct/times/plain과 같은 규칙. 화면과 다른 자리수를 쓰면
# 사용자가 두 숫자를 다른 값으로 읽는다.

def format_value(value, fmt: str, cap: float | None = None) -> str:
    if value is None:
        return NO_VALUE
    if fmt == "pct":
        return f"{value * 100:.1f}%"
    if fmt == "x":
        if cap is not None and value > cap:
            return f"{cap:g}배 초과"
        return f"{value:.1f}배"
    return f"{value:.2f}"


def format_metric(key: str, value) -> str:
    """camelCase 지표 키와 원본 값 → 화면과 같은 표기 문자열."""
    label, fmt, cap = METRIC_SPEC.get(key, (key, "raw", None))
    return format_value(value, fmt, cap)


# ---- 데이터 모델 ------------------------------------------------------------

@dataclass(frozen=True)
class StyleSpec:
    """페르소나 하나의 채점 규칙. scores.json의 styles[] 항목."""

    id: str
    name: str
    model_version: str
    method: str                      # "threshold" | "rank"
    criteria: tuple = ()             # ({code,label,weight,detail}, ...)


@dataclass(frozen=True)
class Company:
    ticker: str
    name: str
    sector: str
    price: float | None
    market_cap: float | None
    as_of: dict
    raw_metrics: dict                # camelCase 원본 값
    scorable: bool = True
    unscorable_reason: str | None = None
    styles: tuple = ()               # 이 종목에 판정이 있는 페르소나 id들

    @property
    def metrics(self) -> dict:
        """내부 키 → 원본 숫자. 값이 없으면 None."""
        return {SCORES_KEY_TO_METRIC[k]: v
                for k, v in self.raw_metrics.items() if k in SCORES_KEY_TO_METRIC}

    def display_pairs(self) -> list[tuple[str, str]]:
        """(화면 라벨, 화면 표기) 목록. METRIC_SPEC에 적은 순서를 따른다."""
        pairs = []
        for key, (label, fmt, cap) in METRIC_SPEC.items():
            if key not in self.raw_metrics:
                continue
            pairs.append((label, format_value(self.raw_metrics[key], fmt, cap)))
        return pairs

    def metrics_block(self) -> str:
        """<지표> 블록. 화면과 같은 라벨·표기를 쓴다."""
        header = []
        if self.sector:
            header.append(f"업종: {self.sector}")
        if self.as_of:
            header.append(f"가격 기준일: {self.as_of.get('price')} / "
                          f"재무 기준일: {self.as_of.get('financial')}")
        return render_metrics_block(self.display_pairs(),
                                   name=f"{self.name} ({self.ticker})",
                                   header=header)

    def summary(self) -> dict:
        """검색 결과·세션 응답에 실을 최소 정보."""
        return {"ticker": self.ticker, "name": self.name, "sector": self.sector,
                "styles": list(self.styles)}


@dataclass(frozen=True)
class Judgement:
    """한 종목 × 한 페르소나의 채점 결과."""

    ticker: str
    style: str
    persona_name: str
    model_version: str
    method: str
    score: int | None
    passed: int
    total_judged: int
    total: int
    data_confidence: str
    criteria: tuple = ()
    reasons: tuple = ()
    risks: tuple = ()
    rank: int | None = None
    rank_components: dict | None = None
    unscorable_reason: str | None = None

    @property
    def judged(self) -> bool:
        """기준별 판정이 하나라도 있는가. '판정 대상 아님'이면 False."""
        return bool(self.criteria)

    def summary(self) -> dict:
        return {
            "style": self.style, "personaName": self.persona_name,
            "modelVersion": self.model_version, "score": self.score,
            "passed": self.passed, "totalJudged": self.total_judged,
            "total": self.total, "dataConfidence": self.data_confidence,
            "judged": self.judged, "rank": self.rank,
        }


# ---- 로더 -------------------------------------------------------------------

class ScoresData:
    """scores.json 한 벌과 그 파일 버전. 완전히 읽은 뒤에만 공개한다."""

    def __init__(self, path: str):
        self.path = path
        with open(path, encoding="utf-8") as f:
            payload = json.load(f)
            self.file_version = _file_version(os.fstat(f.fileno()))

        if not isinstance(payload, dict):
            raise ValueError("scores.json 최상위 값은 객체여야 합니다.")
        if not isinstance(payload.get("generatedAt"), str) or not payload["generatedAt"]:
            raise ValueError("scores.json에 generatedAt이 없습니다.")
        if not isinstance(payload.get("dataSource"), str) or not payload["dataSource"]:
            raise ValueError("scores.json에 dataSource가 없습니다.")
        as_of = payload.get("asOf")
        if (not isinstance(as_of, dict) or
                not isinstance(as_of.get("price"), str) or
                not isinstance(as_of.get("financial"), str) or
                (as_of.get("priceAt") is not None and
                 not isinstance(as_of.get("priceAt"), str))):
            raise ValueError("scores.json의 asOf 기준일이 올바르지 않습니다.")
        styles = payload.get("styles")
        companies = payload.get("companies")
        if not isinstance(styles, list) or not styles:
            raise ValueError("scores.json의 styles 배열이 비어 있습니다.")
        if not isinstance(companies, list) or not companies:
            raise ValueError("scores.json의 companies 배열이 비어 있습니다.")

        style_ids = []
        for meta in styles:
            if (not isinstance(meta, dict) or
                    not isinstance(meta.get("id"), str) or not meta["id"] or
                    not isinstance(meta.get("criteria"), list)):
                raise ValueError("scores.json의 style 구조가 올바르지 않습니다.")
            style_ids.append(meta["id"])
        if len(style_ids) != len(set(style_ids)):
            raise ValueError("scores.json의 style id가 중복됐습니다.")

        normalized_tickers = []
        for row in companies:
            if not isinstance(row, dict) or not isinstance(row.get("ticker"), str):
                raise ValueError("scores.json의 company ticker가 올바르지 않습니다.")
            ticker = row["ticker"].strip().upper()
            scores = row.get("scores")
            company_as_of = row.get("asOf")
            if (not ticker or not isinstance(row.get("name"), str) or
                    not isinstance(row.get("price"), (int, float)) or
                    isinstance(row.get("price"), bool) or
                    not math.isfinite(row["price"]) or row["price"] <= 0 or
                    not isinstance(row.get("marketCap"), (int, float)) or
                    isinstance(row.get("marketCap"), bool) or
                    not math.isfinite(row["marketCap"]) or row["marketCap"] <= 0 or
                    not isinstance(company_as_of, dict) or
                    not isinstance(company_as_of.get("price"), str) or
                    not isinstance(company_as_of.get("financial"), str) or
                    (company_as_of.get("priceAt") is not None and
                     not isinstance(company_as_of.get("priceAt"), str)) or
                    not isinstance(row.get("metrics"), dict) or
                    not isinstance(scores, dict) or
                    any(style_id in scores and not isinstance(scores[style_id], dict)
                        for style_id in style_ids)):
                raise ValueError(f"scores.json의 {ticker or 'company'} 구조가 올바르지 않습니다.")
            normalized_tickers.append(ticker)
        if len(normalized_tickers) != len(set(normalized_tickers)):
            raise ValueError("scores.json의 ticker가 대소문자 구분 없이 중복됐습니다.")

        self.generated_at = payload.get("generatedAt")
        self.data_source = payload.get("dataSource")
        self.as_of = payload.get("asOf") or {}
        self.universe = payload.get("universe") or {}

        self.styles: dict[str, StyleSpec] = {}
        for meta in payload.get("styles") or []:
            self.styles[meta["id"]] = StyleSpec(
                id=meta["id"],
                name=meta.get("name") or meta["id"],
                model_version=meta.get("modelVersion") or "",
                method=meta.get("method") or "threshold",
                criteria=tuple(meta.get("criteria") or ()),
            )

        self._companies: dict[str, Company] = {}
        self._raw_scores: dict[str, dict] = {}
        for row in payload.get("companies") or []:
            ticker = row["ticker"].upper()
            scores = row.get("scores") or {}
            self._companies[ticker] = Company(
                ticker=ticker,
                name=row.get("name") or ticker,
                sector=row.get("sector") or "",
                price=row.get("price"),
                market_cap=row.get("marketCap"),
                as_of=row.get("asOf") or {},
                raw_metrics=row.get("metrics") or {},
                scorable=row.get("scorable", True),
                unscorable_reason=row.get("unscorableReason"),
                styles=tuple(scores),
            )
            self._raw_scores[ticker] = scores

    # -- 조회 --

    def __len__(self) -> int:
        return len(self._companies)

    def tickers(self) -> list[str]:
        return list(self._companies)

    def style_ids(self) -> list[str]:
        return list(self.styles)

    def company(self, ticker: str) -> Company:
        try:
            return self._companies[ticker.strip().upper()]
        except KeyError:
            raise UnknownTicker(ticker) from None

    def judgement(self, ticker: str, style: str) -> Judgement:
        company = self.company(ticker)
        if style not in self.styles:
            raise UnknownStyle(style)
        spec = self.styles[style]
        raw = self._raw_scores[company.ticker].get(style)
        if raw is None:
            # 유니버스에는 있지만 이 페르소나로는 채점하지 않은 종목.
            return Judgement(
                ticker=company.ticker, style=style, persona_name=spec.name,
                model_version=spec.model_version, method=spec.method,
                score=None, passed=0, total_judged=0, total=len(spec.criteria),
                data_confidence="판정 대상 아님",
                unscorable_reason=company.unscorable_reason,
            )
        return Judgement(
            ticker=company.ticker, style=style, persona_name=spec.name,
            model_version=raw.get("modelVersion") or spec.model_version,
            method=spec.method,
            score=raw.get("score"),
            passed=raw.get("passed") or 0,
            total_judged=raw.get("totalJudged") or 0,
            total=raw.get("total") or len(spec.criteria),
            data_confidence=raw.get("dataConfidence") or "",
            criteria=tuple(raw.get("criteria") or ()),
            reasons=tuple(raw.get("reasons") or ()),
            risks=tuple(raw.get("risks") or ()),
            rank=raw.get("rank"),
            rank_components=raw.get("rankComponents"),
            unscorable_reason=company.unscorable_reason,
        )

    def search(self, query: str, limit: int = 10) -> list[dict]:
        """티커·종목명 부분 일치. 티커가 정확히 맞으면 맨 앞에 온다."""
        q = (query or "").strip().lower()
        if not q:
            return []
        exact, prefix, contains = [], [], []
        for company in self._companies.values():
            ticker = company.ticker.lower()
            name = company.name.lower()
            if ticker == q:
                exact.append(company)
            elif ticker.startswith(q) or name.startswith(q):
                prefix.append(company)
            elif q in ticker or q in name:
                contains.append(company)
        ordered = exact + sorted(prefix, key=lambda c: c.ticker) + \
            sorted(contains, key=lambda c: c.ticker)
        return [c.summary() for c in ordered[:limit]]

    def meta(self) -> dict:
        """데이터 출처·기준일. 화면 하단 문구와 같은 정보."""
        return {
            "generatedAt": self.generated_at,
            "dataSource": self.data_source,
            "asOf": self.as_of,
            "companies": len(self._companies),
            "styles": [
                {"id": s.id, "name": s.name, "modelVersion": s.model_version,
                 "method": s.method, "criteria": list(s.criteria)}
                for s in self.styles.values()
            ],
        }


# ---- 모듈 단일 인스턴스 ------------------------------------------------------

_lock = threading.Lock()
_data: ScoresData | None = None
_rejected_version: object | None = None


def _file_version(stat_result) -> tuple:
    """수정 시각의 앞뒤가 아니라 파일 자체가 바뀌었는지를 판별한다."""
    return (
        stat_result.st_dev,
        stat_result.st_ino,
        stat_result.st_size,
        stat_result.st_mtime_ns,
    )


def _same_path(first: str, second: str) -> bool:
    return os.path.normcase(os.path.abspath(first)) == os.path.normcase(os.path.abspath(second))


def _keep_last_good(previous: ScoresData | None, version, exc: Exception) -> ScoresData:
    global _rejected_version
    if previous is None:
        raise exc
    if version != _rejected_version:
        _LOG.error("새 scores.json을 읽지 못해 이전 데이터를 유지합니다: %s", exc)
        _rejected_version = version
    return previous


def resolve_path(path: str | None = None) -> str:
    """쓸 scores.json 경로를 정한다. 못 찾으면 ScoresNotFound."""
    if path:
        if not os.path.exists(path):
            raise ScoresNotFound(f"지정한 경로에 파일이 없습니다: {path}")
        return path

    load_dotenv_file()
    from_env = os.getenv("SCORES_JSON_PATH")
    if from_env:
        if not os.path.exists(from_env):
            raise ScoresNotFound(
                f"SCORES_JSON_PATH가 가리키는 파일이 없습니다: {from_env}")
        return from_env

    for candidate in PATH_CANDIDATES:
        if os.path.exists(candidate):
            return os.path.normpath(candidate)
    raise ScoresNotFound(
        "scores.json을 찾지 못했습니다. .env에 SCORES_JSON_PATH를 설정하세요.\n"
        "찾아본 곳:\n  " + "\n  ".join(os.path.normpath(p) for p in PATH_CANDIDATES)
    )


def get_data(path: str | None = None, reload: bool = False) -> ScoresData:
    """파일이 바뀌면 새 스냅샷으로 교체하고, 실패하면 마지막 정상본을 유지한다."""
    global _data, _rejected_version
    with _lock:
        try:
            resolved = resolve_path(path)
        except ScoresNotFound as exc:
            requested = path or os.getenv("SCORES_JSON_PATH")
            same_requested = _data is not None and (
                (requested is not None and _same_path(requested, _data.path)) or
                (requested is None and any(_same_path(candidate, _data.path)
                                           for candidate in PATH_CANDIDATES))
            )
            if same_requested:
                return _keep_last_good(
                    _data, ("unavailable", type(exc).__name__, str(exc)), exc)
            raise

        same_path = _data is not None and _same_path(resolved, _data.path)
        previous = _data if same_path else None
        try:
            version = _file_version(os.stat(resolved))
        except OSError as exc:
            return _keep_last_good(
                previous, ("unavailable", type(exc).__name__, exc.errno), exc)

        if same_path and not reload and version == _data.file_version:
            return _data
        if same_path and not reload and version == _rejected_version:
            return _data

        try:
            candidate = ScoresData(resolved)
        except (OSError, UnicodeDecodeError, ValueError, KeyError, TypeError) as exc:
            return _keep_last_good(previous, version, exc)

        if previous is not None and previous.generated_at != candidate.generated_at:
            _LOG.info(
                "scores.json을 다시 읽었습니다: %s -> %s",
                previous.generated_at,
                candidate.generated_at,
            )
        _data = candidate
        _rejected_version = None
        return _data


if __name__ == "__main__":
    import sys

    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8")
        except (AttributeError, OSError):
            pass

    data = get_data()
    print(f"경로: {data.path}")
    print(f"종목 {len(data)}개, 페르소나 {data.style_ids()}")
    print(f"기준일: {data.as_of}\n")

    ticker = sys.argv[1] if len(sys.argv) > 1 else data.tickers()[0]
    style = sys.argv[2] if len(sys.argv) > 2 else "buffett"
    company = data.company(ticker)
    print(company.metrics_block())
    print()
    from explain import format_criteria_block
    print(format_criteria_block(data.judgement(ticker, style)))
