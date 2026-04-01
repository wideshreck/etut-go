from __future__ import annotations

import enum
import uuid
from datetime import date, datetime
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.group import Group
    from app.models.subject import Subject
    from app.models.user import User

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class AssignmentType(enum.StrEnum):
    HOMEWORK = "homework"  # Ev odevi
    TEST = "test"  # Test/quiz
    PROJECT = "project"  # Proje
    READING = "reading"  # Okuma odevi
    PRACTICE = "practice"  # Alistirma


class Assignment(Base):
    __tablename__ = "assignments"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text)
    assignment_type: Mapped[AssignmentType] = mapped_column(
        Enum(AssignmentType), default=AssignmentType.HOMEWORK
    )
    subject_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("subjects.id", ondelete="CASCADE")
    )
    due_date: Mapped[date] = mapped_column(Date)
    teacher_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    group_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("groups.id", ondelete="CASCADE")
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

    teacher: Mapped[User] = relationship(foreign_keys=[teacher_id])
    subject: Mapped[Subject] = relationship()
    group: Mapped[Group | None] = relationship()
    statuses: Mapped[list[AssignmentStatus]] = relationship(
        back_populates="assignment", cascade="all, delete-orphan"
    )


class AssignmentStatus(Base):
    __tablename__ = "assignment_statuses"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    assignment_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("assignments.id", ondelete="CASCADE"), index=True
    )
    student_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE")
    )
    is_completed: Mapped[bool] = mapped_column(Boolean, default=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    teacher_note: Mapped[str | None] = mapped_column(Text)  # Teacher feedback

    assignment: Mapped[Assignment] = relationship(back_populates="statuses")
    student: Mapped[User] = relationship()

    __table_args__ = (
        UniqueConstraint("assignment_id", "student_id", name="uq_assignment_student"),
    )
