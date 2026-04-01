from __future__ import annotations

import enum
import uuid
from datetime import date, datetime
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.user import User

from sqlalchemy import (
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class TeacherPaymentStatus(enum.StrEnum):
    PENDING = "pending"
    PAID = "paid"
    CANCELLED = "cancelled"


class TeacherPayment(Base):
    __tablename__ = "teacher_payments"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    teacher_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    institution_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("institutions.id", ondelete="CASCADE"), index=True
    )
    period: Mapped[str] = mapped_column(String(7))  # 2026-03 (year-month)

    # Calculation details
    base_salary: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    lesson_count: Mapped[int] = mapped_column(Integer, default=0)
    per_lesson_rate: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    lesson_total: Mapped[float] = mapped_column(
        Numeric(10, 2), default=0
    )  # lesson_count * per_lesson_rate
    bonus: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    deduction: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    total_amount: Mapped[float] = mapped_column(Numeric(10, 2))

    status: Mapped[TeacherPaymentStatus] = mapped_column(
        Enum(TeacherPaymentStatus), default=TeacherPaymentStatus.PENDING
    )
    payment_method: Mapped[str | None] = mapped_column(String(20))
    paid_date: Mapped[date | None] = mapped_column(Date)
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    teacher: Mapped[User] = relationship(foreign_keys=[teacher_id])
