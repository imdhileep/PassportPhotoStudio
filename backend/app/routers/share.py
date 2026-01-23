import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.media import Media
from app.models.share_link import ShareLink
from app.schemas.share import ShareCreate, ShareMediaResponse, ShareOut
from app.services.deps import get_current_user
from app.services.media_filters import apply_media_filters

router = APIRouter(prefix="/share", tags=["share"])


@router.post("", response_model=ShareOut)
def create_share(payload: ShareCreate, db: Session = Depends(get_db), _user=Depends(get_current_user)):
    token = secrets.token_urlsafe(16)
    expires_at = None
    if payload.expires_minutes:
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=payload.expires_minutes)
    link = ShareLink(token=token, filters=payload.filters, expires_at=expires_at)
    db.add(link)
    db.commit()
    db.refresh(link)
    return ShareOut.model_validate(link)


@router.get("/{token}", response_model=ShareMediaResponse)
def get_share(token: str, db: Session = Depends(get_db), limit: int = Query(100, ge=1, le=500)):
    link = db.query(ShareLink).filter(ShareLink.token == token).first()
    if not link:
        raise HTTPException(status_code=404, detail="Share not found")
    if link.expires_at and link.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=410, detail="Share expired")

    query, joined = apply_media_filters(db.query(Media), link.filters or {})
    if joined:
        query = query.distinct()
    items = query.order_by(Media.captured_at.desc().nullslast(), Media.imported_at.desc()).limit(limit).all()
    return ShareMediaResponse(filters=link.filters or {}, items=items)
