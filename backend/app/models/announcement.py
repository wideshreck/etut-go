from __future__ import annotations

import enum
import uuid
from datetime import datetime
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.user import User

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class AnnouncementTarget(enum.StrEnum):
    ALL = "all"
    TEACHER = "teacher"
    STUDENT = "student"
    PARENT = "parent"


class AnnouncementPriority(enum.StrEnum):
    NORMAL = "normal"
    IMPORTANT = "important"
    URGENT = "urgent"


class Announcement(Base):
    __tablename__ = "announcements"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(255))
    content: Mapped[str] = mapped_column(Text)
    institution_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("institutions.id", ondelete="CASCADE"), index=True
    )
    target_role: Mapped[AnnouncementTarget] = mapped_column(
        Enum(AnnouncementTarget), default=AnnouncementTarget.ALL
    )
    priority: Mapped[AnnouncementPriority] = mapped_column(
        Enum(AnnouncementPriority), default=AnnouncementPriority.NORMAL
    )
    is_pinned: Mapped[bool] = mapped_column(Boolean, default=False)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_by: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    author: Mapped[User] = relationship(foreign_keys=[created_by])
