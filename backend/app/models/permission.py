from __future__ import annotations

import uuid

from sqlalchemy import Column, ForeignKey, String, Table
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base

# Available permissions as constants
PERMISSIONS = [
    "dashboard.view",
    "teachers.view",
    "teachers.create",
    "teachers.edit",
    "teachers.delete",
    "students.view",
    "students.create",
    "students.edit",
    "students.delete",
    "subjects.view",
    "subjects.create",
    "subjects.edit",
    "subjects.delete",
    "groups.view",
    "groups.create",
    "groups.edit",
    "groups.delete",
    "schedules.view",
    "schedules.create",
    "schedules.edit",
    "schedules.delete",
    "private_lessons.view",
    "private_lessons.create",
    "payments.view",
    "payments.create",
    "payments.edit",
    "payments.delete",
    "announcements.view",
    "announcements.create",
    "announcements.edit",
    "announcements.delete",
    "attendance.view",
    "attendance.create",
    "leads.view",
    "leads.create",
    "leads.edit",
    "leads.delete",
    "leads.convert",
    "reports.view",
    "expenses.view",
    "expenses.create",
    "expenses.edit",
    "expenses.delete",
    "teacher_payments.view",
    "teacher_payments.create",
    "teacher_payments.edit",
    "cash_ledger.view",
    "cash_ledger.create",
    "settings.manage",
]


class AdminRole(Base):
    __tablename__ = "admin_roles"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100))
    institution_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("institutions.id", ondelete="CASCADE"), index=True
    )


# Role-Permission many-to-many
role_permissions = Table(
    "role_permissions",
    Base.metadata,
    Column(
        "role_id",
        ForeignKey("admin_roles.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column("permission", String(50), primary_key=True),
)

# User-AdminRole many-to-many (for admin users only)
user_admin_roles = Table(
    "user_admin_roles",
    Base.metadata,
    Column(
        "user_id",
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "role_id",
        ForeignKey("admin_roles.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)
