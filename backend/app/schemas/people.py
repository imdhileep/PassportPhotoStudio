from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class PersonOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: Optional[str]
    is_named: bool
    face_count: int


class PersonUpdate(BaseModel):
    name: str


class PersonMerge(BaseModel):
    target_id: UUID
    source_ids: List[UUID]
