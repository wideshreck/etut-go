"""Final coverage boost tests -- exercise list comprehensions with data."""

from datetime import date, time

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.attendance import Attendance, AttendanceStatus
from app.models.group import Group
from app.models.schedule import GroupSchedule
from app.models.subject import Subject
from app.models.user import User
from tests.conftest import auth_header


@pytest.mark.asyncio
async def test_admin_teacher_crud_full_lifecycle(
    client: AsyncClient, test_admin: User, test_subject: Subject
) -> None:
    """Create, list, update, and delete a teacher via the API."""
    # Create
    resp = await client.post(
        "/api/v1/admin/teachers",
        json={
            "email": "lifecycle_t@test.com",
            "password": "pass123",
            "full_name": "Lifecycle Ogretmen",
            "subject_id": str(test_subject.id),
            "employment_type": "full_time",
            "salary_type": "monthly",
            "salary_amount": 15000,
        },
        headers=auth_header(test_admin),
    )
    assert resp.status_code == 201
    teacher_id = resp.json()["id"]
    assert resp.json()["subject_name"] == "Matematik"

    # List (should see the teacher)
    resp = await client.get(
        "/api/v1/admin/teachers",
        headers=auth_header(test_admin),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 1
    t = next(t for t in data if t["id"] == teacher_id)
    assert t["employment_type"] == "full_time"

    # Update
    resp = await client.put(
        f"/api/v1/admin/teachers/{teacher_id}",
        json={"full_name": "Updated Teacher"},
        headers=auth_header(test_admin),
    )
    assert resp.status_code == 200

    # Delete
    resp = await client.delete(
        f"/api/v1/admin/teachers/{teacher_id}",
        headers=auth_header(test_admin),
    )
    assert resp.status_code == 204


@pytest.mark.asyncio
async def test_admin_student_crud_full_lifecycle(
    client: AsyncClient, test_admin: User
) -> None:
    """Create, list, update, delete a student."""
    resp = await client.post(
        "/api/v1/admin/students",
        json={
            "email": "lifecycle_s@test.com",
            "password": "pass123",
            "full_name": "Lifecycle Ogrenci",
            "grade_level": "11",
            "enrollment_status": "active",
            "guardians": [
                {"full_name": "Veli A", "relation": "Anne", "phone": "5551112233"},
            ],
        },
        headers=auth_header(test_admin),
    )
    assert resp.status_code == 201
    student_id = resp.json()["id"]
    assert len(resp.json()["guardians"]) == 1

    # Update with new guardians
    resp = await client.put(
        f"/api/v1/admin/students/{student_id}",
        json={
            "guardians": [
                {"full_name": "Veli B", "relation": "Baba", "phone": "5554445566"},
            ]
        },
        headers=auth_header(test_admin),
    )
    assert resp.status_code == 200
    assert len(resp.json()["guardians"]) == 1
    assert resp.json()["guardians"][0]["full_name"] == "Veli B"

    # Get student payments
    resp = await client.get(
        f"/api/v1/admin/students/{student_id}/payments",
        headers=auth_header(test_admin),
    )
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_admin_expenses_with_data(client: AsyncClient, test_admin: User) -> None:
    """Create and list expenses to exercise list comprehension."""
    await client.post(
        "/api/v1/admin/expenses",
        json={
            "category": "rent",
            "amount": 20000,
            "description": "Kira odemesi",
            "expense_date": "2026-03-01",
            "vendor": "Ev sahibi",
            "payment_method": "bank_transfer",
            "receipt_no": "R-001",
        },
        headers=auth_header(test_admin),
    )
    resp = await client.get(
        "/api/v1/admin/expenses",
        headers=auth_header(test_admin),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 1
    assert data[0]["created_by_name"] == "Test Admin"


@pytest.mark.asyncio
async def test_admin_attendance_list_with_data(
    client: AsyncClient,
    test_admin: User,
    test_student: User,
    test_group: Group,
    test_subject: Subject,
    test_teacher: User,
    db: AsyncSession,
) -> None:
    """List attendance records to exercise list comprehension."""
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
        "/api/v1/admin/attendance",
        headers=auth_header(test_admin),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 1
    assert data[0]["student_name"] == "Test Ogrenci"
    assert data[0]["noted_by_name"] == "Test Admin"


@pytest.mark.asyncio
async def test_admin_leads_full_lifecycle(
    client: AsyncClient, test_admin: User
) -> None:
    """Create, get, update, add note, convert a lead."""
    # Create
    resp = await client.post(
        "/api/v1/admin/leads",
        json={
            "student_name": "Full Lead",
            "phone": "5559990011",
            "email": "full@lead.com",
            "grade_level": "12",
            "source": "website",
        },
        headers=auth_header(test_admin),
    )
    assert resp.status_code == 201
    lead_id = resp.json()["id"]

    # Get
    resp = await client.get(
        f"/api/v1/admin/leads/{lead_id}",
        headers=auth_header(test_admin),
    )
    assert resp.status_code == 200

    # Update status
    resp = await client.put(
        f"/api/v1/admin/leads/{lead_id}",
        json={"status": "consultation_done", "consultation_score": 8},
        headers=auth_header(test_admin),
    )
    assert resp.status_code == 200

    # Add note
    resp = await client.post(
        f"/api/v1/admin/leads/{lead_id}/notes",
        json={"content": "Gorusme olumlu"},
        headers=auth_header(test_admin),
    )
    assert resp.status_code == 201

    # Convert
    resp = await client.post(
        f"/api/v1/admin/leads/{lead_id}/convert",
        headers=auth_header(test_admin),
    )
    assert resp.status_code == 201
    assert "temporary_password" in resp.json()


@pytest.mark.asyncio
async def test_admin_roles_full_lifecycle(
    client: AsyncClient, test_admin: User
) -> None:
    """Create, list, update, delete a role."""
    resp = await client.post(
        "/api/v1/admin/roles",
        json={
            "name": "Full Role",
            "permissions": ["teachers.view", "students.view"],
        },
        headers=auth_header(test_admin),
    )
    assert resp.status_code == 201
    role_id = resp.json()["id"]

    # List
    resp = await client.get(
        "/api/v1/admin/roles",
        headers=auth_header(test_admin),
    )
    assert resp.status_code == 200
    assert len(resp.json()) >= 1

    # Update
    resp = await client.put(
        f"/api/v1/admin/roles/{role_id}",
        json={"permissions": ["teachers.view"]},
        headers=auth_header(test_admin),
    )
    assert resp.status_code == 200

    # Delete
    resp = await client.delete(
        f"/api/v1/admin/roles/{role_id}",
        headers=auth_header(test_admin),
    )
    assert resp.status_code == 204
