from __future__ import annotations

import enum
import uuid
from datetime import date, datetime
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.user import User

from sqlalchemy import Date, DateTime, Enum, ForeignKey, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class ExpenseCategory(enum.StrEnum):
    RENT = "rent"  # Kira
    UTILITIES = "utilities"  # Elektrik, Su, Dogalgaz
    INTERNET = "internet"  # Internet, Telefon
    SUPPLIES = "supplies"  # Kirtasiye, Malzeme
    MAINTENANCE = "maintenance"  # Bakim, Onarim
    CLEANING = "cleaning"  # Temizlik
    SALARY = "salary"  # Maas odemesi
    INSURANCE = "insurance"  # Sigorta
    TAX = "tax"  # Vergi
    MARKETING = "marketing"  # Reklam, Pazarlama
    FOOD = "food"  # Yiyecek, Icecek
    TRANSPORT = "transport"  # Ulasim, Servis
    BOOKS = "books"  # Kitap, Yayin
    EQUIPMENT = "equipment"  # Ekipman, Teknoloji
    OTHER = "other"  # Diger


class Expense(Base):
    __tablename__ = "expenses"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    institution_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("institutions.id", ondelete="CASCADE"), index=True
    )
    category: Mapped[ExpenseCategory] = mapped_column(Enum(ExpenseCategory))
    amount: Mapped[float] = mapped_column(Numeric(10, 2))
    description: Mapped[str] = mapped_column(String(255))
    vendor: Mapped[str | None] = mapped_column(String(255))  # supplier name
    expense_date: Mapped[date] = mapped_column(Date, index=True)
    payment_method: Mapped[str | None] = mapped_column(
        String(20)
    )  # cash, bank_transfer, credit_card
    receipt_no: Mapped[str | None] = mapped_column(String(50))  # fatura/makbuz no
    notes: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    creator: Mapped[User] = relationship(foreign_keys=[created_by])
