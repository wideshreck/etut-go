"""fix announcementtarget parent uppercase

The bf27c7a0e393 migration added 'parent' (lowercase) to announcementtarget,
but SQLAlchemy sends enum NAMES (uppercase 'PARENT'). This migration adds
the uppercase value so inserts succeed.

Revision ID: 35a75fe9d15e
Revises: 0df95a60de10
Create Date: 2026-04-04 00:52:15.776260

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "35a75fe9d15e"
down_revision: Union[str, Sequence[str], None] = "0df95a60de10"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add uppercase PARENT to announcementtarget if not already present."""
    op.execute(
        "ALTER TYPE announcementtarget ADD VALUE IF NOT EXISTS 'PARENT'"
    )


def downgrade() -> None:
    """PostgreSQL cannot remove enum values."""
    pass
