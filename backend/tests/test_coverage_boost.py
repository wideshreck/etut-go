"""Extra tests to boost coverage on key code paths."""

from datetime import date, time

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.attendance import Attendance, AttendanceStatus
from app.models.group import Group
from app.models.payment import Payment, PaymentStatus
from app.models.schedule import GroupSchedule
from app.models.subject import Subject
from app.models.user import User
from tests.conftest import auth_header


@pytest.mark.asyncio
async def test_dashboard_with_data(
    client: AsyncClient,
    test_admin: User,
    test_student: User,
    test_teacher: User,
    test_group: Group,
    test_subject: Subject,
    db: AsyncSession,
) -> None:
    """Dashboard should return populated counts and financial data."""
    # Create some payments
    p1 = Payment(
        student_id=test_student.id,
        institution_id=test_admin.institution_id,
        installment_no=1,
        amount=5000,
        due_date=date(2026, 1, 1),
        status=PaymentStatus.PAID,
        paid_date=date(2026, 1, 5),
    )
    p2 = Payment(
        student_id=test_student.id,
        institution_id=test_admin.institution_id,
        installment_no=2,
        amount=5000,
        due_date=date(2026, 2, 1),
        status=PaymentStatus.PENDING,
    )
    db.add_all([p1, p2])
    await db.commit()

    response = await client.get(
        "/api/v1/admin/dashboard",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    data = response.json()
    assert data["student_count"] >= 1
    assert data["teacher_count"] >= 1
    assert data["total_revenue"] >= 10000
    assert data["total_collected"] >= 5000
    assert len(data["recent_payments"]) >= 1
    assert len(data["upcoming_payments"]) >= 1


@pytest.mark.asyncio
async def test_superadmin_dashboard_with_data(
    client: AsyncClient,
    test_superadmin: User,
    test_institution,
    test_student: User,
    test_teacher: User,
) -> None:
    response = await client.get(
        "/api/v1/superadmin/dashboard",
        headers=auth_header(test_superadmin),
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    inst_data = data[0]
    assert inst_data["student_count"] >= 1
    assert inst_data["teacher_count"] >= 1


@pytest.mark.asyncio
async def test_superadmin_create_then_get_then_update_delete(
    client: AsyncClient, test_superadmin: User
) -> None:
    """Full lifecycle of an institution via superadmin."""
    # Create
    resp = await client.post(
        "/api/v1/superadmin/institutions",
        json={"name": "Lifecycle Kurum", "address": "Addr"},
        headers=auth_header(test_superadmin),
    )
    assert resp.status_code == 201
    inst_id = resp.json()["id"]

    # Get
    resp = await client.get(
        f"/api/v1/superadmin/institutions/{inst_id}",
        headers=auth_header(test_superadmin),
    )
    assert resp.status_code == 200

    # Update
    resp = await client.put(
        f"/api/v1/superadmin/institutions/{inst_id}",
        json={"name": "Updated Kurum"},
        headers=auth_header(test_superadmin),
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "Updated Kurum"

    # Create admin for it
    resp = await client.post(
        f"/api/v1/superadmin/institutions/{inst_id}/admin",
        json={
            "email": "lifecycle-admin@test.com",
            "password": "pass123",
            "full_name": "Lifecycle Admin",
        },
        headers=auth_header(test_superadmin),
    )
    assert resp.status_code == 201

    # Delete
    resp = await client.delete(
        f"/api/v1/superadmin/institutions/{inst_id}",
        headers=auth_header(test_superadmin),
    )
    assert resp.status_code == 204


@pytest.mark.asyncio
async def test_reports_overview_with_data(
    client: AsyncClient,
    test_admin: User,
    test_student: User,
    test_teacher: User,
    test_group: Group,
    test_subject: Subject,
    db: AsyncSession,
) -> None:
    """Reports overview with actual attendance and payment data."""
    # Add a schedule and attendance
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

    p = Payment(
        student_id=test_student.id,
        institution_id=test_admin.institution_id,
        installment_no=1,
        amount=3000,
        due_date=date(2026, 3, 1),
        status=PaymentStatus.PAID,
        paid_date=date(2026, 3, 5),
    )
    db.add(p)
    await db.commit()

    response = await client.get(
        "/api/v1/admin/reports/overview",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    data = response.json()
    assert data["students"]["total"] >= 1
    assert data["attendance_rate_30d"] > 0


@pytest.mark.asyncio
async def test_teacher_delete_assignment(
    client: AsyncClient,
    test_teacher: User,
    test_subject: Subject,
    test_group: Group,
) -> None:
    """Create and then delete an assignment as teacher."""
    resp = await client.post(
        "/api/v1/teacher/assignments",
        json={
            "title": "Silinecek Odev",
            "assignment_type": "homework",
            "subject_id": str(test_subject.id),
            "due_date": "2026-05-01",
            "group_id": str(test_group.id),
        },
        headers=auth_header(test_teacher),
    )
    assert resp.status_code == 201
    assignment_id = resp.json()["id"]

    resp = await client.delete(
        f"/api/v1/teacher/assignments/{assignment_id}",
        headers=auth_header(test_teacher),
    )
    assert resp.status_code == 204


@pytest.mark.asyncio
async def test_teacher_update_assignment(
    client: AsyncClient,
    test_teacher: User,
    test_subject: Subject,
    test_group: Group,
) -> None:
    resp = await client.post(
        "/api/v1/teacher/assignments",
        json={
            "title": "Guncellenecek Odev",
            "assignment_type": "test",
            "subject_id": str(test_subject.id),
            "due_date": "2026-05-10",
            "group_id": str(test_group.id),
        },
        headers=auth_header(test_teacher),
    )
    assert resp.status_code == 201
    assignment_id = resp.json()["id"]

    resp = await client.put(
        f"/api/v1/teacher/assignments/{assignment_id}",
        json={"title": "Guncellenmis Odev", "description": "Yeni aciklama"},
        headers=auth_header(test_teacher),
    )
    assert resp.status_code == 200
    assert resp.json()["title"] == "Guncellenmis Odev"


@pytest.mark.asyncio
async def test_parent_schedule_with_group(
    client: AsyncClient,
    test_parent: User,
    test_student: User,
    test_group: Group,
    test_subject: Subject,
    test_teacher: User,
    db: AsyncSession,
) -> None:
    """Parent should see child's schedule when child has a group."""
    from app.models.guardian import Guardian

    # Link parent to student
    guardian = Guardian(
        student_id=test_student.id,
        full_name=test_parent.full_name,
        relation="Anne",
        phone="5550001111",
        user_id=test_parent.id,
    )
    db.add(guardian)

    # Set student's group
    test_student.group_id = test_group.id
    await db.flush()

    # Add a schedule
    sched = GroupSchedule(
        group_id=test_group.id,
        subject_id=test_subject.id,
        teacher_id=test_teacher.id,
        day_of_week=2,
        start_time=time(10, 0),
        end_time=time(11, 0),
    )
    db.add(sched)
    await db.commit()

    response = await client.get(
        "/api/v1/parent/schedule",
        headers=auth_header(test_parent),
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
