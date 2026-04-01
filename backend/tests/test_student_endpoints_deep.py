"""Deep tests for student portal endpoints -- edge cases and data verification."""

from datetime import UTC, date, datetime, time, timedelta

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
from app.models.payment import Payment, PaymentStatus
from app.models.private_lesson import PrivateLesson, PrivateLessonStatus
from app.models.schedule import GroupSchedule
from app.models.subject import Subject
from app.models.teacher_availability import TeacherAvailability
from app.models.user import User
from tests.conftest import auth_header


@pytest.mark.asyncio
async def test_student_credits_with_usage(
    client: AsyncClient,
    test_student: User,
    test_teacher: User,
    test_subject: Subject,
    test_institution,
    db: AsyncSession,
) -> None:
    test_student.weekly_credits = 3
    test_student.credit_duration = 60
    await db.flush()

    # Schedule a lesson this week
    today = datetime.now(tz=UTC).date()
    monday = today - timedelta(days=today.weekday())
    scheduled = datetime(monday.year, monday.month, monday.day, 10, 0, tzinfo=UTC)

    pl = PrivateLesson(
        teacher_id=test_teacher.id,
        student_id=test_student.id,
        subject_id=test_subject.id,
        institution_id=test_institution.id,
        scheduled_at=scheduled,
        duration_minutes=60,
        status=PrivateLessonStatus.SCHEDULED,
    )
    db.add(pl)
    await db.flush()

    response = await client.get(
        "/api/v1/student/credits",
        headers=auth_header(test_student),
    )
    assert response.status_code == 200
    data = response.json()
    assert data["weekly_credits"] == 3
    assert data["used_this_week"] >= 1
    assert data["remaining_this_week"] <= 2


@pytest.mark.asyncio
async def test_student_available_slots_empty(
    client: AsyncClient, test_student: User
) -> None:
    """When no teachers have availability, should return empty."""
    response = await client.get(
        "/api/v1/student/available-slots?target_date=2026-04-07",
        headers=auth_header(test_student),
    )
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


@pytest.mark.asyncio
async def test_student_available_slots_with_teacher(
    client: AsyncClient,
    test_student: User,
    test_teacher: User,
    test_subject: Subject,
    db: AsyncSession,
) -> None:
    """Teacher with availability should show slots."""
    test_student.credit_duration = 60
    test_teacher.subject_id = test_subject.id
    await db.flush()

    # Teacher available on Monday (day 1) from 09:00 to 12:00
    avail = TeacherAvailability(
        teacher_id=test_teacher.id,
        day_of_week=1,  # Monday
        start_time=time(9, 0),
        end_time=time(12, 0),
    )
    db.add(avail)
    await db.flush()

    # 2026-04-06 is a Monday
    response = await client.get(
        "/api/v1/student/available-slots?target_date=2026-04-06",
        headers=auth_header(test_student),
    )
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    # Should have at least some slots
    assert len(data) >= 1
    assert data[0]["teacher_name"] == test_teacher.full_name


