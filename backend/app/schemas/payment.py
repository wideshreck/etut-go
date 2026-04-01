import uuid
from datetime import date, datetime

from pydantic import BaseModel


class PaymentCreate(BaseModel):
    student_id: uuid.UUID
    installment_no: int
    amount: float
    due_date: date
    notes: str | None = None


class PaymentUpdate(BaseModel):
    status: str | None = None  # pending, paid, overdue, cancelled
    paid_date: date | None = None
    payment_method: str | None = None  # cash, bank_transfer, credit_card, other
    notes: str | None = None


class PaymentResponse(BaseModel):
    id: uuid.UUID
    student_id: uuid.UUID
    student_name: str
    institution_id: uuid.UUID
    installment_no: int
    amount: float
    due_date: date
    paid_date: date | None
    status: str
    payment_method: str | None
    notes: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class BulkPaymentCreate(BaseModel):
    student_id: uuid.UUID
    total_amount: float
    discount_rate: float = 0  # percentage (0-100)
    discount_description: str | None = None
    installment_count: int  # 1 = pesin, 3, 6, 10, 12
    start_date: date  # first installment due date
    notes: str | None = None


class PaymentSummary(BaseModel):
    total_expected: float
    total_paid: float
    total_pending: float
    total_overdue: float
    student_count: int
