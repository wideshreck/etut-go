"""add parent to announcement target enum

Revision ID: bf27c7a0e393
Revises: c965d4ffec4d
Create Date: 2026-03-28 03:35:11.135001

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "bf27c7a0e393"
down_revision: Union[str, Sequence[str], None] = "c965d4ffec4d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("ALTER TYPE announcementtarget ADD VALUE IF NOT EXISTS 'parent'")


def downgrade() -> None:
    """Downgrade schema."""
    # PostgreSQL does not support removing values from an enum type.
    # To fully downgrade, the enum would need to be recreated without 'parent'.
    pass
