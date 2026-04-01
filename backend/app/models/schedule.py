from __future__ import annotations

import uuid
from datetime import datetime, time
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.group import Group
    from app.models.subject import Subject
    from app.models.user import User

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Time,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class GroupSchedule(Base):
    __tablename__ = "group_schedules"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    group_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("groups.id", ondelete="CASCADE"), index=True
    )
    subject_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("subjects.id", ondelete="CASCADE")
    )
    teacher_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE")
    )
    classroom: Mapped[str | None] = mapped_column(String(100))
    day_of_week: Mapped[int] = mapped_column(Integer)
    start_time: Mapped[time] = mapped_column(Time)
    end_time: Mapped[time] = mapped_column(Time)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    group: Mapped[Group] = relationship()
    subject: Mapped[Subject] = relationship()
    teacher: Mapped[User] = relationship(foreign_keys=[teacher_id])

    __table_args__ = (
        CheckConstraint("day_of_week BETWEEN 1 AND 7", name="valid_day_of_week"),
        CheckConstraint("end_time > start_time", name="valid_time_range"),
    )
