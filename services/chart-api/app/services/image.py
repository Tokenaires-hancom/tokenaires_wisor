"""업로드 이미지 정규화.

LLM에 보내기 전에 반드시 이 단계를 거친다. 세 가지를 동시에 해결한다.

1. **개인정보** — 휴대폰으로 찍은 사진에는 EXIF에 촬영 위치(GPS)와 기기 정보가 들어 있다.
   원본을 그대로 외부 모델에 보내면, 차트 영역만 잘라 올리라고 안내해 놓고도
   좌표를 함께 보내는 셈이 된다. 다시 인코딩하면 EXIF가 통째로 사라진다.
2. **비용** — 이미지는 base64로 실려 가면서 용량이 약 1.33배가 된다. 비전 모델이
   실제로 보는 해상도 이상으로 큰 이미지는 토큰만 더 쓰고 판독 품질은 그대로다.
3. **판독 가능성** — 너무 작은 이미지는 캔들과 선을 구분할 수 없다. 모델을 부르기 전에
   돌려보내 호출 비용과 오판을 함께 줄인다.

정규화에 실패하면 원본을 흘려보내지 않고 거절한다. 안전한 실패 쪽을 택한다.
"""

from __future__ import annotations

import io
from dataclasses import dataclass

# 대부분의 비전 모델이 내부적으로 축소하는 한계선. 이보다 크게 보내도 판독은 나아지지 않는다.
MAX_EDGE_PX = 1568
JPEG_QUALITY = 85
NORMALIZED_MEDIA_TYPE = "image/jpeg"


class ImageRejected(Exception):
    def __init__(self, reason: str):
        super().__init__(reason)
        self.reason = reason


@dataclass
class NormalizedImage:
    data: bytes
    media_type: str
    original_size: tuple[int, int]
    final_size: tuple[int, int]
    stripped_metadata: bool

    @property
    def resized(self) -> bool:
        return self.original_size != self.final_size


def normalize(data: bytes, min_edge_px: int) -> NormalizedImage:
    try:
        from PIL import Image, ImageOps
    except ImportError as exc:  # 정규화를 못 하면 보내지 않는다
        raise ImageRejected("이미지를 처리할 수 없어 분석을 진행하지 않았습니다.") from exc

    try:
        with Image.open(io.BytesIO(data)) as image:
            original_size = image.size
            had_metadata = bool(image.getexif()) or bool(image.info.get("exif"))

            if min(original_size) < min_edge_px:
                raise ImageRejected(
                    f"이미지가 작아 캔들과 선을 구분하기 어렵습니다"
                    f"(현재 {original_size[0]}×{original_size[1]}). "
                    "차트 영역을 더 크게 잘라서 올려주세요."
                )

            # EXIF의 회전 정보를 픽셀에 반영한 뒤 메타데이터는 버린다
            image = ImageOps.exif_transpose(image)
            if image.mode not in ("RGB", "L"):
                image = image.convert("RGB")

            image.thumbnail((MAX_EDGE_PX, MAX_EDGE_PX), Image.Resampling.LANCZOS)
            final_size = image.size

            buffer = io.BytesIO()
            # exif 인자를 주지 않으므로 결과에는 메타데이터가 남지 않는다
            image.save(buffer, format="JPEG", quality=JPEG_QUALITY, optimize=True)
    except ImageRejected:
        raise
    except Exception as exc:
        raise ImageRejected(
            "이미지를 읽지 못했습니다. 차트 화면을 캡처한 JPG 또는 PNG로 다시 올려주세요."
        ) from exc

    return NormalizedImage(
        data=buffer.getvalue(),
        media_type=NORMALIZED_MEDIA_TYPE,
        original_size=original_size,
        final_size=final_size,
        stripped_metadata=had_metadata,
    )
