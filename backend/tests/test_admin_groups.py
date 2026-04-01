"""Tests for admin group CRUD endpoints."""

import uuid

import pytest
from httpx import AsyncClient

from app.models.group import Group
from app.models.user import User
from tests.conftest import auth_header


@pytest.mark.asyncio
async def test_list_groups_empty(client: AsyncClient, test_admin: User) -> None:
    response = await client.get(
        "/api/v1/admin/groups",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.asyncio
async def test_create_group(client: AsyncClient, test_admin: User) -> None:
    response = await client.post(
        "/api/v1/admin/groups",
        json={
            "name": "12-A",
            "grade_level": "12",
            "academic_year": "2025-2026",
            "max_capacity": 25,
            "classroom": "Derslik 1",
        },
        headers=auth_header(test_admin),
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "12-A"
    assert data["grade_level"] == "12"
    assert data["academic_year"] == "2025-2026"
    assert data["max_capacity"] == 25
    assert data["student_count"] == 0


@pytest.mark.asyncio
async def test_create_group_with_field(client: AsyncClient, test_admin: User) -> None:
    response = await client.post(
        "/api/v1/admin/groups",
        json={
            "name": "11-Sayisal",
            "grade_level": "11",
            "field": "Sayisal",
            "academic_year": "2025-2026",
        },
        headers=auth_header(test_admin),
    )
    assert response.status_code == 201
    data = response.json()
    assert data["field"] == "Sayisal"


@pytest.mark.asyncio
async def test_update_group(
    client: AsyncClient, test_admin: User, test_group: Group
) -> None:
    response = await client.put(
        f"/api/v1/admin/groups/{test_group.id}",
        json={"name": "8-B", "max_capacity": 20},
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "8-B"
    assert data["max_capacity"] == 20


@pytest.mark.asyncio
async def test_update_group_not_found(client: AsyncClient, test_admin: User) -> None:
    response = await client.put(
        f"/api/v1/admin/groups/{uuid.uuid4()}",
        json={"name": "Nonexistent"},
        headers=auth_header(test_admin),
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_delete_group(
    client: AsyncClient, test_admin: User, test_group: Group
) -> None:
    response = await client.delete(
        f"/api/v1/admin/groups/{test_group.id}",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 204


@pytest.mark.asyncio
async def test_delete_group_not_found(client: AsyncClient, test_admin: User) -> None:
    response = await client.delete(
        f"/api/v1/admin/groups/{uuid.uuid4()}",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_assign_students_to_group(
    client: AsyncClient, test_admin: User, test_group: Group, test_student: User
) -> None:
    response = await client.post(
        f"/api/v1/admin/groups/{test_group.id}/students",
        json={"student_ids": [str(test_student.id)]},
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    assert response.json()["status"] == "ok"

    # Verify group now has student
    response = await client.get(
        "/api/v1/admin/groups",
        headers=auth_header(test_admin),
    )
    groups = response.json()
    matched = [g for g in groups if str(g["id"]) == str(test_group.id)]
    assert len(matched) == 1
    assert matched[0]["student_count"] == 1


@pytest.mark.asyncio
async def test_assign_students_to_nonexistent_group(
    client: AsyncClient, test_admin: User, test_student: User
) -> None:
    response = await client.post(
        f"/api/v1/admin/groups/{uuid.uuid4()}/students",
        json={"student_ids": [str(test_student.id)]},
        headers=auth_header(test_admin),
    )
    assert response.status_code == 404
