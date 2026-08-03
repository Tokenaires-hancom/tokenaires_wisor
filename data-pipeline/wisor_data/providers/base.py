"""재무데이터 공급자.

공급자를 바꿔도 배치 코드가 바뀌지 않도록 인터페이스를 하나로 고정한다.
MVP는 SampleProvider로 화면을 검증하고, 실서비스 전에 실데이터 공급자를 붙인다.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Protocol

from ..metrics import Fundamentals


class Provider(Protocol):
    source_name: str

    def load(self) -> list[Fundamentals]: ...

    def as_of(self) -> dict: ...


class SampleProvider:
    """저장소에 들어 있는 예시 데이터. 실제 재무수치가 아니다."""

    source_name = "sample"

    def __init__(self, path: Path):
        self.path = path
        self._raw = json.loads(path.read_text(encoding="utf-8"))

    def load(self) -> list[Fundamentals]:
        return [Fundamentals.from_dict(c) for c in self._raw["companies"]]

    def as_of(self) -> dict:
        return self._raw["asOf"]


class VendorProvider:
    """실데이터 공급자 자리. 3번(데이터·퀀트) 담당 작업 지점.

    구현할 때 지켜야 할 것
    - 종목 유니버스: 미국 중·대형주, ETF·우선주·SPAC 제외, 은행·보험·REIT는 별도 분류
    - 최근 5개 회계연도가 모두 있는 종목만 통과시킨다. 없는 해를 0으로 채우지 않는다
    - 가격은 전 거래일 종가. 장중 시세를 쓰지 않는다
    - 반환 전에 quality.check_all()을 통과해야 한다
    """

    source_name = "vendor"

    def __init__(self, api_key: str, universe: list[str]):
        self.api_key = api_key
        self.universe = universe

    def load(self) -> list[Fundamentals]:
        raise NotImplementedError("실데이터 공급자는 아직 붙이지 않았습니다.")

    def as_of(self) -> dict:
        raise NotImplementedError
