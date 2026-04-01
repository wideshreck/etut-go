"""Deep tests for admin endpoints -- verify response structures and edge cases."""

import uuid
from datetime import UTC, date, datetime, time

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models.announcement import (
    Announcement,
    AnnouncementPriority,
    AnnouncementTarget,
)
from app.models.attendance import Attendance, AttendanceStatus
from app.models.group import Group
from app.models.guardian import Guardian
from app.models.lead import Lead, LeadSource, LeadStatus
from app.models.payment import Payment, PaymentStatus
from app.models.permission import AdminRole
from app.models.private_lesson import PrivateLesson, PrivateLessonStatus
from app.models.schedule import GroupSchedule
from app.models.subject import Subject
from app.models.teacher_payment import TeacherPayment, TeacherPaymentStatus
from app.models.user import User, UserRole
from tests.conftest import auth_header

# ══════════════════════════════════════════════════════════════════════
# Teacher endpoints -- deep
# ══════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_create_teacher_with_all_fields(
    client: AsyncClient, test_admin: User, test_subject: Subject
) -> None:
    response = await client.post(
        "/api/v1/admin/teachers",
        json={
            "email": "deep_teacher@test.com",
            "password": "password123",
            "full_name": "Deep Test Ogretmen",
            "phone": "5550001111",
            "employment_type": "part_time",
            "subject_id": str(test_subject.id),
            "salary_type": "per_lesson",
            "salary_amount": 200,
            "university": "Istanbul Uni",
            "department": "Matematik",
            "iban": "TR1234567890",
            "tc_no": "11111111111",
            "address": "Istanbul, Turkey",
            "emergency_contact": "Annesi",
            "emergency_phone": "5559999999",
            "notes": "Not var",
            "availability": [
                {"day_of_week": 1, "start_time": "09:00", "end_time": "12:00"},
                {"day_of_week": 3, "start_time": "14:00", "end_time": "17:00"},
            ],
        },
        headers=auth_header(test_admin),
    )
    assert response.status_code == 201
    data = response.json()
    assert data["full_name"] == "Deep Test Ogretmen"
    assert data["employment_type"] == "part_time"
    assert data["subject_name"] == "Matematik"
    assert data["phone"] == "5550001111"
    assert len(data["availability"]) == 2
    assert data["availability"][0]["day_of_week"] in (1, 3)


