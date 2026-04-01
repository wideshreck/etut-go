import uuid

from pydantic import BaseModel, EmailStr


class AdminRoleCreate(BaseModel):
    name: str
    permissions: list[str]


class AdminRoleUpdate(BaseModel):
    name: str | None = None
    permissions: list[str] | None = None


class AdminRoleResponse(BaseModel):
    id: uuid.UUID
    name: str
    permissions: list[str]
    user_count: int = 0


class AdminUserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    phone: str | None = None
    role_ids: list[uuid.UUID] = []


class UserRoleAssign(BaseModel):
    role_id: uuid.UUID
