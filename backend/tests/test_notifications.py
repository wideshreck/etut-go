"""Tests for notification endpoints."""

import pytest
from httpx import AsyncClient

from app.models.notification import Notification
from app.models.user import User
from tests.conftest import auth_header


@pytest.mark.asyncio
async def test_list_notifications_empty(client: AsyncClient, test_admin: User) -> None:
    response = await client.get(
        "/api/v1/notifications",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.asyncio
async def test_list_notifications(client: AsyncClient, test_admin: User, db) -> None:
    n = Notification(
        user_id=test_admin.id,
        title="Test Bildirim",
        message="Bu bir test bildirimidir.",
        type="system",
    )
    db.add(n)
    await db.flush()

    response = await client.get(
        "/api/v1/notifications",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert data[0]["title"] == "Test Bildirim"
    assert data[0]["is_read"] is False


@pytest.mark.asyncio
async def test_list_notifications_unread_only(
    client: AsyncClient, test_admin: User, db
) -> None:
    read = Notification(
        user_id=test_admin.id,
        title="Okunmus",
        message="Okunmus bildirim",
        type="system",
        is_read=True,
    )
    unread = Notification(
        user_id=test_admin.id,
        title="Okunmamis",
        message="Okunmamis bildirim",
        type="system",
        is_read=False,
    )
    db.add_all([read, unread])
    await db.flush()

    response = await client.get(
        "/api/v1/notifications?unread_only=true",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    data = response.json()
    assert all(not n["is_read"] for n in data)


@pytest.mark.asyncio
async def test_unread_count(client: AsyncClient, test_admin: User, db) -> None:
    for i in range(3):
        n = Notification(
            user_id=test_admin.id,
            title=f"Bildirim {i}",
            message=f"Mesaj {i}",
            type="system",
        )
        db.add(n)
    await db.flush()

    response = await client.get(
        "/api/v1/notifications/unread-count",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    assert response.json()["count"] >= 3


@pytest.mark.asyncio
async def test_mark_as_read(client: AsyncClient, test_admin: User, db) -> None:
    n = Notification(
        user_id=test_admin.id,
        title="Okunacak",
        message="Okunacak bildirim",
        type="system",
    )
    db.add(n)
    await db.flush()

    response = await client.put(
        f"/api/v1/notifications/{n.id}/read",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


@pytest.mark.asyncio
async def test_mark_all_as_read(client: AsyncClient, test_admin: User, db) -> None:
    for i in range(3):
        n = Notification(
            user_id=test_admin.id,
            title=f"Toplu {i}",
            message=f"Toplu {i}",
            type="system",
        )
        db.add(n)
    await db.flush()

    response = await client.put(
        "/api/v1/notifications/read-all",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    assert response.json()["status"] == "ok"

    # Verify all are read
    response = await client.get(
        "/api/v1/notifications/unread-count",
        headers=auth_header(test_admin),
    )
    assert response.json()["count"] == 0
