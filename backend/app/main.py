from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.router import api_router
from app.core.config import settings
from app.services.storage import ensure_storage_dirs
from app.services.auth import hash_password
from app.db.session import SessionLocal
from app.models.user import User

app = FastAPI(title="HomeSnapShare API", version="0.1.0")
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def prepare_storage() -> None:
    ensure_storage_dirs()
    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.email == settings.admin_email).first()
        if not existing:
            user = User(
                email=settings.admin_email,
                password_hash=hash_password(settings.admin_password),
                is_admin=True,
            )
            db.add(user)
            db.commit()
    finally:
        db.close()


app.mount("/media-files", StaticFiles(directory=settings.media_root), name="media-files")
app.mount("/thumbs", StaticFiles(directory=settings.thumb_root), name="thumbs")
