"""add reservation assignment source

Revision ID: 7f4c2a1b9d10
Revises: 0e1ac137bdc9
Create Date: 2026-07-22
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "7f4c2a1b9d10"
down_revision: Union[str, Sequence[str], None] = "0e1ac137bdc9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "reservations",
        sa.Column(
            "assignment_source",
            sa.String(length=20),
            nullable=False,
            server_default="auto",
        ),
    )
    op.execute(
        """
        UPDATE reservations AS r
        SET assignment_source = CASE
            WHEN b.therapist_request_type = 'specific' THEN 'specific'
            ELSE 'auto'
        END
        FROM bookings AS b
        WHERE r.booking_id = b.booking_id
        """
    )
    op.alter_column("reservations", "assignment_source", server_default=None)


def downgrade() -> None:
    op.drop_column("reservations", "assignment_source")
