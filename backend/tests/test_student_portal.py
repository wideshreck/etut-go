"""Tests for student portal endpoints."""

import uuid
from datetime import UTC, datetime, time, timedelta

import pytest
from httpx import AsyncClient

from app.models.private_lesson import PrivateLesson, PrivateLessonStatus
from app.models.subject import Subject
from app.models.user import User
from tests.conftest import auth_header


@pytest.mark.asyncio
async def test_student_schedule_no_group(
    client: AsyncClient, test_student: User
) -> None:
    """Student without a group should get empty schedule."""
    response = await client.get(
        "/api/v1/student/schedule",
        headers=auth_header(test_student),
    )
    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.asyncio
async def test_student_schedule_with_group(
    client: AsyncClient, test_student: User, test_group, test_subject, test_teacher, db
) -> None:
    from app.models.schedule import GroupSchedule

    test_student.group_id = test_group.id
    await db.flush()

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
        "/api/v1/student/schedule",
        headers=auth_header(test_student),
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1


@pytest.mark.asyncio
async def test_student_private_lessons_empty(
    client: AsyncClient, test_student: User
) -> None:
    response = await client.get(
        "/api/v1/student/private-lessons",
        headers=auth_header(test_student),
    )
    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.asyncio
async def test_student_credits_no_credits(
    client: AsyncClient, test_student: User
) -> None:
    response = await client.get(
        "/api/v1/student/credits",
        headers=auth_header(test_student),
    )
    assert response.status_code == 200
    data = response.json()
    assert data["weekly_credits"] == 0
    assert data["remaining_this_week"] == 0


@pytest.mark.asyncio
async def test_student_credits_with_credits(
    client: AsyncClient, test_student: User, db
) -> None:
    test_student.weekly_credits = 3
    test_student.credit_duration = 60
    await db.flush()

    response = await client.get(
        "/api/v1/student/credits",
        headers=auth_header(test_student),
    )
    assert response.status_code == 200
    data = response.json()
    assert data["weekly_credits"] == 3
    assert data["credit_duration"] == 60
    assert data["remaining_this_week"] == 3


@pytest.mark.asyncio
async def test_student_book_private_lesson_no_credits(
    client: AsyncClient, test_student: User, test_teacher: User, test_subject: Subject
) -> None:
    response = await client.post(
        "/api/v1/student/private-lessons/book",
        json={
            "teacher_id": str(test_teacher.id),
            "subject_id": str(test_subject.id),
            "scheduled_at": "2026-04-01T10:00:00+00:00",
        },
        headers=auth_header(test_student),
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_student_book_private_lesson(
    client: AsyncClient,
    test_student: User,
    test_teacher: User,
    test_subject: Subject,
    db,
) -> None:
    test_student.weekly_credits = 5
    test_student.credit_duration = 60
    await db.flush()

    response = await client.post(
        "/api/v1/student/private-lessons/book",
        json={
            "teacher_id": str(test_teacher.id),
            "subject_id": str(test_subject.id),
            "scheduled_at": "2026-04-01T10:00:00+00:00",
            "notes": "Trigonometri konusu",
        },
        headers=auth_header(test_student),
    )
    assert response.status_code == 201
    data = response.json()
    assert data["teacher_name"] == test_teacher.full_name
    assert data["student_name"] == test_student.full_name
    assert data["status"] == "scheduled"
    assert data["notes"] == "Trigonometri konusu"


@pytest.mark.asyncio
async def test_student_cancel_private_lesson(
    client: AsyncClient,
    test_student: User,
    test_teacher: User,
    test_subject: Subject,
    test_institution,
    db,
) -> None:
    # Schedule a lesson far in the future (>24h)
    future = datetime.now(tz=UTC) + timedelta(days=3)
    lesson = PrivateLesson(
        teacher_id=test_teacher.id,
        student_id=test_student.id,
        subject_id=test_subject.id,
        institution_id=test_institution.id,
        scheduled_at=future,
        duration_minutes=60,
        status=PrivateLessonStatus.SCHEDULED,
    )
    db.add(lesson)
    await db.flush()

    response = await client.post(
        f"/api/v1/student/private-lessons/{lesson.id}/cancel",
        headers=auth_header(test_student),
    )
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


@pytest.mark.asyncio
async def test_student_cancel_private_lesson_too_late(
    client: AsyncClient,
    test_student: User,
    test_teacher: User,
    test_subject: Subject,
    test_institution,
    db,
) -> None:
    """Cannot cancel within 24 hours of the lesson."""
    soon = datetime.now(tz=UTC) + timedelta(hours=2)
    lesson = PrivateLesson(
        teacher_id=test_teacher.id,
        student_id=test_student.id,
        subject_id=test_subject.id,
        institution_id=test_institution.id,
        scheduled_at=soon,
        duration_minutes=60,
        status=PrivateLessonStatus.SCHEDULED,
    )
    db.add(lesson)
    await db.flush()

    response = await client.post(
        f"/api/v1/student/private-lessons/{lesson.id}/cancel",
        headers=auth_header(test_student),
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_student_cancel_private_lesson_not_found(
    client: AsyncClient, test_student: User
) -> None:
    response = await client.post(
        f"/api/v1/student/private-lessons/{uuid.uuid4()}/cancel",
        headers=auth_header(test_student),
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_student_assignments_empty(
    client: AsyncClient, test_student: User
) -> None:
    response = await client.get(
        "/api/v1/student/assignments",
        headers=auth_header(test_student),
    )
    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.asyncio
async def test_student_attendance(client: AsyncClient, test_student: User) -> None:
    response = await client.get(
        "/api/v1/student/attendance",
        headers=auth_header(test_student),
    )
    assert response.status_code == 200
    data = response.json()
    assert "summary" in data
    assert "recent" in data
    assert data["summary"]["total"] == 0


@pytest.mark.asyncio
async def test_student_announcements(client: AsyncClient, test_student: User) -> None:
    response = await client.get(
        "/api/v1/student/announcements",
        headers=auth_header(test_student),
    )
    assert response.status_code == 200
    assert isinstance(response.json(), list)


@pytest.mark.asyncio
async def test_student_payments_empty(client: AsyncClient, test_student: User) -> None:
    response = await client.get(
        "/api/v1/student/payments",
        headers=auth_header(test_student),
    )
    assert response.status_code == 200
    assert response.json() == []
