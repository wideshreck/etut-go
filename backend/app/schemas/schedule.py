import uuid
from datetime import time

from pydantic import BaseModel


class ScheduleCreate(BaseModel):
    group_id: uuid.UUID
    subject_id: uuid.UUID
    teacher_id: uuid.UUID
    classroom: str | None = None
    day_of_week: int
    start_time: time
    end_time: time


class ScheduleUpdate(BaseModel):
    subject_id: uuid.UUID | None = None
    teacher_id: uuid.UUID | None = None
    classroom: str | None = None
    day_of_week: int | None = None
    start_time: time | None = None
    end_time: time | None = None


class ScheduleResponse(BaseModel):
    id: uuid.UUID
    group_id: uuid.UUID
    group_name: str
    subject_id: uuid.UUID
    subject_name: str
    subject_color: str | None = None
    teacher_id: uuid.UUID
    teacher_name: str
    classroom: str | None
    day_of_week: int
    start_time: time
    end_time: time

    model_config = {"from_attributes": True}
