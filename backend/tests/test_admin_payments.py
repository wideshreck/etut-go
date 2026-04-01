"""Tests for admin payment endpoints."""

import uuid
from datetime import date

import pytest
from httpx import AsyncClient

from app.models.payment import Payment, PaymentStatus
from app.models.user import User
from tests.conftest import auth_header


@pytest.mark.asyncio
async def test_list_payments_empty(client: AsyncClient, test_admin: User) -> None:
    response = await client.get(
        "/api/v1/admin/payments",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.asyncio
async def test_create_bulk_payments(
    client: AsyncClient, test_admin: User, test_student: User
) -> None:
    response = await client.post(
        "/api/v1/admin/payments/bulk",
        json={
            "student_id": str(test_student.id),
            "total_amount": 12000,
            "installment_count": 3,
            "start_date": "2026-01-01",
        },
        headers=auth_header(test_admin),
    )
    assert response.status_code == 201
    data = response.json()
    assert len(data) == 3
    assert data[0]["installment_no"] == 1
    assert data[1]["installment_no"] == 2
    assert data[2]["installment_no"] == 3
    # Total should be 12000
    total = sum(float(p["amount"]) for p in data)
    assert abs(total - 12000) < 0.01


@pytest.mark.asyncio
async def test_create_bulk_payments_with_discount(
    client: AsyncClient, test_admin: User, test_student: User
) -> None:
    response = await client.post(
        "/api/v1/admin/payments/bulk",
        json={
            "student_id": str(test_student.id),
            "total_amount": 10000,
            "discount_rate": 10,
            "discount_description": "Erken kayit indirimi",
            "installment_count": 2,
            "start_date": "2026-02-01",
        },
        headers=auth_header(test_admin),
    )
    assert response.status_code == 201
    data = response.json()
    # Total should be 9000 (10% off 10000)
    total = sum(float(p["amount"]) for p in data)
    assert abs(total - 9000) < 0.01


@pytest.mark.asyncio
async def test_create_bulk_payments_student_not_found(
    client: AsyncClient, test_admin: User
) -> None:
    response = await client.post(
        "/api/v1/admin/payments/bulk",
        json={
            "student_id": str(uuid.uuid4()),
            "total_amount": 5000,
            "installment_count": 1,
            "start_date": "2026-01-01",
        },
        headers=auth_header(test_admin),
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_update_payment_to_paid(
    client: AsyncClient, test_admin: User, test_student: User, db
) -> None:
    payment = Payment(
        student_id=test_student.id,
        institution_id=test_admin.institution_id,
        installment_no=1,
        amount=5000,
        due_date=date(2026, 1, 15),
        status=PaymentStatus.PENDING,
    )
    db.add(payment)
    await db.flush()

    response = await client.put(
        f"/api/v1/admin/payments/{payment.id}",
        json={
            "status": "paid",
            "paid_date": "2026-01-10",
            "payment_method": "cash",
        },
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "paid"
    assert data["paid_date"] == "2026-01-10"
    assert data["payment_method"] == "cash"


@pytest.mark.asyncio
async def test_update_payment_not_found(client: AsyncClient, test_admin: User) -> None:
    response = await client.put(
        f"/api/v1/admin/payments/{uuid.uuid4()}",
        json={"status": "paid"},
        headers=auth_header(test_admin),
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_delete_payment(
    client: AsyncClient, test_admin: User, test_student: User, db
) -> None:
    payment = Payment(
        student_id=test_student.id,
        institution_id=test_admin.institution_id,
        installment_no=1,
        amount=3000,
        due_date=date(2026, 3, 15),
        status=PaymentStatus.PENDING,
    )
    db.add(payment)
    await db.flush()

    response = await client.delete(
        f"/api/v1/admin/payments/{payment.id}",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 204


@pytest.mark.asyncio
async def test_delete_payment_not_found(client: AsyncClient, test_admin: User) -> None:
    response = await client.delete(
        f"/api/v1/admin/payments/{uuid.uuid4()}",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_payment_summary(
    client: AsyncClient, test_admin: User, test_student: User, db
) -> None:
    # Create some payments
    p1 = Payment(
        student_id=test_student.id,
        institution_id=test_admin.institution_id,
        installment_no=1,
        amount=5000,
        due_date=date(2026, 1, 1),
        status=PaymentStatus.PAID,
    )
    p2 = Payment(
        student_id=test_student.id,
        institution_id=test_admin.institution_id,
        installment_no=2,
        amount=5000,
        due_date=date(2026, 2, 1),
        status=PaymentStatus.PENDING,
    )
    p3 = Payment(
        student_id=test_student.id,
        institution_id=test_admin.institution_id,
        installment_no=3,
        amount=5000,
        due_date=date(2025, 12, 1),
        status=PaymentStatus.OVERDUE,
    )
    db.add_all([p1, p2, p3])
    await db.flush()

    response = await client.get(
        "/api/v1/admin/payments/summary",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    data = response.json()
    assert data["total_expected"] == 15000
    assert data["total_paid"] == 5000
    assert data["total_pending"] == 5000
    assert data["total_overdue"] == 5000
    assert data["student_count"] == 1


@pytest.mark.asyncio
async def test_list_payments_filter_by_status(
    client: AsyncClient, test_admin: User, test_student: User, db
) -> None:
    p = Payment(
        student_id=test_student.id,
        institution_id=test_admin.institution_id,
        installment_no=1,
        amount=1000,
        due_date=date(2026, 4, 1),
        status=PaymentStatus.PENDING,
    )
    db.add(p)
    await db.flush()

    response = await client.get(
        "/api/v1/admin/payments?status=pending",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    data = response.json()
    assert all(p["status"] == "pending" for p in data)
