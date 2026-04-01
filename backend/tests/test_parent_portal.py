"""Tests for parent portal endpoints."""

import pytest
from httpx import AsyncClient

from app.models.guardian import Guardian
from app.models.user import User
from tests.conftest import auth_header


@pytest.fixture
async def parent_with_child(
    db, test_parent: User, test_student: User
) -> tuple[User, User]:
    """Link parent to student via guardian record."""
    guardian = Guardian(
        student_id=test_student.id,
        full_name=test_parent.full_name,
        relation="Baba",
        phone="5551234567",
        user_id=test_parent.id,
    )
    db.add(guardian)
    await db.flush()
    return test_parent, test_student


@pytest.mark.asyncio
async def test_parent_child_info(
    client: AsyncClient, parent_with_child: tuple[User, User]
) -> None:
    parent, student = parent_with_child
    response = await client.get(
        "/api/v1/parent/child",
        headers=auth_header(parent),
    )
    assert response.status_code == 200
    data = response.json()
    assert data["full_name"] == student.full_name
    assert data["email"] == student.email


@pytest.mark.asyncio
async def test_parent_no_linked_child(client: AsyncClient, test_parent: User) -> None:
    """Parent without a linked guardian record should get 404."""
    response = await client.get(
        "/api/v1/parent/child",
        headers=auth_header(test_parent),
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_parent_schedule_no_group(
    client: AsyncClient, parent_with_child: tuple[User, User]
) -> None:
    parent, _student = parent_with_child
    # student has no group by default
    response = await client.get(
        "/api/v1/parent/schedule",
        headers=auth_header(parent),
    )
    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.asyncio
async def test_parent_assignments(
    client: AsyncClient, parent_with_child: tuple[User, User]
) -> None:
    parent, _ = parent_with_child
    response = await client.get(
        "/api/v1/parent/assignments",
        headers=auth_header(parent),
    )
    assert response.status_code == 200
    assert isinstance(response.json(), list)


@pytest.mark.asyncio
async def test_parent_attendance(
    client: AsyncClient, parent_with_child: tuple[User, User]
) -> None:
    parent, _ = parent_with_child
    response = await client.get(
        "/api/v1/parent/attendance",
        headers=auth_header(parent),
    )
    assert response.status_code == 200
    data = response.json()
    assert "summary" in data
    assert "recent" in data


@pytest.mark.asyncio
async def test_parent_payments(
    client: AsyncClient, parent_with_child: tuple[User, User]
) -> None:
    parent, _ = parent_with_child
    response = await client.get(
        "/api/v1/parent/payments",
        headers=auth_header(parent),
    )
    assert response.status_code == 200
    assert isinstance(response.json(), list)


@pytest.mark.asyncio
async def test_parent_announcements(
    client: AsyncClient, parent_with_child: tuple[User, User]
) -> None:
    parent, _ = parent_with_child
    response = await client.get(
        "/api/v1/parent/announcements",
        headers=auth_header(parent),
    )
    assert response.status_code == 200
    assert isinstance(response.json(), list)
