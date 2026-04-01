import uuid
from datetime import date, datetime

from pydantic import BaseModel


class AssignmentCreate(BaseModel):
    title: str
    description: str | None = None
    assignment_type: str = "homework"
    subject_id: uuid.UUID
    due_date: date
    group_id: uuid.UUID  # required -- assignments are always for a group


class AssignmentUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    assignment_type: str | None = None
    due_date: date | None = None


class AssignmentResponse(BaseModel):
    id: uuid.UUID
    title: str
    description: str | None
    assignment_type: str
    subject_id: uuid.UUID
    subject_name: str
    due_date: date
    teacher_id: uuid.UUID
    teacher_name: str
    group_id: uuid.UUID | None
    group_name: str | None
    institution_id: uuid.UUID
    total_students: int
    completed_count: int
    created_at: datetime
    updated_at: datetime


class AssignmentStatusUpdate(BaseModel):
    student_id: uuid.UUID
    is_completed: bool
    teacher_note: str | None = None


class StudentAssignmentResponse(BaseModel):
    id: uuid.UUID
    title: str
    description: str | None
    assignment_type: str
    subject_name: str
    teacher_name: str
    due_date: date
    is_completed: bool
    completed_at: datetime | None
    teacher_note: str | None
