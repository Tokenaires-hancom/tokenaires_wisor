"""이미지 정규화 검증.

가장 중요한 것: 사용자가 올린 사진의 촬영 위치가 외부 모델로 나가지 않아야 한다.
"""

import io

import pytest
from PIL import Image

from app.services.image import MAX_EDGE_PX, ImageRejected, normalize

MIN_EDGE = 400


def make_image(width=900, height=700, fmt="PNG", exif: bytes | None = None) -> bytes:
    buffer = io.BytesIO()
    image = Image.new("RGB", (width, height), (240, 240, 245))
    if exif is not None:
        image.save(buffer, format=fmt, exif=exif)
    else:
        image.save(buffer, format=fmt)
    return buffer.getvalue()


def exif_with_gps() -> bytes:
    """촬영 위치와 기기 정보가 담긴 EXIF. 휴대폰 사진에 흔히 들어 있는 형태."""
    exif = Image.Exif()
    exif[271] = "TestPhone"       # Make
    exif[272] = "Model X"         # Model
    exif[274] = 1                 # Orientation
    exif[34853] = {               # GPSInfo — 촬영 위치
        1: "N",
        2: (37.0, 33.0, 0.0),
        3: "E",
        4: (126.0, 58.0, 0.0),
    }
    return exif.tobytes()


def read_exif(data: bytes) -> Image.Exif:
    with Image.open(io.BytesIO(data)) as image:
        return image.getexif()


def test_gps_metadata_is_removed():
    original = make_image(1200, 900, fmt="JPEG", exif=exif_with_gps())
    assert read_exif(original), "테스트 전제: 원본에는 EXIF가 있어야 한다"

    result = normalize(original, MIN_EDGE)

    assert result.stripped_metadata is True
    assert not read_exif(result.data), "정규화 후 EXIF가 남아 있습니다"
    assert 34853 not in read_exif(result.data)  # GPSInfo


def test_output_is_always_jpeg():
    result = normalize(make_image(fmt="PNG"), MIN_EDGE)
    assert result.media_type == "image/jpeg"
    with Image.open(io.BytesIO(result.data)) as image:
        assert image.format == "JPEG"


def test_large_image_is_downscaled():
    result = normalize(make_image(4000, 3000), MIN_EDGE)
    assert max(result.final_size) == MAX_EDGE_PX
    assert result.resized is True
    # 가로세로 비율이 유지되어야 차트가 찌그러지지 않는다
    assert abs(result.final_size[0] / result.final_size[1] - 4000 / 3000) < 0.01


def test_large_image_gets_much_smaller():
    original = make_image(4000, 3000)
    result = normalize(original, MIN_EDGE)
    assert len(result.data) < len(original) / 2


def test_small_image_is_not_upscaled():
    result = normalize(make_image(800, 600), MIN_EDGE)
    assert result.final_size == (800, 600)
    assert result.resized is False


def test_too_small_image_is_rejected():
    with pytest.raises(ImageRejected) as exc:
        normalize(make_image(320, 240), MIN_EDGE)
    assert "차트 영역" in exc.value.reason


def test_non_image_is_rejected():
    with pytest.raises(ImageRejected) as exc:
        normalize("이건 이미지가 아닙니다".encode("utf-8"), MIN_EDGE)
    assert "이미지를 읽지 못했습니다" in exc.value.reason


def test_rotation_is_applied_to_pixels():
    """EXIF를 버리기 전에 회전 정보는 픽셀에 반영해야 한다.
    그러지 않으면 메타데이터만 지웠을 때 차트가 눕는다."""
    exif = Image.Exif()
    exif[274] = 6  # 시계 방향 90도 회전
    original = make_image(900, 600, fmt="JPEG", exif=exif.tobytes())

    result = normalize(original, MIN_EDGE)

    assert result.final_size == (600, 900), "회전이 픽셀에 반영되지 않았습니다"
    assert not read_exif(result.data)
