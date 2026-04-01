import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import require_role
from app.core.security import hash_password
from app.db.session import get_db
from app.models.institution import Institution
from app.models.user import User, UserRole
from app.schemas.institution import (
    InstitutionCreate,
    InstitutionDashboard,
    InstitutionResponse,
    InstitutionUpdate,
)
from app.schemas.user import UserCreate, UserResponse

router = APIRouter(prefix="/superadmin", tags=["superadmin"])


@router.get("/dashboard", response_model=list[InstitutionDashboard])
async def dashboard(
    _: User = Depends(require_role("superadmin")),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, object]]:
    result = await db.execute(select(Institution))
    institutions = result.scalars().all()

    dashboards: list[dict[str, object]] = []
    for inst in institutions:
        student_count_result = await db.execute(
            select(func.count())
            .select_from(User)
            .where(
                User.institution_id == inst.id,
                User.role == UserRole.STUDENT,
            )
        )
        teacher_count_result = await db.execute(
            select(func.count())
            .select_from(User)
            .where(
                User.institution_id == inst.id,
                User.role == UserRole.TEACHER,
            )
        )
        dashboards.append(
            {
                "id": str(inst.id),
                "name": inst.name,
                "is_active": inst.is_active,
                "student_count": student_count_result.scalar_one(),
                "teacher_count": teacher_count_result.scalar_one(),
            }
        )
    return dashboards


@router.get("/institutions", response_model=list[InstitutionResponse])
async def list_institutions(
    _: User = Depends(require_role("superadmin")),
    db: AsyncSession = Depends(get_db),
) -> list[Institution]:
    result = await db.execute(select(Institution))
    return list(result.scalars().all())


@router.post(
    "/institutions",
    response_model=InstitutionResponse,
    status_code=201,
)
async def create_institution(
    data: InstitutionCreate,
    _: User = Depends(require_role("superadmin")),
    db: AsyncSession = Depends(get_db),
) -> Institution:
    institution = Institution(
        name=data.name,
        address=data.address,
        phone=data.phone,
    )
    db.add(institution)
    await db.commit()
    await db.refresh(institution)
    return institution


@router.get("/institutions/{institution_id}", response_model=InstitutionResponse)
async def get_institution(
    institution_id: uuid.UUID,
    _: User = Depends(require_role("superadmin")),
    db: AsyncSession = Depends(get_db),
) -> Institution:
    result = await db.execute(
        select(Institution).where(Institution.id == institution_id)
    )
    institution = result.scalar_one_or_none()
    if not institution:
        raise HTTPException(status_code=404, detail="Institution not found")
    return institution


@router.put("/institutions/{institution_id}", response_model=InstitutionResponse)
async def update_institution(
    institution_id: uuid.UUID,
    data: InstitutionUpdate,
    _: User = Depends(require_role("superadmin")),
    db: AsyncSession = Depends(get_db),
) -> Institution:
    result = await db.execute(
        select(Institution).where(Institution.id == institution_id)
    )
    institution = result.scalar_one_or_none()
    if not institution:
        raise HTTPException(status_code=404, detail="Institution not found")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(institution, key, value)

    await db.commit()
    await db.refresh(institution)
    return institution


@router.delete("/institutions/{institution_id}", status_code=204)
async def delete_institution(
    institution_id: uuid.UUID,
    _: User = Depends(require_role("superadmin")),
    db: AsyncSession = Depends(get_db),
) -> None:
    result = await db.execute(
        select(Institution).where(Institution.id == institution_id)
    )
    institution = result.scalar_one_or_none()
    if not institution:
        raise HTTPException(status_code=404, detail="Institution not found")

    await db.execute(delete(Institution).where(Institution.id == institution_id))
    await db.commit()


@router.post(
    "/institutions/{institution_id}/admin",
    response_model=UserResponse,
    status_code=201,
)
async def create_admin(
    institution_id: uuid.UUID,
    data: UserCreate,
    _: User = Depends(require_role("superadmin")),
    db: AsyncSession = Depends(get_db),
) -> User:
    # Check institution exists
    result = await db.execute(
        select(Institution).where(Institution.id == institution_id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Institution not found")

    # Check email uniqueness
    existing = await db.execute(select(User).where(User.email == data.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        email=data.email,
        password_hash=hash_password(data.password),
        full_name=data.full_name,
        phone=data.phone,
        role=UserRole.ADMIN,
        institution_id=institution_id,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user
