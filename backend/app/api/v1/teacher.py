import uuid
from datetime import UTC, date, datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy.sql import func

from app.core.deps import require_role
from app.core.notify import send_bulk_notification, send_notification
from app.db.session import get_db
from app.models.announcement import Announcement, AnnouncementTarget
from app.models.assignment import Assignment, AssignmentStatus, AssignmentType
from app.models.attendance import Attendance, AttendanceStatus
from app.models.group import Group, group_students
from app.models.guardian import Guardian
from app.models.private_lesson import PrivateLesson, PrivateLessonStatus
from app.models.schedule import GroupSchedule
from app.models.user import User
from app.schemas.announcement import AnnouncementResponse
from app.schemas.assignment import (
    AssignmentCreate,
    AssignmentResponse,
    AssignmentStatusUpdate,
    AssignmentUpdate,
)
from app.schemas.attendance import AttendanceBulkCreate
from app.schemas.group import GroupResponse
from app.schemas.private_lesson import PrivateLessonResponse
from app.schemas.user import UserResponse

router = APIRouter(prefix="/teacher", tags=["teacher"])


# ── Schedule ─────────────────────────────────────────────────────────


@router.get("/schedule")
async def get_schedule(
    current_user: User = Depends(require_role("teacher")),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, object]]:
    result = await db.execute(
        select(GroupSchedule)
        .options(
            selectinload(GroupSchedule.group),
            selectinload(GroupSchedule.subject),
            selectinload(GroupSchedule.teacher),
        )
        .where(GroupSchedule.teacher_id == current_user.id)
        .order_by(GroupSchedule.day_of_week, GroupSchedule.start_time)
    )
    schedules = result.scalars().all()
    return [
        {
            "id": s.id,
            "group_id": s.group_id,
            "group_name": s.group.name,
            "subject_id": s.subject_id,
            "subject_name": s.subject.name,
            "subject_color": s.subject.color_code,
            "teacher_id": s.teacher_id,
            "teacher_name": s.teacher.full_name,
            "classroom": s.classroom,
            "day_of_week": s.day_of_week,
            "start_time": s.start_time,
            "end_time": s.end_time,
        }
        for s in schedules
    ]


# ── Private Lessons ──────────────────────────────────────────────────


@router.get("/private-lessons", response_model=list[PrivateLessonResponse])
async def get_private_lessons(
    current_user: User = Depends(require_role("teacher")),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, object]]:
    result = await db.execute(
        select(PrivateLesson)
        .options(
            selectinload(PrivateLesson.teacher),
            selectinload(PrivateLesson.student),
            selectinload(PrivateLesson.subject),
        )
        .where(PrivateLesson.teacher_id == current_user.id)
        .order_by(PrivateLesson.scheduled_at.desc())
    )
    lessons = result.scalars().all()
    return [
        {
            "id": pl.id,
            "teacher_id": pl.teacher_id,
            "teacher_name": pl.teacher.full_name,
            "student_id": pl.student_id,
            "student_name": pl.student.full_name,
            "subject_id": pl.subject_id,
            "subject_name": pl.subject.name,
            "institution_id": pl.institution_id,
            "scheduled_at": pl.scheduled_at,
            "duration_minutes": pl.duration_minutes,
            "status": pl.status.value,
            "classroom": pl.classroom,
            "notes": pl.notes,
            "created_at": pl.created_at,
        }
        for pl in lessons
    ]


