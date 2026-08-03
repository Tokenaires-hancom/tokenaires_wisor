"""Wisor 차트 분석 서비스.

    uvicorn app.main:app --reload --port 8000
"""

from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api import analyze
from .core.config import settings
from .services.prompt import PROMPT_VERSION

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

app = FastAPI(
    title="Wisor Chart API",
    version="0.1.0",
    description="차트 이미지에서 보이는 것을 교육용으로 설명합니다. 예측과 매매 판단은 제공하지 않습니다.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=False,
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)

app.include_router(analyze.router)


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "provider": settings.provider,
        "promptVersion": PROMPT_VERSION,
    }
