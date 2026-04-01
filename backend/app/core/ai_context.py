"""Build AI context based on user role and data."""

import datetime as _dt
from datetime import timedelta

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.assignment import AssignmentStatus
from app.models.attendance import Attendance, AttendanceStatus
from app.models.expense import Expense
from app.models.group import Group
from app.models.guardian import Guardian
from app.models.institution import Institution
from app.models.lead import Lead, LeadStatus
from app.models.payment import Payment, PaymentStatus
from app.models.schedule import GroupSchedule
from app.models.subject import Subject
from app.models.teacher_payment import TeacherPayment, TeacherPaymentStatus
from app.models.user import User, UserRole


async def build_parent_context(user: User, db: AsyncSession) -> str:
    """Build context for parent AI assistant."""
    # Find linked student
    result = await db.execute(select(Guardian).where(Guardian.user_id == user.id))
    guardian = result.scalar_one_or_none()
    if not guardian:
        return "Bu veli hesabına bağlı öğrenci bulunamadı."

    student = await db.get(User, guardian.student_id)
    if not student:
        return "Öğrenci bilgisi bulunamadı."

    context_parts = [
        "## Öğrenci Bilgileri",
        f"Ad Soyad: {student.full_name}",
        f"Sınıf: {student.grade_level or '-'}",
        f"Hedef Sınav: {student.target_exam or '-'}",
        f"Okul: {student.school or '-'}",
        f"Kayıt Durumu: {student.enrollment_status or '-'}",
    ]

    # Group info
    if student.group_id:
        group = await db.get(Group, student.group_id)
        if group:
            context_parts.append(f"Sınıf/Grup: {group.name} ({group.grade_level})")

    # Schedule
    if student.group_id:
        sched_result = await db.execute(
            select(GroupSchedule)
            .options(
                selectinload(GroupSchedule.subject),
                selectinload(GroupSchedule.teacher),
            )
            .where(GroupSchedule.group_id == student.group_id)
            .order_by(GroupSchedule.day_of_week, GroupSchedule.start_time)
        )
        schedules = sched_result.scalars().all()
        if schedules:
            days = {
                1: "Pzt",
                2: "Sal",
                3: "Çar",
                4: "Per",
                5: "Cum",
                6: "Cmt",
                7: "Paz",
            }
            context_parts.append("\n## Ders Programı")
            for sched in schedules:
                subject_name = sched.subject.name if sched.subject else "-"
                teacher_name = sched.teacher.full_name if sched.teacher else "-"
                context_parts.append(
                    f"- {days.get(sched.day_of_week, '?')} "
                    f"{sched.start_time.strftime('%H:%M')}-"
                    f"{sched.end_time.strftime('%H:%M')}: "
                    f"{subject_name} ({teacher_name})"
                )

    # Attendance summary
    att_result = await db.execute(
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
        ).where(Attendance.student_id == student.id)
    )
    att = att_result.one()
    if att.total and att.total > 0:
        rate = round(((att.present or 0) + (att.late or 0)) / att.total * 100, 1)
        context_parts.append("\n## Devamsızlık")
        context_parts.append(
            f"Toplam Ders: {att.total}, Geldi: {att.present or 0}, "
            f"Gelmedi: {att.absent or 0}, Geç: {att.late or 0}"
        )
        context_parts.append(f"Katılım Oranı: %{rate}")

    # Assignments
    status_result = await db.execute(
        select(AssignmentStatus)
        .options(selectinload(AssignmentStatus.assignment))
        .where(AssignmentStatus.student_id == student.id)
    )
    statuses = status_result.scalars().all()
    if statuses:
        done = sum(1 for st in statuses if st.is_completed)
        context_parts.append("\n## Ödevler")
        context_parts.append(
            f"Toplam: {len(statuses)}, "
            f"Tamamlanan: {done}, "
            f"Bekleyen: {len(statuses) - done}"
        )
        for st in statuses[:5]:
            a = st.assignment
            status_text = "\u2713 Tamamlandı" if st.is_completed else "\u2717 Yapılmadı"
            context_parts.append(f"- {a.title} (Teslim: {a.due_date}) {status_text}")

    # Payments
    pay_result = await db.execute(
        select(Payment)
        .where(Payment.student_id == student.id)
        .order_by(Payment.installment_no)
    )
    payments = pay_result.scalars().all()
    if payments:
        total = sum(float(p.amount) for p in payments)
        paid = sum(float(p.amount) for p in payments if p.status == PaymentStatus.PAID)
        overdue = sum(1 for p in payments if p.status == PaymentStatus.OVERDUE)
        context_parts.append("\n## Ödemeler")
        context_parts.append(
            f"Toplam: \u20ba{total:,.2f}, "
            f"Ödenen: \u20ba{paid:,.2f}, "
            f"Kalan: \u20ba{total - paid:,.2f}"
        )
        if overdue > 0:
            context_parts.append(f"Gecikmiş Taksit: {overdue} adet")

    return "\n".join(context_parts)


