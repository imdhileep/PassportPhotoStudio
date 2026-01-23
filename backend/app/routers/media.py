import mimetypes
from typing import List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.face import Face
from app.models.media import Media
from app.models.person import Person
from app.schemas.media import MediaDetailOut, MediaOut, MediaUploadResult
from app.services.deps import get_current_user
from app.services.media_filters import apply_media_filters
from app.services.storage import compute_and_store, delete_media_files
from app.tasks.media import process_media

router = APIRouter(prefix="/media", tags=["media"])


@router.post("/upload", response_model=MediaUploadResult)
def upload_media(
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    items: list[MediaOut] = []

    for upload in files:
        sha256, size_bytes, storage_path = compute_and_store(upload)
        existing = db.query(Media).filter(Media.sha256 == sha256).first()
        if existing:
            items.append(MediaOut.model_validate(existing))
            continue

        mime_type = upload.content_type or mimetypes.guess_type(upload.filename or "")[0]
        media_type = (
            "image"
            if (mime_type or "").startswith("image/")
            else "video"
            if (mime_type or "").startswith("video/")
            else "other"
        )

        media = Media(
            sha256=sha256,
            original_filename=upload.filename or "file",
            storage_path=storage_path,
            mime_type=mime_type,
            media_type=media_type,
            size_bytes=size_bytes,
        )
        db.add(media)
        db.commit()
        db.refresh(media)
        process_media.delay(str(media.id))
        items.append(MediaOut.model_validate(media))

    return MediaUploadResult(items=items)


@router.get("", response_model=list[MediaOut])
def list_media(
    db: Session = Depends(get_db),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    person_ids: Optional[str] = None,
    season: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    has_faces: Optional[bool] = None,
    media_type: Optional[str] = None,
    camera_make: Optional[str] = None,
    camera_model: Optional[str] = None,
    q: Optional[str] = None,
):
    filters = {
        "person_ids": person_ids,
        "season": season,
        "media_type": media_type,
        "camera_make": camera_make,
        "camera_model": camera_model,
        "has_faces": has_faces,
        "date_from": date_from,
        "date_to": date_to,
        "q": q,
    }
    query, joined = apply_media_filters(db.query(Media), filters)

    if joined:
        query = query.distinct()

    rows = (
        query.order_by(Media.captured_at.desc().nullslast(), Media.imported_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return [MediaOut.model_validate(row) for row in rows]


@router.get("/{media_id}", response_model=MediaDetailOut)
def get_media(media_id: str, db: Session = Depends(get_db)):
    media = db.query(Media).filter(Media.id == media_id).first()
    if not media:
        raise HTTPException(status_code=404, detail="Media not found")
    return MediaDetailOut.model_validate(media)


@router.delete("/{media_id}")
def delete_media(
    media_id: str,
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    media = db.query(Media).filter(Media.id == media_id).first()
    if not media:
        raise HTTPException(status_code=404, detail="Media not found")

    delete_media_files(media.storage_path, media.thumb_path)
    db.delete(media)
    db.commit()
    return {"status": "deleted"}
