from fastapi import APIRouter

from app.routers import auth, health, media, people, share

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(media.router)
api_router.include_router(people.router)
api_router.include_router(share.router)
