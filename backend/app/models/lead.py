from __future__ import annotations

import enum
import uuid
from datetime import datetime
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.user import User

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class LeadStatus(enum.StrEnum):
    NEW = "new"
    CONTACTED = "contacted"
    CONSULTATION_SCHEDULED = "consultation_scheduled"
    CONSULTATION_DONE = "consultation_done"
    ENROLLED = "enrolled"
    LOST = "lost"


class LeadSource(enum.StrEnum):
    WALK_IN = "walk_in"
    PHONE = "phone"
    WEBSITE = "website"
    REFERRAL = "referral"
    SOCIAL_MEDIA = "social_media"
    CAMPAIGN = "campaign"
    OTHER = "other"


class Lead(Base):
    __tablename__ = "leads"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    institution_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("institutions.id", ondelete="CASCADE"), index=True
    )

    # Contact info
    student_name: Mapped[str] = mapped_column(String(255))
    parent_name: Mapped[str | None] = mapped_column(String(255))
    phone: Mapped[str] = mapped_column(String(20))
    email: Mapped[str | None] = mapped_column(String(255))

    # Academic interest
    grade_level: Mapped[str | None] = mapped_column(String(50))
    target_exam: Mapped[str | None] = mapped_column(String(50))
    current_school: Mapped[str | None] = mapped_column(String(255))

    # CRM fields
    status: Mapped[LeadStatus] = mapped_column(Enum(LeadStatus), default=LeadStatus.NEW)
    source: Mapped[LeadSource] = mapped_column(
        Enum(LeadSource), default=LeadSource.WALK_IN
    )
    assigned_to: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    consultation_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    consultation_score: Mapped[int | None] = mapped_column(Integer)  # 1-10
    lost_reason: Mapped[str | None] = mapped_column(String(255))
    notes: Mapped[str | None] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    assigned_user: Mapped[User | None] = relationship(foreign_keys=[assigned_to])
    notes_list: Mapped[list[LeadNote]] = relationship(
        back_populates="lead", order_by="LeadNote.created_at.desc()"
    )


class LeadNote(Base):
    __tablename__ = "lead_notes"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    lead_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("leads.id", ondelete="CASCADE"), index=True
    )
    content: Mapped[str] = mapped_column(Text)
    created_by: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    lead: Mapped[Lead] = relationship(back_populates="notes_list")
    author: Mapped[User] = relationship(foreign_keys=[created_by])
