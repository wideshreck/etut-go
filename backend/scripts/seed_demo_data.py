"""
Etüt Pro Demo Data Seed Script
Gerçekçi Türk dershane verisi ile veritabanını doldurur.
"""

import asyncio
from datetime import UTC, date, datetime, time, timedelta

from app.core.security import hash_password
from app.db.session import async_session
from app.models.announcement import (
    Announcement,
    AnnouncementPriority,
    AnnouncementTarget,
)
from app.models.assignment import Assignment, AssignmentStatus, AssignmentType
from app.models.attendance import Attendance, AttendanceStatus
from app.models.audit_log import AuditLog
from app.models.cash_entry import CashEntry, CashEntryType
from app.models.consent import KVKKConsent
from app.models.expense import Expense, ExpenseCategory
from app.models.group import Group, GroupStatus, group_students
from app.models.guardian import Guardian
from app.models.institution import Institution
from app.models.lead import Lead, LeadNote, LeadSource, LeadStatus
from app.models.notification import Notification
from app.models.payment import Payment, PaymentStatus
from app.models.permission import AdminRole, role_permissions
from app.models.private_lesson import PrivateLesson, PrivateLessonStatus
from app.models.schedule import GroupSchedule
from app.models.subject import Subject
from app.models.teacher_availability import TeacherAvailability
from app.models.teacher_payment import TeacherPayment, TeacherPaymentStatus
from app.models.user import User, UserRole

PASSWORD = hash_password("demo123")


