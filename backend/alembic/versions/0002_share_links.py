"""share links

Revision ID: 0002_share_links
Revises: 0001_initial_schema
Create Date: 2026-01-22 01:25:00

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "0002_share_links"
down_revision = "0001_initial_schema"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "share_links",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("token", sa.String(length=64), nullable=False),
        sa.Column("filters", sa.dialects.postgresql.JSONB(), nullable=False),
        sa.Column("created_by", sa.dialects.postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.UniqueConstraint("token", name="uq_share_links_token"),
    )
    op.create_index("ix_share_links_token", "share_links", ["token"])


def downgrade() -> None:
    op.drop_index("ix_share_links_token", table_name="share_links")
    op.drop_table("share_links")
