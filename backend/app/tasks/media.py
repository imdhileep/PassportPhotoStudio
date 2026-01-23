import mimetypes
from typing import Optional
from uuid import UUID

from sqlalchemy.orm import Session
from PIL import Image

from app.core.config import settings
from app.db.session import SessionLocal
from app.models.face import Face
from app.models.media import Media
from app.services.exif import extract_exif
from app.services.face_ai import detect_faces
from app.services.geo import reverse_geocode_optional, format_location
from app.services.person_matching import match_or_create_person
from app.services.season import infer_season
from app.services.storage import create_thumbnail
from app.worker import celery_app


def _derive_media_type(mime_type: Optional[str], filename: str) -> str:
    if mime_type and mime_type.startswith("image/"):
        return "image"
    if mime_type and mime_type.startswith("video/"):
        return "video"
    guessed, _ = mimetypes.guess_type(filename)
    if guessed and guessed.startswith("image/"):
        return "image"
    if guessed and guessed.startswith("video/"):
        return "video"
    return "other"


@celery_app.task
def process_media(media_id: str) -> dict:
    db: Session = SessionLocal()
    try:
        media = db.get(Media, UUID(media_id))
        if not media:
            return {"status": "not_found"}

        full_path = f"{settings.media_root}/{media.storage_path}"
        raw_exif, parsed = extract_exif(full_path)

        if parsed.get("captured_at"):
            media.captured_at = parsed["captured_at"]
        if parsed.get("camera_make"):
            media.camera_make = parsed["camera_make"]
        if parsed.get("camera_model"):
            media.camera_model = parsed["camera_model"]
        if parsed.get("orientation"):
            media.orientation = parsed["orientation"]
        if parsed.get("gps_lat") is not None and parsed.get("gps_lon") is not None:
            media.gps_lat = parsed["gps_lat"]
            media.gps_lon = parsed["gps_lon"]
            media.has_gps = True
            if not media.location_text:
                media.location_text = reverse_geocode_optional(media.gps_lat, media.gps_lon) or format_location(
                    media.gps_lat, media.gps_lon
                )
        if parsed.get("gps_altitude") is not None:
            media.gps_altitude = parsed["gps_altitude"]

        if raw_exif:
            media.raw_exif = raw_exif

        if not media.mime_type:
            media.mime_type = mimetypes.guess_type(media.original_filename)[0]
        if not media.media_type:
            media.media_type = _derive_media_type(media.mime_type, media.original_filename)

        if media.media_type == "image" and (not media.width or not media.height):
            try:
                with Image.open(full_path) as img:
                    media.width, media.height = img.size
            except Exception:
                pass

        if not media.thumb_path:
            media.thumb_path = create_thumbnail(media.storage_path, media.original_filename, media.mime_type)

        media.season = infer_season(media.captured_at, media.gps_lat)

        if not settings.ai_enabled:
            db.commit()
            return {"status": "ok", "ai": "disabled"}

        if media.media_type != "image":
            db.commit()
            return {"status": "ok", "ai": "skipped_non_image"}

        db.query(Face).filter(Face.media_id == media.id).delete()
        media.face_count = 0

        faces = detect_faces(full_path)
        for face in faces:
            person_id = match_or_create_person(db, face.embedding)
            db.add(
                Face(
                    media_id=media.id,
                    person_id=person_id,
                    bbox_x=face.bbox[0],
                    bbox_y=face.bbox[1],
                    bbox_w=face.bbox[2],
                    bbox_h=face.bbox[3],
                    confidence=face.confidence,
                    embedding=face.embedding,
                )
            )
            media.face_count += 1

        db.commit()
        return {"status": "ok"}
    finally:
        db.close()
