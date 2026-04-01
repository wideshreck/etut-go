"""Tests for admin expense endpoints."""

import uuid
from datetime import date

import pytest
from httpx import AsyncClient

from app.models.expense import Expense, ExpenseCategory
from app.models.user import User
from tests.conftest import auth_header


@pytest.mark.asyncio
async def test_list_expenses_empty(client: AsyncClient, test_admin: User) -> None:
    response = await client.get(
        "/api/v1/admin/expenses",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.asyncio
async def test_create_expense(client: AsyncClient, test_admin: User) -> None:
    response = await client.post(
        "/api/v1/admin/expenses",
        json={
            "category": "rent",
            "amount": 15000,
            "description": "Ocak ayi kira",
            "vendor": "Ev Sahibi",
            "expense_date": "2026-01-01",
            "payment_method": "bank_transfer",
            "receipt_no": "KIR-001",
        },
        headers=auth_header(test_admin),
    )
    assert response.status_code == 201
    data = response.json()
    assert data["category"] == "rent"
    assert data["amount"] == 15000
    assert data["description"] == "Ocak ayi kira"


@pytest.mark.asyncio
async def test_create_expense_different_categories(
    client: AsyncClient, test_admin: User
) -> None:
    for cat in ["utilities", "supplies", "internet"]:
        response = await client.post(
            "/api/v1/admin/expenses",
            json={
                "category": cat,
                "amount": 500,
                "description": f"{cat} gideri",
                "expense_date": "2026-02-01",
            },
            headers=auth_header(test_admin),
        )
        assert response.status_code == 201


@pytest.mark.asyncio
async def test_list_expenses_filter_by_category(
    client: AsyncClient, test_admin: User, db
) -> None:
    expense = Expense(
        institution_id=test_admin.institution_id,
        category=ExpenseCategory.CLEANING,
        amount=1000,
        description="Temizlik hizmeti",
        expense_date=date(2026, 3, 1),
        created_by=test_admin.id,
    )
    db.add(expense)
    await db.flush()

    response = await client.get(
        "/api/v1/admin/expenses?category=cleaning",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    data = response.json()
    assert all(e["category"] == "cleaning" for e in data)


@pytest.mark.asyncio
async def test_list_expenses_filter_by_date(
    client: AsyncClient, test_admin: User, db
) -> None:
    expense = Expense(
        institution_id=test_admin.institution_id,
        category=ExpenseCategory.RENT,
        amount=2000,
        description="Mart kira",
        expense_date=date(2026, 3, 15),
        created_by=test_admin.id,
    )
    db.add(expense)
    await db.flush()

    response = await client.get(
        "/api/v1/admin/expenses?date_from=2026-03-01&date_to=2026-03-31",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1


@pytest.mark.asyncio
async def test_update_expense(client: AsyncClient, test_admin: User, db) -> None:
    expense = Expense(
        institution_id=test_admin.institution_id,
        category=ExpenseCategory.SUPPLIES,
        amount=500,
        description="Kirtasiye",
        expense_date=date(2026, 3, 10),
        created_by=test_admin.id,
    )
    db.add(expense)
    await db.flush()

    response = await client.put(
        f"/api/v1/admin/expenses/{expense.id}",
        json={"amount": 750, "description": "Kirtasiye (guncellendi)"},
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    data = response.json()
    assert data["amount"] == 750
    assert data["description"] == "Kirtasiye (guncellendi)"


@pytest.mark.asyncio
async def test_update_expense_not_found(client: AsyncClient, test_admin: User) -> None:
    response = await client.put(
        f"/api/v1/admin/expenses/{uuid.uuid4()}",
        json={"amount": 100},
        headers=auth_header(test_admin),
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_delete_expense(client: AsyncClient, test_admin: User, db) -> None:
    expense = Expense(
        institution_id=test_admin.institution_id,
        category=ExpenseCategory.OTHER,
        amount=100,
        description="Diger gider",
        expense_date=date(2026, 3, 20),
        created_by=test_admin.id,
    )
    db.add(expense)
    await db.flush()

    response = await client.delete(
        f"/api/v1/admin/expenses/{expense.id}",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 204


@pytest.mark.asyncio
async def test_delete_expense_not_found(client: AsyncClient, test_admin: User) -> None:
    response = await client.delete(
        f"/api/v1/admin/expenses/{uuid.uuid4()}",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 404
