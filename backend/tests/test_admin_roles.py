"""Tests for admin role/permission endpoints."""

import uuid

import pytest
from httpx import AsyncClient

from app.models.permission import AdminRole
from app.models.user import User
from tests.conftest import auth_header


@pytest.mark.asyncio
async def test_list_available_permissions(
    client: AsyncClient, test_admin: User
) -> None:
    response = await client.get(
        "/api/v1/admin/permissions/available",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) > 0
    assert "teachers.view" in data
    assert "students.create" in data


@pytest.mark.asyncio
async def test_list_roles_empty(client: AsyncClient, test_admin: User) -> None:
    response = await client.get(
        "/api/v1/admin/roles",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.asyncio
async def test_create_role(client: AsyncClient, test_admin: User) -> None:
    response = await client.post(
        "/api/v1/admin/roles",
        json={
            "name": "Muhasebe",
            "permissions": ["payments.view", "payments.create", "payments.edit"],
        },
        headers=auth_header(test_admin),
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Muhasebe"
    assert "payments.view" in data["permissions"]
    assert data["user_count"] == 0


@pytest.mark.asyncio
async def test_create_role_invalid_permissions_ignored(
    client: AsyncClient, test_admin: User
) -> None:
    """Invalid permissions should be silently ignored."""
    response = await client.post(
        "/api/v1/admin/roles",
        json={
            "name": "Partial",
            "permissions": ["teachers.view", "invalid.permission"],
        },
        headers=auth_header(test_admin),
    )
    assert response.status_code == 201


@pytest.mark.asyncio
async def test_update_role_permissions(
    client: AsyncClient, test_admin: User, db
) -> None:
    role = AdminRole(
        name="Guncellenecek Rol",
        institution_id=test_admin.institution_id,
    )
    db.add(role)
    await db.flush()

    response = await client.put(
        f"/api/v1/admin/roles/{role.id}",
        json={
            "name": "Guncellenmis Rol",
            "permissions": ["teachers.view", "students.view"],
        },
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Guncellenmis Rol"
    assert "teachers.view" in data["permissions"]
    assert "students.view" in data["permissions"]


@pytest.mark.asyncio
async def test_update_role_not_found(client: AsyncClient, test_admin: User) -> None:
    response = await client.put(
        f"/api/v1/admin/roles/{uuid.uuid4()}",
        json={"name": "Nonexistent"},
        headers=auth_header(test_admin),
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_delete_role(client: AsyncClient, test_admin: User, db) -> None:
    role = AdminRole(
        name="Silinecek Rol",
        institution_id=test_admin.institution_id,
    )
    db.add(role)
    await db.flush()

    response = await client.delete(
        f"/api/v1/admin/roles/{role.id}",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 204


@pytest.mark.asyncio
async def test_delete_role_not_found(client: AsyncClient, test_admin: User) -> None:
    response = await client.delete(
        f"/api/v1/admin/roles/{uuid.uuid4()}",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 404
