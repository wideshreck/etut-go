from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_log import AuditLog


async def log_action(
    db: AsyncSession,
    *,
    institution_id: str,
    user_id: str,
    action: str,
    entity_type: str,
    entity_id: str | None = None,
    description: str,
    ip_address: str | None = None,
) -> None:
    """Log an auditable action."""
    entry = AuditLog(
        institution_id=institution_id,
        user_id=user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        description=description,
        ip_address=ip_address,
    )
    db.add(entry)
    # Don't commit here -- caller controls the transaction
