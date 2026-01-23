from uuid import uuid4

from sqlalchemy import Column, DateTime, Float, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from app.db.base import Base


class Location(Base):
    __tablename__ = "locations"
    __table_args__ = (UniqueConstraint("lat", "lon", name="uq_locations_lat_lon"),)

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    lat = Column(Float, nullable=False)
    lon = Column(Float, nullable=False)
    label = Column(String(256), nullable=True)
    city = Column(String(128), nullable=True)
    region = Column(String(128), nullable=True)
    country = Column(String(128), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
