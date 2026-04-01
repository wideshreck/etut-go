"""Tests for admin subject CRUD endpoints."""

import uuid

import pytest
from httpx import AsyncClient

from app.models.subject import Subject
from app.models.user import User
from tests.conftest import auth_header


@pytest.mark.asyncio
async def test_list_subjects_empty(client: AsyncClient, test_admin: User) -> None:
    response = await client.get(
        "/api/v1/admin/subjects",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.asyncio
async def test_create_subject(client: AsyncClient, test_admin: User) -> None:
    response = await client.post(
        "/api/v1/admin/subjects",
        json={
            "name": "Fizik",
            "color_code": "#EF4444",
            "notes": "Fizik dersi",
        },
        headers=auth_header(test_admin),
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Fizik"
    assert data["color_code"] == "#EF4444"
    assert data["notes"] == "Fizik dersi"


@pytest.mark.asyncio
async def test_list_subjects_with_teacher_count(
    client: AsyncClient, test_admin: User, test_subject: Subject, test_teacher: User, db
) -> None:
    # Assign teacher to subject
    test_teacher.subject_id = test_subject.id
    await db.flush()

    response = await client.get(
        "/api/v1/admin/subjects",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    matched = [s for s in data if str(s["id"]) == str(test_subject.id)]
    assert matched[0]["teacher_count"] == 1


@pytest.mark.asyncio
async def test_update_subject(
    client: AsyncClient, test_admin: User, test_subject: Subject
) -> None:
    response = await client.put(
        f"/api/v1/admin/subjects/{test_subject.id}",
        json={"name": "Ileri Matematik", "color_code": "#10B981"},
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Ileri Matematik"
    assert data["color_code"] == "#10B981"


@pytest.mark.asyncio
async def test_update_subject_not_found(client: AsyncClient, test_admin: User) -> None:
    response = await client.put(
        f"/api/v1/admin/subjects/{uuid.uuid4()}",
        json={"name": "Nonexistent"},
        headers=auth_header(test_admin),
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_delete_subject(
    client: AsyncClient, test_admin: User, test_subject: Subject
) -> None:
    response = await client.delete(
        f"/api/v1/admin/subjects/{test_subject.id}",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 204


@pytest.mark.asyncio
async def test_delete_subject_not_found(client: AsyncClient, test_admin: User) -> None:
    response = await client.delete(
        f"/api/v1/admin/subjects/{uuid.uuid4()}",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 404
