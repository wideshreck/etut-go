import uuid
from datetime import datetime

from pydantic import BaseModel


class GroupCreate(BaseModel):
    name: str
    grade_level: str
    field: str | None = None
    academic_year: str
    max_capacity: int = 30
    classroom: str | None = None
    advisor_id: uuid.UUID | None = None


class GroupUpdate(BaseModel):
    name: str | None = None
    grade_level: str | None = None
    field: str | None = None
    academic_year: str | None = None
    max_capacity: int | None = None
    classroom: str | None = None
    advisor_id: uuid.UUID | None = None
    status: str | None = None


class GroupResponse(BaseModel):
    id: uuid.UUID
    name: str
    grade_level: str
    field: str | None
    academic_year: str
    max_capacity: int
    classroom: str | None
    advisor_id: uuid.UUID | None
    advisor_name: str | None = None
    status: str
    institution_id: uuid.UUID
    student_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class StudentIds(BaseModel):
    student_ids: list[uuid.UUID]
