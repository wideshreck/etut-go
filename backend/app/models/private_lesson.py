from __future__ import annotations

import enum
import uuid
from datetime import datetime
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.subject import Subject
    from app.models.user import User

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class PrivateLessonStatus(enum.StrEnum):
    SCHEDULED = "scheduled"
    COMPLETED = "completed"
    CANCELLED_BY_STUDENT = "cancelled_by_student"
    CANCELLED_BY_TEACHER = "cancelled_by_teacher"
    NO_SHOW = "no_show"


class PrivateLesson(Base):
    __tablename__ = "private_lessons"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    teacher_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    student_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    subject_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("subjects.id", ondelete="CASCADE")
    )
    institution_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("institutions.id", ondelete="CASCADE"), index=True
    )
    scheduled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    duration_minutes: Mapped[int] = mapped_column(Integer, default=60)
    status: Mapped[PrivateLessonStatus] = mapped_column(
        Enum(PrivateLessonStatus), default=PrivateLessonStatus.SCHEDULED
    )
    classroom: Mapped[str | None] = mapped_column(String(100))
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    teacher: Mapped[User] = relationship(foreign_keys=[teacher_id])
    student: Mapped[User] = relationship(foreign_keys=[student_id])
    subject: Mapped[Subject] = relationship()
