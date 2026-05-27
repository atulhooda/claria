from fastapi import APIRouter

from app.core.config import get_settings
from app.schemas.common import BaseSchema

router = APIRouter(tags=["health"])


class HealthResponse(BaseSchema):
    status: str
    env: str
    version: str


@router.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    settings = get_settings()
    return HealthResponse(status="ok", env=settings.app_env, version="0.0.0")
