"""Tests for superadmin endpoints."""

import uuid

import pytest
from httpx import AsyncClient

from app.models.institution import Institution
from app.models.user import User
from tests.conftest import auth_header


@pytest.mark.asyncio
async def test_list_institutions(
    client: AsyncClient, test_superadmin: User, test_institution: Institution
) -> None:
    response = await client.get(
        "/api/v1/superadmin/institutions",
        headers=auth_header(test_superadmin),
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1


@pytest.mark.asyncio
async def test_create_institution(client: AsyncClient, test_superadmin: User) -> None:
    response = await client.post(
        "/api/v1/superadmin/institutions",
        json={
            "name": "Yeni Kurum",
            "address": "Yeni Adres",
            "phone": "5559991234",
        },
        headers=auth_header(test_superadmin),
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Yeni Kurum"
    assert data["address"] == "Yeni Adres"
    assert data["is_active"] is True


@pytest.mark.asyncio
async def test_get_institution(
    client: AsyncClient, test_superadmin: User, test_institution: Institution
) -> None:
    response = await client.get(
        f"/api/v1/superadmin/institutions/{test_institution.id}",
        headers=auth_header(test_superadmin),
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Test Kurum"


@pytest.mark.asyncio
async def test_get_institution_not_found(
    client: AsyncClient, test_superadmin: User
) -> None:
    response = await client.get(
        f"/api/v1/superadmin/institutions/{uuid.uuid4()}",
        headers=auth_header(test_superadmin),
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_update_institution(
    client: AsyncClient, test_superadmin: User, test_institution: Institution
) -> None:
    response = await client.put(
        f"/api/v1/superadmin/institutions/{test_institution.id}",
        json={"name": "Guncellenmis Kurum", "phone": "5550001111"},
        headers=auth_header(test_superadmin),
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Guncellenmis Kurum"
    assert data["phone"] == "5550001111"


@pytest.mark.asyncio
async def test_update_institution_not_found(
    client: AsyncClient, test_superadmin: User
) -> None:
    response = await client.put(
        f"/api/v1/superadmin/institutions/{uuid.uuid4()}",
        json={"name": "Nonexistent"},
        headers=auth_header(test_superadmin),
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_delete_institution(
    client: AsyncClient, test_superadmin: User, db
) -> None:
    inst = Institution(name="Silinecek Kurum")
    db.add(inst)
    await db.flush()

    response = await client.delete(
        f"/api/v1/superadmin/institutions/{inst.id}",
        headers=auth_header(test_superadmin),
    )
    assert response.status_code == 204


@pytest.mark.asyncio
async def test_delete_institution_not_found(
    client: AsyncClient, test_superadmin: User
) -> None:
    response = await client.delete(
        f"/api/v1/superadmin/institutions/{uuid.uuid4()}",
        headers=auth_header(test_superadmin),
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_create_admin_for_institution(
    client: AsyncClient, test_superadmin: User, test_institution: Institution
) -> None:
    response = await client.post(
        f"/api/v1/superadmin/institutions/{test_institution.id}/admin",
        json={
            "email": "newadmin@test.com",
            "password": "admin123",
            "full_name": "Yeni Admin",
            "phone": "5551112233",
        },
        headers=auth_header(test_superadmin),
    )
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "newadmin@test.com"
    assert data["full_name"] == "Yeni Admin"
    assert data["role"] == "admin"


@pytest.mark.asyncio
async def test_create_admin_duplicate_email(
    client: AsyncClient,
    test_superadmin: User,
    test_institution: Institution,
    test_admin: User,
) -> None:
    response = await client.post(
        f"/api/v1/superadmin/institutions/{test_institution.id}/admin",
        json={
            "email": "admin@test.com",
            "password": "admin123",
            "full_name": "Duplicate Admin",
        },
        headers=auth_header(test_superadmin),
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_create_admin_institution_not_found(
    client: AsyncClient, test_superadmin: User
) -> None:
    response = await client.post(
        f"/api/v1/superadmin/institutions/{uuid.uuid4()}/admin",
        json={
            "email": "orphan@test.com",
            "password": "admin123",
            "full_name": "Orphan Admin",
        },
        headers=auth_header(test_superadmin),
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_superadmin_dashboard(
    client: AsyncClient, test_superadmin: User, test_institution: Institution
) -> None:
    response = await client.get(
        "/api/v1/superadmin/dashboard",
        headers=auth_header(test_superadmin),
    )
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    assert "student_count" in data[0]
    assert "teacher_count" in data[0]


@pytest.mark.asyncio
async def test_superadmin_endpoints_forbidden_for_admin(
    client: AsyncClient, test_admin: User
) -> None:
    """Non-superadmin roles should be denied."""
    response = await client.get(
        "/api/v1/superadmin/institutions",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 403