@router.post("/private-lessons/{lesson_id}/complete")
async def complete_lesson(
    lesson_id: uuid.UUID,
    current_user: User = Depends(require_role("teacher")),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    result = await db.execute(
        select(PrivateLesson).where(
            PrivateLesson.id == lesson_id,
            PrivateLesson.teacher_id == current_user.id,
        )
    )
    lesson = result.scalar_one_or_none()
    if not lesson:
        raise HTTPException(status_code=404, detail="Ders bulunamadı")
    lesson.status = PrivateLessonStatus.COMPLETED
    await db.commit()
    return {"status": "ok"}


@router.post("/private-lessons/{lesson_id}/cancel")
async def cancel_lesson_by_teacher(
    lesson_id: uuid.UUID,
    current_user: User = Depends(require_role("teacher")),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    result = await db.execute(
        select(PrivateLesson).where(
            PrivateLesson.id == lesson_id,
            PrivateLesson.teacher_id == current_user.id,
            PrivateLesson.status == PrivateLessonStatus.SCHEDULED,
        )
    )
    lesson = result.scalar_one_or_none()
    if not lesson:
        raise HTTPException(status_code=404, detail="Ders bulunamadı")
    lesson.status = PrivateLessonStatus.CANCELLED_BY_TEACHER
    await db.commit()
    return {"status": "ok"}


# ── Groups ───────────────────────────────────────────────────────────


@router.get("/groups", response_model=list[GroupResponse])
async def get_groups(
    current_user: User = Depends(require_role("teacher")),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, object]]:
    result = await db.execute(
        select(Group)
        .options(selectinload(Group.advisor), selectinload(Group.students))
        .where(Group.advisor_id == current_user.id)
        .order_by(Group.academic_year.desc(), Group.name)
    )
    groups = result.scalars().all()
    return [
        {
            **{c.key: getattr(g, c.key) for c in Group.__table__.columns},
            "advisor_name": g.advisor.full_name if g.advisor else None,
            "student_count": len(g.students),
        }
        for g in groups
    ]


@router.get("/groups/{group_id}/students", response_model=list[UserResponse])
async def get_group_students(
    group_id: uuid.UUID,
    current_user: User = Depends(require_role("teacher")),
    db: AsyncSession = Depends(get_db),
) -> list[User]:
    result = await db.execute(
        select(Group)
        .where(Group.id == group_id, Group.advisor_id == current_user.id)
        .options(selectinload(Group.students))
    )
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    return list(group.students)


# ── Assignments ──────────────────────────────────────────────────────


def _assignment_to_response(a: Assignment) -> dict[str, object]:
    completed = sum(1 for s in a.statuses if s.is_completed)
    return {
        "id": a.id,
        "title": a.title,
        "description": a.description,
        "assignment_type": a.assignment_type.value,
        "subject_id": a.subject_id,
        "subject_name": a.subject.name,
        "due_date": a.due_date,
        "teacher_id": a.teacher_id,
        "teacher_name": a.teacher.full_name,
        "group_id": a.group_id,
        "group_name": a.group.name if a.group else None,
        "institution_id": a.institution_id,
        "total_students": len(a.statuses),
        "completed_count": completed,
        "created_at": a.created_at,
        "updated_at": a.updated_at,
    }


@router.get("/assignments", response_model=list[AssignmentResponse])
async def get_assignments(
    current_user: User = Depends(require_role("teacher")),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, object]]:
    result = await db.execute(
        select(Assignment)
        .options(
            selectinload(Assignment.teacher),
            selectinload(Assignment.subject),
            selectinload(Assignment.group),
            selectinload(Assignment.statuses),
        )
        .where(Assignment.teacher_id == current_user.id)
        .order_by(Assignment.due_date.desc())
    )
    assignments = result.scalars().all()
    return [_assignment_to_response(a) for a in assignments]


@router.post("/assignments", response_model=AssignmentResponse, status_code=201)
async def create_assignment(
    data: AssignmentCreate,
    current_user: User = Depends(require_role("teacher")),
    db: AsyncSession = Depends(get_db),
) -> dict[str, object]:
    assignment = Assignment(
        title=data.title,
        description=data.description,
        assignment_type=AssignmentType(data.assignment_type),
        subject_id=data.subject_id,
        due_date=data.due_date,
        teacher_id=current_user.id,
        group_id=data.group_id,
        institution_id=current_user.institution_id,
    )
    db.add(assignment)
    await db.flush()

    # Auto-create assignment statuses for all students in the group
    student_rows = await db.execute(
        select(group_students.c.student_id).where(
            group_students.c.group_id == data.group_id
        )
    )
    student_row_list = student_rows.all()
    for row in student_row_list:
        status = AssignmentStatus(
            assignment_id=assignment.id,
            student_id=row.student_id,
        )
        db.add(status)

    # Notify students in the group
    student_user_ids = [str(row.student_id) for row in student_row_list]
    await send_bulk_notification(
        db,
        user_ids=student_user_ids,
        title="Yeni Ödev",
        message=f"{assignment.title} - Teslim: {data.due_date}",
        notification_type="assignment",
        link="/student/assignments",
    )

    await db.commit()

    # Re-fetch with relationships
    result = await db.execute(
        select(Assignment)
        .options(
            selectinload(Assignment.teacher),
            selectinload(Assignment.subject),
            selectinload(Assignment.group),
            selectinload(Assignment.statuses),
        )
        .where(Assignment.id == assignment.id)
    )
    return _assignment_to_response(result.scalar_one())


