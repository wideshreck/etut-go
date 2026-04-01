import asyncio
import sys

from app.core.security import hash_password
from app.db.session import async_session
from app.models.user import User, UserRole


async def create_superadmin(email: str, password: str, full_name: str) -> None:
    async with async_session() as db:
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
    if len(sys.argv) != 4:
        print(  # noqa: T201
            "Usage: uv run python -m scripts.create_superadmin email password full_name"
        )
        sys.exit(1)
    asyncio.run(create_superadmin(sys.argv[1], sys.argv[2], sys.argv[3]))
