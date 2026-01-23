from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.schemas.media import MediaOut


class ShareCreate(BaseModel):
    filters: dict[str, Any]
    expires_minutes: Optional[int] = None


class ShareOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    token: str
    filters: dict[str, Any]
    created_at: datetime
    expires_at: Optional[datetime] = None


class ShareMediaResponse(BaseModel):
    filters: dict[str, Any]
    items: list[MediaOut]
