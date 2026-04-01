import secrets
import uuid
from datetime import UTC, date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile
from fastapi.responses import Response, StreamingResponse
from sqlalchemy import case, delete, extract, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.audit import log_action
from app.core.deps import require_role
from app.core.notify import send_bulk_notification, send_notification
from app.core.security import hash_password
from app.db.session import get_db
from app.models.announcement import (
    Announcement,
    AnnouncementPriority,
    AnnouncementTarget,
)
from app.models.attendance import Attendance, AttendanceStatus
from app.models.audit_log import AuditLog
from app.models.cash_entry import CashEntry, CashEntryType
from app.models.expense import Expense, ExpenseCategory
from app.models.group import Group, GroupStatus, group_students
from app.models.guardian import Guardian
from app.models.lead import Lead, LeadNote, LeadSource, LeadStatus
from app.models.payment import Payment, PaymentStatus
from app.models.permission import (
    PERMISSIONS,
    AdminRole,
    role_permissions,
    user_admin_roles,
)
from app.models.private_lesson import PrivateLesson
from app.models.schedule import GroupSchedule
from app.models.subject import Subject
from app.models.teacher_availability import TeacherAvailability
from app.models.teacher_payment import TeacherPayment, TeacherPaymentStatus
from app.models.user import User, UserRole
from app.schemas.announcement import (
    AnnouncementCreate,
    AnnouncementResponse,
    AnnouncementUpdate,
)
from app.schemas.attendance import AttendanceBulkCreate
from app.schemas.cash_entry import CashEntryCreate
from app.schemas.expense import ExpenseCreate, ExpenseUpdate
from app.schemas.group import GroupCreate, GroupResponse, GroupUpdate, StudentIds
from app.schemas.lead import (
    LeadCreate,
    LeadNoteCreate,
    LeadNoteResponse,
    LeadResponse,
    LeadSummary,
    LeadUpdate,
)
from app.schemas.payment import (
    BulkPaymentCreate,
    PaymentResponse,
    PaymentSummary,
    PaymentUpdate,
)
from app.schemas.permission import AdminRoleCreate, AdminRoleUpdate, AdminUserCreate
from app.schemas.private_lesson import PrivateLessonResponse
from app.schemas.schedule import ScheduleCreate, ScheduleResponse, ScheduleUpdate
from app.schemas.subject import (
    SubjectCreate,
    SubjectResponse,
    SubjectUpdate,
    SubjectWithCount,
)
from app.schemas.teacher_payment import TeacherPaymentCreate, TeacherPaymentUpdate
from app.schemas.user import (
    StudentResponse,
    TeacherResponse,
    UserCreate,
    UserUpdate,
)

router = APIRouter(prefix="/admin", tags=["admin"])


# ── Dashboard ────────────────────────────────────────────────────────


@router.get("/dashboard")
async def dashboard(
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> dict[str, object]:
    inst_id = current_user.institution_id

    # Counts
    student_count = (
        await db.execute(
            select(func.count(User.id)).where(
                User.institution_id == inst_id, User.role == UserRole.STUDENT
            )
        )
    ).scalar() or 0

    teacher_count = (
        await db.execute(
            select(func.count(User.id)).where(
                User.institution_id == inst_id, User.role == UserRole.TEACHER
            )
        )
    ).scalar() or 0

    group_count = (
        await db.execute(
            select(func.count(Group.id)).where(Group.institution_id == inst_id)
        )
    ).scalar() or 0

    subject_count = (
        await db.execute(
            select(func.count(Subject.id)).where(Subject.institution_id == inst_id)
        )
    ).scalar() or 0

    # Financial summary
    financial = await db.execute(
        select(
            func.coalesce(func.sum(Payment.amount), 0).label("total_expected"),
            func.coalesce(
                func.sum(
                    case(
                        (Payment.status == PaymentStatus.PAID, Payment.amount),
                        else_=0,
                    )
                ),
                0,
            ).label("total_paid"),
            func.coalesce(
                func.sum(
                    case(
                        (Payment.status == PaymentStatus.OVERDUE, Payment.amount),
                        else_=0,
                    )
                ),
                0,
            ).label("total_overdue"),
        ).where(Payment.institution_id == inst_id)
    )
    fin_row = financial.one()

    # Recent payments (last 5)
    recent_payments_result = await db.execute(
        select(Payment)
        .options(selectinload(Payment.student))
        .where(
            Payment.institution_id == inst_id,
            Payment.status == PaymentStatus.PAID,
        )
        .order_by(Payment.paid_date.desc())
        .limit(5)
    )
    recent_payments = [
        {
            "id": p.id,
            "student_name": p.student.full_name,
            "amount": float(p.amount),
            "paid_date": str(p.paid_date) if p.paid_date else None,
        }
        for p in recent_payments_result.scalars().all()
    ]

    # Upcoming due payments (next 5 pending)
    upcoming_result = await db.execute(
        select(Payment)
        .options(selectinload(Payment.student))
        .where(
            Payment.institution_id == inst_id,
            Payment.status == PaymentStatus.PENDING,
        )
        .order_by(Payment.due_date)
        .limit(5)
    )
    upcoming_payments = [
        {
            "id": p.id,
            "student_name": p.student.full_name,
            "amount": float(p.amount),
            "due_date": str(p.due_date),
        }
        for p in upcoming_result.scalars().all()
    ]

    return {
        "student_count": student_count,
        "teacher_count": teacher_count,
        "group_count": group_count,
        "subject_count": subject_count,
        "total_revenue": float(fin_row.total_expected),
        "total_collected": float(fin_row.total_paid),
        "total_overdue": float(fin_row.total_overdue),
        "recent_payments": recent_payments,
        "upcoming_payments": upcoming_payments,
    }


# ── Teachers ─────────────────────────────────────────────────────────


@router.get("/teachers", response_model=list[TeacherResponse])
async def list_teachers(
    search: str | None = None,
    subject_id: uuid.UUID | None = None,
    employment_type: str | None = None,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, object]]:
    query = (
        select(User)
        .options(selectinload(User.subject), selectinload(User.availability))
        .where(
            User.institution_id == current_user.institution_id,
            User.role == UserRole.TEACHER,
        )
        .order_by(User.created_at.desc())
    )
    if search:
        search_term = f"%{search}%"
        query = query.where(
            or_(
                User.full_name.ilike(search_term),
                User.email.ilike(search_term),
                User.phone.ilike(search_term),
            )
        )
    if subject_id:
        query = query.where(User.subject_id == subject_id)
    if employment_type:
        query = query.where(User.employment_type == employment_type)

    result = await db.execute(query)
    teachers = result.scalars().all()
    return [
        {
            **{
                c.key: getattr(t, c.key)
                for c in User.__table__.columns
                if c.key != "password_hash"
            },
            "subject_name": t.subject.name if t.subject else None,
            "availability": [
                {
                    "id": a.id,
                    "day_of_week": a.day_of_week,
                    "start_time": a.start_time,
                    "end_time": a.end_time,
                }
                for a in t.availability
            ],
        }
        for t in teachers
    ]


