"""add credit fields and update private lesson statuses

Revision ID: 465f7b4db2f2
Revises: d59fccaabe81
Create Date: 2026-03-27 22:16:41.441865

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "465f7b4db2f2"
down_revision: Union[str, Sequence[str], None] = "d59fccaabe81"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add new columns to private_lessons
    op.add_column(
        "private_lessons", sa.Column("classroom", sa.String(length=100), nullable=True)
    )
    op.add_column("private_lessons", sa.Column("notes", sa.Text(), nullable=True))

    # Add credit columns to users
    op.add_column("users", sa.Column("weekly_credits", sa.Integer(), nullable=True))
    op.add_column("users", sa.Column("credit_duration", sa.Integer(), nullable=True))

    # Handle enum migration: lessonstatus -> privatelessonstatus
    # 1. Create new enum type
    op.execute(
        "CREATE TYPE privatelessonstatus AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED_BY_STUDENT', 'CANCELLED_BY_TEACHER', 'NO_SHOW')"
    )

    # 2. Migrate existing data: convert CANCELLED -> CANCELLED_BY_STUDENT
    op.execute("""
        ALTER TABLE private_lessons
        ALTER COLUMN status TYPE varchar(30)
    """)
    op.execute("""
        UPDATE private_lessons
        SET status = 'CANCELLED_BY_STUDENT'
        WHERE status = 'CANCELLED'
    """)

    # 3. Cast column to new enum type
    op.execute("""
        ALTER TABLE private_lessons
        ALTER COLUMN status TYPE privatelessonstatus
        USING status::privatelessonstatus
    """)

    # 4. Set default
    op.execute("""
        ALTER TABLE private_lessons
        ALTER COLUMN status SET DEFAULT 'SCHEDULED'::privatelessonstatus
    """)

    # 5. Drop old enum type
    op.execute("DROP TYPE IF EXISTS lessonstatus")


def downgrade() -> None:
    """Downgrade schema."""
    # Recreate old enum
    op.execute(
        "CREATE TYPE lessonstatus AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED')"
    )

    # Convert back
    op.execute("""
        ALTER TABLE private_lessons
        ALTER COLUMN status TYPE varchar(30)
    """)
    op.execute("""
        UPDATE private_lessons
        SET status = 'CANCELLED'
        WHERE status IN ('CANCELLED_BY_STUDENT', 'CANCELLED_BY_TEACHER')
    """)
    op.execute("""
        UPDATE private_lessons
        SET status = 'COMPLETED'
        WHERE status = 'NO_SHOW'
    """)
    op.execute("""
        ALTER TABLE private_lessons
        ALTER COLUMN status TYPE lessonstatus
        USING status::lessonstatus
    """)
    op.execute("""
        ALTER TABLE private_lessons
        ALTER COLUMN status SET DEFAULT 'SCHEDULED'::lessonstatus
    """)
    op.execute("DROP TYPE IF EXISTS privatelessonstatus")

    op.drop_column("users", "credit_duration")
    op.drop_column("users", "weekly_credits")
    op.drop_column("private_lessons", "notes")
    op.drop_column("private_lessons", "classroom")
