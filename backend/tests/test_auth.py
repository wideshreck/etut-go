"""Tests for authentication endpoints."""

import pytest
from httpx import AsyncClient

from app.models.user import User
from tests.conftest import auth_header


@pytest.mark.asyncio
async def test_login_missing_fields(client: AsyncClient) -> None:
    response = await client.post("/api/v1/auth/login", json={})
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_login_success(client: AsyncClient, test_admin: User) -> None:
    response = await client.post(
        "/api/v1/auth/login",
        json={"email": "admin@test.com", "password": "test123"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == "admin@test.com"
    assert data["user"]["role"] == "admin"
    assert "permissions" in data["user"]


@pytest.mark.asyncio
async def test_login_wrong_password(client: AsyncClient, test_admin: User) -> None:
    response = await client.post(
        "/api/v1/auth/login",
        json={"email": "admin@test.com", "password": "wrong"},
    )
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid email or password"


@pytest.mark.asyncio
async def test_login_nonexistent_user(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/auth/login",
        json={"email": "nobody@test.com", "password": "test123"},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_login_inactive_user(client: AsyncClient, test_admin: User, db) -> None:
    test_admin.is_active = False
    await db.flush()

    response = await client.post(
        "/api/v1/auth/login",
        json={"email": "admin@test.com", "password": "test123"},
    )
    assert response.status_code == 403
    assert response.json()["detail"] == "Account is deactivated"


@pytest.mark.asyncio
async def test_me_authenticated(client: AsyncClient, test_admin: User) -> None:
    response = await client.get(
        "/api/v1/auth/me",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "admin@test.com"
    assert data["full_name"] == "Test Admin"
    assert "permissions" in data


@pytest.mark.asyncio
async def test_me_without_token(client: AsyncClient) -> None:
    response = await client.get("/api/v1/auth/me")
    assert response.status_code in (401, 403)


@pytest.mark.asyncio
async def test_me_with_invalid_token(client: AsyncClient) -> None:
    response = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": "Bearer invalid-token"},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_me_permissions(client: AsyncClient, test_admin: User) -> None:
    response = await client.get(
        "/api/v1/auth/me/permissions",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) > 0


@pytest.mark.asyncio
async def test_change_password_success(client: AsyncClient, test_admin: User) -> None:
    response = await client.put(
        "/api/v1/auth/change-password",
        json={"current_password": "test123", "new_password": "newpass123"},
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


@pytest.mark.asyncio
async def test_change_password_wrong_current(
    client: AsyncClient, test_admin: User
) -> None:
    response = await client.put(
        "/api/v1/auth/change-password",
        json={"current_password": "wrong", "new_password": "newpass123"},
        headers=auth_header(test_admin),
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_change_password_too_short(client: AsyncClient, test_admin: User) -> None:
    response = await client.put(
        "/api/v1/auth/change-password",
        json={"current_password": "test123", "new_password": "ab"},
        headers=auth_header(test_admin),
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_kvkk_status_not_accepted(client: AsyncClient, test_admin: User) -> None:
    response = await client.get(
        "/api/v1/auth/kvkk-status",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    data = response.json()
    assert data["accepted"] is False
    assert data["current_version"] == "v1.0"


@pytest.mark.asyncio
async def test_kvkk_accept(client: AsyncClient, test_admin: User) -> None:
    # Accept
    response = await client.post(
        "/api/v1/auth/kvkk-accept",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    assert response.json()["status"] == "ok"

    # Verify accepted
    response = await client.get(
        "/api/v1/auth/kvkk-status",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    assert response.json()["accepted"] is True
