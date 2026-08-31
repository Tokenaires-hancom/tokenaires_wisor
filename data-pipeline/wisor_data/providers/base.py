"""재무데이터 공급자.

공급자를 바꿔도 배치 코드가 바뀌지 않도록 인터페이스를 하나로 고정한다.
예시 데이터와 실데이터 공급자가 같은 계약을 구현한다.
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
