"""Test configuration and shared fixtures."""

from __future__ import annotations

from collections.abc import AsyncGenerator

import httpx
import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.security import create_access_token, hash_password
from app.db.base import Base
from app.db.session import get_db
from app.main import create_app

# Import all models so metadata is complete
from app.models import (  # noqa: F401
    AdminRole,
    Announcement,
    Assignment,
    AssignmentStatus,
    Attendance,
    AuditLog,
    CashEntry,
    Expense,
    Group,
    GroupSchedule,
    Guardian,
    Institution,
    KVKKConsent,
    Lead,
    LeadNote,
    Notification,
    Payment,
    PrivateLesson,
    Subject,
    TeacherAvailability,
    TeacherPayment,
    User,
    UserRole,
    group_students,
    role_permissions,
    user_admin_roles,
)

TEST_DATABASE_URL = (
    "postgresql+asyncpg://etut:etut_dev_password@localhost:5432/etut_test"
)

# All table names for truncation.
_ALL_TABLES = [
    "messages",
    "conversations",
    "lead_notes",
    "leads",
    "cash_entries",
    "teacher_payments",
    "kvkk_consents",
    "audit_logs",
    "notifications",
    "assignment_statuses",
    "assignments",
    "attendance",
    "group_schedules",
    "private_lessons",
    "expenses",
    "payments",
    "announcements",
    "role_permissions",
    "user_admin_roles",
    "admin_roles",
    "teacher_availability",
    "guardians",
    "group_students",
    "users",
    "subjects",
    "groups",
    "institutions",
]

# Track if tables are created (per-process)
_tables_created = False


@pytest.fixture
async def db() -> AsyncGenerator[AsyncSession]:
    """Provide a clean db session for each test.

    Creates engine per-test to avoid cross-event-loop issues.
    Tables are created once via a flag.
    """
    global _tables_created

    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    session_factory = async_sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )

    if not _tables_created:
        async with engine.begin() as conn:
            await conn.execute(text("DROP SCHEMA public CASCADE"))
            await conn.execute(text("CREATE SCHEMA public"))
            await conn.run_sync(Base.metadata.create_all)
        _tables_created = True

    async with session_factory() as session:
        yield session

    # Truncate all tables after each test
    async with engine.begin() as conn:
        await conn.execute(
            text("TRUNCATE TABLE " + ", ".join(_ALL_TABLES) + " CASCADE")
        )

    await engine.dispose()


@pytest.fixture
def app(db: AsyncSession):
    """Create a FastAPI app with DB dependency overridden."""
    application = create_app()

    async def _override_get_db():
        yield db

    application.dependency_overrides[get_db] = _override_get_db
    return application


@pytest.fixture
async def client(app) -> AsyncGenerator[httpx.AsyncClient]:
    """Provide an async httpx client bound to the test app."""
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url="http://test",
    ) as c:
        yield c


# ── Test data helpers ───────────────────────────────────────────────


@pytest.fixture
async def test_institution(db: AsyncSession) -> Institution:
    inst = Institution(name="Test Kurum", address="Test Adres", phone="5551234567")
    db.add(inst)
    await db.commit()
    await db.refresh(inst)
    return inst


@pytest.fixture
async def test_admin(db: AsyncSession, test_institution: Institution) -> User:
    user = User(
        email="admin@test.com",
        password_hash=hash_password("test123"),
        full_name="Test Admin",
        role=UserRole.ADMIN,
        institution_id=test_institution.id,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@pytest.fixture
async def test_teacher(db: AsyncSession, test_institution: Institution) -> User:
    user = User(
        email="teacher@test.com",
        password_hash=hash_password("test123"),
        full_name="Test Ogretmen",
        role=UserRole.TEACHER,
        institution_id=test_institution.id,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@pytest.fixture
async def test_student(db: AsyncSession, test_institution: Institution) -> User:
    user = User(
        email="student@test.com",
        password_hash=hash_password("test123"),
        full_name="Test Ogrenci",
        role=UserRole.STUDENT,
        institution_id=test_institution.id,
        grade_level="8",
        target_exam="LGS",
        enrollment_status="active",
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@pytest.fixture
async def test_superadmin(db: AsyncSession) -> User:
    user = User(
        email="super@test.com",
        password_hash=hash_password("test123"),
        full_name="Test Super",
        role=UserRole.SUPERADMIN,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@pytest.fixture
async def test_parent(db: AsyncSession, test_institution: Institution) -> User:
    user = User(
        email="parent@test.com",
        password_hash=hash_password("test123"),
        full_name="Test Veli",
        role=UserRole.PARENT,
        institution_id=test_institution.id,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@pytest.fixture
async def test_subject(db: AsyncSession, test_institution: Institution) -> Subject:
    subject = Subject(
        name="Matematik",
        institution_id=test_institution.id,
        color_code="#3B82F6",
    )
    db.add(subject)
    await db.commit()
    await db.refresh(subject)
    return subject


@pytest.fixture
async def test_group(db: AsyncSession, test_institution: Institution) -> Group:
    group = Group(
        name="8-A",
        grade_level="8",
        academic_year="2025-2026",
        max_capacity=30,
        institution_id=test_institution.id,
    )
    db.add(group)
    await db.commit()
    await db.refresh(group)
    return group


def auth_header(user: User) -> dict[str, str]:
    """Create an Authorization header for a given user."""
    token = create_access_token(
        {
            "sub": str(user.id),
            "role": user.role.value,
            "institution_id": str(user.institution_id) if user.institution_id else None,
        }
    )
    return {"Authorization": f"Bearer {token}"}
