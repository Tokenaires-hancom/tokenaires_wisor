"""엔드포인트 검증 — 이미지 검증과 응답 형식."""

import io

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app.main import app

client = TestClient(app)


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
