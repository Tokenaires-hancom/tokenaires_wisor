"""호출 제한 검증.

이 서비스는 요청 한 건마다 유료 비전 모델을 부른다. 인증이 아직 없으므로
IP를 기준으로 하루 횟수를 센다. 외부 의존성이 없어 단독으로 테스트한다.
"""

from app.services.rate_limit import DailyIpLimiter


def test_allows_requests_up_to_the_limit():
    limiter = DailyIpLimiter(limit=3)

    assert [limiter.allow("1.1.1.1", "2026-08-06") for _ in range(3)] == [True, True, True]


def test_blocks_the_request_past_the_limit():
    limiter = DailyIpLimiter(limit=2)
    for _ in range(2):
        limiter.allow("1.1.1.1", "2026-08-06")

    assert limiter.allow("1.1.1.1", "2026-08-06") is False


def test_counts_each_address_separately():
    limiter = DailyIpLimiter(limit=1)
    limiter.allow("1.1.1.1", "2026-08-06")

    assert limiter.allow("2.2.2.2", "2026-08-06") is True


def test_count_resets_on_a_new_day():
    limiter = DailyIpLimiter(limit=1)
    limiter.allow("1.1.1.1", "2026-08-06")

    assert limiter.allow("1.1.1.1", "2026-08-07") is True


def test_yesterday_counts_are_dropped_rather_than_kept_forever():
    """어제 주소를 계속 들고 있으면 메모리가 무한히 늘어난다. 하루치만 남는다."""
    limiter = DailyIpLimiter(limit=1)
    limiter.allow("1.1.1.1", "2026-08-06")
    limiter.allow("2.2.2.2", "2026-08-07")

    assert list(limiter._counts) == ["2.2.2.2"]
