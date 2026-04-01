"""Push for 70% coverage -- test more admin list responses with data."""

from datetime import UTC, date, datetime, time

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.attendance import Attendance, AttendanceStatus
from app.models.group import Group
from app.models.payment import Payment, PaymentStatus
from app.models.schedule import GroupSchedule
from app.models.subject import Subject
from app.models.teacher_payment import TeacherPayment
from app.models.user import User
from tests.conftest import auth_header


@pytest.mark.asyncio
async def test_admin_list_payments_with_student_name(
    client: AsyncClient, test_admin: User, test_student: User, db: AsyncSession
) -> None:
    """Exercise the payment list comprehension that accesses p.student.full_name."""
    p = Payment(
        student_id=test_student.id,
        institution_id=test_admin.institution_id,
        installment_no=1,
        amount=7500,
        due_date=date(2026, 6, 1),
        status=PaymentStatus.PENDING,
    )
    db.add(p)
    await db.commit()

    resp = await client.get(
        "/api/v1/admin/payments",
        headers=auth_header(test_admin),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 1
    assert data[0]["student_name"] == "Test Ogrenci"
    assert data[0]["installment_no"] == 1


@pytest.mark.asyncio
async def test_admin_list_teacher_payments_with_data(
    client: AsyncClient, test_admin: User, test_teacher: User, db: AsyncSession
) -> None:
    tp = TeacherPayment(
        teacher_id=test_teacher.id,
        institution_id=test_admin.institution_id,
        period="2026-04",
        base_salary=10000,
        total_amount=10000,
    )
    db.add(tp)
    await db.commit()

    resp = await client.get(
        "/api/v1/admin/teacher-payments",
        headers=auth_header(test_admin),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 1
    assert data[0]["teacher_name"] == "Test Ogretmen"


@pytest.mark.asyncio
async def test_admin_financial_monthly_with_data(
    client: AsyncClient, test_admin: User, test_student: User, db: AsyncSession
) -> None:
    """Monthly financial report needs payment data."""
    p = Payment(
        student_id=test_student.id,
        institution_id=test_admin.institution_id,
        installment_no=1,
        amount=4000,
        due_date=date(2026, 3, 1),
        status=PaymentStatus.PAID,
        paid_date=date(2026, 3, 5),
    )
    db.add(p)
    await db.commit()

    resp = await client.get(
        "/api/v1/admin/reports/financial-monthly",
        headers=auth_header(test_admin),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 1
    assert data[0]["expected"] > 0


@pytest.mark.asyncio
async def test_admin_attendance_by_group_with_data(
    client: AsyncClient,
    test_admin: User,
    test_student: User,
    test_teacher: User,
    test_group: Group,
    test_subject: Subject,
    db: AsyncSession,
) -> None:
    sched = GroupSchedule(
        group_id=test_group.id,
        subject_id=test_subject.id,
        teacher_id=test_teacher.id,
        day_of_week=1,
        start_time=time(9, 0),
        end_time=time(10, 0),
    )
    db.add(sched)
    await db.flush()

    att = Attendance(
        schedule_id=sched.id,
        student_id=test_student.id,
        date=date(2026, 3, 23),
        status=AttendanceStatus.PRESENT,
        noted_by=test_admin.id,
    )
    db.add(att)
    await db.commit()

    resp = await client.get(
        "/api/v1/admin/reports/attendance-by-group",
        headers=auth_header(test_admin),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 1
    assert data[0]["total_records"] >= 1


@pytest.mark.asyncio
async def test_admin_student_enrollment_with_data(
    client: AsyncClient, test_admin: User, test_student: User
) -> None:
    resp = await client.get(
        "/api/v1/admin/reports/student-enrollment",
        headers=auth_header(test_admin),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["by_grade"]) >= 1
    assert len(data["by_exam"]) >= 1
    assert len(data["by_status"]) >= 1


@pytest.mark.asyncio
async def test_teacher_group_students(
    client: AsyncClient,
    test_teacher: User,
    test_student: User,
    test_group: Group,
    db: AsyncSession,
) -> None:
    """Teacher sees students in their advised group."""
    from app.models.group import group_students

    test_group.advisor_id = test_teacher.id
    await db.flush()

    await db.execute(
        group_students.insert().values(
            group_id=test_group.id, student_id=test_student.id
        )
    )
    await db.commit()

    resp = await client.get(
        f"/api/v1/teacher/groups/{test_group.id}/students",
        headers=auth_header(test_teacher),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 1


@pytest.mark.asyncio
async def test_parent_child_payments_with_data(
    client: AsyncClient,
    test_parent: User,
    test_student: User,
    test_institution,
    db: AsyncSession,
) -> None:
    from app.models.guardian import Guardian

    guardian = Guardian(
        student_id=test_student.id,
        full_name="Pay Veli",
        relation="Baba",
        phone="5550001111",
        user_id=test_parent.id,
    )
    db.add(guardian)

    p = Payment(
        student_id=test_student.id,
        institution_id=test_institution.id,
        installment_no=1,
        amount=3000,
        due_date=date(2026, 4, 1),
        status=PaymentStatus.PENDING,
    )
    db.add(p)
    await db.commit()

    resp = await client.get(
        "/api/v1/parent/payments",
        headers=auth_header(test_parent),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 1
    assert data[0]["amount"] == 3000


@pytest.mark.asyncio
async def test_student_payments_with_data(
    client: AsyncClient, test_student: User, db: AsyncSession
) -> None:
    p = Payment(
        student_id=test_student.id,
        institution_id=test_student.institution_id,
        installment_no=1,
        amount=2500,
        due_date=date(2026, 5, 1),
        status=PaymentStatus.PENDING,
    )
    db.add(p)
    await db.commit()

    resp = await client.get(
        "/api/v1/student/payments",
        headers=auth_header(test_student),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 1
    assert data[0]["amount"] == 2500


@pytest.mark.asyncio
async def test_teacher_private_lessons_with_data(
    client: AsyncClient,
    test_teacher: User,
    test_student: User,
    test_subject: Subject,
    test_institution,
    db: AsyncSession,
) -> None:
    from app.models.private_lesson import PrivateLesson

    pl = PrivateLesson(
        teacher_id=test_teacher.id,
        student_id=test_student.id,
        subject_id=test_subject.id,
        institution_id=test_institution.id,
        scheduled_at=datetime(2026, 4, 10, 14, 0, tzinfo=UTC),
        duration_minutes=60,
    )
    db.add(pl)
    await db.commit()

    resp = await client.get(
        "/api/v1/teacher/private-lessons",
        headers=auth_header(test_teacher),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 1
    assert data[0]["teacher_name"] == "Test Ogretmen"
    assert data[0]["student_name"] == "Test Ogrenci"


@pytest.mark.asyncio
async def test_student_private_lessons_with_data(
    client: AsyncClient,
    test_student: User,
    test_teacher: User,
    test_subject: Subject,
    test_institution,
    db: AsyncSession,
) -> None:
    from app.models.private_lesson import PrivateLesson

    pl = PrivateLesson(
        teacher_id=test_teacher.id,
        student_id=test_student.id,
        subject_id=test_subject.id,
        institution_id=test_institution.id,
        scheduled_at=datetime(2026, 4, 15, 10, 0, tzinfo=UTC),
        duration_minutes=60,
    )
    db.add(pl)
    await db.commit()

    resp = await client.get(
        "/api/v1/student/private-lessons",
        headers=auth_header(test_student),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 1
