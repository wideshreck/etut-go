import uuid
from collections.abc import Callable, Coroutine
from typing import Any

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_access_token
from app.db.session import get_db
from app.models.user import User, UserRole

security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    try:
        payload = decode_access_token(credentials.credentials)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        ) from e

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )

    result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="User account is deactivated")

    return user


def require_role(
    *roles: str,
) -> Callable[..., Coroutine[Any, Any, User]]:
    """Dependency factory: require user to have one of the specified roles."""

    async def role_checker(
        current_user: User = Depends(get_current_user),
    ) -> User:
        if current_user.role.value not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return current_user

    return role_checker


async def _resolve_permissions(user: User, db: AsyncSession) -> set[str]:
    """Resolve permissions for a user."""
    from app.models.permission import PERMISSIONS, role_permissions, user_admin_roles

    if user.role == UserRole.SUPERADMIN:
        return set(PERMISSIONS)

    if user.role != UserRole.ADMIN:
        return set()

    result = await db.execute(
        select(role_permissions.c.permission)
        .join(
            user_admin_roles,
            user_admin_roles.c.role_id == role_permissions.c.role_id,
        )
        .where(user_admin_roles.c.user_id == user.id)
    )
    perms = {row[0] for row in result.all()}

    # No roles assigned = full admin (backward compatibility)
    if not perms:
        return set(PERMISSIONS)

    return perms


async def get_user_permissions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> set[str]:
    """Get all permissions for the current user (FastAPI dependency)."""
    return await _resolve_permissions(current_user, db)


def require_permission(
    permission: str,
) -> Callable[..., Coroutine[Any, Any, set[str]]]:
    """Dependency factory: require a specific permission."""

    async def checker(
        permissions: set[str] = Depends(get_user_permissions),
    ) -> set[str]:
        if permission not in permissions:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Bu işlem için yetkiniz yok: {permission}",
            )
        return permissions

    return checker
