import uuid
from datetime import UTC, date, datetime, timedelta
from datetime import time as time_type

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import Date, cast, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy.sql import func

from app.core.deps import require_role
from app.db.session import get_db
from app.models.announcement import Announcement, AnnouncementTarget
from app.models.assignment import Assignment, AssignmentStatus
from app.models.private_lesson import PrivateLesson, PrivateLessonStatus
from app.models.schedule import GroupSchedule
from app.models.teacher_availability import TeacherAvailability
from app.models.user import User, UserRole
from app.schemas.announcement import AnnouncementResponse
from app.schemas.assignment import StudentAssignmentResponse
from app.schemas.private_lesson import PrivateLessonBook, PrivateLessonResponse

router = APIRouter(prefix="/student", tags=["student"])


# ── Schedule ─────────────────────────────────────────────────────────


@router.get("/schedule")
async def get_schedule(
    current_user: User = Depends(require_role("student")),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, object]]:
    if not current_user.group_id:
        return []

    result = await db.execute(
        select(GroupSchedule)
        .options(
            selectinload(GroupSchedule.group),
            selectinload(GroupSchedule.subject),
            selectinload(GroupSchedule.teacher),
        )
        .where(GroupSchedule.group_id == current_user.group_id)
        .order_by(GroupSchedule.day_of_week, GroupSchedule.start_time)
    )
    schedules = result.scalars().all()
    return [
        {
            "id": s.id,
            "group_id": s.group_id,
            "group_name": s.group.name,
            "subject_name": s.subject.name,
            "subject_color": s.subject.color_code,
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
    current_user: User = Depends(require_role("student")),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, object]]:
    result = await db.execute(
        select(PrivateLesson)
        .options(
            selectinload(PrivateLesson.teacher),
            selectinload(PrivateLesson.student),
            selectinload(PrivateLesson.subject),
        )
        .where(PrivateLesson.student_id == current_user.id)
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


@router.get("/credits")
async def get_my_credits(
    current_user: User = Depends(require_role("student")),
    db: AsyncSession = Depends(get_db),
) -> dict[str, object]:
    """Get student's credit info for current week."""
    if not current_user.weekly_credits:
        return {
            "weekly_credits": 0,
            "credit_duration": 0,
            "used_this_week": 0,
            "remaining_this_week": 0,
        }

    # Calculate week boundaries (Monday to Sunday)
    today = datetime.now(tz=UTC).date()
    monday = today - timedelta(days=today.weekday())
    sunday = monday + timedelta(days=6)

    # Count used credits this week
    used = (
        await db.execute(
            select(func.count(PrivateLesson.id)).where(
                PrivateLesson.student_id == current_user.id,
                PrivateLesson.status.in_(
                    [PrivateLessonStatus.SCHEDULED, PrivateLessonStatus.COMPLETED]
                ),
                cast(PrivateLesson.scheduled_at, Date) >= monday,
                cast(PrivateLesson.scheduled_at, Date) <= sunday,
            )
        )
    ).scalar() or 0

    return {
        "weekly_credits": current_user.weekly_credits,
        "credit_duration": current_user.credit_duration or 60,
        "used_this_week": used,
        "remaining_this_week": max(0, current_user.weekly_credits - used),
    }


@router.get("/available-slots")
async def get_available_slots(
    target_date: date,
    current_user: User = Depends(require_role("student")),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, object]]:
    """Get all available teacher slots for a given date."""
    day_of_week = target_date.isoweekday()  # 1=Monday, 7=Sunday
    duration = current_user.credit_duration or 60

    # Get student's own schedule for that day (can't book during class time)
    student_schedules: list[GroupSchedule] = []
    if current_user.group_id:
        result = await db.execute(
            select(GroupSchedule).where(
                GroupSchedule.group_id == current_user.group_id,
                GroupSchedule.day_of_week == day_of_week,
            )
        )
        student_schedules = list(result.scalars().all())

    # Get all teachers in the institution with their availability for this day
    teachers_result = await db.execute(
        select(User)
        .options(selectinload(User.subject))
        .where(
            User.institution_id == current_user.institution_id,
            User.role == UserRole.TEACHER,
            User.is_active == True,  # noqa: E712
        )
    )
    teachers = teachers_result.scalars().all()

    slots: list[dict[str, object]] = []
    for teacher in teachers:
        # Get teacher availability for this day of week
        avail_result = await db.execute(
            select(TeacherAvailability).where(
                TeacherAvailability.teacher_id == teacher.id,
                TeacherAvailability.day_of_week == day_of_week,
            )
        )
        availabilities = avail_result.scalars().all()

        # Get teacher's group schedule for this day (busy slots)
        teacher_schedule_result = await db.execute(
            select(GroupSchedule).where(
                GroupSchedule.teacher_id == teacher.id,
                GroupSchedule.day_of_week == day_of_week,
            )
        )
        teacher_busy_schedules = list(teacher_schedule_result.scalars().all())

        # Get teacher's existing private lessons for this date (busy slots)
        existing_lessons_result = await db.execute(
            select(PrivateLesson).where(
                PrivateLesson.teacher_id == teacher.id,
                cast(PrivateLesson.scheduled_at, Date) == target_date,
                PrivateLesson.status.in_(
                    [PrivateLessonStatus.SCHEDULED, PrivateLessonStatus.COMPLETED]
                ),
            )
        )
        existing_lessons = list(existing_lessons_result.scalars().all())

        # For each availability window, generate slots and filter out busy ones
        for avail in availabilities:
            current_time = avail.start_time
            while True:
                end_time_minutes = (
                    current_time.hour * 60 + current_time.minute + duration
                )
                if end_time_minutes > avail.end_time.hour * 60 + avail.end_time.minute:
                    break

                slot_start = current_time
                slot_end = time_type(end_time_minutes // 60, end_time_minutes % 60)

                # Check if this slot overlaps with teacher's group schedule
                teacher_busy = False
                for gs in teacher_busy_schedules:
                    if slot_start < gs.end_time and slot_end > gs.start_time:
                        teacher_busy = True
                        break

                # Check if overlaps with existing private lessons
                if not teacher_busy:
                    for pl in existing_lessons:
                        pl_start = pl.scheduled_at.time()
                        pl_end_minutes = (
                            pl_start.hour * 60 + pl_start.minute + pl.duration_minutes
                        )
                        pl_end = time_type(pl_end_minutes // 60, pl_end_minutes % 60)
                        if slot_start < pl_end and slot_end > pl_start:
                            teacher_busy = True
                            break

                # Check if overlaps with student's own class schedule
                student_busy = False
                if not teacher_busy:
                    for ss in student_schedules:
                        if slot_start < ss.end_time and slot_end > ss.start_time:
                            student_busy = True
                            break

                if not teacher_busy and not student_busy:
                    slots.append(
                        {
                            "teacher_id": str(teacher.id),
                            "teacher_name": teacher.full_name,
                            "subject_id": str(teacher.subject_id)
                            if teacher.subject_id
                            else None,
                            "subject_name": (
                                teacher.subject.name if teacher.subject else "Genel"
                            ),
                            "date": str(target_date),
                            "start_time": slot_start.strftime("%H:%M"),
                            "end_time": slot_end.strftime("%H:%M"),
                        }
                    )

                # Move to next slot
                current_time = slot_end

    # Sort by time then teacher name
    slots.sort(key=lambda s: (s["start_time"], s["teacher_name"]))
    return slots


@router.post("/private-lessons/book", status_code=201)
async def book_private_lesson(
    data: PrivateLessonBook,
    current_user: User = Depends(require_role("student")),
    db: AsyncSession = Depends(get_db),
) -> dict[str, object]:
    """Student books a private lesson using credit."""
    # Check credits
    if not current_user.weekly_credits:
        raise HTTPException(status_code=400, detail="Özel ders krediniz bulunmuyor")

    today = datetime.now(tz=UTC).date()
    monday = today - timedelta(days=today.weekday())
    sunday = monday + timedelta(days=6)

    used = (
        await db.execute(
            select(func.count(PrivateLesson.id)).where(
                PrivateLesson.student_id == current_user.id,
                PrivateLesson.status.in_(
                    [PrivateLessonStatus.SCHEDULED, PrivateLessonStatus.COMPLETED]
                ),
                cast(PrivateLesson.scheduled_at, Date) >= monday,
                cast(PrivateLesson.scheduled_at, Date) <= sunday,
            )
        )
    ).scalar() or 0

    if used >= current_user.weekly_credits:
        raise HTTPException(status_code=400, detail="Bu hafta için krediniz doldu")

    # Create the lesson
    duration = current_user.credit_duration or 60
    lesson = PrivateLesson(
        teacher_id=data.teacher_id,
        student_id=current_user.id,
        subject_id=data.subject_id,
        institution_id=current_user.institution_id,
        scheduled_at=data.scheduled_at,
        duration_minutes=duration,
        notes=data.notes,
    )
    db.add(lesson)
    await db.commit()

    # Re-fetch with relationships
    result = await db.execute(
        select(PrivateLesson)
        .options(
            selectinload(PrivateLesson.teacher),
            selectinload(PrivateLesson.student),
            selectinload(PrivateLesson.subject),
        )
        .where(PrivateLesson.id == lesson.id)
    )
    pl = result.scalar_one()
    return {
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


@router.post("/private-lessons/{lesson_id}/cancel")
async def cancel_private_lesson(
    lesson_id: uuid.UUID,
    current_user: User = Depends(require_role("student")),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """Cancel a private lesson. Must be 24h+ before scheduled time."""
    result = await db.execute(
        select(PrivateLesson).where(
            PrivateLesson.id == lesson_id,
            PrivateLesson.student_id == current_user.id,
            PrivateLesson.status == PrivateLessonStatus.SCHEDULED,
        )
    )
    lesson = result.scalar_one_or_none()
    if not lesson:
        raise HTTPException(status_code=404, detail="Ders bulunamadı")

    now = datetime.now(tz=UTC)
    time_until = lesson.scheduled_at - now

    if time_until < timedelta(hours=24):
        raise HTTPException(
            status_code=400,
            detail=(
                "Dersten 24 saatten az kaldığı için iptal edilemez."
                " Krediniz iade edilmeyecektir."
            ),
        )

    lesson.status = PrivateLessonStatus.CANCELLED_BY_STUDENT
    await db.commit()
    return {"status": "ok", "message": "Ders iptal edildi, krediniz iade edildi"}


# ── Assignments ──────────────────────────────────────────────────────


@router.get("/assignments", response_model=list[StudentAssignmentResponse])
async def get_assignments(
    current_user: User = Depends(require_role("student")),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, object]]:
    result = await db.execute(
        select(Assignment, AssignmentStatus)
        .join(
            AssignmentStatus,
            AssignmentStatus.assignment_id == Assignment.id,
        )
        .options(
            selectinload(Assignment.subject),
            selectinload(Assignment.teacher),
        )
        .where(AssignmentStatus.student_id == current_user.id)
        .order_by(Assignment.due_date.desc())
    )
    rows = result.all()
    return [
        {
            "id": assignment.id,
            "title": assignment.title,
            "description": assignment.description,
            "assignment_type": assignment.assignment_type.value,
            "subject_name": assignment.subject.name,
            "teacher_name": assignment.teacher.full_name,
            "due_date": assignment.due_date,
            "is_completed": status.is_completed,
            "completed_at": status.completed_at,
            "teacher_note": status.teacher_note,
        }
        for assignment, status in rows
    ]


# ── Attendance ───────────────────────────────────────────────────────


@router.get("/attendance")
async def get_my_attendance(
    current_user: User = Depends(require_role("student")),
    db: AsyncSession = Depends(get_db),
) -> dict[str, object]:
    """Get student's own attendance summary and recent records."""
    from sqlalchemy import case

    from app.models.attendance import Attendance, AttendanceStatus
    from app.models.schedule import GroupSchedule

    # Summary
    summary_result = await db.execute(
        select(
            func.count(Attendance.id).label("total"),
            func.sum(
                case((Attendance.status == AttendanceStatus.PRESENT, 1), else_=0)
            ).label("present"),
            func.sum(
                case((Attendance.status == AttendanceStatus.ABSENT, 1), else_=0)
            ).label("absent"),
            func.sum(
                case((Attendance.status == AttendanceStatus.LATE, 1), else_=0)
            ).label("late"),
            func.sum(
                case((Attendance.status == AttendanceStatus.EXCUSED, 1), else_=0)
            ).label("excused"),
        ).where(Attendance.student_id == current_user.id)
    )
    s = summary_result.one()
    total = s.total or 0

    # Recent records
    recent_result = await db.execute(
        select(Attendance)
        .options(
            selectinload(Attendance.schedule).selectinload(GroupSchedule.subject),
        )
        .where(Attendance.student_id == current_user.id)
        .order_by(Attendance.date.desc())
        .limit(20)
    )
    records = recent_result.scalars().all()

    return {
        "summary": {
            "total": total,
            "present": s.present or 0,
            "absent": s.absent or 0,
            "late": s.late or 0,
            "excused": s.excused or 0,
            "attendance_rate": round(
                ((s.present or 0) + (s.late or 0)) / total * 100, 1
            )
            if total > 0
            else 0,
        },
        "recent": [
            {
                "id": r.id,
                "date": r.date,
                "status": r.status.value,
                "subject_name": r.schedule.subject.name
                if r.schedule and r.schedule.subject
                else "-",
                "note": r.note,
            }
            for r in records
        ],
    }


# ── Announcements ────────────────────────────────────────────────────


@router.get("/announcements", response_model=list[AnnouncementResponse])
async def get_announcements(
    current_user: User = Depends(require_role("student")),
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
                    AnnouncementTarget.STUDENT,
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


# ── Payments ─────────────────────────────────────────────────────────


@router.get("/payments")
async def get_my_payments(
    current_user: User = Depends(require_role("student")),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, object]]:
    """Get student's payment/installment records."""
    from app.models.payment import Payment

    result = await db.execute(
        select(Payment)
        .where(Payment.student_id == current_user.id)
        .order_by(Payment.installment_no)
    )
    payments = result.scalars().all()
    return [
        {
            "id": p.id,
            "installment_no": p.installment_no,
            "amount": float(p.amount),
            "due_date": p.due_date,
            "paid_date": p.paid_date,
            "status": p.status.value,
            "payment_method": p.payment_method,
        }
        for p in payments
    ]
