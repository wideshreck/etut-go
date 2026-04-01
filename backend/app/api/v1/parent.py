from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import case, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy.sql import func

from app.core.deps import require_role
from app.db.session import get_db
from app.models.announcement import Announcement, AnnouncementTarget
from app.models.assignment import Assignment, AssignmentStatus
from app.models.attendance import Attendance, AttendanceStatus
from app.models.guardian import Guardian
from app.models.payment import Payment
from app.models.schedule import GroupSchedule
from app.models.user import User

router = APIRouter(prefix="/parent", tags=["parent"])


async def _get_student_for_parent(current_user: User, db: AsyncSession) -> User:
    """Get the student linked to this parent."""
    result = await db.execute(
        select(Guardian).where(Guardian.user_id == current_user.id)
    )
    guardian = result.scalar_one_or_none()
    if not guardian:
        raise HTTPException(status_code=404, detail="Bağlı öğrenci bulunamadı")

    student = await db.get(User, guardian.student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Öğrenci bulunamadı")
    return student


@router.get("/child")
async def get_child_info(
    current_user: User = Depends(require_role("parent")),
    db: AsyncSession = Depends(get_db),
) -> dict[str, object]:
    """Get basic info about the linked student."""
    student = await _get_student_for_parent(current_user, db)
    return {
        "id": student.id,
        "full_name": student.full_name,
        "email": student.email,
        "phone": student.phone,
        "grade_level": student.grade_level,
        "target_exam": student.target_exam,
        "school": student.school,
        "enrollment_status": student.enrollment_status,
        "group_id": student.group_id,
    }


@router.get("/schedule")
async def get_child_schedule(
    current_user: User = Depends(require_role("parent")),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, object]]:
    """Get child's weekly schedule."""
    student = await _get_student_for_parent(current_user, db)
    if not student.group_id:
        return []

    result = await db.execute(
        select(GroupSchedule)
        .options(
            selectinload(GroupSchedule.group),
            selectinload(GroupSchedule.subject),
            selectinload(GroupSchedule.teacher),
        )
        .where(GroupSchedule.group_id == student.group_id)
        .order_by(GroupSchedule.day_of_week, GroupSchedule.start_time)
    )
    schedules = result.scalars().all()
    return [
        {
            "id": s.id,
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


@router.get("/assignments")
async def get_child_assignments(
    current_user: User = Depends(require_role("parent")),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, object]]:
    """Get child's assignments with completion status."""
    student = await _get_student_for_parent(current_user, db)

    result = await db.execute(
        select(AssignmentStatus)
        .options(
            selectinload(AssignmentStatus.assignment).selectinload(Assignment.teacher),
            selectinload(AssignmentStatus.assignment).selectinload(Assignment.subject),
        )
        .where(AssignmentStatus.student_id == student.id)
    )
    statuses = result.scalars().all()
    return [
        {
            "id": s.assignment.id,
            "title": s.assignment.title,
            "description": s.assignment.description,
            "assignment_type": s.assignment.assignment_type.value
            if hasattr(s.assignment.assignment_type, "value")
            else s.assignment.assignment_type,
            "subject_name": s.assignment.subject.name
            if s.assignment.subject
            else "Genel",
            "teacher_name": s.assignment.teacher.full_name,
            "due_date": s.assignment.due_date,
            "is_completed": s.is_completed,
            "completed_at": s.completed_at,
            "teacher_note": s.teacher_note,
        }
        for s in statuses
    ]


@router.get("/attendance")
async def get_child_attendance(
    current_user: User = Depends(require_role("parent")),
    db: AsyncSession = Depends(get_db),
) -> dict[str, object]:
    """Get child's attendance summary and recent records."""
    student = await _get_student_for_parent(current_user, db)

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
        ).where(Attendance.student_id == student.id)
    )
    summary = summary_result.one()
    total = summary.total or 0
    present = summary.present or 0
    late = summary.late or 0

    # Recent records (last 20)
    recent_result = await db.execute(
        select(Attendance)
        .options(selectinload(Attendance.schedule).selectinload(GroupSchedule.subject))
        .where(Attendance.student_id == student.id)
        .order_by(Attendance.date.desc())
        .limit(20)
    )
    records = recent_result.scalars().all()

    return {
        "summary": {
            "total": total,
            "present": present,
            "absent": summary.absent or 0,
            "late": late,
            "excused": summary.excused or 0,
            "attendance_rate": round((present + late) / total * 100, 1)
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
                else "Bilinmiyor",
                "note": r.note,
            }
            for r in records
        ],
    }


@router.get("/payments")
async def get_child_payments(
    current_user: User = Depends(require_role("parent")),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, object]]:
    """Get child's payment records."""
    student = await _get_student_for_parent(current_user, db)

    result = await db.execute(
        select(Payment)
        .where(Payment.student_id == student.id)
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


@router.get("/announcements")
async def get_announcements(
    current_user: User = Depends(require_role("parent")),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, object]]:
    """Get announcements targeting students (parents see what students see)."""
    result = await db.execute(
        select(Announcement)
        .options(selectinload(Announcement.author))
        .where(
            Announcement.institution_id == current_user.institution_id,
            Announcement.target_role.in_(
                [
                    AnnouncementTarget.ALL,
                    AnnouncementTarget.STUDENT,
                    AnnouncementTarget.PARENT,
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
