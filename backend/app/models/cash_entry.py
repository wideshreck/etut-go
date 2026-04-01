from __future__ import annotations

import enum
import uuid
from datetime import date, datetime
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.user import User

from sqlalchemy import Date, DateTime, Enum, ForeignKey, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class CashEntryType(enum.StrEnum):
    INCOME = "income"
    EXPENSE = "expense"


class CashEntry(Base):
    __tablename__ = "cash_entries"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    institution_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("institutions.id", ondelete="CASCADE"), index=True
    )
    entry_type: Mapped[CashEntryType] = mapped_column(Enum(CashEntryType))
    amount: Mapped[float] = mapped_column(Numeric(10, 2))
    description: Mapped[str] = mapped_column(String(255))
    category: Mapped[str] = mapped_column(
        String(50)
    )  # student_payment, teacher_salary, expense, other_income
    reference_id: Mapped[str | None] = mapped_column(
        String(36)
    )  # optional link to payment/expense
    entry_date: Mapped[date] = mapped_column(Date, index=True)
    payment_method: Mapped[str | None] = mapped_column(String(20))
    created_by: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    creator: Mapped[User] = relationship(foreign_keys=[created_by])
