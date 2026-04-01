import uuid
from datetime import datetime

from pydantic import BaseModel


class InstitutionCreate(BaseModel):
    name: str
    address: str | None = None
    phone: str | None = None
    tax_office: str | None = None
    tax_number: str | None = None


class InstitutionUpdate(BaseModel):
    name: str | None = None
    address: str | None = None
    phone: str | None = None
    tax_office: str | None = None
    tax_number: str | None = None
    is_active: bool | None = None


class InstitutionResponse(BaseModel):
    id: uuid.UUID
    name: str
    address: str | None
    phone: str | None
    tax_office: str | None
    tax_number: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class InstitutionDashboard(BaseModel):
    id: uuid.UUID
    name: str
    is_active: bool
    student_count: int
    teacher_count: int