async def build_admin_context(user: User, db: AsyncSession) -> str:
    """Build context for admin AI assistant."""
    inst_id = user.institution_id
    inst = await db.get(Institution, inst_id)

    context_parts = [
        "## Kurum Bilgileri",
        f"Kurum: {inst.name if inst else '-'}",
    ]

    # Student count
    student_count = (
        await db.execute(
            select(func.count(User.id)).where(
                User.institution_id == inst_id,
                User.role == UserRole.STUDENT,
            )
        )
    ).scalar() or 0
    active_students = (
        await db.execute(
            select(func.count(User.id)).where(
                User.institution_id == inst_id,
                User.role == UserRole.STUDENT,
                User.enrollment_status == "active",
            )
        )
    ).scalar() or 0

    # Teacher count
    teacher_count = (
        await db.execute(
            select(func.count(User.id)).where(
                User.institution_id == inst_id,
                User.role == UserRole.TEACHER,
            )
        )
    ).scalar() or 0

    # Group count
    group_count = (
        await db.execute(
            select(func.count(Group.id)).where(
                Group.institution_id == inst_id,
            )
        )
    ).scalar() or 0

    context_parts.append("\n## Genel İstatistikler")
    context_parts.append(f"Toplam Öğrenci: {student_count} (Aktif: {active_students})")
    context_parts.append(f"Toplam Öğretmen: {teacher_count}")
    context_parts.append(f"Toplam Sınıf: {group_count}")

    # Financial summary
    fin_result = await db.execute(
        select(
            func.coalesce(func.sum(Payment.amount), 0).label("total"),
            func.coalesce(
                func.sum(
                    case(
                        (Payment.status == PaymentStatus.PAID, Payment.amount),
                        else_=0,
                    )
                ),
                0,
            ).label("paid"),
            func.coalesce(
                func.sum(
                    case(
                        (
                            Payment.status == PaymentStatus.OVERDUE,
                            Payment.amount,
                        ),
                        else_=0,
                    )
                ),
                0,
            ).label("overdue"),
        ).where(Payment.institution_id == inst_id)
    )
    fin = fin_result.one()
    context_parts.append("\n## Finansal Durum")
    context_parts.append(f"Toplam Beklenen: \u20ba{float(fin.total):,.2f}")
    context_parts.append(f"Tahsil Edilen: \u20ba{float(fin.paid):,.2f}")
    context_parts.append(f"Gecikmiş: \u20ba{float(fin.overdue):,.2f}")
    if float(fin.total) > 0:
        context_parts.append(
            f"Tahsilat Oranı: %{float(fin.paid) / float(fin.total) * 100:.1f}"
        )

    # Expense summary
    exp_result = await db.execute(
        select(func.coalesce(func.sum(Expense.amount), 0)).where(
            Expense.institution_id == inst_id,
        )
    )
    total_expense = float(exp_result.scalar() or 0)
    context_parts.append(f"Toplam Gider: \u20ba{total_expense:,.2f}")
    context_parts.append(f"Net Kâr: \u20ba{float(fin.paid) - total_expense:,.2f}")

    # Teacher salary summary
    sal_result = await db.execute(
        select(
            func.coalesce(func.sum(TeacherPayment.total_amount), 0).label("total"),
            func.coalesce(
                func.sum(
                    case(
                        (
                            TeacherPayment.status == TeacherPaymentStatus.PAID,
                            TeacherPayment.total_amount,
                        ),
                        else_=0,
                    )
                ),
                0,
            ).label("paid"),
        ).where(TeacherPayment.institution_id == inst_id)
    )
    sal = sal_result.one()
    context_parts.append(
        f"Öğretmen Maaşları: \u20ba{float(sal.total):,.2f} "
        f"(Ödenen: \u20ba{float(sal.paid):,.2f})"
    )

    # Attendance rate (30 days)
    thirty_days_ago = _dt.datetime.now(tz=_dt.UTC).date() - timedelta(days=30)
    att_result = await db.execute(
        select(
            func.count(Attendance.id).label("total"),
            func.sum(
                case(
                    (
                        Attendance.status.in_(
                            [AttendanceStatus.PRESENT, AttendanceStatus.LATE]
                        ),
                        1,
                    ),
                    else_=0,
                )
            ).label("present"),
        )
        .join(GroupSchedule, Attendance.schedule_id == GroupSchedule.id)
        .join(Group, GroupSchedule.group_id == Group.id)
        .where(
            Group.institution_id == inst_id,
            Attendance.date >= thirty_days_ago,
        )
    )
    att = att_result.one()
    if att.total and att.total > 0:
        context_parts.append("\n## Katılım (Son 30 Gün)")
        context_parts.append(
            f"Katılım Oranı: %{float(att.present or 0) / float(att.total) * 100:.1f}"
        )

    # Lead/CRM summary
    lead_total = (
        await db.execute(
            select(func.count(Lead.id)).where(
                Lead.institution_id == inst_id,
            )
        )
    ).scalar() or 0
    lead_enrolled = (
        await db.execute(
            select(func.count(Lead.id)).where(
                Lead.institution_id == inst_id,
                Lead.status == LeadStatus.ENROLLED,
            )
        )
    ).scalar() or 0
    if lead_total > 0:
        context_parts.append("\n## Ön Kayıt")
        context_parts.append(f"Toplam Aday: {lead_total}, Kayıt Olan: {lead_enrolled}")
        context_parts.append(f"Dönüşüm Oranı: %{lead_enrolled / lead_total * 100:.1f}")

    # Subjects and teachers
    subj_result = await db.execute(
        select(Subject).where(Subject.institution_id == inst_id)
    )
    subjects = subj_result.scalars().all()
    if subjects:
        context_parts.append("\n## Branşlar")
        context_parts.append(", ".join(s.name for s in subjects))

    # Groups detail
    grp_result = await db.execute(
        select(Group)
        .options(selectinload(Group.advisor), selectinload(Group.students))
        .where(Group.institution_id == inst_id)
    )
    groups = grp_result.scalars().all()
    if groups:
        context_parts.append("\n## Sınıflar")
        for g in groups:
            advisor_name = g.advisor.full_name if g.advisor else "-"
            context_parts.append(
                f"- {g.name} ({g.grade_level}) "
                f"-- {len(g.students)} öğrenci, "
                f"Danışman: {advisor_name}"
            )

    return "\n".join(context_parts)
