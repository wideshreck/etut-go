import uuid
from datetime import datetime

from pydantic import BaseModel


class PrivateLessonBook(BaseModel):
    """Student books a lesson."""

    teacher_id: uuid.UUID
    subject_id: uuid.UUID
    scheduled_at: datetime
    notes: str | None = None


class PrivateLessonResponse(BaseModel):
    id: uuid.UUID
    teacher_id: uuid.UUID
    teacher_name: str
    student_id: uuid.UUID
    student_name: str
    subject_id: uuid.UUID
    subject_name: str
    institution_id: uuid.UUID
    scheduled_at: datetime
    duration_minutes: int
    status: str
    classroom: str | None
    notes: str | None
    created_at: datetime


class TeacherAvailableSlot(BaseModel):
    teacher_id: uuid.UUID
    teacher_name: str
    subject_name: str
    date: str  # YYYY-MM-DD
    start_time: str  # HH:MM
    end_time: str  # HH:MM


class StudentCreditInfo(BaseModel):
    weekly_credits: int
    credit_duration: int
    used_this_week: int
    remaining_this_week: int
