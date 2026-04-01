"""Tests for miscellaneous admin endpoints: cash ledger, teacher payments,
reports, parent accounts, admin users, password reset, etc."""

import uuid

import pytest
from httpx import AsyncClient

from app.models.guardian import Guardian
from app.models.teacher_payment import TeacherPayment
from app.models.user import User
from tests.conftest import auth_header

# ── Cash Ledger ─────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_list_cash_ledger_empty(client: AsyncClient, test_admin: User) -> None:
    response = await client.get(
        "/api/v1/admin/cash-ledger",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.asyncio
async def test_create_cash_entry(client: AsyncClient, test_admin: User) -> None:
    response = await client.post(
        "/api/v1/admin/cash-ledger",
        json={
            "entry_type": "income",
            "amount": 5000,
            "description": "Nakit tahsilat",
            "category": "student_payment",
            "entry_date": "2026-03-15",
        },
        headers=auth_header(test_admin),
    )
    assert response.status_code == 201
    data = response.json()
    assert data["entry_type"] == "income"
    assert data["amount"] == 5000


@pytest.mark.asyncio
async def test_cash_summary(client: AsyncClient, test_admin: User) -> None:
    # Create an income entry
    await client.post(
        "/api/v1/admin/cash-ledger",
        json={
            "entry_type": "income",
            "amount": 10000,
            "description": "Gelir",
            "category": "student_payment",
            "entry_date": "2026-03-01",
        },
        headers=auth_header(test_admin),
    )
    # Create an expense entry
    await client.post(
        "/api/v1/admin/cash-ledger",
        json={
            "entry_type": "expense",
            "amount": 3000,
            "description": "Gider",
            "category": "expense",
            "entry_date": "2026-03-01",
        },
        headers=auth_header(test_admin),
    )

    response = await client.get(
        "/api/v1/admin/cash-ledger/summary",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    data = response.json()
    assert data["total_income"] >= 10000
    assert data["total_expense"] >= 3000
    assert "balance" in data


# ── Teacher Payments ────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_list_teacher_payments_empty(
    client: AsyncClient, test_admin: User
) -> None:
    response = await client.get(
        "/api/v1/admin/teacher-payments",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.asyncio
async def test_create_teacher_payment(
    client: AsyncClient, test_admin: User, test_teacher: User
) -> None:
    response = await client.post(
        "/api/v1/admin/teacher-payments",
        json={
            "teacher_id": str(test_teacher.id),
            "period": "2026-03",
            "base_salary": 10000,
            "lesson_count": 20,
            "per_lesson_rate": 200,
            "bonus": 500,
            "deduction": 100,
        },
        headers=auth_header(test_admin),
    )
    assert response.status_code == 201
    data = response.json()
    assert data["teacher_name"] == test_teacher.full_name
    assert data["period"] == "2026-03"
    # total = 10000 + 20*200 + 500 - 100 = 14400
    assert data["total_amount"] == 14400
    assert data["status"] == "pending"


@pytest.mark.asyncio
async def test_update_teacher_payment(
    client: AsyncClient, test_admin: User, test_teacher: User, db
) -> None:
    tp = TeacherPayment(
        teacher_id=test_teacher.id,
        institution_id=test_admin.institution_id,
        period="2026-02",
        base_salary=8000,
        total_amount=8000,
    )
    db.add(tp)
    await db.commit()
    await db.refresh(tp)

    response = await client.put(
        f"/api/v1/admin/teacher-payments/{tp.id}",
        json={"notes": "Guncellendi"},
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_update_teacher_payment_not_found(
    client: AsyncClient, test_admin: User
) -> None:
    response = await client.put(
        f"/api/v1/admin/teacher-payments/{uuid.uuid4()}",
        json={"notes": "nope"},
        headers=auth_header(test_admin),
    )
    assert response.status_code == 404


# ── Financial Detailed Report ───────────────────────────────────────


@pytest.mark.asyncio
async def test_report_financial_detailed(client: AsyncClient, test_admin: User) -> None:
    response = await client.get(
        "/api/v1/admin/reports/financial-detailed",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    data = response.json()
    assert "student_income" in data
    assert "total_expenses" in data
    assert "teacher_salaries" in data
    assert "net_profit" in data


# ── Parent Account Creation ────────────────────────────────────────


@pytest.mark.asyncio
async def test_create_parent_account(
    client: AsyncClient, test_admin: User, test_student: User, db
) -> None:
    guardian = Guardian(
        student_id=test_student.id,
        full_name="Test Veli",
        relation="Baba",
        phone="5559998877",
        email="veli@test.com",
    )
    db.add(guardian)
    await db.commit()
    await db.refresh(guardian)

    response = await client.post(
        f"/api/v1/admin/students/{test_student.id}/parent-account?guardian_id={guardian.id}",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 201
    data = response.json()
    assert "temporary_password" in data
    assert data["guardian_name"] == "Test Veli"


@pytest.mark.asyncio
async def test_create_parent_account_guardian_not_found(
    client: AsyncClient, test_admin: User, test_student: User
) -> None:
    response = await client.post(
        f"/api/v1/admin/students/{test_student.id}/parent-account?guardian_id={uuid.uuid4()}",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_create_parent_account_already_exists(
    client: AsyncClient, test_admin: User, test_student: User, test_parent: User, db
) -> None:
    guardian = Guardian(
        student_id=test_student.id,
        full_name="Already Linked Veli",
        relation="Anne",
        phone="5551234567",
        user_id=test_parent.id,
    )
    db.add(guardian)
    await db.commit()
    await db.refresh(guardian)

    response = await client.post(
        f"/api/v1/admin/students/{test_student.id}/parent-account?guardian_id={guardian.id}",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 400


# ── Admin User CRUD ────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_create_admin_user(client: AsyncClient, test_admin: User) -> None:
    response = await client.post(
        "/api/v1/admin/admin-users",
        json={
            "email": "newadmin2@test.com",
            "password": "admin123",
            "full_name": "Yeni Admin 2",
        },
        headers=auth_header(test_admin),
    )
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "newadmin2@test.com"


# ── Password Reset ──────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_admin_reset_password(
    client: AsyncClient, test_admin: User, test_teacher: User
) -> None:
    response = await client.put(
        f"/api/v1/admin/users/{test_teacher.id}/reset-password",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    data = response.json()
    assert "temporary_password" in data
