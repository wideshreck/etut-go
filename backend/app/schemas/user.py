import uuid
from datetime import date, datetime, time

from pydantic import BaseModel, EmailStr


class AvailabilitySlot(BaseModel):
    day_of_week: int
    start_time: time
    end_time: time


class GuardianCreate(BaseModel):
    full_name: str
    relation: str
    phone: str
    email: str | None = None
    occupation: str | None = None


class GuardianInfo(BaseModel):
    id: uuid.UUID
    full_name: str
    relation: str
    phone: str
    email: str | None
    occupation: str | None

    model_config = {"from_attributes": True}


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    phone: str | None = None
    # Teacher-specific
    subject_id: uuid.UUID | None = None
    employment_type: str | None = None
    start_date: date | None = None
    university: str | None = None
    department: str | None = None
    salary_type: str | None = None
    salary_amount: float | None = None
    iban: str | None = None
    tc_no: str | None = None
    address: str | None = None
    emergency_contact: str | None = None
    emergency_phone: str | None = None
    availability: list[AvailabilitySlot] | None = None
    # Student-specific
    birth_date: date | None = None
    gender: str | None = None
    enrollment_date: date | None = None
    enrollment_period: str | None = None
    school: str | None = None
    grade_level: str | None = None
    target_exam: str | None = None
    enrollment_status: str | None = None
    group_id: uuid.UUID | None = None
    weekly_credits: int | None = None
    credit_duration: int | None = None
    guardians: list[GuardianCreate] | None = None
    notes: str | None = None


class UserUpdate(BaseModel):
    full_name: str | None = None
    phone: str | None = None
    is_active: bool | None = None
    # Teacher-specific
    subject_id: uuid.UUID | None = None
    employment_type: str | None = None
    start_date: date | None = None
    university: str | None = None
    department: str | None = None
    salary_type: str | None = None
    salary_amount: float | None = None
    iban: str | None = None
    tc_no: str | None = None
    address: str | None = None
    emergency_contact: str | None = None
    emergency_phone: str | None = None
    availability: list[AvailabilitySlot] | None = None
    # Student-specific
    birth_date: date | None = None
    gender: str | None = None
    enrollment_date: date | None = None
    enrollment_period: str | None = None
    school: str | None = None
    grade_level: str | None = None
    target_exam: str | None = None
    enrollment_status: str | None = None
    group_id: uuid.UUID | None = None
    weekly_credits: int | None = None
    credit_duration: int | None = None
    guardians: list[GuardianCreate] | None = None
    notes: str | None = None


class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    phone: str | None
    role: str
    institution_id: uuid.UUID | None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AvailabilityInfo(BaseModel):
    id: uuid.UUID
    day_of_week: int
    start_time: time
    end_time: time

    model_config = {"from_attributes": True}


class TeacherResponse(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    phone: str | None
    role: str
    institution_id: uuid.UUID | None
    is_active: bool
    # Teacher fields
    employment_type: str | None = None
    start_date: date | None = None
    university: str | None = None
    department: str | None = None
    salary_type: str | None = None
    salary_amount: float | None = None
    iban: str | None = None
    tc_no: str | None = None
    address: str | None = None
    emergency_contact: str | None = None
    emergency_phone: str | None = None
    subject_id: uuid.UUID | None = None
    subject_name: str | None = None
    availability: list[AvailabilityInfo] = []
    notes: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class StudentResponse(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    phone: str | None
    role: str
    institution_id: uuid.UUID | None
    is_active: bool
    # Student fields
    tc_no: str | None = None
    address: str | None = None
    birth_date: date | None = None
    gender: str | None = None
    enrollment_date: date | None = None
    enrollment_period: str | None = None
    school: str | None = None
    grade_level: str | None = None
    target_exam: str | None = None
    enrollment_status: str | None = None
    group_id: uuid.UUID | None = None
    group_name: str | None = None
    weekly_credits: int | None = None
    credit_duration: int | None = None
    guardians: list[GuardianInfo] = []
    notes: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
