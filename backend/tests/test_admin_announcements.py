"""Tests for admin announcement endpoints."""

import uuid

import pytest
from httpx import AsyncClient

from app.models.announcement import (
    Announcement,
    AnnouncementPriority,
    AnnouncementTarget,
)
from app.models.user import User
from tests.conftest import auth_header


@pytest.mark.asyncio
async def test_list_announcements_empty(client: AsyncClient, test_admin: User) -> None:
    response = await client.get(
        "/api/v1/admin/announcements",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.asyncio
async def test_create_announcement(client: AsyncClient, test_admin: User) -> None:
    response = await client.post(
        "/api/v1/admin/announcements",
        json={
            "title": "Test Duyuru",
            "content": "Bu bir test duyurusudur.",
            "target_role": "all",
            "priority": "normal",
        },
        headers=auth_header(test_admin),
    )
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "Test Duyuru"
    assert data["content"] == "Bu bir test duyurusudur."
    assert data["target_role"] == "all"
    assert data["priority"] == "normal"
    assert data["is_pinned"] is False
    assert data["author_name"] == "Test Admin"


@pytest.mark.asyncio
async def test_create_announcement_pinned(
    client: AsyncClient, test_admin: User
) -> None:
    response = await client.post(
        "/api/v1/admin/announcements",
        json={
            "title": "Pinned Duyuru",
            "content": "Sabitlenmis duyuru.",
            "is_pinned": True,
            "priority": "important",
        },
        headers=auth_header(test_admin),
    )
    assert response.status_code == 201
    data = response.json()
    assert data["is_pinned"] is True
    assert data["priority"] == "important"


@pytest.mark.asyncio
async def test_create_announcement_for_teachers(
    client: AsyncClient, test_admin: User
) -> None:
    response = await client.post(
        "/api/v1/admin/announcements",
        json={
            "title": "Ogretmen Toplantisi",
            "content": "Yarin saat 16:00 da ogretmenler toplantisi var.",
            "target_role": "teacher",
        },
        headers=auth_header(test_admin),
    )
    assert response.status_code == 201
    data = response.json()
    assert data["target_role"] == "teacher"


@pytest.mark.asyncio
async def test_update_announcement(client: AsyncClient, test_admin: User, db) -> None:
    ann = Announcement(
        title="Eski Duyuru",
        content="Eski icerik",
        institution_id=test_admin.institution_id,
        target_role=AnnouncementTarget.ALL,
        priority=AnnouncementPriority.NORMAL,
        created_by=test_admin.id,
    )
    db.add(ann)
    await db.flush()

    response = await client.put(
        f"/api/v1/admin/announcements/{ann.id}",
        json={
            "title": "Guncellenmis Duyuru",
            "content": "Yeni icerik",
            "is_pinned": True,
        },
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "Guncellenmis Duyuru"
    assert data["content"] == "Yeni icerik"
    assert data["is_pinned"] is True


@pytest.mark.asyncio
async def test_update_announcement_not_found(
    client: AsyncClient, test_admin: User
) -> None:
    response = await client.put(
        f"/api/v1/admin/announcements/{uuid.uuid4()}",
        json={"title": "Nonexistent"},
        headers=auth_header(test_admin),
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_delete_announcement(client: AsyncClient, test_admin: User, db) -> None:
    ann = Announcement(
        title="Silinecek Duyuru",
        content="Silinecek icerik",
        institution_id=test_admin.institution_id,
        target_role=AnnouncementTarget.ALL,
        priority=AnnouncementPriority.NORMAL,
        created_by=test_admin.id,
    )
    db.add(ann)
    await db.flush()

    response = await client.delete(
        f"/api/v1/admin/announcements/{ann.id}",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 204


@pytest.mark.asyncio
async def test_delete_announcement_not_found(
    client: AsyncClient, test_admin: User
) -> None:
    response = await client.delete(
        f"/api/v1/admin/announcements/{uuid.uuid4()}",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_announcement_pinned_first(
    client: AsyncClient, test_admin: User, db
) -> None:
    """Pinned announcements should appear before unpinned."""
    normal = Announcement(
        title="Normal",
        content="Normal",
        institution_id=test_admin.institution_id,
        target_role=AnnouncementTarget.ALL,
        priority=AnnouncementPriority.NORMAL,
        is_pinned=False,
        created_by=test_admin.id,
    )
    pinned = Announcement(
        title="Pinned",
        content="Pinned",
        institution_id=test_admin.institution_id,
        target_role=AnnouncementTarget.ALL,
        priority=AnnouncementPriority.NORMAL,
        is_pinned=True,
        created_by=test_admin.id,
    )
    db.add_all([normal, pinned])
    await db.flush()

    response = await client.get(
        "/api/v1/admin/announcements",
        headers=auth_header(test_admin),
    )
    data = response.json()
    assert len(data) >= 2
    # Pinned should come first
    pinned_indices = [i for i, a in enumerate(data) if a["is_pinned"]]
    unpinned_indices = [i for i, a in enumerate(data) if not a["is_pinned"]]
    if pinned_indices and unpinned_indices:
        assert max(pinned_indices) < min(unpinned_indices)
