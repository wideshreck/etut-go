"""Tests for admin schedule CRUD endpoints."""

import uuid
from datetime import time

import pytest
from httpx import AsyncClient

from app.models.group import Group
from app.models.schedule import GroupSchedule
from app.models.subject import Subject
from app.models.user import User
from tests.conftest import auth_header


@pytest.mark.asyncio
async def test_list_schedules_empty(client: AsyncClient, test_admin: User) -> None:
    response = await client.get(
        "/api/v1/admin/schedules",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.asyncio
async def test_create_schedule(
    client: AsyncClient,
    test_admin: User,
    test_group: Group,
    test_subject: Subject,
    test_teacher: User,
) -> None:
    response = await client.post(
        "/api/v1/admin/schedules",
        json={
            "group_id": str(test_group.id),
            "subject_id": str(test_subject.id),
            "teacher_id": str(test_teacher.id),
            "classroom": "Derslik 1",
            "day_of_week": 1,
            "start_time": "09:00",
            "end_time": "10:00",
        },
        headers=auth_header(test_admin),
    )
    assert response.status_code == 201
    data = response.json()
    assert data["group_name"] == test_group.name
    assert data["subject_name"] == test_subject.name
    assert data["teacher_name"] == test_teacher.full_name
    assert data["classroom"] == "Derslik 1"
    assert data["day_of_week"] == 1


@pytest.mark.asyncio
async def test_create_schedule_teacher_conflict(
    client: AsyncClient,
    test_admin: User,
    test_group: Group,
    test_subject: Subject,
    test_teacher: User,
    db,
) -> None:
    # Create a second group for a different schedule
    group2 = Group(
        name="9-A",
        grade_level="9",
        academic_year="2025-2026",
        institution_id=test_admin.institution_id,
    )
    db.add(group2)
    await db.flush()

    # Create first schedule
    schedule = GroupSchedule(
        group_id=test_group.id,
        subject_id=test_subject.id,
        teacher_id=test_teacher.id,
        day_of_week=2,
        start_time=time(9, 0),
        end_time=time(10, 0),
    )
    db.add(schedule)
    await db.flush()

    # Try to create conflicting schedule (same teacher, same time)
    response = await client.post(
        "/api/v1/admin/schedules",
        json={
            "group_id": str(group2.id),
            "subject_id": str(test_subject.id),
            "teacher_id": str(test_teacher.id),
            "day_of_week": 2,
            "start_time": "09:30",
            "end_time": "10:30",
        },
        headers=auth_header(test_admin),
    )
    assert response.status_code == 409


@pytest.mark.asyncio
async def test_create_schedule_classroom_conflict(
    client: AsyncClient,
    test_admin: User,
    test_group: Group,
    test_subject: Subject,
    test_teacher: User,
    db,
) -> None:
    # Create a second group and teacher
    group2 = Group(
        name="10-A",
        grade_level="10",
        academic_year="2025-2026",
        institution_id=test_admin.institution_id,
    )
    db.add(group2)

    from app.core.security import hash_password
    from app.models.user import UserRole

    teacher2 = User(
        email="teacher2@test.com",
        password_hash=hash_password("test123"),
        full_name="Ikinci Ogretmen",
        role=UserRole.TEACHER,
        institution_id=test_admin.institution_id,
    )
    db.add(teacher2)
    await db.flush()

    # Create first schedule with a classroom
    schedule = GroupSchedule(
        group_id=test_group.id,
        subject_id=test_subject.id,
        teacher_id=test_teacher.id,
        classroom="Lab-1",
        day_of_week=3,
        start_time=time(9, 0),
        end_time=time(10, 0),
    )
    db.add(schedule)
    await db.flush()

    # Try to create conflicting schedule (same classroom, overlapping time)
    response = await client.post(
        "/api/v1/admin/schedules",
        json={
            "group_id": str(group2.id),
            "subject_id": str(test_subject.id),
            "teacher_id": str(teacher2.id),
            "classroom": "Lab-1",
            "day_of_week": 3,
            "start_time": "09:30",
            "end_time": "10:30",
        },
        headers=auth_header(test_admin),
    )
    assert response.status_code == 409


@pytest.mark.asyncio
async def test_delete_schedule(
    client: AsyncClient,
    test_admin: User,
    test_group: Group,
    test_subject: Subject,
    test_teacher: User,
    db,
) -> None:
    schedule = GroupSchedule(
        group_id=test_group.id,
        subject_id=test_subject.id,
        teacher_id=test_teacher.id,
        day_of_week=4,
        start_time=time(14, 0),
        end_time=time(15, 0),
    )
    db.add(schedule)
    await db.flush()

    response = await client.delete(
        f"/api/v1/admin/schedules/{schedule.id}",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 204


@pytest.mark.asyncio
async def test_delete_schedule_not_found(client: AsyncClient, test_admin: User) -> None:
    response = await client.delete(
        f"/api/v1/admin/schedules/{uuid.uuid4()}",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_list_schedules_filter_by_group(
    client: AsyncClient,
    test_admin: User,
    test_group: Group,
    test_subject: Subject,
    test_teacher: User,
    db,
) -> None:
    schedule = GroupSchedule(
        group_id=test_group.id,
        subject_id=test_subject.id,
        teacher_id=test_teacher.id,
        day_of_week=5,
        start_time=time(10, 0),
        end_time=time(11, 0),
    )
    db.add(schedule)
    await db.flush()

    response = await client.get(
        f"/api/v1/admin/schedules?group_id={test_group.id}",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert all(str(s["group_id"]) == str(test_group.id) for s in data)
