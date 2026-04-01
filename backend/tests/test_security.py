"""Tests for core security functions."""

import pytest

from app.core.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)


def test_hash_and_verify_password() -> None:
    hashed = hash_password("mypassword")
    assert hashed != "mypassword"
    assert verify_password("mypassword", hashed)
    assert not verify_password("wrongpassword", hashed)


def test_create_and_decode_access_token() -> None:
    data = {"sub": "user-123", "role": "admin", "institution_id": "inst-456"}
    token = create_access_token(data)
    decoded = decode_access_token(token)
    assert decoded["sub"] == "user-123"
    assert decoded["role"] == "admin"
    assert decoded["institution_id"] == "inst-456"
    assert "exp" in decoded


def test_decode_invalid_token() -> None:
    import jwt

    with pytest.raises(jwt.exceptions.DecodeError):
        decode_access_token("not-a-valid-token")
