from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.user import User

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Guardian(Base):
    __tablename__ = "guardians"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    student_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    full_name: Mapped[str] = mapped_column(String(255))
    relation: Mapped[str] = mapped_column(String(50))  # Anne, Baba, Abi, etc
    phone: Mapped[str] = mapped_column(String(20))
    email: Mapped[str | None] = mapped_column(String(255))
    occupation: Mapped[str | None] = mapped_column(String(255))
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), unique=True
    )

    student: Mapped[User] = relationship(
        back_populates="guardians", foreign_keys=[student_id]
    )
    user: Mapped[User | None] = relationship(foreign_keys=[user_id])
