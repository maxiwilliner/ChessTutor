from fastapi import APIRouter
from backend.app.api.v1.endpoints.chesscom import router as chesscom_router
from backend.app.api.v1.endpoints.analysis import router as analysis_router
from backend.app.api.v1.endpoints.tutor import router as tutor_router
from backend.app.api.v1.endpoints.trainer import router as trainer_router

api_router = APIRouter()
api_router.include_router(chesscom_router)
api_router.include_router(analysis_router)
api_router.include_router(tutor_router)
api_router.include_router(trainer_router)


