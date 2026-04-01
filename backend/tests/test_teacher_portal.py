"""Tests for teacher portal endpoints."""

import uuid
from datetime import UTC, datetime, time

import pytest
from httpx import AsyncClient

from app.models.group import Group
from app.models.private_lesson import PrivateLesson, PrivateLessonStatus
from app.models.schedule import GroupSchedule
from app.models.subject import Subject
from app.models.user import User
from tests.conftest import auth_header


@pytest.mark.asyncio
async def test_teacher_schedule_empty(client: AsyncClient, test_teacher: User) -> None:
    response = await client.get(
        "/api/v1/teacher/schedule",
        headers=auth_header(test_teacher),
    )
    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.asyncio
async def test_teacher_schedule(
    client: AsyncClient,
    test_teacher: User,
    test_group: Group,
    test_subject: Subject,
    db,
) -> None:
    schedule = GroupSchedule(
        group_id=test_group.id,
        subject_id=test_subject.id,
        teacher_id=test_teacher.id,
        day_of_week=1,
        start_time=time(9, 0),
        end_time=time(10, 0),
    )
    db.add(schedule)
    await db.flush()

    response = await client.get(
        "/api/v1/teacher/schedule",
        headers=auth_header(test_teacher),
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert data[0]["teacher_name"] == test_teacher.full_name


@pytest.mark.asyncio
async def test_teacher_groups_empty(client: AsyncClient, test_teacher: User) -> None:
    response = await client.get(
        "/api/v1/teacher/groups",
        headers=auth_header(test_teacher),
    )
    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.asyncio
async def test_teacher_groups_as_advisor(
    client: AsyncClient, test_teacher: User, test_group: Group, db
) -> None:
    test_group.advisor_id = test_teacher.id
    await db.flush()

    response = await client.get(
        "/api/v1/teacher/groups",
        headers=auth_header(test_teacher),
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert data[0]["name"] == test_group.name


@pytest.mark.asyncio
async def test_teacher_assignments_empty(
    client: AsyncClient, test_teacher: User
) -> None:
    response = await client.get(
        "/api/v1/teacher/assignments",
        headers=auth_header(test_teacher),
    )
    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.asyncio
async def test_teacher_create_assignment(
    client: AsyncClient,
    test_teacher: User,
    test_subject: Subject,
    test_group: Group,
) -> None:
    response = await client.post(
        "/api/v1/teacher/assignments",
        json={
            "title": "Matematik Odevi",
            "description": "Sayfa 45-50 arasi sorular",
            "assignment_type": "homework",
            "subject_id": str(test_subject.id),
            "due_date": "2026-04-01",
            "group_id": str(test_group.id),
        },
        headers=auth_header(test_teacher),
    )
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "Matematik Odevi"
    assert data["subject_name"] == "Matematik"
    assert data["teacher_name"] == test_teacher.full_name


@pytest.mark.asyncio
async def test_teacher_private_lessons_empty(
    client: AsyncClient, test_teacher: User
) -> None:
    response = await client.get(
        "/api/v1/teacher/private-lessons",
        headers=auth_header(test_teacher),
    )
    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.asyncio
async def test_teacher_private_lesson_complete(
    client: AsyncClient,
    test_teacher: User,
    test_student: User,
    test_subject: Subject,
    test_institution,
    db,
) -> None:
    lesson = PrivateLesson(
        teacher_id=test_teacher.id,
        student_id=test_student.id,
        subject_id=test_subject.id,
        institution_id=test_institution.id,
        scheduled_at=datetime(2026, 3, 28, 10, 0, tzinfo=UTC),
        duration_minutes=60,
        status=PrivateLessonStatus.SCHEDULED,
    )
    db.add(lesson)
    await db.flush()

    response = await client.post(
        f"/api/v1/teacher/private-lessons/{lesson.id}/complete",
        headers=auth_header(test_teacher),
    )
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


@pytest.mark.asyncio
async def test_teacher_private_lesson_cancel(
    client: AsyncClient,
    test_teacher: User,
    test_student: User,
    test_subject: Subject,
    test_institution,
    db,
) -> None:
    lesson = PrivateLesson(
        teacher_id=test_teacher.id,
        student_id=test_student.id,
        subject_id=test_subject.id,
        institution_id=test_institution.id,
        scheduled_at=datetime(2026, 3, 28, 14, 0, tzinfo=UTC),
        duration_minutes=60,
        status=PrivateLessonStatus.SCHEDULED,
    )
    db.add(lesson)
    await db.flush()

    response = await client.post(
        f"/api/v1/teacher/private-lessons/{lesson.id}/cancel",
        headers=auth_header(test_teacher),
    )
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_teacher_private_lesson_complete_not_found(
    client: AsyncClient, test_teacher: User
) -> None:
    response = await client.post(
        f"/api/v1/teacher/private-lessons/{uuid.uuid4()}/complete",
        headers=auth_header(test_teacher),
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_teacher_announcements(client: AsyncClient, test_teacher: User) -> None:
    response = await client.get(
        "/api/v1/teacher/announcements",
        headers=auth_header(test_teacher),
    )
    assert response.status_code == 200
    assert isinstance(response.json(), list)


@pytest.mark.asyncio
async def test_teacher_attendance_record(
    client: AsyncClient,
    test_teacher: User,
    test_student: User,
    test_group: Group,
    test_subject: Subject,
    db,
) -> None:
    schedule = GroupSchedule(
        group_id=test_group.id,
        subject_id=test_subject.id,
        teacher_id=test_teacher.id,
        day_of_week=2,
        start_time=time(10, 0),
        end_time=time(11, 0),
    )
    db.add(schedule)
    await db.flush()

    response = await client.post(
        "/api/v1/teacher/attendance",
        json={
            "schedule_id": str(schedule.id),
            "date": "2026-03-24",
            "entries": [
                {"student_id": str(test_student.id), "status": "present"},
            ],
        },
        headers=auth_header(test_teacher),
    )
    assert response.status_code == 201


@pytest.mark.asyncio
async def test_teacher_attendance_not_own_schedule(
    client: AsyncClient,
    test_teacher: User,
    test_student: User,
    test_group: Group,
    test_subject: Subject,
    db,
) -> None:
    """Teacher should not be able to record attendance for other teacher's schedule."""
    from app.core.security import hash_password
    from app.models.user import UserRole

    other_teacher = User(
        email="otherteacher@test.com",
        password_hash=hash_password("test123"),
        full_name="Baska Ogretmen",
        role=UserRole.TEACHER,
        institution_id=test_teacher.institution_id,
    )
    db.add(other_teacher)
    await db.flush()

    schedule = GroupSchedule(
        group_id=test_group.id,
        subject_id=test_subject.id,
        teacher_id=other_teacher.id,
        day_of_week=3,
        start_time=time(11, 0),
        end_time=time(12, 0),
    )
    db.add(schedule)
    await db.flush()

    response = await client.post(
        "/api/v1/teacher/attendance",
        json={
            "schedule_id": str(schedule.id),
            "date": "2026-03-25",
            "entries": [
                {"student_id": str(test_student.id), "status": "present"},
            ],
        },
        headers=auth_header(test_teacher),
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_teacher_attendance_history(
    client: AsyncClient, test_teacher: User
) -> None:
    response = await client.get(
        "/api/v1/teacher/attendance/history",
        headers=auth_header(test_teacher),
    )
    assert response.status_code == 200
    assert isinstance(response.json(), list)