@router.post("/teachers", response_model=TeacherResponse, status_code=201)
async def create_teacher(
    data: UserCreate,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> dict[str, object]:
    existing = await db.execute(select(User).where(User.email == data.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        email=data.email,
        password_hash=hash_password(data.password),
        full_name=data.full_name,
        phone=data.phone,
        role=UserRole.TEACHER,
        institution_id=current_user.institution_id,
        subject_id=data.subject_id,
        employment_type=data.employment_type,
        start_date=data.start_date,
        university=data.university,
        department=data.department,
        salary_type=data.salary_type,
        salary_amount=data.salary_amount,
        iban=data.iban,
        tc_no=data.tc_no,
        address=data.address,
        emergency_contact=data.emergency_contact,
        emergency_phone=data.emergency_phone,
        notes=data.notes,
    )
    db.add(user)
    await db.flush()

    # Add availability
    if data.availability:
        for slot in data.availability:
            avail = TeacherAvailability(
                teacher_id=user.id,
                day_of_week=slot.day_of_week,
                start_time=slot.start_time,
                end_time=slot.end_time,
            )
            db.add(avail)

    await db.commit()

    await log_action(
        db,
        institution_id=str(current_user.institution_id),
        user_id=str(current_user.id),
        action="create",
        entity_type="teacher",
        entity_id=str(user.id),
        description=f"{data.full_name} öğretmen oluşturuldu",
    )
    await db.commit()

    # Re-fetch with relationships loaded
    result = await db.execute(
        select(User)
        .options(selectinload(User.subject), selectinload(User.availability))
        .where(User.id == user.id)
    )
    t = result.scalar_one()
    return {
        **{
            c.key: getattr(t, c.key)
            for c in User.__table__.columns
            if c.key != "password_hash"
        },
        "subject_name": t.subject.name if t.subject else None,
        "availability": [
            {
                "id": a.id,
                "day_of_week": a.day_of_week,
                "start_time": a.start_time,
                "end_time": a.end_time,
            }
            for a in t.availability
        ],
    }


@router.put("/teachers/{teacher_id}", response_model=TeacherResponse)
async def update_teacher(
    teacher_id: uuid.UUID,
    data: UserUpdate,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> dict[str, object]:
    result = await db.execute(
        select(User).where(
            User.id == teacher_id,
            User.institution_id == current_user.institution_id,
            User.role == UserRole.TEACHER,
        )
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Teacher not found")

    update_data = data.model_dump(exclude_unset=True)

    # Handle availability separately
    availability_data = update_data.pop("availability", None)
    if availability_data is not None:
        await db.execute(
            delete(TeacherAvailability).where(
                TeacherAvailability.teacher_id == teacher_id
            )
        )
        for slot in availability_data:
            avail = TeacherAvailability(
                teacher_id=teacher_id,
                day_of_week=slot["day_of_week"],
                start_time=slot["start_time"],
                end_time=slot["end_time"],
            )
            db.add(avail)

    # Update scalar fields (including subject_id)
    for key, value in update_data.items():
        setattr(user, key, value)

    await log_action(
        db,
        institution_id=str(current_user.institution_id),
        user_id=str(current_user.id),
        action="update",
        entity_type="teacher",
        entity_id=str(teacher_id),
        description=f"Öğretmen güncellendi: {user.full_name}",
    )
    await db.commit()

    # Re-fetch with relationships loaded
    result = await db.execute(
        select(User)
        .options(selectinload(User.subject), selectinload(User.availability))
        .where(User.id == teacher_id)
    )
    t = result.scalar_one()
    return {
        **{
            c.key: getattr(t, c.key)
            for c in User.__table__.columns
            if c.key != "password_hash"
        },
        "subject_name": t.subject.name if t.subject else None,
        "availability": [
            {
                "id": a.id,
                "day_of_week": a.day_of_week,
                "start_time": a.start_time,
                "end_time": a.end_time,
            }
            for a in t.availability
        ],
    }


@router.delete("/teachers/{teacher_id}", status_code=204)
async def delete_teacher(
    teacher_id: uuid.UUID,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> None:
    result = await db.execute(
        select(User).where(
            User.id == teacher_id,
            User.institution_id == current_user.institution_id,
            User.role == UserRole.TEACHER,
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Teacher not found")

    await db.execute(delete(User).where(User.id == teacher_id))
    await db.commit()

    await log_action(
        db,
        institution_id=str(current_user.institution_id),
        user_id=str(current_user.id),
        action="delete",
        entity_type="teacher",
        entity_id=str(teacher_id),
        description="Öğretmen silindi",
    )
    await db.commit()


# ── Students ─────────────────────────────────────────────────────────


@router.get("/students", response_model=list[StudentResponse])
async def list_students(
    search: str | None = None,
    group_id: uuid.UUID | None = None,
    grade_level: str | None = None,
    target_exam: str | None = None,
    enrollment_status: str | None = None,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, object]]:
    query = (
        select(User)
        .options(selectinload(User.group), selectinload(User.guardians))
        .where(
            User.institution_id == current_user.institution_id,
            User.role == UserRole.STUDENT,
        )
        .order_by(User.created_at.desc())
    )

    if search:
        search_term = f"%{search}%"
        query = query.where(
            or_(
                User.full_name.ilike(search_term),
                User.email.ilike(search_term),
                User.phone.ilike(search_term),
                User.tc_no.ilike(search_term),
            )
        )
    if group_id:
        query = query.where(User.group_id == group_id)
    if grade_level:
        query = query.where(User.grade_level == grade_level)
    if target_exam:
        query = query.where(User.target_exam == target_exam)
    if enrollment_status:
        query = query.where(User.enrollment_status == enrollment_status)

    result = await db.execute(query)
    students = result.scalars().all()
    return [
        {
            **{
                c.key: getattr(s, c.key)
                for c in User.__table__.columns
                if c.key != "password_hash"
            },
            "group_name": s.group.name if s.group else None,
            "guardians": [
                {
                    "id": g.id,
                    "full_name": g.full_name,
                    "relation": g.relation,
                    "phone": g.phone,
                    "email": g.email,
                    "occupation": g.occupation,
                }
                for g in s.guardians
            ],
        }
        for s in students
    ]


@router.post("/students", response_model=StudentResponse, status_code=201)
async def create_student(
    data: UserCreate,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> dict[str, object]:
    existing = await db.execute(select(User).where(User.email == data.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        email=data.email,
        password_hash=hash_password(data.password),
        full_name=data.full_name,
        phone=data.phone,
        role=UserRole.STUDENT,
        institution_id=current_user.institution_id,
        tc_no=data.tc_no,
        address=data.address,
        birth_date=data.birth_date,
        gender=data.gender,
        enrollment_date=data.enrollment_date,
        enrollment_period=data.enrollment_period,
        school=data.school,
        grade_level=data.grade_level,
        target_exam=data.target_exam,
        enrollment_status=data.enrollment_status,
        group_id=data.group_id,
        weekly_credits=data.weekly_credits,
        credit_duration=data.credit_duration,
        notes=data.notes,
    )
    db.add(user)
    await db.flush()

    # Add guardians
    if data.guardians:
        for gd in data.guardians:
            guardian = Guardian(
                student_id=user.id,
                full_name=gd.full_name,
                relation=gd.relation,
                phone=gd.phone,
                email=gd.email,
                occupation=gd.occupation,
            )
            db.add(guardian)

    await db.commit()

    await log_action(
        db,
        institution_id=str(current_user.institution_id),
        user_id=str(current_user.id),
        action="create",
        entity_type="student",
        entity_id=str(user.id),
        description=f"{data.full_name} öğrenci oluşturuldu",
    )
    await db.commit()

    # Re-fetch with relationships loaded
    result = await db.execute(
        select(User)
        .options(selectinload(User.group), selectinload(User.guardians))
        .where(User.id == user.id)
    )
    s = result.scalar_one()
    return {
        **{
            c.key: getattr(s, c.key)
            for c in User.__table__.columns
            if c.key != "password_hash"
        },
        "group_name": s.group.name if s.group else None,
        "guardians": [
            {
                "id": g.id,
                "full_name": g.full_name,
                "relation": g.relation,
                "phone": g.phone,
                "email": g.email,
                "occupation": g.occupation,
            }
            for g in s.guardians
        ],
    }


@router.put("/students/{student_id}", response_model=StudentResponse)
async def update_student(
    student_id: uuid.UUID,
    data: UserUpdate,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> dict[str, object]:
    result = await db.execute(
        select(User).where(
            User.id == student_id,
            User.institution_id == current_user.institution_id,
            User.role == UserRole.STUDENT,
        )
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Student not found")

    update_data = data.model_dump(exclude_unset=True)

    # Handle guardians separately (delete + re-create)
    guardians_data = update_data.pop("guardians", None)
    if guardians_data is not None:
        await db.execute(delete(Guardian).where(Guardian.student_id == student_id))
        for gd in guardians_data:
            guardian = Guardian(
                student_id=student_id,
                full_name=gd["full_name"],
                relation=gd["relation"],
                phone=gd["phone"],
                email=gd.get("email"),
                occupation=gd.get("occupation"),
            )
            db.add(guardian)

    # Remove non-model fields
    update_data.pop("availability", None)

    # Update scalar fields
    for key, value in update_data.items():
        setattr(user, key, value)

    await log_action(
        db,
        institution_id=str(current_user.institution_id),
        user_id=str(current_user.id),
        action="update",
        entity_type="student",
        entity_id=str(student_id),
        description=f"Öğrenci güncellendi: {user.full_name}",
    )
    await db.commit()

    # Re-fetch with relationships loaded
    result = await db.execute(
        select(User)
        .options(selectinload(User.group), selectinload(User.guardians))
        .where(User.id == student_id)
    )
    s = result.scalar_one()
    return {
        **{
            c.key: getattr(s, c.key)
            for c in User.__table__.columns
            if c.key != "password_hash"
        },
        "group_name": s.group.name if s.group else None,
        "guardians": [
            {
                "id": g.id,
                "full_name": g.full_name,
                "relation": g.relation,
                "phone": g.phone,
                "email": g.email,
                "occupation": g.occupation,
            }
            for g in s.guardians
        ],
    }


@router.delete("/students/{student_id}", status_code=204)
async def delete_student(
    student_id: uuid.UUID,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> None:
    result = await db.execute(
        select(User).where(
            User.id == student_id,
            User.institution_id == current_user.institution_id,
            User.role == UserRole.STUDENT,
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Student not found")

    await db.execute(delete(User).where(User.id == student_id))
    await db.commit()

    await log_action(
        db,
        institution_id=str(current_user.institution_id),
        user_id=str(current_user.id),
        action="delete",
        entity_type="student",
        entity_id=str(student_id),
        description="Öğrenci silindi",
    )
    await db.commit()


@router.get("/students/{student_id}/payments", response_model=list[PaymentResponse])
async def get_student_payments(
    student_id: uuid.UUID,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, object]]:
    result = await db.execute(
        select(Payment)
        .options(selectinload(Payment.student))
        .where(
            Payment.student_id == student_id,
            Payment.institution_id == current_user.institution_id,
        )
        .order_by(Payment.installment_no)
    )
    payments = result.scalars().all()
    return [
        {
            "id": p.id,
            "student_id": p.student_id,
            "student_name": p.student.full_name,
            "institution_id": p.institution_id,
            "installment_no": p.installment_no,
            "amount": p.amount,
            "due_date": p.due_date,
            "paid_date": p.paid_date,
            "status": p.status.value,
            "payment_method": p.payment_method,
            "notes": p.notes,
            "created_at": p.created_at,
        }
        for p in payments
    ]


# ── Subjects ─────────────────────────────────────────────────────────


@router.get("/subjects", response_model=list[SubjectWithCount])
async def list_subjects(
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, object]]:
    result = await db.execute(
        select(
            Subject,
            func.count(User.id).label("teacher_count"),
        )
        .outerjoin(
            User, (User.subject_id == Subject.id) & (User.role == UserRole.TEACHER)
        )
        .where(Subject.institution_id == current_user.institution_id)
        .group_by(Subject.id)
    )
    rows = result.all()
    return [
        {
            "id": row.Subject.id,
            "name": row.Subject.name,
            "institution_id": row.Subject.institution_id,
            "color_code": row.Subject.color_code,
            "notes": row.Subject.notes,
            "teacher_count": row.teacher_count,
        }
        for row in rows
    ]


@router.post("/subjects", response_model=SubjectResponse, status_code=201)
async def create_subject(
    data: SubjectCreate,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> Subject:
    subject = Subject(
        name=data.name,
        color_code=data.color_code,
        notes=data.notes,
        institution_id=current_user.institution_id,
    )
    db.add(subject)
    await db.commit()
    await db.refresh(subject)
    return subject


@router.put("/subjects/{subject_id}", response_model=SubjectResponse)
async def update_subject(
    subject_id: uuid.UUID,
    data: SubjectUpdate,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> Subject:
    result = await db.execute(
        select(Subject).where(
            Subject.id == subject_id,
            Subject.institution_id == current_user.institution_id,
        )
    )
    subject = result.scalar_one_or_none()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(subject, key, value)

    await db.commit()
    await db.refresh(subject)
    return subject


@router.delete("/subjects/{subject_id}", status_code=204)
async def delete_subject(
    subject_id: uuid.UUID,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> None:
    result = await db.execute(
        select(Subject).where(
            Subject.id == subject_id,
            Subject.institution_id == current_user.institution_id,
        )
    )
    subject = result.scalar_one_or_none()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    await db.delete(subject)
    await db.commit()


# ── Groups ───────────────────────────────────────────────────────────


@router.get("/groups", response_model=list[GroupResponse])
async def list_groups(
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, object]]:
    result = await db.execute(
        select(Group)
        .options(selectinload(Group.advisor), selectinload(Group.students))
        .where(Group.institution_id == current_user.institution_id)
        .order_by(Group.academic_year.desc(), Group.name)
    )
    groups = result.scalars().all()
    return [
        {
            **{c.key: getattr(g, c.key) for c in Group.__table__.columns},
            "advisor_name": g.advisor.full_name if g.advisor else None,
            "student_count": len(g.students),
        }
        for g in groups
    ]


@router.post("/groups", response_model=GroupResponse, status_code=201)
async def create_group(
    data: GroupCreate,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> dict[str, object]:
    group = Group(
        name=data.name,
        grade_level=data.grade_level,
        field=data.field,
        academic_year=data.academic_year,
        max_capacity=data.max_capacity,
        classroom=data.classroom,
        advisor_id=data.advisor_id,
        institution_id=current_user.institution_id,
    )
    db.add(group)
    await db.commit()

    await log_action(
        db,
        institution_id=str(current_user.institution_id),
        user_id=str(current_user.id),
        action="create",
        entity_type="group",
        entity_id=str(group.id),
        description=f"{data.name} sınıfı oluşturuldu",
    )
    await db.commit()

    # Re-fetch with relationships loaded
    result = await db.execute(
        select(Group)
        .options(selectinload(Group.advisor), selectinload(Group.students))
        .where(Group.id == group.id)
    )
    g = result.scalar_one()
    return {
        **{c.key: getattr(g, c.key) for c in Group.__table__.columns},
        "advisor_name": g.advisor.full_name if g.advisor else None,
        "student_count": len(g.students),
    }


@router.put("/groups/{group_id}", response_model=GroupResponse)
async def update_group(
    group_id: uuid.UUID,
    data: GroupUpdate,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> dict[str, object]:
    result = await db.execute(
        select(Group).where(
            Group.id == group_id,
            Group.institution_id == current_user.institution_id,
        )
    )
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(group, key, value)

    await log_action(
        db,
        institution_id=str(current_user.institution_id),
        user_id=str(current_user.id),
        action="update",
        entity_type="group",
        entity_id=str(group_id),
        description=f"Sınıf güncellendi: {group.name}",
    )
    await db.commit()

    # Re-fetch with relationships loaded
    result = await db.execute(
        select(Group)
        .options(selectinload(Group.advisor), selectinload(Group.students))
        .where(Group.id == group_id)
    )
    g = result.scalar_one()
    return {
        **{c.key: getattr(g, c.key) for c in Group.__table__.columns},
        "advisor_name": g.advisor.full_name if g.advisor else None,
        "student_count": len(g.students),
    }


@router.delete("/groups/{group_id}", status_code=204)
async def delete_group(
    group_id: uuid.UUID,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> None:
    result = await db.execute(
        select(Group).where(
            Group.id == group_id,
            Group.institution_id == current_user.institution_id,
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Group not found")

    await db.execute(delete(Group).where(Group.id == group_id))
    await db.commit()


@router.post("/groups/{group_id}/students", status_code=200)
async def assign_students_to_group(
    group_id: uuid.UUID,
    data: StudentIds,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    result = await db.execute(
        select(Group).where(
            Group.id == group_id,
            Group.institution_id == current_user.institution_id,
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Group not found")

    # Clear existing students
    await db.execute(
        delete(group_students).where(group_students.c.group_id == group_id)
    )

    # Add new students
    for sid in data.student_ids:
        await db.execute(
            group_students.insert().values(group_id=group_id, student_id=sid)
        )

    await db.commit()
    return {"status": "ok"}


# ── Schedules ────────────────────────────────────────────────────────


@router.get("/schedules", response_model=list[ScheduleResponse])
async def list_schedules(
    group_id: uuid.UUID | None = None,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, object]]:
    query = (
        select(GroupSchedule)
        .options(
            selectinload(GroupSchedule.group),
            selectinload(GroupSchedule.subject),
            selectinload(GroupSchedule.teacher),
        )
        .join(Group, GroupSchedule.group_id == Group.id)
        .where(Group.institution_id == current_user.institution_id)
        .order_by(GroupSchedule.day_of_week, GroupSchedule.start_time)
    )
    if group_id:
        query = query.where(GroupSchedule.group_id == group_id)

    result = await db.execute(query)
    schedules = result.scalars().all()
    return [
        {
            "id": s.id,
            "group_id": s.group_id,
            "group_name": s.group.name,
            "subject_id": s.subject_id,
            "subject_name": s.subject.name,
            "subject_color": s.subject.color_code,
            "teacher_id": s.teacher_id,
            "teacher_name": s.teacher.full_name,
            "classroom": s.classroom,
            "day_of_week": s.day_of_week,
            "start_time": s.start_time,
            "end_time": s.end_time,
        }
        for s in schedules
    ]


@router.post("/schedules", response_model=ScheduleResponse, status_code=201)
async def create_schedule(
    data: ScheduleCreate,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> dict[str, object]:
    # Verify group belongs to institution
    group_result = await db.execute(
        select(Group).where(
            Group.id == data.group_id,
            Group.institution_id == current_user.institution_id,
        )
    )
    if not group_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Group not found")

    # Check teacher conflict (same teacher, same day, overlapping time)
    teacher_conflict = await db.execute(
        select(GroupSchedule).where(
            GroupSchedule.teacher_id == data.teacher_id,
            GroupSchedule.day_of_week == data.day_of_week,
            GroupSchedule.start_time < data.end_time,
            GroupSchedule.end_time > data.start_time,
        )
    )
    if teacher_conflict.scalar_one_or_none():
        raise HTTPException(
            status_code=409,
            detail="Bu öğretmenin bu saatte başka bir dersi var",
        )

    # Check classroom conflict (same classroom, same day, overlapping time)
    if data.classroom:
        classroom_conflict = await db.execute(
            select(GroupSchedule)
            .join(Group)
            .where(
                GroupSchedule.classroom == data.classroom,
                GroupSchedule.day_of_week == data.day_of_week,
                GroupSchedule.start_time < data.end_time,
                GroupSchedule.end_time > data.start_time,
                Group.institution_id == current_user.institution_id,
            )
        )
        if classroom_conflict.scalar_one_or_none():
            raise HTTPException(
                status_code=409,
                detail="Bu derslik bu saatte başka bir ders için kullanılıyor",
            )

    schedule = GroupSchedule(
        group_id=data.group_id,
        subject_id=data.subject_id,
        teacher_id=data.teacher_id,
        classroom=data.classroom,
        day_of_week=data.day_of_week,
        start_time=data.start_time,
        end_time=data.end_time,
    )
    db.add(schedule)
    await db.commit()

    # Re-fetch with relationships
    result = await db.execute(
        select(GroupSchedule)
        .options(
            selectinload(GroupSchedule.group),
            selectinload(GroupSchedule.subject),
            selectinload(GroupSchedule.teacher),
        )
        .where(GroupSchedule.id == schedule.id)
    )
    s = result.scalar_one()
    return {
        "id": s.id,
        "group_id": s.group_id,
        "group_name": s.group.name,
        "subject_id": s.subject_id,
        "subject_name": s.subject.name,
        "subject_color": s.subject.color_code,
        "teacher_id": s.teacher_id,
        "teacher_name": s.teacher.full_name,
        "classroom": s.classroom,
        "day_of_week": s.day_of_week,
        "start_time": s.start_time,
        "end_time": s.end_time,
    }


@router.put("/schedules/{schedule_id}", response_model=ScheduleResponse)
async def update_schedule(
    schedule_id: uuid.UUID,
    data: ScheduleUpdate,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> dict[str, object]:
    # Fetch existing schedule (verify institution ownership)
    result = await db.execute(
        select(GroupSchedule)
        .join(Group, GroupSchedule.group_id == Group.id)
        .where(
            GroupSchedule.id == schedule_id,
            Group.institution_id == current_user.institution_id,
        )
    )
    schedule = result.scalar_one_or_none()
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")

    update_data = data.model_dump(exclude_unset=True)

    # Determine effective values for conflict checks
    teacher_id = update_data.get("teacher_id", schedule.teacher_id)
    day_of_week = update_data.get("day_of_week", schedule.day_of_week)
    start_time = update_data.get("start_time", schedule.start_time)
    end_time = update_data.get("end_time", schedule.end_time)
    classroom = update_data.get("classroom", schedule.classroom)

    # Check teacher conflict (exclude self)
    teacher_conflict = await db.execute(
        select(GroupSchedule).where(
            GroupSchedule.id != schedule_id,
            GroupSchedule.teacher_id == teacher_id,
            GroupSchedule.day_of_week == day_of_week,
            GroupSchedule.start_time < end_time,
            GroupSchedule.end_time > start_time,
        )
    )
    if teacher_conflict.scalar_one_or_none():
        raise HTTPException(
            status_code=409,
            detail="Bu öğretmenin bu saatte başka bir dersi var",
        )

    # Check classroom conflict (exclude self)
    if classroom:
        classroom_conflict = await db.execute(
            select(GroupSchedule)
            .join(Group)
            .where(
                GroupSchedule.id != schedule_id,
                GroupSchedule.classroom == classroom,
                GroupSchedule.day_of_week == day_of_week,
                GroupSchedule.start_time < end_time,
                GroupSchedule.end_time > start_time,
                Group.institution_id == current_user.institution_id,
            )
        )
        if classroom_conflict.scalar_one_or_none():
            raise HTTPException(
                status_code=409,
                detail="Bu derslik bu saatte başka bir ders için kullanılıyor",
            )

    for key, value in update_data.items():
        setattr(schedule, key, value)

    await db.commit()

    # Re-fetch with relationships
    result = await db.execute(
        select(GroupSchedule)
        .options(
            selectinload(GroupSchedule.group),
            selectinload(GroupSchedule.subject),
            selectinload(GroupSchedule.teacher),
        )
        .where(GroupSchedule.id == schedule_id)
    )
    s = result.scalar_one()
    return {
        "id": s.id,
        "group_id": s.group_id,
        "group_name": s.group.name,
        "subject_id": s.subject_id,
        "subject_name": s.subject.name,
        "subject_color": s.subject.color_code,
        "teacher_id": s.teacher_id,
        "teacher_name": s.teacher.full_name,
        "classroom": s.classroom,
        "day_of_week": s.day_of_week,
        "start_time": s.start_time,
        "end_time": s.end_time,
    }


@router.delete("/schedules/{schedule_id}", status_code=204)
async def delete_schedule(
    schedule_id: uuid.UUID,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> None:
    result = await db.execute(
        select(GroupSchedule)
        .join(Group, GroupSchedule.group_id == Group.id)
        .where(
            GroupSchedule.id == schedule_id,
            Group.institution_id == current_user.institution_id,
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Schedule not found")

    await db.execute(delete(GroupSchedule).where(GroupSchedule.id == schedule_id))
    await db.commit()


# ── Private Lessons ──────────────────────────────────────────────────


@router.get("/private-lessons", response_model=list[PrivateLessonResponse])
async def list_private_lessons(
    student_id: uuid.UUID | None = None,
    teacher_id: uuid.UUID | None = None,
    status: str | None = None,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, object]]:
    query = (
        select(PrivateLesson)
        .options(
            selectinload(PrivateLesson.teacher),
            selectinload(PrivateLesson.student),
            selectinload(PrivateLesson.subject),
        )
        .where(PrivateLesson.institution_id == current_user.institution_id)
        .order_by(PrivateLesson.scheduled_at.desc())
    )
    if student_id:
        query = query.where(PrivateLesson.student_id == student_id)
    if teacher_id:
        query = query.where(PrivateLesson.teacher_id == teacher_id)
    if status:
        query = query.where(PrivateLesson.status == status)

    result = await db.execute(query)
    lessons = result.scalars().all()
    return [_lesson_to_dict(pl) for pl in lessons]


def _lesson_to_dict(pl: PrivateLesson) -> dict[str, object]:
    return {
        "id": pl.id,
        "teacher_id": pl.teacher_id,
        "teacher_name": pl.teacher.full_name,
        "student_id": pl.student_id,
        "student_name": pl.student.full_name,
        "subject_id": pl.subject_id,
        "subject_name": pl.subject.name,
        "institution_id": pl.institution_id,
        "scheduled_at": pl.scheduled_at,
        "duration_minutes": pl.duration_minutes,
        "status": pl.status.value,
        "classroom": pl.classroom,
        "notes": pl.notes,
        "created_at": pl.created_at,
    }


# ── Payments ─────────────────────────────────────────────────────────


@router.get("/payments", response_model=list[PaymentResponse])
async def list_payments(
    student_id: uuid.UUID | None = None,
    status: str | None = None,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, object]]:
    query = (
        select(Payment)
        .options(selectinload(Payment.student))
        .where(Payment.institution_id == current_user.institution_id)
        .order_by(Payment.due_date)
    )
    if student_id:
        query = query.where(Payment.student_id == student_id)
    if status:
        query = query.where(Payment.status == status)
    result = await db.execute(query)
    payments = result.scalars().all()
    return [
        {
            "id": p.id,
            "student_id": p.student_id,
            "student_name": p.student.full_name,
            "institution_id": p.institution_id,
            "installment_no": p.installment_no,
            "amount": p.amount,
            "due_date": p.due_date,
            "paid_date": p.paid_date,
            "status": p.status.value,
            "payment_method": p.payment_method,
            "notes": p.notes,
            "created_at": p.created_at,
        }
        for p in payments
    ]


@router.post("/payments/bulk", response_model=list[PaymentResponse], status_code=201)
async def create_bulk_payments(
    data: BulkPaymentCreate,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, object]]:
    """Create installment plan for a student.

    Splits total into equal installments.
    """
    from dateutil.relativedelta import relativedelta

    # Verify student belongs to institution
    student_result = await db.execute(
        select(User).where(
            User.id == data.student_id,
            User.institution_id == current_user.institution_id,
        )
    )
    student = student_result.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    discounted_total = data.total_amount * (1 - data.discount_rate / 100)
    installment_amount = round(discounted_total / data.installment_count, 2)

    note_parts: list[str] = []
    if data.discount_description:
        note_parts.append(f"{data.discount_description} (%{data.discount_rate})")
    if data.notes:
        note_parts.append(data.notes)
    final_notes = " — ".join(note_parts) if note_parts else None

    payments: list[Payment] = []
    for i in range(data.installment_count):
        due = data.start_date + relativedelta(months=i)
        # Adjust last installment for rounding
        amount = installment_amount
        if i == data.installment_count - 1:
            amount = round(
                discounted_total - installment_amount * (data.installment_count - 1),
                2,
            )

        payment = Payment(
            student_id=data.student_id,
            institution_id=current_user.institution_id,
            installment_no=i + 1,
            amount=amount,
            due_date=due,
            notes=final_notes,
        )
        db.add(payment)
        payments.append(payment)

    await db.commit()

    await log_action(
        db,
        institution_id=str(current_user.institution_id),
        user_id=str(current_user.id),
        action="create",
        entity_type="payment",
        entity_id=str(data.student_id),
        description="Taksit planı oluşturuldu",
    )
    await db.commit()

    # Re-fetch with relationships
    result = await db.execute(
        select(Payment)
        .options(selectinload(Payment.student))
        .where(
            Payment.student_id == data.student_id,
            Payment.institution_id == current_user.institution_id,
        )
        .order_by(Payment.installment_no)
    )
    all_payments = result.scalars().all()
    return [
        {
            "id": p.id,
            "student_id": p.student_id,
            "student_name": p.student.full_name,
            "institution_id": p.institution_id,
            "installment_no": p.installment_no,
            "amount": p.amount,
            "due_date": p.due_date,
            "paid_date": p.paid_date,
            "status": p.status.value,
            "payment_method": p.payment_method,
            "notes": p.notes,
            "created_at": p.created_at,
        }
        for p in all_payments
    ]


@router.put("/payments/{payment_id}", response_model=PaymentResponse)
async def update_payment(
    payment_id: uuid.UUID,
    data: PaymentUpdate,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> dict[str, object]:
    result = await db.execute(
        select(Payment)
        .options(selectinload(Payment.student))
        .where(
            Payment.id == payment_id,
            Payment.institution_id == current_user.institution_id,
        )
    )
    payment = result.scalar_one_or_none()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(payment, key, value)

    # If marking as paid, create cash entry for income tracking
    if data.status == "paid":
        cash = CashEntry(
            institution_id=current_user.institution_id,
            entry_type=CashEntryType.INCOME,
            amount=float(payment.amount),
            description=(
                f"Öğrenci taksit: {payment.student.full_name}"
                f" - Taksit {payment.installment_no}"
            ),
            category="student_payment",
            reference_id=str(payment.id),
            entry_date=data.paid_date or datetime.now(tz=UTC).date(),
            payment_method=data.payment_method,
            created_by=current_user.id,
        )
        db.add(cash)

    await log_action(
        db,
        institution_id=str(current_user.institution_id),
        user_id=str(current_user.id),
        action="update",
        entity_type="payment",
        entity_id=str(payment_id),
        description=f"Ödeme güncellendi: {payment.student.full_name}",
    )
    await db.commit()
    await db.refresh(payment)

    return {
        "id": payment.id,
        "student_id": payment.student_id,
        "student_name": payment.student.full_name,
        "institution_id": payment.institution_id,
        "installment_no": payment.installment_no,
        "amount": payment.amount,
        "due_date": payment.due_date,
        "paid_date": payment.paid_date,
        "status": payment.status.value,
        "payment_method": payment.payment_method,
        "notes": payment.notes,
        "created_at": payment.created_at,
    }


@router.delete("/payments/{payment_id}", status_code=204)
async def delete_payment(
    payment_id: uuid.UUID,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> None:
    result = await db.execute(
        select(Payment).where(
            Payment.id == payment_id,
            Payment.institution_id == current_user.institution_id,
        )
    )
    payment = result.scalar_one_or_none()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    await db.delete(payment)
    await db.commit()


@router.get("/payments/summary", response_model=PaymentSummary)
async def payment_summary(
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> dict[str, object]:
    """Get financial summary for the institution."""
    result = await db.execute(
        select(
            func.coalesce(func.sum(Payment.amount), 0).label("total_expected"),
            func.coalesce(
                func.sum(
                    case(
                        (Payment.status == PaymentStatus.PAID, Payment.amount),
                        else_=0,
                    )
                ),
                0,
            ).label("total_paid"),
            func.coalesce(
                func.sum(
                    case(
                        (
                            Payment.status == PaymentStatus.PENDING,
                            Payment.amount,
                        ),
                        else_=0,
                    )
                ),
                0,
            ).label("total_pending"),
            func.coalesce(
                func.sum(
                    case(
                        (
                            Payment.status == PaymentStatus.OVERDUE,
                            Payment.amount,
                        ),
                        else_=0,
                    )
                ),
                0,
            ).label("total_overdue"),
            func.count(func.distinct(Payment.student_id)).label("student_count"),
        ).where(Payment.institution_id == current_user.institution_id)
    )
    row = result.one()
    return {
        "total_expected": float(row.total_expected),
        "total_paid": float(row.total_paid),
        "total_pending": float(row.total_pending),
        "total_overdue": float(row.total_overdue),
        "student_count": row.student_count,
    }


# ── Announcements ────────────────────────────────────────────────────


@router.get("/announcements", response_model=list[AnnouncementResponse])
async def list_announcements(
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, object]]:
    result = await db.execute(
        select(Announcement)
        .options(selectinload(Announcement.author))
        .where(Announcement.institution_id == current_user.institution_id)
        .order_by(Announcement.is_pinned.desc(), Announcement.created_at.desc())
    )
    announcements = result.scalars().all()
    return [
        {
            "id": a.id,
            "title": a.title,
            "content": a.content,
            "target_role": a.target_role.value,
            "priority": a.priority.value,
            "is_pinned": a.is_pinned,
            "expires_at": a.expires_at,
            "created_by": a.created_by,
            "author_name": a.author.full_name,
            "created_at": a.created_at,
            "updated_at": a.updated_at,
        }
        for a in announcements
    ]


@router.post(
    "/announcements",
    response_model=AnnouncementResponse,
    status_code=201,
)
async def create_announcement(
    data: AnnouncementCreate,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> dict[str, object]:
    announcement = Announcement(
        title=data.title,
        content=data.content,
        institution_id=current_user.institution_id,
        target_role=AnnouncementTarget(data.target_role),
        priority=AnnouncementPriority(data.priority),
        is_pinned=data.is_pinned,
        expires_at=data.expires_at,
        created_by=current_user.id,
    )
    db.add(announcement)
    await db.flush()

    # Notify targeted users
    target_roles: list[UserRole] = []
    if data.target_role == "all":
        target_roles = [UserRole.TEACHER, UserRole.STUDENT, UserRole.PARENT]
    elif data.target_role == "teacher":
        target_roles = [UserRole.TEACHER]
    elif data.target_role == "student":
        target_roles = [UserRole.STUDENT]
    elif data.target_role == "parent":
        target_roles = [UserRole.PARENT]

    if target_roles:
        users_result = await db.execute(
            select(User.id).where(
                User.institution_id == current_user.institution_id,
                User.role.in_(target_roles),
                User.is_active == True,  # noqa: E712
            )
        )
        notif_user_ids = [str(row[0]) for row in users_result.all()]
        if UserRole.PARENT in target_roles:
            notif_link = "/parent/announcements"
        elif UserRole.STUDENT in target_roles:
            notif_link = "/student/announcements"
        else:
            notif_link = "/teacher/announcements"
        await send_bulk_notification(
            db,
            user_ids=notif_user_ids,
            title="Yeni Duyuru",
            message=data.title,
            notification_type="announcement",
            link=notif_link,
        )

    await db.commit()

    await log_action(
        db,
        institution_id=str(current_user.institution_id),
        user_id=str(current_user.id),
        action="create",
        entity_type="announcement",
        entity_id=str(announcement.id),
        description=f"Duyuru yayınlandı: {data.title}",
    )
    await db.commit()

    # Re-fetch with author loaded
    result = await db.execute(
        select(Announcement)
        .options(selectinload(Announcement.author))
        .where(Announcement.id == announcement.id)
    )
    a = result.scalar_one()
    return {
        "id": a.id,
        "title": a.title,
        "content": a.content,
        "target_role": a.target_role.value,
        "priority": a.priority.value,
        "is_pinned": a.is_pinned,
        "expires_at": a.expires_at,
        "created_by": a.created_by,
        "author_name": a.author.full_name,
        "created_at": a.created_at,
        "updated_at": a.updated_at,
    }


@router.put("/announcements/{announcement_id}", response_model=AnnouncementResponse)
async def update_announcement(
    announcement_id: uuid.UUID,
    data: AnnouncementUpdate,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> dict[str, object]:
    result = await db.execute(
        select(Announcement).where(
            Announcement.id == announcement_id,
            Announcement.institution_id == current_user.institution_id,
        )
    )
    announcement = result.scalar_one_or_none()
    if not announcement:
        raise HTTPException(status_code=404, detail="Announcement not found")

    update_data = data.model_dump(exclude_unset=True)
    if "target_role" in update_data:
        update_data["target_role"] = AnnouncementTarget(update_data["target_role"])
    if "priority" in update_data:
        update_data["priority"] = AnnouncementPriority(update_data["priority"])

    for key, value in update_data.items():
        setattr(announcement, key, value)

    await log_action(
        db,
        institution_id=str(current_user.institution_id),
        user_id=str(current_user.id),
        action="update",
        entity_type="announcement",
        entity_id=str(announcement_id),
        description=f"Duyuru güncellendi: {announcement.title}",
    )
    await db.commit()

    # Re-fetch with author loaded
    result = await db.execute(
        select(Announcement)
        .options(selectinload(Announcement.author))
        .where(Announcement.id == announcement_id)
    )
    a = result.scalar_one()
    return {
        "id": a.id,
        "title": a.title,
        "content": a.content,
        "target_role": a.target_role.value,
        "priority": a.priority.value,
        "is_pinned": a.is_pinned,
        "expires_at": a.expires_at,
        "created_by": a.created_by,
        "author_name": a.author.full_name,
        "created_at": a.created_at,
        "updated_at": a.updated_at,
    }


@router.delete("/announcements/{announcement_id}", status_code=204)
async def delete_announcement(
    announcement_id: uuid.UUID,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> None:
    result = await db.execute(
        select(Announcement).where(
            Announcement.id == announcement_id,
            Announcement.institution_id == current_user.institution_id,
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Announcement not found")

    await db.execute(delete(Announcement).where(Announcement.id == announcement_id))
    await db.commit()


# ── Attendance ───────────────────────────────────────────────────────


@router.post("/attendance", status_code=201)
async def record_attendance(
    data: AttendanceBulkCreate,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """Record attendance for a class session. Bulk create/update."""
    # Delete existing attendance for this schedule+date (allows re-taking)
    await db.execute(
        delete(Attendance).where(
            Attendance.schedule_id == data.schedule_id,
            Attendance.date == data.date,
        )
    )

    for entry in data.entries:
        att = Attendance(
            schedule_id=data.schedule_id,
            student_id=entry.student_id,
            date=data.date,
            status=AttendanceStatus(entry.status),
            noted_by=current_user.id,
            note=entry.note,
        )
        db.add(att)

    # Notify parents of absent/late students
    for entry in data.entries:
        if entry.status in ("absent", "late"):
            guardian_result = await db.execute(
                select(Guardian).where(
                    Guardian.student_id == entry.student_id,
                    Guardian.user_id.isnot(None),
                )
            )
            guardian = guardian_result.scalar_one_or_none()
            if guardian and guardian.user_id:
                status_text = "katılmadı" if entry.status == "absent" else "geç kaldı"
                await send_notification(
                    db,
                    user_id=str(guardian.user_id),
                    title="Yoklama Bildirimi",
                    message=f"Çocuğunuz bugünkü derse {status_text}.",
                    notification_type="attendance",
                    link="/parent/attendance",
                )

    await db.commit()

    await log_action(
        db,
        institution_id=str(current_user.institution_id),
        user_id=str(current_user.id),
        action="create",
        entity_type="attendance",
        description=f"Yoklama alındı ({len(data.entries)} öğrenci)",
    )
    await db.commit()

    return {"status": "ok", "count": str(len(data.entries))}


@router.get("/attendance")
async def list_attendance(
    schedule_id: uuid.UUID | None = None,
    student_id: uuid.UUID | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    group_id: uuid.UUID | None = None,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, object]]:
    query = (
        select(Attendance)
        .options(
            selectinload(Attendance.student),
            selectinload(Attendance.noted_by_user),
            selectinload(Attendance.schedule),
        )
        .join(GroupSchedule, Attendance.schedule_id == GroupSchedule.id)
        .join(Group, GroupSchedule.group_id == Group.id)
        .where(Group.institution_id == current_user.institution_id)
        .order_by(Attendance.date.desc(), Attendance.created_at.desc())
    )
    if schedule_id:
        query = query.where(Attendance.schedule_id == schedule_id)
    if student_id:
        query = query.where(Attendance.student_id == student_id)
    if date_from:
        query = query.where(Attendance.date >= date_from)
    if date_to:
        query = query.where(Attendance.date <= date_to)
    if group_id:
        query = query.where(GroupSchedule.group_id == group_id)

    result = await db.execute(query)
    records = result.scalars().all()
    return [
        {
            "id": a.id,
            "schedule_id": a.schedule_id,
            "student_id": a.student_id,
            "student_name": a.student.full_name,
            "date": a.date,
            "status": a.status.value,
            "noted_by": a.noted_by,
            "noted_by_name": a.noted_by_user.full_name,
            "note": a.note,
            "created_at": a.created_at,
        }
        for a in records
    ]


@router.get("/attendance/summary")
async def attendance_summary(
    group_id: uuid.UUID,
    date_from: date | None = None,
    date_to: date | None = None,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, object]]:
    """Get attendance summary per student for a group."""
    query = (
        select(
            Attendance.student_id,
            User.full_name.label("student_name"),
            func.count(Attendance.id).label("total_lessons"),
            func.sum(
                case((Attendance.status == AttendanceStatus.PRESENT, 1), else_=0)
            ).label("present"),
            func.sum(
                case((Attendance.status == AttendanceStatus.ABSENT, 1), else_=0)
            ).label("absent"),
            func.sum(
                case((Attendance.status == AttendanceStatus.LATE, 1), else_=0)
            ).label("late"),
            func.sum(
                case((Attendance.status == AttendanceStatus.EXCUSED, 1), else_=0)
            ).label("excused"),
        )
        .join(GroupSchedule, Attendance.schedule_id == GroupSchedule.id)
        .join(User, Attendance.student_id == User.id)
        .where(GroupSchedule.group_id == group_id)
        .group_by(Attendance.student_id, User.full_name)
    )
    if date_from:
        query = query.where(Attendance.date >= date_from)
    if date_to:
        query = query.where(Attendance.date <= date_to)

    result = await db.execute(query)
    rows = result.all()
    return [
        {
            "student_id": row.student_id,
            "student_name": row.student_name,
            "total_lessons": row.total_lessons,
            "present": row.present,
            "absent": row.absent,
            "late": row.late,
            "excused": row.excused,
            "attendance_rate": round(
                (row.present + row.late) / row.total_lessons * 100, 1
            )
            if row.total_lessons > 0
            else 0,
        }
        for row in rows
    ]


# ── Leads (Pre-Registration CRM) ─────────────────────────────────────


def _lead_to_response(lead: Lead) -> LeadResponse:
    """Convert a Lead ORM object to a LeadResponse schema."""
    return LeadResponse(
        id=lead.id,
        student_name=lead.student_name,
        parent_name=lead.parent_name,
        phone=lead.phone,
        email=lead.email,
        grade_level=lead.grade_level,
        target_exam=lead.target_exam,
        current_school=lead.current_school,
        status=lead.status.value,
        source=lead.source.value,
        assigned_to=lead.assigned_to,
        assigned_to_name=lead.assigned_user.full_name if lead.assigned_user else None,
        consultation_date=lead.consultation_date,
        consultation_score=lead.consultation_score,
        lost_reason=lead.lost_reason,
        notes=lead.notes,
        notes_list=[
            LeadNoteResponse(
                id=n.id,
                content=n.content,
                created_by=n.created_by,
                author_name=n.author.full_name,
                created_at=n.created_at,
            )
            for n in lead.notes_list
        ],
        created_at=lead.created_at,
        updated_at=lead.updated_at,
    )


@router.get("/leads", response_model=list[LeadResponse])
async def list_leads(
    status: str | None = Query(None),
    source: str | None = Query(None),
    search: str | None = Query(None),
    assigned_to: uuid.UUID | None = Query(None),
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> list[LeadResponse]:
    query = (
        select(Lead)
        .options(
            selectinload(Lead.assigned_user),
            selectinload(Lead.notes_list).selectinload(LeadNote.author),
        )
        .where(Lead.institution_id == current_user.institution_id)
        .order_by(Lead.created_at.desc())
    )

    if status:
        query = query.where(Lead.status == LeadStatus(status))
    if source:
        query = query.where(Lead.source == LeadSource(source))
    if assigned_to:
        query = query.where(Lead.assigned_to == assigned_to)
    if search:
        pattern = f"%{search}%"
        query = query.where(
            or_(
                Lead.student_name.ilike(pattern),
                Lead.parent_name.ilike(pattern),
                Lead.phone.ilike(pattern),
                Lead.email.ilike(pattern),
            )
        )

    result = await db.execute(query)
    leads = result.scalars().all()
    return [_lead_to_response(lead) for lead in leads]


@router.get("/leads/summary", response_model=LeadSummary)
async def leads_summary(
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> LeadSummary:
    result = await db.execute(
        select(Lead.status, func.count(Lead.id))
        .where(Lead.institution_id == current_user.institution_id)
        .group_by(Lead.status)
    )
    counts: dict[str, int] = {}
    total = 0
    for status_val, count in result.all():
        counts[status_val.value] = count
        total += count

    enrolled = counts.get("enrolled", 0)
    conversion_rate = round(enrolled / total * 100, 1) if total > 0 else 0.0

    return LeadSummary(
        total=total,
        new=counts.get("new", 0),
        contacted=counts.get("contacted", 0),
        consultation_scheduled=counts.get("consultation_scheduled", 0),
        consultation_done=counts.get("consultation_done", 0),
        enrolled=enrolled,
        lost=counts.get("lost", 0),
        conversion_rate=conversion_rate,
    )


@router.post("/leads", response_model=LeadResponse, status_code=201)
async def create_lead(
    data: LeadCreate,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> LeadResponse:
    lead = Lead(
        institution_id=current_user.institution_id,
        student_name=data.student_name,
        parent_name=data.parent_name,
        phone=data.phone,
        email=data.email,
        grade_level=data.grade_level,
        target_exam=data.target_exam,
        current_school=data.current_school,
        source=LeadSource(data.source),
        assigned_to=data.assigned_to,
        notes=data.notes,
    )
    db.add(lead)
    await db.commit()
    await db.refresh(lead)

    # Reload with relationships
    result = await db.execute(
        select(Lead)
        .options(
            selectinload(Lead.assigned_user),
            selectinload(Lead.notes_list).selectinload(LeadNote.author),
        )
        .where(Lead.id == lead.id)
    )
    lead = result.scalar_one()
    return _lead_to_response(lead)


@router.get("/leads/{lead_id}", response_model=LeadResponse)
async def get_lead(
    lead_id: uuid.UUID,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> LeadResponse:
    result = await db.execute(
        select(Lead)
        .options(
            selectinload(Lead.assigned_user),
            selectinload(Lead.notes_list).selectinload(LeadNote.author),
        )
        .where(
            Lead.id == lead_id,
            Lead.institution_id == current_user.institution_id,
        )
    )
    lead = result.scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    return _lead_to_response(lead)


@router.put("/leads/{lead_id}", response_model=LeadResponse)
async def update_lead(
    lead_id: uuid.UUID,
    data: LeadUpdate,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> LeadResponse:
    result = await db.execute(
        select(Lead).where(
            Lead.id == lead_id,
            Lead.institution_id == current_user.institution_id,
        )
    )
    lead = result.scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    update_data = data.model_dump(exclude_unset=True)
    if "status" in update_data and update_data["status"] is not None:
        update_data["status"] = LeadStatus(update_data["status"])
    if "source" in update_data and update_data["source"] is not None:
        update_data["source"] = LeadSource(update_data["source"])

    for key, value in update_data.items():
        setattr(lead, key, value)

    await db.commit()

    # Reload with relationships
    result = await db.execute(
        select(Lead)
        .options(
            selectinload(Lead.assigned_user),
            selectinload(Lead.notes_list).selectinload(LeadNote.author),
        )
        .where(Lead.id == lead.id)
    )
    lead = result.scalar_one()
    return _lead_to_response(lead)


@router.delete("/leads/{lead_id}", status_code=204)
async def delete_lead(
    lead_id: uuid.UUID,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> None:
    result = await db.execute(
        select(Lead).where(
            Lead.id == lead_id,
            Lead.institution_id == current_user.institution_id,
        )
    )
    lead = result.scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    await db.delete(lead)
    await db.commit()


@router.post("/leads/{lead_id}/notes", response_model=LeadNoteResponse, status_code=201)
async def add_lead_note(
    lead_id: uuid.UUID,
    data: LeadNoteCreate,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> LeadNoteResponse:
    result = await db.execute(
        select(Lead).where(
            Lead.id == lead_id,
            Lead.institution_id == current_user.institution_id,
        )
    )
    lead = result.scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    note = LeadNote(
        lead_id=lead_id,
        content=data.content,
        created_by=current_user.id,
    )
    db.add(note)
    await db.commit()
    await db.refresh(note)

    return LeadNoteResponse(
        id=note.id,
        content=note.content,
        created_by=note.created_by,
        author_name=current_user.full_name,
        created_at=note.created_at,
    )


@router.post("/leads/{lead_id}/convert", status_code=201)
async def convert_lead(
    lead_id: uuid.UUID,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> dict[str, object]:
    result = await db.execute(
        select(Lead).where(
            Lead.id == lead_id,
            Lead.institution_id == current_user.institution_id,
        )
    )
    lead = result.scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    if lead.status == LeadStatus.ENROLLED:
        raise HTTPException(status_code=400, detail="Bu aday zaten kayıt olmuş")

    temp_password = secrets.token_urlsafe(8)

    student = User(
        email=lead.email or f"ogrenci_{lead.id.hex[:8]}@temp.etut.pro",
        password_hash=hash_password(temp_password),
        full_name=lead.student_name,
        phone=lead.phone,
        role=UserRole.STUDENT,
        institution_id=current_user.institution_id,
        grade_level=lead.grade_level,
        target_exam=lead.target_exam,
        school=lead.current_school,
        enrollment_status="active",
        enrollment_date=datetime.now(tz=UTC).date(),
    )
    db.add(student)

    lead.status = LeadStatus.ENROLLED

    await db.commit()
    await db.refresh(student)

    await log_action(
        db,
        institution_id=str(current_user.institution_id),
        user_id=str(current_user.id),
        action="convert",
        entity_type="lead",
        entity_id=str(lead_id),
        description="Aday öğrenciye dönüştürüldü",
    )
    await db.commit()

    return {
        "student_id": str(student.id),
        "email": student.email,
        "temporary_password": temp_password,
        "message": "Öğrenci başarıyla kaydedildi",
    }


# ── Reports ──────────────────────────────────────────────────────────


@router.get("/reports/overview")
async def report_overview(
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> dict[str, object]:
    """Comprehensive institutional overview report."""
    inst_id = current_user.institution_id

    # Student stats
    student_total = (
        await db.execute(
            select(func.count(User.id)).where(
                User.institution_id == inst_id, User.role == UserRole.STUDENT
            )
        )
    ).scalar() or 0

    student_active = (
        await db.execute(
            select(func.count(User.id)).where(
                User.institution_id == inst_id,
                User.role == UserRole.STUDENT,
                User.enrollment_status == "active",
            )
        )
    ).scalar() or 0

    student_frozen = (
        await db.execute(
            select(func.count(User.id)).where(
                User.institution_id == inst_id,
                User.role == UserRole.STUDENT,
                User.enrollment_status == "frozen",
            )
        )
    ).scalar() or 0

    # Teacher stats
    teacher_total = (
        await db.execute(
            select(func.count(User.id)).where(
                User.institution_id == inst_id, User.role == UserRole.TEACHER
            )
        )
    ).scalar() or 0

    # Group stats
    group_total = (
        await db.execute(
            select(func.count(Group.id)).where(Group.institution_id == inst_id)
        )
    ).scalar() or 0

    group_active = (
        await db.execute(
            select(func.count(Group.id)).where(
                Group.institution_id == inst_id, Group.status == GroupStatus.ACTIVE
            )
        )
    ).scalar() or 0

    # Financial stats
    fin_result = await db.execute(
        select(
            func.coalesce(func.sum(Payment.amount), 0).label("total"),
            func.coalesce(
                func.sum(
                    case(
                        (Payment.status == PaymentStatus.PAID, Payment.amount),
                        else_=0,
                    )
                ),
                0,
            ).label("paid"),
            func.coalesce(
                func.sum(
                    case(
                        (Payment.status == PaymentStatus.PENDING, Payment.amount),
                        else_=0,
                    )
                ),
                0,
            ).label("pending"),
            func.coalesce(
                func.sum(
                    case(
                        (Payment.status == PaymentStatus.OVERDUE, Payment.amount),
                        else_=0,
                    )
                ),
                0,
            ).label("overdue"),
        ).where(Payment.institution_id == inst_id)
    )
    fin = fin_result.one()

    # Lead/CRM stats
    lead_total = (
        await db.execute(
            select(func.count(Lead.id)).where(Lead.institution_id == inst_id)
        )
    ).scalar() or 0

    lead_enrolled = (
        await db.execute(
            select(func.count(Lead.id)).where(
                Lead.institution_id == inst_id, Lead.status == LeadStatus.ENROLLED
            )
        )
    ).scalar() or 0

    # Attendance rate (last 30 days)
    thirty_days_ago = datetime.now(tz=UTC).date() - timedelta(days=30)

    att_result = await db.execute(
        select(
            func.count(Attendance.id).label("total"),
            func.sum(
                case(
                    (
                        Attendance.status.in_(
                            [AttendanceStatus.PRESENT, AttendanceStatus.LATE]
                        ),
                        1,
                    ),
                    else_=0,
                )
            ).label("present"),
        )
        .join(GroupSchedule, Attendance.schedule_id == GroupSchedule.id)
        .join(Group, GroupSchedule.group_id == Group.id)
        .where(Group.institution_id == inst_id, Attendance.date >= thirty_days_ago)
    )
    att = att_result.one()
    attendance_rate = (
        round(float(att.present or 0) / float(att.total) * 100, 1) if att.total else 0
    )

    return {
        "students": {
            "total": student_total,
            "active": student_active,
            "frozen": student_frozen,
        },
        "teachers": {"total": teacher_total},
        "groups": {"total": group_total, "active": group_active},
        "financial": {
            "total_expected": float(fin.total),
            "total_paid": float(fin.paid),
            "total_pending": float(fin.pending),
            "total_overdue": float(fin.overdue),
            "collection_rate": round(float(fin.paid) / float(fin.total) * 100, 1)
            if float(fin.total) > 0
            else 0,
        },
        "leads": {"total": lead_total, "enrolled": lead_enrolled},
        "attendance_rate_30d": attendance_rate,
    }


@router.get("/reports/financial-monthly")
async def report_financial_monthly(
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, object]]:
    """Monthly revenue breakdown for the last 12 months."""
    result = await db.execute(
        select(
            extract("year", Payment.due_date).label("year"),
            extract("month", Payment.due_date).label("month"),
            func.sum(Payment.amount).label("expected"),
            func.sum(
                case((Payment.status == PaymentStatus.PAID, Payment.amount), else_=0)
            ).label("collected"),
        )
        .where(Payment.institution_id == current_user.institution_id)
        .group_by(extract("year", Payment.due_date), extract("month", Payment.due_date))
        .order_by(extract("year", Payment.due_date), extract("month", Payment.due_date))
        .limit(12)
    )

    months_tr = [
        "",
        "Ocak",
        "\u015eubat",
        "Mart",
        "Nisan",
        "May\u0131s",
        "Haziran",
        "Temmuz",
        "A\u011fustos",
        "Eyl\u00fcl",
        "Ekim",
        "Kas\u0131m",
        "Aral\u0131k",
    ]

    return [
        {
            "year": int(row.year),
            "month": int(row.month),
            "month_name": months_tr[int(row.month)],
            "expected": float(row.expected or 0),
            "collected": float(row.collected or 0),
        }
        for row in result.all()
    ]


@router.get("/reports/attendance-by-group")
async def report_attendance_by_group(
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, object]]:
    """Attendance rates per group."""
    result = await db.execute(
        select(
            Group.id,
            Group.name,
            func.count(Attendance.id).label("total"),
            func.sum(
                case(
                    (
                        Attendance.status.in_(
                            [AttendanceStatus.PRESENT, AttendanceStatus.LATE]
                        ),
                        1,
                    ),
                    else_=0,
                )
            ).label("present"),
        )
        .join(GroupSchedule, GroupSchedule.group_id == Group.id)
        .join(Attendance, Attendance.schedule_id == GroupSchedule.id)
        .where(Group.institution_id == current_user.institution_id)
        .group_by(Group.id, Group.name)
        .order_by(Group.name)
    )

    return [
        {
            "group_id": str(row.id),
            "group_name": row.name,
            "total_records": row.total,
            "present_count": row.present,
            "attendance_rate": round(
                float(row.present or 0) / float(row.total) * 100, 1
            )
            if row.total
            else 0,
        }
        for row in result.all()
    ]


@router.get("/reports/student-enrollment")
async def report_student_enrollment(
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> dict[str, object]:
    """Student enrollment breakdown by grade, exam target, status."""
    inst_id = current_user.institution_id

    # By grade
    grade_result = await db.execute(
        select(User.grade_level, func.count(User.id))
        .where(
            User.institution_id == inst_id,
            User.role == UserRole.STUDENT,
            User.grade_level.isnot(None),
        )
        .group_by(User.grade_level)
    )
    by_grade = [{"label": row[0], "count": row[1]} for row in grade_result.all()]

    # By target exam
    exam_result = await db.execute(
        select(User.target_exam, func.count(User.id))
        .where(
            User.institution_id == inst_id,
            User.role == UserRole.STUDENT,
            User.target_exam.isnot(None),
        )
        .group_by(User.target_exam)
    )
    by_exam = [{"label": row[0], "count": row[1]} for row in exam_result.all()]

    # By status
    status_result = await db.execute(
        select(User.enrollment_status, func.count(User.id))
        .where(
            User.institution_id == inst_id,
            User.role == UserRole.STUDENT,
            User.enrollment_status.isnot(None),
        )
        .group_by(User.enrollment_status)
    )
    by_status = [{"label": row[0], "count": row[1]} for row in status_result.all()]

    return {
        "by_grade": by_grade,
        "by_exam": by_exam,
        "by_status": by_status,
    }


# ── Permissions / Admin Roles ────────────────────────────────────────


@router.get("/permissions/available")
async def list_available_permissions(
    current_user: User = Depends(require_role("admin")),
) -> list[str]:
    return PERMISSIONS


@router.get("/roles")
async def list_admin_roles(
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, object]]:
    result = await db.execute(
        select(AdminRole).where(AdminRole.institution_id == current_user.institution_id)
    )
    roles = result.scalars().all()

    response = []
    for role in roles:
        perms_result = await db.execute(
            select(role_permissions.c.permission).where(
                role_permissions.c.role_id == role.id
            )
        )
        perms = [row[0] for row in perms_result.all()]

        user_count_result = await db.execute(
            select(func.count()).where(user_admin_roles.c.role_id == role.id)
        )
        user_count = user_count_result.scalar() or 0

        response.append(
            {
                "id": role.id,
                "name": role.name,
                "permissions": perms,
                "user_count": user_count,
            }
        )

    return response


@router.post("/roles", status_code=201)
async def create_admin_role(
    data: AdminRoleCreate,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> dict[str, object]:
    role = AdminRole(name=data.name, institution_id=current_user.institution_id)
    db.add(role)
    await db.flush()

    for perm in data.permissions:
        if perm in PERMISSIONS:
            await db.execute(
                role_permissions.insert().values(role_id=role.id, permission=perm)
            )

    await db.commit()
    return {
        "id": role.id,
        "name": role.name,
        "permissions": data.permissions,
        "user_count": 0,
    }


@router.put("/roles/{role_id}")
async def update_admin_role(
    role_id: uuid.UUID,
    data: AdminRoleUpdate,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> dict[str, object]:
    result = await db.execute(
        select(AdminRole).where(
            AdminRole.id == role_id,
            AdminRole.institution_id == current_user.institution_id,
        )
    )
    role = result.scalar_one_or_none()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")

    if data.name is not None:
        role.name = data.name

    if data.permissions is not None:
        await db.execute(
            role_permissions.delete().where(role_permissions.c.role_id == role_id)
        )
        for perm in data.permissions:
            if perm in PERMISSIONS:
                await db.execute(
                    role_permissions.insert().values(role_id=role_id, permission=perm)
                )

    await db.commit()

    perms_result = await db.execute(
        select(role_permissions.c.permission).where(
            role_permissions.c.role_id == role_id
        )
    )
    perms = [row[0] for row in perms_result.all()]

    return {"id": role.id, "name": role.name, "permissions": perms, "user_count": 0}


@router.delete("/roles/{role_id}", status_code=204)
async def delete_admin_role(
    role_id: uuid.UUID,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> None:
    result = await db.execute(
        select(AdminRole).where(
            AdminRole.id == role_id,
            AdminRole.institution_id == current_user.institution_id,
        )
    )
    role = result.scalar_one_or_none()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    await db.delete(role)
    await db.commit()


# ── Audit Log ────────────────────────────────────────────────────────


@router.get("/audit-logs")
async def list_audit_logs(
    entity_type: str | None = None,
    action: str | None = None,
    user_id: uuid.UUID | None = None,
    limit: int = 50,
    offset: int = 0,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, object]]:
    query = (
        select(AuditLog)
        .options(selectinload(AuditLog.user))
        .where(AuditLog.institution_id == current_user.institution_id)
        .order_by(AuditLog.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    if entity_type:
        query = query.where(AuditLog.entity_type == entity_type)
    if action:
        query = query.where(AuditLog.action == action)
    if user_id:
        query = query.where(AuditLog.user_id == user_id)

    result = await db.execute(query)
    logs = result.scalars().all()
    return [
        {
            "id": log.id,
            "user_id": log.user_id,
            "user_name": log.user.full_name if log.user else "Sistem",
            "action": log.action,
            "entity_type": log.entity_type,
            "entity_id": log.entity_id,
            "description": log.description,
            "created_at": log.created_at,
        }
        for log in logs
    ]


# ── Admin Users ──────────────────────────────────────────────────────


@router.get("/admin-users")
async def list_admin_users(
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, object]]:
    """List all admin users for this institution."""
    result = await db.execute(
        select(User)
        .where(
            User.institution_id == current_user.institution_id,
            User.role == UserRole.ADMIN,
        )
        .order_by(User.created_at.desc())
    )
    admins = result.scalars().all()

    response = []
    for admin in admins:
        # Get assigned roles
        roles_result = await db.execute(
            select(AdminRole.name, AdminRole.id)
            .join(user_admin_roles, user_admin_roles.c.role_id == AdminRole.id)
            .where(user_admin_roles.c.user_id == admin.id)
        )
        roles = [{"id": str(r.id), "name": r.name} for r in roles_result.all()]

        response.append(
            {
                "id": admin.id,
                "email": admin.email,
                "full_name": admin.full_name,
                "phone": admin.phone,
                "is_active": admin.is_active,
                "roles": roles,
                "created_at": admin.created_at,
            }
        )
    return response


@router.post("/admin-users", status_code=201)
async def create_admin_user(
    data: AdminUserCreate,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> dict[str, object]:
    """Create a new admin user and optionally assign roles."""
    user = User(
        email=data.email,
        password_hash=hash_password(data.password),
        full_name=data.full_name,
        phone=data.phone,
        role=UserRole.ADMIN,
        institution_id=current_user.institution_id,
    )
    db.add(user)
    await db.flush()

    if data.role_ids:
        for rid in data.role_ids:
            await db.execute(
                user_admin_roles.insert().values(user_id=user.id, role_id=rid)
            )

    await log_action(
        db,
        institution_id=str(current_user.institution_id),
        user_id=str(current_user.id),
        action="create",
        entity_type="admin_user",
        entity_id=str(user.id),
        description=f"{data.full_name} admin kullanıcı oluşturuldu",
    )
    await db.commit()

    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "is_active": user.is_active,
    }


@router.put("/admin-users/{user_id}/roles")
async def assign_admin_roles(
    user_id: uuid.UUID,
    role_ids: list[uuid.UUID],
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """Assign roles to an admin user."""
    # Verify user belongs to same institution
    result = await db.execute(
        select(User).where(
            User.id == user_id,
            User.institution_id == current_user.institution_id,
            User.role == UserRole.ADMIN,
        )
    )
    target_user = result.scalar_one_or_none()
    if not target_user:
        raise HTTPException(status_code=404, detail="Admin user not found")

    # Clear existing
    await db.execute(
        user_admin_roles.delete().where(user_admin_roles.c.user_id == user_id)
    )
    # Assign new
    for rid in role_ids:
        await db.execute(user_admin_roles.insert().values(user_id=user_id, role_id=rid))

    await log_action(
        db,
        institution_id=str(current_user.institution_id),
        user_id=str(current_user.id),
        action="update",
        entity_type="admin_user",
        entity_id=str(user_id),
        description=f"{target_user.full_name} admin rolü güncellendi",
    )
    await db.commit()
    return {"status": "ok"}


# ── Parent Account ────────────────────────────────────────────────────


@router.post("/students/{student_id}/parent-account", status_code=201)
async def create_parent_account(
    student_id: uuid.UUID,
    guardian_id: uuid.UUID,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> dict[str, object]:
    """Create a login account for a guardian (parent)."""
    # Get guardian
    result = await db.execute(
        select(Guardian).where(
            Guardian.id == guardian_id,
            Guardian.student_id == student_id,
        )
    )
    guardian = result.scalar_one_or_none()
    if not guardian:
        raise HTTPException(status_code=404, detail="Veli bulunamadı")

    if guardian.user_id:
        raise HTTPException(
            status_code=400, detail="Bu veli için zaten hesap oluşturulmuş"
        )

    if not guardian.email and not guardian.phone:
        raise HTTPException(
            status_code=400,
            detail="Veli e-posta veya telefon bilgisi gerekli",
        )

    temp_password = secrets.token_urlsafe(8)
    email = guardian.email or f"veli_{guardian.id.hex[:8]}@temp.etut.pro"

    parent_user = User(
        email=email,
        password_hash=hash_password(temp_password),
        full_name=guardian.full_name,
        phone=guardian.phone,
        role=UserRole.PARENT,
        institution_id=current_user.institution_id,
    )
    db.add(parent_user)
    await db.flush()

    guardian.user_id = parent_user.id

    await log_action(
        db,
        institution_id=str(current_user.institution_id),
        user_id=str(current_user.id),
        action="create",
        entity_type="parent_account",
        entity_id=str(parent_user.id),
        description=f"{guardian.full_name} için veli hesabı oluşturuldu",
    )
    await db.commit()

    return {
        "parent_id": str(parent_user.id),
        "email": email,
        "temporary_password": temp_password,
        "guardian_name": guardian.full_name,
    }


# ── Expenses ─────────────────────────────────────────────────────────


@router.get("/expenses")
async def list_expenses(
    category: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, object]]:
    query = (
        select(Expense)
        .options(selectinload(Expense.creator))
        .where(Expense.institution_id == current_user.institution_id)
        .order_by(Expense.expense_date.desc())
    )
    if category:
        query = query.where(Expense.category == category)
    if date_from:
        query = query.where(Expense.expense_date >= date_from)
    if date_to:
        query = query.where(Expense.expense_date <= date_to)

    result = await db.execute(query)
    expenses = result.scalars().all()
    return [
        {
            "id": e.id,
            "category": e.category.value,
            "amount": float(e.amount),
            "description": e.description,
            "vendor": e.vendor,
            "expense_date": e.expense_date,
            "payment_method": e.payment_method,
            "receipt_no": e.receipt_no,
            "notes": e.notes,
            "created_by": e.created_by,
            "created_by_name": e.creator.full_name,
            "created_at": e.created_at,
        }
        for e in expenses
    ]


@router.post("/expenses", status_code=201)
async def create_expense(
    data: ExpenseCreate,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> dict[str, object]:
    expense = Expense(
        institution_id=current_user.institution_id,
        category=ExpenseCategory(data.category),
        amount=data.amount,
        description=data.description,
        vendor=data.vendor,
        expense_date=data.expense_date,
        payment_method=data.payment_method,
        receipt_no=data.receipt_no,
        notes=data.notes,
        created_by=current_user.id,
    )
    db.add(expense)

    # Also create cash entry
    cash = CashEntry(
        institution_id=current_user.institution_id,
        entry_type=CashEntryType.EXPENSE,
        amount=data.amount,
        description=data.description,
        category="expense",
        reference_id=str(expense.id),
        entry_date=data.expense_date,
        payment_method=data.payment_method,
        created_by=current_user.id,
    )
    db.add(cash)

    await log_action(
        db,
        institution_id=str(current_user.institution_id),
        user_id=str(current_user.id),
        action="create",
        entity_type="expense",
        description=f"Gider kaydı: {data.description} - ₺{data.amount}",
    )
    await db.commit()
    await db.refresh(expense)

    return {
        "id": expense.id,
        "category": expense.category.value,
        "amount": float(expense.amount),
        "description": expense.description,
        "expense_date": expense.expense_date,
        "created_at": expense.created_at,
    }


@router.put("/expenses/{expense_id}")
async def update_expense(
    expense_id: uuid.UUID,
    data: ExpenseUpdate,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> dict[str, object]:
    result = await db.execute(
        select(Expense)
        .options(selectinload(Expense.creator))
        .where(
            Expense.id == expense_id,
            Expense.institution_id == current_user.institution_id,
        )
    )
    expense = result.scalar_one_or_none()
    if not expense:
        raise HTTPException(status_code=404, detail="Gider kaydı bulunamadı")

    update_data = data.model_dump(exclude_unset=True)
    if "category" in update_data:
        update_data["category"] = ExpenseCategory(update_data["category"])
    for key, value in update_data.items():
        setattr(expense, key, value)

    await log_action(
        db,
        institution_id=str(current_user.institution_id),
        user_id=str(current_user.id),
        action="update",
        entity_type="expense",
        entity_id=str(expense_id),
        description=f"Gider güncellendi: {expense.description}",
    )
    await db.commit()
    await db.refresh(expense)

    return {
        "id": expense.id,
        "category": expense.category.value,
        "amount": float(expense.amount),
        "description": expense.description,
        "vendor": expense.vendor,
        "expense_date": expense.expense_date,
        "payment_method": expense.payment_method,
        "receipt_no": expense.receipt_no,
        "notes": expense.notes,
        "created_by": expense.created_by,
        "created_by_name": expense.creator.full_name,
        "created_at": expense.created_at,
    }


@router.delete("/expenses/{expense_id}", status_code=204)
async def delete_expense(
    expense_id: uuid.UUID,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> None:
    result = await db.execute(
        select(Expense).where(
            Expense.id == expense_id,
            Expense.institution_id == current_user.institution_id,
        )
    )
    expense = result.scalar_one_or_none()
    if not expense:
        raise HTTPException(status_code=404, detail="Gider kaydı bulunamadı")
    await db.delete(expense)
    await log_action(
        db,
        institution_id=str(current_user.institution_id),
        user_id=str(current_user.id),
        action="delete",
        entity_type="expense",
        entity_id=str(expense_id),
        description=f"Gider silindi: {expense.description}",
    )
    await db.commit()


# ── Teacher Payroll ──────────────────────────────────────────────────


@router.get("/teacher-payments")
async def list_teacher_payments(
    period: str | None = None,
    teacher_id: uuid.UUID | None = None,
    status: str | None = None,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, object]]:
    query = (
        select(TeacherPayment)
        .options(selectinload(TeacherPayment.teacher))
        .where(TeacherPayment.institution_id == current_user.institution_id)
        .order_by(TeacherPayment.period.desc(), TeacherPayment.teacher_id)
    )
    if period:
        query = query.where(TeacherPayment.period == period)
    if teacher_id:
        query = query.where(TeacherPayment.teacher_id == teacher_id)
    if status:
        query = query.where(TeacherPayment.status == status)

    result = await db.execute(query)
    payments = result.scalars().all()
    return [
        {
            "id": p.id,
            "teacher_id": p.teacher_id,
            "teacher_name": p.teacher.full_name,
            "period": p.period,
            "base_salary": float(p.base_salary),
            "lesson_count": p.lesson_count,
            "per_lesson_rate": float(p.per_lesson_rate),
            "lesson_total": float(p.lesson_total),
            "bonus": float(p.bonus),
            "deduction": float(p.deduction),
            "total_amount": float(p.total_amount),
            "status": p.status.value,
            "payment_method": p.payment_method,
            "paid_date": p.paid_date,
            "notes": p.notes,
            "created_at": p.created_at,
        }
        for p in payments
    ]


@router.post("/teacher-payments", status_code=201)
async def create_teacher_payment(
    data: TeacherPaymentCreate,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> dict[str, object]:
    # Calculate totals
    lesson_total = data.lesson_count * data.per_lesson_rate
    total_amount = data.base_salary + lesson_total + data.bonus - data.deduction

    payment = TeacherPayment(
        teacher_id=data.teacher_id,
        institution_id=current_user.institution_id,
        period=data.period,
        base_salary=data.base_salary,
        lesson_count=data.lesson_count,
        per_lesson_rate=data.per_lesson_rate,
        lesson_total=lesson_total,
        bonus=data.bonus,
        deduction=data.deduction,
        total_amount=total_amount,
        notes=data.notes,
    )
    db.add(payment)
    await db.commit()
    await db.refresh(payment)

    # Re-fetch with teacher relationship
    result = await db.execute(
        select(TeacherPayment)
        .options(selectinload(TeacherPayment.teacher))
        .where(TeacherPayment.id == payment.id)
    )
    p = result.scalar_one()
    return {
        "id": p.id,
        "teacher_id": p.teacher_id,
        "teacher_name": p.teacher.full_name,
        "period": p.period,
        "base_salary": float(p.base_salary),
        "lesson_count": p.lesson_count,
        "per_lesson_rate": float(p.per_lesson_rate),
        "lesson_total": float(p.lesson_total),
        "bonus": float(p.bonus),
        "deduction": float(p.deduction),
        "total_amount": float(p.total_amount),
        "status": p.status.value,
        "payment_method": p.payment_method,
        "paid_date": p.paid_date,
        "notes": p.notes,
        "created_at": p.created_at,
    }


@router.put("/teacher-payments/{payment_id}")
async def update_teacher_payment(
    payment_id: uuid.UUID,
    data: TeacherPaymentUpdate,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> dict[str, object]:
    result = await db.execute(
        select(TeacherPayment)
        .options(selectinload(TeacherPayment.teacher))
        .where(
            TeacherPayment.id == payment_id,
            TeacherPayment.institution_id == current_user.institution_id,
        )
    )
    payment = result.scalar_one_or_none()
    if not payment:
        raise HTTPException(status_code=404, detail="Ödeme bulunamadı")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(payment, key, value)

    # If marking as paid, create cash entry
    if data.status == "paid" and payment.status != TeacherPaymentStatus.PAID:
        payment.status = TeacherPaymentStatus.PAID
        cash = CashEntry(
            institution_id=current_user.institution_id,
            entry_type=CashEntryType.EXPENSE,
            amount=float(payment.total_amount),
            description=(
                f"Öğretmen maaşı: {payment.teacher.full_name} ({payment.period})"
            ),
            category="teacher_salary",
            reference_id=str(payment.id),
            entry_date=data.paid_date or datetime.now(tz=UTC).date(),
            payment_method=data.payment_method,
            created_by=current_user.id,
        )
        db.add(cash)

    await db.commit()
    return {
        "id": payment.id,
        "teacher_id": payment.teacher_id,
        "teacher_name": payment.teacher.full_name,
        "period": payment.period,
        "total_amount": float(payment.total_amount),
        "status": payment.status.value,
        "paid_date": payment.paid_date,
    }


@router.get("/teacher-payments/summary")
async def teacher_payroll_summary(
    period: str | None = None,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> dict[str, object]:
    query = select(
        func.count(TeacherPayment.id).label("total"),
        func.coalesce(func.sum(TeacherPayment.total_amount), 0).label("total_amount"),
        func.coalesce(
            func.sum(
                case(
                    (
                        TeacherPayment.status == TeacherPaymentStatus.PAID,
                        TeacherPayment.total_amount,
                    ),
                    else_=0,
                )
            ),
            0,
        ).label("paid"),
        func.coalesce(
            func.sum(
                case(
                    (
                        TeacherPayment.status == TeacherPaymentStatus.PENDING,
                        TeacherPayment.total_amount,
                    ),
                    else_=0,
                )
            ),
            0,
        ).label("pending"),
    ).where(TeacherPayment.institution_id == current_user.institution_id)

    if period:
        query = query.where(TeacherPayment.period == period)

    result = await db.execute(query)
    row = result.one()
    return {
        "total_teachers": row.total,
        "total_amount": float(row.total_amount),
        "paid_amount": float(row.paid),
        "pending_amount": float(row.pending),
    }


# ── Cash Ledger ──────────────────────────────────────────────────────


@router.get("/cash-ledger")
async def list_cash_entries(
    entry_type: str | None = None,
    category: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, object]]:
    query = (
        select(CashEntry)
        .options(selectinload(CashEntry.creator))
        .where(CashEntry.institution_id == current_user.institution_id)
        .order_by(CashEntry.entry_date.desc(), CashEntry.created_at.desc())
    )
    if entry_type:
        query = query.where(CashEntry.entry_type == entry_type)
    if category:
        query = query.where(CashEntry.category == category)
    if date_from:
        query = query.where(CashEntry.entry_date >= date_from)
    if date_to:
        query = query.where(CashEntry.entry_date <= date_to)

    result = await db.execute(query)
    entries = result.scalars().all()
    return [
        {
            "id": e.id,
            "entry_type": e.entry_type.value,
            "amount": float(e.amount),
            "description": e.description,
            "category": e.category,
            "reference_id": e.reference_id,
            "entry_date": e.entry_date,
            "payment_method": e.payment_method,
            "created_by_name": e.creator.full_name,
            "created_at": e.created_at,
        }
        for e in entries
    ]


@router.post("/cash-ledger", status_code=201)
async def create_cash_entry(
    data: CashEntryCreate,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> dict[str, object]:
    entry = CashEntry(
        institution_id=current_user.institution_id,
        entry_type=CashEntryType(data.entry_type),
        amount=data.amount,
        description=data.description,
        category=data.category,
        entry_date=data.entry_date,
        payment_method=data.payment_method,
        created_by=current_user.id,
    )
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    return {
        "id": entry.id,
        "entry_type": entry.entry_type.value,
        "amount": float(entry.amount),
    }


@router.get("/cash-ledger/summary")
async def cash_summary(
    date_from: date | None = None,
    date_to: date | None = None,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> dict[str, object]:
    query = select(
        func.coalesce(
            func.sum(
                case(
                    (CashEntry.entry_type == CashEntryType.INCOME, CashEntry.amount),
                    else_=0,
                )
            ),
            0,
        ).label("income"),
        func.coalesce(
            func.sum(
                case(
                    (CashEntry.entry_type == CashEntryType.EXPENSE, CashEntry.amount),
                    else_=0,
                )
            ),
            0,
        ).label("expense"),
    ).where(CashEntry.institution_id == current_user.institution_id)

    if date_from:
        query = query.where(CashEntry.entry_date >= date_from)
    if date_to:
        query = query.where(CashEntry.entry_date <= date_to)

    result = await db.execute(query)
    row = result.one()
    income = float(row.income)
    expense = float(row.expense)

    return {
        "total_income": income,
        "total_expense": expense,
        "balance": income - expense,
        "period_start": str(date_from) if date_from else None,
        "period_end": str(date_to) if date_to else None,
    }


# ── Financial Reports ────────────────────────────────────────────────


@router.get("/reports/financial-detailed")
async def report_financial_detailed(
    date_from: date | None = None,
    date_to: date | None = None,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> dict[str, object]:
    """Comprehensive financial report.

    Covers student income, expenses by category,
    teacher salaries, and net profit.
    """
    inst_id = current_user.institution_id

    # Student income (from payments)
    student_income_q = select(func.coalesce(func.sum(Payment.amount), 0)).where(
        Payment.institution_id == inst_id, Payment.status == PaymentStatus.PAID
    )
    if date_from:
        student_income_q = student_income_q.where(Payment.paid_date >= date_from)
    if date_to:
        student_income_q = student_income_q.where(Payment.paid_date <= date_to)
    student_income = float((await db.execute(student_income_q)).scalar() or 0)

    # Expenses by category
    expense_q = (
        select(Expense.category, func.sum(Expense.amount).label("total"))
        .where(Expense.institution_id == inst_id)
        .group_by(Expense.category)
    )
    if date_from:
        expense_q = expense_q.where(Expense.expense_date >= date_from)
    if date_to:
        expense_q = expense_q.where(Expense.expense_date <= date_to)
    expense_result = await db.execute(expense_q)
    expenses_by_category = [
        {
            "category": row.category.value
            if hasattr(row.category, "value")
            else row.category,
            "total": float(row.total),
        }
        for row in expense_result.all()
    ]
    total_expenses = sum(e["total"] for e in expenses_by_category)

    # Teacher salaries paid
    salary_q = select(func.coalesce(func.sum(TeacherPayment.total_amount), 0)).where(
        TeacherPayment.institution_id == inst_id,
        TeacherPayment.status == TeacherPaymentStatus.PAID,
    )
    if date_from:
        salary_q = salary_q.where(TeacherPayment.paid_date >= date_from)
    if date_to:
        salary_q = salary_q.where(TeacherPayment.paid_date <= date_to)
    teacher_salaries = float((await db.execute(salary_q)).scalar() or 0)

    # Net profit
    net_profit = student_income - total_expenses - teacher_salaries

    return {
        "student_income": student_income,
        "total_expenses": total_expenses,
        "expenses_by_category": expenses_by_category,
        "teacher_salaries": teacher_salaries,
        "net_profit": net_profit,
    }


# ── Password Reset ──────────────────────────────────────────────────


@router.put("/users/{user_id}/reset-password")
async def admin_reset_password(
    user_id: uuid.UUID,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    user = await db.get(User, user_id)
    if not user or user.institution_id != current_user.institution_id:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")

    temp_password = secrets.token_urlsafe(8)
    user.password_hash = hash_password(temp_password)
    await db.commit()

    return {
        "temporary_password": temp_password,
        "message": f"{user.full_name} şifresi sıfırlandı",
    }


# ── Bulk Import ─────────────────────────────────────────────────────


@router.get("/import/template/{entity_type}")
async def download_import_template(
    entity_type: str,
    current_user: User = Depends(require_role("admin")),
) -> Response:
    """Download CSV template for bulk import."""
    import csv
    import io

    if entity_type == "students":
        headers = [
            "ad_soyad",
            "email",
            "telefon",
            "tc_no",
            "dogum_tarihi",
            "cinsiyet",
            "okul",
            "kademe",
            "hedef_sinav",
            "veli_adi",
            "veli_telefon",
            "veli_yakinlik",
        ]
        example = [
            "Ali Yılmaz",
            "ali@example.com",
            "05551234567",
            "12345678901",
            "2010-05-15",
            "Erkek",
            "Atatürk Ortaokulu",
            "8. Sınıf",
            "LGS",
            "Ayşe Yılmaz",
            "05559876543",
            "Anne",
        ]
    elif entity_type == "teachers":
        headers = [
            "ad_soyad",
            "email",
            "telefon",
            "tc_no",
            "universite",
            "bolum",
            "calisma_turu",
            "maas_tipi",
            "maas_tutari",
        ]
        example = [
            "Mehmet Öz",
            "mehmet@example.com",
            "05551112233",
            "98765432101",
            "İstanbul Üniversitesi",
            "Matematik",
            "full_time",
            "fixed",
            "15000",
        ]
    else:
        raise HTTPException(
            status_code=400, detail="Geçersiz tür: students veya teachers"
        )

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(headers)
    writer.writerow(example)

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename={entity_type}_template.csv"
        },
    )


@router.post("/import/{entity_type}")
async def bulk_import(
    entity_type: str,
    file: UploadFile,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> dict[str, object]:
    """Import students or teachers from CSV file."""
    import csv
    import io

    content = await file.read()
    text = content.decode("utf-8-sig")  # Handle BOM
    reader = csv.DictReader(io.StringIO(text))

    created = 0
    errors: list[str] = []

    for i, row in enumerate(reader, start=2):  # start=2 because row 1 is header
        try:
            if entity_type == "students":
                if not row.get("ad_soyad") or not row.get("email"):
                    errors.append(f"Satır {i}: ad_soyad ve email zorunlu")
                    continue

                temp_pass = secrets.token_urlsafe(8)

                student = User(
                    email=row["email"].strip(),
                    password_hash=hash_password(temp_pass),
                    full_name=row["ad_soyad"].strip(),
                    phone=row.get("telefon", "").strip() or None,
                    role=UserRole.STUDENT,
                    institution_id=current_user.institution_id,
                    tc_no=row.get("tc_no", "").strip() or None,
                    birth_date=row.get("dogum_tarihi", "").strip() or None,
                    gender=row.get("cinsiyet", "").strip() or None,
                    school=row.get("okul", "").strip() or None,
                    grade_level=row.get("kademe", "").strip() or None,
                    target_exam=row.get("hedef_sinav", "").strip() or None,
                    enrollment_status="active",
                )
                db.add(student)
                await db.flush()

                # Create guardian if provided
                veli_adi = row.get("veli_adi", "").strip()
                veli_tel = row.get("veli_telefon", "").strip()
                if veli_adi and veli_tel:
                    guardian = Guardian(
                        student_id=student.id,
                        full_name=veli_adi,
                        phone=veli_tel,
                        relation=row.get("veli_yakinlik", "").strip() or "Veli",
                    )
                    db.add(guardian)

                created += 1

            elif entity_type == "teachers":
                if not row.get("ad_soyad") or not row.get("email"):
                    errors.append(f"Satır {i}: ad_soyad ve email zorunlu")
                    continue

                temp_pass = secrets.token_urlsafe(8)

                teacher = User(
                    email=row["email"].strip(),
                    password_hash=hash_password(temp_pass),
                    full_name=row["ad_soyad"].strip(),
                    phone=row.get("telefon", "").strip() or None,
                    role=UserRole.TEACHER,
                    institution_id=current_user.institution_id,
                    tc_no=row.get("tc_no", "").strip() or None,
                    university=row.get("universite", "").strip() or None,
                    department=row.get("bolum", "").strip() or None,
                    employment_type=row.get("calisma_turu", "").strip() or None,
                    salary_type=row.get("maas_tipi", "").strip() or None,
                    salary_amount=(
                        float(row["maas_tutari"])
                        if row.get("maas_tutari", "").strip()
                        else None
                    ),
                )
                db.add(teacher)
                created += 1

        except Exception as e:
            errors.append(f"Satır {i}: {e!s}")

    await db.commit()

    await log_action(
        db,
        institution_id=str(current_user.institution_id),
        user_id=str(current_user.id),
        action="create",
        entity_type=f"import_{entity_type}",
        description=f"Toplu içe aktarma: {created} {entity_type} oluşturuldu",
    )
    await db.commit()

    return {
        "created": created,
        "errors": errors,
        "total_rows": created + len(errors),
    }


# ── Payment Receipt ─────────────────────────────────────────────────


@router.get("/payments/{payment_id}/receipt")
async def get_payment_receipt(
    payment_id: uuid.UUID,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> dict[str, object]:
    """Get receipt data for a payment."""
    from app.models.institution import Institution

    result = await db.execute(
        select(Payment)
        .options(selectinload(Payment.student))
        .where(
            Payment.id == payment_id,
            Payment.institution_id == current_user.institution_id,
        )
    )
    payment = result.scalar_one_or_none()
    if not payment:
        raise HTTPException(status_code=404, detail="Ödeme bulunamadı")

    inst = await db.get(Institution, current_user.institution_id)

    return {
        "receipt_no": f"MKB-{str(payment.id)[:8].upper()}",
        "date": str(payment.paid_date or payment.due_date),
        "institution": {
            "name": inst.name if inst else "",
            "address": inst.address if inst else "",
            "phone": inst.phone if inst else "",
            "tax_office": inst.tax_office if inst else "",
            "tax_number": inst.tax_number if inst else "",
        },
        "student": {
            "name": payment.student.full_name,
            "email": payment.student.email,
            "tc_no": payment.student.tc_no,
            "phone": payment.student.phone,
        },
        "payment": {
            "installment_no": payment.installment_no,
            "amount": float(payment.amount),
            "payment_method": payment.payment_method,
            "status": payment.status.value,
        },
    }