@router.put("/assignments/{assignment_id}", response_model=AssignmentResponse)
async def update_assignment(
    assignment_id: uuid.UUID,
    data: AssignmentUpdate,
    current_user: User = Depends(require_role("teacher")),
    db: AsyncSession = Depends(get_db),
) -> dict[str, object]:
    result = await db.execute(
        select(Assignment).where(
            Assignment.id == assignment_id,
            Assignment.teacher_id == current_user.id,
        )
    )
    assignment = result.scalar_one_or_none()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")

    update_data = data.model_dump(exclude_unset=True)
    if "assignment_type" in update_data and update_data["assignment_type"] is not None:
        update_data["assignment_type"] = AssignmentType(update_data["assignment_type"])
    for key, value in update_data.items():
        setattr(assignment, key, value)

    await db.commit()

    # Re-fetch with relationships
    result = await db.execute(
        select(Assignment)
        .options(
            selectinload(Assignment.teacher),
            selectinload(Assignment.subject),
            selectinload(Assignment.group),
            selectinload(Assignment.statuses),
        )
        .where(Assignment.id == assignment_id)
    )
    return _assignment_to_response(result.scalar_one())


@router.delete("/assignments/{assignment_id}", status_code=204)
async def delete_assignment(
    assignment_id: uuid.UUID,
    current_user: User = Depends(require_role("teacher")),
    db: AsyncSession = Depends(get_db),
) -> None:
    result = await db.execute(
        select(Assignment).where(
            Assignment.id == assignment_id,
            Assignment.teacher_id == current_user.id,
        )
    )
    assignment = result.scalar_one_or_none()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")

    await db.execute(delete(Assignment).where(Assignment.id == assignment_id))
    await db.commit()


@router.put("/assignments/{assignment_id}/status")
async def update_assignment_status(
    assignment_id: uuid.UUID,
    data: AssignmentStatusUpdate,
    current_user: User = Depends(require_role("teacher")),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    # Verify assignment belongs to teacher
    assignment_result = await db.execute(
        select(Assignment).where(
            Assignment.id == assignment_id,
            Assignment.teacher_id == current_user.id,
        )
    )
    if not assignment_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Assignment not found")

    result = await db.execute(
        select(AssignmentStatus).where(
            AssignmentStatus.assignment_id == assignment_id,
            AssignmentStatus.student_id == data.student_id,
        )
    )
    status = result.scalar_one_or_none()
    if not status:
        raise HTTPException(status_code=404, detail="Assignment status not found")

    status.is_completed = data.is_completed
    status.completed_at = datetime.now(UTC) if data.is_completed else None
    status.teacher_note = data.teacher_note

    await db.commit()
    return {"status": "ok"}


@router.get("/assignments/{assignment_id}/students")
async def get_assignment_students(
    assignment_id: uuid.UUID,
    current_user: User = Depends(require_role("teacher")),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, object]]:
    # Verify assignment belongs to teacher
    assignment_result = await db.execute(
        select(Assignment).where(
            Assignment.id == assignment_id,
            Assignment.teacher_id == current_user.id,
        )
    )
    if not assignment_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Assignment not found")

    result = await db.execute(
        select(AssignmentStatus)
        .options(selectinload(AssignmentStatus.student))
        .where(AssignmentStatus.assignment_id == assignment_id)
    )
    statuses = result.scalars().all()
    return [
        {
            "student_id": s.student_id,
            "student_name": s.student.full_name,
            "is_completed": s.is_completed,
            "completed_at": s.completed_at,
            "teacher_note": s.teacher_note,
        }
        for s in statuses
    ]


# ── Announcements ────────────────────────────────────────────────────