@pytest.mark.asyncio
async def test_student_book_lesson_credits_exhausted(
    client: AsyncClient,
    test_student: User,
    test_teacher: User,
    test_subject: Subject,
    test_institution,
    db: AsyncSession,
) -> None:
    """Should fail when all credits used up this week."""
    test_student.weekly_credits = 1
    test_student.credit_duration = 60
    await db.flush()

    # Use up the one credit
    today = datetime.now(tz=UTC).date()
    monday = today - timedelta(days=today.weekday())
    scheduled = datetime(monday.year, monday.month, monday.day, 10, 0, tzinfo=UTC)

    pl = PrivateLesson(
        teacher_id=test_teacher.id,
        student_id=test_student.id,
        subject_id=test_subject.id,
        institution_id=test_institution.id,
        scheduled_at=scheduled,
        duration_minutes=60,
        status=PrivateLessonStatus.SCHEDULED,
    )
    db.add(pl)
    await db.flush()

    # Try to book another
    response = await client.post(
        "/api/v1/student/private-lessons/book",
        json={
            "teacher_id": str(test_teacher.id),
            "subject_id": str(test_subject.id),
            "scheduled_at": "2026-04-01T14:00:00+00:00",
        },
        headers=auth_header(test_student),
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_student_assignments_with_teacher_notes(
    client: AsyncClient,
    test_student: User,
    test_teacher: User,
    test_subject: Subject,
    test_group: Group,
    db: AsyncSession,
) -> None:
    assignment = Assignment(
        title="Noted Assignment",
        description="Odev aciklamasi",
        assignment_type=AssignmentType.HOMEWORK,
        subject_id=test_subject.id,
        due_date=date(2026, 5, 10),
        teacher_id=test_teacher.id,
        group_id=test_group.id,
        institution_id=test_student.institution_id,
    )
    db.add(assignment)
    await db.flush()

    status = AssignmentStatus(
        assignment_id=assignment.id,
        student_id=test_student.id,
        is_completed=True,
        completed_at=datetime.now(tz=UTC),
        teacher_note="Guzel calisma!",
    )
    db.add(status)
    await db.flush()

    response = await client.get(
        "/api/v1/student/assignments",
        headers=auth_header(test_student),
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    a = data[0]
    assert a["title"] == "Noted Assignment"
    assert a["teacher_note"] == "Guzel calisma!"
    assert a["is_completed"] is True
    assert a["teacher_name"] == test_teacher.full_name


@pytest.mark.asyncio
async def test_student_attendance_summary_with_records(
    client: AsyncClient,
    test_student: User,
    test_teacher: User,
    test_subject: Subject,
    test_group: Group,
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
    await db.flush()

    # Add attendance records
    for d, st in [
        (date(2026, 4, 1), AttStatus.PRESENT),
        (date(2026, 4, 2), AttStatus.ABSENT),
        (date(2026, 4, 3), AttStatus.LATE),
    ]:
        att = Attendance(
            schedule_id=schedule.id,
            student_id=test_student.id,
            date=d,
            status=st,
            noted_by=test_teacher.id,
        )
        db.add(att)
    await db.flush()

    response = await client.get(
        "/api/v1/student/attendance",
        headers=auth_header(test_student),
    )
    assert response.status_code == 200
    data = response.json()
    assert data["summary"]["total"] == 3
    assert data["summary"]["present"] == 1
    assert data["summary"]["absent"] == 1
    assert data["summary"]["late"] == 1
    assert data["summary"]["attendance_rate"] > 0
    assert len(data["recent"]) == 3


@pytest.mark.asyncio
async def test_student_payments_list_with_data(
    client: AsyncClient, test_student: User, db: AsyncSession
) -> None:
    p1 = Payment(
        student_id=test_student.id,
        institution_id=test_student.institution_id,
        installment_no=1,
        amount=5000,
        due_date=date(2026, 3, 1),
        status=PaymentStatus.PAID,
        paid_date=date(2026, 3, 5),
        payment_method="cash",
    )
    p2 = Payment(
        student_id=test_student.id,
        institution_id=test_student.institution_id,
        installment_no=2,
        amount=5000,
        due_date=date(2026, 4, 1),
        status=PaymentStatus.PENDING,
    )
    db.add_all([p1, p2])
    await db.flush()

    response = await client.get(
        "/api/v1/student/payments",
        headers=auth_header(test_student),
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    assert data[0]["installment_no"] == 1
    assert data[0]["status"] == "paid"
    assert data[1]["installment_no"] == 2
    assert data[1]["status"] == "pending"


@pytest.mark.asyncio
async def test_student_announcements_filtered(
    client: AsyncClient, test_student: User, test_admin: User, db: AsyncSession
) -> None:
    """Student should see announcements targeted to 'all' and 'student' only."""
    ann_student = Announcement(
        title="For Students",
        content="Student only",
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
    db.add_all([ann_student, ann_teacher, ann_all])
    await db.flush()

    response = await client.get(
        "/api/v1/student/announcements",
        headers=auth_header(test_student),
    )
    assert response.status_code == 200
    data = response.json()
    titles = [a["title"] for a in data]
    assert "For Students" in titles
    assert "For All" in titles
    assert "For Teachers Only" not in titles


@pytest.mark.asyncio
async def test_student_private_lessons_with_data(
    client: AsyncClient,
    test_student: User,
    test_teacher: User,
    test_subject: Subject,
    test_institution,
    db: AsyncSession,
) -> None:
    pl = PrivateLesson(
        teacher_id=test_teacher.id,
        student_id=test_student.id,
        subject_id=test_subject.id,
        institution_id=test_institution.id,
        scheduled_at=datetime(2026, 5, 5, 14, 0, tzinfo=UTC),
        duration_minutes=60,
        status=PrivateLessonStatus.COMPLETED,
        notes="Tamamlandi",
    )
    db.add(pl)
    await db.flush()

    response = await client.get(
        "/api/v1/student/private-lessons",
        headers=auth_header(test_student),
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert data[0]["status"] == "completed"
    assert data[0]["teacher_name"] == test_teacher.full_name
