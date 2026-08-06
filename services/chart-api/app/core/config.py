"""환경설정. 비밀값은 환경변수로만 받는다."""

from __future__ import annotations

import os
from dataclasses import dataclass, field

MEGABYTE = 1024 * 1024


@dataclass
class Settings:
    provider: str = field(default_factory=lambda: os.getenv("WISOR_VISION_PROVIDER", "mock"))
    api_key: str = field(default_factory=lambda: os.getenv("WISOR_VISION_API_KEY", ""))
    model: str = field(
        default_factory=lambda: os.getenv("WISOR_VISION_MODEL", "claude-sonnet-4-6")
    )
    allowed_origins: list[str] = field(
        default_factory=lambda: os.getenv(
            "WISOR_ALLOWED_ORIGINS", "http://localhost:3000"
        ).split(",")
    )

    max_image_bytes: int = 5 * MEGABYTE
    allowed_media_types: tuple[str, ...] = ("image/jpeg", "image/png", "image/webp")
    min_edge_px: int = 400  # 이보다 작으면 캔들 구분이 어렵다
    daily_limit_per_ip: int = 10  # 인증이 붙기 전까지의 하한선. services/rate_limit.py

    def build_provider(self):
        from ..services.llm_adapter import AnthropicVisionProvider, MockVisionProvider

        if self.provider == "mock":
            return MockVisionProvider()
        if self.provider == "anthropic":
            if not self.api_key:
                raise RuntimeError("WISOR_VISION_API_KEY가 설정되지 않았습니다.")
            return AnthropicVisionProvider(self.api_key, self.model)
        raise RuntimeError(f"알 수 없는 공급자입니다: {self.provider}")


settings = Settings()
