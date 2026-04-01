"""Tests for admin dashboard and report endpoints."""

import pytest
from httpx import AsyncClient

from app.models.user import User
from tests.conftest import auth_header


@pytest.mark.asyncio
async def test_dashboard(client: AsyncClient, test_admin: User) -> None:
    response = await client.get(
        "/api/v1/admin/dashboard",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    data = response.json()
    assert "student_count" in data
    assert "teacher_count" in data
    assert "group_count" in data
    assert "subject_count" in data
    assert "total_revenue" in data
    assert "total_collected" in data
    assert "total_overdue" in data
    assert "recent_payments" in data
    assert "upcoming_payments" in data


@pytest.mark.asyncio
async def test_reports_overview(client: AsyncClient, test_admin: User) -> None:
    response = await client.get(
        "/api/v1/admin/reports/overview",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    data = response.json()
    assert "students" in data
    assert "teachers" in data
    assert "groups" in data
    assert "financial" in data
    assert "leads" in data
    assert "attendance_rate_30d" in data


@pytest.mark.asyncio
async def test_reports_financial_monthly(client: AsyncClient, test_admin: User) -> None:
    response = await client.get(
        "/api/v1/admin/reports/financial-monthly",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    assert isinstance(response.json(), list)


@pytest.mark.asyncio
async def test_reports_attendance_by_group(
    client: AsyncClient, test_admin: User
) -> None:
    response = await client.get(
        "/api/v1/admin/reports/attendance-by-group",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    assert isinstance(response.json(), list)


@pytest.mark.asyncio
async def test_reports_student_enrollment(
    client: AsyncClient, test_admin: User
) -> None:
    response = await client.get(
        "/api/v1/admin/reports/student-enrollment",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    data = response.json()
    assert "by_grade" in data
    assert "by_exam" in data
    assert "by_status" in data


@pytest.mark.asyncio
async def test_audit_logs(client: AsyncClient, test_admin: User) -> None:
    response = await client.get(
        "/api/v1/admin/audit-logs",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    assert isinstance(response.json(), list)


@pytest.mark.asyncio
async def test_admin_users_list(client: AsyncClient, test_admin: User) -> None:
    response = await client.get(
        "/api/v1/admin/admin-users",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert data[0]["email"] == "admin@test.com"


@pytest.mark.asyncio
async def test_private_lessons_list_empty(
    client: AsyncClient, test_admin: User
) -> None:
    response = await client.get(
        "/api/v1/admin/private-lessons",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    assert response.json() == []
