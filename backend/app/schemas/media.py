from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class FaceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    person_id: Optional[UUID]
    bbox_x: float
    bbox_y: float
    bbox_w: float
    bbox_h: float
    confidence: float


class MediaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    original_filename: str
    storage_path: str
    thumb_path: Optional[str]
    mime_type: Optional[str]
    media_type: str
    size_bytes: int
    width: Optional[int] = None
    height: Optional[int] = None
    captured_at: Optional[datetime]
    imported_at: datetime
    season: Optional[str] = None
    has_gps: bool = False
    camera_make: Optional[str] = None
    camera_model: Optional[str] = None
    face_count: int = 0


class MediaUploadResult(BaseModel):
    items: list[MediaOut]


class MediaDetailOut(MediaOut):
    gps_lat: Optional[float] = None
    gps_lon: Optional[float] = None
    gps_altitude: Optional[float] = None
    orientation: Optional[int] = None
    location_text: Optional[str] = None
    faces: list[FaceOut] = []
