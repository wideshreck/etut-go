"""Additional admin endpoint tests for improved coverage."""

import uuid
from datetime import date, time

import pytest
from httpx import AsyncClient

from app.models.group import Group
from app.models.payment import Payment, PaymentStatus
from app.models.private_lesson import PrivateLesson
from app.models.schedule import GroupSchedule
from app.models.subject import Subject
from app.models.user import User
from tests.conftest import auth_header


@pytest.mark.asyncio
async def test_admin_create_student_then_list(
    client: AsyncClient, test_admin: User
) -> None:
    """Integration: create student via API then verify in list."""
    response = await client.post(
        "/api/v1/admin/students",
        json={
            "email": "integration@test.com",
            "password": "pass123",
            "full_name": "Integration Student",
            "grade_level": "10",
            "target_exam": "YKS-Sayisal",
            "enrollment_status": "active",
        },
        headers=auth_header(test_admin),
    )
    assert response.status_code == 201
    student_id = response.json()["id"]

    # List and filter by target exam
    response = await client.get(
        "/api/v1/admin/students?target_exam=YKS-Sayisal",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    data = response.json()
    assert any(s["id"] == student_id for s in data)


@pytest.mark.asyncio
async def test_admin_update_schedule(
    client: AsyncClient,
    test_admin: User,
    test_group: Group,
    test_subject: Subject,
    test_teacher: User,
) -> None:
    """Create a schedule then update it."""
    # Create
    resp = await client.post(
        "/api/v1/admin/schedules",
        json={
            "group_id": str(test_group.id),
            "subject_id": str(test_subject.id),
            "teacher_id": str(test_teacher.id),
            "day_of_week": 1,
            "start_time": "08:00",
            "end_time": "09:00",
            "classroom": "A-101",
        },
        headers=auth_header(test_admin),
    )
    assert resp.status_code == 201
    schedule_id = resp.json()["id"]

    # Update
    resp = await client.put(
        f"/api/v1/admin/schedules/{schedule_id}",
        json={"classroom": "B-202"},
        headers=auth_header(test_admin),
    )
    assert resp.status_code == 200
    assert resp.json()["classroom"] == "B-202"


@pytest.mark.asyncio
async def test_admin_update_schedule_not_found(
    client: AsyncClient, test_admin: User
) -> None:
    response = await client.put(
        f"/api/v1/admin/schedules/{uuid.uuid4()}",
        json={"classroom": "X"},
        headers=auth_header(test_admin),
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_admin_list_private_lessons_with_data(
    client: AsyncClient,
    test_admin: User,
    test_teacher: User,
    test_student: User,
    test_subject: Subject,
    test_institution,
    db,
) -> None:
    from datetime import UTC, datetime

    pl = PrivateLesson(
        teacher_id=test_teacher.id,
        student_id=test_student.id,
        subject_id=test_subject.id,
        institution_id=test_institution.id,
        scheduled_at=datetime(2026, 4, 1, 10, 0, tzinfo=UTC),
        duration_minutes=60,
    )
    db.add(pl)
    await db.commit()

    response = await client.get(
        "/api/v1/admin/private-lessons",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1


@pytest.mark.asyncio
async def test_admin_list_payments_with_data(
    client: AsyncClient, test_admin: User, test_student: User, db
) -> None:
    p = Payment(
        student_id=test_student.id,
        institution_id=test_admin.institution_id,
        installment_no=1,
        amount=5000,
        due_date=date(2026, 5, 1),
        status=PaymentStatus.PENDING,
    )
    db.add(p)
    await db.commit()

    response = await client.get(
        "/api/v1/admin/payments",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert data[0]["student_name"] == test_student.full_name


@pytest.mark.asyncio
async def test_admin_list_teachers_with_data(
    client: AsyncClient, test_admin: User, test_teacher: User
) -> None:
    response = await client.get(
        "/api/v1/admin/teachers",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    # Verify password_hash is not exposed
    assert "password_hash" not in data[0]


@pytest.mark.asyncio
async def test_admin_list_students_with_data(
    client: AsyncClient, test_admin: User, test_student: User
) -> None:
    response = await client.get(
        "/api/v1/admin/students",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert "password_hash" not in data[0]


@pytest.mark.asyncio
async def test_admin_list_groups_with_data(
    client: AsyncClient, test_admin: User, test_group: Group
) -> None:
    response = await client.get(
        "/api/v1/admin/groups",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert data[0]["name"] == "8-A"


@pytest.mark.asyncio
async def test_admin_list_schedules_with_data(
    client: AsyncClient,
    test_admin: User,
    test_group: Group,
    test_subject: Subject,
    test_teacher: User,
    db,
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
    await db.commit()

    response = await client.get(
        "/api/v1/admin/schedules",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert data[0]["group_name"] == "8-A"
    assert data[0]["subject_name"] == "Matematik"


@pytest.mark.asyncio
async def test_admin_list_announcements_with_data(
    client: AsyncClient, test_admin: User
) -> None:
    # Create then list
    await client.post(
        "/api/v1/admin/announcements",
        json={
            "title": "Coverage Duyuru",
            "content": "Icerik",
        },
        headers=auth_header(test_admin),
    )

    response = await client.get(
        "/api/v1/admin/announcements",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert data[0]["author_name"] == "Test Admin"