@pytest.mark.asyncio
async def test_update_teacher_change_subject(
    client: AsyncClient, test_admin: User, test_teacher: User, db: AsyncSession
) -> None:
    sub2 = Subject(
        name="Fizik",
        institution_id=test_admin.institution_id,
        color_code="#FF0000",
    )
    db.add(sub2)
    await db.flush()

    response = await client.put(
        f"/api/v1/admin/teachers/{test_teacher.id}",
        json={"subject_id": str(sub2.id)},
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    assert response.json()["subject_name"] == "Fizik"


@pytest.mark.asyncio
async def test_update_teacher_availability(
    client: AsyncClient, test_admin: User, test_teacher: User
) -> None:
    response = await client.put(
        f"/api/v1/admin/teachers/{test_teacher.id}",
        json={
            "availability": [
                {"day_of_week": 2, "start_time": "10:00", "end_time": "15:00"},
            ],
        },
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data["availability"]) == 1
    assert data["availability"][0]["day_of_week"] == 2


@pytest.mark.asyncio
async def test_list_teachers_filter_by_employment_type(
    client: AsyncClient, test_admin: User, db: AsyncSession
) -> None:
    teacher = User(
        email="emp_filter@test.com",
        password_hash=hash_password("test123"),
        full_name="EmpFilter Teacher",
        role=UserRole.TEACHER,
        institution_id=test_admin.institution_id,
        employment_type="full_time",
    )
    db.add(teacher)
    await db.flush()

    response = await client.get(
        "/api/v1/admin/teachers?employment_type=full_time",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert all(t["employment_type"] == "full_time" for t in data)


@pytest.mark.asyncio
async def test_list_teachers_search_no_results(
    client: AsyncClient, test_admin: User
) -> None:
    response = await client.get(
        "/api/v1/admin/teachers?search=BuAdYok",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    assert response.json() == []


# ══════════════════════════════════════════════════════════════════════
# Student endpoints -- deep
# ══════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_create_student_with_all_academic_fields(
    client: AsyncClient, test_admin: User, test_group: Group
) -> None:
    response = await client.post(
        "/api/v1/admin/students",
        json={
            "email": "full_student@test.com",
            "password": "pass123",
            "full_name": "Full Student",
            "phone": "5552223344",
            "tc_no": "22222222222",
            "address": "Ankara, TR",
            "birth_date": "2008-05-15",
            "gender": "Erkek",
            "school": "Ataturk Ortaokulu",
            "grade_level": "8",
            "target_exam": "LGS",
            "enrollment_status": "active",
            "enrollment_date": "2025-09-01",
            "enrollment_period": "2025-2026",
            "group_id": str(test_group.id),
            "weekly_credits": 3,
            "credit_duration": 45,
            "notes": "Basarili ogrenci",
            "guardians": [
                {
                    "full_name": "Anne Test",
                    "relation": "Anne",
                    "phone": "5551112233",
                    "email": "anne@test.com",
                    "occupation": "Doktor",
                },
            ],
        },
        headers=auth_header(test_admin),
    )
    assert response.status_code == 201
    data = response.json()
    assert data["full_name"] == "Full Student"
    assert data["grade_level"] == "8"
    assert data["target_exam"] == "LGS"
    assert data["enrollment_status"] == "active"
    assert data["group_name"] == "8-A"
    assert len(data["guardians"]) == 1
    assert data["guardians"][0]["full_name"] == "Anne Test"
    assert data["guardians"][0]["occupation"] == "Doktor"


@pytest.mark.asyncio
async def test_update_student_guardians_replace(
    client: AsyncClient, test_admin: User, test_student: User, db: AsyncSession
) -> None:
    # First add a guardian
    g = Guardian(
        student_id=test_student.id,
        full_name="Old Guardian",
        relation="Baba",
        phone="5550000000",
    )
    db.add(g)
    await db.flush()

    # Update with new guardians (should replace)
    response = await client.put(
        f"/api/v1/admin/students/{test_student.id}",
        json={
            "guardians": [
                {
                    "full_name": "New Mother",
                    "relation": "Anne",
                    "phone": "5551111111",
                    "email": "newmother@test.com",
                },
                {
                    "full_name": "New Father",
                    "relation": "Baba",
                    "phone": "5552222222",
                },
            ],
        },
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data["guardians"]) == 2
    names = [g["full_name"] for g in data["guardians"]]
    assert "New Mother" in names
    assert "New Father" in names


@pytest.mark.asyncio
async def test_student_filter_by_target_exam(
    client: AsyncClient, test_admin: User, test_student: User
) -> None:
    response = await client.get(
        "/api/v1/admin/students?target_exam=LGS",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert all(s["target_exam"] == "LGS" for s in data)


@pytest.mark.asyncio
async def test_student_filter_by_group_id(
    client: AsyncClient,
    test_admin: User,
    test_student: User,
    test_group: Group,
    db: AsyncSession,
) -> None:
    test_student.group_id = test_group.id
    await db.flush()

    response = await client.get(
        f"/api/v1/admin/students?group_id={test_group.id}",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1


@pytest.mark.asyncio
async def test_get_student_payments_with_data(
    client: AsyncClient, test_admin: User, test_student: User, db: AsyncSession
) -> None:
    p = Payment(
        student_id=test_student.id,
        institution_id=test_admin.institution_id,
        installment_no=1,
        amount=5000,
        due_date=date(2026, 5, 1),
        status=PaymentStatus.PENDING,
    )
    db.add(p)
    await db.flush()

    response = await client.get(
        f"/api/v1/admin/students/{test_student.id}/payments",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert data[0]["student_name"] == test_student.full_name
    assert data[0]["installment_no"] == 1


# ══════════════════════════════════════════════════════════════════════
# Group endpoints -- deep
# ══════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_create_group_with_advisor(
    client: AsyncClient, test_admin: User, test_teacher: User
) -> None:
    response = await client.post(
        "/api/v1/admin/groups",
        json={
            "name": "9-B",
            "grade_level": "9",
            "field": "Sayisal",
            "academic_year": "2025-2026",
            "max_capacity": 25,
            "classroom": "B-101",
            "advisor_id": str(test_teacher.id),
        },
        headers=auth_header(test_admin),
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "9-B"
    assert data["advisor_name"] == test_teacher.full_name
    assert data["student_count"] == 0


@pytest.mark.asyncio
async def test_update_group_change_status(
    client: AsyncClient, test_admin: User, test_group: Group
) -> None:
    response = await client.put(
        f"/api/v1/admin/groups/{test_group.id}",
        json={"status": "passive", "max_capacity": 35},
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "passive"
    assert data["max_capacity"] == 35


@pytest.mark.asyncio
async def test_update_group_not_found(client: AsyncClient, test_admin: User) -> None:
    response = await client.put(
        f"/api/v1/admin/groups/{uuid.uuid4()}",
        json={"name": "Nonexistent"},
        headers=auth_header(test_admin),
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_delete_group_not_found(client: AsyncClient, test_admin: User) -> None:
    response = await client.delete(
        f"/api/v1/admin/groups/{uuid.uuid4()}",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_assign_students_to_group(
    client: AsyncClient, test_admin: User, test_group: Group, test_student: User
) -> None:
    response = await client.post(
        f"/api/v1/admin/groups/{test_group.id}/students",
        json={"student_ids": [str(test_student.id)]},
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


@pytest.mark.asyncio
async def test_assign_students_group_not_found(
    client: AsyncClient, test_admin: User, test_student: User
) -> None:
    response = await client.post(
        f"/api/v1/admin/groups/{uuid.uuid4()}/students",
        json={"student_ids": [str(test_student.id)]},
        headers=auth_header(test_admin),
    )
    assert response.status_code == 404


# ══════════════════════════════════════════════════════════════════════
# Schedule endpoints -- deep
# ══════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_create_schedule_teacher_conflict_different_day(
    client: AsyncClient,
    test_admin: User,
    test_group: Group,
    test_subject: Subject,
    test_teacher: User,
    db: AsyncSession,
) -> None:
    """Same teacher on different day should succeed."""
    # Create first schedule
    s = GroupSchedule(
        group_id=test_group.id,
        subject_id=test_subject.id,
        teacher_id=test_teacher.id,
        day_of_week=1,
        start_time=time(9, 0),
        end_time=time(10, 0),
    )
    db.add(s)
    await db.flush()

    # Create a second group
    g2 = Group(
        name="Diff-Day-Group",
        grade_level="9",
        academic_year="2025-2026",
        institution_id=test_admin.institution_id,
    )
    db.add(g2)
    await db.flush()

    # Different day -- should succeed
    response = await client.post(
        "/api/v1/admin/schedules",
        json={
            "group_id": str(g2.id),
            "subject_id": str(test_subject.id),
            "teacher_id": str(test_teacher.id),
            "day_of_week": 2,
            "start_time": "09:00",
            "end_time": "10:00",
        },
        headers=auth_header(test_admin),
    )
    assert response.status_code == 201


@pytest.mark.asyncio
async def test_create_schedule_same_teacher_same_time_conflict(
    client: AsyncClient,
    test_admin: User,
    test_group: Group,
    test_subject: Subject,
    test_teacher: User,
    db: AsyncSession,
) -> None:
    """Same teacher, same day, overlapping time should fail 409."""
    s = GroupSchedule(
        group_id=test_group.id,
        subject_id=test_subject.id,
        teacher_id=test_teacher.id,
        day_of_week=3,
        start_time=time(9, 0),
        end_time=time(10, 0),
    )
    db.add(s)
    await db.flush()

    g2 = Group(
        name="Conflict-Group",
        grade_level="10",
        academic_year="2025-2026",
        institution_id=test_admin.institution_id,
    )
    db.add(g2)
    await db.flush()

    response = await client.post(
        "/api/v1/admin/schedules",
        json={
            "group_id": str(g2.id),
            "subject_id": str(test_subject.id),
            "teacher_id": str(test_teacher.id),
            "day_of_week": 3,
            "start_time": "09:30",
            "end_time": "10:30",
        },
        headers=auth_header(test_admin),
    )
    assert response.status_code == 409


@pytest.mark.asyncio
async def test_create_schedule_group_not_found(
    client: AsyncClient,
    test_admin: User,
    test_subject: Subject,
    test_teacher: User,
) -> None:
    response = await client.post(
        "/api/v1/admin/schedules",
        json={
            "group_id": str(uuid.uuid4()),
            "subject_id": str(test_subject.id),
            "teacher_id": str(test_teacher.id),
            "day_of_week": 1,
            "start_time": "10:00",
            "end_time": "11:00",
        },
        headers=auth_header(test_admin),
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_update_schedule_fields(
    client: AsyncClient,
    test_admin: User,
    test_group: Group,
    test_subject: Subject,
    test_teacher: User,
    db: AsyncSession,
) -> None:
    s = GroupSchedule(
        group_id=test_group.id,
        subject_id=test_subject.id,
        teacher_id=test_teacher.id,
        day_of_week=4,
        start_time=time(13, 0),
        end_time=time(14, 0),
    )
    db.add(s)
    await db.flush()

    response = await client.put(
        f"/api/v1/admin/schedules/{s.id}",
        json={
            "day_of_week": 5,
            "start_time": "14:00",
            "end_time": "15:00",
            "classroom": "C-301",
        },
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    data = response.json()
    assert data["day_of_week"] == 5
    assert data["classroom"] == "C-301"


# ══════════════════════════════════════════════════════════════════════
# Payment endpoints -- deep
# ══════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_create_bulk_payments_single_installment(
    client: AsyncClient, test_admin: User, test_student: User
) -> None:
    response = await client.post(
        "/api/v1/admin/payments/bulk",
        json={
            "student_id": str(test_student.id),
            "total_amount": 5000,
            "installment_count": 1,
            "start_date": "2026-06-01",
        },
        headers=auth_header(test_admin),
    )
    assert response.status_code == 201
    data = response.json()
    assert len(data) == 1
    assert float(data[0]["amount"]) == 5000
    assert data[0]["installment_no"] == 1


@pytest.mark.asyncio
async def test_create_bulk_payments_12_installments(
    client: AsyncClient, test_admin: User, test_student: User
) -> None:
    response = await client.post(
        "/api/v1/admin/payments/bulk",
        json={
            "student_id": str(test_student.id),
            "total_amount": 24000,
            "installment_count": 12,
            "start_date": "2026-01-01",
        },
        headers=auth_header(test_admin),
    )
    assert response.status_code == 201
    data = response.json()
    assert len(data) == 12
    total = sum(float(p["amount"]) for p in data)
    assert abs(total - 24000) < 0.01
    # Check installment numbers sequential
    for i, p in enumerate(data):
        assert p["installment_no"] == i + 1


@pytest.mark.asyncio
async def test_bulk_payments_with_50_percent_discount(
    client: AsyncClient, test_admin: User, test_student: User
) -> None:
    response = await client.post(
        "/api/v1/admin/payments/bulk",
        json={
            "student_id": str(test_student.id),
            "total_amount": 10000,
            "discount_rate": 50,
            "discount_description": "Kardes indirimi",
            "installment_count": 2,
            "start_date": "2026-06-01",
            "notes": "Ekstra not",
        },
        headers=auth_header(test_admin),
    )
    assert response.status_code == 201
    data = response.json()
    total = sum(float(p["amount"]) for p in data)
    assert abs(total - 5000) < 0.01
    # Check notes contain discount info
    assert data[0]["notes"] is not None


@pytest.mark.asyncio
async def test_update_payment_creates_cash_entry(
    client: AsyncClient, test_admin: User, test_student: User, db: AsyncSession
) -> None:
    payment = Payment(
        student_id=test_student.id,
        institution_id=test_admin.institution_id,
        installment_no=1,
        amount=4000,
        due_date=date(2026, 7, 1),
        status=PaymentStatus.PENDING,
    )
    db.add(payment)
    await db.flush()

    response = await client.put(
        f"/api/v1/admin/payments/{payment.id}",
        json={
            "status": "paid",
            "paid_date": "2026-06-28",
            "payment_method": "cash",
        },
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "paid"
    assert data["payment_method"] == "cash"


@pytest.mark.asyncio
async def test_list_payments_filter_by_student(
    client: AsyncClient, test_admin: User, test_student: User, db: AsyncSession
) -> None:
    p = Payment(
        student_id=test_student.id,
        institution_id=test_admin.institution_id,
        installment_no=1,
        amount=3000,
        due_date=date(2026, 8, 1),
        status=PaymentStatus.PENDING,
    )
    db.add(p)
    await db.flush()

    response = await client.get(
        f"/api/v1/admin/payments?student_id={test_student.id}",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert all(str(p["student_id"]) == str(test_student.id) for p in data)


# ══════════════════════════════════════════════════════════════════════
# Expense endpoints -- deep
# ══════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_create_expense_creates_cash_entry(
    client: AsyncClient, test_admin: User
) -> None:
    response = await client.post(
        "/api/v1/admin/expenses",
        json={
            "category": "maintenance",
            "amount": 2500,
            "description": "Klima tamiri",
            "vendor": "Klima Servis",
            "expense_date": "2026-04-10",
            "payment_method": "cash",
            "receipt_no": "REC-001",
            "notes": "Acil tamir",
        },
        headers=auth_header(test_admin),
    )
    assert response.status_code == 201
    data = response.json()
    assert data["category"] == "maintenance"
    assert data["amount"] == 2500


# ══════════════════════════════════════════════════════════════════════
# Teacher payment (payroll) endpoints -- deep
# ══════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_create_teacher_payment_calculation(
    client: AsyncClient, test_admin: User, test_teacher: User
) -> None:
    response = await client.post(
        "/api/v1/admin/teacher-payments",
        json={
            "teacher_id": str(test_teacher.id),
            "period": "2026-04",
            "base_salary": 12000,
            "lesson_count": 30,
            "per_lesson_rate": 150,
            "bonus": 1000,
            "deduction": 500,
            "notes": "Nisan maasi",
        },
        headers=auth_header(test_admin),
    )
    assert response.status_code == 201
    data = response.json()
    # total = 12000 + (30*150) + 1000 - 500 = 17000
    assert data["total_amount"] == 17000
    assert data["lesson_total"] == 4500
    assert data["status"] == "pending"
    assert data["notes"] == "Nisan maasi"


@pytest.mark.asyncio
async def test_mark_teacher_payment_update_notes(
    client: AsyncClient, test_admin: User, test_teacher: User, db: AsyncSession
) -> None:
    tp = TeacherPayment(
        teacher_id=test_teacher.id,
        institution_id=test_admin.institution_id,
        period="2026-05",
        base_salary=10000,
        lesson_count=0,
        per_lesson_rate=0,
        lesson_total=0,
        bonus=0,
        deduction=0,
        total_amount=10000,
        status=TeacherPaymentStatus.PENDING,
    )
    db.add(tp)
    await db.flush()

    response = await client.put(
        f"/api/v1/admin/teacher-payments/{tp.id}",
        json={
            "notes": "Mayis maasi guncellendi",
            "paid_date": "2026-05-01",
            "payment_method": "bank_transfer",
        },
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "pending"


@pytest.mark.asyncio
async def test_teacher_payroll_summary_by_period(
    client: AsyncClient, test_admin: User, test_teacher: User, db: AsyncSession
) -> None:
    tp = TeacherPayment(
        teacher_id=test_teacher.id,
        institution_id=test_admin.institution_id,
        period="2026-06",
        base_salary=10000,
        total_amount=10000,
    )
    db.add(tp)
    await db.flush()

    response = await client.get(
        "/api/v1/admin/teacher-payments/summary?period=2026-06",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    data = response.json()
    assert data["total_teachers"] >= 1
    assert data["total_amount"] >= 10000
    assert "paid_amount" in data
    assert "pending_amount" in data


@pytest.mark.asyncio
async def test_list_teacher_payments_filter_by_period(
    client: AsyncClient, test_admin: User, test_teacher: User, db: AsyncSession
) -> None:
    tp = TeacherPayment(
        teacher_id=test_teacher.id,
        institution_id=test_admin.institution_id,
        period="2026-07",
        base_salary=8000,
        total_amount=8000,
    )
    db.add(tp)
    await db.flush()

    response = await client.get(
        "/api/v1/admin/teacher-payments?period=2026-07",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert data[0]["period"] == "2026-07"


@pytest.mark.asyncio
async def test_list_teacher_payments_filter_by_teacher(
    client: AsyncClient, test_admin: User, test_teacher: User, db: AsyncSession
) -> None:
    tp = TeacherPayment(
        teacher_id=test_teacher.id,
        institution_id=test_admin.institution_id,
        period="2026-08",
        base_salary=7000,
        total_amount=7000,
    )
    db.add(tp)
    await db.flush()

    response = await client.get(
        f"/api/v1/admin/teacher-payments?teacher_id={test_teacher.id}",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1


@pytest.mark.asyncio
async def test_list_teacher_payments_filter_by_status(
    client: AsyncClient, test_admin: User, test_teacher: User, db: AsyncSession
) -> None:
    tp = TeacherPayment(
        teacher_id=test_teacher.id,
        institution_id=test_admin.institution_id,
        period="2026-09",
        base_salary=9000,
        total_amount=9000,
        status=TeacherPaymentStatus.PENDING,
    )
    db.add(tp)
    await db.flush()

    response = await client.get(
        "/api/v1/admin/teacher-payments?status=pending",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1


# ══════════════════════════════════════════════════════════════════════
# Cash ledger endpoints -- deep
# ══════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_cash_ledger_manual_entry(client: AsyncClient, test_admin: User) -> None:
    response = await client.post(
        "/api/v1/admin/cash-ledger",
        json={
            "entry_type": "income",
            "amount": 25000,
            "description": "Elle girilen gelir",
            "category": "other_income",
            "entry_date": "2026-04-01",
            "payment_method": "cash",
        },
        headers=auth_header(test_admin),
    )
    assert response.status_code == 201
    data = response.json()
    assert data["entry_type"] == "income"
    assert data["amount"] == 25000


@pytest.mark.asyncio
async def test_cash_ledger_summary_date_range(
    client: AsyncClient, test_admin: User
) -> None:
    # Create entries first
    await client.post(
        "/api/v1/admin/cash-ledger",
        json={
            "entry_type": "income",
            "amount": 5000,
            "description": "Gelir",
            "category": "student_payment",
            "entry_date": "2026-05-15",
        },
        headers=auth_header(test_admin),
    )

    response = await client.get(
        "/api/v1/admin/cash-ledger/summary?date_from=2026-05-01&date_to=2026-05-31",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    data = response.json()
    assert "total_income" in data
    assert "total_expense" in data
    assert "balance" in data
    assert data["period_start"] == "2026-05-01"
    assert data["period_end"] == "2026-05-31"


@pytest.mark.asyncio
async def test_cash_ledger_filter_by_type(
    client: AsyncClient, test_admin: User
) -> None:
    await client.post(
        "/api/v1/admin/cash-ledger",
        json={
            "entry_type": "expense",
            "amount": 1500,
            "description": "Gider kaydi",
            "category": "expense",
            "entry_date": "2026-06-01",
        },
        headers=auth_header(test_admin),
    )

    response = await client.get(
        "/api/v1/admin/cash-ledger?entry_type=expense",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    data = response.json()
    assert all(e["entry_type"] == "expense" for e in data)


@pytest.mark.asyncio
async def test_cash_ledger_filter_by_category(
    client: AsyncClient, test_admin: User
) -> None:
    await client.post(
        "/api/v1/admin/cash-ledger",
        json={
            "entry_type": "income",
            "amount": 3000,
            "description": "Ogrenci odeme",
            "category": "student_payment",
            "entry_date": "2026-06-05",
        },
        headers=auth_header(test_admin),
    )

    response = await client.get(
        "/api/v1/admin/cash-ledger?category=student_payment",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    data = response.json()
    assert all(e["category"] == "student_payment" for e in data)


@pytest.mark.asyncio
async def test_cash_ledger_filter_by_date_range(
    client: AsyncClient, test_admin: User
) -> None:
    await client.post(
        "/api/v1/admin/cash-ledger",
        json={
            "entry_type": "income",
            "amount": 2000,
            "description": "Tarih filtre test",
            "category": "other",
            "entry_date": "2026-07-15",
        },
        headers=auth_header(test_admin),
    )

    response = await client.get(
        "/api/v1/admin/cash-ledger?date_from=2026-07-01&date_to=2026-07-31",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200


# ══════════════════════════════════════════════════════════════════════
# Announcement endpoints -- deep
# ══════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_create_announcement_with_expiry(
    client: AsyncClient, test_admin: User
) -> None:
    response = await client.post(
        "/api/v1/admin/announcements",
        json={
            "title": "Expiry Duyuru",
            "content": "Bu duyuru surereli.",
            "target_role": "student",
            "priority": "urgent",
            "expires_at": "2026-12-31T23:59:59",
        },
        headers=auth_header(test_admin),
    )
    assert response.status_code == 201
    data = response.json()
    assert data["priority"] == "urgent"
    assert data["target_role"] == "student"
    assert data["expires_at"] is not None


@pytest.mark.asyncio
async def test_create_announcement_target_parent(
    client: AsyncClient, test_admin: User
) -> None:
    response = await client.post(
        "/api/v1/admin/announcements",
        json={
            "title": "Veli Toplantisi",
            "content": "Yarin veli toplantisi var.",
            "target_role": "parent",
        },
        headers=auth_header(test_admin),
    )
    assert response.status_code == 201
    assert response.json()["target_role"] == "parent"


@pytest.mark.asyncio
async def test_update_announcement_change_priority(
    client: AsyncClient, test_admin: User, db: AsyncSession
) -> None:
    ann = Announcement(
        title="Priority Test",
        content="Content",
        institution_id=test_admin.institution_id,
        target_role=AnnouncementTarget.ALL,
        priority=AnnouncementPriority.NORMAL,
        created_by=test_admin.id,
    )
    db.add(ann)
    await db.flush()

    response = await client.put(
        f"/api/v1/admin/announcements/{ann.id}",
        json={"priority": "important", "target_role": "teacher"},
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    data = response.json()
    assert data["priority"] == "important"
    assert data["target_role"] == "teacher"


# ══════════════════════════════════════════════════════════════════════
# Attendance endpoints -- deep
# ══════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_record_attendance_all_statuses(
    client: AsyncClient,
    test_admin: User,
    test_group: Group,
    test_subject: Subject,
    test_teacher: User,
    db: AsyncSession,
) -> None:
    schedule = GroupSchedule(
        group_id=test_group.id,
        subject_id=test_subject.id,
        teacher_id=test_teacher.id,
        day_of_week=1,
        start_time=time(9, 0),
        end_time=time(10, 0),
    )
    db.add(schedule)

    s1 = User(
        email="att_s1@test.com",
        password_hash=hash_password("x"),
        full_name="S1",
        role=UserRole.STUDENT,
        institution_id=test_admin.institution_id,
    )
    s2 = User(
        email="att_s2@test.com",
        password_hash=hash_password("x"),
        full_name="S2",
        role=UserRole.STUDENT,
        institution_id=test_admin.institution_id,
    )
    s3 = User(
        email="att_s3@test.com",
        password_hash=hash_password("x"),
        full_name="S3",
        role=UserRole.STUDENT,
        institution_id=test_admin.institution_id,
    )
    s4 = User(
        email="att_s4@test.com",
        password_hash=hash_password("x"),
        full_name="S4",
        role=UserRole.STUDENT,
        institution_id=test_admin.institution_id,
    )
    db.add_all([s1, s2, s3, s4])
    await db.flush()

    response = await client.post(
        "/api/v1/admin/attendance",
        json={
            "schedule_id": str(schedule.id),
            "date": "2026-04-01",
            "entries": [
                {"student_id": str(s1.id), "status": "present"},
                {"student_id": str(s2.id), "status": "absent", "note": "Hasta"},
                {"student_id": str(s3.id), "status": "late"},
                {"student_id": str(s4.id), "status": "excused", "note": "Raporu var"},
            ],
        },
        headers=auth_header(test_admin),
    )
    assert response.status_code == 201
    data = response.json()
    assert data["count"] == "4"


@pytest.mark.asyncio
async def test_list_attendance_filter_by_schedule(
    client: AsyncClient,
    test_admin: User,
    test_student: User,
    test_group: Group,
    test_subject: Subject,
    test_teacher: User,
    db: AsyncSession,
) -> None:
    schedule = GroupSchedule(
        group_id=test_group.id,
        subject_id=test_subject.id,
        teacher_id=test_teacher.id,
        day_of_week=2,
        start_time=time(11, 0),
        end_time=time(12, 0),
    )
    db.add(schedule)
    await db.flush()

    await client.post(
        "/api/v1/admin/attendance",
        json={
            "schedule_id": str(schedule.id),
            "date": "2026-04-07",
            "entries": [
                {"student_id": str(test_student.id), "status": "present"},
            ],
        },
        headers=auth_header(test_admin),
    )

    response = await client.get(
        f"/api/v1/admin/attendance?schedule_id={schedule.id}",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1


@pytest.mark.asyncio
async def test_list_attendance_filter_by_group_id(
    client: AsyncClient,
    test_admin: User,
    test_student: User,
    test_group: Group,
    test_subject: Subject,
    test_teacher: User,
    db: AsyncSession,
) -> None:
    schedule = GroupSchedule(
        group_id=test_group.id,
        subject_id=test_subject.id,
        teacher_id=test_teacher.id,
        day_of_week=3,
        start_time=time(13, 0),
        end_time=time(14, 0),
    )
    db.add(schedule)
    await db.flush()

    await client.post(
        "/api/v1/admin/attendance",
        json={
            "schedule_id": str(schedule.id),
            "date": "2026-04-08",
            "entries": [
                {"student_id": str(test_student.id), "status": "present"},
            ],
        },
        headers=auth_header(test_admin),
    )

    response = await client.get(
        f"/api/v1/admin/attendance?group_id={test_group.id}",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_attendance_summary_calculates_rate(
    client: AsyncClient,
    test_admin: User,
    test_student: User,
    test_group: Group,
    test_subject: Subject,
    test_teacher: User,
    db: AsyncSession,
) -> None:
    schedule = GroupSchedule(
        group_id=test_group.id,
        subject_id=test_subject.id,
        teacher_id=test_teacher.id,
        day_of_week=4,
        start_time=time(9, 0),
        end_time=time(10, 0),
    )
    db.add(schedule)
    await db.flush()

    # 2 present, 1 absent => rate 66.7%
    for d, st in [
        ("2026-04-09", "present"),
        ("2026-04-10", "present"),
        ("2026-04-11", "absent"),
    ]:
        await client.post(
            "/api/v1/admin/attendance",
            json={
                "schedule_id": str(schedule.id),
                "date": d,
                "entries": [{"student_id": str(test_student.id), "status": st}],
            },
            headers=auth_header(test_admin),
        )

    response = await client.get(
        f"/api/v1/admin/attendance/summary?group_id={test_group.id}",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    s = data[0]
    assert s["total_lessons"] == 3
    assert s["present"] == 2
    assert s["absent"] == 1
    assert s["attendance_rate"] > 60


# ══════════════════════════════════════════════════════════════════════
# Lead endpoints -- deep
# ══════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_create_lead_with_all_fields(
    client: AsyncClient, test_admin: User
) -> None:
    response = await client.post(
        "/api/v1/admin/leads",
        json={
            "student_name": "Full Lead Student",
            "parent_name": "Full Lead Parent",
            "phone": "5550001234",
            "email": "fulllead@test.com",
            "grade_level": "10",
            "target_exam": "YKS-Sayisal",
            "current_school": "Galatasaray Lisesi",
            "source": "website",
            "notes": "Websiteden basvurdu",
        },
        headers=auth_header(test_admin),
    )
    assert response.status_code == 201
    data = response.json()
    assert data["student_name"] == "Full Lead Student"
    assert data["parent_name"] == "Full Lead Parent"
    assert data["source"] == "website"
    assert data["status"] == "new"
    assert data["current_school"] == "Galatasaray Lisesi"


@pytest.mark.asyncio
async def test_update_lead_through_statuses(
    client: AsyncClient, test_admin: User, db: AsyncSession
) -> None:
    lead = Lead(
        institution_id=test_admin.institution_id,
        student_name="Status Transition Lead",
        phone="5550009999",
        source=LeadSource.PHONE,
    )
    db.add(lead)
    await db.flush()

    # new -> contacted
    response = await client.put(
        f"/api/v1/admin/leads/{lead.id}",
        json={"status": "contacted"},
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    assert response.json()["status"] == "contacted"

    # contacted -> consultation_scheduled
    response = await client.put(
        f"/api/v1/admin/leads/{lead.id}",
        json={"status": "consultation_scheduled", "consultation_date": "2026-04-15"},
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    assert response.json()["status"] == "consultation_scheduled"

    # consultation_scheduled -> consultation_done
    response = await client.put(
        f"/api/v1/admin/leads/{lead.id}",
        json={"status": "consultation_done", "consultation_score": 8},
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    assert response.json()["status"] == "consultation_done"


@pytest.mark.asyncio
async def test_add_multiple_lead_notes(
    client: AsyncClient, test_admin: User, db: AsyncSession
) -> None:
    lead = Lead(
        institution_id=test_admin.institution_id,
        student_name="Multi Note Lead",
        phone="5550007777",
        source=LeadSource.WALK_IN,
    )
    db.add(lead)
    await db.flush()

    for i in range(3):
        response = await client.post(
            f"/api/v1/admin/leads/{lead.id}/notes",
            json={"content": f"Note {i + 1}"},
            headers=auth_header(test_admin),
        )
        assert response.status_code == 201
        assert response.json()["content"] == f"Note {i + 1}"


@pytest.mark.asyncio
async def test_convert_lead_creates_student(
    client: AsyncClient, test_admin: User, db: AsyncSession
) -> None:
    lead = Lead(
        institution_id=test_admin.institution_id,
        student_name="Convert Lead",
        phone="5550008888",
        email="convert_new@test.com",
        grade_level="11",
        target_exam="YKS-EA",
        current_school="Bir Lise",
        source=LeadSource.REFERRAL,
        status=LeadStatus.CONSULTATION_DONE,
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
    assert data["email"] == "convert_new@test.com"


@pytest.mark.asyncio
async def test_convert_lead_not_found(client: AsyncClient, test_admin: User) -> None:
    response = await client.post(
        f"/api/v1/admin/leads/{uuid.uuid4()}/convert",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_lead_filter_by_source(
    client: AsyncClient, test_admin: User, db: AsyncSession
) -> None:
    lead = Lead(
        institution_id=test_admin.institution_id,
        student_name="Source Filter Lead",
        phone="5550003333",
        source=LeadSource.REFERRAL,
    )
    db.add(lead)
    await db.flush()

    response = await client.get(
        "/api/v1/admin/leads?source=referral",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    data = response.json()
    assert all(item["source"] == "referral" for item in data)


@pytest.mark.asyncio
async def test_lead_filter_by_assigned_to(
    client: AsyncClient, test_admin: User, db: AsyncSession
) -> None:
    lead = Lead(
        institution_id=test_admin.institution_id,
        student_name="Assigned Lead",
        phone="5550004444",
        source=LeadSource.PHONE,
        assigned_to=test_admin.id,
    )
    db.add(lead)
    await db.flush()

    response = await client.get(
        f"/api/v1/admin/leads?assigned_to={test_admin.id}",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1


# ══════════════════════════════════════════════════════════════════════
# Report endpoints -- deep
# ══════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_report_overview_with_data(
    client: AsyncClient,
    test_admin: User,
    test_student: User,
    test_teacher: User,
    test_group: Group,
    db: AsyncSession,
) -> None:
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
    assert data["students"]["total"] >= 1
    assert data["teachers"]["total"] >= 1


@pytest.mark.asyncio
async def test_report_financial_monthly_with_payments(
    client: AsyncClient, test_admin: User, test_student: User, db: AsyncSession
) -> None:
    p1 = Payment(
        student_id=test_student.id,
        institution_id=test_admin.institution_id,
        installment_no=1,
        amount=5000,
        due_date=date(2026, 3, 1),
        status=PaymentStatus.PAID,
        paid_date=date(2026, 3, 5),
    )
    p2 = Payment(
        student_id=test_student.id,
        institution_id=test_admin.institution_id,
        installment_no=2,
        amount=5000,
        due_date=date(2026, 4, 1),
        status=PaymentStatus.PENDING,
    )
    db.add_all([p1, p2])
    await db.flush()

    response = await client.get(
        "/api/v1/admin/reports/financial-monthly",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    assert "year" in data[0]
    assert "month" in data[0]
    assert "month_name" in data[0]
    assert "expected" in data[0]
    assert "collected" in data[0]


@pytest.mark.asyncio
async def test_report_attendance_by_group(
    client: AsyncClient,
    test_admin: User,
    test_student: User,
    test_group: Group,
    test_subject: Subject,
    test_teacher: User,
    db: AsyncSession,
) -> None:
    schedule = GroupSchedule(
        group_id=test_group.id,
        subject_id=test_subject.id,
        teacher_id=test_teacher.id,
        day_of_week=1,
        start_time=time(8, 0),
        end_time=time(9, 0),
    )
    db.add(schedule)
    await db.flush()

    att = Attendance(
        schedule_id=schedule.id,
        student_id=test_student.id,
        date=date(2026, 4, 1),
        status=AttendanceStatus.PRESENT,
        noted_by=test_admin.id,
    )
    db.add(att)
    await db.flush()

    response = await client.get(
        "/api/v1/admin/reports/attendance-by-group",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    assert "group_name" in data[0]
    assert "attendance_rate" in data[0]


@pytest.mark.asyncio
async def test_report_student_enrollment_distribution(
    client: AsyncClient, test_admin: User, test_student: User
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
async def test_report_financial_detailed_with_date_range(
    client: AsyncClient, test_admin: User
) -> None:
    response = await client.get(
        "/api/v1/admin/reports/financial-detailed?date_from=2026-01-01&date_to=2026-12-31",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    data = response.json()
    assert "student_income" in data
    assert "total_expenses" in data
    assert "expenses_by_category" in data
    assert "teacher_salaries" in data
    assert "net_profit" in data


# ══════════════════════════════════════════════════════════════════════
# Import endpoints -- deep
# ══════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_download_student_template(client: AsyncClient, test_admin: User) -> None:
    response = await client.get(
        "/api/v1/admin/import/template/students",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    assert "text/csv" in response.headers.get("content-type", "")
    content = response.text
    assert "ad_soyad" in content
    assert "email" in content


@pytest.mark.asyncio
async def test_download_teacher_template(client: AsyncClient, test_admin: User) -> None:
    response = await client.get(
        "/api/v1/admin/import/template/teachers",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    assert "text/csv" in response.headers.get("content-type", "")
    content = response.text
    assert "ad_soyad" in content
    assert "calisma_turu" in content


@pytest.mark.asyncio
async def test_download_template_invalid_type(
    client: AsyncClient, test_admin: User
) -> None:
    response = await client.get(
        "/api/v1/admin/import/template/invalid",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_import_students_csv(client: AsyncClient, test_admin: User) -> None:
    import io

    unique = uuid.uuid4().hex[:6]
    csv_content = (
        "ad_soyad,email,telefon,tc_no,dogum_tarihi,cinsiyet,okul,kademe,hedef_sinav,"
        "veli_adi,veli_telefon,veli_yakinlik\n"
        f"Ali Yilmaz,ali_imp_{unique}@test.com,05551234567,12345678901,,,,"
        "8,LGS,Ayse Yilmaz,05559876543,Anne\n"
        f"Veli Demir,veli_imp_{unique}@test.com,05559999999,,,,,,,,\n"
    )
    response = await client.post(
        "/api/v1/admin/import/students",
        files={"file": ("students.csv", io.BytesIO(csv_content.encode()), "text/csv")},
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    data = response.json()
    assert data["created"] >= 2
    assert isinstance(data["errors"], list)


@pytest.mark.asyncio
async def test_import_teachers_csv(client: AsyncClient, test_admin: User) -> None:
    csv_content = (
        "ad_soyad,email,telefon,tc_no,universite,bolum,calisma_turu,maas_tipi,maas_tutari\n"
        "Mehmet Oz,mehmet_imp@test.com,05551112233,98765432101,Istanbul Uni,Matematik,"
        "full_time,fixed,15000\n"
    )
    import io

    response = await client.post(
        "/api/v1/admin/import/teachers",
        files={"file": ("teachers.csv", io.BytesIO(csv_content.encode()), "text/csv")},
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    data = response.json()
    assert data["created"] >= 1


@pytest.mark.asyncio
async def test_import_invalid_csv(client: AsyncClient, test_admin: User) -> None:
    csv_content = "ad_soyad,email\n,\n"  # missing required fields
    import io

    response = await client.post(
        "/api/v1/admin/import/students",
        files={"file": ("bad.csv", io.BytesIO(csv_content.encode()), "text/csv")},
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    data = response.json()
    # Should have errors for rows with missing data
    assert len(data["errors"]) >= 1


# ══════════════════════════════════════════════════════════════════════
# Admin user/role endpoints -- deep
# ══════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_list_admin_users(client: AsyncClient, test_admin: User) -> None:
    response = await client.get(
        "/api/v1/admin/admin-users",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert data[0]["email"] == test_admin.email


@pytest.mark.asyncio
async def test_create_admin_user_with_roles(
    client: AsyncClient, test_admin: User, db: AsyncSession
) -> None:
    role = AdminRole(name="Test Role", institution_id=test_admin.institution_id)
    db.add(role)
    await db.flush()

    response = await client.post(
        "/api/v1/admin/admin-users",
        json={
            "email": "roled_admin@test.com",
            "password": "admin123",
            "full_name": "Roled Admin",
            "phone": "5551234567",
            "role_ids": [str(role.id)],
        },
        headers=auth_header(test_admin),
    )
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "roled_admin@test.com"


@pytest.mark.asyncio
async def test_assign_roles_to_admin(
    client: AsyncClient, test_admin: User, db: AsyncSession
) -> None:
    # Create another admin
    admin2 = User(
        email="admin_roles@test.com",
        password_hash=hash_password("test123"),
        full_name="Admin For Roles",
        role=UserRole.ADMIN,
        institution_id=test_admin.institution_id,
    )
    db.add(admin2)

    role = AdminRole(name="Assign Role", institution_id=test_admin.institution_id)
    db.add(role)
    await db.flush()

    response = await client.put(
        f"/api/v1/admin/admin-users/{admin2.id}/roles",
        json=[str(role.id)],
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


@pytest.mark.asyncio
async def test_assign_roles_admin_not_found(
    client: AsyncClient, test_admin: User
) -> None:
    response = await client.put(
        f"/api/v1/admin/admin-users/{uuid.uuid4()}/roles",
        json=[],
        headers=auth_header(test_admin),
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_reset_user_password(
    client: AsyncClient, test_admin: User, test_student: User
) -> None:
    response = await client.put(
        f"/api/v1/admin/users/{test_student.id}/reset-password",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    data = response.json()
    assert "temporary_password" in data
    assert "message" in data


@pytest.mark.asyncio
async def test_reset_password_not_found(client: AsyncClient, test_admin: User) -> None:
    response = await client.put(
        f"/api/v1/admin/users/{uuid.uuid4()}/reset-password",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 404


# ══════════════════════════════════════════════════════════════════════
# Audit log endpoints -- deep
# ══════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_audit_logs_created_on_actions(
    client: AsyncClient, test_admin: User
) -> None:
    # Creating a teacher should create an audit log
    await client.post(
        "/api/v1/admin/teachers",
        json={
            "email": "audit_teacher@test.com",
            "password": "pass123",
            "full_name": "Audit Teacher",
        },
        headers=auth_header(test_admin),
    )

    response = await client.get(
        "/api/v1/admin/audit-logs",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert data[0]["action"] in ("create", "update", "delete", "convert")


@pytest.mark.asyncio
async def test_list_audit_logs_filter_by_entity_type(
    client: AsyncClient, test_admin: User
) -> None:
    # Create something to generate logs
    await client.post(
        "/api/v1/admin/teachers",
        json={
            "email": "audit_filter@test.com",
            "password": "pass123",
            "full_name": "Audit Filter Teacher",
        },
        headers=auth_header(test_admin),
    )

    response = await client.get(
        "/api/v1/admin/audit-logs?entity_type=teacher",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    data = response.json()
    assert all(log["entity_type"] == "teacher" for log in data)


@pytest.mark.asyncio
async def test_list_audit_logs_filter_by_action(
    client: AsyncClient, test_admin: User
) -> None:
    response = await client.get(
        "/api/v1/admin/audit-logs?action=create",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_list_audit_logs_filter_by_user_id(
    client: AsyncClient, test_admin: User
) -> None:
    response = await client.get(
        f"/api/v1/admin/audit-logs?user_id={test_admin.id}",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200


# ══════════════════════════════════════════════════════════════════════
# Receipt endpoint -- deep
# ══════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_get_payment_receipt(
    client: AsyncClient, test_admin: User, test_student: User, db: AsyncSession
) -> None:
    payment = Payment(
        student_id=test_student.id,
        institution_id=test_admin.institution_id,
        installment_no=1,
        amount=6000,
        due_date=date(2026, 5, 1),
        status=PaymentStatus.PAID,
        paid_date=date(2026, 4, 28),
        payment_method="cash",
    )
    db.add(payment)
    await db.flush()

    response = await client.get(
        f"/api/v1/admin/payments/{payment.id}/receipt",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    data = response.json()
    assert "receipt_no" in data
    assert "institution" in data
    assert "student" in data
    assert "payment" in data
    assert data["student"]["name"] == test_student.full_name
    assert data["payment"]["amount"] == 6000


@pytest.mark.asyncio
async def test_receipt_not_found(client: AsyncClient, test_admin: User) -> None:
    response = await client.get(
        f"/api/v1/admin/payments/{uuid.uuid4()}/receipt",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 404


# ══════════════════════════════════════════════════════════════════════
# Permissions endpoint
# ══════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_list_available_permissions(
    client: AsyncClient, test_admin: User
) -> None:
    response = await client.get(
        "/api/v1/admin/permissions/available",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) > 0


# ══════════════════════════════════════════════════════════════════════
# Private lessons (admin) -- deep
# ══════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_list_private_lessons_filter_by_student(
    client: AsyncClient,
    test_admin: User,
    test_teacher: User,
    test_student: User,
    test_subject: Subject,
    test_institution,
    db: AsyncSession,
) -> None:
    pl = PrivateLesson(
        teacher_id=test_teacher.id,
        student_id=test_student.id,
        subject_id=test_subject.id,
        institution_id=test_institution.id,
        scheduled_at=datetime(2026, 5, 1, 10, 0, tzinfo=UTC),
        duration_minutes=60,
    )
    db.add(pl)
    await db.flush()

    response = await client.get(
        f"/api/v1/admin/private-lessons?student_id={test_student.id}",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1


@pytest.mark.asyncio
async def test_list_private_lessons_filter_by_teacher(
    client: AsyncClient,
    test_admin: User,
    test_teacher: User,
    test_student: User,
    test_subject: Subject,
    test_institution,
    db: AsyncSession,
) -> None:
    pl = PrivateLesson(
        teacher_id=test_teacher.id,
        student_id=test_student.id,
        subject_id=test_subject.id,
        institution_id=test_institution.id,
        scheduled_at=datetime(2026, 5, 2, 10, 0, tzinfo=UTC),
        duration_minutes=60,
    )
    db.add(pl)
    await db.flush()

    response = await client.get(
        f"/api/v1/admin/private-lessons?teacher_id={test_teacher.id}",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1


@pytest.mark.asyncio
async def test_list_private_lessons_filter_by_status(
    client: AsyncClient,
    test_admin: User,
    test_teacher: User,
    test_student: User,
    test_subject: Subject,
    test_institution,
    db: AsyncSession,
) -> None:
    pl = PrivateLesson(
        teacher_id=test_teacher.id,
        student_id=test_student.id,
        subject_id=test_subject.id,
        institution_id=test_institution.id,
        scheduled_at=datetime(2026, 5, 3, 10, 0, tzinfo=UTC),
        duration_minutes=60,
        status=PrivateLessonStatus.COMPLETED,
    )
    db.add(pl)
    await db.flush()

    response = await client.get(
        "/api/v1/admin/private-lessons?status=completed",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    data = response.json()
    assert all(item["status"] == "completed" for item in data)


# ══════════════════════════════════════════════════════════════════════
# Roles CRUD -- deep
# ══════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_create_role_with_permissions(
    client: AsyncClient, test_admin: User
) -> None:
    response = await client.post(
        "/api/v1/admin/roles",
        json={
            "name": "Accountant",
            "permissions": ["payments:read", "payments:write", "expenses:read"],
        },
        headers=auth_header(test_admin),
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Accountant"
    assert "payments:read" in data["permissions"]


@pytest.mark.asyncio
async def test_update_role(
    client: AsyncClient, test_admin: User, db: AsyncSession
) -> None:
    role = AdminRole(name="Old Role", institution_id=test_admin.institution_id)
    db.add(role)
    await db.flush()

    response = await client.put(
        f"/api/v1/admin/roles/{role.id}",
        json={"name": "Updated Role", "permissions": ["students:read"]},
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Updated Role"


@pytest.mark.asyncio
async def test_update_role_not_found(client: AsyncClient, test_admin: User) -> None:
    response = await client.put(
        f"/api/v1/admin/roles/{uuid.uuid4()}",
        json={"name": "nope"},
        headers=auth_header(test_admin),
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_delete_role(
    client: AsyncClient, test_admin: User, db: AsyncSession
) -> None:
    role = AdminRole(name="Delete Me", institution_id=test_admin.institution_id)
    db.add(role)
    await db.flush()

    response = await client.delete(
        f"/api/v1/admin/roles/{role.id}",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 204


@pytest.mark.asyncio
async def test_delete_role_not_found(client: AsyncClient, test_admin: User) -> None:
    response = await client.delete(
        f"/api/v1/admin/roles/{uuid.uuid4()}",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_list_roles_with_data(
    client: AsyncClient, test_admin: User, db: AsyncSession
) -> None:
    role = AdminRole(name="Visible Role", institution_id=test_admin.institution_id)
    db.add(role)
    await db.flush()

    response = await client.get(
        "/api/v1/admin/roles",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert any(r["name"] == "Visible Role" for r in data)


# ══════════════════════════════════════════════════════════════════════
# Parent account creation edge cases
# ══════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_create_parent_account_with_phone_only(
    client: AsyncClient, test_admin: User, test_student: User, db: AsyncSession
) -> None:
    """Guardian with phone but no email should still create account."""
    guardian = Guardian(
        student_id=test_student.id,
        full_name="Phone Only Veli",
        relation="Dede",
        phone="5551239876",
        email=None,
    )
    db.add(guardian)
    await db.flush()

    response = await client.post(
        f"/api/v1/admin/students/{test_student.id}/parent-account?guardian_id={guardian.id}",
        headers=auth_header(test_admin),
    )
    assert response.status_code == 201
    data = response.json()
    assert "temporary_password" in data
    assert data["guardian_name"] == "Phone Only Veli"
