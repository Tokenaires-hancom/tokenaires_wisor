"""비전 LLM 어댑터.

공급자를 바꿔도 vision_analyzer가 바뀌지 않게 한다. 설계 가이드 11장대로,
실제 차트 이미지로 품질을 비교한 뒤 공급자를 확정하기 위한 구조다.

API 키는 이 프로세스 안에서만 존재한다. 브라우저로 나가지 않는다.
"""

from __future__ import annotations

import json
import re
from typing import Protocol

_JSON_FENCE = re.compile(r"^```(?:json)?\s*|\s*```$", re.MULTILINE)


class VisionProvider(Protocol):
    name: str

    async def analyze(self, image_bytes: bytes, media_type: str, messages: dict) -> str:
        """모델의 원본 텍스트 응답을 그대로 돌려준다. 파싱은 호출부에서 한다."""
        ...


def parse_json(raw: str) -> dict:
    """모델이 코드블록으로 감싸 보내는 경우까지 받아낸다."""
    cleaned = _JSON_FENCE.sub("", raw.strip())
    start, end = cleaned.find("{"), cleaned.rfind("}")
    if start == -1 or end == -1:
        raise ValueError("모델 응답에서 JSON을 찾지 못했습니다.")
    return json.loads(cleaned[start : end + 1])


class AnthropicVisionProvider:
    """1차 구현. 비전 성능이 차트 판독 품질을 좌우하므로 여기서 시작한다."""

    name = "anthropic"

    def __init__(self, api_key: str, model: str, timeout: float = 60.0):
        self.api_key = api_key
        self.model = model
        self.timeout = timeout

    async def analyze(self, image_bytes: bytes, media_type: str, messages: dict) -> str:
        import base64

        import httpx

        payload = {
            "model": self.model,
            "max_tokens": 1500,
            "temperature": 0,
            "system": messages["system"],
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": media_type,
                                "data": base64.b64encode(image_bytes).decode(),
                            },
                        },
                        {"type": "text", "text": messages["user"]},
                    ],
                }
            ],
        }

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": self.api_key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json=payload,
            )
            response.raise_for_status()
            body = response.json()

        return "".join(block.get("text", "") for block in body.get("content", []))


class MockVisionProvider:
    """테스트와 로컬 개발용. 키 없이 화면 전체를 관통해 볼 수 있게 한다."""

    name = "mock"

    def __init__(self, canned: str | None = None):
        self.canned = canned or json.dumps(
            {
                "analyzable": True,
                "rejectionReason": None,
                "chartType": "candlestick",
                "observations": [
                    {
                        "category": "chart_type",
                        "visibility": "clear",
                        "description": "캔들 차트가 사용되고 있습니다.",
                    },
                    {
                        "category": "moving_average",
                        "visibility": "partial",
                        "description": "두 개 이상의 이동평균선이 겹쳐 있으나 기간 숫자는 명확하지 않습니다.",
                    },
                    {
                        "category": "trend",
                        "visibility": "clear",
                        "description": "최근 구간에서 고점과 저점이 비슷한 범위 안에 머무는 모습이 보입니다.",
                    },
                    {
                        "category": "volume",
                        "visibility": "clear",
                        "description": "아래쪽 패널에 거래량 막대가 표시되어 있습니다.",
                    },
                ],
                "uncertainties": [
                    "전체 차트 기간을 확인하기 어렵습니다.",
                    "정확한 가격 숫자가 선명하지 않습니다.",
                ],
                "learningPoints": ["횡보 추세", "이동평균선 배열", "거래량 확인 방법"],
                "relatedLessons": ["trend-basics", "moving-average-basics", "volume-basics"],
            },
            ensure_ascii=False,
        )

    async def analyze(self, image_bytes: bytes, media_type: str, messages: dict) -> str:
        return self.canned
