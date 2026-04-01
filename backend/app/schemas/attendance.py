import uuid
from datetime import date, datetime

from pydantic import BaseModel


class AttendanceEntry(BaseModel):
    student_id: uuid.UUID
    status: str  # present, absent, late, excused
    note: str | None = None


class AttendanceBulkCreate(BaseModel):
    schedule_id: uuid.UUID
    date: date
    entries: list[AttendanceEntry]


class AttendanceResponse(BaseModel):
    id: uuid.UUID
    schedule_id: uuid.UUID
    student_id: uuid.UUID
    student_name: str
    date: date
    status: str
    noted_by: uuid.UUID
    noted_by_name: str
    note: str | None
    created_at: datetime


class AttendanceSummary(BaseModel):
    student_id: uuid.UUID
    student_name: str
    total_lessons: int
    present: int
    absent: int
    late: int
    excused: int
    attendance_rate: float  # percentage
