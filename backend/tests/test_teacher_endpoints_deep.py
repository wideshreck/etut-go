"""Deep tests for teacher portal endpoints -- edge cases and data verification."""

import uuid
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
from app.models.group import Group, group_students
from app.models.private_lesson import PrivateLesson, PrivateLessonStatus
from app.models.schedule import GroupSchedule
from app.models.subject import Subject
from app.models.user import User
from tests.conftest import auth_header


@pytest.mark.asyncio
async def test_teacher_create_assignment_auto_creates_statuses(
    client: AsyncClient,
    test_teacher: User,
    test_subject: Subject,
    test_group: Group,
    test_student: User,
    db: AsyncSession,
) -> None:
    """Creating an assignment should auto-create statuses for group students."""
    # First, assign student to the group
    await db.execute(
        group_students.insert().values(
            group_id=test_group.id, student_id=test_student.id
        )
    )
    await db.flush()

    response = await client.post(
        "/api/v1/teacher/assignments",
        json={
            "title": "Status Auto Create",
            "description": "Test odev",
            "assignment_type": "homework",
            "subject_id": str(test_subject.id),
            "due_date": "2026-05-01",
            "group_id": str(test_group.id),
        },
        headers=auth_header(test_teacher),
    )
    assert response.status_code == 201
    data = response.json()
    assert data["total_students"] >= 1
    assert data["completed_count"] == 0


@pytest.mark.asyncio
async def test_teacher_update_assignment(
    client: AsyncClient,
    test_teacher: User,
    test_subject: Subject,
    test_group: Group,
    db: AsyncSession,
) -> None:
    assignment = Assignment(
        title="Original Title",
        description="Original Desc",
        assignment_type=AssignmentType.HOMEWORK,
        subject_id=test_subject.id,
        due_date=date(2026, 5, 1),
        teacher_id=test_teacher.id,
        group_id=test_group.id,
        institution_id=test_teacher.institution_id,
    )
    db.add(assignment)
    await db.flush()

    response = await client.put(
        f"/api/v1/teacher/assignments/{assignment.id}",
        json={
            "title": "Updated Title",
            "description": "Updated Desc",
        },
        headers=auth_header(test_teacher),
    )
    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "Updated Title"
    assert data["description"] == "Updated Desc"


