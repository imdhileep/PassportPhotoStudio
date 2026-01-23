from uuid import uuid4

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Index, Integer, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base


class Media(Base):
    __tablename__ = "media"
    __table_args__ = (
        Index("ix_media_captured_at", "captured_at"),
        Index("ix_media_season", "season"),
        Index("ix_media_has_gps", "has_gps"),
        Index("ix_media_media_type", "media_type"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    sha256 = Column(String(64), unique=True, nullable=False, index=True)
    original_filename = Column(String(255), nullable=False)
    storage_path = Column(String(512), unique=True, nullable=False)
    thumb_path = Column(String(512), nullable=True)
    mime_type = Column(String(128), nullable=True)
    media_type = Column(String(32), nullable=False)
    size_bytes = Column(Integer, nullable=False)
    width = Column(Integer, nullable=True)
    height = Column(Integer, nullable=True)
    duration_seconds = Column(Float, nullable=True)
    captured_at = Column(DateTime(timezone=True), nullable=True)
    imported_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    has_gps = Column(Boolean, nullable=False, default=False)
    gps_lat = Column(Float, nullable=True)
    gps_lon = Column(Float, nullable=True)
    gps_altitude = Column(Float, nullable=True)
    camera_make = Column(String(128), nullable=True)
    camera_model = Column(String(128), nullable=True)
    orientation = Column(Integer, nullable=True)
    season = Column(String(16), nullable=True)
    location_text = Column(String(256), nullable=True)
    raw_exif = Column(JSONB, nullable=True)
    face_count = Column(Integer, nullable=False, default=0)
    device_id = Column(UUID(as_uuid=True), ForeignKey("devices.id"), nullable=True)
    location_id = Column(UUID(as_uuid=True), ForeignKey("locations.id"), nullable=True)

    device = relationship("Device")
    location = relationship("Location")
    faces = relationship("Face", back_populates="media", cascade="all, delete-orphan")