@router.get("/announcements", response_model=list[AnnouncementResponse])
async def get_announcements(
    current_user: User = Depends(require_role("teacher")),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, object]]:
    result = await db.execute(
        select(Announcement)
        .options(selectinload(Announcement.author))
        .where(
            Announcement.institution_id == current_user.institution_id,
            Announcement.target_role.in_(
                [
                    AnnouncementTarget.ALL,
                    AnnouncementTarget.TEACHER,
                ]
            ),
            or_(
                Announcement.expires_at.is_(None),
                Announcement.expires_at >= func.now(),
            ),
        )
        .order_by(Announcement.is_pinned.desc(), Announcement.created_at.desc())
    )
    announcements = result.scalars().all()
    return [
        {
            "id": a.id,
            "title": a.title,
            "content": a.content,
            "target_role": a.target_role.value,
            "priority": a.priority.value,
            "is_pinned": a.is_pinned,
            "expires_at": a.expires_at,
            "created_by": a.created_by,
            "author_name": a.author.full_name,
            "created_at": a.created_at,
            "updated_at": a.updated_at,
        }
        for a in announcements
    ]


# ── Attendance ───────────────────────────────────────────────────────


@router.post("/attendance", status_code=201)
async def record_attendance(
    data: AttendanceBulkCreate,
    current_user: User = Depends(require_role("teacher")),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """Record attendance for a class session (teacher's own classes only)."""
    # Verify this schedule belongs to the teacher
    result = await db.execute(
        select(GroupSchedule).where(
            GroupSchedule.id == data.schedule_id,
            GroupSchedule.teacher_id == current_user.id,
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Bu ders size ait değil")

    await db.execute(
        delete(Attendance).where(
            Attendance.schedule_id == data.schedule_id,
            Attendance.date == data.date,
        )
    )

    for entry in data.entries:
        att = Attendance(
            schedule_id=data.schedule_id,
            student_id=entry.student_id,
            date=data.date,
            status=AttendanceStatus(entry.status),
            noted_by=current_user.id,
            note=entry.note,
        )
        db.add(att)

    # Notify parents of absent/late students
    for entry in data.entries:
        if entry.status in ("absent", "late"):
            guardian_result = await db.execute(
                select(Guardian).where(
                    Guardian.student_id == entry.student_id,
                    Guardian.user_id.isnot(None),
                )
            )
            guardian = guardian_result.scalar_one_or_none()
            if guardian and guardian.user_id:
                status_text = "katılmadı" if entry.status == "absent" else "geç kaldı"
                await send_notification(
                    db,
                    user_id=str(guardian.user_id),
                    title="Yoklama Bildirimi",
                    message=f"Çocuğunuz bugünkü derse {status_text}.",
                    notification_type="attendance",
                    link="/parent/attendance",
                )

    await db.commit()
    return {"status": "ok", "count": str(len(data.entries))}


@router.get("/attendance/history")
async def get_attendance_history(
    date_from: date | None = None,
    date_to: date | None = None,
    group_id: uuid.UUID | None = None,
    current_user: User = Depends(require_role("teacher")),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, object]]:
    """Get past attendance records for teacher's classes."""
    query = (
        select(Attendance)
        .options(
            selectinload(Attendance.student),
            selectinload(Attendance.schedule).selectinload(GroupSchedule.subject),
            selectinload(Attendance.schedule).selectinload(GroupSchedule.group),
        )
        .join(GroupSchedule, Attendance.schedule_id == GroupSchedule.id)
        .where(GroupSchedule.teacher_id == current_user.id)
        .order_by(Attendance.date.desc(), Attendance.created_at.desc())
        .limit(100)
    )
    if date_from:
        query = query.where(Attendance.date >= date_from)
    if date_to:
        query = query.where(Attendance.date <= date_to)
    if group_id:
        query = query.where(GroupSchedule.group_id == group_id)

    result = await db.execute(query)
    records = result.scalars().all()
    return [
        {
            "id": r.id,
            "student_name": r.student.full_name,
            "subject_name": r.schedule.subject.name if r.schedule.subject else "-",
            "group_name": r.schedule.group.name if r.schedule.group else "-",
            "date": r.date,
            "status": r.status.value,
            "note": r.note,
        }
        for r in records
    ]
