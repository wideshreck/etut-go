"""Tests for admin leads (CRM) endpoints."""

import uuid

import pytest
from httpx import AsyncClient

from app.models.lead import Lead, LeadSource, LeadStatus
from app.models.user import User
from tests.conftest import auth_header


@pytest.mark.asyncio
async def test_list_leads_empty(client: AsyncClient, test_admin: User) -> None:
    response = await client.get(
        "/api/v1/admin/leads",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.asyncio
async def test_create_lead(client: AsyncClient, test_admin: User) -> None:
    response = await client.post(
        "/api/v1/admin/leads",
        json={
            "student_name": "Aday Ogrenci",
            "parent_name": "Aday Veli",
            "phone": "5551112233",
            "email": "aday@test.com",
            "grade_level": "8",
            "target_exam": "LGS",
            "source": "phone",
        },
        headers=auth_header(test_admin),
    )
    assert response.status_code == 201
    data = response.json()
    assert data["student_name"] == "Aday Ogrenci"
    assert data["status"] == "new"
    assert data["source"] == "phone"


@pytest.mark.asyncio
async def test_get_lead(client: AsyncClient, test_admin: User, db) -> None:
    lead = Lead(
        institution_id=test_admin.institution_id,
        student_name="Detay Ogrenci",
        phone="5559998877",
        source=LeadSource.WALK_IN,
    )
    db.add(lead)
    await db.flush()

    response = await client.get(
        f"/api/v1/admin/leads/{lead.id}",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    data = response.json()
    assert data["student_name"] == "Detay Ogrenci"


@pytest.mark.asyncio
async def test_get_lead_not_found(client: AsyncClient, test_admin: User) -> None:
    response = await client.get(
        f"/api/v1/admin/leads/{uuid.uuid4()}",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_update_lead_status(client: AsyncClient, test_admin: User, db) -> None:
    lead = Lead(
        institution_id=test_admin.institution_id,
        student_name="Status Ogrenci",
        phone="5556667788",
        source=LeadSource.WEBSITE,
    )
    db.add(lead)
    await db.flush()

    response = await client.put(
        f"/api/v1/admin/leads/{lead.id}",
        json={"status": "contacted", "notes": "Telefonda gorusuldu"},
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "contacted"
    assert data["notes"] == "Telefonda gorusuldu"


@pytest.mark.asyncio
async def test_update_lead_not_found(client: AsyncClient, test_admin: User) -> None:
    response = await client.put(
        f"/api/v1/admin/leads/{uuid.uuid4()}",
        json={"status": "contacted"},
        headers=auth_header(test_admin),
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_delete_lead(client: AsyncClient, test_admin: User, db) -> None:
    lead = Lead(
        institution_id=test_admin.institution_id,
        student_name="Silinecek Lead",
        phone="5554443322",
        source=LeadSource.OTHER,
    )
    db.add(lead)
    await db.flush()

    response = await client.delete(
        f"/api/v1/admin/leads/{lead.id}",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 204


@pytest.mark.asyncio
async def test_delete_lead_not_found(client: AsyncClient, test_admin: User) -> None:
    response = await client.delete(
        f"/api/v1/admin/leads/{uuid.uuid4()}",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_add_lead_note(client: AsyncClient, test_admin: User, db) -> None:
    lead = Lead(
        institution_id=test_admin.institution_id,
        student_name="Notlu Lead",
        phone="5553332211",
        source=LeadSource.REFERRAL,
    )
    db.add(lead)
    await db.flush()

    response = await client.post(
        f"/api/v1/admin/leads/{lead.id}/notes",
        json={"content": "Ilk gorusme yapildi."},
        headers=auth_header(test_admin),
    )
    assert response.status_code == 201
    data = response.json()
    assert data["content"] == "Ilk gorusme yapildi."
    assert data["author_name"] == "Test Admin"


@pytest.mark.asyncio
async def test_add_lead_note_lead_not_found(
    client: AsyncClient, test_admin: User
) -> None:
    response = await client.post(
        f"/api/v1/admin/leads/{uuid.uuid4()}/notes",
        json={"content": "Olmayan lead"},
        headers=auth_header(test_admin),
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_convert_lead_to_student(
    client: AsyncClient, test_admin: User, db
) -> None:
    lead = Lead(
        institution_id=test_admin.institution_id,
        student_name="Donusecek Lead",
        phone="5551231234",
        email="donusecek@test.com",
        grade_level="9",
        target_exam="YKS-Sayisal",
        source=LeadSource.WALK_IN,
    )
    db.add(lead)
    await db.flush()

    response = await client.post(
        f"/api/v1/admin/leads/{lead.id}/convert",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 201
    data = response.json()
    assert "student_id" in data
    assert "temporary_password" in data
    assert data["email"] == "donusecek@test.com"


@pytest.mark.asyncio
async def test_convert_lead_already_enrolled(
    client: AsyncClient, test_admin: User, db
) -> None:
    lead = Lead(
        institution_id=test_admin.institution_id,
        student_name="Zaten Kayitli",
        phone="5559990000",
        source=LeadSource.WALK_IN,
        status=LeadStatus.ENROLLED,
    )
    db.add(lead)
    await db.flush()

    response = await client.post(
        f"/api/v1/admin/leads/{lead.id}/convert",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_leads_summary(client: AsyncClient, test_admin: User, db) -> None:
    for status in [LeadStatus.NEW, LeadStatus.CONTACTED, LeadStatus.ENROLLED]:
        lead = Lead(
            institution_id=test_admin.institution_id,
            student_name=f"Summary Lead {status.value}",
            phone="5550000000",
            source=LeadSource.WALK_IN,
            status=status,
        )
        db.add(lead)
    await db.flush()

    response = await client.get(
        "/api/v1/admin/leads/summary",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    data = response.json()
    assert data["total"] >= 3
    assert "conversion_rate" in data


@pytest.mark.asyncio
async def test_leads_filter_by_status(
    client: AsyncClient, test_admin: User, db
) -> None:
    lead = Lead(
        institution_id=test_admin.institution_id,
        student_name="Filtered Lead",
        phone="5551110000",
        source=LeadSource.PHONE,
        status=LeadStatus.NEW,
    )
    db.add(lead)
    await db.flush()

    response = await client.get(
        "/api/v1/admin/leads?status=new",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    data = response.json()
    assert all(item["status"] == "new" for item in data)


@pytest.mark.asyncio
async def test_leads_search(client: AsyncClient, test_admin: User, db) -> None:
    lead = Lead(
        institution_id=test_admin.institution_id,
        student_name="Aranacak Ogrenci",
        phone="5552223344",
        source=LeadSource.WALK_IN,
    )
    db.add(lead)
    await db.flush()

    response = await client.get(
        "/api/v1/admin/leads?search=Aranacak",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
