"""토스 토큰 만료 처리 검증.

500종목 배치는 토큰 수명보다 오래 걸린다. 토큰을 시작할 때 한 번만 받으면
중간부터 전부 401로 떨어지는데, 배치는 정상 종료하고 결과 파일도 써진다.
실제로 S~Z 구간 20종목이 이렇게 통째로 빠졌다.
"""

import pytest

from wisor_data.providers.sec_toss import ProviderDataError, SecTossProvider


class FakeToss:
    """첫 토큰은 만료된 상태. 두 번째 토큰부터 통한다."""

    def __init__(self):
        self.issued = 0
        self.calls = []

    def fetch_token(self):
        self.issued += 1
        return f"token-{self.issued}"

    def get_json(self, url, headers=None):
        auth = (headers or {}).get("Authorization", "")
        self.calls.append(auth)
        if auth == "Bearer token-1":
            raise ProviderDataError("HTTP 401", status=401)
        return {"result": "ok"}


def build(fake):
    p = SecTossProvider(
        toss_client_id="id", toss_client_secret="secret",
        sec_user_agent="wisor test@example.com", universe=["AAA"], get_json=fake.get_json,
    )
    p._fetch_token = fake.fetch_token
    return p


def test_expired_token_is_renewed_and_the_call_retried():
    fake = FakeToss()
    p = build(fake)

    assert p._toss_get("/api/v1/candles") == {"result": "ok"}
    assert fake.issued == 2, "만료된 토큰을 새로 받아야 한다"
    assert fake.calls == ["Bearer token-1", "Bearer token-2"]


def test_the_renewed_token_is_reused_for_later_calls():
    """종목마다 다시 인증하면 500번을 더 부른다."""
    fake = FakeToss()
    p = build(fake)
    p._toss_get("/api/v1/candles")

    p._toss_get("/api/v1/candles")

    assert fake.issued == 2, "이미 받은 토큰을 다시 쓴다"


def test_a_second_401_is_not_retried_forever():
    class AlwaysExpired(FakeToss):
        def get_json(self, url, headers=None):
            self.calls.append((headers or {}).get("Authorization", ""))
            raise ProviderDataError("HTTP 401", status=401)

    fake = AlwaysExpired()
    with pytest.raises(ProviderDataError):
        build(fake)._toss_get("/api/v1/candles")
    assert len(fake.calls) == 2


def test_other_errors_are_not_treated_as_token_expiry():
    class NotFound(FakeToss):
        def get_json(self, url, headers=None):
            self.calls.append(url)
            raise ProviderDataError("HTTP 404", status=404)

    fake = NotFound()
    with pytest.raises(ProviderDataError):
        build(fake)._toss_get("/api/v1/candles")
    assert fake.issued == 1, "404에 토큰을 다시 받지 않는다"
