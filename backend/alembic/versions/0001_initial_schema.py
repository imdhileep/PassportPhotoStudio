"""initial schema

Revision ID: 0001_initial_schema
Revises: 
Create Date: 2026-01-22 00:19:00

"""
from alembic import op
import sqlalchemy as sa
from pgvector.sqlalchemy import Vector


# revision identifiers, used by Alembic.
revision = "0001_initial_schema"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    op.create_table(
        "devices",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("make", sa.String(length=128), nullable=True),
        sa.Column("model", sa.String(length=128), nullable=True),
        sa.Column("serial", sa.String(length=128), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_devices_serial", "devices", ["serial"])

    op.create_table(
        "locations",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("lat", sa.Float(), nullable=False),
        sa.Column("lon", sa.Float(), nullable=False),
        sa.Column("label", sa.String(length=256), nullable=True),
        sa.Column("city", sa.String(length=128), nullable=True),
        sa.Column("region", sa.String(length=128), nullable=True),
        sa.Column("country", sa.String(length=128), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("lat", "lon", name="uq_locations_lat_lon"),
    )

    op.create_table(
        "people",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(length=128), nullable=True),
        sa.Column("is_named", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    op.create_table(
        "users",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("is_admin", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("email", name="uq_users_email"),
    )
    op.create_index("ix_users_email", "users", ["email"])

    op.create_table(
        "media",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("sha256", sa.String(length=64), nullable=False),
        sa.Column("original_filename", sa.String(length=255), nullable=False),
        sa.Column("storage_path", sa.String(length=512), nullable=False),
        sa.Column("thumb_path", sa.String(length=512), nullable=True),
        sa.Column("mime_type", sa.String(length=128), nullable=True),
        sa.Column("media_type", sa.String(length=32), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("width", sa.Integer(), nullable=True),
        sa.Column("height", sa.Integer(), nullable=True),
        sa.Column("duration_seconds", sa.Float(), nullable=True),
        sa.Column("captured_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("imported_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("has_gps", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("gps_lat", sa.Float(), nullable=True),
        sa.Column("gps_lon", sa.Float(), nullable=True),
        sa.Column("gps_altitude", sa.Float(), nullable=True),
        sa.Column("camera_make", sa.String(length=128), nullable=True),
        sa.Column("camera_model", sa.String(length=128), nullable=True),
        sa.Column("orientation", sa.Integer(), nullable=True),
        sa.Column("season", sa.String(length=16), nullable=True),
        sa.Column("location_text", sa.String(length=256), nullable=True),
        sa.Column("raw_exif", sa.dialects.postgresql.JSONB(), nullable=True),
        sa.Column("face_count", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("device_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("location_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(["device_id"], ["devices.id"]),
        sa.ForeignKeyConstraint(["location_id"], ["locations.id"]),
        sa.UniqueConstraint("sha256", name="uq_media_sha256"),
        sa.UniqueConstraint("storage_path", name="uq_media_storage_path"),
    )
    op.create_index("ix_media_captured_at", "media", ["captured_at"])
    op.create_index("ix_media_season", "media", ["season"])
    op.create_index("ix_media_has_gps", "media", ["has_gps"])
    op.create_index("ix_media_media_type", "media", ["media_type"])
    op.create_index("ix_media_sha256", "media", ["sha256"])

    op.create_table(
        "faces",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("media_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("person_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("bbox_x", sa.Float(), nullable=False),
        sa.Column("bbox_y", sa.Float(), nullable=False),
        sa.Column("bbox_w", sa.Float(), nullable=False),
        sa.Column("bbox_h", sa.Float(), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=False),
        sa.Column("embedding", Vector(512), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["media_id"], ["media.id"]),
        sa.ForeignKeyConstraint(["person_id"], ["people.id"]),
    )
    op.create_index("ix_faces_media_id", "faces", ["media_id"])
    op.create_index("ix_faces_person_id", "faces", ["person_id"])

    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_faces_embedding "
        "ON faces USING ivfflat (embedding vector_cosine_ops) "
        "WITH (lists = 100)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_faces_embedding")
    op.drop_index("ix_faces_person_id", table_name="faces")
    op.drop_index("ix_faces_media_id", table_name="faces")
    op.drop_table("faces")
    op.drop_index("ix_media_sha256", table_name="media")
    op.drop_index("ix_media_media_type", table_name="media")
    op.drop_index("ix_media_has_gps", table_name="media")
    op.drop_index("ix_media_season", table_name="media")
    op.drop_index("ix_media_captured_at", table_name="media")
    op.drop_table("media")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")
    op.drop_table("people")
    op.drop_table("locations")
    op.drop_index("ix_devices_serial", table_name="devices")
    op.drop_table("devices")
    op.execute("DROP EXTENSION IF EXISTS vector")
