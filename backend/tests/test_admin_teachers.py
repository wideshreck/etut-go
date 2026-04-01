"""Tests for admin teacher CRUD endpoints."""

import pytest
from httpx import AsyncClient

from app.models.user import User
from tests.conftest import auth_header


@pytest.mark.asyncio
async def test_list_teachers_empty(client: AsyncClient, test_admin: User) -> None:
    response = await client.get(
        "/api/v1/admin/teachers",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.asyncio
async def test_create_teacher(client: AsyncClient, test_admin: User) -> None:
    response = await client.post(
        "/api/v1/admin/teachers",
        json={
            "email": "newteacher@test.com",
            "password": "password123",
            "full_name": "Yeni Ogretmen",
            "phone": "5559876543",
            "employment_type": "full_time",
        },
        headers=auth_header(test_admin),
    )
    assert response.status_code == 201
    data = response.json()
    assert data["full_name"] == "Yeni Ogretmen"
    assert data["role"] == "teacher"
    assert data["email"] == "newteacher@test.com"
    assert data["phone"] == "5559876543"
    assert data["employment_type"] == "full_time"


@pytest.mark.asyncio
async def test_create_teacher_duplicate_email(
    client: AsyncClient, test_admin: User, test_teacher: User
) -> None:
    response = await client.post(
        "/api/v1/admin/teachers",
        json={
            "email": "teacher@test.com",
            "password": "password123",
            "full_name": "Duplicate Ogretmen",
        },
        headers=auth_header(test_admin),
    )
    assert response.status_code == 400
    assert "Email already registered" in response.json()["detail"]


@pytest.mark.asyncio
async def test_create_teacher_with_subject(
    client: AsyncClient, test_admin: User, test_subject
) -> None:
    response = await client.post(
        "/api/v1/admin/teachers",
        json={
            "email": "mathteacher@test.com",
            "password": "password123",
            "full_name": "Matematik Ogretmeni",
            "subject_id": str(test_subject.id),
        },
        headers=auth_header(test_admin),
    )
    assert response.status_code == 201
    data = response.json()
    assert data["subject_name"] == "Matematik"


@pytest.mark.asyncio
async def test_create_teacher_with_availability(
    client: AsyncClient, test_admin: User
) -> None:
    response = await client.post(
        "/api/v1/admin/teachers",
        json={
            "email": "availteacher@test.com",
            "password": "password123",
            "full_name": "Available Ogretmen",
            "availability": [
                {
                    "day_of_week": 1,
                    "start_time": "09:00",
                    "end_time": "17:00",
                },
            ],
        },
        headers=auth_header(test_admin),
    )
    assert response.status_code == 201
    data = response.json()
    assert len(data["availability"]) == 1
    assert data["availability"][0]["day_of_week"] == 1


@pytest.mark.asyncio
async def test_update_teacher(
    client: AsyncClient, test_admin: User, test_teacher: User
) -> None:
    response = await client.put(
        f"/api/v1/admin/teachers/{test_teacher.id}",
        json={"full_name": "Guncellenmis Ogretmen", "phone": "5551111111"},
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    data = response.json()
    assert data["full_name"] == "Guncellenmis Ogretmen"
    assert data["phone"] == "5551111111"


@pytest.mark.asyncio
async def test_update_teacher_not_found(client: AsyncClient, test_admin: User) -> None:
    import uuid

    response = await client.put(
        f"/api/v1/admin/teachers/{uuid.uuid4()}",
        json={"full_name": "Nonexistent"},
        headers=auth_header(test_admin),
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_delete_teacher(
    client: AsyncClient, test_admin: User, test_teacher: User
) -> None:
    response = await client.delete(
        f"/api/v1/admin/teachers/{test_teacher.id}",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 204


@pytest.mark.asyncio
async def test_delete_teacher_not_found(client: AsyncClient, test_admin: User) -> None:
    import uuid

    response = await client.delete(
        f"/api/v1/admin/teachers/{uuid.uuid4()}",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_teacher_search(
    client: AsyncClient, test_admin: User, test_teacher: User
) -> None:
    response = await client.get(
        "/api/v1/admin/teachers?search=Ogretmen",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert any("Ogretmen" in t["full_name"] for t in data)


@pytest.mark.asyncio
async def test_teacher_filter_by_subject(
    client: AsyncClient, test_admin: User, test_teacher: User, test_subject, db
) -> None:
    # Assign subject to teacher
    test_teacher.subject_id = test_subject.id
    await db.flush()

    response = await client.get(
        f"/api/v1/admin/teachers?subject_id={test_subject.id}",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1


@pytest.mark.asyncio
async def test_teacher_unauthorized_student(
    client: AsyncClient, test_student: User
) -> None:
    """Non-admin roles should not access admin endpoints."""
    response = await client.get(
        "/api/v1/admin/teachers",
        headers=auth_header(test_student),
    )
    assert response.status_code == 403
