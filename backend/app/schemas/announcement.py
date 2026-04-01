import uuid
from datetime import datetime

from pydantic import BaseModel


class AnnouncementCreate(BaseModel):
    title: str
    content: str
    target_role: str = "all"
    priority: str = "normal"
    is_pinned: bool = False
    expires_at: datetime | None = None


class AnnouncementUpdate(BaseModel):
    title: str | None = None
    content: str | None = None
    target_role: str | None = None
    priority: str | None = None
    is_pinned: bool | None = None
    expires_at: datetime | None = None


class AnnouncementResponse(BaseModel):
    id: uuid.UUID
    title: str
    content: str
    target_role: str
    priority: str
    is_pinned: bool
    expires_at: datetime | None
    created_by: uuid.UUID
    author_name: str
    created_at: datetime
    updated_at: datetime
