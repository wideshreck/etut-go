"""Tests for admin student CRUD endpoints."""

import uuid

import pytest
from httpx import AsyncClient

from app.models.user import User
from tests.conftest import auth_header


@pytest.mark.asyncio
async def test_list_students_empty(client: AsyncClient, test_admin: User) -> None:
    response = await client.get(
        "/api/v1/admin/students",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.asyncio
async def test_create_student(client: AsyncClient, test_admin: User) -> None:
    response = await client.post(
        "/api/v1/admin/students",
        json={
            "email": "newstudent@test.com",
            "password": "password123",
            "full_name": "Yeni Ogrenci",
            "grade_level": "8",
            "target_exam": "LGS",
            "enrollment_status": "active",
        },
        headers=auth_header(test_admin),
    )
    assert response.status_code == 201
    data = response.json()
    assert data["full_name"] == "Yeni Ogrenci"
    assert data["role"] == "student"
    assert data["grade_level"] == "8"
    assert data["target_exam"] == "LGS"


@pytest.mark.asyncio
async def test_create_student_with_guardians(
    client: AsyncClient, test_admin: User
) -> None:
    response = await client.post(
        "/api/v1/admin/students",
        json={
            "email": "stuguardian@test.com",
            "password": "password123",
            "full_name": "Velili Ogrenci",
            "guardians": [
                {
                    "full_name": "Anne Hanim",
                    "relation": "Anne",
                    "phone": "5551234567",
                    "email": "anne@test.com",
                },
                {
                    "full_name": "Baba Bey",
                    "relation": "Baba",
                    "phone": "5557654321",
                },
            ],
        },
        headers=auth_header(test_admin),
    )
    assert response.status_code == 201
    data = response.json()
    assert len(data["guardians"]) == 2
    guardian_names = [g["full_name"] for g in data["guardians"]]
    assert "Anne Hanim" in guardian_names
    assert "Baba Bey" in guardian_names


@pytest.mark.asyncio
async def test_create_student_duplicate_email(
    client: AsyncClient, test_admin: User, test_student: User
) -> None:
    response = await client.post(
        "/api/v1/admin/students",
        json={
            "email": "student@test.com",
            "password": "password123",
            "full_name": "Duplicate Ogrenci",
        },
        headers=auth_header(test_admin),
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_update_student(
    client: AsyncClient, test_admin: User, test_student: User
) -> None:
    response = await client.put(
        f"/api/v1/admin/students/{test_student.id}",
        json={
            "full_name": "Guncellenmis Ogrenci",
            "grade_level": "9",
        },
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    data = response.json()
    assert data["full_name"] == "Guncellenmis Ogrenci"
    assert data["grade_level"] == "9"


@pytest.mark.asyncio
async def test_update_student_not_found(client: AsyncClient, test_admin: User) -> None:
    response = await client.put(
        f"/api/v1/admin/students/{uuid.uuid4()}",
        json={"full_name": "Nonexistent"},
        headers=auth_header(test_admin),
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_delete_student(
    client: AsyncClient, test_admin: User, test_student: User
) -> None:
    response = await client.delete(
        f"/api/v1/admin/students/{test_student.id}",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 204


@pytest.mark.asyncio
async def test_delete_student_not_found(client: AsyncClient, test_admin: User) -> None:
    response = await client.delete(
        f"/api/v1/admin/students/{uuid.uuid4()}",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_student_search(
    client: AsyncClient, test_admin: User, test_student: User
) -> None:
    response = await client.get(
        "/api/v1/admin/students?search=Ogrenci",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1


@pytest.mark.asyncio
async def test_student_filter_by_grade(
    client: AsyncClient, test_admin: User, test_student: User
) -> None:
    response = await client.get(
        "/api/v1/admin/students?grade_level=8",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert all(s["grade_level"] == "8" for s in data)


@pytest.mark.asyncio
async def test_student_filter_by_enrollment_status(
    client: AsyncClient, test_admin: User, test_student: User
) -> None:
    response = await client.get(
        "/api/v1/admin/students?enrollment_status=active",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1


@pytest.mark.asyncio
async def test_get_student_payments_empty(
    client: AsyncClient, test_admin: User, test_student: User
) -> None:
    response = await client.get(
        f"/api/v1/admin/students/{test_student.id}/payments",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    assert response.json() == []
