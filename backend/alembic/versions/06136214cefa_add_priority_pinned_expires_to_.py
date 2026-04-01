"""add priority pinned expires to announcements

Revision ID: 06136214cefa
Revises: 2c62d25e063a
Create Date: 2026-03-27 19:55:44.376870

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "06136214cefa"
down_revision: Union[str, Sequence[str], None] = "2c62d25e063a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Create the enum type first
    announcementpriority = sa.Enum(
        "NORMAL", "IMPORTANT", "URGENT", name="announcementpriority"
    )
    announcementpriority.create(op.get_bind(), checkfirst=True)

    op.add_column(
        "announcements",
        sa.Column(
            "priority", announcementpriority, nullable=False, server_default="NORMAL"
        ),
    )
    op.add_column(
        "announcements",
        sa.Column(
            "is_pinned", sa.Boolean(), nullable=False, server_default=sa.text("false")
        ),
    )
    op.add_column(
        "announcements",
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "announcements",
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("announcements", "updated_at")
    op.drop_column("announcements", "expires_at")
    op.drop_column("announcements", "is_pinned")
    op.drop_column("announcements", "priority")

    # Drop the enum type
    sa.Enum(name="announcementpriority").drop(op.get_bind(), checkfirst=True)
