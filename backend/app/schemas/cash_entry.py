import uuid
from datetime import date, datetime

from pydantic import BaseModel


class CashEntryCreate(BaseModel):
    entry_type: str  # income, expense
    amount: float
    description: str
    category: str
    entry_date: date
    payment_method: str | None = None


class CashEntryResponse(BaseModel):
    id: uuid.UUID
    entry_type: str
    amount: float
    description: str
    category: str
    reference_id: str | None
    entry_date: date
    payment_method: str | None
    created_by: uuid.UUID
    created_by_name: str
    created_at: datetime


class CashSummary(BaseModel):
    total_income: float
    total_expense: float
    balance: float
    period_start: date
    period_end: date
