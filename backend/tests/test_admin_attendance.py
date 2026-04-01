"""Tests for admin attendance endpoints."""

from datetime import time

import pytest
from httpx import AsyncClient

from app.models.group import Group
from app.models.schedule import GroupSchedule
from app.models.subject import Subject
from app.models.user import User
from tests.conftest import auth_header


@pytest.fixture
async def schedule_fixture(
    db, test_group: Group, test_subject: Subject, test_teacher: User
) -> GroupSchedule:
    """Create a schedule for attendance tests."""
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
    await db.refresh(schedule)
    return schedule


@pytest.mark.asyncio
async def test_record_attendance(
    client: AsyncClient,
    test_admin: User,
    test_student: User,
    schedule_fixture: GroupSchedule,
) -> None:
    response = await client.post(
        "/api/v1/admin/attendance",
        json={
            "schedule_id": str(schedule_fixture.id),
            "date": "2026-03-23",
            "entries": [
                {
                    "student_id": str(test_student.id),
                    "status": "present",
                    "note": "Zamaninda geldi",
                },
            ],
        },
        headers=auth_header(test_admin),
    )
    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "ok"
    assert data["count"] == "1"


@pytest.mark.asyncio
async def test_record_attendance_retake(
    client: AsyncClient,
    test_admin: User,
    test_student: User,
    schedule_fixture: GroupSchedule,
) -> None:
    """Recording attendance for the same schedule+date should replace previous."""
    # First record
    await client.post(
        "/api/v1/admin/attendance",
        json={
            "schedule_id": str(schedule_fixture.id),
            "date": "2026-03-24",
            "entries": [
                {"student_id": str(test_student.id), "status": "absent"},
            ],
        },
        headers=auth_header(test_admin),
    )

    # Retake - should override
    response = await client.post(
        "/api/v1/admin/attendance",
        json={
            "schedule_id": str(schedule_fixture.id),
            "date": "2026-03-24",
            "entries": [
                {"student_id": str(test_student.id), "status": "present"},
            ],
        },
        headers=auth_header(test_admin),
    )
    assert response.status_code == 201


@pytest.mark.asyncio
async def test_list_attendance(
    client: AsyncClient,
    test_admin: User,
    test_student: User,
    schedule_fixture: GroupSchedule,
) -> None:
    # Record attendance first
    await client.post(
        "/api/v1/admin/attendance",
        json={
            "schedule_id": str(schedule_fixture.id),
            "date": "2026-03-25",
            "entries": [
                {"student_id": str(test_student.id), "status": "late"},
            ],
        },
        headers=auth_header(test_admin),
    )

    response = await client.get(
        "/api/v1/admin/attendance",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert data[0]["student_name"] == test_student.full_name


@pytest.mark.asyncio
async def test_list_attendance_filter_by_date(
    client: AsyncClient,
    test_admin: User,
    test_student: User,
    schedule_fixture: GroupSchedule,
) -> None:
    await client.post(
        "/api/v1/admin/attendance",
        json={
            "schedule_id": str(schedule_fixture.id),
            "date": "2026-03-26",
            "entries": [
                {"student_id": str(test_student.id), "status": "present"},
            ],
        },
        headers=auth_header(test_admin),
    )

    response = await client.get(
        "/api/v1/admin/attendance?date_from=2026-03-26&date_to=2026-03-26",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    data = response.json()
    assert all(r["date"] == "2026-03-26" for r in data)


@pytest.mark.asyncio
async def test_attendance_summary(
    client: AsyncClient,
    test_admin: User,
    test_student: User,
    test_group: Group,
    schedule_fixture: GroupSchedule,
) -> None:
    # Record some attendance
    await client.post(
        "/api/v1/admin/attendance",
        json={
            "schedule_id": str(schedule_fixture.id),
            "date": "2026-03-20",
            "entries": [
                {"student_id": str(test_student.id), "status": "present"},
            ],
        },
        headers=auth_header(test_admin),
    )
    await client.post(
        "/api/v1/admin/attendance",
        json={
            "schedule_id": str(schedule_fixture.id),
            "date": "2026-03-21",
            "entries": [
                {"student_id": str(test_student.id), "status": "absent"},
            ],
        },
        headers=auth_header(test_admin),
    )

    response = await client.get(
        f"/api/v1/admin/attendance/summary?group_id={test_group.id}",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    student_summary = data[0]
    assert student_summary["student_name"] == test_student.full_name
    assert student_summary["total_lessons"] >= 2
    assert "attendance_rate" in student_summary
