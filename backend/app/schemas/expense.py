import uuid
from datetime import date, datetime

from pydantic import BaseModel


class ExpenseCreate(BaseModel):
    category: str
    amount: float
    description: str
    vendor: str | None = None
    expense_date: date
    payment_method: str | None = None
    receipt_no: str | None = None
    notes: str | None = None


class ExpenseUpdate(BaseModel):
    category: str | None = None
    amount: float | None = None
    description: str | None = None
    vendor: str | None = None
    expense_date: date | None = None
    payment_method: str | None = None
    receipt_no: str | None = None
    notes: str | None = None


class ExpenseResponse(BaseModel):
    id: uuid.UUID
    category: str
    amount: float
    description: str
    vendor: str | None
    expense_date: date
    payment_method: str | None
    receipt_no: str | None
    notes: str | None
    created_by: uuid.UUID
    created_by_name: str
    created_at: datetime
