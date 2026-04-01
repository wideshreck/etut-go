"""Deep tests for parent portal endpoints -- edge cases and data verification."""

from datetime import UTC, date, datetime, time

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.announcement import (
    Announcement,
    AnnouncementPriority,
    AnnouncementTarget,
)
from app.models.assignment import Assignment, AssignmentStatus, AssignmentType
from app.models.attendance import Attendance
from app.models.attendance import AttendanceStatus as AttStatus
from app.models.group import Group
from app.models.guardian import Guardian
from app.models.payment import Payment, PaymentStatus
from app.models.schedule import GroupSchedule
from app.models.subject import Subject
from app.models.user import User
from tests.conftest import auth_header


@pytest.fixture
async def parent_linked(
    db: AsyncSession, test_parent: User, test_student: User
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
async def test_parent_child_info_all_fields(
    client: AsyncClient,
    parent_linked: tuple[User, User],
    test_group: Group,
    db: AsyncSession,
) -> None:
    parent, student = parent_linked
    student.group_id = test_group.id
    student.grade_level = "8"
    student.target_exam = "LGS"
    student.school = "Test Okulu"
    student.enrollment_status = "active"
    await db.flush()

    response = await client.get(
        "/api/v1/parent/child",
        headers=auth_header(parent),
    )
    assert response.status_code == 200
    data = response.json()
    assert data["full_name"] == student.full_name
    assert data["email"] == student.email
    assert data["grade_level"] == "8"
    assert data["target_exam"] == "LGS"
    assert data["school"] == "Test Okulu"
    assert data["enrollment_status"] == "active"
    assert str(data["group_id"]) == str(test_group.id)


@pytest.mark.asyncio
async def test_parent_attendance_with_records(
    client: AsyncClient,
    parent_linked: tuple[User, User],
    test_teacher: User,
    test_subject: Subject,
    test_group: Group,
    db: AsyncSession,
) -> None:
    parent, student = parent_linked

    schedule = GroupSchedule(
        group_id=test_group.id,
        subject_id=test_subject.id,
        teacher_id=test_teacher.id,
        day_of_week=1,
        start_time=time(9, 0),
        end_time=time(10, 0),
    )
    db.add(schedule)
    await db.flush()

    for d, st in [
        (date(2026, 4, 1), AttStatus.PRESENT),
        (date(2026, 4, 2), AttStatus.ABSENT),
        (date(2026, 4, 3), AttStatus.LATE),
        (date(2026, 4, 4), AttStatus.EXCUSED),
    ]:
        att = Attendance(
            schedule_id=schedule.id,
            student_id=student.id,
            date=d,
            status=st,
            noted_by=test_teacher.id,
        )
        db.add(att)
    await db.flush()

    response = await client.get(
        "/api/v1/parent/attendance",
        headers=auth_header(parent),
    )
    assert response.status_code == 200
    data = response.json()
    assert data["summary"]["total"] == 4
    assert data["summary"]["present"] == 1
    assert data["summary"]["absent"] == 1
    assert data["summary"]["late"] == 1
    assert data["summary"]["excused"] == 1
    assert data["summary"]["attendance_rate"] == 50.0
    assert len(data["recent"]) == 4


@pytest.mark.asyncio
async def test_parent_assignments_with_status(
    client: AsyncClient,
    parent_linked: tuple[User, User],
    test_teacher: User,
    test_subject: Subject,
    test_group: Group,
    db: AsyncSession,
) -> None:
    parent, student = parent_linked

    assignment = Assignment(
        title="Parent View Assignment",
        description="Odev aciklamasi",
        assignment_type=AssignmentType.HOMEWORK,
        subject_id=test_subject.id,
        due_date=date(2026, 5, 10),
        teacher_id=test_teacher.id,
        group_id=test_group.id,
        institution_id=student.institution_id,
    )
    db.add(assignment)
    await db.flush()

    status = AssignmentStatus(
        assignment_id=assignment.id,
        student_id=student.id,
        is_completed=True,
        completed_at=datetime.now(tz=UTC),
        teacher_note="Iyi is!",
    )
    db.add(status)
    await db.flush()

    response = await client.get(
        "/api/v1/parent/assignments",
        headers=auth_header(parent),
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    a = data[0]
    assert a["title"] == "Parent View Assignment"
    assert a["is_completed"] is True
    assert a["teacher_note"] == "Iyi is!"
    assert a["teacher_name"] == test_teacher.full_name


@pytest.mark.asyncio
async def test_parent_announcements_includes_parent_target(
    client: AsyncClient,
    parent_linked: tuple[User, User],
    test_admin: User,
    db: AsyncSession,
) -> None:
    parent, _ = parent_linked

    ann_parent = Announcement(
        title="For Parents",
        content="Parent only",
        institution_id=test_admin.institution_id,
        target_role=AnnouncementTarget.PARENT,
        priority=AnnouncementPriority.NORMAL,
        created_by=test_admin.id,
    )
    ann_student = Announcement(
        title="For Students (parent sees)",
        content="Student too",
        institution_id=test_admin.institution_id,
        target_role=AnnouncementTarget.STUDENT,
        priority=AnnouncementPriority.NORMAL,
        created_by=test_admin.id,
    )
    ann_teacher = Announcement(
        title="For Teachers Only",
        content="Teacher only",
        institution_id=test_admin.institution_id,
        target_role=AnnouncementTarget.TEACHER,
        priority=AnnouncementPriority.NORMAL,
        created_by=test_admin.id,
    )
    ann_all = Announcement(
        title="For All",
        content="Everyone",
        institution_id=test_admin.institution_id,
        target_role=AnnouncementTarget.ALL,
        priority=AnnouncementPriority.NORMAL,
        created_by=test_admin.id,
    )
    db.add_all([ann_parent, ann_student, ann_teacher, ann_all])
    await db.flush()

    response = await client.get(
        "/api/v1/parent/announcements",
        headers=auth_header(parent),
    )
    assert response.status_code == 200
    data = response.json()
    titles = [a["title"] for a in data]
    assert "For Parents" in titles
    assert "For Students (parent sees)" in titles
    assert "For All" in titles
    assert "For Teachers Only" not in titles


@pytest.mark.asyncio
async def test_parent_payments_with_data(
    client: AsyncClient,
    parent_linked: tuple[User, User],
    db: AsyncSession,
) -> None:
    parent, student = parent_linked

    p1 = Payment(
        student_id=student.id,
        institution_id=student.institution_id,
        installment_no=1,
        amount=5000,
        due_date=date(2026, 3, 1),
        status=PaymentStatus.PAID,
        paid_date=date(2026, 3, 5),
        payment_method="cash",
    )
    p2 = Payment(
        student_id=student.id,
        institution_id=student.institution_id,
        installment_no=2,
        amount=5000,
        due_date=date(2026, 4, 1),
        status=PaymentStatus.PENDING,
    )
    db.add_all([p1, p2])
    await db.flush()

    response = await client.get(
        "/api/v1/parent/payments",
        headers=auth_header(parent),
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    assert data[0]["installment_no"] == 1
    assert data[0]["status"] == "paid"


@pytest.mark.asyncio
async def test_parent_schedule_with_group(
    client: AsyncClient,
    parent_linked: tuple[User, User],
    test_teacher: User,
    test_subject: Subject,
    test_group: Group,
    db: AsyncSession,
) -> None:
    parent, student = parent_linked
    student.group_id = test_group.id
    await db.flush()

    schedule = GroupSchedule(
        group_id=test_group.id,
        subject_id=test_subject.id,
        teacher_id=test_teacher.id,
        day_of_week=1,
        start_time=time(9, 0),
        end_time=time(10, 0),
        classroom="A-101",
    )
    db.add(schedule)
    await db.flush()

    response = await client.get(
        "/api/v1/parent/schedule",
        headers=auth_header(parent),
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert data[0]["subject_name"] == test_subject.name
    assert data[0]["teacher_name"] == test_teacher.full_name
    assert data[0]["classroom"] == "A-101"
