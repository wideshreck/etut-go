from datetime import UTC, datetime, timedelta
from typing import Any

import jwt
from passlib.context import CryptContext

from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    result: str = pwd_context.hash(password)
    return result


def verify_password(plain_password: str, hashed_password: str) -> bool:
    result: bool = pwd_context.verify(plain_password, hashed_password)
    return result


def create_access_token(data: dict[str, str | None]) -> str:
    to_encode: dict[str, Any] = data.copy()
    expire = datetime.now(UTC) + timedelta(minutes=settings.jwt_expire_minutes)
    to_encode["exp"] = expire
    result: str = jwt.encode(
        to_encode, settings.jwt_secret, algorithm=settings.jwt_algorithm
    )
    return result


def decode_access_token(token: str) -> dict[str, str]:
    result: dict[str, str] = jwt.decode(
        token, settings.jwt_secret, algorithms=[settings.jwt_algorithm]
    )
    return result
