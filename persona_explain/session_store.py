"""대화 세션 보관소 — 메모리, TTL, 개수 상한.

세션을 서버가 들고 있는 이유는 대화 기록이 프롬프트의 일부이기 때문이다. 기록을
브라우저가 들고 왕복하면 사용자가 앵커(<지표>·<기준판정>)를 고쳐 보낼 수 있고,
그러면 챗봇이 화면과 다른 숫자를 말하게 된다.

메모리에만 두므로 서버를 다시 띄우면 전부 사라진다. 그래서 프론트는 세션이 없다는
응답(404)을 받으면 세션을 새로 만들 수 있게 만들어야 한다.

두 가지로 메모리를 묶는다.

- TTL: 마지막으로 쓴 뒤 30분이 지나면 버린다.
- 상한: 200개를 넘으면 가장 오래 쓰지 않은 것부터 버린다. 창을 닫아도 세션은
  남으므로 상한이 없으면 계속 늘어난다.
"""
from __future__ import annotations

import secrets
import threading
import time
from dataclasses import dataclass
from typing import Any

DEFAULT_TTL_SECONDS = 30 * 60
DEFAULT_MAX_SESSIONS = 200


class SessionNotFound(KeyError):
    """없는 세션이거나 만료돼 버려진 세션."""


@dataclass
class Entry:
    value: Any
    created_at: float
    last_used_at: float


class SessionStore:
    """id → 아무 객체. 여기서는 PersonaChat을 담는다.

    담는 것이 무엇인지 모르게 해 두면 LLM 없이도 보관 정책만 따로 시험할 수 있다.
    """

    def __init__(self, ttl_seconds: float = DEFAULT_TTL_SECONDS,
                 max_sessions: int = DEFAULT_MAX_SESSIONS,
                 clock=time.monotonic):
        self.ttl_seconds = ttl_seconds
        self.max_sessions = max_sessions
        self._clock = clock
        self._lock = threading.RLock()
        self._entries: dict[str, Entry] = {}

    # ---- 조회 --------------------------------------------------------------

    def __len__(self) -> int:
        with self._lock:
            return len(self._entries)

    def __contains__(self, session_id: str) -> bool:
        with self._lock:
            self._sweep_locked()
            return session_id in self._entries

    def ids(self) -> list[str]:
        with self._lock:
            return list(self._entries)

    def age_of(self, session_id: str) -> float:
        with self._lock:
            entry = self._entries.get(session_id)
            if entry is None:
                raise SessionNotFound(session_id)
            return self._clock() - entry.created_at

    def expires_in(self, session_id: str) -> float:
        """남은 수명(초). 프론트가 곧 만료된다고 알려 줄 수 있게."""
        with self._lock:
            entry = self._entries.get(session_id)
            if entry is None:
                raise SessionNotFound(session_id)
            return max(0.0, self.ttl_seconds - (self._clock() - entry.last_used_at))

    # ---- 변경 --------------------------------------------------------------

    def create(self, value: Any) -> str:
        """새 세션을 담고 id를 돌려준다. id는 추측할 수 없어야 한다."""
        with self._lock:
            self._sweep_locked()
            self._evict_locked()
            session_id = secrets.token_urlsafe(16)
            now = self._clock()
            self._entries[session_id] = Entry(value, now, now)
            return session_id

    def get(self, session_id: str) -> Any:
        """세션을 꺼내고 수명을 연장한다. 없으면 SessionNotFound."""
        with self._lock:
            self._sweep_locked()
            entry = self._entries.get(session_id)
            if entry is None:
                raise SessionNotFound(session_id)
            entry.last_used_at = self._clock()
            return entry.value

    def delete(self, session_id: str) -> bool:
        """지웠으면 True, 원래 없었으면 False."""
        with self._lock:
            return self._entries.pop(session_id, None) is not None

    def clear(self) -> None:
        with self._lock:
            self._entries.clear()

    def sweep(self) -> int:
        """만료된 세션을 버린다. 버린 개수를 돌려준다."""
        with self._lock:
            return self._sweep_locked()

    # ---- 내부 --------------------------------------------------------------

    def _sweep_locked(self) -> int:
        now = self._clock()
        stale = [sid for sid, e in self._entries.items()
                 if now - e.last_used_at >= self.ttl_seconds]
        for sid in stale:
            del self._entries[sid]
        return len(stale)

    def _evict_locked(self) -> int:
        """상한을 넘으면 가장 오래 쓰지 않은 것부터 버린다(자리 하나를 비운다)."""
        dropped = 0
        while len(self._entries) >= self.max_sessions:
            oldest = min(self._entries, key=lambda sid: self._entries[sid].last_used_at)
            del self._entries[oldest]
            dropped += 1
        return dropped
