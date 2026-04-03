import asyncio
import sys

from sqlalchemy import select

from app.core.security import hash_password
from app.db.session import async_session
from app.models.user import User, UserRole

DEFAULT_EMAIL = "super@etutpro.com"
DEFAULT_PASSWORD = "demo123"
DEFAULT_NAME = "Super Admin"


async def create_superadmin(
    email: str = DEFAULT_EMAIL,
    password: str = DEFAULT_PASSWORD,
    full_name: str = DEFAULT_NAME,
) -> None:
    async with async_session() as db:
        existing = await db.execute(select(User).where(User.email == email))
        if existing.scalar_one_or_none():
            print(f"Superadmin already exists: {email}")  # noqa: T201
            return

        user = User(
            email=email,
            password_hash=hash_password(password),
            full_name=full_name,
            role=UserRole.SUPERADMIN,
        )
        db.add(user)
        await db.commit()
        print(f"Superadmin created: {email}")  # noqa: T201


if __name__ == "__main__":
    if len(sys.argv) == 1:
        asyncio.run(create_superadmin())
    elif len(sys.argv) == 4:
        asyncio.run(create_superadmin(sys.argv[1], sys.argv[2], sys.argv[3]))
    else:
        print(  # noqa: T201
            "Usage: uv run python -m scripts.create_superadmin [email password full_name]"
        )
        sys.exit(1)
