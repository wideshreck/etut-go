from __future__ import annotations

import uuid
from datetime import time

from sqlalchemy import CheckConstraint, ForeignKey, Integer, Time
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class TeacherAvailability(Base):
    __tablename__ = "teacher_availability"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    teacher_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    day_of_week: Mapped[int] = mapped_column(Integer)
    start_time: Mapped[time] = mapped_column(Time)
    end_time: Mapped[time] = mapped_column(Time)

    __table_args__ = (
        CheckConstraint("day_of_week BETWEEN 1 AND 7", name="valid_avail_day"),
        CheckConstraint("end_time > start_time", name="valid_avail_time"),
    )