@pytest.mark.asyncio
async def test_teacher_update_assignment_not_found(
    client: AsyncClient, test_teacher: User
) -> None:
    response = await client.put(
        f"/api/v1/teacher/assignments/{uuid.uuid4()}",
        json={"title": "Nope"},
        headers=auth_header(test_teacher),
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_teacher_delete_assignment(
    client: AsyncClient,
    test_teacher: User,
    test_subject: Subject,
    test_group: Group,
    db: AsyncSession,
) -> None:
    assignment = Assignment(
        title="Delete Me",
        assignment_type=AssignmentType.TEST,
        subject_id=test_subject.id,
        due_date=date(2026, 6, 1),
        teacher_id=test_teacher.id,
        group_id=test_group.id,
        institution_id=test_teacher.institution_id,
    )
    db.add(assignment)
    await db.flush()

    response = await client.delete(
        f"/api/v1/teacher/assignments/{assignment.id}",
        headers=auth_header(test_teacher),
    )
    assert response.status_code == 204


@pytest.mark.asyncio
async def test_teacher_delete_assignment_not_found(
    client: AsyncClient, test_teacher: User
) -> None:
    response = await client.delete(
        f"/api/v1/teacher/assignments/{uuid.uuid4()}",
        headers=auth_header(test_teacher),
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_teacher_assignment_status_update(
    client: AsyncClient,
    test_teacher: User,
    test_subject: Subject,
    test_group: Group,
    test_student: User,
    db: AsyncSession,
) -> None:
    assignment = Assignment(
        title="Status Update Test",
        assignment_type=AssignmentType.HOMEWORK,
        subject_id=test_subject.id,
        due_date=date(2026, 5, 15),
        teacher_id=test_teacher.id,
        group_id=test_group.id,
        institution_id=test_teacher.institution_id,
    )
    db.add(assignment)
    await db.flush()

    status = AssignmentStatus(
        assignment_id=assignment.id,
        student_id=test_student.id,
    )
    db.add(status)
    await db.flush()

    response = await client.put(
        f"/api/v1/teacher/assignments/{assignment.id}/status",
        json={
            "student_id": str(test_student.id),
            "is_completed": True,
            "teacher_note": "Guzel calisma",
        },
        headers=auth_header(test_teacher),
    )
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


@pytest.mark.asyncio
async def test_teacher_assignment_status_update_not_found(
    client: AsyncClient, test_teacher: User
) -> None:
    response = await client.put(
        f"/api/v1/teacher/assignments/{uuid.uuid4()}/status",
        json={
            "student_id": str(uuid.uuid4()),
            "is_completed": True,
        },
        headers=auth_header(test_teacher),
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_teacher_get_assignment_students(
    client: AsyncClient,
    test_teacher: User,
    test_subject: Subject,
    test_group: Group,
    test_student: User,
    db: AsyncSession,
) -> None:
    assignment = Assignment(
        title="Student List Test",
        assignment_type=AssignmentType.PROJECT,
        subject_id=test_subject.id,
        due_date=date(2026, 5, 20),
        teacher_id=test_teacher.id,
        group_id=test_group.id,
        institution_id=test_teacher.institution_id,
    )
    db.add(assignment)
    await db.flush()

    status = AssignmentStatus(
        assignment_id=assignment.id,
        student_id=test_student.id,
    )
    db.add(status)
    await db.flush()

    response = await client.get(
        f"/api/v1/teacher/assignments/{assignment.id}/students",
        headers=auth_header(test_teacher),
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert data[0]["student_name"] == test_student.full_name
    assert data[0]["is_completed"] is False


@pytest.mark.asyncio
async def test_teacher_get_assignment_students_not_found(
    client: AsyncClient, test_teacher: User
) -> None:
    response = await client.get(
        f"/api/v1/teacher/assignments/{uuid.uuid4()}/students",
        headers=auth_header(test_teacher),
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_teacher_private_lessons_with_data(
    client: AsyncClient,
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
        scheduled_at=datetime(2026, 5, 10, 10, 0, tzinfo=UTC),
        duration_minutes=45,
        status=PrivateLessonStatus.SCHEDULED,
    )
    db.add(pl)
    await db.flush()

    response = await client.get(
        "/api/v1/teacher/private-lessons",
        headers=auth_header(test_teacher),
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert data[0]["duration_minutes"] == 45


@pytest.mark.asyncio
async def test_teacher_private_lesson_cancel_not_found(
    client: AsyncClient, test_teacher: User
) -> None:
    response = await client.post(
        f"/api/v1/teacher/private-lessons/{uuid.uuid4()}/cancel",
        headers=auth_header(test_teacher),
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_teacher_get_group_students(
    client: AsyncClient,
    test_teacher: User,
    test_group: Group,
    test_student: User,
    db: AsyncSession,
) -> None:
    test_group.advisor_id = test_teacher.id
    await db.flush()

    await db.execute(
        group_students.insert().values(
            group_id=test_group.id, student_id=test_student.id
        )
    )
    await db.flush()

    response = await client.get(
        f"/api/v1/teacher/groups/{test_group.id}/students",
        headers=auth_header(test_teacher),
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1


@pytest.mark.asyncio
async def test_teacher_get_group_students_not_advisor(
    client: AsyncClient, test_teacher: User, test_group: Group
) -> None:
    # Teacher is not the advisor -- should 404
    response = await client.get(
        f"/api/v1/teacher/groups/{test_group.id}/students",
        headers=auth_header(test_teacher),
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_teacher_announcements_filtered(
    client: AsyncClient, test_teacher: User, test_admin: User, db: AsyncSession
) -> None:
    """Teacher should see announcements targeted to 'all' and 'teacher' only."""
    ann_teacher = Announcement(
        title="For Teachers",
        content="Teacher only",
        institution_id=test_admin.institution_id,
        target_role=AnnouncementTarget.TEACHER,
        priority=AnnouncementPriority.NORMAL,
        created_by=test_admin.id,
    )
    ann_student = Announcement(
        title="For Students",
        content="Student only",
        institution_id=test_admin.institution_id,
        target_role=AnnouncementTarget.STUDENT,
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
    db.add_all([ann_teacher, ann_student, ann_all])
    await db.flush()

    response = await client.get(
        "/api/v1/teacher/announcements",
        headers=auth_header(test_teacher),
    )
    assert response.status_code == 200
    data = response.json()
    # Should see teacher and all, but not student-only
    titles = [a["title"] for a in data]
    assert "For Teachers" in titles
    assert "For All" in titles
    assert "For Students" not in titles


@pytest.mark.asyncio
async def test_teacher_attendance_history_with_data(
    client: AsyncClient,
    test_teacher: User,
    test_student: User,
    test_group: Group,
    test_subject: Subject,
    db: AsyncSession,
) -> None:
    from app.models.attendance import Attendance, AttendanceStatus

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

    att = Attendance(
        schedule_id=schedule.id,
        student_id=test_student.id,
        date=date(2026, 4, 1),
        status=AttendanceStatus.PRESENT,
        noted_by=test_teacher.id,
    )
    db.add(att)
    await db.flush()

    response = await client.get(
        "/api/v1/teacher/attendance/history",
        headers=auth_header(test_teacher),
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert data[0]["student_name"] == test_student.full_name


@pytest.mark.asyncio
async def test_teacher_attendance_history_filter_by_date(
    client: AsyncClient,
    test_teacher: User,
    test_student: User,
    test_group: Group,
    test_subject: Subject,
    db: AsyncSession,
) -> None:
    from app.models.attendance import Attendance, AttendanceStatus

    schedule = GroupSchedule(
        group_id=test_group.id,
        subject_id=test_subject.id,
        teacher_id=test_teacher.id,
        day_of_week=2,
        start_time=time(10, 0),
        end_time=time(11, 0),
    )
    db.add(schedule)
    await db.flush()

    att = Attendance(
        schedule_id=schedule.id,
        student_id=test_student.id,
        date=date(2026, 4, 15),
        status=AttendanceStatus.LATE,
        noted_by=test_teacher.id,
    )
    db.add(att)
    await db.flush()

    response = await client.get(
        "/api/v1/teacher/attendance/history?date_from=2026-04-01&date_to=2026-04-30",
        headers=auth_header(test_teacher),
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1


@pytest.mark.asyncio
async def test_teacher_attendance_history_filter_by_group(
    client: AsyncClient,
    test_teacher: User,
    test_student: User,
    test_group: Group,
    test_subject: Subject,
    db: AsyncSession,
) -> None:
    from app.models.attendance import Attendance, AttendanceStatus

    schedule = GroupSchedule(
        group_id=test_group.id,
        subject_id=test_subject.id,
        teacher_id=test_teacher.id,
        day_of_week=3,
        start_time=time(11, 0),
        end_time=time(12, 0),
    )
    db.add(schedule)
    await db.flush()

    att = Attendance(
        schedule_id=schedule.id,
        student_id=test_student.id,
        date=date(2026, 4, 16),
        status=AttendanceStatus.PRESENT,
        noted_by=test_teacher.id,
    )
    db.add(att)
    await db.flush()

    response = await client.get(
        f"/api/v1/teacher/attendance/history?group_id={test_group.id}",
        headers=auth_header(test_teacher),
    )
    assert response.status_code == 200