async def seed():
    async with async_session() as db:
        # ─── INSTITUTION ────────────────────────────────────────
        inst = Institution(
            name="Yıldız Eğitim Akademisi",
            address="Bağdat Cad. No:123/A, Kadıköy, İstanbul",
            phone="02164567890",
            tax_office="Kadıköy",
            tax_number="1234567890",
        )
        db.add(inst)
        await db.flush()
        inst_id = inst.id

        # ─── SUPERADMIN ─────────────────────────────────────────
        superadmin = User(
            email="super@etutpro.com",
            password_hash=PASSWORD,
            full_name="Sistem Yöneticisi",
            role=UserRole.SUPERADMIN,
        )
        db.add(superadmin)

        # ─── ADMIN ──────────────────────────────────────────────
        admin = User(
            email="admin@yildizegitim.com",
            password_hash=PASSWORD,
            full_name="Ahmet Yıldız",
            phone="05301234567",
            role=UserRole.ADMIN,
            institution_id=inst_id,
        )
        db.add(admin)

        # ─── SUBJECTS (BRANŞLAR) ────────────────────────────────
        subjects_data = [
            ("Matematik", "#3B82F6", "Temel ve ileri düzey matematik dersleri"),
            ("Fizik", "#8B5CF6", "Mekanik, elektrik, optik konuları"),
            ("Kimya", "#10B981", "Organik ve inorganik kimya"),
            ("Biyoloji", "#F59E0B", "Hücre biyolojisi, genetik, ekoloji"),
            ("Türkçe", "#EF4444", "Dil bilgisi, paragraf, anlam bilgisi"),
            ("Tarih", "#6366F1", "Türk ve dünya tarihi"),
            ("Coğrafya", "#14B8A6", "Fiziki ve beşeri coğrafya"),
            ("İngilizce", "#EC4899", "Grammar, vocabulary, reading"),
        ]
        subjects = {}
        for name, color, note in subjects_data:
            s = Subject(name=name, institution_id=inst_id, color_code=color, notes=note)
            db.add(s)
            await db.flush()
            subjects[name] = s

        # ─── TEACHERS (ÖĞRETMENLER) ─────────────────────────────
        teachers_data = [
            (
                "Mehmet Kaya",
                "mehmet@yildizegitim.com",
                "05321111111",
                "Matematik",
                "full_time",
                "fixed",
                18000,
                "İstanbul Üniversitesi",
                "Matematik",
                "TR001234567890",
            ),
            (
                "Ayşe Demir",
                "ayse@yildizegitim.com",
                "05322222222",
                "Fizik",
                "full_time",
                "fixed",
                16000,
                "Boğaziçi Üniversitesi",
                "Fizik",
                "TR009876543210",
            ),
            (
                "Fatma Çelik",
                "fatma@yildizegitim.com",
                "05323333333",
                "Kimya",
                "full_time",
                "fixed",
                16000,
                "ODTÜ",
                "Kimya",
                "TR005555555555",
            ),
            (
                "Ali Yılmaz",
                "ali@yildizegitim.com",
                "05324444444",
                "Türkçe",
                "full_time",
                "fixed",
                15000,
                "Ankara Üniversitesi",
                "Türk Dili",
                "TR003333333333",
            ),
            (
                "Zeynep Aksoy",
                "zeynep@yildizegitim.com",
                "05325555555",
                "Biyoloji",
                "part_time",
                "per_lesson",
                200,
                "Hacettepe Üniversitesi",
                "Biyoloji",
                "TR007777777777",
            ),
            (
                "Burak Şahin",
                "burak@yildizegitim.com",
                "05326666666",
                "Tarih",
                "part_time",
                "per_lesson",
                180,
                "Marmara Üniversitesi",
                "Tarih",
                "TR008888888888",
            ),
            (
                "Elif Öztürk",
                "elif@yildizegitim.com",
                "05327777777",
                "İngilizce",
                "full_time",
                "fixed",
                17000,
                "Bilkent Üniversitesi",
                "İngiliz Dili",
                "TR004444444444",
            ),
            (
                "Hasan Arslan",
                "hasan@yildizegitim.com",
                "05328888888",
                "Coğrafya",
                "weekend_only",
                "per_lesson",
                170,
                "İstanbul Üniversitesi",
                "Coğrafya",
                "TR006666666666",
            ),
        ]
        teachers = {}
        for (
            name,
            email,
            phone,
            subj,
            emp,
            sal_type,
            sal_amt,
            uni,
            dept,
            iban,
        ) in teachers_data:
            t = User(
                email=email,
                password_hash=PASSWORD,
                full_name=name,
                phone=phone,
                role=UserRole.TEACHER,
                institution_id=inst_id,
                subject_id=subjects[subj].id,
                employment_type=emp,
                salary_type=sal_type,
                salary_amount=sal_amt,
                university=uni,
                department=dept,
                iban=iban,
                start_date=date(2024, 9, 1),
                tc_no="12345678901",
                emergency_contact="Acil Durum Kişisi",
                emergency_phone="05301112233",
            )
            db.add(t)
            await db.flush()
            teachers[name] = t

        # Teacher availability
        for tname, t in teachers.items():
            for day in range(1, 6):  # Pzt-Cum
                db.add(
                    TeacherAvailability(
                        teacher_id=t.id,
                        day_of_week=day,
                        start_time=time(9, 0),
                        end_time=time(18, 0),
                    )
                )
            if t.employment_type == "weekend_only":
                db.add(
                    TeacherAvailability(
                        teacher_id=t.id,
                        day_of_week=6,
                        start_time=time(9, 0),
                        end_time=time(16, 0),
                    )
                )

        # ─── GROUPS (SINIFLAR) ──────────────────────────────────
        groups_data = [
            (
                "12-A Sayısal",
                "12. Sınıf",
                "Sayısal",
                "2025-2026",
                25,
                "A-101",
                "Mehmet Kaya",
            ),
            (
                "12-B Eşit Ağırlık",
                "12. Sınıf",
                "Eşit Ağırlık",
                "2025-2026",
                20,
                "A-102",
                "Ali Yılmaz",
            ),
            (
                "11-A Sayısal",
                "11. Sınıf",
                "Sayısal",
                "2025-2026",
                25,
                "B-201",
                "Ayşe Demir",
            ),
            (
                "11-B Sözel",
                "11. Sınıf",
                "Sözel",
                "2025-2026",
                20,
                "B-202",
                "Burak Şahin",
            ),
            ("LGS-A", "8. Sınıf", None, "2025-2026", 30, "C-301", "Fatma Çelik"),
            (
                "Mezun Sayısal",
                "Mezun",
                "Sayısal",
                "2025-2026",
                15,
                "D-401",
                "Mehmet Kaya",
            ),
        ]
        groups = {}
        for name, grade, field, year, cap, room, advisor in groups_data:
            g = Group(
                name=name,
                grade_level=grade,
                field=field,
                academic_year=year,
                max_capacity=cap,
                classroom=room,
                advisor_id=teachers[advisor].id,
                status=GroupStatus.ACTIVE,
                institution_id=inst_id,
            )
            db.add(g)
            await db.flush()
            groups[name] = g

        # ─── STUDENTS (ÖĞRENCİLER) ─────────────────────────────
        students_raw = [
            (
                "Ece Yılmaz",
                "ece@ogrenci.com",
                "05551111111",
                "12-A Sayısal",
                "12. Sınıf",
                "YKS-Sayısal",
                "Kadıköy Anadolu Lisesi",
                "2005-03-15",
                "Kadın",
            ),
            (
                "Kaan Demir",
                "kaan@ogrenci.com",
                "05552222222",
                "12-A Sayısal",
                "12. Sınıf",
                "YKS-Sayısal",
                "Üsküdar Fen Lisesi",
                "2005-07-22",
                "Erkek",
            ),
            (
                "Selin Arslan",
                "selin@ogrenci.com",
                "05553333333",
                "12-A Sayısal",
                "12. Sınıf",
                "YKS-Sayısal",
                "Ataşehir Anadolu Lisesi",
                "2005-11-08",
                "Kadın",
            ),
            (
                "Emre Çetin",
                "emre@ogrenci.com",
                "05554444444",
                "12-B Eşit Ağırlık",
                "12. Sınıf",
                "YKS-Eşit Ağırlık",
                "Maltepe Lisesi",
                "2005-01-30",
                "Erkek",
            ),
            (
                "Zehra Koç",
                "zehra@ogrenci.com",
                "05555555555",
                "12-B Eşit Ağırlık",
                "12. Sınıf",
                "YKS-Eşit Ağırlık",
                "Kartal Anadolu Lisesi",
                "2005-05-12",
                "Kadın",
            ),
            (
                "Yusuf Şen",
                "yusuf@ogrenci.com",
                "05556666666",
                "11-A Sayısal",
                "11. Sınıf",
                "YKS-Sayısal",
                "Pendik Fen Lisesi",
                "2006-09-20",
                "Erkek",
            ),
            (
                "Defne Aydın",
                "defne@ogrenci.com",
                "05557777777",
                "11-A Sayısal",
                "11. Sınıf",
                "YKS-Sayısal",
                "Tuzla Anadolu Lisesi",
                "2006-12-03",
                "Kadın",
            ),
            (
                "Berat Özkan",
                "berat@ogrenci.com",
                "05558888888",
                "11-B Sözel",
                "11. Sınıf",
                "YKS-Sözel",
                "Beykoz Lisesi",
                "2006-04-17",
                "Erkek",
            ),
            (
                "İrem Güneş",
                "irem@ogrenci.com",
                "05559999999",
                "LGS-A",
                "8. Sınıf",
                "LGS",
                "Kadıköy Ortaokulu",
                "2012-08-25",
                "Kadın",
            ),
            (
                "Arda Tekin",
                "arda@ogrenci.com",
                "05550000000",
                "LGS-A",
                "8. Sınıf",
                "LGS",
                "Üsküdar Ortaokulu",
                "2012-02-14",
                "Erkek",
            ),
            (
                "Nisa Erdem",
                "nisa@ogrenci.com",
                "05551010101",
                "LGS-A",
                "8. Sınıf",
                "LGS",
                "Ataşehir Ortaokulu",
                "2012-06-30",
                "Kadın",
            ),
            (
                "Can Polat",
                "can@ogrenci.com",
                "05551212121",
                "Mezun Sayısal",
                "Mezun",
                "YKS-Sayısal",
                "Kadıköy Fen Lisesi (Mezun)",
                "2004-10-05",
                "Erkek",
            ),
            (
                "Deniz Kurt",
                "deniz@ogrenci.com",
                "05551313131",
                "12-A Sayısal",
                "12. Sınıf",
                "YKS-Sayısal",
                "Bostancı Anadolu Lisesi",
                "2005-09-18",
                "Erkek",
            ),
            (
                "Ela Çelik",
                "ela@ogrenci.com",
                "05551414141",
                "11-A Sayısal",
                "11. Sınıf",
                "YKS-Sayısal",
                "Sancaktepe Fen Lisesi",
                "2006-01-27",
                "Kadın",
            ),
            (
                "Mert Acar",
                "mert@ogrenci.com",
                "05551515151",
                "LGS-A",
                "8. Sınıf",
                "LGS",
                "Maltepe Ortaokulu",
                "2012-11-11",
                "Erkek",
            ),
        ]
        students = {}
        for name, email, phone, grp, grade, exam, school, bdate, gender in students_raw:
            s = User(
                email=email,
                password_hash=PASSWORD,
                full_name=name,
                phone=phone,
                role=UserRole.STUDENT,
                institution_id=inst_id,
                group_id=groups[grp].id,
                grade_level=grade,
                target_exam=exam,
                school=school,
                birth_date=date.fromisoformat(bdate),
                gender=gender,
                enrollment_status="active",
                enrollment_date=date(2025, 9, 1),
                enrollment_period="2025-2026",
                weekly_credits=2,
                credit_duration=45,
                tc_no="98765432101",
            )
            db.add(s)
            await db.flush()
            students[name] = s
            # Assign to group_students
            await db.execute(
                group_students.insert().values(group_id=groups[grp].id, student_id=s.id)
            )

        # ─── GUARDIANS (VELİLER) + PARENT ACCOUNTS ─────────────
        guardians_data = [
            (
                "Ece Yılmaz",
                "Ayşe Yılmaz",
                "Anne",
                "05401111111",
                "ayse.yilmaz@veli.com",
                "Öğretmen",
            ),
            (
                "Kaan Demir",
                "Hüseyin Demir",
                "Baba",
                "05402222222",
                "huseyin@veli.com",
                "Mühendis",
            ),
            (
                "Selin Arslan",
                "Fatma Arslan",
                "Anne",
                "05403333333",
                "fatma.arslan@veli.com",
                "Doktor",
            ),
            (
                "Emre Çetin",
                "Mehmet Çetin",
                "Baba",
                "05404444444",
                "mehmet.cetin@veli.com",
                "Avukat",
            ),
            (
                "Zehra Koç",
                "Hatice Koç",
                "Anne",
                "05405555555",
                "hatice.koc@veli.com",
                "Eczacı",
            ),
            (
                "Yusuf Şen",
                "Ali Şen",
                "Baba",
                "05406666666",
                "ali.sen@veli.com",
                "Esnaf",
            ),
            (
                "İrem Güneş",
                "Nurcan Güneş",
                "Anne",
                "05407777777",
                "nurcan@veli.com",
                "Hemşire",
            ),
            (
                "Arda Tekin",
                "Serkan Tekin",
                "Baba",
                "05408888888",
                "serkan@veli.com",
                "Muhasebeci",
            ),
        ]
        parents = {}
        for (
            student_name,
            veli_name,
            relation,
            phone,
            email,
            occupation,
        ) in guardians_data:
            parent_user = User(
                email=email,
                password_hash=PASSWORD,
                full_name=veli_name,
                phone=phone,
                role=UserRole.PARENT,
                institution_id=inst_id,
            )
            db.add(parent_user)
            await db.flush()
            parents[veli_name] = parent_user

            guardian = Guardian(
                student_id=students[student_name].id,
                full_name=veli_name,
                relation=relation,
                phone=phone,
                email=email,
                occupation=occupation,
                user_id=parent_user.id,
            )
            db.add(guardian)

        # ─── SCHEDULES (DERS PROGRAMI) ──────────────────────────
        schedule_data = [
            ("12-A Sayısal", "Matematik", "Mehmet Kaya", 1, "09:00", "10:30", "A-101"),
            ("12-A Sayısal", "Fizik", "Ayşe Demir", 1, "11:00", "12:30", "A-101"),
            ("12-A Sayısal", "Kimya", "Fatma Çelik", 2, "09:00", "10:30", "A-101"),
            ("12-A Sayısal", "Matematik", "Mehmet Kaya", 3, "09:00", "10:30", "A-101"),
            ("12-A Sayısal", "Biyoloji", "Zeynep Aksoy", 3, "11:00", "12:30", "A-101"),
            ("12-A Sayısal", "Fizik", "Ayşe Demir", 4, "09:00", "10:30", "A-101"),
            ("12-A Sayısal", "İngilizce", "Elif Öztürk", 5, "09:00", "10:30", "A-101"),
            ("12-B Eşit Ağırlık", "Türkçe", "Ali Yılmaz", 1, "14:00", "15:30", "A-102"),
            (
                "12-B Eşit Ağırlık",
                "Matematik",
                "Mehmet Kaya",
                2,
                "14:00",
                "15:30",
                "A-102",
            ),
            ("12-B Eşit Ağırlık", "Tarih", "Burak Şahin", 3, "14:00", "15:30", "A-102"),
            (
                "12-B Eşit Ağırlık",
                "Coğrafya",
                "Hasan Arslan",
                4,
                "14:00",
                "15:30",
                "A-102",
            ),
            (
                "12-B Eşit Ağırlık",
                "İngilizce",
                "Elif Öztürk",
                5,
                "14:00",
                "15:30",
                "A-102",
            ),
            ("11-A Sayısal", "Matematik", "Mehmet Kaya", 1, "14:00", "15:30", "B-201"),
            ("11-A Sayısal", "Fizik", "Ayşe Demir", 2, "11:00", "12:30", "B-201"),
            ("11-A Sayısal", "Kimya", "Fatma Çelik", 3, "14:00", "15:30", "B-201"),
            ("11-A Sayısal", "Biyoloji", "Zeynep Aksoy", 4, "11:00", "12:30", "B-201"),
            ("LGS-A", "Matematik", "Mehmet Kaya", 2, "09:00", "10:30", "C-301"),
            ("LGS-A", "Türkçe", "Ali Yılmaz", 3, "09:00", "10:30", "C-301"),
            ("LGS-A", "İngilizce", "Elif Öztürk", 4, "14:00", "15:30", "C-301"),
            ("Mezun Sayısal", "Matematik", "Mehmet Kaya", 5, "09:00", "10:30", "D-401"),
            ("Mezun Sayısal", "Fizik", "Ayşe Demir", 5, "11:00", "12:30", "D-401"),
        ]
        for grp, subj, teacher, day, st, et, room in schedule_data:
            h1, m1 = map(int, st.split(":"))
            h2, m2 = map(int, et.split(":"))
            db.add(
                GroupSchedule(
                    group_id=groups[grp].id,
                    subject_id=subjects[subj].id,
                    teacher_id=teachers[teacher].id,
                    classroom=room,
                    day_of_week=day,
                    start_time=time(h1, m1),
                    end_time=time(h2, m2),
                )
            )

        # ─── ASSIGNMENTS (ÖDEVLER) ──────────────────────────────
        assignments_data = [
            (
                "Türev Problemleri",
                "Türev konusu ile ilgili 20 soru çözün.",
                "homework",
                "Matematik",
                "Mehmet Kaya",
                "12-A Sayısal",
                3,
            ),
            (
                "Kuvvet ve Hareket Testi",
                "Konu testi çözüp kontrol edin.",
                "test",
                "Fizik",
                "Ayşe Demir",
                "12-A Sayısal",
                5,
            ),
            (
                "Kimyasal Denge Projesi",
                "Kimyasal denge ile ilgili araştırma yapın.",
                "project",
                "Kimya",
                "Fatma Çelik",
                "12-A Sayısal",
                10,
            ),
            (
                "Paragraf Çalışması",
                "30 paragraf sorusu çözün.",
                "homework",
                "Türkçe",
                "Ali Yılmaz",
                "12-B Eşit Ağırlık",
                2,
            ),
            (
                "İnkılap Tarihi Okuma",
                "Atatürk İlkeleri bölümünü okuyun.",
                "reading",
                "Tarih",
                "Burak Şahin",
                "11-B Sözel",
                4,
            ),
            (
                "LGS Matematik Alıştırma",
                "Temel kavramlar tekrar çalışması.",
                "practice",
                "Matematik",
                "Mehmet Kaya",
                "LGS-A",
                3,
            ),
            (
                "İngilizce Grammar",
                "Tenses konusu alıştırmaları.",
                "homework",
                "İngilizce",
                "Elif Öztürk",
                "12-A Sayısal",
                5,
            ),
        ]
        for title, desc, atype, subj, teacher, grp, days_due in assignments_data:
            a = Assignment(
                title=title,
                description=desc,
                assignment_type=AssignmentType(atype),
                subject_id=subjects[subj].id,
                due_date=date.today() + timedelta(days=days_due),
                teacher_id=teachers[teacher].id,
                group_id=groups[grp].id,
                institution_id=inst_id,
            )
            db.add(a)
            await db.flush()
            # Create statuses for group students
            grp_students = [
                s for s in students.values() if s.group_id == groups[grp].id
            ]
            for i, st in enumerate(grp_students):
                completed = i % 3 == 0  # Every 3rd student completed
                db.add(
                    AssignmentStatus(
                        assignment_id=a.id,
                        student_id=st.id,
                        is_completed=completed,
                        completed_at=datetime.now(UTC) if completed else None,
                        teacher_note="İyi çalışma, devam et!" if completed else None,
                    )
                )

        # ─── PAYMENTS (ÖDEMELER) ────────────────────────────────
        today = date.today()
        for sname, student in students.items():
            total = 45000 if "Mezun" in (student.target_exam or "") else 35000
            monthly = round(total / 10, 2)
            for i in range(10):
                due = date(2025, 9 + i if 9 + i <= 12 else i - 3, 15)
                if due.month > 12:
                    due = date(2026, due.month - 12, 15)
                paid = due < today
                p = Payment(
                    student_id=student.id,
                    institution_id=inst_id,
                    installment_no=i + 1,
                    amount=monthly,
                    due_date=due,
                    status=PaymentStatus.PAID
                    if paid
                    else (
                        PaymentStatus.OVERDUE
                        if due < today - timedelta(days=30)
                        else PaymentStatus.PENDING
                    ),
                    paid_date=due if paid else None,
                    payment_method="bank_transfer" if paid else None,
                )
                db.add(p)
                if paid:
                    db.add(
                        CashEntry(
                            institution_id=inst_id,
                            entry_type=CashEntryType.INCOME,
                            amount=monthly,
                            description=f"Öğrenci taksit: {sname} - Taksit {i + 1}",
                            category="student_payment",
                            entry_date=due,
                            payment_method="bank_transfer",
                            created_by=admin.id,
                        )
                    )

        # ─── EXPENSES (GİDERLER) ────────────────────────────────
        expenses_data = [
            (
                ExpenseCategory.RENT,
                25000,
                "Mart 2026 kira ödemesi",
                "Kadıköy Emlak",
                date(2026, 3, 1),
            ),
            (
                ExpenseCategory.RENT,
                25000,
                "Şubat 2026 kira ödemesi",
                "Kadıköy Emlak",
                date(2026, 2, 1),
            ),
            (
                ExpenseCategory.UTILITIES,
                3500,
                "Mart 2026 elektrik faturası",
                "İGDAŞ",
                date(2026, 3, 10),
            ),
            (
                ExpenseCategory.UTILITIES,
                2800,
                "Mart 2026 doğalgaz faturası",
                "İGDAŞ",
                date(2026, 3, 12),
            ),
            (
                ExpenseCategory.INTERNET,
                1200,
                "Mart 2026 internet",
                "Turkcell Superonline",
                date(2026, 3, 5),
            ),
            (
                ExpenseCategory.SUPPLIES,
                4500,
                "Kırtasiye malzemeleri",
                "Migros Kırtasiye",
                date(2026, 3, 8),
            ),
            (
                ExpenseCategory.CLEANING,
                3000,
                "Mart 2026 temizlik hizmeti",
                "Temiz İş",
                date(2026, 3, 1),
            ),
            (
                ExpenseCategory.MAINTENANCE,
                2200,
                "Klima bakım ve onarım",
                "Klima Servis",
                date(2026, 3, 15),
            ),
            (
                ExpenseCategory.BOOKS,
                8500,
                "Deneme sınavı kitapları",
                "Palme Yayıncılık",
                date(2026, 3, 3),
            ),
            (
                ExpenseCategory.MARKETING,
                5000,
                "Sosyal medya reklamı",
                "Dijital Ajans",
                date(2026, 3, 1),
            ),
            (
                ExpenseCategory.FOOD,
                1800,
                "Mutfak malzemeleri",
                "Metro Market",
                date(2026, 3, 7),
            ),
            (
                ExpenseCategory.INSURANCE,
                12000,
                "Yıllık kurum sigortası",
                "Anadolu Sigorta",
                date(2026, 1, 15),
            ),
        ]
        for cat, amount, desc, vendor, exp_date in expenses_data:
            db.add(
                Expense(
                    institution_id=inst_id,
                    category=cat,
                    amount=amount,
                    description=desc,
                    vendor=vendor,
                    expense_date=exp_date,
                    payment_method="bank_transfer",
                    created_by=admin.id,
                )
            )
            db.add(
                CashEntry(
                    institution_id=inst_id,
                    entry_type=CashEntryType.EXPENSE,
                    amount=amount,
                    description=desc,
                    category="expense",
                    entry_date=exp_date,
                    payment_method="bank_transfer",
                    created_by=admin.id,
                )
            )

        # ─── TEACHER PAYMENTS (ÖĞRETMEN MAAŞLARI) ──────────────
        for tname, t in teachers.items():
            base = float(t.salary_amount or 0) if t.salary_type == "fixed" else 0
            lesson_rate = (
                float(t.salary_amount or 0) if t.salary_type == "per_lesson" else 0
            )
            lesson_count = 40 if t.salary_type == "per_lesson" else 0
            total = base + lesson_count * lesson_rate + 500 - 200  # bonus - deduction
            tp = TeacherPayment(
                teacher_id=t.id,
                institution_id=inst_id,
                period="2026-03",
                base_salary=base,
                lesson_count=lesson_count,
                per_lesson_rate=lesson_rate,
                lesson_total=lesson_count * lesson_rate,
                bonus=500,
                deduction=200,
                total_amount=total,
                status=TeacherPaymentStatus.PAID
                if tname in ("Mehmet Kaya", "Ayşe Demir", "Ali Yılmaz")
                else TeacherPaymentStatus.PENDING,
                paid_date=date(2026, 3, 25)
                if tname in ("Mehmet Kaya", "Ayşe Demir", "Ali Yılmaz")
                else None,
                payment_method="bank_transfer"
                if tname in ("Mehmet Kaya", "Ayşe Demir", "Ali Yılmaz")
                else None,
            )
            db.add(tp)

        # ─── ATTENDANCE (YOKLAMA) ───────────────────────────────
        # Last 5 school days
        await db.flush()
        all_schedules_result = await db.execute(
            __import__("sqlalchemy")
            .select(GroupSchedule)
            .where(GroupSchedule.group_id.in_([g.id for g in groups.values()]))
        )
        all_schedules = list(all_schedules_result.scalars().all())

        for days_ago in range(1, 6):
            att_date = today - timedelta(days=days_ago)
            dow = att_date.isoweekday()
            day_schedules = [s for s in all_schedules if s.day_of_week == dow]
            for sched in day_schedules:
                grp_studs = [
                    s for s in students.values() if s.group_id == sched.group_id
                ]
                for st in grp_studs:
                    import random

                    r = random.random()
                    status = (
                        AttendanceStatus.PRESENT
                        if r > 0.15
                        else (
                            AttendanceStatus.ABSENT
                            if r > 0.08
                            else (
                                AttendanceStatus.LATE
                                if r > 0.03
                                else AttendanceStatus.EXCUSED
                            )
                        )
                    )
                    db.add(
                        Attendance(
                            schedule_id=sched.id,
                            student_id=st.id,
                            date=att_date,
                            status=status,
                            noted_by=sched.teacher_id,
                        )
                    )

        # ─── PRIVATE LESSONS (ÖZEL DERSLER) ─────────────────────
        pl_data = [
            (
                "Ece Yılmaz",
                "Mehmet Kaya",
                "Matematik",
                1,
                "16:00",
                PrivateLessonStatus.COMPLETED,
            ),
            (
                "Kaan Demir",
                "Ayşe Demir",
                "Fizik",
                2,
                "16:00",
                PrivateLessonStatus.COMPLETED,
            ),
            (
                "Selin Arslan",
                "Fatma Çelik",
                "Kimya",
                3,
                "16:00",
                PrivateLessonStatus.SCHEDULED,
            ),
            (
                "Can Polat",
                "Mehmet Kaya",
                "Matematik",
                4,
                "16:00",
                PrivateLessonStatus.SCHEDULED,
            ),
            (
                "Deniz Kurt",
                "Elif Öztürk",
                "İngilizce",
                5,
                "16:00",
                PrivateLessonStatus.SCHEDULED,
            ),
        ]
        for sname, tname, subj, days_offset, t_str, status in pl_data:
            scheduled = datetime(
                2026, 3, 24 + days_offset, int(t_str.split(":")[0]), 0, tzinfo=UTC
            )
            db.add(
                PrivateLesson(
                    teacher_id=teachers[tname].id,
                    student_id=students[sname].id,
                    subject_id=subjects[subj].id,
                    institution_id=inst_id,
                    scheduled_at=scheduled,
                    duration_minutes=45,
                    status=status,
                    classroom="Özel Ders Odası",
                )
            )

        # ─── ANNOUNCEMENTS (DUYURULAR) ──────────────────────────
        announcements_data = [
            (
                "Deneme Sınavı Duyurusu",
                "29 Mart Cumartesi günü TYT deneme sınavı yapılacaktır. Tüm 12. sınıf ve mezun öğrencilerin katılımı zorunludur.",
                AnnouncementTarget.STUDENT,
                AnnouncementPriority.URGENT,
                True,
            ),
            (
                "Veli Toplantısı",
                "5 Nisan Cumartesi saat 14:00'te veli toplantısı düzenlenecektir. Katılımınız önemlidir.",
                AnnouncementTarget.PARENT,
                AnnouncementPriority.IMPORTANT,
                True,
            ),
            (
                "Bahar Tatili Programı",
                "14-18 Nisan tarihleri arasında bahar tatili nedeniyle dersler yapılmayacaktır.",
                AnnouncementTarget.ALL,
                AnnouncementPriority.NORMAL,
                False,
            ),
            (
                "Yeni Kitap Dağıtımı",
                "Yeni dönem kitapları idari ofisten teslim alınabilir.",
                AnnouncementTarget.STUDENT,
                AnnouncementPriority.NORMAL,
                False,
            ),
            (
                "Öğretmenler Kurulu",
                "2 Nisan Çarşamba saat 16:30'da öğretmenler kurulu toplantısı yapılacaktır.",
                AnnouncementTarget.TEACHER,
                AnnouncementPriority.IMPORTANT,
                False,
            ),
        ]
        for title, content, target, priority, pinned in announcements_data:
            db.add(
                Announcement(
                    title=title,
                    content=content,
                    institution_id=inst_id,
                    target_role=target,
                    priority=priority,
                    is_pinned=pinned,
                    created_by=admin.id,
                )
            )

        # ─── LEADS (ÖN KAYIT) ──────────────────────────────────
        leads_data = [
            (
                "Ahmet Tuncer",
                "Tuncer ailesi",
                "05501111111",
                "ahmet.t@email.com",
                "8. Sınıf",
                "LGS",
                "Ataşehir Ortaokulu",
                LeadStatus.NEW,
                LeadSource.WALK_IN,
                None,
                None,
            ),
            (
                "Merve Aktaş",
                "Hale Aktaş",
                "05502222222",
                "merve@email.com",
                "11. Sınıf",
                "YKS-Sayısal",
                "Kadıköy Lisesi",
                LeadStatus.CONTACTED,
                LeadSource.PHONE,
                None,
                None,
            ),
            (
                "Burak Kılıç",
                "Murat Kılıç",
                "05503333333",
                "burak.k@email.com",
                "12. Sınıf",
                "YKS-Eşit Ağırlık",
                "Bostancı Lisesi",
                LeadStatus.CONSULTATION_SCHEDULED,
                LeadSource.WEBSITE,
                datetime(2026, 4, 2, 14, 0, tzinfo=UTC),
                7,
            ),
            (
                "Ceren Yıldırım",
                "Ayhan Yıldırım",
                "05504444444",
                "ceren@email.com",
                "Mezun",
                "YKS-Sayısal",
                "Mezun",
                LeadStatus.CONSULTATION_DONE,
                LeadSource.REFERRAL,
                datetime(2026, 3, 25, 10, 0, tzinfo=UTC),
                9,
            ),
            (
                "Onur Bayrak",
                None,
                "05505555555",
                None,
                "8. Sınıf",
                "LGS",
                None,
                LeadStatus.LOST,
                LeadSource.SOCIAL_MEDIA,
                None,
                None,
            ),
            (
                "Sude Ergin",
                "Filiz Ergin",
                "05506666666",
                "sude@email.com",
                "11. Sınıf",
                "YKS-Sözel",
                "Kartal Lisesi",
                LeadStatus.ENROLLED,
                LeadSource.CAMPAIGN,
                datetime(2026, 3, 20, 11, 0, tzinfo=UTC),
                10,
            ),
        ]
        for (
            sname,
            pname,
            phone,
            email,
            grade,
            exam,
            school,
            status,
            source,
            cons_date,
            score,
        ) in leads_data:
            lead = Lead(
                institution_id=inst_id,
                student_name=sname,
                parent_name=pname,
                phone=phone,
                email=email,
                grade_level=grade,
                target_exam=exam,
                current_school=school,
                status=status,
                source=source,
                consultation_date=cons_date,
                consultation_score=score,
                assigned_to=admin.id,
                lost_reason="Fiyat uygun bulmadı"
                if status == LeadStatus.LOST
                else None,
            )
            db.add(lead)
            await db.flush()
            if status in (
                LeadStatus.CONTACTED,
                LeadStatus.CONSULTATION_DONE,
                LeadStatus.ENROLLED,
            ):
                db.add(
                    LeadNote(
                        lead_id=lead.id,
                        content="Telefonla görüşüldü, bilgi verildi.",
                        created_by=admin.id,
                    )
                )
            if status in (LeadStatus.CONSULTATION_DONE, LeadStatus.ENROLLED):
                db.add(
                    LeadNote(
                        lead_id=lead.id,
                        content="Yüz yüze görüşme yapıldı, olumlu izlenim.",
                        created_by=admin.id,
                    )
                )

        # ─── NOTIFICATIONS ──────────────────────────────────────
        for sname, student in list(students.items())[:5]:
            db.add(
                Notification(
                    user_id=student.id,
                    title="Yeni Ödev",
                    message="Türev Problemleri ödevi atandı.",
                    type="assignment",
                    link="/student/assignments",
                )
            )
        for pname, parent in list(parents.items())[:3]:
            db.add(
                Notification(
                    user_id=parent.id,
                    title="Yoklama Bildirimi",
                    message="Çocuğunuz bugünkü derse katılmadı.",
                    type="attendance",
                    link="/parent/attendance",
                )
            )

        # ─── KVKK CONSENTS ──────────────────────────────────────
        for u in [admin, *teachers.values(), *list(students.values())[:5]]:
            db.add(
                KVKKConsent(
                    user_id=u.id,
                    consent_type="privacy_policy",
                    version="v1.0",
                    is_accepted=True,
                )
            )

        # ─── AUDIT LOGS ─────────────────────────────────────────
        audit_entries = [
            ("create", "teacher", "Mehmet Kaya öğretmen oluşturuldu"),
            ("create", "student", "Ece Yılmaz öğrenci oluşturuldu"),
            ("create", "group", "12-A Sayısal sınıfı oluşturuldu"),
            ("create", "announcement", "Deneme Sınavı Duyurusu yayınlandı"),
            ("create", "payment", "Taksit planı oluşturuldu"),
            ("login", "auth", "Ahmet Yıldız giriş yaptı"),
            ("update", "teacher", "Ayşe Demir bilgileri güncellendi"),
            ("create", "attendance", "Yoklama alındı (15 öğrenci)"),
        ]
        for action, entity, desc in audit_entries:
            db.add(
                AuditLog(
                    institution_id=inst_id,
                    user_id=admin.id,
                    action=action,
                    entity_type=entity,
                    description=desc,
                )
            )

        # ─── ADMIN ROLE ─────────────────────────────────────────
        role = AdminRole(name="Muhasebe Sorumlusu", institution_id=inst_id)
        db.add(role)
        await db.flush()
        for perm in [
            "payments.view",
            "payments.create",
            "payments.edit",
            "expenses.view",
            "expenses.create",
            "cash_ledger.view",
            "reports.view",
        ]:
            await db.execute(
                role_permissions.insert().values(role_id=role.id, permission=perm)
            )

        await db.commit()
        print("✅ Demo verisi başarıyla oluşturuldu!")
        print()
        print("═══════════════════════════════════════════")
        print("  ETÜT PRO — DEMO GİRİŞ BİLGİLERİ")
        print("═══════════════════════════════════════════")
        print()
        print("Tüm şifreler: demo123")
        print()
        print("Superadmin:  super@etutpro.com")
        print("Admin:       admin@yildizegitim.com")
        print()
        print("Öğretmenler:")
        for name, t in teachers.items():
            print(f"  {name}: {t.email}")
        print()
        print("Öğrenciler (ilk 5):")
        for name, s in list(students.items())[:5]:
            print(f"  {name}: {s.email}")
        print()
        print("Veliler:")
        for name, p in parents.items():
            print(f"  {name}: {p.email}")
        print()


if __name__ == "__main__":
    asyncio.run(seed())
