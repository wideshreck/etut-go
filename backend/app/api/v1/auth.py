from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.audit import log_action
from app.core.deps import _resolve_permissions, get_current_user
from app.core.security import create_access_token, hash_password, verify_password
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import LoginRequest

router = APIRouter(prefix="/auth", tags=["auth"])


def _user_to_response(user: User) -> dict[str, object]:
    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "phone": user.phone,
        "role": user.role.value,
        "institution_id": user.institution_id,
        "institution_name": user.institution.name if user.institution else None,
        "is_active": user.is_active,
    }


@router.post("/login")
async def login(
    data: LoginRequest, db: AsyncSession = Depends(get_db)
) -> dict[str, object]:
    result = await db.execute(
        select(User)
        .options(selectinload(User.institution))
        .where(User.email == data.email)
    )
    user = result.scalar_one_or_none()

    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated",
        )

    token = create_access_token(
        {
            "sub": str(user.id),
            "role": user.role.value,
            "institution_id": str(user.institution_id) if user.institution_id else None,
        }
    )

    await log_action(
        db,
        institution_id=str(user.institution_id) if user.institution_id else "system",
        user_id=str(user.id),
        action="login",
        entity_type="auth",
        description=f"{user.full_name} giriş yaptı",
    )
    await db.commit()

    perms = await _resolve_permissions(user, db)
    user_response = _user_to_response(user)
    user_response["permissions"] = sorted(perms)

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user_response,
    }


@router.get("/me")
async def get_me(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, object]:
    result = await db.execute(
        select(User)
        .options(selectinload(User.institution))
        .where(User.id == current_user.id)
    )
    user = result.scalar_one()

    response = _user_to_response(user)
    perms = await _resolve_permissions(current_user, db)
    response["permissions"] = sorted(perms)
    return response


@router.get("/me/permissions")
async def get_my_permissions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[str]:
    """Get current user's permissions."""
    perms = await _resolve_permissions(current_user, db)
    return sorted(perms)


# ── Password Change ─────────────────────────────────────────────────


class PasswordChange(BaseModel):
    current_password: str
    new_password: str


@router.put("/change-password")
async def change_password(
    data: PasswordChange,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    if not verify_password(data.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Mevcut şifre yanlış")

    if len(data.new_password) < 6:
        raise HTTPException(
            status_code=400, detail="Yeni şifre en az 6 karakter olmalı"
        )

    current_user.password_hash = hash_password(data.new_password)
    await db.commit()
    return {"status": "ok", "message": "Şifre başarıyla değiştirildi"}


# ── KVKK Consent ─────────────────────────────────────────────────────

CURRENT_KVKK_VERSION = "v1.0"


@router.get("/kvkk-status")
async def get_kvkk_status(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, object]:
    """Check if user has accepted current KVKK version."""
    from app.models.consent import KVKKConsent

    result = await db.execute(
        select(KVKKConsent).where(
            KVKKConsent.user_id == current_user.id,
            KVKKConsent.consent_type == "privacy_policy",
            KVKKConsent.version == CURRENT_KVKK_VERSION,
            KVKKConsent.is_accepted == True,  # noqa: E712
        )
    )
    consent = result.scalar_one_or_none()

    return {
        "accepted": consent is not None,
        "current_version": CURRENT_KVKK_VERSION,
        "accepted_at": consent.accepted_at if consent else None,
    }


@router.post("/kvkk-accept")
async def accept_kvkk(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """Accept current KVKK privacy policy."""
    from app.models.consent import KVKKConsent

    consent = KVKKConsent(
        user_id=current_user.id,
        consent_type="privacy_policy",
        version=CURRENT_KVKK_VERSION,
        is_accepted=True,
    )
    db.add(consent)
    await db.commit()

    return {"status": "ok", "version": CURRENT_KVKK_VERSION}
