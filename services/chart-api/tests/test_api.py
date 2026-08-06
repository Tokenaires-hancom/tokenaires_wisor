"""엔드포인트 검증 — 이미지 검증과 응답 형식."""

import io

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app.api.analyze import get_limiter
from app.main import app
from app.services.rate_limit import DailyIpLimiter

client = TestClient(app)


@pytest.fixture(autouse=True)
def fresh_rate_limit():
    """호출 제한은 프로세스 메모리에 쌓인다. 테스트끼리 한도를 나눠 쓰지 않게 비운다."""
    app.dependency_overrides[get_limiter] = lambda: DailyIpLimiter(limit=1000)
    yield
    app.dependency_overrides.clear()


def png(width: int = 800, height: int = 600) -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", (width, height), (255, 255, 255)).save(buffer, format="PNG")
    return buffer.getvalue()


def test_health():
    body = client.get("/health").json()
    assert body["status"] == "ok"
    assert body["promptVersion"]


def test_analyze_returns_structured_education():
    response = client.post(
        "/api/chart/analyze",
        files={"image": ("chart.png", png(), "image/png")},
        data={"lesson_id": "trend-basics"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["chartType"] == "candlestick"
    assert body["disclaimer"].endswith("투자 조언이 아닙니다.")
    assert set(body["observations"][0]) == {"category", "visibility", "description"}
    for banned in ("targetPrice", "buySignal", "confidence"):
        assert banned not in body


def test_rejects_unsupported_type():
    response = client.post(
        "/api/chart/analyze",
        files={"image": ("chart.gif", b"GIF89a", "image/gif")},
    )
    assert response.status_code == 415


def test_rejects_small_image():
    response = client.post(
        "/api/chart/analyze",
        files={"image": ("tiny.png", png(320, 200), "image/png")},
    )
    assert response.status_code == 422
    assert "차트 영역" in response.json()["detail"]


def test_rejects_file_that_is_not_an_image():
    response = client.post(
        "/api/chart/analyze",
        files={"image": ("fake.png", b"not really a png", "image/png")},
    )
    assert response.status_code == 422
    assert "이미지를 읽지 못했습니다" in response.json()["detail"]


def test_rejects_oversized_image():
    payload = png(800, 600) + b"\x00" * (5 * 1024 * 1024)
    response = client.post(
        "/api/chart/analyze",
        files={"image": ("big.png", payload, "image/png")},
    )
    assert response.status_code == 413


def test_unknown_lesson_id_is_ignored_not_rejected():
    response = client.post(
        "/api/chart/analyze",
        files={"image": ("chart.png", png(), "image/png")},
        data={"lesson_id": "elliott-wave"},
    )
    assert response.status_code == 200


def analyze_once():
    return client.post("/api/chart/analyze", files={"image": ("chart.png", png(), "image/png")})


def test_analyze_blocks_once_the_daily_limit_is_used_up():
    """요청 한 건이 유료 모델 호출 한 건이다. 한도 없이 열어두지 않는다."""
    limiter = DailyIpLimiter(limit=1)
    app.dependency_overrides[get_limiter] = lambda: limiter

    assert analyze_once().status_code == 200
    blocked = analyze_once()

    assert blocked.status_code == 429
    assert "내일" in blocked.json()["detail"]


def test_rejected_upload_does_not_use_up_the_daily_limit():
    """모델을 부르지 않은 요청은 한도를 쓰지 않는다. 잘못 올린 파일로 하루치가 날아가면 안 된다."""
    limiter = DailyIpLimiter(limit=1)
    app.dependency_overrides[get_limiter] = lambda: limiter

    assert client.post(
        "/api/chart/analyze", files={"image": ("tiny.png", png(320, 200), "image/png")}
    ).status_code == 422

    assert analyze_once().status_code == 200
