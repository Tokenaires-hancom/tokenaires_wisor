"""POST /api/chart/analyze

받는 것: 이미지 1장, 선택적으로 lesson_id.
받지 않는 것: 종목명, 티커, 보유 여부. 설계 가이드 8장의 요구사항이다.

원본 이미지는 메모리에서만 다룬다. 정규화 단계에서 다시 인코딩되므로 EXIF(촬영 위치,
기기 정보)는 모델로 나가지 않는다. 디스크에 쓰지 않는다.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from ..core.config import Settings, settings
from ..schemas.analysis import AnalysisResponse
from ..services import vision_analyzer
from ..services.image import ImageRejected, normalize
from ..services.prompt import LESSON_IDS

log = logging.getLogger("wisor.chart")
router = APIRouter(prefix="/api/chart", tags=["chart"])


def get_settings() -> Settings:
    return settings


def _validate(upload: UploadFile, data: bytes, cfg: Settings) -> None:
    if upload.content_type not in cfg.allowed_media_types:
        raise HTTPException(status_code=415, detail="JPG, PNG, WebP 이미지만 올릴 수 있습니다.")
    if not data:
        raise HTTPException(status_code=400, detail="이미지가 비어 있습니다.")
    if len(data) > cfg.max_image_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"이미지가 너무 큽니다. {cfg.max_image_bytes // (1024 * 1024)}MB 이하로 줄여주세요.",
        )


@router.post("/analyze", response_model=AnalysisResponse)
async def analyze_chart(
    image: UploadFile = File(...),
    lesson_id: str | None = Form(default=None),
    cfg: Settings = Depends(get_settings),
) -> AnalysisResponse:
    raw = await image.read()
    _validate(image, raw, cfg)

    try:
        normalized = normalize(raw, cfg.min_edge_px)
    except ImageRejected as rejected:
        raise HTTPException(status_code=422, detail=rejected.reason)
    finally:
        del raw  # 원본은 여기서 끝

    if lesson_id and lesson_id not in LESSON_IDS:
        lesson_id = None

    provider = cfg.build_provider()

    try:
        outcome = await vision_analyzer.analyze(
            provider, normalized.data, normalized.media_type, lesson_id
        )
    except vision_analyzer.AnalysisRejected as rejected:
        raise HTTPException(status_code=422, detail=rejected.reason)

    # 남기는 것은 이 한 줄뿐이다. 이미지도, 종목도, 픽셀도 남기지 않는다.
    log.info(
        "chart_analysis_completed provider=%s attempts=%d filtered=%d lesson=%s "
        "size=%dx%d→%dx%d metadata_stripped=%s",
        provider.name,
        outcome.attempts,
        len(outcome.filtered_sentences),
        lesson_id or "-",
        *normalized.original_size,
        *normalized.final_size,
        normalized.stripped_metadata,
    )
    return outcome.response
