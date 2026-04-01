import uuid
from datetime import datetime

from pydantic import BaseModel


class SubjectCreate(BaseModel):
    name: str
    color_code: str | None = None
    notes: str | None = None


class SubjectUpdate(BaseModel):
    name: str | None = None
    color_code: str | None = None
    notes: str | None = None


class SubjectResponse(BaseModel):
    id: uuid.UUID
    name: str
    institution_id: uuid.UUID
    color_code: str | None
    notes: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class SubjectWithCount(BaseModel):
    id: uuid.UUID
    name: str
    institution_id: uuid.UUID
    color_code: str | None
    notes: str | None
    teacher_count: int = 0
