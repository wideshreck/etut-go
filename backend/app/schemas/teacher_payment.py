import uuid
from datetime import date, datetime

from pydantic import BaseModel


class TeacherPaymentCreate(BaseModel):
    teacher_id: uuid.UUID
    period: str  # 2026-03
    base_salary: float = 0
    lesson_count: int = 0
    per_lesson_rate: float = 0
    bonus: float = 0
    deduction: float = 0
    notes: str | None = None


class TeacherPaymentUpdate(BaseModel):
    status: str | None = None
    payment_method: str | None = None
    paid_date: date | None = None
    bonus: float | None = None
    deduction: float | None = None
    notes: str | None = None


class TeacherPaymentResponse(BaseModel):
    id: uuid.UUID
    teacher_id: uuid.UUID
    teacher_name: str
    period: str
    base_salary: float
    lesson_count: int
    per_lesson_rate: float
    lesson_total: float
    bonus: float
    deduction: float
    total_amount: float
    status: str
    payment_method: str | None
    paid_date: date | None
    notes: str | None
    created_at: datetime


class TeacherPayrollSummary(BaseModel):
    period: str
    total_teachers: int
    total_amount: float
    paid_amount: float
    pending_amount: float
