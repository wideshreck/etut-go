"""add parent to userrole enum

Revision ID: 0df95a60de10
Revises: b35bf78d6e53
Create Date: 2026-04-04 00:29:02.666909

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0df95a60de10'
down_revision: Union[str, Sequence[str], None] = 'b35bf78d6e53'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'PARENT'")


def downgrade() -> None:
    """Downgrade schema."""
    # PostgreSQL does not support removing enum values
    pass
