from __future__ import annotations

import enum
import uuid
from datetime import datetime
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.user import User

# Keep the group_students association table
from sqlalchemy import (
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Table,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

group_students = Table(
    "group_students",
    Base.metadata,
    Column("group_id", ForeignKey("groups.id", ondelete="CASCADE"), primary_key=True),
    Column("student_id", ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
)


class GroupStatus(enum.StrEnum):
    ACTIVE = "active"
    PASSIVE = "passive"
    MERGED = "merged"


class Group(Base):
    __tablename__ = "groups"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255))  # 12-A, LGS-Hizlandirma-B
    grade_level: Mapped[str] = mapped_column(String(50))  # 8, 9, 10, 11, 12, Mezun
    field: Mapped[str | None] = mapped_column(String(50))  # Sayisal, EA, Sozel, Dil
    academic_year: Mapped[str] = mapped_column(String(9))  # 2025-2026
    max_capacity: Mapped[int] = mapped_column(Integer, default=30)
    classroom: Mapped[str | None] = mapped_column(String(100))  # Derslik 3, Lab
    advisor_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    status: Mapped[GroupStatus] = mapped_column(
        Enum(GroupStatus), default=GroupStatus.ACTIVE
    )
    institution_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("institutions.id", ondelete="CASCADE"), index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    advisor: Mapped[User | None] = relationship(foreign_keys=[advisor_id])
    students: Mapped[list[User]] = relationship(secondary=group_students)

    __table_args__ = (
        UniqueConstraint(
            "name",
            "academic_year",
            "institution_id",
            name="uq_group_name_year_inst",
        ),
    )
