from __future__ import annotations

import enum
import uuid
from datetime import date, datetime
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.group import Group
    from app.models.guardian import Guardian
    from app.models.institution import Institution
    from app.models.subject import Subject
    from app.models.teacher_availability import TeacherAvailability

from sqlalchemy import (
    Boolean,
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


class UserRole(enum.StrEnum):
    SUPERADMIN = "superadmin"
    ADMIN = "admin"
    TEACHER = "teacher"
    STUDENT = "student"
    PARENT = "parent"


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    full_name: Mapped[str] = mapped_column(String(255))
    phone: Mapped[str | None] = mapped_column(String(20))
    role: Mapped[UserRole] = mapped_column(Enum(UserRole))
    institution_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("institutions.id", ondelete="CASCADE"), index=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Teacher-specific: Professional
    subject_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("subjects.id", ondelete="SET NULL")
    )
    employment_type: Mapped[str | None] = mapped_column(String(20))
    start_date: Mapped[date | None] = mapped_column(Date)
    university: Mapped[str | None] = mapped_column(String(255))
    department: Mapped[str | None] = mapped_column(String(255))

    # Teacher-specific: Financial
    salary_type: Mapped[str | None] = mapped_column(String(20))
    salary_amount: Mapped[float | None] = mapped_column(Numeric(10, 2))
    iban: Mapped[str | None] = mapped_column(String(34))

    # Teacher-specific: Personal / Official
    tc_no: Mapped[str | None] = mapped_column(String(11))
    address: Mapped[str | None] = mapped_column(Text)
    emergency_contact: Mapped[str | None] = mapped_column(String(255))
    emergency_phone: Mapped[str | None] = mapped_column(String(20))

    # Student-specific: Academic
    enrollment_date: Mapped[date | None] = mapped_column(Date)
    enrollment_period: Mapped[str | None] = mapped_column(String(20))  # 2025-2026
    school: Mapped[str | None] = mapped_column(String(255))  # current school
    grade_level: Mapped[str | None] = mapped_column(String(50))  # 8. Sinif etc
    target_exam: Mapped[str | None] = mapped_column(String(50))  # LGS, YKS-Sayisal etc
    enrollment_status: Mapped[str | None] = mapped_column(
        String(20)
    )  # active, frozen, withdrawn, graduated
    group_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("groups.id", ondelete="SET NULL")
    )

    # Student-specific: Private lesson credits
    weekly_credits: Mapped[int | None] = mapped_column(Integer)  # how many per week
    credit_duration: Mapped[int | None] = mapped_column(
        Integer
    )  # minutes per credit (30, 45, 60)

    # Student-specific: Personal
    birth_date: Mapped[date | None] = mapped_column(Date)
    gender: Mapped[str | None] = mapped_column(String(10))

    # Internal notes (admin use)
    notes: Mapped[str | None] = mapped_column(Text)

    institution: Mapped[Institution | None] = relationship(
        foreign_keys=[institution_id]
    )
    subject: Mapped[Subject | None] = relationship(foreign_keys=[subject_id])
    availability: Mapped[list[TeacherAvailability]] = relationship()
    group: Mapped[Group | None] = relationship(foreign_keys=[group_id])
    guardians: Mapped[list[Guardian]] = relationship(
        back_populates="student", foreign_keys="[Guardian.student_id]"
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
