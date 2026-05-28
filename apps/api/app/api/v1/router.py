from fastapi import APIRouter

from app.api.v1 import health, me
from app.api.v1.consultations import routes as consultations_routes
from app.api.v1.consultations import stream as consultations_stream

api_v1_router = APIRouter()
api_v1_router.include_router(health.router)
api_v1_router.include_router(me.router)
api_v1_router.include_router(consultations_routes.router)
api_v1_router.include_router(consultations_stream.router)
