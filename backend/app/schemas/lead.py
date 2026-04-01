import uuid
from datetime import datetime

from pydantic import BaseModel


class LeadCreate(BaseModel):
    student_name: str
    parent_name: str | None = None
    phone: str
    email: str | None = None
    grade_level: str | None = None
    target_exam: str | None = None
    current_school: str | None = None
    source: str = "walk_in"
    assigned_to: uuid.UUID | None = None
    notes: str | None = None


class LeadUpdate(BaseModel):
    student_name: str | None = None
    parent_name: str | None = None
    phone: str | None = None
    email: str | None = None
    grade_level: str | None = None
    target_exam: str | None = None
    current_school: str | None = None
    status: str | None = None
    source: str | None = None
    assigned_to: uuid.UUID | None = None
    consultation_date: datetime | None = None
    consultation_score: int | None = None
    lost_reason: str | None = None
    notes: str | None = None


class LeadNoteCreate(BaseModel):
    content: str


class LeadNoteResponse(BaseModel):
    id: uuid.UUID
    content: str
    created_by: uuid.UUID
    author_name: str
    created_at: datetime


class LeadResponse(BaseModel):
    id: uuid.UUID
    student_name: str
    parent_name: str | None
    phone: str
    email: str | None
    grade_level: str | None
    target_exam: str | None
    current_school: str | None
    status: str
    source: str
    assigned_to: uuid.UUID | None
    assigned_to_name: str | None = None
    consultation_date: datetime | None
    consultation_score: int | None
    lost_reason: str | None
    notes: str | None
    notes_list: list[LeadNoteResponse] = []
    created_at: datetime
    updated_at: datetime


class LeadSummary(BaseModel):
    total: int
    new: int
    contacted: int
    consultation_scheduled: int
    consultation_done: int
    enrolled: int
    lost: int
    conversion_rate: float
