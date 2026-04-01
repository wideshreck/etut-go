from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import Notification


async def send_notification(
    db: AsyncSession,
    *,
    user_id: str,
    title: str,
    message: str,
    notification_type: str = "system",
    link: str | None = None,
) -> None:
    notif = Notification(
        user_id=user_id,
        title=title,
        message=message,
        type=notification_type,
        link=link,
    )
    db.add(notif)
    # Don't commit -- caller controls transaction


async def send_bulk_notification(
    db: AsyncSession,
    *,
    user_ids: list[str],
    title: str,
    message: str,
    notification_type: str = "system",
    link: str | None = None,
) -> None:
    for uid in user_ids:
        db.add(
            Notification(
                user_id=uid,
                title=title,
                message=message,
                type=notification_type,
                link=link,
            )
        )
