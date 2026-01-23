from uuid import uuid4

from pgvector.sqlalchemy import Vector
from sqlalchemy import Column, DateTime, Float, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base


class Face(Base):
    __tablename__ = "faces"
    __table_args__ = (
        Index("ix_faces_media_id", "media_id"),
        Index("ix_faces_person_id", "person_id"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    media_id = Column(UUID(as_uuid=True), ForeignKey("media.id"), nullable=False)
    person_id = Column(UUID(as_uuid=True), ForeignKey("people.id"), nullable=True)
    bbox_x = Column(Float, nullable=False)
    bbox_y = Column(Float, nullable=False)
    bbox_w = Column(Float, nullable=False)
    bbox_h = Column(Float, nullable=False)
    confidence = Column(Float, nullable=False)
    embedding = Column(Vector(512), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    media = relationship("Media", back_populates="faces")
    person = relationship("Person")
