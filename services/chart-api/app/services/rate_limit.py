"""호출 제한.

요청 한 건이 유료 비전 모델 호출 한 건이다. 인증이 아직 없으므로 IP를 기준으로 센다.

한계를 알고 쓴다. 프로세스 메모리에만 있으므로 재시작하면 초기화되고, 인스턴스를
여러 개 띄우면 인스턴스마다 따로 센다. NAT 뒤의 여러 사용자는 한 주소로 묶인다.
정확한 과금 방어가 아니라 무제한 호출을 막는 하한선이다. 사용자 인증이 붙으면
사용자 기준으로 옮긴다.
"""

from __future__ import annotations


class DailyIpLimiter:
    def __init__(self, limit: int):
        self.limit = limit
        self._day: str | None = None
        self._counts: dict[str, int] = {}

    def allow(self, address: str, today: str) -> bool:
        """한 건을 소비하고 허용 여부를 돌려준다. 한도를 넘으면 세지 않고 False."""
        if self._day != today:  # 날짜가 바뀌면 어제 것은 통째로 버린다
            self._day = today
            self._counts = {}

        if self._counts.get(address, 0) >= self.limit:
            return False

        self._counts[address] = self._counts.get(address, 0) + 1
        return True
