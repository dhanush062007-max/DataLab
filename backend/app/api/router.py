from fastapi import APIRouter
from app.api.endpoints import eda, cleaning, ml, stats, visualization, profiling

api_router = APIRouter()

api_router.include_router(eda.router, prefix="/datasets", tags=["eda"])
api_router.include_router(cleaning.router, prefix="/datasets", tags=["cleaning"])
api_router.include_router(ml.router, prefix="/datasets", tags=["ml"])
api_router.include_router(stats.router, prefix="/datasets", tags=["stats"])
api_router.include_router(visualization.router, prefix="/datasets", tags=["visualization"])
api_router.include_router(profiling.router, prefix="/datasets", tags=["profiling"])
